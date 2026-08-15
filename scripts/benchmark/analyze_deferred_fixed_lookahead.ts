/** Trust, mechanism, and frozen continuation gate for deferred fixed lookahead. */

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
const expectedPolicy = "selective_axis_regret_catchup_value_deferred_prefix_gate";
const expectedSchema = "line.compile-budget-telemetry.v11";
const contactHorizon = 6;
const lossDeltaThreshold = 0.05;

const candidate = readGridArm("fixed-lookahead", candidatePath);
const reference = readGridArm("production-reference", referencePath);
assertPairedArms(candidate, reference);
const candidateRows = rowsByKey(candidate);
const referenceRows = rowsByKey(reference);
const budgets = [...new Set([...candidate.cells.values()].map((cell) => cell.budget))]
  .sort((left, right) => left - right);
if (budgets.length !== 2) throw new Error("fixed-lookahead screen requires two budgets");

let exactFirstTerminalFrames = 0;
let exactFirstTerminalHashes = 0;
const byBudget = Object.fromEntries(budgets.map((budget) => {
  const pairs = [...candidate.cells.values()].filter((cell) => cell.budget === budget)
    .map((cell) => {
      const key = gridCellKey(cell.sourceId, cell.budget, cell.seed);
      const ref = reference.cells.get(key);
      const row = candidateRows.get(key);
      const refRow = referenceRows.get(key);
      if (ref === undefined || row === undefined || refRow === undefined) {
        throw new Error(`missing fixed-lookahead pair ${key}`);
      }
      if (row.stats.first_completion_frame === refRow.stats.first_completion_frame) {
        exactFirstTerminalFrames++;
      }
      if (
        row.stats.handoff_first_terminal_track_hash ===
          refRow.stats.handoff_first_terminal_track_hash
      ) exactFirstTerminalHashes++;
      return { cell, ref, row, refRow, mechanism: validateMechanism(row, key) };
    });
  const active = pairs.filter((pair) => pair.mechanism.attempt !== null);
  const inactive = pairs.filter((pair) => pair.mechanism.attempt === null);
  const decided = active.filter((pair) =>
    pair.mechanism.attempt.prefix_gate.decision !== "not_reached"
  );
  const stopped = active.filter((pair) =>
    pair.mechanism.attempt.prefix_gate.decision === "stop"
  );
  const continued = active.filter((pair) =>
    pair.mechanism.attempt.prefix_gate.decision === "continue"
  );
  const notReached = active.filter((pair) =>
    pair.mechanism.attempt.prefix_gate.decision === "not_reached"
  );
  const score = summarizeScore(pairs);
  const activeScore = summarizeScore(active);
  const inactiveScore = summarizeScore(inactive);
  if (inactiveScore.changed_tracks !== 0 || inactiveScore.sum_delta !== 0) {
    throw new Error(`${budget}: action-free cells changed production output`);
  }
  const sources = new Set(active.map((pair) => pair.cell.sourceId));
  const decisionSources = new Set(decided.map((pair) => pair.cell.sourceId));
  const positiveSeedBlocks = score.seed_blocks.filter((block: any) =>
    block.mean_delta > 0
  ).length;
  const repair = summarizeRepair(pairs);
  return [String(budget), {
    cells: pairs.length,
    score,
    action_set: {
      active_cells: active.length,
      active_sources: sources.size,
      active_score: activeScore,
      inactive_cells: inactive.length,
      inactive_score: inactiveScore,
    },
    mechanism: {
      decisions: decided.length,
      decision_sources: decisionSources.size,
      stopped: stopped.length,
      continued: continued.length,
      not_reached: notReached.length,
      terminal_reached: active.filter((pair) =>
        pair.mechanism.attempt.outcome === "terminal_reached"
      ).length,
      atomic_budget_yields: active.filter((pair) =>
        pair.mechanism.attempt.outcome === "atomic_budget_yield"
      ).length,
      terminal_register_improvements: sum(active.map((pair) =>
        pair.mechanism.attempt.terminal_register_improvements
      )),
      stopped_frames: summarizeNumbers(stopped.map((pair) =>
        pair.mechanism.episode.outcome.spent_frames
      )),
      continued_frames: summarizeNumbers(continued.map((pair) =>
        pair.mechanism.episode.outcome.spent_frames
      )),
      stop_loss_delta: summarizeNumbers(stopped.map((pair) =>
        pair.mechanism.attempt.prefix_gate.checkpoint.divergent_suffix.axis_loss_delta
      )),
      continue_loss_delta: summarizeNumbers(continued.map((pair) =>
        pair.mechanism.attempt.prefix_gate.checkpoint.divergent_suffix.axis_loss_delta
      )),
      returned_frontier_nodes: sum(active.map((pair) =>
        pair.mechanism.attempt.remaining_pass_nodes_returned +
          pair.mechanism.attempt.remaining_fallback_nodes_returned
      )),
    },
    repair,
    gate: {
      all_candidate_cells_valid: pairs.every((pair) => pair.cell.valid),
      no_reference_validity_lost: pairs.every((pair) => !pair.ref.valid || pair.cell.valid),
      positive_total_mean: score.mean_delta_per_cell > 0,
      positive_active_mean: active.length > 0 && activeScore.mean_delta_per_cell > 0,
      positive_seed_blocks: positiveSeedBlocks,
      no_cell_loses_20: score.minimum_cell_delta !== null && score.minimum_cell_delta > -20,
      actions_span_eight_runs: active.length >= 8,
      actions_span_four_sources: sources.size >= 4,
      decisions_span_four_runs: decided.length >= 4,
      decisions_span_three_sources: decisionSources.size >= 3,
    },
  }];
}));

const exactFirstTerminalIdentity =
  exactFirstTerminalFrames === candidate.cells.size &&
  exactFirstTerminalHashes === candidate.cells.size;
const rows = budgets.map((budget) => byBudget[String(budget)] as any);
const seedBlocks = rows.map((row) => row.gate.positive_seed_blocks);
const screenPassed = exactFirstTerminalIdentity && rows.every((row) =>
  row.gate.all_candidate_cells_valid &&
  row.gate.no_reference_validity_lost &&
  row.gate.positive_total_mean &&
  row.gate.positive_active_mean &&
  row.gate.no_cell_loses_20 &&
  row.gate.actions_span_eight_runs &&
  row.gate.actions_span_four_sources &&
  row.gate.decisions_span_four_runs &&
  row.gate.decisions_span_three_sources
) && Math.max(...seedBlocks) >= 3 && Math.min(...seedBlocks) >= 2;

const result = {
  schema: "line.deferred-value-fixed-lookahead-analysis.v1",
  generated_at: new Date().toISOString(),
  scope: {
    budgets,
    seeds: candidate.archive.seeds,
    sources: [...new Set([...candidate.cells.values()].map((cell) => cell.sourceId))].sort(),
    cells: candidate.cells.size,
    interpretation:
      "Fresh matched compact-panel screen of one fixed-horizon continuation decision; mover-grid evidence, not a headline.",
  },
  contract: {
    policy: expectedPolicy,
    budget_telemetry_schema: expectedSchema,
    contact_horizon: contactHorizon,
    axis_loss_delta_threshold: lossDeltaThreshold,
    maximum_decisions_per_action: 1,
  },
  identity: {
    exact_first_terminal_frames: exactFirstTerminalFrames,
    exact_first_terminal_track_hashes: exactFirstTerminalHashes,
    cells: candidate.cells.size,
    passed: exactFirstTerminalIdentity,
  },
  by_budget: byBudget,
  continuation_gate: {
    positive_seed_blocks_by_budget: Object.fromEntries(
      budgets.map((budget, index) => [String(budget), seedBlocks[index]]),
    ),
    passed: screenPassed,
    consequence: screenPassed
      ? "Run one predeclared fresh confirmation panel; do not promote yet."
      : "Close the exact six-contact/0.05 fixed-lookahead rule without confirmation or canonical V2.",
  },
};

console.log(`DEFERRED FIXED LOOKAHEAD  ${result.scope.cells} cells`);
for (const budget of budgets) {
  const row = byBudget[String(budget)]!;
  console.log(
    `${budget / 1000}k score ${signed(row.score.mean_delta_per_cell, 4)} +/- ` +
      `${format(row.score.seed_block_standard_error, 4)} SE; active ` +
      `${row.action_set.active_cells}; decisions stop/continue/not ` +
      `${row.mechanism.stopped}/${row.mechanism.continued}/${row.mechanism.not_reached}`,
  );
  console.log(
    `     active ${signed(row.action_set.active_score.mean_delta_per_cell, 4)}; ` +
      `seed blocks ${row.gate.positive_seed_blocks}; repair displacement ` +
      `${signed(row.repair.displaced_frames, 0)} frames/` +
      `${signed(row.repair.displaced_attempts, 0)} attempts`,
  );
}
console.log(`first-terminal identity ${exactFirstTerminalIdentity ? "PASS" : "FAIL"}`);
console.log(`gate ${screenPassed ? "PASS" : "CLOSE"}: ${result.continuation_gate.consequence}`);
if (outPath !== undefined) {
  const absolute = resolve(outPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`analysis ${absolute}`);
}

function validateMechanism(row: any, label: string): { attempt: any | null; episode: any | null } {
  if (row.budgetTelemetry?.schema !== expectedSchema) {
    throw new Error(`${label}: expected ${expectedSchema}`);
  }
  const stats = row.stats?.handoff_selective_backtracking;
  if (stats?.policy !== expectedPolicy) {
    throw new Error(`${label}: unexpected policy ${String(stats?.policy)}`);
  }
  const attempts = stats.deferred_value_attempts ?? [];
  if (attempts.length > 1) throw new Error(`${label}: more than one deferred action`);
  const episodes = row.budgetTelemetry.episodes.filter((episode: any) =>
    episode.lane === "deferred_value"
  );
  const segments = row.budgetTelemetry.execution_intervals.filter((segment: any) =>
    segment.kind === "deferred_value_suffix"
  );
  if (attempts.length !== episodes.length || attempts.length !== segments.length) {
    throw new Error(`${label}: action/episode/segment mismatch`);
  }
  if (attempts.length === 0) return { attempt: null, episode: null };
  const attempt = attempts[0]!;
  const episode = episodes[0]!;
  const segment = segments[0]!;
  const gate = attempt.prefix_gate;
  if (
    gate === null ||
    gate.contact_horizon !== contactHorizon ||
    gate.axis_loss_delta_threshold !== lossDeltaThreshold ||
    attempt.progress_checkpoints.length !== attempt.nodes_processed ||
    attempt.atomic_node_frames.length !== attempt.nodes_processed ||
    sum(attempt.atomic_node_frames) !== episode.outcome.spent_frames ||
    episode.work.nodes_processed !== attempt.nodes_processed ||
    episode.outcome.spent_frames !==
      attempt.end_total_spent_frames - attempt.start_total_spent_frames ||
    segment.spent_frames !== episode.outcome.spent_frames ||
    segment.stop_reason !== attempt.outcome ||
    attempt.tail_completion_attempts !== 0
  ) throw new Error(`${label}: action work does not reconcile`);
  const expectedStop = attempt.outcome === "terminal_reached"
    ? "first_terminal_return"
    : attempt.outcome === "prefix_gate_stop"
      ? "prefix_gate_stop"
      : attempt.outcome === "frontier_exhausted"
        ? "frontier_exhausted"
        : "local_ceiling";
  if (episode.outcome.stop_reason !== expectedStop) {
    throw new Error(`${label}: episode stop reason misattributes action outcome`);
  }
  if (gate.decision === "not_reached") {
    if (gate.checkpoint !== null || attempt.outcome === "prefix_gate_stop") {
      throw new Error(`${label}: not-reached gate has a decision checkpoint`);
    }
  } else {
    const checkpoint = gate.checkpoint;
    if (
      checkpoint === null ||
      checkpoint.comparable_contacts_since_divergence < contactHorizon ||
      checkpoint.divergent_suffix.selected_axis_count !==
        checkpoint.divergent_suffix.incumbent_axis_count
    ) throw new Error(`${label}: malformed fixed-lookahead decision`);
    const shouldStop = checkpoint.divergent_suffix.axis_loss_delta > lossDeltaThreshold;
    if ((gate.decision === "stop") !== shouldStop) {
      throw new Error(`${label}: gate decision contradicts authored-axis comparison`);
    }
    if (gate.decision === "stop") {
      if (
        attempt.outcome !== "prefix_gate_stop" ||
        checkpoint.selection_ordinal !== attempt.nodes_processed + 1 ||
        checkpoint.selection_total_spent_frames !== attempt.end_total_spent_frames ||
        attempt.terminal_node_evaluations !== 0
      ) throw new Error(`${label}: stop performed work after its decision`);
    } else {
      const recorded = attempt.progress_checkpoints.find((value: any) =>
        value.selection_ordinal === checkpoint.selection_ordinal
      );
      if (
        recorded === undefined ||
        recorded.selection_total_spent_frames !== checkpoint.selection_total_spent_frames ||
        recorded.divergent_suffix.axis_loss_delta !==
          checkpoint.divergent_suffix.axis_loss_delta
      ) throw new Error(`${label}: continuation checkpoint is not a processed node`);
    }
  }
  return { attempt, episode };
}

function summarizeScore<T extends { cell: GridCell; ref: GridCell }>(pairs: T[]): any {
  const deltas = pairs.map((pair) => pair.cell.score - pair.ref.score);
  const bySeed = new Map<number, number[]>();
  pairs.forEach((pair, index) => {
    const values = bySeed.get(pair.cell.seed) ?? [];
    values.push(deltas[index]!);
    bySeed.set(pair.cell.seed, values);
  });
  const seedBlocks = [...bySeed.entries()].sort((a, b) => a[0] - b[0])
    .map(([seed, values]) => ({ seed, mean_delta: mean(values) }));
  return {
    sum_delta: sum(deltas),
    mean_delta_per_cell: mean(deltas),
    seed_block_standard_error: standardError(seedBlocks.map((block) => block.mean_delta)),
    seed_blocks: seedBlocks,
    minimum_cell_delta: deltas.length === 0 ? null : Math.min(...deltas),
    improved: deltas.filter((value) => value > 0).length,
    regressed: deltas.filter((value) => value < 0).length,
    tied: deltas.filter((value) => value === 0).length,
    changed_tracks: pairs.filter((pair) => pair.cell.trackHash !== pair.ref.trackHash).length,
    worst_cells: pairs.map((pair, index) => ({
      source_id: pair.cell.sourceId,
      seed: pair.cell.seed,
      delta: deltas[index],
    })).sort((left, right) => left.delta! - right.delta!).slice(0, 5),
  };
}

function summarizeRepair(pairs: Array<{ row: any; refRow: any }>): any {
  const read = (rows: any[]) => {
    const episodes = rows.flatMap((row) => row.budgetTelemetry.episodes)
      .filter((episode: any) => episode.lane === "repair");
    return {
      attempts: episodes.length,
      accepted: episodes.filter((episode: any) =>
        episode.outcome.accepted_alternative
      ).length,
      frames: sum(episodes.map((episode: any) => episode.outcome.spent_frames)),
    };
  };
  const candidateSummary = read(pairs.map((pair) => pair.row));
  const referenceSummary = read(pairs.map((pair) => pair.refRow));
  return {
    candidate: candidateSummary,
    reference: referenceSummary,
    displaced_frames: candidateSummary.frames - referenceSummary.frames,
    displaced_attempts: candidateSummary.attempts - referenceSummary.attempts,
    displaced_accepted: candidateSummary.accepted - referenceSummary.accepted,
  };
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

function standardError(values: number[]): number | null {
  if (values.length < 2) return null;
  const center = mean(values);
  return Math.sqrt(
    sum(values.map((value) => (value - center) ** 2)) /
      (values.length - 1) / values.length,
  );
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

function signed(value: number, digits: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function format(value: number | null, digits: number): string {
  return value === null ? "n/a" : value.toFixed(digits);
}

function required(name: string): string {
  const value = argument(name);
  if (value === undefined || value === "") {
    throw new Error("usage: --candidate=<archive> --reference=<archive> [--out=<json>]");
  }
  return value;
}
