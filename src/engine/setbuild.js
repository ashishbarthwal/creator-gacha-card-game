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

/* ─────────────────────────────────────────────────────────────────────────────
   THE BAND CAP — the floor above has a ceiling, and it exists for the opposite
   failure.

   The floor stops a band being too thin to survive a x10. The cap stops one
   being so deep nobody can ever finish it. Both are real, and the second only
   became visible once the curated legends roster landed 12 UR cards in a 79-card
   set (2026-07-31).

   The number that matters is how many pulls it takes to collect every card in a
   band. For a band holding k cards and drawn on a share s of pulls, that is the
   coupon-collector expectation:

       pulls = k * H(k) / s          H(k) = 1 + 1/2 + ... + 1/k

   Run over that 79-card set: the base bands complete in ~190-200 pulls and the
   UR band takes ~3,720. The set finishes eighteen times over before its chase
   cards do.

   The load-bearing consequence, and the reason a cap is the ONLY fix: because
   the pull picks a band by fixed weight and then draws uniformly inside it
   (WP4), a band's completion time depends on how many cards THAT band holds and
   on nothing else. Adding 300 commons does not make the UR band any more
   finishable — it just changes the percentage. So the roster cannot be balanced
   by growing it; the top has to be capped.

   Surplus is not discarded, it is held: the candidate DB keeps every id, and a
   later printing seeded on its own slug draws a different subset. That is how a
   real TCG behaves — each printing has its own chase cards — and it falls out of
   the seeded selection below rather than needing a rotation ledger. */

/* Cards in a full printing. DECISIONS.md calls a Series 300-500; the allocation
   below spends this budget across the bands rather than splitting it evenly. */
export const DEFAULT_TARGET_SIZE = 400;

/* Expected pulls to collect all k cards of a band drawn on share s. */
function completionPulls(k, harmonicK, share) {
  return share > 0 ? (k * harmonicK) / share : Infinity;
}

/* How deep each band should be, so that every band finishes at roughly the same
   time and the total lands on targetSize.

   Allocated by water-filling rather than by a percentage table: start every band
   at the floor it already has to clear, then hand the next card to whichever
   band currently completes SOONEST, until the budget is spent. Equal completion
   times fall out of that, and the floor is respected by construction rather than
   by clamping afterwards.

   Chosen over "give each band targetSize * its weight", which looks like the
   obvious answer and is wrong: weight is the rate a band is DRAWN at, and a band
   drawn twice as often does not need twice as many cards to stay interesting —
   H(k) grows logarithmically, so proportional allocation leaves the common bands
   taking ~3x longer to complete than UR. Chosen over a hand-written mix (the
   N40/R30/SR18/SSR9/UR3 in DECISIONS.md) because that number was inherited from
   the per-card-weight era, when composition still moved the drop rates; under
   band-first pulling it needed a new justification, and this is it. It lands
   close to the old figures, which is a good sign rather than a coincidence. */
export function bandTargets(presentRarities = RARITY_ORDER, { targetSize = DEFAULT_TARGET_SIZE, pullSize = PULL_SIZE } = {}) {
  const present = (presentRarities ?? []).filter(r => RARITY[r]);
  const totalWeight = present.reduce((sum, r) => sum + RARITY[r].weight, 0);
  if (!present.length || !totalWeight) return {};

  const targets = {};
  const shares = {};
  const harmonics = {};
  let allocated = 0;

  for (const rarity of present) {
    const min = minCardsForBand(rarity, present, pullSize);
    targets[rarity] = min;
    shares[rarity] = RARITY[rarity].weight / totalWeight;
    harmonics[rarity] = harmonic(min);
    allocated += min;
  }

  /* The floors alone can already exceed a small budget. Honouring them over the
     budget is the right way round — a starved band is a broken pull, while an
     oversized set is only a longer one. */
  while (allocated < targetSize) {
    let pick = null;
    let soonest = Infinity;
    for (const rarity of present) {
      const at = completionPulls(targets[rarity], harmonics[rarity], shares[rarity]);
      if (at < soonest) { soonest = at; pick = rarity; }
    }
    targets[pick] += 1;
    harmonics[pick] += 1 / targets[pick];
    allocated += 1;
  }
  return targets;
}

function harmonic(k) {
  let sum = 0;
  for (let i = 1; i <= k; i++) sum += 1 / i;
  return sum;
}

/* Stable hash of a string. Same shape as ui/card.js's accent fallback and
   engine/emblem.js's hue: identical across runs and platforms, which is what
   makes a capped build reproducible from its inputs alone. */
function hashOf(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h;
}

/* The selection key: which cards a given printing keeps.

   The obvious implementation — hashOf(`${seed}:${id}`) — was WRONG, and wrong in
   a way that looked right and passed a test. Because `h = h*31 + ch` accumulates
   left to right, prepending a different seed shifts every id's hash by the SAME
   constant, and adding a constant preserves sort order everywhere except the one
   wraparound point. Measured: two printings shared 64% of their UR band where
   the design called for 14%. The test only asserted the two subsets were not
   identical, which a 64% overlap satisfies comfortably.

   So the seed and the id are hashed separately, combined, and then run through a
   murmur3 finalizer so a one-bit change in either avalanches across the whole
   word. Re-measured at 14.3-15.1% against an ideal of k/R = 14.3%.

   The expected overlap between consecutive printings is k/R — the per-printing
   count over the roster depth — which is what makes "how deep should the roster
   be" answerable: a roster of 7k repeats about one card in seven. */
function selectionHash(seed, id) {
  let h = (hashOf(id) ^ Math.imul(hashOf(seed), 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/* Trim each band to its target, keeping a deterministic subset.

   Which cards survive is decided by hashing `seed:channelId` and keeping the
   lowest — so the choice is reproducible from the set slug and the roster with
   no stored state, and a DIFFERENT slug selects a different subset. That is what
   makes the surplus a future printing's chase cards rather than dead weight.

   Keyed on the channel id rather than subscriber count on purpose: "keep the
   biggest" would make every printing's top band identical, which is the outcome
   this is here to avoid. */
export function capBands(channels, { targetSize = DEFAULT_TARGET_SIZE, pullSize = PULL_SIZE, seed = '', pinned = new Set() } = {}) {
  const pins = pinned instanceof Set ? pinned : new Set(pinned ?? []);
  const bands = bandsOf(channels);
  const targets = bandTargets(bands.map(b => b.rarity), { targetSize, pullSize });
  const kept = [];
  const capped = [];
  for (const { rarity, cards } of bands) {
    const target = targets[rarity] ?? cards.length;
    if (cards.length <= target) {
      kept.push(...cards);
      continue;
    }
    /* Pinned cards sort ahead of everything, so the hash only ever decides the
       REMAINDER of a band. Without this the cap chooses a set's headline cards
       by hash, which is how the first 400-card build shipped five record labels
       in UR and hashed PewDiePie out. Pins are honoured before the seed because
       "which creators does this audience recognize" is a judgement the roster
       makes and a hash cannot. */
    const ranked = [...cards].sort((a, b) => {
      const pa = pins.has(String(a.id)) ? 0 : 1;
      const pb = pins.has(String(b.id)) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const ha = selectionHash(seed, a.id);
      const hb = selectionHash(seed, b.id);
      return ha - hb || (a.id < b.id ? -1 : 1);   // tie-break so the order is total
    });
    kept.push(...ranked.slice(0, target));
    const droppedPins = ranked.slice(target).filter(c => pins.has(String(c.id))).length;
    capped.push({ rarity, from: cards.length, to: target, droppedPins });
  }
  return { kept, capped, targets };
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

/* CURATION EXCLUDE — deliberately not the opt-out denylist, and deliberately
   not a candidate-DB operation.

   Two different things want to remove a channel and they must not share a file.
   An opt-out (catalog/denylist.json) is a creator's request: permanent, evicts
   from the DB so the id is never re-sourced, and it is one of the five
   mitigations the legality gate closed on — it has to stay auditable as exactly
   that. A curation exclude (catalog/excluded.txt) is an editorial call about
   what a printing is sold on: "recognizable enough to carry a card". It is
   revisable, carries no promise to anyone, and mixing the two would make the
   opt-out register unreadable as a record of honored requests.

   It also filters HERE rather than at merge, so the id survives in
   catalog/candidates.json. Un-excluding is then editing a text file, not
   re-resolving a handle and spending quota to recover something we threw away.

   Applied before the cap, so an excluded card frees its slot rather than
   shrinking the band — the next-best candidate is promoted into it. */
export function applyExcludes(channels, excluded) {
  const ids = excluded instanceof Set ? excluded : new Set((excluded ?? []).map(String));
  if (!ids.size) return { kept: channels ?? [], removed: [] };
  const kept = [];
  const removed = [];
  for (const channel of channels ?? []) {
    (ids.has(String(channel?.id)) ? removed : kept).push(channel);
  }
  return { kept, removed };
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
export function assembleSet(channels, { slug, title, series = '', snapshotDate, pullSize = PULL_SIZE, targetSize = DEFAULT_TARGET_SIZE, pinned = new Set() } = {}) {
  if (!slug || !title) throw new Error('A set needs a slug and a title.');
  /* Prune decides WHICH bands ship, cap decides how DEEP each one is, in that
     order — a band dropped for starvation should never be allocated a budget.
     The cap never re-starves anything, since every target starts at the floor. */
  const { kept: surviving, dropped } = pruneStarvedBands(channels, pullSize);
  if (!surviving.length) throw new Error('No channels left to build a set from.');
  const { kept, capped, targets } = capBands(surviving, { targetSize, pullSize, seed: String(slug), pinned });
  return {
    set: {
      slug: String(slug),
      title: String(title),
      series: String(series),
      snapshotDate: String(snapshotDate ?? ''),
      channels: kept.map(toPublished),
    },
    dropped,
    capped,
    targets,
    health: bandHealth(kept, pullSize),
  };
}
