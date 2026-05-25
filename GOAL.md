# Goal — improve the v0 compiler's benchmark score

Maximize `total_score` from:

```
npx tsx scripts/v0/benchmark.ts --json
```

Higher = better. Each iteration: make a change → re-run benchmark → keep if improved, revert if not. Benchmark takes ~15 minutes.

## Score

Per spec:
```
hits  −  5 · axis_error_total  −  100 · off_beat_landings  −  100 · died
```
Summed across 5 benchmark specs at `seed=0`. Off-beat landings and rider death are catastrophic; axis fidelity matters; hits dominate.

## What you can change

Anything in `scripts/v0/` **except**:
- `scripts/v0/benchmark.ts` and `scripts/v0/specs/` — locked (would game the metric)
- `GOAL.md` — locked

The biggest leverage is usually in `scripts/v0/compile.ts` (candidate generation, cost function, bisection, backtracking) and the `CALIB` constants in `scripts/v0/types.ts`.

## Hard contract — preserve or revert

1. **Determinism**: same `Spec` + same `seed` → byte-identical `Track`. No unseeded `Math.random()`, no time-based inputs, no unordered iteration affecting output.
2. **lr-core in the loop**: every geometric decision validated by the engine (`extractRawTrajectory` + `detect`). No approximate-physics planning.
3. **`compile(spec, seed) → { track, report }`** signature and `DriftReport` shape (see `types.ts`) stay stable.
4. **All hard constraints** (Contact ±1f, survival, no off-beat landings) already enforced — don't loosen them.

## Context

`DESIGN.md` for architecture; `DECISIONS.md` for the why behind each choice (including v0 limitations).

The current compiler is weakest on multi-axis specs (`drums_chunky`, `drums_speed_test`) and on axis fidelity when targets sit at the edge of feasibility (`drums_aerial` achieves air=0.75 vs target 0.85). Small, isolated commits with `perf(v0): X — score N → M` messages make reverts easy.
