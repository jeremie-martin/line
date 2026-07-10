import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  summarizeDevelopmentBudget,
  weightedBudgetHeadline,
  type ScoredDevelopmentRun,
  type V2BudgetSummary,
  type V2RunScore,
} from "../v0/benchmark_v2/evaluator.ts";
import { loadSuiteManifest } from "../v0/benchmark_v2/suite_model.ts";

type StudyRow = {
  task: { sourceId: string; budget: number; seedSlot: number; actualSeed: number };
  score: V2RunScore;
};

type Study = {
  schema: string;
  suiteFingerprint: string;
  budgets: number[];
  seeds: number[];
  runs: StudyRow[];
};

const args = process.argv.slice(2);
const argument = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};
const studyPath = resolve(argument("study") ?? "generated/benchmark-v2/studies/v2.1-seed-reference-750k.json");
const suitePath = resolve(argument("suite") ?? "benchmark/v2/compat/suite-manifest.json");
const outputPath = resolve(argument("out") ?? "benchmark/v2/studies/seed-allocation.json");
const markdownPath = resolve(argument("markdown") ?? "docs/benchmark-v2-seed-allocation.md");
const trials = Number(argument("trials") ?? 4096);
if (!Number.isSafeInteger(trials) || trials < 100) throw new Error(`--trials must be an integer >= 100`);

const study = JSON.parse(readFileSync(studyPath, "utf8")) as Study;
if (study.schema !== "line.benchmark-v2.budget-scale-study.v1") throw new Error(`unsupported seed study archive`);
if (study.seeds.length !== 12) throw new Error(`seed allocation study requires exactly 12 reference seeds`);
const suite = loadSuiteManifest(suitePath);
const budgets = [250_000, 500_000, 750_000];
if (budgets.some((budget) => !study.budgets.includes(budget))) throw new Error(`study is missing a target budget`);

const runs = study.runs.map((row): ScoredDevelopmentRun => ({
  sourceId: row.task.sourceId,
  budget: row.task.budget,
  seedSlot: row.task.seedSlot,
  actualSeed: row.task.actualSeed,
  score: row.score,
}));
const candidateWeights = [
  { budget: 250_000, weight: 0.20 },
  { budget: 500_000, weight: 0.50 },
  { budget: 750_000, weight: 0.30 },
];
const reference = summarize(runs, Object.fromEntries(budgets.map((budget) => [budget, study.seeds])), candidateWeights);
const singleBudget = budgets.flatMap((budget) => [1, 2, 3, 4, 6, 8].map((seedCount) => {
  const referenceSummary = reference.summaries.find((summary) => summary.budget === budget)!;
  const errors = combinations(study.seeds, seedCount).map((seeds) => {
    const summary = summarizeDevelopmentBudget(
      runs.filter((run) => run.budget === budget && seeds.includes(run.actualSeed)),
      budget,
      suite,
    );
    return Math.abs(summary.score - referenceSummary.score);
  });
  return { budget, seedCount, subsets: errors.length, absoluteError: distribution(errors) };
}));

const schedules = [
  ...[1, 2, 3, 4, 5, 6].map((seedCount) => scheduleAnalysis("probe", [250_000, 500_000], seedCount)),
  ...[1, 2, 3, 4].map((seedCount) => scheduleAnalysis("canonical", budgets, seedCount)),
];
const report = {
  schema: "line.benchmark-v2.seed-allocation-study.v1",
  sourceStudy: relative(studyPath),
  sourceSuite: relative(suitePath),
  suiteFingerprint: study.suiteFingerprint,
  reference: {
    seeds: study.seeds,
    budgets,
    headline: reference.headline,
    validRuns: reference.validRuns,
    totalRuns: reference.totalRuns,
    budgetScores: reference.summaries.map((summary) => ({
      budget: summary.budget,
      score: summary.score,
      validRuns: summary.validRuns,
      totalRuns: summary.totalRuns,
    })),
  },
  method: {
    singleBudget: "All seed subsets of the requested size are compared with the corresponding 12-seed budget reference.",
    schedules: `${trials} deterministic shuffled allocations assign disjoint actual seeds to each budget; no seed is reused across budgets within a schedule.`,
  },
  singleBudget,
  schedules,
};
write(outputPath, `${JSON.stringify(report, null, 2)}\n`);
write(markdownPath, markdown(report));
console.log(markdown(report));
console.log(`JSON: ${relative(outputPath)}`);

function scheduleAnalysis(profile: "probe" | "canonical", profileBudgets: number[], seedCount: number) {
  if (profileBudgets.length * seedCount > study.seeds.length) {
    return { profile, seedCount, allocations: 0, unavailable: "disjoint allocation exceeds the 12-seed reference" };
  }
  const profileWeights = candidateWeights.filter((entry) => profileBudgets.includes(entry.budget));
  const referenceProfile = summarize(
    runs.filter((run) => profileBudgets.includes(run.budget)),
    Object.fromEntries(profileBudgets.map((budget) => [budget, study.seeds])),
    profileWeights,
  );
  const headlineErrors: number[] = [];
  const validRateErrors: number[] = [];
  const stratumErrors = new Map<string, number[]>();
  const sourceErrors = new Map<string, number[]>();
  for (let trial = 0; trial < trials; trial++) {
    const shuffled = deterministicShuffle(study.seeds, 0x9e3779b9 ^ trial ^ seedCount * 131 ^ profileBudgets.length * 977);
    const selected = Object.fromEntries(profileBudgets.map((budget, index) => [
      budget,
      shuffled.slice(index * seedCount, (index + 1) * seedCount),
    ]));
    const sample = summarize(runs, selected, profileWeights);
    headlineErrors.push(Math.abs(sample.headline - referenceProfile.headline));
    validRateErrors.push(Math.abs(sample.validRuns / sample.totalRuns - referenceProfile.validRuns / referenceProfile.totalRuns));
    for (const [id, value] of sample.strata) {
      (stratumErrors.get(id) ?? stratumErrors.set(id, []).get(id)!).push(
        Math.abs(value - (referenceProfile.strata.get(id) ?? 0)),
      );
    }
    for (const [id, value] of sample.sources) {
      (sourceErrors.get(id) ?? sourceErrors.set(id, []).get(id)!).push(
        Math.abs(value - (referenceProfile.sources.get(id) ?? 0)),
      );
    }
  }
  const sourceP95 = [...sourceErrors].map(([id, values]) => ({ id, p95: quantile(values, 0.95) }))
    .sort((a, b) => b.p95 - a.p95 || a.id.localeCompare(b.id));
  return {
    profile,
    seedCount,
    allocations: trials,
    compileCount: profileBudgets.length * seedCount * 42,
    headlineAbsoluteError: distribution(headlineErrors),
    validRateAbsoluteError: distribution(validRateErrors),
    stratumAbsoluteError: Object.fromEntries([...stratumErrors].map(([id, values]) => [id, distribution(values)])),
    worstSourceP95AbsoluteError: sourceP95.slice(0, 8),
  };
}

function summarize(
  sourceRuns: ScoredDevelopmentRun[],
  selected: Record<number, number[]>,
  weights = candidateWeights,
): {
  summaries: V2BudgetSummary[];
  headline: number;
  validRuns: number;
  totalRuns: number;
  strata: Map<string, number>;
  sources: Map<string, number>;
} {
  const selectedBudgets = Object.keys(selected).map(Number);
  const selectedRuns = sourceRuns.filter((run) => selected[run.budget]?.includes(run.actualSeed));
  const summaries = selectedBudgets.map((budget) => summarizeDevelopmentBudget(selectedRuns, budget, suite));
  const normalizedWeights = weights.filter((entry) => selectedBudgets.includes(entry.budget));
  return {
    summaries,
    headline: weightedBudgetHeadline(summaries, normalizedWeights),
    validRuns: selectedRuns.filter((run) => run.score.valid).length,
    totalRuns: selectedRuns.length,
    strata: weightedEntries(summaries, normalizedWeights, (summary) => summary.strata),
    sources: weightedEntries(summaries, normalizedWeights, (summary) => summary.specifications),
  };
}

function weightedEntries(
  summaries: V2BudgetSummary[],
  weights: Array<{ budget: number; weight: number }>,
  select: (summary: V2BudgetSummary) => Array<{ id: string; score: number }>,
): Map<string, number> {
  const denominator = weights.reduce((sum, entry) => sum + entry.weight, 0);
  const result = new Map<string, number>();
  for (const summary of summaries) {
    const weight = (weights.find((entry) => entry.budget === summary.budget)?.weight ?? 0) / denominator;
    for (const entry of select(summary)) result.set(entry.id, (result.get(entry.id) ?? 0) + weight * entry.score);
  }
  return result;
}

function combinations<T>(values: T[], count: number): T[][] {
  const out: T[][] = [];
  const visit = (start: number, selected: T[]): void => {
    if (selected.length === count) {
      out.push([...selected]);
      return;
    }
    for (let index = start; index <= values.length - (count - selected.length); index++) {
      selected.push(values[index]);
      visit(index + 1, selected);
      selected.pop();
    }
  };
  visit(0, []);
  return out;
}

function deterministicShuffle<T>(values: T[], initial: number): T[] {
  const out = [...values];
  let state = initial >>> 0;
  for (let index = out.length - 1; index > 0; index--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const other = state % (index + 1);
    [out[index], out[other]] = [out[other], out[index]];
  }
  return out;
}

function distribution(values: number[]): { p50: number; p90: number; p95: number; max: number } {
  return {
    p50: round(quantile(values, 0.5)),
    p90: round(quantile(values, 0.9)),
    p95: round(quantile(values, 0.95)),
    max: round(Math.max(...values)),
  };
}

function quantile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * percentile;
  const lo = Math.floor(position);
  const hi = Math.ceil(position);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (position - lo);
}

function markdown(report: any): string {
  const lines = [
    "# Benchmark V2 Seed Allocation Study",
    "",
    `The reference contains ${report.reference.seeds.length} seeds at each of ${report.reference.budgets.length} budgets. ` +
      `Reference headline: **${report.reference.headline.toFixed(2)}**; valid ${report.reference.validRuns}/${report.reference.totalRuns}.`,
    "",
    "Schedule trials estimate the effect of seed count using disjoint budget blocks. The frozen V2 policy additionally separates probe and canonical actual-seed ranges; numeric seed labels are deterministic IID inputs.",
    "",
    "| Profile | Seeds / budget | Compiles | Headline abs. error p50 / p95 / max | Valid-rate abs. error p95 | Worst stratum p95 |",
    "|---|---:|---:|---:|---:|---:|",
  ];
  for (const schedule of report.schedules) {
    if (!("headlineAbsoluteError" in schedule)) continue;
    const worstStratum = Math.max(...Object.values(schedule.stratumAbsoluteError as Record<string, { p95: number }>).map((value) => value.p95));
    lines.push(
      `| ${schedule.profile} | ${schedule.seedCount} | ${schedule.compileCount} | ` +
      `${schedule.headlineAbsoluteError.p50.toFixed(2)} / ${schedule.headlineAbsoluteError.p95.toFixed(2)} / ` +
      `${schedule.headlineAbsoluteError.max.toFixed(2)} | ${(100 * schedule.validRateAbsoluteError.p95).toFixed(1)}pp | ` +
      `${worstStratum.toFixed(2)} |`,
    );
  }
  lines.push("", "## Per-budget subset error", "", "| Budget | Seeds | Subsets | Score abs. error p50 / p95 / max |", "|---:|---:|---:|---:|");
  for (const entry of report.singleBudget) {
    lines.push(`| ${entry.budget / 1000}k | ${entry.seedCount} | ${entry.subsets} | ` +
      `${entry.absoluteError.p50.toFixed(2)} / ${entry.absoluteError.p95.toFixed(2)} / ${entry.absoluteError.max.toFixed(2)} |`);
  }
  return `${lines.join("\n")}\n`;
}

function write(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function relative(path: string): string {
  return path.startsWith(`${process.cwd()}/`) ? path.slice(process.cwd().length + 1) : path;
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
