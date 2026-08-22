/* ui/collection — the collection grid, its progression readout, and the
   search / filter / sort toolbar.
   Reads shared state; owns its own DOM refs. */

import { RARITY_ORDER, toCount } from '../engine/core.js';
import { battleStatsFrom } from '../engine/battle-stats.js';
import { TEAM_SIZE } from '../engine/battle.js';
import { state, resetCollection } from '../state.js';
import { renderCard } from './card.js';
import { enableCardTilt } from './holo.js';
import { openInspect } from './inspect.js';
import { makeStars } from './stars.js';

const collGrid = document.getElementById('collection-grid');
const collSummary = document.getElementById('coll-summary');
const collEmpty = document.getElementById('coll-empty');
const collNone = document.getElementById('coll-none');
const collClear = document.getElementById('coll-clear');
/* Owned here because this module is the one that knows how many DIFFERENT
   creators are in the binder; the click itself is wired in main.js, which is
   where modules get introduced to each other. */
const battleBtn = document.getElementById('battle-open');
const collTools = document.getElementById('coll-tools');
const collSearch = document.getElementById('coll-search');
const collFilters = document.getElementById('coll-filters');
const collSort = document.getElementById('coll-sort');
const collSortBox = document.querySelector('.tool-sort');

/* Below this SORT is furniture: ordering only becomes a question once the binder
   is too big to take in at a glance. Search and the rarity chips used to sit
   behind this threshold too and no longer do — a control that appears partway
   through a session reads as the UI changing shape under the player, and both of
   those answer questions worth asking at any size. */
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
  /* Derived on demand rather than read off the card, because a card no longer
     carries numbers — there is one derivation and it lives in battle-stats.js
     (see engine/core.js). Memoized: sorting a few hundred cards would otherwise
     re-derive each one on every comparison, which is O(n log n) calls into the
     same pure function for the same answer. */
  atk:    (a, b) => statOf(b, 'atk') - statOf(a, 'atk'),
  def:    (a, b) => statOf(b, 'def') - statOf(a, 'def'),
  subs:   (a, b) => toCount(b.card.channel.subscriberCount) - toCount(a.card.channel.subscriberCount),
  name:   (a, b) => a.card.channel.title.localeCompare(b.card.channel.title),
};

function byRarity(a, b) {
  return RARITY_ORDER.indexOf(b.card.rarity) - RARITY_ORDER.indexOf(a.card.rarity)
    || toCount(b.card.channel.subscriberCount) - toCount(a.card.channel.subscriberCount);
}

/* One derivation per channel per sort, cached by id. Cleared nowhere on
   purpose: battleStatsFrom is deterministic in the channel and the clock, and
   the clock only matters at the granularity of channel AGE — so a value cached
   for the life of a page view cannot be stale in any way a player could see. */
const statCache = new Map();
function statOf(item, key) {
  const id = item.card.channel.id;
  let s = statCache.get(id);
  if (!s) { s = battleStatsFrom(item.card.channel); statCache.set(id, s); }
  return s[key];
}

/* What the empty grid says. "Nothing matches those filters" is accurate and
   tells the player nothing they did not just do — they can see which chip they
   pressed. Naming the band turns the empty tray into an answer: an R filter over
   a binder with no R says there are no R cards, which is the question the click
   asked.

   Written from the view rather than from a string per case, so the search and
   rarity filters compose instead of one silently winning. The query is set as
   TEXT, never markup — it is the one thing here a player typed. */
function emptyMessage() {
  const { rarity, q } = view;
  const band = rarity ? `${rarity} cards` : 'cards';
  if (q) return `No ${band} match “${collSearch.value.trim()}”.`;
  if (rarity) return `No ${band} in your collection yet.`;
  return 'Nothing matches those filters.';
}

function matches(item) {
  if (view.rarity && item.card.rarity !== view.rarity) return false;
  if (!view.q) return true;
  const { title, handle } = item.card.channel;
  return `${title} ${handle ?? ''}`.toLowerCase().includes(view.q);
}

/* Chips carry no counts. A rarity filter is a way to FIND a card; printing "SSR
   3" next to it turns the binder back into a progress readout, which is exactly
   what this pass removed from the hero. That still holds.

   WHAT CHANGED (2026-08-03): every band gets a chip from the first visit, held or
   not. This reverses "offering a UR filter to someone with no UR is a button
   whose only outcome is an empty grid" — the empty grid is now the point. The
   five bands ARE the game's shape, and a new player who has never pulled should
   be able to read what they are chasing off the binder itself. An empty UR tray
   says "there is a UR band and you have none of it", which is the more useful
   answer to the question someone asks by clicking it.

   The chips stay IDENTICAL whether or not the band is held — no dimming, no
   count, no check. Marking the empty ones would smuggle the progress readout
   back in through styling, having just removed it from the markup. */
function renderFilters() {
  const bands = [...RARITY_ORDER].reverse();
  collFilters.innerHTML =
    `<button class="filter-chip${view.rarity ? '' : ' on'}" type="button" data-rarity="all" aria-pressed="${!view.rarity}">All</button>` +
    bands.map(r =>
      `<button class="filter-chip r-${r}${view.rarity === r ? ' on' : ''}" type="button" data-rarity="${r}" aria-pressed="${view.rarity === r}">` +
      `<b class="dot"></b>${r}</button>`
    ).join('');
}

/* ── THE BINDER TWINKLES TOO (2026-08-17) ──────────────────────────────────
   Ash: "the twinkling effects and stars should be in mobile as well... in the
   collection tray as well. it's cheap and pretty so lets keep it."

   The UR/RUBY point twinkles were already here — `renderCard` appends those on
   every surface and has never gated them by device. What was missing is the
   SCATTER field (`makeStars`, SR and up), which only the pull reveal and the
   admire screen ever built. This adds it to the binder.

   ── WHY AN OBSERVER, WHEN NOTHING ELSE THAT USES makeStars NEEDS ONE ───────
   Because the binder is the one surface with no bound on how many cards are on
   it. A reveal is ten cards and the inspector is exactly one; `renderCollection`
   below renders EVERY matching card at once, with no virtualisation. A star
   field is ~20 infinitely-animating nodes, so a thousand-card binder filtered to
   SR would put ~18,000 of them on one page — and "filtered to SR" is not a
   corner case, it is what the rarity chips are for.

   So a field is attached when its card comes near the viewport and detached
   when it leaves. Detached rather than hidden, deliberately: `display: none`
   still means the nodes exist and were built, which is the exact distinction
   reveal.js's LOW_FX comment draws about the aura's motes. Animations do not
   run on a detached node, so the active count tracks what is on screen instead
   of what is owned.

   FIELDS ARE CACHED BY CHANNEL ID, and that is not a micro-optimisation — it is
   what keeps a card's own constellation STABLE. `makeStars` randomises every
   position, so rebuilding on each scroll-in would give one card a different
   star pattern every time it passed the viewport, which reads as flicker rather
   than as sparkle. Cached, a card keeps the sky it was born with for the life
   of the page. A detached wrapper of twenty <i>s costs nothing to keep.

   `null` is cached too (N and R have no field), so a common card is never asked
   about twice. */
const starFields = new Map();       // channel id -> the field, or null for N/R
const fieldForCard = new WeakMap(); // card element -> its field, for the observer

function starFieldFor(card) {
  const id = card.channel.id;
  if (!starFields.has(id)) starFields.set(id, makeStars(card.rarity));
  return starFields.get(id);
}

/* Built once and disconnected on every re-render, rather than made fresh each
   time: an IntersectionObserver holds a STRONG reference to what it observes,
   so leaving the previous render's (now discarded) card elements observed would
   pin every card the player has ever scrolled past. */
const starWatcher = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        const field = fieldForCard.get(entry.target);
        if (!field) continue;
        if (entry.isIntersecting) entry.target.appendChild(field);
        else field.remove();
      }
      /* A card is attached slightly before it scrolls in and released well
         after it leaves, so a slow scroll never thrashes at the boundary. */
    }, { rootMargin: '250px' })
  : null;

export function renderCollection() {
  const items = [...state.collection.values()];

  /* There used to be a reset here: a filter with nothing behind it snapped back
     to All, so the grid could not strand on an empty view "with no obvious way
     back". It is gone, because the chips are now permanent and the way back is
     always on screen — All sits at the head of the row and the active chip reads
     as pressed. Keeping the reset would have made an empty band unselectable,
     which is the one thing this change exists to allow. */
  const shown = items.filter(matches).sort(SORTS[view.sort] ?? byRarity);

  /* Every card element from the previous render is about to be discarded, so
     the observer's whole watch list is stale. Cleared here rather than
     unobserved one by one — the list and the grid are rebuilt together. */
  starWatcher?.disconnect();

  collGrid.innerHTML = '';
  for (const item of shown) {
    const el = renderCard(item.card, { count: item.count, isNew: newThisSession.has(item.card.channel.id) });
    el.dataset.channelId = item.card.channel.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `View ${item.card.channel.title} up close`);
    collGrid.appendChild(el);

    /* SR and up. Without an observer (no IntersectionObserver at all) the field
       simply goes on and stays on — the effect is the point, and the bound is
       the optimisation. */
    const field = starFieldFor(item.card);
    if (field) {
      if (starWatcher) { fieldForCard.set(el, field); starWatcher.observe(el); }
      else el.appendChild(field);
    }
  }

  /* "Saved in this browser" came OUT of this line on 2026-08-16 (Ash's call).
     It used to be defended here as "the only place the player is told where
     their collection lives", and that was simply not true: the footer says it
     in prose, on every page, and the privacy policy says it at length. So it
     was not the promise, it was a third copy of the promise — sitting inside a
     counter, where the player is reading numbers about their own collection and
     not asking where files go. The promise is unchanged and still stated where
     someone would look for it. */
  /* Own numbers only — no set-size denominator (2026-08-03, same day as the
     denominator was added and then narrowed). "10 of 24,251 unique" answered
     the question honestly and revealed something else in the process: the size
     of the whole pool, including the ~8,430 staged-institution cards nobody
     outside the project should be counting on. A player's own progress is
     theirs to see; the machine's total roster size is not the same disclosure,
     and showing it as a side effect of showing progress was the mistake.

     Unique vs pulled still answers the question that matters to a player: how
     much of what I've drawn is actually distinct, which is where duplicates
     live. */
  const unique = items.length;
  const pulled = items.reduce((n, it) => n + (Number(it.count) || 0), 0);

  const parts = [];
  if (items.length) parts.push(`${unique.toLocaleString()} unique`, `${pulled.toLocaleString()} total`);
  collSummary.textContent = parts.join(' · ');
  /* The two empty states answer two different questions, and which one is true
     is decided by the COLLECTION, not by the grid. An empty binder says "pull to
     start" even with a band selected — "nothing matches those filters" would be
     technically true and useless to someone who has never pulled. */
  collEmpty.hidden = items.length > 0;
  collClear.hidden = items.length === 0;
  collNone.hidden = !items.length || shown.length > 0;
  if (!collNone.hidden) collNone.textContent = emptyMessage();

  /* A team is five DIFFERENT creators, so the gate is unique cards — not total
     pulled, which a pile of duplicates would satisfy while leaving nothing to
     field. Counted off `items` (the whole collection) rather than `shown`,
     because a rarity filter is a way of looking at the binder, not a change to
     what you own. */
  /* THE BUTTON IS NEVER DISABLED ANY MORE (2026-08-22). It used to be, below
     five unique creators, with the reason carried only in a `title` — which is
     hover-only, so on a phone the entire explanation was "this is grey". The
     arena has always had the real answer written out (`renderMode`'s "Not
     enough cards yet" panel) and disabling the button was the one thing making
     it unreachable.

     The title stays for pointer users, where it costs nothing and arrives
     sooner. It is now a preview of what the arena will say rather than the only
     place it is said. */
  if (battleBtn) {
    battleBtn.title = unique >= TEAM_SIZE
      ? 'Build a team of five and fight'
      : `Needs ${TEAM_SIZE} different creators — you have ${unique}`;
  }

  /* The toolbar is always present now, and so are the two controls a player
     reaches for on purpose: the rarity chips and the search box. Only SORT keeps
     the threshold, and it is the one control the argument still fits — ordering
     is a question about a binder too big to scan, while searching and filtering
     are questions about a binder of any size. */
  collTools.hidden = false;
  if (collSortBox) collSortBox.hidden = items.length < TOOLS_AT;
  renderFilters();
}
