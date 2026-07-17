import { describe, expect, test } from "vitest";
import { realizeFullSledWindowedRedirectionField } from "../scripts/v0/trajectory/full_sled_windowed_redirection_field.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";
import type { TrackLine } from "../scripts/v0/types.ts";

function state(speed = 4): PlanningState {
  const positions = {
    PEG: { x: -2, y: -1 }, TAIL: { x: -2, y: 1 }, NOSE: { x: 2, y: -1 }, STRING: { x: 2, y: 1 },
  } as const;
  return {
    frame: 10, position: { x: 0, y: 0 }, velocity: { x: speed, y: 0 }, speed, velocityAngleDeg: 0,
    reference: positions.TAIL, referencePointName: "TAIL", referenceVelocity: { x: speed, y: 0 },
    sledPoseDeg: 0, sledPoseRateDegPerFrame: 0,
    points: Object.fromEntries(Object.entries(positions).map(([name, position]) => [name, {
      position, velocity: { x: speed, y: 0 }, relativePosition: position, relativeVelocity: { x: 0, y: 0 },
    }])) as PlanningState["points"],
    phase: { contactNow: false, groundedAgeFrames: 0, airborneAgeFrames: 4 },
  };
}

function line(id: number, x1: number, y1: number, x2: number, y2: number): TrackLine {
  return { id, type: 0, x1, y1, x2, y2, flipped: false, leftExtended: false, rightExtended: false };
}

describe("full-sled six-frame redirection-density field", () => {
  test("preserves contact and terminal tangents while concentrating an existing turn into the impact distance", () => {
    const raw = [
      line(1, -4, 0, 0, 0), line(2, 0, 0, 10, 0),
      line(3, 10, 0, 20, 10), line(4, 20, 10, 20, 20), line(5, 20, 20, 20, 30),
    ];
    const result = realizeFullSledWindowedRedirectionField(raw, state(4), { x: 0, y: 0 });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.lines[0]).toEqual(raw[0]);
    expect(result.lines[1]).toEqual(raw[1]);
    const terminal = result.lines.at(-1)!;
    expect(Math.atan2(terminal.y2 - terminal.y1, terminal.x2 - terminal.x1) * 180 / Math.PI).toBeCloseTo(90, 12);
    expect(result.field.meanAbsTangentShiftDeg).toBeGreaterThan(0);
    expect(result.field.responseDistancePx).toBe(24);
  });

  test("fails closed instead of choosing a partial sled state", () => {
    const incomplete = state();
    delete incomplete.points.STRING;
    expect(realizeFullSledWindowedRedirectionField([line(1, 0, 0, 4, 0), line(2, 4, 0, 4, 4)], incomplete, { x: 0, y: 0 }))
      .toEqual({ status: "unavailable", reason: "missing_full_sled_velocity" });
  });
});
