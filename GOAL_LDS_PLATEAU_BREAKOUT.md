# Goal - 150k plateau-breakout handoff compiler

This document is the working charter for the next plateau campaign. It does not
replace the default golden ruler in `GOAL_LDS_LOW_BUDGET.md`; it defines a
faster diagnostic loop for learning how to make `compileHandoff` convert more
compute into better tracks.

## Intent

The goal is to break low-quality plateaus, not merely tune one checkpoint. The
current production compiler still improves after the default `75k` ceiling, but
only modestly: a full 20-spec run at commit `0c252e6` moved from `351.43` at
`75k` to `354.38` at `150k`. That is real progress, but not the kind of
compute-scaling breakout the optimizer should eventually reach.

Prefix branching is one possible mechanism, not the campaign identity. Treat it
as a clean deterministic resampling tool when it earns its complexity. The
larger target is the row optimizer itself: candidate generation, ranking,
frontier scheduling, repair/backtracking, and geometry primitives that remain
simple enough to reason about.

## Diagnostic Workbench

Use this 10-spec workbench for fast plateau iteration:

```bash
npx tsx scripts/v0/golden.ts --compiler=handoff --jobs=32 \
  --specs=drums_pendulum,drums_crescendo,grain_staircase,rhythm_ladder,syncopated_switchback,drums_signature,dense_sprint,opening_burst,drums_tide,drums_dropout \
  --budgets=35000,40000,45000,50000,55000,60000,65000,70000,75000,80000,85000,90000,95000,100000,105000,110000,115000,120000,125000,130000,135000,140000,145000,150000 \
  --details --json
```

The slice is diagnostic, not a new golden ruler. It intentionally mixes:

- low-air and groundedness pressure: `drums_pendulum`;
- contact-style and discrete contact-duration pressure:
  `drums_crescendo`, `rhythm_ladder`, `syncopated_switchback`,
  `drums_signature`;
- dense/start/contract pressure: `dense_sprint`, `opening_burst`;
- grain isolation: `grain_staircase`;
- curve-native target pressure: `drums_tide` uses sine plus ramps, and
  `drums_dropout` uses smooth keyframes.

If `jobs=32` causes swap or timeout artifacts on the current machine, rerun at a
lower job count and record that as an operational adjustment, not a compiler
policy change.

## Acceptance

The strategic goal is a material plateau breakout, especially better conversion
from `75k` to `150k`. Small clean positive curve deltas are still acceptable
when they are explainable, preserve the budget-prefix contract, and do not add
fragile complexity.

A very small regression can also be acceptable when the change is a clear
simplification, removes overfit or fragile policy, or makes future optimizer
work easier to reason about. Do not grant this exception to added machinery:
extra branching, scheduler, or candidate logic still needs evidence that the
added complexity earns its keep.

Before trusting a plateau-campaign optimizer change:

1. Probe the 10-spec `150k` workbench.
2. Inspect per-budget deltas and row-level plateaus, not only the aggregate.

Full golden runs are later promotion checks, not part of the fast plateau loop.
Use them only when a change looks strong enough to consider as general default
compiler policy. The campaign loop should stay fast enough to test ideas that
may fail.

Variants remain a report-only guardrail and are not part of the fast plateau
loop unless the change touches robustness-sensitive behavior.

## Current Campaign Evidence

The first accepted plateau-loop cleanup is tighter stalled prefix-branch pruning:
lowering the no-improvement branch cap from `48` to `24` full-duration branch
evaluations. On the 10-spec dense `150k` workbench, this moved `CURVE_SCORE`
`325.88 -> 326.09` with all checkpoint budgets positive and validity unchanged.
It reduced branch full evaluations at `150k` from `3918` to `3509` while raising
branch prunes from `101` to `197`. The largest `150k` win was
`drums_dropout seed=1 +3.51`; the only material `150k` row regression was
`drums_tide seed=0 -0.64`.

The next cleanup first gave high contact-style targets one additional
quality-only candidate (`2 -> 3`) while keeping lower contact-style targets on
the cheaper default. On the same 10-spec dense `150k` workbench, this moved
`CURVE_SCORE` `326.09 -> 326.22`, kept validity `30/30`, and improved `150k`
suite score by `+0.27`. After the anti-overfit review, that target-threshold
micro-policy was removed again: contact-style quality search now uses the same
small fixed sample count for every contact-style target. The measured tradeoff
was `CURVE_SCORE` `326.22 -> 326.09`, `150k` `332.72 -> 332.38`, validity still
`30/30`. This is accepted as a simplification, not a score gain; the largest
lost row was the known `dense_sprint seed=0 -9.83`, partly offset by
`rhythm_ladder seed=1 +1.54`.

The first accepted design cleanup after that is behavior-preserving: local axis
cost now iterates the canonical `AXES` registry, and handoff's asymmetric
overshoot pressure is a small policy table rather than inline named-axis
branches. This does not claim a curve-score gain; it makes future axis additions
and ranker changes explicit, easier to test, and easier to remove.

The follow-up substrate cleanup centralizes per-axis value bounds and uses the
canonical axis registry for target averaging, target jitter clamping, and spec
validation. This is also behavior-preserving; its purpose is to keep new-axis
work from requiring edits to several hidden four-axis lists.

The next handoff cleanup factors the contact-style quality sample stream into
an explicit axis-quality stream registry. Only `contact_style` is registered
today, with the same deterministic seed salt, attempt offset, and fixed
two-sample allocation. This does not claim a curve-score gain; it removes a
named-axis branch from candidate control flow and makes any future axis-specific
extra work a visible policy-table decision.

A related axis-extensibility cleanup adds an exact canonical target-set helper.
The air-only ride-out candidate gate and the air-only polish guard now ask for
exactly the `air` target set instead of spelling out "not speed, not grain, not
contact_style". Current behavior is unchanged, but a future axis can no longer
silently slip through those air-only paths.

The final-track polish substrate now also has an explicit `FRAME_SPAN_AXES`
category for axes measurable over arbitrary frame ranges. Today that category is
only `air` and `speed`, matching the previous behavior, but the final-track
axis-error roll-up no longer hides that semantic assumption in a local literal
array.

The handoff substrate now also has an explicit `CONTACT_EVENT_AXES` category for
axes whose achieved value is tied to the local contact/catch event. Today that
category is only `contact_style`, matching previous behavior, but brake gating,
preview-cost suppression, and final-polish compatibility guards no longer ask
for that named axis directly.

A start-policy diagnostic cleanup now records the selected start speed and
angle in `CompileStats`, carries those fields through golden JSON, and prints
them in the curve analyzer. This does not change compiler behavior; it makes
future start-state probes explainable without rerunning ad hoc track inspection.
The analyzer now also aggregates selected starts by first speed and air target
bands, including mean start speed/angle and nonzero start-rank frequency, so
start-policy probes can be compared without spec-keyed inspection. Comparison
output now includes selected-start transitions on largest regressions,
improvements, and validity flips.

Work accounting now reports real `candidates_sampled` values for handoff:
`sampleOneCandidate` calls are counted per compile, carried through golden JSON,
and printed by the curve analyzer. This makes future probes easier to judge on
candidate-work waste as well as simulated-frame budget.

Work accounting also reports `candidates_viable`: sampled candidates that
survive hard gates and return a `GapFit`. The analyzer prints sampled/viable as
`cand=a/b`, so future probes can separate raw sampling volume from hard-gate
attrition.

Analyzer comparison mode now reports average per-row work deltas at each common
budget: `workΔ(sim=... cand=... viable=...)`. Use this when judging whether a
probe improved the curve by spending substantially more compute or by using the
same deterministic work sequence more effectively.

Catch-reuse validation work is now visible as `reuse=successes/attempts` in the
analyzer and as `handoff_reuse_*` stats in golden JSON. Reuse candidates are
translated from recent catches and validated with physics, so this exposes
whether that extra deterministic work is converting into viable candidates.

Brake and registered axis-quality extra streams are also reported as
`brake=successes/attempts` and `axisq=successes/attempts`. These are
diagnostic-only counters for judging whether extra candidate machinery earns its
sample budget before adding or removing policy.

The curve analyzer also aggregates these counters at the last budget as
suite-level extra-work yield (`reuse`, `brake`, `axisq`, `rescue`, and
`branch`). Use those rates before drawing conclusions from individual row
examples; the point is to judge broad mechanics, not memorize spec anecdotes.

Candidate caches are now explicitly search-seed-aware. A `SearchNode` can still
extend or shrink deterministic candidate-count prefixes for the same lane, but a
request with a different search seed resamples instead of reusing a stale cache.
Normal handoff behavior is unchanged; this makes future snapshot and branch-lane
experiments less fragile.

The node candidate API now also validates `nCand` before consulting the cache,
so invalid candidate-count requests cannot be accidentally satisfied from an
existing larger prefix. This keeps the deterministic-prefix cache contract
aligned with `solveOneGap`'s non-negative-integer candidate-count contract.

Rejected follow-up probes:

- Baseline-first branch scheduling, where the best normal child runs before the
  alternate branch, improved seed-0 curve by `+0.37` but lost `0.24` at `150k`
  and regressed a material row. The useful branch lane often needs immediate
  priority to show up by the late checkpoints.
- Sliding branch re-stall pruning after any branch improvement saved branch
  work, but even a longer post-improvement window still cut off late branch
  gains on seed 0. Branch lanes can improve after long irregular gaps, so a
  simple post-improvement cap is too blunt.
- Halving the prefix-branch fork cadence (`PREFIX_BRANCH_FRONTIER_INTERVAL`
  `4 -> 8`) also saved branch work but cut away too many rare wins. On the
  10-spec dense `150k` workbench it moved `CURVE_SCORE` `326.09 -> 325.07`,
  `75k` `329.57 -> 327.42`, and `150k` `332.38 -> 331.83`, while branch
  evaluations dropped from `3509` to `1887`. This reinforces that branch
  throttling needs a smarter scheduler signal than a blunt global cadence.
- Raising the global air-overshoot ranking weight from `16` to `24` looked
  strong on seed 0, but the full 30-row workbench fell from `326.09` to
  `303.66` and validity dropped to `29/30`. Global ranker retuning can move the
  search into better basins on some rows but is not safe as a blanket policy.
- A milder target-sensitive air overshoot weight, rising from `16` at ordinary
  air targets to `24` only at zero-air targets, was also rejected. It preserved
  validity but moved the 10-spec dense `150k` workbench from `326.09` to
  `319.18`; `drums_dropout seed=1` collapsed by `-133.40` from a late speed
  blow-up. Stronger low-air rank pressure can trade the air problem for worse
  speed basins, so this plateau needs better feasible primitives/search, not
  just larger penalties over the same candidate pool.
- Using that stronger air bias only in prefix-branch lanes avoided the global
  contract failure but did not earn its compute: replacing lane 1 lost an
  existing branch win, and adding a second lane increased branch work while
  slightly reducing the seed-0 curve.
- Widening the quality ranking pool from the cheapest `8` sampled candidates to
  `9`, and then to all `16` already-sampled quality candidates, was a score
  no-op on the seed-0 diagnostic workbench. The plateau is not simply that the
  ranker ignores slightly more expensive samples.
- A weak contact-style segment-length prior for gaps without grain was also a
  score no-op on seed 0. Contact-style failures are not solved by a small
  median-line-length prior layered onto the existing random primitive.
- Extending the air-only ride-out primitive to mixed low-air gaps as a capped
  final-line continuation was a full-workbench no-op: the 10-spec dense `150k`
  workbench was byte-identical in score and work counters. The low-air plateau
  is not reachable through post-contact continuation under the current
  measurement windows; a real fix likely needs pre-contact/approach geometry or
  ranking changes.
- Scoring air lookahead through exact half-second next-contact spans
  (`postContactFrames > FPS/2` to `>=`) was too blunt. It created meaningful
  wins (`drums_tide seed=0 +61.70`, `drums_pendulum seed=2 +34.21` at `150k`)
  but moved the 10-spec dense `150k` workbench from `CURVE_SCORE`
  `326.09 -> 294.97`, dropped early `35k` validity from `30/30` to `24/30`,
  and regressed `drums_dropout seed=0` by `-145.20`. Next-gap carry is a real
  signal, but it needs targeted scheduling or policy, not a blanket
  measurement-horizon boundary change.
- Re-enabling one-contact future preview during quality search with zero
  preview-cost weight was rejected before the full workbench. The focused
  handoff tests passed but took `191.70s`, and a 3-spec smoke
  (`drums_pendulum`, `opening_burst`, `drums_dropout`; `75k,150k`) showed the
  expected tradeoff: common rows improved by `+0.57` at `75k` but regressed by
  `-2.75` at `150k`, with `opening_burst seed=2 -19.22`. Scarcity-only preview
  can move some early choices, but the broad form spends too many metered frames
  on lookahead rollouts and displaces actual suffix expansion. Keep the
  quality-phase preview deferral unless a much narrower scheduler signal earns
  the work.
- A naive quality-phase poor-fit rescue, which reran the larger deterministic
  rescue batch whenever the best local candidate cost was severe, made the
  focused handoff test run take `155s`. Poor-fit rescue may still be worth
  revisiting, but only with a much tighter scheduler or cheaper trigger.
- A sparse/capped poor-fit rescue pulse (`64` frontier selections, max `8`
  rescues) was still too expensive: the same focused handoff test run took
  `145s`. Inline poor-fit rescue appears to be the wrong shape; any future
  version should probably be a targeted branch/scheduler experiment, not an
  expansion-time rerun.
- A targeted poor-fit prefix branch was tried next: quality-only, capped at four
  forks, pulsed every `32` frontier selections, and using a distinct downstream
  lane from the weak local prefix. It was cheaper than inline rescue but still
  regressed seed-0 curve score by `-0.35`, with `dense_sprint seed=0` losing
  `9.83` at `150k`. Poor-fit branching can starve an existing useful branch
  lane, so local-cost signals need a more careful scheduler than simple
  add-another-lane.
- Removing the whole contact-style quality sample stream was too costly. The
  10-spec dense `150k` workbench moved `CURVE_SCORE` `326.09 -> 325.24` and
  `150k` `332.38 -> 331.78`, validity still `30/30`. The simplification created
  several large `150k` row losses (`syncopated_switchback seed=1 -29.66`,
  `opening_burst seed=2 -17.46`, `drums_pendulum seed=0 -17.22`) despite a few
  large wins. The fixed two-sample stream earns its current complexity; the
  rejected part was only the high-target threshold.
- Replacing the start-speed regimes with one broad common anchor set was also
  too blunt. It removed the `6`/`9` px/frame candidate cliff and produced some
  striking wins, but the 10-spec dense `150k` workbench moved `CURVE_SCORE`
  `326.09 -> 317.90`, `150k` `332.38 -> 328.92`, and introduced one early
  checkpoint contract miss. The largest `150k` losses were
  `drums_pendulum seed=0 -190.87` and `drums_tide seed=1 -76.82`; the largest
  wins were `drums_dropout seed=1 +205.94` and `drums_tide seed=0 +193.09`.
  The current start-speed bands are still unsatisfying, but a production change
  needs a softer start-state policy that preserves low-speed/low-air protection
  instead of simply scoring a much wider common set.
- Smoothing the high-speed start overshoot scoring gate was rejected for the
  same reason. Keeping the current candidate set but ramping overshoot pressure
  from `6` to `9` px/frame moved `CURVE_SCORE` `326.09 -> 318.46` and `150k`
  `332.38 -> 326.05`. The new start diagnostics showed the catastrophic row:
  `drums_pendulum seed=0` selected `start=6.60@24.0deg`, fell to `88.94`
  (`-190.87`), and had extreme late speed overshoot. This does not prove the
  hard gate is principled; it proves the low-air/low-speed start protection is
  real and must be preserved by any smoother replacement.

## Implementation Guardrails

- Do not identify or indirectly key logic to benchmark spec names.
- Keep candidate policy independent of the requested budgets until a deliberate
  budget-aware design is explicitly accepted.
- Prefer base optimizer improvements over layers of wrapper logic.
- If prefix branching grows, keep it lean: isolated state, unchanged public
  stats, deterministic lane derivation, and no hidden score changes.
- Treat code cleanup as part of optimization work when it makes future changes
  easier to evaluate and remove.
