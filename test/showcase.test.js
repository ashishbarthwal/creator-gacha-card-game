import { describe, expect, it } from 'vitest';
import { toCard } from '../src/engine/core.js';
import { battleStatsFrom, powerOf } from '../src/engine/battle-stats.js';
import {
  FEATURED_HANDLES,
  featuredCards,
  topCollectionByPower,
  topCollectionBySubscribers,
} from '../src/engine/showcase.js';

const NOW = Date.UTC(2026, 8, 21);

function channel(id, subscriberCount, handle = `@${id}`) {
  return {
    id,
    title: id,
    handle,
    subscriberCount: String(subscriberCount),
    viewCount: String(subscriberCount * 30),
    videoCount: '500',
    publishedAt: '2015-01-01T00:00:00Z',
    element: 'Tech',
  };
}

describe('featuredCards', () => {
  it('keeps the editorial four-tier showcase in its intended order', () => {
    expect(FEATURED_HANDLES).toEqual(['@mrbeast', '@cristiano', '@rihanna', '@austinevans']);
  });

  it('uses Cristiano Ronaldo as the readable showcase name without mutating set data', () => {
    const source = toCard(channel('UR · Cristiano', 83_200_000, '@cristiano'));
    const [featured] = featuredCards([source], ['@cristiano']);
    expect(featured.channel.title).toBe('Cristiano Ronaldo');
    expect(source.channel.title).toBe('UR · Cristiano');
  });

  it('preserves the editorial order and skips creators missing from a set', () => {
    const pool = [
      toCard(channel('Marques', 20_000_000, '@mkbhd')),
      toCard(channel('Jimmy', 500_000_000, '@MrBeast')),
    ];
    expect(featuredCards(pool, ['@mrbeast', '@missing', '@MKBHD']).map(card => card.channel.id))
      .toEqual(['Jimmy', 'Marques']);
  });
});

describe('owned hero rankings', () => {
  it('uses the battle engine rating and does not let duplicate count inflate rank', () => {
    const low = toCard(channel('Low', 100_000));
    const mid = toCard(channel('Mid', 5_000_000));
    const high = toCard(channel('High', 100_000_000));
    const collection = new Map([
      ['Low', { card: low, count: 99 }],
      ['High', { card: high, count: 1 }],
      ['Mid', { card: mid, count: 2 }],
    ]);
    const expected = [low, mid, high]
      .sort((a, b) => powerOf(battleStatsFrom(b.channel, NOW)) - powerOf(battleStatsFrom(a.channel, NOW)))
      .map(card => card.channel.id);
    expect(topCollectionByPower(collection, 3, NOW).map(item => item.card.channel.id)).toEqual(expected);
  });

  it('ranks subscriber reach separately from battle power', () => {
    const small = toCard(channel('Small', 500_000));
    const large = toCard(channel('Large', 100_000_000));
    const collection = new Map([
      ['Small', { card: small, count: 50 }],
      ['Large', { card: large, count: 1 }],
    ]);
    expect(topCollectionBySubscribers(collection, 2, NOW).map(item => item.card.channel.id))
      .toEqual(['Large', 'Small']);
  });

  it('honours the visible-card limit without mutating the collection', () => {
    const collection = new Map([
      ['A', { card: toCard(channel('A', 1_000_000)), count: 1 }],
      ['B', { card: toCard(channel('B', 2_000_000)), count: 1 }],
      ['C', { card: toCard(channel('C', 3_000_000)), count: 1 }],
    ]);
    expect(topCollectionByPower(collection, 2, NOW)).toHaveLength(2);
    expect(topCollectionBySubscribers(collection, 2, NOW)).toHaveLength(2);
    expect(collection).toHaveLength(3);
  });
});
