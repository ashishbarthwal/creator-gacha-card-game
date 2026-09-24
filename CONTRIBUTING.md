# Contributing to Creator Gacha

Creator Gacha is a personal portfolio project with a public codebase. Issues and focused pull
requests are welcome. The repository has no reuse license, so public source access does not grant
permission to republish the game or its assets.

## Local setup

Install the development dependency and start the Pages environment:

```bash
npm install
npm run build:set
npm run dev
```

The built Core Set is intentionally gitignored. Supply `YOUTUBE_API_KEY` in your environment, or
copy `config.local.example.js` to `src/config.local.js` and replace the placeholder in that
ignored file before running `npm run build:set`.

For work that exercises the cross-device room and matchmaking queue, run the Durable Object
worker in a second terminal:

```bash
npm run dev:room
```

For static UI work where multiplayer is irrelevant:

```bash
npm run dev:static
```

## Before opening a pull request

```bash
npm test
npm run build:site
```

The test suite covers the pure engine, data adapters, collection persistence, challenge-code
round trips, room lifecycle, queue behavior, and balance invariants. The site build also applies
the deployment guards.

## Where changes belong

- Put deterministic rules and calculations in `src/engine/`.
- Put network and format adapters in `src/data/`.
- Put DOM rendering and interaction in `src/ui/`.
- Wire modules together in `src/main.js`.
- Keep card presentation in the shared renderer; do not create a separate card design for one
  screen.
- Preserve reduced-motion behavior and keyboard access when adding visual effects.

## Data and privacy constraints

Do not commit any of the following:

- `.env` files or API credentials;
- `sets/built/` or other hydrated YouTube statistics;
- `_site/`, `.wrangler/`, reports, or local browser state;
- creator data outside the existing allowlisted formats.

The generated set is intentionally absent from Git history. A permanent historical copy would
conflict with the refresh policy and make creator removals incomplete.

## Useful reading

Start with [ARCHITECTURE.md](ARCHITECTURE.md), then use the detailed frontend or backend document
for the part of the system you are changing. Visual contributors should also read
[WP-V2-UI-OVERHAUL.md](WP-V2-UI-OVERHAUL.md).
