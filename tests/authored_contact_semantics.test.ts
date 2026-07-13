import { describe, expect, test } from "vitest";
import {
  K_BOUNCE_LANDING,
  MIN_LANDING_AIRBORNE_FRAMES,
  type Detection,
  type DetEvent,
} from "../scripts/lib/detector.ts";
import {
  findAuthoredContactNearFrame,
  isAuthoredContactEvent,
  offBeatLandingEvents,
} from "../scripts/v0/core/substrate.ts";

const landing: DetEvent = { frame: 20, type: "landing", airborneFrom: 10 };
const bounce: DetEvent = { frame: 20, type: "bounce", airborneFrom: 15 };

function detection(events: DetEvent[]): Detection {
  return { events } as unknown as Detection;
}

describe("authored contact semantics", () => {
  test("a landing satisfies every positive authored interval", () => {
    expect(isAuthoredContactEvent(landing, 1)).toBe(true);
    expect(isAuthoredContactEvent(landing, 120)).toBe(true);
  });

  test("a persistent bounce only satisfies a detector-limited interval", () => {
    expect(MIN_LANDING_AIRBORNE_FRAMES).toBe(K_BOUNCE_LANDING + 1);
    expect(isAuthoredContactEvent(bounce, MIN_LANDING_AIRBORNE_FRAMES)).toBe(true);
    expect(isAuthoredContactEvent(bounce, MIN_LANDING_AIRBORNE_FRAMES + 1)).toBe(false);
  });

  test("contact lookup applies the same boundary and timing tolerance", () => {
    const det = detection([bounce]);
    expect(findAuthoredContactNearFrame(det, 19, 1, MIN_LANDING_AIRBORNE_FRAMES)).toBe(bounce);
    expect(findAuthoredContactNearFrame(
      det,
      19,
      1,
      MIN_LANDING_AIRBORNE_FRAMES + 1,
    )).toBeUndefined();
    expect(findAuthoredContactNearFrame(det, 18, 1, MIN_LANDING_AIRBORNE_FRAMES)).toBeUndefined();
  });

  test("persistent bounces do not become off-beat landings", () => {
    const det = detection([bounce, { ...landing, frame: 30 }]);
    expect(offBeatLandingEvents(det, [20])).toEqual([{ ...landing, frame: 30 }]);
  });
});
