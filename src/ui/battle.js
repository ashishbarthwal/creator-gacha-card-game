/* ui/battle — the arena: pick five, fight something, watch it play out.

   Wiring only, in the spirit of main.js. Every rule it enforces comes from
   engine/ — battle.js resolves the fight, opponent.js builds the AI and
   arranges formations, element.js decides matchups, challenge.js encodes the
   cross-window code. Nothing here decides anything about the game; if a number
   looks wrong on this screen, it is wrong in the engine.

   ── THREE WAYS TO FIGHT, AND WHY ALL THREE ────────────────────────────────
     Quick battle   an AI matched to YOUR team out of the current set pool.
                    The one that always works, including with nobody else
                    around, which is why it is first.
     Challenge      you commit five and hand out a code.
     Accept         you paste someone's code, SEE their five, and build
                    against them.

   The asymmetry between the last two is deliberate and is the whole reason the
   element wheel is worth having. Countering an opponent you cannot see is just
   picking your best five again — so somebody has to commit first, and the code
   is what makes "first" mean something. The challenger commits their team AND
   the seed before they can know what they are up against; the defender gets to
   scout. Swap roles for the return match and the advantage swaps with it.

   ── THE LOBBY, AND THE TWO PATHS THROUGH IT ───────────────────────────────
   A fight cannot be resolved until BOTH teams are known, and when the
   challenger hands over their code only the defender holds both. Everything
   about how the two of them meet follows from that one fact.

     LIVE PATH (a match room is reachable). The challenger commits and waits;
     the defender pastes, presses Challenge Accepted, and the challenger's
     screen goes green and opens a lobby. The defender builds against the five
     they can see and presses Ready, which uploads their team — pressing Ready
     IS committing, so the two are one act. That upload is what unlocks the
     challenger's own Ready button, because until it lands their browser
     literally cannot compute the battle. Both ready, and a countdown anchored
     to the server's stamp starts them together.

     MANUAL PATH (no match room — unbound, offline, blocked). Exactly what this
     app shipped with: the defender copies a reply code, sends it, the
     challenger pastes it, and both press Start on a spoken three-two-one. It
     is kept whole rather than reduced to a stub, because on the day the lobby
     breaks it is the only path there is.

   The server is told a room hash, which side pressed, and — once — the
   defender's reply code. See functions/api/ready/[room].js for why the line
   sits exactly there, and DECISIONS.md for the amendment that allowed it.

   ── HOW TWO WINDOWS SHOW THE SAME FIGHT ───────────────────────────────────
   Nothing about the battle itself is synchronised, and the lobby does not change
   that. Both windows resolve the SAME fight independently from the same inputs,
   because engine/battle.js is pure and seed-deterministic and
   engine/battle-stats.js takes its clock as a parameter. The code carries the
   teams, the seed and the pinned `now`; both sides run `resolveBattle` and get
   identical logs, hit for hit. The lobby only decides WHEN they press play — it
   never carries a result, and a result it did carry could not be trusted anyway.

   TEAM ORDER IS PART OF THE PROTOCOL: side 'a' is always the challenger and
   side 'b' always the defender, in both windows, whichever one the player is
   sitting in. `youAre` maps that to "you" and "them" for display only. Getting
   this backwards would not throw — it would quietly show two players two
   different winners for the same fight, which is the worst failure available
   here, so it is fixed in one place and read everywhere. */

import { state } from '../state.js';
import { loadLineup, saveLineup } from '../storage.js';
import {
  TEAM_SIZE, FRONT_SLOTS, battle, makeTeam, teamPower, matchupPreview, formationBonus,
} from '../engine/battle.js';
import { battleStatsFrom } from '../engine/battle-stats.js';
import { matchOpponent, arrangeFormation, bestTeamFrom, matchQuality } from '../engine/opponent.js';
import { ELEMENT_CYCLE, ELEMENT_LORE } from '../engine/element.js';
import {
  makeChallenge, makeResult, decodeCode, echoMatches, newSeed, fingerprint, ChallengeError,
} from '../engine/challenge.js';
import {
  roomFor, acceptChallenge, readyWithTeam, readyChallenger, checkRoom,
} from '../data/presence.js';
import { renderBattleCard, armHealthBar, setHealth, ELEMENT_STYLE } from './battle-card.js';
import { escapeHtml } from './util.js';

const $ = id => document.getElementById(id);

const arenaEl = $('arena');
const closeBtn = $('arena-close');
const stepsEl = $('ar-steps');
const bodyEl = $('ar-body');

/* A `MODE` table mapping each flow to a side used to live here and was never
   read: the side is decided where the flow actually branches (`ui.side` at
   commit/accept, `youAre` on the pending fight), and a second copy of that
   mapping could only ever drift out of step with the first. */
const ui = {
  mode: null,
  phase: 'mode',
  lineup: new Array(TEAM_SIZE).fill(null),  // channels, by slot
  selectedSlot: 0,
  enemy: null,          // channels, once known (scouted or generated)
  challenge: null,      // decoded challenge, in accept mode
  sentTeam: null,       // what we committed, in challenge mode
  sentNow: 0,
  preview: new Map(),
  timers: [],
  name: '',
  note: '',
  replyCode: '',        // defender's reply, built BEFORE the replay so it can be sent first
  pendingFight: null,   // a resolved fight held behind a button, so both sides can start together
  room: '',             // match-room id, derived from the challenge by both sides
  side: null,           // 'a' challenger | 'b' defender — the seat, not the team
  lobby: null,          // last state read from the match room
};

let lastTrigger = null;

/* ── helpers ─────────────────────────────────────────────────────────────── */

/* Every distinct card the player owns, as channels. Distinct BY ID because a
   collection stacks duplicates and a team may not field the same creator twice
   — the same rule engine/opponent.js applies to the AI's own draw. */
function myChannels() {
  return [...state.collection.values()].map(item => item.card.channel);
}

/* mulberry32 — small, fast, and identical in every window, which is the only
   property that matters here. Duplicated from the prototype rather than
   imported from it: prototype/ is a parked page, and the shipped app must not
   depend on a file that exists to be thrown away. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Seed a LOCAL fight off the two line-ups, so the same five against the same
   five always play out the same way. Not a convenience — it is the design claim
   made checkable: lose, change nothing, fight again, and you lose the same way;
   swap one card and the difference is attributable to the swap. With
   Math.random the rematch button would quietly be a re-roll, which is exactly
   the "decided by dice" reading the auto-battler design rejects.

   Cross-window fights do NOT use this: their seed is drawn once by the
   challenger and travels in the code, because a seed derived from both teams
   could not exist until both teams were known. */
function seedOf(channels) {
  let h = 2166136261;
  for (const ch of channels) {
    for (const c of String(ch?.id ?? '')) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  }
  return h >>> 0;
}

const clearTimers = () => { ui.timers.forEach(clearTimeout); ui.timers = []; };
const later = (fn, ms) => ui.timers.push(setTimeout(fn, ms));

const filled = () => ui.lineup.filter(Boolean);
const isComplete = () => filled().length === TEAM_SIZE;

/* The clock the fight is pinned to. In a cross-window fight it comes from the
   code and must not be re-read locally — three of the five battle axes are
   derived from channel age, so a locally-read clock would have the two windows
   fighting subtly different cards. */
function fightNow() {
  return ui.challenge?.now ?? ui.sentNow ?? Date.now();
}

/* ── shell ───────────────────────────────────────────────────────────────── */

const PHASES = [
  ['mode', 'Choose'],
  ['build', 'Build'],
  ['fight', 'Battle'],
];

function setPhase(name) {
  ui.phase = name;
  const at = PHASES.findIndex(([key]) => key === name);
  stepsEl.replaceChildren(...PHASES.map(([key, label], i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1} · ${label}`;
    li.classList.toggle('done', i < at);
    if (i === at) li.setAttribute('aria-current', 'step');
    return li;
  }));
  render();
  bodyEl.scrollTop = 0;
}

function render() {
  if (ui.phase === 'mode') return renderMode();
  if (ui.phase === 'build') return renderBuild();
  if (ui.phase === 'fight') return renderFightShell();
}

function section(title, hint) {
  const wrap = document.createElement('section');
  wrap.className = 'ar-panel';
  const head = document.createElement('header');
  head.innerHTML = `<h3>${escapeHtml(title)}</h3>${hint ? `<p class="hint">${hint}</p>` : ''}`;
  wrap.append(head);
  return wrap;
}

function button(label, { className = '', onClick, disabled = false, id = '' } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  b.disabled = disabled;
  if (id) b.id = id;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

function note(message, isError = false) {
  ui.note = message;
  const el = document.querySelector('.ar-note');
  if (el) {
    el.textContent = message;
    el.classList.toggle('error', isError);
    el.hidden = !message;
  }
}

function noteSlot() {
  const p = document.createElement('p');
  p.className = 'ar-note';
  p.setAttribute('role', 'status');
  p.hidden = !ui.note;
  p.textContent = ui.note;
  return p;
}

/* ── phase 1: choose an opponent ─────────────────────────────────────────── */

function renderMode() {
  const owned = myChannels();
  bodyEl.replaceChildren();

  if (owned.length < TEAM_SIZE) {
    const panel = section('Not enough cards yet',
      `A team is ${TEAM_SIZE} different creators. You have ${owned.length}.`);
    const p = document.createElement('p');
    p.className = 'ar-empty';
    p.textContent = 'Close this and open a few packs — then come back and build a team.';
    panel.append(p);
    bodyEl.append(panel);
    return;
  }

  const panel = section('Who are you fighting?', 'Your cards, five a side, auto-resolved. Team-building is the strategy.');
  const grid = document.createElement('div');
  grid.className = 'ar-modes';

  grid.append(
    modeCard('Quick battle', 'ai',
      'An opponent matched to your team out of the current set. Always available.'),
    modeCard('Challenge someone', 'challenge',
      'Commit your five and get a code to send. They build against you — that is their edge, so trade roles for the rematch.'),
    modeCard('Accept a challenge', 'accept',
      'Paste a code. You see their five before you pick yours.'),
  );
  panel.append(grid, noteSlot());
  bodyEl.append(panel);
}

function modeCard(title, mode, blurb) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ar-mode-card';
  b.innerHTML = `<b>${escapeHtml(title)}</b><span>${escapeHtml(blurb)}</span>`;
  b.addEventListener('click', () => chooseMode(mode));
  return b;
}

function chooseMode(mode) {
  ui.mode = mode;
  ui.enemy = null;
  ui.challenge = null;
  ui.sentTeam = null;
  ui.preview = new Map();
  note('');
  restoreLineup();
  if (mode === 'accept') return renderAcceptPaste();
  setPhase('build');
}

/* Accept mode needs the enemy BEFORE the builder is worth showing, so it gets
   its own small step rather than an empty scouting panel the player has to
   guess at. */
function renderAcceptPaste() {
  bodyEl.replaceChildren();
  const panel = section('Paste their challenge code',
    'They sent you a long string starting <code>CGB1.</code> — the whole thing.');
  const ta = document.createElement('textarea');
  ta.className = 'ar-code-in';
  ta.rows = 4;
  ta.spellcheck = false;
  ta.placeholder = 'CGB1.z…';
  ta.setAttribute('aria-label', 'Challenge code');

  const row = document.createElement('div');
  row.className = 'ar-row';
  row.append(
    button('Challenge accepted', {
      className: 'btn go',
      onClick: async () => {
        try {
          const decoded = await decodeCode(ta.value);
          if (decoded.kind !== 'c') {
            return note('That is a result code, not a challenge. Paste the code they sent you FIRST.', true);
          }
          ui.challenge = decoded;
          ui.enemy = decoded.teamA;
          ui.side = 'b';
          ui.room = roomFor(fingerprint(decoded.teamA), decoded.seed);
          /* FIRED BEFORE ANYTHING IS BUILT, and not awaited. This is the whole
             point of the accept step: the challenger is sitting on a screen
             waiting to learn somebody took the challenge, and making them wait
             for the defender to finish drafting first would defeat it. If the
             call fails there is nothing to handle — the challenger simply falls
             back to the copy-paste flow, which is what they were doing anyway. */
          acceptChallenge(ui.room);
          note(decoded.name ? `Challenge from ${decoded.name} — build against their five.` : '');
          setPhase('build');
        } catch (err) {
          note(err instanceof ChallengeError ? err.message : 'That code could not be read.', true);
        }
      },
    }),
    button('Back', { className: 'btn ghost', onClick: () => setPhase('mode') }),
  );
  panel.append(ta, row, noteSlot());
  bodyEl.append(panel);
  ta.focus();
}

/* ── phase 2: build ──────────────────────────────────────────────────────── */

/* Refs kept from the last renderBuild, so a click can update the three things
   that actually changed instead of rebuilding the screen.

   THIS IS NOT PREMATURE. The collection strip renders one battle card per owned
   creator, and a battle card is a container-query layout with five gradient
   bars — far heavier than a collection tile. Re-rendering all of them on every
   slot click is fine at the twelve cards a new player has and visibly janky at
   the few hundred a real binder holds, on the exact interaction (place a card,
   place another) that is the whole screen. Worse than the jank: the strip
   re-flows under the cursor mid-click, so the next click lands on whatever
   moved into that gap. */
const buildRefs = { ranks: null, readout: null, formation: null, pool: null, go: null };

function renderBuild() {
  bodyEl.replaceChildren();
  const now = fightNow();

  if (ui.enemy) {
    const scout = section('The opposition',
      'Locked in before you picked, and arranged. Read their elements — you counter what they brought.');
    scout.append(ranksOf(ui.enemy, now));
    scout.append(wheel());
    bodyEl.append(scout);
    ui.preview = new Map(matchupPreview(myChannels(), ui.enemy, now).map(m => [m.id, m]));
  }

  const build = section('Your five',
    `Click a slot, then a card. <b>Front rank</b> takes every hit while it stands. <b>Back rank</b> is safe until it falls, and deals 15% less for the cover.`);
  const ranks = slotRows(now);
  buildRefs.ranks = ranks;
  build.append(ranks);

  const row = document.createElement('div');
  row.className = 'ar-row';
  const go = button(fightLabel(), { className: 'btn primary', disabled: !isComplete(), onClick: onCommit });
  buildRefs.go = go;
  row.append(
    go,
    button('Auto-pick', { className: 'btn ghost', onClick: autoPick }),
    button('Clear', { className: 'btn ghost', onClick: () => { ui.lineup.fill(null); ui.selectedSlot = 0; persistLineup(); refreshTeam(); } }),
    button('Back', { className: 'btn ghost', onClick: () => setPhase('mode') }),
  );
  const power = document.createElement('span');
  power.className = 'ar-readout';
  power.innerHTML = powerReadout(now);
  buildRefs.readout = power;
  row.append(power);
  build.append(row);

  const formation = formationReadout(now);
  buildRefs.formation = formation;
  build.append(formation);

  if (ui.mode === 'challenge') {
    const nameRow = document.createElement('div');
    nameRow.className = 'ar-row';
    const input = document.createElement('input');
    input.className = 'field ar-name';
    input.placeholder = 'Your name (optional — shown to them)';
    input.maxLength = 24;
    input.value = ui.name;
    input.addEventListener('input', () => { ui.name = input.value; });
    nameRow.append(input);
    build.append(nameRow);
  }

  build.append(noteSlot());
  bodyEl.append(build);
  bodyEl.append(poolPanel(now));
}

/* Re-render only what a pick changes: the five slots, the rating readout, the
   Fight button's enabled state, and which strip cards read as fielded. The
   strip itself — the expensive part — is left alone. */
function refreshTeam() {
  const now = fightNow();
  if (buildRefs.ranks) buildRefs.ranks.replaceWith(buildRefs.ranks = slotRows(now));
  if (buildRefs.readout) buildRefs.readout.innerHTML = powerReadout(now);
  if (buildRefs.formation) buildRefs.formation.replaceWith(buildRefs.formation = formationReadout(now));
  if (buildRefs.go) buildRefs.go.disabled = !isComplete();
  if (buildRefs.pool) {
    const fieldedIds = new Set(filled().map(c => c.id));
    for (const pick of buildRefs.pool.children) {
      const on = fieldedIds.has(pick.dataset.id);
      pick.classList.toggle('is-fielded', on);
      pick.setAttribute('aria-pressed', String(on));
    }
  }
}

function fightLabel() {
  if (ui.mode === 'challenge') return 'Commit & get code';
  return 'Fight';
}

function powerReadout(now) {
  const mine = teamPower(makeTeam(filled(), now));
  if (!filled().length) return 'pick five';
  const bits = [`your rating <b>${mine}</b>`];
  if (ui.enemy) {
    const theirs = teamPower(makeTeam(ui.enemy, now));
    const gap = mine && theirs ? Math.round((mine / theirs - 1) * 100) : 0;
    bits.push(`theirs <b>${theirs}</b>`, `${gap >= 0 ? '+' : ''}${gap}%`);
  }
  return bits.join(' · ');
}

/* THE ONE THING THE RATING CANNOT SEE, so it is the one thing worth spelling
   out while the team is still a choice. `powerOf` rates cards; the formation
   bonus is a property of the five together (engine/battle.js), which is
   precisely why "take the five highest-rated cards" stopped being the whole
   game — and a bonus a player cannot see is a decision they cannot make. */
function formationReadout(now) {
  const team = filled();
  const { classes, lift } = formationBonus(team, now);
  const el = document.createElement('p');
  el.className = 'ar-formation' + (lift > 1 ? ' is-on' : '');
  if (!team.length) {
    el.innerHTML = '<b>Formation</b> — a team of different classes fights better than five of a kind.';
    return el;
  }
  const pctLift = Math.round((lift - 1) * 1000) / 10;
  const names = [...new Set(team.map(ch => classOf(ch, now)))].join(' · ');
  el.innerHTML = lift > 1
    ? `<b>Formation +${pctLift}%</b> — ${classes} different classes: ${escapeHtml(names)}`
    : `<b>Formation</b> — ${classes} different class${classes === 1 ? '' : 'es'} (${escapeHtml(names)}). Field 4 for +2.5%, 5 for +5%.`;
  return el;
}

const classOf = (channel, now) => battleStatsFrom(channel, now).class;

function ranksOf(channels, now) {
  const wrap = document.createElement('div');
  wrap.className = 'ar-ranks enemy';
  wrap.append(
    rankRow('Back rank — reachable only once the front falls', channels.slice(FRONT_SLOTS), FRONT_SLOTS, now),
    rankRow('Front rank — takes every hit', channels.slice(0, FRONT_SLOTS), 0, now),
  );
  return wrap;
}

function rankRow(label, channels, offset, now) {
  const wrap = document.createElement('div');
  wrap.className = 'ar-rank';
  const head = document.createElement('div');
  head.className = 'ar-rank-label';
  head.textContent = label;
  const cards = document.createElement('div');
  cards.className = 'ar-rank-cards';
  channels.forEach((ch, i) => {
    const slot = document.createElement('div');
    slot.className = 'ar-slot filled';
    slot.append(renderBattleCard(ch, { now, slot: offset + i }));
    cards.append(slot);
  });
  wrap.append(head, cards);
  return wrap;
}

function slotRows(now) {
  const wrap = document.createElement('div');
  wrap.className = 'ar-ranks mine';
  wrap.append(
    slotRow(`Front rank — ${FRONT_SLOTS} slots`, 0, FRONT_SLOTS, now),
    slotRow(`Back rank — ${TEAM_SIZE - FRONT_SLOTS} slots, 15% less damage dealt`, FRONT_SLOTS, TEAM_SIZE, now),
  );
  return wrap;
}

function slotRow(label, from, to, now) {
  const wrap = document.createElement('div');
  wrap.className = 'ar-rank';
  const head = document.createElement('div');
  head.className = 'ar-rank-label';
  head.textContent = label;
  const cards = document.createElement('div');
  cards.className = 'ar-rank-cards';
  for (let slot = from; slot < to; slot++) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'ar-slot';
    const channel = ui.lineup[slot];
    if (channel) {
      el.classList.add('filled');
      el.append(renderBattleCard(channel, { now, slot, matchup: ui.preview.get(channel.id) }));
      el.setAttribute('aria-label', `Slot ${slot + 1}: ${channel.title}. Remove.`);
    } else {
      el.textContent = `slot ${slot + 1}`;
      el.setAttribute('aria-label', `Empty slot ${slot + 1}. Select.`);
    }
    if (slot === ui.selectedSlot) el.classList.add('is-target');
    el.addEventListener('click', () => onSlot(slot));
    cards.append(el);
  }
  wrap.append(head, cards);
  return wrap;
}

function poolPanel(now) {
  const panel = section('Your collection', 'Click a card to slot it. Click it again to take it out.');
  const grid = document.createElement('div');
  grid.className = 'ar-pool';
  const fieldedIds = new Set(filled().map(c => c.id));

  for (const channel of myChannels()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ar-pick';
    btn.dataset.id = channel.id;          // how refreshTeam finds it again
    btn.classList.toggle('is-fielded', fieldedIds.has(channel.id));
    btn.setAttribute('aria-pressed', String(fieldedIds.has(channel.id)));
    btn.append(renderBattleCard(channel, { now, matchup: ui.preview.get(channel.id) }));
    btn.addEventListener('click', () => onPick(channel));
    grid.append(btn);
  }
  buildRefs.pool = grid;
  panel.append(grid);
  return panel;
}

function wheel() {
  const ul = document.createElement('ul');
  ul.className = 'ar-wheel';
  for (const element of ELEMENT_CYCLE) {
    const li = document.createElement('li');
    li.style.setProperty('--el', ELEMENT_STYLE[element].hue);
    li.innerHTML = `<i>${ELEMENT_STYLE[element].glyph}</i>${escapeHtml(element)} <span>beats ${escapeHtml(ELEMENT_LORE[element].beats)} — ${escapeHtml(ELEMENT_LORE[element].why)}</span>`;
    ul.append(li);
  }
  return ul;
}

function onSlot(slot) {
  /* A filled slot empties; an empty one becomes the target for the next card
     clicked. Two gestures, no dragging — the same interaction has to work on a
     phone, and a drag that fails silently is worse than a click that does not. */
  if (ui.lineup[slot]) ui.lineup[slot] = null;
  ui.selectedSlot = slot;
  persistLineup();
  refreshTeam();
}

function onPick(channel) {
  const already = ui.lineup.findIndex(c => c && c.id === channel.id);
  if (already !== -1) { ui.lineup[already] = null; persistLineup(); return refreshTeam(); }

  let slot = ui.selectedSlot;
  if (ui.lineup[slot]) slot = ui.lineup.findIndex(c => !c);
  if (slot === -1) return;                       // full: clear a slot first
  ui.lineup[slot] = channel;
  const next = ui.lineup.findIndex(c => !c);
  ui.selectedSlot = next === -1 ? slot : next;
  persistLineup();
  refreshTeam();
}

/* Fills the line-up with the strongest legal team and arranges it, so a player
   can see a sensible baseline and then argue with it. Deliberately NOT
   matchup-aware: it is the "what would raw power do" button, and beating it by
   countering elements is the point the whole element layer exists to make. */
function autoPick() {
  const now = fightNow();
  ui.lineup = arrangeFormation(bestTeamFrom(myChannels(), { now }), now);
  while (ui.lineup.length < TEAM_SIZE) ui.lineup.push(null);
  ui.selectedSlot = 0;
  persistLineup();
  refreshTeam();
}

/* ── committing ──────────────────────────────────────────────────────────── */

/* A NOTE DESCRIBES THE LAST ACTION, so every action handler clears it before
   doing anything. Without this a message outlives the thing it was about: a
   failed paste ("Paste a battle code first.") stayed on screen through the
   whole fight and sat underneath the final verdict, which reads as the battle
   having gone wrong. Cleared at the top rather than inside `startFight`
   because `fightAI` legitimately SETS a note (a thin-pool warning) on its way
   there, and clearing later would swallow it. */
async function onCommit() {
  if (!isComplete()) return;
  note('');
  if (ui.mode === 'ai') return fightAI();
  if (ui.mode === 'challenge') return createChallenge();
  if (ui.mode === 'accept') return fightAsDefender();
}

function fightAI() {
  const now = Date.now();
  ui.sentNow = now;
  const mine = filled();
  const pool = state.setsPool.length ? state.setsPool : [];
  /* The AI draws from the SET, not from the player's collection — an opponent
     mirroring cards you own reads as the game cheating even when it is
     arithmetically fair, and opponent.js excludes your ids for the same reason.
     Falls back to the collection only if no set is loaded at all, which is the
     offline demo case. */
  const source = (pool.length ? pool.map(card => card.channel) : myChannels());
  const match = matchOpponent(mine, source, { now, rng: Math.random });

  if (match.channels.length < TEAM_SIZE) {
    return note('The current set is too thin to field an opponent. Load a set with more cards.', true);
  }
  ui.enemy = match.channels;
  const quality = matchQuality(match);
  ui.note = quality.close
    ? ''
    : `Closest available opponent is ${quality.drift > 0 ? '+' : ''}${Math.round(quality.drift * 100)}% off an even match — the pool is thin at your rating.`;
  startFight({ teamA: mine, teamB: ui.enemy, seed: seedOf([...mine, ...ui.enemy]), now, youAre: 'a' });
}

async function createChallenge() {
  const now = Date.now();
  const seed = newSeed();
  const team = filled();
  ui.sentTeam = team;
  ui.sentNow = now;
  ui.side = 'a';
  ui.room = roomFor(fingerprint(team), seed);
  try {
    const code = await makeChallenge({ team, name: ui.name, seed, now });
    renderChallengeOut(code);
  } catch {
    note('Could not build a challenge code.', true);
  }
}

/* THE DEFENDER SENDS BEFORE THEY WATCH, so both sides can start together.

   Half of the asymmetry here is not removable and it is worth being clear about
   which half. A fight cannot be resolved until BOTH teams are known, and when
   the challenger sends their code only the defender holds both — so the
   challenger genuinely cannot watch anything yet. No amount of UI fixes that;
   it is what "no backend" costs.

   The other half was arbitrary and is now gone. The defender used to fight
   immediately and be handed the reply code afterwards, next to the verdict,
   which meant one player watched minutes before the other and the second one
   already knew the result was sitting in their inbox. Building the reply first
   and holding the replay behind a button costs the defender nothing — they
   committed their five the moment they pressed Fight, and the outcome was
   settled then — but it lets the two of them press play at the same time, which
   is the thing that actually makes it feel like one match rather than two
   reports.

   Encoding is awaited rather than raced with the replay for the same reason it
   always was: the hand-off panel is built FROM `ui.replyCode`, so a slow encode
   would otherwise render a panel with nothing in it. */
/* The defender commits. Pressing Ready IS committing the team, so the reply
   code is built and uploaded in the same breath — a room that was ready but had
   no code to fight over would be a lobby that could never start.

   The upload is attempted; the copy-paste screen is the answer if it fails. */
async function fightAsDefender() {
  const mine = filled();
  try {
    ui.replyCode = await makeResult({ challenge: ui.challenge, team: mine, name: ui.name });
  } catch {
    ui.replyCode = '';
    return note('Could not build the reply code for this fight.', true);
  }
  ui.pendingFight = {
    teamA: ui.challenge.teamA,
    teamB: mine,
    seed: ui.challenge.seed,
    now: ui.challenge.now,
    youAre: 'b',
    them: ui.challenge.name,
  };

  const state = await readyWithTeam(ui.room, ui.replyCode);
  if (!state.enabled) return renderHandoff();   // no match rooms — hand them the code
  ui.lobby = state;
  renderLobby();
}

/* THE FALLBACK, and it is the flow this app shipped with rather than a
   consolation prize. Reached whenever the match room is unavailable: no KV
   binding, offline, request blocked. The defender copies their code, sends it,
   and the two of them use the manual countdown. */
function renderHandoff() {
  bodyEl.replaceChildren();
  const { panel, row } = codeBox(ui.replyCode, {
    label: 'Send this back',
    hint: 'The live lobby is unavailable, so this goes the manual way: send them this code, then start the replay together.',
  });
  row.append(button('Sent — ready up', {
    className: 'btn go',
    onClick: () => renderReady(),
  }));
  const wait = document.createElement('p');
  wait.className = 'ar-note';
  wait.hidden = false;
  wait.textContent = 'Your five are locked in — the result is already decided either way. Nothing here changes it.';
  panel.append(wait);
  bodyEl.append(panel);
}

/* ── THE LOBBY ─────────────────────────────────────────────────────────────
   Where both players wait, see each other arrive, and ready up. One screen for
   both sides, because they are looking at the same room from two seats — the
   only differences are which five is "yours" and which button is locked.

   THE CHALLENGER'S READY IS LOCKED UNTIL THE DEFENDER'S TEAM ARRIVES, and that
   is a real constraint rather than an interface flourish: a fight cannot be
   resolved without both teams, so a challenger who could ready early would be
   readying for a battle their browser is unable to compute. The server enforces
   the same rule, so it does not depend on this being the only client. */
function renderLobby() {
  bodyEl.replaceChildren();
  const gen = ++readyGen;
  const side = ui.side;
  const isA = side === 'a';
  const now = ui.pendingFight?.now ?? ui.challenge?.now ?? ui.sentNow ?? Date.now();
  const myTeam = isA ? ui.sentTeam : filled();

  const panel = section('Lobby', 'Both of you ready up, then it starts on the same count.');

  const face = document.createElement('div');
  face.className = 'ar-faceoff';
  panel.append(face);

  const lamps = document.createElement('div');
  lamps.className = 'ar-lamps';
  panel.append(lamps);

  const count = document.createElement('div');
  count.className = 'ar-countdown';
  count.hidden = true;
  panel.append(count);

  const row = document.createElement('div');
  row.className = 'ar-row';
  const go = button('Ready', { className: 'btn go', disabled: true });
  row.append(go, button('Leave', {
    className: 'btn ghost',
    onClick: () => { readyGen++; clearTimers(); setPhase('mode'); },
  }));
  panel.append(row);
  bodyEl.append(panel);

  const view = { gen, go, anyway: { hidden: true }, lamp: lamps, count };
  let pressed = false;

  const paint = state => {
    if (gen !== readyGen) return;
    const theirTeam = isA ? ui.pendingFight?.teamB : ui.challenge?.teamA;
    const theirName = isA ? '' : (ui.challenge?.name ?? '');

    face.innerHTML =
      `<span><b>Your five</b><i>rating ${teamPower(makeTeam(myTeam, now))}</i></span>` +
      '<em>vs</em>' +
      (theirTeam
        ? `<span><b>${escapeHtml(theirName || 'Their five')}</b><i>rating ${teamPower(makeTeam(theirTeam, now))}</i></span>`
        : '<span><b>Their five</b><i>still building…</i></span>');

    const mineReady = isA ? state.a : state.b;
    const theirsReady = isA ? state.b : state.a;
    lamps.innerHTML =
      `<span class="ar-lampdot ${mineReady ? 'on' : ''}">${mineReady ? '● you are ready' : '○ you are not ready'}</span>` +
      `<span class="ar-lampdot ${theirsReady ? 'on' : ''}">${theirsReady ? '● they are ready' : (state.accepted || !isA ? '○ waiting on them' : '○ waiting for someone to accept')}</span>`;

    /* The challenger can only ready once the defender's five have arrived; the
       defender always can, because they cannot reach this screen without having
       committed. */
    const canReady = isA ? Boolean(ui.pendingFight) : true;
    go.disabled = pressed || !canReady;
    go.textContent = pressed ? 'Ready ✓' : (canReady ? 'Ready' : 'Waiting for their team…');
    go.classList.toggle('is-hot', !pressed && canReady && theirsReady);
  };

  go.addEventListener('click', async () => {
    pressed = true;
    go.disabled = true;
    go.classList.remove('is-hot');
    go.textContent = 'Ready ✓';
    const state = isA ? await readyChallenger(ui.room) : await readyWithTeam(ui.room, ui.replyCode);
    if (gen !== readyGen) return;
    if (!state.enabled) return runCountdown(view, COUNTDOWN_MS);   // room vanished mid-lobby
    ui.lobby = state;
    handle(state);
  });

  /* Adopting the defender's code the moment it appears is what unlocks the
     challenger's button — and it is also the only place the challenger ever
     learns what it is fighting, so a code that fails to decode has to be said
     out loud rather than leaving the button mysteriously locked forever. */
  async function adopt(state) {
    if (!isA || ui.pendingFight || !state.code) return;
    try {
      const decoded = await decodeCode(state.code);
      if (gen !== readyGen) return;
      if (decoded.kind !== 'r' || !echoMatches(decoded, ui.sentTeam)) {
        return note('The reply in this lobby does not match the challenge you sent.', true);
      }
      ui.enemy = decoded.teamB;
      ui.pendingFight = {
        teamA: decoded.teamA,
        teamB: decoded.teamB,
        seed: decoded.seed,
        now: decoded.now,
        youAre: 'a',
        them: decoded.name,
      };
    } catch {
      note('Could not read the team they sent.', true);
    }
  }

  async function handle(state) {
    if (gen !== readyGen) return;
    await adopt(state);
    if (gen !== readyGen) return;
    paint(state);
    if (state.a && state.b && state.bothAt && ui.pendingFight) {
      const elapsed = Math.max(0, (state.now || Date.now()) - state.bothAt);
      return runCountdown(view, Math.max(0, (state.countdownMs ?? COUNTDOWN_MS) - elapsed));
    }
    later(poll, POLL_MS);
  }

  function poll() {
    if (gen !== readyGen) return;
    checkRoom(ui.room).then(state => {
      if (gen !== readyGen) return;
      if (!state.enabled) return;    // room gone: leave the lobby as it stands
      ui.lobby = state;
      handle(state);
    });
  }

  paint(ui.lobby ?? { accepted: false, a: false, b: false, bothAt: null, code: '' });
  poll();
}

/* ── THE READY SCREEN ──────────────────────────────────────────────────────
   Both sides land here holding both teams, so both can start the same replay.
   Pressing arms a short countdown rather than cutting straight to the fight,
   and the countdown is the whole mechanism: two people on a call say "now",
   press, and watch 3-2-1 together. It buys the synchronisation an auto-detected
   ready-check would have, using the one channel that actually exists — the
   players talking to each other.

   WHAT IS DELIBERATELY NOT HERE: an "opponent is ready" light. It cannot be
   built. This window has no way to learn that the other one pressed anything —
   the battle codes are one-shot copy-pastes, not a connection, and a live
   signal needs either a third code exchange (clunky for what it buys) or a
   server (which is the backend that locked decision 3 rules out). A light that
   guessed would be worse than no light, so the screen says plainly whose job
   the timing is instead of implying the game is watching. */
const COUNTDOWN_MS = 3000;
const POLL_MS = 1200;

/* Bumped every time the ready screen is built or torn down. Presence work is
   asynchronous, so a reply that arrives after the player has navigated away
   would otherwise paint a countdown onto a screen that no longer exists. */
let readyGen = 0;

function armFight(pending) {
  ui.pendingFight = pending;
  renderReady();
}

/* THE MANUAL READY SCREEN — the fallback, and the flow this app shipped with.
   Reached only when the live lobby cannot be used: no KV binding, offline, the
   request blocked. There is no presence here by design; the two players
   coordinate by talking, press together, and the countdown lines them up.

   Kept whole rather than trimmed to a stub, because it is not a consolation
   prize — it is the path that works with no server at all, and on the day the
   lobby breaks it is the only path there is. */
function renderReady() {
  bodyEl.replaceChildren();
  const gen = ++readyGen;
  /* The fight's OWN pinned clock, not `fightNow()`. They agree today, but the
     ratings shown here must be the ratings the fight is about to be resolved
     with — reading the clock from anywhere other than the thing being started
     is how a screen ends up quietly describing a different battle. */
  const { teamA, teamB, youAre, them, now } = ui.pendingFight;
  const mineTeam = youAre === 'a' ? teamA : teamB;
  const theirTeam = youAre === 'a' ? teamB : teamA;

  const panel = section('Ready', 'Both of you hold the same fight now. Say go and press together.');

  const face = document.createElement('div');
  face.className = 'ar-faceoff';
  face.innerHTML =
    `<span><b>Your five</b><i>rating ${teamPower(makeTeam(mineTeam, now))}</i></span>` +
    '<em>vs</em>' +
    `<span><b>${escapeHtml(them || 'Their five')}</b><i>rating ${teamPower(makeTeam(theirTeam, now))}</i></span>`;
  panel.append(face);

  const lamp = document.createElement('p');
  lamp.className = 'ar-lamp';
  lamp.textContent = 'Press when they tell you they are on this screen too.';
  panel.append(lamp);

  const count = document.createElement('div');
  count.className = 'ar-countdown';
  count.hidden = true;
  panel.append(count);

  const row = document.createElement('div');
  row.className = 'ar-row';
  const go = button('Start battle', { className: 'btn go' });
  row.append(go, button('Back', {
    className: 'btn ghost',
    onClick: () => { readyGen++; clearTimers(); setPhase('build'); },
  }));
  panel.append(row);
  bodyEl.append(panel);
  go.focus();

  const view = { gen, go, anyway: { hidden: true }, lamp, count };
  go.addEventListener('click', () => runCountdown(view, COUNTDOWN_MS));
}

function runCountdown(view, fromMs) {
  if (view.gen !== readyGen) return;
  const { go, anyway, lamp, count } = view;
  go.disabled = true;
  go.classList.add('is-armed');
  go.classList.remove('is-hot');
  go.textContent = 'Starting…';
  anyway.hidden = true;
  lamp.textContent = 'Here we go — you are both watching the same fight.';
  lamp.className = 'ar-lamp is-ready';
  count.hidden = false;

  let n = Math.max(0, Math.ceil(fromMs / 1000));
  const tick = () => {
    if (view.gen !== readyGen) return;
    if (n <= 0) {
      count.textContent = 'GO';
      count.classList.add('is-go');
      /* One beat on GO before the arena replaces the screen, so the word is
         actually seen rather than flashing for a frame. */
      return later(() => { if (view.gen === readyGen) startFight(ui.pendingFight); }, 420);
    }
    count.textContent = String(n);
    /* Restarting the animation is what makes each number land as its own beat —
       without the reflow the class is already present and nothing replays. */
    count.classList.remove('tick');
    void count.offsetWidth;
    count.classList.add('tick');
    n -= 1;
    later(tick, 1000);
  };
  tick();
}

/* ── the code hand-off screens ───────────────────────────────────────────── */

function codeBox(code, { label, hint }) {
  const panel = section(label, hint);
  const ta = document.createElement('textarea');
  ta.className = 'ar-code-out';
  ta.rows = 4;
  ta.readOnly = true;
  ta.value = code;
  ta.addEventListener('focus', () => ta.select());

  const row = document.createElement('div');
  row.className = 'ar-row';
  const copy = button('Copy code', {
    className: 'btn primary',
    onClick: async () => {
      const ok = await copyText(code, ta);
      copy.textContent = ok ? 'Copied' : 'Press Ctrl+C';
      later(() => { copy.textContent = 'Copy code'; }, 1600);
    },
  });
  row.append(copy);
  panel.append(ta, row);
  return { panel, row };
}

/* Clipboard access is permission-gated and unavailable on insecure origins, so
   the fallback is not a nicety — a LAN-IP dev server is exactly the case that
   hits it. Selecting the text means the player can always finish the job by
   hand, which is why the textarea is on screen rather than hidden behind the
   button. */
async function copyText(text, ta) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    ta?.focus();
    ta?.select();
    return false;
  }
}

/* The challenger's screen after committing: the code to send, and a watch on
   the match room for somebody taking it up.

   THE PASTE BOX IS STILL HERE, and stays here, because the room may be
   unavailable — no binding, offline, blocked. It is shown as the manual route
   rather than the main one, and the moment the room reports an acceptance the
   whole screen gives way to the lobby. */
function renderChallengeOut(code) {
  bodyEl.replaceChildren();
  const gen = ++readyGen;
  const { panel } = codeBox(code, {
    label: 'Send them this code',
    hint: 'Paste it into the other window (or send it to a friend). Your five are locked in — they build against you.',
  });

  const waiting = document.createElement('p');
  waiting.className = 'ar-lamp';
  waiting.textContent = 'Waiting for someone to accept…';
  panel.append(waiting);

  const reply = section('No live lobby? Paste their reply here instead',
    'Only needed if the lobby cannot be reached — normally their acceptance shows up above on its own.');
  const ta = document.createElement('textarea');
  ta.className = 'ar-code-in';
  ta.rows = 3;
  ta.spellcheck = false;
  ta.placeholder = 'CGB1.z…';
  ta.setAttribute('aria-label', 'Result code');
  const row = document.createElement('div');
  row.className = 'ar-row';
  row.append(
    button('Load their reply', { className: 'btn ghost', onClick: () => onReply(ta.value) }),
    button('Back to building', { className: 'btn ghost', onClick: () => { readyGen++; setPhase('build'); } }),
  );
  reply.append(ta, row, noteSlot());

  bodyEl.append(panel, reply);

  /* Poll for the acceptance. The green flash is held for a beat before the
     lobby replaces the screen — a signal that vanishes in the same frame it
     appears is a signal nobody sees, and "someone accepted your challenge" is
     the one moment in this flow worth landing. */
  const poll = () => {
    if (gen !== readyGen) return;
    checkRoom(ui.room).then(st => {
      if (gen !== readyGen) return;
      if (!st.enabled) {
        waiting.textContent = 'Live lobby unavailable — use the paste box below when they reply.';
        return;                                   // stop polling; nothing to poll
      }
      ui.lobby = st;
      if (st.accepted) {
        waiting.className = 'ar-lamp is-ready';
        waiting.textContent = '✔ Challenge accepted — opening the lobby…';
        return later(() => { if (gen === readyGen) renderLobby(); }, 1100);
      }
      later(poll, POLL_MS);
    });
  };
  poll();
}

async function onReply(text) {
  note('');
  try {
    const decoded = await decodeCode(text);
    if (decoded.kind !== 'r') {
      return note('That is a challenge code, not a reply. You want the code they got AFTER fighting.', true);
    }
    if (!echoMatches(decoded, ui.sentTeam)) {
      return note('That reply is to a different challenge — it does not describe the five you committed.', true);
    }
    ui.enemy = decoded.teamB;
    /* Armed, not started — the challenger holds at the ready screen so the two
       of them can press together. This is the point where both windows finally
       hold both teams, which is the earliest moment a shared start is even
       possible. */
    armFight({
      teamA: decoded.teamA,
      teamB: decoded.teamB,
      seed: decoded.seed,
      now: decoded.now,
      youAre: 'a',
      them: decoded.name,
    });
  } catch (err) {
    note(err instanceof ChallengeError ? err.message : 'That code could not be read.', true);
  }
}

/* ── phase 3: the fight ──────────────────────────────────────────────────── */

const STEP_MS = 380;
const cardIndex = new Map();      // `${side}:${slot}` -> card element
let current = null;               // the running fight

function startFight({ teamA, teamB, seed, now, youAre, them = '' }) {
  clearTimers();
  current = {
    teamA, teamB, seed, now, youAre, them,
    result: battle(teamA, teamB, { now, rng: mulberry32(seed) }),
  };
  setPhase('fight');
}

function renderFightShell() {
  bodyEl.replaceChildren();
  cardIndex.clear();
  const { teamA, teamB, now, youAre, result } = current;

  const panel = section('Arena', 'Auto-resolved — the fight was decided the moment you committed. This is the replay.');

  const arena = document.createElement('div');
  arena.className = 'ar-arena';

  const theirSide = youAre === 'a' ? 'b' : 'a';
  arena.append(sideEl(theirSide, theirSide === 'a' ? teamA : teamB, now, false));

  const strip = document.createElement('div');
  strip.className = 'ar-vs';
  strip.innerHTML = '<span class="ar-round" id="ar-round">Round 1</span>';
  arena.append(strip);

  arena.append(sideEl(youAre, youAre === 'a' ? teamA : teamB, now, true));
  panel.append(arena);

  const log = document.createElement('div');
  log.className = 'ar-log';
  log.id = 'ar-log';
  panel.append(log);

  const verdict = document.createElement('div');
  verdict.className = 'ar-verdict';
  verdict.id = 'ar-verdict';
  verdict.hidden = true;
  panel.append(verdict);

  const row = document.createElement('div');
  row.className = 'ar-row';
  row.id = 'ar-fight-row';
  row.append(button('Skip to the end', { className: 'btn ghost', id: 'ar-skip', onClick: skipToEnd }));
  panel.append(row, noteSlot());

  bodyEl.append(panel);
  playLog(result);
}

function sideEl(side, channels, now, isMine) {
  const host = document.createElement('div');
  host.className = `ar-side ${isMine ? 'mine' : 'enemy'}`;
  const team = makeTeam(channels, now);

  const front = document.createElement('div');
  front.className = 'ar-line front';
  const back = document.createElement('div');
  back.className = 'ar-line back';

  channels.forEach((ch, slot) => {
    const card = renderBattleCard(ch, { now, slot });
    armHealthBar(card, team[slot].maxHp);
    cardIndex.set(`${side}:${slot}`, card);
    (slot < FRONT_SLOTS ? front : back).append(card);
  });

  const head = document.createElement('div');
  head.className = 'ar-side-head';
  const who = isMine ? 'Your five' : (current.them ? escapeHtml(current.them) : 'Opposition');
  head.innerHTML = `<b>${who}</b> rating ${teamPower(team)}`;

  /* The two sides FACE each other: the enemy's front rank is the row nearest
     the middle, and so is yours. Plain DOM order does it — no grid areas, so
     the row that is "nearest the middle" cannot drift away from the row the
     engine treats as front. */
  host.replaceChildren(head, ...(isMine ? [front, back] : [back, front]));
  return host;
}

let playAt = 0;
let playEvents = [];

function playLog(result) {
  playAt = 0;
  playEvents = result.log;

  const step = () => {
    if (playAt >= playEvents.length) return;
    const event = playEvents[playAt++];
    applyEvent(event, result);
    later(step, event.type === 'attack' ? STEP_MS : STEP_MS * 0.6);
  };
  step();
}

function skipToEnd() {
  clearTimers();
  while (playAt < playEvents.length) applyEvent(playEvents[playAt++], current.result);
}

function applyEvent(event, result) {
  if (event.type === 'round') {
    const label = $('ar-round');
    if (label) label.textContent = `Round ${event.round}`;
    addLog(`round ${event.round}`, 'round-line');
    return;
  }
  if (event.type === 'end') return finish(event, result);

  const attacker = cardIndex.get(`${event.side}:${event.attackerSlot}`);
  const defender = cardIndex.get(`${event.side === 'a' ? 'b' : 'a'}:${event.defenderSlot}`);
  if (!attacker || !defender) return;

  attacker.classList.add('is-acting');
  defender.classList.add('is-hit');
  later(() => attacker.classList.remove('is-acting'), STEP_MS * 0.8);
  later(() => defender.classList.remove('is-hit'), 260);

  setHealth(defender, event.defenderHp);
  popDamage(defender, event);
  addLog(logLine(event), event.side === current.youAre ? 'mine' : 'theirs');
}

function popDamage(cardEl, event) {
  const pop = document.createElement('span');
  pop.className = `ar-pop ${event.crit ? 'crit' : ''} ${event.matchup === 'strong' ? 'strong' : event.matchup === 'weak' ? 'weak' : ''}`.trim();
  const notes = [];
  if (event.crit) notes.push('CRIT');
  if (event.matchup === 'strong') notes.push('STRONG');
  if (event.matchup === 'weak') notes.push('RESIST');
  for (const tag of event.tags) if (tag !== 'momentum' && tag !== 'reaching') notes.push(tag.toUpperCase());
  pop.innerHTML = `-${event.damage}${notes.length ? `<small>${notes.slice(0, 2).join(' · ')}</small>` : ''}`;
  cardEl.querySelector('.bcard-inner').append(pop);
  later(() => pop.remove(), 900);
}

function logLine(event) {
  const bits = [`<b>${escapeHtml(event.attackerTitle)}</b> hits <b>${escapeHtml(event.defenderTitle)}</b> for ${event.damage}`];
  const tags = [...event.tags];
  if (event.crit) tags.unshift('crit');
  if (event.matchup !== 'even') tags.unshift(event.matchup === 'strong' ? 'element ▲' : 'element ▼');
  if (tags.length) bits.push(`<span class="tag">${escapeHtml(tags.join(' · '))}</span>`);
  if (event.defeated) bits.push('<span class="dead">DOWN</span>');
  return bits.join(' — ');
}

function addLog(html, cls = '') {
  const log = $('ar-log');
  if (!log) return;
  const p = document.createElement('p');
  if (cls) p.className = cls;
  p.innerHTML = html;
  log.append(p);
  log.scrollTop = log.scrollHeight;
}

function finish(event, result) {
  const box = $('ar-verdict');
  const skip = $('ar-skip');
  const row = $('ar-fight-row');
  if (!box || !row) return;

  const you = current.youAre;
  const won = event.winner === you;
  const draw = event.winner === 'draw';
  const mine = you === 'a' ? result.survivors.a : result.survivors.b;
  const theirs = you === 'a' ? result.survivors.b : result.survivors.a;

  box.className = `ar-verdict ${draw ? 'draw' : won ? 'win' : 'loss'}`;
  box.innerHTML = `${draw ? 'Draw' : won ? 'Victory' : 'Defeat'}
    <small>${result.rounds} rounds · ${mine} of yours standing, ${theirs} of theirs</small>`;
  box.hidden = false;
  if (skip) skip.hidden = true;

  /* A SAFETY NET, not the hand-off. The code is offered before the replay now
     (renderHandoff) so both players can start together — but "I watched it and
     forgot to send the code" is the obvious way to strand the other person, and
     it costs nothing to keep the code reachable afterwards. Worded as a
     reminder rather than an instruction so it does not read as a second,
     different code. */
  if (ui.mode === 'accept' && ui.replyCode) {
    const { panel } = codeBox(ui.replyCode, {
      label: 'Still need to send it?',
      hint: 'The same code as before. They cannot watch this fight until they have it.',
    });
    bodyEl.append(panel);
  }

  row.append(
    button('Rebuild and fight again', { className: 'btn primary', onClick: () => { clearTimers(); setPhase('build'); } }),
    button('New opponent', { className: 'btn ghost', onClick: () => { clearTimers(); setPhase('mode'); } }),
  );
}

/* ── lineup persistence ──────────────────────────────────────────────────── */

/* Stored as ids and resolved against the live collection, never as card data.
   Same discipline as engine/collection.js storing channels rather than derived
   cards: a saved lineup that carried its own copy of a channel would drift out
   of date the moment the weekly set refreshed the real one. Cards that have
   left the collection simply drop out of the lineup. */
function persistLineup() {
  saveLineup(ui.lineup.map(c => c?.id ?? ''));
}

function restoreLineup() {
  const byId = new Map(myChannels().map(c => [c.id, c]));
  const saved = loadLineup();
  ui.lineup = new Array(TEAM_SIZE).fill(null);
  saved.slice(0, TEAM_SIZE).forEach((id, i) => {
    if (id && byId.has(id)) ui.lineup[i] = byId.get(id);
  });
  const next = ui.lineup.findIndex(c => !c);
  ui.selectedSlot = next === -1 ? 0 : next;
}

/* ── open/close ──────────────────────────────────────────────────────────── */

export function openArena() {
  lastTrigger = document.activeElement;
  clearTimers();
  ui.mode = null;
  ui.enemy = null;
  ui.challenge = null;
  ui.sentTeam = null;
  ui.replyCode = '';
  ui.preview = new Map();
  ui.note = '';
  restoreLineup();
  arenaEl.hidden = false;
  setPhase('mode');
  closeBtn.focus();
}

/* `isArenaOpen` was exported here to mirror `isInspectOpen`, which reveal.js
   genuinely needs to decide whose Escape a keypress belongs to. Nothing ever
   imported this one — the arena is the top overlay and answers its own Escape —
   so it was an export with no reader. */

export function closeArena() {
  clearTimers();
  /* Invalidates any presence request still in flight — otherwise a reply that
     lands after the overlay closed would paint a countdown into a detached
     screen and then start a fight nobody is watching. */
  readyGen++;
  arenaEl.hidden = true;
  bodyEl.replaceChildren();
  current = null;
  if (lastTrigger?.focus) lastTrigger.focus();
  lastTrigger = null;
}

closeBtn.addEventListener('click', closeArena);
arenaEl.addEventListener('click', e => { if (e.target === arenaEl) closeArena(); });
/* Escape closes only when this is the TOP overlay. The inspector can be opened
   from underneath it one day, and two overlays both answering Escape is how you
   get a keypress that closes the wrong one. */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !arenaEl.hidden) closeArena();
});
