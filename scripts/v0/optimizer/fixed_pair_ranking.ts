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
