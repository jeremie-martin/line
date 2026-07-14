import {
  type LongCarrierReplicationEvidence,
  type LongCarrierReplicationExpectedIdentities,
} from "../../scripts/v0/trajectory/long_carrier_replication_assessment.ts";
import {
  LONG_CARRIER_REPLICATION_FRACTIONS,
  LONG_CARRIER_REPLICATION_PROTOCOL,
  LONG_CARRIER_REPLICATION_SCOPE,
  type LongCarrierReplicationCase,
} from "../../scripts/v0/trajectory/long_carrier_replication_protocol.ts";
import {
  LONG_CARRIER_REPLICATION_FEASIBILITY_SCHEMA,
  type LongCarrierReplicationFeasibilityBinding,
  type LongCarrierReplicationFeasibilityRecord,
} from "../../scripts/v0/trajectory/long_carrier_replication_feasibility.ts";
import { LONG_CARRIER_COMPILER_IDENTITY_PROTOCOL } from "../../scripts/v0/trajectory/long_carrier_replication_candidate.ts";
import { sealReplicationRecord } from "../../scripts/v0/trajectory/long_carrier_replication_records.ts";
import { sealPostimpactAssayArtifact } from "../../scripts/v0/trajectory/postimpact_assay_artifact.ts";
import { sha256, stableJson } from "../../scripts/v0/trajectory/postimpact_study_inputs.ts";

export const LONG_CARRIER_TEST_PANEL_SOURCE_FINGERPRINTS: Record<string, string> = Object.fromEntries(
  [...new Set(LONG_CARRIER_REPLICATION_PROTOCOL.cases.map((entry) => entry.sourcePath))]
    .sort()
    .map((path) => [path, sha256(`panel:${path}`)]),
);

const TEST_CAPTURE_RUNTIME_PAYLOAD = {
  runtimeIdentityProtocol: "line.long-carrier-replication-capture-runtime.v2" as const,
  engine: "wasm" as const,
  engineArtifactFingerprint: null,
  node: "vtest",
  platform: "test-platform",
  arch: "test-arch",
  typescriptVersion: "test-typescript",
  tsxVersion: "test-tsx",
  runtimePackages: ["@esbuild/test", "esbuild", "tsx", "typescript"],
  runtimePackageClosureFingerprint: "7".repeat(64),
  relevantEnvironment: { LR_ENGINE: "wasm" as const },
};

export const LONG_CARRIER_TEST_CAPTURE_RUNTIME = {
  ...TEST_CAPTURE_RUNTIME_PAYLOAD,
  fingerprint: sha256(stableJson(TEST_CAPTURE_RUNTIME_PAYLOAD)),
};

const TEST_CANDIDATE_PAYLOAD = {
  compilerIdentityProtocol: LONG_CARRIER_COMPILER_IDENTITY_PROTOCOL,
  compilerSourceBoundaryFingerprint: "8".repeat(64),
  compilerSourceFingerprint: "9".repeat(64),
  compilerEnvironment: {},
  engine: "wasm",
  engineArtifactFingerprint: null,
};

export const LONG_CARRIER_TEST_CANDIDATE = {
  ...TEST_CANDIDATE_PAYLOAD,
  compilerSourceFiles: ["scripts/v0/optimizer/handoff.ts"],
  candidateFingerprint: sha256(stableJson(TEST_CANDIDATE_PAYLOAD)),
};

export const LONG_CARRIER_TEST_IDENTITIES: LongCarrierReplicationExpectedIdentities = {
  captureStudySourceFingerprint: "a".repeat(64),
  captureCandidateFingerprint: LONG_CARRIER_TEST_CANDIDATE.candidateFingerprint,
  captureRuntimeFingerprint: LONG_CARRIER_TEST_CAPTURE_RUNTIME.fingerprint,
  assaySourceFingerprint: "c".repeat(64),
  assayRuntimeFingerprint: "d".repeat(64),
};

export const LONG_CARRIER_TEST_FEASIBILITY_BINDING: LongCarrierReplicationFeasibilityBinding = {
  feasibilitySourceFingerprint: "e".repeat(64),
  captureSourceFingerprint: LONG_CARRIER_TEST_IDENTITIES.captureStudySourceFingerprint,
  captureRuntimeFingerprint: LONG_CARRIER_TEST_CAPTURE_RUNTIME.fingerprint,
  captureCandidateFingerprint: LONG_CARRIER_TEST_IDENTITIES.captureCandidateFingerprint,
  panelSourceFingerprints: LONG_CARRIER_TEST_PANEL_SOURCE_FINGERPRINTS,
};

const ZERO_SUMMARY = {
  captureRows: 1,
  captureProtocolInvalidRows: 0,
  selectedPhaseRows: 1,
  completeFiveArmRows: 1,
  monotoneRows: 1,
  nonMonotoneRows: 0,
  unavailableRows: 0,
  constructionInvalidPhases: 0,
  constructionProtocolInvalidRows: 0,
  constructionReportMismatches: 0,
  measurementRosterViolations: 0,
  durationEndpointMismatches: 0,
  measurementProtectedBoundaryViolations: 0,
  armErrors: 0,
};

export function validLongCarrierReplicationCohort(): LongCarrierReplicationEvidence[] {
  return LONG_CARRIER_REPLICATION_PROTOCOL.cases.map((entry) => evidenceFor(entry));
}

export function evidenceFor(
  entry: LongCarrierReplicationCase,
  options: { monotone?: boolean; air?: readonly number[] } = {},
): LongCarrierReplicationEvidence {
  const fixture = fixtureFor(entry);
  return {
    id: entry.id,
    capture: { exitCode: 0, fixture },
    assay: { exitCode: 0, artifact: artifactFor(entry, fixture, options) },
  };
}

export function fixtureFor(entry: LongCarrierReplicationCase): Record<string, unknown> {
  const currentStart = entry.targetGap * 10;
  const currentEnd = currentStart + 10;
  const outgoingEnd = currentEnd + entry.expectedOutgoingFrames;
  const materialized = {
    contactFrames: [...Array.from({ length: entry.targetGap + 1 }, (_, index) => (index + 1) * 10), outgoingEnd],
    durationFrames: outgoingEnd + 20,
    gaps: [
      ...Array.from({ length: entry.targetGap + 1 }, (_, index) => ({
        index,
        startFrame: index * 10,
        endFrame: (index + 1) * 10,
        endsWithContact: true,
        targets: { impact: 0.4 },
        nextImpact: 0.6,
      })),
      {
        index: entry.targetGap + 1,
        startFrame: currentEnd,
        endFrame: outgoingEnd,
        endsWithContact: true,
        targets: { air: 0.2 },
        nextImpact: null,
      },
    ],
    gapAxisTargets: Array.from({ length: entry.targetGap + 2 }, (_, index) =>
      index === entry.targetGap + 1 ? { air: 0.2 } : { impact: 0.4 }),
  };
  const physicalPrefix = {
    schema: "line.trajectory-physical-prefix.v1",
    gapIndex: entry.targetGap,
    prefixNextLineId: 1,
    cumulativeCost: 0,
    searchSeed: entry.publicSeed,
    startState: { position: { x: 0, y: 0 }, velocity: { x: 1, y: 0 } },
    startLines: [],
    prefixFitLines: [],
  };
  const panelSourceFingerprint = LONG_CARRIER_TEST_PANEL_SOURCE_FINGERPRINTS[entry.sourcePath]!;
  const captureProtocolFingerprint = sha256(stableJson({
    schema: "line.frozen-trajectory-prefix-capture-protocol.v1",
    scope: LONG_CARRIER_REPLICATION_SCOPE,
    panel: {
      id: entry.id,
      cohort: "validation",
      category: entry.category,
      sourcePath: entry.sourcePath,
      sourceFingerprint: panelSourceFingerprint,
      publicSeed: entry.publicSeed,
      requestedTargetGap: entry.targetGap,
      selectionRationale: entry.selectionRationale,
      expectedOutgoingFrames: entry.expectedOutgoingFrames,
      studyScope: LONG_CARRIER_REPLICATION_SCOPE,
    },
    capture: {
      engine: "wasm",
      budget: LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget,
      relevantEnvironment: { LR_ENGINE: "wasm" },
      transformFingerprint: sha256(stableJson(LONG_CARRIER_REPLICATION_PROTOCOL.capture.transform)),
      prefixProjectionRule: LONG_CARRIER_REPLICATION_PROTOCOL.capture.prefixProjectionRule,
    },
  }));
  const captureIdentityPayload = {
    schema: "line.frozen-trajectory-prefix-capture.v1",
    panelId: entry.id,
    panelSourceFingerprint,
    captureBudget: LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget,
    engine: "wasm",
    relevantEnvironment: { LR_ENGINE: "wasm" },
    studySourceFingerprint: LONG_CARRIER_TEST_IDENTITIES.captureStudySourceFingerprint,
    captureCandidateFingerprint: LONG_CARRIER_TEST_IDENTITIES.captureCandidateFingerprint,
    protocolFingerprint: captureProtocolFingerprint,
  };
  const targetPlanningState = { frame: currentEnd };
  const targetProbeState = {};
  const preTargetSledTrace: number[] = [];
  const payload = {
    schema: "line.frozen-trajectory-prefix.v3",
    purpose: "replication assessor test fixture",
    capture: {
      argv: [],
      runtime: { node: "test", engine: "wasm", relevantEnvironment: { LR_ENGINE: "wasm" } },
      runtimeIdentity: LONG_CARRIER_TEST_CAPTURE_RUNTIME,
      elapsedMs: 0,
      captureBudget: LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget,
      prefixProjection: {
        rule: LONG_CARRIER_REPLICATION_PROTOCOL.capture.prefixProjectionRule,
        donorGap: entry.targetGap,
        donorSkippedContacts: 0,
        donorPhase: "main",
        donorCallbackOrdinal: 1,
        donorSimFrames: currentEnd,
        projectedTargetGap: entry.targetGap,
        directTargetCallbackOrdinal: 1,
        directTargetSimFrames: currentEnd,
      },
      studySourceFingerprint: LONG_CARRIER_TEST_IDENTITIES.captureStudySourceFingerprint,
      studySourceFiles: ["scripts/v0/capture_long_carrier_replication_fixture.ts"],
      captureIdentity: {
        ...captureIdentityPayload,
        fingerprint: sha256(stableJson(captureIdentityPayload)),
      },
      identityCheck: {
        stable: true,
        panelSourceFingerprintAtStart: panelSourceFingerprint,
        panelSourceFingerprintAtEnd: panelSourceFingerprint,
        studySourceFingerprintAtStart: LONG_CARRIER_TEST_IDENTITIES.captureStudySourceFingerprint,
        studySourceFingerprintAtEnd: LONG_CARRIER_TEST_IDENTITIES.captureStudySourceFingerprint,
        captureCandidateFingerprintAtStart: LONG_CARRIER_TEST_IDENTITIES.captureCandidateFingerprint,
        captureCandidateFingerprintAtEnd: LONG_CARRIER_TEST_IDENTITIES.captureCandidateFingerprint,
        captureRuntimeFingerprintAtStart: LONG_CARRIER_TEST_CAPTURE_RUNTIME.fingerprint,
        captureRuntimeFingerprintAtEnd: LONG_CARRIER_TEST_CAPTURE_RUNTIME.fingerprint,
      },
      captureCompilerAtEnd: { candidateFingerprint: LONG_CARRIER_TEST_IDENTITIES.captureCandidateFingerprint },
    },
    panel: {
      id: entry.id,
      cohort: "validation",
      category: entry.category,
      sourcePath: entry.sourcePath,
      sourceFingerprint: panelSourceFingerprint,
      publicSeed: entry.publicSeed,
      requestedTargetGap: entry.targetGap,
      selectionRationale: entry.selectionRationale,
      selectedTargetGap: entry.targetGap,
      outgoingGap: entry.targetGap + 1,
      currentFrame: currentEnd,
      outgoingFrame: outgoingEnd,
      outgoingIntervalFrames: entry.expectedOutgoingFrames,
      expectedOutgoingFrames: entry.expectedOutgoingFrames,
      studyScope: LONG_CARRIER_REPLICATION_SCOPE,
    },
    transform: {
      value: LONG_CARRIER_REPLICATION_PROTOCOL.capture.transform,
      fingerprint: sha256(stableJson(LONG_CARRIER_REPLICATION_PROTOCOL.capture.transform)),
    },
    materialized,
    materializedFingerprint: sha256(stableJson(materialized)),
    physicalPrefix,
    physicalPrefixFingerprint: sha256(stableJson(physicalPrefix)),
    checkpoints: {
      targetPlanningState,
      targetProbeState,
      preTargetSledTrace,
      targetPlanningStateFingerprint: sha256(stableJson(targetPlanningState)),
      targetProbeStateFingerprint: sha256(stableJson(targetProbeState)),
      preTargetSledTraceFingerprint: sha256(stableJson(preTargetSledTrace)),
    },
    captureCompiler: { candidateFingerprint: LONG_CARRIER_TEST_IDENTITIES.captureCandidateFingerprint },
    baseline: {
      contractPassed: true,
      score: 1,
      deepestGap: entry.targetGap,
      targetPrefixSimFrames: currentEnd,
    },
  };
  return { ...payload, fixtureFingerprint: sha256(stableJson(payload)) };
}

export function artifactFor(
  entry: LongCarrierReplicationCase,
  fixture: Record<string, unknown>,
  options: { monotone?: boolean; air?: readonly number[] } = {},
): Record<string, unknown> {
  const air = options.air ?? [0.8, 0.7, 0.6, 0.5, 0.4];
  const protocolFingerprint = "f".repeat(64);
  const artifactIdentityPayload = {
    fixtureFingerprint: fixture.fixtureFingerprint,
    sourceFingerprint: LONG_CARRIER_TEST_IDENTITIES.assaySourceFingerprint,
    runtimeFingerprint: LONG_CARRIER_TEST_IDENTITIES.assayRuntimeFingerprint,
    protocolFingerprint,
  };
  const payload = {
    schema: "line.study-postimpact-long-carrier-duration.v1",
    artifactIdentity: {
      ...artifactIdentityPayload,
      fingerprint: sha256(stableJson(artifactIdentityPayload)),
    },
    protocol: { protocolFingerprint },
    status: {
      executionComplete: true,
      descriptiveDurationResponseEligible: true,
      protocolStatus: "complete_with_descriptive_rows",
    },
    argv: [],
    provenance: {
      fixturePath: "test-fixture-path",
      audit: {
        fixtureFingerprint: fixture.fixtureFingerprint,
        runtime: {
          engine: "wasm",
          relevantEnvironment: { LR_ENGINE: "wasm" },
          captureBudget: LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget,
          studySourceFingerprint: LONG_CARRIER_TEST_IDENTITIES.captureStudySourceFingerprint,
        },
        panel: {
          id: entry.id,
          cohort: "validation",
          category: entry.category,
          sourcePath: entry.sourcePath,
          sourceFingerprint: (fixture.panel as Record<string, unknown>).sourceFingerprint,
          publicSeed: entry.publicSeed,
          selectionRationale: entry.selectionRationale,
          studyScope: LONG_CARRIER_REPLICATION_SCOPE,
          currentGap: entry.targetGap,
          currentFrame: (fixture.panel as Record<string, unknown>).currentFrame,
        },
        physicalPrefix: {
          fingerprint: fixture.physicalPrefixFingerprint,
          nextLineId: (fixture.physicalPrefix as Record<string, unknown>).prefixNextLineId,
        },
      },
    },
    summary: { ...ZERO_SUMMARY },
    rows: [{
      measurement: {
        status: "complete",
        primary: {
          monotone: options.monotone ?? true,
          measurementSamples: 100,
          tolerance: 0.01,
          arms: LONG_CARRIER_REPLICATION_FRACTIONS.map((supportFraction, index) => ({
            supportFraction,
            airFraction: air[index]!,
            airborneSamples: Math.round(air[index]! * 100),
          })),
        },
        arms: LONG_CARRIER_REPLICATION_FRACTIONS.map((supportFraction, index) => ({
          supportFraction,
          observedOffBeatFrames: [],
          unresolvedTailOffBeatFrames: [],
          window: { airFraction: air[index]! },
          arrivalTimeSnapshot: { terminalNamedReference: { speedPxPerFrame: 12 - index } },
        })),
      },
    }],
  };
  return sealPostimpactAssayArtifact(payload);
}

/** A complete mechanical-only qualification record matching the synthetic fixtures. */
export function qualifiedLongCarrierReplicationFeasibility(): LongCarrierReplicationFeasibilityRecord {
  const payload = {
    schema: LONG_CARRIER_REPLICATION_FEASIBILITY_SCHEMA,
    scope: LONG_CARRIER_REPLICATION_SCOPE,
    protocolFingerprint: sha256(stableJson(LONG_CARRIER_REPLICATION_PROTOCOL)),
    environment: { LR_ENGINE: "wasm" as const },
    captureBudget: LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget,
    projectionRule: LONG_CARRIER_REPLICATION_PROTOCOL.capture.prefixProjectionRule,
    identities: {
      stable: true,
      feasibilitySourceAtStart: {
        fingerprint: LONG_CARRIER_TEST_FEASIBILITY_BINDING.feasibilitySourceFingerprint,
        sourceFiles: ["scripts/v0/run_long_carrier_replication_feasibility.ts"],
      },
      feasibilitySourceAtEnd: {
        fingerprint: LONG_CARRIER_TEST_FEASIBILITY_BINDING.feasibilitySourceFingerprint,
        sourceFiles: ["scripts/v0/run_long_carrier_replication_feasibility.ts"],
      },
      captureSourceAtStart: {
        fingerprint: LONG_CARRIER_TEST_FEASIBILITY_BINDING.captureSourceFingerprint,
        sourceFiles: ["scripts/v0/capture_long_carrier_replication_fixture.ts"],
      },
      captureSourceAtEnd: {
        fingerprint: LONG_CARRIER_TEST_FEASIBILITY_BINDING.captureSourceFingerprint,
        sourceFiles: ["scripts/v0/capture_long_carrier_replication_fixture.ts"],
      },
      captureRuntimeAtStart: LONG_CARRIER_TEST_CAPTURE_RUNTIME,
      captureRuntimeAtEnd: LONG_CARRIER_TEST_CAPTURE_RUNTIME,
      captureCandidateAtStart: LONG_CARRIER_TEST_CANDIDATE,
      captureCandidateAtEnd: LONG_CARRIER_TEST_CANDIDATE,
      panelSourceFingerprintsAtStart: LONG_CARRIER_TEST_PANEL_SOURCE_FINGERPRINTS,
      panelSourceFingerprintsAtEnd: LONG_CARRIER_TEST_PANEL_SOURCE_FINGERPRINTS,
    },
    rows: LONG_CARRIER_REPLICATION_PROTOCOL.cases.map((entry) => {
      const fixture = fixtureFor(entry);
      const capture = fixture.capture as Record<string, unknown>;
      const projection = capture.prefixProjection as Record<string, unknown>;
      const prefix = fixture.physicalPrefix as Record<string, unknown>;
      const checkpoints = fixture.checkpoints as Record<string, unknown>;
      const materialized = fixture.materialized as { gaps: unknown[] };
      return {
        id: entry.id,
        sourcePath: entry.sourcePath,
        sourceFingerprintAtStart: LONG_CARRIER_TEST_PANEL_SOURCE_FINGERPRINTS[entry.sourcePath]!,
        sourceFingerprintAtEnd: LONG_CARRIER_TEST_PANEL_SOURCE_FINGERPRINTS[entry.sourcePath]!,
        targetGap: entry.targetGap,
        outgoingGap: entry.targetGap + 1,
        outgoingIntervalFrames: entry.expectedOutgoingFrames,
        materializedGapCount: materialized.gaps.length,
        status: "available" as const,
        failureCode: null,
        witness: {
          projectionRule: projection.rule,
          donorGap: projection.donorGap,
          donorSkippedContacts: projection.donorSkippedContacts,
          physicalPrefixFingerprint: fixture.physicalPrefixFingerprint,
          materializedFingerprint: fixture.materializedFingerprint,
          prefixNextLineId: prefix.prefixNextLineId,
          cumulativeCost: prefix.cumulativeCost,
          targetPlanningStateFingerprint: checkpoints.targetPlanningStateFingerprint,
          targetProbeStateFingerprint: checkpoints.targetProbeStateFingerprint,
          preTargetSledTraceFingerprint: checkpoints.preTargetSledTraceFingerprint,
        },
        elapsedMs: 0,
      };
    }),
    qualified: true,
  };
  return sealReplicationRecord(payload) as LongCarrierReplicationFeasibilityRecord;
}

export function resealArtifact(
  entry: LongCarrierReplicationEvidence,
  mutate: (artifact: Record<string, any>) => void,
): void {
  const artifact = structuredClone(entry.assay.artifact) as Record<string, any>;
  delete artifact.artifactContentFingerprint;
  mutate(artifact);
  entry.assay.artifact = sealPostimpactAssayArtifact(artifact);
}

export function resealFixtureAndRebindAssay(
  entry: LongCarrierReplicationEvidence,
  mutateFixture: (fixture: Record<string, any>) => void,
  mutateArtifact: (artifact: Record<string, any>) => void = () => {},
): void {
  const fixture = structuredClone(entry.capture.fixture) as Record<string, any>;
  mutateFixture(fixture);
  fixture.physicalPrefixFingerprint = sha256(stableJson(fixture.physicalPrefix));
  const { fixtureFingerprint: _previous, ...payload } = fixture;
  fixture.fixtureFingerprint = sha256(stableJson(payload));
  entry.capture.fixture = fixture;
  resealArtifact(entry, (artifact) => {
    artifact.artifactIdentity.fixtureFingerprint = fixture.fixtureFingerprint;
    const { fingerprint: _identityFingerprint, ...identityPayload } = artifact.artifactIdentity;
    artifact.artifactIdentity.fingerprint = sha256(stableJson(identityPayload));
    artifact.provenance.audit.fixtureFingerprint = fixture.fixtureFingerprint;
    artifact.provenance.audit.physicalPrefix.fingerprint = fixture.physicalPrefixFingerprint;
    artifact.provenance.audit.physicalPrefix.nextLineId = fixture.physicalPrefix.prefixNextLineId;
    mutateArtifact(artifact);
  });
}
