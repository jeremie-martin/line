import { describe, expect, test } from "vitest";
import {
  benchmarkStatus,
  renderBenchmarkStatus,
} from "../scripts/v0/benchmark_v2/status.ts";

describe("Benchmark V2 status", () => {
  test("reports an arbitrary cached comparison without accounting state", () => {
    const status = benchmarkStatus(100);
    expect(status.schema).toBe("line.benchmark-v2.status.v2");
    expect(status.cache).toMatchObject({
      requestedSeeds: 100,
      coverageSeeds: 100,
      ready: true,
      missingBaselineCompiles: 0,
    });
    expect(status.cache.candidateCompiles).toBe(13_200);
    expect((status as any).era).toBeUndefined();
    expect(status.comparisonReady).toBe(true);
    expect(status.nextCommand).toBe("npm run benchmark -- eval --seeds=100");
  });

  test("human output leads with cache work and a runnable command", () => {
    const text = renderBenchmarkStatus(benchmarkStatus(37));
    expect(text).toContain("cached comparison N=37");
    expect(text).toContain("4884 candidate compiles");
    expect(text).toContain("nextCommand: npm run benchmark -- eval --seeds=37");
    expect(text).not.toContain("budget spent");
  });
});
