import { describe, expect, test } from "vitest";
import {
  realizeCoRotatingContactField,
  rigidSledTwist,
} from "../scripts/v0/trajectory/co_rotating_contact_field.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";
import type { TrackLine } from "../scripts/v0/types.ts";

function state(angularVelocity = .1): PlanningState {
  const locations = {
    PEG: { x: -2, y: -1 },
    TAIL: { x: -2, y: 1 },
    NOSE: { x: 2, y: -1 },
    STRING: { x: 2, y: 1 },
  } as const;
  const velocityFor = ({ x, y }: { x: number; y: number }) => ({ x: 4 - angularVelocity * y, y: angularVelocity * x });
  return {
    frame: 40,
    position: { x: 0, y: 0 }, velocity: { x: 4, y: 0 }, speed: 4, velocityAngleDeg: 0,
    reference: locations.TAIL, referencePointName: "TAIL", referenceVelocity: velocityFor(locations.TAIL),
    sledPoseDeg: 0, sledPoseRateDegPerFrame: angularVelocity * 180 / Math.PI,
    points: Object.fromEntries(Object.entries(locations).map(([name, position]) => [name, {
      position, velocity: velocityFor(position), relativePosition: position,
      relativeVelocity: { x: velocityFor(position).x - 4, y: velocityFor(position).y },
    }])) as PlanningState["points"],
    phase: { contactNow: false, groundedAgeFrames: 0, airborneAgeFrames: 8 },
  };
}

function line(id: number, x1: number, y1: number, x2: number, y2: number): TrackLine {
  return { id, type: 0, x1, y1, x2, y2, flipped: false, leftExtended: false, rightExtended: false };
}

describe("co-rotating multi-contact post curve", () => {
  test("projects all four sled velocities onto a unique rigid twist", () => {
    const twist = rigidSledTwist(state(.1));
    expect("status" in twist).toBe(false);
    if ("status" in twist) return;
    expect(twist.collectiveVelocity).toEqual({ x: 4, y: 0 });
    expect(twist.angularVelocityRadPerFrame).toBeCloseTo(.1, 12);
  });

  test("preserves the inbound prefix and contact tangent while transporting later tangents", () => {
    const raw = [line(1, -4, 0, 0, 0), line(2, 0, 0, 4, 0), line(3, 4, 0, 8, 0)];
    const result = realizeCoRotatingContactField(raw, state(.1), { x: 0, y: 0 });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.lines[0]).toEqual(raw[0]);
    expect(result.lines[1]).toEqual(raw[1]);
    expect(result.lines.map((candidate) => candidate.id)).toEqual([1, 2, 3]);
    expect(result.lines[2]!.y2).toBeGreaterThan(0);
    expect(result.travel.terminalRotationDeg).toBeGreaterThan(0);
  });

  test("fails closed rather than substituting a named point when the full field is incomplete", () => {
    const incomplete = state();
    delete incomplete.points.STRING;
    expect(realizeCoRotatingContactField([line(1, 0, 0, 4, 0), line(2, 4, 0, 8, 0)], incomplete, { x: 0, y: 0 }))
      .toEqual({ status: "unavailable", reason: "missing_full_sled_velocity" });
  });
});
