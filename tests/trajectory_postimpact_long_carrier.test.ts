import { describe, expect, test } from "vitest";
import {
  POSTIMPACT_LONG_CARRIER_SURFACE_PROTOCOL,
  realizePostimpactLongCarrier,
} from "../scripts/v0/trajectory/postimpact_long_carrier.ts";
import {
  POSTIMPACT_LONG_CARRIER_FRACTIONS,
  POSTIMPACT_LONG_CARRIER_PHASE_LEAD_STEPS,
  POSTIMPACT_LONG_CARRIER_PROTOCOL,
  certifyPostimpactLongCarrierPhase,
  firstCertifiedPostimpactLongCarrierPhase,
  postimpactLongCarrierDurationEndpointMatches,
  selectPostimpactLongCarrierPhase,
  planPostimpactLongCarrierDuration,
  type PostimpactLongCarrierConstructionProbe,
} from "../scripts/v0/trajectory/postimpact_long_carrier_protocol.ts";
import {
  constructPostimpactLongCarrierDurationRows,
  inspectPostimpactLongCarrierMeasurementRosterShape,
  resolvePostimpactLongCarrierSelectedPhase,
  validatePostimpactLongCarrierMeasurementRoster,
  type PostimpactLongCarrierConstructionArm,
  type PostimpactLongCarrierPendingCapture,
} from "../scripts/v0/trajectory/postimpact_long_carrier_construction.ts";
import { POSTIMPACT_CAPTURE_CLOSURE_PROTOCOL } from "../scripts/v0/trajectory/postimpact_capture_closure.ts";
import { makePostimpactNamedReferenceStep } from "../scripts/v0/trajectory/postimpact_support_orientation.ts";

const step = makePostimpactNamedReferenceStep({
  anchorPoint: "TAIL",
  fromFrame: 100,
  toFrame: 101,
  fromReference: { x: 10, y: 20 },
  toReference: { x: 20, y: 22 },
  exactCaptureOnlyTraceFingerprint: "capture-trace-H-H-plus-one",
});

function plan(phaseLeadSteps: 0 | 1 | 2 | 3 | 4 = 0) {
  return planPostimpactLongCarrierDuration({
    outgoingEndFrame: 160,
    namedReferenceStep: step,
    observedReferenceSpeedPxPerFrame: 10,
    phaseLeadSteps,
  });
}

function probes(overrides: Partial<PostimpactLongCarrierConstructionProbe> = {}) {
  return POSTIMPACT_LONG_CARRIER_FRACTIONS.map((supportFraction) => ({
    supportFraction,
    status: "observed" as const,
    constructionSafe: true,
    expectedCollisionRejection: false,
    protocolInvalid: false,
    reason: null,
    ...overrides,
  }));
}

describe("post-impact long carrier", () => {
  test("declares a fixed five-fraction, five-phase calibration stencil", () => {
    expect(POSTIMPACT_LONG_CARRIER_FRACTIONS).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(POSTIMPACT_LONG_CARRIER_PHASE_LEAD_STEPS).toEqual([0, 1, 2, 3, 4]);
    expect(POSTIMPACT_LONG_CARRIER_PROTOCOL.minimumAvailableCarrierIntervals).toBe(4);
    expect(POSTIMPACT_LONG_CARRIER_SURFACE_PROTOCOL).toEqual({
      lineType: 0,
      flipped: false,
      leftExtended: false,
      rightExtended: false,
      topology: "one_solid_directed_line.v1",
    });
    expect(POSTIMPACT_CAPTURE_CLOSURE_PROTOCOL.responseBoundary)
      .toBe("selected_owned_event_plus_impact_window_plus_one.v1");
  });

  test("plans linear duration controls and realizes one default-surface line", () => {
    const durationPlan = plan(2);
    expect(durationPlan).toMatchObject({
      status: "ready",
      phaseLeadSteps: 2,
      carrierStartFrame: 103,
      availableCarrierIntervals: 57,
    });
    if (durationPlan.status !== "ready") throw new Error("test plan unexpectedly unavailable");
    expect(durationPlan.controls).toEqual([
      { supportFraction: 0, extentPx: 0 },
      { supportFraction: 0.25, extentPx: 142.5 },
      { supportFraction: 0.5, extentPx: 285 },
      { supportFraction: 0.75, extentPx: 427.5 },
      { supportFraction: 1, extentPx: 570 },
    ]);
    const carrier = realizePostimpactLongCarrier({
      namedReferenceStep: step,
      phaseLeadSteps: 2,
      supportFraction: 0.5,
      extentPx: 285,
      lineIdStart: 77,
    });
    expect(carrier.carrierStart).toEqual({ x: 40, y: 26 });
    expect(carrier.direction.x).toBeCloseTo(10 / Math.hypot(10, 2), 12);
    expect(carrier.direction.y).toBeCloseTo(2 / Math.hypot(10, 2), 12);
    expect(carrier.lines).toHaveLength(1);
    expect(carrier.line).toMatchObject({
      id: 77,
      type: 0,
      x1: 40,
      y1: 26,
      flipped: false,
      leftExtended: false,
      rightExtended: false,
    });
    expect(Math.hypot(carrier.line!.x2 - carrier.line!.x1, carrier.line!.y2 - carrier.line!.y1)).toBeCloseTo(285, 10);
  });

  test("keeps the zero-fraction arm as exact capture-only geometry", () => {
    const carrier = realizePostimpactLongCarrier({
      namedReferenceStep: step,
      phaseLeadSteps: 0,
      supportFraction: 0,
      extentPx: 0,
      lineIdStart: 77,
    });
    expect(carrier.line).toBeNull();
    expect(carrier.lines).toEqual([]);
    expect(() => realizePostimpactLongCarrier({
      namedReferenceStep: step,
      phaseLeadSteps: 0,
      supportFraction: 0,
      extentPx: 1,
      lineIdStart: 77,
    })).toThrow(/zero fraction/);
  });

  test("requires a complete declared roster before selecting the earliest safe phase", () => {
    const phases = POSTIMPACT_LONG_CARRIER_PHASE_LEAD_STEPS.map((phase) =>
      certifyPostimpactLongCarrierPhase(plan(phase), probes()),
    );
    const phase0 = phases[0]!;
    expect(phase0.status).toBe("certified");
    expect(firstCertifiedPostimpactLongCarrierPhase([...phases].reverse())).toBe(phase0);
    expect(firstCertifiedPostimpactLongCarrierPhase(phases.slice(0, -1))).toBeNull();
    expect(firstCertifiedPostimpactLongCarrierPhase([...phases, phase0])).toBeNull();
    expect(firstCertifiedPostimpactLongCarrierPhase([structuredClone(phase0), ...phases.slice(1)])).toBeNull();
    expect(selectPostimpactLongCarrierPhase(phases.slice(0, -1))).toEqual({
      status: "invalid_roster",
      reason: "missing_phase",
    });
    expect(selectPostimpactLongCarrierPhase([...phases, phase0])).toEqual({
      status: "invalid_roster",
      reason: "duplicate_phase",
    });
    expect(selectPostimpactLongCarrierPhase([structuredClone(phase0), ...phases.slice(1)])).toEqual({
      status: "invalid_roster",
      reason: "unissued_certificate",
    });

    const rejected = certifyPostimpactLongCarrierPhase(plan(0), probes({
      constructionSafe: false,
      expectedCollisionRejection: true,
      reason: "support_collision_at_or_before_H",
    }));
    expect(rejected).toMatchObject({ status: "rejected", reason: "expected_construction_collision" });

    const missing = certifyPostimpactLongCarrierPhase(plan(0), probes().slice(1));
    expect(missing).toMatchObject({ status: "invalid", reason: "missing_declared_fraction" });
  });

  test("makes short available duration unavailable instead of emitting a degenerate rail", () => {
    const shortPlan = planPostimpactLongCarrierDuration({
      outgoingEndFrame: 104,
      namedReferenceStep: step,
      observedReferenceSpeedPxPerFrame: 10,
      phaseLeadSteps: 0,
    });
    expect(shortPlan).toEqual({
      status: "insufficient_duration",
      phaseLeadSteps: 0,
      carrierStartFrame: 101,
      availableCarrierIntervals: 3,
    });
    expect(certifyPostimpactLongCarrierPhase(shortPlan, [])).toMatchObject({
      status: "unavailable",
      reason: "insufficient_duration",
    });
  });

  test("requires measurement to reuse the exact scalar endpoint released to construction", () => {
    expect(postimpactLongCarrierDurationEndpointMatches(160, 160)).toBe(true);
    expect(postimpactLongCarrierDurationEndpointMatches(160, 161)).toBe(false);
    expect(() => postimpactLongCarrierDurationEndpointMatches(160, -1)).toThrow(/outgoing end frame/);
  });

  test("fails closed for an invalid capture handoff even if malformed input also carries pending state", () => {
    const rows = constructPostimpactLongCarrierDurationRows({
      rows: [{
        report: { maliciousPendingWasIgnored: true },
        pending: {} as any,
        protocolInvalid: true,
      }],
    }, { outgoingEndFrame: 160 });
    const row = rows.rows[0]!;
    expect(row.pending).toBeNull();
    expect(row.captureProtocolInvalid).toBe(true);
    expect(row.report).toMatchObject({
      carrierConstruction: { status: "capture_protocol_invalid", outgoingEndFrame: null },
    });
  });

  test("requires an issued selected handoff and structurally binds its exact five-arm roster", () => {
    const pending = sealedMeasurementPending();
    expect(validatePostimpactLongCarrierMeasurementRoster(pending)).toEqual({
      valid: false,
      reason: "selected_pending_not_issued",
    });
    expect(inspectPostimpactLongCarrierMeasurementRosterShape(pending)).toEqual({ valid: true, reason: null });

    const reordered = Object.freeze({
      ...pending,
      selectedPhase: Object.freeze({
        ...pending.selectedPhase,
        arms: Object.freeze([...pending.selectedPhase.arms].reverse()),
      }),
    }) as PostimpactLongCarrierPendingCapture;
    expect(inspectPostimpactLongCarrierMeasurementRosterShape(reordered)).toEqual({
      valid: false,
      reason: "selected_phase_fraction_roster_mismatch",
    });

    const endpointForged = Object.freeze({
      ...pending,
      outgoingEndFrame: pending.outgoingEndFrame + 1,
    }) as PostimpactLongCarrierPendingCapture;
    expect(inspectPostimpactLongCarrierMeasurementRosterShape(endpointForged)).toEqual({
      valid: false,
      reason: "selected_phase_plan_not_bound_to_pending_endpoint",
    });

    const changedArm = pending.selectedPhase.arms[1]!;
    const changedCarrier = changedArm.carrier;
    if (changedCarrier?.line === null || changedCarrier === null) throw new Error("test carrier unexpectedly absent");
    const shiftedLine = Object.freeze({ ...changedCarrier.line, x2: changedCarrier.line.x2 + 1000 });
    const shiftedCarrier = Object.freeze({ ...changedCarrier, line: shiftedLine, lines: Object.freeze([shiftedLine]) });
    const shiftedArms = Object.freeze(pending.selectedPhase.arms.map((arm) => arm === changedArm
      ? Object.freeze({ ...arm, carrier: shiftedCarrier })
      : arm));
    const shiftedGeometry = Object.freeze({
      ...pending,
      selectedPhase: Object.freeze({ ...pending.selectedPhase, arms: shiftedArms }),
    }) as PostimpactLongCarrierPendingCapture;
    expect(inspectPostimpactLongCarrierMeasurementRosterShape(shiftedGeometry)).toEqual({
      valid: false,
      reason: "selected_arm_carrier_geometry_mismatch",
    });
  });

  test("treats a selected certificate absent from the phase roster as construction-invalid", () => {
    const pending = sealedMeasurementPending();
    const otherCertificate = certifyPostimpactLongCarrierPhase(plan(1), probes());
    expect(resolvePostimpactLongCarrierSelectedPhase([pending.selectedPhase], {
      status: "selected",
      certificate: otherCertificate,
    })).toEqual({
      selectedPhase: null,
      selectedCertificateMissingFromPhaseRoster: true,
      constructionProtocolInvalid: true,
    });
  });
});

function sealedMeasurementPending(): PostimpactLongCarrierPendingCapture {
  const durationPlan = plan(0);
  if (durationPlan.status !== "ready") throw new Error("test plan unexpectedly unavailable");
  const certificate = certifyPostimpactLongCarrierPhase(durationPlan, probes());
  const arms = Object.freeze(durationPlan.controls.map((control): PostimpactLongCarrierConstructionArm => Object.freeze({
    supportFraction: control.supportFraction,
    status: "observed",
    constructionSafe: true,
    expectedCollisionRejection: false,
    protocolInvalid: false,
    reason: null,
    carrier: realizePostimpactLongCarrier({
      namedReferenceStep: step,
      phaseLeadSteps: durationPlan.phaseLeadSteps,
      supportFraction: control.supportFraction,
      extentPx: control.extentPx,
      lineIdStart: 77,
    }),
    carrierLineIdsDisjointFromCapture: true,
    carrierLineIdsUnique: true,
    preOrAtHCarrierCollisions: Object.freeze([]),
    firstCarrierCollisionFrame: null,
    traceMatchesBeforeFirstCarrierCollision: true,
    elapsedMs: 0,
  })));
  return Object.freeze({
    capture: {
      namedReferenceStep: step,
      namedReferenceAtH: { speedPxPerFrame: 10 },
      lastCaptureLineId: 76,
    } as any,
    outgoingEndFrame: 160,
    selectedPhase: Object.freeze({
      phaseLeadSteps: durationPlan.phaseLeadSteps,
      plan: durationPlan,
      certificate,
      arms,
    }),
  });
}
