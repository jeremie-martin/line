/** Budget→quality→time curve sweep for compileLDS (honest physics unit).
 *
 * For each spec (args, comma-separated) × seed × budget grid, records:
 *   pass, contract-gated score, physics frames used, wall_ms, budget_exhausted.
 * Streams JSON so partial data survives. The point is the SHAPE: where does
 * quality saturate (the knee), what's the floor (first complete track cost),
 * is ms/physframe stable (Property 2).
 *
 * Usage:
 *   tsx _sweep_curve.ts <specs csv> [seeds csv] [budgets csv] [outpath]
 * Fast probe example:
 *   tsx _sweep_curve.ts tiny_dance,mini_burst 0 100000,400000,1500000 /tmp/sweep_fast.json
 */
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { compileLDS } from "./api.ts";
import { getSimFrames } from "./sim_frames.ts";
import { scoreDriftReport } from "../score.ts";

const specs = (process.argv[2] ?? "tiny_dance,mini_burst").split(",");
const seeds = (process.argv[3] ?? "0").split(",").map(Number);
const budgets = (process.argv[4] ?? "100000,400000,1500000").split(",").map(Number);
const outpath = process.argv[5] ?? "/tmp/sweep_curve.json";

type Cell = {
  spec: string; seed: number; budget: number;
  pass: boolean; score: number; axis_quality: number;
  physics: number; wall_ms: number; exhausted: boolean;
  ms_per_physframe: number;
};
const cells: Cell[] = [];

for (const name of specs) {
  const mod = await import(resolve(`specs/golden/${name}.ts`));
  const spec = (mod.default ?? mod.spec) as never;
  for (const seed of seeds) {
    for (const budget of budgets) {
      const t0 = performance.now();
      let cell: Cell;
      try {
        const out = compileLDS(spec, seed, { maxDiscrepancy: 64, budget: { kind: "work", units: budget } });
        const wall = performance.now() - t0;
        const sc = scoreDriftReport(out.report);
        const physics = getSimFrames();
        cell = {
          spec: name, seed, budget,
          pass: sc.contract_passed, score: sc.contract_passed ? sc.score : 0,
          axis_quality: sc.axis_quality, physics, wall_ms: wall,
          exhausted: out.stats.budget_exhausted,
          ms_per_physframe: wall / Math.max(1, physics),
        };
      } catch (e) {
        cell = {
          spec: name, seed, budget, pass: false, score: 0, axis_quality: 0,
          physics: 0, wall_ms: performance.now() - t0, exhausted: false, ms_per_physframe: 0,
        };
        console.error(`  THROW ${name} s${seed} B=${budget}: ${String(e).slice(0, 120)}`);
      }
      cells.push(cell);
      console.error(
        `${name.padEnd(16)} s${cell.seed} B=${budget.toString().padStart(8)}: ` +
        `${cell.pass ? "PASS" : "fail"} score=${cell.score.toFixed(1).padStart(7)} ` +
        `phys=${cell.physics.toString().padStart(8)} wall=${cell.wall_ms.toFixed(0).padStart(6)}ms ` +
        `ms/pf=${cell.ms_per_physframe.toFixed(3)} exh=${cell.exhausted ? "y" : "n"}`,
      );
      writeFileSync(outpath, JSON.stringify({ cells }, null, 2));
    }
  }
}
console.error(`\nDONE: ${cells.length} cells -> ${outpath}`);
