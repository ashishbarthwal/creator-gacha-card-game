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

/* ── Device-tilt: the phone IS the pointer ──────────────────────────────────
   A touch screen can't hover-track, so until now a phone only ever got the
   flat, muted, motionless fallback in styles.css's `hover: none` block —
   rarity still read, but nothing MOVED. `DeviceOrientationEvent` gives a phone
   the one input a mouse never had — you can physically turn it — and it maps
   onto the exact same --px/--py/--mx/--my contract pointermove already feeds,
   so nothing downstream needed to change.

   SCOPE, DELIBERATELY NARROW. Only wired into the reveal overlay and the
   inspector (reveal.js, inspect.js) — both are full-screen, non-scrolling
   moments where continuous tilt reads as picking the card up. The collection
   grid is scrolling content shared across many cards at once; motion tied to
   phone orientation there would be constant background movement competing
   with the scroll, untested at 40+ cards, and was deliberately left out.

   iOS GATES THIS BEHIND A PROMPT. Safari and Chrome-on-iOS both require
   `DeviceOrientationEvent.requestPermission()` — a promise that only resolves
   if called SYNCHRONOUSLY from within a user-gesture handler (a click), or the
   browser silently refuses. That is why `enableDeviceTilt` gets called from
   inside `openReveal`/`openInspect` themselves rather than once at import time
   the way `enableCardTilt` is: both are already invoked synchronously from a
   tap (opening a pack, tapping a card), so the very first time either overlay
   is used doubles as the gesture the permission prompt needs. Android does not
   gate this at all; the check below simply skips straight to listening. */

const MOTION_MAX_DEG = 18;  // degrees of tilt off the calibrated baseline = full effect
const SMOOTHING = 0.15;     // 0..1 per frame; lower = smoother and slower to catch up

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* Cached at module scope: the permission prompt must only ever fire once per
   session (repeat calls resolve instantly to whatever was already decided),
   and every overlay open calls this idempotently rather than tracking for
   itself whether it already asked. */
let motionPermission = null;

function requestMotionPermission() {
  if (motionPermission) return motionPermission;
  const gate = typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission;
  motionPermission = !gate
    ? Promise.resolve(typeof DeviceOrientationEvent !== 'undefined' ? 'granted' : 'unsupported')
    : gate.call(DeviceOrientationEvent).then(r => r === 'granted' ? 'granted' : 'denied').catch(() => 'denied');
  return motionPermission;
}

export function enableDeviceTilt(root) {
  // Idempotent per root: openReveal/openInspect call this on every open, but
  // the underlying listener — once actually attached — stays valid forever,
  // re-querying `.card` fresh on every reading, so it only needs binding once.
  if (!root || root.dataset.deviceTiltBound) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!matchMedia('(hover: none)').matches) return; // fine pointers use enableCardTilt instead
  if (typeof DeviceOrientationEvent === 'undefined') return;

  root.dataset.deviceTiltBound = 'true';

  requestMotionPermission().then(state => {
    if (state !== 'granted') return; // declined or unsupported: keep the static CSS finish

    let baseline = null;
    let targetX = 0, targetY = 0;  // latest normalized reading, -1..1
    let curX = 0, curY = 0;        // eased value actually painted
    let raf = null;

    function paint() {
      raf = null;
      curX += (targetX - curX) * SMOOTHING;
      curY += (targetY - curY) * SMOOTHING;
      // The overlay clears its contents on close but not until the NEXT open,
      // so a stray reading after close would otherwise keep painting hidden
      // cards — cheap to skip rather than let it run against nothing visible.
      if (!root.closest('[hidden]')) {
        const mx = ((curX * 0.5 + 0.5) * 100).toFixed(1) + '%';
        const my = ((curY * 0.5 + 0.5) * 100).toFixed(1) + '%';
        root.querySelectorAll('.card').forEach(card => {
          card.classList.add('lit');
          card.style.setProperty('--px', curX.toFixed(3));
          card.style.setProperty('--py', curY.toFixed(3));
          card.style.setProperty('--mx', mx);
          card.style.setProperty('--my', my);
        });
      }
      if (Math.abs(targetX - curX) > 0.0015 || Math.abs(targetY - curY) > 0.0015) {
        raf = requestAnimationFrame(paint);
      }
    }

    addEventListener('deviceorientation', e => {
      if (e.beta === null || e.gamma === null) return;
      // Calibrated to wherever the phone happens to be held when this first
      // fires, rather than an absolute angle — nobody holds a phone at a
      // textbook-neutral angle, and an absolute reading would leave the shine
      // permanently off-center for anyone who tilts naturally.
      if (!baseline) baseline = { beta: e.beta, gamma: e.gamma };
      targetX = clamp((e.gamma - baseline.gamma) / MOTION_MAX_DEG, -1, 1);
      targetY = clamp((e.beta - baseline.beta) / MOTION_MAX_DEG, -1, 1);
      if (!raf) raf = requestAnimationFrame(paint);
    });
  });
}
