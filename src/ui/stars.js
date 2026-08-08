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
   UR hot amber, RUBY cold diamond-white with a red cast. */
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
