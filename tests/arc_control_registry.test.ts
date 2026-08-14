import { describe, expect, test } from "vitest";
import {
  applyArcKnobSequence,
  getArcKnob,
  type ArcKnobId,
} from "../scripts/v0/optimizer/arc_actuator.ts";
import {
  arcControlProbeVectors,
  arcControlProposalValues,
  arcControlStageProbeValues,
  enumerateArcControlConfigurations,
  plannedArcControlProbeCount,
  type ArcControlConfiguration,
} from "../scripts/v0/optimizer/arc_control.ts";
import type { TrackLine } from "../scripts/v0/types.ts";
import {
  AIM_RESIDUAL_SECOND_GATE,
  aimControlOverrideActive,
  aimControlPhase,
  aimResidualSecondSelectionActive,
  aimOutgoingAmplitudeEligible,
  aimTopKScaleExponent,
  aimTopKScaleScope,
  aimTopKFirstRepairExtra,
  aimTopKBasesEffective,
  aimImpactTopChoiceIsResolved,
  aimModelImpactPower,
  impactSpeedAirOutgoingParetoImproves,
  impactSpeedParetoImproves,
  setAimSearchLane,
  setAimCompileBudgetFrames,
} from "../scripts/v0/optimizer/aim.ts";

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
const contact = { contactPoint: { x: 20, y: 0 }, contactSpeedPx: 2 };

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

  test("contact-window turn changes the contact tangent and preserves the later carrier", () => {
    const out = getArcKnob("post_contact_window_turn").apply(source, 4, contact);
    expect(out.slice(0, 2)).toEqual(source.slice(0, 2));
    expect(out[2].x1).toBeCloseTo(20);
    expect(out[2].y1).toBeCloseTo(0);
    expect(out[2].y2).not.toBeCloseTo(0);
    expect(endpoint(out)).toEqual(endpoint(source));
    expect(getArcKnob("post_contact_window_turn").apply(source, 4, {
      contactPoint: contact.contactPoint,
    })).toEqual(source);
  });

  test("contact-window bow preserves both boundary tangents and the later carrier", () => {
    const out = getArcKnob("post_contact_window_bow").apply(source, 2.5, contact);
    expect(out.slice(0, 2)).toEqual(source.slice(0, 2));
    expect(out[2].x1).toBeCloseTo(20);
    expect(out[2].y1).toBeCloseTo(0);
    expect(out[2].y2).not.toBeCloseTo(0);
    expect(endpoint(out)).toEqual(endpoint(source));
    expect(getArcKnob("post_contact_window_bow").apply(source, 2.5, {
      contactPoint: contact.contactPoint,
    })).toEqual(source);
  });

  test("post-contact extent changes release distance without changing the incoming path", () => {
    const longer = getArcKnob("post_contact_extent").apply(source, 0.2, contact);
    const shorter = getArcKnob("post_contact_extent").apply(source, -0.2, contact);
    expect(longer.slice(0, 2)).toEqual(source.slice(0, 2));
    expect(shorter.slice(0, 2)).toEqual(source.slice(0, 2));
    expect(longer[2].x1).toBeCloseTo(20);
    expect(shorter[2].x1).toBeCloseTo(20);
    expect(endpoint(longer)).toEqual([56, 0]);
    expect(endpoint(shorter)).toEqual([44, 0]);
    for (const out of [longer, shorter]) {
      for (let index = 1; index < out.length; index++) {
        expect(out[index - 1].x2).toBeCloseTo(out[index].x1, 12);
        expect(out[index - 1].y2).toBeCloseTo(out[index].y1, 12);
      }
    }
    expect(getArcKnob("post_contact_extent").apply(source, 0.2)).toEqual(source);
  });
});

describe("arc-control probe layouts", () => {
  const narrow: ArcControlConfiguration = {
    id: "base_additive--signed3_narrow--whole_rotation__tail_pitch",
    observationEquivalenceKey: "test",
    sequence: ["whole_rotation", "tail_pitch"],
    trainingMethod: "base_additive",
    probeLayout: "signed3_narrow",
    probeRangeScale: 1,
    proposalRangeScale: 1,
    proposalCount: 2,
  };

  test("repair-only control overrides leave the main controller inactive", () => {
    expect(aimControlPhase({})).toBe("all");
    expect(aimControlPhase({ LR_AIM_CONTROL_PHASE: "repair" })).toBe("repair");
    expect(() => aimControlPhase({ LR_AIM_CONTROL_PHASE: "tail" })).toThrow();
    setAimSearchLane("initial");
    expect(aimControlOverrideActive("all")).toBe(true);
    expect(aimControlOverrideActive("repair")).toBe(false);
    setAimSearchLane("repair", 0);
    expect(aimControlOverrideActive("repair")).toBe(true);
    setAimSearchLane("initial");
  });

  test("residual second-slot ranking is confined to the initial episode", () => {
    expect(AIM_RESIDUAL_SECOND_GATE).toEqual({
      policy: "initial_low_regret_material_advantage_v1",
      maximumIncumbentImpactRegret: 0.01,
      maximumIncumbentUtilityRegret: 0.01,
      minimumResidualImpactAdvantage: 0.02,
    });
    setAimSearchLane("initial");
    expect(aimResidualSecondSelectionActive()).toBe(true);
    setAimSearchLane("repair", 0);
    expect(aimResidualSecondSelectionActive()).toBe(false);
    setAimSearchLane("resumed");
    expect(aimResidualSecondSelectionActive()).toBe(false);
    expect(() => setAimSearchLane("initial", 0)).toThrow();
    expect(() => setAimSearchLane("repair")).toThrow();
    setAimSearchLane("initial");
  });

  test("mature aim breadth exponent is linear by default and validates study arms", () => {
    expect(aimTopKScaleExponent({})).toBe(1);
    expect(aimTopKScaleExponent({ LR_AIM_TOPK_SCALE_EXPONENT: "0.75" })).toBe(0.75);
    expect(() => aimTopKScaleExponent({ LR_AIM_TOPK_SCALE_EXPONENT: "0" })).toThrow();
    expect(() => aimTopKScaleExponent({ LR_AIM_TOPK_SCALE_EXPONENT: "2.1" })).toThrow();
    expect(aimTopKScaleScope({})).toBe("all");
    expect(aimTopKScaleScope({ LR_AIM_TOPK_SCALE_SCOPE: "repair" })).toBe("repair");
    expect(() => aimTopKScaleScope({ LR_AIM_TOPK_SCALE_SCOPE: "resumed" })).toThrow();
  });

  test("repair-scoped aim breadth leaves ordinary pools linear", () => {
    const previousExponent = process.env.LR_AIM_TOPK_SCALE_EXPONENT;
    const previousScope = process.env.LR_AIM_TOPK_SCALE_SCOPE;
    try {
      process.env.LR_AIM_TOPK_SCALE_EXPONENT = "0.875";
      process.env.LR_AIM_TOPK_SCALE_SCOPE = "repair";
      setAimCompileBudgetFrames(4_000_000);
      setAimSearchLane("initial");
      expect(aimTopKBasesEffective()).toBe(96);
      setAimSearchLane("repair", 0);
      expect(aimTopKBasesEffective()).toBe(68);
    } finally {
      setAimSearchLane("initial");
      setAimCompileBudgetFrames(0);
      if (previousExponent === undefined) delete process.env.LR_AIM_TOPK_SCALE_EXPONENT;
      else process.env.LR_AIM_TOPK_SCALE_EXPONENT = previousExponent;
      if (previousScope === undefined) delete process.env.LR_AIM_TOPK_SCALE_SCOPE;
      else process.env.LR_AIM_TOPK_SCALE_SCOPE = previousScope;
    }
  });

  test("first-repair aim breadth increment is isolated and preserves the low-air cap", () => {
    const previous = process.env.LR_AIM_TOPK_FIRST_REPAIR_EXTRA;
    try {
      expect(aimTopKFirstRepairExtra({})).toBe(0);
      expect(aimTopKFirstRepairExtra({ LR_AIM_TOPK_FIRST_REPAIR_EXTRA: "1" })).toBe(1);
      expect(() => aimTopKFirstRepairExtra({ LR_AIM_TOPK_FIRST_REPAIR_EXTRA: "1.5" }))
        .toThrow();
      expect(() => aimTopKFirstRepairExtra({ LR_AIM_TOPK_FIRST_REPAIR_EXTRA: "9" }))
        .toThrow();
      process.env.LR_AIM_TOPK_FIRST_REPAIR_EXTRA = "1";
      setAimCompileBudgetFrames(750_000);
      setAimSearchLane("initial");
      expect(aimTopKBasesEffective()).toBe(18);
      setAimSearchLane("repair", 0);
      expect(aimTopKBasesEffective()).toBe(19);
      setAimSearchLane("repair", 1);
      expect(aimTopKBasesEffective()).toBe(18);
      setAimSearchLane("repair", 0);
      expect(aimTopKBasesEffective({ targets: { air: 0.3 } } as any)).toBe(3);
    } finally {
      setAimSearchLane("initial");
      setAimCompileBudgetFrames(0);
      if (previous === undefined) delete process.env.LR_AIM_TOPK_FIRST_REPAIR_EXTRA;
      else process.env.LR_AIM_TOPK_FIRST_REPAIR_EXTRA = previous;
    }
  });

  test("validates the aim-specific model impact power", () => {
    expect(aimModelImpactPower({})).toBe(1);
    expect(aimModelImpactPower({ LR_AIM_MODEL_IMPACT_POWER: "0.75" })).toBe(0.75);
    expect(aimModelImpactPower({ LR_AIM_MODEL_IMPACT_POWER: "1.25" })).toBe(1.25);
    expect(() => aimModelImpactPower({ LR_AIM_MODEL_IMPACT_POWER: "0.1" })).toThrow();
    expect(() => aimModelImpactPower({ LR_AIM_MODEL_IMPACT_POWER: "4.1" })).toThrow();
  });

  test("gates only changed top choices below the artifact resolution", () => {
    expect(aimImpactTopChoiceIsResolved("off", true, 0)).toBe(true);
    expect(aimImpactTopChoiceIsResolved("validated-mae-top1", false, 0, 0.04))
      .toBe(true);
    expect(aimImpactTopChoiceIsResolved("validated-mae-top1", true, 0.04, 0.04))
      .toBe(false);
    expect(aimImpactTopChoiceIsResolved("validated-mae-top1", true, 0.0401, 0.04))
      .toBe(true);
  });

  test("outgoing amplitude study modes separate authored onset and budget maturity", () => {
    expect(aimOutgoingAmplitudeEligible(0.8, {}, 1_000_000)).toBe(false);
    expect(aimOutgoingAmplitudeEligible(
      0.1,
      {},
      750_000,
      { meanAmplitude: 0.3, meanAir: 0.58 },
    )).toBe(true);
    expect(aimOutgoingAmplitudeEligible(0.1, { LR_AIM_OUTGOING_AMPLITUDE: "all" }, 1)).toBe(true);
    expect(aimOutgoingAmplitudeEligible(0.29, { LR_AIM_OUTGOING_AMPLITUDE: "commanded" }, 1_000_000)).toBe(false);
    expect(aimOutgoingAmplitudeEligible(0.3, { LR_AIM_OUTGOING_AMPLITUDE: "commanded" }, 1)).toBe(true);
    expect(aimOutgoingAmplitudeEligible(0.8, { LR_AIM_OUTGOING_AMPLITUDE: "mature" }, 499_999)).toBe(false);
    expect(aimOutgoingAmplitudeEligible(0.1, { LR_AIM_OUTGOING_AMPLITUDE: "mature" }, 500_000)).toBe(true);
    expect(aimOutgoingAmplitudeEligible(0.29, { LR_AIM_OUTGOING_AMPLITUDE: "mature-commanded" }, 750_000)).toBe(false);
    expect(aimOutgoingAmplitudeEligible(0.3, { LR_AIM_OUTGOING_AMPLITUDE: "mature-commanded" }, 750_000)).toBe(true);
    expect(aimOutgoingAmplitudeEligible(
      0.1,
      { LR_AIM_OUTGOING_AMPLITUDE: "mature-distinct" },
      750_000,
      { meanAmplitude: 0.3, meanAir: 0.58 },
    )).toBe(true);
    expect(aimOutgoingAmplitudeEligible(
      0.8,
      { LR_AIM_OUTGOING_AMPLITUDE: "mature-distinct" },
      750_000,
      { meanAmplitude: 0.2, meanAir: 0.58 },
    )).toBe(false);
    expect(aimOutgoingAmplitudeEligible(
      0.8,
      { LR_AIM_OUTGOING_AMPLITUDE: "mature-distinct" },
      750_000,
      { meanAmplitude: 0.3, meanAir: 0.61 },
    )).toBe(false);
    expect(() => aimOutgoingAmplitudeEligible(0.5, { LR_AIM_OUTGOING_AMPLITUDE: "maybe" }, 750_000)).toThrow();
  });

  test("auxiliary Pareto admission requires impact gain without speed debt", () => {
    const targets = { impact: 0.7, speed: 0.8 };
    const base = { impact: 0.5, speed: 0.75 };
    expect(impactSpeedParetoImproves(base, { impact: 0.6, speed: 0.76 }, targets))
      .toBe(true);
    expect(impactSpeedParetoImproves(base, { impact: 0.49, speed: 0.8 }, targets))
      .toBe(false);
    expect(impactSpeedParetoImproves(base, { impact: 0.6, speed: 0.7 }, targets))
      .toBe(false);
    expect(impactSpeedParetoImproves(base, { impact: 0.6 }, targets)).toBe(false);
  });

  test("conservative auxiliary admission also rejects air and outgoing debt", () => {
    const targets = { impact: 0.7, speed: 0.8, air: 0.4 };
    const base = { impact: 0.5, speed: 0.75, air: 0.3 };
    expect(impactSpeedAirOutgoingParetoImproves(
      base, { impact: 0.6, speed: 0.76, air: 0.35 }, targets, 0.7, 0.71,
    )).toBe(true);
    expect(impactSpeedAirOutgoingParetoImproves(
      base, { impact: 0.6, speed: 0.76, air: 0.2 }, targets, 0.7, 0.71,
    )).toBe(false);
    expect(impactSpeedAirOutgoingParetoImproves(
      base, { impact: 0.6, speed: 0.76, air: 0.35 }, targets, 0.7, 0.69,
    )).toBe(false);
    expect(impactSpeedAirOutgoingParetoImproves(
      base, { impact: 0.6, speed: 0.7, air: 0.35 }, targets, 0.7, 0.71,
    )).toBe(false);
  });

  test("a layout changes physical observations but not the declared inverse range", () => {
    expect(arcControlProbeVectors(narrow)).toEqual([
      [0, 0], [-1.5, 0], [1.5, 0], [0, -5.1], [0, 5.1],
    ]);
    expect(arcControlStageProbeValues("tail_pitch", "signed3_wide"))
      .toEqual([0, -11.899999999999999, 11.899999999999999]);
    expect(arcControlStageProbeValues("tail_pitch", "signed3", 0.6))
      .toEqual([0, -5.1, 5.1]);
    expect(plannedArcControlProbeCount(narrow)).toBe(5);
  });

  test("proposal range is independent from probe range and retains exact scaled bounds", () => {
    expect(arcControlProposalValues("tail_pitch", 0.6).at(0)).toBeCloseTo(-5.1);
    expect(arcControlProposalValues("tail_pitch", 0.6).at(-1)).toBeCloseTo(5.1);
    const configurations = enumerateArcControlConfigurations({
      knobs: ["tail_pitch"],
      maxKnobs: 1,
      trainingMethods: ["base_additive"],
      probeLayouts: ["signed3"],
      probeRangeScales: [0.5, 0.6],
      proposalRangeScales: [0.8, 1.2],
    });
    expect(configurations).toHaveLength(4);
    expect(new Set(configurations.map((configuration) => configuration.probeRangeScale))).toEqual(new Set([0.5, 0.6]));
    expect(new Set(configurations.map((configuration) => configuration.proposalRangeScale))).toEqual(new Set([0.8, 1.2]));
  });

  test("nine registered knobs produce the complete no-repeat length-one/two additive screen", () => {
    const configurations = enumerateArcControlConfigurations({
      maxKnobs: 2,
      trainingMethods: ["base_additive"],
      probeLayouts: ["signed3"],
    });
    expect(configurations).toHaveLength(81);
    expect(new Set(configurations.map((configuration) => configuration.id)).size).toBe(81);
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
