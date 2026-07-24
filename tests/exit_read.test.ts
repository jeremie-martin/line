import { describe, expect, it } from "vitest";
import {
  firstAirborneExitFrame,
  firstCleanAirborneExitFrame,
} from "../scripts/v0/core/exit_read.ts";

const lines = [{ x1: 0, y1: 0, x2: 10, y2: 0 }];
const position = (frame: number) => ({ x: frame + 5, y: 0 });

describe("ballistic exit boundary", () => {
  it("distinguishes a transient airborne excursion from a clean exit", () => {
    const airborne = (frame: number) => frame === 6 || frame >= 8;

    expect(
      firstAirborneExitFrame(lines, 5, 10, airborne, position),
    ).toBe(6);
    expect(
      firstCleanAirborneExitFrame(lines, 5, 10, airborne, position),
    ).toBe(8);
  });

  it("requires the clean airborne suffix to cross the end plane", () => {
    expect(
      firstCleanAirborneExitFrame(
        lines,
        5,
        10,
        () => true,
        () => ({ x: 9, y: 0 }),
      ),
    ).toBeNull();
  });
});
