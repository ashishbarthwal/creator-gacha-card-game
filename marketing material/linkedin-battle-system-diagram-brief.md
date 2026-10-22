# Creator Gacha: Battle System Architecture Diagram Brief

## Task

Create a polished, technically accurate architecture infographic for a LinkedIn portfolio post. This brief covers **only the battle system and online match flow**. The broader app/backend deployment topology is covered separately in `linkedin-app-backend-diagram-brief.md`, which is provided as companion context.

**Input constraint:** You will receive these two Markdown briefs but will not have access to the repository or its source code. Treat the facts and guardrails in these documents as the complete source material. Do not ask for or assume access to code, browse for implementation details, or invent details that are not stated here. If a detail is unspecified, omit it or label it as unspecified rather than guessing.

The intended audience is software engineers, recruiters, and technical peers. The diagram should make the architecture's defining point easy to understand at a glance:

> **Cloudflare coordinates online matches. Each player's browser runs the battle.**

## Recommended deliverable

Create one standalone landscape diagram, legible at LinkedIn feed size. A 16:9 layout is a good starting point. Provide an editable source file and PNG or SVG if the diagram tool supports both.

The visual should make the player browsers and their local engines prominent. The backend should appear as a narrow coordination bridge between clients, not as the central game server.

## Battle system overview

Creator Gacha battles are five-versus-five, auto-resolved fights. Strategy happens mainly through selecting a team and formation. The pure JavaScript engine is headless: no DOM, network, or I/O. It resolves the battle from plain data with seeded randomness and returns an event log. The UI replays that settled log for presentation.

The same inputs and seed produce the same battle in both players' browsers. The backend does not calculate combat, choose a winner, or persist results.

## Components to show inside each player browser

Draw two browser boundaries for an online match, each with a compact representation of:

- **Arena UI / team builder** (`src/ui/battle.js`) - handles match flow, team selection, and replay presentation.
- **Local collection** - owned cards stored in that player's browser.
- **Fairness selection** (`src/engine/fairness.js`) - when collection sizes differ beyond the configured ratio, returns a temporary rarity-weighted eligible slice. It does not mutate the saved collection.
- **Battle stat derivation** (`src/engine/battle-stats.js`) - the single derivation from channel data into combat stats.
- **Element matchups** (`src/engine/element.js`) - derives element behavior and matchup modifiers.
- **Opponent builder** (`src/engine/opponent.js`) - relevant to Quick Battle, where it builds the local AI team.
- **Seeded battle resolver** (`src/engine/battle.js`) - creates the teams, resolves the fight, and returns an event log.
- **Event-log replay** - UI presentation of the already-resolved events.

These are conceptual responsibilities, not independent services. Keep modules grouped under one **Browser / Pure Game Engine** boundary instead of drawing them as network services.

## Compact combat detail

If space allows, show a small inset inside the resolver box or as a bottom legend. Include only enough detail to communicate that this is a real rules engine:

- Team size: five.
- Formation: two front slots and three back slots.
- Stats: HP, ATK, DEF, SPD, MOM.
- Tactical inputs: class abilities, elements, formation, speed, momentum, and seeded damage variance.
- Output: deterministic event log, replayed by the UI.

Avoid listing formulas or every class ability. The diagram is architecture-focused, not a complete battle rules infographic.

## Quick Battle path

Show a clear, fully local path inside one browser:

`Local collection + current card pool -> local AI team builder -> local battle resolver -> event log -> UI replay`

Quick Battle does not call Cloudflare, the Pages Functions, a Durable Object, or YouTube.

## Friend match path

Show two browser clients and a shared match room:

1. Challenger creates a challenge code containing shared match setup values, including a battle seed and pinned time. The challenge does not carry a prebuilt team.
2. Both browsers derive the same room ID from the challenge information.
3. The defender accepts through `POST /api/ready/:room`.
4. Cloudflare Pages Function forwards the request through its `ROOM` binding to the one `MatchRoom` Durable Object instance for that room ID.
5. The room coordinates acceptance and the lobby decision gate. Both sides enter the shared team-building phase; its clock starts only after both have entered.
6. Each player independently builds and locks a five-card team. The room shares the final team inputs with both clients.
7. Each browser resolves the fight locally using the same teams, seed, and pinned timestamp.
8. Each UI replays its locally produced event log.

Emphasize that the room coordinates match phases and exchanges final team inputs. It does not simulate combat or send the outcome.

## Random-opponent path

Show the queue as setup that feeds into the same room flow:

1. Each browser sends a temporary queue ticket and collection size to `POST /api/queue`.
2. The Pages Function routes both requests to the single shared `MatchQueue` Durable Object instance through its `QUEUE` binding.
3. The queue pairs players and mints one room ID, seed, and timestamp, plus seat assignments and each opponent's collection size.
4. Both clients proceed into the existing `MatchRoom` flow. There is no second battle protocol.
5. Once both teams are locked, both browsers resolve locally.

The queue is not ranked, skill-based, or rating-based matchmaking.

## Backend components to include

Keep this group compact and label it **Optional online match coordination**:

- **Cloudflare Pages Function - ready endpoint**: public route into a room.
- **Cloudflare Pages Function - queue endpoint**: public route into the queue.
- **Cloudflare Worker `creator-gacha-room`**: separately deployed because Pages cannot define Durable Object classes; no public `workers.dev` route.
- **`MatchRoom` Durable Object**: one instance per room ID; serializes room state and coordinates the online room lifecycle.
- **`MatchQueue` Durable Object**: one shared instance; atomically pairs waiting players and mints common setup values.
- **SQLite-backed Durable Object storage**: holds temporary coordination state through the Durable Object storage API.

Pages Functions are the public entry points; the browser does not call the Worker directly. Both endpoints return uncached responses.

## What the backend holds

Represent the data boundary with a small callout rather than a large database schema:

- Collection sizes for fairness setup.
- Temporary room phase and seat state.
- Final five selected channel objects per side, after each team is locked.
- Queue tickets, pairing state, shared room ID, seed, timestamp, and seat data.

Lifetimes:

- A match room deletes its state after ten minutes.
- Queue wait tickets expire after about 25 seconds without a heartbeat.
- Pairing tickets are readable for up to 120 seconds to support retries.
- Idle queue storage is cleared after five minutes.

Do not imply that queue tickets identify people. The tickets are temporary nonces/slots.

## Suggested layout

Use three horizontal regions or swimlanes:

1. **Quick Battle - local path**: one browser with collection, AI builder, resolver, and replay.
2. **Online match setup**: two browsers connected through Pages Functions to queue/room Durable Objects.
3. **Battle execution**: after shared teams and seed return to each browser, split into two parallel local resolver paths with matching event-log outputs.

A small Cloudflare grouping can contain Pages Functions, the Worker, both Durable Object types, and temporary storage. Keep all client-side engine components inside the browser boxes.

Use a solid style for local data and computation. Use a contrasting/dashed style for optional online coordination. Make the two local battle resolvers visually parallel, emphasizing that neither is server-hosted.

## Suggested labels and callouts

Possible arrow labels:

- `challenge code: shared seed + time`
- `join with ticket + collection size`
- `mint shared room + seed + clock`
- `accept and enter lobby`
- `lock five-card team`
- `share final team inputs`
- `resolve independently`
- `replay local event log`

Callouts:

- `Quick Battle: no backend required`
- `Same teams + seed + pinned time -> same fight`
- `Backend coordinates inputs, not outcomes`
- `Full collections stay in each browser`
- `No accounts | No stored results`

## Accuracy and visual rules

- Do not draw a server-side battle engine or winner authority.
- Do not draw battle results traveling to or being persisted by the backend.
- Do not draw full player collections being uploaded.
- Do not describe the random queue as skill/rating matchmaking.
- Do not imply strong anti-cheat or server validation of collection ownership.
- Do not add accounts, profiles, rankings, leaderboards, or match history.
- Do not add PostgreSQL, Redis, a message broker, or a separate caching tier.
- Use **SQLite-backed Durable Object storage**, not a standalone SQL database.
- Keep Cloudflare Pages Functions and the separate Worker distinct.
- Route browser backend calls through Pages Functions and bindings; do not depict direct public Worker calls.
- Keep the core engine visually inside each player browser.
- Do not suggest YouTube is called during combat or ordinary gameplay.

## Title and subtitle suggestion

**Creator Gacha - Battle System Architecture**

Subtitle: **Cloudflare coordinates the match. Each browser runs the battle.**

## Source boundary and output instructions

The only source material available to you is this brief and its companion `linkedin-app-backend-diagram-brief.md`. No repository files or code are available. Use the details above as authoritative for the requested graphic. The companion brief supplies the deployment boundaries and Cloudflare routing; use it to keep the backend placement accurate.

Produce the diagram itself, not a new written architecture specification. Keep any explanation minimal and use the space for the visual. Do not add implementation details, services, data stores, endpoints, security claims, or deployment behavior beyond what these two briefs state. If a visual detail cannot be supported by the briefs, leave it out.
