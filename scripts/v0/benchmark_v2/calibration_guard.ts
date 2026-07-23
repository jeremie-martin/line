import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { benchmarkDecisionCalibrationPolicy } from "../../../benchmark/v2/decision-policy.ts";
import {
  benchmarkEvalPolicy,
  evalOperatingPoint,
  type CertifiedCellReference,
  type EvalCertificationArtifactPaths,
  type EvalOperatingPoint,
} from "../../../benchmark/v2/eval-policy.ts";
import { DECISION_INFERENCE_SOURCE_FILES } from "./decision_model.ts";
import { decisionProtocolFingerprint } from "./decision_protocol.ts";
import { EVAL_CHAIN_INFERENCE_SOURCE_FILES } from "./eval_chain_inference.ts";
import { CERTIFICATION_GENERATOR_SOURCE_FILES } from "./certification_identity.ts";
import { fingerprintFiles } from "./suite_model.ts";
import { registeredFixedNAsEvalPoint } from "./operating_points.ts";

export type DecisionContractIdentity = {
  inferenceFingerprint: string;
  protocolFingerprint: string;
  calibrationFingerprint: string;
};

export function requireCurrentDecisionCalibration(
  suiteFingerprint: string,
  calibrationPath = "benchmark/v2/studies/decision-calibration.json",
): DecisionContractIdentity {
  const absolute = resolve(calibrationPath);
  if (!existsSync(absolute)) throw new Error(`current decision calibration artifact is missing`);
  const calibration = JSON.parse(readFileSync(absolute, "utf8"));
  // Calibration binds the INFERENCE identity only (the code and constants
  // that map data to verdicts). Protocol-surface edits never invalidate
  // statistical evidence; they are re-stamped via `migrate --scope=protocol`.
  if (
    calibration.schema !== "line.benchmark-v2.decision-calibration.v2" ||
    calibration.suiteFingerprint !== suiteFingerprint ||
    calibration.decisionInferenceFingerprint !== fingerprintFiles(DECISION_INFERENCE_SOURCE_FILES)
  ) throw new Error(`decision calibration is stale for the current suite or inference implementation`);

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
    inferenceFingerprint: calibration.decisionInferenceFingerprint,
    protocolFingerprint: decisionProtocolFingerprint(),
    calibrationFingerprint: decisionCalibrationFingerprint(calibration),
  };
}

export type CertifiedOperatingPoint = {
  point: EvalOperatingPoint;
  /** Era-budget spend: the row's certified Wilson-upper null-accept bound. */
  spend: number;
  /** The true effect (headline points) at which the row's power is certified. */
  mde80: number;
  /** The certified seed-block SE envelope (the power cell's mean realized SE). */
  envelopeSe: number;
  /** Binds the exact evidence that authorized this point; declarations pin it. */
  certificationFingerprint: string;
  artifacts: {
    menuCertification: { path: string; sha256: string };
    holdoutValidation: { path: string; sha256: string };
  };
};

/**
 * The eval chain's operating-point guard. A menu row in eval-policy.ts is an
 * offer; this function is the authorization: the row's cells must meet the
 * policy bars in the CURRENT certification artifacts, and those artifacts
 * must be current for the suite and the inference identity. Every certified
 * number the chain relies on (spend, envelope) is read from the artifacts
 * here — never hardcoded.
 */
export function requireCertifiedOperatingPoint(
  mode: "improvement" | "simplification",
  margin: number | null,
  depth: number,
  suiteFingerprint: string,
  artifactPaths?: EvalCertificationArtifactPaths,
): CertifiedOperatingPoint {
  const menuPoint = evalOperatingPoint(mode, margin, depth);
  const point = menuPoint ?? (
    mode === "improvement" && margin === null ? registeredFixedNAsEvalPoint(depth) : undefined
  );
  if (point === undefined) {
    const menu = benchmarkEvalPolicy.operatingPoints
      .map((row) => `${row.id} (${row.mode}${row.margin === null ? "" : ` m=${row.margin}`}, depth ${row.depth})`)
      .join(", ");
    throw new Error(
      `operating point (${mode}${margin === null ? "" : ` m=${margin}`}, depth ${depth}) is not on the certified menu; certified rows: ${menu}`,
    );
  }
  // Fixed-N points retain every safety/error-rate check but report power as a
  // diagnostic.  This prevents a hard +5-power menu threshold from rejecting
  // a demonstrably large actual candidate at a perfectly calibrated N.
  const powerIsDiagnostic = menuPoint === undefined;
  const paths = artifactPaths ?? point.certification;
  const inferenceFingerprint = fingerprintFiles(DECISION_INFERENCE_SOURCE_FILES);
  const evalChainInferenceFingerprint = fingerprintFiles(EVAL_CHAIN_INFERENCE_SOURCE_FILES);
  const certificationGeneratorFingerprint = fingerprintFiles(CERTIFICATION_GENERATOR_SOURCE_FILES);
  const verifiedReferences = new Set<string>();
  const menu = readCertificationArtifact(
    paths.menuCertification,
    "certify",
    suiteFingerprint,
    inferenceFingerprint,
    evalChainInferenceFingerprint,
    certificationGeneratorFingerprint,
    verifiedReferences,
    !powerIsDiagnostic,
  );
  const holdout = readCertificationArtifact(
    paths.holdoutValidation,
    "holdout",
    suiteFingerprint,
    inferenceFingerprint,
    evalChainInferenceFingerprint,
    certificationGeneratorFingerprint,
    verifiedReferences,
    !powerIsDiagnostic,
  );
  if (JSON.stringify(menu.report.predeclared) !== JSON.stringify(holdout.report.predeclared)) {
    throw new Error(`menu and holdout certification predeclarations differ`);
  }
  for (const artifact of [menu, holdout]) {
    if (
      artifact.report.predeclared?.depth !== point.depth ||
      artifact.report.predeclared?.criticalAlpha !== point.criticalAlpha ||
      artifact.report.predeclared?.futilityAlpha !== point.futilityAlpha ||
      JSON.stringify(artifact.report.predeclared?.futilitySchedule) !== JSON.stringify([...point.futilitySchedule])
    ) throw new Error(`${artifact.path} does not certify the declared depth, alpha levels, and futility schedule`);
    assertWorkerExecutionPlan(artifact.report, artifact.path);
  }
  const bars = benchmarkEvalPolicy.bars;
  for (const artifact of [menu, holdout]) {
    const declaredBars = artifact.report.predeclared?.bars;
    if (
      declaredBars?.nullFalseAcceptWilsonUpperMax !== bars.nullFalseAcceptWilsonUpperMax ||
      declaredBars?.boundaryFalseAcceptWilsonUpperMax !== bars.nullFalseAcceptWilsonUpperMax ||
      declaredBars?.futilityNullFalseAcceptWilsonUpperMax !== bars.nullFalseAcceptWilsonUpperMax ||
      declaredBars?.powerAtPlus5WilsonLowerMin !== bars.powerWilsonLowerMin ||
      declaredBars?.noninferiorityPowerWilsonLowerMin !== bars.powerWilsonLowerMin ||
      declaredBars?.futilityNetPowerAtPlus5WilsonLowerMin !== bars.powerWilsonLowerMin
    ) throw new Error(`certification bars in ${artifact.path} do not match the eval policy bars`);
    if (powerIsDiagnostic) {
      for (const safetyBar of [
        "improve_null_empirical",
        "improve_null_validity_flips",
        "improve_null_hard_zero",
        "simplify_m5_boundary",
        "futility_null",
        "determinism",
      ]) {
        if (artifact.report.barsMet?.[safetyBar] !== true) {
          throw new Error(`${artifact.path} did not meet fixed-N safety bar ${safetyBar}`);
        }
      }
      if (artifact.report.mode === "holdout" && artifact.report.barsMet?.truth_transfer !== true) {
        throw new Error(`${artifact.path} did not meet fixed-N frozen-truth transfer`);
      }
    }
  }

  const power = certifiedRate(menu.report, point.cells.power, menu.path);
  if (!powerIsDiagnostic && power.wilson95[0] < bars.powerWilsonLowerMin) {
    throw new Error(`certified power lower bound ${power.wilson95[0]} for ${point.id} is below ${bars.powerWilsonLowerMin}`);
  }
  const nullRates: ValidatedRate[] = [];
  for (const cell of [point.cells.spendNull, ...point.cells.additionalNulls]) {
    for (const artifact of [menu, holdout]) {
      const rate = certifiedRate(artifact.report, cell, artifact.path);
      nullRates.push(rate);
      if (rate.wilson95[1] > bars.nullFalseAcceptWilsonUpperMax) {
        throw new Error(`${cell.id} false-accept upper bound ${rate.wilson95[1]} in ${artifact.path} exceeds ${bars.nullFalseAcceptWilsonUpperMax}`);
      }
    }
  }
  const powerCell = findCertificationCell(menu.report, point.cells.power.id, menu.path);
  const envelopeSe = powerCell.combined?.meanSeedBlockSe;
  if (typeof envelopeSe !== "number" || !(envelopeSe > 0)) {
    throw new Error(`certified SE envelope is missing from ${menu.path}`);
  }

  const certificationFingerprint = sha256(Buffer.from(JSON.stringify({
    menuCertification: menu.sha256,
    holdoutValidation: holdout.sha256,
    powerGrid: menu.report.upstream?.powerGrid?.sha256,
    probeFutility: menu.report.upstream?.probeFutility?.sha256,
    evalPolicy: fingerprintFiles(["benchmark/v2/eval-policy.ts"]),
    evalChainInference: evalChainInferenceFingerprint,
    certificationGenerator: certificationGeneratorFingerprint,
    menuIndependentReference: menu.report.independentReference?.artifactSha256,
    menuIndependentReferenceRaw: menu.report.independentReference?.rawSha256,
    menuOriginalReference: menu.report.originalReference?.artifactSha256,
    menuOriginalReferenceRaw: menu.report.originalReference?.rawSha256,
    holdoutIndependentReference: holdout.report.independentReference?.artifactSha256,
    holdoutIndependentReferenceRaw: holdout.report.independentReference?.rawSha256,
    holdoutOriginalReference: holdout.report.originalReference?.artifactSha256,
    holdoutOriginalReferenceRaw: holdout.report.originalReference?.rawSha256,
    operatingPointId: point.id,
  })));
  return {
    point,
    spend: Math.max(...nullRates.map((rate) => rate.wilson95[1])),
    mde80: point.certifiedDetectableEffect,
    envelopeSe,
    certificationFingerprint,
    artifacts: {
      menuCertification: { path: menu.path, sha256: menu.sha256 },
      holdoutValidation: { path: holdout.path, sha256: holdout.sha256 },
    },
  };
}

const CERTIFICATION_REGEN_HINT =
  "regenerate both menu and holdout artifacts with " +
  "`node --import tsx scripts/benchmark/validate_independent_reference.ts --mode=certify " +
  "--allow-in-sample --independent-reference=benchmark/v2/runs/calibration-v2.6-pooled-reference-seeds-0-23.json.gz " +
  "--original-reference=benchmark/v2/runs/calibration-v2.6-pooled-reference-seeds-0-23.json.gz " +
  "--out=benchmark/v2/studies/menu-certification.json` and the corresponding `--mode=holdout` command " +
  "using calibration-v2.6-holdout-reference-seeds-36-47.json.gz and holdout-validation.json";

function readCertificationArtifact(
  path: string,
  expectedMode: "certify" | "holdout",
  suiteFingerprint: string,
  inferenceFingerprint: string,
  evalChainInferenceFingerprint: string,
  certificationGeneratorFingerprint: string,
  verifiedReferences: Set<string>,
  requireAllBars: boolean,
): { path: string; sha256: string; report: any } {
  const absolute = resolve(path);
  if (!existsSync(absolute)) {
    throw new Error(`certification artifact ${path} is missing; ${CERTIFICATION_REGEN_HINT}`);
  }
  const bytes = readFileSync(absolute);
  const report = JSON.parse(bytes.toString("utf8"));
  if (report.schema !== "line.benchmark-v2.independent-validation.v4" || report.mode !== expectedMode) {
    throw new Error(`certification artifact ${path} has an unsupported schema or mode`);
  }
  if (report.suiteFingerprint !== suiteFingerprint || report.decisionInferenceFingerprint !== inferenceFingerprint) {
    throw new Error(`certification artifact ${path} is stale for the current suite or inference identity; ${CERTIFICATION_REGEN_HINT}`);
  }
  if (report.evalChainInferenceFingerprint !== evalChainInferenceFingerprint) {
    throw new Error(`certification artifact ${path} is stale for the current eval-chain inference implementation; ${CERTIFICATION_REGEN_HINT}`);
  }
  if (report.certificationGeneratorFingerprint !== certificationGeneratorFingerprint) {
    throw new Error(`certification artifact ${path} is stale for the current certification generator or methodology; ${CERTIFICATION_REGEN_HINT}`);
  }
  requireReferenceArtifact(report.independentReference, `${expectedMode} independent reference`, verifiedReferences);
  requireReferenceArtifact(report.originalReference, `${expectedMode} original reference`, verifiedReferences);
  for (const [name, reference] of Object.entries(report.upstream ?? {})) {
    requireArtifact(
      (reference as any)?.path,
      (reference as any)?.sha256,
      `${expectedMode} certification upstream ${name}`,
    );
  }
  if (requireAllBars && report.allBarsMet !== true) {
    throw new Error(`certification artifact ${path} did not meet its predeclared bars; the menu is not certified`);
  }
  return { path, sha256: sha256(bytes), report };
}

/** The certificate must show the exact plan that was sent to its worker
 * simulations. This protects the configuration handoff independently of the
 * report's outer command-line declaration. */
function assertWorkerExecutionPlan(report: any, path: string): void {
  const plan = report.workerExecutionPlan;
  const declaration = report.predeclared;
  if (
    typeof plan?.depth !== "number" ||
    JSON.stringify(plan.futilitySchedule) !== JSON.stringify(declaration?.futilitySchedule) ||
    plan.depth !== declaration?.depth ||
    plan.futilityAlpha !== declaration?.futilityAlpha ||
    plan.criticalAlpha !== declaration?.criticalAlpha ||
    plan.centralCriticalLevel !== declaration?.centralCriticalLevel ||
    plan.centralNominalLevel !== declaration?.centralNominalLevel
  ) throw new Error(`${path} worker execution plan does not match its predeclaration`);
  if (report.workerExecutionPlanFingerprint !== sha256(JSON.stringify(plan))) {
    throw new Error(`${path} worker execution plan fingerprint is invalid`);
  }
}

function requireReferenceArtifact(reference: any, label: string, verified: Set<string>): void {
  if (
    typeof reference?.path !== "string" ||
    !/^[a-f0-9]{64}$/.test(reference?.artifactSha256 ?? "") ||
    !/^[a-f0-9]{64}$/.test(reference?.rawSha256 ?? "")
  ) throw new Error(`${label} identity is incomplete`);
  const cacheKey = `${reference.path}\0${reference.artifactSha256}\0${reference.rawSha256}`;
  if (verified.has(cacheKey)) return;
  const absolute = resolve(reference.path);
  if (!existsSync(absolute)) throw new Error(`${label} is missing`);
  const stat = statSync(absolute);
  const cached = verifiedReferenceArtifacts.get(cacheKey);
  if (
    cached !== undefined && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs &&
    cached.ino === stat.ino
  ) {
    verified.add(cacheKey);
    return;
  }
  const artifact = readFileSync(absolute);
  if (sha256(artifact) !== reference.artifactSha256) throw new Error(`${label} artifact checksum mismatch`);
  const raw = reference.path.endsWith(".gz") ? gunzipSync(artifact) : artifact;
  if (sha256(raw) !== reference.rawSha256) throw new Error(`${label} raw checksum mismatch`);
  verifiedReferenceArtifacts.set(cacheKey, { size: stat.size, mtimeMs: stat.mtimeMs, ino: stat.ino });
  verified.add(cacheKey);
}

const verifiedReferenceArtifacts = new Map<string, { size: number; mtimeMs: number; ino: number }>();

function findCertificationCell(report: any, id: string, path: string): any {
  const cell = (report.cells ?? []).find((entry: any) => entry.id === id);
  if (cell === undefined) throw new Error(`certification cell ${id} is missing from ${path}`);
  return cell;
}

function certifiedRate(
  report: any,
  reference: CertifiedCellReference,
  path: string,
): ValidatedRate {
  const cell = findCertificationCell(report, reference.id, path);
  const combined = cell.combined;
  if (!Number.isSafeInteger(combined?.trials) || combined.trials < 1000) {
    throw new Error(`certification cell ${reference.id} in ${path} has fewer than 1000 trials`);
  }
  const value = combined[reference.statistic];
  if (value === null || value === undefined) {
    throw new Error(`certification cell ${reference.id} in ${path} lacks the ${reference.statistic} statistic`);
  }
  return validatedRate(value, combined.trials, `${reference.id} ${reference.statistic}`);
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

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}
