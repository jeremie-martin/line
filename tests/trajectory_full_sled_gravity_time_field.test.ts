import { describe, expect, test } from "vitest";
import { realizeFullSledGravityTimeField } from "../scripts/v0/trajectory/full_sled_gravity_time_field.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";
import type { TrackLine } from "../scripts/v0/types.ts";

function state(): PlanningState {
  const positions = {
    PEG: { x: -2, y: -1 }, TAIL: { x: -2, y: 1 }, NOSE: { x: 2, y: -1 }, STRING: { x: 2, y: 1 },
  } as const;
  return {
    frame: 10, position: { x: 0, y: 0 }, velocity: { x: 4, y: 0 }, speed: 4, velocityAngleDeg: 0,
    reference: positions.TAIL, referencePointName: "TAIL", referenceVelocity: { x: 4, y: 0 },
    sledPoseDeg: 0, sledPoseRateDegPerFrame: 0,
    points: Object.fromEntries(Object.entries(positions).map(([name, position]) => [name, {
      position, velocity: { x: 4, y: 0 }, relativePosition: position, relativeVelocity: { x: 0, y: 0 },
    }])) as PlanningState["points"],
    phase: { contactNow: false, groundedAgeFrames: 0, airborneAgeFrames: 4 },
  };
}

function line(id: number, x1: number, y1: number, x2: number, y2: number): TrackLine {
  return { id, type: 0, x1, y1, x2, y2, flipped: false, leftExtended: false, rightExtended: false };
}

describe("full-sled gravity-time tangent field", () => {
  test("keeps the prefix, first tangent, and segment lengths while moving later time phases", () => {
    const raw = [
      line(1, -4, 0, 0, 0), line(2, 0, 0, 4, 0),
      line(3, 4, 0, 8, 4), line(4, 8, 4, 12, 12),
    ];
    const result = realizeFullSledGravityTimeField(raw, state(), { x: 0, y: 0 });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.lines[0]).toEqual(raw[0]);
    expect(result.lines[1]).toEqual(raw[1]);
    const lengths = result.lines.map((entry) => Math.hypot(entry.x2 - entry.x1, entry.y2 - entry.y1));
    raw.forEach((entry, index) => expect(lengths[index]).toBeCloseTo(Math.hypot(entry.x2 - entry.x1, entry.y2 - entry.y1), 12));
    expect(result.travel.maxAbsTangentShiftDeg).toBeGreaterThan(0);
  });

  test("fails closed when one sled velocity is unavailable", () => {
    const incomplete = state();
    delete incomplete.points.PEG;
    expect(realizeFullSledGravityTimeField([line(1, 0, 0, 4, 0), line(2, 4, 0, 8, 0)], incomplete, { x: 0, y: 0 }))
      .toEqual({ status: "unavailable", reason: "missing_full_sled_velocity" });
  });
});
