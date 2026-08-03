/* engine/schedule — PURE. When a cron was supposed to fire, and whether the run
   that should have answered it ever showed up. No fetch, no clock of its own —
   `now` is injected, exactly like freshness.js's dates and gacha.js's rng.

   WHY THIS EXISTS. The refresh moved into GitHub Actions and reports itself by
   email on every run. That covers the two failure modes anybody thinks of: it
   worked, or it broke. It does not cover the third one, which is the one that
   actually happened on 2026-08-03 — THE JOB NEVER RAN AT ALL.

   Nothing reports that. No run means no steps, so `if: failure()` never fires
   and no failure mail is sent; and because the workflow builds into the runner
   and uploads straight to the CDN, a run that does not happen leaves the laptop
   byte-for-byte identical. `status.js` and `refresh-report.js` both open by
   promising they read files only, which is what makes them safe to run on a
   timer — and is exactly why neither of them can see this. Silence is
   indistinguishable from success in every channel we had.

   So the question this answers is the one no local file can: given the schedule
   the workflow claims to keep, has a run appeared for the firing that was most
   recently due?

   ON WAITING BEFORE CALLING IT MISSED. GitHub's scheduled trigger is best-effort
   and the lowest-priority thing on the queue. Delays of ten to sixty minutes are
   routine rather than exceptional, and under load a firing is dropped outright
   with no retry and no notice. A checker that shouts at minute one would be
   wrong most times it spoke, and a checker people learn to ignore is worse than
   no checker. Hence a grace window, and `late` and `missed` as separate verdicts
   rather than one impatient boolean. */

/* How long a firing may be overdue before it is treated as dropped rather than
   queued. Ninety minutes sits past the fat part of GitHub's delay distribution:
   inside it, waiting is the correct action and nothing is wrong yet. */
export const GRACE_MINUTES = 90;

/* How far back `previousFiring` will look. Comfortably longer than the weekly
   cadence and the 30-day policy window, so a monthly-ish cron still resolves. */
const HORIZON_DAYS = 45;

const MS_PER_MINUTE = 60 * 1000;

/* One cron field -> the set of values it permits.

   Handles the four forms POSIX cron actually uses: `*`, a number, a `a-b` range,
   a `/n` step on either, and any of those in a comma list. Anything it cannot
   parse throws, because a cron expression this tool misreads would produce a
   confidently wrong "missed" verdict — louder and more useless than no verdict. */
export function cronField(field, min, max) {
  const out = new Set();
  for (const part of String(field).split(',')) {
    const [range, stepText] = part.split('/');
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) throw new Error(`bad cron step in "${field}"`);

    let lo, hi;
    if (range === '*') {
      lo = min; hi = max;
    } else if (range.includes('-')) {
      const ends = range.split('-');
      /* `Number('')` is 0, so an empty endpoint would quietly turn "-4" into
         "0-4" — a malformed field read as a valid one. Reject it explicitly. */
      if (ends.length !== 2 || ends.some(e => e.trim() === '')) throw new Error(`bad cron range "${range}" in "${field}"`);
      const [a, b] = ends.map(Number);
      lo = a; hi = b;
    } else {
      lo = Number(range);
      /* A bare number with a step means "from here to the end" — `5/10` is 5,
         15, 25... — while a bare number alone is just itself. */
      hi = stepText === undefined ? lo : max;
    }
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < min || hi > max || lo > hi) {
      throw new Error(`bad cron field "${field}" (expected ${min}-${max})`);
    }
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

/* Does a 5-field cron fire at this instant? UTC always — GitHub's scheduler does
   not know about local time and does not follow daylight saving, so reading the
   expression in any other zone would be a bug that only appears twice a year. */
export function matchesCron(expr, date) {
  const fields = String(expr).trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`expected 5 cron fields, got ${fields.length}: "${expr}"`);
  const [minute, hour, dom, month, dow] = fields;

  const d = date instanceof Date ? date : new Date(date);

  if (!cronField(minute, 0, 59).has(d.getUTCMinutes())) return false;
  if (!cronField(hour, 0, 23).has(d.getUTCHours())) return false;
  if (!cronField(month, 1, 12).has(d.getUTCMonth() + 1)) return false;

  /* THE DAY RULE, which is the one everybody gets wrong. When BOTH day-of-month
     and day-of-week are restricted, cron ORs them rather than ANDing them —
     `0 6 1 * 1` is "the 1st, and also every Monday", not "Mondays that fall on
     the 1st". When either is `*` it drops out and the other decides alone. */
  const domRestricted = dom.trim() !== '*';
  const dowRestricted = dow.trim() !== '*';
  /* Cron accepts 7 as Sunday alongside 0; normalise so both spellings match. */
  const dowSet = cronField(dow, 0, 7);
  const dowHit = dowSet.has(d.getUTCDay()) || (d.getUTCDay() === 0 && dowSet.has(7));
  const domHit = cronField(dom, 1, 31).has(d.getUTCDate());

  if (domRestricted && dowRestricted) return domHit || dowHit;
  if (domRestricted) return domHit;
  if (dowRestricted) return dowHit;
  return true;
}

/* The most recent instant at or before `now` when any of these crons fired,
   or null if none did inside the horizon.

   Walks back a minute at a time. That is brute force and it is the right call:
   cron's day rule and step syntax make closed-form arithmetic genuinely fiddly
   to get right, the horizon caps this at ~65k cheap integer comparisons, and
   being obviously correct matters more than being fast in a tool whose whole
   job is to be trusted about timing. */
export function previousFiring(crons, now = Date.now(), { horizonDays = HORIZON_DAYS } = {}) {
  const list = (Array.isArray(crons) ? crons : [crons]).filter(Boolean);
  if (!list.length) return null;

  /* Start from the top of the current minute — a cron fires at :00 seconds, and
     a `now` of 07:40:31 must still count 07:40 as having fired. */
  const start = Math.floor(now / MS_PER_MINUTE) * MS_PER_MINUTE;
  const steps = horizonDays * 24 * 60;

  for (let i = 0; i <= steps; i++) {
    const t = start - i * MS_PER_MINUTE;
    const d = new Date(t);
    for (const expr of list) if (matchesCron(expr, d)) return t;
  }
  return null;
}

/* The next instant after `now` when any of these crons will fire. Only ever used
   to tell somebody how long the wait is, so a null just means "not inside the
   horizon" and is printed as such rather than treated as an error. */
export function nextFiring(crons, now = Date.now(), { horizonDays = HORIZON_DAYS } = {}) {
  const list = (Array.isArray(crons) ? crons : [crons]).filter(Boolean);
  if (!list.length) return null;

  const start = Math.floor(now / MS_PER_MINUTE) * MS_PER_MINUTE + MS_PER_MINUTE;
  const steps = horizonDays * 24 * 60;

  for (let i = 0; i <= steps; i++) {
    const t = start + i * MS_PER_MINUTE;
    const d = new Date(t);
    for (const expr of list) if (matchesCron(expr, d)) return t;
  }
  return null;
}

/* THE VERDICT: did the scheduled job keep its own schedule?

     unscheduled  the workflow declares no cron at all
     idle         a schedule exists but nothing was due inside the horizon
     ok           a run appeared at or after the firing that was most recently due
     late         that firing has passed with no run, but inside the grace window
     missed       past grace — GitHub dropped it, and there is no retry coming
     never        a schedule exists, a firing has passed, and the workflow has
                  NEVER run even once

   `never` is split out from `missed` because the two mean different things and
   want different fixes. A missed firing is GitHub being GitHub and the next one
   will probably land. Never having run at all, when a firing is already behind
   you, points at the workflow rather than the queue — a cron added minutes
   before its own fire time, a schedule that was never registered, Actions
   disabled on the repo. That was the 2026-08-03 case exactly.

   `lastRunAt` is the start of the most recent run of ANY kind, dispatched or
   scheduled, and that is deliberate: this answers "is the job alive", and a
   manual run proves liveness just as well as a scheduled one. */
export function scheduleStatus({ crons = [], lastRunAt = null, totalRuns = null, now = Date.now(), graceMinutes = GRACE_MINUTES } = {}) {
  const list = (Array.isArray(crons) ? crons : [crons]).filter(Boolean);
  const next = nextFiring(list, now);
  const base = { crons: list, next, due: null, lastRunAt: null, overdueMinutes: null, graceMinutes };

  if (!list.length) return { ...base, state: 'unscheduled' };

  const due = previousFiring(list, now);
  if (due === null) return { ...base, state: 'idle' };

  const last = lastRunAt === null || lastRunAt === undefined ? null
    : lastRunAt instanceof Date ? lastRunAt.getTime()
    : typeof lastRunAt === 'number' ? lastRunAt
    : Date.parse(String(lastRunAt));
  const lastMs = Number.isFinite(last) ? last : null;

  const overdueMinutes = Math.floor((now - due) / MS_PER_MINUTE);
  const shaped = { ...base, due, lastRunAt: lastMs, overdueMinutes };

  /* A run that started at or after the firing is that firing's run. Started
     before it, and it belongs to an earlier one — this firing is still outstanding. */
  if (lastMs !== null && lastMs >= due) return { ...shaped, state: 'ok' };

  const everRan = totalRuns === null || totalRuns === undefined ? lastMs !== null : totalRuns > 0;
  if (!everRan) return { ...shaped, state: 'never' };

  return { ...shaped, state: overdueMinutes > graceMinutes ? 'missed' : 'late' };
}
