/**
 * Trust gate and score-blind offline rule selection for deferred-value prefix
 * competitiveness. The reference is the archived, pre-instrumentation live
 * arm under the exact same compiler policy.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  assertPairedArms,
  gridCellKey,
  readGridArm,
  type GridArm,
  type GridCell,
} from "./paired_grid.ts";

const args = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const candidatePath = required("candidate");
const referencePath = required("reference");
const outPath = argument("out");
const expectedPolicy = "selective_axis_regret_catchup_value_deferred_initial";
const axisTolerance = 0.25;
const ruleSpecs = [0, 0.05, 0.10, 0.20].flatMap((lossDelta) =>
  [2, 3].map((persistence) => ({ lossDelta, persistence }))
);

const candidate = readGridArm("deferred-prefix-map", candidatePath);
const reference = readGridArm("pre-instrumentation-reference", referencePath);
assertPairedArms(candidate, reference);
const candidateRows = rowsByKey(candidate);
const referenceRows = rowsByKey(reference);
const budgets = [...new Set([...candidate.cells.values()].map((cell) => cell.budget))]
  .sort((left, right) => left - right);
if (budgets.length !== 2) throw new Error("deferred prefix map requires two budgets");

let exactOutputCells = 0;
let exactFirstTerminalCells = 0;
let exactPriorSelectiveTelemetryCells = 0;
let exactBudgetTelemetryCells = 0;
const observations = [...candidate.cells.values()].map((cell) => {
  const key = gridCellKey(cell.sourceId, cell.budget, cell.seed);
  const ref = reference.cells.get(key);
  const row = candidateRows.get(key);
  const refRow = referenceRows.get(key);
  if (ref === undefined || row === undefined || refRow === undefined) {
    throw new Error(`missing deferred prefix pair ${key}`);
  }
  const exactOutput =
    cell.valid === ref.valid &&
    cell.score === ref.score &&
    cell.trackHash === ref.trackHash &&
    jsonEqual(row.report, refRow.report);
  const exactFirstTerminal =
    row.stats?.first_completion_frame === refRow.stats?.first_completion_frame &&
    row.stats?.handoff_first_terminal_track_hash ===
      refRow.stats?.handoff_first_terminal_track_hash;
  const exactPriorSelectiveTelemetry = jsonEqual(
    withoutProgressCheckpoints(row.stats?.handoff_selective_backtracking),
    refRow.stats?.handoff_selective_backtracking,
  );
  const exactBudgetTelemetry = jsonEqual(row.budgetTelemetry, refRow.budgetTelemetry);
  if (exactOutput) exactOutputCells++;
  if (exactFirstTerminal) exactFirstTerminalCells++;
  if (exactPriorSelectiveTelemetry) exactPriorSelectiveTelemetryCells++;
  if (exactBudgetTelemetry) exactBudgetTelemetryCells++;
  const mechanism = validateCheckpoints(row, key);
  return { cell, ref, row, refRow, key, mechanism };
});

const trustPassed =
  exactOutputCells === candidate.cells.size &&
  exactFirstTerminalCells === candidate.cells.size &&
  exactPriorSelectiveTelemetryCells === candidate.cells.size &&
  exactBudgetTelemetryCells === candidate.cells.size;
if (!trustPassed) {
  throw new Error(
    `behavior-neutral trust gate failed: output ${exactOutputCells}, first terminal ` +
      `${exactFirstTerminalCells}, selective ${exactPriorSelectiveTelemetryCells}, ` +
      `budget ${exactBudgetTelemetryCells} of ${candidate.cells.size}`,
  );
}

const byBudget = Object.fromEntries(budgets.map((budget) => {
  const rows = observations.filter((observation) => observation.cell.budget === budget);
  const active = rows.filter((observation) => observation.mechanism.attempt !== null);
  const checkpointCount = sum(active.map((observation) =>
    observation.mechanism.attempt.progress_checkpoints.length
  ));
  const terminalPathCount = sum(active.map((observation) =>
    observation.mechanism.attempt.progress_checkpoints.filter((checkpoint: any) =>
      checkpoint.on_offered_terminal_path === true
    ).length
  ));
  const improving = active.filter((observation) =>
    observation.mechanism.attempt.terminal_register_improvements > 0
  );
  const notImproving = active.filter((observation) =>
    observation.mechanism.attempt.terminal_register_improvements === 0
  );
  return [String(budget), {
    cells: rows.length,
    active_actions: active.length,
    terminal_register_improving_actions: improving.length,
    non_improving_or_yielded_actions: notImproving.length,
    checkpoints: checkpointCount,
    offered_terminal_path_checkpoints: terminalPathCount,
    actions_with_two_eligible_checkpoints: active.filter((observation) =>
      eligibleSeries(observation.mechanism.attempt).length >= 2
    ).length,
    first_divergence_gap_offset_from_action_start: summarizeNumbers(active.map(
      (observation) => {
        const attempt = observation.mechanism.attempt;
        const first = attempt.progress_checkpoints[0];
        return first === undefined || first.first_divergent_gap_index === null
          ? 0
          : attempt.start_gap_index - first.first_divergent_gap_index;
      },
    )),
  }];
}));

const rules = ruleSpecs.map((spec) => {
  const budgetRows = Object.fromEntries(budgets.map((budget) => {
    const active = observations.filter((observation) =>
      observation.cell.budget === budget && observation.mechanism.attempt !== null
    );
    const evaluated = active.map((observation) => ({
      observation,
      eligible: eligibleSeries(observation.mechanism.attempt),
      trigger: firstTrigger(observation.mechanism.attempt, spec),
    }));
    const triggered = evaluated.filter((row) => row.trigger !== null);
    const improvingTriggers = triggered.filter((row) =>
      row.observation.mechanism.attempt.terminal_register_improvements > 0
    );
    const nonImprovingTriggers = triggered.filter((row) =>
      row.observation.mechanism.attempt.terminal_register_improvements === 0
    );
    const savedFrames = sum(triggered.map((row) =>
      row.observation.mechanism.attempt.end_total_spent_frames -
        row.trigger.selection_total_spent_frames
    ));
    const totalActionFrames = sum(active.map((row) =>
      row.mechanism.attempt.end_total_spent_frames -
        row.mechanism.attempt.start_total_spent_frames
    ));
    const triggeredSources = new Set(nonImprovingTriggers.map((row) =>
      row.observation.cell.sourceId
    ));
    const gate = {
      no_improving_action_triggered: improvingTriggers.length === 0,
      four_non_improving_actions: nonImprovingTriggers.length >= 4,
      three_non_improving_sources: triggeredSources.size >= 3,
      ten_percent_aggregate_work_saved:
        totalActionFrames > 0 && savedFrames / totalActionFrames >= 0.10,
      eight_actions_with_two_eligible_checkpoints:
        evaluated.filter((row) => row.eligible.length >= 2).length >= 8,
    };
    return [String(budget), {
      active_actions: active.length,
      actions_with_two_eligible_checkpoints:
        evaluated.filter((row) => row.eligible.length >= 2).length,
      triggered_actions: triggered.length,
      improving_action_triggers: improvingTriggers.length,
      non_improving_action_triggers: nonImprovingTriggers.length,
      non_improving_trigger_sources: triggeredSources.size,
      predicted_saved_frames: savedFrames,
      predicted_saved_fraction_of_all_action_work:
        totalActionFrames === 0 ? 0 : savedFrames / totalActionFrames,
      trigger_estimated_work_fraction: summarizeNumbers(triggered.map((row) =>
        row.trigger.estimated_work_fraction_spent
      )),
      gate,
      passed: Object.values(gate).every(Boolean),
    }];
  }));
  return {
    id: ruleId(spec),
    loss_delta: spec.lossDelta,
    persistence_contacts: spec.persistence,
    by_budget: budgetRows,
    passed: budgets.every((budget) => budgetRows[String(budget)].passed),
  };
});

const eligibleRules = rules.filter((rule) => rule.passed).sort((left, right) => {
  const leftFractions = budgets.map((budget) =>
    left.by_budget[String(budget)].trigger_estimated_work_fraction.mean ?? Infinity
  );
  const rightFractions = budgets.map((budget) =>
    right.by_budget[String(budget)].trigger_estimated_work_fraction.mean ?? Infinity
  );
  return mean(leftFractions) - mean(rightFractions) ||
    right.loss_delta - left.loss_delta ||
    right.persistence_contacts - left.persistence_contacts;
});
const selectedRule = eligibleRules[0] ?? null;

const result = {
  schema: "line.deferred-value-prefix-map-analysis.v1",
  generated_at: new Date().toISOString(),
  scope: {
    budgets,
    seeds: candidate.archive.seeds,
    sources: [...new Set([...candidate.cells.values()].map((cell) => cell.sourceId))].sort(),
    cells: candidate.cells.size,
    interpretation:
      "Behavior-neutral paired map. Offline rules read internal prefix checkpoints and terminal-register outcome only; paired final score is excluded from rule selection.",
  },
  trust: {
    exact_output_cells: exactOutputCells,
    exact_first_terminal_cells: exactFirstTerminalCells,
    exact_prior_selective_telemetry_cells: exactPriorSelectiveTelemetryCells,
    exact_budget_telemetry_cells: exactBudgetTelemetryCells,
    cells: candidate.cells.size,
    passed: trustPassed,
  },
  by_budget: byBudget,
  frozen_rule_family: rules,
  selection: {
    selected_rule: selectedRule?.id ?? null,
    passed: selectedRule !== null,
    consequence: selectedRule === null
      ? "Close the frozen early-stop family without a live arm."
      : `Freeze ${selectedRule.id} and test it on fresh seeds; paired final score was not read.`,
  },
};

console.log(`DEFERRED PREFIX MAP  ${result.scope.cells} cells`);
console.log(
  `trust ${trustPassed ? "PASS" : "FAIL"}: output/terminal/selective/budget ` +
    `${exactOutputCells}/${exactFirstTerminalCells}/` +
    `${exactPriorSelectiveTelemetryCells}/${exactBudgetTelemetryCells}`,
);
for (const budget of budgets) {
  const row = byBudget[String(budget)]!;
  console.log(
    `${budget / 1000}k actions ${row.active_actions}; checkpoints ${row.checkpoints}; ` +
      `improving/non-improving ${row.terminal_register_improving_actions}/` +
      `${row.non_improving_or_yielded_actions}; eligible actions ` +
      `${row.actions_with_two_eligible_checkpoints}`,
  );
}
console.log(
  `rule ${selectedRule?.id ?? "NONE"}: ${result.selection.consequence}`,
);
if (outPath !== undefined) {
  const absolute = resolve(outPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`analysis ${absolute}`);
}

function validateCheckpoints(row: any, label: string): { attempt: any | null } {
  const stats = row.stats?.handoff_selective_backtracking;
  if (stats?.policy !== expectedPolicy) {
    throw new Error(`${label}: unexpected policy ${String(stats?.policy)}`);
  }
  const attempts = stats.deferred_value_attempts ?? [];
  if (attempts.length > 1) throw new Error(`${label}: more than one deferred attempt`);
  if (attempts.length === 0) return { attempt: null };
  const attempt = attempts[0]!;
  const checkpoints = attempt.progress_checkpoints;
  if (!Array.isArray(checkpoints) || checkpoints.length !== attempt.nodes_processed) {
    throw new Error(`${label}: checkpoints do not reconcile with processed nodes`);
  }
  let priorSelectionFrame = -1;
  let priorHighWater = -1;
  for (let index = 0; index < checkpoints.length; index++) {
    const checkpoint = checkpoints[index]!;
    if (
      checkpoint.selection_ordinal !== index + 1 ||
      checkpoint.selection_total_spent_frames !==
        attempt.start_total_spent_frames + checkpoint.spent_frames_since_attempt_start ||
      checkpoint.selection_total_spent_frames < priorSelectionFrame ||
      checkpoint.gap_index < 0 ||
      checkpoint.first_divergent_gap_index === null ||
      checkpoint.first_divergent_gap_index >= checkpoint.gap_index ||
      checkpoint.frontier_lane !== (checkpoint.skipped_contacts === 0 ? "pass" : "fallback") ||
      checkpoint.new_selected_gap_high_water !== (checkpoint.gap_index > priorHighWater)
    ) throw new Error(`${label}: malformed checkpoint ${index + 1}`);
    priorSelectionFrame = checkpoint.selection_total_spent_frames;
    priorHighWater = Math.max(priorHighWater, checkpoint.gap_index);
    validateAxisComparison(checkpoint.whole_prefix, `${label}/${index + 1}/whole`);
    if (checkpoint.divergent_suffix === null) {
      throw new Error(`${label}: exact deferred alternative has no divergent suffix`);
    }
    validateAxisComparison(checkpoint.divergent_suffix, `${label}/${index + 1}/suffix`);
    if (
      checkpoint.skipped_contacts === 0 &&
      (
        checkpoint.whole_prefix.selected_axis_count !==
          checkpoint.whole_prefix.incumbent_axis_count ||
        checkpoint.divergent_suffix.selected_axis_count !==
          checkpoint.divergent_suffix.incumbent_axis_count
      )
    ) throw new Error(`${label}: pass checkpoint does not compare the same authored axes`);
    if (checkpoint.latest_comparable_contact !== null) {
      validateAxisComparison(
        checkpoint.latest_comparable_contact,
        `${label}/${index + 1}/latest`,
      );
    }
    const selectedAxisSse = sum(Object.values(
      checkpoint.divergent_suffix_axis_sse_by_axis,
    ).map((value: any) => value.selected_sse));
    const incumbentAxisSse = sum(Object.values(
      checkpoint.divergent_suffix_axis_sse_by_axis,
    ).map((value: any) => value.incumbent_sse));
    if (
      !close(selectedAxisSse, checkpoint.divergent_suffix.selected_axis_sse) ||
      !close(incumbentAxisSse, checkpoint.divergent_suffix.incumbent_axis_sse)
    ) throw new Error(`${label}: per-axis suffix SSE does not reconcile`);
  }
  const terminalReached = attempt.outcome === "terminal_reached";
  if (checkpoints.some((checkpoint: any) =>
    terminalReached
      ? typeof checkpoint.on_offered_terminal_path !== "boolean"
      : checkpoint.on_offered_terminal_path !== null
  )) throw new Error(`${label}: terminal-path labels contradict attempt outcome`);
  return { attempt };
}

function validateAxisComparison(comparison: any, label: string): void {
  const values = [
    comparison.selected_axis_count,
    comparison.incumbent_axis_count,
    comparison.selected_axis_sse,
    comparison.incumbent_axis_sse,
    comparison.selected_axis_loss,
    comparison.incumbent_axis_loss,
    comparison.axis_loss_delta,
  ];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`${label}: non-finite axis comparison`);
  }
  const expectedSelected = comparison.selected_axis_count === 0
    ? 0
    : Math.sqrt(comparison.selected_axis_sse / comparison.selected_axis_count) /
      axisTolerance;
  const expectedIncumbent = comparison.incumbent_axis_count === 0
    ? 0
    : Math.sqrt(comparison.incumbent_axis_sse / comparison.incumbent_axis_count) /
      axisTolerance;
  if (
    !close(expectedSelected, comparison.selected_axis_loss) ||
    !close(expectedIncumbent, comparison.incumbent_axis_loss) ||
    !close(
      comparison.selected_axis_loss - comparison.incumbent_axis_loss,
      comparison.axis_loss_delta,
    )
  ) throw new Error(`${label}: authored-axis loss does not reconcile with SSE`);
}

function eligibleSeries(attempt: any): any[] {
  const result: any[] = [];
  let previousComparableContacts = -1;
  for (const checkpoint of attempt.progress_checkpoints) {
    if (
      !checkpoint.new_selected_gap_high_water ||
      checkpoint.skipped_contacts !== 0 ||
      checkpoint.divergent_suffix === null ||
      checkpoint.comparable_contacts_since_divergence < 3 ||
      checkpoint.comparable_contacts_since_divergence <= previousComparableContacts
    ) continue;
    previousComparableContacts = checkpoint.comparable_contacts_since_divergence;
    result.push(checkpoint);
  }
  return result;
}

function firstTrigger(
  attempt: any,
  spec: { lossDelta: number; persistence: number },
): any | null {
  const eligible = eligibleSeries(attempt);
  for (let index = spec.persistence - 1; index < eligible.length; index++) {
    const window = eligible.slice(index - spec.persistence + 1, index + 1);
    const consecutiveContacts = window.every((checkpoint, offset) =>
      offset === 0 || checkpoint.comparable_contacts_since_divergence ===
        window[offset - 1]!.comparable_contacts_since_divergence + 1
    );
    if (
      consecutiveContacts &&
      window.every((checkpoint) =>
        checkpoint.divergent_suffix.axis_loss_delta > spec.lossDelta
      )
    ) return eligible[index]!;
  }
  return null;
}

function withoutProgressCheckpoints(stats: any): any {
  if (stats === undefined || stats === null) return stats;
  const copy = structuredClone(stats);
  for (const attempt of copy.deferred_value_attempts ?? []) {
    delete attempt.progress_checkpoints;
  }
  return copy;
}

function ruleId(spec: { lossDelta: number; persistence: number }): string {
  return `suffix-loss-delta-${spec.lossDelta.toFixed(2).replace(".", "p")}` +
    `-persist-${spec.persistence}`;
}

function rowsByKey(arm: GridArm): Map<string, any> {
  return new Map(arm.archive.runs.map((row: any) => [
    gridCellKey(row.task.sourceId, row.task.budget, row.task.actualSeed),
    row,
  ]));
}

function summarizeNumbers(values: number[]): any {
  return {
    count: values.length,
    min: values.length === 0 ? null : Math.min(...values),
    mean: values.length === 0 ? null : mean(values),
    max: values.length === 0 ? null : Math.max(...values),
  };
}

function close(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right));
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

function required(name: string): string {
  const value = argument(name);
  if (value === undefined || value === "") {
    throw new Error("usage: --candidate=<archive> --reference=<archive> [--out=<json>]");
  }
  return value;
}
