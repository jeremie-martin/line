/** Measure the floor cost (greedy descent = legacy compile) per spec via
 *  compileLDS(maxDiscrepancy=0): floor + the single d=0 leaf, no deviations.
 *  This is the irreducible mandatory-prelude cost; budgetFor should sit a
 *  modest headroom above it, not 5-8x above (which wastes wall-clock on specs
 *  where LDS can't improve). seed 0. Throwaway. */
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { compileLDS } from "./api.ts";
import { getSimFrames } from "./sim_frames.ts";
import { scoreDriftReport } from "../score.ts";
import { secToFrame } from "../types.ts";

const SPECS = [
  "drums_signature", "drums_pendulum", "drums_crescendo", "dense_sprint",
  "syncopated_switchback", "opening_burst", "grain_staircase", "rhythm_ladder",
  "cold_start", "mini_burst", "tiny_dance", "solo_run", "verse_chorus",
];
console.error(`${"spec".padEnd(22)}${"frames".padStart(7)}${"floor_phys".padStart(11)}${"wall_s".padStart(8)}  pass score`);
for (const name of SPECS) {
  const mod = await import(resolve(`specs/golden/${name}.ts`));
  const spec = (mod.default ?? mod.spec) as never;
  const frames = secToFrame((spec as { duration: number }).duration);
  const t0 = performance.now();
  const out = compileLDS(spec, 0, { maxDiscrepancy: 0 });
  const wall = (performance.now() - t0) / 1000;
  const sc = scoreDriftReport(out.report);
  console.error(`${name.padEnd(22)}${String(frames).padStart(7)}${getSimFrames().toString().padStart(11)}${wall.toFixed(1).padStart(8)}  ${sc.contract_passed ? "P" : "f"} ${sc.score.toFixed(1)}`);
}
