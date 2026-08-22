/* The match room as a Durable Object — workers/match-room/src/index.js.

   The protocol logic MOVED here on 2026-08-17, so its tests move with it. The
   rules being pinned are the same ones test/room.test.js pins for the KV
   endpoint, and for the same stated reason: this endpoint's seat rules reached
   production wrong twice, in a failure mode nobody could see from the outside.

   A Durable Object takes its context as a constructor parameter, so a Map
   behind `storage` is a complete one — no wrangler, no miniflare, no network.
   Exactly the trick room.test.js uses on `env`, and the pull engine uses on
   `rng`. */

import { describe, it, expect } from 'vitest';
import { MatchRoom } from '../workers/match-room/src/index.js';

const ROOM_URL = 'https://example.test/api/ready/testroom1234';

/* A stand-in for the Durable Object storage API. Only the five methods the
   object actually calls, so a sixth appearing in the source shows up here as a
   failure rather than as silence. */
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
    peek: () => store.get('room'),
    alarmAt: () => alarm,
  };
}

function room() {
  const ctx = fakeCtx();
  const object = new MatchRoom(ctx);
  const call = async body => {
    const request = body
      ? new Request(ROOM_URL, { method: 'POST', body: JSON.stringify(body) })
      : new Request(ROOM_URL);
    const res = await object.fetch(request);
    return { status: res.status, ...(await res.json()) };
  };
  return { call, ctx, object };
}

const TEAM = Array.from({ length: 5 }, (_, i) => ({ id: `UC${i}`, title: `Creator ${i}` }));

describe('the match room (Durable Object)', () => {
  it('starts the build clock only when BOTH sides are through the lobby', async () => {
    const { call } = room();
    expect((await call({ op: 'accept', cs: 10, claim: 'seatb0001' })).buildStartAt).toBe(null);
    expect((await call({ op: 'enter', side: 'b' })).buildStartAt).toBe(null);
    expect((await call({ op: 'enter', side: 'a' })).buildStartAt).toBeGreaterThan(0);
  });

  /* ── THE BUG THIS WHOLE REWRITE EXISTS FOR ────────────────────────────────
     On KV this is where a cross-network match died. Each `enter` was a
     read-modify-write on one edge-cached key, so the second side read a room
     from before the first side's write and put it back with the first side's
     flag CLEARED. `buildStartAt` needs one read that sees both flags, and no
     edge could produce one until its 60-second cache expired.

     Inside a Durable Object the two ops are serialized against one strongly
     consistent store, so the only thing left to assert is the invariant that
     the clobber violated: entering does not disturb the other side's entry,
     in either order. */
  it('never lets one side\'s entry erase the other\'s — in either order', async () => {
    for (const [first, second] of [['a', 'b'], ['b', 'a']]) {
      const { call } = room();
      await call({ op: 'accept', cs: 10, claim: 'seatb0001' });
      await call({ op: 'enter', side: first });
      const both = await call({ op: 'enter', side: second });
      expect(both.enteredA).toBe(true);
      expect(both.enteredB).toBe(true);
      expect(both.buildStartAt).toBeGreaterThan(0);
    }
  });

  it('stamps the build clock once and never moves it', async () => {
    const { call } = room();
    await call({ op: 'accept', cs: 10, claim: 'seatb0001' });
    await call({ op: 'enter', side: 'a' });
    const first = (await call({ op: 'enter', side: 'b' })).buildStartAt;
    /* A re-assert from a client that missed the response must not restart the
       shared 30-second clock under the other player. */
    expect((await call({ op: 'enter', side: 'a' })).buildStartAt).toBe(first);
  });

  describe('the defender seat', () => {
    it('is held by the first browser to accept', async () => {
      const { call } = room();
      await call({ op: 'accept', cs: 10, claim: 'firstseat1' });
      expect((await call({ op: 'accept', cs: 40, claim: 'secondseat' })).seatTaken).toBe(true);
    });

    it('is not disturbed by the second one — no write, so the running match survives', async () => {
      const { call } = room();
      await call({ op: 'accept', cs: 10, claim: 'firstseat1' });
      await call({ op: 'enter', side: 'b' });
      await call({ op: 'accept', cs: 40, claim: 'secondseat' });
      const state = await call();
      expect(state.csB).toBe(10);          // not overwritten by the intruder's 40
      expect(state.enteredB).toBe(true);   // and their progress is untouched
    });

    it('lets the SAME browser accept again — a double-click is not a second person', async () => {
      const { call } = room();
      await call({ op: 'accept', cs: 10, claim: 'firstseat1' });
      expect((await call({ op: 'accept', cs: 10, claim: 'firstseat1' })).seatTaken).toBeFalsy();
    });

    it('lets a claimless client through, so the flow that shipped before it still works', async () => {
      const { call } = room();
      expect((await call({ op: 'accept', cs: 10 })).seatTaken).toBeFalsy();
      expect((await call({ op: 'accept', cs: 10 })).seatTaken).toBeFalsy();
    });

    /* It names a seat, not a person, and the other player has no business
       receiving it — the room's whole privacy claim is that it carries nothing
       anyone could hold on to. */
    it('never appears in what the room sends back', async () => {
      const { call } = room();
      await call({ op: 'accept', cs: 10, claim: 'firstseat1' });
      expect('clientB' in (await call())).toBe(false);
      expect('expiresAt' in (await call())).toBe(false);
    });
  });

  it('stamps bothAt when the second side locks, and refuses a malformed team', async () => {
    const { call } = room();
    await call({ op: 'accept', cs: 10, claim: 'seatb0001' });
    expect((await call({ op: 'lock', side: 'a', team: TEAM })).bothAt).toBe(null);
    expect((await call({ op: 'lock', side: 'b', team: TEAM.slice(1) })).status).toBe(400);
    const both = await call({ op: 'lock', side: 'b', team: TEAM });
    expect(both.bothAt).toBeGreaterThan(0);
    /* Locking heals a lobby step it never sent — a phone changing networks
       between reading a code and pasting it is normal, not exceptional. */
    expect(both.enteredA && both.enteredB).toBe(true);
  });

  it('refuses a duplicated creator in a locked team', async () => {
    const { call } = room();
    const dupe = [TEAM[0], TEAM[0], TEAM[1], TEAM[2], TEAM[3]];
    expect((await call({ op: 'lock', side: 'a', team: dupe })).status).toBe(400);
  });

  it('tells the other side a bail happened, and refuses a nonsense op or body', async () => {
    const { call } = room();
    expect((await call({ op: 'bail', side: 'b' })).bailed).toBe('b');
    expect((await call({ op: 'enter' })).status).toBe(400);        // no side
    expect((await call({ op: 'sudo' })).status).toBe(400);         // no such op
  });

  /* ── THE TEN MINUTES, WHICH ARE NOW THIS OBJECT'S OWN JOB ─────────────────
     KV expired a room for us via `expirationTtl`. A Durable Object has no TTL,
     so without these two the rooms would simply accumulate forever — every
     match ever played, kept. */
  describe('expiry', () => {
    it('reads as an empty room once its ten minutes are up', async () => {
      const { call, ctx } = room();
      await call({ op: 'accept', cs: 10, claim: 'seatb0001' });
      expect((await call()).accepted).toBe(true);
      const stored = ctx.peek();
      stored.expiresAt = Date.now() - 1;
      expect((await call()).accepted).toBe(false);
    });

    it('arms an alarm once, and does not push it forward on later writes', async () => {
      const { call, ctx } = room();
      await call({ op: 'accept', cs: 10, claim: 'seatb0001' });
      const armed = ctx.alarmAt();
      expect(armed).toBeGreaterThan(Date.now());
      await call({ op: 'enter', side: 'b' });
      await call({ op: 'enter', side: 'a' });
      expect(ctx.alarmAt()).toBe(armed);
    });

    it('deletes everything when the alarm fires', async () => {
      const { call, ctx, object } = room();
      await call({ op: 'accept', cs: 10, claim: 'seatb0001' });
      await object.alarm();
      expect(ctx.peek()).toBeUndefined();
      expect((await call()).accepted).toBe(false);
    });
  });
});
