/* ui/collection — the collection grid.
   Reads shared state; owns its own DOM refs. */

import { RARITY_ORDER, toCount } from '../engine/core.js';
import { state } from '../state.js';
import { renderCard } from './card.js';
import { enableCardTilt } from './holo.js';
import { openInspect } from './inspect.js';

const collGrid = document.getElementById('collection-grid');
const collSummary = document.getElementById('coll-summary');
const collEmpty = document.getElementById('coll-empty');

/* Delegated once on the persistent grid, so it keeps working across the
   innerHTML re-render in renderCollection below. */
enableCardTilt(collGrid);

/* Click or Enter/Space on a card opens the large inspector view. The card
   element carries its channel id, so we look the owned card back up in state. */
function inspectFromEvent(e) {
  const el = e.target.closest('.card');
  if (!el) return;
  const item = state.collection.get(el.dataset.channelId);
  if (item) openInspect(item.card, { count: item.count });
}
collGrid.addEventListener('click', inspectFromEvent);
collGrid.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inspectFromEvent(e); }
});

export function renderCollection() {
  const items = [...state.collection.values()].sort((a, b) =>
    RARITY_ORDER.indexOf(b.card.rarity) - RARITY_ORDER.indexOf(a.card.rarity)
    || toCount(b.card.channel.subscriberCount) - toCount(a.card.channel.subscriberCount));
  collGrid.innerHTML = '';
  let total = 0;
  for (const item of items) {
    total += item.count;
    const el = renderCard(item.card, { count: item.count });
    el.dataset.channelId = item.card.channel.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `View ${item.card.channel.title} up close`);
    collGrid.appendChild(el);
  }
  collSummary.textContent = items.length ? `${items.length} unique · ${total} cards` : '';
  collEmpty.hidden = items.length > 0;
}
