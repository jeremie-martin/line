/**
 * Deep budget→quality study for the LDS compiler.
 *
 * For one spec, runs all 5 seeds × 10 budget levels and records per-cell
 * empirical data. Outputs JSON. Designed to be launched in parallel
 * one-process-per-spec from a shell script.
 *
 * The empirical curves we want to study:
 *   - Quality vs budget (per spec, per seed)
 *   - Wall-clock vs budget; wall-clock per sim_frame stability
 *   - sim_frames vs budget (verifies overshoot is bounded)
 *   - Best-leaf discrepancy vs budget (where does d=1, d=2 win?)
 *
 * Plus leaf-count tracking so we can reason about the search-tree
 * shape at each budget level.
 *
 * Usage: tsx scripts/v0/optimizer/_study_budget.ts <spec_name> [outpath]
 *
 * Investigation-only — deleted in Stage 5.
 */

import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { compileLDS } from "./api.ts";
import { loadGoldenSpec } from "../golden_suite.ts";
import { scoreDriftReport } from "../score.ts";

const SEEDS = [0, 1, 2, 3, 4];
const BUDGETS = [
  50_000,
  100_000,
  200_000,
  500_000,
  1_000_000,
  2_000_000,
  3_000_000,
  5_000_000,
  8_000_000,
  12_000_000,
];

type Cell = {
  spec: string;
  seed: number;
  budget_requested: number;
  status: "ok" | "throw";
  // Quality metrics
  axis_quality: number;
  contract_passed: boolean;
  contract_gated_quality: number; // 0 if !passed else axis_quality
  full_score: number;
  // Work / time
  wall_ms: number;
  sim_frames: number;
  budget_exhausted: boolean;
  // Search-tree shape
  leaves_scored: number;
  best_leaf_discrepancy: number; // discrepancy of the winning leaf
  best_leaf_rank_string: string; // e.g. "0,1,0,0" for traceability
  // Diagnostics
  error_message: string | null;
};

async function runOneCell(name: string, seed: number, budget: number): Promise<Cell> {
  const spec = await loadGoldenSpec(name as never, "base");
  const t0 = performance.now();
  let leavesScored = 0;
  let bestDiscrepancy = -1;
  let bestRanks: number[] = [];
  // Track the best leaf seen during enumeration (mirrors the register's
  // strict-improvement rule, so we know which leaf "won").
  let bestKey: { contract_passed: boolean; axis_quality: number; full_score: number } | null = null;

  try {
    const r = compileLDS(spec, seed, {
      // Generous maxDiscrepancy; budget is the real cap.
      maxDiscrepancy: 64,
      budget: { kind: "work", units: budget },
      onLeaf: (leaf, key) => {
        leavesScored++;
        const better =
          bestKey === null
          || (key.contract_passed && !bestKey.contract_passed)
          || (key.contract_passed === bestKey.contract_passed
              && (key.contract_passed
                  ? key.axis_quality > bestKey.axis_quality
                  : key.full_score > bestKey.full_score));
        if (better) {
          bestKey = key;
          bestDiscrepancy = leaf.discrepancy;
          bestRanks = leaf.ranks;
        }
      },
    });
    const wall_ms = performance.now() - t0;
    const scoreDr = scoreDriftReport(r.report);
    const axisQ = scoreDr.axis_quality;
    const passed = scoreDr.contract_passed;
    return {
      spec: name, seed, budget_requested: budget,
      status: "ok",
      axis_quality: axisQ,
      contract_passed: passed,
      contract_gated_quality: passed ? axisQ : 0,
      full_score: scoreDr.score,
      wall_ms,
      sim_frames: r.stats.sim_frames,
      budget_exhausted: r.stats.budget_exhausted,
      leaves_scored: leavesScored,
      best_leaf_discrepancy: bestDiscrepancy,
      best_leaf_rank_string: bestRanks.join(","),
      error_message: null,
    };
  } catch (e: unknown) {
    const wall_ms = performance.now() - t0;
    return {
      spec: name, seed, budget_requested: budget,
      status: "throw",
      axis_quality: 0,
      contract_passed: false,
      contract_gated_quality: 0,
      full_score: 0,
      wall_ms,
      sim_frames: 0,
      budget_exhausted: false,
      leaves_scored: leavesScored,
      best_leaf_discrepancy: -1,
      best_leaf_rank_string: "",
      error_message: String(e).slice(0, 200),
    };
  }
}

async function main() {
  const specName = process.argv[2];
  const outpath = process.argv[3] ?? `/tmp/study_budget_${specName}.json`;
  if (!specName) {
    console.error("usage: tsx _study_budget.ts <spec_name> [outpath]");
    process.exit(2);
  }

  const cells: Cell[] = [];
  const total = SEEDS.length * BUDGETS.length;
  let i = 0;
  for (const seed of SEEDS) {
    for (const budget of BUDGETS) {
      i++;
      const c = await runOneCell(specName, seed, budget);
      cells.push(c);
      const tag =
        c.status === "throw" ? "THROW" :
        c.contract_passed ? "ok" : "FAIL";
      console.error(
        `[${specName}] ${i}/${total} seed=${seed} B=${budget.toString().padStart(9)}: ` +
        `${tag.padEnd(5)} q=${c.axis_quality.toFixed(4)} ` +
        `wall=${c.wall_ms.toFixed(0)}ms sim=${c.sim_frames.toString().padStart(9)} ` +
        `exh=${c.budget_exhausted ? "y" : "n"} ` +
        `leaves=${c.leaves_scored} bestD=${c.best_leaf_discrepancy}`,
      );
      // Stream partial results so we don't lose data if interrupted
      writeFileSync(outpath, JSON.stringify({ spec: specName, cells }, null, 2));
    }
  }
  console.error(`[${specName}] done, wrote ${cells.length} cells to ${outpath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
