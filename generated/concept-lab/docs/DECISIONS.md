# How the decisions were reached

> **History (11 November 2026).** Superseded by [`docs/visual-system.md`](../../../docs/visual-system.md), which says what is current. Kept as the record of how it was reached; read its claims about taste as observations from a small sample, not rules.

*The agreements as they finally stand, topic by topic. Only the back-and-forth worth remembering is kept. The verbatim answers are in `docs/owner-answers/`, and the per-piece status is in `LEDGER.md`.*

## Camera

- **Agreed:** "Follows direction", rider at about 38 % height, 15 % closer, steady zoom; the whole course at both ends.
- **How we got there:** the camera may never fake the rider's motion. It was the first complaint, about a look-ahead camera that made the rider seem to climb (R1). The owner relaxed this to "not a showstopper" (R2). Then:
  - **Tamed** beat Calm clearly (R3). Its vertical offset saturated on descending stretches, so a real 60° dive at Los Voltaje 28.5 s "didn't feel like going down" (R5).
  - **A narrow "steep rides drop" rule** fixed the dive but made the rider climb back during descents.
  - **The generic rule:** height follows the slope, and the rider never rises on screen while descending. False climbs went from 1.8 s a minute (Tamed) to 0 (R6, measured by `camstats.mjs`). "Great job."
  - **Height** is a separate setting from the behaviour (R6). The question was skipped, so it stays at 38 %.
- **Worth remembering:**
  - Your exact moments must be in the question. A camera question without the moment discussed (Los 28.5 s) was rightly criticised (R6).
  - A world-fixed paper grain was tried as a motion cue and dropped: "will look bad with YouTube encoding" (R6).

## Hits

- **Agreed:** each hit on its own, at its strongest frame (R23), driven by its measured strength (never the spec's ask, never a rank).
  - **Shake:** nothing below strength 0.6, then an S-curve (like the old flash's) to 24 px at 0.85, and gently on; no camera motion otherwise (R26; before, a shake on every hit, straight from 0.2).
  - **Split:** halfway between sideways and the hit's direction, a slow start from 0.3 to 12.8 px at 0.85, no ceiling, over the whole picture with its zoom pulse. The title gets a little less split and less pulse; the sun gets everything.
  - **Colour boost:** what is drawn on the paper gets more saturated and more contrasted for an instant, the paper unchanged; from 0.35, full at 0.85 (saturation +45 %, contrast +38 %), gently on. It replaced the flash toward the paper (R24–R26).
  - **The rider** keeps half its clean image through the split.
- **How we got there:**
  - **The old approach was capped:** a top-N strongest-hits rule was rejected early (R1). The owner wants effects to "adapt to the actual values" (R5).
  - **What today's recipe really is:** Held won in whole songs (R5), but the biggest hits lacked today's "oh yeah". Reading the shipped recipe (R7) showed it isn't a top-10 % gate at all. Almost every hit counts and piles up, so an ordinary hit already reaches full force. That explained the gap.
  - **The parts:** the hits were rebuilt as separate parts (shake, split, flash, driver), each compared with the others held at today's (R7). The owner chose each hit on its own (R7), the thud (R9), the halfway split (R9) and a flash toward the paper (R8).
  - **Sizes:** chosen from response curves drawn before motion (R12–R17). Straight lines from zero, no ceilings ("if there's a very rare, very powerful hit, let's go for it"), and a flash that doesn't reach 50 %.
- **Worth remembering:**
  - **Fairness.** The hit-direction split looked "way more prominent" because it crosses the lines while today's runs along them. It was measured and matched to today's average fringe (`splitmeasure.mjs`, R8). The lab also wrongly split the band; production splits the ride only.
  - **Misunderstandings cost rounds.** "A little less impact" meant the title moving, not the shake (R16–R18). The title's movement came from the split's overscan zooming the whole picture about 3 %, which nobody designed. The fix kept the pulse everywhere except the title (R19).
  - **"Today's" in the lab was a copy of the June recipe**, not the shipped renderer. Both were deleted on 8 November, when the lab's renderer became production's.

## Colour

- **Agreed:** palettes come from Sanzo Wada's *Dictionary of Color Combinations*, plus our loved ones, assigned to roles with the rules in `docs/THEME-CRAFT.md`. A tiered library is the pool for themes.
- **How we got there:**
  1. **Hand-picked palettes (R4–R5):** graphite, Hokusai, Black and Dune were loved; Riso was weakest; the owner values clarity.
  2. **Palettes generated from a lightness measure (R6):** "good, not coup de cœur", all near-black lines. A weak measure had narrowed creativity.
  3. **Palettes designed from scratch by an independent helper (R7):** more character; "we need to work on backgrounds".
  4. **Paper-only studies (R8–R9):** found that the bars must carry more colour than the paper, and that it's "the entire theme as a whole".
  5. **Wada, the owner's idea (R10):** "a complete game-changer… one or two orders of magnitude better". The second pass (R11) found that a pale paper must differ in hue from its bars.
- **Worth remembering:** a measure is a check, never a generator. "No point trying to understand the patterns any more… let's just try stuff" (R11), and keep the tiers for the library.

## Line, band, top, drop

- **Line:** pencil → ink since R1 ("absolutely amazed"). The grey leftovers were fixed by inking rails as the rider passes (R5). Whole rail and all ink are alternatives; Old Rose uses all ink.
- **Band:** bars with the loudest in red, low-middle. The fork, Iris and Three colours stay in the pool (R6).
- **Title:** in the line's colour, "tremendous"; two lines at most (R5); optional (R6). The line passes behind it.
- **Sun:** an element of its own, never part of a palette (R6). Midnight's moon was bad.
- **Drop:** Night is loved. The scheme switch is loved as an idea (R6). Cues are placed by hand from the spec's sections (R20: Circus Minimus, hook to re-entry).

## How we work: the lessons that changed the process

- **R6:** a misaligned round. 4K four-ups were used to ask questions; there were several variables per comparison and process over substance. Comparisons went back to the switcher, one variable each, labelled on the picture.
- **R8:** voting broke on option names containing commas. A full interaction audit followed, with 18 fixes and an automated suite of 82 checks that runs before every round.
- **R12:** an independent check of every settled default against the whole history found five real gaps.
- **R20:** watching a whole film again, after many rounds on loops: "this is the coolest thing I have ever seen". Whole films decide.
