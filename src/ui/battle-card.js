/* ui/battle-card — the card face for combat. Ported from prototype/ when the
   arena moved into the app proper; the prototype file stays where it is, still
   importing from src/engine/, so that page keeps working unchanged.

   ── WHY A SECOND CARD AND NOT A BIGGER FIRST ONE ──────────────────────────
   The collection card (ui/card.js) shows a creator: a big ringed portrait, a
   subscriber count, two numbers. It is an object to want. A battle card has to
   answer a different question in about a second — "what does this do, and is it
   good against THAT?" — and the honest answer needs an element, a class, a verb
   and five stats. Cramming those onto the collection card would wreck the thing
   that makes the collection card work.

   So this is the same card seen from a different side, not a redesign. The
   rarity badge and the ringed avatar carry over, because a player must
   recognise the card they pulled. What changes is the interior: the portrait
   shrinks to make room for a stat block, and two chips — element and class —
   take the top corners.

   ── THE BAR SHOWS SHAPE, THE NUMBER SHOWS VALUE ───────────────────────────
   This is the one genuinely load-bearing decision on the card. Drawing each bar
   as a fraction of some global maximum would make every small card a row of
   stubs, which is precisely the reading the whole stat design exists to refute —
   and it would bury the thing a player actually needs to see, which is what a
   card is RELATIVELY good at.

   So the bar length is the card's SHAPE SHARE (the five sum to 1, so an even
   split draws every bar at half) and the number beside it is the absolute stat.
   A 40K-subscriber Assassin and a 40M one draw the same silhouette and carry
   different numbers, which is exactly what is true of them. */

import { battleStatsFrom } from '../engine/battle-stats.js';
import { CLASS_ABILITY, rowForSlot } from '../engine/battle.js';
import { rarityFromSubs, toCount } from '../engine/core.js';
import { elementOf, beatsOf, ELEMENT_LORE } from '../engine/element.js';
import { avatarUrlFor, TIER_NAME_SHORT } from './card.js';
import { escapeHtml, formatCount } from './util.js';

/* A glyph and a hue per element. Glyphs are drawn from the geometric block
   rather than from emoji or a webfont: this app ships no icon assets, and a
   missing glyph would leave a card with a hollow rectangle where its identity
   should be. */
export const ELEMENT_STYLE = {
  Gaming:    { glyph: '★', hue: '#b06cff' },
  Tech:      { glyph: '▲', hue: '#35d6e8' },
  Knowledge: { glyph: '■', hue: '#ffc44d' },
  Music:     { glyph: '♪', hue: '#ff6ba8' },
  Comedy:    { glyph: '◆', hue: '#ff8a3d' },
  Lifestyle: { glyph: '●', hue: '#4fd67f' },
  Unaligned: { glyph: '○', hue: '#8b93a7' },
};

export const CLASS_GLYPH = {
  Titan: '⛨', Bulwark: '⬒', Assassin: '⌁', Carry: '⚔', Riser: '↗', Balanced: '⬡',
};

const STAT_ROWS = [
  ['hp', 'HP'], ['atk', 'ATK'], ['def', 'DEF'], ['spd', 'SPD'], ['mom', 'MOM'],
];

/* Shape share -> bar width. x5 puts an even split at 50%, so half-full reads as
   "no particular talent" and the eye can find a specialist instantly. */
const barWidth = share => Math.max(3, Math.min(100, share * 5 * 50));

export function renderBattleCard(channel, { now = Date.now(), slot = null, matchup = null } = {}) {
  const stats = battleStatsFrom(channel, now);
  const element = elementOf(channel);
  const style = ELEMENT_STYLE[element] ?? ELEMENT_STYLE.Unaligned;
  const rarity = rarityFromSubs(channel.subscriberCount, channel.hiddenSubscriberCount);
  const ability = CLASS_ABILITY[stats.class];
  const avatarUrl = avatarUrlFor(channel);

  const el = document.createElement('article');
  el.className = `bcard r-${rarity} el-${element}`;
  el.style.setProperty('--el', style.hue);
  el.dataset.id = channel.id;
  el.dataset.element = element;
  el.dataset.class = stats.class;
  if (slot !== null) el.dataset.row = rowForSlot(slot);

  const bars = STAT_ROWS.map(([key, label]) => `
    <div class="bstat s-${key}">
      <em>${label}</em>
      <span class="bar"><i style="width:${barWidth(stats.shape[key]).toFixed(1)}%"></i></span>
      <b>${stats[key]}</b>
    </div>`).join('');

  el.innerHTML = `
    <div class="bcard-inner">
      <div class="bcard-top">
        <span class="rarity-badge">${rarity}</span>
        <span class="el-chip" title="${escapeHtml(element)} — beats ${escapeHtml(beatsOf(element) || 'nothing')}${ELEMENT_LORE[element]?.why ? ': ' + escapeHtml(ELEMENT_LORE[element].why) : ''}">
          <i>${style.glyph}</i>${escapeHtml(element)}
        </span>
      </div>
      <div class="bcard-face">
        <span class="bavatar"><img alt="" referrerpolicy="no-referrer" src="${escapeHtml(avatarUrl)}"></span>
        <div class="bcard-id">
          <h3>${escapeHtml(channel.title)}</h3>
          <p class="bsubs">${escapeHtml(formatCount(toCount(channel.subscriberCount)))} subs · ${escapeHtml(TIER_NAME_SHORT[rarity] ?? rarity)}</p>
        </div>
      </div>
      <span class="cls-chip c-${stats.class}"><i>${CLASS_GLYPH[stats.class] ?? '⬡'}</i>${escapeHtml(stats.class)}</span>
      <div class="bstats">${bars}</div>
      <p class="bability"><b>${escapeHtml(ability?.name ?? '')}</b> ${escapeHtml(ability?.text ?? '')}</p>
      <div class="hpbar" hidden><i></i><span></span></div>
      ${matchup ? matchupBadge(matchup) : ''}
    </div>`;

  /* Same hotlink dodge the collection card uses: a blocked avatar is removed so
     the frame shows its own background rather than a broken-image glyph. */
  const img = el.querySelector('.bavatar img');
  if (!avatarUrl) img.remove();
  else img.addEventListener('error', () => img.remove(), { once: true });

  return el;
}

/* How this card reads against the enemy line-up the player can already see.
   Shown on the card rather than in a side panel because the decision it informs
   — bring this one or not — is made while looking at the card. */
function matchupBadge({ strong = 0, weak = 0 } = {}) {
  if (!strong && !weak) return '';
  const net = strong - weak;
  const tone = net > 0 ? 'good' : net < 0 ? 'bad' : 'flat';
  const label = [strong ? `▲${strong}` : '', weak ? `▼${weak}` : ''].filter(Boolean).join(' ');
  return `<span class="matchup m-${tone}" title="Strong against ${strong}, weak against ${weak} of their five">${label}</span>`;
}

/* The arena reuses the draft card rather than drawing a second, smaller one, so
   a player watches the cards they picked actually fight. The health bar is
   revealed here rather than rendered always — it is meaningless outside a fight
   and would only be one more thing to read while building. */
export function armHealthBar(cardEl, maxHp) {
  const bar = cardEl.querySelector('.hpbar');
  bar.hidden = false;
  bar.dataset.max = String(maxHp);
  setHealth(cardEl, maxHp);
}

export function setHealth(cardEl, current) {
  const bar = cardEl.querySelector('.hpbar');
  if (!bar || bar.hidden) return;
  const max = Number(bar.dataset.max) || 1;
  const frac = Math.max(0, Math.min(1, current / max));
  bar.querySelector('i').style.width = `${frac * 100}%`;
  bar.querySelector('span').textContent = `${Math.max(0, Math.round(current))}`;
  bar.classList.toggle('is-low', frac > 0 && frac < 0.3);
  cardEl.classList.toggle('is-down', current <= 0);
}
