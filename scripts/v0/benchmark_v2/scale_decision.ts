import {
  pairedGridOutcomeSummary,
  type CellPair,
  type GridCell,
} from "../../benchmark/paired_grid.ts";
import type { PairedOutcomeSummary } from "../../benchmark/paired_outcomes.ts";
import { studentTCdf, studentTQuantile, type ConfidenceBounds } from "./decision_model.ts";
import {
  multiBudgetSeeds,
  summarizeScaleBudget,
  summarizeScalePanel,
  type MultiBudgetProfile,
  type ScaleScoredRun,
} from "./scale_profile.ts";

export const MULTI_BUDGET_COMPARISON_SCHEMA =
  "line.benchmark-v2.multi-budget-comparison.v2" as const;

export type ScalePreferenceAction =
  | "prefer-candidate"
  | "prefer-reference"
  | "continue"
  | "inconclusive";

export type ScaleLookDecision = {
  depth: number;
  referenceScaleHeadline: number;
  candidateScaleHeadline: number;
  delta: number;
  confidence: ConfidenceBounds;
  directionalProbability: number;
  requiredDirectionalProbability: number;
  action: ScalePreferenceAction;
};

export type ScaleComparisonResult = {
  requestedDepth: number;
  stoppingDepth: number;
  outcome: ScalePreferenceAction;
  nextLook: number | null;
  looks: ScaleLookDecision[];
  final: ScaleLookDecision;
  validity: {
    referenceValid: number;
    candidateValid: number;
    total: number;
    gained: number;
    lost: number;
  };
  outcomes: PairedOutcomeSummary;
  changedTracks: number;
  perBudget: Array<{
    budget: number;
    referenceScore: number;
    candidateScore: number;
    delta: number;
    confidence: ConfidenceBounds;
    directionalProbability: number;
    referenceValid: number;
    candidateValid: number;
    total: number;
    gained: number;
    lost: number;
    outcomes: PairedOutcomeSummary;
  }>;
  perSource: Array<{
    sourceId: string;
    referenceScore: number;
    candidateScore: number;
    delta: number;
    referenceValid: number;
    candidateValid: number;
    total: number;
    gained: number;
    lost: number;
    outcomes: PairedOutcomeSummary;
  }>;
  canonicalBudget: {
    budget: number;
    referenceScore: number;
    candidateScore: number;
    delta: number;
  };
};

export type ScaleDepthCharacterization = {
  depth: number;
  referenceScaleHeadline: number;
  candidateScaleHeadline: number;
  delta: number;
  confidence: ConfidenceBounds;
  directionalProbability: number;
  validity: ScaleComparisonResult["validity"];
  outcomes: PairedOutcomeSummary;
  changedTracks: number;
  perBudget: ScaleComparisonResult["perBudget"];
  perSource: ScaleComparisonResult["perSource"];
  canonicalBudget: ScaleComparisonResult["canonicalBudget"];
};

export function pairedScaleComparison(
  pairs: CellPair[],
  profile: MultiBudgetProfile,
  requestedDepth: number,
): ScaleComparisonResult {
  const requestedSeeds = multiBudgetSeeds(profile, requestedDepth);
  assertCompleteScalePairs(pairs, profile, requestedSeeds);
  const declaredLooks = profile.seedSchedule.looks.filter((look) => look <= requestedDepth);
  if (declaredLooks.length === 0 || !declaredLooks.includes(requestedDepth)) {
    throw new Error(
      `scale comparison depth must be a declared look: ${profile.seedSchedule.looks.join(",")}`,
    );
  }

  const looks: ScaleLookDecision[] = [];
  for (const depth of declaredLooks) {
    const lookPairs = pairsAtSeeds(pairs, new Set(multiBudgetSeeds(profile, depth)));
    const decision = scaleLookDecision(lookPairs, profile, depth);
    looks.push(decision);
    if (decision.action === "prefer-candidate" || decision.action === "prefer-reference") break;
  }
  const final = looks.at(-1)!;
  const finalSeeds = new Set(multiBudgetSeeds(profile, final.depth));
  const finalPairs = pairsAtSeeds(pairs, finalSeeds);
  const characterization = scaleDepthCharacterization(finalPairs, profile, final.depth);
  const nextLook = final.action === "continue"
    ? profile.seedSchedule.looks.find((look) => look > final.depth) ?? null
    : null;
  return {
    requestedDepth,
    stoppingDepth: final.depth,
    outcome: final.action,
    nextLook,
    looks,
    final,
    validity: characterization.validity,
    outcomes: characterization.outcomes,
    changedTracks: characterization.changedTracks,
    perBudget: characterization.perBudget,
    perSource: characterization.perSource,
    canonicalBudget: characterization.canonicalBudget,
  };
}

/**
 * Describe every requested seed curve without applying sequential stopping.
 *
 * When a declared earlier look already selected an arm, this is post-decision
 * characterization, not a second preference decision or an independent look.
 */
export function scaleDepthCharacterization(
  pairs: CellPair[],
  profile: MultiBudgetProfile,
  depth: number,
): ScaleDepthCharacterization {
  const seeds = multiBudgetSeeds(profile, depth);
  assertCompleteScalePairs(pairs, profile, seeds);
  const seedSet = new Set(seeds);
  const depthPairs = pairsAtSeeds(pairs, seedSet);
  const referenceRuns = armRuns(depthPairs, "ref");
  const candidateRuns = armRuns(depthPairs, "candidate");
  const reference = summarizeScalePanel(referenceRuns, profile);
  const candidate = summarizeScalePanel(candidateRuns, profile);
  const confidence = jackknifeConfidence(
    depthPairs,
    seeds,
    (runs) => summarizeScalePanel(runs, profile).scaleHeadline,
    profile,
  );
  const perBudget = profile.budgets.map(({ frames }) => {
    const budgetPairs = depthPairs.filter((pair) => pair.ref.budget === frames);
    const referenceBudget = summarizeScaleBudget(referenceRuns, frames, profile);
    const candidateBudget = summarizeScaleBudget(candidateRuns, frames, profile);
    const budgetConfidence = jackknifeConfidence(
      budgetPairs,
      seeds,
      (runs) => summarizeScaleBudget(runs, frames, profile).score,
      profile,
    );
    return {
      budget: frames,
      referenceScore: referenceBudget.score,
      candidateScore: candidateBudget.score,
      delta: round(candidateBudget.score - referenceBudget.score),
      confidence: budgetConfidence,
      directionalProbability: directionalProbability(budgetConfidence),
      ...validity(budgetPairs),
      outcomes: pairedGridOutcomeSummary(budgetPairs),
    };
  });
  const perSource = profile.sources.map(({ id }) => {
    const sourcePairs = depthPairs.filter((pair) => pair.ref.sourceId === id);
    const referenceScore = sourceScaleScore(armRuns(sourcePairs, "ref"), id, profile);
    const candidateScore = sourceScaleScore(armRuns(sourcePairs, "candidate"), id, profile);
    return {
      sourceId: id,
      referenceScore,
      candidateScore,
      delta: round(candidateScore - referenceScore),
      ...validity(sourcePairs),
      outcomes: pairedGridOutcomeSummary(sourcePairs),
    };
  });
  const canonical = perBudget.find((budget) => budget.budget === profile.canonicalBudget)!;
  return {
    depth,
    referenceScaleHeadline: reference.scaleHeadline,
    candidateScaleHeadline: candidate.scaleHeadline,
    delta: round(candidate.scaleHeadline - reference.scaleHeadline),
    confidence,
    directionalProbability: roundProbability(directionalProbability(confidence)),
    validity: validity(depthPairs),
    outcomes: pairedGridOutcomeSummary(depthPairs),
    changedTracks: depthPairs.filter((pair) => pair.ref.trackHash !== pair.candidate.trackHash).length,
    perBudget,
    perSource,
    canonicalBudget: {
      budget: canonical.budget,
      referenceScore: canonical.referenceScore,
      candidateScore: canonical.candidateScore,
      delta: canonical.delta,
    },
  };
}

export function scaleLookDecision(
  pairs: CellPair[],
  profile: MultiBudgetProfile,
  depth: number,
): ScaleLookDecision {
  const seeds = multiBudgetSeeds(profile, depth);
  assertCompleteScalePairs(pairs, profile, seeds);
  const reference = summarizeScalePanel(armRuns(pairs, "ref"), profile);
  const candidate = summarizeScalePanel(armRuns(pairs, "candidate"), profile);
  const confidence = jackknifeConfidence(
    pairs,
    seeds,
    (runs) => summarizeScalePanel(runs, profile).scaleHeadline,
    profile,
  );
  const probability = directionalProbability(confidence);
  const required = 1 - profile.decision.directionalFamilyAlpha / profile.seedSchedule.looks.length;
  const action: ScalePreferenceAction = confidence.available && probability >= required
    ? "prefer-candidate"
    : confidence.available && probability <= 1 - required
      ? "prefer-reference"
      : depth < profile.seedSchedule.maximumSeeds
        ? "continue"
        : "inconclusive";
  return {
    depth,
    referenceScaleHeadline: reference.scaleHeadline,
    candidateScaleHeadline: candidate.scaleHeadline,
    delta: round(candidate.scaleHeadline - reference.scaleHeadline),
    confidence,
    directionalProbability: roundProbability(probability),
    requiredDirectionalProbability: roundProbability(required),
    action,
  };
}

function jackknifeConfidence(
  pairs: CellPair[],
  seeds: number[],
  metric: (runs: ScaleScoredRun[]) => number,
  profile: MultiBudgetProfile,
): ConfidenceBounds {
  const reference = metric(armRuns(pairs, "ref"));
  const candidate = metric(armRuns(pairs, "candidate"));
  const estimate = candidate - reference;
  if (seeds.length < 2) return unavailableConfidence(estimate, profile);
  const pseudoValues = seeds.map((removedSeed) => {
    const leaveOneOut = pairs.filter((pair) => pair.ref.seed !== removedSeed);
    const looDelta = metric(armRuns(leaveOneOut, "candidate")) - metric(armRuns(leaveOneOut, "ref"));
    return seeds.length * estimate - (seeds.length - 1) * looDelta;
  });
  const pseudoMean = mean(pseudoValues);
  const sampleVariance = pseudoValues.reduce(
    (sum, value) => sum + (value - pseudoMean) ** 2,
    0,
  ) / (pseudoValues.length - 1);
  const standardError = Math.sqrt(Math.max(0, sampleVariance / pseudoValues.length));
  const degreesOfFreedom = seeds.length - 1;
  const centralTail = (1 - profile.decision.centralIntervalLevel) / 2;
  const centralCritical = standardError === 0
    ? 0
    : studentTQuantile(1 - centralTail, degreesOfFreedom);
  const perLookAlpha = profile.decision.directionalFamilyAlpha / profile.seedSchedule.looks.length;
  const oneSidedCritical = standardError === 0
    ? 0
    : studentTQuantile(1 - perLookAlpha, degreesOfFreedom);
  return {
    available: true,
    estimate: round(estimate),
    standardError: round(standardError),
    degreesOfFreedom,
    centralLevel: profile.decision.centralIntervalLevel,
    centralCriticalLevel: profile.decision.centralIntervalLevel,
    centralLo: round(estimate - centralCritical * standardError),
    centralHi: round(estimate + centralCritical * standardError),
    oneSidedLevel: roundProbability(1 - profile.decision.directionalFamilyAlpha),
    oneSidedCriticalLevel: roundProbability(1 - perLookAlpha),
    lowerBound: round(estimate - oneSidedCritical * standardError),
    upperBound: round(estimate + oneSidedCritical * standardError),
  };
}

function unavailableConfidence(estimate: number, profile: MultiBudgetProfile): ConfidenceBounds {
  const value = round(estimate);
  return {
    available: false,
    estimate: value,
    standardError: 0,
    degreesOfFreedom: null,
    centralLevel: profile.decision.centralIntervalLevel,
    centralCriticalLevel: profile.decision.centralIntervalLevel,
    centralLo: value,
    centralHi: value,
    oneSidedLevel: roundProbability(1 - profile.decision.directionalFamilyAlpha),
    oneSidedCriticalLevel: roundProbability(
      1 - profile.decision.directionalFamilyAlpha / profile.seedSchedule.looks.length,
    ),
    lowerBound: value,
    upperBound: value,
  };
}

function directionalProbability(confidence: ConfidenceBounds): number {
  if (!confidence.available) return 0.5;
  if (confidence.standardError === 0) {
    return confidence.estimate > 0 ? 1 : confidence.estimate < 0 ? 0 : 0.5;
  }
  return studentTCdf(
    confidence.estimate / confidence.standardError,
    confidence.degreesOfFreedom ?? Infinity,
  );
}

function armRuns(pairs: CellPair[], arm: "ref" | "candidate"): ScaleScoredRun[] {
  return pairs.map((pair) => {
    const cell = pair[arm];
    return {
      sourceId: cell.sourceId,
      budget: cell.budget,
      actualSeed: cell.seed,
      score: { score: cell.score, valid: cell.valid },
    };
  });
}

function sourceScaleScore(
  runs: ScaleScoredRun[],
  sourceId: string,
  profile: MultiBudgetProfile,
): number {
  return round(profile.budgets.reduce((sum, budget) => {
    const summary = summarizeScaleBudget(
      runs.filter((run) => run.sourceId === sourceId),
      budget.frames,
      {
        ...profile,
        sources: [{ id: sourceId, behavior: sourceId, weight: 1 }],
      },
    );
    return sum + budget.weight * summary.score;
  }, 0));
}

function validity(pairs: CellPair[]): {
  referenceValid: number;
  candidateValid: number;
  total: number;
  gained: number;
  lost: number;
} {
  return {
    referenceValid: pairs.filter((pair) => pair.ref.valid).length,
    candidateValid: pairs.filter((pair) => pair.candidate.valid).length,
    total: pairs.length,
    gained: pairs.filter((pair) => !pair.ref.valid && pair.candidate.valid).length,
    lost: pairs.filter((pair) => pair.ref.valid && !pair.candidate.valid).length,
  };
}

function assertCompleteScalePairs(
  pairs: CellPair[],
  profile: MultiBudgetProfile,
  seeds: number[],
): void {
  const expected = profile.sources.length * profile.budgets.length * seeds.length;
  if (pairs.length !== expected) {
    throw new Error(`multi-budget comparison needs ${expected} paired cells, got ${pairs.length}`);
  }
  const keys = new Set(pairs.map((pair) => cellKey(pair.ref)));
  for (const source of profile.sources) {
    for (const budget of profile.budgets) {
      for (const seed of seeds) {
        if (!keys.has(`${source.id}\0${budget.frames}\0${seed}`)) {
          throw new Error(`multi-budget comparison is missing ${source.id}/${budget.frames}/seed-${seed}`);
        }
      }
    }
  }
}

function pairsAtSeeds(pairs: CellPair[], seeds: Set<number>): CellPair[] {
  return pairs.filter((pair) => seeds.has(pair.ref.seed));
}

function cellKey(cell: GridCell): string {
  return `${cell.sourceId}\0${cell.budget}\0${cell.seed}`;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function roundProbability(value: number): number {
  return Number(value.toFixed(8));
}
