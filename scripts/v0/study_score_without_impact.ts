/**
 * Indicative "with vs without impact" headline for a golden archive.
 *
 * The shipped score is  1000 · axis_quality · drift · missing · off_beat · survival,
 * and only `axis_quality = exp(-rms(per-axis errors)/TOL)` depends on the impact axis.
 * So a "without impact" score is the SAME row score with axis_quality recomputed after
 * dropping impact's error terms — every other (non-axis) penalty cancels:
 *
 *     score_without = score · axis_quality_without / axis_quality_with
 *
 * This reads the per-gap axis errors from the archive's stored drift reports and
 * re-aggregates BOTH headlines with the exact golden two-level geomean + budget weights.
 * Pure post-processing — it does NOT touch the scorer, fingerprint, or any track, so the
 * "with" number reproduces the archive's real headline (a built-in self-check).
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_score_without_impact.ts \
 *     generated/golden-runs/impact-curve-canon-on/golden.json
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AXIS_QUALITY_TOLERANCE, axisDetails } from "./score.ts";
import { suiteFromGroups, weightedBudgetScore } from "./metric.ts";
import { REPORT_ONLY_AXIS_SET, type DriftReport } from "./types.ts";

const archivePath = process.argv[2];
if (archivePath === undefined) {
  console.error("usage: LR_ENGINE=wasm npx tsx scripts/v0/study_score_without_impact.ts <archive>/golden.json");
  process.exit(1);
}

type Checkpoint = {
  budget: number;
  score: number;
  axis_quality: number;
  report_path: string | null;
};
type Row = { name: string; seed: number; checkpoints?: Checkpoint[] };
type Golden = {
  headline?: { score?: number; weight_by_budget?: { budget: number; weight: number }[] };
  budgets?: number[];
  budget_scores?: { budget: number; score: number }[];
  rows?: Row[];
};

const golden = JSON.parse(readFileSync(resolve(archivePath), "utf8")) as Golden;
const budgets = golden.budgets ?? [];
const weightByBudget = golden.headline?.weight_by_budget ?? [];

const reportCache = new Map<string, DriftReport | null>();
function loadReport(path: string | null): DriftReport | null {
  if (path === null) return null;
  if (reportCache.has(path)) return reportCache.get(path) ?? null;
  const rep = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as DriftReport) : null;
  reportCache.set(path, rep);
  return rep;
}

function axisQualityExcluding(report: DriftReport, drop: Set<string>): number {
  const errs = axisDetails(report)
    .filter((a) => !REPORT_ONLY_AXIS_SET.has(a.axis) && !drop.has(a.axis))
    .map((a) => a.error);
  if (errs.length === 0) return 1;
  const rms = Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);
  return Math.exp(-rms / AXIS_QUALITY_TOLERANCE);
}

const NONE = new Set<string>();
const IMPACT = new Set<string>(["impact"]);

// Self-check accumulators: recomputed full axis_quality vs stored, to prove the method.
let aqCheckMax = 0;
let missingReports = 0;
let reportsWithImpact = 0;
let totalCheckpoints = 0;

// budget -> spec -> seed scores, for both variants.
type PerBudget = Map<number, Map<string, number[]>>;
const withByBudget: PerBudget = new Map();
const withoutByBudget: PerBudget = new Map();
for (const b of budgets) {
  withByBudget.set(b, new Map());
  withoutByBudget.set(b, new Map());
}

function push(map: PerBudget, budget: number, spec: string, score: number): void {
  const bySpec = map.get(budget);
  if (bySpec === undefined) return;
  const arr = bySpec.get(spec) ?? [];
  arr.push(score);
  bySpec.set(spec, arr);
}

for (const row of golden.rows ?? []) {
  for (const cp of row.checkpoints ?? []) {
    if (!budgets.includes(cp.budget)) continue;
    totalCheckpoints++;
    const report = loadReport(cp.report_path);
    let scoreWithout = cp.score;
    if (report === null) {
      if (cp.report_path !== null) missingReports++;
    } else {
      const aqFull = axisQualityExcluding(report, NONE);
      const aqNoImpact = axisQualityExcluding(report, IMPACT);
      if (cp.axis_quality > 1e-9) {
        aqCheckMax = Math.max(aqCheckMax, Math.abs(aqFull - cp.axis_quality));
        scoreWithout = cp.score * (aqNoImpact / cp.axis_quality);
      }
      if (aqNoImpact > aqFull + 1e-9) reportsWithImpact++;
    }
    push(withByBudget, cp.budget, row.name, cp.score);
    push(withoutByBudget, cp.budget, row.name, scoreWithout);
  }
}

function budgetScore(map: PerBudget, budget: number): number {
  const bySpec = map.get(budget) ?? new Map<string, number[]>();
  return suiteFromGroups([...bySpec.values()]);
}

const pointsWith = budgets.map((b) => ({ budget: b, score: budgetScore(withByBudget, b) }));
const pointsWithout = budgets.map((b) => ({ budget: b, score: budgetScore(withoutByBudget, b) }));
const headlineWith = weightedBudgetScore(pointsWith, weightByBudget);
const headlineWithout = weightedBudgetScore(pointsWithout, weightByBudget);

const f = (x: number) => x.toFixed(2);
console.log(`\n=== ${archivePath} ===`);
console.log(`checkpoints ${totalCheckpoints} · with-impact-error ${reportsWithImpact} · missing-reports ${missingReports}`);
console.log(`self-check: max|recomputed_full_axis_quality − stored| = ${aqCheckMax.toExponential(2)} (should be ~0)`);
const storedHeadline = golden.headline?.score;
if (storedHeadline !== undefined) {
  console.log(`self-check: recomputed WITH headline ${f(headlineWith)} vs stored ${f(storedHeadline)} (should match)`);
}
console.log("\n  budget        WITH (real)   WITHOUT impact   Δ (lift from dropping impact)");
for (let i = 0; i < budgets.length; i++) {
  const w = pointsWith[i].score;
  const wo = pointsWithout[i].score;
  console.log(`  ${String(budgets[i]).padStart(7)}   ${f(w).padStart(11)}   ${f(wo).padStart(13)}   ${(wo - w >= 0 ? "+" : "") + f(wo - w)}`);
}
console.log(`\n  HEADLINE   WITH ${f(headlineWith)}   ·   WITHOUT impact ${f(headlineWithout)}   ·   Δ +${f(headlineWithout - headlineWith)}`);
console.log(`  (WITHOUT = indicative: the other-axis quality of the SAME tracks, impact error removed from axis_quality.)\n`);
