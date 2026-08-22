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

import { toCombatant, makeTeam, teamPower, formationBonus, TEAM_SIZE, FRONT_SLOTS } from './battle.js';
import { powerOf, MITIGATION_K } from './battle-stats.js';
import { ELEMENT_CYCLE, elementMultiplier } from './element.js';
import { bandsFrom, pullOne } from './gacha.js';

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
  /* THROUGH makeTeam, not a bare map of toCombatant — the formation bonus
     (battle.js) lives in makeTeam, so rating the player's five card-by-card
     would under-price a diverse team by up to 14% and hand it an opponent it
     is meant to beat. "Even match" has to mean even against the team that
     actually takes the field. */
  const player = makeTeam(playerChannels, now);
  const target = teamPower(player) * setting.factor;
  const exclude = new Set(player.map(u => u.id));

  const channels = aimedBuild(pool, target, { rng, exclude, now });
  return {
    channels: arrangeFormation(channels, now),
    difficulty: setting,
    targetPower: Math.round(target),
    /* Through makeTeam so the reported figure includes the formation bonus the
       team will actually fight with — matchQuality compares it against the
       target, and a rating that omitted the bonus would report a fair match as
       fair while fielding something 6% stronger. */
    actualPower: teamPower(makeTeam(arrangeFormation(channels, now), now)),
  };
}

/* Build to a target the assembled team will actually HIT.

   THE AI PICKS FOR VARIETY (pickForSlot scores class and element diversity
   above a tie in raw power), so it reliably ends up with four or five distinct
   classes — which since 2026-08-08 means it reliably collects the formation
   bonus. Aiming the greedy walk at the raw target therefore overshot by the
   whole size of that bonus on almost every build: measured, the balance tool's
   even-match win rate fell from 45% to ~30%, because the matchmaker was
   promising a fair fight and delivering a 6%-stronger opponent every time.

   Two passes rather than one. The first build is a probe: assemble a team, see
   what lift it earns, then rebuild aiming at target/lift so the LIFTED rating
   lands on target. Cheap (the pool sample is 40 cards a slot), and it cannot
   loop — the second pass is final whatever it earns. The rng is shared across
   both passes on purpose: it stays seeded and reproducible, and the second team
   genuinely differs from the probe rather than being a re-derivation of it. */
function aimedBuild(pool, target, opts) {
  const probe = buildOpponentTeam(pool, target, opts);
  const { lift } = formationBonus(probe, opts.now);
  if (lift === 1 || probe.length < TEAM_SIZE) return probe;
  const corrected = buildOpponentTeam(pool, target / lift, opts);
  return corrected.length === TEAM_SIZE ? corrected : probe;
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
/* ── AUTO SELECT'S HIERARCHY (2026-08-15) ────────────────────────────────────
   Ash's brief, items 4-6: Auto Select is "a fun convenience feature, not a
   mathematical optimizer" and must never bench a significantly stronger card
   to chase marginally better synergy — "UR + mediocre synergy should
   generally be preferred over N + slightly better synergy". The stated
   priority order (power, rarity, subscriber power, class diversity, obvious
   elemental advantage, formation) reads as ONE ranking with a tie-break, not
   six independent scores, and that is what a narrow tolerance window gives
   for free: `powerOf` already folds rarity and subscriber power into a single
   number (see the 2026-08-15 rebalance in battle-stats.js), so sorting by
   power already carries the top three priorities in the list. Diversity and
   element only get a vote among candidates that are ALREADY close on power —
   never as a reason to reach past a card that clearly outclasses them.

   8% is deliberately tight. It is meant to catch the case the brief actually
   describes — "SSR + neutral element vs R/N + favorable element" where the
   two cards were going to trade places anyway — not to let a modest UR lose a
   slot to a perfectly-countering N, which is the exact outcome item 4 rules
   out by name. */
const SYNERGY_TOLERANCE = 0.08;

/* Which elements would land an attack advantage against at least one element
   the opponent fields. Built off `elementMultiplier` rather than walking
   `ELEMENT_CYCLE` by hand, so this can never disagree with the wheel the fight
   itself uses to decide the same question. */
function counterElements(enemy, now) {
  if (!enemy?.length) return null;
  const enemyElements = new Set(enemy.map(ch => toCombatant(ch, now).element));
  return new Set(ELEMENT_CYCLE.filter(e => [...enemyElements].some(d => elementMultiplier(e, d) > 1)));
}

/* Greedy, slot by slot: take the strongest remaining card unless something
   within the tolerance window offers a class the team does not have yet, or —
   when an opponent is known — an element that counters them. Ties within the
   window still fall back to power, so "close enough to matter" never becomes
   "close enough to ignore power entirely". */
function pickBestTeam(pool, { count, wantedElements }) {
  const remaining = [...pool];
  const picked = [];
  const usedClasses = new Set();

  for (let slot = 0; slot < count && remaining.length; slot++) {
    remaining.sort((a, b) => b.power - a.power || a.ch.id.localeCompare(b.ch.id));
    const window = remaining[0].power * (1 - SYNERGY_TOLERANCE);
    const eligible = remaining.filter(r => r.power >= window);

    const score = r => (usedClasses.has(r.class) ? 0 : 2) + (wantedElements?.has(r.element) ? 1 : 0);
    const best = eligible.reduce((b, r) => (score(r) - score(b) || r.power - b.power) > 0 ? r : b, eligible[0]);

    picked.push(best);
    usedClasses.add(best.class);
    remaining.splice(remaining.indexOf(best), 1);
  }
  return picked.map(r => r.ch);
}

/* Auto Select's engine: the five cards a player gets when they press
   Auto-pick, or the ceiling `draftPower` reads off a draft. `enemy` is
   optional and only ever narrows toward cards the player could already see —
   passing the scouted opponent (accept-a-challenge mode) is what lets Auto
   Select use the "obvious elemental advantage" step of the brief's hierarchy;
   omitting it (quick battle, draft mode, where no enemy exists yet) simply
   drops that one factor and the rest of the hierarchy is unaffected. */
export function bestTeamFrom(draft, { now = Date.now(), count = TEAM_SIZE, enemy = null } = {}) {
  /* Deduped for the same reason buildOpponentTeam is: the input here is a
     draft, and "your five strongest" must not be one card five times. */
  const pool = distinctById(draft).map(ch => {
    const unit = toCombatant(ch, now);
    return { ch, power: powerOf(unit), class: unit.class, element: unit.element };
  });
  return pickBestTeam(pool, { count, wantedElements: counterElements(enemy, now) });
}

export function draftPower(draft, { now = Date.now() } = {}) {
  /* Same reason matchOpponent uses it: this is the ceiling of what a draft
     could FIELD, and what it fields is a team, which carries a formation
     bonus. */
  return teamPower(makeTeam(bestTeamFrom(draft, { now }), now));
}

/* Build the AI's line-up out of ITS OWN draft, aimed at a difficulty-scaled
   share of what the player's draft could field, and arranged into a formation.
   No `exclude` here — the two drafts are pulled separately, so an overlap is
   the gacha genuinely handing both sides the same creator rather than the AI
   mirroring a pick it could see. */
export function draftOpponent(playerDraft, aiDraft, { difficulty = 'even', rng = Math.random, now = Date.now() } = {}) {
  const setting = DIFFICULTY[difficulty] ?? DIFFICULTY.even;
  const target = draftPower(playerDraft, { now }) * setting.factor;
  const picked = aimedBuild(aiDraft, target, { rng, now });
  const channels = arrangeFormation(picked, now);
  return {
    channels,
    difficulty: setting,
    targetPower: Math.round(target),
    actualPower: teamPower(makeTeam(channels, now)),
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

/* ── THE AI'S OWN COLLECTION (2026-08-15) ──────────────────────────────────
   Quick battle used to build its opponent with `matchOpponent`: a team aimed
   at the player's own rating, assembled out of the entire 15,890-card set.
   That produces an even fight by construction, and it is the wrong kind of
   even — the AI was never a PLAYER, it was a difficulty setting wearing five
   cards. Nothing it fielded had anything to do with luck, a collection, or
   the same odds the player pulls on, so "I finally pulled a RUBY" changed
   nothing about the fight it walked into.

   So the AI now gets a COLLECTION instead of a target: the same number of
   distinct cards the player owns, drawn on the same band-first weighted odds
   from the same set, and then it builds its best five out of that with the
   same Auto Select the player has. Same rules on both sides of the table —
   which is exactly the model a live 1v1 already runs on, so Quick battle
   stops being a different game from the one the arena teaches.

   NOT A SIMULATED PULL SESSION. It draws straight through `pullOne` rather
   than replaying x10s: no dupe bookkeeping, no reveal, no animation, nothing
   the player would ever see. The only property that has to survive is the
   drop curve, and `bandsFrom`/`pullOne` ARE that curve — the same two
   functions the real pull screen uses, so the AI's collection cannot drift
   from the odds the player pulls on without the player's own pulls drifting
   with it.

   DISTINCT cards, because that is the unit the player's side is counted in
   (`myChannels()` dedupes by id, and a team may not field one creator twice).
   Drawing `size` times would hand the AI fewer usable cards than the player
   by however many dupes it happened to roll, which is a quiet handicap rather
   than a fair one.

   Overlap with the player's collection is ALLOWED, matching `draftOpponent`'s
   reasoning: two independently drawn collections sharing a creator is the
   gacha doing its job, not the AI copying a pick it could see. */
/* How many consecutive already-owned draws before the sampler stops rolling
   against the whole pool and starts rolling against what is left of it. */
const STALL_LIMIT = 32;

export function rollAiCollection(cards, size, { rng = Math.random } = {}) {
  /* Deduped up front so the target can be clamped to what the pool can
     actually yield, rather than discovered by exhausting it — which is what
     stops a thin set (the bundled demo, a hand-built live banner) from
     spinning. */
  const byId = new Map();
  for (const card of cards ?? []) {
    const id = String(card?.channel?.id ?? '');
    if (id && !byId.has(id)) byId.set(id, card);
  }
  const target = Math.min(size, byId.size);
  if (target <= 0) return [];

  const picked = new Map();
  let remaining = [...byId.values()];
  let bands = bandsFrom(remaining);
  let misses = 0;

  /* TWO SAMPLERS, AND THE SECOND ONE IS NOT AN OPTIMISATION — IT IS THE ONLY
     REASON THIS TERMINATES AT THE RIGHT COUNT. Rolling against the full pool
     and discarding duplicates is the cheap, obviously-correct-looking way to
     do this, and it silently cannot finish: RUBY is 0.1% of the weight, so on
     a pool holding two of them the chance of never drawing a specific one
     across a thousand rolls is better than even. Under a fixed try-cap that
     hands the AI a collection SMALLER than the player's — the exact unfairness
     this function exists to remove, reintroduced by the sampler.

     So a run of duplicates is treated as evidence that the pool is picked over,
     and the bands are rebuilt from what is genuinely left. Every subsequent
     roll then lands on an unpicked card, which both guarantees progress and
     keeps the draw weighted: the rebuild renormalises over the remaining
     bands, which is exactly weighted sampling WITHOUT replacement rather than
     a uniform mop-up that would quietly flatten the odds at the tail. */
  while (picked.size < target && bands.length) {
    const card = pullOne(bands, rng);
    const id = String(card?.channel?.id ?? '');
    if (id && !picked.has(id)) {
      picked.set(id, card.channel);
      misses = 0;
    } else if (++misses > STALL_LIMIT) {
      remaining = remaining.filter(c => !picked.has(String(c?.channel?.id ?? '')));
      bands = bandsFrom(remaining);
      misses = 0;
    }
  }
  return [...picked.values()];
}

/* The whole Quick-battle opponent: roll a collection the size of the player's,
   then field the best five out of it, arranged. Returns the channels plus the
   collection they came from, so a caller can say how big the AI's binder was
   without drawing it twice. */
export function collectionOpponent(cards, size, { now = Date.now(), rng = Math.random } = {}) {
  const collection = rollAiCollection(cards, size, { rng });
  return {
    collection,
    channels: arrangeFormation(bestTeamFrom(collection, { now }), now),
  };
}
