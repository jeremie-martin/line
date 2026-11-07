# Lab interaction audit (2026-11-07)

The audit agent's summary, saved by the main session because sub-agents can't write report files here.

- **Suite:** `uicheck.mjs` runs 82 checks at phone size (touch) and on desktop. All 82 pass. Run against the code before the fixes, 27 fail.
- **Rendering is unchanged:** 9 shot-mode frames on 4 songs, including hit parts and paper variants, hash identically before and after (checked by the main session).
- **Bugs found before the audit:**
  - shifting answer buttons;
  - a moment's palette override lost on option switch;
  - multi-choice picks stored as a comma-joined string, so any option with a comma in its name couldn't be selected.

## High (wrong data or wrong picture)
1. A swipe or the arrow keys dropped a moment's palette ("On Dune") while the picture's label still named it. The drawn look is now composed in one place.
2. Tapping a moment or Next while a ride loaded left the previous question's loop or option on screen. Stale loads are now ignored.
3. Drawing could crash if a song started loading mid-frame.
4. The summary couldn't tell option D "None" from "None of these". It now reads `D · None`, `B · … + C · …`, or `None of these`.
5. Picks saved by the old version showed no buttons selected while the summary still listed them. They are now read back.
6. In the blind test, a swipe or a key loaded a preset's look, and the address picked up `c=`/`m=`.

## Medium (taps landing wrong, labels that lie)
7. The fixed "← All rounds" link covered the picture's corner and any control scrolled under it. It now sits with the controls.
8. Answer buttons were 30×29 px; they are now at least 44×40. Double-tap zoom is off on controls, and note boxes are 16 px so iPhones don't zoom in.
9. Bench: Space or a tap on the picture started the music over the slow motion, the Play label stayed on "Pause", and the histogram showed the previous song's hits.
10. Turning the loop back on looped 4 s from the playhead instead of the moment's passage.
11. In dark mode, the chosen blind-test answer was unreadable.

## Low
- The active moment chip is highlighted.
- A reload returns to the same option and moment.
- Number keys pick options.
- "None of these" can be tapped off.
- The copy button label resets.
- The progress line never wraps.
- A scroll that starts on the picture is not a tap.

## Exaggerate slider
- **Range:** ×1–×4, on the shake question only (`exaggerate: true`).
- **On screen:** marked as a temporary viewing aid. The picture label shows `shake ×2.5 (exaggerated)`.
- **Scope:** it resets on the next question. Films ignore it unless the address has `?shakeX=`. The suite checks that `?shakeX=1` renders identically.
