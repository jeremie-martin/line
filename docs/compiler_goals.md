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
- Benchmark V2 evaluator and suite fingerprint within a comparison
- axis definitions and normalization
- frozen Benchmark V2 development cases and qualification references
- contact/off-beat/survival hard-contract semantics

(The V2 decision rule has its own fingerprint and explicit execution protocol. Its
contract is `benchmark-v2-decisions.md`.)

## Acceptance

- `tests/optimizer_handoff.test.ts` checks the budget-search contract and
  handoff-specific diagnostics.
- `tests/v0_determinism.test.ts` checks byte-identical output for representative
  specs at a fixed budget.
- `npm run benchmark -- eval --seeds=48 --jobs=48` compares the current compiler
  on the 44 development cases at 750k with the exact immutable active cache.
  It runs strict N=8/16/32/48 waves, so it compiles 352, 704, 1,408, or at most
  2,112 candidate cells. Each wave covers every case and is decided before the
  next wave enters the queue. Arbitrary active-campaign depths are disabled.
- Improvement and simplification outcomes live in the standalone comparison
  artifact. Active improvements use the calibrated sequential rule;
  simplification and explicit deep/historical work remain fixed-N. After an
  acceptance, `rebaseline --from=COMPARISON
  --label=LABEL` explicitly promotes that measured compiler snapshot.

Any compiler change should preserve these tests and report its impact through the
V2 breakdown: headline, budgets, strata, groups, parents, cases, validity flips,
checkpoint hashes, weak contacts/axes, phases, and compiler statistics.
