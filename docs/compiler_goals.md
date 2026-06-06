# Compiler Goals

The compiler turns a musical/rhythm `Spec` into a Line Rider `Track` and
`DriftReport`. The active compiler is `compileHandoff` in
`scripts/v0/optimizer/handoff.ts`.

## Contract

1. **Budget is an input.** Each budget is an independent full run from scratch; the
   search may use the requested budget to drive effort allocation. Passing N budgets
   means N runs (no anytime/shared-checkpoint mode). Monotonicity across budgets is a
   reported diagnostic, not a contract — a budget-aware search may legitimately spend
   a small budget differently than a prefix of a large-budget run.
2. **Wall-clock predictability.** Sim-frame budget should be a meaningful runtime
   knob. Wall-clock is measured for diagnostics, never used in scoring.
3. **Cheat resistance.** Work is charged as simulated rider frames at the
   trajectory-extraction boundary. Extra physical validation must show up as more
   charged frames.
4. **Determinism.** The same `(spec, seed, budget)` must produce a byte-identical
   `Track` for a given compiler build.

## Held Constant

The compiler work does not change:

- `Spec` and `DriftReport` shapes
- `lr-core` physics
- detector semantics
- per-run scoring formula (`score.ts`) and `EVALUATOR_FINGERPRINT`
- axis definitions and normalization
- golden specs
- contact/off-beat/survival hard-contract semantics

(The HEADLINE aggregation and the accept/reject decision rule are **not** part of
this frozen ruler — they live in `metric.ts` and `analyze_golden_curve.ts decide`
and may evolve independently of the per-run scorer.)

## Acceptance

- `tests/optimizer_handoff.test.ts` checks the budget-search contract and
  handoff-specific diagnostics.
- `tests/v0_determinism.test.ts` checks byte-identical output for representative
  specs at a fixed budget.
- `LR_ENGINE=wasm npm run golden` runs the full suite (12 seeds {0..11}, budgets
  `{25,50,100,150,200}k`) and reports the **HEADLINE** metric (the budget-value-weighted
  average of the per-budget suite scores) plus the per-budget curve. For the full run use
  `--jobs=6` unless you deliberately need a different worker count.
- To decide a change is a real improvement, run
  `npm run decide -- <candidate>/golden.json <baseline>/golden.json` — a paired
  cluster-bootstrap VERDICT (accept iff the headline-Δ is significant one-sided at
  α=0.05, i.e. `P(Δ≤0) < 0.05`), with
  per-budget deltas reported. Validity is reported per budget but does not gate. Raw
  score deltas are not an acceptance rule; promotion thresholds live in active campaign docs.

Any compiler change should preserve these tests and report its impact through the
golden breakdown: the `headline` block (score / weight_by_budget / tier / validity),
per-budget scores, pass/fail rows, checkpoint hashes, worst contacts, worst axes,
and `compile_stats`.
