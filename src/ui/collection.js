/* ui/collection — the collection grid, its progression readout, and the
   search / filter / sort toolbar.
   Reads shared state; owns its own DOM refs. */

import { RARITY_ORDER, toCount } from '../engine/core.js';
import { state, resetCollection } from '../state.js';
import { renderCard } from './card.js';
import { enableCardTilt } from './holo.js';
import { openInspect } from './inspect.js';

const collGrid = document.getElementById('collection-grid');
const collSummary = document.getElementById('coll-summary');
const collEmpty = document.getElementById('coll-empty');
const collNone = document.getElementById('coll-none');
const collClear = document.getElementById('coll-clear');
const collTools = document.getElementById('coll-tools');
const collSearch = document.getElementById('coll-search');
const collFilters = document.getElementById('coll-filters');
const collSort = document.getElementById('coll-sort');

/* Below this the toolbar is furniture — you can see everything you own without
   help, and a search box over nine cards just adds a control to ignore. */
const TOOLS_AT = 12;

/* How the player is currently looking at their own collection. Deliberately not
   persisted: a filter is a momentary question ("what URs do I have?"), and
   restoring one on next visit would present a partial binder as the whole.

   Rarity is the default, not recency. The reveal overlay has ALREADY shown the
   player what they just pulled, seconds earlier and with the full flip — so a
   collection that also leads with it spends its best row answering a question
   that is already answered. The binder is a trophy case. Recency also decays as
   a default: N is 55% of pulls, so after a few hundred the newest-first view is
   a wall of Graphite. The NEW badges keep this session's pulls findable under
   any sort. */
const view = { q: '', rarity: null, sort: 'rarity' };

/* Session pull order, newest first. "Recently pulled" cannot come from the saved
   collection — the persisted shape is { card, count } and adding a timestamp to
   it would change a schema that engine/collection.js reconciles and the suite
   pins. Session scope is also the honest reading: "new" means new to this
   sitting, which is what a player means when they say it. */
let pullSeq = 0;
const pulledAt = new Map();   // channel id -> sequence
const newThisSession = new Set();

export function notePulled(results) {
  for (const { card, isNew } of results) {
    pulledAt.set(card.channel.id, ++pullSeq);
    if (isNew) newThisSession.add(card.channel.id);
  }
}

/* Confirmed, because a collection is the only thing in this game a player can
   lose, and there is no server-side copy to restore it from. */
collClear.addEventListener('click', () => {
  const n = state.collection.size;
  if (!n) return;
  if (!confirm(`Delete all ${n} card${n === 1 ? '' : 's'} from this browser? This cannot be undone.`)) return;
  resetCollection();
  pulledAt.clear();
  newThisSession.clear();
  renderCollection();
});

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

/* Typing re-renders the grid, and a large binder is a lot of cards to rebuild
   on every keystroke — so the query lands on a short timer while the field
   itself stays instant. */
let searchTimer = null;
collSearch.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    view.q = collSearch.value.trim().toLowerCase();
    renderCollection();
  }, 120);
});

collSort.addEventListener('change', () => { view.sort = collSort.value; renderCollection(); });

collFilters.addEventListener('click', e => {
  const btn = e.target.closest('.filter-chip');
  if (!btn) return;
  const { rarity } = btn.dataset;
  view.rarity = rarity === 'all' ? null : rarity;
  renderCollection();
});

const SORTS = {
  /* Session pulls first (newest first), then everything restored from storage,
     which has no order of its own — fall back to rarity so the tail is not
     arbitrary. */
  recent: (a, b) => (pulledAt.get(b.card.channel.id) ?? 0) - (pulledAt.get(a.card.channel.id) ?? 0) || byRarity(a, b),
  rarity: byRarity,
  atk:    (a, b) => b.card.atk - a.card.atk,
  def:    (a, b) => b.card.def - a.card.def,
  subs:   (a, b) => toCount(b.card.channel.subscriberCount) - toCount(a.card.channel.subscriberCount),
  name:   (a, b) => a.card.channel.title.localeCompare(b.card.channel.title),
};

function byRarity(a, b) {
  return RARITY_ORDER.indexOf(b.card.rarity) - RARITY_ORDER.indexOf(a.card.rarity)
    || toCount(b.card.channel.subscriberCount) - toCount(a.card.channel.subscriberCount);
}

function matches(item) {
  if (view.rarity && item.card.rarity !== view.rarity) return false;
  if (!view.q) return true;
  const { title, handle } = item.card.channel;
  return `${title} ${handle ?? ''}`.toLowerCase().includes(view.q);
}

/* Chips carry no counts. A rarity filter is a way to FIND a card; printing "SSR
   3" next to it turns the binder back into a progress readout, which is exactly
   what this pass removed from the hero. Only bands the player actually holds get
   a chip — offering a UR filter to someone with no UR is a button whose only
   outcome is an empty grid. */
function renderFilters(items) {
  const held = new Set(items.map(item => item.card.rarity));
  const bands = [...RARITY_ORDER].reverse().filter(r => held.has(r));
  collFilters.innerHTML =
    `<button class="filter-chip${view.rarity ? '' : ' on'}" type="button" data-rarity="all" aria-pressed="${!view.rarity}">All</button>` +
    bands.map(r =>
      `<button class="filter-chip r-${r}${view.rarity === r ? ' on' : ''}" type="button" data-rarity="${r}" aria-pressed="${view.rarity === r}">` +
      `<b class="dot"></b>${r}</button>`
    ).join('');
}

export function renderCollection() {
  const items = [...state.collection.values()];

  /* A filter that no longer has anything behind it (the last SSR was cleared,
     the set changed) would otherwise strand the grid on an empty view with no
     obvious way back. */
  if (view.rarity && !items.some(item => item.card.rarity === view.rarity)) view.rarity = null;

  const shown = items.filter(matches).sort(SORTS[view.sort] ?? byRarity);

  collGrid.innerHTML = '';
  for (const item of shown) {
    const el = renderCard(item.card, { count: item.count, isNew: newThisSession.has(item.card.channel.id) });
    el.dataset.channelId = item.card.channel.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `View ${item.card.channel.title} up close`);
    collGrid.appendChild(el);
  }

  /* "Saved in this browser" stays. It is not a statistic — it is the promise the
     Clear button next to it makes good on, and the only place the player is told
     where their collection actually lives. */
  collSummary.textContent = items.length ? 'Saved in this browser' : '';
  collEmpty.hidden = items.length > 0;
  collClear.hidden = items.length === 0;
  collNone.hidden = !items.length || shown.length > 0;

  const showTools = items.length >= TOOLS_AT;
  collTools.hidden = !showTools;
  if (showTools) renderFilters(items);
}
