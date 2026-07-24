/* state — shared in-memory app state and its mutators.
   No persistence by design (DECISIONS.md): in-memory only, safe in
   sandboxed previews. The API key lives here in memory too, and nowhere
   else. */

import { toCard } from './engine/core.js';

export const state = {
  mode: 'sets',                                // Sets is the default; Live is opt-in
  apiKey: '',                                  // memory only, by design
  livePool: [],
  setsPool: [],                                // filled with the starter set on init
  currentSet: null,                            // { slug, title, snapshotDate } once loaded
  collection: new Map(),                       // channel id -> { card, count }
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
