/* test/share — the text and filename an exported card carries. The canvas half
   is ui/share.js and is not testable headless; what matters here is that the
   disclaimer says the right thing and a filename is always writable.

   The load-bearing test is the last one in the caption block: an undated card
   must not claim a snapshot date it does not have. The stamp exists to be the
   honest thing in a picture that travels without context, so a half-filled
   sentence in it would be the worst possible place for a sloppy string. */

import { describe, it, expect } from 'vitest';
import { monthLabel, shareCaption, slugify, shareFilename } from '../src/engine/share.js';

describe('monthLabel', () => {
  it('reads a snapshot date as a month and year', () => {
    expect(monthLabel('2026-08-01')).toBe('August 2026');
    expect(monthLabel('2026-12-31')).toBe('December 2026');
  });

  it('accepts a bare year-month', () => {
    expect(monthLabel('2026-08')).toBe('August 2026');
  });

  it('is UTC, so a date never slips a month by timezone', () => {
    /* '2026-08-01' parsed locally in a negative offset would render as July. */
    expect(monthLabel('2026-08-01')).toBe('August 2026');
  });

  it('is empty for a missing or unparseable date', () => {
    for (const bad of ['', null, undefined, 'someday', {}]) {
      expect(monthLabel(bad)).toBe('');
    }
  });
});

describe('shareCaption — the line burned into the pixels', () => {
  it('names the project as unofficial and denies affiliation', () => {
    const caption = shareCaption({ snapshotDate: '2026-08-01' });
    expect(caption).toMatch(/unofficial fan card/i);
    expect(caption).toMatch(/not affiliated with YouTube/i);
  });

  it('dates the statistics, since a shared card outlives their accuracy', () => {
    expect(shareCaption({ snapshotDate: '2026-08-01' })).toContain('stats as of August 2026');
  });

  it('drops the stats clause entirely when there is no snapshot', () => {
    /* The starter set is invented channels with a deliberately empty
       snapshotDate. Claiming a date there would be a lie in the one place the
       card is being careful to tell the truth — and "stats as of ·" reads as a
       bug to anyone who sees it. */
    const caption = shareCaption({});
    expect(caption).not.toMatch(/stats as of/);
    expect(caption).not.toMatch(/·\s*·/);
    expect(caption).toMatch(/^Unofficial fan card/);
    expect(caption).toMatch(/not affiliated with YouTube or Google$/);
  });

  it('survives no argument at all', () => {
    expect(shareCaption()).toMatch(/not affiliated/);
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Mark Rober')).toBe('mark-rober');
    expect(slugify('Kurzgesagt – In a Nutshell')).toBe('kurzgesagt-in-a-nutshell');
  });

  it('strips accents to their base letters rather than dropping the word', () => {
    expect(slugify('Beyoncé Café')).toBe('beyonce-cafe');
  });

  it('drops characters a filesystem would refuse', () => {
    expect(slugify('AC/DC: Live?  *2*')).toBe('ac-dc-live-2');
  });

  it('is empty for a title with nothing ASCII in it', () => {
    /* CJK and emoji titles are common; the caller falls back to the id. */
    expect(slugify('日本語チャンネル')).toBe('');
    expect(slugify('🔥🔥🔥')).toBe('');
  });

  it('caps length and never ends on a hyphen', () => {
    const slug = slugify('a'.repeat(30) + ' ' + 'b'.repeat(30));
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug).not.toMatch(/-$/);
  });
});

describe('shareFilename', () => {
  const card = (title, rarity = 'UR', id = 'UC_abc') => ({ channel: { title, id }, rarity });

  it('carries the project name, the channel and the rarity', () => {
    expect(shareFilename(card('Mark Rober'))).toBe('creator-gacha-mark-rober-ur.png');
  });

  it('falls back to the channel id when the title slugifies to nothing', () => {
    /* Otherwise an emoji-titled channel yields "creator-gacha--ur.png". */
    expect(shareFilename(card('🔥🔥🔥', 'SSR', 'UCabc123'))).toBe('creator-gacha-ucabc123-ssr.png');
  });

  it('always produces a writable name, even for a junk card', () => {
    for (const junk of [null, undefined, {}, { channel: {} }]) {
      expect(shareFilename(junk)).toMatch(/^creator-gacha-[a-z0-9-]*\.png$/);
    }
  });
});
