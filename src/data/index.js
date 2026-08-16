/* data — the seam. Fetched sets and the live API produce this identical Channel
   shape, so nothing downstream can tell them apart. That is why the tests never
   need an API key and why a set is just data rather than a special case.

   THE BUNDLED DEMO SET WAS THE THIRD SOURCE AND WAS REMOVED 2026-08-16 (Ash's
   call — see ui/banner.js's header). It was eight fictional channels that made
   the app pullable with no network at all; nothing replaces that, and a cold
   load with no connection is now an error with a Retry rather than a fictional
   game. Its data moved to test/fixtures/demo-set.js, where it goes on being
   what it had already become: a fixture for parseSet and the emblem tests.

   The live source is still HERE and still exported, even though no shipped
   screen offers it: tools/add-candidates.js imports `fetchLiveChannel`, so it
   is pipeline code. The seam has two sources; the UI offers one.

   @typedef {Object} Channel
   @property {string}  id                     UC… channel id
   @property {string}  title
   @property {string}  handle                 "@name", or "" when unknown
   @property {string}  avatarUrl
   @property {string=} subscriberCount        decimal string; absent when hidden
   @property {boolean} hiddenSubscriberCount
   @property {string}  viewCount              decimal string
   @property {string}  videoCount             decimal string
   @property {string}  country                ISO 3166-1 alpha-2 (self-declared), "" when unset
 */

export { fetchLiveChannel } from './youtube.js';
export { resolveChannelInput } from './resolve.js';
export { loadSet, parseSet } from './sets.js';
export { discoverChannels } from './search.js';
