# Handoff to the compiler agent, second (2026-11-15)

Your three commits (construction check, aimed launches removed, the float ceiling) are merged into `visual-lab` at
`b44fa081`; every gate passes. Bring `compiler` up to it (it fast-forwards) and set a reference there
(`npm run compare -- reference set foundation-9 --from=b44fa081`).

Since your branch point, `visual-lab` also changed which spec is each song's default (`REWORK.md`, "production specs
chosen"). The benchmarks measure the same specs as before. Two readings are reserved as held-out and stay out of every
compiler decision: Trouble `cycle` and Valhalla `phrases-climb` (`tools/eval/inputs.ts` `RESERVED_HELDOUT`).

Two proposals, in the order I would take them. Both are suggestions; the owner decides.

## 1. Tell a spec's author what the compiler cannot give (small, first)

Your ceiling result is knowledge an author needs before compiling, not after. Today a spec may ask 0.88 air over a gap
whose ceiling is 0.74, and the author learns it from a low score, or never.

Wanted: a report on a spec alone (no compile, or one cheap pass), listing the asks that cannot be met and why, in the
author's terms: "air 0.88 asked over the 2.4 s before 31.2 s; at most about 0.74 before a catch this quiet". Start with
the float ceiling, which you have measured. Add others only where you can show the bound on saved rides the same way
(candidates: a strong hit right after a quiet one at low speed; two hits closer than a support can be drawn).

- It must never refuse or change a spec: an author may ask for the unreachable on purpose.
- Check it against saved rides: asks it calls unreachable should be the ones rides miss, on specs it was not fitted on.
- Where it belongs: next to the spec tools (`docs/music-authoring.md` describes the author's loop), so the spec author
  runs it before a compile.

## 2. Fewer rails by geometry (the owner's standing wish, larger)

The owner, November 14: rails add clutter, and the answer is not to remove them or make them rarer by a price, but
"a geometry that would make them unnecessary, at least in some circumstances". `docs/taste-and-the-compiler.md` has the
principles and what failed (a rail budget, a rail price: both made the ride plainer).

Everything measured about rails predates gentle exits, parked terraces and folds, and the arrival law. So first measure
where things stand on `foundation-9`: the share of gaps keeping a rail, by category and by what the rail is doing there
(holding speed, driving the rider down into a hit, catching a miss). Then state one hypothesis about one of those jobs
and a shape that does it without a rail. Your own note is a starting point: a catch from above could do a rail's job
(it drives the rider down and can add speed).

- Rulers: rails per gap, clean upper hits on strong beats, the hard unrecorded pushes guard, and the headline. A gain in
  the headline that raises rails is the mistake of November 14.
- This one needs the owner's eye before adoption. Show rides in two versions in the comparison player, plain look
  (`WORKING.md`, "Showing work to the owner").

## Not proposed

- Raising the push cap or hardening quiet catches to recover float air: the owner chose today's look there.
- Launching floats from the strong hit that starts them: your own count (48 of 288 gaps) says it is small. Worth a line
  in proposal 1's report rather than an experiment.
- Motion the music asks for between hits: still parked (`TODO.md`).
