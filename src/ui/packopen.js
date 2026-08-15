/* ui/packopen — the missing beat: the pack actually opening.

   ── WHY THIS EXISTS ───────────────────────────────────────────────────────
   N3TWORK's card-reveal choreography breaks a pull into six stages, and this
   app already had five of them: the gesture (the pack IS the button), the
   per-card preview (the rarity beam), the reveal apex (the escalated flip),
   the contemplation (click a card to inspect) and the return. The one it
   skipped was stage two, the SUMMON — the moment between pressing the pack
   and seeing the cards. Pressing the pack cut straight to a grid of card
   backs, which is the single mistake that article names first: the payment
   and the payoff with no anticipation in between.

   So this is a ~1s bridge, and it is deliberately a bridge rather than a
   feature. The same source is blunt that an over-long summon is worse than
   none at all ("if users skip it, it is too long or boring"), which is why
   every path here is skippable on any input and why the whole thing is
   shorter than the flip sequence it introduces.

   ── THE PACK-LEVEL RARITY TEASE, AND WHAT IT TRADES ───────────────────────
   The charge colours itself, shakes harder and holds longer for the BEST card
   in the pull. That is a real trade against ui/reveal.js's stated rule that
   rarity stays hidden until a card turns — and it is the trade Hearthstone,
   FGO and every pack opener worth copying makes on purpose, because the two
   secrets are not the same secret. Knowing "something good is in here" is
   what makes the flip sequence tense; knowing WHICH of the ten it is would be
   what spoils it, and that is still withheld. The per-card beam keeps doing
   its job, now with a reason to care about it.

   Commons get a short, brisk charge for the same article's other warning:
   dressing up a bad pull as a big one is how you manufacture a letdown.

   ── HOW IT CONNECTS TO THE PACK ON THE PAGE ───────────────────────────────
   A FLIP transition. The overlay's pack is placed exactly over the real one in
   the banner, then released on the next frame so it travels to the centre of
   the screen under its own transition. Without it the overlay reads as a cut
   to a different screen; with it, the object the player pressed is the object
   that opens. Costs one getBoundingClientRect and no per-frame work.

   Everything animates on transform/opacity only, so it stays on the
   compositor — same discipline as the ambient hero layer and the reveal FX. */

import { RARITY_ORDER } from '../engine/core.js';

const el = document.getElementById('packopen');
const stage = document.getElementById('po-stage');
const packEl = document.getElementById('po-pack');
const streaksEl = document.getElementById('po-streaks');

const REDUCE_MOTION = matchMedia('(prefers-reduced-motion: reduce)');

/* How long the charge holds before the burst, per best-in-pull rarity. The
   curve is the point: a pull of commons is over almost before it registers,
   and a RUBY is made to wait. These are the tension knob and the only numbers
   here worth tuning by feel. */
const CHARGE_MS = { N: 240, R: 300, SR: 420, SSR: 560, UR: 700, RUBY: 820 };

/* The FLIP travel from the banner pack to centre stage. Long enough to read as
   the same object moving, short enough not to be the slow part. */
const DRAW_MS = 400;

/* Burst to hand-off. The reveal opens while the shockwave is still expanding
   rather than after it settles — an overlap reads as one continuous motion,
   where waiting for every animation to finish reads as two screens in a
   queue. */
const BURST_TO_REVEAL_MS = 360;

/* Long enough for the rings to finish under the reveal that replaced them. */
const TEARDOWN_MS = 900;

/* How long before a press counts as "skip" rather than as the tail of the press
   that opened the pack. See the note on skipArm below — this is the whole fix
   for a sequence that would otherwise cancel itself on a keyboard activation. */
const SKIP_ARM_MS = 220;

const bestRarity = results => RARITY_ORDER[
  Math.max(0, ...(results ?? []).map(r => RARITY_ORDER.indexOf(r?.card?.rarity)))
] ?? 'N';

let timers = [];
/* Bumped on every open and teardown, so a sequence the player skipped can
   never have a stale timer fire into the next one. Same generation-counter
   discipline as ui/battle.js's readyGen, for the same reason. */
let gen = 0;

const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
const at = (fn, ms) => timers.push(setTimeout(fn, ms));

/* The cards leaving the pack. Card-shaped rather than generic sparks, because
   the thing being disgorged is cards — a radial spray of glowing dots is the
   same animation any app could have. Angles are spread evenly with a small
   jitter so the fan looks thrown rather than compass-drawn. */
function buildStreaks(count) {
  streaksEl.replaceChildren();
  const n = Math.max(3, Math.min(count, 10));
  for (let i = 0; i < n; i++) {
    const streak = document.createElement('i');
    streak.className = 'po-streak';
    const spread = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist = 190 + Math.random() * 170;
    streak.style.setProperty('--sx', `${(Math.cos(spread) * dist).toFixed(1)}px`);
    streak.style.setProperty('--sy', `${(Math.sin(spread) * dist * 0.72).toFixed(1)}px`);
    streak.style.setProperty('--sr', `${(Math.random() * 80 - 40).toFixed(1)}deg`);
    streak.style.setProperty('--sd', `${(Math.random() * 90).toFixed(0)}ms`);
    streaksEl.append(streak);
  }
}

/* Put the overlay's pack exactly where the real one is sitting, as a transform
   off its own centred resting place. Returns false when the banner pack is not
   measurable (hidden, or the layout has not settled), in which case the pack
   simply starts centred — a slightly plainer opening, never a broken one. */
function anchorToBannerPack() {
  const source = document.getElementById('pack-open');
  if (!source) return false;
  const from = source.getBoundingClientRect();
  if (!from.width || !from.height) return false;
  const to = packEl.getBoundingClientRect();
  if (!to.width || !to.height) return false;

  const dx = (from.left + from.width / 2) - (to.left + to.width / 2);
  const dy = (from.top + from.height / 2) - (to.top + to.height / 2);
  const scale = from.width / to.width;

  packEl.style.transition = 'none';
  packEl.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
  /* Force the browser to accept that transform as the starting state before
     the class change below asks it to animate away from it. Without the
     reflow both style writes coalesce and there is nothing to transition
     from — the pack just appears centred. */
  void packEl.offsetWidth;
  packEl.style.transition = '';
  packEl.style.transform = '';
  return true;
}

/* Resolves when the reveal should take over. Never rejects: this is a
   decoration in front of a pull that has ALREADY happened — the cards are
   drawn, banked and persisted before this runs — so there is no failure here
   that should be able to cost a player their pull. Anything unexpected
   resolves immediately and the reveal opens, which is exactly the
   reduced-motion path. */
export function playPackOpen(results) {
  clearTimers();
  const mine = ++gen;

  if (REDUCE_MOTION.matches || !el || !stage || !packEl || !streaksEl) {
    return Promise.resolve();
  }

  const rarity = bestRarity(results);
  buildStreaks(results?.length ?? 1);

  el.className = `po-tier-${rarity}`;
  el.hidden = false;
  stage.classList.remove('is-charging', 'is-burst');

  const anchored = anchorToBannerPack();

  return new Promise(resolve => {
    let settled = false;
    /* `skipped` splits the two ways this ends. Run to completion and the
       overlay lingers so its shockwave finishes under the reveal that replaced
       it; skipped and it goes at once, because someone who just pressed to hurry
       it along should not have it still fading behind their cards. */
    const finish = skipped => {
      if (settled || mine !== gen) return;
      settled = true;
      detachSkip();
      teardown(mine, skipped);
      resolve();
    };

    /* SKIPPABLE ON ANY INPUT, and this is not a courtesy — it is the mitigation
       for the one failure mode the choreography research names. A player who
       has seen this sixty times wants their cards, and an unskippable second is
       how a flourish becomes an obstacle. Capture phase so nothing downstream
       can swallow the press. */
    const SKIP_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    const onSkip = () => finish(true);
    const detachSkip = () => {
      for (const evt of SKIP_EVENTS) document.removeEventListener(evt, onSkip, { capture: true });
    };
    /* ARMED LATE, ON PURPOSE. The input that opened the pack is still being
       dispatched while this runs: a keyboard activation is `keydown` then
       `click`, and holding Enter repeats `keydown` throughout. Listening
       immediately would let the press that STARTED the sequence also end it,
       which reads as the animation being broken rather than skipped. */
    const skipArm = setTimeout(() => {
      if (mine !== gen || settled) return;
      for (const evt of SKIP_EVENTS) {
        document.addEventListener(evt, onSkip, { capture: true, passive: true });
      }
    }, SKIP_ARM_MS);
    timers.push(skipArm);

    /* Next frame, so the anchored transform above is the state being animated
       away from rather than a style write the browser folds into this one. */
    requestAnimationFrame(() => {
      if (mine !== gen) return;
      stage.classList.add('is-charging');
    });

    const draw = anchored ? DRAW_MS : 120;
    at(() => {
      if (mine !== gen) return;
      /* SWAPPED, not stacked. Leaving `is-charging` on would leave the rumble
         keyframes running, and a running animation outranks a plain declaration
         in the cascade whatever the specificity — so the shake would keep
         overwriting the burst's own transform and the front card would jitter
         in place instead of punching forward. Removing the class ends the
         animation, which is the only thing that reliably yields the transform
         back to the burst rules. */
      stage.classList.remove('is-charging');
      stage.classList.add('is-burst');
    }, draw + (CHARGE_MS[rarity] ?? CHARGE_MS.N));

    /* Explicit `false` rather than passing `finish` straight to setTimeout:
       the timer would call it with no argument, which happens to mean the same
       thing today and would silently stop meaning it the moment the signature
       grows a second parameter. */
    at(() => finish(false), draw + (CHARGE_MS[rarity] ?? CHARGE_MS.N) + BURST_TO_REVEAL_MS);
  });
}

/* Hide after the reveal has had time to cover it, so the overlay's own rings
   and flash finish underneath rather than being cut mid-expansion — unless the
   player skipped, in which case they have asked for exactly the opposite. */
function teardown(mine, skipped = false) {
  clearTimers();
  const hide = () => {
    if (mine !== gen) return;
    el.hidden = true;
    stage.classList.remove('is-charging', 'is-burst');
    streaksEl.replaceChildren();
  };
  if (skipped) return hide();
  at(hide, TEARDOWN_MS);
}

/* Called when a pull is abandoned or the page moves on — the reveal closing
   does not need this (the overlay is already gone by then), but a second pull
   landing mid-sequence does. */
export function cancelPackOpen() {
  gen++;
  clearTimers();
  if (el) el.hidden = true;
  if (stage) stage.classList.remove('is-charging', 'is-burst');
}
