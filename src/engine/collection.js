/* engine/collection — PURE. The saved collection's shape: what a pull is worth
   keeping, how it survives a reload, and how it is read back safely. No
   localStorage here — that is src/storage.js. No DOM, no clock of its own.

   WHAT IS STORED, AND WHY IT IS THE CHANNEL RATHER THAN THE CARD.
   A card is `toCard(channel)` — `{ channel, rarity, atk, def }` — and every part
   of it except the channel is derived, purely and deterministically. Storing the
   derived fields would mean a saved rarity could one day disagree with the
   function that computes rarity, which is a bug with no way to detect it. So the
   store holds the channel snapshot and the count, and the card is re-derived on
   load. Same discipline as the candidate DB storing ids rather than stats: keep
   the source, compute the rest.

   WHY A SNAPSHOT AT ALL, RATHER THAN JUST AN ID.
   The set is re-cut on every build — subscriber counts move, a channel crossing
   10M jumps SR to SSR, and the band cap then selects differently. So a card in
   somebody's collection can leave Series 1 entirely. Storing only the id would
   mean their card silently vanishes on the week that happens, which is the worse
   failure: a collection is a record of what you pulled, and a physical card does
   not disappear from a binder because its subject got more popular.

   THE 30-DAY CAP, WHICH THIS HAS TO ANSWER TOO.
   A snapshot in a player's browser is still stored API data, and the Developer
   Policies cap statistics at 30 days. `reconcileCollection` is the answer: when a
   set loads, every stored card whose id is in that set is refreshed from it. A
   player who opens the game at all therefore carries current data for everything
   still in print, automatically, with no extra fetch — and only cards that have
   genuinely left the set keep an ageing snapshot. Those carry `savedAt`, so they
   can be expired later without guessing when they arrived.

   WHAT IS NEVER STORED: the API key. It lives in memory and nowhere else, which
   is a promise made to players in the footer, and a test asserts the serialized
   bytes contain nothing but channel fields and counts. */

import { toCard } from './core.js';

/* Bumped when the stored shape changes in a way a reader must handle. Read on
   load and mismatches are DISCARDED rather than guessed at — a wrong migration
   silently corrupts somebody's collection, and starting over is honest. */
export const COLLECTION_VERSION = 1;

/* The Channel fields worth keeping. A positive allowlist, for the same reason
   engine/candidates.js and engine/setbuild.js use one: a blocklist would start
   persisting whatever field the seam grows next, into storage we do not control
   and cannot clear remotely. `country` is absent by construction here too. */
function toStoredChannel(channel) {
  const stored = {
    id: String(channel.id),
    title: String(channel.title ?? ''),
    handle: String(channel.handle ?? ''),
    avatarUrl: String(channel.avatarUrl ?? ''),
    hiddenSubscriberCount: Boolean(channel.hiddenSubscriberCount),
    viewCount: String(channel.viewCount ?? '0'),
    videoCount: String(channel.videoCount ?? '0'),
  };
  /* Omitted rather than zeroed when hidden, matching the live API and the
     typedef — the core reads absence as the bottom band on purpose. */
  if (channel.subscriberCount != null) stored.subscriberCount = String(channel.subscriberCount);
  return stored;
}

/* collection Map -> a plain object ready for JSON.stringify. */
export function serializeCollection(collection, { now = Date.now() } = {}) {
  const entries = [];
  for (const item of (collection?.values?.() ?? [])) {
    if (!item?.card?.channel?.id) continue;
    entries.push({
      channel: toStoredChannel(item.card.channel),
      count: Math.max(1, Math.floor(Number(item.count) || 1)),
      savedAt: item.savedAt ?? new Date(now).toISOString(),
    });
  }
  return { version: COLLECTION_VERSION, savedAt: new Date(now).toISOString(), entries };
}

/* Plain object -> the collection Map the app runs on.

   Every failure here is recoverable by design. A wrong version, a non-array,
   a single malformed entry: all yield an empty or partial collection rather
   than throwing, because the alternative is that one corrupt byte in
   localStorage stops the whole app booting. Dropping one card beats losing
   the collection, and losing the collection beats a blank page. */
export function parseCollection(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== COLLECTION_VERSION) return new Map();
  const collection = new Map();
  for (const entry of Array.isArray(raw.entries) ? raw.entries : []) {
    const channel = entry?.channel;
    if (!channel?.id) continue;
    const id = String(channel.id);
    if (collection.has(id)) continue;
    collection.set(id, {
      card: toCard(toStoredChannel(channel)),
      count: Math.max(1, Math.floor(Number(entry.count) || 1)),
      savedAt: typeof entry.savedAt === 'string' ? entry.savedAt : undefined,
    });
  }
  return collection;
}

/* Refresh stored snapshots from a freshly loaded set.

   This is what keeps a player's collection inside the 30-day cap without a
   single extra request: the set they just loaded IS current data, so every card
   they own that is still in print gets updated for free. Cards that have left
   the set keep what they had — the deliberate trade above, so a collection never
   loses entries.

   Counts are preserved; only channel data is replaced. Returns a new Map rather
   than mutating, so a caller can tell whether anything changed and decide
   whether a write is warranted. */
export function reconcileCollection(collection, channels) {
  const fresh = new Map((channels ?? []).filter(c => c?.id).map(c => [String(c.id), c]));
  const next = new Map();
  let updated = 0;
  for (const [id, item] of (collection ?? new Map())) {
    const channel = fresh.get(String(id));
    if (!channel) { next.set(id, item); continue; }
    next.set(id, { card: toCard(toStoredChannel(channel)), count: item.count, savedAt: new Date().toISOString() });
    updated++;
  }
  return { collection: next, updated };
}
