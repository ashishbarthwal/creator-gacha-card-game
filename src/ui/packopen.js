/* A brief response on the actual pack. Results are already banked. */
import { RARITY_ORDER } from '../engine/core.js';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const colors = ['#9aa3b2', '#cdd8ea', '#ffcf6b', '#7fe7ff', '#65d1b5', '#ef695d'];
let cancel = null;
export function playPackOpen(results) {
  cancel?.();
  const pack = document.getElementById('pack-open');
  if (!pack || reduced.matches) return Promise.resolve();
  const rank = Math.max(0, ...results.map(r => RARITY_ORDER.indexOf(r.card.rarity)));
  pack.style.setProperty('--pull-color', colors[rank]);
  pack.classList.add('is-opening');
  return new Promise(resolve => {
    let timer;
    const finish = () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', skip);
      document.removeEventListener('pointerdown', skip);
      reduced.removeEventListener('change', motionChanged);
      pack.classList.remove('is-opening');
      cancel = null;
      resolve();
    };
    const start = performance.now();
    const skip = () => { if (performance.now() - start > 100) finish(); };
    const motionChanged = () => { if (reduced.matches) finish(); };
    cancel = finish;
    document.addEventListener('keydown', skip);
    document.addEventListener('pointerdown', skip);
    reduced.addEventListener('change', motionChanged);
    timer = setTimeout(finish, 360);
  });
}
export function cancelPackOpen() { cancel?.(); }
