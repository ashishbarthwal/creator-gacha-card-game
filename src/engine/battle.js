/* battle — 5v5 auto-resolved combat. PURE and headless: no DOM, no I/O, and
   randomness only through an injected `rng`, exactly as gacha.js takes it. The
   same seed and the same teams always produce the same fight, which is what
   lets the balance tests assert distributions over thousands of battles
   instead of eyeballing a few.

   ── WHY AUTO-RESOLVE, AND WHY AN EVENT LOG ────────────────────────────────
   Ash's call: 5v5, with the strategy living in team-building rather than in
   per-turn choices. So this module decides the whole fight in one call and
   returns a LOG of what happened, rather than exposing a step-by-step machine
   the UI has to drive. The UI then replays that log at whatever pace looks
   good — the same shape the reveal animation already uses, where the pull is
   decided first and the animation is a presentation of a settled result.

   That split is what keeps a future "choose an action each turn" mode cheap:
   the log is already the interchange format, so a turn-by-turn resolver would
   emit the same events and every renderer would keep working.

   ── WHAT THE THREE LAYERS ARE FOR ─────────────────────────────────────────
   The first version of this file had exactly two decisions in it: which five
   cards you bring, and what order you slot them. Measured, that was too thin —
   a power-matched pair resolved 0% / 100% and stayed there when per-hit
   variance was widened from 0.12 to 0.50, because a 5v5 runs ~25 attacks and
   independent noise averages out over that many trials however wide each roll
   is. The fight was decided entirely by the stats, so there was nothing to
   decide.

   Three layers were added, and the ORDER matters — each one is worth less
   without the one before it:

     1. ELEMENTS  give a card a reason to be brought against a SPECIFIC enemy,
        which is what turns "pick your five best" into "pick your five best
        AGAINST THAT". It is the only one of the three that needs new data, and
        that data is free (engine/element.js).
     2. ROWS      make slot order a real placement rather than a soak queue:
        the back rank cannot be reached until the front falls, and pays for it
        in damage.
     3. CLASSES   were labels; now each has a verb. Without rows most of the
        verbs have nothing to bite on — Aegis protects a rank, Backstab bypasses
        one — which is why classes come last rather than first.

   ── WHAT IS STILL DELIBERATELY NOT HERE ───────────────────────────────────
   No healing, no buffs, no debuffs, no targeted player choices mid-fight. The
   proposal's Support and Controller classes need Community and Consistency,
   which need per-video data this project cannot afford (see battle-stats.js).
   Combat depth stops here until the loop proves it is worth deepening. */

import {
  battleStatsFrom, powerOf, momentumMultiplier,
  MITIGATION_K, CRIT_MULTIPLIER, ADAPTIVE_BONUS, extraActionChance,
} from './battle-stats.js';
import { elementMultiplier, matchupOf } from './element.js';

export const TEAM_SIZE = 5;

/* Slots 0-1 are the front rank, 2-4 the back. Two and three rather than a
   free split: a formation the player can empty is a formation the player will
   empty, and "everyone in the back" would delete the layer. The asymmetry is
   deliberate too — two slots that take every hit and three that pay 15% damage
   for cover is a trade with an obvious question attached (who can survive
   there?), which is what a decision needs to be. */
export const FRONT_SLOTS = 2;
export const ROWS = ['front', 'back'];

export const rowForSlot = slot => (slot < FRONT_SLOTS ? 'front' : 'back');

/* A fight that cannot end is a hung UI, so rounds are capped and a capped
   fight is decided on remaining health rather than called a draw — two teams
   that cannot kill each other still had one of them closer to winning. */
export const MAX_ROUNDS = 30;

/* Damage mitigation (K/(K+def)) and the crit multiplier are imported from
   battle-stats.js rather than declared here: powerOf builds the matchmaking
   rating out of these same two numbers, and a second copy that drifted would
   silently make "even match" uneven. One definition, two readers.

   The curve itself is the standard one — each point of defence is worth
   slightly less than the last, so a Bulwark is hard to kill without ever
   becoming immortal, and K sits near the middle of the observed DEF range so a
   typical card roughly halves incoming damage. */

/* A little noise so identical matchups do not always play out identically.
   Deliberately narrow — this is texture, not a coin flip that overturns a
   well-built team. Widening it was tried and measured; see the header. */
const VARIANCE = 0.25;

/* The cost of cover. A back-rank attacker is hitting past its own front line,
   and pays for the protection it is enjoying. Small enough that stacking your
   damage in the back is a real option, large enough that it is not free. */
const BACK_RANK_ATTACK = 0.85;

/* ── THE CLASS VERBS ───────────────────────────────────────────────────────
   One each, and each one bites on the row layer, which is why classes are
   worth more than the sum of their stats only now that rows exist.

   Exported as data rather than buried in the resolver because the card face
   has to state what a class DOES — a class the player cannot read is back to
   being a label. */
export const CLASS_ABILITY = {
  Titan: {
    name: 'Taunt',
    text: 'Enemy attacks aimed at its rank strike it instead. Assassins ignore this.',
  },
  Bulwark: {
    name: 'Aegis',
    text: 'While it holds the front rank, the whole back rank takes 25% less damage.',
  },
  Assassin: {
    name: 'Backstab',
    text: 'Ignores the front rank and hits the enemy’s hardest hitter.',
  },
  Carry: {
    name: 'Execute',
    text: 'Deals 60% more to any target below 30% health.',
  },
  Riser: {
    name: 'Snowball',
    text: 'Its momentum ramp counts double.',
  },
  Balanced: {
    name: 'Adaptive',
    /* The number is read off the constant rather than typed, so the card face
       cannot end up describing a bonus the engine stopped giving. */
    text: `Has no special, and carries +${Math.round((ADAPTIVE_BONUS - 1) * 100)}% on every stat instead.`,
  },
};

const AEGIS_REDUCTION = 0.75;
const EXECUTE_BONUS = 1.60;
const EXECUTE_THRESHOLD = 0.30;

/* ASSASSIN_OPENER (a x1.25 on round one) was removed 2026-08-08, and the
   reason is the one that should retire any rule: it was a SECOND clause on a
   class that already had a verb, and measurement said nobody would ever notice
   it. Counted over 78,823 attacks on the live deck it fired on 4.9% of them —
   while its text rode on the face of every Assassin, which is 24.7% of the
   deck. A quarter of all cards carried a sentence describing something that
   almost never happens.

   Backstab is the class identity and stays (20.7% of attacks). The opener was
   a modifier on a modifier, and the whole of what it bought was a slightly
   spikier first round — which the crit roll already provides, on 16.1% of
   attacks, with a pop-up that says so. Cutting rules a player cannot observe is
   how a game stays small enough to learn. */

/* Turn a card into a combatant: battle stats plus the mutable fight state.
   `channel` is kept so the UI can render a real card from an event without a
   second lookup, and `slot` is kept because the row rules and the tie-break in
   turn order both need to know where a unit stands. */
export function toCombatant(channel, now = Date.now(), slot = 0) {
  const stats = battleStatsFrom(channel, now);
  return {
    id: String(channel?.id ?? ''),
    title: String(channel?.title ?? ''),
    channel,
    ...stats,
    slot,
    row: rowForSlot(slot),
    maxHp: stats.hp,
    currentHp: stats.hp,
  };
}

/* ── FORMATION: WHAT A MIXED TEAM IS WORTH ─────────────────────────────────
   Added 2026-08-08, and it is the answer to a measured problem rather than a
   flourish. Before it, the whole game was one number: `powerOf` predicts a
   fight accurately, so "bring the five highest-rated cards" beat every other
   strategy 87-100% of the time, and the strategy graph was a strict ladder
   rather than anything with a decision in it. Worse, stacking was actively
   REWARDED — five Titans beat a best-of-each mixed team 99% of the time, five
   Carries 100%.

   The fix cannot be a better rating, because an accurate rating is exactly
   what produces a total order. It has to be something the rating CANNOT SEE.
   Element matchup was already the one such lever and it demonstrably works
   (counter-picking beats a raw-power team ~89%). This is the second: a bonus
   that depends on the SHAPE OF THE TEAM rather than on any card in it.

   That is why it lives here, in `makeTeam`, and not in `battleStatsFrom` — a
   card has no diversity, only a team does, and `powerOf` rates cards. The
   consequence is deliberate: Auto-pick (`bestTeamFrom`, greedy on card rating)
   can no longer see the bonus, so it stops being the optimal play and becomes
   a decent baseline a thinking player beats. That is the whole point.

   REWARDING DIVERSITY RATHER THAN PUNISHING DUPLICATES — Ash's call, and the
   two are mathematically equivalent. The difference is legibility: a card that
   quietly gets weaker because of its neighbours is confusing on a card face,
   while "you earned this for fielding four classes" is a sentence the build
   screen can state and the player can aim at. Three or fewer is the neutral
   baseline, not a penalty, so nothing a player has already built gets worse.

   No bonus for elements. One team-shape lever is a decision; two interacting
   ones is a spreadsheet, and the element wheel already earns its keep by
   pointing at the ENEMY rather than at your own bench. */
/* THE NUMBERS ARE SMALLER THAN THEY LOOK, and the first pass got this wrong by
   a factor of two. A lift applied to every stat raises BOTH sides of
   `powerOf` = sqrt(effective health x damage), so a nominal +14% is roughly
   1.14 x 1.14 = +30% of actual fighting strength. Measured at +14% the diverse
   team beat the raw-power team 89% of the time — the same dominance problem
   over again, just wearing the other hat. Halved, it lands where a choice
   should: worth taking, not automatic. */
export const FORMATION_BONUS = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1.025, 5: 1.05 };

/* ── EVERY KNOB THE COMBAT LOOP OWNS ────────────────────────────────────────
   Same purpose as STAT_TUNING one file over: `tools/battle-balance.js` prints
   live values so a tuning report can never quietly disagree with the engine it
   is reporting on. Frozen — a window, not a control panel. */
export const BATTLE_TUNING = Object.freeze({
  /* Shape of the board. */
  TEAM_SIZE, FRONT_SLOTS, MAX_ROUNDS,
  /* Damage roll spread, +/- this fraction on every swing. The luck dial. */
  VARIANCE,
  /* Reaching from the back rank costs this much attack. */
  BACK_RANK_ATTACK,
  /* Titan's Aegis: incoming damage to the back rank, multiplied. */
  AEGIS_REDUCTION,
  /* Assassin's Execute: bonus, and the health fraction that triggers it. */
  EXECUTE_BONUS, EXECUTE_THRESHOLD,
  /* Team-wide lift by number of distinct classes fielded. */
  FORMATION_BONUS,
});

export function distinctClasses(units) {
  return new Set((units ?? []).map(u => u?.class).filter(Boolean)).size;
}

/* Exported so the team builder can show the bonus while it is still a choice.
   Takes channels rather than combatants so the UI never has to assemble a team
   just to ask what one would be worth. */
export function formationBonus(channels, now = Date.now()) {
  const classes = distinctClasses((channels ?? []).filter(Boolean).map(ch => toCombatant(ch, now)));
  return { classes, lift: FORMATION_BONUS[classes] ?? 1 };
}

/* THE LIFT IS APPLIED TO THE STATS THEMSELVES, not folded into the damage
   formula, and that is what keeps it honest: `teamPower` sums `powerOf` over
   these same combatants, so the matchmaker prices a diverse team correctly
   for free and an "even match" stays even. A bonus applied only inside
   `strike` would have made the rating quietly wrong about every mixed team. */
export function makeTeam(channels, now = Date.now()) {
  const units = channels.slice(0, TEAM_SIZE).map((ch, slot) => toCombatant(ch, now, slot));
  const lift = FORMATION_BONUS[distinctClasses(units)] ?? 1;
  if (lift === 1) return units;
  for (const unit of units) {
    unit.hp = Math.max(1, Math.round(unit.hp * lift));
    unit.atk = Math.max(1, Math.round(unit.atk * lift));
    unit.def = Math.max(1, Math.round(unit.def * lift));
    unit.spd = Math.max(1, Math.round(unit.spd * lift));
    unit.mom = Math.max(1, Math.round(unit.mom * lift));
    /* Re-seated after the lift, not before — `toCombatant` set these from the
       unlifted hp, and a team whose maxHp disagreed with its hp would start
       every fight already wounded. */
    unit.maxHp = unit.hp;
    unit.currentHp = unit.hp;
  }
  return units;
}

export function teamPower(team) {
  return team.reduce((sum, unit) => sum + powerOf(unit), 0);
}

const isAlive = unit => unit.currentHp > 0;

/* ── TARGETING ─────────────────────────────────────────────────────────────
   The whole row layer lives in this one function, which is the point: rows are
   a rule about WHO GETS HIT, not a modifier scattered through the damage
   formula. Everything else about a rank — the 15% attack cost, Aegis — is
   applied where the damage is computed.

   Precedence, and each step is a decision the player made:
     1. An Assassin ignores the wall entirely and goes for the hardest hitter
        it can find in the back. That is the counter to stacking your damage
        behind a Titan, and it is why "Assassins ignore taunt" is not a special
        case but the definition of the class.
     2. Otherwise the front rank is the only reachable rank while any of it
        stands. When it falls, the back rank becomes the front.
     3. Inside the reachable rank, a living Titan takes the hit. */
export function pickTarget(attacker, enemies, { ignoreTaunt = false } = {}) {
  const living = enemies.filter(isAlive);
  if (!living.length) return null;

  const back = living.filter(u => u.row === 'back');
  if (attacker?.class === 'Assassin' && back.length) {
    return back.reduce((best, u) => (u.atk > best.atk ? u : best), back[0]);
  }

  const front = living.filter(u => u.row === 'front');
  const rank = front.length ? front : back;
  if (!ignoreTaunt) {
    const taunting = rank.find(u => u.class === 'Titan');
    if (taunting) return taunting;
  }
  return rank[0];
}

/* Is this unit's back rank currently covered? Aegis is a TEAM effect that only
   works from the front rank, which is the formation decision it exists to
   create: your Bulwark protects everyone else precisely where it is most
   exposed. Non-stacking — two Bulwarks are redundant, which is information a
   player can act on. */
function aegisActive(team) {
  return team.some(u => isAlive(u) && u.class === 'Bulwark' && u.row === 'front');
}

/* One attack. Returns the event rather than mutating and reporting separately,
   so the log is the single source of truth about what happened. Every
   multiplier that applied is named in `tags`, so the UI can explain a number
   instead of just showing it — a 300-damage hit that says why is the
   difference between a system a player can learn and one they cannot. */
function strike(attacker, defender, defenderTeam, round, rng) {
  const tags = [];

  const ramp = momentumMultiplier(attacker, round, attacker.class === 'Riser');
  if (ramp > 1.001) tags.push(attacker.class === 'Riser' ? 'snowball' : 'momentum');

  const mitigation = MITIGATION_K / (MITIGATION_K + defender.def);

  const element = elementMultiplier(attacker.element, defender.element);
  const matchup = matchupOf(attacker.element, defender.element);

  let situational = 1;
  if (attacker.row === 'back') { situational *= BACK_RANK_ATTACK; tags.push('reaching'); }
  if (defender.row === 'back' && aegisActive(defenderTeam)) { situational *= AEGIS_REDUCTION; tags.push('aegis'); }
  if (attacker.class === 'Carry' && defender.currentHp / defender.maxHp < EXECUTE_THRESHOLD) {
    situational *= EXECUTE_BONUS; tags.push('execute');
  }
  if (attacker.class === 'Assassin' && defender.row === 'back') tags.push('backstab');
  if (defender.class === 'Titan' && defender.row === 'front') tags.push('taunt');

  const swing = 1 + (rng() * 2 - 1) * VARIANCE;
  const crit = rng() < attacker.crit;
  const raw = attacker.atk * ramp * mitigation * element * situational * swing * (crit ? CRIT_MULTIPLIER : 1);
  const damage = Math.max(1, Math.round(raw));

  defender.currentHp = Math.max(0, defender.currentHp - damage);

  return {
    type: 'attack',
    attacker: attacker.id,
    attackerTitle: attacker.title,
    attackerSlot: attacker.slot,
    attackerClass: attacker.class,
    attackerElement: attacker.element,
    defender: defender.id,
    defenderTitle: defender.title,
    defenderSlot: defender.slot,
    defenderElement: defender.element,
    damage,
    crit,
    matchup,
    tags,
    defenderHp: defender.currentHp,
    defenderMaxHp: defender.maxHp,
    defeated: defender.currentHp === 0,
  };
}

/* Turn order for one round: everyone alive, fastest first, then the fast ones
   again. Ties break on the unit's fixed slot rather than on rng, so a seeded
   fight is reproducible even when two cards share a Speed — which they often
   do, since SPD is rounded.

   THE SECOND PASS IS WHAT SPEED BUYS (see extraActionChance in
   battle-stats.js). Extra turns are rolled once, here, at the top of the
   round, and they all sort AFTER every first action rather than interleaving.
   That ordering is a readability decision as much as a balance one: "everyone
   acts, then the quick ones act again" is a sentence a player can follow while
   watching, where a fast unit taking two turns back-to-back before a slower
   one has moved at all reads as the replay having skipped something. */
function turnOrder(teams, rng) {
  const units = [];
  for (const [side, team] of teams.entries()) {
    team.forEach((unit, slot) => {
      if (!isAlive(unit)) return;
      units.push({ side, slot, unit, extra: false });
      if (rng() < extraActionChance(unit.spd)) units.push({ side, slot, unit, extra: true });
    });
  }
  return units.sort((a, b) =>
    Number(a.extra) - Number(b.extra) || b.unit.spd - a.unit.spd || a.side - b.side || a.slot - b.slot);
}

function healthFraction(team) {
  const max = team.reduce((sum, u) => sum + u.maxHp, 0);
  if (max <= 0) return 0;
  return team.reduce((sum, u) => sum + u.currentHp, 0) / max;
}

/* Resolve a whole 5v5. Mutates the combatants it is given (they carry the
   fight state), so callers hand it freshly built teams — makeTeam does that.

   Returns { winner, rounds, log, survivors }. `winner` is 'a' | 'b' | 'draw';
   a draw is only possible if both sides somehow end at equal health after the
   round cap, which the tie-break below makes vanishingly rare. */
export function resolveBattle(teamA, teamB, rng = Math.random) {
  const log = [];
  let round = 0;

  while (round < MAX_ROUNDS && teamA.some(isAlive) && teamB.some(isAlive)) {
    round += 1;
    log.push({ type: 'round', round });

    for (const { side, unit, extra } of turnOrder([teamA, teamB], rng)) {
      /* Re-checked every turn: a unit that was alive when the order was fixed
         may have been killed earlier in this same round. */
      if (!isAlive(unit)) continue;
      const enemies = side === 0 ? teamB : teamA;
      const target = pickTarget(unit, enemies);
      if (!target) break;
      const event = strike(unit, target, enemies, round, rng);
      if (extra) event.tags.push('swift');
      log.push({ round, side: side === 0 ? 'a' : 'b', ...event });
    }
  }

  const aAlive = teamA.some(isAlive);
  const bAlive = teamB.some(isAlive);
  let winner;
  if (aAlive && !bAlive) winner = 'a';
  else if (bAlive && !aAlive) winner = 'b';
  else {
    /* Hit the round cap with both sides standing: decide on the fraction of
       health each side has left, which is the closest thing to "who was
       winning". Exact ties are the only genuine draw. */
    const fa = healthFraction(teamA);
    const fb = healthFraction(teamB);
    winner = fa === fb ? 'draw' : (fa > fb ? 'a' : 'b');
  }

  log.push({
    type: 'end',
    winner,
    rounds: round,
    health: { a: healthFraction(teamA), b: healthFraction(teamB) },
  });

  return {
    winner,
    rounds: round,
    log,
    survivors: {
      a: teamA.filter(isAlive).length,
      b: teamB.filter(isAlive).length,
    },
  };
}

/* Convenience for callers holding raw channels rather than combatants. */
export function battle(channelsA, channelsB, { rng = Math.random, now = Date.now() } = {}) {
  return resolveBattle(makeTeam(channelsA, now), makeTeam(channelsB, now), rng);
}

/* ── PREVIEW ───────────────────────────────────────────────────────────────
   What the team-builder needs before a fight is fought: for each of my cards,
   how does it read against the enemy line-up I can already see? Exported from
   here rather than computed in the UI so the advice a player is given comes
   out of the same rules the fight will use. */
export function matchupPreview(channels, enemyChannels, now = Date.now()) {
  const enemies = enemyChannels.map(ch => battleStatsFrom(ch, now));
  return channels.map(ch => {
    const mine = battleStatsFrom(ch, now);
    let strong = 0;
    let weak = 0;
    for (const foe of enemies) {
      const verdict = matchupOf(mine.element, foe.element);
      if (verdict === 'strong') strong += 1;
      else if (verdict === 'weak') weak += 1;
    }
    return { id: String(ch?.id ?? ''), element: mine.element, strong, weak, net: strong - weak };
  });
}
