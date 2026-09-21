/* marketing-pull — PURE. A fixed, reproducible ten-card pull for screenshots.

   ── WHAT IT IS FOR, AND WHY IT IS NOT A GAME AFFORDANCE ───────────────────
   A marketing image has one job the real pull cannot be asked to do: put
   recognizable faces and a legible stat argument in one frame, every time, on
   demand. A weighted x10 draws RUBY at 0.1% and fills the rest with channels
   nobody has heard of, so capturing a good grid means re-rolling until the
   dice cooperate — and the shot still changes between takes, which makes a
   set of images that do not look like they came from the same product.

   So this is Dev Pull's sibling and it is gated exactly the same way: it
   ignores the odds ON PURPOSE, and a control that quietly ignores the odds is
   not something to hand a player. See `gateDevElement` in ui/banner.js.

   ── IT IS PURE, WHICH IS WHY IT LIVES HERE ────────────────────────────────
   CLAUDE.md's tree rule is about what a module may touch, not what it is
   about: this touches nothing — no DOM, no network, no clock, no randomness —
   so it belongs in engine/ next to the rest of the headless code, however
   un-gamelike its subject. It is deliberately DETERMINISTIC: the same deck
   yields the same ten cards, so a screenshot can be retaken weeks later and
   match the one already posted.

   ── IT MUST SURVIVE A DECK REBUILD ────────────────────────────────────────
   The deck is refreshed on a 25-day cadence and names enter and leave it, so a
   roster of hand-picked handles WILL rot. Every slot therefore has a fallback:
   if no rostered handle is present in a band, the band's largest real channel
   is used instead. A missing name costs one recognizable face, never a broken
   pull and never an empty slot. */

import { RARITY_ORDER, toCount } from './core.js';

/* Ten cards, every band represented, weighted toward the top — which is where
   the recognizable people are. This is Dev Pull's "one of every rarity" idea
   with the spare slots spent on fame rather than on the weights.

   The shape is NOT the drop curve and is not trying to be. `core.RARITY` holds
   the real rates, the reveal is honest about what it drew, and anything that
   claims to show a typical pull must use `gacha.pull` instead. */
export const MARKETING_SHAPE = Object.freeze({
  RUBY: 1, UR: 2, SSR: 3, SR: 1, R: 2, N: 1,
});

/* Biggest first. The reveal renders in array order, so this decides the grid:
   at five across, the top row is both RUBYs, both URs and the lead SSR. */
const DISPLAY_ORDER = Object.freeze([...RARITY_ORDER].reverse());

/* Preference order WITHIN a band — first present wins. Handles rather than
   titles because a handle is the stable identifier: a channel renames itself
   far more often than it re-handles, and two channels can share a title.

   The picks are not just "the biggest": they are chosen so one frame carries
   element spread (Gaming / Music / Tech / Comedy / Lifestyle), four of the six
   classes, and — most of all — the argument this game is actually selling.
   MrBeast is the largest channel in the deck and rates DEF 103; Markiplier at
   a fourteenth of the size rates DEF 235, and the N slot below out-defends
   both. That contrast is the product, so it is cast deliberately rather than
   left to a re-roll. */
export const MARKETING_ROSTER = Object.freeze([
  // RUBY — ONE slot, and MrBeast holds it. The others stay listed as
  // succession: if the deck ever loses him, the next present name takes the
  // chase slot rather than the shape falling back to "biggest in band".
  '@mrbeast',
  '@pewdiepie',
  '@blackpink',

  // UR — a footballer and a pop star, so the frame is not all YouTubers.
  '@cristiano',
  '@taylorswift',
  '@markrober',
  '@justinbieber',
  '@ishowspeed',
  '@dudeperfect',

  // SSR — Markiplier first, because his DEF is the punchline against MrBeast's.
  // MKBHD carries the Tech element; Rihanna carries a huge ATK.
  '@markiplier',
  '@mkbhd',
  '@rihanna',
  '@katyperry',
  '@zachking',
  '@linustechtips',
  '@veritasium',

  // SR — instantly recognizable at a band where fame starts thinning out.
  '@thebeatles',
  '@moresidemen',
  '@slipknot',
  '@usher',

  // R — TWO slots. Asmongold Shorts first for the DEF 374 that carries the
  // "size does not decide every axis" argument, then a streamer, because the R
  // band (100K-1M) is where working streamers actually sit — the household
  // names are all SR and above.
  //
  // Adin Ross (@adinrossvlog, 883K) rates ATK 311, the highest number this pull
  // could put on screen, and is deliberately NOT listed: a promotional image is
  // the one place a controversial face costs more than a big number buys, on a
  // project already carrying likeness exposure. Same reasoning for Destiny
  // (@destiny, DEF 233). Both are one line away if that call changes.
  '@asmongoldshorts1',
  '@summit1g',
  '@mizkif',
  '@esfandtv',
  '@lirik',
  '@coolfindings',

  // N — nobody knows this one, and that IS the point: it carries the highest
  // DEF on the board while sitting at the bottom of the deck.
  '@rubiclips1',
  '@sagems-i5y',
]);

const norm = value => String(value ?? '').trim().toLowerCase();

/* YouTube auto-generates a "<Artist> - Topic" channel for music rights holders.
   There are ~1,365 of them in the deck; they are not creators, they usually
   carry no real avatar, and one in a marketing frame reads as a broken card.
   Screened out of the FALLBACK only — a rostered handle is an explicit choice
   and is never second-guessed. */
const isAutoGenerated = card => / - topic$/.test(norm(card?.channel?.title));

const subsOf = card => toCount(card?.channel?.subscriberCount);

/* The band's best fallback: the largest real channel that is not auto-generated
   and is not hiding its subscriber count. A hidden count reads as "0K subs" on
   the card face, which looks like a bug in a screenshot. */
function fallbackOrder(pool) {
  return pool
    .filter(card => !isAutoGenerated(card) && subsOf(card) > 0)
    .sort((a, b) => subsOf(b) - subsOf(a));
}

/* Deterministic by construction — no rng parameter, unlike everything else in
   engine/. Two runs against the same deck produce the same ten cards in the
   same order, which is the entire reason this exists rather than re-rolling
   Dev Pull until it looks good. */
export function marketingPull(cards, { shape = MARKETING_SHAPE, roster = MARKETING_ROSTER } = {}) {
  const byBand = new Map();
  for (const card of cards ?? []) {
    if (!byBand.has(card.rarity)) byBand.set(card.rarity, []);
    byBand.get(card.rarity).push(card);
  }

  const rank = new Map(roster.map((handle, i) => [norm(handle), i]));
  const rankOf = card => rank.get(norm(card?.channel?.handle));

  const picked = [];
  const used = new Set();

  const take = card => {
    if (!card || used.has(card.channel.id)) return false;
    used.add(card.channel.id);
    picked.push(card);
    return true;
  };

  for (const rarity of DISPLAY_ORDER) {
    const want = shape[rarity] ?? 0;
    if (!want) continue;
    const pool = byBand.get(rarity) ?? [];

    const named = pool
      .filter(card => rankOf(card) !== undefined)
      .sort((a, b) => rankOf(a) - rankOf(b));

    let filled = 0;
    for (const card of [...named, ...fallbackOrder(pool)]) {
      if (filled >= want) break;
      if (take(card)) filled += 1;
    }
  }

  /* A band that is empty (or short) would leave the grid ragged, so top up from
     whatever is left, biggest first. With a real deck this never runs. */
  const total = Object.values(shape).reduce((sum, n) => sum + n, 0);
  if (picked.length < total) {
    for (const card of fallbackOrder(cards ?? [])) {
      if (picked.length >= total) break;
      take(card);
    }
  }

  return picked;
}
