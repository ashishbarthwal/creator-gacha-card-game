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

## WP6 — Discovery quality ✅

- [X] Tuning knobs: exclude giants (`maxSubs`, opt-in) · `order=date` · recent window
- [X] Randomized re-rolls (seeded query jitter) — engine already had it; **both live
      callers were pinned deterministic**, and WP6 is mostly turning that on
- [X] Keyword generator (seed × modifier vocab) — 64 × 18 = 1152 queries, `--random N`
- [X] Tier buttons: Legends / Majority / Small — each steers the SEARCH, not just the
      filter, because a keyword's most-viewed videos are big channels whichever band
      you want. Bands derive from `DEFAULT_POOL_BANDS` so they can't drift from `assignPool`
- [X] Accept: **fully evidenced (2026-07-31).** Two live checks, neither reachable from the
      suite — it pins the pure engine on synthetic fixtures and a fixed clock, which proves
      the jitter is *computed*, never that a real API answers differently.
      1. The ceiling: "cooking" + "gaming" returned mid/small on-topic creators at
         `N 58.5 · R 28.7 · SR 12.8`, nothing above SR.
      2. The re-roll: three consecutive in-page **Majority** runs on "cooking" each returned
         different channels. This covers **both** live callers rather than one, because
         Majority's `opts` is `{}` — the identical object `tools/magic-search.js` passes as
         `JITTERED` — so the CLI needs no separate run to be evidenced.

## WP7a — Opt-out contact line ✅

Pulled out of WP7 deliberately. It was sitting inside a work package gated on legality,
which is backwards: the opt-out is one of the things that *makes* the legal position
defensible, so gating it behind that resolution means it can only ever arrive too late.
It ships **with the first real-creator set, before it**, not after.

- [X] Footer contact line + honored-removal policy (7 days, no identity check)
- [X] **Contact route picked (2026-07-31):** `ashish.barthwal.cs@gmail.com`, Ash's own
      address, chosen over the dedicated alias suggested here. A real inbox that is
      actually read beats a forwarding address that might not be, and the promise is
      answering fast. The cost — a public mailto gets harvested — was taken knowingly.

## WP7 — Set-build pipeline  🟡 ungated 2026-07-31, in progress

The legality gate closed, so this is no longer blocked. Building in the order the
07-31 decisions imply: the committed source of truth first, then the thing that
hydrates it, then the schedule that re-runs it.

- [X] Exclude self-declared IN creators — leaky local-risk hedge (engine filter built)
- [X] **Measured, 2026-07-31 — and it works better than feared.** `regionReport` now prints on
      every CLI run. Two live runs over 326 hydrated channels: **coverage 65–73%** (the share
      declaring any country, which is the hard ceiling on what the filter can ever remove) and
      **8.6–12.8% actually excluded** — 34 India-declared creators dropped. The prediction going
      in was ~10–15% coverage, i.e. a filter doing almost nothing; the real number is roughly
      five times better, so the gate's description of it as a meaningful hedge stands.
      - The screenshot that prompted this is still explained: the creators who got through are
        in the 27–35% who declare nothing, and an unknown country can't be excluded. The filter
        is a supplement to the real protections, never a substitute — unchanged.
- [X] **Candidate DB (build-side source of truth)** — `engine/candidates.js` (pure: strip,
      merge, denylist, pool refresh, hydrate batching) + `tools/build-candidates.js` (no key,
      no network, spends no quota) writing `catalog/candidates.json`. 27 tests.
      - The directory split IS the rule: `sets/*.draft.json` gitignored (real creator data),
        `catalog/*.json` committed (ids + our tags + denylist), `sets/<slug>.json` built in CI
        and never committed. Committing creator data would break the 30-day cap (git is
        permanent) and the 7-day opt-out (`git rm` leaves them at the old commit) at once.
      - The strip is an explicit positive allowlist, so a new field on the Channel shape can
        never start being committed silently.
      - **The denylist evicts as well as blocks**, which is the load-bearing half: sourcing
        *will* rediscover an opted-out channel, so an opt-out that isn't re-enforced on every
        merge expires at the next `--random` run. `--prune` honors one immediately without
        needing a draft or a key.
- [X] **`build-set.js`** — `engine/setbuild.js` (pure: band health, prune, strip, assemble) +
      `tools/build-set.js` (hydrate → re-filter → refresh hints → write). 20 tests.
      Ran for real 2026-07-31: 51 candidates → 2 quota units → a 51-card set, all bands healthy.
      - [X] **No band may ship starved.** Found by playing: a 15-card pool returned the same R
            card 4× in one x10. Not the dupe rule — band starvation. The pull draws a band by
            fixed weight then picks uniformly inside it, so a one-card band returns it every
            time. The minimum is **derived from the same weight table the pull uses**, not a flat
            number — N takes ~5.5 of 10 draws and needs a deep roster, UR takes ~0.1 and needs
            two. Starved bands are pruned rather than failing the build, and pruning re-checks,
            since removing a band renormalizes the others upward.
      - [X] Output goes to `sets/built/`, **gitignored** — see the Gate item below.
- [X] **`minViews` floor — zero-stat cards.** A channel with ~8,100 videos and no view count
      rendered ATK 0 (even one view scores 36). `DEFAULT_FLOOR` gated subs and videos but not
      views. Now 1,000, inherited by all three tiers.
- [ ] **SSR/UR are structurally unreachable — open.** The first real run produced
      `N 27 · R 16 · SR 8 · SSR 0 · UR 0`. `KEYWORD_SEEDS` is deliberately hobby/craft (it steers
      clear of news, politics and person-named channels, which matters when every result becomes
      a card), and that vocabulary essentially never surfaces a 10M+ channel. So the pool cannot
      currently mint a chase card, and WP12's UR three-beat finish would never fire for a real
      player. Options, none taken yet: a curated legends allowlist (`assignPool`'s comment
      already anticipates one), a second broader vocab used only for the legends tier, or accept
      that a set tops out at SR and let the top band be the aspiration.
- [ ] Refresh workflow — **25-day cadence, not 30**. The policy cap is 30 days; running the
      schedule at the cap means any skipped or failed run is instantly non-compliant. 25 buys
      a 5-day buffer to notice and re-run. Printings are still "monthly" in flavour.
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
- [ ] **Privacy policy page** — needed on its own merits (the app takes a user's API key) and
      a stated prerequisite of any future quota audit. Unusually easy to write honestly here:
      no backend, no accounts, no analytics, key held in memory only and sent nowhere but
      googleapis.com. That is a strong document rather than a chore — but write it AFTER
      WP9, since localStorage changes what it has to say (local-only, never transmitted).
- [ ] **Terms of service page** — same audit prerequisite. Carries the unofficial/not-affiliated
      disclaimer and the opt-out route (WP7a) in one place rather than only in the footer.

## WP12 — Pull reveal theatre ✅

Built out of sequence (2026-07-25), ahead of WP6–11 — the pull is the moment the game is
*for*, and it was the weakest thing on screen.

**Downgraded to 🟡 on 2026-07-26, restored to ✅ on 2026-07-31** — the package is entirely
visual and nothing automated covers it (the suite tests only the headless engine, and
`reveal.js` touches the DOM), so the boxes recorded "written" until someone actually watched
a Dev Pull. Ash did, on 2026-07-31: the crescendo, beam, sweep, stars and the UR three-beat
all read as intended. One correction came out of it, below.

- [X] **Turn speed, from that viewing.** Commons were machine-gunning: the cadence
      (`BASE_GAP` 115ms) was far shorter than the flip itself, so ~5 cards were mid-turn at
      once and none had a beat of its own. Cadence 115→200ms, and the turn slowed across the
      board (0.55→0.72s base, a new SR step at 0.82s, SSR/UR 0.8→0.95s). The delays
      choreographed against the flip midpoint moved with it — SSR seam 0.42→0.5s, SR sweep
      0.4→0.46s, stars-in 0.45→0.52s — so the halo and sweep still land on a face that is
      actually facing you.
- [X] **Click a revealed card to inspect it** — QoL, so admiring a pull no longer costs a
      trip through Done and the collection grid. Face-down a click still skips the wait;
      face-up it opens the existing inspector, which already dims everything else. Escape now
      closes the top overlay only (capture-phase guard) instead of collapsing both at once.
- [X] **Stranded beam, found by using the above.** Beam and flip are separate timers, so
      turning a card early left its beam timer to fire afterwards and re-light a telegraph on
      a landed card — and `beam-build` is `forwards`, with nothing removing `beaming` after a
      flip, so it held a cone of light above the card until the overlay closed. Fixed at the
      scheduler (a beam refuses to light on a flipped cell) *and* in CSS
      (`.reveal-cell.flipped .beam` is off), so timing is no longer the only thing preventing it.

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

**This is the one WP that serves both games.** Repo Gacha (parked, below) can't use project
logos either, so its cards need procedural artwork from the same pipeline — only the
classification input changes, from channel description to language/topics. That makes
emblems shared infrastructure rather than a hedge against the pfp problem, which argues
for building it properly rather than minimally.

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

All must clear before WP11 ships to real users. Deliberately deferred, not resolved —
they are cheap now and expensive after launch. **Two of the three are now closed; only the
`country` strip is outstanding.**

- [X] **Legality resolution — closed 2026-07-31, by accepting a bounded risk rather than by
      eliminating one.** Recorded in full under "Launch posture" in DECISIONS.md. What
      "resolved" concretely means here: no monetization and no ads, so there is no commercial
      use to complain about; the unofficial/not-affiliated disclaimer; a working opt-out
      honored in 7 days (WP7a); the India exclude trimming the highest-enforceability vector;
      and the WP8 avatar flag, which keeps the decision reversible instead of permanent. The
      realistic bad outcome is an email asking for removal, which gets honored. Deliberately
      NOT claimed: that a lawyer signed this off, or that the risk is zero. It is Ash's
      informed call to launch, and it is written down as that.
      - ⚠️ **One input to this is unverified (noted 2026-07-31, gate left closed).** The India
        exclude is cited above as trimming the highest-enforceability vector, but its real-world
        effect has never been measured and a live pull suggests it is very leaky — see the
        measurement task in WP7. This does not reopen the gate on its own; the decision listed
        what would (a claim arriving, monetization, scale). It is flagged because the gate should
        rest on what the filter *does*, not on what it was designed to do.
- [X] **Rename off the "YouTube" trademark** — now **Creator Gacha** (done early, 2026-07-26).
      Descriptive use retained in the tagline; the footer disclaimer is unchanged and still
      required. **Closed out 2026-07-31:** the GitHub repo is `creator-gacha-card-game` and the
      CI badge points at it. The longer form was chosen over a bare `creator-gacha` on purpose —
      "gacha" is a niche term, and the repo list is read by people who may not know it means the
      card-pull mechanic. It costs a longer Pages URL and buys legibility to a recruiter.
- [X] **Strip `country` from shipped sets — closed 2026-07-31.** `engine/setbuild.js` assembles
      the published record from a positive allowlist, so country is absent by construction
      rather than by a deletion someone has to remember. Two tests pin it, one on the object and
      one on the serialized bytes, since the bytes are what ship. **The Gate is now fully
      closed.** Built sets go to a gitignored `sets/built/` and are minted in CI at deploy: a set
      file in git is permanent, which would break both the 30-day statistics cap and the promise
      that a removal is actually performable.

## Parked (far future)

- [ ] Battles · decks · pity · accounts
- [ ] **Repo Gacha** — the same engine over open-source repos instead of creators.
      Doc: `external-docs/repo-gacha.md`. Deferred 2026-07-26 in favour of finishing CG;
      genuinely smaller, because the legal machinery CG needs (opt-out, monthly refresh,
      country filter, trademark gate) mostly doesn't apply. See DECISIONS.md for what
      survives a pivot and where the doc's reasoning is off.
