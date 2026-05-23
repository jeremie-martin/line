/**
 * Parity regression test: extract per-frame rider trajectory from lr-core
 * (native Node) and from the bundle (via Playwright on the mirror) for the
 * same input track, then byte-compare the resulting JSON.
 *
 * On success: prints "PARITY OK" and exits 0.
 * On divergence: prints a per-frame diff and exits 1.
 *
 * Re-run this after any lr-core or mirror update to confirm the headless
 * physics still matches what the bundle renders.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const TRACK = process.argv[2] ?? "test.track.json";

function run(label: string, cmd: string, args: string[]) {
  console.log(`\n>>> ${label}`);
  const r = spawnSync(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) {
    console.error(`${label} failed (exit ${r.status})`);
    process.exit(1);
  }
}

run("lr-core trajectory", "npx", ["tsx", "scripts/lr_core_smoke.ts", TRACK]);
run("bundle trajectory  ", "npx", ["tsx", "scripts/bundle_ref_trajectory.ts", TRACK]);

const a = readFileSync(resolve("shakedown/lrcore-trajectory.json"), "utf8");
const b = readFileSync(resolve("shakedown/bundle-trajectory.json"), "utf8");

if (a === b) {
  const bytes = statSync("shakedown/lrcore-trajectory.json").size;
  console.log(`\nPARITY OK — lrcore and bundle trajectories are byte-identical (${bytes} bytes)`);
  process.exit(0);
}

// Diverged: build a per-frame numeric diff.
const A = JSON.parse(a) as { frames: Array<{ frame: number; position: { x: number; y: number } }> };
const B = JSON.parse(b) as typeof A;
console.error(`\nPARITY FAILED — files differ\n`);
console.error(`lrcore size=${a.length}  bundle size=${b.length}`);
console.error(`\nframe   |       lrcore (x, y)        |       bundle (x, y)        |   Δx          Δy`);
console.error(`--------+----------------------------+----------------------------+----------------------`);
let maxAbsDiff = 0;
for (let i = 0; i < A.frames.length; i++) {
  const fa = A.frames[i];
  const fb = B.frames[i];
  if (!fb || fa.frame !== fb.frame) {
    console.error(`frame index mismatch at i=${i}: lrcore=${fa.frame} bundle=${fb?.frame}`);
    continue;
  }
  const dx = fa.position.x - fb.position.x;
  const dy = fa.position.y - fb.position.y;
  maxAbsDiff = Math.max(maxAbsDiff, Math.abs(dx), Math.abs(dy));
  console.error(
    `${String(fa.frame).padStart(5)}   | ${fa.position.x.toFixed(6).padStart(12)} ${fa.position.y.toFixed(6).padStart(12)} | ${fb.position.x.toFixed(6).padStart(12)} ${fb.position.y.toFixed(6).padStart(12)} | ${dx.toExponential(2)}  ${dy.toExponential(2)}`,
  );
}
console.error(`\nmax |Δ| across all sampled frames: ${maxAbsDiff}`);
process.exit(1);
