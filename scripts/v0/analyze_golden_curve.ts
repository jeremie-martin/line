/**
 * Offline summary for golden budget-curve JSON.
 *
 *   npx tsx scripts/v0/analyze_golden_curve.ts /tmp/golden.json
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

function checkpointAt(row: RunRow, budget: number): CheckpointRow | undefined {
  return row.checkpoints.find((checkpoint) => checkpoint.budget === budget);
}

function fmtNum(value: number | undefined, digits = 2): string {
  return value === undefined ? "?" : value.toFixed(digits);
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

function main(): void {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: analyze_golden_curve.ts <golden-curve.json | ->");
    process.exit(1);
  }
  const data = readInput(path);
  const curveScore = data.curve_score ??
    shiftedGeometricMean(data.budget_scores!.map((summary) => summary.score));
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
}

main();
