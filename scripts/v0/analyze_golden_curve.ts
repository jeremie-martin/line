/**
 * Offline summary for golden budget-curve JSON.
 *
 *   npx tsx scripts/v0/analyze_golden_curve.ts /tmp/golden.json
 *   npx tsx scripts/v0/analyze_golden_curve.ts probe/golden.json baseline/golden.json
 *   LR_ENGINE=wasm npm run golden -- --json --specs=tiny_dance --seed=0 --jobs=6 | npx tsx scripts/v0/analyze_golden_curve.ts -
 */

import { readFileSync } from "node:fs";
import { shiftedGeometricMean } from "./score.ts";
import {
  DEFAULT_ALPHA,
  headlineScore,
  pairedBootstrapCI,
  parseAlpha,
  parseBudgetList,
  selectScoreBudgets,
  type ScoreCube,
  type ValidCube,
} from "./metric.ts";
import {
  AXES,
  CANDIDATE_SAMPLE_MODES,
  HANDOFF_CANDIDATE_SOURCES,
  HANDOFF_EVALUATION_PHASES,
  type ArcPlacementCounter,
  type AxisName,
  type CandidateSampleMode,
  type HandoffContactCountCounter,
  type HandoffEvaluationPhase,
  type HandoffCandidateSourceName,
} from "./types.ts";

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

type PartialArcPlacementCounter = Partial<ArcPlacementCounter>;

type ArcPlacementStats = PartialArcPlacementCounter & {
  mode?: "impact_anchor" | "impact_frame";
  by_sample_mode?: Partial<Record<CandidateSampleMode, PartialArcPlacementCounter>>;
};

type AxisQualityCounter = {
  attempts?: number;
  successes?: number;
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
  handoff_duplicate_evaluations_by_phase?: Partial<Record<HandoffEvaluationPhase, number>>;
  handoff_duplicate_full_evaluations_by_phase?: Partial<Record<HandoffEvaluationPhase, number>>;
  handoff_tail_completion_attempts?: number;
  handoff_tail_completion_successes?: number;
  handoff_tail_completion_improvements?: number;
  handoff_tail_completion_attempts_by_remaining_contacts?: HandoffContactCountCounter;
  handoff_tail_completion_successes_by_remaining_contacts?: HandoffContactCountCounter;
  handoff_tail_completion_improvements_by_remaining_contacts?: HandoffContactCountCounter;
  handoff_start_options?: number;
  handoff_start_rank?: number;
  handoff_start_speed?: number;
  handoff_start_angle_deg?: number;
  handoff_start_ranks_seen?: number;
  handoff_start_ranks_with_fits?: number;
  handoff_full_evaluations?: number;
  handoff_evaluations_by_phase?: Partial<Record<HandoffEvaluationPhase, number>>;
  handoff_full_evaluations_by_phase?: Partial<Record<HandoffEvaluationPhase, number>>;
  handoff_improvements_by_phase?: Partial<Record<HandoffEvaluationPhase, number>>;
  handoff_unique_full_evaluations?: number;
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
  handoff_axis_quality_by_axis?: Partial<Record<AxisName, AxisQualityCounter>>;
  handoff_axis_quality_air_attempts?: number;
  handoff_axis_quality_air_successes?: number;
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
  handoff_selected_candidate_by_source?: Partial<Record<HandoffCandidateSourceName, number>>;
  handoff_selected_axis_quality_by_axis?: Partial<Record<AxisName, number>>;
  handoff_selected_candidate_pool_count?: number;
  handoff_selected_candidate_reuse_count?: number;
  handoff_selected_candidate_brake_count?: number;
  handoff_selected_candidate_axis_quality_count?: number;
  handoff_prefix_branch_forks?: number;
  handoff_prefix_branch_evaluations?: number;
  handoff_prefix_branch_full_evaluations?: number;
  handoff_prefix_branch_improvements?: number;
  handoff_prefix_branch_prunes?: number;
  handoff_prefix_branch_duplicate_key_skips?: number;
  handoff_prefix_branch_forks_by_remaining_contacts?: HandoffContactCountCounter;
  handoff_prefix_branch_evaluations_by_remaining_contacts?: HandoffContactCountCounter;
  handoff_prefix_branch_full_evaluations_by_remaining_contacts?: HandoffContactCountCounter;
  handoff_prefix_branch_improvements_by_remaining_contacts?: HandoffContactCountCounter;
  handoff_prefix_branch_prunes_by_remaining_contacts?: HandoffContactCountCounter;
  handoff_prefix_branch_duplicate_key_skips_by_remaining_contacts?: HandoffContactCountCounter;
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
  headline?: {
    score: number;
    ceiling: number;
    log_auc: number;
    alpha: number;
    score_budgets: number[];
    validity: { budget: number; pass_rate: number }[];
  };
  evaluator_fingerprint?: string;
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
  ["suffix", "handoff_suffix_repair_successes", "handoff_suffix_repair_attempts"],
  ["suffix_best", "handoff_suffix_repair_improvements", "handoff_suffix_repair_successes"],
  ["rescue", "handoff_rescue_successes", "handoff_rescue_attempts"],
  ["branch", "handoff_prefix_branch_improvements", "handoff_prefix_branch_evaluations"],
] as const satisfies ReadonlyArray<readonly [string, keyof CompileStats, keyof CompileStats]>;

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
    `src=${formatSelectedCandidateSources(stats)}`,
    `branch=${stats.handoff_prefix_branch_improvements ?? "?"}/` +
      `${stats.handoff_prefix_branch_evaluations ?? "?"}` +
      `(${stats.handoff_prefix_branch_full_evaluations ?? "?"}f,` +
      `${stats.handoff_prefix_branch_forks ?? "?"}forks,` +
      `${stats.handoff_prefix_branch_prunes ?? "?"}prunes,` +
      `${stats.handoff_prefix_branch_duplicate_key_skips ?? "?"}keySkips)`,
    `full=${stats.handoff_full_evaluations ?? "?"}`,
    `ufull=${formatUniqueFullEvaluations(stats)}`,
    `partial=${stats.handoff_partial_evaluations ?? "?"}`,
  ];
  const selectedAxisQualitySources = formatSelectedAxisQualitySources(stats);
  if (selectedAxisQualitySources !== "") parts.push(`axisqSrc=${selectedAxisQualitySources}`);
  return parts.join(" ");
}

function formatUniqueFullEvaluations(stats: CompileStats): string {
  if (stats.handoff_unique_full_evaluations !== undefined) {
    return String(stats.handoff_unique_full_evaluations);
  }
  if (
    stats.handoff_full_evaluations !== undefined &&
    stats.handoff_duplicate_full_evaluations !== undefined
  ) {
    return String(
      Math.max(0, stats.handoff_full_evaluations - stats.handoff_duplicate_full_evaluations),
    );
  }
  return "?";
}

function formatSelectedCandidateSources(stats: CompileStats): string {
  return HANDOFF_CANDIDATE_SOURCES
    .map((source) => selectedCandidateSourceStat(stats, source) ?? "?")
    .join("/");
}

function formatSelectedAxisQualitySources(stats: CompileStats): string {
  return formatAxisCountMap(stats.handoff_selected_axis_quality_by_axis);
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
  const lastCheckpoints = rows.map((row) => checkpointAt(row, lastBudget)).filter((c): c is CheckpointRow => c !== undefined);
  // Compact `--json` output drops the per-checkpoint `axes` array, so the diagnostics
  // would silently print nothing. Distinguish that from a legitimately-empty archive
  // and tell the user how to capture per-axis data.
  if (lastCheckpoints.length > 0 && lastCheckpoints.every((c) => c.axes === undefined)) {
    console.warn(
      "note: no per-axis data in this archive (compact --json) — re-run golden with --details (or --json-full) to capture per-axis signed-error diagnostics.",
    );
    return;
  }
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
  axisqByAxis: Partial<Record<AxisName, number>>;
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
    axisqByAxis: {},
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
        axisqByAxis: {},
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
  summary.pool += selectedCandidateSourceStat(stats, "pool") ?? 0;
  summary.reuse += selectedCandidateSourceStat(stats, "reuse") ?? 0;
  summary.brake += selectedCandidateSourceStat(stats, "brake") ?? 0;
  summary.axisq += selectedCandidateSourceStat(stats, "axisq") ?? 0;
  accumulateAxisCountMap(summary.axisqByAxis, stats.handoff_selected_axis_quality_by_axis);
}

function printCandidateRankSummary(label: string, summary: CandidateRankSummary): void {
  const meanRank = summary.contacts > 0 ? summary.weightedRankSum / summary.contacts : 0;
  const axisqByAxis = formatAxisCountMap(summary.axisqByAxis);
  console.log(
    `  ${label.padEnd(8)} n=${String(summary.rows).padStart(3)} ` +
      `nonzero=${summary.nonzero}/${summary.contacts} ` +
      `mean=${meanRank.toFixed(2)} max=${summary.maxRank} ` +
      `src=${summary.pool}/${summary.reuse}/${summary.brake}/${summary.axisq}` +
      (axisqByAxis === "" ? "" : ` axisqSrc=${axisqByAxis}`),
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

  const rowsToPrint = streamYieldRows(checkpoints);
  const labelWidth = Math.max(...rowsToPrint.map((row) => row.label.length));
  const lines = rowsToPrint.map((row) =>
    `  ${row.label.padEnd(labelWidth)} ` +
    `${String(row.successes).padStart(6)}/${String(row.attempts).padEnd(6)} ` +
    `rate=${fmtRate(row.successes, row.attempts).padStart(6)} ` +
    `attempts/row=${(row.attempts / checkpoints.length).toFixed(1)}`
  );
  if (lines.length === 0) return;

  console.log("");
  console.log(`extra work yield at ${fmtBudget(lastBudget)}:`);
  for (const line of lines) console.log(line);
}

function printTerminalFeedbackDiagnostics(data: GoldenCurveJson): void {
  const rows = data.rows ?? [];
  const budgets = data.budgets ?? data.budget_scores?.map((summary) => summary.budget) ?? [];
  if (rows.length === 0 || budgets.length === 0) return;
  const lastBudget = budgets[budgets.length - 1];
  const checkpoints = rows
    .map((row) => checkpointAt(row, lastBudget))
    .filter((checkpoint): checkpoint is CheckpointRow => checkpoint !== undefined);
  if (checkpoints.length === 0) return;

  const full = sumCheckpointStat(checkpoints, "handoff_full_evaluations");
  const uniqueFull = sumUniqueFullEvaluations(checkpoints);
  if (full === 0 || uniqueFull === undefined) return;

  const evaluationsByPhase = sumPhaseCounter(checkpoints, "handoff_evaluations_by_phase");
  const fullByPhase = sumPhaseCounter(checkpoints, "handoff_full_evaluations_by_phase");
  const improvementsByPhase = sumPhaseCounter(checkpoints, "handoff_improvements_by_phase");
  const duplicateFull = Math.max(0, full - uniqueFull);
  const duplicateByPhase = sumPhaseCounter(checkpoints, "handoff_duplicate_evaluations_by_phase");
  const duplicateFullByPhase = sumPhaseCounter(
    checkpoints,
    "handoff_duplicate_full_evaluations_by_phase",
  );
  console.log("");
  console.log(`terminal feedback diversity at ${fmtBudget(lastBudget)}:`);
  console.log(
    `  full=${full} ufull=${uniqueFull} dupFull=${duplicateFull} ` +
      `uniqueRate=${fmtRate(uniqueFull, full)} ` +
      `full/row=${(full / checkpoints.length).toFixed(1)} ` +
      `ufull/row=${(uniqueFull / checkpoints.length).toFixed(1)}`,
  );
  if (
    hasPhaseCounts(evaluationsByPhase) ||
    hasPhaseCounts(fullByPhase) ||
    hasPhaseCounts(improvementsByPhase)
  ) {
    console.log(
      `  evalByPhase=${formatPhaseCounter(evaluationsByPhase)} ` +
        `fullByPhase=${formatPhaseCounter(fullByPhase)} ` +
        `bestByPhase=${formatPhaseCounter(improvementsByPhase)}`,
    );
    printPhaseFeedbackRows(
      evaluationsByPhase,
      fullByPhase,
      improvementsByPhase,
      duplicateFullByPhase,
    );
  }
  if (hasPhaseCounts(duplicateByPhase) || hasPhaseCounts(duplicateFullByPhase)) {
    console.log(
      `  dupByPhase=${formatPhaseCounter(duplicateByPhase)} ` +
        `dupFullByPhase=${formatPhaseCounter(duplicateFullByPhase)}`,
    );
  }
  printTailDepthRows(checkpoints);
  printBranchDepthRows(checkpoints);
}

function printPhaseFeedbackRows(
  evaluationsByPhase: Record<HandoffEvaluationPhase, number>,
  fullByPhase: Record<HandoffEvaluationPhase, number>,
  improvementsByPhase: Record<HandoffEvaluationPhase, number>,
  duplicateFullByPhase: Record<HandoffEvaluationPhase, number>,
): void {
  for (const phase of HANDOFF_EVALUATION_PHASES) {
    const evaluations = evaluationsByPhase[phase];
    const full = fullByPhase[phase];
    const best = improvementsByPhase[phase];
    const duplicateFull = duplicateFullByPhase[phase];
    if (evaluations === 0 && full === 0 && best === 0 && duplicateFull === 0) continue;
    const uniqueFull = Math.max(0, full - duplicateFull);
    console.log(
      `  ${phase.padEnd(6)} ` +
        `eval=${String(evaluations).padStart(5)} ` +
        `full=${String(full).padStart(5)} ` +
        `ufull=${String(uniqueFull).padStart(5)} ` +
        `best=${String(best).padStart(4)} ` +
        `best/eval=${fmtRate(best, evaluations).padStart(6)} ` +
        `best/full=${fmtRate(best, full).padStart(6)} ` +
        `dupFull=${fmtRate(duplicateFull, full).padStart(6)}`,
    );
  }
}

function printTailDepthRows(checkpoints: CheckpointRow[]): void {
  const attempts = sumContactCountCounter(
    checkpoints,
    "handoff_tail_completion_attempts_by_remaining_contacts",
  );
  const successes = sumContactCountCounter(
    checkpoints,
    "handoff_tail_completion_successes_by_remaining_contacts",
  );
  const improvements = sumContactCountCounter(
    checkpoints,
    "handoff_tail_completion_improvements_by_remaining_contacts",
  );
  const depths = sortedContactCounts(attempts, successes, improvements);
  if (depths.length === 0) return;

  console.log("  tail depth yield:");
  for (const depth of depths) {
    const attemptCount = attempts[depth] ?? 0;
    const successCount = successes[depth] ?? 0;
    const improvementCount = improvements[depth] ?? 0;
    console.log(
      `    rem=${String(depth).padStart(2)} ` +
        `${String(improvementCount).padStart(4)}/` +
        `${String(successCount).padStart(4)}/` +
        `${String(attemptCount).padEnd(4)} ` +
        `best/success=${fmtRate(improvementCount, successCount).padStart(6)}`,
    );
  }
}

function printBranchDepthRows(checkpoints: CheckpointRow[]): void {
  const forks = sumContactCountCounter(
    checkpoints,
    "handoff_prefix_branch_forks_by_remaining_contacts",
  );
  const evaluations = sumContactCountCounter(
    checkpoints,
    "handoff_prefix_branch_evaluations_by_remaining_contacts",
  );
  const full = sumContactCountCounter(
    checkpoints,
    "handoff_prefix_branch_full_evaluations_by_remaining_contacts",
  );
  const improvements = sumContactCountCounter(
    checkpoints,
    "handoff_prefix_branch_improvements_by_remaining_contacts",
  );
  const prunes = sumContactCountCounter(
    checkpoints,
    "handoff_prefix_branch_prunes_by_remaining_contacts",
  );
  const duplicateKeySkips = sumContactCountCounter(
    checkpoints,
    "handoff_prefix_branch_duplicate_key_skips_by_remaining_contacts",
  );
  const depths = sortedContactCounts(
    forks,
    evaluations,
    full,
    improvements,
    prunes,
    duplicateKeySkips,
  );
  if (depths.length === 0) return;

  console.log("  branch depth yield:");
  for (const depth of depths) {
    const forkCount = forks[depth] ?? 0;
    const evaluationCount = evaluations[depth] ?? 0;
    const fullCount = full[depth] ?? 0;
    const improvementCount = improvements[depth] ?? 0;
    const pruneCount = prunes[depth] ?? 0;
    const keySkipCount = duplicateKeySkips[depth] ?? 0;
    console.log(
      `    rem=${String(depth).padStart(2)} ` +
        `fork=${String(forkCount).padStart(4)} ` +
        `eval=${String(evaluationCount).padStart(5)} ` +
        `full=${String(fullCount).padStart(5)} ` +
        `best=${String(improvementCount).padStart(4)} ` +
        `prune=${String(pruneCount).padStart(4)} ` +
        `keySkip=${String(keySkipCount).padStart(4)} ` +
        `best/full=${fmtRate(improvementCount, fullCount).padStart(6)}`,
    );
  }
}

function streamYieldRows(
  checkpoints: CheckpointRow[],
): Array<{ label: string; successes: number; attempts: number }> {
  const rows: Array<{ label: string; successes: number; attempts: number }> = [];
  for (const [label, successKey, attemptKey] of STREAM_YIELD_STATS) {
    const attempts = sumCheckpointStat(checkpoints, attemptKey);
    const successes = sumCheckpointStat(checkpoints, successKey);
    if (attempts === 0 && successes === 0 && label !== "polish") continue;
    rows.push({ label, successes, attempts });
    if (label !== "axisq") continue;
    for (const axis of AXES) {
      const split = sumAxisQualityCounter(checkpoints, axis);
      if (split.attempts === 0 && split.successes === 0) continue;
      rows.push({
        label: `axisq_${axis}`,
        successes: split.successes,
        attempts: split.attempts,
      });
    }
  }
  return rows;
}

function sumAxisQualityCounter(
  checkpoints: CheckpointRow[],
  axis: AxisName,
): { attempts: number; successes: number } {
  let attempts = 0;
  let successes = 0;
  for (const checkpoint of checkpoints) {
    const stats = checkpoint.compile_stats;
    const counter = stats?.handoff_axis_quality_by_axis?.[axis];
    if (counter !== undefined) {
      attempts += counter.attempts ?? 0;
      successes += counter.successes ?? 0;
      continue;
    }
    attempts += legacyAxisQualityStat(stats, axis, "attempts") ?? 0;
    successes += legacyAxisQualityStat(stats, axis, "successes") ?? 0;
  }
  return { attempts, successes };
}

function legacyAxisQualityStat(
  stats: CompileStats | undefined,
  axis: AxisName,
  kind: "attempts" | "successes",
): number | undefined {
  if (axis === "air") {
    return kind === "attempts"
      ? stats?.handoff_axis_quality_air_attempts
      : stats?.handoff_axis_quality_air_successes;
  }
  return undefined;
}

function selectedCandidateSourceStat(
  stats: CompileStats | undefined,
  source: HandoffCandidateSourceName,
): number | undefined {
  const mapped = stats?.handoff_selected_candidate_by_source?.[source];
  if (typeof mapped === "number" && Number.isFinite(mapped)) return mapped;
  return legacySelectedCandidateSourceStat(stats, source);
}

function legacySelectedCandidateSourceStat(
  stats: CompileStats | undefined,
  source: HandoffCandidateSourceName,
): number | undefined {
  if (source === "pool") return stats?.handoff_selected_candidate_pool_count;
  if (source === "reuse") return stats?.handoff_selected_candidate_reuse_count;
  if (source === "brake") return stats?.handoff_selected_candidate_brake_count;
  if (source === "axisq") return stats?.handoff_selected_candidate_axis_quality_count;
  return undefined;
}

function accumulateAxisCountMap(
  target: Partial<Record<AxisName, number>>,
  source: Partial<Record<AxisName, number>> | undefined,
): void {
  if (source === undefined) return;
  for (const axis of AXES) {
    const value = source[axis];
    if (typeof value === "number" && Number.isFinite(value)) {
      target[axis] = (target[axis] ?? 0) + value;
    }
  }
}

function formatAxisCountMap(counts: Partial<Record<AxisName, number>> | undefined): string {
  if (counts === undefined) return "";
  return AXES
    .map((axis) => {
      const count = counts[axis] ?? 0;
      return count === 0 ? null : `${axis}:${count}`;
    })
    .filter((entry): entry is string => entry !== null)
    .join(",");
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

  const aggregate = sumArcPlacementCounter(checkpoints);
  const placementModes = new Set(
    checkpoints
      .map((checkpoint) => checkpoint.compile_stats?.arc_placement?.mode)
      .filter((mode): mode is NonNullable<ArcPlacementStats["mode"]> => mode !== undefined),
  );
  const placementLabel = placementModes.size === 1
    ? [...placementModes][0]
    : placementModes.size > 1
    ? "mixed"
    : "unknown";

  console.log("");
  console.log(`arc placement (${placementLabel}) at ${fmtBudget(lastBudget)}:`);
  console.log(formatArcPlacementCounter("all", aggregate, checkpoints.length));

  const hasModeBreakdown = checkpoints.some((checkpoint) =>
    checkpoint.compile_stats?.arc_placement?.by_sample_mode !== undefined
  );
  if (!hasModeBreakdown) return;

  let attributed = emptyArcPlacementCounter();
  for (const mode of CANDIDATE_SAMPLE_MODES) {
    const counter = sumArcPlacementCounter(checkpoints, mode);
    attributed = addArcPlacementCounters(attributed, counter);
    if (!hasAnyArcPlacementCounter(counter)) continue;
    console.log(formatArcPlacementCounter(mode, counter, checkpoints.length));
  }

  const unattributed = subtractArcPlacementCounter(aggregate, attributed);
  if (hasAnyArcPlacementCounter(unattributed)) {
    console.log(formatArcPlacementCounter("unattributed", unattributed, checkpoints.length));
  }
}

function formatArcPlacementCounter(
  label: string,
  counter: ArcPlacementCounter,
  rowCount: number,
): string {
  return `  ${label.padEnd(12)} sampled=${counter.sampled} ` +
    `sampled/row=${(counter.sampled / rowCount).toFixed(1)} ` +
    `preclear=${counter.preclear_rejected} ` +
    `direct=${counter.direct_landed}/${counter.direct_attempted} ` +
    `rate=${fmtRate(counter.direct_landed, counter.direct_attempted)} ` +
    `failed=${counter.direct_failed} ` +
    `failReasons=${counter.direct_survival_failed}/` +
      `${counter.direct_landing_failed}/${counter.direct_offbeat_failed} ` +
    `fallback=${counter.fallback_landed}/${counter.fallback_attempted} ` +
    `rate=${fmtRate(counter.fallback_landed, counter.fallback_attempted)}`;
}

function sumArcPlacementStat(
  checkpoints: CheckpointRow[],
  key: keyof ArcPlacementCounter,
  mode?: CandidateSampleMode,
): number {
  let sum = 0;
  for (const checkpoint of checkpoints) {
    const stats = checkpoint.compile_stats?.arc_placement;
    const value = mode === undefined ? stats?.[key] : stats?.by_sample_mode?.[mode]?.[key];
    if (typeof value === "number") sum += value;
  }
  return sum;
}

function sumArcPlacementCounter(
  checkpoints: CheckpointRow[],
  mode?: CandidateSampleMode,
): ArcPlacementCounter {
  return {
    sampled: sumArcPlacementStat(checkpoints, "sampled", mode),
    preclear_rejected: sumArcPlacementStat(checkpoints, "preclear_rejected", mode),
    direct_attempted: sumArcPlacementStat(checkpoints, "direct_attempted", mode),
    direct_landed: sumArcPlacementStat(checkpoints, "direct_landed", mode),
    direct_failed: sumArcPlacementStat(checkpoints, "direct_failed", mode),
    direct_survival_failed: sumArcPlacementStat(checkpoints, "direct_survival_failed", mode),
    direct_landing_failed: sumArcPlacementStat(checkpoints, "direct_landing_failed", mode),
    direct_offbeat_failed: sumArcPlacementStat(checkpoints, "direct_offbeat_failed", mode),
    fallback_attempted: sumArcPlacementStat(checkpoints, "fallback_attempted", mode),
    fallback_landed: sumArcPlacementStat(checkpoints, "fallback_landed", mode),
  };
}

function emptyArcPlacementCounter(): ArcPlacementCounter {
  return {
    sampled: 0,
    preclear_rejected: 0,
    direct_attempted: 0,
    direct_landed: 0,
    direct_failed: 0,
    direct_survival_failed: 0,
    direct_landing_failed: 0,
    direct_offbeat_failed: 0,
    fallback_attempted: 0,
    fallback_landed: 0,
  };
}

function addArcPlacementCounters(
  left: ArcPlacementCounter,
  right: ArcPlacementCounter,
): ArcPlacementCounter {
  return {
    sampled: left.sampled + right.sampled,
    preclear_rejected: left.preclear_rejected + right.preclear_rejected,
    direct_attempted: left.direct_attempted + right.direct_attempted,
    direct_landed: left.direct_landed + right.direct_landed,
    direct_failed: left.direct_failed + right.direct_failed,
    direct_survival_failed: left.direct_survival_failed + right.direct_survival_failed,
    direct_landing_failed: left.direct_landing_failed + right.direct_landing_failed,
    direct_offbeat_failed: left.direct_offbeat_failed + right.direct_offbeat_failed,
    fallback_attempted: left.fallback_attempted + right.fallback_attempted,
    fallback_landed: left.fallback_landed + right.fallback_landed,
  };
}

function subtractArcPlacementCounter(
  left: ArcPlacementCounter,
  right: ArcPlacementCounter,
): ArcPlacementCounter {
  return {
    sampled: left.sampled - right.sampled,
    preclear_rejected: left.preclear_rejected - right.preclear_rejected,
    direct_attempted: left.direct_attempted - right.direct_attempted,
    direct_landed: left.direct_landed - right.direct_landed,
    direct_failed: left.direct_failed - right.direct_failed,
    direct_survival_failed: left.direct_survival_failed - right.direct_survival_failed,
    direct_landing_failed: left.direct_landing_failed - right.direct_landing_failed,
    direct_offbeat_failed: left.direct_offbeat_failed - right.direct_offbeat_failed,
    fallback_attempted: left.fallback_attempted - right.fallback_attempted,
    fallback_landed: left.fallback_landed - right.fallback_landed,
  };
}

function hasAnyArcPlacementCounter(counter: ArcPlacementCounter): boolean {
  return counter.sampled !== 0 ||
    counter.preclear_rejected !== 0 ||
    counter.direct_attempted !== 0 ||
    counter.direct_landed !== 0 ||
    counter.direct_failed !== 0 ||
    counter.direct_survival_failed !== 0 ||
    counter.direct_landing_failed !== 0 ||
    counter.direct_offbeat_failed !== 0 ||
    counter.fallback_attempted !== 0 ||
    counter.fallback_landed !== 0;
}

function sumCheckpointStat(checkpoints: CheckpointRow[], key: keyof CompileStats): number {
  let sum = 0;
  for (const checkpoint of checkpoints) {
    const value = numericStat(checkpoint.compile_stats, key);
    if (value !== undefined) sum += value;
  }
  return sum;
}

function sumUniqueFullEvaluations(checkpoints: CheckpointRow[]): number | undefined {
  let sum = 0;
  for (const checkpoint of checkpoints) {
    const stats = checkpoint.compile_stats;
    const uniqueFull = numericStat(stats, "handoff_unique_full_evaluations");
    if (uniqueFull !== undefined) {
      sum += uniqueFull;
      continue;
    }
    const full = numericStat(stats, "handoff_full_evaluations");
    const duplicateFull = numericStat(stats, "handoff_duplicate_full_evaluations");
    if (full === undefined || duplicateFull === undefined) return undefined;
    sum += Math.max(0, full - duplicateFull);
  }
  return sum;
}

function sumPhaseCounter(
  checkpoints: CheckpointRow[],
  key:
    | "handoff_evaluations_by_phase"
    | "handoff_full_evaluations_by_phase"
    | "handoff_improvements_by_phase"
    | "handoff_duplicate_evaluations_by_phase"
    | "handoff_duplicate_full_evaluations_by_phase",
): Record<HandoffEvaluationPhase, number> {
  const sums = Object.fromEntries(
    HANDOFF_EVALUATION_PHASES.map((phase) => [phase, 0]),
  ) as Record<HandoffEvaluationPhase, number>;
  for (const checkpoint of checkpoints) {
    const counter = checkpoint.compile_stats?.[key];
    if (counter === undefined) continue;
    for (const phase of HANDOFF_EVALUATION_PHASES) {
      sums[phase] += counter[phase] ?? 0;
    }
  }
  return sums;
}

function sumContactCountCounter(
  checkpoints: CheckpointRow[],
  key:
    | "handoff_tail_completion_attempts_by_remaining_contacts"
    | "handoff_tail_completion_successes_by_remaining_contacts"
    | "handoff_tail_completion_improvements_by_remaining_contacts"
    | "handoff_prefix_branch_forks_by_remaining_contacts"
    | "handoff_prefix_branch_evaluations_by_remaining_contacts"
    | "handoff_prefix_branch_full_evaluations_by_remaining_contacts"
    | "handoff_prefix_branch_improvements_by_remaining_contacts"
    | "handoff_prefix_branch_prunes_by_remaining_contacts"
    | "handoff_prefix_branch_duplicate_key_skips_by_remaining_contacts",
): Record<number, number> {
  const sums: Record<number, number> = {};
  for (const checkpoint of checkpoints) {
    const counter = checkpoint.compile_stats?.[key];
    if (counter === undefined) continue;
    for (const [rawDepth, rawCount] of Object.entries(counter)) {
      const depth = Number(rawDepth);
      const count = Number(rawCount);
      if (!Number.isFinite(depth) || !Number.isFinite(count)) continue;
      sums[depth] = (sums[depth] ?? 0) + count;
    }
  }
  return sums;
}

function sortedContactCounts(...counters: Array<Record<number, number>>): number[] {
  const depths = new Set<number>();
  for (const counter of counters) {
    for (const rawDepth of Object.keys(counter)) {
      const depth = Number(rawDepth);
      if (Number.isFinite(depth)) depths.add(depth);
    }
  }
  return [...depths].sort((a, b) => a - b);
}

function hasPhaseCounts(counter: Record<HandoffEvaluationPhase, number>): boolean {
  return HANDOFF_EVALUATION_PHASES.some((phase) => counter[phase] !== 0);
}

function formatPhaseCounter(counter: Record<HandoffEvaluationPhase, number>): string {
  return HANDOFF_EVALUATION_PHASES
    .map((phase) => `${phase}:${counter[phase]}`)
    .join("/");
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

/** Build the per-config score + validity cubes (spec -> seed -> budget -> value)
 *  from a golden archive's headline rows. */
function buildCubes(data: GoldenCurveJson): { score: ScoreCube; valid: ValidCube; budgets: number[] } {
  const score: ScoreCube = new Map();
  const valid: ValidCube = new Map();
  const budgets = new Set<number>();
  for (const row of data.rows ?? []) {
    if ((row.variant ?? "base") !== "base") continue; // headline rows only
    if (!score.has(row.name)) {
      score.set(row.name, new Map());
      valid.set(row.name, new Map());
    }
    const sByBudget = new Map<number, number>();
    const vByBudget = new Map<number, boolean>();
    for (const ck of row.checkpoints) {
      sByBudget.set(ck.budget, ck.score);
      vByBudget.set(ck.budget, ck.contract_passed);
      budgets.add(ck.budget);
    }
    score.get(row.name)!.set(row.seed, sByBudget);
    valid.get(row.name)!.set(row.seed, vByBudget);
  }
  return { score, valid, budgets: [...budgets].sort((a, b) => a - b) };
}

function archiveHeadline(data: GoldenCurveJson, scoreBudgets: number[], alpha: number): number {
  const points = scoreBudgets.map((b) => ({
    budget: b,
    score: data.budget_scores!.find((s) => s.budget === b)?.score ?? 0,
  }));
  return headlineScore(points, alpha).score;
}

/** `decide` subcommand: paired-bootstrap accept/reject verdict (replaces "+5"). */
function runDecide(args: string[]): void {
  const positional = args.filter((a) => !a.startsWith("--"));
  const [candPath, basePath] = positional;
  if (!candPath || !basePath) {
    console.error(
      "usage: analyze_golden_curve.ts decide <candidate.json> <baseline.json> " +
        "[--alpha=0.7] [--score-budgets=50000,100000,150000]",
    );
    process.exit(1);
  }
  const flag = (n: string): string | null => {
    const f = args.find((a) => a.startsWith(`--${n}=`));
    return f ? f.slice(n.length + 3) : null;
  };
  const cand = readInput(candPath);
  const base = readInput(basePath);
  const C = buildCubes(cand);
  const B = buildCubes(base);

  // --- scope guard: refuse incomparable inputs LOUDLY (never silently "inconclusive") ---
  const refuse = (msg: string): never => {
    console.error(`REFUSING: ${msg}`);
    process.exit(1);
  };
  const baseFp = base.evaluator_fingerprint;
  const candFp = cand.evaluator_fingerprint;
  if (baseFp && candFp && baseFp !== candFp) {
    refuse(
      `evaluator fingerprint differs (baseline ${baseFp} vs candidate ${candFp}). ` +
        `The scoring ruler/specs changed; scores are not comparable — re-baseline.`,
    );
  }
  const seedsIn = (cube: ScoreCube): Set<number> => {
    const s = new Set<number>();
    for (const bySeed of cube.values()) for (const se of bySeed.keys()) s.add(se);
    return s;
  };
  const baseSpecs = new Set(B.score.keys());
  const candSpecs = new Set(C.score.keys());
  const commonSpecs = [...baseSpecs].filter((s) => candSpecs.has(s));
  const baseSeeds = seedsIn(B.score);
  const candSeeds = seedsIn(C.score);
  const commonSeeds = [...baseSeeds].filter((se) => candSeeds.has(se));
  const commonBudgets = C.budgets.filter((b) => B.budgets.includes(b));
  if (commonSpecs.length === 0) refuse("no overlapping specs between the two archives.");
  if (commonSeeds.length === 0) {
    refuse(`no overlapping seeds (baseline [${[...baseSeeds].join(",")}] vs candidate [${[...candSeeds].join(",")}]) — re-baseline on matching seeds.`);
  }
  if (commonBudgets.length === 0) {
    refuse(`no overlapping budgets (baseline [${B.budgets.join(",")}] vs candidate [${C.budgets.join(",")}]) — re-baseline on a matching grid.`);
  }
  // Default alpha + score-budgets from the archives' STORED headline settings, so
  // `decide` judges the SAME scalar golden.ts wrote as HEADLINE rather than silently
  // recomputing with DEFAULT_ALPHA over all budgets. An explicit flag overrides;
  // archives that disagree refuse (you must pick a scope with a flag).
  const sameList = (x?: number[], y?: number[]): boolean =>
    !!x && !!y && x.length === y.length && x.every((v, i) => v === y[i]);
  let alpha: number;
  if (flag("alpha") !== null) {
    alpha = parseAlpha(flag("alpha")!);
  } else {
    const ba = base.headline?.alpha;
    const ca = cand.headline?.alpha;
    if (ba !== undefined && ca !== undefined && ba !== ca) {
      refuse(`archives disagree on headline alpha (baseline ${ba} vs candidate ${ca}); pass --alpha to override.`);
    }
    alpha = ca ?? ba ?? DEFAULT_ALPHA;
  }
  let subset: number[] | undefined;
  if (flag("score-budgets")) {
    subset = parseBudgetList(flag("score-budgets")!);
  } else {
    const bsb = base.headline?.score_budgets;
    const csb = cand.headline?.score_budgets;
    if (bsb && csb && !sameList(bsb, csb)) {
      refuse(
        `archives disagree on headline score_budgets (baseline [${bsb.join(",")}] vs candidate [${csb.join(",")}]); ` +
          `pass --score-budgets to override.`,
      );
    }
    subset = csb ?? bsb ?? undefined;
  }
  if (subset) {
    const missing = subset.filter((b) => !commonBudgets.includes(b));
    if (missing.length > 0) {
      refuse(`score-budgets ${missing.join(",")} not present in BOTH archives' common budgets [${commonBudgets.join(",")}].`);
    }
  }
  const scoreBudgets = selectScoreBudgets(commonBudgets, subset);
  // Budget-grid equality is part of canonicality: comparing a dense run against a
  // sparse/smoke archive narrows to the intersection and is NOT a canonical metric.
  const sameBudgetGrid = B.budgets.length === C.budgets.length && B.budgets.every((b, i) => b === C.budgets[i]);
  const canonicalScope =
    baseSpecs.size === candSpecs.size &&
    commonSpecs.length === baseSpecs.size &&
    baseSeeds.size === candSeeds.size &&
    commonSeeds.length === baseSeeds.size &&
    sameBudgetGrid;
  if (!canonicalScope) {
    console.warn(
      `WARNING: non-canonical scope — comparing on the intersection (${commonSpecs.length} specs, ` +
        `${commonSeeds.length} seeds, ${scoreBudgets.length} budgets). Indicative, not a canonical/promotable decision.`,
    );
  }

  const d = pairedBootstrapCI(B.score, C.score, scoreBudgets, {
    alpha,
    validBase: B.valid,
    validCand: C.valid,
    rngSeed: 12345,
  });

  console.log(`DECISION  paired cluster bootstrap · alpha=${alpha} · budgets=${scoreBudgets.map(fmtBudget).join(",")}`);
  console.log(
    `  scope: ${commonSpecs.length} specs × ${commonSeeds.length} seeds` +
      `${canonicalScope ? " (canonical)" : " (intersection — INDICATIVE)"}` +
      `${baseFp ? ` · fingerprint ${baseFp}` : ""}`,
  );
  console.log(
    `  headline: baseline ${archiveHeadline(base, scoreBudgets, alpha).toFixed(1)} -> ` +
      `candidate ${archiveHeadline(cand, scoreBudgets, alpha).toFixed(1)}`,
  );
  console.log(
    `  Δheadline = ${d.delta >= 0 ? "+" : ""}${d.delta.toFixed(1)} · ` +
      `95% CI [${d.ciLo.toFixed(1)}, ${d.ciHi.toFixed(1)}] · P(Δ≤0)=${(d.pLeZero * 100).toFixed(1)}% · effect=${d.effect.toFixed(2)}`,
  );
  if (d.validity.length > 0) {
    const ceil = Math.max(...scoreBudgets);
    console.log("  validity (pass-rate base->cand, ΔCI-low; gate = ceiling budget, cheap budgets are informational):");
    for (const v of d.validity) {
      const isGate = v.budget === ceil;
      const regress = v.deltaCiLo < -1e-9;
      const note = isGate ? "  <gate (see VERDICT)>" : regress ? "  (low-budget, not gating)" : "";
      console.log(
        `    ${fmtBudget(v.budget).padStart(5)}  ${(v.baseRate * 100).toFixed(0)}%->${(v.candRate * 100).toFixed(0)}%  ` +
          `ΔCIlo=${(v.deltaCiLo * 100).toFixed(1)}%${note}`,
      );
    }
  }
  console.log(`  VERDICT: ${d.verdict.toUpperCase()}`);

  // A genuine but sub-resolution gain (positive Δ, CI lower bound just below 0) lands
  // as INCONCLUSIVE, indistinguishable at the verdict level from a true null. Estimate
  // how many more seeds would push the lower bound above zero: the half-width toward
  // zero is (Δ - ciLo) and shrinks ~1/√n, so n_need ≈ n_now·((Δ-ciLo)/Δ)². Output-only.
  if (d.verdict === "inconclusive" && d.delta > 0) {
    const nNow = commonSeeds.length;
    const nNeed = Math.ceil(nNow * ((d.delta - d.ciLo) / d.delta) ** 2);
    const extra = Math.max(1, nNeed - nNow);
    console.log(
      `  hint: Δ positive (+${d.delta.toFixed(1)}, P(Δ>0)=${((1 - d.pLeZero) * 100).toFixed(0)}%) but under-powered — ` +
        `~${extra} more seed${extra === 1 ? "" : "s"} (~${nNow + extra} total) would likely resolve it. ` +
        `Approximate; CI width scales ~1/√seeds.`,
    );
  }
}

function main(): void {
  if (process.argv[2] === "decide") {
    runDecide(process.argv.slice(3));
    return;
  }
  const path = process.argv[2];
  if (!path) {
    console.error("usage: analyze_golden_curve.ts <golden-curve.json | -> [baseline-golden.json]");
    process.exit(1);
  }
  const data = readInput(path);
  const baselinePath = process.argv[3];
  const baseline = baselinePath === undefined ? null : readInput(baselinePath);
  const rows = data.scope?.row_count ?? 0;
  const checkpoints = data.scope?.checkpoint_count ?? 0;
  // Prefer the archive's STORED headline block (exact match to what golden.ts wrote,
  // honoring its --alpha/--score-budgets); only recompute for legacy archives.
  let headline: { score: number; ceiling: number; logAUC: number; alpha: number };
  if (data.headline) {
    headline = {
      score: data.headline.score,
      ceiling: data.headline.ceiling,
      logAUC: data.headline.log_auc,
      alpha: data.headline.alpha,
    };
  } else {
    const allBudgets = data.budgets ?? data.budget_scores!.map((s) => s.budget);
    const h = headlineScore(
      allBudgets.map((b) => ({ budget: b, score: data.budget_scores!.find((s) => s.budget === b)?.score ?? 0 })),
      DEFAULT_ALPHA,
    );
    headline = { score: h.score, ceiling: h.ceiling, logAUC: h.logAUC, alpha: DEFAULT_ALPHA };
  }
  console.log(
    `HEADLINE ${headline.score.toFixed(2)} · ceiling=${headline.ceiling.toFixed(2)} · logAUC=${headline.logAUC.toFixed(2)} ` +
      `(alpha=${headline.alpha}) · rows ${rows} · checkpoints ${checkpoints}`,
  );
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
  printTerminalFeedbackDiagnostics(data);
  printArcPlacementDiagnostics(data);
  printStartDiagnostics(data);
  printCandidateRankDiagnostics(data);
  printAxisDiagnostics(data);
  if (baseline !== null) printComparison(data, baseline);
}

main();
