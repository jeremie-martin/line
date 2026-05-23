/**
 * Smoke-test lr-core: load test.track.json, simulate, sample rider positions.
 *
 * Validates that lr-core runs at all in Node and gives sensible numbers
 * before we commit to the parity diff against the bundle.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// lr-core is a 2016-era CJS package without an exports field — reach into its
// path directly. The default export is the LineRiderEngine class.
// deno-lint-ignore no-explicit-any
const lrCore: any = await import("lr-core/line-rider-engine/index.js");
const LineRiderEngine = lrCore.default;
const { createLineFromJson, LineTypes } = lrCore;

console.log("LineTypes:", LineTypes);

const trackPath = process.argv[2] ?? "test.track.json";
const track = JSON.parse(readFileSync(resolve(trackPath), "utf8"));
console.log(`track: ${trackPath}, lines=${track.lines.length}, duration=${track.duration}`);
console.log(`startPosition=${JSON.stringify(track.startPosition)}, riders[0]=${JSON.stringify(track.riders[0])}`);

// Build the engine by adding lines one at a time (each addLine returns a new
// engine — immutable interface).
// deno-lint-ignore no-explicit-any
let engine: any = new LineRiderEngine();
const t0 = performance.now();
for (const line of track.lines) {
  engine = engine.addLine(createLineFromJson(line));
}
const buildMs = performance.now() - t0;
console.log(`built engine in ${buildMs.toFixed(1)}ms`);

// Dense parity range: every single frame from 0 to track.duration inclusive.
// test.track.json has duration=1200, so 1201 frames total.
const durationFrames: number = track.duration ?? 1200;
const ALL_FRAMES: number[] = Array.from({ length: durationFrames + 1 }, (_, i) => i);
const SAMPLE_LOG_FRAMES = [0, 1, 10, 30, 60, 100, 200, 300, 600, 900, durationFrames];

const t1 = performance.now();
const allPositions = ALL_FRAMES.map((frame) => {
  const rider = engine.getRider(frame);
  return { frame, x: rider.position.x, y: rider.position.y };
});
const simMs = performance.now() - t1;

console.log(`\nrider positions (lr-core, ${simMs.toFixed(1)}ms for ALL ${ALL_FRAMES.length} frames up to frame ${durationFrames}):`);
for (const f of SAMPLE_LOG_FRAMES) {
  const p = allPositions[f];
  console.log(`  frame ${String(p.frame).padStart(5)}: x=${p.x.toFixed(4)} y=${p.y.toFixed(4)}`);
}

// Full-precision trajectory dump for parity comparison, across ALL frames,
// including every contact point.
import { writeFileSync, mkdirSync as _mk } from "node:fs";
const POINT_NAMES = ["NOSE", "SHOULDER", "BUTT", "BODY", "BODY_SLED_JOINT", "LFOOT", "RFOOT", "LHAND", "RHAND", "SLED_PEG", "TAIL"];
_mk("shakedown", { recursive: true });
const detailed = ALL_FRAMES.map((frame) => {
  const r = engine.getRider(frame);
  const pts: Record<string, { x: number; y: number }> = {};
  for (const name of POINT_NAMES) {
    try {
      const p = r.get(name);
      if (p && p.pos && typeof p.pos.x === "number") pts[name] = { x: p.pos.x, y: p.pos.y };
    } catch { /* */ }
  }
  return {
    frame,
    position: { x: r.position.x, y: r.position.y },
    velocity: { x: r.velocity.x, y: r.velocity.y },
    points: pts,
  };
});
writeFileSync("shakedown/lrcore-trajectory.json", JSON.stringify({ track: trackPath, frames: detailed }, null, 2));
console.log(`\nwrote shakedown/lrcore-trajectory.json (${detailed.length} frames)`);

// Microbenchmark: how long to compute a single rider at frame 1200 from a
// fresh engine? (No memoization, worst case.)
console.log(`\nmicrobench: fresh engine, single getRider(1200)`);
for (let trial = 0; trial < 3; trial++) {
  // deno-lint-ignore no-explicit-any
  let e: any = new LineRiderEngine();
  for (const l of track.lines) e = e.addLine(createLineFromJson(l));
  const tm = performance.now();
  e.getRider(1200);
  const ms = performance.now() - tm;
  console.log(`  trial ${trial}: ${ms.toFixed(1)}ms (~${(1200 / ms * 1000).toFixed(0)} frames/sec)`);
}
