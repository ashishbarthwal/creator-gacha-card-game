/* Pure selection rules for the home hero. The UI owns presentation; this file
   owns which cards qualify so the result stays testable and deterministic. */

import { RARITY_ORDER, toCount } from './core.js';
import { battleStatsFrom, powerOf } from './battle-stats.js';

/* Handles are stable across weekly set rebuilds and readable in a maintenance
   diff. Missing creators are skipped rather than replaced with stale snapshots. */
export const FEATURED_HANDLES = Object.freeze([
  '@mrbeast',
  '@cristiano',
  '@rihanna',
  '@austinevans',
]);

/* The official channel title is "UR · Cristiano". The tier already appears in
   the card badge, so the hero uses the name people recognize at a glance. */
const FEATURED_TITLES = Object.freeze({
  '@cristiano': 'Cristiano Ronaldo',
});

export function featuredCards(pool, handles = FEATURED_HANDLES, limit = 4) {
  const byHandle = new Map(
    (pool ?? []).map(card => [String(card?.channel?.handle ?? '').toLowerCase(), card]),
  );
  return handles
    .map(handle => byHandle.get(String(handle).toLowerCase()))
    .filter(Boolean)
    .map(card => {
      const title = FEATURED_TITLES[String(card.channel.handle).toLowerCase()];
      return title ? { ...card, channel: { ...card.channel, title } } : card;
    })
    .slice(0, Math.max(0, limit));
}

function rankedEntries(collection, now) {
  const items = collection instanceof Map ? [...collection.values()] : [...(collection ?? [])];
  return items
    .filter(item => item?.card?.channel?.id)
    .map(item => ({
      item,
      power: powerOf(battleStatsFrom(item.card.channel, now)),
      rarity: RARITY_ORDER.indexOf(item.card.rarity),
      subscribers: toCount(item.card.channel.subscriberCount),
    }));
}

/* The strongest cards use the same composite rating as matchmaking. Duplicate
   count does not make one copy stronger. */
export function topCollectionByPower(collection, limit = 3, now = Date.now()) {
  return rankedEntries(collection, now)
    .sort((a, b) =>
      b.power - a.power
      || b.rarity - a.rarity
      || b.subscribers - a.subscribers
      || a.item.card.channel.title.localeCompare(b.item.card.channel.title),
    )
    .slice(0, Math.max(0, limit))
    .map(entry => entry.item);
}

/* Reach is deliberately separate from battle strength. This row answers the
   collector's "biggest name" question without claiming that reach wins fights. */
export function topCollectionBySubscribers(collection, limit = 3, now = Date.now()) {
  return rankedEntries(collection, now)
    .sort((a, b) =>
      b.subscribers - a.subscribers
      || b.rarity - a.rarity
      || b.power - a.power
      || a.item.card.channel.title.localeCompare(b.item.card.channel.title),
    )
    .slice(0, Math.max(0, limit))
    .map(entry => entry.item);
}
