import { describe, expect, test } from "vitest";
import { assertEvalArguments, evalWorkerFailurePayload } from "../scripts/v0/benchmark_v2/eval.ts";

describe("lean eval argument contract", () => {
  test("accepts the active default and explicit output controls", () => {
    expect(() => assertEvalArguments([])).not.toThrow();
    expect(() => assertEvalArguments(["--out=generated/small.json", "--jobs=48"])).not.toThrow();
    expect(() => assertEvalArguments(["--base=probe.json"])).toThrow(/does not accept/);
    expect(() => assertEvalArguments(["--archive-dir=generated/evidence"])).toThrow(/does not accept/);
  });

  test("keeps explicit fixed-N syntax for a non-campaign baseline", () => {
    expect(() => assertEvalArguments(["--seeds=100", "--jobs=48"])).not.toThrow();
    expect(() => assertEvalArguments(["--to-verdict", "--seeds=37"])).toThrow(/does not accept/);
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
