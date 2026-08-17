# Work Packages — checklist

Working checklist. **Rationale lives in [DECISIONS.md](DECISIONS.md), history in the git log** —
this file is only "what is done, what is next". A WP is for **architectural** work: a new seam,
a new guarantee, a new capability. Recurring work goes under Miscellaneous and is never tracked
individually.

**Now:** LIVE at https://creator-gacha.pages.dev serving **"Core Set", 20,739 cards**
(snapshot **2026-08-15**), deployed **2026-08-17** at `b4e873a` — the live site and the repo
match, verified by fetching the deployed `styles.css`, `src/ui/reveal.js` and
`src/ui/collection.js` and confirming each carries the change it should. Production now holds
the 2026-08-15 body of work (the arena lobby, the shared blind build phase, the AI collection
model, the pack-opening summon, the coffee-link removal), the 2026-08-16 run (chaos pass, card
finish, mobile pull path, shareable links, One Deck), and the 2026-08-17 twinkle pass. The live
KV lobby is confirmed running the four-op protocol (`accept`/`enter`/`bail`/`lock`).
**578 tests pass.**

**This was a CODE-ONLY deploy** — `build:site` + `wrangler pages deploy`, deliberately not
`npm run deploy`. The full script starts with `build-set.js`, which would have rebuilt the deck
from the **staged, unreviewed** candidate batch described in NEXT item 3 and published ~2,000
cards nobody has read. Use the code-only path for any change that does not touch the deck; see
the deck-refresh note in NEXT item 4 for when the full script is the right one.

*(The 2026-08-16 deploy was never recorded — `record-deploy.js` did not run after it — so the
refresh log skips from 2026-08-15 to today. Nothing is wrong with the deck; the receipt just has
a gap, and it is noted here rather than back-filled with a timestamp nobody measured.)*

**Run it locally with `npm run dev`** (`wrangler pages dev`, default `http://localhost:8788`).
That is the only command that serves the site AND runs `functions/api/ready/[room].js` against a
local KV namespace, so it is the only way to exercise a challenge. `npm run dev:static`
(`npx serve`) is static-only and answers 404 for `/api/ready/…`, which the app now correctly
reads as "no lobby today".

**⚠ READ CLAUDE.md FIRST for anything touching battle, the arena or the pull screen.** Four
sections there carry the reasoning and the traps: "Battle balance — the 2026-08-15 rebalance is
now the settled state", "Collection-size fairness", "The lobby — how a live challenge actually
runs", and "Quick battle — the AI has a collection, not a rating". They supersede everything
below this paragraph that mentions the OLD invariant (19% N-above-median-UR) — that was
**deliberately reversed** on Ash's instruction, not regressed. Do not "fix" it back.

**DONE 2026-08-15, do not redo.** All of it shipped to production on 2026-08-16 and is live.
What is still outstanding is *watching* it run with two humans — see NEXT item 1.

*The 40-item brief:*
1. **Subscriber count dominates raw power** (items 1-3). `BUDGET_GAIN` 25 -> 170 plus a
   subscriber power floor (`SUBSCRIBER_FLOOR_FRACTION`, `battle-stats.js`). N 1.00x -> RUBY
   2.05x median.
2. **Auto Select has an explicit power/rarity-first hierarchy** (items 4-6). `bestTeamFrom`/
   `pickBestTeam` in `opponent.js`: greedy by power, diversity/element break ties inside an 8%
   window only.
3. **Collection-size fairness**, engine and UI (items 15-27, 33-35). `src/engine/fairness.js`
   + `test/fairness.test.js` (26 tests); the CONTINUE/CHICKEN OUT screen lives in the lobby.
4. **CODE_VERSION 2** — a challenge may carry no team, every code carries `collectionSize`.
5. **The challenge flow rework** (items 8-14, 32, 37) — see CLAUDE.md's "The lobby".
6. **In-arena field manual** — `src/ui/codex.js`, built from live engine exports so it cannot
   drift from the code.

*Follow-ups the same day, after playtesting caught real bugs:*
7. **The lobby** — acceptance opens a 10s decision window both sides sit in; the 30s build clock
   starts on the SECOND `enter`, not on `accept`. Fixes the last asymmetry: the side facing the
   fairness gate used to lose its deliberation time from its build time (measured: 7s of 30).
   `bail` (CHICKEN OUT) now reaches the room.
8. **Countdown arithmetic** — deadlines are resolved to a fixed local timestamp once, not
   recomputed per tick. The old form froze the clock, never auto-locked, and left the two sides
   showing different numbers.
9. **`resetMatch()`** — a match is not the arena's lifetime. Every new match resets through one
   function; the second fight of a session used to inherit the first one's dead state.
10. **"Build my team first" removed** and the deck tray starts empty on both sides, every time.
    Consequence: a cross-device challenge now REQUIRES the lobby (locked decision 3 narrowed —
    Quick battle still needs no server).
11. **The AI rolls its own collection** — same size as the player's, same odds, best five.
    Replaces power-matching. `test/opponent.test.js`, 7 tests.
12. **Pack-opening summon** — `src/ui/packopen.js`, ~1s, rarity-teased, skippable. Plus the
    reveal's "Pull again" loop and a rewritten empty-binder state.
13. **The Buy Me a Coffee link is gone** from the site and every doc (Ash's call). No donation
    path anywhere; locked decision 2 withdrawn.

**LAUNCH BLOCKERS — the three found 2026-08-16 when Ash asked how to launch properly.**

1. [x] **Shareable links.** `index.html` had a `<title>` and nothing else, so every link posted
   to Reddit, Discord, WhatsApp or Twitter rendered as a naked URL — no image, no description,
   on a game whose whole appeal is what the cards look like. Now carries og: + twitter: tags, a
   description and a canonical, all absolute.
   - [ ] **ONE MANUAL STEP LEFT, and the tags are pointing at a 404 until it is done:** open
         `og.html`, DevTools → right-click the `div.og` node → "Capture node screenshot", save as
         `og.png` in the repo root, redeploy. `build-site.js` ships it when present and prints a
         loud warning when it is not. Faces in it are EMBLEMS, not photos — see the note at the
         top of og.html for why that one is not a close call.

2. [x] **Knowing whether anyone came — NEEDS NO CODE, and deliberately none.** Cloudflare Pages
   already collects requests, bandwidth and top paths server-side for this project: dash →
   Workers & Pages → creator-gacha → **Analytics**. Nothing is deployed, nothing touches a
   visitor, and it is already recording — so it just needs looking at.
   **Do NOT switch on Cloudflare "Web Analytics".** That is a different product: it injects a
   client-side beacon that phones home on every pageview. Cookieless, but the footer promises
   "No accounts, no tracking", and a script reporting each visit is the thing that sentence
   tells people is not happening. The free server-side numbers answer "did anyone play" without
   spending the promise.

3. [x] **KV quota leaks.** Free tier is 100,000 reads and 1,000 writes a day; the arena is the
   only thing spending either. A tab left on the waiting screen or an empty lobby polled
   FOREVER at ~3,000 reads/hour, so two forgotten tabs could have taken the day's budget and the
   symptom would have been the lobby failing for real players. Fixed three ways: poll chains stop
   at the room's own ten-minute TTL and say so on screen, hidden tabs do not poll at all, and the
   challenger's screen backs off 1.2s → 3s → 5s because a cross-network accept cannot show up
   faster than KV's 60s cache anyway. A ten-minute wait costs ~140 reads instead of ~500.
   - [ ] Still true and worth watching after launch: **~150 cross-device matches/day** is the
         WRITE ceiling (5-10 writes each against 1,000/day). Quick battle costs nothing, so the
         main game is immune. If the lobby starts failing, check writes before anything else.

**BEFORE POSTING ANYWHERE — Ash's own call, not a technical item.** DECISIONS.md's plan was an
Indian lawyer consult pre-real-launch, with real profile pictures flagged as the biggest likeness
exposure and `AVATAR_SOURCE` built as the reversible escape hatch. A live site and a site being
actively promoted are different exposure levels. Three honest options: launch on emblems
(`AVATAR_SOURCE = 'emblem'`), launch on photos with the opt-out link and a same-day takedown
commitment, or take the consult first. Decide it rather than letting launch day decide it.

**NEXT — start here.**
1. **Run the two-window checklist below against production**, or against `npm run dev`. The
   arena is untested DOM wiring by design; 578 tests cover the engine under it and none of them
   touch `src/ui/battle.js`. The lobby has never been watched by two humans at once.
2. **Watch the pack summon in a real browser** and tune `CHARGE_MS` in `src/ui/packopen.js` if
   ~1s drags by the tenth pull. Nobody has seen it in motion yet.
3. **A sourcing run is staged and not yet built.** `catalog/candidates.json` is +10,181 lines
   uncommitted, with untracked `catalog/reach-11*.txt` / `reach-12*.txt` alongside it.
   `npm run status` reports **31,305 candidate ids, 22,781 shipping** against the 20,739 in the
   live deck, and flags "roster changed since the last build". Decide whether that batch is
   reviewed and wanted, then commit it and `npm run deploy`; leaving it uncommitted means the
   next session cannot tell a staged roster from a stray edit.
4. **The deck's own refresh is NOT yet due** — snapshot is 2026-08-15, so the 25-day cadence
   puts the next rebuild around **2026-09-09** and the 30-day statistics cap bites on
   **2026-09-14**. `npm run deploy` re-hydrates (~318 quota units) and ships in one step. If
   item 3 goes ahead it resets both dates, since it rebuilds the set on the way through.
5. **The scheduled refresh job has failed twice in a row** (runs #2 and #3, 2026-08-09 and
   2026-08-16 — `node tools/refresh-runs.js`). The deck is fresh because it has been deployed
   by hand, which is exactly the condition that hides a broken alarm until the day it is needed.
6. Everything below this point is the OLDER backlog, from before the 2026-08-15 brief. Still
   real, still open, lower priority.

**Manual test checklist — two windows (or two devices), against `npm run dev`.**
- [ ] **Challenge, live room.** Window A: Challenge someone -> Send the challenge. Paste the code
      into window B -> Challenge accepted. Both windows should show **LOBBY — 00:10** counting
      down together, and NEITHER should be able to build during it.
- [ ] **The gate is one-sided but the wait is not.** With one profile holding a much larger
      collection, confirm only the larger side sees COLLECTION SIZE / CONTINUE / CHICKEN OUT, the
      smaller side sees "your opponent is confirming whether to go ahead", and both see the same
      lobby clock.
- [ ] **Auto-enter.** Let the lobby hit 00:00 with nobody pressing. Both should enter and the
      30s build clock should start together.
- [ ] **Both build clocks match.** In the shared build phase the two windows must show the SAME
      number, ticking. (They once froze at 30 and 26.)
- [ ] **Independent lock.** Press Ready in A only: A's slots/pool/Auto-pick/Clear stop responding,
      A reads "waiting on them", B still edits freely. Lock B -> both move to "Both locked in" and
      the fight starts without waiting out the timer.
- [ ] **Build auto-lock.** Let the build clock reach 00:00 in one window with 2-3 slots filled —
      it should top up to five via Auto Select and lock, not stall.
- [ ] **CHICKEN OUT reaches the other side.** The waiting player should be told the match is off,
      not left building alone.
- [ ] **One defender per code** (the 2026-08-16 freeze). Paste the SAME challenge code into a
      THIRD window: it must say the challenge has already been accepted, and windows A and B must
      carry on to the build phase undisturbed. Before the seat was claimable this deadlocked
      everyone on LOBBY — 00:00, because two browsers held seat B and nobody held seat A.
- [ ] **A lobby nobody joins.** Accept a challenge, then close the challenger's window. About 12s
      past 00:00 the survivor must say the opponent never came through and offer Back out —
      and CHICKEN OUT must still be pressable after CONTINUE, not greyed out with it.
- [ ] **A second match in the same session.** Finish a fight -> New opponent -> challenge again.
      The lobby and build clocks must start fresh, and BOTH trays must be empty.
- [ ] **Empty tray, always.** Neither side opens the shared builder holding cards.
- [ ] **No lobby.** Run `npm run dev:static` instead: "Challenge someone" should disable the send
      button and explain, and Quick battle should still work perfectly.

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
      **The 37.2% is left as recorded, and annotated rather than restated** — same rule the
      `WPn` tags follow. It is what the tool printed that day; what has since changed is the
      tool. That figure was 9 matchups re-fought 40 times, which is why no CI sits beside it.
      Re-measured properly on 2026-08-15: **33.2% +/- 4.1** over 500 matchups, and the cause
      is a class-diversity gap rather than the matchmaker's aim (see Next, item 2).
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
- [X] **"Class ratings span 1.86x" — INVESTIGATED AND WITHDRAWN 2026-08-09.** The figure is
      real and the conclusion drawn from it was wrong. `powerOf` cannot see a class verb, and
      Backstab bypasses a whole rank. An all-one-class round robin looks worse still (Assassin
      6.3%, a 12.9x spread) and is equally misleading, because **nobody fields five Assassins**
      — five low-attack cards cannot between them kill anything. Measured the way a player
      actually decides, holding four slots and dropping in a rating-matched fifth, every class
      lands between **47% and 60%** and an Assassin contributes more than a Titan.
      `tools/battle-balance.js` grew a MARGINAL VALUE section so the next reader is not
      misled the same way. Acting on the 1.86x would have cost real size-neutrality.
- [ ] **Three of six classes are under 6% of the deck** — Bulwark 5.2%, Riser 4.7%,
      Balanced 3.9%, against Titan's 37.7%. Still open, and it has a known cause: `maturity`
      is the one axis not centred where the other four are (deck median 65 against ~50), so
      the median card is a Titan by construction. **Every fix measured so far costs more than
      it buys** — centring maturity and equalising all five axes lifts the floor to 8.2%, but
      drops the share of N cards out-rating the median UR/RUBY from 19% to 13% and makes
      marginal class balance *worse* (12.2 → 25.6 points). Worth revisiting only with a
      mechanism that does not trade against the upset structure.
- [ ] **Music is 47.6% of the element wheel — SOURCING, not mapping.** Diagnosed 2026-08-09
      with a 500-channel hydrate (10 quota units): 50.6% of the deck carries a `music` topic
      and **234 of 246** Music cards carry a specific genre slug (`pop_music`, `rock_music`,
      `independent_music`), not the bare generic tag. `element.js` is reading YouTube
      correctly; YouTube really does think half this deck is musicians, which follows from
      sourcing notable people out of Wikidata. It dilutes the ring — the counter to Music
      (Knowledge) is 10.6% of the deck — but a seventh element was already rejected on its own
      merits and re-mapping cannot fix a population. Fixable only at the sourcing layer.
- [ ] **A momentum team still loses essentially everything** — the "fastest growing" strategy
      averages **0.9%** across the strategy matrix, and 0.0% against a diverse team. The
      2026-08-08 repricing raised MOM's scale and cap and moved the needle for individual
      Risers, but building *around* growth is still not a strategy. Related to the speed item
      below; both are stats that multiply an attack the card could not afford. Note the
      constraint any fix must respect: raising MOM's or SPD's scale re-amplifies SIZE, because
      every stat is budget-scaled — measured, it cuts small-cards-out-rating-giants from 29%
      to 7%.
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
- **Card visuals, CSS, page layout, copy tweaks.** The 2026-08-15 pack-opening summon
  (`src/ui/packopen.js`), the reveal's "Pull again" loop and the rewritten empty-binder state
  all landed under this line rather than as a WP — polish, not architecture. The one thing in
  them worth reading before changing is the DECISIONS.md entry on why the summon deliberately
  leaks the pull's best rarity when `ui/reveal.js` deliberately hides it.
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
- [X] **WP2 — Footer.** Not-affiliated disclaimer. The Buy Me a Coffee link it also shipped was
      **removed 2026-08-15** (Ash's call) — no donation path remains anywhere.
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
