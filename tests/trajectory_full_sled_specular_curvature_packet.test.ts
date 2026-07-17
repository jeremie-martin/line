import { describe, expect, test } from "vitest";
import { realizeFullSledSpecularCurvaturePacket } from "../scripts/v0/trajectory/full_sled_specular_curvature_packet.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";
import type { TrackLine } from "../scripts/v0/types.ts";

function state(): PlanningState {
  const positions = {
    PEG: { x: -2, y: -1 },
    TAIL: { x: -2, y: 1 },
    NOSE: { x: 2, y: -1 },
    STRING: { x: 2, y: 1 },
  } as const;
  return {
    frame: 40,
    position: { x: 0, y: 0 }, velocity: { x: 4, y: 0 }, speed: 4, velocityAngleDeg: 0,
    reference: positions.TAIL, referencePointName: "TAIL", referenceVelocity: { x: 4, y: 0 },
    sledPoseDeg: 0, sledPoseRateDegPerFrame: 0,
    points: Object.fromEntries(Object.entries(positions).map(([name, position]) => [name, {
      position, velocity: { x: 4, y: 0 }, relativePosition: position, relativeVelocity: { x: 0, y: 0 },
    }])) as PlanningState["points"],
    phase: { contactNow: false, groundedAgeFrames: 0, airborneAgeFrames: 8 },
  };
}

function line(id: number, x1: number, y1: number, x2: number, y2: number): TrackLine {
  return { id, type: 0, x1, y1, x2, y2, flipped: false, leftExtended: false, rightExtended: false };
}

describe("full-sled specular curvature packet", () => {
  test("centers a continuous full-sled constant-energy correction at the raw contact", () => {
    const raw = [line(1, -8, 0, 0, 0), line(2, 0, 0, 8, -4), line(3, 8, -4, 16, -12)];
    const result = realizeFullSledSpecularCurvaturePacket(raw, state(), { x: 0, y: 0 });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.contactIndex).toBe(1);
    expect(result.field.rawTurnDeg).toBeLessThan(0);
    expect(Math.abs(result.field.contactTangentShiftDeg)).toBeGreaterThan(0);
    expect(result.field.kineticRadiusPx).toBeGreaterThan(0);
    expect(result.field.maxVertexDisplacementPx).toBeGreaterThan(0);
    expect(result.lines[0]!.x2).toBe(0);
    expect(result.lines[0]!.y2).toBe(0);
    expect(result.lines[1]!.x1).toBe(0);
    expect(result.lines[1]!.y1).toBe(0);
    expect(result.lines.map((line) => line.id)).toEqual([1, 2, 3]);
  });

  test("fails closed without a full four-point velocity field", () => {
    const incomplete = state();
    delete incomplete.points.STRING;
    expect(realizeFullSledSpecularCurvaturePacket(
      [line(1, -4, 0, 0, 0), line(2, 0, 0, 4, -2)], incomplete, { x: 0, y: 0 },
    )).toEqual({ status: "unavailable", reason: "missing_full_sled_velocity" });
  });
});
