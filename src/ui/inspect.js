/* ui/inspect — click a collection card to admire it large.
   A centered overlay over a blurred backdrop, holding one enlarged card with
   the same pointer tilt + holo finish enabled, so the card can be turned in
   the light. Self-contained close wiring (button, backdrop click, Escape),
   and it restores focus to whatever opened it. main just imports nothing —
   collection.js calls openInspect. */

import { renderCard } from './card.js';
import { enableCardTilt } from './holo.js';

/* A point somewhere on the card's frame band, as a `background-position` pair.
   `u` walks the perimeter as 0..4 (one unit per edge, clockwise from the top
   left); callers pass one `u` per sparkle drawn from its own quarter-ish of
   the loop, so the six never bunch up on one edge. The 1.5%/98.5% insets keep
   a point on the band itself — the card face is opaque and would swallow
   anything further in. */
function bandPoint(u) {
  u = ((u % 4) + 4) % 4;
  const near = 1.5, far = 98.5;
  if (u < 1) return `${(near + (far - near) * u).toFixed(1)}% ${near}%`;
  if (u < 2) return `${far}% ${(near + (far - near) * (u - 1)).toFixed(1)}%`;
  if (u < 3) return `${(far - (far - near) * (u - 2)).toFixed(1)}% ${far}%`;
  return `${near}% ${(far - (far - near) * (u - 3)).toFixed(1)}%`;
}

/* Re-rolls where the six sparkles sit and where the travelling sheen starts.
   Called on open and again on every hover, so a card never twinkles in the
   same places twice. The sparkles are spread one per sixth of the perimeter
   and then jittered within it; the sheen just takes a random offset applied
   to every angle in its keyframes. */
function placeRubyEffects(cardEl) {
  const slots = ['a', 'b', 'c', 'd', 'e', 'f'];
  const order = slots.map((_, i) => (i + Math.random()) * (4 / slots.length));
  for (let i = order.length - 1; i > 0; i--) {          // shuffle, so slot->edge
    const j = Math.floor(Math.random() * (i + 1));       // pairing varies too
    [order[i], order[j]] = [order[j], order[i]];
  }
  slots.forEach((s, i) => cardEl.style.setProperty(`--tw-${s}`, bandPoint(order[i])));
  cardEl.style.setProperty('--edge-spin', `${(Math.random() * 360).toFixed(1)}deg`);
}

const inspectEl = document.getElementById('inspect');
const inspectHolder = document.getElementById('inspect-holder');
const inspectClose = document.getElementById('inspect-close');
let lastTrigger = null;

/* Delegated on the persistent holder, so it keeps working as the card inside
   is swapped out on each open. */
enableCardTilt(inspectHolder);

export function openInspect(card, meta = {}) {
  lastTrigger = document.activeElement;
  inspectHolder.innerHTML = '';
  const cardEl = renderCard(card, meta);
  /* The travelling edge light (styles.css, `.gem-edge`) needs a real element:
     it ROTATES, and both of the card's own pseudo-elements are already spoken
     for by layers that must stay put. Added here rather than in card.js so the
     pull screen's markup is untouched — this is an admire-screen flourish, and
     the module that owns the admire screen is the one that should own it.
     Prepended, so it sits below `.card-inner` in paint order and can only ever
     show on the frame band. */
  if (card.rarity === 'RUBY') {
    const edge = document.createElement('i');
    edge.className = 'gem-edge';
    edge.setAttribute('aria-hidden', 'true');
    cardEl.prepend(edge);
    /* Both effects loop from a burst at 0%, so their FIRST frame is a
       twinkle — building the card here is all it takes to fire them the
       moment the admire screen appears. No delay is applied for the same
       reason: a delay would postpone exactly the burst we want immediately.
       Per-open variety comes from the cycle LENGTH instead, which shifts the
       two effects' beat against each other without touching frame zero. */
    cardEl.style.setProperty('--fx-dur', `${(16 + Math.random() * 4).toFixed(2)}s`);
    placeRubyEffects(cardEl);
    /* And again on hover — restarting an animation replays its first frame,
       so the same burst fires the instant the card lights up under the
       pointer. Positions are re-rolled first, while both animations are
       still suppressed by `.fx-restart`, so the new coordinates are already
       in place by the time the restarted loop paints frame zero — otherwise
       the sparkle would light at the old spot and jump. `pointerenter` rather
       than a holo.js hook: the tilt module writes only CSS custom properties
       and owns no event another module should be reaching into. */
    cardEl.addEventListener('pointerenter', () => {
      cardEl.classList.add('fx-restart');
      void cardEl.offsetWidth;   // flush the removal so re-adding counts as a change
      placeRubyEffects(cardEl);
      cardEl.classList.remove('fx-restart');
    });
  }
  inspectHolder.appendChild(cardEl);
  /* Gates the museum-display spotlight (styles.css, `.ruby-entrance`), which
     lives on `.inspect-box` rather than the card itself — that element is
     shared across every rarity, so it needs an explicit flag rather than a
     `.r-RUBY` descendant selector to stay out of every other tier's open.
     Everything else about the entrance (frame ignite, portrait fade-in, the
     twinkle and sheen bursts) is self-contained on the card element and needs
     no flag: it's a fresh DOM node every open, so its CSS animations just
     replay. */
  inspectEl.classList.toggle('ruby-entrance', card.rarity === 'RUBY');
  inspectEl.hidden = false;
  inspectClose.focus();
}

/* The reveal overlay can sit underneath this one, and both answer Escape — so
   it needs to be able to ask whether it is the top overlay before acting. */
export function isInspectOpen() {
  return !inspectEl.hidden;
}

export function closeInspect() {
  inspectEl.hidden = true;
  inspectHolder.innerHTML = '';
  if (lastTrigger?.focus) lastTrigger.focus();
  lastTrigger = null;
}

inspectClose.addEventListener('click', closeInspect);
inspectEl.addEventListener('click', e => { if (e.target === inspectEl) closeInspect(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !inspectEl.hidden) closeInspect(); });
