/* data/presence — the client for the two server endpoints.

   ── WHY THIS FILE EXISTS NOW AND NOT BEFORE ───────────────────────────────
   It was written after a bug that cost a whole round of manual testing, and the
   bug is worth stating because the shape of it is general.

   The random-opponent queue was built to reuse `call`, the room's client. `call`
   ends by testing the ROOM's `enabled` field and then rebuilding the ROOM's
   fields by name. The queue answers `{"status":"waiting"}` — a perfectly good
   answer with no `enabled` field — so `call` read it as "there is no queue" and
   returned the settled OFF sentinel. Both players sat on a screen saying online
   matchmaking was unavailable while the endpoint behind it was answering
   correctly to every curl.

   NOTHING ON THE SERVER WAS WRONG, which is exactly why it survived: the queue
   object had 22 passing tests, the Durable Object bindings were connected, and
   the endpoint returned the right JSON. The defect lived entirely in the
   translation layer, and the translation layer was the one thing with no test.

   So what is pinned here is not "the server answers correctly" — that is
   test/queue.test.js's job — but "the client does not throw a correct answer
   away". Both endpoints, because the fault handling is shared and the success
   shapes deliberately are not. */

import { describe, it, expect, afterEach } from 'vitest';
import { joinQueue, pollQueue, leaveQueue, checkRoom, presenceOff } from '../src/data/presence.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/* Stand in for one server answer. `status` is the HTTP status; `body` is what
   the endpoint returns. */
function serving(body, status = 200) {
  globalThis.fetch = async () => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function refusing() {
  globalThis.fetch = async () => { throw new TypeError('network'); };
}

describe('the queue client', () => {
  /* THE REGRESSION. A queue answer carries a status and no `enabled` flag —
     reading it through the room's client turned it into "no queue". */
  it('reads a waiting answer as waiting, not as a missing queue', async () => {
    serving({ status: 'waiting', waitingSince: 1234 });
    const res = await joinQueue('aaaa1111', 40);

    expect(res.enabled).toBe(true);
    expect(presenceOff(res)).toBe(false);
    expect(res.status).toBe('waiting');
  });

  /* THE OTHER HALF OF THE SAME BUG, and the more dangerous one: even had the
     `enabled` check passed, the room's client rebuilds ROOM fields by name — so
     the room id, the seat and the seed would every one have been dropped, and
     the two browsers would have walked into different fights. */
  it('carries every field a pairing needs through intact', async () => {
    serving({ status: 'matched', room: 'abc123xyz789', side: 'b', seed: 2545277814, now: 1787340873006, theirCs: 40 });
    const res = await pollQueue('bbbb2222');

    expect(res.status).toBe('matched');
    expect(res.room).toBe('abc123xyz789');
    expect(res.side).toBe('b');
    expect(res.seed).toBe(2545277814);
    expect(res.now).toBe(1787340873006);
    expect(res.theirCs).toBe(40);
  });

  it('reports a missing binding as settled off', async () => {
    serving({ enabled: false, reason: 'off' });
    expect(presenceOff(await joinQueue('aaaa1111', 40))).toBe(true);
  });

  /* A 404 means the Function is not deployed at all — a static host, or a dev
     server that cannot run Pages Functions. Settled, not transient: the same
     distinction the room draws, and for the same reason. */
  it('reports a 404 as settled off rather than as a retryable failure', async () => {
    serving({}, 404);
    expect(presenceOff(await pollQueue('aaaa1111'))).toBe(true);
  });

  /* And the opposite: a dropped request says NOTHING about whether a queue
     exists, so a caller must keep trying. Collapsing these two is what once
     made challenging from a phone impossible. */
  it('reports a dropped request as retryable, never as off', async () => {
    refusing();
    const res = await pollQueue('aaaa1111');
    expect(res.enabled).toBe(false);
    expect(presenceOff(res)).toBe(false);
  });

  it('refuses to pass through a malformed seat or seed', async () => {
    serving({ status: 'matched', room: 'abc123xyz789', side: 'z', seed: 'nope', theirCs: -4 });
    const res = await leaveQueue('aaaa1111');

    expect(res.side).toBe(null);
    expect(res.seed).toBe(0);
    expect(res.theirCs).toBe(null);
  });
});

describe('the match-room client, unchanged by the split', () => {
  /* `transport` was extracted out from under `call` to fix the queue. These
     pin that the room's own reading is exactly what it was — the extraction
     had to be invisible to this side. */
  it('still rebuilds a room answer by name', async () => {
    serving({
      enabled: true, accepted: true, lobbyAt: 5, buildStartAt: 9, csB: 12,
      enteredA: true, enteredB: false, bailed: 'b', lockedA: true, lockedB: false,
      teamA: [1, 2], teamB: null, bothAt: 3, now: 77, gateMs: 10000, buildMs: 30000,
      countdownMs: 3000, seatTaken: true,
      /* Not a room field. Must not survive — the rebuild is a positive
         allowlist so the server cannot grow the client an attribute. */
      backend: 'do', sneaky: 'nope',
    });
    const res = await checkRoom('testroom1234');

    expect(res.accepted).toBe(true);
    expect(res.csB).toBe(12);
    expect(res.bailed).toBe('b');
    expect(res.seatTaken).toBe(true);
    expect(res.sneaky).toBeUndefined();
    expect(res.backend).toBeUndefined();
  });

  it('still reads enabled:false as settled off', async () => {
    serving({ enabled: false });
    expect(presenceOff(await checkRoom('testroom1234'))).toBe(true);
  });

  it('still reads a 5xx as retryable', async () => {
    serving({}, 503);
    const res = await checkRoom('testroom1234');
    expect(res.enabled).toBe(false);
    expect(presenceOff(res)).toBe(false);
  });
});
