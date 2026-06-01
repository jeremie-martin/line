/**
 * Offline summary for golden budget-curve JSON.
 *
 *   npx tsx scripts/v0/analyze_golden_curve.ts /tmp/golden.json
 *   npm run golden -- --json --specs=tiny_dance --seed=0 | npx tsx scripts/v0/analyze_golden_curve.ts -
 */

import { readFileSync } from "node:fs";
import { shiftedGeometricMean } from "./score.ts";

type BudgetScore = {
  budget: number;
  score: number;
  passed: number;
  total: number;
  changed_tracks: number;
  improved_rows: number;
  plateau_rows: number;
  regressions: number;
};

type GoldenCurveJson = {
  curve_score?: number;
  budgets?: number[];
  budget_scores?: BudgetScore[];
  scope?: { row_count?: number; checkpoint_count?: number; seeds?: number[] };
};

function fmtBudget(budget: number): string {
  return budget % 1000 === 0 ? `${budget / 1000}k` : String(budget);
}

function readInput(path: string): GoldenCurveJson {
  const raw = path === "-" ? readFileSync(0, "utf8") : readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as GoldenCurveJson;
  if (!Array.isArray(parsed.budget_scores)) {
    throw new Error("input does not look like golden curve JSON (missing budget_scores)");
  }
  return parsed;
}

function main(): void {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: analyze_golden_curve.ts <golden-curve.json | ->");
    process.exit(1);
  }
  const data = readInput(path);
  const curveScore = data.curve_score ??
    shiftedGeometricMean(data.budget_scores!.map((summary) => summary.score));
  const rows = data.scope?.row_count ?? 0;
  const checkpoints = data.scope?.checkpoint_count ?? 0;
  console.log(`CURVE_SCORE ${curveScore.toFixed(2)} · rows ${rows} · checkpoints ${checkpoints}`);
  console.log("budget curve:");
  for (const summary of data.budget_scores!) {
    console.log(
      `  ${fmtBudget(summary.budget).padStart(5)} ` +
        `score=${summary.score.toFixed(2).padStart(7)} ` +
        `valid=${String(summary.passed).padStart(2)}/${summary.total} ` +
        `changed=${String(summary.changed_tracks).padStart(2)} ` +
        `improved=${String(summary.improved_rows).padStart(2)} ` +
        `plateau=${String(summary.plateau_rows).padStart(2)} ` +
        `regress=${String(summary.regressions).padStart(2)}`,
    );
  }
}

main();
