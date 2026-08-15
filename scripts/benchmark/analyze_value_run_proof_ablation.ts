/**
 * Direct same-cell ablation of the first-tournament run-proof gate against its
 * otherwise identical startup-expiring parent policy.
 *
 * The broad screen compares the whole value policy with production and cannot
 * attribute its aggregate score to the proof gate. This analyzer restricts
 * attribution to cells where the gate actually sealed and proves that all
 * overlapping unsealed cells are output-identical to the parent.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gridCellKey, readGridArm } from "./paired_grid.ts";

const args = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const candidatePath = required("candidate");
const parentPath = required("parent");
const outPath = argument("out");

const candidate = readGridArm("run-proof", candidatePath);
const parent = readGridArm("parent", parentPath);
const candidateRows = rowsByKey(candidate.archive.runs);
const parentRows = rowsByKey(parent.archive.runs);
const candidateCells = candidate.cells;
const parentCells = parent.cells;
const commonKeys = [...candidateCells.keys()].filter((key) => parentCells.has(key)).sort();
if (commonKeys.length === 0) throw new Error("run-proof ablation has no common cells");

const affected: any[] = [];
const unaffected: any[] = [];
for (const key of commonKeys) {
  const candidateRow = candidateRows.get(key)!;
  const parentRow = parentRows.get(key)!;
  const candidateCell = candidateCells.get(key)!;
  const parentCell = parentCells.get(key)!;
  const candidateStats = selectiveStats(candidateRow);
  const parentStats = selectiveStats(parentRow);
  if (
    candidateStats.policy !==
      "selective_axis_regret_catchup_value_initial_expire_10_run_proof"
  ) throw new Error(`${key}: unexpected candidate policy ${candidateStats.policy}`);
  if (parentStats.policy !== "selective_axis_regret_catchup_value_initial_expire_10") {
    throw new Error(`${key}: unexpected parent policy ${parentStats.policy}`);
  }
  const sealed = candidateStats.value_live_run_proof_state ===
    "sealed_after_failed_first_tournament";
  if (!sealed) {
    if (
      candidateCell.trackHash !== parentCell.trackHash ||
      candidateCell.score !== parentCell.score ||
      candidateCell.valid !== parentCell.valid ||
      candidateCell.firstCompletionFrame !== parentCell.firstCompletionFrame
    ) throw new Error(`${key}: unsealed common cell changed relative to its parent`);
    unaffected.push({ key, source_id: candidateCell.sourceId, budget: candidateCell.budget,
      seed: candidateCell.seed });
    continue;
  }

  const candidateEvents = valueEvents(candidateStats);
  const parentEvents = valueEvents(parentStats);
  if (candidateEvents.length !== 1 || parentEvents.length < 2) {
    throw new Error(`${key}: sealed cell lacks the expected parent continuation`);
  }
  if (JSON.stringify(candidateEvents[0]) !== JSON.stringify(parentEvents[0])) {
    throw new Error(`${key}: proof and parent do not share an identical first tournament`);
  }
  if (parentEvents[0].catchup_probe_results.some(
    (probe: any) => probe.outcome === "reached_target"
  )) throw new Error(`${key}: gate sealed after a reached first target`);
  const sealedOpportunities = candidateStats.value_live_run_proof_sealed_opportunities;
  const ledgerSealed = candidateStats.value_live_opportunities.filter(
    (opportunity: any) => opportunity.outcome === "run_proof_sealed",
  ).length;
  if (sealedOpportunities !== ledgerSealed || sealedOpportunities < 1) {
    throw new Error(`${key}: sealed-opportunity ledger mismatch`);
  }

  const laterParentEvents = parentEvents.slice(1);
  const candidateRepair = repair(candidateRow);
  const parentRepair = repair(parentRow);
  affected.push({
    key,
    source_id: candidateCell.sourceId,
    budget: candidateCell.budget,
    seed: candidateCell.seed,
    candidate_score: candidateCell.score,
    parent_score: parentCell.score,
    score_delta: candidateCell.score - parentCell.score,
    candidate_valid: candidateCell.valid,
    parent_valid: parentCell.valid,
    sealed_opportunities: sealedOpportunities,
    parent_later_tournaments: laterParentEvents.length,
    parent_later_reached_target: laterParentEvents.filter((event: any) =>
      event.catchup_probe_results.some((probe: any) => probe.outcome === "reached_target")
    ).length,
    parent_later_alternative_selected: laterParentEvents.filter(
      (event: any) => event.catchup_outcome === "alternative_selected",
    ).length,
    parent_later_current_selected: laterParentEvents.filter(
      (event: any) => event.catchup_outcome === "current_selected",
    ).length,
    parent_later_probe_dead_ends: laterParentEvents.filter(
      (event: any) => event.catchup_outcome === "probe_dead_end",
    ).length,
    optional_probe_frames_saved:
      parentStats.value_live_probe_frames - candidateStats.value_live_probe_frames,
    first_completion_delta_frames:
      nullableDelta(candidateCell.firstCompletionFrame, parentCell.firstCompletionFrame),
    repair_frames_delta: candidateRepair.frames - parentRepair.frames,
    repair_attempts_delta: candidateRepair.attempts - parentRepair.attempts,
    repair_accepted_delta: candidateRepair.accepted - parentRepair.accepted,
  });
}

const budgets = [...new Set(affected.map((row) => row.budget))].sort((a, b) => a - b);
const byBudget = Object.fromEntries(budgets.map((budget) => {
  const rows = affected.filter((row) => row.budget === budget);
  return [String(budget), summarize(rows)];
}));
const result = {
  schema: "line.value-run-proof-ablation.v1",
  generated_at: new Date().toISOString(),
  scope: {
    candidate_cells: candidateCells.size,
    parent_cells: parentCells.size,
    common_cells: commonKeys.length,
    affected_cells: affected.length,
    unaffected_common_cells: unaffected.length,
    candidate_only_cells: candidateCells.size - commonKeys.length,
    parent_only_cells: parentCells.size - commonKeys.length,
    interpretation:
      "Direct proof-gate attribution on common cells; diagnostic only and unable to reopen the closed screen.",
  },
  invariants: {
    identical_first_tournament_in_every_affected_cell: true,
    all_unaffected_common_cells_output_identical: true,
    affected_cells_all_candidate_valid: affected.every((row) => row.candidate_valid),
    affected_cells_all_parent_valid: affected.every((row) => row.parent_valid),
  },
  by_budget: byBudget,
  aggregate: summarize(affected),
  affected_cells: affected,
  unaffected_common_cells: unaffected,
};

console.log(`VALUE RUN-PROOF DIRECT ABLATION  ${affected.length} affected cells`);
for (const budget of budgets) {
  const row = byBudget[String(budget)] as any;
  console.log(
    `${budget / 1000}k ${signed(row.mean_score_delta, 4)}/cell; ` +
      `${row.parent_later_reached_target}/${row.parent_later_tournaments} later parent ` +
      `tournaments reached target; ${row.optional_probe_frames_saved} probe frames saved; ` +
      `repair ${signed(row.repair_frames_delta, 0)} frames`,
  );
}
console.log(
  `aggregate ${signed(result.aggregate.mean_score_delta, 4)}/cell; ` +
    `${result.aggregate.parent_later_reached_target}/` +
    `${result.aggregate.parent_later_tournaments} later parent tournaments reached target`,
);
if (outPath !== undefined) {
  const absolute = resolve(outPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`analysis ${absolute}`);
}

function required(name: string): string {
  const value = argument(name);
  if (value === undefined || value === "") {
    throw new Error("usage: --candidate=<archive> --parent=<archive> [--out=<json>]");
  }
  return value;
}

function rowsByKey(rows: any[]): Map<string, any> {
  return new Map(rows.map((row) => [
    gridCellKey(row.task.sourceId, row.task.budget, row.task.actualSeed),
    row,
  ]));
}

function selectiveStats(row: any): any {
  const stats = row.stats?.handoff_selective_backtracking;
  if (stats === undefined) throw new Error("archive row lacks selective telemetry");
  return stats;
}

function valueEvents(stats: any): any[] {
  return (stats.events ?? []).filter(
    (event: any) => event.trigger_signal === "value_exploration",
  );
}

function repair(row: any): { attempts: number; accepted: number; frames: number } {
  const episodes = (row.budgetTelemetry?.episodes ?? []).filter(
    (episode: any) => episode.lane === "repair",
  );
  return {
    attempts: episodes.length,
    accepted: episodes.filter((episode: any) => episode.outcome.accepted_alternative).length,
    frames: sum(episodes.map((episode: any) => episode.outcome.spent_frames ?? 0)),
  };
}

function nullableDelta(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : left - right;
}

function summarize(rows: any[]): any {
  return {
    cells: rows.length,
    score_delta: sum(rows.map((row) => row.score_delta)),
    mean_score_delta: rows.length === 0 ? 0 : mean(rows.map((row) => row.score_delta)),
    improved: rows.filter((row) => row.score_delta > 0).length,
    regressed: rows.filter((row) => row.score_delta < 0).length,
    tied: rows.filter((row) => row.score_delta === 0).length,
    sealed_opportunities: sum(rows.map((row) => row.sealed_opportunities)),
    parent_later_tournaments: sum(rows.map((row) => row.parent_later_tournaments)),
    parent_later_reached_target: sum(rows.map((row) => row.parent_later_reached_target)),
    parent_later_alternative_selected: sum(
      rows.map((row) => row.parent_later_alternative_selected),
    ),
    parent_later_current_selected: sum(rows.map((row) => row.parent_later_current_selected)),
    parent_later_probe_dead_ends: sum(rows.map((row) => row.parent_later_probe_dead_ends)),
    optional_probe_frames_saved: sum(rows.map((row) => row.optional_probe_frames_saved)),
    first_completion_delta_frames: sum(
      rows.flatMap((row) => row.first_completion_delta_frames === null
        ? []
        : [row.first_completion_delta_frames]),
    ),
    repair_frames_delta: sum(rows.map((row) => row.repair_frames_delta)),
    repair_attempts_delta: sum(rows.map((row) => row.repair_attempts_delta)),
    repair_accepted_delta: sum(rows.map((row) => row.repair_accepted_delta)),
  };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: number[]): number {
  return sum(values) / values.length;
}

function signed(value: number, digits: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}
