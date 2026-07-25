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

## WP6 — Discovery quality

- [ ] Tuning knobs: exclude giants (`maxSubs`) · `order=date` · recent window
- [ ] Randomized re-rolls (seeded query jitter)
- [ ] Keyword generator (seed × modifier vocab)
- [ ] Accept: generic keyword returns mid/small on-topic creators; re-roll differs

## WP7 — Set-build pipeline  ⚠️ gated on legality

- [X] Exclude self-declared IN creators — leaky local-risk hedge (engine filter built)
- [ ] Candidate DB (build-side source of truth)
- [ ] `build-set.js` proper (curated list → `sets/*.json`)
- [ ] Monthly refresh workflow (30-day printings)
- [ ] Footer opt-out / contact line

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

---

## Gate (not a build WP)

- [ ] **Legality resolution** — must clear before WP11 ships to real users

## Parked (far future)

- [ ] Battles · decks · pity · accounts
