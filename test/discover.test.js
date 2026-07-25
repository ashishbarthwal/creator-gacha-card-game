/* test/discover — pins Magic Search's pure engine on SYNTHETIC fixtures.
   Everything here runs with no key and no network: buildSearchParams takes an
   injected rng + clock (so a seed makes the "random" re-roll exact), and the
   harvest/filter/tag functions run against hand-authored JSON in the real
   search.list and Channel shapes. Never commit real search output — these
   fixtures are the response schema, not real creators. */

import { describe, it, expect } from 'vitest';
import {
  buildSearchParams,
  harvestChannelIds,
  passesFloor,
  passesRegion,
  assignPool,
  selectChannels,
  SEARCH_BASE,
} from '../src/engine/discover.js';

/* mulberry32 — same tiny seedable PRNG the gacha tests use, so "randomized"
   queries are deterministic and reproducible across runs and platforms. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 86_400_000;
const FIXED_NOW = Date.UTC(2026, 0, 1); // a stable clock, so windows are pinnable
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/* A search.list result is a video; its uploader is snippet.channelId. */
function videoResult(channelId, videoId) {
  return {
    kind: 'youtube#searchResult',
    id: { kind: 'youtube#video', videoId },
    snippet: { channelId, channelTitle: `Channel ${channelId}`, title: `Video ${videoId}` },
  };
}
function searchResponse(...items) {
  return { kind: 'youtube#searchListResponse', pageInfo: { resultsPerPage: 50 }, items };
}

/* A post-channels.list Channel, counts as strings, exactly the seam's shape. */
function channel(over = {}) {
  return {
    id: 'UC_x', title: 'X', handle: '@x', avatarUrl: '',
    subscriberCount: '5000', viewCount: '1000000', videoCount: '40',
    hiddenSubscriberCount: false, ...over,
  };
}

describe('buildSearchParams — the randomized query', () => {
  const build = seed => buildSearchParams('cooking asmr', { rng: mulberry32(seed), now: FIXED_NOW });

  it('carries the static base and the trimmed keyword', () => {
    const p = buildSearchParams('  cooking asmr  ', { rng: mulberry32(1), now: FIXED_NOW });
    expect(p).toMatchObject(SEARCH_BASE);
    expect(p.q).toBe('cooking asmr');
  });

  it('picks an order from the jitter set', () => {
    expect(['viewCount', 'date']).toContain(build(3).order);
  });

  it('produces a well-formed window exactly windowDays long, inside the lookback', () => {
    const p = build(3);
    expect(p.publishedAfter).toMatch(RFC3339);
    expect(p.publishedBefore).toMatch(RFC3339);
    const after = Date.parse(p.publishedAfter);
    const before = Date.parse(p.publishedBefore);
    expect(before - after).toBe(90 * DAY_MS);
    expect(after).toBeGreaterThanOrEqual(FIXED_NOW - 8 * 365 * DAY_MS);
    expect(before).toBeLessThanOrEqual(FIXED_NOW);
  });

  it('is fully reproducible under the same seed and clock', () => {
    expect(build(9)).toEqual(build(9));
  });

  it('re-rolling (a fresh seed) moves the window — the whole point of the feature', () => {
    expect(build(1).publishedAfter).not.toBe(build(2).publishedAfter);
  });

  it('sets regionCode only when regions are supplied', () => {
    expect(build(1).regionCode).toBeUndefined();
    const withRegion = buildSearchParams('k', {
      rng: mulberry32(1), now: FIXED_NOW, regions: ['US', 'JP'],
    });
    expect(['US', 'JP']).toContain(withRegion.regionCode);
  });
});

describe('harvestChannelIds — all uploaders, deduped', () => {
  it('harvests every uploader in first-seen order', () => {
    const json = searchResponse(
      videoResult('UC_a', 'v1'), videoResult('UC_b', 'v2'), videoResult('UC_c', 'v3'),
    );
    expect(harvestChannelIds(json)).toEqual(['UC_a', 'UC_b', 'UC_c']);
  });

  it('dedupes an uploader that has several videos in the results', () => {
    const json = searchResponse(
      videoResult('UC_a', 'v1'), videoResult('UC_b', 'v2'), videoResult('UC_a', 'v3'),
    );
    expect(harvestChannelIds(json)).toEqual(['UC_a', 'UC_b']);
  });

  it('skips malformed items and never throws', () => {
    const json = { items: [{ snippet: {} }, videoResult('UC_a', 'v1'), {}, null] };
    expect(harvestChannelIds(json)).toEqual(['UC_a']);
  });

  it('an empty or absent response yields an empty list', () => {
    expect(harvestChannelIds(searchResponse())).toEqual([]);
    expect(harvestChannelIds({})).toEqual([]);
    expect(harvestChannelIds(null)).toEqual([]);
  });
});

describe('passesFloor — cull the too-small and too-inactive', () => {
  it('passes a channel over both floors', () => {
    expect(passesFloor(channel())).toBe(true);
  });

  it('fails when subs are below the floor', () => {
    expect(passesFloor(channel({ subscriberCount: '999' }))).toBe(false);
  });

  it('fails when the channel has too few videos', () => {
    expect(passesFloor(channel({ videoCount: '4' }))).toBe(false);
  });

  it('passes exactly on the boundary, reading string counts', () => {
    expect(passesFloor(channel({ subscriberCount: '1000', videoCount: '5' }))).toBe(true);
  });

  it('a hidden subscriber count fails — a floor we cannot see is not cleared', () => {
    expect(passesFloor(channel({ hiddenSubscriberCount: true, subscriberCount: undefined })))
      .toBe(false);
  });

  it('respects a custom floor', () => {
    expect(passesFloor(channel({ subscriberCount: '2000' }), { minSubs: 5000, minVideos: 1 }))
      .toBe(false);
  });
});

describe('assignPool — the three sourcing pools by sub band', () => {
  it('5M subs and up is a legend (boundary inclusive)', () => {
    expect(assignPool(channel({ subscriberCount: '5000000' }))).toBe('legends');
  });

  it('just under 5M is majority', () => {
    expect(assignPool(channel({ subscriberCount: '4999999' }))).toBe('majority');
  });

  it('100k up to 5M is majority (boundary inclusive)', () => {
    expect(assignPool(channel({ subscriberCount: '100000' }))).toBe('majority');
    expect(assignPool(channel({ subscriberCount: '250000' }))).toBe('majority');
  });

  it('under 100k is a wildcard', () => {
    expect(assignPool(channel({ subscriberCount: '99999' }))).toBe('wildcards');
  });

  it('an unknown or hidden count falls to wildcards', () => {
    expect(assignPool(channel({ hiddenSubscriberCount: true, subscriberCount: undefined })))
      .toBe('wildcards');
  });

  it('respects custom bands', () => {
    expect(assignPool(channel({ subscriberCount: '2000000' }), { legendsMin: 1_000_000, majorityMin: 10_000 }))
      .toBe('legends');
  });
});

describe('buildSearchParams — deterministic mode (the prototype uses this)', () => {
  it('omits the published window when windowDays is null', () => {
    const p = buildSearchParams('chess', { windowDays: null, orders: ['viewCount'] });
    expect(p.publishedAfter).toBeUndefined();
    expect(p.publishedBefore).toBeUndefined();
    expect(p.order).toBe('viewCount');
  });

  it('touches no rng when the window is off and the order is fixed', () => {
    const boom = () => { throw new Error('rng must not be called'); };
    expect(() => buildSearchParams('chess', { rng: boom, windowDays: null, orders: ['viewCount'] }))
      .not.toThrow();
  });

  it('is byte-identical for the same keyword (no randomness)', () => {
    const opts = { windowDays: null, orders: ['viewCount'] };
    expect(buildSearchParams('chess', opts)).toEqual(buildSearchParams('chess', opts));
  });
});

describe('selectChannels — floor + cap per query', () => {
  const passing = n => Array.from({ length: n }, (_, i) =>
    channel({ id: `UC_ok_${i}`, subscriberCount: '5000', videoCount: '40' }));

  it('keeps only channels that clear the floor, in order', () => {
    const pool = [
      channel({ id: 'UC_ok', subscriberCount: '5000', videoCount: '40' }),
      channel({ id: 'UC_small', subscriberCount: '10', videoCount: '40' }),
      channel({ id: 'UC_idle', subscriberCount: '5000', videoCount: '2' }),
    ];
    expect(selectChannels(pool, { cap: 5 }).map(c => c.id)).toEqual(['UC_ok']);
  });

  it('caps the count at `cap`, preserving rank order', () => {
    const kept = selectChannels(passing(10), { cap: 5 });
    expect(kept.map(c => c.id)).toEqual(['UC_ok_0', 'UC_ok_1', 'UC_ok_2', 'UC_ok_3', 'UC_ok_4']);
  });

  it('returns fewer than the cap when few qualify', () => {
    expect(selectChannels(passing(2), { cap: 5 })).toHaveLength(2);
  });

  it('defaults the cap to 5', () => {
    expect(selectChannels(passing(9))).toHaveLength(5);
  });

  it('excludes an IN channel even when it clears the floor', () => {
    const pool = [
      channel({ id: 'UC_us', country: 'US', subscriberCount: '5000', videoCount: '40' }),
      channel({ id: 'UC_in', country: 'IN', subscriberCount: '5000', videoCount: '40' }),
    ];
    expect(selectChannels(pool, { cap: 5 }).map(c => c.id)).toEqual(['UC_us']);
  });
});

describe('passesRegion — the local-risk exclude', () => {
  it('excludes a self-declared IN channel by default, case-insensitively', () => {
    expect(passesRegion(channel({ country: 'IN' }))).toBe(false);
    expect(passesRegion(channel({ country: 'in' }))).toBe(false);
  });

  it('keeps channels from other countries', () => {
    expect(passesRegion(channel({ country: 'US' }))).toBe(true);
    expect(passesRegion(channel({ country: 'GB' }))).toBe(true);
  });

  it("keeps a channel with no declared country — the unknown can't be excluded", () => {
    expect(passesRegion(channel({ country: '' }))).toBe(true);
    expect(passesRegion(channel())).toBe(true);
  });

  it('respects a custom exclude list, and [] disables it', () => {
    expect(passesRegion(channel({ country: 'US' }), ['US', 'CA'])).toBe(false);
    expect(passesRegion(channel({ country: 'IN' }), [])).toBe(true);
  });
});
