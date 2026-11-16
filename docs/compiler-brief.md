# Brief for the compiler agent (2026-11-16)

You work on the compiler, on your own machine, on the branch `compiler`. You work for hours or days on your own; the
owner looks in now and then, mostly by watching rides. Another agent owns the look of the videos, the specs and the
zoom lanes on `visual-lab`: don't touch `scripts/video/`, `generated/concept-lab/`, or any `productions/<song>/spec.ts`
and `zooms.ts`.

Read first: `CLAUDE.md`, `WORKING.md`, `ARCHITECTURE.md`, `docs/taste-and-the-compiler.md`, and the entries of
`REWORK.md` from "November 15: catches from above" upward.

## Start here

`visual-lab` holds everything your branch had, and 55 commits more. Restart `compiler` from today's `visual-lab` (your
branch has nothing it lacks). What changed under you since you paused:

- **Supports end at the rider's last touch** (`trimUnusedArcSupports`, `foundation-12`): same rides, shorter tracks.
  The owner has not decided whether to trim further; leave that question to him.
- **One source for each thing** (`foundation-11`): a consolidation, byte-identical rides.
- **Production specs** are now the handcrafted readings the owner marked highest (Petrunko, Trouble, Amor na Praia,
  Bones, Valhalla); the earlier specs are variants, so the panels measure what they measured. Two readings are reserved
  as held-out and stay out of every decision (`tools/eval/inputs.ts`, `RESERVED_HELDOUT`).
- The reference is `foundation-12`. References are local: `npm run compare -- reference set foundation-12 --from=b8def910`.

## Where the project is

The owner is close to closing it for a while and using it to make many videos. He calls the last days' compiler work
(gentle exits, catches from above, trimmed supports) a game changer for how clean the tracks look, and further score
gains small by comparison. So the work now is about every video being good, not about the headline.

## The work

1. **A production sweep, first.** Nobody has looked at today's compiler across everything it will be asked to make.
   - Compile every production song (31 in `productions/`) at 8 seeds or more, with the default spec.
   - Report per song: rides that do not complete; score spread across seeds; compile time; and, from
     `tools/research/ride_character.ts` and `tools/measure/motion_check.ts`, the passages that look wrong (bursts, a
     rider left slow, long stretches of one geometry, hits on a beat nobody asked for).
   - Rank the songs and the kinds of passage by how much they would hurt a batch of videos. This ranking, not the V8
     headline, chooses what you work on next.
   - Give the owner something to watch: the worst and the most typical ride of the weakest songs, plain look, as one
     collection on the video comparison page (`WORKING.md`, the table of pages).
2. **Then work the list the sweep gives,** worst first. Likely candidates, already in `TODO.md` under "Compiler": quiet
   asks on slow passages, very short gaps between hits (Trouble's two-hit pairs, Circus `pairs4`), strong beats
   landing soft on everyday songs, guide touches on beats.
3. **The reservations on catches from above** (`TODO.md`): close them with measurements, in either direction.
4. **Housekeeping on your side** (`TODO.md`, "Housekeeping for that agent"), when a run is going and you are waiting.

## Keep in mind

- **Better rides, not a higher number.** A version once reached 950 with boring tracks. Read every change through the
  ride character line and through real tracks, beside the headline. Don't add rails or budgets to buy score
  (`docs/taste-and-the-compiler.md`).
- The rules in `CLAUDE.md` hold: parity for structural changes; for behavioural ones a hypothesis in advance, paired
  comparisons on V8 with V7.1 beside it, completion apart from quality, every ruler.
- A change that looks free on a few specs can cost elsewhere: run the full V8 comparison before calling anything free.
- Don't spend compute on larger budgets, and don't bring a large archive back.
- Record decisions and results in `REWORK.md`, newest first, and keep `TODO.md` current. Commit and push your branch as
  you go. When something is ready, say so in `REWORK.md` with a new `foundation-N`; the merge into `visual-lab` is done
  from the other side.
- Keep things simple: no new layers of process.
