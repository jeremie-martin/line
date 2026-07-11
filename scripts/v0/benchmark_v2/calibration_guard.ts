import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { benchmarkDecisionCalibrationPolicy } from "../../../benchmark/v2/decision-policy.ts";
import { DECISION_INFERENCE_SOURCE_FILES } from "./decision_model.ts";
import { DECISION_SOURCE_FILES, fingerprintFiles } from "./suite_model.ts";

export type DecisionContractIdentity = {
  decisionFingerprint: string;
  calibrationFingerprint: string;
};

export function requireCurrentDecisionCalibration(
  suiteFingerprint: string,
  calibrationPath = "benchmark/v2/studies/decision-calibration.json",
): DecisionContractIdentity {
  const absolute = resolve(calibrationPath);
  if (!existsSync(absolute)) throw new Error(`current decision calibration artifact is missing`);
  const calibration = JSON.parse(readFileSync(absolute, "utf8"));
  if (
    calibration.schema !== "line.benchmark-v2.decision-calibration.v1" ||
    calibration.suiteFingerprint !== suiteFingerprint ||
    calibration.decisionFingerprint !== fingerprintFiles(DECISION_SOURCE_FILES)
  ) throw new Error(`decision calibration is stale for the current suite or decision implementation`);

  const coveragePath = resolve(calibration.coverageStudy?.path ?? "");
  if (!existsSync(coveragePath)) throw new Error(`calibrated zero-inflated coverage evidence is missing`);
  const coverageBytes = readFileSync(coveragePath);
  const coverage = JSON.parse(coverageBytes.toString("utf8"));
  if (
    sha256(coverageBytes) !== calibration.coverageStudy?.sha256 ||
    coverage.schema !== "line.benchmark-v2.decision-coverage-study.v3" ||
    coverage.suiteFingerprint !== suiteFingerprint ||
    coverage.decisionInferenceFingerprint !== fingerprintFiles(DECISION_INFERENCE_SOURCE_FILES)
  ) throw new Error(`zero-inflated coverage evidence is stale for the current decision rule`);
  assertDecisionCoverageAdequate(coverage);

  requireArtifact(
    coverage.reference,
    coverage.referenceArtifactSha256,
    "zero-inflated coverage reference",
  );
  for (const name of ["identical", "knownBroadDegradation", "impactContractFailure"] as const) {
    const control = calibration.controls?.[name];
    requireArtifact(control?.baseArchive, control?.baseArchiveSha256, `${name} base control`);
    requireArtifact(control?.candidateArchive, control?.candidateArchiveSha256, `${name} candidate control`);
  }
  return {
    decisionFingerprint: calibration.decisionFingerprint,
    calibrationFingerprint: decisionCalibrationFingerprint(calibration),
  };
}

export function decisionCalibrationFingerprint(calibration: any): string {
  const { generatedAt: _generatedAt, ...stable } = calibration;
  return sha256(Buffer.from(JSON.stringify(stable)));
}

export function assertDecisionCoverageAdequate(coverage: any): void {
  const policy = benchmarkDecisionCalibrationPolicy;
  if (!Number.isSafeInteger(coverage.trials) || coverage.trials < policy.minimumTrialsPerCell) {
    throw new Error(`decision coverage has fewer than ${policy.minimumTrialsPerCell} trials per cell`);
  }
  const nullRows = coverage.results ?? [];
  const poweredRows = coverage.powerResults ?? [];
  const safetyRows = coverage.safetyResults ?? [];
  const diagnosticRows = coverage.diagnosticResults ?? [];
  for (const scenario of policy.requiredNullScenarios) {
    const row: any = nullRows.find((entry: any) =>
      entry.scenario === scenario && entry.seedsPerBudget === policy.seedsPerBudget
    );
    requireCoverageRow(row, scenario, "improvement", null, coverage.trials);
    const falseAccept = validatedRate(row.falseAccept, row.trials, `${scenario} false accept`);
    const falseReject = validatedRate(row.falseReject, row.trials, `${scenario} false reject`);
    if (falseAccept.count !== row.positiveOutcome.count || falseReject.count !== row.negativeOutcome.count) {
      throw new Error(`${scenario} false-decision counts disagree with formal outcomes`);
    }
    requireUpperBound(falseAccept, policy.maximumFalseDecisionWilsonUpper, `${scenario} false accept`);
    requireUpperBound(falseReject, policy.maximumFalseDecisionWilsonUpper, `${scenario} false reject`);
  }
  for (const scenario of policy.requiredPoweredScenarios) {
    const row: any = poweredRows.find((entry: any) =>
      entry.scenario === scenario && entry.seedsPerBudget === policy.seedsPerBudget
    );
    const simplification = scenario === "paired_empirical_noninferiority_inside";
    requireCoverageRow(
      row,
      scenario,
      simplification ? "simplification" : "improvement",
      simplification ? policy.simplificationStudyMargin : null,
      coverage.trials,
    );
    const lower = validatedRate(row.positiveOutcome, row.trials, `${scenario} positive outcome`).wilson95[0];
    if (lower < policy.minimumSupportedPowerWilsonLower) {
      throw new Error(`${scenario} power lower bound ${lower} is below ${policy.minimumSupportedPowerWilsonLower}`);
    }
  }
  for (const scenario of policy.requiredSafetyScenarios) {
    const row: any = safetyRows.find((entry: any) =>
      entry.scenario === scenario && entry.seedsPerBudget === policy.seedsPerBudget
    );
    requireCoverageRow(row, scenario, "simplification", policy.simplificationStudyMargin, coverage.trials);
    requireUpperBound(
      validatedRate(row.positiveOutcome, row.trials, `${scenario} positive outcome`),
      policy.maximumFalseDecisionWilsonUpper,
      `${scenario} false accept`,
    );
  }
  for (const scenario of policy.requiredDiagnosticScenarios) {
    const row: any = diagnosticRows.find((entry: any) =>
      entry.scenario === scenario && entry.seedsPerBudget === policy.seedsPerBudget
    );
    const simplification = scenario === "hard_zero_noninferiority_inside";
    requireCoverageRow(
      row,
      scenario,
      simplification ? "simplification" : "improvement",
      simplification ? policy.simplificationStudyMargin : null,
      coverage.trials,
    );
    requireUpperBound(
      validatedRate(row.negativeOutcome, row.trials, `${scenario} negative outcome`),
      policy.maximumFalseDecisionWilsonUpper,
      `${scenario} false reject`,
    );
  }
}

function requireCoverageRow(
  row: any,
  scenario: string,
  mode: "improvement" | "simplification",
  margin: number | null,
  coverageTrials: number,
): void {
  const policy = benchmarkDecisionCalibrationPolicy;
  if (
    row === undefined || row.seedsPerBudget !== policy.seedsPerBudget || row.mode !== mode || row.margin !== margin ||
    row.trials !== coverageTrials || row.trials < policy.minimumTrialsPerCell
  ) throw new Error(`${scenario} decision-coverage cell is missing or incomplete`);
  const central = validatedRate(row.centralCoverage, row.trials, `${scenario} central coverage`);
  const positive = validatedRate(row.positiveOutcome, row.trials, `${scenario} positive outcome`);
  const negative = validatedRate(row.negativeOutcome, row.trials, `${scenario} negative outcome`);
  const unresolved = validatedRate(row.unresolvedOutcome, row.trials, `${scenario} unresolved outcome`);
  if (positive.count + negative.count + unresolved.count !== row.trials) {
    throw new Error(`${scenario} outcome counts do not partition its trials`);
  }
  const lower = central.wilson95[0];
  if (lower < policy.minimumCoverageWilsonLower) {
    throw new Error(`${scenario} coverage lower bound ${lower} is below ${policy.minimumCoverageWilsonLower}`);
  }
}

function requireUpperBound(value: ValidatedRate, limit: number, label: string): void {
  const upper = value.wilson95[1];
  if (upper > limit) throw new Error(`${label} upper bound ${upper} exceeds ${limit}`);
}

type ValidatedRate = { count: number; rate: number; wilson95: [number, number] };

function validatedRate(value: any, trials: number, label: string): ValidatedRate {
  if (!Number.isSafeInteger(value?.count) || value.count < 0 || value.count > trials) {
    throw new Error(`${label} count is invalid`);
  }
  const expected = rateWithWilson(value.count, trials);
  if (
    value.rate !== expected.rate || !Array.isArray(value.wilson95) ||
    value.wilson95.length !== 2 || value.wilson95[0] !== expected.wilson95[0] ||
    value.wilson95[1] !== expected.wilson95[1]
  ) throw new Error(`${label} rate or Wilson interval is inconsistent with its count`);
  return expected;
}

function rateWithWilson(count: number, total: number): ValidatedRate {
  const z = 1.959963984540054;
  const p = count / total;
  const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const half = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator;
  return {
    count,
    rate: round(p),
    wilson95: [round(center - half), round(center + half)],
  };
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function requireArtifact(path: unknown, expectedSha256: unknown, label: string): void {
  if (typeof path !== "string" || typeof expectedSha256 !== "string" || expectedSha256.length !== 64) {
    throw new Error(`${label} identity is absent from decision calibration`);
  }
  const absolute = resolve(path);
  if (!existsSync(absolute) || sha256(readFileSync(absolute)) !== expectedSha256) {
    throw new Error(`${label} is missing or does not match decision calibration`);
  }
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
