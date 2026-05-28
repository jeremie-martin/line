# V0 Anytime LDS Search Plan

## Core Invariant

The compiler evaluates a deterministic, budget-independent leaf enumeration
`E(spec, seed)`. A budget only controls how far into that sequence the compiler
gets. The returned track is the best completed leaf seen so far under a fixed
deterministic comparator. Therefore a larger budget evaluates a prefix
superset and cannot reduce best-so-far quality.

## Search Shape

- Reuse the existing gap slicing, candidate generation, lr-core validation,
  hard gates, bisection, and axis measurement primitives.
- Replace greedy top-level control flow with limited-discrepancy search over
  cost-ranked per-gap candidate lists.
- Keep candidate count, discrepancy caps, backtracking/recovery constants, and
  polish ordering as code constants, never budget-dependent knobs.
- Seed the incumbent from the discrepancy-0 path so LDS has the legacy-style
  greedy floor before exploring deviations.
- Rank final leaves only by the exact scorer/report path:
  rebuild engine, extract trajectory, detect events, build `DriftReport`, then
  `scoreDriftReport`.

## Budget Unit

`work_units_used` is the metered count of simulated trajectory frames charged
at `extractRawTrajectory` / `extractRawTrajectoryWindow` / `detectWindow`.
Secondary counters such as physics frames, line additions, and sampled
candidates remain diagnostic. Budget checks happen at operation boundaries, so
one operation of overshoot is allowed but the leaf prefix order remains stable.

## Comparator

1. Passing hard contract beats failing hard contract.
2. Among passing leaves, higher `axis_quality` wins.
3. Among failing leaves, higher `scoreDriftReport(...).score` wins.
4. Ties keep the earliest leaf in `E`.

## Stages

1. Establish and measure the sim-frame work unit.
2. Implement unbudgeted LDS with deterministic best-so-far leaves.
3. Add budget metering, prefix-superset checks, and budgeted determinism.
4. Convert polish to generate-and-test leaves.
5. Clean up scoring/harness, calibrate `budgetFor(spec)`, and freeze the
   legacy baseline.
6. Run full acceptance, then remove legacy only after parity and all four
   properties pass.
