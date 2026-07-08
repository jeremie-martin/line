import { describe, expect, test } from "vitest";
import {
  defaultJobsForParallelism,
  parseArgValue,
  resolveGoldenRunConfig,
  summarizeBudgets,
} from "../scripts/v0/golden.ts";

describe("golden runner flag parsing", () => {
  test("reads the attached --name=value form", () => {
    expect(parseArgValue(["--jobs=32"], "jobs")).toBe("32");
    expect(parseArgValue(["--specs=tiny_dance", "--jobs=8"], "specs")).toBe("tiny_dance");
  });

  test("reads the space-separated --name value form", () => {
    expect(parseArgValue(["--jobs", "32"], "jobs")).toBe("32");
    expect(parseArgValue(["--specs", "tiny_dance", "--jobs", "8"], "jobs")).toBe("8");
  });

  test("attached form wins and both forms agree on the canonical command", () => {
    const argv = ["--specs=tiny_dance", "--seed=0", "--budgets=50000", "--jobs", "8", "--json"];
    expect(parseArgValue(argv, "jobs")).toBe("8");
    expect(parseArgValue(argv, "seed")).toBe("0");
  });

  test("a bare flag does not swallow a following --flag as its value", () => {
    // `--variants` is boolean; the next token is another flag, not its value.
    expect(parseArgValue(["--variants", "--jobs=8"], "variants")).toBeNull();
    expect(parseArgValue(["--variants", "--jobs", "8"], "jobs")).toBe("8");
  });

  test("missing flag returns null", () => {
    expect(parseArgValue(["--json"], "jobs")).toBeNull();
    expect(parseArgValue([], "jobs")).toBeNull();
  });

  test("space form at the end of argv with no value returns null", () => {
    expect(parseArgValue(["--json", "--jobs"], "jobs")).toBeNull();
  });

  test("default job count uses half the available processors", () => {
    expect(defaultJobsForParallelism(1)).toBe(1);
    expect(defaultJobsForParallelism(2)).toBe(1);
    expect(defaultJobsForParallelism(3)).toBe(1);
    expect(defaultJobsForParallelism(4)).toBe(2);
    expect(defaultJobsForParallelism(32)).toBe(16);
  });

  test("default run resolves to the full canonical preset", () => {
    const config = resolveGoldenRunConfig([], {});
    expect(config.mode).toBe("full");
    expect(config.jobs).toBe(32);
    expect(config.canonical).toBe(true);
    expect(config.tier).toBe("canonical");
    expect(config.budgets).toEqual([75_000, 150_000, 225_000, 350_000, 475_000, 550_000]);
    expect(config.seedPolicy.seeds_per_budget).toBe(12);
    expect(config.seedPolicy.budget_seeds[1].seeds).toEqual([12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
  });

  test("--probe resolves to the normalized probe preset", () => {
    const config = resolveGoldenRunConfig(["--probe"], {});
    expect(config.mode).toBe("probe");
    expect(config.jobs).toBe(32);
    expect(config.canonical).toBe(false);
    expect(config.tier).toBe("probe");
    expect(config.budgets).toEqual([75_000, 200_000, 500_000]);
    expect(config.seedPolicy.seeds_per_budget).toBe(12);
    expect(config.seedPolicy.budget_seeds[2].seeds).toEqual([24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35]);
  });

  test("explicit jobs, seed base, and seed count override presets without reusing seeds", () => {
    const config = resolveGoldenRunConfig([
      "--full",
      "--budgets=75000,200000",
      "--seed-base=30",
      "--seed-count=2",
      "--jobs=8",
    ], {});
    expect(config.jobs).toBe(8);
    expect(config.canonical).toBe(false);
    expect(config.seedPolicy.seed_slots).toEqual([30, 31]);
    expect(config.seedPolicy.budget_seeds).toEqual([
      { budget: 75_000, seeds: [30, 31] },
      { budget: 200_000, seeds: [32, 33] },
    ]);
  });

  test("--seed is a single-slot shorthand with budget offsets", () => {
    const config = resolveGoldenRunConfig(["--probe", "--seed=42"], {});
    expect(config.seedPolicy.seed_slots).toEqual([42]);
    expect(config.seedPolicy.budget_seeds.map((entry) => entry.seeds)).toEqual([[42], [43], [44]]);
  });

  test("rejects conflicting modes and legacy seed overrides", () => {
    expect(() => resolveGoldenRunConfig(["--full", "--probe"], {})).toThrow("--full or --probe");
    expect(() => resolveGoldenRunConfig([], { GOLDEN_SEEDS_OVERRIDE: "0,1" })).toThrow("GOLDEN_SEEDS_OVERRIDE is removed");
    expect(() => resolveGoldenRunConfig(["--seed=1", "--seed-base=10"], {})).toThrow("use either --seed");
  });

  test("budget diagnostics compare rows by seed slot, not per-budget actual seed", () => {
    const rows = [{
      name: "spec_a",
      variant: "base",
      seed: 0,
      checkpoints: [
        { name: "spec_a", variant: "base", budget: 75_000, seed: 0, score: 100, status: "pass", contract_passed: true, track_hash: "a" },
        { name: "spec_a", variant: "base", budget: 200_000, seed: 1, score: 120, status: "pass", contract_passed: true, track_hash: "b" },
      ],
    }] as unknown as Parameters<typeof summarizeBudgets>[0];

    const summaries = summarizeBudgets(rows, [75_000, 200_000]);

    expect(summaries[0].changed_tracks).toBe(0);
    expect(summaries[1].changed_tracks).toBe(1);
    expect(summaries[1].improved_rows).toBe(1);
    expect(summaries[1].plateau_rows).toBe(0);
    expect(summaries[1].regressions).toBe(0);
  });
});
