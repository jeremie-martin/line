import { describe, expect, test } from "vitest";
import { planSupportGeometry } from "../scripts/v0/core/support_geometry.ts";

describe("continuous support geometry", () => {
  test("leaves every legacy extent unchanged when the mechanism is off", () => {
    const plan = planSupportGeometry({
      mode: "off",
      air: 0.02,
      gapFrames: 200,
      speed: 11.5,
      legacyPostLength: 260,
      coordinate: 1,
      shapeTimeBlend: 1,
    });
    expect(plan.targetLength).toBeCloseTo(2242.5);
    expect(plan.postLength).toBe(260);
  });

  test("samples ordinary support in grounded frames before converting to distance", () => {
    const ordinary = planSupportGeometry({
      mode: "time",
      air: 0.25,
      gapFrames: 40,
      speed: 10,
      legacyPostLength: 140,
      coordinate: 0,
      shapeTimeBlend: 1,
    });
    expect(ordinary.targetGroundFrames).toBe(30);
    expect(ordinary.minGroundFrames).toBe(16.5);
    expect(ordinary.maxGroundFrames).toBe(35);
    expect(ordinary.sampledGroundFrames).toBe(16.5);
    expect(ordinary.targetLength).toBe(300);
    expect(ordinary.postLength).toBe(165);
  });

  test("scales a frontier support directly from speed, gap, and air", () => {
    const frontier = planSupportGeometry({
      mode: "time",
      air: 0.02,
      gapFrames: 200,
      speed: 11.5,
      legacyPostLength: 260,
      coordinate: 1,
      shapeTimeBlend: 1,
    });
    expect(frontier.effectiveAir).toBe(0.025);
    expect(frontier.targetGroundFrames).toBe(195);
    expect(frontier.maxGroundFrames).toBe(195);
    expect(frontier.sampledGroundFrames).toBe(195);
    expect(frontier.targetLength).toBeCloseTo(2242.5);
    expect(frontier.postLength).toBeCloseTo(2242.5);
  });

  test("uses the detector landing floor for very short gaps", () => {
    const plan = planSupportGeometry({
      mode: "time",
      air: 0.1,
      gapFrames: 8,
      speed: 10,
      legacyPostLength: 120,
      coordinate: 1,
      shapeTimeBlend: 1,
    });
    expect(plan.effectiveAir).toBe(0.625);
    expect(plan.targetGroundFrames).toBe(3);
    expect(plan.maxGroundFrames).toBe(3);
    expect(plan.postLength).toBe(30);
  });

  test("keeps explicit timing slack around the authored target", () => {
    const plan = planSupportGeometry({
      mode: "time",
      air: 0.02,
      gapFrames: 200,
      speed: 11.5,
      legacyPostLength: 260,
      coordinate: 0,
      shapeTimeBlend: 1,
    });
    expect(plan.minGroundFrames).toBeCloseTo(107.25);
    expect(plan.targetGroundFrames).toBe(195);
    expect(plan.maxGroundFrames).toBe(195);
  });

  test("the adaptive lane extends support but never shortens mature geometry", () => {
    const shorterTarget = planSupportGeometry({
      mode: "time-extend",
      air: 0.1,
      gapFrames: 8,
      speed: 10,
      legacyPostLength: 80,
      coordinate: 1,
      shapeTimeBlend: 1,
    });
    const longerTarget = planSupportGeometry({
      mode: "time-extend",
      air: 0.02,
      gapFrames: 200,
      speed: 11.5,
      legacyPostLength: 260,
      coordinate: 1,
      shapeTimeBlend: 1,
    });
    expect(shorterTarget.postLength).toBe(80);
    expect(longerTarget.postLength).toBeCloseTo(2242.5);
  });

  test("spans continuously from shape-native to support-time geometry", () => {
    const shape = planSupportGeometry({
      mode: "time-shape-span",
      air: 0.25,
      gapFrames: 40,
      speed: 10,
      legacyPostLength: 120,
      coordinate: 1,
      shapeTimeBlend: 0,
    });
    const middle = planSupportGeometry({
      mode: "time-shape-span",
      air: 0.25,
      gapFrames: 40,
      speed: 10,
      legacyPostLength: 120,
      coordinate: 1,
      shapeTimeBlend: 0.5,
    });
    const time = planSupportGeometry({
      mode: "time-shape-span",
      air: 0.25,
      gapFrames: 40,
      speed: 10,
      legacyPostLength: 120,
      coordinate: 1,
      shapeTimeBlend: 1,
    });
    expect(shape.postLength).toBe(120);
    expect(middle.postLength).toBe(235);
    expect(time.postLength).toBe(350);
    expect(shape.targetGroundFrames).toBe(time.targetGroundFrames);
  });

  test("logarithmic shape-time coverage preserves both physical endpoints", () => {
    const shape = planSupportGeometry({
      mode: "shape-time-log",
      air: 0.02,
      gapFrames: 200,
      speed: 10,
      legacyPostLength: 200,
      coordinate: 0.5,
      shapeTimeBlend: 0,
    });
    const middle = planSupportGeometry({
      mode: "shape-time-log",
      air: 0.02,
      gapFrames: 200,
      speed: 10,
      legacyPostLength: 200,
      coordinate: 0.5,
      shapeTimeBlend: 0.5,
    });
    const authored = planSupportGeometry({
      mode: "shape-time-log",
      air: 0.02,
      gapFrames: 200,
      speed: 10,
      legacyPostLength: 200,
      coordinate: 0.5,
      shapeTimeBlend: 1,
    });
    expect(shape.postLength).toBeCloseTo(200);
    expect(middle.postLength).toBeCloseTo(Math.sqrt(200 * 1950));
    expect(authored.postLength).toBeCloseTo(1950);
  });

  test("deficit pressure is inert near shape coverage and opens continuously", () => {
    const covered = planSupportGeometry({
      mode: "shape-time-deficit",
      air: 0.4,
      gapFrames: 24,
      speed: 10,
      legacyPostLength: 145,
      coordinate: 0.5,
      shapeTimeBlend: 1,
    });
    const frontier = planSupportGeometry({
      mode: "shape-time-deficit",
      air: 0.02,
      gapFrames: 200,
      speed: 10,
      legacyPostLength: 200,
      coordinate: 0.5,
      shapeTimeBlend: 1,
    });
    expect(covered.extensionPressure).toBe(0);
    expect(covered.postLength).toBe(145);
    expect(frontier.extensionPressure).toBe(1);
    expect(frontier.postLength).toBeCloseTo(1950);
  });

  test("deficit pressure uses the family center, not a short random member", () => {
    const plan = planSupportGeometry({
      mode: "shape-time-deficit",
      air: 0.73,
      gapFrames: 70,
      speed: 10,
      legacyPostLength: 75,
      shapeReferenceLength: 190,
      coordinate: 0.5,
      shapeTimeBlend: 1,
    });
    expect(plan.extensionPressure).toBe(0);
    expect(plan.postLength).toBeCloseTo(75);
  });

});
