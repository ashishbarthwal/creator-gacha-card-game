/* data — the seam. The bundled starter set, fetched sets, and the live API all
   produce this identical Channel shape, so nothing downstream can tell them
   apart. That is why the app runs offline (the starter set is bundled, not
   fetched), why tests never need an API key, and why the starter set is a real
   set behind the seam rather than a hack.

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

export { STARTER_SET } from './starter.js';
export { fetchLiveChannel } from './youtube.js';
export { resolveChannelInput } from './resolve.js';
export { loadSet, parseSet } from './sets.js';
export { discoverChannels } from './search.js';
