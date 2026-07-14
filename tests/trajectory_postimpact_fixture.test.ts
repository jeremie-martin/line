import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { makeBaseEngine } from "../scripts/v0/core/substrate.ts";
import {
  fixtureFingerprintForPayload,
  frozenFixtureCaptureArtifactIdentity,
  sha256,
  stableJson,
  type FrozenTrajectoryFixture,
  type FrozenTrajectoryFixtureV3,
} from "../scripts/v0/trajectory/frozen_fixture.ts";
import {
  POSTIMPACT_MAX_LINE_ID,
  postimpactLineIdRange,
  preparePostimpactFixture,
  readPostimpactFixture,
} from "../scripts/v0/trajectory/postimpact_fixture.ts";
import { extractPlanningState } from "../scripts/v0/trajectory/state.ts";

const WASM_ENV = { LR_ENGINE: "wasm" } as NodeJS.ProcessEnv;

describe("post-impact frozen-prefix fixture", () => {
  test("replays a stable V3 prefix and exposes only state-only construction inputs", () => {
    const fixture = makeFixture();
    const prepared = preparePostimpactFixture(fixture, { environment: WASM_ENV });

    expect(prepared.fixtureFingerprint).toBe(fixture.fixtureFingerprint);
    expect(prepared.runtime).toEqual({
      engine: "wasm",
      relevantEnvironment: { LR_ENGINE: "wasm" },
      captureBudget: 500_000,
      studySourceFingerprint: "study-source",
    });
    expect(prepared.panel).toEqual({
      id: "dense",
      cohort: "calibration",
      category: "dense",
      sourcePath: "fixture-source.ts",
      sourceFingerprint: "panel-source",
      publicSeed: 7,
      selectionRationale: "fixed test contact",
      currentGap: 0,
      currentFrame: 8,
    });
    expect("outgoingFrame" in prepared.panel).toBe(false);
    expect("materialized" in prepared).toBe(false);
    expect(prepared.physicalPrefix).toEqual({
      fingerprint: fixture.physicalPrefixFingerprint,
      nextLineId: 1,
    });
    expect(stableJson(extractPlanningState(prepared.engine, 8))).toBe(
      stableJson(fixture.checkpoints.targetPlanningState),
    );
  });

  test("reads the same V3 contract from disk", () => {
    const root = mkdtempSync(join(tmpdir(), "line-postimpact-fixture-"));
    try {
      const fixture = makeFixture();
      const path = join(root, "fixture.json");
      writeFileSync(path, `${JSON.stringify(fixture)}\n`);
      expect(readPostimpactFixture(path, { environment: WASM_ENV }).targetPlanningState.frame).toBe(8);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects a historical V2 artifact and a V3 capture with recorded drift", () => {
    const v3 = makeFixture();
    const v2 = makeV2(v3);
    expect(() => preparePostimpactFixture(v2, { environment: WASM_ENV })).toThrow(/requires a frozen V3/);

    const drifted = structuredClone(v3);
    drifted.capture.identityCheck = {
      ...drifted.capture.identityCheck,
      stable: false,
      studySourceFingerprintAtEnd: "different-source",
      captureCandidateFingerprintAtEnd: "different-candidate",
    };
    drifted.capture.captureCompilerAtEnd = { candidateFingerprint: "different-candidate" };
    refreshFixtureFingerprint(drifted);
    expect(() => preparePostimpactFixture(drifted, { environment: WASM_ENV })).toThrow(/stable V3 capture identity/);
  });

  test("rejects a checkpoint that is internally hashed but cannot be replayed", () => {
    const fixture = structuredClone(makeFixture());
    fixture.checkpoints.targetPlanningState.position.x += 1;
    fixture.checkpoints.targetPlanningStateFingerprint = sha256(stableJson(fixture.checkpoints.targetPlanningState));
    refreshFixtureFingerprint(fixture);

    expect(() => preparePostimpactFixture(fixture, { environment: WASM_ENV })).toThrow(
      /does not replay the declared target planning state/,
    );
  });

  test("rejects malformed physical-prefix and runtime declarations before replay", () => {
    const malformedPrefix = structuredClone(makeFixture());
    malformedPrefix.physicalPrefix.gapIndex = 1;
    malformedPrefix.physicalPrefixFingerprint = sha256(stableJson(malformedPrefix.physicalPrefix));
    refreshFixtureFingerprint(malformedPrefix);
    expect(() => preparePostimpactFixture(malformedPrefix, { environment: WASM_ENV })).toThrow(
      /target\/prefix declaration is internally inconsistent/,
    );

    expect(() => preparePostimpactFixture(makeFixture(), { environment: { LR_ENGINE: "js" } })).toThrow(
      /requires LR_ENGINE=wasm/,
    );
  });

  test("keeps construction state blind to re-fingerprinted post-target materialized data", () => {
    const original = makeFixture();
    const changed = structuredClone(original);
    const materialized = changed.materialized as unknown as {
      gaps: Array<{ endFrame: number; targets: Record<string, unknown>; nextImpact: unknown }>;
    };
    materialized.gaps[1]!.endFrame = 999;
    materialized.gaps[1]!.targets = { air: 0.17, speed: 0.93, impact: 0.81 };
    materialized.gaps[1]!.nextImpact = { target: 0.94, source: "changed-after-target" };
    changed.materializedFingerprint = sha256(stableJson(changed.materialized));
    refreshFixtureFingerprint(changed);

    const left = preparePostimpactFixture(original, { environment: WASM_ENV });
    const right = preparePostimpactFixture(changed, { environment: WASM_ENV });
    expect(right.fixtureFingerprint).not.toBe(left.fixtureFingerprint);
    expect({
      runtime: right.runtime,
      panel: right.panel,
      physicalPrefix: right.physicalPrefix,
      targetPlanningState: right.targetPlanningState,
    }).toEqual({
      runtime: left.runtime,
      panel: left.panel,
      physicalPrefix: left.physicalPrefix,
      targetPlanningState: left.targetPlanningState,
    });
  });

  test("guards next-line collisions and signed-32-bit allocation overflow", () => {
    const collision = structuredClone(makeFixture());
    collision.physicalPrefix.startLines = [{
      id: 1,
      type: 0,
      x1: 100,
      y1: 100,
      x2: 120,
      y2: 100,
      flipped: false,
      leftExtended: false,
      rightExtended: false,
    }];
    collision.physicalPrefixFingerprint = sha256(stableJson(collision.physicalPrefix));
    refreshFixtureFingerprint(collision);
    expect(() => preparePostimpactFixture(collision, { environment: WASM_ENV })).toThrow(
      /nextLineId must be greater/,
    );

    const overflow = structuredClone(makeFixture());
    overflow.physicalPrefix.prefixNextLineId = POSTIMPACT_MAX_LINE_ID + 1;
    overflow.physicalPrefixFingerprint = sha256(stableJson(overflow.physicalPrefix));
    refreshFixtureFingerprint(overflow);
    expect(() => preparePostimpactFixture(overflow, { environment: WASM_ENV })).toThrow(
      /nextLineId must be a non-negative signed 32-bit integer/,
    );
    expect(postimpactLineIdRange(POSTIMPACT_MAX_LINE_ID, 1)).toEqual({
      start: POSTIMPACT_MAX_LINE_ID,
      end: POSTIMPACT_MAX_LINE_ID,
    });
    expect(() => postimpactLineIdRange(POSTIMPACT_MAX_LINE_ID, 2)).toThrow(/allocation overflows/);
  });

  test("does not directly import legacy optimizer, policy, or study-context modules", () => {
    const source = readFileSync(new URL("../scripts/v0/trajectory/postimpact_fixture.ts", import.meta.url), "utf8");
    const imports = source.match(/^import[\s\S]*?;$/gm) ?? [];
    expect(imports.join("\n")).not.toMatch(
      /optimizer\/|arc_placement|benchmark\/v2\/policy|study_context|handoff|sample/,
    );
  });
});

function makeFixture(): FrozenTrajectoryFixtureV3 {
  const startState = { position: { x: 0, y: 0 }, velocity: { x: 5, y: 0 } };
  const targetPlanningState = extractPlanningState(makeBaseEngine(startState), 8);
  if (targetPlanningState === null) throw new Error("test fixture cannot read target planning state");
  const physicalPrefix = {
    schema: "line.trajectory-physical-prefix.v1" as const,
    gapIndex: 0,
    prefixNextLineId: 1,
    cumulativeCost: 0,
    searchSeed: 7,
    startState,
    startLines: [],
    prefixFitLines: [],
  };
  const captureIdentity = frozenFixtureCaptureArtifactIdentity({
    schema: "line.frozen-trajectory-prefix-capture.v1",
    panelId: "dense",
    panelSourceFingerprint: "panel-source",
    captureBudget: 500_000,
    engine: "wasm",
    relevantEnvironment: { LR_ENGINE: "wasm" },
    studySourceFingerprint: "study-source",
    captureCandidateFingerprint: "candidate-source",
    protocolFingerprint: "protocol-source",
  });
  const payload: Omit<FrozenTrajectoryFixtureV3, "fixtureFingerprint"> = {
    schema: "line.frozen-trajectory-prefix.v3",
    purpose: "post-impact-fixture-test",
    capture: {
      argv: [],
      runtime: { node: "test", engine: "wasm", relevantEnvironment: { LR_ENGINE: "wasm" } },
      elapsedMs: 0,
      captureBudget: 500_000,
      studySourceFingerprint: "study-source",
      studySourceFiles: ["scripts/v0/capture_trajectory_fixture.ts"],
      captureIdentity,
      identityCheck: {
        stable: true,
        panelSourceFingerprintAtStart: "panel-source",
        panelSourceFingerprintAtEnd: "panel-source",
        studySourceFingerprintAtStart: "study-source",
        studySourceFingerprintAtEnd: "study-source",
        captureCandidateFingerprintAtStart: "candidate-source",
        captureCandidateFingerprintAtEnd: "candidate-source",
      },
      captureCompilerAtEnd: { candidateFingerprint: "candidate-source" },
    },
    panel: {
      id: "dense",
      cohort: "calibration",
      category: "dense",
      sourcePath: "fixture-source.ts",
      sourceFingerprint: "panel-source",
      publicSeed: 7,
      requestedTargetGap: 0,
      selectionRationale: "fixed test contact",
      selectedTargetGap: 0,
      outgoingGap: 1,
      currentFrame: 8,
      outgoingFrame: 16,
      outgoingIntervalFrames: 8,
      expectedOutgoingFrames: null,
    },
    transform: { value: {}, fingerprint: "transform" },
    materialized: {
      gaps: [
        { endFrame: 8, targets: { impact: 0.4 }, nextImpact: null },
        { endFrame: 16, targets: { air: 0.5, speed: 0.5 }, nextImpact: { target: 0.4 } },
      ],
    } as never,
    materializedFingerprint: "",
    physicalPrefix,
    physicalPrefixFingerprint: sha256(stableJson(physicalPrefix)),
    checkpoints: {
      targetPlanningState,
      targetProbeState: {},
      preTargetSledTrace: [],
      targetPlanningStateFingerprint: sha256(stableJson(targetPlanningState)),
      targetProbeStateFingerprint: "target-probe",
      preTargetSledTraceFingerprint: "pre-target-trace",
    },
    captureCompiler: { candidateFingerprint: "candidate-source" },
    baseline: { contractPassed: true, score: 1, deepestGap: 0, targetPrefixSimFrames: 8 },
  };
  payload.materializedFingerprint = sha256(stableJson(payload.materialized));
  return { ...payload, fixtureFingerprint: fixtureFingerprintForPayload(payload) };
}

function makeV2(v3: FrozenTrajectoryFixtureV3): FrozenTrajectoryFixture {
  const { studySourceFiles, captureIdentity, identityCheck, captureCompilerAtEnd, ...capture } = v3.capture;
  const payload = {
    ...v3,
    schema: "line.frozen-trajectory-prefix.v2" as const,
    capture,
  };
  delete (payload as { fixtureFingerprint?: string }).fixtureFingerprint;
  return {
    ...payload,
    fixtureFingerprint: fixtureFingerprintForPayload(payload),
  } as FrozenTrajectoryFixture;
}

function refreshFixtureFingerprint(fixture: FrozenTrajectoryFixtureV3): void {
  const { fixtureFingerprint: _previous, ...payload } = fixture;
  fixture.fixtureFingerprint = fixtureFingerprintForPayload(payload);
}
