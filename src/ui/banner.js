/* ui/banner — the banner section: the pack (which IS the pull control), the
   x1/x10 size choice, and status messages.
   Owns its own DOM refs and events. initBanner({ onPull }) wires it up;
   the pack calls onPull(count) so main stays the composition root.

   ── WHAT LEFT THIS FILE ON 2026-08-16, AND WHY IT WAS NOT A LOSS ──────────
   Ash: "remove Live API option. Don't need it. Get rid of the demo set as
   well, only core set lives so don't need that dropdown as well."

   THE SET PICKER offered one real set. Core Set IS the deck, and the demo set
   was the only other entry — so the control could only ever be set to what it
   already was. It now loads the set and says nothing.

   THE DEMO SET is gone rather than hidden, and this is the one removal with a
   real cost, stated plainly: it was eight bundled fictional channels that
   loaded from memory, which made the first paint instant and meant the app
   could be pulled from with no network at all. Nothing replaces that. A cold
   load with no connection now shows an error and a retry instead of eight fake
   creators — which is the honest outcome, because pulling fictional cards into
   a permanent collection was never what a visitor came for, and the "works
   offline" property was buying a fiction rather than the game.

   LIVE MODE was the app's original premise — bring your own key, pull any
   channel — and sets made it vestigial: it asked a player for a Google Cloud
   API key to reach a thinner version of what the front page already does with
   20,739 cards and no setup. Dev-only since 2026-08-03, gone now.

   MAGIC SEARCH went with it, because it lived inside the Live controls. It is
   not lost: tools/magic-search.js is the same search from the command line,
   and the Wikidata sweep (tools/wikidata-sweep.js) has been the default
   sourcing route for a long time. A browser is a worse place to spend quota
   than a terminal is.

   WHAT DID NOT CHANGE: data/youtube.js, the live ADAPTER. It is pipeline code
   — tools/add-candidates.js imports it — and the data seam still has it. Only
   the UI stopped offering it, which is exactly the distinction CLAUDE.md's
   architecture section has always drawn. */

import { state, currentPool, setSetsPool } from '../state.js';
import { gateDevElement } from '../config.js';
import { loadSet } from '../data/index.js';

const setMeta = document.getElementById('set-meta');
const setCount = document.getElementById('set-count');
const statusEl = document.getElementById('status');
const packBtn = document.getElementById('pack-open');
const countBtn1 = document.getElementById('pull-1');
const countBtn10 = document.getElementById('pull-10');
const pullBtnDev = document.getElementById('pull-dev');

let statusTimer = null;

/* How many cards the pack opens for. The pack itself is the action, so this is
   a choice about size rather than a second button that also pulls. */
let packCount = 10;

/* Read by the reveal's "pull again" button, so that button can offer the size
   the player actually chose instead of a hardcoded ten. Exported as a GETTER
   rather than the value, because `packCount` is reassigned by the size toggle
   and a plain export would hand callers a stale copy of whatever it was at
   import time. */
export const packSize = () => packCount;

/* A TRANSIENT MESSAGE EXPIRES; A STATE DOES NOT. The 3.5s auto-clear is right
   for "Pulled 10 cards" and wrong for "Loading cards…", and until 2026-08-22
   this function could not tell them apart — so on any connection slower than
   3.5 seconds the loading line vanished while the load was still running, and
   the player was left with a disabled pack and no stated reason for it. The
   worst case is the first visit on mobile data, which is also the only visit
   that decides whether there is a second one.

   `sticky` is the caller saying "this describes something still happening";
   errors were already sticky for the same reason and stay that way. */
function showStatus(message, { error = false, sticky = false } = {}) {
  clearTimeout(statusTimer);
  statusEl.textContent = message;
  statusEl.classList.toggle('error', error);
  if (!error && !sticky && message) {
    statusTimer = setTimeout(() => { statusEl.textContent = ''; }, 3500);
  }
}

/* The two modes want different things from this row, so they diverge here.
   Live ENUMERATES: the pool is hand-built, so every entry needs to be visible
   and removable. Sets shows NOTHING — the set is a sealed box, and telling a
   player it holds 1,442 cards across five bands describes the machine rather
   than the game. That was the whole of the minimalism pass.

   Rendering sets as chips was never an option anyway: a real Series is hundreds
   of cards, and every chip's <img> is the card's own avatar — which WP3 made the
   largest thumbnail available (up to 800px) so the centrepiece isn't soft. That
   is a punishing download for a 22px circle, repeated on every set switch. */
function renderPool() {
  const pool = currentPool();
  const ready = pool.length > 0;
  packBtn.disabled = pullBtnDev.disabled = !ready;
  packBtn.classList.toggle('is-ready', ready);
  renderSetCount(pool);
}

/* Dev-only deck size. Reads the pool that is actually loaded rather than the
   manifest, so it reports what the app can pull right now — which is the number
   worth seeing while sourcing, and the one that catches a stale built set still
   sitting in _site. Gated in init(); hidden elements keep updating harmlessly.

   It reads `state.currentSet` for its label now that there is no picker to read
   the selected option's text from — same fact, from the thing that actually
   knows it rather than from a control that happened to be displaying it. */
function renderSetCount(pool) {
  if (!setCount) return;
  const label = state.currentSet?.title ?? 'Set';
  setCount.textContent = pool.length
    ? `${label} — ${pool.length.toLocaleString()} cards`
    : `${label} — empty`;
}

/* Set by initBanner, so the binder repaints when the pool arrives: loading a
   set changes the total a collection is counted against, and `setSetsPool`
   silently REFRESHES every owned card that is still in print from the new
   data. */
let notifySetLoaded = () => {};

/* THE ONE SET, LOADED ONCE. There is no picker and no fallback pool, so this
   is the only path by which the game gets any cards at all — which is why it
   ends in a real error and a retry rather than a silent empty stage.

   Two manifests are tried in order and the FIRST set offered wins. Both exist
   for the same reason they always did: `sets/index.json` is the committed
   manifest (currently empty), and `sets/built/index.json` is what
   tools/build-set.js mints at deploy time and is never committed, because a set
   file in git is permanent — which would break both the 30-day statistics cap
   and the promise that a removal is performable. Production is the built one. */
async function loadTheSet() {
  showStatus('Loading cards…', { sticky: true });
  const offered = [
    ...await setsFrom('sets/index.json'),
    ...await setsFrom('sets/built/index.json'),
  ];
  const first = offered[0];
  if (!first) return failed('No card set could be loaded.');
  try {
    const set = await loadSet(first);
    setSetsPool(set);
    setMeta.textContent = set.snapshotDate ? `Stats as of ${set.snapshotDate}` : '';
    showStatus('');
    renderPool();
    notifySetLoaded();
  } catch (err) {
    failed(err.message);
  }
}

/* A manifest that is missing or malformed contributes nothing and says nothing
   — between the two of them one is expected to be absent on any given host, so
   a warning here would fire on every correct deployment. The CALLER reports the
   failure, once, when neither produced a set. */
async function setsFrom(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const { sets } = await res.json();
    return (sets ?? []).map(entry => entry.file).filter(Boolean);
  } catch {
    return [];
  }
}

/* THE STAGE IS EMPTY AND THE PLAYER HAS TO BE TOLD. With the bundled demo set
   gone there is nothing to fall back to, so a failed load is a dead front page
   unless it explains itself. The pack is disabled rather than left inviting a
   press that cannot deal cards, and Retry is offered because the overwhelmingly
   likely cause is a connection that was not there a moment ago. */
function failed(message) {
  packBtn.disabled = true;
  showStatus(`${message} Check your connection and try again.`, { error: true });
  if (document.getElementById('set-retry')) return;
  const retry = document.createElement('button');
  retry.id = 'set-retry';
  retry.type = 'button';
  retry.className = 'btn ghost';
  retry.textContent = 'Retry';
  retry.addEventListener('click', () => {
    retry.remove();
    /* The pack stays DISABLED across the retry — re-enabling it here reopened
       the same hole this file just closed, one path over: a pressable pack with
       no pool behind it for the length of a second download. `renderPool` turns
       it back on when there are actually cards, which is the only moment that
       is ever true. */
    loadTheSet();
  });
  statusEl.after(retry);
}

export function initBanner({ onPull, onDevPull, onSetLoaded = () => {} }) {
  /* Announced rather than imported: banner.js has no business reaching into the
     collection view, and the callback shape is already how this module talks to
     the app. Held in a module-local so loadTheSet can reach it. */
  notifySetLoaded = onSetLoaded;

  /* The pack is the pull. The count buttons only choose its size — the old
     layout had two buttons that both pulled, which made neither of them the
     thing you were looking at. */
  packBtn.addEventListener('click', () => { if (!packBtn.disabled) onPull(packCount); });
  for (const [count, button] of [[1, countBtn1], [10, countBtn10]]) {
    button.addEventListener('click', () => {
      packCount = count;
      for (const other of [countBtn1, countBtn10]) {
        const on = other === button;
        other.classList.toggle('on', on);
        other.setAttribute('aria-pressed', String(on));
      }
    });
  }
  pullBtnDev.addEventListener('click', () => onDevPull());

  /* Nothing to pull from until the set lands, and the pack must not invite a
     press it cannot answer. `loadTheSet` re-enables it, or explains why not. */
  packBtn.disabled = pullBtnDev.disabled = true;
  loadTheSet();

  /* WP8: dev affordances are hidden outside dev. Dev Pull forces one card of
     every rarity, which is not what the weights would do — a control that
     quietly ignores the odds is not something to hand a player. The deck-size
     readout is the operator's, for the reason DECISIONS.md gives ("the player
     is not shown the machine"). Both stay in the DOM so `?dev=1` reveals them.

     The Magic Search and Live-mode gating that used to sit here went with the
     controls themselves on 2026-08-16 — see this file's header. */
  gateDevElement(pullBtnDev);
  gateDevElement(setCount);
}
