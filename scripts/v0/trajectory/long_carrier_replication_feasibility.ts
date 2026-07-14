/**
 * Structural qualification contract for the long-carrier replication roster.
 *
 * This is deliberately separate from efficacy capture/assay evidence. A
 * qualified record says only that every declared source can supply the exact
 * frozen physical prefix under the fixed compiler epoch; it contains neither
 * a headline nor axis outcomes.
 */
import {
  LONG_CARRIER_REPLICATION_PROTOCOL,
  LONG_CARRIER_REPLICATION_SCOPE,
  type LongCarrierReplicationCase,
} from "./long_carrier_replication_protocol.ts";
import {
  LONG_CARRIER_COMPILER_IDENTITY_PROTOCOL,
  type LongCarrierReplicationCandidateIdentity,
} from "./long_carrier_replication_candidate.ts";
import { PHYSICAL_PREFIX_DONOR_SELECTION_RULE } from "./prefix_projection_contract.ts";
import { assertSealedReplicationRecord, type SealedReplicationRecord } from "./long_carrier_replication_records.ts";
import type { LongCarrierReplicationCaptureRuntimeIdentity } from "./long_carrier_replication_runtime.ts";
import {
  assertPostimpactV3FixtureIntegrity,
  sha256,
  stableJson,
} from "./postimpact_study_inputs.ts";

export const LONG_CARRIER_REPLICATION_FEASIBILITY_SCHEMA =
  "line.long-carrier-replication-feasibility.v3";

export type LongCarrierReplicationFeasibilityStatus = "available" | "unavailable" | "invalid";

export type LongCarrierReplicationFeasibilityWitness = {
  projectionRule: typeof PHYSICAL_PREFIX_DONOR_SELECTION_RULE;
  donorGap: number;
  donorSkippedContacts: 0;
  physicalPrefixFingerprint: string;
  materializedFingerprint: string;
  prefixNextLineId: number;
  cumulativeCost: number;
  targetPlanningStateFingerprint: string;
  targetProbeStateFingerprint: string;
  preTargetSledTraceFingerprint: string;
};

export type LongCarrierReplicationFeasibilityRow = {
  id: string;
  sourcePath: string;
  sourceFingerprintAtStart: string;
  sourceFingerprintAtEnd: string;
  targetGap: number;
  outgoingGap: number;
  outgoingIntervalFrames: number;
  materializedGapCount: number;
  status: LongCarrierReplicationFeasibilityStatus;
  failureCode: "no_clean_donor" | "target_unreached" | "capture_error" | null;
  witness: LongCarrierReplicationFeasibilityWitness | null;
  elapsedMs: number;
};

export type LongCarrierReplicationFeasibilityRecord = SealedReplicationRecord & {
  schema: typeof LONG_CARRIER_REPLICATION_FEASIBILITY_SCHEMA;
  scope: typeof LONG_CARRIER_REPLICATION_SCOPE;
  protocolFingerprint: string;
  environment: { LR_ENGINE: "wasm" };
  captureBudget: number;
  projectionRule: typeof PHYSICAL_PREFIX_DONOR_SELECTION_RULE;
  identities: {
    stable: boolean;
    feasibilitySourceAtStart: { fingerprint: string; sourceFiles: string[] };
    feasibilitySourceAtEnd: { fingerprint: string; sourceFiles: string[] };
    captureSourceAtStart: { fingerprint: string; sourceFiles: string[] };
    captureSourceAtEnd: { fingerprint: string; sourceFiles: string[] };
    captureRuntimeAtStart: LongCarrierReplicationCaptureRuntimeIdentity;
    captureRuntimeAtEnd: LongCarrierReplicationCaptureRuntimeIdentity;
    captureCandidateAtStart: LongCarrierReplicationCandidateIdentity;
    captureCandidateAtEnd: LongCarrierReplicationCandidateIdentity;
    panelSourceFingerprintsAtStart: Record<string, string>;
    panelSourceFingerprintsAtEnd: Record<string, string>;
  };
  rows: LongCarrierReplicationFeasibilityRow[];
  qualified: boolean;
};

export type LongCarrierReplicationFeasibilityBinding = {
  feasibilitySourceFingerprint: string;
  captureSourceFingerprint: string;
  captureRuntimeFingerprint: string;
  captureCandidateFingerprint: string;
  panelSourceFingerprints: Record<string, string>;
};

/** Validate a sealed mechanical record against the current V3 declaration. */
export function assertLongCarrierReplicationFeasibility(
  value: unknown,
  binding?: LongCarrierReplicationFeasibilityBinding,
): asserts value is LongCarrierReplicationFeasibilityRecord {
  assertSealedReplicationRecord(value, LONG_CARRIER_REPLICATION_FEASIBILITY_SCHEMA, "long-carrier feasibility record");
  const record = value as LongCarrierReplicationFeasibilityRecord;
  assertExactKeys(record, [
    "captureBudget",
    "environment",
    "identities",
    "projectionRule",
    "protocolFingerprint",
    "qualified",
    "recordFingerprint",
    "rows",
    "schema",
    "scope",
  ], "long-carrier feasibility record");
  if (
    record.scope !== LONG_CARRIER_REPLICATION_SCOPE ||
    record.protocolFingerprint !== sha256(stableJson(LONG_CARRIER_REPLICATION_PROTOCOL)) ||
    stableJson(record.environment) !== stableJson({ LR_ENGINE: "wasm" }) ||
    record.captureBudget !== LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget ||
    record.projectionRule !== PHYSICAL_PREFIX_DONOR_SELECTION_RULE
  ) {
    throw new Error("long-carrier feasibility record does not match the declared V3 protocol");
  }
  assertIdentities(record.identities);
  const expectedRows = LONG_CARRIER_REPLICATION_PROTOCOL.cases;
  if (!Array.isArray(record.rows) || record.rows.length !== expectedRows.length) {
    throw new Error("long-carrier feasibility record does not contain the complete declared roster");
  }
  for (const [index, expected] of expectedRows.entries()) {
    assertRow(record.rows[index], expected, record.identities);
  }
  const derivedQualified = record.identities.stable && record.rows.every((row) => row.status === "available");
  if (record.qualified !== derivedQualified) {
    throw new Error("long-carrier feasibility qualification does not match its rows and identities");
  }
  if (binding !== undefined) {
    if (
      record.identities.feasibilitySourceAtStart.fingerprint !== binding.feasibilitySourceFingerprint ||
      record.identities.captureSourceAtStart.fingerprint !== binding.captureSourceFingerprint ||
      record.identities.captureRuntimeAtStart.fingerprint !== binding.captureRuntimeFingerprint ||
      record.identities.captureCandidateAtStart.candidateFingerprint !== binding.captureCandidateFingerprint ||
      stableJson(record.identities.panelSourceFingerprintsAtStart) !== stableJson(binding.panelSourceFingerprints)
    ) {
      throw new Error("long-carrier feasibility record is stale for the requested capture epoch");
    }
  }
}

export function assertQualifiedLongCarrierReplicationFeasibility(
  value: unknown,
  binding: LongCarrierReplicationFeasibilityBinding,
): asserts value is LongCarrierReplicationFeasibilityRecord {
  assertLongCarrierReplicationFeasibility(value, binding);
  if (!value.qualified) {
    throw new Error("long-carrier feasibility record is not qualified for cohort declaration");
  }
}

/**
 * Require a later fixture to reproduce the score-free structural witness that
 * qualified its exact case. This prevents a valid gate for one physical prefix
 * from silently authorizing a different prefix during the efficacy cohort.
 */
export function assertFixtureMatchesLongCarrierReplicationFeasibility(
  fixture: unknown,
  expected: LongCarrierReplicationCase,
  feasibility: LongCarrierReplicationFeasibilityRecord,
): void {
  assertLongCarrierReplicationFeasibility(feasibility);
  assertPostimpactV3FixtureIntegrity(fixture, `fixture ${expected.id}`);
  const row = feasibility.rows.find((candidate) => candidate.id === expected.id);
  if (row === undefined || row.status !== "available" || row.witness === null) {
    throw new Error(`fixture ${expected.id} lacks a qualified feasibility witness`);
  }
  const value = record(fixture, `fixture ${expected.id}`);
  const panel = record(value.panel, `fixture ${expected.id} panel`);
  const capture = record(value.capture, `fixture ${expected.id} capture`);
  const projection = record(capture.prefixProjection, `fixture ${expected.id} prefix projection`);
  const prefix = record(value.physicalPrefix, `fixture ${expected.id} physical prefix`);
  const checkpoints = record(value.checkpoints, `fixture ${expected.id} checkpoints`);
  const materialized = record(value.materialized, `fixture ${expected.id} materialized input`);
  const transform = record(value.transform, `fixture ${expected.id} transform`);
  const runtime = assertCaptureRuntime(capture.runtimeIdentity, `fixture ${expected.id} capture runtime`);
  const captureIdentity = record(capture.captureIdentity, `fixture ${expected.id} capture identity`);
  assertDeclaredFixtureGeometry(panel, capture, captureIdentity, projection, prefix, materialized, transform, expected);
  if (
    panel.id !== expected.id ||
    panel.sourcePath !== expected.sourcePath ||
    panel.sourceFingerprint !== row.sourceFingerprintAtStart ||
    value.materializedFingerprint !== row.witness.materializedFingerprint ||
    value.physicalPrefixFingerprint !== row.witness.physicalPrefixFingerprint ||
    prefix.prefixNextLineId !== row.witness.prefixNextLineId ||
    prefix.cumulativeCost !== row.witness.cumulativeCost ||
    projection.rule !== row.witness.projectionRule ||
    projection.donorGap !== row.witness.donorGap ||
    projection.donorSkippedContacts !== row.witness.donorSkippedContacts ||
    projection.projectedTargetGap !== expected.targetGap ||
    checkpoints.targetPlanningStateFingerprint !== row.witness.targetPlanningStateFingerprint ||
    checkpoints.targetProbeStateFingerprint !== row.witness.targetProbeStateFingerprint ||
    checkpoints.preTargetSledTraceFingerprint !== row.witness.preTargetSledTraceFingerprint ||
    runtime.fingerprint !== feasibility.identities.captureRuntimeAtStart.fingerprint ||
    capture.studySourceFingerprint !== feasibility.identities.captureSourceAtStart.fingerprint ||
    captureIdentity.captureCandidateFingerprint !== feasibility.identities.captureCandidateAtStart.candidateFingerprint ||
    !Array.isArray(materialized.gaps) ||
    materialized.gaps.length !== row.materializedGapCount
  ) {
    throw new Error(`fixture ${expected.id} does not reproduce its sealed feasibility witness`);
  }
}

/** Bind a sealed physical witness to the exact declared current/outgoing pair. */
function assertDeclaredFixtureGeometry(
  panel: Record<string, unknown>,
  capture: Record<string, unknown>,
  captureIdentity: Record<string, unknown>,
  projection: Record<string, unknown>,
  prefix: Record<string, unknown>,
  materialized: Record<string, unknown>,
  transform: Record<string, unknown>,
  expected: LongCarrierReplicationCase,
): void {
  const targetGap = expected.targetGap;
  const outgoingGap = targetGap + 1;
  const gaps = materialized.gaps;
  const contactFrames = materialized.contactFrames;
  if (!Array.isArray(gaps) || !Array.isArray(contactFrames)) {
    throw new Error(`fixture ${expected.id} does not expose declared materialized gap geometry`);
  }
  const current = record(gaps[targetGap], `fixture ${expected.id} current materialized gap`);
  const outgoing = record(gaps[outgoingGap], `fixture ${expected.id} outgoing materialized gap`);
  const currentStart = safeInteger(current.startFrame, `fixture ${expected.id} current start frame`);
  const currentEnd = safeInteger(current.endFrame, `fixture ${expected.id} current end frame`);
  const outgoingStart = safeInteger(outgoing.startFrame, `fixture ${expected.id} outgoing start frame`);
  const outgoingEnd = safeInteger(outgoing.endFrame, `fixture ${expected.id} outgoing end frame`);
  const transformFingerprint = sha256(stableJson(LONG_CARRIER_REPLICATION_PROTOCOL.capture.transform));
  const captureProtocolFingerprint = sha256(stableJson({
    schema: "line.frozen-trajectory-prefix-capture-protocol.v1",
    scope: LONG_CARRIER_REPLICATION_SCOPE,
    panel: {
      id: expected.id,
      cohort: "validation",
      category: expected.category,
      sourcePath: expected.sourcePath,
      sourceFingerprint: panel.sourceFingerprint,
      publicSeed: expected.publicSeed,
      requestedTargetGap: targetGap,
      selectionRationale: expected.selectionRationale,
      expectedOutgoingFrames: expected.expectedOutgoingFrames,
      studyScope: LONG_CARRIER_REPLICATION_SCOPE,
    },
    capture: {
      engine: "wasm",
      budget: LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget,
      relevantEnvironment: { LR_ENGINE: "wasm" },
      transformFingerprint,
      prefixProjectionRule: LONG_CARRIER_REPLICATION_PROTOCOL.capture.prefixProjectionRule,
    },
  }));
  if (
    panel.id !== expected.id ||
    panel.cohort !== "validation" ||
    panel.category !== expected.category ||
    panel.sourcePath !== expected.sourcePath ||
    panel.publicSeed !== expected.publicSeed ||
    panel.requestedTargetGap !== targetGap ||
    panel.selectionRationale !== expected.selectionRationale ||
    panel.selectedTargetGap !== targetGap ||
    panel.outgoingGap !== outgoingGap ||
    panel.expectedOutgoingFrames !== expected.expectedOutgoingFrames ||
    panel.studyScope !== LONG_CARRIER_REPLICATION_SCOPE ||
    capture.captureBudget !== LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget ||
    captureIdentity.panelId !== expected.id ||
    captureIdentity.captureBudget !== LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget ||
    captureIdentity.protocolFingerprint !== captureProtocolFingerprint ||
    prefix.gapIndex !== targetGap ||
    projection.projectedTargetGap !== targetGap ||
    stableJson(transform.value) !== stableJson(LONG_CARRIER_REPLICATION_PROTOCOL.capture.transform) ||
    transform.fingerprint !== transformFingerprint ||
    current.index !== targetGap ||
    outgoing.index !== outgoingGap ||
    current.endsWithContact !== true ||
    outgoing.endsWithContact !== true ||
    currentEnd !== panel.currentFrame ||
    outgoingStart !== currentEnd ||
    outgoingEnd !== panel.outgoingFrame ||
    outgoingEnd - outgoingStart !== panel.outgoingIntervalFrames ||
    panel.outgoingIntervalFrames !== expected.expectedOutgoingFrames ||
    contactFrames[targetGap] !== currentEnd ||
    contactFrames[outgoingGap] !== outgoingEnd
  ) {
    throw new Error(`fixture ${expected.id} does not reproduce its declared current/outgoing geometry`);
  }
  // A complete fixture must also make the current and outgoing contacts part
  // of a contiguous, ordered timeline rather than merely placing matching
  // numbers in its panel metadata.
  if (currentStart < 0 || currentEnd <= currentStart || outgoingEnd <= outgoingStart) {
    throw new Error(`fixture ${expected.id} has invalid declared current/outgoing frame ordering`);
  }
}

function safeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer`);
  return value;
}

function assertIdentities(value: unknown): asserts value is LongCarrierReplicationFeasibilityRecord["identities"] {
  if (!isRecord(value) || typeof value.stable !== "boolean") {
    throw new Error("long-carrier feasibility record lacks identity stability");
  }
  assertExactKeys(value, [
    "captureCandidateAtEnd",
    "captureCandidateAtStart",
    "captureRuntimeAtEnd",
    "captureRuntimeAtStart",
    "captureSourceAtEnd",
    "captureSourceAtStart",
    "feasibilitySourceAtEnd",
    "feasibilitySourceAtStart",
    "panelSourceFingerprintsAtEnd",
    "panelSourceFingerprintsAtStart",
    "stable",
  ], "long-carrier feasibility identities");
  const feasibilityStart = assertSourceIdentity(value.feasibilitySourceAtStart, "feasibility source start identity");
  const feasibilityEnd = assertSourceIdentity(value.feasibilitySourceAtEnd, "feasibility source end identity");
  const sourceStart = assertSourceIdentity(value.captureSourceAtStart, "capture source start identity");
  const sourceEnd = assertSourceIdentity(value.captureSourceAtEnd, "capture source end identity");
  const runtimeStart = assertCaptureRuntime(value.captureRuntimeAtStart, "capture runtime start identity");
  const runtimeEnd = assertCaptureRuntime(value.captureRuntimeAtEnd, "capture runtime end identity");
  const candidateStart = assertCandidateIdentity(value.captureCandidateAtStart, "capture candidate start identity");
  const candidateEnd = assertCandidateIdentity(value.captureCandidateAtEnd, "capture candidate end identity");
  const panelsStart = record(value.panelSourceFingerprintsAtStart, "panel source start fingerprints");
  const panelsEnd = record(value.panelSourceFingerprintsAtEnd, "panel source end fingerprints");
  const sourcePaths = uniqueSourcePaths();
  if (
    stableJson(Object.keys(panelsStart).sort()) !== stableJson(sourcePaths) ||
    stableJson(Object.keys(panelsEnd).sort()) !== stableJson(sourcePaths)
  ) {
    throw new Error("long-carrier feasibility panel source fingerprint inventory differs from the roster");
  }
  for (const path of sourcePaths) {
    sha(panelsStart[path], `start fingerprint for ${path}`);
    sha(panelsEnd[path], `end fingerprint for ${path}`);
  }
  const stable =
    stableJson(feasibilityStart) === stableJson(feasibilityEnd) &&
    stableJson(sourceStart) === stableJson(sourceEnd) &&
    stableJson(runtimeStart) === stableJson(runtimeEnd) &&
    stableJson(candidateStart) === stableJson(candidateEnd) &&
    stableJson(panelsStart) === stableJson(panelsEnd);
  if (value.stable !== stable) {
    throw new Error("long-carrier feasibility identity stability does not match its endpoint fingerprints");
  }
}

function assertRow(
  value: unknown,
  expected: LongCarrierReplicationCase,
  identities: LongCarrierReplicationFeasibilityRecord["identities"],
): void {
  if (!isRecord(value)) throw new Error(`long-carrier feasibility row for ${expected.id} is malformed`);
  const allowed = [
    "elapsedMs",
    "failureCode",
    "id",
    "materializedGapCount",
    "outgoingGap",
    "outgoingIntervalFrames",
    "sourceFingerprintAtEnd",
    "sourceFingerprintAtStart",
    "sourcePath",
    "status",
    "targetGap",
    "witness",
  ];
  if (!hasExactKeys(value, allowed)) {
    throw new Error(`long-carrier feasibility row for ${expected.id} has an unsupported efficacy field`);
  }
  if (
    value.id !== expected.id ||
    value.sourcePath !== expected.sourcePath ||
    value.targetGap !== expected.targetGap ||
    value.outgoingGap !== expected.targetGap + 1 ||
    value.outgoingIntervalFrames !== expected.expectedOutgoingFrames ||
    !Number.isSafeInteger(value.materializedGapCount) ||
    value.materializedGapCount <= expected.targetGap + 1 ||
    value.sourceFingerprintAtStart !== identities.panelSourceFingerprintsAtStart[expected.sourcePath] ||
    value.sourceFingerprintAtEnd !== identities.panelSourceFingerprintsAtEnd[expected.sourcePath] ||
    !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0
  ) {
    throw new Error(`long-carrier feasibility row for ${expected.id} does not match the declared source boundary`);
  }
  if (value.status !== "available" && value.status !== "unavailable" && value.status !== "invalid") {
    throw new Error(`long-carrier feasibility row for ${expected.id} has an invalid status`);
  }
  if (value.status === "available") {
    if (value.failureCode !== null) throw new Error(`available feasibility row ${expected.id} has a failure code`);
    assertWitness(value.witness, expected, value.materializedGapCount);
  } else if (value.status === "unavailable") {
    if (
      value.witness !== null ||
      (value.failureCode !== "no_clean_donor" && value.failureCode !== "target_unreached")
    ) {
      throw new Error(`unavailable feasibility row ${expected.id} has an invalid structural failure`);
    }
  } else if (value.witness !== null || value.failureCode !== "capture_error") {
    throw new Error(`unavailable feasibility row ${expected.id} has an invalid structural failure`);
  }
}

function assertWitness(
  value: unknown,
  expected: LongCarrierReplicationCase,
  materializedGapCount: number,
): void {
  if (!isRecord(value)) throw new Error(`available feasibility row ${expected.id} lacks its physical witness`);
  const allowed = [
    "cumulativeCost",
    "donorGap",
    "donorSkippedContacts",
    "materializedFingerprint",
    "physicalPrefixFingerprint",
    "prefixNextLineId",
    "preTargetSledTraceFingerprint",
    "projectionRule",
    "targetPlanningStateFingerprint",
    "targetProbeStateFingerprint",
  ];
  if (!hasExactKeys(value, allowed)) {
    throw new Error(`available feasibility row ${expected.id} exposes an unsupported field`);
  }
  if (
    value.projectionRule !== PHYSICAL_PREFIX_DONOR_SELECTION_RULE ||
    !Number.isSafeInteger(value.donorGap) || value.donorGap < expected.targetGap ||
    value.donorGap >= materializedGapCount ||
    value.donorSkippedContacts !== 0 ||
    !Number.isSafeInteger(value.prefixNextLineId) || value.prefixNextLineId < 1 ||
    !Number.isFinite(value.cumulativeCost) ||
    !isSha(value.physicalPrefixFingerprint) ||
    !isSha(value.materializedFingerprint) ||
    !isSha(value.targetPlanningStateFingerprint) ||
    !isSha(value.targetProbeStateFingerprint) ||
    !isSha(value.preTargetSledTraceFingerprint)
  ) {
    throw new Error(`available feasibility row ${expected.id} has an invalid physical witness`);
  }
}

function assertSourceIdentity(value: unknown, label: string): { fingerprint: string; sourceFiles: string[] } {
  const identity = record(value, label);
  assertExactKeys(identity, ["fingerprint", "sourceFiles"], `long-carrier feasibility ${label}`);
  sha(identity.fingerprint, `${label} fingerprint`);
  const sourceFiles = sortedUniqueStringArray(identity.sourceFiles, `${label} source files`);
  if (sourceFiles.length === 0) throw new Error(`long-carrier feasibility ${label} must not be empty`);
  return { fingerprint: identity.fingerprint as string, sourceFiles };
}

function assertCaptureRuntime(
  value: unknown,
  label: string,
): LongCarrierReplicationCaptureRuntimeIdentity {
  const runtime = record(value, label);
  assertExactKeys(runtime, [
    "arch",
    "engine",
    "engineArtifactFingerprint",
    "fingerprint",
    "node",
    "platform",
    "relevantEnvironment",
    "runtimePackageClosureFingerprint",
    "runtimePackages",
    "runtimeIdentityProtocol",
    "tsxVersion",
    "typescriptVersion",
  ], `long-carrier feasibility ${label}`);
  const environment = record(runtime.relevantEnvironment, `${label} environment`);
  assertExactKeys(environment, ["LR_ENGINE"], `long-carrier feasibility ${label} environment`);
  if (
    runtime.runtimeIdentityProtocol !== "line.long-carrier-replication-capture-runtime.v2" ||
    runtime.engine !== "wasm" ||
    runtime.node === "" || typeof runtime.node !== "string" ||
    runtime.platform === "" || typeof runtime.platform !== "string" ||
    runtime.arch === "" || typeof runtime.arch !== "string" ||
    runtime.typescriptVersion === "" || typeof runtime.typescriptVersion !== "string" ||
    runtime.tsxVersion === "" || typeof runtime.tsxVersion !== "string" ||
    environment.LR_ENGINE !== "wasm" ||
    (runtime.engineArtifactFingerprint !== null && !isSha(runtime.engineArtifactFingerprint)) ||
    !isSha(runtime.runtimePackageClosureFingerprint) ||
    !Array.isArray(runtime.runtimePackages) ||
    runtime.runtimePackages.some((entry) => typeof entry !== "string" || entry === "") ||
    stableJson(runtime.runtimePackages) !== stableJson([...new Set(runtime.runtimePackages)].sort())
  ) {
    throw new Error(`long-carrier feasibility ${label} is malformed`);
  }
  const payload = { ...runtime };
  delete payload.fingerprint;
  if (!isSha(runtime.fingerprint) || runtime.fingerprint !== sha256(stableJson(payload))) {
    throw new Error(`long-carrier feasibility ${label} fingerprint does not match its payload`);
  }
  return runtime as LongCarrierReplicationCaptureRuntimeIdentity;
}

function assertCandidateIdentity(
  value: unknown,
  label: string,
): LongCarrierReplicationCandidateIdentity {
  const candidate = record(value, label);
  assertExactKeys(candidate, [
    "candidateFingerprint",
    "compilerEnvironment",
    "compilerIdentityProtocol",
    "compilerSourceBoundaryFingerprint",
    "compilerSourceFiles",
    "compilerSourceFingerprint",
    "engine",
    "engineArtifactFingerprint",
  ], `long-carrier feasibility ${label}`);
  const environment = record(candidate.compilerEnvironment, `${label} compiler environment`);
  if (Object.values(environment).some((entry) => typeof entry !== "string")) {
    throw new Error(`long-carrier feasibility ${label} has a malformed compiler environment`);
  }
  const compilerSourceFiles = sortedUniqueStringArray(candidate.compilerSourceFiles, `${label} compiler source files`);
  if (compilerSourceFiles.length === 0) {
    throw new Error(`long-carrier feasibility ${label} must not be empty`);
  }
  if (
    candidate.compilerIdentityProtocol !== LONG_CARRIER_COMPILER_IDENTITY_PROTOCOL ||
    typeof candidate.engine !== "string" || candidate.engine === "" ||
    !isSha(candidate.compilerSourceBoundaryFingerprint) ||
    !isSha(candidate.compilerSourceFingerprint) ||
    (candidate.engineArtifactFingerprint !== null && !isSha(candidate.engineArtifactFingerprint))
  ) {
    throw new Error(`long-carrier feasibility ${label} is malformed`);
  }
  const payload = {
    compilerIdentityProtocol: candidate.compilerIdentityProtocol,
    compilerSourceBoundaryFingerprint: candidate.compilerSourceBoundaryFingerprint,
    compilerSourceFingerprint: candidate.compilerSourceFingerprint,
    compilerEnvironment: environment,
    engine: candidate.engine,
    engineArtifactFingerprint: candidate.engineArtifactFingerprint,
  };
  if (!isSha(candidate.candidateFingerprint) || candidate.candidateFingerprint !== sha256(stableJson(payload))) {
    throw new Error(`long-carrier feasibility ${label} fingerprint does not match its payload`);
  }
  return { ...payload, compilerSourceFiles, candidateFingerprint: candidate.candidateFingerprint };
}

function uniqueSourcePaths(): string[] {
  return [...new Set(LONG_CARRIER_REPLICATION_PROTOCOL.cases.map((entry) => entry.sourcePath))].sort();
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`long-carrier feasibility ${label} is malformed`);
  return value;
}

function sortedUniqueStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`long-carrier feasibility ${label} is malformed`);
  }
  if (stableJson(value) !== stableJson([...new Set(value)].sort())) {
    throw new Error(`long-carrier feasibility ${label} must be sorted and unique`);
  }
  return value;
}

function sha(value: unknown, label: string): asserts value is string {
  if (!isSha(value)) throw new Error(`long-carrier feasibility ${label} must be a SHA-256 fingerprint`);
}

function isSha(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  if (!hasExactKeys(value, expected)) throw new Error(`${label} has an unsupported field`);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return stableJson(Object.keys(value).sort()) === stableJson([...expected].sort());
}
