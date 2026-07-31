/* ui/inspect — click a collection card to admire it large.
   A centered overlay over a blurred backdrop, holding one enlarged card with
   the same pointer tilt + holo finish enabled, so the card can be turned in
   the light. Self-contained close wiring (button, backdrop click, Escape),
   and it restores focus to whatever opened it. main just imports nothing —
   collection.js calls openInspect. */

import { renderCard } from './card.js';
import { enableCardTilt } from './holo.js';
import { downloadCard } from './share.js';
import { state } from '../state.js';

const inspectEl = document.getElementById('inspect');
const inspectHolder = document.getElementById('inspect-holder');
const inspectClose = document.getElementById('inspect-close');
const inspectSave = document.getElementById('inspect-save');
const inspectNote = document.getElementById('inspect-note');
let lastTrigger = null;
let openCard = null;

/* Delegated on the persistent holder, so it keeps working as the card inside
   is swapped out on each open. */
enableCardTilt(inspectHolder);

export function openInspect(card, meta = {}) {
  lastTrigger = document.activeElement;
  openCard = card;
  inspectHolder.innerHTML = '';
  inspectHolder.appendChild(renderCard(card, meta));
  inspectNote.textContent = '';
  inspectEl.hidden = false;
  inspectClose.focus();
}

/* The export reads the tier palette off the rendered card, so it needs the live
   element rather than the card object alone — which is why this lives here, on
   the one screen that already has an enlarged card in the document.

   The snapshot date comes from the loaded set, so the stamp dates the statistics
   it is actually showing. A live-mode or starter-set card has none, and the
   caption drops that clause rather than inventing one. */
async function onSave() {
  if (!openCard) return;
  const el = inspectHolder.querySelector('.card');
  if (!el) return;
  inspectSave.disabled = true;
  inspectSave.textContent = 'Saving…';
  inspectNote.textContent = '';
  try {
    await downloadCard(openCard, el, { snapshotDate: state.currentSet?.snapshotDate });
    inspectNote.textContent = 'Saved. The image carries the unofficial-fan-card notice.';
  } catch (err) {
    inspectNote.textContent = err.message;
  } finally {
    inspectSave.disabled = false;
    inspectSave.textContent = 'Save as PNG';
  }
}

/* The reveal overlay can sit underneath this one, and both answer Escape — so
   it needs to be able to ask whether it is the top overlay before acting. */
export function isInspectOpen() {
  return !inspectEl.hidden;
}

export function closeInspect() {
  inspectEl.hidden = true;
  inspectHolder.innerHTML = '';
  inspectNote.textContent = '';
  openCard = null;
  if (lastTrigger?.focus) lastTrigger.focus();
  lastTrigger = null;
}

inspectSave.addEventListener('click', onSave);
inspectClose.addEventListener('click', closeInspect);
inspectEl.addEventListener('click', e => { if (e.target === inspectEl) closeInspect(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !inspectEl.hidden) closeInspect(); });
