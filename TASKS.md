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

## WP7 — Set-build pipeline ✅

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
- [X] **SSR/UR unreachable by search — closed by adding a curated route.** The first real
      build came out `N 27 · R 16 · SR 8 · SSR 0 · UR 0`: no chase card, and the UR reveal finish
      would never fire for a real player. SSR starts at 10M subs and UR at 50M, while
      `KEYWORD_SEEDS` is hobby/craft on purpose — it avoids news, politics and person-named
      channels, which matters when every result becomes a card carrying a likeness — and that
      vocabulary essentially never surfaces a 10M+ channel.
      - **Broadening the vocabulary was the obvious fix and the wrong one:** it would trade away
        the exact safety property the vocabulary was chosen for. Who counts as a legend is human
        knowledge, not a query, so it belongs in a file a person maintains. `assignPool`
        anticipated this ("a curated allowlist can still promote a channel to legends later").
      - `tools/add-candidates.js` + `catalog/legends.txt`: one @handle, UC id or URL per line,
        `#` comments kept so the roster carries its own reasoning. Resolves, applies the region
        exclude and the denylist exactly as search does, merges into the same candidate DB.
      - **Cost, worth stating because "the API won't get us far" is only true of SEARCH:** a
        handle is 1 quota unit, ids batch 50 to a unit. A 200-name roster is ~200 units against
        10,000/day. `search.list` at 100 units a call is the only expensive thing in the system.
      - This is the *route*, not the roster — the names are WP9's scope.
- [X] **Deploy tooling exists; the deploy itself moved to WP11.** `tools/build-site.js` and
      `npm run deploy` are written and locally verified, but publishing is not a set-build
      concern and nothing should go live before the decks are curated (WP9). WP7's original
      scope named a "monthly refresh workflow"; that reads as pipeline work but is really
      release work, so it sits with the deploy in WP11 rather than holding this package open.
- [X] Strip `country` from shipped sets — done in `engine/setbuild.js`; closes the last Gate
      item, see the Gate section for the full note

## WP8 — Production hardening

- [X] Gate/strip dev affordances (Dev Pull, in-page Magic Search ×3) — hidden, not removed,
      so `?dev=1` still reveals them and the module-level DOM refs stay valid
- [X] Dev-vs-prod config (`src/config.js`) — detected at runtime from hostname, because with
      no build step there is no bundler to swap a constant and no env var a browser can read.
      `?dev=0` forces the prod view on localhost, which is what makes the gating checkable at
      all: a guardrail only reachable by serving over a LAN IP is one nobody verifies.
- [X] **Avatar-source flag: real pfp vs generated emblem — landed 2026-07-31.** `AVATAR_SOURCE`
      in `src/config.js`, previewable at `?avatars=emblem`. `engine/emblem.js` is the seed of
      WP13, not WP13: a deterministic gradient-disc emblem keyed on the channel id, no network
      and no canvas. It reuses the starter set's artwork rather than inventing a second visual —
      that art shipped in WP4 and has been looked at, and `data/starter.js` now imports the
      shared generator instead of keeping its own copy (verified byte-identical). One flag over
      one codebase, so flipping to emblems is a redeploy rather than a rewrite. 16 tests.
      Original note below, still the reasoning: Agreed 2026-07-26 that the
      pfp and no-pfp builds are ONE codebase with a flag, never forks — a fresh repo would
      be worse than this one precisely because commit history can't be faked, and a stale
      fork reads worse than not building it. That makes this the config seam for both, so
      WP8 matters earlier than its position suggests.
- [X] Accept: clean build shows no dev buttons — **verified by Ash 2026-07-31** in the browser,
      across `localhost`, `?dev=0` (the prod view) and `?dev=1`. Not testable from the suite:
      the gating is DOM work and `config.js` reads `location`, which the headless suite has no
      meaningful version of.

## WP9 — The decks + persistence  📋 scope being defined

**This is the next build**, and it is where the project stops being a pipeline and starts
being a game. WP7 built the machine; this fills it, and then makes what a player pulls
survive a reload — the two belong together because a deck worth collecting is only worth
collecting if the collection persists.

What already holds, so it is not in scope: a player needs **no API key and makes no call to
the YouTube Data API**. `sets/built/<slug>.json` is a static file served from the host and
read through the seam. What is missing is not architecture, it is *content* — the current
set is a 51-card proof made from whatever the hobby/craft keyword vocab happened to surface,
with no SSR and no UR in it.

- [X] **Deck sizes settled (2026-07-31): ONE deck of 400, not three.** The proposal was to ship
      the three sourcing pools as three decks; run against the real set, two of the three build
      to **zero** and the third is 100% N. Rarity is derived from subscriber count, so slicing
      decks by subscriber band slices the rarity ladder out of each one — structural, not a
      shortage. The tiers keep steering the search and feed one deck carrying the full N→UR
      ladder. Themed decks (Tech / Craft / Gaming) stay open; each needs the whole ladder.
- [X] **The band cap — a chase card has to be reachable.** `bandTargets`/`capBands` in
      `engine/setbuild.js`: the ceiling matching the floor that was already there, derived from
      the same weight table. The 79-card set had its base bands completing in ~190 pulls and UR
      in ~3,720, and **growing the set cannot fix that** — band-first pulling makes a band's
      completion time a function of that band's own card count and nothing else. Allocated by
      water-filling to equalize completion; 400 cards yields N 199 · R 109 · SR 56 · SSR 28 ·
      UR 8, every band finishing within 2,125–2,199 pulls. 13 tests.
      - Surplus is **held, not dropped**: selection hashes `slug:channelId`, so a later printing
        draws a different subset with no rotation ledger to keep.
- [X] **Legends roster — 74 names, resolved 69.** Two passes: the top-band fill (SSR 16 · UR 12)
      and an SR/SSR fill aimed at makers, science, cooking, art and music, to match the keyword
      vocabulary rather than to maximise fame. None were dropped by the India exclude.
- [X] **`--tier` on `tools/magic-search.js`** — `SEARCH_TIERS` has steered the in-page buttons
      since WP6 and the CLI could not reach it. The cap turned the build report into a
      per-band shortfall list, which is only actionable if the tool can be aimed at a band.
      Wildcards added 151 to N without touching R/SR; majority took R from 31 to 111.
- [X] **Pins — the cap needed to be told which cards a set is sold on.** A `!` in the roster
      sorts an entry ahead of its band, so the hash only decides the remainder. Built because
      the first 400-card build hashed PewDiePie, Mark Rober and Dude Perfect OUT of UR and kept
      five record labels. Recognition is not subscriber count and no query computes it. Pins
      are sticky across merges (Magic Search carries no roster) but never override the
      denylist. 12 tests.
- [X] **Vocabulary widened to gaming / tech / sports / lifestyle + `relevanceLanguage: 'en'`.**
      Only the news/politics/person-named half of the old restriction was load-bearing; the
      narrowness was costing the top of the set and the recognizability of the commons. A
      language bias beats a country allowlist, which would silently drop the ~30% who declare
      no country.
- [X] **Measured: broad topics triple the India exclusion rate** — 34.0% excluded over 521
      hydrated channels (81.4% declared), against 8.6–13.3% on hobby/craft. Strengthens the
      gate's reliance on the filter and is a real yield cost of broadening.
- [X] **Series 1 built: 400 cards, all five bands healthy.** 622 candidates → 13 quota units to
      hydrate. Drop rates over 100,000 simulated pulls: N 55.14 · R 26.97 · SR 11.93 ·
      SSR 4.93 · UR 1.03 against a 55/27/12/5/1 table.
      - UR: MrBeast · WWE · PewDiePie · Alan's Universe · Mark Rober · Zhong · Dude Perfect ·
        IShowSpeed. SSR carries Markiplier, Dream, Sidemen, KSI, Ninja, MKBHD, LTT, CoryxKenshin,
        Logan/Jake Paul, Zach King, Vsauce, Kurzgesagt and Veritasium.
      - **Open, and stated rather than papered over:** the commons are still a blend. The
        language bias filters nothing, and ~380 candidates were sourced before it existed, so
        N and R carry names an anglophone player will not recognize. Top two bands curated,
        commons sampled.
- [ ] Deployment structure for GitHub Pages — what gets served, and how the decks and their
      manifest arrive given built sets are never committed.
- [X] **localStorage collection (survives reload) — landed 2026-08-01.** Supersedes the "no
      persistence yet" decision, which was about sandboxed previews. `engine/collection.js`
      (pure: shape, validation, reconciliation) + `src/storage.js` (the IO edge, at the root
      because it touches neither the DOM, the network, nor nothing). 15 tests.
      - **Stores the channel snapshot + count, never the derived card.** rarity/atk/def are
        recomputed on load, so a saved rarity can never drift out of agreement with
        `rarityFromSubs`. Storing only the id was rejected: the set is re-cut on every build,
        so a card can leave print and an id-only store would delete it from someone's binder.
      - **The 30-day cap is answered by reconciliation, not expiry.** A loaded set IS current
        data, so every owned card still in print is refreshed from it for free, zero extra
        requests. Only cards that left the set keep an ageing snapshot, stamped with `savedAt`.
      - **The API key still never persists, structurally** — `storage.js` is the only module
        touching localStorage and is only ever handed a collection. A test writes a key onto
        the collection and asserts it cannot reach the serialized bytes.
      - Every storage path swallows its errors (corrupt JSON, `QuotaExceededError`, a
        sandboxed frame that throws on *access*), verified against a shim. One card is 281
        bytes; 400 cards is ~80KB against a ~5MB budget.
      - **Clear-collection control shipped with it**, confirmed before firing. Not polish: the
        WP11 privacy policy is about to claim the data is local and yours, which is only true
        if something performs the deletion.
- [ ] **Browser check on the persistence** — not testable from the suite (localStorage + DOM).
      See the checklist handed over 2026-08-01.

## WP10 — Share

- [ ] Card → PNG export (stamped disclaimer)

## WP11 — Deploy + README

- [ ] **Netlify direct upload + live link.** Deliberately *after* WP9: nothing should be
      published before the decks are curated, because the first thing a visitor sees should not
      be a 51-card proof set. Tooling is already built and locally verified (moved here from
      WP7) — `npm run deploy` builds the set, assembles `_site`, runs the draft/`country` guards
      and uploads. Never run against Netlify yet.
- [X] **The 25-day refresh now has an alarm (2026-08-01).** The mechanism existed since WP7;
      the *check* did not, so a 40-day-old set built and served like a fresh one.
      `engine/freshness.js` (pure, injected clock) sets two thresholds — warn at 25, **refuse
      to publish at 30**. Refusing at the cadence would block a compliant day-26 publish and
      breed a bypass flag; the five-day gap is what makes a missed Sunday survivable. An
      undated set is refused too — "no snapshotDate" is "age cannot be established", so it
      fails closed. 14 tests.
      - Guard verified by watching it fire, as the other two `build-site.js` guards were:
        26 days warned and built, 33 days refused, undated refused, and the **exit code breaks
        the `&&` chain** so the upload never runs.
      - **`catalog/refresh-log.json` is COMMITTED** — dates and counts only, never creator
        data. It is the one refresh artifact that survives losing the machine, and the only
        thing that can prove the cadence was kept: a set carries a single date, so a missed
        month is invisible in it and obvious in a log. `build` and `deploy` are separate
        events, because rebuilding locally and never shipping is the quiet failure.
      - `npm run status` — no key, no network, exits 0/1/2 so a scheduled task can act on it.
        Also flags roster drift (candidates added since the last build), which no clock catches.
- [ ] **Schedule the refresh on Ash's machine.** Task Scheduler weekly, with "run task as soon
      as possible after a scheduled start is missed". The guard makes a miss safe rather than
      silent, so this is best-effort by design.
- [ ] README: screenshots · live demo · test-suite pointer
- [ ] **Privacy policy page** — needed on its own merits (the app takes a user's API key) and
      a stated prerequisite of any future quota audit. Unusually easy to write honestly here:
      no backend, no accounts, no analytics, key held in memory only and sent nowhere but
      googleapis.com. That is a strong document rather than a chore — but write it AFTER
      WP9, since localStorage changes what it has to say (local-only, never transmitted).
- [ ] **Terms of service page** — same audit prerequisite. Carries the unofficial/not-affiliated
      disclaimer and the opt-out route (WP7a) in one place rather than only in the footer.

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
