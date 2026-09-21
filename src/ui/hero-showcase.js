/* Home hero states:
   - empty collection: four aspirational cards from the current set;
   - owned collection: separate reach and battle-power rankings.

   Card markup and finishes come exclusively from renderCard. This module only
   chooses cards, places them, and wires both hero states to the inspector. */

import { currentPool, state } from '../state.js';
import { featuredCards, topCollectionByPower, topCollectionBySubscribers } from '../engine/showcase.js';
import { renderCard } from './card.js';
import { enableCardTilt } from './holo.js';
import { openInspect } from './inspect.js';
import { makeStars } from './stars.js';

const hero = document.getElementById('hero-library');
const title = document.getElementById('banner-h');
const kickerText = document.getElementById('hero-kicker-text');
const copy = document.getElementById('hero-top-copy');
const rankingNote = document.getElementById('hero-ranking-note');
const topCards = document.getElementById('hero-top-cards');
const emptySlots = document.getElementById('hero-top-empty');
const showcase = document.getElementById('hero-showcase');
const featuredById = new Map();

enableCardTilt(topCards);
enableCardTilt(showcase);

function addFullCardFinish(cardEl, rarity) {
  const stars = makeStars(rarity);
  if (stars) cardEl.appendChild(stars);
}

function openTopCard(event) {
  const cardEl = event.target.closest('.card');
  if (!cardEl) return;
  const item = state.collection.get(cardEl.dataset.channelId);
  if (item) openInspect(item.card, { count: item.count });
}

topCards?.addEventListener('click', openTopCard);
topCards?.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  openTopCard(event);
});

function openFeaturedCard(event) {
  const cardEl = event.target.closest('.card');
  if (!cardEl) return;
  const card = featuredById.get(cardEl.dataset.channelId);
  if (card) openInspect(card);
}

showcase?.addEventListener('click', openFeaturedCard);
showcase?.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  openFeaturedCard(event);
});

function renderOwned() {
  topCards.replaceChildren();
  topCards.append(
    renderOwnedRow('Most followed', 'By subscriber count', topCollectionBySubscribers(state.collection, 3)),
    renderOwnedRow('Battle leaders', 'By combat power', topCollectionByPower(state.collection, 3)),
  );
}

function renderOwnedRow(title, detail, items) {
  const group = document.createElement('section');
  group.className = 'hero-top-group';
  const head = document.createElement('header');
  head.className = 'hero-top-group-head';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const note = document.createElement('p');
  note.textContent = detail;
  head.append(heading, note);
  const row = document.createElement('div');
  row.className = 'hero-top-row';
  for (const item of items) {
    const cardEl = renderCard(item.card, { count: item.count });
    cardEl.dataset.channelId = item.card.channel.id;
    cardEl.tabIndex = 0;
    cardEl.setAttribute('role', 'button');
    cardEl.setAttribute('aria-label', `View ${item.card.channel.title} up close`);
    addFullCardFinish(cardEl, item.card.rarity);
    row.appendChild(cardEl);
  }
  group.append(head, row);
  return group;
}

function renderAspirational() {
  showcase.replaceChildren();
  featuredById.clear();
  for (const [index, card] of featuredCards(currentPool()).entries()) {
    const float = document.createElement('div');
    float.className = `hero-float tier-${card.rarity}`;
    float.style.setProperty('--float-index', index);
    const cardEl = renderCard(card);
    cardEl.dataset.channelId = card.channel.id;
    cardEl.tabIndex = 0;
    cardEl.setAttribute('role', 'button');
    cardEl.setAttribute('aria-label', `View ${card.channel.title} up close`);
    featuredById.set(card.channel.id, card);
    addFullCardFinish(cardEl, card.rarity);
    float.appendChild(cardEl);
    showcase.appendChild(float);
  }
}

export function renderHeroShowcase() {
  if (!hero || !topCards || !showcase) return;
  const hasCards = state.collection.size > 0;
  hero.classList.toggle('has-top-cards', hasCards);
  hero.classList.toggle('is-onboarding', !hasCards);

  if (hasCards) {
    showcase.hidden = true;
    showcase.replaceChildren();
    featuredById.clear();
    emptySlots.hidden = true;
    kickerText.textContent = 'YOUR COLLECTION';
    title.textContent = 'Your top cards';
    copy.textContent = 'Your biggest names and strongest fighters, ranked separately.';
    rankingNote.textContent = 'Two ways to lead your collection.';
    renderOwned();
    return;
  }

  topCards.replaceChildren();
  emptySlots.hidden = false;
  kickerText.textContent = 'POSSIBLE PULLS';
  title.textContent = 'Who will you pull next?';
  copy.textContent = "Big names and rare tiers spread across thousands of creators. Collect 'em all!";
  rankingNote.textContent = 'Four chase tiers.';
  renderAspirational();
  showcase.hidden = showcase.childElementCount === 0;
  emptySlots.hidden = !showcase.hidden;
}
