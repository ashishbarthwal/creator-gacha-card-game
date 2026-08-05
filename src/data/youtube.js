/* data/youtube — live adapter for YouTube Data API v3.
   Returns the same Channel shape as the other sources (see ./index.js). The key is a
   plain argument: never logged, never persisted, only ever sent to
   googleapis.com. */

const YT_ENDPOINT = 'https://www.googleapis.com/youtube/v3/channels';

/* THE PARTS A HYDRATE ASKS FOR, NAMED ONCE.

   channels.list costs 1 quota unit PER CALL, not per part — so a part is free
   once the call is being made anyway, and the only cost of asking for one more
   is the bytes on the wire. That is why `topicDetails` is here: it carries the
   Wikipedia topic claims engine/element.js turns into a battle element, and it
   is the only new SIGNAL available to this project at zero quota. Everything
   else derivable from `statistics` is arithmetic on four numbers we already
   have.

   Exported and shared with data/search.js because the two hydrate paths must
   ask for the same thing — a channel discovered by Magic Search and one added
   by hand should not end up with different fields. That divergence is how
   `publishedAt` went missing from half the pipeline once already.

   Deliberately NOT requested: `brandingSettings` (keywords) and the channel
   description. They are free too, and they are prose the creator wrote —
   deriving an element from them is the name-matching that looksInstitutional()
   is kept narrow to avoid. */
export const CHANNEL_PARTS = 'snippet,statistics,topicDetails';

/* customUrl is the API's handle field, but it is not guaranteed to be
   handle-shaped: older channels return a bare, lowercased vanity string
   ("mkbhd") while the modern format is "@mkbhd". Normalize to the "@name"
   shape the Channel typedef promises, so live matches the demo set and sets. */
function normalizeHandle(customUrl) {
  const raw = String(customUrl ?? '').trim();
  if (!raw) return '';
  return raw.startsWith('@') ? raw : '@' + raw;
}

export async function fetchLiveChannel(resolved, apiKey) {
  const params = new URLSearchParams({ part: CHANNEL_PARTS, key: apiKey });
  if (resolved.kind === 'handle') params.set('forHandle', resolved.value);
  else params.set('id', resolved.value);

  let res;
  try {
    res = await fetch(`${YT_ENDPOINT}?${params}`);
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
  const item = body.items?.[0];
  if (!item) throw new Error('No channel found for that input.');
  return mapChannelItem(item);
}

/* Map one YouTube API channel item (from channels.list) to the Channel shape.
   Pure — no I/O. Extracted so the live single-channel adapter above and Magic
   Search's batch fetch (data/search.js) shape channels the exact same way from
   the same source, instead of each doing it its own way. */
export function mapChannelItem(item) {
  const stats = item.statistics ?? {};
  return {
    id: item.id,
    title: item.snippet?.title ?? 'Untitled channel',
    handle: normalizeHandle(item.snippet?.customUrl),
    // Prefer the largest thumbnail: the redesigned card shows the avatar in a
    // big ring, where the 88px "default" would look soft. high=800, medium=240.
    avatarUrl: item.snippet?.thumbnails?.high?.url
            ?? item.snippet?.thumbnails?.medium?.url
            ?? item.snippet?.thumbnails?.default?.url ?? '',
    subscriberCount: stats.subscriberCount,
    hiddenSubscriberCount: Boolean(stats.hiddenSubscriberCount),
    viewCount: stats.viewCount ?? '0',
    videoCount: stats.videoCount ?? '0',
    country: item.snippet?.country ?? '', // ISO 3166-1 alpha-2, self-declared; often absent
    // When the channel launched. Already inside the `snippet` part every
    // hydrate requests, so reading it costs no extra quota. The battle axes
    // need it to tell "50 uploads a year" from "500 uploads, once, in 2011".
    publishedAt: item.snippet?.publishedAt ?? '',
    // Wikipedia URLs describing what the channel is about, straight from
    // topicDetails. Kept RAW here because this is the seam's shape and the
    // derivation belongs in the engine; setbuild.js stores only the element it
    // derives, never these URLs. Frequently absent on smaller channels, which
    // is why Unaligned exists.
    topicCategories: item.topicDetails?.topicCategories ?? [],
  };
}
