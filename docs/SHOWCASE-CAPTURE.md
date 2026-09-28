# Local Showcase Capture

The repository includes a deterministic, development-only ten-card showcase for screenshots and
README assets. It makes visual comparison repeatable without changing public pull odds.

## Open the capture view

Build the static site from the current local set, start its server, then open:

```text
npm run build:site
npx serve -l tcp://127.0.0.1:4174 _site
http://localhost:4174/?readmeCapture=1&dev=0
```

The query is honoured only on `localhost`, `127.0.0.1`, or `::1`. It does three presentation-only
things:

1. fills the in-memory collection with the curated ten-card lineup;
2. limits collection-grid star fields to RUBY and UR so a static image stays readable;
3. exposes the normal development-only **Showcase 10** control.

The current lineup is MrBeast, Stokes Twins, Cristiano Ronaldo, Taylor Swift, Markiplier,
Marques Brownlee, Rihanna, Skrillex, The Beatles, and Austin Evans. It spans RUBY, UR, SSR, and
SR card treatments.

## Safety properties

- The capture collection is in memory and does not replace the browser's saved collection.
- Pressing **Showcase 10** opens the normal reveal presentation without banking duplicates.
- The mode cannot activate on the deployed hostname.
- The public game and weighted pull table are unchanged.

Use the root URL for the fresh-visitor landing image and `#collection-grid` for the populated
desktop collection image. The `dev=0` override keeps local-only pull controls out of the capture.
The checked-in screenshots are desktop product captures from 2026-09-28; refresh them from this
route when the shipped layout changes.
