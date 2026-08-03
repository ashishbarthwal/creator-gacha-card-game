/* opponent — build an AI team of a chosen strength relative to the player's.
   PURE: no I/O, no DOM, randomness only through an injected `rng`.

   ── WHY MATCHMAKING IS PART OF THE BALANCE ANSWER, NOT A SEPARATE FEATURE ──
   battle-stats.js compresses how much raw power a card's size can buy, so a
   well-shaped N can beat a UR. But compression alone cannot make a five-UR
   team a fair fight for five N cards — some gap survives, and it should: a
   collection that never matters is a collection nobody builds.

   Ash's framing solved this at a different layer. Rather than flattening cards
   until rarity is meaningless, MATCH THE OPPONENT to the player's own deck.
   Then a beginner's N-heavy team meets an N-heavy AI and the fight is decided
   by shape and matchup — the part the stat design actually made interesting —
   while a stacked team faces a stacked AI. The `stronger` and `weaker` modes
   exist because a fair fight every time is its own kind of boring; they are
   the difficulty dial, and they are honest about which way they are tilted.

   ── WHY IT PICKS AGAINST A TARGET RATHER THAN SORTING ─────────────────────
   Taking the N strongest cards below a threshold would hand the AI the same
   optimal team every time, and a deck of 23.5k cards has enough shape variety
   that "strongest available" is both predictable and dull. So the build is a
   greedy walk toward a power TARGET with a randomized candidate pool: it lands
   near the requested strength while still fielding different cards each run. */

import { toCombatant, teamPower, TEAM_SIZE } from './battle.js';
import { powerOf } from './battle-stats.js';

/* The difficulty dial. 1.0 is the fair fight Ash asked for as the default;
   the other two are deliberately mild, because power is already compressed —
   a 25% swing at this scale is a real but survivable disadvantage. */
export const DIFFICULTY = {
  even:     { label: 'Even match',  factor: 1.0 },
  stronger: { label: 'Uphill',      factor: 1.25 },
  weaker:   { label: 'Favoured',    factor: 0.8 },
};

/* How close the assembled team must land to the target before the search
   stops trying to improve it — 4% of total team power, which is inside the
   noise a single round of combat introduces anyway. */
const CLOSE_ENOUGH = 0.04;

/* Candidates considered per slot. Large enough that the AI's teams vary
   between runs, small enough that the pick stays cheap on a 23.5k pool. */
const SAMPLE_PER_SLOT = 40;

function sample(pool, count, rng) {
  if (pool.length <= count) return [...pool];
  const picked = [];
  const seen = new Set();
  /* Bounded attempts rather than a shuffle: shuffling 23.5k cards to take 40
     is the expensive way round, and a few collisions cost nothing. */
  for (let tries = 0; tries < count * 4 && picked.length < count; tries++) {
    const i = Math.min(Math.floor(rng() * pool.length), pool.length - 1);
    if (seen.has(i)) continue;
    seen.add(i);
    picked.push(pool[i]);
  }
  return picked;
}

/* Build an opponent team aiming at `targetPower`.

   Greedy per slot: sample a handful of candidates, keep whichever lands the
   running total closest to the share of the target this slot should carry.
   Excluding the player's own cards is deliberate — an AI mirror of your best
   card reads as the game cheating, even when it is arithmetically fair. */
export function buildOpponentTeam(pool, targetPower, { rng = Math.random, exclude = new Set(), now = Date.now() } = {}) {
  const available = pool.filter(ch => !exclude.has(String(ch?.id)));
  if (!available.length) return [];

  const team = [];
  let running = 0;

  for (let slot = 0; slot < TEAM_SIZE && available.length; slot++) {
    const slotsLeft = TEAM_SIZE - slot;
    /* What this slot should contribute for the team to land on target: the
       remaining gap shared evenly across the slots still to fill. */
    const wanted = (targetPower - running) / slotsLeft;

    const candidates = sample(available, SAMPLE_PER_SLOT, rng);
    let best = null;
    let bestGap = Infinity;
    for (const channel of candidates) {
      const gap = Math.abs(powerOf(toCombatant(channel, now)) - wanted);
      if (gap < bestGap) { bestGap = gap; best = channel; }
    }
    if (!best) break;

    team.push(best);
    running += powerOf(toCombatant(best, now));
    /* Drawn without replacement — the same creator twice on one side would
       read as a bug long before it read as a strategy. */
    const at = available.indexOf(best);
    if (at !== -1) available.splice(at, 1);
  }

  return team;
}

/* The entry point a UI calls: given the player's chosen team and a pool to
   draw from, return an opponent at the requested difficulty. */
export function matchOpponent(playerChannels, pool, { difficulty = 'even', rng = Math.random, now = Date.now() } = {}) {
  const setting = DIFFICULTY[difficulty] ?? DIFFICULTY.even;
  const player = playerChannels.slice(0, TEAM_SIZE).map(ch => toCombatant(ch, now));
  const target = teamPower(player) * setting.factor;
  const exclude = new Set(player.map(u => u.id));

  const channels = buildOpponentTeam(pool, target, { rng, exclude, now });
  return {
    channels,
    difficulty: setting,
    targetPower: Math.round(target),
    actualPower: teamPower(channels.map(ch => toCombatant(ch, now))),
  };
}

/* Did the match land where it was asked to? Exposed so the UI can be honest
   about a pool too thin to hit the target — a shallow collection cannot
   always produce an even fight, and silently handing the player a much
   stronger AI is worse than telling them. */
export function matchQuality({ targetPower, actualPower }) {
  if (!targetPower) return { close: true, drift: 0 };
  const drift = (actualPower - targetPower) / targetPower;
  return { close: Math.abs(drift) <= CLOSE_ENOUGH, drift };
}
