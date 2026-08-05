/* data/search — the live IO edge for Magic Search. Two calls per keyword:
   search.list (100 quota units) to find videos, then channels.list (1 unit) to
   enrich their uploaders into full Channel objects. It consumes the pure engine
   (buildSearchParams / harvestChannelIds) and hands real channels back for the
   floor + pool to judge. Same key discipline as youtube.js: the key is a plain
   argument, only ever sent to googleapis.com, never logged or stored.

   Not deterministically testable (the live API can't repeat), so the pure engine
   is what the tests pin; this wrapper is exercised by running tools/magic-search.js. */

import { buildSearchParams, harvestChannelIds } from '../engine/discover.js';
import { mapChannelItem, CHANNEL_PARTS } from './youtube.js';

const SEARCH_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search';
const CHANNELS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/channels';

/* One GET, with the same readable-error handling as the live adapter. The key
   rides in the URL but is never surfaced in a thrown message. */
async function getJson(endpoint, params) {
  let res;
  try {
    res = await fetch(`${endpoint}?${new URLSearchParams(params)}`);
  } catch {
    throw new Error('Network error — could not reach the YouTube API.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded') throw new Error('API quota exceeded for this key — resets daily.');
    if (res.status === 400 || res.status === 403) {
      throw new Error('The API rejected the key. Check it is valid and YouTube Data API v3 is enabled.');
    }
    throw new Error(`YouTube API error (HTTP ${res.status}).`);
  }
  return body;
}

/* Run one search and return its uploaders' channel ids, deduped, in result
   (view-count) rank order. */
export async function searchChannelIds(keyword, apiKey, opts = {}) {
  const params = buildSearchParams(keyword, opts);
  const json = await getJson(SEARCH_ENDPOINT, { ...params, key: apiKey });
  return harvestChannelIds(json);
}

/* Pure: align channels.list items to the requested id order (the API may reorder
   or omit), mapping each to the Channel shape and dropping any id it didn't
   return — a deleted/terminated channel, which must never ship as a broken card.
   Extracted from the fetch so the ordering/drop rule is unit-testable. */
export function orderChannelsByIds(items, ids) {
  const byId = new Map((items ?? []).map(item => [item.id, mapChannelItem(item)]));
  return ids.map(id => byId.get(id)).filter(Boolean);
}

/* Enrich up to 50 channel ids to full Channel objects in one channels.list call.
   Returned in the SAME order as `ids`, with dead ids dropped (see above). */
export async function fetchChannelsByIds(ids, apiKey) {
  if (!ids.length) return [];
  const json = await getJson(CHANNELS_ENDPOINT, {
    /* Shared with the single-channel adapter so both hydrate paths return the
       same fields — see CHANNEL_PARTS. Still one quota unit per call. */
    part: CHANNEL_PARTS,
    id: ids.slice(0, 50).join(','),
    maxResults: '50',
    key: apiKey,
  });
  return orderChannelsByIds(json.items, ids);
}

/* Seam-side convenience: a keyword to real, unfiltered Channel objects. The
   caller applies the floor / cap / pool (all pure, in engine/discover). */
export async function discoverChannels(keyword, apiKey, opts = {}) {
  const ids = await searchChannelIds(keyword, apiKey, opts);
  return fetchChannelsByIds(ids, apiKey);
}
