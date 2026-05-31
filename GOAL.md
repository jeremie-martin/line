# Goal - handoff compiler

Maximize `goal_score` over the golden specs in `specs/golden/`, evaluated across
fixed seeds `[0, 1, 2]`, using the handoff compiler.

## Run

```bash
npm run golden
npm run golden -- --details
npm run golden -- --json
npm run golden -- --variants
npm run golden -- --jobs=4 --budget=40000 --compiler=handoff
```

`handoff` is the default compiler. `--compiler=handoff` remains supported so the
CLI is ready for future compiler implementations.

## Score

Per spec/seed, `scripts/v0/score.ts` computes:

```text
spec_seed_score =
  1000
  * axis_quality
  * drift_quality
  * missing_quality
  * off_beat_quality
  * survival_quality
```

`contract_pass_rate` is the shippability signal: a row passes only when every
hard invariant is met:

- no drifted contacts
- no missing contacts
- no off-beat landings
- terminus is `endOfSpec`

## Compiler Contract

- Same `(spec, seed, budget)` must produce a byte-identical track.
- Budget is simulated rider frames, charged at the detector/trajectory boundary.
- Budget is a stop condition, not a policy input.
- Every candidate must be validated by `lr-core`; no approximate physics can emit
  a track.
- Measured axes in `DriftReport` must come from the finished track.

## What To Change

High-leverage areas:

- `scripts/v0/optimizer/handoff.ts`
- `scripts/v0/optimizer/node.ts`
- `scripts/v0/optimizer/sample.ts`
- `scripts/v0/optimizer/solver.ts`
- `scripts/v0/optimizer/polish.ts`
- handoff-facing constants and diagnostics in `scripts/v0/types.ts`

Do not change the scorer, golden specs, physics constants, or detector semantics
to improve the score.

For the low-budget campaign details, see `GOAL_LDS_LOW_BUDGET.md`.
