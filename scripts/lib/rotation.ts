/**
 * Rotation primitives — recover the rider's *orientation* over time and reduce
 * it to spin/flip features. Pure and array-only (no engine coupling), so it is
 * unit-testable with hand-built fixtures, mirroring the detector's pure-core
 * design.
 *
 * Factored out of study_rotation.ts so the diagnostic script and the structured
 * trace emitter (scripts/v0/core/trace.ts) share one source of truth for "how
 * much did the rider spin?".
 *
 * Angles are degrees, +down (screen +y), matching `sledPoseDegFromRider` in
 * detector.ts. The sled (NOSE–TAIL) is rigid, so its angle is a clean
 * orientation; rotation as a *trick* lives in the air, where the sled tumbles
 * freely. On the ground the sled is constrained to the surface (angle ≈
 * velocity direction).
 */

/** Fold an angle delta into (-180, 180]. */
export function wrapDeg(d: number): number {
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

/**
 * Continuous cumulative orientation from a per-frame raw-angle series. Each
 * entry is a TAIL→NOSE angle in degrees, or null/NaN when unreadable (in which
 * case the previous orientation is held). Unwrapping across the ±180° boundary
 * makes accumulated rotation continuous: a full spin reads as ±360, not a jump.
 */
export function unwrapSeries(rawPoseDeg: ReadonlyArray<number | null>): number[] {
  const n = rawPoseDeg.length;
  const out: number[] = new Array(n);
  if (n === 0) return out;
  const first = rawPoseDeg[0];
  out[0] = first != null && Number.isFinite(first) ? first : 0;
  for (let f = 1; f < n; f++) {
    const cur = rawPoseDeg[f];
    if (cur == null || !Number.isFinite(cur)) {
      out[f] = out[f - 1]; // hold previous when the pose is unreadable
    } else {
      out[f] = out[f - 1] + wrapDeg(cur - out[f - 1]);
    }
  }
  return out;
}

/** Per-frame angular velocity (deg/frame) of an unwrapped series; index 0 is 0. */
export function angularVelocity(unwrapped: ReadonlyArray<number>): number[] {
  const n = unwrapped.length;
  const out: number[] = new Array(n);
  if (n === 0) return out;
  out[0] = 0;
  for (let f = 1; f < n; f++) out[f] = unwrapped[f] - unwrapped[f - 1];
  return out;
}

/** One airborne arc's rotation. `netDeg` is signed displacement; `absDeg` sums
 *  |angular velocity| so back-and-forth rocking counts, not just net spin. */
export type RotationArc = {
  startFrame: number;
  endFrame: number;
  lengthFrames: number;
  netDeg: number;
  absDeg: number;
  peakDegPerFrame: number;
  isFlip: boolean; // |netDeg| > 180 in a single airborne arc
};

export type RotationTrace = {
  /** Unwrapped cumulative orientation, per frame. */
  cumulativeDeg: number[];
  /** Per-frame angular velocity (deg/frame). */
  angVelDegPerFrame: number[];
  /** cumulativeDeg[last] − cumulativeDeg[0] (whole-track signed net). */
  netRotationDeg: number;
  /** Σ arc.absDeg over qualifying airborne arcs (airborne angular travel). */
  totalAbsRotationDeg: number;
  /** totalAbsRotationDeg / 360. */
  revolutions: number;
  /** Max per-frame |angular velocity| across qualifying airborne arcs. */
  peakAngularSpeedDegPerFrame: number;
  /** Count of qualifying airborne arcs with |netDeg| > 180. */
  flipCount: number;
  /** Per-airborne-arc breakdown (qualifying arcs only). */
  arcs: RotationArc[];
};

/** Contiguous true-runs of a boolean mask, as [start, end] inclusive index pairs. */
function runs(mask: ReadonlyArray<boolean>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let i = 0;
  while (i < mask.length) {
    if (mask[i]) {
      let j = i;
      while (j < mask.length && mask[j]) j++;
      out.push([i, j - 1]);
      i = j;
    } else i++;
  }
  return out;
}

/**
 * Reduce a per-frame body-pose series + airborne mask to rotation features.
 * Airborne arcs shorter than `minArcFrames` are skipped (too few frames to read
 * a meaningful rotation); the default of 3 matches study_rotation.ts's `b−a<2`
 * skip. `rawPoseDeg` and `airborne` must be frame-aligned.
 */
export function computeRotationTrace(
  rawPoseDeg: ReadonlyArray<number | null>,
  airborne: ReadonlyArray<boolean>,
  minArcFrames = 3,
): RotationTrace {
  const cumulativeDeg = unwrapSeries(rawPoseDeg);
  const angVelDegPerFrame = angularVelocity(cumulativeDeg);
  const n = cumulativeDeg.length;

  const arcs: RotationArc[] = [];
  let totalAbsRotationDeg = 0;
  let flipCount = 0;
  let peakAngularSpeedDegPerFrame = 0;
  for (const [a, b] of runs(airborne.slice(0, n))) {
    if (b - a < minArcFrames - 1) continue;
    const netDeg = cumulativeDeg[b] - cumulativeDeg[a];
    let absDeg = 0;
    let peak = 0;
    for (let f = a + 1; f <= b; f++) {
      const s = Math.abs(angVelDegPerFrame[f]);
      absDeg += s;
      if (s > peak) peak = s;
    }
    totalAbsRotationDeg += absDeg;
    if (peak > peakAngularSpeedDegPerFrame) peakAngularSpeedDegPerFrame = peak;
    const isFlip = Math.abs(netDeg) > 180;
    if (isFlip) flipCount++;
    arcs.push({
      startFrame: a,
      endFrame: b,
      lengthFrames: b - a + 1,
      netDeg,
      absDeg,
      peakDegPerFrame: peak,
      isFlip,
    });
  }

  return {
    cumulativeDeg,
    angVelDegPerFrame,
    netRotationDeg: n > 0 ? cumulativeDeg[n - 1] - cumulativeDeg[0] : 0,
    totalAbsRotationDeg,
    revolutions: totalAbsRotationDeg / 360,
    peakAngularSpeedDegPerFrame,
    flipCount,
    arcs,
  };
}
