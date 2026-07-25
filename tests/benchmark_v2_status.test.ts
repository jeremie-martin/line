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
  test("reports an arbitrary cached comparison without accounting state", () => {
    const status = benchmarkStatus(100);
    expect(status.schema).toBe("line.benchmark-v2.status.v2");
    const covered = status.cache.coverageSeeds;
    expect(status.cache).toMatchObject({
      requestedSeeds: 100,
      ready: covered >= 100,
    });
    // Candidate work is independent of what the cache holds.
    expect(status.cache.candidateCompiles).toBe(13_200);
    // ... and missing baseline work is exactly the uncovered prefix.
    expect(status.cache.missingBaselineCompiles).toBe(
      Math.max(0, 100 - covered) * (13_200 / 100),
    );
    expect((status as any).era).toBeUndefined();
    expect(status.comparisonReady).toBe(true);
    expect(status.nextCommand).toBe(
      covered >= 100
        ? "npm run benchmark -- eval --seeds=100"
        : "npm run benchmark -- baseline-cache extend --seeds=100",
    );
  });

  test("human output leads with cache work and a runnable command", () => {
    const status = benchmarkStatus(37);
    const text = renderBenchmarkStatus(status);
    expect(text).toContain("cached comparison N=37");
    expect(text).toContain("4884 candidate compiles");
    expect(text).toContain(`nextCommand: ${status.nextCommand}`);
    expect(status.nextCommand).toMatch(/^npm run benchmark -- /);
    expect(text).not.toContain("budget spent");
  });
});
