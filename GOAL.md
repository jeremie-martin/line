# Goal — satisfy the v0 compiler contract quickly

Maximize `goal_score` from:

```
npm run goal -- --json
```

This is the inner-loop metric. It evaluates the v0 compiler against a fast
goal suite with a wall-clock budget, and it scores only the v0 contract: beat
sync, no off-beat landings, survival, and section-axis fidelity.

## Eval

Default command:

```
npm run goal
```

Default suite:

- `sanity`
- `first`
- `quick_multi_axis`

Useful variants:

```
npm run goal -- --specs=drums_baseline,drums_chunky
npm run goal -- --timeout-scale=5
npm run goal -- --timeout-sec=90
npm run goal -- --suite=full
```

## Score

Per spec:

```
hard gates:
  all contacts hit within ±1 frame
  survived through endOfSpec
  off_beat_landings == 0
  elapsed_time <= runtime_budget

sync_score = contacts_hit_within_1_frame / total_contacts
axis_score = clamp(1 - mean_axis_error / 0.25, 0, 1)

spec_score = 0 if any hard gate fails
spec_score = 1000 * sync_score * axis_score otherwise

goal_score = mean(spec_score across specs)
```

Runtime is a gate, not an optimization term. A correct run gets no extra
credit for being faster than the budget; an over-budget run is a timeout.
By default the budget is `min(5 × video duration, 60s)` per spec. Use
`--timeout-sec=N` when you want an explicit fixed cap.

## Output

Human output is meant for troubleshooting. Each spec reports:

- score and pass/fail status
- hit/drift/missing contact counts
- off-beat landing count and first off-beat frames
- axis target, achieved value, and error per section
- worst drift/missing contacts
- elapsed time versus budget

JSON output includes the same fields for scripts.

## Full Bench

The serial and parallel v0 benches use the same scorer:

```
npx tsx scripts/v0/benchmark.ts --json
npx tsx scripts/v0/_pbench.ts
```

`npm run goal -- --suite=full` runs the 30-second drums specs under the same
runtime gate. `scripts/v0/_qbench.ts` is a sliced smoke bench for quick
regression checks. It is useful during development, but `npm run goal` is the
canonical target.

## What You Can Change

High-leverage areas:

- `scripts/v0/compile.ts`
- `scripts/v0/arc.ts`
- calibration constants in `scripts/v0/types.ts`

Do not change `scripts/goal_metric.ts`, `scripts/v0/score.ts`,
`scripts/v0/bench_specs.ts`, `scripts/v0/benchmark.ts`, or
`scripts/v0/specs/` just to improve the score. Metric changes are allowed only
when the goal itself is deliberately revised.

## Hard Contract

1. **Determinism**: same `Spec` + same `seed` must produce byte-identical
   `Track`. No unseeded `Math.random()`, no time-based inputs.
2. **lr-core in the loop**: every geometric decision must be validated by
   `lr-core` plus `detect`; approximate physics cannot be the source of truth.
3. **Beat sync is physical sync**: matched beats must be detected landings at
   the requested contacts, not camera edits or report-side accounting.
4. **No off-beat landings**: any landing not aligned with a Contact is a hard
   failure.
5. **Axis honesty**: measured section axes in `DriftReport` must stay tied to
   the finished track, not to candidate-side intent.
