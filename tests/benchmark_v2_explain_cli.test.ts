import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("Benchmark V2 archive explanation", () => {
  test("reads retained compressed archives directly", () => {
    const directory = mkdtempSync(join(tmpdir(), "v2-explain-"));
    const outputStem = join(directory, "probe");
    execFileSync(process.execPath, [
      "--import",
      "tsx",
      "scripts/v0/benchmark_v2/explain.ts",
      "benchmark/v2/runs/v2-initial-2026-07-11-probe.json.gz",
      `--out=${outputStem}`,
    ]);

    const report = JSON.parse(readFileSync(`${outputStem}.json`, "utf8"));
    expect(report.schema).toBe("line.benchmark-v2.explanation.v1");
    expect(report.canonicalHeadline).toBe(446.0945);
    expect(report.perBudget).toHaveLength(2);
    expect(readFileSync(`${outputStem}.md`, "utf8")).toContain("Canonical headline: **446.09**");
  });
});
