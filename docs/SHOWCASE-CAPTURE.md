# Local Showcase Capture

The repository includes a deterministic, localhost-only twelve-card showcase for screenshots and
marketing assets. It shows two cards from each of the six tiers without changing public pull odds.

## Open the capture view

Build the static site from the current local set, start its server, then open:

```text
npm run build:site
npx serve -l tcp://127.0.0.1:4174 _site
http://localhost:4174/?marketingCapture=1&dev=0
```

The capture query is honored only on `localhost`, `127.0.0.1`, or `::1`. It:

1. fills the in-memory collection with a curated twelve-card lineup, two per rarity tier;
2. uses the normal card renderer and reveal, with no change to public pull odds;
3. exposes a **Showcase 12** button to replay the fixed lineup on demand.

The preferred lineup is MrBeast and PewDiePie (RUBY); Cristiano Ronaldo and Taylor Swift (UR);
Rihanna and Markiplier (SSR); Charli D'Amelio and MoreSidemen (SR); Jerma985 and Mizkif (R);
Jonathan Blow and Ghetts (N). Handles are selected when present in the local set. A missing roster
entry falls back to another card in that tier, so a deck rebuild does not leave the capture short.

## Safety properties

- The capture collection stays in memory and does not replace the browser's saved collection.
- Pressing **Showcase 12** opens the normal reveal without banking duplicates. Pull Again repeats
  the same lineup while capture mode is active.
- The button is restricted to localhost. The capture query is also host-gated.
- The public game and weighted pull table are unchanged.

Use `?marketingCapture=1&dev=0` to populate the binder while keeping other development controls
hidden. The Showcase 12 button remains visible because it is separately restricted to localhost.
Use the root URL without `marketingCapture=1` for the fresh-visitor landing image and
`#collection-grid` for the populated desktop collection image. The checked-in screenshots are
desktop product captures from 2026-09-28; refresh them from this route when the shipped layout
changes.
