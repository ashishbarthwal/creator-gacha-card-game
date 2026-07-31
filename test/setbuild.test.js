/* test/setbuild — pins set assembly on SYNTHETIC channels. No key, no network,
   no real creators. snapshotDate is injected, so a build is exactly assertable.

   The two load-bearing tests: that `country` cannot reach a published set (the
   last item on the launch Gate), and that a band too thin to survive a x10 is
   caught at build rather than by a player pulling the same card four times. */

import { describe, it, expect } from 'vitest';
import {
  minCardsForBand,
  bandsOf,
  bandHealth,
  pruneStarvedBands,
  assembleSet,
  PULL_SIZE,
  BAND_HEADROOM,
} from '../src/engine/setbuild.js';
import { RARITY_ORDER } from '../src/engine/core.js';

/* Subscriber counts that land squarely inside each band, so a fixture's rarity
   is obvious at the call site rather than needing the boundary table. */
const SUBS = { N: '50000', R: '500000', SR: '5000000', SSR: '20000000', UR: '80000000' };

function channel(rarity, i, over = {}) {
  return {
    id: `UC_${rarity}_${i}`,
    title: `${rarity} channel ${i}`,
    handle: `@${rarity}${i}`,
    avatarUrl: 'https://yt3.example/photo.jpg',
    subscriberCount: SUBS[rarity],
    hiddenSubscriberCount: false,
    viewCount: '9000000',
    videoCount: '120',
    country: 'US',
    ...over,
  };
}

/* n channels of a rarity — the roster shape these tests are all about. */
const roster = spec =>
  Object.entries(spec).flatMap(([rarity, n]) =>
    Array.from({ length: n }, (_, i) => channel(rarity, i)));

describe('minCardsForBand — derived from the weight table, not hand-tuned', () => {
  it('demands a deeper roster for common bands than rare ones', () => {
    const full = RARITY_ORDER;
    const mins = full.map(r => minCardsForBand(r, full));
    // N is drawn most often, so it needs the most distinct cards; UR the fewest
    expect(mins[0]).toBeGreaterThan(mins[full.length - 1]);
    expect([...mins]).toEqual([...mins].sort((a, b) => b - a)); // monotonically down
  });

  it('never allows a band below two cards, whatever the weight', () => {
    for (const rarity of RARITY_ORDER) {
      expect(minCardsForBand(rarity, RARITY_ORDER)).toBeGreaterThanOrEqual(2);
    }
  });

  it('is roughly the expected x10 draws times the headroom', () => {
    // N carries 55 of 100 -> ~5.5 draws in a x10 -> 11 at 2x headroom
    expect(minCardsForBand('N', RARITY_ORDER)).toBe(Math.ceil(PULL_SIZE * 0.55 * BAND_HEADROOM));
  });

  it('renormalizes over the bands actually present, matching the pull', () => {
    /* gacha.bandsFrom drops empty bands and renormalizes, so a set holding only
       N and R really draws 55:27 — the minimum has to be computed against that
       same total, not against 100. */
    const twoBands = minCardsForBand('N', ['N', 'R']);
    expect(twoBands).toBeGreaterThan(minCardsForBand('N', RARITY_ORDER));
  });
});

describe('bandsOf', () => {
  it('groups by derived rarity in RARITY_ORDER, omitting empty bands', () => {
    const bands = bandsOf(roster({ N: 2, SR: 1 }));
    expect(bands.map(b => b.rarity)).toEqual(['N', 'SR']);
    expect(bands[0].cards).toHaveLength(2);
  });

  it('skips entries with no id', () => {
    expect(bandsOf([{ subscriberCount: '1' }, null])).toEqual([]);
  });
});

describe('bandHealth — the 4x-same-card failure, caught at build', () => {
  it('flags a one-card band as starved', () => {
    /* The exact shape observed on 2026-07-31: one R card in a small pool
       returned four times in a single x10. */
    const health = bandHealth(roster({ N: 20, R: 1 }));
    expect(health.find(b => b.rarity === 'R')).toMatchObject({ count: 1, ok: false });
  });

  it('passes a roster with depth in every band', () => {
    expect(bandHealth(roster({ N: 40, R: 30, SR: 18 })).every(b => b.ok)).toBe(true);
  });

  it('reports the count and the requirement, so a caller can explain itself', () => {
    const band = bandHealth(roster({ N: 30, R: 2 })).find(b => b.rarity === 'R');
    expect(band.needed).toBeGreaterThan(band.count);
  });
});

describe('pruneStarvedBands', () => {
  it('drops the starved band and keeps the rest', () => {
    const { kept, dropped } = pruneStarvedBands(roster({ N: 30, R: 20, UR: 1 }));
    expect(dropped.map(b => b.rarity)).toEqual(['UR']);
    expect(kept.every(c => !c.id.startsWith('UC_UR'))).toBe(true);
    expect(kept).toHaveLength(50);
  });

  it('re-checks after a drop, since removing a band moves the other weights', () => {
    /* Dropping a band renormalizes the rest upward, which can starve a band
       that passed a moment ago — so one filtering pass is not enough. */
    const { dropped } = pruneStarvedBands(roster({ N: 11, R: 3, SR: 1 }));
    expect(dropped.length).toBeGreaterThan(1);
  });

  it('leaves a healthy roster untouched', () => {
    const channels = roster({ N: 40, R: 30 });
    expect(pruneStarvedBands(channels).dropped).toEqual([]);
  });
});

describe('assembleSet — the strip is the last Gate item', () => {
  const build = (spec, over = {}) =>
    assembleSet(roster(spec), { slug: 's1', title: 'Series 1', snapshotDate: '2026-07-31', ...over });

  it('never publishes country', () => {
    const { set } = build({ N: 40, R: 30 });
    for (const card of set.channels) expect(card).not.toHaveProperty('country');
  });

  it('leaks no country through the serialized file either', () => {
    /* The bytes that actually ship are what matter, not the object shape. */
    const { set } = assembleSet(roster({ N: 40, R: 30 }).map(c => ({ ...c, country: 'ZZ' })),
      { slug: 's1', title: 'Series 1', snapshotDate: '2026-07-31' });
    expect(JSON.stringify(set)).not.toMatch(/ZZ|country/);
  });

  it('publishes the Channel fields the seam expects', () => {
    const { set } = build({ N: 40, R: 30 });
    expect(Object.keys(set.channels[0]).sort()).toEqual(
      ['avatarUrl', 'handle', 'hiddenSubscriberCount', 'id', 'subscriberCount', 'title', 'videoCount', 'viewCount'],
    );
  });

  it('omits subscriberCount for a hidden channel, matching the live API', () => {
    const hidden = [
      ...roster({ N: 40, R: 30 }),
      { ...channel('N', 99), hiddenSubscriberCount: true, subscriberCount: undefined },
    ];
    const { set } = assembleSet(hidden, { slug: 's1', title: 'S', snapshotDate: '2026-07-31' });
    const card = set.channels.find(c => c.id === 'UC_N_99');
    expect(card).not.toHaveProperty('subscriberCount');
    expect(card.hiddenSubscriberCount).toBe(true);
  });

  it('carries the envelope data/sets.js parses back', () => {
    const { set } = build({ N: 40, R: 30 });
    expect(set).toMatchObject({ slug: 's1', title: 'Series 1', snapshotDate: '2026-07-31' });
    expect(Array.isArray(set.channels)).toBe(true);
  });

  it('refuses a set with no slug or title', () => {
    expect(() => assembleSet(roster({ N: 40 }), { title: 'x' })).toThrow(/slug/i);
  });

  it('refuses to write an empty set rather than shipping nothing', () => {
    expect(() => build({ UR: 1 })).toThrow(/no channels/i);
  });

  it('reports what it dropped, so a build is auditable', () => {
    const { dropped, health } = build({ N: 40, R: 30, UR: 1 });
    expect(dropped.map(b => b.rarity)).toEqual(['UR']);
    expect(health.every(b => b.ok)).toBe(true);
  });
});
