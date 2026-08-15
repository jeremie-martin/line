/**
 * Trust, mechanism, and predeclared continuation-gate analysis for the first
 * live value-ranked selective-DFS arm. This is compact-panel evidence, not a
 * Benchmark V2 promotion decision.
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
const expectedPolicy = argument("policy") ??
  "selective_axis_regret_catchup_value_initial";
if (
  expectedPolicy !== "selective_axis_regret_catchup_value_initial" &&
  expectedPolicy !== "selective_axis_regret_catchup_value_initial_progress_10"
) throw new Error(`unsupported value-ranked live policy ${expectedPolicy}`);
const expectedMinimumGapProgress =
  expectedPolicy === "selective_axis_regret_catchup_value_initial_progress_10" ? 0.10 : 0;

const candidate = readGridArm("value-initial", candidatePath);
const reference = readGridArm("reference", referencePath);
assertPairedArms(candidate, reference);
const candidateRows = rowsByKey(candidate);
const referenceRows = rowsByKey(reference);
const budgets = [...new Set([...candidate.cells.values()].map((cell) => cell.budget))]
  .sort((a, b) => a - b);
if (budgets.length !== 2) throw new Error("value-ranked live screen requires two budgets");

const byBudget = Object.fromEntries(budgets.map((budget) => {
  const pairs = [...candidate.cells.values()]
    .filter((cell) => cell.budget === budget)
    .map((cell) => {
      const key = gridCellKey(cell.sourceId, cell.budget, cell.seed);
      const before = reference.cells.get(key);
      if (before === undefined) throw new Error(`reference is missing ${key}`);
      return { candidate: cell, ref: before, key };
    });
  const rows = pairs.map((pair) => candidateRows.get(pair.key)!);
  const refRows = pairs.map((pair) => referenceRows.get(pair.key)!);
  const mechanics = summarizeAndValidateMechanics(rows);
  const score = summarizeScore(pairs);
  const actionSet = summarizeActionSet(pairs, rows);
  const repair = summarizeRepair(rows, refRows);
  return [String(budget), {
    cells: pairs.length,
    score,
    action_set: actionSet,
    mechanics,
    first_terminal: summarizeFirstTerminal(pairs),
    repair,
    gate: {
      all_candidate_cells_valid: pairs.every((pair) => pair.candidate.valid),
      positive_total_score: score.sum_delta > 0,
      positive_seed_blocks: score.seed_blocks.filter((block: any) => block.mean_delta > 0).length,
      positive_active_mean: actionSet.active.mean_delta_per_cell > 0,
      no_cell_loses_20: score.minimum_cell_delta > -20,
      action_spans_eight_runs: mechanics.active_runs >= 8,
      action_spans_four_sources: mechanics.active_sources >= 4,
    },
  }];
}));

const budgetRows = budgets.map((budget) => byBudget[String(budget)] as any);
const positiveSeedBlocks = budgetRows.map((row) => row.gate.positive_seed_blocks);
const screenPassed = budgetRows.every((row) =>
  row.gate.all_candidate_cells_valid &&
  row.gate.positive_total_score &&
  row.gate.positive_active_mean &&
  row.gate.no_cell_loses_20 &&
  row.gate.action_spans_eight_runs &&
  row.gate.action_spans_four_sources
) && Math.max(...positiveSeedBlocks) >= 3 && Math.min(...positiveSeedBlocks) >= 2;

const result = {
  schema: "line.value-ranked-selective-dfs-live-analysis.v1",
  generated_at: new Date().toISOString(),
  scope: {
    budgets,
    seeds: candidate.archive.seeds,
    sources: [...new Set([...candidate.cells.values()].map((cell) => cell.sourceId))].sort(),
    cells: candidate.cells.size,
    interpretation:
      "Matched compact-panel screen of the predeclared initial-only density-0.020 rule; not canonical evidence.",
  },
  contract: {
    expected_policy: expectedPolicy,
    expected_lane: "initial",
    density_threshold: 0.02,
    minimum_gap_progress: expectedMinimumGapProgress,
    terminal_reserve_factor: 1.25,
    exploration_budget_fraction: 0.15,
    speculative_tail_completion_inside_value_probe: false,
  },
  by_budget: byBudget,
  continuation_gate: {
    positive_seed_blocks_by_budget: Object.fromEntries(
      budgets.map((budget, index) => [String(budget), positiveSeedBlocks[index]]),
    ),
    passed: screenPassed,
    consequence: screenPassed
      ? "The exact rule merits one fresh confirmation panel; it is not promoted."
      : "Close the exact rule without confirmation or canonical Benchmark V2.",
  },
};

printResult(result);
if (outPath !== undefined) {
  const absolute = resolve(outPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`\nanalysis ${absolute}`);
}

function required(name: string): string {
  const value = argument(name);
  if (value === undefined || value === "") {
    throw new Error(
      "usage: --candidate=<archive> --reference=<archive> [--policy=<policy>] [--out=<json>]",
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

function summarizeAndValidateMechanics(rows: any[]): any {
  const totals = {
    active_runs: 0,
    active_sources: 0,
    crossings: 0,
    admitted: 0,
    ranked_out: 0,
    production_priority: 0,
    alternative_unavailable: 0,
    execution_ceiling_suppressed: 0,
    terminal_reserve_suppressed: 0,
    exploration_allowance_suppressed: 0,
    probe_frames: 0,
    probe_nodes_processed: 0,
    budget_yields: 0,
    target_reaches: 0,
    alternative_selected: 0,
    current_selected: 0,
    probe_dead_ends: 0,
    probe_deferred: 0,
    requested_normal_proposals: 0,
    ranked_option_calls: 0,
    candidate_geometry_evaluations: 0,
    tail_completion_attempts: 0,
    estimated_probe_frames: 0,
    absolute_probe_estimation_error_frames: 0,
    local_allowance_overshoots: 0,
    bounded_overshoots_with_prefix_beyond_allowance: 0,
  };
  const activeSources = new Set<string>();
  for (const row of rows) {
    const label = `${row.task.sourceId}/${row.task.budget}/${row.task.actualSeed}`;
    const stats = row.stats?.handoff_selective_backtracking;
    if (stats?.policy !== expectedPolicy) {
      throw new Error(`${label}: unexpected policy ${String(stats?.policy)}`);
    }
    if (stats.value_live_density_threshold !== 0.02) {
      throw new Error(`${label}: unexpected live density threshold`);
    }
    if ((stats.value_live_min_gap_progress ?? 0) !== expectedMinimumGapProgress) {
      throw new Error(`${label}: unexpected minimum gap progress`);
    }
    const opportunities = stats.value_live_opportunities ?? [];
    const events = (stats.events ?? []).filter(
      (event: any) => event.trigger_signal === "value_exploration",
    );
    const counts = countBy(opportunities, (opportunity: any) => opportunity.outcome);
    const expectedCounters: Record<string, string> = {
      admitted: "value_live_admitted",
      ranked_out: "value_live_ranked_out",
      production_priority: "value_live_production_priority",
      alternative_unavailable: "value_live_alternative_unavailable",
      execution_ceiling: "value_live_execution_ceiling_suppressed",
      terminal_reserve: "value_live_terminal_reserve_suppressed",
      exploration_allowance: "value_live_exploration_allowance_suppressed",
    };
    if (stats.value_live_crossings !== opportunities.length) {
      throw new Error(`${label}: live crossing ledger mismatch`);
    }
    for (const [outcome, counter] of Object.entries(expectedCounters)) {
      if ((counts[outcome] ?? 0) !== (stats[counter] ?? 0)) {
        throw new Error(`${label}: live ${outcome} ledger mismatch`);
      }
    }
    if (
      events.length !== stats.value_live_admitted ||
      events.length !== stats.selective_backtracks_by_signal?.value_exploration
    ) {
      throw new Error(`${label}: live action ledger mismatch`);
    }
    const admittedByWatch = new Map(opportunities
      .filter((opportunity: any) => opportunity.outcome === "admitted")
      .map((opportunity: any) => [opportunity.watch_id, opportunity]));
    for (const event of events) {
      const opportunity: any = admittedByWatch.get(event.watch_id);
      const budget = event.value_budget;
      if (
        opportunity === undefined || event.lane !== "initial" ||
        event.periodic_budget !== null || budget?.admitted !== true ||
        budget.reason !== "admitted" || event.repair_attempt_index !== null
      ) {
        throw new Error(`${label}: value action violates lane or admission contract`);
      }
      if (
        expectedMinimumGapProgress > 0 &&
        !(opportunity.point.gap_progress >= expectedMinimumGapProgress)
      ) {
        throw new Error(`${label}: value action precedes its gap-progress boundary`);
      }
      const expectedAllowance = Math.min(
        budget.exploration_remaining_frames,
        Math.max(0, budget.execution_remaining_frames - budget.terminal_reserve_frames),
      );
      if (
        budget.local_probe_allowance_frames !== expectedAllowance ||
        budget.estimated_probe_work_frames > expectedAllowance
      ) {
        throw new Error(`${label}: value local allowance arithmetic mismatch`);
      }
      if (
        opportunity.point.branch_gap_index !== event.branch_gap_index ||
        opportunity.point.from_gap_index !== event.from_gap_index ||
        opportunity.point.value_density_per_10k_estimated_frames < 0.02
      ) {
        throw new Error(`${label}: admitted opportunity does not match its action`);
      }
      totals.estimated_probe_frames += budget.estimated_probe_work_frames;
      totals.absolute_probe_estimation_error_frames += Math.abs(
        event.catchup_probe_frames - budget.estimated_probe_work_frames,
      );
      for (const probe of event.catchup_probe_results ?? []) {
        if (probe.tail_completion_attempts !== 0) {
          throw new Error(`${label}: speculative tail completion ran inside value probe`);
        }
        if (sum(probe.atomic_node_frames ?? []) !== probe.probe_frames) {
          throw new Error(`${label}: atomic probe-frame ledger mismatch`);
        }
        if (probe.outcome === "probe_budget_yield") {
          if (!(probe.estimated_next_node_frames > probe.budget_remaining_before_yield)) {
            throw new Error(`${label}: budget yield has no binding next-node estimate`);
          }
        } else if (
          probe.budget_remaining_before_yield !== null ||
          probe.estimated_next_node_frames !== null
        ) {
          throw new Error(`${label}: non-yield probe carries yield telemetry`);
        }
        const allowance = probe.budget_allowance_frames;
        if (allowance !== budget.local_probe_allowance_frames) {
          throw new Error(`${label}: probe lost action allowance`);
        }
        if (probe.probe_frames > allowance) {
          totals.local_allowance_overshoots++;
          const beforeFinalAtomic = sum((probe.atomic_node_frames ?? []).slice(0, -1));
          if (beforeFinalAtomic > allowance) {
            totals.bounded_overshoots_with_prefix_beyond_allowance++;
          }
        }
      }
    }
    const probeFrames = sum(events.map((event: any) => event.catchup_probe_frames));
    const probeNodes = sum(events.map((event: any) => event.catchup_probe_nodes_processed));
    if (
      probeFrames !== stats.value_live_probe_frames ||
      probeNodes !== stats.value_live_probe_nodes_processed
    ) {
      throw new Error(`${label}: value probe aggregate mismatch`);
    }
    const probes = events.flatMap((event: any) => event.catchup_probe_results ?? []);
    const yields = probes.filter((probe: any) => probe.outcome === "probe_budget_yield").length;
    if (yields !== stats.value_live_probe_budget_yields) {
      throw new Error(`${label}: value budget-yield ledger mismatch`);
    }
    if (events.length > 0) {
      totals.active_runs++;
      activeSources.add(row.task.sourceId);
    }
    totals.crossings += stats.value_live_crossings;
    totals.admitted += stats.value_live_admitted;
    totals.ranked_out += stats.value_live_ranked_out;
    totals.production_priority += stats.value_live_production_priority;
    totals.alternative_unavailable += stats.value_live_alternative_unavailable;
    totals.execution_ceiling_suppressed += stats.value_live_execution_ceiling_suppressed;
    totals.terminal_reserve_suppressed += stats.value_live_terminal_reserve_suppressed;
    totals.exploration_allowance_suppressed +=
      stats.value_live_exploration_allowance_suppressed;
    totals.probe_frames += probeFrames;
    totals.probe_nodes_processed += probeNodes;
    totals.budget_yields += yields;
    totals.target_reaches += probes.filter((probe: any) => probe.outcome === "reached_target").length;
    totals.alternative_selected += events.filter(
      (event: any) => event.catchup_outcome === "alternative_selected",
    ).length;
    totals.current_selected += events.filter(
      (event: any) => event.catchup_outcome === "current_selected",
    ).length;
    totals.probe_dead_ends += probes.filter((probe: any) => probe.outcome === "probe_dead_end").length;
    totals.probe_deferred += probes.filter((probe: any) => probe.outcome === "probe_deferred").length;
    totals.requested_normal_proposals += sum(
      probes.map((probe: any) => probe.requested_normal_proposals),
    );
    totals.ranked_option_calls += sum(probes.map((probe: any) => probe.ranked_option_calls));
    totals.candidate_geometry_evaluations += sum(
      probes.map((probe: any) => probe.candidate_geometry_evaluations),
    );
    totals.tail_completion_attempts += sum(
      probes.map((probe: any) => probe.tail_completion_attempts),
    );
  }
  totals.active_sources = activeSources.size;
  if (totals.bounded_overshoots_with_prefix_beyond_allowance !== 0) {
    throw new Error("value probe began atomic work after exhausting its local allowance");
  }
  return {
    ...totals,
    actual_to_estimated_probe_frames_ratio: totals.estimated_probe_frames === 0
      ? null
      : totals.probe_frames / totals.estimated_probe_frames,
    mean_absolute_probe_estimation_error_frames: totals.admitted === 0
      ? null
      : totals.absolute_probe_estimation_error_frames / totals.admitted,
    mean_requested_normal_proposals_per_ranked_option_call:
      totals.ranked_option_calls === 0
        ? null
        : totals.requested_normal_proposals / totals.ranked_option_calls,
  };
}

function summarizeScore(pairs: Array<{ candidate: GridCell; ref: GridCell }>): any {
  const deltas = pairs.map((pair) => pair.candidate.score - pair.ref.score);
  const bySeed = new Map<number, number[]>();
  for (const pair of pairs) {
    const values = bySeed.get(pair.candidate.seed) ?? [];
    values.push(pair.candidate.score - pair.ref.score);
    bySeed.set(pair.candidate.seed, values);
  }
  const seedBlocks = [...bySeed.entries()].sort((a, b) => a[0] - b[0])
    .map(([seed, values]) => ({ seed, mean_delta: mean(values) }));
  return {
    sum_delta: sum(deltas),
    mean_delta_per_cell: mean(deltas),
    seed_block_standard_error: standardError(seedBlocks.map((block) => block.mean_delta)),
    seed_blocks: seedBlocks,
    minimum_cell_delta: deltas.length === 0 ? null : Math.min(...deltas),
    improved: deltas.filter((delta) => delta > 0).length,
    regressed: deltas.filter((delta) => delta < 0).length,
    tied: deltas.filter((delta) => delta === 0).length,
    changed_tracks: pairs.filter((pair) => pair.candidate.trackHash !== pair.ref.trackHash).length,
    reference_only_valid: pairs.filter((pair) => pair.ref.valid && !pair.candidate.valid).length,
    candidate_only_valid: pairs.filter((pair) => !pair.ref.valid && pair.candidate.valid).length,
  };
}

function summarizeActionSet(
  pairs: Array<{ candidate: GridCell; ref: GridCell; key: string }>,
  rows: any[],
): any {
  const activeKeys = new Set(rows.filter((row) =>
    (row.stats?.handoff_selective_backtracking?.events ?? []).some(
      (event: any) => event.trigger_signal === "value_exploration",
    )
  ).map((row) => gridCellKey(row.task.sourceId, row.task.budget, row.task.actualSeed)));
  const active = pairs.filter((pair) => activeKeys.has(pair.key));
  const inactive = pairs.filter((pair) => !activeKeys.has(pair.key));
  const inactiveScore = summarizeScore(inactive);
  if (inactiveScore.changed_tracks !== 0) {
    throw new Error("inactive value-ranked cells are not track-identical to reference");
  }
  return {
    active_cells: active.length,
    active: summarizeScore(active),
    inactive_cells: inactive.length,
    inactive: inactiveScore,
  };
}

function summarizeFirstTerminal(
  pairs: Array<{ candidate: GridCell; ref: GridCell }>,
): any {
  const deltas = pairs.flatMap((pair) =>
    pair.candidate.firstCompletionFrame === null || pair.ref.firstCompletionFrame === null
      ? []
      : [pair.candidate.firstCompletionFrame - pair.ref.firstCompletionFrame]
  );
  return {
    jointly_observed: deltas.length,
    mean_delta_frames: deltas.length === 0 ? null : mean(deltas),
    delayed: deltas.filter((delta) => delta > 0).length,
    accelerated: deltas.filter((delta) => delta < 0).length,
    tied: deltas.filter((delta) => delta === 0).length,
  };
}

function summarizeRepair(candidateRows: any[], referenceRows: any[]): any {
  const read = (rows: any[]) => {
    const episodes = rows.flatMap((row) => row.budgetTelemetry?.episodes ?? [])
      .filter((episode: any) => episode.lane === "repair");
    return {
      attempts: episodes.length,
      terminal_reached: episodes.filter((episode: any) => episode.outcome.terminal_reached).length,
      accepted: episodes.filter((episode: any) => episode.outcome.accepted_alternative).length,
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

function countBy<T>(values: T[], keyOf: (value: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) {
    const key = keyOf(value);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
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

function printResult(value: any): void {
  console.log(`VALUE-RANKED SELECTIVE DFS LIVE  ${value.scope.cells} cells`);
  for (const budget of value.scope.budgets) {
    const row = value.by_budget[String(budget)];
    console.log(
      `${budget / 1000}k score ${signed(row.score.mean_delta_per_cell, 4)} +/- ` +
        `${format(row.score.seed_block_standard_error, 4)} SE; ` +
        `${row.mechanics.admitted} actions in ${row.mechanics.active_runs} runs/` +
        `${row.mechanics.active_sources} sources; ${row.mechanics.probe_frames} frames`,
    );
    console.log(
      `     winner alt/current ${row.mechanics.alternative_selected}/` +
        `${row.mechanics.current_selected}; yields ${row.mechanics.budget_yields}; ` +
        `first terminal ${signedNullable(row.first_terminal.mean_delta_frames, 0)} frames; ` +
        `active mean ${signed(row.action_set.active.mean_delta_per_cell, 4)}`,
    );
  }
  console.log(
    `gate ${value.continuation_gate.passed ? "PASS" : "CLOSE"}: ` +
      value.continuation_gate.consequence,
  );
}

function signed(value: number, digits: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function signedNullable(value: number | null, digits: number): string {
  return value === null ? "n/a" : signed(value, digits);
}

function format(value: number | null, digits: number): string {
  return value === null ? "n/a" : value.toFixed(digits);
}
