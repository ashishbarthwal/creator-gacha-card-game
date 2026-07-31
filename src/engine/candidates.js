/* engine/candidates — PURE. The candidate DB's core: turn discovered channels
   into committed candidate records, merge accumulating runs, and enforce the
   opt-out denylist. No fetch, no key, no DOM, no clock of its own.

   WHAT THIS FILE EXISTS TO GUARANTEE (DECISIONS.md, 2026-07-31): the committed
   source of truth stores channel IDs, our own derived tags, and the denylist —
   never channel data. A UC id is an opaque public identifier; a title, an
   avatar URL, a subscriber count and a self-declared country are not, and two
   separate rules forbid committing them:

     - YouTube's 30-day cap on stored statistics. Anything committed to git is
       permanent, so stored stats could never be refreshed OR deleted on time.
     - An honored opt-out has to actually remove someone. `git rm` on a set file
       leaves them at the old commit in a public repo, so a removal we promised
       in 7 days would be one we cannot perform at all.

   So the strip is not tidiness — it is what makes the promise in the footer
   true. CI hydrates these IDs into full stats at build time and the stats live
   only in the deployed artifact, which can be rebuilt without them.

   Country is deliberately absent from the record too. It is a self-declared
   personal attribute the game never reads, and the region exclude re-runs at
   hydrate against fresh data — which is strictly better than a cached copy,
   since a creator can change what they declare. */

import { toCount } from './core.js';
import { assignPool } from './discover.js';

/* Bumped only when the record shape changes in a way a reader must handle.
   Written into the file so a future migration can branch on it instead of
   guessing from the keys present. */
export const CANDIDATE_DB_VERSION = 1;

const isoDay = ms => new Date(ms).toISOString().slice(0, 10);

/* Accepts both shapes on purpose:

     "UC_abc"                                    hand-edited, fastest path
     { id: "UC_abc", reason: "...", date: "..." } the audit record we write

   The promise is a removal honored in 7 days, and the person keeping it is one
   person reading their own inbox. Requiring the full object to parse would mean
   the fast path under time pressure is the one that silently does nothing, so
   the bare string is supported and normalized rather than rejected. */
export function denylistIds(denylist) {
  const entries = Array.isArray(denylist) ? denylist : (denylist?.denied ?? []);
  const ids = new Set();
  for (const entry of entries) {
    const id = typeof entry === 'string' ? entry : entry?.id;
    if (id) ids.add(String(id));
  }
  return ids;
}

/* One discovered channel -> one committed record. The allowlist is explicit and
   positive: every field is named here, so a new field appearing on the Channel
   shape upstream can never silently start being committed. That is the reverse
   of a blocklist, which would fail open the moment data/index.js grows a key. */
export function toCandidate(channel, { now = Date.now() } = {}) {
  return {
    id: String(channel.id),
    pool: assignPool(channel),
    firstSeen: isoDay(now),
  };
}

/* Merge a sourcing run into the accumulated DB.

   Returns counts alongside the list because the CLI reports them, and a merge
   that says "+12 added, 1 evicted" is auditable in a way a silent write is not.

   Denylist enforcement runs in BOTH directions, and the second is the one that
   matters. Refusing to admit a denied id is obvious. EVICTING one already in the
   DB is what makes an opt-out stick: the honored removal happens once, and every
   future sourcing run that rediscovers that channel — which it will, since the
   channel still exists and still matches the keyword — drops it again without
   anyone remembering to. Without eviction, an opt-out silently expires at the
   next `--random` run. */
export function mergeCandidates(prior, channels, { denylist = [], now = Date.now() } = {}) {
  const denied = denylistIds(denylist);
  const byId = new Map();
  let evicted = 0;

  /* Prior records keep their original firstSeen — it dates OUR first contact,
     not this run — so re-running the pipeline can't rewrite the DB's history. */
  for (const record of prior ?? []) {
    if (!record?.id) continue;
    if (denied.has(String(record.id))) { evicted++; continue; }
    byId.set(String(record.id), record);
  }

  let added = 0;
  let rejected = 0;
  for (const channel of channels ?? []) {
    if (!channel?.id) continue;
    const id = String(channel.id);
    if (denied.has(id)) { rejected++; continue; }
    if (byId.has(id)) continue;               // already known; this run adds nothing
    byId.set(id, toCandidate(channel, { now }));
    added++;
  }

  /* Sorted by id so the committed file has a stable order. A set-valued diff
     that reshuffles on every run is unreviewable, and this file is meant to be
     reviewed — it is the artifact a creator's removal is performed against. */
  const candidates = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { candidates, added, evicted, rejected };
}

/* Pool composition of the DB. Answers the only question that drives the next
   sourcing run: which tier is short. Counts the recorded hint, so it is as
   stale as the hint is — see refreshPools. */
export function poolCounts(candidates) {
  const counts = { legends: 0, majority: 0, wildcards: 0 };
  for (const record of candidates ?? []) {
    if (counts[record?.pool] !== undefined) counts[record.pool]++;
  }
  return counts;
}

/* The recorded `pool` is a HINT, not the authority: it is computed from the
   subscriber count at discovery time, and a channel that crosses 5M afterwards
   carries a stale tag until something recomputes it. Nothing downstream may
   trust it for a build — build-set assigns pools from freshly hydrated stats.

   It is stored anyway because it answers "do I have enough legends to fill a
   set?" between builds, without a key. This function is how the hint self-heals:
   the hydrate step already holds fresh Channel objects, so refreshing costs
   nothing beyond the call. Channels absent from `fresh` keep their old hint —
   an un-hydrated id is unknown, not demoted. */
export function refreshPools(candidates, fresh) {
  const byId = new Map((fresh ?? []).filter(c => c?.id).map(c => [String(c.id), c]));
  return (candidates ?? []).map(record => {
    const channel = byId.get(String(record?.id));
    return channel ? { ...record, pool: assignPool(channel) } : record;
  });
}

/* Hydration is only worth spending quota on for ids that can still become a
   card. Denied ids are dropped before the fetch, not after, so an opted-out
   creator's statistics are never re-requested — the point of an opt-out is that
   we stop looking them up, not that we look them up and discard the result. */
export function hydratableIds(candidates, denylist = []) {
  const denied = denylistIds(denylist);
  const ids = [];
  for (const record of candidates ?? []) {
    const id = record?.id ? String(record.id) : '';
    if (id && !denied.has(id)) ids.push(id);
  }
  return ids;
}

/* Batch ids for channels.list, which accepts up to 50 per call at 1 quota unit.
   A 500-candidate DB therefore hydrates for ~10 units against the 10,000/day
   budget, which is what makes a 25-day refresh cadence cheap enough to be
   routine. */
export const HYDRATE_BATCH = 50;

export function batchIds(ids, size = HYDRATE_BATCH) {
  const batches = [];
  const n = toCount(size) || HYDRATE_BATCH;
  for (let i = 0; i < (ids?.length ?? 0); i += n) batches.push(ids.slice(i, i + n));
  return batches;
}
