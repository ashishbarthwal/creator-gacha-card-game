# WP-V2 UI Overhaul

**Completed:** 2026-09-21
**Live:** [creator-gacha.pages.dev](https://creator-gacha.pages.dev/)

> This is the V2 redesign record. The 2026-09-28 closeout below records the follow-up polish and
> current responsive behavior. The README screenshots are refreshed desktop captures from that
> final pass.

## Outcome

Creator Gacha V2 replaced the generic purple landing page with a crafted editorial interface, faster pack and reveal loop, and an immediate view of possible pulls. Follow-up polish established the green-and-sand palette and tightened phone behavior. Card-face rendering remains shared across the site.

## What shipped

- Reworked the page shell, typography, spacing, controls, collection area, arena chrome, and modals around a dark olive and deep green base, sand pull stage, and coral accent.
- The first-visit hero shows five featured cards on desktop and four on phones: MrBeast (RUBY), Cristiano Ronaldo (UR), Taylor Swift (UR), Rihanna (SSR), and Addison Rae (SR), when present in the active set. All featured cards open in admire mode.
- After a banked pull, desktop shows **Your Most Followed Cards** and **Your Battle Leader Cards**, ranked from the local collection. Phones keep the original “Who will you pull next?” hero and show the collection below; rankings are desktop-only.
- Added visible ten-card odds beside the hero title. RUBY is 0.51162% per draw, which gives a 5% chance of at least one RUBY in ten independent draws. The other displayed values are cumulative ten-card chances, not per-card rates.
- Rebuilt the pack control as a compact three-card stack with the pull action in its centre. Hover fans the stack; tapping the centre opens the selected one-card or ten-card pull.
- Shortened and simplified the reveal sequence while retaining rarity order, card arrival, and card-specific finishes. The pre-reveal shine/outline cue and its obsolete blurred cone layer were removed from desktop and phone.
- Added empty-space dismissal after a completed reveal. On phones this returns to the same scroll position, keeping repeated pulls convenient.
- The collection nudge runs only after a new player's first pull; later pulls do not auto-scroll. The header no longer repeats the local-save status, and the retired development roadmap/duel footer notice was removed.
- Preserved and normalized premium finishes across surfaces. RUBY keeps its brighter gem treatment and thinner standard frame. UR and RUBY share the same four-point star language on desktop and touch; UR uses an eighteen-star field and RUBY uses nine.
- Added a subtle UR ultraviolet corner sheen. In admire mode its first pass starts 300 ms after opening, then visits shuffled corners at randomized one-to-two-second intervals. Reduced-motion mode disables it.
- Kept touch cards on the same dark resting face as desktop instead of applying a static holo wash.
- Added reusable dialog focus handling, keyboard activation for showcase cards, responsive layouts, and reduced-motion fallbacks.
- Added repeatable development and non-banking Showcase 10 presentations plus the supplied
  project screenshots.

## Architecture and maintenance

- [`FRONTEND-ARCHITECTURE-05-09-2026.md`](FRONTEND-ARCHITECTURE-05-09-2026.md) and [`BACKEND-ARCHITECTURE-05-09-2026.md`](BACKEND-ARCHITECTURE-05-09-2026.md) record the system boundaries reviewed before the overhaul.
- [`HERO-SHOWCASE-ARCHITECTURE.md`](HERO-SHOWCASE-ARCHITECTURE.md) records the first-visit versus returning-player state model and ranking rules.
- `src/ui/hero-showcase.js` owns the two homepage states. `src/engine/showcase.js` keeps selection and ranking logic headless.
- `src/ui/stars.js` owns premium star-field construction. Surface modules attach the same field rather than implementing device-specific variants.
- `src/ui/reveal.js` owns the bounded reveal and dismissal behavior. `src/ui/dialog.js` owns shared focus containment and restoration.
- `src/ui/inspect.js` owns admire-only timing such as the delayed, recurring UR edge sheen.

## Verification

- `npm test`: **24 files, 632 tests passed** (verified 2026-09-28).
- `npm run build:site`: production site assembled successfully with no drafts, development manifests, or country fields.
- Automated Chromium checks passed at **1440 x 1000 desktop** and **390 x 844 touch phone** sizes.
- Browser checks cover first-visit and returning-player states, showcase admire access, pull/reveal completion, collection rendering, premium star parity, the delayed UR sheen, the RUBY cone regression, reduced motion, mobile scroll preservation, console errors, and horizontal overflow.
- The final build was deployed and re-verified through the production domain. The live page remains the reference for the current visual appearance; the committed screenshots are earlier captures.
