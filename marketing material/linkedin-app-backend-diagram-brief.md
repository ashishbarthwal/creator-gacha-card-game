# Creator Gacha: App and Backend Architecture Diagram Brief

## Task

Create a polished, technically accurate architecture infographic for a LinkedIn portfolio post. This brief covers **only the application and backend architecture**. Do not turn it into a detailed battle-mechanics diagram; that is covered separately in `linkedin-battle-system-diagram-brief.md`, which is provided as companion context.

**Input constraint:** You will receive these two Markdown briefs but will not have access to the repository or its source code. Treat the facts and guardrails in these documents as the complete source material. Do not ask for or assume access to code, browse for implementation details, or invent details that are not stated here. If a detail is unspecified, omit it or label it as unspecified rather than guessing.

The intended audience is software engineers, recruiters, and technical peers. The image should communicate that Creator Gacha is a real, browser-first application with a deliberately small optional backend.

## Main message

**The browser owns the game and player collection. Cloudflare serves the app and coordinates online matches.**

Make it clear that:

- The deployed app is a static site using plain HTML, CSS, and native JavaScript ES modules.
- The player collection and lineup are stored in the browser.
- Quick Battle needs no Creator Gacha backend.
- The optional backend coordinates online rooms and random-opponent pairing.
- The backend does not store full collections or battle results.

## Recommended deliverable

Create one standalone architecture diagram, landscape and readable at LinkedIn feed size. A 16:9 layout is a good starting point. Provide an editable source file plus PNG or SVG when the tool supports it.

Prefer a clear system-boundary diagram over a conventional database-heavy backend diagram. Use short labels and a small legend/callouts for implementation details.

## Product context

Creator Gacha is an unofficial, browser-based fan game where YouTube channels become collectible cards. Players load a curated card set, collect cards locally, and use the browser app to play. The application has no application framework, bundler, or always-on application server.

The product has no user accounts, profiles, rankings, saved battle history, permanent server-side collections, or server-side battle simulation.

## Components to show

### 1. Player browser

Show a clearly bounded **Player Browser** containing:

- Static application: HTML, CSS, native JavaScript ES modules.
- UI: pack, collection, and arena surfaces.
- Client game logic under `src/engine/`.
- Browser adapter under `src/data/`.
- `localStorage` for collection and lineup.
- A small label that **Quick Battle runs locally**.

The collection and lineup are not uploaded to the backend.

### 2. Cloudflare Pages

Show **Cloudflare Pages** serving:

- Static application assets.
- Curated static card-set JSON.
- Pages Function endpoints.

Draw the player browser loading the app and card-set JSON from Pages. Pages is the public web host and public HTTP entry point; it is not a conventional application server.

### 3. Pages Functions

Inside or adjacent to the Pages boundary, show two public endpoints:

- `GET/POST /api/ready/:room` - match-room entry point.
- `POST /api/queue` - random-opponent queue entry point.

They are thin request routers, not the game engine. The room function validates the room ID and forwards to the corresponding Durable Object. The queue function forwards to the shared queue object. Responses use `no-store` so transient coordination responses are not cached.

### 4. Separate Cloudflare Worker

Show a distinct boundary labeled **`creator-gacha-room` Worker** containing:

- `MatchRoom` Durable Object.
- `MatchQueue` Durable Object.
- SQLite-backed Durable Object storage.

The Worker is deployed separately because a Cloudflare Pages project cannot define the Durable Object classes. It has no public `workers.dev` route; Pages reaches it through Durable Object bindings. Make that routing relationship clear:

`Browser -> Pages Function -> Pages binding -> Durable Object in Worker`

Do not draw the browser calling the Worker directly.

### 5. MatchRoom

Label it **one Durable Object instance per room ID**. Its responsibilities:

- Coordinates acceptance, lobby entry, shared team-building phase, and team locks.
- Shares final team inputs with both clients.
- Holds short-lived match coordination state and the selected five-card teams after lock.
- Deletes room storage after ten minutes.

It does not run combat and does not store accounts, full collections, or outcomes.

### 6. MatchQueue

Label it **one shared queue Durable Object**. Its responsibilities:

- Pairs waiting players; it is not skill or rating based.
- Mints and returns a shared room ID, battle seed, timestamp, seat assignment, and opponent collection size.
- Holds temporary tickets and pairing state only.
- After pairing, clients continue through the same MatchRoom flow as friend matches.

It does not store player names, IP addresses, full collections, teams, or identities.

### 7. Card-set build pipeline

Include a secondary, visually quieter **Development / data pipeline**:

`Curated channel IDs -> Node.js set-building tools -> YouTube Data API v3 -> validated static card-set JSON -> site build -> Cloudflare Pages`

The YouTube API is used by the data sourcing/build pipeline, not called by every player during normal gameplay. The shipped UI does not ask players for an API key.

## Suggested diagram structure

Arrange the main flow from left to right:

1. Player browser.
2. Cloudflare Pages assets and Pages Functions.
3. The separately deployed Cloudflare Worker.
4. Durable Objects and their temporary storage.

Put the card-set pipeline in a slim band along the bottom or top. Use a distinct visual style for build-time arrows versus runtime player traffic.

Show **two player browsers** in a small online-match inset, both connecting through Pages Functions to shared Durable Objects. Then show the final shared match inputs flowing back to both browsers. Add arrows from each browser to its own local battle engine, but keep combat detail minimal in this diagram.

## Suggested concise labels and callouts

Possible arrow labels:

- `serve static app + card set`
- `room requests`
- `queue requests`
- `route by room ID`
- `shared queue`
- `short-lived match state`
- `match setup + locked teams`
- `resolve battle locally`
- `build curated card set`

Callouts:

- `Quick Battle works without the backend`
- `No accounts or permanent server-side collections`
- `Backend coordinates online matches; browsers run gameplay`
- `Rooms expire after 10 minutes`

## Accuracy and visual rules

- Distinguish runtime traffic from development-time data building.
- Distinguish Cloudflare Pages from the separate `creator-gacha-room` Worker.
- Show Durable Objects behind Pages bindings; do not draw direct public Worker access.
- Label storage as **SQLite-backed Durable Object storage**. The Worker code uses its storage API; do not invent a SQL database product or imply SQL queries.
- Do not add PostgreSQL, Redis, a message broker, a central API server, authentication service, or generic cache.
- Do not depict an upload of a player's full collection.
- Do not depict YouTube API calls during ordinary gameplay.
- Do not claim skill-based matchmaking, anti-cheat guarantees, or server-authoritative battle results.
- Do not present Cloudflare as storing profiles or history.
- Keep the focus on the actual small backend; do not make it look like a large distributed system.

## Title and subtitle suggestion

**Creator Gacha - Application and Backend Architecture**

Subtitle: **A local-first browser game with optional Cloudflare match coordination**

## Source boundary and output instructions

The only source material available to you is this brief and its companion `linkedin-battle-system-diagram-brief.md`. No repository files or code are available. Use the details above as authoritative for the requested graphic. The companion brief explains the client-side battle flow; do not duplicate its mechanics in this app/backend diagram beyond showing that gameplay remains in the browser.

Produce the diagram itself, not a new written architecture specification. Keep any explanation minimal and use the space for the visual. Do not add implementation details, services, data stores, endpoints, security claims, or deployment behavior beyond what these two briefs state. If a visual detail cannot be supported by the briefs, leave it out.
