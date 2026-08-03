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
   rarity still read, but nothing MOVED. This drives the same --px/--py/--mx/
   --my contract pointermove already feeds, so nothing downstream needed to
   change — only how the numbers are produced.

   SCOPE, DELIBERATELY NARROW. Only wired into the reveal overlay and the
   inspector (reveal.js, inspect.js) — both are full-screen, non-scrolling
   moments where continuous tilt reads as picking the card up. The collection
   grid is scrolling content shared across many cards at once; motion tied to
   phone orientation there would be constant background movement competing
   with the scroll, untested at 40+ cards, and was deliberately left out.

   THE FIRST ATTEMPT USED `DeviceOrientationEvent` (beta/gamma) and it read as
   "automatically swiveling too much" on a real phone. That is a known property
   of beta/gamma, not a tuning miss: they are EULER ANGLES, decomposed from the
   device's raw rotation, and Euler decomposition is numerically unstable near
   certain orientations — specifically near-vertical, which is exactly how a
   phone is held to look at its own screen. A tiny real tilt there can produce
   a large, erratic swing in gamma. That is likely the actual "swiveling":
   not over-sensitivity, but the representation itself.

   THIS VERSION USES THE RAW GYROSCOPE INSTEAD — `DeviceMotionEvent.
   rotationRate`, angular VELOCITY around each axis, deg/s. There is no
   decomposition step and no singularity: it is a direct sensor reading, so the
   near-vertical instability above cannot occur. The cost of a raw gyro is
   drift — integrating velocity into an angle accumulates error with no
   absolute reference, so a naive integration would slowly wander off-center
   forever. Countered with a continuous SPRING-RETURN term that pulls the
   accumulated angle back toward zero every frame, so it self-corrects instead
   of drifting, and reads as "the card wants to lie flat" rather than "the tilt
   is broken."

   SMOOTHNESS IS A HARD GUARANTEE, not a tuning choice. Whatever the sensor
   reports — a sudden flick, a glitchy single-frame spike — the value actually
   painted to the card can only move at a capped rate per frame (MAX_RATE
   below). That bounds the visible motion regardless of how violent or jerky
   the real rotation is; it is a mathematical clamp, not a hope that the
   filtering is aggressive enough.

   iOS GATES MOTION SENSORS BEHIND A PROMPT. Safari and Chrome-on-iOS require
   `DeviceMotionEvent.requestPermission()`, callable only from inside a
   user-gesture handler (a click), and that grant covers deviceorientation too
   — Apple treats motion and orientation as one permission bucket. That is why
   `enableDeviceTilt` is called from inside `openReveal`/`openInspect`
   themselves rather than once at import time the way `enableCardTilt` is:
   both are already gesture-triggered (tapping the pack, tapping a card), so
   the first use of either doubles as the gesture the prompt needs. Android
   does not gate this at all. */

const MOTION_MAX_DEG = 24;     // accumulated relative angle for the full effect
const RETURN_RATE = 1.4;       // per-second spring-back toward centre — undoes gyro drift
const MAX_RATE = 3.0;          // hard cap, in -1..1 units per second, on the PAINTED value
const MAX_DT = 0.1;            // clamp a stalled/backgrounded gap so one frame can't over-integrate

/* ── THE MAPPING, made explicit ─────────────────────────────────────────────
   First real-hardware feedback: "very simplistic," with a specific fix
   requested — tilting the phone should read as a physical foil card catching
   an overhead light, where the edge tilted NEARER the viewer is the edge that
   lights up, on both axes independently:

     tilt the TOP of the phone away from your face (leaning it back toward
       flat) -> the BOTTOM is now the near edge -> highlight moves to the
       BOTTOM. Tilt the top toward your face -> highlight moves to the TOP.
     roll the phone so its LEFT edge dips away -> the RIGHT is now the near
       edge -> highlight moves RIGHT. Roll the other way -> highlight LEFT.

   Vertical corresponds to rotation around the phone's left-right axis (beta);
   horizontal to rotation around its up-down axis (gamma) — that part follows
   directly from which physical rotation each measures. What does NOT follow
   from anything checkable offline is which SIGN of rotationRate corresponds
   to "top away" vs "top toward": that depends on the sensor's own convention,
   verifiable only on real hardware.

   FLIP_VERTICAL / FLIP_HORIZONTAL are that one remaining unknown, isolated to
   a single multiplier each. If tilting the top away moves the highlight UP
   instead of DOWN, flip FLIP_VERTICAL to -1. If rolling left moves the
   highlight LEFT instead of RIGHT, flip FLIP_HORIZONTAL to -1. Independent of
   each other and of everything else here — neither touches smoothness,
   sensitivity, or the other axis. */
const FLIP_VERTICAL = 1;
const FLIP_HORIZONTAL = 1;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* Cached at module scope: the permission prompt must only ever fire once per
   session (repeat calls resolve instantly to whatever was already decided),
   and every overlay open calls this idempotently rather than tracking for
   itself whether it already asked. */
let motionPermission = null;

function requestMotionPermission() {
  if (motionPermission) return motionPermission;
  const gate = typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission;
  motionPermission = !gate
    ? Promise.resolve(typeof DeviceMotionEvent !== 'undefined' ? 'granted' : 'unsupported')
    : gate.call(DeviceMotionEvent).then(r => r === 'granted' ? 'granted' : 'denied').catch(() => 'denied');
  return motionPermission;
}

export function enableDeviceTilt(root) {
  // Idempotent per root: openReveal/openInspect call this on every open, but
  // the underlying listener — once actually attached — stays valid forever,
  // re-querying `.card` fresh on every reading, so it only needs binding once.
  if (!root || root.dataset.deviceTiltBound) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!matchMedia('(hover: none)').matches) return; // fine pointers use enableCardTilt instead
  if (typeof DeviceMotionEvent === 'undefined') return;

  root.dataset.deviceTiltBound = 'true';

  requestMotionPermission().then(state => {
    if (state !== 'granted') return; // declined or unsupported: keep the static CSS finish

    let angleX = 0, angleY = 0;    // accumulated relative angle (degrees), starts centred
    let curX = 0, curY = 0;        // the value actually painted, rate-limited toward the angle
    let lastMotionAt = null;
    let lastPaintAt = null;
    let raf = null;

    function schedule() {
      if (!raf) raf = requestAnimationFrame(paint);
    }

    function paint(now) {
      raf = null;
      const dt = clamp(((now ?? performance.now()) - (lastPaintAt ?? now)) / 1000, 0, MAX_DT);
      lastPaintAt = now ?? performance.now();

      const targetX = clamp(angleX / MOTION_MAX_DEG, -1, 1);
      const targetY = clamp(angleY / MOTION_MAX_DEG, -1, 1);
      // THE GUARANTEE: curX/curY move toward the target no faster than
      // MAX_RATE per second, full stop — not an ease that merely tends toward
      // smooth, a clamp that makes a snap structurally impossible.
      const step = MAX_RATE * dt;
      curX += clamp(targetX - curX, -step, step);
      curY += clamp(targetY - curY, -step, step);

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
      // Keep animating while EITHER the target hasn't been reached (rate-
      // limited catch-up in progress) OR the accumulated angle itself is
      // still relaxing toward zero (the spring-return, which runs even once
      // curX has caught up to a momentarily-still target).
      if (Math.abs(targetX - curX) > 0.0008 || Math.abs(targetY - curY) > 0.0008 ||
          Math.abs(angleX) > 0.05 || Math.abs(angleY) > 0.05) {
        schedule();
      }
    }

    addEventListener('devicemotion', e => {
      const r = e.rotationRate;
      if (!r || r.beta === null || r.gamma === null) return;

      const now = performance.now();
      const dt = clamp((now - (lastMotionAt ?? now)) / 1000, 0, MAX_DT);
      lastMotionAt = now;

      // Integrate angular velocity into a relative angle, then immediately pull
      // it back toward zero — the spring-return that keeps a pure gyro
      // integration from drifting away over a long session. Left as two
      // separate steps rather than folded into one constant because they
      // answer different questions: how far did it just turn, and how eager
      // is it to settle back to flat.
      angleX = clamp(angleX + FLIP_HORIZONTAL * r.gamma * dt, -90, 90);
      angleY = clamp(angleY + FLIP_VERTICAL * r.beta * dt, -90, 90);
      angleX -= angleX * RETURN_RATE * dt;
      angleY -= angleY * RETURN_RATE * dt;

      schedule();
    });
  });
}
