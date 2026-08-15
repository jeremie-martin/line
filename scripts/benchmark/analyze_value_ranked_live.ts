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
  expectedPolicy !== "selective_axis_regret_catchup_value_initial_progress_10" &&
  expectedPolicy !== "selective_axis_regret_catchup_value_initial_expire_10" &&
  expectedPolicy !==
    "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q" &&
  expectedPolicy !==
    "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_positive_prefix" &&
  expectedPolicy !==
    "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_nonpositive_prefix" &&
  expectedPolicy !==
    "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_no_refill" &&
  expectedPolicy !== "selective_axis_regret_catchup_value_initial_expire_10_run_proof"
) throw new Error(`unsupported value-ranked live policy ${expectedPolicy}`);
const expectedMinimumGapProgress =
  expectedPolicy === "selective_axis_regret_catchup_value_initial" ? 0 : 0.10;
const runProofEnabled =
  expectedPolicy === "selective_axis_regret_catchup_value_initial_expire_10_run_proof";
const expirationEnabled =
  expectedPolicy === "selective_axis_regret_catchup_value_initial_expire_10" ||
  expectedPolicy ===
    "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q" ||
  expectedPolicy ===
    "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_positive_prefix" ||
  expectedPolicy ===
    "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_nonpositive_prefix" ||
  expectedPolicy ===
    "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_no_refill" ||
  runProofEnabled;
const expectedExplorationBudgetFraction = expectedPolicy ===
    "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_no_refill"
  ? 0.1125
  : 0.15;
const expectedUniformNarrowBreadth = expectedPolicy ===
    "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q" ||
  expectedPolicy ===
    "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_no_refill";

const candidate = readGridArm("value-initial", candidatePath);
const reference = readGridArm("reference", referencePath);
assertPairedArms(candidate, reference);
const candidateRows = rowsByKey(candidate);
const referenceRows = rowsByKey(reference);
const budgets = [...new Set([...candidate.cells.values()].map((cell) => cell.budget))]
  .sort((a, b) => a - b);
if (budgets.length === 0) throw new Error("value-ranked analysis has no budgets");

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
      run_proof_seals_two_runs: !runProofEnabled || mechanics.run_proof_sealed_runs >= 2,
      run_proof_seals_two_sources: !runProofEnabled || mechanics.run_proof_sealed_sources >= 2,
    },
  }];
}));

const budgetRows = budgets.map((budget) => byBudget[String(budget)] as any);
const positiveSeedBlocks = budgetRows.map((row) => row.gate.positive_seed_blocks);
const twoBudgetScreen = budgets.length === 2;
const screenPassed = !twoBudgetScreen ? null : budgetRows.every((row) =>
  row.gate.all_candidate_cells_valid &&
  row.gate.positive_total_score &&
  row.gate.positive_active_mean &&
  row.gate.no_cell_loses_20 &&
  row.gate.action_spans_eight_runs &&
  row.gate.action_spans_four_sources &&
  row.gate.run_proof_seals_two_runs &&
  row.gate.run_proof_seals_two_sources
) && Math.max(...positiveSeedBlocks) >= 3 && Math.min(...positiveSeedBlocks) >= 2;

const result = {
  schema: "line.value-ranked-selective-dfs-live-analysis.v2",
  generated_at: new Date().toISOString(),
  scope: {
    budgets,
    seeds: candidate.archive.seeds,
    sources: [...new Set([...candidate.cells.values()].map((cell) => cell.sourceId))].sort(),
    cells: candidate.cells.size,
    interpretation:
      twoBudgetScreen
        ? "Matched compact-panel screen of the predeclared initial-only density-0.020 rule; not canonical evidence."
        : "Matched one-budget characterization of the initial-only density-0.020 rule; no continuation decision and not canonical evidence.",
  },
  contract: {
    expected_policy: expectedPolicy,
    expected_lane: "initial",
    density_threshold: 0.02,
    minimum_gap_progress: expectedMinimumGapProgress,
    terminal_reserve_factor: 1.25,
    exploration_budget_fraction: expectedExplorationBudgetFraction,
    pre_horizon_opportunity_behavior:
      expirationEnabled
        ? "expire"
        : expectedMinimumGapProgress > 0 ? "defer" : "eligible",
    run_proof:
      runProofEnabled
        ? "seal future value admissions when the first tournament reaches no equal-depth target"
        : "disabled",
    speculative_tail_completion_inside_value_probe: false,
  },
  by_budget: byBudget,
  continuation_gate: {
    applicable: twoBudgetScreen,
    positive_seed_blocks_by_budget: Object.fromEntries(
      budgets.map((budget, index) => [String(budget), positiveSeedBlocks[index]]),
    ),
    passed: screenPassed,
    consequence: screenPassed === null
      ? "Not applicable: one-budget mode is characterization only."
      : screenPassed
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
    progress_suppressed_watches: 0,
    progress_expired_watches: 0,
    run_proof_sealed_opportunities: 0,
    run_proof_sealed_runs: 0,
    run_proof_proved_runs: 0,
    run_proof_awaiting_runs: 0,
    run_proof_sealed_sources: 0,
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
  const bySource = new Map<string, {
    runs: number;
    active_runs: number;
    crossings: number;
    progress_expired_watches: number;
    run_proof_sealed_opportunities: number;
    run_proof_sealed_runs: number;
    run_proof_proved_runs: number;
    run_proof_awaiting_runs: number;
    admitted: number;
    probe_frames: number;
    alternative_selected: number;
    current_selected: number;
    probe_dead_ends: number;
  }>();
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
    if (
      stats.value_live_exploration_budget_fraction !==
        expectedExplorationBudgetFraction
    ) {
      throw new Error(`${label}: unexpected live exploration budget fraction`);
    }
    if (
      expectedUniformNarrowBreadth &&
      (stats.value_probe_candidate_breadth_rule !== "three_quarter_after_floor" ||
        stats.value_probe_candidate_breadth_scale !== 0.75)
    ) {
      throw new Error(`${label}: unexpected coupled probe-breadth contract`);
    }
    const opportunities = stats.value_live_opportunities ?? [];
    const expectedExplorationAllowance = Math.floor(
      expectedExplorationBudgetFraction * row.task.budget,
    );
    if (opportunities.some((opportunity: any) =>
      opportunity.point.budget.exploration_allowance_frames !==
        expectedExplorationAllowance
    )) {
      throw new Error(`${label}: live exploration allowance does not match its fraction`);
    }
    const events = (stats.events ?? []).filter(
      (event: any) => event.trigger_signal === "value_exploration",
    );
    const counts = countBy(opportunities, (opportunity: any) => opportunity.outcome);
    const expectedCounters: Record<string, string> = {
      admitted: "value_live_admitted",
      ranked_out: "value_live_ranked_out",
      production_priority: "value_live_production_priority",
      progress_expired: "value_live_progress_expired_watches",
      run_proof_sealed: "value_live_run_proof_sealed_opportunities",
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
    const expired = opportunities.filter(
      (opportunity: any) => opportunity.outcome === "progress_expired",
    );
    if (
      expired.some((opportunity: any) =>
        !(opportunity.point.gap_progress < expectedMinimumGapProgress)
      ) ||
      (expirationEnabled
        ? expired.length !== (stats.value_live_progress_expired_watches ?? 0)
        : expired.length !== 0)
    ) {
      throw new Error(`${label}: invalid pre-horizon expiration attribution`);
    }
    if (
      events.length !== stats.value_live_admitted ||
      events.length !== stats.selective_backtracks_by_signal?.value_exploration
    ) {
      throw new Error(`${label}: live action ledger mismatch`);
    }
    const proofState = stats.value_live_run_proof_state;
    const proofFirstEventIndex = stats.value_live_run_proof_first_event_index;
    const proofFirstOutcome = stats.value_live_run_proof_first_outcome;
    const proofFirstReachedTarget = stats.value_live_run_proof_first_reached_target;
    const sealedOpportunities = counts.run_proof_sealed ?? 0;
    if (runProofEnabled) {
      const firstValueEvent = events[0];
      if (firstValueEvent === undefined) {
        if (
          proofState !== "awaiting_first_tournament" ||
          proofFirstEventIndex !== null ||
          proofFirstOutcome !== null ||
          proofFirstReachedTarget !== null ||
          sealedOpportunities !== 0
        ) {
          throw new Error(`${label}: invalid awaiting run-proof state`);
        }
        totals.run_proof_awaiting_runs++;
      } else {
        const firstEventIndex = (stats.events ?? []).indexOf(firstValueEvent);
        const reachedTarget = (firstValueEvent.catchup_probe_results ?? []).some(
          (probe: any) => probe.outcome === "reached_target",
        );
        if (
          proofFirstEventIndex !== firstEventIndex ||
          proofFirstOutcome !== firstValueEvent.catchup_outcome ||
          proofFirstReachedTarget !== reachedTarget
        ) {
          throw new Error(`${label}: first run-proof event attribution mismatch`);
        }
        if (reachedTarget) {
          if (
            proofState !== "first_tournament_reached_target" ||
            sealedOpportunities !== 0
          ) {
            throw new Error(`${label}: reached run proof was not preserved`);
          }
          totals.run_proof_proved_runs++;
        } else {
          if (
            proofState !== "sealed_after_failed_first_tournament" ||
            events.length !== 1
          ) {
            throw new Error(`${label}: failed run proof did not seal later admissions`);
          }
          const firstAdmittedOpportunity = opportunities.findIndex(
            (opportunity: any) => opportunity.outcome === "admitted",
          );
          if (
            opportunities.some((opportunity: any, index: number) =>
              opportunity.outcome === "run_proof_sealed" &&
              index <= firstAdmittedOpportunity
            )
          ) {
            throw new Error(`${label}: run proof sealed an opportunity before its proof action`);
          }
          totals.run_proof_sealed_runs++;
        }
      }
    } else {
      const legacyTelemetryAbsent =
        proofState === undefined &&
        proofFirstEventIndex === undefined &&
        proofFirstOutcome === undefined &&
        proofFirstReachedTarget === undefined &&
        stats.value_live_run_proof_sealed_opportunities === undefined;
      if (
        !legacyTelemetryAbsent &&
        (
          proofState !== "disabled" ||
          proofFirstEventIndex !== null ||
          proofFirstOutcome !== null ||
          proofFirstReachedTarget !== null ||
          sealedOpportunities !== 0
        )
      ) {
        throw new Error(`${label}: run-proof telemetry changed a prior policy`);
      }
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
    const source = bySource.get(row.task.sourceId) ?? {
      runs: 0,
      active_runs: 0,
      crossings: 0,
      progress_expired_watches: 0,
      run_proof_sealed_opportunities: 0,
      run_proof_sealed_runs: 0,
      run_proof_proved_runs: 0,
      run_proof_awaiting_runs: 0,
      admitted: 0,
      probe_frames: 0,
      alternative_selected: 0,
      current_selected: 0,
      probe_dead_ends: 0,
    };
    source.runs++;
    if (events.length > 0) source.active_runs++;
    source.crossings += stats.value_live_crossings;
    source.progress_expired_watches += stats.value_live_progress_expired_watches ?? 0;
    source.run_proof_sealed_opportunities += sealedOpportunities;
    if (proofState === "sealed_after_failed_first_tournament") {
      source.run_proof_sealed_runs++;
    } else if (proofState === "first_tournament_reached_target") {
      source.run_proof_proved_runs++;
    } else if (proofState === "awaiting_first_tournament") {
      source.run_proof_awaiting_runs++;
    }
    source.admitted += stats.value_live_admitted;
    source.probe_frames += probeFrames;
    source.alternative_selected += events.filter(
      (event: any) => event.catchup_outcome === "alternative_selected",
    ).length;
    source.current_selected += events.filter(
      (event: any) => event.catchup_outcome === "current_selected",
    ).length;
    source.probe_dead_ends += probes.filter(
      (probe: any) => probe.outcome === "probe_dead_end",
    ).length;
    bySource.set(row.task.sourceId, source);
    totals.crossings += stats.value_live_crossings;
    totals.admitted += stats.value_live_admitted;
    totals.ranked_out += stats.value_live_ranked_out;
    totals.production_priority += stats.value_live_production_priority;
    totals.progress_suppressed_watches +=
      stats.value_live_progress_suppressed_watches ?? 0;
    totals.progress_expired_watches +=
      stats.value_live_progress_expired_watches ?? 0;
    totals.run_proof_sealed_opportunities += sealedOpportunities;
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
  totals.run_proof_sealed_sources = [...bySource.values()].filter(
    (source) => source.run_proof_sealed_runs > 0,
  ).length;
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
    aggregate_policy_budget_fraction:
      totals.probe_frames / sum(rows.map((row) => row.task.budget)),
    by_source: Object.fromEntries([...bySource.entries()].sort(([a], [b]) =>
      a.localeCompare(b)
    )),
  };
}

function summarizeScore(pairs: Array<{ candidate: GridCell; ref: GridCell }>): any {
  const cells = pairs.map((pair) => ({
    source_id: pair.candidate.sourceId,
    seed: pair.candidate.seed,
    delta: pair.candidate.score - pair.ref.score,
  }));
  const deltas = cells.map((cell) => cell.delta);
  const bySeed = new Map<number, number[]>();
  const bySource = new Map<string, number[]>();
  for (const pair of pairs) {
    const values = bySeed.get(pair.candidate.seed) ?? [];
    values.push(pair.candidate.score - pair.ref.score);
    bySeed.set(pair.candidate.seed, values);
    const sourceValues = bySource.get(pair.candidate.sourceId) ?? [];
    sourceValues.push(pair.candidate.score - pair.ref.score);
    bySource.set(pair.candidate.sourceId, sourceValues);
  }
  const seedBlocks = [...bySeed.entries()].sort((a, b) => a[0] - b[0])
    .map(([seed, values]) => ({ seed, mean_delta: mean(values) }));
  return {
    sum_delta: sum(deltas),
    mean_delta_per_cell: mean(deltas),
    seed_block_standard_error: standardError(seedBlocks.map((block) => block.mean_delta)),
    seed_blocks: seedBlocks,
    source_blocks: [...bySource.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([source_id, values]) => ({
        source_id,
        mean_delta: mean(values),
        improved: values.filter((value) => value > 0).length,
        regressed: values.filter((value) => value < 0).length,
        tied: values.filter((value) => value === 0).length,
      })),
    minimum_cell_delta: deltas.length === 0 ? null : Math.min(...deltas),
    worst_cells: cells.sort((a, b) => a.delta - b.delta).slice(0, 5),
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
    if (runProofEnabled) {
      console.log(
        `     proof reached/sealed/awaiting ${row.mechanics.run_proof_proved_runs}/` +
          `${row.mechanics.run_proof_sealed_runs}/` +
          `${row.mechanics.run_proof_awaiting_runs}; sealed opportunities ` +
          `${row.mechanics.run_proof_sealed_opportunities} across ` +
          `${row.mechanics.run_proof_sealed_sources} sources`,
      );
    }
    if (!row.gate.no_cell_loses_20) {
      const worst = row.score.worst_cells[0];
      console.log(
        `     tail gate: ${worst.source_id} seed ${worst.seed} ` +
          `${signed(worst.delta, 4)}`,
      );
    }
  }
  console.log(value.continuation_gate.passed === null
    ? `gate N/A: ${value.continuation_gate.consequence}`
    : `gate ${value.continuation_gate.passed ? "PASS" : "CLOSE"}: ` +
      value.continuation_gate.consequence);
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
