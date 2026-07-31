/* main — wiring only. Composes the pure core, the gacha engine, the data
   seam and the UI modules; holds nothing of its own but the pull glue. */

import { pull } from './engine/gacha.js';
import { RARITY_ORDER } from './engine/core.js';
import { currentPool, addToCollection } from './state.js';
import { initBanner } from './ui/banner.js';
import { renderCollection } from './ui/collection.js';
import { openReveal } from './ui/reveal.js';

function doPull(count) {
  const pool = currentPool();
  if (!pool.length) return;
  const results = pull(pool, count).map(addToCollection);
  renderCollection();
  openReveal(results);
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

function doDevPull() {
  const pool = currentPool();
  if (!pool.length) return;
  const oneEach = RARITY_ORDER
    .map(rarity => pickRandom(pool.filter(card => card.rarity === rarity)))
    .filter(Boolean);
  const fill = pull(pool, Math.max(0, 10 - oneEach.length));
  const results = [...oneEach, ...fill].slice(0, 10).map(addToCollection);
  renderCollection();
  openReveal(results);
}

initBanner({ onPull: doPull, onDevPull: doDevPull });
renderCollection();
