import { describe, expect, test } from "vitest";
import {
  assertScaleArguments,
  assertScaleCommandArguments,
  scaleAimImpactPowerArgument,
  scaleAimImpactResolutionPolicyArgument,
  scaleAimTopKExponentArgument,
  scaleAimTopKFirstRepairExtraArgument,
  scaleAimTopKScopeArgument,
  scaleBreadthPolicyArgument,
  scaleRepairPolicyArgument,
  scaleRepairSelectionPolicyArgument,
  scaleRepairSuffixSearchPolicyArgument,
  reusableScaleComparisonSnapshot,
} from "../scripts/v0/benchmark_v2/scale_benchmark.ts";

describe("Benchmark V2 scale command contract", () => {
  test("preserves a frozen candidate snapshot across analysis-only compare", () => {
    const snapshot = { schema: "line.benchmark-v2.compiler-snapshot.v1", archive: "frozen.tgz" };
    const prior = {
      schema: "line.benchmark-v2.multi-budget-comparison.v2",
      candidate: { archivePath: "candidate.json", compilerSnapshot: snapshot },
    };
    expect(reusableScaleComparisonSnapshot(prior, "candidate.json")).toBe(snapshot);
    expect(reusableScaleComparisonSnapshot(prior, "other.json")).toBeNull();
    expect(reusableScaleComparisonSnapshot({ ...prior, candidate: {
      ...prior.candidate,
      compilerSnapshot: null,
    } }, "candidate.json")).toBeNull();
  });

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
      "--repair-suffix-search-policy=target-improvement-first",
      "--aim-impact-power=1.25",
      "--aim-impact-resolution-policy=validated-mae-top1",
      "--aim-topk-exponent=0.875",
      "--aim-topk-scope=repair",
      "--aim-topk-first-repair-extra=1",
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
    expect(() => assertScaleArguments("eval", ["--repair-suffix-search-policy=unknown"]))
      .toThrow(/repair-suffix-search-policy must be/);
    expect(() => assertScaleArguments("eval", ["--aim-impact-power=0.1"]))
      .toThrow(/aim-impact-power must be/);
    expect(() => assertScaleArguments("eval", ["--aim-impact-resolution-policy=unknown"]))
      .toThrow(/aim-impact-resolution-policy must be/);
    expect(() => assertScaleArguments("eval", ["--aim-topk-exponent=2.1"]))
      .toThrow(/aim-topk-exponent must be/);
    expect(() => assertScaleArguments("eval", ["--aim-topk-scope=resumed"]))
      .toThrow(/aim-topk-scope must be/);
    expect(() => assertScaleArguments("eval", ["--aim-topk-scope=repair"]))
      .toThrow(/requires --aim-topk-exponent/);
    expect(() => assertScaleArguments("eval", ["--aim-topk-first-repair-extra=1.5"]))
      .toThrow(/integer/);
    expect(() => assertScaleArguments("eval", ["--aim-topk-first-repair-extra=9"]))
      .toThrow(/integer/);
    expect(() => assertScaleArguments("eval", ["--repair-mode=multi-terminal"]))
      .toThrow(/does not accept/);
  });

  test("resolves the aim impact strength passed to scale eval", () => {
    expect(scaleAimImpactPowerArgument([])).toBeNull();
    expect(scaleAimImpactPowerArgument(["--aim-impact-power=0.75"])).toBe(0.75);
    expect(scaleAimImpactPowerArgument(["--aim-impact-power=1.25"])).toBe(1.25);
  });

  test("resolves the aim impact resolution policy passed to scale eval", () => {
    expect(scaleAimImpactResolutionPolicyArgument([])).toBeNull();
    expect(scaleAimImpactResolutionPolicyArgument([
      "--aim-impact-resolution-policy=validated-mae-top1",
    ])).toBe("validated-mae-top1");
  });

  test("resolves the aim top-K exponent passed to scale eval", () => {
    expect(scaleAimTopKExponentArgument([])).toBeNull();
    expect(scaleAimTopKExponentArgument(["--aim-topk-exponent=0.875"])).toBe(0.875);
  });

  test("resolves the aim top-K study scope passed to scale eval", () => {
    expect(scaleAimTopKScopeArgument([])).toBeNull();
    expect(scaleAimTopKScopeArgument(["--aim-topk-scope=repair"])).toBe("repair");
  });

  test("resolves the first-repair aim top-K increment passed to scale eval", () => {
    expect(scaleAimTopKFirstRepairExtraArgument([])).toBeNull();
    expect(scaleAimTopKFirstRepairExtraArgument(["--aim-topk-first-repair-extra=1"]))
      .toBe(1);
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
    expect(scaleBreadthPolicyArgument(["--breadth-policy=late-repair-seven-eighth"]))
      .toBe("late-repair-seven-eighth");
    expect(scaleBreadthPolicyArgument([
      "--breadth-policy=repair-descendants-three-quarter",
    ])).toBe("repair-descendants-three-quarter");
    expect(scaleBreadthPolicyArgument([
      "--breadth-policy=repair-descendants-three-quarter-stable-planning",
    ])).toBe("repair-descendants-three-quarter-stable-planning");
    expect(scaleBreadthPolicyArgument([
      "--breadth-policy=repair-post-target-three-quarter",
    ])).toBe("repair-post-target-three-quarter");
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
      "--repair-selection-policy=three-quarter-last-chance",
    ])).toBe("three-quarter-last-chance");
    expect(scaleRepairSelectionPolicyArgument([
      "--repair-selection-policy=reserve-cheapest-repair",
    ])).toBe("reserve-cheapest-repair");
    expect(scaleRepairSelectionPolicyArgument([
      "--repair-selection-policy=reserve-cheapest-else-deepest",
    ])).toBe("reserve-cheapest-else-deepest");
    expect(scaleRepairSelectionPolicyArgument([
      "--repair-selection-policy=late-reserve-cheapest-else-deepest",
    ])).toBe("late-reserve-cheapest-else-deepest");
    expect(scaleRepairSelectionPolicyArgument([
      "--repair-selection-policy=worst-target-window-per-cost",
    ])).toBe("worst-target-window-per-cost");
    expect(scaleRepairSelectionPolicyArgument([
      "--repair-selection-policy=worst-target-runway-per-cost",
    ])).toBe("worst-target-runway-per-cost");
  });

  test("resolves the repair suffix-search intervention passed to scale eval", () => {
    expect(scaleRepairSuffixSearchPolicyArgument([])).toBeNull();
    expect(scaleRepairSuffixSearchPolicyArgument([
      "--repair-suffix-search-policy=target-improvement-first",
    ])).toBe("target-improvement-first");
  });
});
