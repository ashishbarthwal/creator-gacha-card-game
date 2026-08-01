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
import { hydratableIds, batchIds, refreshPools, parseRosterLines, splitPin, CANDIDATE_DB_VERSION } from '../src/engine/candidates.js';
import { assembleSet, applyExcludes, DEFAULT_TARGET_SIZE } from '../src/engine/setbuild.js';
import { refreshEntry, appendRefreshEntry } from '../src/engine/freshness.js';
import { RARITY_ORDER, rarityFromSubs } from '../src/engine/core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CANDIDATES_PATH = resolve(ROOT, 'catalog/candidates.json');
const DENYLIST_PATH = resolve(ROOT, 'catalog/denylist.json');
const EXCLUDED_PATH = resolve(ROOT, 'catalog/excluded.txt');
const BUILT_DIR = resolve(ROOT, 'sets/built');
const REFRESH_LOG_PATH = resolve(ROOT, 'catalog/refresh-log.json');

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
  const targetSize = Number(arg('--target', DEFAULT_TARGET_SIZE)) || DEFAULT_TARGET_SIZE;

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

  /* The curation exclude: editorial, revisable, and kept well away from the
     opt-out denylist above — see applyExcludes for why they are separate files.
     Read as a roster so it takes UC ids with `# why` comments beside them. */
  const excludeText = await readFile(EXCLUDED_PATH, 'utf8').catch(() => '');
  const excludeIds = new Set(parseRosterLines(excludeText).map(e => splitPin(e).input));
  const { kept: curated, removed: excludedCards } = applyExcludes(allowed, excludeIds);

  /* Pinned candidates survive the cap ahead of everything else — the roster's
     answer to "which cards is this set sold on", which a hash cannot supply. */
  const pinned = new Set(db.candidates.filter(c => c?.pin).map(c => String(c.id)));

  const { set, dropped, capped, targets } = assembleSet(curated, {
    slug, title, series, targetSize, pinned, snapshotDate: new Date().toISOString().slice(0, 10),
  });

  const rarity = Object.fromEntries(RARITY_ORDER.map(r => [r, 0]));
  for (const ch of set.channels) rarity[rarityFromSubs(ch.subscriberCount, ch.hiddenSubscriberCount)]++;

  console.log(`  hydrated ${hydrated.length}${vanished ? ` (${vanished} vanished — deleted or terminated)` : ''}`);
  console.log(`  region exclude [${DEFAULT_EXCLUDE_COUNTRIES.join(', ')}]: ${hydrated.length - allowed.length} removed, ${region.undeclared} undeclared (unseeable)`);
  /* Named, not just counted. A curation exclude is a judgement call someone
     should be able to disagree with at a glance — a bare number hides which. */
  if (excludeIds.size) {
    console.log(`  curation exclude: ${excludedCards.length} removed of ${excludeIds.size} listed`);
    for (const ch of excludedCards) console.log(`      − ${ch.title}`);
  }
  /* Per band: what shipped, against what a printing of this size wants. The
     shortfall column is the whole sourcing to-do list — it says which band to
     point the next Magic Search run at, and the cap column says which band has
     surplus already banked for the next printing. */
  console.log(`  bands (target ${targetSize} cards):`);
  let short = 0;
  for (const band of RARITY_ORDER) {
    const target = targets[band];
    if (target === undefined) continue;
    const have = rarity[band];
    const wasCapped = capped.find(c => c.rarity === band);
    const note = wasCapped ? `capped from ${wasCapped.from} — ${wasCapped.from - wasCapped.to} held for the next printing`
        + (wasCapped.droppedPins ? `  ⚠ ${wasCapped.droppedPins} PINNED card${wasCapped.droppedPins === 1 ? '' : 's'} dropped — more pins than slots` : '')
      : have < target ? `${target - have} short` : 'full';
    if (have < target) short += target - have;
    console.log(`    ${band.padEnd(3)} ${String(have).padStart(3)} / ${String(target).padStart(3)}   ${note}`);
  }
  for (const band of dropped) {
    console.log(`  dropped band ${band.rarity}: ${band.count} card${band.count === 1 ? '' : 's'}, needed ${band.needed} — a x10 would have repeated it`);
  }
  console.log(`  set: ${set.channels.length} cards — ${RARITY_ORDER.map(r => `${r} ${rarity[r]}`).join(' · ')}`);
  if (short) console.log(`  ${short} cards short of a full ${targetSize}-card printing — source more with tools/magic-search.js`);

  if (dryRun) return console.log('\n--dry-run: nothing written.');

  await mkdir(BUILT_DIR, { recursive: true });
  await writeFile(resolve(BUILT_DIR, `${slug}.json`), JSON.stringify(set, null, 2) + '\n');

  /* A set nothing points at is not shipped. The committed sets/index.json can't
     list it — built sets never enter git — so built sets carry their own
     manifest, written beside them and served from the same deploy. Merged
     rather than overwritten, so building a second set doesn't unpublish the
     first. */
  const manifestPath = resolve(BUILT_DIR, 'index.json');
  const manifest = (await readJson(manifestPath)) ?? { sets: [] };
  if (!Array.isArray(manifest.sets)) manifest.sets = [];
  const entry = { slug, title, file: `sets/built/${slug}.json` };
  const at = manifest.sets.findIndex(s => s.slug === slug);
  if (at === -1) manifest.sets.push(entry); else manifest.sets[at] = entry;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  /* Write the refreshed pool hints back, so the DB self-heals on every build
     instead of drifting further from the bands it claims. */
  const refreshed = refreshPools(db.candidates, hydrated);
  await writeFile(CANDIDATES_PATH, JSON.stringify({ ...db, updated: new Date().toISOString().slice(0, 10), candidates: refreshed }, null, 2) + '\n');

  /* The refresh ledger — the only artifact that can answer "did the cadence
     actually happen". A built set carries one snapshotDate, so it knows when it
     was last made and nothing about the runs before it; a missed month is
     invisible in the set and obvious here. Dates and counts only, so this is the
     one refresh artifact that can be COMMITTED while every file holding creator
     data stays out of git — the receipt outlives the machine that made it. */
  const log = (await readJson(REFRESH_LOG_PATH)) ?? {
    note: 'Refresh ledger — dates and counts only, never creator data. Written by tools/build-set.js and npm run deploy. See src/engine/freshness.js.',
    entries: [],
  };
  await writeFile(REFRESH_LOG_PATH, JSON.stringify(
    appendRefreshEntry(log, refreshEntry({ event: 'build', slug, cards: set.channels.length, snapshotDate: set.snapshotDate })),
    null, 2) + '\n');

  console.log(`\nWrote sets/built/${slug}.json + sets/built/index.json (gitignored — sets are built at deploy, never committed).`);
  console.log('Recorded the build in catalog/refresh-log.json.');
  console.log('Refreshed the pool hints in catalog/candidates.json.');
  console.log(`It will appear in the Sets picker as "${title}".`);
}

main().catch(err => { console.error(err); process.exit(1); });
