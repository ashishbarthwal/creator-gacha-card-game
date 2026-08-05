/* prototype/deck — a fictional deck for the arena prototype.

   ── WHY FICTIONAL, WHEN A REAL 23.5k-CARD DECK IS SITTING RIGHT THERE ──────
   Two reasons, and the second is the one that decides it.

   The real built set is gitignored on purpose: a set file carries real creator
   statistics, which can neither be refreshed inside the 30-day cap nor removed
   on an opt-out once it is in git history. A prototype page that only works on
   a machine holding that file is a prototype nobody else can open.

   And the real set predates `topicDetails`, so every card in it is Unaligned —
   which would leave the element layer, the single most important thing this
   prototype exists to evaluate, doing nothing at all. Inventing elements for
   real creators to work around that would be fabricating a claim about a real
   person, which is exactly the line this project does not cross.

   So the channels below are invented, and their topic claims are AUTHORED
   rather than faked: they are written in the real `topicCategories` shape and
   read by the real `elementFromTopics`, so the prototype exercises the shipping
   code path rather than a stub. When a set is next rebuilt with topicDetails
   requested, pointing this page at it is a one-line change.

   The NUMBERS are shaped like the real deck (see tools/battle-balance.js for
   the measured quantiles) so the battle feels the way it will feel in the game
   rather than the way a tidy fixture would. */

import { emblemFor } from '../src/engine/emblem.js';

/* Wikipedia topic claims per element, in the exact form channels.list returns.
   Two per channel, drawn from its element's list, plus the vague top-level
   bucket a real channel usually also carries — which is the case that makes
   the specificity rule in engine/element.js earn its keep. */
const WIKI = slug => `https://en.wikipedia.org/wiki/${slug}`;
const TOPICS = {
  Gaming: ['Video_game_culture', 'Action_game', 'Role-playing_video_game', 'Strategy_video_game', 'Racing_video_game', 'Sport'],
  Tech: ['Technology', 'Vehicle', 'Business'],
  Knowledge: ['Knowledge', 'Health', 'Politics', 'Military', 'Society'],
  Music: ['Music', 'Rock_music', 'Electronic_music', 'Hip_hop_music', 'Jazz', 'Pop_music'],
  Comedy: ['Humour', 'Entertainment', 'Film', 'Performing_arts', 'Professional_wrestling'],
  Lifestyle: ['Lifestyle_(sociology)', 'Food', 'Physical_fitness', 'Fashion', 'Pet', 'Tourism'],
};
const BUCKETS = ['Entertainment', 'Society', 'Lifestyle_(sociology)'];

const ADJECTIVES = [
  'Molten', 'Paper', 'Static', 'Velvet', 'Iron', 'Neon', 'Hollow', 'Amber', 'Crooked', 'Quiet',
  'Rust', 'Glass', 'Salt', 'Wild', 'Midnight', 'Copper', 'Feral', 'Lucid', 'Bitter', 'Golden',
  'Sunken', 'Vast', 'Wired', 'Grim', 'Soft', 'Slow', 'Feather', 'Thunder', 'Ash', 'Ember',
  'Frost', 'Marble', 'Onyx', 'Pale', 'Wandering', 'Silver', 'Brass', 'Dusty', 'Electric', 'Humble',
];
const NOUNS = [
  'Anvil', 'Lantern', 'Bloom', 'Circuit', 'Harbour', 'Compass', 'Kettle', 'Orchard', 'Signal', 'Ledger',
  'Fathom', 'Mantle', 'Beacon', 'Furnace', 'Thicket', 'Cinder', 'Meridian', 'Quarry', 'Trestle', 'Vector',
  'Alcove', 'Bramble', 'Cradle', 'Drift', 'Echo', 'Flint', 'Grove', 'Haven', 'Junction', 'Kiln',
  'Loom', 'Monsoon', 'Nettle', 'Orbit', 'Prism', 'Quill', 'Rookery', 'Satchel', 'Tundra', 'Wren',
];
/* Suffixes kept deliberately person-shaped — "Diaries", "Hour", "Club" — and
   never company-shaped. The eligibility rule in CLAUDE.md is that a person gets
   a card and an institution does not, and a fixture that reads like a roster of
   media companies would be modelling the wrong game even while inventing it. */
const SUFFIX = {
  Gaming: ['Plays', 'Run', 'Arcade', 'Club', ''],
  Tech: ['Lab', 'Bench', 'Teardown', 'Notes', ''],
  Knowledge: ['Explains', 'Notes', 'Files', 'Hour', ''],
  Music: ['Radio', 'Sessions', 'Tapes', 'Hour', ''],
  Comedy: ['Show', 'Hour', 'Bits', 'Weekly', ''],
  Lifestyle: ['Kitchen', 'Diaries', 'Daily', 'Club', ''],
  Unaligned: ['', '', 'Channel', 'Weekly', ''],
};

/* Band edges match core.rarityFromSubs exactly. Counts are chosen so every
   band has enough distinct cards that a 50-card draft does not keep handing
   back the same UR — the same starvation reasoning as setbuild's band floor,
   applied to a much smaller pool. */
const BANDS = [
  { rarity: 'N',   count: 150, lo: 3.0,     hi: 4.999 },
  { rarity: 'R',   count: 95,  lo: 5.0,     hi: 5.999 },
  { rarity: 'SR',  count: 48,  lo: 6.0,     hi: 6.999 },
  { rarity: 'SSR', count: 22,  lo: 7.0,     hi: 7.698 },
  { rarity: 'UR',  count: 10,  lo: 7.699,   hi: 8.48  },
];

/* mulberry32 again — the prototype takes a seed so a deck that produced an
   interesting fight can be reproduced from the URL (?seed=123). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (list, rng) => list[Math.min(Math.floor(rng() * list.length), list.length - 1)];

/* Box-Muller, so views-per-subscriber lands on the log-normal the real deck
   actually has instead of a flat range. */
function gauss(rng) {
  return Math.sqrt(-2 * Math.log(rng() || 1e-9)) * Math.cos(2 * Math.PI * rng());
}

const ELEMENT_MIX = ['Gaming', 'Gaming', 'Tech', 'Knowledge', 'Music', 'Comedy', 'Lifestyle', 'Unaligned'];

export function buildPrototypeDeck(seed = 1) {
  const rng = mulberry32(seed);
  const used = new Set();
  const deck = [];

  for (const band of BANDS) {
    for (let i = 0; i < band.count; i++) {
      const element = pick(ELEMENT_MIX, rng);

      let name = '';
      for (let tries = 0; tries < 12; tries++) {
        const suffix = pick(SUFFIX[element] ?? SUFFIX.Unaligned, rng);
        name = `${pick(ADJECTIVES, rng)} ${pick(NOUNS, rng)}${suffix ? ' ' + suffix : ''}`;
        if (!used.has(name)) break;
      }
      if (used.has(name)) name += ` ${used.size}`;
      used.add(name);

      const subs = Math.round(10 ** (band.lo + rng() * (band.hi - band.lo)));
      /* views/subs on the live deck's log-normal, clamped so no card ends up
         with fewer lifetime views than subscribers. */
      const devotion = Math.max(0.9, Math.min(4.0, 2.395 + 0.55 * gauss(rng)));
      const views = Math.max(subs, Math.round(subs * 10 ** devotion));

      /* Videos are set from the punch trend plus symmetric noise, for the
         reason test/battle.test.js documents at length: views-per-video is the
         one quantity genuinely correlated with size, and a deck that breaks
         that correlation drives every large card's residual to the floor. */
      const influence = 0.6 * clamp01((Math.log10(subs + 1) - 3) / 5.477) * 100
                      + 0.4 * clamp01((Math.log10(views + 1) - 4) / 7.477) * 100;
      const targetPunch = Math.max(0, Math.min(100, 17.459 + 0.8151 * influence + (rng() * 2 - 1) * 18));
      /* Floor at 12 rather than at 1. The trend can hand a very high-punch card
         a library of three or four videos, and a channel with four uploads
         across ten years scores a cadence near zero, which lands as a Speed of
         5 — a card that acts last every round for reasons no player can read
         off its face. The live deck's 10th percentile is 19 uploads, so a floor
         here is closer to the truth than the formula is. */
      const videos = Math.max(12, Math.round(views / Math.max(1, 10 ** (1.5 + (targetPunch / 100) * 7) - 1)));

      const ageYears = 1 + rng() * 18;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
      const id = `UCproto-${slug}-${deck.length}`;

      const topics = [];
      if (element !== 'Unaligned') {
        topics.push(WIKI(pick(TOPICS[element], rng)));
        /* Roughly half also carry the vague bucket, which is what real channels
           look like and what the leaf-over-bucket rule is for. */
        if (rng() < 0.5) topics.push(WIKI(pick(BUCKETS, rng)));
      }

      deck.push({
        id,
        title: name,
        handle: '@' + slug,
        avatarUrl: emblemFor({ id }),
        subscriberCount: String(subs),
        hiddenSubscriberCount: false,
        viewCount: String(views),
        videoCount: String(videos),
        publishedAt: new Date(Date.now() - ageYears * 365.25 * 24 * 3600 * 1000).toISOString(),
        /* Raw claims, not a derived element: the prototype runs the real
           elementFromTopics so the mapping itself is under test here. */
        topicCategories: topics,
      });
    }
  }
  return deck;
}

const clamp01 = x => Math.max(0, Math.min(1, x));
