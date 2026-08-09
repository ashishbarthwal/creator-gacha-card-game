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

## Battle balance — already measured, do not redo

**The engine is tuned. Treat these as settled unless a NEW measurement says otherwise**, and
retune only against `node tools/battle-balance.js`, never by argument.

*The invariant to preserve.* Median power climbs 396 -> 470 across the bands (**1.19x**), a
top-decile N beats the median UR/RUBY, **19%** of N cards clear it and **0%** clear the best
one. That is "your best commons beat a mediocre legendary, nothing beats the best one" — the
shape Ash asked for. Any change that moves the 19% materially is a regression.

*Tried, measured, rejected (2026-08-09):*

| Idea | What it actually did |
|---|---|
| Raise `BUDGET_GAIN` so rarity counts for more | N-above-median-UR 19% -> 4.4%. Kills the invariant. |
| Evasion keyed on SPD | small-out-rating-giant 29% -> 8% |
| Multi-action speed roll | same re-coupling, plus it barely moved class spread |
| Rescale `SCALE` (bigger SPD/MOM) | fights fall to 3-4 rounds, variety 2.83x -> 1.76x |
| Equalise/centre the five axes | class floor 3.9% -> 8.2%, but N-above-median-UR 19% -> 13% and marginal class balance gets *worse* |

**THE RECURRING TRAP, hit three separate ways: every stat is budget-scaled, and the budget is
the only thing size buys — so any mechanic keyed to an ABSOLUTE stat threshold silently
re-couples power to subscriber count.** Assume this of the next such idea too. (It also bit
`SPD_FLOOR` in an earlier pass; that comment tells the same story.)

**Measure the decision a player makes, not the tidiest number.** Two figures say Assassin is
broken — a 1.86x rating spread, and 6.3% in an all-one-class round robin — and *both are
misleading*: `powerOf` cannot see class verbs, and nobody fields five of one class. The honest
test holds four slots and swaps a rating-matched fifth; measured that way every class sits at
**47-60%**. `battle-balance.js` prints this as MARGINAL VALUE. Trust that row.

*Genuinely still open:* Bulwark 5.2% / Riser 4.7% of the deck, picking strategies ~78% against
a ~65% healthy ceiling, matchmaker cold at 37.2%, a momentum-built team winning ~0%, and Music
at 47.6% of the element wheel (a SOURCING skew — 234 of 246 Music cards carry a real genre
slug, so `element.js` is reading YouTube correctly and re-mapping cannot fix a population).

## Locked decisions — do not reopen

1. **No monetization inside the game.** No paid pulls, no currency, no perks, no ads.
   Reasons: YouTube API ToS restricts commercial use, cards use creators' names and
   likenesses, and paid gacha invites gambling and minor-protection regulation.
2. **One exception:** a single Buy Me a Coffee link in the footer. Passive, understated,
   no popups, no nags. **Hard rule: the coffee buys Ash a coffee. It never unlocks
   anything in the game.** The moment a donation grants in-game value, every IP and legal
   problem comes back.
3. **Client-side only, with one named exception.** Static host (GitHub Pages / Cloudflare
   Pages / Netlify — currently Cloudflare Pages, moved off Netlify 2026-08-03 for free-tier
   credit limits). Users bring their own YouTube Data API key. Near-zero hosting cost.

   **Amended 2026-08-08 — Ash's call, and the amendment is the whole of what changed.**
   `functions/api/ready/[room].js` is the one piece of server-side code in the project: a
   two-player lobby holding ONE match under a hashed room id for ten minutes — accepted, two
   ready flags, and the defender's reply code.

   **Live since 2026-08-09.** KV namespace `creator-gacha-ready` is bound as `READY` on the
   Pages project, and a real cross-device 1v1 has been played on it. Three ops write a room:
   `accept`, `team` (here are my five) and `ready` (I am ready) — the last two are separate
   because conflating them let a fight start that one player never agreed to. Two things to
   know before debugging a lobby that looks dead: **KV caches MISSES** for up to 60s and
   `cacheTtl` cannot go lower, so a room polled before it exists can read empty for a minute;
   and a failed request is NOT the same as presence being off, which is why `presence.js`
   reports `off` and `error` separately and callers only give up on the former.

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
