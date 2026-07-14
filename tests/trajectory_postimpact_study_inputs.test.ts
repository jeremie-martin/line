import { describe, expect, test } from "vitest";
import * as inputs from "../scripts/v0/trajectory/postimpact_study_inputs.ts";
import {
  assertPostimpactV3FixtureIntegrity,
  sha256,
  stableJson,
  withValidatedPostimpactCaptureThenDurationInputs,
  withValidatedPostimpactStudyInputs,
  type PostimpactFrozenTrajectoryFixtureV3,
} from "../scripts/v0/trajectory/postimpact_study_inputs.ts";

describe("post-impact study input adapters", () => {
  test("keeps raw current/observation readers private and exports only validated composition", () => {
    expect("currentContactForPostimpactStudy" in inputs).toBe(false);
    expect("postimpactObservationForStudy" in inputs).toBe(false);
    expect("withValidatedPostimpactStudyInputs" in inputs).toBe(true);
    expect("withValidatedPostimpactCaptureThenDurationInputs" in inputs).toBe(true);
  });

  test("validates the complete V3 snapshot before adapters consume authored targets", () => {
    const fixture = makeFixture();
    expect(() => assertPostimpactV3FixtureIntegrity(fixture)).not.toThrow();

    const malformedAxes = structuredClone(fixture);
    malformedAxes.materialized.gaps[2]!.targets.air = Number.NaN;
    refreshMaterializedAndFixtureFingerprints(malformedAxes);
    expect(() => assertPostimpactV3FixtureIntegrity(malformedAxes)).toThrow(/air target must be finite/);

    const staleProbe = structuredClone(fixture);
    staleProbe.checkpoints.targetProbeState = { altered: true };
    refreshFixtureFingerprint(staleProbe);
    expect(() => assertPostimpactV3FixtureIntegrity(staleProbe)).toThrow(/target probe-state fingerprint does not match/);
  });

  test("returns only current impact during construction, then releases outgoing observation", () => {
    const fixture = makeFixture();
    assertPostimpactV3FixtureIntegrity(fixture);
    const order: string[] = [];
    const result = withValidatedPostimpactStudyInputs(fixture, (current) => {
      order.push("construction");
      expect(current).toEqual({ gapIndex: 1, startFrame: 10, endFrame: 20, intervalFrames: 10, impact: 0.7 });
      expect(Object.keys(current)).not.toContain("nextImpact");
      expect(Object.keys(current)).not.toContain("axes");
      return "selected";
    });
    order.push("observation");

    expect(order).toEqual(["construction", "observation"]);
    expect(result).toEqual({
      constructionResult: "selected",
      observation: {
        outgoing: {
          gapIndex: 2,
          startFrame: 20,
          endFrame: 32,
          intervalFrames: 12,
          axes: { air: 0.3, speed: 0.6 },
        },
        authoredContactFrames: [10, 20, 32],
      },
    });
    expect(Object.keys(result.observation.outgoing)).not.toContain("nextImpact");
    expect(Object.keys(result.observation.outgoing.axes)).not.toContain("impact");
  });

  test("releases only the outgoing endpoint between capture and full observation", () => {
    const fixture = makeFixture();
    const order: string[] = [];
    const result = withValidatedPostimpactCaptureThenDurationInputs(
      fixture,
      (current) => {
        order.push("capture");
        expect(Object.keys(current).sort()).toEqual(["endFrame", "gapIndex", "impact", "intervalFrames", "startFrame"]);
        return { captureEnd: current.endFrame };
      },
      (capture, availability) => {
        order.push("duration");
        expect(capture).toEqual({ captureEnd: 20 });
        expect(Object.keys(availability)).toEqual(["outgoingEndFrame"]);
        expect(Object.isFrozen(availability)).toBe(true);
        expect(availability).toEqual({ outgoingEndFrame: 32 });
        expect("axes" in availability).toBe(false);
        expect("gapIndex" in availability).toBe(false);
        return { phase: 0, endpoint: availability.outgoingEndFrame };
      },
    );
    order.push("observation");

    expect(order).toEqual(["capture", "duration", "observation"]);
    expect(result.captureResult).toEqual({ captureEnd: 20 });
    expect(result.durationResult).toEqual({ phase: 0, endpoint: 32 });
    expect(result.observation.outgoing.axes).toEqual({ air: 0.3, speed: 0.6 });
  });

  test("fails before observation when either staged callback is asynchronous", () => {
    const fixture = makeFixture();
    let durationCalls = 0;
    expect(() => withValidatedPostimpactCaptureThenDurationInputs(
      fixture,
      () => Promise.resolve("later"),
      () => {
        durationCalls++;
        return null;
      },
    )).toThrow(/capture selection callback must complete synchronously/);
    expect(durationCalls).toBe(0);

    expect(() => withValidatedPostimpactCaptureThenDurationInputs(
      fixture,
      () => "capture",
      () => Promise.resolve("later"),
    )).toThrow(/duration construction callback must complete synchronously/);
  });
});

function makeFixture(): PostimpactFrozenTrajectoryFixtureV3 {
  const materialized = {
    contactFrames: [10, 20, 32],
    durationFrames: 40,
    gaps: [
      { index: 0, startFrame: 0, endFrame: 10, endsWithContact: true, targets: { impact: 0.5 }, nextImpact: 0.7 },
      { index: 1, startFrame: 10, endFrame: 20, endsWithContact: true, targets: { air: 0.2, speed: 0.8, impact: 0.7 }, nextImpact: 0.9 },
      { index: 2, startFrame: 20, endFrame: 32, endsWithContact: true, targets: { air: 0.3, speed: 0.6, impact: 0.9 }, nextImpact: null },
    ],
    gapAxisTargets: [{ impact: 0.5 }, { air: 0.2, speed: 0.8, impact: 0.7 }, { air: 0.3, speed: 0.6, impact: 0.9 }],
  };
  const physicalPrefix = {
    schema: "line.trajectory-physical-prefix.v1" as const,
    gapIndex: 1,
    prefixNextLineId: 3,
    cumulativeCost: 0,
    searchSeed: 1,
    startState: { position: { x: 0, y: 0 }, velocity: { x: 1, y: 0 } },
    startLines: [],
    prefixFitLines: [],
  };
  const captureIdentityPayload = {
    schema: "line.frozen-trajectory-prefix-capture.v1" as const,
    panelId: "fixture",
    panelSourceFingerprint: "source",
    captureBudget: 1,
    engine: "wasm",
    relevantEnvironment: { LR_ENGINE: "wasm" },
    studySourceFingerprint: "study",
    captureCandidateFingerprint: "candidate",
    protocolFingerprint: "protocol",
  };
  const targetPlanningState = { frame: 20 } as PostimpactFrozenTrajectoryFixtureV3["checkpoints"]["targetPlanningState"];
  const targetProbeState = {};
  const preTargetSledTrace: number[] = [];
  const payload: Omit<PostimpactFrozenTrajectoryFixtureV3, "fixtureFingerprint"> = {
    schema: "line.frozen-trajectory-prefix.v3",
    purpose: "input boundary test",
    capture: {
      argv: [],
      runtime: { node: "test", engine: "wasm", relevantEnvironment: { LR_ENGINE: "wasm" } },
      elapsedMs: 0,
      captureBudget: 1,
      studySourceFingerprint: "study",
      studySourceFiles: ["capture.ts"],
      captureIdentity: {
        ...captureIdentityPayload,
        fingerprint: sha256(stableJson(captureIdentityPayload)),
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
      id: "fixture",
      cohort: "calibration",
      category: "ordinary",
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
    transform: { value: {}, fingerprint: sha256(stableJson({})) },
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
    captureCompiler: { candidateFingerprint: "candidate" },
    baseline: { contractPassed: true, score: 1, deepestGap: 1, targetPrefixSimFrames: 20 },
  };
  return { ...payload, fixtureFingerprint: sha256(stableJson(payload)) };
}

function refreshFixtureFingerprint(fixture: PostimpactFrozenTrajectoryFixtureV3): void {
  const { fixtureFingerprint: _previous, ...payload } = fixture;
  fixture.fixtureFingerprint = sha256(stableJson(payload));
}

function refreshMaterializedAndFixtureFingerprints(fixture: PostimpactFrozenTrajectoryFixtureV3): void {
  fixture.materializedFingerprint = sha256(stableJson(fixture.materialized));
  refreshFixtureFingerprint(fixture);
}
