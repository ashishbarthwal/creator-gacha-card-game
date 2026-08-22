/* ui/card — card markup + render, plus the per-channel accent logic.
   The frame and finish carry the look. WP3 promoted the avatar from a small
   inset to a ringed centrepiece (the finish is layered *below* it so a real
   face is never colour-shifted); the accent is still sampled from the avatar,
   and the channel initial sits behind it as a faint monogram. */

import { toCount } from '../engine/core.js';
import { battleStatsFrom } from '../engine/battle-stats.js';
import { emblemFor, emblemAccent } from '../engine/emblem.js';
import { USE_EMBLEMS } from '../config.js';
import { escapeHtml, formatCount } from './util.js';
import { makeEdgeTwinkles, makeFrameTwinkles } from './stars.js';

/* The one place the avatar-source switch is read. Everything downstream — the
   ring, the tilt, the reveal, the 403 fallback — is handed a URL and stays
   ignorant of where it came from, which is what keeps this a flag rather than a
   second rendering path. An emblem is a data URI, so it makes no request.

   Exported for ui/battle-card.js, which draws the same creator from a different
   side and must obey the same switch. A second reader of USE_EMBLEMS would be a
   second place for `?avatars=emblem` to be forgotten — and the whole value of
   that flag is that exercising it proves it still works everywhere. */
export function avatarUrlFor(channel) {
  return USE_EMBLEMS ? emblemFor(channel) : channel.avatarUrl;
}

function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
    case g: h = (b - r) / d + 2; break;
    default: h = (r - g) / d + 4;
  }
  return [h * 60, s, l];
}

function hashAccent(seed) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}

/* Accent color per channel: sample the avatar when the canvas stays clean,
   fall back to a hash of the id when CORS taints it. Cached as a promise. */
const accentCache = new Map();

function accentFor(channel) {
  if (accentCache.has(channel.id)) return accentCache.get(channel.id);
  const fallback = hashAccent(channel.id);
  /* In emblem mode there is no photograph to sample, and the emblem already
     knows its own hue — so take it directly rather than rasterising a data URI
     to read back a colour we generated. Synchronous, and it skips the canvas
     entirely (the tainted-canvas branch below exists only for real avatars). */
  if (USE_EMBLEMS) {
    const promise = Promise.resolve(emblemAccent(channel));
    accentCache.set(channel.id, promise);
    return promise;
  }
  const promise = new Promise(resolve => {
    if (!channel.avatarUrl) return resolve(fallback);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer'; // same hotlink-block dodge as the visible avatar
    img.onload = () => {
      try {
        const size = 12;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
        const [h, s, l] = rgbToHsl(r / n, g / n, b / n);
        if (s < 0.08) return resolve(fallback); // near-grey avatar: hash reads better
        resolve(`hsl(${Math.round(h)} ${Math.round(clamp(s, 0.45, 0.85) * 100)}% ${Math.round(clamp(l, 0.42, 0.6) * 100)}%)`);
      } catch {
        resolve(fallback); // canvas tainted by a non-CORS avatar
      }
    };
    img.onerror = () => resolve(fallback);
    img.src = channel.avatarUrl;
  });
  accentCache.set(channel.id, promise);
  return promise;
}

/* Rarity band → YouTube Creator Award tier name. The bands are literally the
   play-button subscriber thresholds, so the awards name the tiers.

   UR/RUBY here are the internal band keys (unchanged, so saved collections
   and the pull engine never see this), not the award names — those were
   swapped 2026-08-07 to match the real thresholds: the Ruby Play Button is
   50M subs (UR's band), the Red Diamond Play Button — a dark red crystal set
   in silver-plated metal — is 100M (RUBY's band). PewDiePie nicknamed his 50M
   trophy "Ruby" on camera and it stuck. The badge chip still shows the short
   code (UR/RUBY); this is only the full name under it. */
export const TIER_NAME = {
  N:    'Graphite',
  R:    'Silver',
  SR:   'Gold',
  SSR:  'Diamond',
  UR:   'Ruby Play Button',
  RUBY: 'Red Diamond Play Button',
};

/* The same ladder, short enough for a battle card's one-line subtitle, where
   "Red Diamond Play Button" would wrap and crowd out the subscriber count.
   Kept beside the full names rather than in ui/battle-card.js so the two can
   only ever be edited together — the award names moved once already
   (2026-08-07, when they were corrected against the real thresholds) and a
   second table one folder over would have been missed. */
export const TIER_NAME_SHORT = {
  N: 'Graphite', R: 'Silver', SR: 'Gold', SSR: 'Diamond', UR: 'Ruby', RUBY: 'Red Diamond',
};

/* THE TWO NUMBERS ON THE CARD ARE THE NUMBERS IT FIGHTS WITH (2026-08-09).

   They used to come from `core.statsFrom`, which multiplied a raw view count by
   a rarity multiplier — so the printed ATK correlated with subscriber count at
   0.897 and no N card could ever out-stat a UR. The battle engine never agreed
   with any of that. See the header of engine/core.js for the measurements.

   ATK and DEF, not all five, and no bars: the battle card
   (ui/battle-card.js) exists precisely so this one does not have to answer
   "what does this do in a fight". This card shows a creator and is an object to
   want. What changed is only that its two numbers stopped being fiction — a
   card whose ATK reads 168 really does hit for 168, and the small channel that
   out-punches a giant now says so on its face.

   The class name rides along in the subs line, because without it a low ATK
   reads as "bad card" rather than "this one is built out of something else".
   It costs one word and no layout: `.subs-line` is already a two-child flex. */
export function renderCard(card, { isNew = false, count = 0 } = {}) {
  const { channel, rarity } = card;
  const { atk, def, class: klass } = battleStatsFrom(channel);
  const el = document.createElement('article');
  el.className = `card r-${rarity}`;
  const initial = [...channel.title][0]?.toUpperCase() ?? '?';
  const subsLabel = channel.hiddenSubscriberCount
    ? 'subs hidden'
    : `${formatCount(toCount(channel.subscriberCount))} subs`;
  const handle = channel.handle ? escapeHtml(channel.handle) : '';
  const avatarUrl = avatarUrlFor(channel);
  el.innerHTML = `
    <div class="card-inner">
      <div class="monogram" aria-hidden="true">${escapeHtml(initial)}</div>
      <div class="card-top">
        <div class="badge-col">
          <span class="rarity-badge">${rarity}</span>
          <span class="tier-label" aria-hidden="true">&#9670; ${TIER_NAME[rarity]}</span>
        </div>
        <div class="title-wrap">
          <h3 class="card-name">${escapeHtml(channel.title)}</h3>
          ${handle ? `<span class="card-handle">${handle}</span>` : ''}
        </div>
      </div>
      <div class="avatar-stage">
        <div class="avatar-ring"><img class="avatar" alt="" referrerpolicy="no-referrer" src="${escapeHtml(avatarUrl)}"></div>
        ${count > 1 ? `<span class="count-badge">×${count}</span>` : ''}
        ${isNew ? '<span class="new-badge">NEW</span>' : ''}
      </div>
      <div class="card-bottom">
        <div class="subs-line"><span>${escapeHtml(subsLabel)}</span><span class="card-class">${escapeHtml(klass)}</span></div>
        <div class="stats">
          <div class="stat atk"><em>ATK</em><b>${atk}</b></div>
          <div class="stat def"><em>DEF</em><b>${def}</b></div>
        </div>
      </div>
      <div class="holo" aria-hidden="true"></div>
    </div>`;
  /* YouTube avatar URLs can 403 on a hotlink referer (the referrerpolicy above
     is the usual dodge), and a few channels have no usable thumbnail at all. If
     the image still can't load, drop it so the faint monogram behind shows as the
     intended fallback instead of a broken-image glyph. */
  const avatar = el.querySelector('.avatar');
  if (!avatarUrl) avatar.remove();
  else avatar.addEventListener('error', () => avatar.remove(), { once: true });
  /* THE TWO TOP TIERS GET THE POINT TWINKLE, and it is built HERE rather than
     in the reveal so it belongs to the card instead of to a moment — one of
     these sitting in the binder keeps catching light, which is the whole of
     what Ash asked for. Appended inside `.card-inner` so its
     `overflow: hidden` clips the points to the rounded face and none can ever
     sit on the metal bevel. RUBY runs a lower count than UR on purpose — see
     the comment above `makeEdgeTwinkles` in stars.js: RUBY's own principle
     everywhere else is fewer, larger, slower, and this is no exception. */
  if (rarity === 'UR') el.querySelector('.card-inner').append(makeEdgeTwinkles(8));
  if (rarity === 'RUBY') el.querySelector('.card-inner').append(makeEdgeTwinkles(5));
  /* UR ALONE also gets the frame twinkle — RUBY's own frame already catches
     light (the `::after` glints + the inspector's travelling `.gem-edge`), so
     this is what closes the same gap on UR's side. A sibling of `.card-inner`,
     not a child of it: the bevel band is `.card`'s own background, outside
     `.card-inner`'s box entirely, so appending here needs no clipping and no
     z-index trick. See `makeFrameTwinkles` in stars.js for why the shape stays
     a point rather than borrowing RUBY's crossed-ellipse glint. */
  if (rarity === 'UR') el.append(makeFrameTwinkles());
  accentFor(channel).then(color => el.style.setProperty('--accent', color));
  return el;
}
