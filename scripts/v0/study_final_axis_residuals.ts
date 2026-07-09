/**
 * Exact final-output residual decomposition for a golden archive.
 *
 * Recomputes the scorer after zeroing one axis's errors at a time, then aggregates with
 * the real per-spec geometric mean and budget weights. Also reports signed
 * achieved-minus-target bias and early/middle/late SSE concentration.
 *
 *   npx tsx scripts/v0/study_final_axis_residuals.ts \
 *     --golden=generated/golden-runs/probe-baseline-fp6f760d-j32-a01/golden.json \
 *     --out=generated/studies/final-axis-residuals-probe-baseline.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { suiteFromGroups, weightedBudgetScore } from "./metric.ts";
import { AXIS_QUALITY_TOLERANCE } from "./score.ts";
import { REPORT_ONLY_AXIS_SET, type DriftReport } from "./types.ts";

type Checkpoint = {
  budget: number;
  score: number;
  axis_quality: number;
  report_path: string | null;
};
type Archive = {
  headline: { score: number; weight_by_budget: Array<{ budget: number; weight: number }> };
  budgets: number[];
  rows: Array<{ name: string; seed: number; checkpoints: Checkpoint[] }>;
};
type Residual = {
  axis: string;
  error: number;
  signed: number;
  third: "early" | "middle" | "late";
};
type Acc = { count: number; sse: number; signed: number; under: number; over: number };

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function axisQuality(errors: readonly number[]): number {
  if (errors.length === 0) return 1;
  const sse = errors.reduce((sum, error) => sum + error * error, 0);
  return Math.exp(-Math.sqrt(sse / errors.length) / AXIS_QUALITY_TOLERANCE);
}

function emptyAcc(): Acc {
  return { count: 0, sse: 0, signed: 0, under: 0, over: 0 };
}

function add(acc: Acc, residual: Residual): void {
  acc.count++;
  acc.sse += residual.error * residual.error;
  acc.signed += residual.signed;
  if (residual.signed < 0) acc.under++;
  if (residual.signed > 0) acc.over++;
}

function summarize(acc: Acc, totalSse: number): unknown {
  return {
    count: acc.count,
    sse: round(acc.sse, 6),
    sse_share: totalSse > 0 ? round(acc.sse / totalSse, 4) : null,
    rms_error: acc.count > 0 ? round(Math.sqrt(acc.sse / acc.count), 5) : null,
    mean_signed_residual: acc.count > 0 ? round(acc.signed / acc.count, 5) : null,
    under_fraction: acc.count > 0 ? round(acc.under / acc.count, 4) : null,
    over_fraction: acc.count > 0 ? round(acc.over / acc.count, 4) : null,
  };
}

function round(value: number, digits = 3): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

const goldenArg = arg("golden");
if (goldenArg === undefined) throw new Error("missing --golden=path");
const goldenPath = resolve(goldenArg);
const outPath = resolve(arg("out") ?? "generated/studies/final-axis-residuals.json");
const archive = JSON.parse(readFileSync(goldenPath, "utf8")) as Archive;
const reportCache = new Map<string, DriftReport>();
const checkpointRows: Array<{
  spec: string;
  budget: number;
  score: number;
  axisQuality: number;
  residuals: Residual[];
}> = [];

for (const row of archive.rows) {
  for (const checkpoint of row.checkpoints) {
    if (checkpoint.report_path === null || !existsSync(checkpoint.report_path)) continue;
    let report = reportCache.get(checkpoint.report_path);
    if (report === undefined) {
      report = JSON.parse(readFileSync(checkpoint.report_path, "utf8")) as DriftReport;
      reportCache.set(checkpoint.report_path, report);
    }
    const residuals: Residual[] = [];
    for (let position = 0; position < report.gaps.length; position++) {
      const gap = report.gaps[position];
      const fraction = (position + 0.5) / Math.max(1, report.gaps.length);
      const third = fraction < 1 / 3 ? "early" : fraction < 2 / 3 ? "middle" : "late";
      for (const [axis, value] of Object.entries(gap.axes)) {
        if (REPORT_ONLY_AXIS_SET.has(axis)) continue;
        if (![value.target, value.achieved, value.error].every(Number.isFinite)) continue;
        residuals.push({
          axis,
          error: value.error,
          signed: value.achieved - value.target,
          third,
        });
      }
    }
    checkpointRows.push({
      spec: row.name,
      budget: checkpoint.budget,
      score: checkpoint.score,
      axisQuality: checkpoint.axis_quality,
      residuals,
    });
  }
}

const axes = [...new Set(checkpointRows.flatMap((row) => row.residuals.map((residual) => residual.axis)))].sort();
const byBudget = Object.fromEntries(archive.budgets.map((budget) => {
  const rows = checkpointRows.filter((row) => row.budget === budget);
  const all = emptyAcc();
  const perAxis = new Map(axes.map((axis) => [axis, emptyAcc()]));
  const perAxisThird = new Map(axes.map((axis) => [axis, {
    early: emptyAcc(), middle: emptyAcc(), late: emptyAcc(),
  }]));
  for (const row of rows) {
    for (const residual of row.residuals) {
      add(all, residual);
      add(perAxis.get(residual.axis)!, residual);
      add(perAxisThird.get(residual.axis)![residual.third], residual);
    }
  }
  return [budget, {
    checkpoints: rows.length,
    total: summarize(all, all.sse),
    axes: Object.fromEntries(axes.map((axis) => [axis, {
      ...summarize(perAxis.get(axis)!, all.sse) as object,
      thirds: Object.fromEntries((["early", "middle", "late"] as const).map((third) => [
        third,
        summarize(perAxisThird.get(axis)![third], perAxis.get(axis)!.sse),
      ])),
    }])),
  }];
}));

type ScoreMap = Map<number, Map<string, number[]>>;
function pushScore(map: ScoreMap, budget: number, spec: string, score: number): void {
  const bySpec = map.get(budget) ?? new Map<string, number[]>();
  const scores = bySpec.get(spec) ?? [];
  scores.push(score);
  bySpec.set(spec, scores);
  map.set(budget, bySpec);
}

function curveScore(map: ScoreMap, budget: number): number {
  return suiteFromGroups([...(map.get(budget)?.values() ?? [])]);
}

const removableAxisHeadroom = Object.fromEntries(axes.map((axis) => {
  const scores: ScoreMap = new Map();
  for (const row of checkpointRows) {
    const zeroed = row.residuals.map((residual) => residual.axis === axis ? 0 : residual.error);
    const noAxisQuality = axisQuality(zeroed);
    const score = row.axisQuality > 0 ? row.score * noAxisQuality / row.axisQuality : row.score;
    pushScore(scores, row.budget, row.spec, score);
  }
  const curve = archive.budgets.map((budget) => ({ budget, score: curveScore(scores, budget) }));
  const headline = weightedBudgetScore(curve, archive.headline.weight_by_budget);
  return [axis, {
    headline_without_axis_error: round(headline, 2),
    headline_lift: round(headline - archive.headline.score, 2),
    budget_curve: curve.map((point) => ({
      budget: point.budget,
      score: round(point.score, 2),
    })),
  }];
}));

const result = {
  source: goldenPath,
  checkpoints: checkpointRows.length,
  stored_headline: archive.headline.score,
  axes,
  removable_axis_headroom: removableAxisHeadroom,
  by_budget: byBudget,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
