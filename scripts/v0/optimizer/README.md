# scripts/v0/optimizer

The active v0 compiler is `compileHandoff` in `handoff.ts`.

The compiler searches partial track prefixes at gap boundaries. Each node carries
the committed gap fits, the current engine prefix, and the next line id. The
search expands one gap at a time, sorts candidate pools with the shared
`current_gap_quality * next_gap_readiness` objective, uses the measured handoff
score or mature forward-eval for branch selection, and keeps the best
complete-or-partial output in a strict best-so-far register.

## Contract

1. **Determinism.** Same `(spec, seed, budget)` produces the same Track.
2. **Budget is an input.** Each budget is an independent full run; the search may use
   the requested budget. (Today's search is still budget-oblivious, but that is no
   longer a contract — it is the lever the next project will use.)
3. **Cheat resistance.** Work is metered in simulated rider frames at the
   trajectory-extraction boundary.
4. **Engine honesty.** Every geometric decision is validated by `lr-core` and the
   detector before it can be scored.

## Components

```
sample.ts       sample one candidate catch from a prefix state
solver.ts       sample a fixed candidate pool for one gap
node.ts         prefix-search state and deterministic expansion helpers
aim.ts          enumerative aiming proposer; model proposes, exact sim judges
objective.ts    shared current-quality x readiness objective
arc_model.ts    shared pitch/rotation knob transforms and response models
arc_probe.ts    shared real-engine joint probe evaluator
budget_model.ts structural traversal-cost predictor and budget slack helper
readiness.ts    catchability surface used by composite next-gap readiness
handoff.ts      compileHandoff public entry point
register.ts     strict best-so-far comparator
polish.ts       clone-and-test polish variants
sim_frames.ts   physics-frame instrumentation
types.ts        checkpoint and compile-output types
```

`node.ts`, `sample.ts`, and `solver.ts` are intentionally generic because future
compiler variants should be able to reuse the same candidate and prefix-state
building blocks.

The aiming lane is documented in
[`docs/ARC_STATE_CONTROL.md`](../../../docs/ARC_STATE_CONTROL.md). Its core
contract is that probe rides can fit local models and propose extra candidates,
but every candidate that enters the sorted pool has still passed the normal
engine/detector validation path.

## Legacy V1 Benchmark

These narrow compiler/debug invocations use the archived V1 runner. Current
compiler-development decisions use Benchmark V2 as documented in
[`docs/HOW_TO_WORK.md`](../../../docs/HOW_TO_WORK.md).

```bash
LR_ENGINE=wasm npm run golden:v1 -- --jobs=6
LR_ENGINE=wasm npm run golden:v1 -- --compiler=handoff --jobs=6
LR_ENGINE=wasm npm run golden:v1 -- --budgets=30000,50000,70000 --specs=tiny_dance --seed=0 --jobs=6
LR_ENGINE=wasm node --import tsx scripts/v0/study_budget_spend.ts --budget=200000 --seeds=0,1
```

`--compiler=handoff` is kept even though it is currently the only compiler so a
future compiler can be added without changing the CLI shape.
