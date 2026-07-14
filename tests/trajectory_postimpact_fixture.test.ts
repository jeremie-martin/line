import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { makeBaseEngine } from "../scripts/v0/core/substrate.ts";
import {
  sha256,
  stableJson,
  type PostimpactFrozenTrajectoryFixtureV3,
} from "../scripts/v0/trajectory/postimpact_study_inputs.ts";
import {
  POSTIMPACT_MAX_LINE_ID,
  postimpactLineIdRange,
  preparePostimpactFixture,
  readPostimpactFixture,
  withPostimpactStudyInputBoundary,
  withPostimpactStudyInputBoundaryFromPath,
} from "../scripts/v0/trajectory/postimpact_fixture.ts";
import { extractPlanningState } from "../scripts/v0/trajectory/state.ts";
import { studySourceIdentity } from "../scripts/v0/trajectory/study_artifact.ts";

const WASM_ENV = { LR_ENGINE: "wasm" } as NodeJS.ProcessEnv;

describe("post-impact frozen-prefix boundary", () => {
  test("replays a stable V3 prefix and exposes only target-blind construction state", () => {
    const fixture = makeFixture();
    const prepared = preparePostimpactFixture(fixture, { environment: WASM_ENV });

    expect(Object.keys(prepared).sort()).toEqual(["engine", "nextLineId", "targetPlanningState"]);
    expect(prepared.nextLineId).toBe(1);
    expect(stableJson(extractPlanningState(prepared.engine, 8))).toBe(
      stableJson(fixture.checkpoints.targetPlanningState),
    );
    expect("panel" in prepared).toBe(false);
    expect("fixtureFingerprint" in prepared).toBe(false);
    expect("runtime" in prepared).toBe(false);
    expect("physicalPrefix" in prepared).toBe(false);
  });

  test("reads the same V3 contract from disk without exposing raw fixture data", () => {
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

  test("seals outgoing observation and audit until construction returns", () => {
    const fixture = makeFixture();
    let callbackObservedKeys: string[] = [];
    let callbackPreparedKeys: string[] = [];
    const result = withPostimpactStudyInputBoundary(fixture, (context) => {
      callbackObservedKeys = Object.keys(context).sort();
      callbackPreparedKeys = Object.keys(context.prepared).sort();
      expect(Object.isFrozen(context)).toBe(true);
      expect(Object.isFrozen(context.current)).toBe(true);
      expect(Object.isFrozen(context.prepared)).toBe(true);
      expect(Object.isFrozen(context.prepared.targetPlanningState)).toBe(true);
      expect("observation" in context).toBe(false);
      expect("audit" in context).toBe(false);
      expect("panel" in context.prepared).toBe(false);
      expect("fixtureFingerprint" in context.prepared).toBe(false);
      return { selectedPhase: "phase-0", impact: context.current.impact };
    }, { environment: WASM_ENV });

    expect(callbackObservedKeys).toEqual(["current", "prepared"]);
    expect(callbackPreparedKeys).toEqual(["engine", "nextLineId", "targetPlanningState"]);
    expect(result.constructionResult).toEqual({ selectedPhase: "phase-0", impact: 0.4 });
    expect(result.observation).toEqual({
      outgoing: {
        gapIndex: 1,
        startFrame: 8,
        endFrame: 16,
        intervalFrames: 8,
        axes: { air: 0.5, speed: 0.6 },
      },
      authoredContactFrames: [8, 16, 24],
    });
    expect(result.audit.panel).toEqual({
      id: "fixture-dense",
      cohort: "calibration",
      category: "dense",
      sourcePath: "fixture-source.ts",
      sourceFingerprint: "panel-source",
      publicSeed: 7,
      selectionRationale: "fixed test contact",
      currentGap: 0,
      currentFrame: 8,
    });
  });

  test("rejects an asynchronous construction callback before observation is created", () => {
    expect(() => withPostimpactStudyInputBoundary(
      makeFixture(),
      () => Promise.resolve("later"),
      { environment: WASM_ENV },
    )).toThrow(/must complete synchronously/);
  });

  test("uses an immutable internal snapshot when the raw caller object changes in the callback", () => {
    const fixture = makeFixture();
    const result = withPostimpactStudyInputBoundary(fixture, () => {
      fixture.materialized.gaps[1]!.targets.air = 0.2;
      fixture.panel.category = "low_air";
      return "constructed";
    }, { environment: WASM_ENV });

    expect(result.constructionResult).toBe("constructed");
    expect(result.observation.outgoing.axes).toEqual({ air: 0.5, speed: 0.6 });
    expect(result.audit.panel.category).toBe("dense");
  });

  test("validates root, nested materialized, and capture provenance before construction", () => {
    const rootTampered = structuredClone(makeFixture());
    rootTampered.materialized.gaps[0]!.targets.impact = 0.9;
    expect(() => withPostimpactStudyInputBoundary(rootTampered, () => null, { environment: WASM_ENV }))
      .toThrow(/fixture fingerprint does not match/);

    const staleMaterialized = structuredClone(makeFixture());
    staleMaterialized.materialized.gaps[0]!.targets.impact = 0.9;
    refreshFixtureFingerprint(staleMaterialized);
    expect(() => withPostimpactStudyInputBoundary(staleMaterialized, () => null, { environment: WASM_ENV }))
      .toThrow(/materialized fingerprint does not match/);

    const forgedIdentity = structuredClone(makeFixture());
    forgedIdentity.capture.captureIdentity.fingerprint = "0".repeat(64);
    refreshFixtureFingerprint(forgedIdentity);
    expect(() => withPostimpactStudyInputBoundary(forgedIdentity, () => null, { environment: WASM_ENV }))
      .toThrow(/invalid V3 capture artifact identity/);
  });

  test("keeps construction input unchanged when valid outgoing data changes", () => {
    const original = makeFixture();
    const changed = structuredClone(original);
    changed.materialized.gaps[1]!.targets = { air: 0.2, speed: 0.9, amplitude: 0.4, impact: 0.8 };
    changed.materialized.gaps[1]!.nextImpact = 0.1;
    refreshMaterializedAndFixtureFingerprints(changed);

    const seen: Array<unknown> = [];
    const left = withPostimpactStudyInputBoundary(original, (context) => {
      seen.push({ current: context.current, state: context.prepared.targetPlanningState, nextLineId: context.prepared.nextLineId });
      return null;
    }, { environment: WASM_ENV });
    const right = withPostimpactStudyInputBoundary(changed, (context) => {
      seen.push({ current: context.current, state: context.prepared.targetPlanningState, nextLineId: context.prepared.nextLineId });
      return null;
    }, { environment: WASM_ENV });

    expect(seen[0]).toEqual(seen[1]);
    expect(left.observation.outgoing.axes).toEqual({ air: 0.5, speed: 0.6 });
    expect(right.observation.outgoing.axes).toEqual({ air: 0.2, speed: 0.9, amplitude: 0.4 });
  });

  test("rejects a historical schema, recorded drift, replay mismatch, malformed prefix, and runtime mismatch", () => {
    const historical = { ...makeFixture(), schema: "line.frozen-trajectory-prefix.v2" };
    expect(() => preparePostimpactFixture(historical, { environment: WASM_ENV })).toThrow(/requires a frozen V3/);

    const drifted = structuredClone(makeFixture());
    drifted.capture.identityCheck = {
      ...drifted.capture.identityCheck,
      stable: false,
      studySourceFingerprintAtEnd: "different-source",
      captureCandidateFingerprintAtEnd: "different-candidate",
    };
    drifted.capture.captureCompilerAtEnd = { candidateFingerprint: "different-candidate" };
    refreshFixtureFingerprint(drifted);
    expect(() => preparePostimpactFixture(drifted, { environment: WASM_ENV })).toThrow(/requires a stable V3/);

    const replayMismatch = structuredClone(makeFixture());
    replayMismatch.checkpoints.targetPlanningState.position.x += 1;
    replayMismatch.checkpoints.targetPlanningStateFingerprint = sha256(stableJson(replayMismatch.checkpoints.targetPlanningState));
    refreshFixtureFingerprint(replayMismatch);
    expect(() => preparePostimpactFixture(replayMismatch, { environment: WASM_ENV })).toThrow(
      /does not replay the declared target planning state/,
    );

    const malformedPrefix = structuredClone(makeFixture());
    malformedPrefix.physicalPrefix.gapIndex = 1;
    refreshPhysicalPrefixAndFixtureFingerprints(malformedPrefix);
    expect(() => preparePostimpactFixture(malformedPrefix, { environment: WASM_ENV })).toThrow(
      /target\/prefix declaration is internally inconsistent/,
    );
    expect(() => preparePostimpactFixture(makeFixture(), { environment: { LR_ENGINE: "js" } })).toThrow(
      /requires LR_ENGINE=wasm/,
    );
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
    refreshPhysicalPrefixAndFixtureFingerprints(collision);
    expect(() => preparePostimpactFixture(collision, { environment: WASM_ENV })).toThrow(
      /nextLineId must be greater/,
    );

    const overflow = structuredClone(makeFixture());
    overflow.physicalPrefix.prefixNextLineId = POSTIMPACT_MAX_LINE_ID + 1;
    refreshPhysicalPrefixAndFixtureFingerprints(overflow);
    expect(() => preparePostimpactFixture(overflow, { environment: WASM_ENV })).toThrow(
      /nextLineId must be a non-negative signed 32-bit integer/,
    );
    expect(postimpactLineIdRange(POSTIMPACT_MAX_LINE_ID, 1)).toEqual({
      start: POSTIMPACT_MAX_LINE_ID,
      end: POSTIMPACT_MAX_LINE_ID,
    });
    expect(() => postimpactLineIdRange(POSTIMPACT_MAX_LINE_ID, 2)).toThrow(/allocation overflows/);
  });

  test("path-owning boundary preserves the sealed API", () => {
    const root = mkdtempSync(join(tmpdir(), "line-postimpact-boundary-"));
    try {
      const path = join(root, "fixture.json");
      writeFileSync(path, `${JSON.stringify(makeFixture())}\n`);
      const result = withPostimpactStudyInputBoundaryFromPath(
        path,
        (context) => context.current.impact,
        { environment: WASM_ENV },
      );
      expect(result.constructionResult).toBe(0.4);
      expect(result.observation.outgoing.endFrame).toBe(16);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("static source closure excludes frozen fixtures, panels, study context, and optimizer policy", () => {
    const source = readFileSync(new URL("../scripts/v0/trajectory/postimpact_fixture.ts", import.meta.url), "utf8");
    const imports = source.match(/^import[\s\S]*?;$/gm)?.join("\n") ?? "";
    expect(imports).not.toMatch(/frozen_fixture|trajectory\/panel|study_context|optimizer\//);
    const closure = studySourceIdentity("scripts/v0/trajectory/postimpact_fixture.ts").sourceFiles;
    expect(closure).not.toContain("scripts/v0/trajectory/frozen_fixture.ts");
    expect(closure).not.toContain("scripts/v0/trajectory/panel.ts");
    expect(closure).not.toContain("scripts/v0/trajectory/study_context.ts");
    expect(closure.some((path) => path.includes("/optimizer/"))).toBe(false);
  });
});

function makeFixture(): PostimpactFrozenTrajectoryFixtureV3 {
  const startState = { position: { x: 0, y: 0 }, velocity: { x: 5, y: 0 } };
  const targetPlanningState = extractPlanningState(makeBaseEngine(startState), 8);
  if (targetPlanningState === null) throw new Error("test fixture cannot read target planning state");
  const materialized = {
    contactFrames: [8, 16, 24],
    durationFrames: 30,
    gaps: [
      { index: 0, startFrame: 0, endFrame: 8, endsWithContact: true, targets: { impact: 0.4 }, nextImpact: 0.6 },
      { index: 1, startFrame: 8, endFrame: 16, endsWithContact: true, targets: { air: 0.5, speed: 0.6, impact: 0.6 }, nextImpact: 0.7 },
      { index: 2, startFrame: 16, endFrame: 24, endsWithContact: true, targets: { air: 0.3, speed: 0.4, impact: 0.7 }, nextImpact: null },
    ],
    gapAxisTargets: [{ impact: 0.4 }, { air: 0.5, speed: 0.6, impact: 0.6 }, { air: 0.3, speed: 0.4, impact: 0.7 }],
  };
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
  const captureIdentityPayload = {
    schema: "line.frozen-trajectory-prefix-capture.v1" as const,
    panelId: "fixture-dense",
    panelSourceFingerprint: "panel-source",
    captureBudget: 500_000,
    engine: "wasm",
    relevantEnvironment: { LR_ENGINE: "wasm" },
    studySourceFingerprint: "study-source",
    captureCandidateFingerprint: "candidate-source",
    protocolFingerprint: "protocol-source",
  };
  const payload: Omit<PostimpactFrozenTrajectoryFixtureV3, "fixtureFingerprint"> = {
    schema: "line.frozen-trajectory-prefix.v3",
    purpose: "post-impact-fixture-test",
    capture: {
      argv: [],
      runtime: { node: "test", engine: "wasm", relevantEnvironment: { LR_ENGINE: "wasm" } },
      elapsedMs: 0,
      captureBudget: 500_000,
      studySourceFingerprint: "study-source",
      studySourceFiles: ["scripts/v0/capture_trajectory_fixture.ts"],
      captureIdentity: {
        ...captureIdentityPayload,
        fingerprint: sha256(stableJson(captureIdentityPayload)),
      },
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
      id: "fixture-dense",
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
    transform: { value: {}, fingerprint: sha256(stableJson({})) },
    materialized,
    materializedFingerprint: sha256(stableJson(materialized)),
    physicalPrefix,
    physicalPrefixFingerprint: sha256(stableJson(physicalPrefix)),
    checkpoints: {
      targetPlanningState,
      targetProbeState: {},
      preTargetSledTrace: [],
      targetPlanningStateFingerprint: sha256(stableJson(targetPlanningState)),
      targetProbeStateFingerprint: sha256(stableJson({})),
      preTargetSledTraceFingerprint: sha256(stableJson([])),
    },
    captureCompiler: { candidateFingerprint: "candidate-source" },
    baseline: { contractPassed: true, score: 1, deepestGap: 0, targetPrefixSimFrames: 8 },
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

function refreshPhysicalPrefixAndFixtureFingerprints(fixture: PostimpactFrozenTrajectoryFixtureV3): void {
  fixture.physicalPrefixFingerprint = sha256(stableJson(fixture.physicalPrefix));
  refreshFixtureFingerprint(fixture);
}
