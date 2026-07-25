/* test/search — pins the one pure, testable piece of the live discovery fetch:
   orderChannelsByIds, which realigns a channels.list response to the order we
   asked for and drops ids the API didn't return (a deleted/terminated channel).
   The fetch itself is live and not unit-tested; this rule is the part a
   regression would silently break — a dead channel shipping as a blank card. */

import { describe, it, expect } from 'vitest';
import { orderChannelsByIds } from '../src/data/search.js';

function item(id, subs = '1000') {
  return {
    id,
    snippet: { title: id, customUrl: '@' + id },
    statistics: { subscriberCount: subs, viewCount: '1', videoCount: '1' },
  };
}

describe('orderChannelsByIds — align channels.list to the requested order', () => {
  it('returns channels in the requested id order, not the API order', () => {
    const items = [item('UC_b'), item('UC_a'), item('UC_c')]; // API reordered
    expect(orderChannelsByIds(items, ['UC_a', 'UC_b', 'UC_c']).map(c => c.id))
      .toEqual(['UC_a', 'UC_b', 'UC_c']);
  });

  it('drops an id the API did not return (deleted/terminated channel)', () => {
    const items = [item('UC_a'), item('UC_c')]; // UC_b is gone
    expect(orderChannelsByIds(items, ['UC_a', 'UC_b', 'UC_c']).map(c => c.id))
      .toEqual(['UC_a', 'UC_c']);
  });

  it('maps each item through to the Channel shape', () => {
    const [ch] = orderChannelsByIds([item('UC_a', '5000')], ['UC_a']);
    expect(ch).toMatchObject({ id: 'UC_a', handle: '@UC_a', subscriberCount: '5000' });
  });

  it('empty or missing items, or no ids, yield an empty list', () => {
    expect(orderChannelsByIds([], ['UC_a'])).toEqual([]);
    expect(orderChannelsByIds([item('UC_a')], [])).toEqual([]);
    expect(orderChannelsByIds(null, ['UC_a'])).toEqual([]);
  });
});
