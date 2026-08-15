/* test/resolve — the only thing standing between a paste and the API.

   This is the app's front door: everything a player types arrives here first,
   and it is the one module that has to be right about input it did not choose.
   Two behaviours are pinned harder than the rest, because both are DECISIONS
   rather than implementation details:

     1. The host check is anchored. `(^|\.)youtube\.com$` accepts youtube.com
        and its subdomains and nothing else — not `evilyoutube.com`, not
        `youtube.com.attacker.net`. A resolver that accepted either would send a
        handle scraped off an attacker-chosen URL into a keyed API call.
     2. Vanity URLs get their OWN error, not the generic one. `/c/` and `/user/`
        are deliberately out of scope (CLAUDE.md, DECISIONS.md), and a player
        who pastes one has done nothing wrong — they need to be told which of
        the two supported forms to use instead, not that their URL is garbage. */

import { describe, it, expect } from 'vitest';
import { resolveChannelInput } from '../src/data/resolve.js';

const ID = 'UCX6OQ3DkcsbYNE6H8uQQuVA';   // 'UC' + 22 chars, the real shape

describe('UC ids', () => {
  it('takes a bare UC id', () => {
    expect(resolveChannelInput(ID)).toEqual({ kind: 'id', value: ID });
  });

  it('takes a UC id out of a channel URL', () => {
    expect(resolveChannelInput(`https://youtube.com/channel/${ID}`)).toEqual({ kind: 'id', value: ID });
  });

  /* A MALFORMED UC ID IS NOT AN ERROR, and pinning that was worth a failing
     test first. `UC…` with one character missing has no slash in it, so it
     falls through to the bare-word branch and comes back as a HANDLE — which is
     the documented fallback doing its job, not a leak: handles really can look
     like that, and the API is what settles whether one exists.

     The invariant that matters is narrower and is the one asserted here: the
     exact fixed width is what earns `kind: 'id'`. Anything else must never be
     handed onward as a channel id, because that is the value that goes into a
     keyed request as fact rather than as a guess. */
  it.each([
    ['too short', 'UCX6OQ3DkcsbYNE6H8uQQuV'],
    ['too long', ID + 'A'],
    ['wrong prefix', 'XCX6OQ3DkcsbYNE6H8uQQuVA'],
  ])('never reports %s as a channel id', (_label, bad) => {
    expect(resolveChannelInput(bad).kind).not.toBe('id');
  });

  /* Inside a URL there is no such fallback — the path either matches the exact
     shape or the URL is rejected outright. */
  it.each([
    ['too short', 'UCX6OQ3DkcsbYNE6H8uQQuV'],
    ['too long', ID + 'A'],
  ])('rejects a channel URL whose id is %s', (_label, bad) => {
    expect(resolveChannelInput(`https://youtube.com/channel/${bad}`).error).toBeTruthy();
  });
});

describe('handles', () => {
  it('takes an @handle', () => {
    expect(resolveChannelInput('@MrBeast')).toEqual({ kind: 'handle', value: '@MrBeast' });
  });

  /* A bare word is the most common thing a player types. It is assumed to be a
     handle rather than rejected, which is the whole reason this branch exists. */
  it('adds the @ to a bare word', () => {
    expect(resolveChannelInput('MrBeast')).toEqual({ kind: 'handle', value: '@MrBeast' });
  });

  it('trims surrounding whitespace before deciding', () => {
    expect(resolveChannelInput('   @MrBeast  ')).toEqual({ kind: 'handle', value: '@MrBeast' });
  });

  it('takes a handle out of a URL, with or without a scheme', () => {
    const want = { kind: 'handle', value: '@MrBeast' };
    expect(resolveChannelInput('https://www.youtube.com/@MrBeast')).toEqual(want);
    expect(resolveChannelInput('youtube.com/@MrBeast')).toEqual(want);
    expect(resolveChannelInput('https://youtube.com/@MrBeast/')).toEqual(want);
  });

  it.each([
    ['too short', '@ab'],
    ['too long', '@' + 'a'.repeat(31)],
    ['illegal character', '@Mr Beast'],
  ])('rejects a handle that is %s', (_label, bad) => {
    expect(resolveChannelInput(bad).error).toBeTruthy();
  });
});

describe('hostile and malformed input', () => {
  it('returns an error, never throws, for empty input', () => {
    for (const empty of ['', '   ', null, undefined]) {
      expect(resolveChannelInput(empty).error).toBeTruthy();
    }
  });

  /* THE ANCHOR IS THE TEST. A resolver matching `youtube\.com` unanchored would
     accept every one of these and hand back a handle the attacker chose. */
  it.each([
    'https://evilyoutube.com/@MrBeast',
    'https://youtube.com.attacker.net/@MrBeast',
    'https://notyoutube.com/channel/' + ID,
    'https://vimeo.com/@MrBeast',
  ])('refuses a look-alike host: %s', bad => {
    expect(resolveChannelInput(bad).error).toBeTruthy();
  });

  it('accepts real youtube.com subdomains', () => {
    expect(resolveChannelInput('https://m.youtube.com/@MrBeast')).toEqual({ kind: 'handle', value: '@MrBeast' });
    expect(resolveChannelInput('https://music.youtube.com/@MrBeast')).toEqual({ kind: 'handle', value: '@MrBeast' });
  });

  it('does not throw on input that cannot parse as a URL', () => {
    for (const junk of ['http://', '///', 'https://[', '@@@/']) {
      expect(() => resolveChannelInput(junk)).not.toThrow();
      expect(resolveChannelInput(junk).error).toBeTruthy();
    }
  });
});

describe('vanity URLs get their own message', () => {
  /* Out of scope by decision, not by oversight — so the error has to name the
     way forward. Asserted on the text because the text IS the feature: a
     generic "could not read that" would leave the player with no next move. */
  it.each([
    'https://youtube.com/c/MrBeast6000',
    'https://www.youtube.com/user/MrBeast6000',
  ])('%s explains what to use instead', url => {
    const out = resolveChannelInput(url);
    expect(out.error).toMatch(/Vanity URLs are not supported/);
    expect(out.error).toMatch(/@handle or UC id/);
  });

  it('the generic URL error is a different message', () => {
    const generic = resolveChannelInput('https://youtube.com/watch?v=dQw4w9WgXcQ');
    expect(generic.error).toBeTruthy();
    expect(generic.error).not.toMatch(/Vanity URLs/);
  });
});
