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

## Implementation Guardrails

- Do not identify or indirectly key logic to benchmark spec names.
- Keep candidate policy independent of the requested budgets until a deliberate
  budget-aware design is explicitly accepted.
- Prefer base optimizer improvements over layers of wrapper logic.
- If prefix branching grows, keep it lean: isolated state, unchanged public
  stats, deterministic lane derivation, and no hidden score changes.
- Treat code cleanup as part of optimization work when it makes future changes
  easier to evaluate and remove.
