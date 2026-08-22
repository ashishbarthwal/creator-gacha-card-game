/* The random-opponent queue — workers/match-room/src/queue.js.

   Same trick as test/match-room.test.js: a Durable Object takes its context as
   a constructor parameter, so a Map behind `storage` is a complete one. No
   wrangler, no miniflare, no network.

   WHAT IS WORTH PINNING HERE. The queue is small, and every rule in it exists
   because getting it wrong produces the same symptom — a player staring at a
   screen that will never move — with a different cause each time. Those causes
   are not distinguishable from the outside, which is exactly the property that
   put the room's seat rules into production wrong twice. */

import { describe, it, expect } from 'vitest';
import { MatchQueue } from '../workers/match-room/src/queue.js';
import { MatchRoom } from '../workers/match-room/src/index.js';

const URL = 'https://example.test/api/queue';

function fakeCtx() {
  const store = new Map();
  let alarm = null;
  return {
    storage: {
      get: async key => store.get(key),
      put: async (key, value) => void store.set(key, value),
      getAlarm: async () => alarm,
      setAlarm: async at => { alarm = at; },
      deleteAll: async () => { store.clear(); alarm = null; },
    },
    peek: () => store.get('queue'),
    alarmAt: () => alarm,
  };
}

function queue() {
  const ctx = fakeCtx();
  const object = new MatchQueue(ctx);
  const call = async body => {
    const res = await object.fetch(new Request(URL, { method: 'POST', body: JSON.stringify(body) }));
    return { status: res.status, ...(await res.json()) };
  };
  return { call, ctx, object };
}

const join = (call, ticket, cs = 100) => call({ op: 'join', ticket, cs });

/* The room, built the same way — see test/match-room.test.js, which owns the
   room's own rules. This file only drives it far enough to prove the handoff. */
function room() {
  const ctx = fakeCtx();
  const object = new MatchRoom(ctx);
  const call = async body => {
    const request = body
      ? new Request('https://example.test/api/ready/testroom1234', { method: 'POST', body: JSON.stringify(body) })
      : new Request('https://example.test/api/ready/testroom1234');
    const res = await object.fetch(request);
    return { status: res.status, ...(await res.json()) };
  };
  return { call, ctx };
}

const TEAM = Array.from({ length: 5 }, (_, i) => ({ id: `UC${i}`, title: `Creator ${i}` }));

describe('the random-opponent queue', () => {
  it('parks the first player and pairs the second', async () => {
    const { call } = queue();

    const first = await join(call, 'aaaa1111', 250);
    expect(first.status).toBe('waiting');
    expect(first.room).toBeUndefined();

    const second = await join(call, 'bbbb2222', 40);
    expect(second.status).toBe('matched');
    expect(second.room).toMatch(/^[a-z0-9]{4,40}$/);
    expect(second.side).toBe('b');
  });

  /* THE PROPERTY THE WHOLE FEATURE RESTS ON. Both browsers resolve the fight
     independently and never exchange a result, so a seed or a clock the two
     sides disagreed about would show two players two different winners for the
     same battle — which ui/battle.js's header calls the worst failure available
     here. One authority mints both; this is what says so. */
  it('hands both sides the SAME room, seed and clock', async () => {
    const { call } = queue();
    await join(call, 'aaaa1111');
    const b = await join(call, 'bbbb2222');
    const a = await call({ op: 'poll', ticket: 'aaaa1111' });

    expect(a.status).toBe('matched');
    expect(a.room).toBe(b.room);
    expect(a.seed).toBe(b.seed);
    expect(a.now).toBe(b.now);
  });

  /* Seat 'b' is the DEFENDER's seat — the side that sends `accept`. Giving it
     to the joiner is what lets the room protocol run a random match with no new
     op and no new field: the joiner does what a defender already does, the
     waiter does what a challenger already does. */
  it('seats the waiter as the challenger and the joiner as the defender', async () => {
    const { call } = queue();
    await join(call, 'aaaa1111');
    const b = await join(call, 'bbbb2222');
    const a = await call({ op: 'poll', ticket: 'aaaa1111' });

    expect(a.side).toBe('a');
    expect(b.side).toBe('b');
  });

  /* The one thing the friend flow gets from its code and this flow cannot.
     Side 'b' normally reads the challenger's size out of the decoded challenge;
     handing it over at pairing puts it in the same position, so `fairnessFor`
     needs no new branch. Crossed, not mirrored — each side is told the OTHER's
     number. */
  it('tells each side the other side collection size', async () => {
    const { call } = queue();
    await join(call, 'aaaa1111', 900);
    const b = await join(call, 'bbbb2222', 30);
    const a = await call({ op: 'poll', ticket: 'aaaa1111' });

    expect(b.theirCs).toBe(900);
    expect(a.theirCs).toBe(30);
  });

  it('never pairs a ticket with itself', async () => {
    const { call } = queue();
    expect((await join(call, 'aaaa1111')).status).toBe('waiting');
    /* A second join from the same browser is a RETRY, not a second player. */
    expect((await join(call, 'aaaa1111')).status).toBe('waiting');
    expect((await join(call, 'bbbb2222')).status).toBe('matched');
  });

  /* A dropped response must not cost the pairing. The other side is already
     sitting in that room; parking this ticket again would strand them. */
  it('answers a re-sent join with the pairing it already has', async () => {
    const { call } = queue();
    await join(call, 'aaaa1111');
    const first = await join(call, 'bbbb2222');
    const retry = await join(call, 'bbbb2222');

    expect(retry.status).toBe('matched');
    expect(retry.room).toBe(first.room);
    expect(retry.side).toBe(first.side);
  });

  it('keeps a pairing readable to the waiter across repeated polls', async () => {
    const { call } = queue();
    await join(call, 'aaaa1111');
    await join(call, 'bbbb2222');

    const once = await call({ op: 'poll', ticket: 'aaaa1111' });
    const twice = await call({ op: 'poll', ticket: 'aaaa1111' });
    expect(twice.status).toBe('matched');
    expect(twice.room).toBe(once.room);
  });

  /* THE GHOST-PAIRING BUG THIS PREVENTS. Being matched with a tab that was
     closed two minutes ago costs the survivor a full lobby and a 75-second
     stall to discover, where being swept costs the searcher one invisible
     request. Evict early. */
  it('sweeps a searcher who stopped checking in, rather than pairing with them', async () => {
    const { call, ctx } = queue();
    await join(call, 'aaaa1111');

    const state = ctx.peek();
    state.waiting.at = Date.now() - 60000;

    const late = await join(call, 'bbbb2222');
    expect(late.status).toBe('waiting');
  });

  it('refreshes the heartbeat on every poll so an active searcher survives', async () => {
    const { call, ctx } = queue();
    await join(call, 'aaaa1111');

    const state = ctx.peek();
    state.waiting.at = Date.now() - 20000;      // stale, but not yet swept

    expect((await call({ op: 'poll', ticket: 'aaaa1111' })).status).toBe('waiting');
    expect(Date.now() - ctx.peek().waiting.at).toBeLessThan(1000);
  });

  it('reports a swept or unknown ticket as expired rather than waiting', async () => {
    const { call } = queue();
    expect((await call({ op: 'poll', ticket: 'nevernevr' })).status).toBe('expired');
  });

  it('frees the slot on leave so the next player is not waiting on a ghost', async () => {
    const { call } = queue();
    await join(call, 'aaaa1111');
    await call({ op: 'leave', ticket: 'aaaa1111' });

    expect((await join(call, 'bbbb2222')).status).toBe('waiting');
  });

  it('mints a room id inside the alphabet the room endpoint accepts', async () => {
    const { call } = queue();
    await join(call, 'aaaa1111');
    const { room } = await join(call, 'bbbb2222');
    /* The exact test in cleanRoom(), functions/api/ready/[room].js — a room id
       this object mints and that endpoint rejects would be a match nobody can
       reach. */
    expect(/^[a-z0-9]{4,40}$/.test(room)).toBe(true);
  });

  it('gives two separate pairings different rooms and seeds', async () => {
    const { call } = queue();
    await join(call, 'aaaa1111');
    const one = await join(call, 'bbbb2222');
    await join(call, 'cccc3333');
    const two = await join(call, 'dddd4444');

    expect(two.room).not.toBe(one.room);
    expect(two.seed).not.toBe(one.seed);
  });

  /* The fairness check reads this number, so it must not be steerable by a
     hand-edited request. */
  it('refuses a nonsense collection size and clamps an absurd one', async () => {
    const { call } = queue();
    expect((await call({ op: 'join', ticket: 'aaaa1111', cs: -5 })).error).toBe('bad size');
    expect((await call({ op: 'join', ticket: 'aaaa1111', cs: 'lots' })).error).toBe('bad size');

    await call({ op: 'join', ticket: 'aaaa1111', cs: 1e12 });
    const paired = await join(call, 'bbbb2222');
    expect(paired.theirCs).toBe(100000);
  });

  it('refuses a malformed ticket', async () => {
    const { call } = queue();
    expect((await call({ op: 'join', ticket: 'no', cs: 1 })).status).toBe(400);
    expect((await call({ op: 'join', ticket: 'has spaces!', cs: 1 })).status).toBe(400);
    expect((await call({ op: 'join', cs: 1 })).status).toBe(400);
  });

  it('refuses an unknown op and a non-POST', async () => {
    const { call, object } = queue();
    expect((await call({ op: 'nope', ticket: 'aaaa1111' })).status).toBe(400);
    const res = await object.fetch(new Request(URL));
    expect(res.status).toBe(405);
  });

  /* NOTHING ABOUT A PERSON, and the assertion is on the SERIALIZED bytes rather
     than on the object, matching how test/collection.test.js pins the same
     promise for localStorage. A field added to storage later shows up here as a
     failure rather than as silence. */
  it('stores nothing but a nonce, a size and timestamps', async () => {
    const { call, ctx } = queue();
    await join(call, 'aaaa1111', 250);
    await join(call, 'bbbb2222', 40);

    const stored = JSON.stringify(ctx.peek());
    for (const key of ['name', 'title', 'collection', 'team', 'ip', 'id', 'handle']) {
      expect(stored).not.toContain(`"${key}"`);
    }
  });

  /* Never sent back out, exactly as the room's seat claim is never sent back
     out. The other player learns where to go and how big your collection is —
     never which browser you are. */
  it('never returns the other side ticket', async () => {
    const { call } = queue();
    await join(call, 'aaaa1111');
    const b = await join(call, 'bbbb2222');
    expect(JSON.stringify(b)).not.toContain('aaaa1111');
  });

  /* A shared fixture with no life of its own should clean up after going quiet,
     not after having existed for a while — so unlike the room's alarm, this one
     moves forward on every write. */
  it('pushes its idle alarm forward on every write', async () => {
    const { call, ctx } = queue();
    await join(call, 'aaaa1111');
    const first = ctx.alarmAt();
    expect(first).toBeGreaterThan(Date.now());

    ctx.storage.setAlarm(first - 1000);
    await call({ op: 'poll', ticket: 'aaaa1111' });
    expect(ctx.alarmAt()).toBeGreaterThan(first - 1000);
  });
});

/* ── THE HANDOFF: queue -> room, driven end to end ─────────────────────────
   The queue and the room are separate objects with separate storage, and the
   claim that ties them together is not visible in either file on its own: that
   the seat the queue assigns is the seat the room's protocol expects, and that
   between the two of them BOTH sides end up knowing the other's collection
   size. Get the seats backwards and nothing throws — the lobby simply never
   opens, which is the exact failure mode this project has now shipped twice.

   So this drives a whole random match through both objects with no client in
   between: pair, accept, enter, lock. If the mapping in queue.js's `join` ever
   stops agreeing with the mapping in index.js's ops, it fails here rather than
   on somebody's phone. */
describe('the handoff from queue to room', () => {
  it('pairs two strangers into a room that reaches the build phase', async () => {
    const q = queue();
    const r = room();

    await join(q.call, 'aaaa1111', 900);
    const b = await join(q.call, 'bbbb2222', 30);
    const a = await q.call({ op: 'poll', ticket: 'aaaa1111' });

    /* The joiner took the defender's seat, so the joiner sends `accept` —
       exactly what a defender pasting a code does. */
    expect(b.side).toBe('b');
    const afterAccept = await r.call({ op: 'accept', cs: 30, claim: 'seatb0001' });
    expect(afterAccept.accepted).toBe(true);
    expect(afterAccept.lobbyAt).toBeGreaterThan(0);

    /* The waiter took the challenger's seat and has nothing to send — it reads
       the room until the accept shows up, which is what its screen does. */
    expect(a.side).toBe('a');
    const seenByA = await r.call(null);
    expect(seenByA.accepted).toBe(true);

    /* Through the lobby. The build clock is stamped only when a single read
       sees both flags — the property the Durable Object migration bought. */
    expect((await r.call({ op: 'enter', side: 'b' })).buildStartAt).toBe(null);
    expect((await r.call({ op: 'enter', side: 'a' })).buildStartAt).toBeGreaterThan(0);

    await r.call({ op: 'lock', side: 'a', team: TEAM });
    const both = await r.call({ op: 'lock', side: 'b', team: TEAM });
    expect(both.bothAt).toBeGreaterThan(0);
  });

  /* THE HOLE THIS FEATURE HAD TO CLOSE. The room carries `csB` and nothing
     else — a challenger's size reaches the defender inside the CODE, and a
     random match has no code. So side 'b' has to get it from the queue and side
     'a' from the room, and only both together make the fairness gate work at
     all. `fairnessFor` reads exactly these two places. */
  it('leaves both sides knowing the other collection size', async () => {
    const q = queue();
    const r = room();

    await join(q.call, 'aaaa1111', 900);
    const b = await join(q.call, 'bbbb2222', 30);
    const a = await q.call({ op: 'poll', ticket: 'aaaa1111' });

    const roomState = await r.call({ op: 'accept', cs: 30, claim: 'seatb0001' });

    /* Side 'a' reads the room, exactly as it does for a friend challenge. */
    expect(roomState.csB).toBe(30);
    /* Side 'b' reads what the queue handed it, standing in for the challenge
       code's `collectionSize`. */
    expect(b.theirCs).toBe(900);
    /* And the numbers are the two real collections, not one of them twice. */
    expect(a.theirCs).toBe(30);
  });

  /* A random pairing must be as unreachable as a friend match. The room id is
     the whole of what protects a match in progress in both flows — a hash of a
     code there, 16 random bytes here. */
  it('mints a room a stranger could not guess or collide with', async () => {
    const q = queue();
    const rooms = new Set();
    for (let i = 0; i < 40; i++) {
      /* Zero-PADDED, not `padEnd`ed. The first cut of this used
         `` `w${i}`.padEnd(8, '0') `` and reported 37 rooms out of 40 — which
         looked exactly like the room minter colliding and was not: `w1` and
         `w10` both pad to `w1000000`, so the loop was re-using tickets, and
         the queue correctly answered the second one with the pairing the first
         already had. A false alarm worth leaving a note about, since the
         behaviour it accidentally exercised is the one that stops a dropped
         response from stranding a partner. */
      const n = String(i).padStart(4, '0');
      await join(q.call, `wait${n}`);
      const paired = await join(q.call, `join${n}`);
      rooms.add(paired.room);
    }
    expect(rooms.size).toBe(40);
  });
});
