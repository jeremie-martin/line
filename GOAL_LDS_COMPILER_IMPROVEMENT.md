# Goal - improve the compiler

> **Read this first.** Optimize the compiler, not a local proxy.
>
> - **Metric:** `HEADLINE` = the **budget-value-weighted average** of the per-budget
>   suite scores over the canonical grid. Weights are proportional to budget value
>   (higher-quality expensive runs matter more; lower budgets still count). `ceiling`
>   and `logAUC` are reported **secondaries only**, not the decision scalar.
> - **Runs are independent per budget.** Passing N budgets means **N full runs from
>   scratch** — there is no anytime/shared-checkpoint mode. The budget is an input.
> - **Canonical decision:** 40 specs × 12 seeds `{0..11}` × budgets
>   `{125,250,375,500}k`, judged by `npm run decide`.
> - **Engine:** use `LR_ENGINE=wasm` for compiler, benchmark, verification, and
>   performance commands that run physics. Pure analyzers such as `npm run decide`
>   do not need it.
> - **Jobs:** use `--jobs=32` for golden runs.
> - **Promotion gate:** a **canonical-tier** `VERDICT: ACCEPT` — a standard one-sided
>   significance test at α=0.05 on the paired bootstrap (`P(Δ≤0) < 0.05`). There is no
>   separate absolute-`Δ` floor — significance is the bar, and it self-widens at 12 seeds.

## Objective

Carefully improve `compileHandoff`, the compiler that turns a musical `Spec` into
a beat-synced Line Rider `Track`.

This is a trajectory-constrained procedural-generation problem with fragile forward
dependency: every local catch changes the rider state that future catches inherit.
The compiler should convert its allotted simulated-frame budget into the best, most
reliable track it can **at that budget**. The budget is an input the search may use:
each budget is its own optimization target, run independently from scratch.

Good changes are generic compiler improvements: better prefix search, candidate
generation, validation, ranking, reuse, repair, start handling, budget allocation,
or performance that preserves the measured contract. The route is open; the ruler is
not.

## What Success Means

A candidate succeeds only when the canonical decision says it does.

```bash
npm run decide -- <candidate>/golden.json <baseline>/golden.json
```

Keep/promote a change only when:

- `decide` prints `VERDICT: ACCEPT` on a **canonical-tier** comparison. ACCEPT is a
  standard one-sided significance test at α=0.05 on the paired bootstrap
  (`P(Δ≤0) < 0.05`); there is no separate absolute-`Δ` floor;
- the mechanism is generic, deterministic per `(spec, seed, budget)`, and not keyed to
  the benchmark specs.

Validity (`contract_passed`) is **reported as a diagnostic, never a gate**: an invalid
run already scores ~0, and the per-budget 12-seed aggregation folds that into the
score, so a separate veto is redundant. Watch the reported per-budget validity rates,
but the decision is the weighted-average score delta alone.

After an accepted promotion, commit it before starting the next mechanism and treat
that candidate as the new baseline. Re-run the baseline only after a kept change or a
deliberate ruler/scope change.

## Run Workflow

Use normal full canonical runs for this campaign. A canonical run is the full
40-spec × 12-seed × `{125,250,375,500}k` budget grid, launched with
`LR_ENGINE=wasm` and `--jobs=32`, with no spec, seed, or budget overrides.

Give every baseline and candidate a clear archive label so attempts stay identifiable
in `generated/golden-runs/` and in the dashboard. The label is the archive directory
name supplied through `--archive-dir`; use names such as `baseline-<commit>` or
`attempt-<mechanism>-a01`. **Never compare raw headline scalars across runs — decide
only by comparing canonical `golden.json` archives with `npm run decide`.**

```bash
# Current baseline of record, only when a fresh baseline is needed.
LR_ENGINE=wasm npm run golden -- \
  --jobs=32 \
  --archive-dir=generated/golden-runs/<baseline-label>

# Candidate attempt: the normal full canonical run for a mechanism.
LR_ENGINE=wasm npm run golden -- \
  --jobs=32 \
  --archive-dir=generated/golden-runs/<attempt-label>

# Decision against the current baseline of record.
npm run decide -- \
  generated/golden-runs/<attempt-label>/golden.json \
  generated/golden-runs/<baseline-label>/golden.json
```

For compiler tests and verification, also use the WASM engine:

```bash
LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts
LR_ENGINE=wasm npm run verify
```

> **`npm run verify` is the engine-parity gate, not a quality gate.** `verify:engine`
> + `verify:optimizer` assert the compiler output is byte-identical to a recorded
> baseline — that is the correctness gate for **engine-speed** work
> (`docs/engine_speed_methodology.md`), where the output must NOT change. A
> **compiler-quality** change *intends* to change the output, so `verify:optimizer`
> is *expected* to diverge: re-baseline it with `npm run verify:optimizer -- --update`
> on the accepted HEAD (the same way you re-baseline the golden HEADLINE). Don't
> "fix" a quality change to satisfy the byte-identity baseline.

## Rules That Must Not Move

- The search must be **deterministic per `(spec, seed, budget)`** — the same inputs
  produce a byte-identical Track. (It may read the budget; it must not read wall-clock.)
- No spec-name branches, no thresholds that identify the test suite indirectly, and no
  logic tuned to a single seed, budget, or known fragile row. Tuning to the *canonical
  budget grid as a whole* is also overfitting — the grid is a fixed estimator for a
  wider budget distribution, not the only budgets we care about.
- Do not edit the scorer, golden specs, evaluator fingerprint, metric, seed set, or
  budget grid to make a compiler change look better. If the ruler changes deliberately,
  re-baseline and compare only like with like.
- Wall-clock is diagnostic only. The work budget is simulated rider frames.

## How To Think About Changes

Start from the failure shape, not from a favorite knob:

- At a given budget, where does the search stop converting compute into quality?
- Which rows flip validity, miss contacts, land off-beat, die, or plateau?
- Are full evaluations starved, duplicate, too local, too expensive, or ranking the
  wrong prefixes?
- Does a local improvement preserve the future state needed by later contacts?
- Could the search spend its budget better — more useful alternatives, less duplicate
  work, earlier convergence at the cheap budgets and a higher ceiling at the expensive
  ones?

## Reading Results

Read the `headline` block first: `score`, `tier`, `weight_by_budget`, the per-budget
`budget_scores`, `validity`, and the secondaries `ceiling`/`log_auc`. Then inspect:

- per-budget score and validity curves;
- largest per-budget regressions and improvements;
- `compile_stats` for search depth, full evaluations, duplicates, repair attempts,
  candidate viability;
- worst contacts and worst axes for rows that changed.

Do not trust an eyeballed HEADLINE delta. The metric rationale in
`docs/metric_problem_statement.md` (historical) shows why paired comparisons matter and
how seed count trades against resolvable effect size (24 seeds resolve ~5-point gains;
the current 12-seed population is lower-power by design, for the high-gain phase, with
the bootstrap CI widening to match).
