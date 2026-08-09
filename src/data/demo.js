/* data/demo — the bundled demo set: nine fictional channels with generated
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

/* ── THE NUMBERS WERE RE-AUTHORED 2026-08-09, AND THEY HAD TO BE ───────────
   These nine channels are invented, so their counts exist to DEMONSTRATE the
   derivation — and they were authored against a derivation that no longer
   exists. The card face used to print `log10(views) x 120 x rarityMultiplier`,
   so escalating view counts and a rising band produced a tidy escalating card,
   and the counts were chosen to make exactly that happen.

   When the card face moved onto the battle derivation (see engine/core.js) that
   authoring inverted. Attack is now views PER UPLOAD measured against what a
   channel that size manages, and the big demo channels had been given enormous
   libraries — 5,480 and 8,200 videos — so the two rarest cards in the sampler
   came out with the two WORST attacks in it: the RUBY printed ATK 26 against a
   common's 179. On the bundled, offline, first-thing-a-visitor-sees set. That is
   the "punishing a good pull" failure the whole change exists to avoid, and it
   was caught by checking the demo set rather than by trusting the live deck.

   Re-solved against the real engine so the sampler now teaches the design in
   nine cards: rating climbs 399 -> 548 from the N to the RUBY, the RUBY is the
   strongest card in the set and the N the weakest, five of the six classes
   appear, and one deliberate upset is left in — Orbit & Oak is an SR that
   out-rates the UR, because 16M views per upload beats being large. Bulwark is
   the one class missing, which is honest: it is 5.2% of the real deck.

   Regenerate rather than hand-edit if the derivation moves again. The counts
   have no meaning beyond the stats they produce. */

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
      viewCount: '4000000',
      videoCount: '40',
      publishedAt: '2019-03-12T00:00:00Z',
    },
    {
      id: 'UCstarter-unlisted-archive',
      title: 'The Unlisted Archive',
      handle: '@unlistedarchive',
      avatarUrl: avatar('U', 132),
      /* subscriberCount intentionally absent — this channel hides it */
      hiddenSubscriberCount: true,
      viewCount: '1000000',
      videoCount: '440',
      publishedAt: '2009-06-04T00:00:00Z',
    },
    {
      id: 'UCstarter-midnight-ramen',
      title: 'Midnight Ramen',
      handle: '@midnightramen',
      avatarUrl: avatar('M', 24),
      subscriberCount: '384000',
      hiddenSubscriberCount: false,
      viewCount: '250000000',
      videoCount: '560',
      publishedAt: '2015-09-21T00:00:00Z',
    },
    {
      id: 'UCstarter-glasshouse-audio',
      title: 'Glasshouse Audio',
      handle: '@glasshouseaudio',
      avatarUrl: avatar('G', 282),
      subscriberCount: '641000',
      hiddenSubscriberCount: false,
      viewCount: '25000000',
      videoCount: '63',
      publishedAt: '2017-02-08T00:00:00Z',
    },
    {
      id: 'UCstarter-kaiju-kitchen',
      title: 'Kaiju Kitchen',
      handle: '@kaijukitchen',
      avatarUrl: avatar('K', 350),
      subscriberCount: '2700000',
      hiddenSubscriberCount: false,
      viewCount: '630000000',
      videoCount: '250',
      publishedAt: '2019-11-30T00:00:00Z',
    },
    {
      id: 'UCstarter-orbit-and-oak',
      title: 'Orbit & Oak',
      handle: '@orbitandoak',
      avatarUrl: avatar('O', 196),
      subscriberCount: '6400000',
      hiddenSubscriberCount: false,
      viewCount: '6300000000',
      videoCount: '400',
      publishedAt: '2015-05-17T00:00:00Z',
    },
    {
      id: 'UCstarter-daily-meteor',
      title: 'The Daily Meteor',
      handle: '@thedailymeteor',
      avatarUrl: avatar('D', 44),
      subscriberCount: '14200000',
      hiddenSubscriberCount: false,
      viewCount: '14100000000',
      videoCount: '1400',
      publishedAt: '2013-01-08T00:00:00Z',
    },
    {
      id: 'UCstarter-supernova-plays',
      title: 'SuperNova Plays',
      handle: '@supernovaplays',
      avatarUrl: avatar('S', 4),
      subscriberCount: '61000000',
      hiddenSubscriberCount: false,
      viewCount: '5000000000',
      videoCount: '125',
      publishedAt: '2015-07-19T00:00:00Z',
    },
    {
      id: 'UCstarter-the-last-broadcast',
      title: 'The Last Broadcast',
      handle: '@thelastbroadcast',
      avatarUrl: avatar('L', 355),
      subscriberCount: '150000000',
      hiddenSubscriberCount: false,
      viewCount: '50000000000',
      videoCount: '250',
      publishedAt: '2013-01-01T00:00:00Z',
    },
  ],
};
