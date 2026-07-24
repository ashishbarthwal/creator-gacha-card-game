/* test/core — pins the pure derivation core.
   The off-by-one at each rarity boundary is the entire point of this file:
   these bands are the game's economy, and a silent shift by one subscriber
   would change what every card is worth. */

import { describe, it, expect } from 'vitest';
import { RARITY, RARITY_ORDER, toCount, rarityFromSubs, statsFrom, toCard } from '../src/engine/core.js';

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
    [325_000_000,  'UR'],   // well past the top band — no ceiling
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

/* Minimal Channel factory — only the fields statsFrom reads. */
function channel(overrides = {}) {
  return {
    subscriberCount: '0',
    hiddenSubscriberCount: false,
    viewCount: '0',
    videoCount: '0',
    ...overrides,
  };
}

describe('statsFrom — scaling', () => {
  it('ATK rises monotonically with view count', () => {
    const views = ['0', '1000', '1000000', '1000000000', '32000000000'];
    const atks = views.map(viewCount => statsFrom(channel({ viewCount })).atk);
    for (let i = 1; i < atks.length; i++) expect(atks[i]).toBeGreaterThan(atks[i - 1]);
  });

  it('DEF rises monotonically with video count', () => {
    const videos = ['0', '10', '200', '3000', '50000'];
    const defs = videos.map(videoCount => statsFrom(channel({ videoCount })).def);
    for (let i = 1; i < defs.length; i++) expect(defs[i]).toBeGreaterThan(defs[i - 1]);
  });

  it('rarity multiplier is applied — same raw counts, higher band, higher stats', () => {
    const counts = { viewCount: '5000000', videoCount: '300' };
    const stats = RARITY_ORDER.map((_, i) =>
      statsFrom(channel({ ...counts, subscriberCount: ['0', '100000', '1000000', '10000000', '50000000'][i] })));
    for (let i = 1; i < stats.length; i++) {
      expect(stats[i].atk).toBeGreaterThan(stats[i - 1].atk);
      expect(stats[i].def).toBeGreaterThan(stats[i - 1].def);
    }
  });

  it('values are integers and never negative, even on a fully empty channel', () => {
    for (const ch of [channel(), {}, channel({ viewCount: 'junk', videoCount: null })]) {
      const { atk, def } = statsFrom(ch);
      expect(Number.isInteger(atk)).toBe(true);
      expect(Number.isInteger(def)).toBe(true);
      expect(atk).toBeGreaterThanOrEqual(0);
      expect(def).toBeGreaterThanOrEqual(0);
    }
  });

  it('hidden-subs channel still derives full stats at N multiplier', () => {
    const stats = statsFrom(channel({ hiddenSubscriberCount: true, viewCount: '5400000', videoCount: '97' }));
    expect(stats.rarity).toBe('N');
    expect(stats.atk).toBeGreaterThan(0);
    expect(stats.def).toBeGreaterThan(0);
  });
});

describe('toCard — the model bridge', () => {
  it('carries the channel and its derived stats together', () => {
    const ch = channel({ subscriberCount: '2700000', viewCount: '512000000', videoCount: '388' });
    const card = toCard(ch);
    expect(card.channel).toBe(ch);
    expect(card.rarity).toBe('SR');
    expect(card).toMatchObject(statsFrom(ch));
  });
});

describe('RARITY table — internal consistency', () => {
  it('every rarity in the order has a weight and a multiplier', () => {
    for (const r of RARITY_ORDER) {
      expect(RARITY[r].weight).toBeGreaterThan(0);
      expect(RARITY[r].mult).toBeGreaterThan(0);
    }
  });

  it('weights fall and multipliers rise as rarity climbs', () => {
    for (let i = 1; i < RARITY_ORDER.length; i++) {
      expect(RARITY[RARITY_ORDER[i]].weight).toBeLessThan(RARITY[RARITY_ORDER[i - 1]].weight);
      expect(RARITY[RARITY_ORDER[i]].mult).toBeGreaterThan(RARITY[RARITY_ORDER[i - 1]].mult);
    }
  });
});
