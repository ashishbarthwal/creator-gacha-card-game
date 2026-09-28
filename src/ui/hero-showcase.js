/* Home hero states:
   - empty collection: five aspirational cards from the current set;
   - owned collection: separate reach and battle-power rankings.

   Card markup and finishes come exclusively from renderCard. This module only
   chooses cards, places them, and wires both hero states to the inspector. */

import { currentPool, state } from '../state.js';
import { FEATURED_HANDLES, featuredCards, topCollectionByPower, topCollectionBySubscribers } from '../engine/showcase.js';
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
const phoneLayout = matchMedia('(max-width: 600px)');
const phoneFeaturedHandles = ['@mrbeast', '@cristiano', '@rihanna', '@addisonrae'];

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
  if (!event.target.closest('.card')) return;
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
  const limit = 5;
  topCards.replaceChildren();
  topCards.append(
    renderOwnedRow('Your Most Followed Cards', 'By subscriber count', 'Ranked by subscriber count. Popularity helps shape a card’s base strength, but the battle ranking also considers its combat stats.', topCollectionBySubscribers(state.collection, limit)),
    renderOwnedRow('Your Battle Leader Cards', 'By combat power', 'Subscribers matter, but they are only one part of battle strength. This ranking weighs HP, attack, defence, speed and momentum, shaped by views per video, posting cadence and audience response. Element matchups and formation can still swing a fight.', topCollectionByPower(state.collection, limit)),
  );
}

function renderOwnedRow(title, detail, explanation, items) {
  const group = document.createElement('section');
  group.className = 'hero-top-group';
  const head = document.createElement('header');
  head.className = 'hero-top-group-head';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const info = document.createElement('span');
  info.className = 'rank-info';
  const infoButton = document.createElement('button');
  infoButton.className = 'rank-info-button';
  infoButton.type = 'button';
  infoButton.textContent = 'i';
  infoButton.setAttribute('aria-label', `About ${title.toLowerCase()}`);
  const tip = document.createElement('span');
  tip.className = 'rank-info-tip';
  tip.setAttribute('role', 'tooltip');
  tip.id = title.includes('Most') ? 'followed-rank-tip' : 'battle-rank-tip';
  tip.textContent = explanation;
  infoButton.setAttribute('aria-describedby', tip.id);
  info.append(infoButton, tip);
  const note = document.createElement('p');
  note.textContent = detail;
  head.append(heading, note, info);
  const row = document.createElement('div');
  row.className = 'hero-top-row';
  row.classList.toggle('has-three-cards', items.length === 3);
  row.classList.toggle('has-five-cards', items.length >= 5);
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
  const handles = phoneLayout.matches ? phoneFeaturedHandles : FEATURED_HANDLES;
  for (const [index, card] of featuredCards(currentPool(), handles).entries()) {
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

phoneLayout.addEventListener('change', renderHeroShowcase);

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
    title.textContent = phoneLayout.matches ? 'Your collection' : 'Your top cards';
    copy.textContent = phoneLayout.matches
      ? 'Your cards are below. Build a five-card crew and head into Battle.'
      : 'Your biggest names and boldest fighters, pulled from your own binder.';
    rankingNote.textContent = phoneLayout.matches ? '' : 'Two ways to lead your collection.';
    topCards.replaceChildren();
    if (!phoneLayout.matches) renderOwned();
    return;
  }

  topCards.replaceChildren();
  emptySlots.hidden = false;
  kickerText.textContent = 'POSSIBLE PULLS';
  title.textContent = 'Who will you pull next?';
  copy.textContent = 'Real creators. Real numbers. Thousands of cards, full of unexpected favourites.';
  rankingNote.textContent = 'Example cards you can expect to pull from different tiers';
  renderAspirational();
  showcase.hidden = showcase.childElementCount === 0;
  emptySlots.hidden = !showcase.hidden;
}
