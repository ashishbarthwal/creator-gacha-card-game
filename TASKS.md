# Work Packages — checklist

Working checklist. **Rationale lives in [DECISIONS.md](DECISIONS.md), history in the git log** —
this file is only "what is done, what is next". A WP is for **architectural** work: a new seam,
a new guarantee, a new capability. Recurring work goes under Miscellaneous and is never tracked
individually.

**Now:** LIVE at https://creator-gacha.pages.dev serving **"Core Set", 15,831 cards**
(snapshot **2026-08-06** — that is what the CDN is serving). A fresh hydrate ran **2026-08-09**
and `sets/built/core.json` is now stamped 2026-08-09, same 15,831 cards, 4 candidates vanished
— but **that is a local file until `npm run deploy` uploads it.** Building resets the clock on
this machine; deploying is what resets it for players. Both were 3 days old at the time, well
inside the 25-day cadence, so nothing was at risk either way.
Everything below that was once "built, not deployed" has shipped:
**RUBY** went live 2026-08-07 (`da4a635`), and the **arena** — battles, the team builder and
the two-player lobby — went live 2026-08-08 (`7c2fa72`). 452 tests pass.

**This file was stale until 2026-08-09** and the correction is worth recording rather than
quietly overwriting: three separate sections still read "not yet deployed" for work that had
been on the public site for days, and one open finding had already been acted on. The receipts
are the exhibit here, so a checklist that disagrees with the deploy log is a defect in its own
right.

**Next:** refit `VELOCITY_TREND` against **real** channel ages. It is the last constant in
`engine/battle-stats.js` still fitted against a synthetic age profile — the file says so itself
and names the trigger: "refit after the first build that ships `publishedAt`". That build
happened on 2026-08-05, so the trigger has fired and the refit has not. `punch`, `devotion` and
`cadence` were all refitted against the live deck on 2026-08-08; velocity is the odd one out.
Measure with `node tools/battle-balance.js`, never by argument.

---

## Open

### WP-Ruby Tier — a real sixth band for 100M+ (LIVE 2026-08-07)
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
- [X] **Deployed 2026-08-07** (`da4a635`, "Record deploy: RUBY admire-screen visuals live") —
      core, 15,831 cards, composition unchanged by the deploy itself. The live site runs the
      six-band pull table and the `.r-RUBY` frame.
- [X] **The admire screen** (`f29abd1`) — gem-cut refinements and a museum-display sequence,
      plus stars on it (`0969fbe`), which is the one thing moving on a phone at that moment.
      Two card-finish fixes landed alongside: the black cutout ring (`bc79e63`) and a mobile
      holo rework that dropped gyro tilt (`69982a7`).
- [ ] Nobody has looked at the reveal animation or the collection-grid RUBY card in a real
      browser **since the finish rework**. The band itself is covered by
      `test/gacha.test.js`/`test/core.test.js`; the visuals are not testable from the suite.

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
- [X] **The size-correlation finding was acted on** (2026-08-08, `662fd73`). Cadence and
      devotion correlated with channel size at 0.42 and 0.35, well past the tool's ~0.25
      "stopped being size-free" flag — so both were de-sized against Influence the same way
      `punch` always had been, with `DEVOTION_TREND`/`CADENCE_TREND` fitted on the live deck
      and then frozen. Measured after: devotion **-0.013**, cadence **0.027**. Those two feed
      DEF and SPD, so this was the single biggest way size still bought power, and it is also
      why picking a team by subscriber count used to work.
- [X] **Deployed 2026-08-05** (`e509076`, "WP-Core Set: … deploy").

### WP12 — Battle system — LIVE 2026-08-08
5v5, auto-resolved, against an AI matched to the player's own team power. Rationale and the
three measured failures behind the design are in DECISIONS.md.

**This section used to say "client-side only, so locked decision 3 is untouched", and that
stopped being true on 2026-08-08.** Decision 3 was *amended* — not overturned — for exactly one
file: `functions/api/ready/[room].js`, a two-player lobby holding one match under a hashed room
id for ten minutes. It must stay optional, and it is: no KV binding, a failed request or being
offline all fall back to the copy-paste flow the arena shipped with.
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
- [X] **117 tests** across `battle` and `element` (452 in the suite overall), including a balance
      block that asserts the design goals rather than hoping. Figures below are measured against
      the **2026-08-09 rebuild** with `node tools/battle-balance.js`, not carried over: attack
      flat with size at **0.94**, power median ratio **1.13**, small cards out-rating the median
      giant **29.5%**, even-match win rate **37.2%**, median fight **6** rounds, 100% decided by
      elimination.
- [X] **All five axes are size-free on real data** — the thing the residual trends exist to
      guarantee, now confirmed against real ages rather than synthetic ones. `corr(size)`:
      maturity 0.189, punch -0.004, devotion -0.027, cadence 0.038, velocity -0.058, all well
      inside the ~0.25 flag. The 2026-08-08 de-sizing of devotion and cadence holds up.
- [X] **A playable prototype** — `prototype/index.html`. Five packs each side, the opposition
      commits first so you build against something visible, formation, and the event log replayed
      on the cards. Fictional deck, real engine; not in the deploy allowlist.
      **Superseded by the shipped arena** — kept as the design record, not a live path. The
      shipped app deliberately does not import from it (`ui/battle.js` re-implements mulberry32
      rather than depend on a file that exists to be thrown away).
- [X] **The rebuild happened** (2026-08-05, as part of the Core Set rename — see above) **and
      shipped** (`e509076`). Real dates and real elements flow through on the live site; the
      "every card is Unaligned" fallback is gone.
- [X] **UI in the real app** — `src/ui/battle.js` (`4fd217a`), reached from the ⚔ Battle button.
      Team picker with front/back ranks, matchup preview against a scouted enemy, the formation
      bonus shown while it is still a choice, and the event log replayed on the cards. Wiring
      only: every rule it enforces comes from `engine/`.
- [X] **Cross-device 1v1 without a backend** — `engine/challenge.js` (`4fd217a`). A whole fight
      folded into a pasteable `CGB1.` string: both teams, the seed, and a pinned `now`, so two
      windows replay the identical fight hit for hit rather than merely agreeing on a winner.
      The reply carries **inputs, not a verdict** — the challenger re-resolves, so a claimed
      outcome cannot be taken on trust. Not tamper-proof, and `challenge.js` says so plainly:
      detecting an edited team needs a secret, and a secret needs a server.
- [X] **The lobby** — `functions/api/ready/[room].js` + `data/presence.js` (`d336cac`). Live on
      KV since 2026-08-08; a real cross-device 1v1 has been played on it. Two lessons pinned in
      the code: **readiness is something a person does**, so `team` and `ready` are separate ops
      (conflating them started a fight one player never agreed to), and **a dropped request is
      not a missing lobby**, so `presence.js` reports `off` and `error` separately.
- [X] **The balance pass** (`fa22642`) — the game was solved, and not for the reason it looked
      like. "Bring your five highest-rated cards" beat everything 87-100%, and an accurate
      rating is exactly what produces a total order, so the fix had to be something the rating
      cannot see: a **formation bonus** on the number of distinct classes fielded. Auto-pick is
      greedy on card rating, so it can no longer see the bonus either — it stops being optimal
      and becomes a baseline a thinking player beats.
- [X] **The repricing** (`662fd73`) — five specialists built from one budget came out HP 83.9% /
      ATK 82.7% / DEF 39.7% / SPD 20.0% / MOM 4.7%. A point spent on momentum bought a
      seventeenth of what the same point bought on health, which is not a trade-off but a trap.
      MOM's scale and cap both rose; `AXIS_FLOOR` went in so **nobody is zero at anything**
      (3.7% of the deck was walking into fights with an attack of 1); crit moved off cadence
      onto **punch**, where "this channel's uploads land above its weight" actually means
      something.
- [X] **A combat reference for humans** — `Battle Layout/battle-system.html` (`50ec6e0`). Every
      number in it is measured; regenerate with `node tools/battle-balance.js` rather than
      editing figures by hand.
- [ ] **Refit `VELOCITY_TREND` against real ages** — the one constant still fitted on a
      synthetic age profile. See "Next" at the top.
- [ ] Decide whether individual matchups should stay deterministic (see DECISIONS.md — currently
      a fight is decided by composition, not luck, which is what auto-battle means).
- [ ] **Three findings from the 2026-08-09 rebuild, measured and not yet acted on.** None
      breaks a threshold; all three are the same shape of problem the repricing was aimed at,
      surviving it.
      - **Class ratings span 1.86x** and the tool flags it itself: *"WIDE — the weak class is
        one the matchmaker will stop picking."* Carry rates 462, Assassin 249. Assassin is
        24.8% of the deck, so a quarter of all cards sit in the worst-rated class — the same
        failure that got Speed its second action in the first place, re-appearing one layer up.
      - **Three of six classes are under 6% of the deck** — Bulwark 5.2%, Riser 4.7%,
        Balanced 3.9%, against Titan's 37.7%. The formation bonus rewards fielding four or five
        distinct classes, which is hard to do when half the roster does not exist.
      - **Music is 47.6% of the element wheel.** Nearly half the deck is one element, while
        Tech is 3.6%. The counter-pick layer is the reason team-building is a decision rather
        than a sort, and it is lopsided: the element that beats Music (Knowledge) is 10.6% of
        the deck. Worth checking whether this is YouTube's `topicCategories` being generous
        with the music tag before it is treated as a mapping problem in `element.js`.
- [ ] **A momentum team still loses essentially everything** — the "fastest growing" strategy
      averages **0.9%** across the strategy matrix, and 0.0% against a diverse team. The
      2026-08-08 repricing raised MOM's scale and cap and moved the needle for individual
      Risers, but building *around* growth is still not a strategy. Related to the speed item
      below; both are stats that multiply an attack the card could not afford.
- [ ] **Speed is still the weakest place to spend a budget** (~20% against a 50% target), and
      `battle-stats.js` records why the fix is partial by construction: `extraActionChance` is a
      probability, so even a perfect roll buys one extra swing, and two swings of a budget
      attack lose to one swing of a real one. Closing it needs a *second* thing for speed to
      buy — evasion, or a genuine multi-action roll — not another constant.

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
