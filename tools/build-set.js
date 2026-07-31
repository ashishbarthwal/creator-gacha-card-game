#!/usr/bin/env node
/* tools/build-set — WP7 step 2. Turns the committed candidate DB (IDs only)
   into a shippable card set (full stats), which is the one place creator data
   is allowed to exist as a file.

   The pipeline, and why each step is where it is:

     read catalog/candidates.json    ids + our tags, the committed truth
     drop denylisted ids             BEFORE the fetch — an opt-out means we stop
                                     looking someone up, not that we look them
                                     up and discard the answer
     hydrate in batches of 50        1 quota unit per batch; ~10 for 500 ids
     re-run the region exclude       on FRESH country, never a cached copy: a
                                     creator can change what they declare, and
                                     we deliberately never stored it
     refresh the pool hints          free here, since fresh stats are in hand
     prune starved bands             the 4x-same-card failure, caught at build
     write sets/built/<slug>.json    gitignored — sets are built at deploy and
                                     never committed, so an honored removal is
                                     actually performable

   The output is gitignored on purpose. A set file in git is permanent, which
   would break both the 30-day cap on stored statistics and the 7-day opt-out
   promise. CI rebuilds this at deploy on the 25-day cadence.

   Run:   node tools/build-set.js
          node tools/build-set.js --slug series-1 --title "Series 1"
          node tools/build-set.js --dry-run       (report, write nothing)
   Key:   YOUTUBE_API_KEY env var, else src/config.local.js. */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { fetchChannelsByIds } from '../src/data/search.js';
import { passesRegion, regionReport, DEFAULT_EXCLUDE_COUNTRIES } from '../src/engine/discover.js';
import { hydratableIds, batchIds, refreshPools, CANDIDATE_DB_VERSION } from '../src/engine/candidates.js';
import { assembleSet } from '../src/engine/setbuild.js';
import { RARITY_ORDER, rarityFromSubs } from '../src/engine/core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CANDIDATES_PATH = resolve(ROOT, 'catalog/candidates.json');
const DENYLIST_PATH = resolve(ROOT, 'catalog/denylist.json');
const BUILT_DIR = resolve(ROOT, 'sets/built');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}

async function loadKey() {
  const fromEnv = process.env.YOUTUBE_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  try {
    const mod = await import('../src/config.local.js');
    return (mod.YOUTUBE_API_KEY ?? '').trim();
  } catch {
    return '';
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const slug = arg('--slug', 'series-1');
  const title = arg('--title', 'Series 1');
  const series = arg('--series', 'Creator Gacha');

  const db = await readJson(CANDIDATES_PATH);
  if (!db?.candidates?.length) {
    console.error('No candidates. Run  node tools/magic-search.js --random 10  then  node tools/build-candidates.js');
    process.exit(1);
  }
  if (db.version !== CANDIDATE_DB_VERSION) {
    console.error(`catalog/candidates.json is version ${db.version}, this tool expects ${CANDIDATE_DB_VERSION}.`);
    process.exit(1);
  }

  const denylist = (await readJson(DENYLIST_PATH)) ?? [];
  const ids = hydratableIds(db.candidates, denylist);
  const skipped = db.candidates.length - ids.length;

  const key = await loadKey();
  if (!key) {
    console.error('No API key. Set YOUTUBE_API_KEY, or add YOUTUBE_API_KEY to src/config.local.js.');
    process.exit(1);
  }

  const batches = batchIds(ids);
  console.log(`Building "${title}" from ${ids.length} candidates${skipped ? ` (${skipped} denied, not looked up)` : ''}.`);
  console.log(`  hydrating in ${batches.length} batch${batches.length === 1 ? '' : 'es'} of <=50 — ${batches.length} quota unit${batches.length === 1 ? '' : 's'}`);

  const hydrated = [];
  for (const batch of batches) {
    hydrated.push(...await fetchChannelsByIds(batch, key));
  }

  /* A candidate that no longer resolves was deleted or terminated between
     sourcing and now. Dropping it silently is correct — the alternative is
     shipping a card for a channel that no longer exists. */
  const vanished = ids.length - hydrated.length;

  /* The region exclude re-runs against freshly declared country, which is
     strictly better than the value at sourcing time and is why we never stored
     it. Reported too, since the rate is an input to the launch decision. */
  const region = regionReport(hydrated);
  const allowed = hydrated.filter(c => passesRegion(c));

  const { set, dropped, health } = assembleSet(allowed, {
    slug, title, series, snapshotDate: new Date().toISOString().slice(0, 10),
  });

  const rarity = Object.fromEntries(RARITY_ORDER.map(r => [r, 0]));
  for (const ch of set.channels) rarity[rarityFromSubs(ch.subscriberCount, ch.hiddenSubscriberCount)]++;

  console.log(`  hydrated ${hydrated.length}${vanished ? ` (${vanished} vanished — deleted or terminated)` : ''}`);
  console.log(`  region exclude [${DEFAULT_EXCLUDE_COUNTRIES.join(', ')}]: ${hydrated.length - allowed.length} removed, ${region.undeclared} undeclared (unseeable)`);
  for (const band of health) {
    console.log(`    ${band.rarity.padEnd(3)} ${String(band.count).padStart(3)} cards (needs ${band.needed}) ${band.ok ? 'ok' : 'STARVED'}`);
  }
  for (const band of dropped) {
    console.log(`  dropped band ${band.rarity}: ${band.count} card${band.count === 1 ? '' : 's'}, needed ${band.needed} — a x10 would have repeated it`);
  }
  console.log(`  set: ${set.channels.length} cards — ${RARITY_ORDER.map(r => `${r} ${rarity[r]}`).join(' · ')}`);

  if (dryRun) return console.log('\n--dry-run: nothing written.');

  await mkdir(BUILT_DIR, { recursive: true });
  await writeFile(resolve(BUILT_DIR, `${slug}.json`), JSON.stringify(set, null, 2) + '\n');

  /* Write the refreshed pool hints back, so the DB self-heals on every build
     instead of drifting further from the bands it claims. */
  const refreshed = refreshPools(db.candidates, hydrated);
  await writeFile(CANDIDATES_PATH, JSON.stringify({ ...db, updated: new Date().toISOString().slice(0, 10), candidates: refreshed }, null, 2) + '\n');

  console.log(`\nWrote sets/built/${slug}.json (gitignored — sets are built at deploy, never committed).`);
  console.log('Refreshed the pool hints in catalog/candidates.json.');
}

main().catch(err => { console.error(err); process.exit(1); });
