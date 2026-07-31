/* test/emblem — pins the generated emblem. Pure and headless, so this runs with
   no DOM and no network, which is itself half the point: an emblem must make no
   request, and a data URI is how that is guaranteed.

   The load-bearing tests: that the same channel always produces the same picture
   (a card that repaints between visits is not a collectible), and that an
   untrusted channel title cannot break out of the SVG it is interpolated into. */

import { describe, it, expect } from 'vitest';
import { emblemFor, emblemAccent, initialFor } from '../src/engine/emblem.js';
import { STARTER_SET } from '../src/data/starter.js';

const channel = (over = {}) => ({ id: 'UC_abc123', title: 'A Channel', ...over });
const decode = uri => decodeURIComponent(uri.replace('data:image/svg+xml;utf8,', ''));

describe('emblemFor — deterministic, and never a network request', () => {
  it('is a data URI, so rendering it fetches nothing', () => {
    expect(emblemFor(channel())).toMatch(/^data:image\/svg\+xml;utf8,/);
  });

  it('returns the same picture for the same channel, every time', () => {
    expect(emblemFor(channel())).toBe(emblemFor(channel()));
  });

  it('gives different channels different hues', () => {
    expect(emblemFor(channel({ id: 'UC_one' }))).not.toBe(emblemFor(channel({ id: 'UC_two' })));
  });

  it('keys the hue on the id, not the title — a rename must not repaint a card', () => {
    const before = emblemAccent(channel({ title: 'Old Name' }));
    const after = emblemAccent(channel({ title: 'Totally New Name' }));
    expect(before).toBe(after);
  });

  it('produces well-formed SVG carrying the initial', () => {
    const svg = decode(emblemFor(channel({ title: 'Kaiju Kitchen' })));
    expect(svg).toMatch(/^<svg xmlns=/);
    expect(svg).toContain('>K</text>');
  });

  it('honours a requested size while keeping the viewBox', () => {
    const svg = decode(emblemFor(channel(), { size: 800 }));
    expect(svg).toContain('width="800"');
    expect(svg).toContain('viewBox="0 0 120 120"');
  });
});

describe('initialFor', () => {
  it('uppercases the first character', () => {
    expect(initialFor('midnight ramen')).toBe('M');
  });

  it('counts an astral character as one — emoji channel names are common', () => {
    expect(initialFor('🎸 Guitar')).toBe('🎸');
  });

  it('falls back to ? rather than throwing on an empty or missing title', () => {
    for (const bad of ['', null, undefined]) expect(initialFor(bad)).toBe('?');
  });
});

describe('emblemFor — an untrusted title cannot break out of the SVG', () => {
  it('escapes a markup-shaped title', () => {
    const svg = decode(emblemFor(channel({ title: '<script>alert(1)</script>' })));
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;');
  });

  it('escapes a quote that would otherwise close an attribute', () => {
    const svg = decode(emblemFor(channel({ title: '"onload="evil()' })));
    expect(svg).not.toMatch(/>"</);
    expect(svg).toContain('&quot;');
  });
});

describe('emblemAccent', () => {
  it('is an hsl colour matching the emblem it belongs to', () => {
    const accent = emblemAccent(channel());
    expect(accent).toMatch(/^hsl\(\d+ 70% 55%\)$/);
    const hue = accent.match(/^hsl\((\d+)/)[1];
    expect(decode(emblemFor(channel()))).toContain(`hsl(${hue},72%,52%)`);
  });

  it('is stable and needs no image to sample', () => {
    expect(emblemAccent(channel())).toBe(emblemAccent(channel()));
  });
});

describe('overrides — the starter set keeps its authored art direction', () => {
  it('uses an explicit hue and initial when given', () => {
    const svg = decode(emblemFor({}, { hue: 212, initial: 'P' }));
    expect(svg).toContain('hsl(212,72%,52%)');
    expect(svg).toContain('>P</text>');
  });

  it('normalizes an out-of-range hue instead of emitting nonsense', () => {
    expect(decode(emblemFor({}, { hue: -40 }))).toContain('hsl(320,72%,52%)');
  });

  it('still backs every starter channel, so there is one generator not two', () => {
    expect(STARTER_SET.channels).not.toHaveLength(0);
    for (const ch of STARTER_SET.channels) {
      expect(ch.avatarUrl).toMatch(/^data:image\/svg\+xml;utf8,/);
    }
  });
});
