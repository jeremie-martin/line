import { describe, expect, test } from "vitest";
import type { TrackLine } from "../scripts/v0/types.ts";
import {
  additiveQuadraticFeatures,
  applyArcKnobs,
  fitLinearLeastSquares,
  jointQuadraticFeatures,
  pitchExitLines,
  predictLinearModel,
  rotateArcLines,
} from "../scripts/v0/optimizer/arc_model.ts";
import { readinessCatch, readinessCatchState } from "../scripts/v0/optimizer/readiness.ts";

function line(id: number, x1: number, y1: number, x2: number, y2: number): TrackLine {
  return {
    id,
    type: 0,
    x1,
    y1,
    x2,
    y2,
    flipped: false,
    leftExtended: false,
    rightExtended: false,
  };
}

describe("arc_model knob transforms", () => {
  const lines = [
    line(1, 0, 0, 10, 0),
    line(2, 10, 0, 20, 0),
    line(3, 20, 0, 30, 0),
  ];

  test("pitchExitLines rotates only the tail third about the suffix joint", () => {
    const out = pitchExitLines(lines, 90);
    expect(out[0]).toEqual(lines[0]);
    expect(out[1]).toEqual(lines[1]);
    expect(out[2].x1).toBeCloseTo(20);
    expect(out[2].y1).toBeCloseTo(0);
    expect(out[2].x2).toBeCloseTo(20);
    expect(out[2].y2).toBeCloseTo(10);
  });

  test("rotateArcLines rotates the whole arc about the entry point", () => {
    const out = rotateArcLines(lines, 90);
    expect(out[0].x1).toBeCloseTo(0);
    expect(out[0].y1).toBeCloseTo(0);
    expect(out[0].x2).toBeCloseTo(0);
    expect(out[0].y2).toBeCloseTo(10);
    expect(out[2].x2).toBeCloseTo(0);
    expect(out[2].y2).toBeCloseTo(30);
  });

  test("applyArcKnobs uses rotate-then-pitch order", () => {
    const knobs = { pitchDeg: 12, rotateDeg: -2 };
    expect(applyArcKnobs(lines, knobs)).toEqual(
      pitchExitLines(rotateArcLines(lines, knobs.rotateDeg), knobs.pitchDeg),
    );
  });
});

describe("arc_model local regression helpers", () => {
  const value = (pitchDeg: number, rotateDeg: number): number =>
    2 + 0.5 * pitchDeg - rotateDeg + 0.1 * pitchDeg * pitchDeg +
    0.25 * pitchDeg * rotateDeg - 0.2 * rotateDeg * rotateDeg;

  const grid = [-6, 0, 6].flatMap((pitchDeg) =>
    [-3, 0, 3].map((rotateDeg) => ({ pitchDeg, rotateDeg }))
  );

  test("jointQuadraticFeatures fit a pitch*rotation interaction", () => {
    const model = fitLinearLeastSquares(
      grid.map((knobs) => ({ features: jointQuadraticFeatures(knobs), value: value(knobs.pitchDeg, knobs.rotateDeg) })),
      0,
    );
    expect(model).not.toBeNull();
    const knobs = { pitchDeg: 1.5, rotateDeg: 0.5 };
    expect(predictLinearModel(model!, jointQuadraticFeatures(knobs))).toBeCloseTo(value(knobs.pitchDeg, knobs.rotateDeg), 8);
  });

  test("additiveQuadraticFeatures cannot represent the interaction term", () => {
    const model = fitLinearLeastSquares(
      grid.map((knobs) => ({ features: additiveQuadraticFeatures(knobs), value: value(knobs.pitchDeg, knobs.rotateDeg) })),
      0,
    );
    expect(model).not.toBeNull();
    const knobs = { pitchDeg: 2, rotateDeg: 1 };
    const predicted = predictLinearModel(model!, additiveQuadraticFeatures(knobs));
    expect(Math.abs(predicted - value(knobs.pitchDeg, knobs.rotateDeg))).toBeGreaterThan(0.1);
  });
});

describe("readiness state wrapper", () => {
  test("readinessCatchState delegates to the current speed/angle surface", () => {
    expect(readinessCatchState({ speed: 9, comAngleDeg: 10 })).toBeCloseTo(readinessCatch(9, 10));
  });

  test("readinessCatchState treats unknown velocity angle as unreadable", () => {
    expect(readinessCatchState({ speed: 9, comAngleDeg: null })).toBe(0);
  });
});
