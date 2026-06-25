/**
 * Aggregate one or more `study_budget_spend.ts` JSON outputs.
 *
 * Example:
 *
 *   node --import tsx scripts/v0/analyze_budget_spend.ts \
 *     --inputs=generated/studies/contract-ncand-125k-panel.json,generated/studies/contract-ncand-500k-panel.json \
 *     --out=generated/studies/contract-ncand-panel-analysis.json
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type StudyKnob = "quality_ncand" | "contract_ncand";

type StudyFile = {
  config: {
    budget: number;
    specs: string[];
    seeds: number[];
    study_knob: StudyKnob;
    knob_values: number[];
    baseline_value: number;
  };
  rows: Row[];
};

type Row = {
  spec: string;
  seed: number;
  budget: number;
  quality_ncand: number;
  contract_ncand: number | null;
  score: number;
  contract_passed: boolean;
  sim_frames: number;
  predicted_first_completion_frames: number | null;
  budget_slack: number | null;
  first_completion_frame: number | null;
  candidates_sampled: number;
  fwd_eval_frames_charged: number;
  repair_frames_spent: number;
};

type Delta = {
  score: number;
  valid: number;
  sim: number;
  candidates: number;
  first: number | null;
  firstRatio: number | null;
  fwd: number;
  repair: number;
};

type DeltaSummary = {
  group: string;
  knob_value: number;
  baseline_value: number;
  pairs: number;
  score_delta_mean: number;
  validity_delta_mean: number;
  sim_frames_delta_mean: number;
  candidates_sampled_delta_mean: number;
  first_completion_delta_mean: number | null;
  first_completion_ratio_mean: number | null;
  fwd_eval_frames_delta_mean: number;
  repair_frames_delta_mean: number;
};

type LinearModel = {
  group: string;
  target: "first_completion_frame / predicted_first_completion_frames";
  feature: string;
  baseline_value: number;
  n: number;
  intercept: number;
  slope: number;
  r2: number;
  frame_mae: number;
};

type Sample = {
  row: Row;
  knobValue: number;
  x: number;
  y: number;
};

const argv = process.argv.slice(2);
const inputPaths = inputList();
if (inputPaths.length === 0) {
  throw new Error("usage: --inputs=a.json,b.json [--out=analysis.json]");
}
const outPath = arg("out");
const studies = inputPaths.map((path) => readStudy(path));
const knob = studies[0]?.config.study_knob;
if (knob === undefined) throw new Error("no studies loaded");
for (const study of studies) {
  if (study.config.study_knob !== knob) {
    throw new Error(`mixed study knobs: ${knob} and ${study.config.study_knob}`);
  }
}
const baseline = studies[0].config.baseline_value;
for (const study of studies) {
  if (study.config.baseline_value !== baseline) {
    throw new Error(`mixed baseline values: ${baseline} and ${study.config.baseline_value}`);
  }
}

const rows = studies.flatMap((study) => study.rows);
const budgets = [...new Set(rows.map((row) => row.budget))].sort((a, b) => a - b);
const values = [...new Set(rows.map(knobValue).filter((value): value is number => value !== null))]
  .sort((a, b) => a - b);
const output = {
  config: {
    inputs: inputPaths,
    study_knob: knob,
    baseline_value: baseline,
    budgets,
    knob_values: values,
    rows: rows.length,
  },
  paired_by_budget: pairedSummaries(rows, (row) => String(row.budget)),
  paired_by_slack_band: pairedSummaries(rows, (row) => slackBand(row.budget_slack)),
  paired_all: pairedSummaries(rows, () => "all"),
  first_completion_model_by_budget: fitModels(rows, (row) => String(row.budget)),
  first_completion_model_by_slack_band: fitModels(rows, (row) => slackBand(row.budget_slack)),
  first_completion_model_all: fitModels(rows, () => "all"),
};

if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
}

printSummary(output);
if (outPath !== undefined) console.log(`wrote ${outPath}`);

function readStudy(path: string): StudyFile {
  return JSON.parse(readFileSync(path, "utf8")) as StudyFile;
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function inputList(): string[] {
  const raw = arg("inputs");
  if (raw !== undefined && raw.trim() !== "") return raw.split(",").filter((x) => x.trim() !== "");
  return argv.filter((value) => !value.startsWith("--"));
}

function knobValue(row: Row): number | null {
  return knob === "quality_ncand" ? row.quality_ncand : row.contract_ncand;
}

function pairedSummaries(rowsIn: readonly Row[], groupOf: (row: Row) => string): DeltaSummary[] {
  const baselineRows = new Map<string, Row>();
  for (const row of rowsIn) {
    const value = knobValue(row);
    if (value === baseline) baselineRows.set(pairKey(row), row);
  }
  const byGroupAndValue = new Map<string, Delta[]>();
  for (const row of rowsIn) {
    const value = knobValue(row);
    if (value === null || value === baseline) continue;
    const base = baselineRows.get(pairKey(row));
    if (base === undefined) continue;
    const key = `${groupOf(row)}|${value}`;
    byGroupAndValue.set(key, [...(byGroupAndValue.get(key) ?? []), delta(row, base)]);
  }
  return [...byGroupAndValue.entries()]
    .map(([key, deltas]) => {
      const [group, value] = key.split("|");
      return summarizeDeltas(group, Number(value), deltas);
    })
    .sort((a, b) => compareGroup(a.group, b.group) || a.knob_value - b.knob_value);
}

function delta(row: Row, base: Row): Delta {
  return {
    score: row.score - base.score,
    valid: Number(row.contract_passed) - Number(base.contract_passed),
    sim: row.sim_frames - base.sim_frames,
    candidates: row.candidates_sampled - base.candidates_sampled,
    first: row.first_completion_frame !== null && base.first_completion_frame !== null
      ? row.first_completion_frame - base.first_completion_frame
      : null,
    firstRatio: row.first_completion_frame !== null && base.first_completion_frame !== null &&
        base.first_completion_frame > 0
      ? row.first_completion_frame / base.first_completion_frame
      : null,
    fwd: row.fwd_eval_frames_charged - base.fwd_eval_frames_charged,
    repair: row.repair_frames_spent - base.repair_frames_spent,
  };
}

function summarizeDeltas(group: string, value: number, deltas: readonly Delta[]): DeltaSummary {
  return {
    group,
    knob_value: value,
    baseline_value: baseline,
    pairs: deltas.length,
    score_delta_mean: round(mean(deltas.map((item) => item.score)), 3),
    validity_delta_mean: round(mean(deltas.map((item) => item.valid)), 4),
    sim_frames_delta_mean: round(mean(deltas.map((item) => item.sim)), 1),
    candidates_sampled_delta_mean: round(mean(deltas.map((item) => item.candidates)), 1),
    first_completion_delta_mean: meanNullable(deltas.map((item) => item.first)),
    first_completion_ratio_mean: meanNullable(deltas.map((item) => item.firstRatio)),
    fwd_eval_frames_delta_mean: round(mean(deltas.map((item) => item.fwd)), 1),
    repair_frames_delta_mean: round(mean(deltas.map((item) => item.repair)), 1),
  };
}

function fitModels(rowsIn: readonly Row[], groupOf: (row: Row) => string): LinearModel[] {
  const byGroup = groupRows(rowsIn, groupOf);
  return [...byGroup.entries()]
    .map(([group, groupRowsValue]) => fitModel(group, groupRowsValue))
    .filter((model): model is LinearModel => model !== null)
    .sort((a, b) => compareGroup(a.group, b.group));
}

function fitModel(group: string, rowsIn: readonly Row[]): LinearModel | null {
  const samples = rowsIn
    .map((row): Sample | null => {
      const value = knobValue(row);
      if (
        value === null ||
        row.first_completion_frame === null ||
        row.predicted_first_completion_frames === null ||
        row.predicted_first_completion_frames <= 0
      ) return null;
      return {
        row,
        knobValue: value,
        x: value / baseline - 1,
        y: row.first_completion_frame / row.predicted_first_completion_frames,
      };
    })
    .filter((sample): sample is Sample => sample !== null);
  if (samples.length < 2) return null;
  const xMean = mean(samples.map((sample) => sample.x));
  const yMean = mean(samples.map((sample) => sample.y));
  const sxx = samples.reduce((sum, sample) => sum + (sample.x - xMean) ** 2, 0);
  const sxy = samples.reduce((sum, sample) => sum + (sample.x - xMean) * (sample.y - yMean), 0);
  const slope = sxx > 1e-12 ? sxy / sxx : 0;
  const intercept = yMean - slope * xMean;
  const errors = samples.map((sample) => sample.y - (intercept + slope * sample.x));
  const frameErrors = samples.map((sample) =>
    sample.row.first_completion_frame! -
      (intercept + slope * sample.x) * sample.row.predicted_first_completion_frames!
  );
  const sst = samples.reduce((sum, sample) => sum + (sample.y - yMean) ** 2, 0);
  const sse = errors.reduce((sum, error) => sum + error ** 2, 0);
  return {
    group,
    target: "first_completion_frame / predicted_first_completion_frames",
    feature: `${knob} / baseline_${knob} - 1`,
    baseline_value: baseline,
    n: samples.length,
    intercept: round(intercept, 6),
    slope: round(slope, 6),
    r2: round(1 - sse / Math.max(1e-12, sst), 4),
    frame_mae: round(mean(frameErrors.map(Math.abs)), 1),
  };
}

function pairKey(row: Pick<Row, "budget" | "spec" | "seed">): string {
  return `${row.budget}|${row.spec}|${row.seed}`;
}

function slackBand(slack: number | null): string {
  if (slack === null || !Number.isFinite(slack)) return "na";
  if (slack < 2) return "<2";
  if (slack < 3) return "2-3";
  if (slack < 5) return "3-5";
  if (slack < 8) return "5-8";
  return ">=8";
}

function groupRows<T>(valuesIn: readonly T[], keyOf: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of valuesIn) {
    const key = keyOf(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

function compareGroup(a: string, b: string): number {
  const slackOrder = new Map([
    ["<2", 0],
    ["2-3", 1],
    ["3-5", 2],
    ["5-8", 3],
    [">=8", 4],
    ["na", 5],
  ]);
  const as = slackOrder.get(a);
  const bs = slackOrder.get(b);
  if (as !== undefined && bs !== undefined) return as - bs;
  const an = Number(a);
  const bn = Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return a.localeCompare(b);
}

function mean(valuesIn: readonly number[]): number {
  return valuesIn.length === 0 ? NaN : valuesIn.reduce((sum, value) => sum + value, 0) / valuesIn.length;
}

function meanNullable(valuesIn: readonly (number | null)[]): number | null {
  const finite = valuesIn.filter((value): value is number => value !== null && Number.isFinite(value));
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

function printSummary(result: typeof output): void {
  console.log(
    `budget-spend-analysis: knob=${result.config.study_knob} baseline=${result.config.baseline_value} ` +
      `budgets=${result.config.budgets.join(",")} rows=${result.config.rows}`,
  );
  console.log("paired deltas by budget:");
  for (const item of result.paired_by_budget) {
    console.log(
      `  b=${item.group} v=${item.knob_value} pairs=${item.pairs} ` +
        `dScore=${fmt(item.score_delta_mean, 2)} dFirst=${fmt(item.first_completion_delta_mean, 0)} ` +
        `ratio=${fmt(item.first_completion_ratio_mean, 3)} dCand=${fmt(item.candidates_sampled_delta_mean, 0)} ` +
        `dRepair=${fmt(item.repair_frames_delta_mean, 0)}`,
    );
  }
  console.log("first-completion models by budget:");
  for (const model of result.first_completion_model_by_budget) {
    console.log(
      `  b=${model.group} mult=${model.intercept.toFixed(4)} + ${model.slope.toFixed(4)}*x ` +
        `n=${model.n} r2=${model.r2.toFixed(3)} mae=${fmt(model.frame_mae, 0)}f`,
    );
  }
  console.log("paired deltas by slack band:");
  for (const item of result.paired_by_slack_band) {
    console.log(
      `  slack=${item.group} v=${item.knob_value} pairs=${item.pairs} ` +
        `dScore=${fmt(item.score_delta_mean, 2)} dFirst=${fmt(item.first_completion_delta_mean, 0)} ` +
        `ratio=${fmt(item.first_completion_ratio_mean, 3)}`,
    );
  }
}
