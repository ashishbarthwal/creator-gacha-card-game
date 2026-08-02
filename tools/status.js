#!/usr/bin/env node
/* tools/status — the refresh dashboard. Reads files only: no API key, no
   network, no quota. Safe to run on a timer, in a shell prompt, or fifty times
   an hour.

   WHAT IT IS FOR. The 25-day refresh is a chore somebody has to remember
   (DECISIONS.md: the deploy runs locally so the key never goes near a repo
   secret), and a missed one is a compliance problem rather than an
   inconvenience. `build-site.js` refuses to publish expired data, which stops
   the bad outcome — but a guard only fires when you are already deploying. This
   answers the question earlier: is anything due?

   THE DISTINCTION THAT MATTERS. There are three copies of a set and only one of
   them is the one the policy clock runs on:

     sets/built/<slug>.json   what you last built locally
     _site/sets/built/...     what you last assembled
     the CDN                  what people can actually see  <- this one

   Rebuilding locally refreshes nothing a visitor sees, so the ledger tracks
   `deploy` separately from `build` and this report leads with the deploy.

   Exit codes, so a scheduled task can act on it rather than just print:
     0  nothing to do
     1  a refresh or a deploy is due
     2  something is expired — publishing is currently blocked

   Run:   npm run status */

import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

import { refreshStatus, daysSince, lastEntry, REFRESH_DAYS, POLICY_DAYS } from '../src/engine/freshness.js';
import { parseRosterLines, splitPin } from '../src/engine/candidates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const BUILT_DIR = resolve(ROOT, 'sets/built');
const CANDIDATES_PATH = resolve(ROOT, 'catalog/candidates.json');
const EXCLUDED_PATH = resolve(ROOT, 'catalog/excluded.txt');
const DENYLIST_PATH = resolve(ROOT, 'catalog/denylist.json');
const DRAFT_PATH = resolve(ROOT, 'sets/magic-search.draft.json');
const REFRESH_LOG_PATH = resolve(ROOT, 'catalog/refresh-log.json');
const SITE_DIR = resolve(ROOT, '_site');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* One line per set: age, verdict, and what to do about it. */
function describe(status) {
  if (status.state === 'unknown') return 'no snapshotDate — age cannot be established, will NOT publish';
  if (status.state === 'expired') return `${plural(status.ageDays, 'day')} old — EXPIRED, past the ${POLICY_DAYS}-day cap, will NOT publish`;
  if (status.state === 'due') return `${plural(status.ageDays, 'day')} old — DUE, ${plural(status.expiresInDays, 'day')} before it may not be published`;
  return `${plural(status.ageDays, 'day')} old — fresh, refresh due in ${plural(status.dueInDays, 'day')}`;
}

async function main() {
  let worst = 0;
  const bump = level => { worst = Math.max(worst, level); };

  console.log('Creator Gacha — refresh status\n');

  /* ── Built sets ─────────────────────────────────────────────────────────── */
  const built = (await exists(BUILT_DIR))
    ? (await readdir(BUILT_DIR)).filter(f => f.endsWith('.json') && f !== 'index.json')
    : [];

  if (!built.length) {
    console.log('  sets       none built — run  node tools/build-set.js');
    bump(1);
  } else {
    for (const file of built) {
      const set = await readJson(resolve(BUILT_DIR, file));
      const status = refreshStatus(set?.snapshotDate);
      console.log(`  set        ${set?.slug ?? file}: ${set?.channels?.length ?? 0} cards, ${describe(status)}`);
      if (!status.publishable) bump(2);
      else if (status.state === 'due') bump(1);
    }
  }

  /* ── The published copy — the one the clock actually runs on ────────────── */
  const log = await readJson(REFRESH_LOG_PATH);
  const lastDeploy = lastEntry(log, 'deploy');
  const lastBuild = lastEntry(log, 'build');

  if (!lastDeploy) {
    console.log('  deployed   never — nothing has been published yet');
  } else {
    const age = daysSince(lastDeploy.at);
    const status = refreshStatus(lastDeploy.snapshotDate);
    console.log(`  deployed   ${plural(age, 'day')} ago (${lastDeploy.slug}, ${lastDeploy.cards} cards) — data ${describe(status)}`);
    if (!status.publishable) bump(2);
    else if (status.state === 'due') bump(1);
    /* A local rebuild that never shipped is the quiet failure: the machine looks
       refreshed and the CDN is still serving the old snapshot. */
    if (lastBuild && lastBuild.at > lastDeploy.at) {
      console.log(`             ! built again ${plural(daysSince(lastBuild.at), 'day')} ago without deploying — the live copy is still the old one`);
      bump(1);
    }
  }

  /* ── Roster drift: names added since the last build ──────────────────────── */
  const db = await readJson(CANDIDATES_PATH);
  const denylist = await readJson(DENYLIST_PATH);
  const denied = (Array.isArray(denylist) ? denylist : denylist?.denied ?? []).length;
  if (db) {
    const pinned = (db.candidates ?? []).filter(c => c?.pin).length;
    console.log(`  candidates ${db.candidates?.length ?? 0} ids (${pinned} pinned, ${denied} denied), updated ${db.updated ?? 'unknown'}`);
    if (lastBuild && db.updated && db.updated > lastBuild.at.slice(0, 10)) {
      console.log('             ! roster changed since the last build — rebuild to include it');
      bump(1);
    }

    /* ── THE NO-DATA-LOSS INVARIANT ────────────────────────────────────────
       An exclude holds a card OUT of a printing; it must never be the thing
       that loses it. Deleting a line from catalog/excluded.txt has to be
       enough to bring a card back, and that is only true while the id is still
       in the candidate DB.

       Ash asked for this guarantee in words ("don't wanna lose any data
       here"), which is exactly the kind of promise that rots silently — an
       exclude list and a candidate DB drift apart one careless edit at a time,
       and nobody notices until a card cannot be recovered. So it is checked on
       every status run rather than remembered.

       An orphan means an id is excluded but no longer sourceable: recovering
       that channel would cost a fresh sourcing run to rediscover it. */
    const excludeText = await readFile(EXCLUDED_PATH, 'utf8').catch(() => '');
    const excludedIds = parseRosterLines(excludeText).map(e => splitPin(e).input);
    const known = new Set((db.candidates ?? []).map(c => String(c.id)));
    const orphans = excludedIds.filter(id => !known.has(id));
    const shipping = known.size - excludedIds.filter(id => known.has(id)).length;
    console.log(`             ${excludedIds.length} held out by catalog/excluded.txt · ${shipping} shipping · recoverable by deleting a line`);
    if (orphans.length) {
      console.log(`             ! ${orphans.length} excluded id${orphans.length === 1 ? '' : 's'} NOT in the candidate DB — those cards cannot be brought back without re-sourcing`);
      for (const id of orphans.slice(0, 5)) console.log(`               ${id}`);
      bump(2);
    }
  }

  /* ── The sourcing draft: local, gitignored, and on the same clock ────────── */
  if (await exists(DRAFT_PATH)) {
    const draft = await readJson(DRAFT_PATH);
    const status = refreshStatus(draft?.snapshotDate);
    const note = status.state === 'fresh' ? 'fresh'
      : `${status.state.toUpperCase()} — prior entries are copied verbatim, never re-hydrated; clear with  --fresh`;
    console.log(`  draft      ${draft?.channels?.length ?? 0} channels, ${status.ageDays ?? '?'} days old — ${note}`);
    if (!status.publishable) bump(1);   // local only, so never a publish blocker
  }

  /* ── The assembled site, if one is sitting around ────────────────────────── */
  if (await exists(SITE_DIR)) {
    const siteSets = await readJson(resolve(SITE_DIR, 'sets/built/index.json'));
    const first = siteSets?.sets?.[0];
    const set = first ? await readJson(resolve(SITE_DIR, relative('', first.file))) : null;
    const status = refreshStatus(set?.snapshotDate);
    console.log(`  _site      ${set?.channels?.length ?? '?'} cards, ${set ? describe(status) : 'no set found'}`);
    /* _site is wiped and reassembled on every build, so a stale one can never
       reach the CDN — but a card count that disagrees with the current build is
       confusing to read, and saying so is cheaper than explaining it later. */
    if (set && built.length) {
      const current = await readJson(resolve(BUILT_DIR, built[0]));
      if (current && current.channels?.length !== set.channels?.length) {
        console.log(`             ! left over from an older build (${current.channels?.length} cards now) — regenerated on the next deploy`);
      }
    }
    if (set && !status.publishable) bump(1);
  }

  /* ── The verdict ─────────────────────────────────────────────────────────── */
  console.log('');
  if (worst === 0) console.log(`  OK — nothing due. Cadence is ${REFRESH_DAYS} days, hard limit ${POLICY_DAYS}.`);
  if (worst === 1) console.log('  DUE — run  npm run deploy  (rebuilds, re-checks the guards, uploads).');
  if (worst === 2) console.log(`  EXPIRED — publishing is blocked until you rebuild. Run  npm run deploy`);

  process.exit(worst);
}

main().catch(err => { console.error(err); process.exit(1); });
