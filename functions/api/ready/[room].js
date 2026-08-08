/* functions/api/ready/[room] — the match room, and the whole of the backend.

   ── WHAT IT HOLDS ────────────────────────────────────────────────────────
   Per room, for ten minutes: whether the challenge was accepted, whether each
   side has readied, when the second one did, and the defender's reply code.
   Nothing else, and nothing about a person.

   ── WHY IT NOW CARRIES A CODE, WHEN IT DELIBERATELY DID NOT ──────────────
   The first cut of this endpoint held two booleans and refused to touch card
   data, on the reasoning that a server never sent a statistic can never store
   one. Ash's flow needs more than that: the challenger presses Ready and the
   match begins, with no second copy-paste — and a fight cannot be resolved
   without both teams, so the defender's five have to reach the challenger
   somehow.

   The earlier worry that this breaks YouTube's 30-day cap on stored statistics
   was simply wrong, and is corrected here rather than quietly dropped: the cap
   is a MAXIMUM AGE, and this holds a code for ten minutes. The real cost was
   always a documentation one — the privacy policy had to stop saying the
   endpoint never receives a card — and that has been paid honestly rather than
   left stale.

   What has NOT changed is everything else about the shape. The room id is still
   a hash both browsers derive for themselves from the challenge code, so
   establishing a match still costs no round trip and the id still identifies a
   match without describing one. There are still no accounts, no cookies, no
   logging of our own, and nothing here outlives its TTL.

   ── IT MUST STAY OPTIONAL ────────────────────────────────────────────────
   The game shipped with no server and still has to work without one. Missing
   binding, failed request, offline: the answer is `enabled: false` and the
   arena falls back to the copy-paste flow it has always had. That fallback is
   not a degraded mode bolted on, it is the original path kept whole — and right
   now it is the ONLY path, because the KV namespace is not bound yet. */

const TTL_SECONDS = 600;
const COUNTDOWN_MS = 3000;

/* A reply code for five cards runs ~1,800 characters. The ceiling is generous
   enough never to reject a real one and low enough that this cannot be used as
   free storage for something else. */
const MAX_CODE = 8000;

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

const EMPTY = { accepted: false, code: '', a: false, b: false, bothAt: null };

async function read(env, room) {
  const raw = await env.READY.get(key(room));
  if (!raw) return { ...EMPTY };
  try {
    const p = JSON.parse(raw);
    return {
      accepted: Boolean(p.accepted),
      code: typeof p.code === 'string' ? p.code : '',
      a: Boolean(p.a),
      b: Boolean(p.b),
      bothAt: Number.isFinite(p.bothAt) ? p.bothAt : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

const save = (env, room, state) =>
  env.READY.put(key(room), JSON.stringify(state), { expirationTtl: TTL_SECONDS });

/* The client never needs `code` echoed back to the side that uploaded it, but
   sending it to both is simpler than tracking who asked and costs one field. */
const view = (state, extra = {}) => ({
  enabled: true,
  now: Date.now(),
  countdownMs: COUNTDOWN_MS,
  accepted: state.accepted,
  a: state.a,
  b: state.b,
  bothAt: state.bothAt,
  code: state.code,
  ...extra,
});

export async function onRequest(context) {
  const { request, env, params } = context;

  /* No binding means the namespace has not been attached yet. A 200 saying
     `enabled:false` rather than a 500 is deliberate: the client reads it as "no
     match rooms today" and uses the copy-paste flow, needing no error path. */
  if (!env?.READY) return json({ enabled: false }, 200);

  const room = cleanRoom(params?.room);
  if (!room) return json({ error: 'bad room' }, 400);

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
    state.accepted = true;
  } else if (body?.op === 'ready') {
    const side = body.side === 'a' || body.side === 'b' ? body.side : null;
    if (!side) return json({ error: 'bad side' }, 400);
    /* The defender's five ride along with their ready, because the two are the
       same moment: pressing Ready IS committing the team, and a code that
       arrived separately could leave a room ready-but-unfightable. */
    if (side === 'b') {
      const code = typeof body.code === 'string' ? body.code : '';
      if (!code || code.length > MAX_CODE) return json({ error: 'bad code' }, 400);
      state.code = code;
    }
    /* A side cannot ready before the room has a code to fight over — the
       challenger's button is gated on this in the UI, and gated here too so the
       rule does not depend on the UI being the only client. */
    if (side === 'a' && !state.code) return json({ error: 'not ready yet' }, 409);
    state[side] = true;
  } else {
    return json({ error: 'bad op' }, 400);
  }

  /* Stamped once, by the server, when the SECOND side readies. Both clients
     count down from this against the server's own clock, so two devices whose
     clocks disagree still land on the same GO. */
  if (state.a && state.b && !state.bothAt) state.bothAt = Date.now();

  await save(env, room, state);
  return json(view(state));
}
