/* fairness — collection-size fairness for battle. PURE and headless: no I/O,
   no DOM, randomness only through an injected `rng`, the same discipline
   gacha.js and battle.js already apply.

   ── THE PROBLEM IT ANSWERS (Ash's brief, 2026-08-15, items 15-27) ─────────
   A battle picks five cards, but the SELECTION happens against a whole
   collection, and collections vary by two orders of magnitude depending on
   how long someone has been playing. A player with 150 cards can search for
   a flawless five; a player with 10 cannot search at all. Left alone, that
   turns "I've been playing a while" into "I can always assemble the perfect
   answer to anything", which crowds out a new player's five real choices —
   not because the small collection is weak, but because the large one is
   allowed to be omniscient.

   The fix is a TEMPORARY, PER-BATTLE cap, never a change to what anyone
   owns: once the larger side's collection exceeds 1.5x the smaller side's,
   it is handed a smaller, rarity-weighted, semi-random slice to build from
   for this fight only. The larger collection still means better odds — a
   bigger, rarity-weighted slice is likely to contain better cards than a
   small collection's entire pool — it just stops meaning "search everything".

   ── WHAT THIS DOES NOT DO ──────────────────────────────────────────────────
   It never touches the stored collection. `shedCollection` takes an array of
   channels and returns a SMALLER array drawn from the same channels — every
   card in the result is the exact reference passed in, nothing is cloned,
   nothing is recomputed, and no stat, rarity or subscriber count is touched
   (item 35). The caller decides where the returned subset gets used; this
   module never receives a reference to storage, so there is nothing here that
   could persist a reduction by accident. */

import { rarityFromSubs } from './core.js';

/* The core rule (item 16): the larger side of a battle may keep at most this
   many times the smaller side's collection size. Below it, nothing happens —
   item 17 is explicit that a normal difference in collection size is not a
   problem worth solving. */
export const MAX_COLLECTION_RATIO = 1.5;

/* Rarities that get a GUARANTEED retention slot when the player owns at
   least one (item 23), in the order the brief lists them. RUBY is
   deliberately absent — item 25: it is powerful enough on its own that
   losing one to the shed is an acceptable cost, where losing a player's only
   UR, SSR or SR would read as the game punishing a good pull rather than
   trimming a search space. */
export const PROTECTED_RARITIES = ['UR', 'SSR', 'SR'];

/* How likely a card is to survive the random half of the shed, relative to
   the others — a WEIGHT, not a probability (bigger survives more often, and
   the numbers only matter relative to each other). Bottom-heavy per item 26:
   "N -> highest chance of shedding... UR -> very low chance". Kept as six
   round numbers rather than a fitted curve, per item 26's own "do not make
   the exact probabilities unnecessarily complicated".

   RUBY SITS ABOVE SR BUT WELL BELOW SSR/UR, and both halves of that were
   deliberate, not just "somewhere in the middle". Above SR because item 25
   still asks for "a lower shedding probability than ordinary low-rarity
   cards" and RUBY is the rarest tier in the game (9 cards on the live deck
   against UR's 22) — treating it as no better protected than a common would
   read as a punishment for the best possible pull. Well below SSR/UR because
   item 25 is explicit that RUBY gets NO guaranteed slot and "can remain
   vulnerable" — the first weight tried here (30, just under UR) survived a
   shed on ~99.7% of 100 trial seeds in testing, which is "can be shed" in
   name only. 12 keeps a real, felt edge over N/R/SR while making the loss
   item 25 explicitly allows for something a player will actually see happen
   from time to time, not a rounding error. */
export const KEEP_WEIGHT = { N: 1, R: 3, SR: 8, SSR: 20, UR: 50, RUBY: 12 };

const rarityOf = channel => rarityFromSubs(channel?.subscriberCount, channel?.hiddenSubscriberCount);

/* Whether the larger of two collection SIZES would be capped for a battle
   against the smaller. Exposed on its own so the UI can decide whether to
   show the "your collection is more than 1.5x theirs" screen without having
   to run the (slightly more expensive) shed just to find out. */
export function needsShedding(sizeA, sizeB) {
  const smaller = Math.min(sizeA, sizeB);
  const larger = Math.max(sizeA, sizeB);
  return larger > Math.round(smaller * MAX_COLLECTION_RATIO);
}

/* How many cards each side is allowed to bring, given both sizes — in
   WHICHEVER ORDER THEY ARRIVE. A real caller has "my collection" and "their
   collection" without necessarily knowing in advance which one is larger,
   and a function that silently assumed the caller had already sorted them
   would be a footgun: passed backwards, it would report the LARGER side as
   uncapped and try to shrink the smaller one instead. So this takes two
   arbitrary sizes and hands back the eligible count for each of them by
   position — `eligibleSizes(mine, theirs)` always means "cap on mine" first.
   Equal to a side's own size whenever no shedding applies, so a caller can
   always treat the result as "the eligible count" whether or not shedding
   actually fired — one function, no separate branch to remember. */
export function eligibleSizes(sizeA, sizeB) {
  const cap = Math.round(Math.min(sizeA, sizeB) * MAX_COLLECTION_RATIO);
  return { a: sizeA > cap ? cap : sizeA, b: sizeB > cap ? cap : sizeB };
}

/* Weighted draw WITHOUT replacement: pick `count` items from `pool`,
   proportional to `weightOf`, never the same item twice.

   IMPLEMENTED AS REPEATED WEIGHTED DRAWS RATHER THAN A SINGLE-PASS SAMPLER
   (e.g. a Vose alias table), because a collection here runs to a few hundred
   cards at most — this is O(pool x count), unmeasurable at that size — and a
   repeated draw is the version that is obviously correct rather than the
   version that is merely fast. Every draw re-sums the remaining weight rather
   than adjusting a running total, for the same reason: fewer places for a
   floating-point drift to hide. */
function weightedSample(pool, count, weightOf, rng) {
  const remaining = [...pool];
  const picked = [];
  while (picked.length < count && remaining.length) {
    const total = remaining.reduce((sum, item) => sum + weightOf(item), 0);
    /* A zero total (every remaining weight is 0) falls back to a uniform
       pick rather than dividing by zero — should not happen with the weights
       above, since every rarity has a positive KEEP_WEIGHT, but a fixture or
       a future rarity with an unset weight must still terminate cleanly. */
    let target = total > 0 ? rng() * total : rng() * remaining.length;
    let at = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      target -= total > 0 ? weightOf(remaining[i]) : 1;
      if (target <= 0) { at = i; break; }
    }
    picked.push(remaining[at]);
    remaining.splice(at, 1);
  }
  return picked;
}

/* THE SHED ITSELF. Returns a NEW array — a subset of `channels`, deduped by
   id, of length `min(channels.length, targetSize)`. Every entry in it is the
   exact object passed in: nothing is cloned or recomputed, which is what
   keeps item 35 ("shedding must not modify ATK/DEF/HP/SPD/MOM/rarity/subs")
   true by construction rather than by discipline.

   PROTECTED SLOTS FIRST, WEIGHTED DRAW FOR THE REST — the two-phase process
   items 22-26 describe: guarantee one of each rarity in PROTECTED_RARITIES
   the player actually owns (item 24 — never invent a rarity that is not
   there), then fill whatever is left with a weighted random draw over
   everything not already kept. `rng` defaults to Math.random and is always
   injectable, the same contract as gacha.js's pull and battle.js's combat, so
   this can be exercised deterministically under test. */
export function shedCollection(channels, targetSize, { rng = Math.random } = {}) {
  const list = channels ?? [];
  if (list.length <= targetSize) return [...list];

  /* Deduped by id first — a shed operates on DISTINCT cards, the same unit
     a battle team is built from (myChannels() in ui/battle.js applies the
     same rule for the same reason: fielding one creator twice is a bug, not
     a strategy). */
  const byId = new Map(list.map(ch => [String(ch?.id ?? ''), ch]));
  const pool = [...byId.values()];

  const kept = [];
  const keptIds = new Set();
  for (const rarity of PROTECTED_RARITIES) {
    if (kept.length >= targetSize) break;
    const candidates = pool.filter(ch => !keptIds.has(String(ch?.id ?? '')) && rarityOf(ch) === rarity);
    if (!candidates.length) continue;   // item 24: no card of this rarity owned, no slot spent
    /* Uniform among same-rarity candidates — the guarantee is "you keep a
       UR", not "you keep your best UR"; picking the strongest one every time
       would make the guarantee a second, hidden optimizer. */
    const [pick] = weightedSample(candidates, 1, () => 1, rng);
    kept.push(pick);
    keptIds.add(String(pick.id));
  }

  const remainingSlots = targetSize - kept.length;
  const remainingPool = pool.filter(ch => !keptIds.has(String(ch?.id ?? '')));
  const rest = weightedSample(remainingPool, remainingSlots, ch => KEEP_WEIGHT[rarityOf(ch)] ?? 1, rng);

  return [...kept, ...rest];
}

/* What a player is about to lose access to for this battle, summarized for
   the "your collection will be temporarily reduced" screen (item 20). Takes
   sizes rather than the collections themselves, so a caller that only needs
   the headline numbers is not paying for a shed it is not going to use yet. */
export function shedSummary(fullSize, eligibleCount) {
  return { fullSize, eligibleCount, hiddenCount: Math.max(0, fullSize - eligibleCount) };
}

/* Which of the protected rarities actually exist in a collection, for the
   "you will retain at least..." checklist (item 23). Read-only — stating
   what a shed WOULD protect, not performing one; `shedCollection` is the
   function that actually enforces it. */
export function protectedRaritiesPresent(channels) {
  const present = new Set((channels ?? []).map(rarityOf));
  return PROTECTED_RARITIES.filter(r => present.has(r));
}
