/**
 * Fixed duration-control and phase-certification protocol for the long-carrier
 * calibration study. This is deliberately a small declared stencil, not a
 * search menu or a production policy.
 */
import type { PostimpactConstructionProbeVerdict } from "./postimpact_construction_probe.ts";
import type { PostimpactNamedReferenceStep } from "./postimpact_support_orientation.ts";

export const POSTIMPACT_LONG_CARRIER_FRACTIONS = Object.freeze([0, 0.25, 0.5, 0.75, 1] as const);
export const POSTIMPACT_LONG_CARRIER_PHASE_LEAD_STEPS = Object.freeze([0, 1, 2, 3, 4] as const);

export const POSTIMPACT_LONG_CARRIER_PROTOCOL = Object.freeze({
  supportFractions: POSTIMPACT_LONG_CARRIER_FRACTIONS,
  phaseLeadSteps: POSTIMPACT_LONG_CARRIER_PHASE_LEAD_STEPS,
  minimumAvailableCarrierIntervals: 4,
  phaseSelection: "first_declared_phase_all_five_arms_pre_outcome.v1",
  primaryResponse: "inclusive_H_to_E_air_fraction_nonincreasing_one_sample_tolerance.v1",
} as const);

export type PostimpactLongCarrierFraction = (typeof POSTIMPACT_LONG_CARRIER_FRACTIONS)[number];
export type PostimpactLongCarrierPhaseLeadSteps = (typeof POSTIMPACT_LONG_CARRIER_PHASE_LEAD_STEPS)[number];

export type PostimpactLongCarrierDurationPlan =
  | {
    status: "ready";
    phaseLeadSteps: PostimpactLongCarrierPhaseLeadSteps;
    carrierStartFrame: number;
    availableCarrierIntervals: number;
    controls: readonly { supportFraction: PostimpactLongCarrierFraction; extentPx: number }[];
  }
  | {
    status: "insufficient_duration";
    phaseLeadSteps: PostimpactLongCarrierPhaseLeadSteps;
    carrierStartFrame: number;
    availableCarrierIntervals: number;
  };

/**
 * Plan numeric extents after the explicit duration boundary releases only E.
 * The realizer receives the resulting extent, never the endpoint itself.
 */
export function planPostimpactLongCarrierDuration(input: {
  outgoingEndFrame: number;
  namedReferenceStep: PostimpactNamedReferenceStep;
  observedReferenceSpeedPxPerFrame: number;
  phaseLeadSteps: PostimpactLongCarrierPhaseLeadSteps;
}): PostimpactLongCarrierDurationPlan {
  assertFrame("outgoingEndFrame", input.outgoingEndFrame);
  assertFrame("named reference H+1 frame", input.namedReferenceStep.toFrame);
  assertPositiveFinite("observed reference speed", input.observedReferenceSpeedPxPerFrame);
  assertDeclaredPhase(input.phaseLeadSteps);
  const carrierStartFrame = input.namedReferenceStep.toFrame + input.phaseLeadSteps;
  const availableCarrierIntervals = input.outgoingEndFrame - carrierStartFrame;
  if (availableCarrierIntervals < POSTIMPACT_LONG_CARRIER_PROTOCOL.minimumAvailableCarrierIntervals) {
    return Object.freeze({
      status: "insufficient_duration",
      phaseLeadSteps: input.phaseLeadSteps,
      carrierStartFrame,
      availableCarrierIntervals,
    });
  }
  return Object.freeze({
    status: "ready",
    phaseLeadSteps: input.phaseLeadSteps,
    carrierStartFrame,
    availableCarrierIntervals,
    controls: Object.freeze(POSTIMPACT_LONG_CARRIER_FRACTIONS.map((supportFraction) => Object.freeze({
      supportFraction,
      extentPx: input.observedReferenceSpeedPxPerFrame * supportFraction * availableCarrierIntervals,
    }))),
  });
}

/** Construction and post-selection measurement must use the same released E. */
export function postimpactLongCarrierDurationEndpointMatches(
  constructionOutgoingEndFrame: number,
  measurementOutgoingEndFrame: number,
): boolean {
  assertFrame("construction outgoing end frame", constructionOutgoingEndFrame);
  assertFrame("measurement outgoing end frame", measurementOutgoingEndFrame);
  return constructionOutgoingEndFrame === measurementOutgoingEndFrame;
}

export type PostimpactLongCarrierConstructionProbe = PostimpactConstructionProbeVerdict & {
  supportFraction: PostimpactLongCarrierFraction;
  status: "observed" | "error";
};

export type PostimpactLongCarrierPhaseCertificate = {
  phaseLeadSteps: PostimpactLongCarrierPhaseLeadSteps;
  availableCarrierIntervals: number;
  /**
   * `unavailable` is an expected horizon limitation, not a malformed probe.
   * Keep it distinct from `invalid` so a short outgoing interval cannot make
   * an otherwise honest calibration execution look like a protocol failure.
   */
  status: "certified" | "rejected" | "unavailable" | "invalid";
  probes: readonly PostimpactLongCarrierConstructionProbe[];
  reason:
    | "all_declared_fractions_construction_safe"
    | "expected_construction_collision"
    | "insufficient_duration"
    | "invalid_construction_probe"
    | "unknown_fraction"
    | "duplicate_fraction"
    | "missing_declared_fraction";
};

export type PostimpactLongCarrierPhaseSelection =
  | {
    status: "selected";
    certificate: PostimpactLongCarrierPhaseCertificate;
  }
  | {
    status: "no_certified_phase";
  }
  | {
    status: "invalid_roster";
    reason: "unissued_certificate" | "unknown_phase" | "duplicate_phase" | "missing_phase";
  };

const ISSUED_LONG_CARRIER_CERTIFICATES = new WeakSet<object>();

/** Certificates are capability tokens, not reconstructible report data. */
export function isIssuedPostimpactLongCarrierPhaseCertificate(
  value: unknown,
): value is PostimpactLongCarrierPhaseCertificate {
  return value !== null && typeof value === "object" && ISSUED_LONG_CARRIER_CERTIFICATES.has(value);
}

/**
 * Certify one phase only when every predeclared fraction is present and safe.
 * Expected carrier collisions reject the whole phase; malformed/drifting
 * probes invalidate it and can never be silently selected.
 */
export function certifyPostimpactLongCarrierPhase(
  plan: PostimpactLongCarrierDurationPlan,
  probes: readonly PostimpactLongCarrierConstructionProbe[],
): PostimpactLongCarrierPhaseCertificate {
  if (plan.status !== "ready") {
    return issueLongCarrierCertificate({
      phaseLeadSteps: plan.phaseLeadSteps,
      availableCarrierIntervals: plan.availableCarrierIntervals,
      status: "unavailable",
      probes: [],
      reason: "insufficient_duration",
    });
  }
  const byFraction = new Map<PostimpactLongCarrierFraction, PostimpactLongCarrierConstructionProbe>();
  let unknownFraction = false;
  let duplicateFraction = false;
  for (const probe of probes) {
    if (!isDeclaredFraction(probe?.supportFraction)) {
      unknownFraction = true;
      continue;
    }
    if (byFraction.has(probe.supportFraction)) {
      duplicateFraction = true;
      continue;
    }
    byFraction.set(probe.supportFraction, probe);
  }
  const ordered = POSTIMPACT_LONG_CARRIER_FRACTIONS.flatMap((fraction) => {
    const probe = byFraction.get(fraction);
    return probe === undefined ? [] : [freezeProbe(probe)];
  });
  if (unknownFraction) {
    return issueLongCarrierCertificate({
      phaseLeadSteps: plan.phaseLeadSteps,
      availableCarrierIntervals: plan.availableCarrierIntervals,
      status: "invalid",
      probes: ordered,
      reason: "unknown_fraction",
    });
  }
  if (duplicateFraction) {
    return issueLongCarrierCertificate({
      phaseLeadSteps: plan.phaseLeadSteps,
      availableCarrierIntervals: plan.availableCarrierIntervals,
      status: "invalid",
      probes: ordered,
      reason: "duplicate_fraction",
    });
  }
  if (ordered.length !== POSTIMPACT_LONG_CARRIER_FRACTIONS.length) {
    return issueLongCarrierCertificate({
      phaseLeadSteps: plan.phaseLeadSteps,
      availableCarrierIntervals: plan.availableCarrierIntervals,
      status: "invalid",
      probes: ordered,
      reason: "missing_declared_fraction",
    });
  }
  if (ordered.some((probe) => probe.status !== "observed" || probe.protocolInvalid ||
      !probe.constructionSafe && !probe.expectedCollisionRejection)) {
    return issueLongCarrierCertificate({
      phaseLeadSteps: plan.phaseLeadSteps,
      availableCarrierIntervals: plan.availableCarrierIntervals,
      status: "invalid",
      probes: ordered,
      reason: "invalid_construction_probe",
    });
  }
  if (ordered.some((probe) => probe.expectedCollisionRejection || !probe.constructionSafe)) {
    return issueLongCarrierCertificate({
      phaseLeadSteps: plan.phaseLeadSteps,
      availableCarrierIntervals: plan.availableCarrierIntervals,
      status: "rejected",
      probes: ordered,
      reason: "expected_construction_collision",
    });
  }
  return issueLongCarrierCertificate({
    phaseLeadSteps: plan.phaseLeadSteps,
    availableCarrierIntervals: plan.availableCarrierIntervals,
    status: "certified",
    probes: ordered,
    reason: "all_declared_fractions_construction_safe",
  });
}

/**
 * Validate the complete declared roster, then select its earliest certified
 * phase. A malformed roster is never equivalent to an honest all-rejected
 * screen because it would otherwise turn a protocol defect into no evidence.
 */
export function selectPostimpactLongCarrierPhase(
  certificates: readonly PostimpactLongCarrierPhaseCertificate[],
): PostimpactLongCarrierPhaseSelection {
  const byPhase = new Map<PostimpactLongCarrierPhaseLeadSteps, PostimpactLongCarrierPhaseCertificate>();
  for (const certificate of certificates) {
    if (!isIssuedPostimpactLongCarrierPhaseCertificate(certificate)) {
      return { status: "invalid_roster", reason: "unissued_certificate" };
    }
    if (!isDeclaredPhase(certificate.phaseLeadSteps)) {
      return { status: "invalid_roster", reason: "unknown_phase" };
    }
    if (byPhase.has(certificate.phaseLeadSteps)) {
      return { status: "invalid_roster", reason: "duplicate_phase" };
    }
    byPhase.set(certificate.phaseLeadSteps, certificate);
  }
  if (byPhase.size !== POSTIMPACT_LONG_CARRIER_PHASE_LEAD_STEPS.length) {
    return { status: "invalid_roster", reason: "missing_phase" };
  }
  for (const phaseLeadSteps of POSTIMPACT_LONG_CARRIER_PHASE_LEAD_STEPS) {
    const certificate = byPhase.get(phaseLeadSteps);
    if (certificate === undefined) return { status: "invalid_roster", reason: "missing_phase" };
    if (certificate.status === "certified") return { status: "selected", certificate };
  }
  return { status: "no_certified_phase" };
}

/** Compatibility projection for callers that only need the selected phase. */
export function firstCertifiedPostimpactLongCarrierPhase(
  certificates: readonly PostimpactLongCarrierPhaseCertificate[],
): PostimpactLongCarrierPhaseCertificate | null {
  const selection = selectPostimpactLongCarrierPhase(certificates);
  return selection.status === "selected" ? selection.certificate : null;
}

function issueLongCarrierCertificate(
  certificate: PostimpactLongCarrierPhaseCertificate,
): PostimpactLongCarrierPhaseCertificate {
  const frozen = Object.freeze({
    ...certificate,
    probes: Object.freeze(certificate.probes.map(freezeProbe)),
  });
  ISSUED_LONG_CARRIER_CERTIFICATES.add(frozen);
  return frozen;
}

function freezeProbe(probe: PostimpactLongCarrierConstructionProbe): PostimpactLongCarrierConstructionProbe {
  return Object.freeze({
    supportFraction: probe.supportFraction,
    status: probe.status,
    constructionSafe: probe.constructionSafe,
    expectedCollisionRejection: probe.expectedCollisionRejection,
    protocolInvalid: probe.protocolInvalid,
    reason: probe.reason,
  });
}

function assertDeclaredPhase(value: number): asserts value is PostimpactLongCarrierPhaseLeadSteps {
  if (!isDeclaredPhase(value)) {
    throw new Error("post-impact long carrier phase lead must match the declared ladder");
  }
}

function isDeclaredPhase(value: unknown): value is PostimpactLongCarrierPhaseLeadSteps {
  return typeof value === "number" &&
    (POSTIMPACT_LONG_CARRIER_PHASE_LEAD_STEPS as readonly number[]).includes(value);
}

function isDeclaredFraction(value: unknown): value is PostimpactLongCarrierFraction {
  return typeof value === "number" && (POSTIMPACT_LONG_CARRIER_FRACTIONS as readonly number[]).includes(value);
}

function assertFrame(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`post-impact long carrier ${name} must be a non-negative safe integer`);
  }
}

function assertPositiveFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || !(value > 0)) {
    throw new Error(`post-impact long carrier ${name} must be finite and positive`);
  }
}
