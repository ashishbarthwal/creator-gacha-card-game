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
      thumbnails: { default: { url: 'd.jpg' }, medium: { url: 'm.jpg' }, high: { url: 'h.jpg' } },
      ...over.snippet,
    },
    statistics: {
      subscriberCount: '12345', viewCount: '678900', videoCount: '42',
      ...over.statistics,
    },
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
    });
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
    });
  });
});
