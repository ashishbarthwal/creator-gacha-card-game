#!/usr/bin/env node
/* tools/record-deploy — write the `deploy` line of the refresh ledger.

   Separate from build-set on purpose. A build and a publish are different
   events, and conflating them hides the exact failure this ledger exists to
   catch: rebuilding locally and never shipping, which leaves the machine looking
   refreshed while the CDN still serves the old snapshot. Only the published copy
   is under the 30-day cap, because it is the only one anybody can read.

   It runs LAST in the `npm run deploy` chain, after the upload. The chain is
   `&&`-joined, so a failed upload stops here and no entry is written — the
   ledger records deploys that actually happened rather than deploys that were
   attempted.

   Reads what was actually uploaded (_site), not what was built, for the same
   reason. No key, no network, no quota. */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { refreshEntry, appendRefreshEntry } from '../src/engine/freshness.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE = resolve(ROOT, '_site');
const REFRESH_LOG_PATH = resolve(ROOT, 'catalog/refresh-log.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

async function main() {
  const manifest = await readJson(resolve(SITE, 'sets/built/index.json'));
  const entries = manifest?.sets ?? [];
  if (!entries.length) {
    console.error('No _site/sets/built/index.json — nothing to record. Did the build run?');
    process.exit(1);
  }

  const log = (await readJson(REFRESH_LOG_PATH)) ?? {
    note: 'Refresh ledger — dates and counts only, never creator data. Written by tools/build-set.js and npm run deploy. See src/engine/freshness.js.',
    entries: [],
  };

  let next = log;
  for (const { slug, file } of entries) {
    const set = await readJson(resolve(SITE, file));
    if (!set) continue;
    next = appendRefreshEntry(next, refreshEntry({
      event: 'deploy', slug, cards: set.channels?.length ?? 0, snapshotDate: set.snapshotDate,
    }));
    console.log(`Recorded deploy — ${slug}: ${set.channels?.length ?? 0} cards, stats as of ${set.snapshotDate}.`);
  }

  await writeFile(REFRESH_LOG_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log('catalog/refresh-log.json updated — commit it, it is the receipt that the cadence was kept.');
}

main().catch(err => { console.error(err); process.exit(1); });
