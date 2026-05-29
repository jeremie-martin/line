#!/usr/bin/env tsx
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import {
  compile,
  defaultBudgetFor,
  minimumRecommendedBudgetFor,
  type Budget,
} from "./compile.ts";
import { loadGoldenSpec, type GoldenSpecName } from "../v0/golden_suite.ts";
import { scoreDriftReport } from "../v0/score.ts";

type Row = {
  compiler: "v1";
  spec: string;
  seed: number;
  budget_units: number;
  elapsed_ms: number;
  contract_passed: boolean;
  score: number;
  axis_quality: number;
  hard_failures: string[];
  work_units_used: number;
  best_found_at_work_unit: number | null;
  completed_candidates: number;
  contract_passing_candidates: number;
  candidates_sampled: number;
  detector_frames: number;
  track_lines: number;
};

type MonotonicViolation = {
  spec: string;
  seed: number;
  lower_budget_units: number;
  higher_budget_units: number;
  lower_axis_quality: number;
  higher_axis_quality: number;
  delta: number;
};

type MeasurementSummary = {
  row_count: number;
  contract_pass_rate: number;
  monotonic_tolerance: number;
  monotonic_violations: MonotonicViolation[];
  wall_ms_per_work_unit: {
    count: number;
    mean: number | null;
    stddev: number | null;
    cv: number | null;
    min: number | null;
    max: number | null;
  };
  detector_frames_per_work_unit: {
    count: number;
    mean: number | null;
    stddev: number | null;
    cv: number | null;
    min: number | null;
    max: number | null;
  };
};

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value] as const;
  }),
);

const specs = (args.get("specs") ?? "tiny_dance,mini_burst,cold_start")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean) as GoldenSpecName[];
const seeds = (args.get("seeds") ?? "0")
  .split(",")
  .map((seed) => Number(seed.trim()));
const explicitBudgets = args.get("budgets");
const budgetScales = args.get("budget-scales");
if (explicitBudgets !== undefined && budgetScales !== undefined) {
  throw new Error("--budgets and --budget-scales cannot be combined");
}
const budgetPlan = budgetScales === undefined
  ? {
    kind: "units" as const,
    units: (explicitBudgets ?? "20000,50000,100000")
      .split(",")
      .map((budget) => Number(budget.trim())),
  }
  : {
    kind: "default_scales" as const,
    scales: budgetScales
      .split(",")
      .map((scale) => Number(scale.trim())),
  };
const outPath = args.get("out");
const monotonicTolerance = Number(args.get("monotonic-tolerance") ?? "1e-12");

const rows: Row[] = [];
for (const specName of specs) {
  const spec = await loadGoldenSpec(specName, "base");
  const totalFrames = Math.round(spec.duration * 40);
  for (const seed of seeds) {
    for (const units of budgetUnitsForSpec(spec)) {
      const started = Date.now();
      const result = compile(spec, { seed, budget: { kind: "work", units } });
      const elapsed = Date.now() - started;
      const score = scoreDriftReport(result.report, { totalFrames });
      const row: Row = {
        compiler: "v1",
        spec: specName,
        seed,
        budget_units: units,
        elapsed_ms: elapsed,
        contract_passed: score.contract_passed,
        score: score.score,
        axis_quality: score.axis_quality,
        hard_failures: score.hard_failures,
        work_units_used: result.stats.work_units_used,
        best_found_at_work_unit: result.stats.best_found_at_work_unit,
        completed_candidates: result.stats.completed_candidates,
        contract_passing_candidates: result.stats.contract_passing_candidates,
        candidates_sampled: result.stats.candidates_sampled,
        detector_frames: result.stats.detector_frames,
        track_lines: result.track.lines.length,
      };
      rows.push(row);
      console.log(JSON.stringify(row));
    }
  }
}

const summary = summarize(rows, monotonicTolerance);
console.log(JSON.stringify({ summary }));

if (outPath !== undefined) {
  const resolved = resolve(outPath);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, `${JSON.stringify({ rows, summary }, null, 2)}\n`);
}

function budgetUnitsForSpec(spec: Awaited<ReturnType<typeof loadGoldenSpec>>): number[] {
  if (budgetPlan.kind === "units") return budgetPlan.units.map(normalizeUnits);

  const defaultUnits = workUnits(defaultBudgetFor(spec));
  const minimumUnits = workUnits(minimumRecommendedBudgetFor(spec));
  return budgetPlan.scales
    .map((scale) => normalizeUnits(Math.max(minimumUnits, Math.floor(defaultUnits * scale))));
}

function workUnits(budget: Budget): number {
  if (budget.kind !== "work") {
    throw new Error(`v1 measurement requires work budgets, got ${budget.kind}`);
  }
  return normalizeUnits(budget.units);
}

function normalizeUnits(units: number): number {
  if (!Number.isFinite(units) || units < 0) {
    throw new Error(`budget units must be a non-negative finite number, got ${units}`);
  }
  return Math.floor(units);
}

function summarize(rows: readonly Row[], monotonicTolerance: number): MeasurementSummary {
  const passed = rows.filter((row) => row.contract_passed).length;
  return {
    row_count: rows.length,
    contract_pass_rate: rows.length === 0 ? 0 : passed / rows.length,
    monotonic_tolerance: monotonicTolerance,
    monotonic_violations: findMonotonicViolations(rows, monotonicTolerance),
    wall_ms_per_work_unit: distribution(
      rows
        .filter((row) => row.work_units_used > 0)
        .map((row) => row.elapsed_ms / row.work_units_used),
    ),
    detector_frames_per_work_unit: distribution(
      rows
        .filter((row) => row.work_units_used > 0)
        .map((row) => row.detector_frames / row.work_units_used),
    ),
  };
}

function findMonotonicViolations(
  rows: readonly Row[],
  tolerance: number,
): MonotonicViolation[] {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.spec}\u0000${row.seed}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const violations: MonotonicViolation[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.budget_units - b.budget_units);
    for (let index = 1; index < group.length; index++) {
      const prev = group[index - 1];
      const curr = group[index];
      const delta = curr.axis_quality - prev.axis_quality;
      if (delta + tolerance >= 0) continue;
      violations.push({
        spec: curr.spec,
        seed: curr.seed,
        lower_budget_units: prev.budget_units,
        higher_budget_units: curr.budget_units,
        lower_axis_quality: prev.axis_quality,
        higher_axis_quality: curr.axis_quality,
        delta,
      });
    }
  }
  return violations;
}

function distribution(values: readonly number[]): MeasurementSummary["wall_ms_per_work_unit"] {
  if (values.length === 0) {
    return { count: 0, mean: null, stddev: null, cv: null, min: null, max: null };
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  return {
    count: values.length,
    mean,
    stddev,
    cv: mean === 0 ? null : stddev / mean,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}
