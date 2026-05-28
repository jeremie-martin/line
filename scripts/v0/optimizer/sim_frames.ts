/**
 * sim-frames work-unit instrumentation (honest physics-frame metering).
 *
 * The counter lives in `scripts/lib/detector.ts` and charges only frames
 * the engine ACTUALLY simulates — measured as the delta in
 * `engine.getLastFrameIndex()` across each extraction and each metered
 * `getRider`. lr-core caches simulated frames, so re-reading an
 * already-computed frame costs zero. (The older read-count,
 * `getFrameCount()`, billed every read including cache hits, over-counting
 * by ~12-27× empirically; it is kept only as a secondary cross-check.)
 * Because every extraction in a compile flows through the detector — incl.
 * the legacy `tryCandidate` path the LDS compiler reuses via `sample.ts` /
 * `solver.ts`, plus the metered raw `getRider` probes — `getSimFrames()`
 * reflects the total physics work of a compile, not just the LDS layer.
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
  getPhysicsFrameCount as getSimFrames,
  resetFrameCount as resetSimFrames,
} from "../../lib/detector.ts";
