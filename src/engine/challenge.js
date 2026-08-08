/* challenge — the battle code: a whole 1v1 folded into a string a player can
   paste. PURE and headless, like everything else in engine/ — no DOM, no
   network, no storage, no clock of its own.

   ── WHY A CODE AND NOT A CONNECTION ───────────────────────────────────────
   Locked decision 3 says client-side only: static host, no backend. That rules
   out the obvious answer (a room on a server) and, less obviously, it rules out
   every same-machine shortcut too. A normal window and an incognito window are
   STORAGE-PARTITIONED: localStorage, IndexedDB, cookies, SharedWorker and
   BroadcastChannel are all isolated between them by design — that partition is
   the entire point of a private window, and a game is not a reason to want it
   defeated. WebRTC would technically work, but only with a signalling server,
   which is the backend again wearing a hat.

   So the channel between the two windows is THE PLAYER. They copy a string out
   of one and paste it into the other. That sounds like a compromise and is
   actually the strongest option available: it works between two windows on one
   machine, between two browsers, between two people on two continents over any
   chat app, and it will still work in ten years because it depends on nothing
   but this file.

   ── WHAT MAKES IT A REAL 1v1 RATHER THAN TWO SIMULATIONS ──────────────────
   engine/battle.js is pure and takes its randomness as an injected `rng`, and
   engine/battle-stats.js takes its clock as an injected `now`. Feed both sides
   the same teams, the same seed and the same `now`, and the two windows do not
   merely agree about who won — they replay the identical fight, hit for hit,
   crit for crit. That is why all three travel in the code, and why `now` is
   pinned rather than read locally on arrival: channel age drives three of the
   five battle axes, so two windows opening the code a day apart would otherwise
   compute two different fights from the same cards.

   ── THE RESULT CODE CARRIES INPUTS, NOT A VERDICT ─────────────────────────
   The reply a defender sends back does not say "I won". It carries their five
   cards, and the challenger's window RE-RESOLVES the fight from them. A claimed
   outcome would have to be taken on trust; a recomputed one cannot be wrong.
   `fingerprint` closes the other half of that: the result echoes a digest of
   the challenger's own team, and the challenger checks it still matches what
   they sent, so a corrupted or edited round trip is caught rather than silently
   fought as a different battle.

   WHAT THIS IS NOT: tamper-proof. A determined player can hand-edit their own
   five to have a billion subscribers before encoding, and no amount of
   checksumming fixes that — detecting it needs a secret, and a secret needs a
   server. There is no ladder, no ranking and nothing to win, so the honest
   engineering answer is to say so here rather than to build ceremony that
   pretends otherwise.

   ── THE WIRE SHAPE ────────────────────────────────────────────────────────
     CGB1.<z|p><base64url payload>

   `z` is deflate-raw, `p` is the same JSON uncompressed — the flag is in the
   string so a code made by a browser with CompressionStream still decodes in
   one without it. Channels are packed as ARRAYS rather than objects because
   the key names would otherwise be about a third of the payload, and avatar
   URLs get their one common prefix folded to a sigil for the same reason:
   deflate finds it anyway, but the plain fallback should not be punished for a
   missing platform API. */

import { TEAM_SIZE } from './battle.js';

export const CODE_VERSION = 1;
const PREFIX = `CGB${CODE_VERSION}.`;

export const KIND = { challenge: 'c', result: 'r' };

/* Every YouTube avatar sits under this one host. Folding it to a single byte
   saves ~21 chars per card — ~105 per team, which is most of what the plain
   (uncompressed) fallback can afford to give away. */
const AVATAR_PREFIX = 'https://yt3.ggpht.com/';
/* A single character that cannot begin a real URL, so the swap is unambiguous
   in both directions. Written as a printable tilde rather than a control byte:
   a raw 0x01 in a source file survives neither a careless editor nor a diff
   viewer, and this string has to round-trip through both. */
const AVATAR_SIGIL = '~';

const packUrl = url => (String(url ?? '').startsWith(AVATAR_PREFIX)
  ? AVATAR_SIGIL + String(url).slice(AVATAR_PREFIX.length)
  : String(url ?? ''));

const unpackUrl = url => (String(url ?? '').startsWith(AVATAR_SIGIL)
  ? AVATAR_PREFIX + String(url).slice(AVATAR_SIGIL.length)
  : String(url ?? ''));

/* The field order IS the format. Appending is safe; reordering is not, which is
   what CODE_VERSION exists to make loud rather than subtle. Mirrors the
   collection's stored allowlist plus the two battle fields — a positive list,
   for the same reason it is one there: nothing the seam grows later should
   start travelling in a code by accident. */
function packChannel(channel) {
  return [
    String(channel?.id ?? ''),
    String(channel?.title ?? ''),
    String(channel?.handle ?? ''),
    packUrl(channel?.avatarUrl),
    String(channel?.subscriberCount ?? ''),
    channel?.hiddenSubscriberCount ? 1 : 0,
    String(channel?.viewCount ?? '0'),
    String(channel?.videoCount ?? '0'),
    String(channel?.publishedAt ?? ''),
    String(channel?.element ?? ''),
  ];
}

function unpackChannel(row) {
  const at = i => (Array.isArray(row) ? row[i] : undefined);
  const channel = {
    id: String(at(0) ?? ''),
    title: String(at(1) ?? ''),
    handle: String(at(2) ?? ''),
    avatarUrl: unpackUrl(at(3)),
    hiddenSubscriberCount: Boolean(at(5)),
    viewCount: String(at(6) ?? '0'),
    videoCount: String(at(7) ?? '0'),
  };
  /* Absent rather than empty, matching engine/collection.js: the readers
     downstream test for falsiness, so this only decides whether a decoded card
     is honest about what it does not know. */
  const subs = at(4);
  if (subs !== '' && subs != null) channel.subscriberCount = String(subs);
  if (at(8)) channel.publishedAt = String(at(8));
  if (at(9)) channel.element = String(at(9));
  return channel;
}

/* A short digest of a team, used to prove a result code came back describing
   the same challenge that went out. FNV-1a over the ids in slot order — order
   is included on purpose, because a formation is part of what was committed
   and a reply that silently re-ordered the challenger's front rank would be
   describing a different fight. */
export function fingerprint(channels) {
  let h = 2166136261;
  for (const channel of channels ?? []) {
    for (const c of String(channel?.id ?? '')) {
      h ^= c.codePointAt(0);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= 0x2f; h = Math.imul(h, 16777619) >>> 0;   // slot separator
  }
  return (h >>> 0).toString(36);
}

/* ── base64url over bytes ─────────────────────────────────────────────────
   Hand-rolled rather than reached for, because the two obvious routes are both
   wrong here: `btoa` alone mangles any non-Latin-1 character (a channel title
   is frequently neither), and Node's Buffer does not exist in a browser. So the
   string is UTF-8 encoded first and the bytes are what get base64'd, which is
   the only version that survives a Japanese channel name. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function bytesToBase64url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += b === undefined ? '' : B64[(n >> 6) & 63];
    out += c === undefined ? '' : B64[n & 63];
  }
  return out;
}

function base64urlToBytes(text) {
  const clean = String(text ?? '').replace(/[^A-Za-z0-9\-_]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let at = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const q = [0, 1, 2, 3].map(k => B64.indexOf(clean[i + k] ?? ''));
    const n = (Math.max(q[0], 0) << 18) | (Math.max(q[1], 0) << 12)
            | (Math.max(q[2], 0) << 6) | Math.max(q[3], 0);
    if (q[1] >= 0) bytes[at++] = (n >> 16) & 255;
    if (q[2] >= 0) bytes[at++] = (n >> 8) & 255;
    if (q[3] >= 0) bytes[at++] = n & 255;
  }
  return bytes.subarray(0, at);
}

/* ── compression ──────────────────────────────────────────────────────────
   CompressionStream is a platform primitive, not I/O: it touches no device, no
   network and no storage, and the same bytes in always give the same bytes out.
   It is async only because it is expressed as a stream, which is why this file
   can use it and still be engine/ code.

   Every path degrades rather than throws. A browser without it (or one that
   rejects 'deflate-raw' specifically) emits a `p` code that every other browser
   still reads; the only cost is a longer string. */
/* Push `bytes` through a transform stream and collect what comes out.

   THE TWO WRITER PROMISES MUST BE HANDLED, and that is not tidiness — it is a
   real bug this had. When the stream errors (which is the NORMAL path for a
   truncated code: deflate-raw hits the end of the data mid-symbol and throws
   Z_BUF_ERROR), `write()` and `close()` reject INDEPENDENTLY of the reader.
   Awaiting only the reader leaves those two rejections floating, so a player
   pasting a code that got cut short in a chat app was answered correctly on
   screen AND logged an unhandled promise rejection — which in Node terminates
   the process outright, and is exactly what surfaced this in the test run.

   So both are marked handled at the point they are created. The reader is
   still what the caller awaits, because the reader is where the error carries
   the information worth acting on. */
async function pump(stream, bytes) {
  const writer = stream.writable.getWriter();
  const settled = [writer.write(bytes), writer.close()];
  for (const p of settled) p.catch(() => {});

  const chunks = [];
  const reader = stream.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

async function maybeDeflate(bytes) {
  try {
    if (typeof CompressionStream === 'undefined') return null;
    return await pump(new CompressionStream('deflate-raw'), bytes);
  } catch {
    return null;
  }
}

/* Throws on damaged input — decodeCode turns that into a sentence a player can
   act on, rather than letting a zlib errno reach the screen. */
function inflate(bytes) {
  return pump(new DecompressionStream('deflate-raw'), bytes);
}

/* ── the payload ──────────────────────────────────────────────────────────
   Short keys, because every byte here becomes ~1.4 characters of paste. */
function toPayload({ kind, now, seed, name, teamA, teamB, echo }) {
  const payload = {
    v: CODE_VERSION,
    k: kind,
    t: Math.floor(now),
    s: seed >>> 0,
    n: String(name ?? '').slice(0, 24),
    a: (teamA ?? []).map(packChannel),
  };
  if (teamB) payload.b = teamB.map(packChannel);
  if (echo) payload.e = echo;
  return payload;
}

export class ChallengeError extends Error {}

/* A code is a stranger's input, so every field is checked rather than trusted.
   The messages are written to be SHOWN — "that code is from a newer version of
   the game" is something a player can act on, where "invalid payload" is not. */
function validate(payload) {
  if (!payload || typeof payload !== 'object') throw new ChallengeError('That does not look like a battle code.');
  if (payload.v !== CODE_VERSION) {
    throw new ChallengeError(payload.v > CODE_VERSION
      ? 'That code was made by a newer version of the game.'
      : 'That code was made by an older version of the game.');
  }
  const kind = payload.k;
  if (kind !== KIND.challenge && kind !== KIND.result) throw new ChallengeError('That battle code is not a challenge or a result.');

  const team = (rows, label) => {
    if (!Array.isArray(rows) || rows.length !== TEAM_SIZE) {
      throw new ChallengeError(`That code does not carry a full team of ${TEAM_SIZE} (${label}).`);
    }
    const channels = rows.map(unpackChannel);
    if (channels.some(c => !c.id)) throw new ChallengeError(`A card in the ${label} team is missing its channel id.`);
    if (new Set(channels.map(c => c.id)).size !== channels.length) {
      throw new ChallengeError(`The ${label} team fields the same creator twice.`);
    }
    return channels;
  };

  const now = Number(payload.t);
  if (!Number.isFinite(now) || now <= 0) throw new ChallengeError('That code is missing the timestamp its stats are pinned to.');

  const decoded = {
    version: payload.v,
    kind,
    now,
    seed: Number(payload.s) >>> 0,
    name: String(payload.n ?? '').slice(0, 24),
    teamA: team(payload.a, 'challenger'),
    teamB: kind === KIND.result ? team(payload.b, 'defender') : null,
    echo: typeof payload.e === 'string' ? payload.e : null,
  };
  return decoded;
}

/* ── the two calls the UI makes ───────────────────────────────────────────── */

export async function encodeCode(input) {
  const json = JSON.stringify(toPayload(input));
  const raw = new TextEncoder().encode(json);
  const packed = await maybeDeflate(raw);
  /* Only take the compressed form if it actually won. A short payload can
     deflate LARGER than it started (the stream has a fixed overhead), and
     shipping the bigger of two options to save a flag byte would be silly. */
  const useZ = packed && packed.length < raw.length;
  return PREFIX + (useZ ? 'z' : 'p') + bytesToBase64url(useZ ? packed : raw);
}

export async function decodeCode(text) {
  /* Pasted codes arrive wrapped in whatever the chat app did to them —
     newlines, a stray quote, a leading "here:". Tolerate everything up to the
     prefix and strip whitespace inside, because the alternative is a player
     staring at a code that looks right and an error that says it is not. */
  const cleaned = String(text ?? '').replace(/\s+/g, '');
  const at = cleaned.indexOf(PREFIX);
  if (at === -1) {
    throw new ChallengeError(cleaned.length
      ? 'That is not a battle code — they start with ' + PREFIX
      : 'Paste a battle code first.');
  }
  const body = cleaned.slice(at + PREFIX.length);
  const flag = body[0];
  if (flag !== 'z' && flag !== 'p') throw new ChallengeError('That battle code is damaged (unknown encoding).');

  let bytes = base64urlToBytes(body.slice(1));
  if (flag === 'z') {
    try {
      bytes = await inflate(bytes);
    } catch {
      throw new ChallengeError('That battle code is damaged — it may have been cut short when copied.');
    }
  }
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ChallengeError('That battle code is damaged — it may have been cut short when copied.');
  }
  return validate(payload);
}

/* Convenience wrappers, so the UI never assembles a payload by hand and the two
   kinds cannot drift apart in what they carry. */

export function newSeed(rng = Math.random) {
  /* A full uint32, drawn when the challenge is CREATED — before the challenger
     can see what they are up against. That ordering is the fairness property:
     re-rolling the dice against a known enemy team is exactly what a seed
     chosen later would allow. */
  return (Math.floor(rng() * 0x100000000) >>> 0);
}

export function makeChallenge({ team, name, seed = newSeed(), now = Date.now() }) {
  return encodeCode({ kind: KIND.challenge, now, seed, name, teamA: team });
}

export function makeResult({ challenge, team, name }) {
  return encodeCode({
    kind: KIND.result,
    now: challenge.now,
    seed: challenge.seed,
    name,
    teamA: challenge.teamA,
    teamB: team,
    /* What the challenger checks on the way back in. */
    echo: fingerprint(challenge.teamA),
  });
}

/* Did this result come back describing the challenge we actually sent? Split
   out rather than thrown inside decodeCode because a decoded result is still
   perfectly readable when it fails — the caller may want to say "this reply is
   to a different challenge" rather than "this code is broken". */
export function echoMatches(result, sentTeam) {
  if (!result?.echo) return true;                 // older/simpler code: nothing to check
  return result.echo === fingerprint(sentTeam);
}
