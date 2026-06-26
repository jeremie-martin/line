/**
 * Admission/lookahead characterization.
 *
 * Sweeps unified candidate count, normal-pool admission profile, and forward
 * lookahead policy. This is the first controlled surface for testing whether
 * richer q-sampled candidates become useful once they are admitted into the
 * scored pool and ranked with enough forward reasoning.
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
const DEFAULT_BUDGET = 200_000;
const DEFAULT_QUALITY_NCAND = [24, 32, 48];
const DEFAULT_ADMISSION = ["default", "attempt-strata"] as const;
const DEFAULT_FWD_EVAL = ["default", "best:1:3", "best:1:5", "avg:1:5"] as const;
const DEFAULT_BASELINE_NCAND = 32;
const DEFAULT_BASELINE_ADMISSION = "default";
const DEFAULT_BASELINE_FWD_EVAL = "default";

type Row = {
  spec: string;
  seed: number;
  budget: number;
  quality_ncand: number;
  admission_profile: string;
  fwd_eval: string;
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
  admission_pools: number;
  admission_original_rank_mean: number | null;
  admission_original_rank_max: number | null;
  admitted_prefix: number;
  admitted_middle: number;
  admitted_tail: number;
  selected_prefix: number;
  selected_middle: number;
  selected_tail: number;
  elapsed_ms: number;
};

type PlannedRun = {
  ordinal: number;
  specName: GoldenSpecName;
  seed: number;
  qualityNCand: number;
  admissionProfile: string;
  fwdEval: string;
};

type ShardConfig = {
  index: number;
  count: number;
};

type Summary = {
  key: string;
  q: number;
  admission_profile: string;
  fwd_eval: string;
  n: number;
  valid: number;
  score_geomean: number;
  score_mean: number;
  first_completion_mean: number | null;
  candidates_sampled_mean: number;
  viability_rate_mean: number | null;
  fwd_eval_frames_mean: number;
  admission_original_rank_mean: number | null;
  selected_tail_mean: number;
  repair_frames_mean: number;
  elapsed_ms_mean: number;
};

type PairedSummary = {
  key: string;
  q: number;
  admission_profile: string;
  fwd_eval: string;
  baseline_q: number;
  baseline_admission_profile: string;
  baseline_fwd_eval: string;
  pairs: number;
  score_delta_mean: number;
  score_delta_p50: number;
  first_ratio_mean: number | null;
  candidate_ratio_mean: number | null;
  fwd_frames_delta_mean: number;
  repair_delta_mean: number;
};

const argv = process.argv.slice(2);
const budget = intArg("budget", DEFAULT_BUDGET);
const baselineNCand = intArg("baseline-ncand", DEFAULT_BASELINE_NCAND);
const baselineAdmission = arg("baseline-admission") ?? DEFAULT_BASELINE_ADMISSION;
const baselineFwdEval = arg("baseline-fwd-eval") ?? DEFAULT_BASELINE_FWD_EVAL;
const qualityNCands = ensureIncludes(
  positiveIntListArg("quality-ncand", DEFAULT_QUALITY_NCAND),
  baselineNCand,
).sort((a, b) => a - b);
const admissionProfiles = ensureIncludesString(
  stringListArg("admission", [...DEFAULT_ADMISSION]),
  baselineAdmission,
);
const fwdEvals = ensureIncludesString(
  stringListArg("fwd-eval", [...DEFAULT_FWD_EVAL]),
  baselineFwdEval,
);
const seeds = intListArg("seeds", DEFAULT_SEEDS);
const specNames = specListArg("specs", [...DEFAULT_SPECS]);
const outPath = arg("out");
const shard = shardArg("shard");
const previousQualityNCand = process.env.LR_QUALITY_NCAND;
const previousAdmission = process.env.LR_ADMISSION_PROFILE;
const previousFwdEval = process.env.LR_FWD_EVAL;
const plannedRuns = buildPlan(specNames, seeds, qualityNCands, admissionProfiles, fwdEvals);
const selectedRuns = plannedRuns.filter((run) => shard === null || run.ordinal % shard.count === shard.index);
const specCache = new Map<GoldenSpecName, Awaited<ReturnType<typeof loadGoldenSpec>>>();

const rows: Row[] = [];
try {
  for (const run of selectedRuns) {
    const spec = await specFor(run.specName);
    setEnvValue("LR_QUALITY_NCAND", String(run.qualityNCand));
    setEnvValue("LR_ADMISSION_PROFILE", run.admissionProfile);
    setEnvValue("LR_FWD_EVAL", run.fwdEval);
    const t0 = Date.now();
    const checkpoint = compileHandoff(spec, run.seed, { budget });
    const elapsedMs = Date.now() - t0;
    const score = scoreDriftReport(checkpoint.report, {
      totalFrames: secToFrame(spec.duration),
    });
    const stats = checkpoint.stats;
    const admission = stats.handoff_admission;
    const selected = stats.handoff_selected_candidate_by_admission_lane ?? {};
    rows.push({
      spec: run.specName,
      seed: run.seed,
      budget,
      quality_ncand: run.qualityNCand,
      admission_profile: run.admissionProfile,
      fwd_eval: run.fwdEval,
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
      admission_pools: admission?.pools ?? 0,
      admission_original_rank_mean: admission?.original_rank_mean ?? null,
      admission_original_rank_max: admission?.original_rank_max ?? null,
      admitted_prefix: admission?.admitted_by_lane.prefix ?? 0,
      admitted_middle: admission?.admitted_by_lane.middle ?? 0,
      admitted_tail: admission?.admitted_by_lane.tail ?? 0,
      selected_prefix: selected.prefix ?? 0,
      selected_middle: selected.middle ?? 0,
      selected_tail: selected.tail ?? 0,
      elapsed_ms: elapsedMs,
    });
    console.error(
      `admission-lookahead spec=${run.specName} seed=${run.seed} q=${run.qualityNCand} ` +
        `adm=${run.admissionProfile} fwd=${run.fwdEval} score=${score.score.toFixed(1)} sim=${stats.sim_frames}`,
    );
    await new Promise((resolve) => setImmediate(resolve));
  }
} finally {
  restoreEnv("LR_QUALITY_NCAND", previousQualityNCand);
  restoreEnv("LR_ADMISSION_PROFILE", previousAdmission);
  restoreEnv("LR_FWD_EVAL", previousFwdEval);
}

const output = {
  config: {
    budget,
    specs: specNames,
    seeds,
    study: "admission_lookahead",
    quality_ncand: qualityNCands,
    admission_profile: admissionProfiles,
    fwd_eval: fwdEvals,
    baseline_quality_ncand: baselineNCand,
    baseline_admission_profile: baselineAdmission,
    baseline_fwd_eval: baselineFwdEval,
    shard,
    planned_rows: plannedRuns.length,
    selected_rows: selectedRuns.length,
  },
  rows,
  summary_by_q_admission_fwd: summarize(rows),
  paired_vs_same_q_default: pairedSummaries(rows, "same_q"),
  paired_vs_global_default: pairedSummaries(rows, "global"),
};

if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
}

printSummary(output.summary_by_q_admission_fwd, output.paired_vs_same_q_default);
if (outPath !== undefined) console.log(`wrote ${outPath}`);

function buildPlan(
  specs: readonly GoldenSpecName[],
  seedValues: readonly number[],
  qualityNCandValues: readonly number[],
  admissionValues: readonly string[],
  fwdEvalValues: readonly string[],
): PlannedRun[] {
  const runs: PlannedRun[] = [];
  for (const specName of specs) {
    for (const seed of seedValues) {
      for (const qualityNCand of qualityNCandValues) {
        for (const admissionProfile of admissionValues) {
          for (const fwdEval of fwdEvalValues) {
            runs.push({ ordinal: runs.length, specName, seed, qualityNCand, admissionProfile, fwdEval });
          }
        }
      }
    }
  }
  return runs;
}

function summarize(values: readonly Row[]): Summary[] {
  return [...groupRows(values, (row) => `${row.quality_ncand}|${row.admission_profile}|${row.fwd_eval}`).entries()]
    .sort(([a], [b]) => compareGridKey(a, b))
    .map(([key, group]) => {
      const [qRaw, admissionProfile, fwdEval] = key.split("|");
      return {
        key,
        q: Number(qRaw),
        admission_profile: admissionProfile,
        fwd_eval: fwdEval,
        n: group.length,
        valid: group.filter((row) => row.contract_passed).length,
        score_geomean: round(shiftedGeometricMean(group.map((row) => row.score)), 3),
        score_mean: round(mean(group.map((row) => row.score)), 3),
        first_completion_mean: meanNullable(group.map((row) => row.first_completion_frame)),
        candidates_sampled_mean: round(mean(group.map((row) => row.candidates_sampled)), 1),
        viability_rate_mean: meanNullable(group.map((row) => row.viability_rate)),
        fwd_eval_frames_mean: round(mean(group.map((row) => row.fwd_eval_frames_charged)), 1),
        admission_original_rank_mean: meanNullable(group.map((row) => row.admission_original_rank_mean)),
        selected_tail_mean: round(mean(group.map((row) => row.selected_tail)), 3),
        repair_frames_mean: round(mean(group.map((row) => row.repair_frames_spent)), 1),
        elapsed_ms_mean: round(mean(group.map((row) => row.elapsed_ms)), 1),
      };
    });
}

function pairedSummaries(rowsIn: readonly Row[], mode: "same_q" | "global"): PairedSummary[] {
  const byKey = new Map<string, Row>();
  for (const row of rowsIn) byKey.set(rowKey(row.spec, row.seed, row.quality_ncand, row.admission_profile, row.fwd_eval), row);
  const groups = new Map<string, Array<{ row: Row; baseline: Row }>>();
  for (const row of rowsIn) {
    const baselineQ = mode === "same_q" ? row.quality_ncand : baselineNCand;
    const baseline = byKey.get(rowKey(row.spec, row.seed, baselineQ, baselineAdmission, baselineFwdEval));
    if (baseline === undefined) continue;
    if (
      row.quality_ncand === baselineQ &&
      row.admission_profile === baselineAdmission &&
      row.fwd_eval === baselineFwdEval
    ) continue;
    const key = `${row.quality_ncand}|${row.admission_profile}|${row.fwd_eval}|${baselineQ}|${baselineAdmission}|${baselineFwdEval}`;
    groups.set(key, [...(groups.get(key) ?? []), { row, baseline }]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => comparePairKey(a, b))
    .map(([key, group]) => {
      const [qRaw, admissionProfile, fwdEval, baselineQRaw, baselineAdmissionProfile, baselineFwd] = key.split("|");
      const firstRatios = group.map(({ row, baseline }) =>
        row.first_completion_frame !== null && baseline.first_completion_frame !== null &&
          baseline.first_completion_frame > 0
          ? row.first_completion_frame / baseline.first_completion_frame
          : null
      );
      const candidateRatios = group.map(({ row, baseline }) =>
        baseline.candidates_sampled > 0 ? row.candidates_sampled / baseline.candidates_sampled : null
      );
      const scoreDeltas = group.map(({ row, baseline }) => row.score - baseline.score);
      return {
        key,
        q: Number(qRaw),
        admission_profile: admissionProfile,
        fwd_eval: fwdEval,
        baseline_q: Number(baselineQRaw),
        baseline_admission_profile: baselineAdmissionProfile,
        baseline_fwd_eval: baselineFwd,
        pairs: group.length,
        score_delta_mean: round(mean(scoreDeltas), 3),
        score_delta_p50: round(quantile(scoreDeltas, 0.5), 3),
        first_ratio_mean: meanNullable(firstRatios),
        candidate_ratio_mean: meanNullable(candidateRatios),
        fwd_frames_delta_mean: round(mean(group.map(({ row, baseline }) =>
          row.fwd_eval_frames_charged - baseline.fwd_eval_frames_charged
        )), 1),
        repair_delta_mean: round(mean(group.map(({ row, baseline }) =>
          row.repair_frames_spent - baseline.repair_frames_spent
        )), 1),
      };
    });
}

function printSummary(summaries: Summary[], paired: PairedSummary[]): void {
  console.log(
    `admission-lookahead: budget=${budget} specs=${specNames.length} seeds=${seeds.length} ` +
      `q=${qualityNCands.join(",")} admission=${admissionProfiles.join(",")} fwd=${fwdEvals.join(",")}` +
      (shard === null ? "" : ` shard=${shard.index}/${shard.count} rows=${selectedRuns.length}/${plannedRuns.length}`),
  );
  console.log("by q/admission/fwd:");
  for (const summary of summaries) {
    console.log(
      `  q=${String(summary.q).padStart(2)} adm=${summary.admission_profile} fwd=${summary.fwd_eval} ` +
        `n=${summary.n} valid=${summary.valid}/${summary.n} score=${fmt(summary.score_mean, 1)} ` +
        `first=${fmt(summary.first_completion_mean, 0)} cand=${fmt(summary.candidates_sampled_mean, 0)} ` +
        `fwdFrames=${fmt(summary.fwd_eval_frames_mean, 0)} tailSel=${fmt(summary.selected_tail_mean, 2)} ` +
        `rank=${fmt(summary.admission_original_rank_mean, 2)}`,
    );
  }
  console.log("paired vs default admission/fwd at same q:");
  for (const row of paired) {
    console.log(
      `  q=${String(row.q).padStart(2)} adm=${row.admission_profile} fwd=${row.fwd_eval} pairs=${row.pairs} ` +
        `dScore=${fmt(row.score_delta_mean, 2)} p50=${fmt(row.score_delta_p50, 2)} ` +
        `first=${fmt(row.first_ratio_mean, 3)} cand=${fmt(row.candidate_ratio_mean, 3)} ` +
        `dFwd=${fmt(row.fwd_frames_delta_mean, 0)} dRepair=${fmt(row.repair_delta_mean, 0)}`,
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

function rowKey(spec: string, seed: number, q: number, admission: string, fwdEval: string): string {
  return `${spec}|${seed}|${q}|${admission}|${fwdEval}`;
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
  const [aq, aa, af] = a.split("|");
  const [bq, ba, bf] = b.split("|");
  const qDiff = Number(aq) - Number(bq);
  if (qDiff !== 0) return qDiff;
  const admissionDiff = aa.localeCompare(ba);
  return admissionDiff !== 0 ? admissionDiff : af.localeCompare(bf);
}

function comparePairKey(a: string, b: string): number {
  const [aq, aa, af, abq, aba, abf] = a.split("|");
  const [bq, ba, bf, bbq, bba, bbf] = b.split("|");
  return Number(aq) - Number(bq) ||
    aa.localeCompare(ba) ||
    af.localeCompare(bf) ||
    Number(abq) - Number(bbq) ||
    aba.localeCompare(bba) ||
    abf.localeCompare(bbf);
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

function positiveIntListArg(name: string, fallback: readonly number[]): number[] {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return [...fallback];
  return raw.split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function intListArg(name: string, fallback: readonly number[]): number[] {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return [...fallback];
  return raw.split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((value) => Number.isFinite(value));
}

function stringListArg(name: string, fallback: readonly string[]): string[] {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return [...fallback];
  return raw.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
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

function shardArg(name: string): ShardConfig | null {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return null;
  const [indexRaw, countRaw] = raw.split("/");
  const index = Number.parseInt(indexRaw, 10);
  const count = Number.parseInt(countRaw, 10);
  if (!Number.isInteger(index) || !Number.isInteger(count) || count <= 0 || index < 0 || index >= count) {
    throw new Error(`invalid --${name}; expected index/count`);
  }
  return { index, count };
}

function ensureIncludes(xs: number[], required: number): number[] {
  return xs.includes(required) ? xs : [...xs, required];
}

function ensureIncludesString(xs: string[], required: string): string[] {
  return xs.includes(required) ? xs : [...xs, required];
}

function setEnvValue(name: "LR_QUALITY_NCAND" | "LR_ADMISSION_PROFILE" | "LR_FWD_EVAL", value: string): void {
  if (value === "default") delete process.env[name];
  else process.env[name] = value;
}

function restoreEnv(name: "LR_QUALITY_NCAND" | "LR_ADMISSION_PROFILE" | "LR_FWD_EVAL", value: string | undefined): void {
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

function quantile(values: readonly number[], p: number): number {
  const finite = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (finite.length === 0) return NaN;
  const idx = Math.min(finite.length - 1, Math.max(0, Math.floor(p * (finite.length - 1))));
  return finite[idx];
}

function round(value: number, digits = 3): number {
  if (!Number.isFinite(value)) return value;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function fmt(value: number | null, digits: number): string {
  if (value === null || !Number.isFinite(value)) return "na";
  return value.toFixed(digits);
}
