/**
 * Generic protected-boundary classifier for static post-impact primitives.
 *
 * A construction probe may reject an attributable collision at or before H,
 * but any unexplained prefix/capture drift is a protocol failure. This module
 * is independent of a particular carrier geometry or response metric.
 */
export type PostimpactConstructionProbeGuards = {
  physicalPrefixMatchesBaseline: boolean;
  captureOnlyPreHComplete: boolean;
  captureOnlyPreHTraceAvailable: boolean;
  captureTraceMatchesComparator: boolean;
  traceMatchesBeforeFirstSupportCollision: boolean;
  selectedCaptureEventMatchesComparator: boolean;
  impactMatchesComparator: boolean;
  survivesThroughH: boolean;
  preOrAtHSupportCollisionCount: number;
};

export type PostimpactConstructionProbeVerdict = {
  constructionSafe: boolean;
  expectedCollisionRejection: boolean;
  protocolInvalid: boolean;
  reason: string | null;
};

/** Fail-closed classification for a post-selection replay through H. */
export type PostimpactMeasurementBoundaryGuards = {
  selectedConstructionArmSafe: boolean;
  carrierLineIdsUnique: boolean;
  carrierLineIdsDisjointFromCapture: boolean;
  preOrAtHCarrierCollisionCount: number;
  physicalPrefixMatchesBaseline: boolean;
  captureFullTraceMatchesComparator: boolean;
  captureTraceMatchesComparator: boolean;
  selectedCaptureEventMatchesComparator: boolean;
  impactMatchesComparator: boolean;
};

export type PostimpactMeasurementBoundaryVerdict = {
  protectedBoundaryValid: boolean;
  reason: string | null;
};

export function classifyPostimpactMeasurementBoundary(
  guards: PostimpactMeasurementBoundaryGuards,
): PostimpactMeasurementBoundaryVerdict {
  if (!Number.isSafeInteger(guards.preOrAtHCarrierCollisionCount) || guards.preOrAtHCarrierCollisionCount < 0) {
    throw new Error("preOrAtHCarrierCollisionCount must be a non-negative safe integer");
  }
  const failures = [
    ["selected_construction_arm_not_safe", guards.selectedConstructionArmSafe],
    ["carrier_line_ids_not_unique", guards.carrierLineIdsUnique],
    ["carrier_line_ids_overlap_capture", guards.carrierLineIdsDisjointFromCapture],
    ["carrier_collision_at_or_before_H_on_measurement_replay", guards.preOrAtHCarrierCollisionCount === 0],
    ["physical_prefix_changed_on_measurement_replay", guards.physicalPrefixMatchesBaseline],
    ["capture_full_trace_changed_on_measurement_replay", guards.captureFullTraceMatchesComparator],
    ["capture_trace_changed_on_measurement_replay", guards.captureTraceMatchesComparator],
    ["capture_event_changed_on_measurement_replay", guards.selectedCaptureEventMatchesComparator],
    ["capture_impact_changed_on_measurement_replay", guards.impactMatchesComparator],
  ] as const;
  const failure = failures.find(([, held]) => !held)?.[0] ?? null;
  return { protectedBoundaryValid: failure === null, reason: failure };
}

export function classifyPostimpactConstructionProbe(
  guards: PostimpactConstructionProbeGuards,
): PostimpactConstructionProbeVerdict {
  if (!Number.isSafeInteger(guards.preOrAtHSupportCollisionCount) || guards.preOrAtHSupportCollisionCount < 0) {
    throw new Error("preOrAtHSupportCollisionCount must be a non-negative safe integer");
  }
  const immutableComparatorFailures = [
    ["physical_prefix_changed", guards.physicalPrefixMatchesBaseline],
    ["capture_only_pre_H_incomplete", guards.captureOnlyPreHComplete],
    ["capture_only_pre_H_trace_unavailable", guards.captureOnlyPreHTraceAvailable],
  ] as const;
  const immutableComparatorFailure = immutableComparatorFailures.find(([, held]) => !held)?.[0] ?? null;
  if (immutableComparatorFailure !== null) {
    return {
      constructionSafe: false,
      expectedCollisionRejection: false,
      protocolInvalid: true,
      reason: immutableComparatorFailure,
    };
  }
  // The comparator covers the exact full capture through H. Even without a
  // carrier collision, a state change during the current contact is a
  // protected-boundary failure, not an eligible phase.
  if (!guards.traceMatchesBeforeFirstSupportCollision) {
    return {
      constructionSafe: false,
      expectedCollisionRejection: false,
      protocolInvalid: true,
      reason: "trace_changed_before_first_support_collision",
    };
  }
  if (guards.preOrAtHSupportCollisionCount > 0) {
    return {
      constructionSafe: false,
      expectedCollisionRejection: true,
      protocolInvalid: false,
      reason: "support_collision_at_or_before_H",
    };
  }
  const protectedTraceFailures = [
    ["capture_trace_changed_before_response", guards.captureTraceMatchesComparator],
    ["capture_event_changed", guards.selectedCaptureEventMatchesComparator],
    ["capture_impact_changed", guards.impactMatchesComparator],
    ["candidate_did_not_survive_through_H", guards.survivesThroughH],
  ] as const;
  const protectedTraceFailure = protectedTraceFailures.find(([, held]) => !held)?.[0] ?? null;
  if (protectedTraceFailure !== null) {
    return {
      constructionSafe: false,
      expectedCollisionRejection: false,
      protocolInvalid: true,
      reason: protectedTraceFailure,
    };
  }
  return {
    constructionSafe: true,
    expectedCollisionRejection: false,
    protocolInvalid: false,
    reason: null,
  };
}
