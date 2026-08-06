# Work Packages — checklist

Working checklist. **Rationale lives in [DECISIONS.md](DECISIONS.md), history in the git log** —
this file is only "what is done, what is next". A WP is for **architectural** work: a new seam,
a new guarantee, a new capability. Recurring work goes under Miscellaneous and is never tracked
individually.

**Now:** LIVE at https://creator-gacha.pages.dev serving **"Core Set", 15,833 cards**
(deployed 2026-08-05, commit `e509076`) — every staged institution permanently cut, series
numbering retired. See "Core Set replaces Series 1" below. (This section was stale until now —
the deploy happened but the doc was never updated after it.)
**Next:** WP-Ruby Tier — **built and tested, not yet deployed.** A genuine sixth rarity band,
internal key `RUBY`, for 100M+ subscriber channels — displayed as **Red Diamond Play Button**
(UR's band is the real Ruby Play Button, 50M; names were swapped 2026-08-07 after Ash asked
whether "Ruby" was even the right call — see DECISIONS.md), fully decoupled from UR's weight.
The old UR band (31 cards) splits into UR 22 / RUBY 9 on a fresh local build
(`sets/built/core.json`, 2026-08-06/07). Full reveal-FX escalation (ignition/discharge/aura,
frame ember, holo sheen — all in `styles.css`) and card-frame tokens (`.r-RUBY`, dark blood-red
after the naming fix) are in; 425 tests pass. Deploy needs `npx wrangler pages deploy _site
--project-name=creator-gacha --branch=main && node tools/record-deploy.js`, pending Ash's
go-ahead. See below.
Separately: WP12's battle system engine is built and tested with a playable prototype at
`prototype/index.html` (local only); the in-app UI is still missing.

---

## Open

### WP-Ruby Tier — a real sixth band for 100M+ (built 2026-08-07, not yet deployed)
Started as "should UR be rarer" (Ash: pulling MrBeast should be a YOOOO moment). A first-pass
continuous within-UR skew was considered and set aside: it dilutes as the UR roster grows, since
the whole band still gets a fixed share of pulls no matter how many cards sit in it. Built instead
as a genuine new rarity band, decoupled from UR entirely — `bandsFrom`/`pickBand` in `gacha.js`
already loop generically over `RARITY_ORDER`, so almost no new pull logic was needed.

- [X] `RUBY` added to `RARITY_ORDER`/`RARITY` in `core.js`; `rarityFromSubs` gets a
      `>= 100_000_000` branch ahead of the UR check.
- [X] Weight split: UR 1 → 0.9, RUBY 0.1 (Ash's call). Mult: RUBY 3.0 vs UR's 2.5 (Ash's call).
- [X] Full CSS tier frame — reveal-FX escalation (ignition/discharge/aura reused generically via
      a `TOP_TIER` set in `reveal.js`, colours overridden per-tier in CSS), card ember/holo sheen.
- [X] **Award names swapped 2026-08-07** — caught after building it: YouTube's real Ruby Play
      Button is 50M subs, Red Diamond is 100M, backwards from the first pass (and from UR's
      "Red Diamond" label going all the way back to WP3). `TIER_NAME.UR = 'Ruby Play Button'`,
      `TIER_NAME.RUBY = 'Red Diamond Play Button'` — internal keys (`UR`/`RUBY`) untouched, so no
      migration for saved collections. `.r-RUBY`'s palette re-picked to match: dark near-black
      blood-red rather than the original pink-magenta, distinct from UR/Ruby's amber-red by hue
      AND weight. See DECISIONS.md 2026-08-07 "The award names were backwards" for the full record.
- [X] `setbuild.js`'s band-depth math needed no changes — it already iterates `RARITY_ORDER`
      generically. One test tolerance widened (`gives every band roughly the same completion
      time`, `test/setbuild.test.js`): RUBY's real-world population (9 known 100M+ channels) is
      too shallow for the coupon-collector water-filling to ever equalize its completion time
      with the other bands, so RUBY is excluded from that parity check and UR's own tolerance
      widened slightly (10% → 15%) now that a 6th band thins its share too.
- [X] Local rebuild: UR 22 / RUBY 9 (split from the old 31-card UR band). 425 tests pass.
- [ ] **Not yet deployed.** Needs `tools/build-site.js` + `wrangler pages deploy` — independent
      of the Core Set data deploy. The live site still runs the old flat-UR pull table and card
      frame until this ships.
- [ ] `test/gacha.test.js`/`test/core.test.js` cover the new band, but nobody has looked at the
      reveal animation or the collection-grid RUBY card in a real browser yet — do that before
      calling the visual side done.

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
- [X] **Core Set as the default selection** (renamed from Series 1, 2026-08-05 — see below).
      The demo set still seeds first (synchronous, offline-safe) and now hands over the moment
      a real set is offered, unless the visitor already picked one themselves.
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
- [ ] **SSR depth is still the binding band** on the new Core Set (317 cards). No longer tracked
      against a "Series 2 rotation" target — see "Core Set replaces Series 1" below, the
      rotation-depth framing is retired along with series numbering. Real gains still need
      curated rosters or non-anglophone territories; the cheap sourcing routes remain exhausted.

### Core Set replaces Series 1 (2026-08-05)
- [X] **All 7,705 staged institution ids permanently cut**, promoted from
      `catalog/excluded-institutions.txt` (staged) into `catalog/excluded.txt` (settled, always
      applied) — Ash's call, no per-card review: "remove them, they don't add anything, nobody
      will care." The staged file is now empty and stays reusable for a future institution
      sweep.
- [X] **Renamed Series 1 → Core Set** (`tools/build-set.js` defaults: slug `core`, title
      `"Core Set"`). Series numbering promised a sequence (Series 2, 3…) never built and no
      longer planned — one deck, refreshed on the existing 25-day cadence, not rotated.
- [X] **Rebuilt locally**: 15,833 cards (down from 24,251), every band reads "full" against the
      x10 dupe-avoidance floor — no starvation from the cut. `N 9848 · R 3613 · SR 2024 ·
      SSR 317 · UR 31`.
- [X] **Side effect: both WP12 battle-system blockers cleared for free.** This rebuild used the
      already-updated hydrate path (`CHANNEL_PARTS` requests `topicDetails`, `setbuild.js` keeps
      `publishedAt`), so the new `sets/built/core.json` carries **real dates on 100% of cards**
      and **real elements** (`node tools/battle-balance.js` no longer synthesizes anything).
- [ ] **New finding from real data, not yet acted on:** cadence and devotion now correlate with
      channel size at 0.42 and 0.35 — both above the tool's own ~0.25 "stopped being size-free"
      flag. Every balance THRESHOLD still passes (largest class 40.6%, power ratio 1.15, small-
      out-rating-giant 21.8%, win rate 60.6%), so nothing is broken, but the anchors were tuned
      against synthesized ages and real ages read differently (median maturity 65 vs. the
      synthetic 51 — the deck skews older than assumed). Worth a deliberate retune pass; not
      done as a side effect of this rebuild.
- [ ] **Not yet deployed.** `sets/built/core.json` is local only — `npm run deploy` (the
      `wrangler pages deploy` step) needs a separate go-ahead before real users see this.

### WP12 — Battle system — engine done, no UI
5v5, auto-resolved, against an AI matched to the player's own team power. Client-side only, so
locked decision 3 is untouched. Rationale and the three measured failures behind the design are
in DECISIONS.md.
- [X] **`engine/battle-stats.js`** — channel → five size-free axes → HP/ATK/DEF/SPD/MOM + class.
      Size buys a compressed *budget*; shape decides where it goes, so rarity does not decide
      the fight.
- [X] **`engine/battle.js`** — turn resolution, seeded RNG, returns an event log the UI replays
      (the same shape the reveal already uses: decide first, animate a settled result).
- [X] **`engine/opponent.js`** — power-matched AI deck at even / uphill / favoured.
- [X] **`engine/element.js`** — `topicDetails.topicCategories` → one of six elements on a simple
      wheel, plus Unaligned. **Zero quota**: `channels.list` bills per call, not per part. The one
      genuinely new signal available to this project; everything else derivable from the four
      numbers is arithmetic (see the velocity note in DECISIONS.md).
- [X] **The three combat layers** — elements, front/back ranks, and a verb per class. Added
      because a power-matched fight had nothing in it to decide; each layer is worth less without
      the one before it, which is why they landed in that order.
- [X] **Speed now buys a second action.** It previously bought turn order and nothing else, which
      made the Assassin — the largest class in the deck — a card that had spent its whole budget
      on nothing (0 wins in 200 at 72% of a matched team's rating).
- [X] **`tools/battle-balance.js`** — measures the engine against the real deck: axis spread and
      size-correlation, class and element mix, the size claims, fight length and matchmaker
      fairness. The test block says "still true"; this says "how true, and where".
- [X] **83 tests** across `battle` and `element`, including a balance block that asserts the
      design goals rather than hoping. Current live-deck figures: attack flat with size at 1.02,
      power median ratio 1.15, small cards out-rating the median giant 32.0%, even-match win rate
      ~44-50%, median fight 6 rounds.
- [X] **A playable prototype** — `prototype/index.html`. Five packs each side, the opposition
      commits first so you build against something visible, formation, and the event log replayed
      on the cards. Fictional deck, real engine; not in the deploy allowlist.
- [X] **The rebuild happened** (2026-08-05, as part of the Core Set rename — see above). Real
      dates and real elements now flow through; the "every card is Unaligned" fallback is gone
      on the new local build. **Not yet deployed**, so the *live* site is still on the old
      fallback path until `npm run deploy` runs.
- [ ] **UI in the real app** — team picker, battle screen, log replay. The prototype is the design,
      not the shipped feature.
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
