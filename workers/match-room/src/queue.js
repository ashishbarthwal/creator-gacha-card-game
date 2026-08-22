/* workers/match-room/queue — the random-opponent queue, as a Durable Object.

   ── WHAT IT IS FOR, AND HOW SMALL THAT TURNS OUT TO BE ────────────────────
   The arena already knows how to run a live 1v1 between two strangers: the
   lobby, the fairness gate, the shared blind build, the independent locks, the
   face-off beat. All of it works today and none of it is touched by this file.

   What that flow cannot do is START without a challenge code, and the reason is
   worth stating precisely, because it is the whole of what this object exists
   to supply. Two browsers running a friend match agree on four things before
   either of them talks to a server, and they agree by both reading the same
   string:

     the ROOM ID   `roomFor(fingerprint, seed)` — both derive it from the code
     the SEED      minted by the challenger inside `makeChallenge`
     the CLOCK     `now`, pinned in the code, so `battleStatsFrom` matches
     the SEATS     whoever generated the seed is 'a'; whoever pasted it is 'b'

   With no code there is no shared string, so none of those four can be agreed
   on. THAT IS THE ENTIRE PROBLEM. This object is a place for two strangers to
   agree on those four values and nothing else — after which they are in exactly
   the position a friend match is in the instant a code is pasted, and the
   existing protocol carries them the rest of the way.

   So this is deliberately NOT a matchmaker in the game sense. It does not rate
   players, it does not balance, it does not queue by skill. `engine/fairness.js`
   already handles the only imbalance this game has a rule about (collection
   size), and it handles it after pairing, on both sides, in the lobby.

   ── WHY THE SERVER MINTS THE SEED AND THE CLOCK ──────────────────────────
   Not for fairness — for AGREEMENT. `engine/battle.js` is pure and
   seed-deterministic and `battleStatsFrom` takes its clock as a parameter, so
   both browsers resolve the same fight independently from the same inputs and
   never exchange a result. That property is load-bearing: ui/battle.js's header
   calls two players seeing two different winners "the worst failure available
   here". A seed either side minted locally would be a seed the other side has
   to be told about and could disagree about. One authority, one value, handed
   to both at the same instant, is the only shape that cannot drift.

   It is also the fairness ordering the friend flow already has: the seed is
   fixed BEFORE either side can see the other's team, so nobody is re-rolling
   dice against a known enemy.

   ── WHY ONE INSTANCE, NOT SHARDS ─────────────────────────────────────────
   Every request routes to `idFromName('lobby-v1')`, so there is exactly one
   queue in the world. That looks like the thing you are supposed to shard and
   it is the opposite: a queue's whole job is to be the one place two people can
   find each other, and a sharded queue holding one player per shard matches
   nobody. Serialization is the feature. A Durable Object handles orders of
   magnitude more matchmaking traffic than this project will ever see, and if it
   ever does, the fix is a shard KEY people can agree on (a region, a mode) —
   never a random spread, which would break the only property that matters.

   The name carries `-v1` so a protocol change can move to a fresh instance
   rather than migrate one, since a queue holds nothing worth keeping.

   ── WHAT IT MUST NEVER HOLD ──────────────────────────────────────────────
   The same promise the room keeps, and for the same reason. A queue entry is a
   random nonce the browser made up, a collection SIZE as a bare integer, and a
   timestamp. No account, no identity, no collection, no team, no name, no IP.
   The nonce names a QUEUE SLOT for about half a minute; there is nothing behind
   it to look up and it is never sent to the other player. `matched()` below is
   the only thing that leaves this file, and it is built from named fields
   rather than by spreading state, so a field added here cannot leak by
   accident. */

/* A parked player must check in within this or be treated as gone. Deliberately
   SHORTER than a careless client's poll gap: the failure this prevents is
   pairing somebody with a browser tab that was closed two minutes ago, which
   costs the survivor a full lobby and a stall timeout to discover. Better to
   evict early and make them re-join — re-joining is one request and is
   invisible, where being paired with a ghost is 75 seconds of staring at a
   screen that will never move. */
const WAIT_TTL_MS = 25000;

/* How long a minted pairing stays readable by the ticket that owns it. Long
   enough that a waiter whose poll response was dropped can ask again and still
   be told where to go; short enough that this object holds nothing for long.
   It is not the match's lifetime — the ROOM owns that, and it is ten minutes. */
const PAIR_TTL_MS = 120000;

/* The queue as a whole goes away when it has been idle this long. A Durable
   Object has no TTL of its own, so without an alarm the single global instance
   would sit in storage forever holding an empty object. */
const IDLE_TTL_MS = 300000;

/* Same shape as the room's seat claim, and generated the same way — a nonce the
   browser makes up. See the note at the top about what it does and does not
   identify. */
const TICKET = /^[a-z0-9]{4,64}$/;
const cleanTicket = raw => (typeof raw === 'string' && TICKET.test(raw) ? raw : null);

/* A collection size is an integer a stranger sent us, and the only number here
   that influences anything (fairness.js reads it to decide shedding). Clamped
   rather than trusted: a negative or absurd value cannot be honest, and the
   fairness check must not be steerable by a hand-edited request. The ceiling is
   well above the whole deck, so no real player can reach it. */
const MAX_CS = 100000;
function cleanSize(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(MAX_CS, Math.floor(n));
}

const STATE_KEY = 'queue';

/* The room id has to satisfy the SAME validation the room's public door applies
   (`/^[a-z0-9]{4,40}$/` in functions/api/ready/[room].js). This mints one rather
   than deriving it, so it sits inside that alphabet by construction rather than
   by hope. 16 random bytes rendered base36 is unguessable in the only sense
   that matters here: a room id is the whole of what protects a match in
   progress, exactly as it is in the friend flow where it is a hash of a code. */
function mintRoom() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += b.toString(36);
  return out.slice(0, 20).padEnd(20, '0');
}

/* A full uint32, matching `newSeed` in engine/challenge.js — the fight is
   seeded identically whichever way the match started, so a random duel and a
   friend duel are the same fight with the same variance. */
function mintSeed() {
  const words = new Uint32Array(1);
  crypto.getRandomValues(words);
  return words[0] >>> 0;
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

/* A FACTORY, NOT A CONSTANT, and the difference is a real bug the tests caught
   before this ever ran. The room next door gets away with a frozen-in-place
   `EMPTY` object because every field on it is a primitive, so `{ ...EMPTY }`
   copies all of it. This one holds `pairs`, and a spread is SHALLOW — so every
   instance sharing one `EMPTY` shared one `pairs` object, and writing a pairing
   into it wrote into the template that every future read starts from.

   The symptom was two tests apart: a queue that had never been joined answering
   `matched` and handing out a stranger's collection size from an earlier match.
   In production it would be worse and quieter — one isolate serves many
   requests, so pairings would pile up in the template and outlive both the
   sweep and the object itself. Build a new one every time. */
const empty = () => ({ waiting: null, pairs: {} });

/* What a paired client is told. Built field by field on purpose: this is the
   only thing that crosses back out, and spreading the stored pairing would mean
   a field added to storage later ships to a stranger without anybody deciding
   it should. `theirCs` is the OTHER side's collection size, which is what makes
   the fairness gate work with no challenge code — see the note in `join`. */
const matched = pair => ({
  status: 'matched',
  room: pair.room,
  side: pair.side,
  seed: pair.seed,
  now: pair.now,
  theirCs: pair.theirCs,
});

export class MatchQueue {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async read() {
    const stored = await this.ctx.storage.get(STATE_KEY);
    if (!stored) return empty();
    /* `pairs` is rebuilt rather than spread through, for the reason above: the
       stored object is handed straight back by the fake storage in the tests
       and by a live isolate's own memory, so sharing the reference means the
       caller mutates what it is reading from. */
    return { ...empty(), ...stored, pairs: { ...(stored.pairs ?? {}) } };
  }

  async save(state) {
    await this.ctx.storage.put(STATE_KEY, state);
    /* Pushed forward on every write, unlike the room's alarm. The room is one
       match with a fixed ten-minute life; this object is a shared fixture with
       no life of its own, so what it should clean up after is going QUIET, not
       having existed for a while. */
    await this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS);
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }

  /* Drop a parked player who stopped checking in, and pairings nobody collected.
     Run at the top of every op rather than on a timer: the only moments this
     state can be wrong are the moments somebody asks about it, and a sweep that
     runs exactly then cannot drift from what the next answer depends on. */
  sweep(state, now) {
    if (state.waiting && now - state.waiting.at > WAIT_TTL_MS) state.waiting = null;
    for (const [ticket, pair] of Object.entries(state.pairs)) {
      if (now - pair.at > PAIR_TTL_MS) delete state.pairs[ticket];
    }
    return state;
  }

  async fetch(request) {
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    let body = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad body' }, 400);
    }

    const ticket = cleanTicket(body?.ticket);
    if (!ticket) return json({ error: 'bad ticket' }, 400);

    const now = Date.now();
    const state = this.sweep(await this.read(), now);

    /* A pairing already minted for this ticket wins over everything else, and it
       is checked FIRST for every op rather than only inside `poll`. A `join`
       that arrives after its owner was already paired is a retry of a request
       whose response was lost — answering it with a fresh park would strand the
       player who is already sitting in that room waiting for them. */
    if (state.pairs[ticket]) {
      const answer = matched(state.pairs[ticket]);
      await this.save(state);
      return json(answer);
    }

    if (body.op === 'join') {
      const cs = cleanSize(body.cs);
      if (cs === null) return json({ error: 'bad size' }, 400);

      /* Re-joining while already parked refreshes the heartbeat instead of
         double-parking. Same self-heal the room's `accept` does for a repeated
         claim: one browser retrying is not two players. */
      if (state.waiting && state.waiting.ticket === ticket) {
        state.waiting = { ticket, cs, at: now };
        await this.save(state);
        return json({ status: 'waiting', waitingSince: now });
      }

      if (state.waiting) {
        /* ── THE PAIRING, AND IT IS ATOMIC BY CONSTRUCTION ────────────────
           A Durable Object handles one request at a time, so the read above,
           this mutation and the write below cannot interleave with another
           joiner's. That is the same property the room migration was done for,
           and a queue needs it even more: on KV, two people joining at once
           would each read an empty queue, each park, and neither would ever be
           told about the other. There is no version of this on a cached store.

           THE WAITER TAKES SEAT 'a' AND THE JOINER SEAT 'b', and that mapping
           is what makes this whole file small. Seat 'b' is the DEFENDER's seat
           — the one that sends `accept` — and the joiner is the side that is
           present and acting right now, exactly as a defender pasting a code
           is. So the joiner does what a defender already does, the waiter does
           what a challenger already does, and the room protocol needs no new
           op and no new field to run a random match.

           EACH SIDE IS TOLD THE OTHER'S COLLECTION SIZE HERE, which is the one
           thing the friend flow gets from its code and this flow cannot. Side
           'b' normally reads it out of the challenge (`collectionSize`), and
           side 'a' reads `csB` off the room once 'b' accepts. Handing 'b' its
           opponent's size at pairing puts it in exactly the position a decoded
           challenge leaves it in, so `fairnessFor` needs no new branch. */
        const other = state.waiting;
        const room = mintRoom();
        const seed = mintSeed();
        const at = now;

        /* Minted ONCE, here, and handed to both sides. Neither browser chooses
           any of it, so there is nothing for them to disagree about. */
        state.pairs[other.ticket] = { room, side: 'a', seed, now: at, theirCs: cs, at };
        state.pairs[ticket] = { room, side: 'b', seed, now: at, theirCs: other.cs, at };
        state.waiting = null;

        await this.save(state);
        return json(matched(state.pairs[ticket]));
      }

      state.waiting = { ticket, cs, at: now };
      await this.save(state);
      return json({ status: 'waiting', waitingSince: now });
    }

    if (body.op === 'poll') {
      /* Still parked: refresh the heartbeat. A poll IS the check-in, so there is
         no separate keep-alive op for a client to forget to send. */
      if (state.waiting && state.waiting.ticket === ticket) {
        state.waiting.at = now;
        await this.save(state);
        return json({ status: 'waiting', waitingSince: state.waiting.at });
      }
      /* Not parked and not paired. Either this ticket was swept for going quiet
         or it never joined — both are answered the same way, because the
         client's response to both is identical: join again. */
      return json({ status: 'expired' });
    }

    if (body.op === 'leave') {
      if (state.waiting && state.waiting.ticket === ticket) {
        state.waiting = null;
        await this.save(state);
      }
      return json({ status: 'left' });
    }

    return json({ error: 'bad op' }, 400);
  }
}
