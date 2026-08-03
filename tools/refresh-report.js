#!/usr/bin/env node
/* tools/refresh-report — what the refresh actually did, in a form a person can
   read in a notification.

   WHY A SEPARATE TOOL. The refresh runs unattended, so its output goes nowhere
   anybody looks. A scheduled job with no report is a job you are trusting rather
   than watching, and the first run of the local task proved why that is not the
   same thing: it republished the site at 400 cards instead of 19,874 and said
   "exit code 0" while doing it. A count in a report would have caught that on
   sight.

   So the report leads with the number most likely to be WRONG — cards shipped,
   and how it moved since last time — rather than with a status word. "Success"
   is what a broken run says too.

   Reads files only: no key, no network, no quota. Safe anywhere.

   Run:   node tools/refresh-report.js            (plain text, for an email body)
          node tools/refresh-report.js --json      (for a workflow to parse)
          node tools/refresh-report.js --subject   (one line, for a subject line)
*/

import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { refreshStatus, lastEntry, REFRESH_DAYS, POLICY_DAYS } from '../src/engine/freshness.js';
import { RARITY_ORDER, rarityFromSubs } from '../src/engine/core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BUILT_DIR = resolve(ROOT, 'sets/built');
const REFRESH_LOG_PATH = resolve(ROOT, 'catalog/refresh-log.json');
const CANDIDATES_PATH = resolve(ROOT, 'catalog/candidates.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

export async function collect() {
  const decks = [];
  if (await exists(BUILT_DIR)) {
    for (const file of (await readdir(BUILT_DIR)).filter(f => f.endsWith('.json') && f !== 'index.json')) {
      const set = await readJson(resolve(BUILT_DIR, file));
      if (!set) continue;
      const bands = Object.fromEntries(RARITY_ORDER.map(r => [r, 0]));
      for (const ch of set.channels ?? []) {
        bands[rarityFromSubs(ch.subscriberCount, ch.hiddenSubscriberCount)]++;
      }
      decks.push({
        slug: set.slug, title: set.title,
        cards: set.channels?.length ?? 0,
        snapshotDate: set.snapshotDate,
        bands,
        status: refreshStatus(set.snapshotDate),
      });
    }
  }

  const log = await readJson(REFRESH_LOG_PATH);
  const entries = log?.entries ?? [];
  /* The PREVIOUS deploy, not the one just written — the delta is the whole point
     of the report, and comparing a run to itself would always read "no change". */
  const deploys = entries.filter(e => e.event === 'deploy');
  const previous = deploys[deploys.length - 2] ?? null;
  const latest = lastEntry(log, 'deploy');

  const db = await readJson(CANDIDATES_PATH);

  return {
    at: new Date().toISOString(),
    decks,
    candidates: db?.candidates?.length ?? 0,
    latestDeploy: latest,
    previousDeploy: previous,
    totalCards: decks.reduce((n, d) => n + d.cards, 0),
  };
}

function bandLine(bands) {
  return RARITY_ORDER.map(r => `${r} ${bands[r]}`).join(' · ');
}

function delta(now, before) {
  if (before === null || before === undefined) return '';
  const d = now - before;
  if (d === 0) return '  (no change)';
  return `  (${d > 0 ? '+' : ''}${d} since the last deploy)`;
}

export function render(data) {
  const lines = [];
  const worst = data.decks.reduce((w, d) => Math.min(w, d.status.publishable ? 1 : 0), 1);

  lines.push('CREATOR GACHA — REFRESH REPORT');
  lines.push(new Date(data.at).toUTCString());
  lines.push('');
  lines.push('https://creator-gacha.netlify.app');
  lines.push('');

  if (!data.decks.length) {
    lines.push('!! NO DECKS WERE BUILT. Nothing was published.');
    return lines.join('\n');
  }

  lines.push('DECKS PUBLISHED');
  for (const d of data.decks) {
    const before = data.previousDeploy && data.previousDeploy.slug === d.slug ? data.previousDeploy.cards : null;
    lines.push(`  ${d.title} (${d.slug})`);
    lines.push(`    ${d.cards.toLocaleString()} cards${delta(d.cards, before)}`);
    lines.push(`    ${bandLine(d.bands)}`);
    lines.push(`    stats as of ${d.snapshotDate} — ${d.status.state}`);
    lines.push('');
  }

  lines.push('POOL');
  lines.push(`  ${data.candidates.toLocaleString()} candidates in catalog/candidates.json`);
  lines.push(`  ${(data.candidates - data.totalCards).toLocaleString()} held out by the curation excludes`);
  lines.push('');

  /* The compliance line is the reason the job exists, so it is stated as a DATE
     rather than a status: "fresh" ages into "expired" silently, a date does not. */
  const soonest = data.decks.reduce((a, d) => (a && a.status.ageDays > d.status.ageDays ? a : d), null);
  if (soonest) {
    const snap = new Date(soonest.snapshotDate + 'T00:00:00Z');
    const due = new Date(snap.getTime() + REFRESH_DAYS * 86400000).toISOString().slice(0, 10);
    const dead = new Date(snap.getTime() + POLICY_DAYS * 86400000).toISOString().slice(0, 10);
    lines.push('THE 30-DAY CLOCK');
    lines.push(`  next refresh due   ${due}   (${REFRESH_DAYS} days after the snapshot)`);
    lines.push(`  publishing blocked ${dead}   (${POLICY_DAYS}-day cap on stored statistics)`);
    lines.push('  A weekly run means this never gets close. If these dates stop moving,');
    lines.push('  the job has stopped and nothing else will tell you.');
    lines.push('');
  }

  lines.push('If the card count moved a lot and you did not change anything, that is');
  lines.push('the thing to look at. Everything else can wait.');

  return lines.join('\n');
}

export function subject(data) {
  const d = data.decks[0];
  if (!d) return 'Creator Gacha refresh — NO DECK BUILT';
  const before = data.previousDeploy?.cards ?? null;
  const move = before === null || before === d.cards ? '' : ` (${d.cards - before > 0 ? '+' : ''}${d.cards - before})`;
  return `Creator Gacha refreshed — ${d.cards.toLocaleString()} cards${move}, stats ${d.snapshotDate}`;
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/refresh-report.js');
if (isMain) {
  const data = await collect();
  if (process.argv.includes('--json')) console.log(JSON.stringify(data, null, 2));
  else if (process.argv.includes('--subject')) console.log(subject(data));
  else console.log(render(data));
}
