# Compiler Goals

The compiler turns a musical/rhythm `Spec` into a Line Rider `Track` and
`DriftReport`. The active compiler is `compileHandoff` in
`scripts/v0/optimizer/handoff.ts`.

## Contract

1. **Monotonicity in compute.** For the same `(spec, seed)`, a larger sim-frame
   budget must not return a worse register key than a smaller budget. The search
   policy must be deterministic and budget-independent; budget only truncates the
   node sequence.
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
- scoring formula
- axis definitions and normalization
- golden specs
- contact/off-beat/survival hard-contract semantics

## Acceptance

- `tests/optimizer_handoff.test.ts` checks the budget-search contract and
  handoff-specific diagnostics.
- `tests/v0_determinism.test.ts` checks byte-identical output for representative
  specs at a fixed budget.
- `npm run golden` is the full-suite score.
- `npm run golden -- --jobs=4 --budget=40000 --compiler=handoff` is the current
  low-budget campaign metric.

Any compiler change should preserve these tests and report its impact through the
golden breakdown: per-spec score, pass/fail rows, worst contacts, worst axes, and
`compile_stats`.
