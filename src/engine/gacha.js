/* gacha — two-stage weighted pull, x1/x10, dupes stack.
   RNG is injectable; Math.random is only ever a default parameter so tests
   can inject a deterministic seed.

   Two stages, because one stage was wrong. The old pull summed each card's
   rarity weight across the whole pool, so a band's real drop rate was its
   weight *times how many cards of that band the pool happened to hold*. The
   weights in core.RARITY sum to exactly 100 — they were written as a rate
   curve — but a 500-card set curated to ~3% UR came out at ~0.09% UR, because
   composition and weight compounded. Add a few hundred small channels and the
   top bands vanish without anyone touching a number.

   So: pick a band by its fixed weight, then pick a card uniformly inside it.
   Drop composition now depends only on which bands are present, never on how
   many cards each holds. Same machine takes sourcing pools (Legends / Majority
   / Wildcards) later — swap what stage 1 groups by; the pull math is unchanged. */

import { RARITY, RARITY_ORDER } from './core.js';

/* Stage-1 groups: one per rarity band actually present in the pool, carrying
   that band's fixed weight and its members. Empty bands are dropped, so the
   weights renormalize over what is genuinely pullable — a live banner holding
   two R channels and one SSR draws 27:5 between them, not 0 for the rest.
   Ordered by RARITY_ORDER so a seeded draw is reproducible whatever order the
   cards arrived in. */
export function bandsFrom(cards) {
  return RARITY_ORDER
    .map(rarity => ({
      rarity,
      weight: RARITY[rarity].weight,
      cards: cards.filter(card => card.rarity === rarity),
    }))
    .filter(band => band.cards.length > 0);
}

function pickBand(bands, rng) {
  const total = bands.reduce((sum, band) => sum + band.weight, 0);
  let roll = rng() * total;
  for (const band of bands) {
    roll -= band.weight;
    if (roll < 0) return band;
  }
  return bands[bands.length - 1]; // float edge: roll never dipped below zero
}

/* Takes bands (from bandsFrom), not raw cards — pull groups once and draws
   many times, so the grouping never repeats inside a x10. */
export function pullOne(bands, rng = Math.random) {
  const band = pickBand(bands, rng);
  const i = Math.floor(rng() * band.cards.length);
  return band.cards[Math.min(i, band.cards.length - 1)]; // clamp: rng() may hit 1
}

export function pull(cards, count, rng = Math.random) {
  if (!cards.length) return [];
  const bands = bandsFrom(cards);
  return Array.from({ length: count }, () => pullOne(bands, rng));
}
