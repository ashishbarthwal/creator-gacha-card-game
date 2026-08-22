/* data/sets — the third adapter behind the seam (WP4). Loads a curated,
   versioned card set (static JSON) and hands back channels in the exact same
   Channel shape as the bundled demo set and live, so the gacha engine and
   renderer can't tell the source apart. No key, no live API call: a set is
   pre-baked at build time
   (tools/build-set.js, planned) and refreshed monthly.

   Split like the rest of the codebase: parseSet is pure and validated — the
   test target — while loadSet is the thin fetch wrapper at the IO edge.

   Set envelope: { slug, title, series, snapshotDate, channels[] }. The
   snapshotDate lives on the set (not each card); cards display "stats as of
   <month>" from it. */

/* Pure: validate a parsed set object and normalize every channel to the
   Channel shape (counts as strings, exactly as the demo set and live emit
   them). Throws a
   readable error rather than shipping a half-built set. */
export function parseSet(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Card set must be a JSON object.');
  }
  const { slug, title, series, snapshotDate, channels } = raw;
  if (!slug || !title) throw new Error('Card set is missing "slug" or "title".');
  if (!Array.isArray(channels) || channels.length === 0) {
    throw new Error(`Card set "${slug}" has no channels.`);
  }
  return {
    slug: String(slug),
    title: String(title),
    series: String(series ?? ''),
    snapshotDate: String(snapshotDate ?? ''),
    channels: channels.map((ch, i) => normalizeChannel(ch, i, slug)),
  };
}

/* ── REHYDRATING THE PACKED AVATAR ──────────────────────────────────────────
   setbuild.js writes the variable middle of a Google avatar URL to `avatar`
   and drops the host and size spec, which are identical on effectively every
   card (see packAvatar there for the measurement). This puts them back.

   IT IS THE SEAM THAT MAKES THIS FINE. A set is the only source that packs;
   demo and live emit a whole `avatarUrl` and always have. Because the shape
   handed onward is identical either way, nothing downstream — card render,
   battle card, reveal — can tell which source it came from, which is the
   guarantee the seam exists to provide. Both fields are accepted, so a set
   built before this existed still loads, and so does one carrying a URL that
   did not fit the template. */
const AVATAR_PREFIX = 'https://yt3.ggpht.com/';
const AVATAR_SUFFIX = '=s800-c-k-c0x00ffffff-no-rj';

export function unpackAvatar(ch) {
  if (typeof ch?.avatar === 'string' && ch.avatar) {
    return AVATAR_PREFIX + ch.avatar + AVATAR_SUFFIX;
  }
  return String(ch?.avatarUrl ?? '');
}

function normalizeChannel(ch, i, slug) {
  if (!ch || typeof ch !== 'object' || !ch.id) {
    throw new Error(`Card set "${slug}" channel #${i} is missing an "id".`);
  }
  const channel = {
    id: String(ch.id),
    title: String(ch.title ?? 'Untitled channel'),
    handle: String(ch.handle ?? ''),
    avatarUrl: unpackAvatar(ch),
    /* Absent means false — setbuild.js only writes this when it is true, since
       it was false on every card of the live deck. */
    hiddenSubscriberCount: Boolean(ch.hiddenSubscriberCount),
    viewCount: String(ch.viewCount ?? '0'),
    videoCount: String(ch.videoCount ?? '0'),
    country: String(ch.country ?? ''),
    /* THESE TWO WERE BEING DROPPED ON THE FLOOR. setbuild.js puts both into
       every published record and this normalizer, written before either
       existed, rebuilt the channel without them — so a set could ship a
       publishedAt that no reader ever saw. Two of the five battle axes are
       dead without the date and the whole element layer is dead without the
       element, and both failures are silent: the card still renders, it just
       quietly falls back. Worth stating because the bug is structural rather
       than careless — a positive allowlist is the right shape here for exactly
       the reason toCandidate uses one, and its cost is that a new field has to
       be added in two places or it goes nowhere. */
    publishedAt: String(ch.publishedAt ?? ''),
    element: String(ch.element ?? ''),
  };
  /* Keep subscriberCount only when present — the typedef omits it for hidden
     channels, matching the live API, so the core reads them the same way. */
  if (ch.subscriberCount != null) channel.subscriberCount = String(ch.subscriberCount);
  return channel;
}

/* IO edge: fetch a set JSON and parse it. Fetch failures and bad JSON surface
   as readable errors, never an unhandled rejection. */
export async function loadSet(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('Could not load the card set (network error).');
  }
  if (!res.ok) throw new Error(`Could not load the card set (HTTP ${res.status}).`);
  let raw;
  try {
    raw = await res.json();
  } catch {
    throw new Error('Card set is not valid JSON.');
  }
  return parseSet(raw);
}
