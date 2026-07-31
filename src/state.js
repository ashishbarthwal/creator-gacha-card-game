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

export const state = {
  mode: 'sets',                                // Sets is the default; Live is opt-in
  apiKey: '',                                  // memory only, by design
  livePool: [],
  setsPool: [],                                // filled with the starter set on init
  currentSet: null,                            // { slug, title, snapshotDate } once loaded
  /* channel id -> { card, count }. Restored from localStorage at module load,
     which is early enough that the first renderCollection() already has it. */
  collection: loadCollection(),
};

export function currentPool() {
  return state.mode === 'live' ? state.livePool : state.setsPool;
}

/* Load a parsed set (from data/sets.parseSet) as the active sets pool. Channels
   become cards through the same pure bridge as live, so nothing downstream can
   tell the bundled starter set, a fetched set, and live apart. */
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
