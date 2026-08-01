/* ui/banner — the banner section: mode toggle, live channel add/remove,
   pool chips, pull buttons, rates line and status messages.
   Owns its own DOM refs and events. initBanner({ onPull }) wires it up;
   the pull buttons call onPull(count) so main stays the composition root. */

import { toCard } from '../engine/core.js';
import { bandsFrom } from '../engine/gacha.js';
import { selectChannels, SEARCH_TIERS } from '../engine/discover.js';
import { state, currentPool, setSetsPool } from '../state.js';
import { IS_DEV, gateDevElement } from '../config.js';
import { resolveChannelInput, fetchLiveChannel, loadSet, parseSet, DEMO_SET, discoverChannels } from '../data/index.js';
import { escapeHtml } from './util.js';

/* The bundled demo set is offered as the first, always-present option. Its
   picker value is this sentinel (real sets use their file path), so selecting
   it skips the fetch and loads from memory. */
const DEMO_VALUE = '@demo';

/* Magic Search (dev affordance): bulk-discover channels by keyword through the
   live API and drop them into the Live pool so they can be pulled. Like Dev Pull,
   this must be gated or stripped before a real-users build — it needs a key and
   is the parked player-side search (see DECISIONS.md / magic-search notes).

   One button per sourcing tier. The tiers themselves — search bias and band —
   are pure config and live in engine/discover.js as SEARCH_TIERS; this module
   only renders a button per entry and reports the result. */
const MS_CAP = 5;

const modeSetsBtn = document.getElementById('mode-sets');
const modeLiveBtn = document.getElementById('mode-live');
const setsControls = document.getElementById('sets-controls');
const setSelect = document.getElementById('set-select');
const setMeta = document.getElementById('set-meta');
const liveControls = document.getElementById('live-controls');
const apiKeyInput = document.getElementById('api-key');
const addInput = document.getElementById('add-input');
const addBtn = document.getElementById('add-btn');
const msInput = document.getElementById('ms-input');
const msRow = document.getElementById('ms-row');
const msInputRow = document.getElementById('ms-input-row');
const msButtons = {
  legends: document.getElementById('ms-legends'),
  majority: document.getElementById('ms-majority'),
  wildcards: document.getElementById('ms-wildcards'),
};
const chipsEl = document.getElementById('pool-chips');
const statusEl = document.getElementById('status');
const pullBtn1 = document.getElementById('pull-1');
const pullBtn10 = document.getElementById('pull-10');
const pullBtnDev = document.getElementById('pull-dev');
const ratesEl = document.getElementById('rates');

let statusTimer = null;

function showStatus(message, isError = false) {
  clearTimeout(statusTimer);
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
  if (!isError && message) {
    statusTimer = setTimeout(() => { statusEl.textContent = ''; }, 3500);
  }
}

/* The two modes want different things from this row, so they diverge here:
   Live enumerates (hand-built pool, every entry needs its own remove button),
   Sets summarizes (see renderPoolSummary). */
function renderPool() {
  const pool = currentPool();
  if (!pool.length) {
    const msg = state.mode === 'live'
      ? 'Banner is empty — add a channel above to start pulling.'
      : 'Loading set…';
    chipsEl.innerHTML = `<p class="empty">${msg}</p>`;
  } else if (state.mode === 'live') {
    renderChips(pool);
  } else {
    renderPoolSummary(pool);
  }
  pullBtn1.disabled = pullBtn10.disabled = pullBtnDev.disabled = !pool.length;
  renderRates();
}

function renderChips(pool) {
  chipsEl.innerHTML = '';
  for (const card of pool) {
    const title = escapeHtml(card.channel.title);
    const initial = [...card.channel.title][0]?.toUpperCase() ?? '?';
    const chip = document.createElement('span');
    chip.className = `chip r-${card.rarity}`;
    /* The name is truncated in CSS, so carry the full title as a tooltip. The
       pfp slot always renders the initial; a usable avatar is layered over it. */
    chip.innerHTML =
      `<span class="chip-pfp" aria-hidden="true">${escapeHtml(initial)}</span>` +
      `<span class="chip-name" title="${title}">${title}</span>` +
      `<b class="dot" title="${card.rarity}"></b>` +
      `<button class="chip-x" type="button" data-id="${escapeHtml(card.channel.id)}" aria-label="Remove ${title}">×</button>`;
    /* Same discipline the card avatar has had since the hotlink fix, which the
       chip never got: a channel with no picture at all yields avatarUrl '', and
       an <img src=""> makes the browser fetch this very page, fail to decode the
       HTML, and paint a broken-image glyph. So the element is only created when
       there's a URL, and removed if that URL fails — either way the initial
       behind it is what shows. Small/new channels are where this bites: they're
       the ones most likely never to have set a picture. */
    if (card.channel.avatarUrl) {
      const img = document.createElement('img');
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => img.remove(), { once: true });
      img.src = card.channel.avatarUrl;
      chip.querySelector('.chip-pfp').appendChild(img);
    }
    chipsEl.appendChild(chip);
  }
}

/* Sets show the pool's composition, not a roll call of it. A real Series is
   300–500 cards, so a chip each would render hundreds of read-only pills —
   and every chip's <img> is the card's own avatar, which WP3 made the largest
   thumbnail available (up to 800px) so the centrepiece isn't soft. That is a
   punishing download for a 22px circle, repeated on every set switch. The band
   counts are also simply better information when choosing between sets, and
   bandsFrom already groups exactly this way. */
function renderPoolSummary(pool) {
  const bands = bandsFrom(pool);
  chipsEl.innerHTML =
    '<p class="pool-summary">' +
    `<span class="pool-total">${pool.length} card${pool.length === 1 ? '' : 's'}</span>` +
    bands.map(band =>
      `<span class="pool-band r-${band.rarity}"><b class="dot"></b>${band.rarity} ${band.cards.length}</span>`
    ).join('') +
    '</p>';
}

/* The odds shown are the real ones for this pool, not the raw weight table.
   The two-stage pull picks a rarity band first, then a card inside it, and
   renormalizes over the bands the pool actually holds — so a sparse live
   banner shows its own odds instead of a curve it can't produce. */
function renderRates() {
  const bands = bandsFrom(currentPool());
  const total = bands.reduce((sum, band) => sum + band.weight, 0);
  if (!total) {
    ratesEl.textContent = '';
    return;
  }
  ratesEl.textContent = 'Drop rates — ' + bands
    .map(band => `${band.rarity} ${Math.round((band.weight / total) * 1000) / 10}%`)
    .join(' · ');
}

function setMode(mode) {
  state.mode = mode;
  modeSetsBtn.classList.toggle('active', mode === 'sets');
  modeLiveBtn.classList.toggle('active', mode === 'live');
  liveControls.hidden = mode !== 'live';
  setsControls.hidden = mode !== 'sets';
  showStatus('');
  if (mode === 'sets') ensureSets();
  renderPool();
}

/* The picker is seeded once: the bundled demo set goes in first and loads
   synchronously (no fetch, so the default view paints instantly and still works
   offline), then the fetchable-set manifest is appended when it arrives. If
   that fetch fails, the demo set is untouched and remains pullable. */
let setsSeeded = false;

function ensureSets() {
  if (setsSeeded) return;
  setsSeeded = true;
  const opt = document.createElement('option');
  opt.value = DEMO_VALUE;
  opt.textContent = DEMO_SET.title;
  setSelect.appendChild(opt);
  selectDemo();             // synchronous: setsPool is ready before renderPool runs
  appendManifestSets();     // async: offer the fetchable sets once loaded
}

/* Load the bundled demo set from memory, through the same parseSet → toCard
   path a fetched set uses. No snapshot label — the demo set isn't dated. */
function selectDemo() {
  setSetsPool(parseSet(DEMO_SET));
  setMeta.textContent = '';
  renderPool();
}

async function appendManifestSets() {
  await appendSetsFrom('sets/index.json', { warnOnFail: true });
  /* Sets minted by tools/build-set.js. Never committed (a set file in git is
     permanent, which would break both the 30-day statistics cap and the promise
     that a removal is performable), so CI builds them at deploy and they arrive
     through their own manifest rather than the committed one. Probed on every
     host, unlike the dev manifest below — this is the production path. Silent on
     failure, since a checkout with nothing built yet is the normal local state. */
  await appendSetsFrom('sets/built/index.json', { warnOnFail: false });
  /* Dev-only: a gitignored sets/index.local.json lets local build tools (e.g.
     tools/magic-search.js) surface their generated draft sets in the picker
     without touching the committed manifest. Probed only in dev, so a deployed
     build never makes the doomed request — same spirit as the config.local.js
     pre-fill above. */
  if (IS_DEV) await appendSetsFrom('sets/index.local.json', { warnOnFail: false });
}

async function appendSetsFrom(url, { warnOnFail }) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const { sets } = await res.json();
    for (const s of sets ?? []) {
      const opt = document.createElement('option');
      opt.value = s.file;
      opt.textContent = s.title;
      setSelect.appendChild(opt);
    }
  } catch {
    // The demo set still works; the extra sets just aren't offered.
    if (warnOnFail) showStatus('Could not load the additional set list.', true);
  }
}

async function loadSelectedSet() {
  const value = setSelect.value;
  if (value === DEMO_VALUE) return selectDemo();
  showStatus('Loading set…');
  try {
    const set = await loadSet(value);
    setSetsPool(set);
    setMeta.textContent = set.snapshotDate ? `Stats as of ${set.snapshotDate}` : '';
    showStatus('');
  } catch (err) {
    setMeta.textContent = '';
    showStatus(err.message, true);
  }
  renderPool();
}

async function onAddChannel() {
  const resolved = resolveChannelInput(addInput.value);
  if (resolved.error) return showStatus(resolved.error, true);
  if (!state.apiKey) return showStatus('Paste your YouTube Data API key first.', true);

  addBtn.disabled = true;
  addBtn.textContent = 'Adding…';
  try {
    const channel = await fetchLiveChannel(resolved, state.apiKey);
    if (state.livePool.some(card => card.channel.id === channel.id)) {
      showStatus(`${channel.title} is already in the banner.`, true);
    } else {
      state.livePool.push(toCard(channel));
      addInput.value = '';
      showStatus(`Added ${channel.title}.`);
      renderPool();
    }
  } catch (err) {
    showStatus(err.message, true);
  } finally {
    addBtn.disabled = false;
    addBtn.textContent = 'Add';
  }
}

/* Dev: run one keyword through the live discovery path and add the top few
   channels to the Live pool. Reuses the exact search/floor/pool code the CLI
   tool uses — data/search.js is fetch-only, so it runs unchanged in the browser.
   Accumulates like the tool: repeat searches grow the pool, dupes are skipped. */
/* Every tier button locks while one search is in flight — they share the pool
   and the key's quota, so letting two run at once just races them. */
function msSetBusy(busy) {
  for (const button of Object.values(msButtons)) button.disabled = busy;
}

async function onMagicSearch(tierKey) {
  const tier = SEARCH_TIERS[tierKey];
  const keyword = msInput.value.trim() || 'cooking';
  if (!state.apiKey) {
    return showStatus('Magic Search needs a key — paste your YouTube Data API key above.', true);
  }
  msSetBusy(true);
  msButtons[tierKey].textContent = 'Searching…';
  showStatus(`Magic Search — ${tier.label}: "${keyword}"…`);
  try {
    const found = await discoverChannels(keyword, state.apiKey, tier.opts);
    const kept = selectChannels(found, { floor: tier.floor, cap: MS_CAP });
    let added = 0;
    for (const channel of kept) {
      if (state.livePool.some(card => card.channel.id === channel.id)) continue;
      state.livePool.push(toCard(channel));
      added += 1;
    }
    /* The keyword deliberately survives a search now: with a band per button,
       the obvious next move is the same word through a different tier. */
    showStatus(added
      ? `${tier.label} added ${added} channel${added === 1 ? '' : 's'} for "${keyword}". Pull to reveal them.`
      : `No ${tier.label} channels for "${keyword}" — searched ${found.length} uploader${found.length === 1 ? '' : 's'}, none in that band (or already in the banner). Try another tier, or search again to re-roll.`);
    renderPool();
  } catch (err) {
    showStatus(err.message, true);
  } finally {
    msSetBusy(false);
    msButtons[tierKey].textContent = tier.label;
  }
}

export function initBanner({ onPull, onDevPull }) {
  modeSetsBtn.addEventListener('click', () => setMode('sets'));
  modeLiveBtn.addEventListener('click', () => setMode('live'));
  setSelect.addEventListener('change', loadSelectedSet);
  apiKeyInput.addEventListener('input', () => { state.apiKey = apiKeyInput.value.trim(); });
  addBtn.addEventListener('click', onAddChannel);
  addInput.addEventListener('keydown', e => { if (e.key === 'Enter') onAddChannel(); });
  for (const [tierKey, button] of Object.entries(msButtons)) {
    button.addEventListener('click', () => onMagicSearch(tierKey));
  }
  // Enter takes the broad middle — the tier you want most of the time.
  msInput.addEventListener('keydown', e => { if (e.key === 'Enter') onMagicSearch('majority'); });
  pullBtn1.addEventListener('click', () => onPull(1));
  pullBtn10.addEventListener('click', () => onPull(10));
  pullBtnDev.addEventListener('click', () => onDevPull());

  chipsEl.addEventListener('click', e => {
    const btn = e.target.closest('.chip-x');
    if (!btn) return;
    state.livePool = state.livePool.filter(card => card.channel.id !== btn.dataset.id);
    renderPool();
  });

  setMode('sets');

  /* WP8: dev affordances are hidden outside dev. Magic Search spends the
     visitor's own quota and is a sourcing tool, not a game feature; Dev Pull
     forces one card of every rarity and would misrepresent the drop rates
     printed directly beneath it. Both stay in the DOM (so `?dev=1` can reveal
     them and the module-level refs above stay valid) — they are hidden, not
     removed. */
  gateDevElement(msRow);
  gateDevElement(msInputRow);
  gateDevElement(pullBtnDev);

  /* Local dev convenience: if a gitignored src/config.local.js exists and
     exports a YOUTUBE_API_KEY, pre-fill the Live API field so testing live
     mode needs no re-paste. The file never ships (see .gitignore), so the
     dynamic import simply rejects — and is ignored — everywhere else. Skipped
     outside dev: there is no such file to find, and a deployed build should
     never even reach for a key it does not have. */
  if (!IS_DEV) return;
  import('../config.local.js')
    .then(({ YOUTUBE_API_KEY }) => {
      const key = String(YOUTUBE_API_KEY ?? '').trim();
      if (!key) return;
      apiKeyInput.value = key;
      state.apiKey = key;
    })
    .catch(() => { /* no local config — the normal case */ });
}
