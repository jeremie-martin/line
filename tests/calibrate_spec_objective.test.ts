import { describe, expect, test } from "vitest";
import {
  calibrationObjectiveScore,
  parseSeeds,
  type CalibrationObjectiveInput,
} from "../scripts/v0/calibrate_spec.ts";

function objectiveInput(
  score: number,
  speedError: number,
  distortionMeanAbsDelta = 0,
): CalibrationObjectiveInput {
  return {
    score,
    axis_compare: [
      { axis: "speed", mean_abs_error_after: speedError },
      { axis: "impact", mean_abs_error_after: 0.2 },
    ],
    distortion: { mean_abs_delta: distortionMeanAbsDelta },
  };
}

describe("calibration objective scoring", () => {
  test("global objective is the compiler score", () => {
    expect(calibrationObjectiveScore({ kind: "global-score" }, objectiveInput(456, 0.1))).toBe(456);
  });

  test("weighted objective can rank by selected axis fit", () => {
    const objective = { kind: "weighted", score: 0, axes: { speed: 1 } } as const;
    const lowSpeedError = calibrationObjectiveScore(objective, objectiveInput(100, 0.02));
    const highSpeedError = calibrationObjectiveScore(objective, objectiveInput(900, 0.6));

    expect(lowSpeedError).toBeGreaterThan(highSpeedError);
  });

  test("weighted objective subtracts distortion penalty", () => {
    const objective = { kind: "weighted", score: 1, distortionPenalty: 1 } as const;
    const unchanged = calibrationObjectiveScore(objective, objectiveInput(500, 0.1, 0));
    const distorted = calibrationObjectiveScore(objective, objectiveInput(500, 0.1, 0.2));

    expect(unchanged - distorted).toBeCloseTo(200);
  });
});

describe("calibration seed parsing", () => {
  test("dedupes and sorts explicit seeds", () => {
    expect(parseSeeds("4,2,4")).toEqual([2, 4]);
  });

  test("rejects empty seed entries before numeric coercion", () => {
    expect(() => parseSeeds("4,5,")).toThrow(/comma-separated/);
    expect(() => parseSeeds("4,,5")).toThrow(/comma-separated/);
  });
});
