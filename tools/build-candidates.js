#!/usr/bin/env node
/* tools/build-candidates — WP7 step 1. Distils an accumulated Magic Search
   draft into the committed candidate DB: the source of truth for WHO is in the
   pool, holding channel IDs, our own pool hint, and a first-seen date. Nothing
   else. The strip lives in engine/candidates.js and is tested there.

   The directory split is the rule made physical, and it is worth reading once:

     sets/*.draft.json   gitignored   real creator data, local only
     catalog/*.json      COMMITTED    ids + our tags + the denylist
     sets/<slug>.json    built in CI  full stats, deployed, never committed

   Committing creator data would break two promises at once — YouTube's 30-day
   cap on stored statistics (git is permanent) and the 7-day opt-out (`git rm`
   leaves them at the old commit in a public repo). So the middle row is the only
   one that enters history, and it is the row a removal is performed against.

   Run:   node tools/build-candidates.js              (merge the default draft)
          node tools/build-candidates.js --from x.json
          node tools/build-candidates.js --prune      (apply the denylist, no draft)
          node tools/build-candidates.js --dry-run    (report, write nothing)

   No API key. No network. This step spends no quota — it only reshapes files
   Magic Search already fetched. */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { mergeCandidates, poolCounts, CANDIDATE_DB_VERSION } from '../src/engine/candidates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CATALOG_DIR = resolve(ROOT, 'catalog');
const CANDIDATES_PATH = resolve(CATALOG_DIR, 'candidates.json');
const DENYLIST_PATH = resolve(CATALOG_DIR, 'denylist.json');
const DEFAULT_DRAFT = resolve(ROOT, 'sets/magic-search.draft.json');

/* The denylist is created empty rather than left missing, because an operator
   reaching for it is under a 7-day clock and should find a file with the shape
   already in it, not a "no such file" they have to guess their way out of. */
const EMPTY_DENYLIST = {
  note: 'Channels that asked to be excluded. Add an id here and re-run tools/build-candidates.js --prune. Entries are permanent: they evict from the DB and block every future sourcing run. A bare "UC_id" string works too.',
  denied: [],
};

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : process.argv[i + 1] ?? '';
}

async function main() {
  const flags = process.argv.slice(2);
  const prune = flags.includes('--prune');
  const dryRun = flags.includes('--dry-run');
  const draftPath = arg('--from') ? resolve(ROOT, arg('--from')) : DEFAULT_DRAFT;

  const denylistFile = await readJson(DENYLIST_PATH);
  const denylist = denylistFile ?? EMPTY_DENYLIST;

  const priorFile = await readJson(CANDIDATES_PATH);
  const prior = priorFile?.candidates ?? [];

  /* --prune merges nothing and exists for one job: someone asked to be removed,
     and the answer needs to be "already done" rather than "at the next sourcing
     run". mergeCandidates enforces the denylist against `prior` regardless of
     what arrives, so an empty channel list is the whole implementation. */
  let discovered = [];
  if (!prune) {
    const draft = await readJson(draftPath);
    if (!draft) {
      console.error(`No draft at ${draftPath}.`);
      console.error('Run  node tools/magic-search.js --random 10  first, or pass --from <path>.');
      console.error('(--prune applies the denylist on its own and needs no draft.)');
      process.exit(1);
    }
    discovered = draft.channels ?? [];
  }

  const { candidates, added, evicted, rejected } = mergeCandidates(prior, discovered, { denylist });

  const file = {
    version: CANDIDATE_DB_VERSION,
    updated: new Date().toISOString().slice(0, 10),
    note: 'Channel IDs and our own tags only — never channel data. See src/engine/candidates.js.',
    candidates,
  };

  if (!dryRun) {
    await mkdir(CATALOG_DIR, { recursive: true });
    await writeFile(CANDIDATES_PATH, JSON.stringify(file, null, 2) + '\n');
    if (!denylistFile) await writeFile(DENYLIST_PATH, JSON.stringify(EMPTY_DENYLIST, null, 2) + '\n');
  }

  const pools = poolCounts(candidates);
  console.log(prune ? 'Pruning against the denylist only.' : `Merging ${discovered.length} discovered channels from ${draftPath}.`);
  console.log(`  prior ${prior.length} -> ${candidates.length} candidates`);
  console.log(`  +${added} added · ${evicted} evicted (opted out) · ${rejected} rejected (denied)`);
  console.log(`  pools: legends ${pools.legends} · majority ${pools.majority} · wildcards ${pools.wildcards}`);
  console.log(dryRun ? '\n--dry-run: nothing written.' : `\nWrote catalog/candidates.json (${candidates.length} ids).`);
  if (evicted) console.log('An opt-out was honored. Commit this, then rebuild the shipped set.');
}

main().catch(err => { console.error(err); process.exit(1); });
