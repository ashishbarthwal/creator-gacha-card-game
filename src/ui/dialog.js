/* Modal focus and background isolation, including inspect-over-reveal. */
const stack = [];
const focusable = 'button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]';
export function activateDialog(el, initial) {
  if (stack.some(entry => entry.el === el)) return;
  const previous = document.activeElement;
  /* The existing card inspector can sit above the reveal.  It owns its own
     open/close behaviour, so making all sibling overlays inert here would make
     that inspector unreachable. The full-screen scrim still blocks pointers;
     this utility supplies the focus trap only. */
  stack.push({ el, previous });
  initial?.focus({ preventScroll: true });
}
export function deactivateDialog(el, restoreFocus = true) {
  const entry = stack.at(-1);
  if (!entry || entry.el !== el) return;
  stack.pop();
  if (restoreFocus && entry.previous?.isConnected) entry.previous.focus({ preventScroll: true });
}
document.addEventListener('keydown', event => {
  const entry = stack.at(-1);
  if (!entry || event.key !== 'Tab') return;
  const controls = [...entry.el.querySelectorAll(focusable)]
    .filter(node => !node.closest('[hidden]') && node.getClientRects().length);
  if (!controls.length) return;
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && (document.activeElement === first || !entry.el.contains(document.activeElement))) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !entry.el.contains(document.activeElement))) {
    event.preventDefault(); first.focus();
  }
});
