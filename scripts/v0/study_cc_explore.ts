/**
 * Contact-centered exploration-width characterization.
 *
 * Sweeps the unified quality candidate count together with LR_CC_EXPLORE, the
 * study-only late-tail roll widening factor in arc_placement.ts. The default
 * factor 1.0 is production behavior; larger values widen only late attempts, so
 * low-q prefixes remain conservative while larger q values buy wider geometry.
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
  "dense_sprint",
  "syncopated_switchback",
  "drums_pendulum",
  "solo_run",
  "rolling_hills",
  "skyline_push",
  "dense_echo_climb",
  "climb_terrace",
  "glide_stairs",
  "drums_signature",
] as const satisfies readonly GoldenSpecName[];
const DEFAULT_SEEDS = [0, 1, 2, 3, 4, 5];
const DEFAULT_BUDGET = 150_000;
const DEFAULT_QUALITY_NCAND = [24, 32, 48];
const DEFAULT_CC_EXPLORE = [1, 1.25, 1.5, 1.75];
const DEFAULT_BASELINE_NCAND = 32;
const DEFAULT_BASELINE_CC_EXPLORE = 1;

type Row = {
  spec: string;
  seed: number;
  budget: number;
  quality_ncand: number;
  cc_explore: number;
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
  viability_rate: number | null;
  handoff_full_evaluations: number;
  handoff_unique_full_evaluations: number;
  fwd_eval_frames_charged: number;
  fwd_eval_calls: number;
  repair_frames_spent: number;
  repair_restarts: number;
  elapsed_ms: number;
};

type PlannedRun = {
  ordinal: number;
  specName: GoldenSpecName;
  seed: number;
  qualityNCand: number;
  ccExplore: number;
};

type ShardConfig = {
  index: number;
  count: number;
};

type Summary = {
  key: string;
  q: number;
  cc_explore: number;
  n: number;
  valid: number;
  score_geomean: number;
  score_mean: number;
  first_completion_mean: number | null;
  candidates_sampled_mean: number;
  candidates_viable_mean: number;
  viability_rate_mean: number | null;
  fwd_eval_frames_mean: number;
  repair_frames_mean: number;
  elapsed_ms_mean: number;
};

type PairedSummary = {
  key: string;
  q: number;
  cc_explore: number;
  baseline_q: number;
  baseline_cc_explore: number;
  pairs: number;
  score_delta_mean: number;
  first_ratio_mean: number | null;
  candidate_ratio_mean: number | null;
  viability_delta_mean: number | null;
  repair_delta_mean: number;
};

const argv = process.argv.slice(2);
const budget = intArg("budget", DEFAULT_BUDGET);
const baselineNCand = intArg("baseline-ncand", DEFAULT_BASELINE_NCAND);
const baselineCcExplore = floatArg("baseline-cc-explore", DEFAULT_BASELINE_CC_EXPLORE);
const qualityNCands = ensureIncludes(
  positiveIntListArg("quality-ncand", DEFAULT_QUALITY_NCAND),
  baselineNCand,
).sort((a, b) => a - b);
const ccExplores = ensureIncludesFloat(
  positiveFloatListArg("cc-explore", DEFAULT_CC_EXPLORE),
  baselineCcExplore,
).sort((a, b) => a - b);
const seeds = intListArg("seeds", DEFAULT_SEEDS);
const specNames = specListArg("specs", [...DEFAULT_SPECS]);
const outPath = arg("out");
const shard = shardArg("shard");
const previousQualityNCand = process.env.LR_QUALITY_NCAND;
const previousCcExplore = process.env.LR_CC_EXPLORE;
const plannedRuns = buildPlan(specNames, seeds, qualityNCands, ccExplores);
const selectedRuns = plannedRuns.filter((run) => shard === null || run.ordinal % shard.count === shard.index);
const specCache = new Map<GoldenSpecName, Awaited<ReturnType<typeof loadGoldenSpec>>>();

const rows: Row[] = [];
try {
  for (const run of selectedRuns) {
    const spec = await specFor(run.specName);
    process.env.LR_QUALITY_NCAND = String(run.qualityNCand);
    process.env.LR_CC_EXPLORE = String(run.ccExplore);
    const t0 = Date.now();
    const checkpoint = compileHandoff(spec, run.seed, { budget });
    const elapsedMs = Date.now() - t0;
    const score = scoreDriftReport(checkpoint.report, {
      totalFrames: secToFrame(spec.duration),
    });
    const stats = checkpoint.stats;
    rows.push({
      spec: run.specName,
      seed: run.seed,
      budget,
      quality_ncand: run.qualityNCand,
      cc_explore: run.ccExplore,
      score: round(score.score, 4),
      contract_passed: score.contract_passed,
      axis_quality: round(score.axis_quality, 6),
      sim_frames: stats.sim_frames,
      budget_exhausted: stats.budget_exhausted,
      predicted_first_completion_frames: stats.predicted_first_completion_frames ?? null,
      budget_slack: stats.budget_slack ?? null,
      first_completion_frame: stats.first_completion_frame ?? stats.repair?.first_completion_frame ?? null,
      candidates_sampled: stats.candidates_sampled,
      candidates_viable: stats.candidates_viable,
      viability_rate: stats.candidates_sampled > 0 ? round(stats.candidates_viable / stats.candidates_sampled, 6) : null,
      handoff_full_evaluations: stats.handoff_full_evaluations ?? 0,
      handoff_unique_full_evaluations: stats.handoff_unique_full_evaluations ?? 0,
      fwd_eval_frames_charged: stats.fwd_eval?.fwd_eval_frames_charged ?? 0,
      fwd_eval_calls: stats.fwd_eval?.fwd_eval_calls ?? 0,
      repair_frames_spent: stats.repair?.frames_spent ?? 0,
      repair_restarts: stats.repair?.restarts ?? 0,
      elapsed_ms: elapsedMs,
    });
    console.error(
      `cc-explore spec=${run.specName} seed=${run.seed} q=${run.qualityNCand} ` +
        `x=${run.ccExplore} score=${score.score.toFixed(1)} sim=${stats.sim_frames}`,
    );
    await new Promise((resolve) => setImmediate(resolve));
  }
} finally {
  restoreEnv("LR_QUALITY_NCAND", previousQualityNCand);
  restoreEnv("LR_CC_EXPLORE", previousCcExplore);
}

const output = {
  config: {
    budget,
    specs: specNames,
    seeds,
    study: "cc_explore",
    quality_ncand: qualityNCands,
    cc_explore: ccExplores,
    baseline_quality_ncand: baselineNCand,
    baseline_cc_explore: baselineCcExplore,
    shard,
    planned_rows: plannedRuns.length,
    selected_rows: selectedRuns.length,
  },
  rows,
  summary_by_q_explore: summarize(rows),
  paired_vs_default_explore_by_q: pairedSummaries(rows, "same_q"),
  paired_vs_default_q_explore: pairedSummaries(rows, "global"),
};

if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
}

printSummary(output.summary_by_q_explore, output.paired_vs_default_explore_by_q);
if (outPath !== undefined) console.log(`wrote ${outPath}`);

function buildPlan(
  specs: readonly GoldenSpecName[],
  seedValues: readonly number[],
  qualityNCandValues: readonly number[],
  ccExploreValues: readonly number[],
): PlannedRun[] {
  const runs: PlannedRun[] = [];
  for (const specName of specs) {
    for (const seed of seedValues) {
      for (const qualityNCand of qualityNCandValues) {
        for (const ccExplore of ccExploreValues) {
          runs.push({ ordinal: runs.length, specName, seed, qualityNCand, ccExplore });
        }
      }
    }
  }
  return runs;
}

function summarize(values: readonly Row[]): Summary[] {
  return [...groupRows(values, (row) => `${row.quality_ncand}|${row.cc_explore}`).entries()]
    .sort(([a], [b]) => compareGridKey(a, b))
    .map(([key, group]) => {
      const [q, ccExplore] = key.split("|").map(Number);
      return {
        key,
        q,
        cc_explore: ccExplore,
        n: group.length,
        valid: group.filter((row) => row.contract_passed).length,
        score_geomean: round(shiftedGeometricMean(group.map((row) => row.score)), 3),
        score_mean: round(mean(group.map((row) => row.score)), 3),
        first_completion_mean: meanNullable(group.map((row) => row.first_completion_frame)),
        candidates_sampled_mean: round(mean(group.map((row) => row.candidates_sampled)), 1),
        candidates_viable_mean: round(mean(group.map((row) => row.candidates_viable)), 1),
        viability_rate_mean: meanNullable(group.map((row) => row.viability_rate)),
        fwd_eval_frames_mean: round(mean(group.map((row) => row.fwd_eval_frames_charged)), 1),
        repair_frames_mean: round(mean(group.map((row) => row.repair_frames_spent)), 1),
        elapsed_ms_mean: round(mean(group.map((row) => row.elapsed_ms)), 1),
      };
    });
}

function pairedSummaries(rowsIn: readonly Row[], mode: "same_q" | "global"): PairedSummary[] {
  const byKey = new Map<string, Row>();
  for (const row of rowsIn) byKey.set(rowKey(row.spec, row.seed, row.quality_ncand, row.cc_explore), row);
  const groups = new Map<string, Array<{ row: Row; baseline: Row }>>();
  for (const row of rowsIn) {
    const baselineQ = mode === "same_q" ? row.quality_ncand : baselineNCand;
    const baseline = byKey.get(rowKey(row.spec, row.seed, baselineQ, baselineCcExplore));
    if (baseline === undefined) continue;
    if (row.quality_ncand === baselineQ && row.cc_explore === baselineCcExplore) continue;
    const key = `${row.quality_ncand}|${row.cc_explore}|${baselineQ}|${baselineCcExplore}`;
    groups.set(key, [...(groups.get(key) ?? []), { row, baseline }]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => comparePairKey(a, b))
    .map(([key, group]) => {
      const [q, ccExplore, baselineQ, baselineExplore] = key.split("|").map(Number);
      const firstRatios = group
        .map(({ row, baseline }) =>
          row.first_completion_frame !== null && baseline.first_completion_frame !== null &&
            baseline.first_completion_frame > 0
            ? row.first_completion_frame / baseline.first_completion_frame
            : null
        );
      const candidateRatios = group
        .map(({ row, baseline }) =>
          baseline.candidates_sampled > 0 ? row.candidates_sampled / baseline.candidates_sampled : null
        );
      const viabilityDeltas = group
        .map(({ row, baseline }) =>
          row.viability_rate !== null && baseline.viability_rate !== null
            ? row.viability_rate - baseline.viability_rate
            : null
        );
      return {
        key,
        q,
        cc_explore: ccExplore,
        baseline_q: baselineQ,
        baseline_cc_explore: baselineExplore,
        pairs: group.length,
        score_delta_mean: round(mean(group.map(({ row, baseline }) => row.score - baseline.score)), 3),
        first_ratio_mean: meanNullable(firstRatios),
        candidate_ratio_mean: meanNullable(candidateRatios),
        viability_delta_mean: meanNullable(viabilityDeltas),
        repair_delta_mean: round(mean(group.map(({ row, baseline }) =>
          row.repair_frames_spent - baseline.repair_frames_spent
        )), 1),
      };
    });
}

function printSummary(summaries: Summary[], paired: PairedSummary[]): void {
  console.log(
    `cc-explore: budget=${budget} specs=${specNames.length} seeds=${seeds.length} ` +
      `q=${qualityNCands.join(",")} x=${ccExplores.join(",")}` +
      (shard === null ? "" : ` shard=${shard.index}/${shard.count} rows=${selectedRuns.length}/${plannedRuns.length}`),
  );
  console.log("by q/explore:");
  for (const summary of summaries) {
    console.log(
      `  q=${String(summary.q).padStart(2)} x=${summary.cc_explore.toFixed(2)} ` +
        `n=${summary.n} valid=${summary.valid}/${summary.n} ` +
        `score=${fmt(summary.score_mean, 1)} first=${fmt(summary.first_completion_mean, 0)} ` +
        `cand=${fmt(summary.candidates_sampled_mean, 0)} viable=${fmt(summary.viability_rate_mean, 3)} ` +
        `repair=${fmt(summary.repair_frames_mean, 0)}`,
    );
  }
  console.log("paired vs x=1 at same q:");
  for (const row of paired) {
    console.log(
      `  q=${String(row.q).padStart(2)} x=${row.cc_explore.toFixed(2)} pairs=${row.pairs} ` +
        `dScore=${fmt(row.score_delta_mean, 2)} first=${fmt(row.first_ratio_mean, 3)} ` +
        `cand=${fmt(row.candidate_ratio_mean, 3)} dViable=${fmt(row.viability_delta_mean, 4)} ` +
        `dRepair=${fmt(row.repair_delta_mean, 0)}`,
    );
  }
}

async function specFor(specName: GoldenSpecName): Promise<Awaited<ReturnType<typeof loadGoldenSpec>>> {
  const cached = specCache.get(specName);
  if (cached !== undefined) return cached;
  const loaded = await loadGoldenSpec(specName, "base");
  specCache.set(specName, loaded);
  return loaded;
}

function rowKey(spec: string, seed: number, q: number, ccExplore: number): string {
  return `${spec}|${seed}|${q}|${ccExplore}`;
}

function groupRows<T>(values: readonly T[], keyOf: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

function compareGridKey(a: string, b: string): number {
  const [aq, ax] = a.split("|").map(Number);
  const [bq, bx] = b.split("|").map(Number);
  return aq === bq ? ax - bx : aq - bq;
}

function comparePairKey(a: string, b: string): number {
  const [aq, ax, abq, abx] = a.split("|").map(Number);
  const [bq, bx, bbq, bbx] = b.split("|").map(Number);
  return aq === bq
    ? ax === bx
      ? abq === bbq ? abx - bbx : abq - bbq
      : ax - bx
    : aq - bq;
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function intArg(name: string, fallback: number): number {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function floatArg(name: string, fallback: number): number {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function intListArg(name: string, fallback: readonly number[]): number[] {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return [...fallback];
  return raw.split(",").map((x) => Number.parseInt(x, 10)).filter((x) => Number.isFinite(x));
}

function positiveIntListArg(name: string, fallback: readonly number[]): number[] {
  return intListArg(name, fallback).filter((x) => x > 0);
}

function floatListArg(name: string, fallback: readonly number[]): number[] {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return [...fallback];
  return raw.split(",").map((x) => Number.parseFloat(x)).filter((x) => Number.isFinite(x));
}

function positiveFloatListArg(name: string, fallback: readonly number[]): number[] {
  return floatListArg(name, fallback).filter((x) => x > 0);
}

function shardArg(name: string): ShardConfig | null {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return null;
  const match = /^(\d+)\/(\d+)$/.exec(raw.trim());
  if (match === null) throw new Error(`--${name} must look like 0/48`);
  const index = Number.parseInt(match[1], 10);
  const count = Number.parseInt(match[2], 10);
  if (!(count > 0) || index < 0 || index >= count) {
    throw new Error(`--${name} index must satisfy 0 <= index < count; got ${raw}`);
  }
  return { index, count };
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

function ensureIncludesFloat(xs: number[], required: number): number[] {
  return xs.some((x) => Math.abs(x - required) < 1e-9) ? xs : [...xs, required];
}

function restoreEnv(name: "LR_QUALITY_NCAND" | "LR_CC_EXPLORE", value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? NaN : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function meanNullable(values: readonly (number | null)[]): number | null {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return finite.length === 0 ? null : round(mean(finite), 4);
}

function round(value: number, digits = 3): number {
  if (!Number.isFinite(value)) return value;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function fmt(value: number | null, digits = 1): string {
  return value === null || !Number.isFinite(value) ? "na" : value.toFixed(digits);
}
