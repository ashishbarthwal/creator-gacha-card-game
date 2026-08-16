/* The match room — functions/api/ready/[room].js.

   The first test in this repo to touch `functions/`, and it earns the exception
   for one reason: this endpoint's seat rules reached production wrong twice, in
   a failure mode nobody could see from the outside (two players both waiting on
   a lobby that could never start). The rest of the file is deliberately dumb —
   read, merge, write — but WHO may write WHAT is a rule, and a rule is exactly
   what a test is for.

   No wrangler, no network, no KV: the handler takes its environment as a
   parameter, so a Map behind `get`/`put` is a complete one. Same trick as
   injecting `rng` into the pull engine. */

import { describe, it, expect } from 'vitest';
import { onRequest } from '../functions/api/ready/[room].js';

const ROOM = 'testroom1234';

function room() {
  const store = new Map();
  const env = { READY: { get: k => store.get(k) ?? null, put: (k, v) => void store.set(k, v) } };
  return async function call(body, id = ROOM) {
    const url = `https://example.test/api/ready/${id}`;
    const request = body
      ? new Request(url, { method: 'POST', body: JSON.stringify(body) })
      : new Request(url);
    const res = await onRequest({ request, env, params: { room: id } });
    return { status: res.status, ...(await res.json()) };
  };
}

const TEAM = Array.from({ length: 5 }, (_, i) => ({ id: `UC${i}`, title: `Creator ${i}` }));

describe('the match room', () => {
  it('starts the build clock only when BOTH sides are through the lobby', async () => {
    const call = room();
    expect((await call({ op: 'accept', cs: 10, claim: 'seatb0001' })).buildStartAt).toBe(null);
    expect((await call({ op: 'enter', side: 'b' })).buildStartAt).toBe(null);
    expect((await call({ op: 'enter', side: 'a' })).buildStartAt).toBeGreaterThan(0);
  });

  /* THE BUG THIS FILE EXISTS FOR. A challenge code is a string, so two people
     can paste the same one. Before the seat was claimable both took side B,
     side A stayed empty, and `buildStartAt` — which needs both — never landed:
     two players stuck on "LOBBY — 00:00" until the room expired. */
  describe('the defender seat', () => {
    it('is held by the first browser to accept', async () => {
      const call = room();
      await call({ op: 'accept', cs: 10, claim: 'firstseat1' });
      const second = await call({ op: 'accept', cs: 40, claim: 'secondseat' });
      expect(second.seatTaken).toBe(true);
    });

    it('is not disturbed by the second one — no write, so the running match survives', async () => {
      const call = room();
      await call({ op: 'accept', cs: 10, claim: 'firstseat1' });
      await call({ op: 'enter', side: 'b' });
      await call({ op: 'accept', cs: 40, claim: 'secondseat' });
      const state = await call();
      expect(state.csB).toBe(10);          // not overwritten by the intruder's 40
      expect(state.enteredB).toBe(true);   // and their progress is untouched
    });

    it('lets the SAME browser accept again — a double-click is not a second person', async () => {
      const call = room();
      await call({ op: 'accept', cs: 10, claim: 'firstseat1' });
      expect((await call({ op: 'accept', cs: 10, claim: 'firstseat1' })).seatTaken).toBeFalsy();
    });

    it('lets a claimless client through, so the flow that shipped before it still works', async () => {
      const call = room();
      expect((await call({ op: 'accept', cs: 10 })).seatTaken).toBeFalsy();
      expect((await call({ op: 'accept', cs: 10 })).seatTaken).toBeFalsy();
      const claimed = room();
      await claimed({ op: 'accept', cs: 10, claim: 'firstseat1' });
      expect((await claimed({ op: 'accept', cs: 10 })).seatTaken).toBeFalsy();
    });

    /* It names a seat, not a person, and the other player has no business
       receiving it — the room's whole privacy claim is that it carries nothing
       anyone could hold on to. */
    it('never appears in what the room sends back', async () => {
      const call = room();
      await call({ op: 'accept', cs: 10, claim: 'firstseat1' });
      expect('clientB' in (await call())).toBe(false);
    });
  });

  it('stamps bothAt when the second side locks, and refuses a malformed team', async () => {
    const call = room();
    await call({ op: 'accept', cs: 10, claim: 'seatb0001' });
    expect((await call({ op: 'lock', side: 'a', team: TEAM })).bothAt).toBe(null);
    expect((await call({ op: 'lock', side: 'b', team: TEAM.slice(1) })).status).toBe(400);
    const both = await call({ op: 'lock', side: 'b', team: TEAM });
    expect(both.bothAt).toBeGreaterThan(0);
    /* Locking heals a lobby step it never sent — a phone changing networks
       between reading a code and pasting it is normal, not exceptional. */
    expect(both.enteredA && both.enteredB).toBe(true);
  });

  it('tells the other side a bail happened, and refuses a nonsense room or op', async () => {
    const call = room();
    expect((await call({ op: 'bail', side: 'b' })).bailed).toBe('b');
    expect((await call({ op: 'enter' })).status).toBe(400);        // no side
    expect((await call({ op: 'sudo' })).status).toBe(400);         // no such op
    expect((await call(null, 'no')).status).toBe(400);             // room id too short
  });

  /* Missing binding is a 200 saying `enabled:false`, never an error: the client
     reads it as "no match rooms today" and falls back, which is what keeps the
     game playable with no server at all (locked decision 3). */
  it('answers enabled:false rather than failing when the namespace is unbound', async () => {
    const request = new Request(`https://example.test/api/ready/${ROOM}`);
    const res = await onRequest({ request, env: {}, params: { room: ROOM } });
    expect(res.status).toBe(200);
    expect((await res.json()).enabled).toBe(false);
  });
});
