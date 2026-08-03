#!/usr/bin/env node
/* tools/refresh-runs — did the unattended refresh actually RUN? Asks GitHub,
   prints the answer, and leaves a copy on disk.

   WHY THIS EXISTS, AND WHY IT IS NOT PART OF `npm run status`.
   `status.js` and `refresh-report.js` both open by promising they read files
   only — no key, no network, no quota — and that promise is what makes them safe
   to run on a timer or fifty times an hour. It is also precisely why neither can
   answer this question. The workflow builds inside the runner and uploads
   straight to the CDN, so a refresh that never happens leaves this machine
   byte-for-byte identical to one that succeeded. There is no local trace to read.

   The email was supposed to cover that, and it cannot. `if: failure()` needs a
   run to attach to; a firing GitHub silently drops produces no run, no steps, no
   mail. On 2026-08-03 a one-off cron was pushed to prove the refresh survives a
   powered-off laptop, and the result was nothing at all — no success mail, no
   failure mail, no local change. Indistinguishable from everything being fine.

   So this tool crosses the network on purpose, and stays a separate command
   because of it. It costs no YouTube quota and needs no key: the repo is public,
   so the Actions API answers unauthenticated (60 requests an hour per IP, which
   no human polling cadence will reach).

   Exit codes follow status.js, so a scheduled task can act rather than just print:
     0  the job is keeping its schedule
     1  a firing is late, or the last run needs a look
     2  a firing was dropped, the last run FAILED, or the job has never run

   Run:   npm run runs
          node tools/refresh-runs.js --json
          node tools/refresh-runs.js --repo owner/name --workflow refresh.yml */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { scheduleStatus } from '../src/engine/schedule.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REPORT_PATH = resolve(ROOT, 'reports/refresh-runs.txt');

const arg = (flag, fallback = null) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const WORKFLOW = arg('--workflow', 'refresh.yml');
const WORKFLOW_PATH = resolve(ROOT, '.github/workflows', WORKFLOW);

/* The crons come from the workflow file itself rather than a constant here.
   A checker with its own copy of the schedule is a checker that keeps agreeing
   with itself after somebody edits the YAML — it would have to be updated in
   lockstep forever, and the one time it is not, it reports on a schedule that no
   longer exists. Reading the source of truth costs one regex. */
async function readCrons() {
  const text = await readFile(WORKFLOW_PATH, 'utf8').catch(() => null);
  if (text === null) return { crons: [], error: `no workflow at .github/workflows/${WORKFLOW}` };
  /* Only the `on:` block's schedule matters, but a cron line is unambiguous
     enough on its own — and comment lines are skipped so a commented-out
     schedule is not counted as live. */
  const crons = text.split(/\r?\n/)
    .filter(l => !/^\s*#/.test(l))
    .map(l => l.match(/^\s*-\s*cron:\s*['"]?([^'"#]+?)['"]?\s*$/))
    .filter(Boolean)
    .map(m => m[1].trim());
  return { crons, error: null };
}

/* owner/name out of .git/config, so this works on a clone with no `gh` and no
   auth. Explicit --repo wins, for running it against a fork. */
async function readRepo() {
  const explicit = arg('--repo');
  if (explicit) return explicit;
  const cfg = await readFile(resolve(ROOT, '.git/config'), 'utf8').catch(() => '');
  const m = cfg.match(/url\s*=\s*.*github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\s*$/mi);
  return m ? m[1] : null;
}

async function fetchRuns(repo) {
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/runs?per_page=10`;
  let res;
  try {
    res = await fetch(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'creator-gacha-refresh-runs' } });
  } catch (err) {
    /* Offline is a normal state for a laptop, not a crash. Say so and get out —
       an unreachable API tells you nothing about the job either way. */
    return { error: `could not reach api.github.com (${err.message}) — offline?`, runs: [], total: null };
  }
  if (res.status === 404) return { error: `no workflow "${WORKFLOW}" in ${repo}, or the repo is private (this tool is unauthenticated)`, runs: [], total: null };
  if (res.status === 403) return { error: 'GitHub rate limit reached (60/hour unauthenticated) — try again later', runs: [], total: null };
  if (!res.ok) return { error: `GitHub API returned ${res.status}`, runs: [], total: null };

  const data = await res.json();
  const runs = (data.workflow_runs ?? []).map(r => ({
    number: r.run_number,
    event: r.event,
    status: r.status,
    conclusion: r.conclusion,
    startedAt: r.run_started_at ?? r.created_at,
    url: r.html_url,
  }));
  return { error: null, runs, total: data.total_count ?? runs.length };
}

const stamp = ms => (ms === null || ms === undefined ? '—' : new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC');

function humanMinutes(n) {
  if (n === null || n === undefined) return '—';
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60), m = n % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export function render({ repo, workflow, crons, fetchError, cronError, runs, total, verdict, now }) {
  const L = [];
  L.push('CREATOR GACHA — DID THE REFRESH RUN?');
  L.push(new Date(now).toUTCString());
  L.push('');
  L.push(`  repo       ${repo ?? 'unknown'}`);
  L.push(`  workflow   ${workflow}`);
  L.push(`  schedule   ${crons.length ? crons.map(c => `'${c}'`).join('  ') : cronError ?? 'none declared'}`);
  L.push('');

  if (fetchError) {
    L.push(`  !! ${fetchError}`);
    L.push('');
    L.push('  Nothing could be established about the remote job. This is a fact about');
    L.push('  the check, not about the run — do not read it as either outcome.');
    return L.join('\n');
  }

  L.push('RUNS');
  if (!runs.length) {
    L.push('  none — this workflow has never run, by schedule or by hand');
  } else {
    L.push(`  ${total} total, most recent first`);
    for (const r of runs.slice(0, 5)) {
      const outcome = r.status === 'completed' ? (r.conclusion ?? '?') : r.status;
      L.push(`  #${r.number}  ${stamp(Date.parse(r.startedAt))}  ${r.event.padEnd(18)} ${outcome}`);
    }
  }
  L.push('');

  L.push('SCHEDULE');
  L.push(`  last firing due    ${stamp(verdict.due)}${verdict.overdueMinutes === null ? '' : `   (${humanMinutes(verdict.overdueMinutes)} ago)`}`);
  L.push(`  last run started   ${stamp(verdict.lastRunAt)}`);
  L.push(`  next firing due    ${stamp(verdict.next)}`);
  L.push('');

  /* The verdict is spelled out with what to DO, because the states that matter
     most are the ones where doing nothing is the correct action and looks
     identical to neglect. */
  const say = {
    ok: [
      '  OK — a run appeared for the firing that was most recently due.',
    ],
    late: [
      `  LATE — the firing above has no run yet, ${humanMinutes(verdict.overdueMinutes)} on.`,
      `  This is normal. GitHub's scheduled trigger is best-effort and lowest`,
      `  priority; ten to sixty minutes late is routine. Nothing to do until it`,
      `  passes the ${verdict.graceMinutes}-minute grace window.`,
    ],
    missed: [
      `  MISSED — ${humanMinutes(verdict.overdueMinutes)} overdue, past the ${verdict.graceMinutes}-minute grace window.`,
      '  GitHub drops scheduled firings under load and does not retry them. For the',
      '  WEEKLY cron this is survivable by design — the cadence is 25 days against a',
      '  30-day cap, so three more chances remain before anything is at risk. Check',
      '  `npm run status` for the clock that actually matters. A one-off cron, though,',
      '  gets no second chance: re-arm it or trigger the workflow by hand.',
    ],
    never: [
      '  NEVER RUN — a firing has already passed and this workflow has no runs at all.',
      '  That points at the workflow rather than the queue. Worth checking, in order:',
      '    1. was the cron on the DEFAULT branch well before its fire time?',
      '       (GitHub commonly skips the first firing of a newly pushed schedule)',
      '    2. is the workflow enabled? Actions can disable a schedule after 60 days',
      '       of repo inactivity, and the Actions tab shows it greyed',
      '    3. does the YAML parse? A malformed `on:` block registers with no trigger',
      '  Fastest proof it works at all: run it from the Actions tab (workflow_dispatch).',
    ],
    idle: ['  IDLE — a schedule exists but nothing was due inside the horizon.'],
    unscheduled: [
      '  UNSCHEDULED — this workflow declares no cron, so it only ever runs when',
      '  something triggers it. Nothing here is overdue because nothing is promised.',
    ],
  }[verdict.state] ?? ['  (no verdict)'];

  L.push(...say);

  /* A green schedule with a red run is the sneakiest state of the lot: the job
     is firing perfectly and publishing nothing. */
  const latest = runs[0];
  if (latest && latest.status === 'completed' && latest.conclusion && latest.conclusion !== 'success') {
    L.push('');
    L.push(`  !! The most recent run (#${latest.number}) ended "${latest.conclusion}".`);
    L.push(`     ${latest.url}`);
  }
  if (latest && latest.status !== 'completed') {
    L.push('');
    L.push(`  Run #${latest.number} is ${latest.status} right now — ${latest.url}`);
  }

  L.push('');
  L.push('  This checks whether the JOB RAN. Whether the live deck is still inside the');
  L.push('  30-day cap is a different question — `npm run status` answers that one.');
  return L.join('\n');
}

async function main() {
  const now = Date.now();
  const { crons, error: cronError } = await readCrons();
  const repo = await readRepo();

  const fetched = repo
    ? await fetchRuns(repo)
    : { error: 'could not determine owner/name — pass --repo owner/name', runs: [], total: null };

  /* Any run counts as liveness, dispatched or scheduled — see scheduleStatus. */
  const verdict = scheduleStatus({
    crons,
    lastRunAt: fetched.runs[0]?.startedAt ?? null,
    totalRuns: fetched.total,
    now,
  });

  const text = render({
    repo, workflow: WORKFLOW, crons, cronError,
    fetchError: fetched.error, runs: fetched.runs, total: fetched.total,
    verdict, now,
  });

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ repo, workflow: WORKFLOW, crons, error: fetched.error, total: fetched.total, runs: fetched.runs, verdict }, null, 2));
  } else {
    console.log(text);
  }

  /* Always leave a copy on disk. The point of this tool is to be run
     unattended — from a task, a shell prompt, a loop — and a verdict that only
     ever existed in a terminal that has since been closed is not a receipt.
     reports/ is gitignored, so nothing here can ride into history. */
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, text + '\n', 'utf8');
  if (!process.argv.includes('--json')) console.log(`\n  written to reports/refresh-runs.txt`);

  /* `process.exitCode` rather than `process.exit()`. A hard exit while fetch's
     keep-alive socket is still pooled trips a libuv assertion on Windows
     ("UV_HANDLE_CLOSING", src\win\async.c) — a crash printed after a report that
     already succeeded, which is exactly the kind of noise that teaches somebody
     to stop trusting the tool. Setting the code and letting the loop drain exits
     just as deliberately and stays quiet. */
  const latest = fetched.runs[0];
  const runFailed = latest?.status === 'completed' && latest.conclusion && latest.conclusion !== 'success';

  /* An unreachable API is not a verdict about the job, so it must not masquerade
     as one in an exit code either. */
  if (fetched.error) process.exitCode = 1;
  else if (verdict.state === 'missed' || verdict.state === 'never' || runFailed) process.exitCode = 2;
  else if (verdict.state === 'late') process.exitCode = 1;
  else process.exitCode = 0;
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/refresh-runs.js');
if (isMain) main().catch(err => { console.error(err); process.exit(1); });
