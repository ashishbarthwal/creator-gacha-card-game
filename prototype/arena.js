/* prototype/arena — the playable loop.

   Wiring only, in the spirit of src/main.js: every rule it enforces comes from
   src/engine/, and nothing here decides anything about the game. If a number
   looks wrong on this page, it is wrong in the engine.

   ── THE LOOP, AND WHY IT IS IN THIS ORDER ─────────────────────────────────
   Both sides open five packs; the AI commits its five FIRST and shows them;
   only then does the player build. That ordering is the whole reason the
   element wheel is worth having — countering an opponent you cannot see is
   just picking your best five again, and a fight decided before you choose is
   not a decision. It also costs the matchmaker its usual input, which is why
   opponent.js matches against the CEILING of the player's draft rather than
   against a team that does not exist yet. */

import { toCard } from '../src/engine/core.js';
import { pull } from '../src/engine/gacha.js';
import { TEAM_SIZE, FRONT_SLOTS, battle, makeTeam, teamPower, matchupPreview } from '../src/engine/battle.js';
import { draftOpponent, arrangeFormation, bestTeamFrom } from '../src/engine/opponent.js';
import { ELEMENT_CYCLE, ELEMENT_LORE } from '../src/engine/element.js';
import { buildPrototypeDeck } from './deck.js';
import { renderBattleCard, armHealthBar, setHealth, ELEMENT_STYLE } from './battle-card.js';

const PACKS = 5;
const PACK_SIZE = 10;
const DRAFT_SIZE = PACKS * PACK_SIZE;

const $ = id => document.getElementById(id);
const NOW = Date.now();

const state = {
  seed: Number(new URLSearchParams(location.search).get('seed')) || (Date.now() % 100000),
  deck: [],
  myDraft: [],
  enemy: [],
  lineup: new Array(TEAM_SIZE).fill(null),
  selectedSlot: 0,
  preview: new Map(),
  timers: [],
};

/* ── phases ─────────────────────────────────────────────────────────────── */
const PHASES = ['draft', 'scout', 'build', 'battle'];
function setPhase(name) {
  const at = PHASES.indexOf(name);
  for (const [i, phase] of PHASES.entries()) {
    const panel = $(`p-${phase}`);
    if (panel) panel.hidden = i > at;
    const step = document.querySelector(`#steps li[data-step="${phase}"]`);
    step.classList.toggle('done', i < at);
    if (i === at) step.setAttribute('aria-current', 'step');
    else step.removeAttribute('aria-current');
  }
  $(`p-${name}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── deck + draft ───────────────────────────────────────────────────────── */
function newDeck() {
  state.deck = buildPrototypeDeck(state.seed);
  state.myDraft = [];
  state.enemy = [];
  state.lineup = new Array(TEAM_SIZE).fill(null);
  $('draft').replaceChildren();
  $('draft-readout').textContent = `deck seed ${state.seed} · ${state.deck.length} cards`;
  $('btn-open').disabled = false;
  clearTimers();
  setPhase('draft');
}

/* A draft is five x10 pulls through the real gacha, so the band mix a player
   sees here is the band mix the game actually gives them — including the
   perfectly ordinary outcome of opening five packs and getting no UR. */
function draftFor() {
  const cards = state.deck.map(toCard);
  const out = [];
  for (let p = 0; p < PACKS; p++) out.push(...pull(cards, PACK_SIZE).map(c => c.channel));
  return out;
}

function openPacks() {
  $('btn-open').disabled = true;
  state.myDraft = draftFor();
  /* The AI draws from the same deck, in its own five packs. Not the same
     cards, and not excluded from them either: an overlap is the gacha
     genuinely giving both sides a creator, which is honest, where hiding it
     would suggest the AI is drawing from somewhere else. */
  const aiDraft = draftFor();

  const grid = $('draft');
  grid.replaceChildren();
  state.myDraft.forEach((channel, i) => {
    const btn = document.createElement('button');
    btn.className = 'pick dealt';
    btn.style.animationDelay = `${Math.min(i, 30) * 22}ms`;
    btn.type = 'button';
    btn.setAttribute('aria-pressed', 'false');
    btn.dataset.index = String(i);
    btn.append(renderBattleCard(channel, { now: NOW }));
    btn.addEventListener('click', () => onPick(i));
    grid.append(btn);
  });

  const bands = {};
  for (const ch of state.myDraft) {
    const r = toCard(ch).rarity;
    bands[r] = (bands[r] ?? 0) + 1;
  }
  $('draft-readout').textContent =
    `${DRAFT_SIZE} cards · ` + ['N', 'R', 'SR', 'SSR', 'UR'].filter(r => bands[r]).map(r => `${r} ${bands[r]}`).join(' · ');

  const match = draftOpponent(state.myDraft, aiDraft, { now: NOW });
  state.enemy = match.channels;
  renderEnemy();
  renderWheel();
  renderMyRanks();
  setPhase('build');
  /* Both later panels are open at once on purpose: the enemy line-up has to
     stay on screen while you build against it. Scrolling away to remember what
     you were countering would defeat the ordering the whole loop is built on. */
  $('p-scout').hidden = false;
}

/* ── scouting ───────────────────────────────────────────────────────────── */
function renderEnemy() {
  const ranks = $('enemy-ranks');
  ranks.replaceChildren(
    rankRow('Back rank — reachable only once the front falls', state.enemy.slice(FRONT_SLOTS), FRONT_SLOTS),
    rankRow('Front rank — takes every hit', state.enemy.slice(0, FRONT_SLOTS), 0),
  );
  /* Their elements decide what counters what, so the preview is computed once
     here and read by every card the player looks at. */
  state.preview = new Map(matchupPreview(state.myDraft, state.enemy, NOW).map(m => [m.id, m]));
}

function rankRow(label, channels, slotOffset) {
  const wrap = document.createElement('div');
  wrap.className = 'rank';
  const head = document.createElement('div');
  head.className = 'rank-label';
  head.textContent = label;
  const cards = document.createElement('div');
  cards.className = 'rank-cards';
  channels.forEach((ch, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot filled';
    slot.append(renderBattleCard(ch, { now: NOW, slot: slotOffset + i }));
    cards.append(slot);
  });
  wrap.append(head, cards);
  return wrap;
}

function renderWheel() {
  $('wheel').replaceChildren(...ELEMENT_CYCLE.map(element => {
    const li = document.createElement('li');
    li.style.setProperty('--el', ELEMENT_STYLE[element].hue);
    li.innerHTML = `<i>${ELEMENT_STYLE[element].glyph}</i>${element} <span>beats ${ELEMENT_LORE[element].beats} — ${ELEMENT_LORE[element].why}</span>`;
    return li;
  }));
}

/* ── building ───────────────────────────────────────────────────────────── */
function renderMyRanks() {
  const ranks = $('my-ranks');
  ranks.replaceChildren(
    slotRow(`Front rank — ${FRONT_SLOTS} slots`, 0, FRONT_SLOTS),
    slotRow(`Back rank — ${TEAM_SIZE - FRONT_SLOTS} slots, 15% less damage dealt`, FRONT_SLOTS, TEAM_SIZE),
  );
  refreshDraftMarks();
  refreshPower();
}

function slotRow(label, from, to) {
  const wrap = document.createElement('div');
  wrap.className = 'rank';
  const head = document.createElement('div');
  head.className = 'rank-label';
  head.textContent = label;
  const cards = document.createElement('div');
  cards.className = 'rank-cards';
  for (let slot = from; slot < to; slot++) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'slot';
    el.dataset.slot = String(slot);
    const channel = state.lineup[slot];
    if (channel) {
      el.classList.add('filled');
      el.append(renderBattleCard(channel, { now: NOW, slot, matchup: state.preview.get(channel.id) }));
    } else {
      el.textContent = `slot ${slot + 1}`;
    }
    if (slot === state.selectedSlot) el.classList.add('is-target');
    el.addEventListener('click', () => onSlot(slot));
    cards.append(el);
  }
  wrap.append(head, cards);
  return wrap;
}

function onSlot(slot) {
  /* A filled slot empties; an empty one becomes the target for the next card
     clicked. Two gestures, no dragging — the same interaction has to work on a
     phone, and a drag that fails silently is worse than a click that does not. */
  if (state.lineup[slot]) state.lineup[slot] = null;
  state.selectedSlot = slot;
  renderMyRanks();
}

function onPick(index) {
  const channel = state.myDraft[index];
  const already = state.lineup.findIndex(c => c && c.id === channel.id);
  if (already !== -1) { state.lineup[already] = null; renderMyRanks(); return; }

  let slot = state.selectedSlot;
  if (state.lineup[slot]) slot = state.lineup.findIndex(c => !c);
  if (slot === -1) return;                       // full: clear a slot first
  state.lineup[slot] = channel;
  const next = state.lineup.findIndex(c => !c);
  state.selectedSlot = next === -1 ? slot : next;
  renderMyRanks();
}

function refreshDraftMarks() {
  const fielded = new Set(state.lineup.filter(Boolean).map(c => c.id));
  for (const btn of $('draft').children) {
    const channel = state.myDraft[Number(btn.dataset.index)];
    const on = fielded.has(channel.id);
    btn.classList.toggle('is-fielded', on);
    btn.setAttribute('aria-pressed', String(on));
  }
}

function refreshPower() {
  const filled = state.lineup.filter(Boolean);
  const mine = teamPower(makeTeam(filled, NOW));
  const theirs = teamPower(makeTeam(state.enemy, NOW));
  $('btn-fight').disabled = filled.length < TEAM_SIZE;
  const gap = mine && theirs ? Math.round((mine / theirs - 1) * 100) : 0;
  $('power-readout').innerHTML = filled.length
    ? `your rating <b>${mine}</b> · theirs <b>${theirs}</b> · ${gap >= 0 ? '+' : ''}${gap}%`
    : 'pick five';
}

/* Fills the line-up with the strongest legal team and arranges it, so a player
   can see a sensible baseline and then argue with it. Deliberately NOT
   matchup-aware: it is the "what would raw power do" button, and beating it by
   countering elements is the point the prototype is trying to make. */
function autoPick() {
  state.lineup = arrangeFormation(bestTeamFrom(state.myDraft, { now: NOW }), NOW);
  while (state.lineup.length < TEAM_SIZE) state.lineup.push(null);
  state.selectedSlot = 0;
  renderMyRanks();
}

/* ── the fight ──────────────────────────────────────────────────────────── */
const clearTimers = () => { state.timers.forEach(clearTimeout); state.timers = []; };
const later = (fn, ms) => state.timers.push(setTimeout(fn, ms));

const cardIndex = new Map();   // `${side}:${slot}` -> card element

function renderArena() {
  cardIndex.clear();
  for (const [side, channels, host] of [['b', state.enemy, $('arena-enemy')], ['a', state.lineup, $('arena-mine')]]) {
    const team = makeTeam(channels, NOW);
    const front = document.createElement('div');
    front.className = 'line front';
    const back = document.createElement('div');
    back.className = 'line back';
    channels.forEach((ch, slot) => {
      const card = renderBattleCard(ch, { now: NOW, slot });
      armHealthBar(card, team[slot].maxHp);
      cardIndex.set(`${side}:${slot}`, card);
      (slot < FRONT_SLOTS ? front : back).append(card);
    });
    const head = document.createElement('div');
    head.className = 'side-head';
    head.innerHTML = `<b>${side === 'a' ? 'Your five' : 'Opposition'}</b> rating ${teamPower(team)}`;
    /* The two sides FACE each other: the enemy's front rank is the row nearest
       the middle, and so is yours. Plain DOM order does it — no grid areas, so
       the row that is "nearest the middle" cannot drift away from the row the
       engine treats as front. */
    host.replaceChildren(head, ...(side === 'a' ? [front, back] : [back, front]));
  }
}

function startFight() {
  clearTimers();
  setPhase('battle');
  renderArena();
  $('log').replaceChildren();
  $('verdict').hidden = true;
  $('btn-again').hidden = true;
  $('btn-fresh').hidden = true;
  $('btn-skip').hidden = false;
  $('battle-hint').textContent = 'Auto-resolved. The fight was decided the moment you pressed Fight — this is the replay.';

  /* SEEDED ON THE TWO LINE-UPS, so the same five against the same five always
     produce the same fight. That is not a convenience, it is the design claim
     made checkable: a player who loses, changes nothing and presses Fight again
     gets the same defeat, and a player who swaps one card gets a different
     result they can attribute to the swap. With Math.random the rematch button
     would quietly become a re-roll, which is exactly the "decided by dice"
     reading the whole auto-battler design rejects. */
  const result = battle(state.lineup, state.enemy, {
    now: NOW,
    rng: mulberry32(seedOf([...state.lineup, ...state.enemy])),
  });
  playLog(result);
}

function seedOf(channels) {
  let h = 2166136261;
  for (const ch of channels) {
    for (const c of String(ch?.id ?? '')) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STEP_MS = 380;

function playLog(result) {
  let at = 0;
  const events = result.log;

  const step = () => {
    if (at >= events.length) return;
    const event = events[at++];
    applyEvent(event, result);
    later(step, event.type === 'attack' ? STEP_MS : STEP_MS * 0.6);
  };
  $('speed-readout').textContent = `${events.filter(e => e.type === 'attack').length} attacks over ${result.rounds} rounds`;
  step();

  $('btn-skip').onclick = () => {
    clearTimers();
    while (at < events.length) applyEvent(events[at++], result);
  };
}

function applyEvent(event, result) {
  if (event.type === 'round') {
    $('round-label').textContent = `Round ${event.round}`;
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
  addLog(logLine(event), event.side);
}

function popDamage(cardEl, event) {
  const pop = document.createElement('span');
  pop.className = `pop ${event.crit ? 'crit' : ''} ${event.matchup === 'strong' ? 'strong' : event.matchup === 'weak' ? 'weak' : ''}`.trim();
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
  if (tags.length) bits.push(`<span class="tag">${tags.join(' · ')}</span>`);
  if (event.defeated) bits.push('<span class="dead">DOWN</span>');
  return bits.join(' — ');
}

function finish(event, result) {
  const box = $('verdict');
  const won = event.winner === 'a';
  box.className = `verdict ${event.winner === 'draw' ? 'draw' : won ? 'win' : 'loss'}`;
  box.innerHTML = `${event.winner === 'draw' ? 'Draw' : won ? 'Victory' : 'Defeat'}
    <small>${result.rounds} rounds · ${result.survivors.a} of yours standing, ${result.survivors.b} of theirs</small>`;
  box.hidden = false;
  $('btn-skip').hidden = true;
  $('btn-again').hidden = false;
  $('btn-fresh').hidden = false;
  $('battle-hint').textContent =
    'Fight again with the same five and you get this same result — swap one card and see what changes.';
}

function addLog(html, cls = '') {
  const p = document.createElement('p');
  if (cls) p.className = cls;
  p.innerHTML = html;
  const log = $('log');
  log.append(p);
  log.scrollTop = log.scrollHeight;
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);

/* ── wiring ─────────────────────────────────────────────────────────────── */
$('btn-open').addEventListener('click', openPacks);
$('btn-reseed').addEventListener('click', () => { state.seed = Math.floor(Math.random() * 100000); newDeck(); });
$('btn-fight').addEventListener('click', startFight);
$('btn-auto').addEventListener('click', autoPick);
$('btn-clear').addEventListener('click', () => { state.lineup.fill(null); state.selectedSlot = 0; renderMyRanks(); });
$('btn-again').addEventListener('click', () => { clearTimers(); setPhase('build'); $('p-scout').hidden = false; });
$('btn-fresh').addEventListener('click', () => { state.seed = Math.floor(Math.random() * 100000); newDeck(); });

newDeck();
