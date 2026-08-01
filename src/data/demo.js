/* data/demo — the bundled demo set: eight fictional channels with generated
   avatars and zero network. It is the built-in sampler, the app's default pool,
   and the offline fallback — always available even if the fetchable set
   manifest (sets/index.json) cannot be loaded.

   Authored as a full set envelope so it flows through the same parseSet →
   toCard path as any fetched set; nothing downstream can tell it apart. It
   ships inside the JS bundle rather than as a fetched file precisely so the
   default view paints instantly with no network round-trip. One channel hides
   its subscriber count on purpose, keeping that branch exercised by real use.

   Named "Starter Set" from WP4 until 2026-08-01, when it went back to "Demo" —
   "starter" reads as the beginner deck of a real game, which oversells eight
   invented channels sitting next to a 1,200-card Series 1. The WP4 fold that
   produced it is unchanged; only the label is. The `UCstarter-…` channel ids are
   deliberately NOT renamed: a saved collection keys on channel id, so changing
   them would orphan any demo cards already in someone's binder to rename a
   string no user ever sees. */

/* The generated-avatar artwork moved to engine/emblem.js when the avatar-source
   flag landed (WP8): the emblem build needs exactly this picture for real
   channels, and one proven visual beats two. The hue is derived from the
   channel id there rather than passed in, so these fictional channels are
   authored with ids chosen to spread across the wheel. */
import { emblemFor } from '../engine/emblem.js';

const avatar = (initial, hue) => emblemFor({}, { initial, hue });

/* No snapshotDate: these are invented channels, not a real snapshot, so the
   card view shows no "stats as of <month>" label — the absence signals the
   built-in sampler apart from a real, dated Series. */
export const DEMO_SET = {
  slug: 'demo',
  title: 'Demo Set',
  series: 'Demo',
  snapshotDate: '',
  channels: [
    {
      id: 'UCstarter-pixel-foundry',
      title: 'Pixel Foundry',
      handle: '@pixelfoundry',
      avatarUrl: avatar('P', 212),
      subscriberCount: '42300',
      hiddenSubscriberCount: false,
      viewCount: '3100000',
      videoCount: '214',
    },
    {
      id: 'UCstarter-unlisted-archive',
      title: 'The Unlisted Archive',
      handle: '@unlistedarchive',
      avatarUrl: avatar('U', 132),
      /* subscriberCount intentionally absent — this channel hides it */
      hiddenSubscriberCount: true,
      viewCount: '5400000',
      videoCount: '97',
    },
    {
      id: 'UCstarter-midnight-ramen',
      title: 'Midnight Ramen',
      handle: '@midnightramen',
      avatarUrl: avatar('M', 24),
      subscriberCount: '384000',
      hiddenSubscriberCount: false,
      viewCount: '41000000',
      videoCount: '327',
    },
    {
      id: 'UCstarter-glasshouse-audio',
      title: 'Glasshouse Audio',
      handle: '@glasshouseaudio',
      avatarUrl: avatar('G', 282),
      subscriberCount: '641000',
      hiddenSubscriberCount: false,
      viewCount: '88000000',
      videoCount: '156',
    },
    {
      id: 'UCstarter-kaiju-kitchen',
      title: 'Kaiju Kitchen',
      handle: '@kaijukitchen',
      avatarUrl: avatar('K', 350),
      subscriberCount: '2700000',
      hiddenSubscriberCount: false,
      viewCount: '512000000',
      videoCount: '388',
    },
    {
      id: 'UCstarter-orbit-and-oak',
      title: 'Orbit & Oak',
      handle: '@orbitandoak',
      avatarUrl: avatar('O', 196),
      subscriberCount: '6400000',
      hiddenSubscriberCount: false,
      viewCount: '1200000000',
      videoCount: '240',
    },
    {
      id: 'UCstarter-daily-meteor',
      title: 'The Daily Meteor',
      handle: '@thedailymeteor',
      avatarUrl: avatar('D', 44),
      subscriberCount: '14200000',
      hiddenSubscriberCount: false,
      viewCount: '9800000000',
      videoCount: '3120',
    },
    {
      id: 'UCstarter-supernova-plays',
      title: 'SuperNova Plays',
      handle: '@supernovaplays',
      avatarUrl: avatar('S', 4),
      subscriberCount: '61000000',
      hiddenSubscriberCount: false,
      viewCount: '32000000000',
      videoCount: '5480',
    },
  ],
};
