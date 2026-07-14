import { describe, expect, test } from "vitest";
import {
  certifyContinuousSupportCurvePhase,
  classifyContinuousSupportCurveCausalExposure,
  classifyPostimpactConstructionProbe,
  CONTINUOUS_SUPPORT_CURVE_CAUSAL_EXPOSURE_PROTOCOL,
  CONTINUOUS_SUPPORT_CURVE_DIRECTIONAL_CONTRAST_PROTOCOL,
  firstCertifiedContinuousSupportCurvePhase,
  postimpactMeasurementHorizon,
  signedAngleDeltaDeg,
  summarizeContinuousSupportCurveMatchedNeutralContrast,
} from "../scripts/v0/trajectory/postimpact_support_assay.ts";
import {
  CONTINUOUS_SUPPORT_CURVE_ACTIONS,
  CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS,
} from "../scripts/v0/trajectory/continuous_support_curve.ts";

describe("post-impact support assay rules", () => {
  const stable = {
    physicalPrefixMatchesBaseline: true,
    captureOnlyPreHComplete: true,
    captureOnlyPreHTraceAvailable: true,
    captureTraceMatchesComparator: true,
    traceMatchesBeforeFirstSupportCollision: true,
    selectedCaptureEventMatchesComparator: true,
    impactMatchesComparator: true,
    survivesThroughH: true,
    preOrAtHSupportCollisionCount: 0,
  };

  function classifiedExposure(
    action: (typeof CONTINUOUS_SUPPORT_CURVE_ACTIONS)[number],
    kind: "endpoint" | "none" | "invalid",
  ) {
    const actionSpecific = kind === "endpoint";
    const neutralSegments = [{ lineId: 40, segmentIndex: 0, tangentDeg: 0 }];
    const actionSegments = [{ lineId: 40, segmentIndex: 0, tangentDeg: actionSpecific ? 1 : 0 }];
    return classifyContinuousSupportCurveCausalExposure({
      action,
      supportStartFrame: 108,
      constructionSafe: true,
      structurallyValid: true,
      physicalPrefixMatchesBaseline: true,
      captureTraceMatchesComparator: kind !== "invalid",
      selectedCaptureEventMatchesComparator: true,
      impactMatchesComparator: true,
      traceMatchesBeforeFirstSupportCollision: true,
      curveLineIdsDisjointFromCapture: true,
      measurementEndFrame: 120,
      actionSegments,
      neutralSegments,
      curveCollisions: actionSpecific ? [{ frame: 109, lineId: 40, pointIds: ["TAIL"] }] : [],
    });
  }

  test("treats a protected-boundary collision as ordinary rejection only after all comparator guards hold", () => {
    expect(classifyPostimpactConstructionProbe(stable)).toMatchObject({
      constructionSafe: true,
      expectedCollisionRejection: false,
      protocolInvalid: false,
    });
    expect(classifyPostimpactConstructionProbe({ ...stable, preOrAtHSupportCollisionCount: 1 })).toMatchObject({
      constructionSafe: false,
      expectedCollisionRejection: true,
      protocolInvalid: false,
    });
    expect(classifyPostimpactConstructionProbe({
      ...stable,
      preOrAtHSupportCollisionCount: 1,
      captureTraceMatchesComparator: false,
      selectedCaptureEventMatchesComparator: false,
    })).toMatchObject({
      expectedCollisionRejection: true,
      protocolInvalid: false,
    });
    expect(classifyPostimpactConstructionProbe({
      ...stable,
      preOrAtHSupportCollisionCount: 1,
      traceMatchesBeforeFirstSupportCollision: false,
    })).toMatchObject({
      expectedCollisionRejection: false,
      protocolInvalid: true,
      reason: "trace_changed_before_first_support_collision",
    });
  });

  test("keeps observation availability distinct from fixed construction extent", () => {
    expect(postimpactMeasurementHorizon(120, 108)).toEqual({
      status: "ready",
      measurementHorizonFrames: 12,
      measurementSamples: 13,
    });
    expect(postimpactMeasurementHorizon(110, 106)).toEqual({
      status: "ready",
      measurementHorizonFrames: 4,
      measurementSamples: 5,
    });
    expect(postimpactMeasurementHorizon(110, 107)).toEqual({
      status: "insufficient_measurement_horizon",
      availableIntervals: 3,
    });
  });

  test("certifies only a complete declared curve phase and preserves the source-declared phase order", () => {
    const sharedCaptureCertificate = {
      supportStartFrame: 108,
      captureOnlyCompleteThroughHPlusOne: true,
      captureOnlyTraceStartFrame: 0,
      captureOnlyTraceEndFrame: 109,
      exactCaptureOnlyTrace: {
        fingerprint: "capture-only-full-state-through-h-plus-1",
        frameCount: 110,
        unavailableAtFrame: null,
        semantics: "full_non_scarf_engine_state_v1" as const,
      },
      namedReferenceStep: {
        anchorPoint: "rider" as const,
        fromFrame: 108,
        toFrame: 109,
        exactCaptureOnlyTraceFingerprint: "capture-only-full-state-through-h-plus-1",
      },
    };
    const safe = CONTINUOUS_SUPPORT_CURVE_ACTIONS.map((action) => ({
      action,
      status: "observed" as const,
      constructionSafe: true,
      expectedCollisionRejection: false,
      protocolInvalid: false,
    }));
    const certified = certifyContinuousSupportCurvePhase(0, safe, sharedCaptureCertificate);
    expect(certified).toMatchObject({
      phaseLeadSteps: 0,
      status: "certified",
      sharedConstructionSafe: true,
      invalidProbeActions: 0,
      sharedCaptureCertificate: {
        supportStartFrame: 108,
        captureOnlyTraceStartFrame: 0,
        captureOnlyTraceEndFrame: 109,
      },
    });
    expect(certified.actions.map((action) => action.actionId))
      .toEqual(CONTINUOUS_SUPPORT_CURVE_ACTIONS.map((action) => action.id));
    expect(Object.isFrozen(certified)).toBe(true);
    expect(Object.isFrozen(certified.actions)).toBe(true);

    const rejected = certifyContinuousSupportCurvePhase(1, safe.map((probe) =>
      probe.action.id === "curve-turn-positive-8"
        ? { ...probe, constructionSafe: false, expectedCollisionRejection: true }
        : probe,
    ), sharedCaptureCertificate);
    expect(rejected).toMatchObject({
      status: "rejected",
      sharedConstructionSafe: false,
      rejectedActionIds: ["curve-turn-positive-8"],
      invalidProbeActions: 0,
    });

    const invalid = certifyContinuousSupportCurvePhase(2, safe.map((probe) =>
      probe.action.id === "curve-neutral" ? { ...probe, protocolInvalid: true } : probe,
    ), sharedCaptureCertificate);
    expect(invalid).toMatchObject({
      status: "invalid",
      invalidActionIds: ["curve-neutral"],
      reason: "invalid_construction_probe",
    });
    expect(certifyContinuousSupportCurvePhase(3, [...safe, safe[0]!], sharedCaptureCertificate)).toMatchObject({
      status: "invalid",
      reason: "duplicate_action_id",
    });
    expect(certifyContinuousSupportCurvePhase(4, safe, {
      ...sharedCaptureCertificate,
      namedReferenceStep: {
        ...sharedCaptureCertificate.namedReferenceStep,
        toFrame: 110,
      },
    })).toMatchObject({
      status: "invalid",
      sharedCaptureCertificate: null,
      reason: "invalid_shared_capture_certificate",
    });
    expect(certifyContinuousSupportCurvePhase(4, safe, {
      ...sharedCaptureCertificate,
      namedReferenceStep: {
        ...sharedCaptureCertificate.namedReferenceStep,
        exactCaptureOnlyTraceFingerprint: "different-capture-trace",
      },
    })).toMatchObject({
      status: "invalid",
      sharedCaptureCertificate: null,
      reason: "invalid_shared_capture_certificate",
    });

    const phaseCertificates = CONTINUOUS_SUPPORT_CURVE_PHASE_LEAD_STEPS.map((phaseLeadSteps) =>
      certifyContinuousSupportCurvePhase(phaseLeadSteps, phaseLeadSteps === 1 ? safe : safe.map((probe) => ({
        ...probe,
        constructionSafe: false,
        expectedCollisionRejection: true,
      })), sharedCaptureCertificate),
    );
    expect(firstCertifiedContinuousSupportCurvePhase(phaseCertificates)?.phaseLeadSteps).toBe(1);
    expect(() => firstCertifiedContinuousSupportCurvePhase([...phaseCertificates].reverse())).toThrow(/declared ladder order/);
    expect(() => firstCertifiedContinuousSupportCurvePhase(phaseCertificates.map((phase) =>
      phase.phaseLeadSteps === 1 ? { ...phase, sharedConstructionSafe: false } : phase,
    ))).toThrow(/internally inconsistent/);

    const invalidThenRejectedThenCertified = [
      certifyContinuousSupportCurvePhase(0, safe.map((probe) =>
        probe.action.id === "curve-neutral" ? { ...probe, protocolInvalid: true } : probe,
      ), sharedCaptureCertificate),
      rejected,
      certifyContinuousSupportCurvePhase(2, safe, sharedCaptureCertificate),
      certifyContinuousSupportCurvePhase(3, safe.map((probe) => ({
        ...probe,
        constructionSafe: false,
        expectedCollisionRejection: true,
      })), sharedCaptureCertificate),
      certifyContinuousSupportCurvePhase(4, safe.map((probe) => ({
        ...probe,
        constructionSafe: false,
        expectedCollisionRejection: true,
      })), sharedCaptureCertificate),
    ];
    expect(firstCertifiedContinuousSupportCurvePhase(invalidThenRejectedThenCertified)?.phaseLeadSteps).toBe(2);
    expect(() => firstCertifiedContinuousSupportCurvePhase(invalidThenRejectedThenCertified.map((phase) =>
      phase.phaseLeadSteps === 1 ? { ...phase, actions: [] } : phase,
    ))).toThrow(/internally inconsistent/);
  });

  test("uses a fixed, context-matched neutral contrast rather than anonymous capture-only deltas", () => {
    expect(signedAngleDeltaDeg(-175, 175)).toBe(-10);
    const context = {
      phaseLeadSteps: 2 as const,
      measurementStartFrame: 108,
      measurementEndFrame: 120,
      captureComparatorFingerprint: "capture-only-h108-q12",
    };
    const terminalHeadingById = {
      "curve-turn-negative-8": -4,
      "curve-turn-negative-4": -2,
      "curve-neutral": 0,
      "curve-turn-positive-4": 2,
      "curve-turn-positive-8": 4,
    } as const;
    const arms = CONTINUOUS_SUPPORT_CURVE_ACTIONS.map((action) => ({
      action,
      structurallyValid: true,
      terminalHeadingDeg: terminalHeadingById[action.id],
      matchedNeutralContext: context,
      causalExposure: classifiedExposure(
        action,
        action.id === "curve-turn-negative-8" || action.id === "curve-turn-positive-8" ? "endpoint" : "none",
      ),
    }));
    const contrast = summarizeContinuousSupportCurveMatchedNeutralContrast(arms);
    expect(contrast).toMatchObject({
      available: true,
      protocolInvalid: false,
      monotone: true,
      endpointContrastDeg: 8,
      meetsMinimumContrast: true,
      endpointActionSpecificExposure: { negative: true, positive: true },
    });
    expect(contrast.effectsFromNeutralDeg).toEqual([
      { actionId: "curve-turn-negative-8", headingDeltaFromNeutralDeg: -4 },
      { actionId: "curve-turn-negative-4", headingDeltaFromNeutralDeg: -2 },
      { actionId: "curve-neutral", headingDeltaFromNeutralDeg: 0 },
      { actionId: "curve-turn-positive-4", headingDeltaFromNeutralDeg: 2 },
      { actionId: "curve-turn-positive-8", headingDeltaFromNeutralDeg: 4 },
    ]);
    expect(CONTINUOUS_SUPPORT_CURVE_DIRECTIONAL_CONTRAST_PROTOCOL.minimumEndpointContrastDeg).toBe(2);

    const unmatched = summarizeContinuousSupportCurveMatchedNeutralContrast(arms.map((arm) =>
      arm.action.id === "curve-turn-positive-8"
        ? { ...arm, matchedNeutralContext: { ...context, measurementEndFrame: 121 } }
        : arm,
    ));
    expect(unmatched).toMatchObject({ available: false, protocolInvalid: true, reason: "unmatched_neutral_context" });

    const unexposed = summarizeContinuousSupportCurveMatchedNeutralContrast(arms.map((arm) =>
      arm.action.id === "curve-turn-positive-8"
        ? {
          ...arm,
          causalExposure: classifiedExposure(arm.action, "none"),
        }
        : arm,
    ));
    expect(unexposed).toMatchObject({
      available: false,
      protocolInvalid: false,
      reason: "endpoint_action_specific_exposure_unavailable",
      endpointContrastDeg: 8,
    });
    const invalidExposure = summarizeContinuousSupportCurveMatchedNeutralContrast(arms.map((arm) =>
      arm.action.id === "curve-turn-positive-8"
        ? {
          ...arm,
          causalExposure: classifiedExposure(arm.action, "invalid"),
        }
        : arm,
    ));
    expect(invalidExposure).toMatchObject({
      available: false,
      protocolInvalid: true,
      reason: "causal_exposure_protocol_invalid",
    });

    const forgedExposure = summarizeContinuousSupportCurveMatchedNeutralContrast(arms.map((arm) =>
      arm.action.id === "curve-turn-positive-8"
        ? {
          ...arm,
          causalExposure: {
            actionSpecific: true,
            protocolInvalid: false,
            eligibleCollisionWindow: { startFrame: 109, endFrame: 118 },
            firstEligibleCollisionFrame: 109,
            reason: "action_specific_curve_collision" as const,
            causalHits: [{
              frame: 109,
              lineId: 40,
              pointIds: ["TAIL"],
              segmentIndex: 0,
              tangentDeltaFromNeutralDeg: 1,
            }],
          },
        }
        : arm,
    ));
    expect(forgedExposure).toMatchObject({
      available: false,
      protocolInvalid: true,
      reason: "causal_exposure_protocol_invalid",
    });
  });

  test("requires the first eligible post-H all-body collision on geometry that differs from neutral", () => {
    const neutralSegments = [0, 1, 2, 3].map((segmentIndex) => ({
      lineId: 40 + segmentIndex,
      segmentIndex,
      tangentDeg: 0,
    }));
    const actionSegments = [1, 3, 5, 7].map((tangentDeg, segmentIndex) => ({
      lineId: 40 + segmentIndex,
      segmentIndex,
      tangentDeg,
    }));
    const input = {
      action: CONTINUOUS_SUPPORT_CURVE_ACTIONS.find((action) => action.id === "curve-turn-positive-8")!,
      supportStartFrame: 100,
      constructionSafe: true,
      structurallyValid: true,
      physicalPrefixMatchesBaseline: true,
      captureTraceMatchesComparator: true,
      selectedCaptureEventMatchesComparator: true,
      impactMatchesComparator: true,
      traceMatchesBeforeFirstSupportCollision: true,
      curveLineIdsDisjointFromCapture: true,
      measurementEndFrame: 108,
      actionSegments,
      neutralSegments,
      curveCollisions: [{ frame: 101, lineId: 40, pointIds: ["TAIL"] }],
    };
    expect(classifyContinuousSupportCurveCausalExposure(input)).toMatchObject({
      actionSpecific: true,
      protocolInvalid: false,
      eligibleCollisionWindow: { startFrame: 101, endFrame: 106 },
      firstEligibleCollisionFrame: 101,
      reason: "action_specific_curve_collision",
      causalHits: [{
        frame: 101,
        lineId: 40,
        pointIds: ["TAIL"],
        segmentIndex: 0,
        tangentDeltaFromNeutralDeg: 1,
      }],
    });
    expect(classifyContinuousSupportCurveCausalExposure({
      ...input,
      curveCollisions: [{ frame: 100, lineId: 40, pointIds: ["TAIL"] }],
    })).toMatchObject({ actionSpecific: false, protocolInvalid: true, reason: "curve_collision_at_or_before_H" });
    expect(classifyContinuousSupportCurveCausalExposure({
      ...input,
      actionSegments: neutralSegments,
    })).toMatchObject({ actionSpecific: false, reason: "first_curve_collision_only_neutral_equivalent_segments" });
    expect(classifyContinuousSupportCurveCausalExposure({
      ...input,
      curveCollisions: [{ frame: 101, lineId: 999, pointIds: ["TAIL"] }],
    })).toMatchObject({ actionSpecific: false, protocolInvalid: true, reason: "invalid_curve_collision_witness" });
    expect(classifyContinuousSupportCurveCausalExposure({
      ...input,
      action: CONTINUOUS_SUPPORT_CURVE_ACTIONS.find((action) => action.id === "curve-neutral")!,
    })).toMatchObject({ actionSpecific: false, protocolInvalid: false, reason: "neutral_action" });
    expect(classifyContinuousSupportCurveCausalExposure({
      ...input,
      curveCollisions: [{ frame: 107, lineId: 40, pointIds: ["TAIL"] }],
    })).toMatchObject({
      actionSpecific: false,
      protocolInvalid: false,
      eligibleCollisionWindow: { startFrame: 101, endFrame: 106 },
      firstEligibleCollisionFrame: null,
      reason: "no_curve_collision_with_required_response_lag",
    });
    expect(classifyContinuousSupportCurveCausalExposure({
      ...input,
      actionSegments: actionSegments.map((segment) => segment.lineId === 41 ? { ...segment, tangentDeg: 0 } : segment),
      curveCollisions: [
        { frame: 101, lineId: 41, pointIds: ["TAIL"] },
        { frame: 102, lineId: 40, pointIds: ["TAIL"] },
      ],
    })).toMatchObject({
      actionSpecific: false,
      protocolInvalid: false,
      firstEligibleCollisionFrame: 101,
      reason: "first_curve_collision_only_neutral_equivalent_segments",
    });
    expect(classifyContinuousSupportCurveCausalExposure({
      ...input,
      traceMatchesBeforeFirstSupportCollision: false,
    })).toMatchObject({ actionSpecific: false, protocolInvalid: true, reason: "trace_changed_before_first_support_collision" });
    expect(classifyContinuousSupportCurveCausalExposure({
      ...input,
      curveLineIdsDisjointFromCapture: false,
    })).toMatchObject({ actionSpecific: false, protocolInvalid: true, reason: "curve_line_ids_overlap_capture" });
    for (const [field, reason] of [
      ["physicalPrefixMatchesBaseline", "physical_prefix_changed"],
      ["captureTraceMatchesComparator", "capture_trace_changed_before_response"],
      ["selectedCaptureEventMatchesComparator", "capture_event_changed"],
      ["impactMatchesComparator", "capture_impact_changed"],
    ] as const) {
      expect(classifyContinuousSupportCurveCausalExposure({ ...input, [field]: false })).toMatchObject({
        actionSpecific: false,
        protocolInvalid: true,
        reason,
      });
    }
    expect(classifyContinuousSupportCurveCausalExposure({
      ...input,
      measurementEndFrame: 102,
    })).toMatchObject({
      actionSpecific: false,
      protocolInvalid: true,
      reason: "insufficient_measurement_window_for_response_lag",
    });
    expect(CONTINUOUS_SUPPORT_CURVE_CAUSAL_EXPOSURE_PROTOCOL.minimumResponseLagFrames).toBe(2);
  });
});
