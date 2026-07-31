import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { benchmarkSequentialEvalPolicy } from "../benchmark/v2/eval-policy.ts";
import type { DecisionRun } from "../scripts/v0/benchmark_v2/decision_model.ts";
import { loadSourceManifest, resolveSources } from "../scripts/v0/benchmark_v2/model.ts";
import {
  loadRoundProgressReference,
  renderRoundProgress,
  roundProgressLog,
  RoundProgressAccumulator,
  ROUND_PROGRESS_REFERENCE_SCHEMA,
  validateRoundProgressReference,
  type RoundProgressReference,
} from "../scripts/v0/benchmark_v2/round_progress.ts";
import { buildWorkerTasks } from "../scripts/v0/benchmark_v2/runner.ts";
import {
  canonicalMembers,
  loadSuiteManifest,
} from "../scripts/v0/benchmark_v2/suite_model.ts";

const temporaryDirectories: string[] = [];
afterAll(() => {
  for (const path of temporaryDirectories) rmSync(path, { recursive: true, force: true });
});

const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
const suite = loadSuiteManifest("benchmark/v2/compat/suite-manifest.json", sources);
const sourceIds = canonicalMembers(suite);
const budget = 750_000;
const depth = 8;

function rows(score: number): DecisionRun[] {
  return Array.from({ length: depth }, (_, seedSlot) => sourceIds.map((sourceId) => ({
    sourceId,
    budget,
    seedSlot,
    actualSeed: 16 + seedSlot,
    score: { score, valid: true },
  }))).flat();
}

function reference(): RoundProgressReference {
  return {
    schema: ROUND_PROGRESS_REFERENCE_SCHEMA,
    authority: "diagnostic-only",
    baseline: {
      label: "baseline",
      candidateFingerprint: "a".repeat(64),
      cacheFingerprint: "b".repeat(64),
    },
    candidateFingerprint: "c".repeat(64),
    suiteFingerprint: "d".repeat(64),
    seedScheduleFingerprint: "e".repeat(64),
    maximumDepth: benchmarkSequentialEvalPolicy.maximumDepth,
    throughDepth: depth,
    looks: [...benchmarkSequentialEvalPolicy.looks],
    boundaryConstant: 1.96392337,
    budgets: [budget],
    sources: [...sourceIds],
    runs: rows(500),
  };
}

const expectation = {
  candidateFingerprint: "c".repeat(64),
  suiteFingerprint: "d".repeat(64),
  seedScheduleFingerprint: "e".repeat(64),
  maximumDepth: benchmarkSequentialEvalPolicy.maximumDepth,
  throughDepth: depth,
  budgets: [budget],
  sources: sourceIds,
};

describe("Benchmark V2 round progress", () => {
  test("queues a complete source cross-product for each seed before the next seed", () => {
    const tasks = buildWorkerTasks(
      {
        kind: "profile_budget_disjoint_contiguous",
        profile: "canonical",
        seedBase: 0,
        seedsPerBudget: 2,
        byBudget: [{ budget, actualSeeds: [16, 17] }],
      },
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      "development",
      0,
      { sourceManifestPath: "source", heldoutManifestPath: "heldout" },
    );
    expect(tasks.map((task) => `${task.seedSlot}/${task.sourceId}`)).toEqual([
      "0/a", "0/b", "0/c", "1/a", "1/b", "1/c",
    ]);
  });

  test("waits for contiguous complete seed blocks regardless of worker completion order", () => {
    const candidate = rows(500.5);
    const slotOne = candidate.filter((run) => run.seedSlot === 1);
    const accumulator = new RoundProgressAccumulator(reference(), suite, slotOne);
    expect(accumulator.completedDepth).toBe(0);
    expect(accumulator.restoredEvents).toEqual([]);

    let emitted = [] as ReturnType<RoundProgressAccumulator["record"]>;
    for (const run of candidate.filter((row) => row.seedSlot === 0)) emitted = accumulator.record(run);
    expect(emitted.map((event) => event.depth)).toEqual([1, 2]);
    expect(accumulator.completedDepth).toBe(2);
    expect(emitted[1].cumulative).toMatchObject({
      delta: 0.5,
      standardError: 0,
      directionalProbability: 1,
    });
  });

  test("reports the exact observed probability and marks only a predeclared look", () => {
    const accumulator = new RoundProgressAccumulator(reference(), suite, rows(500.5));
    const events = accumulator.allEvents();
    expect(events).toHaveLength(8);
    expect(events.slice(0, 7).every((event) => event.look === null)).toBe(true);
    expect(events[7].look).toMatchObject({
      depth: 8,
      directionalProbability: 1,
      action: "accept",
    });
    const line = renderRoundProgress(events[7], {
      waveDepth: 8,
      workerFailures: 0,
      rate: 1.5,
      etaSeconds: 0,
    });
    expect(line).toContain("round 8/8 seed 23");
    expect(line).toContain("round Δ +0.50");
    expect(line).toContain("P+ 100.00%");
    expect(line).toContain("LOOK accept");

    const log = roundProgressLog(reference(), events);
    const entries = log.trim().split("\n").map((line) => JSON.parse(line));
    expect(entries[0]).toMatchObject({
      schema: "line.benchmark-v2.round-progress-log.v1",
      authority: "diagnostic-only",
    });
    expect(entries.slice(1).map((entry) => entry.depth)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test("checksum-binds and validates the diagnostic baseline reference", () => {
    validateRoundProgressReference(reference(), suite, expectation);
    expect(() => validateRoundProgressReference(reference(), suite, {
      ...expectation,
      candidateFingerprint: "f".repeat(64),
    })).toThrow(/does not match/);

    const directory = mkdtempSync(join(tmpdir(), "line-round-progress-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "reference.json");
    const bytes = `${JSON.stringify(reference(), null, 2)}\n`;
    writeFileSync(path, bytes);
    writeFileSync(
      `${path}.sha256`,
      `${createHash("sha256").update(bytes).digest("hex")}  ${path}\n`,
    );
    expect(loadRoundProgressReference(path, suite, expectation).runs).toHaveLength(44 * 8);

    writeFileSync(path, `${readFileSync(path, "utf8")} `);
    expect(() => loadRoundProgressReference(path, suite, expectation)).toThrow(/checksum/);
  });
});
