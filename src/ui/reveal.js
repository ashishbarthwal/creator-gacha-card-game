/* ui/reveal — the pull reveal overlay: cards turn over, rarest last.

   ── STRIPPED 2026-08-16, AND WHAT SURVIVED ────────────────────────────────
   Ash: "the card pulling animation is laggy on mobile and a lil bit on pc as
   well. Strip it down... Don't need it to be fancy. But keep the color showing
   the highest card pulled in this turn."

   What this used to run, per pull, is worth writing down because the total is
   the point rather than any one piece: a colour-coded beam per rare, a
   specular sweep, 18-26 twinkling stars on EVERY SR-and-above card (up to ~260
   infinitely-animating nodes on a x10), and for the top two tiers a spinning
   conic-gradient ignition ring, a discharge bloom, and a breathing aura
   shedding FIFTY looping motes. The old header's boast — "all CSS, zero
   dependencies, no per-frame JS, so nothing to lag on" — was the error in one
   line. Compositing hundreds of simultaneously animating layers is per-frame
   work whoever schedules it, and a phone GPU is where that bill arrives.

   What is left is the beat that carries the moment: the card turns over, and
   the rarity colour lights the seam around it as it lands. One one-shot
   animation per card, no looping layers, nothing that outlives its own reveal.
   Rarest still flips last, because ordering is free — it is a sort and a
   setTimeout, and it is the whole of the drama that survived.

   THE COLOUR ASH ASKED TO KEEP is the pack tease in ui/packopen.js — the
   charge takes the colour of the BEST card in the pull. That is deliberately
   untouched. This file keeps its per-card seam colour too, which is the same
   idea one card at a time.

   Reduced motion still collapses to an instant, calm reveal. Self-contained:
   owns its close wiring; main just calls openReveal(results). */

import { renderCard } from './card.js';
import { openInspect, isInspectOpen } from './inspect.js';

const revealEl = document.getElementById('reveal');
const revealGrid = document.getElementById('reveal-grid');
const revealDone = document.getElementById('reveal-done');
const revealAgain = document.getElementById('reveal-again');

/* THE LOOP, wired by main rather than reached for. The reveal is the moment a
   player is most likely to want another pull, and a screen whose only exit is
   "Done" spends that on nothing — but this module has no business knowing what
   a pull IS, so it takes the action and the size as callbacks from the
   composition root, exactly as ui/banner.js takes `onPull`.

   Left null until wired, and the button hides itself in that case rather than
   sitting there dead. */
let againAction = null;
let againSize = null;

export function initReveal({ onPullAgain = null, packSize = null } = {}) {
  againAction = onPullAgain;
  againSize = packSize;
  if (revealAgain) revealAgain.hidden = !onPullAgain;
}

/* NO POINTER TILT HERE ANY MORE (stripped 2026-08-16). It is a pointermove
   handler doing a getBoundingClientRect and four custom-property writes per
   event, against ten cards that are already mid-flip — the "a lil bit on pc as
   well" half of the report. The collection grid and the inspector keep it:
   there the cards are STILL, the tilt is the only thing moving, and it is the
   finish doing its job rather than competing with a sequence. */

let revealTimers = [];

/* Which pull result a cell is showing, so a click can open that card in the
   inspector. A WeakMap rather than a dataset id: there is no keyed store to look
   the result back up in (unlike the collection grid, which has state.collection),
   and the entries fall away on their own when the grid is cleared. */
const cellResults = new WeakMap();

const CARD_BACK_HTML =
  '<div class="back-rings"></div><div class="back-play"></div><div class="back-word">CREATOR GACHA</div>';

/* Per-rarity pacing. `rank` orders the sequence — rarer flips later, which is
   the crescendo — and `hold` is the beat after a card lands before the next one
   turns.

   THE BEAM IS GONE and the holds are roughly halved (2026-08-16). The
   telegraph was an animated cone of light per rare card, and its cost was not
   only the layer: a UR beam ran 950ms BEFORE its card turned, so the expensive
   part of the old sequence was also its slowest part. A x10 with a couple of
   rares in it took the better part of six seconds to finish turning over. Rank
   and hold are a sort and a setTimeout — free, and enough to keep the good card
   for last. */
const FX = {
  N:    { rank: 0, hold: 0   },
  R:    { rank: 1, hold: 40  },
  SR:   { rank: 2, hold: 120 },
  SSR:  { rank: 3, hold: 200 },
  UR:   { rank: 4, hold: 320 },
  RUBY: { rank: 5, hold: 400 },
};

/* Gap between consecutive commons — the cadence knob, and the one that decides
   whether an N run reads as a sequence or as a machine-gun. At 115ms it was the
   latter: the flip animation itself runs far longer than the gap, so five cards
   were mid-turn at once and no single card had a beat of its own. Widened so a
   common still lands briskly but finishes most of its turn before the next
   starts. The rarer tiers add their own `hold` on top of this. */
const BASE_GAP = 160;
const OPENING_BEAT = 200;  // let the overlay settle before the first flip

const REDUCE_MOTION = matchMedia('(prefers-reduced-motion: reduce)');

/* ── A tick in the hand when a row lands ───────────────────────────────────
   The scroll snap already announces that a row arrived, but it announces it to
   the eye only — and on a phone the thumb is the thing doing the work. 10ms is
   a tick rather than a buzz; anything longer stops reading as a detent and
   starts reading as a notification.

   This is progressive enhancement in the strict sense: where it is unavailable
   nothing is lost and nothing is substituted. Three gates, none optional:

   - `navigator.vibrate` does not exist on iOS in any browser, and exists but
     does nothing on desktop. Optional-called, so the platform decides and we
     never branch on a user-agent string.
   - `prefers-reduced-motion: reduce` is honoured. A haptic is unrequested
     sensory feedback, which is squarely what that setting is about, and this
     overlay already collapses its entire animation under it — a buzz that
     survived that would be the one inconsistent thing left.
   - Chrome requires sticky user activation before it will vibrate at all. Not
     a constraint here, since the overlay is unreachable without tapping the
     pack, but it is why this can never fire on a cold page load. */
const SNAP_TICK_MS = 10;

/* Armed by the user's input, never by ours. `openReveal` resets scrollTop to 0,
   and a programmatic scroll changes the snap target exactly as a finger does —
   without this the overlay would tick once on open, which is not what was asked
   for and would read as a glitch rather than a detent. */
let snapArmed = false;

function snapTick() {
  if (!snapArmed || REDUCE_MOTION.matches) return;
  navigator.vibrate?.(SNAP_TICK_MS);
}

/* How many columns this viewport can show a READABLE card in.

   The count is pinned here rather than left to CSS `auto-fit` for the reason it
   always was — auto-fit would strand a x1's single card in a five-track grid —
   but the cap is now viewport-aware, because a fixed 5 was only ever right for
   a desktop. Five columns inside a 700px tablet works out to 107px per card,
   which is worse than the 138px phone case that started this. The overlay
   scrolls now, so rows are cheap and width is not: prefer fewer, bigger cards
   and let the user scroll.

   Kept in step with the breakpoint in styles.css, which sets the per-track cap
   and the gaps for the same two tiers. */
function columnCap() {
  const w = window.innerWidth;
  if (w <= 560) return 2;     // phones — Ash's rule: two per row
  if (w <= 899) return 3;     // tablets and small windows
  return 5;                   // desktop: a x10 reads as two rows of five
}

function applyColumns(count) {
  revealGrid.style.setProperty('--reveal-cols', Math.min(count, columnCap()));
}

export function openReveal(results) {
  revealTimers.forEach(clearTimeout);
  revealTimers = [];
  revealGrid.innerHTML = '';
  applyColumns(results.length);

  const cells = results.map(result => buildCell(result));

  /* Labelled per open, because the size toggle can change between pulls and a
     button that promises ×10 while the banner is set to ×1 is a lie the player
     only finds out about by pressing it. */
  if (revealAgain && againSize) {
    const n = againSize();
    revealAgain.textContent = Number.isFinite(n) && n > 1 ? `Pull again ×${n}` : 'Pull again';
  }

  snapArmed = false;
  revealEl.hidden = false;
  /* A reopened overlay must start at the top. The scroll position survives
     `hidden`, so without this a second x10 would open halfway down its own
     results — with the first row, the one the whole sequence builds toward,
     already scrolled past. */
  revealEl.scrollTop = 0;
  revealDone.focus({ preventScroll: true });

  /* Reduced motion: every card is already face-up, so there is no sequence to
     run. Routed through flip() rather than setting .flipped directly so these
     cards still pick up the focusability and label it applies — the inspector
     is reachable here too, since the click/keyboard handlers are delegated on
     the persistent grid rather than bound per cell in the animated path. */
  if (REDUCE_MOTION.matches) {
    cells.forEach(({ cell }) => flip(cell));
    return;
  }

  /* Schedule by rarity rank: commons first and fast, rares last and dramatic.
     Ties keep pull order so a given seed is otherwise stable. */
  const order = cells
    .map((c, i) => ({ ...c, i }))
    .sort((a, b) => FX[a.rarity].rank - FX[b.rarity].rank || a.i - b.i);

  let cursor = OPENING_BEAT;
  for (const { cell, rarity } of order) {
    revealTimers.push(setTimeout(() => flip(cell), cursor));
    cursor += BASE_GAP + FX[rarity].hold;
  }
}

/* One cell: a card that turns over. The per-rarity class stays — it is what
   colours the seam as the card lands, and that colour is the whole of what the
   reveal still says about rarity.

   THE SWEEP, THE STARS, THE IGNITION RING, THE BLOOM AND THE AURA ALL CAME OUT
   HERE (2026-08-16). None of them was expensive on its own; a x10 that built
   all of them at once was, and a phone is where that shows. The card face keeps
   its own finish — that is ui/card.js's business, it renders in the collection
   too, and it is not animated. */
function buildCell(result) {
  const rarity = result.card.rarity;
  const cell = document.createElement('div');
  cell.className = `reveal-cell glow-${rarity}`;

  const flipEl = document.createElement('div');
  flipEl.className = 'flip';
  const inner = document.createElement('div');
  inner.className = 'flip-inner';
  const back = document.createElement('div');
  back.className = 'face back card-back';
  back.innerHTML = CARD_BACK_HTML;
  const front = document.createElement('div');
  front.className = 'face front';
  front.appendChild(renderCard(result.card, { isNew: result.isNew }));
  inner.append(back, front);
  flipEl.appendChild(inner);
  cell.appendChild(flipEl);

  cellResults.set(cell, result);
  revealGrid.appendChild(cell);
  return { cell, rarity };
}

/* Turn one card. The seam glow is CSS on .flipped; here we only flip. The
   guard makes a later scheduled flip (after an early click) a no-op.

   The turn is also what makes a cell an inspectable thing, so the button
   semantics are granted here rather than at build time: face-down, the card has
   no identity to announce and naming it would hand a screen-reader user the
   rarity the flip exists to withhold. */
function flip(cell) {
  if (cell.classList.contains('flipped')) return;
  cell.classList.add('flipped');

  const title = cellResults.get(cell)?.card.channel.title;
  if (!title) return;
  cell.tabIndex = 0;
  cell.setAttribute('role', 'button');
  cell.setAttribute('aria-label', `View ${title} up close`);
}

/* A click means one of two things depending on where the card is in its turn,
   and both are wanted: face-down it skips the wait, face-up it opens the card
   large. Delegated on the persistent grid — like the collection's — so it
   survives the innerHTML wipe at the top of openReveal and covers the
   reduced-motion path without a second binding. */
function inspectFromEvent(e) {
  const cell = e.target.closest?.('.reveal-cell');
  if (!cell || !revealGrid.contains(cell)) return;
  if (!cell.classList.contains('flipped')) {
    flip(cell);
    return;
  }
  const result = cellResults.get(cell);
  if (result) openInspect(result.card, { isNew: result.isNew });
}

revealGrid.addEventListener('click', inspectFromEvent);
revealGrid.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inspectFromEvent(e); }
});

/* Rotating a phone crosses the 560px breakpoint in one gesture, and the overlay
   is very much open while it happens. The cell count is read back off the grid
   rather than remembered, so there is no second copy of it to drift. */
addEventListener('resize', () => {
  if (!revealEl.hidden) applyColumns(revealGrid.children.length);
});

/* Anything that could be a scroll the user meant arms the tick. Passive, so
   none of these can delay the scroll they are listening for. */
for (const evt of ['touchstart', 'wheel', 'keydown']) {
  revealEl.addEventListener(evt, () => { snapArmed = true; }, { passive: true });
}

/* `scrollsnapchange` is the event this feature is actually asking for: it fires
   once the scroll has settled on a NEW snap target, so there is no fling to
   guess the end of and no polling. Chrome has had it since 129, which covers
   every browser that also has a vibrator worth speaking of.

   Firefox has `scrollend` but not `scrollsnapchange`, so it gets the same answer
   a beat later by asking which row is parked at the top and comparing. Nothing
   else needs a fallback: a browser with neither event has no `navigator.vibrate`
   either, and the whole path costs nothing there. */
if ('onscrollsnapchange' in revealEl) {
  revealEl.addEventListener('scrollsnapchange', snapTick);
} else if ('onscrollend' in revealEl) {
  let lastSnapped = null;
  revealEl.addEventListener('scrollend', () => {
    /* Cells in one row share an offsetTop, and ties resolve to the first, so
       this identifies a ROW stably rather than flickering between its two
       cards. `#reveal` is the offsetParent — it is the only positioned ancestor
       — which is what makes offsetTop directly comparable to its scrollTop. */
    let best = null, bestGap = Infinity;
    for (const cell of revealGrid.children) {
      const gap = Math.abs(cell.offsetTop - revealEl.scrollTop);
      if (gap < bestGap) { bestGap = gap; best = cell; }
    }
    if (best && best !== lastSnapped) { lastSnapped = best; snapTick(); }
  });
}

export function closeReveal() {
  revealTimers.forEach(clearTimeout);
  revealTimers = [];
  revealEl.hidden = true;
}

revealDone.addEventListener('click', closeReveal);
revealEl.addEventListener('click', e => { if (e.target === revealEl) closeReveal(); });

/* Close FIRST, then pull. The next pull opens the summon overlay and then this
   same reveal again, so leaving the old one up would stack a fresh sequence
   behind a screen still showing the previous pull's cards. */
revealAgain?.addEventListener('click', () => {
  if (!againAction) return;
  closeReveal();
  againAction();
});

/* Escape closes the TOP overlay only. Now that the inspector can open from the
   reveal, both are listening on document, and one Escape would otherwise close
   the inspector AND drop the reveal behind it in a single press.
   Registered on the CAPTURE phase deliberately: a capture listener on document
   always runs before a bubble listener on document, whatever order the modules
   happened to be imported in. So this asks "is the inspector up?" while the
   answer is still true, instead of racing inspect.js's own handler to it. */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || revealEl.hidden) return;
  if (isInspectOpen()) return; // the inspector is on top; that Escape is its own
  closeReveal();
}, true);
