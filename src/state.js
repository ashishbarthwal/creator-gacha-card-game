/* state — shared app state and its mutators.

   The COLLECTION persists to localStorage (WP9); everything else here is
   in-memory. That supersedes the old "no persistence yet" decision, which was
   taken to stay safe in sandboxed previews before there was a real host.

   The API key is the deliberate exception and stays memory-only. It is a
   promise made to players in the footer, and the way it is kept is structural:
   storage.js only ever receives a collection, so there is no code path that
   could persist a key even by mistake. */

import { toCard } from './engine/core.js';
import { reconcileCollection } from './engine/collection.js';
import { loadCollection, saveCollection, clearCollection } from './storage.js';

/* `mode`, `apiKey` and `livePool` were removed on 2026-08-16 with the Live API
   mode they existed for (see ui/banner.js). The app has ONE pool now, so a
   function that chose between two was a branch with one arm.

   The key promise the header above describes is now kept by there being no key:
   nothing in the shipped UI asks for one, and no field exists to hold it. The
   live adapter still takes a key as a parameter, because tools/ passes one. */
export const state = {
  setsPool: [],                                // filled once the set loads
  currentSet: null,                            // { slug, title, snapshotDate } once loaded
  /* channel id -> { card, count }. Restored from localStorage at module load,
     which is early enough that the first renderCollection() already has it. */
  collection: loadCollection(),
};

/* Kept as a function rather than collapsed into `state.setsPool` at every call
   site: the pool is read in five places, and a named accessor is the seam that
   let the two-pool version become a one-pool version without touching any of
   them. */
export function currentPool() {
  return state.setsPool;
}

/* Load a parsed set (from data/sets.parseSet) as the active pool. Channels
   become cards through the same pure bridge the live adapter feeds, so nothing
   downstream can tell a fetched set from a live fetch. */
export function setSetsPool(set) {
  state.setsPool = set.channels.map(toCard);
  state.currentSet = { slug: set.slug, title: set.title, snapshotDate: set.snapshotDate };

  /* A loaded set IS current data, so every owned card still in print is
     refreshed from it for free. This is what keeps a player's saved snapshots
     inside the 30-day cap without a single extra request — see
     engine/collection.js. Cards that have left the set keep what they had. */
  const { collection, updated } = reconcileCollection(state.collection, set.channels);
  if (updated) {
    state.collection = collection;
    saveCollection(state.collection);
  }
}

export function addToCollection(card) {
  const owned = state.collection.get(card.channel.id);
  if (owned) {
    owned.count += 1;
    return { card, isNew: false };
  }
  state.collection.set(card.channel.id, { card, count: 1 });
  return { card, isNew: true };
}

/* Called once after a pull rather than inside addToCollection, so a x10 costs
   one write instead of ten. */
export function persistCollection() {
  return saveCollection(state.collection);
}

export function resetCollection() {
  state.collection = new Map();
  clearCollection();
}
