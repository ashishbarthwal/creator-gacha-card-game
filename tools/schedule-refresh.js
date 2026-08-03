#!/usr/bin/env node
/* tools/schedule-refresh — register (or remove) a Windows scheduled task that
   refreshes and republishes the deck.

   ── RETIRED AS THE PRIMARY MECHANISM (2026-08-03) ────────────────────────────
   The weekly refresh now runs in GitHub Actions (.github/workflows/refresh.yml),
   and the local task is UNREGISTERED. This file stays as a fallback for a
   machine that needs to carry the cadence itself — a laptop with the key and no
   CI, say — and as the record of why that arrangement was not good enough.

   THE REASON IT WAS NOT GOOD ENOUGH: a scheduled task cannot run while the
   laptop is off, and cannot exist at all once the laptop dies. The 30-day cap on
   stored statistics is a compliance obligation on a PUBLIC site, and pinning it
   to one consumer device is a single point of failure with a deadline attached.
   It also ran only while the user was logged in (LogonType Interactive), which
   nobody would have noticed until a month had passed.

   Do not re-register this alongside the workflow. Two schedulers publishing the
   same site race each other to the CDN and double the quota spend.
   ─────────────────────────────────────────────────────────────────────────────

   WHY THIS IS A SCRIPT AND NOT A WIKI PAGE. The refresh is the one piece of this
   project that is a CHORE rather than code: build-site.js explicitly accepts
   that trade ("the 25-day refresh becomes a chore somebody has to remember
   instead of a cron job") because the deploy needs an API key and cannot run in
   CI. A chore that lives only in someone's memory is a chore that gets missed,
   and the cost of missing it is a public site serving statistics it is no longer
   allowed to store. So the chore gets committed, reviewable, and repeatable on a
   new machine.

   WHY WEEKLY, WHEN THE CADENCE IS 25 DAYS. The schedule is not the cadence — it
   is how many chances the cadence gets. A task set to fire every 25 days on a
   laptop that happens to be asleep that afternoon has missed by the time anyone
   notices, and the hard limit is only 5 days later. Weekly firing plus
   StartWhenAvailable means roughly four independent chances inside every policy
   window, and a run costs ~400 quota units against 10,000/day, so the extra
   attempts are free. Refreshing early is never wrong; refreshing late is a
   policy breach.

   Run:   node tools/schedule-refresh.js            (register or update)
          node tools/schedule-refresh.js --status
          node tools/schedule-refresh.js --remove
          node tools/schedule-refresh.js --run      (fire it once, now)

   No elevation needed: the task is registered for the current user and runs only
   when that user is logged on, which also means no stored password. */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const run = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const WRAPPER = resolve(__dirname, 'refresh.cmd');

const TASK = 'CreatorGacha-Refresh';
const DAY = 'Sunday';
const AT = '2pm';

async function ps(script) {
  const { stdout, stderr } = await run('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { maxBuffer: 10 * 1024 * 1024 });
  return (stdout + stderr).trim();
}

const REGISTER = `
$ErrorActionPreference = 'Stop'
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c "${WRAPPER}"' -WorkingDirectory '${ROOT}'
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek ${DAY} -At ${AT}
# StartWhenAvailable is the whole point: a laptop that was off on Sunday runs the
# job as soon as it is back, instead of silently waiting a week for the next slot.
# The battery flags matter for the same reason — the default is to skip on battery
# and then never catch up.
$settings = New-ScheduledTaskSettingsSet \`
  -StartWhenAvailable \`
  -AllowStartIfOnBatteries \`
  -DontStopIfGoingOnBatteries \`
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) \`
  -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName '${TASK}' \`
  -Action $action -Trigger $trigger -Settings $settings -Force \`
  -Description 'Creator Gacha: rebuild the card set from live YouTube stats and redeploy, keeping the published snapshot inside the 30-day cap on stored statistics. Logs to reports\\refresh.log.' | Out-Null
'registered'
`;

const STATUS = `
$ErrorActionPreference = 'SilentlyContinue'
$t = Get-ScheduledTask -TaskName '${TASK}'
if (-not $t) { 'NOT REGISTERED'; exit }
$i = Get-ScheduledTaskInfo -TaskName '${TASK}'
"state        " + $t.State
"next run     " + $i.NextRunTime
"last run     " + $i.LastRunTime
"last result  " + $i.LastTaskResult
`;

async function main() {
  if (process.platform !== 'win32') {
    console.error('This registers a WINDOWS scheduled task. On another OS, run tools/refresh.cmd\'s');
    console.error('equivalent from cron:  0 14 * * 0  cd <repo> && npm run deploy');
    process.exit(1);
  }

  const flags = process.argv.slice(2);

  if (flags.includes('--remove')) {
    await ps(`Unregister-ScheduledTask -TaskName '${TASK}' -Confirm:$false`);
    return console.log(`Removed the scheduled task "${TASK}".`);
  }

  if (flags.includes('--status')) {
    return console.log(await ps(STATUS));
  }

  if (flags.includes('--run')) {
    await ps(`Start-ScheduledTask -TaskName '${TASK}'`);
    console.log(`Started "${TASK}" now. It runs in the background —`);
    return console.log('  watch:  Get-Content reports\\refresh.log -Wait -Tail 20');
  }

  await ps(REGISTER);
  console.log(`Registered "${TASK}" — every ${DAY} at ${AT}, catching up after a missed start.`);
  console.log(`  runs:  ${WRAPPER}`);
  console.log('  logs:  reports\\refresh.log   (gitignored)');
  console.log('\nEach run spends ~400 quota units re-hydrating every candidate id, then');
  console.log('redeploys to production. It leaves catalog/refresh-log.json modified on');
  console.log('purpose — the ledger is a committed receipt, and an unattended job should');
  console.log('not be writing to git history on its own.\n');
  console.log(await ps(STATUS));
}

main().catch(err => { console.error(err.message ?? err); process.exit(1); });
