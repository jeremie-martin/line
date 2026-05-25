# Goal — improve the v0 compiler's benchmark score

You are an autonomous coding agent invoked via `/goal`. Your task: iteratively improve the v0 procedural Line Rider track compiler. Improvement is defined precisely below — a single number.

## How to evaluate

```
npx tsx scripts/v0/benchmark.ts --json
```

This compiles **5 benchmark specs** at seed=0 and prints a JSON object whose top-level field `total_score` is the metric. Higher = better.

Each iteration: make a change → run the benchmark → compare `total_score` to your previous best → keep or revert.

The benchmark takes ~15 minutes on a workstation. Plan your iterations accordingly.

## Score definition

Per spec:

```
score = hits  −  5 · axis_error_total  −  100 · off_beat_landings  −  100 · died
```

- `hits` — number of `Contact` events with status `"hit"` (rider landing within ±1 frame).
- `axis_error_total` — Σ over sections and per-axis of `|achieved − target|`.
- `off_beat_landings` — count of landing events not aligned with any Contact (hard constraint violation).
- `died` — 1 if `terminus.reason !== "endOfSpec"`, else 0.

Total score = Σ score over all 5 benchmark specs.

Weight calibration: 1 hit ≈ 1 point. Reducing axis error by 0.2 ≈ 1 hit. An off-beat landing or a death is catastrophic (≈ 2 specs' worth of hits).

## Baseline (committed snapshot)

The committed code's score is the starting point. Re-run the benchmark on a clean clone to confirm before making changes. Your score must improve from there.

## What you CAN change

Anything in `scripts/v0/` *except* the explicitly-protected files listed below.

Concrete leverage points (suggestive, not exhaustive):

- `scripts/v0/types.ts` → the `CALIB` constants block (per-gap candidate budget `K`, backtrack depth, σ for cross-gap target sampling, Arc parameter bounds, survival margin via compiler edit, etc.).
- `scripts/v0/compile.ts` → candidate generation, hard-gate criteria, cost function weighting, bisection logic, backtracking strategy, retry orchestration.
- `scripts/v0/arc.ts` → Arc → Lines expansion, curveBias semantics.
- New files in `scripts/v0/` that the compiler imports.

## What you CANNOT change

These would be gaming the metric:

- `scripts/v0/benchmark.ts` — the scoring code itself.
- `scripts/v0/specs/*.ts` — the benchmark specs.
- `scripts/v0/specs/_drums.ts` — the spec helper (changing the Contact filter would change the workload).
- `GOAL.md` — this file.
- `beats/drums_0_30s_60_125.json` — the input data.
- Files outside `scripts/v0/`, except as noted under "Hard contract" below.

If you find yourself wanting to change one of these, the right move is almost always to change `compile.ts` or `types.ts` instead.

## Hard contract — must be preserved

These properties were designed in and are validated implicitly by the benchmark. Breaking them invalidates the score even if the number goes up.

1. **Determinism**: same `Spec` + same `seed` → byte-identical `Track` JSON. The benchmark always uses `seed=0`. If you make any change that introduces non-determinism (e.g. unseeded `Math.random()`, current-time inputs, iteration over unordered structures whose ordering affects output), revert it.
2. **No new dependencies**: don't add to `package.json`.
3. **lr-core in the loop**: the compiler must continue to validate every geometric decision against `lr-core` via `extractRawTrajectory` + `detect`. No approximate-physics planning.
4. **The Spec → Track + DriftReport contract**: the function exported by `compile.ts` must remain `compile(spec, seed) → { track, report }` with the same `Track` and `DriftReport` shapes (see `types.ts`).
5. **All hard constraints** (Contact precision ±1f, rider survival, no off-beat landings) — these are already enforced by the existing code; don't relax them. The score penalises violations, but you should aim for zero of each.

If any change you make can't preserve these, revert it.

## Allowed environment

- Node 20+, npm 9+, TypeScript via `tsx`.
- `lr-core` (already a dependency).
- No network access during compilation.
- Single-process execution. The benchmark may parallelise specs internally if you change it to do so (but be careful about determinism if you do).

## What the project is, in 60 seconds

`scripts/v0/` compiles a **Spec** (= timeline of hard `Contact` events + soft `Section` axes describing per-section style) into a Line Rider **Track** (= JSON of line geometry the engine consumes) plus a **DriftReport** (= per-Contact, per-Section achievement breakdown).

The compiler walks gaps between Contacts in time order. For each gap, it generates K candidate Arc placements via wide random parameter sampling, bisects each Arc's anchor-Y for Contact precision (must land within ±1 frame), filters by a hard gate (survival, no off-beat landings), ranks survivors by aggregate axis cost, and commits the best. Bounded cross-gap backtracking handles local failures. A final-track validator catches off-beat landings introduced by gap interactions and retries with the next candidate.

Variety is structural: a seeded RNG threaded throughout means same-seed determinism plus genuine cross-seed variation.

For full context: `DESIGN.md` (architecture, axis definitions, algorithm), `DECISIONS.md` (the why behind each design choice, including deferred items).

## Tactical suggestions

You're not required to follow these. They reflect findings from earlier sessions about where the compiler is weakest.

- **Multi-axis specs (`drums_chunky`, `drums_speed_test`, multi-axis combos)** are where the current compiler struggles most. The cost function weights axes equally; consider whether that's right. The cross-gap target sampling spread (σ) may need different values per axis.
- **The candidate generator** in `sampleArcParams` is the heart of the system. It currently does uniform random sampling within bounds with a coarse grain-bias heuristic. There's substantial room for smarter sampling that's informed by the rider's current state (incoming vy, vx, position) — e.g. picking startAngle near the rider's velocity angle.
- **The bisection** in `bisectAnchorY` could potentially be replaced or supplemented by a smarter search; it currently uses a simple binary bisection with a coarse grid fallback. ~18 simulations per candidate is a lot.
- **Backtracking** is bounded at depth 2. If failures are correlated across consecutive gaps, deeper backtracking or larger candidate pools might help.
- **`SURVIVAL_MARGIN = 16`** in `compile.ts:tryCandidate` is a hardcoded magic number. It controls how many frames past landing the rider must survive for a candidate to pass the hard gate. Worth experimenting with.
- **First-gap physics**: the first Contact requires the rider to have catchable kinetic state. The spec helper `_drums.ts` already drops `t < 0.5s` contacts. No need to revisit.

## Reporting

After each successful improvement, commit with a clear message (`perf(v0): X — score N → M`). Use small, isolated commits — one experiment per commit makes it easy to revert just the bad one.

Good luck.
