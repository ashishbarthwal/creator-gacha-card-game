/* config — the dev/prod seam. One question answered in one place: is this a
   development build or something a stranger is looking at?

   Detected at runtime rather than compiled in, because the project has no build
   step (CLAUDE.md) and a deployed file is served exactly as it sits in the repo.
   That constraint rules out the usual approaches — there is no bundler to swap a
   constant, no environment variable a browser can read — so hostname is what is
   actually available. It is enough: dev affordances hidden on a real domain is
   the requirement, not tamper-proofing.

   `?dev=1` forces dev mode on any host. That is deliberate and safe: everything
   it reveals (Dev Pull, Magic Search) either operates on cards the visitor can
   already see or requires them to supply their own API key and spend their own
   quota. Nothing behind this flag is privileged, so the escape hatch costs
   nothing and makes a deployed build debuggable without a redeploy. */

const DEV_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '']);

function detectDev() {
  if (typeof location === 'undefined') return false;   // non-browser (tests, Node tools)
  if (new URLSearchParams(location.search).has('dev')) return true;
  return DEV_HOSTS.has(location.hostname) || location.hostname.endsWith('.local');
}

export const IS_DEV = detectDev();

/* Hide an element unless this is a dev build, and mark it so CSS and anyone
   reading the DOM can tell the difference between "hidden because prod" and
   "hidden because the UI is in another mode". Removing outright would break the
   `?dev=1` escape hatch and the module-level DOM refs that already exist. */
export function gateDevElement(el) {
  if (!el) return;
  el.dataset.devOnly = 'true';
  if (!IS_DEV) el.hidden = true;
}
