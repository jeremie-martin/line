/**
 * Budget-spend characterization for compileHandoff.
 *
 * This is a read-only study for the first budget-controller step. It sweeps an
 * explicit quality candidate-count override, records actual compute spent, and
 * groups results by structural budget slack.
 *
 *   LR_ENGINE=wasm node --import tsx scripts/v0/study_budget_spend.ts \
 *     --budget=200000 \
 *     --specs=tiny_dance,dense_echo_climb,skyline_push,drums_pendulum \
 *     --seeds=0,1 \
 *     --quality-ncand=24,32,40 \
 *     --out=generated/studies/budget-spend-qncand.json
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { compileHandoff } from "./optimizer/handoff.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { scoreDriftReport, shiftedGeometricMean } from "./score.ts";
import { secToFrame } from "./types.ts";

const DEFAULT_SPECS = [
  "tiny_dance",
  "cold_start",
  "dense_echo_climb",
  "skyline_push",
  "drums_pendulum",
  "solo_run",
] as const satisfies readonly GoldenSpecName[];
const DEFAULT_SEEDS = [0, 1];
const DEFAULT_BUDGET = 200_000;
const DEFAULT_QUALITY_NCAND = [24, 32, 40];
const DEFAULT_BASELINE_NCAND = 32;

type Row = {
  spec: string;
  seed: number;
  budget: number;
  quality_ncand: number;
  score: number;
  contract_passed: boolean;
  axis_quality: number;
  sim_frames: number;
  budget_exhausted: boolean;
  predicted_first_completion_frames: number | null;
  budget_slack: number | null;
  first_completion_frame: number | null;
  candidates_sampled: number;
  candidates_viable: number;
  handoff_full_evaluations: number;
  handoff_unique_full_evaluations: number;
  fwd_eval_frames_charged: number;
  fwd_eval_calls: number;
  repair_frames_spent: number;
  repair_restarts: number;
  elapsed_ms: number;
};

type Summary = {
  key: string;
  n: number;
  valid: number;
  score_geomean: number;
  score_mean: number;
  sim_frames_mean: number;
  candidates_sampled_mean: number;
  candidates_viable_mean: number;
  first_completion_mean: number | null;
  predicted_first_completion_mean: number | null;
  budget_slack_mean: number | null;
  fwd_eval_frames_mean: number;
  repair_frames_mean: number;
  full_evaluations_mean: number;
};

type PairedDelta = {
  quality_ncand: number;
  baseline_quality_ncand: number;
  pairs: number;
  score_delta_mean: number;
  sim_frames_delta_mean: number;
  candidates_sampled_delta_mean: number;
  first_completion_delta_mean: number | null;
  repair_frames_delta_mean: number;
};

type Delta = {
  score: number;
  sim: number;
  candidates: number;
  first: number | null;
  repair: number;
};

const argv = process.argv.slice(2);
const budget = intArg("budget", DEFAULT_BUDGET);
const qualityNCands = ensureIncludes(
  positiveIntListArg("quality-ncand", DEFAULT_QUALITY_NCAND),
  intArg("baseline-ncand", DEFAULT_BASELINE_NCAND),
).sort((a, b) => a - b);
const baselineNCand = intArg("baseline-ncand", DEFAULT_BASELINE_NCAND);
const seeds = intListArg("seeds", DEFAULT_SEEDS);
const specNames = specListArg("specs", [...DEFAULT_SPECS]);
const outPath = arg("out");
const previousQualityNCand = process.env.LR_QUALITY_NCAND;

const rows: Row[] = [];
try {
  for (const specName of specNames) {
    const spec = await loadGoldenSpec(specName, "base");
    for (const seed of seeds) {
      for (const qualityNCand of qualityNCands) {
        process.env.LR_QUALITY_NCAND = String(qualityNCand);
        const t0 = Date.now();
        const checkpoint = compileHandoff(spec, seed, { budget });
        const elapsedMs = Date.now() - t0;
        const score = scoreDriftReport(checkpoint.report, {
          totalFrames: secToFrame(spec.duration),
        });
        const stats = checkpoint.stats;
        rows.push({
          spec: specName,
          seed,
          budget,
          quality_ncand: qualityNCand,
          score: round(score.score, 4),
          contract_passed: score.contract_passed,
          axis_quality: round(score.axis_quality, 6),
          sim_frames: stats.sim_frames,
          budget_exhausted: stats.budget_exhausted,
          predicted_first_completion_frames: stats.predicted_first_completion_frames ?? null,
          budget_slack: stats.budget_slack ?? null,
          first_completion_frame: stats.repair?.first_completion_frame ?? null,
          candidates_sampled: stats.candidates_sampled,
          candidates_viable: stats.candidates_viable,
          handoff_full_evaluations: stats.handoff_full_evaluations ?? 0,
          handoff_unique_full_evaluations: stats.handoff_unique_full_evaluations ?? 0,
          fwd_eval_frames_charged: stats.fwd_eval?.fwd_eval_frames_charged ?? 0,
          fwd_eval_calls: stats.fwd_eval?.fwd_eval_calls ?? 0,
          repair_frames_spent: stats.repair?.frames_spent ?? 0,
          repair_restarts: stats.repair?.restarts ?? 0,
          elapsed_ms: elapsedMs,
        });
        console.error(
          `budget-spend spec=${specName} seed=${seed} q=${qualityNCand} ` +
            `score=${score.score.toFixed(1)} sim=${stats.sim_frames} ` +
            `slack=${stats.budget_slack?.toFixed(2) ?? "na"}`,
        );
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
  }
} finally {
  if (previousQualityNCand === undefined) {
    delete process.env.LR_QUALITY_NCAND;
  } else {
    process.env.LR_QUALITY_NCAND = previousQualityNCand;
  }
}

const byCandidate = summarizeGroups(
  groupRows(rows, (row) => String(row.quality_ncand)),
);
const byCandidateAndSlackBand = summarizeGroups(
  groupRows(rows, (row) => `${row.quality_ncand}:${slackBand(row.budget_slack)}`),
);
const pairedVsBaseline = pairedDeltas(rows, baselineNCand);
const output = {
  config: {
    budget,
    specs: specNames,
    seeds,
    quality_ncand: qualityNCands,
    baseline_quality_ncand: baselineNCand,
  },
  rows,
  summary_by_quality_ncand: byCandidate,
  summary_by_quality_ncand_and_slack_band: byCandidateAndSlackBand,
  paired_vs_baseline: pairedVsBaseline,
};

if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
}

printSummary(byCandidate, pairedVsBaseline);
if (outPath !== undefined) console.log(`wrote ${outPath}`);

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

function intArg(name: string, fallback: number): number {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function intListArg(name: string, fallback: readonly number[]): number[] {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return [...fallback];
  return raw.split(",").map((x) => Number.parseInt(x, 10))
    .filter((x) => Number.isFinite(x));
}

function positiveIntListArg(name: string, fallback: readonly number[]): number[] {
  return intListArg(name, fallback).filter((x) => x > 0);
}

function specListArg(name: string, fallback: readonly GoldenSpecName[]): GoldenSpecName[] {
  const raw = arg(name);
  const values = raw === undefined || raw.trim() === ""
    ? [...fallback]
    : raw === "ALL"
      ? [...GOLDEN_SPECS]
      : raw.split(",") as GoldenSpecName[];
  for (const spec of values) {
    if (!(GOLDEN_SPECS as readonly string[]).includes(spec)) {
      throw new Error(`unknown golden spec "${spec}"`);
    }
  }
  return values;
}

function ensureIncludes(xs: number[], required: number): number[] {
  return xs.includes(required) ? xs : [...xs, required];
}

function groupRows<T>(
  values: readonly T[],
  keyOf: (value: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

function summarizeGroups(groups: Map<string, Row[]>): Summary[] {
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, group]) => ({
    key,
    n: group.length,
    valid: group.filter((row) => row.contract_passed).length,
    score_geomean: round(shiftedGeometricMean(group.map((row) => row.score)), 3),
    score_mean: round(mean(group.map((row) => row.score)), 3),
    sim_frames_mean: round(mean(group.map((row) => row.sim_frames)), 1),
    candidates_sampled_mean: round(mean(group.map((row) => row.candidates_sampled)), 1),
    candidates_viable_mean: round(mean(group.map((row) => row.candidates_viable)), 1),
    first_completion_mean: meanNullable(group.map((row) => row.first_completion_frame)),
    predicted_first_completion_mean: meanNullable(group.map((row) => row.predicted_first_completion_frames)),
    budget_slack_mean: meanNullable(group.map((row) => row.budget_slack)),
    fwd_eval_frames_mean: round(mean(group.map((row) => row.fwd_eval_frames_charged)), 1),
    repair_frames_mean: round(mean(group.map((row) => row.repair_frames_spent)), 1),
    full_evaluations_mean: round(mean(group.map((row) => row.handoff_full_evaluations)), 1),
  }));
}

function pairedDeltas(rows: readonly Row[], baselineNCandValue: number): PairedDelta[] {
  const byKey = new Map<string, Row>();
  for (const row of rows) {
    byKey.set(rowKey(row, row.quality_ncand), row);
  }
  const candidates = [...new Set(rows.map((row) => row.quality_ncand))]
    .filter((qualityNCand) => qualityNCand !== baselineNCandValue)
    .sort((a, b) => a - b);
  return candidates.map((qualityNCand) => {
    const deltas = rows
      .filter((row) => row.quality_ncand === qualityNCand)
      .map((row) => {
        const baseline = byKey.get(rowKey(row, baselineNCandValue));
        if (baseline === undefined) return null;
        return {
          score: row.score - baseline.score,
          sim: row.sim_frames - baseline.sim_frames,
          candidates: row.candidates_sampled - baseline.candidates_sampled,
          first: row.first_completion_frame !== null && baseline.first_completion_frame !== null
            ? row.first_completion_frame - baseline.first_completion_frame
            : null,
          repair: row.repair_frames_spent - baseline.repair_frames_spent,
        };
      })
      .filter((delta): delta is Delta => delta !== null);
    return {
      quality_ncand: qualityNCand,
      baseline_quality_ncand: baselineNCandValue,
      pairs: deltas.length,
      score_delta_mean: round(mean(deltas.map((delta) => delta.score)), 3),
      sim_frames_delta_mean: round(mean(deltas.map((delta) => delta.sim)), 1),
      candidates_sampled_delta_mean: round(mean(deltas.map((delta) => delta.candidates)), 1),
      first_completion_delta_mean: meanNullable(deltas.map((delta) => delta.first)),
      repair_frames_delta_mean: round(mean(deltas.map((delta) => delta.repair)), 1),
    };
  });
}

function rowKey(row: Pick<Row, "spec" | "seed">, qualityNCand: number): string {
  return `${row.spec}|${row.seed}|${qualityNCand}`;
}

function slackBand(slack: number | null): string {
  if (slack === null || !Number.isFinite(slack)) return "na";
  if (slack < 2) return "<2";
  if (slack < 3) return "2-3";
  if (slack < 5) return "3-5";
  return ">=5";
}

function mean(xs: readonly number[]): number {
  return xs.length === 0 ? NaN : xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

function meanNullable(xs: readonly (number | null)[]): number | null {
  const finite = xs.filter((x): x is number => x !== null && Number.isFinite(x));
  return finite.length === 0 ? null : round(mean(finite), 3);
}

function round(value: number, digits = 3): number {
  if (!Number.isFinite(value)) return value;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function fmt(value: number | null, digits = 1): string {
  return value === null || !Number.isFinite(value) ? "na" : value.toFixed(digits);
}

function printSummary(summaries: Summary[], deltas: PairedDelta[]): void {
  console.log(
    `budget-spend: budget=${budget} specs=${specNames.length} seeds=${seeds.length} ` +
      `quality_ncand=${qualityNCands.join(",")}`,
  );
  console.log("by quality_ncand:");
  for (const summary of summaries) {
    console.log(
      `  q=${summary.key.padStart(2)} n=${summary.n} valid=${summary.valid}/${summary.n} ` +
        `score_geo=${fmt(summary.score_geomean, 1)} score_mean=${fmt(summary.score_mean, 1)} ` +
        `sim=${fmt(summary.sim_frames_mean, 0)} cand=${fmt(summary.candidates_sampled_mean, 0)} ` +
        `first=${fmt(summary.first_completion_mean, 0)} slack=${fmt(summary.budget_slack_mean, 2)} ` +
        `fwd=${fmt(summary.fwd_eval_frames_mean, 0)} repair=${fmt(summary.repair_frames_mean, 0)}`,
    );
  }
  if (deltas.length > 0) {
    console.log(`paired deltas vs q=${baselineNCand}:`);
    for (const delta of deltas) {
      console.log(
        `  q=${delta.quality_ncand} pairs=${delta.pairs} ` +
          `dScore=${fmt(delta.score_delta_mean, 2)} ` +
          `dSim=${fmt(delta.sim_frames_delta_mean, 0)} ` +
          `dCand=${fmt(delta.candidates_sampled_delta_mean, 0)} ` +
          `dFirst=${fmt(delta.first_completion_delta_mean, 0)} ` +
          `dRepair=${fmt(delta.repair_frames_delta_mean, 0)}`,
      );
    }
  }
}
