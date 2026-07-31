import { describe, expect, test } from "vitest";
import { benchmarkSequentialEvalPolicy } from "../benchmark/v2/eval-policy.ts";
import {
  referenceTDirectionalProbability,
  requireSequentialEvalCalibration,
  sequentialLookDecision,
  sequentialRequiredT,
} from "../scripts/v0/benchmark_v2/sequential_inference.ts";
import type { ConfidenceBounds } from "../scripts/v0/benchmark_v2/decision_model.ts";

function confidence(estimate: number, standardError: number, df = 47): ConfidenceBounds {
  return {
    available: true,
    estimate,
    standardError,
    degreesOfFreedom: df,
    centralLevel: 0.95,
    centralCriticalLevel: 0.99,
    centralLo: estimate - 2 * standardError,
    centralHi: estimate + 2 * standardError,
    oneSidedLevel: 0.95,
    oneSidedCriticalLevel: 0.99,
    lowerBound: estimate - 2.5 * standardError,
    upperBound: estimate + 2.5 * standardError,
  };
}

describe("sequential Benchmark V2 inference", () => {
  test("loads the scorer-bound calibration and its independent safety bars", () => {
    const calibration = requireSequentialEvalCalibration(
      "7bd878d8aaea08a92c112bf1e1f5869b1583aebb84593e6f268f7ec2576d7849",
    );
    expect(calibration.boundaryConstant).toBe(1.96392337);
    expect(calibration.calibration.allBarsMet).toBe(true);
    expect(calibration.validation.allBarsMet).toBe(true);
    expect(benchmarkSequentialEvalPolicy.totalAlpha).toBe(0.05);
    expect(benchmarkSequentialEvalPolicy.predictiveFutility).toBe(false);
  });

  test("derives every look from one O'Brien-Fleming constant", () => {
    const required = benchmarkSequentialEvalPolicy.looks.map((look) => sequentialRequiredT(look, 1.7));
    expect(required).toEqual([...required].sort((a, b) => b - a));
    expect(required.at(-1)).toBeCloseTo(1.7);
  });

  test("accepts and rejects symmetrically, otherwise continues", () => {
    expect(sequentialLookDecision(confidence(5, 1, 7), 8, 1.7).action).toBe("accept");
    expect(sequentialLookDecision(confidence(-5, 1, 7), 8, 1.7).action).toBe("reject");
    expect(sequentialLookDecision(confidence(0.2, 1, 7), 8, 1.7).action).toBe("continue");
    expect(sequentialLookDecision(confidence(0.2, 1), 48, 1.7).action).toBe("inconclusive");
  });

  test("uses strict boundary crossing and handles deterministic deltas", () => {
    const boundary = sequentialRequiredT(16, 1.7);
    expect(sequentialLookDecision(confidence(boundary, 1, 15), 16, 1.7).action).toBe("accept");
    expect(referenceTDirectionalProbability(confidence(1, 0))).toBe(1);
    expect(referenceTDirectionalProbability(confidence(-1, 0))).toBe(0);
    expect(referenceTDirectionalProbability(confidence(0, 0))).toBe(0.5);
  });

  test("rejects undeclared looks", () => {
    expect(() => sequentialRequiredT(12, 1.7)).toThrow(/not a declared sequential look/);
  });
});
