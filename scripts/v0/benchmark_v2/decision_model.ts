import { shiftedGeometricMean } from "../score.ts";
import {
  summarizeDevelopmentBudget,
  weightedBudgetHeadline,
  type ScoredDevelopmentRun,
} from "./evaluator.ts";
import type { SuiteManifest } from "./suite_model.ts";

export const DECISION_ALPHA = 0.20;

export type DecisionRun = {
  sourceId: string;
  budget: number;
  seedSlot: number;
  actualSeed: number;
  score: { score: number; valid: boolean };
};

export type V2Decision = {
  baseHeadline: number;
  candidateHeadline: number;
  delta: number;
  ciLo: number;
  ciHi: number;
  pLeZero: number;
  pGeZero: number;
  verdict: "accept" | "reject" | "inconclusive";
  perBudget: Array<{ budget: number; base: number; candidate: number; delta: number }>;
  perStratum: Array<{ stratum: string; base: number; candidate: number; delta: number }>;
  perGroup: Array<{ stratum: string; group: string; base: number; candidate: number; delta: number }>;
};

export function pairedV2Decision(
  baseRuns: DecisionRun[],
  candidateRuns: DecisionRun[],
  suite: SuiteManifest,
  iterations = 20_000,
  bootstrapSeed = 0x5eed1234,
): V2Decision {
  assertPairedScope(baseRuns, candidateRuns);
  const budgets = [...new Set(baseRuns.map((run) => run.budget))].sort((a, b) => a - b);
  const baseHeadline = scoreHeadline(baseRuns, suite, budgets);
  const candidateHeadline = scoreHeadline(candidateRuns, suite, budgets);
  const random = mulberry32(bootstrapSeed);
  const deltas: number[] = [];
  for (let iteration = 0; iteration < iterations; iteration++) {
    const sample = samplePlan(baseRuns, suite, budgets, random);
    deltas.push(
      scoreSample(candidateRuns, suite, budgets, sample) -
      scoreSample(baseRuns, suite, budgets, sample),
    );
  }
  deltas.sort((a, b) => a - b);
  const pLeZero = deltas.filter((delta) => delta <= 0).length / deltas.length;
  const pGeZero = deltas.filter((delta) => delta >= 0).length / deltas.length;
  const verdict = pLeZero < DECISION_ALPHA
    ? "accept"
    : pGeZero < DECISION_ALPHA
      ? "reject"
      : "inconclusive";
  return {
    baseHeadline: round(baseHeadline),
    candidateHeadline: round(candidateHeadline),
    delta: round(candidateHeadline - baseHeadline),
    ciLo: round(quantile(deltas, 0.025)),
    ciHi: round(quantile(deltas, 0.975)),
    pLeZero: round(pLeZero),
    pGeZero: round(pGeZero),
    verdict,
    perBudget: budgets.map((budget) => {
      const base = scoreBudget(baseRuns, suite, budget);
      const candidate = scoreBudget(candidateRuns, suite, budget);
      return { budget, base: round(base), candidate: round(candidate), delta: round(candidate - base) };
    }),
    perStratum: suite.strata.map((stratum) => {
      const base = weightedBudgets(
        budgets.map((budget) => scoreStratum(baseRuns.filter((run) => run.budget === budget), stratum)),
        budgets,
        suite,
      );
      const candidate = weightedBudgets(
        budgets.map((budget) => scoreStratum(candidateRuns.filter((run) => run.budget === budget), stratum)),
        budgets,
        suite,
      );
      return { stratum: stratum.id, base: round(base), candidate: round(candidate), delta: round(candidate - base) };
    }),
    perGroup: suite.strata.flatMap((stratum) => stratum.groups.map((group) => {
      const base = weightedBudgets(
        budgets.map((budget) => scoreGroup(baseRuns.filter((run) => run.budget === budget), group.members)),
        budgets,
        suite,
      );
      const candidate = weightedBudgets(
        budgets.map((budget) => scoreGroup(candidateRuns.filter((run) => run.budget === budget), group.members)),
        budgets,
        suite,
      );
      return {
        stratum: stratum.id,
        group: group.id,
        base: round(base),
        candidate: round(candidate),
        delta: round(candidate - base),
      };
    })),
  };
}

type SamplePlan = Map<string, Array<{ sourceId: string; seedSlots: number[] }>>;

function samplePlan(
  runs: DecisionRun[],
  suite: SuiteManifest,
  budgets: number[],
  random: () => number,
): SamplePlan {
  const plan: SamplePlan = new Map();
  for (const stratum of suite.strata) {
    for (const group of stratum.groups) {
      const sampledMembers = group.members.map(() => group.members[Math.floor(random() * group.members.length)]);
      plan.set(group.id, sampledMembers.map((sourceId) => {
        const slots = [...new Set(runs
          .filter((run) => run.sourceId === sourceId && budgets.includes(run.budget))
          .map((run) => run.seedSlot))];
        return {
          sourceId,
          seedSlots: slots.map(() => slots[Math.floor(random() * slots.length)]),
        };
      }));
    }
  }
  return plan;
}

function scoreSample(
  runs: DecisionRun[],
  suite: SuiteManifest,
  budgets: number[],
  plan: SamplePlan,
): number {
  const budgetScores = budgets.map((budget) => suite.strata.reduce((stratumSum, stratum) => {
    const stratumScore = stratum.groups.reduce((groupSum, group) => {
      const specs = (plan.get(group.id) ?? []).map((sample) => {
        const values = sample.seedSlots.map((slot) =>
          runs.find((run) =>
            run.sourceId === sample.sourceId && run.budget === budget && run.seedSlot === slot
          )?.score.score ?? 0
        );
        return shiftedGeometricMean(values);
      });
      return groupSum + group.weight * shiftedGeometricMean(specs);
    }, 0);
    return stratumSum + stratum.weight * stratumScore;
  }, 0));
  return weightedBudgets(budgetScores, budgets, suite);
}

function scoreHeadline(runs: DecisionRun[], suite: SuiteManifest, budgets: number[]): number {
  const summaries = budgets.map((budget) => summarizeDevelopmentBudget(
    runs as unknown as ScoredDevelopmentRun[],
    budget,
    suite,
  ));
  return weightedBudgetHeadline(summaries, suite.budget_weights);
}

function scoreBudget(runs: DecisionRun[], suite: SuiteManifest, budget: number): number {
  return summarizeDevelopmentBudget(runs as unknown as ScoredDevelopmentRun[], budget, suite).score;
}

function scoreStratum(
  runs: DecisionRun[],
  stratum: SuiteManifest["strata"][number],
): number {
  const budget = runs[0]?.budget;
  if (budget === undefined) return 0;
  const syntheticSuite = { strata: [{ ...stratum, weight: 1 }] };
  return summarizeDevelopmentBudget(
    runs as unknown as ScoredDevelopmentRun[],
    budget,
    syntheticSuite,
  ).strata[0].score;
}

function scoreGroup(runs: DecisionRun[], members: string[]): number {
  const budget = runs[0]?.budget;
  if (budget === undefined) return 0;
  return summarizeDevelopmentBudget(
    runs as unknown as ScoredDevelopmentRun[],
    budget,
    { strata: [{ id: "representative", weight: 1, groups: [{ id: "group", weight: 1, members }] }] },
  ).groups[0].score;
}

function weightedBudgets(scores: number[], budgets: number[], suite: SuiteManifest): number {
  const weights = new Map(suite.budget_weights.map((entry) => [entry.budget, entry.weight]));
  const denominator = budgets.reduce((sum, budget) => sum + (weights.get(budget) ?? 0), 0);
  return denominator === 0 ? 0 : scores.reduce(
    (sum, score, index) => sum + score * (weights.get(budgets[index]) ?? 0),
    0,
  ) / denominator;
}

function assertPairedScope(base: DecisionRun[], candidate: DecisionRun[]): void {
  const key = (run: DecisionRun): string =>
    `${run.sourceId}\0${run.budget}\0${run.seedSlot}\0${run.actualSeed}`;
  const a = base.map(key).sort();
  const b = candidate.map(key).sort();
  if (
    a.length === 0 || new Set(a).size !== a.length || new Set(b).size !== b.length ||
    a.length !== b.length || a.some((value, index) => value !== b[index])
  ) {
    throw new Error(`decision archives do not have identical paired scope`);
  }
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = value;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
