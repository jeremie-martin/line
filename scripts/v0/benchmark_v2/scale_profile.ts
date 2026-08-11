import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shiftedGeometricMean } from "../score.ts";
import type { ResolvedSource } from "./model.ts";

export const MULTI_BUDGET_PROFILE_SCHEMA =
  "line.benchmark-v2.multi-budget-profile.v1" as const;

export type MultiBudgetProfile = {
  schema: typeof MULTI_BUDGET_PROFILE_SCHEMA;
  id: string;
  status: "frozen";
  description: string;
  sources: Array<{ id: string; behavior: string; weight: number }>;
  budgets: Array<{ frames: number; weight: number }>;
  canonicalBudget: number;
  seedSchedule: {
    kind: "shared-contiguous";
    base: number;
    maximumSeeds: number;
    defaultSeeds: number;
    looks: number[];
  };
  aggregation: {
    withinSourceBudget: "shifted-geometric-mean-over-seeds";
    acrossSources: "weighted-arithmetic-mean";
    acrossBudgets: "weighted-arithmetic-mean";
    uncertaintyBlock: "delete-one-complete-seed-curve";
  };
  decision: {
    method: "symmetric-bonferroni-reference-t";
    directionalFamilyAlpha: number;
    centralIntervalLevel: number;
    authority: "scale-comparison-not-canonical-promotion";
  };
};

export type LoadedMultiBudgetProfile = {
  path: string;
  fingerprint: string;
  profile: MultiBudgetProfile;
};

export type ScaleScoredRun = {
  sourceId: string;
  budget: number;
  actualSeed: number;
  score: { score: number; valid: boolean };
};

export type ScaleBudgetSummary = {
  budget: number;
  score: number;
  validRuns: number;
  totalRuns: number;
  specifications: Array<{
    id: string;
    weight: number;
    score: number;
    validRuns: number;
    totalRuns: number;
  }>;
  groups: [];
  strata: [];
};

export type ScalePanelSummary = {
  scaleHeadline: number;
  validRuns: number;
  totalRuns: number;
  budgets: ScaleBudgetSummary[];
};

export function loadMultiBudgetProfile(path: string): LoadedMultiBudgetProfile {
  const absolute = resolve(path);
  const bytes = readFileSync(absolute);
  const profile = JSON.parse(bytes.toString("utf8")) as MultiBudgetProfile;
  validateMultiBudgetProfile(profile);
  return {
    path: absolute,
    fingerprint: createHash("sha256").update(bytes).digest("hex"),
    profile,
  };
}

export function validateMultiBudgetProfile(profile: MultiBudgetProfile): void {
  if (
    profile?.schema !== MULTI_BUDGET_PROFILE_SCHEMA || profile.status !== "frozen" ||
    typeof profile.id !== "string" || !/^[a-z0-9][a-z0-9_.-]+$/.test(profile.id) ||
    typeof profile.description !== "string" || profile.description.length === 0
  ) throw new Error(`unsupported or unfrozen multi-budget profile`);

  if (profile.sources.length < 2) throw new Error(`multi-budget profile needs at least two sources`);
  assertUnique(profile.sources.map((source) => source.id), "multi-budget source ids");
  assertPositiveUnitSum(profile.sources.map((source) => source.weight), "multi-budget source weights");
  for (const source of profile.sources) {
    if (source.id === "" || source.behavior === "") throw new Error(`multi-budget source metadata is incomplete`);
  }

  if (profile.budgets.length < 2) throw new Error(`multi-budget profile needs at least two budgets`);
  assertUnique(profile.budgets.map((budget) => String(budget.frames)), "multi-budget frames");
  if (profile.budgets.some((budget) => !Number.isSafeInteger(budget.frames) || budget.frames <= 0)) {
    throw new Error(`multi-budget frames must be positive safe integers`);
  }
  if (profile.budgets.some((budget, index) => index > 0 && budget.frames <= profile.budgets[index - 1]!.frames)) {
    throw new Error(`multi-budget frames must be strictly increasing`);
  }
  assertPositiveUnitSum(profile.budgets.map((budget) => budget.weight), "multi-budget weights");
  if (!profile.budgets.some((budget) => budget.frames === profile.canonicalBudget)) {
    throw new Error(`canonical budget is absent from multi-budget profile`);
  }

  const schedule = profile.seedSchedule;
  if (
    schedule?.kind !== "shared-contiguous" || !Number.isSafeInteger(schedule.base) || schedule.base < 0 ||
    !Number.isSafeInteger(schedule.maximumSeeds) || schedule.maximumSeeds < 2 ||
    !Number.isSafeInteger(schedule.defaultSeeds) || schedule.defaultSeeds < 2 ||
    schedule.defaultSeeds > schedule.maximumSeeds || schedule.looks.length === 0
  ) throw new Error(`invalid multi-budget seed schedule`);
  assertUnique(schedule.looks.map(String), "multi-budget looks");
  if (
    schedule.looks.some((look, index) =>
      !Number.isSafeInteger(look) || look < 2 || look > schedule.maximumSeeds ||
      (index > 0 && look <= schedule.looks[index - 1]!)
    ) || schedule.looks.at(-1) !== schedule.maximumSeeds || !schedule.looks.includes(schedule.defaultSeeds)
  ) throw new Error(`multi-budget looks must increase through the declared maximum and contain the default`);

  if (
    profile.aggregation?.withinSourceBudget !== "shifted-geometric-mean-over-seeds" ||
    profile.aggregation.acrossSources !== "weighted-arithmetic-mean" ||
    profile.aggregation.acrossBudgets !== "weighted-arithmetic-mean" ||
    profile.aggregation.uncertaintyBlock !== "delete-one-complete-seed-curve"
  ) throw new Error(`unsupported multi-budget aggregation`);
  if (
    profile.decision?.method !== "symmetric-bonferroni-reference-t" ||
    !(profile.decision.directionalFamilyAlpha > 0 && profile.decision.directionalFamilyAlpha < 0.5) ||
    !(profile.decision.centralIntervalLevel > 0 && profile.decision.centralIntervalLevel < 1) ||
    profile.decision.authority !== "scale-comparison-not-canonical-promotion"
  ) throw new Error(`unsupported multi-budget decision policy`);
}

export function resolveMultiBudgetSources(
  profile: MultiBudgetProfile,
  sources: ResolvedSource[],
): ResolvedSource[] {
  const byId = new Map(sources.map((source) => [source.id, source]));
  return profile.sources.map(({ id }) => {
    const source = byId.get(id);
    if (source === undefined) throw new Error(`${id}: multi-budget source is absent from Benchmark V2`);
    if (source.role === "qualification_reference") {
      throw new Error(`${id}: qualification references cannot enter the iterative multi-budget profile`);
    }
    return source;
  });
}

export function multiBudgetSeeds(profile: MultiBudgetProfile, depth: number): number[] {
  if (!Number.isSafeInteger(depth) || depth < 2 || depth > profile.seedSchedule.maximumSeeds) {
    throw new Error(`multi-budget seed depth must be in 2..${profile.seedSchedule.maximumSeeds}`);
  }
  return Array.from({ length: depth }, (_, index) => profile.seedSchedule.base + index);
}

export function assertMultiBudgetExecutionScope(
  profile: MultiBudgetProfile,
  budgets: number[],
  seeds: number[],
): void {
  const expectedBudgets = profile.budgets.map((budget) => budget.frames);
  if (!sameNumbers(budgets, expectedBudgets)) {
    throw new Error(`multi-budget benchmark must use the frozen budget grid ${expectedBudgets.join(",")}`);
  }
  const expectedSeeds = multiBudgetSeeds(profile, seeds.length);
  if (!sameNumbers(seeds, expectedSeeds)) {
    throw new Error(`multi-budget benchmark seeds must be the frozen shared prefix ${expectedSeeds.join(",")}`);
  }
}

export function summarizeScaleBudget(
  runs: ScaleScoredRun[],
  budget: number,
  profile: MultiBudgetProfile,
): ScaleBudgetSummary {
  const budgetRuns = runs.filter((run) => run.budget === budget);
  const specifications = profile.sources.map((source) => {
    const rows = budgetRuns.filter((run) => run.sourceId === source.id);
    return {
      id: source.id,
      weight: source.weight,
      score: round(shiftedGeometricMean(rows.map((run) => run.score.score))),
      validRuns: rows.filter((run) => run.score.valid).length,
      totalRuns: rows.length,
    };
  });
  return {
    budget,
    score: round(specifications.reduce((sum, source) => sum + source.weight * source.score, 0)),
    validRuns: budgetRuns.filter((run) => run.score.valid).length,
    totalRuns: budgetRuns.length,
    specifications,
    groups: [],
    strata: [],
  };
}

export function summarizeScalePanel(
  runs: ScaleScoredRun[],
  profile: MultiBudgetProfile,
): ScalePanelSummary {
  const budgets = profile.budgets.map(({ frames }) => summarizeScaleBudget(runs, frames, profile));
  const weightByBudget = new Map(profile.budgets.map((budget) => [budget.frames, budget.weight]));
  return {
    scaleHeadline: round(budgets.reduce(
      (sum, budget) => sum + (weightByBudget.get(budget.budget) ?? 0) * budget.score,
      0,
    )),
    validRuns: runs.filter((run) => run.score.valid).length,
    totalRuns: runs.length,
    budgets,
  };
}

function assertPositiveUnitSum(values: number[], label: string): void {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (values.some((value) => !Number.isFinite(value) || value <= 0) || Math.abs(total - 1) > 1e-9) {
    throw new Error(`${label} must be positive and sum to 1; got ${total}`);
  }
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`);
}

function sameNumbers(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
