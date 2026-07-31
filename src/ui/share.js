/* ui/share — draw a card to a canvas and hand back a PNG.

   WHY THIS IS HAND-DRAWN RATHER THAN A DOM SNAPSHOT.
   The obvious approach is html2canvas or similar, and it is unavailable on
   principle: the project has zero runtime dependencies and no build step
   (CLAUDE.md), so a 200KB rasteriser is not on the table. Drawing the card again
   in canvas is more code, but it is code that ships as-is and is readable.

   THE PALETTE IS READ FROM THE LIVE ELEMENT, NOT RE-TYPED HERE.
   Every tier colour already exists exactly once, as the --t-* custom properties
   on `.r-N` … `.r-UR` in styles.css. Copying those hex values into JS would
   create a second source of truth that drifts silently the first time a tier is
   retuned — the export would keep printing last month's gold. So this reads them
   off a rendered card with getComputedStyle. The consequence worth knowing: the
   card element must be IN THE DOCUMENT when export runs, because a detached node
   has no computed custom properties.

   CORS, WHICH DECIDED WHETHER THIS FEATURE COULD EXIST AT ALL.
   Drawing a cross-origin image onto a canvas taints it, and a tainted canvas
   throws SecurityError on toBlob — no PNG, at all. `accentFor` in ui/card.js has
   carried a tainted-canvas fallback since WP3 for exactly this reason. Measured
   2026-08-01: Google's avatar CDN sends `Access-Control-Allow-Origin: *`, so an
   image requested with crossOrigin='anonymous' draws clean and the export can
   carry the real face. It is still treated as failable — a 403, a missing
   avatar, or a CDN policy change all fall back to the monogram rather than
   losing the export. */

import { toCount } from '../engine/core.js';
import { emblemFor } from '../engine/emblem.js';
import { USE_EMBLEMS } from '../config.js';
import { shareCaption, shareFilename } from '../engine/share.js';
import { formatCount } from './util.js';

/* 5:7, matching .card's aspect-ratio, at 2x so the PNG stands up to a retina
   timeline without being so large that a phone struggles to encode it. */
const W = 700;
const H = 980;
const SCALE = 2;

const TIER_NAME = { N: 'Graphite', R: 'Silver', SR: 'Gold', SSR: 'Diamond', UR: 'Red Diamond' };

/* Read the tier tokens off the rendered card. Falls back to a readable grey so a
   detached or unstyled element yields a plain card rather than an exception. */
function paletteFrom(el) {
  const style = getComputedStyle(el);
  const read = (name, fallback) => (style.getPropertyValue(name).trim() || fallback);
  return {
    hi: read('--t-hi', '#c9ced8'),
    mid: read('--t-mid', '#828a97'),
    lo: read('--t-lo', '#4d535e'),
    soft: read('--t-soft', '#a7adb8'),
    glow: read('--t-glow', '#9aa3b2'),
    ink: read('--t-ink', '#12151b'),
    accent: read('--accent', '#9aa3b2'),
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/* The conic bevel of .card, approximated with a linear sweep. A canvas conic
   gradient exists but is not universally available, and the frame reads as metal
   because of the light/dark alternation rather than the exact sweep geometry. */
function bevel(ctx, palette) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0.00, palette.mid);
  g.addColorStop(0.18, palette.hi);
  g.addColorStop(0.38, palette.lo);
  g.addColorStop(0.55, palette.soft);
  g.addColorStop(0.72, palette.hi);
  g.addColorStop(0.88, palette.lo);
  g.addColorStop(1.00, palette.mid);
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, W, H, 30);
  ctx.fill();
}

/* Wrap to at most `maxLines`, ellipsising the last one. Breaks on spaces where
   it can and mid-word where it cannot — a single unbroken 40-character title is
   common enough (and was a real bug on the card face) to need handling. */
function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  const pushChunked = word => {
    let chunk = '';
    for (const ch of word) {
      if (ctx.measureText(chunk + ch).width > maxWidth && chunk) { lines.push(chunk); chunk = ch; }
      else chunk += ch;
    }
    line = chunk;
  };
  for (const word of words) {
    if (lines.length >= maxLines) break;
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) { line = next; continue; }
    if (line) lines.push(line);
    if (ctx.measureText(word).width > maxWidth) pushChunked(word);
    else line = word;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const kept = lines.slice(0, maxLines);
  if (lines.length > maxLines || (kept.length === maxLines && ctx.measureText(kept[maxLines - 1]).width > maxWidth)) {
    let last = kept[maxLines - 1] ?? '';
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
  }
  return kept;
}

/* Load the avatar so it can be drawn without tainting. Resolves to null on any
   failure, which the caller renders as the monogram — the same fallback the card
   face uses for a 403. An emblem is a data URI and needs no CORS at all. */
function loadAvatar(channel) {
  const url = USE_EMBLEMS ? emblemFor(channel) : channel.avatarUrl;
  if (!url) return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new Image();
    if (!url.startsWith('data:')) {
      img.crossOrigin = 'anonymous';           // required, or toBlob throws
      img.referrerPolicy = 'no-referrer';      // the hotlink-403 dodge, as on the card
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawAvatar(ctx, img, initial, palette, cx, cy, r) {
  // ring
  const ring = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ring.addColorStop(0, palette.lo);
  ring.addColorStop(0.35, palette.hi);
  ring.addColorStop(0.7, palette.glow);
  ring.addColorStop(1, palette.lo);
  ctx.beginPath();
  ctx.arc(cx, cy, r + 12, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#171c27';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (img) {
    /* Cover-fit: avatars are square in practice, but a non-square one should
       crop rather than stretch a face. */
    const side = Math.min(img.width, img.height) || 1;
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.font = `700 ${r}px 'Anton', 'Arial Narrow', Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, cx, cy + 2);
  }
  ctx.restore();
}

function statBox(ctx, label, value, x, y, w, h, palette) {
  roundRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `700 20px 'Space Mono', ui-monospace, monospace`;
  ctx.fillText(label, x + 18, y + 34);

  ctx.fillStyle = palette.glow;
  ctx.font = `700 40px 'Space Mono', ui-monospace, monospace`;
  ctx.textAlign = 'right';
  ctx.fillText(String(value), x + w - 18, y + h - 20);
}

/* Draw the whole card. `el` is the live card element the palette is read from. */
async function drawCard(ctx, card, el, { snapshotDate }) {
  const { channel, rarity, atk, def } = card;
  const palette = paletteFrom(el);
  const initial = [...String(channel.title)][0]?.toUpperCase() ?? '?';

  bevel(ctx, palette);

  // inner face
  const pad = 12;
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 22);
  ctx.fillStyle = '#12161f';
  ctx.fill();
  ctx.save();
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 22);
  ctx.clip();

  // accent wash from the top, mirroring the card's radial tint
  const wash = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.8);
  wash.addColorStop(0, palette.accent);
  wash.addColorStop(0.35, 'rgba(26,33,48,0.35)');
  wash.addColorStop(1, 'transparent');
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // monogram behind everything
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  ctx.font = `400 460px 'Anton', 'Arial Narrow', Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, W / 2, H / 2 - 40);

  // rarity badge
  const badgeW = 96, badgeH = 46;
  const badge = ctx.createLinearGradient(40, 44, 40 + badgeW, 44 + badgeH);
  badge.addColorStop(0, palette.hi);
  badge.addColorStop(1, palette.lo);
  roundRect(ctx, 40, 44, badgeW, badgeH, 10);
  ctx.fillStyle = badge;
  ctx.fill();
  ctx.fillStyle = palette.ink;
  ctx.font = `400 30px 'Anton', 'Arial Narrow', Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rarity, 40 + badgeW / 2, 44 + badgeH / 2 + 2);

  // tier label
  ctx.fillStyle = palette.glow;
  ctx.font = `700 19px 'Space Mono', ui-monospace, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`◆ ${TIER_NAME[rarity] ?? ''}`, 40, 44 + badgeH + 24);

  // name + handle, right-aligned against the badge column
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f3f5f9';
  ctx.font = `400 40px 'Space Grotesk', system-ui, sans-serif`;
  const nameLines = wrapText(ctx, channel.title, W - 220, 2);
  nameLines.forEach((line, i) => ctx.fillText(line, W - 40, 46 + i * 46));
  if (channel.handle) {
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.font = `400 22px 'Space Mono', ui-monospace, monospace`;
    ctx.fillText(channel.handle, W - 40, 46 + nameLines.length * 46 + 6);
  }

  // avatar centrepiece
  const img = await loadAvatar(channel);
  drawAvatar(ctx, img, initial, palette, W / 2, H / 2 - 20, 168);

  // subs line
  const subs = channel.hiddenSubscriberCount
    ? 'subs hidden'
    : `${formatCount(toCount(channel.subscriberCount))} subs`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = `400 30px 'Space Mono', ui-monospace, monospace`;
  ctx.fillText(subs, W / 2, H - 232);

  // stats
  const boxW = (W - 80 - 20) / 2;
  statBox(ctx, 'ATK', atk, 40, H - 208, boxW, 88, palette);
  statBox(ctx, 'DEF', def, 40 + boxW + 20, H - 208, boxW, 88, palette);

  /* The stamp. Burned in rather than left to page context, because the risk this
     line manages peaks exactly when the image is somewhere we do not control. */
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.40)';
  ctx.font = `400 17px 'Space Mono', ui-monospace, monospace`;
  ctx.fillText(shareCaption({ snapshotDate }), W / 2, H - 42);

  ctx.restore();
}

/* Render `card` to a PNG blob. `el` must be a card element in the document — the
   palette is read from it. */
export async function cardToBlob(card, el, { snapshotDate } = {}) {
  /* Web fonts are loaded by a stylesheet link, so the first export can otherwise
     rasterise in a fallback face. Awaiting once is cheap and idempotent. */
  if (document.fonts?.ready) await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  await drawCard(ctx, card, el, { snapshotDate });

  return new Promise((resolve, reject) => {
    /* Throws SecurityError if anything drawn tainted the canvas. It should not —
       the avatar is requested with crossOrigin and falls back to a monogram —
       but this is the one failure that must surface rather than hang. */
    try {
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not encode the image.'))), 'image/png');
    } catch {
      reject(new Error('The image could not be exported (the avatar blocked canvas access).'));
    }
  });
}

export async function downloadCard(card, el, { snapshotDate } = {}) {
  const blob = await cardToBlob(card, el, { snapshotDate });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = shareFilename(card);
  document.body.appendChild(a);
  a.click();
  a.remove();
  /* Revoked on the next tick rather than immediately: Safari has historically
     cancelled an in-flight download when the object URL went away too early. */
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
