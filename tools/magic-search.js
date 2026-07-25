#!/usr/bin/env node
/* tools/magic-search — Magic Search, first working draft. DETERMINISTIC: no
   randomness yet (that is a later draft, see DECISIONS.md). Runs a list of
   1–2 word queries through the agreed mechanism, one query at a time:

     search.list (order=viewCount, no window, 100u)
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
          node tools/magic-search.js --fresh          (start the file over)
   Key:   YOUTUBE_API_KEY env var, else src/config.local.js. Never printed,
          never written to output. Real creator data goes to a gitignored
          *.draft.json, never committed. */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { searchChannelIds, fetchChannelsByIds } from '../src/data/search.js';
import { selectChannels, assignPool, DEFAULT_FLOOR } from '../src/engine/discover.js';
import { rarityFromSubs, RARITY_ORDER } from '../src/engine/core.js';

const PER_QUERY = Number(process.env.MS_PER_QUERY ?? 5);
const DETERMINISTIC = { windowDays: null, orders: ['viewCount'] };

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

function fmtSubs(channel) {
  if (channel.hiddenSubscriberCount) return 'hidden';
  const v = Number(channel.subscriberCount);
  if (!Number.isFinite(v)) return '—';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return Math.round(v / 1e3) + 'K';
  return String(v);
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
  const args = rawArgs.filter(a => a !== '--fresh');
  const queries = args.length ? args : DEFAULT_QUERIES;

  const key = await loadKey();
  if (!key) {
    console.error('No API key. Set YOUTUBE_API_KEY, or add YOUTUBE_API_KEY to src/config.local.js.');
    process.exit(1);
  }

  // Accumulate: seed from the existing draft unless --fresh, and dedupe against it.
  const prior = fresh ? [] : ((await readJson(OUT_PATH))?.channels ?? []);
  const channels = [...prior];
  const seen = new Set(prior.map(c => c.id));

  console.log(`Magic Search draft — ${queries.length} queries, cap ${PER_QUERY}/query (deterministic)`);
  console.log(fresh ? 'starting fresh\n' : `continuing from ${prior.length} existing cards\n`);

  let added = 0;
  for (const q of queries) {
    try {
      const ids = await searchChannelIds(q, key, DETERMINISTIC);
      const freshIds = ids.filter(id => !seen.has(id));      // dedup (this run + prior runs) before we spend the enrich call
      const found = await fetchChannelsByIds(freshIds, key);
      const kept = selectChannels(found, { floor: DEFAULT_FLOOR, cap: PER_QUERY });
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
  console.log(`\nView it: run  npx serve , open the app, pick "${SET_META.title}" in the Sets dropdown.`);
}

main().catch(err => { console.error(err); process.exit(1); });
