/* test/core — pins the pure derivation core.
   The off-by-one at each rarity boundary is the entire point of this file:
   these bands are the game's economy, and a silent shift by one subscriber
   would change what every card is worth. */

import { describe, it, expect } from 'vitest';
import { RARITY, RARITY_ORDER, toCount, rarityFromSubs, toCard } from '../src/engine/core.js';

describe('rarityFromSubs — exact boundaries', () => {
  /* Table-driven, both sides of every band edge. The API reports counts as
     decimal strings, so every case is asserted as a string AND a number. */
  const table = [
    [0,            'N'],
    [99_999,       'N'],
    [100_000,      'R'],
    [999_999,      'R'],
    [1_000_000,    'SR'],
    [9_999_999,    'SR'],
    [10_000_000,   'SSR'],
    [49_999_999,   'SSR'],
    [50_000_000,   'UR'],
    [99_999_999,   'UR'],
    [100_000_000,  'RUBY'],
    [511_000_000,  'RUBY'],   // well past the top band — no ceiling
  ];

  it.each(table)('%i subs -> %s (as number)', (subs, want) => {
    expect(rarityFromSubs(subs)).toBe(want);
  });

  it.each(table)('"%i" subs -> %s (as string, like the API sends)', (subs, want) => {
    expect(rarityFromSubs(String(subs))).toBe(want);
  });
});

describe('rarityFromSubs — hidden subscriber counts', () => {
  /* DECISIONS.md: hidden counts read as N, never throw. The API omits
     subscriberCount entirely and sets hiddenSubscriberCount: true. */
  it('hidden flag forces N even when a count is present', () => {
    expect(rarityFromSubs('60000000', true)).toBe('N');
  });

  it('hidden flag with the count absent (the real API shape) is N', () => {
    expect(rarityFromSubs(undefined, true)).toBe('N');
  });
});

describe('rarityFromSubs — malformed input never throws, never NaNs', () => {
  const junk = [undefined, null, '', '  ', 'abc', '12abc', NaN, -1, '-500', {}, [], true];

  it.each(junk.map(v => [v]))('%o -> a defined rarity', value => {
    const rarity = rarityFromSubs(value);
    expect(RARITY_ORDER).toContain(rarity);
  });

  it('all junk lands in N, the lowest band', () => {
    for (const value of junk) expect(rarityFromSubs(value)).toBe('N');
  });
});

describe('toCount — the API sends strings, chaos sends everything else', () => {
  it('parses decimal strings', () => {
    expect(toCount('384000')).toBe(384_000);
  });

  it('floors fractional values', () => {
    expect(toCount('12.9')).toBe(12);
  });

  it('clamps negatives to zero', () => {
    expect(toCount(-42)).toBe(0);
    expect(toCount('-42')).toBe(0);
  });

  it('maps non-numeric junk to zero', () => {
    for (const value of [undefined, null, '', 'abc', NaN, Infinity, {}, []]) {
      expect(toCount(value)).toBe(0);
    }
  });
});

/* Minimal Channel factory — only the fields the derivation reads. */
function channel(overrides = {}) {
  return {
    subscriberCount: '0',
    hiddenSubscriberCount: false,
    viewCount: '0',
    videoCount: '0',
    ...overrides,
  };
}

/* ── A CARD CARRIES NO NUMBERS (2026-08-09) ────────────────────────────────
   These tests replace a `statsFrom — scaling` block that asserted the exact
   behaviour the redesign removed: "same raw counts, higher band, higher stats".
   That test was correct about the code and wrong about the game — it pinned a
   rarity multiplier that made the printed ATK correlate with subscriber count
   at 0.897 while the battle engine ran at 0.187. Both cannot be the strength of
   a card, so the derived numbers now come from one place (battle-stats.js) and
   `toCard` returns only the band. See engine/core.js for the measurements.

   What is asserted here now is the CONTRACT that replaced it: a card is its
   channel and its band, nothing is derived twice, and rarity is a drop rate. */
describe('toCard — the model bridge', () => {
  it('carries the channel and its band, and no derived numbers at all', () => {
    const ch = channel({ subscriberCount: '2700000', viewCount: '512000000', videoCount: '388' });
    const card = toCard(ch);
    expect(card.channel).toBe(ch);
    expect(card.rarity).toBe('SR');
    /* The point of the change: no second answer to "how strong is this card"
       can be stored on the card, so none can drift from the engine. */
    expect(Object.keys(card).sort()).toEqual(['channel', 'rarity']);
  });

  it('agrees with rarityFromSubs across every band, including hidden subs', () => {
    for (const subscriberCount of ['0', '100000', '1000000', '10000000', '50000000', '100000000']) {
      expect(toCard(channel({ subscriberCount })).rarity).toBe(rarityFromSubs(subscriberCount));
    }
    expect(toCard(channel({ subscriberCount: '9000000', hiddenSubscriberCount: true })).rarity).toBe('N');
  });

  it('never throws on a malformed channel', () => {
    for (const ch of [channel(), {}, channel({ viewCount: 'junk', videoCount: null })]) {
      expect(RARITY_ORDER).toContain(toCard(ch).rarity);
    }
  });
});

describe('RARITY table — internal consistency', () => {
  it('every rarity in the order has a weight', () => {
    for (const r of RARITY_ORDER) {
      expect(RARITY[r].weight).toBeGreaterThan(0);
    }
  });

  /* `mult` is deliberately gone. It was the multiplier that made a RUBY card
     print 3x an N's stats, and battle-stats.js already held the opposite
     position — that rarity buys a compressed budget and is otherwise only "how
     hard this was to pull". A stray multiplier reappearing here would quietly
     reintroduce the contradiction, so its absence is pinned. */
  it('carries no power multiplier — rarity is a drop rate, not a stat bonus', () => {
    for (const r of RARITY_ORDER) {
      expect(RARITY[r].mult).toBeUndefined();
      expect(Object.keys(RARITY[r])).toEqual(['weight']);
    }
  });

  it('weights fall as rarity climbs', () => {
    for (let i = 1; i < RARITY_ORDER.length; i++) {
      expect(RARITY[RARITY_ORDER[i]].weight).toBeLessThan(RARITY[RARITY_ORDER[i - 1]].weight);
    }
  });
});
