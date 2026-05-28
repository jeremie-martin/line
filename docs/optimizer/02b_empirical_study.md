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

## Acceptance Status

This study is not complete until at least the representative scope has been run
and analyzed. Legacy removal still requires the acceptance gates in
`docs/compiler_goals.md`, including full-suite monotonicity, budgeted
determinism, work-unit predictability, baseline parity, and the final cutover
audit.
