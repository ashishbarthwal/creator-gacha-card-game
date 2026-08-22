/* main — wiring only. Composes the pure core, the gacha engine, the data
   seam and the UI modules; holds nothing of its own but the pull glue. */

import { pull } from './engine/gacha.js';
import { RARITY_ORDER } from './engine/core.js';
import { currentPool, addToCollection, persistCollection } from './state.js';
import { initBanner, packSize } from './ui/banner.js';
import { renderCollection, notePulled, showBinder } from './ui/collection.js';
import { openReveal, initReveal } from './ui/reveal.js';
import { playPackOpen } from './ui/packopen.js';
import { openArena } from './ui/battle.js';

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
  if (!pool.length) return;
  const results = pull(pool, count).map(addToCollection);
  persistCollection();          // once per pull, not once per card
  notePulled(results);          // session order + NEW flags, for the collection view
  renderCollection();
  await playPackOpen(results);
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

async function doDevPull() {
  const pool = currentPool();
  if (!pool.length) return;
  const oneEach = RARITY_ORDER
    .map(rarity => pickRandom(pool.filter(card => card.rarity === rarity)))
    .filter(Boolean);
  const fill = pull(pool, Math.max(0, 10 - oneEach.length));
  const results = [...oneEach, ...fill].slice(0, 10).map(addToCollection);
  persistCollection();
  notePulled(results);
  renderCollection();
  await playPackOpen(results);
  openReveal(results);
}

initBanner({ onPull: doPull, onDevPull: doDevPull, onSetLoaded: renderCollection });

/* The reveal's "pull again" runs the SAME doPull the pack runs — summon,
   reveal and all — rather than a quieter shortcut, so the loop a player falls
   into is the loop the game was designed around. `packSize` is passed as the
   getter banner.js exports so the button can name the size actually selected. */
/* `onDismiss` fires when the player is FINISHED with the reveal — Done, the
   backdrop, Escape — and deliberately not when "Pull again" takes the overlay
   down on its way to another pack. See the note above `closeReveal`. */
initReveal({ onPullAgain: () => doPull(packSize()), packSize, onDismiss: showBinder });

/* The arena's own enabled state is maintained by ui/collection.js (it is the
   module that knows how many different creators are owned); introducing the two
   is main's job, which is the whole of what this file is for. */
document.getElementById('battle-open').addEventListener('click', openArena);

renderCollection();
