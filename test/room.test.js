/* functions/api/ready/[room] — the public door to the match room.

   ── WHAT IS LEFT TO TEST HERE, AND WHAT MOVED ─────────────────────────────
   This file used to pin the whole room protocol, because this file used to BE
   the room: a KV implementation with seat rules that reached production wrong
   twice, in a failure mode nobody could see from the outside.

   The protocol moved into workers/match-room/src/index.js on 2026-08-17 and its
   tests moved with it (test/match-room.test.js). The KV implementation was
   deleted on 2026-08-22, once a real phone-on-mobile-data vs PC-on-WiFi match
   had been played on the Durable Object — which was always the stated condition
   for retiring it. Those tests went with the code they described; keeping them
   would have meant asserting the behaviour of a backend that no longer exists,
   which is worse than no test.

   So what remains is what this file still DOES: find the binding, validate the
   room id, and route. All three have failed in production at least once, and
   none of them is visible from outside when it does — which is exactly why they
   are worth pinning even though the file is now forty lines of logic. */

import { describe, it, expect } from 'vitest';
import { onRequest } from '../functions/api/ready/[room].js';

const ROOM = 'testroom1234';

/* An `env` holding a fake Durable Object namespace, and a `seen` object
   recording what the proxy did with it. */
function withDo(extra = {}) {
  const seen = {};
  const env = {
    ROOM: {
      idFromName: name => { seen.name = name; return { name }; },
      get: id => ({
        fetch: async () => {
          seen.reached = id.name;
          return new Response(JSON.stringify({ enabled: true, viaDurableObject: true }), {
            headers: { 'content-type': 'application/json' },
          });
        },
      }),
    },
    ...extra,
  };
  return { env, seen };
}

const call = (env, room = ROOM) => onRequest({
  request: new Request(`https://example.test/api/ready/${room}`),
  env,
  params: { room },
});

describe('the match-room endpoint', () => {
  /* One object per room id, derived from the id and nothing else — that is what
     puts both players on the same instance however far apart they are, and it
     is the whole of why the cross-edge clobber cannot recur. */
  it('routes to the object named by the room id', async () => {
    const { env, seen } = withDo();
    await call(env, 'someotherroom99');
    expect(seen.name).toBe('someotherroom99');
  });

  it('returns what the object answered', async () => {
    const { env, seen } = withDo();
    const res = await call(env);
    expect(seen.reached).toBe(ROOM);
    expect((await res.json()).viaDurableObject).toBe(true);
  });

  /* A REAL FAILURE, NOT A HYPOTHETICAL ONE. The binding was created through the
     dashboard as `"ROOM "` — one trailing space, invisible in every screen that
     displays it and faithfully recorded that way in the Pages deployment
     record. `env.ROOM` was undefined and nothing anywhere reported a problem;
     the endpoint simply said no lobby was available. It is STILL named that in
     production, which is precisely why this test is not decoration. */
  it('finds the object binding even when its name carries stray whitespace', async () => {
    const { env, seen } = withDo();
    const res = await call({ 'ROOM ': env.ROOM });
    expect(seen.reached).toBe(ROOM);
    expect((await res.json()).viaDurableObject).toBe(true);
  });

  /* What the lookup needs is not "something called ROOM" but "something that
     can route to a Durable Object" — otherwise a KV namespace that happened to
     be named ROOM would be picked up and then crash on first use. */
  it('ignores a same-named binding that cannot route to an object', async () => {
    const res = await call({ ROOM: { get: () => null, put: () => {} } });
    expect((await res.json()).enabled).toBe(false);
  });

  /* Settled rather than an error, and data/presence.js depends on the
     difference: `enabled:false` means stop asking and fall back, where a failed
     request means ask again. Collapsing the two is what once made challenging
     from a phone impossible. */
  it('answers enabled:false rather than failing when nothing is bound', async () => {
    const res = await call({});
    expect(res.status).toBe(200);
    expect((await res.json()).enabled).toBe(false);
  });

  /* Checked BEFORE the object is addressed, so a malformed id can never cause
     an instance to be created for it. */
  it('validates the room id before reaching the object', async () => {
    const { env, seen } = withDo();
    const res = await call(env, 'no');
    expect(res.status).toBe(400);
    expect(seen.reached).toBeUndefined();
  });

  it('rejects a room id outside the base36 alphabet', async () => {
    const { env, seen } = withDo();
    const res = await call(env, 'not-a-room!');
    expect(res.status).toBe(400);
    expect(seen.reached).toBeUndefined();
  });

  /* The KV path is gone, so a `READY` namespace still bound to the project must
     not resurrect anything — it is now an unread binding and nothing more. */
  it('does not fall back to KV when only READY is bound', async () => {
    const res = await call({ READY: { get: async () => null, put: async () => {} } });
    expect((await res.json()).enabled).toBe(false);
  });
});
