import {
  AXES,
  ELEVATION,
  type AxisValues,
  type Gap,
  type TrackLine,
} from "../types.ts";
import {
  completeBallisticSpanAxesFromSummary,
  type BallisticAxisPrefixSummary,
  type BallisticAxisSuffix,
} from "../core/measure.ts";
import { axisCost } from "../core/candidate.ts";

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
  const x = state.x + state.vx * dt;
  // lr-core's Verlet step applies gravity before the next frame's velocity read.
  const y = state.y + state.vy * dt + 0.5 * g * dt * (dt + 1);
  const vx = state.vx;
  const vy = state.vy + g * dt;
  const speed = Math.hypot(vx, vy);
  const comAngleDeg = speed > 0 ? Math.atan2(vy, vx) * 180 / Math.PI : null;
  const sledPoseDeg = state.sledPoseDeg !== null && state.sledPoseRateDegPerFrame !== null
    ? normalizeAngleDeg(state.sledPoseDeg + state.sledPoseRateDegPerFrame * dt)
    : state.sledPoseDeg;
  return {
    x,
    y,
    vx,
    vy,
    speed,
    comAngleDeg,
    sledPoseDeg,
    sledPoseRateDegPerFrame: state.sledPoseRateDegPerFrame,
  };
}

export type LinearModel = {
  coefficients: number[];
};

export type KnobSurfaceModel = {
  samples: Array<{ knobs: ArcKnobs; value: number }>;
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

export type JointArcProbeRow = {
  knobs: ArcKnobs;
  outputs: Record<string, number>;
  latentOutputs?: Record<string, number>;
};

export type JointArcResponseModel = {
  context: JointArcResponseContext;
  outputModels: Map<string, {
    angle: boolean;
    ref: number;
    model: FittedArcOutputModel;
  }>;
  latentModels: Map<string, {
    angle: boolean;
    ref: number;
    model: FittedArcOutputModel;
  }>;
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

function hybridUsesBiquadratic(output: string, probeDesignName: ArcProbeDesignName): boolean {
  return probeDesignName === "grid9" &&
    output.startsWith("next.") &&
    output !== "next.sledPoseDeg" &&
    output !== "next.sledPoseRateDegPerFrame";
}

function hybridUsesSurface(output: string, probeDesignName: ArcProbeDesignName): boolean {
  if (probeDesignName === "cross5") {
    return output === "current.error.air" ||
      output === "current.axis.air" ||
      output === "current.error.elevation" ||
      output === "current.axis.elevation" ||
      output === "current.error.impact" ||
      output === "current.axis.impact" ||
      output === "next.sledPoseRateDegPerFrame";
  }
  return output === "current.error.air" ||
    output === "current.axis.air" ||
    output === "current.error.elevation" ||
    output === "current.axis.elevation" ||
    output === "current.error.impact" ||
    output === "current.axis.impact" ||
    output === "next.sledPoseDeg" ||
    output === "next.sledPoseRateDegPerFrame";
}

export function fitJointArcResponseModel(
  rows: readonly JointArcProbeRow[],
  probeDesignName: ArcProbeDesignName,
  modelName: ArcResponseModelName = "hybrid",
  options: JointArcResponseFitOptions,
): JointArcResponseModel {
  const outputModels = fitJointValueModels(rows, jointArcOutputKeys(rows, "outputs"), "outputs", probeDesignName, modelName);
  const latentModels = fitJointValueModels(rows, jointArcOutputKeys(rows, "latentOutputs"), "latentOutputs", probeDesignName, modelName);
  return { context: options.context, outputModels, latentModels };
}

type JointArcValueSource = "outputs" | "latentOutputs";

function fitJointValueModels(
  rows: readonly JointArcProbeRow[],
  keys: readonly string[],
  source: JointArcValueSource,
  probeDesignName: ArcProbeDesignName,
  modelName: ArcResponseModelName,
): JointArcResponseModel["outputModels"] {
  const models: JointArcResponseModel["outputModels"] = new Map();
  const baseline = rows.find((r) => r.knobs.pitchDeg === 0 && r.knobs.rotateDeg === 0);
  for (const output of keys) {
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
  const outputs = predictFittedValues(model.outputModels, knobs);
  if (model.latentModels.size > 0) clearReducerOwnedOutputs(outputs);
  Object.assign(outputs, reduceLatentJointArcOutputs(predictFittedValues(model.latentModels, knobs), model.context));
  const computedCost = currentCostFromPredictedAxes(outputs, model.context.gap);
  if (computedCost !== null) outputs["current.cost"] = computedCost;
  return outputs;
}

function clearReducerOwnedOutputs(outputs: Record<string, number>): void {
  delete outputs["current.cost"];
  delete outputs["current.releaseSpeedPx"];
  delete outputs["current.releaseVy"];
  for (const axis of ["air", "speed", "elevation"]) {
    delete outputs[`current.axis.${axis}`];
    delete outputs[`current.error.${axis}`];
  }
  for (const key of [
    "exit.frame",
    "exit.x",
    "exit.y",
    "exit.vx",
    "exit.vy",
    "exit.speed",
    "exit.comAngleDeg",
    "exit.sledPoseDeg",
    "exit.sledPoseRateDegPerFrame",
    "next.x",
    "next.y",
    "next.vx",
    "next.vy",
    "next.speed",
    "next.comAngleDeg",
    "next.sledPoseDeg",
    "next.sledPoseRateDegPerFrame",
  ]) {
    delete outputs[key];
  }
}

function predictFittedValues(
  models: JointArcResponseModel["outputModels"],
  knobs: ArcKnobs,
): Record<string, number> {
  const values: Record<string, number> = {};
  for (const [output, fitted] of models) {
    const pred = fitted.model.predict(knobs);
    values[output] = fitted.angle ? unwrapAngleAround(pred, fitted.ref) : pred;
  }
  return values;
}

/** The fast-physics reducer: latent suffix state + prefix summaries → final
 * output vector. Exported so studies can decompose latent-mode error into
 * fit error vs reducer error by applying it to MEASURED latents directly. */
export function reduceLatentJointArcOutputs(
  latent: Record<string, number>,
  context: JointArcResponseContext,
): Record<string, number> {
  const outputs: Record<string, number> = {};

  const suffixFrame = latent["latent.suffix.frame"];
  const suffixState = suffixStateFromLatent(latent);
  if (suffixState === null || !Number.isFinite(suffixFrame)) return outputs;

  addFinite(outputs, "current.releaseSpeedPx", suffixState.speed);
  addFinite(outputs, "current.releaseVy", suffixState.vy);
  Object.assign(outputs, exitStateOutputs(suffixState, suffixFrame));

  const prefix = prefixSummaryFromLatent(latent, context.gap.startFrame, suffixFrame, context.axisMeasureEnd);
  if (prefix !== null) {
    const suffix: BallisticAxisSuffix = { frame: suffixFrame, vx: suffixState.vx, vy: suffixState.vy };
    const axes = completeBallisticSpanAxesFromSummary(prefix, context.axisMeasureEnd, suffix);
    Object.assign(outputs, axisResponseOutputs(context.gap.targets, axes));
  }

  if (suffixFrame <= context.nextFrame) {
    const nextState = propagateBallisticArrivalState(suffixState, context.nextFrame - suffixFrame);
    Object.assign(outputs, stateOutputs(nextState));
  }
  return outputs;
}

function currentCostFromPredictedAxes(outputs: Record<string, number>, gap: Gap): number | null {
  const axes = predictedCurrentAxes(outputs);
  for (const axis of AXES) {
    if (gap.targets[axis] !== undefined && axes[axis] !== undefined) return axisCost(gap.targets, axes);
  }
  return null;
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
 *  reducer (reduceLatentJointArcOutputs) and direct-mode probe rows (arc_probe.ts)
 *  so the key set and values stay identical across model spaces. */
export function exitStateOutputs(state: RiderArrivalState, frame: number): Record<string, number> {
  const outputs: Record<string, number> = {};
  addFinite(outputs, "exit.frame", frame);
  addFinite(outputs, "exit.x", state.x);
  addFinite(outputs, "exit.y", state.y);
  addFinite(outputs, "exit.vx", state.vx);
  addFinite(outputs, "exit.vy", state.vy);
  addFinite(outputs, "exit.speed", state.speed);
  addFinite(outputs, "exit.comAngleDeg", state.comAngleDeg);
  addFinite(outputs, "exit.sledPoseDeg", state.sledPoseDeg);
  addFinite(outputs, "exit.sledPoseRateDegPerFrame", state.sledPoseRateDegPerFrame);
  return outputs;
}

export function stateOutputs(state: RiderArrivalState): Record<string, number> {
  const outputs: Record<string, number> = {};
  addFinite(outputs, "next.x", state.x);
  addFinite(outputs, "next.y", state.y);
  addFinite(outputs, "next.vx", state.vx);
  addFinite(outputs, "next.vy", state.vy);
  addFinite(outputs, "next.speed", state.speed);
  addFinite(outputs, "next.comAngleDeg", state.comAngleDeg);
  addFinite(outputs, "next.sledPoseDeg", state.sledPoseDeg);
  addFinite(outputs, "next.sledPoseRateDegPerFrame", state.sledPoseRateDegPerFrame);
  return outputs;
}

export function arcResponseOutputs(
  targets: AxisValues,
  achieved: AxisValues,
  cost: number | null | undefined,
  nextState: RiderArrivalState | null,
): Record<string, number> {
  const outputs: Record<string, number> = {};
  addFinite(outputs, "current.cost", cost);
  Object.assign(outputs, axisResponseOutputs(targets, achieved));
  if (nextState !== null) Object.assign(outputs, stateOutputs(nextState));
  return outputs;
}

function axisResponseOutputs(
  targets: AxisValues,
  achieved: AxisValues,
): Record<string, number> {
  const outputs: Record<string, number> = {};
  for (const axis of AXES) {
    const actual = achieved[axis];
    if (actual === undefined) continue;
    addFinite(outputs, `current.axis.${axis}`, actual);
    const target = targets[axis];
    if (target !== undefined) addFinite(outputs, `current.error.${axis}`, actual - target);
  }
  return outputs;
}

export function predictedCurrentAxes(outputs: Record<string, number>): AxisValues {
  const axes: AxisValues = {};
  for (const axis of AXES) {
    const value = outputs[`current.axis.${axis}`];
    if (Number.isFinite(value)) axes[axis] = value;
  }
  return axes;
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
  return samples.length >= minRows ? { samples } : null;
}

export function predictKnobSurfaceModel(model: KnobSurfaceModel, knobs: ArcKnobs): number {
  const exact = surfaceValueAt(model.samples, knobs.pitchDeg, knobs.rotateDeg);
  if (exact !== null) return exact;

  const pitches = sortedUnique(model.samples.map((sample) => sample.knobs.pitchDeg));
  const rotates = sortedUnique(model.samples.map((sample) => sample.knobs.rotateDeg));
  if (pitches.length >= 2 && rotates.length >= 2) {
    const [p0, p1] = bounds(pitches, knobs.pitchDeg);
    const [r0, r1] = bounds(rotates, knobs.rotateDeg);
    const v00 = surfaceValueAt(model.samples, p0, r0);
    const v01 = surfaceValueAt(model.samples, p0, r1);
    const v10 = surfaceValueAt(model.samples, p1, r0);
    const v11 = surfaceValueAt(model.samples, p1, r1);
    if (v00 !== null && v01 !== null && v10 !== null && v11 !== null) {
      const pt = p1 === p0 ? 0 : (knobs.pitchDeg - p0) / (p1 - p0);
      const rt = r1 === r0 ? 0 : (knobs.rotateDeg - r0) / (r1 - r0);
      const lo = v00 * (1 - rt) + v01 * rt;
      const hi = v10 * (1 - rt) + v11 * rt;
      return lo * (1 - pt) + hi * pt;
    }
  }

  const center = surfaceValueAt(model.samples, 0, 0);
  const pitch = interpolateAxis(model.samples, "pitch", knobs.pitchDeg);
  const rotate = interpolateAxis(model.samples, "rotate", knobs.rotateDeg);
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

function surfaceValueAt(samples: Array<{ knobs: ArcKnobs; value: number }>, pitchDeg: number, rotateDeg: number): number | null {
  const sample = samples.find((s) =>
    s.knobs.pitchDeg.toFixed(6) === pitchDeg.toFixed(6) &&
    s.knobs.rotateDeg.toFixed(6) === rotateDeg.toFixed(6)
  );
  return sample?.value ?? null;
}

function interpolateAxis(
  samples: Array<{ knobs: ArcKnobs; value: number }>,
  axis: "pitch" | "rotate",
  value: number,
): number | null {
  const axisSamples = samples
    .filter((sample) => axis === "pitch" ? sample.knobs.rotateDeg === 0 : sample.knobs.pitchDeg === 0)
    .map((sample) => ({ x: axis === "pitch" ? sample.knobs.pitchDeg : sample.knobs.rotateDeg, value: sample.value }))
    .sort((a, b) => a.x - b.x);
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
