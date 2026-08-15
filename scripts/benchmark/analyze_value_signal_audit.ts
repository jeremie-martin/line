/**
 * Behavior-neutral audit of the accepted selective-value trigger numerator.
 *
 * This script deliberately studies local tournament labels, not final score.
 * It first proves that adding the evidence did not change compilation, then
 * asks whether exact branch/suffix quantities rank target reach and strict
 * runner-up selection better than the production cumulative-RMS density.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { AXIS_QUALITY_TOLERANCE } from "../v0/score.ts";
import {
  assertPairedArms,
  gridCellKey,
  readGridArm,
  type GridArm,
} from "./paired_grid.ts";

const POLICY = "selective_axis_regret_catchup_value_initial_expire_10";
const FRAME_SCALE = 10_000;
const args = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const candidatePath = required("candidate");
const referencePath = required("reference");
const outPath = argument("out");

const candidate = readGridArm("instrumented", candidatePath);
const reference = readGridArm("behavior-reference", referencePath);
const pairingNotes = assertPairedArms(candidate, reference);
const candidateRows = rowsByKey(candidate);
const referenceRows = rowsByKey(reference);

type Observation = {
  id: string;
  run: string;
  source: string;
  seed: number;
  watchId: number;
  targetReached: boolean;
  alternativeSelected: boolean;
  probeFrames: number;
  estimatedFrames: number;
  baselineLoss: number;
  cumulativeDelta: number;
  currentDensity: number;
  branchPreferredLoss: number;
  branchAlternativeLoss: number;
  branchAlternativeGain: number;
  suffixAxisCount: number;
  suffixAxisSse: number;
  suffixLoss: number;
  suffixExcess: number;
  suffixLossDensity: number;
  suffixExcessDensity: number;
  branchGainDensity: number;
};

const observations: Observation[] = [];
const identity = {
  cells: candidate.cells.size,
  exact_tracks: 0,
  exact_scores: 0,
  exact_validity: 0,
  exact_first_terminal_work: 0,
  exact_budget_and_repair_telemetry: 0,
};

for (const cell of [...candidate.cells.values()].sort((a, b) =>
  gridCellKey(a.sourceId, a.budget, a.seed).localeCompare(
    gridCellKey(b.sourceId, b.budget, b.seed),
  )
)) {
  const key = gridCellKey(cell.sourceId, cell.budget, cell.seed);
  const referenceCell = reference.cells.get(key);
  const row = candidateRows.get(key);
  const referenceRow = referenceRows.get(key);
  if (referenceCell === undefined || row === undefined || referenceRow === undefined) {
    throw new Error(`paired row missing for ${printableKey(key)}`);
  }
  const label = `${cell.sourceId}/${cell.budget}/${cell.seed}`;
  if (cell.trackHash !== referenceCell.trackHash) {
    throw new Error(`${label}: behavior-neutral audit changed the track`);
  }
  identity.exact_tracks++;
  if (JSON.stringify(row.score) !== JSON.stringify(referenceRow.score)) {
    throw new Error(`${label}: behavior-neutral audit changed the score record`);
  }
  identity.exact_scores++;
  if (cell.valid !== referenceCell.valid || row.status !== referenceRow.status) {
    throw new Error(`${label}: behavior-neutral audit changed validity/status`);
  }
  identity.exact_validity++;
  if (cell.firstCompletionFrame !== referenceCell.firstCompletionFrame) {
    throw new Error(`${label}: behavior-neutral audit changed first-terminal work`);
  }
  identity.exact_first_terminal_work++;
  if (JSON.stringify(row.budgetTelemetry) !== JSON.stringify(referenceRow.budgetTelemetry)) {
    throw new Error(`${label}: behavior-neutral audit changed budget/repair telemetry`);
  }
  identity.exact_budget_and_repair_telemetry++;

  const stats = row.stats?.handoff_selective_backtracking;
  if (stats?.policy !== POLICY) throw new Error(`${label}: unexpected policy ${stats?.policy}`);
  const opportunities = stats.value_live_opportunities ?? [];
  const admitted = new Map<number, any>();
  for (const opportunity of opportunities) {
    if (opportunity.outcome !== "admitted") continue;
    if (admitted.has(opportunity.watch_id)) {
      throw new Error(`${label}: duplicate admitted watch ${opportunity.watch_id}`);
    }
    admitted.set(opportunity.watch_id, opportunity);
  }
  const events = (stats.events ?? []).filter(
    (event: any) => event.trigger_signal === "value_exploration",
  );
  if (events.length !== admitted.size || events.length !== stats.value_live_admitted) {
    throw new Error(`${label}: admitted opportunity/event ledger mismatch`);
  }
  for (const event of events) {
    const opportunity = admitted.get(event.watch_id);
    if (opportunity === undefined) {
      throw new Error(`${label}: value event ${event.watch_id} lacks its opportunity`);
    }
    const point = opportunity.point;
    const preferred = finite(point.branch_preferred_axis_loss, `${label}: preferred loss`);
    const alternative = finite(
      point.branch_alternative_axis_loss,
      `${label}: alternative loss`,
    );
    const branchGain = finite(
      point.branch_alternative_axis_loss_gain,
      `${label}: branch gain`,
    );
    close(branchGain, preferred - alternative, `${label}: branch gain arithmetic`);
    const axisCount = point.current_divergent_suffix_axis_count;
    if (!Number.isSafeInteger(axisCount) || axisCount <= 0) {
      throw new Error(`${label}: suffix axis count must be positive and integral`);
    }
    const axisSse = finite(
      point.current_divergent_suffix_axis_sse,
      `${label}: suffix SSE`,
    );
    const suffixLoss = finite(
      point.current_divergent_suffix_axis_loss,
      `${label}: suffix loss`,
    );
    if (axisSse < 0 || suffixLoss < 0) throw new Error(`${label}: negative suffix evidence`);
    close(
      suffixLoss,
      Math.sqrt(axisSse / axisCount) / AXIS_QUALITY_TOLERANCE,
      `${label}: suffix loss/SSE/count relation`,
    );
    for (const field of [
      "branch_preferred_axis_loss",
      "branch_alternative_axis_loss",
      "branch_alternative_axis_loss_gain",
      "current_divergent_suffix_axis_count",
      "current_divergent_suffix_axis_sse",
      "current_divergent_suffix_axis_loss",
    ]) {
      if (event[field] !== point[field]) {
        throw new Error(`${label}: event/opportunity ${field} mismatch`);
      }
    }
    const estimatedFrames = finite(
      event.value_budget?.estimated_probe_work_frames,
      `${label}: estimated probe frames`,
    );
    if (!(estimatedFrames > 0)) throw new Error(`${label}: nonpositive estimated frames`);
    const cumulativeDelta = finite(point.axis_loss_delta, `${label}: cumulative delta`);
    const currentDensity = finite(
      point.value_density_per_10k_estimated_frames,
      `${label}: production density`,
    );
    close(
      currentDensity,
      cumulativeDelta * FRAME_SCALE / estimatedFrames,
      `${label}: production density arithmetic`,
    );
    const baselineLoss = finite(point.baseline_axis_loss, `${label}: baseline loss`);
    const suffixExcess = suffixLoss - baselineLoss;
    const probes = event.catchup_probe_results ?? [];
    const targetReached = probes.some((probe: any) => probe.outcome === "reached_target");
    const alternativeSelected = event.catchup_outcome === "alternative_selected";
    if (alternativeSelected && !targetReached) {
      throw new Error(`${label}: selected alternative never reached the comparison horizon`);
    }
    const run = `${cell.sourceId}/${cell.seed}`;
    observations.push({
      id: `${run}/${event.watch_id}`,
      run,
      source: cell.sourceId,
      seed: cell.seed,
      watchId: event.watch_id,
      targetReached,
      alternativeSelected,
      probeFrames: finite(event.catchup_probe_frames, `${label}: probe frames`),
      estimatedFrames,
      baselineLoss,
      cumulativeDelta,
      currentDensity,
      branchPreferredLoss: preferred,
      branchAlternativeLoss: alternative,
      branchAlternativeGain: branchGain,
      suffixAxisCount: axisCount,
      suffixAxisSse: axisSse,
      suffixLoss,
      suffixExcess,
      suffixLossDensity: suffixLoss * FRAME_SCALE / estimatedFrames,
      suffixExcessDensity: suffixExcess * FRAME_SCALE / estimatedFrames,
      branchGainDensity: branchGain * FRAME_SCALE / estimatedFrames,
    });
  }
}

if (observations.length === 0) throw new Error("audit contains no admitted value tournaments");

const signals = [
  signal("production_cumulative_rms_density", (row) => row.currentDensity),
  signal("divergent_suffix_loss_density", (row) => row.suffixLossDensity),
  signal("divergent_suffix_excess_density", (row) => row.suffixExcessDensity),
  signal("runner_up_first_child_advantage", (row) => row.branchAlternativeGain),
  signal("runner_up_first_child_advantage_density", (row) => row.branchGainDensity),
];

const zeroThresholds = [
  zeroThreshold(
    "runner_up_first_child_better",
    (row) => row.branchAlternativeGain > 0,
  ),
  zeroThreshold(
    "divergent_suffix_worse_than_inherited_prefix",
    (row) => row.suffixExcess > 0,
  ),
];

const licensed = zeroThresholds.filter((entry) =>
  entry.broad && entry.strictly_improves_both_labels_at_equal_action_count
);
const result = {
  schema: "line.value-trigger-signal-audit.v1",
  generated_at: new Date().toISOString(),
  scope: {
    cells: candidate.cells.size,
    budgets: candidate.archive.budgets,
    seeds: candidate.archive.seeds,
    sources: [...new Set(observations.map((row) => row.source))].sort(),
    tournaments: observations.length,
    runs_with_tournaments: new Set(observations.map((row) => row.run)).size,
    warning:
      "Tournament events inside a deterministic run are clustered, not independent samples. Global AUC is descriptive; within-run and within-source AUC expose that structure.",
  },
  behavior_identity: {
    ...identity,
    passed: Object.entries(identity)
      .filter(([key]) => key !== "cells")
      .every(([, value]) => value === identity.cells),
    pairing_notes: pairingNotes,
  },
  label_base_rates: labelSummary(observations),
  direct_observations: {
    branch_advantage_sign: partitionBy(observations, (row) =>
      row.branchAlternativeGain > 0 ? "positive" : row.branchAlternativeGain < 0 ? "negative" : "zero"
    ),
    suffix_excess_sign: partitionBy(observations, (row) =>
      row.suffixExcess > 0 ? "positive" : row.suffixExcess < 0 ? "negative" : "zero"
    ),
    probe_estimation: {
      actual_frames: sum(observations.map((row) => row.probeFrames)),
      estimated_frames: sum(observations.map((row) => row.estimatedFrames)),
      actual_to_estimated_ratio:
        sum(observations.map((row) => row.probeFrames)) /
        sum(observations.map((row) => row.estimatedFrames)),
    },
  },
  statistical_associations: {
    signals,
    interpretation:
      "Higher-score AUC/precision associations concern local feasibility and equal-horizon selection only. They do not establish final-score causality.",
  },
  predeclared_zero_threshold_gate: {
    candidates: zeroThresholds,
    licensed_successors: licensed.map((entry) => entry.name),
    passed: licensed.length > 0,
    consequence: licensed.length > 0
      ? "At least one broad semantic zero-threshold rule may receive a fresh 750k live panel; it is not promoted."
      : "No semantic zero-threshold rewrite is licensed. Close this trigger rewrite without a live or canonical run.",
  },
};

printResult(result);
if (outPath !== undefined) {
  const absolute = resolve(outPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`analysis ${absolute}`);
}

function required(name: string): string {
  const value = argument(name);
  if (value === undefined || value === "") {
    throw new Error(
      "usage: --candidate=<instrumented.json[.gz]> --reference=<old.json[.gz]> [--out=<json>]",
    );
  }
  return value;
}

function rowsByKey(arm: GridArm): Map<string, any> {
  return new Map(arm.archive.runs.map((row: any) => [
    gridCellKey(row.task.sourceId, row.task.budget, row.task.actualSeed),
    row,
  ]));
}

function signal(name: string, value: (row: Observation) => number): any {
  const ranked = [...observations].sort((a, b) => value(b) - value(a) || a.id.localeCompare(b.id));
  const topCount = Math.ceil(ranked.length / 4);
  const top = ranked.slice(0, topCount);
  return {
    name,
    direction: "higher predicts positive label",
    target_reach_auc: auc(observations, value, (row) => row.targetReached),
    alternative_selected_auc: auc(
      observations,
      value,
      (row) => row.alternativeSelected,
    ),
    within_run_target_reach_auc: blockedAuc(
      observations,
      (row) => row.run,
      value,
      (row) => row.targetReached,
    ),
    within_run_alternative_selected_auc: blockedAuc(
      observations,
      (row) => row.run,
      value,
      (row) => row.alternativeSelected,
    ),
    within_source_target_reach_auc: blockedAuc(
      observations,
      (row) => row.source,
      value,
      (row) => row.targetReached,
    ),
    within_source_alternative_selected_auc: blockedAuc(
      observations,
      (row) => row.source,
      value,
      (row) => row.alternativeSelected,
    ),
    top_quartile: labelSummary(top),
    rank_quartiles_high_to_low: [0, 1, 2, 3].map((quartile) =>
      labelSummary(ranked.slice(
        Math.floor(quartile * ranked.length / 4),
        Math.floor((quartile + 1) * ranked.length / 4),
      ))
    ),
  };
}

function zeroThreshold(
  name: string,
  predicate: (row: Observation) => boolean,
): any {
  const selected = observations.filter(predicate);
  const currentComparator = [...observations]
    .sort((a, b) => b.currentDensity - a.currentDensity || a.id.localeCompare(b.id))
    .slice(0, selected.length);
  const selectedSummary = labelSummary(selected);
  const comparatorSummary = labelSummary(currentComparator);
  const runs = new Set(selected.map((row) => row.run)).size;
  const sources = new Set(selected.map((row) => row.source)).size;
  const broad = selected.length >= Math.ceil(observations.length / 4) &&
    runs >= 8 && sources >= 4;
  return {
    name,
    threshold: 0,
    selected: selectedSummary,
    current_density_top_n_comparator: comparatorSummary,
    runs,
    sources,
    broad,
    strictly_improves_target_reach:
      selectedSummary.target_reach_rate > comparatorSummary.target_reach_rate,
    strictly_improves_alternative_selection:
      selectedSummary.alternative_selected_rate >
        comparatorSummary.alternative_selected_rate,
    strictly_improves_both_labels_at_equal_action_count:
      selectedSummary.target_reach_rate > comparatorSummary.target_reach_rate &&
      selectedSummary.alternative_selected_rate >
        comparatorSummary.alternative_selected_rate,
  };
}

function labelSummary(rows: Observation[]): any {
  const target = rows.filter((row) => row.targetReached).length;
  const alternative = rows.filter((row) => row.alternativeSelected).length;
  return {
    actions: rows.length,
    target_reaches: target,
    target_reach_rate: rows.length === 0 ? null : target / rows.length,
    alternatives_selected: alternative,
    alternative_selected_rate: rows.length === 0 ? null : alternative / rows.length,
  };
}

function partitionBy(
  rows: Observation[],
  keyOf: (row: Observation) => string,
): Record<string, any> {
  const groups = new Map<string, Observation[]>();
  for (const row of rows) groups.set(keyOf(row), [...(groups.get(keyOf(row)) ?? []), row]);
  return Object.fromEntries([...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => [key, labelSummary(values)]));
}

function auc(
  rows: Observation[],
  value: (row: Observation) => number,
  positive: (row: Observation) => boolean,
): number | null {
  const positives = rows.filter(positive);
  const negatives = rows.filter((row) => !positive(row));
  if (positives.length === 0 || negatives.length === 0) return null;
  let wins = 0;
  for (const yes of positives) {
    for (const no of negatives) {
      const delta = value(yes) - value(no);
      wins += delta > 0 ? 1 : delta === 0 ? 0.5 : 0;
    }
  }
  return wins / (positives.length * negatives.length);
}

function blockedAuc(
  rows: Observation[],
  blockOf: (row: Observation) => string,
  value: (row: Observation) => number,
  positive: (row: Observation) => boolean,
): any {
  const blocks = new Map<string, Observation[]>();
  for (const row of rows) blocks.set(blockOf(row), [...(blocks.get(blockOf(row)) ?? []), row]);
  const values = [...blocks.values()]
    .map((block) => auc(block, value, positive))
    .filter((entry): entry is number => entry !== null);
  return { contributing_blocks: values.length, mean_auc: meanOrNull(values) };
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }
  return value;
}

function close(actual: number, expected: number, label: string): void {
  const tolerance = 1e-12 * Math.max(1, Math.abs(actual), Math.abs(expected));
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: ${actual} != ${expected}`);
  }
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function meanOrNull(values: number[]): number | null {
  return values.length === 0 ? null : sum(values) / values.length;
}

function printableKey(key: string): string {
  return key.replaceAll("\0", "/");
}

function printResult(value: any): void {
  console.log(`VALUE TRIGGER SIGNAL AUDIT  ${value.scope.tournaments} tournaments`);
  console.log(
    `identity ${value.behavior_identity.passed ? "PASS" : "FAIL"}; ` +
      `target ${formatRate(value.label_base_rates.target_reach_rate)}; ` +
      `alternative ${formatRate(value.label_base_rates.alternative_selected_rate)}`,
  );
  for (const row of value.statistical_associations.signals) {
    console.log(
      `${row.name}: AUC target ${format(row.target_reach_auc)} / alt ` +
        `${format(row.alternative_selected_auc)}; top-q ` +
        `${formatRate(row.top_quartile.target_reach_rate)} / ` +
        `${formatRate(row.top_quartile.alternative_selected_rate)}`,
    );
  }
  console.log(
    `gate ${value.predeclared_zero_threshold_gate.passed ? "PASS" : "CLOSE"}: ` +
      value.predeclared_zero_threshold_gate.consequence,
  );
}

function format(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(3);
}

function formatRate(value: number | null): string {
  return value === null ? "n/a" : `${(100 * value).toFixed(1)}%`;
}
