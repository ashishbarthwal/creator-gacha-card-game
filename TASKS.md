# Work Packages — checklist

Fast task view. Full rationale in [PLAN.md](PLAN.md), decisions in [DECISIONS.md](DECISIONS.md).
WP0–3 done (split · tests · footer · cards) — starts at WP4. `[x]` done · `[ ]` to do.

---

## WP4 — Card sets system ✅

- [X] Sets adapter behind the seam (`data/sets.js`)
- [X] `sets/index.json` manifest + set picker
- [X] Bundled starter set (demo folded in)
- [X] Fictional `sample-series.json`
- [X] Two-stage pull (band-first) — odds independent of pool size

## WP5 — Magic Search: discovery core ✅ (draft 1)

- [X] Pure engine (`engine/discover.js`): query build · harvest · floor · pool · cap
- [X] Live fetch (`data/search.js`): search.list → channels.list
- [X] CLI (`tools/magic-search.js`): accumulates into a gitignored draft set
- [X] In-page dev trigger (Live-mode button)

## WP6 — Discovery quality  🟡 built, acceptance unverified

- [X] Tuning knobs: exclude giants (`maxSubs`, opt-in) · `order=date` · recent window
- [X] Randomized re-rolls (seeded query jitter) — engine already had it; **both live
      callers were pinned deterministic**, and WP6 is mostly turning that on
- [X] Keyword generator (seed × modifier vocab) — 64 × 18 = 1152 queries, `--random N`
- [ ] Accept: generic keyword returns mid/small on-topic creators; re-roll differs
      — needs a live run against a real key, which costs quota. Not verifiable
      from the tests: they pin the pure engine on synthetic fixtures.

## WP7a — Opt-out contact line  🔴 NOT gated — prerequisite

Pulled out of WP7 deliberately. It was sitting inside a work package gated on legality,
which is backwards: the opt-out is one of the things that *makes* the legal position
defensible, so gating it behind that resolution means it can only ever arrive too late.
It ships **with the first real-creator set, before it**, not after.

- [ ] Footer contact line + honored-removal policy (already decided in DECISIONS.md)
- [ ] Pick the contact route — the one part that isn't free (see below)

## WP7 — Set-build pipeline  ⚠️ gated on legality

- [X] Exclude self-declared IN creators — leaky local-risk hedge (engine filter built)
- [ ] Candidate DB (build-side source of truth)
- [ ] `build-set.js` proper (curated list → `sets/*.json`)
- [ ] Monthly refresh workflow (30-day printings)
- [ ] Strip `country` from shipped sets (build-time only — see the Gate section)

## WP8 — Production hardening

- [ ] Gate/strip dev affordances (Dev Pull, in-page Magic Search)
- [ ] Dev-vs-prod config
- [ ] Accept: clean build shows no dev buttons

## WP9 — Persistence

- [ ] localStorage collection (survives reload)

## WP10 — Share

- [ ] Card → PNG export (stamped disclaimer)

## WP11 — Deploy + README

- [ ] Static host (GitHub Pages / Netlify) + live link
- [ ] README: screenshots · live demo · test-suite pointer

## WP12 — Pull reveal theatre ✅

Built out of sequence (2026-07-25), ahead of WP6–11 — the pull is the moment the game is
*for*, and it was the weakest thing on screen.

- [X] Rarity-escalated flip order: commons first and fast, rares last (crescendo)
- [X] Beam telegraph · specular sweep · reveal-time seam glow (backs identical until the turn)
- [X] Twinkling stars, SR+ — JS-placed to dodge the avatar circle
- [X] UR three-beat finish: ignition (frame laps) → discharge (silhouette) → aura (breathing, sheds motes)
- [X] Reduced-motion path: instant, still, but still wears the rarity halo

---

## Gate (not a build WP)

Both must clear before WP11 ships to real users. Deliberately deferred, not resolved —
they are cheap now and expensive after launch.

- [ ] **Legality resolution**
- [X] **Rename off the "YouTube" trademark** — now **Creator Gacha** (done early, 2026-07-26).
      Descriptive use retained in the tagline; the footer disclaimer is unchanged and still
      required. **One piece left, and it's yours:** rename the GitHub repo from
      `youtube-gacha-card-game` and update the CI badge URL in README.md — the badge path has
      to match the real repo or it breaks.
- [ ] **Strip `country` from shipped sets** — build-time only (`passesRegion`), never read at
      runtime, so publishing it exposes a self-declared personal attribute the game never uses

## Parked (far future)

- [ ] Battles · decks · pity · accounts
