import { describe, expect, test } from "vitest";
import {
  benchmarkStatus,
  renderBenchmarkStatus,
} from "../scripts/v0/benchmark_v2/status.ts";

describe("Benchmark V2 status", () => {
  /*
   * Coverage is read from the status itself rather than hardcoded. A baseline
   * may be frozen at any depth and extended on demand, so a fixed slot count
   * would assert a property of one particular baseline instead of the reporting
   * behaviour these tests exist to protect: that candidate work depends only on
   * N, that missing baseline work is accounted exactly, and that the suggested
   * command matches whichever of the two states the cache is in.
   */
  test("reports the fixed N=48 750k campaign without accounting state", () => {
    const status = benchmarkStatus();
    expect(status.schema).toBe("line.benchmark-v2.status.v3");
    expect(status.cache).toMatchObject({
      requestedSeeds: 48,
      coverageSeeds: 48,
      ready: true,
      candidateCompiles: 2_112,
    });
    expect(status.baseline.headline).toBe(593.5031);
    expect(status.baseline.budgets).toEqual([750_000]);
    expect(status.baseline.targetHeadline).toBe(650);
    expect(status.cache.missingBaselineCompiles).toBe(0);
    expect((status as any).era).toBeUndefined();
    expect(status.comparisonReady).toBe(true);
    expect(status.nextCommand).toBe("npm run benchmark -- eval --seeds=48");
  });

  test("human output leads with cache work and a runnable command", () => {
    const status = benchmarkStatus();
    const text = renderBenchmarkStatus(status);
    expect(text).toContain("cached comparison N=48");
    expect(text).toContain("2112 candidate compiles");
    expect(text).toContain("593.50; 750k");
    expect(text).toContain("campaign target: >650.00");
    expect(text).toContain(`nextCommand: ${status.nextCommand}`);
    expect(status.nextCommand).toMatch(/^npm run benchmark -- /);
    expect(text).not.toContain("budget spent");
  });

  test("keeps the frozen full ladder explicitly inspectable", () => {
    const status = benchmarkStatus(100, "benchmark/v2/baseline.json");
    expect(status.baseline.budgets).toEqual([250_000, 500_000, 750_000]);
    expect(status.cache.candidateCompiles).toBe(13_200);
    expect(status.nextCommand).toContain("--baseline=benchmark/v2/baseline.json");
  });

  test("refuses lower-depth probes on the active campaign", () => {
    expect(() => benchmarkStatus(4)).toThrow(/uses N=48 only/);
  });
});
