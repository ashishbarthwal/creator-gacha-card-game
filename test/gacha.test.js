/* test/gacha — pins the pull engine with a seeded RNG.
   gacha.js takes rng as a parameter precisely so these tests can inject a
   deterministic sequence: with a fixed seed the distribution is exact and
   repeatable, so "rare cards are rare" is a real assertion, not a vibe.

   The two-stage pull's whole claim is that drop rates follow the weight table
   and nothing else — not how many cards each band holds. That claim is pinned
   below as an exact sequence equality, not a tolerance. */

import { describe, it, expect } from 'vitest';
import { pull, pullOne, bandsFrom } from '../src/engine/gacha.js';
import { RARITY, RARITY_ORDER } from '../src/engine/core.js';

/* mulberry32 — tiny seedable PRNG, deterministic across runs and platforms. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Minimal pool: gacha only reads card.rarity; ids identify pulls. */
function poolOfEachRarity() {
  return RARITY_ORDER.map(rarity => ({ rarity, channel: { id: `id-${rarity}` } }));
}

function cardsOf(rarity, n, tag = rarity) {
  return Array.from({ length: n }, (_, i) => ({ rarity, channel: { id: `${tag}-${i}` } }));
}

function tally(cards) {
  const counts = Object.fromEntries(RARITY_ORDER.map(r => [r, 0]));
  for (const card of cards) counts[card.rarity]++;
  return counts;
}

describe('pull — shape', () => {
  it('x10 returns exactly 10 cards', () => {
    expect(pull(poolOfEachRarity(), 10, mulberry32(1))).toHaveLength(10);
  });

  it('x1 returns exactly 1 card', () => {
    expect(pull(poolOfEachRarity(), 1, mulberry32(1))).toHaveLength(1);
  });

  it('empty pool returns an empty result, never throws', () => {
    expect(pull([], 10, mulberry32(1))).toEqual([]);
  });

  it('every result is a member of the pool', () => {
    const pool = poolOfEachRarity();
    for (const card of pull(pool, 50, mulberry32(7))) {
      expect(pool).toContain(card);
    }
  });
});

describe('pull — dupes stack rather than drop', () => {
  it('a rigged rng returns the same card ten times, and all ten are kept', () => {
    const pool = poolOfEachRarity();
    const alwaysZero = () => 0; // lands on the first band, then its first card
    const results = pull(pool, 10, alwaysZero);
    expect(results).toHaveLength(10);
    expect(new Set(results).size).toBe(1);
    expect(results[0].channel.id).toBe('id-N');
  });

  it('a seeded x10 keeps its duplicates — result length beats unique count', () => {
    /* Five cards over ten draws makes a dupe certain by pigeonhole; the seed
       pins which ones, so this stays an exact, reproducible draw. */
    const results = pull(poolOfEachRarity(), 10, mulberry32(42));
    expect(results.length).toBe(10);
    expect(new Set(results).size).toBeLessThan(10);
  });
});

describe('pull — weighting favors low rarity (seeded, deterministic)', () => {
  it('over 1000 seeded pulls, frequency follows the weight table strictly', () => {
    const counts = tally(pull(poolOfEachRarity(), 1000, mulberry32(2026)));

    /* Weights are 55/27/12/5/0.9/0.1 — the observed order must match exactly. */
    expect(counts.N).toBeGreaterThan(counts.R);
    expect(counts.R).toBeGreaterThan(counts.SR);
    expect(counts.SR).toBeGreaterThan(counts.SSR);
    expect(counts.SSR).toBeGreaterThan(counts.UR);
    expect(counts.UR).toBeGreaterThanOrEqual(counts.RUBY);

    /* And the commonest band dominates: N alone is a majority of all pulls. */
    expect(counts.N).toBeGreaterThan(500);
  });

  it('observed rates land on the declared weights, not merely in order', () => {
    /* The table sums to 100, so each weight reads directly as a percentage.
       Two-stage makes that literal; the old per-card sum did not. */
    const draws = 4000;
    const counts = tally(pull(poolOfEachRarity(), draws, mulberry32(31337)));
    for (const rarity of RARITY_ORDER) {
      const observed = (counts[rarity] / draws) * 100;
      expect(Math.abs(observed - RARITY[rarity].weight)).toBeLessThan(2.5);
    }
  });

  it('the same seed reproduces the identical sequence', () => {
    const pool = poolOfEachRarity();
    const a = pull(pool, 100, mulberry32(99)).map(c => c.rarity);
    const b = pull(pool, 100, mulberry32(99)).map(c => c.rarity);
    expect(a).toEqual(b);
  });
});

describe('pull — drop rates are independent of pool size (the two-stage fix)', () => {
  /* The regression this whole change exists for. Under the old per-card
     weighting, burying one UR under 200 N cards cut its rate ~58x. */
  const bandSequence = (cards, seed, n = 600) =>
    pull(cards, n, mulberry32(seed)).map(card => card.rarity);

  it('padding a band with 200 more cards does not shift any band rate', () => {
    const small = poolOfEachRarity();
    const padded = [...small, ...cardsOf('N', 200, 'filler')];
    /* Identical, not merely close: stage 1 sees the same five bands at the same
       weights, and consumes the rng stream the same way, so the band sequence
       for a given seed cannot move. Card choice inside a band differs; the
       rarity curve does not. */
    expect(bandSequence(padded, 2026)).toEqual(bandSequence(small, 2026));
  });

  it('a UR buried under 200 commons still drops at roughly its 0.9% weight', () => {
    const draws = 4000;
    const pool = [...cardsOf('N', 200), { rarity: 'UR', channel: { id: 'id-UR' } }];
    const counts = tally(pull(pool, draws, mulberry32(7)));
    const urRate = (counts.UR / draws) * 100;
    expect(urRate).toBeGreaterThan(0.4);   // old engine: ~0.009%
    expect(urRate).toBeLessThan(2);
  });

  it('every card in a band is reachable — selection inside a band is uniform', () => {
    const pool = cardsOf('N', 3);
    const byId = {};
    for (const card of pull(pool, 600, mulberry32(5))) {
      byId[card.channel.id] = (byId[card.channel.id] ?? 0) + 1;
    }
    expect(Object.keys(byId)).toHaveLength(3);
    for (const count of Object.values(byId)) {
      expect(count).toBeGreaterThan(120); // uniform thirds ≈ 200 each
    }
  });
});

describe('bandsFrom — stage-1 grouping', () => {
  it('drops bands with no cards, so weights renormalize over what is pullable', () => {
    const bands = bandsFrom([...cardsOf('R', 2), ...cardsOf('SSR', 1)]);
    expect(bands.map(b => b.rarity)).toEqual(['R', 'SSR']);
    expect(bands.map(b => b.weight)).toEqual([RARITY.R.weight, RARITY.SSR.weight]);
  });

  it('a sparse live banner still pulls, and only from bands it holds', () => {
    const pool = [...cardsOf('R', 2), ...cardsOf('SSR', 1)];
    const counts = tally(pull(pool, 500, mulberry32(11)));
    expect(counts.N + counts.SR + counts.UR).toBe(0);
    expect(counts.R).toBeGreaterThan(counts.SSR); // 27 : 5 after renormalizing
    expect(counts.R + counts.SSR).toBe(500);
  });

  it('orders bands by RARITY_ORDER regardless of the order cards arrived in', () => {
    const shuffled = [...cardsOf('UR', 1), ...cardsOf('N', 1), ...cardsOf('SR', 1)];
    expect(bandsFrom(shuffled).map(b => b.rarity)).toEqual(['N', 'SR', 'UR']);
  });

  it('an empty pool yields no bands', () => {
    expect(bandsFrom([])).toEqual([]);
  });
});

describe('pullOne — float edge', () => {
  it('an rng returning 1.0 (past Math.random range) still lands on a real card', () => {
    const pool = poolOfEachRarity();
    const bands = bandsFrom(pool);
    /* 1.0 overshoots both stages: the last band, then past its last card. */
    expect(pullOne(bands, () => 1)).toBe(pool[pool.length - 1]);
  });

  it('does not fall off the end of a multi-card band', () => {
    const pool = cardsOf('N', 4);
    expect(pullOne(bandsFrom(pool), () => 1)).toBe(pool[pool.length - 1]);
  });
});
