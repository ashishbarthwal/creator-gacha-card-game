/* battle-stats — PURE. Channel -> the four battle axes -> HP/ATK/DEF/SPD.
   No I/O, no DOM, no randomness. Same rules as core.js, one folder over.

   ── WHY THESE FOUR AXES AND NOT THE SEVEN IN THE PROPOSAL ──────────────────
   The v1 battle proposal specified seven core stats: Influence, Momentum,
   Community, Consistency, Virality, Legacy, Stability. Five of those need
   PER-VIDEO statistics — average views of recent uploads, likes/comments per
   view, variance across uploads. A shipped card carries three numbers
   (subscriberCount, viewCount, videoCount), and getting per-video data costs a
   `playlistItems.list` call PER CHANNEL that cannot be batched: ~33,000 quota
   units for one rebuild of a 23.5k-card deck against a 10,000/day ceiling,
   versus the 488 units the whole build costs today. That is not a tuning
   problem, it is a 67x one, and it would break the weekly refresh outright.

   So this file derives everything from data already on the card, plus
   publishedAt — which channels.list ALREADY returns in the snippet we already
   fetch, and which setbuild's allowlist simply threw away. Adding it costs
   zero quota. The remaining three axes wait for a Phase 3 that only happens if
   the combat loop earns it.

   ── WHY FIXED ANCHORS AND NOT PERCENTILES ─────────────────────────────────
   Mapping log(subs) onto 0-100 needs a range. Ranking each card against the
   rest of the deck is the obvious way and it is wrong here, for a reason that
   is structural rather than aesthetic: a card's stats would change when OTHER
   cards were added, and the bundled demo set — eight fictional channels, no
   network, the first thing every visitor sees — has no deck to rank against.
   The data seam promises demo/sets/live are indistinguishable downstream.
   Percentile normalization would break that promise. Absolute anchors keep it:
   a channel's numbers alone decide its stats, forever, in any set.

   ── WHY SIZE BUYS A BUDGET AND NOT A BONUS ────────────────────────────────
   The proposal's own principle 4 says rarity must not determine battle
   strength, but its formulas said otherwise: HP came from Legacy+Influence and
   Attack from Momentum+Influence, and all three of those scale with channel
   size. Bigger channel, more HP AND more damage — and crit does not rescue the
   small card, because crit multiplies an attack that is already larger. The
   stated vision was unreachable from the stated math.

   The fix is the split below. Influence sets only the SIZE OF THE BUDGET, and
   that budget is compressed hard (a 300M-subscriber channel gets ~1.3x the
   points of a 1K one, not ~10x). Where those points GO is decided by the
   card's own SHAPE — the four axes measured against each other, within one
   card, which makes shape entirely size-independent. A giant tends to flat,
   balanced numbers; a small channel with one breakout video is a glass cannon.
   That is what lets a well-shaped N beat a UR, and it is why rarity can
   honestly mean "how hard this was to pull" and nothing else. */

/* Anchors: the value that reads as 0 and the value that reads as 100. Chosen
   from the real shape of the deck rather than round numbers — the top channel
   in the pool is ~300M subscribers, and YouTube itself is only ~21 years old,
   so 20 years is a full career. Every anchor is applied in log space except
   age, because subscriber counts span six orders of magnitude and years do
   not. */
const ANCHOR = {
  subsLog:   [3, 8.477],      // 1e3 -> 3e8 subscribers
  viewsLog:  [4, 11.477],     // 1e4 -> 3e11 lifetime views
  maturity:  [0, 20],         // brand new -> a full YouTube career, in years
  cadenceLog: [0, 2.563],     // log10(1+x): ~0 -> 365 uploads a year
  punchLog:  [1.5, 8.5],      // ~32 -> ~3e8 lifetime views per video
  devotionLog: [0.7, 3.7],    // ~5 -> ~5000 lifetime views per subscriber
};

/* The compression that keeps rarity out of raw power. BUDGET_BASE is what
   every card gets before anything is earned; BUDGET_GAIN is the most that
   maximum Influence can add. 200 and 90 put the strongest card at ~1.32x the
   weakest, which is small enough for shape and matchup to overturn. Raising
   BUDGET_GAIN is the single knob that makes the game more pay-to-pull. */
const BUDGET_BASE = 200;
const BUDGET_GAIN = 90;

/* The size-vs-punch trend line, fitted once against the live 23.5k-card deck
   and then FROZEN as a constant — the same reasoning that rules out percentile
   normalization everywhere else in this file. A fit that re-ran per build would
   make a card's ATK depend on which other cards happened to ship, and would
   leave the eight-channel demo set with nothing to fit against.
   Refit deliberately if the deck's composition ever shifts hard; a drifting
   `punch` mean is the symptom. PUNCH_SPREAD stretches the residuals, which are
   naturally narrow, across a usable slice of the 0-100 range. */
const PUNCH_TREND = { intercept: 17.459, slope: 0.8151 };
const PUNCH_SPREAD = 3.0;

/* Per-stat scale. Shape hands out fractions that sum to 1; these turn those
   fractions into numbers that read well in combat — HP in the hundreds so a
   fight lasts several rounds, SPD small so turn order is legible. */
const SCALE = { hp: 2.5, atk: 0.5, def: 0.42, spd: 0.42 };

/* THE SHAPE AXES ARE ALL RATIOS, AND THAT IS THE WHOLE TRICK — it is also a
   correction, made after measuring the first attempt against the real 23.5k
   deck rather than trusting the design. That version fed `influence` and
   `legacy` into the shape alongside two ratios, on the theory that comparing a
   card's axes to EACH OTHER cancelled size out. It does not. Both of those
   axes climb with channel size while the ratios do not, so their SHARE of the
   shape climbs too: the deck came out 82% Assassin with zero Titans, and
   average HP still ran 686 at N against 1311 at UR. Precisely the "bigger
   channel is tankier AND hits harder" failure the budget split exists to stop,
   sneaking back in through the denominator.

   So size now touches the budget and nothing else. Every axis below is a RATIO
   or a DURATION — a quantity a channel can score highly on at any size:

     cadence   videos per year        a 20K channel can out-upload a 20M one
     punch     views per video        20 videos at 23M views is not 649 at 23M
     devotion  views per subscriber   how hard the audience it has actually watches
     maturity  years since launch     an old small channel is still old

   None of them can be raised by simply being bigger, which is what makes a
   well-shaped N genuinely able to beat a UR. */
export const BATTLE_AXES = ['maturity', 'punch', 'devotion', 'cadence'];

/* Which axis pays for which battle stat. One driver each, deliberately: if two
   stats share a driver they move together and the class system collapses into
   two archetypes instead of five. */
const AXIS_FOR_STAT = { hp: 'maturity', atk: 'punch', def: 'devotion', spd: 'cadence' };

export const BATTLE_CLASSES = ['Titan', 'Carry', 'Bulwark', 'Assassin', 'Balanced'];

const CLASS_FOR_STAT = { hp: 'Titan', atk: 'Carry', def: 'Bulwark', spd: 'Assassin' };

/* A card counts as a specialist only when its dominant share clears an even
   split by this much. Below it the card is genuinely well-rounded and calling
   it a Titan because HP won by a hair would be noise, not a read. */
const SPECIALIST_MARGIN = 0.04;

function toCount(value) {
  const n = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/* Clamp to the anchors and rescale to 0-100. Everything below the low anchor
   reads 0 rather than negative, so a dead channel cannot hand a teammate
   points by having its share go negative in the shape step. */
function norm(value, [lo, hi]) {
  if (!Number.isFinite(value)) return 0;
  if (hi <= lo) return 0;
  const t = (value - lo) / (hi - lo);
  return Math.max(0, Math.min(100, t * 100));
}

/* Channel age in years. publishedAt is an ISO date from the channel snippet.
   `now` is injected rather than read from a clock so a build — and a test — is
   reproducible; the same discipline gacha.js applies to Math.random. */
export function channelAgeYears(publishedAt, now = Date.now()) {
  if (!publishedAt) return null;
  const started = Date.parse(publishedAt);
  if (!Number.isFinite(started)) return null;
  const years = (now - started) / (365.25 * 24 * 60 * 60 * 1000);
  return years > 0 ? years : 0;
}

/* The four axes, each 0-100.

   AGE IS ALLOWED TO BE MISSING, and that is a requirement rather than a
   defensive habit. The bundled demo set carries no publishedAt — it is eight
   fictional channels written by hand — and it is the offline-first path every
   visitor meets before any network call resolves. So Legacy falls back to
   being carried by lifetime views alone, which is the half of "legacy" that
   survives without a date. A card with no age is never a zero-Legacy card. */
export function axesFrom(channel, now = Date.now()) {
  const subs = toCount(channel?.subscriberCount);
  const views = toCount(channel?.viewCount);
  const videos = toCount(channel?.videoCount);
  const age = channelAgeYears(channel?.publishedAt, now);

  /* Reach. The ONLY size-carrying number here, and it leaves this function
     bound for the budget alone — never for shape. Subscribers lead because
     they are the audience a creator keeps; lifetime views follow because they
     are the audience a creator reached. */
  const influence = 0.6 * norm(Math.log10(subs + 1), ANCHOR.subsLog)
                  + 0.4 * norm(Math.log10(views + 1), ANCHOR.viewsLog);

  /* Years on the platform. AGE IS ALLOWED TO BE MISSING and that is a
     requirement, not a defensive habit: the bundled demo set is eight
     fictional channels with no publishedAt, and it is the offline-first path
     every visitor meets before a single network call resolves. A missing date
     reads as the middle of the range rather than zero — unknown is not new,
     and a demo card must not be born with the worst HP in the game. */
  const maturity = age === null ? 50 : norm(age, ANCHOR.maturity);

  /* Punch per upload — MEASURED AGAINST WHAT THIS CHANNEL'S SIZE PREDICTS,
     which is the last place size leaked in and the subtlest of the three.

     Raw views-per-video is a real signal (649 videos at 23M views is 35K a
     video; 20 videos at the same 23M is 1.15M) but it is not size-free: bigger
     audiences produce more views on every upload, so raw punch ran 38 at N
     against 99 at UR and dragged ATK up 2.4x with it. Flat HP and DEF do not
     help if the biggest card simply out-damages everyone.

     So the axis is the RESIDUAL: fit what punch a channel of this Influence
     normally has, and score the gap. 50 means exactly on trend for its size,
     above means it punches above its weight, below means it under-performs its
     own audience. A 200K-subscriber channel whose videos land like a 5M one
     now reads as a genuine Carry, and the UR that coasts on reach does not.
     This is the axis that produces the reaction the proposal was written
     around: "I didn't expect this mid-sized creator to be so strong." */
  const perVideo = videos > 0 ? views / videos : views;
  const rawPunch = norm(Math.log10(perVideo + 1), ANCHOR.punchLog);
  const expected = PUNCH_TREND.intercept + PUNCH_TREND.slope * influence;
  const punch = Math.max(0, Math.min(100, 50 + (rawPunch - expected) * PUNCH_SPREAD));

  /* How hard the audience it already has actually watches. Hidden subscriber
     counts arrive as absent, which would divide by zero and hand those cards
     an infinite score — they read as the middle instead, on the same "unknown
     is not extreme" rule as maturity. */
  const devotion = subs > 0
    ? norm(Math.log10(views / subs + 1), ANCHOR.devotionLog)
    : 50;

  /* Output rate. Separates the daily grinder from the once-a-season poster.
     Without an age, treat the whole library as one year's work — an upper
     bound, which keeps prolific demo channels reading as prolific. */
  const perYear = age === null || age < 0.5 ? videos : videos / age;
  const cadence = norm(Math.log10(perYear + 1), ANCHOR.cadenceLog);

  return {
    influence: Math.round(influence),
    maturity: Math.round(maturity),
    punch: Math.round(punch),
    devotion: Math.round(devotion),
    cadence: Math.round(cadence),
  };
}

/* Shape: the four axes measured against EACH OTHER inside one card, as four
   fractions summing to 1. This is the size-free half of the design — it asks
   "what is this creator relatively best at", a question whose answer does not
   move when the channel grows. A card with nothing at all splits evenly rather
   than dividing by zero. */
export function shapeFrom(axes) {
  const total = BATTLE_AXES.reduce((sum, key) => sum + (axes[key] ?? 0), 0);
  if (total <= 0) return { hp: 0.25, atk: 0.25, def: 0.25, spd: 0.25 };
  const share = {};
  for (const [stat, axis] of Object.entries(AXIS_FOR_STAT)) {
    share[stat] = (axes[axis] ?? 0) / total;
  }
  return share;
}

/* The class is a READ of the shape, not an input to it. It exists so a player
   can glance at a card and know what it does, which is the proposal's actual
   success criterion — nothing downstream branches on it. */
export function classFrom(shape) {
  let best = null;
  let bestShare = -Infinity;
  for (const stat of ['hp', 'atk', 'def', 'spd']) {
    if (shape[stat] > bestShare) { bestShare = shape[stat]; best = stat; }
  }
  return bestShare >= 0.25 + SPECIALIST_MARGIN ? CLASS_FOR_STAT[best] : 'Balanced';
}

/* The whole derivation, and the only function the rest of the game needs.
   Deterministic: the same channel and the same `now` always produce the same
   combatant, which is what lets the balance tests assert distributions rather
   than sample them. */
export function battleStatsFrom(channel, now = Date.now()) {
  const axes = axesFrom(channel, now);
  const shape = shapeFrom(axes);
  const budget = BUDGET_BASE + BUDGET_GAIN * (axes.influence / 100);

  /* x4 because shape sums to 1 across four stats: without it every stat would
     be a quarter of the budget and the SCALE numbers would have to absorb it. */
  const stat = key => Math.max(1, Math.round(budget * shape[key] * 4 * SCALE[key]));

  return {
    axes,
    shape,
    class: classFrom(shape),
    budget: Math.round(budget),
    hp: stat('hp'),
    atk: stat('atk'),
    def: stat('def'),
    spd: stat('spd'),
    /* Crit is the small chaos term. It rides on the SPD share because the same
       spiky, high-cadence profile that acts first is the one that should
       occasionally spike — and it is capped well below certainty so a fight is
       never decided by a single roll. */
    crit: Math.min(0.35, 0.05 + 0.6 * shape.spd),
  };
}

/* The two combat constants live HERE rather than in battle.js, because
   powerOf below has to agree with them exactly and battle.js already imports
   from this file — putting them the other way round would be a cycle, and
   keeping two copies would let the rating drift away from the fight it is
   supposed to predict. */
export const MITIGATION_K = 110;
export const CRIT_MULTIPLIER = 1.6;

/* One number for "how strong is this card", used ONLY for matchmaking — never
   inside combat, where the individual stats do the work.

   IT IS A COMBAT RATING, NOT A SUM OF STATS, and that is a correction rather
   than a flourish. The first version added budget, attack and health with
   hand-picked weights, and the matchmaker built on it produced opponents that
   lost 100% of the time despite being rated equal: a sum cannot see that
   defence multiplies health, or that a team with the same total spread
   differently is not the same team. Equal ratings that produce lopsided fights
   make "even match" a lie, which is the one thing this mode cannot be.

   So the rating is what actually decides a fight: how much damage a card can
   absorb, times how much it deals. Defence is folded into health through the
   same mitigation curve combat uses, crit into damage through the same
   multiplier, and the geometric mean keeps the two in balance — a glass cannon
   and an unarmed wall both rate low, which is correct, and neither can be
   traded for the other at par. */
export function powerOf(combatant) {
  const effectiveHp = combatant.hp * (1 + combatant.def / MITIGATION_K);
  const damage = combatant.atk * (1 + combatant.crit * (CRIT_MULTIPLIER - 1));
  return Math.round(Math.sqrt(effectiveHp * damage));
}
