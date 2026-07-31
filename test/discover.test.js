/* test/discover — pins Magic Search's pure engine on SYNTHETIC fixtures.
   Everything here runs with no key and no network: buildSearchParams takes an
   injected rng + clock (so a seed makes the "random" re-roll exact), and the
   harvest/filter/tag functions run against hand-authored JSON in the real
   search.list and Channel shapes. Never commit real search output — these
   fixtures are the response schema, not real creators. */

import { describe, it, expect } from 'vitest';
import {
  buildSearchParams,
  buildKeyword,
  buildKeywords,
  harvestChannelIds,
  passesFloor,
  passesRegion,
  regionReport,
  mergeRegionReports,
  assignPool,
  selectChannels,
  SEARCH_BASE,
  SEARCH_TIERS,
  DEFAULT_FLOOR,
  KEYWORD_SEEDS,
  KEYWORD_MODIFIERS,
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

  /* WP6's exclude-giants knob. Off by default on purpose: a global ceiling
     would empty the `legends` pool, which is sized on 5M+ subs. */
  it('has no ceiling by default — a giant passes', () => {
    expect(passesFloor(channel({ subscriberCount: '250000000' }))).toBe(true);
  });

  it('fails a channel above an explicit maxSubs', () => {
    expect(passesFloor(channel({ subscriberCount: '9000000' }), { ...DEFAULT_FLOOR, maxSubs: 2_000_000 }))
      .toBe(false);
  });

  it('passes exactly on the ceiling', () => {
    expect(passesFloor(channel({ subscriberCount: '2000000' }), { ...DEFAULT_FLOOR, maxSubs: 2_000_000 }))
      .toBe(true);
  });

  it('a partial floor still gets the other bounds defaulted', () => {
    // only a ceiling given — minSubs/minVideos must not become undefined and
    // silently fail every comparison
    expect(passesFloor(channel({ subscriberCount: '5000', videoCount: '1' }), { maxSubs: 1_000_000 }))
      .toBe(true);
  });

  /* Found by playing, 2026-07-31: a channel with thousands of videos and no
     view count rendered a card with ATK 0. statsFrom is log10-scaled, so one
     view scores 36 — an ATK of exactly 0 means there was nothing to derive
     from, and a zero stat reads as a bug whether or not the number is real. */
  it('fails a channel with no views — it would render ATK 0', () => {
    expect(passesFloor(channel({ viewCount: '0', videoCount: '8100' }))).toBe(false);
  });

  it('fails a channel whose view count is absent entirely', () => {
    expect(passesFloor(channel({ viewCount: undefined }))).toBe(false);
  });

  it('passes exactly on the views floor', () => {
    expect(passesFloor(channel({ viewCount: '1000' }))).toBe(true);
    expect(passesFloor(channel({ viewCount: '999' }))).toBe(false);
  });
});

/* The exclude is one of the five mitigations the legality gate closed on, and
   it reads a self-declared field that is usually absent — so its real effect is
   bounded by coverage, not by the exclude list. These pin the measurement, so
   the launch decision can rest on what the filter does. */
describe('regionReport — measure the leak instead of assuming it', () => {
  const at = (country, over = {}) => channel({ country, ...over });

  it('separates declared from undeclared, and reports the ceiling as coverage', () => {
    const report = regionReport([at('IN'), at('US'), at(''), at('')]);
    expect(report).toMatchObject({ total: 4, declared: 2, undeclared: 2, excluded: 1 });
    expect(report.coverage).toBe(0.5);
  });

  it('coverage is the hard ceiling on how much the filter can ever remove', () => {
    /* The finding that prompted this: if almost nobody declares, the exclude
       cannot be doing much however aggressive the list is. */
    const channels = [at('IN'), ...Array.from({ length: 19 }, () => at(''))];
    const report = regionReport(channels);
    expect(report.coverage).toBeCloseTo(0.05);
    expect(report.excluded / report.total).toBeLessThanOrEqual(report.coverage);
  });

  it('counts the declared distribution, to show what the leakers declare instead', () => {
    const report = regionReport([at('US'), at('US'), at('GB'), at('IN')]);
    expect(report.byCountry).toEqual({ US: 2, GB: 1, IN: 1 });
  });

  it('normalizes case, matching passesRegion', () => {
    const report = regionReport([at('in'), at('In')]);
    expect(report.excluded).toBe(2);
    expect(report.byCountry).toEqual({ IN: 2 });
  });

  it('honors a custom exclude list', () => {
    expect(regionReport([at('US'), at('IN')], ['US']).excluded).toBe(1);
    expect(regionReport([at('US'), at('IN')], []).excluded).toBe(0);
  });

  it('is all zeroes for empty or missing input rather than dividing by zero', () => {
    for (const empty of [[], undefined, null]) {
      expect(regionReport(empty)).toMatchObject({ total: 0, excluded: 0, coverage: 0 });
    }
  });

  it('skips holes in the array without counting them', () => {
    expect(regionReport([at('IN'), null, undefined]).total).toBe(1);
  });
});

describe('mergeRegionReports — one honest total across a multi-query run', () => {
  it('sums the counts and recomputes coverage over the combined total', () => {
    const merged = mergeRegionReports([
      regionReport([at2('IN'), at2('')]),
      regionReport([at2('US'), at2(''), at2('')]),
    ]);
    expect(merged).toMatchObject({ total: 5, declared: 2, undeclared: 3, excluded: 1 });
    expect(merged.coverage).toBeCloseTo(0.4);
    expect(merged.byCountry).toEqual({ IN: 1, US: 1 });
  });

  it('is empty rather than NaN for no reports', () => {
    expect(mergeRegionReports([])).toMatchObject({ total: 0, coverage: 0 });
    expect(mergeRegionReports(undefined).coverage).toBe(0);
  });

  function at2(country) { return channel({ country }); }
});

describe('buildKeyword — seed x modifier vocab', () => {
  const gen = seed => buildKeyword({ rng: mulberry32(seed) });

  it('builds a keyword from the vocab', () => {
    const kw = gen(4);
    const seed = KEYWORD_SEEDS.find(s => kw === s || kw.startsWith(s + ' '));
    expect(seed, `"${kw}" should start with a known seed`).toBeTruthy();
    expect(KEYWORD_MODIFIERS).toContain(kw.slice(seed.length).trim());
  });

  it('is reproducible under the same seed', () => {
    expect(gen(7)).toBe(gen(7));
  });

  it('never leaves a trailing space when the empty modifier is drawn', () => {
    const kw = buildKeyword({ rng: mulberry32(1), modifiers: [''] });
    expect(kw).toBe(kw.trim());
    expect(KEYWORD_SEEDS).toContain(kw);
  });

  it('respects a custom vocab', () => {
    expect(buildKeyword({ rng: mulberry32(2), seeds: ['chess'], modifiers: ['asmr'] }))
      .toBe('chess asmr');
  });
});

describe('buildKeywords — a distinct batch', () => {
  it('returns n distinct keywords', () => {
    const list = buildKeywords(12, { rng: mulberry32(5) });
    expect(list).toHaveLength(12);
    expect(new Set(list).size).toBe(12);
  });

  it('is reproducible under the same seed, and a re-roll differs', () => {
    expect(buildKeywords(6, { rng: mulberry32(5) })).toEqual(buildKeywords(6, { rng: mulberry32(5) }));
    expect(buildKeywords(6, { rng: mulberry32(5) })).not.toEqual(buildKeywords(6, { rng: mulberry32(6) }));
  });

  /* The vocab can't satisfy the ask — must return short rather than spin
     forever looking for a distinct combination that doesn't exist. */
  it('returns short instead of hanging when the vocab is too small', () => {
    const list = buildKeywords(50, { rng: mulberry32(1), seeds: ['chess'], modifiers: ['', 'asmr'] });
    expect(list.sort()).toEqual(['chess', 'chess asmr']);
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

  it('drops giants when the caller sets a ceiling — the WP6 acceptance case', () => {
    const pool = [
      channel({ id: 'UC_giant', subscriberCount: '120000000', videoCount: '900' }),
      channel({ id: 'UC_mid', subscriberCount: '240000', videoCount: '180' }),
      channel({ id: 'UC_small', subscriberCount: '12000', videoCount: '60' }),
    ];
    const kept = selectChannels(pool, { floor: { ...DEFAULT_FLOOR, maxSubs: 2_000_000 }, cap: 5 });
    expect(kept.map(c => c.id)).toEqual(['UC_mid', 'UC_small']);
  });

  it('excludes an IN channel even when it clears the floor', () => {
    const pool = [
      channel({ id: 'UC_us', country: 'US', subscriberCount: '5000', videoCount: '40' }),
      channel({ id: 'UC_in', country: 'IN', subscriberCount: '5000', videoCount: '40' }),
    ];
    expect(selectChannels(pool, { cap: 5 }).map(c => c.id)).toEqual(['UC_us']);
  });
});

/* The tiers derive their bands from DEFAULT_POOL_BANDS rather than re-typing
   the numbers. These pin that it actually holds — the bands are the reason the
   three buttons mean anything, and an off-by-one would silently drop or
   double-count a whole band of creators. */
describe('SEARCH_TIERS — one tier per sourcing pool', () => {
  const at = subs => channel({ subscriberCount: String(subs), videoCount: '40' });
  // both sides of each boundary, plus the extremes
  const SAMPLES = [1_000, 50_000, 99_999, 100_000, 100_001, 4_999_999, 5_000_000, 120_000_000];

  it('admits a channel only into the pool assignPool already sorts it into', () => {
    for (const [tierKey, tier] of Object.entries(SEARCH_TIERS)) {
      for (const subs of SAMPLES) {
        if (!passesFloor(at(subs), tier.floor)) continue;
        expect(assignPool(at(subs)), `${subs} subs passed the ${tierKey} floor`).toBe(tierKey);
      }
    }
  });

  it('exactly one tier accepts any channel above the card floor — no gap, no overlap', () => {
    for (const subs of SAMPLES) {
      const hits = Object.keys(SEARCH_TIERS).filter(k => passesFloor(at(subs), SEARCH_TIERS[k].floor));
      expect(hits, `${subs} subs`).toHaveLength(1);
    }
  });

  it('steers the search per tier, not just the filter', () => {
    // legends wants all-time most-viewed; small wants recent uploads
    expect(SEARCH_TIERS.legends.opts).toMatchObject({ windowDays: null, orders: ['viewCount'] });
    expect(SEARCH_TIERS.wildcards.opts.orders).toEqual(['date']);
    expect(SEARCH_TIERS.wildcards.opts.lookbackDays).toBeLessThan(8 * 365); // not the stale default
    expect(SEARCH_TIERS.majority.opts).toEqual({}); // the full jitter
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
