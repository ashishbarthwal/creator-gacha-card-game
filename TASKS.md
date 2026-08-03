# Work Packages — checklist

Working checklist. **Rationale lives in [DECISIONS.md](DECISIONS.md), history in the git log** —
this file is only "what is done, what is next". A WP is for **architectural** work: a new seam,
a new guarantee, a new capability. Recurring work goes under Miscellaneous and is never tracked
individually.

**Now:** LIVE at https://creator-gacha.pages.dev (moved off Netlify 2026-08-03 — free-tier credits
don't cover this project's deploy cadence) · 24,359 candidates.
**The live copy serves the 24,251-card deck; 23,539 is built and committed but NOT yet uploaded** —
the deploy needs an authenticated `wrangler` session on Ash's machine:
`npx wrangler pages deploy _site --project-name=creator-gacha --branch=main && node tools/record-deploy.js`.
**Next:** WP12 — the battle system. The **pure engine is built and tested** (5v5, auto-resolved,
power-matched AI); there is **no UI yet**, so it cannot be played. See below.

---

## Open

### WP10 — Deploy + README
- [X] **Netlify direct upload + live link.** LIVE at https://creator-gacha.netlify.app
      (2026-08-03). `_headers` ships inside `_site` rather than living in `netlify.toml` —
      a direct upload has no build step to resolve the toml's `[[headers]]`, so they would
      have applied to nothing. Brotli confirmed on the wire.
- [X] **Moved to Cloudflare Pages, same day.** Netlify's free tier is a one-time 300-credit
      grant (~15/deploy) that does not refill; this project's actual cadence — a manual deploy
      per fix plus a weekly automated refresh — burns through it before it would expire.
      Cloudflare Pages' `_headers` syntax is byte-identical to Netlify's, so `_headers` and
      `build-site.js` needed no changes; only the upload command did
      (`wrangler pages deploy` in place of `netlify-cli deploy`). Verified every header rule
      and the card count match exactly before cutting the workflow over. The old Netlify
      site was deleted the same day rather than kept as a rollback — see DECISIONS.md.
- [X] **Series 1 as the default selection.** The demo set still seeds first (synchronous,
      offline-safe) and now hands over the moment a real set is offered, unless the visitor
      already picked one themselves.
- [X] Deployment structure: built sets arrive through their own `sets/built/index.json`,
      written beside them and uploaded in the same folder.
- [X] **Privacy policy page** + **Terms of service page** — both shipped, linked in the
      footer, and pinned by a new build guard that refuses to publish a page linking to a
      page that did not ship.
- [X] **The weekly refresh runs in GitHub Actions**, not on Ash's machine
      (`.github/workflows/refresh.yml`). A laptop cannot carry a compliance deadline: it
      cannot run while off and cannot exist once dead. Builds the set in the runner, uploads
      straight to the CDN, commits only the ledger, and emails a report every run — with the
      card count and its delta first, because "success" is what a broken run says too.
      The local Windows task is unregistered; `tools/schedule-refresh.js` remains as a
      documented fallback.
      **Ash's remaining step: add the four repository secrets.**
- [X] **`npm run runs` — check the refresh from outside the refresh.** Email cannot report a run
      that never happened: no run, no steps, no `if: failure()`, no mail — and the build lands in
      the runner, so the laptop looks identical either way. Verdicts separate `late` (GitHub's
      scheduler is routinely slow; do nothing) from `missed` from `never ran`.
- [X] **The pull screen scrolls.** A fixed footprint in a fixed height rendered cards at 138px on
      a 393px phone, below the width the card's own clamp() scale supports — stats under the
      avatar, handles sheared without an ellipsis. Overlay scrolls, 2/3/5 columns by viewport,
      sticky Done, and the card sheds detail under 190px instead of shearing it.
- [X] **README screenshot** — `docs/pull-reveal.png`, a x10 result showing all five bands
      (N through UR) in their tier frames. Captured from the bundled demo set, so the shot
      carries no real creator's face or stats — the one screenshot that can be committed.

### WP9 — remaining
- [ ] **Browser check on persistence** — not testable from the suite (localStorage + DOM).
- [ ] **Roster depth for Series 2.** Rotation needs ~7x the per-printing count. **SSR still
      binds, at 81.25 lw** (325 cards) against SR's 261 and R's 279. UR is world-supply capped
      and will never be met. The number moved DOWN from 99.0, and not from a sourcing failure —
      the institution thinning pass (2026-08-03) cut SSR 396 → 318, because the big-company
      bucket lands hardest exactly where the recognizable institutional channels are. A
      `--tier legends` Magic Search run put 7 back (318 → 325); the cheap routes remain
      exhausted, so real gains still need curated rosters or non-anglophone territories.

### WP12 — Battle system — engine done, no UI
5v5, auto-resolved, against an AI matched to the player's own team power. Client-side only, so
locked decision 3 is untouched. Rationale and the three measured failures behind the design are
in DECISIONS.md.
- [X] **`engine/battle-stats.js`** — channel → four size-free axes → HP/ATK/DEF/SPD + class.
      Size buys a compressed *budget*; shape decides where it goes, so rarity does not decide
      the fight. Attack is flat across all five bands on the live deck.
- [X] **`engine/battle.js`** — turn resolution, seeded RNG, returns an event log the UI replays
      (the same shape the reveal already uses: decide first, animate a settled result).
- [X] **`engine/opponent.js`** — power-matched AI deck at even / uphill / favoured.
- [X] **46 tests**, including a balance block that asserts the design goals rather than hoping:
      no class over half the deck, attack independent of size, and a large share of small cards
      out-rating the median giant (33.5% on the live deck).
- [X] **`publishedAt` now ships** — it was already inside the `snippet` every hydrate fetches and
      the allowlist was discarding it. Zero extra quota. Two axes are dead without it.
- [ ] **A rebuild is needed before the numbers are real.** The live set predates `publishedAt`,
      so maturity and cadence are on their documented fallbacks until the next `npm run deploy`.
      Tuning against the real ages is the first job after that.
- [ ] **UI** — team picker, the battle screen, replaying the event log. Nothing is playable yet.
- [ ] Decide whether individual matchups should stay deterministic (see DECISIONS.md — currently
      a fight is decided by composition, not luck, which is what auto-battle means).

### WP11 — Procedural Creator Emblems  (proposed, not started)
Replaces the creator's profile picture with a deterministic generated emblem, dissolving the
likeness problem and every avatar bug at once. `engine/emblem.js` (WP8) is the seed, not the
work. Shared with Repo Gacha, which also cannot use real logos.
- [ ] Semantic classification (build-time; store derived TAGS only, never raw descriptions)
- [ ] Deterministic recipe from channel id + tags, pure and testable
- [ ] Renderer + a small starter asset library (~8 themes)
- [ ] Animation scoped to reveal/inspect only
- [ ] **Conflict to resolve first:** the design doc says rarity should NOT derive from
      subscriber count. That is the project's central mapping. The motivation — "small
      creators deserve beautiful cards" — is satisfied by decoupling *emblem richness* from
      rarity instead, which costs nothing.

---

## Miscellaneous — recurring, never tracked individually

These happen repeatedly and do not earn a work package. Do them, note anything surprising in
DECISIONS.md, move on.

- **Sourcing runs.** The Wikidata P2397 sweep is the default route now (~0.02 units per
  candidate, `catalog/reach-5.txt`); public lists for SR/SSR/UR (~1.2); keyword search for the
  sub-100K commons only (~11.5). See `catalog/legends.txt`, `reach*.txt`.
- **Curation exclusions.** `catalog/excluded.txt` — editorial, revisable, and never to be
  confused with the opt-out denylist.
- **Printing size changes** and rebuilds at the 25-day cadence.
- **Card visuals, CSS, page layout, copy tweaks.**
- **Keyword vocabulary tuning** (`KEYWORD_SEEDS`, `KEYWORD_MODIFIERS`).
- **Roster handle fixes** — ~10% of guessed handles fail at 1 unit each.

---

## Gate — all closed (2026-07-31)

Cleared before any deploy to real users.

- [X] **Legality** — closed by accepting a bounded risk, not eliminating one: no monetization,
      unofficial disclaimer, working 7-day opt-out, India exclude, and the WP8 avatar flag
      keeping it reversible. Deliberately NOT claimed: that a lawyer signed off, or that the
      risk is zero. Full record in DECISIONS.md, "Launch posture".
- [X] **Rename off the YouTube trademark** — now Creator Gacha; repo `creator-gacha-card-game`.
- [X] **Strip `country` from shipped sets** — absent by construction via a positive allowlist,
      pinned by two tests (object and serialized bytes).

---

## Done

One line each. The reasoning is in DECISIONS.md; the receipts are the `wpN` tags and Releases.

- [X] **WP0 — Split the monolith** (`wp0`). Pure core, gacha engine, data seam, ui, wiring.
- [X] **WP1 — Test suite** (`wp1`). Vitest, CI on every push, badge, self-contained HTML reports.
- [X] **WP2 — Footer.** Buy Me a Coffee (never wired to game state) + not-affiliated disclaimer.
- [X] **WP3 — Holographic cards.** Rarity-gated tilt/holo; grew into the metal-bevel tier
      frames, ringed avatar centrepiece, and the card inspector.
- [X] **WP4 — Card sets** (`wp4`). Sets adapter behind the seam, manifest, picker, bundled demo
      set. Pull became two-stage (band first) so drop rates follow the weight table.
- [X] **WP5 — Magic Search** (`wp5`). Pure sourcing core, live fetch, CLI, in-page trigger.
- [X] **WP6 — Discovery quality** (`wp6`). Seeded query jitter, keyword generator, tier buttons
      that steer the search rather than filter it.
- [X] **WP7a — Creator opt-out.** Footer contact + 7-day removal, no identity check. Shipped
      deliberately *before* the first real-creator set.
- [X] **WP7 — Set-build pipeline** (`wp7`). Candidate DB as committed source of truth (ids and
      our tags only, never channel data), `build-set.js`, band starvation floor, curated
      sourcing route for the top bands, region exclude measured at 8.6-34%.
- [X] **WP8 — Production hardening** (`wp8`). Dev affordances gated, runtime dev/prod config,
      avatar-source flag (the switch that keeps the launch reversible).
- [X] **WP9 — The decks + persistence** (`wp9`). Band cap so a chase card is reachable, pins,
      seeded printing rotation (and the fix after it turned out cosmetic), localStorage
      collection with reconciliation, refresh alarm (warn 25 / refuse 30), curation exclude,
      list-based sourcing.
- [X] ~~Share / card-to-PNG~~ — **built, then scrapped before shipping.** Exports put copies
      beyond the reach of the opt-out. Deleted rather than hidden behind a flag.

---

## Parked

- [ ] Battles · decks · pity · accounts
- [ ] **Repo Gacha** — the same engine over open-source repos. `external-docs/repo-gacha.md`.
      Genuinely smaller: most of the legal machinery CG needs does not apply.
