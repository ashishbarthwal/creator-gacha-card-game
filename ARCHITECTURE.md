# Creator Gacha Architecture

This is the shortest path into the codebase. Creator Gacha is a static, browser-first game with
one small coordination backend for cross-device battles. The browser owns the collection and
resolves the game; the server only helps two browsers meet and agree on match inputs.

## System at a glance

```mermaid
flowchart LR
  Set[Curated Core Set\nstatic JSON] --> Browser
  Browser[Browser app\nHTML + CSS + ES modules] --> Storage[Local collection\nand lineup]
  Browser --> Engine[Pure game engine\npulls, stats, fairness, battle]
  Browser --> Pages[Cloudflare Pages Functions]
  Pages --> Room[Short-lived match room\nDurable Object]
  Pages --> Queue[Random-opponent queue\nDurable Object]
  Room --> Browser
  Queue --> Room
```

The architecture keeps three kinds of code separate:

| Layer | May touch | Main locations |
|---|---|---|
| Pure engine | Plain data only | `src/engine/` |
| Data adapters | Network and external data shapes | `src/data/`, `functions/` |
| UI | DOM, input, motion, and accessibility | `src/ui/`, `styles.css`, `index.html` |

`src/main.js` is the composition root. It introduces these layers through callbacks and shared
state rather than allowing UI modules to import each other freely.

## Pull and collection flow

```mermaid
flowchart TD
  Load[Load and validate Core Set] --> Pool[Card pool]
  Pool --> Pull[Weighted rarity pull]
  Pull --> Bank[Persist result locally]
  Bank --> Reveal[Bounded reveal]
  Reveal --> Collection[Searchable collection]
  Collection --> Inspect[Card admire view]
  Collection --> Arena[Five-card team builder]
```

The pull is decided and saved before its animation starts. Rarity and battle statistics are pure,
deterministic derivations, so every surface reads the same card identity and numbers.

## Multiplayer boundary

```mermaid
sequenceDiagram
  participant A as Player A browser
  participant S as Short-lived room
  participant B as Player B browser
  A->>S: join and ready state
  B->>S: join and ready state
  A->>S: lock five-card team
  B->>S: lock five-card team
  S-->>A: shared match inputs
  S-->>B: shared match inputs
  A->>A: resolve battle locally
  B->>B: resolve the same battle locally
```

There are no accounts, permanent server-side collections, leaderboards, or stored battle results.
Rooms expire, and Quick Battle never needs the backend.

## Public data and repository rules

- The committed catalog contains channel IDs and curation metadata, not hydrated statistics.
- Generated sets under `sets/built/` are excluded from Git history and refreshed for deployment.
- API keys, Cloudflare tokens, local state, reports, and assembled `_site/` output are ignored.
- Browser persistence uses positive allowlists for stored channel fields.
- Creator removals are recorded in the denylist and reapplied during future set builds.

## Detailed documents

- [Frontend architecture](FRONTEND-ARCHITECTURE-05-09-2026.md) covers page surfaces, card
  rendering, reveal behavior, persistence, responsive design, and the arena state machine.
- [Backend architecture](BACKEND-ARCHITECTURE-05-09-2026.md) covers Pages Functions, Durable
  Objects, room and queue lifecycles, deployment, and privacy boundaries.
- [Hero showcase architecture](HERO-SHOWCASE-ARCHITECTURE.md) covers first-visit chase cards and
  returning-player rankings.
- [V2 UI work package](WP-V2-UI-OVERHAUL.md) records the redesign decisions and verification.
- [Design decisions](DECISIONS.md) is the long-form decision log.

For setup and repository conventions, see [CONTRIBUTING.md](CONTRIBUTING.md).
