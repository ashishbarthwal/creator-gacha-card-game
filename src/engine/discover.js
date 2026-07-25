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

/* Keyword vocabulary — the re-roll one level up. buildSearchParams randomizes
   the query for a GIVEN keyword; this randomizes the keyword itself, so sourcing
   stops depending on a hand-written query list to reach new ground.

   The vocab is hobby / craft / skill topics on purpose. That is where the
   mid-sized on-topic creators this WP is aiming at actually live, and it steers
   the whole feature clear of news, politics and anything keyed to a real
   person's name — which matters more here than usual, given every result
   becomes a card bearing someone's likeness. */
export const KEYWORD_SEEDS = [
  'cooking', 'baking', 'sourdough', 'fermentation', 'coffee roasting', 'tea ceremony',
  'chess', 'rubiks cube', 'origami', 'calligraphy', 'bookbinding', 'pottery',
  'woodworking', 'blacksmithing', 'welding', 'leatherwork', 'knife making',
  'watch repair', 'restoration', 'model trains', 'lego', 'diorama',
  'guitar', 'piano', 'drums', 'synthesizers', 'field recording', 'music theory',
  'drawing', 'watercolor', 'oil painting', 'pixel art', 'animation', 'sculpting',
  'film photography', 'darkroom', 'astrophotography', 'astronomy', 'geology',
  'birdwatching', 'mycology', 'beekeeping', 'gardening', 'bonsai', 'aquascaping',
  'hiking', 'bouldering', 'kayaking', 'skateboarding', 'unicycle',
  'sewing', 'embroidery', 'knitting', 'soap making', 'candle making',
  '3d printing', 'arduino', 'retro computing', 'speedrun', 'board games',
  'tabletop rpg', 'magic tricks', 'juggling', 'van build',
];

/* The empty modifier is in the list deliberately — a bare topic is a perfectly
   good query, and keeping it in the draw means roughly one search in N stays
   broad instead of every one being narrowed. */
export const KEYWORD_MODIFIERS = [
  '', 'tutorial', 'for beginners', 'asmr', 'timelapse', 'challenge', 'review',
  'behind the scenes', 'workshop tour', 'first attempt', 'explained', 'tips',
  'gone wrong', 'diy', 'process', 'day in the life', 'setup tour', 'masterclass',
];

/* One keyword: seed x modifier. Pure and rng-injected like buildSearchParams,
   so a seeded run reproduces the exact query list. */
export function buildKeyword(opts = {}) {
  const { rng = Math.random, seeds = KEYWORD_SEEDS, modifiers = KEYWORD_MODIFIERS } = opts;
  const seed = pick(seeds, rng());
  const modifier = pick(modifiers, rng());
  return modifier ? `${seed} ${modifier}` : seed;
}

/* n distinct keywords. Deduped because the vocab collides over a long run and a
   repeated query spends 100 quota units re-harvesting channels the previous one
   already found. The guard bounds the draw so a deliberately tiny custom vocab
   returns short rather than spinning. */
export function buildKeywords(n, opts = {}) {
  const seen = new Set();
  for (let i = 0; seen.size < n && i < n * 40; i++) seen.add(buildKeyword(opts));
  return [...seen];
}

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

/* Exclude channels too small or too inactive to earn a card — and, when asked,
   the giants at the other end. A hidden subscriber count cannot clear a subs
   floor we cannot see, so it fails — consistent with the core reading hidden
   counts as the bottom band.

   `maxSubs` is the WP6 exclude-giants knob and defaults to Infinity, i.e. OFF.
   That default is deliberate: a generic keyword is dominated by a handful of
   enormous channels, so a ceiling is what surfaces the mid/small on-topic
   creators the sourcing actually wants — but the same ceiling would empty the
   `legends` pool, which is sized on 5M+. So the ceiling is a per-query lever the
   caller opts into, never a global rule. The parameter is still named `floor`
   for its callers' sake though it now describes a band. */
export const DEFAULT_FLOOR = { minSubs: 1_000, maxSubs: Infinity, minVideos: 5 };

export function passesFloor(channel, floor = DEFAULT_FLOOR) {
  if (channel?.hiddenSubscriberCount) return false;
  const { minSubs = 0, maxSubs = Infinity, minVideos = 0 } = floor;
  const subs = toCount(channel?.subscriberCount);
  return subs >= minSubs && subs <= maxSubs && toCount(channel?.videoCount) >= minVideos;
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

/* The three sourcing tiers — one per pool assignPool sorts into. Each carries
   BOTH a search bias and a band filter, and carrying both is the point: filtering
   alone would run the identical query three ways and mostly return nothing,
   because a keyword's most-viewed videos are made by big channels whichever band
   you happen to be after. So the query is steered first, then the band trims.

     legends    all-time most-viewed, no window — where the giants surface
     majority   the full jitter — the broad middle
     wildcards  recent uploads only — where small but still-ACTIVE creators are.
                The 8-year default lookback would surface long-dead channels here,
                the one place staleness actually costs a card.

   The bands are derived from DEFAULT_POOL_BANDS, never re-typed, so a tier cannot
   drift out of agreement with assignPool — the function that sorts these same
   results into these same pools. The KEYS are the pool names for the same reason,
   which is why the bottom tier is `wildcards` here and reads "Small" on its button:
   a key that has to match assignPool's output can be checked, a synonym cannot.
   Pure config, so it lives here rather than in the UI that renders a button per
   entry. */
export const SEARCH_TIERS = {
  legends: {
    label: 'Legends',
    opts: { windowDays: null, orders: ['viewCount'] },
    floor: { ...DEFAULT_FLOOR, minSubs: DEFAULT_POOL_BANDS.legendsMin },
  },
  majority: {
    label: 'Majority',
    opts: {},
    floor: {
      ...DEFAULT_FLOOR,
      minSubs: DEFAULT_POOL_BANDS.majorityMin,
      maxSubs: DEFAULT_POOL_BANDS.legendsMin - 1,
    },
  },
  wildcards: {
    label: 'Small',
    opts: { orders: ['date'], windowDays: 30, lookbackDays: 2 * 365 },
    floor: { ...DEFAULT_FLOOR, maxSubs: DEFAULT_POOL_BANDS.majorityMin - 1 },
  },
};

/* Local-risk hedge: drop channels that self-declare a country in the exclude
   list. India is excluded by default — an India-based operator is most easily
   reached by an India-domiciled creator, so removing them trims the highest-
   enforceability claim vector (see DECISIONS.md). Leaky by design: snippet.country
   is self-declared and frequently absent, and an unknown country can't be
   excluded, so this is a supplement to the real protections (no monetization,
   opt-out), never a substitute. Pass exclude: [] to disable. */
export const DEFAULT_EXCLUDE_COUNTRIES = ['IN'];

export function passesRegion(channel, exclude = DEFAULT_EXCLUDE_COUNTRIES) {
  const country = String(channel?.country ?? '').toUpperCase();
  if (!country) return true; // an unknown country can't be excluded
  return !exclude.some(c => String(c).toUpperCase() === country);
}

/* Pick the channels one query contributes: keep those that clear the floor and
   aren't in an excluded region, then cap the count. Pure — the ranking is
   whatever order the caller passes, so when the caller hands channels in the
   search's viewCount rank, the cap keeps the top-ranked qualifiers. Short-
   circuits once `cap` are found. */
export function selectChannels(channels, { floor = DEFAULT_FLOOR, cap = 5, exclude = DEFAULT_EXCLUDE_COUNTRIES } = {}) {
  const kept = [];
  for (const channel of channels) {
    if (kept.length >= cap) break;
    if (passesFloor(channel, floor) && passesRegion(channel, exclude)) kept.push(channel);
  }
  return kept;
}
