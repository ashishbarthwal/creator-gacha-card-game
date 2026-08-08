/* battle-stats — PURE. Channel -> the five battle axes -> HP/ATK/DEF/SPD/MOM.
   No I/O, no DOM, no randomness. Same rules as core.js, one folder over.

   ── WHY THESE AXES AND NOT THE SEVEN IN THE PROPOSAL ───────────────────────
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
   zero quota. The remaining axes wait for a Phase 3 that only happens if the
   combat loop earns it.

   ── VELOCITY IS A RE-EXPRESSION, NOT NEW INFORMATION, AND IT IS IN ANYWAY ──
   Recorded because it would otherwise be re-argued: subs-per-year looks like a
   free Momentum proxy — it does separate the channel that reached 10M in two
   years from the one that took fifteen — but it is NOT independent of the axes
   already here. With only {subs, views, videos, age} there are exactly three
   independent ratios plus a duration, and all four are already spent. The
   identity is exact in log space:

       log(subs/age) = log(views/videos) + log(videos/age) - log(views/subs)
                     =     punch         +     cadence     -     devotion

   Measured on the live 23,539-card deck, velocity regressed on those three
   gives R^2 = 0.77 with coefficients +0.85 / +1.04 / -1.19 — the predicted
   +1/+1/-1 signature, arriving on its own. The remaining ~23% is the anchors'
   different scales and their clamped tails, not a new signal.

   It is kept because a stat's job is to be LEGIBLE as well as informative, and
   nothing about "punch plus cadence minus devotion" is legible while "won its
   audience fast" is. The measured cost of adding it is small and known: the
   share of small cards out-rating the median giant moves 30.6% -> 23.5%
   (threshold 15%), and attack stays flat with size at 1.02. What it buys is a
   sixth class and a much flatter class distribution — the largest class drops
   from 35% to 28% and all six are populated.

   Also measured, because the fear was specific and wrong: momentum does NOT
   compound with the glass cannon. corr(mom share, atk share) = -0.13. It runs
   against DEFENCE (-0.71) and HEALTH (-0.55), so a Riser buys its ramp with
   toughness. That is a trade a player can see, which is the whole point.

   ── ELEMENT IS THE GENUINELY NEW SIGNAL ───────────────────────────────────
   The one free thing on this call that is not a re-expression of the numbers
   is `topicDetails.topicCategories` — what the channel is ABOUT. It lives in
   engine/element.js and enters combat as a matchup multiplier rather than a
   stat, because it is a claim about kind, not degree.

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

import { elementOf } from './element.js';

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
  /* The upper bound is set by the TREND, not by the observed spread, and that
     is the one anchor here chosen on a different principle. Read off the data
     the way the others were (1st to 99th percentile) it would sit at 6.2 — and
     at 6.2 the fitted trend predicts 126 for a maximum-Influence channel, off a
     scale that stops at 100. Every card at the very top would then have had a
     capped raw value compared against an uncappable expectation, and floored to
     velocity 0: the largest channels in the game would all have read as having
     grown slowest. Widening to 8.0 puts expected(100) at 97.5, so the line
     stays on the scale across the whole Influence range and nothing is clipped
     by construction. */
  velocityLog: [0.3, 8.0],    // ~1 -> ~1e8 subscribers won per year
};

/* The compression that keeps rarity out of raw power. BUDGET_BASE is what
   every card gets before anything is earned; BUDGET_GAIN is the most that
   maximum Influence can add. 200 and 90 put the strongest card at ~1.32x the
   weakest, which is small enough for shape and matchup to overturn. Raising
   BUDGET_GAIN is the single knob that makes the game more pay-to-pull. */
const BUDGET_BASE = 200;
/* 90 until the combat layers landed, then 60 — and the reason is worth
   stating, because "we made size matter less" is not it.

   BUDGET_GAIN is not the whole compression, it is only the FIRST step of it.
   powerOf multiplies several "1 + something/constant" terms together, and every
   one of those somethings is a stat, and every stat is budget-scaled. When the
   rating carried a single such term (defence) a gain of 90 landed the median
   giant at 1.16x the median small card. Momentum and speed added two more, and
   the same 90 compounded through three amplifiers instead of one: the ratio
   went to 1.26 and the share of small cards out-rating the median giant — the
   claim this whole file exists to make true — collapsed from 33.1% to 17.0%,
   a hair above the 15% the balance block allows.

   Measured across the live 23,539-card deck, 60 puts it back: ratio 1.15,
   overlap 32.0%, attack flat with size at 0.95. So the gain came down to keep
   the OUTPUT where it always was, rather than because the design changed its
   mind about how much a big channel should be worth. Retune it whenever a new
   multiplicative term enters powerOf, and retune it against
   `node tools/battle-balance.js` rather than by argument. */
const BUDGET_GAIN = 25;

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

/* The same de-sizing applied to velocity, and it needs the same treatment for
   the same reason: raw subscribers-per-year is dominated by subscribers.
   Measured on the live deck, the residual's correlation with Influence is
   -0.016 — size is gone.

   PROVISIONAL, AND SAY SO. The punch trend was fitted against real numbers.
   This one could not be: no shipped set carries `publishedAt` yet (the
   allowlist dropped it until the battle work), so the fit used the live deck's
   REAL subscriber and view distributions with a SYNTHETIC age profile —
   1.2-19.2 years, near-independent of size, which is what the platform's own
   history implies. The method was validated by re-running the four shipped
   axes through the same synthetic ages and checking they reproduce the
   measured live figures (attack ratio 0.94, small-out-rating-giants 30.6%,
   largest class 35%), which they do.
   Refit against real ages after the first build that ships publishedAt:
   `node tools/battle-balance.js`. A drifting `velocity` mean is the symptom. */
const VELOCITY_TREND = { intercept: 15.672, slope: 0.8186 };
const VELOCITY_SPREAD = 3.5;

/* ── THE SAME TREATMENT, FINALLY APPLIED TO THE OTHER TWO (2026-08-08) ─────
   `punch` and `velocity` were de-sized against Influence from the start,
   because raw views-per-video and raw subscribers-per-year are dominated by
   how big a channel is. `devotion` and `cadence` never were, and measuring the
   live 15,831-card deck says that was the single biggest way size still bought
   power:

       punch  0.004    velocity -0.014     (de-sized, working as designed)
       devotion 0.350  cadence   0.420     (raw — well past the ~0.25 the tool flags)

   Those two feed DEF and SPD, so a big channel was structurally tankier AND
   faster than a small one, on every card, forever. That is precisely the
   "bigger channel is tankier AND hits harder" failure the budget split exists
   to prevent, sneaking back in through two axes that were never given the fix
   the other two got. It is also why picking a team by subscriber count worked
   at all.

   Fitted here the same way punch was — least squares against Influence over
   the live deck, then frozen as constants. Frozen rather than re-fitted per
   build for the reason stated at PUNCH_TREND: a fit that re-ran would make a
   card's DEF depend on which other cards happened to ship, and would leave the
   eight-channel demo set with nothing to fit against.

   Measured after: devotion -0.013, cadence 0.027. Size is gone from both.

   THE SPREADS ARE DELIBERATELY NARROWER THAN PUNCH'S 3.0. Both residuals are
   naturally wider than punch's, so stretching them as hard would pin a quarter
   of the deck at 0 or 100 — the exact "clipped by construction" failure the
   velocityLog anchor comment warns about. At 1.5 the floor and cap stay in the
   few-percent range that punch sits at. */
const DEVOTION_TREND = { intercept: 45.677, slope: 0.2904 };
const DEVOTION_SPREAD = 1.5;
const CADENCE_TREND = { intercept: 28.178, slope: 0.5167 };
const CADENCE_SPREAD = 1.5;

/* Per-stat scale. Shape hands out fractions that sum to 1; these turn those
   fractions into numbers that read well in combat — HP in the hundreds so a
   fight lasts several rounds, SPD small so turn order is legible.

   MOM is scaled far smaller than the rest because it is not a quantity, it is
   a RATE: the number on the card is literally the percent of its attack a card
   gains each round, so a MOM of 12 reads "+12% per round" with no conversion.
   A stat that has to be divided by something before it means anything is a
   stat players do not use. */
/* HP came down from 2.5 when the three combat layers landed. Rows, Aegis and
   the element wheel are all, on net, damage REDUCTIONS, and they pushed a
   median fight from ~6 rounds to 9 with a 16-round tail — fine for a simulator
   and far too long for something a player watches replay. Scaling health is
   the safe pacing knob precisely because it is uniform: every power rating
   moves by the same sqrt factor, so ratios, class mix and the matchmaker are
   untouched. It is the only number in this file that may be tuned for feel. */
/* ── REPRICED 2026-08-08, AND THE REASON IS MEASURED ──────────────────────
   Shape is zero-sum: a card spends ONE budget across five stats. That only
   works as a design if a point of shape buys comparable combat value wherever
   it goes. It did not. Five specialists built from an identical budget and
   fought round-robin came out:

       HP 83.9%   ATK 82.7%   DEF 39.7%   SPD 20.0%   MOM 4.7%

   A point spent on momentum bought about a SEVENTEENTH of what the same point
   bought on health. That is not a stat with a trade-off, it is a trap: the
   player pays full budget and receives almost nothing, and every downstream
   symptom followed from it — a team of the fastest-growing channels lost ~100%
   of its fights, Riser was 7.2% of the deck and unplayable, and "just take the
   five highest-rated cards" was the whole game because rating tracks the two
   stats that actually worked.

   WHY THE MULTIPLIER STATS WERE THE ONES THAT BROKE. SPD and MOM do not deal
   damage, they multiply the attack a card already has — and under a zero-sum
   shape budget, spending on them means having no attack left to multiply. The
   momentum specialist ramped to 2.2x on an attack of 81 while the attack
   specialist simply carried 253. Compounding it, the ramp was capped at +120%,
   so the one card built entirely around ramping hit its ceiling at exactly the
   point the trade was supposed to start paying.

   So MOM's scale and the cap both rise, and they rise together: the scale makes
   a point of momentum worth having, the cap lets a card that committed its
   whole budget actually collect. A Riser (which doubles the rate) now reaches
   the ceiling around round 4 instead of never mattering, which is the "survive
   the early rounds and win the late ones" trade the class was always described
   as making. DEF rises for the same reason at a smaller magnitude. HP comes
   down slightly, because it was the overpriced side of the same imbalance and
   because it is the safe pacing knob — see the note below.

   Retune against `node tools/battle-balance.js`, never by argument. */
const SCALE = { hp: 1.7, atk: 0.5, def: 0.5, spd: 0.42, mom: 0.07 };

/* The ramp cannot run away with a long fight — but +120% was so low that the
   cap bound hardest on the only cards built to reach it, which made momentum
   self-defeating (see the repricing note above). At +220% a card that spent
   its whole budget on growth roughly triples its attack by the late rounds,
   which is worth the health it gave up to get there; a median card (MOM ~13)
   never comes near the cap and is unaffected. */
export const MOMENTUM_CAP = 2.2;

/* Balanced is the one class with no verb, because there is nothing for an
   even shape to be especially good at — inventing a special for it would be
   inventing a specialism. So it is paid in stats instead: a flat lift on every
   number, applied HERE rather than in battle.js so that powerOf sees it and
   the matchmaker never rates a Balanced card as weaker than it fights. */
export const ADAPTIVE_BONUS = 1.08;

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
     velocity  subscribers per year   how FAST it won the audience it has

   None of them can be raised by simply being bigger, which is what makes a
   well-shaped N genuinely able to beat a UR. */
export const BATTLE_AXES = ['maturity', 'punch', 'devotion', 'cadence', 'velocity'];

/* Which axis pays for which battle stat. One driver each, deliberately: if two
   stats share a driver they move together and the class system collapses into
   two archetypes instead of six. */
const AXIS_FOR_STAT = { hp: 'maturity', atk: 'punch', def: 'devotion', spd: 'cadence', mom: 'velocity' };

export const BATTLE_CLASSES = ['Titan', 'Carry', 'Bulwark', 'Assassin', 'Riser', 'Balanced'];

const CLASS_FOR_STAT = { hp: 'Titan', atk: 'Carry', def: 'Bulwark', spd: 'Assassin', mom: 'Riser' };

/* An even five-way split. Named rather than written as 0.2 in three places,
   because it moved when the fifth axis landed and every threshold below is
   relative to it. */
const EVEN_SHARE = 1 / BATTLE_AXES.length;

/* A card counts as a specialist only when its dominant share clears an even
   split by this much. Below it the card is genuinely well-rounded and calling
   it a Titan because HP won by a hair would be noise, not a read.

   Held at the same RELATIVE size as the four-axis version (it was 0.04 over
   0.25, so ~16%): with five axes an even split is smaller, and keeping the
   absolute number would have quietly made every card a specialist. */
const SPECIALIST_MARGIN = 0.045;

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

  /* How hard the audience it already has actually watches — DE-SIZED against
     Influence, exactly as punch is, so what survives is "watched harder than a
     channel this size usually is" rather than "big". 50 is exactly on trend.
     Hidden subscriber counts arrive as absent, which would divide by zero and
     hand those cards an infinite score — they read as the middle instead, on
     the same "unknown is not extreme" rule as maturity. */
  const rawDevotion = subs > 0
    ? norm(Math.log10(views / subs + 1), ANCHOR.devotionLog)
    : 50;
  const devotionExpected = DEVOTION_TREND.intercept + DEVOTION_TREND.slope * influence;
  const devotion = subs > 0
    ? Math.max(0, Math.min(100, 50 + (rawDevotion - devotionExpected) * DEVOTION_SPREAD))
    : 50;

  /* Output rate. Separates the daily grinder from the once-a-season poster, and
     de-sized for the same reason as the rest: a large channel usually posts
     more, so raw cadence was reading as size. Without an age, treat the whole
     library as one year's work — an upper bound, which keeps prolific demo
     channels reading as prolific. */
  const perYear = age === null || age < 0.5 ? videos : videos / age;
  const rawCadence = norm(Math.log10(perYear + 1), ANCHOR.cadenceLog);
  const cadenceExpected = CADENCE_TREND.intercept + CADENCE_TREND.slope * influence;
  const cadence = Math.max(0, Math.min(100, 50 + (rawCadence - cadenceExpected) * CADENCE_SPREAD));

  /* How fast the audience was won — de-sized against Influence exactly as
     punch is, so what survives is "faster than a channel this size usually
     grows", not "big". 50 is exactly on trend.

     Without an age the whole library reads as one year's work, matching
     cadence's fallback: an upper bound, so a dateless demo card reads as a
     fast riser rather than as a dead one. It is the same choice made for the
     same reason — unknown must not read as worst. */
  const subsPerYear = age === null || age < 0.5 ? subs : subs / age;
  const rawVelocity = norm(Math.log10(subsPerYear + 1), ANCHOR.velocityLog);
  const velocityExpected = VELOCITY_TREND.intercept + VELOCITY_TREND.slope * influence;
  const velocity = Math.max(0, Math.min(100, 50 + (rawVelocity - velocityExpected) * VELOCITY_SPREAD));

  return {
    influence: Math.round(influence),
    maturity: Math.round(maturity),
    punch: Math.round(punch),
    devotion: Math.round(devotion),
    cadence: Math.round(cadence),
    velocity: Math.round(velocity),
  };
}

/* Shape: the four axes measured against EACH OTHER inside one card, as four
   fractions summing to 1. This is the size-free half of the design — it asks
   "what is this creator relatively best at", a question whose answer does not
   move when the channel grows. A card with nothing at all splits evenly rather
   than dividing by zero. */
export function shapeFrom(axes) {
  const total = BATTLE_AXES.reduce((sum, key) => sum + (axes[key] ?? 0), 0);
  if (total <= 0) {
    return Object.fromEntries(Object.keys(AXIS_FOR_STAT).map(stat => [stat, EVEN_SHARE]));
  }
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
  for (const stat of Object.keys(AXIS_FOR_STAT)) {
    if ((shape[stat] ?? 0) > bestShare) { bestShare = shape[stat] ?? 0; best = stat; }
  }
  return bestShare >= EVEN_SHARE + SPECIALIST_MARGIN ? CLASS_FOR_STAT[best] : 'Balanced';
}

/* The whole derivation, and the only function the rest of the game needs.
   Deterministic: the same channel and the same `now` always produce the same
   combatant, which is what lets the balance tests assert distributions rather
   than sample them. */
export function battleStatsFrom(channel, now = Date.now()) {
  const axes = axesFrom(channel, now);
  const shape = shapeFrom(axes);
  const budget = BUDGET_BASE + BUDGET_GAIN * (axes.influence / 100);

  /* xN because shape sums to 1 across N stats: without it every stat would be
     1/N of the budget and the SCALE numbers would have to absorb it. Read off
     BATTLE_AXES rather than written as a literal, so adding a sixth axis one
     day cannot silently rescale every card in the game. */
  const n = BATTLE_AXES.length;
  const klass = classFrom(shape);
  const lift = klass === 'Balanced' ? ADAPTIVE_BONUS : 1;
  const stat = key => Math.max(1, Math.round(budget * shape[key] * n * SCALE[key] * lift));

  return {
    axes,
    shape,
    class: klass,
    element: elementOf(channel),
    budget: Math.round(budget),
    hp: stat('hp'),
    atk: stat('atk'),
    def: stat('def'),
    spd: stat('spd'),
    /* Percent of its own attack this card gains each round. A real stat bought
       out of the same budget as the others, so a ramp is paid for in toughness
       rather than handed out free. */
    mom: stat('mom'),
    /* Crit is the small chaos term. It rides on the SPD share because the same
       spiky, high-cadence profile that acts first is the one that should
       occasionally spike — and it is capped well below certainty so a fight is
       never decided by a single roll. The coefficient rose from 0.6 to 0.75
       when the fifth axis shrank every share by a fifth, so the felt crit rate
       is unchanged. */
    crit: Math.min(0.35, 0.05 + 0.75 * shape.spd),
  };
}

/* The attack multiplier a card carries into `round` (1-based). Exported so the
   UI can show a Riser's ramp climbing without re-deriving the rule, and so
   powerOf below and battle.js cannot disagree about it. */
export function momentumMultiplier(combatant, round, doubled = false) {
  const rate = (combatant?.mom ?? 0) / 100 * (doubled ? 2 : 1);
  return 1 + Math.min(MOMENTUM_CAP, rate * Math.max(0, round - 1));
}

/* The two combat constants live HERE rather than in battle.js, because
   powerOf below has to agree with them exactly and battle.js already imports
   from this file — putting them the other way round would be a cycle, and
   keeping two copies would let the rating drift away from the fight it is
   supposed to predict. */
export const MITIGATION_K = 110;
export const CRIT_MULTIPLIER = 1.6;

/* ── WHAT SPEED BUYS ───────────────────────────────────────────────────────
   A chance to act twice in a round, and it had to buy SOMETHING because for a
   while it bought nothing at all.

   Speed originally decided turn order and only turn order. Measured on the
   prototype deck, that made the Assassin — the single largest class, 34% of
   the cards — a card that had spent its entire budget on a stat with almost no
   effect: median power 165 against a Carry's 427, and a team of the five best
   Assassins could only reach 72% of a matched mixed team's rating and then
   lost 200 fights out of 200. Two of the six classes (Assassin and Riser) were
   never picked by the matchmaker or by a player's auto-pick, because the
   rating correctly judged them weak.

   The fix is not to rate them higher, which would just hand players a card
   that under-performs its number. HP survives, ATK damages, DEF mitigates, MOM
   ramps — so speed acts AGAIN, which is the one thing left and the thing the
   stat already implies.

   THE FLOOR HAS TO SIT WELL BELOW THE DISTRIBUTION, and the first attempt put
   it at 90 — right on the median (live deck: SPD p05 19, p50 98, p90 166, p99
   206). That quietly re-coupled power to SIZE, which is the one thing this
   whole file exists to prevent. Speed itself is size-free as a SHAPE, but the
   stat is still budget-scaled like every other, so a giant's 129 and a small
   card's 98 sit either side of a floor at 90 and the ratio between what they
   earn explodes from 1.3x to 4.9x. Measured: the share of small cards
   out-rating the median giant fell from 33.1% to 14.4%, straight through the
   floor of what the balance block allows.

   At 20 the floor only excludes the bottom few percent — cards that barely act
   at all, which is the case it is there for — and the amplification drops back
   to 1.4x against a raw stat ratio of 1.3x. A threshold near the middle of a
   distribution is a multiplier on whatever the distribution is sorted by; a
   threshold in its tail is just a floor. */
const SPD_FLOOR = 20;
/* 300 -> 190 as part of the 2026-08-08 repricing. Speed measured at 20.0%
   against a 50% target, and it suffers the same structural problem momentum
   does: an extra action multiplies an attack the card could not afford. Unlike
   momentum this one cannot be fixed by widening a cap, because the payoff
   saturates by construction — `extraActionChance` is a PROBABILITY, so even a
   perfect roll buys at most one more swing per round, and two swings of a
   budget attack still lose to one swing of a real one.

   So this is a partial fix by design: it takes the top of the speed range from
   ~0.64 expected extra actions to a reliable 1, which is the whole of what the
   current mechanic can give. Speed remains the weakest place to spend a budget,
   and closing that properly needs a second thing for speed to buy (evasion, or
   a genuine multi-action roll) rather than another constant. Recorded rather
   than quietly left at 20%. */
const SPD_PER_EXTRA = 190;

export function extraActionChance(spd) {
  return Math.max(0, Math.min(1, ((spd ?? 0) - SPD_FLOOR) / SPD_PER_EXTRA));
}

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
/* A fight runs about six rounds at these numbers, so the average momentum
   multiplier over one is the ramp at round ~3. Stated as a constant because
   the rating must not depend on how long a PARTICULAR fight ran — it is a
   prediction made before the fight, and a matchmaker that consulted the
   outcome would not be a matchmaker. */
const TYPICAL_ROUNDS = 6;

export function powerOf(combatant) {
  const effectiveHp = combatant.hp * (1 + combatant.def / MITIGATION_K);
  /* Momentum is folded into DAMAGE rather than added as a term of its own: it
     multiplies the attack a card already has, so a ramp on a weak attack is
     worth little and a ramp on a Carry is worth a lot — which is exactly how
     it plays. Leaving it out entirely was the alternative, and it would have
     made every Riser systematically under-rated, so the matchmaker would have
     handed players "even" fights they lose. */
  const ramp = 1 + (combatant.mom ?? 0) / 100 * ((TYPICAL_ROUNDS - 1) / 2);
  /* Speed enters as expected ACTIONS per round, for the reason spelled out at
     extraActionChance: a rating that could not see what speed does rated two
     whole classes into oblivion, and the matchmaker faithfully never picked
     them. */
  const damage = combatant.atk
    * (1 + combatant.crit * (CRIT_MULTIPLIER - 1))
    * Math.min(1 + MOMENTUM_CAP, ramp)
    * (1 + extraActionChance(combatant.spd));
  return Math.round(Math.sqrt(effectiveHp * damage));
}
