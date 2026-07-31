#!/usr/bin/env node
/* tools/add-candidates — the curated sourcing route, and the answer to a gap
   Magic Search cannot close.

   Keyword search structurally cannot reach the top bands. SSR starts at 10M
   subscribers and UR at 50M, while KEYWORD_SEEDS is hobby/craft on purpose — it
   steers clear of news, politics and person-named channels, which matters more
   than usual when every result becomes a card carrying someone's likeness. That
   vocabulary essentially never surfaces a 10M+ channel, so the first real build
   came out `N 27 · R 16 · SR 8 · SSR 0 · UR 0`: no chase card, and WP12's UR
   finish would never fire for a real player.

   Broadening the vocabulary was the obvious fix and is the wrong one — it would
   trade the exact safety property the vocabulary was chosen for. Who counts as a
   legend is human knowledge, not a query, so it belongs in a file a person
   maintains. `assignPool` anticipated this: "a curated allowlist can still
   promote a channel to legends later."

   Cost: a handle costs 1 quota unit to resolve (channels.list?forHandle takes
   one at a time); UC ids batch 50 per unit. A 200-name roster of handles is
   therefore ~200 units against 10,000/day — cheaper than two keyword searches.
   That is worth stating plainly, because "the API won't get us far" is only true
   of SEARCH: search.list costs 100 units a call, and it is the only expensive
   thing here. Building decks from a curated roster is nearly free.

   Run:   node tools/add-candidates.js catalog/legends.txt
          node tools/add-candidates.js catalog/legends.txt --dry-run
   File:  one @handle, UC id or channel URL per line. Blank lines and # comments
          are ignored, so the roster can carry its own reasoning.
   Key:   YOUTUBE_API_KEY env var, else src/config.local.js. */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

import { resolveChannelInput } from '../src/data/resolve.js';
import { fetchLiveChannel } from '../src/data/youtube.js';
import { fetchChannelsByIds } from '../src/data/search.js';
import { passesRegion } from '../src/engine/discover.js';
import { parseRosterLines, mergeCandidates, poolCounts, batchIds, CANDIDATE_DB_VERSION } from '../src/engine/candidates.js';
import { rarityFromSubs, RARITY_ORDER } from '../src/engine/core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolvePath(__dirname, '..');
const CATALOG_DIR = resolvePath(ROOT, 'catalog');
const CANDIDATES_PATH = resolvePath(CATALOG_DIR, 'candidates.json');
const DENYLIST_PATH = resolvePath(CATALOG_DIR, 'denylist.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
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

const fmt = v => (!Number.isFinite(v) ? '—' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'K' : String(v));

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find(a => !a.startsWith('--'));
  if (!file) {
    console.error('Usage: node tools/add-candidates.js <roster-file> [--dry-run]');
    process.exit(1);
  }

  const text = await readFile(resolvePath(ROOT, file), 'utf8').catch(() => null);
  if (text === null) {
    console.error(`Could not read ${file}.`);
    process.exit(1);
  }

  const entries = parseRosterLines(text);
  if (!entries.length) {
    console.error(`${file} has no entries (blank lines and # comments are ignored).`);
    process.exit(1);
  }

  /* Split before spending anything: ids batch 50 to a unit, handles cost one
     call each, so knowing the mix up front is what makes the quota line honest. */
  const ids = [];
  const handles = [];
  const invalid = [];
  for (const entry of entries) {
    const r = resolveChannelInput(entry);
    if (r.error) invalid.push(entry);
    else if (r.kind === 'id') ids.push(r.value);
    else handles.push(r.value);
  }

  const cost = batchIds(ids).length + handles.length;
  console.log(`${file}: ${entries.length} entries — ${ids.length} ids, ${handles.length} handles${invalid.length ? `, ${invalid.length} unreadable` : ''}`);
  console.log(`  estimated cost: ${cost} quota unit${cost === 1 ? '' : 's'} (ids batch 50/unit, handles 1 each)`);
  for (const bad of invalid) console.log(`  ! could not read: ${bad}`);

  if (dryRun) return console.log('\n--dry-run: nothing fetched, nothing written.');

  const key = await loadKey();
  if (!key) {
    console.error('No API key. Set YOUTUBE_API_KEY, or add YOUTUBE_API_KEY to src/config.local.js.');
    process.exit(1);
  }

  const found = [];
  for (const batch of batchIds(ids)) found.push(...await fetchChannelsByIds(batch, key));
  for (const handle of handles) {
    try {
      found.push(await fetchLiveChannel({ kind: 'handle', value: handle }, key));
    } catch (err) {
      console.log(`  ! ${handle}: ${err.message}`);
    }
  }

  /* The region exclude applies to curated names exactly as it does to searched
     ones. A roster is a human decision about who is interesting, never an
     exemption from the local-risk hedge — and the honest consequence is that
     several of the largest channels on YouTube are India-based and will be
     dropped here. Reported rather than silent, since that is a real cost. */
  const allowed = found.filter(c => passesRegion(c));
  const excluded = found.length - allowed.length;

  const denylist = (await readJson(DENYLIST_PATH)) ?? [];
  const db = (await readJson(CANDIDATES_PATH)) ?? { version: CANDIDATE_DB_VERSION, candidates: [] };
  const { candidates, added, evicted, rejected } = mergeCandidates(db.candidates ?? [], allowed, { denylist });

  const pools = poolCounts(candidates);
  const rarity = Object.fromEntries(RARITY_ORDER.map(r => [r, 0]));
  for (const ch of allowed) rarity[rarityFromSubs(ch.subscriberCount, ch.hiddenSubscriberCount)]++;

  console.log(`\n  resolved ${found.length}/${entries.length - invalid.length}`);
  if (excluded) console.log(`  region exclude dropped ${excluded}`);
  console.log(`  this roster: ${RARITY_ORDER.map(r => `${r} ${rarity[r]}`).join(' · ')}`);
  console.log(`  +${added} added · ${evicted} evicted · ${rejected} denied -> ${candidates.length} candidates`);
  console.log(`  pools: legends ${pools.legends} · majority ${pools.majority} · wildcards ${pools.wildcards}`);
  for (const ch of allowed) {
    console.log(`      · ${ch.title} — ${ch.hiddenSubscriberCount ? 'hidden' : fmt(Number(ch.subscriberCount))}`);
  }

  await mkdir(CATALOG_DIR, { recursive: true });
  await writeFile(CANDIDATES_PATH, JSON.stringify({
    ...db, version: CANDIDATE_DB_VERSION, updated: new Date().toISOString().slice(0, 10), candidates,
  }, null, 2) + '\n');
  console.log(`\nWrote catalog/candidates.json (${candidates.length} ids). Run tools/build-set.js to mint a set.`);
}

main().catch(err => { console.error(err); process.exit(1); });
