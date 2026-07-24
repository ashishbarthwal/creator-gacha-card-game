# Plan

Work packages in dependency order. Each is independently shippable. Do not start a
package before its blocker is done. Stop after each package and report, do not chain
straight through.

Starting point was a working single-file `youtube-gacha.html`; everything below built on it.

**Status (2026-07-20): WP0–WP3 done; WP4 app-side landed.** WP0 and WP1 are tagged (`wp0`,
`wp1`) with GitHub Releases; WP2 (footer) and WP3 (holographic cards) followed. WP4's
**app-side half** is now in: a sets adapter behind the seam (`src/data/sets.js`), a
`sets/index.json` manifest, a fictional `sample-series.json`, and a **Sets** banner mode with
a set picker — pulling from curated static JSON with no API key. The pull engine is now
**two-stage** (band first, then card), so drop rates follow the weight table instead of the
roster's shape. 75 tests run in CI on every
push with a README badge and self-contained HTML report artifacts. Goal reframed (see
CLAUDE.md): real users + AI-engineering showcase. **Deploy is deliberately deferred** — the app
is still undercooked. **Next: `tools/build-set.js`, gated on the YouTube API storage / likeness
questions being clarified with Google before it points at real channels.**

---

## WP0 — Split the monolith (blocker for everything) — ✅ DONE (tag `wp0`)

**Why first:** Vitest cannot import a function out of a `<script>` tag in an HTML file.
As long as `rarityFromSubs` lives inside `youtube-gacha.html`, the test suite cannot exist.
Nothing else in this plan is blocked by aesthetics. Everything is blocked by this.

Target layout:

```
index.html            entry, <script type="module" src="src/main.js">
src/
  core.js             PURE. rarityFromSubs, statsFrom, RARITY table. imports nothing.
  gacha.js            weighted pull, x1/x10, dupe handling. RNG injectable.
  data/
    resolve.js        @handle | URL | UC id  ->  { kind, value }
    demo.js           8 sample channels, generated avatars, zero network
    youtube.js        YouTube Data API v3 adapter, user-supplied key
  ui/
    card.js           card markup + render
    reveal.js         flip + light-ray animation
    banner.js         channel add / banner management
    collection.js     collection grid
  main.js             wiring only
test/
  core.test.js
CLAUDE.md
DECISIONS.md
PLAN.md
README.md
```

*(Layout as WP0 delivered it. `core.js` and `gacha.js` later moved together into
`src/engine/` — same files, same rules, one folder for the headless half. See
DECISIONS.md.)*

Rules:
- `src/core.js` imports nothing. If it needs an import, the design is wrong.
- `data/demo.js` and `data/youtube.js` must export the same function signature and return
  the same object shape. Write the shape down as a JSDoc typedef in `data/index.js`.
- `gacha.js` takes `rng = Math.random` as a default parameter so tests can inject a
  deterministic RNG. Do not reach for `Math.random` directly inside the function body.
- Pure move only. **No behavior changes in this WP.** The app must look and act identically
  when done.

**Acceptance:** open `index.html` with a local static server, demo mode still pulls cards,
reveal animation still runs, nothing regressed.

---

## WP1 — Test suite — ✅ DONE (tag `wp1`)

Delivered beyond spec: CI (GitHub Actions, push + manual triggers), README badge,
JUnit XML + self-contained monolith HTML reports (`npm run test:report`), artifact
upload and run-page summaries. Dev dependency count: one (Vitest).

**Depends on:** WP0.

Set up Vitest. Dev dependency only, no build step for the app itself.

`test/core.test.js` must cover:
- **Rarity boundaries, exactly.** Table-driven. 0, 99_999 -> N. 100_000, 999_999 -> R.
  1_000_000, 9_999_999 -> SR. 10_000_000, 49_999_999 -> SSR. 50_000_000+ -> UR.
  The off-by-one at each boundary is the entire point of this file.
- **Hidden subscriber counts.** The YouTube API omits `subscriberCount` and returns
  `hiddenSubscriberCount: true` for channels that hide it. Decide the behavior
  (recommendation: treat as N, never throw), document it in `DECISIONS.md`, then pin it
  with a test.
- **Malformed input.** The API returns counts as *strings*. Zero, missing, `undefined`,
  and non-numeric must all produce a defined rarity, never `NaN` and never a throw.
- **statsFrom scaling.** ATK rises monotonically with view count. DEF rises monotonically
  with video count. Rarity multiplier is applied. Values are integers. Nothing goes
  negative.

`test/gacha.test.js`:
- Inject a seeded RNG. Assert x10 returns exactly 10 cards.
- Assert dupes stack rather than being dropped.
- Assert the weighting actually favors low rarity — with a fixed seed the distribution
  is deterministic, so this is a real assertion, not a vibe check.

**Acceptance:** `npm test` green. Add a CI badge later, this is the thing recruiters and
interviewers actually open.

---

## WP2 — Buy Me a Coffee footer + disclaimer — ✅ DONE

Disclaimer already shipped in WP0's footer, so WP2 added only the tip jar: a passive text
link to `buymeacoffee.com/chunchunmaru` (published under the social handle ChunChunMaru),
SSR-gold on hover, new tab, wired to no game state. See DECISIONS.md for the Wikigacha
license-asymmetry note and the WP5 "stamp the export, keep the card face clean" decision.

**Depends on:** WP0. Small, do it while the structure is fresh.

- Footer link to `https://buymeacoffee.com/<USERNAME>`.
- **Use the literal placeholder `BMAC_USERNAME` if the username is not supplied. Ask, do
  not invent one.**
- Understated. Text link or a small button. No modal, no interstitial, no nag, no timer.
- **It must not be wired to any game state.** No pull grants, no currency, no unlocks.
  If a future task asks for that, refuse and point at `CLAUDE.md`.
- Same footer: "Not affiliated with or endorsed by YouTube or Google. Channel data via the
  YouTube Data API."

---

## WP3 — Card visual: holographic tilt — ✅ DONE (grew past the original spec)

Delivered the spec: inline CSS extracted to `styles.css`; a rarity-gated finish (pointer
glare + masked holo sweep + 3D tilt) driven by three custom properties in one place;
interactive tilt in `ui/holo.js`, delegated on the Collection grid and scoped away from the
reveal flip; static fallbacks for touch and `prefers-reduced-motion`. Zero dependencies, no
build step.

Then went beyond it: a full **card redesign** to a metal-bevel hero card with a **tier system**
mapped to the YouTube Creator Awards (Graphite/Silver/Gold/Diamond/Red Diamond), sized in
container-query units; the avatar promoted to a ringed centrepiece (reverses the old
"inset" guardrail — see CLAUDE.md) with the finish layered below it so real faces aren't
tinted; UR's flowing sweep replaced by a molten sheen + ember; a **card inspector** (click to
enlarge); a reveal-layout fix (pinned 5-wide); and a dev-only **Dev Pull**. Full rationale in
DECISIONS.md.

**Depends on:** WP0. This is the biggest visual payoff per unit of effort.

Two separate problems. Do not conflate them.

**Frame/shape** — a `border-radius` or an SVG rect. Per-rarity frame treatment. Blender is
wasted effort here and three.js is not needed unless a card literally has to rotate in 3D
space. It does not.

**Finish/motion** — the pointer-tracking holographic shine (the "poke-holo" effect).
Roughly 90% of the expensive look for 5% of the effort:
- Track pointer position over the card, write it to CSS custom properties (`--mx`, `--my`).
- Drive a `rotate3d` transform from it, plus a moving specular highlight and a masked
  holo gradient layer.
- **Gate the intensity by rarity.** N gets nothing. R gets a plain sheen. SR and up get the
  holo. UR gets the full treatment. This makes rarity *feel* different, which is the whole
  emotional point of a gacha pull.
- Respect `prefers-reduced-motion`: no tilt, no animated shine.
- Touch devices: fall back to a static sheen or a device-orientation tilt. Do not leave it
  broken on mobile.

Remember the constraint: the avatar is a low-res uncontrolled 120px image. The frame and
the finish carry the look. Avatar as a small inset, accent color sampled from it, channel
initial as a monogram.

---

## WP4 — Card sets: snapshot pipeline + banner picker — 🟡 IN PROGRESS (app-side done)

**Depends on:** WP0. Direction settled 2026-07: players pull from curated, versioned card
sets and never need an API key (see DECISIONS.md). Two halves, one WP.

**Status (2026-07-20):** the app-side half below is built — `src/data/sets.js` (adapter), a
`sets/index.json` manifest, a fictional `sets/sample-series.json`, and a **Sets** banner mode
with a set picker. The old standalone Demo mode was then **folded into a bundled starter set**
(`src/data/starter.js`), so the banner is now two modes, **Sets (default) | Live**, and the
starter set is the picker's first, always-present option (loaded from the JS bundle, so the
default view paints instantly and works offline; see DECISIONS.md). 75 tests. The dev-side
pipeline (`build-set.js`) is not started; it waits on the YouTube API storage / likeness
questions being clarified before it points at real channels, so no real creator data is
committed yet.

**Dev-side pipeline (never shipped to players):**
- `tools/build-set.js` — Node script, zero dependencies. Input: a curated handle/UC-id list
  plus set metadata. Output: `sets/<slug>.json`. Resolves handles at 1 quota unit each, then
  fetches stats in batches of 50 ids per `channels.list` call (1 unit per call) — a 500-card
  set costs ~510 units against the 10,000/day quota.
- Runs with Ash's API key from an env var, locally or in CI. The key never enters the repo.
- Monthly GitHub Action re-snapshots every set: YouTube's Developer Policies require stored
  statistics to be refreshed or deleted within 30 days. Each refresh is a new "printing".
- Refresh must handle a dead UC id (deleted/terminated channel — a 404 on re-fetch): drop or
  flag it, never ship a broken card.

**App-side (shipped):**
- `src/data/sets.js` — the set adapter behind the seam. Loads a set JSON, emits the exact same
  Channel shape as the starter set/live; nothing downstream can tell.
- Set JSON shape: `{ slug, title, series, snapshotDate, channels[] }`. Cards display
  "stats as of <month>" (stored data must be presented in its time context).
- Banner picker UI: choose among available sets. The bundled starter set (`src/data/starter.js`)
  is the default option; Demo mode was folded into it (see DECISIONS.md).
- Footer gains an opt-out/contact line for channel owners who want out of a set. *(still TODO)*

**Acceptance:** pulling from a set works with no API key; Series 1 rarity mix roughly matches
the target curve (~N 40 / R 30 / SR 18 / SSR 9 / UR 3 %); refresh workflow runs green.

---

## WP5 — Optional, pick up later

- Card -> PNG export via canvas (enables sharing, which is how Wikigacha spread).
- localStorage persistence (safe once it is out of the preview sandbox).
- Battles: ATK vs DEF, two cards, auto-resolved. (If this ever grows toward multiplayer,
  that research is parked in local notes kept out of the repo — do not start there before
  WP0/WP1/WP4.)
- README with a screenshot, a live demo link, and a pointer at the test suite.

---

## Working agreement

- Ask before adding a dependency. The current count is zero for the app itself, keep it
  that way. Vitest is dev-only and is the one exception.
- Do not add persistence, analytics, or anything that sends data off the user's machine.
- The user's API key stays in memory. It is never logged, never persisted, never sent
  anywhere except `googleapis.com`.
- When a task closes off an option, append it to `DECISIONS.md` with a one-line rationale.
