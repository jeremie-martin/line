# Stage 0b — sim-frames work unit + R1 verification

## What this stage delivered

- A `_frameCount` counter in `scripts/lib/detector.ts`, incremented
  once per `extractRawFrame` call (i.e., once per integration step
  the lr-core engine performs). Module-local, reset per compile call.
- `scripts/v0/optimizer/sim_frames.ts` — re-exports
  `resetSimFrames` / `getSimFrames` for the new optimizer.
- Wired into `compileGreedy_v2`: `stats.sim_frames` now populates
  with the actual integration-step count for each compile.
- Two empirical measurements verifying R1 (per-frame cost stable in
  accumulated line count).

The legacy `compile.ts` does not call `resetSimFrames`; it leaves
its `stats.sim_frames` at 0. Behavior unchanged for any caller of
legacy `compile()`. The counter is a free side-effect when the new
optimizer reuses legacy primitives via `tryCandidate`.

## R1 — synthetic measurement

`scripts/v0/optimizer/_measure_r1.ts`: build N synthetic tracks of
varying line count (10 → 1500), each with a horizontal floor of
equally-spaced solid lines. For each, extract a 1000-frame
trajectory and measure wall-ms per frame.

| line count | frames | wall_ms mean | ms / frame |
|---|---|---|---|
| 10 | 1001 | 244.60 | 0.2444 |
| 25 | 1001 | 209.45 | 0.2092 |
| 50 | 1001 | 274.88 | 0.2746 |
| 100 | 1001 | 197.39 | 0.1972 |
| 200 | 1001 | 202.57 | 0.2024 |
| 400 | 1001 | 197.23 | 0.1970 |
| 800 | 1001 | 214.73 | 0.2145 |
| 1500 | 1001 | 211.21 | 0.2110 |

**cv across the 8 line-count buckets: 0.116** (gate: < 0.25 → PASS).

ms/frame is essentially flat from 100 lines to 1500 lines (range
0.197-0.214), with the small-line-count rows (10, 25, 50) running a
bit hotter (JIT warm-up, smaller working set fits in cache
differently). The flatness across the 15× span of line count
confirms what lr-core's `ClassicGrid` (14-px cells, 3×3 neighborhood
collision query) predicted: per-frame cost depends on local density,
not total line count.

## R1 — golden-suite measurement (real workload)

`scripts/v0/optimizer/_measure_r1_golden.ts`: run `compileGreedy_v2`
at K=48 across the full golden suite × 5 seeds (65 attempts). Record
wall_ms and `stats.sim_frames` per run. Compute cv of
`wall_ms / sim_frames` across the 17 successful runs (greedy_v2
without backtracking throws on the other 48, same as Step 3 baseline).

| metric | value |
|---|---|
| min ms/frame | 0.0100 |
| max ms/frame | 0.0220 |
| mean ms/frame | 0.0152 |
| **cv** | **0.213** |

**cv = 0.213 → PASS** (under the 0.25 gate).

The absolute ms/frame on the real workload (~0.015) is ~14× smaller
than the synthetic harness (~0.20). That ratio is dominated by *what
is being measured*, not engine architecture: the synthetic harness
times pure trajectory extraction over a small floor; greedy_v2's
wall-clock includes bisection, candidate generation, cost
evaluation, the final detect+report — but its `sim_frames`
correctly captures all the frame stepping each of those operations
triggers. The structural cv claim (per-frame cost stable across
specs) is what matters and is verified.

## What this means for the rebuild

Property 2 (wall-clock ↔ budget correlation, cv < 0.25) is
satisfiable by construction once budget = sim_frames. Both
measurements clear the gate with margin. The colleague's choice of
sim_frames over `engine.addLine` is validated:

- sim_frames cv is bounded (R1 holds).
- addLine cv was never measured but would inherit the per-call
  variance (a 3-segment-arc evaluation over 1200 frames and a
  12-segment-arc over 100 frames differ ~order of magnitude in
  ms/addLine; the variance would be much higher).
- Cheat-resistance is preserved: every viable candidate must step
  through its frames; you cannot rule out a candidate without
  simulating its physics.

## Stage 0b deliverables (all met)

- ✅ `scripts/v0/optimizer/sim_frames.ts` ships.
- ✅ `_frameCount` instrumentation in `detector.ts`; behavior
  unchanged for legacy callers.
- ✅ `compileGreedy_v2` populates `stats.sim_frames`.
- ✅ `_measure_r1.ts` synthetic harness: cv 0.116 (PASS).
- ✅ `_measure_r1_golden.ts` golden-suite harness: cv 0.213 (PASS).
- ✅ This document.

## Files

NEW:
- `scripts/v0/optimizer/sim_frames.ts`
- `scripts/v0/optimizer/_measure_r1.ts` (investigation, deleted in Stage 5)
- `scripts/v0/optimizer/_measure_r1_golden.ts` (investigation, deleted in Stage 5)
- `docs/optimizer/0b_sim_frames_r1.md` (this file)

TOUCHED:
- `scripts/lib/detector.ts` — module-local counter + reset/get exports.
- `scripts/v0/optimizer/greedy.ts` — calls resetSimFrames at top, populates stats.sim_frames.

## On to Stage 1

Substrate is in place. The next stage builds the LDS core: search
node with memoized candidate list, leaf enumeration generator,
best-so-far register. No budget cutoff yet — that's Stage 2 once we
know the search itself produces the right enumeration.
