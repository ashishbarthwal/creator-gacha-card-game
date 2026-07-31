/* test/candidates — pins the candidate DB's pure core on SYNTHETIC fixtures.
   No key, no network, no real creators (the fixtures are the Channel shape, not
   people). The clock is injected, so firstSeen is an exact assertion rather than
   a "today" that changes what the suite means depending on when it runs.

   The load-bearing tests here are the strip and the eviction. Everything else is
   bookkeeping; those two are the file's reason to exist. */

import { describe, it, expect } from 'vitest';
import {
  toCandidate,
  mergeCandidates,
  denylistIds,
  poolCounts,
  refreshPools,
  hydratableIds,
  batchIds,
  parseRosterLines,
  CANDIDATE_DB_VERSION,
  HYDRATE_BATCH,
} from '../src/engine/candidates.js';

const FIXED_NOW = Date.UTC(2026, 6, 31); // 2026-07-31, a stable clock

/* A full Channel exactly as the seam emits it — every field the strip must
   drop is present, so "we committed a title" fails here instead of in review. */
function channel(over = {}) {
  return {
    id: 'UC_a',
    title: 'A Channel',
    handle: '@achannel',
    avatarUrl: 'https://yt3.example/photo.jpg',
    subscriberCount: '250000',
    hiddenSubscriberCount: false,
    viewCount: '9000000',
    videoCount: '120',
    country: 'US',
    ...over,
  };
}

describe('toCandidate — the strip is the point', () => {
  it('keeps only id, pool and firstSeen', () => {
    const record = toCandidate(channel(), { now: FIXED_NOW });
    expect(Object.keys(record).sort()).toEqual(['firstSeen', 'id', 'pool']);
  });

  it('commits no channel data — no title, avatar, counts or country', () => {
    const record = toCandidate(channel(), { now: FIXED_NOW });
    for (const forbidden of [
      'title', 'handle', 'avatarUrl', 'subscriberCount',
      'hiddenSubscriberCount', 'viewCount', 'videoCount', 'country',
    ]) {
      expect(record).not.toHaveProperty(forbidden);
    }
  });

  it('leaks no channel data through the serialized file either', () => {
    /* The real risk is a field that survives JSON round-tripping, so assert on
       the bytes that would actually be committed rather than the object. */
    const json = JSON.stringify(toCandidate(channel(), { now: FIXED_NOW }));
    expect(json).not.toMatch(/A Channel|achannel|yt3\.example|250000|9000000|US/);
  });

  it('records the pool hint and our own first-contact date', () => {
    const record = toCandidate(channel({ subscriberCount: '6000000' }), { now: FIXED_NOW });
    expect(record).toEqual({ id: 'UC_a', pool: 'legends', firstSeen: '2026-07-31' });
  });
});

describe('denylistIds — both hand-edited and audit shapes parse', () => {
  it('accepts bare id strings', () => {
    expect(denylistIds(['UC_a', 'UC_b'])).toEqual(new Set(['UC_a', 'UC_b']));
  });

  it('accepts audit records', () => {
    const list = [{ id: 'UC_a', reason: 'opt-out request', date: '2026-08-02' }];
    expect(denylistIds(list)).toEqual(new Set(['UC_a']));
  });

  it('accepts a mix, and the file envelope as well as a bare array', () => {
    expect(denylistIds({ denied: ['UC_a', { id: 'UC_b' }] })).toEqual(new Set(['UC_a', 'UC_b']));
  });

  it('is empty for missing or malformed input rather than throwing', () => {
    for (const bad of [undefined, null, {}, [null], [{}], ['']]) {
      expect(denylistIds(bad).size).toBe(0);
    }
  });
});

describe('mergeCandidates — accumulation', () => {
  it('adds newly discovered channels', () => {
    const out = mergeCandidates([], [channel({ id: 'UC_a' }), channel({ id: 'UC_b' })], { now: FIXED_NOW });
    expect(out.candidates.map(c => c.id)).toEqual(['UC_a', 'UC_b']);
    expect(out.added).toBe(2);
  });

  it('dedupes a rediscovered channel instead of double-adding it', () => {
    const prior = [{ id: 'UC_a', pool: 'majority', firstSeen: '2026-01-01' }];
    const out = mergeCandidates(prior, [channel({ id: 'UC_a' })], { now: FIXED_NOW });
    expect(out.candidates).toHaveLength(1);
    expect(out.added).toBe(0);
  });

  it('preserves the original firstSeen — a re-run cannot rewrite our history', () => {
    const prior = [{ id: 'UC_a', pool: 'majority', firstSeen: '2026-01-01' }];
    const out = mergeCandidates(prior, [channel({ id: 'UC_a' })], { now: FIXED_NOW });
    expect(out.candidates[0].firstSeen).toBe('2026-01-01');
  });

  it('sorts by id so the committed diff is reviewable', () => {
    const out = mergeCandidates([], [channel({ id: 'UC_z' }), channel({ id: 'UC_a' })], { now: FIXED_NOW });
    expect(out.candidates.map(c => c.id)).toEqual(['UC_a', 'UC_z']);
  });

  it('skips entries with no id rather than committing a broken record', () => {
    const out = mergeCandidates([{ pool: 'majority' }], [{ title: 'no id' }], { now: FIXED_NOW });
    expect(out.candidates).toEqual([]);
  });
});

describe('mergeCandidates — the denylist is what makes an opt-out stick', () => {
  it('EVICTS a denied channel that is already in the DB', () => {
    const prior = [
      { id: 'UC_a', pool: 'majority', firstSeen: '2026-01-01' },
      { id: 'UC_b', pool: 'legends', firstSeen: '2026-01-01' },
    ];
    const out = mergeCandidates(prior, [], { denylist: ['UC_a'], now: FIXED_NOW });
    expect(out.candidates.map(c => c.id)).toEqual(['UC_b']);
    expect(out.evicted).toBe(1);
  });

  it('refuses to re-admit a denied channel a later run rediscovers', () => {
    /* The regression that matters: sourcing WILL find them again — the channel
       still exists and still matches the keyword — so an opt-out that is not
       re-enforced on every merge silently expires at the next run. */
    const out = mergeCandidates([], [channel({ id: 'UC_a' }), channel({ id: 'UC_b' })], {
      denylist: ['UC_a'],
      now: FIXED_NOW,
    });
    expect(out.candidates.map(c => c.id)).toEqual(['UC_b']);
    expect(out.rejected).toBe(1);
    expect(out.added).toBe(1);
  });

  it('honors an audit-shaped denylist entry, not just a bare id', () => {
    const denylist = [{ id: 'UC_a', reason: 'creator asked, 2026-08-02', date: '2026-08-02' }];
    const out = mergeCandidates([{ id: 'UC_a', pool: 'majority', firstSeen: '2026-01-01' }], [], { denylist });
    expect(out.candidates).toEqual([]);
  });
});

describe('poolCounts', () => {
  it('counts each sourcing tier', () => {
    const candidates = [
      { id: 'UC_a', pool: 'legends' }, { id: 'UC_b', pool: 'majority' },
      { id: 'UC_c', pool: 'majority' }, { id: 'UC_d', pool: 'wildcards' },
    ];
    expect(poolCounts(candidates)).toEqual({ legends: 1, majority: 2, wildcards: 1 });
  });

  it('ignores an unknown pool tag instead of inventing a bucket', () => {
    expect(poolCounts([{ id: 'UC_a', pool: 'nonsense' }])).toEqual({ legends: 0, majority: 0, wildcards: 0 });
  });

  it('is all zeroes for an empty or missing DB', () => {
    expect(poolCounts([])).toEqual({ legends: 0, majority: 0, wildcards: 0 });
    expect(poolCounts(undefined)).toEqual({ legends: 0, majority: 0, wildcards: 0 });
  });
});

describe('refreshPools — the hint self-heals at hydrate', () => {
  it('re-tags a channel that grew past the legends band', () => {
    const prior = [{ id: 'UC_a', pool: 'majority', firstSeen: '2026-01-01' }];
    const out = refreshPools(prior, [channel({ id: 'UC_a', subscriberCount: '7000000' })]);
    expect(out[0]).toEqual({ id: 'UC_a', pool: 'legends', firstSeen: '2026-01-01' });
  });

  it('leaves an un-hydrated candidate alone — unknown is not demoted', () => {
    const prior = [{ id: 'UC_gone', pool: 'legends', firstSeen: '2026-01-01' }];
    expect(refreshPools(prior, [])).toEqual(prior);
  });
});

describe('hydratableIds — a denied creator is never looked up again', () => {
  it('drops denied ids before the fetch, not after', () => {
    const candidates = [{ id: 'UC_a' }, { id: 'UC_b' }, { id: 'UC_c' }];
    expect(hydratableIds(candidates, ['UC_b'])).toEqual(['UC_a', 'UC_c']);
  });

  it('returns every id when nothing is denied', () => {
    expect(hydratableIds([{ id: 'UC_a' }, { id: 'UC_b' }])).toEqual(['UC_a', 'UC_b']);
  });
});

describe('batchIds — channels.list takes 50 per unit', () => {
  it('splits into batches of at most 50', () => {
    const ids = Array.from({ length: 120 }, (_, i) => `UC_${i}`);
    const batches = batchIds(ids);
    expect(batches.map(b => b.length)).toEqual([50, 50, 20]);
    expect(batches.flat()).toEqual(ids);
  });

  it('a 500-candidate DB costs 10 quota units to hydrate', () => {
    expect(batchIds(Array.from({ length: 500 }, (_, i) => `UC_${i}`))).toHaveLength(10);
  });

  it('is empty for no ids, and never loops forever on a bad size', () => {
    expect(batchIds([])).toEqual([]);
    expect(batchIds(['UC_a'], 0)).toEqual([['UC_a']]);
    expect(HYDRATE_BATCH).toBe(50);
  });
});

/* The curated route. Keyword search cannot reach 10M+ subscribers with a
   hobby/craft vocabulary, and broadening that vocabulary would trade away the
   safety property it was chosen for — so the top bands come from a file a human
   maintains, which means the file has to tolerate being written by a human. */
describe('parseRosterLines — a roster a person can actually maintain', () => {
  it('reads one entry per line', () => {
    expect(parseRosterLines('@mkbhd\n@veritasium')).toEqual(['@mkbhd', '@veritasium']);
  });

  it('keeps comments and blank lines out, so the roster can carry its reasoning', () => {
    const text = `
      # Legends — chosen by hand, see WP9
      @mkbhd            # tech, instantly recognizable

      @veritasium
    `;
    expect(parseRosterLines(text)).toEqual(['@mkbhd', '@veritasium']);
  });

  it('drops a whole-line comment', () => {
    expect(parseRosterLines('# nothing here\n@real')).toEqual(['@real']);
  });

  it('dedupes case-insensitively, keeping the first occurrence', () => {
    expect(parseRosterLines('@MKBHD\n@mkbhd\n@other')).toEqual(['@MKBHD', '@other']);
  });

  it('preserves order — a roster is read top to bottom by whoever edits it', () => {
    expect(parseRosterLines('@c\n@a\n@b')).toEqual(['@c', '@a', '@b']);
  });

  it('handles CRLF, since this file will be edited on Windows', () => {
    expect(parseRosterLines('@a\r\n@b\r\n')).toEqual(['@a', '@b']);
  });

  it('is empty for empty or missing input rather than throwing', () => {
    for (const empty of ['', '   \n\n', '# only a comment', null, undefined]) {
      expect(parseRosterLines(empty)).toEqual([]);
    }
  });
});

describe('the file envelope', () => {
  it('carries a version a future migration can branch on', () => {
    expect(CANDIDATE_DB_VERSION).toBe(1);
  });
});
