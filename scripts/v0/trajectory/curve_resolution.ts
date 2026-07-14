/**
 * Geometry-only adaptive polyline resolution for a path with a monotone
 * tangent-angle schedule. Segment count depends on curvature approximation,
 * never on a duration class or an arbitrary maximum line length.
 */
export type CurveResolutionOptions = {
  /** Approximate maximum circular-arc sagitta error in pixels. */
  maxChordErrorPx?: number;
  /** Maximum tangent-angle change represented by one segment. */
  maxTurnDegPerSegment?: number;
};

export function adaptiveCurveSegmentCount(
  extentPx: number,
  totalTurnDeg: number,
  curvaturePower: number,
  options: CurveResolutionOptions = {},
): number {
  nonNegative("extentPx", extentPx);
  finite("totalTurnDeg", totalTurnDeg);
  positive("curvaturePower", curvaturePower);
  const maxChordErrorPx = positive("maxChordErrorPx", options.maxChordErrorPx ?? 2);
  const maxTurnDegPerSegment = positive("maxTurnDegPerSegment", options.maxTurnDegPerSegment ?? 5);
  const turnAbsDeg = Math.abs(totalTurnDeg);
  if (extentPx <= 1e-12) return 0;
  if (turnAbsDeg <= 1e-12) return 1;
  const turnAbsRad = turnAbsDeg * Math.PI / 180;
  const chordCount = Math.ceil(Math.sqrt(turnAbsRad * extentPx / (8 * maxChordErrorPx)));
  let angleCount = 1;
  while (maximumTurnStepDeg(turnAbsDeg, curvaturePower, angleCount) > maxTurnDegPerSegment) {
    if (angleCount > Number.MAX_SAFE_INTEGER / 2) {
      throw new Error("curve turn cannot be resolved at the requested angular tolerance");
    }
    angleCount *= 2;
  }
  return Math.max(1, chordCount, angleCount);
}

function maximumTurnStepDeg(totalTurnAbsDeg: number, power: number, segments: number): number {
  if (segments <= 1) return totalTurnAbsDeg;
  // For p < 1 the largest step is first; for p >= 1 it is last.
  return power < 1
    ? totalTurnAbsDeg * Math.pow(1 / segments, power)
    : totalTurnAbsDeg * (1 - Math.pow(1 - 1 / segments, power));
}

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || !(value > 0)) throw new Error(`${name} must be positive and finite`);
  return value;
}

function nonNegative(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be non-negative and finite`);
  return value;
}

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}
