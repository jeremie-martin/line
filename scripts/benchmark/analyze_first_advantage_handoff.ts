/** Paired mechanism and directional screen for Phase O's partial handoff. */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  assertPairedArms,
  gridCellKey,
  readGridArm,
  type GridArm,
  type GridCell,
} from "./paired_grid.ts";

const POLICY =
  "selective_axis_regret_catchup_value_initial_expire_10_first_advantage_handoff";
const args = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const candidatePath = required("candidate");
const referencePath = required("reference");
const outPath = argument("out");
const candidate = readGridArm("first-advantage-handoff", candidatePath);
const reference = readGridArm("phase-d", referencePath);
const pairingNotes = assertPairedArms(candidate, reference);
const candidateRows = rowsByKey(candidate);
const referenceRows = rowsByKey(reference);

type Pair = { candidate: GridCell; reference: GridCell; row: any; referenceRow: any };
const pairs: Pair[] = [...candidate.cells.values()].map((cell) => {
  const key = gridCellKey(cell.sourceId, cell.budget, cell.seed);
  const referenceCell = reference.cells.get(key);
  const row = candidateRows.get(key);
  const referenceRow = referenceRows.get(key);
  if (referenceCell === undefined || row === undefined || referenceRow === undefined) {
    throw new Error(`missing paired cell ${printableKey(key)}`);
  }
  return { candidate: cell, reference: referenceCell, row, referenceRow };
});

const mechanics = {
  candidate: summarizeAndValidate(candidate.archive.runs, true),
  reference: summarizeAndValidate(reference.archive.runs, false),
};
const score = summarizeScore(pairs);
const firstTerminal = summarizeFirstTerminal(pairs);
const repair = {
  candidate: summarizeRepair(candidate.archive.runs),
  reference: summarizeRepair(reference.archive.runs),
};
const candidateNonProbe = mechanics.candidate.initial_search_frames -
  mechanics.candidate.value_probe_frames + repair.candidate.frames;
const referenceNonProbe = mechanics.reference.initial_search_frames -
  mechanics.reference.value_probe_frames + repair.reference.frames;
const work = {
  value_probe_frames_delta:
    mechanics.candidate.value_probe_frames - mechanics.reference.value_probe_frames,
  initial_search_frames_delta:
    mechanics.candidate.initial_search_frames - mechanics.reference.initial_search_frames,
  repair_frames_delta: repair.candidate.frames - repair.reference.frames,
  ordinary_initial_plus_repair_excluding_value_probe_delta:
    candidateNonProbe - referenceNonProbe,
};
const gate = {
  all_cells_valid: pairs.every((pair) => pair.candidate.valid && pair.reference.valid),
  positive_total_movement: score.sum_delta > 0,
  positive_seed_blocks: score.seed_blocks.filter((block) => block.mean_delta > 0).length,
  positive_source_means: score.source_blocks.filter((block) => block.mean_delta > 0).length,
  no_cell_loses_20: score.minimum_cell_delta > -20,
  at_least_50_exact_handoffs: mechanics.candidate.first_advantage_handoffs >= 50,
  all_handoffs_received_next_frontier_turn:
    mechanics.candidate.first_advantage_handoffs ===
      mechanics.candidate.first_advantage_handoffs_selected,
  synchronous_probe_work_reduced: work.value_probe_frames_delta < 0,
  displaced_work_is_visible:
    work.ordinary_initial_plus_repair_excluding_value_probe_delta > 0,
};
const passed = gate.all_cells_valid && gate.positive_total_movement &&
  gate.positive_seed_blocks >= 3 && gate.positive_source_means >= 4 &&
  gate.no_cell_loses_20 && gate.at_least_50_exact_handoffs &&
  gate.all_handoffs_received_next_frontier_turn &&
  gate.synchronous_probe_work_reduced && gate.displaced_work_is_visible;

const result = {
  schema: "line.first-advantage-handoff-analysis.v1",
  generated_at: new Date().toISOString(),
  scope: {
    cells: pairs.length,
    budgets: candidate.archive.budgets,
    seeds: candidate.archive.seeds,
    sources: [...new Set(pairs.map((pair) => pair.candidate.sourceId))].sort(),
    interpretation:
      "Fresh 750k compact characterization of one frozen partial-handoff rule; never promotion evidence.",
  },
  contract: {
    policy: POLICY,
    lane: "initial",
    checkpoint: "first strictly pre-target checkpoint",
    threshold: "alternative authored-axis gain > 0",
    disposition: "partial alternative next; suspended current retained as fallback",
  },
  pairing_notes: pairingNotes,
  score,
  first_terminal: firstTerminal,
  mechanics,
  repair,
  work,
  continuation_gate: {
    conditions: gate,
    passed,
    consequence: passed
      ? "The frozen arm may enter the standing canonical 750k evaluator; it is not promoted."
      : "Close the frozen arm without canonical or multi-budget evaluation.",
  },
};

printResult(result);
if (outPath !== undefined) {
  const absolute = resolve(outPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`analysis ${absolute}`);
}

function summarizeAndValidate(rows: any[], candidateArm: boolean): any {
  const totals = {
    actions: 0,
    value_probe_frames: 0,
    value_probe_nodes: 0,
    first_advantage_handoffs: 0,
    first_advantage_handoffs_selected: 0,
    handoff_runs: 0,
    handoff_sources: 0,
    incumbent_resumptions_after_handoff: 0,
    initial_search_frames: 0,
    target_reaches: 0,
    endpoint_alternatives_selected: 0,
    endpoint_current_selected: 0,
  };
  const handoffSources = new Set<string>();
  for (const row of rows) {
    const label = `${row.task.sourceId}/${row.task.budget}/${row.task.actualSeed}`;
    const stats = row.stats?.handoff_selective_backtracking;
    const expectedPolicy = candidateArm
      ? POLICY
      : "selective_axis_regret_catchup_value_initial_expire_10";
    if (stats?.policy !== expectedPolicy) {
      throw new Error(`${label}: unexpected policy ${String(stats?.policy)}`);
    }
    if (candidateArm && (
      stats.value_probe_stop_rule !== "first_pre_target_advantage" ||
      stats.value_probe_first_checkpoint_advantage_threshold !== 0 ||
      stats.value_probe_first_checkpoint_deficit_threshold !== null
    )) throw new Error(`${label}: invalid first-advantage policy contract`);
    const opportunities = stats.value_live_opportunities ?? [];
    const admitted = new Map(opportunities
      .filter((opportunity: any) => opportunity.outcome === "admitted")
      .map((opportunity: any) => [opportunity.watch_id, opportunity]));
    const events = (stats.events ?? []).filter(
      (event: any) => event.trigger_signal === "value_exploration",
    );
    if (
      admitted.size !== events.length ||
      events.length !== stats.value_live_admitted ||
      stats.value_live_crossings !== opportunities.length
    ) throw new Error(`${label}: value action/opportunity ledger mismatch`);
    const handoffs = events.filter(
      (event: any) => event.catchup_outcome === "probe_first_advantage_handoff",
    );
    for (const event of events) {
      if (!admitted.has(event.watch_id)) throw new Error(`${label}: action lacks admission`);
      if (event.lane !== "initial" || event.value_budget?.admitted !== true) {
        throw new Error(`${label}: value action violates lane/budget contract`);
      }
      const probes = event.catchup_probe_results ?? [];
      if (sum(probes.map((probe: any) => probe.probe_frames)) !== event.catchup_probe_frames) {
        throw new Error(`${label}: event/probe frame ledger mismatch`);
      }
      for (const probe of probes) {
        if (sum(probe.atomic_node_frames ?? []) !== probe.probe_frames) {
          throw new Error(`${label}: atomic probe frame ledger mismatch`);
        }
      }
      totals.target_reaches += probes.filter(
        (probe: any) => probe.outcome === "reached_target",
      ).length;
      if (event.catchup_outcome === "alternative_selected") {
        totals.endpoint_alternatives_selected++;
      } else if (event.catchup_outcome === "current_selected") {
        totals.endpoint_current_selected++;
      }
    }
    for (const event of handoffs) validateHandoff(label, event);
    if (candidateArm) {
      if (
        handoffs.length !== stats.catchup_probe_first_advantage_handoffs ||
        handoffs.filter((event: any) =>
          event.first_advantage_handoff_total_spent_frames !== null
        ).length !== stats.catchup_first_advantage_handoffs_selected
      ) throw new Error(`${label}: partial-handoff aggregate mismatch`);
    } else if (
      handoffs.length !== 0 ||
      (stats.catchup_probe_first_advantage_handoffs ?? 0) !== 0 ||
      (stats.catchup_first_advantage_handoffs_selected ?? 0) !== 0
    ) throw new Error(`${label}: Phase D unexpectedly contains partial handoffs`);
    if (handoffs.length > 0) {
      totals.handoff_runs++;
      handoffSources.add(row.task.sourceId);
      totals.incumbent_resumptions_after_handoff += handoffs.filter(
        (event: any) => event.resumed_total_spent_frames !== null,
      ).length;
    }
    totals.actions += events.length;
    totals.value_probe_frames += stats.value_live_probe_frames;
    totals.value_probe_nodes += stats.value_live_probe_nodes_processed;
    totals.first_advantage_handoffs += handoffs.length;
    totals.first_advantage_handoffs_selected += handoffs.filter(
      (event: any) => event.first_advantage_handoff_total_spent_frames !== null,
    ).length;
    totals.initial_search_frames += (row.budgetTelemetry?.execution_intervals ?? [])
      .filter((interval: any) => interval.kind === "initial_search")
      .reduce((total: number, interval: any) => total + interval.spent_frames, 0);
  }
  totals.handoff_sources = handoffSources.size;
  return totals;
}

function validateHandoff(label: string, event: any): void {
  const checkpoints = event.catchup_checkpoints ?? [];
  const probes = event.catchup_probe_results ?? [];
  const checkpoint = checkpoints[0];
  const probe = probes[0];
  if (
    checkpoints.length !== 1 || probes.length !== 1 ||
    checkpoint === undefined || probe === undefined ||
    checkpoint.gap_index >= event.from_gap_index ||
    !(checkpoint.alternative_axis_loss_gain > 0) ||
    probe.outcome !== "probe_first_advantage_handoff" ||
    probe.end_gap_index !== checkpoint.gap_index ||
    probe.axis_loss !== checkpoint.alternative_axis_loss ||
    event.catchup_axis_loss !== null ||
    event.catchup_selected_alternative_ordinal !== 1 ||
    event.catchup_selected_route_ordinal !== 1 ||
    event.first_advantage_handoff_total_spent_frames !==
      event.trigger_total_spent_frames + event.catchup_probe_frames
  ) throw new Error(`${label}: invalid first-checkpoint partial handoff`);
}

function summarizeScore(pairs: Pair[]): any {
  const cells = pairs.map((pair) => ({
    source_id: pair.candidate.sourceId,
    seed: pair.candidate.seed,
    delta: pair.candidate.score - pair.reference.score,
  }));
  const bySeed = grouped(cells, (cell) => String(cell.seed));
  const bySource = grouped(cells, (cell) => cell.source_id);
  const seedBlocks = [...bySeed.entries()].sort(([a], [b]) => Number(a) - Number(b))
    .map(([seed, values]) => ({ seed: Number(seed), mean_delta: mean(values.map((v) => v.delta)) }));
  const sourceBlocks = [...bySource.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([source_id, values]) => ({ source_id, mean_delta: mean(values.map((v) => v.delta)) }));
  return {
    sum_delta: sum(cells.map((cell) => cell.delta)),
    mean_delta_per_cell: mean(cells.map((cell) => cell.delta)),
    seed_block_standard_error: standardError(seedBlocks.map((block) => block.mean_delta)),
    minimum_cell_delta: Math.min(...cells.map((cell) => cell.delta)),
    better: cells.filter((cell) => cell.delta > 0).length,
    worse: cells.filter((cell) => cell.delta < 0).length,
    tied: cells.filter((cell) => cell.delta === 0).length,
    seed_blocks: seedBlocks,
    source_blocks: sourceBlocks,
    worst_cells: [...cells].sort((a, b) => a.delta - b.delta).slice(0, 5),
  };
}

function summarizeFirstTerminal(pairs: Pair[]): any {
  const deltas = pairs.flatMap((pair) =>
    pair.candidate.firstCompletionFrame === null || pair.reference.firstCompletionFrame === null
      ? []
      : [pair.candidate.firstCompletionFrame - pair.reference.firstCompletionFrame]
  );
  return { comparable_cells: deltas.length, mean_delta_frames: meanOrNull(deltas) };
}

function summarizeRepair(rows: any[]): any {
  const episodes = rows.flatMap((row) => row.budgetTelemetry?.episodes ?? [])
    .filter((episode: any) => episode.lane === "repair");
  return {
    attempts: episodes.length,
    terminal_reached: episodes.filter((episode: any) => episode.outcome.terminal_reached).length,
    accepted: episodes.filter((episode: any) => episode.outcome.accepted_alternative).length,
    frames: sum(episodes.map((episode: any) => episode.outcome.spent_frames ?? 0)),
  };
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
    gridCellKey(row.task.sourceId, row.task.budget, row.task.actualSeed), row,
  ]));
}

function grouped<T>(values: T[], keyOf: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) result.set(keyOf(value), [...(result.get(keyOf(value)) ?? []), value]);
  return result;
}

function sum(values: number[]): number { return values.reduce((a, b) => a + b, 0); }
function mean(values: number[]): number { return values.length === 0 ? 0 : sum(values) / values.length; }
function meanOrNull(values: number[]): number | null { return values.length === 0 ? null : mean(values); }
function standardError(values: number[]): number | null {
  if (values.length < 2) return null;
  const center = mean(values);
  return Math.sqrt(sum(values.map((value) => (value - center) ** 2)) /
    (values.length - 1) / values.length);
}
function printableKey(key: string): string { return key.replaceAll("\0", "/"); }

function printResult(value: any): void {
  console.log(`FIRST-ADVANTAGE HANDOFF  ${value.scope.cells} paired cells`);
  console.log(
    `score ${signed(value.score.mean_delta_per_cell, 3)} +/- ` +
      `${format(value.score.seed_block_standard_error, 3)} SE; ` +
      `${value.score.better}/${value.score.worse}/${value.score.tied} better/worse/tied`,
  );
  console.log(
    `handoffs ${value.mechanics.candidate.first_advantage_handoffs}; selected next ` +
      `${value.mechanics.candidate.first_advantage_handoffs_selected}; probe frames ` +
      `${signed(value.work.value_probe_frames_delta, 0)}; first terminal ` +
      `${signedNullable(value.first_terminal.mean_delta_frames, 0)}`,
  );
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
