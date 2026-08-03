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
