import {
  AXES,
  ELEVATION,
  REPORT_ONLY_AXIS_SET,
  netDyToElevation,
  speedPxToAuthored,
  type AxisValues,
  type Gap,
  type TrackLine,
} from "../types.ts";
import { LOCAL_IMPACT_COST_WEIGHT } from "../core/candidate.ts";
import { axisQualityForTargets } from "../score.ts";
import {
  incomingKinematics,
  type BallisticState,
  type IncomingKinematics,
} from "../core/ballistic_projection.ts";

export type ArcKnobs = {
  /** Rotate the last third of the arc about the suffix joint, in degrees. */
  pitchDeg: number;
  /** Rotate the whole arc about its entry point, in degrees. */
  rotateDeg: number;
};

export type RiderArrivalState = BallisticState;

export type LinearModel = {
  coefficients: number[];
};

export type KnobSurfaceModel = {
  samples: Array<{ knobs: ArcKnobs; value: number }>;
  pitches: number[];
  rotates: number[];
  valueByPitchRotate: Map<number, Map<number, number>>;
  pitchAxisSamples: Array<{ x: number; value: number }>;
  rotateAxisSamples: Array<{ x: number; value: number }>;
};

export type ArcProbeDesignName = "cross5" | "grid9" | "pitch3";

export type ArcProbeDesignOptions = {
  pitchSpan?: number;
  rotateSpan?: number;
};

export type ArcResponseModelName =
  | "linear"
  | "additive_quadratic"
  | "joint_quadratic"
  | "surface"
  | "hybrid";

export type JointArcResponseContext = {
  gap: Gap;
  axisMeasureEnd: number;
  nextFrame: number;
};

export type JointArcResponseFitOptions = {
  context: JointArcResponseContext;
};

/** Functional forms a per-output fit can take, richest to simplest. */
export type ArcResponseFitForm =
  | "surface"
  | "biquadratic"
  | "joint_quadratic"
  | "additive_quadratic"
  | "linear"
  | "pitch_quadratic"
  | "pitch_linear";

export type FittedArcOutputModel = {
  predict(knobs: ArcKnobs): number;
  /** The functional form actually fitted. */
  form: ArcResponseFitForm;
  /** True when the hybrid identifiability ladder fitted below its first-choice
   *  form because gate-filtered rows could not identify it (aim.ts telemetry
   *  `joint_fit_degraded_outputs` aggregates this). */
  degraded: boolean;
};

type FittedArcOutputEntry = {
  angle: boolean;
  ref: number;
  model: FittedArcOutputModel;
};

type JointArcScoreReadoutModels = {
  outputAir?: FittedArcOutputEntry;
  outputSpeed?: FittedArcOutputEntry;
  outputGrain?: FittedArcOutputEntry;
  outputElevation?: FittedArcOutputEntry;
  outputAmplitude?: FittedArcOutputEntry;
  outputImpact?: FittedArcOutputEntry;
  outputExitFrame?: FittedArcOutputEntry;
  outputExitSpeed?: FittedArcOutputEntry;
  outputNextX?: FittedArcOutputEntry;
  outputNextY?: FittedArcOutputEntry;
  outputNextVx?: FittedArcOutputEntry;
  outputNextVy?: FittedArcOutputEntry;
  outputNextSledPoseDeg?: FittedArcOutputEntry;
  outputNextSledPoseRateDegPerFrame?: FittedArcOutputEntry;
  outputNextMeanSpeedPx?: FittedArcOutputEntry;
  outputNextAirFraction?: FittedArcOutputEntry;
  outputNextGapFrameCount?: FittedArcOutputEntry;
  outputNextElevation?: FittedArcOutputEntry;
};

export type JointArcProbeRow = {
  knobs: ArcKnobs;
  outputs: Record<string, number>;
};

export type JointArcResponseModel = {
  context: JointArcResponseContext;
  outputModels: Map<string, FittedArcOutputEntry>;
  scoreReadout: JointArcScoreReadoutModels;
};

export type JointArcScoreReadout = {
  currentQuality: number;
  state: IncomingKinematics | null;
  exitFrame: number;
  exitSpeed: number;
  nextMeanSpeedPx: number;
  nextAirFraction: number;
  /** Inclusive scorer-frame count over the projected next gap. */
  nextGapFrameCount: number;
  nextElevation: number;
};

export type JointArcCurrentScoreAxes = {
  air: boolean;
  speed: boolean;
  grain: boolean;
  elevation: boolean;
  amplitude: boolean;
  impact: boolean;
};

export const ARC_RESPONSE_MODEL_NAMES = [
  "linear",
  "additive_quadratic",
  "joint_quadratic",
  "surface",
  "hybrid",
] as const satisfies readonly ArcResponseModelName[];

export function rotateLinesAbout(
  lines: TrackLine[],
  pivot: { x: number; y: number },
  deg: number,
): TrackLine[] {
  if (deg === 0) return lines.map((line) => ({ ...line }));
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return lines.map((l) => {
    const dx1 = l.x1 - pivot.x;
    const dy1 = l.y1 - pivot.y;
    const dx2 = l.x2 - pivot.x;
    const dy2 = l.y2 - pivot.y;
    return {
      ...l,
      x1: pivot.x + dx1 * c - dy1 * s,
      y1: pivot.y + dx1 * s + dy1 * c,
      x2: pivot.x + dx2 * c - dy2 * s,
      y2: pivot.y + dx2 * s + dy2 * c,
    };
  });
}

/** Rotate the last ~third of the candidate's segments about that suffix's
 * first point. Positive = exit pitched down, screen +y. */
export function pitchExitLines(lines: TrackLine[], deg: number): TrackLine[] {
  if (lines.length === 0) return [];
  const m = Math.max(1, Math.ceil(lines.length / 3));
  const head = lines.slice(0, lines.length - m).map((line) => ({ ...line }));
  const tail = lines.slice(lines.length - m);
  const pivot = { x: tail[0].x1, y: tail[0].y1 };
  return [...head, ...rotateLinesAbout(tail, pivot, deg)];
}

/** Rotate the whole candidate about its entry point. */
export function rotateArcLines(lines: TrackLine[], deg: number): TrackLine[] {
  if (lines.length === 0) return [];
  return rotateLinesAbout(lines, { x: lines[0].x1, y: lines[0].y1 }, deg);
}

/**
 * Scale the complete arc about its entry point while preserving every segment
 * direction and the arc's internal shape. This is intentionally distinct from
 * `adjustArcTailLength`: it changes the duration of the complete supported
 * trajectory rather than appending or truncating only its exit tangent.
 */
export function scaleArcLines(lines: TrackLine[], scale: number): TrackLine[] {
  if (lines.length === 0 || !Number.isFinite(scale) || scale <= 0) return [];
  const pivot = { x: lines[0].x1, y: lines[0].y1 };
  return lines.map((line) => ({
    ...line,
    x1: pivot.x + (line.x1 - pivot.x) * scale,
    y1: pivot.y + (line.y1 - pivot.y) * scale,
    x2: pivot.x + (line.x2 - pivot.x) * scale,
    y2: pivot.y + (line.y2 - pivot.y) * scale,
  }));
}

/** Apply whole-arc rotation first, then exit pitch. This is the knob order used
 * by the production proposer and the joint-model studies. */
export function applyArcKnobs(lines: TrackLine[], knobs: ArcKnobs): TrackLine[] {
  const rotated = knobs.rotateDeg === 0 ? lines.map((line) => ({ ...line })) : rotateArcLines(lines, knobs.rotateDeg);
  return knobs.pitchDeg === 0 ? rotated : pitchExitLines(rotated, knobs.pitchDeg);
}

/** Longest tail extension, as a multiple of the arc's own total length, and
 *  segment-count cap — sanity bounds on the air-knob edit, not tuning knobs. */
const ARC_TAIL_EXTEND_MAX_RATIO = 1.5;
const ARC_TAIL_EXTEND_MAX_SEGMENTS = 12;
/** Truncation may remove at most this fraction of the arc's total length and
 *  must keep at least 2 segments (the catch geometry lives at the head). */
const ARC_TAIL_TRUNCATE_MAX_RATIO = 0.5;

/** M4 air knob: chain-continuity-preserving RIDE-OUT LENGTH edit. Positive
 *  `deltaPx` appends straight segments continuing the exit tangent (tangent-
 *  continuous at the joint); negative removes tail length (whole segments,
 *  then a partial shortening of the new last segment). The ride-out length is
 *  the release-frame lever: it controls how much of the NEXT gap is airborne.
 *  Returns null when the edit is empty or the geometry is degenerate; clamps
 *  (rather than fails) at the sanity bounds — a partial correction still moves
 *  predicted air the right way, and the exact production evaluation
 *  (tryCandidateLines) owns validity either way. */
export function adjustArcTailLength(lines: TrackLine[], deltaPx: number): TrackLine[] | null {
  if (lines.length === 0 || !Number.isFinite(deltaPx) || deltaPx === 0) return null;
  return deltaPx > 0 ? extendArcTail(lines, deltaPx) : truncateArcTail(lines, -deltaPx);
}

function arcSegmentLengths(lines: readonly TrackLine[]): number[] {
  return lines.map((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
}

function extendArcTail(lines: TrackLine[], lengthPx: number): TrackLine[] | null {
  const last = lines[lines.length - 1];
  const dx = last.x2 - last.x1;
  const dy = last.y2 - last.y1;
  const lastLen = Math.hypot(dx, dy);
  if (!(lastLen > 1e-6)) return null;
  const total = arcSegmentLengths(lines).reduce((a, b) => a + b, 0);
  const ext = Math.min(lengthPx, ARC_TAIL_EXTEND_MAX_RATIO * total);
  if (!(ext > 1e-6)) return null;
  const n = Math.max(1, Math.min(ARC_TAIL_EXTEND_MAX_SEGMENTS, Math.ceil(ext / lastLen)));
  const step = ext / n;
  const ux = dx / lastLen;
  const uy = dy / lastLen;
  const out = lines.map((line) => ({ ...line }));
  let px = last.x2;
  let py = last.y2;
  for (let i = 0; i < n; i++) {
    const nx = px + ux * step;
    const ny = py + uy * step;
    out.push({ ...last, x1: px, y1: py, x2: nx, y2: ny });
    px = nx;
    py = ny;
  }
  return out;
}

function truncateArcTail(lines: TrackLine[], lengthPx: number): TrackLine[] | null {
  if (lines.length < 3) return null;
  const lens = arcSegmentLengths(lines);
  const total = lens.reduce((a, b) => a + b, 0);
  let cut = Math.min(lengthPx, ARC_TAIL_TRUNCATE_MAX_RATIO * total);
  if (!(cut > 1e-6)) return null;
  const out = lines.map((line) => ({ ...line }));
  while (out.length > 2 && cut >= lens[out.length - 1]) {
    cut -= lens[out.length - 1];
    out.pop();
  }
  if (cut > 1e-6) {
    // Shorten the (new) last segment by the remainder, keeping ≥ 25% of it.
    const idx = out.length - 1;
    const l = out[idx];
    const len = lens[idx];
    if (len > 1e-6) {
      const t = Math.max(0.25, (len - cut) / len);
      l.x2 = l.x1 + (l.x2 - l.x1) * t;
      l.y2 = l.y1 + (l.y2 - l.y1) * t;
    }
  }
  return out;
}

export function arcProbeDesign(name: ArcProbeDesignName, options: ArcProbeDesignOptions = {}): ArcKnobs[] {
  switch (name) {
    case "cross5": {
      const pitchSpan = options.pitchSpan ?? 8.5;
      const rotateSpan = options.rotateSpan ?? 2.5;
      return dedupeArcKnobs([
        { pitchDeg: 0, rotateDeg: 0 },
        { pitchDeg: -pitchSpan, rotateDeg: 0 },
        { pitchDeg: pitchSpan, rotateDeg: 0 },
        { pitchDeg: 0, rotateDeg: -rotateSpan },
        { pitchDeg: 0, rotateDeg: rotateSpan },
      ]);
    }
    case "grid9": {
      const pitchSpan = options.pitchSpan ?? 9;
      const rotateSpan = options.rotateSpan ?? 3;
      return arcKnobGrid([-pitchSpan, 0, pitchSpan], [-rotateSpan, 0, rotateSpan]);
    }
    case "pitch3": {
      // Pitch-only 3-probe design: rotate axis is never perturbed, so its span
      // is 0 and the proposer's rotate loop self-collapses (aim.ts). The three
      // pitch rows exactly identify a pitch-only quadratic (see pitchQuadraticFeatures).
      const pitchSpan = options.pitchSpan ?? 8.5;
      return dedupeArcKnobs([
        { pitchDeg: 0, rotateDeg: 0 },
        { pitchDeg: -pitchSpan, rotateDeg: 0 },
        { pitchDeg: pitchSpan, rotateDeg: 0 },
      ]);
    }
  }
}

export function parseArcProbeDesignName(name: string): ArcProbeDesignName {
  if (name === "cross5" || name === "grid9" || name === "pitch3") return name;
  throw new Error(`unknown arc probe design "${name}" (expected cross5, grid9 or pitch3)`);
}

export function arcProbeDesignMinRows(name: ArcProbeDesignName): number {
  switch (name) {
    case "grid9":
      return 6;
    case "pitch3":
      return 3;
    case "cross5":
      return 5;
  }
}

export function arcKnobGrid(pitches: readonly number[], rotates: readonly number[]): ArcKnobs[] {
  const out: ArcKnobs[] = [];
  for (const pitchDeg of pitches) {
    for (const rotateDeg of rotates) out.push({ pitchDeg, rotateDeg });
  }
  return dedupeArcKnobs(out);
}

export function arcKnobSpan(knobs: readonly ArcKnobs[]): { pitchDeg: number; rotateDeg: number } {
  let pitchDeg = 0;
  let rotateDeg = 0;
  for (const knob of knobs) {
    pitchDeg = Math.max(pitchDeg, Math.abs(knob.pitchDeg));
    rotateDeg = Math.max(rotateDeg, Math.abs(knob.rotateDeg));
  }
  return { pitchDeg, rotateDeg };
}

export function dedupeArcKnobs(knobs: readonly ArcKnobs[]): ArcKnobs[] {
  const seen = new Set<string>();
  const out: ArcKnobs[] = [];
  for (const k of knobs) {
    const key = arcKnobKey(k);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ pitchDeg: k.pitchDeg, rotateDeg: k.rotateDeg });
  }
  return out;
}

export function arcKnobKey(k: ArcKnobs): string {
  return `${roundKnobKey(k.pitchDeg)},${roundKnobKey(k.rotateDeg)}`;
}

function roundKnobKey(n: number): string {
  return n.toFixed(6);
}

export function linearArcFeatures(knobs: ArcKnobs): number[] {
  return [1, knobs.pitchDeg, knobs.rotateDeg];
}

export function additiveQuadraticFeatures(knobs: ArcKnobs): number[] {
  const p = knobs.pitchDeg;
  const r = knobs.rotateDeg;
  return [1, p, r, p * p, r * r];
}

/** Pitch-only quadratic: 3 features → 3 pitch3 rows give an EXACT fit. Rotate
 *  is ignored on purpose (the pitch3 design never perturbs it and the sweep
 *  never proposes it), so predictions at rotateDeg≠0 simply read the pitch curve. */
export function pitchQuadraticFeatures(knobs: ArcKnobs): number[] {
  const p = knobs.pitchDeg;
  return [1, p, p * p];
}

/** Pitch-only linear: the 2-row floor for pitch3 — when one probe row gate-fails
 *  and leaves only 2 finite rows, the quadratic (3 features) can't be identified. */
export function pitchLinearFeatures(knobs: ArcKnobs): number[] {
  return [1, knobs.pitchDeg];
}

export function jointQuadraticFeatures(knobs: ArcKnobs): number[] {
  const p = knobs.pitchDeg;
  const r = knobs.rotateDeg;
  return [1, p, r, p * p, p * r, r * r];
}

export function biquadraticFeatures(knobs: ArcKnobs): number[] {
  const p = knobs.pitchDeg / 9;
  const r = knobs.rotateDeg / 3;
  return [1, p, r, p * p, p * r, r * r, p * p * r, p * r * r, p * p * r * r];
}

export function fitArcResponseOutputModel(
  modelName: ArcResponseModelName,
  rows: Array<{ knobs: ArcKnobs; value: number }>,
  output: string,
  probeDesignName: ArcProbeDesignName,
): FittedArcOutputModel | null {
  switch (modelName) {
    case "linear":
      return fitLinearArcOutput(rows, linearArcFeatures, "linear");
    case "additive_quadratic":
      return fitLinearArcOutput(rows, additiveQuadraticFeatures, "additive_quadratic");
    case "joint_quadratic":
      return fitLinearArcOutput(rows, jointQuadraticFeatures, "joint_quadratic");
    case "surface": {
      const model = fitKnobSurfaceModel(rows, arcProbeDesignMinRows(probeDesignName));
      return model === null ? null : {
        predict: (knobs) => predictKnobSurfaceModel(model, knobs),
        form: "surface",
        degraded: false,
      };
    }
    case "hybrid":
      return fitHybridArcOutput(rows, output, probeDesignName);
  }
}

function fitLinearArcOutput(
  rows: Array<{ knobs: ArcKnobs; value: number }>,
  features: (knobs: ArcKnobs) => number[],
  form: ArcResponseFitForm,
): FittedArcOutputModel | null {
  const model = fitLinearLeastSquares(rows.map((row) => ({ features: features(row.knobs), value: row.value })));
  return model === null ? null : {
    predict: makeLinearArcPredictor(model, features, form),
    form,
    degraded: false,
  };
}

function makeLinearArcPredictor(
  model: LinearModel,
  features: (knobs: ArcKnobs) => number[],
  form: ArcResponseFitForm,
): (knobs: ArcKnobs) => number {
  const c = model.coefficients;
  switch (form) {
    case "linear": {
      if (c.length !== 3) break;
      const [c0, c1, c2] = c;
      return (knobs) => {
        let y = 0;
        y += c0 * 1;
        y += c1 * knobs.pitchDeg;
        y += c2 * knobs.rotateDeg;
        return y;
      };
    }
    case "additive_quadratic": {
      if (c.length !== 5) break;
      const [c0, c1, c2, c3, c4] = c;
      return (knobs) => {
        const p = knobs.pitchDeg;
        const r = knobs.rotateDeg;
        const pp = p * p;
        const rr = r * r;
        let y = 0;
        y += c0 * 1;
        y += c1 * p;
        y += c2 * r;
        y += c3 * pp;
        y += c4 * rr;
        return y;
      };
    }
    case "joint_quadratic": {
      if (c.length !== 6) break;
      const [c0, c1, c2, c3, c4, c5] = c;
      return (knobs) => {
        const p = knobs.pitchDeg;
        const r = knobs.rotateDeg;
        const pp = p * p;
        const pr = p * r;
        const rr = r * r;
        let y = 0;
        y += c0 * 1;
        y += c1 * p;
        y += c2 * r;
        y += c3 * pp;
        y += c4 * pr;
        y += c5 * rr;
        return y;
      };
    }
    case "biquadratic": {
      if (c.length !== 9) break;
      const [c0, c1, c2, c3, c4, c5, c6, c7, c8] = c;
      return (knobs) => {
        const p = knobs.pitchDeg / 9;
        const r = knobs.rotateDeg / 3;
        const pp = p * p;
        const pr = p * r;
        const rr = r * r;
        const ppr = pp * r;
        const prr = pr * r;
        const pprr = ppr * r;
        let y = 0;
        y += c0 * 1;
        y += c1 * p;
        y += c2 * r;
        y += c3 * pp;
        y += c4 * pr;
        y += c5 * rr;
        y += c6 * ppr;
        y += c7 * prr;
        y += c8 * pprr;
        return y;
      };
    }
    case "pitch_quadratic": {
      if (c.length !== 3) break;
      const [c0, c1, c2] = c;
      return (knobs) => {
        const p = knobs.pitchDeg;
        const pp = p * p;
        let y = 0;
        y += c0 * 1;
        y += c1 * p;
        y += c2 * pp;
        return y;
      };
    }
    case "pitch_linear": {
      if (c.length !== 2) break;
      const [c0, c1] = c;
      return (knobs) => {
        let y = 0;
        y += c0 * 1;
        y += c1 * knobs.pitchDeg;
        return y;
      };
    }
    case "surface":
      break;
  }
  return (knobs) => predictLinearModel(model, features(knobs));
}

/** The production per-output fit: the richest functional form the rows can
 * IDENTIFY. The first entry tried is the historically validated first-choice
 * form for this output/design; when gate-failed probe rows leave too few
 * finite rows for it (each fitter returns null below its row requirement),
 * the fit falls down the ladder instead of disappearing. The linear floor
 * (3 rows) makes the old failure mode — one gate-failed probe row silently
 * deleting an output model, and with it the current-gap term of the sweep
 * objective (empty axis-quality defaults to 1) — impossible by construction.
 * Fully gate-clean pools take the first-choice branch and stay bit-identical
 * to the pre-ladder behavior. Any below-first-choice fit is flagged
 * `degraded` and surfaces in compile stats (`aim.joint_fit_degraded_outputs`). */
function fitHybridArcOutput(
  rows: Array<{ knobs: ArcKnobs; value: number }>,
  output: string,
  probeDesignName: ArcProbeDesignName,
): FittedArcOutputModel | null {
  // pitch3 has only a pitch axis and three rows. Cross/grid feature sets are
  // underidentified here, while a three-point pitch quadratic is exact for
  // every direct output and has a deterministic two-row linear fallback.
  if (probeDesignName === "pitch3") {
    const ladder: Array<[ArcResponseFitForm, (knobs: ArcKnobs) => number[]]> = [
      ["pitch_quadratic", pitchQuadraticFeatures], // 3 rows = exact
      ["pitch_linear", pitchLinearFeatures], // 2-row floor (one row gate-failed)
    ];
    let firstChoice = true;
    for (const [form, features] of ladder) {
      const fitted = fitLinearArcOutput(rows, features, form);
      if (fitted !== null) return firstChoice ? fitted : { ...fitted, degraded: true };
      firstChoice = false;
    }
    return null;
  }

  const ladder: Array<[ArcResponseFitForm, (knobs: ArcKnobs) => number[]]> = [];
  const wantsSurface = hybridUsesSurface(output, probeDesignName);
  if (wantsSurface) {
    const model = fitKnobSurfaceModel(rows, arcProbeDesignMinRows(probeDesignName));
    if (model !== null) {
      return {
        predict: (knobs) => predictKnobSurfaceModel(model, knobs),
        form: "surface",
        degraded: false,
      };
    }
  } else if (hybridUsesBiquadratic(output, probeDesignName)) {
    ladder.push(["biquadratic", biquadraticFeatures]);
  }
  if (probeDesignName === "grid9") ladder.push(["joint_quadratic", jointQuadraticFeatures]);
  ladder.push(["additive_quadratic", additiveQuadraticFeatures]);
  ladder.push(["linear", linearArcFeatures]);
  let firstChoice = !wantsSurface;
  for (const [form, features] of ladder) {
    const fitted = fitLinearArcOutput(rows, features, form);
    if (fitted !== null) return firstChoice ? fitted : { ...fitted, degraded: true };
    firstChoice = false;
  }
  return null;
}

const HYBRID_SURFACE_CURRENT_AXES = ["air", "elevation", "impact"] as const;
const HYBRID_SURFACE_CURRENT_OUTPUTS = new Set<string>(
  HYBRID_SURFACE_CURRENT_AXES.flatMap((axis) => [`current.error.${axis}`, `current.axis.${axis}`]),
);
const HYBRID_SURFACE_NEXT_OUTPUTS_BY_DESIGN = {
  cross5: new Set(["next.sledPoseRateDegPerFrame"]),
  grid9: new Set(["next.sledPoseDeg", "next.sledPoseRateDegPerFrame"]),
  pitch3: new Set(["next.sledPoseDeg", "next.sledPoseRateDegPerFrame"]),
} satisfies Record<ArcProbeDesignName, ReadonlySet<string>>;
const GRID9_BIQUADRATIC_NEXT_OUTPUT_EXCLUSIONS = new Set([
  "next.sledPoseDeg",
  "next.sledPoseRateDegPerFrame",
]);

function hybridUsesBiquadratic(output: string, probeDesignName: ArcProbeDesignName): boolean {
  return probeDesignName === "grid9" &&
    output.startsWith("next.") &&
    !GRID9_BIQUADRATIC_NEXT_OUTPUT_EXCLUSIONS.has(output);
}

function hybridUsesSurface(output: string, probeDesignName: ArcProbeDesignName): boolean {
  return HYBRID_SURFACE_CURRENT_OUTPUTS.has(output) ||
    HYBRID_SURFACE_NEXT_OUTPUTS_BY_DESIGN[probeDesignName].has(output);
}

export function fitJointArcResponseModel(
  rows: readonly JointArcProbeRow[],
  probeDesignName: ArcProbeDesignName,
  modelName: ArcResponseModelName = "hybrid",
  options: JointArcResponseFitOptions,
): JointArcResponseModel {
  const outputModels = fitJointValueModels(
    rows,
    jointArcOutputKeys(rows),
    probeDesignName,
    modelName,
  );
  return {
    context: options.context,
    outputModels,
    scoreReadout: buildJointArcScoreReadoutModels(outputModels),
  };
}

function buildJointArcScoreReadoutModels(
  outputModels: JointArcResponseModel["outputModels"],
): JointArcScoreReadoutModels {
  return {
    outputAir: outputModels.get("current.axis.air"),
    outputSpeed: outputModels.get("current.axis.speed"),
    outputGrain: outputModels.get("current.axis.grain"),
    outputElevation: outputModels.get("current.axis.elevation"),
    outputAmplitude: outputModels.get("current.axis.amplitude"),
    outputImpact: outputModels.get("current.axis.impact"),
    outputExitFrame: outputModels.get("exit.frame"),
    outputExitSpeed: outputModels.get("exit.speed"),
    outputNextX: outputModels.get("next.x"),
    outputNextY: outputModels.get("next.y"),
    outputNextVx: outputModels.get("next.vx"),
    outputNextVy: outputModels.get("next.vy"),
    outputNextSledPoseDeg: outputModels.get("next.sledPoseDeg"),
    outputNextSledPoseRateDegPerFrame: outputModels.get("next.sledPoseRateDegPerFrame"),
    outputNextMeanSpeedPx: outputModels.get("next.meanSpeedPx"),
    outputNextAirFraction: outputModels.get("next.airFraction"),
    outputNextGapFrameCount: outputModels.get("next.frameCount"),
    outputNextElevation: outputModels.get("next.elevation"),
  };
}

function fitJointValueModels(
  rows: readonly JointArcProbeRow[],
  keys: readonly string[],
  probeDesignName: ArcProbeDesignName,
  modelName: ArcResponseModelName,
  skipKey?: (key: string) => boolean,
): JointArcResponseModel["outputModels"] {
  const models: JointArcResponseModel["outputModels"] = new Map();
  const baseline = rows.find((r) => r.knobs.pitchDeg === 0 && r.knobs.rotateDeg === 0);
  for (const output of keys) {
    if (skipKey?.(output) === true) continue;
    const angle = isArcAngleOutput(output);
    const finiteRows = rows.filter((r) => Number.isFinite(r.outputs[output]));
    if (finiteRows.length === 0) continue;
    const baselineValue = baseline?.outputs[output];
    const fallbackRef = finiteRows[0].outputs[output];
    const ref = typeof baselineValue === "number" && Number.isFinite(baselineValue) ? baselineValue : fallbackRef;
    const fitRows = finiteRows.map((r) => {
      const value = r.outputs[output];
      return {
        knobs: r.knobs,
        value: angle ? unwrapAngleAround(value, ref) : value,
      };
    });
    const model = fitArcResponseOutputModel(modelName, fitRows, output, probeDesignName);
    if (model !== null) models.set(output, { angle, ref, model });
  }
  return models;
}

function jointArcOutputKeys(rows: readonly JointArcProbeRow[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.outputs)) keys.add(key);
  }
  return [...keys].sort();
}

export function predictJointArcOutputs(model: JointArcResponseModel, knobs: ArcKnobs): Record<string, number> {
  const direct: Record<string, number> = {};
  predictFittedValuesInto(model.outputModels, knobs, direct);
  return completeArcPrediction(direct, model.context);
}

/**
 * Complete the canonical prediction vector consumed by an aiming controller.
 * Every model predicts the same direct physical/scorer outputs.
 */
export function completeArcPrediction(
  directOutputs: Readonly<Record<string, number>>,
  context: JointArcResponseContext,
): Record<string, number> {
  const outputs = { ...directOutputs };
  const computedCost = currentCostFromPredictedAxes(outputs, context.gap);
  if (computedCost !== null) outputs["current.cost"] = computedCost;
  return outputs;
}

/** Read objective-facing values from an already-completed response vector. */
export function scoreCompletedArcPrediction(
  outputs: Readonly<Record<string, number>>,
  currentTargets: AxisValues,
  scoreAxes: JointArcCurrentScoreAxes = jointArcCurrentScoreAxes(currentTargets),
): JointArcScoreReadout {
  const air = scoreAxes.air ? outputs["current.axis.air"] : NaN;
  const speed = scoreAxes.speed ? outputs["current.axis.speed"] : NaN;
  const grain = scoreAxes.grain ? outputs["current.axis.grain"] : NaN;
  const elevation = scoreAxes.elevation ? outputs["current.axis.elevation"] : NaN;
  const amplitude = scoreAxes.amplitude ? outputs["current.axis.amplitude"] : NaN;
  const impact = scoreAxes.impact ? outputs["current.axis.impact"] : NaN;
  return {
    currentQuality: currentQualityFromAxisValues(
      currentTargets,
      air,
      speed,
      grain,
      elevation,
      amplitude,
      impact,
      scoreAxes,
    ),
    state: predictedIncomingKinematics(outputs as Record<string, number>),
    exitFrame: outputs["exit.frame"] ?? NaN,
    exitSpeed: outputs["exit.speed"] ?? NaN,
    nextMeanSpeedPx: outputs["next.meanSpeedPx"] ?? NaN,
    nextAirFraction: outputs["next.airFraction"] ?? NaN,
    nextGapFrameCount: outputs["next.frameCount"] ?? NaN,
    nextElevation: outputs["next.elevation"] ?? NaN,
  };
}

export function predictJointArcScoreReadout(
  model: JointArcResponseModel,
  knobs: ArcKnobs,
  currentTargets: AxisValues,
  scoreAxes: JointArcCurrentScoreAxes = jointArcCurrentScoreAxes(currentTargets),
): JointArcScoreReadout {
  const readout = model.scoreReadout;
  const scoreAir = scoreAxes.air;
  const scoreSpeed = scoreAxes.speed;
  const scoreGrain = scoreAxes.grain;
  const scoreElevation = scoreAxes.elevation;
  const scoreAmplitude = scoreAxes.amplitude;
  const scoreImpact = scoreAxes.impact;

  let air = scoreAir ? predictEntryValue(readout.outputAir, knobs) : NaN;
  let speedAxis = scoreSpeed ? predictEntryValue(readout.outputSpeed, knobs) : NaN;
  const grain = scoreGrain ? predictEntryValue(readout.outputGrain, knobs) : NaN;
  let elevation = scoreElevation ? predictEntryValue(readout.outputElevation, knobs) : NaN;
  const amplitude = scoreAmplitude ? predictEntryValue(readout.outputAmplitude, knobs) : NaN;
  const impact = scoreImpact ? predictEntryValue(readout.outputImpact, knobs) : NaN;

  const state = predictedIncomingKinematicsFromDirectOutputs(readout, knobs);
  let exitFrame = predictEntryValue(readout.outputExitFrame, knobs);
  let exitSpeed = predictEntryValue(readout.outputExitSpeed, knobs);
  const nextMeanSpeedPx = predictEntryValue(
    readout.outputNextMeanSpeedPx,
    knobs,
  );
  const nextAirFraction = predictEntryValue(
    readout.outputNextAirFraction,
    knobs,
  );
  const nextGapFrameCount = predictEntryValue(
    readout.outputNextGapFrameCount,
    knobs,
  );
  const nextElevation = predictEntryValue(readout.outputNextElevation, knobs);

  return {
    currentQuality: currentQualityFromAxisValues(
      currentTargets,
      air,
      speedAxis,
      grain,
      elevation,
      amplitude,
      impact,
      scoreAxes,
    ),
    state,
    exitFrame,
    exitSpeed,
    nextMeanSpeedPx,
    nextAirFraction,
    nextGapFrameCount,
    nextElevation,
  };
}

export function jointArcCurrentScoreAxes(targets: AxisValues): JointArcCurrentScoreAxes {
  return {
    air: shouldScoreCurrentAxis(targets, "air"),
    speed: shouldScoreCurrentAxis(targets, "speed"),
    grain: shouldScoreCurrentAxis(targets, "grain"),
    elevation: shouldScoreCurrentAxis(targets, "elevation"),
    amplitude: shouldScoreCurrentAxis(targets, "amplitude"),
    impact: shouldScoreCurrentAxis(targets, "impact"),
  };
}

function shouldScoreCurrentAxis(targets: AxisValues, axis: string): boolean {
  return !REPORT_ONLY_AXIS_SET.has(axis) && Number.isFinite(targets[axis as keyof AxisValues]);
}

function predictFittedValuesInto(
  models: JointArcResponseModel["outputModels"],
  knobs: ArcKnobs,
  values: Record<string, number>,
): void {
  for (const [output, fitted] of models) {
    const pred = fitted.model.predict(knobs);
    values[output] = fitted.angle ? unwrapAngleAround(pred, fitted.ref) : pred;
  }
}

function predictEntryValue(fitted: FittedArcOutputEntry | undefined, knobs: ArcKnobs): number {
  if (fitted === undefined) return NaN;
  const pred = fitted.model.predict(knobs);
  return fitted.angle ? unwrapAngleAround(pred, fitted.ref) : pred;
}

function currentCostFromPredictedAxes(outputs: Record<string, number>, gap: Gap): number | null {
  let cost = 0;
  let hasTargetedAxis = false;
  const targets = gap.targets;
  const airTarget = targets.air;
  const air = outputs["current.axis.air"];
  if (airTarget !== undefined && Number.isFinite(air)) {
    const d = airTarget - air;
    cost += d * d;
    hasTargetedAxis = true;
  }
  const speedTarget = targets.speed;
  const speed = outputs["current.axis.speed"];
  if (speedTarget !== undefined && Number.isFinite(speed)) {
    const d = speedTarget - speed;
    cost += d * d;
    hasTargetedAxis = true;
  }
  const grainTarget = targets.grain;
  const grain = outputs["current.axis.grain"];
  if (grainTarget !== undefined && Number.isFinite(grain)) {
    const d = grainTarget - grain;
    cost += d * d;
    hasTargetedAxis = true;
  }
  const elevationTarget = targets.elevation;
  const elevation = outputs["current.axis.elevation"];
  if (elevationTarget !== undefined && Number.isFinite(elevation)) {
    const d = elevationTarget - elevation;
    cost += d * d;
    hasTargetedAxis = true;
  }
  const amplitudeTarget = targets.amplitude;
  const amplitude = outputs["current.axis.amplitude"];
  if (amplitudeTarget !== undefined && Number.isFinite(amplitude)) {
    const d = amplitudeTarget - amplitude;
    cost += d * d;
    hasTargetedAxis = true;
  }
  const impactTarget = targets.impact;
  const impact = outputs["current.axis.impact"];
  if (impactTarget !== undefined && Number.isFinite(impact)) {
    const d = impactTarget - impact;
    cost += LOCAL_IMPACT_COST_WEIGHT * d * d;
    hasTargetedAxis = true;
  }
  return hasTargetedAxis ? cost : null;
}

export function stateOutputs(state: RiderArrivalState): Record<string, number> {
  const outputs: Record<string, number> = {};
  addStateOutputs(outputs, state);
  return outputs;
}

function addStateOutputs(outputs: Record<string, number>, state: RiderArrivalState): void {
  if (Number.isFinite(state.x)) outputs["next.x"] = state.x;
  if (Number.isFinite(state.y)) outputs["next.y"] = state.y;
  if (Number.isFinite(state.vx)) outputs["next.vx"] = state.vx;
  if (Number.isFinite(state.vy)) outputs["next.vy"] = state.vy;
  if (state.sledPoseDeg !== null && Number.isFinite(state.sledPoseDeg)) outputs["next.sledPoseDeg"] = state.sledPoseDeg;
  if (state.sledPoseRateDegPerFrame !== null && Number.isFinite(state.sledPoseRateDegPerFrame)) {
    outputs["next.sledPoseRateDegPerFrame"] = state.sledPoseRateDegPerFrame;
  }
}

export function arcResponseOutputs(
  targets: AxisValues,
  achieved: AxisValues,
  cost: number | null | undefined,
  nextState: RiderArrivalState | null,
): Record<string, number> {
  const outputs: Record<string, number> = {};
  if (cost !== null && cost !== undefined && Number.isFinite(cost)) outputs["current.cost"] = cost;
  addAxisResponseOutputs(outputs, targets, achieved);
  if (nextState !== null) addStateOutputs(outputs, nextState);
  return outputs;
}

function axisResponseOutputs(
  targets: AxisValues,
  achieved: AxisValues,
): Record<string, number> {
  const outputs: Record<string, number> = {};
  addAxisResponseOutputs(outputs, targets, achieved);
  return outputs;
}

function addAxisResponseOutputs(
  outputs: Record<string, number>,
  targets: AxisValues,
  achieved: AxisValues,
): void {
  const air = achieved.air;
  if (Number.isFinite(air)) {
    outputs["current.axis.air"] = air;
    const target = targets.air;
    if (target !== undefined) {
      const error = air - target;
      if (Number.isFinite(error)) outputs["current.error.air"] = error;
    }
  }

  const speed = achieved.speed;
  if (Number.isFinite(speed)) {
    outputs["current.axis.speed"] = speed;
    const target = targets.speed;
    if (target !== undefined) {
      const error = speed - target;
      if (Number.isFinite(error)) outputs["current.error.speed"] = error;
    }
  }

  const grain = achieved.grain;
  if (Number.isFinite(grain)) {
    outputs["current.axis.grain"] = grain;
    const target = targets.grain;
    if (target !== undefined) {
      const error = grain - target;
      if (Number.isFinite(error)) outputs["current.error.grain"] = error;
    }
  }

  const elevation = achieved.elevation;
  if (Number.isFinite(elevation)) {
    outputs["current.axis.elevation"] = elevation;
    const target = targets.elevation;
    if (target !== undefined) {
      const error = elevation - target;
      if (Number.isFinite(error)) outputs["current.error.elevation"] = error;
    }
  }

  const amplitude = achieved.amplitude;
  if (Number.isFinite(amplitude)) {
    outputs["current.axis.amplitude"] = amplitude;
    const target = targets.amplitude;
    if (target !== undefined) {
      const error = amplitude - target;
      if (Number.isFinite(error)) outputs["current.error.amplitude"] = error;
    }
  }

  const impact = achieved.impact;
  if (Number.isFinite(impact)) {
    outputs["current.axis.impact"] = impact;
    const target = targets.impact;
    if (target !== undefined) {
      const error = impact - target;
      if (Number.isFinite(error)) outputs["current.error.impact"] = error;
    }
  }
}

export function predictedCurrentAxes(outputs: Record<string, number>): AxisValues {
  const axes: AxisValues = {};
  for (const axis of AXES) {
    const value = outputs[`current.axis.${axis}`];
    if (Number.isFinite(value)) axes[axis] = value;
  }
  return axes;
}

export function predictedCurrentQuality(outputs: Record<string, number>, targets: AxisValues): number {
  return currentQualityFromAxisValues(
    targets,
    outputs["current.axis.air"],
    outputs["current.axis.speed"],
    outputs["current.axis.grain"],
    outputs["current.axis.elevation"],
    outputs["current.axis.amplitude"],
    outputs["current.axis.impact"],
  );
}

function currentQualityFromAxisValues(
  targets: AxisValues,
  air: number,
  speed: number,
  grain: number,
  elevation: number,
  amplitude: number,
  impact: number,
  scoreAxes: JointArcCurrentScoreAxes = jointArcCurrentScoreAxes(targets),
): number {
  const scoredTargets: AxisValues = {};
  const achieved: AxisValues = {};
  for (const axis of AXES) {
    if (!scoreAxes[axis]) continue;
    const target = targets[axis];
    if (target === undefined || !Number.isFinite(target)) continue;
    /* The six values arrive as arguments; packing them into an object per call
     * just to read one back out by name allocated once per scored candidate.
     * An unknown axis still reads as NaN, exactly as the absent object key did. */
    let value: number;
    switch (axis) {
      case "air": value = air; break;
      case "speed": value = speed; break;
      case "grain": value = grain; break;
      case "elevation": value = elevation; break;
      case "amplitude": value = amplitude; break;
      case "impact": value = impact; break;
      default: value = NaN; break;
    }
    if (!Number.isFinite(value)) return NaN;
    scoredTargets[axis] = target;
    achieved[axis] = value;
  }
  return axisQualityForTargets(scoredTargets, achieved).axis_quality;
}

export function predictedArrivalState(outputs: Record<string, number>): RiderArrivalState | null {
  const x = outputs["next.x"];
  const y = outputs["next.y"];
  const vx = outputs["next.vx"];
  const vy = outputs["next.vy"];
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(vx) || !Number.isFinite(vy)) return null;
  const speed = Math.hypot(vx, vy);
  if (!Number.isFinite(speed)) return null;
  const comAngleDeg = speed > 0
    ? Math.atan2(vy, vx) * 180 / Math.PI
    : null;
  const sledPoseDeg = Number.isFinite(outputs["next.sledPoseDeg"]) ? outputs["next.sledPoseDeg"] : null;
  const sledPoseRateDegPerFrame = Number.isFinite(outputs["next.sledPoseRateDegPerFrame"])
    ? outputs["next.sledPoseRateDegPerFrame"]
    : null;
  return { x, y, vx, vy, speed, comAngleDeg, sledPoseDeg, sledPoseRateDegPerFrame };
}

export function predictedIncomingKinematics(
  outputs: Record<string, number>,
): IncomingKinematics | null {
  const vx = outputs["next.vx"];
  const vy = outputs["next.vy"];
  if (!Number.isFinite(vx) || !Number.isFinite(vy)) return null;
  const state = predictedArrivalState(outputs);
  if (state !== null) return incomingKinematics(state);
  const speed = Math.hypot(vx, vy);
  if (!Number.isFinite(speed)) return null;
  return {
    vx,
    vy,
    speed,
    comAngleDeg: speed > 0
      ? Math.atan2(vy, vx) * 180 / Math.PI
      : null,
    sledPoseDeg: Number.isFinite(outputs["next.sledPoseDeg"])
      ? outputs["next.sledPoseDeg"]
      : null,
    sledPoseRateDegPerFrame:
      Number.isFinite(outputs["next.sledPoseRateDegPerFrame"])
        ? outputs["next.sledPoseRateDegPerFrame"]
        : null,
  };
}

function predictedIncomingKinematicsFromDirectOutputs(
  models: JointArcScoreReadoutModels,
  knobs: ArcKnobs,
): IncomingKinematics | null {
  const vx = predictEntryValue(models.outputNextVx, knobs);
  const vy = predictEntryValue(models.outputNextVy, knobs);
  if (!Number.isFinite(vx) || !Number.isFinite(vy)) return null;
  const speed = Math.hypot(vx, vy);
  if (!Number.isFinite(speed)) return null;
  const comAngleDeg = speed > 0
    ? Math.atan2(vy, vx) * 180 / Math.PI
    : null;
  const sledPoseDeg = predictOptionalEntryValue(models.outputNextSledPoseDeg, knobs);
  const sledPoseRateDegPerFrame = predictOptionalEntryValue(models.outputNextSledPoseRateDegPerFrame, knobs);
  return { vx, vy, speed, comAngleDeg, sledPoseDeg, sledPoseRateDegPerFrame };
}

function predictOptionalEntryValue(
  fitted: FittedArcOutputEntry | undefined,
  knobs: ArcKnobs,
): number | null {
  const value = predictEntryValue(fitted, knobs);
  return Number.isFinite(value) ? value : null;
}

export function isArcAngleOutput(key: string): boolean {
  return key.endsWith(".comAngleDeg") || key.endsWith(".sledPoseDeg");
}

export function normalizeAngleDeg(x: number): number {
  let y = ((x + 180) % 360 + 360) % 360 - 180;
  if (y === -180) y = 180;
  return y;
}

export function unwrapAngleAround(value: number, ref: number): number {
  return ref + normalizeAngleDeg(value - ref);
}

export function addFinite(outputs: Record<string, number>, key: string, value: number | null | undefined): void {
  if (value !== null && value !== undefined && Number.isFinite(value)) outputs[key] = value;
}

export function predictLinearModel(model: LinearModel, features: readonly number[]): number {
  let y = 0;
  for (let i = 0; i < model.coefficients.length; i++) y += model.coefficients[i] * features[i];
  return y;
}

export function fitKnobSurfaceModel(rows: Array<{ knobs: ArcKnobs; value: number }>, minRows: number): KnobSurfaceModel | null {
  if (rows.length < minRows) return null;
  const samples = rows
    .filter((row) => Number.isFinite(row.value))
    .map((row) => ({ knobs: { ...row.knobs }, value: row.value }));
  if (samples.length < minRows) return null;

  const valueByPitchRotate = new Map<number, Map<number, number>>();
  for (const sample of samples) {
    const pitchKey = surfaceKey(sample.knobs.pitchDeg);
    const rotateKey = surfaceKey(sample.knobs.rotateDeg);
    let row = valueByPitchRotate.get(pitchKey);
    if (row === undefined) {
      row = new Map();
      valueByPitchRotate.set(pitchKey, row);
    }
    // Preserve the previous Array.find semantics if duplicate probe keys appear.
    if (!row.has(rotateKey)) row.set(rotateKey, sample.value);
  }
  return {
    samples,
    pitches: sortedUnique(samples.map((sample) => sample.knobs.pitchDeg)),
    rotates: sortedUnique(samples.map((sample) => sample.knobs.rotateDeg)),
    valueByPitchRotate,
    pitchAxisSamples: surfaceAxisSamples(samples, "pitch"),
    rotateAxisSamples: surfaceAxisSamples(samples, "rotate"),
  };
}

export function predictKnobSurfaceModel(model: KnobSurfaceModel, knobs: ArcKnobs): number {
  const exact = surfaceValueAt(model, knobs.pitchDeg, knobs.rotateDeg);
  if (exact !== null) return exact;

  const pitches = model.pitches;
  const rotates = model.rotates;
  if (pitches.length >= 2 && rotates.length >= 2) {
    const [p0, p1] = bounds(pitches, knobs.pitchDeg);
    const [r0, r1] = bounds(rotates, knobs.rotateDeg);
    const v00 = surfaceValueAt(model, p0, r0);
    const v01 = surfaceValueAt(model, p0, r1);
    const v10 = surfaceValueAt(model, p1, r0);
    const v11 = surfaceValueAt(model, p1, r1);
    if (v00 !== null && v01 !== null && v10 !== null && v11 !== null) {
      const pt = p1 === p0 ? 0 : (knobs.pitchDeg - p0) / (p1 - p0);
      const rt = r1 === r0 ? 0 : (knobs.rotateDeg - r0) / (r1 - r0);
      const lo = v00 * (1 - rt) + v01 * rt;
      const hi = v10 * (1 - rt) + v11 * rt;
      return lo * (1 - pt) + hi * pt;
    }
  }

  const center = surfaceValueAt(model, 0, 0);
  const pitch = interpolateAxis(model.pitchAxisSamples, knobs.pitchDeg);
  const rotate = interpolateAxis(model.rotateAxisSamples, knobs.rotateDeg);
  if (center !== null && pitch !== null && rotate !== null) return pitch + rotate - center;
  return nearestSurfaceValue(model.samples, knobs);
}

function sortedUnique(xs: number[]): number[] {
  return [...new Set(xs.map((x) => x.toFixed(6)))].map(Number).sort((a, b) => a - b);
}

function bounds(xs: number[], x: number): [number, number] {
  let lo = xs[0];
  let hi = xs[xs.length - 1];
  for (const v of xs) {
    if (v <= x) lo = v;
    if (v >= x) {
      hi = v;
      break;
    }
  }
  return [lo, hi];
}

function surfaceKey(value: number): number {
  const scaled = value * 1_000_000;
  return scaled < 0 ? Math.ceil(scaled - 0.5) : Math.floor(scaled + 0.5);
}

function surfaceValueAt(model: KnobSurfaceModel, pitchDeg: number, rotateDeg: number): number | null {
  return model.valueByPitchRotate.get(surfaceKey(pitchDeg))?.get(surfaceKey(rotateDeg)) ?? null;
}

function surfaceAxisSamples(
  samples: Array<{ knobs: ArcKnobs; value: number }>,
  axis: "pitch" | "rotate",
): Array<{ x: number; value: number }> {
  return samples
    .filter((sample) => axis === "pitch" ? sample.knobs.rotateDeg === 0 : sample.knobs.pitchDeg === 0)
    .map((sample) => ({ x: axis === "pitch" ? sample.knobs.pitchDeg : sample.knobs.rotateDeg, value: sample.value }))
    .sort((a, b) => a.x - b.x);
}

function interpolateAxis(
  axisSamples: Array<{ x: number; value: number }>,
  value: number,
): number | null {
  if (axisSamples.length === 0) return null;
  if (value <= axisSamples[0].x) return axisSamples[0].value;
  for (let i = 1; i < axisSamples.length; i++) {
    const a = axisSamples[i - 1];
    const b = axisSamples[i];
    if (value <= b.x) {
      const t = (value - a.x) / (b.x - a.x);
      return a.value * (1 - t) + b.value * t;
    }
  }
  return axisSamples[axisSamples.length - 1].value;
}

function nearestSurfaceValue(samples: Array<{ knobs: ArcKnobs; value: number }>, knobs: ArcKnobs): number {
  let best = samples[0];
  let bestD = Infinity;
  for (const sample of samples) {
    const dp = sample.knobs.pitchDeg - knobs.pitchDeg;
    const dr = sample.knobs.rotateDeg - knobs.rotateDeg;
    const d = dp * dp + dr * dr;
    if (d < bestD) {
      best = sample;
      bestD = d;
    }
  }
  return best.value;
}

export function fitLinearLeastSquares(
  rows: Array<{ features: readonly number[]; value: number }>,
  ridge = 1e-9,
): LinearModel | null {
  if (rows.length === 0) return null;
  const dim = rows[0].features.length;
  if (rows.length < dim) return null;
  const ata = Array.from({ length: dim }, () => Array.from({ length: dim }, () => 0));
  const atb = Array.from({ length: dim }, () => 0);
  for (const row of rows) {
    if (row.features.length !== dim || !Number.isFinite(row.value)) return null;
    for (let i = 0; i < dim; i++) {
      const fi = row.features[i];
      atb[i] += fi * row.value;
      for (let j = 0; j < dim; j++) ata[i][j] += fi * row.features[j];
    }
  }
  for (let i = 0; i < dim; i++) ata[i][i] += ridge;
  const coefficients = solveLinearSystem(ata, atb);
  return coefficients === null ? null : { coefficients };
}

function solveLinearSystem(aIn: number[][], bIn: number[]): number[] | null {
  const n = bIn.length;
  const a = aIn.map((row, i) => [...row, bIn[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    if (pivot !== col) [a[pivot], a[col]] = [a[col], a[pivot]];
    const scale = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] /= scale;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = a[row][col];
      if (f === 0) continue;
      for (let j = col; j <= n; j++) a[row][j] -= f * a[col][j];
    }
  }
  return a.map((row) => row[n]);
}
