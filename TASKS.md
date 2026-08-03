# Work Packages — checklist

Working checklist. **Rationale lives in [DECISIONS.md](DECISIONS.md), history in the git log** —
this file is only "what is done, what is next". A WP is for **architectural** work: a new seam,
a new guarantee, a new capability. Recurring work goes under Miscellaneous and is never tracked
individually.

**Now:** LIVE at https://creator-gacha.netlify.app — 19,874 cards (whole pool; the institution filter is STAGED, not applied) ·
19,968 candidates · deployed 2026-08-03.
**Next:** SSR depth (SSR is the wall at 71.8 lw after the institution cut took 84 SSR).

---

## Open

### WP10 — Deploy + README
- [X] **Netlify direct upload + live link.** LIVE at https://creator-gacha.netlify.app
      (2026-08-03). `_headers` ships inside `_site` rather than living in `netlify.toml` —
      a direct upload has no build step to resolve the toml's `[[headers]]`, so they would
      have applied to nothing. Brotli confirmed on the wire.
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
      straight to Netlify, commits only the ledger, and emails a report every run — with the
      card count and its delta first, because "success" is what a broken run says too.
      The local Windows task is unregistered; `tools/schedule-refresh.js` remains as a
      documented fallback.
      **Ash's remaining step: add the four repository secrets.**
- [ ] README: **screenshots** (live demo + test pointer done)

### WP9 — remaining
- [ ] **Browser check on persistence** — not testable from the suite (localStorage + DOM).
- [ ] **Roster depth for Series 2.** Rotation needs ~7x the per-printing count. The reach-5
      Wikidata sweep (2026-08-02) ended R's run as the binding band; **SSR binds now**, at 92.8
      lower walls against R's 245. UR is world-supply capped and will never be met. The next
      sourcing pass goes at SSR (10M–50M), where a notability sweep is already exhausted and
      the route is curated rosters.

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
