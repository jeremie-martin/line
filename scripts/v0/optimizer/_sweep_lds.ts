/**
 * Stage 1 — coverage sweep for compileLDS.
 *
 * Runs compileLDS at each (spec, seed) in the golden suite × 5 seeds
 * and reports per-spec contract_passed counts plus aggregate
 * goal_score. The Stage 1 exit gate is:
 *
 *   - LDS at maxD ≤ 3 produces coverage ≥ greedy_v1 (65/65) on the
 *     golden suite.
 *   - Aggregate goal_score at full enumeration ≥ greedy_v1 × 0.95.
 *
 * Investigation-only — deleted in Stage 5.
 */

import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { compileLDS } from "./api.ts";
import { GOLDEN_SPECS, loadGoldenSpec } from "../golden_suite.ts";
import { scoreDriftReport, shiftedGeometricMean } from "../score.ts";

const SEEDS = [0, 1, 2, 3, 4];

type Row = {
  spec: string;
  seed: number;
  maxD: number;
  status: "ok" | "throw";
  axis_quality: number;
  contract_passed: boolean;
  wall_ms: number;
  sim_frames: number;
  error_message: string | null;
};

async function main() {
  const maxD = Number(process.argv[2] ?? 3);
  const outpath = process.argv[3] ?? `/tmp/lds_sweep_maxD${maxD}.json`;
  if (!Number.isInteger(maxD) || maxD < 0) {
    console.error("usage: tsx _sweep_lds.ts <maxD> [outpath]");
    process.exit(2);
  }

  const rows: Row[] = [];
  const total = GOLDEN_SPECS.length * SEEDS.length;
  let i = 0;
  for (const name of GOLDEN_SPECS) {
    for (const seed of SEEDS) {
      i++;
      const spec = await loadGoldenSpec(name as never, "base");
      const t0 = performance.now();
      try {
        const r = compileLDS(spec, seed, { maxDiscrepancy: maxD });
        const wall_ms = performance.now() - t0;
        const axis_quality = scoreDriftReport(r.report).axis_quality;
        const contract_passed =
          r.report.contacts.every((c) => c.status === "hit")
          && r.report.off_beat_landings.length === 0
          && r.report.terminus.reason === "endOfSpec";
        rows.push({
          spec: name, seed, maxD, status: "ok",
          axis_quality, contract_passed,
          wall_ms, sim_frames: r.stats.sim_frames,
          error_message: null,
        });
        console.error(
          `[${i}/${total}] ${name.padEnd(24)} seed=${seed} ` +
          `${contract_passed ? "ok" : "FAIL"} q=${axis_quality.toFixed(3)} ` +
          `${wall_ms.toFixed(0)}ms`,
        );
      } catch (e: unknown) {
        const wall_ms = performance.now() - t0;
        const msg = String(e).slice(0, 200);
        rows.push({
          spec: name, seed, maxD, status: "throw",
          axis_quality: 0, contract_passed: false,
          wall_ms, sim_frames: 0,
          error_message: msg,
        });
        console.error(`[${i}/${total}] ${name.padEnd(24)} seed=${seed} THROW ${wall_ms.toFixed(0)}ms`);
      }
    }
  }

  // Aggregate goal_score = per-spec geomean across seeds, then geomean across specs.
  const perSpec = GOLDEN_SPECS.map((name) => {
    const scores = rows
      .filter((r) => r.spec === name)
      .map((r) => (r.contract_passed ? r.axis_quality : 0) * 1000);
    return { name, score: shiftedGeometricMean(scores) };
  });
  const goal_score = shiftedGeometricMean(perSpec.map((s) => s.score));
  const coverage = rows.filter((r) => r.contract_passed).length;

  const out = { maxD, seeds: SEEDS, goal_score, coverage, per_spec: perSpec, rows };
  writeFileSync(outpath, JSON.stringify(out, null, 2));
  console.error(`\nWrote ${rows.length} rows to ${outpath}`);
  console.error(`goal_score (compileLDS maxD=${maxD}): ${goal_score.toFixed(2)}`);
  console.error(`coverage:                             ${coverage}/${rows.length}`);
  console.error(`(greedy_v1 baseline:                  460.44 coverage=65/65)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
