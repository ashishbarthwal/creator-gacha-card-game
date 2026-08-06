/* ui/reveal — the pull reveal overlay: a rarity-escalated flip sequence.
   Common cards resolve fast; rarer cards come LAST, each preceded by a
   colour-coded beam (the telegraph). As a rare card lands, a single slow
   specular sweep passes across its face and a seam glow lights up AROUND it
   (rarity hidden until the turn — suspense); SR+ also carry twinkling stars,
   placed to avoid the avatar circle. UR alone gets a three-beat finish, each
   with its own shape and its own slot so they don't blur together: the ignition
   (a hot point racing once around the frame), the discharge (a silhouette
   pushing outward as the loop closes) and the aura (a breathing field behind
   the card, shedding motes, looping). All CSS, zero dependencies —
   no per-frame JS, so nothing to lag on. Reduced motion collapses it to an
   instant, calm reveal. Self-contained: owns its close wiring; main just calls
   openReveal(results). */

import { renderCard } from './card.js';
import { openInspect, isInspectOpen } from './inspect.js';
import { enableCardTilt, enableDeviceTilt } from './holo.js';

const revealEl = document.getElementById('reveal');
const revealGrid = document.getElementById('reveal-grid');
const revealDone = document.getElementById('reveal-done');

/* Pointer-tilt on a fine-pointer device (was previously only wired up in the
   collection grid and the inspector — the reveal screen itself had none, on
   any platform). Delegated on the persistent grid, like the others. */
enableCardTilt(revealGrid);

let revealTimers = [];

/* Which pull result a cell is showing, so a click can open that card in the
   inspector. A WeakMap rather than a dataset id: there is no keyed store to look
   the result back up in (unlike the collection grid, which has state.collection),
   and the entries fall away on their own when the grid is cleared. */
const cellResults = new WeakMap();

const CARD_BACK_HTML =
  '<div class="back-rings"></div><div class="back-play"></div><div class="back-word">CREATOR GACHA</div>';

/* Per-rarity theatre. rank orders the sequence (rarer flips later, for a
   crescendo); beam is the pre-flip telegraph time (ms); hold is the pause after
   this card lands. Sweep, seam glow and stars are gated per rarity downstream. */
const FX = {
  N:    { rank: 0, beam: 0,    hold: 0   },
  R:    { rank: 1, beam: 200,  hold: 60  },
  SR:   { rank: 2, beam: 360,  hold: 240 },
  SSR:  { rank: 3, beam: 600,  hold: 430 },
  UR:   { rank: 4, beam: 950,  hold: 700 },
  RUBY: { rank: 5, beam: 1200, hold: 900 },
};

/* Gap between consecutive commons — the cadence knob, and the one that decides
   whether an N run reads as a sequence or as a machine-gun. At 115ms it was the
   latter: the flip animation itself runs far longer than the gap, so five cards
   were mid-turn at once and no single card had a beat of its own. Widened so a
   common still lands briskly but finishes most of its turn before the next
   starts. The rarer tiers are spaced by their own beam + hold on top of this. */
const BASE_GAP = 200;
const OPENING_BEAT = 300;  // let the overlay settle before the first flip

const SWEPT = new Set(['SR', 'SSR', 'UR', 'RUBY']);   // get the specular sweep

/* Twinkling stars, now starting at SR: a sparse small shimmer there, the dense
   quick field at SSR, a little denser again at UR, denser still at RUBY.
   Ranges are [min, max] — count, dot size (px), twinkle period (s). Tint is
   per-tier in CSS and follows the frame, so SR reads gold, SSR cold diamond,
   UR hot amber, RUBY cold diamond-white with a red cast. */
const STARS = {
  SR:   { count: 18, size: [1.8, 3.4], tw: [1.8, 4.2] },
  SSR:  { count: 22, size: [2.2, 5.2], tw: [1.1, 2.8] },
  UR:   { count: 26, size: [2.0, 4.4], tw: [1.1, 2.8] },
  /* RUBY goes DOWN, against the escalation every other row follows, and that
     inversion is the point. Up to UR the ladder buys drama with density. The
     gem cut buys it with restraint: a cut stone throws a few big, deliberate
     reflections, and a dense field of small ones is what costume jewellery
     looks like. Fewer, larger, slower — and rendered as four-point sparkles
     rather than round dots (`.glow-RUBY .star` in styles.css). */
  RUBY: { count: 9,  size: [4.5, 8.5], tw: [2.6, 5.0] },
};

/* The top-of-ladder finale — ignition, discharge and breathing aura — was
   UR-exclusive when UR was the top tier. RUBY inherits the same mechanics
   (WP-Ruby Tier); its own colours come from CSS (.glow-RUBY), keyed off the
   same class this set gates. */
const TOP_TIER = new Set(['UR', 'RUBY']);

/* Avatar exclusion in card-relative fractions (the ringed centrepiece), so
   stars never land on the pfp. y is scaled by the 5:7 aspect for a round check. */
const AV = { cx: 0.5, cy: 0.45, r: 0.33 };
const ASPECT = 7 / 5;

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

  /* Called from here rather than once at module load: opening a reveal is
     always the result of a tap (the pack), and on iOS the motion-permission
     prompt only fires when requested synchronously inside a user gesture. The
     first pull of a session is what asks; enableDeviceTilt no-ops on every
     call after the first (see holo.js). */
  enableDeviceTilt(revealGrid);

  const cells = results.map(result => buildCell(result));

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
    const fx = FX[rarity];
    if (fx.beam) {
      const at = cursor;
      revealTimers.push(setTimeout(() => {
        /* A card can be turned early by clicking it, and the beam is a separate
           timer from the flip — so by the time this fires the card may already
           be face-up. Lighting a telegraph for a card that has landed is not
           just pointless: the beam animation is `forwards`, and nothing removes
           `beaming` after the flip, so it would strand a cone of light above the
           card for as long as the overlay is open. */
        if (cell.classList.contains('flipped')) return;
        cell.style.setProperty('--beam-ms', fx.beam + 'ms');
        cell.classList.add('beaming');
      }, at));
    }
    revealTimers.push(setTimeout(() => flip(cell), cursor + fx.beam));
    cursor += fx.beam + BASE_GAP + fx.hold;
  }
}

/* Scatter twinkling stars over the card, rejecting any that fall inside the
   avatar circle. Positions + per-star timing/size are random (inline styles);
   the twinkle itself is a CSS animation, so there's no JS running per frame. */
function makeStars(rarity) {
  const { count, size, tw } = STARS[rarity];
  const span = (lo, hi) => lo + Math.random() * (hi - lo);
  const wrap = document.createElement('div');
  wrap.className = 'stars';
  for (let placed = 0, guard = 0; placed < count && guard < count * 40; guard++) {
    const x = 0.06 + Math.random() * 0.88;
    const y = 0.06 + Math.random() * 0.88;
    const dx = x - AV.cx;
    const dy = (y - AV.cy) * ASPECT;
    if (dx * dx + dy * dy < AV.r * AV.r) continue; // inside the pfp — skip
    const star = document.createElement('i');
    star.className = 'star';
    star.style.left = (x * 100).toFixed(1) + '%';
    star.style.top = (y * 100).toFixed(1) + '%';
    star.style.setProperty('--sz', span(...size).toFixed(1) + 'px');
    star.style.setProperty('--tw', span(...tw).toFixed(2) + 's');
    star.style.animationDelay = (-Math.random() * 3).toFixed(2) + 's'; // desync the twinkle
    wrap.appendChild(star);
    placed++;
  }
  return wrap;
}

/* UR aftermath — a breathing aura behind the card that sheds small motes.
   The aura sits BEHIND the card, so both it and everything it emits are only
   ever visible in the margin: the motes can't crowd the stars on the face (the
   earlier rising-embers version did, which is what made the two dot-fields read
   as noise) and nothing drifts across the avatar. Motes spawn on the card's
   perimeter and drift outward along their own angle, so they look shed by the
   card rather than sprinkled around it. */
/* Per-tier, because the two top tiers are shedding different things. UR is an
   ember throwing sparks, and a lot of them is what makes it read as burning.
   RUBY is a cut stone: what comes off it is the occasional glint, so the same
   field at the same density would just look like UR again with a red filter —
   the exact "recoloured UR" outcome the gem cut exists to avoid. */
const MOTE_COUNT = { UR: 50, RUBY: 14 };

function makeAura(rarity) {
  const wrap = document.createElement('div');
  wrap.className = 'aura';
  for (let i = 0; i < (MOTE_COUNT[rarity] ?? 50); i++) {
    const mote = document.createElement('i');
    mote.className = 'mote';
    const angle = Math.random() * Math.PI * 2;
    const spawn = 0.42 + Math.random() * 0.09; // out near the card's edge
    mote.style.left = (50 + Math.cos(angle) * spawn * 100).toFixed(1) + '%';
    mote.style.top = (50 + Math.sin(angle) * spawn * 100).toFixed(1) + '%';
    const dist = 24 + Math.random() * 44;
    mote.style.setProperty('--tx', (Math.cos(angle) * dist).toFixed(1) + 'px');
    /* Drift is outward along the spawn angle, minus a constant lift, so the
       field has some buoyancy instead of expanding like a perfect ring. */
    mote.style.setProperty('--ty', (Math.sin(angle) * dist - 12).toFixed(1) + 'px');
    mote.style.setProperty('--sz', (1.5 + Math.random() * 1.8).toFixed(1) + 'px');
    mote.style.setProperty('--float', (2.8 + Math.random() * 2.4).toFixed(2) + 's');
    mote.style.animationDelay = (1.5 + Math.random() * 4.5).toFixed(2) + 's';
    wrap.appendChild(mote);
  }
  return wrap;
}

function buildCell(result) {
  const rarity = result.card.rarity;
  const cell = document.createElement('div');
  cell.className = `reveal-cell glow-${rarity}`;

  const beam = document.createElement('div');
  beam.className = 'beam';
  cell.appendChild(beam);

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
  if (SWEPT.has(rarity)) {
    const sweep = document.createElement('div'); // one specular pass across the face
    sweep.className = 'sweep';
    front.appendChild(sweep);
  }
  if (STARS[rarity]) front.appendChild(makeStars(rarity));
  if (TOP_TIER.has(rarity)) {
    /* Top tier only — the ignition: a white-hot point races once around the
       frame bevel as the card lands, and the seam halo floods in behind it.
       This is the strike the card's ambient ember (`.card.r-UR`/`.r-RUBY`,
       *-ember) is the aftermath of. The <i> carries the spinning gradient; the
       wrapper is a static masked ring, so the ring itself never rotates — only
       the head appears to travel. Border-only by construction, so it never
       crosses the avatar. */
    const fuse = document.createElement('div');
    fuse.className = 'fuse';
    fuse.appendChild(document.createElement('i'));
    front.appendChild(fuse);
    /* The discharge and the aura both go on the CELL rather than the face:
       behind the card, so they read as the silhouette pushing outward and never
       wash over the avatar the way a full-face tint would. The bloom fires as
       the fuse closes its loop; the aura settles in behind it and stays. */
    const bloom = document.createElement('div');
    bloom.className = 'bloom';
    cell.append(bloom, makeAura(rarity));
  }
  inner.append(back, front);
  flipEl.appendChild(inner);
  cell.appendChild(flipEl);

  cellResults.set(cell, result);
  revealGrid.appendChild(cell);
  return { cell, rarity };
}

/* Turn one card. The sweep, seam glow and stars all live in the front face /
   CSS on .flipped; here we only flip. The guard makes a later scheduled flip
   (after an early click) a no-op.

   The turn is also what makes a cell an inspectable thing, so the button
   semantics are granted here rather than at build time: face-down, the card has
   no identity to announce and naming it would hand a screen-reader user the
   rarity the flip exists to withhold. */
function flip(cell) {
  if (cell.classList.contains('flipped')) return;
  cell.classList.remove('beaming');
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
