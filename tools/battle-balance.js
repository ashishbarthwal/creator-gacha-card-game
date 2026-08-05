#!/usr/bin/env node
/* tools/battle-balance — measure the battle engine against a real deck.

   The balance BLOCK in test/battle.test.js asserts the design goals; this tool
   is what you use to find the numbers those assertions should hold at, and to
   re-check them against the live 23.5k-card deck rather than against a
   fixture. Same relationship as `npm run status` has to the sourcing: the test
   says "still true", the tool says "how true, and where".

   Run:  node tools/battle-balance.js                 (live set if built, else synthetic)
         node tools/battle-balance.js --synthetic     (fixture only, no set needed)
         node tools/battle-balance.js --fights 400    (more matchmaking samples)

   ── THE AGE PROBLEM, STATED UP FRONT ──────────────────────────────────────
   Two of the five axes need `publishedAt`, and no set built before the battle
   work carries it — the allowlist in setbuild.js was dropping it. When a set
   has no dates this tool SYNTHESIZES them (1.2-19.2 years, near-independent of
   size, which is what the platform's own history implies) and says so loudly,
   because a maturity figure computed from invented ages is a statement about
   the model and not about the deck.

   The method was validated rather than assumed: running the four shipped axes
   through these synthetic ages reproduces the figures measured on the real
   deck when the engine had four axes (attack ratio 0.94, small-out-rating-
   giants 30.6%, largest class 35%). Once a set ships real dates, the synthetic
   path stops firing on its own and the velocity trend in battle-stats.js
   should be refitted from the `velocity` line this prints. */

import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

import { axesFrom, battleStatsFrom, powerOf, BATTLE_AXES, BATTLE_CLASSES } from '../src/engine/battle-stats.js';
import { battle, makeTeam, resolveBattle, TEAM_SIZE } from '../src/engine/battle.js';
import { matchOpponent, arrangeFormation } from '../src/engine/opponent.js';
import { ELEMENTS, elementOf } from '../src/engine/element.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : Number(args[at + 1]);
};

const NOW = Date.parse('2026-08-04T00:00:00Z');
const yearsAgo = y => new Date(NOW - y * 365.25 * 24 * 3600 * 1000).toISOString();

/* mulberry32 — the same seeded PRNG the tests use, so a reported figure can be
   reproduced exactly from the seed printed beside it. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash01 = s => {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/* ── THE SYNTHETIC DECK ────────────────────────────────────────────────────
   Rebuilt (2026-08-05) from the live deck's MEASURED QUANTILES, replacing a
   version whose subscriber counts were log-uniform from 1e3 to 3e8. That
   fixture violated the invariants the engine is calibrated against — 42.5% of
   it sat pegged at devotion = 100 and 28.3% at cadence = 100 — so it tested
   the fixture rather than the game: exactly the trap its own comment warned
   about after the same thing had already happened to `punch`.

   Quantiles rather than a fitted normal, and that is the second correction.
   A normal on log10(subs) was tried first and still failed the balance block
   (small cards out-rating the median giant came out at 13% against 33% on the
   real deck) for one reason: the real deck's subscriber counts run down to
   single digits, and clamping the fixture at 1,000 cut off the whole bottom
   two decades. That flattened the variance in the small band, which is
   precisely the band the interesting claim is about. YouTube's size
   distribution is not normal in log space and pretending otherwise deleted
   the tail that mattered.

   The size-free ratios are drawn independently; the size-COUPLED one is not.
   views-per-video is set from the punch trend plus symmetric noise, so punch
   residuals are centred at every size BY CONSTRUCTION — feeding the engine
   data with no size/punch correlation would drive every large channel's
   residual to the floor, which is the failure the previous fixture rewrite
   already documented. */
/* THE TOP TAIL NEEDS ITS OWN POINTS. Interpolating straight from p99 (13.8M)
   to the maximum (511M) spreads the top percent uniformly across a decade and
   a half, which invents hundreds of 100M-subscriber channels where the real
   deck has nine. That single missing bend was enough to fail the balance
   block: the fixture's giant band came out 1.42x the small band's power
   against 1.26x measured on the real thing. A quantile table is only as honest
   as its resolution where the curve bends hardest. */
const SUBS_QUANTILES = [   // log10(subscriberCount), live deck
  [0, 0.6], [0.01, 0.903], [0.05, 2.236], [0.10, 3.053], [0.25, 3.468],
  [0.50, 4.230], [0.75, 5.246], [0.90, 6.033], [0.95, 6.467], [0.99, 7.140],
  [0.996, 7.389], [0.999, 7.769], [0.9999, 8.155], [1, 8.708],
];
const DEVOTION_QUANTILES = [  // log10(viewCount / subscriberCount), live deck
  [0, 0.9], [0.05, 1.503], [0.25, 2.088], [0.50, 2.420], [0.75, 2.736], [0.95, 3.179], [1, 4.2],
];

function fromQuantiles(table, u) {
  for (let i = 1; i < table.length; i++) {
    const [p0, v0] = table[i - 1];
    const [p1, v1] = table[i];
    if (u <= p1) return v0 + ((u - p0) / (p1 - p0 || 1)) * (v1 - v0);
  }
  return table[table.length - 1][1];
}

const clampNorm = (v, lo, hi) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));

export function syntheticDeck(n = 4000) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const mix = k => { let x = (i * 2654435761 + k * 40503) >>> 0; x ^= x >>> 13; x = Math.imul(x, 1274126177) >>> 0; return (x ^ (x >>> 16)) >>> 0; };
    const frac = k => (mix(k) + 0.5) / 4294967296;

    const subs = Math.max(1, Math.round(10 ** fromQuantiles(SUBS_QUANTILES, frac(1))));
    const views = Math.max(1, Math.round(subs * 10 ** fromQuantiles(DEVOTION_QUANTILES, frac(2))));

    const influence = 0.6 * clampNorm(Math.log10(subs + 1), 3, 8.477) + 0.4 * clampNorm(Math.log10(views + 1), 4, 11.477);
    const targetPunch = Math.max(0, Math.min(100, 17.459 + 0.8151 * influence + (frac(3) * 2 - 1) * 18));
    const videos = Math.max(1, Math.round(views / Math.max(1, 10 ** (1.5 + (targetPunch / 100) * 7) - 1)));

    out.push({
      id: 'UC' + String(i).padStart(22, '0'),
      title: `Channel ${i}`,
      subscriberCount: String(subs),
      hiddenSubscriberCount: false,
      viewCount: String(views),
      videoCount: String(videos),
      publishedAt: yearsAgo(1 + frac(4) * 18),
      /* Spread evenly across the wheel rather than shaped like YouTube: what
         is measured here is whether the MECHANIC is balanced, and an even
         wheel is the case where it has to be. */
      element: ELEMENTS[Math.floor(frac(6) * ELEMENTS.length)],
    });
  }
  return out;
}

/* Read the manifest rather than a hardcoded filename, so a renamed or
   re-slugged deck (Series 1 -> Core Set, 2026-08-05) is picked up without a
   second edit here — the same reason build-set.js's own manifest merge exists. */
const BUILT_DIR = resolve(ROOT, 'sets/built');

async function loadLiveDeck() {
  try {
    const manifest = JSON.parse(await readFile(resolve(BUILT_DIR, 'index.json'), 'utf8'));
    const first = manifest?.sets?.[0];
    if (!first?.file) return { channels: null, slug: null };
    const raw = await readFile(resolve(ROOT, first.file), 'utf8');
    return { channels: JSON.parse(raw).channels ?? [], slug: first.slug };
  } catch {
    return { channels: null, slug: null };
  }
}

const mean = xs => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const quant = (xs, p) => { const a = [...xs].sort((x, y) => x - y); return a[Math.floor(p * (a.length - 1))] ?? 0; };
function corr(a, b) {
  const ma = mean(a), mb = mean(b);
  let n = 0, d1 = 0, d2 = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); d1 += (a[i] - ma) ** 2; d2 += (b[i] - mb) ** 2; }
  return d1 && d2 ? n / Math.sqrt(d1 * d2) : 0;
}
const pct = x => `${(x * 100).toFixed(1)}%`;

async function main() {
  const fights = opt('fights', 360);
  const live = flag('synthetic') ? { channels: null, slug: null } : await loadLiveDeck();
  let deck = live.channels;
  let source = live.slug ? `sets/built/${live.slug}.json` : null;
  if (!deck?.length) { deck = syntheticDeck(4000); source = 'synthetic fixture (4,000 cards)'; }

  const dated = deck.filter(c => c.publishedAt).length;
  if (dated < deck.length) {
    console.log(`  ! ${deck.length - dated} of ${deck.length} cards carry no publishedAt — ages SYNTHESIZED for this run.`);
    console.log('    maturity, cadence and velocity below describe the model, not the deck.');
    console.log('    Rebuild the set (npm run deploy) and re-run to measure real ages.\n');
    deck = deck.map(c => c.publishedAt ? c : { ...c, publishedAt: yearsAgo(1.2 + 18 * hash01(c.id)) });
  }

  console.log(`Deck: ${source} — ${deck.length} cards\n`);

  // ── axes ──────────────────────────────────────────────────────────────────
  const axes = deck.map(c => axesFrom(c, NOW));
  console.log('AXES                med    p05    p95   corr(size)   floor    cap');
  for (const key of BATTLE_AXES) {
    const xs = axes.map(a => a[key]);
    console.log(`  ${key.padEnd(16)}${String(quant(xs, 0.5)).padStart(4)}${String(quant(xs, 0.05)).padStart(7)}${String(quant(xs, 0.95)).padStart(7)}` +
      `${corr(xs, axes.map(a => a.influence)).toFixed(3).padStart(11)}` +
      `${pct(xs.filter(v => v <= 0).length / xs.length).padStart(9)}${pct(xs.filter(v => v >= 100).length / xs.length).padStart(7)}`);
  }
  console.log('\n  Any |corr(size)| above ~0.25 means that axis has stopped being size-free,');
  console.log('  which is the failure the residual trends in battle-stats.js exist to prevent.');

  // ── classes and elements ──────────────────────────────────────────────────
  const stats = deck.map(c => battleStatsFrom(c, NOW));
  const tally = (xs, keys) => {
    const counts = Object.fromEntries(keys.map(k => [k, 0]));
    for (const x of xs) counts[x] = (counts[x] ?? 0) + 1;
    return counts;
  };
  const classes = tally(stats.map(s => s.class), BATTLE_CLASSES);
  console.log('\nCLASSES  ' + Object.entries(classes).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${pct(v / stats.length)}`).join('   '));
  const biggest = Math.max(...Object.values(classes)) / stats.length;
  console.log(`  largest class ${pct(biggest)}  ${biggest < 0.5 ? 'OK' : 'FAILS — a class system where one class is most of the deck is not one'}`);

  const elements = tally(deck.map(c => elementOf(c)), ELEMENTS);
  console.log('\nELEMENTS ' + Object.entries(elements).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${pct(v / deck.length)}`).join('   '));
  if ((elements.Unaligned ?? 0) / deck.length > 0.5) {
    console.log('  ! Most of the deck is Unaligned — this set predates topicDetails, so the');
    console.log('    element layer is inert. Rebuild to make matchups mean anything.');
  }

  // ── stat spread ───────────────────────────────────────────────────────────
  console.log('\nSTATS (median)  ' + ['hp', 'atk', 'def', 'spd', 'mom']
    .map(k => `${k.toUpperCase()} ${quant(stats.map(s => s[k]), 0.5)}`).join('   '));

  // ── size must not decide the fight ────────────────────────────────────────
  const small = deck.filter(c => Number(c.subscriberCount) < 100_000);
  const huge = deck.filter(c => Number(c.subscriberCount) >= 10_000_000);
  const statOf = (cards, key) => mean(cards.map(c => battleStatsFrom(c, NOW)[key]));
  const powerMed = cards => quant(cards.map(c => powerOf(battleStatsFrom(c, NOW))), 0.5);
  const medGiant = powerMed(huge);
  const overlap = small.filter(c => powerOf(battleStatsFrom(c, NOW)) > medGiant).length / (small.length || 1);

  console.log(`\nSIZE  (${small.length} under 100K, ${huge.length} over 10M)`);
  console.log(`  attack   giant/small  ${(statOf(huge, 'atk') / statOf(small, 'atk')).toFixed(2)}   (target ~1.0, must stay 0.74-1.35)`);
  console.log(`  health   giant/small  ${(statOf(huge, 'hp') / statOf(small, 'hp')).toFixed(2)}`);
  console.log(`  power    median ratio ${(medGiant / powerMed(small)).toFixed(2)}   (must stay under 1.4)`);
  console.log(`  small cards out-rating the median giant  ${pct(overlap)}   (must stay over 15%)`);

  // ── the fight itself ──────────────────────────────────────────────────────
  const rounds = [];
  let wins = 0, played = 0, wipes = 0;
  const perTeam = 40;
  for (let t = 0; t * perTeam < fights; t++) {
    const start = (t * 137) % Math.max(1, deck.length - TEAM_SIZE);
    /* BOTH sides are arranged by the same rule. The matchmaker's fairness is
       the claim under test, and letting only the AI place its formation would
       measure the formation layer instead — which is a real advantage, and
       exactly the one a player is meant to earn by thinking. */
    const player = arrangeFormation(deck.slice(start, start + TEAM_SIZE), NOW);
    if (player.length < TEAM_SIZE) continue;
    const m = matchOpponent(player, deck, { difficulty: 'even', rng: mulberry32(start + 3), now: NOW });
    for (let s = 1; s <= perTeam; s++) {
      const r = battle(player, m.channels, { rng: mulberry32(s), now: NOW });
      if (r.winner === 'a') wins++;
      if (r.survivors.a === 0 || r.survivors.b === 0) wipes++;
      rounds.push(r.rounds);
      played++;
    }
  }
  console.log('\nFIGHTS');
  console.log(`  even-match win rate   ${pct(wins / played)}   over ${played} fights   (must stay 30-70%)`);
  console.log(`  length                median ${quant(rounds, 0.5)} rounds, p95 ${quant(rounds, 0.95)}   (aim 5-10; a replay has to be watchable)`);
  console.log(`  decided by elimination ${pct(wipes / played)}   (a fight going to the round cap is a stalemate the player watched)`);
}

/* Only run when invoked directly. `syntheticDeck` is exported so an experiment
   can import the same fixture the tool measures, and an import that printed a
   full report as a side effect would make that useless. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => { console.error(err); process.exit(1); });
}
