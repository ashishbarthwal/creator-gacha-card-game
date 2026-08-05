/* test/element — pins the topic claim → element mapping.

   The load-bearing tests here are the SPECIFICITY ones. YouTube hands almost
   every channel a vague top-level bucket ("Entertainment", "Society") plus zero
   or more specific claims, so a mapping that took the first match would file
   most of the deck under whichever bucket happened to be listed first. Reading
   the leaf over the bucket is the whole design, and it is invisible until you
   test a channel that carries both. */

import { describe, it, expect } from 'vitest';
import {
  elementFromTopics, elementOf, elementMultiplier, matchupOf, beatsOf,
  ELEMENTS, ELEMENT_CYCLE, ELEMENT_LORE, UNALIGNED,
  ELEMENT_ADVANTAGE, ELEMENT_DISADVANTAGE,
} from '../src/engine/element.js';

const wiki = slug => `https://en.wikipedia.org/wiki/${slug}`;

describe('elementFromTopics — the real YouTube taxonomy', () => {
  it.each([
    ['Video_game_culture', 'Gaming'],
    ['Role-playing_video_game', 'Gaming'],
    ['Association_football', 'Gaming'],   // Sport folds into Gaming — see the module header
    ['Rock_music', 'Music'],
    ['Music_of_Asia', 'Music'],
    ['Technology', 'Tech'],
    ['Vehicle', 'Tech'],
    ['Knowledge', 'Knowledge'],
    ['Politics', 'Knowledge'],
    ['Humour', 'Comedy'],
    ['Professional_wrestling', 'Comedy'],
    ['Food', 'Lifestyle'],
    ['Physical_fitness', 'Lifestyle'],
  ])('%s reads as %s', (slug, expected) => {
    expect(elementFromTopics([wiki(slug)])).toBe(expected);
  });

  it('a leaf claim outranks the bucket it sits inside', () => {
    /* The commonest real shape: a food channel that YouTube also files under
       Entertainment. Reading the bucket would make most of the deck Comedy. */
    expect(elementFromTopics([wiki('Entertainment'), wiki('Food')])).toBe('Lifestyle');
    expect(elementFromTopics([wiki('Society'), wiki('Technology')])).toBe('Tech');
  });

  it('agreement between several claims beats a single louder one', () => {
    expect(elementFromTopics([wiki('Entertainment'), wiki('Rock_music'), wiki('Pop_music')])).toBe('Music');
  });

  it('reads a bare slug as happily as a full URL', () => {
    expect(elementFromTopics(['Rock_music'])).toBe('Music');
  });

  it('survives query strings, fragments and trailing slashes', () => {
    expect(elementFromTopics([`${wiki('Food')}/`])).toBe('Lifestyle');
    expect(elementFromTopics([`${wiki('Food')}#Cuisine`])).toBe('Lifestyle');
  });

  it('falls back to a substring hint for a slug the table has not seen', () => {
    expect(elementFromTopics([wiki('Sandbox_game')])).toBe('Gaming');
    expect(elementFromTopics([wiki('Ambient_music')])).toBe('Music');
  });

  it('a listed leaf still beats an inferred hint', () => {
    /* "music_video_game" would hint both ways; the exact table entry decides. */
    expect(elementFromTopics([wiki('Music_video_game')])).toBe('Gaming');
  });

  it.each([undefined, null, [], ['not a url'], [''], [wiki('Category:Lists')]])(
    '%p yields Unaligned rather than throwing', (input) => {
      expect(elementFromTopics(input)).toBe(UNALIGNED);
    });

  it('is deterministic — the same claims always give the same element', () => {
    const topics = [wiki('Entertainment'), wiki('Technology'), wiki('Food')];
    expect(elementFromTopics(topics)).toBe(elementFromTopics([...topics].reverse()));
  });
});

describe('elementOf — the seam', () => {
  it('prefers a stored element, because a shipped set carries the answer not the URLs', () => {
    expect(elementOf({ element: 'Music', topicCategories: [wiki('Technology')] })).toBe('Music');
  });

  it('derives from topicCategories when there is no stored element — the live path', () => {
    expect(elementOf({ topicCategories: [wiki('Technology')] })).toBe('Tech');
  });

  it('ignores a stored value that is not an element we recognise', () => {
    expect(elementOf({ element: 'Sportsball', topicCategories: [wiki('Food')] })).toBe('Lifestyle');
  });

  it.each([undefined, null, {}, { element: '' }])('%p is Unaligned', (channel) => {
    expect(elementOf(channel)).toBe(UNALIGNED);
  });
});

describe('the wheel', () => {
  it('is a simple cycle — one strength and one weakness each, no orphans', () => {
    for (const element of ELEMENT_CYCLE) {
      expect(ELEMENT_CYCLE).toContain(beatsOf(element));
      expect(beatsOf(element)).not.toBe(element);
    }
    expect(new Set(ELEMENT_CYCLE.map(beatsOf)).size).toBe(ELEMENT_CYCLE.length);
  });

  it('multipliers are advantage / neutral / disadvantage and nothing else', () => {
    for (const a of ELEMENTS) {
      for (const b of ELEMENTS) {
        expect([ELEMENT_ADVANTAGE, 1, ELEMENT_DISADVANTAGE]).toContain(elementMultiplier(a, b));
      }
    }
  });

  it('mirroring a matchup flips it', () => {
    for (const a of ELEMENT_CYCLE) {
      const b = beatsOf(a);
      expect(matchupOf(a, b)).toBe('strong');
      expect(matchupOf(b, a)).toBe('weak');
    }
  });

  it('an element never counters itself', () => {
    for (const a of ELEMENTS) expect(matchupOf(a, a)).toBe('even');
  });

  it('an unknown element is treated as neutral rather than crashing the fight', () => {
    expect(elementMultiplier('Sportsball', 'Gaming')).toBe(1);
    expect(elementMultiplier(undefined, undefined)).toBe(1);
  });

  /* The lore is how a player remembers the ring without a chart, so it has to
     describe the ring the code actually implements. */
  it('every element has lore, and the lore names the element it really beats', () => {
    for (const element of ELEMENT_CYCLE) {
      expect(ELEMENT_LORE[element]?.why).toBeTruthy();
      expect(ELEMENT_LORE[element].beats).toBe(beatsOf(element));
    }
  });
});
