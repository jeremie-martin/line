/**
 * Trust and score-blind coverage gate for the behavior-neutral deferred-value
 * portfolio map. This analyzer never treats map identity as performance
 * evidence and never selects a threshold from score movement.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  assertPairedArms,
  gridCellKey,
  readGridArm,
  type GridArm,
} from "./paired_grid.ts";

const args = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const candidatePath = required("candidate");
const referencePath = required("reference");
const outPath = argument("out");
const expectedPolicy = "selective_axis_regret_catchup_value_deferred_map";
const allowanceFractions = [0.15, 0.25, 0.40] as const;

const candidate = readGridArm("deferred-value-map", candidatePath);
const reference = readGridArm("reference", referencePath);
assertPairedArms(candidate, reference);
const candidateRows = rowsByKey(candidate);
const referenceRows = rowsByKey(reference);
const budgets = [...new Set([...candidate.cells.values()].map((cell) => cell.budget))]
  .sort((a, b) => a - b);
if (budgets.length !== 2) throw new Error("deferred-value map requires exactly two budgets");

const identity = {
  cells: candidate.cells.size,
  exact_tracks: 0,
  exact_scores: 0,
  exact_validity: 0,
  exact_first_terminal_frames: 0,
  exact_first_terminal_track_hashes: 0,
  exact_repair_episodes: 0,
  passed: false,
};

const byBudget: Record<string, any> = {};
for (const budget of budgets) {
  const rows = [...candidate.cells.values()].filter((cell) => cell.budget === budget)
    .map((cell) => {
      const key = gridCellKey(cell.sourceId, cell.budget, cell.seed);
      const before = reference.cells.get(key);
      const candidateRow = candidateRows.get(key);
      const referenceRow = referenceRows.get(key);
      if (before === undefined || candidateRow === undefined || referenceRow === undefined) {
        throw new Error(`missing paired deferred-value cell ${key}`);
      }
      if (cell.trackHash === before.trackHash) identity.exact_tracks++;
      if (cell.score === before.score) identity.exact_scores++;
      if (cell.valid === before.valid) identity.exact_validity++;
      if (cell.firstCompletionFrame === before.firstCompletionFrame) {
        identity.exact_first_terminal_frames++;
      }
      const candidateTerminalHash = candidateRow.stats?.handoff_first_terminal_track_hash ?? null;
      const referenceTerminalHash = referenceRow.stats?.handoff_first_terminal_track_hash ?? null;
      if (candidateTerminalHash === referenceTerminalHash) {
        identity.exact_first_terminal_track_hashes++;
      }
      const candidateRepairs = repairEpisodes(candidateRow);
      const referenceRepairs = repairEpisodes(referenceRow);
      if (JSON.stringify(candidateRepairs) === JSON.stringify(referenceRepairs)) {
        identity.exact_repair_episodes++;
      }
      const stats = validateRun(candidateRow, candidateTerminalHash);
      return { cell, stats };
    });
  const opportunities = rows.flatMap((row) =>
    row.stats.deferred_value_opportunities.map((opportunity: any) => ({
      ...opportunity,
      source_id: row.cell.sourceId,
      seed: row.cell.seed,
    }))
  );
  const affordable = opportunities.filter((opportunity: any) =>
    opportunity.terminal?.affordable === true
  );
  const counts = countBy(opportunities, (opportunity: any) =>
    opportunity.outcome === "collected"
      ? opportunity.terminal?.reason ?? "unassessed"
      : opportunity.outcome
  );
  const coverageByFraction = Object.fromEntries(allowanceFractions.map((fraction) => [
    fraction.toFixed(2),
    summarizeCoverage(opportunities, fraction),
  ]));
  byBudget[String(budget)] = {
    cells: rows.length,
    crossings: sum(rows.map((row) => row.stats.deferred_value_crossings)),
    progress_expired: sum(rows.map((row) => row.stats.deferred_value_progress_expired)),
    collected: sum(rows.map((row) => row.stats.deferred_value_collected)),
    assessed: sum(rows.map((row) => row.stats.deferred_value_assessed)),
    incumbent_path: sum(rows.map((row) => row.stats.deferred_value_incumbent_path)),
    production_consumed: sum(rows.map((row) =>
      row.stats.deferred_value_production_consumed
    )),
    alternative_unavailable_at_terminal: sum(rows.map((row) =>
      row.stats.deferred_value_alternative_unavailable_at_terminal
    )),
    map_max_affordable: affordable.length,
    by_allowance_fraction: coverageByFraction,
    outcome_reasons: counts,
    estimated_suffix_work_frames: summarizeNumbers(affordable.map((opportunity: any) =>
      opportunity.terminal.estimated_suffix_work_frames
    )),
    terminal_value_density: summarizeNumbers(affordable.map((opportunity: any) =>
      opportunity.terminal.terminal_value_density_per_10k_estimated_frames
    )),
  };
}

identity.passed = Object.entries(identity)
  .filter(([key]) => key.startsWith("exact_"))
  .every(([, count]) => count === identity.cells);
const qualifyingFractions = allowanceFractions.filter((fraction) => {
  const key = fraction.toFixed(2);
  const low = byBudget[String(budgets[0]!)].by_allowance_fraction[key];
  const high = byBudget[String(budgets[1]!)].by_allowance_fraction[key];
  return [low, high].every((row) =>
    row.affordable >= 20 &&
    row.affordable_runs >= 8 &&
    row.affordable_sources >= 4 &&
    row.rank_one_runs >= 8 &&
    row.rank_one_sources >= 4
  ) && high.affordable >= low.affordable / 2;
});
const selectedAllowanceFraction = qualifyingFractions[0] ?? null;
const coveragePassed = selectedAllowanceFraction !== null;
const passed = identity.passed && coveragePassed;

const result = {
  schema: "line.deferred-value-opportunity-map-analysis.v1",
  generated_at: new Date().toISOString(),
  scope: {
    budgets,
    seeds: candidate.archive.seeds,
    sources: [...new Set([...candidate.cells.values()].map((cell) => cell.sourceId))].sort(),
    cells: candidate.cells.size,
    interpretation: "Behavior-neutral exact-opportunity survival and affordability; no performance claim.",
  },
  contract: {
    expected_policy: expectedPolicy,
    collection_lane: "initial",
    density_threshold: 0.02,
    minimum_gap_progress: 0.10,
    exploration_budget_fractions: allowanceFractions,
    selection_rule: "Smallest share with >=20 affordable records, >=8 runs, >=4 sources, rank-one actions in >=8 runs/4 sources at each budget, and >=half high-budget retention.",
    action_count: 0,
  },
  identity,
  by_budget: byBudget,
  continuation_gate: {
    identity_passed: identity.passed,
    coverage_passed: coveragePassed,
    selected_allowance_fraction: selectedAllowanceFraction,
    passed,
    consequence: passed
      ? "Implement the single predeclared bounded deferred suffix arm on fresh seeds."
      : "Close the deferred suffix action before live implementation.",
  },
};

console.log(`DEFERRED VALUE MAP  ${result.scope.cells} cells`);
for (const budget of budgets) {
  const row = byBudget[String(budget)]!;
  const selected = selectedAllowanceFraction === null
    ? null
    : row.by_allowance_fraction[selectedAllowanceFraction.toFixed(2)];
  console.log(
    `${budget / 1000}k crossings ${row.crossings}; collected ${row.collected}; ` +
      `incumbent-path ${row.incumbent_path}; ` +
      (selected === null
        ? `no qualifying allowance`
        : `${Math.round(selectedAllowanceFraction! * 100)}% affordable ` +
          `${selected.affordable} in ${selected.affordable_runs} runs/` +
          `${selected.affordable_sources} sources`),
  );
}
console.log(`identity ${identity.passed ? "PASS" : "FAIL"}; gate ${passed ? "PASS" : "CLOSE"}`);

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

function validateRun(row: any, firstTerminalTrackHash: string | null): any {
  const label = `${row.task.sourceId}/${row.task.budget}/${row.task.actualSeed}`;
  const stats = row.stats?.handoff_selective_backtracking;
  if (stats?.policy !== expectedPolicy) {
    throw new Error(`${label}: unexpected policy ${String(stats?.policy)}`);
  }
  if (
    stats.deferred_value_density_threshold !== 0.02 ||
    stats.deferred_value_min_gap_progress !== 0.10 ||
    JSON.stringify(stats.deferred_value_allowance_fractions) !==
      JSON.stringify(allowanceFractions) ||
    stats.deferred_value_map_max_allowance_fraction !== 0.40 ||
    stats.selective_backtracks_by_signal?.value_exploration !== 0
  ) {
    throw new Error(`${label}: deferred map contract mismatch`);
  }
  const opportunities = stats.deferred_value_opportunities ?? [];
  const outcomes = countBy(opportunities, (opportunity: any) => opportunity.outcome);
  if (
    opportunities.length !== stats.deferred_value_crossings ||
    (outcomes.progress_expired ?? 0) !== stats.deferred_value_progress_expired ||
    (outcomes.alternative_unavailable_at_collection ?? 0) !==
      stats.deferred_value_alternative_unavailable_at_collection ||
    (outcomes.collected ?? 0) !== stats.deferred_value_collected
  ) {
    throw new Error(`${label}: deferred crossing ledger mismatch`);
  }
  const collected = opportunities.filter((opportunity: any) =>
    opportunity.outcome === "collected"
  );
  if (
    collected.length !== stats.deferred_value_assessed ||
    collected.some((opportunity: any) => opportunity.terminal === null)
  ) {
    throw new Error(`${label}: deferred terminal assessment ledger mismatch`);
  }
  const terminals = collected.map((opportunity: any) => opportunity.terminal);
  if (
    firstTerminalTrackHash === null ||
    stats.deferred_value_first_terminal_track_hash !== firstTerminalTrackHash ||
    terminals.some((terminal: any) =>
      terminal.first_terminal_track_hash !== firstTerminalTrackHash ||
      terminal.first_terminal_total_spent_frames !== row.stats.first_completion_frame ||
      terminal.exploration_allowance_frames !==
        Math.floor(0.40 * terminal.search_policy_budget_frames) ||
      terminal.local_allowance_frames !== Math.min(
        terminal.remaining_hard_budget_frames,
        terminal.remaining_repair_budget_frames,
        terminal.exploration_allowance_frames,
      ) ||
      terminal.affordable !== (terminal.reason === "admitted")
    )
  ) {
    throw new Error(`${label}: deferred terminal identity or budget mismatch`);
  }
  const affordable = terminals.filter((terminal: any) => terminal.affordable)
    .sort((a: any, b: any) => a.affordable_rank - b.affordable_rank);
  if (
    affordable.length !== stats.deferred_value_affordable ||
    affordable.some((terminal: any, index: number) =>
      terminal.affordable_rank !== index + 1 ||
      terminal.estimated_suffix_work_frames > terminal.local_allowance_frames
    )
  ) {
    throw new Error(`${label}: deferred affordability ranking mismatch`);
  }
  return stats;
}

function repairEpisodes(row: any): any[] {
  return (row.budgetTelemetry?.episodes ?? []).filter((episode: any) =>
    episode.lane === "repair"
  );
}

function countBy<T>(values: T[], keyOf: (value: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const key = keyOf(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function summarizeCoverage(opportunities: any[], fraction: number): any {
  const affordable = opportunities.filter((opportunity) => {
    const terminal = opportunity.terminal;
    if (
      opportunity.outcome !== "collected" ||
      terminal === null ||
      !terminal.on_incumbent_path ||
      terminal.production_consumed ||
      !terminal.alternative_available
    ) return false;
    const allowance = Math.min(
      terminal.remaining_hard_budget_frames,
      terminal.remaining_repair_budget_frames,
      Math.floor(fraction * terminal.search_policy_budget_frames),
    );
    return terminal.estimated_suffix_work_frames <= allowance;
  });
  const byRun = new Map<string, any[]>();
  for (const opportunity of affordable) {
    const key = `${opportunity.source_id}/${opportunity.seed}`;
    const values = byRun.get(key) ?? [];
    values.push(opportunity);
    byRun.set(key, values);
  }
  const rankOne = [...byRun.values()].map((values) => values.sort((left, right) =>
    right.terminal.terminal_value_density_per_10k_estimated_frames -
      left.terminal.terminal_value_density_per_10k_estimated_frames ||
    right.crossing.axis_loss_delta - left.crossing.axis_loss_delta ||
    right.crossing.alternative_gap_index - left.crossing.alternative_gap_index ||
    left.watch_id - right.watch_id
  )[0]);
  const sources = new Set(affordable.map((opportunity) => opportunity.source_id));
  const rankOneSources = new Set(rankOne.map((opportunity) => opportunity.source_id));
  return {
    affordable: affordable.length,
    affordable_runs: byRun.size,
    affordable_sources: sources.size,
    rank_one_actions: rankOne.length,
    rank_one_runs: rankOne.length,
    rank_one_sources: rankOneSources.size,
    by_source: Object.fromEntries([...sources].sort().map((sourceId) => [
      sourceId,
      {
        affordable: affordable.filter((opportunity) =>
          opportunity.source_id === sourceId
        ).length,
        affordable_runs: new Set(affordable.filter((opportunity) =>
          opportunity.source_id === sourceId
        ).map((opportunity) => opportunity.seed)).size,
        rank_one_actions: rankOne.filter((opportunity) =>
          opportunity.source_id === sourceId
        ).length,
      },
    ])),
  };
}

function summarizeNumbers(values: number[]): {
  count: number;
  min: number | null;
  mean: number | null;
  max: number | null;
} {
  return {
    count: values.length,
    min: values.length === 0 ? null : Math.min(...values),
    mean: values.length === 0 ? null : sum(values) / values.length,
    max: values.length === 0 ? null : Math.max(...values),
  };
}
