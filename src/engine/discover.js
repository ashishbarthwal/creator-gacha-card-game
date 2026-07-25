/* engine/discover — PURE. Magic Search's headless half: turn a keyword into a
   randomized query, harvest every uploader out of a search response, and
   filter/tag the channels for the sourcing pools. No fetch, no key, no DOM —
   it would run unchanged in Node, which is why it lives in engine/ and is the
   test target.

   Nondeterminism is injected, never reached for: rng (like gacha.js) AND now.
   A seed plus a fixed clock make buildSearchParams fully reproducible, so the
   randomized re-roll — the whole idea of the feature — is a real, pinned
   assertion instead of a live coin-flip against an API that can't repeat.

   The live search.list call that consumes these params is the thin IO wrapper
   (data/search.js) — deliberately NOT here. Same parse/load split sets.js
   draws: the pure part is validated and tested, the one fetch line is the edge. */

import { toCount } from './core.js';

const DAY_MS = 86_400_000;

/* Static query parts — the knobs that do not vary per re-roll. type=video and
   harvesting the uploaders (rather than searching channels directly) surfaces
   the long tail: a small creator with one viral video shows up next to the big
   names. safeSearch=strict is the concrete safety lever. */
export const SEARCH_BASE = {
  part: 'snippet',
  type: 'video',
  safeSearch: 'strict',
  maxResults: 50,
};

/* The randomized levers. order=viewCount is the workhorse (the most-viewed
   videos for the term, whoever made them); date pulls a recent slice instead.
   The published-window is the main re-roll lever — the same keyword over a
   different span of time returns a different set of uploaders. */
export const SEARCH_JITTER = {
  orders: ['viewCount', 'date'],
  windowDays: 90,
  lookbackDays: 8 * 365,
  regions: null, // e.g. ['US','GB','JP'] to also jitter regionCode; null = omit it
};

const pick = (arr, r) => arr[Math.min(Math.floor(r * arr.length), arr.length - 1)];
const rfc3339 = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/* Build a search.list query for a keyword. Two modes from one function:
   - Randomized (default): a fixed-length window slid to a random start inside
     the lookback, plus order jitter — the re-roll. Consumes rng.
   - Deterministic: pass windowDays:null to omit the published window (search
     all time) and a single-entry `orders` to fix the order. Then rng is never
     touched, so the same keyword yields the same query — the mode the first
     draft uses ("randomization comes later"). */
export function buildSearchParams(keyword, opts = {}) {
  const {
    rng = Math.random,
    now = Date.now(),
    orders = SEARCH_JITTER.orders,
    windowDays = SEARCH_JITTER.windowDays,
    lookbackDays = SEARCH_JITTER.lookbackDays,
    regions = SEARCH_JITTER.regions,
  } = opts;

  const params = {
    ...SEARCH_BASE,
    q: String(keyword ?? '').trim(),
    order: orders.length > 1 ? pick(orders, rng()) : orders[0],
  };

  if (windowDays != null) {
    const earliestStart = now - lookbackDays * DAY_MS;
    const latestStart = now - windowDays * DAY_MS;
    const start = earliestStart + rng() * Math.max(0, latestStart - earliestStart);
    params.publishedAfter = rfc3339(start);
    params.publishedBefore = rfc3339(start + windowDays * DAY_MS);
  }
  if (regions && regions.length) params.regionCode = pick(regions, rng());
  return params;
}

/* Take every uploader in a search.list response, deduped, first-seen order
   preserved. ALL ~50 items, not a sample: one search already cost 100 quota
   units, so discarding 49 results to keep 1 is exactly the waste the three-tier
   sourcing fixes. Missing/malformed items are skipped, never thrown on. */
export function harvestChannelIds(searchJson) {
  const seen = new Set();
  const ids = [];
  for (const item of searchJson?.items ?? []) {
    const id = item?.snippet?.channelId;
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/* Exclude channels too small or too inactive to earn a card. A hidden
   subscriber count cannot clear a subs floor we cannot see, so it fails —
   consistent with the core reading hidden counts as the bottom band. */
export const DEFAULT_FLOOR = { minSubs: 1_000, minVideos: 5 };

export function passesFloor(channel, floor = DEFAULT_FLOOR) {
  if (channel?.hiddenSubscriberCount) return false;
  return toCount(channel?.subscriberCount) >= floor.minSubs
      && toCount(channel?.videoCount) >= floor.minVideos;
}

/* Sort a channel into one of the three sourcing pools by subscriber band.
   Thresholds are provisional; a curated allowlist can still promote a channel
   to legends later. Keyed on subs alone, so it is deterministic and needs no
   extra I/O. An unknown/hidden count falls to wildcards (toCount -> 0). */
export const DEFAULT_POOL_BANDS = { legendsMin: 5_000_000, majorityMin: 100_000 };

export function assignPool(channel, bands = DEFAULT_POOL_BANDS) {
  const subs = toCount(channel?.subscriberCount);
  if (subs >= bands.legendsMin) return 'legends';
  if (subs >= bands.majorityMin) return 'majority';
  return 'wildcards';
}

/* Pick the channels one query contributes: keep only those that clear the
   floor, then cap the count. Pure — the ranking is whatever order the caller
   passes, so when the caller hands channels in the search's viewCount rank, the
   cap keeps the top-ranked qualifiers. Short-circuits once `cap` are found. */
export function selectChannels(channels, { floor = DEFAULT_FLOOR, cap = 5 } = {}) {
  const kept = [];
  for (const channel of channels) {
    if (kept.length >= cap) break;
    if (passesFloor(channel, floor)) kept.push(channel);
  }
  return kept;
}
