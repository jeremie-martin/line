/** Parity check: master compileLDS vs frozen greedy_v1, untimed scoring,
 *  same shifted-geomean aggregation as golden.ts. Confirms the
 *  floor=legacy "goal_score >= greedy_v1 by construction" claim empirically.
 *
 *  budgetFor(spec) is in PHYSICS frames (the honest unit). Starting point:
 *  work's calibrated formula converted from work-units (=16x physics) to
 *  physics: base 7500 + 8125/contact + 10/frame. Tune via argv.
 *
 *  Usage: tsx _parity_lds.ts [seeds csv] [base,perContact,perFrame] [outpath]
 *  Fast:  tsx _parity_lds.ts 0
 */
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { compileLDS } from "./api.ts";
import { getSimFrames } from "./sim_frames.ts";
import { scoreDriftReport, shiftedGeometricMean } from "../score.ts";
import { secToFrame } from "../types.ts";
import gv1 from "../../../baselines/greedy_v1.json" with { type: "json" };

const SPECS = [
  "drums_signature", "drums_pendulum", "drums_crescendo", "dense_sprint",
  "syncopated_switchback", "opening_burst", "grain_staircase", "rhythm_ladder",
  "cold_start", "mini_burst", "tiny_dance", "solo_run", "verse_chorus",
];
const seeds = (process.argv[2] ?? "0,1,2,3,4").split(",").map(Number);
const [BASE, PERC, PERF] = (process.argv[3] ?? "7500,8125,10").split(",").map(Number);
const outpath = process.argv[4] ?? "/tmp/parity_lds.json";

// deno-lint-ignore no-explicit-any
const budgetFor = (spec: any) => BASE + PERC * spec.contacts.length + PERF * secToFrame(spec.duration);

const gv1PerSpec: Record<string, number> = {};
for (const s of (gv1 as { per_spec: { name: string; score: number }[] }).per_spec) gv1PerSpec[s.name] = s.score;

type Cell = { spec: string; seed: number; pass: boolean; score: number; physics: number; wall_ms: number; budget: number };
const cells: Cell[] = [];

for (const name of SPECS) {
  const mod = await import(resolve(`specs/golden/${name}.ts`));
  const spec = (mod.default ?? mod.spec) as never;
  const budget = budgetFor(spec);
  for (const seed of seeds) {
    const t0 = performance.now();
    let cell: Cell;
    try {
      const out = compileLDS(spec, seed, { budget: { kind: "work", units: budget } });
      const wall = performance.now() - t0;
      const sc = scoreDriftReport(out.report);
      cell = { spec: name, seed, pass: sc.contract_passed, score: sc.contract_passed ? sc.score : 0, physics: getSimFrames(), wall_ms: wall, budget };
    } catch (e) {
      cell = { spec: name, seed, pass: false, score: 0, physics: 0, wall_ms: performance.now() - t0, budget };
      console.error(`  THROW ${name} s${seed}: ${String(e).slice(0, 140)}`);
    }
    cells.push(cell);
    console.error(`${name.padEnd(16)} s${cell.seed} ${cell.pass ? "PASS" : "fail"} score=${cell.score.toFixed(1).padStart(7)} phys=${cell.physics.toString().padStart(8)} wall=${(cell.wall_ms / 1000).toFixed(1)}s B=${budget}`);
    writeFileSync(outpath, JSON.stringify({ cells }, null, 2));
  }
}

// Aggregate per-spec shifted-geomean over seeds, then suite over specs.
const bySpec = new Map<string, number[]>();
for (const c of cells) bySpec.set(c.spec, [...(bySpec.get(c.spec) ?? []), c.score]);
console.error("\n=== per-spec (LDS vs greedy_v1) ===");
const perSpecScores: number[] = [];
for (const name of SPECS) {
  const scores = bySpec.get(name) ?? [];
  if (!scores.length) continue;
  const lds = shiftedGeometricMean(scores);
  perSpecScores.push(lds);
  const g = gv1PerSpec[name];
  const delta = g ? `${((lds - g) / g * 100).toFixed(0)}%` : "?";
  const flag = g && lds < g - 0.01 ? "  <-- BELOW greedy_v1" : "";
  console.error(`  ${name.padEnd(16)} LDS=${lds.toFixed(1).padStart(7)} greedy=${(g ?? 0).toFixed(1).padStart(7)} ${delta.padStart(5)}${flag}`);
}
const goal = shiftedGeometricMean(perSpecScores);
const passed = cells.filter((c) => c.pass).length;
console.error(`\nGOAL_SCORE LDS=${goal.toFixed(2)} (greedy_v1=460.44)  pass=${passed}/${cells.length}  seeds=${seeds.join(",")}`);
writeFileSync(outpath, JSON.stringify({ summary: { goal_score: goal, passed, total: cells.length }, cells }, null, 2));
