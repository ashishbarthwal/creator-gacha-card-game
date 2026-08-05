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

import { toCombatant, teamPower, TEAM_SIZE, FRONT_SLOTS } from './battle.js';
import { powerOf, MITIGATION_K } from './battle-stats.js';

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

/* How far off the ideal power a card may be and still be considered, as a
   fraction of what this slot is supposed to carry. Inside this window the
   choice is made on VARIETY instead — see pickForSlot. */
const SLOT_TOLERANCE = 0.12;

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

/* Pick one card for a slot: closest to the power this slot should carry, and
   among the ones that are close ENOUGH, whichever adds most variety.

   VARIETY IS PART OF BEING A CREDIBLE OPPONENT, not a garnish. Picking purely
   on the smallest power gap looks correct and produces a team of near-clones,
   because cards of similar rating in a deck tend to share a shape: the first
   prototype run fielded five Carries, four of them Gaming. That team is dull
   to fight and trivial to counter — one element beat four of its five — and,
   worse, it brings no Titan or Bulwark, so the whole formation layer is inert
   on the AI's side of the board.

   So the power match decides which cards are ELIGIBLE and variety decides
   between them. Class first, because class is what the fight is actually
   shaped by; element second, because a team that is all one element hands the
   player a free counter-pick. Power matching is unaffected outside the
   tolerance window, so `matchQuality` still means what it says. */
function pickForSlot(candidates, wanted, team, now) {
  const rated = candidates.map(channel => {
    const unit = toCombatant(channel, now);
    return { channel, gap: Math.abs(powerOf(unit) - wanted), class: unit.class, element: unit.element };
  });
  if (!rated.length) return null;

  const bestGap = Math.min(...rated.map(r => r.gap));
  const window = Math.max(bestGap, Math.abs(wanted) * SLOT_TOLERANCE);
  const eligible = rated.filter(r => r.gap <= window);

  const classes = new Set(team.map(ch => toCombatant(ch, now).class));
  const elements = new Set(team.map(ch => toCombatant(ch, now).element));
  const variety = r => (classes.has(r.class) ? 0 : 2) + (elements.has(r.element) ? 0 : 1);

  return eligible.reduce((best, r) =>
    (variety(r) - variety(best) || best.gap - r.gap) > 0 ? r : best, eligible[0]).channel;
}

/* Build an opponent team aiming at `targetPower`.

   Greedy per slot: sample a handful of candidates, keep whichever lands the
   running total closest to the share of the target this slot should carry.
   Excluding the player's own cards is deliberate — an AI mirror of your best
   card reads as the game cheating, even when it is arithmetically fair. */
/* Keep the first card of each id.

   A POOL AND A DRAFT ARE NOT THE SAME KIND OF LIST, and that is what this
   fixes. A set has one entry per channel; a DRAFT is the output of five x10
   pulls, and a gacha stacks duplicates by design — pull the same creator twice
   and the list holds them twice. The draw-without-replacement below removed
   the object it picked, which is not the same as removing the CHANNEL, so the
   AI fielded the same creator in two slots. Caught in the prototype, where the
   opposition turned up with "Grim Grove" standing next to "Grim Grove", which
   reads as a bug long before it reads as a strategy — the same reason the
   original no-repeats rule exists. */
function distinctById(channels) {
  const seen = new Set();
  return (channels ?? []).filter(ch => {
    const id = String(ch?.id ?? '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function buildOpponentTeam(pool, targetPower, { rng = Math.random, exclude = new Set(), now = Date.now() } = {}) {
  const available = distinctById(pool).filter(ch => !exclude.has(String(ch?.id)));
  if (!available.length) return [];

  const team = [];
  let running = 0;

  for (let slot = 0; slot < TEAM_SIZE && available.length; slot++) {
    const slotsLeft = TEAM_SIZE - slot;
    /* What this slot should contribute for the team to land on target: the
       remaining gap shared evenly across the slots still to fill. */
    const wanted = (targetPower - running) / slotsLeft;

    const candidates = sample(available, SAMPLE_PER_SLOT, rng);
    const best = pickForSlot(candidates, wanted, team, now);
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
    channels: arrangeFormation(channels, now),
    difficulty: setting,
    targetPower: Math.round(target),
    actualPower: teamPower(channels.map(ch => toCombatant(ch, now))),
  };
}

/* ── FORMATION ─────────────────────────────────────────────────────────────
   Rows made slot order a decision, which means the AI now has to make it too —
   an opponent that fielded its Carry in slot 0 would hand the player a free
   win and teach them nothing.

   Front-worthiness is EFFECTIVE health (the same hp x defence product powerOf
   uses, so the two cannot disagree about what "tanky" means) plus a bonus for
   the two classes whose verbs only work from the front: a Bulwark's Aegis is
   dead weight in the back rank, and a Titan taunting from the back only starts
   mattering once the front has already fallen. Everything else — the Carry,
   the Assassin, the Riser that needs rounds to ramp — wants cover.

   Within the back rank the order is tankiest-first, because that rank becomes
   the front rank the moment the front one dies. */
const FRONT_CLASS_BONUS = { Bulwark: 1.45, Titan: 1.30 };

export function frontWorth(unit) {
  const effectiveHp = unit.hp * (1 + unit.def / MITIGATION_K);
  return effectiveHp * (FRONT_CLASS_BONUS[unit.class] ?? 1);
}

/* Order channels into slots: the two best front-liners first, the rest behind,
   tankiest first. Returns channels (not combatants) so it composes with every
   caller that speaks the Channel shape — the seam's rule applies here too. */
export function arrangeFormation(channels, now = Date.now()) {
  const ranked = channels
    .map(ch => ({ ch, worth: frontWorth(toCombatant(ch, now)) }))
    .sort((a, b) => b.worth - a.worth || String(a.ch?.id).localeCompare(String(b.ch?.id)));
  return ranked.map(r => r.ch).slice(0, FRONT_SLOTS)
    .concat(ranked.map(r => r.ch).slice(FRONT_SLOTS));
}

/* ── DRAFT MODE ────────────────────────────────────────────────────────────
   The arena flow Ash asked for: both sides PULL their own cards, and the AI
   commits its five before the player picks, so the player builds against
   something they can see. That ordering is the whole reason the element wheel
   is worth having — countering an opponent you cannot see is just picking your
   best five again.

   It costs the matchmaker its usual input, though: the player has no team yet
   to match against. So the target is read off the player's DRAFT instead —
   specifically the strongest five in it, which is the ceiling of what they
   could field. Matching the ceiling rather than the average is deliberate: it
   means a player who builds for the matchup rather than for raw power is
   choosing to be under the AI's rating and beating it anyway, which is the
   outcome the whole stat design exists to make possible. */
export function bestTeamFrom(draft, { now = Date.now(), count = TEAM_SIZE } = {}) {
  /* Deduped for the same reason buildOpponentTeam is: the input here is a
     draft, and "your five strongest" must not be one card five times. */
  return distinctById(draft)
    .map(ch => ({ ch, power: powerOf(toCombatant(ch, now)) }))
    .sort((a, b) => b.power - a.power || String(a.ch?.id).localeCompare(String(b.ch?.id)))
    .slice(0, count)
    .map(r => r.ch);
}

export function draftPower(draft, { now = Date.now() } = {}) {
  return teamPower(bestTeamFrom(draft, { now }).map(ch => toCombatant(ch, now)));
}

/* Build the AI's line-up out of ITS OWN draft, aimed at a difficulty-scaled
   share of what the player's draft could field, and arranged into a formation.
   No `exclude` here — the two drafts are pulled separately, so an overlap is
   the gacha genuinely handing both sides the same creator rather than the AI
   mirroring a pick it could see. */
export function draftOpponent(playerDraft, aiDraft, { difficulty = 'even', rng = Math.random, now = Date.now() } = {}) {
  const setting = DIFFICULTY[difficulty] ?? DIFFICULTY.even;
  const target = draftPower(playerDraft, { now }) * setting.factor;
  const picked = buildOpponentTeam(aiDraft, target, { rng, now });
  const channels = arrangeFormation(picked, now);
  return {
    channels,
    difficulty: setting,
    targetPower: Math.round(target),
    actualPower: teamPower(channels.map((ch, slot) => toCombatant(ch, now, slot))),
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
