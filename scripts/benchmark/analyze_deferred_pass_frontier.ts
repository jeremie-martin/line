/** Trust, mechanism, and frozen evidence gate for deferred pass-frontier ownership. */

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
const expectedPolicy = "selective_axis_regret_catchup_value_deferred_pass_only";
const expectedSchema = "line.compile-budget-telemetry.v12";

const candidate = readGridArm("deferred-pass-only", candidatePath);
const reference = readGridArm("production-reference", referencePath);
assertPairedArms(candidate, reference);
const candidateRows = rowsByKey(candidate);
const referenceRows = rowsByKey(reference);
const budgets = [...new Set([...candidate.cells.values()].map((cell) => cell.budget))]
  .sort((left, right) => left - right);
if (budgets.length === 0) throw new Error("pass-frontier analysis has no budgets");

let exactFirstTerminalFrames = 0;
let exactFirstTerminalHashes = 0;
const allFallbackReturnSources = new Set<string>();
let allFallbackReturns = 0;
const byBudget = Object.fromEntries(budgets.map((budget) => {
  const pairs = [...candidate.cells.values()].filter((cell) => cell.budget === budget)
    .map((cell) => {
      const key = gridCellKey(cell.sourceId, cell.budget, cell.seed);
      const ref = reference.cells.get(key);
      const row = candidateRows.get(key);
      const refRow = referenceRows.get(key);
      if (ref === undefined || row === undefined || refRow === undefined) {
        throw new Error(`missing deferred pass-frontier pair ${key}`);
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
  const fallbackReturns = active.filter((pair) =>
    pair.mechanism.attempt.outcome === "fallback_frontier_return"
  );
  const terminalReached = active.filter((pair) =>
    pair.mechanism.attempt.outcome === "terminal_reached"
  );
  const terminalAccepted = terminalReached.filter((pair) =>
    pair.mechanism.attempt.terminal_register_improvements > 0
  );
  const terminalRejected = terminalReached.filter((pair) =>
    pair.mechanism.attempt.terminal_register_improvements === 0
  );
  const otherOutcomes = active.filter((pair) =>
    pair.mechanism.attempt.outcome !== "fallback_frontier_return" &&
    pair.mechanism.attempt.outcome !== "terminal_reached"
  );
  for (const pair of fallbackReturns) allFallbackReturnSources.add(pair.cell.sourceId);
  allFallbackReturns += fallbackReturns.length;
  const score = summarizeScore(pairs);
  const activeScore = summarizeScore(active);
  const inactiveScore = summarizeScore(inactive);
  const fallbackScore = summarizeScore(fallbackReturns);
  const terminalScore = summarizeScore(terminalReached);
  const actionFrames = sum(active.map((pair) =>
    pair.mechanism.episode.outcome.spent_frames
  ));
  if (inactiveScore.changed_tracks !== 0 || inactiveScore.sum_delta !== 0) {
    throw new Error(`${budget}: action-free cells changed production output`);
  }
  const sources = new Set(active.map((pair) => pair.cell.sourceId));
  const fallbackSources = new Set(fallbackReturns.map((pair) => pair.cell.sourceId));
  const positiveSeedBlocks = score.seed_blocks.filter((block: any) =>
    block.mean_delta > 0
  ).length;
  const repair = summarizeRepair(pairs);
  const sourceBreakdown = Object.fromEntries(
    [...new Set(pairs.map((pair) => pair.cell.sourceId))].sort().map((sourceId) => {
      const sourcePairs = pairs.filter((pair) => pair.cell.sourceId === sourceId);
      const sourceActive = sourcePairs.filter((pair) => pair.mechanism.attempt !== null);
      return [sourceId, {
        score: summarizeScore(sourcePairs),
        active_cells: sourceActive.length,
        fallback_returns: sourceActive.filter((pair) =>
          pair.mechanism.attempt.outcome === "fallback_frontier_return"
        ).length,
        terminal_register_improvements: sum(sourceActive.map((pair) =>
          pair.mechanism.attempt.terminal_register_improvements
        )),
        action_frames: sum(sourceActive.map((pair) =>
          pair.mechanism.episode.outcome.spent_frames
        )),
        repair: summarizeRepair(sourcePairs),
      }];
    }),
  );
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
      fallback_returns: fallbackReturns.length,
      fallback_return_sources: fallbackSources.size,
      fallback_return_score: fallbackScore,
      terminal_reached: terminalReached.length,
      terminal_reached_score: terminalScore,
      terminal_register_accepted: {
        cells: terminalAccepted.length,
        score: summarizeScore(terminalAccepted),
        action_frames: summarizeNumbers(terminalAccepted.map((pair) =>
          pair.mechanism.episode.outcome.spent_frames
        )),
        repair: summarizeRepair(terminalAccepted),
      },
      terminal_register_rejected: {
        cells: terminalRejected.length,
        score: summarizeScore(terminalRejected),
        action_frames: summarizeNumbers(terminalRejected.map((pair) =>
          pair.mechanism.episode.outcome.spent_frames
        )),
        repair: summarizeRepair(terminalRejected),
      },
      other_outcomes: otherOutcomes.length,
      nodes_processed: summarizeNumbers(active.map((pair) =>
        pair.mechanism.attempt.nodes_processed
      )),
      action_frames: summarizeNumbers(active.map((pair) =>
        pair.mechanism.episode.outcome.spent_frames
      )),
      fallback_return_frames: summarizeNumbers(fallbackReturns.map((pair) =>
        pair.mechanism.episode.outcome.spent_frames
      )),
      fallback_nodes_returned: sum(fallbackReturns.map((pair) =>
        pair.mechanism.attempt.remaining_fallback_nodes_returned
      )),
      terminal_register_improvements: sum(active.map((pair) =>
        pair.mechanism.attempt.terminal_register_improvements
      )),
      action_frames_total: actionFrames,
      action_frames_minus_displaced_repair_frames:
        actionFrames + repair.displaced_frames,
    },
    repair,
    by_source: sourceBreakdown,
    gate: {
      all_candidate_cells_valid: pairs.every((pair) => pair.cell.valid),
      no_reference_validity_lost: pairs.every((pair) => !pair.ref.valid || pair.cell.valid),
      positive_total_mean: score.mean_delta_per_cell > 0,
      positive_active_mean: active.length > 0 && activeScore.mean_delta_per_cell > 0,
      positive_seed_blocks: positiveSeedBlocks,
      no_cell_loses_20: score.minimum_cell_delta !== null && score.minimum_cell_delta > -20,
      actions_span_eight_runs: active.length >= 8,
      actions_span_four_sources: sources.size >= 4,
      fallback_return_observed: fallbackReturns.length >= 1,
    },
  }];
}));

const exactFirstTerminalIdentity =
  exactFirstTerminalFrames === candidate.cells.size &&
  exactFirstTerminalHashes === candidate.cells.size;
const rows = budgets.map((budget) => byBudget[String(budget)] as any);
const seedBlocks = rows.map((row) => row.gate.positive_seed_blocks);
const screenPassed = budgets.length === 2 && exactFirstTerminalIdentity && rows.every((row) =>
  row.gate.all_candidate_cells_valid &&
  row.gate.no_reference_validity_lost &&
  row.gate.positive_total_mean &&
  row.gate.positive_active_mean &&
  row.gate.no_cell_loses_20 &&
  row.gate.actions_span_eight_runs &&
  row.gate.actions_span_four_sources &&
  row.gate.fallback_return_observed
) && Math.max(...seedBlocks) >= 3 && Math.min(...seedBlocks) >= 2 &&
  allFallbackReturns >= 3 && allFallbackReturnSources.size >= 2;

const result = {
  schema: "line.deferred-pass-frontier-analysis.v1",
  generated_at: new Date().toISOString(),
  scope: {
    budgets,
    seeds: candidate.archive.seeds,
    sources: [...new Set([...candidate.cells.values()].map((cell) => cell.sourceId))].sort(),
    cells: candidate.cells.size,
    interpretation:
      "Fresh matched compact-panel screen of deferred pass-frontier ownership; mover-grid evidence, not a headline.",
  },
  contract: {
    policy: expectedPolicy,
    budget_telemetry_schema: expectedSchema,
    intervention: "return the optional suffix before its first fallback-lane node",
    fallback_return_checkpoint_is_atomic_work: false,
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
    fallback_returns_across_budgets: allFallbackReturns,
    fallback_return_sources_across_budgets: allFallbackReturnSources.size,
    passed: screenPassed,
    consequence: screenPassed
      ? "Run one predeclared fresh confirmation panel; do not promote yet."
      : budgets.length === 2
        ? "Close the exact pass-frontier-only ownership rule without confirmation or canonical V2."
        : "Mechanism-only evidence; the frozen score gate requires exactly two budgets.",
  },
};

console.log(`DEFERRED PASS FRONTIER  ${result.scope.cells} cells`);
for (const budget of budgets) {
  const row = byBudget[String(budget)]!;
  console.log(
    `${budget / 1000}k score ${signed(row.score.mean_delta_per_cell, 4)} +/- ` +
      `${format(row.score.seed_block_standard_error, 4)} SE; active ` +
      `${row.action_set.active_cells}; return/terminal/other ` +
      `${row.mechanism.fallback_returns}/${row.mechanism.terminal_reached}/` +
      `${row.mechanism.other_outcomes}`,
  );
  console.log(
    `     active ${signed(row.action_set.active_score.mean_delta_per_cell, 4)}; ` +
      `return cohort ${signed(row.mechanism.fallback_return_score.mean_delta_per_cell, 4)}; ` +
      `seed blocks ${row.gate.positive_seed_blocks}; repair displacement ` +
      `${signed(row.repair.displaced_frames, 0)} frames/` +
      `${signed(row.repair.displaced_attempts, 0)} attempts`,
  );
}
console.log(`first-terminal identity ${exactFirstTerminalIdentity ? "PASS" : "FAIL"}`);
console.log(
  `${budgets.length === 2 ? "gate" : "screen"} ` +
    `${budgets.length !== 2 ? "INCOMPLETE" : screenPassed ? "PASS" : "CLOSE"}: ` +
    `${result.continuation_gate.consequence}`,
);
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
  const gate = attempt.pass_frontier_gate;
  if (
    gate === null ||
    attempt.prefix_gate !== null ||
    attempt.progress_checkpoints.length !== attempt.nodes_processed ||
    attempt.atomic_node_frames.length !== attempt.nodes_processed ||
    attempt.progress_checkpoints.some((checkpoint: any) =>
      checkpoint.frontier_lane !== "pass" || checkpoint.skipped_contacts !== 0
    ) ||
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
    : attempt.outcome === "fallback_frontier_return"
      ? "fallback_frontier_return"
      : attempt.outcome === "frontier_exhausted"
        ? "frontier_exhausted"
        : "local_ceiling";
  if (episode.outcome.stop_reason !== expectedStop) {
    throw new Error(`${label}: episode stop reason misattributes action outcome`);
  }
  if (gate.decision === "not_reached") {
    if (gate.checkpoint !== null || attempt.outcome === "fallback_frontier_return") {
      throw new Error(`${label}: not-reached pass gate has a return checkpoint`);
    }
  } else {
    const checkpoint = gate.checkpoint;
    if (
      gate.decision !== "fallback_return" ||
      checkpoint === null ||
      attempt.outcome !== "fallback_frontier_return" ||
      checkpoint.selection_ordinal !== attempt.nodes_processed + 1 ||
      checkpoint.selection_total_spent_frames !== attempt.end_total_spent_frames ||
      checkpoint.spent_frames_since_attempt_start !== episode.outcome.spent_frames ||
      checkpoint.remaining_local_allowance_frames !==
        attempt.execution_ceiling_frames - attempt.end_total_spent_frames ||
      checkpoint.skipped_contacts <= 0 ||
      checkpoint.local_pass_frontier_size !== 0 ||
      checkpoint.local_fallback_frontier_size <= 0 ||
      attempt.remaining_pass_nodes_returned !== 0 ||
      attempt.remaining_fallback_nodes_returned !==
        checkpoint.local_fallback_frontier_size ||
      attempt.terminal_node_evaluations !== 0
    ) throw new Error(`${label}: malformed or non-atomic fallback return`);
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
