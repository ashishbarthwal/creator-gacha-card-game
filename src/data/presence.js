/* data/presence — the match room client.

   Lives in data/ because it is the only module in the app that talks to a
   server of ours, which is exactly the question the folder answers: engine/
   touches nothing, data/ touches the network, ui/ touches the DOM.

   ── WHAT CROSSES THE WIRE ─────────────────────────────────────────────────
   A room id, which side you are, your collection SIZE (never your
   collection), and — once you lock in — your five cards. Nothing else: no
   names, no account, nothing that identifies a person. The room id is a hash
   both browsers derive independently from the challenge code, so joining a
   match costs no round trip and cannot be done by anyone who was not sent
   the code.

   ── REWRITTEN 2026-08-15 FOR THE SHARED BUILD PHASE ───────────────────────
   v1 had three ops (`accept`, `team`, `ready`) because v1's flow was
   asymmetric: the challenger committed before sending, so only the
   defender's team ever needed to reach the room, and "here is my team" and
   "I am ready" were deliberately separate acts for the defender alone. Ash's
   brief removes that asymmetry — both players build simultaneously once
   accepted, and either side may lock in at any point — so `team` and `ready`
   collapsed into one `lock`: locking IS committing on both sides now, and
   there is nothing left for a separate ready flag to mean.

   Two more ops joined them once the LOBBY was added, which closed the last
   asymmetry: only one side ever faces the collection-fairness gate, and while
   they read it their opponent used to be building against a running clock.
   `enter` says "I am through the lobby" (pressed, or automatic when its timer
   expires) and the build clock does not start until both sides have sent it;
   `bail` says CHICKEN OUT, so the other side learns the match is off instead
   of waiting out a build phase alone. Four ops: accept, enter, bail, lock.

   ── EVERY PATH HERE FAILS SOFT ────────────────────────────────────────────
   This sits on top of a game that worked without a server for its whole life,
   and must not be able to take it down. Nothing here throws or rejects; every
   call resolves to a shape whose `enabled: false` sends the arena back to the
   sequential flow it shipped with. Offline, blocked, namespace unbound, request
   timed out, server returning nonsense: one answer, handled at the call site by
   doing nothing special. That path is not hypothetical — it is what runs until
   the KV namespace is bound. */

/* Same origin — a Pages Function on this very site, so no CORS, no second
   domain, nothing to configure per environment. */
const BASE = '/api/ready';

/* A hung request must not hang a lobby. */
const TIMEOUT_MS = 5000;

const BLANK = {
  accepted: false, lobbyAt: null, buildStartAt: null, csB: null,
  enteredA: false, enteredB: false, bailed: null,
  lockedA: false, lockedB: false, teamA: null, teamB: null, bothAt: null,
  now: 0, gateMs: null, buildMs: null, countdownMs: null,
};

/* TWO WAYS TO HAVE NO LOBBY, AND THEY ARE NOT THE SAME ANSWER.

   `off` is settled: the server itself says presence is unavailable (no KV
   namespace bound). Nothing will change by asking again, so a caller should
   fall back to the sequential flow for good.

   `error` is one request that did not complete — timed out, aborted, offline,
   refused, a 5xx. It says NOTHING about whether a lobby exists, so a caller
   must keep trying.

   Collapsing the two into one value is what broke challenging from a phone: the
   challenger is the only player who has to leave the app to send their code,
   the browser froze the tab and killed the in-flight request, and the wait loop
   read that as "there is no lobby" and stopped forever. The acceptance then had
   nowhere to arrive. Same shape, one field of difference, and the difference is
   whether the caller gives up. */
const OFF = { enabled: false, reason: 'off', ...BLANK };
const FAILED = { enabled: false, reason: 'error', ...BLANK };

/* Callers ask this rather than reading `reason` directly — "should I stop
   trying?" is the actual question at every call site. */
export const presenceOff = state => state?.reason === 'off';

async function call(path, init) {
  /* AbortSignal.timeout is not everywhere yet, and this file must never be the
     reason a browser fails to run the game — so the controller is built by hand
     rather than reached for. */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, { ...init, signal: controller.signal, cache: 'no-store' });
    /* A 404 ON THIS PATH IS SETTLED, NOT TRANSIENT, and separating it out fixed
       a real split-brain. Our own endpoint answers 200, 400 (bad room, body, op,
       side or team) or 405 (wrong method) — it has no 404 branch at all. So a
       404 here does not mean "that room is missing", it means THE FUNCTION IS
       NOT THERE: a plain static host, or a dev server that cannot run Pages
       Functions (`npx serve` is exactly this — it answers 404 for
       /api/ready/... because no such file exists on disk).

       Treated as retryable, that produced two screens disagreeing about one
       fact: the defender awaits a single `accept`, reads `enabled:false` and
       correctly reports no live lobby, while the challenger's poll loop keeps
       retrying and sits on "Waiting for someone to accept…" forever, never
       reaching the message that would have explained why. Same server, same
       answer, two different stories.

       The cost of getting this wrong the other way is small and self-correcting:
       if a real deployment ever 404s transiently (mid-deploy propagation), the
       arena falls back to copy-paste, which still works. Sitting forever on a
       screen that cannot progress does not. */
    if (res.status === 404) return OFF;
    /* Everything else that failed is one request that did not complete. A 400
       or a 5xx means the server IS up and answering, so the room may well be
       fine a moment later — retryable, not settled. */
    if (!res.ok) return FAILED;
    const body = await res.json();
    /* A 200 saying `enabled:false` is the one genuinely settled answer: no
       namespace is bound, and asking again will not change that. */
    if (!body?.enabled) return OFF;
    return {
      enabled: true,
      accepted: Boolean(body.accepted),
      lobbyAt: Number.isFinite(body.lobbyAt) ? body.lobbyAt : null,
      buildStartAt: Number.isFinite(body.buildStartAt) ? body.buildStartAt : null,
      csB: Number.isFinite(body.csB) && body.csB >= 0 ? body.csB : null,
      enteredA: Boolean(body.enteredA),
      enteredB: Boolean(body.enteredB),
      bailed: body.bailed === 'a' || body.bailed === 'b' ? body.bailed : null,
      lockedA: Boolean(body.lockedA),
      lockedB: Boolean(body.lockedB),
      teamA: Array.isArray(body.teamA) ? body.teamA : null,
      teamB: Array.isArray(body.teamB) ? body.teamB : null,
      bothAt: Number.isFinite(body.bothAt) ? body.bothAt : null,
      now: Number.isFinite(body.now) ? body.now : 0,
      gateMs: Number.isFinite(body.gateMs) ? body.gateMs : null,
      buildMs: Number.isFinite(body.buildMs) ? body.buildMs : null,
      countdownMs: Number.isFinite(body.countdownMs) ? body.countdownMs : null,
    };
  } catch {
    /* Aborted by our own timeout, offline, DNS, connection reset, a frozen tab
       tearing down its fetches — all transient, all worth another try. */
    return FAILED;
  } finally {
    clearTimeout(timer);
  }
}

/* The room id BOTH windows derive independently: the challenger's five (when
   they sent one) and the seed are in the challenge code, so each side has
   everything needed before either of them talks to the server. Being a hash
   of the challenge makes it unguessable without the code, so it doubles as
   the only access control this endpoint needs — you cannot join a match you
   were not sent. */
export function roomFor(fingerprint, seed) {
  return `${String(fingerprint ?? '').replace(/[^a-z0-9]/gi, '')}${(seed >>> 0).toString(36)}`
    .toLowerCase().slice(0, 40);
}

const post = (room, body) => call(`${BASE}/${encodeURIComponent(room)}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

/* The defender, the moment they paste a challenge — before they have built
   anything. This is what turns the challenger's screen green AND what tells
   the challenger the defender's collection size, since the defender has
   nothing else to send yet. */
export const acceptChallenge = (room, collectionSize) => post(room, { op: 'accept', cs: collectionSize });

/* Either side, locking in their final five. This is the whole of committing
   now — there is no longer a separate "here is my team" op that happens
   before readiness, because both sides build blind and simultaneously, so
   there is nothing to show early. `team` is an array of plain channel
   objects (see functions/api/ready/[room].js for the wire shape). */
export const lockTeam = (room, side, team) => post(room, { op: 'lock', side, team });

/* Through the lobby and ready to build — pressed, or fired automatically when
   the lobby timer expires. The build clock does not start until BOTH sides
   have sent this, which is what stops one player building while the other is
   still deciding. */
export const enterBuild = (room, side) => post(room, { op: 'enter', side });

/* CHICKEN OUT. Sent so the other side learns the match is off instead of
   waiting out a build phase for an opponent who already left. */
export const bailOut = (room, side) => post(room, { op: 'bail', side });

export const checkRoom = room => call(`${BASE}/${encodeURIComponent(room)}`, { method: 'GET' });

/* "Can a live match happen at all right now?" — asked BEFORE any room exists,
   which is what forces the shape of this. The challenge sub-choice screen has
   to know the answer before a seed is drawn, because one of the two options it
   offers (send a bare challenge, build together afterwards) depends entirely on
   a live room being reachable: with no server there is no channel through which
   two people could ever agree on a team, and the player would be choosing a
   dead end.

   A FIXED SENTINEL ROOM, NOT THE REAL ONE, AND NOT ONLY BECAUSE THERE ISN'T ONE
   YET. Reading a room that does not exist is not free here: KV caches MISSES for
   up to 60s and `cacheTtl` cannot go lower (see functions/api/ready/[room].js),
   so probing a real room id before anybody has written it can keep that room
   reading empty for a minute afterwards. A constant key that no match ever uses
   cannot poison a real lobby, and answers the only question being asked — is
   the endpoint there, and is KV bound — just as well. It stays inside the
   server's `[a-z0-9]{4,40}` room-id alphabet so it is a well-formed request
   rather than a 400. */
export const presenceAvailable = () => checkRoom('presenceprobe0');
