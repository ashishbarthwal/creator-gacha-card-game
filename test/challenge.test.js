/* test/challenge — the battle code. What is pinned here is the property the
   whole cross-window feature rests on: two windows that never share storage
   must be able to replay the SAME fight from a pasted string.

   So the load-bearing test is not the round trip, it is `resolveBattle` run
   twice over independently decoded teams and asserted equal event-for-event.
   A round trip that preserved the cards but lost the seed or the pinned clock
   would pass a shape test and still produce two different battles. */

import { describe, it, expect } from 'vitest';
import {
  encodeCode, decodeCode, makeChallenge, makeResult, echoMatches,
  fingerprint, newSeed, ChallengeError, CODE_VERSION, KIND,
} from '../src/engine/challenge.js';
import { battle, TEAM_SIZE } from '../src/engine/battle.js';

const NOW = Date.UTC(2026, 7, 1);

function channel(i, over = {}) {
  return {
    id: `UC_${i}`,
    title: `Creator ${i}`,
    handle: `@creator${i}`,
    avatarUrl: `https://yt3.ggpht.com/ytc/fake${i}=s800-c-k-c0x00ffffff-no-rj`,
    subscriberCount: String(100000 * (i + 1)),
    hiddenSubscriberCount: false,
    viewCount: String(50000000 * (i + 1)),
    videoCount: String(120 + i * 37),
    publishedAt: `201${i % 10}-05-20T12:44:01Z`,
    element: ['Gaming', 'Tech', 'Knowledge', 'Music', 'Comedy', 'Lifestyle'][i % 6],
    ...over,
  };
}

const teamOf = (from = 0) => Array.from({ length: TEAM_SIZE }, (_, i) => channel(from + i));

/* mulberry32 — the same generator the UI seeds a fight with. Duplicated here
   rather than imported because the point of the test is that BOTH SIDES derive
   an identical stream from the shared seed, and a shared import would hide a
   seed that failed to travel. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('encode/decode round trip', () => {
  it('restores every field the battle engine reads', async () => {
    const team = teamOf();
    const decoded = await decodeCode(await makeChallenge({ team, name: 'Ash', seed: 12345, now: NOW }));
    expect(decoded.kind).toBe(KIND.challenge);
    expect(decoded.version).toBe(CODE_VERSION);
    expect(decoded.now).toBe(NOW);
    expect(decoded.seed).toBe(12345);
    expect(decoded.name).toBe('Ash');
    expect(decoded.teamA).toHaveLength(TEAM_SIZE);
    for (const [i, ch] of decoded.teamA.entries()) {
      expect(ch).toMatchObject({
        id: team[i].id,
        title: team[i].title,
        subscriberCount: team[i].subscriberCount,
        viewCount: team[i].viewCount,
        videoCount: team[i].videoCount,
        publishedAt: team[i].publishedAt,
        element: team[i].element,
      });
    }
  });

  it('restores the avatar URL through the prefix folding', async () => {
    /* The one lossy-looking step in the format. A sigil that failed to unfold
       would leave every opponent card with a broken portrait, which is a bug
       you notice late and debug in the wrong file. */
    const team = teamOf();
    const decoded = await decodeCode(await makeChallenge({ team, now: NOW }));
    expect(decoded.teamA[0].avatarUrl).toBe(team[0].avatarUrl);
    expect(decoded.teamA[0].avatarUrl.startsWith('https://yt3.ggpht.com/')).toBe(true);
  });

  it('carries a non-Latin-1 channel title intact', async () => {
    /* btoa alone throws on these, which is the whole reason the codec encodes
       to UTF-8 bytes first. A large share of real YouTube is not ASCII. */
    const team = teamOf();
    team[0] = channel(0, { title: '日本語チャンネル — Ω ✨' });
    const decoded = await decodeCode(await makeChallenge({ team, now: NOW }));
    expect(decoded.teamA[0].title).toBe('日本語チャンネル — Ω ✨');
  });

  it('leaves a non-YouTube avatar URL alone', async () => {
    const team = teamOf();
    team[0] = channel(0, { avatarUrl: 'https://example.test/pic.png' });
    const decoded = await decodeCode(await makeChallenge({ team, now: NOW }));
    expect(decoded.teamA[0].avatarUrl).toBe('https://example.test/pic.png');
  });

  it('omits an absent publishedAt/element rather than inventing one', async () => {
    const team = teamOf();
    team[0] = channel(0, { publishedAt: undefined, element: undefined });
    const decoded = await decodeCode(await makeChallenge({ team, now: NOW }));
    expect(decoded.teamA[0]).not.toHaveProperty('publishedAt');
    expect(decoded.teamA[0]).not.toHaveProperty('element');
  });
});

/* ── v2: A CHALLENGE MAY CARRY NO TEAM (item 9) ─────────────────────────────
   The wire-format half of "send a challenge without building your team
   first". What is pinned here is the decode contract only — the UI decides
   WHEN to send one of these, this file only has to make sure it round-trips
   honestly and that nothing downstream can mistake "no team yet" for "a team
   of zero cards" or silently invent one. */
describe('a bare challenge (no team yet)', () => {
  it('encodes and decodes with teamA as null, not an empty array or a thrown error', async () => {
    const code = await makeChallenge({ name: 'Ash', seed: 42, now: NOW });
    const decoded = await decodeCode(code);
    expect(decoded.kind).toBe(KIND.challenge);
    expect(decoded.teamA).toBeNull();
  });

  it('an explicit empty array behaves the same as omitting the team entirely', async () => {
    const code = await makeChallenge({ team: [], name: 'Ash', seed: 42, now: NOW });
    const decoded = await decodeCode(code);
    expect(decoded.teamA).toBeNull();
  });

  it('every other field still round-trips on a bare challenge', async () => {
    const decoded = await decodeCode(await makeChallenge({ name: 'Ash', seed: 777, now: NOW }));
    expect(decoded.now).toBe(NOW);
    expect(decoded.seed).toBe(777);
    expect(decoded.name).toBe('Ash');
  });

  it('a RESULT code still requires a full five — bareness is a challenge-only allowance', async () => {
    await expect(encodeCode({ kind: KIND.result, now: NOW, seed: 1, name: '', teamA: [], teamB: teamOf() })
      .then(decodeCode)).rejects.toBeInstanceOf(ChallengeError);
  });

  it('a team of the wrong non-zero length is still rejected on a challenge', async () => {
    await expect(encodeCode({ kind: KIND.challenge, now: NOW, seed: 1, name: '', teamA: teamOf().slice(0, 3) })
      .then(decodeCode)).rejects.toBeInstanceOf(ChallengeError);
  });

  it('makeResult refuses to reply to a challenge whose team was never committed', async () => {
    const bare = await decodeCode(await makeChallenge({ name: 'Ash', seed: 1, now: NOW }));
    await expect(makeResult({ challenge: bare, team: teamOf(20), name: 'B' })).rejects.toBeInstanceOf(ChallengeError);
  });
});

/* ── v2: EVERY CODE CARRIES A COLLECTION SIZE (items 15-27's wire half) ───── */
describe('collection size travels with the code', () => {
  it('round-trips on a challenge', async () => {
    const code = await makeChallenge({ team: teamOf(), name: 'Ash', seed: 1, now: NOW, collectionSize: 47 });
    expect((await decodeCode(code)).collectionSize).toBe(47);
  });

  it('round-trips on a result', async () => {
    const challenge = await decodeCode(await makeChallenge({ team: teamOf(0), seed: 1, now: NOW }));
    const result = await makeResult({ challenge, team: teamOf(20), name: 'B', collectionSize: 12 });
    expect((await decodeCode(result)).collectionSize).toBe(12);
  });

  it('zero is a real, distinct value from absent', async () => {
    const withZero = await decodeCode(await makeChallenge({ team: teamOf(), seed: 1, now: NOW, collectionSize: 0 }));
    expect(withZero.collectionSize).toBe(0);
  });

  it('is null, not 0, when the sender omitted it entirely', async () => {
    const decoded = await decodeCode(await makeChallenge({ team: teamOf(), seed: 1, now: NOW }));
    expect(decoded.collectionSize).toBeNull();
  });

  it('a non-numeric value is treated as absent rather than corrupting the decode', async () => {
    for (const bad of [NaN, 'forty-seven', undefined]) {
      const code = await encodeCode({ kind: KIND.challenge, now: NOW, seed: 1, name: '', teamA: teamOf(), collectionSize: bad });
      expect((await decodeCode(code)).collectionSize).toBeNull();
    }
  });

  it('a negative value clamps to 0 rather than encoding a nonsense count', async () => {
    const code = await encodeCode({ kind: KIND.challenge, now: NOW, seed: 1, name: '', teamA: teamOf(), collectionSize: -5 });
    expect((await decodeCode(code)).collectionSize).toBe(0);
  });
});

describe('the fight replays identically on both sides', () => {
  it('two windows decoding the same result code resolve the same battle', async () => {
    /* THE LOAD-BEARING TEST. The defender's window resolves the fight from the
       teams it holds; the challenger's window resolves it from a decoded string
       and nothing else. If these two logs ever diverge, the two players are
       watching different battles and the feature is a lie. */
    const challenger = teamOf(0);
    const defender = teamOf(20);
    const seed = 987654321;

    const challengeCode = await makeChallenge({ team: challenger, name: 'A', seed, now: NOW });
    const asDefender = await decodeCode(challengeCode);

    // Defender's side: fights locally, then encodes what it fought.
    const defenderFight = battle(asDefender.teamA, defender, {
      now: asDefender.now,
      rng: mulberry32(asDefender.seed),
    });
    const resultCode = await makeResult({ challenge: asDefender, team: defender, name: 'B' });

    // Challenger's side: knows nothing but the string.
    const asChallenger = await decodeCode(resultCode);
    const challengerFight = battle(asChallenger.teamA, asChallenger.teamB, {
      now: asChallenger.now,
      rng: mulberry32(asChallenger.seed),
    });

    expect(challengerFight.winner).toBe(defenderFight.winner);
    expect(challengerFight.rounds).toBe(defenderFight.rounds);
    expect(challengerFight.survivors).toEqual(defenderFight.survivors);
    expect(challengerFight.log).toEqual(defenderFight.log);
  });

  it('a different seed produces a different fight — so the seed really travels', () => {
    /* Guards the test above from passing vacuously: if these two matched, the
       equality proven there would say nothing about the seed. */
    const a = teamOf(0);
    const b = teamOf(20);
    const one = battle(a, b, { now: NOW, rng: mulberry32(1) });
    const two = battle(a, b, { now: NOW, rng: mulberry32(2) });
    expect(one.log).not.toEqual(two.log);
  });

  it('a different pinned clock produces a different fight — so `now` really travels', () => {
    /* Channel age feeds three of the five battle axes, so two windows opening
       the same code years apart would otherwise fight different cards. */
    const a = teamOf(0);
    const b = teamOf(20);
    const one = battle(a, b, { now: NOW, rng: mulberry32(7) });
    const two = battle(a, b, { now: NOW + 6 * 365 * 24 * 3600 * 1000, rng: mulberry32(7) });
    expect(one.log).not.toEqual(two.log);
  });
});

describe('the echo catches a reply to a different challenge', () => {
  it('accepts a result that came back describing the team we sent', async () => {
    const mine = teamOf(0);
    const challenge = await decodeCode(await makeChallenge({ team: mine, seed: 5, now: NOW }));
    const result = await decodeCode(await makeResult({ challenge, team: teamOf(20) }));
    expect(echoMatches(result, mine)).toBe(true);
  });

  it('rejects a result built against somebody else’s challenge', async () => {
    const mine = teamOf(0);
    const theirs = teamOf(40);
    const other = await decodeCode(await makeChallenge({ team: theirs, seed: 5, now: NOW }));
    const result = await decodeCode(await makeResult({ challenge: other, team: teamOf(20) }));
    expect(echoMatches(result, mine)).toBe(false);
  });

  it('fingerprints slot order, because a formation is part of what was committed', () => {
    const team = teamOf();
    const swapped = [team[1], team[0], ...team.slice(2)];
    expect(fingerprint(swapped)).not.toBe(fingerprint(team));
  });
});

describe('a pasted code is a stranger’s input', () => {
  it('survives the whitespace and chatter a chat app adds', async () => {
    const code = await makeChallenge({ team: teamOf(), seed: 3, now: NOW });
    const messy = `here you go:\n\n  ${code.slice(0, 40)}\n${code.slice(40)}  \n`;
    const decoded = await decodeCode(messy);
    expect(decoded.seed).toBe(3);
  });

  it('rejects a code that is not one, with something a player can act on', async () => {
    await expect(decodeCode('hello world')).rejects.toBeInstanceOf(ChallengeError);
    await expect(decodeCode('')).rejects.toThrow(/Paste a battle code/i);
  });

  it('rejects a truncated code rather than fighting half a team', async () => {
    const code = await makeChallenge({ team: teamOf(), seed: 3, now: NOW });
    await expect(decodeCode(code.slice(0, code.length - 30))).rejects.toBeInstanceOf(ChallengeError);
  });

  it('names a version mismatch instead of failing obscurely', async () => {
    const code = await encodeCode({
      kind: KIND.challenge, now: NOW, seed: 1, name: '', teamA: teamOf(),
    });
    /* Built off the real prefix rather than a hardcoded 'CGB1.' — this test
       broke silently (matched nothing, so the "bumped" code was identical to
       the original and the assertion passed for the wrong reason) the moment
       CODE_VERSION moved to 2, and a literal is exactly how that kind of
       silent pass happens again at the next bump. */
    const bumped = code.replace(`CGB${CODE_VERSION}.`, 'CGB9.');
    await expect(decodeCode(bumped)).rejects.toThrow(/battle code/i);
  });

  it('refuses a team that is not five, and one that fields a creator twice', async () => {
    const short = await encodeCode({
      kind: KIND.challenge, now: NOW, seed: 1, name: '', teamA: teamOf().slice(0, 3),
    });
    await expect(decodeCode(short)).rejects.toThrow(/full team/i);

    const dupe = teamOf();
    dupe[4] = dupe[0];
    const doubled = await encodeCode({
      kind: KIND.challenge, now: NOW, seed: 1, name: '', teamA: dupe,
    });
    await expect(decodeCode(doubled)).rejects.toThrow(/same creator twice/i);
  });
});

describe('the code stays small enough to paste', () => {
  it('encodes a five-card challenge in well under 2000 characters', async () => {
    const code = await makeChallenge({ team: teamOf(), name: 'Ash', now: NOW });
    expect(code.length).toBeLessThan(2000);
  });

  it('a result carrying both teams still fits', async () => {
    const challenge = await decodeCode(await makeChallenge({ team: teamOf(), now: NOW }));
    const code = await makeResult({ challenge, team: teamOf(20), name: 'B' });
    expect(code.length).toBeLessThan(3000);
  });
});

describe('newSeed', () => {
  it('returns a uint32 from an injected rng, so a challenge is reproducible', () => {
    expect(newSeed(() => 0)).toBe(0);
    expect(newSeed(() => 0.5)).toBe(0x80000000);
    expect(newSeed(() => 0.9999999)).toBeLessThanOrEqual(0xFFFFFFFF);
  });
});
