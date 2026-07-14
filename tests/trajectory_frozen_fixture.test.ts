import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import {
  assertFrozenTrajectoryFixtureIntegrity,
  fixtureFingerprintForPayload,
  frozenFixtureCaptureArtifactIdentity,
  readFrozenTrajectoryFixture,
  type FrozenTrajectoryFixturePayload,
  type FrozenTrajectoryFixtureV3,
} from "../scripts/v0/trajectory/frozen_fixture.ts";
import { prepareStateCoupledTrajectoryFixture } from "../scripts/v0/trajectory/study_context.ts";

describe("frozen trajectory fixture provenance", () => {
  test("keeps historical V2 fixtures readable without manufacturing V3 provenance", () => {
    const payload = baseV2Payload();
    const fixture = { ...payload, fixtureFingerprint: fixtureFingerprintForPayload(payload) };
    expect(() => assertFrozenTrajectoryFixtureIntegrity(fixture)).not.toThrow();

    const root = mkdtempSync(join(tmpdir(), "line-frozen-fixture-"));
    try {
      const path = join(root, "fixture.json");
      writeFileSync(path, `${JSON.stringify(fixture)}\n`);
      expect(readFrozenTrajectoryFixture(path).schema).toBe("line.frozen-trajectory-prefix.v2");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("binds V3 start provenance and quarantines only drifted V3 inputs", () => {
    const stable = v3Fixture(true);
    expect(() => assertFrozenTrajectoryFixtureIntegrity(stable)).not.toThrow();

    const tampered = structuredClone(stable);
    const { fingerprint: _identityFingerprint, ...tamperedIdentity } = tampered.capture.captureIdentity;
    tampered.capture.captureIdentity = frozenFixtureCaptureArtifactIdentity({
      ...tamperedIdentity,
      captureBudget: 1,
    });
    const { fixtureFingerprint: _previousFingerprint, ...tamperedPayload } = tampered;
    tampered.fixtureFingerprint = fixtureFingerprintForPayload(tamperedPayload);
    expect(() => assertFrozenTrajectoryFixtureIntegrity(tampered)).toThrow(/declared panel or runtime/);

    const inconsistent = structuredClone(stable);
    inconsistent.capture.identityCheck.captureCandidateFingerprintAtEnd = "candidate-end";
    const { fixtureFingerprint: _inconsistentFingerprint, ...inconsistentPayload } = inconsistent;
    inconsistent.fixtureFingerprint = fixtureFingerprintForPayload(inconsistentPayload);
    expect(() => assertFrozenTrajectoryFixtureIntegrity(inconsistent)).toThrow(/stability does not match/);

    const drift = v3Fixture(false);
    expect(() => assertFrozenTrajectoryFixtureIntegrity(drift)).not.toThrow();
    expect(() => prepareStateCoupledTrajectoryFixture(drift)).toThrow(/forensic V3 fixture/);
  });
});

function baseV2Payload(): FrozenTrajectoryFixturePayload {
  return {
    schema: "line.frozen-trajectory-prefix.v2",
    purpose: "test",
    capture: {
      argv: [],
      runtime: { node: "test", engine: "wasm", relevantEnvironment: { LR_ENGINE: "wasm" } },
      elapsedMs: 0,
      captureBudget: 500_000,
      studySourceFingerprint: "source-start",
    },
    panel: panel(),
    transform: { value: {}, fingerprint: "transform" },
    materialized: {} as never,
    materializedFingerprint: "materialized",
    physicalPrefix: {} as never,
    physicalPrefixFingerprint: "physical-prefix",
    checkpoints: {
      targetPlanningState: {} as never,
      targetProbeState: {},
      preTargetSledTrace: [],
      targetPlanningStateFingerprint: "planning",
      targetProbeStateFingerprint: "probe",
      preTargetSledTraceFingerprint: "trace",
    },
    captureCompiler: { candidateFingerprint: "candidate-start" },
    baseline: { contractPassed: false, score: 0, deepestGap: null, targetPrefixSimFrames: 0 },
  };
}

function v3Fixture(stable: boolean): FrozenTrajectoryFixtureV3 {
  const source = "source-start";
  const candidate = "candidate-start";
  const identity = frozenFixtureCaptureArtifactIdentity({
    schema: "line.frozen-trajectory-prefix-capture.v1",
    panelId: "dense",
    panelSourceFingerprint: "panel-source",
    captureBudget: 500_000,
    engine: "wasm",
    relevantEnvironment: { LR_ENGINE: "wasm" },
    studySourceFingerprint: source,
    captureCandidateFingerprint: candidate,
    protocolFingerprint: "protocol",
  });
  const v2 = baseV2Payload();
  const payload: Omit<FrozenTrajectoryFixtureV3, "fixtureFingerprint"> = {
    ...v2,
    schema: "line.frozen-trajectory-prefix.v3",
    capture: {
      ...v2.capture,
      studySourceFingerprint: source,
      studySourceFiles: ["scripts/v0/capture_trajectory_fixture.ts"],
      captureIdentity: identity,
      identityCheck: {
        stable,
        panelSourceFingerprintAtStart: "panel-source",
        panelSourceFingerprintAtEnd: "panel-source",
        studySourceFingerprintAtStart: source,
        studySourceFingerprintAtEnd: stable ? source : "source-end",
        captureCandidateFingerprintAtStart: candidate,
        captureCandidateFingerprintAtEnd: stable ? candidate : "candidate-end",
      },
      captureCompilerAtEnd: { candidateFingerprint: stable ? candidate : "candidate-end" },
    },
  };
  return { ...payload, fixtureFingerprint: fixtureFingerprintForPayload(payload) };
}

function panel() {
  return {
    id: "dense",
    cohort: "calibration" as const,
    category: "dense" as const,
    sourcePath: "source.ts",
    sourceFingerprint: "panel-source",
    publicSeed: 1,
    requestedTargetGap: 1,
    selectionRationale: "test",
    selectedTargetGap: 1,
    outgoingGap: 2,
    currentFrame: 1,
    outgoingFrame: 2,
    outgoingIntervalFrames: 1,
    expectedOutgoingFrames: null,
  };
}
