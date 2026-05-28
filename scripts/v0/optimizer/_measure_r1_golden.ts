/**
 * Stage 0b — R1 measurement on real workload (golden suite).
 *
 * Runs `compileGreedy_v2` across the full golden suite × seeds and
 * computes wall_ms / sim_frames per (spec, seed). Verifies the cv of
 * that ratio is below 0.25, which is the Property-2 acceptance gate.
 *
 * Complements the synthetic measurement in `_measure_r1.ts` — that
 * isolates per-frame cost vs line count; this measures the actual
 * compile workload across the heterogeneous spec set.
 *
 * Usage:  tsx scripts/v0/optimizer/_measure_r1_golden.ts
 */

import { performance } from "node:perf_hooks";
import { compileGreedy_v2 } from "./greedy.ts";
import { GOLDEN_SPECS, loadGoldenSpec } from "../golden_suite.ts";

const SEEDS = [0, 1, 2, 3, 4];

type Row = {
  spec: string;
  seed: number;
  ok: boolean;
  wall_ms: number;
  sim_frames: number;
  ratio_ms_per_frame: number | null;
};

function cv(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

async function main() {
  const rows: Row[] = [];
  const total = GOLDEN_SPECS.length * SEEDS.length;
  let i = 0;
  for (const name of GOLDEN_SPECS) {
    for (const seed of SEEDS) {
      i++;
      const spec = await loadGoldenSpec(name as never, "base");
      const t0 = performance.now();
      let sim_frames = 0;
      let ok = true;
      try {
        const r = compileGreedy_v2(spec, seed, { K: 48 });
        sim_frames = r.stats.sim_frames;
      } catch {
        ok = false;
      }
      const wall_ms = performance.now() - t0;
      const ratio = ok && sim_frames > 0 ? wall_ms / sim_frames : null;
      rows.push({ spec: name, seed, ok, wall_ms, sim_frames, ratio_ms_per_frame: ratio });
      console.error(
        `[${i}/${total}] ${name.padEnd(24)} seed=${seed} ` +
        `${ok ? "ok" : "THROW"} wall=${wall_ms.toFixed(0)}ms ` +
        `sim_frames=${sim_frames} ` +
        (ratio !== null ? `ratio=${ratio.toFixed(4)} ms/frame` : ""),
      );
    }
  }

  const ratios = rows
    .filter((r): r is Row & { ratio_ms_per_frame: number } => r.ratio_ms_per_frame !== null)
    .map((r) => r.ratio_ms_per_frame);
  if (ratios.length === 0) {
    console.error("\nno successful runs — cannot compute cv");
    process.exit(1);
  }
  const minR = Math.min(...ratios);
  const maxR = Math.max(...ratios);
  const meanR = ratios.reduce((s, v) => s + v, 0) / ratios.length;
  const cvR = cv(ratios);
  console.log();
  console.log(`Successful runs:    ${ratios.length}/${rows.length}`);
  console.log(`ms/frame statistics across ${ratios.length} runs:`);
  console.log(`  min   = ${minR.toFixed(4)}`);
  console.log(`  max   = ${maxR.toFixed(4)}`);
  console.log(`  mean  = ${meanR.toFixed(4)}`);
  console.log(`  cv    = ${cvR.toFixed(4)}`);
  console.log(`  gate: cv < 0.25 → ${cvR < 0.25 ? "PASS" : "FAIL"}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
