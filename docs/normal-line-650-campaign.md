# Normal-line compiler campaign

Opened 2026-09-07 under the owner's new constraint: only normal type-0 lines.
The above-650 goal is active. Benchmark V2 and its score remain fixed. The
607.2582 normal-line baseline and its full canonical cache are restored.

The acceleration campaign is preserved on `archive/native-motion-feedback-761`
(commit `7cb77df1`), with production review on `codex/native-motion-video-review`.
Its 761.9107 score is not a result under the normal-line constraint. The three
full production videos are being generated in an isolated checkout and retained
under `generated/reviews/native-motion-2026-09-07/`.

## Starting hypotheses

The acceleration result demonstrated that exact collision-position observation,
computed-prefix reuse, body-pose feedback, and direct motion planning can work
together. Those ideas are distinct from the acceleration material itself.
Test what normal collision geometry can realize before assuming their control
authority disappears with type 1. Normal collision response changes position
through unilateral projection; its admissible direction and penetration must be
measured with the actual solver and full rider constraints.

First, derive point-local type-0 controls and test sustained physical support,
turning, and timed release/recapture with exact frozen-engine replay. Use the
failure geometry to revise the motion plan and actuator, rather than treating
a direct material swap as a verdict on the approach. Other directions remain
open, including joint passive catches and gravity/heading planning.

The ordinary public entry point currently uses the previous normal compiler.
The packaged exact cache/observation backend remains available for research;
none of its physics differs from the frozen judge. No normal-line candidate
has yet been evaluated or promoted.

## First physical results

A type-0 projection controller sustains 96 contacts across 2,400 fixture frames
in 181,729 charged frames, all intact and exactly reproduced by the frozen judge.
The first flat fixture fails after four frames; projecting inadmissible requested
forces into the actual one-sided normal-collision domain extends it to 300.
These are feasibility checks, not benchmark scores.

The initial full development pass has 41 valid sources, two startup failures,
and one telemetry exception. Counting the exception as a failed source gives a
567.2234 discovery aggregate. The startup failures are aligned rider points:
a horizontal normal plane can project another point up to ten units behind it,
so making a line narrow does not alone isolate it. Small physical tilts separate
the tangent coordinates of nearby points; no masks or engine changes are used.
The two repaired sources score 690.1249 and 684.8488 with all contacts valid.

The telemetry exception occurs when the final full replay completes the authored
track even though the construction loop stopped early. Recording that measured
completion consistently fixes the attribution; the recorder and benchmark
accounting are unchanged. The repaired source scores 722.7296, valid, within
749,774 frames. The new full pass measures all sources under the same correction.

The first four normal-line exploratory scores were 655.8880 (amplitude tides),
586.5796 (dense recovery), 676.8371 (transition mosaic), and 458.0052 (impact
Believer), all valid. Believer's large speed residual makes it a useful case for
studying the motion plan's physical feasibility. These are discovery runs on
seed 260907011, not a canonical comparison. Raw artifacts, checksums, and plans
are under `generated/benchmark-v2/normal-line-650/`.

The corrected full 44-source discovery pass reaches **662.5888**, **44/44 valid**
at actual 750k budgets. All exported lines are type 0. Plan SHA:
`5c0f78771c4b79654d2292c601ffc57734e4ad00a90d4fb882d9b99826f89ffa`.
This remains an exploratory reading until the public implementation passes the
canonical comparison. Public manual-start replay reproduces geometry, reports,
and charged frames exactly. Twelve focused integration/identity/CLI tests and
61 broader optimizer/budget tests pass. Two full tracks also exactly match the
published JavaScript engine, including every raw trajectory frame and event.

The long-tail open-hook case spends most of its budget attempting support after
the last authored impact window even though its retained physical track already
completes the spec. This is a compiler efficiency defect to address before the
canonical comparison. The verified 662.5888 implementation is retained in git.

The completion fix validates and charges a full physical continuation when a
support proposal fails after the final authored impact window. It stops only
if that actual complete output passes the unchanged report contract; otherwise
ordinary backtracking continues. Open-hook amplitude now completes in **103,448
frames**, score **722.6170**, versus 749,774 frames / 722.7296. It makes a small
quality/computation tradeoff rather than claiming track parity. The completed
track still receives its independent frozen-engine cold replay. This change
also passes the public compiler/CLI tests and a physical regression test for
vertically aligned rider points; the latter compares the full trajectory with
the frozen judge and asserts only type-0 output.

All three acceleration production videos are now complete, verified, and
preserved with source, original music, benchmark evidence, and checksums in
`archives/native-motion-feedback-2026-09-07/`. The main workspace has switched
to `codex/normal-line-650`; the video branch and archive remain intact.
