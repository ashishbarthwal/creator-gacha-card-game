/* test/youtube — pins mapChannelItem, the pure item->Channel mapper shared by
   the live adapter (fetchLiveChannel) and Magic Search's batch fetch
   (data/search.js:fetchChannelsByIds). No network: it maps a raw API item
   object, which is all these tests hand it. If the two callers ever drift on
   channel shape, this is where it gets caught. */

import { describe, it, expect } from 'vitest';
import { mapChannelItem } from '../src/data/youtube.js';

function item(over = {}) {
  return {
    id: 'UC_abc',
    snippet: {
      title: 'Test Channel',
      customUrl: '@test',
      country: 'US',
      publishedAt: '2013-04-05T00:00:00Z',
      thumbnails: { default: { url: 'd.jpg' }, medium: { url: 'm.jpg' }, high: { url: 'h.jpg' } },
      ...over.snippet,
    },
    statistics: {
      subscriberCount: '12345', viewCount: '678900', videoCount: '42',
      ...over.statistics,
    },
    /* No default claims: topicDetails is genuinely absent for a large share of
       real channels, so the base fixture is the common case and a test that
       wants topics passes them in. */
    ...(over.topicDetails ? { topicDetails: over.topicDetails } : {}),
  };
}

describe('mapChannelItem — API item to Channel shape', () => {
  it('maps a full item exactly', () => {
    expect(mapChannelItem(item())).toEqual({
      id: 'UC_abc',
      title: 'Test Channel',
      handle: '@test',
      avatarUrl: 'h.jpg',
      subscriberCount: '12345',
      hiddenSubscriberCount: false,
      viewCount: '678900',
      videoCount: '42',
      country: 'US',
      publishedAt: '2013-04-05T00:00:00Z',
      /* Raw here on purpose: the seam carries the claims and the engine turns
         them into an element. Only setbuild.js stores the derived answer. */
      topicCategories: [],
    });
  });

  it('carries topicCategories through from topicDetails', () => {
    const topics = ['https://en.wikipedia.org/wiki/Video_game_culture'];
    expect(mapChannelItem(item({ topicDetails: { topicCategories: topics } })).topicCategories).toEqual(topics);
  });

  /* topicDetails is absent for a great many smaller channels, and an absent
     claim must read as "no claim" rather than as a crash — Unaligned exists
     precisely for this case. */
  it('an item with no topicDetails yields an empty list, not undefined', () => {
    expect(mapChannelItem(item()).topicCategories).toEqual([]);
  });

  it('prefers the largest thumbnail, falling down the ladder', () => {
    expect(mapChannelItem(item({ snippet: { thumbnails: { default: { url: 'd.jpg' }, medium: { url: 'm.jpg' } } } })).avatarUrl).toBe('m.jpg');
    expect(mapChannelItem(item({ snippet: { thumbnails: { default: { url: 'd.jpg' } } } })).avatarUrl).toBe('d.jpg');
    expect(mapChannelItem(item({ snippet: { thumbnails: {} } })).avatarUrl).toBe('');
  });

  it('normalizes a bare customUrl to the @handle shape', () => {
    expect(mapChannelItem(item({ snippet: { customUrl: 'mkbhd' } })).handle).toBe('@mkbhd');
    expect(mapChannelItem(item({ snippet: { customUrl: '' } })).handle).toBe('');
  });

  it('leaves subscriberCount undefined and flags hidden when the API hides it', () => {
    const mapped = mapChannelItem(item({ statistics: { hiddenSubscriberCount: true, subscriberCount: undefined } }));
    expect(mapped.hiddenSubscriberCount).toBe(true);
    expect(mapped.subscriberCount).toBeUndefined();
  });

  it('defaults missing snippet/statistics rather than throwing', () => {
    expect(mapChannelItem({ id: 'UC_x' })).toEqual({
      id: 'UC_x',
      title: 'Untitled channel',
      handle: '',
      avatarUrl: '',
      subscriberCount: undefined,
      hiddenSubscriberCount: false,
      viewCount: '0',
      videoCount: '0',
      country: '',
      publishedAt: '',
      topicCategories: [],
    });
  });

  /* An empty publishedAt has to survive all the way to battle-stats.js, which
     reads a missing launch date as mid-range maturity rather than a
     zero-maturity card. Pinned here because this mapper is where the empty
     string is minted. */
  it('captures the launch date, empty when the snippet omits it', () => {
    expect(mapChannelItem(item()).publishedAt).toBe('2013-04-05T00:00:00Z');
    expect(mapChannelItem({ id: 'UC_x' }).publishedAt).toBe('');
  });

  it('captures the self-declared country, empty when unset', () => {
    expect(mapChannelItem(item({ snippet: { country: 'IN' } })).country).toBe('IN');
    expect(mapChannelItem({ id: 'UC_x' }).country).toBe('');
  });
});
