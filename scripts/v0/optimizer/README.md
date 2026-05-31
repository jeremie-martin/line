# scripts/v0/optimizer

The active v0 compiler is `compileHandoff` in `handoff.ts`.

The compiler searches partial track prefixes at gap boundaries. Each node carries
the committed gap fits, the current engine prefix, and the next line id. The
search expands one gap at a time, ranks catch candidates by local fit plus a
fixed future-contact feasibility preview, and keeps the best complete-or-partial
output in a strict best-so-far register.

## Contract

1. **Determinism.** Same `(spec, seed, budget)` produces the same track.
2. **Budget monotonicity.** Budget only truncates a deterministic node sequence;
   it is never an input to candidate policy.
3. **Cheat resistance.** Work is metered in simulated rider frames at the
   trajectory-extraction boundary.
4. **Engine honesty.** Every geometric decision is validated by `lr-core` and the
   detector before it can be scored.

## Components

```
sample.ts       sample one candidate catch from a prefix state
solver.ts       sample a fixed candidate pool for one gap
node.ts         prefix-search state and deterministic expansion helpers
handoff.ts      compileHandoff public entry point
register.ts     strict best-so-far comparator
polish.ts       clone-and-test polish variants
sim_frames.ts   physics-frame budget instrumentation
types.ts        budget and compile-output types
```

`node.ts`, `sample.ts`, and `solver.ts` are intentionally generic because future
compiler variants should be able to reuse the same candidate and prefix-state
building blocks.

## Benchmark

The default golden compiler is handoff:

```bash
npm run golden
npm run golden -- --compiler=handoff
npm run golden -- --jobs=4 --budget=50000 --compiler=handoff
```

`--compiler=handoff` is kept even though it is currently the only compiler so a
future compiler can be added without changing the CLI shape.
