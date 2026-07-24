/* core — PURE. No I/O, no DOM, no randomness. This is the WP1 test target.
   Imports nothing, by design. If this file ever needs an import, the
   design is wrong. */

export const RARITY_ORDER = ['N', 'R', 'SR', 'SSR', 'UR'];

export const RARITY = {
  N:   { weight: 55, mult: 1.0  },
  R:   { weight: 27, mult: 1.25 },
  SR:  { weight: 12, mult: 1.6  },
  SSR: { weight: 5,  mult: 2.0  },
  UR:  { weight: 1,  mult: 2.5  },
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
  if (subs >= 50_000_000) return 'UR';
  if (subs >= 10_000_000) return 'SSR';
  if (subs >= 1_000_000)  return 'SR';
  if (subs >= 100_000)    return 'R';
  return 'N';
}

export function statsFrom(channel) {
  const rarity = rarityFromSubs(channel.subscriberCount, channel.hiddenSubscriberCount);
  const mult = RARITY[rarity].mult;
  return {
    rarity,
    atk: Math.round(Math.log10(toCount(channel.viewCount) + 1) * 120 * mult),
    def: Math.round(Math.log10(toCount(channel.videoCount) + 1) * 150 * mult),
  };
}

/* The model bridge: a Channel becomes a card. Pure, so it lives with the
   derivation rather than the renderer that consumes it. */
export function toCard(channel) {
  return { channel, ...statsFrom(channel) };
}
