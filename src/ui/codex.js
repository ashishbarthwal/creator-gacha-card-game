/* ui/codex — the combat reference that rides alongside the arena.

   ── WHY THIS IS BUILT FROM ENGINE DATA, NOT WRITTEN OUT ────────────────────
   `Battle Layout/battle-system.html` already explains this game, and it carries
   a warning that is the whole reason this file exists: "Every number in it is
   measured — regenerate them rather than editing figures by hand, or it becomes
   the thing this repo most dislikes, a confident document that disagrees with
   its own code."

   That document is a build-time artefact nobody playing the game will ever
   open. Ash asked for the same explanation IN the arena, which means shipping a
   second copy of it — and a second copy is exactly how the disagreement starts.

   So nothing here restates a number. Class verbs come from `CLASS_ABILITY`, the
   element ring from `ELEMENT_CYCLE` and `ELEMENT_LORE`, every multiplier from
   `BATTLE_TUNING` and the constants beside it. Retune the engine and this panel
   retunes with it, in the same breath, because it is reading the same values
   the fight reads. The only prose typed here is prose about MEANING — what a
   stat is for, how to think about a matchup — which is the part that has no
   number to drift from.

   ── AND WHY IT IS A RAIL RATHER THAN A SCREEN ──────────────────────────────
   Sitting beside the builder is the point: a rule you read while choosing is a
   rule you can act on, and one you read on a separate help page is one you have
   already forgotten by the time it matters. It is a sibling of #ar-body rather
   than a child, so the phase renderers' `replaceChildren` cannot wipe it and it
   persists from mode select through the fight without being rebuilt.

   Below 1100px it moves BELOW the flow and every section starts closed, since a
   phone showing a wall of reference before the Fight button has buried the game
   under its own manual. */

import { CLASS_ABILITY, BATTLE_TUNING, FORMATION_BONUS, TEAM_SIZE, FRONT_SLOTS } from '../engine/battle.js';
import {
  ELEMENT_CYCLE, ELEMENT_LORE, ELEMENT_ADVANTAGE, ELEMENT_DISADVANTAGE, UNALIGNED,
} from '../engine/element.js';
import {
  MITIGATION_K, CRIT_MULTIPLIER, MOMENTUM_CAP, ADAPTIVE_BONUS, BATTLE_CLASSES,
} from '../engine/battle-stats.js';
import { escapeHtml } from './util.js';

/* Percentages the way a player reads them: 1.25 -> "+25%", 0.8 -> "-20%". */
const asPct = mult => `${mult >= 1 ? '+' : '−'}${Math.round(Math.abs(mult - 1) * 100)}%`;

function block(title, summaryHtml, openByDefault = false) {
  const el = document.createElement('details');
  el.className = 'cx-block';
  el.open = openByDefault;
  const sum = document.createElement('summary');
  sum.innerHTML = `<span>${escapeHtml(title)}</span>`;
  el.append(sum);
  if (summaryHtml) {
    const p = document.createElement('p');
    p.className = 'cx-lede';
    p.innerHTML = summaryHtml;
    el.append(p);
  }
  return el;
}

function rows(pairs, className = 'cx-rows') {
  const dl = document.createElement('dl');
  dl.className = className;
  for (const [term, desc] of pairs) {
    const dt = document.createElement('dt');
    dt.innerHTML = term;
    const dd = document.createElement('dd');
    dd.innerHTML = desc;
    dl.append(dt, dd);
  }
  return dl;
}

/* ── how a fight runs ─────────────────────────────────────────────────────── */
function howBlock(open = false) {
  const el = block('How a fight is decided',
    `Both sides field ${TEAM_SIZE}. Nobody takes a turn by hand — you commit a team and watch it resolve, `
    + 'so every decision you get to make happens <em>before</em> the first swing.', open);
  el.append(rows([
    ['Rounds', `Everyone alive acts once per round, fastest first. A fight runs about six rounds and is
      hard-capped at ${BATTLE_TUNING.MAX_ROUNDS}; if it somehow ran that long, whoever has more health left wins.`],
    ['Ranks', `Slots 1–${FRONT_SLOTS} are the <b>front</b>, ${FRONT_SLOTS + 1}–${TEAM_SIZE} the <b>back</b>.
      The back cannot be touched while any of the front still stands — but attacking out of it costs
      ${asPct(BATTLE_TUNING.BACK_RANK_ATTACK)} attack. Cover is not free.`],
    ['When the front falls', 'The back rank becomes the front rank, and starts taking hits like it.'],
    ['Speed', 'Decides who swings first, and buys a chance to act <b>twice</b> in a round. The fastest cards get a second action almost every time.'],
    ['Damage roll', `Every hit varies by ±${Math.round(BATTLE_TUNING.VARIANCE * 100)}%, and can crit for
      ${asPct(CRIT_MULTIPLIER)}. Texture, not a coin flip — over ~25 swings a fight, luck rarely overturns a better team.`],
  ]));
  return el;
}

/* ── the five stats ───────────────────────────────────────────────────────── */
function statsBlock() {
  const el = block('The five stats',
    'Every card gets the same size of budget to spend, and <b>rarity only decides how big that budget is</b> — '
    + 'a well-shaped N really can out-fight a lazy UR. What differs between cards is where the budget went.');
  el.append(rows([
    ['HP', 'How much damage it absorbs before it drops.'],
    ['ATK', 'The base damage on every swing.'],
    ['DEF', `Cuts incoming damage on a curve — each point is worth slightly less than the last, so a wall
      is hard to kill without ever becoming immortal. At ${MITIGATION_K} DEF an attack lands at half strength.`],
    ['SPD', 'Turn order, plus the chance at a second action.'],
    ['MOM', `Momentum. Attack climbs a little every round, up to ${asPct(1 + MOMENTUM_CAP)} by the end of a long
      one — a slow burner that loses early fights and wins long ones.`],
  ]));
  return el;
}

/* ── the six classes ──────────────────────────────────────────────────────── */
function classesBlock() {
  const el = block('The six classes',
    'A class is not a label — each one has a verb, and every verb bites on the front/back split. '
    + 'That is why <b>where</b> you slot a card matters as much as which card it is.');
  /* Straight off CLASS_ABILITY, in the engine's own order, so a class that gains
     or loses a verb changes this panel without anyone remembering to. */
  el.append(rows(BATTLE_CLASSES.map(name => {
    const ability = CLASS_ABILITY[name];
    return [
      `${escapeHtml(name)} <span class="cx-verb">${escapeHtml(ability?.name ?? '—')}</span>`,
      escapeHtml(ability?.text ?? ''),
    ];
  }), 'cx-rows cx-classes'));
  return el;
}

/* ── the element ring ─────────────────────────────────────────────────────── */
function elementsBlock() {
  const el = block('The element ring',
    `Each element beats exactly one other and loses to exactly one. Hitting a matchup you win is worth
     <b>${asPct(ELEMENT_ADVANTAGE)}</b> damage; swinging into one you lose is <b>${asPct(ELEMENT_DISADVANTAGE)}</b>.`);
  const ring = document.createElement('ul');
  ring.className = 'cx-ring';
  for (const name of ELEMENT_CYCLE) {
    const lore = ELEMENT_LORE[name];
    const li = document.createElement('li');
    li.innerHTML = `<b>${escapeHtml(name)}</b> beats <b>${escapeHtml(lore.beats)}</b>`
      + `<span>${escapeHtml(lore.why)}</span>`;
    ring.append(li);
  }
  const tail = document.createElement('p');
  tail.className = 'cx-foot';
  tail.innerHTML = `<b>${escapeHtml(UNALIGNED)}</b> — ${escapeHtml(ELEMENT_LORE[UNALIGNED].why)}. `
    + 'A channel whose topics YouTube never pinned down: it neither counters nor gets countered.';
  el.append(ring, tail);
  return el;
}

/* ── one attack, term by term ─────────────────────────────────────────────── */
function damageBlock() {
  const el = block('One attack, term by term',
    'Everything that touches a single swing, in the order it is applied. Nothing else is hidden.');
  el.append(rows([
    ['Base', 'The attacker’s ATK.'],
    ['Momentum', 'Its ramp for the current round — doubled if it is a Riser.'],
    ['Defence', `× ${MITIGATION_K} ÷ (${MITIGATION_K} + the defender’s DEF).`],
    ['Element', `× ${ELEMENT_ADVANTAGE} if the matchup is yours, × ${ELEMENT_DISADVANTAGE} if it is theirs, otherwise nothing.`],
    ['Reaching', `× ${BATTLE_TUNING.BACK_RANK_ATTACK} when swinging out of the back rank.`],
    ['Aegis', `× ${BATTLE_TUNING.AEGIS_REDUCTION} if the target is in a back rank a living Bulwark is covering.`],
    ['Execute', `× ${BATTLE_TUNING.EXECUTE_BONUS} when a Carry hits a target under
      ${Math.round(BATTLE_TUNING.EXECUTE_THRESHOLD * 100)}% health.`],
    ['Luck', `± ${Math.round(BATTLE_TUNING.VARIANCE * 100)}% swing, then × ${CRIT_MULTIPLIER} on a crit.`],
  ]));
  return el;
}

/* ── hints ────────────────────────────────────────────────────────────────── */
/* THESE ARE MEASURED CLAIMS, not vibes, and that is the bar for putting one
   here. Each line below corresponds to a figure in CLAUDE.md's balance section
   or in DECISIONS.md — the upset rate, the counter-pick win rate, the diversity
   gap. A hint that turned out to be false would be worse than no hints, because
   a player cannot check it and would build around it. */
function hintsBlock(open = false) {
  const el = block('Battle Guide',
    'Everything here was measured against the real deck, not guessed.', open);
  const ul = document.createElement('ul');
  ul.className = 'cx-hints';
  const hints = [
    ['Subscribers buy a budget, not a win',
      'Picking your five biggest channels is a genuinely <em>bad</em> strategy — it loses to almost every other way of choosing. Roughly one N card in five out-rates the median UR.'],
    ['Field four or five different classes',
      `The board says +${Math.round((FORMATION_BONUS[4] - 1) * 100 * 10) / 10}% for four and
       +${Math.round((FORMATION_BONUS[5] - 1) * 100 * 10) / 10}% for five, and that number <em>understates</em> it:
       the stat lift is small, but the verbs you unlock are not. Measured, a team facing an opponent with two more
       classes than it wins about a quarter of the time even at an equal rating.`],
    ['Counter-pick when you can see them',
      'If you accepted a challenge, you can see their five before you choose yours. A team built around the element ring beats a team built for raw power roughly nine times in ten. That is the single biggest edge in the game.'],
    ['Put tanks in front, and mean it',
      'A Bulwark’s Aegis only shelters the back rank <em>while the Bulwark holds the front</em>, and a Titan’s taunt only pulls attacks aimed at its own rank. Both are dead weight in the back.'],
    ['The back rank is not a safe',
      'Assassins ignore the front rank entirely and go for the hardest hitter behind it — and taunt does not stop them. Hiding a fragile Carry in slot 5 is exactly where an Assassin is looking.'],
    ['Slow, tanky teams want long fights',
      'Momentum only pays from round two onward. A high-MOM team that cannot survive the opening rounds never gets to collect it.'],
    ['Speed is a second swing',
      'A fast card can act twice in a round. Two mediocre hits often beat one good one — especially into a high-DEF target, where every individual hit is being cut down anyway.'],
  ];
  for (const [title, text] of hints) {
    const li = document.createElement('li');
    li.innerHTML = `<b>${escapeHtml(title)}</b><span>${text}</span>`;
    ul.append(li);
  }
  el.append(ul);
  return el;
}

/* ── where a card's numbers come from ─────────────────────────────────────── */
function derivationBlock() {
  const el = block('Where the numbers come from',
    'No card’s stats are invented. Every one is derived from the channel’s own public numbers, '
    + 'and the same five feed the card face, the battle card and the fight itself.');
  el.append(rows([
    ['Rarity', 'Subscriber count, and nothing else. N → R → SR → SSR → UR → RUBY.'],
    ['The budget', 'Rarity decides how much stat a card gets to spend — compressed hard, so the gap between an N and a UR is far smaller than the gap in subscribers.'],
    ['The shape', 'Views per video, views per subscriber, upload cadence, channel age and recent momentum decide <em>where</em> that budget goes — which is what sets the class.'],
    ['Element', 'Read from the topics YouTube reports for the channel.'],
    ['Adaptive', `A Balanced card has no special verb and carries ${asPct(ADAPTIVE_BONUS)} on every stat instead.`],
  ]));
  return el;
}

/* WIDE SCREENS OPEN TWO SECTIONS, PHONES OPEN NONE. On the rail there is spare
   column doing nothing, so leading with the two that answer "what am I even
   looking at" costs the player nothing. Stacked under the flow on a phone, the
   same two sections are a screen and a half of reading between them and the
   Fight button — so everything starts shut and the player opens what they want.
   Read once at build time rather than watched: the panel is built on arena open
   and a player who rotates their phone mid-build has not lost anything. */
const RAIL_QUERY = '(min-width: 1100px)';
const onRail = () => globalThis.matchMedia?.(RAIL_QUERY)?.matches ?? true;

/* Built once per arena open. Cheap enough to rebuild, but there is no reason
   to: nothing in it depends on the player's team or the phase. */
export function buildCodex() {
  const frag = document.createDocumentFragment();
  const head = document.createElement('div');
  head.className = 'cx-head';
  head.innerHTML = '<h3>Field manual</h3><p>How combat actually resolves. Safe to ignore — nothing here is a secret.</p>';
  const wide = onRail();
  frag.append(
    head,
    howBlock(wide), hintsBlock(wide), classesBlock(), elementsBlock(),
    statsBlock(), damageBlock(), derivationBlock(),
  );
  return frag;
}

export function mountCodex(host) {
  if (!host || host.dataset.built === '1') return;
  host.replaceChildren(buildCodex());
  host.dataset.built = '1';
}
