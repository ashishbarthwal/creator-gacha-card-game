/* core — PURE. No I/O, no DOM, no randomness. This is the WP1 test target.
   Imports nothing, by design. If this file ever needs an import, the
   design is wrong.

   ── RARITY IS A DROP RATE AND NOTHING ELSE (2026-08-09) ───────────────────
   This file used to own a second job: a `statsFrom` that derived the ATK and
   DEF printed on the collection card, as
   `log10(views) * 120 * RARITY[rarity].mult`, with `mult` running 1.0 at N to
   3.0 at RUBY. Both halves of that are gone, and the reason is worth stating
   because it was the single biggest thing wrong with the game.

   Measured on the live 15,831-card deck, those printed stats correlated with
   subscriber count at 0.897 and spanned 5.22x from the N median to the RUBY
   median — an N card could NEVER out-stat a UR, not once in the whole deck.
   The battle engine one folder over disagreed completely: it spans 1.19x,
   correlates at 0.187, and 19% of N cards out-rate the median UR/RUBY.

   So the game PLAYED as a contest of shape and matchup while READING as
   "whoever has more subscribers wins", and the card face is the screen a player
   looks at constantly. The fix is not to compromise between two numbers; it is
   to stop having two. There is one derivation — engine/battle-stats.js — and
   the card face now shows it.

   `mult` went with it rather than being left dangling, because
   battle-stats.js already states the principle this file was quietly violating:
   rarity buys a compressed BUDGET and nothing else, which "is why rarity can
   honestly mean 'how hard this was to pull' and nothing else." A multiplier
   table that made rarity worth 3x flatly contradicted that. What remains here
   is the weight — the drop rate — which is the whole of what a band is. */

export const RARITY_ORDER = ['N', 'R', 'SR', 'SSR', 'UR', 'RUBY'];

/* Pull weights. They sum to 100 because they were written as a rate curve;
   engine/gacha.js picks a BAND by these and then a card uniformly inside it,
   so a band's real drop rate does not depend on how many cards it holds. */
export const RARITY = {
  N:    { weight: 55  },
  R:    { weight: 27  },
  SR:   { weight: 12  },
  SSR:  { weight: 5   },
  UR:   { weight: 0.9 },
  RUBY: { weight: 0.1 },
};

/* The API reports counts as decimal strings and omits them entirely for
   hidden subscriber counts. Anything unparseable counts as zero so the
   derivation never throws and never yields NaN. */
export function toCount(value) {
  const n = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function rarityFromSubs(subscriberCount, hidden = false) {
  if (hidden) return 'N';
  const subs = toCount(subscriberCount);
  if (subs >= 100_000_000) return 'RUBY';
  if (subs >= 50_000_000) return 'UR';
  if (subs >= 10_000_000) return 'SSR';
  if (subs >= 1_000_000)  return 'SR';
  if (subs >= 100_000)    return 'R';
  return 'N';
}

/* The model bridge: a Channel becomes a card. Pure, so it lives with the
   derivation rather than the renderer that consumes it.

   A card is now `{ channel, rarity }` and NOTHING ELSE, which is the whole of
   the correction described at the top of this file. Anything that wants numbers
   asks engine/battle-stats.js for them — including the collection card, which
   is why `ui/card.js` imports it. Storing or passing derived numbers alongside
   the channel is what let two answers to "how strong is this card" exist at
   once; a card that carries only its source and its band cannot drift. */
export function toCard(channel) {
  return {
    channel,
    rarity: rarityFromSubs(channel.subscriberCount, channel.hiddenSubscriberCount),
  };
}
