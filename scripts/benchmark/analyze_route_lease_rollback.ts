/** Paired mechanics and continuation gate for bounded selected-route rollback. */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  assertPairedArms,
  gridCellKey,
  pairGridCells,
  pairedGridOutcomeSummary,
  readGridArm,
  type GridArm,
} from "./paired_grid.ts";

const args = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const candidatePath = required("candidate");
const referencePath = required("reference");
const outPath = argument("out");
const candidate = readGridArm("route-lease-rollback", candidatePath);
const reference = readGridArm("phase-d", referencePath);
const pairingNotes = assertPairedArms(candidate, reference);
const candidateRows = rowsByKey(candidate);
const referenceRows = rowsByKey(reference);
const paired = pairGridCells(candidate, reference);
const outcomes = pairedGridOutcomeSummary(paired.pairs);

let audits = 0;
let crossings = 0;
let admitted = 0;
let executed = 0;
let unavailable = 0;
let reserveSuppressed = 0;
const rollbackRuns = new Set<string>();
const rollbackSources = new Set<string>();
const noRollbackPairs: Array<{ candidate: any; reference: any }> = [];
for (const [key, candidateRow] of candidateRows) {
  const referenceRow = referenceRows.get(key);
  if (referenceRow === undefined) throw new Error(`reference is missing ${printableKey(key)}`);
  const label = printableKey(key);
  const stats = candidateRow.stats?.handoff_selective_backtracking;
  if (
    stats?.policy !== "selective_axis_regret_catchup_value_initial_expire_10" ||
    stats.route_lease_audit_enabled !== true ||
    stats.route_lease_rollback_enabled !== true ||
    stats.route_lease_revalidation_enabled === true ||
    stats.route_lease_renewal_audit_enabled === true ||
    stats.route_lease_revalidation_lineage_reset_enabled === true
  ) throw new Error(`${label}: candidate is not the bounded route-lease rollback arm`);
  const rows = stats.route_lease_audits ?? [];
  const events = stats.events ?? [];
  const executedRows = rows.filter((audit: any) => audit.rollback_disposition === "executed");
  if (
    stats.route_lease_audits_started !== rows.length ||
    stats.route_lease_audits_with_loss_crossing !== rows.filter(
      (audit: any) => audit.first_loss_crossing !== null,
    ).length ||
    stats.route_lease_rollbacks_admitted !== rows.filter(
      (audit: any) => audit.rollback_disposition === "executed" ||
        audit.rollback_disposition === "admitted",
    ).length ||
    stats.route_lease_rollbacks_executed !== executedRows.length ||
    stats.route_lease_rollbacks_incumbent_unavailable !== rows.filter(
      (audit: any) => audit.rollback_disposition === "displaced_incumbent_unavailable",
    ).length ||
    stats.route_lease_rollbacks_terminal_reserve_suppressed !== rows.filter(
      (audit: any) => audit.rollback_disposition === "terminal_reserve",
    ).length
  ) throw new Error(`${label}: route-lease rollback counters do not match their ledger`);
  for (const audit of executedRows) validateExecutedRollback(label, audit, events[audit.event_index]);
  audits += rows.length;
  crossings += stats.route_lease_audits_with_loss_crossing;
  admitted += stats.route_lease_rollbacks_admitted;
  executed += stats.route_lease_rollbacks_executed;
  unavailable += stats.route_lease_rollbacks_incumbent_unavailable;
  reserveSuppressed += stats.route_lease_rollbacks_terminal_reserve_suppressed;
  if (executedRows.length > 0) {
    rollbackRuns.add(key);
    rollbackSources.add(candidateRow.task.sourceId);
  } else {
    assertNoRollbackIdentity(label, candidateRow, referenceRow);
    noRollbackPairs.push({ candidate: candidateRow, reference: referenceRow });
  }
}

const score = summarizeScore(candidate, reference);
const work = {
  candidate: summarizeWork(candidate.archive.runs),
  reference: summarizeWork(reference.archive.runs),
};
const workDelta = subtract(work.candidate, work.reference);
const gate = {
  declared_four_seed_panel: score.seed_blocks.length >= 4,
  all_candidate_cells_valid: [...candidate.cells.values()].every((cell) => cell.valid),
  no_reference_completion_lost: paired.lost.length === 0,
  positive_total_run_score_movement: outcomes.overall_score_sum_delta > 0,
  positive_seed_blocks: score.seed_blocks.filter((row: any) => row.mean_delta > 0).length,
  positive_source_means: score.source_blocks.filter((row: any) => row.mean_delta > 0).length,
  no_cell_loses_20: score.minimum_cell_delta > -20,
  at_least_40_exact_rollbacks: executed >= 40,
  every_admitted_rollback_executed: admitted === executed,
  rollback_spans_all_sources: rollbackSources.size === score.source_blocks.length,
};
const passed = gate.declared_four_seed_panel && gate.all_candidate_cells_valid &&
  gate.no_reference_completion_lost &&
  gate.positive_total_run_score_movement && gate.positive_seed_blocks >= 3 &&
  gate.positive_source_means >= 4 && gate.no_cell_loses_20 &&
  gate.at_least_40_exact_rollbacks && gate.every_admitted_rollback_executed &&
  gate.rollback_spans_all_sources;

const result = {
  schema: "line.route-lease-rollback-analysis.v2",
  generated_at: new Date().toISOString(),
  scope: {
    cells: candidate.cells.size,
    sources: score.source_blocks.length,
    budgets: candidate.archive.budgets,
    seeds: candidate.archive.seeds,
    interpretation:
      "Fresh compact 750k characterization of one frozen rollback rule; never promotion evidence.",
  },
  pairing_notes: pairingNotes,
  contract: {
    trigger:
      "first selected-route whole-prefix loss strictly above the displaced incumbent's last equal-depth loss",
    eligibility:
      "displaced incumbent remains in frontier and conservative work fits with 1.25 reserve",
    disposition:
      "retain crossing route, move displaced incumbent to exact next LIFO turn, one rollback per lease",
  },
  score,
  paired_outcomes: outcomes,
  mechanics: {
    audits,
    crossings,
    admitted,
    executed,
    incumbent_unavailable: unavailable,
    terminal_reserve_suppressed: reserveSuppressed,
    rollback_runs: rollbackRuns.size,
    rollback_sources: rollbackSources.size,
    no_rollback_cells: noRollbackPairs.length,
    no_rollback_track_score_report_work_identity: true,
  },
  work,
  work_delta: workDelta,
  continuation_gate: {
    conditions: gate,
    evaluated: gate.declared_four_seed_panel,
    passed,
    consequence: !gate.declared_four_seed_panel
      ? "Not evaluated: the continuation gate requires the declared four-seed panel."
      : passed
        ? "The frozen arm may enter the standing canonical 750k evaluator; it is not promoted."
        : "Close the frozen arm without canonical or multi-budget evaluation.",
  },
  interpretation_limits: [
    "The rollback signal uses no terminal score, but compact-panel score remains characterization only.",
    "Source blocks describe breadth and must not become source eligibility rules.",
    "Do not tune a loss threshold, reserve factor, or timing rule from this panel.",
  ],
};

console.log(`ROUTE-LEASE ROLLBACK  ${candidate.cells.size} paired cells`);
console.log(
  `score ${signed(score.mean_delta_per_cell, 3)} +/- ` +
    `${format(score.seed_block_standard_error, 3)} SE; ` +
    `${score.better}/${score.worse}/${score.tied} better/worse/tied`,
);
console.log(
  `rollbacks ${executed}/${admitted} executed/admitted; runs ${rollbackRuns.size}; ` +
    `sources ${rollbackSources.size}; first terminal ${signedNullable(
      workDelta.mean_paired_first_terminal_delta,
      0,
    )}`,
);
console.log(
  `gate ${!gate.declared_four_seed_panel ? "NOT EVALUATED" : passed ? "PASS" : "CLOSE"}: ` +
    result.continuation_gate.consequence,
);
if (outPath !== undefined) {
  const absolute = resolve(outPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`analysis ${absolute}`);
}

function validateExecutedRollback(label: string, audit: any, event: any): void {
  const crossing = audit.first_loss_crossing;
  if (
    event?.catchup_outcome !== "alternative_selected" ||
    crossing === null || !(crossing.loss_excess_over_displaced_incumbent > 0) ||
    crossing.displaced_incumbent_available !== true ||
    crossing.displaced_incumbent_affordable_with_reserve !== true ||
    audit.rollback_total_spent_frames !== crossing.total_spent_frames ||
    audit.end_reason !== "displaced_incumbent_resumed" ||
    audit.end_total_spent_frames !== audit.rollback_total_spent_frames ||
    event.resumed_total_spent_frames !== audit.rollback_total_spent_frames
  ) throw new Error(`${label}: rollback did not hand exact next control to its incumbent`);
}

function assertNoRollbackIdentity(label: string, candidateRow: any, referenceRow: any): void {
  for (const [name, left, right] of [
    ["track", candidateRow.trackHash, referenceRow.trackHash],
    ["report", candidateRow.report, referenceRow.report],
    ["score", candidateRow.score, referenceRow.score],
    ["budget telemetry", candidateRow.budgetTelemetry, referenceRow.budgetTelemetry],
  ] as const) {
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      throw new Error(`${label}: no-rollback cell changed ${name}`);
    }
  }
}

function summarizeScore(candidateArm: GridArm, referenceArm: GridArm): any {
  const cells = [...candidateArm.cells.values()].map((cell) => {
    const referenceCell = referenceArm.cells.get(
      gridCellKey(cell.sourceId, cell.budget, cell.seed),
    )!;
    return { source_id: cell.sourceId, seed: cell.seed, delta: cell.score - referenceCell.score };
  });
  const seedBlocks = [...grouped(cells, (cell) => String(cell.seed))]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([seed, rows]) => ({
      seed: Number(seed),
      mean_delta: mean(rows.map((row) => row.delta)),
    }));
  const sourceBlocks = [...grouped(cells, (cell) => cell.source_id)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([source_id, rows]) => ({
      source_id,
      mean_delta: mean(rows.map((row) => row.delta)),
    }));
  return {
    sum_delta: sum(cells.map((cell) => cell.delta)),
    mean_delta_per_cell: mean(cells.map((cell) => cell.delta)),
    seed_block_standard_error: standardError(seedBlocks.map((row) => row.mean_delta)),
    minimum_cell_delta: Math.min(...cells.map((cell) => cell.delta)),
    better: cells.filter((cell) => cell.delta > 0).length,
    worse: cells.filter((cell) => cell.delta < 0).length,
    tied: cells.filter((cell) => cell.delta === 0).length,
    seed_blocks: seedBlocks,
    source_blocks: sourceBlocks,
    worst_cells: [...cells].sort((a, b) => a.delta - b.delta).slice(0, 5),
  };
}

function summarizeWork(rows: any[]): any {
  const first = rows.map((row) => ({
    source_id: row.task.sourceId,
    budget: row.task.budget,
    seed: row.task.actualSeed,
    total_spent_frames:
      row.budgetTelemetry?.compile?.first_terminal_total_spent_frames ?? null,
  })).sort((left, right) =>
    gridCellKey(left.source_id, left.budget, left.seed).localeCompare(
      gridCellKey(right.source_id, right.budget, right.seed),
    )
  );
  const repair = rows.flatMap((row) => row.budgetTelemetry?.episodes ?? [])
    .filter((episode: any) => episode.lane === "repair");
  return {
    first_terminal_by_cell: first,
    initial_frames: sum(rows.flatMap((row) => row.budgetTelemetry?.execution_intervals ?? [])
      .filter((interval: any) => interval.kind === "initial_search")
      .map((interval: any) => interval.spent_frames)),
    repair_frames: sum(repair.map((episode: any) => episode.outcome?.spent_frames ?? 0)),
    repair_attempts: repair.length,
    repair_terminal_reached: repair.filter((episode: any) =>
      episode.outcome?.terminal_reached === true
    ).length,
    repair_accepted: repair.filter((episode: any) =>
      episode.outcome?.accepted_alternative === true
    ).length,
  };
}

function subtract(candidateWork: any, referenceWork: any): any {
  const referenceFirst = new Map<string, number | null>(
    referenceWork.first_terminal_by_cell.map((row: any) => [
      gridCellKey(row.source_id, row.budget, row.seed),
      row.total_spent_frames,
    ] as [string, number | null]),
  );
  const pairedFirst = candidateWork.first_terminal_by_cell.flatMap((row: any) => {
    const referenceValue = referenceFirst.get(gridCellKey(row.source_id, row.budget, row.seed));
    return row.total_spent_frames === null || referenceValue === null ||
        referenceValue === undefined
      ? []
      : [row.total_spent_frames - referenceValue];
  });
  return {
    mean_paired_first_terminal_delta: pairedFirst.length === 0 ? null : mean(pairedFirst),
    comparable_first_terminal_cells: pairedFirst.length,
    initial_frames: candidateWork.initial_frames - referenceWork.initial_frames,
    repair_frames: candidateWork.repair_frames - referenceWork.repair_frames,
    repair_attempts: candidateWork.repair_attempts - referenceWork.repair_attempts,
    repair_terminal_reached:
      candidateWork.repair_terminal_reached - referenceWork.repair_terminal_reached,
    repair_accepted: candidateWork.repair_accepted - referenceWork.repair_accepted,
  };
}

function rowsByKey(arm: GridArm): Map<string, any> {
  return new Map(arm.archive.runs.map((row: any) => [
    gridCellKey(row.task.sourceId, row.task.budget, row.task.actualSeed),
    row,
  ]));
}
function grouped<T>(values: T[], keyOf: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) result.set(keyOf(value), [...(result.get(keyOf(value)) ?? []), value]);
  return result;
}
function sum(values: number[]): number { return values.reduce((a, b) => a + b, 0); }
function mean(values: number[]): number { return values.length === 0 ? 0 : sum(values) / values.length; }
function standardError(values: number[]): number | null {
  if (values.length < 2) return null;
  const center = mean(values);
  return Math.sqrt(sum(values.map((value) => (value - center) ** 2)) /
    (values.length - 1) / values.length);
}
function required(name: string): string {
  const value = argument(name);
  if (value === undefined || value.length === 0) {
    throw new Error("usage: --candidate=ARCHIVE --reference=ARCHIVE [--out=JSON]");
  }
  return value;
}
function printableKey(key: string): string { return key.replaceAll("\0", "/"); }
function signed(value: number, digits: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}
function signedNullable(value: number | null, digits: number): string {
  return value === null ? "n/a" : signed(value, digits);
}
function format(value: number | null, digits: number): string {
  return value === null ? "n/a" : value.toFixed(digits);
}
