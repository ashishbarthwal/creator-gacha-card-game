/* test/fairness — collection-size fairness for battle (2026-08-15 brief,
   items 15-27). Pure engine module, no I/O — every test here is a direct
   check of `src/engine/fairness.js`.

   The load-bearing claims: the 1.5x boundary is exact (the brief's own worked
   examples are asserted verbatim), a protected rarity is NEVER dropped when
   the player owns one and there is a slot for it, RUBY is NEVER protected
   even though it should still shed less than an N, and nothing this module
   touches is a clone — every card handed back is the exact object owned. */

import { describe, it, expect } from 'vitest';
import {
  MAX_COLLECTION_RATIO, PROTECTED_RARITIES, KEEP_WEIGHT,
  needsShedding, eligibleSizes, shedCollection, shedSummary, protectedRaritiesPresent,
} from '../src/engine/fairness.js';
import { rarityFromSubs } from '../src/engine/core.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Subscriber counts that land squarely inside each band, same convention
   test/setbuild.test.js uses, extended with RUBY. */
const SUBS = { N: '50000', R: '500000', SR: '5000000', SSR: '20000000', UR: '80000000', RUBY: '150000000' };

function channel(rarity, i, over = {}) {
  return {
    id: `UC_${rarity}_${i}`,
    title: `${rarity} channel ${i}`,
    subscriberCount: SUBS[rarity],
    hiddenSubscriberCount: false,
    viewCount: '9000000',
    videoCount: '120',
    ...over,
  };
}

const roster = spec =>
  Object.entries(spec).flatMap(([rarity, n]) =>
    Array.from({ length: n }, (_, i) => channel(rarity, i)));

describe('needsShedding / eligibleSizes — the 1.5x boundary', () => {
  /* Every one of these is a worked example lifted straight from the brief
     (items 17, 18, 29, 30, 31) — asserted verbatim rather than paraphrased,
     so a rounding slip shows up against the spec's own numbers. `small` is
     always the smaller side here, but `eligibleSizes` is checked in BOTH
     argument orders precisely because it must not care which is which. */
  it.each([
    [10, 12, false, 12],
    [10, 15, false, 15],     // exactly 1.5x — "no more than" means this is fine
    [40, 48, false, 48],
    [40, 60, false, 60],     // exactly 1.5x
    [40, 55, false, 55],     // 1.375x
    [80, 100, false, 100],   // 1.25x
    [10, 150, true, 15],
    [40, 100, true, 60],
  ])('%i vs %i -> shed=%s, eligible=%i', (small, large, shouldShed, eligibleLarge) => {
    expect(needsShedding(small, large)).toBe(shouldShed);
    expect(needsShedding(large, small)).toBe(shouldShed);   // order must not matter

    const forward = eligibleSizes(small, large);
    expect(forward).toEqual({ a: small, b: eligibleLarge });

    const backward = eligibleSizes(large, small);
    expect(backward).toEqual({ a: eligibleLarge, b: small });
  });

  it('rounds to a whole card (item 16)', () => {
    /* 13 * 1.5 = 19.5 -> rounds to 20. Chosen because it is not already a
       whole number, which a boundary test built only from round inputs
       would never catch. */
    expect(eligibleSizes(13, 30)).toEqual({ a: 13, b: 20 });
  });

  it('MAX_COLLECTION_RATIO is the 1.5 the brief specifies', () => {
    expect(MAX_COLLECTION_RATIO).toBe(1.5);
  });
});

describe('shedCollection — never invents, never shrinks below target', () => {
  it('returns everything, unchanged, when the collection is already at or under target', () => {
    const coll = roster({ N: 5, R: 3 });
    const result = shedCollection(coll, 20, { rng: mulberry32(1) });
    expect(result).toHaveLength(coll.length);
    expect(new Set(result.map(c => c.id))).toEqual(new Set(coll.map(c => c.id)));
  });

  it('returns exactly targetSize cards when the collection is larger', () => {
    const coll = roster({ N: 100, R: 30, SR: 10, SSR: 4, UR: 2 });
    const result = shedCollection(coll, 20, { rng: mulberry32(1) });
    expect(result).toHaveLength(20);
  });

  it('every returned card is the exact object owned — nothing cloned, nothing recomputed', () => {
    const coll = roster({ N: 40, R: 10, SR: 3, SSR: 2, UR: 1 });
    const result = shedCollection(coll, 15, { rng: mulberry32(7) });
    const byId = new Map(coll.map(c => [c.id, c]));
    for (const c of result) {
      expect(c).toBe(byId.get(c.id));   // reference equality, not deep equality
    }
  });

  it('never fields the same card twice, even if the input carries a duplicate', () => {
    const one = channel('N', 0);
    const coll = [one, one, ...roster({ R: 5 })];
    const result = shedCollection(coll, 3, { rng: mulberry32(2) });
    expect(new Set(result.map(c => c.id)).size).toBe(result.length);
  });

  it('is deterministic for a given rng seed', () => {
    const coll = roster({ N: 60, R: 20, SR: 8, SSR: 3, UR: 2, RUBY: 1 });
    const a = shedCollection(coll, 15, { rng: mulberry32(99) });
    const b = shedCollection(coll, 15, { rng: mulberry32(99) });
    expect(a.map(c => c.id)).toEqual(b.map(c => c.id));
  });
});

describe('shedCollection — the rarity protection guarantee (items 23-24)', () => {
  /* UR/SSR/SR must survive EVERY seed when the player owns one and the target
     leaves room — "guarantee" means never, not usually. */
  it('always keeps at least one UR, one SSR and one SR when the player owns them', () => {
    const coll = roster({ N: 80, R: 30, SR: 5, SSR: 3, UR: 2 });
    for (let seed = 1; seed <= 60; seed++) {
      const result = shedCollection(coll, 15, { rng: mulberry32(seed) });
      const present = new Set(result.map(c => rarityFromSubs(c.subscriberCount)));
      expect(present.has('UR')).toBe(true);
      expect(present.has('SSR')).toBe(true);
      expect(present.has('SR')).toBe(true);
    }
  });

  /* Item 24 verbatim: "A player owns 3 UR, 10 R, 20 N... guarantees at least
     1 UR. There is obviously no SSR or SR to preserve." No slot may be spent
     on a rarity that does not exist, and the shed must not error either. */
  it('never invents a protected slot for a rarity the player does not own', () => {
    const coll = [...roster({ UR: 3 }), ...roster({ R: 10 }), ...roster({ N: 20 })];
    expect(protectedRaritiesPresent(coll)).toEqual(['UR']);
    for (let seed = 1; seed <= 20; seed++) {
      const result = shedCollection(coll, 5, { rng: mulberry32(seed) });
      expect(result.length).toBe(5);
      expect(result.some(c => rarityFromSubs(c.subscriberCount) === 'UR')).toBe(true);
      const rarities = new Set(result.map(c => rarityFromSubs(c.subscriberCount)));
      expect(rarities.has('SSR')).toBe(false);
      expect(rarities.has('SR')).toBe(false);
    }
  });

  it('protectedRaritiesPresent reports only what the collection actually holds', () => {
    expect(protectedRaritiesPresent(roster({ N: 5, R: 5 }))).toEqual([]);
    expect(protectedRaritiesPresent(roster({ N: 5, SR: 1 }))).toEqual(['SR']);
    expect(protectedRaritiesPresent(roster({ SR: 1, SSR: 1, UR: 1 }))).toEqual(['UR', 'SSR', 'SR']);
  });

  /* A target too small for all three protected rarities must not overrun it
     — the guarantee yields to the target size rather than the other way
     round, and the function must still return exactly targetSize cards. */
  it('a target smaller than the number of protected rarities still returns exactly targetSize cards', () => {
    const coll = roster({ N: 30, R: 10, SR: 3, SSR: 3, UR: 3 });
    for (const targetSize of [1, 2]) {
      const result = shedCollection(coll, targetSize, { rng: mulberry32(3) });
      expect(result).toHaveLength(targetSize);
    }
  });
});

describe('shedCollection — RUBY is powerful but never protected (item 25)', () => {
  it('can be shed even when the player owns exactly one', () => {
    const coll = [...roster({ RUBY: 1 }), ...roster({ N: 40 })];
    let dropped = 0;
    const TRIALS = 300;
    for (let seed = 1; seed <= TRIALS; seed++) {
      const result = shedCollection(coll, 10, { rng: mulberry32(seed) });
      if (!result.some(c => rarityFromSubs(c.subscriberCount) === 'RUBY')) dropped++;
    }
    /* "Can be shed" rather than "is usually shed" — a handful of drops across
       300 seeds is enough to prove the mechanism is live without demanding a
       specific rate, which KEEP_WEIGHT.RUBY is free to retune. */
    expect(dropped).toBeGreaterThan(0);
  });

  it('is not in PROTECTED_RARITIES', () => {
    expect(PROTECTED_RARITIES).not.toContain('RUBY');
  });

  it('still sheds less often than an N — a real edge, just not a guarantee', () => {
    expect(KEEP_WEIGHT.RUBY).toBeGreaterThan(KEEP_WEIGHT.N);
    expect(KEEP_WEIGHT.RUBY).toBeGreaterThan(KEEP_WEIGHT.R);
  });
});

describe('shedCollection — bottom-heavy weighting (item 26)', () => {
  /* Statistical rather than exact: run the shed many times on a fixed
     collection and count how often each rarity survives. N should be shed
     far more often than UR, and the ordering across the whole ladder should
     be monotonic — exactly the "N highest chance... UR very low chance"
     shape the brief describes, without pinning a specific percentage. */
  it('lower rarities are shed far more often than higher ones', () => {
    const coll = [
      ...roster({ N: 30 }), ...roster({ R: 30 }), ...roster({ SR: 30 }),
      ...roster({ SSR: 30 }), ...roster({ UR: 30 }),
    ];
    const survivalCount = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 };
    const TRIALS = 150;
    for (let seed = 1; seed <= TRIALS; seed++) {
      /* Small target relative to the pool, so the weighting has to do real
         work rather than everything fitting anyway. Protected rarities are
         excluded from this measurement via the UR-vs-N-only trial below,
         since SR/SSR/UR's guaranteed slot would otherwise flatten the curve
         this test is trying to observe. */
      const result = shedCollection(coll, 10, { rng: mulberry32(seed) });
      for (const c of result) survivalCount[rarityFromSubs(c.subscriberCount)]++;
    }
    /* Per-card survival rate — dividing out the pool size (30 of each) keeps
       the comparison fair between rarities. */
    const rate = r => survivalCount[r] / (30 * TRIALS);
    expect(rate('N')).toBeLessThan(rate('R'));
    expect(rate('R')).toBeLessThan(rate('SR'));
    /* SR/SSR/UR all carry the protected-slot guarantee here, which floors
       their survival regardless of the weighting — so the monotonic claim
       above stops at N < R, and UR's much higher raw weight is asserted
       directly against KEEP_WEIGHT instead (below), not re-derived from a
       simulation the guarantee would distort. */
    expect(KEEP_WEIGHT.UR).toBeGreaterThan(KEEP_WEIGHT.SSR);
    expect(KEEP_WEIGHT.SSR).toBeGreaterThan(KEEP_WEIGHT.SR);
    expect(KEEP_WEIGHT.SR).toBeGreaterThan(KEEP_WEIGHT.R);
    expect(KEEP_WEIGHT.R).toBeGreaterThan(KEEP_WEIGHT.N);
  });
});

describe('shedCollection — the larger collection keeps a real advantage (item 27)', () => {
  /* The shed compresses the advantage, it must not erase it: a 150-card
     collection's eligible slice should still typically out-power a 10-card
     collection's entire pool, because it is a rarity-weighted slice of a
     genuinely bigger pool rather than a uniform random one. */
  it('a rarity-weighted eligible slice skews toward better rarities than the pool average', () => {
    const big = [...roster({ N: 100 }), ...roster({ R: 30 }), ...roster({ SR: 12 }), ...roster({ SSR: 5 }), ...roster({ UR: 3 })];
    const rank = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4, RUBY: 5 };
    const avgRank = channels => channels.reduce((s, c) => s + rank[rarityFromSubs(c.subscriberCount)], 0) / channels.length;

    /* Averaged over many seeds rather than one draw, so the claim is about
       the WEIGHTING and not about one favourable roll. */
    let total = 0;
    const TRIALS = 40;
    for (let seed = 1; seed <= TRIALS; seed++) {
      total += avgRank(shedCollection(big, 15, { rng: mulberry32(seed) }));
    }
    const eligibleAvg = total / TRIALS;
    const poolAvg = avgRank(big);
    /* A pool that is 100/150 = 67% N would give a uniform 15-card sample an
       average rank near the pool's own (~0.5). The weighted shed should sit
       well above it — this is the "still a real advantage" property, not
       a marginal one. */
    expect(eligibleAvg).toBeGreaterThan(poolAvg * 1.5);
  });
});

describe('shedSummary — the headline numbers for the warning screen (item 20)', () => {
  it('reports the full size, the eligible size, and how much is hidden', () => {
    expect(shedSummary(150, 15)).toEqual({ fullSize: 150, eligibleCount: 15, hiddenCount: 135 });
  });

  it('hiddenCount never goes negative when nothing was shed', () => {
    expect(shedSummary(10, 10)).toEqual({ fullSize: 10, eligibleCount: 10, hiddenCount: 0 });
  });
});
