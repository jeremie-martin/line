/** Paired mechanics and continuation gate for same-horizon route revalidation. */

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
const candidate = readGridArm("route-lease-revalidation", candidatePath);
const reference = readGridArm("phase-d", referencePath);
const pairingNotes = assertPairedArms(candidate, reference);
const candidateRows = rowsByKey(candidate);
const referenceRows = rowsByKey(reference);
const paired = pairGridCells(candidate, reference);
const outcomes = pairedGridOutcomeSummary(paired.pairs);

let audits = 0;
let crossings = 0;
let eligible = 0;
let admitted = 0;
let started = 0;
let unavailable = 0;
let reserveSuppressed = 0;
let allowanceSuppressed = 0;
let targetReached = 0;
let currentSelected = 0;
let incumbentSelected = 0;
let deadEnds = 0;
let deferred = 0;
let budgetYields = 0;
let ceilingStops = 0;
let probeNodes = 0;
let probeFrames = 0;
let lineageResetMode: boolean | null = null;
let lineageResets = 0;
let selectedWatchLinksCleared = 0;
let displacedWatchLinksCleared = 0;
let uniqueWatchIdsCleared = 0;
const actionRuns = new Set<string>();
const actionSources = new Set<string>();
const noActionPairs: Array<{ candidate: any; reference: any }> = [];

for (const [key, candidateRow] of candidateRows) {
  const referenceRow = referenceRows.get(key);
  if (referenceRow === undefined) throw new Error(`reference is missing ${printableKey(key)}`);
  const label = printableKey(key);
  const stats = candidateRow.stats?.handoff_selective_backtracking;
  const rowLineageResetMode = stats?.route_lease_revalidation_lineage_reset_enabled === true;
  if (lineageResetMode === null) lineageResetMode = rowLineageResetMode;
  if (lineageResetMode !== rowLineageResetMode) {
    throw new Error("candidate mixes one-shot and lineage-reset revalidation modes");
  }
  if (
    stats?.policy !== "selective_axis_regret_catchup_value_initial_expire_10" ||
    stats.route_lease_audit_enabled !== true ||
    stats.route_lease_rollback_enabled !== false ||
    stats.route_lease_revalidation_enabled !== true ||
    stats.route_lease_renewal_audit_enabled === true
  ) throw new Error(`${label}: candidate is not the same-horizon revalidation arm`);
  const rows = stats.route_lease_audits ?? [];
  const actions = rows.filter((audit: any) => audit.revalidation !== null);
  const events = stats.events ?? [];
  for (const audit of actions) {
    validateAction(label, audit, events[audit.event_index]);
    validateLineageReset(label, audit, rowLineageResetMode);
  }
  const count = (disposition: string): number =>
    rows.filter((audit: any) => audit.revalidation_disposition === disposition).length;
  const outcomesInRows = (outcome: string): number =>
    actions.filter((audit: any) => audit.revalidation.outcome === outcome).length;
  const rowTargetReached = outcomesInRows("current_selected") +
    outcomesInRows("incumbent_selected");
  const rowProbeNodes = sum(actions.map((audit: any) =>
    audit.revalidation.probe_nodes_processed
  ));
  const rowProbeFrames = sum(actions.map((audit: any) => audit.revalidation.probe_frames));
  if (
    stats.route_lease_audits_started !== rows.length ||
    stats.route_lease_audits_with_loss_crossing !== rows.filter(
      (audit: any) => audit.first_loss_crossing !== null,
    ).length ||
    stats.route_lease_revalidations_eligible !==
      count("started") + count("probe_allowance") ||
    stats.route_lease_revalidations_admitted !== actions.length ||
    stats.route_lease_revalidations_started !== actions.length ||
    stats.route_lease_revalidations_incumbent_unavailable !==
      count("displaced_incumbent_unavailable") ||
    stats.route_lease_revalidations_terminal_reserve_suppressed !==
      count("terminal_reserve") ||
    stats.route_lease_revalidations_probe_allowance_suppressed !==
      count("probe_allowance") ||
    stats.route_lease_revalidations_target_reached !== rowTargetReached ||
    stats.route_lease_revalidations_current_selected !== outcomesInRows("current_selected") ||
    stats.route_lease_revalidations_incumbent_selected !==
      outcomesInRows("incumbent_selected") ||
    stats.route_lease_revalidations_probe_dead_ends !== outcomesInRows("probe_dead_end") ||
    stats.route_lease_revalidations_probe_deferred !== outcomesInRows("probe_deferred") ||
    stats.route_lease_revalidations_probe_budget_yields !==
      outcomesInRows("probe_budget_yield") ||
    stats.route_lease_revalidations_execution_ceiling_stops !==
      outcomesInRows("execution_ceiling") ||
    stats.route_lease_revalidation_probe_nodes_processed !== rowProbeNodes ||
    stats.route_lease_revalidation_probe_frames !== rowProbeFrames
  ) throw new Error(`${label}: route-revalidation counters do not match their ledger`);
  const rowLineageResets = actions.filter((audit: any) => audit.lineage_reset != null).length;
  const rowSelectedLinks = sum(actions.map((audit: any) =>
    audit.lineage_reset?.selected_watch_links_cleared ?? 0
  ));
  const rowDisplacedLinks = sum(actions.map((audit: any) =>
    audit.lineage_reset?.displaced_watch_links_cleared ?? 0
  ));
  const rowUniqueWatchIds = sum(actions.map((audit: any) =>
    audit.lineage_reset?.unique_watch_ids_cleared ?? 0
  ));
  if (
    (stats.route_lease_revalidation_lineage_resets ?? 0) !== rowLineageResets ||
    (stats.route_lease_revalidation_selected_watch_links_cleared ?? 0) !==
      rowSelectedLinks ||
    (stats.route_lease_revalidation_displaced_watch_links_cleared ?? 0) !==
      rowDisplacedLinks ||
    (stats.route_lease_revalidation_unique_watch_ids_cleared ?? 0) !==
      rowUniqueWatchIds
  ) throw new Error(`${label}: lineage-reset counters do not match their ledger`);

  audits += rows.length;
  crossings += stats.route_lease_audits_with_loss_crossing;
  eligible += stats.route_lease_revalidations_eligible;
  admitted += stats.route_lease_revalidations_admitted;
  started += stats.route_lease_revalidations_started;
  unavailable += stats.route_lease_revalidations_incumbent_unavailable;
  reserveSuppressed += stats.route_lease_revalidations_terminal_reserve_suppressed;
  allowanceSuppressed += stats.route_lease_revalidations_probe_allowance_suppressed;
  targetReached += stats.route_lease_revalidations_target_reached;
  currentSelected += stats.route_lease_revalidations_current_selected;
  incumbentSelected += stats.route_lease_revalidations_incumbent_selected;
  deadEnds += stats.route_lease_revalidations_probe_dead_ends;
  deferred += stats.route_lease_revalidations_probe_deferred;
  budgetYields += stats.route_lease_revalidations_probe_budget_yields;
  ceilingStops += stats.route_lease_revalidations_execution_ceiling_stops;
  probeNodes += stats.route_lease_revalidation_probe_nodes_processed;
  probeFrames += stats.route_lease_revalidation_probe_frames;
  lineageResets += rowLineageResets;
  selectedWatchLinksCleared += rowSelectedLinks;
  displacedWatchLinksCleared += rowDisplacedLinks;
  uniqueWatchIdsCleared += rowUniqueWatchIds;
  if (actions.length > 0) {
    actionRuns.add(key);
    actionSources.add(candidateRow.task.sourceId);
  } else {
    assertNoActionIdentity(label, candidateRow, referenceRow);
    noActionPairs.push({ candidate: candidateRow, reference: referenceRow });
  }
}

const score = summarizeScore(candidate, reference);
const work = {
  candidate: summarizeWork(candidate.archive.runs),
  reference: summarizeWork(reference.archive.runs),
};
const workDelta = subtractWork(work.candidate, work.reference);
const gate = {
  declared_four_seed_panel: score.seed_blocks.length >= 4,
  all_candidate_cells_valid: [...candidate.cells.values()].every((cell) => cell.valid),
  no_reference_completion_lost: paired.lost.length === 0,
  positive_total_run_score_movement: outcomes.overall_score_sum_delta > 0,
  positive_seed_blocks: score.seed_blocks.filter((row: any) => row.mean_delta > 0).length,
  positive_source_means: score.source_blocks.filter((row: any) => row.mean_delta > 0).length,
  no_cell_loses_20: score.minimum_cell_delta > -20,
  at_least_40_same_horizon_comparisons: targetReached >= 40,
  every_eligible_action_resolved: eligible === started + allowanceSuppressed,
  every_admitted_action_started: admitted === started,
  at_least_90_percent_started_reach_target:
    started > 0 && targetReached * 10 >= started * 9,
  both_measured_winners_exercised: currentSelected > 0 && incumbentSelected > 0,
  actions_span_all_sources: actionSources.size === score.source_blocks.length,
  every_target_reach_resets_lineage:
    lineageResetMode !== true || lineageResets === targetReached,
};
const passed = gate.declared_four_seed_panel && gate.all_candidate_cells_valid &&
  gate.no_reference_completion_lost && gate.positive_total_run_score_movement &&
  gate.positive_seed_blocks >= 3 && gate.positive_source_means >= 4 &&
  gate.no_cell_loses_20 && gate.at_least_40_same_horizon_comparisons &&
  gate.every_eligible_action_resolved && gate.every_admitted_action_started &&
  gate.at_least_90_percent_started_reach_target &&
  gate.both_measured_winners_exercised && gate.actions_span_all_sources &&
  gate.every_target_reach_resets_lineage;

const result = {
  schema: "line.route-lease-revalidation-analysis.v2",
  generated_at: new Date().toISOString(),
  scope: {
    cells: candidate.cells.size,
    sources: score.source_blocks.length,
    budgets: candidate.archive.budgets,
    seeds: candidate.archive.seeds,
    interpretation:
      `Fresh compact 750k characterization of the frozen ${
        lineageResetMode ? "lineage-reset" : "one-shot"
      } revalidation rule; never promotion evidence.`,
    variant: lineageResetMode ? "reset_measured_endpoint_lineage" : "one_shot",
  },
  pairing_notes: pairingNotes,
  contract: {
    trigger: "first selected-route whole-prefix loss crossing",
    eligibility:
      "queued incumbent, shipped 1.25 terminal reserve, observed atomic preflight",
    action:
      "isolated incumbent preferred path to current gap; retain siblings and both endpoints; same-horizon winner first",
    post_comparison:
      lineageResetMode
        ? "clear inherited causal-watch links only on both measured endpoints; later expansions arm fresh watches"
        : "preserve inherited causal-watch links",
  },
  score,
  paired_outcomes: outcomes,
  mechanics: {
    audits,
    crossings,
    eligible,
    admitted,
    started,
    incumbent_unavailable: unavailable,
    terminal_reserve_suppressed: reserveSuppressed,
    probe_allowance_suppressed: allowanceSuppressed,
    target_reached: targetReached,
    current_selected: currentSelected,
    incumbent_selected: incumbentSelected,
    probe_dead_ends: deadEnds,
    probe_deferred: deferred,
    probe_budget_yields: budgetYields,
    execution_ceiling_stops: ceilingStops,
    probe_nodes: probeNodes,
    probe_frames: probeFrames,
    action_runs: actionRuns.size,
    action_sources: actionSources.size,
    no_action_cells: noActionPairs.length,
    no_action_track_score_report_work_identity: true,
    lineage_resets: lineageResets,
    selected_watch_links_cleared: selectedWatchLinksCleared,
    displaced_watch_links_cleared: displacedWatchLinksCleared,
    unique_watch_ids_cleared: uniqueWatchIdsCleared,
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
    "The trigger is intentionally broad; the actual priority decision is same-horizon and score-blind.",
    "Compact source and seed blocks are continuation evidence, not promotion authority.",
    "Do not tune source eligibility, loss crossing, reserve, or winner threshold from this panel.",
  ],
};

console.log(
  `ROUTE-LEASE REVALIDATION${lineageResetMode ? " + LINEAGE RESET" : ""}  ` +
    `${candidate.cells.size} paired cells`,
);
console.log(
  `score ${signed(score.mean_delta_per_cell, 3)} +/- ` +
    `${format(score.seed_block_standard_error, 3)} SE; ` +
    `${score.better}/${score.worse}/${score.tied} better/worse/tied`,
);
console.log(
  `same-horizon ${targetReached}/${started}; winners current/incumbent ` +
    `${currentSelected}/${incumbentSelected}; first terminal ` +
    `${signedNullable(workDelta.mean_paired_first_terminal_delta, 0)}`,
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

function validateAction(label: string, audit: any, event: any): void {
  const crossing = audit.first_loss_crossing;
  const action = audit.revalidation;
  const reached = action.outcome === "current_selected" ||
    action.outcome === "incumbent_selected";
  if (
    event?.catchup_outcome !== "alternative_selected" || crossing === null ||
    audit.revalidation_disposition !== "started" ||
    action.target_gap_index !== crossing.gap_index ||
    action.start_total_spent_frames !== crossing.total_spent_frames ||
    event.resumed_total_spent_frames !== action.start_total_spent_frames ||
    action.end_total_spent_frames - action.start_total_spent_frames !== action.probe_frames ||
    action.probe_allowance_frames !== Math.max(
      0,
      action.execution_remaining_frames - action.terminal_reserve_frames,
    ) ||
    action.preflight_estimated_next_node_frames > action.probe_allowance_frames ||
    audit.end_total_spent_frames !== action.end_total_spent_frames ||
    reached !== (action.current_axis_loss !== null && action.incumbent_axis_loss !== null) ||
    reached !== (action.current_axis_count !== null && action.incumbent_axis_count !== null) ||
    reached !== (action.current_axis_sse !== null && action.incumbent_axis_sse !== null) ||
    (reached && action.current_axis_count !== action.incumbent_axis_count) ||
    (action.outcome === "current_selected" &&
      !(action.current_axis_loss <= action.incumbent_axis_loss)) ||
    (action.outcome === "incumbent_selected" &&
      !(action.incumbent_axis_loss < action.current_axis_loss))
  ) throw new Error(`${label}: invalid same-horizon revalidation ledger`);
}

function validateLineageReset(label: string, audit: any, enabled: boolean): void {
  const reached = audit.revalidation.outcome === "current_selected" ||
    audit.revalidation.outcome === "incumbent_selected";
  const reset = audit.lineage_reset ?? null;
  if (!enabled) {
    if (reset !== null) throw new Error(`${label}: one-shot action unexpectedly reset lineage`);
    return;
  }
  if (reached !== (reset !== null)) {
    throw new Error(`${label}: lineage reset does not match same-horizon target reach`);
  }
  if (reset !== null && (
    reset.total_spent_frames !== audit.revalidation.end_total_spent_frames ||
    !Number.isSafeInteger(reset.selected_watch_links_cleared) ||
    !Number.isSafeInteger(reset.displaced_watch_links_cleared) ||
    !Number.isSafeInteger(reset.unique_watch_ids_cleared) ||
    reset.selected_watch_links_cleared < 0 ||
    reset.displaced_watch_links_cleared < 0 ||
    reset.unique_watch_ids_cleared < 0 ||
    reset.unique_watch_ids_cleared >
      reset.selected_watch_links_cleared + reset.displaced_watch_links_cleared
  )) throw new Error(`${label}: invalid measured-endpoint lineage reset`);
}

function assertNoActionIdentity(label: string, candidateRow: any, referenceRow: any): void {
  for (const [name, left, right] of [
    ["track", candidateRow.trackHash, referenceRow.trackHash],
    ["report", candidateRow.report, referenceRow.report],
    ["score", candidateRow.score, referenceRow.score],
    ["budget telemetry", candidateRow.budgetTelemetry, referenceRow.budgetTelemetry],
  ] as const) {
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      throw new Error(`${label}: no-action cell changed ${name}`);
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
    .map(([seed, rows]) => ({ seed: Number(seed), mean_delta: mean(rows.map((row) => row.delta)) }));
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

function subtractWork(candidateWork: any, referenceWork: any): any {
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
