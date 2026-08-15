> **VERBATIM SOURCE DOCUMENT — Ash's brief, handed over 2026-08-15, kept word for word.**
> Everything below the next divider is Ash's own text, unedited. It exists as a repo file
> rather than only living in DECISIONS.md's paraphrase because the challenge-flow rework
> (items 8-14, 32, 37) depended on exact wording — screen copy ("CONTINUE"/"CHICKEN OUT"), the
> `00:30` timer mockup, the flow diagrams — that a summary would lose, and stayed useful as the
> reference to build against even after that work started. **Every item in this brief, including
> 8-14/32/37, was implemented and tested the same day** (in two passes — items 1-7, 15-27, 33-35
> and the wire-format half of item 9 first, then 8-14/32/37 in a follow-up); see TASKS.md's
> "Now:" section for current status, its manual two-window test checklist (this work has not
> been verified with two live browsers), and DECISIONS.md's 2026-08-15 entries for the reasoning
> behind what shipped. This file remains the spec worth checking screen copy against; the other
> two are the record of what was actually built.

---

# Creator Gacha — Final Balance, Auto Select & Fair Battle System

## Core Design Philosophy

Creator Gacha is fundamentally a **fun, luck-driven creator collection game with light strategy**.

The game should reward:

* pulling famous creators
* getting lucky with rare cards
* having a large collection
* making simple team decisions
* recognizing obvious counters

It should NOT become a hardcore deck-building or optimization game.

The intended feeling is:

> "I pulled a huge creator. That's awesome."

followed by:

> "Their team is mostly Tech. I'll bring Gaming."

then:

> "Let's battle."

Strategy should matter, but the game should remain casual, unpredictable, and fun.

---

# 1. Subscriber Count Must Be More Powerful

Subscriber count should have a much stronger influence over a card's baseline combat power than it currently does.

A player who pulls an extremely famous creator should immediately feel that the pull matters.

Conceptually target:

* **Subscriber-derived power: ~65–70%**
* **Stat distribution/card shape: ~20–25%**
* **Class/element/tactical factors: ~10–15%**

These are design targets rather than necessarily literal formula percentages.

The important result is:

> A substantially more popular creator should generally be a substantially stronger card.

However, subscriber count does not guarantee victory.

A smaller creator can still win through:

* element advantage
* class abilities
* formation
* speed
* momentum
* luck

---

# 2. Rarity Must Feel Valuable

Rarity is a major part of the gacha fantasy.

Pulling an SSR or UR should feel exciting and meaningful.

A high-rarity card should not become worthless because another lower-rarity card happens to have slightly better synergy.

A UR should feel like a UR.

An SSR should feel like an SSR.

The game should preserve the excitement of rare pulls.

---

# 3. Subscriber Power Floor

Extremely famous creators should have a soft minimum power floor.

A famous creator should not become an absurdly weak card simply because their randomly distributed stats happen to be poor.

The purpose is not to make famous creators unbeatable.

It is to prevent situations where:

> "I pulled one of the biggest creators in the game and somehow this card is garbage."

---

# 4. Auto Select Must Respect Rarity

Auto Select is intended to be a **fun convenience feature**, not a mathematical optimizer.

It must NOT casually skip an SSR or UR because a lower-rarity card has marginally better calculated synergy.

For example:

> UR + mediocre synergy

should generally be preferred over:

> N + slightly better synergy.

Likewise:

> SSR + neutral element

should generally remain preferable to:

> R/N + favorable element

unless the difference is genuinely substantial.

The player should look at Auto Select and think:

> "Yeah, that makes sense."

not:

> "Why the hell did it bench my UR?"

---

# 5. Auto Select Priority

Use a simple hierarchy:

1. Overall card power
2. Rarity
3. Subscriber-derived power
4. Basic class diversity
5. Obvious elemental advantage
6. Formation

Lower-level optimization must NOT completely override a significantly stronger card.

Auto Select should generally choose:

> **The strongest, coolest, most obviously valuable five cards, then make sensible adjustments.**

It should not attempt to discover a perfect meta team.

---

# 6. Manual Selection Is Always Free

Players can always ignore Auto Select.

They may use:

* five URs
* five N cards
* favorite creators
* meme teams
* weird class combinations
* whatever they want

The game should never tell the player that their team is "wrong."

---

# 7. Keep Class and Element Strategy Simple

Classes remain:

* Titan → Taunt
* Carry → Execute
* Bulwark → Aegis
* Assassin → Backstab
* Riser → Snowball
* Balanced → Adaptive

Existing class diversity bonuses remain:

* 4 classes → +2.5%
* 5 classes → +5%

These bonuses should stay relatively small.

The abilities themselves are the main reason to care about classes.

Elements remain:

* Advantage → +25% damage
* Disadvantage → -20% damage
* Neutral → no modifier

The player should be able to understand the counter system quickly.

This is **light strategy**, not a competitive deck-building simulator.

---

# 8. Remove Challenge-Building Asymmetry

## Current Problem

Previously:

1. Challenger builds their five.
2. Challenger locks their team.
3. Challenger sends the challenge code.
4. Opponent accepts.
5. Opponent builds their team afterward.

This creates unnecessary asymmetry.

The challenger effectively commits to their strategy before the opponent even enters the battle.

---

# 9. Challenge and Deck Building Are Separate

A player should be able to generate and send a challenge **without building their team first**.

The challenge means:

> "I want to battle you."

not:

> "Here is the exact team I have already committed to."

---

# 10. Optional Pre-Building

The challenger can still build their team before sending the challenge.

This is intentionally allowed.

Two playstyles are supported.

### Fair / Casual

Send challenge immediately.

Wait for acceptance.

Both players then build their teams together.

### Cocky

Build a team first.

Send the challenge.

Once accepted, the prepared team is already there, but remains editable until the player presses READY.

This lets players essentially say:

> "I'm not even worried about what you bring."

---

# 11. Accepted Challenge = Shared Preparation Phase

Once the opponent accepts:

**Both players enter the team-building screen simultaneously.**

Both receive the same preparation time.

Neither player is disadvantaged because they were the challenger.

---

# 12. Live Shared Timer

Use a live countdown during preparation.

Suggested starting duration:

**30 seconds**

Example:

```text
TEAM BUILDING

00:30
```

Both players see the same timer.

Tune the exact duration after playtesting.

---

# 13. Ready Button

Both players receive:

**READY**

Once pressed:

* their team becomes locked
* they can no longer modify it
* the other player can continue preparing

If both players press READY:

> **Immediately start the battle.**

Do not make them wait for the remaining timer.

---

# 14. Timer Expiration

When the timer reaches zero:

Any player who has not pressed READY is automatically locked into their current team.

Then the battle begins.

This prevents stalling.

---

# 15. Collection Size Fairness

## Problem

Players can pull indefinitely before a battle.

This creates an extreme selection advantage.

Example:

**Player A**

10 cards

**Player B**

150 cards

Player B can otherwise search through 150 cards and manually select the five strongest.

The goal is NOT to punish the player for collecting.

The goal is to prevent:

> **A dramatically larger collection from becoming an unlimited battle-team search engine.**

---

# 16. Maximum Fair Collection Ratio

For the purposes of a battle, the larger collection should be allowed to retain a maximum of:

## 1.5× the smaller player's collection size.

This is the core balancing rule.

Let:

```text
smallerCollection = minimum of both collections

allowedLargerCollection =
    smallerCollection × 1.5
```

Round appropriately to a whole card.

---

# 17. No Adjustment Within 1.5×

If the larger collection is no more than 1.5× the smaller collection:

**Do nothing.**

Examples:

### 10 vs 12

No adjustment.

### 10 vs 15

No adjustment.

### 40 vs 48

No adjustment.

### 40 vs 60

No adjustment.

The player keeps their entire collection available for battle selection.

A small collection difference is not a problem.

---

# 18. Shedding Starts Above 1.5×

If the larger collection is more than 1.5× the smaller collection:

**Temporary battle-only shedding begins.**

Example:

### 10 vs 150

Maximum allowed:

`10 × 1.5 = 15`

The 150-card player receives a temporary battle pool of:

**15 cards**

The other player keeps their:

**10 cards**

The final battle is still:

**5v5**

The smaller player's entire collection remains available.

The larger player simply cannot browse all 150 cards for this particular battle.

---

# 19. Shedding Is Temporary

This is extremely important.

**The player's actual collection is NEVER altered.**

The game only creates a temporary battle-eligible subset.

After the battle:

> All cards return to the player's normal collection.

No cards are deleted.

No cards are permanently removed.

No progression is lost.

---

# 20. Notify the Larger-Collection Player

The larger-collection player must be clearly informed before entering the battle.

Example:

```text
COLLECTION SIZE

Your collection: 150 cards
Opponent collection: 10 cards

Your collection is more than 1.5× your opponent's.

For this battle, your eligible collection will be
temporarily reduced to 15 cards.

Your full collection will NOT be affected.
```

Then give them the choice:

### CONTINUE

Proceed with the temporary battle pool.

### CHICKEN OUT

Cancel the challenge/match before the battle begins.

Do not use additional humorous alternatives.

The only humorous option should be:

**CHICKEN OUT**

This is intentionally funny and gives the larger-collection player an escape hatch.

---

# 21. The Smaller Player Does Not Need to See This

The collection-shedding explanation is primarily for the larger-collection player.

The smaller player does not need to be told:

> "Your opponent is being nerfed."

The smaller player should simply proceed with the normal battle preparation.

This keeps the battle UI cleaner and avoids making the smaller player think about invisible balancing rules.

---

# 22. Semi-Random Shedding

The larger player's temporary pool should NOT be generated through pure uniform randomness.

Pure randomness could produce absurd results such as:

> 8 N cards survive
> every UR/SSR disappears.

That would make the player feel punished for pulling good cards.

Instead, use **rarity-weighted semi-random shedding**.

The general principle:

> **Lower-rarity cards are much more likely to be shed.**

Higher-rarity cards are progressively protected.

---

# 23. Rarity Protection

The shedding system should guarantee that the larger player's temporary pool retains at least:

* **1 UR**
* **1 SSR**
* **1 SR**

when those rarities exist anywhere in their collection.

This should be communicated explicitly.

Example:

```text
YOUR TEMPORARY BATTLE POOL

You will retain at least:
✓ 1 UR
✓ 1 SSR
✓ 1 SR

Remaining cards will be selected through
rarity-weighted random shedding.
```

This is important for player psychology.

The player should never think:

> "I spent all this time collecting and my UR just disappeared."

---

# 24. If a Protected Rarity Does Not Exist

Do not invent cards.

If the player has:

* no UR → no guaranteed UR
* no SSR → no guaranteed SSR
* no SR → no guaranteed SR

The guarantee only applies to rarities actually present in the collection.

Example:

A player owns:

`3 UR, 10 R, 20 N`

Their temporary pool guarantees:

**at least 1 UR**

There is obviously no SSR or SR to preserve.

---

# 25. Ruby / Highest-Tier Special Rarity

Ruby cards may be omitted from the minimum protection rules.

Ruby is intentionally allowed to be lost during shedding because it provides an unusually large advantage.

Ruby should still have a lower shedding probability than ordinary low-rarity cards if appropriate, but it does NOT receive a guaranteed retention slot.

The philosophy is:

> **UR / SSR / SR should be protected to preserve the fun of collecting. Ruby is powerful enough that it can remain vulnerable.**

---

# 26. Bottom-Heavy Shedding Distribution

The selection algorithm should be heavily weighted toward shedding weaker cards.

Conceptually:

**N → highest chance of shedding**

**R → high chance**

**SR → moderate chance**

**SSR → low chance**

**UR → very low chance**

**Ruby → can be shed**

Do not make the exact probabilities unnecessarily complicated.

The goal is simply:

> **The larger collection should retain a representative set of its strongest cards while still losing a meaningful amount of lower-tier clutter.**

---

# 27. The Larger Collection Should Still Have an Advantage

Do NOT make the shedding system so aggressive that a 150-card player becomes equivalent to a 10-card player.

The larger player genuinely collected more cards.

They spent more time and/or resources.

They should ultimately have **better odds of winning**.

The purpose of the system is only to stop:

> "I own 150 cards, therefore I can always pick the perfect five."

The larger player's advantage becomes:

> **Their temporary 15-card pool is likely to contain stronger options than the smaller player's 10-card collection.**

That is desirable.

The system should compress the advantage, not erase it.

---

# 28. Extreme Example: 10 vs 150

### Player A

Collection:

`10 cards`

Battle access:

`10 cards`

### Player B

Collection:

`150 cards`

Maximum battle pool:

`15 cards`

Player B receives a rarity-weighted semi-random temporary pool.

At minimum, if available:

* 1 UR retained
* 1 SSR retained
* 1 SR retained

Lower-rarity cards are more likely to be shed.

Both players then enter the normal simultaneous team-building phase.

Each chooses:

**5 cards**

Then the battle begins.

---

# 29. Example: 40 vs 100

Smaller collection:

`40`

Maximum allowed larger pool:

`60`

Because:

`100 > 60`

the larger player is temporarily reduced from:

`100 → 60`

The 40-card player remains at:

`40`

The larger player's pool retains protected high-rarity cards and sheds lower-rarity cards more aggressively.

---

# 30. Example: 40 vs 55

Ratio:

`55 / 40 = 1.375`

Because this is below 1.5:

**No shedding.**

Both players use their full collections for the preparation phase.

---

# 31. Example: 80 vs 100

Ratio:

`100 / 80 = 1.25`

No shedding.

This is considered a normal collection difference.

The larger collection does not need balancing.

---

# 32. Battle Selection Happens After Shedding

The temporary collection adjustment occurs **before the team-building phase**.

Flow:

```text
CHALLENGE
↓
OPPONENT ACCEPTS
↓
COMPARE COLLECTION SIZES
↓
IF >1.5×
    TEMPORARY SHEDDING
↓
SHOW BOTH PLAYERS THEIR BATTLE-ELIGIBLE COLLECTION
↓
SIMULTANEOUS TEAM BUILDING
↓
30-SECOND TIMER
↓
READY / READY
↓
5v5 BATTLE
```

---

# 33. Auto Build Still Works Normally

Auto Build operates on the player's **battle-eligible collection**, not their full collection when shedding is active.

This means:

If a player owns 150 cards but only 15 are temporarily eligible:

> Auto Build chooses from those 15.

It should still follow all Auto Select rules.

It should strongly respect:

* rarity
* subscriber-derived power
* famous creators
* overall card strength
* obvious class/element improvements

---

# 34. Auto Select Must Never Ignore an Available SSR/UR Casually

Within the temporary collection, the same rule applies.

If the temporary pool contains:

**UR LTT**

and several lower-rarity cards with marginally better synergy:

> Auto Build should still strongly favor LTT.

A rare pull should feel rare.

---

# 35. Collection Size Does Not Change Card Stats

Shedding must NOT modify:

* ATK
* DEF
* HP
* SPD
* MOM
* rarity
* subscriber count

Cards remain exactly what they were.

The only thing that changes is:

> **Which cards are temporarily eligible for this battle.**

---

# 36. Preserve Luck

The battle should retain its inherent variance:

* ±25% luck swing
* critical hits
* second actions
* momentum
* class abilities
* element advantage

Do not remove randomness just to make the game perfectly deterministic.

A weaker team occasionally winning is part of the game's appeal.

---

# 37. Final Battle Flow

The complete intended flow is:

```text
PLAYER CREATES CHALLENGE
        ↓
BUILD TEAM NOW?
   YES / NO
        ↓
SEND CHALLENGE CODE
        ↓
OPPONENT ACCEPTS
        ↓
COLLECTIONS COMPARED
        ↓
IF ONE IS >1.5× LARGER
        ↓
LARGER PLAYER INFORMED
        ↓
KEEP 1 UR + 1 SSR + 1 SR
        ↓
SEMI-RANDOM SHEDDING
        ↓
CHICKEN OUT / CONTINUE
        ↓
BOTH ENTER TEAM BUILDING
        ↓
30 SECOND SHARED TIMER
        ↓
AUTO BUILD OR MANUAL
        ↓
READY / READY
        ↓
5v5 BATTLE
```

---

# 38. Desired Player Experience

### Small collection player

> "I only have 5 cards. These are my guys. Let's go."

Valid.

### Medium collection player

> "I have enough cards to make some choices."

Valid.

### Large collection player

> "I have 150 cards, so I probably have a stronger roster — but I can't just search all 150 for the perfect five."

Valid.

### Huge collection player

> "The game temporarily trimmed my battle pool, but it protected my best rarities and I still have more options than the other player."

Valid.

### Cocky player

> "I pre-built my team and challenged them."

Valid.

### Strategic player

> "I'll wait until the challenge starts and counter-pick."

Valid.

### Lazy player

> "Auto Build → Ready."

Valid.

---

# 39. Core Balance Hierarchy

The intended hierarchy is:

**Creator popularity + rarity**
↓
**Overall card power**
↓
**Collection quality**
↓
**Simple class / element decisions**
↓
**Formation**
↓
**Luck / combat variance**

This should remain a **light strategy game**, not a competitive chess game.

---

# 40. Final Design Principle

The philosophy behind the collection system is:

> **Collecting more should make you stronger, but owning a gigantic collection should not let you hand-pick the perfect five against someone who has barely started playing.**

A player who invested heavily in collecting should still have the advantage.

They simply cannot convert:

**150 cards**

directly into:

**"I choose the best five of 150."**

Instead:

**150 cards → temporary 15-card battle pool → choose 5.**

Meanwhile:

**10 cards → 10-card battle pool → choose 5.**

The larger collection remains an advantage.

The smaller collection remains viable.

And most importantly, **nothing the player actually owns is ever deleted or permanently altered.**

---

## Additional standing instructions given alongside this brief

- Don't say "Hints, for the curious" in the in-arena guide section header — use "Battle Guide"
  instead. (DONE — `src/ui/codex.js`.)
- "Tackle this however you like, break into tasks or whatever."
- Auto mode: full permission granted, do not stop mid-task to ask permission, keep executing
  until done or out of tokens.
