import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { benchmarkSequentialEvalPolicy } from "../../../benchmark/v2/eval-policy.ts";
import { studentTCdf, type ConfidenceBounds } from "./decision_model.ts";
import { BENCHMARK_SCORING_PROTOCOL_FINGERPRINT, fingerprintFiles } from "./suite_model.ts";

export const SEQUENTIAL_EVAL_CALIBRATION_SCHEMA =
  "line.benchmark-v2.sequential-eval-calibration.v1" as const;

export const SEQUENTIAL_EVAL_INFERENCE_SOURCE_FILES = [
  "benchmark/v2/eval-policy.ts",
  "scripts/v0/benchmark_v2/decision_model.ts",
  "scripts/v0/benchmark_v2/sequential_inference.ts",
] as const;

export type SequentialAction = "accept" | "reject" | "continue" | "inconclusive";
export type SerializableTStatistic = number | "positive-infinity" | "negative-infinity";

export type SequentialLookDecision = {
  schema: "line.benchmark-v2.sequential-look-decision.v2";
  depth: number;
  maximumDepth: number;
  informationFraction: number;
  estimate: number;
  standardError: number;
  degreesOfFreedom: number | null;
  tStatistic: SerializableTStatistic;
  directionalProbability: number;
  requiredT: number;
  requiredDirectionalProbability: number;
  action: SequentialAction;
};

export type SequentialCalibration = {
  schema: typeof SEQUENTIAL_EVAL_CALIBRATION_SCHEMA;
  suiteFingerprint: string;
  scoringProtocolFingerprint: string;
  generatorFingerprint: string;
  policyFingerprint: string;
  inferenceFingerprint: string;
  boundaryConstant: number;
  calibration: { allBarsMet: boolean };
  validation: { allBarsMet: boolean };
  references: Array<{ path: string; sha256: string; rawArchiveSha256: string }>;
};

export function sequentialEvalInferenceFingerprint(): string {
  return fingerprintFiles([...SEQUENTIAL_EVAL_INFERENCE_SOURCE_FILES]);
}

export function sequentialEvalPolicyFingerprint(): string {
  return createHash("sha256").update(JSON.stringify(benchmarkSequentialEvalPolicy)).digest("hex");
}

export function sequentialEvalCalibrationFingerprint(
  path = "benchmark/v2/studies/sequential-eval-calibration.json",
): string {
  return sha256(readFileSync(resolve(path)));
}

export function sequentialEvalCalibrationGeneratorFingerprint(): string {
  return fingerprintFiles(["scripts/benchmark/calibrate_sequential_eval.ts"]);
}

/** Reference-t probability that the paired headline delta is positive.
 *
 * This uses the same seed-block SE and effective degrees of freedom as the
 * fixed-look confidence report. It is an interpretable directional summary;
 * repeated-look error control comes from the calibrated boundary, not from
 * treating this number as an unadjusted p-value.
 */
export function referenceTDirectionalProbability(confidence: ConfidenceBounds): number {
  if (!confidence.available) return 0.5;
  if (confidence.standardError === 0) {
    return confidence.estimate > 0 ? 1 : confidence.estimate < 0 ? 0 : 0.5;
  }
  const degreesOfFreedom = confidence.degreesOfFreedom ?? Infinity;
  return referenceTCdf(confidence.estimate / confidence.standardError, degreesOfFreedom);
}

export function sequentialRequiredT(depth: number, boundaryConstant: number): number {
  assertLook(depth);
  if (!(boundaryConstant > 0) || !Number.isFinite(boundaryConstant)) {
    throw new Error(`sequential boundary constant must be positive and finite`);
  }
  return boundaryConstant / Math.sqrt(depth / benchmarkSequentialEvalPolicy.maximumDepth);
}

export function sequentialLookDecision(
  confidence: ConfidenceBounds,
  depth: number,
  boundaryConstant: number,
): SequentialLookDecision {
  assertLook(depth);
  const requiredT = sequentialRequiredT(depth, boundaryConstant);
  const degreesOfFreedom = confidence.degreesOfFreedom ?? Infinity;
  const tStatistic = !confidence.available
    ? 0
    : confidence.standardError === 0
      ? confidence.estimate > 0 ? Infinity : confidence.estimate < 0 ? -Infinity : 0
      : confidence.estimate / confidence.standardError;
  const probability = referenceTDirectionalProbability(confidence);
  const requiredProbability = referenceTCdf(requiredT, degreesOfFreedom);
  const finalLook = depth === benchmarkSequentialEvalPolicy.maximumDepth;
  const action: SequentialAction = tStatistic >= requiredT
    ? "accept"
    : benchmarkSequentialEvalPolicy.symmetricHarmBoundary && tStatistic <= -requiredT
      ? "reject"
      : finalLook
        ? "inconclusive"
        : "continue";
  return {
    schema: "line.benchmark-v2.sequential-look-decision.v2",
    depth,
    maximumDepth: benchmarkSequentialEvalPolicy.maximumDepth,
    informationFraction: depth / benchmarkSequentialEvalPolicy.maximumDepth,
    estimate: confidence.estimate,
    standardError: confidence.standardError,
    degreesOfFreedom: confidence.degreesOfFreedom,
    tStatistic: serializeTStatistic(tStatistic),
    directionalProbability: round(probability),
    requiredT: round(requiredT),
    requiredDirectionalProbability: round(requiredProbability),
    action,
  };
}

/** Student-t converges to the standard normal when the effective degrees of
 * freedom are unavailable. Keep that limiting case explicit: passing Infinity
 * through the incomplete-beta implementation produces NaN. */
function referenceTCdf(value: number, degreesOfFreedom: number): number {
  return Number.isFinite(degreesOfFreedom) ? studentTCdf(value, degreesOfFreedom) : normalCdf(value);
}

function normalCdf(value: number): number {
  if (value === Infinity) return 1;
  if (value === -Infinity) return 0;
  if (value === 0) return 0.5;
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = sign * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t +
    0.254829592) * t * Math.exp(-x * x));
  return 0.5 * (1 + erf);
}

function serializeTStatistic(value: number): SerializableTStatistic {
  if (value === Infinity) return "positive-infinity";
  if (value === -Infinity) return "negative-infinity";
  return round(value);
}

export function requireSequentialEvalCalibration(
  suiteFingerprint: string,
  path = "benchmark/v2/studies/sequential-eval-calibration.json",
): SequentialCalibration {
  const absolute = resolve(path);
  if (!existsSync(absolute)) throw new Error(`sequential eval calibration is missing; regenerate it before paid eval`);
  const calibration = JSON.parse(readFileSync(absolute, "utf8")) as SequentialCalibration;
  if (
    calibration.schema !== SEQUENTIAL_EVAL_CALIBRATION_SCHEMA ||
    calibration.suiteFingerprint !== suiteFingerprint ||
    calibration.scoringProtocolFingerprint !== BENCHMARK_SCORING_PROTOCOL_FINGERPRINT ||
    calibration.generatorFingerprint !== sequentialEvalCalibrationGeneratorFingerprint() ||
    calibration.policyFingerprint !== sequentialEvalPolicyFingerprint() ||
    calibration.inferenceFingerprint !== sequentialEvalInferenceFingerprint() ||
    !(calibration.boundaryConstant > 0) ||
    calibration.calibration?.allBarsMet !== true ||
    calibration.validation?.allBarsMet !== true ||
    !Array.isArray(calibration.references) || calibration.references.length < 2
  ) throw new Error(`sequential eval calibration is stale or did not meet its safety bars`);
  for (const reference of calibration.references) {
    const bytes = readFileSync(resolve(reference.path));
    if (sha256(bytes) !== reference.sha256) throw new Error(`sequential calibration reference changed: ${reference.path}`);
    const index = JSON.parse(bytes.toString("utf8"));
    if (index.archiveSha256 !== reference.rawArchiveSha256) {
      throw new Error(`sequential calibration raw-archive binding changed: ${reference.path}`);
    }
  }
  return calibration;
}

function assertLook(depth: number): void {
  if (!(benchmarkSequentialEvalPolicy.looks as readonly number[]).includes(depth)) {
    throw new Error(`N=${depth} is not a declared sequential look`);
  }
}

function round(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 1e8) / 1e8;
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
