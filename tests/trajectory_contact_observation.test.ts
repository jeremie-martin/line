import { describe, expect, test } from "vitest";
import {
  observeOwnedContactTransition,
  ownedSledCollisionTelemetry,
} from "../scripts/v0/trajectory/contact_observation.ts";
import type { Detection } from "../scripts/lib/detector.ts";

function detection(): Detection {
  return {
    events: [
      { type: "landing", frame: 11 },
      { type: "bounce", frame: 13 },
      { type: "landing", frame: 14 },
    ],
    terminus: { frame: 20, reason: "endOfSpec" },
    measurements: {
      position: Array.from({ length: 21 }, (_, frame) => ({ x: frame, y: frame + 1 })),
      velocity: Array.from({ length: 21 }, () => ({ x: 3, y: 4 })),
      speed: Array.from({ length: 21 }, () => 5),
      airborne: Array.from({ length: 21 }, (_, frame) => frame % 2 === 0),
      contactLineIds: Array.from({ length: 21 }, (_, frame) => frame === 11 || frame === 13 ? [7] : frame === 14 ? [8] : []),
    },
  } as unknown as Detection;
}

describe("ungated owned-contact observation", () => {
  test("reports owned timing independently from the exact candidate gate", () => {
    const observed = observeOwnedContactTransition(detection(), {
      targetFrame: 12,
      gapFrames: 20,
      observationEndFrame: 16,
      ownedLineIds: new Set([7]),
      lineRoles: new Map([[7, "contact_closure"]]),
      requiredLineRoles: ["contact_closure"],
    });
    expect(observed.ownedEvents).toEqual([
      {
        type: "landing",
        frame: 11,
        timingErrorFrames: -1,
        contactLineIds: [7],
        ownedLineIds: [7],
        lineRoles: ["contact_closure"],
        gateEligible: true,
        roleEligible: true,
      },
      {
        type: "bounce",
        frame: 13,
        timingErrorFrames: 1,
        contactLineIds: [7],
        ownedLineIds: [7],
        lineRoles: ["contact_closure"],
        gateEligible: false,
        roleEligible: true,
      },
    ]);
    expect(observed.closestOwnedEvent?.frame).toBe(11);
    expect(observed.selectedOwnedEvent?.frame).toBe(11);
    expect(observed.selectedEventState).toMatchObject({ frame: 11, speedPxPerFrame: 5, airborne: false });
    expect(observed.persistenceEndFrame).toBe(16);
    expect(observed.persistenceEndState).toMatchObject({ frame: 16, speedPxPerFrame: 5, airborne: true });
    expect(observed.persistenceWindowComplete).toBe(true);
    expect(observed.responseEndFrame).toBe(16);
    expect(observed.responseEndState).toMatchObject({ frame: 16, speedPxPerFrame: 5, airborne: true });
    expect(observed.responseWindowComplete).toBe(true);
    expect(observed.targetState).toMatchObject({ frame: 12, speedPxPerFrame: 5, airborne: true });
    expect(observed.handoffState).toMatchObject({ frame: 16, speedPxPerFrame: 5, airborne: true });
    expect(observed.nearbyEvents).toHaveLength(3);
  });

  test("keeps detector-limited bounce eligibility explicit", () => {
    const observed = observeOwnedContactTransition(detection(), {
      targetFrame: 12,
      gapFrames: 5,
      observationEndFrame: 16,
      ownedLineIds: new Set([7]),
    });
    expect(observed.ownedEvents[1]?.gateEligible).toBe(true);
  });

  test("accepts an explicit sealed timing tolerance instead of a hidden +/-1 rule", () => {
    const observed = observeOwnedContactTransition(detection(), {
      targetFrame: 12,
      gapFrames: 20,
      observationEndFrame: 16,
      ownedLineIds: new Set([7]),
      lineRoles: new Map([[7, "contact_closure"]]),
      requiredLineRoles: ["contact_closure"],
      timingToleranceFrames: 0,
    });
    expect(observed.ownedEvents[0]?.frame).toBe(11);
    expect(observed.ownedEvents[0]?.gateEligible).toBe(false);
    expect(observed.selectedOwnedEvent).toBeNull();
  });

  test("does not select an on-time event that belongs only to downstream support", () => {
    const observed = observeOwnedContactTransition(detection(), {
      targetFrame: 12,
      gapFrames: 20,
      observationEndFrame: 16,
      ownedLineIds: new Set([7]),
      lineRoles: new Map([[7, "outgoing_support"]]),
      requiredLineRoles: ["contact_closure"],
    });
    expect(observed.closestOwnedEvent?.frame).toBe(11);
    expect(observed.selectedOwnedEvent).toBeNull();
  });

  test("bounds nearby-event diagnostics to the declared local window", () => {
    const observed = observeOwnedContactTransition(detection(), {
      targetFrame: 12,
      observationStartFrame: 12,
      gapFrames: 20,
      observationEndFrame: 16,
      ownedLineIds: new Set([7]),
    });
    expect(observed.nearbyEvents.map((event) => event.frame)).toEqual([13, 14]);
    expect(observed.ownedEvents.map((event) => event.frame)).toEqual([13]);
  });

  test("treats either adjacent line of a declared C1 contact phase as local ownership", () => {
    const observed = observeOwnedContactTransition(detection(), {
      targetFrame: 12,
      gapFrames: 20,
      observationEndFrame: 16,
      ownedLineIds: new Set([7]),
      lineRoles: new Map([[7, "approach"]]),
      requiredLineRoles: ["approach", "contact_carrier"],
    });
    expect(observed.selectedOwnedEvent?.frame).toBe(11);
    expect(observed.selectedOwnedEvent?.roleEligible).toBe(true);
  });

  test("reports only sled-side updates on selected owned terrain", () => {
    const telemetry = ownedSledCollisionTelemetry([
      { type: "CollisionUpdate", id: 7, updated: [{ id: "TAIL" }, { id: "NOSE" }] },
      { type: "CollisionUpdate", id: 9, updated: [{ id: "PEG" }] },
      { type: "CollisionUpdate", id: 7, updated: [{ id: "RIDER" }] },
      { type: "StepUpdate", id: 7, updated: [{ id: "STRING" }] },
    ], new Set([7]));
    expect(telemetry).toEqual({
      ownedCollisionLineIds: [7],
      firedSledPointIds: ["TAIL", "NOSE"],
    });
  });

  test("makes an unreadable response horizon explicit instead of calling it a measured state", () => {
    const observed = observeOwnedContactTransition(detection(), {
      targetFrame: 12,
      gapFrames: 20,
      observationEndFrame: 16,
      ownedLineIds: new Set([7]),
      responseOffsetFrames: 6,
    });
    expect(observed.responseEndFrame).toBe(17);
    expect(observed.responseEndState).toBeNull();
    expect(observed.responseWindowComplete).toBe(false);
  });
});
