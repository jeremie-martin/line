/**
 * Offline summary for golden budget-curve JSON.
 *
 *   npx tsx scripts/v0/analyze_golden_curve.ts /tmp/golden.json
 *   npx tsx scripts/v0/analyze_golden_curve.ts probe/golden.json baseline/golden.json
 *   npm run golden -- --json --specs=tiny_dance --seed=0 | npx tsx scripts/v0/analyze_golden_curve.ts -
 */

import { readFileSync } from "node:fs";
import { shiftedGeometricMean } from "./score.ts";
import { AXES, type AxisName } from "./types.ts";

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

type ArcPlacementStats = {
  mode?: "impact_anchor";
  sampled?: number;
  preclear_rejected?: number;
  direct_attempted?: number;
  direct_landed?: number;
  direct_failed?: number;
  fallback_attempted?: number;
  fallback_landed?: number;
};

type CompileStats = {
  candidates_sampled?: number;
  candidates_viable?: number;
  sim_frames?: number;
  committed_costs_per_gap?: Array<number | null>;
  leaves_considered?: number;
  polish_variants_tried?: number;
  polish_variants_changed?: number;
  polish_variants_adopted?: number;
  search_nodes_expanded?: number;
  handoff_frontier_size?: number;
  handoff_frontier_oldest_gap_lag?: number;
  handoff_frontier_mean_gap_lag?: number;
  handoff_frontier_far_back_count?: number;
  handoff_far_back_pulses?: number;
  handoff_duplicate_evaluations?: number;
  handoff_duplicate_full_evaluations?: number;
  handoff_tail_completion_attempts?: number;
  handoff_tail_completion_successes?: number;
  handoff_tail_completion_improvements?: number;
  handoff_start_options?: number;
  handoff_start_rank?: number;
  handoff_start_speed?: number;
  handoff_start_angle_deg?: number;
  handoff_start_ranks_seen?: number;
  handoff_start_ranks_with_fits?: number;
  handoff_full_evaluations?: number;
  handoff_partial_evaluations?: number;
  handoff_suffix_repair_attempts?: number;
  handoff_suffix_repair_successes?: number;
  handoff_suffix_repair_improvements?: number;
  handoff_suffix_repair_nodes?: number;
  handoff_previews?: number;
  handoff_preview_contacts?: number;
  handoff_preview_survivors?: number;
  handoff_reuse_attempts?: number;
  handoff_reuse_successes?: number;
  handoff_brake_attempts?: number;
  handoff_brake_successes?: number;
  handoff_axis_quality_attempts?: number;
  handoff_axis_quality_successes?: number;
  handoff_axis_quality_air_attempts?: number;
  handoff_axis_quality_air_successes?: number;
  handoff_axis_quality_contact_style_attempts?: number;
  handoff_axis_quality_contact_style_successes?: number;
  handoff_rescue_attempts?: number;
  handoff_rescue_successes?: number;
  handoff_skips?: number;
  handoff_skip_branches?: number;
  handoff_deferred_skips?: number;
  handoff_search_lane?: number;
  handoff_selected_candidate_rank_count?: number;
  handoff_selected_candidate_rank_mean?: number;
  handoff_selected_candidate_rank_max?: number;
  handoff_selected_candidate_nonzero_ranks?: number;
  handoff_selected_candidate_pool_count?: number;
  handoff_selected_candidate_reuse_count?: number;
  handoff_selected_candidate_brake_count?: number;
  handoff_selected_candidate_axis_quality_count?: number;
  handoff_prefix_branch_forks?: number;
  handoff_prefix_branch_evaluations?: number;
  handoff_prefix_branch_full_evaluations?: number;
  handoff_prefix_branch_improvements?: number;
  handoff_prefix_branch_prunes?: number;
  arc_placement?: ArcPlacementStats;
};

type AxisError = {
  gap_index: number;
  axis: AxisName;
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

const TARGET_BANDS = ["<0.25", "0.25-0.5", "0.5-0.75", ">=0.75"] as const;
const WORK_DELTA_STATS = [
  ["sim", "sim_frames"],
  ["cand", "candidates_sampled"],
  ["viable", "candidates_viable"],
] as const satisfies ReadonlyArray<readonly [string, keyof CompileStats]>;
const STREAM_YIELD_STATS = [
  ["polish", "polish_variants_adopted", "polish_variants_tried"],
  ["tail_best", "handoff_tail_completion_improvements", "handoff_tail_completion_successes"],
  ["reuse", "handoff_reuse_successes", "handoff_reuse_attempts"],
  ["brake", "handoff_brake_successes", "handoff_brake_attempts"],
  ["axisq", "handoff_axis_quality_successes", "handoff_axis_quality_attempts"],
  ["axisq_air", "handoff_axis_quality_air_successes", "handoff_axis_quality_air_attempts"],
  [
    "axisq_contact",
    "handoff_axis_quality_contact_style_successes",
    "handoff_axis_quality_contact_style_attempts",
  ],
  ["suffix", "handoff_suffix_repair_successes", "handoff_suffix_repair_attempts"],
  ["suffix_best", "handoff_suffix_repair_improvements", "handoff_suffix_repair_successes"],
  ["rescue", "handoff_rescue_successes", "handoff_rescue_attempts"],
  ["branch", "handoff_prefix_branch_improvements", "handoff_prefix_branch_evaluations"],
] as const satisfies ReadonlyArray<readonly [string, keyof CompileStats, keyof CompileStats]>;
const STREAM_YIELD_LABEL_WIDTH = Math.max(...STREAM_YIELD_STATS.map(([label]) => label.length));

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

function fmtSignedInt(value: number): string {
  return fmtSigned(value, 0);
}

function fmtStats(stats: CompileStats | undefined): string {
  if (stats === undefined) return "";
  const parts = [
    `sim=${stats.sim_frames ?? "?"}`,
    `cand=${fmtCandidateStats(stats)}`,
    `leaves=${stats.leaves_considered ?? "?"}`,
    `expanded=${stats.search_nodes_expanded ?? "?"}`,
    `frontier=${stats.handoff_frontier_size ?? "?"}`,
    `lag=${stats.handoff_frontier_oldest_gap_lag ?? "?"}`,
    `meanLag=${stats.handoff_frontier_mean_gap_lag ?? "?"}`,
    `far=${stats.handoff_frontier_far_back_count ?? "?"}`,
    `pulses=${stats.handoff_far_back_pulses ?? "?"}`,
    `dup=${stats.handoff_duplicate_evaluations ?? "?"}/` +
      `${stats.handoff_duplicate_full_evaluations ?? "?"}`,
    `tail=${stats.handoff_tail_completion_improvements ?? "?"}/` +
      `${stats.handoff_tail_completion_successes ?? "?"}/` +
      `${stats.handoff_tail_completion_attempts ?? "?"}`,
    `polish=${stats.polish_variants_adopted ?? "?"}/` +
      `${stats.polish_variants_changed ?? "?"}/` +
      `${stats.polish_variants_tried ?? "?"}`,
    `suffix=${stats.handoff_suffix_repair_improvements ?? "?"}/` +
      `${stats.handoff_suffix_repair_successes ?? "?"}/` +
      `${stats.handoff_suffix_repair_attempts ?? "?"}` +
      `(${stats.handoff_suffix_repair_nodes ?? "?"}n)`,
    `reuse=${stats.handoff_reuse_successes ?? "?"}/${stats.handoff_reuse_attempts ?? "?"}`,
    `brake=${stats.handoff_brake_successes ?? "?"}/${stats.handoff_brake_attempts ?? "?"}`,
    `axisq=${stats.handoff_axis_quality_successes ?? "?"}/${stats.handoff_axis_quality_attempts ?? "?"}`,
    `rescue=${stats.handoff_rescue_successes ?? "?"}/${stats.handoff_rescue_attempts ?? "?"}`,
    `preview=${stats.handoff_preview_contacts ?? "?"}/${stats.handoff_previews ?? "?"}`,
    `starts=${stats.handoff_start_ranks_with_fits ?? "?"}/${stats.handoff_start_ranks_seen ?? "?"}`,
    `start=${fmtStart(stats)}`,
    `startRank=${stats.handoff_start_rank ?? "?"}`,
    `lane=${stats.handoff_search_lane ?? "?"}`,
    `rank=${stats.handoff_selected_candidate_nonzero_ranks ?? "?"}/` +
      `${stats.handoff_selected_candidate_rank_count ?? "?"}@` +
      `${stats.handoff_selected_candidate_rank_mean ?? "?"}/` +
      `${stats.handoff_selected_candidate_rank_max ?? "?"}`,
    `src=${stats.handoff_selected_candidate_pool_count ?? "?"}/` +
      `${stats.handoff_selected_candidate_reuse_count ?? "?"}/` +
      `${stats.handoff_selected_candidate_brake_count ?? "?"}/` +
      `${stats.handoff_selected_candidate_axis_quality_count ?? "?"}`,
    `branch=${stats.handoff_prefix_branch_improvements ?? "?"}/` +
      `${stats.handoff_prefix_branch_evaluations ?? "?"}` +
      `(${stats.handoff_prefix_branch_full_evaluations ?? "?"}f,` +
      `${stats.handoff_prefix_branch_forks ?? "?"}forks,` +
      `${stats.handoff_prefix_branch_prunes ?? "?"}prunes)`,
    `full=${stats.handoff_full_evaluations ?? "?"}`,
    `partial=${stats.handoff_partial_evaluations ?? "?"}`,
  ];
  return parts.join(" ");
}

function fmtCandidateStats(stats: CompileStats): string {
  const sampled = stats.candidates_sampled;
  const viable = stats.candidates_viable;
  if (sampled === undefined) return "?";
  if (viable === undefined) return String(sampled);
  return `${sampled}/${viable}`;
}

function numericStat(stats: CompileStats | undefined, key: keyof CompileStats): number | undefined {
  const value = stats?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function fmtWorkDeltas(
  pairs: Array<{ currentRow: RunRow; baselineRow: RunRow }>,
  budget: number,
): string {
  const parts: string[] = [];
  for (const [label, key] of WORK_DELTA_STATS) {
    let deltaSum = 0;
    let count = 0;
    for (const pair of pairs) {
      const current = numericStat(checkpointAt(pair.currentRow, budget)?.compile_stats, key);
      const baseline = numericStat(checkpointAt(pair.baselineRow, budget)?.compile_stats, key);
      if (current === undefined || baseline === undefined) continue;
      deltaSum += current - baseline;
      count++;
    }
    if (count > 0) parts.push(`${label}=${fmtSignedInt(deltaSum / count)}`);
  }
  return parts.length === 0 ? "" : ` workΔ(${parts.join(" ")})`;
}

function fmtStart(stats: CompileStats): string {
  const speed = stats.handoff_start_speed;
  const angle = stats.handoff_start_angle_deg;
  if (speed === undefined || angle === undefined) return "?";
  return `${speed.toFixed(2)}@${angle.toFixed(1)}deg`;
}

function fmtCheckpointStart(checkpoint: CheckpointRow): string {
  const stats = checkpoint.compile_stats;
  if (stats === undefined) return "?";
  const start = fmtStart(stats);
  const rank = stats.handoff_start_rank;
  return rank === undefined ? start : `${start}/r${rank}`;
}

function worstAxes(checkpoint: CheckpointRow, limit: number): string {
  const axes = checkpoint.axes ?? [];
  const localCosts = checkpoint.compile_stats?.committed_costs_per_gap;
  return axes
    .slice()
    .sort((a, b) => Math.abs(b.error) - Math.abs(a.error))
    .slice(0, limit)
    .map((axis) =>
      `g${axis.gap_index}.${axis.axis} target=${axis.target.toFixed(2)} ` +
        `ach=${axis.achieved.toFixed(2)} err=${axis.error.toFixed(2)}` +
        localCostSuffix(localCosts?.[axis.gap_index])
    )
    .join(" ");
}

function localCostSuffix(cost: number | null | undefined): string {
  if (cost === undefined) return "";
  return cost === null ? " localCost=null" : ` localCost=${cost.toFixed(3)}`;
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

function targetBand(target: number): typeof TARGET_BANDS[number] {
  if (target < 0.25) return "<0.25";
  if (target < 0.5) return "0.25-0.5";
  if (target < 0.75) return "0.5-0.75";
  return ">=0.75";
}

function printAxisDiagnostics(data: GoldenCurveJson): void {
  const rows = data.rows ?? [];
  const budgets = data.budgets ?? data.budget_scores?.map((summary) => summary.budget) ?? [];
  if (rows.length === 0 || budgets.length === 0) return;
  const lastBudget = budgets[budgets.length - 1];
  const axes = rows.flatMap((row) => {
    const checkpoint = checkpointAt(row, lastBudget);
    const localCosts = checkpoint?.compile_stats?.committed_costs_per_gap;
    return (checkpoint?.axes ?? []).map((axis) => ({
      ...axis,
      signed: axis.achieved - axis.target,
      localCost: localCosts?.[axis.gap_index],
    }));
  });
  if (axes.length === 0) return;

  console.log("");
  console.log(`axis signed errors at ${fmtBudget(lastBudget)} (achieved-target):`);
  for (const axisName of AXES) {
    const axisRows = axes.filter((axis) => axis.axis === axisName);
    if (axisRows.length === 0) continue;
    console.log(`  ${axisName}:`);
    for (const band of TARGET_BANDS) {
      const bucket = axisRows.filter((axis) => targetBand(axis.target) === band);
      if (bucket.length === 0) continue;
      const signedMean = bucket.reduce((sum, axis) => sum + axis.signed, 0) / bucket.length;
      const absMean = bucket.reduce((sum, axis) => sum + Math.abs(axis.signed), 0) / bucket.length;
      const overPct = 100 * bucket.filter((axis) => axis.signed > 0).length / bucket.length;
      const costValues = bucket
        .map((axis) => axis.localCost)
        .filter((cost): cost is number => typeof cost === "number" && Number.isFinite(cost));
      const localCost = costValues.length === 0
        ? ""
        : ` localCost=${(costValues.reduce((sum, cost) => sum + cost, 0) / costValues.length).toFixed(3)}`;
      console.log(
        `    target ${band.padEnd(8)} n=${String(bucket.length).padStart(3)} ` +
          `signed=${fmtSigned(signedMean, 3).padStart(7)} ` +
          `abs=${absMean.toFixed(3)} over=${overPct.toFixed(1)}%${localCost}`,
      );
    }
  }
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

type StartDiagnosticRow = {
  startSpeed: number;
  startAngleDeg: number;
  startRank?: number;
  firstSpeedTarget?: number;
  firstAirTarget?: number;
};

function printStartDiagnostics(data: GoldenCurveJson): void {
  const rows = data.rows ?? [];
  const budgets = data.budgets ?? data.budget_scores?.map((summary) => summary.budget) ?? [];
  if (rows.length === 0 || budgets.length === 0) return;
  const lastBudget = budgets[budgets.length - 1];
  const startRows = rows
    .map((row) => {
      const checkpoint = checkpointAt(row, lastBudget);
      const stats = checkpoint?.compile_stats;
      if (
        checkpoint === undefined ||
        stats?.handoff_start_speed === undefined ||
        stats.handoff_start_angle_deg === undefined
      ) {
        return null;
      }
      return {
        startSpeed: stats.handoff_start_speed,
        startAngleDeg: stats.handoff_start_angle_deg,
        startRank: stats.handoff_start_rank,
        firstSpeedTarget: firstGapTarget(checkpoint, "speed"),
        firstAirTarget: firstGapTarget(checkpoint, "air"),
      };
    })
    .filter((row): row is StartDiagnosticRow => row !== null);
  if (startRows.length === 0) return;

  console.log("");
  console.log(`selected starts at ${fmtBudget(lastBudget)}:`);
  printStartBucket("all", startRows);
  printStartBandBuckets("first speed", startRows, (row) => row.firstSpeedTarget);
  printStartBandBuckets("first air", startRows, (row) => row.firstAirTarget);
}

type CandidateRankSummary = {
  rows: number;
  contacts: number;
  nonzero: number;
  weightedRankSum: number;
  maxRank: number;
  pool: number;
  reuse: number;
  brake: number;
  axisq: number;
};

function printCandidateRankDiagnostics(data: GoldenCurveJson): void {
  const rows = data.rows ?? [];
  const budgets = data.budgets ?? data.budget_scores?.map((summary) => summary.budget) ?? [];
  if (rows.length === 0 || budgets.length === 0) return;
  const lastBudget = budgets[budgets.length - 1];
  const byLane = new Map<string, CandidateRankSummary>();
  const all: CandidateRankSummary = {
    rows: 0,
    contacts: 0,
    nonzero: 0,
    weightedRankSum: 0,
    maxRank: 0,
    pool: 0,
    reuse: 0,
    brake: 0,
    axisq: 0,
  };

  for (const row of rows) {
    const checkpoint = checkpointAt(row, lastBudget);
    const stats = checkpoint?.compile_stats;
    const count = stats?.handoff_selected_candidate_rank_count;
    const meanRank = stats?.handoff_selected_candidate_rank_mean;
    if (count === undefined || meanRank === undefined || count <= 0) continue;
    const nonzero = stats?.handoff_selected_candidate_nonzero_ranks ?? 0;
    const maxRank = stats?.handoff_selected_candidate_rank_max ?? 0;
    accumulateRankSummary(all, stats, count, nonzero, meanRank, maxRank);

    const lane = `lane ${stats?.handoff_search_lane ?? "?"}`;
    let summary = byLane.get(lane);
    if (summary === undefined) {
      summary = {
        rows: 0,
        contacts: 0,
        nonzero: 0,
        weightedRankSum: 0,
        maxRank: 0,
        pool: 0,
        reuse: 0,
        brake: 0,
        axisq: 0,
      };
      byLane.set(lane, summary);
    }
    accumulateRankSummary(summary, stats, count, nonzero, meanRank, maxRank);
  }
  if (all.rows === 0) return;

  console.log("");
  console.log(`selected candidate ranks at ${fmtBudget(lastBudget)}:`);
  printCandidateRankSummary("all", all);
  for (const [lane, summary] of [...byLane.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    printCandidateRankSummary(lane, summary);
  }
}

function accumulateRankSummary(
  summary: CandidateRankSummary,
  stats: CompileStats,
  count: number,
  nonzero: number,
  meanRank: number,
  maxRank: number,
): void {
  summary.rows++;
  summary.contacts += count;
  summary.nonzero += nonzero;
  summary.weightedRankSum += meanRank * count;
  summary.maxRank = Math.max(summary.maxRank, maxRank);
  summary.pool += stats.handoff_selected_candidate_pool_count ?? 0;
  summary.reuse += stats.handoff_selected_candidate_reuse_count ?? 0;
  summary.brake += stats.handoff_selected_candidate_brake_count ?? 0;
  summary.axisq += stats.handoff_selected_candidate_axis_quality_count ?? 0;
}

function printCandidateRankSummary(label: string, summary: CandidateRankSummary): void {
  const meanRank = summary.contacts > 0 ? summary.weightedRankSum / summary.contacts : 0;
  console.log(
    `  ${label.padEnd(8)} n=${String(summary.rows).padStart(3)} ` +
      `nonzero=${summary.nonzero}/${summary.contacts} ` +
      `mean=${meanRank.toFixed(2)} max=${summary.maxRank} ` +
      `src=${summary.pool}/${summary.reuse}/${summary.brake}/${summary.axisq}`,
  );
}

function printStreamDiagnostics(data: GoldenCurveJson): void {
  const rows = data.rows ?? [];
  const budgets = data.budgets ?? data.budget_scores?.map((summary) => summary.budget) ?? [];
  if (rows.length === 0 || budgets.length === 0) return;
  const lastBudget = budgets[budgets.length - 1];
  const checkpoints = rows
    .map((row) => checkpointAt(row, lastBudget))
    .filter((checkpoint): checkpoint is CheckpointRow => checkpoint !== undefined);
  if (checkpoints.length === 0) return;

  const lines = STREAM_YIELD_STATS
    .map(([label, successKey, attemptKey]) => {
      const attempts = sumCheckpointStat(checkpoints, attemptKey);
      const successes = sumCheckpointStat(checkpoints, successKey);
      if (attempts === 0 && successes === 0 && label !== "polish") return null;
      return (
        `  ${label.padEnd(STREAM_YIELD_LABEL_WIDTH)} ` +
        `${String(successes).padStart(6)}/${String(attempts).padEnd(6)} ` +
        `rate=${fmtRate(successes, attempts).padStart(6)} ` +
        `attempts/row=${(attempts / checkpoints.length).toFixed(1)}`
      );
    })
    .filter((line): line is string => line !== null);
  if (lines.length === 0) return;

  console.log("");
  console.log(`extra work yield at ${fmtBudget(lastBudget)}:`);
  for (const line of lines) console.log(line);
}

function printArcPlacementDiagnostics(data: GoldenCurveJson): void {
  const rows = data.rows ?? [];
  const budgets = data.budgets ?? data.budget_scores?.map((summary) => summary.budget) ?? [];
  if (rows.length === 0 || budgets.length === 0) return;
  const lastBudget = budgets[budgets.length - 1];
  const checkpoints = rows
    .map((row) => checkpointAt(row, lastBudget))
    .filter((checkpoint): checkpoint is CheckpointRow =>
      checkpoint?.compile_stats?.arc_placement !== undefined
    );
  if (checkpoints.length === 0) return;

  const sampled = sumArcPlacementStat(checkpoints, "sampled");
  const preclear = sumArcPlacementStat(checkpoints, "preclear_rejected");
  const directAttempted = sumArcPlacementStat(checkpoints, "direct_attempted");
  const directLanded = sumArcPlacementStat(checkpoints, "direct_landed");
  const directFailed = sumArcPlacementStat(checkpoints, "direct_failed");
  const fallbackAttempted = sumArcPlacementStat(checkpoints, "fallback_attempted");
  const fallbackLanded = sumArcPlacementStat(checkpoints, "fallback_landed");

  console.log("");
  console.log(`impact-anchor placement at ${fmtBudget(lastBudget)}:`);
  console.log(
    `  sampled=${sampled} attempts/row=${(sampled / checkpoints.length).toFixed(1)} ` +
      `preclear=${preclear} direct=${directLanded}/${directAttempted} ` +
      `rate=${fmtRate(directLanded, directAttempted)} failed=${directFailed} ` +
      `fallback=${fallbackLanded}/${fallbackAttempted} ` +
      `rate=${fmtRate(fallbackLanded, fallbackAttempted)}`,
  );
}

function sumArcPlacementStat(
  checkpoints: CheckpointRow[],
  key: keyof ArcPlacementStats,
): number {
  let sum = 0;
  for (const checkpoint of checkpoints) {
    const value = checkpoint.compile_stats?.arc_placement?.[key];
    if (typeof value === "number") sum += value;
  }
  return sum;
}

function sumCheckpointStat(checkpoints: CheckpointRow[], key: keyof CompileStats): number {
  let sum = 0;
  for (const checkpoint of checkpoints) {
    const value = numericStat(checkpoint.compile_stats, key);
    if (value !== undefined) sum += value;
  }
  return sum;
}

function fmtRate(successes: number, attempts: number): string {
  return attempts === 0 ? "n/a" : `${(100 * successes / attempts).toFixed(1)}%`;
}

function firstGapTarget(checkpoint: CheckpointRow, axis: AxisName): number | undefined {
  return checkpoint.axes?.find((entry) => entry.gap_index === 0 && entry.axis === axis)?.target;
}

function printStartBandBuckets(
  label: string,
  rows: StartDiagnosticRow[],
  target: (row: StartDiagnosticRow) => number | undefined,
): void {
  const rowsWithTarget = rows
    .map((row) => ({ row, target: target(row) }))
    .filter((entry): entry is { row: StartDiagnosticRow; target: number } =>
      entry.target !== undefined
    );
  if (rowsWithTarget.length === 0) return;
  console.log(`  ${label} target bands:`);
  for (const band of TARGET_BANDS) {
    const bucket = rowsWithTarget
      .filter((entry) => targetBand(entry.target) === band)
      .map((entry) => entry.row);
    if (bucket.length === 0) continue;
    printStartBucket(`target ${band}`, bucket, "    ");
  }
}

function printStartBucket(label: string, rows: StartDiagnosticRow[], indent = "  "): void {
  const meanSpeed = mean(rows.map((row) => row.startSpeed));
  const meanAngle = mean(rows.map((row) => row.startAngleDeg));
  const nonzeroRanks = rows.filter((row) => (row.startRank ?? 0) > 0).length;
  const rankValues = rows
    .map((row) => row.startRank)
    .filter((rank): rank is number => rank !== undefined);
  const rankText = rankValues.length === 0
    ? "rank=?"
    : `rankMean=${mean(rankValues).toFixed(2)} nonzeroRank=${nonzeroRanks}/${rows.length}`;
  console.log(
    `${indent}${label.padEnd(13)} n=${String(rows.length).padStart(3)} ` +
      `speed=${meanSpeed.toFixed(2)} angle=${meanAngle.toFixed(1)}deg ${rankText}`,
  );
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
        `valid=${currentPassed}/${count} (${fmtSigned(passDelta, 0)})` +
        fmtWorkDeltas(pairs, budget),
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
          `${fmtNum(delta.baseline.score)} -> ${fmtNum(delta.current.score)} ` +
          `start=${fmtCheckpointStart(delta.baseline)}->${fmtCheckpointStart(delta.current)}`,
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
        `delta=${fmtSigned(delta.delta)} ` +
        `start=${fmtCheckpointStart(delta.baseline)}->${fmtCheckpointStart(delta.current)}`,
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
        `delta=${fmtSigned(delta.delta)} ` +
        `start=${fmtCheckpointStart(delta.baseline)}->${fmtCheckpointStart(delta.current)}`,
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
  printStreamDiagnostics(data);
  printArcPlacementDiagnostics(data);
  printStartDiagnostics(data);
  printCandidateRankDiagnostics(data);
  printAxisDiagnostics(data);
  if (baseline !== null) printComparison(data, baseline);
}

main();
