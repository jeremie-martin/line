/**
 * Dimension-generic local response models for arc-control experiments.
 *
 * Values stay positional from probe to prediction, so every declared physical
 * control remains explicit.
 */
import {
  completeArcPrediction,
  currentQualityFromAxisValues,
  fitLinearLeastSquares,
  incomingKinematicsFromValues,
  isArcAngleOutput,
  normalizeAngleDeg,
  type JointArcCurrentScoreAxes,
  type JointArcResponseContext,
  type JointArcScoreReadout,
} from "./arc_model.ts";
import type { AxisValues } from "../types.ts";

export type ArcVectorTrainingKind = "additive" | "joint";

export type ArcVectorProbeRow = Readonly<{
  values: readonly number[];
  outputs: Readonly<Record<string, number>>;
}>;

export type ArcVectorFitForm =
  | "tensor_quadratic"
  | "additive_quadratic"
  | "linear"
  | "constant";

export type ArcVectorFittedOutput = Readonly<{
  form: ArcVectorFitForm;
  /** A fallback below the requested method's richest identifiable form. */
  degraded: boolean;
  coefficients: readonly number[];
}>;

type FittedOutputEntry = Readonly<{
  angle: boolean;
  ref: number;
  model: ArcVectorFittedOutput;
}>;

/** One fitted output flattened for prediction. Prediction runs once per knob
 *  candidate over every output, so the hot loop reads these fields directly
 *  instead of walking the Map and its nested model object per output. Built in
 *  Map insertion order, so predictions are made in the same order as before. */
type PredictEntry = Readonly<{
  key: string;
  angle: boolean;
  ref: number;
  form: ArcVectorFitForm;
  coefficients: readonly number[];
}>;

/** The outputs the knob-scoring readout actually reads, resolved once per model
 *  to positions in `outputEntries`. A model fits ~21 outputs; the readout reads
 *  at most these 18, and typically 12 exist. */
const READOUT_KEYS = [
  "current.axis.air",
  "current.axis.speed",
  "current.axis.grain",
  "current.axis.elevation",
  "current.axis.amplitude",
  "current.axis.impact",
  "exit.frame",
  "exit.speed",
  "next.meanSpeedPx",
  "next.airFraction",
  "next.frameCount",
  "next.elevation",
  "next.x",
  "next.y",
  "next.vx",
  "next.vy",
  "next.sledPoseDeg",
  "next.sledPoseRateDegPerFrame",
] as const;

type ReadoutKey = (typeof READOUT_KEYS)[number];
type ReadoutSlots = Readonly<Record<ReadoutKey, number>>;

export type ArcVectorResponseModel = Readonly<{
  dimensions: number;
  spans: readonly number[];
  trainingKind: ArcVectorTrainingKind;
  context: JointArcResponseContext;
  outputModels: ReadonlyMap<string, FittedOutputEntry>;
  outputEntries: readonly PredictEntry[];
  /** Position in `outputEntries` of each readout output, or -1 when unfitted. */
  readoutSlots: ReadoutSlots;
  /** The entries the readout needs, ascending — the only ones it predicts. */
  readoutEntryIndices: readonly number[];
  /** Scratch, one slot per entry. Nothing escapes the readout, and a compile is
   *  single-threaded, so one buffer per model is enough. */
  readoutBuffer: number[];
}>;

/** Fit one model per measured output.  `joint` gets the complete signed-cube
 * tensor first, then falls back deterministically to additive/linear/constant
 * when gate-filtered observations cannot identify it. */
export function fitArcVectorResponseModel(
  rows: readonly ArcVectorProbeRow[],
  spans: readonly number[],
  trainingKind: ArcVectorTrainingKind,
  context: JointArcResponseContext,
): ArcVectorResponseModel {
  if (spans.length < 1) throw new Error("arc vector model needs at least one dimension");
  for (const span of spans) {
    if (!(span > 0) || !Number.isFinite(span)) throw new Error(`invalid arc vector span ${span}`);
  }
  for (const row of rows) assertVectorLength(row.values, spans.length);
  const outputModels = fitValueModels(rows, spans, trainingKind);
  const outputEntries = flattenOutputModels(outputModels);
  const readoutSlots = resolveReadoutSlots(outputEntries);
  return {
    dimensions: spans.length,
    spans: [...spans],
    trainingKind,
    context,
    outputModels,
    outputEntries,
    readoutSlots,
    readoutEntryIndices: readoutEntryIndices(readoutSlots),
    readoutBuffer: new Array<number>(outputEntries.length).fill(0),
  };
}

function resolveReadoutSlots(entries: readonly PredictEntry[]): ReadoutSlots {
  const slots = {} as Record<ReadoutKey, number>;
  for (const key of READOUT_KEYS) slots[key] = -1;
  for (let index = 0; index < entries.length; index++) {
    const key = entries[index].key as ReadoutKey;
    if (Object.hasOwn(slots, key)) slots[key] = index;
  }
  return slots;
}

function readoutEntryIndices(slots: ReadoutSlots): number[] {
  const indices: number[] = [];
  for (const key of READOUT_KEYS) {
    const slot = slots[key];
    if (slot >= 0) indices.push(slot);
  }
  return indices.sort((a, b) => a - b);
}

function flattenOutputModels(
  models: ReadonlyMap<string, FittedOutputEntry>,
): PredictEntry[] {
  const entries: PredictEntry[] = [];
  for (const [key, entry] of models) {
    entries.push({
      key,
      angle: entry.angle,
      ref: entry.ref,
      form: entry.model.form,
      coefficients: entry.model.coefficients,
    });
  }
  return entries;
}

/** Complete the canonical direct-output vector. */
export function predictArcVectorOutputs(
  model: ArcVectorResponseModel,
  values: readonly number[],
): Record<string, number> {
  assertVectorLength(values, model.dimensions);
  const direct = predictValues(model.outputEntries, values, model.spans);
  return completeArcPrediction(direct, model.context);
}

/**
 * Score one knob candidate, predicting ONLY the outputs the readout reads.
 *
 * The full path predicts every fitted output — measured at 21 per call, 75,600
 * calls per compile — routes them through a string-keyed record, copies that
 * record, and then looks twelve of them back up by name. The readout needs no
 * more than the eighteen `READOUT_KEYS`, so the rest is predicted and discarded.
 *
 * Values are identical: the same entries are evaluated with the same features,
 * the same coefficient order and the same `unwrapAngle`, just written by index.
 * An output this model did not fit has slot -1 and reads as NaN — exactly what
 * the absent record key already meant here, since `currentQualityFromAxisValues`
 * rejects `undefined` and `NaN` alike through `Number.isFinite` and the readout
 * fields applied `?? NaN`. `current.cost` is not computed because the readout
 * never reads it; callers wanting the whole record still call
 * `predictArcVectorOutputs`.
 */
export function predictArcVectorScoreReadout(
  model: ArcVectorResponseModel,
  values: readonly number[],
  currentTargets: AxisValues,
  scoreAxes: JointArcCurrentScoreAxes,
): JointArcScoreReadout {
  assertVectorLength(values, model.dimensions);
  const buffer = model.readoutBuffer;
  predictReadoutValuesInto(
    model.outputEntries,
    model.readoutEntryIndices,
    values,
    model.spans,
    buffer,
  );
  const slots = model.readoutSlots;
  return {
    currentQuality: currentQualityFromAxisValues(
      currentTargets,
      scoreAxes.air ? slotValue(buffer, slots["current.axis.air"]) : NaN,
      scoreAxes.speed ? slotValue(buffer, slots["current.axis.speed"]) : NaN,
      scoreAxes.grain ? slotValue(buffer, slots["current.axis.grain"]) : NaN,
      scoreAxes.elevation ? slotValue(buffer, slots["current.axis.elevation"]) : NaN,
      scoreAxes.amplitude ? slotValue(buffer, slots["current.axis.amplitude"]) : NaN,
      scoreAxes.impact ? slotValue(buffer, slots["current.axis.impact"]) : NaN,
      scoreAxes,
    ),
    state: incomingKinematicsFromValues(
      slotValue(buffer, slots["next.x"]),
      slotValue(buffer, slots["next.y"]),
      slotValue(buffer, slots["next.vx"]),
      slotValue(buffer, slots["next.vy"]),
      slotValue(buffer, slots["next.sledPoseDeg"]),
      slotValue(buffer, slots["next.sledPoseRateDegPerFrame"]),
    ),
    exitFrame: slotValue(buffer, slots["exit.frame"]),
    exitSpeed: slotValue(buffer, slots["exit.speed"]),
    nextMeanSpeedPx: slotValue(buffer, slots["next.meanSpeedPx"]),
    nextAirFraction: slotValue(buffer, slots["next.airFraction"]),
    nextGapFrameCount: slotValue(buffer, slots["next.frameCount"]),
    nextElevation: slotValue(buffer, slots["next.elevation"]),
  };
}

function slotValue(buffer: readonly number[], slot: number): number {
  return slot < 0 ? NaN : buffer[slot];
}

export function arcVectorModelFormCounts(model: ArcVectorResponseModel): Record<ArcVectorFitForm, number> {
  const counts: Record<ArcVectorFitForm, number> = {
    tensor_quadratic: 0,
    additive_quadratic: 0,
    linear: 0,
    constant: 0,
  };
  for (const entry of model.outputModels.values()) {
    counts[entry.model.form]++;
  }
  return counts;
}

export function arcVectorModelDegradedOutputCount(model: ArcVectorResponseModel): number {
  let count = 0;
  for (const entry of model.outputModels.values()) {
    if (entry.model.degraded) count++;
  }
  return count;
}

function fitValueModels(
  rows: readonly ArcVectorProbeRow[],
  spans: readonly number[],
  trainingKind: ArcVectorTrainingKind,
): Map<string, FittedOutputEntry> {
  const models = new Map<string, FittedOutputEntry>();
  const baseline = rows.find((row) => row.values.every((value) => value === 0));
  for (const key of outputKeys(rows)) {
    const finiteRows = rows.filter((row) => Number.isFinite(row.outputs[key]));
    if (finiteRows.length === 0) continue;
    const angle = isArcAngleOutput(key);
    const baselineValue = baseline?.outputs[key] ?? NaN;
    const ref = Number.isFinite(baselineValue) ? baselineValue : finiteRows[0].outputs[key];
    const fitRows = finiteRows.map((row) => ({
      values: row.values,
      value: angle ? unwrapAngle(row.outputs[key], ref) : row.outputs[key],
    }));
    const model = fitArcVectorOutput(fitRows, spans, trainingKind);
    if (model !== null) models.set(key, { angle, ref, model });
  }
  return models;
}

function outputKeys(rows: readonly ArcVectorProbeRow[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.outputs)) keys.add(key);
  }
  return [...keys].sort();
}

function fitArcVectorOutput(
  rows: ReadonlyArray<Readonly<{ values: readonly number[]; value: number }>>,
  spans: readonly number[],
  trainingKind: ArcVectorTrainingKind,
): ArcVectorFittedOutput | null {
  type Candidate = Readonly<{
    form: ArcVectorFitForm;
    features(values: readonly number[]): number[];
  }>;
  const candidates: Candidate[] = trainingKind === "joint"
    ? [
      { form: "tensor_quadratic", features: (values) => tensorQuadraticFeatures(values, spans) },
      { form: "additive_quadratic", features: (values) => additiveQuadraticFeatures(values, spans) },
      { form: "linear", features: (values) => linearFeatures(values, spans) },
      { form: "constant", features: () => [1] },
    ]
    : [
      { form: "additive_quadratic", features: (values) => additiveQuadraticFeatures(values, spans) },
      { form: "linear", features: (values) => linearFeatures(values, spans) },
      { form: "constant", features: () => [1] },
    ];
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    const fitted = fitLinearLeastSquares(rows.map((row) => ({
      features: candidate.features(row.values),
      value: row.value,
    })));
    if (fitted === null) continue;
    return {
      form: candidate.form,
      degraded: index > 0,
      coefficients: fitted.coefficients,
    };
  }
  return null;
}

/** Predict the selected entries positionally, in `outputEntries` order. Same
 *  features, same coefficient order, same arithmetic as the record form. */
function predictReadoutValuesInto(
  entries: readonly PredictEntry[],
  indices: readonly number[],
  values: readonly number[],
  spans: readonly number[],
  buffer: number[],
): void {
  let tensorQuadratic: number[] | null = null;
  let additiveQuadratic: number[] | null = null;
  let linear: number[] | null = null;
  let constant: number[] | null = null;
  for (let i = 0; i < indices.length; i++) {
    const entryIndex = indices[i];
    const entry = entries[entryIndex];
    let features: number[];
    switch (entry.form) {
      case "tensor_quadratic":
        features = tensorQuadratic ??= tensorQuadraticFeatures(values, spans);
        break;
      case "additive_quadratic":
        features = additiveQuadratic ??= additiveQuadraticFeatures(values, spans);
        break;
      case "linear":
        features = linear ??= linearFeatures(values, spans);
        break;
      case "constant":
        features = constant ??= [1];
        break;
    }
    const coefficients = entry.coefficients;
    let value = 0;
    for (let index = 0; index < features.length; index++) value += coefficients[index] * features[index];
    buffer[entryIndex] = entry.angle ? unwrapAngle(value, entry.ref) : value;
  }
}

function predictValues(
  entries: readonly PredictEntry[],
  values: readonly number[],
  spans: readonly number[],
): Record<string, number> {
  /* There are exactly four fit forms, so the per-call memo of computed feature
   * vectors is four slots rather than a Map allocated per call and probed once
   * per output. Each form is still built on first use, by the same function. */
  let tensorQuadratic: number[] | null = null;
  let additiveQuadratic: number[] | null = null;
  let linear: number[] | null = null;
  let constant: number[] | null = null;
  const out: Record<string, number> = {};
  for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
    const entry = entries[entryIndex];
    let features: number[];
    switch (entry.form) {
      case "tensor_quadratic":
        features = tensorQuadratic ??= tensorQuadraticFeatures(values, spans);
        break;
      case "additive_quadratic":
        features = additiveQuadratic ??= additiveQuadraticFeatures(values, spans);
        break;
      case "linear":
        features = linear ??= linearFeatures(values, spans);
        break;
      case "constant":
        features = constant ??= [1];
        break;
    }
    const coefficients = entry.coefficients;
    let value = 0;
    for (let index = 0; index < features.length; index++) value += coefficients[index] * features[index];
    out[entry.key] = entry.angle ? unwrapAngle(value, entry.ref) : value;
  }
  return out;
}

/* The three feature builders write one pre-sized array instead of composing
 * intermediates. `normalized` used to allocate a map result that was then
 * spread — three arrays per additive-quadratic vector, built once per fit form
 * per knob candidate. The values, their order, and the arithmetic are the
 * same; only the intermediates are gone. */

function linearFeatures(values: readonly number[], spans: readonly number[]): number[] {
  assertVectorLength(values, spans.length);
  const count = values.length;
  const features = new Array<number>(1 + count);
  features[0] = 1;
  for (let index = 0; index < count; index++) features[1 + index] = values[index] / spans[index];
  return features;
}

function additiveQuadraticFeatures(values: readonly number[], spans: readonly number[]): number[] {
  assertVectorLength(values, spans.length);
  const count = values.length;
  const features = new Array<number>(1 + 2 * count);
  features[0] = 1;
  for (let index = 0; index < count; index++) {
    const value = values[index] / spans[index];
    features[1 + index] = value;
    features[1 + count + index] = value * value;
  }
  return features;
}

/** Full degree-two tensor-product basis.  For signed-three probe points it
 * has exactly 3^d features, so a complete d-dimensional cube identifies it
 * without inventing interaction observations. */
function tensorQuadraticFeatures(values: readonly number[], spans: readonly number[]): number[] {
  assertVectorLength(values, spans.length);
  const count = values.length;
  let size = 1;
  for (let index = 0; index < count; index++) size *= 3;
  /* Expanded in place, back to front, so each prefix is read before anything
   * writes over it: processing prefix `p` writes 3p..3p+2, which never reaches
   * below p. Same prefix-major order the flatMap produced, and `prefix * 1` is
   * exactly `prefix`. */
  const features = new Array<number>(size);
  features[0] = 1;
  let width = 1;
  for (let index = 0; index < count; index++) {
    const value = values[index] / spans[index];
    const squared = value * value;
    for (let prefixIndex = width - 1; prefixIndex >= 0; prefixIndex--) {
      const prefix = features[prefixIndex];
      features[3 * prefixIndex] = prefix;
      features[3 * prefixIndex + 1] = prefix * value;
      features[3 * prefixIndex + 2] = prefix * squared;
    }
    width *= 3;
  }
  return features;
}

function assertVectorLength(values: readonly number[], expected: number): void {
  if (values.length !== expected) {
    throw new Error(`arc vector has ${values.length} values for ${expected} dimensions`);
  }
  for (const value of values) {
    if (!Number.isFinite(value)) throw new Error("arc vector contains a non-finite value");
  }
}

function unwrapAngle(value: number, reference: number): number {
  return reference + normalizeAngleDeg(value - reference);
}
