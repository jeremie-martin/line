import { describe, expect, test } from "vitest";
import {
  assertScaleArguments,
  assertScaleCommandArguments,
  scaleBreadthPolicyArgument,
  scaleRepairPolicyArgument,
  scaleRepairSelectionPolicyArgument,
} from "../scripts/v0/benchmark_v2/scale_benchmark.ts";

describe("Benchmark V2 scale command contract", () => {
  test("accepts only the baseline execution surface", () => {
    expect(() => assertScaleArguments("baseline", [
      "--seeds=16",
      "--out=generated/reference.json",
      "--jobs=8",
      "--budget-telemetry=trace",
      "--label=current",
      "--extend-from=reference-8.json",
    ])).not.toThrow();
    expect(() => assertScaleArguments("baseline", [
      "--seeds=16",
      "--out=generated/reference.json",
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
      "--extend-snapshot=candidate-4-comparison.json",
      "--breadth-policy=high-budget-three-quarter",
      "--repair-policy=protected-one-step-bridge",
      "--repair-selection-policy=reserve-cheapest-repair",
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
    expect(() => assertScaleArguments("eval", ["--repair-policy=unknown"]))
      .toThrow(/repair-policy must be/);
    expect(() => assertScaleArguments("eval", ["--repair-selection-policy=unknown"]))
      .toThrow(/repair-selection-policy must be/);
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
    expect(scaleBreadthPolicyArgument(["--breadth-policy=repair-three-quarter"]))
      .toBe("repair-three-quarter");
    expect(scaleBreadthPolicyArgument(["--breadth-policy=repair-seven-eighth"]))
      .toBe("repair-seven-eighth");
  });

  test("resolves the candidate repair intervention passed to scale eval", () => {
    expect(scaleRepairPolicyArgument([])).toBeNull();
    expect(scaleRepairPolicyArgument(["--repair-policy=protected-one-step-bridge"]))
      .toBe("protected-one-step-bridge");
    expect(scaleRepairPolicyArgument(["--repair-policy=optimistic-axis-bound-bridge"]))
      .toBe("optimistic-axis-bound-bridge");
  });

  test("resolves the candidate repair-selection intervention passed to scale eval", () => {
    expect(scaleRepairSelectionPolicyArgument([])).toBeNull();
    expect(scaleRepairSelectionPolicyArgument([
      "--repair-selection-policy=reserve-cheapest-repair",
    ])).toBe("reserve-cheapest-repair");
    expect(scaleRepairSelectionPolicyArgument([
      "--repair-selection-policy=reserve-cheapest-else-deepest",
    ])).toBe("reserve-cheapest-else-deepest");
  });
});
