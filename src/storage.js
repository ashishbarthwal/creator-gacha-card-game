/* storage — the only place in the app that touches localStorage.

   It sits at the root rather than in engine/, data/ or ui/ because the tree is
   organized by what a module may touch and this touches none of those three: not
   pure (it is I/O), not the network, not the DOM. Same reasoning that keeps
   state.js and main.js at the root. The pure half — what a collection looks like
   and how it is read back — lives in engine/collection.js and is tested there.

   EVERY PATH HERE SWALLOWS ITS ERRORS, deliberately. localStorage is not
   reliably available: Safari's private mode has historically thrown on write,
   browsers throw QuotaExceededError when full, and an embedded or sandboxed
   frame can throw merely on ACCESSING window.localStorage. None of that is worth
   breaking a game over. The collection is a convenience, not the app — if it
   cannot be saved, the session still works exactly as it did before persistence
   existed, which is the behaviour this project shipped with for eight work
   packages.

   WHAT IS NEVER WRITTEN HERE: the API key. It lives in state.js in memory and
   nowhere else. That is a promise made to players in the footer and repeated in
   the privacy policy, and the fact that this module only ever receives a
   collection is what keeps it true. */

import { serializeCollection, parseCollection } from './engine/collection.js';

/* Namespaced and versioned in the key itself, so a future breaking change can
   simply use a new key and leave the old data inert rather than trying to
   migrate it in place. */
const KEY = 'creator-gacha:collection:v1';

/* Access is inside the try as well as use: reading window.localStorage can
   itself throw in a sandboxed frame, so a bare `typeof` check is not enough. */
function store() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    return ls;
  } catch {
    return null;
  }
}

export function isAvailable() {
  return store() !== null;
}

export function loadCollection() {
  const ls = store();
  if (!ls) return new Map();
  try {
    const raw = ls.getItem(KEY);
    if (!raw) return new Map();
    return parseCollection(JSON.parse(raw));
  } catch {
    /* Corrupt JSON, a half-written value, anything: an empty collection is the
       safe read. parseCollection already tolerates a bad SHAPE; this catches a
       string that is not JSON at all. */
    return new Map();
  }
}

/* Returns whether the write landed, so a caller can tell the difference between
   "saved" and "quietly not saved" if it ever wants to say so out loud. */
export function saveCollection(collection) {
  const ls = store();
  if (!ls) return false;
  try {
    ls.setItem(KEY, JSON.stringify(serializeCollection(collection)));
    return true;
  } catch {
    return false;
  }
}

/* The delete. Not an afterthought: a collection a player cannot remove is one
   this project would have to describe in a privacy policy as data it keeps on
   their device with no way out, and "stored locally, delete it whenever you
   like" is only true if something performs the deletion. */
export function clearCollection() {
  const ls = store();
  if (!ls) return false;
  try {
    ls.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
