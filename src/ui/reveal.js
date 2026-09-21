/* A bounded reveal: rarity cue, short arrival, then a completely idle grid.
   Results are sorted before rendering so visual and keyboard order agree. */
import { RARITY_ORDER } from '../engine/core.js';
import { renderCard } from './card.js';
import { openInspect, isInspectOpen } from './inspect.js';
import { activateDialog, deactivateDialog } from './dialog.js';
import { STARS, makeStars } from './stars.js';

const el = document.getElementById('reveal');
const grid = document.getElementById('reveal-grid');
const done = document.getElementById('reveal-done');
const again = document.getElementById('reveal-again');
const skip = document.getElementById('reveal-skip');
const progress = document.getElementById('reveal-progress');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let onAgain = null, onDismiss = null, size = null;
let timers = [], cells = [], revealed = 0;
const resultsByCell = new WeakMap();
const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

export function initReveal({ onPullAgain = null, packSize = null, onDismiss: dismiss = null } = {}) {
  onAgain = onPullAgain; onDismiss = dismiss; size = packSize;
  again.hidden = !onAgain;
}
function columns() {
  const cap = innerWidth <= 560 ? 2 : innerWidth <= 899 ? 3 : 5;
  grid.style.setProperty('--reveal-cols', Math.max(1, Math.min(cells.length, cap)));
}
function updateProgress() {
  // Keep the skip control in the tab order, in place, even after completion.
  skip.disabled = revealed === cells.length;
  skip.textContent = skip.disabled ? 'All revealed' : 'Reveal all';
  progress.textContent = `${revealed} / ${cells.length} revealed`;
}
function flip(cell, animate = true) {
  if (cell.classList.contains('flipped')) return;
  cell.classList.remove('beaming');
  cell.classList.add('flipped');
  const result = resultsByCell.get(cell);
  cell.setAttribute('aria-label', `View ${result.card.channel.title} up close`);
  cell.querySelector('.front').removeAttribute('aria-hidden');
  if (animate && !reduced.matches) {
    cell.classList.add('revealing');
    later(() => cell.classList.remove('revealing'), 240);
  }
  revealed++;
  updateProgress();
}
function revealAll() {
  clearTimers();
  for (const cell of cells) {
    cell.classList.remove('revealing');
    flip(cell, false);
  }
  if (document.activeElement === skip) done.focus({ preventScroll: true });
}
export function openReveal(results) {
  clearTimers(); revealed = 0;
  const sorted = [...results].sort((a,b) => RARITY_ORDER.indexOf(a.card.rarity) - RARITY_ORDER.indexOf(b.card.rarity));
  cells = sorted.map((result, index) => {
    const cell = document.createElement('div');
    cell.className = 'reveal-cell';
    cell.tabIndex = 0;
    cell.setAttribute('role', 'button');
    cell.setAttribute('aria-label', `Reveal card ${index + 1}`);
    cell.innerHTML = '<div class="flip"><div class="flip-inner"><div class="face back card-back" aria-hidden="true"><div class="back-play">CG&#8599;</div><div class="back-word">CREATOR GACHA</div><div class="back-edition">CORE SET / 01</div></div><div class="face front" aria-hidden="true"></div></div></div>';
    const front = cell.querySelector('.front');
    front.append(renderCard(result.card, { isNew: result.isNew, eager: index < 5 }));
    // The configured scattered field belongs to the card finish, not to the
    // shortened timing sequence. UR and RUBY share the restrained field.
    if (STARS[result.card.rarity]) front.append(makeStars(result.card.rarity));
    resultsByCell.set(cell, result);
    return cell;
  });
  grid.replaceChildren(...cells);
  columns(); updateProgress();
  const n = size?.() ?? results.length;
  again.textContent = n > 1 ? `Open another ${n}` : 'Open another card';
  el.hidden = false; el.scrollTop = 0;
  activateDialog(el, done);
  if (reduced.matches) return revealAll();
  // Fixed cadence bounds a ten-card reveal to 2.1s, even with ten top tiers.
  // Only cards currently visible animate; offscreen results settle directly.
  cells.forEach((cell, index) => {
    later(() => {
      if (cell.classList.contains('flipped')) return;
      const rect = cell.getBoundingClientRect();
      if (document.hidden || rect.top >= innerHeight || rect.bottom <= 0) return flip(cell, false);
      flip(cell);
    }, 100 + index * 180);
  });
}
function hide(restore = true) {
  clearTimers();
  el.hidden = true;
  deactivateDialog(el, restore);
  grid.replaceChildren(); cells = [];
}
export function closeReveal() { hide(); onDismiss?.(); }
skip.addEventListener('click', revealAll);
done.addEventListener('click', closeReveal);
again.addEventListener('click', () => { if (onAgain) { hide(false); onAgain(); } });
el.addEventListener('click', event => {
  if (revealed !== cells.length || cells.length === 0 || isInspectOpen()) return;
  if (event.target.closest?.('.reveal-cell, button, a, input, select, textarea')) return;
  closeReveal();
});
function activate(event) {
  const cell = event.target.closest?.('.reveal-cell');
  if (!cell || !grid.contains(cell)) return;
  if (!cell.classList.contains('flipped')) return flip(cell);
  const result = resultsByCell.get(cell);
  openInspect(result.card, { isNew: result.isNew });
}
grid.addEventListener('click', activate);
grid.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(event); }
});
addEventListener('resize', () => { if (!el.hidden) columns(); });
reduced.addEventListener('change', () => { if (reduced.matches && !el.hidden) revealAll(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !el.hidden) revealAll(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !el.hidden && !isInspectOpen()) { event.preventDefault(); closeReveal(); }
}, true);
