import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";

function runGolden(args: string[]): any {
  const out = execFileSync("npx", ["tsx", "scripts/v0/golden.ts", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
    maxBuffer: 1024 * 1024 * 8,
  });
  return JSON.parse(out);
}

describe("v1 golden CLI", () => {
  test("runs v1 with an explicit work budget and quality-only scoring", () => {
    const json = runGolden([
      "--compiler=v1",
      "--specs=tiny_dance",
      "--seed=0",
      "--budget-units=0",
      "--json",
    ]);

    expect(json.scoring.compiler).toBe("v1");
    expect(json.scoring.runtime).toContain("not score-penalized");
    expect(json.scoring.budget).toMatchObject({ kind: "work", units: 0 });
    expect(json.specs).toHaveLength(1);
    expect(json.specs[0].compile_stats.work_units_requested).toBe(0);
    expect(json.specs[0].time_multiplier).toBe(1);
  });

  test("runs v1 budget sweep and reports monotonic violations", () => {
    const json = runGolden([
      "--compiler=v1",
      "--specs=tiny_dance",
      "--seed=0",
      "--budget-sweep",
      "--budget-sweep-scales=0.05",
      "--json",
    ]);

    expect(json.scoring.budget.kind).toBe("work_sweep");
    expect(json.budget_sweep).toHaveLength(1);
    expect(json.budget_sweep[0].specs).toHaveLength(1);
    expect(json.monotonic_violations).toEqual([]);
  });

  test("rejects budget units for v0", () => {
    expect(() => runGolden(["--budget-units=1", "--json"]))
      .toThrow(/budget-units/);
  });
});
