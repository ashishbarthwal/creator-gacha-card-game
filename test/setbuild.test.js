/* test/setbuild — pins set assembly on SYNTHETIC channels. No key, no network,
   no real creators. snapshotDate is injected, so a build is exactly assertable.

   The two load-bearing tests: that `country` cannot reach a published set (the
   last item on the launch Gate), and that a band too thin to survive a x10 is
   caught at build rather than by a player pulling the same card four times. */

import { describe, it, expect } from 'vitest';
import {
  minCardsForBand,
  bandTargets,
  capBands,
  bandsOf,
  bandHealth,
  pruneStarvedBands,
  assembleSet,
  applyExcludes,
  PULL_SIZE,
  BAND_HEADROOM,
  DEFAULT_TARGET_SIZE,
  UNCAPPED,
} from '../src/engine/setbuild.js';
import { RARITY, RARITY_ORDER } from '../src/engine/core.js';

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

/* Expected pulls to collect every card in a band — the quantity the cap exists
   to equalize. Written out here rather than imported so the test states the
   model independently of the implementation. */
function completesIn(k, rarity, present = RARITY_ORDER) {
  const total = present.reduce((sum, r) => sum + RARITY[r].weight, 0);
  let h = 0;
  for (let i = 1; i <= k; i++) h += 1 / i;
  return (k * h) / (RARITY[rarity].weight / total);
}

describe('bandTargets — the cap, so a chase card is reachable', () => {
  it('spends exactly the budget', () => {
    const targets = bandTargets(RARITY_ORDER, { targetSize: 400 });
    expect(Object.values(targets).reduce((a, b) => a + b, 0)).toBe(400);
  });

  it('gives every band roughly the same completion time', () => {
    /* The whole point: the 79-card build had base bands finishing in ~200 pulls
       and UR in ~3,720. Within 10% of each other is the fix. */
    const targets = bandTargets(RARITY_ORDER, { targetSize: 400 });
    const times = RARITY_ORDER.map(r => completesIn(targets[r], r));
    expect(Math.max(...times) / Math.min(...times)).toBeLessThan(1.1);
  });

  it('never allocates a band below the floor it has to clear', () => {
    for (const size of [40, 120, 400]) {
      const targets = bandTargets(RARITY_ORDER, { targetSize: size });
      for (const rarity of RARITY_ORDER) {
        expect(targets[rarity]).toBeGreaterThanOrEqual(minCardsForBand(rarity, RARITY_ORDER));
      }
    }
  });

  it('honours the floors over the budget when the budget is too small', () => {
    /* A starved band is a broken pull; an oversized set is only a longer one, so
       this overshoots rather than shipping a band that repeats. */
    const targets = bandTargets(RARITY_ORDER, { targetSize: 1 });
    const total = Object.values(targets).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(1);
    expect(targets.UR).toBe(minCardsForBand('UR', RARITY_ORDER));
  });

  it('allocates a deeper roster to common bands than to rare ones', () => {
    const targets = bandTargets(RARITY_ORDER, { targetSize: 400 });
    const counts = RARITY_ORDER.map(r => targets[r]);
    expect([...counts]).toEqual([...counts].sort((a, b) => b - a));
  });

  it('renormalizes over the bands actually present', () => {
    const twoBands = bandTargets(['N', 'R'], { targetSize: 100 });
    expect(Object.keys(twoBands).sort()).toEqual(['N', 'R']);
    expect(twoBands.N + twoBands.R).toBe(100);
  });
});

describe('capBands — the surplus becomes a later printing, not waste', () => {
  it('trims an over-deep band and leaves a thin one alone', () => {
    const { kept, capped } = capBands(roster({ N: 40, R: 30, UR: 12 }), { targetSize: 400 });
    const urKept = kept.filter(c => c.id.startsWith('UC_UR'));
    expect(urKept.length).toBeLessThan(12);
    expect(capped.map(c => c.rarity)).toEqual(['UR']);
    expect(kept.filter(c => c.id.startsWith('UC_N'))).toHaveLength(40); // under target, untouched
  });

  it('is reproducible — same seed, same cards', () => {
    const channels = roster({ N: 40, R: 30, UR: 12 });
    const a = capBands(channels, { targetSize: 400, seed: 'series-1' });
    const b = capBands(channels, { targetSize: 400, seed: 'series-1' });
    expect(a.kept.map(c => c.id)).toEqual(b.kept.map(c => c.id));
  });

  /* REGRESSION, 2026-08-03. "The cap comes off" made the printing the whole
     pool, but DEFAULT_TARGET_SIZE stayed at 400 — so every by-hand build passed
     --target and the scheduled refresh, which passes nothing, republished the
     live site at 400 cards instead of 19,874. It had done exactly what it was
     told. These pin the fix so the automated path cannot quietly re-cap. */
  it('UNCAPPED ships every card, trimming nothing', () => {
    const channels = roster({ N: 40, R: 30, UR: 12 });
    const { kept, capped } = capBands(channels, { targetSize: UNCAPPED });
    expect(kept).toHaveLength(channels.length);
    expect(capped).toEqual([]);
  });

  it('UNCAPPED reports each band at its own full depth', () => {
    const { targets } = capBands(roster({ N: 40, R: 30, UR: 12 }), { targetSize: UNCAPPED });
    expect(targets).toEqual({ N: 40, R: 30, UR: 12 });
  });

  /* A big NUMBER is not the same as uncapped, which is why UNCAPPED is a symbol
     and not a convention. This is the trap the old builds were one sourcing run
     away from: a target chosen to be "bigger than the pool" starts capping again
     the moment the pool grows past it, and the build still reports success. */
  it('a merely-large target still caps, where UNCAPPED does not', () => {
    const channels = roster({ N: 40, R: 30, UR: 12 });
    const capped = capBands(channels, { targetSize: 400 });
    const uncapped = capBands(channels, { targetSize: UNCAPPED });
    expect(capped.kept.length).toBeLessThan(uncapped.kept.length);
  });

  it('selects a different subset for a different slug — the rotation', () => {
    /* This is what makes the surplus Series 2's chase cards rather than dead
       weight, with no rotation ledger to keep. */
    const channels = roster({ N: 40, R: 30, UR: 12 });
    const one = capBands(channels, { targetSize: 400, seed: 'series-1' });
    const two = capBands(channels, { targetSize: 400, seed: 'series-2' });
    const urs = r => r.kept.filter(c => c.id.startsWith('UC_UR')).map(c => c.id).sort();
    expect(urs(one)).not.toEqual(urs(two));
  });

  it('rotates at about k/R, not merely "not identical"', () => {
    /* The version of this test that only asserted the two subsets differed
       passed against a hash where consecutive printings shared 64% of the band.
       hashOf(`${seed}:${id}`) shifted every id by the same constant, which
       preserves sort order — so the rotation was almost entirely cosmetic and
       nothing failed. Overlap is now measured against the model that justifies
       the roster depth: a roster of R repeats k/R of a k-card band. */
    const k = 8, R = 56;
    const channels = roster({ N: 200, R: 120, UR: R });
    let shared = 0;
    const runs = 40;
    for (let i = 0; i < runs; i++) {
      const pick = seed => new Set(
        capBands(channels, { targetSize: 400, seed }).kept
          .filter(c => c.id.startsWith('UC_UR')).map(c => c.id));
      const a = pick(`series-${i}`);
      const b = pick(`series-${i + 1}`);
      shared += [...b].filter(id => a.has(id)).length;
    }
    const rate = shared / runs / k;
    expect(rate).toBeGreaterThan(0.05);   // not pathologically disjoint
    expect(rate).toBeLessThan(0.30);      // and nowhere near the 0.64 the old hash gave
  });

  it('keeps a pinned card the hash would have dropped', () => {
    /* The exact failure that motivated pins: the first 400-card build hashed
       PewDiePie, Mark Rober and Dude Perfect out of UR and kept five record
       labels. A pin is how the roster says which cards a set is sold on. */
    const channels = roster({ N: 40, R: 30, UR: 12 });
    const unpinned = capBands(channels, { targetSize: 400, seed: 'series-1' });
    const dropped = channels.filter(c =>
      c.id.startsWith('UC_UR') && !unpinned.kept.some(k => k.id === c.id));
    expect(dropped.length).toBeGreaterThan(0);

    const pinned = capBands(channels, { targetSize: 400, seed: 'series-1', pinned: new Set([dropped[0].id]) });
    expect(pinned.kept.some(c => c.id === dropped[0].id)).toBe(true);
  });

  it('reports when there are more pins than slots, rather than silently dropping one', () => {
    const channels = roster({ N: 40, R: 30, UR: 12 });
    const allPinned = new Set(channels.filter(c => c.id.startsWith('UC_UR')).map(c => c.id));
    const { capped } = capBands(channels, { targetSize: 400, seed: 's', pinned: allPinned });
    expect(capped.find(c => c.rarity === 'UR').droppedPins).toBeGreaterThan(0);
  });

  it('leaves the rotation intact for everything that is not pinned', () => {
    /* Pins decide the headline cards; the seed still decides the remainder, so
       a later printing keeps drawing a different supporting cast. */
    const channels = roster({ N: 40, R: 30, UR: 12 });
    const pin = new Set(['UC_UR_0']);
    const one = capBands(channels, { targetSize: 400, seed: 'series-1', pinned: pin });
    const two = capBands(channels, { targetSize: 400, seed: 'series-2', pinned: pin });
    const urs = r => r.kept.filter(c => c.id.startsWith('UC_UR')).map(c => c.id).sort();
    expect(urs(one)).toContain('UC_UR_0');
    expect(urs(two)).toContain('UC_UR_0');
    expect(urs(one)).not.toEqual(urs(two));
  });

  it('leaves every band healthy after capping', () => {
    const { kept } = capBands(roster({ N: 300, R: 200, SR: 90, SSR: 40, UR: 20 }), { targetSize: 400 });
    expect(bandHealth(kept).every(b => b.ok)).toBe(true);
    expect(kept).toHaveLength(400);
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
    /* publishedAt joined this list for the battle axes (engine/battle-stats.js),
       and it is the allowlist working as designed that this assertion had to be
       updated by hand to admit it. A launch DATE is not a performance
       statistic, so it sits outside the 30-day cap the strip exists to honour —
       the same class of fact as the title or the handle. `country` is still
       absent, which is the leak this test was originally written to catch. */
    expect(Object.keys(set.channels[0]).sort()).toEqual(
      ['avatarUrl', 'handle', 'hiddenSubscriberCount', 'id', 'publishedAt', 'subscriberCount', 'title', 'videoCount', 'viewCount'],
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

  it('caps an over-deep band and reports that too', () => {
    /* The 79-card shape that prompted the cap: 12 UR against a thin base. */
    const { set, capped } = build({ N: 27, R: 16, SR: 8, SSR: 16, UR: 12 });
    const urs = set.channels.filter(c => Number(c.subscriberCount) >= 50e6);
    expect(urs.length).toBeLessThan(12);
    expect(capped.find(c => c.rarity === 'UR')).toMatchObject({ from: 12 });
  });

  it('prunes before it caps, so a starved band is never allocated a budget', () => {
    const { set, dropped, capped, targets } = build({ N: 40, R: 30, UR: 1 });
    expect(dropped.map(b => b.rarity)).toEqual(['UR']);
    expect(targets).not.toHaveProperty('UR');
    expect(capped.some(c => c.rarity === 'UR')).toBe(false);
    expect(set.channels.every(c => Number(c.subscriberCount) < 50e6)).toBe(true);
  });

  it('defaults to a full printing', () => {
    expect(DEFAULT_TARGET_SIZE).toBeGreaterThanOrEqual(300);
    const { set } = build({ N: 400, R: 300, SR: 150, SSR: 60, UR: 30 });
    expect(set.channels).toHaveLength(DEFAULT_TARGET_SIZE);
  });
});

describe('applyExcludes — curation, kept apart from the opt-out', () => {
  const cards = roster({ SR: 5 });

  it('removes exactly the listed ids and reports them', () => {
    const { kept, removed } = applyExcludes(cards, ['UC_SR_1', 'UC_SR_3']);
    expect(kept.map(c => c.id)).toEqual(['UC_SR_0', 'UC_SR_2', 'UC_SR_4']);
    expect(removed.map(c => c.id)).toEqual(['UC_SR_1', 'UC_SR_3']);
  });

  it('is a no-op on an empty list, so an absent file cannot silently shrink a set', () => {
    expect(applyExcludes(cards, []).kept).toHaveLength(5);
    expect(applyExcludes(cards, new Set()).kept).toHaveLength(5);
  });

  it('takes an array or a Set, and ignores ids that are not present', () => {
    expect(applyExcludes(cards, new Set(['UC_SR_0'])).kept).toHaveLength(4);
    expect(applyExcludes(cards, ['UC_nobody']).removed).toHaveLength(0);
  });

  /* The load-bearing one. Excluding runs BEFORE the cap, so a removed card frees
     its slot for the next-best candidate rather than shrinking the band — which
     is the whole reason this is a build-time filter and not a DB eviction. */
  it('frees the slot rather than shrinking the band', () => {
    const deep = roster({ N: 400, R: 200, SR: 120, SSR: 60, UR: 20 });
    const targetSize = 300;
    const before = assembleSet(deep, { slug: 's', title: 'S', targetSize, snapshotDate: '2026-08-01' });
    const { kept } = applyExcludes(deep, deep.filter(c => c.id.startsWith('UC_SR_')).slice(0, 10).map(c => c.id));
    const after = assembleSet(kept, { slug: 's', title: 'S', targetSize, snapshotDate: '2026-08-01' });

    const srOf = set => set.channels.filter(c => c.subscriberCount === SUBS.SR).length;
    expect(srOf(after.set)).toBe(srOf(before.set));
    for (const id of ['UC_SR_0', 'UC_SR_9']) {
      expect(after.set.channels.some(c => c.id === id)).toBe(false);
    }
  });
});
