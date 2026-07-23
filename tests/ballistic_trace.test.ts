import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BALLISTIC_TRACE_POINT_IDS,
  captureBallisticTraceObservation,
  recordBallisticTraceCandidate,
  setBallisticTraceSink,
} from "../scripts/v0/core/ballistic_trace.ts";
import { COLLISION_UPDATE_TYPE } from "../scripts/lib/update_types.ts";

afterEach(() => setBallisticTraceSink(null));

describe("ballistic benchmark tracing", () => {
  it("is inert without a collector", () => {
    const capture = vi.fn(() => null);
    recordBallisticTraceCandidate({
      population: "aim_probe",
      gapIndex: 1,
      launchFrame: 10,
      targetFrame: 20,
      capture,
    });
    expect(capture).not.toHaveBeenCalled();
  });

  it("never includes the target frame in launch samples", () => {
    const observation = captureBallisticTraceObservation({
      population: "candidate_pool",
      gapIndex: 2,
      launchFrame: 10,
      targetFrame: 13,
      sampleAllowed: () => true,
      readRider: (frame) => riderAt(frame),
      readUpdates: (frame) => frame === 13
        ? [{ type: COLLISION_UPDATE_TYPE, updated: [{ id: "PEG" }] }]
        : [],
    });

    expect(observation?.samples.map((sample) => sample.frame)).toEqual([10, 11, 12]);
    expect(observation?.truth.precontact.frame).toBe(12);
    expect(observation?.truth.contact.frame).toBe(13);
    expect(observation?.collisionWitnesses).toEqual([{ frame: 13, points: ["PEG"] }]);
  });

  it("materializes only candidates selected by the installed sink", () => {
    const capture = vi.fn(() => null);
    setBallisticTraceSink((candidate) => candidate.capture());
    recordBallisticTraceCandidate({
      population: "aim_probe",
      gapIndex: 1,
      launchFrame: 10,
      targetFrame: 20,
      capture,
    });
    expect(capture).toHaveBeenCalledOnce();
  });
});

function riderAt(frame: number) {
  const points = Object.fromEntries(BALLISTIC_TRACE_POINT_IDS.map((id, index) => [
    id,
    {
      pos: { x: frame + index, y: frame - index },
      vel: { x: 1 + index / 10, y: 2 - index / 10 },
    },
  ]));
  return {
    position: { x: frame, y: -frame },
    velocity: { x: 1, y: 2 },
    get(id: string) {
      if (id === "RIDER_MOUNTED" || id === "SLED_INTACT") {
        return { isBinded: () => true };
      }
      return points[id];
    },
  };
}
