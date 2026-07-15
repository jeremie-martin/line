import { K_BOUNCE_LANDING } from "../../lib/detector.ts";

export type SupportGeometryMode =
  | "off"
  | "time"
  | "time-extend"
  | "time-shape-span"
  | "shape-time-log"
  | "shape-time-deficit";

// Family capture changes this source default. LR_SUPPORT_GEOMETRY is a study
// override only; selected production members must have an empty LR environment.
const DEFAULT_SUPPORT_GEOMETRY_MODE: SupportGeometryMode = "shape-time-deficit";

export type SupportGeometryPlan = {
  effectiveAir: number;
  targetGroundFrames: number;
  minGroundFrames: number;
  maxGroundFrames: number;
  sampledGroundFrames: number;
  targetLength: number;
  extensionPressure: number;
  postLength: number;
};

export function supportGeometryMode(): SupportGeometryMode {
  const value = process.env.LR_SUPPORT_GEOMETRY ?? DEFAULT_SUPPORT_GEOMETRY_MODE;
  if (
    value === "off" || value === "time" || value === "time-extend" ||
    value === "time-shape-span" || value === "shape-time-log" ||
    value === "shape-time-deficit"
  ) return value;
  throw new Error(
    `LR_SUPPORT_GEOMETRY must be off|time|time-extend|time-shape-span|shape-time-log|shape-time-deficit, got ${value}`,
  );
}

/**
 * Time-normalized support envelope. Authored air determines the target number
 * of grounded frames, the detector's landing floor reserves enough time for a
 * realizable catch, and a deterministic search coordinate samples explicit
 * timing slack around the target. Distance is derived only after that choice as
 * predicted riding speed * sampled support time.
 *
 * The same dimensionless model handles short, ordinary, and frontier gaps. It
 * contains no duration class and no inherited pixel ceiling.
 */
export function planSupportGeometry(input: {
  mode: SupportGeometryMode;
  air: number;
  gapFrames: number;
  speed: number;
  legacyPostLength: number;
  shapeReferenceLength?: number;
  coordinate: number;
  shapeTimeBlend: number;
}): SupportGeometryPlan {
  const gapFrames = Math.max(1, input.gapFrames);
  const air = clamp(input.air, 0, 1);
  const effectiveAir = Math.max(air, Math.min(1, K_BOUNCE_LANDING / gapFrames));
  const targetGroundFrames = gapFrames * (1 - effectiveAir);
  const maximumGroundFrames = Math.max(0, gapFrames - K_BOUNCE_LANDING);
  const slackRatio = 0.45;
  const slackFrames = Math.max(2, targetGroundFrames * slackRatio);
  const minGroundFrames = Math.max(0, targetGroundFrames - slackFrames);
  const maxGroundFrames = Math.min(maximumGroundFrames, targetGroundFrames + slackFrames);
  const sampledGroundFrames = lerp(
    minGroundFrames,
    maxGroundFrames,
    clamp(input.coordinate, 0, 1),
  );
  const speed = Math.max(1, input.speed);
  const targetLength = Math.max(28, speed * targetGroundFrames);
  const timePostLength = Math.max(28, speed * sampledGroundFrames);
  const shapeGroundFrames = Math.max(1, input.legacyPostLength / speed);
  const extensionPressure = supportExtensionPressure({
    air,
    gapFrames,
    speed,
    referenceLength: input.shapeReferenceLength ?? input.legacyPostLength,
  });
  const logGroundFrames = Math.exp(lerp(
    Math.log(shapeGroundFrames),
    Math.log(Math.max(1, targetGroundFrames)),
    clamp(input.shapeTimeBlend, 0, 1),
  ));
  const deficitGroundFrames = Math.exp(lerp(
    Math.log(shapeGroundFrames),
    Math.log(Math.max(1, targetGroundFrames)),
    clamp(input.shapeTimeBlend, 0, 1) * extensionPressure,
  ));
  const shapeTimeBlend = clamp(input.shapeTimeBlend, 0, 1);
  const logPostLength = shapeTimeBlend === 0
    ? input.legacyPostLength
    : Math.max(28, speed * logGroundFrames);
  const deficitPostLength = extensionPressure === 0 || shapeTimeBlend === 0
    ? input.legacyPostLength
    : Math.max(28, speed * deficitGroundFrames);
  const timeShapeSpanPostLength = lerp(input.legacyPostLength, timePostLength, shapeTimeBlend);
  const postLength = input.mode === "off"
    ? input.legacyPostLength
    : input.mode === "time-extend"
    ? Math.max(input.legacyPostLength, timePostLength)
    : input.mode === "time"
    ? timePostLength
    : input.mode === "shape-time-log"
    ? logPostLength
    : input.mode === "shape-time-deficit"
    ? deficitPostLength
    : timeShapeSpanPostLength;
  return {
    effectiveAir,
    targetGroundFrames,
    minGroundFrames,
    maxGroundFrames,
    sampledGroundFrames,
    targetLength,
    extensionPressure,
    postLength,
  };
}

export function supportReferenceLength(input: {
  air: number;
  gapFrames: number;
  speed: number;
}): number {
  const air = clamp(input.air, 0, 1);
  const speed = Math.max(1, input.speed);
  const gapFrames = Math.max(1, input.gapFrames);
  const groundedTargetLength = speed * (1 - air) * gapFrames;
  const safeCap = speed * gapFrames * 0.55;
  return clamp(Math.min(groundedTargetLength, safeCap), 28, 360);
}

export function supportExtensionPressure(input: {
  air: number;
  gapFrames: number;
  speed: number;
  referenceLength?: number;
}): number {
  const gapFrames = Math.max(1, input.gapFrames);
  const air = clamp(input.air, 0, 1);
  const effectiveAir = Math.max(air, Math.min(1, K_BOUNCE_LANDING / gapFrames));
  const targetGroundFrames = gapFrames * (1 - effectiveAir);
  const speed = Math.max(1, input.speed);
  const referenceLength = input.referenceLength ?? supportReferenceLength({ air, gapFrames, speed });
  const referenceGroundFrames = Math.max(1, referenceLength / speed);
  const supportDeficitRatio = targetGroundFrames / referenceGroundFrames;
  return smoothstep(clamp(
    (Math.log(Math.max(1, supportDeficitRatio)) - Math.log(2)) /
      (Math.log(5) - Math.log(2)),
    0,
    1,
  ));
}

function smoothstep(value: number): number {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}
