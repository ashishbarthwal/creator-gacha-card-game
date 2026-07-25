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

const revealEl = document.getElementById('reveal');
const revealGrid = document.getElementById('reveal-grid');
const revealDone = document.getElementById('reveal-done');

let revealTimers = [];

const CARD_BACK_HTML =
  '<div class="back-rings"></div><div class="back-play"></div><div class="back-word">YOUTUBE GACHA</div>';

/* Per-rarity theatre. rank orders the sequence (rarer flips later, for a
   crescendo); beam is the pre-flip telegraph time (ms); hold is the pause after
   this card lands. Sweep, seam glow and stars are gated per rarity downstream. */
const FX = {
  N:   { rank: 0, beam: 0,    hold: 0   },
  R:   { rank: 1, beam: 200,  hold: 30  },
  SR:  { rank: 2, beam: 360,  hold: 200 },
  SSR: { rank: 3, beam: 600,  hold: 380 },
  UR:  { rank: 4, beam: 950,  hold: 650 },
};
const BASE_GAP = 115;      // gap between consecutive commons
const OPENING_BEAT = 300;  // let the overlay settle before the first flip

const SWEPT = new Set(['SR', 'SSR', 'UR']);   // get the specular sweep

/* Twinkling stars, now starting at SR: a sparse small shimmer there, the dense
   quick field at SSR, a little denser again at UR. Ranges are [min, max] —
   count, dot size (px), twinkle period (s). Tint is per-tier in CSS and follows
   the frame, so SR reads gold, SSR cold diamond, UR hot amber. */
const STARS = {
  SR:  { count: 18, size: [1.8, 3.4], tw: [1.8, 4.2] },
  SSR: { count: 22, size: [2.2, 5.2], tw: [1.1, 2.8] },
  UR:  { count: 26, size: [2.0, 4.4], tw: [1.1, 2.8] },
};

/* Avatar exclusion in card-relative fractions (the ringed centrepiece), so
   stars never land on the pfp. y is scaled by the 5:7 aspect for a round check. */
const AV = { cx: 0.5, cy: 0.45, r: 0.33 };
const ASPECT = 7 / 5;

export function openReveal(results) {
  revealTimers.forEach(clearTimeout);
  revealTimers = [];
  revealGrid.innerHTML = '';
  /* Pin the column count so a x10 is always 5-across; a scrollbar stealing
     width can't reflow it. Fewer cards use fewer columns. */
  revealGrid.style.setProperty('--reveal-cols', Math.min(results.length, 5));

  const cells = results.map(result => buildCell(result));

  revealEl.hidden = false;
  revealDone.focus();

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cells.forEach(({ cell }) => cell.classList.add('flipped'));
    return;
  }

  cells.forEach(({ cell }) => cell.addEventListener('click', () => flip(cell)));

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
const MOTE_COUNT = 50;

function makeAura() {
  const wrap = document.createElement('div');
  wrap.className = 'aura';
  for (let i = 0; i < MOTE_COUNT; i++) {
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
  if (rarity === 'UR') {
    /* UR only — the ignition: a white-hot point races once around the frame
       bevel as the card lands, and the seam halo floods in behind it. This is
       the strike the card's ambient ember (`.card.r-UR`, ur-ember) is the
       aftermath of. The <i> carries the spinning gradient; the wrapper is a
       static masked ring, so the ring itself never rotates — only the head
       appears to travel. Border-only by construction, so it never crosses the
       avatar. */
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
    cell.append(bloom, makeAura());
  }
  inner.append(back, front);
  flipEl.appendChild(inner);
  cell.appendChild(flipEl);

  revealGrid.appendChild(cell);
  return { cell, rarity };
}

/* Turn one card. The sweep, seam glow and stars all live in the front face /
   CSS on .flipped; here we only flip. The guard makes a later scheduled flip
   (after an early click) a no-op. */
function flip(cell) {
  if (cell.classList.contains('flipped')) return;
  cell.classList.remove('beaming');
  cell.classList.add('flipped');
}

export function closeReveal() {
  revealTimers.forEach(clearTimeout);
  revealTimers = [];
  revealEl.hidden = true;
}

revealDone.addEventListener('click', closeReveal);
revealEl.addEventListener('click', e => { if (e.target === revealEl) closeReveal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !revealEl.hidden) closeReveal(); });
