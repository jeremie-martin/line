/**
 * Trust, mechanism, and predeclared continuation gate for the first live
 * post-terminal deferred-value suffix arm. This compact panel is screening
 * evidence, never a canonical Benchmark V2 promotion decision.
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
const allowanceFraction = 0.40;

const candidate = readGridArm("deferred-value-live", candidatePath);
const reference = readGridArm("reference", referencePath);
assertPairedArms(candidate, reference);
const candidateRows = rowsByKey(candidate);
const referenceRows = rowsByKey(reference);
const budgets = [...new Set([...candidate.cells.values()].map((cell) => cell.budget))]
  .sort((a, b) => a - b);
if (budgets.length !== 2) throw new Error("deferred-value live screen requires two budgets");

let exactFirstTerminalFrames = 0;
let exactFirstTerminalHashes = 0;
const byBudget = Object.fromEntries(budgets.map((budget) => {
  const pairs = [...candidate.cells.values()]
    .filter((cell) => cell.budget === budget)
    .map((cell) => {
      const key = gridCellKey(cell.sourceId, cell.budget, cell.seed);
      const ref = reference.cells.get(key);
      const row = candidateRows.get(key);
      const refRow = referenceRows.get(key);
      if (ref === undefined || row === undefined || refRow === undefined) {
        throw new Error(`missing deferred-value pair ${key}`);
      }
      if (
        (row.stats?.first_completion_frame ?? null) ===
          (refRow.stats?.first_completion_frame ?? null)
      ) exactFirstTerminalFrames++;
      if (
        (row.stats?.handoff_first_terminal_track_hash ?? null) ===
          (refRow.stats?.handoff_first_terminal_track_hash ?? null)
      ) exactFirstTerminalHashes++;
      const mechanism = validateMechanism(row);
      return { candidate: cell, ref, row, refRow, key, mechanism };
    });
  const activePairs = pairs.filter((pair) => pair.mechanism.attempt !== null);
  const inactivePairs = pairs.filter((pair) => pair.mechanism.attempt === null);
  const score = summarizeScore(pairs);
  const activeScore = summarizeScore(activePairs);
  const inactiveScore = summarizeScore(inactivePairs);
  if (inactiveScore.changed_tracks !== 0 || inactiveScore.sum_delta !== 0) {
    throw new Error(`${budget}: action-free cells changed production output`);
  }
  const attempts = activePairs.map((pair) => pair.mechanism.attempt!);
  const activeSources = new Set(activePairs.map((pair) => pair.candidate.sourceId));
  const episodeWork = activePairs.map((pair) => pair.mechanism.episode);
  const repair = summarizeRepair(
    pairs.map((pair) => pair.row),
    pairs.map((pair) => pair.refRow),
  );
  const positiveSeedBlocks = score.seed_blocks.filter((block) => block.mean_delta > 0).length;
  return [String(budget), {
    cells: pairs.length,
    score,
    action_set: {
      active_cells: activePairs.length,
      active_sources: activeSources.size,
      active: activeScore,
      inactive_cells: inactivePairs.length,
      inactive: inactiveScore,
    },
    mechanism: {
      selected_attempts: attempts.length,
      terminal_reached: attempts.filter((attempt) =>
        attempt.outcome === "terminal_reached"
      ).length,
      atomic_budget_yields: attempts.filter((attempt) =>
        attempt.outcome === "atomic_budget_yield"
      ).length,
      frontier_exhausted: attempts.filter((attempt) =>
        attempt.outcome === "frontier_exhausted"
      ).length,
      execution_ceiling: attempts.filter((attempt) =>
        attempt.outcome === "execution_ceiling"
      ).length,
      register_improved: attempts.filter((attempt) =>
        attempt.register_improvements > 0
      ).length,
      terminal_register_improved: attempts.filter((attempt) =>
        attempt.terminal_register_improvements > 0
      ).length,
      spent_frames: summarizeNumbers(episodeWork.map((episode) =>
        episode.outcome.spent_frames ?? 0
      )),
      estimate_ratio: summarizeNumbers(attempts.map((attempt) =>
        (attempt.end_total_spent_frames - attempt.start_total_spent_frames) /
          Math.max(1, attempt.estimated_suffix_work_frames)
      )),
      nodes_processed: sum(attempts.map((attempt) => attempt.nodes_processed)),
      atomic_node_frames: summarizeNumbers(attempts.flatMap((attempt) =>
        attempt.atomic_node_frames
      )),
      requested_normal_proposals: sum(attempts.map((attempt) =>
        attempt.requested_normal_proposals
      )),
      candidate_geometry_evaluations: sum(attempts.map((attempt) =>
        attempt.candidate_geometry_evaluations
      )),
      tail_completion_attempts: sum(attempts.map((attempt) =>
        attempt.tail_completion_attempts
      )),
      returned_frontier_nodes: sum(attempts.map((attempt) =>
        attempt.remaining_pass_nodes_returned + attempt.remaining_fallback_nodes_returned
      )),
    },
    repair,
    gate: {
      all_candidate_cells_valid: pairs.every((pair) => pair.candidate.valid),
      positive_total_mean: score.mean_delta_per_cell > 0,
      positive_active_mean: activePairs.length > 0 && activeScore.mean_delta_per_cell > 0,
      positive_seed_blocks: positiveSeedBlocks,
      no_cell_loses_20: score.minimum_cell_delta !== null && score.minimum_cell_delta > -20,
      actions_span_eight_runs: activePairs.length >= 8,
      actions_span_four_sources: activeSources.size >= 4,
    },
  }];
}));

const exactFirstTerminalIdentity =
  exactFirstTerminalFrames === candidate.cells.size &&
  exactFirstTerminalHashes === candidate.cells.size;
const rows = budgets.map((budget) => byBudget[String(budget)] as any);
const positiveSeedBlocks = rows.map((row) => row.gate.positive_seed_blocks);
const screenPassed = exactFirstTerminalIdentity && rows.every((row) =>
  row.gate.all_candidate_cells_valid &&
  row.gate.positive_total_mean &&
  row.gate.positive_active_mean &&
  row.gate.no_cell_loses_20 &&
  row.gate.actions_span_eight_runs &&
  row.gate.actions_span_four_sources
) && Math.max(...positiveSeedBlocks) >= 3 && Math.min(...positiveSeedBlocks) >= 2;

const result = {
  schema: "line.deferred-value-suffix-live-analysis.v1",
  generated_at: new Date().toISOString(),
  scope: {
    budgets,
    seeds: candidate.archive.seeds,
    sources: [...new Set([...candidate.cells.values()].map((cell) => cell.sourceId))].sort(),
    cells: candidate.cells.size,
    interpretation:
      "Matched compact-panel screen of one score-blind post-terminal suffix action; not canonical evidence.",
  },
  contract: {
    expected_policy: expectedPolicy,
    collection_lane: "initial",
    execution_lane: "deferred_value",
    density_threshold: 0.02,
    minimum_gap_progress: 0.10,
    allowance_fraction: allowanceFraction,
    maximum_attempts_per_compile: 1,
    speculative_tail_completion: false,
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
      budgets.map((budget, index) => [String(budget), positiveSeedBlocks[index]]),
    ),
    passed: screenPassed,
    consequence: screenPassed
      ? "Run the one predeclared fresh confirmation panel; do not promote yet."
      : "Close this exact deferred-value suffix rule without confirmation or canonical V2.",
  },
};

console.log(`DEFERRED VALUE SUFFIX LIVE  ${result.scope.cells} cells`);
for (const budget of budgets) {
  const row = byBudget[String(budget)]!;
  console.log(
    `${budget / 1000}k score ${signed(row.score.mean_delta_per_cell, 4)} +/- ` +
      `${format(row.score.seed_block_standard_error, 4)} SE; ` +
      `${row.mechanism.selected_attempts} actions in ` +
      `${row.action_set.active_sources} sources; terminal/improved ` +
      `${row.mechanism.terminal_reached}/${row.mechanism.terminal_register_improved}`,
  );
  console.log(
    `     active ${signed(row.action_set.active.mean_delta_per_cell, 4)}; ` +
      `yields ${row.mechanism.atomic_budget_yields}; ` +
      `repair displacement ${signed(row.repair.displaced_frames, 0)} frames/` +
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

function required(name: string): string {
  const value = argument(name);
  if (value === undefined || value === "") {
    throw new Error("usage: --candidate=<archive> --reference=<archive> [--out=<json>]");
  }
  return value;
}

function rowsByKey(arm: GridArm): Map<string, any> {
  return new Map(arm.archive.runs.map((row: any) => [
    gridCellKey(row.task.sourceId, row.task.budget, row.task.actualSeed),
    row,
  ]));
}

function validateMechanism(row: any): { attempt: any | null; episode: any | null } {
  const label = `${row.task.sourceId}/${row.task.budget}/${row.task.actualSeed}`;
  const stats = row.stats?.handoff_selective_backtracking;
  if (stats?.policy !== expectedPolicy) {
    throw new Error(`${label}: unexpected policy ${String(stats?.policy)}`);
  }
  if (
    stats.deferred_value_density_threshold !== 0.02 ||
    stats.deferred_value_min_gap_progress !== 0.10 ||
    stats.deferred_value_map_max_allowance_fraction !== allowanceFraction ||
    stats.selective_backtracks_by_signal?.value_exploration !== 0
  ) throw new Error(`${label}: live deferred-value contract mismatch`);
  const attempts = stats.deferred_value_attempts ?? [];
  if (attempts.length > 1) throw new Error(`${label}: more than one deferred attempt`);
  const episodes = (row.budgetTelemetry?.episodes ?? []).filter((episode: any) =>
    episode.lane === "deferred_value"
  );
  const segments = (row.budgetTelemetry?.execution_intervals ?? []).filter((segment: any) =>
    segment.kind === "deferred_value_suffix"
  );
  if (attempts.length !== episodes.length || attempts.length !== segments.length) {
    throw new Error(`${label}: deferred attempt/episode/segment attribution mismatch`);
  }
  if (attempts.length === 0) return { attempt: null, episode: null };
  const attempt = attempts[0]!;
  const episode = episodes[0]!;
  const segment = segments[0]!;
  const opportunity = (stats.deferred_value_opportunities ?? []).find((value: any) =>
    value.watch_id === attempt.watch_id && value.terminal?.affordable_rank === 1
  );
  const expectedStop = attempt.outcome === "terminal_reached"
    ? "first_terminal_return"
    : attempt.outcome === "frontier_exhausted" ? "frontier_exhausted" : "local_ceiling";
  if (
    opportunity === undefined ||
    attempt.affordable_rank !== 1 ||
    attempt.tail_completion_attempts !== 0 ||
    attempt.start_total_spent_frames !== episode.start_total_spent_frames ||
    attempt.end_total_spent_frames !== episode.outcome.end_total_spent_frames ||
    attempt.execution_ceiling_frames !== episode.ceiling_total_spent_frames ||
    attempt.local_allowance_frames !== episode.allocated_frames ||
    attempt.start_gap_index !== episode.anchor.gap_index ||
    episode.ceiling_source !== "deferred_value_allowance" ||
    episode.outcome.stop_reason !== expectedStop ||
    episode.work.nodes_processed !== attempt.nodes_processed ||
    attempt.atomic_node_frames.length !== attempt.nodes_processed ||
    sum(attempt.atomic_node_frames) !== episode.outcome.spent_frames ||
    episode.work.ranked_option_calls !== attempt.ranked_option_calls ||
    episode.work.requested_normal_proposals !== attempt.requested_normal_proposals ||
    episode.work.actual_candidate_samples !== attempt.candidate_geometry_evaluations ||
    episode.work.terminal_node_evaluations !== attempt.terminal_node_evaluations ||
    episode.work.register_improvements !== attempt.register_improvements ||
    episode.work.terminal_register_improvements !== attempt.terminal_register_improvements ||
    episode.work.by_evaluation_origin?.tail_completion?.register_offers !== 0 ||
    segment.episode_id !== episode.episode_id ||
    segment.start_total_spent_frames !== attempt.start_total_spent_frames ||
    segment.end_total_spent_frames !== attempt.end_total_spent_frames ||
    segment.stop_reason !== attempt.outcome ||
    (attempt.outcome === "terminal_reached") !== episode.outcome.terminal_reached ||
    (attempt.outcome === "atomic_budget_yield") !==
      (attempt.budget_remaining_before_yield !== null)
  ) throw new Error(`${label}: deferred execution ledger mismatch`);
  return { attempt, episode };
}

function summarizeScore<T extends { candidate: GridCell; ref: GridCell }>(pairs: T[]): any {
  const deltas = pairs.map((pair) => pair.candidate.score - pair.ref.score);
  const bySeed = new Map<number, number[]>();
  for (let index = 0; index < pairs.length; index++) {
    const seed = pairs[index]!.candidate.seed;
    const values = bySeed.get(seed) ?? [];
    values.push(deltas[index]!);
    bySeed.set(seed, values);
  }
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
    changed_tracks: pairs.filter((pair) =>
      pair.candidate.trackHash !== pair.ref.trackHash
    ).length,
    worst_cells: pairs.map((pair, index) => ({
      source_id: pair.candidate.sourceId,
      seed: pair.candidate.seed,
      delta: deltas[index],
    })).sort((a, b) => a.delta! - b.delta!).slice(0, 5),
  };
}

function summarizeRepair(candidateRows: any[], referenceRows: any[]): any {
  const read = (rows: any[]) => {
    const episodes = rows.flatMap((row) => row.budgetTelemetry?.episodes ?? [])
      .filter((episode: any) => episode.lane === "repair");
    return {
      attempts: episodes.length,
      terminal_reached: episodes.filter((episode: any) =>
        episode.outcome.terminal_reached
      ).length,
      accepted: episodes.filter((episode: any) =>
        episode.outcome.accepted_alternative
      ).length,
      frames: sum(episodes.map((episode: any) => episode.outcome.spent_frames ?? 0)),
    };
  };
  const candidate = read(candidateRows);
  const reference = read(referenceRows);
  return {
    candidate,
    reference,
    displaced_frames: candidate.frames - reference.frames,
    displaced_attempts: candidate.attempts - reference.attempts,
    displaced_accepted: candidate.accepted - reference.accepted,
  };
}

function summarizeNumbers(values: number[]): any {
  return {
    count: values.length,
    min: values.length === 0 ? null : Math.min(...values),
    mean: values.length === 0 ? null : mean(values),
    max: values.length === 0 ? null : Math.max(...values),
  };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

function standardError(values: number[]): number | null {
  if (values.length < 2) return null;
  const center = mean(values);
  const variance = sum(values.map((value) => (value - center) ** 2)) /
    (values.length - 1);
  return Math.sqrt(variance / values.length);
}

function signed(value: number, digits: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function format(value: number | null, digits: number): string {
  return value === null ? "n/a" : value.toFixed(digits);
}
