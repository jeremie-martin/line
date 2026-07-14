/**
 * Duration-aware, axis-blind construction for the long-carrier assay.
 *
 * Stage one supplies an already-closed target-blind capture. This module sees
 * only that closure plus the scalar outgoing end frame. It constructs every
 * fraction in every declared phase and selects the earliest all-arm phase
 * before full outgoing observation is released.
 */
import {
  classifyPostimpactConstructionProbe,
  type PostimpactConstructionProbeVerdict,
} from "./postimpact_construction_probe.ts";
import { postimpactLineIdRange } from "./postimpact_construction_context.ts";
import {
  observePostimpactCapture,
  postimpactAllBodyCollisions,
  postimpactFirstCollisionFrame,
  postimpactTrace,
} from "./postimpact_capture_closure.ts";
import type {
  PostimpactLongCarrierCaptureRows,
  PostimpactLongCarrierDurationCapture,
} from "./postimpact_long_carrier_capture.ts";
import { postimpactMeasurementLastFrame } from "./postimpact_detection_measurement.ts";
import { detectPostimpactWindow } from "./postimpact_detector.ts";
import {
  realizePostimpactLongCarrier,
  type PostimpactLongCarrier,
} from "./postimpact_long_carrier.ts";
import {
  POSTIMPACT_LONG_CARRIER_FRACTIONS,
  POSTIMPACT_LONG_CARRIER_PHASE_LEAD_STEPS,
  certifyPostimpactLongCarrierPhase,
  isIssuedPostimpactLongCarrierPhaseCertificate,
  selectPostimpactLongCarrierPhase,
  planPostimpactLongCarrierDuration,
  type PostimpactLongCarrierConstructionProbe,
  type PostimpactLongCarrierDurationPlan,
  type PostimpactLongCarrierFraction,
  type PostimpactLongCarrierPhaseCertificate,
  type PostimpactLongCarrierPhaseLeadSteps,
} from "./postimpact_long_carrier_protocol.ts";
import {
  samePostimpactExactEngineTrace,
  samePostimpactOwnedCaptureEvent,
} from "./postimpact_observation.ts";
import { survivesPostimpactThroughFrame } from "./postimpact_trace.ts";

export const POSTIMPACT_LONG_CARRIER_CONSTRUCTION_PROTOCOL = Object.freeze({
  constructionInput: "closed_capture_plus_scalar_outgoing_end_frame_only.v1",
  phaseSelection: "first_certified_declared_phase_all_five_fractions.v1",
  protectedBoundary: "physical_prefix_and_capture_identity_through_H.v1",
} as const);

// Only this module can issue a selected construction handoff. Structural
// cloning is intentionally insufficient: it could substitute a coherent but
// different capture/plan/geometry trio after phase certification.
const ISSUED_LONG_CARRIER_PENDING_CAPTURES = new WeakSet<object>();

export type PostimpactLongCarrierConstructionRows = {
  rows: readonly PostimpactLongCarrierConstructionRow[];
};

export type PostimpactLongCarrierConstructionRow = {
  report: Record<string, unknown>;
  pending: PostimpactLongCarrierPendingCapture | null;
  captureProtocolInvalid: boolean;
  constructionProtocolInvalid: boolean;
  /** Typed validity never depends on the human-readable report shape. */
  constructionInvalidPhaseCount: number;
  constructionReportMatchesTypedState: boolean;
};

export type PostimpactLongCarrierPendingCapture = Readonly<{
  capture: PostimpactLongCarrierDurationCapture;
  outgoingEndFrame: number;
  selectedPhase: PostimpactLongCarrierConstructionPhaseRecord;
}>;

export type PostimpactLongCarrierConstructionPhaseRecord = Readonly<{
  phaseLeadSteps: PostimpactLongCarrierPhaseLeadSteps;
  plan: PostimpactLongCarrierDurationPlan;
  certificate: PostimpactLongCarrierPhaseCertificate;
  arms: readonly PostimpactLongCarrierConstructionArm[];
}>;

export type PostimpactLongCarrierCollisionWitness = Readonly<{
  frame: number;
  lineId: number;
  pointIds: readonly string[];
}>;

export type PostimpactLongCarrierConstructionArm = Readonly<PostimpactLongCarrierConstructionProbe & {
  carrier: PostimpactLongCarrier | null;
  carrierLineIdsDisjointFromCapture: boolean;
  carrierLineIdsUnique: boolean;
  preOrAtHCarrierCollisions: readonly PostimpactLongCarrierCollisionWitness[];
  firstCarrierCollisionFrame: number | null;
  traceMatchesBeforeFirstCarrierCollision: boolean;
  elapsedMs: number;
}>;

/**
 * Build all phase/fraction construction probes after the staged boundary has
 * released only the outgoing endpoint. It deliberately accepts a structural
 * endpoint object rather than importing the fixture/input parser.
 */
export function constructPostimpactLongCarrierDurationRows(
  captures: PostimpactLongCarrierCaptureRows,
  availability: Readonly<{ outgoingEndFrame: number }>,
): PostimpactLongCarrierConstructionRows {
  return Object.freeze({
    rows: Object.freeze(captures.rows.map((row) => constructRow(row, availability.outgoingEndFrame))),
  });
}

function constructRow(
  row: PostimpactLongCarrierCaptureRows["rows"][number],
  outgoingEndFrame: number,
): PostimpactLongCarrierConstructionRow {
  // A malformed handoff that carries both a pending capture and an invalid
  // status must not be rehabilitated merely because it is structurally usable.
  if (row.protocolInvalid) {
    return unavailableConstructionRow(row, "capture_protocol_invalid", true);
  }
  if (row.pending === null) {
    return unavailableConstructionRow(row, "capture_unavailable", false);
  }
  const capture = row.pending;
  const phases = Object.freeze(POSTIMPACT_LONG_CARRIER_PHASE_LEAD_STEPS.map((phaseLeadSteps) =>
    constructPhase(capture, outgoingEndFrame, phaseLeadSteps),
  ));
  const selection = selectPostimpactLongCarrierPhase(phases.map((phase) => phase.certificate));
  const selectionResolution = resolvePostimpactLongCarrierSelectedPhase(phases, selection);
  const { selectedPhase, selectedCertificateMissingFromPhaseRoster, constructionProtocolInvalid } = selectionResolution;
  const reportedSelection = summarizeSelection(selection, selectedCertificateMissingFromPhaseRoster);
  const report = {
    ...row.report,
    carrierConstruction: {
      status: constructionProtocolInvalid ? "construction_protocol_invalid" : selectedPhase === null ? "no_certified_phase" : "closed",
      outgoingEndFrame,
      phases: phases.map(summarizePhase),
      selectedPhaseLeadSteps: selectedPhase?.phaseLeadSteps ?? null,
      selectedCertificate: selectedPhase === null ? null : summarizeCertificate(selectedPhase.certificate),
      selection: reportedSelection,
    },
  };
  const constructionInvalidPhaseCount = phases.filter((phase) => phase.certificate.status === "invalid").length;
  const constructionReportMatchesTypedState = reportMatchesTypedConstructionState(
    report,
    phases,
    outgoingEndFrame,
    selectedPhase?.phaseLeadSteps ?? null,
    selectedPhase?.certificate ?? null,
    selection,
    constructionProtocolInvalid,
    selectedCertificateMissingFromPhaseRoster,
  );
  if (selectedPhase === null) {
    return {
      report,
      pending: null,
      captureProtocolInvalid: false,
      constructionProtocolInvalid,
      constructionInvalidPhaseCount,
      constructionReportMatchesTypedState,
    };
  }
  return {
    report,
    pending: issuePostimpactLongCarrierPendingCapture({ capture, outgoingEndFrame, selectedPhase }),
    captureProtocolInvalid: false,
    constructionProtocolInvalid,
    constructionInvalidPhaseCount,
    constructionReportMatchesTypedState,
  };
}

function issuePostimpactLongCarrierPendingCapture(
  pending: {
    capture: PostimpactLongCarrierDurationCapture;
    outgoingEndFrame: number;
    selectedPhase: PostimpactLongCarrierConstructionPhaseRecord;
  },
): PostimpactLongCarrierPendingCapture {
  const sealed = Object.freeze({ ...pending });
  ISSUED_LONG_CARRIER_PENDING_CAPTURES.add(sealed);
  return sealed;
}

export type PostimpactLongCarrierPhaseSelectionResolution = Readonly<{
  selectedPhase: PostimpactLongCarrierConstructionPhaseRecord | null;
  selectedCertificateMissingFromPhaseRoster: boolean;
  constructionProtocolInvalid: boolean;
}>;

/** Bind a selected certificate to its exact sealed phase record by identity. */
export function resolvePostimpactLongCarrierSelectedPhase(
  phases: readonly PostimpactLongCarrierConstructionPhaseRecord[],
  selection: ReturnType<typeof selectPostimpactLongCarrierPhase>,
): PostimpactLongCarrierPhaseSelectionResolution {
  const selectedPhase = selection.status !== "selected"
    ? null
    : phases.find((phase) => phase.certificate === selection.certificate) ?? null;
  const selectedCertificateMissingFromPhaseRoster = selection.status === "selected" && selectedPhase === null;
  return Object.freeze({
    selectedPhase,
    selectedCertificateMissingFromPhaseRoster,
    constructionProtocolInvalid: selection.status === "invalid_roster" || selectedCertificateMissingFromPhaseRoster,
  });
}

function unavailableConstructionRow(
  row: PostimpactLongCarrierCaptureRows["rows"][number],
  status: "capture_protocol_invalid" | "capture_unavailable",
  captureProtocolInvalid: boolean,
): PostimpactLongCarrierConstructionRow {
  return {
    report: {
      ...row.report,
      carrierConstruction: {
        status,
        outgoingEndFrame: null,
        phases: [],
        selectedPhaseLeadSteps: null,
        selectedCertificate: null,
        selection: { status: "not_run", reason: status },
      },
    },
    pending: null,
    captureProtocolInvalid,
    constructionProtocolInvalid: false,
    constructionInvalidPhaseCount: 0,
    constructionReportMatchesTypedState: true,
  };
}

function reportMatchesTypedConstructionState(
  report: Record<string, unknown>,
  phases: readonly PostimpactLongCarrierConstructionPhaseRecord[],
  outgoingEndFrame: number,
  selectedPhaseLeadSteps: number | null,
  selectedCertificate: PostimpactLongCarrierPhaseCertificate | null,
  selection: ReturnType<typeof selectPostimpactLongCarrierPhase>,
  constructionProtocolInvalid: boolean,
  selectedCertificateMissingFromPhaseRoster: boolean,
): boolean {
  const construction = report.carrierConstruction;
  if (construction === null || typeof construction !== "object" || Array.isArray(construction)) return false;
  const record = construction as Record<string, unknown>;
  const expectedStatus = constructionProtocolInvalid
    ? "construction_protocol_invalid"
    : selectedPhaseLeadSteps === null ? "no_certified_phase" : "closed";
  const expected = {
    status: expectedStatus,
    outgoingEndFrame,
    phases: phases.map(summarizePhase),
    selectedPhaseLeadSteps,
    selectedCertificate: selectedCertificate === null ? null : summarizeCertificate(selectedCertificate),
    selection: summarizeSelection(selection, selectedCertificateMissingFromPhaseRoster),
  };
  return sameReportValue(record, expected);
}

/** Exact structural reconciliation for the human-review construction report. */
function sameReportValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((value, index) => sameReportValue(value, right[index]));
  }
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && sameReportValue(leftRecord[key], rightRecord[key])
  );
}
function summarizeSelection(
  selection: ReturnType<typeof selectPostimpactLongCarrierPhase>,
  selectedCertificateMissingFromPhaseRoster: boolean,
) {
  if (selection.status === "invalid_roster") {
    return { status: selection.status, reason: selection.reason };
  }
  if (selection.status === "selected") {
    return selectedCertificateMissingFromPhaseRoster
      ? {
        status: selection.status,
        reason: "selected_certificate_not_in_phase_roster",
        certificate: summarizeCertificate(selection.certificate),
      }
      : { status: selection.status, certificate: summarizeCertificate(selection.certificate) };
  }
  return { status: selection.status };
}

function summarizeCertificate(certificate: PostimpactLongCarrierPhaseCertificate) {
  return {
    phaseLeadSteps: certificate.phaseLeadSteps,
    availableCarrierIntervals: certificate.availableCarrierIntervals,
    status: certificate.status,
    reason: certificate.reason,
    probes: certificate.probes.map((probe) => ({
      supportFraction: probe.supportFraction,
      status: probe.status,
      constructionSafe: probe.constructionSafe,
      expectedCollisionRejection: probe.expectedCollisionRejection,
      protocolInvalid: probe.protocolInvalid,
      reason: probe.reason,
    })),
  };
}

function constructPhase(
  capture: PostimpactLongCarrierDurationCapture,
  outgoingEndFrame: number,
  phaseLeadSteps: PostimpactLongCarrierPhaseLeadSteps,
): PostimpactLongCarrierConstructionPhaseRecord {
  const plan = planPostimpactLongCarrierDuration({
    outgoingEndFrame,
    namedReferenceStep: capture.namedReferenceStep,
    observedReferenceSpeedPxPerFrame: capture.namedReferenceAtH.speedPxPerFrame,
    phaseLeadSteps,
  });
  const arms = plan.status === "ready"
    ? plan.controls.map((control) => constructArm(capture, plan, control.supportFraction, control.extentPx))
    : [];
  const certificate = certifyPostimpactLongCarrierPhase(plan, arms.map((arm) => ({
    supportFraction: arm.supportFraction,
    status: arm.status,
    constructionSafe: arm.constructionSafe,
    expectedCollisionRejection: arm.expectedCollisionRejection,
    protocolInvalid: arm.protocolInvalid,
    reason: arm.reason,
  })));
  return freezeConstructionPhase({ phaseLeadSteps, plan, certificate, arms });
}

function freezeConstructionPhase(input: {
  phaseLeadSteps: PostimpactLongCarrierPhaseLeadSteps;
  plan: PostimpactLongCarrierDurationPlan;
  certificate: PostimpactLongCarrierPhaseCertificate;
  arms: readonly PostimpactLongCarrierConstructionArm[];
}): PostimpactLongCarrierConstructionPhaseRecord {
  const plan = freezeDurationPlan(input.plan);
  const arms = Object.freeze(input.arms.map(freezeConstructionArm));
  return Object.freeze({
    phaseLeadSteps: input.phaseLeadSteps,
    plan,
    certificate: input.certificate,
    arms,
  });
}

function freezeDurationPlan(plan: PostimpactLongCarrierDurationPlan): PostimpactLongCarrierDurationPlan {
  if (plan.status === "insufficient_duration") return Object.freeze({ ...plan });
  return Object.freeze({
    ...plan,
    controls: Object.freeze(plan.controls.map((control) => Object.freeze({ ...control }))),
  });
}

function freezeConstructionArm(arm: PostimpactLongCarrierConstructionArm): PostimpactLongCarrierConstructionArm {
  return Object.freeze({
    ...arm,
    preOrAtHCarrierCollisions: Object.freeze(arm.preOrAtHCarrierCollisions.map((collision) => Object.freeze({
      ...collision,
      pointIds: Object.freeze([...collision.pointIds]),
    }))),
  });
}

export type PostimpactLongCarrierMeasurementRosterValidation =
  | { valid: true; reason: null }
  | { valid: false; reason: string };

/**
 * Recheck the sealed selected phase immediately before post-selection replay.
 * This is intentionally redundant with construction: a later mutable or
 * malformed handoff must not convert a five-arm calibration claim into a
 * convenient subset measurement.
 */
export function validatePostimpactLongCarrierMeasurementRoster(
  pending: PostimpactLongCarrierPendingCapture,
): PostimpactLongCarrierMeasurementRosterValidation {
  if (!ISSUED_LONG_CARRIER_PENDING_CAPTURES.has(pending)) {
    return invalidMeasurementRoster("selected_pending_not_issued");
  }
  return inspectPostimpactLongCarrierMeasurementRosterShape(pending);
}

/**
 * Structural diagnostic used by the issued validator and targeted tests. It
 * deliberately does not authorize measurement: only the validator above also
 * proves that this exact handoff was issued by construction.
 */
export function inspectPostimpactLongCarrierMeasurementRosterShape(
  pending: PostimpactLongCarrierPendingCapture,
): PostimpactLongCarrierMeasurementRosterValidation {
  try {
    if (!Object.isFrozen(pending)) return invalidMeasurementRoster("pending_capture_not_frozen");
    if (!Number.isSafeInteger(pending.outgoingEndFrame) || pending.outgoingEndFrame < 0) {
      return invalidMeasurementRoster("invalid_outgoing_end_frame");
    }
    const phase = pending.selectedPhase;
    if (!Object.isFrozen(phase) || !Object.isFrozen(phase.arms) || !Object.isFrozen(phase.plan) ||
        !Object.isFrozen(phase.certificate) || !isIssuedPostimpactLongCarrierPhaseCertificate(phase.certificate)) {
      return invalidMeasurementRoster("selected_phase_not_sealed");
    }
    if (phase.certificate.status !== "certified") return invalidMeasurementRoster("selected_certificate_not_certified");
    if (phase.phaseLeadSteps !== phase.certificate.phaseLeadSteps || phase.plan.phaseLeadSteps !== phase.phaseLeadSteps ||
        phase.plan.status !== "ready" || phase.plan.availableCarrierIntervals !== phase.certificate.availableCarrierIntervals) {
      return invalidMeasurementRoster("selected_phase_certificate_or_plan_mismatch");
    }
    const expectedPlan = planPostimpactLongCarrierDuration({
      outgoingEndFrame: pending.outgoingEndFrame,
      namedReferenceStep: pending.capture.namedReferenceStep,
      observedReferenceSpeedPxPerFrame: pending.capture.namedReferenceAtH.speedPxPerFrame,
      phaseLeadSteps: phase.phaseLeadSteps,
    });
    if (expectedPlan.status !== "ready" || !sameReadyDurationPlan(phase.plan, expectedPlan)) {
      return invalidMeasurementRoster("selected_phase_plan_not_bound_to_pending_endpoint");
    }
    if (!hasExactFractionRoster(phase.plan.controls) || !hasExactFractionRoster(phase.arms) ||
        !hasExactFractionRoster(phase.certificate.probes)) {
      return invalidMeasurementRoster("selected_phase_fraction_roster_mismatch");
    }
    for (let index = 0; index < POSTIMPACT_LONG_CARRIER_FRACTIONS.length; index++) {
      const fraction = POSTIMPACT_LONG_CARRIER_FRACTIONS[index]!;
      const control = phase.plan.controls[index]!;
      const arm = phase.arms[index]!;
      const probe = phase.certificate.probes[index]!;
      if (!Object.isFrozen(control) || !Object.isFrozen(arm) || !Object.isFrozen(probe) ||
          control.supportFraction !== fraction || arm.supportFraction !== fraction ||
          !sameConstructionArmAsCertificateProbe(arm, probe)) {
        return invalidMeasurementRoster("selected_arm_certificate_mismatch");
      }
      if (arm.status !== "observed" || !arm.constructionSafe || arm.expectedCollisionRejection || arm.protocolInvalid ||
          !arm.carrierLineIdsUnique || !arm.carrierLineIdsDisjointFromCapture || arm.carrier === null) {
        return invalidMeasurementRoster("selected_arm_not_construction_safe");
      }
      const carrier = arm.carrier;
      if (!Object.isFrozen(carrier) || !Object.isFrozen(carrier.lines) ||
          carrier.phaseLeadSteps !== phase.phaseLeadSteps || carrier.supportFraction !== fraction ||
          carrier.extentPx !== control.extentPx) {
        return invalidMeasurementRoster("selected_arm_carrier_mismatch");
      }
      const expectedLineCount = fraction === 0 ? 0 : 1;
      if (carrier.lines.length !== expectedLineCount || (fraction === 0 && carrier.line !== null) ||
          (fraction !== 0 && (carrier.line === null || carrier.lines[0] !== carrier.line))) {
        return invalidMeasurementRoster("selected_arm_carrier_topology_mismatch");
      }
      const expectedCarrier = realizePostimpactLongCarrier({
        namedReferenceStep: pending.capture.namedReferenceStep,
        phaseLeadSteps: phase.phaseLeadSteps,
        supportFraction: fraction,
        extentPx: control.extentPx,
        lineIdStart: pending.capture.lastCaptureLineId + 1,
      });
      if (!samePostimpactLongCarrierGeometry(carrier, expectedCarrier)) {
        return invalidMeasurementRoster("selected_arm_carrier_geometry_mismatch");
      }
    }
    return { valid: true, reason: null };
  } catch {
    return invalidMeasurementRoster("selected_phase_validation_error");
  }
}

function hasExactFractionRoster(
  values: readonly { supportFraction: unknown }[],
): values is readonly { supportFraction: PostimpactLongCarrierFraction }[] {
  return values.length === POSTIMPACT_LONG_CARRIER_FRACTIONS.length &&
    values.every((value, index) => value.supportFraction === POSTIMPACT_LONG_CARRIER_FRACTIONS[index]);
}

function sameReadyDurationPlan(
  left: Extract<PostimpactLongCarrierDurationPlan, { status: "ready" }>,
  right: Extract<PostimpactLongCarrierDurationPlan, { status: "ready" }>,
): boolean {
  return left.phaseLeadSteps === right.phaseLeadSteps && left.carrierStartFrame === right.carrierStartFrame &&
    left.availableCarrierIntervals === right.availableCarrierIntervals && left.controls.length === right.controls.length &&
    left.controls.every((control, index) => control.supportFraction === right.controls[index]?.supportFraction &&
      control.extentPx === right.controls[index]?.extentPx);
}

/** Bind replayed geometry to the canonical realizer, not only its metadata. */
function samePostimpactLongCarrierGeometry(
  left: PostimpactLongCarrier,
  right: PostimpactLongCarrier,
): boolean {
  return left.phaseLeadSteps === right.phaseLeadSteps && left.supportFraction === right.supportFraction &&
    left.extentPx === right.extentPx && samePoint(left.carrierStart, right.carrierStart) &&
    samePoint(left.direction, right.direction) && sameCarrierLine(left.line, right.line) &&
    left.lines.length === right.lines.length &&
    left.lines.every((line, index) => sameCarrierLine(line, right.lines[index] ?? null));
}

function samePoint(left: { x: number; y: number }, right: { x: number; y: number }): boolean {
  return left.x === right.x && left.y === right.y;
}

function sameCarrierLine(
  left: PostimpactLongCarrier["line"],
  right: PostimpactLongCarrier["line"],
): boolean {
  if (left === null || right === null) return left === right;
  return left.id === right.id && left.type === right.type && left.x1 === right.x1 && left.y1 === right.y1 &&
    left.x2 === right.x2 && left.y2 === right.y2 && left.flipped === right.flipped &&
    left.leftExtended === right.leftExtended && left.rightExtended === right.rightExtended;
}

function sameConstructionArmAsCertificateProbe(
  arm: PostimpactLongCarrierConstructionArm,
  probe: PostimpactLongCarrierConstructionProbe,
): boolean {
  return arm.supportFraction === probe.supportFraction && arm.status === probe.status &&
    arm.constructionSafe === probe.constructionSafe &&
    arm.expectedCollisionRejection === probe.expectedCollisionRejection &&
    arm.protocolInvalid === probe.protocolInvalid && arm.reason === probe.reason;
}

function invalidMeasurementRoster(reason: string): PostimpactLongCarrierMeasurementRosterValidation {
  return { valid: false, reason };
}

function constructArm(
  capture: PostimpactLongCarrierDurationCapture,
  plan: Extract<PostimpactLongCarrierDurationPlan, { status: "ready" }>,
  supportFraction: PostimpactLongCarrierFraction,
  extentPx: number,
): PostimpactLongCarrierConstructionArm {
  const started = performance.now();
  try {
    const lineIdStart = capture.lastCaptureLineId + 1;
    const carrier = realizePostimpactLongCarrier({
      namedReferenceStep: capture.namedReferenceStep,
      phaseLeadSteps: plan.phaseLeadSteps,
      supportFraction,
      extentPx,
      lineIdStart,
    });
    if (carrier.lines.length > 0) postimpactLineIdRange(lineIdStart, carrier.lines.length);
    const carrierIds = new Set(carrier.lines.map((line) => line.id));
    const captureIds = new Set(capture.captureLineIds);
    const carrierLineIdsUnique = carrierIds.size === carrier.lines.length;
    const carrierLineIdsDisjointFromCapture = [...carrierIds].every((id) => !captureIds.has(id));
    const engine = capture.addTrackLines(capture.captureEngine, carrier.lines);
    const detection = detectPostimpactWindow(engine, 0, capture.supportStartFrame);
    const observation = observePostimpactCapture(
      detection,
      capture.current,
      capture.captureObservationSurface,
      capture.supportStartFrame,
      capture.impactWindowFrames,
    );
    const preOrAtHCarrierCollisions = postimpactAllBodyCollisions(
      engine,
      0,
      capture.supportStartFrame,
      carrierIds,
    );
    const firstCarrierCollisionFrame = postimpactFirstCollisionFrame(preOrAtHCarrierCollisions);
    const traceMatchesBeforeFirstCarrierCollision = firstCarrierCollisionFrame === null
      ? samePostimpactExactEngineTrace(
        postimpactTrace(engine, 0, capture.supportStartFrame),
        capture.captureFullTraceThroughH,
      )
      : samePostimpactExactEngineTrace(
        postimpactTrace(engine, 0, firstCarrierCollisionFrame - 1),
        postimpactTrace(capture.captureEngine, 0, firstCarrierCollisionFrame - 1),
      );
    const baseVerdict = classifyPostimpactConstructionProbe({
      physicalPrefixMatchesBaseline: samePostimpactExactEngineTrace(
        postimpactTrace(engine, 0, capture.current.startFrame - 1),
        capture.baselinePhysicalPrefixTrace,
      ),
      captureOnlyPreHComplete: capture.sharedCaptureCertificate.captureOnlyCompleteThroughHPlusOne,
      captureOnlyPreHTraceAvailable: capture.sharedCaptureCertificate.exactCaptureOnlyTrace.fingerprint !== null &&
        capture.sharedCaptureCertificate.exactCaptureOnlyTrace.unavailableAtFrame === null,
      captureTraceMatchesComparator: samePostimpactExactEngineTrace(
        postimpactTrace(engine, capture.current.endFrame, capture.supportStartFrame),
        capture.captureTraceThroughH,
      ),
      traceMatchesBeforeFirstSupportCollision: traceMatchesBeforeFirstCarrierCollision,
      selectedCaptureEventMatchesComparator: samePostimpactOwnedCaptureEvent(
        observation.selectedOwnedEvent,
        capture.captureOnlyObservation.selectedOwnedEvent,
      ),
      impactMatchesComparator: capture.protectedCaptureImpactMatches(detection, observation),
      survivesThroughH: survivesPostimpactThroughFrame(detection, capture.supportStartFrame) &&
        postimpactMeasurementLastFrame(detection) >= capture.supportStartFrame,
      preOrAtHSupportCollisionCount: preOrAtHCarrierCollisions.length,
    });
    const verdict = carrierLineIdsUnique && carrierLineIdsDisjointFromCapture
      ? baseVerdict
      : invalidLineIdVerdict(baseVerdict, carrierLineIdsUnique, carrierLineIdsDisjointFromCapture);
    return {
      supportFraction,
      status: "observed",
      carrier,
      carrierLineIdsDisjointFromCapture,
      carrierLineIdsUnique,
      preOrAtHCarrierCollisions,
      firstCarrierCollisionFrame,
      traceMatchesBeforeFirstCarrierCollision,
      elapsedMs: round(performance.now() - started),
      ...verdict,
    };
  } catch (error) {
    return {
      supportFraction,
      status: "error",
      carrier: null,
      carrierLineIdsDisjointFromCapture: false,
      carrierLineIdsUnique: false,
      preOrAtHCarrierCollisions: [],
      firstCarrierCollisionFrame: null,
      traceMatchesBeforeFirstCarrierCollision: false,
      constructionSafe: false,
      expectedCollisionRejection: false,
      protocolInvalid: true,
      reason: errorMessage(error),
      elapsedMs: round(performance.now() - started),
    };
  }
}

function invalidLineIdVerdict(
  _base: PostimpactConstructionProbeVerdict,
  unique: boolean,
  disjoint: boolean,
): PostimpactConstructionProbeVerdict {
  return {
    constructionSafe: false,
    expectedCollisionRejection: false,
    protocolInvalid: true,
    reason: !unique ? "carrier_line_ids_not_unique" : !disjoint ? "carrier_line_ids_overlap_capture" : "carrier_line_ids_invalid",
  };
}

function summarizePhase(phase: PostimpactLongCarrierConstructionPhaseRecord) {
  return {
    phaseLeadSteps: phase.phaseLeadSteps,
    plan: phase.plan,
    certificate: summarizeCertificate(phase.certificate),
    arms: phase.arms.map((arm) => ({
      supportFraction: arm.supportFraction,
      status: arm.status,
      constructionSafe: arm.constructionSafe,
      expectedCollisionRejection: arm.expectedCollisionRejection,
      protocolInvalid: arm.protocolInvalid,
      reason: arm.reason,
      carrier: arm.carrier === null ? null : summarizeCarrier(arm.carrier),
      carrierLineIdsDisjointFromCapture: arm.carrierLineIdsDisjointFromCapture,
      carrierLineIdsUnique: arm.carrierLineIdsUnique,
      preOrAtHCarrierCollisions: arm.preOrAtHCarrierCollisions,
      firstCarrierCollisionFrame: arm.firstCarrierCollisionFrame,
      traceMatchesBeforeFirstCarrierCollision: arm.traceMatchesBeforeFirstCarrierCollision,
      elapsedMs: arm.elapsedMs,
    })),
  };
}

function summarizeCarrier(carrier: PostimpactLongCarrier) {
  return {
    phaseLeadSteps: carrier.phaseLeadSteps,
    supportFraction: carrier.supportFraction,
    extentPx: round(carrier.extentPx),
    carrierStart: { x: round(carrier.carrierStart.x), y: round(carrier.carrierStart.y) },
    direction: { x: round(carrier.direction.x), y: round(carrier.direction.y) },
    line: carrier.line === null ? null : { ...carrier.line },
    lines: carrier.lines.map((line) => ({ ...line })),
  };
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
