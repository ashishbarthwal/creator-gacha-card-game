/* engine/freshness — PURE. How old a built set is, whether it may still be
   published, and the refresh ledger's shape. No fetch, no clock of its own —
   `now` is injected, exactly like gacha.js's rng and discover.js's clock.

   WHY THIS EXISTS. YouTube's Developer Policies cap stored statistics at 30
   days, which is the reason sets are monthly printings at all. Everything about
   honouring that cap was already built — `build-set.js` re-hydrates every id in
   one run, so a single command resets the whole clock for 13 quota units — and
   none of it was ever CHECKED. A set 40 days old built, assembled and served
   exactly like a fresh one.

   That gap is worse here than it would be in most projects, because the deploy
   deliberately runs on one person's machine rather than in CI (DECISIONS.md: the
   key never goes near a repo secret). The cost was accepted openly at the time —
   "the 25-day refresh becomes a chore somebody has to remember" — but a chore
   with no alarm attached is one that gets missed, and a missed one is a
   compliance problem rather than an inconvenience.

   So: two thresholds, not one.

     REFRESH_DAYS  25   the cadence. Five days of slack before the real limit,
                        which is what makes a missed Sunday survivable.
     POLICY_DAYS   30   the actual cap. Past this the data may not be published,
                        so the guard REFUSES rather than warns.

   Warning at 25 and refusing at 30 is deliberate. Refusing at 25 would block a
   day-26 publish of data that is still perfectly compliant, which trains
   somebody to reach for a bypass flag — and a guard people route around is worse
   than no guard, because it looks like protection. */

/* The cadence, and the hard limit that makes it necessary. */
export const REFRESH_DAYS = 25;
export const POLICY_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/* Whole days between an ISO day string (or Date, or ms) and `now`.
   Returns null for anything unparseable rather than NaN, so a caller can tell
   "no date" from "zero days" — the demo set legitimately carries no
   snapshotDate, and reading that as "0 days old" would be wrong twice over. */
export function daysSince(dateish, now = Date.now()) {
  if (dateish === null || dateish === undefined || dateish === '') return null;
  const then = dateish instanceof Date ? dateish.getTime()
    : typeof dateish === 'number' ? dateish
    : Date.parse(String(dateish));
  if (!Number.isFinite(then)) return null;
  return Math.floor((now - then) / MS_PER_DAY);
}

/* The verdict on one built set.

     unknown   no usable snapshotDate — cannot be judged, so cannot be trusted
     fresh     inside the cadence
     due       past the cadence, still inside policy — refresh soon
     expired   past the policy cap — must not be published

   `expired` and `unknown` are both publish-blocking, and that pairing is the
   point: a set with no date is not a set that is fine, it is a set whose age
   nobody can establish. Failing closed is the only safe reading of it. */
export function refreshStatus(snapshotDate, { now = Date.now(), refreshDays = REFRESH_DAYS, policyDays = POLICY_DAYS } = {}) {
  const ageDays = daysSince(snapshotDate, now);
  if (ageDays === null) {
    return { snapshotDate: snapshotDate ?? '', ageDays: null, dueInDays: null, expiresInDays: null, state: 'unknown', publishable: false };
  }
  const state = ageDays >= policyDays ? 'expired' : ageDays >= refreshDays ? 'due' : 'fresh';
  return {
    snapshotDate: String(snapshotDate),
    ageDays,
    dueInDays: refreshDays - ageDays,      // negative once overdue
    expiresInDays: policyDays - ageDays,
    state,
    publishable: state !== 'expired',
  };
}

/* One line of the refresh ledger.

   The ledger is the answer to "did the cadence actually happen", and it is the
   only artifact that can answer it — the built set carries a single
   snapshotDate, so it knows when it was last made and nothing about the runs
   before that. A missed month is invisible in the set and obvious in the log.

   It holds dates and counts only: no titles, no ids, no statistics. That is what
   lets it be COMMITTED while every file carrying creator data stays out of git,
   so the compliance receipt survives losing the machine that produced it. */
export function refreshEntry({ event, slug, cards, snapshotDate, now = Date.now() }) {
  return {
    at: new Date(now).toISOString(),
    event: String(event),                       // 'build' | 'deploy'
    slug: String(slug ?? ''),
    cards: Number(cards ?? 0),
    snapshotDate: String(snapshotDate ?? ''),
  };
}

/* Append-only, newest last, bounded. Trimmed from the FRONT so the recent
   history — the part that answers "are we keeping the cadence" — is what
   survives, and a ledger that runs weekly for years never grows unbounded. */
export function appendRefreshEntry(log, entry, { limit = 300 } = {}) {
  const entries = Array.isArray(log?.entries) ? log.entries : [];
  const next = [...entries, entry];
  return { ...(log ?? {}), entries: next.slice(Math.max(0, next.length - limit)) };
}

/* The most recent entry of a kind, or null. Used to answer "when did we last
   actually PUBLISH", which is the date that matters — rebuilding locally
   refreshes nothing a visitor can see. */
export function lastEntry(log, event = null) {
  const entries = Array.isArray(log?.entries) ? log.entries : [];
  for (let i = entries.length - 1; i >= 0; i--) {
    if (!event || entries[i]?.event === event) return entries[i];
  }
  return null;
}
