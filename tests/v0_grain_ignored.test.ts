import { describe, expect, test } from "vitest";
import { axisCost } from "../scripts/v0/core/candidate.ts";
import { constant } from "../scripts/v0/core/curves.ts";
import {
  axesAtFrame,
  effectiveAxes,
  sampleGapTargets,
  validateSpec,
} from "../scripts/v0/core/substrate.ts";
import {
  hasAnyTargetAxis,
  hasExactlyTargetAxes,
  type Gap,
  type Spec,
} from "../scripts/v0/types.ts";

describe("v0 spec grain handling", () => {
  test("authored grain is ignored before validation and target resolution", () => {
    let grainReads = 0;
    const spec: Spec = {
      duration: 1,
      contacts: [{ t: 0.5 }],
      axes: {
        air: constant(0.5),
        grain: () => {
          grainReads++;
          throw new Error("grain should not be evaluated");
        },
      },
    };
    const gap: Gap = {
      index: 0,
      startFrame: 0,
      endFrame: 20,
      endsWithContact: true,
      targets: {},
    };

    expect(() => validateSpec(spec)).not.toThrow();
    expect(axesAtFrame(0, spec)).toEqual({ air: 0.5 });
    expect(effectiveAxes(gap, spec)).toEqual({ air: 0.5 });
    expect(sampleGapTargets({ air: 0.5, grain: 0.8 }, 0, () => 0.5)).toEqual({ air: 0.5 });
    expect(hasExactlyTargetAxes({ air: 0.5, grain: 0.8 }, ["air"])).toBe(true);
    expect(hasExactlyTargetAxes({ grain: 0.8 }, [])).toBe(true);
    expect(hasExactlyTargetAxes({ grain: 0.8 }, ["grain"])).toBe(false);
    expect(hasAnyTargetAxis({ grain: 0.8 }, ["grain"])).toBe(false);
    expect(axisCost({ air: 0.5, grain: 0 }, { air: 0.4, grain: 1 })).toBeCloseTo(0.01);
    expect(grainReads).toBe(0);
  });
});
