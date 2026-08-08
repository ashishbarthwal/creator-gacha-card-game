/* data/presence — the match room client.

   Lives in data/ because it is the only module in the app that talks to a
   server of ours, which is exactly the question the folder answers: engine/
   touches nothing, data/ touches the network, ui/ touches the DOM.

   ── WHAT CROSSES THE WIRE ─────────────────────────────────────────────────
   A room id, which side you are, and — when the defender readies — their reply
   code. Nothing else: no names, no collection, no account, nothing that
   identifies a person. The room id is a hash both browsers derive independently
   from the challenge code, so joining a match costs no round trip and cannot be
   done by anyone who was not sent the code.

   ── EVERY PATH HERE FAILS SOFT ────────────────────────────────────────────
   This sits on top of a game that worked without a server for its whole life,
   and must not be able to take it down. Nothing here throws or rejects; every
   call resolves to a shape whose `enabled: false` sends the arena back to the
   copy-paste flow it shipped with. Offline, blocked, namespace unbound, request
   timed out, server returning nonsense: one answer, handled at the call site by
   doing nothing special. That path is not hypothetical — it is what runs until
   the KV namespace is bound. */

/* Same origin — a Pages Function on this very site, so no CORS, no second
   domain, nothing to configure per environment. */
const BASE = '/api/ready';

/* A hung request must not hang a lobby. */
const TIMEOUT_MS = 5000;

const OFFLINE = {
  enabled: false,
  accepted: false, a: false, b: false, bothAt: null, code: '', now: 0, countdownMs: null,
};

async function call(path, init) {
  /* AbortSignal.timeout is not everywhere yet, and this file must never be the
     reason a browser fails to run the game — so the controller is built by hand
     rather than reached for. */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, { ...init, signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return OFFLINE;
    const body = await res.json();
    /* A 200 saying `enabled:false` is the normal "no namespace bound" answer,
       not an error — pass it through unchanged. */
    if (!body?.enabled) return OFFLINE;
    return {
      enabled: true,
      accepted: Boolean(body.accepted),
      a: Boolean(body.a),
      b: Boolean(body.b),
      bothAt: Number.isFinite(body.bothAt) ? body.bothAt : null,
      code: typeof body.code === 'string' ? body.code : '',
      now: Number.isFinite(body.now) ? body.now : 0,
      countdownMs: Number.isFinite(body.countdownMs) ? body.countdownMs : null,
    };
  } catch {
    return OFFLINE;
  } finally {
    clearTimeout(timer);
  }
}

/* The room id BOTH windows derive independently: the challenger's five and the
   seed are in the challenge code, so each side has everything needed before
   either of them talks to the server. Being a hash of the challenge makes it
   unguessable without the code, so it doubles as the only access control this
   endpoint needs — you cannot join a match you were not sent. */
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
   anything. This is what turns the challenger's screen green. */
export const acceptChallenge = room => post(room, { op: 'accept' });

/* The defender readies. Their reply code travels WITH the ready rather than
   separately, because pressing Ready is the same act as committing the team —
   splitting them could leave a room that is ready and unfightable. */
export const readyWithTeam = (room, code) => post(room, { op: 'ready', side: 'b', code });

/* The challenger readies. Refused by the server until a code exists, which is
   the same rule the UI enforces by keeping the button locked. */
export const readyChallenger = room => post(room, { op: 'ready', side: 'a' });

export const checkRoom = room => call(`${BASE}/${encodeURIComponent(room)}`, { method: 'GET' });
