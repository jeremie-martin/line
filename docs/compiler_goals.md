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
- frozen V4 catalog, evaluator and suite fingerprint within a comparison
- axis definitions and normalization
- historical benchmark cases and qualification references when running their diagnostics
- contact/off-beat/survival hard-contract semantics

The current evaluation contract is [Benchmark V4](../benchmark/v4/README.md).
Historical V2 sequential decisions remain reproducible under their own protocol.

## Evaluation and design decisions

Use [HOW_TO_WORK](HOW_TO_WORK.md) for current commands and
[goal.md](../goal.md) for the accepted result. Canonical V4 covers the complete
176-specification panel at seeds 16/17 and 750,000 physics frames per run.
Report headline movement, validity, significant case/group changes, distinct
tracks and actual work. Separate jitter and other diagnostic studies from the
canonical result. Identical zero-jitter seed replicas are not independent samples.

The owner values maintainability and extensibility alongside performance.
A material simplification can justify a small measured score tradeoff after
investigation; individual regressions do not create an additional perfection
veto. Keep coherent normal type-0 arcs and use video review for visual changes.

Focused tests cover the changed compiler paths, determinism, physical validity
and budget accounting. Legacy handoff tests remain relevant to the retained
fallback, rather than defining the arc planner's architecture. Preserve compact
reproducible evidence and document material limitations.
