/**
 * Offline summary for golden budget-curve JSON.
 *
 *   npx tsx scripts/v0/analyze_golden_curve.ts /tmp/golden.json
 *   npx tsx scripts/v0/analyze_golden_curve.ts probe/golden.json baseline/golden.json
 *   npm run golden -- --json --specs=tiny_dance --seed=0 | npx tsx scripts/v0/analyze_golden_curve.ts -
 */

import { readFileSync } from "node:fs";
import { shiftedGeometricMean } from "./score.ts";

type BudgetScore = {
  budget: number;
  score: number;
  passed: number;
  total: number;
  changed_tracks: number;
  improved_rows: number;
  plateau_rows: number;
  regressions: number;
};

type CompileStats = {
  sim_frames?: number;
  leaves_considered?: number;
  search_nodes_expanded?: number;
  handoff_frontier_size?: number;
  handoff_frontier_oldest_gap_lag?: number;
  handoff_frontier_mean_gap_lag?: number;
  handoff_frontier_far_back_count?: number;
  handoff_start_ranks_seen?: number;
  handoff_start_ranks_with_fits?: number;
  handoff_full_evaluations?: number;
  handoff_partial_evaluations?: number;
  handoff_previews?: number;
  handoff_skips?: number;
};

type AxisError = {
  gap_index: number;
  axis: string;
  target: number;
  achieved: number;
  error: number;
};

type CheckpointRow = {
  budget: number;
  status: string;
  score: number;
  contract_passed: boolean;
  axis_quality?: number;
  compile_stats?: CompileStats;
  axes?: AxisError[];
};

type RunRow = {
  name: string;
  seed: number;
  variant?: string;
  checkpoints: CheckpointRow[];
};

type GoldenCurveJson = {
  curve_score?: number;
  budgets?: number[];
  budget_scores?: BudgetScore[];
  scope?: { row_count?: number; checkpoint_count?: number; seeds?: number[] };
  rows?: RunRow[];
};

function fmtBudget(budget: number): string {
  return budget % 1000 === 0 ? `${budget / 1000}k` : String(budget);
}

function readInput(path: string): GoldenCurveJson {
  const raw = path === "-" ? readFileSync(0, "utf8") : readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as GoldenCurveJson;
  if (!Array.isArray(parsed.budget_scores)) {
    throw new Error("input does not look like golden curve JSON (missing budget_scores)");
  }
  return parsed;
}

function curveScoreFor(data: GoldenCurveJson): number {
  return data.curve_score ??
    shiftedGeometricMean(data.budget_scores!.map((summary) => summary.score));
}

function checkpointAt(row: RunRow, budget: number): CheckpointRow | undefined {
  return row.checkpoints.find((checkpoint) => checkpoint.budget === budget);
}

function fmtNum(value: number | undefined, digits = 2): string {
  return value === undefined ? "?" : value.toFixed(digits);
}

function fmtSigned(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function fmtStats(stats: CompileStats | undefined): string {
  if (stats === undefined) return "";
  const parts = [
    `sim=${stats.sim_frames ?? "?"}`,
    `leaves=${stats.leaves_considered ?? "?"}`,
    `expanded=${stats.search_nodes_expanded ?? "?"}`,
    `frontier=${stats.handoff_frontier_size ?? "?"}`,
    `lag=${stats.handoff_frontier_oldest_gap_lag ?? "?"}`,
    `meanLag=${stats.handoff_frontier_mean_gap_lag ?? "?"}`,
    `far=${stats.handoff_frontier_far_back_count ?? "?"}`,
    `starts=${stats.handoff_start_ranks_with_fits ?? "?"}/${stats.handoff_start_ranks_seen ?? "?"}`,
    `full=${stats.handoff_full_evaluations ?? "?"}`,
    `partial=${stats.handoff_partial_evaluations ?? "?"}`,
  ];
  return parts.join(" ");
}

function worstAxes(checkpoint: CheckpointRow, limit: number): string {
  const axes = checkpoint.axes ?? [];
  return axes
    .slice()
    .sort((a, b) => Math.abs(b.error) - Math.abs(a.error))
    .slice(0, limit)
    .map((axis) =>
      `g${axis.gap_index}.${axis.axis} target=${axis.target.toFixed(2)} ` +
        `ach=${axis.achieved.toFixed(2)} err=${axis.error.toFixed(2)}`
    )
    .join(" ");
}

function rowLabel(row: RunRow): string {
  return `${row.name}${row.variant && row.variant !== "base" ? `/${row.variant}` : ""} seed=${row.seed}`;
}

function rowKey(row: RunRow): string {
  return `${row.name}\0${row.variant ?? "base"}\0${row.seed}`;
}

function commonBudgets(a: GoldenCurveJson, b: GoldenCurveJson): number[] {
  const aBudgets = a.budgets ?? a.budget_scores?.map((summary) => summary.budget) ?? [];
  const bBudgets = new Set(b.budgets ?? b.budget_scores?.map((summary) => summary.budget) ?? []);
  return aBudgets.filter((budget) => bBudgets.has(budget));
}

function printRowDiagnostics(data: GoldenCurveJson): void {
  const rows = data.rows ?? [];
  const budgets = data.budgets ?? data.budget_scores?.map((summary) => summary.budget) ?? [];
  if (rows.length === 0 || budgets.length === 0) return;

  const firstBudget = budgets[0];
  const lastBudget = budgets[budgets.length - 1];
  const rowSummaries = rows
    .map((row) => {
      const first = checkpointAt(row, firstBudget);
      const last = checkpointAt(row, lastBudget);
      if (first === undefined || last === undefined) return null;
      return { row, first, last, gain: last.score - first.score };
    })
    .filter((summary): summary is NonNullable<typeof summary> => summary !== null);

  console.log("");
  console.log(`lowest rows at ${fmtBudget(lastBudget)}:`);
  for (const summary of rowSummaries
    .slice()
    .sort((a, b) => a.last.score - b.last.score)
    .slice(0, 8)) {
    console.log(
      `  ${rowLabel(summary.row).padEnd(42)} ` +
        `${summary.last.status.padEnd(4)} score=${fmtNum(summary.last.score)} ` +
        `gain=${fmtNum(summary.gain)} axis=${fmtNum(summary.last.axis_quality)} ` +
        fmtStats(summary.last.compile_stats),
    );
    const axes = worstAxes(summary.last, 4);
    if (axes.length > 0) console.log(`    worst axes: ${axes}`);
  }

  console.log("");
  console.log(`largest ${fmtBudget(firstBudget)}->${fmtBudget(lastBudget)} gains:`);
  for (const summary of rowSummaries
    .slice()
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 8)) {
    console.log(
      `  ${rowLabel(summary.row).padEnd(42)} ` +
        `${fmtNum(summary.first.score)} -> ${fmtNum(summary.last.score)} ` +
        `gain=${fmtNum(summary.gain)} ${summary.first.status}->${summary.last.status}`,
    );
  }

  console.log("");
  console.log("low plateaus (low max score, little curve movement):");
  for (const summary of rowSummaries
    .filter((summary) => summary.last.score < 300 && summary.gain < 5)
    .sort((a, b) => a.last.score - b.last.score)
    .slice(0, 12)) {
    console.log(
      `  ${rowLabel(summary.row).padEnd(42)} ` +
        `score=${fmtNum(summary.last.score)} gain=${fmtNum(summary.gain)} ` +
        fmtStats(summary.last.compile_stats),
    );
  }
}

function printComparison(current: GoldenCurveJson, baseline: GoldenCurveJson): void {
  const currentRows = current.rows ?? [];
  const baselineRows = baseline.rows ?? [];
  const budgets = commonBudgets(current, baseline);
  if (currentRows.length === 0 || baselineRows.length === 0 || budgets.length === 0) return;

  const baselineByKey = new Map(baselineRows.map((row) => [rowKey(row), row]));
  const pairs = currentRows
    .map((currentRow) => {
      const baselineRow = baselineByKey.get(rowKey(currentRow));
      return baselineRow === undefined ? null : { currentRow, baselineRow };
    })
    .filter((pair): pair is NonNullable<typeof pair> => pair !== null);
  if (pairs.length === 0) return;

  console.log("");
  console.log(`comparison vs baseline (${pairs.length} common rows):`);
  const sameArchiveScope = pairs.length === currentRows.length && pairs.length === baselineRows.length;
  if (sameArchiveScope && current.curve_score !== undefined && baseline.curve_score !== undefined) {
    const delta = curveScoreFor(current) - curveScoreFor(baseline);
    console.log(`  archive CURVE_SCORE delta: ${fmtSigned(delta)}`);
  } else if (current.curve_score !== undefined && baseline.curve_score !== undefined) {
    console.log("  archive CURVE_SCORE delta: not comparable (different row scope)");
  }
  console.log("  common-row budget deltas:");
  for (const budget of budgets) {
    let currentScore = 0;
    let baselineScore = 0;
    let currentPassed = 0;
    let baselinePassed = 0;
    let count = 0;
    for (const pair of pairs) {
      const currentCheckpoint = checkpointAt(pair.currentRow, budget);
      const baselineCheckpoint = checkpointAt(pair.baselineRow, budget);
      if (currentCheckpoint === undefined || baselineCheckpoint === undefined) continue;
      currentScore += currentCheckpoint.score;
      baselineScore += baselineCheckpoint.score;
      if (currentCheckpoint.contract_passed) currentPassed++;
      if (baselineCheckpoint.contract_passed) baselinePassed++;
      count++;
    }
    if (count === 0) continue;
    const currentMean = currentScore / count;
    const baselineMean = baselineScore / count;
    const delta = currentMean - baselineMean;
    const passDelta = currentPassed - baselinePassed;
    console.log(
      `    ${fmtBudget(budget).padStart(5)} ` +
        `${baselineMean.toFixed(2).padStart(7)} -> ${currentMean.toFixed(2).padStart(7)} ` +
        `delta=${fmtSigned(delta).padStart(7)} ` +
        `valid=${currentPassed}/${count} (${fmtSigned(passDelta, 0)})`,
    );
  }

  const lastBudget = budgets[budgets.length - 1];
  const rowDeltas = pairs
    .map((pair) => {
      const currentCheckpoint = checkpointAt(pair.currentRow, lastBudget);
      const baselineCheckpoint = checkpointAt(pair.baselineRow, lastBudget);
      if (currentCheckpoint === undefined || baselineCheckpoint === undefined) return null;
      return {
        row: pair.currentRow,
        current: currentCheckpoint,
        baseline: baselineCheckpoint,
        delta: currentCheckpoint.score - baselineCheckpoint.score,
      };
    })
    .filter((delta): delta is NonNullable<typeof delta> => delta !== null);

  const validityFlips = rowDeltas.filter((delta) =>
    delta.current.contract_passed !== delta.baseline.contract_passed
  );
  if (validityFlips.length > 0) {
    console.log(`  validity flips at ${fmtBudget(lastBudget)}:`);
    for (const delta of validityFlips.slice(0, 10)) {
      console.log(
        `    ${rowLabel(delta.row).padEnd(42)} ` +
          `${delta.baseline.status}->${delta.current.status} ` +
          `${fmtNum(delta.baseline.score)} -> ${fmtNum(delta.current.score)}`,
      );
    }
  }

  console.log(`  largest regressions at ${fmtBudget(lastBudget)}:`);
  for (const delta of rowDeltas
    .slice()
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 8)) {
    console.log(
      `    ${rowLabel(delta.row).padEnd(42)} ` +
        `${fmtNum(delta.baseline.score)} -> ${fmtNum(delta.current.score)} ` +
        `delta=${fmtSigned(delta.delta)}`,
    );
  }

  console.log(`  largest improvements at ${fmtBudget(lastBudget)}:`);
  for (const delta of rowDeltas
    .slice()
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 8)) {
    console.log(
      `    ${rowLabel(delta.row).padEnd(42)} ` +
        `${fmtNum(delta.baseline.score)} -> ${fmtNum(delta.current.score)} ` +
        `delta=${fmtSigned(delta.delta)}`,
    );
  }
}

function main(): void {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: analyze_golden_curve.ts <golden-curve.json | -> [baseline-golden.json]");
    process.exit(1);
  }
  const data = readInput(path);
  const baselinePath = process.argv[3];
  const baseline = baselinePath === undefined ? null : readInput(baselinePath);
  const curveScore = curveScoreFor(data);
  const rows = data.scope?.row_count ?? 0;
  const checkpoints = data.scope?.checkpoint_count ?? 0;
  console.log(`CURVE_SCORE ${curveScore.toFixed(2)} · rows ${rows} · checkpoints ${checkpoints}`);
  console.log("budget curve:");
  for (const summary of data.budget_scores!) {
    console.log(
      `  ${fmtBudget(summary.budget).padStart(5)} ` +
        `score=${summary.score.toFixed(2).padStart(7)} ` +
        `valid=${String(summary.passed).padStart(2)}/${summary.total} ` +
        `changed=${String(summary.changed_tracks).padStart(2)} ` +
        `improved=${String(summary.improved_rows).padStart(2)} ` +
        `plateau=${String(summary.plateau_rows).padStart(2)} ` +
        `regress=${String(summary.regressions).padStart(2)}`,
    );
  }
  printRowDiagnostics(data);
  if (baseline !== null) printComparison(data, baseline);
}

main();
