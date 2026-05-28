/**
 * One-off harness to freeze greedy_v2 at K=48 across the full golden
 * suite × 5 seeds into `baselines/greedy_v2_K48.json`.
 *
 * Usage:
 *   tsx scripts/v0/optimizer/_freeze_greedy_v2.ts
 *
 * greedy_v2 is the minimal Step 3 chainer — no backtracking, polish,
 * or residual targeting. Expected to fail on more specs than legacy
 * greedy_v1. Failures are recorded as `status: "throw"` rows with
 * the error message.
 *
 * The output file is committed for use by Step 4's K-sweep analysis
 * and as a reference point for Step 5's envelope evaluation.
 */

import { writeFileSync } from "node:fs";
import { compileGreedy_v2 } from "./greedy.ts";
import { GOLDEN_SPECS, loadGoldenSpec } from "../golden_suite.ts";
import { scoreReport } from "./scorer.ts";
import { shiftedGeometricMean } from "../score.ts";

type Row = {
  spec: string;
  seed: number;
  status: "ok" | "throw";
  axis_quality: number;
  axis_error_rms: number;
  axis_error_max: number;
  contract_passed: boolean;
  hits: number;
  drift: number;
  missing: number;
  off_beat: number;
  terminus_reason: string;
  elapsed_ms: number;
  total_committed_cost: number;
  error_message: string | null;
};

const SEEDS = [0, 1, 2, 3, 4];
const K = 48;

async function main() {
  const rows: Row[] = [];
  const total = GOLDEN_SPECS.length * SEEDS.length;
  let i = 0;
  for (const name of GOLDEN_SPECS) {
    for (const seed of SEEDS) {
      i++;
      const spec = await loadGoldenSpec(name as never, "base");
      const t0 = Date.now();
      try {
        const r = compileGreedy_v2(spec, seed, { K });
        const elapsed_ms = Date.now() - t0;
        const report = r.report;
        const axis_quality = scoreReport(report);
        const errs: number[] = [];
        for (const section of report.sections) {
          for (const v of Object.values(section.axes ?? {})) {
            const e = (v as { error?: number }).error;
            if (typeof e === "number") errs.push(e);
          }
        }
        const axis_error_rms = errs.length === 0
          ? 0
          : Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);
        const axis_error_max = errs.reduce((m, e) => Math.max(m, Math.abs(e)), 0);
        const hits = report.contacts.filter((c) => c.status === "hit").length;
        const drift = report.contacts.filter((c) => c.status === "drift").length;
        const missing = report.contacts.filter((c) => c.status === "missing").length;
        const off_beat = report.off_beat_landings.length;
        const contract_passed =
          drift === 0 && missing === 0 && off_beat === 0
          && report.terminus.reason === "endOfSpec";
        rows.push({
          spec: name, seed, status: "ok",
          axis_quality, axis_error_rms, axis_error_max,
          contract_passed, hits, drift, missing, off_beat,
          terminus_reason: report.terminus.reason,
          elapsed_ms,
          total_committed_cost: r.stats.total_committed_cost,
          error_message: null,
        });
        console.error(`[${i}/${total}] ${name.padEnd(24)} seed=${seed} q=${axis_quality.toFixed(4)} ${contract_passed ? "ok" : "FAIL_CONTRACT"} ${elapsed_ms}ms`);
      } catch (e: unknown) {
        const elapsed_ms = Date.now() - t0;
        const msg = String(e).slice(0, 200);
        rows.push({
          spec: name, seed, status: "throw",
          axis_quality: 0, axis_error_rms: NaN, axis_error_max: NaN,
          contract_passed: false, hits: 0, drift: 0, missing: 0, off_beat: 0,
          terminus_reason: "thrown",
          elapsed_ms,
          total_committed_cost: 0,
          error_message: msg,
        });
        console.error(`[${i}/${total}] ${name.padEnd(24)} seed=${seed} THROW ${elapsed_ms}ms — ${msg.slice(0, 60)}`);
      }
    }
  }

  // Per-spec score = shifted geomean over seeds of (contract_passed ? axis_quality : 0) * 1000
  const perSpec = GOLDEN_SPECS.map((name) => {
    const scores = rows
      .filter((r) => r.spec === name)
      .map((r) => (r.contract_passed ? r.axis_quality : 0) * 1000);
    return { name, score: shiftedGeometricMean(scores) };
  });
  const goal_score = shiftedGeometricMean(perSpec.map((s) => s.score));

  const out = {
    generated_at: new Date().toISOString().slice(0, 10),
    compiler: "greedy_v2",
    K,
    seeds: SEEDS,
    specs: [...GOLDEN_SPECS],
    goal_score,
    per_spec: perSpec.map((s) => ({ name: s.name, score: Number(s.score.toFixed(4)) })),
    rows: rows.map((r) => ({
      ...r,
      axis_quality: Number(r.axis_quality.toFixed(6)),
      axis_error_rms: Number.isFinite(r.axis_error_rms) ? Number(r.axis_error_rms.toFixed(6)) : null,
      axis_error_max: Number.isFinite(r.axis_error_max) ? Number(r.axis_error_max.toFixed(6)) : null,
    })),
  };

  const path = "baselines/greedy_v2_K48.json";
  writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
  console.error(`\nWrote ${rows.length} rows to ${path}`);
  console.error(`goal_score (greedy_v2 K=48): ${goal_score.toFixed(2)}`);
  console.error(`coverage (contract_passed): ${rows.filter((r) => r.contract_passed).length}/${rows.length}`);
  console.error(`throws: ${rows.filter((r) => r.status === "throw").length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
