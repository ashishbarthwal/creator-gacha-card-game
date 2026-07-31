/* test/freshness — pins the refresh clock on an injected `now`, so "is this set
   too old to publish" is an exact assertion rather than something that changes
   answer tomorrow. No files, no network.

   The load-bearing test is the last one in the status block: a set with no
   snapshotDate must be UNPUBLISHABLE, not treated as fresh. Failing open there
   would mean an undated file — the one whose age nobody can establish — sails
   past the guard that exists to catch exactly that. */

import { describe, it, expect } from 'vitest';
import {
  daysSince,
  refreshStatus,
  refreshEntry,
  appendRefreshEntry,
  lastEntry,
  REFRESH_DAYS,
  POLICY_DAYS,
} from '../src/engine/freshness.js';

const NOW = Date.UTC(2026, 7, 1);                       // 2026-08-01, a fixed clock
const daysAgo = n => new Date(NOW - n * 24 * 3600 * 1000).toISOString().slice(0, 10);

describe('daysSince', () => {
  it('counts whole days from an ISO day string', () => {
    expect(daysSince(daysAgo(10), NOW)).toBe(10);
    expect(daysSince(daysAgo(0), NOW)).toBe(0);
  });

  it('accepts a Date and a timestamp too', () => {
    expect(daysSince(new Date(NOW - 3 * 24 * 3600 * 1000), NOW)).toBe(3);
    expect(daysSince(NOW - 3 * 24 * 3600 * 1000, NOW)).toBe(3);
  });

  it('is null — never NaN or 0 — for a missing or junk date', () => {
    /* The starter set legitimately carries no snapshotDate. Reading that as
       "zero days old" would call an undated set the freshest thing we have. */
    for (const bad of ['', null, undefined, 'not a date', {}]) {
      expect(daysSince(bad, NOW)).toBeNull();
    }
  });
});

describe('refreshStatus — two thresholds, because one would be routed around', () => {
  it('is fresh inside the cadence', () => {
    const s = refreshStatus(daysAgo(3), { now: NOW });
    expect(s).toMatchObject({ state: 'fresh', ageDays: 3, publishable: true });
    expect(s.dueInDays).toBe(REFRESH_DAYS - 3);
  });

  it('is due at the cadence but still publishable', () => {
    /* Deliberate: refusing at 25 would block a day-26 publish of data that is
       still policy-compliant, which teaches somebody to reach for a bypass. */
    const s = refreshStatus(daysAgo(REFRESH_DAYS), { now: NOW });
    expect(s.state).toBe('due');
    expect(s.publishable).toBe(true);
  });

  it('is expired at the policy cap and refuses to publish', () => {
    const s = refreshStatus(daysAgo(POLICY_DAYS), { now: NOW });
    expect(s).toMatchObject({ state: 'expired', publishable: false });
    expect(s.expiresInDays).toBeLessThanOrEqual(0);
  });

  it('counts down to both thresholds so a report can say "refresh in N days"', () => {
    const s = refreshStatus(daysAgo(20), { now: NOW });
    expect(s.dueInDays).toBe(5);
    expect(s.expiresInDays).toBe(10);
  });

  it('treats an undated set as unknown AND unpublishable — fails closed', () => {
    for (const missing of ['', null, undefined]) {
      const s = refreshStatus(missing, { now: NOW });
      expect(s.state).toBe('unknown');
      expect(s.publishable).toBe(false);
    }
  });

  it('leaves the cadence five days clear of the policy cap', () => {
    expect(POLICY_DAYS - REFRESH_DAYS).toBe(5);
  });
});

describe('the refresh ledger', () => {
  it('records dates and counts only — never creator data', () => {
    /* This is what lets the ledger be COMMITTED while every file carrying
       statistics stays out of git. A test asserts the exact key set, because the
       risk is a future field quietly making it creator data. */
    const entry = refreshEntry({ event: 'build', slug: 's1', cards: 400, snapshotDate: '2026-08-01', now: NOW });
    expect(Object.keys(entry).sort()).toEqual(['at', 'cards', 'event', 'slug', 'snapshotDate']);
    expect(JSON.stringify(entry)).not.toMatch(/title|avatar|subscriber|country|UC[0-9A-Za-z_-]{20}/);
  });

  it('appends newest last, so the file reads like a history', () => {
    let log = { entries: [] };
    log = appendRefreshEntry(log, refreshEntry({ event: 'build', now: NOW }));
    log = appendRefreshEntry(log, refreshEntry({ event: 'deploy', now: NOW }));
    expect(log.entries.map(e => e.event)).toEqual(['build', 'deploy']);
  });

  it('trims from the front, keeping recent history', () => {
    let log = { entries: [] };
    for (let i = 0; i < 10; i++) {
      log = appendRefreshEntry(log, refreshEntry({ event: 'build', cards: i, now: NOW }), { limit: 4 });
    }
    expect(log.entries).toHaveLength(4);
    expect(log.entries.map(e => e.cards)).toEqual([6, 7, 8, 9]);
  });

  it('survives a missing or malformed log rather than throwing', () => {
    expect(appendRefreshEntry(null, refreshEntry({ event: 'build', now: NOW })).entries).toHaveLength(1);
    expect(appendRefreshEntry({ entries: 'nope' }, refreshEntry({ event: 'build', now: NOW })).entries).toHaveLength(1);
  });

  it('finds the last entry of a kind — "when did we last actually publish"', () => {
    /* The date that matters is the deploy, not the build: rebuilding locally
       refreshes nothing a visitor can see. */
    let log = { entries: [] };
    log = appendRefreshEntry(log, refreshEntry({ event: 'deploy', slug: 'old', now: NOW - 9e8 }));
    log = appendRefreshEntry(log, refreshEntry({ event: 'build', slug: 'new', now: NOW }));
    expect(lastEntry(log, 'deploy').slug).toBe('old');
    expect(lastEntry(log).slug).toBe('new');
    expect(lastEntry({ entries: [] }, 'deploy')).toBeNull();
  });
});
