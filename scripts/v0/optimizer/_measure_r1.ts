/**
 * Stage 0b — R1 empirical measurement.
 *
 * Verifies that per-frame cost in lr-core is approximately constant in
 * accumulated line count (the spatial-grid assumption). This is the
 * load-bearing external assumption for `sim_frames` as the work unit:
 * if it fails, Property 2 (wall-clock predictability) cannot hold.
 *
 * Usage:  tsx scripts/v0/optimizer/_measure_r1.ts
 *
 * Method:
 *   1. Build N synthetic tracks of varying total line counts.
 *   2. For each, extract a fixed-length trajectory; measure wall_ms
 *      per frame (= wall_ms / frame_count).
 *   3. Compute coefficient of variation across line counts.
 *   4. Report. Gate: cv < 0.25.
 *
 * Tracks are built from a fixed geometry pattern (horizontal solid
 * lines, evenly spaced) — enough to exercise the engine's collision
 * grid without depending on any particular spec's structure.
 *
 * This is investigation-only — removed in Stage 5.
 */

import { performance } from "node:perf_hooks";
import { LineRiderEngine } from "../../lib/_lr_engine.ts";
import {
  extractRawTrajectory,
  getFrameCount,
  resetFrameCount,
} from "../../lib/detector.ts";

const FRAME_BUDGET = 1000;
const LINE_COUNTS = [10, 25, 50, 100, 200, 400, 800, 1500];
const REPEATS = 5;

type Row = {
  line_count: number;
  frame_count: number;
  wall_ms_mean: number;
  wall_ms_per_frame: number;
};

function makeSyntheticEngine(lineCount: number) {
  // Build a horizontal floor of N short line segments below the rider's
  // starting position. The rider (default start near 0,0 with x-velocity
  // 0.4) ends up sliding along these lines, exercising the collision
  // grid without requiring a real spec.
  // deno-lint-ignore no-explicit-any
  let eng: any = new LineRiderEngine();
  for (let i = 0; i < lineCount; i++) {
    const x1 = i * 30;
    const x2 = x1 + 30;
    const y = 60; // a bit below the rider
    eng = eng.addLine({
      id: i + 1,
      type: 2, // solid line
      x1, y1: y,
      x2, y2: y,
      flipped: false,
      leftExtended: false,
      rightExtended: false,
    });
  }
  return eng;
}

function measure(lineCount: number, repeats: number): Row {
  const eng = makeSyntheticEngine(lineCount);
  // Warm up to JIT the path once.
  resetFrameCount();
  extractRawTrajectory(eng, FRAME_BUDGET);
  const warmupFrames = getFrameCount();

  // Real measurement: rebuild each iteration to avoid lr-core's internal
  // memoization of computed frames giving artificially fast subsequent
  // calls on the same engine.
  const ms: number[] = [];
  for (let r = 0; r < repeats; r++) {
    const freshEng = makeSyntheticEngine(lineCount);
    resetFrameCount();
    const t0 = performance.now();
    extractRawTrajectory(freshEng, FRAME_BUDGET);
    const t1 = performance.now();
    ms.push(t1 - t0);
  }
  const mean_ms = ms.reduce((s, v) => s + v, 0) / ms.length;

  return {
    line_count: lineCount,
    frame_count: warmupFrames,
    wall_ms_mean: mean_ms,
    wall_ms_per_frame: mean_ms / warmupFrames,
  };
}

function cv(values: number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function main() {
  console.log("Stage 0b — R1 empirical measurement");
  console.log(`Frame budget: ${FRAME_BUDGET}, repeats: ${REPEATS}\n`);
  console.log("line_count  frame_count  wall_ms_mean   ms/frame");
  const rows: Row[] = [];
  for (const lc of LINE_COUNTS) {
    const row = measure(lc, REPEATS);
    rows.push(row);
    console.log(
      `${String(row.line_count).padStart(10)}  ` +
      `${String(row.frame_count).padStart(11)}  ` +
      `${row.wall_ms_mean.toFixed(2).padStart(12)}  ` +
      `${row.wall_ms_per_frame.toFixed(4).padStart(8)}`,
    );
  }
  const perFrameValues = rows.map((r) => r.wall_ms_per_frame);
  const cvValue = cv(perFrameValues);
  console.log();
  console.log(`ms-per-frame across line counts:`);
  console.log(`  min = ${Math.min(...perFrameValues).toFixed(4)}`);
  console.log(`  max = ${Math.max(...perFrameValues).toFixed(4)}`);
  console.log(`  cv  = ${cvValue.toFixed(4)}`);
  console.log(`  gate: cv < 0.25 → ${cvValue < 0.25 ? "PASS" : "FAIL"}`);
}

main();
