/* config — the dev/prod seam. One question answered in one place: is this a
   development build or something a stranger is looking at?

   Detected at runtime rather than compiled in, because the project has no build
   step (CLAUDE.md) and a deployed file is served exactly as it sits in the repo.
   That constraint rules out the usual approaches — there is no bundler to swap a
   constant, no environment variable a browser can read — so hostname is what is
   actually available. It is enough: dev affordances hidden on a real domain is
   the requirement, not tamper-proofing.

   The override runs both ways, and the second direction is the one that earns
   its keep:

     ?dev=1   force dev on a real host — debug a deployed build, no redeploy
     ?dev=0   force PROD on localhost — see exactly what a stranger sees

   Without `?dev=0` the production view is only reachable by serving over a LAN
   IP and typing it in, which is enough friction that nobody checks, and the
   whole point of this file is that the deployed build hides its dev tools. A
   guardrail nobody can see is a guardrail nobody verifies.

   Both directions are safe to leave open: everything the flag reveals (Dev Pull,
   Magic Search) either operates on cards the visitor can already see or requires
   them to supply their own API key and spend their own quota. Nothing behind it
   is privileged. */

const DEV_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '']);
const OFF = new Set(['0', 'false', 'no']);

function detectDev() {
  if (typeof location === 'undefined') return false;   // non-browser (tests, Node tools)
  const flag = new URLSearchParams(location.search).get('dev');
  if (flag !== null) return !OFF.has(flag.toLowerCase());
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
