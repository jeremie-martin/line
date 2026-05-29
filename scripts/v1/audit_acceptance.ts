#!/usr/bin/env tsx
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { GOLDEN_SEEDS, GOLDEN_SPECS } from "../v0/golden_suite.ts";

type Row = {
  name?: string;
  spec?: string;
  seed: number;
  score: number;
  axis_quality?: number;
  axis_score?: number;
  contract_passed?: boolean;
  passed?: boolean;
  status?: string;
  budget_units?: number;
};

type NormalizedRow = {
  spec: string;
  seed: number;
  score: number;
  axis_quality: number | null;
  passed: boolean;
  budget_units: number | null;
  source: string;
};

type CompareRow = {
  spec: string;
  seed: number;
  reference_score: number;
  candidate_score: number;
  score_ratio: number;
  reference_axis_quality: number | null;
  candidate_axis_quality: number | null;
  reference_passed: boolean;
  candidate_passed: boolean;
  pass_delta: -1 | 0 | 1;
  candidate_budget_units: number | null;
  reference_source: string;
  candidate_source: string;
};

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value] as const;
  }),
);

const frozenPath = args.get("frozen") ?? "baselines/greedy_v1.json";
const currentV0Path = args.get("current-v0") ?? "benchmark-results/v1/current-v0-overlap-seed0.json";
const v1Paths = splitPaths(args.get("v1") ?? [
  "benchmark-results/v1/current-overlap-seed0.json",
  "benchmark-results/v1/replay-derived-report-impact.json",
  "benchmark-results/v1/drums-signature-current-v1-range-derived-json-full.json",
  "benchmark-results/v1/syncopated-switchback-current-v1-json-full.json",
  "benchmark-results/v1/range-derived-tiny-current.json",
].join(","));
const outPath = args.get("out");
const threshold = Number(args.get("threshold") ?? "0.95");

const frozenRows = loadRows(frozenPath);
const currentV0Rows = loadRows(currentV0Path);
const v1Rows = mergeRows(v1Paths.flatMap(loadRows));

const frozenVsCurrentV0 = compare(frozenRows, currentV0Rows);
const currentV0VsV1 = compare(currentV0Rows, v1Rows);
const frozenVsV1 = compare(frozenRows, v1Rows);

const result = {
  generated_at: new Date().toISOString(),
  expected_headline_rows: GOLDEN_SPECS.length * GOLDEN_SEEDS.length,
  threshold,
  sources: {
    frozen: frozenPath,
    current_v0: currentV0Path,
    v1: v1Paths,
  },
  row_counts: {
    frozen: frozenRows.length,
    current_v0: currentV0Rows.length,
    v1: v1Rows.length,
  },
  summaries: {
    frozen_vs_current_v0: summarize(frozenVsCurrentV0, threshold),
    current_v0_vs_v1: summarize(currentV0VsV1, threshold),
    frozen_vs_v1: summarize(frozenVsV1, threshold),
  },
  rows: {
    frozen_vs_current_v0: frozenVsCurrentV0,
    current_v0_vs_v1: currentV0VsV1,
    frozen_vs_v1: frozenVsV1,
  },
  acceptance_notes: acceptanceNotes({
    expectedRows: GOLDEN_SPECS.length * GOLDEN_SEEDS.length,
    frozenRows,
    currentV0Rows,
    v1Rows,
    frozenVsCurrentV0,
    currentV0VsV1,
    threshold,
  }),
};

const text = `${JSON.stringify(result, null, 2)}\n`;
if (outPath !== undefined) {
  const resolved = resolve(outPath);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, text);
}
process.stdout.write(text);

function splitPaths(raw: string): string[] {
  return raw.split(",").map((path) => path.trim()).filter(Boolean);
}

function loadRows(path: string): NormalizedRow[] {
  const input = JSON.parse(readFileSync(path, "utf8"));
  const rows = rowsFromArtifact(input);
  return rows.map((row) => normalizeRow(row, path));
}

function rowsFromArtifact(input: unknown): Row[] {
  const value = input as {
    rows?: Row[];
    specs?: Row[];
    budget_sweep?: Array<{ specs: Row[] }>;
  };
  if (value.rows !== undefined) return value.rows;
  if (value.specs !== undefined) return value.specs;
  if (value.budget_sweep !== undefined) {
    return value.budget_sweep.flatMap((point) => point.specs);
  }
  return [];
}

function normalizeRow(row: Row, source: string): NormalizedRow {
  return {
    spec: specName(row),
    seed: row.seed,
    score: row.score,
    axis_quality: row.axis_quality ?? row.axis_score ?? null,
    passed: passed(row),
    budget_units: row.budget_units ?? null,
    source,
  };
}

function mergeRows(rows: readonly NormalizedRow[]): NormalizedRow[] {
  const byKey = new Map<string, NormalizedRow>();
  for (const row of rows) byKey.set(rowKey(row.spec, row.seed), row);
  return [...byKey.values()].sort(compareRows);
}

function compare(reference: readonly NormalizedRow[], candidate: readonly NormalizedRow[]): CompareRow[] {
  const candidateByKey = new Map(candidate.map((row) => [rowKey(row.spec, row.seed), row]));
  const rows: CompareRow[] = [];
  for (const ref of reference) {
    const cand = candidateByKey.get(rowKey(ref.spec, ref.seed));
    if (cand === undefined) continue;
    rows.push({
      spec: ref.spec,
      seed: ref.seed,
      reference_score: ref.score,
      candidate_score: cand.score,
      score_ratio: ref.score === 0 ? (cand.score === 0 ? 1 : Infinity) : cand.score / ref.score,
      reference_axis_quality: ref.axis_quality,
      candidate_axis_quality: cand.axis_quality,
      reference_passed: ref.passed,
      candidate_passed: cand.passed,
      pass_delta: cand.passed === ref.passed ? 0 : cand.passed ? 1 : -1,
      candidate_budget_units: cand.budget_units,
      reference_source: ref.source,
      candidate_source: cand.source,
    });
  }
  return rows.sort(compareRows);
}

function summarize(rows: readonly CompareRow[], scoreRatioThreshold: number) {
  return {
    compared_rows: rows.length,
    reference_pass_rate: rate(rows, (row) => row.reference_passed),
    candidate_pass_rate: rate(rows, (row) => row.candidate_passed),
    min_score_ratio: rows.length === 0 ? null : Math.min(...rows.map((row) => row.score_ratio)),
    mean_score_ratio: rows.length === 0 ? null : mean(rows.map((row) => row.score_ratio)),
    rows_below_threshold: rows.filter((row) => row.score_ratio < scoreRatioThreshold).length,
    pass_regressions: rows.filter((row) => row.pass_delta < 0).length,
  };
}

function acceptanceNotes(input: {
  expectedRows: number;
  frozenRows: readonly NormalizedRow[];
  currentV0Rows: readonly NormalizedRow[];
  v1Rows: readonly NormalizedRow[];
  frozenVsCurrentV0: readonly CompareRow[];
  currentV0VsV1: readonly CompareRow[];
  threshold: number;
}): string[] {
  const notes: string[] = [];
  if (input.frozenRows.length < input.expectedRows) {
    notes.push(`frozen baseline has ${input.frozenRows.length}/${input.expectedRows} headline rows`);
  }
  if (input.currentV0Rows.length < input.expectedRows) {
    notes.push(`current-v0 audit has ${input.currentV0Rows.length}/${input.expectedRows} headline rows`);
  }
  if (input.v1Rows.length < input.expectedRows) {
    notes.push(`v1 audit has ${input.v1Rows.length}/${input.expectedRows} headline rows`);
  }
  const frozenMismatches = input.frozenVsCurrentV0
    .filter((row) => row.score_ratio < input.threshold || row.score_ratio > 1 / input.threshold);
  if (frozenMismatches.length > 0) {
    notes.push(`${frozenMismatches.length} current-v0 rows differ from frozen baseline by more than threshold`);
  }
  const v1Below = input.currentV0VsV1.filter((row) => row.score_ratio < input.threshold);
  if (v1Below.length > 0) {
    notes.push(`${v1Below.length} v1 rows are below ${input.threshold}x current-v0 on measured overlap`);
  }
  if (input.currentV0VsV1.some((row) => row.pass_delta < 0)) {
    notes.push("measured v1 overlap has contract pass regressions vs current-v0");
  }
  return notes;
}

function specName(row: { name?: string; spec?: string }): string {
  const out = row.name ?? row.spec;
  if (out === undefined) throw new Error(`row missing spec/name: ${JSON.stringify(row)}`);
  return out;
}

function rowKey(spec: string, seed: number): string {
  return `${spec}\u0000${seed}`;
}

function passed(row: Row): boolean {
  if (row.contract_passed !== undefined) return row.contract_passed;
  if (row.passed !== undefined) return row.passed;
  if (row.status !== undefined) return row.status === "pass";
  return false;
}

function compareRows(a: Pick<NormalizedRow, "spec" | "seed">, b: Pick<NormalizedRow, "spec" | "seed">): number {
  if (a.spec !== b.spec) return a.spec < b.spec ? -1 : 1;
  return a.seed - b.seed;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rate<T>(values: readonly T[], predicate: (value: T) => boolean): number {
  return values.length === 0 ? 0 : values.filter(predicate).length / values.length;
}
