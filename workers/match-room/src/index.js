/* workers/match-room — the match room as a Durable Object.

   ── WHY THIS EXISTS, AND WHY IT IS A SECOND DEPLOYABLE ────────────────────
   The room used to live entirely in functions/api/ready/[room].js on Workers
   KV. KV gives every Cloudflare edge location its own cached view of a key
   with a MINIMUM TTL of 60 seconds that cannot be lowered, and the room is a
   read-modify-write on one shared key. Cross-network that is not a rare race,
   it is the ordinary case:

     1. The challenger presses CONTINUE. Their edge writes
        { enteredA: true, enteredB: false }.
     2. The defender auto-enters at 00:00 — by design, both sides hit zero
        together. Their edge still holds the pre-step-1 room, so it writes
        { enteredA: false, enteredB: true }, ERASING the challenger's entry.
        Last write wins.
     3. Both sides now poll their own edge, each sees its own flag set, and
        the client's `reassertEnter` repair is gated on YOUR OWN flag being
        missing — so neither side reasserts. Both sit on "Waiting for them…".
     4. `buildStartAt` is only ever stamped by a request whose read sees BOTH
        flags true at once, and no edge can see both until its cache expires.

   That put a 60-SECOND FLOOR under a 10-second lobby, and no amount of client
   polling could lift it, because the staleness is on the read path. Measured
   symptom, reported from real play: phone-vs-PC hangs on "LOBBY — 00:00"
   while phone-vs-phone and PC-vs-PC — both sides behind ONE edge — are fine.

   A Durable Object is the fix rather than a mitigation because it removes the
   mechanism instead of waiting it out. There is exactly ONE instance per room
   id, every request for that room is routed to it, and its storage is
   strongly consistent — so a read-modify-write is atomic by construction and
   step 2 above cannot happen. No cache, no clobber, no floor.

   IT IS A SEPARATE WORKER BECAUSE IT HAS TO BE. A Pages project cannot define
   a Durable Object class; the class must be exported from a Worker and bound
   into Pages by `script_name`. That is why this directory exists at all, and
   it is the whole of what CLAUDE.md's "one file in functions/, and it is the
   only one" gave up. The Pages Function is still the only thing the browser
   talks to — see functions/api/ready/[room].js, which is now a thin proxy.

   ── WHAT IT HOLDS ────────────────────────────────────────────────────────
   Byte for byte what the KV version held, and nothing more: whether the
   challenge was accepted, when the lobby opened, when the shared build phase
   started, the defender's collection SIZE, a random nonce marking which
   browser took the defender's seat, and — once each side locks — their final
   five. No account, no identity, no collection beyond the five cards someone
   chose to field. The room id is still a hash both browsers derive from the
   challenge code, so it is unguessable without the code and costs no round
   trip to agree on.

   ── STORAGE ──────────────────────────────────────────────────────────────
   SQLite-backed (the only backend new namespaces may use, and the only one on
   the Workers Free plan), but through the plain key-value storage API rather
   than SQL: this is one small object with a ten-minute life, and a table would
   be ceremony. An alarm deletes it at expiry so a finished match leaves
   nothing behind — the same ten minutes KV's expirationTtl used to give, made
   explicit because a DO has no TTL of its own. */

const TTL_SECONDS = 600;
const COUNTDOWN_MS = 3000;      // the short "both locked, starting…" beat
const BUILD_MS = 30000;         // the shared team-building window (brief item 12)

/* THE LOBBY. Acceptance opens a fixed decision window in which the larger side
   chooses CONTINUE or CHICKEN OUT, the other side is told a decision is being
   made, and NEITHER is building. The build clock does not start until both
   sides have entered — which is why `buildStartAt` is not stamped on accept,
   and why `enter` exists to stamp it. */
const GATE_MS = 10000;

/* Five real channel objects, JSON rather than packed, so this is a generous
   ceiling rather than a tight one — low enough that this cannot be used as
   free storage for something else, high enough to never reject a real team. */
const MAX_TEAM_JSON = 20000;

/* Five, always — a locked team is a FINAL team (the shared build phase
   auto-fills any empty slot before it ever calls this), so anything other than
   exactly five is damage, not a partial draft to tolerate. */
const TEAM_SIZE = 5;

const STATE_KEY = 'room';

const EMPTY = {
  accepted: false, lobbyAt: null, buildStartAt: null, csB: null,
  enteredA: false, enteredB: false, bailed: null,
  lockedA: false, lockedB: false, teamA: null, teamB: null, bothAt: null,
  clientB: null, expiresAt: null,
};

/* WHO HOLDS THE DEFENDER'S SEAT, and the one field here never sent back out.
   A random per-match nonce the accepting browser makes up on the spot: it
   identifies a SEAT for ten minutes, not a person, has nothing behind it to
   look up, and is deliberately absent from `view` so the other player never
   receives it either.

   It exists because a challenge code is a STRING, and a string can be pasted
   twice. Seat A belongs to whoever generated the seed, so it cannot be
   contested — but anybody holding the code can accept, and two acceptances
   were once indistinguishable from one. First accept wins; a second is told
   the seat is taken, without a write. */
const CLAIM = /^[a-z0-9]{4,64}$/;
const cleanClaim = raw => (typeof raw === 'string' && CLAIM.test(raw) ? raw : null);

function validTeam(team) {
  if (!Array.isArray(team) || team.length !== TEAM_SIZE) return false;
  if (JSON.stringify(team).length > MAX_TEAM_JSON) return false;
  const ids = team.map(ch => String(ch?.id ?? ''));
  if (ids.some(id => !id)) return false;
  return new Set(ids).size === ids.length;
}

const view = (state, extra = {}) => ({
  enabled: true,
  /* WHICH BACKEND ANSWERED, and it exists because the migration made that
     question unanswerable from outside. While both paths are wired, a request
     served by the OLD KV code and a request served by this object produce
     byte-identical JSON — so a binding that silently failed to attach would
     look exactly like a successful migration, which is the same trap
     test/room.test.js pins the routing rule against.

     TRANSITIONAL, and it is deleted together with the KV path in
     functions/api/ready/[room].js — once there is only one backend there is
     nothing to distinguish. The client never reads it: `data/presence.js`
     rebuilds its own object from named fields, so an extra one costs nothing
     and changes no behaviour. */
  backend: 'do',
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

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export class MatchRoom {
  constructor(ctx) {
    this.ctx = ctx;
  }

  /* THE WHOLE POINT OF THE REWRITE IS THAT THIS IS ATOMIC. A Durable Object
     processes one request at a time per instance, and its storage is strongly
     consistent — so the read, the mutation and the write below cannot
     interleave with another side's, however far apart the two players are.
     The KV version's comment had to say "READ-MODIFY-WRITE, AND IT CAN RACE";
     this one cannot. */
  async read() {
    const stored = await this.ctx.storage.get(STATE_KEY);
    if (!stored) return { ...EMPTY };
    /* A room past its ten minutes reads as absent even if the alarm has not
       fired yet, so expiry is decided by the clock rather than by whether a
       cleanup happened to run. Same answer KV's expirationTtl gave. */
    if (Number.isFinite(stored.expiresAt) && Date.now() > stored.expiresAt) return { ...EMPTY };
    return { ...EMPTY, ...stored };
  }

  async save(state) {
    if (!state.expiresAt) state.expiresAt = Date.now() + TTL_SECONDS * 1000;
    await this.ctx.storage.put(STATE_KEY, state);
    /* Set once, not on every write: pushing the alarm forward on each op would
       keep a busy room alive past the ten minutes it is allowed. */
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(state.expiresAt);
  }

  /* Ten minutes after the room was first written, it goes away completely —
     the DO equivalent of KV's expirationTtl, made explicit because a Durable
     Object has no TTL of its own and would otherwise hold every match ever
     played. */
  async alarm() {
    await this.ctx.storage.deleteAll();
  }

  async fetch(request) {
    if (request.method === 'GET') return json(view(await this.read()));
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    let body = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad body' }, 400);
    }

    const state = await this.read();

    if (body?.op === 'accept') {
      /* ONE DEFENDER PER CHALLENGE. Answered WITHOUT writing, so a second
         person holding the same code cannot disturb the match already running
         in this room — they get the state as it stands plus `seatTaken`.

         A claimless accept is a client that shipped before this field existed
         and is let through unchanged. The check is claim-vs-claim rather than
         "has anyone accepted" so one browser re-sending its own accept (a
         double-click, a retry after a dropped request) is not read as a second
         person. */
      const claim = cleanClaim(body.claim);
      if (claim && state.clientB && state.clientB !== claim) {
        return json(view(state, { seatTaken: true }));
      }
      if (claim && !state.clientB) state.clientB = claim;
      state.accepted = true;
      /* Stamped once, by the server, the moment both sides are confirmed
         present — the challenger is already watching this room, so the
         defender's accept IS that confirmation. This opens the LOBBY, not the
         build: both clients count the decision window down against this one
         timestamp, so two devices whose clocks disagree land on one window. */
      if (!state.lobbyAt) state.lobbyAt = Date.now();
      const cs = Number(body.cs);
      if (Number.isFinite(cs) && cs >= 0) state.csB = Math.floor(cs);
    } else if (body?.op === 'enter') {
      /* "I am through the lobby and ready to build" — pressed, or fired
         automatically when the lobby timer runs out. Deliberately separate
         from `accept`: accepting says someone is THERE, entering says they
         have resolved whatever the lobby asked of them, and only the
         larger-collection side is ever asked anything. */
      const side = body.side === 'a' || body.side === 'b' ? body.side : null;
      if (!side) return json({ error: 'bad side' }, 400);
      state.accepted = true;
      if (!state.lobbyAt) state.lobbyAt = Date.now();
      state[side === 'a' ? 'enteredA' : 'enteredB'] = true;
    } else if (body?.op === 'bail') {
      /* CHICKEN OUT, and it has to reach the room. Before the lobby existed
         this was a purely local retreat, which left the other player waiting
         on someone who had already gone. */
      const side = body.side === 'a' || body.side === 'b' ? body.side : null;
      if (!side) return json({ error: 'bad side' }, 400);
      if (!state.bailed) state.bailed = side;
    } else if (body?.op === 'lock') {
      const side = body.side === 'a' || body.side === 'b' ? body.side : null;
      if (!side) return json({ error: 'bad side' }, 400);
      if (!validTeam(body.team)) return json({ error: 'bad team' }, 400);
      /* Locking implies having accepted, entered and started building — this
         heals a lost `accept` or `enter`, since a phone switching networks
         between reading a code and pasting it is normal, not exceptional.
         Kept even though the DO makes a LOST write impossible: a request that
         never left the handset is still lost, and that is what this repairs. */
      state.accepted = true;
      if (!state.lobbyAt) state.lobbyAt = Date.now();
      state[side === 'a' ? 'enteredA' : 'enteredB'] = true;
      if (side === 'a') { state.teamA = body.team; state.lockedA = true; }
      else { state.teamB = body.team; state.lockedB = true; }
    } else {
      return json({ error: 'bad op' }, 400);
    }

    /* THE BUILD CLOCK STARTS WHEN BOTH SIDES ARE THROUGH THE LOBBY, not when
       the challenge was accepted. Whichever side had a decision to make,
       neither is building while it is being made, and the 30 seconds begin for
       the two of them at one instant the server picks.

       This is the line the KV version could not make fire cross-network: it
       needs one read that sees BOTH flags, which is exactly what a shared,
       edge-cached key could not provide and a Durable Object provides for
       free. */
    if (state.enteredA && state.enteredB && !state.buildStartAt) state.buildStartAt = Date.now();

    /* Stamped once, when the SECOND side locks. Both clients count down a
       short shared "starting…" beat from this against the server's own clock,
       same trick as `buildStartAt` above: both locked means start immediately,
       never wait out the remaining build timer. */
    if (state.lockedA && state.lockedB && !state.bothAt) state.bothAt = Date.now();

    await this.save(state);
    return json(view(state));
  }
}

/* This Worker exists to EXPORT THE CLASS ABOVE and nothing else — the Pages
   Function is the only public entry point, and it reaches the object through
   its binding rather than over HTTP. A Worker still needs a default export, so
   this one refuses everything: hitting the Worker's own URL directly is either
   a mistake or a probe, and there is no route here worth offering it. */
export default {
  fetch() {
    return json({ error: 'not a public endpoint' }, 404);
  },
};

/* THE RANDOM-OPPONENT QUEUE RIDES IN THIS SAME WORKER, and that is the point
   rather than a shortcut. The second deployable this project gave up (see the
   header above) was the price of a Pages project being unable to declare a
   Durable Object class AT ALL — it was never a price per class. A second class
   in the Worker that already exists costs one binding and one migration tag,
   and adds no deploy step, no route and nothing new to remember.

   Re-exported here rather than pointed at directly because `main` in
   wrangler.jsonc names ONE entry file, and every class the Worker declares has
   to be reachable from it. */
export { MatchQueue } from './queue.js';
