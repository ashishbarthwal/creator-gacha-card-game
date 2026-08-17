/* functions/api/ready/[room] — the public door to the match room.

   ── IT IS A PROXY NOW (2026-08-17) ────────────────────────────────────────
   This file used to BE the backend, holding the room in Workers KV. It no
   longer does. KV gives each edge location its own cached view of a key with a
   60-second minimum TTL, and a room is a read-modify-write on one shared key —
   so two players on different networks would erase each other's `enter` and
   sit on "LOBBY — 00:00" until a cache expired. Reported from real play as
   "phone vs PC hangs, phone vs phone and PC vs PC are fine", which is the
   signature of an edge split rather than a device problem. The full mechanism,
   and why no amount of client polling could fix it, is in the header of
   workers/match-room/src/index.js.

   The room is now a Durable Object: one instance per room id, strongly
   consistent, so the clobber cannot happen. This file validates the room id
   and hands the request to it.

   THE OBJECT LIVES IN A SEPARATE WORKER because a Pages project cannot define
   a Durable Object class — Cloudflare's own constraint, not a preference. That
   second deployable is what CLAUDE.md's "one file in functions/, and it is the
   only one" traded away, knowingly, on Ash's call.

   Everything below the DO branch in `onRequest` is the old KV implementation,
   kept only so this file can be deployed before the binding exists. See the
   note there for when to delete it. The comments in the rest of this file
   describe THAT path and are left intact for as long as it is.

   ── the original header follows ───────────────────────────────────────────
   functions/api/ready/[room] — the match room, and the whole of the backend.

   ── WHAT IT HOLDS ────────────────────────────────────────────────────────
   Per room, for ten minutes: whether the challenge was accepted, when the
   shared build phase started (server-stamped, so both clocks agree on the
   countdown), the defender's collection size (so the challenger can run the
   fairness check without a third code exchange), a random nonce marking which
   browser took the defender's seat (see `clientB` below), and — once each side
   locks in — their final five and a locked flag. Nothing else, and nothing
   about a person.

   ── WHY THIS SHAPE, REWRITTEN 2026-08-15 ──────────────────────────────────
   v1 held `accepted` + two `ready` flags + one `code` (the defender's reply),
   because v1's flow was asymmetric on purpose: the challenger committed
   before sending, so only the defender's team ever needed to travel through
   the room. Ash's 2026-08-15 brief (items 8-14) removes that asymmetry —
   both players now land in the SAME team-building screen at the SAME time
   once accepted, and *either* side may have sent a bare, team-less challenge
   (item 9). That means the room has to be able to carry BOTH teams, not just
   one, and readiness stops being "the defender uploads a reply" and becomes
   "each side locks independently" — hence `lock` replacing `team`+`ready`.

   Teams travel as plain channel objects here, not the compact packed-array
   codec `engine/challenge.js` uses for copy-paste strings — this is a fetch
   body, not something a human re-types, so there is no reason to pay the
   packing complexity twice. Same channel shape, same fields, just JSON.

   ── WHY IT CARRIES A COLLECTION SIZE ──────────────────────────────────────
   The fairness check (items 15-27) needs each side to know the OTHER side's
   collection SIZE, never their collection. The challenger's size already
   travels in the challenge code itself (`engine/challenge.js`'s
   `collectionSize` field) — that direction needs no server help. The
   defender's size has nowhere else to go, since the defender has not sent
   anything yet at the moment the challenger needs it, so `accept` carries it.
   Never a card, never an id list — one integer, same discipline as the code.

   ── IT MUST STAY OPTIONAL ────────────────────────────────────────────────
   The game shipped with no server and still has to work without one. Missing
   binding, failed request, offline: the answer is `enabled: false` and the
   arena falls back to the sequential copy-paste flow it has always had. That
   fallback is not a degraded mode bolted on, it is the original path kept
   whole — and it is the ONLY path for a bare (team-less) challenge that
   reaches an unavailable room, since two people passing a string by hand have
   no live channel to build simultaneously over.

   The KV namespace was bound on 2026-08-08 and the lobby is live. One measured
   characteristic worth knowing before debugging a room that looks dead: KV
   caches MISSES, and `cacheTtl` cannot go below 60s, so a room polled before
   it exists can keep reading empty at that edge for up to a minute after it is
   written. Writes themselves are reliable — 30 polls over 90s, no flapping. */

const TTL_SECONDS = 600;
const COUNTDOWN_MS = 3000;      // the short "both locked, starting…" beat
const BUILD_MS = 30000;         // the shared team-building window (brief item 12)

/* THE LOBBY, ADDED 2026-08-15 TO CLOSE THE LAST ASYMMETRY. Accepting a
   challenge used to drop both sides straight into the build phase — but only
   ONE of them might face the collection-fairness gate, and while they read it
   and chose, their opponent was already building against a running clock. The
   side with a decision to make was the side punished for making it.

   So acceptance now opens a LOBBY instead: a fixed window in which the larger
   side chooses CONTINUE or CHICKEN OUT, the other side is told a decision is
   being made, and NEITHER is building. The build clock does not start until
   both sides have entered — which is why `buildStartAt` is no longer stamped
   here on accept, and why `enter` exists to stamp it. */
const GATE_MS = 10000;

/* Five real channel objects, JSON rather than packed, so this is a generous
   ceiling rather than a tight one — low enough that this cannot be used as
   free storage for something else, high enough to never reject a real team. */
const MAX_TEAM_JSON = 20000;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    /* Never cache a match room — a cached "not ready" is a lobby that never
       progresses, and Cloudflare will happily cache a GET at the edge. */
    'cache-control': 'no-store',
  },
});

/* A room id is a path segment from a stranger, and it is only ever our own
   base36 hash — so anything outside that alphabet is a mistake or a probe. */
function cleanRoom(raw) {
  const room = String(raw ?? '').toLowerCase();
  return /^[a-z0-9]{4,40}$/.test(room) ? room : null;
}

const key = room => `match:${room}`;

const EMPTY = {
  accepted: false, lobbyAt: null, buildStartAt: null, csB: null,
  enteredA: false, enteredB: false, bailed: null,
  lockedA: false, lockedB: false, teamA: null, teamB: null, bothAt: null,
  clientB: null,
};

/* WHO HOLDS THE DEFENDER'S SEAT, and the one field here that is never sent
   back out. A random per-match nonce the accepting browser makes up on the
   spot: it identifies a SEAT for ten minutes, not a person, has nothing behind
   it to look up, and is deliberately not in `view` so the other player never
   receives it either.

   It exists because a challenge code is a STRING, and a string can be pasted
   twice. Seat A belongs to whoever generated the seed, so it cannot be
   contested — but anybody holding the code can accept, and two acceptances
   used to be indistinguishable from one. Both took seat B, `enteredA` was
   therefore never set, `buildStartAt` is stamped only when both sides are
   through, and the two of them sat on "LOBBY — 00:00 / Waiting for them…"
   until the room expired. Worse, each side could see its OWN `enteredB` was
   true, so the client's re-assert repair had nothing to repair and stayed
   quiet. First accept wins; a second one is told the seat is taken. */
const CLAIM = /^[a-z0-9]{4,64}$/;
const cleanClaim = raw => (typeof raw === 'string' && CLAIM.test(raw) ? raw : null);

async function read(env, room) {
  const raw = await env.READY.get(key(room));
  if (!raw) return { ...EMPTY };
  try {
    const p = JSON.parse(raw);
    return {
      accepted: Boolean(p.accepted),
      lobbyAt: Number.isFinite(p.lobbyAt) ? p.lobbyAt : null,
      buildStartAt: Number.isFinite(p.buildStartAt) ? p.buildStartAt : null,
      csB: Number.isFinite(p.csB) && p.csB >= 0 ? p.csB : null,
      enteredA: Boolean(p.enteredA),
      enteredB: Boolean(p.enteredB),
      bailed: p.bailed === 'a' || p.bailed === 'b' ? p.bailed : null,
      lockedA: Boolean(p.lockedA),
      lockedB: Boolean(p.lockedB),
      teamA: Array.isArray(p.teamA) ? p.teamA : null,
      teamB: Array.isArray(p.teamB) ? p.teamB : null,
      bothAt: Number.isFinite(p.bothAt) ? p.bothAt : null,
      clientB: cleanClaim(p.clientB),
    };
  } catch {
    return { ...EMPTY };
  }
}

const save = (env, room, state) =>
  env.READY.put(key(room), JSON.stringify(state), { expirationTtl: TTL_SECONDS });

const view = (state, extra = {}) => ({
  enabled: true,
  /* The other half of the marker described in workers/match-room/src/index.js:
     while both backends are wired they are otherwise indistinguishable from
     outside, so a DO binding that failed to attach would look identical to one
     that worked. Deleted with the rest of this path. */
  backend: 'kv',
  now: Date.now(),
  gateMs: GATE_MS,
  buildMs: BUILD_MS,
  countdownMs: COUNTDOWN_MS,
  accepted: state.accepted,
  lobbyAt: state.lobbyAt,
  buildStartAt: state.buildStartAt,
  csB: state.csB,
  enteredA: state.enteredA,
  enteredB: state.enteredB,
  bailed: state.bailed,
  lockedA: state.lockedA,
  lockedB: state.lockedB,
  teamA: state.teamA,
  teamB: state.teamB,
  bothAt: state.bothAt,
  ...extra,
});

/* A team as it arrives over the wire: an array of TEAM_SIZE plain channel
   objects, each with a non-empty id, no id repeated. Deliberately loose about
   everything else — this endpoint has no idea what a valid channel looks
   like and does not need to; `engine/battle-stats.js` on both ends will
   simply produce whatever it produces from whatever arrives, exactly as it
   already tolerates any channel shape from the seam. What it must refuse is
   the shape of an ATTACK: something big enough to matter as storage, or
   malformed enough to jam a room for the two people trying to use it. */
/* Five, always — a locked team is a FINAL team (the shared build phase
   auto-fills any empty slot before it ever calls this), so anything other
   than exactly five is damage, not a partial draft to tolerate. Hardcoded
   rather than importing engine/battle.js's TEAM_SIZE: this file is the one
   deliberately import-free module in the project (see CLAUDE.md's
   Architecture section), so its handful of constants stay self-contained,
   the same way TTL_SECONDS and MAX_TEAM_JSON above are. */
const TEAM_SIZE = 5;

function validTeam(team) {
  if (!Array.isArray(team) || team.length !== TEAM_SIZE) return false;
  if (JSON.stringify(team).length > MAX_TEAM_JSON) return false;
  const ids = team.map(ch => String(ch?.id ?? ''));
  if (ids.some(id => !id)) return false;
  return new Set(ids).size === ids.length;
}

export async function onRequest(context) {
  const { request, env, params } = context;

  /* No binding of EITHER kind means no match rooms today. A 200 saying
     `enabled:false` rather than a 500 is deliberate: the client reads it as
     settled and uses the fallback, needing no error path. */
  if (!env?.ROOM && !env?.READY) return json({ enabled: false }, 200);

  const room = cleanRoom(params?.room);
  if (!room) return json({ error: 'bad room' }, 400);

  /* ── THE DURABLE OBJECT PATH, PREFERRED WHENEVER IT IS BOUND ──────────────
     `idFromName(room)` maps a room id to exactly ONE object instance,
     globally, so every request for a given match lands on the same actor no
     matter which edge it arrived at. That is the whole fix: the read, the
     mutation and the write happen inside one single-threaded instance with
     strongly consistent storage, so the cross-edge clobber that put a
     60-second floor under a 10-second lobby cannot occur. See
     workers/match-room/src/index.js for the mechanism and the measurement.

     The request is forwarded UNREAD — the body is parsed inside the object, so
     this proxy never consumes the stream it is passing on. */
  if (env.ROOM) {
    return env.ROOM.get(env.ROOM.idFromName(room)).fetch(request);
  }

  /* ── EVERYTHING BELOW IS THE KV PATH, AND IT IS TRANSITIONAL ──────────────
     Kept so that deploying this file BEFORE the Durable Object binding exists
     changes nothing for players: with only `READY` bound the endpoint behaves
     exactly as it always has, and it upgrades itself the moment `ROOM` is
     attached — no flag day, no window where a live 1v1 is impossible.

     Delete it once the DO binding is confirmed in production and a real
     cross-network match has been played on it. Until then it is the reason
     this deploy is safe rather than a cutover. It carries the bug described in
     the DO's header; that is why it is being replaced, not why it is being
     kept. */

  if (request.method === 'GET') return json(view(await read(env, room)));
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body = null;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad body' }, 400);
  }

  /* READ-MODIFY-WRITE, AND IT CAN RACE. KV offers no compare-and-set, so two
     writes landing together can each omit the other's change. It self-heals —
     both sides keep polling and the next write reconciles — and the worst case
     is one extra poll interval. A lock needs a Durable Object, which is a paid
     plan and a lot of machinery to save a second in a lobby. Known trade. */
  const state = await read(env, room);

  if (body?.op === 'accept') {
    /* ONE DEFENDER PER CHALLENGE. Answered WITHOUT writing, so a second person
       holding the same code cannot disturb the match already running in this
       room — they get the state as it stands plus `seatTaken`, and their arena
       says so instead of dropping them into a lobby that can never start.

       A claimless accept is the client that shipped before this field existed
       and is let through unchanged: it is the only defender in that flow, and
       refusing it would break a live match to enforce a rule it cannot know
       about. Same reason the check is claim-vs-claim rather than "has anyone
       accepted" — one browser re-sending its own accept (a double-click, a
       retry after a dropped request) carries the same nonce and is not a
       second person. */
    const claim = cleanClaim(body.claim);
    if (claim && state.clientB && state.clientB !== claim) {
      return json(view(state, { seatTaken: true }));
    }
    if (claim && !state.clientB) state.clientB = claim;
    state.accepted = true;
    /* Stamped once, by the server, the moment both sides are confirmed
       present — the challenger is already watching this room (that is what
       "waiting for someone to accept" means), so the defender's accept IS
       that confirmation. This opens the LOBBY, not the build: both clients
       count the 10-second decision window down against this one server
       timestamp, so two devices whose clocks disagree still land on the same
       window. */
    if (!state.lobbyAt) state.lobbyAt = Date.now();
    const cs = Number(body.cs);
    if (Number.isFinite(cs) && cs >= 0) state.csB = Math.floor(cs);
  } else if (body?.op === 'enter') {
    /* "I am through the lobby and ready to build" — pressed, or fired
       automatically when the lobby timer runs out. Deliberately separate from
       `accept`: accepting says someone is THERE, entering says they have
       resolved whatever the lobby asked of them, and only the larger-collection
       side is ever asked anything. */
    const side = body.side === 'a' || body.side === 'b' ? body.side : null;
    if (!side) return json({ error: 'bad side' }, 400);
    state.accepted = true;
    if (!state.lobbyAt) state.lobbyAt = Date.now();
    state[side === 'a' ? 'enteredA' : 'enteredB'] = true;
  } else if (body?.op === 'bail') {
    /* CHICKEN OUT, and it has to reach the room. Before the lobby existed this
       was a purely local retreat, which left the other player waiting on
       someone who had already gone — tolerable when nobody was watching for it,
       indefensible now that the whole point of the lobby is one side waiting on
       the other's decision. */
    const side = body.side === 'a' || body.side === 'b' ? body.side : null;
    if (!side) return json({ error: 'bad side' }, 400);
    if (!state.bailed) state.bailed = side;
  } else if (body?.op === 'lock') {
    const side = body.side === 'a' || body.side === 'b' ? body.side : null;
    if (!side) return json({ error: 'bad side' }, 400);
    if (!validTeam(body.team)) return json({ error: 'bad team' }, 400);
    /* Locking implies having accepted, entered and started building — this
       heals a lost `accept` or `enter` the same way v1's `team` op healed a
       lost one, for the same reason: a phone switching networks between
       reading a code and pasting it is normal, not exceptional. */
    state.accepted = true;
    if (!state.lobbyAt) state.lobbyAt = Date.now();
    state[side === 'a' ? 'enteredA' : 'enteredB'] = true;
    if (side === 'a') { state.teamA = body.team; state.lockedA = true; }
    else { state.teamB = body.team; state.lockedB = true; }
  } else {
    return json({ error: 'bad op' }, 400);
  }

  /* THE BUILD CLOCK STARTS WHEN BOTH SIDES ARE THROUGH THE LOBBY, not when the
     challenge was accepted. That is the whole fix: whichever side had a
     decision to make, neither is building while it is being made, and the 30
     seconds begin for the two of them at one instant the server picks. */
  if (state.enteredA && state.enteredB && !state.buildStartAt) state.buildStartAt = Date.now();

  /* Stamped once, by the server, when the SECOND side locks. Both clients
     count down a short shared "starting…" beat from this against the
     server's own clock, same trick as `buildStartAt` above. Brief item 13:
     both locked means start immediately, never wait out the remaining build
     timer — this is what lets a client tell the two apart. */
  if (state.lockedA && state.lockedB && !state.bothAt) state.bothAt = Date.now();

  await save(env, room, state);
  return json(view(state));
}
