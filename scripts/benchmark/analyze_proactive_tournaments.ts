/**
 * Paired two-budget attribution for the periodic proactive-tournament proof.
 *
 * This is a mechanism report, not a Benchmark V2 decision. It keeps 750k and
 * 1.25M separate, blocks uncertainty by actual seed, verifies the policy's
 * telemetry identities, and compares optional tournament work with the repair
 * work it may displace.
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
const initialPath = required("initial");
const repairPath = required("repair");
const referencePath = required("reference");
const outPath = argument("out");

const reference = readGridArm("reference", referencePath);
const initial = readGridArm("periodic-initial", initialPath);
const repair = readGridArm("periodic-repair", repairPath);
assertPairedArms(initial, reference);
assertPairedArms(repair, reference);

const budgets = [
  ...new Set([...reference.cells.values()].map((cell) => cell.budget)),
].sort((a, b) => a - b);
const result = {
  schema: "line.proactive-tournament-proof-analysis.v2",
  generated_at: new Date().toISOString(),
  scope: {
    budgets,
    seeds: reference.archive.seeds,
    sources: [
      ...new Set([...reference.cells.values()].map((cell) => cell.sourceId)),
    ].sort(),
    cells_per_arm: reference.cells.size,
    interpretation:
      "Matched compact-panel mechanism evidence; not a canonical headline or promotion decision.",
  },
  arms: {
    periodic_initial: analyzeArm(
      initial,
      reference,
      "selective_axis_regret_catchup_periodic_initial",
      "initial",
      budgets,
    ),
    periodic_repair: analyzeArm(
      repair,
      reference,
      "selective_axis_regret_catchup_periodic_repair",
      "repair",
      budgets,
    ),
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
      `usage: --initial=<archive> --repair=<archive> --reference=<archive> [--out=<json>]`,
    );
  }
  return value;
}

function analyzeArm(
  candidate: GridArm,
  ref: GridArm,
  expectedPolicy: string,
  expectedLane: "initial" | "repair",
  requestedBudgets: number[],
): Record<string, unknown> {
  const candidateRows = rowsByKey(candidate);
  const refRows = rowsByKey(ref);
  return {
    candidate_identity: candidate.archive.candidate,
    reference_identity: ref.archive.candidate,
    expected_policy: expectedPolicy,
    expected_periodic_lane: expectedLane,
    budget_contrast: summarizeBudgetContrast(candidate, ref, requestedBudgets),
    by_budget: Object.fromEntries(
      requestedBudgets.map((budget) => {
        const candidateCells = [...candidate.cells.values()].filter(
          (cell) => cell.budget === budget,
        );
        const pairs = candidateCells.map((cell) => {
          const key = gridCellKey(cell.sourceId, cell.budget, cell.seed);
          const before = ref.cells.get(key);
          if (before === undefined)
            throw new Error(`reference is missing ${key}`);
          return { candidate: cell, ref: before };
        });
        const candidateBudgetRows = pairs.map(({ candidate: cell }) =>
          candidateRows.get(
            gridCellKey(cell.sourceId, cell.budget, cell.seed),
          )!,
        );
        const refBudgetRows = pairs.map(({ ref: cell }) =>
          refRows.get(gridCellKey(cell.sourceId, cell.budget, cell.seed))!,
        );
        const mechanics = summarizePeriodic(
          candidateBudgetRows,
          expectedPolicy,
          expectedLane,
        );
        const score = summarizeScore(pairs);
        const candidateRepair = summarizeRepair(candidateBudgetRows);
        const referenceRepair = summarizeRepair(refBudgetRows);
        return [
          String(budget),
          {
            cells: pairs.length,
            score,
            first_terminal: summarizeFirstTerminal(pairs),
            periodic: {
              ...mechanics,
              active_run_fraction: mechanics.active_runs / pairs.length,
              aggregate_policy_budget_frames: pairs.length * budget,
              aggregate_policy_budget_fraction:
                mechanics.probe_frames / (pairs.length * budget),
            },
            action_set: summarizeActionSet(pairs, candidateBudgetRows),
            repair: {
              candidate: candidateRepair,
              reference: referenceRepair,
              displaced_frames: candidateRepair.frames - referenceRepair.frames,
              displaced_attempts:
                candidateRepair.attempts - referenceRepair.attempts,
              displaced_completed_attempts:
                candidateRepair.completed_attempts -
                referenceRepair.completed_attempts,
            },
            final_score_delta_per_million_periodic_frames:
              mechanics.probe_frames === 0
                ? null
                : (score.sum_delta / mechanics.probe_frames) * 1_000_000,
            by_source: Object.fromEntries(
              [...new Set(pairs.map((pair) => pair.candidate.sourceId))]
                .sort()
                .map((source) => {
                  const sourcePairs = pairs.filter(
                    (pair) => pair.candidate.sourceId === source,
                  );
                  const sourceRows = candidateBudgetRows.filter(
                    (row) => row.task.sourceId === source,
                  );
                  const sourceMechanics = summarizePeriodic(
                    sourceRows,
                    expectedPolicy,
                    expectedLane,
                  );
                  return [
                    source,
                    {
                      score: summarizeScore(sourcePairs),
                      first_terminal: summarizeFirstTerminal(sourcePairs),
                      periodic: sourceMechanics,
                      action_set: summarizeActionSet(sourcePairs, sourceRows),
                    },
                  ];
                }),
            ),
          },
        ];
      }),
    ),
  };
}

function rowsByKey(arm: GridArm): Map<string, any> {
  const result = new Map<string, any>();
  for (const row of arm.archive.runs) {
    const key = gridCellKey(
      row.task.sourceId,
      row.task.budget,
      row.task.actualSeed,
    );
    if (result.has(key))
      throw new Error(`${arm.label} contains duplicate row ${key}`);
    result.set(key, row);
  }
  return result;
}

function summarizeScore(
  pairs: Array<{ candidate: GridCell; ref: GridCell }>,
): any {
  const bothValid = pairs.filter(
    (pair) => pair.candidate.valid && pair.ref.valid,
  );
  const deltas = pairs.map((pair) => pair.candidate.score - pair.ref.score);
  const bothValidDeltas = bothValid.map(
    (pair) => pair.candidate.score - pair.ref.score,
  );
  const bySeed = new Map<number, number[]>();
  for (const pair of pairs) {
    const values = bySeed.get(pair.candidate.seed) ?? [];
    values.push(pair.candidate.score - pair.ref.score);
    bySeed.set(pair.candidate.seed, values);
  }
  const seedBlockMeans = [...bySeed.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([seed, values]) => ({ seed, mean_delta: mean(values) }));
  const estimate = mean(seedBlockMeans.map((block) => block.mean_delta));
  return {
    sum_delta: sum(deltas),
    mean_delta_per_cell: mean(deltas),
    seed_block_standard_error: standardError(
      seedBlockMeans.map((block) => block.mean_delta),
    ),
    seed_blocks: seedBlockMeans,
    improved: deltas.filter((delta) => delta > 0).length,
    regressed: deltas.filter((delta) => delta < 0).length,
    tied: deltas.filter((delta) => delta === 0).length,
    reference_only_valid: pairs.filter(
      (pair) => pair.ref.valid && !pair.candidate.valid,
    ).length,
    candidate_only_valid: pairs.filter(
      (pair) => !pair.ref.valid && pair.candidate.valid,
    ).length,
    both_valid: bothValid.length,
    neither_valid: pairs.filter(
      (pair) => !pair.ref.valid && !pair.candidate.valid,
    ).length,
    changed_tracks: pairs.filter(
      (pair) => pair.candidate.trackHash !== pair.ref.trackHash,
    ).length,
    unchanged_tracks: pairs.filter(
      (pair) => pair.candidate.trackHash === pair.ref.trackHash,
    ).length,
    both_valid_sum_delta: sum(bothValidDeltas),
    both_valid_mean_delta:
      bothValidDeltas.length === 0 ? null : mean(bothValidDeltas),
    seed_block_estimate_identity: estimate,
  };
}

function summarizeActionSet(
  pairs: Array<{ candidate: GridCell; ref: GridCell }>,
  candidateRows: any[],
): Record<string, unknown> {
  const activeKeys = new Set(
    candidateRows
      .filter((row) =>
        (row.stats?.handoff_selective_backtracking?.events ?? []).some(
          (event: any) => event.trigger_signal === "periodic_exploration",
        ),
      )
      .map((row) =>
        gridCellKey(row.task.sourceId, row.task.budget, row.task.actualSeed),
      ),
  );
  const active = pairs.filter((pair) =>
    activeKeys.has(
      gridCellKey(
        pair.candidate.sourceId,
        pair.candidate.budget,
        pair.candidate.seed,
      ),
    ),
  );
  const inactive = pairs.filter(
    (pair) =>
      !activeKeys.has(
        gridCellKey(
          pair.candidate.sourceId,
          pair.candidate.budget,
          pair.candidate.seed,
        ),
      ),
  );
  return {
    active_cells: active.length,
    active: summarizeScore(active),
    inactive_cells: inactive.length,
    inactive: summarizeScore(inactive),
    inactive_nonidentical_tracks: inactive.filter(
      (pair) => pair.candidate.trackHash !== pair.ref.trackHash,
    ).length,
  };
}

function summarizeBudgetContrast(
  candidate: GridArm,
  ref: GridArm,
  budgets: number[],
): Record<string, unknown> | null {
  if (budgets.length !== 2) return null;
  const [lowBudget, highBudget] = budgets;
  const lowBySourceSeed = new Map<string, number>();
  const highBySourceSeed = new Map<string, number>();
  for (const cell of candidate.cells.values()) {
    const key = gridCellKey(cell.sourceId, cell.budget, cell.seed);
    const before = ref.cells.get(key);
    if (before === undefined) throw new Error(`reference is missing ${key}`);
    const sourceSeed = `${cell.sourceId}\0${cell.seed}`;
    const delta = cell.score - before.score;
    if (cell.budget === lowBudget) lowBySourceSeed.set(sourceSeed, delta);
    if (cell.budget === highBudget) highBySourceSeed.set(sourceSeed, delta);
  }
  if (lowBySourceSeed.size !== highBySourceSeed.size) {
    throw new Error(
      "budget contrast does not cover the same source/seed cells",
    );
  }
  const rows = [...lowBySourceSeed].map(([sourceSeed, lowDelta]) => {
    const highDelta = highBySourceSeed.get(sourceSeed);
    if (highDelta === undefined)
      throw new Error(`high budget is missing ${sourceSeed}`);
    const seed = Number(sourceSeed.slice(sourceSeed.lastIndexOf("\0") + 1));
    return { seed, lowDelta, highDelta, contrast: highDelta - lowDelta };
  });
  const bySeed = new Map<number, number[]>();
  for (const row of rows) {
    const values = bySeed.get(row.seed) ?? [];
    values.push(row.contrast);
    bySeed.set(row.seed, values);
  }
  const seedBlocks = [...bySeed.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([seed, values]) => ({ seed, mean_high_minus_low: mean(values) }));
  return {
    low_budget: lowBudget,
    high_budget: highBudget,
    interpretation:
      "Paired change in the candidate-minus-reference effect at high versus low budget; descriptive, not an independent second experiment.",
    mean_high_minus_low_per_cell: mean(rows.map((row) => row.contrast)),
    seed_block_standard_error: standardError(
      seedBlocks.map((block) => block.mean_high_minus_low),
    ),
    seed_blocks: seedBlocks,
    high_more_positive: rows.filter((row) => row.contrast > 0).length,
    high_more_negative: rows.filter((row) => row.contrast < 0).length,
    tied: rows.filter((row) => row.contrast === 0).length,
  };
}

function summarizeFirstTerminal(
  pairs: Array<{ candidate: GridCell; ref: GridCell }>,
): Record<string, unknown> {
  const observed = pairs.flatMap((pair) =>
    pair.candidate.firstCompletionFrame === null ||
    pair.ref.firstCompletionFrame === null
      ? []
      : [
          {
            seed: pair.candidate.seed,
            delta:
              pair.candidate.firstCompletionFrame -
              pair.ref.firstCompletionFrame,
          },
        ],
  );
  const bySeed = new Map<number, number[]>();
  for (const row of observed) {
    const values = bySeed.get(row.seed) ?? [];
    values.push(row.delta);
    bySeed.set(row.seed, values);
  }
  const blocks = [...bySeed.values()].map(mean);
  return {
    jointly_observed: observed.length,
    mean_delta_frames:
      observed.length === 0 ? null : mean(observed.map((row) => row.delta)),
    seed_block_standard_error_frames: standardError(blocks),
    delayed: observed.filter((row) => row.delta > 0).length,
    accelerated: observed.filter((row) => row.delta < 0).length,
    tied: observed.filter((row) => row.delta === 0).length,
  };
}

function summarizePeriodic(
  rows: any[],
  expectedPolicy: string,
  expectedLane: "initial" | "repair",
): any {
  const totals = {
    active_runs: 0,
    schedule_checks: 0,
    exact_rewind_opportunities: 0,
    admitted: 0,
    unavailable: 0,
    execution_ceiling_suppressed: 0,
    terminal_reserve_suppressed: 0,
    exploration_allowance_suppressed: 0,
    probe_frames: 0,
    probe_nodes_processed: 0,
    target_reaches: 0,
    alternative_selected: 0,
    current_selected: 0,
    dead_or_deferred_or_ceiling: 0,
    suspended_prefixes_resumed: 0,
    estimated_probe_frames: 0,
    absolute_probe_estimation_error_frames: 0,
  };
  for (const row of rows) {
    const stats = row.stats?.handoff_selective_backtracking;
    if (stats?.policy !== expectedPolicy) {
      throw new Error(
        `${row.task.sourceId}/${row.task.budget}/${row.task.actualSeed}: ` +
          `expected ${expectedPolicy}, got ${String(stats?.policy)}`,
      );
    }
    const events = (stats.events ?? []).filter(
      (event: any) => event.trigger_signal === "periodic_exploration",
    );
    const opportunities = stats.periodic_opportunities ?? [];
    if (
      stats.periodic_exact_rewind_opportunities !== opportunities.length ||
      stats.periodic_admitted !== events.length ||
      stats.selective_backtracks_by_signal?.periodic_exploration !==
        events.length
    ) {
      throw new Error(
        `${row.task.sourceId}: periodic opportunity/action ledger mismatch`,
      );
    }
    if (
      events.some(
        (event: any) =>
          event.lane !== expectedLane ||
          event.contact_advance !== stats.periodic_contact_rewind ||
          event.periodic_budget?.admitted !== true ||
          event.periodic_budget?.reason !== "admitted",
      )
    ) {
      throw new Error(
        `${row.task.sourceId}: periodic action violates its lane/budget contract`,
      );
    }
    const probeFrames = sum(
      events.map((event: any) => event.catchup_probe_frames),
    );
    const probeNodes = sum(
      events.map((event: any) => event.catchup_probe_nodes_processed),
    );
    if (
      probeFrames !== stats.periodic_probe_frames ||
      probeNodes !== stats.periodic_probe_nodes_processed
    ) {
      throw new Error(
        `${row.task.sourceId}: periodic probe aggregate mismatch`,
      );
    }
    for (const event of events) {
      const budget = event.periodic_budget;
      if (
        budget.estimated_probe_work_frames + budget.terminal_reserve_frames >
          budget.execution_remaining_frames ||
        budget.estimated_probe_work_frames > budget.exploration_remaining_frames
      ) {
        throw new Error(
          `${row.task.sourceId}: admitted periodic action violates reserve arithmetic`,
        );
      }
      totals.estimated_probe_frames += budget.estimated_probe_work_frames;
      totals.absolute_probe_estimation_error_frames += Math.abs(
        event.catchup_probe_frames - budget.estimated_probe_work_frames,
      );
    }
    if (events.length > 0) totals.active_runs++;
    totals.schedule_checks += stats.periodic_schedule_checks;
    totals.exact_rewind_opportunities +=
      stats.periodic_exact_rewind_opportunities;
    totals.admitted += stats.periodic_admitted;
    totals.unavailable += stats.periodic_alternative_unavailable;
    totals.execution_ceiling_suppressed +=
      stats.periodic_execution_ceiling_suppressed;
    totals.terminal_reserve_suppressed +=
      stats.periodic_terminal_reserve_suppressed;
    totals.exploration_allowance_suppressed +=
      stats.periodic_exploration_allowance_suppressed;
    totals.probe_frames += probeFrames;
    totals.probe_nodes_processed += probeNodes;
    totals.target_reaches += sum(
      events.map(
        (event: any) =>
          event.catchup_probe_results.filter(
            (probe: any) => probe.outcome === "reached_target",
          ).length,
      ),
    );
    totals.alternative_selected += events.filter(
      (event: any) => event.catchup_outcome === "alternative_selected",
    ).length;
    totals.current_selected += events.filter(
      (event: any) => event.catchup_outcome === "current_selected",
    ).length;
    totals.dead_or_deferred_or_ceiling += events.filter(
      (event: any) =>
        event.catchup_outcome !== "alternative_selected" &&
        event.catchup_outcome !== "current_selected",
    ).length;
    totals.suspended_prefixes_resumed += events.filter(
      (event: any) => event.resumed_total_spent_frames !== null,
    ).length;
  }
  return {
    ...totals,
    actual_to_estimated_probe_frames_ratio:
      totals.estimated_probe_frames === 0
        ? null
        : totals.probe_frames / totals.estimated_probe_frames,
    mean_absolute_probe_estimation_error_frames:
      totals.admitted === 0
        ? null
        : totals.absolute_probe_estimation_error_frames / totals.admitted,
  };
}

function summarizeRepair(rows: any[]): {
  attempts: number;
  completed_attempts: number;
  accepted_attempts: number;
  frames: number;
  internal_score_delta: number;
} {
  const episodes = rows
    .flatMap((row) => row.budgetTelemetry?.episodes ?? [])
    .filter((episode: any) => episode.lane === "repair");
  return {
    attempts: episodes.length,
    completed_attempts: episodes.filter(
      (episode: any) => episode.outcome.terminal_reached,
    ).length,
    accepted_attempts: episodes.filter(
      (episode: any) => episode.outcome.accepted_alternative,
    ).length,
    frames: sum(
      episodes.map((episode: any) => episode.outcome.spent_frames ?? 0),
    ),
    internal_score_delta: sum(
      episodes.map(
        (episode: any) => episode.outcome.internal_full_score_delta ?? 0,
      ),
    ),
  };
}

function printResult(value: any): void {
  console.log(
    `PROACTIVE TOURNAMENT PROOF  ${value.scope.cells_per_arm} cells per arm`,
  );
  console.log(
    `budgets ${value.scope.budgets.join(", ")}  seeds ${value.scope.seeds.join(", ")}`,
  );
  for (const [armName, arm] of Object.entries(value.arms) as Array<
    [string, any]
  >) {
    console.log(`\n${armName}`);
    for (const [budget, row] of Object.entries(arm.by_budget) as Array<
      [string, any]
    >) {
      const score = row.score;
      const periodic = row.periodic;
      console.log(
        `  ${Number(budget) / 1000}k  score ${signed(score.mean_delta_per_cell, 4)} ` +
          `+/- ${format(score.seed_block_standard_error, 4)} SE; ` +
          `valid ref-only ${score.reference_only_valid}, candidate-only ${score.candidate_only_valid}`,
      );
      console.log(
        `        periodic ${periodic.admitted}/${periodic.exact_rewind_opportunities} admitted ` +
          `in ${periodic.active_runs} runs, ${periodic.probe_frames} frames; ` +
          `winner alternative/current ${periodic.alternative_selected}/${periodic.current_selected}`,
      );
      console.log(
        `        first-terminal ${signedNullable(row.first_terminal.mean_delta_frames, 0)} frames; ` +
          `repair displacement ${signed(row.repair.displaced_frames, 0)} frames, ` +
          `${signed(row.repair.displaced_attempts, 0)} attempts`,
      );
    }
    if (arm.budget_contrast !== null) {
      console.log(
        `  high-minus-low candidate effect ` +
          `${signed(arm.budget_contrast.mean_high_minus_low_per_cell, 4)} ` +
          `+/- ${format(arm.budget_contrast.seed_block_standard_error, 4)} SE`,
      );
    }
  }
  console.log(`\n${value.scope.interpretation}`);
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
  const variance =
    sum(values.map((value) => (value - center) ** 2)) / (values.length - 1);
  return Math.sqrt(variance / values.length);
}

function format(value: number | null, digits: number): string {
  return value === null ? "n/a" : value.toFixed(digits);
}

function signed(value: number, digits: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function signedNullable(value: number | null, digits: number): string {
  return value === null ? "n/a" : signed(value, digits);
}
