# Work Packages — checklist

Working checklist. **Rationale lives in [DECISIONS.md](DECISIONS.md), history in the git log** —
this file is only "what is done, what is next". A WP is for **architectural** work: a new seam,
a new guarantee, a new capability. Recurring work goes under Miscellaneous and is never tracked
individually.

**Now:** deck 1,442 cards · 1,769 candidates · nothing deployed.
**Next:** commons sourcing (below the wall — 23 R short of 1 lw), then deploy.

---

## Open

### WP10 — Deploy + README
- [ ] **Netlify direct upload + live link.** Tooling built and locally verified;
      `npm run deploy` builds the set, assembles `_site`, runs the draft/`country`/staleness
      guards and uploads. Never run against Netlify yet.
- [ ] **Series 1 as the default selection.** The demo set seeds the picker first because it
      loads synchronously, so it is also what stays selected — a visitor lands on eight
      fictional cards. Promote the built set once it arrives; keep demo as the offline fallback.
- [ ] Deployment structure: how the decks and their manifest arrive, given built sets are
      never committed.
- [ ] **Schedule the refresh on Ash's machine.** Task Scheduler weekly, "run as soon as
      possible after a missed start". The guard makes a miss safe rather than silent.
- [ ] README: screenshots · live demo · test-suite pointer
- [ ] **Privacy policy page** — the app takes a user's API key, and a stated prerequisite of
      any future quota audit. Easy to write honestly: no backend, no accounts, no analytics,
      key in memory only, collection local-only and never transmitted.
- [ ] **Terms of service page** — same audit prerequisite. Carries the unofficial disclaimer
      and the opt-out route in one place rather than only in the footer.

### WP9 — remaining
- [ ] **Browser check on persistence** — not testable from the suite (localStorage + DOM).
- [ ] **Roster depth for Series 2.** Rotation needs ~7x the per-printing count. Surplus is
      currently all in the top bands (151 SR, 35 SSR, 7 UR) and **zero in R** — backwards,
      since commons are 55% of pulls and so are what a returning player notices repeating.

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

- **Sourcing runs.** Public lists for SR/SSR/UR (~1.2 quota units per candidate), keyword
  search for the sub-100K commons only (~11.5). See `catalog/legends.txt`, `reach*.txt`.
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
