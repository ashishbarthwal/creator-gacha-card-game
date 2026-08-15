/* opponent — the AI's own collection.

   Quick battle used to build its opponent by aiming a team at the player's
   exact rating out of the entire set, which made every fight even by
   construction and meant a player's collection never mattered. The AI now
   rolls a collection the same size as the player's on the same published band
   odds and builds its best five from that, so the fight turns on luck and team
   building the way a live 1v1 does.

   The load-bearing test here is the thin-pool one. The first implementation
   drew against the whole pool and discarded duplicates under a fixed try-cap,
   which cannot exhaust a rare band — RUBY is 0.1% of the weight, so on a pool
   holding two of them the odds of never rolling a specific one were better than
   even, and the AI quietly ended up with FEWER cards than the player. That is
   the exact unfairness this whole change exists to remove, reintroduced by the
   sampler. */

import { describe, it, expect } from 'vitest';
import { rollAiCollection, collectionOpponent } from '../src/engine/opponent.js';
import { RARITY, RARITY_ORDER, rarityFromSubs, toCard } from '../src/engine/core.js';
import { TEAM_SIZE } from '../src/engine/battle.js';

const SUBS = { N: 50_000, R: 500_000, SR: 5_000_000, SSR: 20_000_000, UR: 70_000_000, RUBY: 150_000_000 };

function pool(perBand = 60) {
  const out = [];
  for (const band of RARITY_ORDER) {
    for (let i = 0; i < perBand; i++) {
      out.push(toCard({
        id: `${band}-${i}`, title: `${band} ${i}`, handle: `@${band}${i}`,
        subscriberCount: String(SUBS[band]),
        viewCount: String(1_000_000 + i * 7919), videoCount: String(100 + i),
        publishedAt: '2018-01-01T00:00:00Z',
      }));
    }
  }
  return out;
}

// deterministic rng
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('the AI rolls its own collection', () => {
  it('gets exactly as many DISTINCT cards as asked for', () => {
    const p = pool();
    for (const size of [5, 12, 40, 137]) {
      const got = rollAiCollection(p, size, { rng: mulberry32(size) });
      expect(got).toHaveLength(size);
      expect(new Set(got.map(c => c.id)).size).toBe(size);
    }
  });

  it('never exceeds the distinct cards the pool actually holds', () => {
    const thin = pool(2);                       // 12 distinct total
    const got = rollAiCollection(thin, 500, { rng: mulberry32(7) });
    expect(got).toHaveLength(12);
    expect(new Set(got.map(c => c.id)).size).toBe(12);
  });

  it('terminates on a pool with a single band', () => {
    const oneBand = pool().filter(c => c.rarity === 'N');
    const got = rollAiCollection(oneBand, 10, { rng: mulberry32(3) });
    expect(got).toHaveLength(10);
  });

  /* Asserts the property that actually distinguishes this from a lazy
     implementation — the draw is BAND-WEIGHTED, not uniform over the pool.
     Six equal-sized bands mean a uniform draw would give each ~16.7%; the
     published curve gives N 55%. An earlier version of this test also required
     every band to appear, which is flaky by construction: RUBY is 0.1% of the
     weight, so at 4,000 draws it is missing outright about 1 run in 55. */
  it('draws on the published band odds, not uniformly over the pool', () => {
    const p = pool(200);
    const counts = {};
    const N = 4000;
    const rng = mulberry32(99);
    for (let i = 0; i < N; i++) {
      const [card] = rollAiCollection(p, 1, { rng });
      const band = rarityFromSubs(card.subscriberCount, false);
      counts[band] = (counts[band] ?? 0) + 1;
    }
    const weights = RARITY_ORDER.reduce((s, b) => s + RARITY[b].weight, 0);
    const uniform = 1 / RARITY_ORDER.length;

    expect(counts.N / N).toBeGreaterThan(uniform * 2);          // nowhere near uniform
    expect(Math.abs(counts.N / N - RARITY.N.weight / weights)).toBeLessThan(0.05);
    expect(counts.N).toBeGreaterThan(counts.R);
    expect(counts.R).toBeGreaterThan(counts.SR);
    expect(counts.SR).toBeGreaterThan(counts.SSR);
    expect((counts.UR ?? 0) + (counts.RUBY ?? 0)).toBeLessThan(N * 0.05);
  });

  it('fields a legal five, and the collection it came from', () => {
    const p = pool();
    const { channels, collection } = collectionOpponent(p, 25, { now: Date.parse('2026-08-15'), rng: mulberry32(11) });
    expect(collection).toHaveLength(25);
    expect(channels).toHaveLength(TEAM_SIZE);
    expect(new Set(channels.map(c => c.id)).size).toBe(TEAM_SIZE);
    for (const c of channels) expect(collection.map(x => x.id)).toContain(c.id);
  });

  it('a bigger collection produces a stronger five on average — collecting still pays', () => {
    const p = pool(200);
    const now = Date.parse('2026-08-15');
    const rate = size => {
      let ruby = 0;
      for (let s = 0; s < 60; s++) {
        const { channels } = collectionOpponent(p, size, { now, rng: mulberry32(s * 31 + size) });
        ruby += channels.filter(c => rarityFromSubs(c.subscriberCount, false) !== 'N').length;
      }
      return ruby / 60;
    };
    expect(rate(60)).toBeGreaterThan(rate(6));
  });

  it('degrades safely on junk input rather than throwing', () => {
    expect(rollAiCollection([], 10)).toEqual([]);
    expect(rollAiCollection(null, 10)).toEqual([]);
    expect(rollAiCollection(pool(), 0)).toEqual([]);
    expect(rollAiCollection(pool(), -5)).toEqual([]);
  });
});
