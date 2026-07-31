/* engine/setbuild — PURE. Assembles a shippable card set out of freshly
   hydrated channels: the band-health check, and the strip that keeps `country`
   out of the published artifact. No fetch, no key, no DOM.

   Two jobs, both of which exist because something went wrong once.

   THE BAND GUARD. Found by playing (2026-07-31): a 15-card pool returned the
   same R card four times in one x10. Not the dupe rule — band starvation. The
   pull picks a band by fixed weight and then draws uniformly inside it, so a
   band holding one card returns that card every time the band hits. That is
   WP4's deliberate trade (composition can no longer dilute the drop curve) and
   the pull is right to work that way, so the guard belongs here, at build.

   The minimum is DERIVED from the same weight table the pull uses rather than
   being a flat number, because a flat number is wrong at both ends. N carries
   weight 55 and takes ~5.5 of every 10 draws, so it needs a deep roster to look
   varied; UR carries 1 and takes ~0.1, so two cards is already plenty. One
   constant tuned by hand would either starve the common band or reject a
   perfectly good rare one.

   THE STRIP. `country` is read at build (the region exclude) and never at
   runtime, so publishing it would expose a self-declared personal attribute the
   game does not use. This is the last item on the launch Gate, and it closes
   here: the set is assembled by naming the fields it keeps, so country cannot
   reach a shipped file by omission. */

import { RARITY, RARITY_ORDER, rarityFromSubs } from './core.js';

/* Cards drawn in one x10 — the pull size the guard reasons about, since that is
   the unit a player experiences as "the same card again". */
export const PULL_SIZE = 10;

/* Headroom over the expected draw count. At 2x, a band is required to hold
   twice the cards a x10 is expected to take from it, which keeps a repeat
   uncommon without demanding a roster the sourcing cannot fill. Two is the
   floor regardless: a one-card band is the failure this exists to prevent. */
export const BAND_HEADROOM = 2;

/* How many distinct cards a band needs to survive a x10 without visibly
   repeating. Derived from the band's own weight, normalized over the bands
   actually present — matching gacha.bandsFrom, which drops empty bands and
   renormalizes, so a set holding only N and R really does draw 55:27 between
   them and the minimums must be computed against that same total. */
export function minCardsForBand(rarity, presentRarities = RARITY_ORDER, pullSize = PULL_SIZE) {
  const total = presentRarities.reduce((sum, r) => sum + (RARITY[r]?.weight ?? 0), 0);
  if (!total) return 2;
  const expectedDraws = pullSize * ((RARITY[rarity]?.weight ?? 0) / total);
  return Math.max(2, Math.ceil(expectedDraws * BAND_HEADROOM));
}

/* Group channels by the rarity their subscriber count derives, in RARITY_ORDER.
   Bands with no members are absent rather than empty, mirroring bandsFrom. */
export function bandsOf(channels) {
  const byRarity = new Map();
  for (const channel of channels ?? []) {
    if (!channel?.id) continue;
    const rarity = rarityFromSubs(channel.subscriberCount, channel.hiddenSubscriberCount);
    if (!byRarity.has(rarity)) byRarity.set(rarity, []);
    byRarity.get(rarity).push(channel);
  }
  return RARITY_ORDER.filter(r => byRarity.has(r)).map(r => ({ rarity: r, cards: byRarity.get(r) }));
}

/* Per-band verdict for a candidate roster. Reports rather than throws, so the
   caller decides — a CLI wants to print the whole picture before acting, and a
   scheduled refresh must not die on one thin band. */
export function bandHealth(channels, pullSize = PULL_SIZE) {
  const bands = bandsOf(channels);
  const present = bands.map(b => b.rarity);
  return bands.map(({ rarity, cards }) => {
    const needed = minCardsForBand(rarity, present, pullSize);
    return { rarity, count: cards.length, needed, ok: cards.length >= needed };
  });
}

/* Drop starved bands, keeping the rest.

   Dropping is the right default over refusing to build: a starved band is worse
   for a player than an absent one — the pull renormalizes cleanly over whichever
   bands remain, whereas a one-card band hands them the same card repeatedly —
   and a scheduled refresh that fails hard on a thin band stops shipping sets
   entirely, which is a worse outcome than shipping one band lighter.

   Removing a band changes the weights over the remainder, which can starve a
   band that was healthy a moment ago, so this re-checks until it settles rather
   than filtering once. */
export function pruneStarvedBands(channels, pullSize = PULL_SIZE) {
  let kept = (channels ?? []).filter(c => c?.id);
  const dropped = [];
  for (;;) {
    const starved = bandHealth(kept, pullSize).filter(b => !b.ok);
    if (!starved.length) break;
    const rarities = new Set(starved.map(b => b.rarity));
    for (const band of starved) dropped.push(band);
    kept = kept.filter(c => !rarities.has(rarityFromSubs(c.subscriberCount, c.hiddenSubscriberCount)));
  }
  return { kept, dropped };
}

/* The published Channel record. A positive allowlist for the same reason
   engine/candidates.js uses one: a blocklist would start publishing whatever
   field the seam grows next, silently. `country` is absent by construction. */
function toPublished(channel) {
  const record = {
    id: String(channel.id),
    title: String(channel.title ?? ''),
    handle: String(channel.handle ?? ''),
    avatarUrl: String(channel.avatarUrl ?? ''),
    hiddenSubscriberCount: Boolean(channel.hiddenSubscriberCount),
    viewCount: String(channel.viewCount ?? '0'),
    videoCount: String(channel.videoCount ?? '0'),
  };
  /* Omitted rather than zeroed when hidden, matching the live API and the
     typedef — the core reads absence as the bottom band on purpose. */
  if (channel.subscriberCount != null) record.subscriberCount = String(channel.subscriberCount);
  return record;
}

/* Assemble the set envelope data/sets.js parses back. snapshotDate is passed in,
   never read from a clock here, so a build is reproducible under test. */
export function assembleSet(channels, { slug, title, series = '', snapshotDate, pullSize = PULL_SIZE } = {}) {
  if (!slug || !title) throw new Error('A set needs a slug and a title.');
  const { kept, dropped } = pruneStarvedBands(channels, pullSize);
  if (!kept.length) throw new Error('No channels left to build a set from.');
  return {
    set: {
      slug: String(slug),
      title: String(title),
      series: String(series),
      snapshotDate: String(snapshotDate ?? ''),
      channels: kept.map(toPublished),
    },
    dropped,
    health: bandHealth(kept, pullSize),
  };
}
