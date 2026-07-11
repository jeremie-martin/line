import { describe, expect, test } from "vitest";
import {
  buildWorkerTasks,
  partialRunSummary,
  validateSubsetFlags,
} from "../scripts/v0/benchmark_v2/runner.ts";
import type { ResolvedSeedSchedule } from "../scripts/v0/benchmark_v2/suite_model.ts";

const schedule: ResolvedSeedSchedule = {
  kind: "profile_budget_disjoint_contiguous",
  profile: "canonical",
  seedBase: 200,
  seedsPerBudget: 3,
  byBudget: [
    { budget: 250_000, actualSeeds: [200, 201, 202] },
    { budget: 500_000, actualSeeds: [203, 204, 205] },
  ],
};
const sources = [{ id: "case-a" }, { id: "case-b" }];
const manifests = {
  sourceManifestPath: "/machine/local/source-manifest.json",
  heldoutManifestPath: "/machine/local/heldout-manifest.json",
};

describe("buildWorkerTasks", () => {
  test("builds the full budget x seed x source cross product with ascending seed slots", () => {
    const tasks = buildWorkerTasks(schedule, sources, "development", 50, manifests);
    expect(tasks.length).toBe(2 * 3 * 2);

    // Every seed slot is populated per budget, in ascending order.
    for (const { budget, actualSeeds } of schedule.byBudget) {
      const forBudget = tasks.filter((task) => task.budget === budget);
      expect(forBudget.map((task) => task.seedSlot)).toEqual([0, 0, 1, 1, 2, 2]);
      // actualSeed follows the schedule slot mapping for this budget.
      for (const task of forBudget) {
        expect(task.actualSeed).toBe(actualSeeds[task.seedSlot]);
      }
    }

    // Every field of a representative task is threaded through unchanged.
    expect(tasks[0]).toEqual({
      mode: "development",
      sourceId: "case-a",
      budget: 250_000,
      seedSlot: 0,
      actualSeed: 200,
      joltMs: 50,
      sourceManifestPath: manifests.sourceManifestPath,
      heldoutManifestPath: manifests.heldoutManifestPath,
    });
  });

  test("a prefix filter keeps exactly seed slots [0, k) for every budget", () => {
    const tasks = buildWorkerTasks(schedule, sources, "development", 50, manifests, 2);
    expect(tasks.length).toBe(2 * 2 * 2);
    expect(new Set(tasks.map((task) => task.seedSlot))).toEqual(new Set([0, 1]));
    for (const { budget, actualSeeds } of schedule.byBudget) {
      const forBudget = tasks.filter((task) => task.budget === budget);
      expect(forBudget.map((task) => task.seedSlot)).toEqual([0, 0, 1, 1]);
      expect(forBudget.every((task) => task.actualSeed === actualSeeds[task.seedSlot])).toBe(true);
    }
  });

  test("k equal to the declared depth is identical to no filter", () => {
    const full = buildWorkerTasks(schedule, sources, "development", 50, manifests);
    const throughAll = buildWorkerTasks(schedule, sources, "development", 50, manifests, 3);
    expect(throughAll).toEqual(full);
  });

  test("k = 1 keeps only the first seed slot", () => {
    const tasks = buildWorkerTasks(schedule, sources, "qualification", 50, manifests, 1);
    expect(tasks.length).toBe(2 * 1 * 2);
    expect(tasks.every((task) => task.seedSlot === 0)).toBe(true);
    expect(tasks.every((task) => task.mode === "qualification")).toBe(true);
  });
});

describe("partialRunSummary", () => {
  test("maps every field and stamps the partial-run schema", () => {
    const summary = partialRunSummary({
      mode: "development",
      profile: "canonical",
      throughSeedSlot: 2,
      seedsPerBudget: 6,
      totalDeclaredTasks: 72,
      completedTasks: 24,
      workerFailures: 1,
      runPlanFingerprint: "f".repeat(64),
      checkpoint: "generated/benchmark-v2/development-canonical.json.checkpoint.jsonl",
    });
    expect(summary).toEqual({
      schema: "line.benchmark-v2.partial-run.v1",
      mode: "development",
      profile: "canonical",
      throughSeedSlot: 2,
      seedsPerBudget: 6,
      totalDeclaredTasks: 72,
      completedTasks: 24,
      workerFailures: 1,
      runPlanFingerprint: "f".repeat(64),
      checkpoint: "generated/benchmark-v2/development-canonical.json.checkpoint.jsonl",
    });
  });
});

describe("validateSubsetFlags", () => {
  test("no wave flags is always a no-op, even on the probe profile", () => {
    expect(() => validateSubsetFlags({
      profileName: "probe",
      hasDeclaration: false,
      seedsPerBudget: undefined,
      throughSeedSlot: undefined,
      effectiveDepth: 3,
    })).not.toThrow();
  });

  test("the probe profile may not use the wave flags", () => {
    expect(() => validateSubsetFlags({
      profileName: "probe",
      hasDeclaration: true,
      seedsPerBudget: 6,
      throughSeedSlot: 2,
      effectiveDepth: 6,
    })).toThrow(/reserved for a predeclared canonical confirmation/);
  });

  test("a missing confirmation declaration is refused", () => {
    expect(() => validateSubsetFlags({
      profileName: "canonical",
      hasDeclaration: false,
      seedsPerBudget: undefined,
      throughSeedSlot: 2,
      effectiveDepth: 6,
    })).toThrow(/reserved for a predeclared canonical confirmation/);
  });

  test("a through-slot deeper than the effective depth is refused", () => {
    expect(() => validateSubsetFlags({
      profileName: "canonical",
      hasDeclaration: true,
      seedsPerBudget: undefined,
      throughSeedSlot: 7,
      effectiveDepth: 6,
    })).toThrow(/exceeds seeds-per-budget=6/);
  });

  test("a through-slot equal to the effective depth is allowed (the final wave)", () => {
    expect(() => validateSubsetFlags({
      profileName: "canonical",
      hasDeclaration: true,
      seedsPerBudget: 6,
      throughSeedSlot: 6,
      effectiveDepth: 6,
    })).not.toThrow();
  });

  test("non-integer and zero depths are refused", () => {
    expect(() => validateSubsetFlags({
      profileName: "canonical",
      hasDeclaration: true,
      seedsPerBudget: 0,
      throughSeedSlot: undefined,
      effectiveDepth: 0,
    })).toThrow(/seeds-per-budget must be a positive integer/);
    expect(() => validateSubsetFlags({
      profileName: "canonical",
      hasDeclaration: true,
      seedsPerBudget: Number.NaN,
      throughSeedSlot: undefined,
      effectiveDepth: Number.NaN,
    })).toThrow(/seeds-per-budget must be a positive integer/);
    expect(() => validateSubsetFlags({
      profileName: "canonical",
      hasDeclaration: true,
      seedsPerBudget: undefined,
      throughSeedSlot: 1.5,
      effectiveDepth: 6,
    })).toThrow(/through-seed-slot must be a positive integer/);
    expect(() => validateSubsetFlags({
      profileName: "canonical",
      hasDeclaration: true,
      seedsPerBudget: undefined,
      throughSeedSlot: 0,
      effectiveDepth: 6,
    })).toThrow(/through-seed-slot must be a positive integer/);
  });
});
