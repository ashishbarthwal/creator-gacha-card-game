# Decisions

Append-only. One entry per decision that closes off an option. Newest at the bottom.
Each line is the decision and its one-sentence reason; expand an entry for the full
reasoning, the alternatives weighed, and what it closed off.

---

<details>
<summary><b>No monetization in the game</b> — ToS, likenesses and gambling law all point the same way; Wikigacha launched free too.</summary>

No paid pulls, currency, perks, or ads. YouTube API ToS
restricts commercial use, cards use creators' names and likenesses, and paid gacha invites
gambling and minor-protection regulation. Harusugi ran Wikigacha free at launch with only a
Buy Me a Coffee link. We do the same.

</details>

<details>
<summary><b>One Buy Me a Coffee link, no strings</b> — The single exception, and it unlocks nothing — the moment it does, every IP problem returns.</summary>

Passive tip jar in the footer. It buys Ash a
coffee and never unlocks anything in-game. If a donation ever grants in-game value, every
IP and legal problem above comes back.

</details>

<details>
<summary><b>Client-side only, user-supplied API key</b> — No backend means no cost, and no cost is what makes the monetization answer easy.</summary>

Static host, no backend. This is what makes
the cost question mostly evaporate, which is what makes the monetization question easy.

</details>

<details>
<summary><b>No build step</b> — Plain ES modules; Vitest is dev-only and never touches the shipped artifact.</summary>

Plain ES modules. Vitest is a dev dependency and does not touch the
shipped artifact.

</details>

<details>
<summary><b>Split the single file into modules (WP0)</b> — Vitest cannot import out of a <code>&lt;script&gt;</code> tag, so the test suite was impossible until this.</summary>

Vitest cannot import functions out of a
`<script>` tag inside an HTML file, so the single-file build made the test suite
impossible. The tests are a portfolio goal, so the file structure has to serve them.

</details>

<details>
<summary><b>Handles and UC ids only</b> — <code>/c/</code> vanity URLs need an extra API call and a heuristic match; the cost is not worth it.</summary>

`/c/` vanity URLs are not resolved. They require an extra
search API call and a heuristic match, and the cost is not worth it.

</details>

<details>
<summary><b>No persistence yet</b> — In-memory only, to stay safe in sandboxed previews. Revisit on a real static host.</summary>

In-memory state only, to stay safe in sandboxed previews.
Revisit once the app is being served from a real static host.

</details>

<details>
<summary><b>Hidden subscriber counts read as N</b> — Hidden and malformed counts fall to the bottom band rather than throwing, so a card always renders.</summary>

The API omits `subscriberCount` and sets
`hiddenSubscriberCount: true` for channels that hide it. The core treats that — and any
malformed count — as the lowest band rather than throwing, so a card always renders.
To be pinned by tests in WP1.

</details>

<details>
<summary><b>Accent color: sample the avatar, fall back to a hash</b> — CORS taint or a near-grey avatar falls back to a hash of the channel id — deterministic either way.</summary>

Live avatars are cross-origin;
when canvas sampling is blocked (CORS taint) or the avatar is near-grey, the accent is
derived from a hash of the channel id instead. Deterministic either way, never blocks
rendering.

</details>

<details>
<summary><b>Card sets are the primary pull source</b> — Curated static JSON means players never need an API key; live BYO-key stays a power feature.</summary>

Curated, versioned channel snapshots ("Series")
ship as static JSON — players never need an API key. Demo mode becomes the built-in starter
set; live BYO-key mode stays as a power feature. Chosen over shipping a shared
referrer-restricted key as the default (that stays open as a fallback idea).

</details>

<details>
<summary><b>Series are monthly printings of ~300–500 cards</b> — The 30-day storage cap becomes the refresh cadence — compliance and TCG set flavour from one mechanism.</summary>

YouTube's Developer Policies cap stored
statistics at 30 days, so a scheduled snapshot refresh re-cuts each set monthly and cards
carry a "stats as of <month>" label. Compliance and TCG set-symbol flavor from one mechanism.
Curation flow: candidate lists are drafted with a target rarity mix (~N 40 / R 30 / SR 18 /
SSR 9 / UR 3 %), then human-approved before snapshotting.

</details>

<details>
<summary><b>One app, many banners — the codebase never forks</b> — Genre sets are banners inside one deployment; a themed sister site is deploy config, not a fork.</summary>

Genre sets (gaming, commentary, …) are
banners inside a single deployment. Themed sister deployments stay possible later from the
same code with different default set + palette, but they are a deploy config, not a fork.

</details>

<details>
<summary><b>Opt-out for channel owners</b> — Real people become cards, so the footer carries a contact line and removals are honored in 7 days.</summary>

Real people become cards, so the footer gains a contact
line and removal requests are honored promptly (policy requires deletion within 7 days for
user-data requests; we extend the courtesy to set membership).

</details>

<details>
<summary><b>WP0 done: monolith split, entry is <code>index.html</code></b> — Behaviour verified unchanged; <code>toCard</code> moved into the pure core so state depends on it, never the reverse.</summary>

`youtube-gacha.html` is deleted; the
app is ES modules under `src/`, loaded via `<script type="module" src="src/main.js">`.
Behavior is unchanged (verified: pure-core values match, and demo mode boots to the
identical 8-chip banner). `toCard` moved into `core.js` (it is pure — the model bridge,
not a renderer) so `state.js` depends on `core`, never the reverse.

</details>

<details>
<summary><b>Two files beyond the planned tree: <code>src/state.js</code> and <code>src/ui/util.js</code></b> — One owner for shared state, one home for <code>escapeHtml</code> — so <code>main</code> stays wiring and <code>banner</code> never imports the pull glue.</summary>

`state.js`
holds the shared in-memory `state` + `currentPool`/`addToCollection` so `banner`,
`collection`, and `main` import one owner instead of threading it through every call.
`ui/util.js` holds `escapeHtml` (used by both `card` and `banner`) rather than coupling
`banner → card` for a generic helper. `main.js` stays wiring-only; `banner` takes an
`onPull` callback so it never imports the pull glue.

</details>

<details>
<summary><b>Live adapter normalizes <code>customUrl</code> to the <code>@handle</code> shape</b> — Older channels return a bare vanity string, so <code>@</code> is prepended and every source emits one shape.</summary>

The API's
`customUrl` is not guaranteed handle-shaped — older channels return a bare,
lowercased vanity string ("mkbhd") where the modern format is "@mkbhd". The
live adapter prepends `@` when missing so the `handle` field always matches the
Channel typedef and the demo/sets adapters. Empty stays empty.

</details>

<details>
<summary><b>WP1 done: 56 tests pin the pure core and the pull engine</b> — A seeded PRNG makes drop-rate order an exact, reproducible assertion instead of flaky statistics.</summary>

Vitest is the repo's first
and only dependency, dev-only — the shipped app still has zero. `test/core.test.js` pins
every rarity boundary from both sides (string and number inputs), the hidden-subs-read-as-N
rule, junk-input safety, and monotonic/multiplier stat scaling. `test/gacha.test.js` injects
mulberry32 (a tiny seeded PRNG) so x10 size, dupe stacking, and the N>R>SR>SSR>UR frequency
order are exact, reproducible assertions rather than flaky statistics.

</details>

<details>
<summary><b>Local dev needs a JS-MIME static server, not <code>file://</code></b> — Modules are blocked over <code>file://</code>, and Python's server sends the wrong MIME on Windows. Use <code>npx serve</code>.</summary>

ES modules are blocked over
`file://`, and browsers reject module scripts served as `text/plain` (Python's
`http.server` does this on Windows). `npx serve` is the recommended local server;
GitHub Pages / Netlify serve correct types, so hosting is unaffected. README updated.

</details>

<details>
<summary><b>WP2 done: coffee link published under <code>ChunChunMaru</code>, disclaimer already present</b> — Published under the social handle by choice; our footer disclaims a relationship rather than granting one.</summary>

The footer's "not affiliated with YouTube/Google" line predated WP2, so WP2 added only the
tip jar: a single passive text link to `buymeacoffee.com/chunchunmaru`, coffee-accent
(SSR gold) on hover, opens in a new tab, wired to nothing in the game. Published under the
social handle ChunChunMaru rather than the real name, by choice. The hard rule holds — the
coffee buys Ash a coffee and never unlocks anything in-game. Unlike Wikigacha's CC BY-SA
line (which grants reuse rights downstream), our footer disclaims a relationship; we have no
license to grant, so the notice can only ever be a disclaimer, never an attribution.

</details>

<details>
<summary><b>Card face stays clean; the export carries the disclaimer (WP5)</b> — The risk peaks when a card leaves our page, so the PNG export is what carries the stamp.</summary>

Studying Wikigacha's
card up close: its CC BY-SA line lives on the pack art and page footer, not on the card face.
We follow the same split but for a different reason — our disclaimer is risk management, not
an attribution debt, and the risk peaks when a card leaves our page. So the in-app card face
stays uncluttered (WP3's frame/finish do the work), and the WP5 PNG export stamps a small
"unofficial fan card · stats as of <month> · not affiliated with YouTube" line into the image
itself, because the export is the version that travels without page context.

</details>

<details>
<summary><b>Test report is a self-contained monolith HTML, rendered from the JUnit XML</b> — <code>@vitest/ui</code> is an app; a report should be a document — double-clickable, mailable, archivable.</summary>

`@vitest/ui`'s HTML report was tried and dropped: it is an app (assets folder, gzipped
metadata, needs a server), and a report should be a document — double-clickable,
mailable, archivable. `tools/test-report.js` renders the JUnit XML we already emit into
one dependency-free HTML file per run, timestamped, failure traces inline. Dev
dependencies are back down to Vitest alone. The failure path is verified, not assumed:
a deliberately failing test must render a FAIL report and exit non-zero for CI.

</details>

<details>
<summary><b>Consume the API's integer fields; never parse a localized subscriber display</b> — Scraped display text changes by locale — separators, suffixes, Japanese man; the API's decimal strings do not.</summary>

The Data
API returns counts as locale-free decimal strings (`"21083412"`). The app parses those
(`core.toCount`) and formats them itself (`ui/util.formatCount` → "21.1M"), so we own the
presentation instead of inheriting YouTube's. Scraping a channel page would instead force us
to read *localized display text* — "1.24M subscribers" / "登録者数123万人" / "1,24 Mio.
Abonnenten" — where the number, the suffix, the separators, and the unit (Japanese 万 = tens
of thousands) all change by region. That is brittle and locale-dependent to parse, on top of
the usual scrape fragility (undocumented JSON fields, ambiguous matches — a live scrape of one
small channel already returned a `… views` number we couldn't confirm was the channel total).
So `build-set.js` (WP4) fetches creator data via `channels.list`, never by page scraping. The
HTML scrape used to hand-prototype single cards under `card-prototype/` was a throwaway
sandbox shortcut, never the pipeline and never the app — the live adapter has always used the
API. (Localization angle surfaced in a 2026-07 external design review; recorded here so the
reasoning outlives that conversation.)

</details>

<details>
<summary><b>WP3 done: holographic finish gated by rarity, and the CSS is now its own file</b> — Three custom properties per band put the rarity gating in exactly one place.</summary>

`index.html`'s inline `<style>` moved wholesale into `styles.css` (planned split, taken at
WP3 as the note said, not before). The finish is a pointer-tracked white glare, a masked
rainbow holo sweep, and a 3D tilt — kept separate from the per-rarity *frame*, which already
lived in the card rules. Intensity is three custom properties (`--tilt-max`,
`--glare-strength`, `--holo-strength`) set once per rarity band and read by shared rules, so
the gating lives in exactly one place: N stays flat/matte (all three zero), R gets a plain
sheen (glare, no holo), SR/SSR add the holo, UR adds a slow shimmer. Interactive tilt lives
in `ui/holo.js`, delegated on the persistent Collection grid so it survives the grid's
innerHTML re-render, and is **scoped to the collection, not the reveal overlay** — a tilt on
the reveal cards would fight the flip transform. It binds only for a fine pointer with motion
allowed; touch/coarse and `prefers-reduced-motion` fall back to a faint static finish (or
nothing for N) in CSS, so a card is never left broken. Still zero app dependencies, still no
build step. The `card-prototype/` SSR sandbox proved the effect first; the shipped version
generalizes it across all five bands.

</details>

<details>
<summary><b>Rarity tiers ARE the YouTube Creator Awards</b> — The thresholds already were the play-button levels, so the tiers name themselves.</summary>

The rarity thresholds (100K / 1M / 10M /
50M) are exactly the Silver / Gold / Diamond / Custom-("Red Diamond") play-button thresholds,
so the tiers name themselves: N=Graphite, R=Silver, SR=Gold, SSR=Diamond, UR=Red Diamond.
This replaced the earlier arbitrary N-grey/R-blue/SR-purple/SSR-gold/UR-red hues with a
palette that ties the whole look back to YouTube. Each tier is one `--t-*` custom-property set
(bevel stops, glow, badge ink) so a card recolours by rarity from a single source, and the
chip dots read the same `--rc`, so chips and cards can never disagree.

</details>

<details>
<summary><b>Card redesigned to a bevel-frame hero card (from the <code>card-prototype/</code> look)</b> — Container-query units mean one markup scales from the collection grid to the inspector with no overrides.</summary>

A conic
metal-bevel "seam" wraps a dark inner face: rarity badge + tier label top-left, name + handle
top-right, the avatar as a ringed centrepiece, subs line + ATK/DEF boxes at the bottom, faint
monogram behind. All internal sizes are **container-query units (`cqw` + `clamp`)**, so one
markup scales cleanly from the collection grid to the inspector with no per-size overrides.

</details>

<details>
<summary><b>Avatar promoted from inset to centrepiece — reverses the old "small inset" guardrail</b> — A real face is now protected art: the biggest thumbnail available, and the finish paints below it.</summary>

Recorded in CLAUDE.md. Two consequences: the live adapter now fetches the largest thumbnail
(high 800px → medium → default) instead of the 88px default, and **the holo/glare finish is
layered below the avatar** (`.avatar-stage` sits above the finish) so a real creator's face is
never colour-shifted by the effect. The frame and finish still do the heavy lifting; the
avatar is protected art, like the clear window on a physical trading card.

</details>

<details>
<summary><b>UR's finish is a molten sheen + a smouldering ember, not a flowing colour sweep</b> — SSR is cold diamond, UR is molten heat — the top tier must never compete on SSR's axis.</summary>

The
first WP3 pass gave UR a constantly-scrolling rainbow background; it read as distracting and
made the SSR diamond's rainbow out-shine the top tier. Replaced with: a warm gold→crimson
holo (distinct from SSR's cool rainbow, so UR doesn't compete on the same axis), a bi-metal
red+gold bevel, a warm glare, and a slow irregular **ember flicker on the frame glow only**.
Motion is gated to `prefers-reduced-motion: no-preference`; reduced-motion gets the static
frame. Interior intensity is deliberately lower than the edge so the centre never overwhelms.

</details>

<details>
<summary><b>Card inspector: click a collection card to admire it large</b> — Reuses <code>renderCard</code> untouched; container-query sizing means the enlarged card needs no special styling.</summary>

A centred overlay over a
blurred backdrop shows one enlarged card with the same tilt/holo enabled (so it can be turned
in the light). It reuses `renderCard` — the container-query sizing means the big card needs no
special styling. Closes on button / backdrop / Escape and restores focus. Kept out of the
reveal overlay, which has its own flip.

</details>

<details>
<summary><b>Reveal column count is pinned in JS, not left to <code>auto-fit</code></b> — A scrollbar stealing 17px could reflow a x10 between 5-wide and 4-wide, and each layout was self-stable.</summary>

A x10 reveal alternated
between 5-wide and 4-wide because a vertical scrollbar stealing ~17px could reflow the grid,
and each layout was self-stable. `reveal.js` now sets `--reveal-cols = min(cards, 5)` and the
grid uses `minmax(0, 148px)` columns, so cards shrink a hair rather than dropping a column —
the scrollbar can no longer change the count. A x1 is a single centred card.

</details>

<details>
<summary><b>Dev Pull is a testing affordance, explicitly not a game mechanic</b> — One card of every rarity in a single reveal, for tuning visuals. Gated or stripped before a real-users build.</summary>

A green "Dev Pull"
button fires a 10-pull seeded with one card of every rarity present in the pool, then filled
with normal weighted pulls, so every tier's treatment shows in one reveal while tuning
visuals. It must be gated (`?dev`) or stripped before the real-users build; it never changes
the published drop rates.

</details>

<details>
<summary><b>Throwaway HTML sandboxes removed</b> — About 5 MB of scraped third-party page source plus the prototype mock-ups — all single-use, now redundant.</summary>

The scraped YouTube page dumps (`mkbhd.html`,
`yuntaku.html`, `yuntaku-about.html` — ~5 MB of third-party page source at the repo root) and
the hand-built `card-prototype/` mock-ups are deleted now that the real cards render in the
app. Each was single-use: the scrapes gave stat numbers for hand-prototyping (never the
pipeline — the live adapter always used the API), the prototypes proved the frame/finish look
(now generalized across all five bands in WP3). References to them in the entries above are
historical. Removing them shrinks the repo and drops the committed third-party HTML.

</details>

<details>
<summary><b>WP4 app-side: card sets are a third adapter behind the seam, surfaced as a "Sets" banner mode</b> — The gacha, reveal, render and collection code took zero changes to consume a set — the seam demonstrated.</summary>

`data/sets.js` splits like the rest of the codebase — `parseSet` is pure and validated
(8 new tests), `loadSet` is the thin fetch wrapper. A set is the envelope
`{ slug, title, series, snapshotDate, channels[] }`; every channel is the exact Channel shape
demo/live emit, so the gacha, reveal, render and collection code took **zero** changes to
consume a set — the seam's whole point, demonstrated. Sets appear as a **third mode
(Demo | Sets | Live)** rather than folding demo into a set-picker: the smaller, incremental
change, chosen over the earlier "demo becomes the starter set" reframing (which stays open for
later). The picker is populated from a `sets/index.json` manifest that `build-set.js` will
maintain.

</details>

<details>
<summary><b>Demo folded into a bundled starter set; two modes remain (Sets | Live)</b> — The starter set becomes a real set behind the seam, and it keeps the offline-capable receipt.</summary>

This closes the
"demo becomes the starter set" fork left open above. The eight demo channels moved verbatim
(including the hidden-subscriber edge case) into `src/data/starter.js` as a real set envelope
`{ slug, title, series, snapshotDate, channels[] }`, so they now flow through the same
`parseSet → toCard` path a fetched set uses — the starter set is genuinely a set behind the
seam, not a special case. The standalone "Demo" mode/button is gone; the banner is now **Sets
(default) | Live**. The starter set is the picker's first, always-present option and loads
**synchronously from the JS bundle** (no fetch): the default view still paints instantly with
no loading flash, and it stays offline-capable and works as the fallback pool if the
`sets/index.json` manifest fetch fails. The hidden-subs channel that used to double as demo's
eyeball fixture is now pinned by two tests against `STARTER_SET` (64 → 66 tests). Chosen over a
hard delete of demo, which would have dropped the offline fallback and the "app runs offline"
receipt for the sake of ~100 fewer lines. Starter-set channel ids carry no snapshot label
(they aren't a dated snapshot), which visually distinguishes the built-in sampler from a real,
dated Series.

</details>

<details>
<summary><b>The first set ships with fictional channels, not real creators</b> — Proves the adapter, picker and rarity spread without committing any real creator metadata yet.</summary>

`sets/sample-series.json`
("Arcade Legends") is eight invented channels spanning every rarity (N→UR). It proves the
adapter, picker, and rarity spread without committing any real creator metadata while the
YouTube API storage / likeness questions are still being clarified with Google. `build-set.js`
will emit the identical shape from real channels once that clears — no app code changes. Sets
are keyed on the immutable UC id (handle is display-only), so a set is handle-change-proof and
self-heals its display fields on each monthly re-snapshot; a UC id that 404s on refresh
(deleted/terminated channel) must be dropped or flagged, never shipped as a broken card.

</details>

<details>
<summary><b>Local-dev API-key convenience: a gitignored <code>config.local.js</code></b> — The import rejects harmlessly wherever the file is absent, so the memory-only guarantee still holds.</summary>

So live mode needn't have
the key re-pasted on every reload, `banner.js` dynamically imports `config.local.js` and
pre-fills the field if it exports `YOUTUBE_API_KEY`. The import rejects harmlessly when the
file is absent — which is every deployment, so the shipped app still has no key and no such
file, and the memory-only guarantee to players holds. The file is gitignored via an explicit
`config.local.js` entry (its name doesn't match the pre-existing `*.local` rule). Working and
rationale notes (external LLM dumps, the static-sets-vs-backend case) live in a gitignored
`external-docs/` and are deliberately not part of the repo.

</details>

<details>
<summary><b>The pull is two-stage: pick a rarity band by weight, then a card inside it uniformly</b> — Per-card weights made drop rates a function of roster composition, which is exactly what a gacha may not do.</summary>

The old `pullOne` summed each *card's* rarity weight across the whole pool, so a band's real
drop rate was its weight × how many cards of that band the pool happened to hold. The weights
in `core.RARITY` sum to exactly 100 — they were written as a rate curve — but the two
weightings compounded: a 500-card set curated to the target mix (~N 40 / R 30 / SR 18 / SSR 9 /
UR 3 %) would have dropped UR at ~0.09%, not ~1%, and burying one UR under 200 commons cut its
rate ~58×. That made the published odds a function of roster composition, which is exactly what
a gacha may not do. Band-first makes the table literal: N 55% / R 27% / SR 12% / SSR 5% /
UR 1%, independent of how many cards each band holds. Empty bands are dropped and the weights
**renormalize over the bands actually present**, so a sparse live banner (two R channels and an
SSR) draws 27:5 between them instead of under-rolling. Selection inside a band is uniform —
rarity decides how often a *band* appears, never which card within it. Chosen over keeping
per-card weights and controlling rates purely by curating set composition: that works only
while every set is hand-balanced, and it breaks silently the moment a set gets big or lopsided.
This is also the machine the three-tier sourcing pools (Legends / Majority / Wildcards) need
later — swap what stage 1 groups by and the pull math is unchanged. Pinned by tests that assert
the *exact same band sequence* from a 5-card pool and the same pool padded with 200 commons
(75 tests).

</details>

<details>
<summary><b>The banner shows computed odds, not the raw weight table</b> — Recomputed on every render, so a sparse banner shows its own odds instead of a curve it cannot produce.</summary>

Now that the weights are true
percentages, the rates line reads "Drop rates — N 55% · R 27% · …", recomputed from the current
pool on every render so it reflects the renormalization above. The old "Pull weights per
channel — N 55 · R 27 · …" was written once at init and, under the old engine, was not the odds
a player actually faced.

</details>

<details>
<summary><b><code>core.js</code> + <code>gacha.js</code> moved to <code>src/engine/</code>; the tree is organized by what a module may touch, not by topic</b> — Nothing in <code>engine/</code> touches the DOM, the network or any I/O — it would run unchanged in Node.</summary>

The existing folders already encoded that rule — `data/` is what touches
the network, `ui/` is what touches the DOM — but the two pure modules sat loose at the root, so
the axis was implicit and incomplete. `engine/` names it: **nothing in that folder touches the
DOM, the network, or any I/O — it would run unchanged in Node.** That admits `core.js` and
`gacha.js` (its randomness is an injected parameter, so it is deterministic under a seed) and
excludes `state.js` (mutable) and `main.js` (wiring), which stay at the root. Chosen over a
topic-named folder grouping "game rules," which would have cut across the capability axis and
left membership a matter of taste; and over waiting until the three-tier pool code gave the
folder a second file, since the rule is what makes the folder worth having, not the file count.
`engine/pools.js` and a future `engine/battle.js` now have an obvious home. Moved with
`git mv`, so history follows the files; the only code change was import paths.

</details>

<details>
<summary><b>Sets mode shows the pool's composition; only Live enumerates it as chips</b> — 300-500 chips would each fetch an 800px avatar for a 22px circle, and band counts inform better anyway.</summary>

The banner
rendered one chip per pool card, which is fine for eight and untenable for the 300–500 card
Series WP4 is building toward: hundreds of read-only pills (Sets chips carry no remove button),
and every chip's `<img>` is the card's own avatar — which WP3 deliberately made the largest
thumbnail available, up to 800px, so the centrepiece isn't soft. That is a punishing download
for a 22px circle, repeated on every set switch. Sets now render `<n> cards — N 128 · R 94 · …`
from `bandsFrom()` (the same grouping the two-stage pull uses, so the banner and the engine can
never disagree about what is in the pool), and load no avatars at all. Live keeps chips
unchanged: that pool is hand-built, small by nature, and each entry needs its `×`. Chosen over
capping the chip list at "first 20 + 480 more", which keeps the payload problem for the twenty
it still renders and tells the player less than the band counts do; the roster is also better
discovered by pulling than by reading a list, which is the game. Surfaced by live-mode testing
against real channels — the fictional sets never had enough cards or long enough titles to
expose it.

</details>

<details>
<summary><b>Chip names truncate at 18ch with the full title as a tooltip</b> — A single CJK title already wrapped the banner onto a second row.</summary>

Real channel titles run long
and CJK titles longer still; a single seven-channel Live banner containing
`TVアニメ『ヤニねこ』公式【ハメちゃんねる】` already wrapped the row onto a second line. The name
now ellipsizes and carries a `title` attribute, so nothing is lost.

</details>

<details>
<summary><b>Card titles wrap anywhere; the 2-line clamp does the truncating</b> — The first diagnosis was wrong: the cause was horizontal overflow, not the line clamp. Measuring settled it.</summary>

The same live testing showed
`TheBackgroundNPC` sheared to "TheBackground" on the card face. The suspected cause was the
`-webkit-line-clamp: 2` failing on long/CJK titles — devtools disproved that: computed
`line-clamp` reads `2` and every title measured one or two lines (13px / 26px against a 13.2px
line box), so the clamp was working. The actual cause was horizontal: a single unbreakable word
has no break opportunity, so it overflowed `.card-name` and `overflow: hidden` cut it mid-word
with no ellipsis. Fixed with `overflow-wrap: anywhere`, which also lets the box shrink to
min-content inside its `min-width: 0` flex parent — so the clamp, not the clip, decides what is
dropped. Worth recording that the first diagnosis was wrong: the visible symptom (a title
looking too tall) pointed at the vertical mechanism, and only measuring ruled it out.

</details>

<details>
<summary><b>Magic Search draft 1: the pure discovery engine, without the live fetch</b> — The query randomization is the novel part, so it lands in the tested engine; the one fetch line waits.</summary>

`src/engine/discover.js`
is the headless half of keyword→channel sourcing: `buildSearchParams` (a seeded, randomized
`search.list` query), `harvestChannelIds` (every uploader in a response, deduped — all ~50, since
one search already costs 100 quota units, so keeping one and dropping 49 is the quota bug the
three-tier design fixes), `passesFloor` (a subscriber + activity cull; a hidden count fails, since a
floor you can't see isn't cleared), and `assignPool` (legends/majority/wildcards by sub band). It
follows the same split `sets.js` draws — the pure, validated, tested part lands first (22 tests on
synthetic fixtures authored in the real `search.list` and Channel shapes), and the one live
`search.list` call that consumes the params is a thin IO wrapper (`data/search.js`) left as the next
step. Nondeterminism is injected, never reached for — `rng` **and** `now`, extending gacha.js's
rng-injection to the clock — so the "random" re-roll (a fixed-length `publishedAfter` window slid to
a random start, plus order jitter — the feature's whole point) is a reproducible assertion instead of
a live coin-flip against an API that cannot repeat. Chosen over building the fetch in the same pass:
the query randomization is pure and is the novel bit, so it belongs in the tested engine, while the
fetch adds a key, quota cost, and non-reproducibility for no extra proof. The earlier "wait on the
Google storage/likeness gate" framing is set aside for now — this is a private build, not a public
launch; legality is revisited before any public launch, not before writing build tooling.

</details>

<details>
<summary><b>Legality is out of scope during the build phase; resolved before deploying to real users</b> — The gate is narrowed, not dropped — it blocks deploying real creators, not writing build tooling.</summary>

Earlier entries gated real-creator sourcing on the YouTube API storage + likeness/consent questions
clearing with Google (see "The first set ships with fictional channels"). That gate is narrowed, not
dropped: it blocks **deploying real creators to real users**, not **writing build tooling**. This is
a private, un-deployed build, so Magic Search and the discovery pipeline get built now — against
synthetic fixtures and Ash's own key — with no real creator data committed or served. The
storage / likeness / consent questions, and the 30-day refresh-printing mechanism that answers the
storage half, are settled **before any public launch**, not before code. Order of operations: build
first, resolve legalities before real users, then deploy. This supersedes the "gated before it points
at real channels" framing in PLAN.md and the fictional-sets entry; it reopens none of CLAUDE.md's
locked decisions — no monetization, client-side only, and the unofficial disclaimer all stand.

</details>

<details>
<summary><b>Magic Search runs in the browser too, as a dev trigger — the fetch layer is environment-neutral</b> — The fetch layer is environment-neutral, so watching real creators become cards cost nothing extra.</summary>

`data/search.js` uses only `fetch` and `URLSearchParams`, so the same discovery code the CLI runs in
Node runs unchanged in the browser. A **"Magic Search" button in Live mode** takes a keyword, runs
`search.list` → `channels.list` → floor → cap, and drops the top few channels into the live pool to
pull immediately. It reuses the exact engine (`selectChannels`/`assignPool`) and seam (`toCard`), so
a discovered channel is indistinguishable from a hand-added or set one — the seam demonstrated a
third time. Deterministic for now (fixed `order=viewCount`, no window). Like **Dev Pull**, it is a
**dev affordance, gated on nothing yet, and must be gated or stripped before a real-users build** —
it needs a key and is the parked player-side keyword search; committing it does not ship it (deploy
is still deferred). Chosen over a Node-only tool: watching real creators become cards live is the
fastest way to feel whether discovery is any good, and it cost nothing extra because the module
already ran in both environments.

</details>

<details>
<summary><b>Discovery runs accumulate into one draft set; a gitignored local manifest surfaces it in the picker</b> — The draft file is the first, simplest form of the candidate DB; no real creator data is ever committed.</summary>

`tools/magic-search.js` merges each run into `sets/magic-search.draft.json`, deduping across
runs by UC id, so repeated searches grow the pool instead of overwriting it — the file is the first,
simplest form of the candidate DB the three-tier design calls for (store and rendered set collapsed
into one file for the draft; they separate later). `--fresh` starts over. To view the draft without
hand-editing the committed `sets/index.json`, the tool also maintains a gitignored
`sets/index.local.json`, and `banner.js` reads it **only on localhost** (self-disabling in
production, same spirit as `config.local.js`) to append generated drafts to the Sets dropdown. Both
`sets/*.draft.json` and `sets/index.local.json` are gitignored, so no real creator data and no
local-only pointer is ever committed.

</details>

<details>
<summary><b>Card and chip avatars survive YouTube's hotlink 403s: <code>referrerpolicy="no-referrer"</code> + a monogram fallback</b> — A pre-existing bug across every source — discovery just rendered enough real channels at once to expose it.</summary>

Google's avatar CDN inconsistently rejects hotlinked images by referer, so some real
channels' avatars loaded and others 403'd — invisible until Magic Search rendered a batch of real
channels at once. The visible `<img>` had no referrer policy and no error handling, so a blocked
image left an empty ring. Fix: set `referrerpolicy="no-referrer"` on the card avatar, the
accent-sampling image, and the pool chips so Google stops blocking; and on a genuine load failure,
remove the image so the faint monogram behind shows as the intended fallback instead of a
broken-image glyph. A pre-existing render bug across all sources, not a Magic Search one — discovery
just surfaced it.

</details>

<details>
<summary><b>Vitest pool pinned to a single fork</b> — The default threads pool raced on worker init and reported zero tests as a whole-suite failure.</summary>

The default `threads` pool intermittently failed worker
init on this setup (Windows / Node 24) with a "Cannot read properties of undefined (reading
'config')" race at collection — 0 tests run, all files reported "failed" — and it recurred even with
`forks` and serial files. `vitest.config.js` now pins `pool: 'forks'` with `singleFork: true`, so the
whole suite runs in one worker with no spawn race; six consecutive `npm test` runs passed 113/113. It
is dev-only config — the shipped app still has no build step — and the ~1.5s single-process runtime is
fine for a suite this size. Recorded because it closes the "zero-config Vitest" default the repo ran
on until now.

</details>

<details>
<summary><b>Addendum (2026-07-25): the Vitest 4 upgrade silently un-did the fix above</b> — A config option that stops existing is indistinguishable from one that works — the dangerous kind of failure.</summary>

Vitest 4 removed
`poolOptions`, which is where the serialization lived. It did not error — it printed a deprecation
line and ignored the option — so `singleFork: true` stopped applying and the collection race returned
at roughly one run in two ("no tests", all files failed, `import 0ms`). The replacement is the
top-level `fileParallelism: false`, which forces workers to 1; `singleFork` no longer exists anywhere
in the package. Six consecutive runs pass 119/119. Worth recording as its own line because the failure
mode is the dangerous kind: a config option that stops existing is indistinguishable from one that
works, unless you read the deprecation notice the runner prints on every single run.

</details>

<details>
<summary><b>Discovery excludes self-declared Indian creators — a leaky local-risk hedge</b> — Trims the highest-enforceability claim vector, but <code>country</code> is self-declared, so it supplements rather than replaces.</summary>

The operator is
India-based, and the jurisdiction that most easily reaches an individual is their own, so an
India-domiciled creator is the highest-enforceability claim vector; a foreign creator's claim against a
free, non-monetized, India-run project is far harder to bring and enforce. `selectChannels` now drops
any channel whose `country` is in `DEFAULT_EXCLUDE_COUNTRIES` (`['IN']`) via the pure `passesRegion`
predicate, and `mapChannelItem` + `parseSet` carry `country` so the whole seam speaks one shape.
Deliberately partial: `snippet.country` is self-declared and frequently absent, and an unknown country
can't be excluded — so this trims the scariest vector but is a **supplement** to the real protections
(no monetization, opt-out, unofficial disclaimer, fictional-first), never a substitute. `exclude: []`
disables it. Applies to the live Magic Search paths (CLI + in-page button) today; its pipeline use lands
with WP7. Chosen over a search-only region bias (`regionCode`/`relevanceLanguage`), which is even
leakier and can't see a channel's declared country — the two can still stack later if wanted.

</details>

<details>
<summary><b>Exclude-giants is a per-query lever, not a global rule</b> — A global ceiling would permanently empty the 5M+ legends pool the three-tier sourcing depends on.</summary>

WP6 adds `maxSubs` to the discovery
floor, because a generic keyword is dominated by a handful of enormous channels and those are both
the ones already in the pool and the ones with the most standing to object. It defaults to
`Infinity` — OFF — which looks timid until you line it up with `assignPool`: the `legends` tier is
defined as 5M+ subs, so a global ceiling below that would permanently empty a pool the three-tier
sourcing depends on. Both live callers opt in at 2M (`MS_MAX_SUBS=0` lifts it in the CLI). The
knob is named inside `floor`, which now describes a band rather than a floor; kept for its callers
rather than renamed. Closes off "just cap subscribers globally", which would have silently starved
the legends pool.

</details>

<details>
<summary><b>The Magic Search keyword vocab is hobby/craft topics only</b> — Mid-sized on-topic creators live in those niches, and every result becomes a card carrying a likeness.</summary>

The generator is seed × modifier
(64 × 18 = 1152 queries), and the seed list is deliberately confined to crafts, skills and hobbies —
woodworking, field recording, bonsai — with no news, politics, drama, or anything keyed to a real
person's name. Two reasons, one practical and one not: mid-sized on-topic creators actually live in
those niches, which is the pool the sourcing is short of; and every result becomes a card carrying
someone's likeness, so the vocab is the cheapest possible place to keep the feature away from
subjects where that is least defensible. Closes off "generate keywords from trending/broad topics",
which maximises reach in exactly the direction the project has been steering away from.

</details>

<details>
<summary><b>WP6 was mostly switching on what WP5 already built</b> — The engine being done and the feature being live are separate facts; both callers had pinned the jitter off.</summary>

`buildSearchParams` shipped in WP5 with
full order jitter and a slid publication window, injected rng and all — and then both live callers
(`ui/banner.js` MS_OPTS, `tools/magic-search.js` DETERMINISTIC) pinned `windowDays: null,
orders: ['viewCount']`, so none of it ran. Recorded because the engine being "done" and the feature
being live are separate facts, and the checklist read as though the first implied the second. The
per-query jitter is also not sufficient on its own: a fixed query list keeps finding the same corner
of YouTube however hard each query is randomized, which is what the keyword generator is for.

</details>

<details>
<summary><b>The name "YouTube Gacha" ships as-is for the private build; renaming is deferred to launch</b> — A mark in the name slot travels in the title bar and every shared link, detached from the disclaimer.</summary>

Putting a registered trademark in a product's name is the strongest possible signal of affiliation —
stronger than anything the footer disclaimer can walk back, because the name travels in the title bar,
the URL and any shared link, detached from the page. The Wikigacha precedent does NOT cover this: "wiki"
is a generic noun describing a kind of site, so Harusugi never used Wikipedia's mark; "YouTube" is a
mark. Descriptive use ("cards minted from real YouTube channel data") stays fine and stays in the
tagline — it is the NAME SLOT that asserts brand identity, not the word.

Deferred rather than fixed because the project is a private portfolio build with no launch, no users
and no domain, and Ash's call is that the exposure is not real until it is public. Recorded because
the cost curve only goes up: today it is find-and-replace, after launch it is a migration of links,
search results and anything anyone bookmarked.

**Trigger: this must be resolved before WP10 deploys to real users**, alongside the legality gate.
Pre-scoped so it is not a research task later — the name lives in `index.html` (`<title>`, `<h1>`),
`src/ui/reveal.js` (the card back wordmark reads "YOUTUBE GACHA"), `package.json` + lockfile `name`,
README / CLAUDE.md / PLAN.md, and the GitHub repo name + the Actions badge URL in the README.

Also noted, because they compound rather than stand alone: the red palette, the `play-glyph` in the
`<h1>` and the red play triangle on the card back (`.back-play`) point the same direction as the name.
A play triangle alone is a generic media symbol; red + play button + the mark together is what reads
as affiliation. Dropping the name weakens the rest considerably, so the name is the high-leverage fix.

</details>

<details>
<summary><b>Superseded: the name is now "Creator Gacha"</b> — Closed early once a name existed — the expensive half of a rename is deciding, not executing.</summary>

The entry above deferred this to launch; Ash closed
it early (2026-07-26) once a name they liked existed — the expensive half of a rename is deciding, and
that was done, so executing was find-and-replace across eight files. Chosen over "Subgacha", which
named the core mechanic (subs → rarity) and preserved Wikigacha's `[source]+gacha` construction, but
lost on reading as a pun: "sub" carries too many unrelated meanings, and a name should not need
explaining. "Creator Gacha" also stays accurate if the sets go fictional-first, since fictional
channels are still creators.

Descriptive use is deliberately RETAINED and moved into the tagline — "cards minted from real YouTube
channel stats" — because naming the platform you interoperate with was never the problem. The name
slot is what asserts a brand relationship; the body copy is nominative use. The footer disclaimer is
unchanged and still required.

Deliberately NOT renamed: the four historical references to `youtube-gacha.html` (PLAN.md, README.md,
the WP0 entry above). That file genuinely existed and was genuinely deleted, and rewriting a record of
what happened to match a later decision is exactly the kind of tidying that makes docs untrustworthy.
Closed out 2026-07-31: the GitHub repo is now `creator-gacha-card-game` and the README badge path
follows it. `creator-gacha` was the shorter, cleaner option and would have matched `package.json`
exactly; the longer form won because "gacha" is a niche term and the repo list is read by people who
do not necessarily know it names the card-pull mechanic. Legibility to a stranger beat a tidier Pages
URL. Also unchanged: the red palette, the `play-glyph` and `.back-play`'s red triangle — flagged
earlier as compounding signals, now much weaker without the mark carrying them.

</details>

<details>
<summary><b>Creator Gacha first; Repo Gacha parked, not rejected</b> — Repos are not people and GitHub has no 30-day cap, but safety is a tiebreaker, not a reason to pick a project.</summary>

`external-docs/repo-gacha.md` proposes the
same engine over open-source repositories. It is materially safer — repos are not people, so the
likeness problem vanishes outright; eligibility is gated on an actual open-source licence; and
maintainers generally *want* discovery, which inverts the incentive that makes the creator version
delicate. The decisive practical difference is storage: YouTube's Developer Policies force API data
to be refreshed or deleted within 30 days, which is the entire reason sets are monthly printings.
GitHub imposes no equivalent cap on public repo metadata, so a set file could simply persist, and a
whole work package stops existing.

Deferred anyway, because safety is a tiebreaker and not a reason to pick a project — CG's problems
are each solvable and mostly already solved, and the one that decides whether a thing gets finished
is which one you want to build.

Preserved so the analysis is not re-derived later:

- **~70% survives a pivot, and it's the 70% that took the design thought.** `gacha.js` is fully
  source-agnostic. `core.js` keeps `toCount`/`RARITY`/`toCard` untouched; only `rarityFromSubs` and
  `statsFrom` need re-parameterising (stars→rarity, stars/forks→ATK/DEF) with the same shape and the
  same tests. The seam, `sets.js`, `starter.js` and all of `ui/` including the reveal are untouched —
  a GitHub adapter slots exactly where `youtube.js` sits. That is the pure-core boundary paying off.
- **The one place RG is RISKIER than CG:** its "AI-generated educational summaries". CG only ever
  asserts raw numbers; a generated fact attached to a real named project will eventually be
  confidently wrong, which is a credibility problem and defamation-adjacent in a way "201,000 stars"
  is not. The doc addresses copyright ("written independently, not copied") and never addresses
  accuracy. Those facts want to be hand-written or human-reviewed, not generated at scale.
- **The doc's stated reasoning is off in one place:** it treats the open-source licence as the safety
  gate, but a licence grants rights to the CODE, not the NAME — Apache-2.0 §6 explicitly declines to
  grant trademark rights and MIT never mentions them. "Docker", "Kubernetes", "Rust" are marks held
  by real organisations. The conclusion still holds, because naming a project to identify that
  project is nominative use and the doc already excludes logos and branding; only the reason is wrong.
- Emblems (WP11) are shared infrastructure between the two, since RG cannot use project logos either.

</details>

## Launch posture: ship the real-pfp build first (2026-07-31)

<details>
<summary><b>The first public release carries real creator pictures and names</b> — The safer artifact is the weaker experiment; the risk accepted is real but bounded.</summary>

Ash's call, made
knowingly rather than by omission: the emblem build (WP11) is the safer artifact but the
weaker experiment, and the question this release exists to answer — does anyone want to
play this — cannot be answered by a version stripped of the thing that makes it legible.
The risk accepted is real but bounded: no monetization, no ads, a disclaimer, a working
opt-out, the India exclude, and a modal bad outcome that is an email asking for removal
rather than a claim.

</details>

<details>
<summary><b>The emblem build is a flag, never a fork</b> — The flag is what makes this launch reversible — a config change and a redeploy, not a rewrite.</summary>

— WP8's avatar-source switch is therefore
promoted from "hardening" to a launch prerequisite. It is what makes this release
*reversible*: if a creator objects, or the read of the room changes, flipping to generated
emblems is a config change and a redeploy instead of a rewrite. Launching without the flag
is what would make the decision irreversible, not launching with real pictures.

</details>

<details>
<summary><b>Shipped sets are built in CI at deploy and never committed</b> — A set file in git makes an honored removal impossible to actually perform.</summary>

A set file in git is
permanent: `git rm` on an opted-out creator leaves them at the old commit, in a public repo
this project actively invites people to browse — so committing sets would mean promising a
removal we cannot actually perform. Building at deploy keeps creator data out of history
entirely and *is* the monthly-refresh mechanism the 30-day storage cap already requires
(above). One workflow satisfies both.

</details>

<details>
<summary><b>The candidate DB stores channel IDs, never channel data</b> — IDs plus our own tags and the denylist; CI hydrates stats at build, so an opt-out sticks across every future build.</summary>

It is the committed,
accumulating source of truth for *who is in the pool*, plus our own derived tags and the
opt-out denylist; CI hydrates those IDs into full stats at build time. A UC id is an opaque
public identifier, so this keeps the committed artifact clean under the rule above while
leaving the denylist permanent and auditable — which is what makes an honored opt-out stick
across every future build instead of being re-added by the next sourcing run.

</details>

<details>
<summary><b>Reverses the curation half of "Series are monthly printings" (above)</b> — At 300+ cards human approval is not a promise Ash can keep, so mechanical rails replace it.</summary>

That entry said
candidates are "human-approved before snapshotting." At the chosen first-set size (300+,
pipeline-driven) that is not a promise Ash can keep, and a policy nobody performs is worse
than one honestly scoped. Human approval is replaced by **mechanical rails**: the
subscriber/activity floor, `safeSearch=strict`, the India exclude, the denylist, and a fast
opt-out response. The target rarity mix and the monthly cadence are unchanged. This is a
deliberate trade of editorial control for scale, recorded so the earlier line is not read as
still operative.

</details>

<details>
<summary><b>The opt-out goes to Ash's own inbox, and the legality gate closes on a bounded risk</b> — A read inbox beats a forwarded one, and "resolved" means mitigated and reversible, not zero.</summary>

The contact route is `ashish.barthwal.cs@gmail.com`, chosen over the dedicated forwarding
alias that was recommended. The argument for an alias is real — a public `mailto:` in static
markup will be harvested, and that address is Ash's primary identity — but the promise this
line makes is a fast answer, and a real inbox that is actually read serves that better than a
forwarding address that might not be. The spam cost was accepted knowingly rather than
overlooked.

With that in place the **legality gate is closed (2026-07-31)**. Closed by accepting a
bounded risk, not by eliminating one, and the distinction is the whole entry: no monetization
and no ads, so there is no commercial use to object to; the unofficial disclaimer; an opt-out
honored in 7 days; the India exclude trimming the highest-enforceability claim vector; and
WP8's avatar flag keeping the decision reversible rather than permanent. The realistic bad
outcome is an email asking for removal, which gets honored.

Deliberately NOT claimed: that a lawyer reviewed this, or that the exposure is zero. It is an
informed decision by the operator to launch, recorded as exactly that — because a gate marked
"resolved" with nothing behind it would be the kind of empty receipt this file exists to
prevent. What would reopen it: a claim actually arriving, monetization of any kind, or the
project reaching a scale where "obscurity is protective" stops being true.

</details>

## The candidate DB is a directory boundary (2026-07-31)

<details>
<summary><b>Three directories, one rule: only IDs and our own tags enter git</b> — The split is physical so the guarantee is checkable by looking at a path, not by trusting a reviewer.</summary>

WP7 step 1 landed the candidate DB, and the shape it took is a directory split rather than a
convention:

    sets/*.draft.json   gitignored   real creator data, local only
    catalog/*.json      COMMITTED    ids + our tags + the denylist
    sets/<slug>.json    built in CI  full stats, deployed, never committed

Two prior decisions collapse into this one boundary. YouTube's 30-day cap on stored statistics
cannot be met by anything in git, because git is permanent — a committed stat can be neither
refreshed nor deleted on time. And the 7-day opt-out cannot be honored for anything in git,
because `git rm` leaves the creator at the old commit in a public repo this project actively
invites people to browse. Both rules point at the same answer, so the middle row is the only
one that enters history.

Making it a *path* rather than a code convention is the point: "did we commit creator data"
becomes a question answerable by looking at where a file lives.

</details>

<details>
<summary><b>The strip is a positive allowlist, never a blocklist</b> — A blocklist fails open the moment the Channel shape upstream grows a field.</summary>

`toCandidate` names every field it keeps (`id`, `pool`, `firstSeen`) instead of deleting the
ones it doesn't. A blocklist would be equivalent today and wrong tomorrow: the first time
`data/index.js` gains a property, a blocklist starts committing it silently and nothing fails.
The allowlist's failure mode is the safe one — a genuinely needed field is missing and
obvious, rather than an unwanted field present and invisible. A test asserts the exact key set
and a second asserts the serialized JSON contains none of the stripped values, since the real
risk is a field surviving the round-trip rather than the object literal looking clean.

</details>

<details>
<summary><b>The denylist evicts as well as blocks</b> — Sourcing will rediscover an opted-out creator, so a one-time removal silently expires.</summary>

The obvious half is refusing to admit a denied id. The half that carries the guarantee is
evicting one already in the DB, and then re-enforcing that on *every* merge — because the
channel still exists and still matches the keyword that found it, so the next `--random` run
finds them again. An opt-out honored once and not re-applied is an opt-out that lasts until the
next sourcing run, which is worse than none: it looks kept while quietly failing.

`hydratableIds` drops denied ids before the fetch rather than filtering the results, on the
same reasoning — the point of an opt-out is that we stop looking someone up, not that we look
them up and discard the answer.

**The limit of that, stated because the docs above could be read as claiming more (noted
2026-08-01).** The argument that keeps sets out of git — `git rm` leaves someone at the old
commit in a public repo — applies to the candidate DB too. An opt-out is enforced in every
future build, and it is **not erased from history**: that id sits in the commits that preceded
the removal, permanently. The same is true of `catalog/legends.txt`, which is committed and
holds real `@handles` and editorial notes about named creators, in plainer text than any UC id.

So "we commit nothing about creators" would be an overclaim, and this file should not be read
as making it. What is committed is an opaque public identifier — one that appears in the
channel's own URL — plus, for the curated roster, names that are already public and famous. No
statistics, no avatar, no likeness, nothing that goes stale. Compared with a committed set —
name, face and subscriber count frozen forever — it is a different order of exposure, and it is
the price of an opt-out that can actually be re-enforced.

Considered and rejected: gitignoring `candidates.json` to remove the residue. It would work, and
it would cost the thing the file exists for — the pool stops being a shared, reviewable artifact
and becomes machine-local, so a removal could no longer be performed against a document anyone
can audit, and the roster would die with the laptop.

`--prune` exists so honoring a request costs one command with no draft, no key and no quota,
letting the answer be "already done" instead of "at the next build". That matters because the
promise in the footer is 7 days, and the person keeping it is one person reading their own
inbox. For the same reason the denylist parses a bare `"UC_id"` string as well as the full
audit record: the fast path under time pressure must not be the one that silently does nothing.

</details>

<details>
<summary><b>The stored pool tag is a hint, and build-set recomputes</b> — Cached bands go stale as channels grow; the authority is always freshly hydrated stats.</summary>

`pool` is recorded at discovery so the DB can answer "which tier is short" between builds with
no API key, but it is derived from a subscriber count that keeps moving — a channel crossing 5M
carries a stale tag. Nothing downstream may trust it for a build; `build-set.js` assigns pools
from freshly hydrated stats. `refreshPools` lets the hint self-heal at hydrate time, when fresh
Channel objects are already in hand and the correction is free. Country is not cached at all,
for a stronger version of the same reason plus the gate item: the region exclude re-runs at
hydrate, so a self-declared personal attribute the game never reads is never persisted.

</details>

## Building a real set: what the first run taught (2026-07-31)

<details>
<summary><b>The India exclude works about five times better than predicted</b> — 65–73% of channels declare a country, so the filter is a real hedge rather than a token one.</summary>

`regionReport` was added because the exclude was being counted as one of the five mitigations
the legality gate closed on while nobody had measured it. The prediction going in — stated
before the run, so it is on the record — was ~10–15% coverage, i.e. a filter doing almost
nothing.

The measurement over 326 hydrated channels across two runs: **coverage 65–73%** (the share
declaring any country at all, which is the hard ceiling on what the filter can remove) and
**8.6–12.8% actually excluded**, 34 India-declared creators dropped.

So the gate's description of the exclude as trimming the highest-enforceability vector stands,
and no reopening is warranted. The original caveat is unchanged and still matters: the 27–35%
who declare nothing cannot be excluded, which is exactly where the creators visible in the
screenshot that prompted this came from. It remains a supplement to the real protections
(no monetization, the disclaimer, the opt-out), never a substitute.

</details>

<details>
<summary><b>The band-starvation minimum derives from the pull's own weight table</b> — A flat "N cards per band" is wrong at both ends; the weights already encode the answer.</summary>

Found by playing: a 15-card pool returned the same R card four times in one x10. Not the dupe
rule, which is intended — band starvation. The pull draws a band by fixed weight then picks
uniformly inside it, so a band holding one card returns it every time that band hits.

The fix belongs at build, not in `gacha.js`: the two-stage pull is deliberate and correct, since
it is what stops roster composition from diluting the drop curve (WP4). What a set owes the
player is enough distinct cards per band.

The minimum is computed from `RARITY[band].weight` normalized over the bands actually present,
times a headroom factor, floored at two. A single hand-tuned number would be wrong at both ends
— N takes ~5.5 of every 10 draws and needs a deep roster to look varied, while UR takes ~0.1 and
is fine with two. Normalizing over *present* bands matters because `bandsFrom` drops empty ones
and renormalizes, so a set holding only N and R really does draw 55:27.

Starved bands are pruned rather than failing the build: a scheduled 25-day refresh that dies on
one thin band stops shipping sets entirely, which is worse than shipping one band lighter. The
prune loops rather than filtering once, because removing a band renormalizes the rest upward and
can starve a neighbour that just passed.

</details>

<details>
<summary><b>The hobby/craft keyword vocab cannot reach SSR or UR — open</b> — The safest sourcing vocabulary is also the one that never finds a chase card.</summary>

The first real build produced `N 27 · R 16 · SR 8 · SSR 0 · UR 0`. This is not a bug in
sourcing; it follows from a deliberate earlier choice. `KEYWORD_SEEDS` is hobby/craft on purpose
— it steers clear of news, politics and person-named channels, which matters more than usual
when every result becomes a card bearing someone's likeness — and that vocabulary essentially
never surfaces a 10M+ channel.

The cost is real: SSR starts at 10M and UR at 50M, so the pool currently cannot mint a chase
card at all, and WP12's UR three-beat finish would never fire for a real player. The tension is
that the two safest properties of the sourcing (small creators, non-newsworthy topics) are
exactly what excludes the cards a gacha is emotionally built around.

Not resolved here. The options are a curated legends allowlist (`assignPool` already anticipates
one), a second broader vocabulary used only for the legends tier, or accepting that a set tops
out at SR. Recorded now so the empty top bands are read as a known consequence rather than a
sourcing failure.

</details>

## The deploy runs locally, not in CI (2026-07-31)

<details>
<summary><b>Publishing moves to a Netlify direct upload from Ash's machine</b> — Hydration needs a key, the built set can't enter git, so the only place that can do both is the operator's own machine.</summary>

The refresh/deploy was written as a GitHub Actions workflow and then moved, on Ash's
objection to putting an API key in a repo secret. The objection surfaces a constraint the
original design had absorbed without stating:

- The deploy must **hydrate** channel IDs into live statistics. That needs a key.
- The built set can **never be committed**. Git is permanent, so a committed set satisfies
  neither the 30-day cap on stored statistics nor a promise that a removal is performable.

Those two together mean the publishing step needs somewhere that has a key and is not a git
history. CI was one answer; the operator's own machine is the other, and it is the one that
keeps the key off GitHub entirely.

So `npm run deploy` builds the set, assembles `_site`, runs the guards and uploads directly
to the CDN. Netlify was already an accepted host (CLAUDE.md), and a direct upload involves no
repo integration and no branch, so the set exists on the CDN and in no git history anywhere.
`test.yml` stays in CI, where it has never needed a key.

**The cost is real and is not hidden:** the 25-day refresh becomes a chore somebody has to
remember rather than a scheduled job, and a missed one is a compliance problem rather than an
inconvenience. That was judged cheaper than the alternatives — committing the set reopens two
closed decisions, and an orphan `gh-pages` branch only launders the history rather than
avoiding it.

</details>

<details>
<summary><b>The site is assembled from an allowlist, and a guard enforces it</b> — A recursive copy of sets/ would have published the draft and walked past the country strip.</summary>

Simulating the assemble step before shipping it caught a real bug: `cp -r sets` would have
published `magic-search.draft.json` — 51 real creators with `country` intact — bypassing the
strip that an entire work package exists to enforce. The file is gitignored and therefore
absent from a clean checkout, so the bug was latent rather than live, which is exactly the
kind that survives review.

The copy now names each file. Two guards then refuse to build if any draft, dev manifest or
`country` field reaches `_site`, and both were verified by planting a draft and watching them
fire rather than by reasoning that they would. They are redundant with the allowlist by
design: the allowlist is correct today, and the guard is what catches the day someone edits
the copy list without thinking about what else lives in that directory.

</details>

## Sizing a printing: the band cap (2026-07-31)

<details>
<summary><b>A deck is never a sourcing pool — the three tiers feed one set, they don't become three</b> — Rarity is derived from subscriber count, so slicing decks by subscriber band slices the rarity ladder out of each one.</summary>

The proposal was to ship the three sourcing pools as three decks: a Legends deck, a
Majority deck, a Small deck. Run against the real 79-card set, two of the three build to
**nothing** and the third is unplayable:

    legends (5M+)      30 cards -> prunes to 0   SR 2 starves; dropping it makes SSR need
                                                 17 of 16, which starves, then UR needs 20
    majority (100K-5M) 22 cards -> prunes to 0   SR 6 starves, then R needs 20 of 16
    wildcards (<100K)  27 cards -> survives, but it is 100% N — one band, so every pull
                                                 returns the same rarity and nothing is rare

The cause is structural rather than a shortage, which is why more sourcing would not have
fixed it: **rarity IS derived from subscriber count** (`rarityFromSubs`), so a deck sliced by
subscriber pool is a deck sliced by rarity. A legends deck holds nothing rare *relative to
itself*, and a small deck holds nothing rare at all. The prune cascade is the build correctly
refusing to ship either.

So the three tiers keep the job they were designed for — steering the SEARCH so the candidate
DB has coverage across the spectrum — and they feed **one** deck carrying the full N→UR
ladder. Themed decks (Tech / Craft / Gaming) stay open and are what the earlier "one app,
many banners" entry actually meant; each one needs the whole ladder inside it.

Recorded because the idea is a natural one — the pools are already named, tiered and
buttoned, so shipping them as decks looks like reuse rather than a category error.

</details>

<details>
<summary><b>Set size is decided by completion time, and only a cap can control it</b> — Band-first pulling means a band's completion time depends on that band's card count and nothing else, so a bloated top band cannot be balanced by growing the base.</summary>

The curated legends roster landed 12 UR cards in a 79-card set, and the resulting set was
unfinishable at the top. The measure is the coupon-collector expectation — for a band of `k`
cards drawn on a share `s` of pulls, `k·H(k)/s`:

    N 27 -> ~190 pulls    R 16 -> ~200    SR 8 -> ~180    SSR 16 -> ~1,080    UR 12 -> ~3,720

The base finishes eighteen times over before the chase cards do. The load-bearing part is
**why growing the set cannot fix this**: WP4's two-stage pull picks a band by fixed weight and
then draws uniformly inside it, so a band's completion time is a function of that band's own
card count and of nothing else. Adding three hundred commons changes the percentages on the
tin and leaves UR at 3,720 pulls. The only lever is how many URs there are.

Hence `maxCardsForBand`/`bandTargets` in `engine/setbuild.js` — the ceiling matching the floor
that was already there, and derived from the same weight table for the same reason. Allocation
is by water-filling: start every band at the floor it must clear, then hand the next card to
whichever band completes soonest, until the budget is spent. Equal completion times fall out
of that, and the floor is honoured by construction rather than clamped afterwards. At 400
cards it yields **N 199 · R 109 · SR 56 · SSR 28 · UR 8**, every band finishing within
2,125–2,199 pulls.

Closed off, and both were the obvious answers:

- **"Give each band targetSize × its weight."** Weight is the rate a band is DRAWN at, not the
  depth it needs. `H(k)` grows logarithmically, so proportional allocation leaves the common
  bands taking ~3x longer to complete than UR — the same failure, pointed the other way.
- **"Keep the hand-written N40/R30/SR18/SSR9/UR3 mix"** from the monthly-printings entry. That
  number is a survivor of the per-card-weight era, when composition still moved the drop
  rates; band-first pulling took its justification away and nobody noticed, because it kept
  looking reasonable. The derivation lands close to it, which is a good sign for the old
  number rather than a reason to keep inheriting it unexamined.

</details>

<details>
<summary><b>Surplus is held, not discarded — the cap is seeded on the set slug</b> — Which cards survive the cap is a hash of <code>slug:channelId</code>, so a later printing draws a different subset with no rotation ledger to maintain.</summary>

Capping raises "which twelve URs, and what happens to the other four". Selection hashes
`slug:channelId` and keeps the lowest, so a build is reproducible from its inputs alone and a
*different slug selects a different subset* — Series 2's chase cards are already sitting in the
candidate DB, and nothing has to remember what Series 1 printed. That matters because the DB
is the only committed artifact and it deliberately holds ids, not history.

Keyed on the channel id rather than on subscriber count on purpose: "keep the biggest" is the
tempting rule and would make every printing's top band identical, which is exactly the outcome
the rotation exists to avoid.

</details>

<details>
<summary><b><code>--tier</code> exposes the sourcing tiers to the CLI, because filling a printing means aiming at a band</b> — The build now reports which band is short, which is only actionable if the tool can be pointed at one.</summary>

`SEARCH_TIERS` has steered the in-page buttons since WP6 and the CLI could not reach it, so
`tools/magic-search.js` sourced broadly and hoped. Once the cap gave the build a per-band
target, its report became a shortfall list — and a shortfall list is only useful if the tool
can act on it. Measured across the fill: the wildcards tier added 151 cards to N without
touching R or SR, and the majority tier took R from 31 to 111.

The tier replaces both the search bias and the band filter together rather than merging with
`MS_MAX_SUBS`, because two ceilings arriving from two places is how a sourcing run quietly
returns nothing.

Also recorded, since it was measured rather than assumed: **`MS_PER_QUERY` was costing more
than it looked.** One `search.list` is 100 quota units and harvests ~50 uploaders, so the
default cap of 5 paid full price and discarded most of the result. At 30, the same 100 units
returned ~10 usable cards per query instead of ~4. The remaining waste is queries that return
zero uploaders — roughly one in three, since the jittered window can land on an empty stretch —
and that is the real cost of the randomization, worth naming rather than hiding.

**Curation is also simply cheaper than search, which inverts the intuition.** A handle costs
1 unit to resolve; a search costs 100. Closing SR's last 26 cards and SSR's 12 by hand cost
~55 units against several thousand for the equivalent search coverage — and the curated names
match the hobby/craft vocabulary better than whatever a broad query surfaces.

</details>

## Recognition is the product (2026-07-31)

<details>
<summary><b>The cap takes pins, because recognition is human knowledge and a hash cannot hold it</b> — The first 400-card build hashed PewDiePie, Mark Rober and Dude Perfect out of UR and kept five record labels.</summary>

The band cap decides which cards survive by hashing `slug:channelId`, which is right for the
bulk of a roster and wrong for the cards a set is sold on. The first 400-card build shipped a
UR band of **MrBeast, Cocomelon, BLACKPINK, 5-Minute Crafts, Justin Bieber, Taylor Swift, Ed
Sheeran and Ariana Grande** — one YouTuber, a nursery-rhyme channel, a craft farm and five
record labels, with PewDiePie, Mark Rober and Dude Perfect hashed out. Every chase card in a
game about YouTubers, decided by a hash.

A `!` prefix in the roster pins an entry: it sorts ahead of everything in its band, so the
hash only ever decides the remainder. The eight UR pins are exactly the eight UR slots, so
that band is now entirely curated, and the music-label channels stay in the DB unpinned —
they are real 50M+ channels and belong in the pool, but they are not what anyone is chasing.

Why a rule could not do this: **recognition is not subscriber count.** A 20M-subscriber
channel the audience has never heard of makes a worse card than a 20M-subscriber channel they
have, at identical stats — the reward of pulling a chase card is knowing who it is. That is
the same reasoning that put the legends roster in a hand-maintained file, applied one level
further down. "Keep the biggest" was already rejected for making every printing identical;
it would also have been wrong on the merits.

Pins are STICKY across merges, and deliberately: most merges come from Magic Search, which
knows nothing about the roster and would otherwise clear every pin it walked past. Un-pinning
is deleting the field in `catalog/candidates.json`. A pin is also **not** an override of the
denylist — an opted-out creator is still evicted, pinned or not, and a test pins that.

</details>

<details>
<summary><b>The keyword vocabulary widens to gaming, tech, sports and lifestyle</b> — Only the news/politics/person-named half of the original restriction was ever load-bearing; the narrowness was costing the top of the set.</summary>

`KEYWORD_SEEDS` was hobby/craft only, and an earlier entry closed off broadening it as
"maximising reach in exactly the direction the project has been steering away from". That
reads as one decision and is really two, and only one of them mattered: **no news, no
politics, no drama, nothing keyed to a real person's name.** Gaming and tech are hobbies with
enormous channels; sports and lifestyle are mainstream without being newsworthy. None of them
touch the guardrail.

What the narrowness cost was the whole top of the set — hobby keywords essentially never
surface a 10M+ channel, so SSR and UR could only ever be filled by hand, and the commons were
drawn from niches an anglophone audience mostly has not heard of. 52 seeds added across the
four topics.

`SEARCH_BASE` also gains `relevanceLanguage: 'en'`. Chosen over a country allowlist, which
looks stricter and is worse: `snippet.country` is declared by only ~70% of channels, so an
allowlist silently drops the ~30% who declare nothing, and plenty of those are
English-language. A bias costs nothing, spends no extra quota, and still lets a non-English
creator big enough to be recognized anyway come through.

Honest about what this does NOT fix: the commons are still a blend. `relevanceLanguage`
biases rather than filters, and the ~380 candidates sourced before this landed were found
with no language signal at all, so N and R still carry names an anglophone player will not
recognize. The top two bands are curated and the commons are sampled; that is the trade, and
it is the right way round.

</details>

<details>
<summary><b>Measured: broad topics triple the India exclusion rate — 8-13% to 34%</b> — The exclude does far more work on mainstream vocabulary than on hobby vocabulary, which is a real cost of broadening and an argument that the filter is not a token.</summary>

Twelve queries across gaming, tech, food, fitness, travel, reaction and beauty hydrated 521
channels: **declared a country 81.4%, excluded 177 (34.0% of all, 41.7% of those declaring)**.
The hobby/craft runs measured earlier the same week came in at 8.6-13.3%.

Two things follow, and they point in opposite directions. The exclude is doing considerably
more work than the original 10-15% prediction or even the 8-13% measurement suggested, which
strengthens the gate's reliance on it. And broadening the vocabulary costs real yield —
roughly a third of everything mainstream topics surface is discarded before it can become a
card, so the same 100-unit search buys fewer usable candidates than it does on craft topics.

Recorded because it is the kind of number that only exists if someone prints it, and the gate
rests on what the filter actually does rather than on what it was designed to do.

</details>

## The refresh gets an alarm (2026-08-01)

<details>
<summary><b>Two thresholds: warn at 25 days, refuse to publish at 30</b> — Refusing at the cadence would block a compliant day-26 publish and teach somebody to reach for a bypass; a guard people route around protects nothing.</summary>

The mechanism for honouring YouTube's 30-day cap on stored statistics has existed since WP7 —
`build-set.js` re-hydrates every id in one run, so a single command resets the whole clock for
~13 quota units and no searches. What never existed was a **check**. A set forty days old
built, assembled and served exactly like a fresh one.

That gap is sharper here than it would be elsewhere, because the deploy deliberately runs on
one machine rather than in CI (the key never goes near a repo secret). The cost was accepted
openly at the time — "the 25-day refresh becomes a chore somebody has to remember" — but a
chore with no alarm attached is one that gets missed, and a missed one is a compliance problem
rather than an inconvenience.

`engine/freshness.js` (pure, `now` injected like gacha's rng) sets two thresholds:

    REFRESH_DAYS  25   the cadence — warn, keep building
    POLICY_DAYS   30   the actual cap — REFUSE, publishing is blocked

Warning at 25 and refusing at 30 rather than refusing at 25 is the whole design. Refusing at
the cadence would block a day-26 publish of data that is still perfectly compliant, and the
predictable result is a `--force` flag that gets used every time. The five-day gap is what
makes a missed Sunday survivable.

**An undated set is refused too.** No `snapshotDate` is not "fine", it is "its age cannot be
established", and the only safe reading of that is closed. `refreshStatus` returns
`publishable: false` for it, and a test pins that specifically, because failing open there
would let the one file whose age nobody can verify walk past the guard built to catch it.

The guard sits in `build-site.js` beside the two that were already there, and was verified the
same way they were — by planting a 26-day set (warned, built), a 33-day set (refused), and an
undated one (refused), then checking the **exit code breaks the `&&` chain** so the upload
never runs. Reasoning that it would have worked was not sufficient for the other two guards
and is not sufficient here.

</details>

<details>
<summary><b>The refresh ledger is committed, because it is the only artifact that can prove the cadence was kept</b> — A built set carries one date, so it knows when it was last made and nothing about the runs before it; a missed month is invisible there and obvious in a log.</summary>

`catalog/refresh-log.json` records one line per build and per deploy: timestamp, event, slug,
card count, snapshot date. **Dates and counts only — no titles, no ids, no statistics** — which
is exactly what lets it be committed while every file carrying creator data stays gitignored.
A test asserts the entry's exact key set, since the real risk is a future field quietly turning
it into creator data.

That it is committed is the point. Every other refresh artifact is deliberately local and
disposable, so the receipt that the 30-day cap was honoured would die with the machine that
produced it. This one survives, and it is the document you would actually show if anyone asked.

**`build` and `deploy` are separate events on purpose.** Conflating them hides the exact
failure the ledger exists to catch: rebuilding locally and never shipping, which leaves the
machine looking refreshed while the CDN still serves the old snapshot. Only the published copy
is under the cap, because it is the only one anyone can read. `tools/record-deploy.js` runs
**last** in the `&&`-joined deploy chain and reads `_site` rather than the build output, so a
failed upload writes nothing — the ledger records deploys that happened, not deploys that were
attempted.

`npm run status` reads all of it with no key and no network, and exits 0/1/2 (nothing due /
refresh due / expired) so a scheduled task can act on it instead of printing into the void. It
also flags roster drift — candidates added since the last build — which is the other reason to
rebuild and the one no clock would ever catch.

</details>

## A printing is 1,200 cards, and the rotation was broken (2026-08-01)

<details>
<summary><b>The seeded rotation shared 64% of a band between printings, where the design called for 14%</b> — <code>hashOf(`${seed}:${id}`)</code> shifts every id by the same constant, and adding a constant does not reorder a sort.</summary>

The band cap keeps `k` of a band by hashing `slug:channelId` and taking the lowest, so a
different slug was supposed to select a different subset — that is what makes surplus "a later
printing's chase cards" rather than dead weight.

It did not work. `hashOf` accumulates `h = h*31 + ch` left to right, so prepending a different
seed offsets **every** id's hash by the same constant. Measured directly: the difference between
`hash("series-1:"+id)` and `hash("series-2:"+id)` was `-28629151` for every id tested. Adding a
constant preserves sort order everywhere except the single wraparound point, so consecutive
printings shared **64%** of an 8-card UR band against a design target of 14%.

The test did not catch it because it asserted the two subsets were *not identical*, which a 64%
overlap satisfies comfortably. That is the lesson worth keeping: it tested **different** when the
property that mattered was **how different**. The replacement asserts the measured overlap rate
against the model, and would fail on the old hash.

Fixed by hashing seed and id separately, combining them, and running the result through a
murmur3 finalizer so a one-bit change avalanches. Re-measured at 14.3–15.1% against an ideal
`k/R` of 14.3%.

That ratio is what makes roster depth answerable: **expected overlap between consecutive
printings is k/R**, so a roster of 7k repeats about one card in seven.

</details>

<details>
<summary><b>A printing is 1,200 cards, and UR supply is what caps it</b> — Scaling does not dilute recognition; the ceiling is that English creator-owned 50M+ channels barely exist.</summary>

400 was chosen when the roster was 622 candidates and the question was "what can we fill".
With the roster at 1,348 the real question is what a set should be, and 400 is too small — a
dedicated player completes every band in ~2,100 pulls.

Two things measured before deciding:

- **Scaling up does not dilute recognition.** The 5M+ tier holds at 13–14% of the set at every
  size, because the cap allocates by completion-equalisation and those ratios are
  scale-invariant. A bigger set carries proportionally the same share of recognizable cards and
  more of them absolutely — 36 at 400, 101 at 1,200. The opposite was expected.
- **Payload is not a constraint.** 391 bytes a card, and the host gzips: 1,200 cards is 458KB
  raw and **131KB** over the wire.

What does bind is UR. The cap wants UR 22 at 1,200 cards, 28 at 1,600 and 34 at 2,000 — and
English-language, creator-owned, non-India, non-child-performer channels above 50M subscribers
number roughly 15–30 *in the world*. Past ~1,600 the band could only be filled with record
labels and kids channels, and a UR band that ships short completes FASTER than the commons,
which inverts the point of a chase card.

So 1,200: `N 608 · R 327 · SR 164 · SSR 79 · UR 22`, every band completing within 7,725–8,120
pulls. Three times the content of the 400-card set, still inside supply.

**Open, and visible in the shipped set:** at 22 UR slots and only 8 pins, the remainder is filled
by the unpinned label channels — Bieber, Swift, Sheeran, Ariana, Eminem, Marshmello, BLACKPINK.
Not a regression (at 8 slots the pins filled it exactly) but the supply wall showing up in the
product rather than in an estimate. Either pin more, shrink UR and the printing with it, or
accept labels as filler. Recorded rather than quietly resolved, because the pins are a statement
about what the set is sold on.

</details>

## Share is scrapped, after being built (2026-08-01)

<details>
<summary><b>The card-to-PNG export is withdrawn — the work package is deleted, not deferred</b> — It was the one feature that put copies beyond the reach of the opt-out, and its benefit scales with users the project does not have yet.</summary>

WP10 was built and is being removed before it ever shipped. The code worked: a hand-drawn
canvas card with the unofficial-fan-card notice burned into the pixels, 16 tests on the caption
and filename, real avatars confirmed drawable because Google's CDN sends
`Access-Control-Allow-Origin: *`. None of that was the problem.

**The problem is what an export does to the opt-out.** The legality gate closed on five
mitigations, and the strongest is a removal honoured within 7 days. That promise is keepable
today because every copy of a card is ours — denylist, rebuild, gone. An export creates copies
we cannot recall, so the in-app removal keeps working while the circulation does not stop. It
is also the feature most likely to *generate* the removal request in the first place: the
recorded modal bad outcome is "an email asking for removal", and a card on a timeline carrying
a real face and subscriber count produces that far more reliably than a page nobody visits.

The counter-argument is real and was weighed: anyone can screenshot, and a screenshot carries no
disclaimer at all, so an export arguably makes circulation *safer* rather than more dangerous.
That is true about kind and wrong about volume. A screenshot takes intent; a Save button is an
invitation. And volume is exactly what turns "obscurity is protective" into "not protective" —
which this file already names as one of the three conditions that would reopen the gate.

**What decided it: the benefit scales with users, the risk starts on day one, and there are no
users yet.** Sharing is a growth mechanism with nothing to grow — the deploy has not happened.
Shipping it now would have bought nothing and spent the one thing that cannot be walked back.

Deleted rather than deferred, and rather than hidden behind the dev flag. A gated feature is a
decision postponed, and this one does not need postponing — if sharing is ever wanted it will
want redesigning around whatever is true then (emblem-only exports, say, which keep the share
loop and drop the likeness from the artifact that travels). Keeping dead code behind a flag to
avoid admitting a reversal is how a codebase accumulates things nobody will delete later.

The reverted commit stays in history on purpose. Building something, reasoning about it, and
withdrawing it before launch is a decision worth being able to read.

</details>

## The collection persists (2026-08-01)

<details>
<summary><b>Supersedes "No persistence yet" — the collection saves to localStorage, the API key still never does</b> — The old entry was about sandboxed previews, and there is a real host now; the key staying memory-only is structural rather than a rule someone has to remember.</summary>

The earlier decision kept everything in memory "to stay safe in sandboxed previews. Revisit
once the app is being served from a real static host." That condition is met, and a gacha whose
collection evaporates on reload has no reason for anyone to come back to it.

What changed is only the collection. **The API key remains memory-only**, and the way that is
guaranteed is worth stating: `src/storage.js` is the single module that touches localStorage,
and the only thing it is ever handed is a collection. There is no code path that could persist
a key by mistake, so the promise in the footer is kept by the shape of the code rather than by
a rule someone has to remember. A test writes a key onto the collection object and asserts it
cannot reach the serialized bytes.

`engine/collection.js` is the pure half (shape, validation, reconciliation) and is where the
tests live; `storage.js` is the thin IO edge, which is the same split `data/sets.js` draws
between `parseSet` and `loadSet`. It sits at the root rather than in `engine/`, `data/` or
`ui/` because it touches none of those three — not pure, not the network, not the DOM — which
is the same reason `state.js` lives there.

</details>

<details>
<summary><b>Store the channel snapshot, not the card, and not just the id</b> — Derived fields can always be recomputed but can also drift out of agreement with the code that computes them; an id alone would make cards vanish when a set is re-cut.</summary>

A card is `toCard(channel)` — `{ channel, rarity, atk, def }` — where everything but the
channel is derived, purely and deterministically. Persisting the derived half would mean a
saved rarity could one day disagree with `rarityFromSubs`, a bug with no way to detect it. So
the store holds the channel and the count, and the card is re-derived on load. The same
discipline as the candidate DB storing ids rather than statistics: keep the source, compute
the rest.

Storing *only* the id was the other option and is worse. The set is re-cut on every build —
subscriber counts move, a channel crossing 10M jumps SR to SSR, and the band cap then selects
differently — so a card in somebody's collection can leave the set entirely. An id-only store
would make their card silently disappear on the week that happens. A collection is a record of
what you pulled; a physical card does not vanish from a binder because its subject got popular.

The stored channel is a positive allowlist, so `country` is absent by construction here too —
the third file to use that pattern, and the reasoning is strongest here because this is storage
on someone else's device that we cannot clear remotely.

</details>

<details>
<summary><b>A saved snapshot stays inside the 30-day cap by being refreshed from the set, not by expiring</b> — The set a player just loaded IS current data, so reconciling against it costs nothing and needs no extra request.</summary>

A snapshot sitting in a player's browser is still stored API data, and the Developer Policies
cap statistics at 30 days. Expiring cards would have been the obvious answer and would have
deleted the thing people came for.

`reconcileCollection` runs whenever a set loads: every owned card whose id is in that set is
refreshed from it, counts preserved. A player who opens the game at all therefore carries
current data for everything still in print, automatically, with **zero** additional API calls —
the set was going to be fetched anyway. Only cards that have genuinely left the set keep an
ageing snapshot, and those carry `savedAt` so they can be expired later without guessing when
they arrived. It writes only when something actually changed, so opening the game twice in a
row does not touch storage the second time.

**Every path in `storage.js` swallows its errors.** localStorage is not reliably available:
private modes have thrown on write, a full store throws `QuotaExceededError`, and a sandboxed
frame can throw merely on *accessing* `window.localStorage` — so the availability check is
inside the try, not a `typeof` guard. All of it was exercised against a shim rather than
assumed: corrupt JSON reads as empty, a throwing setter returns false, a throwing accessor
degrades to the in-memory behaviour the app shipped with for eight work packages. A collection
is a convenience; it must never be able to break the game.

**The clear button is part of the decision, not polish.** Data kept on someone's device with no
way to remove it is not "local and yours", it is data they cannot delete — and WP10's privacy
policy is about to claim the former. It is confirmed before it fires, since a collection is the
only thing in this game a player can lose and there is no server-side copy to restore from.

Sizing, measured rather than assumed: one card serializes to 281 bytes, so a full 400-card
collection is ~80KB against a typical 5MB budget.

</details>

## The public picker is two sets, and one of them is honest about being fake (2026-08-01)

<details>
<summary><b>"Arcade Legends" is deleted; "Starter Set" is renamed back to "Demo Set"</b> — What ships is Series 1 plus one clearly-labelled sampler. A second fictional set was scaffolding that would have read as content.</summary>

Two changes to what a first-time visitor sees, both about the same thing: a public site should
not offer fake decks that look like real ones.

**`sets/sample-series.json` — "Sample Series — Arcade Legends" — is deleted.** It existed to
prove the fetched-set adapter worked, back when there was no real set to fetch. `series-1.json`
now proves that on every page load, so the sample was doing nothing but sitting in the picker
as a second fictional option next to a 1,200-card deck. Nothing depended on the file:
`test/sets.test.js` uses an inline fixture that merely shares its slug, and `build-site.js` was
the only thing copying it.

The committed `sets/index.json` now ships **empty**. That looks like an oversight and is not —
`banner.js` fetches it with `warnOnFail: true`, so deleting the file would show a visitor an
error about a set list they never asked for. An empty manifest fetches fine and appends nothing.

**The bundled set goes back to being called the Demo Set.** WP4 folded the old standalone Demo
mode into a bundled set and renamed it "Starter Set" in the process. That name was right when it
was the only set in the app; it is wrong now. "Starter" is trading-card language for the
beginner deck of a real game, which oversells eight invented channels sitting one dropdown row
below Series 1. "Demo" says what it is. The WP4 fold — one code path, a real set behind the
seam, not a special case — is entirely unchanged. Only the label moved.

Renamed all the way through (`data/starter.js` → `data/demo.js`, `STARTER_SET` → `DEMO_SET`,
slug `starter` → `demo`) rather than only in the UI string, because a module named for a thing
the app no longer calls it is exactly the drift this repo claims not to have.

**The `UCstarter-…` channel ids are deliberately NOT renamed.** A saved collection keys on
channel id, so changing them would orphan any demo cards already in a binder — a real cost to
rename a string no user will ever see. The inconsistency is the cheaper side of that trade and
is commented where it lives.

What did *not* change, and was the thing worth checking: the demo set stays in the picker and
stays bundled. It is the offline fallback and the instant first paint — it ships inside the JS
rather than as a fetched file precisely so the default view needs no network. Shipping Series 1
alone would hand a visitor on a bad connection an empty banner.

Still open, and deliberately not bundled into this: **Series 1 is not yet the default
selection.** The demo set seeds the picker first because it loads synchronously, so it is also
what stays selected. That is the remaining half of the deployment-structure item.

</details>

## Recognition is sourced, not searched (2026-08-02)

<details>
<summary><b>Public ranking lists replace keyword search for every band above the commons — measured at ~1.2 quota units per candidate against ~11.5</b> — and a curation exclude, kept deliberately separate from the opt-out denylist, holds out the channels a ranking would never have surfaced.</summary>

Two sourcing routes were run against each other in one evening, on the same candidate DB.

| route | spend | candidates | per candidate |
|---|---|---|---|
| public lists → `add-candidates.js` | 372 units | 316 | **1.2** |
| Magic Search → `search.list` | ~1,206 units | 105 | **11.5** |

**Why the gap is structural and not a tuning problem.** Keyword relevance does not correlate
with fame. A published ranking already encodes the recognition the code cannot compute — that
is the whole of it. The first 1,200-card printing proved the negative case: every recognizable
name in SSR came from `legends.txt`, and the bottom half of SR came from search and read as
filler. A 2.1M-subscriber study-notes channel is not a bad channel; it is a card nobody
recognizes, sitting in a band that is 12% of every pull.

**Staleness is a non-issue, by construction.** A list supplies IDENTITY only. `build-set.js`
re-hydrates every statistic on each build, so a year-old ranking mints an identically fresh
card. This is a property of the seam paying off in a place it was not designed for.

**Search keeps exactly one job: the commons.** No "top YouTubers" list ranks sub-100K
channels, and N is 55% of every pull. So the expensive tool is now aimed only where it is the
only tool — and where recognition matters least, since no player is disappointed by an
unfamiliar common.

**The curation exclude is a separate file from the opt-out denylist, and that is load-bearing.**
`catalog/denylist.json` records creators who ASKED to be removed: permanent, evicts from the
DB, and one of the five mitigations the legality gate closed on. It has to remain readable as a
register of honored requests and nothing else. `catalog/excluded.txt` is an editorial call
about what a printing is sold on — revisable, and it promises no one anything. Mixing them
would make the opt-out unauditable at the exact moment someone asks us to prove we honor it.

It filters at build time (`applyExcludes`, before `capBands`) rather than at merge, so the id
survives in `candidates.json` and un-excluding is deleting a line rather than re-resolving a
handle. Excluding frees the slot instead of shrinking the band: the next-best candidate is
promoted into it.

**What did not get fixed, stated rather than buried.** The UR band is a genuine world-supply
wall, not a sourcing gap — of the ~23 English creator-owned channels above 50M, the set already
holds nearly all of them, and the Wikipedia top 100 is otherwise Hindi, Korean, Spanish,
Portuguese, Arabic, Urdu or India-based. Record labels fell from 8 of 22 to 4 of 26, but three
of the five new arrivals are nursery-rhyme channels, which trades one kind of
recognizable-but-unwatched card for another. Genuinely better, not solved.

**The sourcing vocabulary went mainstream in the same pass**, and the reason is the commons
finding above. `KEYWORD_SEEDS` was 64 hobby seeds against 54 popular ones, so a random draw was
still ~54% craft — defensible while commons were pure fodder, indefensible once they turned
out to be most of what a player sees. Now 65% mainstream. The modifier list was cut back at the
same time: crossing mainstream seeds with craft-shaped modifiers generated queries no human
would type — "mukbang workshop tour" returned zero uploaders and burned a full 100 units — so
the empty modifier now takes ~20% of draws and six craft-only modifiers were dropped.

</details>

## A handle is not an identity (2026-08-02)

<details>
<summary><b>Model recall works as a third sourcing route — it is a recognition signal of the same kind as a ranking, at zero quota</b> — but it exposed a failure mode worse than a miss: five handles resolved to real channels that were not the intended ones.</summary>

The list route (see "Recognition is sourced, not searched") had a ceiling: published rankings
bottom out around 20M subscribers. A third route was tried against the same candidate DB —
names recalled from a language model's training data rather than read off a page.

**Why this is the same kind of signal, not a new kind.** Training data is, for this narrow
purpose, a compressed index of which channels were written about enough to be remembered.
That is recognition, which is exactly the thing the code cannot compute and the reason
`legends.txt` exists as a hand-maintained file in the first place. It costs no quota to query
and, like a ranking, it supplies IDENTITY only — `build-set.js` re-hydrates every statistic,
so a stale recollection mints an identically fresh card.

**Result: 68 handles, 68 units, 57 resolved, 52 kept — SR 34 · SSR 18 · R 0.** The R 0 is not
a disappointment; it is the route's stated limit holding. Rankings stop near 20M and training
data thins below ~1M, where recalled handles turn into confabulated ones. The commons gap is
search's job and no amount of recall will close it.

**THE FINDING, and the reason this entry exists.** A wrong handle normally 404s and costs one
unit. Five instead resolved to a *real channel that was not the intended one*: squatters
sitting on abandoned famous handles (`@Tfue` → "RealTfue", 207 subs; `@JonTron` → 114;
`@CleetusMcFarland` → 612; `@JeenieWeenie` → 10), plus one creator's secondary VODs channel
(`@BadBoyHalo` → 56K).

These merge **silently**. The ids were live, they passed the region filter, and they seated
themselves in the candidate DB as N-band filler under famous names — the band that is 55% of
every pull. Nothing in the pipeline could have caught it, because every check the pipeline
runs was satisfied. They were found only because the printed subscriber counts were absurd,
and removed by id afterwards.

**The rule that follows: scan the printed subscriber counts, not just the failure lines.** A
handle is not an identity — it is whoever holds the name *today*. And the risk is concentrated
exactly where intuition says it should be safest: guessed handles for the most famous
creators, because an abandoned famous handle is precisely what a squatter takes.

Miss rate was 11 of 68 — 16%, against the ~10% the earlier passes saw. Recall guesses handles
from display names the same way a human does, and is wrong in the same places.

</details>

## The player is not shown the machine (2026-08-02)

<details>
<summary><b>Set size, drop rates, band composition and collection completion are removed from the UI entirely</b> — they were facts about the machine, and the reveal already answers the only question they were standing in for.</summary>

The banner had grown a dashboard: `1,442 cards in this set`, five rarity count tiles, a
proportional drop-rate bar with a percentage legend, and a collection progress block carrying
owned/total, completion %, and a duplicate counter. All of it accurate, all of it well built,
and all of it wrong for the person it was in front of.

**The test that settled it.** Every one of those numbers describes the *generator*, not the
game. A player deciding whether to open a pack does not need the denominator, and being handed
one changes the activity: a sealed box becomes a checklist, and a duplicate stops being a
near-miss and becomes a logged failure. Wikigacha shows a pack and the words "TAP TO OPEN".
That restraint is not an oversight in it; it is most of why it feels good.

**What replaced it: the pack is the button.** Not artwork beside a submit control — the
primary action is a real `<button>` wrapping the card backs, so it gets keyboard semantics and
a focus ring for free. `×1 / ×10` became a *size* choice rather than a second control that also
pulls, because two buttons that both pull means neither is the thing you are looking at.

**What survived the cut, and the line that decides it.** Search, rarity filters and sort
stayed: they are TOOLS, not telemetry — finding your own card is a need a player actually has.
The rarity chips lost their counts on the same principle, since `SSR 3` turns a way-to-find
back into a readout. "Saved in this browser" stayed because it is not a statistic; it is the
promise the Clear button makes good on.

**Collection sort defaults to rarity, not recency.** The reveal overlay has already shown the
player what they just pulled, seconds earlier and with the full flip — a binder that also leads
with it spends its best row on an answered question. Recency also decays as a default: N is
55% of pulls, so newest-first becomes a wall of Graphite. The NEW badges keep this session's
pulls findable under any sort.

**What this closes off.** Any future "collection completion" or "pity counter" feature now has
to argue its way back in against this entry, not simply be added. Drop rates specifically:
publishing odds is a regulatory expectation for *paid* gacha, and this game has none and never
will (see "No monetization in the game"), so the obligation does not attach. If monetization
were ever added — it will not be — the odds would have to come back, which is one more small
reason it will not be.

**Not removed:** the Live API mode. It is demoted (smaller, dimmed, stripped of the accent
colour the pull controls own) because it needs a Google Cloud key and is noise for the player
this build targets. Deleting a working feature to tidy a screen is the wrong trade.

</details>

## Notability is the third recognition signal, and the only one that reaches R (2026-08-02)

<details>
<summary><b>Wikipedia's List of YouTubers, resolved to channel ids through Wikidata, moved the R band from 22.7 to 27.6 lower walls for 6 quota units</b> — and because it sources ids rather than guessed handles, it structurally cannot repeat this morning's squatter failure.</summary>

R (100K–1M) was the deck's binding band, and neither existing route could reach it. Published
rankings bottom out near 20M ("Recognition is sourced, not searched") and model recall thins
below ~1M ("A handle is not an identity"). The reason is the same for both: **they rank by
SIZE**, and nothing ranks by size at 100K.

**The insight is that notability is a different axis from size.** Wikipedia's List of YouTubers
is a notability list — a creator with an article and 300K subscribers is exactly the R-band card
a player recognizes, and the article does not care how many subscribers they have. That makes it
a recognition signal of the same kind as a ranking, aimed at the band rankings cannot see.

**Ids, not handles, and that is the load-bearing part.** Each of the 947 rows links an enwiki
article; each article's Wikidata item carries property **P2397, the YouTube channel id**. So the
pipeline reads an id off a database instead of guessing a handle off a display name. This
morning's failure — five guessed handles resolving to squatters on abandoned famous names,
merging silently as N-band filler — has no analogue here, because there is no guessing step to
be wrong.

| route | spend | candidates | per candidate |
|---|---|---|---|
| Wikidata ids → `add-candidates.js` | **6 units** | 280 | **0.02** |
| public lists → `add-candidates.js` | 372 | 316 | 1.2 |
| model recall → `add-candidates.js` | 68 | 52 | 1.3 |
| Magic Search → `search.list` | ~1,206 | 105 | 11.5 |

Handles cost 1 unit each; ids batch 50 to a unit. The whole roster resolved for the price of six
handles.

**THE NEW FAILURE SHAPE, since every route has one.** The id route cannot hit a squatter, but
P2397 frequently carries a creator's *secondary* channel, an auto-generated one, or a label
mirror. Derek Muller resolved to a 2K channel rather than Veritasium's 17M; Freddie Wong to a
737-subscriber channel rather than RocketJump. Also three `- Topic` auto-channels, three VEVO
mirrors and two zero-video placeholders. **14 of 280 — 5%**, against the handle route's 16% miss
and 7% wrong-identity.

These are the right *person* and the wrong *channel*, which is a different defect but the
identical symptom: a famous name seated in the commons. They were caught by the rule reach-3.txt
wrote down — **scan the printed subscriber counts, not just the failure lines** — which is worth
noting because the rule was written for a failure mode this route does not have, and caught this
one anyway. They went to `catalog/excluded.txt` rather than being deleted, so a later Wikidata
pass cannot silently re-add them.

**The automatic editorial screen was not sufficient, and the misses are instructive.** A
note-pattern regex over the Wikipedia notes column cut 42 rows, then reading all 336 survivors by
hand cut **53 more**. It catches "political" and misses "anti-ideology"; catches "abuse" and
misses "grooming allegations"; catches "convicted" and misses "controversial". A text screen over
an encyclopedia's prose is a first pass, never the decision. Every hand cut is listed with its
reason at the foot of `catalog/reach-4.txt`.

**Where the wall moved, measured on the candidate pool.** It moved twice in one session, which is
the useful part of the record:

| | N | R | SR | SSR | UR | binding |
|---|---|---|---|---|---|---|
| before | 25.6 | **22.7** | 65.6 | 40.0 | 33.0 | R |
| after reach-4 | **25.6** | 27.6 | 65.6 | 40.0 | 33.0 | N |
| after the commons run | 52.4 | **27.6** | 65.6 | 40.0 | 33.0 | R |

So R is the binding band again, but ~5 lower walls higher than it started. Closing a wall moves
the wall; it does not remove it.

**The printing was deliberately NOT enlarged.** The pool would now support 1,612 cards, and it
stays at 1,200. "A printing is 1,200 cards" already settled this on UR world-supply: the cap
wants 28 UR at 1,600 against roughly 15–30 qualifying channels *in existence*, so a bigger
printing buys commons at the price of filling UR with labels and nursery rhymes. This pass
therefore buys **Series 2 rotation depth**, not a bigger Series 1 — which is the WP9 open item,
and worth saying plainly so the numbers are not read as a shipping win.

**What did not get fixed.** Rotation wants ~7x the per-printing count per band. Against that:
N 1,676 of 4,256 (39%), R 469 of 2,289 (20%), SR 525 of 1,148 (46%), SSR 160 of 553 (29%),
UR 33 of 154 (21%, and world-supply capped, so it will never be met). One printing's worth of
rotation depth is still a long way off, and R is where the next pass has to go.

**The commons run behaved as documented and is worth one line.** Seven `--tier wildcards` batches,
~8,500 units, +966 sub-100K candidates at ~9 units each — better than the 11.5 baseline because
`MS_PER_QUERY` was raised from 5 to 30, which stops a 100-unit search from discarding most of what
it harvested. The names are unrecognizable, as expected and as accepted: no player is disappointed
by an unfamiliar common.

**What this closes off.** "Search is the only tool below the rankings" is no longer true, and no
future sourcing plan should assume it. Notability lists reach R at roughly 1/600th of search's
cost per candidate, so search's remaining job narrows again — to the sub-100K commons alone,
where no encyclopedia has an article and nothing else can reach.

</details>

## The cap comes off: a printing is the whole pool (2026-08-02)

<details>
<summary><b>Reverses "A printing is 1,200 cards" the same day the sourcing passes tripled the pool</b> — Series 1 is now 2,973 cards, every available candidate, and band completion is no longer equalised.</summary>

Ash's call, made after the trade was stated. Recorded because it reverses a decision from
yesterday rather than extending one.

**What changed to make it reasonable.** 1,200 was chosen when the pool was 1,348 candidates and
the cap was doing real work — it decided *which* of a small surplus shipped. After the reach-4
notability pass and seven commons batches the pool is 3,067, so the cap was now holding back
1,773 cards that had already been fetched, filtered and paid for. Sitting on more than half the
deck to preserve a completion curve nobody has played against yet is a worse bet than putting it
in front of the first players.

Built with `--target 3911`, the smallest target at which no band caps — computed from the pure
`bandTargets`, so finding it cost nothing.

    set: 2973 cards — N 1786 · R 469 · SR 525 · SSR 160 · UR 33

**THE COST, stated because it is real and was accepted rather than missed.** The band cap existed
to equalise completion: at 1,200 every band completed within 7,725–8,120 pulls. That property is
now gone. The set is the pool's shape, not a designed shape — N is 60.1% of the set and UR is
1.1% — so **UR completes far sooner than SR**, which is the inversion "Sizing a printing" warned
about. A player who chases will finish the chase band first.

**What is NOT affected, and this is why the cost is survivable.** Drop rates are unchanged. The
pull is two-stage — band first, then card within the band (WP4) — so the weight table governs what
a pack feels like regardless of how many cards sit in each band. Set composition moves *completion
time*, never *pull odds*. If the pull had been one-stage this reversal would have silently rewritten
the game's rarity, which is a decent argument for the two-stage design in hindsight.

**What this closes off.** The 1,200 figure and its completion-equalisation argument are dead as a
default; anything wanting them back has to argue against a live set. The UR supply wall is
untouched and unrelated — it capped how far the *cap* could be raised, and with no cap there is
nothing for it to bind. It returns the moment a target is reintroduced.

**Revisit when there are players.** This is the first decision in the project settled on "ship it
and see" rather than on a measurement, which is appropriate — completion pacing is a question about
people, and there are none yet.

</details>

## The list was the bottleneck, not the method: sweeping the property instead (2026-08-02)

<details>
<summary><b>reach-4 read one Wikipedia list of 947 rows through Wikidata P2397. This queries P2397 directly — 66,908 ids for zero Wikidata quota — and takes the candidate pool from 3,067 to 19,954</b>, which ends R's run as the binding band.</summary>

This morning's entry established notability as the third recognition signal and the only one that
reaches R. It then used that insight on a single hand-compiled page. **P2397 is a property on
~67,000 Wikidata items, and reach-4 touched 947 of them** — so the finding was right and the
application was 1.4% of it.

The sweep queries the property itself: every item carrying a YouTube channel id *and* an English
Wikipedia article. Same notability test, applied to everything that passes it.

| | reach-4 | reach-5 |
|---|---|---|
| source | one list, hand-copied | SPARQL over P2397 |
| swept | 947 rows | 66,908 ids |
| kept | 280 | 16,887 |
| YouTube quota | 6 units | 1,326 units |
| per candidate | 0.02 | **0.02** |

The per-candidate rate is identical at 70x the volume, which is the property of an id-based route
worth naming: it does not get more expensive as it gets bigger. Search costs 11.5.

**THE SCREEN IS STRUCTURAL, AND THAT IS THE REAL UPGRADE.** reach-4 learned that a regex over an
encyclopedia's prose "catches 'political' and misses 'anti-ideology'". A Wikidata claim does not
have that failure mode, so the entire editorial line moved into the SPARQL itself — no death date,
no Indian citizenship, no public office held, no political party, no criminal conviction, no
politician/journalist/news-presenter/adult/televangelist occupation. Those run **before a single
quota unit is spent**, which also makes them free.

Then, against live stats: the engine's own `DEFAULT_FLOOR` (-15,939), `- Topic` and VEVO mirrors
(-5,530), the region exclude (-126), a title-level editorial screen (-175). The 5,530 auto-channels
are reach-4's documented "right person, wrong channel" defect showing up at scale — it was 5% of
280 there and 8% of 65,006 here, so the defect rate held and the screen for it worked.

**THE ANGLOPHONE CUT IS THE LARGEST SINGLE FILTER AND IT REMOVES REAL CREATORS.** A second free
Wikidata pass kept only channels tied to an English-speaking territory (P27/P17/P495), cutting
**26,036** — more than the floor did. It drops JuegaGerman, Fernanfloo, Luccas Neto, Masha and the
Bear: enormous channels, none of them worse than what stayed.

They fail the standard `catalog/excluded.txt` already states — *"a card works when a player
recognizes the name"* — against an anglophone launch audience. That file was already excluding
channels one at a time for exactly this reason ("audience concentrated in one non-anglophone
market"). Doing it structurally is the same judgement made **before** the quota is spent instead of
after. It is revisable, and a second-language printing is where it gets revised. The 26,036 are not
lost — they were swept, screened and set aside.

**Country comes from Wikidata, not from YouTube, and this is a rule worth keeping.** YouTube's
`country` is self-declared and ABSENT for 11,398 of the 43,236 channels that reached the cut — a
quarter. It cannot carry a decision that size. Wikidata's citizenship claim is present and sourced,
so the territory test reads that, and YouTube's field keeps the one job a self-declaration is the
right instrument for: the India exclude, where what someone declares *is* the relevant fact.

**Where the wall moved.** Lower walls, on the built set:

| | N | R | SR | SSR | UR |
|---|---|---|---|---|---|
| before | 55.8 | **27.6** | 65.6 | 40.0 | 33.0 |
| after | 411 | 245 | 266 | **89** | 34 |

R was the binding band through three sourcing passes and is now third. **SSR binds instead**, at 89
— the first time the wall has landed above R, and the next pass has to go there. UR moved by one
card and will not move: it is world-supply capped, exactly as "A printing is 1,200 cards" said.

**THE LIMIT, stated because it is the honest weakness of this pass.** reach-4 hand-read all 336
survivors and cut **53 the automatic screen had missed** — one in six. 16,887 cannot be hand-read,
so this roster ships without that pass. The structural screens are strictly stronger than the regex
they replace, but "stronger than a regex" is not "equivalent to a person reading it", and the
expectation should be that some cards here would not survive review. `catalog/excluded.txt` is the
instrument, and it works after the fact rather than before. **This is the first sourcing pass whose
output is too large to review by hand, and that is a permanent change in how this pool is curated,
not a one-off.**

**What it costs at the wire.** The uncapped printing is 19,860 cards — 7.4MB of JSON, **2.0MB
gzipped**, which is what a host serves. Left uncapped per "The cap comes off" rather than quietly
reversing a decision made yesterday; `--target` is the lever if a first paint on mobile turns out to
matter more than deck size. Nothing about drop rates changes either way — the pull is two-stage.

**What this closes off.** "Source a notability list" is no longer the shape of the work; the list
was scaffolding around a database query. Any future recognition source should be checked for whether
it is a *property* before it is treated as a *page*. The remaining sourcing jobs are narrow and
named: SSR depth, and the sub-100K commons where no encyclopedia has an article.

</details>

## A structural screen fails structurally: recovering reach-5's false drops (2026-08-02)

<details>
<summary><b>reach-5's territory test could not distinguish "has a foreign country claim" from "has no
country claim", so 2,222 anglophone channels were cut as foreign. Recovered 14 — by reading all 44
in the binding band, not by trusting the signal.</b></summary>

The test read Wikidata P27/P17/P495. A channel whose item carries no country claim at all failed it
identically to one carrying a foreign claim. **Absence and disagreement are not the same thing**,
and the filter had no way to say so.

2,222 of the 26,036 cut declare an anglophone country on YouTube itself. Recovering all of them on
that signal would reverse the cut rather than correct it, and the list says why immediately: A4
(Belarusian), Masha and the Bear (Russian), SOMOY TV (Bangladeshi) and Eros Universe (Indian) all
declare "US". **YouTube's country is what a channel types in** — good evidence for the India hedge,
where the declaration is itself the relevant fact, and poor evidence of who an audience is. That
asymmetry is why reach-5 read country from Wikidata in the first place, and it did not stop being
true here.

**So the recovery was scoped to the band that needed it, at a size a person can read.** SSR binds
after reach-5 (89 lower walls against R's 245). The SSR+UR slice of the 2,222 is **44 channels** —
small enough to meet reach-4's standard of hand-reading every survivor, which reach-5 explicitly
could not. All 44 read; 14 kept: LEGO, PlayStation, The Dodo, freeCodeCamp, Law By Mike, STORROR,
Brooke Monk, BigDawsTv, Trap Nation, Nas Daily, Cartoon Network UK, Nicki Minaj, Pitbull, Melanie
Martinez. The 30 dropped were dropped for the reason the cut exists. Cost: 1 quota unit.

SSR 357 -> 371 (89 -> 92.8 lower walls). Small, and the size is the point: **the recovery is worth
doing precisely where the numbers are small enough to check, which is the opposite of where the
sweep was worth doing.**

**What this closes off.** "Structural screens don't have the regex's failure mode" was the argument
for reach-5's design and it is still right — but it was read too broadly. A structural screen has
its OWN failure mode, and it is predictable from the claim's semantics: whatever the claim cannot
express, the filter silently treats as a negative. Every future claim-based screen should be asked
one question before it ships — *what does a missing claim look like to this test?* — and the answer
should decide whether a hand pass over the binding band is scheduled alongside it.

</details>

## The first deploy, and three things it changed on the way out (2026-08-03)

<details>
<summary><b>Live at creator-gacha.netlify.app.</b> Getting there reversed two UI decisions and
caught one deploy trap that would have failed silently.</summary>

**THE SILENT TRAP: headers in `netlify.toml` apply to nothing here.** The natural place to put
cache and security headers is `netlify.toml`, and it would have been wrong. `[[headers]]` blocks
are resolved by Netlify's **build system**, and this deploy is a direct upload of a folder
assembled locally — there is no build for them to be resolved by. They would have looked correct
in the repo, been committed, reviewed, and applied to nothing. `_headers` ships inside `_site`
instead, copied by name like every other file, and is confirmed applying on the wire
(`Cache-Control: public,max-age=86400` on the set, `nosniff`/`DENY`/`no-referrer` everywhere).
Netlify serves the deck as **Brotli**, so the 7.4MB set is smaller over the wire than the 2.0MB
gzip estimate.

**A new guard, because the copy allowlist grew a second failure mode.** Adding a page means
editing the repo AND `build-site.js`'s allowlist, and forgetting the second produces a 404 that
is invisible locally — the file is simply there. So the build now asks the assembled site
whether every page it links to actually shipped, and refuses if not. Same shape as the existing
guards: cheap, and it only pays off the day someone edits the list without thinking.

**Netlify's new default is private, and it is worth writing down.** New Free teams get
`sso_login: true` on every project — the site deploys correctly and then answers 401 to the
world. The site-level API call to clear it returns 422 if `sso_login_context` is included and
succeeds with `{"sso_login": false}` alone. Also: `Preview access` was set to **team only**
rather than public, and that is a policy decision, not a preference. Netlify keeps every past
deploy permanently reachable at its own URL, so public previews would leave tonight's snapshot
world-readable forever — statistics that pass the 30-day cap today and violate it in a month.
The staleness guard only governs the deploy being made, never the ones already on the CDN.

**REVERSAL 1: the collection's filter chips are permanent.** They used to appear at 12 cards and
only for bands the player held, on the argument that "offering a UR filter to someone with no UR
is a button whose only outcome is an empty grid". The empty grid is now the point — the five
bands are the shape of the game, and a new player should be able to read what they are chasing
off the binder before they own any of it. The empty tray also names the band ("No R cards in
your collection yet") instead of the generic "nothing matches those filters", because the player
can already see which chip they pressed. The chips stay identical whether held or not: marking
the empty ones would smuggle the progress readout back in through CSS, having just removed it
from the markup. Search became permanent for the same reason a beat later. Only sort still waits
for 12 cards — ordering is the one question that genuinely does not arise at four.

**REVERSAL 2: Live mode is dev-only.** It was the app's original premise — bring your own key,
pull any channel — and sets made it vestigial. Asking a player for a Google Cloud API key to
reach a thinner version of what the front page already does with 19,874 cards and no setup is a
wall in front of the game, not a feature. Gated with `gateDevElement`, not deleted, and the
reason is not sentiment: the in-page Magic Search and the key field live inside those controls
and are how sourcing gets driven from a browser. `?dev=1` restores all of it.

**What this does NOT change, stated because it looks like it should.** Locked decision 3 names
"users bring their own YouTube Data API key" and is about HOSTING — client-side only, no
backend. That is untouched. `data/youtube.js` is untouched too: `tools/add-candidates.js`
imports it, so the live adapter is sourcing pipeline, not UI. The seam still has three sources;
the UI stopped offering one of them.

**The gacha was checked rather than trusted.** One million pulls against the deployed deck:
N 55.05 · R 27.01 · SR 11.95 · SSR 4.99 · UR 1.01, against a table of 55/27/12/5/1. The
interesting column is composition: UR is **0.2%** of the set and drops at **1%**. Under the
one-stage pull those would have compounded to ~0.09%. The uncapped printing made the set 66% N
and moved the drop rates by nothing at all — which is exactly what "The cap comes off" promised
and the first time it has been measured against a live deck.

</details>

## The scheduled refresh republished the site at 400 cards (2026-08-03)

<details>
<summary><b>A decision that only holds when someone remembers a flag is not a decision the tooling
carries.</b> The first run of the new Task Scheduler job shrank the live set from 19,874 cards to
400, having done exactly what it was told.</summary>

`npm run deploy` runs `tools/build-set.js` with no `--target`, which fell through to
`DEFAULT_TARGET_SIZE = 400`. Every by-hand build since "The cap comes off" had passed a target
(`--target 3911`, then `--target 30000`); the unattended one could not, because nobody was there
to type it. So the automation silently reverted a decision made by hand the day before, and
reported success while doing it.

**It was caught only because the task was fired once on purpose instead of being left to prove
itself next Sunday.** That is the transferable part: a scheduled job that has never been watched
run is not automation, it is a hypothesis. The cost of the test was one wrong deploy at 1:48am
with no players; the cost of not testing was a live site quietly serving 2% of its deck for a
week.

**The fix is a symbol, not a bigger number.** `targetSize: UNCAPPED` ships the whole pool, and
`--target` now means "cap deliberately" rather than being the only way to avoid a cap. A large
number was the obvious fix and is the trap the previous builds were already one sourcing run
away from: 30,000 works until the pool passes 30,000, at which point capping resumes and the
build still says it succeeded. A sentinel cannot rot that way, so the CLI default became UNCAPPED
and the intent stopped depending on anyone's memory.

**What this says about defaults generally, since the same shape will recur.** The constant was
not wrong when written — 400 was right when the pool was 1,348 and the cap was choosing among a
small surplus. It became wrong when the decision above it changed, and nothing forced it to move,
because every human invocation was passing an override that hid it. **An override in every manual
path is a symptom: it means the default no longer expresses the intent, and the first unattended
caller will find that out.**

Three tests pin it, including one asserting that a merely-large target still caps where UNCAPPED
does not — the distinction the fix exists to make.

</details>

## A person gets a card. An institution does not. (2026-08-03)

<details>
<summary><b>8,379 cards — 42% of the printing — removed, and every future sourcing run screens
for it.</b> The reasoning is about who has a legal department, not about who makes a good card.</summary>

I raised this as a quality problem: five of ten cards in a screenshot were Fraser Institute, QS
Top Universities, Wi-Fi Alliance and iZotope, and a Wikipedia article plus a channel does not mean
anyone wants the card. **Ash reframed it as a risk problem, and that framing is better.** A
creator like KSI has no reason to mind being on a card. A company, university or trade association
has a trademark budget, a legal team and a written policy about its marks. The downside is
asymmetric — one side sends a thank-you, the other sends a letter — and there are far more
personalities available than slots to put them in, so refusing costs nothing.

That distinction also survives disagreement in a way "is this a good card" does not. It is the
difference between an aesthetic judgement and a decision rule.

**The line is drawn structurally.** Every card was looked up on Wikidata by channel id (P2397)
and classified on **P31, "instance of"** — what a thing IS, not what it is called, which is why it
knows "Traversy Media" is one man and "Rexam Plc" is not. 17,636 of 19,874 cards had an item; of
those only **5,952 were `human`**.

**A BAND IS A PERFORMER, AND THAT IS THE WHOLE RULE IN A LINE.** Arctic Monkeys and The White
Stripes stay for the same reason KSI does; their record label goes. This is why the screen is a
positive KEEP list of performer-shaped types — human, musical group, rock band, duo, comedy
troupe, "YouTube channel" — rather than "anything that is not a human", which would have deleted
every band in the deck.

| | cut | kept |
|---|---|---|
| N | 6,735 | 6,426 |
| R | 1,137 | 3,041 |
| SR | 421 | 1,708 |
| SSR | 84 | 287 |
| UR | 2 | 32 |

Deck: **19,874 -> 11,494**. N takes almost all of it, which makes sense — an encyclopedia has an
article for every school district in America and for very few small creators. The 2,238 cards with
no Wikidata item were KEPT: they are the sub-100K commons keyword search found, individuals who
simply have no article.

**TWO MECHANISMS, AND THEY ARE NOT INTERCHANGEABLE.** The exclude file fixes today's deck and
prevents nothing, which is the half that would have rotted:

1. `tools/wikidata-sweep.js` — the P31 screen, authoritative, before any quota is spent. This also
   promotes the reach-5 route from a throwaway script into committed code; the most important
   sourcing route in the project had been living nowhere and could not be re-run or corrected.
2. `looksInstitutional()` in `engine/discover.js` — a name screen, for channels no encyclopedia
   describes.

**THE NAME SCREEN'S FAILURE MODE IS THE ONE TO GUARD, and it is the opposite of the sweep's.**
A missed brand reaches a curation exclude and gets cut later. A wrongly-matched creator is
deleted silently and nobody ever learns their name. So the pattern carries only unmistakable
legal suffixes and institution words, and **"media", "studios", "network", "group",
"entertainment" and "official" are deliberately absent** — Traversy Media, Let Me Explain Studios
and YMH Studios are one person each. The known over-cuts ("Institute of Human Anatomy", a real
creator channel; "Ltd Edition Cars") are pinned in a test named as a known cost, so that anyone
widening the pattern later has to walk past the evidence.

**What this closes off.** "Notable enough for a Wikipedia article" is no longer sufficient to be
a card, and it was the entire reach-5 admission test. Notability now decides only whether someone
is *findable*; being a person decides whether they are *eligible*. Any future sourcing route has
to answer both.

**A rebuild, not a rule the tooling merely knows.** The build ran through the ordinary path and
the deck is live at 11,494 cards. WWE, Netflix, Red Bull, Peppa Pig, National Geographic, 191
record labels, 226 universities and 149 school districts are out of the game.

</details>

### Addendum: when two structural signals disagree, the tie-break is a judgement (2026-08-03)

The generated pass shipped with a bug worth keeping on the record, because the fix is not the
interesting part.

Wikidata gives many items several P31 values, so a channel can be tagged as a performer AND as an
organisation. The pass resolved that with **"performer wins"** — and **YouTube itself got a card**,
because its P31 list contains "YouTube channel" next to "public company". A tag describing what a
thing is ON cannot outrank one describing what it IS.

**The obvious inverse is just as wrong**, which is what makes this worth writing down. Under
"organisation wins", the casualties are Sidemen, NELK, GameGrumps, h3h3Productions, Yes Theory,
OfflineTV, Kurzgesagt, Wendover Productions and RedLetterMedia — every one filed as
"organization", "business" or "company", because **creator collectives incorporate**. Sidemen is
KSI, the exact person Ash named when setting the rule.

Neither tie-break is right, and the disagreements numbered **72** — small enough to read, which is
the standard this project already applies whenever a band is small enough to check. 51 cut
(every Crunchyroll locale, Prime Video, Disney Plus, discovery plus, TIDAL, KIDZ BOP, orchestras,
NGOs), 21 kept. The sweep tool now vetoes on a narrow HARD_CORPORATE list — public company, record
label, university, nonprofit, broadcaster — and deliberately omits the merely-organisational types
that produced the ambiguity, so future sweeps surface the same handful rather than silently
guessing.

**The transferable point:** a structural screen is only unambiguous while its signals agree. Where
they conflict, no field ordering resolves it — surface the conflicts and read them. There are
never many, and the ones there are turn out to be the interesting cards.

Deck: 11,494 -> **11,444**.

## The machine proposes, Ash disposes (2026-08-03)

<details>
<summary><b>Every filtration now writes a ranked review list, and a human overrules it.</b> Ash's
call, after the institution screen cut Sidemen-shaped channels and I had to hand-read 72 to put 21
back.</summary>

The institution screen is right about school districts, universities and record labels, and it
will never be right about **Sidemen and OfflineTV** — creator collectives that incorporate, and
which Wikidata therefore files as "organization". I resolved 72 such conflicts by hand and Ash's
response was the correct generalisation: *"the distinction won't be easy to make each time by you.
Let me do that then. After each filtration, gimme the dropped channels and I'll tell which ones to
add."*

**That is the right division of labour, and worth stating as a principle rather than a workflow.**
A structural screen is good at *category* — is this a university — and blind to *purpose*: is this
fun, would a player light up seeing it. The second question is what the game is FOR, and it is not
recoverable from any claim in any database. The failure mode of pretending otherwise is silent:
cards vanish and nobody knows which.

    node tools/build-set.js    -> reports/dropped-review.txt, ranked by subscribers
       Ash marks lines with a leading +
    node tools/reinstate.js    -> deletes those ids from catalog/excluded.txt
    npm run deploy             -> the cards are back

**Ranked by size, because that is the axis review actually runs on.** A name worth arguing about
is a name someone recognizes; the 6,000 school districts at the bottom will never be read and do
not need to be. The list is 8,524 long and the top 200 contain every decision that matters.

**TWO FILES, AND THE SPLIT IS THE SAME ONE THE CANDIDATE DB IS BUILT ON.** The review list
carries titles and subscriber counts — channel data — so it is written to gitignored `reports/`.
Ash's edits land in `catalog/excluded.txt`, which is ids only and safe to commit. A reviewable
artifact and a committable one are not the same file, and merging them would quietly put
statistics into git forever, breaking the 30-day cap and the promise that a removal is
performable. Costs no quota: the channels were hydrated moments earlier in the same build.

The `+` marker echoes the `!` pin marker the roster files already use — one leading character,
easy to type, impossible to add by accident.

**What this closes off.** No screen in this project gets to be the last word again. Anything that
removes cards in bulk owes a list of what it removed, in an order a person can actually read.

</details>

## Settled and staged: a curation pass must not reach production by default (2026-08-03)

<details>
<summary><b>The institution filter went live the moment it was written, because it was appended to
the file the build always applies.</b> Reverted — the deck is back to 19,874 — and the two states now
live in two files.</summary>

Ash: *"Revert back to 20k and keep this filtration thing separate. Shouldn't it be like that while
development and testing for us? lets filter and then commit the updated deck later."*

He is right, and the mistake is mine rather than a missing feature. `catalog/excluded.txt` is the
**settled** list — build-set applies it unconditionally — so appending 8,430 ids to it published an
unreviewed judgement instantly. **42% of a live deck disappeared before a single line of it had been
read**, and the review loop built ten minutes later was reviewing a decision that had already
shipped. That is backwards: review is only review if it precedes the consequence.

    catalog/excluded.txt                SETTLED — always applied            94 ids
    catalog/excluded-institutions.txt   STAGED  — reported, never shipped 8,430 ids

The build reads both and applies one. It still computes what the staged filter *would* remove and
writes the review list from that, so the loop keeps working at full strength while the live deck
stays exactly where it is. `--apply-staged` (`npm run deploy:filtered`) promotes it when review is
done — a deliberate act, not a default.

**The general rule, and it is not about institutions.** Any bulk curation pass has two states, and
the tooling has to represent them: *proposed* and *accepted*. Collapsing them into one file makes
"the machine proposes, Ash disposes" unenforceable, because the machine has already disposed. The
same split will apply to the next filter, whatever it screens for.

**The cost of reverting, stated because it is not zero.** WWE, Netflix, Red Bull, National
Geographic and 8,426 others are cards again on a public site, which is exactly the trademark
exposure the institution rule was written to avoid. Ash's judgement: *"Only me and maybe my friends
are using it rn so nothing's gonna happen."* Traffic is effectively zero, the exposure window is
however long review takes, and the filter is one flag away. Recorded rather than argued — but it is
a real risk being carried on purpose, not an oversight, and it should not outlive the review.

**What did NOT change.** Nothing was deleted: 19,968 candidates, 8,524 held out across two files,
0 orphans, and `npm run status` fails if an excluded id ever stops being recoverable. The weekly
scheduled refresh keeps running, and now refreshes STATS without touching deck composition, since
composition is decided by files a human edits rather than by anything the job does.

</details>

## The refresh moves off the laptop (2026-08-03)

<details>
<summary><b>Reverses "the deploy runs locally" — the one decision that had a deadline attached to it.</b>
A compliance obligation on a public site cannot depend on one consumer device being switched on.</summary>

`build-site.js` has said since it was written that the deploy runs locally, because hydrating ids
into statistics needs an API key, and it accepted the consequence in writing: *"the 25-day refresh
becomes a chore somebody has to remember instead of a cron job."*

Ash asked the question that dissolves it: **"what if this laptop dies within the next month?"**

Then the site keeps serving statistics until they pass YouTube's 30-day cap, and there is no
machine left that can refresh them. A Windows scheduled task cannot run while the laptop is off and
cannot exist once it is gone. Worse, the task registered with `LogonType: Interactive` — it only
ran while Ash was *logged in*, a condition nobody would have noticed failing until a month had
passed. Three failure modes, one of them silent, all pointed at a hard deadline.

**The original objection was never really CI.** It was that a built set cannot be committed — a set
file in git is permanent, which satisfies neither the 30-day cap nor a performable removal. That
constraint is untouched here: the workflow builds the set **inside the runner** and uploads it
straight to Netlify. Nothing carrying channel statistics is written to git. The only thing
committed back is the refresh ledger — dates and counts — which is what makes the receipt survive
the machine.

**THE COST, which is real and is the reason this was a decision rather than a task.** The YouTube
key and a Netlify token now exist in GitHub Actions secrets rather than only on one machine.
They are masked in logs and unavailable to fork pull requests, but the key exists in more places
than it did, and that is the price of the site staying compliant with nobody present. Stated
rather than buried, because "we moved it to CI" hides it.

**Weekly, not every 25 days, and the reasoning survives the move.** GitHub's scheduler can delay a
cron run or drop one under load, so four chances per policy window is the design rather than
belt-and-braces. `concurrency` never cancels in progress: a half-finished deploy is worse than a
late one.

**A REPORT, BECAUSE AN UNWATCHED JOB IS A TRUSTED ONE.** `tools/refresh-report.js` emails after
every run — cards published per deck, the band breakdown, the delta since the previous deploy, and
the two dates that matter (refresh due, publishing blocked). It leads with the card count and its
delta rather than a status word, because **"success" is what a broken run says too**: the local
task's first and only run exited 0 while republishing the site at 400 cards instead of 19,874. A
count in an email would have caught that on sight.

A failure email fires on any failed step, names the three likely causes in order, and states the
one-line manual fix. That is the message that actually matters — a silent failure is how a site
goes stale and then non-compliant.

**What did NOT move.** Manual `npm run deploy` still works from any machine with the repo and a
key, and is the recovery path. `tools/schedule-refresh.js` stays in the tree, unregistered, as a
fallback for a machine that has to carry the cadence itself and as the record of why that was not
enough. Two schedulers must never run at once — they race to the CDN and double the quota.

**What this closes off.** No compliance-bearing process in this project may depend on a single
machine again. If something has a deadline and a legal cap attached, it belongs somewhere that
survives hardware.

</details>

## Silence is not success: checking that the job ran at all (2026-08-03)

<details>
<summary><b>The refresh reports by email on every run, which covers "it worked" and "it broke" —
and not the third case, which is the one that happened: it never ran.</b> A run that does not
exist has no steps to fail, so no failure mail is sent, and nothing local changes either.</summary>

The one-off cron pushed to prove the refresh survives a powered-off laptop was due at 07:40 UTC.
At 08:35 the workflow had **zero runs of any kind** — no success mail, no failure mail, no change
on disk. The reporting built the day before was working exactly as designed and had nothing to say.

**Why no channel could see it.** `if: failure()` needs a run to attach to; GitHub silently
dropping a firing produces no run, no steps and no notification. And because the workflow builds
inside the runner and uploads straight to the CDN, a refresh that never happens leaves the laptop
byte-for-byte identical to one that succeeded. Both `status.js` and `refresh-report.js` open by
promising they read files only — no key, no network, no quota — which is what makes them safe to
run on a timer, and is precisely why neither can answer this. **Every channel we had reported
silence, and silence was indistinguishable from success.**

**`npm run runs` (`tools/refresh-runs.js`) asks GitHub instead.** It reads the crons out of the
workflow file rather than keeping its own copy — a checker with a private copy of the schedule
keeps agreeing with itself after somebody edits the YAML — and queries the public Actions API.
No key, no YouTube quota, no auth: the repo is public, so 60 requests an hour are free.

**It is a separate command, and that is the point.** Folding this into `npm run status` would
break the file-only promise that makes `status` safe to run fifty times an hour. Two commands,
two questions: `status` asks whether the live deck is inside the 30-day cap, `runs` asks whether
the machine that keeps it there is alive.

**Late and missed are different verdicts, on purpose.** GitHub's scheduled trigger is best-effort
and lowest priority; ten to sixty minutes late is routine rather than exceptional. A checker that
shouts at minute one would be wrong most times it spoke, and **a checker people learn to ignore is
worse than no checker** — so there is a 90-minute grace window, and `late` explicitly says that
doing nothing is the correct action.

**`never` is split out from `missed` because they want opposite fixes.** A missed firing is the
queue being the queue and the next one will probably land. A workflow with a firing behind it and
no runs at all is broken and stays broken until somebody touches it — a cron pushed minutes before
its own fire time, a schedule that never registered, Actions disabled. Collapsing the two would
have turned this exact failure into "it will come round again on Sunday".

**What this closes off.** A job is not considered reported on because it can send a message when it
runs. Any unattended job this project depends on needs a check that runs **from outside it** and
can distinguish *did not happen* from *has nothing to say*.

`src/engine/schedule.js` holds the cron matching and the verdict, pure and `now`-injected like
`freshness.js`; 21 tests pin it, including the 2026-08-03 case itself. The network and the
rendering stay in `tools/`, per the rule that a module's home follows from what it may touch.

</details>

## The pull screen scrolls (2026-08-03)

<details>
<summary><b>Reverses "the reveal has a fixed footprint, so clip it and never scroll".</b> A fixed
footprint inside a fixed height can only be paid for by shrinking the cards, and on a phone it
paid by rendering the payoff of the entire game at 138px.</summary>

The reveal overlay was `overflow: hidden` with the box capped at `92vh`, reasoning that ten cards
occupy a known space and the beam/ray glow should be clipped rather than allowed to spawn
scrollbars. That is true on a desktop and false everywhere else. Ash's phone reports a 393px
viewport, where the old rule resolved to two columns of **138px** — and 138px is below the width
the card's own type scale is built for.

**Why 138px specifically breaks it.** Every size in the card is `clamp(floor, Ncqw, ceiling)`. The
floors engage one after another as the card narrows — the handle at 250px, the name at 240, the
tier label at 217, the rarity badge at 211, the ATK/DEF numerals at 189 — so below ~240px the type
has stopped shrinking while the box has not. The visible consequences were a `white-space: nowrap`
tier label pinning the badge column, which left the title ~77px, which wrapped it to two lines,
which shortened the avatar's flex slot, which the ring — sized `54cqw`, off the card's WIDTH —
then overran, landing on top of the subscriber count. One chain, five symptoms.

**So the footprint stops being fixed.** The overlay scrolls, cards get ~170px on the same phone,
and the column count is capped by viewport (2 / 3 / 5) rather than pinned at five — five columns
inside a 700px tablet worked out to 107px per card, worse than the bug being fixed.

**What the old comment was actually protecting is kept.** It was never really about clipping; it
was that a scrollbar appearing mid-animation steals width and reflows the grid. `scrollbar-gutter:
stable` reserves that width up front, which solves it without forbidding scroll.

**Centring is `margin: auto` on the box, not `place-items: center` on the container.** Both centre
a box that fits; only one stays reachable when it does not. Container-level alignment puts the
overflow *above* the scrollport with no way to scroll up to it — it would have hidden the first row
of a x10 the instant cards grew.

**The card sheds detail rather than shearing it.** Below 190px a container query drops the tier
label and clamps the name to one line, and the handle finally gets the ellipsis the name got long
ago. The floors are not lowered: 8px type that fits is not an improvement on 8px type that does
not. 190px is chosen to leave the desktop card untouched, where five tracks cap at 200px and
nothing is crowded.

**What this closes off.** No screen in this project may buy its layout by shrinking the cards past
the range their own type scale supports. When space runs out, it scrolls, drops detail, or shows
fewer things — it does not render a card nobody can read.

</details>

## The binder gets a denominator (2026-08-03)

<details>
<summary><b>Partially reverses "the player is not shown the machine".</b> The set size comes back —
in the collection, never on the banner — because the pack and the binder ask opposite questions.</summary>

The earlier decision took the set-size line off the hero on the grounds that **a denominator turns
a sealed pack into a checklist**, and left `#set-count` dev-gated. That reasoning is untouched
where it was aimed. The pack is the thing you open; a total printed beside it is a completion bar
bolted onto the act of pulling, and it makes the pack feel like inventory.

**The binder is the other half of the game, and refusing it a total does not stop the counting.**
A player looking at their own cards is already counting them — that is what a collection is. Withholding
the denominator does not remove the question, it only makes the answer unknowable, which reads as
the game hiding something rather than as restraint.

This is the same argument that put a rarity chip on every band from the first visit, held or not:
**the shape of the game is something a player should be able to read.** An empty UR tray saying
"there is a UR band and you have none" was the more useful answer; so is "142 of 24,251".

Three numbers, because two of them are different questions:

  142 of 24,251 unique   how much of the set have I seen
  187 pulled             how much have I drawn — the gap is where duplicates live
  saved in this browser  unchanged, and still what makes the Clear button honest

**What did NOT move.** `#set-count` on the banner stays dev-gated. The rarity chips still carry no
counts — printing "SSR 3" beside a filter would smuggle the progress readout back into the place
this decision keeps clear of it.

**A latent bug fell out of building it.** `setSetsPool` refreshes every owned card still in print
from newly loaded data, but nothing re-rendered the binder afterwards, so a set load left both the
refreshed stats and now the denominator stale until the next pull happened to repaint. `initBanner`
takes an `onSetLoaded` callback rather than importing the collection view, matching how that module
already talks to the app.

### Addendum: the denominator revealed the wrong thing (2026-08-03, same day)

Narrowed within the hour. "142 of 24,251 unique" is honest about the player's own progress and
dishonest by proximity about something else: it hands out the size of the *entire pool*, including
the ~8,430 staged-institution cards that are not supposed to be a fact anyone outside the project
is counting on. A player's own numbers are theirs to see; the machine's total roster size rode along
as a side effect of showing them, which was the actual mistake — not the earlier reasoning about
counting being unavoidable, which still holds.

The line is now `142 unique · 187 total · saved in this browser` — unique cards vs. total pulled,
no set-size denominator at all. Answers the duplicates question exactly as before; says nothing
about how big the deck is.

</details>

## Moved to Cloudflare Pages — Netlify's free tier does not fit the cadence (2026-08-03)

<details>
<summary><b>Netlify's free tier is a one-time 300-credit grant that does not refill.</b> This
project's actual deploy cadence — a manual push per fix plus a weekly automated refresh —
burns through it well before it would expire.</summary>

Eleven production deploys had already spent 165 of 300 credits (~15/deploy), and today alone
accounted for roughly eight of those eleven. That is not a slow leak to budget around; it is the
exact rate the project runs at whenever active work is happening, against an allowance that is
granted once and never tops up.

**Cloudflare Pages was chosen over the other obvious static host, GitHub Pages, for one concrete
reason: `_headers`.** This project relies on it for real work — the 24-hour cache on built sets
that must never outlive the 25-day refresh cadence, the `no-cache` on app code so a fix isn't
invisible behind a stale cache, and three security headers (`nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`) matching the `referrerPolicy="no-referrer"` already set on every
card avatar. GitHub Pages has no equivalent — no custom response headers at all. Cloudflare Pages
adopted the identical `_headers` file syntax Netlify uses, so the migration is a change of upload
target and nothing else: `_headers` and `tools/build-site.js` needed zero edits.

**Verified before cutting anything over**, not assumed: a manual `wrangler pages deploy` of the
current `_site` was checked against the live Netlify site for card count (24,251, matched),
`styles.css` (byte-identical, 74,188 bytes), and every `_headers` rule individually — `/sets/*`
cache, `/src/*` cache, `/*.html` cache, and all three security headers on `/`. All matched.

**What changed, mechanically:**
- `package.json`'s `deploy` / `deploy:filtered` scripts: `npx netlify-cli deploy --prod --dir=_site`
  → `npx wrangler pages deploy _site --project-name=creator-gacha --branch=main`.
- `.github/workflows/refresh.yml`: the publish step, its secret (`CLOUDFLARE_API_TOKEN` replacing
  `NETLIFY_AUTH_TOKEN`), and the failure-email's troubleshooting list.
- Every user-facing URL — README, TASKS.md, the refresh report's email body — now points at
  `creator-gacha.pages.dev`.

**What did NOT change:** `_headers`, `tools/build-site.js`'s copy logic, the four publish guards,
the ledger format, the whole seam between build and deploy. The only thing that moved is which CDN
receives the folder.

**The rollback path was considered and declined.** Leaving the Netlify site live, unused, meant
`creator-gacha.netlify.app` would keep serving its final snapshot with nothing ever refreshing it
again — silently ageing past the 30-day cap on stored statistics with no guard watching it, since
the guard only runs at deploy time. Asked directly, Ash chose the clean break: the Netlify site
was deleted the same day (`netlify-cli sites:delete`, confirmed by the URL returning 404), and
`netlify.toml` removed from the repo alongside it. There is now exactly one deploy target, matching
the seam this project draws everywhere else — one live thing, not a live thing and a decoy.

</details>

## The phone becomes the pointer (2026-08-03)

<details>
<summary><b>Device orientation drives the holo tilt on a phone, scoped to the reveal and the
inspector only.</b> A touchscreen can't hover-track, so until now a phone only ever got the flat,
muted fallback in styles.css — rarity read, but nothing moved.</summary>

`DeviceOrientationEvent` gives a phone the one input a mouse never had: you can physically turn it.
`enableDeviceTilt` (`src/ui/holo.js`) maps `beta`/`gamma` onto the exact same `--px`/`--py`/`--mx`/
`--my` custom properties `enableCardTilt`'s pointermove already feeds, and toggles the same `.lit`
class — so styles.css has one consumer contract regardless of which input drove it, and every
rarity gate, the UR molten palette, and reduced-motion already apply unchanged.

**Scoped to the reveal overlay and the inspector, not the scrolling collection grid.** Both are
full-screen, non-scrolling moments where continuous tilt reads as picking the card up. The grid is
scrolling content shared across many cards; motion tied to phone orientation there would compete
with the scroll and was untested at 40+ cards, so it stays on the existing static fallback.

**A x10 reveal shows several cards at once, and a phone has one orientation** — Ash's call: every
visible card tilts together, broadcasting the same normalized reading to every `.card` under the
root rather than tracking one "focused" card, so a row of cards catches the light together like a
binder page turned in your hands.

**iOS gates this behind a permission prompt**, and the prompt only fires if
`requestPermission()` is called synchronously inside a user gesture — so `enableDeviceTilt` is
invoked from inside `openReveal`/`openInspect` themselves (both are already gesture-triggered:
tapping the pack, tapping a card) rather than once at module load like `enableCardTilt`. The very
first reveal or inspect of a session is what asks; every call after is a no-op (`root.dataset.
deviceTiltBound` guards the listener, a module-level cached promise guards the prompt itself).
Android does not gate this and skips straight to listening. Declining or lacking the sensor falls
back to the existing static finish — never broken, just flat, same as before this shipped.

**A real bug surfaced while wiring this in.** `.card.lit .holo`/`.glare` (full-strength opacity)
and the touch fallback's muted `.card.r-SR .holo` etc. carry EQUAL CSS specificity — three classes
each — so a media query alone does not decide the winner; source order does, and the fallback was
declared later in the file. Device-tilt would have silently rendered at the muted 0.5x/0.4x
strength forever, the exact bug the whole feature exists to fix. The full-strength rule now sits
textually after the fallback, which is what lets `.lit` win once it is actually earned.

**Also found while auditing where tilt was wired up: the reveal screen had NONE, on any platform.**
`enableCardTilt` was only ever called from `collection.js` and `inspect.js`; a desktop pointer
moving across a freshly-pulled card in the reveal did nothing. Added for parity — the reveal now
gets real pointer-tilt on desktop too, not just device-tilt on phones.

**Calibrated, not absolute.** The "neutral" angle is captured from however the phone is being held
the moment tilt activates, and only DEVIATIONS from that baseline drive the effect — an absolute
reading would leave the shine permanently off-center for anyone who doesn't hold the phone at a
textbook-neutral angle. ~18° of deviation reads as the full effect, eased toward each new reading
rather than snapped to raw sensor noise. Untested on real hardware — Ash is asked to report back if
it feels twitchy, too subtle, or inverted; every constant governing it is named and isolated for
exactly that reason.

### Addendum: `beta`/`gamma` was the wrong sensor, not the wrong tuning (2026-08-03, same day)

First-hardware feedback: "automatically swiveling left and right too much." Rebuilt on a different
signal rather than retuned, because the report matches a known property of the original approach
rather than a miscalibrated constant.

**`DeviceOrientationEvent`'s `beta`/`gamma` are EULER ANGLES**, decomposed from the device's raw
rotation — and Euler decomposition is numerically unstable near certain orientations. The unstable
orientation is near-vertical, which is exactly how a phone is held to look at its own screen. A
tiny real tilt there can produce a large, erratic swing in `gamma`. That is almost certainly the
"swiveling": not over-sensitivity to real motion, but instability in the representation itself,
which no amount of retuning `MOTION_MAX_DEG` or `SMOOTHING` would have fixed.

**Rebuilt on `DeviceMotionEvent.rotationRate` — the raw gyroscope**, angular velocity per axis with
no decomposition step and therefore no singularity. The cost of a raw gyro is drift: integrating
velocity into an angle accumulates error with no absolute reference, so a naive integration wanders
off-center forever. Countered with a continuous spring-return term pulling the accumulated angle
back toward zero every frame — self-corrects instead of drifting, and reads as "the card wants to
lie flat" rather than "the tilt is broken."

**Smoothness is now a hard guarantee rather than a tuning target.** The painted value moves toward
the sensor-derived target at a capped rate (`MAX_RATE`, in normalized units/second) — a mathematical
clamp, not an ease that merely tends toward smooth. Whatever the sensor reports, however jerky the
real rotation, the visible motion cannot exceed that rate. This was the explicit ask ("keep the
motion smooth no matter in what jerk acceleration I rotate my phone") and it is now true by
construction, not by hoping the filtering is aggressive enough.

`requestMotionPermission` moved from gating on `DeviceOrientationEvent.requestPermission` to
`DeviceMotionEvent.requestPermission` to match the API actually consumed — iOS treats motion and
orientation as one permission grant, so this changes which API is asked, not what the player sees.

Still untested on real hardware; still fully tunable (`MOTION_MAX_DEG`, `RETURN_RATE`, `MAX_RATE`
are each named and isolated in `holo.js`).

### Addendum: the mapping had to be spelled out as a physical rule (2026-08-03, same day)

Second round of hardware feedback: "very simplistic," with the fix specified directly — tilting
the phone should read as a foil card catching an overhead light, not a generic wobble. **The rule
made explicit: the highlight sits on whichever edge is tilted NEARER the viewer**, independently on
each axis. Tilt the phone's top away from your face and the bottom is now the near edge, so the
highlight moves to the bottom; tilt it toward your face and the highlight moves to the top. Roll
the phone so its left edge dips away and the highlight moves right; roll the other way and it moves
left. Vertical rides on `beta` (rotation around the phone's left-right axis), horizontal on `gamma`
(rotation around its up-down axis) — that much follows from which physical rotation each measures.

What does **not** follow from anything checkable offline is which SIGN of `rotationRate` corresponds
to "top away" versus "top toward" — that is the sensor's own convention, and it is only verifiable
on real hardware. `FLIP_VERTICAL` / `FLIP_HORIZONTAL` isolate that one remaining unknown to a single
multiplier each, independent of one another and of every other constant — flipping one to fix a
backwards axis touches nothing about smoothness, sensitivity, or the other axis.

</details>

## The white glare spot is removed — the rainbow holo carries the finish alone (2026-08-03)

<details>
<summary><b>"That white halo ball moving around" was reading as a distraction, not a finish</b> —
removed everywhere, desktop pointer-hover and phone tilt alike.</summary>

WP3 shipped two coupled layers reading the same pointer/tilt position: `.holo`, a rainbow diagonal
sweep, and `.glare`, a white radial specular spot underneath it. First real-hardware use of the new
phone tilt made the glare specifically read as an unwanted moving ball rather than part of the
card's finish — asked whether that was mobile-specific or a general dislike, Ash's answer was
everywhere: remove it from both platforms, not just the phone tilt.

**`--mx`/`--my` stay.** They were never glare-exclusive — `.holo`'s `background-position` reads them
too, which is what gives the rainbow sweep its directionality as a pointer or a tilted phone moves.
Removing glare meant deleting `--glare-strength` and every rule keyed to `.glare`, not touching the
producer code in `holo.js` (`enableCardTilt`, `enableDeviceTilt`) at all — both still feed the same
`--px`/`--py`/`--mx`/`--my` contract, now with one fewer consumer.

**Touch points:** the `<div class="glare">` markup in `card.js`; `--glare-strength` on all four
rarity bands; `.glare`'s own background rule and UR's warm-tone override; the touch-fallback muted
opacity; the post-fallback full-strength rule under `.lit`; the reduced-motion transition reset.
`.holo` untouched at every one of those sites — same opacity gating, same UR override, same
specificity-order fix from earlier today (the fallback vs. `.lit` tie that let device-tilt render at
full strength once earned).

</details>

## A partial promotion out of the staged exclude: government and big companies go now, the rest waits (2026-08-03)

<details>
<summary><b>The staged institution file was split by RISK rather than read in order</b> — a state
government and a corner-shop-sized nonprofit are not the same exposure, so they stopped sharing a
queue.</summary>

The staged file held 8,430 ids and the review loop assumed one shape: read it, mark what to keep,
promote the remainder. At ~526 reviewable entries (UR/SSR/SR — the bands where recognition lives)
that is days of reading before *anything* moves, and the whole file sits shipping in the meantime.

Ash's call, and it is the correct decomposition: **the queue was never one decision.** "Should the
State of Nevada's channel be a card" and "should a 40K-subscriber trade association be a card" are
different questions with different downsides. A state government, a police department and a school
district have a legal department and a written policy about their marks; so does Netflix. A small
nonprofit has neither and, in Ash's words, "really won't care." Reviewing them in the same pass
means the risky 700 wait on the harmless 7,700.

So 725 ids were promoted from staged into `catalog/excluded.txt` (settled, always applied):

- **278 government/municipal**, matched on name across **every band** — the band restriction that
  makes sense for review makes none for risk. A county sheriff's office has 1K subscribers and a
  legal department; an N-band card is exactly where these live (261 of the 278 are N).
- **447 big companies**, restricted to **UR/SSR/SR** — 526 entries, small enough that every line
  was read rather than pattern-matched. Below SR a "company" is a small business, which is the
  category Ash said to leave alone.

**73 named exceptions were carved out and are still staged**, because they are the cases a keyword
cannot judge: personality-run collectives that merely incorporated (FaZe Clan, The Try Guys,
Corridor Digital/Crew, The Game Theorists, Beta Squad, Achievement Hunter, Hype House) — the exact
Sidemen-shaped error the P31 screen already documents — plus universities, nonprofits, religious
orgs, and political/advocacy media. Those stay for a human pass. **The machine proposed 725; it
did not propose these.**

**What this closes off:** the idea that the staged file is promoted all-or-nothing. It is now a
queue that can be drained by risk class, and `tools/classify-institutions.js` carries the criteria
so the next slice is arguable rather than re-derived. What it does NOT close off: the remaining
~7,705 still ship, deliberately, and still need reading.

**Cost, recorded because it is the real one:** SSR fell 396 → 318 cards. The big-company bucket
lands hardest exactly where recognizable institutional channels cluster, and SSR was already the
binding band at 99.0 lower walls. It is 81.25 lw after a small `--tier legends` sourcing run put 7
back. Thinning the deck for risk and deepening it for play pull in opposite directions in this
band, and that tension is not resolved — it is just now visible.

</details>

## Battles are back in scope, and the v1 stat model is not shippable as written (2026-08-04)

<details>
<summary><b>5v5 auto-resolved battles against a power-matched AI</b> — client-side, no backend, so
locked decision 3 survives untouched. But five of the proposal's seven stats needed data at 67x
the deck's entire quota budget, and its own formulas contradicted its own balance principle.</summary>

CLAUDE.md has listed battles under "currently out of scope" since WP0. This reopens that
deliberately. What it does NOT reopen is **locked decision 3**: the opponent is an AI, the
simulation is pure client-side JavaScript, and hosting stays a static upload at near-zero cost.
Only PvP would need a backend, and PvP is not this.

**The proposal, and the two things wrong with it.** Ash's v1 spec described seven core stats
(Influence, Momentum, Community, Consistency, Virality, Legacy, Stability) feeding six battle
stats, with classes and hidden archetypes.

*One — the data does not exist at this scale.* Momentum, Community, Virality and Stability all
need PER-VIDEO statistics. A shipped card carries three numbers, and recent-video data costs a
`playlistItems.list` call **per channel that cannot be batched**: roughly 33,000 quota units to
rebuild a 23.5k-card deck against a 10,000/day ceiling, versus the **488 units the whole build
costs today**. That is not a tuning problem, it is a 67x one, and it would break the weekly
refresh outright. Those axes are deferred to a Phase 3 that only happens if the loop earns it,
and would be scoped to a subset rather than the whole deck.

*Two — principle 4 contradicted the formulas.* The spec said "rarity should NOT determine battle
strength", then derived `HP = Legacy + Influence` and `Attack = Momentum + Influence`. All three
inputs scale with channel size, so a UR got more health AND more damage, and crit could not
rescue a small card because crit multiplies an attack that is already larger. The stated vision
was unreachable from the stated maths.

**The fix is a split, plus Ash's own idea.** Size buys a **budget**, not a bonus, and the budget
is compressed hard — the largest channel gets about 1.3x the points of the smallest, not 10x.
Where those points go is decided by **shape**, and every shape axis is a ratio or a duration
(views per video against what its size predicts, views per subscriber, uploads per year, years
running) that a channel can score highly on at any size. Then Ash's "comparable strength deck"
does the rest: the AI is matched to the player's own team power, so fairness is a matchmaking
property rather than something the stat model has to achieve alone.

**Three findings that only appeared by measuring against the real 23,539-card deck**, each of
which had already shipped as a bug in an earlier draft of this same work:

- Normalising a card's axes *against each other* does not remove size. Axes that grow with size
  take a growing SHARE, so the deck came out 82% one class with average HP of 686 at N against
  1311 at UR — the exact failure the budget split exists to prevent. Size now touches the budget
  and nothing else.
- `punch` had to become a RESIDUAL against a frozen trend line. Raw views-per-video ran 38 at N
  against 99 at UR; measured against what a channel of that size normally achieves, attack is
  flat across all five bands (107/107/107/103/104). This is also the axis that produces the
  reaction the proposal was written around — a mid-sized creator who punches above their weight.
- The matchmaking rating had to become a **combat rating**, not a weighted sum. Summing budget,
  attack and health produced opponents rated exactly equal that lost 100% of the time; effective
  health times damage output, sharing the same mitigation curve combat uses, is what makes an
  "even match" actually even.

**What we accepted rather than fixed.** A matched fight is decided by team composition, not
luck: individual matchups resolve at 0% or 100% across hundreds of seeds, and widening per-hit
damage variance from 0.12 to 0.50 moved the aggregate only 46.2% -> 49.0%. Independent noise
averages out over the ~25 attacks a 5v5 resolves. That is the auto-battler working as specified —
Ash chose strategy in team-building, and a coin flip per matchup would make team-building
pointless — so fairness is asserted **in aggregate across many teams**, which is what a player
experiences over a session. Making individual fights uncertain would need a structural change
(targeting randomness, fewer heavier hits), and that is a Phase 2 question.

**Closed off:** the seven-stat model as specified, and any battle design that needs per-video
data at deck scale. **Left open:** those same axes for a scoped subset later, per-turn choices
(the engine already returns an event log, so a turn-by-turn resolver would emit the same events),
and Support/Controller classes, which need the deferred axes to mean anything.

</details>

## The battle gets decisions in it (2026-08-05)

<details>
<summary><b>Elements come from <code>topicDetails.topicCategories</code> — the one genuinely new signal, and it is free</b> — A part costs nothing on a call already being made, and it asks what a channel IS rather than what it is called.</summary>

`channels.list` bills **1 quota unit per CALL, not per part**, so `topicDetails` rides along on
the `snippet,statistics` every hydrate already requests at zero cost. It returns Wikipedia URLs
describing what a channel is about — `.../Video_game_culture`, `.../Rock_music` — which
`engine/element.js` turns into a battle element.

It is structurally the right *kind* of signal, and that is why it was taken over the other two
free things on the same call. `brandingSettings.keywords` and `snippet.description` are prose the
creator wrote; reading an element out of them is the name-matching that `looksInstitutional()` is
deliberately kept narrow to avoid. A topic category is a **claim by a third party about what a
thing is**, the same shape as the Wikidata P31 screen the sourcing already runs on.

**Six elements, not the five first drawn.** Gaming to Tech to Knowledge to Music to Comedy to
Lifestyle and back to Gaming, each beating the next. Five is the tidier ring and YouTube's own
taxonomy does not fit it: with the first five spoken for, Food, Fashion, Fitness, Pets and Travel
have nowhere honest to go, and those are not a rounding error on YouTube. Sport is the one genuine
fold — it maps to Gaming, because both are the spectacle of somebody competing, and a seventh
element to hold it would cost more to explain than it buys. The ring stays a simple cycle, so six
does not make a player learn more than five would.

**Unaligned is neutral in both directions, not weak.** The claim is sparse and smaller channels
frequently carry none — precisely the cards the rest of the design works hardest to keep viable.
So a channel with no claim can neither counter nor be countered. That also means the layer
degrades to *nothing* rather than to nonsense on a set built before `topicDetails` was requested,
which is every set that exists today: `tools/battle-balance.js` reports the live deck as 100%
Unaligned, and it is right to.

**Only the derived element ships**, never the URLs it came from — the same rule WP11 states for
classification. What a set carries is the answer, not the evidence.

</details>

<details>
<summary><b>Velocity is a re-expression of axes we already had, and it ships anyway</b> — R-squared 0.77 against the other three; it earns its place on legibility, at a measured cost.</summary>

Subscribers-per-year looks like a free Momentum proxy, and it does separate the channel that
reached 10M in two years from the one that took fifteen. It is **not new information**. With only
`{subs, views, videos, age}` there are exactly three independent ratios plus a duration, and all
four were already spent. The identity is exact in log space:

    log(subs/age) = log(views/videos) + log(videos/age) - log(views/subs)
                  =     punch         +     cadence     -     devotion

Measured on the live 23,539-card deck, velocity regressed on those three gives **R-squared 0.77
with coefficients +0.85 / +1.04 / -1.19** — the predicted +1/+1/-1 signature arriving on its own.
The remaining ~23% is the anchors' differing scales and their clamped tails, not a new signal.

It is kept because **a stat has to be legible as well as informative**, and nothing about "punch
plus cadence minus devotion" is legible while "won its audience fast" is. The cost was measured
rather than hoped: it buys a sixth class and a much flatter class distribution (the largest class
falls from 35% to 26%, and all six are populated).

One specific fear was checked and was wrong: momentum does **not** compound with the glass
cannon. `corr(mom share, atk share) = -0.13`. It runs against defence (-0.71) and health (-0.55),
so a Riser buys its ramp with toughness — a trade a player can see, which is the point.

Recorded because the honest version of this decision is "we added a derived stat for
readability", and the tempting version is "we found a new axis". Only one of those is true.

</details>

<details>
<summary><b>Three combat layers, in this order: elements, then rows, then class verbs</b> — Each is worth less without the one before it, and a fight with nothing to decide is not a fight.</summary>

The first battle engine had exactly two decisions in it — which five cards, and what order — and
measured, that was too thin: a power-matched pair resolved 0%/100% and stayed there when per-hit
variance was widened from 0.12 to 0.50, because a 5v5 runs ~25 attacks and independent noise
averages out however wide each roll is. The fight was decided entirely by the stats.

- **Elements** give a card a reason to be brought against a *specific* enemy, which is what turns
  "pick your five best" into "pick your five best against **that**". The only layer needing new
  data, and that data is free.
- **Rows** (2 front / 3 back) make slot order a placement rather than a soak queue: the back rank
  cannot be reached until the front falls, and pays 15% damage for the cover.
- **Class verbs** — Taunt, Aegis, Backstab, Execute, Snowball, Adaptive. Last, not first, because
  most of them have nothing to bite on without rows: Aegis protects a rank, Backstab bypasses one.

**The AI commits its five before the player picks, and shows them.** That ordering is the whole
reason the wheel is worth having — countering an opponent you cannot see is just picking your best
five again. It costs the matchmaker its usual input (there is no player team yet), so
`opponent.js` matches against the **ceiling of the player's draft** instead: a player who then
builds for the matchup rather than for raw power is choosing to field a lower-rated team and beat
it anyway, which is exactly the outcome the stat design exists to make possible.

</details>

<details>
<summary><b>Speed had to buy something, because it was buying nothing</b> — The Assassin was the largest class in the deck and a card that had spent its whole budget on turn order.</summary>

Speed decided turn order and only turn order. Measured, that made the **Assassin — 34% of the
prototype deck, the single largest class — worthless**: median power 165 against a Carry's 427, a
team of the five best Assassins could reach only 72% of a matched mixed team's rating, and it then
lost 200 fights out of 200. Two of six classes (Assassin and Riser) were never picked by the
matchmaker or by a player's auto-pick, and the rating was *correct* to skip them.

The fix is not to rate them higher — that hands a player a card that under-performs its own
number. HP survives, ATK damages, DEF mitigates, MOM ramps, so **speed acts again**: a chance at a
second action in the round, anchored on the live deck's spread. Assassins went from 0% to viable
at 85% of a control team's rating, and `powerOf` now sees the output so the matchmaker fields
them.

**The bug inside the fix, which is the part worth remembering.** The first threshold sat at SPD 90
— the deck's median. Every stat is budget-scaled, so a giant's 129 and a small card's 98 land
either side of it and the ratio between what they earn explodes from 1.3x to 4.9x. The share of
small cards out-rating the median giant fell from 33.1% to 14.4%, straight through the floor the
balance block allows. **A threshold near the middle of a distribution is a multiplier on whatever
that distribution is sorted by; a threshold in its tail is just a floor.** Moved to 20.

</details>

<details>
<summary><b><code>BUDGET_GAIN</code> 90 to 60, to keep the output where it always was</b> — Every "1 + stat/constant" term in the rating is another size amplifier, and the rating grew from one to three.</summary>

`BUDGET_GAIN` is only the *first* step of the compression. `powerOf` multiplies several
`1 + something/constant` terms together and every one of those somethings is a budget-scaled stat.
With one such term (defence) a gain of 90 put the median giant at 1.16x the median small card.
Momentum and speed added two more, and the same 90 compounded through three amplifiers: the ratio
went to 1.26 and the headline claim — the share of small cards out-rating the median giant —
collapsed from 33.1% to 17.0%, a hair above the 15% the balance block allows.

Measured across the live deck, **60 puts it back**: ratio 1.15, overlap 32.0%, attack flat with
size at 0.95. So the gain came down to hold the OUTPUT constant, not because the design changed
its mind about what a big channel should be worth. **Retune it whenever a new multiplicative term
enters `powerOf`, and retune it against `node tools/battle-balance.js` rather than by argument.**

</details>

<details>
<summary><b>The synthetic test deck is rebuilt from the live deck's quantiles — the third attempt</b> — A fixture that violates the invariant the code is calibrated against tests nothing but the fixture.</summary>

This fixture has now been wrong twice, in opposite directions, and both are the same failure.

Round one drew size and views-per-video from independent cycles, so a 300M-subscriber channel
could average 300 views a video. Because `punch` is de-sized against a trend fitted to the live
deck, that drove every large channel's residual to the floor.

Round two fixed punch by construction and left subscriber counts **log-uniform from 1e3 to 3e8**,
which is nothing like YouTube. The fifth axis exposed it: 42.5% of the deck sat pegged at
devotion = 100, 28.3% at cadence = 100, and one class took 51%. A fitted log-normal was still not
enough — the real deck's counts run down to single digits, and clamping at 1,000 deleted the
bottom two decades, which is exactly the band the headline claim is about (13% against 33%
measured).

Size and devotion now come from the **live deck's own quantiles**, while views-per-video stays on
the engine's trend plus noise because that correlation is real and must be reproduced rather than
sampled away. One further trap: interpolating straight from p99 (13.8M) to the maximum (511M)
invents hundreds of 100M-subscriber channels where the real deck has **nine** — a quantile table
is only as honest as its resolution where the curve bends hardest.

A related sampling fix in the same block: the "even match is fair" test ran 9 teams times 40
seeds and read as a 360-fight sample. It was not. A matched pair resolves near 0% or 100%, so
re-rolling one matchup forty times is a single observation counted forty times; the effective
sample was 9, and it swung between 44% and 71% on which nine teams were drawn. 40 teams times 10
seeds is the same 400 fights and roughly four times the information.

`tools/battle-balance.js` is the companion to all of this: the test asserts "still true", the tool
says "how true, and where", and it runs against the real deck when one is built.

</details>

<details>
<summary><b>Two silent data bugs, both structural rather than careless</b> — <code>parseSet</code> dropped <code>publishedAt</code>, and the opponent builder deduped by object rather than by channel.</summary>

**`data/sets.js` was throwing `publishedAt` away.** `setbuild.js` puts it into every published
record and `normalizeChannel` — written before the field existed — rebuilt the channel without it.
Two of five battle axes are dead without the date, and the failure is silent: the card still
renders, it just quietly falls back. This is the cost of a positive allowlist, which is still the
right shape here for the reason `toCandidate` uses one; the price is that a new field must be
added in two places or it goes nowhere. `element` would have hit the same wall.

**`opponent.js` fielded the same creator twice.** A pool has one entry per channel; a **draft** is
the output of five x10 pulls, and a gacha stacks duplicates by design. The draw-without-replacement
removed the object it picked, which is not the same as removing the channel. Found in the
prototype, where the opposition turned up with "Grim Grove" standing next to "Grim Grove" — which
reads as a bug long before it reads as a strategy.

Also fixed, and less a bug than an omission: the opponent builder picked purely on the smallest
power gap, which looks correct and produces a team of near-clones, because cards of similar rating
share a shape. The first prototype run fielded **five Carries, four of them Gaming** — dull to
fight, trivially countered, and carrying no Titan or Bulwark, so the whole formation layer was
inert on the AI's side. Power matching now decides which cards are *eligible* and variety decides
between them, inside a 12% window, so `matchQuality` still means what it says.

</details>

<details>
<summary><b>The arena prototype runs on an invented deck, not the real one</b> — The real set is gitignored and predates <code>topicDetails</code>, so it would leave the element layer inert.</summary>

`prototype/` is a playable page for the whole loop: five packs, the opposition revealed, a
formation to build, and the event log replayed. It runs on **fictional channels** for two reasons,
and the second decides it.

The real built set is gitignored on purpose — a set file carries real statistics, which can be
neither refreshed inside the 30-day cap nor removed on an opt-out once in git history — so a page
that only works on the machine holding that file is a page nobody else can open. And the real set
predates `topicDetails`, so every card in it is Unaligned, which would leave the single most
important thing the prototype exists to evaluate doing nothing at all. Inventing elements for real
creators to work around that would be fabricating a claim about a real person.

So the channels are invented and their topic claims are **authored rather than faked**: written in
the real `topicCategories` shape and read by the real `elementFromTopics`, so the prototype
exercises the shipping code path rather than a stub. The numbers are shaped like the live deck's
measured quantiles, so the fight feels the way the game will rather than the way a tidy fixture
would. Nothing under `prototype/` is in `build-site.js`'s copy allowlist, so none of it ships.

</details>

## Core Set replaces Series 1 — the staged institution filter is cut whole (2026-08-05)

<details>
<summary><b>All 7,705 staged institution ids promoted to settled — no per-card review</b> — Ash's call: "remove them, they don't add anything, nobody will care."</summary>

`catalog/excluded-institutions.txt` held 7,705 institution ids the Wikidata sweep had screened
out and staged for review since 2026-08-03, deliberately kept off the live deck until someone
read them (see "The candidate DB is a directory boundary"). Ash's instruction closed the review
in one motion rather than working through it: cut the whole list, no exceptions worth carving
out — a government agency, a nonprofit, a record label carries no card anyone would miss.

Promoted whole into `catalog/excluded.txt` (the settled list `assembleSet` always applies),
rather than run through `tools/review-queue.js`'s per-card marking flow. The per-line comments
(name, subscriber count, institution type) were kept as the audit trail, matching every other
entry in the file. `catalog/excluded-institutions.txt` is now empty and stays that way — the
staged/settled split is a reusable mechanism for the *next* bulk curation call, not a one-time
scaffold to delete once used.

Verified zero overlap with the 819 ids already settled (the earlier WP9 partial thinning pass
never touched this list), so the merge added exactly 7,705 new entries with no double-counting.

</details>

<details>
<summary><b>Series 1 → Core Set: the deck stops promising a sequence</b> — one deck, refreshed for freshness, not rotated for variety.</summary>

`tools/build-set.js`'s defaults changed from `--slug series-1 --title "Series 1"` to
`--slug core --title "Core Set"`. Series numbering implied Series 2, Series 3 would follow —
TASKS.md tracked "Roster depth for Series 2" as an open item — and that was never built and,
once the institution cut left a stable everyday-recognizable roster rather than a first draft,
stopped being the plan Ash wants to work toward. "Core Set" is the standard TCG term for
exactly the shape this project settled into: the always-in-print base set, refreshed on the
existing 25-day cadence for freshness, as opposed to a numbered expansion players collect
alongside it.

The rotation machinery this decision retires the LABEL for, not the CODE for: `selectionHash`
and `capBands`' seeded-subset selection in `engine/setbuild.js` stay exactly as built. They are
what a future *printing* would use if the project ever adds one, and the mechanism costs
nothing to leave in place — only the framing that promised a sequel is gone.

</details>

<details>
<summary><b>The rebuild measured: 24,251 → 15,833 cards, no band starved</b> — every band read "full" against the x10 dupe-avoidance floor the cut could have violated.</summary>

`N 9848 · R 3613 · SR 2024 · SSR 317 · UR 31`, from 24,357 hydrated candidates (488 quota
units) after the region exclude and the now-permanent institution cut removed 8,524 total
(curation exclude, all bands combined). `pruneStarvedBands` — the mechanism that exists
precisely to catch a band left too thin to survive a x10 without repeating — dropped nothing,
which is the actual answer to "is the deck still balanced": UNCAPPED builds report every
band's target as whatever survived, so "full" only means something because the prune step
already ran and found nothing to prune.

UR lost the least, proportionally (34 → 31, −8.8%) — institutions rarely clear 50M subscribers
on YouTube in the first place. SSR lost the most (396 → 317, −20.0%), which tracks: the earlier
partial WP9 thinning pass already found that "the big-company bucket lands hardest exactly
where the recognizable institutional channels are," and this finishes that pass rather than
discovering anything new.

</details>

<details>
<summary><b>Unplanned side effect: the rebuild cleared both WP12 battle-system blockers</b> — the live set now carries real dates and real elements, because the hydrate path was already fixed and waiting for a rebuild to run.</summary>

The previous session (see "The battle gets decisions in it") had already wired `CHANNEL_PARTS`
to request `topicDetails` and fixed `setbuild.js`/`data/sets.js` to carry `publishedAt` and
`element` through — but no rebuild had run since, so the *live* set still predated both fields
and every card read Unaligned. This rebuild, run for an unrelated reason (cutting institutions),
used that already-fixed path: `sets/built/core.json` now carries `publishedAt` on 100% of its
15,833 cards and a real element distribution (Music 47.5%, Lifestyle 14.7%, Gaming 10.7%,
Knowledge 10.6%, Comedy 10.5%, Tech 3.6%, Unaligned 2.3%). Sampled and confirmed against a fresh
`channels.list` re-fetch of eight "Music"-tagged cards — genuinely musicians, not a mapping bug;
the deck's musician-heavy skew reflects the Wikidata performer-sweep sourcing method, not the
element classifier.

`tools/battle-balance.js` was hardcoded to `sets/built/series-1.json`; it now reads
`sets/built/index.json`'s manifest instead, so a future rename doesn't require a second edit.

Measured against the real deck with real ages for the first time: every balance THRESHOLD still
passes (largest class 40.6% of five, power ratio 1.15, small-cards-out-rating-median-giant
21.8%, even-match win rate 60.6%), but cadence and devotion now correlate with channel size at
0.42 and 0.35 — both past the tool's own "stopped being size-free" flag at ~0.25, where the
prior synthesized-age measurement read 0.39/0.30. The velocity trend and the punch trend were
both fitted against synthesized ages last session; real ages skew the deck older than assumed
(median maturity 65 vs. the synthetic estimate of 51). Nothing is broken — every design
guarantee the balance block asserts still holds — but the anchors deserve a deliberate refit
against this real data rather than being left on synthesized-age numbers now that real ones
exist. Not done here: this rebuild's purpose was the institution cut, and a stat retune is
exactly the kind of change `balance-tool-methodology` says should be deliberate, not a drive-by.

</details>

## RUBY: a genuine sixth rarity band for 100M+ subscribers (2026-08-07)

<details>
<summary><b>Not a within-UR skew — a real band, decoupled from UR's weight and drawn from the
Ruby Play Button, one tier past the Custom/Red Diamond button UR is already themed on.</b></summary>

Ash: "make UR more rarer? compensate by smaller channels? UR should be more exciting coz
pulling MrBeast should be a YOOOOOO!!! moment." A continuous within-UR skew (weighting selection
by subscriber count above 100M) was prototyped first and set aside: it dilutes as the UR roster
grows, because the whole band still draws a fixed share of pulls no matter how many cards sit in
it, so every individual card's odds — MrBeast's included — shrink as more UR-tier channels get
sourced. The ratio between cards holds; the absolute number keeps drifting.

**Built instead: a real band.** `RARITY_ORDER` gains `RUBY` after `UR`; `rarityFromSubs` gets a
`>= 100_000_000` branch. `bandsFrom`/`pickBand` in `gacha.js` already loop generically over
`RARITY_ORDER`, so the pull engine needed no new logic at all — the two-stage design (band by
fixed weight, then uniform inside it) pays for itself again here.

**The split.** UR's weight drops from 1 to 0.9, RUBY takes the remaining 0.1 — Ash's call,
choosing the gentler of two offered splits (0.9/0.1 over 0.8/0.2) so RUBY reads as a rare bonus
layered on UR rather than an aggressive cut into it. RUBY's stat multiplier is 3.0 against UR's
2.5 — again Ash's call, the smaller of two offered steps, keeping the escalation in line with the
existing 1.0/1.25/1.6/2.0/2.5 ladder's own spacing rather than jumping it.

**100,000,000 subscribers is a real YouTube milestone** — the Ruby Play Button — so this extends
the "rarity tiers ARE the Creator Awards" mapping one step further rather than inventing
something new. Measured against the real Core Set candidate pool: 9 channels currently cross it
(MrBeast, PewDiePie, Cocomelon, Vlad and Niki, Like Nastya, Kids Diana Show, Stokes Twins,
BLACKPINK, Alan's Universe) against 22 that stay in UR once the split lands — the old flat UR
band held 31.

**A real visual escalation, not a recolor.** TASKS.md flagged this explicitly ("needs an
escalation, not a recolor") after the earlier UR-skew work shipped nothing visible. RUBY's frame
tokens (`.r-RUBY`) run crimson-into-magenta rather than UR's amber-into-crimson — a different hue
skew, not just a brighter version of the same one — and darker at the low end. The reveal
overlay's top-tier finale (ignition ring, discharge bloom, breathing aura with shed motes) was
UR-exclusive in `reveal.js`; it now gates on a `TOP_TIER` set containing both UR and RUBY, with
RUBY's own colours and slightly longer timings supplied per-tier in `styles.css` rather than
duplicating the JS. Card tilt (`--tilt-max`), holo strength, and the ambient ember animation
(`ruby-ember`, mirroring `ur-ember`) all get their own RUBY values, escalated past UR's.

**The coupon-collector math breaks down at this depth, and that's expected, not a bug.**
`setbuild.js`'s band-depth guard (`minCardsForBand`, `bandTargets`) needed no code changes — both
already iterate `RARITY_ORDER` generically — but one existing test asserting all bands reach
roughly equal completion time under water-filling had to exclude RUBY: water-filling can only
raise a band's completion time by adding cards to it (never lower it), and RUBY's real-world
population (9 known 100M+ channels, worldwide) puts its 2-card floor's completion time at ~3000
pulls against the other bands' ~2100 at a 400-card budget — no amount of budget can close that
gap when the ceiling on RUBY's roster is reality, not the allocator. UR's own tolerance in the
same test widened from 10% to 15%, since a 6th band thinning the shared weight table moved it
from a comfortable margin to a real, if small, outlier too.

**Not yet deployed.** Local rebuild of the Core Set (`tools/build-set.js --uncapped`) confirms
the split holds against real data: UR 22 / RUBY 9, both bands full and healthy, 15,832 cards
total (one fewer than the prior 15,833 — a channel vanished between hydration passes, unrelated
to this change). 425 tests pass. This is app code (`src/engine/`, `src/ui/`), not set data, so it
ships via `tools/build-site.js` + `wrangler pages deploy` independently of the Core Set data
deploy — pending Ash's go-ahead, and pending an actual look at the reveal animation and the
RUBY card in a browser, which nobody has done yet.

</details>

## The award names were backwards — Ruby is 50M, Red Diamond is 100M (2026-08-07)

<details>
<summary><b>UR's display name and RUBY's display name were swapped: the real Ruby Play Button is
YouTube's 50M-subscriber award, not the 100M one this project just built.</b></summary>

Caught while looking at the freshly-built top tier in a browser: Ash asked whether the new
100M band had to be called "Ruby" and whether something slicker existed, like a "Black Diamond."
Before inventing a new name, a quick check of what YouTube actually calls these awards turned up
the real answer — the project already had the right *concept* ("rarity tiers ARE the Creator
Awards") but the wrong assignment.

**The real thresholds, confirmed by search:** the **Ruby Play Button is 50 million subscribers**
— PewDiePie nicknamed his custom trophy "Ruby" on camera when he received it in December 2016,
and the name stuck as YouTube's own term for it. The **Red Diamond Play Button — a dark red
crystal set in silver-plated metal — is 100 million subscribers**, first awarded, again to
PewDiePie, in 2019. This project's `UR` band (50M) was shipped calling itself "Red Diamond" since
WP3, months before this session; the new `RUBY` band (100M) built earlier today inherited the
same swap by cargo-culting the wrong half of the pair.

**Fixed as a display-string-only change**, deliberately: `card.js`'s `TIER_NAME` map now reads
`UR: 'Ruby Play Button'` and `RUBY: 'Red Diamond Play Button'`. The internal engine keys
(`RARITY_ORDER`'s `UR`/`RUBY`, the CSS class names `.r-UR`/`.r-RUBY`, `.glow-UR`/`.glow-RUBY`)
are untouched — renaming those would touch every saved player collection (rarity is stored as
this literal string in localStorage), every test, and the whole reveal/CSS surface for no
functional gain, since the keys are internal band identifiers, not player-facing award names.
Only the full name shown under the rarity-badge chip changed; the short badge code (still
literally "UR" / "RUBY") is unaffected.

**RUBY's whole palette got re-picked to match**, not just the label. The tier was originally
built pink-magenta ("a hot pink to red gradient" reading), which fit a name it no longer carries.
Red Diamond, per the real trophy, is a dark red crystal — so every RUBY-tier surface
(`.r-RUBY` tokens, the reveal overlay's ignition/discharge/aura, the card's holo sheen and ember
flicker) moved from bright pink/magenta toward a darker, less saturated, near-black-red palette:
`--t-lo` went from `#6b0019` to `#15000a`, `--t-mid` from a crimson-pink `#ff2358` to a true
blood-red `#8c0f24`, and the reveal stars shifted from a warm pink tint to a cooler diamond-white
with a red cast — differentiating it from UR/Ruby's existing warm amber-red identity by hue AND
weight, not just by being "more pink." The ember keyframe was renamed `ur-ember`/`red-diamond-
ember` to match. 425 tests pass unchanged — none of this touched engine logic, weights, or mults.

</details>

## Two windows fight by passing a code, because they share nothing else (2026-08-08)

The arena moved out of `prototype/` and into the app: a Battle button on the collection
panel, a team builder over your own cards, and three ways to fight — a matched AI, a
challenge you hand out, and a challenge you accept. The AI path is the one that always
works; the other two are the reason this entry exists.

**The problem is not networking, it is that there is nothing to network with.** The ask was
a 1v1 between a normal window and an incognito window on the same machine. Those two are
**storage-partitioned by design** — localStorage, IndexedDB, cookies, SharedWorker and
BroadcastChannel are all isolated between them, and that isolation is the entire point of a
private window. There is no same-machine shortcut hiding in the platform. Locked decision 3
(client-side only, static host) rules out the obvious answer of a room on a server, and it
also quietly rules out WebRTC: a data channel needs signalling, and a signalling service is
the backend again wearing a hat.

So the channel between the two windows is **the player**. They copy a string out of one and
paste it into the other.

**What makes that a real fight rather than two simulations** is a property the engine already
had, from a decision taken for a completely different reason: `engine/battle.js` takes its
randomness as an injected `rng` and `engine/battle-stats.js` takes its clock as an injected
`now`, both so the balance tests could assert distributions over thousands of seeded runs.
Feed two windows the same teams, the same seed and the same `now` and they do not merely
agree about who won — they replay the identical fight, hit for hit, crit for crit. Verified
against the live 15,831-card deck: two independently decoded sides produced byte-identical
53-attack logs.

That is why all three travel in the code, and why `now` is **pinned rather than read locally
on arrival**. Channel age drives three of the five battle axes (maturity directly, cadence
and velocity through their per-year denominators), so two windows opening the same code a
day apart would otherwise compute two different fights from the same five cards — a bug that
would surface as "we saw different winners" long after anyone could trace it.

**The reply carries inputs, not a verdict.** A result code holds the defender's five cards
and the challenger's window re-resolves the whole fight from them. A claimed outcome would
have to be taken on trust; a recomputed one cannot be wrong. A short fingerprint of the
challenger's team rides along and is checked on the way back, so a reply to somebody else's
challenge — or a code mangled in transit — is caught and named instead of being silently
fought as a different battle.

**Who commits first is the asymmetry the element wheel needs.** The challenger locks their
five *and the seed* before they can know what they are up against; the defender pastes the
code, sees the enemy line-up with matchup badges, and builds against it. Countering an
opponent you cannot see is just picking your best five again, so somebody has to go first
and the code is what makes "first" mean something. Trade roles for the rematch and the
advantage trades with it.

**What this closes off:**

- **No lobby, no matchmaking, no presence.** There is no server to hold a room, so there is
  no "waiting for opponent" state to build and no way to be matched with a stranger.
- **No live/turn-based play.** The fight is auto-resolved and handed over in one round trip.
  A turn-by-turn mode would need a message per turn, which is where a real transport starts
  being worth its cost.
- **No anti-cheat, and the code says so out loud.** A player can hand-edit their own five to
  a billion subscribers before encoding. Detecting that needs a secret, and a secret needs a
  server. There is no ladder and nothing to win, so the honest move was to write the
  limitation into `engine/challenge.js` rather than build ceremony that implies otherwise.
- **The format is versioned and frozen.** Channels pack as positional arrays; appending a
  field is safe, reordering is not, and `CODE_VERSION` makes a mismatch a sentence a player
  can act on rather than a corrupt decode.

**One storage change came with it, and it was not cosmetic.** `engine/collection.js` was
dropping `publishedAt` and `element` from saved cards, so every card a player actually owned
fought as a dateless Unaligned unit — all matchups neutral, the entire element layer inert
for exactly the cards the arena is built on. Both fields joined the stored allowlist without
a `COLLECTION_VERSION` bump: adding optional fields is backward-compatible, bumping would
discard every existing collection to gain two of them, and `reconcileCollection` already
refreshes owned cards from the set on load — so old saves heal themselves on the next visit
with no migration ever written.

## The battle had no decision in it, and it was not the reason we thought (2026-08-08)

The complaint was "picking the highest-subscriber cards wins, so there is nothing to
decide." Measured against the live 15,831-card deck, the first half of that is false and
the second half is true — which changed what got fixed.

**Picking by subscriber count was already a bad strategy.** Head-to-head over 120 drawn
collections, a team of the five biggest channels lost to a team picked on views-per-video
70.8% of the time, and to a raw-rating pick 90%. That part of the stat design — size buys a
compressed budget, shape decides where it goes — was working as written.

**What was actually broken: `powerOf` is an accurate predictor, and an accurate predictor
is a solved game.** "Take the five highest-rated cards" beat every other approach 87-100%
of the time, so the strategy graph was a strict ladder rather than anything with a choice
in it — and the optimal play was a button, because Auto-pick computes exactly that number.

Three fixes, and the order matters because the first two are corrections and only the third
is a design addition.

### 1. Two of the five axes were never de-sized

`punch` and `velocity` are measured as residuals against an Influence trend, so what
survives is "punches above its weight" rather than "big". `devotion` and `cadence` never
got that treatment, and it showed: correlation with size ran 0.350 and 0.420 against the
~0.25 the balance tool flags, while the de-sized pair sat at 0.004 and -0.014. Those two
feed DEF and SPD, so **every big channel was structurally tankier and faster than every
small one, on every card, forever.** That is the exact "bigger channel is tankier AND hits
harder" failure the budget split exists to prevent, arriving through the two axes nobody
had applied the fix to. Both are now residuals against fitted trends, frozen as constants
for the same reason PUNCH_TREND is. Measured after: -0.010 and 0.027.

### 2. The five stats were not worth the same at equal budget

Shape is zero-sum — a card spends one budget across five stats — so the design only works
if a point buys comparable value wherever it goes. Five specialists built from an identical
budget and fought round-robin came out **HP 83.9% · ATK 82.7% · DEF 39.7% · SPD 20.0% ·
MOM 4.7%**. A point spent on momentum bought a seventeenth of what it bought on health.

The reason is structural and worth stating, because it will come back: **SPD and MOM do not
deal damage, they multiply an attack the card already has** — and under a zero-sum budget,
spending on them means having no attack left to multiply. The momentum specialist ramped to
2.2x on an attack of 81 while the attack specialist simply carried 253, and the ramp was
capped at +120%, so the one card built entirely around ramping hit its ceiling exactly where
the trade should have started paying. MOM's scale and the cap both rose; DEF rose less.

Speed is **partially** fixed and deliberately recorded as such: its payoff saturates by
construction, because `extraActionChance` is a probability and even a perfect roll buys one
extra swing. Two swings of a budget attack still lose to one swing of a real one. Closing
that needs a second thing for speed to buy — evasion, or a genuine multi-action roll — not
another constant.

### 3. The formation bonus — the part that is new design

A bonus for fielding four (+2.5%) or five (+5%) distinct classes, applied in `makeTeam`.

It has to be a property of the TEAM, because that is the only kind of thing `powerOf`
cannot see — `powerOf` rates cards. The consequence is the point: Auto-pick, greedy on card
rating, can no longer see the bonus, so it stops being optimal and becomes a decent baseline
a thinking player beats. Rewarding diversity rather than punishing duplicates was Ash's
call; the two are mathematically equivalent and only one of them is a sentence the build
screen can state.

**The number is smaller than it looks, and the first pass got it wrong by a factor of two.**
A lift on every stat raises both sides of `powerOf = sqrt(effective health x damage)`, so a
nominal +14% is roughly +30% of fighting strength — measured, the diverse team then beat the
raw-power team 89% of the time, which is the same dominance problem wearing the other hat.

### What it cost, and the two things that broke on the way

De-sizing the axes made the remaining size coupling — the **budget** — visible, and the
wider momentum cap added a new multiplicative term to `powerOf`. Together those dropped
"small cards out-rating the median giant" from 21.8% to **2.3%**, straight through the 15%
floor, and two tests failed. `BUDGET_GAIN`'s own comment says to retune it whenever a
multiplicative term enters `powerOf`, against the tool rather than by argument: 60 -> 25
puts it back at 22.1%.

The second break was subtler and is a real bug this introduced. The AI picks for variety, so
it reliably EARNS the formation bonus — but it was aiming at a target computed without it,
and so overshot by the whole size of the bonus on nearly every build. The even-match win
rate fell from 45% to ~30%: the matchmaker was promising a fair fight and delivering a
6%-stronger opponent every time. `matchOpponent` now builds twice, using the first team as a
probe for the lift it earns and aiming the second at `target / lift`.

### Measured, before and after

| | before | after |
|---|---|---|
| a small channel out-rates one 10x bigger | 32.1% | 39.2% |
| views-per-video pick beats biggest-subscriber pick | 70.8% | 82.4% |
| corr(subscribers, combat rating) | 0.252 | 0.231 |
| diverse team vs raw-rating team | — (rating dominant at 87-100%) | ~52% |
| a Riser earns its slot in a diverse team | — | 86.2% |
| small cards out-rating the median giant | 21.8% | 22.1% |

**What is closed off:** no new data was needed and none was fetched. "Recent viewership"
remains unavailable — per-video history is ~33,000 quota units per rebuild against the 488
the whole build costs — but the two archetypes it would have bought already exist as `punch`
and `velocity`, so this was a pricing problem, not a sourcing one. Magic Search is untouched.

**What is still open:** a team of five max-velocity cards still loses ~99% of the time. That
is now partly BY DESIGN — it is a stack, and stacks collect no formation bonus — but the
honest reading is that momentum remains the weakest place to spend a budget even after the
repricing, for the multiplier-on-a-sacrificed-base reason above. The card is viable in a
diverse team (86.2%); the mono-strategy is not. `tools/battle-balance.js` now prints a
STRATEGY table so neither this nor a future return of the dominant-strategy problem can go
unnoticed again — every card-level figure in that tool was passing while the game was solved.

**Trimmed the same day: the Assassin opener.** A x1.25 on round one, removed after a lever
audit. It fired on 4.9% of 78,823 measured attacks while its text rode on the face of every
Assassin — 24.7% of the deck. A quarter of all cards carried a sentence describing something
a player would essentially never observe, and a rule you cannot observe is pure cognitive
cost. Backstab (20.7% of attacks) is the class identity and stays.

**Two things the same audit said to cut, and measurement said to keep.** Aegis looked dead at
0.3% of attacks — but that figure came from rating-picked teams, which rarely contain a
Bulwark at all. Re-measured on the diverse teams the formation bonus now rewards, it fires on
8.4%: 74% of those teams field a Bulwark and it lands in the front rank 74% of the time. It is
not dead, it is the payoff for the strategy this whole entry exists to create.

The back-rank attack tax was dismissed as "a constant, not a decision" because it applies to
73% of attacks. That was a shallow read of a high number: it applies to every back-rank
attacker, and WHICH cards stand in the back is the decision. Remove it and the back rank
becomes strictly better than the front — safe AND undiminished — which deletes the formation
trade rather than simplifying it. Both kept.

The general lesson, since it has now happened twice in one session: a lever's FIRING RATE is
not its importance. A low rate can mean the strategy that triggers it is rare rather than that
the lever is dead, and a high rate can mean it is attached to something the player chooses
rather than that it is a constant. Measure the lever in the situation it was designed for.

## Locked decision 3 is amended, not overturned: one endpoint that holds two booleans (2026-08-08)

Ash's call, made explicitly, on a decision marked "do not reopen". What follows is the
shape of the amendment and — more usefully — why the line lands exactly where it does.

**The want:** an "opponent is ready" light, so two players press start and watch the same
fight at the same moment instead of one watching minutes before the other. That is a live
signal between two devices, and the pasted battle codes cannot carry it — they are one-shot
copy-pastes, not a connection.

**What was rejected on the way.** A third code exchange (a tiny "ready" token sent back)
works with no server at all, but pays for a light with a third round of copy-paste, which is
more friction than the light removes. WebRTC using the existing codes as the signalling
channel is genuinely elegant — decision 3 survives intact — but it grows the codes from
~1,000 to ~3,500 characters and fails behind symmetric NAT without a paid TURN relay, and a
ready light that works most of the time is worse than none.

**Where the line is, and why there.** `functions/api/ready/[room].js` receives a room hash
and the letter `a` or `b`. It is never sent a card, a channel, a statistic, a name, a
collection or a battle code. That boundary is not squeamishness, it is the whole reason this
is affordable: **a server that is never sent a statistic has no statistic to store**, and
stored statistics are what carry YouTube's 30-day cap and the opt-out obligation that this
project's entire architecture — gitignored sets, deploy-time rebuilds, the 25-day cadence —
exists to satisfy. Cross that line and every one of those problems arrives at once, which is
what the "full relay" option (server passes the actual codes, no copy-paste at all) would
have meant. It was the better UX and it was declined for exactly this reason.

**The room id costs nothing to agree on**, which is what makes presence possible with no
lobby: both windows already hold the challenger's five and the seed, so both derive
`fingerprint(teamA)+seed` independently, with no round trip. It identifies a match without
describing one, and being unguessable without the challenge code it doubles as the only
access control the endpoint needs.

**It stays optional, and that is a hard requirement rather than defensive habit.** Missing KV
binding, request failure, offline, blocked by an extension — every path resolves to
`enabled:false` and the arena falls back to the manual countdown it shipped with. The game
worked without a server for its whole life and still has to; a fight that cannot start
because a service is down is a broken game. The endpoint answers 200 with `enabled:false`
rather than 500 for the same reason: the client treats it as "no presence today" and needs no
error handling at all.

**Two booleans, ten minutes, and a known race.** KV offers no compare-and-set, so two players
readying in the same instant can each write a state omitting the other. It self-heals on the
next poll; the cost is one extra poll interval. A lock needs a Durable Object, which is a paid
plan and a great deal of machinery to shave a second off a ready check. Recorded as a chosen
trade rather than left as a lurking surprise.

**What the promises cost.** The privacy policy said "Creator Gacha has no server" and "we do
not know that you visited", in several places, and those stopped being unqualified the moment
any request reached us. They are now qualified rather than quietly left standing — the page
names the endpoint, what it receives, what it cannot deduce, and that single-player battles
never touch it. The claims that actually mattered survive literally true: the collection is
still local-only and still never transmitted, the API key still never leaves the page, and
there are still no accounts, cookies or analytics.

**What is NOT covered by this amendment**, and needs its own decision if ever wanted:
relaying battle codes, lobbies, matchmaking, accounts, persistence of anything, or any
endpoint that receives channel data. The amendment is presence and nothing else.

## The presence entry above is out of date, and the correction is the point (2026-08-09)

The section above says the endpoint "is never sent a card, a channel, a statistic, a name, a
collection or a battle code". That was true of the first cut and stopped being true the same
day, when the defender's reply code had to reach the challenger without a second copy-paste.
`CLAUDE.md` and `privacy.html` were both updated; this file was not, so for a day the
project's decision log contradicted its own running code.

Left standing rather than edited away, because the reasoning above is still the reasoning —
what changed is one fact inside it. **What the endpoint holds is a room id, two booleans, a
timestamp and one reply code, for ten minutes.** What it still never receives is an account,
an identity, or a collection beyond the five cards someone chose to field. The 30-day cap
objection that originally ruled the code out was simply wrong: the cap is a MAXIMUM AGE and
ten minutes is comfortably inside it.

## Readiness is something a person does, not something a server infers (2026-08-09)

The bug: two players sat in a lobby, neither had pressed Ready, and both screens reported the
defender as ready — the challenger saw "they are ready", the defender saw "you are ready".

Nothing was corrupt. The server had one op, `ready`, and it was the only way to upload a
team, so committing a team flipped a readiness flag as a side effect. The defender was marked
ready on leaving the builder, before the lobby had rendered. Worse than the wrong lamp: the
challenger pressing Ready was then enough to stamp `bothAt` and start a fight the defender
had never agreed to.

**Split into two ops: `team` (here are my five) and `ready` (I am ready to watch).** The
endpoint header had asserted that "pressing Ready IS committing the team", and that was true
of the original copy-paste flow — it stopped being true the moment the lobby grew a Ready
button of its own, and nobody reconciled the two ideas.

`ready` now also gates BOTH sides on a code existing, where it used to gate only the
challenger. That was half a rule: a defender marked ready with no code on the server is a
room that is ready and unfightable. And `team` now sets `accepted` too, because committing a
team implies having accepted — which heals a lost `accept` instead of leaving the challenger
watching a room that will never flip.

## A dropped request is not a missing lobby (2026-08-09)

Challenging from a phone did not work, and the shape of the failure is worth keeping.

`presence.js` returned one value, `OFFLINE`, for every non-answer: a five-second timeout, an
aborted fetch, a dead connection, and the server saying "no KV namespace bound". The
challenger's wait loop read that as settled and **stopped polling permanently**.

Only the challenger has to leave the app — to paste their code into a chat. Mobile browsers
freeze a backgrounded tab and tear down its in-flight requests, so switching to WhatsApp
killed the poll, the loop concluded there was no lobby anywhere, and the acceptance arrived
at a screen that had stopped listening. Phone-as-defender never hit it: they receive the code
elsewhere and switch INTO the browser. Desktop-as-challenger never hit it: desktop tabs are
not frozen.

**Two outcomes, not one.** `off` is settled — ask again and the answer is the same, so fall
back for good. `error` is one request that did not complete, which says nothing about whether
a lobby exists, so keep trying. One field of difference, and the difference is whether the
caller gives up.

Both poll loops now survive transient failure, both wake immediately on `visibilitychange`
rather than waiting out a timer mobile has throttled to once a minute, and `Ready` retries
once — an unreported Ready is worse than a slow one, because the other side waits forever on
a player who believes they already pressed.

## Nobody is zero at anything, and crit belongs on punch (2026-08-09)

Two changes to the derivation, both found by playing rather than by reading.

**The floor.** The four residual axes clamped to `[0, 100]`, and an axis that fell off the
bottom scored a literal 0 — which is a 0% share, which is a stat of 1. Measured: **3.7% of
the deck sat at punch 0**, roughly 590 real channels walking into a fight with an attack of
ONE. They could not win, and no amount of speed or crit rescued them, because both multiply
an attack that has to already exist. Those are real creators — typically the daily grinder
whose views-per-video is modest precisely BECAUSE they upload constantly. A residual measured
against a trend means *below average*, not *absent*, so the axes now floor at 12. Small cards
out-rating the median giant went 22.1% → 29.5%.

**Crit moved from cadence to punch.** It rode on the SPD share, on the theory that a spiky,
high-cadence profile should occasionally spike. But cadence measures how OFTEN someone posts,
and that is not what a critical hit is. A critical hit is a video that lands far above this
channel's normal — the views-per-upload residual. Now `0.05 + 0.95 × punch + 0.20 × spd`,
capped at 45%. Speed keeps a share, because stripping crit from Assassins entirely leaves
that class holding only the bonus the balance pass already recorded as saturating.

**The limit, stated rather than implied:** this cannot see variance. "A few bangers and a lot
of duds" and "uniformly strong uploads" produce identical views-per-video, and separating
them needs per-video statistics costing ~67x the entire build's quota. It is a proxy for
spikiness, not a measurement of it.

**The knobs are now exported.** `STAT_TUNING` and `BATTLE_TUNING` are frozen objects listing
every tunable, and `tools/battle-balance.js` prints them live rather than keeping a copy — a
tuning report whose numbers have drifted from the engine is a confident lie, consulted
precisely when someone is about to change one of them. The tool also grew a per-class table,
because "median ATK 110" describes a card that does not exist; tuning happens per archetype.
It immediately showed the open problem: **Assassin rates 249 against Carry's 462.**

## The card was lying about itself, and the battle engine was fine (2026-08-09)

Ash asked for the game to stop being "100% deterministic by just seeing higher subs count =
better card every single time" — and, in the same breath, for the opposite not to be true
either, because a rare pull that buys nothing punishes good luck. The instruction that framed
the whole pass was **"do not balance things too hard and make the game sterile."**

The obvious reading is that this is a battle-balance problem. It is not, and the measurement
that settles it is the first thing worth recording.

**THERE WERE TWO STAT SYSTEMS AND THEY DISAGREED BY 4.4x.**

| | corr with log(subs) | N → RUBY median | can an N out-do a UR? |
|---|---|---|---|
| card face (`core.statsFrom`) | **0.897** | **5.22x** | **0.0%** — never, in 15,831 cards |
| battle (`battle-stats.js`) | 0.187 | 1.19x | 19% clear the median UR/RUBY |

The card face computed `log10(views) × 120 × RARITY[rarity].mult`, the multiplier running 1.0
at N to 3.0 at RUBY — so rarity was counted twice, once in the band and again in the number
printed beside it. The battle engine, which decides every fight, had never agreed with any of
it. The game PLAYED as a contest of shape and matchup and READ as "whoever has more subscribers
wins", and the card face is the screen a player looks at constantly. **The complaint was about
the card, not the combat.**

So there is one derivation now. `toCard` returns `{ channel, rarity }` and nothing else, the
card face asks `battle-stats.js` for its two numbers, and `RARITY.mult` is deleted rather than
left dangling — `battle-stats.js` already held the opposite position in writing, that rarity
buys a compressed budget and is otherwise only "how hard this was to pull". Measured after:
the printed ATK correlates with subscriber count at **0.042**, and an N out-stats a UR/RUBY on
the face **53.7%** of the time.

**THE BATTLE ENGINE WAS LEFT ALONE, AND THAT IS THE FINDING, NOT THE OMISSION.**

A validated replica of the derivation was built (exact match against the engine on every
sampled card), 280+ parameter combinations were grid-searched, and the survivors were run
through real fights. Every direction made something Ash asked for worse:

- **Raising `BUDGET_GAIN` so rarity "counts for more" destroys the thing worth protecting.**
  Today a top-decile N beats the median UR/RUBY and 19% of N cards clear it, while 0% clear
  the best one — "your best commons beat a mediocre legendary, nothing beats the best one",
  which is exactly the shape asked for. At gain 45 that 19% becomes 4.4% and the top-decile N
  stops clearing it at all.
- **Evasion, a multi-action speed roll, and rescaling all re-amplify SIZE.** Every stat is
  budget-scaled and the budget is the only thing size buys, so any mechanic keyed to an
  absolute stat threshold quietly re-couples power to subscriber count. Small-cards-out-rating-
  the-median-giant fell 29% → 8% on evasion alone. This is the third time this trap has been
  hit (see the `SPD_FLOOR` note) and it should be assumed of the next such idea too.
- **Rescaling also shortens fights to 3-4 rounds and cuts card-to-card variety from 2.83x to
  1.76x** — measurably the sterility the instruction warned against.

**THE CLASS PANIC WAS A MEASUREMENT ARTIFACT, AND THE TOOL NOW SAYS SO.** The per-class table
reports Assassin at 249 against Carry's 462, and an all-one-class round robin looks worse still
— Assassin wins 6.3% of those, a 12.9x spread. Both numbers are real and neither is the
question, because **nobody fields five Assassins.** Five low-attack cards cannot between them
kill anything; one Assassin behind four normal cards walks past the wall and removes the
enemy's biggest hitter. Measured properly — hold four slots, drop in a rating-matched card of
each class — the spread is **47%-60%, twelve and a half points**, and an Assassin contributes
more than a Titan. `tools/battle-balance.js` grew a MARGINAL VALUE section that measures this,
and the rating spread's warning now points at it, because acting on either of the other two
figures would have cost the size-neutrality the whole stat design exists to protect.

**Music is 47.6% of the element wheel, and that is sourcing, not mapping.** A 500-channel
hydrate (10 quota units) says 50.6% of the deck carries a `music` topic and 234 of 246 Music
cards carry a specific GENRE slug — `pop_music`, `rock_music`, `independent_music` — not the
bare tag. YouTube genuinely thinks half this deck is musicians, which follows from sourcing
notable people out of Wikidata. `element.js` is reading it correctly. Left alone: a seventh
element was already rejected on its own merits, and re-mapping cannot fix a population.

What did not change: `BUDGET_GAIN`, `SCALE`, `AXIS_FLOOR`, the crit terms, the momentum cap,
the element table, and every combat constant. The balance report is byte-identical before and
after, which is the intended result of a change that was only ever about what the card says.

---

## The cold matchmaker was nine teams and a blind rating (2026-08-15)

TASKS.md had carried "the matchmaker runs cold — 37.2% even-match win rate ... likely cheap:
the bias is probably in `aimedBuild` or the formation correction" as the second-highest open
item. Both halves of that were wrong, and they were wrong in ways worth separating, because
one is a measurement failure and the other is the recurring trap in new clothes.

**THE NUMBER WAS NINE SAMPLES WEARING A BIG ONE.** `battle-balance.js` spent its fight budget
as `fights / 40` player teams, each re-fought 40 times under different rng. Those 40 re-rolls
vary the damage variance and nothing else — they sharpen the estimate of how *that* matchup
resolves while saying nothing new about matchmaking in general. So "37.2% over 360 fights" was
**9 matchups**, and measured per-matchup they ran from 17.5% to 85% purely on which nine the
stride happened to draw. The player teams were also five *consecutive* cards from a deck
sorted by channel id, which is not a random team.

Fixed by spending the same budget the other way round: `fights / 6` distinct matchups, drawn
from a seeded rng so the file stays reproducible, six rolls each. The tool now prints a
confidence interval computed on **matchups**, because that is the sample size that exists.
Re-measured: **33.2% +/- 4.1** over 500 matchups. The old figure was not far off — but nothing
about the old method could have told anyone that, and "37.2%" and "37.2% +/- 14" are different
claims.

**THE AIM WAS NEVER OFF.** Mean AI power drift against the player's team is **+1.7%**;
`aimedBuild`'s two-pass lift correction does exactly what its comment says. Chasing it would
have been a session spent tuning a component that was already correct.

**THE CAUSE IS A RATING THAT CANNOT SEE THE MECHANIC IT IS PRICING.** `pickForSlot` scores
class variety, so the AI reliably fields **4.36** distinct classes; a random player team fields
**3.00**. `aimedBuild` corrects the AI's *power* for the formation lift it earns — but the lift
is 2.5–5% of stats, and that is not what diversity is worth in a fight. Diversity also buys
class *verbs*: an Aegis to shelter behind, a Titan to soak a rank, a Backstab that reaches past
both. `powerOf` cannot see a verb. Bucketed by the gap, the whole effect is legible:

| player classes − AI classes | matchups | player wins |
|---|---|---|
| −3 | 54 | 22.2% |
| −2 | 186 | 25.6% |
| −1 | 160 | 39.5% |
| **0** | **78** | **47.0%** |

**Level on diversity, the fight is fair.** Each spare class the AI holds is worth roughly ten
points of win rate.

This is **the recurring trap in new clothes** — CLAUDE.md states it as "any mechanic keyed to
an ABSOLUTE stat threshold silently re-couples power to subscriber count", and the general
shape is *a rating used to price a team that depends on something the rating cannot observe*.
Worth generalising the warning, because it has now bitten in two different layers.

**WHAT WAS DELIBERATELY NOT CHANGED.** Making `matchOpponent` mirror the player's class count
would close the gap immediately, and it is not obviously right: the AI is playing the exact
strategy the formation layer was built to reward, and `battle.js` says in writing that
Auto-pick "stops being the optimal play and becomes a decent baseline a thinking player beats.
That is the whole point." An AI that deliberately builds worse to keep the rating honest is a
different game. That call is Ash's and stays open.

What shipped instead is the honest half. The team builder compares your class count against
the enemy's once five cards are down, because the ratings above it read "even" while a 3-vs-5
matchup is about 25% — and the arena stating a fair fight while delivering a lopsided one is
the same defect as a checklist that disagrees with the deploy log. Same argument as the
element wheel: information pointing at the OPPONENT is what turns picking into deciding.

## The set format stopped restating its own defaults (2026-08-15)

`sets/built/core.json` is 7.29 MB and every player parses it before their first pull. Two
fields were measured as pure redundancy across all 15,831 cards:

- **`hiddenSubscriberCount` was `false` on every single one** — 0.46 MB spent stating a
  default. Now written only when true, exactly as `subscriberCount` is written only when
  present. No reader changed: `data/sets.js` already coerced with `Boolean()`, so absence
  read as false before this and still does.
- **`avatarUrl` was 28.4% of the file and mostly template.** The host `https://yt3.ggpht.com/`
  and the size spec `=s800-c-k-c0x00ffffff-no-rj` — the one the live adapter asks for so a
  face is not soft at card size — were byte-identical on **15,828 of 15,831**. Only the
  variable middle ships now, under an `avatar` key.

A third followed from measuring the first two: **the file was pretty-printed with a 2-space
indent**, which is 1.43 MB of whitespace in a 15,831-record generated file that no human ever
opens. `sets/built/` is gitignored, so there was not even a diff to keep legible. Written
compact now; `index.json`, which people do read, stays indented.

Together **7.29 MB -> 4.57 MB, a 37% cut.**

**THE HONEST PART: THIS IS A PARSE WIN, NOT A DOWNLOAD WIN.** Measured through brotli, all
three changes together are worth about **30 KB on the wire** — 1.65 MB to 1.62 MB — because
compression already sees through both whitespace and a repeated template. What does not
compress away is `JSON.parse` building 7.29 MB of string on a phone's main thread before the
first pull. Worth stating in this much detail because the tempting version of this entry
claims a 37% smaller download, and that claim is false.

**IT DEGRADES TO VERBATIM, and that is what makes it safe.** A URL that does not match the
template is written whole into `avatarUrl` as before, and the reader accepts either key. If
Google serves a new avatar shape tomorrow, the set gets bigger; no card loses its face. Sets
built before this still load unchanged.

**THE SEAM IS WHY THIS IS ALLOWED AT ALL.** Sets are the only source that packs; demo and live
emit whole URLs and always have. Because `parseSet` hands on an identical Channel shape either
way, nothing downstream can tell — which is the guarantee the seam exists to provide, and the
reason a storage-format change does not become a change to the game. Pinned by a round trip
through both real functions in `test/sets.test.js`, so the two copies of the template cannot
drift apart without a test going red.

**Three cards were shipping `http://` avatars**, which a browser blocks as mixed content on an
https page. Found while measuring the template and fixed at pack time rather than in the
renderer, so every reader of the set gets it rather than the one view that might have patched
around it.

---

## Subscribers become the dominant term — a deliberate reversal, not a regression (2026-08-15)

Ash handed over a 40-item brief titled "Final Balance, Auto Select & Fair Battle System"
(kept verbatim at [REBALANCE-BRIEF-2026-08-15.md](REBALANCE-BRIEF-2026-08-15.md)) and said to
mold the game to it. Item 1 is the one with the biggest engine consequence, and it is worth
stating exactly how it relates to the work six days earlier: **it asks for the opposite of
what 2026-08-09's rebalance delivered, on purpose, from the same person.**

2026-08-09 built toward "rarity must not decide the fight" — a top-decile N beating the median
UR/RUBY 19% of the time was the stated, measured, celebrated result. 2026-08-15's brief opens
with a different core philosophy: "a substantially more popular creator should generally be a
substantially stronger card." Read together these are not a contradiction to resolve, they are
two different instructions from the game's owner, six days apart, and the second supersedes the
first exactly as far as it says to. CLAUDE.md's "Battle balance" section now states this
explicitly at the top, because a file that quietly kept describing the old goal while the code
pursued a new one is the exact "confident document that disagrees with its own code" this repo
has flagged as its own worst failure mode before.

**WHAT ACTUALLY MOVED.** One knob, `BUDGET_GAIN` in `battle-stats.js`, 25 -> 170. The rest of
the formula — shape, the five axes, the residual trend lines, all of `battle.js`'s combat layer
(elements, rows, class verbs, formation bonus) — is untouched, per the brief's own item 7
("keep class and element strategy simple... these bonuses should stay relatively small").
Subscriber count already only ever touched the BUDGET, never shape; moving the gain further
along the same axis was the whole change, not a redesign.

**WHY 170 AND NOT SOMETHING ELSE.** Tried 260 first: power median ratio (giant/small) hit 2.20,
"small cards out-rating the median giant" hit exactly 0.0%, and the STRATEGY table's "biggest
subs" pick averaged 75.3% against every alternative. That felt like it had gone further than
"generally stronger" into "always stronger", so it was dialled back. At 170: power ratio 1.76,
same 0.0% overlap (this did not meaningfully change between 170 and 260 — see below), "biggest
subs"/"highest rating" both land around 71-75% average against the other picking strategies,
comfortably dominant without either one winning literally every matchup. Chosen over 260
because it leaves the SAME headroom to push further if Ash wants it stronger still, and because
attack's giant/small ratio (1.20) stays inside the OLD 0.74-1.35 band by coincidence, which was
a mildly reassuring sanity check even though that band no longer describes the goal.

**THE 0.0% RATING-OVERLAP NUMBER IS REAL BUT INCOMPLETE, AND THE GAP MATTERS.** No small card
in the fixture, however well-shaped, out-rates the median giant any more — a full reversal of
2026-08-09's headline claim. Taken alone this reads as "upsets are now impossible", which is
NOT what the brief asks for: item 1 explicitly keeps a smaller creator's path to victory open,
just relocates it from raw stat variance to TACTICS — "element advantage, class abilities,
formation, speed, momentum, or luck." So the rating was never the right thing to protect an
upset rate on; the fight is. A throwaway probe (not checked in, reasoning preserved here) built
a small team by hand-picking for class diversity and elemental counters against a
`arrangeFormation`d "typical" (median-ish) giant team pulled from the live 15,890-card deck,
and fought it over 500 seeds: **9.6% win rate**. Rare, real, entirely attributable to the
tactical layer rather than to shape luck. That is the number that actually answers the brief's
"does not guarantee victory... can still win" — not the 0.0% rating overlap, which answers a
question 2026-08-09 cared about and 2026-08-15 does not.

**THE SYNTHETIC TEST FIXTURE COULD NOT REPRODUCE THAT 9.6%, AND CHASING IT WAS ABANDONED
DELIBERATELY.** `test/battle.test.js`'s `syntheticDeck` — quantile-fit to the live deck back
when the design goal was compression — put its own "typical top-band team" harder to crack
than the real deck's: a tactically-built small team lost 5000/5000 trials against it, even at
matchups with the same ~0.90 power ratio that produced the 9.6% figure on real data. The
fixture's own header already documents two prior recalibrations for exactly this failure mode
(a quantile shape that stops matching the live deck once something about the deck's use
changes). A third recalibration, done blind against one probabilistic test, was judged not
worth the time against the rest of the brief still waiting. The test that used to assert an
outright win now asserts the weaker, still-true, fixture-proof claim instead: that variance
still produces different outcomes (survivor counts vary across seeds) even in a matchup the
small side is expected to lose — luck still has bite, exactly as item 36 asks, without leaning
on a specific win-rate number this fixture cannot currently produce.

**THE SUBSCRIBER POWER FLOOR (item 3).** A genuinely new mechanism, not a knob. The failure
item 3 names — "I pulled one of the biggest creators... somehow this card is garbage" — was
never a budget problem: a card's total budget is a pure function of influence, and shape always
sums to 1, so a giant's full budget is spent no matter how badly shaped. The actual risk is
allocation: a giant whose shape dumps its budget into SPD/MOM (multiplier stats, capped, and
weak relative to a direct HP/ATK/DEF allocation) can rate far below what its size implies even
though nothing was technically wasted. Fixed by rating a HYPOTHETICAL even-shaped card of the
same budget (which `classFrom` would itself call Balanced, so it correctly gets the Balanced
lift) and flooring the real card at 82% of that reference. The scale-up is solved by bisection
rather than a closed-form guess, because `ratingOf` is not linear in a uniform stat multiplier
(the mitigation and momentum terms both grow faster than linear) — a closed-form approximation
would either over- or under-correct depending on where in the budget range a card sits.
Verified directly with an engineered worst-case (a brand-new 250M-subscriber channel posting
80,000 clips, crushing punch/devotion/cadence toward the floor and maturity toward zero): raw
ATK before the floor was ~47; after, 310 — enough to keep the card's overall rating (841)
competitive with a real UR rather than languishing near N-tier.

**REQUIRED REWRITING test/battle.test.js's WHOLE BALANCE BLOCK, AND THAT IS EXPECTED, NOT A
SIGN SOMETHING WENT WRONG.** Four assertions inverted their own thresholds (attack-flat-with-
size became attack-scales-with-size; median-giant-only-marginally-stronger became median-
giant-substantially-stronger; large-share-of-small-cards-overlap became small-fringe-at-most).
This is the same class of update CLAUDE.md's own header warns future sessions to expect when a
design goal changes on instruction — the tests encode TODAY's goal, not a permanent law, and a
design brief from the game's owner is exactly the kind of "new measurement" that is allowed to
move them.

## Auto Select gets an explicit hierarchy instead of an emergent one (2026-08-15)

Items 4-6 of the same brief: Auto Select must never bench a UR for "marginally better
calculated synergy" — "the strongest, coolest, most obviously valuable five cards, then make
sensible adjustments," not a search for a perfect meta team.

**`bestTeamFrom` (opponent.js) was already pure top-5-by-`powerOf`, with zero synergy-awareness
at all** — so on the letter of the brief nothing was currently broken; there was no diversity
optimizer to accidentally bench a UR. But that also meant the "hierarchy" the brief describes
(power, rarity, subscriber power, class diversity, elemental advantage, formation, in that
order) was emergent at best — true only because `powerOf` happens to correlate with rarity, not
because anything enforced it. Given the subscriber rebalance above makes that correlation much
stronger than it used to be, this was the right moment to make the hierarchy an actual
mechanism rather than a coincidence.

**THE MECHANISM: a narrow tolerance window, not a scored multi-factor rank.** `pickBestTeam`
fills five slots greedily. At each slot it takes the single strongest remaining card UNLESS
something within 8% of that card's power (`SYNERGY_TOLERANCE`) would add a class the team does
not have yet, or — when an opponent is known (accept-a-challenge mode, via a new optional
`enemy` parameter on `bestTeamFrom`) — an element that counters them. Outside that 8% window,
power always wins outright; nothing about class or element can be scored highly enough to
override it. This is deliberately NOT a weighted-sum scoring function (power times 0.6 plus
diversity times 0.3 plus ...) — a sum lets enough small bonuses stack to overturn a real power
gap, which is precisely the "why the hell did it bench my UR" outcome item 4 rules out by name.
A hard window with power as the tie-break inside it cannot do that by construction.

**8% WAS CHOSEN TO CATCH THE BRIEF'S OWN WORKED EXAMPLE AND NOTHING WIDER.** Item 4 describes
"SSR + neutral element... preferable to R/N + favorable element unless the difference is
genuinely substantial" — two cards close enough that a reasonable player could see it either
way. It does not describe a UR losing a slot to an N. Tested directly: a UR built to be a clean
outlier above five N-band filler cards always keeps its slot in `bestTeamFrom`'s output,
deterministic (the algorithm has no randomness in it at all — same input always produces the
same team); a pair of near-twin N cards engineered to land inside the 8% window and differ in
class DOES let the diversity tie-break fire. Both are asserted directly in
`test/battle.test.js`'s "Auto Select must respect the power/rarity hierarchy" block, built by
hand rather than hunted for in a random deck, because the scenario the brief describes is rare
enough that a random fixture might never produce it.

**A SIDE EFFECT WORTH NAMING: `draftPower`'s "ceiling" now more often collects the formation
bonus.** `bestTeamFrom` also backs `draftPower` (the AI's target-power calculation in draft
mode) — unchanged in signature, but now actively prefers a fourth or fifth distinct class within
its tolerance window, so its output hits 4-5 classes far more reliably than the old pure-power
sort did. `makeTeam` applies the formation lift for any team that clears that threshold, and one
existing test (`draftOpponent`'s "aims at what the player's draft could field") had computed its
own comparison figure WITHOUT going through `makeTeam`, so it had been silently relying on the
old sort rarely triggering the bonus by accident. Fixed to route through `makeTeam` like
`draftPower` itself does — not a weakened test, a corrected one; it now asserts what the
function has always been documented to do.

## Collection-size fairness: a new pure engine, not yet reachable from the app (2026-08-15)

Items 15-27 and 33-35 of the brief describe a real problem this project had not addressed: two
players in a 1v1 can own collections that differ by two orders of magnitude, and an unbounded
larger collection turns "I've played a while" into "I can search for the mathematically perfect
five," which crowds out a new player's five genuine choices without the large collection doing
anything wrong on its own. The fix is a TEMPORARY, PER-BATTLE cap — never a change to what
anyone owns — and it now exists as `src/engine/fairness.js`, pure and fully tested
(`test/fairness.test.js`, 26 tests), but **nothing in the app calls it yet**. This entry records
the design so the wiring work (next session) does not have to re-derive it.

**THE RULE, EXACTLY AS SPECIFIED.** `needsShedding`/`eligibleSizes`: the larger side may keep
at most 1.5x the smaller side's size, rounded to a whole card; strictly inside that ratio,
nothing happens. Every worked example in the brief (10v12, 10v15, 40v48, 40v60 -> no shed;
10v150 -> 15; 40v100 -> 60; 40v55, 80v100 -> no shed) is pinned verbatim as a test case.

**`eligibleSizes` TAKES BOTH SIZES IN EITHER ORDER AND RETURNS BOTH CAPS**, which is not what
the first draft did. The first draft's `eligibleSize(smallerSize, largerSize)` required the
CALLER to already know which side was bigger — a real footgun, since a live caller has "my
size" and "their size" with no guarantee about which is which, and passing them backwards would
have silently capped the wrong side. Caught by the test file's own symmetry check
(`eligibleSize(b, a)` did not equal `eligibleSize(a, b)` when the args were swapped, which is
exactly the bug a real call site would have hit) before it ever reached the UI. Renamed and
reshaped to take two arbitrary sizes and return `{ a, b }` — the caller's own two values, each
correctly capped, regardless of which arrived in which position.

**RARITY-WEIGHTED SHEDDING, PROTECTED SLOTS FIRST.** UR/SSR/SR each get one guaranteed slot
when the player owns at least one (never invented if they do not — a player with 3 UR, 10 R,
20 N gets exactly one guaranteed UR, nothing for SSR/SR). The rest of the target is filled by a
weighted random draw without replacement, weight bottom-heavy across all six rarities
(`KEEP_WEIGHT`: N 1, R 3, SR 8, SSR 20, UR 50, RUBY 12).

**RUBY'S WEIGHT WAS WRONG THE FIRST TIME, AND THE FAILURE IS WORTH RECORDING.** Item 25 asks
for RUBY to have no guaranteed slot but still shed less than an N or R — "powerful enough that
it can remain vulnerable." First attempt: 30, just under UR's 50. Measured against a 41-card
pool (1 RUBY, 40 N) shedding to 10: RUBY survived roughly 99.7% of 100 trial seeds. "Can be
shed" was true in the sense that the code path existed and could theoretically fire, and false
in the sense a player would ever experience it — a mechanism a player can never observe is not
a mechanism, it is decoration. Lowered to 12 (just above SR's 8, well below SSR's 20): the same
scenario now drops RUBY on a real, observable fraction of seeds while still leaving it clearly
better protected than a common. The lesson generalizes past this one constant — "does the math
allow X" and "will a player ever actually see X happen" are different questions, and item 26's
own "do not make the exact probabilities unnecessarily complicated" only holds if someone also
checks the complicated-looking case (a rare tier in a large pool of commons) empirically rather
than trusting the ordering of the weights to imply the right magnitude.

**NOTHING RETURNED IS EVER A COPY.** `shedCollection` hands back references to the exact
channel objects passed in — no clone, no recomputed stat, no touched rarity — which is what
makes item 35 ("shedding must not modify ATK/DEF/HP/SPD/MOM/rarity/subscriber count") true by
construction rather than by discipline elsewhere in the codebase remembering not to break it.
Pinned by a reference-equality test, not a deep-equality one, since a clone that happened to
have identical values would pass a deep-equality check and still violate the intent.

**WHAT COMES NEXT, AND WHY IT DID NOT HAPPEN TODAY.** Showing the "your collection is more than
1.5x theirs" screen requires knowing the OPPONENT's collection size, which nothing in the app
currently transmits — solved at the wire-protocol layer (see the CODE_VERSION 2 entry below)
but not yet consumed anywhere. Wiring it in belongs at the same moment the challenge-flow
rework lands, since the brief places the fairness check inside the new shared build phase
(item 32's flow diagram: accept, compare sizes, shed if needed, CONTINUE/CHICKEN OUT, THEN both
enter team building) — building the fairness screen against the OLD asymmetric flow would mean
rebuilding its placement again the moment the flow changes underneath it.

## Challenge code bumped to CODE_VERSION 2: optional team, a travelling collection size (2026-08-15)

Two wire-format additions, both prerequisites for the challenge-flow rework rather than the
rework itself.

**A CHALLENGE MAY NOW CARRY NO TEAM.** Item 9: "A player should be able to generate and send a
challenge without building their team first." Every challenge code since this feature shipped
had required exactly `TEAM_SIZE` rows — the challenger committing first was the whole point of
the original design (see this file's earlier "the code carries inputs, not a verdict" entry).
That commitment is still allowed (item 10's "cocky" path is explicitly kept), just no longer
required: `teamA` on a challenge now decodes to `null` when zero rows were sent, and a decoded
`null` is distinguished from an empty array so a caller can use a bare truthiness check rather
than a length comparison everywhere this matters. A RESULT code's teams are unaffected — a
reply always carries two real, committed five-card teams, exactly as before; only the CHALLENGE
side of the protocol gained the "not yet decided" state.

**`makeResult` NOW REJECTS A REPLY TO A CHALLENGE WHOSE TEAM WAS NEVER COMMITTED**, and had to
become `async` to do it as a proper rejection rather than a synchronous throw (matching
`encodeCode`/`decodeCode`, which every caller already awaits inside a try/catch). This is not a
speculative guard: a bare challenge's team only ever gets decided through the live shared build
phase the next piece of work adds, and there is no second code exchange that could carry it back
into `makeResult` if that phase never ran. Reached, this is a caller bug — the UI must require a
live room (and therefore a real committed team) before ever calling `makeResult`, or prompt the
challenger to resend a pre-built challenge when no room is available. Throwing here converts a
silent "five-slot team array with a hole in it, fights wrong" failure into an immediate, named
one.

**EVERY CODE NOW CARRIES A `collectionSize` INTEGER, NEVER CARD DATA.** The other half of what
the fairness check (previous entry) needs: each side has to learn how many distinct cards the
OTHER owns, and the only channel that exists is the same one a team already travels through.
One number — "I own 47 cards" — not which 47, so this carries no more information than the
existing `subscriberCount`-shaped fields already do, and nothing about decision 3's "no
account, no identity, no collection beyond the five fielded cards" promise is stretched by it: a
bare integer is not an identity and describes nothing about WHICH cards exist. Absent (older
codes, or a sender that omitted it) decodes to `null` rather than `0`, so a caller can never
mistake "this code predates the field" for "this player owns nothing" — the latter would
wrongly trip the fairness check for no reason.

## The challenge flow rework ships: `lock` replaces `team`+`ready`, nobody scouts anybody (2026-08-15)

The piece the previous two entries deferred — "wiring it in belongs at the same moment the
challenge-flow rework lands" — landed the same day, in a follow-up pass. Brief items 8-14, 32,
37, verbatim in REBALANCE-BRIEF-2026-08-15.md.

**THE CORE CALL: v1's asymmetry was not incidental, it was load-bearing, so removing it meant
removing the mechanism that produced it, not patching around it.** v1's challenger committed a
team before the defender could see the challenge at all, and the defender always built LAST,
against a visible enemy. That was real strategic value handed to whoever accepted, and the
brief's item 11 ("neither player is disadvantaged") rules it out directly. The fix is not
"let the challenger see the defender's team too" (that would just move the asymmetry, not
remove it) — it is that NEITHER side sees the other's picks during building, live or not. Both
land on the same screen the moment acceptance is confirmed and build blind.

**A PRE-BUILT ("COCKY") TEAM DOES NOT GET SHOWN TO THE DEFENDER EARLY, EVEN THOUGH IT
TECHNICALLY COULD BE.** The challenge code is a plaintext paste — there is no server secret
hiding a pre-built team from a defender curious enough to decode the code by hand. The UI could
have displayed it as a "scout" panel the way v1 did. It deliberately does not: item 10 says the
challenger's prepared team "remains editable until READY", which means what the defender COULD
see by decoding is not necessarily what the challenger ends up fielding — displaying it would be
showing a stale, possibly-wrong picture and reintroducing the exact one-sided-information shape
item 11 rules out. So the shared build screen never sets `ui.enemy` on the live path, full stop,
independent of which sub-choice the challenger took.

**THE PROTOCOL WAS REWRITTEN, NOT EXTENDED.** v1's `functions/api/ready/[room].js` had three
ops — `accept`, `team`, `ready` — because v1 needed to distinguish "here is my team" from "I am
ready" for the DEFENDER specifically (conflating them once caused a fight to start before a
player had agreed to it — see the `team`/`ready` split entry above this one). That distinction
stops meaning anything once nobody scouts anybody: there is no reason to upload a team before
locking it, because there is nothing to show early. So `team`+`ready` collapsed into one `lock`
op that does both at once, for either side. `accept` gained a `cs` field (the defender's
collection size — the challenger's already travels inside the challenge code itself) and now
stamps a server-side `buildStartAt` the moment it fires, which both clients count their 30-second
window down against using the same clock-skew-correction trick `bothAt` already used for the old
launch countdown. Teams travel as plain channel-shaped JSON, not `engine/challenge.js`'s packed
copy-paste codec — this is a fetch body a machine reads once, not a string a human re-types, so
packing complexity would have bought nothing.

**THE MANUAL FALLBACK IS UNTOUCHED ON PURPOSE, AND THAT MEANT ACCEPTING AN ASYMMETRY THE LIVE
PATH JUST REMOVED.** Two people passing a string by hand have no live channel to build over
simultaneously — there is no way to make the manual path fair in the new sense without a server,
and the whole point of the manual path is that it does not need one. So `fightAsDefender`,
`renderHandoff`, `renderReady` and `runCountdown` are byte-for-byte what they were: the
challenger commits first, the defender scouts and builds against a visible enemy, exactly v1's
shape. This is a genuine, accepted trade: a challenge sent over a working live room gets the new
fair-and-simultaneous flow; a challenge that falls back to copy-paste gets the old asymmetric
one. The alternative — refusing to fall back at all — would mean a broken KV binding takes the
whole challenge feature down with it, which locked decision 3 already rules out for exactly this
reason.

**A BARE (TEAM-LESS) CHALLENGE HAS NO MANUAL FALLBACK, AND SAYS SO RATHER THAN HANGING.** The
"send now" playstyle (item 10) only works because the live room can bring both sides together
later; a defender who accepts a bare challenge with no live room has nothing to build against —
there is no reply a person could hand-write back, because there is no committed challenger team
to reply to. Both `renderAcceptPaste` and `renderChallengeOut`'s poll detect this specific
combination (bare team + presence settled off) and tell the player to go back, build a team, and
resend, rather than leaving them on a screen that can never progress.

**CHICKEN OUT SENDS NO SIGNAL TO THE ROOM, AND THAT IS A KNOWN GAP, NOT AN OVERSIGHT.** The
server has no operation for "cancel" — adding one for a single edge case (the larger player
declining a fairness-gated match) would be new protocol surface for a rarely-taken exit, and the
room's own 10-minute TTL and the opponent's 30-second build timer already bound how long anyone
is left waiting. The opponent's screen simply keeps counting down and auto-locks on schedule;
the fight never starts because the side that chickened out never locks. Recorded here rather
than fixed because it is a real, if minor, incompleteness worth a future session's attention
rather than a silent gap.

**NOT VERIFIED WITH TWO LIVE BROWSERS.** This project's stated preference is manual visual
testing over installing a headless browser driver, and `src/ui/battle.js` carries no automated
tests by design (DOM wiring, not logic — the logic it wires is what `engine/` tests). 562 tests
pass, all of them in `engine/`, none of them touching this file. The shared-build timer, the
lock race, and the fairness gate were built and reasoned through carefully rather than watched
running; TASKS.md carries an explicit two-window checklist for the next session to run before
trusting this in front of real players.

## A 404 from our own lobby is settled, not retryable (2026-08-15)

Small change, and it fixed two screens telling a player two different stories about the same
fact. `data/presence.js` treated every non-OK response as `error` (retryable) on the reasoning
recorded in its own comment — "even a 4xx means the server is up and answering, so the room may
well be fine a moment later". That is true of 400 and 405, which are the only failures our
endpoint actually emits (bad room, bad body, bad op, bad side, bad team, wrong method). It is
**not** true of 404, which our Function has no branch for at all: a 404 on this path means the
Function is not deployed — a plain static host, or a dev server that cannot run Pages Functions.

Left as retryable, the defender (who awaits a single `accept`) correctly reported no live lobby,
while the challenger (who polls) retried forever and sat on "Waiting for someone to accept…"
with no path to the message explaining why it would never come. Same server, same answer, two
different stories — and the challenger's version was unfalsifiable from inside the app.

The asymmetry in the cost is what settles it. Misreading a transient 404 as settled drops both
players into the copy-paste flow, which works. Misreading a permanent 404 as transient strands
one of them on a screen that cannot progress. So 404 now returns `OFF`.

**This also made an existing branch reachable for the first time.** `renderChallengeOut`'s "a
bare challenge has no manual fallback" message was written when the rework landed and could
never fire, because the only way to reach it was a settled `off` that a 404 never produced.
Worth noting as its own lesson: a fallback that has never once executed is not a fallback, it is
an assertion nobody checked.

## Auto-pick, and a default parameter that ate a click event (2026-08-15)

`autoPick()` took no arguments for its whole life, so `onClick: autoPick` — passing the function
by reference — was correct. Wiring the collection-fairness shed pool through it added a `pool`
parameter, and that one line turned every existing by-reference handler into a call receiving a
**MouseEvent** as its pool. `distinctById` then called `.filter` on the event, threw inside the
click handler, and the button did nothing at all: no error on screen, no visual change, no clue.

Recorded because the failure mode generalises past this button. **Adding a parameter to a
function is a breaking change to every place that passes it by reference**, and in a DOM event
handler the breakage is silent by construction — the exception goes to the console and the user
sees a button that simply does not respond. The fix is the call site; the defensive
`Array.isArray(poolArg)` normalisation alongside it is there because a silently inert button is
worth one line to make impossible twice, and it was checked not to swallow a legitimate shed
pool (which would have quietly reverted the fairness feature it was added for).

## The pack actually opens now, and the summon tells you one secret on purpose (2026-08-15)

Pressing the pack used to cut straight from the banner to a grid of face-down cards. N3TWORK's
card-reveal choreography breaks a pull into six stages and this app already had five of them —
the gesture (the pack IS the button), the per-card telegraph (the rarity beam), the reveal apex
(the escalated flip), the contemplation (click to inspect) and the exit. The missing one was
stage two, the SUMMON: the moment between pressing and seeing. That article names its absence as
the first mistake to avoid, because it spends the anticipation a gacha runs on.

`src/ui/packopen.js` fills it with about a second of choreography — the pack travels from the
banner to centre stage (a FLIP transition off the real button's bounding rect, so it reads as
the same object rather than a cut to another screen), charges, then bursts into a shockwave and
a spray of card-shaped streaks while the reveal slides in over the top.

**THE SUMMON DELIBERATELY LEAKS THE BEST RARITY IN THE PULL, AND THAT IS A TRADE AGAINST
`ui/reveal.js`'S OWN STATED RULE.** That file withholds rarity until a card turns, on purpose.
The charge here does the opposite: it colours itself from the best card in the pull, shakes
harder for it, and holds longer before bursting — 240ms for a pull of commons against 820ms for
a RUBY. The two secrets are not the same secret. "Something good is in here" is what gives the
flip sequence that follows anything to be tense about; "it is the fourth card" would be what
actually spoils it, and that is still withheld. Hearthstone's golden pack is the same trade and
it is the most-copied moment in the genre. Commons get the short, brisk version for the other
half of the same article's advice: dressing up a bad pull as a big one manufactures a letdown.

**THE PULL IS RESOLVED AND BANKED BEFORE ANY OF THIS RUNS.** `main.js` draws, adds to the
collection and persists FIRST, then awaits the animation purely to decide when the reveal opens.
So a player who closes the tab mid-flourish keeps their cards, nothing about the summon can
influence what came out of it, and `playPackOpen` is written never to reject — reduced motion, a
missing overlay, a skipped sequence and garbage input all resolve. A decoration must not be able
to cost someone a pull.

**SKIPPABLE, AND ARMED LATE.** Any input ends it. The listener attaches 220ms in rather than
immediately, because the press that OPENED the pack is still being dispatched — a keyboard
activation is `keydown` then `click`, and holding Enter repeats `keydown` throughout, so
listening straight away let the sequence cancel itself. That reads as broken rather than as
skipped.

**One cascade trap worth pinning:** the charge shake is a keyframe animation and the burst sets a
plain `transform`. A running animation outranks a plain declaration whatever the specificity, so
stacking `is-burst` on top of `is-charging` left the front card jittering in place instead of
punching forward. The fix is to SWAP the classes, not add — removing `is-charging` ends the
animation, which is the only thing that reliably hands the transform back.

## Two smaller invitations, same session (2026-08-15)

**The reveal offers the loop.** Its only exit was "Done", which spends the moment a player is
most likely to want another pull on nothing (the same article's stage six). It now leads with
"Pull again ×N", labelled per open from `banner.js`'s new `packSize()` getter so it cannot
promise a size the toggle no longer has, and running the SAME `doPull` the pack runs rather than
a quieter shortcut. Done stays a real, equal-weight exit — an invitation that becomes the only
door is a trap, and this project has a locked decision about not doing that sort of thing.

**The empty binder is written as an invitation.** "No cards yet" reported something the visitor
could already see. It now shows a ghost fan echoing the pack's own silhouette, points at the
object that fills it, and says what the cards actually are — which is the one genuinely
interesting fact about this game and was nowhere near the empty state.

## A match is not the arena's lifetime (2026-08-15)

The second live fight of a session was broken in three ways at once, and all three were the
same mistake: the per-match fields were only ever reset in `openArena`, so a player who
finished a fight, pressed New opponent and challenged again carried the entire previous match
forward.

- **`buildDeadline` still held the FIRST match's end time**, by then minutes in the past. The
  shared build countdown opened at `00:00` and auto-locked instantly for whichever side got
  there first, while the other side never got a window at all. This is the frozen-countdown bug
  wearing new clothes — state that describes one moment being read at another — which is why it
  is worth recording twice.
- **The tray came back pre-populated**, because `renderSharedBuildScreen` called
  `restoreLineup`. In a phase whose entire premise is that both sides build fresh and blind,
  one side opened holding a team and the other holding nothing. It was frequently the wrong
  team too: the previous match's five, or cards the fairness shed had just made ineligible.
- **`eligiblePool`, `locked`, `room` and `side` all pointed at a finished match.**

So there is now one `resetMatch()` that says what a match owns, and every entry into a new one
goes through it — mode-select, both Back buttons, CHICKEN OUT, the resend path, and `openArena`
itself, which no longer keeps a second hand-maintained copy of the field list. Keeping two lists
is precisely how `buildDeadline` came to be cleared on open and nowhere else.

**The tray now starts empty on both sides, every time — Ash's call, and it survives the tension
with brief item 10.** The "cocky" pre-build still does its real remaining job: it produces a
challenge code carrying a committed team, which is the only kind that has a manual fallback when
the lobby is unreachable. What it no longer does is seed the shared builder, because a phase
built to be symmetric should not open asymmetrically. The saved deck itself is untouched — this
only declines to LOAD it there, and Quick battle still restores it.

**"Rebuild and fight again" is gone, and removing it was the fix rather than a simplification.**
It dropped the player back into the builder with the finished match still loaded — same room id,
same seed, same side, a lobby the server had already seen both locks for. Committing from there
re-entered a dead match nobody was coming back to, and the timing state it preserved was the very
thing that opened the next countdown at zero. It was a shortcut past the only place a new match
can legitimately begin.

**No server reset is needed, and that was worth checking rather than assuming.** A room id is
`hash(fingerprint(teamA), seed)` and every challenge draws a fresh uint32 seed, so a new match
cannot inherit an old room: 2,000 simulated sends produced 2,000 distinct rooms for both the
pre-built and the bare shapes. Abandoned rooms simply expire on their ten-minute TTL. The bug was
entirely client-side.

## The coffee link is gone — locked decision 2 withdrawn (2026-08-15)

Ash's call: remove the Buy Me a Coffee link from the site and everywhere else. Done —
`index.html`'s footer paragraph, its `.footer-coffee`/`.coffee-link` styles in `styles.css`,
and the `terms.html` paragraph that described it, which now says plainly that there is **no way
to give the author money at all**.

This is recorded as a reversal rather than a tidy-up because it edits a "do not reopen" entry.
Two things make that legitimate rather than a violation:

**It moves in the safe direction.** Locked decision 1 is "no monetization inside the game", and
decision 2 was the single carve-out from it. Removing the carve-out does not reopen decision 1,
it closes it further — the project now has no donation link, tip jar, sponsor button or payment
path of any kind. The hard rule attached to the old link (the coffee buys a coffee, it never
unlocks anything) now holds trivially, because there is no coffee.

**The reasoning behind the rule survives the removal of the thing it governed.** The reason the
carve-out was written so narrowly — the moment a donation grants in-game value, every IP and
legal problem comes back — is still the reason to be careful if the question ever returns. So
decision 2 keeps that sentence while stating that the exception is withdrawn, rather than being
deleted outright and leaving a future reader to rediscover why it was ever hedged.

Adding a payment path back is a **fresh decision**, not a restoration.

The two earlier entries in this file that describe the link being chosen and published are left
as-is, annotated by this one — same rule the `WPn` tags and the 37.2% matchmaker figure follow:
the record says what was true when it was written, and later entries say what changed.

## The lobby: acceptance no longer means "start building" (2026-08-15)

The last asymmetry in the challenge flow, and it was structural rather than a slip. Only ONE side
can ever face the collection-fairness gate — by construction, since only one collection can be
the larger. Acceptance dropped both sides straight into the build phase, so while the larger
player read CONTINUE/CHICKEN OUT and decided, their opponent was already picking cards against a
running thirty-second clock. Measured against the reported case (a 7-second deliberation), the
smaller side got the full 30s and the larger side got 23 — **the player with a decision to make
was the player penalised for making it**, which is precisely the unfairness the rework existed to
remove.

Acceptance now opens a ten-second LOBBY that both sides sit in and neither can build during. The
larger side sees the fairness screen; the other is told a decision is being made and gets a
button of their own, so both are doing the same thing rather than one waiting blankly. Both watch
the same countdown. Anyone who has not pressed by zero is entered automatically, so an absent
player cannot stall a match — the same principle as the build phase's auto-lock, and the same
default: when someone does not answer, choose the outcome that lets the fight happen.

**The mechanism is where the build clock is stamped.** `accept` now sets `lobbyAt`, and
`buildStartAt` is set by the server on the SECOND `enter`. That one move is the whole guarantee:
the thirty seconds cannot begin until both sides are through, so there is no arrangement of
timings in which one player builds while the other decides. Verified end to end — `buildStartAt`
stays null after one `enter` and is stamped on the second.

**CHICKEN OUT now reaches the room.** It was previously a purely local retreat, documented as a
known limitation: the opponent kept waiting on someone who had already left. That was tolerable
when nobody was watching for it and indefensible once the lobby's entire purpose is one side
waiting on the other's decision, so there is a `bail` op and the waiting side is told the match is
off instead of building alone and locking into a fight that will never resolve.

**What the smaller side is told, and what it is not.** It learns its opponent has a decision to
make; it is never told what the decision is about. Brief item 21 asks that the smaller player not
be made to think about invisible balancing rules, and "they are confirming whether to go ahead"
honours that while still explaining the pause — which the alternative, an unexplained ten-second
wait, does not.

The shed itself moved to the moment both sides are through the lobby, rather than firing when
CONTINUE was pressed: the eligible pool is now decided once, immediately before the builder that
reads it, and never for a match somebody backed out of.

## "Build my team first" removed, and what it costs (2026-08-15)

Brief item 10 asked for a "cocky" path: build five, then send the challenge. It shipped, and it
is now gone — Ash's call, and the right one. Every other change in this pass exists to put both
sides in front of the same clock with the same information, and a challenger who has already
chosen is not doing the same thing as the person opposite them, however editable their picks
nominally remain. Keeping the option would have left a button whose whole effect was to undo the
symmetry the lobby, the blind build and the shared countdown were built to create.

Removing it made a chain of things dead, and they were deleted rather than left as traps:
`createChallenge` (the only sender that folded a team into a code), the builder's name field
(the send screen owns it), `fightLabel`'s challenge branch, `onCommit`'s challenge route,
`onReply` and the paste-a-reply box on the challenger's screen, `ui.sentTeam`, and the
`echoMatches` import. A challenge is now sent from one screen, by one button, carrying no team.

**THE COST, STATED PLAINLY: A CROSS-DEVICE CHALLENGE NOW REQUIRES THE LOBBY.** This narrows
locked decision 3, which promises that "if the KV binding is missing or the request fails, the
arena falls back to the manual countdown it shipped with". That fallback worked by having the
challenger commit a team the defender could scout and answer by hand — it was irreducibly
asymmetric, which is precisely why it cannot survive this change. A challenge that carries no
team has nothing for a manual reply to answer.

What decision 3 actually protects still holds: **the game works with no server.** Quick battle
is untouched, needs nothing, and is now a better fight than it was (below). What is lost is the
copy-paste cross-device duel, and the UI says so rather than failing quietly — the send screen
probes for a lobby before offering the button, and the waiting screen names Quick battle as the
way on. The DEFENDER's manual path is left intact for a code that does carry a team, since older
codes exist and decoding still supports them.

## The AI gets a collection instead of a target (2026-08-15)

Quick battle built its opponent with `matchOpponent`: a team aimed at the player's own rating,
assembled from the whole 15,890-card set. That is even by construction, and it is the wrong kind
of even — **the AI was never a player, it was a difficulty setting wearing five cards.** Nothing
it fielded had anything to do with luck, a collection, or the odds the player pulls on, so
"I finally pulled a RUBY" changed nothing about the fight it walked into: the opponent was
rebuilt to the new rating either way.

So the AI now rolls a COLLECTION — the same number of distinct cards the player owns, drawn on
the same band-first weighted odds from the same set — and builds its best five out of it with the
same Auto Select the player has. Same rules both sides of the table, which is the model a live
1v1 already runs on, so Quick battle stops being a different game from the one the arena teaches.
It draws straight through `pullOne` rather than replaying x10s: no dupe bookkeeping, no reveal,
nothing the player sees. The only property that must survive is the drop curve, and
`bandsFrom`/`pullOne` ARE that curve — the same two functions the real pull screen uses, so the
AI's odds cannot drift from the player's without the player's drifting too.

**A bug worth recording, because the fix is the interesting part.** The first implementation drew
against the whole pool and discarded duplicates under a fixed try-cap. That looks obviously
correct and cannot finish: RUBY is 0.1% of the weight, so on a pool holding two of them the
chance of never rolling a specific one across a thousand draws is better than even — measured at
**0.571**. Under a cap, the AI silently ended up with FEWER distinct cards than the player, which
is the exact unfairness this change exists to remove, reintroduced by the sampler. A run of
duplicates is now treated as evidence the pool is picked over, and the bands are rebuilt from
what is genuinely left — weighted sampling WITHOUT replacement, rather than a uniform mop-up that
would flatten the odds at the tail. Verified over 500 seeds including the pathological
twelve-card pool; 0.27ms per opponent.

`matchOpponent`, `matchQuality` and the difficulty dial remain in `opponent.js`, tested and
unused by the UI — they are a real capability (a power-matched opponent at even/uphill/favoured)
and the obvious raw material for a difficulty setting later.

## One defender per challenge, and a lobby that can fail (2026-08-16)

Reported live, twice: both windows sat on `LOBBY — 00:00 / Waiting for them…` until the room
expired. The first pass read it as the KV write race and shipped the `enter` re-assert that
repairs it (5889d0e). That race is real and the repair works — verified against the live endpoint,
two clients writing at the same instant, recovered in one poll — but it was not this.

**The seat was taken twice.** A challenge code is a STRING. Anyone holding it can accept, and two
acceptances were indistinguishable from one: both browsers took seat B, `enteredA` was therefore
never set, and `buildStartAt` is stamped only once BOTH sides are through the lobby. The two of
them then waited on a challenger who did not exist. What made it unrecoverable rather than merely
slow is that each side could see its OWN `enteredB` was true, so the re-assert repair had nothing
to repair and stayed silent — the exact repair added for the previous diagnosis could not fire.

The screenshots proved it before the code did. In a real A↔B pairing one side's "Your collection"
is the other's "Opponent collection", so the two windows cannot print the same pair of numbers.
Both printed `Your 40 / Opponent 10` — both were reading the same challenge code's
`collectionSize` as their opponent, which only happens if both are seat B.

So `accept` now carries a **random per-match nonce** and the room records which browser holds the
defender's seat. First accept wins; a second one is answered `seatTaken` WITHOUT a write, so the
match already running in that room is not disturbed, and the person who pasted a used code is told
that rather than dropped into a lobby that can never start. Re-sending your own accept (a
double-click, a retry after a dropped request) carries the same nonce and is not a second person.
A claimless accept — the client that shipped before this field existed — is let through unchanged.

**This touches what the endpoint may receive, so it is stated plainly:** the nonce identifies a
SEAT for ten minutes, not a person. Nothing is behind it to look up, it is generated and discarded
in the browser, and it is deliberately absent from the view the room sends back, so the other
player never receives it either. That is inside the promise in locked decision 3 — no account, no
identity, no collection beyond the five cards someone chose to field.

**The second half is the one that matters more, because it is not specific to this cause.** A
lobby had no way to fail. Entering is only half of what starts a build, so a side can be perfectly
correct, perfectly entered, and still waiting on someone who closed the tab, never came back to a
backgrounded window, or is holding a code for another room — and the screen it gets is a frozen
00:00 that never explains itself. Worse, `enterNow` disabled every button in its row, CHICKEN OUT
included, so pressing CONTINUE removed the only way off the screen short of reloading the page.
Committing to a fight is not forfeiting the right to leave it.

Now: CHICKEN OUT stays live once entered, and about twelve seconds past the lobby's own deadline
(measured from the DEADLINE, not from this side's entry — entering early is normal) the screen
says the opponent never came through and offers the way out, while still polling, so a phone that
thaws its tab late still starts the match. The same dead end one phase later — presence going
settled-off mid-build, which used to `return` out of the poll in silence — now says so too.

**The general rule this leaves behind: every screen that waits has to be able to stop waiting.**
Three of them in this flow were written as if the other player always arrives.

**One more, found while reading and fixed here:** the fairness verdict was computed at the lobby
and computed AGAIN in `beginSharedBuild`, from `ui.roomState.csB` — a field a room write built on
a stale read can drop. The second answer could differ from the screen the player just agreed to,
in either direction: a promised shed that never happened, or a shed nobody was shown. It is
latched once now, in `ui.gate`, the same discipline the two deadlines already follow.

## More chaos, measured rather than argued (2026-08-16)

Ash, after watching a rating-even fight end as a wipe: make it "a lil bit more chaotic — crit
damage and all boosted a bit... Not punishing, just fun and little more non-deterministic."

The engine has a rule attached to it — retune only against `tools/battle-balance.js`, never by
argument — and the first thing that rule produced was an obstacle: **the tool could not see the
thing being asked for.** Every figure it printed measured whether the RIGHT TEAM wins. None of
them measured how much the dice are worth, so "turn the dice up" had nothing to check itself
against. So a CHAOS block went in first, and it prints two numbers because chaos has two halves
a player feels separately:

- **roll-flip rate** — the share of matchups whose six damage rolls did not all agree on the
  winner. Non-determinism where it counts: the same five against the same five, decided
  differently by luck alone.
- **hit spread / crit share** — what ONE swing looks like. This half can move a long way while
  the first does not move at all, which is exactly what `battle.js`'s header already recorded:
  a 5v5 runs ~25 attacks and independent noise averages out, so widening per-hit variance from
  0.12 to 0.50 once changed outcomes not at all.

**What shipped:** `VARIANCE` 0.25 -> 0.35, `CRIT_BASE` 0.05 -> 0.09, `CRIT_MULTIPLIER` 1.6 ->
1.75. Measured on the live 20,739-card deck at 3,000 fights:

| | before | after |
|---|---|---|
| roll-flip rate | 44.0% | **49.8%** |
| crit share | 27.3% | **31.2%** |
| one swing, p95/median | 2.94x | **3.11x** |
| power ratio (RUBY vs N) | 1.77 | 1.77 |
| small cards out-rating a giant | 0.0% | 0.0% |
| even-match win rate | 39.3% | 38.1% |
| fight length | 6 rounds (p95 9) | 6 rounds (p95 8) |
| class marginal spread | 14.6 pts | 10.8 pts |

The SIZE block came out byte-identical and every picking strategy moved under half a point, so
the 2026-08-15 philosophy is untouched: subscriber count still generally decides, upsets are
still tactical rather than free. "Not punishing" is the same claim read from the other side —
the favourite still wins as often as it did; it just wins less predictably.

**THE KNOBS ARE NOT INTERCHANGEABLE, and that is the finding worth keeping.** `VARIANCE` is
free: it is not in `ratingOf` at all, the noise is symmetric, and the averaging that makes it
safe to widen is the same property that stops it ever overturning a well-built team.
`CRIT_MULTIPLIER` is not free — it prices every card as well as resolving every hit, and it
AMPLIFIES the crit spread that already exists between classes (Assassin 22%, Carry 37%). Raise
it and a rating-matched Carry must be a smaller card to sit level, which quietly makes low-crit
classes the bargain. 1.9 was tried and backed away from. `CRIT_BASE` sits in between: it feeds
the rating too, but as a flat term it lifts every card equally, which is why the frequency half
of "more crits" was bought there rather than with the multiplier.

**A measurement was wrong and is now fixed, which is the more valuable half of this entry.**
MARGINAL VALUE — the class figure CLAUDE.md tells you to trust — ran 26 team shapes x 12
re-rolls and reported a 4.2-point spread. That is this tool's OWN headline mistake, repeated one
section below where it was diagnosed: re-rolls are near-duplicates, so 312 battles carried 26
shapes' worth of information. It was caught by the only symptom that cannot be talked away —
the worst class changed IDENTITY between two adjacent settings of the same knob (Titan 51.9% at
1.9, Assassin 50.3% at 1.75). A real effect does not do that. At 120 shapes x 4 rolls, for about
the same cost, the shipped engine's spread was **14.6 points all along**. Nothing regressed; a
number that had never been true stopped being printed.

Tuning against the broken figure would have concluded that a modest crit bump wrecked class
balance, and the change would have been abandoned for a reason that did not exist.
