/* test/collection — pins the saved collection's shape. No localStorage here:
   the browser half is src/storage.js and every path in it swallows its errors on
   purpose, so what is worth pinning is the pure round-trip.

   The two load-bearing tests: that the API key can never reach storage (a
   promise made to players in the footer), and that a corrupt saved value yields
   an empty collection rather than throwing — because one bad byte in
   localStorage must never stop the app booting. */

import { describe, it, expect } from 'vitest';
import {
  serializeCollection,
  parseCollection,
  reconcileCollection,
  COLLECTION_VERSION,
} from '../src/engine/collection.js';
import { toCard } from '../src/engine/core.js';

const NOW = Date.UTC(2026, 7, 1);

function channel(over = {}) {
  return {
    id: 'UC_a',
    title: 'A Channel',
    handle: '@achannel',
    avatarUrl: 'https://yt3.example/photo.jpg',
    subscriberCount: '2000000',
    hiddenSubscriberCount: false,
    viewCount: '900000000',
    videoCount: '400',
    country: 'US',
    ...over,
  };
}

const owned = (ch, count = 1) => [String(ch.id), { card: toCard(ch), count }];

describe('serializeCollection', () => {
  it('stores the channel snapshot and the count, never the derived card', () => {
    /* rarity/atk/def are computed by pure functions. Persisting them would let a
       saved rarity one day disagree with the code that computes rarity. */
    const out = serializeCollection(new Map([owned(channel(), 3)]), { now: NOW });
    expect(out.version).toBe(COLLECTION_VERSION);
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0].count).toBe(3);
    expect(out.entries[0]).not.toHaveProperty('rarity');
    expect(out.entries[0].channel).not.toHaveProperty('atk');
  });

  it('keeps a positive allowlist of channel fields — country never persists', () => {
    const out = serializeCollection(new Map([owned(channel())]), { now: NOW });
    expect(Object.keys(out.entries[0].channel).sort()).toEqual(
      ['avatarUrl', 'handle', 'hiddenSubscriberCount', 'id', 'subscriberCount', 'title', 'videoCount', 'viewCount'],
    );
    expect(JSON.stringify(out)).not.toMatch(/country|"US"/);
  });

  it('persists publishedAt and element when the channel carries them', () => {
    /* Both are battle inputs, not decoration: age drives three of the five
       battle axes and element decides every matchup. A collection that dropped
       them fought as dateless Unaligned units, which silently deletes the whole
       element layer for exactly the cards a player owns. */
    const out = serializeCollection(
      new Map([owned(channel({ publishedAt: '2010-05-20T12:44:01Z', element: 'Gaming' }))]),
      { now: NOW },
    );
    expect(out.entries[0].channel.publishedAt).toBe('2010-05-20T12:44:01Z');
    expect(out.entries[0].channel.element).toBe('Gaming');
    /* Still an allowlist — the two new fields joined it, they did not open it. */
    expect(JSON.stringify(out)).not.toMatch(/country|"US"/);
  });

  it('omits publishedAt and element rather than storing them empty', () => {
    /* An absent date and an empty one behave identically downstream, so the
       choice is about whether a stored card is honest about what is known. The
       bundled demo set genuinely has neither. */
    const out = serializeCollection(new Map([owned(channel())]), { now: NOW });
    expect(out.entries[0].channel).not.toHaveProperty('publishedAt');
    expect(out.entries[0].channel).not.toHaveProperty('element');
  });

  it('cannot carry an API key, whatever is hung off the state object', () => {
    /* The structural guarantee: storage.js only ever receives a collection, and
       a collection only ever yields channel fields and counts. */
    const collection = new Map([owned(channel())]);
    /* Deliberately too short to resemble a real Google key. The assertion below
       still checks for the real-world `AIza` prefix, so the test keeps its
       meaning without putting a key-shaped string in the repo for a scanner —
       or a reader skimming the diff — to trip over. */
    collection.apiKey = 'AIza_FAKE_never_persist';
    const json = JSON.stringify(serializeCollection(collection, { now: NOW }));
    expect(json).not.toMatch(/AIza|apiKey/);
  });

  it('omits subscriberCount for a hidden channel, matching the live API', () => {
    const hidden = channel({ hiddenSubscriberCount: true, subscriberCount: undefined });
    const out = serializeCollection(new Map([owned(hidden)]), { now: NOW });
    expect(out.entries[0].channel).not.toHaveProperty('subscriberCount');
  });

  it('skips malformed entries rather than writing them', () => {
    const collection = new Map([['bad', { count: 2 }], owned(channel())]);
    expect(serializeCollection(collection, { now: NOW }).entries).toHaveLength(1);
  });
});

describe('parseCollection — every failure is recoverable', () => {
  it('round-trips a collection back to identical cards', () => {
    const before = new Map([owned(channel(), 4)]);
    const after = parseCollection(serializeCollection(before, { now: NOW }));
    expect(after.get('UC_a').count).toBe(4);
    expect(after.get('UC_a').card.rarity).toBe(before.get('UC_a').card.rarity);
    expect(after.get('UC_a').card.atk).toBe(before.get('UC_a').card.atk);
  });

  it('re-derives rarity rather than trusting anything stored', () => {
    const saved = serializeCollection(new Map([owned(channel({ subscriberCount: '60000000' }))]), { now: NOW });
    expect(parseCollection(saved).get('UC_a').card.rarity).toBe('UR');
  });

  it('returns empty for junk instead of throwing', () => {
    for (const junk of [null, undefined, 'nope', 42, [], {}]) {
      expect(parseCollection(junk).size).toBe(0);
    }
  });

  it('discards a version it does not understand rather than guessing', () => {
    /* A wrong migration silently corrupts somebody's collection; starting over
       is the honest failure. */
    const saved = serializeCollection(new Map([owned(channel())]), { now: NOW });
    expect(parseCollection({ ...saved, version: 999 }).size).toBe(0);
  });

  it('drops one bad entry but keeps the rest', () => {
    const saved = serializeCollection(new Map([owned(channel()), owned(channel({ id: 'UC_b' }))]), { now: NOW });
    saved.entries[0] = { count: 1 };                     // no channel
    expect(parseCollection(saved).size).toBe(1);
  });

  it('floors a nonsense count at 1 rather than storing a zero-card entry', () => {
    const saved = serializeCollection(new Map([owned(channel())]), { now: NOW });
    for (const bad of [0, -3, 'x', null]) {
      saved.entries[0].count = bad;
      expect(parseCollection(saved).get('UC_a').count).toBe(1);
    }
  });
});

describe('reconcileCollection — how a saved card stays inside the 30-day cap', () => {
  it('refreshes an owned card from a freshly loaded set', () => {
    const before = new Map([owned(channel({ subscriberCount: '2000000' }), 5)]);
    const fresh = [channel({ subscriberCount: '12000000', title: 'A Channel (renamed)' })];
    const { collection, updated } = reconcileCollection(before, fresh);
    expect(updated).toBe(1);
    expect(collection.get('UC_a').card.rarity).toBe('SSR');       // was SR
    expect(collection.get('UC_a').card.channel.title).toBe('A Channel (renamed)');
    expect(collection.get('UC_a').count).toBe(5);                  // count survives
  });

  it('keeps a card that has left the set, rather than deleting it', () => {
    /* The deliberate trade: the set is re-cut on every build, so a card can drop
       out of print. A collection is a record of what you pulled — a physical
       card does not vanish from a binder because its subject grew. */
    const before = new Map([owned(channel(), 2)]);
    const { collection, updated } = reconcileCollection(before, [channel({ id: 'UC_other' })]);
    expect(updated).toBe(0);
    expect(collection.get('UC_a').count).toBe(2);
  });

  it('reports zero updates when nothing matched, so no pointless write happens', () => {
    expect(reconcileCollection(new Map([owned(channel())]), []).updated).toBe(0);
  });

  it('survives empty and missing inputs', () => {
    expect(reconcileCollection(null, null).collection.size).toBe(0);
    expect(reconcileCollection(new Map(), [channel()]).collection.size).toBe(0);
  });
});
