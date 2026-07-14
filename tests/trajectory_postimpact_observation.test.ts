import { describe, expect, test } from "vitest";
import { detect, type RawTrajectory } from "../scripts/lib/detector.ts";
import {
  measureCoMWindow,
  namedReferenceState,
  offBeatLandingsInWindow,
  sameExactEngineTrace,
  sameOwnedCaptureEvent,
  sameScoredContactImpact,
  unresolvedOffBeatLandingFramesAtWindowEnd,
} from "../scripts/v0/trajectory/exact_support_slice_assay.ts";
import {
  measurePostimpactCoMWindow,
  postimpactNamedReferenceState,
  postimpactOffBeatLandingsInWindow,
  postimpactStableJson,
  samePostimpactExactEngineTrace,
  samePostimpactOwnedCaptureEvent,
  samePostimpactScoredContactImpact,
  unresolvedPostimpactOffBeatLandingFramesAtWindowEnd,
} from "../scripts/v0/trajectory/postimpact_observation.ts";
import { studySourceIdentity } from "../scripts/v0/trajectory/study_artifact.ts";

describe("post-impact observation leaves", () => {
  test("matches the established CoM and off-beat observations on a detector fixture", () => {
    const detection = detect(rawTrajectory());
    expect(measurePostimpactCoMWindow(detection, 0, 7)).toEqual(measureCoMWindow(detection, 0, 7));
    expect(postimpactOffBeatLandingsInWindow(detection, [], 0, 7))
      .toEqual(offBeatLandingsInWindow(detection, [], 0, 7));
    expect(unresolvedPostimpactOffBeatLandingFramesAtWindowEnd(detection, [], 0, 7))
      .toEqual(unresolvedOffBeatLandingFramesAtWindowEnd(detection, [], 0, 7));
  });

  test("keeps exact capture equality and named-reference reads target-blind", () => {
    const trace = {
      fingerprint: "a",
      frameCount: 2,
      unavailableAtFrame: null,
      semantics: "full_non_scarf_engine_state_v1" as const,
    };
    expect(samePostimpactExactEngineTrace(trace, { ...trace })).toBe(sameExactEngineTrace(trace, { ...trace }));
    expect(samePostimpactExactEngineTrace(trace, { ...trace, fingerprint: "b" })).toBe(false);

    const event = {
      type: "landing",
      frame: 12,
      timingErrorFrames: 0,
      contactLineIds: [4],
      ownedLineIds: [4],
      lineRoles: ["capture"],
      gateEligible: true,
      roleEligible: true,
    } as const;
    expect(samePostimpactOwnedCaptureEvent(event, { ...event }))
      .toBe(sameOwnedCaptureEvent(event, { ...event }));
    expect(samePostimpactScoredContactImpact({ b: 2, a: 1 }, { a: 1, b: 2 }))
      .toBe(sameScoredContactImpact({ b: 2, a: 1 } as any, { a: 1, b: 2 } as any));
    expect(postimpactStableJson({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');

    const state = {
      position: { x: 1, y: 2 },
      velocity: { x: 3, y: 4 },
      points: {
        TAIL: {
          position: { x: 5, y: 6 },
          velocity: { x: 0, y: 2 },
        },
      },
    };
    expect(postimpactNamedReferenceState(state as any, "TAIL"))
      .toEqual(namedReferenceState(state as any, "TAIL"));
    expect(postimpactNamedReferenceState(state as any, "rider"))
      .toEqual(namedReferenceState(state as any, "rider"));
  });

  test("has no compiler, fixture-panel, benchmark, or optimizer source closure", () => {
    const sourceFiles = studySourceIdentity("scripts/v0/trajectory/postimpact_observation.ts").sourceFiles;
    const forbidden = [
      "scripts/v0/arc_placement.ts",
      "scripts/v0/core/candidate.ts",
      "scripts/v0/optimizer/handoff.ts",
      "scripts/v0/optimizer/sample.ts",
      "scripts/v0/trajectory/panel.ts",
      "scripts/v0/trajectory/study_context.ts",
      "scripts/v0/trajectory/transition_contract.ts",
      "benchmark/v2/policy.ts",
      "scripts/v0/trajectory/frozen_fixture.ts",
    ];
    expect(forbidden.filter((path) => sourceFiles.includes(path))).toEqual([]);
  });
});

function rawTrajectory(): RawTrajectory {
  return {
    duration: 7,
    frames: Array.from({ length: 8 }, (_, frame) => ({
      frame,
      position: { x: frame, y: frame * 2 },
      velocity: { x: 2, y: 1 },
      sledContacts: frame < 3 || frame > 5 ? ["TAIL"] : [],
      contactLineIds: frame < 3 || frame > 5 ? [7] : [],
      riderEjected: false,
      sledBroken: false,
    })),
  };
}
