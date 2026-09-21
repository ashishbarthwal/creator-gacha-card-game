/* main — wiring only. Composes the pure core, the gacha engine, the data
   seam and the UI modules; holds nothing of its own but the pull glue. */

import { pull } from './engine/gacha.js';
import { marketingPull } from './engine/marketing-pull.js';
import { RARITY_ORDER } from './engine/core.js';
import { currentPool, addToCollection, persistCollection } from './state.js';
import { initBanner, packSize } from './ui/banner.js';
import { initCollection, renderCollection, notePulled, showBinder } from './ui/collection.js';
import { openReveal, initReveal } from './ui/reveal.js';
import { playPackOpen } from './ui/packopen.js';
import { openArena } from './ui/battle.js';
import { renderHeroShowcase } from './ui/hero-showcase.js';

let pullBusy = false;
let collectionDirty = false;
async function presentPull(results) {
  pullBusy = true;
  const controls = ['pack-open', 'pull-dev', 'pull-marketing'];
  controls.forEach(id => { document.getElementById(id).disabled = true; });
  document.getElementById('status').textContent = 'Opening your pack...';
  try {
    persistCollection(); // Bank once, before any animation.
    notePulled(results);
    /* The first-pull showcase is collection state, not animation state. Remove
       it as soon as the banked result exists, before the pack flourish starts. */
    renderHeroShowcase();
    collectionDirty = true;
    await playPackOpen(results);
    openReveal(results);
  } finally {
    pullBusy = false;
    controls.forEach(id => { document.getElementById(id).disabled = false; });
    document.getElementById('status').textContent = '';
  }
}
function finishPull() {
  if (collectionDirty) { renderCollection(); collectionDirty = false; }
  /* Keep a phone exactly where the pull began when the results close. Repeated
     pulls live in the hero, and auto-scrolling to the binder made that loop
     needlessly costly. Wider screens retain the existing collection nudge. */
  if (!matchMedia('(max-width: 600px)').matches) showBinder();
}

/* THE PULL IS RESOLVED AND BANKED BEFORE THE ANIMATION RUNS, and the ordering
   is deliberate rather than incidental. `playPackOpen` is a decoration in front
   of a decision that has already been made: the cards are drawn, added to the
   collection and persisted first, so a player who closes the tab mid-flourish
   keeps what they pulled, and nothing about the summon can influence what came
   out of it. It is awaited only to decide WHEN the reveal opens.

   It also cannot fail the pull. `playPackOpen` never rejects — reduced motion,
   a missing overlay, a skipped sequence all resolve — so there is no path here
   where a broken animation costs someone their cards. */
async function doPull(count) {
  const pool = currentPool();
  if (pullBusy || !pool.length) return;
  const results = pull(pool, count).map(addToCollection);
  await presentPull(results);
}

/* Dev-only: a 10-pull seeded with one card of every rarity present in the pool,
   then topped up with normal weighted pulls — so every rarity's card treatment
   shows up in one reveal while testing the visuals. Not a game affordance.

   The card per band is drawn at random, not `find`-ed. `find` returns the first
   match in pool order, which is fixed for a given set, so every Dev Pull showed
   the identical UR — which reads exactly like a broken pull and cost a real
   round of debugging to rule out. The engine was never involved: a x10 over
   Series 1 draws UR at 1.01% and hits all twelve UR cards uniformly. Only the
   sampling here was pinned. */
function pickRandom(cards) {
  return cards[Math.floor(Math.random() * cards.length)];
}

async function doDevPull() {
  const pool = currentPool();
  if (pullBusy || !pool.length) return;
  const oneEach = RARITY_ORDER
    .map(rarity => pickRandom(pool.filter(card => card.rarity === rarity)))
    .filter(Boolean);
  const fill = pull(pool, Math.max(0, 10 - oneEach.length));
  const results = [...oneEach, ...fill].slice(0, 10).map(addToCollection);
  await presentPull(results);
}

/* Marketing-only: a fixed, repeatable ten for screenshots. Same banking order
   as every other pull — resolved and persisted before the animation — so it is
   a real pull that happens to be cast rather than drawn. The roster and the
   reasoning live in engine/marketing-pull.js; the button is dev-gated. */
async function doMarketingPull() {
  const pool = currentPool();
  if (pullBusy || !pool.length) return;
  const results = marketingPull(pool).map(addToCollection);
  await presentPull(results);
}

function renderCollectionSurfaces() {
  renderCollection();
  renderHeroShowcase();
}

initCollection({ onCollectionChange: renderHeroShowcase });

initBanner({
  onPull: doPull,
  onDevPull: doDevPull,
  onMarketingPull: doMarketingPull,
  onSetLoaded: renderCollectionSurfaces,
});

/* The reveal's "pull again" runs the SAME doPull the pack runs — summon,
   reveal and all — rather than a quieter shortcut, so the loop a player falls
   into is the loop the game was designed around. `packSize` is passed as the
   getter banner.js exports so the button can name the size actually selected. */
/* `onDismiss` fires when the player is FINISHED with the reveal — Done, the
   backdrop, Escape — and deliberately not when "Pull again" takes the overlay
   down on its way to another pack. See the note above `closeReveal`. */
initReveal({ onPullAgain: () => doPull(packSize()), packSize, onDismiss: finishPull });

/* The arena's own enabled state is maintained by ui/collection.js (it is the
   module that knows how many different creators are owned); introducing the two
   is main's job, which is the whole of what this file is for. */
document.getElementById('battle-open').addEventListener('click', openArena);

renderCollectionSurfaces();
