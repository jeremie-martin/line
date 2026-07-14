import { describe, expect, test } from "vitest";
import { fixtureFingerprintForPayload, type FrozenTrajectoryFixtureV3 } from "../scripts/v0/trajectory/frozen_fixture.ts";
import {
  currentContactForPostimpactStudy,
  postimpactObservationForStudy,
} from "../scripts/v0/trajectory/postimpact_study_inputs.ts";

function fixture(): FrozenTrajectoryFixtureV3 {
  const payload = {
    schema: "line.frozen-trajectory-prefix.v3" as const,
    purpose: "input boundary test",
    capture: {
      argv: [],
      runtime: { node: "test", engine: "wasm", relevantEnvironment: { LR_ENGINE: "wasm" } },
      elapsedMs: 0,
      captureBudget: 1,
      studySourceFingerprint: "study",
      studySourceFiles: ["capture.ts"],
      captureIdentity: {
        schema: "line.frozen-trajectory-prefix-capture.v1" as const,
        panelId: "dense",
        panelSourceFingerprint: "source",
        captureBudget: 1,
        engine: "wasm",
        relevantEnvironment: { LR_ENGINE: "wasm" },
        studySourceFingerprint: "study",
        captureCandidateFingerprint: "candidate",
        protocolFingerprint: "protocol",
        fingerprint: "identity",
      },
      identityCheck: {
        stable: true,
        panelSourceFingerprintAtStart: "source",
        panelSourceFingerprintAtEnd: "source",
        studySourceFingerprintAtStart: "study",
        studySourceFingerprintAtEnd: "study",
        captureCandidateFingerprintAtStart: "candidate",
        captureCandidateFingerprintAtEnd: "candidate",
      },
      captureCompilerAtEnd: { candidateFingerprint: "candidate" },
    },
    panel: {
      id: "dense" as const,
      cohort: "calibration" as const,
      category: "dense" as const,
      sourcePath: "source.ts",
      sourceFingerprint: "source",
      publicSeed: 1,
      requestedTargetGap: 1,
      selectionRationale: "fixed",
      selectedTargetGap: 1,
      outgoingGap: 2,
      currentFrame: 20,
      outgoingFrame: 32,
      outgoingIntervalFrames: 12,
      expectedOutgoingFrames: null,
    },
    transform: { value: {}, fingerprint: "transform" },
    materialized: {
      contactFrames: [10, 20, 32],
      durationFrames: 40,
      gaps: [
        { index: 0, startFrame: 0, endFrame: 10, endsWithContact: true, targets: {}, nextImpact: 0.7 },
        { index: 1, startFrame: 10, endFrame: 20, endsWithContact: true, targets: { air: 0.2, speed: 0.8, impact: 0.7 }, nextImpact: 0.9 },
        { index: 2, startFrame: 20, endFrame: 32, endsWithContact: true, targets: { air: 0.3, speed: 0.6, impact: 0.9 }, nextImpact: null },
      ],
      gapAxisTargets: [{}, { impact: 0.7 }, { impact: 0.9 }],
    },
    materializedFingerprint: "materialized",
    physicalPrefix: {
      schema: "line.trajectory-physical-prefix.v1" as const,
      gapIndex: 1,
      prefixNextLineId: 3,
      cumulativeCost: 0,
      searchSeed: 1,
      startState: { position: { x: 0, y: 0 }, velocity: { x: 1, y: 0 } },
      startLines: [],
      prefixFitLines: [],
    },
    physicalPrefixFingerprint: "prefix",
    checkpoints: {
      targetPlanningState: {} as never,
      targetProbeState: {},
      preTargetSledTrace: [],
      targetPlanningStateFingerprint: "state",
      targetProbeStateFingerprint: "probe",
      preTargetSledTraceFingerprint: "trace",
    },
    captureCompiler: { candidateFingerprint: "candidate" },
    baseline: { contractPassed: true, score: 1, deepestGap: 1, targetPrefixSimFrames: 20 },
  };
  return { ...payload, fixtureFingerprint: fixtureFingerprintForPayload(payload) } as FrozenTrajectoryFixtureV3;
}

describe("post-impact study input boundaries", () => {
  test("exposes only the positive current impact to capture construction", () => {
    const current = currentContactForPostimpactStudy(fixture());
    expect(current).toEqual({ gapIndex: 1, startFrame: 10, endFrame: 20, intervalFrames: 10, impact: 0.7 });
    expect(Object.keys(current)).not.toContain("nextImpact");
    expect(Object.keys(current)).not.toContain("axes");
  });

  test("opens outgoing observation separately and never returns its next impact", () => {
    const observation = postimpactObservationForStudy(fixture());
    expect(observation).toEqual({
      outgoing: {
        gapIndex: 2,
        startFrame: 20,
        endFrame: 32,
        intervalFrames: 12,
        axes: { air: 0.3, speed: 0.6 },
      },
      authoredContactFrames: [10, 20, 32],
    });
    expect(Object.keys(observation.outgoing)).not.toContain("nextImpact");
    expect(Object.keys(observation.outgoing.axes)).not.toContain("impact");
  });

  test("is blind to poisoned outgoing axes and next-event values at the capture boundary", () => {
    const clean = fixture();
    const poisoned = structuredClone(clean);
    poisoned.materialized.gaps[2]!.targets = { air: Number.NaN, speed: -99, impact: 123 };
    poisoned.materialized.gaps[2]!.nextImpact = 999;
    expect(currentContactForPostimpactStudy(poisoned)).toEqual(currentContactForPostimpactStudy(clean));
  });
});
