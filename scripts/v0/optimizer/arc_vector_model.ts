/**
 * Dimension-generic local response models for arc-control experiments.
 *
 * The established `arc_model.ts` model intentionally remains a two-coordinate
 * production adapter.  This module is the explicit alternative for an ordered
 * knob vector of any length: values stay positional all the way from probe to
 * prediction, so no third control can be silently folded into either legacy
 * coordinate.
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
  latentOutputs?: Readonly<Record<string, number>>;
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

export type ArcVectorResponseModel = Readonly<{
  dimensions: number;
  spans: readonly number[];
  trainingKind: ArcVectorTrainingKind;
  context: JointArcResponseContext;
  outputModels: ReadonlyMap<string, FittedOutputEntry>;
  latentModels: ReadonlyMap<string, FittedOutputEntry>;
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
  return {
    dimensions: spans.length,
    spans: [...spans],
    trainingKind,
    context,
    outputModels: fitValueModels(rows, spans, trainingKind, "outputs"),
    latentModels: fitValueModels(rows, spans, trainingKind, "latentOutputs"),
  };
}

/** Complete the same canonical output vector as the legacy response model. */
export function predictArcVectorOutputs(
  model: ArcVectorResponseModel,
  values: readonly number[],
): Record<string, number> {
  assertVectorLength(values, model.dimensions);
  const featureCache = new Map<ArcVectorFitForm, number[]>();
  const direct = predictValues(model.outputModels, values, model.spans, featureCache);
  const latent = predictValues(model.latentModels, values, model.spans, featureCache);
  return completeArcPrediction(direct, latent, model.context);
}

export function arcVectorModelFormCounts(model: ArcVectorResponseModel): Record<ArcVectorFitForm, number> {
  const counts: Record<ArcVectorFitForm, number> = {
    tensor_quadratic: 0,
    additive_quadratic: 0,
    linear: 0,
    constant: 0,
  };
  for (const entry of [...model.outputModels.values(), ...model.latentModels.values()]) {
    counts[entry.model.form]++;
  }
  return counts;
}

export function arcVectorModelDegradedOutputCount(model: ArcVectorResponseModel): number {
  let count = 0;
  for (const entry of [...model.outputModels.values(), ...model.latentModels.values()]) {
    if (entry.model.degraded) count++;
  }
  return count;
}

type ValueSource = "outputs" | "latentOutputs";

function fitValueModels(
  rows: readonly ArcVectorProbeRow[],
  spans: readonly number[],
  trainingKind: ArcVectorTrainingKind,
  source: ValueSource,
): Map<string, FittedOutputEntry> {
  const models = new Map<string, FittedOutputEntry>();
  const baseline = rows.find((row) => row.values.every((value) => value === 0));
  for (const key of outputKeys(rows, source)) {
    const finiteRows = rows.filter((row) => Number.isFinite(valueFrom(row, source, key)));
    if (finiteRows.length === 0) continue;
    const angle = isArcAngleOutput(key);
    const baselineValue = baseline === undefined ? NaN : valueFrom(baseline, source, key);
    const ref = Number.isFinite(baselineValue) ? baselineValue : valueFrom(finiteRows[0], source, key);
    const fitRows = finiteRows.map((row) => ({
      values: row.values,
      value: angle ? unwrapAngle(valueFrom(row, source, key), ref) : valueFrom(row, source, key),
    }));
    const model = fitArcVectorOutput(fitRows, spans, trainingKind);
    if (model !== null) models.set(key, { angle, ref, model });
  }
  return models;
}

function outputKeys(rows: readonly ArcVectorProbeRow[], source: ValueSource): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    const values = source === "outputs" ? row.outputs : row.latentOutputs;
    for (const key of Object.keys(values ?? {})) keys.add(key);
  }
  return [...keys].sort();
}

function valueFrom(row: ArcVectorProbeRow, source: ValueSource, key: string): number {
  return (source === "outputs" ? row.outputs : row.latentOutputs)?.[key] ?? NaN;
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
  models: ReadonlyMap<string, FittedOutputEntry>,
  values: readonly number[],
  spans: readonly number[],
  featureCache: Map<ArcVectorFitForm, number[]>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, entry] of models) {
    const features = featureCache.get(entry.model.form) ?? vectorFeatures(entry.model.form, values, spans);
    featureCache.set(entry.model.form, features);
    let value = 0;
    for (let index = 0; index < features.length; index++) value += entry.model.coefficients[index] * features[index];
    out[key] = entry.angle ? unwrapAngle(value, entry.ref) : value;
  }
  return out;
}

function vectorFeatures(form: ArcVectorFitForm, values: readonly number[], spans: readonly number[]): number[] {
  switch (form) {
    case "tensor_quadratic": return tensorQuadraticFeatures(values, spans);
    case "additive_quadratic": return additiveQuadraticFeatures(values, spans);
    case "linear": return linearFeatures(values, spans);
    case "constant": return [1];
  }
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
