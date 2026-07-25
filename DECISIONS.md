# Decisions

Append-only. One entry per decision that closes off an option. Newest at the bottom.

---

**No monetization in the game.** No paid pulls, currency, perks, or ads. YouTube API ToS
restricts commercial use, cards use creators' names and likenesses, and paid gacha invites
gambling and minor-protection regulation. Harusugi ran Wikigacha free at launch with only a
Buy Me a Coffee link. We do the same.

**One Buy Me a Coffee link, no strings.** Passive tip jar in the footer. It buys Ash a
coffee and never unlocks anything in-game. If a donation ever grants in-game value, every
IP and legal problem above comes back.

**Client-side only, user-supplied API key.** Static host, no backend. This is what makes
the cost question mostly evaporate, which is what makes the monetization question easy.

**No build step.** Plain ES modules. Vitest is a dev dependency and does not touch the
shipped artifact.

**Split the single file into modules (WP0).** Vitest cannot import functions out of a
`<script>` tag inside an HTML file, so the single-file build made the test suite
impossible. The tests are a portfolio goal, so the file structure has to serve them.

**Handles and UC ids only.** `/c/` vanity URLs are not resolved. They require an extra
search API call and a heuristic match, and the cost is not worth it.

**No persistence yet.** In-memory state only, to stay safe in sandboxed previews.
Revisit once the app is being served from a real static host.

**Hidden subscriber counts read as N.** The API omits `subscriberCount` and sets
`hiddenSubscriberCount: true` for channels that hide it. The core treats that — and any
malformed count — as the lowest band rather than throwing, so a card always renders.
To be pinned by tests in WP1.

**Accent color: sample the avatar, fall back to a hash.** Live avatars are cross-origin;
when canvas sampling is blocked (CORS taint) or the avatar is near-grey, the accent is
derived from a hash of the channel id instead. Deterministic either way, never blocks
rendering.

**Card sets are the primary pull source.** Curated, versioned channel snapshots ("Series")
ship as static JSON — players never need an API key. Demo mode becomes the built-in starter
set; live BYO-key mode stays as a power feature. Chosen over shipping a shared
referrer-restricted key as the default (that stays open as a fallback idea).

**Series are monthly printings of ~300–500 cards.** YouTube's Developer Policies cap stored
statistics at 30 days, so a scheduled snapshot refresh re-cuts each set monthly and cards
carry a "stats as of <month>" label. Compliance and TCG set-symbol flavor from one mechanism.
Curation flow: candidate lists are drafted with a target rarity mix (~N 40 / R 30 / SR 18 /
SSR 9 / UR 3 %), then human-approved before snapshotting.

**One app, many banners — the codebase never forks.** Genre sets (gaming, commentary, …) are
banners inside a single deployment. Themed sister deployments stay possible later from the
same code with different default set + palette, but they are a deploy config, not a fork.

**Opt-out for channel owners.** Real people become cards, so the footer gains a contact
line and removal requests are honored promptly (policy requires deletion within 7 days for
user-data requests; we extend the courtesy to set membership).

**WP0 done: monolith split, entry is `index.html`.** `youtube-gacha.html` is deleted; the
app is ES modules under `src/`, loaded via `<script type="module" src="src/main.js">`.
Behavior is unchanged (verified: pure-core values match, and demo mode boots to the
identical 8-chip banner). `toCard` moved into `core.js` (it is pure — the model bridge,
not a renderer) so `state.js` depends on `core`, never the reverse.

**Two files beyond the planned tree: `src/state.js` and `src/ui/util.js`.** `state.js`
holds the shared in-memory `state` + `currentPool`/`addToCollection` so `banner`,
`collection`, and `main` import one owner instead of threading it through every call.
`ui/util.js` holds `escapeHtml` (used by both `card` and `banner`) rather than coupling
`banner → card` for a generic helper. `main.js` stays wiring-only; `banner` takes an
`onPull` callback so it never imports the pull glue.

**Live adapter normalizes `customUrl` to the `@handle` shape.** The API's
`customUrl` is not guaranteed handle-shaped — older channels return a bare,
lowercased vanity string ("mkbhd") where the modern format is "@mkbhd". The
live adapter prepends `@` when missing so the `handle` field always matches the
Channel typedef and the demo/sets adapters. Empty stays empty.

**WP1 done: 56 tests pin the pure core and the pull engine.** Vitest is the repo's first
and only dependency, dev-only — the shipped app still has zero. `test/core.test.js` pins
every rarity boundary from both sides (string and number inputs), the hidden-subs-read-as-N
rule, junk-input safety, and monotonic/multiplier stat scaling. `test/gacha.test.js` injects
mulberry32 (a tiny seeded PRNG) so x10 size, dupe stacking, and the N>R>SR>SSR>UR frequency
order are exact, reproducible assertions rather than flaky statistics.

**Local dev needs a JS-MIME static server, not `file://`.** ES modules are blocked over
`file://`, and browsers reject module scripts served as `text/plain` (Python's
`http.server` does this on Windows). `npx serve` is the recommended local server;
GitHub Pages / Netlify serve correct types, so hosting is unaffected. README updated.

**WP2 done: coffee link published under `ChunChunMaru`, disclaimer already present.**
The footer's "not affiliated with YouTube/Google" line predated WP2, so WP2 added only the
tip jar: a single passive text link to `buymeacoffee.com/chunchunmaru`, coffee-accent
(SSR gold) on hover, opens in a new tab, wired to nothing in the game. Published under the
social handle ChunChunMaru rather than the real name, by choice. The hard rule holds — the
coffee buys Ash a coffee and never unlocks anything in-game. Unlike Wikigacha's CC BY-SA
line (which grants reuse rights downstream), our footer disclaims a relationship; we have no
license to grant, so the notice can only ever be a disclaimer, never an attribution.

**Card face stays clean; the export carries the disclaimer (WP5).** Studying Wikigacha's
card up close: its CC BY-SA line lives on the pack art and page footer, not on the card face.
We follow the same split but for a different reason — our disclaimer is risk management, not
an attribution debt, and the risk peaks when a card leaves our page. So the in-app card face
stays uncluttered (WP3's frame/finish do the work), and the WP5 PNG export stamps a small
"unofficial fan card · stats as of <month> · not affiliated with YouTube" line into the image
itself, because the export is the version that travels without page context.

**Test report is a self-contained monolith HTML, rendered from the JUnit XML.**
`@vitest/ui`'s HTML report was tried and dropped: it is an app (assets folder, gzipped
metadata, needs a server), and a report should be a document — double-clickable,
mailable, archivable. `tools/test-report.js` renders the JUnit XML we already emit into
one dependency-free HTML file per run, timestamped, failure traces inline. Dev
dependencies are back down to Vitest alone. The failure path is verified, not assumed:
a deliberately failing test must render a FAIL report and exit non-zero for CI.

**Consume the API's integer fields; never parse a localized subscriber display.** The Data
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

**WP3 done: holographic finish gated by rarity, and the CSS is now its own file.**
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

**Rarity tiers ARE the YouTube Creator Awards.** The rarity thresholds (100K / 1M / 10M /
50M) are exactly the Silver / Gold / Diamond / Custom-("Red Diamond") play-button thresholds,
so the tiers name themselves: N=Graphite, R=Silver, SR=Gold, SSR=Diamond, UR=Red Diamond.
This replaced the earlier arbitrary N-grey/R-blue/SR-purple/SSR-gold/UR-red hues with a
palette that ties the whole look back to YouTube. Each tier is one `--t-*` custom-property set
(bevel stops, glow, badge ink) so a card recolours by rarity from a single source, and the
chip dots read the same `--rc`, so chips and cards can never disagree.

**Card redesigned to a bevel-frame hero card (from the `card-prototype/` look).** A conic
metal-bevel "seam" wraps a dark inner face: rarity badge + tier label top-left, name + handle
top-right, the avatar as a ringed centrepiece, subs line + ATK/DEF boxes at the bottom, faint
monogram behind. All internal sizes are **container-query units (`cqw` + `clamp`)**, so one
markup scales cleanly from the collection grid to the inspector with no per-size overrides.

**Avatar promoted from inset to centrepiece — reverses the old "small inset" guardrail.**
Recorded in CLAUDE.md. Two consequences: the live adapter now fetches the largest thumbnail
(high 800px → medium → default) instead of the 88px default, and **the holo/glare finish is
layered below the avatar** (`.avatar-stage` sits above the finish) so a real creator's face is
never colour-shifted by the effect. The frame and finish still do the heavy lifting; the
avatar is protected art, like the clear window on a physical trading card.

**UR's finish is a molten sheen + a smouldering ember, not a flowing colour sweep.** The
first WP3 pass gave UR a constantly-scrolling rainbow background; it read as distracting and
made the SSR diamond's rainbow out-shine the top tier. Replaced with: a warm gold→crimson
holo (distinct from SSR's cool rainbow, so UR doesn't compete on the same axis), a bi-metal
red+gold bevel, a warm glare, and a slow irregular **ember flicker on the frame glow only**.
Motion is gated to `prefers-reduced-motion: no-preference`; reduced-motion gets the static
frame. Interior intensity is deliberately lower than the edge so the centre never overwhelms.

**Card inspector: click a collection card to admire it large.** A centred overlay over a
blurred backdrop shows one enlarged card with the same tilt/holo enabled (so it can be turned
in the light). It reuses `renderCard` — the container-query sizing means the big card needs no
special styling. Closes on button / backdrop / Escape and restores focus. Kept out of the
reveal overlay, which has its own flip.

**Reveal column count is pinned in JS, not left to `auto-fit`.** A x10 reveal alternated
between 5-wide and 4-wide because a vertical scrollbar stealing ~17px could reflow the grid,
and each layout was self-stable. `reveal.js` now sets `--reveal-cols = min(cards, 5)` and the
grid uses `minmax(0, 148px)` columns, so cards shrink a hair rather than dropping a column —
the scrollbar can no longer change the count. A x1 is a single centred card.

**Dev Pull is a testing affordance, explicitly not a game mechanic.** A green "Dev Pull"
button fires a 10-pull seeded with one card of every rarity present in the pool, then filled
with normal weighted pulls, so every tier's treatment shows in one reveal while tuning
visuals. It must be gated (`?dev`) or stripped before the real-users build; it never changes
the published drop rates.

**Throwaway HTML sandboxes removed.** The scraped YouTube page dumps (`mkbhd.html`,
`yuntaku.html`, `yuntaku-about.html` — ~5 MB of third-party page source at the repo root) and
the hand-built `card-prototype/` mock-ups are deleted now that the real cards render in the
app. Each was single-use: the scrapes gave stat numbers for hand-prototyping (never the
pipeline — the live adapter always used the API), the prototypes proved the frame/finish look
(now generalized across all five bands in WP3). References to them in the entries above are
historical. Removing them shrinks the repo and drops the committed third-party HTML.

**WP4 app-side: card sets are a third adapter behind the seam, surfaced as a "Sets" banner
mode.** `data/sets.js` splits like the rest of the codebase — `parseSet` is pure and validated
(8 new tests), `loadSet` is the thin fetch wrapper. A set is the envelope
`{ slug, title, series, snapshotDate, channels[] }`; every channel is the exact Channel shape
demo/live emit, so the gacha, reveal, render and collection code took **zero** changes to
consume a set — the seam's whole point, demonstrated. Sets appear as a **third mode
(Demo | Sets | Live)** rather than folding demo into a set-picker: the smaller, incremental
change, chosen over the earlier "demo becomes the starter set" reframing (which stays open for
later). The picker is populated from a `sets/index.json` manifest that `build-set.js` will
maintain.

**Demo folded into a bundled starter set; two modes remain (Sets | Live).** This closes the
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

**The first set ships with fictional channels, not real creators.** `sets/sample-series.json`
("Arcade Legends") is eight invented channels spanning every rarity (N→UR). It proves the
adapter, picker, and rarity spread without committing any real creator metadata while the
YouTube API storage / likeness questions are still being clarified with Google. `build-set.js`
will emit the identical shape from real channels once that clears — no app code changes. Sets
are keyed on the immutable UC id (handle is display-only), so a set is handle-change-proof and
self-heals its display fields on each monthly re-snapshot; a UC id that 404s on refresh
(deleted/terminated channel) must be dropped or flagged, never shipped as a broken card.

**Local-dev API-key convenience: a gitignored `config.local.js`.** So live mode needn't have
the key re-pasted on every reload, `banner.js` dynamically imports `config.local.js` and
pre-fills the field if it exports `YOUTUBE_API_KEY`. The import rejects harmlessly when the
file is absent — which is every deployment, so the shipped app still has no key and no such
file, and the memory-only guarantee to players holds. The file is gitignored via an explicit
`config.local.js` entry (its name doesn't match the pre-existing `*.local` rule). Working and
rationale notes (external LLM dumps, the static-sets-vs-backend case) live in a gitignored
`external-docs/` and are deliberately not part of the repo.

**The pull is two-stage: pick a rarity band by weight, then a card inside it uniformly.**
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

**The banner shows computed odds, not the raw weight table.** Now that the weights are true
percentages, the rates line reads "Drop rates — N 55% · R 27% · …", recomputed from the current
pool on every render so it reflects the renormalization above. The old "Pull weights per
channel — N 55 · R 27 · …" was written once at init and, under the old engine, was not the odds
a player actually faced.

**`core.js` + `gacha.js` moved to `src/engine/`; the tree is organized by what a module may
touch, not by topic.** The existing folders already encoded that rule — `data/` is what touches
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

**Sets mode shows the pool's composition; only Live enumerates it as chips.** The banner
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

**Chip names truncate at 18ch with the full title as a tooltip.** Real channel titles run long
and CJK titles longer still; a single seven-channel Live banner containing
`TVアニメ『ヤニねこ』公式【ハメちゃんねる】` already wrapped the row onto a second line. The name
now ellipsizes and carries a `title` attribute, so nothing is lost.

**Card titles wrap anywhere; the 2-line clamp does the truncating.** The same live testing showed
`TheBackgroundNPC` sheared to "TheBackground" on the card face. The suspected cause was the
`-webkit-line-clamp: 2` failing on long/CJK titles — devtools disproved that: computed
`line-clamp` reads `2` and every title measured one or two lines (13px / 26px against a 13.2px
line box), so the clamp was working. The actual cause was horizontal: a single unbreakable word
has no break opportunity, so it overflowed `.card-name` and `overflow: hidden` cut it mid-word
with no ellipsis. Fixed with `overflow-wrap: anywhere`, which also lets the box shrink to
min-content inside its `min-width: 0` flex parent — so the clamp, not the clip, decides what is
dropped. Worth recording that the first diagnosis was wrong: the visible symptom (a title
looking too tall) pointed at the vertical mechanism, and only measuring ruled it out.

**Magic Search draft 1: the pure discovery engine, without the live fetch.** `src/engine/discover.js`
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

**Legality is out of scope during the build phase; resolved before deploying to real users.**
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

**Magic Search runs in the browser too, as a dev trigger — the fetch layer is environment-neutral.**
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

**Discovery runs accumulate into one draft set; a gitignored local manifest surfaces it in the
picker.** `tools/magic-search.js` merges each run into `sets/magic-search.draft.json`, deduping across
runs by UC id, so repeated searches grow the pool instead of overwriting it — the file is the first,
simplest form of the candidate DB the three-tier design calls for (store and rendered set collapsed
into one file for the draft; they separate later). `--fresh` starts over. To view the draft without
hand-editing the committed `sets/index.json`, the tool also maintains a gitignored
`sets/index.local.json`, and `banner.js` reads it **only on localhost** (self-disabling in
production, same spirit as `config.local.js`) to append generated drafts to the Sets dropdown. Both
`sets/*.draft.json` and `sets/index.local.json` are gitignored, so no real creator data and no
local-only pointer is ever committed.

**Card and chip avatars survive YouTube's hotlink 403s: `referrerpolicy="no-referrer"` + a monogram
fallback.** Google's avatar CDN inconsistently rejects hotlinked images by referer, so some real
channels' avatars loaded and others 403'd — invisible until Magic Search rendered a batch of real
channels at once. The visible `<img>` had no referrer policy and no error handling, so a blocked
image left an empty ring. Fix: set `referrerpolicy="no-referrer"` on the card avatar, the
accent-sampling image, and the pool chips so Google stops blocking; and on a genuine load failure,
remove the image so the faint monogram behind shows as the intended fallback instead of a
broken-image glyph. A pre-existing render bug across all sources, not a Magic Search one — discovery
just surfaced it.

**Vitest pool pinned to a single fork.** The default `threads` pool intermittently failed worker
init on this setup (Windows / Node 24) with a "Cannot read properties of undefined (reading
'config')" race at collection — 0 tests run, all files reported "failed" — and it recurred even with
`forks` and serial files. `vitest.config.js` now pins `pool: 'forks'` with `singleFork: true`, so the
whole suite runs in one worker with no spawn race; six consecutive `npm test` runs passed 113/113. It
is dev-only config — the shipped app still has no build step — and the ~1.5s single-process runtime is
fine for a suite this size. Recorded because it closes the "zero-config Vitest" default the repo ran
on until now.

**Addendum (2026-07-25): the Vitest 4 upgrade silently un-did the fix above.** Vitest 4 removed
`poolOptions`, which is where the serialization lived. It did not error — it printed a deprecation
line and ignored the option — so `singleFork: true` stopped applying and the collection race returned
at roughly one run in two ("no tests", all files failed, `import 0ms`). The replacement is the
top-level `fileParallelism: false`, which forces workers to 1; `singleFork` no longer exists anywhere
in the package. Six consecutive runs pass 119/119. Worth recording as its own line because the failure
mode is the dangerous kind: a config option that stops existing is indistinguishable from one that
works, unless you read the deprecation notice the runner prints on every single run.

**Discovery excludes self-declared Indian creators — a leaky local-risk hedge.** The operator is
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

**Exclude-giants is a per-query lever, not a global rule.** WP6 adds `maxSubs` to the discovery
floor, because a generic keyword is dominated by a handful of enormous channels and those are both
the ones already in the pool and the ones with the most standing to object. It defaults to
`Infinity` — OFF — which looks timid until you line it up with `assignPool`: the `legends` tier is
defined as 5M+ subs, so a global ceiling below that would permanently empty a pool the three-tier
sourcing depends on. Both live callers opt in at 2M (`MS_MAX_SUBS=0` lifts it in the CLI). The
knob is named inside `floor`, which now describes a band rather than a floor; kept for its callers
rather than renamed. Closes off "just cap subscribers globally", which would have silently starved
the legends pool.

**The Magic Search keyword vocab is hobby/craft topics only.** The generator is seed × modifier
(64 × 18 = 1152 queries), and the seed list is deliberately confined to crafts, skills and hobbies —
woodworking, field recording, bonsai — with no news, politics, drama, or anything keyed to a real
person's name. Two reasons, one practical and one not: mid-sized on-topic creators actually live in
those niches, which is the pool the sourcing is short of; and every result becomes a card carrying
someone's likeness, so the vocab is the cheapest possible place to keep the feature away from
subjects where that is least defensible. Closes off "generate keywords from trending/broad topics",
which maximises reach in exactly the direction the project has been steering away from.

**WP6 was mostly switching on what WP5 already built.** `buildSearchParams` shipped in WP5 with
full order jitter and a slid publication window, injected rng and all — and then both live callers
(`ui/banner.js` MS_OPTS, `tools/magic-search.js` DETERMINISTIC) pinned `windowDays: null,
orders: ['viewCount']`, so none of it ran. Recorded because the engine being "done" and the feature
being live are separate facts, and the checklist read as though the first implied the second. The
per-query jitter is also not sufficient on its own: a fixed query list keeps finding the same corner
of YouTube however hard each query is randomized, which is what the keyword generator is for.

**The name "YouTube Gacha" ships as-is for the private build; renaming is deferred to launch.**
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

**Trigger: this must be resolved before WP11 deploys to real users**, alongside the legality gate.
Pre-scoped so it is not a research task later — the name lives in `index.html` (`<title>`, `<h1>`),
`src/ui/reveal.js` (the card back wordmark reads "YOUTUBE GACHA"), `package.json` + lockfile `name`,
README / CLAUDE.md / PLAN.md, and the GitHub repo name + the Actions badge URL in the README.

Also noted, because they compound rather than stand alone: the red palette, the `play-glyph` in the
`<h1>` and the red play triangle on the card back (`.back-play`) point the same direction as the name.
A play triangle alone is a generic media symbol; red + play button + the mark together is what reads
as affiliation. Dropping the name weakens the rest considerably, so the name is the high-leverage fix.

**Superseded: the name is now "Creator Gacha".** The entry above deferred this to launch; Ash closed
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
Still outstanding and Ash's to do, since it touches their account and the CI badge path must match the
real repo: renaming the GitHub repo from `youtube-gacha-card-game` and updating the badge URL in
README.md. Also unchanged: the red palette, the `play-glyph` and `.back-play`'s red triangle — flagged
earlier as compounding signals, now much weaker without the mark carrying them.

**Creator Gacha first; Repo Gacha parked, not rejected.** `external-docs/repo-gacha.md` proposes the
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
- Emblems (WP13) are shared infrastructure between the two, since RG cannot use project logos either.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
