# Brief for the compiler agent (owner, 2026-11-13)

You work on the compiler, on your own machine, on a branch from `visual-lab`. Another agent works on the look of the
videos on `visual-lab` itself; don't touch `scripts/video/` or `generated/concept-lab/`. You work for hours or days on
your own. The owner looks in now and then, mostly by watching tracks; nothing needs approval step by step.

Read first: `CLAUDE.md`, `WORKING.md`, `ARCHITECTURE.md`, and the two newest entries of `REWORK.md`.

## Where things stand

- The compiler scores about 800 on V7.1. The owner considers the benchmark nearly saturated: changes move it by 10 to 20
  points at most.
- The 52 MB construction archive was replaced by 210 KB of compact sources on November 13, at a cost of about 12 points
  (held out about 16). The owner accepted that. Don't bring a large archive back.
- What was tried and failed to replace the archive is in `REWORK.md`, "November 11 (night)". Don't repeat it, and don't
  spend compute on larger budgets: the owner has seen that ten times the budget barely moves the score.
- Known weaknesses: strong beats landing too soft on everyday songs, and very short gaps between hits (Trouble's
  two-hit pairs, Circus Minimus `pairs4`).

## What the owner wants

**A compiler that makes better tracks, not a higher number.** A version once reached 950 with boring tracks, always the
same pattern. The best material today is the voice passage of Circus Minimus: many short gaps, intense, varied. More
tracks should be like that.

1. **First, a harder benchmark,** so that there is something to aim at again. Keep it cheap: this is not a new benchmark
   from scratch.
   - Take the current specifications and make them a bit faster and shorter (compress time), and give the asks more
     contrast or more height. Compressed specs no longer fit their songs: they are for scoring only.
   - Add some of the held-out specifications, or variations of them. Keep a few held out; a new set of production
     specifications will later become the held-out set.
   - Leave the Circus Minimus specification itself alone: the other agent will rework it.
   - Baseline the new benchmark on today's compiler, and set a new comparison reference from the commit you start from
     (the old reference `merged` still has the archive).
2. **Then improve the compiler against it.** You choose what to work on. The open items in `TODO.md` item 9 are
   candidates, including the owner's open call on deleting the ending refinement, which is yours to decide.

## Keep in mind

- **Variety and character of the rides.** Look at `tools/measure/ride_character.ts` and at real tracks from time to
  time, and before claiming a large gain. It is not a gate on every change.
- The rules in `CLAUDE.md` hold: parity for structural changes, paired comparisons for behavioural ones, physics
  accounting, and no optimizing a measure that isn't validated against the owner's labels.
- Record decisions and results in `REWORK.md`, newest first. Commit and push your branch as you go.
- Keep things simple: no new layers of process.
