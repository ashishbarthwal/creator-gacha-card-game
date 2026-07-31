#!/usr/bin/env node
/* tools/magic-search — Magic Search. WP6 turned the randomization on: queries
   are jittered (own order, a 90-day window slid through an 8-year lookback) and
   can now be GENERATED from the keyword vocab rather than hand-listed, so
   re-running stops re-harvesting the same corner of YouTube. A subscriber
   ceiling keeps the giants out. Runs one query at a time:

     search.list (jittered order + window, 100u)
       -> harvest ALL uploaders, deduped
       -> drop channels already seen (this run AND prior runs)
       -> channels.list the rest (1u) -> Channel objects
       -> floor filter -> keep the top PER_QUERY by view rank
       -> assign a sourcing pool

   Runs ACCUMULATE: each run merges into sets/magic-search.draft.json and grows
   the pool, deduping channels across runs so previously found cards stay. Pass
   --fresh (or MS_FRESH=1) to start a clean file. This draft doubles as the
   accumulating store — the seed of the candidate DB the three-tier design wants.

   The set flows through the same seam a fetched set does, so the app renders
   these as ordinary cards. It also self-registers into a gitignored
   sets/index.local.json, so it shows up in the Sets picker in local dev with no
   manifest hand-editing.

   Run:   node tools/magic-search.js                 (built-in query list)
          node tools/magic-search.js cooking guitar  (your own queries)
          node tools/magic-search.js --random 12     (generated from the vocab)
          node tools/magic-search.js --fresh          (start the file over)
   Env:   MS_PER_QUERY=5   cards kept per query
          MS_MAX_SUBS=0    lift the exclude-giants ceiling (default 2M)
   Key:   YOUTUBE_API_KEY env var, else src/config.local.js. Never printed,
          never written to output. Real creator data goes to a gitignored
          *.draft.json, never committed. */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { searchChannelIds, fetchChannelsByIds } from '../src/data/search.js';
import {
  selectChannels, assignPool, buildKeywords, regionReport, mergeRegionReports,
  DEFAULT_FLOOR, DEFAULT_EXCLUDE_COUNTRIES,
} from '../src/engine/discover.js';
import { rarityFromSubs, RARITY_ORDER } from '../src/engine/core.js';

const PER_QUERY = Number(process.env.MS_PER_QUERY ?? 5);

/* WP6: the jitter is ON — `{}` takes SEARCH_JITTER's defaults, so every query
   picks its own order and slides a 90-day window through the lookback. Re-running
   the same query list now returns different creators instead of re-harvesting the
   channels the last run already found and paying 100 quota units to do it. */
const JITTERED = {};

/* The exclude-giants ceiling. A broad query is dominated by a handful of
   enormous channels, and those are both the ones already in the pool and the
   ones with the most to complain about. MS_MAX_SUBS=0 lifts it. */
const MAX_SUBS = Number(process.env.MS_MAX_SUBS ?? 2_000_000) || Infinity;
const FLOOR = { ...DEFAULT_FLOOR, maxSubs: MAX_SUBS };

const DEFAULT_QUERIES = [
  'cooking', 'guitar', 'chess', 'origami', 'skateboarding',
  'watercolor', 'speedrun', 'aquarium', 'calligraphy', 'woodworking',
];

const SET_META = { slug: 'magic-search-draft', title: 'Magic Search — Draft 1', series: 'Magic Search' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETS_DIR = resolve(__dirname, '../sets');
const OUT_PATH = resolve(SETS_DIR, 'magic-search.draft.json');
const OUT_FILE = 'sets/magic-search.draft.json';           // as the app fetches it
const LOCAL_MANIFEST = resolve(SETS_DIR, 'index.local.json');

async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

async function loadKey() {
  const fromEnv = process.env.YOUTUBE_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  try {
    const mod = await import('../src/config.local.js');
    return (mod.YOUTUBE_API_KEY ?? '').trim();
  } catch {
    return ''; // no config.local.js — that is fine, we just have no key
  }
}

function fmtCount(v) {
  if (!Number.isFinite(v)) return '—';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return Math.round(v / 1e3) + 'K';
  return String(v);
}

function fmtSubs(channel) {
  if (channel.hiddenSubscriberCount) return 'hidden';
  return fmtCount(Number(channel.subscriberCount));
}

/* Make the draft loadable from the Sets picker without hand-editing the committed
   manifest: keep an entry in a gitignored sets/index.local.json that the app reads
   in local dev only. Idempotent — re-runs don't duplicate the entry. */
async function registerLocally() {
  const manifest = (await readJson(LOCAL_MANIFEST)) ?? { sets: [] };
  if (!Array.isArray(manifest.sets)) manifest.sets = [];
  const entry = { slug: SET_META.slug, title: SET_META.title, file: OUT_FILE };
  if (!manifest.sets.some(s => s.slug === entry.slug)) manifest.sets.push(entry);
  await writeFile(LOCAL_MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const fresh = rawArgs.includes('--fresh') || process.env.MS_FRESH === '1';
  /* --random [n] generates its queries from the keyword vocab instead of using
     the built-in list or your arguments — the point being that a fixed query
     list keeps finding the same corner of YouTube however hard the per-query
     jitter works. Bare --random defaults to 10. */
  const randomAt = rawArgs.indexOf('--random');
  const randomCount = randomAt === -1 ? 0 : (Number(rawArgs[randomAt + 1]) || 10);
  const args = rawArgs.filter(a => !a.startsWith('--'));

  const queries = randomCount ? buildKeywords(randomCount)
    : args.length ? args
    : DEFAULT_QUERIES;

  const key = await loadKey();
  if (!key) {
    console.error('No API key. Set YOUTUBE_API_KEY, or add YOUTUBE_API_KEY to src/config.local.js.');
    process.exit(1);
  }

  // Accumulate: seed from the existing draft unless --fresh, and dedupe against it.
  const prior = fresh ? [] : ((await readJson(OUT_PATH))?.channels ?? []);
  const channels = [...prior];
  const seen = new Set(prior.map(c => c.id));

  const ceiling = MAX_SUBS === Infinity ? 'no ceiling' : `max ${fmtCount(MAX_SUBS)} subs`;
  console.log(`Magic Search draft — ${queries.length} queries, cap ${PER_QUERY}/query, jittered, ${ceiling}`);
  if (randomCount) console.log(`generated queries: ${queries.join(', ')}`);
  console.log(fresh ? 'starting fresh\n' : `continuing from ${prior.length} existing cards\n`);

  let added = 0;
  const regionReports = [];
  for (const q of queries) {
    try {
      const ids = await searchChannelIds(q, key, JITTERED);
      const freshIds = ids.filter(id => !seen.has(id));      // dedup (this run + prior runs) before we spend the enrich call
      const found = await fetchChannelsByIds(freshIds, key);
      /* Measured over everything hydrated, BEFORE the floor and the cap — that
         is the only honest denominator for "what share could the region filter
         even see", since a channel culled for being too small never reached it. */
      regionReports.push(regionReport(found));
      const kept = selectChannels(found, { floor: FLOOR, cap: PER_QUERY });
      for (const ch of kept) { seen.add(ch.id); channels.push(ch); added++; }
      console.log(`  "${q}": ${ids.length} uploaders (${freshIds.length} new) -> kept ${kept.length}`);
      for (const ch of kept) console.log(`      · ${ch.title} — ${fmtSubs(ch)}`);
    } catch (err) {
      console.log(`  "${q}": ${err.message}`);
    }
  }

  const set = { ...SET_META, snapshotDate: new Date().toISOString().slice(0, 10), channels };
  await writeFile(OUT_PATH, JSON.stringify(set, null, 2) + '\n');
  await registerLocally();

  const rarity = Object.fromEntries(RARITY_ORDER.map(r => [r, 0]));
  const pools = { legends: 0, majority: 0, wildcards: 0 };
  for (const ch of channels) {
    rarity[rarityFromSubs(ch.subscriberCount, ch.hiddenSubscriberCount)]++;
    pools[assignPool(ch)]++;
  }

  console.log(`\n+${added} new -> ${channels.length} unique cards in ${OUT_FILE}`);
  console.log(`  rarity: ${RARITY_ORDER.map(r => `${r} ${rarity[r]}`).join(' · ')}`);
  console.log(`  pools:  legends ${pools.legends} · majority ${pools.majority} · wildcards ${pools.wildcards}`);

  /* The region exclude, measured rather than assumed. Printed every run because
     the number is an input to the launch decision, not a debug detail: the
     filter reads a self-declared field, so its ceiling is the coverage line. */
  const region = mergeRegionReports(regionReports);
  if (region.total) {
    const pct = n => `${((n / region.total) * 100).toFixed(1)}%`;
    const top = Object.entries(region.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 6);
    console.log(`\n  region exclude [${DEFAULT_EXCLUDE_COUNTRIES.join(', ')}] over ${region.total} hydrated channels:`);
    console.log(`    declared a country: ${region.declared} (${pct(region.declared)}) · undeclared: ${region.undeclared} (${pct(region.undeclared)})`);
    console.log(`    excluded: ${region.excluded} (${pct(region.excluded)} of all, ${region.declared ? ((region.excluded / region.declared) * 100).toFixed(1) : '0.0'}% of those that declared)`);
    if (top.length) console.log(`    declared: ${top.map(([c, n]) => `${c} ${n}`).join(' · ')}`);
    console.log(`    ceiling: the filter can never exceed ${pct(region.declared)} — it cannot see the rest.`);
  }
  console.log(`\nView it: run  npx serve , open the app, pick "${SET_META.title}" in the Sets dropdown.`);
}

main().catch(err => { console.error(err); process.exit(1); });
