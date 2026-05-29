#!/usr/bin/env tsx
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

type BaselineRow = {
  name?: string;
  spec?: string;
  seed: number;
  score: number;
  axis_quality?: number;
  axis_score?: number;
  passed?: boolean;
  contract_passed?: boolean;
};

type V1Row = {
  name?: string;
  spec?: string;
  seed: number;
  budget_units?: number;
  score: number;
  axis_quality?: number;
  contract_passed?: boolean;
  status?: string;
};

type CompareRow = {
  spec: string;
  seed: number;
  budget_units: number | null;
  baseline_score: number;
  v1_score: number;
  score_ratio: number;
  baseline_axis_quality: number | null;
  v1_axis_quality: number | null;
  baseline_passed: boolean;
  v1_passed: boolean;
  pass_delta: -1 | 0 | 1;
};

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value] as const;
  }),
);

const baselinePath = args.get("baseline") ?? "baselines/greedy_v1.json";
const v1Path = args.get("v1");
if (v1Path === undefined) {
  throw new Error("--v1=<path> is required");
}
const outPath = args.get("out");

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const v1 = JSON.parse(readFileSync(v1Path, "utf8"));
const baselineRows = rowsFromBaseline(baseline);
const v1Rows = rowsFromV1(v1);

const baselineByKey = new Map<string, BaselineRow>();
for (const row of baselineRows) {
  baselineByKey.set(rowKey(specName(row), row.seed), row);
}

const rows: CompareRow[] = [];
for (const row of v1Rows) {
  const key = rowKey(specName(row), row.seed);
  const base = baselineByKey.get(key);
  if (base === undefined) continue;
  const baselineScore = base.score;
  const v1Score = row.score;
  const baselinePassed = passed(base);
  const v1Passed = passed(row);
  rows.push({
    spec: specName(row),
    seed: row.seed,
    budget_units: row.budget_units ?? null,
    baseline_score: baselineScore,
    v1_score: v1Score,
    score_ratio: baselineScore === 0 ? (v1Score === 0 ? 1 : Infinity) : v1Score / baselineScore,
    baseline_axis_quality: axisQuality(base),
    v1_axis_quality: axisQuality(row),
    baseline_passed: baselinePassed,
    v1_passed: v1Passed,
    pass_delta: v1Passed === baselinePassed ? 0 : v1Passed ? 1 : -1,
  });
}

rows.sort((a, b) => {
  if (a.spec !== b.spec) return a.spec < b.spec ? -1 : 1;
  if (a.seed !== b.seed) return a.seed - b.seed;
  return (a.budget_units ?? -1) - (b.budget_units ?? -1);
});

const summary = {
  compared_rows: rows.length,
  baseline_rows: baselineRows.length,
  v1_rows: v1Rows.length,
  pass_rate_baseline: rate(rows, (row) => row.baseline_passed),
  pass_rate_v1: rate(rows, (row) => row.v1_passed),
  min_score_ratio: rows.length === 0 ? null : Math.min(...rows.map((row) => row.score_ratio)),
  mean_score_ratio: rows.length === 0 ? null : mean(rows.map((row) => row.score_ratio)),
  rows_below_95_percent: rows.filter((row) => row.score_ratio < 0.95).length,
  pass_regressions: rows.filter((row) => row.pass_delta < 0).length,
};

const result = { baseline: baselinePath, v1: v1Path, summary, rows };
const text = `${JSON.stringify(result, null, 2)}\n`;
if (outPath !== undefined) {
  const resolved = resolve(outPath);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, text);
}
process.stdout.write(text);

function rowsFromBaseline(input: unknown): BaselineRow[] {
  const value = input as { rows?: BaselineRow[]; specs?: BaselineRow[] };
  return value.rows ?? value.specs ?? [];
}

function rowsFromV1(input: unknown): V1Row[] {
  const value = input as {
    rows?: V1Row[];
    specs?: V1Row[];
    budget_sweep?: Array<{ specs: V1Row[] }>;
  };
  if (value.rows !== undefined) return value.rows;
  if (value.specs !== undefined) return value.specs;
  if (value.budget_sweep !== undefined) {
    return value.budget_sweep.flatMap((point) => point.specs);
  }
  return [];
}

function specName(row: { name?: string; spec?: string }): string {
  const out = row.name ?? row.spec;
  if (out === undefined) throw new Error(`row missing spec/name: ${JSON.stringify(row)}`);
  return out;
}

function rowKey(spec: string, seed: number): string {
  return `${spec}\u0000${seed}`;
}

function axisQuality(row: BaselineRow | V1Row): number | null {
  return row.axis_quality ?? (row as BaselineRow).axis_score ?? null;
}

function passed(row: BaselineRow | V1Row): boolean {
  if ("contract_passed" in row && row.contract_passed !== undefined) return row.contract_passed;
  if ("passed" in row && row.passed !== undefined) return row.passed;
  if ("status" in row && row.status !== undefined) return row.status === "pass";
  return false;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rate<T>(values: readonly T[], predicate: (value: T) => boolean): number {
  return values.length === 0 ? 0 : values.filter(predicate).length / values.length;
}
