/**
 * Preserve an incumbent's first distinct choice while allowing a challenger
 * ranking to supply only the second slot. Remaining slots, if any, retain the
 * incumbent order. Identity is by object reference; both orders must contain
 * the same candidate objects.
 */

export type IncumbentFirstChallengerSecondResult<T> = Readonly<{
  selected: T[];
  incumbentSelected: T[];
  eligible: boolean;
  substitutedSecond: boolean;
  challengerDistinctnessRejections: number;
}>;

export type GuardedSecondScores = Readonly<{
  incumbentImpact: number;
  incumbentUtility: number;
  residualImpact: number;
}>;

export type GuardedSecondThresholds = Readonly<{
  maximumIncumbentImpactRegret: number;
  maximumIncumbentUtilityRegret: number;
  minimumResidualImpactAdvantage: number;
}>;

export type IncumbentFirstGuardedChallengerSecondResult<T> = Readonly<{
  selected: T[];
  incumbentSelected: T[];
  eligible: boolean;
  challengerDiffered: boolean;
  substitutedSecond: boolean;
  challengerDistinctnessRejections: number;
  gate: null | Readonly<{
    incumbentImpactRegret: number;
    incumbentUtilityRegret: number;
    residualImpactAdvantage: number;
    impactRegretPassed: boolean;
    utilityRegretPassed: boolean;
    residualAdvantagePassed: boolean;
    accepted: boolean;
  }>;
}>;

export function selectIncumbentFirstChallengerSecond<T>(
  incumbentOrder: readonly T[],
  challengerOrder: readonly T[],
  proposalCount: number,
  distinct: (candidate: T, selected: readonly T[]) => boolean,
): IncumbentFirstChallengerSecondResult<T> {
  if (!Number.isInteger(proposalCount) || proposalCount < 0) {
    throw new Error("proposalCount must be a non-negative integer");
  }
  const incumbentSelected = selectDistinct(
    incumbentOrder,
    proposalCount,
    distinct,
  );
  if (proposalCount < 2 || incumbentSelected.length < 2) {
    return {
      selected: incumbentSelected,
      incumbentSelected,
      eligible: false,
      substitutedSecond: false,
      challengerDistinctnessRejections: 0,
    };
  }

  const selected = [incumbentSelected[0]];
  const incumbentDomain = new Set(incumbentOrder);
  let challengerDistinctnessRejections = 0;
  for (const candidate of challengerOrder) {
    if (!incumbentDomain.has(candidate)) {
      throw new Error("challenger order contains a foreign candidate");
    }
    if (distinct(candidate, selected)) {
      selected.push(candidate);
      break;
    }
    challengerDistinctnessRejections++;
  }
  if (selected.length < 2) {
    // This is unreachable when both orders contain the same candidates and
    // the incumbent had a second distinct choice, but keep the fallback total.
    selected.push(incumbentSelected[1]);
  }
  for (const candidate of incumbentOrder) {
    if (selected.length >= proposalCount) break;
    if (!selected.includes(candidate) && distinct(candidate, selected)) {
      selected.push(candidate);
    }
  }
  if (selected[0] !== incumbentSelected[0]) {
    throw new Error("challenger selection changed the incumbent first choice");
  }
  return {
    selected,
    incumbentSelected,
    eligible: true,
    substitutedSecond: selected[1] !== incumbentSelected[1],
    challengerDistinctnessRejections,
  };
}

/** Preserve the complete incumbent selection unless a genuinely different
 * challenger clears every declared safety gate. Regrets are one-sided: a
 * challenger that the incumbent already prefers has zero regret. */
export function selectIncumbentFirstGuardedChallengerSecond<T>(
  incumbentOrder: readonly T[],
  challengerOrder: readonly T[],
  proposalCount: number,
  distinct: (candidate: T, selected: readonly T[]) => boolean,
  scores: (candidate: T) => GuardedSecondScores,
  thresholds: GuardedSecondThresholds,
): IncumbentFirstGuardedChallengerSecondResult<T> {
  for (const [name, value] of [
    ["maximumIncumbentImpactRegret", thresholds.maximumIncumbentImpactRegret],
    ["maximumIncumbentUtilityRegret", thresholds.maximumIncumbentUtilityRegret],
    ["minimumResidualImpactAdvantage", thresholds.minimumResidualImpactAdvantage],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${name} must be a finite non-negative number`);
    }
  }
  const raw = selectIncumbentFirstChallengerSecond(
    incumbentOrder,
    challengerOrder,
    proposalCount,
    distinct,
  );
  if (!raw.eligible || !raw.substitutedSecond) {
    return {
      ...raw,
      selected: raw.incumbentSelected,
      challengerDiffered: false,
      substitutedSecond: false,
      gate: null,
    };
  }

  const incumbentSecond = scores(raw.incumbentSelected[1]);
  const challengerSecond = scores(raw.selected[1]);
  for (const [label, values] of [
    ["incumbent second", incumbentSecond],
    ["challenger second", challengerSecond],
  ] as const) {
    for (const [name, value] of Object.entries(values)) {
      if (!Number.isFinite(value)) {
        throw new Error(`${label} ${name} must be finite`);
      }
    }
  }
  const incumbentImpactRegret = Math.max(
    0,
    incumbentSecond.incumbentImpact - challengerSecond.incumbentImpact,
  );
  const incumbentUtilityRegret = Math.max(
    0,
    incumbentSecond.incumbentUtility - challengerSecond.incumbentUtility,
  );
  const residualImpactAdvantage =
    challengerSecond.residualImpact - incumbentSecond.residualImpact;
  const comparisonTolerance = Number.EPSILON * 8 * Math.max(
    1,
    Math.abs(incumbentImpactRegret),
    Math.abs(incumbentUtilityRegret),
    Math.abs(residualImpactAdvantage),
    Math.abs(thresholds.maximumIncumbentImpactRegret),
    Math.abs(thresholds.maximumIncumbentUtilityRegret),
    Math.abs(thresholds.minimumResidualImpactAdvantage),
  );
  const impactRegretPassed =
    incumbentImpactRegret <=
      thresholds.maximumIncumbentImpactRegret + comparisonTolerance;
  const utilityRegretPassed =
    incumbentUtilityRegret <=
      thresholds.maximumIncumbentUtilityRegret + comparisonTolerance;
  const residualAdvantagePassed =
    residualImpactAdvantage + comparisonTolerance >=
      thresholds.minimumResidualImpactAdvantage;
  const accepted = impactRegretPassed && utilityRegretPassed && residualAdvantagePassed;
  return {
    ...raw,
    selected: accepted ? raw.selected : raw.incumbentSelected,
    challengerDiffered: true,
    substitutedSecond: accepted,
    gate: {
      incumbentImpactRegret,
      incumbentUtilityRegret,
      residualImpactAdvantage,
      impactRegretPassed,
      utilityRegretPassed,
      residualAdvantagePassed,
      accepted,
    },
  };
}

function selectDistinct<T>(
  order: readonly T[],
  count: number,
  distinct: (candidate: T, selected: readonly T[]) => boolean,
): T[] {
  const selected: T[] = [];
  for (const candidate of order) {
    if (selected.length >= count) break;
    if (distinct(candidate, selected)) selected.push(candidate);
  }
  return selected;
}
