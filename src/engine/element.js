/* element — PURE. A channel's topic claim becomes its battle element.
   No I/O, no DOM, no randomness. Same rules as core.js, one folder over.

   ── WHY THIS IS A CLAIM AND NOT A REGEX OVER PROSE ────────────────────────
   `topicDetails.topicCategories` is a list of Wikipedia URLs YouTube itself
   attaches to a channel — ".../Video_game_culture", ".../Rock_music". It is
   the same KIND of signal as the Wikidata P31 screen the sourcing runs on: it
   asks what a thing IS, according to a party that is not us, rather than what
   its name or description happens to say. `brandingSettings.keywords` and
   `snippet.description` are also free on the same call and are deliberately
   NOT used here — those are prose the creator wrote, and reading an element out
   of them is exactly the name-matching that `looksInstitutional()` is kept
   narrow to avoid.

   It costs nothing. channels.list is 1 quota unit per CALL regardless of how
   many parts it carries, so adding `topicDetails` to the `snippet,statistics`
   the hydrate already requests is free — the same discovery that put
   `publishedAt` on the card.

   ── WHY SIX ELEMENTS AND NOT FIVE ─────────────────────────────────────────
   A five-element wheel is the tidier shape and it was the first plan. YouTube's
   own taxonomy does not fit it: after Gaming, Tech, Knowledge, Music and
   Comedy are spoken for, Food, Fashion, Fitness, Pets and Travel have nowhere
   honest to go, and those are not a rounding error on YouTube. Rather than
   cram them into a neighbour, Lifestyle is the sixth. The wheel stays a simple
   cycle — each element beats exactly one and loses to exactly one — so the
   count does not change how much a player has to learn.

   Sport is the one genuine fold: it maps to Gaming, because both are the
   spectacle of somebody competing, and a seventh element to hold it would buy
   less than it costs to explain.

   ── WHY UNALIGNED IS NEUTRAL BOTH WAYS ────────────────────────────────────
   The claim is sparse. Small channels frequently carry no topicCategories at
   all, and those are precisely the cards the rest of the battle design works
   hardest to keep viable. So a channel with no claim is Unaligned, and
   Unaligned neither gives nor takes a matchup modifier — it cannot be countered
   and cannot counter. That is a real, if modest, identity (matchup-proof)
   rather than a penalty for having thin metadata, and it means the element
   layer degrades to "no element layer" on a set built before topicDetails was
   requested instead of degrading to nonsense. */

/* The wheel. Each element beats the NEXT one in this array and loses to the
   previous; the array order IS the rule, so there is no second table to keep
   in sync. Read it as a ring: Lifestyle beats Gaming and closes the loop. */
export const ELEMENT_CYCLE = ['Gaming', 'Tech', 'Knowledge', 'Music', 'Comedy', 'Lifestyle'];

export const UNALIGNED = 'Unaligned';

export const ELEMENTS = [...ELEMENT_CYCLE, UNALIGNED];

/* The flavour is not decoration — it is how a player remembers the ring
   without a chart. Each line is the reason its element wins, in the voice of
   the thing that wins. */
export const ELEMENT_LORE = {
  Gaming:    { beats: 'Tech',      why: 'benchmarks are set by players, not spec sheets' },
  Tech:      { beats: 'Knowledge', why: 'the tool ships before the theory does' },
  Knowledge: { beats: 'Music',     why: 'every hook gets explained to death' },
  Music:     { beats: 'Comedy',    why: 'a hook outlives a punchline' },
  Comedy:    { beats: 'Lifestyle', why: 'nothing survives being laughed at' },
  Lifestyle: { beats: 'Gaming',    why: 'touch grass' },
  [UNALIGNED]: { beats: '',        why: 'claims nothing, counters nothing' },
};

/* Damage multipliers. 1.25 / 0.80 rather than a symmetric pair because they
   are applied to the SAME attack from two directions across a whole team: an
   advantaged strike hits a quarter harder, a disadvantaged one a fifth softer,
   and neither is large enough to decide a fight on its own. Element is meant to
   be the reason a specific card was worth bringing, not the whole fight. */
export const ELEMENT_ADVANTAGE = 1.25;
export const ELEMENT_DISADVANTAGE = 0.80;

/* Wikipedia slug → element, with a SPECIFICITY rank.

   Rank 2 is a leaf claim ("Rock_music", "Action_game", "Food") and rank 1 is a
   top-level bucket ("Entertainment", "Society", "Lifestyle_(sociology)"). The
   distinction is load-bearing: YouTube hands most channels one vague bucket
   plus zero or more specific ones, so a channel tagged {Entertainment, Food}
   is a food channel that also entertains, not an entertainment channel that
   mentions food. Ranking the leaf above the bucket is what reads that
   correctly, and it is the whole reason this is a table of pairs rather than a
   flat map. */
const TOPIC_ELEMENT = {
  // ── Music ────────────────────────────────────────────────────────────────
  music: ['Music', 1],
  christian_music: ['Music', 2],
  classical_music: ['Music', 2],
  country_music: ['Music', 2],
  electronic_music: ['Music', 2],
  hip_hop_music: ['Music', 2],
  independent_music: ['Music', 2],
  jazz: ['Music', 2],
  music_of_asia: ['Music', 2],
  pop_music: ['Music', 2],
  reggae: ['Music', 2],
  rhythm_and_blues: ['Music', 2],
  rock_music: ['Music', 2],
  soul_music: ['Music', 2],

  // ── Gaming (and Sport, which folds here — see the header) ────────────────
  video_game_culture: ['Gaming', 1],
  action_game: ['Gaming', 2],
  'action-adventure_game': ['Gaming', 2],
  casual_game: ['Gaming', 2],
  music_video_game: ['Gaming', 2],
  puzzle_video_game: ['Gaming', 2],
  racing_video_game: ['Gaming', 2],
  'role-playing_video_game': ['Gaming', 2],
  simulation_video_game: ['Gaming', 2],
  sports_game: ['Gaming', 2],
  strategy_video_game: ['Gaming', 2],
  sport: ['Gaming', 1],
  american_football: ['Gaming', 2],
  baseball: ['Gaming', 2],
  basketball: ['Gaming', 2],
  boxing: ['Gaming', 2],
  cricket: ['Gaming', 2],
  association_football: ['Gaming', 2],
  golf: ['Gaming', 2],
  ice_hockey: ['Gaming', 2],
  mixed_martial_arts: ['Gaming', 2],
  motorsport: ['Gaming', 2],
  tennis: ['Gaming', 2],
  volleyball: ['Gaming', 2],

  // ── Comedy (YouTube files this under Entertainment) ──────────────────────
  entertainment: ['Comedy', 1],
  humour: ['Comedy', 2],
  humor: ['Comedy', 2],
  film: ['Comedy', 2],
  performing_arts: ['Comedy', 2],
  professional_wrestling: ['Comedy', 2],
  television_program: ['Comedy', 2],

  // ── Tech (the maker half of YouTube's Lifestyle bucket) ──────────────────
  technology: ['Tech', 2],
  vehicle: ['Tech', 2],
  business: ['Tech', 2],

  // ── Knowledge ────────────────────────────────────────────────────────────
  knowledge: ['Knowledge', 1],
  society: ['Knowledge', 1],
  health: ['Knowledge', 2],
  military: ['Knowledge', 2],
  politics: ['Knowledge', 2],
  religion: ['Knowledge', 2],

  // ── Lifestyle ────────────────────────────────────────────────────────────
  'lifestyle_(sociology)': ['Lifestyle', 1],
  fashion: ['Lifestyle', 2],
  physical_fitness: ['Lifestyle', 2],
  food: ['Lifestyle', 2],
  hobby: ['Lifestyle', 2],
  pet: ['Lifestyle', 2],
  physical_attractiveness: ['Lifestyle', 2],
  tourism: ['Lifestyle', 2],
};

/* Slugs YouTube has not shipped yet, or has renamed. Matched as substrings
   only AFTER the exact table misses, and kept to words that cannot mean
   anything else in a Wikipedia article title. Ordered, because "music_video_
   game" must read as a game rather than as music. */
const TOPIC_HINTS = [
  ['game', 'Gaming'],
  ['sport', 'Gaming'],
  ['music', 'Music'],
  ['comedy', 'Comedy'],
  ['humor', 'Comedy'],
  ['humour', 'Comedy'],
  ['technolog', 'Tech'],
  ['engineering', 'Tech'],
  ['softwar', 'Tech'],
  ['scien', 'Knowledge'],
  ['educat', 'Knowledge'],
  ['histor', 'Knowledge'],
];

/* The last path segment of a Wikipedia URL, lowercased. Accepts a bare slug
   too, so a caller holding "Rock_music" need not fake a URL around it. */
function slugOf(url) {
  const raw = String(url ?? '').trim();
  if (!raw) return '';
  const last = raw.split('#')[0].split('?')[0].replace(/\/+$/, '').split('/').pop() ?? '';
  return decodeURIComponent(last).toLowerCase();
}

function lookup(slug) {
  if (!slug) return null;
  if (TOPIC_ELEMENT[slug]) return TOPIC_ELEMENT[slug];
  for (const [needle, element] of TOPIC_HINTS) {
    /* Rank 1: an inferred element is a weaker claim than a listed one, so an
       exact leaf on the same channel always outranks it. */
    if (slug.includes(needle)) return [element, 1];
  }
  return null;
}

/* A channel's topicCategories → one element.

   Scored rather than first-match: a channel carries several claims and the
   winner should be the element those claims agree on most specifically. Votes
   are summed per element by specificity, and an exact tie falls to
   ELEMENT_CYCLE order, so the answer is total and reproducible — the same
   requirement `selectionHash` has, for the same reason (a build must be
   repeatable from its inputs alone). */
export function elementFromTopics(topicCategories) {
  const list = Array.isArray(topicCategories) ? topicCategories : [];
  const score = new Map();
  for (const url of list) {
    const hit = lookup(slugOf(url));
    if (!hit) continue;
    const [element, weight] = hit;
    score.set(element, (score.get(element) ?? 0) + weight);
  }
  if (!score.size) return UNALIGNED;

  let best = UNALIGNED;
  let bestScore = -Infinity;
  for (const element of ELEMENT_CYCLE) {
    const value = score.get(element) ?? 0;
    if (value > bestScore) { bestScore = value; best = element; }
  }
  return bestScore > 0 ? best : UNALIGNED;
}

/* The only reader the rest of the game needs.

   Prefers an element already ON the channel, because a shipped set stores the
   DERIVED element and not the raw Wikipedia URLs — the same rule WP11 states
   for classification ("store derived tags only, never raw descriptions"), and
   it keeps ~4 URLs per card out of a 23.5k-card file. Live mode has the URLs
   and no stored element, so both paths land here. */
export function elementOf(channel) {
  const stored = channel?.element;
  if (typeof stored === 'string' && ELEMENTS.includes(stored)) return stored;
  return elementFromTopics(channel?.topicCategories);
}

export function beatsOf(element) {
  const at = ELEMENT_CYCLE.indexOf(element);
  return at === -1 ? '' : ELEMENT_CYCLE[(at + 1) % ELEMENT_CYCLE.length];
}

/* The matchup multiplier for an attack from `attacker` onto `defender`.
   Unaligned on either side is neutral — it cannot counter and cannot be
   countered, which is the whole of its identity. */
export function elementMultiplier(attacker, defender) {
  if (attacker === defender) return 1;
  if (!ELEMENT_CYCLE.includes(attacker) || !ELEMENT_CYCLE.includes(defender)) return 1;
  if (beatsOf(attacker) === defender) return ELEMENT_ADVANTAGE;
  if (beatsOf(defender) === attacker) return ELEMENT_DISADVANTAGE;
  return 1;
}

/* 'strong' | 'weak' | 'even' — what the UI paints. Derived from the multiplier
   rather than re-deriving the ring, so a label can never disagree with the
   damage it is describing. */
export function matchupOf(attacker, defender) {
  const m = elementMultiplier(attacker, defender);
  return m > 1 ? 'strong' : m < 1 ? 'weak' : 'even';
}
