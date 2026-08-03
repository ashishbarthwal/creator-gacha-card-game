/* test/schedule — pins the "did the scheduled job run" verdict on an injected
   `now`, so every assertion here is exact and none of them change answer
   tomorrow. No files, no network.

   The load-bearing case is the last block: `never` must not be reported as
   `missed`. They read alike and mean opposite things — a missed firing is
   GitHub's queue being GitHub's queue and the next one will land, while a
   workflow with a firing behind it and no runs at all is broken and will stay
   broken until somebody touches it. Collapsing the two would have turned the
   2026-08-03 test failure into "eh, it'll come round again". */

import { describe, it, expect } from 'vitest';
import {
  cronField,
  matchesCron,
  previousFiring,
  nextFiring,
  scheduleStatus,
  GRACE_MINUTES,
} from '../src/engine/schedule.js';

/* The two crons the refresh workflow actually declared on 2026-08-03. */
const WEEKLY = '0 6 * * 0';        // Sundays 06:00 UTC
const ONE_OFF = '40 7 3 8 *';      // 3 August, 07:40 UTC

const at = (...args) => Date.UTC(...args);
const MIN = 60 * 1000;

describe('cronField', () => {
  it('expands the four forms cron actually uses', () => {
    expect([...cronField('*', 0, 3)]).toEqual([0, 1, 2, 3]);
    expect([...cronField('7', 0, 59)]).toEqual([7]);
    expect([...cronField('2-5', 0, 59)]).toEqual([2, 3, 4, 5]);
    expect([...cronField('*/15', 0, 59)]).toEqual([0, 15, 30, 45]);
    expect([...cronField('1,3,9', 0, 59)]).toEqual([1, 3, 9]);
  });

  it('reads a bare number with a step as "from here on"', () => {
    /* `5/20` is 5, 25, 45 — not just 5. Getting this wrong would silently
       shrink a schedule to its first firing. */
    expect([...cronField('5/20', 0, 59)]).toEqual([5, 25, 45]);
  });

  it('throws on junk rather than guessing', () => {
    /* A misread expression produces a confidently wrong "missed" verdict, which
       is louder and less useful than no verdict at all. */
    for (const bad of ['99', '5-2', 'x', '*/0', '-4']) {
      expect(() => cronField(bad, 0, 59)).toThrow();
    }
  });
});

describe('matchesCron', () => {
  it('fires the weekly cron on Sunday 06:00 UTC and no other minute', () => {
    expect(matchesCron(WEEKLY, new Date(at(2026, 7, 2, 6, 0)))).toBe(true);   // Sun 2 Aug
    expect(matchesCron(WEEKLY, new Date(at(2026, 7, 2, 6, 1)))).toBe(false);
    expect(matchesCron(WEEKLY, new Date(at(2026, 7, 2, 5, 0)))).toBe(false);
    expect(matchesCron(WEEKLY, new Date(at(2026, 7, 3, 6, 0)))).toBe(false);  // Mon
  });

  it('fires the one-off on its date only', () => {
    expect(matchesCron(ONE_OFF, new Date(at(2026, 7, 3, 7, 40)))).toBe(true);
    expect(matchesCron(ONE_OFF, new Date(at(2026, 7, 4, 7, 40)))).toBe(false);
    expect(matchesCron(ONE_OFF, new Date(at(2026, 8, 3, 7, 40)))).toBe(false); // September
  });

  it('reads UTC, never local time', () => {
    /* GitHub's scheduler does not follow daylight saving and does not know the
       operator is in IST. Reading the expression in any other zone is a bug that
       only shows up twice a year. */
    expect(matchesCron('0 6 * * 0', new Date('2026-08-02T06:00:00Z'))).toBe(true);
    expect(matchesCron('0 6 * * 0', new Date('2026-08-02T06:00:00+05:30'))).toBe(false);
  });

  it('ORs day-of-month with day-of-week when both are restricted', () => {
    /* The rule everybody gets wrong. `0 6 1 * 1` is "the 1st, and also every
       Monday" — not "Mondays that fall on the 1st". */
    const both = '0 6 1 * 1';
    expect(matchesCron(both, new Date(at(2026, 8, 1, 6, 0)))).toBe(true);   // 1st, a Tuesday
    expect(matchesCron(both, new Date(at(2026, 8, 7, 6, 0)))).toBe(true);   // a Monday
    expect(matchesCron(both, new Date(at(2026, 8, 8, 6, 0)))).toBe(false);  // neither
  });

  it('accepts 7 as Sunday, like cron does', () => {
    expect(matchesCron('0 6 * * 7', new Date(at(2026, 7, 2, 6, 0)))).toBe(true);
  });

  it('throws unless there are exactly 5 fields', () => {
    expect(() => matchesCron('0 6 * *', new Date())).toThrow();
    expect(() => matchesCron('0 0 6 * * 0', new Date())).toThrow();   // 6-field/seconds form
  });
});

describe('previousFiring / nextFiring', () => {
  it('finds the most recent firing across several crons', () => {
    /* 08:35 on 3 Aug: the one-off at 07:40 is the latest, beating Sunday's 06:00. */
    const now = at(2026, 7, 3, 8, 35);
    expect(previousFiring([WEEKLY, ONE_OFF], now)).toBe(at(2026, 7, 3, 7, 40));
  });

  it('counts the current minute as already fired', () => {
    /* At 07:40:31 the 07:40 firing has happened. Excluding it would report the
       job late a full week early. */
    const now = at(2026, 7, 3, 7, 40) + 31 * 1000;
    expect(previousFiring([ONE_OFF], now)).toBe(at(2026, 7, 3, 7, 40));
  });

  it('looks forward for the next chance', () => {
    const now = at(2026, 7, 3, 8, 35);
    expect(nextFiring([WEEKLY, ONE_OFF], now)).toBe(at(2026, 7, 9, 6, 0));   // Sun 9 Aug
  });

  it('is null when nothing fires inside the horizon, and for no crons', () => {
    expect(previousFiring([ONE_OFF], at(2026, 9, 1), { horizonDays: 5 })).toBeNull();
    expect(previousFiring([], at(2026, 7, 3))).toBeNull();
  });
});

describe('scheduleStatus', () => {
  const crons = [WEEKLY, ONE_OFF];
  const due = at(2026, 7, 3, 7, 40);

  it('is ok when a run started at or after the firing', () => {
    const v = scheduleStatus({ crons, lastRunAt: due + 12 * MIN, totalRuns: 3, now: due + 40 * MIN });
    expect(v.state).toBe('ok');
    expect(v.due).toBe(due);
  });

  it('is late inside the grace window — the state where doing nothing is correct', () => {
    /* GitHub's scheduled trigger is best-effort and lowest priority. Ten to
       sixty minutes late is routine, so shouting here would make the tool one
       people learn to ignore. */
    const v = scheduleStatus({ crons, lastRunAt: at(2026, 6, 27), totalRuns: 3, now: due + 55 * MIN });
    expect(v.state).toBe('late');
    expect(v.overdueMinutes).toBe(55);
  });

  it('is missed once past grace', () => {
    const v = scheduleStatus({ crons, lastRunAt: at(2026, 6, 27), totalRuns: 3, now: due + (GRACE_MINUTES + 1) * MIN });
    expect(v.state).toBe('missed');
  });

  it('treats a run that started BEFORE the firing as not answering it', () => {
    /* Last week's successful run says nothing about this week's firing. */
    const v = scheduleStatus({ crons, lastRunAt: due - 60 * MIN, totalRuns: 3, now: due + 120 * MIN });
    expect(v.state).toBe('missed');
  });

  it('counts a manual dispatch as liveness', () => {
    /* This answers "is the job alive". A hand-triggered run proves that as well
       as a scheduled one does, and pretending otherwise would nag after Ash had
       already fixed it by hand. */
    const v = scheduleStatus({ crons, lastRunAt: due + 5 * MIN, totalRuns: 1, now: due + 90 * MIN });
    expect(v.state).toBe('ok');
  });

  it('separates NEVER RUN from missed — the 2026-08-03 case', () => {
    /* The actual failure: cron pushed to main at 07:18, due 07:40, and at 08:35
       the workflow had zero runs of any kind. "Missed" would have said wait for
       next Sunday; the truth was that the schedule never registered at all. */
    const v = scheduleStatus({ crons, lastRunAt: null, totalRuns: 0, now: at(2026, 7, 3, 8, 35) });
    expect(v.state).toBe('never');
    expect(v.due).toBe(due);
    expect(v.overdueMinutes).toBe(55);
  });

  it('says unscheduled rather than overdue when no cron is declared', () => {
    /* A workflow that only runs on dispatch promises nothing, so nothing about
       it can be late. */
    expect(scheduleStatus({ crons: [], now: at(2026, 7, 3) }).state).toBe('unscheduled');
  });

  it('reports the next firing in every state, so the wait is always visible', () => {
    for (const totalRuns of [0, 3]) {
      const v = scheduleStatus({ crons, lastRunAt: null, totalRuns, now: at(2026, 7, 3, 8, 35) });
      expect(v.next).toBe(at(2026, 7, 9, 6, 0));
    }
  });
});
