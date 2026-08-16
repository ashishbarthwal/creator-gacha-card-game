/* ui/battle — the arena: pick five, fight something, watch it play out.

   Wiring only, in the spirit of main.js. Every rule it enforces comes from
   engine/ — battle.js resolves the fight, opponent.js builds the AI and
   arranges formations, element.js decides matchups, challenge.js encodes the
   cross-window code, fairness.js caps a larger collection's search space.
   Nothing here decides anything about the game; if a number looks wrong on
   this screen, it is wrong in the engine.

   ── THREE WAYS TO FIGHT ────────────────────────────────────────────────────
     Quick battle   an AI matched to YOUR team out of the current set pool.
                    The one that always works, including with nobody else
                    around, which is why it is first.
     Challenge      send a code — build your five now, or send it bare and
                    build together once they accept.
     Accept         paste a code someone sent you.

   ── REWRITTEN 2026-08-15: NO MORE SCOUTING ────────────────────────────────
   v1 made the challenger commit a team before the defender could even see
   the challenge, so the defender always built LAST, against a visible enemy
   — real strategic value, and one-sided. Ash's brief (items 8-14) removes
   that: once a challenge is accepted through a LIVE match room, both players
   land on the SAME shared build screen at the SAME time and build blind —
   neither one scouts the other. The challenger may still build a team before
   sending ("cocky" — brief item 10), but it is only ever a starting point,
   editable right up until they press Ready in the shared build phase; the
   defender never sees it early.

   ── THE TWO PATHS, AND WHERE THEY DIVERGE ─────────────────────────────────
   A fight cannot be resolved until BOTH teams are known. Whether that
   moment can happen live depends on one thing: is the match room reachable.

     LIVE PATH (a match room is reachable). `renderAcceptPaste`'s accept and
     `renderChallengeOut`'s poll both detect this the same way — the server
     answers `enabled:true`. Both sides then run `enterSharedBuild`, which
     runs the collection-fairness check (fairness.js, brief items 15-27) for
     whichever side is more than 1.5x the other's size, then lands both of
     them on `renderSharedBuildScreen`: a shared, server-anchored 30-second
     timer, no enemy panel, Auto Build or manual picks, and a Ready button
     that LOCKS a side's team the moment it is pressed (or the timer expires
     — brief items 13-14). Both locked -> a short face-off beat
     (`renderLockedFaceoff`) -> the fight.

     MANUAL PATH (no match room — unbound, offline, blocked). Exactly what
     this app shipped with, and deliberately untouched by the 2026-08-15
     rewrite: two people passing a string by hand have no live channel to
     build simultaneously over, so it stays sequential. The challenger must
     have committed a team before sending (a BARE challenge has nothing to
     fall back to — see the guard in `renderAcceptPaste` and
     `engine/challenge.js`'s `makeResult`); the defender scouts and builds
     against the visible five, commits, and hands back a code by hand
     (`fightAsDefender`/`renderHandoff`); both press Start on a spoken
     three-two-one (`renderReady`/`runCountdown`).

   The server (functions/api/ready/[room].js) is told a room hash, which side
   accepted or locked, each side's collection SIZE, and — once each side
   locks — their five cards. See that file for the wire shape and
   DECISIONS.md for the amendment that allows it to exist at all.

   ── HOW TWO WINDOWS SHOW THE SAME FIGHT ───────────────────────────────────
   Nothing about the battle itself is synchronised, live or manual. Both
   windows resolve the SAME fight independently from the same inputs, because
   engine/battle.js is pure and seed-deterministic and engine/battle-stats.js
   takes its clock as a parameter. The seed and the pinned `now` are fixed the
   moment the challenge is CREATED (before either side can see the other's
   team) and travel with it; both sides run `battle` and get identical logs,
   hit for hit. Neither path ever carries a result — only inputs — and a
   result it did carry could not be trusted anyway (see challenge.js).

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
import { arrangeFormation, bestTeamFrom, collectionOpponent } from '../engine/opponent.js';
import { mountCodex } from './codex.js';
import { ELEMENT_CYCLE, ELEMENT_LORE } from '../engine/element.js';
import {
  makeChallenge, makeResult, decodeCode, newSeed, fingerprint, ChallengeError,
} from '../engine/challenge.js';
import {
  roomFor, acceptChallenge, lockTeam, enterBuild, bailOut, checkRoom, presenceOff,
  presenceAvailable,
} from '../data/presence.js';
import {
  MAX_COLLECTION_RATIO, needsShedding, eligibleSizes, shedCollection, protectedRaritiesPresent,
} from '../engine/fairness.js';
import { renderBattleCard, armHealthBar, setHealth, ELEMENT_STYLE } from './battle-card.js';
import { escapeHtml } from './util.js';

const $ = id => document.getElementById(id);

const arenaEl = $('arena');
const closeBtn = $('arena-close');
const stepsEl = $('ar-steps');
const bodyEl = $('ar-body');
const codexEl = $('ar-codex');

/* A `MODE` table mapping each flow to a side used to live here and was never
   read: the side is decided where the flow actually branches (`ui.side` at
   commit/accept, `youAre` on the pending fight), and a second copy of that
   mapping could only ever drift out of step with the first. */
const ui = {
  mode: null,
  phase: 'mode',
  stage: null,           // 'choice' — the challenge build-now/send-first sub-screen
  lineup: new Array(TEAM_SIZE).fill(null),  // channels, by slot
  selectedSlot: 0,
  enemy: null,          // channels, once known — MANUAL fallback scouting only; the
                         // live shared build phase never sets this (see file header)
  challenge: null,      // decoded challenge, in accept mode
  sentNow: 0,
  sentSeed: 0,          // the challenger's seed, kept locally for the live shared-build path
  preview: new Map(),
  timers: [],
  name: '',
  note: '',
  replyCode: '',        // defender's reply, MANUAL fallback only
  pendingFight: null,   // a resolved fight held behind a button, so both sides can start together
  room: '',             // match-room id, derived from the challenge by both sides
  side: null,           // 'a' challenger | 'b' defender — the seat, not the team
  claim: '',            // random per-match nonce claiming the defender's seat (see presence.js)
  roomState: null,      // last state read from the match room
  /* The fairness verdict for THIS match, decided once when the lobby opens and
     read again by the builder — never recomputed. Same discipline as the two
     deadlines below: `fairnessFor` reads the other side's collection size out
     of `roomState`, and `roomState` is replaced by every poll, so recomputing
     it later can answer differently from the screen the player just agreed to.
     A room write built on a stale read drops `csB` (the room is a KV
     read-modify-write with no compare-and-set), which is enough to turn the
     shed the gate promised into no shed at all — or, in the other direction,
     to shed a player who was never shown the screen. */
  gate: null,
  locked: false,        // have I locked my team in the live shared build phase
  eligiblePool: null,   // this side's battle-eligible collection (fairness.js's shed, or the full collection)
  /* The shared build phase's end, already converted into THIS browser's clock.
     One fixed timestamp, not the server's raw numbers — see adoptBuildWindow
     for why storing the pieces separately is what broke the countdown. */
  buildDeadline: null,
  /* The lobby's end, likewise already in THIS browser's clock. Separate from
     buildDeadline because the two phases are anchored to two different server
     stamps: the lobby to `lobbyAt` (set on accept), the build to
     `buildStartAt` (set when the second side enters). */
  gateDeadline: null,
};

let lastTrigger = null;

/* ── helpers ─────────────────────────────────────────────────────────────── */

/* Every distinct card the player owns, as channels. Distinct BY ID because a
   collection stacks duplicates and a team may not field the same creator twice
   — the same rule engine/opponent.js applies to the AI's own draw. */
function myChannels() {
  return [...state.collection.values()].map(item => item.card.channel);
}

/* A throwaway nonce for the defender's seat in one match room — see
   data/presence.js. Kept inside the room's own `[a-z0-9]{4,64}` alphabet, and
   made from `randomUUID` where it exists, since the property that matters is
   that two browsers never invent the same one. Math.random is a fine fallback
   rather than a weakness: guessing this buys nothing on its own, because
   reaching the room at all already requires the challenge code. */
function newClaim() {
  const raw = globalThis.crypto?.randomUUID?.()
    ?? `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
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

/* A POLL LOOP THAT SURVIVES A BACKGROUNDED TAB.

   Mobile browsers freeze a tab the moment it loses focus: pending timers stop
   or are throttled to roughly once a minute, and in-flight requests are torn
   down. This matters here more than anywhere else in the app, because the
   challenger is the one player who MUST leave the app — to paste their code
   into a chat — while a loop is waiting on the other side.

   So the loop wakes on return rather than waiting out a throttled timer.
   Clearing the pending timer inside `next` is what stops a wake-up from
   starting a SECOND chain running alongside the first: at most one timer is
   ever outstanding, whoever asked for it. */
function pollChain(gen, run) {
  let timer = null;
  const next = ms => {
    if (gen !== readyGen) return;
    clearTimeout(timer);
    timer = setTimeout(run, ms);
    ui.timers.push(timer);
  };
  const onReturn = () => {
    if (gen !== readyGen) return document.removeEventListener('visibilitychange', onReturn);
    if (!document.hidden) next(0);
  };
  document.addEventListener('visibilitychange', onReturn);
  return next;
}

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
  if (ui.phase === 'build') return ui.stage === 'choice' ? renderChallengeChoice() : renderBuild();
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
      'Send a code — build your five now, or send it bare and build together the moment they accept. Nobody scouts anybody.'),
    modeCard('Accept a challenge', 'accept',
      'Paste a code someone sent you. You both build blind, at the same time, on a shared clock.'),
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

/* ── EVERYTHING THAT BELONGS TO ONE MATCH, CLEARED IN ONE PLACE ────────────
   A match is not the arena's lifetime, and treating the two as the same thing
   is what broke the second fight of a session. The per-match fields were only
   ever reset in `openArena` — so a player who finished a fight, pressed New
   opponent and challenged again carried the whole previous match forward:

     - `buildDeadline` still held the FIRST match's end time, which by then was
       minutes in the past. The countdown opened at 00:00 and auto-locked
       instantly, for whichever side reached the shared build phase first —
       exactly the "timer began at 0 for one side and the other got no time"
       report. This is the same class of bug as the frozen countdown it
       replaced: state that describes one moment being read at another.
     - `lineup` was reloaded from storage, so the tray came back pre-populated
       in a phase whose whole premise is that both sides build fresh and blind.
     - `eligiblePool` still held the previous match's fairness shed, `locked`
       could still be true, and `room`/`side` still pointed at a dead lobby.

   So there is now exactly one function that says what a match owns, and every
   entry into a new one goes through it. The fields deliberately NOT reset are
   the two that belong to the player rather than the match: `name`, and the
   saved lineup in storage (their last deck, which the solo builder still
   restores — see renderSharedBuildScreen for why the shared phase does not). */
function resetMatch() {
  clearTimers();
  /* Invalidates any poll or countdown still in flight from the last match —
     without this, the previous room's poll chain keeps running and can paint
     into, or navigate away from, the new match's screens. */
  readyGen++;
  ui.challenge = null;
  ui.enemy = null;
  ui.sentNow = 0;
  ui.sentSeed = 0;
  ui.replyCode = '';
  ui.pendingFight = null;
  ui.room = '';
  ui.side = null;
  ui.claim = '';
  ui.roomState = null;
  ui.gate = null;
  ui.locked = false;
  ui.eligiblePool = null;
  ui.buildDeadline = null;
  ui.gateDeadline = null;
  ui.preview = new Map();
  ui.note = '';
}

function chooseMode(mode) {
  resetMatch();
  ui.mode = mode;
  ui.stage = mode === 'challenge' ? 'choice' : null;
  note('');
  restoreLineup();
  if (mode === 'accept') return renderAcceptPaste();
  setPhase('build');
}

/* ── the send-a-challenge screen ───────────────────────────────────────────
   A name and one button. It carried a second option until 2026-08-15 — brief
   item 10's "cocky" path, where the challenger built five before sending —
   and that option was removed rather than fixed: every other change in this
   pass exists to put both sides in front of the same clock with the same
   information, and a challenger who has already chosen is not doing the same
   thing as the person opposite them, however editable their picks nominally
   remain. See DECISIONS.md 2026-08-15 for the trade this makes with the
   no-server fallback. */
function renderChallengeChoice() {
  bodyEl.replaceChildren();
  const panel = section('Send a challenge',
    'A challenge means "I want to battle you" — building your five is optional up front.');

  const nameRow = document.createElement('div');
  nameRow.className = 'ar-row';
  const input = document.createElement('input');
  input.className = 'field ar-name';
  input.placeholder = 'Your name (optional — shown to them)';
  input.maxLength = 24;
  input.value = ui.name;
  input.addEventListener('input', () => { ui.name = input.value; });
  nameRow.append(input);
  panel.append(nameRow);

  const grid = document.createElement('div');
  grid.className = 'ar-modes';
  const optBtn = (title, blurb, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ar-mode-card';
    b.innerHTML = `<b>${escapeHtml(title)}</b><span>${escapeHtml(blurb)}</span>`;
    b.addEventListener('click', onClick);
    return b;
  };
  /* ONE OPTION, BECAUSE THE OTHER ONE UNDID THE POINT. This screen used to
     offer "Build my team first" alongside it — brief item 10's "cocky" path,
     where the challenger picked five before sending. Every other change in
     this pass exists to make the two sides face the same clock with the same
     information, and a challenger who arrives at the shared builder having
     already chosen is not doing the same thing as the person opposite them,
     however editable their picks nominally are. Removed rather than kept as
     a trap for the unwary. */
  const bare = optBtn('Send the challenge',
    'They accept, you both enter the same lobby, and you build your five side by side against the same clock. Neither of you sees the other\'s team until it is locked.',
    () => sendBareChallenge());
  grid.append(bare);
  panel.append(grid, noteSlot());
  bodyEl.append(panel);

  /* SENDING A BARE CHALLENGE IS ONLY POSSIBLE WITH A LIVE ROOM, so do not offer
     it when there is not one. A bare challenge carries no team, and the only
     channel that could ever settle one is the shared build phase — with the
     endpoint unreachable there is no second code exchange that could fill it in
     (see engine/challenge.js's makeResult guard), so the player would be picking
     an option that dead-ends a screen later.

     Asked asynchronously and applied when it answers, never awaited before the
     screen renders: both options are live immediately, and the only one that can
     change is the one that was about to fail anyway. Only a SETTLED `off` closes
     it — a single dropped request says nothing, and disabling a working option
     because one probe timed out would be its own bug. */
  presenceAvailable().then(state => {
    /* `isConnected` rather than the usual readyGen guard: leaving this screen
       for the ordinary builder does not bump readyGen (nothing async was
       started), so the generation counter cannot tell whether this button is
       still on screen. Asking the node directly can. */
    if (!bare.isConnected || !presenceOff(state)) return;
    bare.disabled = true;
    bare.classList.add('is-unavailable');
    /* NAMES QUICK BATTLE, NOT A DEAD END. This used to read "Build a team
       first and send that instead" — advice for a path that no longer exists:
       "Build my team first" was removed in the 2026-08-15 rework (see the
       comment above `bare`), so the only thing the player could do with that
       sentence was look for a button that is not there. With no lobby there is
       no cross-device battle at all, and the honest way on is the one that
       never needed a server — the same wording the waiting screen already
       uses when it loses the room. */
    bare.innerHTML = '<b>Send the challenge</b><span>Unavailable — a cross-device challenge needs '
      + 'the live lobby, and it cannot be reached right now. Quick battle does not need it.</span>';
  });
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
          ui.side = 'b';
          ui.room = roomFor(fingerprint(decoded.teamA ?? []), decoded.seed);
          /* AWAITED, unlike v1's fire-and-forget accept: the branch below
             depends on whether a live room actually exists, not just on
             hoping the request landed. A live room means both players enter
             the SAME shared build phase (brief item 11) — no scouting, no
             asymmetry. No live room falls back to the sequential flow this
             app shipped with, which is the only path a BARE (team-less)
             challenge has nothing to fall back to at all: see the note below. */
          ui.claim = newClaim();
          const state = await acceptChallenge(ui.room, myChannels().length, ui.claim);
          /* SOMEBODY ELSE GOT HERE FIRST, and being told so is the whole point.
             A challenge code is a string — forwarded, screenshotted, pasted into
             a group chat — so more than one person can hold the same one, and
             before the seat was claimable the second acceptance quietly broke
             the match for BOTH of them: two browsers took the defender's seat,
             nobody was ever in the challenger's, and the lobby waited out its
             ten minutes for a player who did not exist. */
          if (state.seatTaken) {
            resetMatch();
            return note('Someone else has already accepted this challenge — a code is good for one battle, and they took it. Ask them for a fresh one.', true);
          }
          if (state.enabled) {
            ui.roomState = state;
            adoptGateWindow(state);
            note(decoded.name ? `Challenge from ${decoded.name} accepted.` : 'Challenge accepted.');
            return enterSharedBuild('b');
          }
          if (!decoded.teamA) {
            /* No "ask them to build a team first" — that instruction named the
               removed pre-build option, so it asked the sender for something
               their own screen no longer offers. Every new challenge is bare by
               design now, which makes a reachable lobby the whole requirement,
               and saying so is the only actionable thing left. */
            return note('This challenge needs the live lobby to settle, and it cannot be reached right now — so there is nothing here to build against yet. Try again once it is back, or take a Quick battle, which needs no connection.', true);
          }
          /* MANUAL FALLBACK, unchanged from v1: no live room, but the
             challenger DID commit a team before sending, so the old
             sequential scouting flow — build against their visible five,
             hand back a reply code by hand — still works exactly as it
             always did. */
          ui.enemy = decoded.teamA;
          note(decoded.name ? `Challenge from ${decoded.name} — build against their five.` : '');
          setPhase('build');
        } catch (err) {
          note(err instanceof ChallengeError ? err.message : 'That code could not be read.', true);
        }
      },
    }),
    button('Back', { className: 'btn ghost', onClick: () => { resetMatch(); setPhase('mode'); } }),
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
    button('Auto-pick', { className: 'btn ghost', onClick: () => autoPick() }),
    button('Clear', { className: 'btn ghost', onClick: () => { ui.lineup.fill(null); ui.selectedSlot = 0; persistLineup(); refreshTeam(); } }),
    button('Back', { className: 'btn ghost', onClick: () => { resetMatch(); setPhase('mode'); } }),
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

/* The solo builder is only ever reached by Quick battle and by the legacy
   manual accept path now — a challenge is sent from its own screen without a
   team, so "commit five and get a code" no longer exists as a route. */
function fightLabel() {
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
   game — and a bonus a player cannot see is a decision they cannot make.

   ── WHY IT NOW COMPARES AGAINST THE ENEMY ─────────────────────────────────
   The ratings above this line can read "even" while the fight is anything but,
   and that was measured rather than suspected: matched on rating, a player
   fielding 3 classes against an AI fielding 5 wins about a quarter of the time.
   Level on diversity, the same matchup is 47% — a fair fight.

   The cause is not a matchmaking bug. `aimedBuild` corrects the AI's power for
   the lift it earns and lands within ~1.5% of target. It is that the +2.5%/+5%
   printed here is the STAT lift, and the stat lift is not what diversity is
   worth: it buys class verbs too — an Aegis to hide behind, a Titan to soak, a
   Backstab that reaches past both — and `powerOf` cannot see a verb.

   So the honest thing is not to restate the percentage louder, it is to show
   the player the comparison the number is hiding, whenever there is an enemy on
   the board to compare against. Same argument as the element wheel: information
   that points at the OPPONENT is what turns picking into deciding. */
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
  const mine = lift > 1
    ? `<b>Formation +${pctLift}%</b> — ${classes} different classes: ${escapeHtml(names)}`
    : `<b>Formation</b> — ${classes} different class${classes === 1 ? '' : 'es'} (${escapeHtml(names)}). Field 4 for +2.5%, 5 for +5%.`;

  /* Only once the team is full: told mid-build it is noise, because a team of
     two is behind on classes by construction and there is nothing to act on. */
  if (!ui.enemy || !isComplete()) { el.innerHTML = mine; return el; }
  const theirs = formationBonus(ui.enemy, now).classes;
  if (classes >= theirs) {
    el.innerHTML = `${mine}<br><span class="ar-formation-vs is-good">They field ${theirs}. `
      + `${classes > theirs ? 'The shape is yours.' : 'Evenly shaped.'}</span>`;
  } else {
    el.innerHTML = `${mine}<br><span class="ar-formation-vs is-warn">They field ${theirs}. `
      + 'Ratings will read closer than the fight is — a spare class is worth more than it prints.</span>';
  }
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

function poolPanel(now, pool = myChannels()) {
  const panel = section('Your collection', 'Click a card to slot it. Click it again to take it out.');
  const grid = document.createElement('div');
  grid.className = 'ar-pool';
  const fieldedIds = new Set(filled().map(c => c.id));

  for (const channel of pool) {
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
  /* Once locked (the live shared build phase, after Ready), the team is
     final and uploaded — editing after that would silently disagree with
     what the server, and therefore the OTHER window, already has. `ui.locked`
     is only ever true there; every other flow leaves it false. */
  if (ui.locked) return;
  /* A filled slot empties; an empty one becomes the target for the next card
     clicked. Two gestures, no dragging — the same interaction has to work on a
     phone, and a drag that fails silently is worse than a click that does not. */
  if (ui.lineup[slot]) ui.lineup[slot] = null;
  ui.selectedSlot = slot;
  persistLineup();
  refreshTeam();
}

function onPick(channel) {
  if (ui.locked) return;
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
   countering elements is the point the whole element layer exists to make.

   NEVER WIRE THIS DIRECTLY AS AN EVENT HANDLER — `onClick: autoPick` hands the
   MouseEvent straight into `pool`. That is exactly how this button broke the
   day `pool` was added (it took no arguments before, so passing the function by
   reference had been correct for its whole life). The failure is invisible from
   the outside: `distinctById` calls `.filter` on the event, throws inside the
   handler, and the button simply does nothing — no error on screen, no clue.
   Normalised here as well as fixed at the call sites, because a silent
   do-nothing button is worth one defensive line to make impossible twice. */
function autoPick(poolArg) {
  const pool = Array.isArray(poolArg) ? poolArg : myChannels();
  const now = fightNow();
  /* The scouted opponent, when there is one — accept-a-challenge mode's
     MANUAL fallback is the one flow where the player can see who they are up
     against before picking, and Auto Select uses that the same way a
     thinking player would: as a tie-break among cards that are already close
     on power, never as a reason to bench a clearly stronger one. See
     opponent.js's bestTeamFrom. `ui.enemy` is always null in the live shared
     build phase, since neither side scouts the other there. */
  ui.lineup = arrangeFormation(bestTeamFrom(pool, { now, enemy: ui.enemy }), now);
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
  if (ui.mode === 'accept') return fightAsDefender();
}

/* THE AI PLAYS BY THE PLAYER'S RULES NOW. It is handed a collection the same
   size as yours, rolled from the same set on the same drop odds, and builds
   its best five out of that — instead of the old `matchOpponent`, which aimed
   a team at your exact rating using the whole 15,890-card set as its hand.

   The difference is what a pull is FOR. Power-matching made every Quick battle
   even by construction, which sounds fair and quietly meant your collection
   did not matter: pulling a RUBY changed nothing, because the opponent was
   rebuilt to your new rating either way. Rolling the AI a binder instead makes
   the fight turn on the same two things a live 1v1 turns on — how your luck
   went, and how well you build from it. See opponent.js's rollAiCollection. */
function fightAI() {
  const now = Date.now();
  ui.sentNow = now;
  const mine = filled();
  /* Cards, not channels — the roll is band-first weighted and needs each
     card's rarity to pick a band. Falls back to the player's own collection
     only when no set is loaded at all, which is the offline demo case. */
  const source = state.setsPool.length
    ? state.setsPool
    : [...state.collection.values()].map(item => item.card);
  const opponent = collectionOpponent(source, myChannels().length, { now, rng: Math.random });

  if (opponent.channels.length < TEAM_SIZE) {
    return note('The current set is too thin to field an opponent. Load a set with more cards.', true);
  }
  ui.enemy = opponent.channels;
  /* Said plainly, because it is the premise of the fight rather than a
     disclaimer: the opponent got the same number of cards and the same odds,
     so whatever happens next is about the five each side picked. */
  ui.note = `Your opponent rolled a collection of ${opponent.collection.length} on the same odds, and brought their best five.`;
  startFight({ teamA: mine, teamB: ui.enemy, seed: seedOf([...mine, ...ui.enemy]), now, youAre: 'a' });
}

/* THE ONLY WAY A CHALLENGE IS SENT NOW: bare, with no team, decided together
   the moment it is accepted. `createChallenge` — which committed five cards
   and folded them into the code — was removed alongside the "Build my team
   first" option it existed to serve, because a challenger who has already
   chosen is not doing the same thing as the person opposite them.

   Only reachable through the live shared build phase: a code with no team in
   it has nothing for a manual reply to answer, which is why the sub-choice
   screen probes for a lobby before offering the button at all, and why
   engine/challenge.js's makeResult guards the same case from the other end. */
async function sendBareChallenge() {
  const now = Date.now();
  const seed = newSeed();
  ui.sentNow = now;
  ui.sentSeed = seed;
  ui.side = 'a';
  ui.room = roomFor(fingerprint([]), seed);
  try {
    const code = await makeChallenge({ team: null, name: ui.name, seed, now, collectionSize: myChannels().length });
    renderChallengeOut(code);
  } catch {
    note('Could not build a challenge code.', true);
  }
}

/* THE DEFENDER'S MANUAL FALLBACK, unchanged in spirit from v1 — reached only
   when `renderAcceptPaste` has already confirmed the live room is
   unreachable, so there is no point retrying it here. The defender builds
   against the challenger's visible five (the old scouting flow), commits,
   and hands back a code by hand. */
async function fightAsDefender() {
  const mine = filled();
  try {
    ui.replyCode = await makeResult({ challenge: ui.challenge, team: mine, name: ui.name, collectionSize: myChannels().length });
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
  renderHandoff();
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

/* ── THE SHARED BUILD PHASE (2026-08-15) ───────────────────────────────────
   Brief items 8-14, 32: once a challenge is accepted THROUGH A LIVE ROOM,
   both players land on this same screen at the same time and build blind —
   neither sees the other's picks, which is what removes v1's asymmetry (the
   defender used to scout the challenger's committed five before building).
   A 30-second countdown, server-anchored via `buildStartAt` the same way the
   old lobby anchored its own countdown to `bothAt`, runs for both sides.
   Locking is the whole of committing now: press Ready (or let the timer do
   it for you) and your five are final and uploaded. Both locked -> straight
   into a short face-off beat, then the fight.

   THIS IS THE ONLY PATH THAT USES `enterSharedBuild`/`renderLobbyGate`/
   `beginSharedBuild`/`renderSharedBuildScreen`/`renderLockedFaceoff` below.
   Everything above this block (fightAsDefender, renderHandoff, and — further
   down — renderReady/runCountdown for the manual finish) is the MANUAL
   fallback, reached only when a live room could not be established, and is
   deliberately untouched by this rewrite: two people passing a string by
   hand have no live channel to build simultaneously over, so it keeps the
   sequential shape this app shipped with. */

/* ── THE LOBBY ─────────────────────────────────────────────────────────────
   Entry point for BOTH sides once a live room confirms acceptance, and the
   answer to the last asymmetry in this flow.

   THE PROBLEM IT FIXES. Only one side ever faces the collection-fairness gate
   — by construction, since only one collection can be the larger. Before this
   existed, acceptance dropped both sides straight into the build phase, so
   while the larger player read the CONTINUE/CHICKEN OUT screen and decided,
   their opponent was already picking cards against a running 30-second clock.
   The side with a decision to make was the side penalised for making it, which
   is exactly the shape of unfairness the whole rework set out to remove.

   WHAT REPLACES IT. Acceptance opens a fixed ten-second lobby that BOTH sides
   sit in and neither can build during:

     - the larger side sees COLLECTION SIZE with CONTINUE / CHICKEN OUT;
     - the other side is told a decision is being made, and gets a button of
       their own so both are doing the same thing;
     - both watch the same countdown, anchored to the server's `lobbyAt`;
     - anyone who has not pressed by zero is entered automatically, so an
       absent player cannot stall the match.

   The build clock then starts when BOTH sides have entered — the server
   stamps `buildStartAt` on the second `enter`, not on `accept`. That is what
   guarantees the 30 seconds begin at one instant for the two of them.

   WHAT THE SMALLER SIDE IS TOLD, AND WHAT IT IS NOT. It learns that its
   opponent has a decision to make; it is never told what the decision is
   about. Brief item 21 asks that the smaller player not be made to think
   about invisible balancing rules, and "they are deciding whether to proceed"
   satisfies that while still explaining the wait — which the alternative, an
   unexplained ten-second pause, does not. */
function enterSharedBuild(side) {
  ui.side = side;
  ui.locked = false;
  ui.eligiblePool = null;
  ui.stage = null;
  /* Emptied HERE as well as in renderSharedBuildScreen, and not redundantly:
     `setPhase('build')` below paints the solo builder for a frame before the
     lobby replaces it, so a lineup left loaded flashes the previous match's
     five on screen on the way past. Clearing before the phase change is what
     makes the tray look empty rather than look emptied. */
  ui.lineup = new Array(TEAM_SIZE).fill(null);
  ui.selectedSlot = 0;
  setPhase('build');
  renderLobbyGate();
}

/* My collection against theirs, and whether the gate applies to me. Returns
   null when the other side's size is unknown (a pre-v2 challenge code, or a
   room that has not reported one yet) — unknown must mean "no shedding",
   never a guess, because shedding someone by mistake takes cards out of a
   fight they were entitled to bring. */
function fairnessFor(side) {
  const mySize = myChannels().length;
  const theirSize = side === 'a' ? (ui.roomState?.csB ?? null) : (ui.challenge?.collectionSize ?? null);
  if (theirSize == null || !(mySize > theirSize) || !needsShedding(mySize, theirSize)) return null;
  return { mySize, theirSize, cap: eligibleSizes(mySize, theirSize).a };
}

function renderLobbyGate() {
  bodyEl.replaceChildren();
  const gen = ++readyGen;
  const side = ui.side;
  /* Decided HERE and kept, not re-derived by the builder — the screen below is
     a promise about what this battle will do, and `fairnessFor` can answer
     differently a few seconds later (see `ui.gate`). */
  const gate = ui.gate = fairnessFor(side);
  let entered = false;
  let enteredAt = 0;
  let stalled = false;

  const panel = gate
    ? section('Collection size', 'For this battle only — nothing you own is changed.')
    : section('Challenge accepted', 'Both of you start building the moment this lobby closes.');

  const timerEl = document.createElement('div');
  timerEl.className = 'ar-timer';
  panel.append(timerEl);

  if (gate) {
    const info = document.createElement('div');
    info.className = 'ar-fairness';
    info.innerHTML = `
      <p>Your collection: <b>${gate.mySize} cards</b><br>Opponent collection: <b>${gate.theirSize} cards</b></p>
      <p>Your collection is more than ${MAX_COLLECTION_RATIO}x your opponent's.</p>
      <p>For this battle, your eligible collection will be temporarily reduced to <b>${gate.cap} cards</b>.</p>
      <p>Your full collection will NOT be affected.</p>`;
    panel.append(info);

    const present = protectedRaritiesPresent(myChannels());
    if (present.length) {
      const guarantee = document.createElement('div');
      guarantee.className = 'ar-fairness-guarantee';
      guarantee.innerHTML = `<p>You will retain at least:</p><ul>${present.map(r => `<li>✓ 1 ${escapeHtml(r)}</li>`).join('')}</ul>`;
      panel.append(guarantee);
    }
  } else {
    /* The waiting side. Told there IS a decision, never told what it is
       about — see the note on item 21 above. */
    const info = document.createElement('div');
    info.className = 'ar-fairness';
    info.innerHTML = `
      <p>Your opponent is confirming whether to go ahead.</p>
      <p>Nobody is building yet — the moment you are both in, the same
         thirty-second team-building clock starts for both of you.</p>`;
    panel.append(info);
  }

  const status = document.createElement('p');
  status.className = 'ar-lamp';
  status.textContent = gate ? 'Decide before the lobby closes.' : 'Waiting for them…';

  /* Leaving has to reach the ROOM, not just this browser — the other side is
     explicitly waiting on this decision, so a quiet retreat leaves them
     waiting out a match that is already over. */
  const backOut = message => {
    bailOut(ui.room, side);
    resetMatch();
    setPhase('mode');
    note(message);
  };

  const row = document.createElement('div');
  row.className = 'ar-row';
  const goBtn = button(gate ? 'CONTINUE' : "I'M READY", {
    className: 'btn go',
    onClick: () => enterNow(false),
  });
  row.append(goBtn);
  if (gate) {
    /* "Do not use additional humorous alternatives... the only humorous option
       should be CHICKEN OUT" — brief item 20, verbatim. It now REACHES THE
       ROOM (`bail`), which it did not before: leaving quietly was tolerable
       when nobody was watching for it, and indefensible now that the other
       side is explicitly waiting on this decision. */
    row.append(button('CHICKEN OUT', {
      className: 'btn ghost',
      onClick: () => backOut('You backed out of that match.'),
    }));
  }

  /* THE WAY OUT OF A LOBBY THAT CANNOT START. Hidden until the wait is clearly
     no longer normal (see `checkStall`), because a leave button offered while
     the other player is simply reading the screen invites quitting a match that
     was about to begin. */
  const stall = document.createElement('div');
  stall.className = 'ar-fairness';
  stall.hidden = true;
  const stallRow = document.createElement('div');
  stallRow.className = 'ar-row';
  stallRow.hidden = true;
  stallRow.append(button('Back out', {
    className: 'btn ghost',
    onClick: () => backOut('You left that match — it never got started.'),
  }));

  panel.append(row, status, stall, stallRow);
  bodyEl.append(panel);

  /* Pressing does not skip the lobby — it records that this side is through
     it. The build starts when BOTH are, which is the whole point; letting one
     press rush the other would rebuild the asymmetry in the other direction. */
  function enterNow(auto) {
    if (gen !== readyGen || entered) return;
    entered = true;
    enteredAt = Date.now();
    /* ONLY THE GO BUTTON. CHICKEN OUT used to be disabled here along with it —
       `row.querySelectorAll('button')` took both — which turned every lobby
       that could not start into a screen with no controls at all: entered,
       counted down to 00:00, waiting on somebody who was never coming, and no
       way off it but reloading the page. Committing to the fight is not the
       same as forfeiting the right to leave it. */
    goBtn.disabled = true;
    goBtn.textContent = auto ? 'Entered' : (gate ? 'Continuing…' : 'Ready ✓');
    status.textContent = 'Waiting for them…';
    enterBuild(ui.room, side);
  }

  /* A LOBBY MUST BE ABLE TO FAIL, AND SAY SO. Entering is only half of what
     starts a build — the server stamps `buildStartAt` when BOTH sides are
     through — so this side can be perfectly correct, perfectly entered, and
     still waiting on a player who closed the tab, never came back to a
     backgrounded window, or is holding a code for a different room. The
     countdown has run out by then, the poll has nothing new to say, and what
     the player sees is a frozen 00:00 that never explains itself.

     Measured from the DEADLINE rather than from this side's own entry, because
     entering early is normal and expected: press CONTINUE at two seconds and
     the other side has eight more before their auto-enter fires. Only time
     after the lobby has closed for both of them means anything. */
  function checkStall(theirs) {
    /* They turned up after all — a phone unfreezing its tab is the ordinary
       case here, so the screen has to be able to go back to normal rather than
       leave a "they never entered" sitting above a match that is starting. */
    if (theirs && stalled) {
      stalled = false;
      stall.hidden = true;
      stallRow.hidden = true;
      status.textContent = 'Both in — starting…';
      return;
    }
    if (stalled || !entered || theirs) return;
    if (Date.now() < Math.max(enteredAt, gateDeadlineLocal()) + STALL_MS) return;
    stalled = true;
    status.textContent = 'Still waiting on them.';
    stall.innerHTML = `
      <p>This is taking longer than it should. Their window may be closed — or
         you may simply be on different networks, which can hold a match up for
         about a minute before it comes through.</p>
      <p><b>Leave this open and it will start on its own the moment they
         arrive.</b> Nothing is lost either way: this match has not begun and
         your collection is untouched.</p>`;
    stall.hidden = false;
    stallRow.hidden = false;
  }

  const tick = () => {
    if (gen !== readyGen) return;
    const remain = Math.max(0, gateDeadlineLocal() - Date.now());
    timerEl.textContent = `LOBBY — ${clockOf(remain)}`;
    timerEl.classList.toggle('is-low', remain <= 4000);
    /* Zero enters this side automatically rather than cancelling. An absent
       player must not be able to stall a match indefinitely (the same reason
       the build phase auto-locks), and the fair default when someone does not
       answer is the one that lets the fight happen. */
    if (remain <= 0) return enterNow(true);
    later(tick, 250);
  };
  tick();

  /* RE-ASSERT AN `enter` THE SERVER DOES NOT HAVE — the same repair
     `reassertLock` performs one phase later, for the identical reason. KV has
     no compare-and-set (functions/api/ready/[room].js), and the auto-enter at
     the bottom of `tick` means BOTH sides hit zero and POST `enter` at the
     same instant BY DESIGN — that is the whole point of an auto-enter, so
     neither player can stall the other. That makes the two writes landing
     together the expected case, not a rare one: read-modify-write on a shared
     key means the second write can silently omit the first side's flag, and
     `buildStartAt` — stamped only once both flags are true on the SAME read —
     then never gets set. Lose that race and this side is entered in its own
     browser, unentered on the server, and finished ticking: the exact "both
     players stuck on LOBBY — 00:00 forever" report this fixes.

     So the poll that already runs every 1.2s becomes the repair: if this side
     believes it has entered and the room disagrees, say it again. Idempotent —
     `enter` just sets a flag, so a duplicate is a no-op — and guarded by
     `reentering` so a slow round trip cannot stack requests. */
  let reentering = false;
  function reassertEnter(state) {
    const mineOnServer = side === 'a' ? state.enteredA : state.enteredB;
    if (!entered || mineOnServer || reentering) return;
    reentering = true;
    enterBuild(ui.room, side).then(fresh => {
      reentering = false;
      if (gen !== readyGen || !fresh.enabled) return;
      ui.roomState = fresh;
      if (fresh.buildStartAt) {
        adoptBuildWindow(fresh);
        beginSharedBuild();
      }
    }).catch(() => { reentering = false; });
  }

  function poll() {
    if (gen !== readyGen) return;
    checkRoom(ui.room).then(state => {
      if (gen !== readyGen) return;
      if (!state.enabled) {
        /* Settled off mid-lobby — the endpoint is gone, so nothing this screen
           is waiting for can ever arrive. Says so and offers the way out, for
           the same reason the stall does: the alternative is a countdown at
           00:00 that never explains itself. */
        if (presenceOff(state)) {
          stalled = true;
          status.textContent = 'The live lobby went away.';
          stall.innerHTML = '<p>The match room cannot be reached any more, so this battle cannot start.'
            + ' Nothing you own is affected. Quick battle needs no connection at all.</p>';
          stall.hidden = false;
          stallRow.hidden = false;
          return;
        }
        return nextPoll(POLL_MS);
      }
      ui.roomState = state;
      if (state.bailed && state.bailed !== side) {
        resetMatch();
        setPhase('mode');
        return note('They chickened out — that match is off.');
      }
      /* The server stamps this on the SECOND `enter`, so its appearance is
         the authoritative "both of you are through, start building now" for
         both windows at once. */
      if (state.buildStartAt) {
        adoptBuildWindow(state);
        return beginSharedBuild();
      }
      const theirs = side === 'a' ? state.enteredB : state.enteredA;
      if (entered && !stalled) status.textContent = theirs ? 'Both in — starting…' : 'Waiting for them…';
      else if (!entered && theirs) status.textContent = 'They are ready and waiting on you.';
      reassertEnter(state);
      checkStall(theirs);
      nextPoll(POLL_MS);
    });
  }
  const nextPoll = pollChain(gen, poll);
  poll();
}

/* Both sides are through the lobby. The shed runs HERE rather than at the
   moment CONTINUE was pressed, so the eligible pool is decided once, right
   before the builder that uses it — and never for a match somebody backed out
   of. */
function beginSharedBuild() {
  /* The verdict the lobby already showed and the player already agreed to —
     see `ui.gate`. `fairnessFor` is only re-run for the paths that reach here
     without a lobby screen having decided anything. */
  const gate = ui.gate ?? fairnessFor(ui.side);
  ui.eligiblePool = gate
    ? shedCollection(myChannels(), gate.cap, { rng: Math.random })
    : myChannels();
  renderSharedBuildScreen();
}

/* The shared 30-second window, both sides, no scouting. Structurally close to
   the old solo `renderBuild` — same slot rows, same pool grid, same formation
   readout — because the only real differences are the pool (possibly shed)
   and the fact that committing here means locking with the server rather
   than moving to a local next screen. */
function renderSharedBuildScreen() {
  bodyEl.replaceChildren();
  const gen = ++readyGen;
  const now = fightNow();
  const pool = ui.eligiblePool ?? myChannels();

  /* AN EMPTY TRAY, EVERY TIME, ON BOTH SIDES — Ash's call, and it matches what
     this phase is for. Both players are building blind against the same clock;
     opening with cards already in the slots meant one side started with a team
     and the other with nothing, which is the asymmetry the whole rework exists
     to remove. It was also frequently the WRONG team: `restoreLineup` reads the
     saved deck, so the tray came back holding the previous match's five, or
     cards the fairness shed had just made ineligible.

     Their saved deck is untouched — this only declines to LOAD it here. The
     solo builder still restores it, and the moment a card is placed here the
     usual `persistLineup` runs, so "the last deck from your previous match" is
     still what a player finds waiting in Quick battle. */
  ui.lineup = new Array(TEAM_SIZE).fill(null);
  ui.selectedSlot = 0;

  const intro = section('Team building — both of you, right now',
    'Nobody scouts the other first this time. Lock in when you are ready, or the timer locks you in on whatever you have.');
  const timerEl = document.createElement('div');
  timerEl.className = 'ar-timer';
  intro.append(timerEl);
  bodyEl.append(intro);

  if (ui.eligiblePool && ui.eligiblePool.length < myChannels().length) {
    const shedNote = section('Your temporary battle pool',
      `Trimmed to ${ui.eligiblePool.length} of your ${myChannels().length} cards for this battle only — the rest of your collection is untouched.`);
    bodyEl.append(shedNote);
  }

  const build = section('Your five',
    'Click a slot, then a card. <b>Front rank</b> takes every hit while it stands. <b>Back rank</b> is safe until it falls, and deals 15% less for the cover.');
  const ranks = slotRows(now);
  buildRefs.ranks = ranks;
  build.append(ranks);

  const row = document.createElement('div');
  row.className = 'ar-row';
  const go = button('Ready', { className: 'btn go', onClick: () => lockIn(gen) });
  buildRefs.go = go;
  row.append(
    go,
    button('Auto-pick', { className: 'btn ghost', onClick: () => { if (!ui.locked) autoPick(pool); } }),
    button('Clear', { className: 'btn ghost', onClick: () => { if (ui.locked) return; ui.lineup.fill(null); ui.selectedSlot = 0; persistLineup(); refreshTeam(); } }),
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

  const lockStatus = document.createElement('p');
  lockStatus.className = 'ar-lamp';
  lockStatus.id = 'ar-lockstatus';
  lockStatus.textContent = 'Building…';
  build.append(lockStatus);

  build.append(noteSlot());
  bodyEl.append(build);
  bodyEl.append(poolPanel(now, pool));

  /* THE COUNTDOWN. `buildDeadlineLocal()` is a fixed instant on THIS clock,
     already converted from the server's (see adoptBuildWindow), so this is a
     plain subtraction against a stationary target — which is precisely what
     the first version was not. Reaching zero without a lock auto-locks on
     whatever is currently placed (brief item 14).

     Re-read every tick rather than cached in a local, so a tab that was frozen
     and thawed picks up the real remaining time instead of resuming its old
     count — and if it thawed past the deadline it auto-locks immediately. */
  const tick = () => {
    if (gen !== readyGen) return;
    const remain = Math.max(0, buildDeadlineLocal() - Date.now());
    if (!ui.locked) {
      timerEl.textContent = `TEAM BUILDING — ${clockOf(remain)}`;
      timerEl.classList.toggle('is-low', remain <= 10000);
    }
    if (remain <= 0) {
      if (!ui.locked) lockIn(gen, true);
      return;
    }
    later(tick, 250);
  };
  tick();

  const isA = ui.side === 'a';
  function paintLockStatus(state) {
    if (gen !== readyGen) return;
    const theirsLocked = isA ? state?.lockedB : state?.lockedA;
    lockStatus.textContent = ui.locked
      ? (theirsLocked ? 'Both locked — starting…' : 'You are locked in. Waiting on them…')
      : (theirsLocked ? 'They are locked in. Still time to finish yours.' : 'Building…');
  }

  /* RE-ASSERT A LOCK THE SERVER DOES NOT HAVE, and this is not paranoia — it
     is the direct consequence of the countdown now working. The room is a KV
     read-modify-write with no compare-and-set (see functions/api/ready/[room].js),
     so two writes landing together can each omit the other's change. While the
     timer was broken nobody was ever auto-locked and simultaneous writes were
     a coin-flip nobody flipped; now BOTH sides hit zero at the same instant by
     design, which makes that collision the expected case rather than the rare
     one. Lose the race and one side is locked in its own browser, unlocked on
     the server, and finished ticking — a lobby that waits forever.

     So the poll that already runs every 1.2s becomes the repair: if this side
     believes it is locked and the room disagrees, say it again. Idempotent —
     `lock` sets a flag and stores a team, so a duplicate is a no-op — and
     guarded by `relocking` so a slow round trip cannot stack requests. */
  let relocking = false;
  function reassertLock(state) {
    const mineOnServer = isA ? state.lockedA : state.lockedB;
    if (!ui.locked || mineOnServer || relocking) return;
    relocking = true;
    lockTeam(ui.room, ui.side, filled()).then(fresh => {
      relocking = false;
      if (gen !== readyGen || !fresh.enabled) return;
      ui.roomState = fresh;
      if (fresh.lockedA && fresh.lockedB) renderLockedFaceoff(fresh);
    }).catch(() => { relocking = false; });
  }

  function poll() {
    if (gen !== readyGen) return;
    checkRoom(ui.room).then(state => {
      if (gen !== readyGen) return;
      if (!state.enabled) {
        /* Settled off mid-build. Nothing left to poll for — the other side's
           lock can never arrive — so this says so and offers the way back,
           rather than leaving a locked player on "waiting on them" forever.
           The lobby's stall screen exists for the same reason one phase
           earlier: every screen that waits has to be able to stop waiting. */
        if (presenceOff(state)) {
          lockStatus.textContent = 'The match room cannot be reached any more, so this battle cannot finish.';
          build.append(button('Back', {
            className: 'btn ghost',
            onClick: () => { resetMatch(); setPhase('mode'); },
          }));
          return;
        }
        return nextPoll(POLL_MS);
      }
      ui.roomState = state;
      paintLockStatus(state);
      if (state.lockedA && state.lockedB) return renderLockedFaceoff(state);
      reassertLock(state);
      nextPoll(POLL_MS);
    });
  }
  const nextPoll = pollChain(gen, poll);
  poll();
}

/* Lock the current line-up in, auto-filling any empty slots first (`auto`
   distinguishes a timer-forced lock for a note the player never asked to
   see, though the mechanism is identical either way — brief item 14 says
   this must not feel like a failure state). */
async function lockIn(gen, auto = false) {
  if (gen !== readyGen || ui.locked) return;
  const now = fightNow();
  const pool = ui.eligiblePool ?? myChannels();
  if (!isComplete()) {
    ui.lineup = arrangeFormation(bestTeamFrom(pool, { now }), now);
    while (ui.lineup.length < TEAM_SIZE) ui.lineup.push(null);
    persistLineup();
  }
  if (!isComplete()) {
    return note('Not enough distinct cards to field a full team.', true);
  }
  ui.locked = true;
  refreshTeam();
  if (buildRefs.go) { buildRefs.go.disabled = true; buildRefs.go.textContent = 'Ready ✓'; }
  if (auto) note('Time was up — locked in on your current picks.');

  const team = filled();
  let state = await lockTeam(ui.room, ui.side, team);
  if (!state.enabled && !presenceOff(state)) state = await lockTeam(ui.room, ui.side, team);
  if (gen !== readyGen) return;
  if (!state.enabled) {
    ui.locked = false;
    if (buildRefs.go) { buildRefs.go.disabled = false; buildRefs.go.textContent = 'Ready'; }
    return note('Could not reach the match room — try again.', true);
  }
  ui.roomState = state;
  const status = $('ar-lockstatus');
  const isA = ui.side === 'a';
  const theirsLocked = isA ? state.lockedB : state.lockedA;
  if (status) status.textContent = theirsLocked ? 'Both locked — starting…' : 'You are locked in. Waiting on them…';
  if (state.lockedA && state.lockedB) renderLockedFaceoff(state);
}

/* Both sides have locked. A short face-off beat — same countdown mechanism
   as the manual ready screen — then the fight, reading both teams straight
   off the server's own record of them rather than local state, so there is
   no way for the two windows to disagree about what was actually locked. */
function renderLockedFaceoff(state) {
  bodyEl.replaceChildren();
  const gen = ++readyGen;
  const isA = ui.side === 'a';
  const now = ui.challenge?.now ?? ui.sentNow ?? Date.now();
  const seed = isA ? ui.sentSeed : ui.challenge?.seed;
  const mineTeam = isA ? state.teamA : state.teamB;
  const theirTeam = isA ? state.teamB : state.teamA;
  const theirName = isA ? '' : (ui.challenge?.name ?? '');

  ui.pendingFight = { teamA: state.teamA, teamB: state.teamB, seed, now, youAre: ui.side, them: theirName };

  const panel = section('Both locked in', 'Here we go — you are both watching the same fight.');
  const face = document.createElement('div');
  face.className = 'ar-faceoff';
  face.innerHTML =
    `<span><b>Your five</b><i>rating ${teamPower(makeTeam(mineTeam, now))}</i></span>` +
    '<em>vs</em>' +
    `<span><b>${escapeHtml(theirName || 'Their five')}</b><i>rating ${teamPower(makeTeam(theirTeam, now))}</i></span>`;
  panel.append(face);

  const lamp = document.createElement('p');
  lamp.className = 'ar-lamp';
  panel.append(lamp);

  const count = document.createElement('div');
  count.className = 'ar-countdown';
  count.hidden = true;
  panel.append(count);

  const go = document.createElement('button');
  go.hidden = true;   // never shown — runCountdown only mutates it
  panel.append(go);

  bodyEl.append(panel);

  const view = { gen, go, anyway: { hidden: true }, lamp, count };
  const elapsed = Math.max(0, (state.now || Date.now()) - state.bothAt);
  runCountdown(view, Math.max(0, (state.countdownMs ?? COUNTDOWN_MS) - elapsed));
}

/* ── THE SHARED DEADLINE, AS ONE FIXED LOCAL TIMESTAMP ─────────────────────
   The server owns the deadline in ITS clock: `buildStartAt + buildMs`. Each
   browser converts that to its own clock exactly once, by measuring how far
   its clock sits from the server's at the moment it reads a room:

       skew    = Date.now() - state.now          (this clock minus server's)
       deadline = buildStartAt + buildMs + skew   (…in THIS clock)

   Both sides start from the same two server numbers and apply their own skew,
   so both land on the same real instant however wrong either device's clock
   is. That is the whole of the sync.

   WHY IT IS RESOLVED ONCE AND THEN LEFT ALONE. The first version of this
   recomputed the deadline on every tick as `Date.now() + remainingAtFetch`,
   which looks equivalent and is not: `remainingAtFetch` is frozen at fetch
   time while `Date.now()` advances, so the deadline advanced in lockstep with
   the clock and the gap between them never closed. The countdown froze at
   whatever it first rendered, `remain <= 0` never became true so nobody was
   ever auto-locked, and because each side captured its snapshot at a
   different moment (the defender the instant it accepted, the challenger
   whenever its poll next noticed) the two screens froze on DIFFERENT numbers
   — one bug wearing all three symptoms.

   Set once rather than refreshed per poll on purpose: re-deriving skew every
   time would fold that request's latency into the deadline and make it jitter
   by a tenth of a second in both directions for no gain, since the server's
   own numbers never move. */
const BUILD_MS_FALLBACK = 30000;

/* `mm:ss`, matching the brief's own `00:30` mockup. Written as real minutes
   rather than hardcoding the `00:` because the window is a server constant
   this client does not control — if it is ever raised past a minute, a
   hardcoded prefix would quietly start printing 00:75. */
function clockOf(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const mins = Math.floor(total / 60);
  return `${String(mins).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function adoptBuildWindow(state) {
  if (ui.buildDeadline) return;                       // already fixed for this match
  if (!Number.isFinite(state?.buildStartAt)) return;  // room has not stamped one yet
  const span = Number.isFinite(state.buildMs) ? state.buildMs : BUILD_MS_FALLBACK;
  const skew = Number.isFinite(state.now) ? Date.now() - state.now : 0;
  ui.buildDeadline = state.buildStartAt + span + skew;
}

/* The lobby's deadline, converted the same way off `lobbyAt` — the stamp the
   server writes when the challenge is accepted. Two stamps rather than one
   because the two phases genuinely begin at different moments: the lobby when
   somebody accepts, the build only once both sides are through it. */
const GATE_MS_FALLBACK = 10000;

/* A FLOOR UNDER THE LOBBY, for the side that arrives late (2026-08-16).
   `lobbyAt` is a shared clock, and sharing it is the whole point — but a side
   can now legitimately reach this screen well after the stamp, because a
   cross-network room read can be up to a minute stale (see CROSS_NETWORK_MS).
   Without a floor that side opens the lobby already at 00:00, is auto-entered
   on the spot, and never gets to read the COLLECTION SIZE gate it was the one
   being asked about. Six seconds is not the fair ten, but it is a decision
   rather than a flash. */
const MIN_GATE_MS = 6000;

function adoptGateWindow(state) {
  if (ui.gateDeadline) return;
  if (!Number.isFinite(state?.lobbyAt)) return;
  const span = Number.isFinite(state.gateMs) ? state.gateMs : GATE_MS_FALLBACK;
  const skew = Number.isFinite(state.now) ? Date.now() - state.now : 0;
  ui.gateDeadline = Math.max(state.lobbyAt + span + skew, Date.now() + MIN_GATE_MS);
}

function gateDeadlineLocal() {
  if (!ui.gateDeadline) ui.gateDeadline = Date.now() + GATE_MS_FALLBACK;
  return ui.gateDeadline;
}

function buildDeadlineLocal() {
  /* A build phase that somehow began without a server stamp still has to end,
     so it gets a full window measured from right now rather than an immediate
     auto-lock. Latched so it cannot slide forward on the next call. */
  if (!ui.buildDeadline) ui.buildDeadline = Date.now() + BUILD_MS_FALLBACK;
  return ui.buildDeadline;
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

/* How long past the lobby's own deadline a side waits before the screen says
   something is wrong (`checkStall`).

   RAISED 12s -> 75s ON 2026-08-16, and the number is not a guess: it is longer
   than the worst honest lag the room can produce. Workers KV serves each
   Cloudflare edge location its own cached view of a key, with a MINIMUM TTL of
   60 seconds that cannot be lowered — so two players on different networks
   (a phone on mobile data, a PC on WiFi) hit different locations and one of
   them can read a minute-old room. Measured as a real failure: the challenger's
   waiting screen kept reading "nobody has accepted" long after the defender had.

   At 12s this screen called that a dead match and offered the way out, ~48
   seconds before the match would have started ON ITS OWN. Telling a player to
   quit something that is merely slow is worse than making them wait, so the
   patience now outlasts the staleness. Two windows on one machine share an edge
   location and never see any of this, which is exactly why it survived testing. */
const STALL_MS = 75000;

/* How long a cross-network room can lag, for copy that has to explain a wait
   without lying about it. Same 60s KV figure, rounded up for the round trip. */
const CROSS_NETWORK_MS = 65000;

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

/* The challenger's screen after sending: the code to hand over, and a watch on
   the match room for somebody taking it up.

   THERE IS NO MANUAL ROUTE OUT OF THIS SCREEN ANY MORE, and that is a real
   trade rather than an oversight. A challenge now always travels without a
   team, so there is nothing in the code for a defender to build against and
   reply to by hand — the paste box that used to sit here served the pre-built
   challenges this client no longer sends. If the lobby is unreachable the
   honest answer is to say so and offer the way back, which is what the poll
   loop below does. The sub-choice screen probes for a lobby before offering
   the button at all, so reaching this state usually means the room died
   mid-wait rather than never existing. */
function renderChallengeOut(code) {
  bodyEl.replaceChildren();
  const gen = ++readyGen;
  const { panel } = codeBox(code, {
    label: 'Send them this code',
    hint: 'Paste it into the other window (or send it to a friend). You will both build your teams together the moment they accept.',
  });

  const waiting = document.createElement('p');
  waiting.className = 'ar-lamp';
  waiting.textContent = 'Waiting for someone to accept…';
  panel.append(waiting);

  /* THE SLOW-NETWORK NOTE, and it exists because this screen was the one that
     looked broken. The challenger reads the match room to learn it was
     accepted, and across two networks that read can be up to a minute stale
     (see CROSS_NETWORK_MS) — so the defender can be sitting in the lobby while
     this screen still says nobody has taken it up. Nothing is wrong and there
     is nothing to press; the only thing missing was anybody saying so.

     Held back until the wait is already unusual, so a challenge accepted in
     three seconds never shows it. */
  const patience = document.createElement('p');
  patience.className = 'ar-fairness';
  patience.hidden = true;
  patience.innerHTML = `
    <p>If they have already accepted on a different network — their phone on
       mobile data, say — it can take up to a minute to reach this screen.
       Leave it open; it moves on by itself.</p>`;
  panel.append(patience);
  later(() => { if (gen === readyGen) patience.hidden = false; }, 15000);

  bodyEl.append(panel);

  /* Poll for the acceptance. The green flash is held for a beat before the
     shared build phase replaces the screen — a signal that vanishes in the
     same frame it appears is a signal nobody sees, and "someone accepted
     your challenge" is the one moment in this flow worth landing. */
  const poll = () => {
    if (gen !== readyGen) return;
    checkRoom(ui.room).then(st => {
      if (gen !== readyGen) return;
      if (!st.enabled) {
        /* Settled: no namespace, no lobby today. */
        if (presenceOff(st)) {
          /* Nothing to fall back TO. A challenge carries no team, so there is
             nothing in this code for a defender to build against and answer
             by hand — the paste-a-reply box that used to live here served the
             pre-built challenges this client stopped sending. Say so and offer
             the only honest way on: a Quick battle, which needs no server at
             all. Reachable at all only since a 404 stopped being treated as a
             retryable error (see data/presence.js) — before that this loop
             retried forever and the player sat on "waiting for someone to
             accept" with no way to learn the lobby was never coming. */
          waiting.textContent = 'The live lobby cannot be reached, so this challenge cannot be picked up. Cross-device battles need it; Quick battle does not.';
          panel.append(button('Back', {
            className: 'btn ghost',
            onClick: () => { resetMatch(); setPhase('mode'); },
          }));
          return;
        }
        /* A dropped request — almost always this tab having been frozen while
           its owner was in a chat app sending the code. It says nothing about
           whether anyone accepted, so keep waiting rather than declaring the
           lobby dead. This loop giving up here is precisely what made
           challenging from a phone impossible. */
        return nextPoll(POLL_MS);
      }
      ui.roomState = st;
      if (st.accepted) {
        /* `lobbyAt` can lag `accepted` by one write on KV's eventual
           consistency — keep polling rather than opening the lobby with no
           server-anchored deadline to count down from. */
        if (!st.lobbyAt) return nextPoll(POLL_MS);
        waiting.className = 'ar-lamp is-ready';
        waiting.textContent = '✔ Challenge accepted — opening the lobby…';
        adoptGateWindow(st);
        return later(() => { if (gen === readyGen) enterSharedBuild('a'); }, 900);
      }
      nextPoll(POLL_MS);
    });
  };
  const nextPoll = pollChain(gen, poll);
  poll();
}

/* `onReply` — the challenger loading a defender's hand-pasted reply — lived
   here until 2026-08-15. It could only ever answer a challenge that carried a
   committed team, and this client no longer sends one, so it went with the
   paste box that called it. `armFight`/`renderReady` survive because the
   DEFENDER's manual path still uses them for a legacy team-carrying code. */

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

  /* ONE WAY OUT OF A FINISHED FIGHT, and the removal is the fix rather than a
     simplification for its own sake. "Rebuild and fight again" dropped the
     player back into the BUILDER with the whole finished match still loaded —
     same room id, same seed, same side, a lobby the server had already seen
     both locks for. Committing from there re-entered a dead match: the other
     player was never coming back to it, and the timing state it carried was
     the very thing that opened the next countdown at 00:00. It was a shortcut
     that skipped the only place a new match can legitimately begin.

     New opponent goes through mode-select, which runs `resetMatch` on the way
     in, so every fight after the first starts from the same clean state the
     first one did. Rebuilding a team is a couple of clicks from there, and the
     saved deck is still waiting — so nothing is actually lost. */
  row.append(
    button('New opponent', { className: 'btn primary', onClick: () => { resetMatch(); setPhase('mode'); } }),
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

function restoreLineup(pool = myChannels()) {
  const byId = new Map(pool.map(c => [c.id, c]));
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
  /* The same reset every new match runs, rather than a second hand-maintained
     copy of the field list. Keeping two was how `buildDeadline` came to be
     cleared here and nowhere else — opening the arena worked, starting a
     second match inside it did not. */
  resetMatch();
  ui.mode = null;
  ui.stage = null;
  restoreLineup();
  arenaEl.hidden = false;
  /* Built on first open rather than at module load: it is a few hundred nodes
     that a player who never presses Battle should not pay for. `mountCodex`
     no-ops on every open after the first, so opened sections stay opened. */
  mountCodex(codexEl);
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
