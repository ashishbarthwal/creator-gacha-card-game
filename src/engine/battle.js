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

   ── WHAT IS DELIBERATELY NOT HERE ─────────────────────────────────────────
   No healing, no buffs, no debuffs, no per-class abilities. The proposal's
   Support and Controller classes need Community and Consistency, which need
   per-video data this project cannot afford yet (see battle-stats.js). Classes
   here are a READ of a card's shape, not a behaviour switch. Combat depth
   comes second, after the loop proves it is worth deepening. */

import { battleStatsFrom, powerOf, MITIGATION_K, CRIT_MULTIPLIER } from './battle-stats.js';

export const TEAM_SIZE = 5;

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
   well-built team. */
const VARIANCE = 0.25;

/* Turn a card into a combatant: battle stats plus the mutable fight state.
   `card` keeps whatever the caller passed (a channel, a collection entry) so
   the UI can render a real card from an event without a second lookup. */
export function toCombatant(channel, now = Date.now()) {
  const stats = battleStatsFrom(channel, now);
  return {
    id: String(channel?.id ?? ''),
    title: String(channel?.title ?? ''),
    channel,
    ...stats,
    maxHp: stats.hp,
    currentHp: stats.hp,
  };
}

export function makeTeam(channels, now = Date.now()) {
  return channels.slice(0, TEAM_SIZE).map(ch => toCombatant(ch, now));
}

export function teamPower(team) {
  return team.reduce((sum, unit) => sum + powerOf(unit), 0);
}

const isAlive = unit => unit.currentHp > 0;

/* Target selection: the first living enemy in team order. Predictable on
   purpose — a player who put their tank in slot 1 should see it soak first,
   and "focus the weakest" would make team ORDER the only decision that
   mattered while making it invisible. */
function firstAlive(team) {
  return team.find(isAlive) ?? null;
}

/* One attack. Returns the event rather than mutating and reporting separately,
   so the log is the single source of truth about what happened. */
function strike(attacker, defender, rng) {
  const mitigation = MITIGATION_K / (MITIGATION_K + defender.def);
  const swing = 1 + (rng() * 2 - 1) * VARIANCE;
  const crit = rng() < attacker.crit;
  const raw = attacker.atk * mitigation * swing * (crit ? CRIT_MULTIPLIER : 1);
  const damage = Math.max(1, Math.round(raw));

  defender.currentHp = Math.max(0, defender.currentHp - damage);

  return {
    type: 'attack',
    attacker: attacker.id,
    attackerTitle: attacker.title,
    defender: defender.id,
    defenderTitle: defender.title,
    damage,
    crit,
    defenderHp: defender.currentHp,
    defeated: defender.currentHp === 0,
  };
}

/* Turn order for one round: everyone alive, fastest first. Ties break on the
   unit's fixed slot rather than on rng, so a seeded fight is reproducible even
   when two cards share a Speed — which they often do, since SPD is rounded. */
function turnOrder(teams) {
  const units = [];
  for (const [side, team] of teams.entries()) {
    team.forEach((unit, slot) => { if (isAlive(unit)) units.push({ side, slot, unit }); });
  }
  return units.sort((a, b) =>
    b.unit.spd - a.unit.spd || a.side - b.side || a.slot - b.slot);
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

    for (const { side, unit } of turnOrder([teamA, teamB])) {
      /* Re-checked every turn: a unit that was alive when the order was fixed
         may have been killed earlier in this same round. */
      if (!isAlive(unit)) continue;
      const target = firstAlive(side === 0 ? teamB : teamA);
      if (!target) break;
      log.push({ round, side: side === 0 ? 'a' : 'b', ...strike(unit, target, rng) });
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

  log.push({ type: 'end', winner, rounds: round });

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
