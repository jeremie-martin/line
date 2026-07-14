/**
 * Cohort-level interpretation for the preregistered long-carrier transfer
 * study. This module is pure: it consumes already sealed fixture/assay data
 * and cannot launch a compiler, alter a roster, or select a fraction.
 */
import {
  LONG_CARRIER_REPLICATION_FRACTIONS,
  LONG_CARRIER_REPLICATION_PROTOCOL,
  LONG_CARRIER_REPLICATION_SCOPE,
  type LongCarrierReplicationCase,
} from "./long_carrier_replication_protocol.ts";
import { assertPostimpactV3FixtureIntegrity, sha256, stableJson } from "./postimpact_study_inputs.ts";
import { assertPostimpactAssayArtifactIntegrity } from "./postimpact_assay_artifact.ts";

export type LongCarrierReplicationEvidence = {
  id: string;
  capture: {
    exitCode: number | null;
    fixture: unknown | null;
    failureKind?: "unavailable" | "invalid";
  };
  assay: {
    exitCode: number | null;
    artifact: unknown | null;
  };
};

export type LongCarrierReplicationVerdict =
  | "invalid"
  | "falsified"
  | "inconclusive"
  | "supported_local_duration_response";

/**
 * Captured in the immutable declaration before the first child process runs.
 * Uniform evidence is insufficient: every record must also bind this exact
 * implementation and compiler/runtime epoch.
 */
export type LongCarrierReplicationExpectedIdentities = {
  captureStudySourceFingerprint: string;
  captureCandidateFingerprint: string;
  assaySourceFingerprint: string;
  assayRuntimeFingerprint: string;
};

type CompleteRow = {
  rowIndex: number;
  monotone: boolean;
  endpointContrast: number;
  endpointContrastThreshold: number;
  allArmsNoOffBeat: boolean;
  terminalSpeedRetention: number | null;
};

type CaseAssessment = {
  id: string;
  sourceId: string;
  role: "primary_low_air" | "scope_control";
  status: "supported" | "reported" | "falsified" | "unavailable" | "inert" | "invalid";
  reason: string | null;
  completeRows: CompleteRow[];
  identities: {
    captureStudySourceFingerprint: string;
    captureCandidateFingerprint: string;
    assaySourceFingerprint: string;
    assayRuntimeFingerprint: string;
    assayProtocolFingerprint: string;
  } | null;
};

export type LongCarrierReplicationAssessment = {
  schema: "line.long-carrier-replication-assessment.v1";
  scope: typeof LONG_CARRIER_REPLICATION_SCOPE;
  verdict: LongCarrierReplicationVerdict;
  reason: string;
  primarySources: Array<{
    sourceId: string;
    status: "supported" | "reported" | "falsified" | "unavailable" | "inert" | "invalid";
    cases: CaseAssessment[];
  }>;
  controls: CaseAssessment[];
  identities: {
    captureStudySourceFingerprints: string[];
    captureCandidateFingerprints: string[];
    assaySourceFingerprints: string[];
    assayRuntimeFingerprints: string[];
    assayProtocolFingerprints: string[];
  };
  cases: CaseAssessment[];
};

/**
 * Apply the declaration exactly once to a ledger's records. An unexpected,
 * missing, duplicate, or mixed-identity record is invalid rather than being
 * filtered out of the outcome.
 */
export function assessLongCarrierReplication(
  evidence: readonly LongCarrierReplicationEvidence[],
  expectedIdentities: LongCarrierReplicationExpectedIdentities,
): LongCarrierReplicationAssessment {
  const expected = LONG_CARRIER_REPLICATION_PROTOCOL.cases;
  const byId = new Map<string, LongCarrierReplicationEvidence[]>();
  for (const entry of evidence) {
    const existing = byId.get(entry.id) ?? [];
    existing.push(entry);
    byId.set(entry.id, existing);
  }
  const expectedIds = new Set(expected.map((entry) => entry.id));
  const unexpected = evidence.filter((entry) => !expectedIds.has(entry.id));
  const duplicateIds = [...byId.entries()].filter(([, entries]) => entries.length !== 1).map(([id]) => id);
  const missingIds = expected.filter((entry) => !byId.has(entry.id)).map((entry) => entry.id);
  const cases = expected.map((entry) => assessCase(entry, byId.get(entry.id)?.[0] ?? null));
  const identities = identitySummary(cases);

  const invalidCase = cases.find((entry) => entry.status === "invalid");
  if (unexpected.length > 0 || duplicateIds.length > 0 || missingIds.length > 0 || invalidCase !== undefined) {
    return result(cases, identities, "invalid", invalidCase?.reason ?? rosterReason(unexpected, duplicateIds, missingIds));
  }
  if (hasMixedIdentity(identities) || !matchesExpectedIdentities(identities, expectedIdentities)) {
    return result(cases, identities, "invalid", "fixture or assay identities differ from the immutable declaration");
  }

  const primarySources = sourceAssessments(cases, "primary_low_air");
  const controls = cases.filter((entry) => entry.role === "scope_control");
  if (primarySources.some((source) => source.status === "falsified")) {
    return result(cases, identities, "falsified", "at least one complete primary row violated the preregistered monotonicity predicate");
  }
  if (primarySources.some((source) => source.status === "invalid")) {
    return result(cases, identities, "invalid", "at least one primary source has invalid execution evidence");
  }
  if (primarySources.some((source) => source.status !== "supported")) {
    return result(cases, identities, "inconclusive", "one or more primary source/seed pairs lacked an eligible non-inert five-arm row");
  }
  if (controls.some((control) => control.status === "invalid")) {
    return result(cases, identities, "invalid", "a declared scope control has invalid execution evidence");
  }
  if (controls.some((control) => control.status !== "reported")) {
    return result(cases, identities, "inconclusive", "one or more declared scope controls did not produce a complete reported row");
  }
  return result(
    cases,
    identities,
    "supported_local_duration_response",
    "all declared low-air source/seed pairs satisfied the fixed local duration-response rule; this does not establish a planner or continuation law",
  );
}

function assessCase(entry: LongCarrierReplicationCase, evidence: LongCarrierReplicationEvidence | null): CaseAssessment {
  const unavailable = (reason: string): CaseAssessment => emptyCase(entry, "unavailable", reason);
  const invalid = (reason: string): CaseAssessment => emptyCase(entry, "invalid", reason);
  if (evidence === null) return invalid("missing declared ledger record");
  if (evidence.capture.fixture === null) {
    if (evidence.assay.artifact !== null) return invalid("assay artifact exists without a captured fixture");
    return evidence.capture.exitCode !== null && evidence.capture.exitCode !== 0 && evidence.capture.failureKind === "unavailable"
      ? unavailable("declared target prefix was unavailable")
      : invalid("fixture capture did not publish a valid immutable record");
  }
  if (evidence.capture.exitCode !== 0) return invalid("fixture was published despite a nonzero capture exit code");
  const fixture = record(evidence.capture.fixture);
  if (fixture === null) return invalid("fixture is not an object");
  try {
    assertPostimpactV3FixtureIntegrity(fixture, "replication fixture");
  } catch (error) {
    return invalid(`fixture integrity check failed: ${errorMessage(error)}`);
  }
  const fixtureCheck = validateFixture(entry, fixture);
  if (fixtureCheck !== null) return invalid(fixtureCheck);
  if (evidence.assay.artifact === null) return invalid("assay did not publish a valid immutable record");
  if (evidence.assay.exitCode !== 0) return invalid("assay was published despite a nonzero assay exit code");
  const artifact = record(evidence.assay.artifact);
  if (artifact === null) return invalid("assay artifact is not an object");
  try {
    assertPostimpactAssayArtifactIntegrity(artifact);
  } catch (error) {
    return invalid(`assay artifact integrity check failed: ${errorMessage(error)}`);
  }
  const inspected = inspectAssay(entry, fixture, artifact);
  if (typeof inspected === "string") return invalid(inspected);
  const { rows, identities } = inspected;
  if (rows.some((row) => !row.monotone) && entry.role === "primary_low_air") {
    return { ...emptyCase(entry, "falsified", "a complete primary row is non-monotone"), completeRows: rows, identities };
  }
  if (rows.length < LONG_CARRIER_REPLICATION_PROTOCOL.decisionRule.minimumCompleteFiveArmRowsPerSeed) {
    return { ...emptyCase(entry, "unavailable", "no complete five-arm row met the per-seed availability requirement"), completeRows: rows, identities };
  }
  const meaningful = rows.some((row) => row.allArmsNoOffBeat && row.endpointContrast > row.endpointContrastThreshold);
  if (entry.role === "primary_low_air" && !meaningful) {
    return { ...emptyCase(entry, "inert", "complete rows had no preregistered no-offbeat endpoint contrast"), completeRows: rows, identities };
  }
  return {
    ...emptyCase(entry, entry.role === "primary_low_air" ? "supported" : "reported", null),
    completeRows: rows,
    identities,
  };
}

function emptyCase(
  entry: LongCarrierReplicationCase,
  status: CaseAssessment["status"],
  reason: string | null,
): CaseAssessment {
  return {
    id: entry.id,
    sourceId: entry.sourceId,
    role: entry.role,
    status,
    reason,
    completeRows: [],
    identities: null,
  };
}

function validateFixture(entry: LongCarrierReplicationCase, fixture: Record<string, unknown>): string | null {
  if (fixture.schema !== "line.frozen-trajectory-prefix.v3") return "fixture does not use sealed V3 provenance";
  const panel = record(fixture.panel);
  const capture = record(fixture.capture);
  if (panel === null || capture === null) return "fixture lacks declared panel or capture provenance";
  const identityCheck = record(capture.identityCheck);
  const captureIdentity = record(capture.captureIdentity);
  const runtime = record(capture.runtime);
  const transform = record(fixture.transform);
  const prefix = record(fixture.physicalPrefix);
  const materialized = record(fixture.materialized);
  const materializedGaps = materialized === null ? null : array(materialized.gaps);
  if (identityCheck === null || captureIdentity === null || runtime === null || transform === null || prefix === null || materializedGaps === null) {
    return "fixture lacks capture identity or materialized-prefix fields";
  }
  if (identityCheck.stable !== true) return "fixture capture identity drifted";
  if (
    panel.id !== entry.id ||
    panel.cohort !== "validation" ||
    panel.category !== entry.category ||
    panel.studyScope !== LONG_CARRIER_REPLICATION_SCOPE ||
    panel.sourcePath !== entry.sourcePath ||
    panel.publicSeed !== entry.publicSeed ||
    panel.requestedTargetGap !== entry.targetGap ||
    panel.selectedTargetGap !== entry.targetGap ||
    panel.outgoingGap !== entry.targetGap + 1 ||
    panel.outgoingIntervalFrames !== entry.expectedOutgoingFrames ||
    panel.expectedOutgoingFrames !== entry.expectedOutgoingFrames ||
    panel.selectionRationale !== entry.selectionRationale
  ) return "fixture panel declaration differs from the preregistered case";
  if (
    capture.captureBudget !== LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget ||
    runtime.engine !== LONG_CARRIER_REPLICATION_PROTOCOL.capture.engine ||
    !sameRecord(runtime.relevantEnvironment, LONG_CARRIER_REPLICATION_PROTOCOL.capture.relevantEnvironment) ||
    captureIdentity.panelId !== entry.id
  ) return "fixture runtime or capture protocol differs from the preregistration";
  if (
    stableJson(transform.value) !== stableJson(LONG_CARRIER_REPLICATION_PROTOCOL.capture.transform) ||
    transform.fingerprint !== sha256(stableJson(transform.value))
  ) return "fixture transform differs from the preregistered capture protocol";
  const current = record(materializedGaps[entry.targetGap]);
  const outgoing = record(materializedGaps[entry.targetGap + 1]);
  if (
    prefix.gapIndex !== entry.targetGap ||
    current === null ||
    outgoing === null ||
    current.index !== entry.targetGap ||
    current.endsWithContact !== true ||
    current.endFrame !== panel.currentFrame ||
    outgoing.index !== entry.targetGap + 1 ||
    outgoing.endsWithContact !== true ||
    outgoing.startFrame !== panel.currentFrame ||
    outgoing.endFrame !== panel.outgoingFrame ||
    outgoing.endFrame - outgoing.startFrame !== entry.expectedOutgoingFrames
  ) return "fixture physical prefix or materialized outgoing interval differs from the preregistration";
  return null;
}

function inspectAssay(
  entry: LongCarrierReplicationCase,
  fixture: Record<string, unknown>,
  artifact: Record<string, unknown>,
): { rows: CompleteRow[]; identities: NonNullable<CaseAssessment["identities"]> } | string {
  if (artifact.schema !== "line.study-postimpact-long-carrier-duration.v1") return "assay schema differs from the fixed long-carrier runner";
  const status = record(artifact.status);
  const identity = record(artifact.artifactIdentity);
  const protocol = record(artifact.protocol);
  const provenance = record(artifact.provenance);
  const audit = provenance === null ? null : record(provenance.audit);
  const auditPanel = audit === null ? null : record(audit.panel);
  const auditRuntime = audit === null ? null : record(audit.runtime);
  const auditPrefix = audit === null ? null : record(audit.physicalPrefix);
  if (status === null || identity === null || protocol === null || provenance === null || auditPanel === null || auditRuntime === null || auditPrefix === null) {
    return "assay lacks status, identity, protocol, or sealed audit";
  }
  if (status.executionComplete !== true) return "assay execution was not complete";
  const descriptiveRows = status.descriptiveDurationResponseEligible === true &&
    status.protocolStatus === "complete_with_descriptive_rows";
  const completeWithoutRows = status.descriptiveDurationResponseEligible === false &&
    status.protocolStatus === "complete_without_eligible_evidence";
  if (!descriptiveRows && !completeWithoutRows) return "assay has an inconsistent completion status";
  if (identity.fixtureFingerprint !== fixture.fixtureFingerprint) return "assay does not bind the captured fixture fingerprint";
  const { fingerprint: identityFingerprint, ...identityPayload } = identity;
  if (typeof identityFingerprint !== "string" || identityFingerprint !== sha256(stableJson(identityPayload))) {
    return "assay artifact identity fingerprint does not match its bound provenance";
  }
  if (protocol.protocolFingerprint !== identity.protocolFingerprint) return "assay protocol fingerprint does not bind its artifact identity";
  const fixturePanel = record(fixture.panel)!;
  if (
    audit.fixtureFingerprint !== fixture.fixtureFingerprint ||
    auditPanel.id !== entry.id ||
    auditPanel.cohort !== "validation" ||
    auditPanel.category !== entry.category ||
    auditPanel.sourcePath !== entry.sourcePath ||
    auditPanel.sourceFingerprint !== fixturePanel.sourceFingerprint ||
    auditPanel.publicSeed !== entry.publicSeed ||
    auditPanel.selectionRationale !== entry.selectionRationale ||
    auditPanel.currentGap !== entry.targetGap ||
    auditPanel.currentFrame !== fixturePanel.currentFrame ||
    auditPanel.studyScope !== LONG_CARRIER_REPLICATION_SCOPE
  ) return "assay audit does not bind the preregistered validation scope";
  const fixturePrefix = record(fixture.physicalPrefix)!;
  if (auditPrefix.fingerprint !== fixture.physicalPrefixFingerprint || auditPrefix.nextLineId !== fixturePrefix.prefixNextLineId) {
    return "assay audit physical prefix differs from the frozen fixture";
  }
  const capture = record(fixture.capture)!;
  const runtime = record(capture.runtime)!;
  if (
    auditRuntime.engine !== runtime.engine ||
    auditRuntime.captureBudget !== capture.captureBudget ||
    auditRuntime.studySourceFingerprint !== capture.studySourceFingerprint ||
    !sameRecord(auditRuntime.relevantEnvironment, runtime.relevantEnvironment as Record<string, string>)
  ) return "assay audit runtime differs from the frozen capture";
  const summary = record(artifact.summary);
  if (summary === null) return "assay lacks a summary";
  for (const field of [
    "captureProtocolInvalidRows",
    "constructionInvalidPhases",
    "constructionProtocolInvalidRows",
    "constructionReportMismatches",
    "measurementRosterViolations",
    "durationEndpointMismatches",
    "measurementProtectedBoundaryViolations",
    "armErrors",
  ]) {
    if (summary[field] !== 0) return `assay reports nonzero ${field}`;
  }
  const captureIdentity = record(capture.captureIdentity)!;
  const identities = {
    captureStudySourceFingerprint: string(capture.studySourceFingerprint),
    captureCandidateFingerprint: string(captureIdentity.captureCandidateFingerprint),
    assaySourceFingerprint: string(identity.sourceFingerprint),
    assayRuntimeFingerprint: string(identity.runtimeFingerprint),
    assayProtocolFingerprint: string(identity.protocolFingerprint),
  };
  if (Object.values(identities).some((value) => !isSha256(value))) return "assay or capture identity is missing a valid fingerprint";
  const rows = array(artifact.rows);
  if (rows === null) return "assay rows are not an array";
  const completeRows: CompleteRow[] = [];
  for (const [rowIndex, value] of rows.entries()) {
    const row = record(value);
    const measurement = row === null ? null : record(row.measurement);
    if (measurement === null || measurement.status !== "complete") continue;
    const primary = record(measurement.primary);
    const arms = array(measurement.arms);
    const primaryArms = primary === null ? null : array(primary.arms);
    if (primary === null || arms === null || primaryArms === null) {
      return `complete assay row ${rowIndex} lacks a primary or arms`;
    }
    const monotone = primary.monotone;
    const measurementSamples = number(primary.measurementSamples);
    const tolerance = number(primary.tolerance);
    const primaryRoster = exactFractionRoster(primaryArms);
    const detailRoster = exactFractionRoster(arms);
    if (typeof monotone !== "boolean" || measurementSamples === null || !Number.isSafeInteger(measurementSamples) ||
        measurementSamples < 1 || tolerance === null || tolerance !== 1 / measurementSamples ||
        primaryRoster === null || detailRoster === null) {
      return `complete assay row ${rowIndex} has malformed fixed-arm measurement`;
    }
    const primaryAir = LONG_CARRIER_REPLICATION_FRACTIONS.map((fraction) => {
      const value = number(primaryRoster.get(fraction)!.airFraction);
      return value;
    });
    if (primaryAir.some((value) => value === null || value < 0 || value > 1)) {
      return `complete assay row ${rowIndex} has invalid primary air fractions`;
    }
    const typedAir = primaryAir as number[];
    const detailArms = LONG_CARRIER_REPLICATION_FRACTIONS.map((fraction) => detailRoster.get(fraction)!);
    if (detailArms.some((arm, index) => {
      const window = record(arm.window);
      return window === null || number(window.airFraction) !== typedAir[index];
    })) return `complete assay row ${rowIndex} detail arms disagree with primary air fractions`;
    const recomputedMonotone = typedAir.slice(1).every((value, index) => value <= typedAir[index]! + tolerance);
    if (monotone !== recomputedMonotone) return `complete assay row ${rowIndex} has inconsistent monotonicity summary`;
    const zeroAir = typedAir[0]!;
    const oneAir = typedAir.at(-1)!;
    const zeroDetail = detailRoster.get(0)!;
    const oneDetail = detailRoster.get(1)!;
    const allArmsNoOffBeat = detailArms.every((arm) =>
      emptyArrayField(arm, "observedOffBeatFrames") && emptyArrayField(arm, "unresolvedTailOffBeatFrames")
    );
    const terminalSpeedRetention = speedRetention(zeroDetail, oneDetail);
    completeRows.push({
      rowIndex,
      monotone: recomputedMonotone,
      endpointContrast: zeroAir - oneAir,
      endpointContrastThreshold: 2 * tolerance,
      allArmsNoOffBeat,
      terminalSpeedRetention,
    });
  }
  if ((descriptiveRows && completeRows.length === 0) || (completeWithoutRows && completeRows.length > 0)) {
    return "assay completion status disagrees with its complete-row roster";
  }
  if (summary.completeFiveArmRows !== completeRows.length ||
      summary.monotoneRows !== completeRows.filter((row) => row.monotone).length ||
      summary.nonMonotoneRows !== completeRows.filter((row) => !row.monotone).length) {
    return "assay summary disagrees with the recomputed complete-row measurements";
  }
  return { rows: completeRows, identities };
}

function exactFractionRoster(arms: readonly unknown[]): Map<number, Record<string, unknown>> | null {
  if (arms.length !== LONG_CARRIER_REPLICATION_FRACTIONS.length) return null;
  const roster = new Map<number, Record<string, unknown>>();
  for (const arm of arms) {
    const value = record(arm);
    const fraction = value === null ? null : number(value.supportFraction);
    if (value === null || fraction === null || !LONG_CARRIER_REPLICATION_FRACTIONS.includes(fraction as never) ||
        roster.has(fraction)) return null;
    roster.set(fraction, value);
  }
  return LONG_CARRIER_REPLICATION_FRACTIONS.every((fraction) => roster.has(fraction)) ? roster : null;
}

function speedRetention(zero: Record<string, unknown>, one: Record<string, unknown>): number | null {
  const zeroSnapshot = record(zero.arrivalTimeSnapshot);
  const oneSnapshot = record(one.arrivalTimeSnapshot);
  const zeroReference = zeroSnapshot === null ? null : record(zeroSnapshot.terminalNamedReference);
  const oneReference = oneSnapshot === null ? null : record(oneSnapshot.terminalNamedReference);
  const start = zeroReference === null ? null : number(zeroReference.speedPxPerFrame);
  const end = oneReference === null ? null : number(oneReference.speedPxPerFrame);
  return start === null || end === null || start <= 0 ? null : end / start;
}

function sourceAssessments(cases: CaseAssessment[], role: CaseAssessment["role"]) {
  const sourceIds = [...new Set(cases.filter((entry) => entry.role === role).map((entry) => entry.sourceId))];
  return sourceIds.map((sourceId) => {
    const members = cases.filter((entry) => entry.sourceId === sourceId);
    const status = members.some((entry) => entry.status === "invalid")
      ? "invalid"
      : members.some((entry) => entry.status === "falsified")
        ? "falsified"
        : members.some((entry) => entry.status === "unavailable")
          ? "unavailable"
          : members.some((entry) => entry.status === "inert")
            ? "inert"
            : "supported";
    return { sourceId, status, cases: members };
  });
}

function result(
  cases: CaseAssessment[],
  identities: LongCarrierReplicationAssessment["identities"],
  verdict: LongCarrierReplicationVerdict,
  reason: string,
): LongCarrierReplicationAssessment {
  return {
    schema: "line.long-carrier-replication-assessment.v1",
    scope: LONG_CARRIER_REPLICATION_SCOPE,
    verdict,
    reason,
    primarySources: sourceAssessments(cases, "primary_low_air"),
    controls: cases.filter((entry) => entry.role === "scope_control"),
    identities,
    cases,
  };
}

function identitySummary(cases: readonly CaseAssessment[]): LongCarrierReplicationAssessment["identities"] {
  const values = cases.flatMap((entry) => entry.identities === null ? [] : [entry.identities]);
  return {
    captureStudySourceFingerprints: unique(values.map((entry) => entry.captureStudySourceFingerprint)),
    captureCandidateFingerprints: unique(values.map((entry) => entry.captureCandidateFingerprint)),
    assaySourceFingerprints: unique(values.map((entry) => entry.assaySourceFingerprint)),
    assayRuntimeFingerprints: unique(values.map((entry) => entry.assayRuntimeFingerprint)),
    assayProtocolFingerprints: unique(values.map((entry) => entry.assayProtocolFingerprint)),
  };
}

function hasMixedIdentity(identities: LongCarrierReplicationAssessment["identities"]): boolean {
  return Object.values(identities).some((values) => values.length > 1);
}

function matchesExpectedIdentities(
  identities: LongCarrierReplicationAssessment["identities"],
  expected: LongCarrierReplicationExpectedIdentities,
): boolean {
  return identities.captureStudySourceFingerprints.length === 1 &&
    identities.captureStudySourceFingerprints[0] === expected.captureStudySourceFingerprint &&
    identities.captureCandidateFingerprints.length === 1 &&
    identities.captureCandidateFingerprints[0] === expected.captureCandidateFingerprint &&
    identities.assaySourceFingerprints.length === 1 &&
    identities.assaySourceFingerprints[0] === expected.assaySourceFingerprint &&
    identities.assayRuntimeFingerprints.length === 1 &&
    identities.assayRuntimeFingerprints[0] === expected.assayRuntimeFingerprint;
}

function rosterReason(
  unexpected: readonly LongCarrierReplicationEvidence[],
  duplicateIds: readonly string[],
  missingIds: readonly string[],
): string {
  const parts = [
    unexpected.length > 0 ? `unexpected records: ${unexpected.map((entry) => entry.id).join(", ")}` : null,
    duplicateIds.length > 0 ? `duplicate records: ${duplicateIds.join(", ")}` : null,
    missingIds.length > 0 ? `missing records: ${missingIds.join(", ")}` : null,
  ].filter((value): value is string => value !== null);
  return parts.join("; ");
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function array(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function emptyArrayField(value: Record<string, unknown>, field: string): boolean {
  const items = array(value[field]);
  return items !== null && items.length === 0;
}

function sameRecord(left: unknown, right: Record<string, string>): boolean {
  const input = record(left);
  if (input === null) return false;
  const inputKeys = Object.keys(input).sort();
  const expectedKeys = Object.keys(right).sort();
  return inputKeys.length === expectedKeys.length && inputKeys.every((key, index) =>
    key === expectedKeys[index] && input[key] === right[key],
  );
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
