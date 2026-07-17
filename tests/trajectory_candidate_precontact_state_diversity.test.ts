import { describe, expect, test } from "vitest";
import { characterizeCandidatePrecontactStateDiversity } from "../scripts/v0/trajectory/candidate_precontact_state_diversity.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";

function state(shiftX = 0, velocityX = 4): PlanningState {
  const positions = {
    PEG: { x: -2 + shiftX, y: -1 }, TAIL: { x: -2 + shiftX, y: 1 },
    NOSE: { x: 2 + shiftX, y: -1 }, STRING: { x: 2 + shiftX, y: 1 },
  } as const;
  return {
    frame: 20, position: { x: 0, y: 0 }, velocity: { x: velocityX, y: 0 }, speed: velocityX, velocityAngleDeg: 0,
    reference: positions.TAIL, referencePointName: "TAIL", referenceVelocity: { x: velocityX, y: 0 },
    sledPoseDeg: 0, sledPoseRateDegPerFrame: 0,
    points: Object.fromEntries(Object.entries(positions).map(([name, position]) => [name, {
      position, velocity: { x: velocityX, y: 0 }, relativePosition: position, relativeVelocity: { x: 0, y: 0 },
    }])) as PlanningState["points"],
    phase: { contactNow: false, groundedAgeFrames: 0, airborneAgeFrames: 3 },
  };
}

describe("candidate pre-contact state diversity", () => {
  test("measures candidate-created approach-state motion without a target collision", () => {
    const result = characterizeCandidatePrecontactStateDiversity(state(), [state(1, 4.5), state(3, 5)]);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.candidateStates).toBe(2);
    expect(result.meanCentroidShiftPx).toBeCloseTo(2);
    expect(result.maxCentroidShiftPx).toBeCloseTo(3);
    expect(result.meanCollectiveVelocityShiftPxPerFrame).toBeCloseTo(.75);
    expect(result.meanPairDistanceChangePx).toBeCloseTo(0);
  });

  test("fails closed on an empty raw candidate stream", () => {
    expect(characterizeCandidatePrecontactStateDiversity(state(), [])).toEqual({ status: "unavailable", reason: "empty_candidate_states" });
  });
});
