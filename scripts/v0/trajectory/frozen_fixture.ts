/**
 * Serializable frozen-prefix contract shared by trajectory-study capture and
 * observation tools. It is deliberately study-only and must never be imported
 * by compiler generation.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PhysicalPrefixFixture } from "./study_fixture.ts";
import type { PlanningState } from "./state.ts";
import type {
  MaterializedTrajectoryCaptureInput,
  TrajectoryCaptureCase,
} from "./capture_input.ts";

type FrozenTrajectoryFixtureBase = {
  fixtureFingerprint: string;
  purpose: string;
  capture: {
    argv: string[];
    runtime: { node: string; engine: string; relevantEnvironment: Record<string, string> };
    elapsedMs: number;
    captureBudget: number;
    /** Present for capture protocols that project a declared physical prefix. */
    prefixProjection?: {
      rule: string;
      donorGap: number;
      donorPhase: string;
      donorCallbackOrdinal: number;
      donorSimFrames: number;
      projectedTargetGap: number;
      directTargetCallbackOrdinal: number | null;
    };
    studySourceFingerprint: string;
  };
  panel: {
    id: TrajectoryCaptureCase["id"];
    cohort: TrajectoryCaptureCase["cohort"];
    category: TrajectoryCaptureCase["category"];
    sourcePath: string;
    sourceFingerprint: string;
    publicSeed: number;
    requestedTargetGap: number;
    selectionRationale: string;
    selectedTargetGap: number;
    outgoingGap: number;
    currentFrame: number;
    outgoingFrame: number;
    outgoingIntervalFrames: number;
    expectedOutgoingFrames: number | null;
    studyScope?: string | null;
  };
  transform: { value: unknown; fingerprint: string };
  materialized: MaterializedTrajectoryCaptureInput;
  materializedFingerprint: string;
  physicalPrefix: PhysicalPrefixFixture;
  physicalPrefixFingerprint: string;
  checkpoints: {
    targetPlanningState: PlanningState;
    targetProbeState: unknown;
    preTargetSledTrace: number[];
    targetPlanningStateFingerprint: string;
    targetProbeStateFingerprint: string;
    preTargetSledTraceFingerprint: string;
  };
  /** Capture identity is evidence, not a constraint on later candidate code. */
  captureCompiler: unknown;
  baseline: {
    contractPassed: boolean;
    score: number;
    deepestGap: number | null;
    /** Null when no standalone compiler callback occurred at the selected gap. */
    targetPrefixSimFrames: number | null;
  };
};

export type FrozenFixtureCaptureArtifactIdentity = {
  schema: "line.frozen-trajectory-prefix-capture.v1";
  panelId: string;
  panelSourceFingerprint: string;
  captureBudget: number;
  engine: string;
  relevantEnvironment: Record<string, string>;
  studySourceFingerprint: string;
  captureCandidateFingerprint: string;
  protocolFingerprint: string;
  fingerprint: string;
};

export type FrozenTrajectoryFixtureV2 = FrozenTrajectoryFixtureBase & {
  schema: "line.frozen-trajectory-prefix.v2";
};

export type FrozenTrajectoryFixtureV3 = FrozenTrajectoryFixtureBase & {
  schema: "line.frozen-trajectory-prefix.v3";
  capture: FrozenTrajectoryFixtureBase["capture"] & {
    studySourceFiles: string[];
    captureIdentity: FrozenFixtureCaptureArtifactIdentity;
    identityCheck: {
      stable: boolean;
      panelSourceFingerprintAtStart: string;
      panelSourceFingerprintAtEnd: string;
      studySourceFingerprintAtStart: string;
      studySourceFingerprintAtEnd: string;
      captureCandidateFingerprintAtStart: string;
      captureCandidateFingerprintAtEnd: string;
    };
    captureCompilerAtEnd: unknown;
  };
};

/** V2 fixtures remain readable as immutable historical inputs; new capture writes V3. */
export type FrozenTrajectoryFixture = FrozenTrajectoryFixtureV2 | FrozenTrajectoryFixtureV3;
export type FrozenTrajectoryFixturePayload =
  | Omit<FrozenTrajectoryFixtureV2, "fixtureFingerprint">
  | Omit<FrozenTrajectoryFixtureV3, "fixtureFingerprint">;

export function readFrozenTrajectoryFixture(path: string): FrozenTrajectoryFixture {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as FrozenTrajectoryFixture;
  assertFrozenTrajectoryFixtureIntegrity(parsed, path);
  return parsed;
}

export function assertFrozenTrajectoryFixtureIntegrity(
  fixture: FrozenTrajectoryFixture,
  label = "fixture",
): void {
  if ((fixture as { schema?: unknown })?.schema === "line.frozen-trajectory-prefix.v1") {
    throw new Error(`${label}: v1 fixture lacks the frozen cohort/selection declaration; recapture it as v2`);
  }
  if (fixture?.schema !== "line.frozen-trajectory-prefix.v2" && fixture?.schema !== "line.frozen-trajectory-prefix.v3") {
    throw new Error(`${label}: unsupported frozen trajectory fixture schema`);
  }
  if (typeof fixture.fixtureFingerprint !== "string" || fixture.fixtureFingerprint.length !== 64) {
    throw new Error(`${label}: missing fixture fingerprint`);
  }
  const { fixtureFingerprint, ...payload } = fixture;
  if (fixtureFingerprintForPayload(payload) !== fixtureFingerprint) {
    throw new Error(`${label}: fixture fingerprint does not match its payload`);
  }
  if (fixture.schema === "line.frozen-trajectory-prefix.v3") {
    assertV3CaptureIdentity(fixture, label);
  }
}

export function fixtureFingerprintForPayload(payload: FrozenTrajectoryFixturePayload): string {
  return sha256(stableJson(payload));
}

export function frozenFixtureCaptureArtifactIdentity(
  input: Omit<FrozenFixtureCaptureArtifactIdentity, "fingerprint">,
): FrozenFixtureCaptureArtifactIdentity {
  return { ...input, fingerprint: sha256(stableJson(input)) };
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertV3CaptureIdentity(fixture: FrozenTrajectoryFixtureV3, label: string): void {
  const identity = fixture.capture.captureIdentity;
  if (identity === null || typeof identity !== "object") {
    throw new Error(`${label}: V3 capture is missing its artifact identity`);
  }
  const { fingerprint, ...identityPayload } = identity;
  if (identity.schema !== "line.frozen-trajectory-prefix-capture.v1" ||
      typeof fingerprint !== "string" ||
      fingerprint !== sha256(stableJson(identityPayload))) {
    throw new Error(`${label}: invalid V3 capture artifact identity`);
  }
  if (identity.studySourceFingerprint !== fixture.capture.studySourceFingerprint ||
      identity.captureCandidateFingerprint !== fixture.capture.identityCheck.captureCandidateFingerprintAtStart ||
      identity.studySourceFingerprint !== fixture.capture.identityCheck.studySourceFingerprintAtStart ||
      identity.panelSourceFingerprint !== fixture.capture.identityCheck.panelSourceFingerprintAtStart) {
    throw new Error(`${label}: V3 capture artifact identity does not bind its start provenance`);
  }
  if (identity.panelId !== fixture.panel.id ||
      identity.panelSourceFingerprint !== fixture.panel.sourceFingerprint ||
      identity.captureBudget !== fixture.capture.captureBudget ||
      identity.engine !== fixture.capture.runtime.engine ||
      stableJson(identity.relevantEnvironment) !== stableJson(fixture.capture.runtime.relevantEnvironment)) {
    throw new Error(`${label}: V3 capture artifact identity does not bind its declared panel or runtime`);
  }
  if (fixture.capture.studySourceFiles.length === 0) {
    throw new Error(`${label}: V3 capture is missing its static source closure`);
  }
  const check = fixture.capture.identityCheck;
  if (typeof check.stable !== "boolean" ||
      typeof check.panelSourceFingerprintAtEnd !== "string" ||
      typeof check.studySourceFingerprintAtEnd !== "string" ||
      typeof check.captureCandidateFingerprintAtEnd !== "string" ||
      fixture.capture.captureCompilerAtEnd === undefined) {
    throw new Error(`${label}: V3 capture is missing its end-provenance check`);
  }
  const endpointPairsEqual =
    check.panelSourceFingerprintAtStart === check.panelSourceFingerprintAtEnd &&
    check.studySourceFingerprintAtStart === check.studySourceFingerprintAtEnd &&
    check.captureCandidateFingerprintAtStart === check.captureCandidateFingerprintAtEnd;
  if (check.stable !== endpointPairsEqual) {
    throw new Error(`${label}: V3 capture stability does not match its endpoint identities`);
  }
  if (candidateFingerprintOf(fixture.captureCompiler) !== check.captureCandidateFingerprintAtStart ||
      candidateFingerprintOf(fixture.capture.captureCompilerAtEnd) !== check.captureCandidateFingerprintAtEnd) {
    throw new Error(`${label}: V3 capture compiler identities do not match their declared fingerprints`);
  }
}

function candidateFingerprintOf(value: unknown): string | null {
  if (value === null || typeof value !== "object") return null;
  const candidateFingerprint = (value as { candidateFingerprint?: unknown }).candidateFingerprint;
  return typeof candidateFingerprint === "string" ? candidateFingerprint : null;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, sortKeys(child)]));
  }
  return value;
}
