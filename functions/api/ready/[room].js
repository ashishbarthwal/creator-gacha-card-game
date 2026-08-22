/* functions/api/ready/[room] — the public door to the match room.

   ── IT IS A PROXY, AND SINCE 2026-08-22 IT IS ONLY A PROXY ────────────────
   This file used to BE the backend, holding the room in Workers KV. KV gives
   each edge location its own cached view of a key with a 60-second minimum
   TTL, and a room is a read-modify-write on one shared key — so two players on
   different networks would erase each other's `enter` and sit on
   "LOBBY — 00:00" until a cache expired. Reported from real play as "phone vs
   PC hangs, phone vs phone and PC vs PC are fine", which is the signature of an
   edge split rather than a device problem. The full mechanism, and why no
   amount of client polling could fix it, is in the header of
   workers/match-room/src/index.js.

   The room is a Durable Object: one instance per room id, strongly consistent,
   so the clobber cannot happen. This file validates the room id and hands the
   request to it.

   THE KV IMPLEMENTATION WAS DELETED ON 2026-08-22, along with the `backend`
   marker that existed to tell the two apart. It was kept for five days for one
   stated reason — so that deploying this file before the binding existed
   changed nothing for players — and retired on the one condition that was
   always attached to it: a real phone-on-mobile-data vs PC-on-WiFi match played
   on the Durable Object. Ash played it. A fallback to the implementation whose
   bug motivated the rewrite is not a safety net; past that point it is a second
   way for the game to be broken, and the marker that distinguished them was a
   field shipped to every client for the benefit of one debugging session.

   `env.READY` (the `creator-gacha-ready` KV namespace) is now unread by any
   code. The binding can come off the Pages project whenever somebody is in the
   dashboard anyway; leaving it attached costs nothing and breaks nothing.

   THE OBJECT LIVES IN A SEPARATE WORKER because a Pages project cannot define
   a Durable Object class — Cloudflare's own constraint, not a preference. That
   second deployable is what CLAUDE.md's "one file in functions/, and it is the
   only one" traded away, knowingly, on Ash's call. It now hosts two classes:
   `MatchRoom` here, and `MatchQueue` behind functions/api/queue.js.

   ── WHAT THE ROOM HOLDS ──────────────────────────────────────────────────
   Per room, for ten minutes: whether the challenge was accepted, when the
   lobby opened, when the shared build phase started, the defender's collection
   SIZE, a random nonce marking which browser took the defender's seat, and —
   once each side locks — their final five. No account, no identity, no
   collection beyond the five cards someone chose to field. The room id is a
   hash both browsers derive from the challenge code (or, for a random match, a
   value the queue minted for both of them), so it is unguessable without it and
   costs no round trip to agree on. See the object for the protocol. */

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    /* Never cache a match room — a cached "not ready" is a lobby that never
       progresses, and Cloudflare will happily cache a GET at the edge. */
    'cache-control': 'no-store',
  },
});

/* A room id is a path segment from a stranger, and it is only ever a base36
   hash — either `roomFor(fingerprint, seed)` in data/presence.js or a value
   minted by the queue — so anything outside that alphabet is a mistake or a
   probe. Checked HERE, before the object is addressed, so a malformed id can
   never cause an instance to be created for it. */
function cleanRoom(raw) {
  const room = String(raw ?? '').toLowerCase();
  return /^[a-z0-9]{4,40}$/.test(room) ? room : null;
}

/* ── FINDING THE BINDING, AND WHY THIS IS NOT PARANOIA ─────────────────────
   The Durable Object binding is added by hand in the Cloudflare dashboard,
   because the Pages REST API accepts a PATCH adding `durable_object_bindings`,
   answers `success: true` and silently drops it — and does not report the field
   when reading either, so a missing binding is invisible from outside.

   That hand-typed name is where half an hour went once: it was entered as
   `"ROOM "`, one trailing space, invisible in every screen that displays it.
   The Worker deployed, the namespace registered, the binding appeared in the
   deployment record, every check passed, and `env.ROOM` stayed undefined while
   the endpoint just quietly reported that no lobby was available.

   So the lookup trims. `idFromName` is checked as well as the name, because
   what this needs is not "something called ROOM" but "something that can route
   me to a Durable Object" — a KV namespace or a plain string variable that
   happened to be named ROOM must not be mistaken for one and then crash on
   first use. Exact match is tried first so a correctly-named binding costs
   nothing.

   This is not a licence to leave the name untidy: it is a refusal to let an
   unprintable character decide whether the game has a lobby. */
function roomBinding(env) {
  if (typeof env?.ROOM?.idFromName === 'function') return env.ROOM;
  for (const [name, value] of Object.entries(env ?? {})) {
    if (name.trim() === 'ROOM' && typeof value?.idFromName === 'function') return value;
  }
  return null;
}

export async function onRequest({ request, env, params }) {
  const ROOM = roomBinding(env);

  /* No binding means no match rooms today. A 200 saying `enabled:false` rather
     than a 500 is deliberate: data/presence.js reads it as SETTLED and stops
     asking, where an error means one request failed and is worth retrying. The
     arena depends on that distinction to decide between falling back and
     showing a retry — see the note above `OFF` there. */
  if (!ROOM) return json({ enabled: false }, 200);

  const room = cleanRoom(params?.room);
  if (!room) return json({ error: 'bad room' }, 400);

  /* `idFromName(room)` maps a room id to exactly ONE object instance, globally,
     so every request for a given match lands on the same actor no matter which
     edge it arrived at. That is the whole fix: the read, the mutation and the
     write happen inside one single-threaded instance with strongly consistent
     storage, so the cross-edge clobber that put a 60-second floor under a
     10-second lobby cannot occur.

     The request is forwarded UNREAD — the body is parsed inside the object, so
     this proxy never consumes the stream it is passing on. */
  return ROOM.get(ROOM.idFromName(room)).fetch(request);
}
