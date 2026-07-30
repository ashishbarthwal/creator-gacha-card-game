# Creator Gacha

> Pull collectible trading cards minted from real YouTube channel stats.
> A browser-based gacha game where a channel's numbers *become* the card.

[![tests](https://github.com/ashishbarthwal/creator-gacha-card-game/actions/workflows/test.yml/badge.svg)](https://github.com/ashishbarthwal/creator-gacha-card-game/actions/workflows/test.yml)

A fan tribute to [Wikigacha](https://en.wikipedia.org/wiki/Wikigacha) (Harusugi, Feb 2026),
which plays the same trick with Wikipedia article metrics. This one does it with YouTube:
subscriber count sets a card's rarity, view count drives its attack, video count its defense.

**This is a portfolio piece, not a business.** Built by an SDET moving into AI engineering,
so the derivation logic is deliberately pure and deterministic — it exists partly to be
tested in public.

<!-- TODO: add a screenshot of a pull/reveal here once the visuals are locked -->

---

## The core idea

| Wikigacha | Creator Gacha |
|---|---|
| Article quality rank → rarity | **Subscriber count → rarity** |
| Pageviews → ATK | **View count → ATK** |
| Article length → DEF | **Video count → DEF** |

Rarity bands scale with subscribers:

| Band | Subscribers |
|---|---|
| **N**   | under 100K |
| **R**   | 100K – 1M |
| **SR**  | 1M – 10M |
| **SSR** | 10M – 50M |
| **UR**  | 50M and up |

Rarer cards are weighted to pull less often, and hit ATK/DEF harder.

---

## Run it

No build step, no dependencies — plain ES modules under `src/`, served as-is.

- **Serve the folder** with any static server, then open `index.html`. The app is ES
  modules, so `file://` double-click won't work (browsers block module imports over
  `file://`), and the server must send a JavaScript MIME type for `.js`:
  - `npx serve` (recommended — correct MIME types out of the box), or
  - `python -m http.server` **only** if your OS maps `.js` to `text/javascript`; some
    setups (notably Windows) serve it as `text/plain`, which browsers reject for modules.
    GitHub Pages / Netlify serve it correctly, so deployment is unaffected.
- **Demo mode** is the default — eight fictional channels, generated avatars, zero network.
  Pull ×1 / ×10, watch the reveal, build a collection. Everything works offline.
- **Live mode** pulls real channels. It needs your own free
  [YouTube Data API v3](https://developers.google.com/youtube/v3/getting-started) key,
  pasted into the app. The key lives only in the page's memory — it is never stored,
  never logged, and never sent anywhere except `googleapis.com`.

Add channels by `@handle`, channel URL, or `UC…` id. (Vanity `/c/` URLs aren't supported yet.)

---

## How it's built

Two structural ideas do the heavy lifting:

**The data seam.** `demo`, `sets` (curated JSON snapshots), and `live` sources all produce an
*identical* channel object shape, so nothing downstream can tell them apart. This is why the
app runs offline, why tests never need an API key, and why demo mode is a real adapter rather
than a hack. Adding the `sets` source needed no changes to the gacha, reveal, render, or
collection code — it's just another pool behind the seam.

**The pure core.** `rarityFromSubs` and `statsFrom` are pure and deterministic — no I/O, no
randomness, no DOM. They sit between the data seam and everything stateful, which makes them
the natural test target. The gacha engine takes an injectable RNG (`rng = Math.random` as a
default parameter) so pulls can be tested with a fixed seed.

Both live in `src/engine/`, because the source tree is organized by *what a module may touch*
rather than by topic: nothing → `src/engine/` (headless — it would run unchanged in Node),
the network → `src/data/`, the DOM → `src/ui/`. A new file's home follows from one question.

```
input (@handle | URL | UC id)
        │
   resolve to channelId
        │
   ┌────┼─────────┐            ← the data seam
 demo  sets      live (YouTube Data API v3)
   └────┼─────────┘
        │
  derivation core (PURE)        ← rarityFromSubs, statsFrom
        │
  gacha engine (weighted RNG, ×1/×10, dupes stack)
        │
  collection → card render + reveal
```

Vanilla JS, ES modules, no framework, no bundler. Fonts: Anton / Space Grotesk / Space Mono.

### Tests

134 Vitest tests pin the pure core — every rarity boundary from both sides, hidden and
malformed subscriber counts, monotonic stat scaling — the gacha engine under a seeded RNG (so
the drop-rate distribution is an exact assertion, including that the odds don't move when a
band is padded with 200 more cards), the card-set adapter's validation, and the discovery
engine, whose query jitter is reproducible under an injected clock and seed. CI
runs them on every push (that's the badge above); each run uploads a self-contained HTML
report as an artifact.

```
npm test              # run the suite
npm run test:report   # also write reports/: JUnit XML + a double-clickable HTML report
```

Vitest is the repo's only dependency, dev-only — the shipped app has none.

---

## Roadmap to the end goal

The game began as a single working `youtube-gacha.html` prototype and has since been split
into a tested, modular, deployable project in dependency order (full detail in
[`PLAN.md`](PLAN.md), design rationale in [`DECISIONS.md`](DECISIONS.md)):

- [x] **Prototype** — working single-file build: data seam, pure core, weighted gacha,
      reveal animation, in-memory collection.
- [x] **WP0 — Split the monolith.** Broke the single file into a pure core, the gacha
      engine, `src/data/*` (the seam), `src/ui/*`, `src/state.js`, `src/main.js` (wiring).
      Zero behavior change; `index.html` is now the entry point. (The core and the pull
      engine later moved together into `src/engine/`.)
- [x] **WP1 — Test suite.** Vitest against the pure core: exact rarity boundaries, hidden /
      malformed subscriber counts, monotonic stat scaling, seeded-RNG gacha distribution.
      56 tests, `npm test`, dev-only dependency.
- [x] **WP2 — Footer.** Buy Me a Coffee tip jar (passive, never tied to game state) plus the
      "not affiliated with YouTube/Google" disclaimer.
- [x] **WP3 — Holographic cards.** Pointer-tracked tilt + holo shine gated by rarity, with
      reduced-motion and touch fallbacks. Grew into a full card redesign: metal-bevel frames
      on a tier system mapped to the YouTube Creator Awards (Silver/Gold/Diamond/Red Diamond),
      a click-to-enlarge inspector, and the inline CSS split out to `styles.css`.
- [~] **WP4 — Card sets.** *App-side landed:* a sets adapter behind the seam, a
      `sets/index.json` manifest, and a **Sets** banner mode that pulls from curated static JSON
      with no API key (sample set ships fictional channels for now). *Pending:* the
      `build-set.js` snapshot/refresh pipeline that mints real sets.
- [ ] **WP5 — Extras.** Card→PNG export, localStorage persistence, auto-resolved battles,
      and a polished README with a live demo link.

---

## Design guardrails

A few decisions are deliberately locked (see [`DECISIONS.md`](DECISIONS.md) for the full log):

- **No monetization in the game.** No paid pulls, currency, perks, or ads. The one exception
  is a passive Buy Me a Coffee link that never unlocks anything in-game.
- **Client-side only.** Static hosting, users bring their own API key, no backend.
- **No build step.** Plain ES modules, served as-is. Vitest is a dev-only dependency.

---

## Disclaimer

Unofficial fan project. **Not affiliated with or endorsed by YouTube or Google.** Channel data
is retrieved via the YouTube Data API and belongs to the respective creators and Google. Cards
use publicly available channel information; if you're a creator and would like your channel left
out of a set, that request will be honored.

## License

None — this is a personal portfolio project. The code is public to read and learn from, but it
is **not** licensed for reuse. © 2026 Ashish Barthwal. All rights reserved.
