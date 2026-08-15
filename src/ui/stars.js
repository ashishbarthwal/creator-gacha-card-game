/* ui/stars — the twinkling star sparkle field, shared by the pull reveal
   (reveal.js) and the mobile admire screen (inspect.js). Split out so both
   can build the same field without one importing the other — reveal.js
   already imports openInspect from inspect.js, so the reverse import would
   be circular.

   Positions + per-star timing/size are randomised in JS (inline styles), so
   they dodge the avatar circle; the twinkle itself is a CSS animation
   (styles.css, `.star`), so there's no per-frame JS. */

/* Twinkling stars, starting at SR: a sparse small shimmer there, the dense
   quick field at SSR, a little denser again at UR, denser still at RUBY.
   Ranges are [min, max] — count, dot size (px), twinkle period (s). Tint is
   per-tier in CSS and follows the frame, so SR reads gold, SSR cold diamond,
   UR electric violet, RUBY cold diamond-white with a red cast. */
export const STARS = {
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

/* Avatar exclusion in card-relative fractions (the ringed centrepiece), so
   stars never land on the pfp. y is scaled by the 5:7 aspect for a round check. */
const AV = { cx: 0.5, cy: 0.45, r: 0.33 };
const ASPECT = 7 / 5;

/* Scatter twinkling stars over a card, rejecting any that fall inside the
   avatar circle. The wrap carries its own `glow-<rarity>` class (rather than
   relying on an ancestor to carry it, which is all reveal.js's `.reveal-cell`
   used to provide) so it tints correctly wherever it's dropped in — the pull
   reveal's flip cell or the admire screen's card, no ancestor markup assumed.
   Returns null for a rarity with no star field (N/R). */
export function makeStars(rarity) {
  const cfg = STARS[rarity];
  if (!cfg) return null;
  const { count, size, tw } = cfg;
  const span = (lo, hi) => lo + Math.random() * (hi - lo);
  const wrap = document.createElement('div');
  wrap.className = `stars glow-${rarity}`;
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

/* ── THE POINT TWINKLE (2026-08-16) ─────────────────────────────────────────
   A handful of pinpoints that flash and go dark again, each on its own 1-3s
   cycle. Built for UR first — Ash's spec, and every clause of it was a
   restriction rather than a feature: points only (no four-point sparkles —
   those are RUBY's own glints, so the two tiers must not converge on the same
   shape), sides only, intermittent rather than continuous. RUBY earned the
   same face effect the same day ("the inside the card twinkles look gorgeous
   in UR, add that to Ruby as well") — it inherits every word of the reasoning
   below, just at a lower count (see `renderCard` in card.js), because RUBY's
   own design principle everywhere else in this file is "fewer, larger,
   slower" (compare `STARS.RUBY` above) and this effect should not be the one
   place that principle is dropped.

   WHY THE SIDES. `makeStars` above scatters over the whole face and has to
   reject anything landing on the avatar; this one never needs that test,
   because the bands it draws in are outside the avatar circle by construction.
   It also leaves the middle of the card — the face, the name, the two stats —
   completely alone, which is what lets it run FOREVER on a card sitting in the
   binder without becoming something you have to read past.

   WHY IT IS CHEAP, stated because the pack-opening lag pass on this same day
   was caused by forgetting it: eight 2px elements animating `opacity` and
   `transform` only. No mask, no clip, no filter, no blur, nothing that forces
   a rasterisation — the three things that actually cost frames. Positions are
   written once as inline styles at build time, so there is no per-frame JS at
   all; the flash itself is a CSS animation (`.pt-twinkle` in styles.css).

   THE CYCLE IS MOSTLY DARKNESS, which is what makes "every 1-3 seconds" true
   rather than "shimmering constantly". The keyframes spend ~26% of each cycle
   flashing and the rest at zero opacity, so at a 1-3s duration a given point
   is lit for roughly a quarter of a second and absent for the rest. Negative
   delays start each one mid-cycle so they never fire in unison — the same
   desync trick `makeStars` uses one function up. */
const EDGE_TWINKLES = 8;                 // UR's own count, the default below
const EDGE_BAND = [0.025, 0.075];        // how far in from an edge a point may sit
const EDGE_SPAN = [0.10, 0.90];          // vertical range, keeping clear of the corners

export function makeEdgeTwinkles(count = EDGE_TWINKLES) {
  const span = (lo, hi) => lo + Math.random() * (hi - lo);
  const wrap = document.createElement('div');
  wrap.className = 'pt-twinkles';
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('i');
    dot.className = 'pt-twinkle';
    /* Alternating rather than randomised sides, so a low count cannot happen
       to land seven points on one edge and one on the other. */
    const inset = span(...EDGE_BAND);
    dot.style.left = ((i % 2 === 0 ? inset : 1 - inset) * 100).toFixed(1) + '%';
    dot.style.top = (span(...EDGE_SPAN) * 100).toFixed(1) + '%';
    dot.style.setProperty('--tw-size', span(1.5, 3).toFixed(1) + 'px');
    dot.style.setProperty('--tw-dur', span(1, 3).toFixed(2) + 's');
    dot.style.animationDelay = (-Math.random() * 3).toFixed(2) + 's';
    wrap.appendChild(dot);
  }
  return wrap;
}

/* ── THE FRAME TWINKLE (2026-08-16) ──────────────────────────────────────────
   UR's second request the same day: "twinkling in the card edges as well…
   like we have in RUBY tier" — RUBY's frame already catches light (the two
   crossed-ellipse glints on `.card.r-RUBY::after`, plus the travelling
   `.gem-edge` sheen in the inspector). UR had nothing on ITS frame; the
   function above lives on the FACE, just inside the bevel, not on it.

   NOT A COPY OF RUBY'S SHAPE, on purpose — same reason the face effect stayed
   point-only: RUBY's identity is the four-point glint a cut stone throws, and
   putting that same shape on UR's frame would make the two top tiers read as
   recolours of each other, exactly the outcome every other RUBY-vs-UR comment
   in this codebase works to avoid. So this stays a POINT, the same shape and
   the same flash as the face twinkle above, just walked around the BEVEL
   instead of scattered near it — the same vocabulary the pack tease and the
   holo finish already use to say "this is UR's language, not RUBY's".

   WHY A PERIMETER WALK RATHER THAN "LEFT/RIGHT LIKE THE FACE ONE". The face
   twinkle stays sides-only deliberately (see above) because the top and
   bottom bevel is where the badge, title and stat boxes sit closest to the
   edge — a point wandering there risks landing under a corner where the
   bevel is narrower and would clip. The metal FRAME has no such content on
   it anywhere around its own loop, so there is no reason to withhold the top
   and bottom band the way the face effect withholds the interior.

   ONE PERCENTAGE BAND, NOT FOUR. The bevel is only `clamp(3px, 1.7cqw, 6px)`
   wide (.card's own padding) — a couple of percent of the card's box at most
   sizes — so `FRAME_INSET` sits inside that whether the card is a 104px arena
   thumbnail or a 340px inspector hero; going further in would land on
   `.card-inner`'s opaque face and vanish. Positioned as a sibling of
   `.card-inner`, never a child of it — `.card-inner` is inset by the padding
   and has nothing painted in the band this walks, so no z-index game is
   needed the way RUBY's ::after needs one to stay under its own face. */
const FRAME_TWINKLES = 6;
const FRAME_INSET = 1.6;   // % from the card's own edge — inside the bevel, never past it

/* Walks the perimeter clockwise from the top-left corner as t: 0..1, holding a
   fixed distance from the nearest edge throughout — the same idea as
   inspect.js's `bandPoint`, kept as its own small copy here rather than an
   import so this file stays a leaf module (nothing here imports anything,
   and inspect.js already imports FROM stars.js — the reverse would cycle). */
function bevelPoint(t) {
  t = ((t % 1) + 1) % 1;
  const near = FRAME_INSET, far = 100 - FRAME_INSET;
  const leg = t * 4;
  if (leg < 1) return { x: near + (far - near) * leg, y: near };
  if (leg < 2) return { x: far, y: near + (far - near) * (leg - 1) };
  if (leg < 3) return { x: far - (far - near) * (leg - 2), y: far };
  return { x: near, y: far - (far - near) * (leg - 3) };
}

export function makeFrameTwinkles(count = FRAME_TWINKLES) {
  const span = (lo, hi) => lo + Math.random() * (hi - lo);
  const wrap = document.createElement('div');
  wrap.className = 'pt-twinkles';
  for (let i = 0; i < count; i++) {
    /* Evenly spaced around the loop, jittered within its own slice, so `count`
       points never bunch on one edge and leave another bare. */
    const { x, y } = bevelPoint((i + span(0.15, 0.85)) / count);
    const dot = document.createElement('i');
    dot.className = 'pt-twinkle';
    dot.style.left = x.toFixed(1) + '%';
    dot.style.top = y.toFixed(1) + '%';
    dot.style.setProperty('--tw-size', span(1.3, 2.6).toFixed(1) + 'px');
    dot.style.setProperty('--tw-dur', span(1, 3).toFixed(2) + 's');
    dot.style.animationDelay = (-Math.random() * 3).toFixed(2) + 's';
    wrap.appendChild(dot);
  }
  return wrap;
}
