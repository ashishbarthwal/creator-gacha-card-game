# Creator Gacha

Browser-based gacha game where YouTube channels become collectible trading cards.
Card stats are derived from real channel data, the same trick Wikigacha (Harusugi, Feb 2026)
plays with Wikipedia article metrics.

This is a portfolio piece and fan tribute. Not a business.

## Owner context

Ash — SDET moving into AI engineering. This repo is a portfolio artifact with two goals,
in order: **real users actually playing it**, and a **directed-AI-engineering showcase** —
the visible process (this file, PLAN.md, DECISIONS.md, `wpN` tags + Releases, commit
messages shaped `WPn: <what and why>`) is itself the exhibit. Keep the receipts honest:
docs must reflect reality, tags/badges only for what exists.

Tests are the safety net, not the centerpiece (reframed 2026-07-18; WP1 delivered them —
56 tests, CI on every push, self-contained HTML reports). Ash is learning GitHub Actions
through this repo: for CI/workflow work, default to guide-and-explain so they type it,
unless they say otherwise.

## The core mapping

| Wikigacha | Creator Gacha |
|---|---|
| Article quality rank -> rarity | Subscriber count -> rarity |
| Pageviews -> ATK | View count -> ATK |
| Article length -> DEF | Video count -> DEF |

Rarity bands: N (<100K) -> R (<1M) -> SR (<10M) -> SSR (<50M) -> UR (50M+)

## Locked decisions — do not reopen

1. **No monetization inside the game.** No paid pulls, no currency, no perks, no ads.
   Reasons: YouTube API ToS restricts commercial use, cards use creators' names and
   likenesses, and paid gacha invites gambling and minor-protection regulation.
2. **One exception:** a single Buy Me a Coffee link in the footer. Passive, understated,
   no popups, no nags. **Hard rule: the coffee buys Ash a coffee. It never unlocks
   anything in the game.** The moment a donation grants in-game value, every IP and legal
   problem comes back.
3. **Client-side only.** Static host (GitHub Pages / Netlify). Users bring their own
   YouTube Data API key. No backend, no server, near-zero hosting cost.
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

`catalog/excluded.txt` cleans up whatever still gets through. It is editorial and revisable —
deleting a line puts the card back — and must never be confused with the opt-out denylist.

## Scope boundaries

Currently out of scope: battles, decks, pity system, `/c/` vanity URL resolution
(handles and UC ids only), server-side persistence, accounts.

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

**The pure core.** `rarityFromSubs` and `statsFrom` are pure and deterministic — no I/O,
no randomness, no DOM. They sit between the seam and everything stateful. This is the
test target. They live in **`src/engine/`** with the pull engine, which is the same
boundary drawn once as a folder: everything in `engine/` runs headless — no DOM, no
network, no I/O. `gacha.js` takes its randomness as an injected parameter, so it is
deterministic under a seed and belongs there too.

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
  derivation core (PURE)  <- rarityFromSubs, statsFrom      | src/engine/
        |                                                   |
  gacha engine (band-first weighted pull, x1/x10, dupes)    | headless
        |
  collection state
        |
  card render + reveal
```

## Conventions

- Vanilla JS, ES modules, no framework, no bundler.
- **The tree is organized by what a module may touch.** A new file's home follows from
  that one question, not from its topic:
  - touches nothing (pure, headless) → `src/engine/` — `core.js` derivation, `gacha.js`
    pull, `discover.js` Magic Search sourcing core. `engine/core.js` imports nothing; if it
    ever needs an import, the design is wrong.
  - touches the network → `src/data/`, behind the seam.
  - touches the DOM → `src/ui/`.
  - `state.js` (mutable app state) and `main.js` (wiring) are neither, and stay at the root.
- Fonts: Anton (display), Space Grotesk (body), Space Mono (stats/numbers).
- Palette: dark plum stage, YouTube-red accents.
- Record any new decision that closes off an option in `DECISIONS.md`.
