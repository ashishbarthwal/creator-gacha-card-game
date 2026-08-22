/* test/codex — the contract the in-arena field manual reads.

   `ui/codex.js` builds the combat reference out of live engine exports rather
   than restating them, which is the whole point of it: retune the engine and
   the manual retunes in the same breath. That trick has one failure mode, and
   it is silent — a class renamed, an element added, a constant moved, and the
   panel quietly renders a blank row or an `undefined` to a player.

   The panel itself touches the DOM, and this project tests UI in a browser by
   hand rather than by installing a headless driver. So what is pinned here is
   the half that CAN be checked headlessly and is the half that actually breaks:
   that every table the codex walks is complete and typed the way it reads it.
   If one of these goes red, the manual has a hole in it. */

import { describe, it, expect } from 'vitest';
import { CLASS_ABILITY, BATTLE_TUNING, FORMATION_BONUS, TEAM_SIZE, FRONT_SLOTS } from '../src/engine/battle.js';
import {
  ELEMENT_CYCLE, ELEMENT_LORE, ELEMENT_ADVANTAGE, ELEMENT_DISADVANTAGE, UNALIGNED,
} from '../src/engine/element.js';
import {
  MITIGATION_K, CRIT_MULTIPLIER, MOMENTUM_CAP, ADAPTIVE_BONUS, BATTLE_CLASSES,
} from '../src/engine/battle-stats.js';

describe('every class the codex lists has a verb to list', () => {
  it.each(BATTLE_CLASSES)('%s has a named ability with text', name => {
    const ability = CLASS_ABILITY[name];
    expect(ability, `CLASS_ABILITY is missing ${name}`).toBeTruthy();
    expect(typeof ability.name).toBe('string');
    expect(ability.name.length).toBeGreaterThan(0);
    expect(typeof ability.text).toBe('string');
    expect(ability.text.length).toBeGreaterThan(0);
  });

  /* The reverse direction too: a verb for a class that no longer exists is a
     row the panel will never render, and a rename that only lands on one side
     shows up here rather than as a blank line in the arena. */
  it('CLASS_ABILITY describes no class the deck cannot contain', () => {
    expect(Object.keys(CLASS_ABILITY).sort()).toEqual([...BATTLE_CLASSES].sort());
  });
});

describe('every element on the ring has lore to print', () => {
  it.each(ELEMENT_CYCLE)('%s names what it beats, and why', name => {
    const lore = ELEMENT_LORE[name];
    expect(lore, `ELEMENT_LORE is missing ${name}`).toBeTruthy();
    expect(ELEMENT_CYCLE).toContain(lore.beats);
    expect(lore.why.length).toBeGreaterThan(0);
  });

  /* The codex prints Unaligned as the ring's footnote rather than a member, so
     it has to exist AND has to stay off the cycle. */
  it('Unaligned has lore but is not on the ring', () => {
    expect(ELEMENT_LORE[UNALIGNED]?.why?.length).toBeGreaterThan(0);
    expect(ELEMENT_CYCLE).not.toContain(UNALIGNED);
  });

  /* The lore is the ring: `beatsOf` derives the matchup from array ORDER, so a
     reordering that left the prose behind would have the manual teaching a
     wheel the engine does not play. */
  it('the lore agrees with the cycle order it is describing', () => {
    ELEMENT_CYCLE.forEach((name, i) => {
      expect(ELEMENT_LORE[name].beats).toBe(ELEMENT_CYCLE[(i + 1) % ELEMENT_CYCLE.length]);
    });
  });
});

describe('every number the codex prints is a real number', () => {
  /* Each of these is interpolated into a sentence a player reads. An undefined
     here renders the word "undefined" into the arena, which is the exact class
     of bug a reference built from live values is supposed to make impossible. */
  it.each([
    ['MAX_ROUNDS', BATTLE_TUNING.MAX_ROUNDS],
    ['VARIANCE', BATTLE_TUNING.VARIANCE],
    ['BACK_RANK_ATTACK', BATTLE_TUNING.BACK_RANK_ATTACK],
    ['AEGIS_REDUCTION', BATTLE_TUNING.AEGIS_REDUCTION],
    ['EXECUTE_BONUS', BATTLE_TUNING.EXECUTE_BONUS],
    ['EXECUTE_THRESHOLD', BATTLE_TUNING.EXECUTE_THRESHOLD],
    ['MITIGATION_K', MITIGATION_K],
    ['CRIT_MULTIPLIER', CRIT_MULTIPLIER],
    ['MOMENTUM_CAP', MOMENTUM_CAP],
    ['ADAPTIVE_BONUS', ADAPTIVE_BONUS],
    ['ELEMENT_ADVANTAGE', ELEMENT_ADVANTAGE],
    ['ELEMENT_DISADVANTAGE', ELEMENT_DISADVANTAGE],
    ['TEAM_SIZE', TEAM_SIZE],
    ['FRONT_SLOTS', FRONT_SLOTS],
  ])('%s is finite', (_name, value) => {
    expect(Number.isFinite(value)).toBe(true);
  });

  /* The formation block quotes the 4- and 5-class lifts as percentages. Both
     have to exist and both have to be a lift, or the hint reads "+0%". */
  it('the formation lifts the hints quote are real lifts', () => {
    expect(FORMATION_BONUS[4]).toBeGreaterThan(1);
    expect(FORMATION_BONUS[5]).toBeGreaterThan(FORMATION_BONUS[4]);
  });

  /* The manual tells the player the back rank is safe until the front falls,
     which is only true while there IS a front to fall. */
  it('the ranks the manual describes both exist', () => {
    expect(FRONT_SLOTS).toBeGreaterThan(0);
    expect(TEAM_SIZE - FRONT_SLOTS).toBeGreaterThan(0);
  });
});

describe('claims the hints make about direction', () => {
  /* The hints say an advantaged hit is worth MORE and a disadvantaged one
     LESS. Cheap to assert, and it is the kind of thing a sign flip during a
     retune would invert without breaking anything else. */
  it('advantage is a bonus and disadvantage is a penalty', () => {
    expect(ELEMENT_ADVANTAGE).toBeGreaterThan(1);
    expect(ELEMENT_DISADVANTAGE).toBeLessThan(1);
  });

  it('reaching from the back and being shielded both reduce damage', () => {
    expect(BATTLE_TUNING.BACK_RANK_ATTACK).toBeLessThan(1);
    expect(BATTLE_TUNING.AEGIS_REDUCTION).toBeLessThan(1);
  });

  it('a crit and an execute both increase it', () => {
    expect(CRIT_MULTIPLIER).toBeGreaterThan(1);
    expect(BATTLE_TUNING.EXECUTE_BONUS).toBeGreaterThan(1);
  });
});
