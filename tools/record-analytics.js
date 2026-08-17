#!/usr/bin/env node
/* tools/record-analytics — snapshot the traffic numbers into a committed log.

   ── WHY A FILE AND NOT THE DASHBOARD ──────────────────────────────────────
   Cloudflare keeps analytics for a rolling window and then they are gone. The
   question this project actually wants to answer — "did launching change
   anything" — needs a BEFORE, and a before that only ever existed on a
   dashboard is a before nobody can produce three weeks later when it matters.
   So each run appends a timestamped snapshot to catalog/analytics-log.json and
   prints the delta against the previous one.

   It is the same shape as catalog/refresh-log.json and exists for the same
   reason: the receipts in this repo are supposed to be readable by the next
   session, not remembered.

   ── WHAT IT CAN AND CANNOT SEE ────────────────────────────────────────────
   Pages FUNCTIONS invocations only — which on this site means the match lobby
   (`/api/ready/…`) and nothing else. Static page views are NOT exposed on any
   account-scoped GraphQL dataset; they live on the Pages project's Analytics
   tab and have to be read by a human. That is a real gap and it is stated here
   rather than papered over: this number tells you how many BATTLES were set up,
   not how many people arrived.

   Which makes it the more interesting number of the two anyway. A visit is a
   click; a lobby invocation is somebody who pulled cards, built a team and
   tried to fight another human.

   ── IT IS NOT TRACKING ────────────────────────────────────────────────────
   Every figure here is server-side and already collected by Cloudflare for
   billing. Nothing is added to the page, no beacon, no cookie, no identifier —
   the footer promises "no accounts, no tracking" and this keeps that true. Do
   NOT reach for Cloudflare "Web Analytics" to close the page-views gap above:
   that is a different product that injects a client-side script, and it would
   make the footer a lie to fill in a number.

   Run:   node tools/record-analytics.js
          node tools/record-analytics.js --days 7
          node tools/record-analytics.js --note "launched on HN"
   Needs: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (both already in .env). */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LOG_PATH = resolve(ROOT, 'catalog/analytics-log.json');
const ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

const DEFAULT_DAYS = 30;

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}

/* .env is read by hand rather than through a dependency — this repo ships zero
   of them, and a five-line parser is cheaper than the precedent. */
async function loadEnv() {
  const out = { ...process.env };
  try {
    for (const line of (await readFile(resolve(ROOT, '.env'), 'utf8')).split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env — rely on the real environment */ }
  return out;
}

const iso = d => d.toISOString().slice(0, 10);

async function fetchInvocations(env, from, to) {
  const query = `query {
    viewer { accounts(filter: { accountTag: "${env.CLOUDFLARE_ACCOUNT_ID}" }) {
      pagesFunctionsInvocationsAdaptiveGroups(
        limit: 1000,
        filter: { datetime_geq: "${from}T00:00:00Z", datetime_leq: "${to}T23:59:59Z" },
        orderBy: [date_ASC]
      ) { sum { requests } dimensions { date } }
    } }
  }`;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors.map(e => e.message).join('; '));
  const groups = body.data?.viewer?.accounts?.[0]?.pagesFunctionsInvocationsAdaptiveGroups ?? [];
  const byDay = {};
  for (const g of groups) byDay[g.dimensions.date] = g.sum.requests;
  return byDay;
}

async function main() {
  const env = await loadEnv();
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
    console.error('Need CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (see .env).');
    process.exit(1);
  }

  const days = Number(arg('--days', DEFAULT_DAYS));
  const now = new Date();
  const from = iso(new Date(now.getTime() - days * 86400000));
  const to = iso(now);

  const byDay = await fetchInvocations(env, from, to);
  const total = Object.values(byDay).reduce((a, b) => a + b, 0);

  const log = JSON.parse(await readFile(LOG_PATH, 'utf8').catch(() => 'null')) ?? {
    note: 'Traffic snapshots, appended by tools/record-analytics.js. Pages FUNCTIONS '
        + 'invocations only — the match lobby. Static page views are not available on any '
        + 'account-scoped API and must be read from the Pages Analytics tab by hand. '
        + 'Server-side figures Cloudflare already collects for billing: nothing here is a '
        + 'beacon, a cookie or an identifier, and the footer\'s "no tracking" stays true.',
    entries: [],
  };

  const previous = log.entries[log.entries.length - 1] ?? null;
  const entry = {
    at: now.toISOString(),
    window: { from, to, days },
    functionsInvocations: { total, byDay },
    note: arg('--note', '') || undefined,
  };
  log.entries.push(entry);
  await writeFile(LOG_PATH, JSON.stringify(log, null, 2) + '\n', 'utf8');

  console.log(`Recorded ${to} — Pages Functions invocations over ${days} days: ${total}`);
  const active = Object.entries(byDay).filter(([, n]) => n > 0);
  for (const [date, n] of active.slice(-10)) console.log(`   ${date}  ${n}`);
  if (previous) {
    const delta = total - previous.functionsInvocations.total;
    const sign = delta > 0 ? '+' : '';
    console.log(`\n  previous snapshot ${previous.at.slice(0, 10)}: ${previous.functionsInvocations.total}`);
    console.log(`  change: ${sign}${delta}`);
  } else {
    console.log('\n  First snapshot — this is the baseline everything later is measured against.');
  }
  console.log(`\nWrote ${LOG_PATH} — commit it, it is the before-and-after.`);
  console.log('Page views: dash -> Workers & Pages -> creator-gacha -> Analytics (read by hand).');
}

main().catch(err => { console.error(err.message ?? err); process.exit(1); });
