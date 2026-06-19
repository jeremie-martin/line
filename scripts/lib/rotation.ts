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

/**
 * A "stand": the sled stays LOCKED near vertical on ONE end — within `toleranceDeg`
 * of −90° (nose-up ⇒ on the TAIL/"back") OR of +90° (nose-down ⇒ on the NOSE/"front")
 * — for ≥`minInBandFraction` of a sustained span, while the rider BOUNCES on that end
 * (≥`minLandings` air→ground touch-downs).
 *
 * The "locked on one side" requirement is what makes this NOT a flip. A tumbling
 * sled SWEEPS through vertical (… → −90 → 0 → +90 → 180 → …), so it only sits within
 * tolerance of a given vertical for a handful of frames per revolution, then leaves —
 * far too short to form a stand, and it never stays on one side. A balancing rider,
 * by contrast, holds the sled around (say) −90° and rocks within ±tolerance while
 * tapping the ground. So checking "stays within ±tol of a SINGLE vertical" cleanly
 * separates a tail/nose-stand from continuous rotation.
 *
 * Verticality is measured against WORLD HORIZONTAL (gravity), slope-independent.
 * Angles are TAIL→NOSE degrees, +y down (see file header).
 */
export type Stand = {
  startFrame: number;
  endFrame: number;
  lengthFrames: number;
  /** Landings (air→ground touch-downs) while balanced on the end — the bounces.
   *  A stand requires at least `minLandings` of these (default 2: two in a row). */
  landings: number;
  /** Which end the rider is balanced on. */
  side: "tail" | "nose";
  /** Mean angle of the sled from horizontal over the stand (deg, ≈90 when locked vertical). */
  meanUprightDeg: number;
  /** Fraction of frames actually within tolerance of vertical (≥ `minInBandFraction`). */
  inBandFraction: number;
  /** Fraction of frames airborne — a stand BOUNCES (≥ `minAirborneFraction`). */
  airborneFraction: number;
};

export type StandOptions = {
  /** Max deviation from a vertical (±90°) to count as "locked on that end". Default 20°
   *  (so the sled angle stays in [−110,−70] for a tail-stand). Lower = stricter. */
  toleranceDeg?: number;
  /** Min landings (air→ground touch-downs) to qualify — it must bounce on the end,
   *  not just tip once or slide. Default 2 (two landings in a row). */
  minLandings?: number;
  /** Min span length (frames). Default 12 (~0.3s @ 40fps). */
  minFrames?: number;
  /** Brief out-of-band frames (≤ this) bracketed by in-band are bridged, so a small
   *  rock past tolerance doesn't split one stand. Default 3. */
  bridgeFrames?: number;
  /** Min fraction of the span within tolerance of vertical. Default 0.9. */
  minInBandFraction?: number;
  /** Min fraction of the span airborne — a stand BOUNCES, so this rejects a grounded
   *  "slide on an end" (e.g. a steep slope ridden sled-perpendicular). Default 0.15.
   *  Study (100 tracks): every genuine stand was ≥23% airborne, so this is a robustness
   *  floor that doesn't drop real stands. */
  minAirborneFraction?: number;
};

/** Sled angle (TAIL→NOSE, +y down) folded to its acute angle from horizontal, [0,90]. */
export function uprightDegFromHorizontal(sledAngleDeg: number): number {
  const w = Math.abs(wrapDeg(sledAngleDeg)); // [0,180]
  return Math.min(w, 180 - w); // 0 = flat, 90 = vertical
}

/**
 * Detect tail-/nose-stands from the per-frame sled angle + airborne mask. Pure and
 * array-only. `sledAngleDeg[f]` is the raw TAIL→NOSE angle (NaN/holds tolerated →
 * treated as out-of-band). A continuously rotating sled produces NO stands, because
 * it never stays locked within tolerance of a single vertical.
 */
export function computeStands(
  sledAngleDeg: ReadonlyArray<number>,
  airborne: ReadonlyArray<boolean>,
  opts: StandOptions = {},
): Stand[] {
  const tol = opts.toleranceDeg ?? 20;
  const minLandings = opts.minLandings ?? 2;
  const minFrames = opts.minFrames ?? 12;
  const bridge = opts.bridgeFrames ?? 3;
  const minFrac = opts.minInBandFraction ?? 0.9;
  const minAirFrac = opts.minAirborneFraction ?? 0.15;
  const n = Math.min(sledAngleDeg.length, airborne.length);

  const out: Stand[] = [];
  for (const { name, target } of [
    { name: "tail" as const, target: -90 },
    { name: "nose" as const, target: 90 },
  ]) {
    // In-band = sled angle within `tol` of THIS vertical (one side only).
    const inBand: boolean[] = new Array(n);
    for (let f = 0; f < n; f++) {
      const a = sledAngleDeg[f];
      inBand[f] = Number.isFinite(a) && Math.abs(wrapDeg(a - target)) <= tol;
    }
    // Morphological close: fill short out-of-band gaps bracketed by in-band frames,
    // so a brief rock past tolerance mid-bounce doesn't fragment one stand.
    const standing = inBand.slice();
    for (let i = 0; i < n; ) {
      if (standing[i]) { i++; continue; }
      let j = i;
      while (j < n && !inBand[j]) j++;
      if (i > 0 && j < n && inBand[i - 1] && inBand[j] && j - i <= bridge) {
        for (let g = i; g < j; g++) standing[g] = true;
      }
      i = j;
    }
    for (const [a, b] of runs(standing)) {
      const len = b - a + 1;
      if (len < minFrames) continue;
      let landings = 0, inCount = 0, airCount = 0, sumUpright = 0, uprightCount = 0;
      let prevAir: boolean | null = null;
      for (let g = a; g <= b; g++) {
        const air = airborne[g];
        if (air) airCount++;
        if (prevAir === true && !air) landings++; // air → ground = a landing on the end
        prevAir = air;
        if (inBand[g]) inCount++;
        // Skip non-finite angles (NaN/null poses can be bridged into the run) so they
        // don't poison the mean — average over the readable frames only.
        const upright = uprightDegFromHorizontal(sledAngleDeg[g]);
        if (Number.isFinite(upright)) { sumUpright += upright; uprightCount++; }
      }
      const frac = inCount / len;
      const airFrac = airCount / len;
      // A stand BOUNCES: reject grounded "slide on an end" (e.g. a steep slope ridden
      // sled-perpendicular) via the airborne-fraction floor.
      if (frac < minFrac || landings < minLandings || airFrac < minAirFrac) continue;
      out.push({
        startFrame: a, endFrame: b, lengthFrames: len,
        landings, side: name,
        meanUprightDeg: uprightCount > 0 ? sumUpright / uprightCount : 0,
        inBandFraction: frac,
        airborneFraction: airFrac,
      });
    }
  }
  out.sort((x, y) => x.startFrame - y.startFrame);
  return out;
}

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
