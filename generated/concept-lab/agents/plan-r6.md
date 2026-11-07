# Round 6 plan (after the clarification answers, 2026-11-07)

Sources:
- the owner's round-5 answers (memory `concept-lab-round5-answers.md`, and the end of the transcript export);
- the clarification answers (`agents/clarify-answers-r6.md`);
- the step-back (`agents/step-back-r6/REPORT.md`), the code review (`agents/review-r6/REVIEW.md`) and the colour study (`agents/colour-r6/REPORT.md`).

All films are on the **recompiled rides**. The baseline every option must beat in a whole film: Paper, Hokusai and Black with Held.

## A. Biggest hits: the "oh yeah"
The owner says it is mostly the shake, but really all three together (shake, colour split, flash), only on the impact and brief. Today's version used a top-10 % gate, which they call "a terrible idea"; ours scales with absolute strength squared.

Options:
- **Held + shake:** three swings along the blow, 0.27 s.
- **Held + impact:** a stronger shake (four swings), with the split and flash also growing on the hardest hits. Everything is scaled by w², with w = e^2.2.

Four-up per song: Held | + shake | + impact | **Today (shipped)** as the reference feel, on Los Voltaje, Petrunko and Lua, the three songs with a shipped film. Today's film is an older ride with the same music, so it compares feel, not track. Punch and recoil stay in the lab.

## B. Camera: one generic rule, measured
The owner identified two moments (Los 24.95–25.30 and 28.58–28.93 s on the old ride): steep descents with an overhead contact that don't feel like going down. They ask for something generic, not a niche rule, and for a quantitative characterisation of how the rider moves in the frame relative to its motion.

- **Telemetry** (`camstats`), per song and per placement:
  - the rider's screen position (p5/50/95);
  - screen activity (path length per second);
  - "false climb": seconds per minute in which the rider moves up on screen while going down in the world;
  - opposite motion (screen velocity against world velocity);
  - steep response: mean screen y on descents steeper than 45° minus the rest;
  - drops per minute.
- **Generic candidate, "follows direction":** the vertical offset follows the *direction* of travel (sin of the angle, speed-saturated) rather than vertical speed, so a 60° ride sits lower than a 35° one at any speed. It uses Tamed's asymmetric response, and the rest point is 5 % higher.
- Compare Tamed | Higher | Follows direction | Steep-ride drop (the narrow rule, shown so generic and narrow can be judged side by side). Report the telemetry for all seven songs, and check the owner's two moments on the old ride.

## C. Colours
Three four-ups on one song, colour only (look "Swatch"):
1. slate, olive, mauve, sumi;
2. bauhaus, lagoon (ink deepened to `#052b35`, the one lightness fix), riso with deeper ink (the lightness test), dune;
3. midnight, espresso, moss, plum.

The owner doesn't remember Plum and Lagoon, so they are shown again. Plum is unchanged.

## D. Scheme switch at the drop
Try it at the hand-placed Night cue, as a cut on the cue (intentional and rare), into a paired scheme. Each scheme gets a `drop` token:
- graphite → black;
- slate → midnight;
- mauve → plum;
- dune → espresso;
- olive → moss;
- sumi → black.

Four-up on two songs: Paper with Night (the current one) | slate→midnight | mauve→plum | dune→espresso.

## E. Band pool
One four-up on one song: Bars | Fork | Iris | Three colours, on Paper.

## F. Baseline looks on the new rides
A four-up of Paper, Hokusai, Lagoon and Black on three songs. Title stays optional per look; line mode is free.

## G. Vocabulary (on the page, not built into code)
- **Scheme:** colours only.
- **Elements:**
  - band form;
  - top element (sun, title);
  - line mode;
  - hit accents;
  - camera placement and zoom;
  - Night or a drop switch.
- **Look:** a named combination, only a preset. Not locked as a first-class concept.

## H. Jolt and sync
The owner wants it "under control": what do visuals and touches align to (first touch, impact peak, the music onset)? The compiler is the other agent's track. I write a brief in `agents/jolt-brief.md` with my measurements (touch lands −6 to +10 ms from the sound's rise) and their questions. Lab side: accents fire at the first touch.

## Morning page
At most four questions: hits, camera, colours (which join), drop switch. Bands go in a "look and tell me" item. The v1 list is updated, and the vocabulary note is added.
