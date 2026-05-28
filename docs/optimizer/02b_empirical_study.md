# V0 LDS Empirical Budget Study

This document records the curve study for the v0 LDS compiler. It is separate
from the acceptance gate: the gate answers pass/fail, while this study explains
the shape of the quality, runtime, and budget curves.

Current repo note: the checked-in golden suite currently contains 8 specs. If
the suite grows to 13, the full-study command automatically follows
`GOLDEN_SPECS`.

## Questions

The study is designed to answer:

- Does contract-gated quality never decrease as budget increases?
- Do scored-leaf fingerprints grow as a prefix sequence?
- Where do tracks first pass the hard contract?
- Where do quality curves saturate?
- At what budget does LDS match or beat the greedy v1 reference?
- Is `wall_ms / work_units` stable across specs, seeds, and budgets?
- Is budget overshoot bounded and explainable by operation-boundary cutoff?
- Do the observed curve shapes match the LDS architecture?

## Harness

Run the study harness:

```bash
npm run study:v0:budget -- --scope=full --greedy --concurrency=4
```

Default budget levels are:

```text
50000, 100000, 200000, 500000, 1000000, 2000000, 5000000, 10000000
```

Useful variants:

```bash
npm run study:v0:budget -- --scope=minimal --concurrency=2
npm run study:v0:budget -- --scope=representative --budget-levels=10
npm run study:v0:budget -- --scope=full --budget-levels=12 --budget-min=50000 --budget-max=10000000
npm run study:v0:budget -- --specs=drums_signature --seeds=0 --budgets=50000,100000,200000
npm run study:v0:budget -- --scope=full --out=generated/v0_budget_study/full --resume
```

Outputs are written under `generated/v0_budget_study/<timestamp>/` unless
`--out=<dir>` is provided:

- `study.json`: full structured output, including rows and case summaries.
- `rows.jsonl`: streamed per-cell rows, written as each worker finishes.
- `rows.csv`: flat per-cell table for plotting.
- `analysis.md`: generated Markdown with per-case ASCII curves.

The generated artifacts are intentionally under `generated/` by default because
full runs can be large and should be reproducible from the command.

Use `--resume` with a fixed `--out` directory to continue an interrupted run.
Completed cells already present in `rows.jsonl` or `study.json` are skipped.

## Cell Schema

Each LDS budget cell records:

- `name`
- `seed`
- `budget_units`
- `elapsed_ms`
- `work_units`
- `sim_frames`
- `budget_exhausted`
- `overshoot_units`
- `overshoot_ratio`
- `wall_ms_per_work_unit`
- `leaves_scored`
- `max_discrepancy_started`
- `full_score`
- `passed`
- `axis_quality`
- `contract_gated_quality`
- `track_hash`

Greedy reference rows use `strategy=legacy` and `budget_units=null`.

## Interpretation Rules

Monotonicity is judged on contract-gated quality:

```text
0 if the hard contract fails
axis_quality if the hard contract passes
```

The expected LDS shape is:

- Low budgets may return the deterministic subfloor fallback.
- The first valid search leaf is discrepancy 0.
- Later budgets append leaves in deterministic order.
- Quality may jump when a later discrepancy finds a passing or better cascade.
- Quality may then remain flat while more leaves are explored but fail to beat
  the incumbent.

Flat curves are acceptable. Downward curves are not.

Overshoot is expected because budget checks occur at operation boundaries. The
study records overshoot distribution so the bounded-overshoot assumption can be
checked empirically.

## Current Checkpoint

The latest committed local evidence is summarized in
`docs/optimizer/v0_anytime_lds.md`. The full empirical study has not yet been
run to completion after the native-start and metering changes.

One default-factor smoke gate has passed:

```bash
npm run accept:v0 -- --specs=drums_signature --seeds=0 \
  --factors=0.35,0.7,1 --skip-determinism --skip-baseline --json
```

Summary:

```text
ok: true
spec: drums_signature
seed: 0
budgets: 0.35, 0.7, 1.0 times budgetFor(spec)
contract_gated_quality: 0.5683, 0.5683, 0.5683
leaves: 3, 4, 5
wall_ms_per_work_unit cv: 0.0562
```

Observed shape: the incumbent quality is already found by the lowest checked
default-factor budget, then additional leaves are scored without displacing it.
That is the expected monotone saturation shape for this case.

## Interrupted Full Study Checkpoint

Checkpoint captured on May 28, 2026 from this command:

```bash
npm run study:v0:budget -- --scope=full --concurrency=4 \
  --out=generated/v0_budget_study/full_2026-05-28 --resume
```

The checked-in suite currently contains 8 golden specs, so this full run is
360 rows:

```text
8 specs x 5 seeds x 8 LDS budgets + 40 greedy reference rows
```

This run was interrupted after it exposed a concrete implementation gap in the
native LDS path. The streamed rows remain useful diagnostic evidence, but they
are not acceptance evidence for the current implementation.

At 79 streamed rows, the partial analyzer showed:

```text
lds rows: 71
legacy rows: 8
completed LDS spec/seed curves: 6
monotonicity failures: 0
leaf-prefix failures: 0
wall_ms/work_units cv: 0.2269272
overshoot p50: 371516 work units
overshoot p95: 951043 work units
max overshoot: 1451739 work units
```

This is not acceptance evidence because the run is incomplete and predates the
final-validation recovery fix. It is still useful evidence for two reasons:

- The prefix and monotonicity invariants are holding on the completed curves
  observed so far.
- The sweep has already exposed a concrete compatibility risk that would have
  been hidden by a smaller smoke test.

The important pre-fix risk row was `drums_pendulum`, seed `1`:

```text
budget      LDS contract-gated quality   LDS hard contract   leaves scored
50000       0.0000                       fail                1
100000      0.0000                       fail                1
200000      0.0000                       fail                1
500000      0.0000                       fail                2
1000000     0.0000                       fail                2
2000000     0.0000                       fail                4
5000000     0.0000                       fail                7
10000000    0.0000                       fail                14
legacy      0.4808                       pass                n/a
```

The LDS candidates in this row do improve raw axis quality, reaching roughly
`0.5785`, but they still fail the hard contract, so their contract-gated
quality remains zero. This showed that the native LDS path needed to express
legacy's assembled-track final-validation recovery as deterministic leaf
variants. A follow-up fix added that behavior without invoking legacy as a
mandatory prelude.

## Final-Validation Recovery Probe

After adding final-validation recovery leaves, the focused blocker curve under
the original trajectory-read unit was:

```bash
npm run study:v0:budget -- --specs=drums_pendulum --seeds=1 \
  --budgets=500000,1000000,2000000 --concurrency=1 \
  --out=generated/v0_budget_study/recovery_probe_pendulum_seed1_curve --quiet
```

Result:

```text
ok: true
rows: 4
monotonicity_ok: true
prefix_ok: true
wall_ms/work_units cv: 0.0321190
```

Curve:

```text
budget      work       leaves  pass  contract-gated quality
500000      1012312    2       no    0.0000
1000000     1012312    2       no    0.0000
2000000     2342265    4       yes   0.4816
legacy      1094528    n/a     yes   0.4808
```

The recovered LDS row first passes at `2M` requested work units and slightly
beats the greedy reference for the same `(spec, seed)`.

Acceptance-runner check:

```bash
npm run accept:v0 -- --specs=drums_pendulum --seeds=1 \
  --factors=0.25,0.5,1 --skip-determinism --skip-baseline --json
```

Result summary:

```text
ok: true
contract-gated quality: 0.0000, 0.4816, 0.4816
leaves: 2, 3, 4
wall_ms/work_units cv: 0.0343337
```

This is targeted compatibility evidence for the blocker row. It does not
replace the representative or full acceptance sweeps.

## Physics-Unit Correction

A second interrupted post-recovery full study showed that trajectory reads were
not a stable enough work unit once `drums_crescendo` entered the sample:

```text
elapsed_ms / trajectory_frames_read cv: 0.3198404
elapsed_ms / physics_frames_computed cv: 0.1217059
```

The budget unit was therefore corrected to:

```text
sim_frames == physics_frames_computed
work_units_used == 16 * sim_frames
```

The scale factor keeps the existing budget magnitudes roughly comparable while
charging the engine work that actually predicts wall-clock.

Focused blocker curve under the corrected unit:

```bash
npm run study:v0:budget -- --specs=drums_pendulum --seeds=1 \
  --budgets=500000,1000000,2000000 --concurrency=1 \
  --out=generated/v0_budget_study/physics_unit_probe_pendulum_seed1_curve --quiet
```

Result:

```text
ok: true
monotonicity_ok: true
prefix_ok: true
wall_ms/work_units cv: 0.0124687
contract-gated quality: 0.0000, 0.0000, 0.4816
```

Cross-spec probe over the specs that exposed the CV problem:

```bash
npm run study:v0:budget -- \
  --specs=drums_signature,drums_pendulum,drums_crescendo \
  --seeds=0 --budgets=500000,2000000 --concurrency=1 \
  --out=generated/v0_budget_study/physics_unit_probe_cross_spec --quiet
```

Result:

```text
ok: true
monotonicity_ok: true
prefix_ok: true
wall_ms/work_units cv: 0.0765867
```

This is targeted evidence that the corrected unit fixes the observed
cross-spec predictability problem. Full-suite Property 2 evidence is still
pending.

## Acceptance Status

This study is not complete until at least the representative scope has been run
and analyzed. Legacy removal still requires the acceptance gates in
`docs/compiler_goals.md`, including full-suite monotonicity, budgeted
determinism, work-unit predictability, baseline parity, and the final cutover
audit.
