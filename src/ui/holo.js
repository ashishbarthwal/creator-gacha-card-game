/* ui/holo — the WP3 pointer tilt + poke-holo shine, and its phone counterpart.
   Purely presentational: both write the same CSS custom properties the card's
   own rules read (--px/--py for tilt, --mx/--my for shine position) and toggle
   the same .lit class, so styles.css has exactly one consumer contract
   regardless of which input drove it — the rarity gating and every visual
   value live there (the three --*-strength / --tilt-max properties).

   Bound by delegation on a container, so either survives its contents being
   re-rendered (the collection grid re-rendering cards; the reveal grid and
   inspector wiping and rebuilding their card(s) on every open). */

export function enableCardTilt(root) {
  if (!root) return;
  // Coarse pointers can't hover-track; reduced-motion opts out of tilt/shine.
  // Both cases are handled statically in CSS, so we simply don't bind here.
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let lit = null;
  const clear = () => {
    if (lit) { lit.classList.remove('lit'); lit = null; }
  };

  root.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.card');
    if (!card || !root.contains(card)) { clear(); return; }
    if (card !== lit) { clear(); lit = card; card.classList.add('lit'); }

    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;   // 0..1 across the card
    const py = (e.clientY - r.top) / r.height;   // 0..1 down the card
    card.style.setProperty('--px', ((px - 0.5) * 2).toFixed(3)); // -1..1 for tilt
    card.style.setProperty('--py', ((py - 0.5) * 2).toFixed(3));
    card.style.setProperty('--mx', (px * 100).toFixed(1) + '%'); // shine position
    card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
  });

  root.addEventListener('pointerleave', clear);
}

/* Device-tilt (gyroscope-driven rotation on phones) existed here through WP10
   and was removed 2026-08-07 — Ash's call, after it read as inconsistent
   across real hardware: the spring-return/rate-clamp scheme this file used to
   contain smoothed the motion but couldn't correct for how differently phones
   report `DeviceMotionEvent.rotationRate` in the first place, so the same tilt
   felt right on one device and wrong on another. That is a hardware-variance
   problem, not a tuning one, so there is no constant in this file that fixes
   it — removing the mechanism does.

   Touch is a mouse-hover surrogate everywhere else in this file (enableCardTilt
   above already gates on `pointer: fine`, so it was never bound on a phone to
   begin with), and it stays that way: mobile keeps the holo finish through the
   plain CSS fallback at `@media (hover: none)` in styles.css, which sets each
   rarity's shine to a fixed half-strength with no JS, no motion permission
   prompt, and nothing that can disagree between two phones. Rarity still
   reads; nothing moves. That was already true for touch devices that declined
   or didn't support the old motion prompt — it is now true for all of them. */
