/**
 * Trust and breadth analysis for the behavior-neutral value-ranked DFS map.
 *
 * The map may select a threshold only from opportunity breadth. It must first
 * prove exact compiler behavior against production, then validate every raw
 * watch/threshold record against its aggregate ledger. Scores are checked for
 * identity and are never consulted by the selection rule.
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

const candidate = readGridArm("value-map", candidatePath);
const reference = readGridArm("reference", referencePath);
assertPairedArms(candidate, reference);

const candidateRows = rowsByKey(candidate);
const referenceRows = rowsByKey(reference);
const budgets = [
  ...new Set([...candidate.cells.values()].map((cell) => cell.budget)),
].sort((a, b) => a - b);
if (budgets.length !== 2)
  throw new Error(`value map requires exactly two budgets`);

const identity = validateIdentity(candidateRows, referenceRows);
const observations = validateAndCollect(candidateRows);
const lanes = ["initial", "repair"] as const;
const thresholds = [...new Set(observations.map((row) => row.threshold))].sort(
  (a, b) => a - b,
);
const byLane = Object.fromEntries(
  lanes.map((lane) => {
    const byThreshold = Object.fromEntries(
      thresholds.map((threshold) => [
        threshold.toFixed(3),
        Object.fromEntries(
          budgets.map((budget) => {
            const rows = observations.filter(
              (row) =>
                row.lane === lane &&
                row.threshold === threshold &&
                row.budget === budget,
            );
            const admitted = rows.filter((row) => row.admission !== null);
            return [String(budget), summarize(rows, admitted)];
          }),
        ),
      ]),
    );
    const selected =
      [...thresholds]
        .reverse()
        .find((threshold) =>
          thresholdQualifies(byThreshold[threshold.toFixed(3)], budgets),
        ) ?? null;
    return [
      lane,
      {
        selection_rule:
          "Highest threshold with >=20 admissions, >=8 runs, and >=4 sources at each budget, while retaining >=half as many admissions at 1.25M as at 750k.",
        selected_threshold: selected,
        by_threshold: byThreshold,
      },
    ];
  }),
);

const result = {
  schema: "line.value-ranked-dfs-opportunity-map-analysis.v1",
  generated_at: new Date().toISOString(),
  scope: {
    budgets,
    seeds: candidate.archive.seeds,
    cells: candidate.cells.size,
    interpretation:
      "Behavior-neutral opportunity breadth. Threshold selection does not use score movement.",
  },
  identity,
  thresholds,
  lanes: byLane,
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
      `usage: --candidate=<map.json> --reference=<ref.json> [--out=<json>]`,
    );
  }
  return value;
}

function rowsByKey(arm: GridArm): Map<string, any> {
  return new Map(
    arm.archive.runs.map((row: any) => [
      gridCellKey(row.task.sourceId, row.task.budget, row.task.actualSeed),
      row,
    ]),
  );
}

function validateIdentity(
  candidateRows: Map<string, any>,
  referenceRows: Map<string, any>,
): any {
  let exactTracks = 0;
  let exactScores = 0;
  let exactValidity = 0;
  let exactFirstTerminal = 0;
  let exactRepairEpisodes = 0;
  for (const [key, row] of candidateRows) {
    const before = referenceRows.get(key);
    if (before === undefined) throw new Error(`reference is missing ${key}`);
    if (row.trackHash === before.trackHash) exactTracks++;
    if (row.score.score === before.score.score) exactScores++;
    if (row.score.valid === before.score.valid) exactValidity++;
    if (
      row.budgetTelemetry?.compile?.first_terminal_total_spent_frames ===
      before.budgetTelemetry?.compile?.first_terminal_total_spent_frames
    )
      exactFirstTerminal++;
    if (
      JSON.stringify(row.budgetTelemetry?.episodes ?? []) ===
      JSON.stringify(before.budgetTelemetry?.episodes ?? [])
    )
      exactRepairEpisodes++;
  }
  const cells = candidateRows.size;
  const result = {
    cells,
    exact_tracks: exactTracks,
    exact_scores: exactScores,
    exact_validity: exactValidity,
    exact_first_terminal: exactFirstTerminal,
    exact_repair_episodes: exactRepairEpisodes,
    passed: [
      exactTracks,
      exactScores,
      exactValidity,
      exactFirstTerminal,
      exactRepairEpisodes,
    ].every((count) => count === cells),
  };
  if (!result.passed)
    throw new Error(
      `value map changed compiler behavior: ${JSON.stringify(result)}`,
    );
  return result;
}

type Observation = {
  source: string;
  seed: number;
  budget: number;
  threshold: number;
  lane: "initial" | "repair";
  crossing: any;
  admission: any | null;
};

function validateAndCollect(candidateRows: Map<string, any>): Observation[] {
  const result: Observation[] = [];
  for (const row of candidateRows.values()) {
    const stats = row.stats?.handoff_selective_backtracking;
    if (stats?.policy !== "selective_axis_regret_catchup_value_map") {
      throw new Error(
        `${row.task.sourceId}: unexpected value-map policy ${String(stats?.policy)}`,
      );
    }
    const opportunities = stats.value_opportunities ?? [];
    const seen = new Set<string>();
    for (const opportunity of opportunities) {
      const unique = `${opportunity.watch_id}/${opportunity.threshold}`;
      if (seen.has(unique))
        throw new Error(`${row.task.sourceId}: duplicate ${unique}`);
      seen.add(unique);
      validatePoint(opportunity.crossing, opportunity.threshold, false);
      if (opportunity.first_admission !== null) {
        validatePoint(opportunity.first_admission, opportunity.threshold, true);
        if (
          opportunity.first_admission.contact_ordinal <
          opportunity.crossing.contact_ordinal
        ) {
          throw new Error(`${row.task.sourceId}: admission precedes crossing`);
        }
      }
      result.push({
        source: row.task.sourceId,
        seed: row.task.actualSeed,
        budget: row.task.budget,
        threshold: opportunity.threshold,
        lane: opportunity.crossing.lane,
        crossing: opportunity.crossing,
        admission: opportunity.first_admission,
      });
    }
    for (const threshold of stats.value_density_thresholds ?? []) {
      const key = Number(threshold).toFixed(3);
      const ledger = stats.value_opportunities_by_density?.[key];
      const records = opportunities.filter(
        (item: any) => item.threshold === threshold,
      );
      if (
        ledger?.crossed_watches !== records.length ||
        ledger?.admissible_watches !==
          records.filter((item: any) => item.first_admission !== null).length
      )
        throw new Error(
          `${row.task.sourceId}: value opportunity ledger mismatch at ${key}`,
        );
    }
  }
  return result;
}

function validatePoint(point: any, threshold: number, admitted: boolean): void {
  if (
    (point.lane !== "initial" && point.lane !== "repair") ||
    point.contact_advance < 3 ||
    !(point.axis_loss_delta > 0) ||
    point.value_density_per_10k_estimated_frames < threshold ||
    point.budget.estimated_probe_work_frames < 0 ||
    point.budget.terminal_reserve_frames < 0
  )
    throw new Error(`invalid value opportunity point`);
  if (
    admitted &&
    (point.alternative_available !== true ||
      point.execution_ceiling_reached !== false ||
      point.budget.admitted !== true ||
      point.budget.reason !== "admitted")
  )
    throw new Error(`invalid admitted value opportunity point`);
}

function summarize(rows: Observation[], admitted: Observation[]): any {
  const runKeys = new Set(admitted.map((row) => `${row.source}\0${row.seed}`));
  const sources = [...new Set(admitted.map((row) => row.source))].sort();
  return {
    crossed_watches: rows.length,
    admitted_watches: admitted.length,
    admission_runs: runKeys.size,
    admission_sources: sources.length,
    sources,
    crossing_reasons: countBy(rows, (row) =>
      !row.crossing.alternative_available
        ? "alternative_unavailable"
        : row.crossing.execution_ceiling_reached
          ? "execution_ceiling"
          : row.crossing.budget.reason,
    ),
    first_admission: {
      mean_axis_loss_delta: mean(
        admitted.map((row) => row.admission.axis_loss_delta),
      ),
      mean_density: mean(
        admitted.map(
          (row) => row.admission.value_density_per_10k_estimated_frames,
        ),
      ),
      mean_estimated_probe_frames: mean(
        admitted.map((row) => row.admission.budget.estimated_probe_work_frames),
      ),
      median_estimated_probe_frames: median(
        admitted.map((row) => row.admission.budget.estimated_probe_work_frames),
      ),
      mean_contact_advance: mean(
        admitted.map((row) => row.admission.contact_advance),
      ),
      mean_gap_rewind: mean(admitted.map((row) => row.admission.gap_rewind)),
    },
  };
}

function thresholdQualifies(byBudget: any, budgets: number[]): boolean {
  const [low, high] = budgets.map((budget) => byBudget[String(budget)]);
  return (
    [low, high].every(
      (row) =>
        row.admitted_watches >= 20 &&
        row.admission_runs >= 8 &&
        row.admission_sources >= 4,
    ) && high.admitted_watches >= low.admitted_watches / 2
  );
}

function countBy<T>(
  values: T[],
  keyOf: (value: T) => string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) {
    const key = keyOf(value);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

function mean(values: number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1]! + ordered[middle]!) / 2
    : ordered[middle]!;
}

function printResult(value: any): void {
  console.log(`VALUE-RANKED DFS OPPORTUNITY MAP  ${value.scope.cells} cells`);
  console.log(`identity ${value.identity.passed ? "PASS" : "FAIL"}`);
  for (const [lane, laneResult] of Object.entries(value.lanes) as Array<
    [string, any]
  >) {
    console.log(
      `\n${lane}  selected ${laneResult.selected_threshold ?? "none"}`,
    );
    for (const [threshold, byBudget] of Object.entries(
      laneResult.by_threshold,
    ) as Array<[string, any]>) {
      const cells = Object.entries(byBudget).map(
        ([budget, row]: [string, any]) =>
          `${Number(budget) / 1000}k ${row.admitted_watches}/${row.crossed_watches} ` +
          `(${row.admission_runs} runs, ${row.admission_sources} sources)`,
      );
      console.log(`  ${threshold}: ${cells.join("; ")}`);
    }
  }
  console.log(`\n${value.scope.interpretation}`);
}
