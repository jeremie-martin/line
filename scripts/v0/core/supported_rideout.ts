import { K_BOUNCE_LANDING } from "../../lib/detector.ts";

export type SupportedRideoutStudyMode = "off" | "length" | "coordinated";

const LEGACY_CONTACT_CENTERED_CAP_PX = 360;
const MAX_STUDY_RIDEOUT_PX = 8_192;
const MAX_STUDY_SEGMENTS = 256;

export type SupportedRideoutPlan = {
  effectiveAir: number;
  targetGroundFrames: number;
  targetLength: number;
  deficitPressure: number;
  postLength: number;
};

export function supportedRideoutStudyMode(): SupportedRideoutStudyMode {
  const value = process.env.LR_SUPPORTED_RIDEOUT_STUDY ?? "off";
  if (value === "off" || value === "length" || value === "coordinated") return value;
  throw new Error(`LR_SUPPORTED_RIDEOUT_STUDY must be off|length|coordinated, got ${value}`);
}

export function supportedRideoutDeficitPressure(input: {
  air: number;
  gapFrames: number;
  speed: number;
}): number {
  const gapFrames = Math.max(1, input.gapFrames);
  const effectiveAir = Math.max(
    clamp(input.air, 0, 1),
    Math.min(1, K_BOUNCE_LANDING / gapFrames),
  );
  const targetLength = Math.max(1, input.speed) * gapFrames * (1 - effectiveAir);
  return smoothstep(
    (targetLength - LEGACY_CONTACT_CENTERED_CAP_PX) / LEGACY_CONTACT_CENTERED_CAP_PX,
  );
}

export function planSupportedRideout(input: {
  mode: SupportedRideoutStudyMode;
  air: number;
  gapFrames: number;
  speed: number;
  sampledPostLength: number;
  legacyPostLength: number;
  lengthBlend: number;
  legacyBlendStrength: number;
}): SupportedRideoutPlan {
  const gapFrames = Math.max(1, input.gapFrames);
  const air = clamp(input.air, 0, 1);
  const effectiveAir = Math.max(air, Math.min(1, K_BOUNCE_LANDING / gapFrames));
  const targetGroundFrames = gapFrames * (1 - effectiveAir);
  const targetLength = Math.min(
    MAX_STUDY_RIDEOUT_PX,
    Math.max(28, Math.max(1, input.speed) * targetGroundFrames),
  );
  const deficitPressure = supportedRideoutDeficitPressure({
    air,
    gapFrames,
    speed: input.speed,
  });
  if (input.mode === "off" || deficitPressure === 0) {
    return {
      effectiveAir,
      targetGroundFrames,
      targetLength,
      deficitPressure,
      postLength: input.legacyPostLength,
    };
  }

  const dynamicCap = lerp(LEGACY_CONTACT_CENTERED_CAP_PX, targetLength, deficitPressure);
  const blendStrength = lerp(input.legacyBlendStrength, 1, deficitPressure);
  return {
    effectiveAir,
    targetGroundFrames,
    targetLength,
    deficitPressure,
    postLength: clamp(
      lerp(input.sampledPostLength, targetLength, clamp(input.lengthBlend, 0, 1) * blendStrength),
      28,
      dynamicCap,
    ),
  };
}

export function supportedRideoutFlightFrames(
  mode: SupportedRideoutStudyMode,
  plan: SupportedRideoutPlan,
  gapFrames: number,
  speed: number,
): number {
  if (mode !== "coordinated" || plan.deficitPressure === 0) return Math.max(1, gapFrames);
  return clamp(
    gapFrames - plan.postLength / Math.max(1, speed),
    K_BOUNCE_LANDING,
    Math.max(K_BOUNCE_LANDING, gapFrames),
  );
}

export function supportedRideoutSegments(
  mode: SupportedRideoutStudyMode,
  postLength: number,
  segmentLength: number,
  legacySegments: number,
): number {
  if (mode !== "coordinated") return legacySegments;
  return clampInt(Math.round(postLength / Math.max(1, segmentLength)), 2, MAX_STUDY_SEGMENTS);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function clampInt(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(value)));
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}
