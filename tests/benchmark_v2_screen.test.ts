import { describe, expect, test } from "vitest";
import { aggregateScreenRuns, type ScreenRun } from "../scripts/v0/benchmark_v2/screen_model.ts";

describe("Benchmark V2 development screen aggregation", () => {
  test("groups by source and budget without hiding errors", () => {
    const runs: ScreenRun[] = [
      {
        sourceId: "a",
        budget: 75_000,
        seed: 0,
        status: "ok",
        elapsedMs: 100,
        score: 600,
        axisErrorRms: 0.2,
        contacts: {
          authoredTotal: 10,
          reportedTotal: 10,
          hit: 9,
          drift: 0,
          reportedMissing: 1,
          missingAuthored: 1,
          offBeat: 2,
        },
      },
      {
        sourceId: "a",
        budget: 75_000,
        seed: 1,
        status: "ok",
        elapsedMs: 140,
        score: 700,
        axisErrorRms: 0.1,
        contacts: {
          authoredTotal: 10,
          reportedTotal: 10,
          hit: 10,
          drift: 0,
          reportedMissing: 0,
          missingAuthored: 0,
          offBeat: 0,
        },
      },
      { sourceId: "a", budget: 75_000, seed: 2, status: "error", elapsedMs: 10, error: "x" },
    ];
    const [aggregate] = aggregateScreenRuns(runs);
    expect(aggregate.runs).toBe(3);
    expect(aggregate.errors).toBe(1);
    expect(aggregate.score.mean).toBe(650);
    expect(aggregate.hitRate.mean).toBe(0.95);
    expect(aggregate.elapsedMs.mean).toBe(120);
    expect(aggregate.endOfSpecRate.mean).toBe(0);
    expect(aggregate.axisMeanAbsoluteError).toEqual({});
  });
});
