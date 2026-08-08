/* functions/api/ready/[room] — the match room, and the whole of the backend.

   ── WHAT IT HOLDS ────────────────────────────────────────────────────────
   Per room, for ten minutes: whether the challenge was accepted, whether each
   side has readied, when the second one did, and the defender's reply code.
   Nothing else, and nothing about a person.

   Three ops write it, and the split between the last two is load-bearing:
   `accept` (the defender has the challenge), `team` (here are my five), and
   `ready` (I am ready to watch). `team` and `ready` were once the same op, on
   the reasoning that pressing Ready IS committing the team. That was true of
   the original copy-paste flow and stopped being true the moment the lobby grew
   a Ready button of its own — see the note on the `team` branch below.

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
   not a degraded mode bolted on, it is the original path kept whole.

   The KV namespace was bound on 2026-08-08 and the lobby is live. One measured
   characteristic worth knowing before debugging a room that looks dead: KV
   caches MISSES, and `cacheTtl` cannot go below 60s, so a room polled before it
   exists can keep reading empty at that edge for up to a minute after it is
   written. Writes themselves are reliable — 30 polls over 90s, no flapping. */

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
  } else if (body?.op === 'team') {
    /* COMMITTING A TEAM IS NOT READYING, and conflating the two was a real bug:
       the defender uploaded their five on leaving the builder, which flipped
       their ready flag before the lobby had even rendered. Both screens then
       told the truth about a lie — the challenger saw "they are ready", the
       defender saw "you are ready", and neither player had pressed anything.
       Worse, the challenger pressing Ready was then enough to stamp `bothAt`
       and start a fight the defender never agreed to. So the code arrives by
       its own op, and readiness stays something a person does. */
    const code = typeof body.code === 'string' ? body.code : '';
    if (!code || code.length > MAX_CODE) return json({ error: 'bad code' }, 400);
    state.code = code;
    /* Committing a team implies having accepted, so this heals a lost `accept`
       instead of leaving the challenger watching a room that will never flip.
       The defender's `accept` is a single fire-and-forget request; if it failed
       — a phone switching networks between reading the code and pasting it —
       nothing else would ever set this flag. */
    state.accepted = true;
  } else if (body?.op === 'ready') {
    const side = body.side === 'a' || body.side === 'b' ? body.side : null;
    if (!side) return json({ error: 'bad side' }, 400);
    /* The defender re-sends their code alongside Ready even though `team`
       already stored it. It is idempotent, it costs one field, and it heals the
       one case that would otherwise deadlock: a `team` write that never landed
       leaves a room whose only copy of the five is in a browser. */
    if (side === 'b' && typeof body.code === 'string' && body.code) {
      if (body.code.length > MAX_CODE) return json({ error: 'bad code' }, 400);
      state.code = body.code;
    }
    /* NEITHER side may ready before the room has a code to fight over. This
       used to gate the challenger only, which was half a rule: a defender
       marked ready with no code on the server is a room that is ready and
       unfightable. Gated here as well as in the UI so it does not depend on
       this being the only client. */
    if (!state.code) return json({ error: 'not ready yet' }, 409);
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
