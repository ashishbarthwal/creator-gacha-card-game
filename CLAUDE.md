# Creator Gacha

Browser-based gacha game where YouTube channels become collectible trading cards.
Card stats are derived from real channel data, the same trick Wikigacha (Harusugi, Feb 2026)
plays with Wikipedia article metrics.

This is a portfolio piece and fan tribute. Not a business.

## Owner context

Ash — SDET moving into AI engineering. This repo is a portfolio artifact with two goals,
in order: **real users actually playing it**, and a **directed-AI-engineering showcase** —
the visible process (this file, PLAN.md, DECISIONS.md, tags + Releases, commit messages)
is itself the exhibit. Keep the receipts honest: docs must reflect reality, tags/badges
only for what exists.

**Commit naming (changed 2026-08-05):** sequential `WPn:` numbering is retired — work no
longer lands in a strict planned order, so a number implied a sequence that stopped being
true. Commit messages are now `WP-<Name>: <what and why>`, where `<Name>` is a short
descriptive slug for the body of work (e.g. `WP-Battle System: <...>`), not a position in
a queue. Historical `WPn` commits and tags are left as-is — they're a record of what
happened, not something to retcon.

Tests are the safety net, not the centerpiece (reframed 2026-07-18; WP1 delivered them —
56 tests, CI on every push, self-contained HTML reports). Ash is learning GitHub Actions
through this repo: for CI/workflow work, default to guide-and-explain so they type it,
unless they say otherwise.

## The core mapping

| Wikigacha | Creator Gacha |
|---|---|
| Article quality rank -> rarity | Subscriber count -> rarity |
| Pageviews -> ATK | Views **per video**, against what a channel that size manages -> ATK |
| Article length -> DEF | Views **per subscriber**, against the same -> DEF |

Rarity bands: N (<100K) -> R (<1M) -> SR (<10M) -> SSR (<50M) -> UR (50M+) -> RUBY (100M+)

The right-hand column changed 2026-08-09: it used to be raw `log10(count) * k *
RARITY[rarity].mult` computed in `core.js`, a SECOND derivation whose printed ATK correlated
with subscriber count at 0.897 while the engine ran at 0.187. Deleted; see "One derivation"
under Architecture, and DECISIONS.md 2026-08-09 for the full record.

## Battle balance — the 2026-08-15 rebalance is now the settled state

**The engine is tuned to a NEW philosophy as of 2026-08-15. Treat what follows as settled
unless a NEW measurement says otherwise**, and retune only against
`node tools/battle-balance.js`, never by argument.

**THE INVARIANT BELOW THIS LINE IS RETIRED, ON PURPOSE, BY ASH'S OWN INSTRUCTION — read this
paragraph before touching `BUDGET_GAIN` or any threshold in `tools/battle-balance.js`'s SIZE
block.** From 2026-08-09 to 2026-08-15 the design goal was "rarity must not decide the fight":
a well-shaped N could beat a median UR/RUBY 19% of the time, by construction, because the pull
fantasy at the time was "your best commons matter". Ash's 2026-08-15 brief overrode that goal
explicitly: subscriber count should now generally decide the fight — "a substantially more
popular creator should generally be a substantially stronger card" — with upsets surviving as a
real but RARE tactical possibility (element counters, class verbs, formation, speed, momentum,
luck), not a free ~1-in-5 shot from raw stats alone. **A change that makes the OLD 19% figure
true again is now the regression, not the guarantee.** Full record: DECISIONS.md 2026-08-15,
"Subscribers become the dominant term".

*What actually shipped (measured on the live 15,890-card deck):*
- `BUDGET_GAIN` 25 -> 170 (budget spread 1.12x -> ~2.0x from smallest N to biggest RUBY).
- Rarity now correlates cleanly with power: N 1.00x -> R 1.36x -> SR 1.55x -> SSR 1.73x ->
  UR 1.97x -> RUBY 2.05x (median `powerOf` per band, live deck).
- **A subscriber power floor.** A famous creator whose shape happened to dump its budget into
  weak multiplier stats (SPD/MOM) could previously rate near an N despite a huge budget — the
  literal "I pulled one of the biggest creators and somehow this card is garbage" complaint.
  `battle-stats.js` now rates a hypothetical even-shaped card of the same budget and floors the
  real card at `SUBSCRIBER_FLOOR_FRACTION` (0.82) of that reference, solved by bisection since
  `ratingOf` is not linear in a uniform stat scale. Only ever raises a rating, never lowers one.
- **Auto Select got an explicit hierarchy**, not just an emergent one. `opponent.js`'s
  `bestTeamFrom` now picks greedily by power, and only lets class diversity or (when an
  opponent is scouted) elemental advantage break a tie **within an 8% power window**
  (`SYNERGY_TOLERANCE`) — never wide enough to bench a card that is clearly stronger. See
  `pickBestTeam` in `opponent.js` and the "Auto Select must respect the power/rarity hierarchy"
  block in `test/battle.test.js`.
- Tactical upsets still work, verified two ways: `test/battle.test.js`'s "variance still
  produces different outcomes" test, and a throwaway probe against the real deck (recorded in
  DECISIONS.md) that built a small team hand-picked for class diversity and element counters and
  measured a **9.6%** win rate against a typical giant team over 500 seeds — rare, real, and
  tactics-driven, exactly as specified.

*Tried, measured, rejected under the OLD 2026-08-09 philosophy (kept as history — these
findings are still true statements about the ABSOLUTE-STAT-THRESHOLD trap, just no longer
describing the goal this engine is tuned toward):*

| Idea | What it actually did |
|---|---|
| Raise `BUDGET_GAIN` so rarity counts for more | N-above-median-UR 19% -> 4.4%. Was "kills the invariant" under the old goal — is now closer to the point. |
| Evasion keyed on SPD | small-out-rating-giant 29% -> 8% |
| Multi-action speed roll | same re-coupling, plus it barely moved class spread |
| Rescale `SCALE` (bigger SPD/MOM) | fights fall to 3-4 rounds, variety 2.83x -> 1.76x |
| Equalise/centre the five axes | class floor 3.9% -> 8.2%, but N-above-median-UR 19% -> 13% and marginal class balance gets *worse* |

**THE RECURRING TRAP, hit three separate ways under the old goal: every stat is budget-scaled,
and the budget is the only thing size buys — so any mechanic keyed to an ABSOLUTE stat
threshold silently re-couples power to subscriber count.** This is still worth knowing even
though re-coupling power to subscriber count is now the GOAL rather than the failure mode —
the trap is about a mechanism producing an effect nobody chose, and that lesson generalizes.
(It also bit `SPD_FLOOR` in an earlier pass; that comment tells the same story.)

**Measure the decision a player makes, not the tidiest number.** Two figures say Assassin is
broken — a 1.86x rating spread, and 6.3% in an all-one-class round robin — and *both are
misleading*: `powerOf` cannot see class verbs, and nobody fields five of one class. The honest
test holds four slots and swaps a rating-matched fifth; measured that way every class sits at
**47-60%**. `battle-balance.js` prints this as MARGINAL VALUE. Trust that row.

*Genuinely still open:* Bulwark 5.2% / Riser 4.7% of the deck, picking strategies ~78% against
a ~65% healthy ceiling, a momentum-built team winning ~0%, and Music at 47.6% of the element
wheel (a SOURCING skew — 234 of 246 Music cards carry a real genre slug, so `element.js` is
reading YouTube correctly and re-mapping cannot fix a population).

**THE "COLD MATCHMAKER" WAS DIAGNOSED 2026-08-15 AND IT IS NOT THE MATCHMAKER.** This line
used to read "matchmaker cold at 37.2%" and point at `aimedBuild`; both halves were wrong,
and the way they were wrong is the more useful lesson.

*The number was nine teams.* `battle-balance.js` spent its whole fight budget as `fights/40`
matchups re-fought 40 times each, so "37.2% over 360 fights" was 9 samples wearing a big
number — the per-matchup rates ran 17.5% to 85% on which nine got drawn. Fixed: the budget is
now spent as fights/6 DISTINCT matchups, drawn at random rather than as a consecutive slice
of a deck sorted by id, and the tool prints a confidence interval on matchups because that is
the sample size that exists. The honest reading is **33.2% +/- 4.1** over 500 matchups.

*The aim was never off.* Mean AI power drift is **+1.7%** — `aimedBuild`'s two-pass lift
correction works. The gap is that `pickForSlot` scores class variety, so the AI reliably
fields **4.36** distinct classes against a random player team's **3.00**, and `powerOf` prices
diversity at the stat lift alone. Bucketed by that gap the whole effect is visible: level on
classes the fight is **47%** — fair — and each spare class the AI has is worth roughly ten
points of win rate. `battle-balance.js` now prints that table under FIGHTS.

So this is **the recurring trap wearing a new hat**: not an absolute stat threshold this
time, but the same shape — a rating that cannot see a mechanic, used to price a team that
depends on it. The AI is simply playing the strategy the formation layer was built to reward.
Whether to make it stop is a DESIGN call (mirror the player's diversity in `matchOpponent`),
not a bug fix, and it is Ash's. What shipped instead is the honest half: the team builder now
compares your class count against the enemy's, because the ratings alone read "even" while a
3-vs-5 matchup is ~25%.

## Collection-size fairness — engine AND UI wiring shipped (2026-08-15)

Ash's brief also asked for a cap on how much a bigger collection can out-search a smaller one
in a 1v1: if the larger side's collection exceeds 1.5x the smaller side's, it gets a temporary,
rarity-weighted, semi-random slice to build from for that battle only — never a permanent
change to what anyone owns. **`src/engine/fairness.js` implements this fully and is fully
tested** (`test/fairness.test.js`, 26 tests): `needsShedding`, `eligibleSizes`, `shedCollection`
(protects at least one UR/SSR/SR when owned, RUBY deliberately unprotected but still favoured
over N/R/SR, bottom-heavy `KEEP_WEIGHT`, never clones or mutates a card), `shedSummary`,
`protectedRaritiesPresent`. Read the file's own header before changing a weight — the numbers
were tuned once already (RUBY's weight went 30 -> 12 after the first value made it survive
~99.7% of trial seeds, which is "can be shed" in name only).

**Wired into `src/ui/battle.js`'s `renderLobbyGate`**, which both sides run through the moment
acceptance is confirmed. Each side knows the OTHER side's collection SIZE — never their
collection — through two different channels: the challenger's size travels inside the challenge
code itself (`engine/challenge.js`'s `collectionSize` field, CODE_VERSION 2), and the defender's
size travels back via the `accept` op's `cs` field on `functions/api/ready/[room].js`, since the
defender has nothing else to send at that point. Only the LARGER side, when the gap clears 1.5x,
sees the "COLLECTION SIZE / CONTINUE / CHICKEN OUT" screen (brief item 20, exact copy).

`shedCollection` runs in `beginSharedBuild` — once both sides are through the lobby, not when
CONTINUE was pressed — so the eligible pool is decided immediately before the builder that reads
it, and never for a match somebody backed out of. `ui.eligiblePool` is what both the manual slot
builder and Auto Build read for the rest of that battle.

## The lobby — how a live challenge actually runs (2026-08-15)

**Read [REBALANCE-BRIEF-2026-08-15.md](REBALANCE-BRIEF-2026-08-15.md) items 8-14, 32 and 37 for
the screen copy this was built against, then read this section for where it ended up — the
shipped flow is stricter about symmetry than the brief asked for, on Ash's later instruction.**

```
send challenge (never carries a team)
        |
   they accept                <- server stamps `lobbyAt`
        |
   THE LOBBY, 10s, both sides          <- renderLobbyGate
     larger side:  COLLECTION SIZE / CONTINUE / CHICKEN OUT
     other side:   "they are confirming whether to go ahead"
     nobody builds; no answer by 0 = entered automatically
        |
   both sides `enter`         <- server stamps `buildStartAt` on the SECOND one
        |
   SHARED BUILD, 30s, blind, both sides <- renderSharedBuildScreen
     empty tray on both sides, every time
     READY locks independently; timer locks you on current picks
        |
   both locked                <- server stamps `bothAt`
        |
   face-off beat -> the fight
```

**Four things here are load-bearing and easy to break:**

1. **A challenge NEVER carries a team.** The "Build my team first" option existed and was removed
   — a challenger who has already chosen is not doing the same thing as the person opposite them.
   `createChallenge`, `onReply`, `ui.sentTeam` and the paste-a-reply box went with it.
2. **The build clock starts on the SECOND `enter`, not on `accept`.** This is the whole reason
   the lobby exists: only one side can ever face the fairness gate, and stamping the build clock
   at acceptance meant the other side built while they decided. Measured before the fix, a
   7-second deliberation cost the larger player 7 of their 30 seconds.
3. **Deadlines are resolved to a fixed local timestamp ONCE** (`adoptGateWindow`,
   `adoptBuildWindow`), never recomputed per tick. Recomputing `Date.now() + remainingAtFetch`
   looks equivalent and is not — the deadline advances in lockstep with the clock, so the
   countdown freezes, nobody is ever auto-locked, and the two sides freeze on different numbers.
   That bug shipped once; do not reintroduce it.
4. **`resetMatch()` owns everything one match holds.** A match is not the arena's lifetime.
   Every entry into a new one goes through it — mode-select, both Back buttons, CHICKEN OUT, the
   resend path, `openArena`. Keeping a second hand-maintained field list is how `buildDeadline`
   came to be cleared on open and nowhere else, which broke every fight after the first.

**The protocol, in `functions/api/ready/[room].js`** — four ops, and v1's `team`/`ready` are gone:
`accept` (carries the defender's collection size AND a random nonce claiming the defender's seat,
stamps `lobbyAt`), `enter` (through the lobby; the second one stamps `buildStartAt`), `bail`
(CHICKEN OUT, so the other side is told the match is off rather than waiting alone), and `lock`
(a side's final five as plain channel objects, not the packed copy-paste codec — this is a fetch
body, not something a human re-types). `lock` self-heals a missed `accept`/`enter`. Both locked
stamps `bothAt`.

**ONE DEFENDER PER CHALLENGE, AND A LOBBY THAT CAN FAIL (2026-08-16).** A challenge code is a
string, so two people can hold it — and two acceptances used to be indistinguishable from one.
Both took seat B, `enteredA` was never set, `buildStartAt` is stamped only when both sides are
through, and both players sat on `LOBBY — 00:00` until the room expired. The `enter` re-assert
could not save it: each side could see its OWN flag was true, so there was nothing to re-assert.
First accept now wins the seat (the nonce above); a second is answered `seatTaken` with NO write,
so the running match is untouched. Beyond that, **every screen that waits must be able to stop
waiting** — the lobby keeps CHICKEN OUT live after CONTINUE (disabling it left no way off the
screen), says so ~12s past its own deadline when the other side never arrives, and keeps polling
in case they turn up late. Full record: DECISIONS.md 2026-08-16.

**The poll loop re-asserts a lock the server does not have.** KV has no compare-and-set, and both
sides now auto-lock at the same instant by design, which makes a lost write the expected case
rather than a rare one. Lose it and a side is locked in its own browser, unlocked on the server,
and finished ticking — a lobby that waits forever.

**A CROSS-DEVICE CHALLENGE NOW REQUIRES THE LOBBY, which narrows locked decision 3.** The manual
copy-paste fallback worked by having the challenger commit a team the defender could scout and
answer by hand; that is irreducibly asymmetric, so it could not survive. What decision 3 actually
protects still holds — **the game works with no server**: Quick battle needs nothing. The send
screen probes for a lobby before offering the button, and the waiting screen names Quick battle
as the way on. The DEFENDER's manual path (`fightAsDefender`/`renderHandoff`/`renderReady`) is
left intact for a code that does carry a team, since older codes exist and decoding still
supports them.

## Quick battle — the AI has a collection, not a rating (2026-08-15)

The AI used to be built by `matchOpponent`: a team aimed at the player's exact rating out of the
whole 15,890-card set. Even by construction, and the wrong kind of even — **the AI was never a
player, it was a difficulty setting wearing five cards**, and a player's collection did not
matter because the opponent was rebuilt to their new rating either way.

It now rolls a COLLECTION: the same number of distinct cards the player owns, drawn on the same
band-first weighted odds from the same set (`rollAiCollection` / `collectionOpponent` in
`engine/opponent.js`), then builds its best five with the same Auto Select the player has. Same
rules both sides of the table — the model a live 1v1 already runs on.

It draws straight through `pullOne` rather than replaying x10s: no dupe bookkeeping, no reveal,
nothing the player sees. **The only property that has to survive is the drop curve, and
`bandsFrom`/`pullOne` ARE that curve** — the same two functions the pull screen uses, so the AI's
odds cannot drift from the player's without the player's drifting too.

**One trap, already sprung once and covered by `test/opponent.test.js`:** drawing against the
whole pool and discarding duplicates cannot exhaust a rare band. RUBY is 0.1% of the weight, so
on a pool holding two of them the chance of never rolling a specific one across a thousand draws
is 0.571 — under a try-cap the AI silently ends up with FEWER cards than the player, which is the
exact unfairness this exists to remove. A run of duplicates now rebuilds the bands from what is
left (weighted sampling WITHOUT replacement, not a uniform mop-up that would flatten the tail).

`matchOpponent`, `matchQuality` and the `DIFFICULTY` dial remain in `opponent.js`, tested and
unused by the UI — real capability, and the obvious raw material for a difficulty setting.

**None of the arena flow is covered by automated tests** — `src/ui/battle.js` is untested DOM
wiring by design (see "Prefer manual visual testing" in memory). 569 tests cover the engine
underneath it. Run TASKS.md's two-window checklist before trusting a change here.

## Locked decisions — do not reopen

1. **No monetization inside the game.** No paid pulls, no currency, no perks, no ads.
   Reasons: YouTube API ToS restricts commercial use, cards use creators' names and
   likenesses, and paid gacha invites gambling and minor-protection regulation.
2. **No monetization ANYWHERE — the one exception is now withdrawn (2026-08-15, Ash's call).**
   This entry used to carve out a single passive Buy Me a Coffee link in the footer. That link
   is gone from `index.html`, its styles are gone from `styles.css`, and `terms.html` now says
   plainly that there is no way to give the author money at all. **There is no donation link,
   tip jar, sponsor button or payment path of any kind, and adding one back is a fresh decision
   rather than a restoration.**

   Note which direction this moved: it does not reopen decision 1, it closes it further. The
   old carve-out was the only place money touched this project, and the hard rule attached to it
   (the coffee buys a coffee, it never unlocks anything) now holds trivially because there is no
   coffee. The reasoning behind that rule is still worth keeping in mind if the question ever
   returns — the moment a donation grants in-game value, every IP and legal problem comes back.
3. **Client-side only, with one named exception.** Static host (GitHub Pages / Cloudflare
   Pages / Netlify — currently Cloudflare Pages, moved off Netlify 2026-08-03 for free-tier
   credit limits). Users bring their own YouTube Data API key. Near-zero hosting cost.

   **Amended 2026-08-08 — Ash's call, and the amendment is the whole of what changed.**
   `functions/api/ready/[room].js` is the one piece of server-side code in the project: a
   two-player lobby holding ONE match under a hashed room id for ten minutes — accepted, two
   ready flags, and the defender's reply code.

   **Live since 2026-08-09.** KV namespace `creator-gacha-ready` is bound as `READY` on the
   Pages project, and a real cross-device 1v1 has been played on it. **Four ops write a room as
   of 2026-08-15** — `accept`, `enter`, `bail`, `lock`; v1's `team`/`ready` are gone. `accept`
   also carries a random per-match nonce claiming the defender's seat (2026-08-16) — it names a
   SEAT for ten minutes, not a person, and is never sent back out, so the "no account, no
   identity" promise below is intact. See "The
   lobby" section above for what each does and why. Three things to know before debugging a
   lobby that looks dead: **KV caches MISSES** for up to 60s and `cacheTtl` cannot go lower, so
   a room polled before it exists can read empty for a minute; a failed request is NOT the same
   as presence being off, which is why `presence.js` reports `off` and `error` separately and
   callers only give up on the former; and **a 404 on `/api/ready/…` IS settled `off`**, because
   this endpoint has no 404 branch — a 404 means the Function is not deployed at all (a static
   host, or `npx serve`, which cannot run Pages Functions).

   **AMENDED AGAIN 2026-08-15 — the cross-device duel now REQUIRES this endpoint.** The
   copy-paste fallback for a CHALLENGE is gone, because it worked by having the challenger
   commit a team the defender could scout and answer by hand, and that is irreducibly
   asymmetric. What this decision actually protects is intact: the game still works with no
   server — Quick battle needs nothing, and the arena says so rather than failing quietly. The
   promise that narrowed is "every fight has a serverless path", and it narrowed knowingly.

   **The 30-day cap was not the obstacle, and saying so was a mistake worth recording.** The
   first cut of this endpoint refused to touch card data on the grounds that stored statistics
   carry YouTube's 30-day cap. That cap is a MAXIMUM AGE, and ten minutes is comfortably inside
   it — so the reasoning was wrong, and correcting it is what allowed the lobby to carry a
   battle code at all. What the endpoint must still never receive is an **account, an identity,
   or a collection beyond the five cards someone chose to field**, because none of that is
   needed and all of it would be a real promise to break. The room id is derived independently
   by both browsers from the challenge code, so establishing a match still costs no round trip
   and the id is unguessable without the code.

   It must also stay **optional**: if the KV binding is missing or the request fails, the arena
   falls back to the manual countdown it shipped with. The game worked without a server for its
   whole life and still has to — a fight that cannot start because a service is down is a
   broken game. Anything beyond presence (relaying codes, lobbies, accounts) is a fresh
   decision and is *not* covered by this amendment.
4. **No build step.** Plain ES modules, served as-is. Vitest runs in dev only.
5. **Unofficial.** Footer must carry a disclaimer: not affiliated with or endorsed by
   YouTube or Google. (Wikigacha does the same for Wikipedia.)

## Who gets a card

**A person gets a card. An institution does not.** (2026-08-03)

This is a **risk** rule, not a taste one, and it decides every sourcing run from here on.
A creator like KSI has no reason to mind being on a card. A company, university, trade
association or studio has a trademark budget, a legal team and a written policy about its
marks. The downside is asymmetric — one side sends a thank-you, the other sends a letter —
and personalities are the one thing this project is not short of, so there is no cost to
refusing. Getting this wrong once meant pulling **8,379 cards out of a live deck**.

- **KEPT** — humans, and performer-shaped groups: bands, duos, musical ensembles, comedy
  troupes, channels whose Wikidata type is literally "YouTube channel".
- **CUT** — businesses, public companies, nonprofits, universities and school districts,
  government agencies, museums, record labels, publishers, think tanks, advocacy groups,
  sports clubs, TV series and channels, video games and their developers, brands.

**A band is a performer; its record label is not.** That one line is the whole rule, and it
is why the screen is a positive KEEP list of performer types rather than "anything that is
not a human" — the latter throws away every band in the deck.

Two mechanisms enforce it, and they are not interchangeable:

1. **`tools/wikidata-sweep.js` — authoritative.** Screens on Wikidata's **P31** ("instance
   of"), which asks what a thing IS rather than what it is called, so it knows "Traversy
   Media" is one man and "Rexam Plc" is not. Runs before any quota is spent.
2. **`looksInstitutional()` in `engine/discover.js` — backstop.** A narrow name screen for
   channels no encyclopedia describes (keyword-search results, hand rosters). It reads only
   a name, so it is deliberately narrow: **never** widen it with "media", "studios",
   "network", "group", "entertainment" or "official" — those are as common in a solo
   creator's channel name as in a corporation's, and a false positive here deletes a real
   creator silently. The known over-cuts are pinned in `test/discover.test.js`.

Two exclude files, and the split is about **state, not topic**:

- **`catalog/excluded.txt` — SETTLED.** Always applied. Editorial, revisable, and never to be
  confused with the opt-out denylist.
- **`catalog/excluded-institutions.txt` — STAGED.** Read and *reported*, never shipped, until
  `--apply-staged` / `npm run deploy:filtered` promotes it.

**A curation pass under review must not be able to reach production by default.** This is a
mistake being corrected: the 8,430 institution ids were appended into the settled file, so an
unreviewed judgement went live instantly and 42% of the deck vanished from a public site
before a line of it had been read. Filter, review, *then* publish.

### The machine proposes, Ash disposes

**Every filtration produces a review list, and Ash reads it.** The screens above decide the
easy 95% — a school district is not a judgement call. But *"Sidemen and OfflineTV are
fun-oriented and belong in the game"* is a judgement about what the game is **for**, and no
Wikidata claim encodes it. Do not make that call silently; surface it.

```
node tools/build-set.js      → reports/dropped-review.txt   SNAPSHOT, replaced every build
node tools/review-queue.js   → reports/review-queue.txt     WORKING COPY, merged, keeps marks
   Ash marks lines with a leading + (and notes, if useful)
node tools/reinstate.js --from reports/review-queue.txt
npm run deploy               → the cards are back
```

**Mark the queue, never the snapshot.** Review takes days, not one sitting, and the snapshot
is rewritten by every build — `review-queue.js` merges into a file that keeps your marks,
grouped by band and biggest first, so every decision worth arguing about is in the first few
hundred lines.

The two files are split for the reason everything here is split: the review list carries
titles and subscriber counts (**channel data — gitignored, never committed**), while
`catalog/excluded.txt` is ids only and safe for git. Ranked by subscribers because that is
the axis review runs on — a name worth arguing about is a name someone recognises.

## Scope boundaries

**Battles came INTO scope 2026-08-05 and shipped into the app 2026-08-08** — 5v5
auto-resolved combat (`engine/battle.js`, `battle-stats.js`, `element.js`, `opponent.js`),
an arena UI (`ui/battle.js`), and cross-device 1v1 through a pasted code
(`engine/challenge.js`). This line used to list them as out of scope; leaving that
standing would have made the file describe a game that no longer exists.

Still out of scope: decks beyond the five-card battle team, a pity system, `/c/`
vanity URL resolution (handles and UC ids only), accounts, and any server-side
persistence beyond the ten-minute match lobby named in decision 3 — no profiles,
no saved history, no ladder.

Card look (revised WP3): the metal-bevel **tier frame and the holo/tilt finish carry the
card** — that principle is unchanged. What changed is the avatar's role. It is no longer a
small inset; it sits as the centrepiece inside a metal ring. Because a real creator's face is
now prominent, two rules follow: the live adapter fetches the **highest-res thumbnail
available (up to 800px)** so it is not soft, and the finish layers are painted **below** the
avatar so the holo/glare never tint it. Still pull an accent color from the avatar, and keep
the channel initial as a **faint monogram** behind it.

## Architecture

Two things matter structurally:

**The data seam.** The bundled **demo set**, fetched **sets** (curated snapshot JSON),
and **live** sources produce an identical channel object shape, so nothing downstream can
tell them apart. This is why the app works offline (the demo set is bundled, not
fetched), why the tests never need an API key, why the demo set is a real set behind the
seam rather than a hack, and why versioned card sets ship as plain static files. The old
standalone "Demo" mode was folded into this bundled set in WP4 and carried the name
"Starter Set" until 2026-08-01, when it took the "Demo" label back — the fold is unchanged,
only the label (see DECISIONS.md).

**There is one user-facing mode: Sets.** **Live** (bring-your-own-key) went dev-only on
2026-08-03 — it still exists behind `?dev=1`, because the in-page Magic Search and the key
field live in its controls, but a player never sees a mode toggle. Note what this does NOT
change: locked decision 3 is about hosting, and the live adapter (`data/youtube.js`) is
still live pipeline code — `tools/add-candidates.js` imports it. The seam still has three
sources; only the UI stopped offering one of them.

**The pure core.** `rarityFromSubs` (core.js) and `battleStatsFrom` (battle-stats.js) are
pure and deterministic — no I/O, no randomness, no DOM. They sit between the seam and
everything stateful. This is the test target. They live in **`src/engine/`** with the pull
engine, which is the same boundary drawn once as a folder: everything in `engine/` runs
headless — no DOM, no network, no I/O. `gacha.js` takes its randomness as an injected
parameter, so it is deterministic under a seed and belongs there too.

**ONE DERIVATION. There is exactly one function that turns a channel into numbers, and it is
`battleStatsFrom`.** `core.js` owns the BAND and nothing else: `toCard` returns
`{ channel, rarity }`, carries no stats, and `RARITY` holds a pull weight with no multiplier.
The collection card, the battle card and the fight all read the same five numbers. This is a
rule, not an accident — it replaced a second derivation whose printed ATK correlated with
subscriber count at 0.897 while the engine ran at 0.187 (see below). **Never add a second
place that computes a stat**, and never store a derived number on a card: a card that carries
only its source and its band cannot drift.

```
input (@handle | URL | UC id)
        |
   resolve to channelId
        |
   +------------+------------+---------+      <- the seam
   |            |            |
 demo set     sets (JSON)  live (YouTube Data API v3)
 (bundled)    (fetched)    (user key)
   |            |            |
   +------------+------------+---------+
        |
  band          (PURE)  <- rarityFromSubs          core.js  | src/engine/
        |                                                   |
  gacha engine (band-first weighted pull, x1/x10, dupes)    | headless
        |                                                   |
  collection state                                          |
        |                                                   |
  stats         (PURE)  <- battleStatsFrom   battle-stats.js|
        |            the ONLY derivation. Feeds the card     |
        |            face, the battle card and the fight.    |
  card render + reveal
```

## Conventions

- Vanilla JS, ES modules, no framework, no bundler.
- **The tree is organized by what a module may touch.** A new file's home follows from
  that one question, not from its topic:
  - touches nothing (pure, headless) → `src/engine/` — `core.js` derivation, `gacha.js`
    pull, `discover.js` Magic Search sourcing core, plus the battle layer (`battle.js`,
    `battle-stats.js`, `element.js`, `opponent.js`) and `challenge.js`, the battle-code
    codec. `engine/core.js` imports nothing; if it ever needs an import, the design is wrong.
  - touches the network → `src/data/`, behind the seam. `presence.js` lives here too — it is
    the only module that talks to a server of ours, which is exactly the question this folder
    answers.
  - touches the DOM → `src/ui/`.
  - `state.js` (mutable app state) and `main.js` (wiring) are neither, and stay at the root.
  - runs on the SERVER → `functions/`. One file, and it is the only one — a Cloudflare Pages
    Function compiled into the upload by `tools/build-site.js`. Anything added here reopens
    decision 3, so nothing should be.
  - explains the game to a human → `Battle Layout/`. Reference documents about how the game
    works, not code and not shipped with the site. `battle-system.html` is the combat
    reference: derivation, the five stats, six classes with real cards, the element ring, the
    damage formula. **Every number in it is measured** — regenerate them with
    `node tools/battle-balance.js` rather than editing figures by hand, or it becomes the
    thing this repo most dislikes, a confident document that disagrees with its own code.
- Fonts: Anton (display), Space Grotesk (body), Space Mono (stats/numbers).
- Palette: dark plum stage, YouTube-red accents.
- Record any new decision that closes off an option in `DECISIONS.md`.
