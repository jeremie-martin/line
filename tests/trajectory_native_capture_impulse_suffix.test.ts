import { describe, expect, test } from "vitest";
import { realizeNativeCaptureImpulseSuffix } from "../scripts/v0/trajectory/native_capture_impulse_suffix.ts";
import type { TrackLine } from "../scripts/v0/types.ts";

const lines: TrackLine[] = [
  { id: 1, type: 0, x1: 0, y1: 0, x2: 2, y2: 0, flipped: false, leftExtended: false, rightExtended: false },
  { id: 2, type: 0, x1: 2, y1: 0, x2: 4, y2: 0, flipped: false, leftExtended: false, rightExtended: false },
  { id: 3, type: 0, x1: 4, y1: 0, x2: 6, y2: 0, flipped: false, leftExtended: false, rightExtended: false },
];

describe("native-capture impulse suffix transport", () => {
  test("keeps the native contact prefix exact and integrates the measured impulse downstream", () => {
    const result = realizeNativeCaptureImpulseSuffix(lines, new Set([1]), {
      preVelocity: { x: 2, y: 0 },
      postVelocity: { x: 3, y: 0 },
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.lines[0]).toEqual(lines[0]);
    expect(result.lines[1]!.x1).toBe(2);
    expect(result.lines[1]!.x2).toBeCloseTo(4 + 2 / 3, 12);
    expect(result.lines[2]!.x1).toBeCloseTo(4 + 2 / 3, 12);
    expect(result.lines[2]!.x2).toBeCloseTo(6 + 4 / 3, 12);
    expect(result.lines.map((line) => line.id)).toEqual([1, 2, 3]);
    expect(result.terminalDisplacement).toEqual({ x: 4 / 3, y: 0 });
  });

  test("fails closed without a contact-owned prefix or a usable suffix", () => {
    expect(realizeNativeCaptureImpulseSuffix(lines, new Set(), {
      preVelocity: { x: 1, y: 0 }, postVelocity: { x: 1, y: 0 },
    })).toMatchObject({ status: "unavailable", reason: "no_target_contact_line" });
    expect(realizeNativeCaptureImpulseSuffix(lines, new Set([3]), {
      preVelocity: { x: 1, y: 0 }, postVelocity: { x: 1, y: 0 },
    })).toMatchObject({ status: "unavailable", reason: "no_downstream_suffix" });
  });
});
