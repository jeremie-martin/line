/**
 * Stage 2 cross-spec verification.
 *
 * Runs compileLDS on 3 specs × 3 seeds × 3 budgets and verifies:
 *   1. Monotonicity-in-budget per (spec, seed): q(B_low) ≤ q(B_mid) ≤ q(B_high).
 *   2. wall_ms / sim_frames cv across all runs < 0.25 (Property 2 carryover).
 *
 * Specs chosen for variety: tiny_dance (smallest), mini_burst (small,
 * different shape), cold_start (medium with structural difficulty).
 * Budgets chosen to span a meaningful range without timing out.
 *
 * Investigation-only — measurement deleted in Stage 5.
 */

import { performance } from "node:perf_hooks";
import { compileLDS } from "./api.ts";
import { isStrictlyBetter, type LeafKey } from "./register.ts";
import { scoreDriftReport } from "../score.ts";
import { loadGoldenSpec } from "../golden_suite.ts";
import type { CompileOutput } from "./types.ts";

const SPECS = ["tiny_dance", "mini_burst", "cold_start"];
const SEEDS = [0, 1, 2];
const BUDGETS = [100_000, 500_000, 2_000_000];

type Row = {
  spec: string;
  seed: number;
  budget: number;
  status: "ok" | "throw";
  axis_quality: number;
  contract_passed: boolean;
  full_score: number;
  wall_ms: number;
  sim_frames: number;
  budget_exhausted: boolean;
  error: string | null;
};

function keyFor(out: CompileOutput): LeafKey {
  const s = scoreDriftReport(out.report);
  return {
    contract_passed: s.contract_passed,
    axis_quality: s.axis_quality,
    full_score: s.score,
  };
}

function cv(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

async function main() {
  const rows: Row[] = [];
  for (const name of SPECS) {
    for (const seed of SEEDS) {
      for (const budget of BUDGETS) {
        const spec = await loadGoldenSpec(name as never, "base");
        const t0 = performance.now();
        try {
          const r = compileLDS(spec, seed, {
            maxDiscrepancy: 4,
            budget: { kind: "work", units: budget },
          });
          const wall_ms = performance.now() - t0;
          const k = keyFor(r);
          rows.push({
            spec: name, seed, budget,
            status: "ok",
            axis_quality: k.axis_quality,
            contract_passed: k.contract_passed,
            full_score: k.full_score,
            wall_ms, sim_frames: r.stats.sim_frames,
            budget_exhausted: r.stats.budget_exhausted,
            error: null,
          });
          console.error(
            `[${rows.length}/${SPECS.length * SEEDS.length * BUDGETS.length}] ` +
            `${name.padEnd(14)} s=${seed} B=${budget.toString().padStart(8)} ` +
            `q=${rows[rows.length - 1].axis_quality.toFixed(4)} ` +
            `wall=${wall_ms.toFixed(0)}ms sim=${r.stats.sim_frames} ` +
            `exh=${r.stats.budget_exhausted}`,
          );
        } catch (e) {
          const wall_ms = performance.now() - t0;
          rows.push({
            spec: name, seed, budget, status: "throw",
            axis_quality: 0, contract_passed: false, full_score: 0,
            wall_ms, sim_frames: 0,
            budget_exhausted: false, error: String(e).slice(0, 120),
          });
          console.error(`[${rows.length}] ${name} s=${seed} B=${budget} THROW`);
        }
      }
    }
  }

  // Monotonicity check — under the comparator's key, not raw axis_quality.
  // The key (contract_passed, axis_quality_if_passing_else_full_score)
  // must never decrease as budget grows. This is the load-bearing
  // structural property.
  console.log("\n=== MONOTONICITY-IN-BUDGET (under comparator key) ===");
  let monoViolations = 0;
  let evaluable = 0;
  for (const name of SPECS) {
    for (const seed of SEEDS) {
      const cellRows = rows.filter((r) => r.spec === name && r.seed === seed && r.status === "ok");
      if (cellRows.length < 2) continue;
      cellRows.sort((a, b) => a.budget - b.budget);
      for (let i = 0; i < cellRows.length - 1; i++) {
        evaluable++;
        const k0: LeafKey = {
          contract_passed: cellRows[i].contract_passed,
          axis_quality: cellRows[i].axis_quality,
          full_score: cellRows[i].full_score,
        };
        const k1: LeafKey = {
          contract_passed: cellRows[i + 1].contract_passed,
          axis_quality: cellRows[i + 1].axis_quality,
          full_score: cellRows[i + 1].full_score,
        };
        // violation: smaller budget's key is strictly better than larger's
        if (isStrictlyBetter(k0, k1)) {
          monoViolations++;
          console.log(
            `  VIOLATION ${name} seed=${seed}: ` +
            `B=${cellRows[i].budget} contract=${k0.contract_passed} q=${k0.axis_quality.toFixed(4)} ` +
            `→ B=${cellRows[i + 1].budget} contract=${k1.contract_passed} q=${k1.axis_quality.toFixed(4)}`,
          );
        }
      }
    }
  }
  console.log(`  evaluable transitions: ${evaluable}`);
  console.log(`  violations:            ${monoViolations}`);
  console.log(`  gate: 0 violations → ${monoViolations === 0 ? "PASS" : "FAIL"}`);

  // Bonus: among passing-only rows, is axis_quality monotonic?
  console.log("\n=== axis_quality monotonicity AMONG passing rows ===");
  let qViolations = 0;
  let qEval = 0;
  for (const name of SPECS) {
    for (const seed of SEEDS) {
      const passing = rows.filter((r) => r.spec === name && r.seed === seed && r.contract_passed);
      if (passing.length < 2) continue;
      passing.sort((a, b) => a.budget - b.budget);
      for (let i = 0; i < passing.length - 1; i++) {
        qEval++;
        if (passing[i + 1].axis_quality < passing[i].axis_quality - 1e-9) {
          qViolations++;
          console.log(`  ${name} seed=${seed}: B=${passing[i].budget} q=${passing[i].axis_quality.toFixed(4)} → B=${passing[i + 1].budget} q=${passing[i + 1].axis_quality.toFixed(4)}`);
        }
      }
    }
  }
  console.log(`  evaluable: ${qEval}, violations: ${qViolations}`);

  // wall-clock cv check
  console.log("\n=== WALL-CLOCK CV ===");
  const ratios = rows
    .filter((r) => r.status === "ok" && r.sim_frames > 0)
    .map((r) => r.wall_ms / r.sim_frames);
  if (ratios.length > 0) {
    const minR = Math.min(...ratios);
    const maxR = Math.max(...ratios);
    const meanR = ratios.reduce((s, v) => s + v, 0) / ratios.length;
    const cvR = cv(ratios);
    console.log(`  n: ${ratios.length}`);
    console.log(`  ms/frame range: ${minR.toFixed(4)} - ${maxR.toFixed(4)}`);
    console.log(`  mean: ${meanR.toFixed(4)}`);
    console.log(`  cv:   ${cvR.toFixed(4)}`);
    console.log(`  gate: cv < 0.25 → ${cvR < 0.25 ? "PASS" : "FAIL"}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
