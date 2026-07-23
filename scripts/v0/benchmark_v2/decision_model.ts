import { benchmarkDecisionPolicy } from "../../../benchmark/v2/decision-policy.ts";
import { shiftedGeometricMean } from "../score.ts";
import {
  canonicalMembers,
  type SuiteGroup,
  type SuiteManifest,
  type SuiteParent,
} from "./suite_model.ts";

export const DECISION_INFERENCE_SOURCE_FILES = [
  "benchmark/v2/decision-policy.ts",
  "scripts/v0/benchmark_v2/decision_model.ts",
  "scripts/v0/benchmark_v2/evaluator.ts",
  "scripts/v0/benchmark_v2/suite_model.ts",
  "scripts/v0/score.ts",
] as const;

export type DecisionProfile = "probe" | "canonical";
export type DecisionMode = "improvement" | "simplification";
export type DecisionOutcome = "advance" | "stop" | "unresolved" | "accept" | "reject" | "inconclusive";

export type DecisionRun = {
  sourceId: string;
  budget: number;
  seedSlot: number;
  actualSeed: number;
  score: { score: number; valid: boolean };
};

export type DecisionOptions = {
  profile: DecisionProfile;
  mode: DecisionMode;
  margin?: number;
  iterations?: number;
  bootstrapSeed?: number;
};

export type ConfidenceBounds = {
  estimate: number;
  standardError: number;
  degreesOfFreedom: number | null;
  centralLevel: number;
  centralCriticalLevel: number;
  centralLo: number;
  centralHi: number;
  oneSidedLevel: number;
  oneSidedCriticalLevel: number;
  lowerBound: number;
  upperBound: number;
};

export type SensitivityInterval = {
  available: boolean;
  estimate: number;
  bootstrapMedian: number;
  standardError: number;
  centralLevel: number;
  centralLo: number;
  centralHi: number;
};

type DeltaSummary = {
  base: number;
  candidate: number;
  delta: number;
};

type ValiditySummary = {
  baseValid: number;
  candidateValid: number;
  total: number;
  gained: number;
  lost: number;
};

export type V2Decision = {
  method: typeof benchmarkDecisionPolicy.method;
  profile: DecisionProfile;
  authority: "screening" | "promotion";
  mode: DecisionMode;
  margin: number | null;
  threshold: number;
  alpha: number;
  criticalAlpha: number;
  iterations: number;
  bootstrapSeed: number;
  baseHeadline: number;
  candidateHeadline: number;
  delta: number;
  confidence: ConfidenceBounds;
  uncertainty: {
    seed: ConfidenceBounds;
    jointSensitivity: SensitivityInterval;
    catalogSensitivity: SensitivityInterval;
  };
  outcome: DecisionOutcome;
  promotable: boolean;
  validity: ValiditySummary;
  perBudget: Array<DeltaSummary & ValiditySummary & { budget: number; confidence: ConfidenceBounds }>;
  perStratum: Array<DeltaSummary & ValiditySummary & { stratum: string; confidence: ConfidenceBounds }>;
  perGroup: Array<DeltaSummary & { stratum: string; group: string }>;
  perParent: Array<DeltaSummary & { stratum: string; group: string; parent: string }>;
  perCase: Array<DeltaSummary & ValiditySummary & { sourceId: string }>;
};

type ParentPlan = Map<string, SuiteParent[]>;
type SeedPlan = Map<number, number[]>;
type RunIndex = {
  byCell: Map<string, DecisionRun>;
  slotsByBudget: Map<number, number[]>;
  scoresBySourceBudget: Map<string, number[]>;
};
type ScoreBreakdown = {
  headline: number;
  budgets: Map<number, number>;
  strata: Map<string, number>;
  groups: Map<string, number>;
  parents: Map<string, number>;
  cases: Map<string, number>;
};

export function pairedV2Decision(
  baseRuns: DecisionRun[],
  candidateRuns: DecisionRun[],
  suite: SuiteManifest,
  options: DecisionOptions,
): V2Decision {
  return pairedV2DecisionCore(baseRuns, candidateRuns, suite, options, true);
}

export function pairedV2DecisionForCalibration(
  baseRuns: DecisionRun[],
  candidateRuns: DecisionRun[],
  suite: SuiteManifest,
  options: DecisionOptions,
): V2Decision {
  return pairedV2DecisionCore(baseRuns, candidateRuns, suite, options, false);
}

/**
 * Exact global verdict for Monte-Carlo calibration. The calibration generator
 * only consumes these three fields; computing every per-budget, stratum, and
 * case diagnostic would repeat the costly seed-block jackknife several times
 * per simulated trial without affecting its verdict or any certified rate.
 */
export function pairedV2CalibrationVerdict(
  baseRuns: DecisionRun[],
  candidateRuns: DecisionRun[],
  suite: SuiteManifest,
  options: DecisionOptions,
): Pick<V2Decision, "delta" | "confidence" | "outcome"> {
  const policy = resolvePolicy(options);
  assertPairedScope(baseRuns, candidateRuns);
  const budgets = [...suite.profiles[options.profile].budgets];
  const base = indexRuns(baseRuns, suite, options.profile);
  const candidate = indexRuns(candidateRuns, suite, options.profile);
  const fullParents = fullParentPlan(suite);
  const fullSeeds = new Map([...base.slotsByBudget].map(([budget, slots]) => [budget, [...slots]]));
  const basePoint = scorePlan(base, suite, budgets, fullParents, fullSeeds);
  const candidatePoint = scorePlan(candidate, suite, budgets, fullParents, fullSeeds);
  const pointDelta = candidatePoint.headline - basePoint.headline;
  const confidence = seedBlockConfidence(
    base,
    candidate,
    suite,
    budgets,
    fullParents,
    fullSeeds,
    pointDelta,
    (breakdown, budget) => breakdown.budgets.get(budget)!,
    policy.alpha,
    policy.criticalAlpha,
  );
  const outcome = confidence.lowerBound > policy.threshold
    ? policy.positiveOutcome
    : confidence.upperBound < policy.threshold
      ? policy.negativeOutcome
      : policy.unresolvedOutcome;
  return { delta: round(pointDelta), confidence, outcome };
}

function pairedV2DecisionCore(
  baseRuns: DecisionRun[],
  candidateRuns: DecisionRun[],
  suite: SuiteManifest,
  options: DecisionOptions,
  includeSensitivity: boolean,
): V2Decision {
  const policy = resolvePolicy(options);
  assertPairedScope(baseRuns, candidateRuns);
  const budgets = [...suite.profiles[options.profile].budgets];
  const base = indexRuns(baseRuns, suite, options.profile);
  const candidate = indexRuns(candidateRuns, suite, options.profile);
  const fullParents = fullParentPlan(suite);
  const fullSeeds = new Map([...base.slotsByBudget].map(([budget, slots]) => [budget, [...slots]]));
  const baseFullCaseScores = caseScoreCache(base, budgets, fullSeeds);
  const candidateFullCaseScores = caseScoreCache(candidate, budgets, fullSeeds);
  const basePoint = scorePlan(base, suite, budgets, fullParents, fullSeeds);
  const candidatePoint = scorePlan(candidate, suite, budgets, fullParents, fullSeeds);
  const pointDelta = candidatePoint.headline - basePoint.headline;

  const random = mulberry32(policy.bootstrapSeed);
  const jointDeltas: number[] = [];
  const catalogOnlyDeltas: number[] = [];

  for (let iteration = 0; iteration < (includeSensitivity ? policy.iterations : 0); iteration++) {
    const parents = sampledParentPlan(suite, random);
    const seeds = sampledSeedPlan(base.slotsByBudget, random);
    const baseJoint = scoreHeadline(base, suite, budgets, parents, seeds);
    const candidateJoint = scoreHeadline(candidate, suite, budgets, parents, seeds);
    const baseCatalogOnly = scoreHeadline(base, suite, budgets, parents, fullSeeds, baseFullCaseScores);
    const candidateCatalogOnly = scoreHeadline(candidate, suite, budgets, parents, fullSeeds, candidateFullCaseScores);

    jointDeltas.push(candidateJoint - baseJoint);
    catalogOnlyDeltas.push(candidateCatalogOnly - baseCatalogOnly);
  }

  const seedConfidence = seedBlockConfidence(
    base,
    candidate,
    suite,
    budgets,
    fullParents,
    fullSeeds,
    pointDelta,
    (breakdown, budget) => breakdown.budgets.get(budget)!,
    policy.alpha,
    policy.criticalAlpha,
  );
  const jointSensitivity = includeSensitivity
    ? sensitivityInterval(pointDelta, jointDeltas)
    : unavailableSensitivity(pointDelta);
  const catalogSensitivity = includeSensitivity
    ? sensitivityInterval(pointDelta, catalogOnlyDeltas)
    : unavailableSensitivity(pointDelta);
  const positive = seedConfidence.lowerBound > policy.threshold;
  const negative = seedConfidence.upperBound < policy.threshold;
  const outcome = positive
    ? policy.positiveOutcome
    : negative
      ? policy.negativeOutcome
      : policy.unresolvedOutcome;
  const validity = validitySummary(baseRuns, candidateRuns);

  return {
    method: benchmarkDecisionPolicy.method,
    profile: options.profile,
    authority: policy.authority,
    mode: options.mode,
    margin: options.mode === "simplification" ? policy.margin : null,
    threshold: round(policy.threshold),
    alpha: policy.alpha,
    criticalAlpha: policy.criticalAlpha,
    iterations: includeSensitivity ? policy.iterations : 0,
    bootstrapSeed: policy.bootstrapSeed,
    baseHeadline: round(basePoint.headline),
    candidateHeadline: round(candidatePoint.headline),
    delta: round(pointDelta),
    confidence: seedConfidence,
    uncertainty: { seed: seedConfidence, jointSensitivity, catalogSensitivity },
    outcome,
    promotable: options.profile === "canonical" && outcome === "accept",
    validity,
    perBudget: budgets.map((budget) => ({
      budget,
      ...deltaSummary(basePoint.budgets.get(budget)!, candidatePoint.budgets.get(budget)!),
      ...validitySummary(
        baseRuns.filter((run) => run.budget === budget),
        candidateRuns.filter((run) => run.budget === budget),
      ),
      confidence: seedBlockConfidence(
        base,
        candidate,
        suite,
        [budget],
        fullParents,
        fullSeeds,
        candidatePoint.budgets.get(budget)! - basePoint.budgets.get(budget)!,
        (breakdown, selectedBudget) => breakdown.budgets.get(selectedBudget)!,
        policy.alpha,
        policy.criticalAlpha,
      ),
    })),
    perStratum: suite.strata.map((stratum) => {
      const members = new Set(stratum.groups.flatMap((group) => group.members));
      return {
        stratum: stratum.id,
        ...deltaSummary(basePoint.strata.get(stratum.id)!, candidatePoint.strata.get(stratum.id)!),
        ...validitySummary(
          baseRuns.filter((run) => members.has(run.sourceId)),
          candidateRuns.filter((run) => members.has(run.sourceId)),
        ),
        confidence: seedBlockConfidence(
          base,
          candidate,
          suite,
          budgets,
          fullParents,
          fullSeeds,
          candidatePoint.strata.get(stratum.id)! - basePoint.strata.get(stratum.id)!,
          (breakdown) => breakdown.strata.get(stratum.id)!,
          policy.alpha,
          policy.criticalAlpha,
        ),
      };
    }),
    perGroup: suite.strata.flatMap((stratum) => stratum.groups.map((group) => ({
      stratum: stratum.id,
      group: group.id,
      ...deltaSummary(basePoint.groups.get(group.id)!, candidatePoint.groups.get(group.id)!),
    }))),
    perParent: suite.strata.flatMap((stratum) => stratum.groups.flatMap((group) =>
      parentsOf(group).map((parent) => ({
        stratum: stratum.id,
        group: group.id,
        parent: parent.id,
        ...deltaSummary(basePoint.parents.get(parent.id)!, candidatePoint.parents.get(parent.id)!),
      }))
    )),
    perCase: canonicalMembers(suite).map((sourceId) => ({
      sourceId,
      ...deltaSummary(basePoint.cases.get(sourceId)!, candidatePoint.cases.get(sourceId)!),
      ...validitySummary(
        baseRuns.filter((run) => run.sourceId === sourceId),
        candidateRuns.filter((run) => run.sourceId === sourceId),
      ),
    })),
  };
}

export function v2HeadlineForDecisionRuns(
  runs: DecisionRun[],
  suite: SuiteManifest,
  profile: DecisionProfile,
): number {
  const indexed = indexRuns(runs, suite, profile);
  const budgets = [...suite.profiles[profile].budgets];
  return scorePlan(
    indexed,
    suite,
    budgets,
    fullParentPlan(suite),
    new Map([...indexed.slotsByBudget].map(([budget, slots]) => [budget, [...slots]])),
  ).headline;
}

function resolvePolicy(options: DecisionOptions): {
  authority: "screening" | "promotion";
  alpha: number;
  criticalAlpha: number;
  margin: number;
  threshold: number;
  iterations: number;
  bootstrapSeed: number;
  positiveOutcome: DecisionOutcome;
  negativeOutcome: DecisionOutcome;
  unresolvedOutcome: DecisionOutcome;
} {
  const profile = benchmarkDecisionPolicy.profiles[options.profile];
  const margin = options.mode === "simplification" ? options.margin : 0;
  if (options.mode === "simplification" && (!Number.isFinite(margin) || margin! <= 0)) {
    throw new Error(`simplification decisions require a positive headline-point margin`);
  }
  if (options.mode === "improvement" && options.margin !== undefined) {
    throw new Error(`--margin is only valid in simplification mode`);
  }
  const iterations = options.iterations ?? benchmarkDecisionPolicy.bootstrapIterations;
  if (!Number.isSafeInteger(iterations) || iterations < 100) {
    throw new Error(`bootstrap iterations must be an integer of at least 100`);
  }
  const bootstrapSeed = options.bootstrapSeed ?? benchmarkDecisionPolicy.bootstrapSeed;
  if (!Number.isSafeInteger(bootstrapSeed)) throw new Error(`bootstrap seed must be an integer`);
  return {
    authority: profile.authority,
    alpha: profile.alpha,
    criticalAlpha: profile.criticalAlpha,
    margin: margin!,
    threshold: options.mode === "simplification" ? -margin! : 0,
    iterations,
    bootstrapSeed,
    positiveOutcome: profile.positiveOutcome,
    negativeOutcome: profile.negativeOutcome,
    unresolvedOutcome: profile.unresolvedOutcome,
  };
}

function indexRuns(runs: DecisionRun[], suite: SuiteManifest, profile: DecisionProfile): RunIndex {
  const members = canonicalMembers(suite);
  const expectedMembers = new Set(members);
  const expectedBudgets = suite.profiles[profile].budgets;
  const expectedBudgetSet = new Set(expectedBudgets);
  const expectedSeeds = suite.profiles[profile].seeds_per_budget;
  const byCell = new Map<string, DecisionRun>();
  const slotsByBudget = new Map<number, Set<number>>(expectedBudgets.map((budget) => [budget, new Set()]));
  const actualSeedByBudgetSlot = new Map<string, number>();

  for (const run of runs) {
    if (!expectedMembers.has(run.sourceId) || !expectedBudgetSet.has(run.budget)) {
      throw new Error(`decision run is outside the ${profile} suite scope`);
    }
    if (
      !Number.isSafeInteger(run.seedSlot) || run.seedSlot < 0 ||
      !Number.isSafeInteger(run.actualSeed) || run.actualSeed < 0 ||
      typeof run.score?.valid !== "boolean" || !Number.isFinite(run.score?.score) ||
      run.score.score < 0 || run.score.score > 1000
    ) {
      throw new Error(`decision run contains an invalid seed or score`);
    }
    const key = cellKey(run.sourceId, run.budget, run.seedSlot);
    if (byCell.has(key)) throw new Error(`decision runs contain duplicate cells`);
    byCell.set(key, run);
    slotsByBudget.get(run.budget)!.add(run.seedSlot);
    const blockKey = `${run.budget}\0${run.seedSlot}`;
    const priorSeed = actualSeedByBudgetSlot.get(blockKey);
    if (priorSeed !== undefined && priorSeed !== run.actualSeed) {
      throw new Error(`a budget seed block maps to multiple actual seeds`);
    }
    actualSeedByBudgetSlot.set(blockKey, run.actualSeed);
  }

  for (const budget of expectedBudgets) {
    const slots = [...slotsByBudget.get(budget)!].sort((a, b) => a - b);
    if (slots.length !== expectedSeeds || slots.some((slot, index) => slot !== index)) {
      throw new Error(`${profile} budget ${budget} does not have the expected contiguous seed slots`);
    }
    for (const sourceId of members) {
      for (const slot of slots) {
        if (!byCell.has(cellKey(sourceId, budget, slot))) {
          throw new Error(`decision runs do not contain the complete expected scope`);
        }
      }
    }
  }
  const expectedCount = members.length * expectedBudgets.length * expectedSeeds;
  if (byCell.size !== expectedCount) throw new Error(`decision runs do not contain the complete expected scope`);
  return {
    byCell,
    slotsByBudget: new Map([...slotsByBudget].map(([budget, slots]) => [budget, [...slots].sort((a, b) => a - b)])),
    scoresBySourceBudget: new Map(members.flatMap((sourceId) => expectedBudgets.map((budget) => [
      sourceBudgetKey(sourceId, budget),
      [...slotsByBudget.get(budget)!].sort((a, b) => a - b).map((slot) =>
        byCell.get(cellKey(sourceId, budget, slot))!.score.score
      ),
    ] as const))),
  };
}

function scorePlan(
  runs: RunIndex,
  suite: SuiteManifest,
  budgets: number[],
  parentPlan: ParentPlan,
  seedPlan: SeedPlan,
): ScoreBreakdown {
  const budgetScores = new Map<number, number>();
  const strataByBudget = new Map<string, Map<number, number>>();
  const groupsByBudget = new Map<string, Map<number, number>>();
  const parentsByBudget = new Map<string, Map<number, number>>();
  const casesByBudget = new Map<string, Map<number, number>>();

  for (const budget of budgets) {
    const seedSlots = seedPlan.get(budget);
    if (seedSlots === undefined || seedSlots.length === 0) throw new Error(`${budget}: empty seed sample`);
    let budgetScore = 0;
    for (const stratum of suite.strata) {
      let stratumScore = 0;
      for (const group of stratum.groups) {
        const selectedParents = parentPlan.get(group.id);
        if (selectedParents === undefined || selectedParents.length === 0) {
          throw new Error(`${group.id}: empty parent sample`);
        }
        const parentScores = selectedParents.map((parent) => {
          const caseScores = parent.members.map((sourceId) => {
            const score = round(shiftedGeometricMean(seedSlots.map((seedSlot) =>
              runs.byCell.get(cellKey(sourceId, budget, seedSlot))!.score.score
            )));
            setBudgetValue(casesByBudget, sourceId, budget, score);
            return score;
          });
          const score = round(shiftedGeometricMean(caseScores));
          setBudgetValue(parentsByBudget, parent.id, budget, score);
          return score;
        });
        const groupScore = round(shiftedGeometricMean(parentScores));
        setBudgetValue(groupsByBudget, group.id, budget, groupScore);
        stratumScore += group.weight * groupScore;
      }
      stratumScore = round(stratumScore);
      setBudgetValue(strataByBudget, stratum.id, budget, stratumScore);
      budgetScore += stratum.weight * stratumScore;
    }
    budgetScores.set(budget, round(budgetScore));
  }

  return {
    headline: weightedBudgets(budgetScores, budgets, suite),
    budgets: budgetScores,
    strata: aggregateBudgetMaps(strataByBudget, budgets, suite),
    groups: aggregateBudgetMaps(groupsByBudget, budgets, suite),
    parents: aggregateBudgetMaps(parentsByBudget, budgets, suite),
    cases: aggregateBudgetMaps(casesByBudget, budgets, suite),
  };
}

/** Exact headline-only form of scorePlan for bootstrap iterations. */
function scoreHeadline(
  runs: RunIndex,
  suite: SuiteManifest,
  budgets: number[],
  parentPlan: ParentPlan,
  seedPlan: SeedPlan,
  cachedCaseScores?: Map<string, number>,
): number {
  const budgetScores = new Map<number, number>();
  for (const budget of budgets) {
    const seedSlots = seedPlan.get(budget);
    if (seedSlots === undefined || seedSlots.length === 0) throw new Error(`${budget}: empty seed sample`);
    let budgetScore = 0;
    for (const stratum of suite.strata) {
      let stratumScore = 0;
      for (const group of stratum.groups) {
        const selectedParents = parentPlan.get(group.id);
        if (selectedParents === undefined || selectedParents.length === 0) {
          throw new Error(`${group.id}: empty parent sample`);
        }
        const parentScores = selectedParents.map((parent) => round(shiftedGeometricMean(
          parent.members.map((sourceId) => cachedCaseScores?.get(sourceBudgetKey(sourceId, budget)) ??
            round(shiftedGeometricMeanSlots(runs.scoresBySourceBudget.get(sourceBudgetKey(sourceId, budget))!, seedSlots))
          ),
        )));
        stratumScore += group.weight * round(shiftedGeometricMean(parentScores));
      }
      budgetScore += stratum.weight * round(stratumScore);
    }
    budgetScores.set(budget, round(budgetScore));
  }
  return weightedBudgets(budgetScores, budgets, suite);
}

function caseScoreCache(runs: RunIndex, budgets: number[], seedPlan: SeedPlan): Map<string, number> {
  const scores = new Map<string, number>();
  for (const [key, values] of runs.scoresBySourceBudget) {
    const budget = Number(key.slice(key.lastIndexOf("\0") + 1));
    if (!budgets.includes(budget)) continue;
    scores.set(key, round(shiftedGeometricMeanSlots(values, seedPlan.get(budget)!)));
  }
  return scores;
}

function shiftedGeometricMeanSlots(values: number[], slots: number[]): number {
  let sum = 0;
  for (const slot of slots) {
    const value = values[slot];
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
    sum += Math.log(safe + 1);
  }
  return Math.exp(sum / slots.length) - 1;
}

function sourceBudgetKey(sourceId: string, budget: number): string {
  return `${sourceId}\0${budget}`;
}

function aggregateBudgetMaps(
  values: Map<string, Map<number, number>>,
  budgets: number[],
  suite: SuiteManifest,
): Map<string, number> {
  return new Map([...values].map(([id, byBudget]) => [id, weightedBudgets(byBudget, budgets, suite)]));
}

function weightedBudgets(
  scores: Map<number, number>,
  budgets: number[],
  suite: Pick<SuiteManifest, "budget_weights">,
): number {
  const weights = new Map(suite.budget_weights.map((entry) => [entry.budget, entry.weight]));
  const denominator = budgets.reduce((sum, budget) => sum + (weights.get(budget) ?? 0), 0);
  if (denominator <= 0) throw new Error(`decision scope has no positive budget weight`);
  return round(budgets.reduce(
    (sum, budget) => sum + scores.get(budget)! * (weights.get(budget) ?? 0),
    0,
  ) / denominator);
}

function fullParentPlan(suite: SuiteManifest): ParentPlan {
  return new Map(suite.strata.flatMap((stratum) =>
    stratum.groups.map((group) => [group.id, parentsOf(group)] as const)
  ));
}

function sampledParentPlan(suite: SuiteManifest, random: () => number): ParentPlan {
  return new Map(suite.strata.flatMap((stratum) => stratum.groups.map((group) => {
    const parents = parentsOf(group);
    return [group.id, parents.map(() => pick(parents, random))] as const;
  })));
}

function sampledSeedPlan(slotsByBudget: Map<number, number[]>, random: () => number): SeedPlan {
  return new Map([...slotsByBudget].map(([budget, slots]) => [
    budget,
    slots.map(() => pick(slots, random)),
  ]));
}

function parentsOf(group: SuiteGroup): SuiteParent[] {
  return group.parents ?? group.members.map((id) => ({ id, members: [id] }));
}

function setBudgetValue(
  values: Map<string, Map<number, number>>,
  id: string,
  budget: number,
  value: number,
): void {
  const byBudget = values.get(id) ?? new Map<number, number>();
  byBudget.set(budget, value);
  values.set(id, byBudget);
}

function sensitivityInterval(estimate: number, samples: number[]): SensitivityInterval {
  const sorted = [...samples].sort((a, b) => a - b);
  const average = mean(sorted);
  return {
    available: true,
    estimate: round(estimate),
    bootstrapMedian: round(quantile(sorted, 0.5)),
    standardError: round(Math.sqrt(mean(sorted.map((value) => (value - average) ** 2)))),
    centralLevel: benchmarkDecisionPolicy.centralIntervalLevel,
    centralLo: round(quantile(sorted, (1 - benchmarkDecisionPolicy.centralIntervalLevel) / 2)),
    centralHi: round(quantile(sorted, 1 - (1 - benchmarkDecisionPolicy.centralIntervalLevel) / 2)),
  };
}

function unavailableSensitivity(estimate: number): SensitivityInterval {
  return {
    available: false,
    estimate: round(estimate),
    bootstrapMedian: round(estimate),
    standardError: 0,
    centralLevel: benchmarkDecisionPolicy.centralIntervalLevel,
    centralLo: round(estimate),
    centralHi: round(estimate),
  };
}

function seedBlockConfidence(
  base: RunIndex,
  candidate: RunIndex,
  suite: SuiteManifest,
  budgets: number[],
  fullParents: ParentPlan,
  fullSeeds: SeedPlan,
  estimate: number,
  metric: (breakdown: ScoreBreakdown, budget: number) => number,
  alpha: number,
  criticalAlpha: number,
): ConfidenceBounds {
  const rawWeights = new Map(suite.budget_weights.map((entry) => [entry.budget, entry.weight]));
  const weightTotal = budgets.reduce((sum, budget) => sum + (rawWeights.get(budget) ?? 0), 0);
  if (weightTotal <= 0) throw new Error(`decision scope has no positive budget weight`);
  const varianceComponents: Array<{ variance: number; degreesOfFreedom: number }> = [];

  for (const budget of budgets) {
    const slots = fullSeeds.get(budget)!;
    if (slots.length < 2) throw new Error(`${budget}: at least two seed blocks are required for inference`);
    const baseFull = scorePlan(base, suite, [budget], fullParents, fullSeeds);
    const candidateFull = scorePlan(candidate, suite, [budget], fullParents, fullSeeds);
    const fullDelta = metric(candidateFull, budget) - metric(baseFull, budget);
    const pseudoValues = slots.map((removedSlot) => {
      const leaveOneOut = new Map([...fullSeeds].map(([entryBudget, entrySlots]) => [
        entryBudget,
        entryBudget === budget ? entrySlots.filter((slot) => slot !== removedSlot) : [...entrySlots],
      ]));
      const baseLoo = scorePlan(base, suite, [budget], fullParents, leaveOneOut);
      const candidateLoo = scorePlan(candidate, suite, [budget], fullParents, leaveOneOut);
      const looDelta = metric(candidateLoo, budget) - metric(baseLoo, budget);
      return slots.length * fullDelta - (slots.length - 1) * looDelta;
    });
    const pseudoMean = mean(pseudoValues);
    const sampleVariance = pseudoValues.reduce(
      (sum, value) => sum + (value - pseudoMean) ** 2,
      0,
    ) / (pseudoValues.length - 1);
    const normalizedWeight = (rawWeights.get(budget) ?? 0) / weightTotal;
    varianceComponents.push({
      variance: normalizedWeight ** 2 * sampleVariance / pseudoValues.length,
      degreesOfFreedom: pseudoValues.length - 1,
    });
  }

  const variance = varianceComponents.reduce((sum, component) => sum + component.variance, 0);
  const standardError = Math.sqrt(Math.max(0, variance));
  const denominator = varianceComponents.reduce(
    (sum, component) => sum + component.variance ** 2 / component.degreesOfFreedom,
    0,
  );
  const degreesOfFreedom = variance > 0 && denominator > 0 ? variance ** 2 / denominator : Infinity;
  const centralTail = (1 - benchmarkDecisionPolicy.centralCriticalIntervalLevel) / 2;
  const centralCritical = standardError === 0 ? 0 : studentTQuantile(1 - centralTail, degreesOfFreedom);
  const oneSidedCritical = standardError === 0 ? 0 : studentTQuantile(1 - criticalAlpha, degreesOfFreedom);
  return {
    estimate: round(estimate),
    standardError: round(standardError),
    degreesOfFreedom: Number.isFinite(degreesOfFreedom) ? round(degreesOfFreedom) : null,
    centralLevel: benchmarkDecisionPolicy.centralIntervalLevel,
    centralCriticalLevel: benchmarkDecisionPolicy.centralCriticalIntervalLevel,
    centralLo: round(estimate - centralCritical * standardError),
    centralHi: round(estimate + centralCritical * standardError),
    oneSidedLevel: round(1 - alpha),
    oneSidedCriticalLevel: round(1 - criticalAlpha),
    lowerBound: round(estimate - oneSidedCritical * standardError),
    upperBound: round(estimate + oneSidedCritical * standardError),
  };
}

export function studentTQuantile(probability: number, degreesOfFreedom: number): number {
  if (!(probability > 0 && probability < 1)) throw new Error(`t probability must be in (0,1)`);
  if (!(degreesOfFreedom > 0)) throw new Error(`t degrees of freedom must be positive`);
  if (!Number.isFinite(degreesOfFreedom)) return inverseNormal(probability);
  if (probability < 0.5) return -studentTQuantile(1 - probability, degreesOfFreedom);
  let low = 0;
  let high = 1;
  while (studentTCdf(high, degreesOfFreedom) < probability) high *= 2;
  for (let iteration = 0; iteration < 80; iteration++) {
    const middle = (low + high) / 2;
    if (studentTCdf(middle, degreesOfFreedom) < probability) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

function studentTCdf(value: number, degreesOfFreedom: number): number {
  if (value === 0) return 0.5;
  const x = degreesOfFreedom / (degreesOfFreedom + value * value);
  const tail = 0.5 * regularizedIncompleteBeta(x, degreesOfFreedom / 2, 0.5);
  return value > 0 ? 1 - tail : tail;
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  return x < (a + 1) / (a + b + 2)
    ? front * betaContinuedFraction(x, a, b) / a
    : 1 - front * betaContinuedFraction(1 - x, b, a) / b;
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let result = d;
  for (let iteration = 1; iteration <= 200; iteration++) {
    const even = 2 * iteration;
    let numerator = iteration * (b - iteration) * x / ((a + even - 1) * (a + even));
    d = 1 + numerator * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + numerator / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    result *= d * c;
    numerator = -(a + iteration) * (a + b + iteration) * x / ((a + even) * (a + even + 1));
    d = 1 + numerator * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + numerator / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    result *= delta;
    if (Math.abs(delta - 1) < 1e-12) break;
  }
  return result;
}

function logGamma(value: number): number {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  const z = value - 1;
  let series = 0.9999999999998099;
  for (let index = 0; index < coefficients.length; index++) series += coefficients[index] / (z + index + 1);
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(series);
}

function inverseNormal(probability: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lower = 0.02425;
  if (probability < lower) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (probability > 1 - lower) return -inverseNormal(1 - probability);
  const q = probability - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function validitySummary(base: DecisionRun[], candidate: DecisionRun[]): ValiditySummary {
  const candidateByKey = new Map(candidate.map((run) => [scopeKey(run), run]));
  let baseValid = 0;
  let candidateValid = 0;
  let gained = 0;
  let lost = 0;
  for (const baseRun of base) {
    const candidateRun = candidateByKey.get(scopeKey(baseRun));
    if (candidateRun === undefined) throw new Error(`validity scope is not paired`);
    if (baseRun.score.valid) baseValid++;
    if (candidateRun.score.valid) candidateValid++;
    if (!baseRun.score.valid && candidateRun.score.valid) gained++;
    if (baseRun.score.valid && !candidateRun.score.valid) lost++;
  }
  return { baseValid, candidateValid, total: base.length, gained, lost };
}

function deltaSummary(base: number, candidate: number): DeltaSummary {
  return { base: round(base), candidate: round(candidate), delta: round(candidate - base) };
}

function assertPairedScope(base: DecisionRun[], candidate: DecisionRun[]): void {
  const a = base.map(scopeKey).sort();
  const b = candidate.map(scopeKey).sort();
  if (
    a.length === 0 || new Set(a).size !== a.length || new Set(b).size !== b.length ||
    a.length !== b.length || a.some((value, index) => value !== b[index])
  ) {
    throw new Error(`decision archives do not have identical paired scope`);
  }
}

function scopeKey(run: DecisionRun): string {
  return `${run.sourceId}\0${run.budget}\0${run.seedSlot}\0${run.actualSeed}`;
}

function cellKey(sourceId: string, budget: number, seedSlot: number): string {
  return `${sourceId}\0${budget}\0${seedSlot}`;
}

function pick<T>(values: T[], random: () => number): T {
  return values[Math.floor(random() * values.length)];
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

function quantile(sorted: number[], probability: number): number {
  if (sorted.length === 0) throw new Error(`cannot summarize an empty bootstrap distribution`);
  const index = (sorted.length - 1) * Math.max(0, Math.min(1, probability));
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  const fraction = index - low;
  return sorted[low] * (1 - fraction) + sorted[high] * fraction;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
