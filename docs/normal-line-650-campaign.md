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
