# WP-V2 UI Overhaul

**Completed:** 2026-09-21
**Live:** [creator-gacha.pages.dev](https://creator-gacha.pages.dev/)

## Outcome

Creator Gacha V2 replaces the generic purple landing page with a quieter editorial interface, makes the pack and reveal loop faster, and gives a first-time player an immediate view of the cards they could pull. The collectible card layouts remain the shared card-rendering system; the work around them changes presentation, motion, discovery, and responsive behavior.

## What shipped

- Reworked the page shell, typography, spacing, controls, collection area, footer, arena chrome, and modal presentation around a dark neutral palette with a restrained red accent.
- Replaced the original landing copy with a first-visit showcase: MrBeast (RUBY), Cristiano Ronaldo (UR), Rihanna (SSR), and Austin Evans (SR). All four cards open in admire mode.
- After the first pull, replaced the showcase with **Your top cards**, split into **Most followed** and **Battle leaders** rows derived from the local collection.
- Rebuilt the pack control as a compact three-card stack with the pull action in its centre. Hover fans the stack; tapping the centre opens the selected one-card or ten-card pull.
- Shortened and simplified the reveal sequence while retaining rarity order, card arrival, and card-specific finishes. The pre-reveal shine/outline cue and its obsolete blurred cone layer were removed from desktop and phone.
- Added empty-space dismissal after a completed reveal. On phones this returns to the same scroll position, keeping repeated pulls convenient.
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

- `npm test`: **24 files, 628 tests passed**.
- `npm run build:site`: production site assembled successfully with no drafts, development manifests, or country fields.
- Automated Chromium checks passed at **1440 x 1000 desktop** and **390 x 844 touch phone** sizes.
- Browser checks cover first-visit and returning-player states, showcase admire access, pull/reveal completion, collection rendering, premium star parity, the delayed UR sheen, the RUBY cone regression, reduced motion, mobile scroll preservation, console errors, and horizontal overflow.
- The final build was deployed and re-verified through the production domain.
