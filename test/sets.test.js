/* test/sets — pins the set adapter's pure half (parseSet). loadSet is the
   thin fetch wrapper and is exercised in the browser, not here. The point of
   this file: a malformed set fails loudly at parse time, and a well-formed one
   yields channels the pure core can turn into cards unchanged. */

import { describe, it, expect } from 'vitest';
import { parseSet } from '../src/data/sets.js';
import { STARTER_SET } from '../src/data/starter.js';
import { RARITY_ORDER, toCard } from '../src/engine/core.js';

function validRaw() {
  return {
    slug: 'sample-series',
    title: 'Sample Series',
    series: 'Series 1',
    snapshotDate: '2026-07',
    channels: [
      { id: 'UC1', title: 'Alpha', handle: '@alpha', avatarUrl: '',
        subscriberCount: '42000', hiddenSubscriberCount: false,
        viewCount: '3100000', videoCount: '214' },
      { id: 'UC2', title: 'Beta', hiddenSubscriberCount: true,
        viewCount: '5400000', videoCount: '97' }, // hidden subs, count absent
    ],
  };
}

describe('parseSet — envelope validation', () => {
  it('accepts a well-formed set and returns the envelope + channels', () => {
    const set = parseSet(validRaw());
    expect(set.slug).toBe('sample-series');
    expect(set.title).toBe('Sample Series');
    expect(set.snapshotDate).toBe('2026-07');
    expect(set.channels).toHaveLength(2);
  });

  it('rejects anything that is not a plain object', () => {
    for (const junk of [null, undefined, 42, 'x', []]) {
      expect(() => parseSet(junk)).toThrow();
    }
  });

  it('rejects a set missing slug or title', () => {
    expect(() => parseSet({ ...validRaw(), slug: '' })).toThrow(/slug/);
    expect(() => parseSet({ ...validRaw(), title: undefined })).toThrow(/title/);
  });

  it('rejects a set with no channels', () => {
    expect(() => parseSet({ ...validRaw(), channels: [] })).toThrow(/no channels/);
    expect(() => parseSet({ ...validRaw(), channels: 'nope' })).toThrow();
  });
});

describe('parseSet — channel normalization', () => {
  it('rejects a channel with no id', () => {
    const raw = validRaw();
    raw.channels[0] = { title: 'no id here' };
    expect(() => parseSet(raw)).toThrow(/id/);
  });

  it('coerces counts to strings and defaults the missing ones to "0"', () => {
    const raw = validRaw();
    raw.channels[0].viewCount = 3100000;            // a number slips in
    delete raw.channels[0].videoCount;              // missing entirely
    const [alpha] = parseSet(raw).channels;
    expect(alpha.viewCount).toBe('3100000');
    expect(alpha.videoCount).toBe('0');
  });

  it('keeps subscriberCount absent for hidden channels (matches the API)', () => {
    const hidden = parseSet(validRaw()).channels[1];
    expect(hidden.hiddenSubscriberCount).toBe(true);
    expect('subscriberCount' in hidden).toBe(false);
  });
});

describe('the bundled starter set is a valid set', () => {
  it('parses cleanly and every channel becomes a valid card', () => {
    const set = parseSet(STARTER_SET);
    expect(set.channels.length).toBeGreaterThan(0);
    for (const ch of set.channels) {
      expect(RARITY_ORDER).toContain(toCard(ch).rarity);
    }
  });

  it('keeps a hidden-subscriber channel, so that branch stays exercised', () => {
    const hidden = parseSet(STARTER_SET).channels.filter(c => c.hiddenSubscriberCount);
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.every(c => !('subscriberCount' in c))).toBe(true);
    expect(hidden.every(c => toCard(c).rarity === 'N')).toBe(true);
  });
});

describe('parseSet — output feeds the pure core unchanged', () => {
  it('every parsed channel becomes a valid card', () => {
    for (const ch of parseSet(validRaw()).channels) {
      const card = toCard(ch);
      expect(RARITY_ORDER).toContain(card.rarity);
      expect(Number.isInteger(card.atk)).toBe(true);
      expect(Number.isInteger(card.def)).toBe(true);
      expect(card.atk).toBeGreaterThanOrEqual(0);
      expect(card.def).toBeGreaterThanOrEqual(0);
    }
  });
});
