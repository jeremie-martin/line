import { describe, expect, test } from "vitest";
import {
  assertScaleArguments,
  assertScaleCommandArguments,
  scaleBreadthPolicyArgument,
} from "../scripts/v0/benchmark_v2/scale_benchmark.ts";

describe("Benchmark V2 scale command contract", () => {
  test("accepts only the baseline execution surface", () => {
    expect(() => assertScaleArguments("baseline", [
      "--seeds=16",
      "--out=generated/reference.json",
      "--jobs=8",
      "--budget-telemetry=trace",
      "--label=current",
      "--resume",
    ])).not.toThrow();
    expect(() => assertScaleArguments("baseline", ["--baseline=old.json"]))
      .toThrow(/does not accept/);
  });

  test("keeps evaluation and read-only comparison arguments distinct", () => {
    expect(() => assertScaleArguments("eval", [
      "--baseline=reference.json",
      "--seeds=8",
      "--out=candidate.json",
      "--artifact=comparison.json",
      "--resume",
      "--json",
      "--extend-from=candidate-4.json",
      "--breadth-policy=high-budget-three-quarter",
    ])).not.toThrow();
    expect(() => assertScaleArguments("compare", [
      "--baseline=reference.json",
      "--candidate=candidate.json",
      "--artifact=comparison.json",
      "--json",
    ])).not.toThrow();
    expect(() => assertScaleArguments("compare", ["--resume"]))
      .toThrow(/does not accept/);
    expect(() => assertScaleArguments("eval", ["--seeds=8", "--search-policy-budget=750000"]))
      .toThrow(/does not accept/);
    expect(() => assertScaleArguments("eval", ["--breadth-policy=unknown"]))
      .toThrow(/breadth-policy must be/);
    expect(() => assertScaleArguments("eval", ["--repair-mode=multi-terminal"]))
      .toThrow(/does not accept/);
  });

  test("validates the subcommand before the runner prepares benchmark inputs", () => {
    expect(() => assertScaleCommandArguments(["eval", "--baseline=reference.json", "--seeds=8"]))
      .not.toThrow();
    expect(() => assertScaleCommandArguments(["unknown", "--seeds=8"]))
      .toThrow(/baseline\|eval\|compare/);
    expect(() => assertScaleCommandArguments(["eval", "--typo=8"]))
      .toThrow(/does not accept/);
  });

  test("resolves the candidate breadth intervention passed to scale eval", () => {
    expect(scaleBreadthPolicyArgument([])).toBeNull();
    expect(scaleBreadthPolicyArgument(["--breadth-policy=high-budget-three-quarter"]))
      .toBe("high-budget-three-quarter");
    expect(scaleBreadthPolicyArgument(["--breadth-policy=linear-cap-216"]))
      .toBe("linear-cap-216");
    expect(scaleBreadthPolicyArgument(["--breadth-policy=repair-high-budget-three-quarter"]))
      .toBe("repair-high-budget-three-quarter");
  });
});
