/**
 * Stage 0b — sim-frames work-unit instrumentation.
 *
 * The counter itself lives in `scripts/lib/detector.ts` so it
 * automatically captures EVERY frame extraction in the system —
 * including those made by the legacy compile.ts's `tryCandidate`
 * path, which the LDS compiler reuses via `sample.ts` and
 * `solver.ts`. This means `getSimFrames()` reflects the total
 * physics work done in a compile call, not just the work done at
 * the LDS layer.
 *
 * Why this is the right work unit: per-frame stepping is what
 * dominates wall-clock in lr-core. `engine.addLine` registers
 * geometry into the spatial grid (cheap, amortized over a few
 * cells); `getRider(f)` and `getUpdatesAtFrame(f)` advance the
 * rider through frames (the actual physics integration).
 *
 * R1 (verified): lr-core's `ClassicGrid` uses 14-px cells with 3×3
 * neighborhood collision queries. Per-frame cost is O(local density),
 * not O(total lines). Empirical confirmation in `_measure_r1.ts`.
 *
 * Cheat-resistance (Property 3): you cannot establish a candidate's
 * physical viability without simulating its frames, so any genuine
 * extra search work eventually shows up as more frames and is
 * charged proportionally. Non-simulating work (geometry math,
 * ranking, cache lookups) doesn't change the physical result and
 * shouldn't be charged.
 *
 * Non-reentrant: relies on the existing single-compile-at-a-time
 * invariant. Web Workers each have their own module instance, so
 * parallel compiles across workers are isolated.
 */

export {
  getFrameCount as getSimFrames,
  resetFrameCount as resetSimFrames,
} from "../../lib/detector.ts";
