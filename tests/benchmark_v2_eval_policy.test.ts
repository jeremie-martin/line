import { describe, expect, test } from "vitest";
import { assertEvalArguments, evalWorkerFailurePayload } from "../scripts/v0/benchmark_v2/eval.ts";

describe("lean eval argument contract", () => {
  test("defaults to the smallest canonical cached comparison", () => {
    expect(() => assertEvalArguments([])).not.toThrow();
    expect(() => assertEvalArguments(["--out=generated/small.json", "--jobs=48"])).not.toThrow();
    expect(() => assertEvalArguments(["--base=probe.json"])).toThrow(/does not accept/);
    expect(() => assertEvalArguments(["--archive-dir=generated/evidence"])).toThrow(/does not accept/);
  });

  test("accepts arbitrary fixed-N comparisons without a formal mode", () => {
    expect(() => assertEvalArguments(["--seeds=100", "--jobs=48"])).not.toThrow();
    expect(() => assertEvalArguments(["--to-verdict", "--seeds=37"])).not.toThrow();
    expect(() => assertEvalArguments(["--to-verdict"])).toThrow(/no longer a separate workflow/);
    expect(() => assertEvalArguments(["--seeds=100", "--depth=100"])).toThrow(/does not accept/);
  });

  test("requires values and rejects old accounting flags", () => {
    expect(() => assertEvalArguments(["--seeds"])).toThrow();
    expect(() => assertEvalArguments(["--seeds=100", "--override-era-budget=0.1"])).toThrow(/does not accept/);
    expect(() => assertEvalArguments(["--abort-in-flight"])).toThrow(/does not accept/);
  });

  test("worker failure payload is stateless and actionable", () => {
    expect(evalWorkerFailurePayload({
      stage: "cached",
      reason: "worker failed",
      workerFailures: 1,
      evidencePaths: ["run.checkpoint.jsonl"],
      nextCommand: "benchmark eval --seeds=100 --resume",
    })).toEqual({
      schema: "line.benchmark-v2.eval-failure.v2",
      status: "invalid",
      stage: "cached",
      reason: "worker failed",
      workerFailures: 1,
      evidencePaths: ["run.checkpoint.jsonl"],
      nextCommand: "benchmark eval --seeds=100 --resume",
    });
  });
});
