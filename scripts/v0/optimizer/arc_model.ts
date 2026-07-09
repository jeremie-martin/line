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
import {
  completeBallisticSpanAxesFromSummary,
  type BallisticAxisPrefixSummary,
  type BallisticAxisSuffix,
} from "../core/measure.ts";
import { LOCAL_IMPACT_COST_WEIGHT } from "../core/candidate.ts";
import { AXIS_QUALITY_TOLERANCE } from "../score.ts";

export type ArcKnobs = {
  /** Rotate the last third of the arc about the suffix joint, in degrees. */
  pitchDeg: number;
  /** Rotate the whole arc about its entry point, in degrees. */
  rotateDeg: number;
};

export type RiderArrivalState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  /** CoM velocity direction in degrees, positive = screen-down. */
  comAngleDeg: number | null;
  /** Sled TAIL->NOSE pose in degrees, positive = screen-down. */
  sledPoseDeg: number | null;
  /** Frame-to-frame sled-pose angular velocity in degrees/frame. */
  sledPoseRateDegPerFrame: number | null;
};

export function propagateBallisticArrivalState(
  state: RiderArrivalState,
  dtFrames: number,
): RiderArrivalState {
  return propagateBallisticArrivalStateFromValues(
    state.x,
    state.y,
    state.vx,
    state.vy,
    state.sledPoseDeg,
    state.sledPoseRateDegPerFrame,
    dtFrames,
  );
}

function propagateBallisticArrivalStateFromValues(
  stateX: number,
  stateY: number,
  stateVx: number,
  stateVy: number,
  stateSledPoseDeg: number | null,
  stateSledPoseRateDegPerFrame: number | null,
  dtFrames: number,
): RiderArrivalState {
  // Pure readout gravity, deliberately. A per-frame "effective gravity"
  // correction (+0.0084, from committed-track airborne stretches) was tried
  // and FALSIFIED on probe trajectories: the signed vy error vs full-sim
  // truth is CONSTANT across dt buckets (−0.021/−0.035/−0.025 for dt
  // <10/10-20/20-40), not linear in dt — the deviation is a launch-read
  // transient, corrected at the read (arc_probe.ts LAUNCH_VY_OFFSET_PX),
  // not an acceleration. The committed-track study's per-run mean dvy−g
  // telescopes to (vy(b)−vy(a))/(b−a), so a decaying post-launch transient
  // masquerades there as a per-frame bias.
  const dt = Math.max(0, Math.round(dtFrames));
  const g = ELEVATION.GRAVITY_PX_PER_FRAME2;
  const x = stateX + stateVx * dt;
  // lr-core's Verlet step applies gravity before the next frame's velocity read.
  const y = stateY + stateVy * dt + 0.5 * g * dt * (dt + 1);
  const vx = stateVx;
  const vy = stateVy + g * dt;
  const speed = Math.hypot(vx, vy);
  const comAngleDeg = speed > 0 ? Math.atan2(vy, vx) * 180 / Math.PI : null;
  const sledPoseDeg = stateSledPoseDeg !== null && stateSledPoseRateDegPerFrame !== null
    ? normalizeAngleDeg(stateSledPoseDeg + stateSledPoseRateDegPerFrame * dt)
    : stateSledPoseDeg;
  return {
    x,
    y,
    vx,
    vy,
    speed,
    comAngleDeg,
    sledPoseDeg,
    sledPoseRateDegPerFrame: stateSledPoseRateDegPerFrame,
  };
}

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
  outputNextSpeed?: FittedArcOutputEntry;
  outputNextComAngleDeg?: FittedArcOutputEntry;
  outputNextSledPoseDeg?: FittedArcOutputEntry;
  outputNextSledPoseRateDegPerFrame?: FittedArcOutputEntry;
  latentSuffixFrame?: FittedArcOutputEntry;
  latentSuffixX?: FittedArcOutputEntry;
  latentSuffixY?: FittedArcOutputEntry;
  latentSuffixVx?: FittedArcOutputEntry;
  latentSuffixVy?: FittedArcOutputEntry;
  latentSuffixSledPoseDeg?: FittedArcOutputEntry;
  latentSuffixSledPoseRateDegPerFrame?: FittedArcOutputEntry;
  latentPrefixAirFraction?: FittedArcOutputEntry;
  latentPrefixAirFrames?: FittedArcOutputEntry;
  latentPrefixSpeedMeanPx?: FittedArcOutputEntry;
  latentPrefixSpeedFrames?: FittedArcOutputEntry;
  latentPrefixSpeedSumPx?: FittedArcOutputEntry;
  latentPrefixDy?: FittedArcOutputEntry;
  latentPrefixV0SpeedPx?: FittedArcOutputEntry;
  hasLatent: boolean;
};

export type JointArcProbeRow = {
  knobs: ArcKnobs;
  outputs: Record<string, number>;
  latentOutputs?: Record<string, number>;
};

export type JointArcResponseModel = {
  context: JointArcResponseContext;
  outputModels: Map<string, FittedArcOutputEntry>;
  latentModels: Map<string, FittedArcOutputEntry>;
  scoreReadout: JointArcScoreReadoutModels;
};

export type JointArcScoreReadout = {
  currentQuality: number;
  state: RiderArrivalState | null;
  exitFrame: number;
  exitSpeed: number;
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
    predict: (knobs) => predictLinearModel(model, features(knobs)),
    form,
    degraded: false,
  };
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
  // pitch3 has only a pitch axis and 3 rows. The cross5/grid9 forms degenerate
  // here: additiveQuadraticFeatures is dim 5 (>3 rows → fitter returns null) and
  // linearArcFeatures carries an all-zero rotateDeg column (identified only via
  // the 1e-9 ridge — not relied on). The richer forms also buy nothing: under
  // short-mode production the reducer OWNS the current-axis outputs (clearReducer-
  // OwnedOutputs), and the pitch curve is the only live axis, so a single simple
  // pitch-only ladder applied uniformly to ALL outputs (latent and direct) is the
  // right, robust choice. No surface form under pitch3 (a pitch-only interpolator
  // adds nothing the 3-point quadratic doesn't already capture exactly).
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
  const latentModels = fitJointValueModels(
    rows,
    jointArcOutputKeys(rows, "latentOutputs"),
    "latentOutputs",
    probeDesignName,
    modelName,
  );
  const outputModels = fitJointValueModels(
    rows,
    jointArcOutputKeys(rows, "outputs"),
    "outputs",
    probeDesignName,
    modelName,
    latentModels.size > 0 ? reducerOwnsOutputKey : undefined,
  );
  return {
    context: options.context,
    outputModels,
    latentModels,
    scoreReadout: buildJointArcScoreReadoutModels(outputModels, latentModels),
  };
}

function buildJointArcScoreReadoutModels(
  outputModels: JointArcResponseModel["outputModels"],
  latentModels: JointArcResponseModel["latentModels"],
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
    outputNextSpeed: outputModels.get("next.speed"),
    outputNextComAngleDeg: outputModels.get("next.comAngleDeg"),
    outputNextSledPoseDeg: outputModels.get("next.sledPoseDeg"),
    outputNextSledPoseRateDegPerFrame: outputModels.get("next.sledPoseRateDegPerFrame"),
    latentSuffixFrame: latentModels.get("latent.suffix.frame"),
    latentSuffixX: latentModels.get("latent.suffix.x"),
    latentSuffixY: latentModels.get("latent.suffix.y"),
    latentSuffixVx: latentModels.get("latent.suffix.vx"),
    latentSuffixVy: latentModels.get("latent.suffix.vy"),
    latentSuffixSledPoseDeg: latentModels.get("latent.suffix.sledPoseDeg"),
    latentSuffixSledPoseRateDegPerFrame: latentModels.get("latent.suffix.sledPoseRateDegPerFrame"),
    latentPrefixAirFraction: latentModels.get("latent.prefix.airFraction"),
    latentPrefixAirFrames: latentModels.get("latent.prefix.airFrames"),
    latentPrefixSpeedMeanPx: latentModels.get("latent.prefix.speedMeanPx"),
    latentPrefixSpeedFrames: latentModels.get("latent.prefix.speedFrames"),
    latentPrefixSpeedSumPx: latentModels.get("latent.prefix.speedSumPx"),
    latentPrefixDy: latentModels.get("latent.prefix.dy"),
    latentPrefixV0SpeedPx: latentModels.get("latent.prefix.v0SpeedPx"),
    hasLatent: latentModels.size > 0,
  };
}

type JointArcValueSource = "outputs" | "latentOutputs";

function fitJointValueModels(
  rows: readonly JointArcProbeRow[],
  keys: readonly string[],
  source: JointArcValueSource,
  probeDesignName: ArcProbeDesignName,
  modelName: ArcResponseModelName,
  skipKey?: (key: string) => boolean,
): JointArcResponseModel["outputModels"] {
  const models: JointArcResponseModel["outputModels"] = new Map();
  const baseline = rows.find((r) => r.knobs.pitchDeg === 0 && r.knobs.rotateDeg === 0);
  for (const output of keys) {
    if (skipKey?.(output) === true) continue;
    const angle = isArcAngleOutput(output);
    const finiteRows = rows.filter((r) => Number.isFinite(valueFromRow(r, source, output)));
    if (finiteRows.length === 0) continue;
    const baselineValue = baseline === undefined ? undefined : valueFromRow(baseline, source, output);
    const fallbackRef = valueFromRow(finiteRows[0], source, output);
    const ref = typeof baselineValue === "number" && Number.isFinite(baselineValue) ? baselineValue : fallbackRef;
    const fitRows = finiteRows.map((r) => {
      const value = valueFromRow(r, source, output);
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

function valueFromRow(row: JointArcProbeRow, source: JointArcValueSource, key: string): number {
  const values = source === "outputs" ? row.outputs : row.latentOutputs;
  return values?.[key] ?? NaN;
}

function jointArcOutputKeys(rows: readonly JointArcProbeRow[], source: JointArcValueSource): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    const values = source === "outputs" ? row.outputs : row.latentOutputs;
    for (const key of Object.keys(values ?? {})) keys.add(key);
  }
  return [...keys].sort();
}

export function predictJointArcOutputs(model: JointArcResponseModel, knobs: ArcKnobs): Record<string, number> {
  const outputs: Record<string, number> = {};
  predictFittedValuesInto(model.outputModels, knobs, outputs);
  if (model.latentModels.size > 0) clearReducerOwnedOutputs(outputs);
  const latent: Record<string, number> = {};
  predictFittedValuesInto(model.latentModels, knobs, latent);
  reduceLatentJointArcOutputsInto(latent, model.context, outputs);
  const computedCost = currentCostFromPredictedAxes(outputs, model.context.gap);
  if (computedCost !== null) outputs["current.cost"] = computedCost;
  return outputs;
}

export function predictJointArcScoreReadout(
  model: JointArcResponseModel,
  knobs: ArcKnobs,
  currentTargets: AxisValues,
): JointArcScoreReadout {
  const readout = model.scoreReadout;
  const scoreAir = shouldScoreCurrentAxis(currentTargets, "air");
  const scoreSpeed = shouldScoreCurrentAxis(currentTargets, "speed");
  const scoreGrain = shouldScoreCurrentAxis(currentTargets, "grain");
  const scoreElevation = shouldScoreCurrentAxis(currentTargets, "elevation");
  const scoreAmplitude = shouldScoreCurrentAxis(currentTargets, "amplitude");
  const scoreImpact = shouldScoreCurrentAxis(currentTargets, "impact");

  let air = scoreAir ? predictEntryValue(readout.outputAir, knobs) : NaN;
  let speedAxis = scoreSpeed ? predictEntryValue(readout.outputSpeed, knobs) : NaN;
  const grain = scoreGrain ? predictEntryValue(readout.outputGrain, knobs) : NaN;
  let elevation = scoreElevation ? predictEntryValue(readout.outputElevation, knobs) : NaN;
  const amplitude = scoreAmplitude ? predictEntryValue(readout.outputAmplitude, knobs) : NaN;
  const impact = scoreImpact ? predictEntryValue(readout.outputImpact, knobs) : NaN;

  let state: RiderArrivalState | null = null;
  let exitFrame = predictEntryValue(readout.outputExitFrame, knobs);
  let exitSpeed = predictEntryValue(readout.outputExitSpeed, knobs);

  if (readout.hasLatent) {
    const suffixFrame = predictEntryValue(readout.latentSuffixFrame, knobs);
    const suffixX = predictEntryValue(readout.latentSuffixX, knobs);
    const suffixY = predictEntryValue(readout.latentSuffixY, knobs);
    const suffixVx = predictEntryValue(readout.latentSuffixVx, knobs);
    const suffixVy = predictEntryValue(readout.latentSuffixVy, knobs);
    if (
      Number.isFinite(suffixFrame) &&
      Number.isFinite(suffixX) &&
      Number.isFinite(suffixY) &&
      Number.isFinite(suffixVx) &&
      Number.isFinite(suffixVy)
    ) {
      const suffixSpeed = Math.hypot(suffixVx, suffixVy);
      if (Number.isFinite(suffixSpeed)) {
        exitFrame = suffixFrame;
        exitSpeed = suffixSpeed;
        if (scoreAir || scoreSpeed || scoreElevation) {
          const startFrame = model.context.gap.startFrame;
          const rangeEndFrame = model.context.axisMeasureEnd;
          const prefixEnd = Math.max(startFrame, Math.min(rangeEndFrame, Math.round(suffixFrame)));
          const prefixFrames = Math.max(0, prefixEnd - startFrame + 1);
          const prefixAirFraction = predictEntryValue(readout.latentPrefixAirFraction, knobs);
          const prefixAirFrames = Number.isFinite(prefixAirFraction)
            ? Math.max(0, Math.min(1, prefixAirFraction)) * prefixFrames
            : predictEntryValue(readout.latentPrefixAirFrames, knobs);
          const prefixSpeedMeanPx = predictEntryValue(readout.latentPrefixSpeedMeanPx, knobs);
          const prefixSpeedFrames = Number.isFinite(prefixSpeedMeanPx)
            ? prefixFrames
            : predictEntryValue(readout.latentPrefixSpeedFrames, knobs);
          const prefixSpeedSumPx = Number.isFinite(prefixSpeedMeanPx)
            ? prefixSpeedMeanPx * prefixSpeedFrames
            : predictEntryValue(readout.latentPrefixSpeedSumPx, knobs);
          const prefixDy = predictEntryValue(readout.latentPrefixDy, knobs);
          const prefixV0SpeedPx = predictEntryValue(readout.latentPrefixV0SpeedPx, knobs);
          if (
            Number.isFinite(prefixAirFrames) &&
            Number.isFinite(prefixSpeedSumPx) &&
            Number.isFinite(prefixSpeedFrames) &&
            Number.isFinite(prefixDy) &&
            Number.isFinite(prefixV0SpeedPx)
          ) {
            const suffixFrames = Math.max(0, rangeEndFrame - prefixEnd);
            if (scoreAir) {
              const totalFrames = prefixFrames + suffixFrames;
              if (totalFrames > 0) {
                const boundedPrefixAirFrames = Math.max(0, Math.min(prefixFrames, prefixAirFrames));
                air = (boundedPrefixAirFrames + suffixFrames) / totalFrames;
              }
            }
            if (scoreSpeed) {
              let speedSumPx = prefixSpeedSumPx;
              let speedFrames = Math.max(0, Math.min(prefixFrames, prefixSpeedFrames));
              for (let f = prefixEnd + 1; f <= rangeEndFrame; f++) {
                const vy = suffixVy + ELEVATION.GRAVITY_PX_PER_FRAME2 * Math.max(0, f - suffixFrame);
                speedSumPx += Math.sqrt(suffixVx * suffixVx + vy * vy);
                speedFrames++;
              }
              if (speedFrames > 0) speedAxis = speedPxToAuthored(speedSumPx / speedFrames);
            }
            if (
              scoreElevation &&
              rangeEndFrame > startFrame &&
              Number.isFinite(prefixV0SpeedPx)
            ) {
              let dy = prefixDy;
              for (let f = prefixEnd + 1; f <= rangeEndFrame; f++) {
                dy += suffixVy + ELEVATION.GRAVITY_PX_PER_FRAME2 * Math.max(0, f - suffixFrame);
              }
              elevation = netDyToElevation(
                dy,
                Math.max(0, prefixV0SpeedPx),
                rangeEndFrame - startFrame,
              );
            }
          }
        }
        if (suffixFrame <= model.context.nextFrame) {
          const suffixSledPoseDeg = predictEntryValue(readout.latentSuffixSledPoseDeg, knobs);
          const suffixSledPoseRateDegPerFrame = predictEntryValue(readout.latentSuffixSledPoseRateDegPerFrame, knobs);
          state = propagateBallisticArrivalStateFromValues(
            suffixX,
            suffixY,
            suffixVx,
            suffixVy,
            Number.isFinite(suffixSledPoseDeg) ? suffixSledPoseDeg : null,
            Number.isFinite(suffixSledPoseRateDegPerFrame) ? suffixSledPoseRateDegPerFrame : null,
            model.context.nextFrame - suffixFrame,
          );
        }
      }
    }
  } else {
    state = predictedArrivalStateFromDirectOutputs(readout, knobs);
  }

  return {
    currentQuality: currentQualityFromAxisValues(
      currentTargets,
      air,
      speedAxis,
      grain,
      elevation,
      amplitude,
      impact,
    ),
    state,
    exitFrame,
    exitSpeed,
  };
}

function shouldScoreCurrentAxis(targets: AxisValues, axis: string): boolean {
  return !REPORT_ONLY_AXIS_SET.has(axis) && Number.isFinite(targets[axis as keyof AxisValues]);
}

/** Axes the latent reducer reconstructs ballistically (via
 *  `completeBallisticSpanAxesFromSummary` → `axisResponseOutputs`). It owns ONLY
 *  these; grain/amplitude/impact are fitted model outputs the reducer never
 *  overwrites, so their predictions are deliberately left intact (see
 *  `clearReducerOwnedOutputs`). */
const REDUCER_BALLISTIC_AXES = ["air", "speed", "elevation"] as const;

function reducerOwnsOutputKey(key: string): boolean {
  return key.startsWith("exit.") ||
    key.startsWith("next.") ||
    key === "current.cost" ||
    key === "current.releaseSpeedPx" ||
    key === "current.releaseVy" ||
    REDUCER_BALLISTIC_AXES.some((axis) =>
      key === `current.axis.${axis}` || key === `current.error.${axis}`
    );
}

/** Clear every output key the latent reducer (`reduceLatentJointArcOutputs`)
 *  recomputes, before it overwrites: the reducer skips non-finite values
 *  (`addFinite`) and may emit nothing at all (null suffix), so a stale fitted
 *  prediction must not leak through. Instead of hand-mirroring the producers'
 *  key lists (which silently drifts when a producer gains a field), the `exit.*`
 *  / `next.*` blocks are cleared by prefix — the ONLY producers of those
 *  namespaces are `exitStateOutputs` / `stateOutputs`, so any key they add is
 *  swept automatically. The reducer's `current.*` keys are an explicit small set:
 *  `current.cost` (added by `predictJointArcOutputs`), the two release scalars,
 *  and axis/error for the ballistic axes only (NOT grain/amplitude/impact). */
function clearReducerOwnedOutputs(outputs: Record<string, number>): void {
  for (const key of Object.keys(outputs)) {
    if (reducerOwnsOutputKey(key)) delete outputs[key];
  }
}

function predictFittedValues(
  models: JointArcResponseModel["outputModels"],
  knobs: ArcKnobs,
): Record<string, number> {
  const values: Record<string, number> = {};
  predictFittedValuesInto(models, knobs, values);
  return values;
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

/** The fast-physics reducer: latent suffix state + prefix summaries → final
 * output vector. Exported so studies can decompose latent-mode error into
 * fit error vs reducer error by applying it to MEASURED latents directly. */
export function reduceLatentJointArcOutputs(
  latent: Record<string, number>,
  context: JointArcResponseContext,
): Record<string, number> {
  const outputs: Record<string, number> = {};
  reduceLatentJointArcOutputsInto(latent, context, outputs);
  return outputs;
}

function reduceLatentJointArcOutputsInto(
  latent: Record<string, number>,
  context: JointArcResponseContext,
  outputs: Record<string, number>,
): void {

  const suffixFrame = latent["latent.suffix.frame"];
  const suffixState = suffixStateFromLatent(latent);
  if (suffixState === null || !Number.isFinite(suffixFrame)) return;

  outputs["current.releaseSpeedPx"] = suffixState.speed;
  outputs["current.releaseVy"] = suffixState.vy;
  addValidatedExitStateOutputs(outputs, suffixState, suffixFrame);

  const prefix = prefixSummaryFromLatent(latent, context.gap.startFrame, suffixFrame, context.axisMeasureEnd);
  if (prefix !== null) {
    const suffix: BallisticAxisSuffix = { frame: suffixFrame, vx: suffixState.vx, vy: suffixState.vy };
    const axes = completeBallisticSpanAxesFromSummary(prefix, context.axisMeasureEnd, suffix);
    addAxisResponseOutputs(outputs, context.gap.targets, axes);
  }

  if (suffixFrame <= context.nextFrame) {
    const nextState = propagateBallisticArrivalState(suffixState, context.nextFrame - suffixFrame);
    addValidatedStateOutputs(outputs, nextState);
  }
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

function suffixStateFromLatent(latent: Record<string, number>): RiderArrivalState | null {
  const x = latent["latent.suffix.x"];
  const y = latent["latent.suffix.y"];
  const vx = latent["latent.suffix.vx"];
  const vy = latent["latent.suffix.vy"];
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(vx) || !Number.isFinite(vy)) return null;
  const speed = Math.hypot(vx, vy);
  if (!Number.isFinite(speed)) return null;
  return {
    x,
    y,
    vx,
    vy,
    speed,
    comAngleDeg: speed > 0 ? Math.atan2(vy, vx) * 180 / Math.PI : null,
    sledPoseDeg: Number.isFinite(latent["latent.suffix.sledPoseDeg"]) ? latent["latent.suffix.sledPoseDeg"] : null,
    sledPoseRateDegPerFrame: Number.isFinite(latent["latent.suffix.sledPoseRateDegPerFrame"])
      ? latent["latent.suffix.sledPoseRateDegPerFrame"]
    : null,
  };
}

function prefixSummaryFromLatent(
  latent: Record<string, number>,
  startFrame: number,
  suffixFrame: number,
  rangeEndFrame: number,
): BallisticAxisPrefixSummary | null {
  const prefixEndFrame = Math.max(startFrame, Math.min(rangeEndFrame, Math.round(suffixFrame)));
  const prefixFrames = Math.max(0, prefixEndFrame - startFrame + 1);
  const airFraction = latent["latent.prefix.airFraction"];
  const airFrames = Number.isFinite(airFraction)
    ? Math.max(0, Math.min(1, airFraction)) * prefixFrames
    : latent["latent.prefix.airFrames"];
  const speedMeanPx = latent["latent.prefix.speedMeanPx"];
  const speedFrames = Number.isFinite(speedMeanPx) ? prefixFrames : latent["latent.prefix.speedFrames"];
  const speedSumPx = Number.isFinite(speedMeanPx)
    ? speedMeanPx * speedFrames
    : latent["latent.prefix.speedSumPx"];
  const dy = latent["latent.prefix.dy"];
  const v0SpeedPx = latent["latent.prefix.v0SpeedPx"];
  if (
    !Number.isFinite(airFrames) ||
    !Number.isFinite(speedSumPx) ||
    !Number.isFinite(speedFrames) ||
    !Number.isFinite(dy) ||
    !Number.isFinite(v0SpeedPx)
  ) return null;
  return {
    startFrame,
    prefixEndFrame,
    airFrames,
    speedSumPx,
    speedFrames,
    dy,
    v0SpeedPx,
  };
}

/** The 9-key `exit.*` block at the suffix/exit frame: the suffix launch state
 *  written under the reducer's `exit.*` keys. Single source for both the latent
 *  reducer (reduceLatentJointArcOutputs) and study-local direct rows so the key
 *  set and values stay identical across model spaces. */
export function exitStateOutputs(state: RiderArrivalState, frame: number): Record<string, number> {
  const outputs: Record<string, number> = {};
  addExitStateOutputs(outputs, state, frame);
  return outputs;
}

function addExitStateOutputs(outputs: Record<string, number>, state: RiderArrivalState, frame: number): void {
  if (Number.isFinite(frame)) outputs["exit.frame"] = frame;
  if (Number.isFinite(state.x)) outputs["exit.x"] = state.x;
  if (Number.isFinite(state.y)) outputs["exit.y"] = state.y;
  if (Number.isFinite(state.vx)) outputs["exit.vx"] = state.vx;
  if (Number.isFinite(state.vy)) outputs["exit.vy"] = state.vy;
  if (Number.isFinite(state.speed)) outputs["exit.speed"] = state.speed;
  if (state.comAngleDeg !== null && Number.isFinite(state.comAngleDeg)) outputs["exit.comAngleDeg"] = state.comAngleDeg;
  if (state.sledPoseDeg !== null && Number.isFinite(state.sledPoseDeg)) outputs["exit.sledPoseDeg"] = state.sledPoseDeg;
  if (state.sledPoseRateDegPerFrame !== null && Number.isFinite(state.sledPoseRateDegPerFrame)) {
    outputs["exit.sledPoseRateDegPerFrame"] = state.sledPoseRateDegPerFrame;
  }
}

function addValidatedExitStateOutputs(outputs: Record<string, number>, state: RiderArrivalState, frame: number): void {
  outputs["exit.frame"] = frame;
  outputs["exit.x"] = state.x;
  outputs["exit.y"] = state.y;
  outputs["exit.vx"] = state.vx;
  outputs["exit.vy"] = state.vy;
  outputs["exit.speed"] = state.speed;
  if (state.comAngleDeg !== null) outputs["exit.comAngleDeg"] = state.comAngleDeg;
  if (state.sledPoseDeg !== null) outputs["exit.sledPoseDeg"] = state.sledPoseDeg;
  if (state.sledPoseRateDegPerFrame !== null) {
    outputs["exit.sledPoseRateDegPerFrame"] = state.sledPoseRateDegPerFrame;
  }
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
  if (Number.isFinite(state.speed)) outputs["next.speed"] = state.speed;
  if (state.comAngleDeg !== null && Number.isFinite(state.comAngleDeg)) outputs["next.comAngleDeg"] = state.comAngleDeg;
  if (state.sledPoseDeg !== null && Number.isFinite(state.sledPoseDeg)) outputs["next.sledPoseDeg"] = state.sledPoseDeg;
  if (state.sledPoseRateDegPerFrame !== null && Number.isFinite(state.sledPoseRateDegPerFrame)) {
    outputs["next.sledPoseRateDegPerFrame"] = state.sledPoseRateDegPerFrame;
  }
}

function addValidatedStateOutputs(outputs: Record<string, number>, state: RiderArrivalState): void {
  outputs["next.x"] = state.x;
  outputs["next.y"] = state.y;
  outputs["next.vx"] = state.vx;
  outputs["next.vy"] = state.vy;
  outputs["next.speed"] = state.speed;
  if (state.comAngleDeg !== null) outputs["next.comAngleDeg"] = state.comAngleDeg;
  if (state.sledPoseDeg !== null) outputs["next.sledPoseDeg"] = state.sledPoseDeg;
  if (state.sledPoseRateDegPerFrame !== null) {
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
): number {
  let count = 0;
  let sumSq = 0;
  if (!REPORT_ONLY_AXIS_SET.has("air")) {
    const target = targets.air;
    const value = air;
    if (Number.isFinite(target) && Number.isFinite(value)) {
      const error = value - target;
      sumSq += error * error;
      count++;
    }
  }
  if (!REPORT_ONLY_AXIS_SET.has("speed")) {
    const target = targets.speed;
    const value = speed;
    if (Number.isFinite(target) && Number.isFinite(value)) {
      const error = value - target;
      sumSq += error * error;
      count++;
    }
  }
  if (!REPORT_ONLY_AXIS_SET.has("grain")) {
    const target = targets.grain;
    const value = grain;
    if (Number.isFinite(target) && Number.isFinite(value)) {
      const error = value - target;
      sumSq += error * error;
      count++;
    }
  }
  if (!REPORT_ONLY_AXIS_SET.has("elevation")) {
    const target = targets.elevation;
    const value = elevation;
    if (Number.isFinite(target) && Number.isFinite(value)) {
      const error = value - target;
      sumSq += error * error;
      count++;
    }
  }
  if (!REPORT_ONLY_AXIS_SET.has("amplitude")) {
    const target = targets.amplitude;
    const value = amplitude;
    if (Number.isFinite(target) && Number.isFinite(value)) {
      const error = value - target;
      sumSq += error * error;
      count++;
    }
  }
  if (!REPORT_ONLY_AXIS_SET.has("impact")) {
    const target = targets.impact;
    const value = impact;
    if (Number.isFinite(target) && Number.isFinite(value)) {
      const error = value - target;
      sumSq += error * error;
      count++;
    }
  }
  if (count === 0) return 1;
  return Math.exp(-(Math.sqrt(sumSq / count) / AXIS_QUALITY_TOLERANCE));
}

export function predictedArrivalState(outputs: Record<string, number>): RiderArrivalState | null {
  const x = outputs["next.x"];
  const y = outputs["next.y"];
  const vx = outputs["next.vx"];
  const vy = outputs["next.vy"];
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(vx) || !Number.isFinite(vy)) return null;
  const measuredSpeed = outputs["next.speed"];
  const speed = Number.isFinite(measuredSpeed) ? measuredSpeed : Math.hypot(vx, vy);
  if (!Number.isFinite(speed)) return null;
  const measuredAngle = outputs["next.comAngleDeg"];
  const comAngleDeg = Number.isFinite(measuredAngle)
    ? measuredAngle
    : speed > 0 ? Math.atan2(vy, vx) * 180 / Math.PI : null;
  const sledPoseDeg = Number.isFinite(outputs["next.sledPoseDeg"]) ? outputs["next.sledPoseDeg"] : null;
  const sledPoseRateDegPerFrame = Number.isFinite(outputs["next.sledPoseRateDegPerFrame"])
    ? outputs["next.sledPoseRateDegPerFrame"]
    : null;
  return { x, y, vx, vy, speed, comAngleDeg, sledPoseDeg, sledPoseRateDegPerFrame };
}

function predictedArrivalStateFromDirectOutputs(
  models: JointArcScoreReadoutModels,
  knobs: ArcKnobs,
): RiderArrivalState | null {
  const x = predictEntryValue(models.outputNextX, knobs);
  const y = predictEntryValue(models.outputNextY, knobs);
  const vx = predictEntryValue(models.outputNextVx, knobs);
  const vy = predictEntryValue(models.outputNextVy, knobs);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(vx) || !Number.isFinite(vy)) return null;
  const measuredSpeed = predictEntryValue(models.outputNextSpeed, knobs);
  const speed = Number.isFinite(measuredSpeed) ? measuredSpeed : Math.hypot(vx, vy);
  if (!Number.isFinite(speed)) return null;
  const measuredAngle = predictEntryValue(models.outputNextComAngleDeg, knobs);
  const comAngleDeg = Number.isFinite(measuredAngle)
    ? measuredAngle
    : speed > 0 ? Math.atan2(vy, vx) * 180 / Math.PI : null;
  const sledPoseDeg = predictOptionalEntryValue(models.outputNextSledPoseDeg, knobs);
  const sledPoseRateDegPerFrame = predictOptionalEntryValue(models.outputNextSledPoseRateDegPerFrame, knobs);
  return { x, y, vx, vy, speed, comAngleDeg, sledPoseDeg, sledPoseRateDegPerFrame };
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
