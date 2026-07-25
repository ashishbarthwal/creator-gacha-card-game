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
- [X] In-page dev trigger (Live-mode) — one button then; three tier buttons now, see WP6

## WP6 — Discovery quality  🟡 built, acceptance unverified

- [X] Tuning knobs: exclude giants (`maxSubs`, opt-in) · `order=date` · recent window
- [X] Randomized re-rolls (seeded query jitter) — engine already had it; **both live
      callers were pinned deterministic**, and WP6 is mostly turning that on
- [X] Keyword generator (seed × modifier vocab) — 64 × 18 = 1152 queries, `--random N`
- [X] Tier buttons: Legends / Majority / Small — each steers the SEARCH, not just the
      filter, because a keyword's most-viewed videos are big channels whichever band
      you want. Bands derive from `DEFAULT_POOL_BANDS` so they can't drift from `assignPool`
- [~] Accept: **half evidenced.** A live run of "cooking" + "gaming" returned mid/small
      on-topic creators, rates `N 58.5 · R 28.7 · SR 12.8`, nothing above SR — the ceiling
      works. **Still unconfirmed: that a re-roll differs.** Needs the same keyword run
      twice; not testable from the suite, which pins the pure engine on synthetic fixtures.

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

- [ ] Gate/strip dev affordances (Dev Pull, in-page Magic Search ×3)
- [ ] Dev-vs-prod config
- [ ] **Avatar-source flag: real pfp vs generated emblem (WP13).** Agreed 2026-07-26 that the
      pfp and no-pfp builds are ONE codebase with a flag, never forks — a fresh repo would
      be worse than this one precisely because commit history can't be faked, and a stale
      fork reads worse than not building it. That makes this the config seam for both, so
      WP8 matters earlier than its position suggests.
- [ ] Accept: clean build shows no dev buttons

## WP9 — Persistence

- [ ] localStorage collection (survives reload)

## WP10 — Share

- [ ] Card → PNG export (stamped disclaimer)

## WP11 — Deploy + README

- [ ] Static host (GitHub Pages / Netlify) + live link
- [ ] README: screenshots · live demo · test-suite pointer

## WP12 — Pull reveal theatre  🟡 built, never seen

Built out of sequence (2026-07-25), ahead of WP6–11 — the pull is the moment the game is
*for*, and it was the weakest thing on screen.

**Downgraded from ✅ on 2026-07-26.** Every item below is built and committed, but the whole
package is *visual* and nothing automated covers it — the suite deliberately tests only the
headless engine, and `reveal.js` touches the DOM. So these boxes record "written", not
"verified", which is not what a ✅ means anywhere else on this list. It goes back to ✅ after
someone actually watches a Dev Pull.

- [X] Rarity-escalated flip order: commons first and fast, rares last (crescendo)
- [X] Beam telegraph · specular sweep · reveal-time seam glow (backs identical until the turn)
- [X] Twinkling stars, SR+ — JS-placed to dodge the avatar circle
- [X] UR three-beat finish: ignition (frame laps) → discharge (silhouette) → aura (breathing, sheds motes)
- [X] Reduced-motion path: instant, still, but still wears the rarity halo

## WP13 — Procedural Creator Emblems  📄 proposed, not started

Design doc: `external-docs/new-design-proposal.md` (gitignored). Replaces the creator's
profile picture with a deterministic generated emblem, which dissolves the likeness problem
and every avatar bug at once — hotlink 403s, missing pfps, the blank metal medallion, and
the CORS-tainted canvas in `accentFor`, which can then be deleted.

Fits the existing tree without bending it: recipe generation is pure → `engine/emblem.js`,
rendering → `ui/`, classification → build-side tool with tags baked into the set JSON.

- [ ] Semantic classification (build-time; store only derived TAGS, never raw descriptions —
      tags are our data, descriptions are API data under the 30-day rule)
- [ ] `engine/emblem.js` — deterministic recipe from channel id + tags, pure and testable
- [ ] Renderer + a deliberately small starter asset library (~8 themes, not the doc's 300 icons)
- [ ] Animation scoped to reveal/inspect only — never N animated emblems in the collection grid
- [ ] **Open, and it conflicts with the core:** the doc says rarity should NOT derive from
      subscriber count. That is the project's central mapping (`rarityFromSubs`, 15 tests, 4
      call sites) and the tier names ARE the Play Button thresholds. The motivation — "small
      creators deserve beautiful cards" — is satisfied by decoupling *emblem richness* from
      rarity instead, which costs nothing. Resolve before building.

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
