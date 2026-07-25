/**
 * Dimension-generic local response models for arc-control experiments.
 *
 * Values stay positional from probe to prediction, so every declared physical
 * control remains explicit.
 */
import {
  completeArcPrediction,
  fitLinearLeastSquares,
  isArcAngleOutput,
  normalizeAngleDeg,
  type JointArcResponseContext,
} from "./arc_model.ts";

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

export type ArcVectorResponseModel = Readonly<{
  dimensions: number;
  spans: readonly number[];
  trainingKind: ArcVectorTrainingKind;
  context: JointArcResponseContext;
  outputModels: ReadonlyMap<string, FittedOutputEntry>;
  outputEntries: readonly PredictEntry[];
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
  return {
    dimensions: spans.length,
    spans: [...spans],
    trainingKind,
    context,
    outputModels,
    outputEntries: flattenOutputModels(outputModels),
  };
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

function linearFeatures(values: readonly number[], spans: readonly number[]): number[] {
  return [1, ...normalized(values, spans)];
}

function additiveQuadraticFeatures(values: readonly number[], spans: readonly number[]): number[] {
  const normalizedValues = normalized(values, spans);
  return [1, ...normalizedValues, ...normalizedValues.map((value) => value * value)];
}

/** Full degree-two tensor-product basis.  For signed-three probe points it
 * has exactly 3^d features, so a complete d-dimensional cube identifies it
 * without inventing interaction observations. */
function tensorQuadraticFeatures(values: readonly number[], spans: readonly number[]): number[] {
  let features = [1];
  for (const value of normalized(values, spans)) {
    const basis = [1, value, value * value];
    features = features.flatMap((prefix) => basis.map((term) => prefix * term));
  }
  return features;
}

function normalized(values: readonly number[], spans: readonly number[]): number[] {
  assertVectorLength(values, spans.length);
  return values.map((value, index) => value / spans[index]);
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
