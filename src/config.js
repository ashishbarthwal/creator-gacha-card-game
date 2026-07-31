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

/* ─────────────────────────────────────────────────────────────────────────────
   AVATAR SOURCE — the launch's reversibility switch.

     'photo'   the creator's real profile picture, hotlinked from Google
     'emblem'  a deterministic generated emblem (engine/emblem.js), no network

   DECISIONS.md (2026-07-31) promoted this from hardening to a launch
   prerequisite. The first release ships real pictures knowingly — the emblem
   build is the safer artifact but the weaker experiment, and the question the
   release exists to answer cannot be answered by a version stripped of the thing
   that makes it legible. What makes that decision defensible is that it is
   REVERSIBLE: if a creator objects, or the read of the room changes, this line
   changes and the site redeploys. Launching without the switch is what would
   make it permanent.

   It is one flag over one codebase, never a fork. A stale fork reads worse than
   not building the thing, and commit history cannot be faked — so both builds
   have to be the same repo with a switch in it.

   `?avatars=emblem` previews the other build without a redeploy, which is also
   how the switch stays trustworthy: a flag nobody can exercise is a flag nobody
   knows still works. */
const AVATAR_SOURCES = new Set(['photo', 'emblem']);
const AVATAR_DEFAULT = 'photo';

function detectAvatarSource() {
  if (typeof location === 'undefined') return AVATAR_DEFAULT;
  const asked = new URLSearchParams(location.search).get('avatars');
  return AVATAR_SOURCES.has(asked) ? asked : AVATAR_DEFAULT;
}

export const AVATAR_SOURCE = detectAvatarSource();
export const USE_EMBLEMS = AVATAR_SOURCE === 'emblem';

/* Hide an element unless this is a dev build, and mark it so CSS and anyone
   reading the DOM can tell the difference between "hidden because prod" and
   "hidden because the UI is in another mode". Removing outright would break the
   `?dev=1` escape hatch and the module-level DOM refs that already exist. */
export function gateDevElement(el) {
  if (!el) return;
  el.dataset.devOnly = 'true';
  if (!IS_DEV) el.hidden = true;
}
