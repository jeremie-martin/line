import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { constant } from "../scripts/v0/core/curves.ts";
import {
  applyCalibrationSelection,
  axisShift,
  calibrationSelectionPath,
  defineCalibration,
  identity,
  impactHighCompress,
  readCalibrationSelection,
} from "../scripts/v0/spec_modifiers.ts";
import type { Spec } from "../scripts/v0/types.ts";

function spec(): Spec {
  return {
    duration: 2,
    contacts: [
      { t: 0.5, impact: 0.2 },
      { t: 1.0, impact: 0.8 },
    ],
    axes: {
      speed: constant(0.5),
      air: ((t: number) => t < 1 ? 0.4 : undefined) as Spec["axes"]["air"],
    },
  };
}

describe("spec calibration modifiers", () => {
  test("axis shift wraps curves, clamps values, and preserves undefined", () => {
    const shifted = axisShift("speed", 0.6).apply(spec());
    expect(shifted.axes.speed?.(0)).toBe(1);

    const airShifted = axisShift("air", 0.1).apply(spec());
    expect(airShifted.axes.air?.(0.5)).toBeCloseTo(0.5);
    expect(airShifted.axes.air?.(1.5)).toBeUndefined();
  });

  test("impact high compression leaves soft impacts unchanged", () => {
    const modified = impactHighCompress({ threshold: 0.4, amount: 0.25 }).apply(spec());
    expect(modified.contacts[0].impact).toBeCloseTo(0.2);
    expect(modified.contacts[1].impact).toBeCloseTo(0.7);
  });

  test("sidecar selection applies selected candidate and disabled selection is identity", () => {
    const dir = mkdtempSync(join(tmpdir(), "line-calibration-"));
    const modulePath = join(dir, "example.ts");
    const sidecar = calibrationSelectionPath(modulePath);
    const calibration = defineCalibration({
      candidates: [identity(), axisShift("speed", 0.1)],
    });

    writeFileSync(sidecar, JSON.stringify({ version: 1, enabled: true, selected: "speed.shift.+0.1" }));
    expect(readCalibrationSelection(sidecar)?.selected).toBe("speed.shift.+0.1");
    expect(applyCalibrationSelection(spec(), calibration, modulePath).axes.speed?.(0)).toBeCloseTo(0.6);

    writeFileSync(sidecar, JSON.stringify({ version: 1, enabled: false, selected: "speed.shift.+0.1" }));
    expect(applyCalibrationSelection(spec(), calibration, modulePath).axes.speed?.(0)).toBeCloseTo(0.5);
  });
});
