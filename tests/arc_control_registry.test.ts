import { describe, expect, test } from "vitest";
import {
  applyArcKnobSequence,
  getArcKnob,
  type ArcKnobId,
} from "../scripts/v0/optimizer/arc_actuator.ts";
import {
  arcControlProbeVectors,
  arcControlStageProbeValues,
  enumerateArcControlConfigurations,
  plannedArcControlProbeCount,
  type ArcControlConfiguration,
} from "../scripts/v0/optimizer/arc_control.ts";
import type { TrackLine } from "../scripts/v0/types.ts";

function line(id: number, x1: number, y1: number, x2: number, y2: number): TrackLine {
  return { id, type: 0, x1, y1, x2, y2, flipped: false, leftExtended: false, rightExtended: false };
}

const source = [
  line(1, 0, 0, 10, 0),
  line(2, 10, 0, 20, 0),
  line(3, 20, 0, 30, 0),
  line(4, 30, 0, 40, 0),
  line(5, 40, 0, 50, 0),
];
const contact = { contactPoint: { x: 20, y: 0 } };

function endpoint(lines: readonly TrackLine[]): [number, number] {
  const end = lines[lines.length - 1];
  return [end.x2, end.y2];
}

describe("post-contact endpoint-preserving shape knobs", () => {
  const ids: readonly ArcKnobId[] = ["post_contact_normal_bow", "post_contact_normal_skew"];

  for (const id of ids) {
    test(`${id} is active, local, and preserves contact and terminal boundaries`, () => {
      const out = getArcKnob(id).apply(source, 2.5, contact);
      expect(out).not.toBe(source);
      expect(out.slice(0, 2)).toEqual(source.slice(0, 2));
      expect(out[2].x1).toBeCloseTo(20);
      expect(out[2].y1).toBeCloseTo(0);
      expect(endpoint(out)).toEqual(endpoint(source));
      expect(out[2].y2).not.toBeCloseTo(0);
      for (let index = 1; index < out.length; index++) {
        expect(out[index - 1].x2).toBeCloseTo(out[index].x1, 12);
        expect(out[index - 1].y2).toBeCloseTo(out[index].y1, 12);
      }
      expect(source).toEqual([
        line(1, 0, 0, 10, 0), line(2, 10, 0, 20, 0), line(3, 20, 0, 30, 0),
        line(4, 30, 0, 40, 0), line(5, 40, 0, 50, 0),
      ]);
    });
  }

  test("bow and skew are distinct deformation modes", () => {
    const bow = getArcKnob("post_contact_normal_bow").apply(source, 2.5, contact);
    const skew = getArcKnob("post_contact_normal_skew").apply(source, 2.5, contact);
    expect(bow.map((line) => [line.x1, line.y1, line.x2, line.y2]))
      .not.toEqual(skew.map((line) => [line.x1, line.y1, line.x2, line.y2]));
    expect(bow[2].y2).toBeGreaterThan(0);
    expect(skew[2].y2).toBeLessThan(0);
  });

  test("missing contact or insufficient downstream vertices is an ordinary identity", () => {
    expect(applyArcKnobSequence(source, ["post_contact_normal_bow"], [2.5]))
      .toEqual(source);
    expect(getArcKnob("post_contact_normal_bow").apply(source.slice(0, 3), 2.5, contact))
      .toEqual(source.slice(0, 3));
  });
});

describe("arc-control probe layouts", () => {
  const narrow: ArcControlConfiguration = {
    id: "base_additive--signed3_narrow--whole_rotation__tail_pitch",
    observationEquivalenceKey: "test",
    sequence: ["whole_rotation", "tail_pitch"],
    trainingMethod: "base_additive",
    probeLayout: "signed3_narrow",
    proposalCount: 2,
  };

  test("a layout changes physical observations but not the declared inverse range", () => {
    expect(arcControlProbeVectors(narrow)).toEqual([
      [0, 0], [-1.5, 0], [1.5, 0], [0, -5.1], [0, 5.1],
    ]);
    expect(arcControlStageProbeValues("tail_pitch", "signed3_wide"))
      .toEqual([0, -11.899999999999999, 11.899999999999999]);
    expect(plannedArcControlProbeCount(narrow)).toBe(5);
  });

  test("six registered knobs produce the complete no-repeat length-one/two additive screen", () => {
    const configurations = enumerateArcControlConfigurations({
      maxKnobs: 2,
      trainingMethods: ["base_additive"],
      probeLayouts: ["signed3"],
    });
    expect(configurations).toHaveLength(36);
    expect(new Set(configurations.map((configuration) => configuration.id)).size).toBe(36);
  });

  test("proposal count is an independent Cartesian compiler axis", () => {
    const configurations = enumerateArcControlConfigurations({
      knobs: ["whole_rotation", "tail_pitch"],
      maxKnobs: 2,
      trainingMethods: ["base_additive"],
      probeLayouts: ["signed3"],
      proposalCounts: [1, 2, 3],
    });
    expect(configurations).toHaveLength(12);
    expect(configurations.map((configuration) => configuration.proposalCount)).toContain(3);
    expect(new Set(configurations.map((configuration) => configuration.id)).size).toBe(12);
  });
});
