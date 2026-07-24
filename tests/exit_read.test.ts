import { describe, expect, it } from "vitest";
import {
  ARC_EXIT_CONFIRM_FRAMES,
  arcExitAirborneBreakFrame,
  confirmedArcExitFrame,
  firstAirborneExitFrame,
  growShortHorizon,
} from "../scripts/v0/core/exit_read.ts";

const lines = [{ x1: 0, y1: 0, x2: 10, y2: 0 }];
/** Past the arc-end plane (x = 10) from frame 6 on. */
const position = (frame: number) => ({ x: frame + 5, y: 0 });

describe("geometric arc exit", () => {
  it("rejects an exit whose very next frame grazes, and takes the next one", () => {
    // Frame 6 is airborne and past the plane, but frame 7 contacts — the one
    // real failure mode the frozen ballistic corpus observed (a trailing point
    // grazing at anchor+1). Frame 8 onward is clean.
    const airborne = (frame: number) => frame === 6 || frame >= 8;

    expect(firstAirborneExitFrame(lines, 5, 10, airborne, position)).toBe(6);
    expect(confirmedArcExitFrame(lines, 5, 10, airborne, position)).toBe(8);
  });

  it("takes the first past-plane frame when the flight is clean", () => {
    expect(
      confirmedArcExitFrame(lines, 5, 10, () => true, position),
    ).toBe(6);
  });

  it("requires the exit to cross the end plane", () => {
    expect(
      confirmedArcExitFrame(lines, 5, 10, () => true, () => ({ x: 9, y: 0 })),
    ).toBeNull();
  });

  it("reports 'not confirmable yet' rather than 'no exit' at the window edge", () => {
    const airborne = () => true;
    // The window ends exactly at the first past-plane frame, so the confirming
    // frame is unobserved: the caller must simulate further.
    expect(confirmedArcExitFrame(lines, 5, 6, airborne, position)).toBeNull();
    expect(confirmedArcExitFrame(lines, 5, 7, airborne, position)).toBe(6);
  });

  it("is independent of how far the caller simulated", () => {
    // THE invariant the two production call sites rely on: the candidate
    // evaluator grows its window behind a survival floor and the aim probe does
    // not, yet both must acquire the identical launch anchor.
    const airborne = (frame: number) => frame === 6 || frame >= 8;
    const answers = new Set<number | null>();
    for (let endFrame = 9; endFrame <= 60; endFrame++) {
      answers.add(confirmedArcExitFrame(lines, 5, endFrame, airborne, position));
    }
    expect([...answers]).toEqual([8]);
  });

  it("is independent of the growth chunk size", () => {
    const airborne = (frame: number) => frame >= 6;
    const stops = new Map<number, number | null>();
    for (const chunk of [1, 2, 3, 4, 7, 16]) {
      let found: number | null = null;
      const horizon = growShortHorizon(5, 60, (h) => {
        found = confirmedArcExitFrame(lines, 5, h, airborne, position);
        return { terminatedEarly: false, exitFound: found !== null };
      }, chunk);
      stops.set(chunk, found);
      expect(horizon).toBeLessThanOrEqual(60);
    }
    expect([...new Set(stops.values())]).toEqual([6]);
  });

  it("measures a later break as diagnostic, without moving the exit", () => {
    const airborne = (frame: number) => frame !== 12;
    expect(confirmedArcExitFrame(lines, 5, 20, airborne, position)).toBe(6);
    expect(
      arcExitAirborneBreakFrame(6, 20, airborne),
    ).toBe(12);
    expect(arcExitAirborneBreakFrame(6, 20, () => true)).toBeNull();
    // The confirmation window itself is never reported as a break.
    expect(ARC_EXIT_CONFIRM_FRAMES).toBe(1);
    expect(arcExitAirborneBreakFrame(6, 7, () => false)).toBeNull();
  });
});
