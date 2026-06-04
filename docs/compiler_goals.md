# Compiler Goals

The compiler turns a musical/rhythm `Spec` into a Line Rider `Track` and
`DriftReport`. The active compiler is `compileHandoff` in
`scripts/v0/optimizer/handoff.ts`.

## Contract

1. **Monotonicity in compute.** For the same `(spec, seed)`, a larger sim-frame
   budget checkpoint must not return a worse register key than a smaller budget.
   The search policy must be deterministic and budget-independent; budgets only
   snapshot/truncate the node sequence.
2. **Wall-clock predictability.** Sim-frame budget should be a meaningful runtime
   knob. Wall-clock is measured for diagnostics, never used in scoring.
3. **Cheat resistance.** Work is charged as simulated rider frames at the
   trajectory-extraction boundary. Extra physical validation must show up as more
   charged frames.
4. **Determinism.** The same `(spec, seed, budgets)` must produce
   byte-identical checkpoint `Track`s for a given compiler build.

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
- `npm run golden` runs the full suite (8 seeds {0..7}, dense 5k–175k grid) and
  reports the **HEADLINE** metric (`α·q(b_max) + (1−α)·logAUC`, α=0.7) plus the
  per-budget curve and the legacy CURVE_SCORE. For the full run pass
  `--jobs=$(( $(nproc) / 2 ))` (a full `--jobs=$(nproc)` can OOM — ~1 GB/worker).
- To decide a change is a real improvement, run
  `npm run decide -- <candidate>/golden.json <baseline>/golden.json` — a paired
  cluster-bootstrap VERDICT (accept iff the headline-Δ CI lower bound > 0 and
  validity does not regress at the ceiling budget). The old fixed "+5" threshold is
  retired; it is inside the measured noise (`docs/metric_problem_statement.md`).

Any compiler change should preserve these tests and report its impact through the
golden breakdown: the `headline` block (score / ceiling / logAUC / validity),
per-budget scores, pass/fail rows, checkpoint hashes, worst contacts, worst axes,
and `compile_stats` (CURVE_SCORE retained as a legacy secondary).
