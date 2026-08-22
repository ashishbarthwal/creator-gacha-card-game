/* functions/api/queue — the public door to the random-opponent queue.

   Same shape and the same job as functions/api/ready/[room].js: a Pages
   Function that validates nothing more than it has to and hands the request to
   a Durable Object. It exists because a Pages project cannot declare a Durable
   Object class, so the class lives in workers/match-room/ and this is the only
   thing a browser talks to. Read src/queue.js there for the protocol and for
   what the queue may and may not hold.

   ── WHY THERE IS NO KV FALLBACK HERE ─────────────────────────────────────
   The room has one, still, because it predates the Durable Object and is kept
   until a real cross-network match has been played on the new backend. This
   endpoint has no such history and must never grow one, because a queue is the
   one thing on this project that CANNOT be built on a cached store: pairing is
   a read-modify-write on a single shared key, and two players joining at once
   against two edge caches would each read an empty queue, each park themselves,
   and never learn about each other. That is not a rare race — with two players
   in the world it is the ordinary case. If the binding is missing, this says so
   and the arena hides the button.

   ── THE ONE ROUTE, AND WHY IT IS A FIXED NAME ────────────────────────────
   `idFromName('lobby-v1')` — every request in the world reaches the same
   instance, on purpose. A queue's whole job is to be the one place two people
   can find each other; spreading it would be spreading the players. The version
   suffix is there so a protocol change can move to a fresh instance rather than
   migrate one, since the queue holds nothing worth keeping. */

const QUEUE_NAME = 'lobby-v1';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    /* Never cache a queue answer. A cached "waiting" is a player who has been
       paired and does not know it — which strands the OTHER player too, since
       they are already sitting in a room. */
    'cache-control': 'no-store',
  },
});

/* The same tolerant lookup functions/api/ready/[room].js uses, and it is here
   for the same measured reason: a binding typed into the dashboard as `"ROOM "`
   — one trailing space, invisible in every screen that displays it — deployed
   clean, reported healthy and left `env.ROOM` undefined. The name is checked by
   trimmed comparison, and `idFromName` is checked as well as the name, because
   what this needs is not "something called QUEUE" but "something that can route
   to a Durable Object". */
function queueBinding(env) {
  if (typeof env?.QUEUE?.idFromName === 'function') return env.QUEUE;
  for (const [name, value] of Object.entries(env ?? {})) {
    if (name.trim() === 'QUEUE' && typeof value?.idFromName === 'function') return value;
  }
  return null;
}

export async function onRequest({ request, env }) {
  const QUEUE = queueBinding(env);

  /* `enabled: false` rather than an error, matching the room endpoint. A
     missing binding is a deployment that has not been finished, not a fault the
     player caused — and data/presence.js draws a hard line between "off" (stop
     asking) and "failed" (try again), which the arena depends on to decide
     whether to hide the button or show a retry. */
  if (!QUEUE) return json({ enabled: false, reason: 'off' }, 200);

  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  return QUEUE.get(QUEUE.idFromName(QUEUE_NAME)).fetch(request);
}
