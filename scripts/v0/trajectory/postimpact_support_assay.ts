/**
 * Protocol rules for the continuous post-impact support-curve assay.
 *
 * Construction may reject a static primitive at its protected boundary, but a
 * curve response is admitted only through the typed shared-capture, phase, and
 * causal-exposure certificates below.
 */
import {
  CONTINUOUS_SUPPORT_CURVE_ACTIONS,
  CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS,
  type ContinuousSupportCurveAction,
} from "./continuous_support_curve.ts";
import type { PostimpactNamedReferenceStep } from "./postimpact_support_orientation.ts";
import type { PostimpactEngineTraceFingerprint } from "./postimpact_trace.ts";

export const POSTIMPACT_SUPPORT_MIN_MEASUREMENT_HORIZON_FRAMES = 4;
export const POSTIMPACT_SUPPORT_MAX_MEASUREMENT_HORIZON_FRAMES = 12;

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
  if (guards.preOrAtHSupportCollisionCount > 0) {
    if (!guards.traceMatchesBeforeFirstSupportCollision) {
      return {
        constructionSafe: false,
        expectedCollisionRejection: false,
        protocolInvalid: true,
        reason: "trace_changed_before_first_support_collision",
      };
    }
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

export type PostimpactMeasurementHorizon =
  | { status: "ready"; measurementHorizonFrames: number; measurementSamples: number }
  | { status: "insufficient_measurement_horizon"; availableIntervals: number };

/**
 * The outgoing endpoint bounds observation availability only. It never sets
 * primitive extent or construction phase.
 */
export function postimpactMeasurementHorizon(
  outgoingEndFrame: number,
  supportStartFrame: number,
): PostimpactMeasurementHorizon {
  assertFrame("outgoingEndFrame", outgoingEndFrame);
  assertFrame("supportStartFrame", supportStartFrame);
  const availableIntervals = outgoingEndFrame - supportStartFrame;
  if (availableIntervals < POSTIMPACT_SUPPORT_MIN_MEASUREMENT_HORIZON_FRAMES) {
    return { status: "insufficient_measurement_horizon", availableIntervals };
  }
  const measurementHorizonFrames = Math.min(
    POSTIMPACT_SUPPORT_MAX_MEASUREMENT_HORIZON_FRAMES,
    availableIntervals,
  );
  return {
    status: "ready",
    measurementHorizonFrames,
    measurementSamples: measurementHorizonFrames + 1,
  };
}

export function signedAngleDeltaDeg(fromDeg: number, toDeg: number): number {
  assertFinite("fromDeg", fromDeg);
  assertFinite("toDeg", toDeg);
  let delta = (toDeg - fromDeg) % 360;
  if (delta > 180) delta -= 360;
  if (delta <= -180) delta += 360;
  return delta;
}

/**
 * Curve-specific protocol types remain here, rather than in the runner, so a
 * future assay cannot silently weaken the declared five-arm control design.
 */
export type ContinuousSupportCurveActionId = ContinuousSupportCurveAction["id"];
export type ContinuousSupportCurvePhaseLeadStep = (typeof CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS)[number];

const CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER: readonly ContinuousSupportCurveActionId[] = Object.freeze(
  CONTINUOUS_SUPPORT_CURVE_ACTIONS.map((action): ContinuousSupportCurveActionId => action.id),
);

// Selection happens only inside one assay process. Keep the two derived
// certificates opaque at runtime so structural lookalikes cannot bypass the
// classifier/certifier after their raw replay evidence has been discarded.
const ISSUED_PHASE_CERTIFICATES = new WeakSet<object>();
const ISSUED_CAUSAL_EXPOSURES = new WeakSet<object>();

export const CONTINUOUS_SUPPORT_CURVE_PHASE_CERTIFICATE_PROTOCOL = Object.freeze({
  actionOrder: CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER,
  phaseLeadSteps: CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS,
});

export const CONTINUOUS_SUPPORT_CURVE_DIRECTIONAL_CONTRAST_PROTOCOL = Object.freeze({
  actionOrder: CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER,
  neutralActionId: "curve-neutral" as const,
  negativeEndpointActionId: "curve-turn-negative-8" as const,
  positiveEndpointActionId: "curve-turn-positive-8" as const,
  minimumEndpointContrastDeg: 2,
  monotonicityToleranceDeg: 0.01,
});

export const CONTINUOUS_SUPPORT_CURVE_CAUSAL_EXPOSURE_PROTOCOL = Object.freeze({
  /** A collision at H belongs to construction protection, not response exposure. */
  requireCollisionStrictlyAfterSupportStart: true,
  /** Reject neutral-equivalent geometry despite ordinary Float64 transport noise. */
  minimumActionSpecificTangentDeltaDeg: 1e-9,
  /**
   * Preserve a fixed post-contact observation tail. A collision later than
   * `measurementEndFrame - minimumResponseLagFrames` cannot support a
   * terminal-response attribution because no declared response interval
   * remains after it.
   */
  minimumResponseLagFrames: 2,
});

export type ContinuousSupportCurveConstructionProbe = {
  action: Pick<ContinuousSupportCurveAction, "id">;
  status: "observed" | "error";
  constructionSafe: boolean;
  expectedCollisionRejection: boolean;
  protocolInvalid: boolean;
};

/**
 * Shared capture-only evidence that binds a phase to the exact H -> H+1
 * named-reference observation used to realize every curve arm. This belongs in
 * the certificate rather than in a runner precondition: an action roster is
 * not meaningful when its common capture comparator is missing or drifting.
 */
export type ContinuousSupportCurveSharedCaptureCertificate = {
  supportStartFrame: number;
  captureOnlyCompleteThroughHPlusOne: boolean;
  /** Inclusive start frame of the exact full-engine capture-only trace. */
  captureOnlyTraceStartFrame: number;
  /** Inclusive end frame of the exact full-engine capture-only trace. */
  captureOnlyTraceEndFrame: number;
  exactCaptureOnlyTrace: PostimpactEngineTraceFingerprint;
  namedReferenceStep: Pick<
    PostimpactNamedReferenceStep,
    "anchorPoint" | "fromFrame" | "toFrame" | "exactCaptureOnlyTraceFingerprint"
  > | null;
};

export type ContinuousSupportCurvePhaseActionCertificate = {
  actionId: ContinuousSupportCurveActionId;
  status: ContinuousSupportCurveConstructionProbe["status"];
  constructionSafe: boolean;
  expectedCollisionRejection: boolean;
  protocolInvalid: boolean;
};

export type ContinuousSupportCurvePhaseCertificate = {
  phaseLeadSteps: ContinuousSupportCurvePhaseLeadStep;
  /** `certified` is the only status eligible for deterministic phase selection. */
  status: "certified" | "rejected" | "invalid";
  sharedConstructionSafe: boolean;
  /** Frozen, validated capture-only H -> H+1 provenance for this phase. */
  sharedCaptureCertificate: ContinuousSupportCurveSharedCaptureCertificate | null;
  actionOrder: readonly ContinuousSupportCurveActionId[];
  actions: readonly ContinuousSupportCurvePhaseActionCertificate[];
  rejectedActionIds: readonly ContinuousSupportCurveActionId[];
  invalidActionIds: readonly ContinuousSupportCurveActionId[];
  invalidProbeActions: number;
  reason:
    | "all_declared_actions_construction_safe"
    | "expected_construction_collision"
    | "invalid_construction_probe"
    | "invalid_shared_capture_certificate"
    | "unknown_action_id"
    | "duplicate_action_id"
    | "missing_declared_action";
};

/**
 * Turn a complete fixed construction phase into one typed certificate. A
 * collision-caused rejection is evidence, while a malformed or drifting probe
 * invalidates the phase and must never be selected as a harmless rejection.
 */
export function certifyContinuousSupportCurvePhase(
  phaseLeadSteps: ContinuousSupportCurvePhaseLeadStep,
  probes: readonly ContinuousSupportCurveConstructionProbe[],
  sharedCaptureCertificate: ContinuousSupportCurveSharedCaptureCertificate,
): ContinuousSupportCurvePhaseCertificate {
  assertDeclaredCurvePhaseLeadSteps(phaseLeadSteps);
  const actionOrder = CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER;
  const frozenSharedCaptureCertificate = validContinuousSupportCurveSharedCaptureCertificate(sharedCaptureCertificate)
    ? freezeContinuousSupportCurveSharedCaptureCertificate(sharedCaptureCertificate)
    : null;
  const byId = new Map<ContinuousSupportCurveActionId, ContinuousSupportCurveConstructionProbe>();
  const duplicateActionIds = new Set<ContinuousSupportCurveActionId>();
  let unknownAction = false;

  for (const probe of probes) {
    const id = probe?.action?.id;
    if (!isDeclaredCurveActionId(id)) {
      unknownAction = true;
      continue;
    }
    if (byId.has(id)) {
      duplicateActionIds.add(id);
      continue;
    }
    byId.set(id, probe);
  }

  const actions = actionOrder.flatMap((actionId) => {
    const probe = byId.get(actionId);
    return probe === undefined ? [] : [{
      actionId,
      status: probe.status,
      constructionSafe: probe.constructionSafe,
      expectedCollisionRejection: probe.expectedCollisionRejection,
      protocolInvalid: probe.protocolInvalid,
    } satisfies ContinuousSupportCurvePhaseActionCertificate];
  });
  const missingActionIds = actionOrder.filter((actionId) => !byId.has(actionId));

  if (frozenSharedCaptureCertificate === null) {
    return phaseCertificate(
      phaseLeadSteps,
      "invalid",
      null,
      actions,
      [],
      [],
      "invalid_shared_capture_certificate",
    );
  }

  if (unknownAction) {
    return phaseCertificate(phaseLeadSteps, "invalid", frozenSharedCaptureCertificate, actions, [], actionOrder, "unknown_action_id");
  }
  if (duplicateActionIds.size > 0) {
    return phaseCertificate(
      phaseLeadSteps,
      "invalid",
      frozenSharedCaptureCertificate,
      actions,
      [],
      [...duplicateActionIds].sort(compareDeclaredCurveActionId),
      "duplicate_action_id",
    );
  }
  if (missingActionIds.length > 0) {
    return phaseCertificate(
      phaseLeadSteps,
      "invalid",
      frozenSharedCaptureCertificate,
      actions,
      [],
      missingActionIds,
      "missing_declared_action",
    );
  }

  const invalidActionIds = actions.flatMap((action) => {
    const statusIsKnown = action.status === "observed" || action.status === "error";
    const internallyConsistent = action.constructionSafe
      ? !action.expectedCollisionRejection && !action.protocolInvalid
      : action.expectedCollisionRejection || action.protocolInvalid || action.status === "error";
    return !statusIsKnown || action.status === "error" || action.protocolInvalid || !internallyConsistent
      ? [action.actionId]
      : [];
  });
  if (invalidActionIds.length > 0) {
    return phaseCertificate(
      phaseLeadSteps,
      "invalid",
      frozenSharedCaptureCertificate,
      actions,
      [],
      invalidActionIds,
      "invalid_construction_probe",
    );
  }

  const rejectedActionIds = actions.flatMap((action) =>
    action.constructionSafe ? [] : [action.actionId]
  );
  if (rejectedActionIds.length > 0) {
    return phaseCertificate(
      phaseLeadSteps,
      "rejected",
      frozenSharedCaptureCertificate,
      actions,
      rejectedActionIds,
      [],
      "expected_construction_collision",
    );
  }
  return phaseCertificate(
    phaseLeadSteps,
    "certified",
    frozenSharedCaptureCertificate,
    actions,
    [],
    [],
    "all_declared_actions_construction_safe",
  );
}

/**
 * Select only the first certified phase from the complete source-declared
 * ladder. The input order itself is verified so a future caller cannot sort by
 * an outcome before invoking the selector.
 */
export function firstCertifiedContinuousSupportCurvePhase(
  phases: readonly ContinuousSupportCurvePhaseCertificate[],
): ContinuousSupportCurvePhaseCertificate | null {
  if (phases.length !== CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS.length) {
    throw new Error("continuous support curve phase roster must contain every declared phase exactly once");
  }
  for (const [index, phase] of phases.entries()) {
    if (phase?.phaseLeadSteps !== CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS[index]) {
      throw new Error("continuous support curve phases must retain declared ladder order");
    }
    if (!validContinuousSupportCurvePhaseCertificate(phase)) {
      throw new Error("continuous support curve phase certificate is internally inconsistent");
    }
  }
  return phases.find((phase) => phase.status === "certified") ?? null;
}

export type ContinuousSupportCurveMatchedNeutralContext = {
  phaseLeadSteps: ContinuousSupportCurvePhaseLeadStep;
  measurementStartFrame: number;
  measurementEndFrame: number;
  /** Identity of the capture-only response used by every arm in the contrast. */
  captureComparatorFingerprint: string;
};

export type ContinuousSupportCurveMatchedNeutralArm = {
  action: Pick<ContinuousSupportCurveAction, "id">;
  structurallyValid: boolean;
  /** Terminal CoM heading over the common exact measurement window. */
  terminalHeadingDeg: number | null;
  matchedNeutralContext: ContinuousSupportCurveMatchedNeutralContext;
  /**
   * The complete fail-closed exposure certificate, not a caller-supplied
   * boolean. This keeps a directional contrast from bypassing its collision,
   * comparator, and response-window guards.
   */
  causalExposure: ContinuousSupportCurveCausalExposure;
};

export type ContinuousSupportCurveMatchedNeutralEffect = {
  actionId: ContinuousSupportCurveActionId;
  headingDeltaFromNeutralDeg: number;
};

export type ContinuousSupportCurveMatchedNeutralContrast = {
  available: boolean;
  protocolInvalid: boolean;
  reason:
    | null
    | "unknown_action_id"
    | "duplicate_action_id"
    | "missing_declared_action"
    | "invalid_matched_neutral_context"
    | "unmatched_neutral_context"
    | "arm_not_structurally_valid"
    | "causal_exposure_protocol_invalid"
    | "terminal_heading_unavailable"
    | "endpoint_action_specific_exposure_unavailable";
  matchedNeutralContext: ContinuousSupportCurveMatchedNeutralContext | null;
  effectsFromNeutralDeg: readonly ContinuousSupportCurveMatchedNeutralEffect[] | null;
  monotone: boolean | null;
  endpointContrastDeg: number | null;
  meetsMinimumContrast: boolean | null;
  endpointActionSpecificExposure: {
    negative: boolean | null;
    positive: boolean | null;
  };
};

/**
 * Evaluate the fixed five-arm ladder against its matched neutral arm. Unlike a
 * capture-only comparison, this rules out a common capture transient as the
 * apparent sign response. The two endpoint arms must also prove action-specific
 * post-H exposure before the row becomes directional evidence.
 */
export function summarizeContinuousSupportCurveMatchedNeutralContrast(
  arms: readonly ContinuousSupportCurveMatchedNeutralArm[],
): ContinuousSupportCurveMatchedNeutralContrast {
  const malformed = validateContinuousSupportCurveArmRoster(arms);
  if (malformed !== null) return unavailableMatchedNeutralContrast(malformed.reason, malformed.protocolInvalid);

  const byId = new Map(arms.map((arm) => [arm.action.id, arm]));
  const ordered = CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER.map((id) => byId.get(id)!);
  const context = ordered[0]!.matchedNeutralContext;
  if (!isValidMatchedNeutralContext(context)) {
    return unavailableMatchedNeutralContrast("invalid_matched_neutral_context", true);
  }
  if (!ordered.every((arm) => sameMatchedNeutralContext(arm.matchedNeutralContext, context))) {
    return unavailableMatchedNeutralContrast("unmatched_neutral_context", true);
  }
  if (ordered.some((arm) => !arm.structurallyValid)) {
    return unavailableMatchedNeutralContrast("arm_not_structurally_valid", false, context);
  }
  if (ordered.some((arm) => !ISSUED_CAUSAL_EXPOSURES.has(arm.causalExposure))) {
    return unavailableMatchedNeutralContrast("causal_exposure_protocol_invalid", true, context);
  }
  if (ordered.some((arm) => arm.causalExposure.protocolInvalid)) {
    return unavailableMatchedNeutralContrast("causal_exposure_protocol_invalid", true, context);
  }
  if (ordered.some((arm) => arm.terminalHeadingDeg === null || !Number.isFinite(arm.terminalHeadingDeg))) {
    return unavailableMatchedNeutralContrast("terminal_heading_unavailable", false, context);
  }

  const neutral = byId.get(CONTINUOUS_SUPPORT_CURVE_DIRECTIONAL_CONTRAST_PROTOCOL.neutralActionId)!;
  const neutralHeading = neutral.terminalHeadingDeg!;
  const effectsFromNeutralDeg = ordered.map((arm) => ({
    actionId: arm.action.id,
    headingDeltaFromNeutralDeg: signedAngleDeltaDeg(neutralHeading, arm.terminalHeadingDeg!),
  }));
  const effects = effectsFromNeutralDeg.map((effect) => effect.headingDeltaFromNeutralDeg);
  const monotone = effects.every((value, index) =>
    index === 0 || effects[index - 1]! <= value + CONTINUOUS_SUPPORT_CURVE_DIRECTIONAL_CONTRAST_PROTOCOL.monotonicityToleranceDeg
  );
  const endpointContrastDeg = effects.at(-1)! - effects[0]!;
  const negativeExposure = byId.get(CONTINUOUS_SUPPORT_CURVE_DIRECTIONAL_CONTRAST_PROTOCOL.negativeEndpointActionId)!
    .causalExposure.actionSpecific;
  const positiveExposure = byId.get(CONTINUOUS_SUPPORT_CURVE_DIRECTIONAL_CONTRAST_PROTOCOL.positiveEndpointActionId)!
    .causalExposure.actionSpecific;
  if (negativeExposure !== true || positiveExposure !== true) {
    return {
      available: false,
      protocolInvalid: false,
      reason: "endpoint_action_specific_exposure_unavailable",
      matchedNeutralContext: copyMatchedNeutralContext(context),
      effectsFromNeutralDeg,
      monotone,
      endpointContrastDeg,
      meetsMinimumContrast: endpointContrastDeg >= CONTINUOUS_SUPPORT_CURVE_DIRECTIONAL_CONTRAST_PROTOCOL.minimumEndpointContrastDeg,
      endpointActionSpecificExposure: { negative: negativeExposure, positive: positiveExposure },
    };
  }
  return {
    available: true,
    protocolInvalid: false,
    reason: null,
    matchedNeutralContext: copyMatchedNeutralContext(context),
    effectsFromNeutralDeg,
    monotone,
    endpointContrastDeg,
    meetsMinimumContrast: endpointContrastDeg >= CONTINUOUS_SUPPORT_CURVE_DIRECTIONAL_CONTRAST_PROTOCOL.minimumEndpointContrastDeg,
    endpointActionSpecificExposure: { negative: true, positive: true },
  };
}

export type ContinuousSupportCurveCollisionWitness = {
  frame: number;
  lineId: number;
  /** A non-empty list confirms that an engine collision update named body points. */
  pointIds: readonly string[];
};

export type ContinuousSupportCurveSegmentWitness = {
  lineId: number;
  segmentIndex: number;
  tangentDeg: number;
};

export type ContinuousSupportCurveCausalExposureInput = {
  action: Pick<ContinuousSupportCurveAction, "id">;
  supportStartFrame: number;
  constructionSafe: boolean;
  structurallyValid: boolean;
  /** Immutable [0,current.startFrame-1] replay identity. */
  physicalPrefixMatchesBaseline: boolean;
  /** Exact capture-only comparison through H. */
  captureTraceMatchesComparator: boolean;
  selectedCaptureEventMatchesComparator: boolean;
  impactMatchesComparator: boolean;
  /** Candidate/comparator identity through the frame before first support contact. */
  traceMatchesBeforeFirstSupportCollision: boolean;
  /** The proposed curve's line IDs cannot alias the capture primitive's IDs. */
  curveLineIdsDisjointFromCapture: boolean;
  /** Inclusive terminal frame of the predeclared response measurement window. */
  measurementEndFrame: number;
  actionSegments: readonly ContinuousSupportCurveSegmentWitness[];
  neutralSegments: readonly ContinuousSupportCurveSegmentWitness[];
  /** Exact engine CollisionUpdate line/body-point evidence for proposed curve lines. */
  curveCollisions: readonly ContinuousSupportCurveCollisionWitness[];
};

export type ContinuousSupportCurveCausalExposureHit = {
  frame: number;
  lineId: number;
  pointIds: readonly string[];
  segmentIndex: number;
  tangentDeltaFromNeutralDeg: number;
};

export type ContinuousSupportCurveCausalExposure = {
  actionSpecific: boolean;
  protocolInvalid: boolean;
  /** The single predeclared interval in which an attributed collision may occur. */
  eligibleCollisionWindow: { startFrame: number; endFrame: number } | null;
  /** The first post-H all-body curve collision frame when it lies in the eligible window. */
  firstEligibleCollisionFrame: number | null;
  reason:
    | "action_specific_curve_collision"
    | "action_not_construction_safe"
    | "action_not_structurally_valid"
    | "neutral_action"
    | "physical_prefix_changed"
    | "capture_trace_changed_before_response"
    | "capture_event_changed"
    | "capture_impact_changed"
    | "trace_changed_before_first_support_collision"
    | "curve_line_ids_overlap_capture"
    | "curve_collision_at_or_before_H"
    | "insufficient_measurement_window_for_response_lag"
    | "no_curve_collision_after_H"
    | "no_curve_collision_with_required_response_lag"
    | "first_curve_collision_only_neutral_equivalent_segments"
    | "invalid_causal_exposure_guards"
    | "invalid_curve_segment_correspondence"
    | "invalid_curve_collision_witness";
  causalHits: readonly ContinuousSupportCurveCausalExposureHit[];
};

/**
 * An action-specific exposure has a deliberately narrow causal interpretation:
 * every pre-response identity guard holds, curve IDs are distinct from the
 * capture primitive, and the *first* post-H all-body curve collision lands in
 * the fixed response window with enough remaining observation tail. At least
 * one line at that first collision frame must differ from its neutral segment.
 * Later collisions cannot rescue a common first contact because their response
 * is already potentially confounded by the earlier support interaction.
 */
export function classifyContinuousSupportCurveCausalExposure(
  input: ContinuousSupportCurveCausalExposureInput,
): ContinuousSupportCurveCausalExposure {
  if (!isDeclaredCurveActionId(input?.action?.id) || !validCausalExposureGuards(input)) {
    return invalidCausalExposure("invalid_causal_exposure_guards");
  }
  const eligibleCollisionWindow = responseEligibleCollisionWindow(input.supportStartFrame, input.measurementEndFrame);
  if (eligibleCollisionWindow === null) {
    return invalidCausalExposure("insufficient_measurement_window_for_response_lag");
  }
  const guardFailure = causalExposureGuardFailure(input);
  if (guardFailure !== null) return invalidCausalExposure(guardFailure);
  if (!input.constructionSafe) return noCausalExposure("action_not_construction_safe", eligibleCollisionWindow);
  if (!input.structurallyValid) return noCausalExposure("action_not_structurally_valid", eligibleCollisionWindow);
  const correspondence = curveSegmentCorrespondence(input.actionSegments, input.neutralSegments);
  if (correspondence === null) return invalidCausalExposure("invalid_curve_segment_correspondence");
  if (!validCurveCollisionWitnesses(input.curveCollisions)) return invalidCausalExposure("invalid_curve_collision_witness");
  if (input.action.id === CONTINUOUS_SUPPORT_CURVE_DIRECTIONAL_CONTRAST_PROTOCOL.neutralActionId) {
    return noCausalExposure("neutral_action", eligibleCollisionWindow);
  }

  const actionSegmentsByLineId = new Map(input.actionSegments.map((segment) => [segment.lineId, segment]));
  if (input.curveCollisions.some((hit) => hit.frame <= input.supportStartFrame)) {
    return invalidCausalExposure("curve_collision_at_or_before_H");
  }
  if (input.curveCollisions.some((hit) => !actionSegmentsByLineId.has(hit.lineId))) {
    return invalidCausalExposure("invalid_curve_collision_witness");
  }
  const hitsAfterH = input.curveCollisions.filter((hit) => hit.frame > input.supportStartFrame);
  if (hitsAfterH.length === 0) return noCausalExposure("no_curve_collision_after_H", eligibleCollisionWindow);
  const firstCollisionFrame = Math.min(...hitsAfterH.map((hit) => hit.frame));
  if (firstCollisionFrame > eligibleCollisionWindow.endFrame) {
    return noCausalExposure("no_curve_collision_with_required_response_lag", eligibleCollisionWindow);
  }
  const firstCollisionHits = hitsAfterH.filter((hit) => hit.frame === firstCollisionFrame);
  const causalHits = firstCollisionHits.flatMap((hit) => {
    const actionSegment = actionSegmentsByLineId.get(hit.lineId);
    if (actionSegment === undefined) return [];
    const neutralSegment = correspondence.get(actionSegment.segmentIndex)!;
    const tangentDeltaFromNeutralDeg = signedAngleDeltaDeg(neutralSegment.tangentDeg, actionSegment.tangentDeg);
    return Math.abs(tangentDeltaFromNeutralDeg) >=
        CONTINUOUS_SUPPORT_CURVE_CAUSAL_EXPOSURE_PROTOCOL.minimumActionSpecificTangentDeltaDeg
      ? [{
        frame: hit.frame,
        lineId: hit.lineId,
        pointIds: [...hit.pointIds],
        segmentIndex: actionSegment.segmentIndex,
        tangentDeltaFromNeutralDeg,
      }]
      : [];
  });
  return causalHits.length > 0
    ? issueCausalExposure({
      actionSpecific: true,
      protocolInvalid: false,
      eligibleCollisionWindow,
      firstEligibleCollisionFrame: firstCollisionFrame,
      reason: "action_specific_curve_collision",
      causalHits,
    })
    : noCausalExposure(
      "first_curve_collision_only_neutral_equivalent_segments",
      eligibleCollisionWindow,
      firstCollisionFrame,
    );
}

function phaseCertificate(
  phaseLeadSteps: ContinuousSupportCurvePhaseLeadStep,
  status: ContinuousSupportCurvePhaseCertificate["status"],
  sharedCaptureCertificate: ContinuousSupportCurveSharedCaptureCertificate | null,
  actions: readonly ContinuousSupportCurvePhaseActionCertificate[],
  rejectedActionIds: readonly ContinuousSupportCurveActionId[],
  invalidActionIds: readonly ContinuousSupportCurveActionId[],
  reason: ContinuousSupportCurvePhaseCertificate["reason"],
): ContinuousSupportCurvePhaseCertificate {
  const frozenActions = Object.freeze(actions.map((action) => Object.freeze({ ...action })));
  const frozenRejectedActionIds = Object.freeze([...rejectedActionIds]);
  const frozenInvalidActionIds = Object.freeze([...invalidActionIds]);
  const certificate = Object.freeze({
    phaseLeadSteps,
    status,
    sharedConstructionSafe: status === "certified",
    sharedCaptureCertificate,
    actionOrder: CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER,
    actions: frozenActions,
    rejectedActionIds: frozenRejectedActionIds,
    invalidActionIds: frozenInvalidActionIds,
    invalidProbeActions: frozenInvalidActionIds.length,
    reason,
  });
  ISSUED_PHASE_CERTIFICATES.add(certificate);
  return certificate;
}

function validContinuousSupportCurvePhaseCertificate(
  phase: ContinuousSupportCurvePhaseCertificate,
): boolean {
  if (phase === null || typeof phase !== "object" || !ISSUED_PHASE_CERTIFICATES.has(phase)) return false;
  if (!sameCurveActionOrder(phase.actionOrder) ||
      !validPhaseActionSubset(phase.actions) ||
      !validOrderedActionIds(phase.rejectedActionIds) ||
      !validOrderedActionIds(phase.invalidActionIds) ||
      !Number.isSafeInteger(phase.invalidProbeActions) ||
      phase.invalidProbeActions !== phase.invalidActionIds.length) {
    return false;
  }
  if (phase.status === "certified") return validCertifiedPhase(phase);
  if (phase.status === "rejected") return validRejectedPhase(phase);
  return phase.status === "invalid" && validInvalidPhase(phase);
}

function validCertifiedPhase(phase: ContinuousSupportCurvePhaseCertificate): boolean {
  return phase.sharedConstructionSafe &&
    phase.sharedCaptureCertificate !== null &&
    validContinuousSupportCurveSharedCaptureCertificate(phase.sharedCaptureCertificate) &&
    phase.reason === "all_declared_actions_construction_safe" &&
    phase.invalidProbeActions === 0 &&
    phase.rejectedActionIds.length === 0 &&
    phase.invalidActionIds.length === 0 &&
    hasFullDeclaredActionRoster(phase.actions) &&
    phase.actions.every((action) =>
      action.status === "observed" &&
      action.constructionSafe &&
      !action.expectedCollisionRejection &&
      !action.protocolInvalid
    );
}

function validRejectedPhase(phase: ContinuousSupportCurvePhaseCertificate): boolean {
  if (phase.sharedConstructionSafe || phase.sharedCaptureCertificate === null ||
      !validContinuousSupportCurveSharedCaptureCertificate(phase.sharedCaptureCertificate) ||
      phase.reason !== "expected_construction_collision" ||
      phase.invalidProbeActions !== 0 || phase.invalidActionIds.length !== 0 ||
      !hasFullDeclaredActionRoster(phase.actions)) {
    return false;
  }
  const rejectedActionIds = phase.actions.flatMap((action) => action.constructionSafe ? [] : [action.actionId]);
  return rejectedActionIds.length > 0 &&
    sameOrderedActionIds(phase.rejectedActionIds, rejectedActionIds) &&
    phase.actions.every((action) =>
      action.status === "observed" &&
      !action.protocolInvalid &&
      (action.constructionSafe ? !action.expectedCollisionRejection : action.expectedCollisionRejection)
    );
}

function validInvalidPhase(phase: ContinuousSupportCurvePhaseCertificate): boolean {
  if (phase.sharedConstructionSafe || phase.rejectedActionIds.length !== 0) return false;
  switch (phase.reason) {
    case "invalid_shared_capture_certificate":
      return phase.sharedCaptureCertificate === null &&
        phase.invalidProbeActions === 0 && phase.invalidActionIds.length === 0;
    case "unknown_action_id":
      return phase.sharedCaptureCertificate !== null &&
        validContinuousSupportCurveSharedCaptureCertificate(phase.sharedCaptureCertificate) &&
        sameOrderedActionIds(phase.invalidActionIds, CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER);
    case "duplicate_action_id":
      return phase.sharedCaptureCertificate !== null &&
        validContinuousSupportCurveSharedCaptureCertificate(phase.sharedCaptureCertificate) &&
        phase.invalidActionIds.length > 0 &&
        phase.invalidActionIds.every((id) => phase.actions.some((action) => action.actionId === id));
    case "missing_declared_action":
      return phase.sharedCaptureCertificate !== null &&
        validContinuousSupportCurveSharedCaptureCertificate(phase.sharedCaptureCertificate) &&
        sameOrderedActionIds(
          phase.invalidActionIds,
          CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER.filter((id) => !phase.actions.some((action) => action.actionId === id)),
        ) && phase.invalidActionIds.length > 0;
    case "invalid_construction_probe":
      return phase.sharedCaptureCertificate !== null &&
        validContinuousSupportCurveSharedCaptureCertificate(phase.sharedCaptureCertificate) &&
        hasFullDeclaredActionRoster(phase.actions) &&
        phase.invalidActionIds.length > 0 &&
        sameOrderedActionIds(phase.invalidActionIds, invalidPhaseActionIds(phase.actions));
    default:
      return false;
  }
}

function validPhaseActionSubset(actions: readonly ContinuousSupportCurvePhaseActionCertificate[]): boolean {
  if (!Array.isArray(actions)) return false;
  let previousIndex = -1;
  for (const action of actions) {
    if (action === null || typeof action !== "object" || !isDeclaredCurveActionId(action.actionId) ||
        (action.status !== "observed" && action.status !== "error") ||
        typeof action.constructionSafe !== "boolean" ||
        typeof action.expectedCollisionRejection !== "boolean" ||
        typeof action.protocolInvalid !== "boolean") {
      return false;
    }
    const index = CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER.indexOf(action.actionId);
    if (index <= previousIndex) return false;
    previousIndex = index;
  }
  return true;
}

function validOrderedActionIds(ids: readonly ContinuousSupportCurveActionId[]): boolean {
  return Array.isArray(ids) && ids.every((id, index) =>
    isDeclaredCurveActionId(id) &&
    (index === 0 || CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER.indexOf(ids[index - 1]!) < CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER.indexOf(id))
  );
}

function hasFullDeclaredActionRoster(actions: readonly ContinuousSupportCurvePhaseActionCertificate[]): boolean {
  return actions.length === CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER.length &&
    actions.every((action, index) => action.actionId === CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER[index]);
}

function sameOrderedActionIds(
  left: readonly ContinuousSupportCurveActionId[],
  right: readonly ContinuousSupportCurveActionId[],
): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function invalidPhaseActionIds(
  actions: readonly ContinuousSupportCurvePhaseActionCertificate[],
): ContinuousSupportCurveActionId[] {
  return actions.flatMap((action) => {
    const internallyConsistent = action.constructionSafe
      ? !action.expectedCollisionRejection && !action.protocolInvalid
      : action.expectedCollisionRejection || action.protocolInvalid || action.status === "error";
    return action.status === "error" || action.protocolInvalid || !internallyConsistent
      ? [action.actionId]
      : [];
  });
}

function sameCurveActionOrder(order: readonly ContinuousSupportCurveActionId[]): boolean {
  return Array.isArray(order) && order.length === CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER.length &&
    order.every((actionId, index) => actionId === CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER[index]);
}

function validContinuousSupportCurveSharedCaptureCertificate(
  certificate: ContinuousSupportCurveSharedCaptureCertificate,
): boolean {
  if (certificate === null || typeof certificate !== "object" ||
      !Number.isSafeInteger(certificate.supportStartFrame) || certificate.supportStartFrame < 0 ||
      certificate.captureOnlyCompleteThroughHPlusOne !== true ||
      !Number.isSafeInteger(certificate.captureOnlyTraceStartFrame) ||
      certificate.captureOnlyTraceStartFrame < 0 ||
      !Number.isSafeInteger(certificate.captureOnlyTraceEndFrame) ||
      certificate.captureOnlyTraceStartFrame > certificate.supportStartFrame ||
      certificate.captureOnlyTraceEndFrame < certificate.supportStartFrame + 1) {
    return false;
  }
  const trace = certificate.exactCaptureOnlyTrace;
  if (trace === null || typeof trace !== "object" ||
      trace.semantics !== "full_non_scarf_engine_state_v1" ||
      typeof trace.fingerprint !== "string" || trace.fingerprint.trim() === "" ||
      trace.unavailableAtFrame !== null ||
      !Number.isSafeInteger(trace.frameCount) ||
      trace.frameCount !== certificate.captureOnlyTraceEndFrame - certificate.captureOnlyTraceStartFrame + 1) {
    return false;
  }
  const step = certificate.namedReferenceStep;
  return step !== null && typeof step === "object" &&
    typeof step.anchorPoint === "string" && step.anchorPoint.length > 0 &&
    Number.isSafeInteger(step.fromFrame) && step.fromFrame === certificate.supportStartFrame &&
    Number.isSafeInteger(step.toFrame) && step.toFrame === certificate.supportStartFrame + 1 &&
    step.exactCaptureOnlyTraceFingerprint === trace.fingerprint;
}

function freezeContinuousSupportCurveSharedCaptureCertificate(
  certificate: ContinuousSupportCurveSharedCaptureCertificate,
): ContinuousSupportCurveSharedCaptureCertificate {
  return Object.freeze({
    supportStartFrame: certificate.supportStartFrame,
    captureOnlyCompleteThroughHPlusOne: certificate.captureOnlyCompleteThroughHPlusOne,
    captureOnlyTraceStartFrame: certificate.captureOnlyTraceStartFrame,
    captureOnlyTraceEndFrame: certificate.captureOnlyTraceEndFrame,
    exactCaptureOnlyTrace: Object.freeze({ ...certificate.exactCaptureOnlyTrace }),
    namedReferenceStep: certificate.namedReferenceStep === null
      ? null
      : Object.freeze({ ...certificate.namedReferenceStep }),
  });
}

function validateContinuousSupportCurveArmRoster(
  arms: readonly ContinuousSupportCurveMatchedNeutralArm[],
): { reason: Extract<ContinuousSupportCurveMatchedNeutralContrast["reason"], "unknown_action_id" | "duplicate_action_id" | "missing_declared_action">; protocolInvalid: true } | null {
  const seen = new Set<ContinuousSupportCurveActionId>();
  for (const arm of arms) {
    const id = arm?.action?.id;
    if (!isDeclaredCurveActionId(id)) return { reason: "unknown_action_id", protocolInvalid: true };
    if (seen.has(id)) return { reason: "duplicate_action_id", protocolInvalid: true };
    seen.add(id);
  }
  return seen.size === CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER.length
    ? null
    : { reason: "missing_declared_action", protocolInvalid: true };
}

function unavailableMatchedNeutralContrast(
  reason: Exclude<ContinuousSupportCurveMatchedNeutralContrast["reason"], null>,
  protocolInvalid: boolean,
  context: ContinuousSupportCurveMatchedNeutralContext | null = null,
): ContinuousSupportCurveMatchedNeutralContrast {
  return {
    available: false,
    protocolInvalid,
    reason,
    matchedNeutralContext: context === null ? null : copyMatchedNeutralContext(context),
    effectsFromNeutralDeg: null,
    monotone: null,
    endpointContrastDeg: null,
    meetsMinimumContrast: null,
    endpointActionSpecificExposure: { negative: null, positive: null },
  };
}

function isValidMatchedNeutralContext(value: ContinuousSupportCurveMatchedNeutralContext): boolean {
  return value !== null && typeof value === "object" &&
    (CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS as readonly number[]).includes(value.phaseLeadSteps) &&
    Number.isSafeInteger(value.measurementStartFrame) && value.measurementStartFrame >= 0 &&
    Number.isSafeInteger(value.measurementEndFrame) && value.measurementEndFrame >= value.measurementStartFrame &&
    typeof value.captureComparatorFingerprint === "string" && value.captureComparatorFingerprint.length > 0;
}

function sameMatchedNeutralContext(
  left: ContinuousSupportCurveMatchedNeutralContext,
  right: ContinuousSupportCurveMatchedNeutralContext,
): boolean {
  return left.phaseLeadSteps === right.phaseLeadSteps &&
    left.measurementStartFrame === right.measurementStartFrame &&
    left.measurementEndFrame === right.measurementEndFrame &&
    left.captureComparatorFingerprint === right.captureComparatorFingerprint;
}

function copyMatchedNeutralContext(
  context: ContinuousSupportCurveMatchedNeutralContext,
): ContinuousSupportCurveMatchedNeutralContext {
  return { ...context };
}

function curveSegmentCorrespondence(
  actionSegments: readonly ContinuousSupportCurveSegmentWitness[],
  neutralSegments: readonly ContinuousSupportCurveSegmentWitness[],
): Map<number, ContinuousSupportCurveSegmentWitness> | null {
  if (actionSegments.length === 0 || actionSegments.length !== neutralSegments.length) return null;
  const actionLineIds = new Set<number>();
  const actionIndexes = new Set<number>();
  const neutralLineIds = new Set<number>();
  const neutralIndexes = new Set<number>();
  const neutralByIndex = new Map<number, ContinuousSupportCurveSegmentWitness>();
  for (const segment of actionSegments) {
    if (!validCurveSegment(segment) || actionLineIds.has(segment.lineId) || actionIndexes.has(segment.segmentIndex)) return null;
    actionLineIds.add(segment.lineId);
    actionIndexes.add(segment.segmentIndex);
  }
  for (const segment of neutralSegments) {
    if (!validCurveSegment(segment) || neutralLineIds.has(segment.lineId) || neutralIndexes.has(segment.segmentIndex)) {
      return null;
    }
    neutralLineIds.add(segment.lineId);
    neutralIndexes.add(segment.segmentIndex);
    neutralByIndex.set(segment.segmentIndex, segment);
  }
  for (let index = 0; index < actionSegments.length; index++) {
    if (!actionIndexes.has(index) || !neutralIndexes.has(index)) return null;
  }
  return neutralByIndex;
}

function validCurveSegment(segment: ContinuousSupportCurveSegmentWitness): boolean {
  return segment !== null && typeof segment === "object" &&
    Number.isSafeInteger(segment.lineId) &&
    Number.isSafeInteger(segment.segmentIndex) && segment.segmentIndex >= 0 &&
    Number.isFinite(segment.tangentDeg);
}

function validCurveCollisionWitnesses(witnesses: readonly ContinuousSupportCurveCollisionWitness[]): boolean {
  return witnesses.every((witness) => witness !== null && typeof witness === "object" &&
    Number.isSafeInteger(witness.frame) && witness.frame >= 0 &&
    Number.isSafeInteger(witness.lineId) &&
    Array.isArray(witness.pointIds) && witness.pointIds.length > 0 &&
    new Set(witness.pointIds).size === witness.pointIds.length &&
    witness.pointIds.every((id) => typeof id === "string" && id.length > 0));
}

function noCausalExposure(
  reason: Exclude<ContinuousSupportCurveCausalExposure["reason"],
    "action_specific_curve_collision" |
    "physical_prefix_changed" |
    "capture_trace_changed_before_response" |
    "capture_event_changed" |
    "capture_impact_changed" |
    "trace_changed_before_first_support_collision" |
    "curve_line_ids_overlap_capture" |
    "curve_collision_at_or_before_H" |
    "insufficient_measurement_window_for_response_lag" |
    "invalid_causal_exposure_guards" |
    "invalid_curve_segment_correspondence" |
    "invalid_curve_collision_witness"
  >,
  eligibleCollisionWindow: ContinuousSupportCurveCausalExposure["eligibleCollisionWindow"] = null,
  firstEligibleCollisionFrame: number | null = null,
): ContinuousSupportCurveCausalExposure {
  return issueCausalExposure({
    actionSpecific: false,
    protocolInvalid: false,
    eligibleCollisionWindow,
    firstEligibleCollisionFrame,
    reason,
    causalHits: [],
  });
}

function invalidCausalExposure(
  reason: Extract<ContinuousSupportCurveCausalExposure["reason"],
    "physical_prefix_changed" |
    "capture_trace_changed_before_response" |
    "capture_event_changed" |
    "capture_impact_changed" |
    "trace_changed_before_first_support_collision" |
    "curve_line_ids_overlap_capture" |
    "curve_collision_at_or_before_H" |
    "insufficient_measurement_window_for_response_lag" |
    "invalid_causal_exposure_guards" |
    "invalid_curve_segment_correspondence" |
    "invalid_curve_collision_witness"
  >,
): ContinuousSupportCurveCausalExposure {
  return issueCausalExposure({
    actionSpecific: false,
    protocolInvalid: true,
    eligibleCollisionWindow: null,
    firstEligibleCollisionFrame: null,
    reason,
    causalHits: [],
  });
}

function issueCausalExposure(value: ContinuousSupportCurveCausalExposure): ContinuousSupportCurveCausalExposure {
  const issued = Object.freeze({
    ...value,
    eligibleCollisionWindow: value.eligibleCollisionWindow === null ? null : Object.freeze({ ...value.eligibleCollisionWindow }),
    causalHits: Object.freeze(value.causalHits.map((hit) => Object.freeze({ ...hit, pointIds: Object.freeze([...hit.pointIds]) }))),
  });
  ISSUED_CAUSAL_EXPOSURES.add(issued);
  return issued;
}

function validCausalExposureGuards(input: ContinuousSupportCurveCausalExposureInput): boolean {
  return input !== null && typeof input === "object" &&
    Number.isSafeInteger(input.supportStartFrame) && input.supportStartFrame >= 0 &&
    Number.isSafeInteger(input.measurementEndFrame) && input.measurementEndFrame >= 0 &&
    typeof input.constructionSafe === "boolean" &&
    typeof input.structurallyValid === "boolean" &&
    typeof input.physicalPrefixMatchesBaseline === "boolean" &&
    typeof input.captureTraceMatchesComparator === "boolean" &&
    typeof input.selectedCaptureEventMatchesComparator === "boolean" &&
    typeof input.impactMatchesComparator === "boolean" &&
    typeof input.traceMatchesBeforeFirstSupportCollision === "boolean" &&
    typeof input.curveLineIdsDisjointFromCapture === "boolean" &&
    Array.isArray(input.actionSegments) &&
    Array.isArray(input.neutralSegments) &&
    Array.isArray(input.curveCollisions);
}

function causalExposureGuardFailure(
  input: ContinuousSupportCurveCausalExposureInput,
): Extract<ContinuousSupportCurveCausalExposure["reason"],
  "physical_prefix_changed" |
  "capture_trace_changed_before_response" |
  "capture_event_changed" |
  "capture_impact_changed" |
  "trace_changed_before_first_support_collision" |
  "curve_line_ids_overlap_capture"
> | null {
  if (!input.physicalPrefixMatchesBaseline) return "physical_prefix_changed";
  if (!input.captureTraceMatchesComparator) return "capture_trace_changed_before_response";
  if (!input.selectedCaptureEventMatchesComparator) return "capture_event_changed";
  if (!input.impactMatchesComparator) return "capture_impact_changed";
  if (!input.traceMatchesBeforeFirstSupportCollision) return "trace_changed_before_first_support_collision";
  if (!input.curveLineIdsDisjointFromCapture) return "curve_line_ids_overlap_capture";
  return null;
}

function responseEligibleCollisionWindow(
  supportStartFrame: number,
  measurementEndFrame: number,
): { startFrame: number; endFrame: number } | null {
  const startFrame = supportStartFrame + 1;
  const endFrame = measurementEndFrame - CONTINUOUS_SUPPORT_CURVE_CAUSAL_EXPOSURE_PROTOCOL.minimumResponseLagFrames;
  return endFrame >= startFrame ? { startFrame, endFrame } : null;
}

function assertDeclaredCurvePhaseLeadSteps(value: number): asserts value is ContinuousSupportCurvePhaseLeadStep {
  if (!(CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS as readonly number[]).includes(value)) {
    throw new Error("continuous support curve phaseLeadSteps must match the declared construction ladder");
  }
}

function isDeclaredCurveActionId(value: unknown): value is ContinuousSupportCurveActionId {
  return typeof value === "string" && (CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER as readonly string[]).includes(value);
}

function compareDeclaredCurveActionId(left: ContinuousSupportCurveActionId, right: ContinuousSupportCurveActionId): number {
  return CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER.indexOf(left) - CONTINUOUS_SUPPORT_CURVE_ACTION_ORDER.indexOf(right);
}

function assertFrame(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative safe integer`);
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
}
