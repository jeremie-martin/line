import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { renderBenchmarkStatus, type BenchmarkStatus } from "../scripts/v0/benchmark_v2/status.ts";

describe("Benchmark V2 status", () => {
  test("reports certified cost and blockers without mutating the ledger", () => {
    const before = sha(readFileSync("benchmark/v2/attempts.jsonl"));
    const result = spawnSync(process.execPath, [
      "--import", "tsx", "scripts/benchmark/cli.ts", "status", "--json", "--no-resource-stats",
    ], { cwd: process.cwd(), encoding: "utf8" });
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.schema).toBe("line.benchmark-v2.status.v1");
    expect(payload.menu).toHaveLength(2);
    expect(payload.menu[0]).toMatchObject({
      id: "improve-t0-d48",
      depth: 48,
      spend: 0.0196,
      developmentCompiles: 12_096,
      qualificationCompilesOnAccept: 120,
    });
    expect(payload.operationalReference).toMatchObject({ jobs: 48, stage0: { compiles: 252 } });
    expect(typeof payload.baseline.current).toBe("boolean");
    expect(sha(readFileSync("benchmark/v2/attempts.jsonl"))).toBe(before);
  }, 15_000);

  test("human output distinguishes normative counts from measured host timing", () => {
    const status = {
      schema: "line.benchmark-v2.status.v1",
      baseline: {
        label: "base",
        suiteFingerprint: "a",
        inferenceFingerprint: "b",
        protocolFingerprint: "c",
        calibrationFingerprint: "d",
        current: true,
      },
      era: {
        eraId: "era",
        budgetSpent: 0.0392,
        budgetCap: 0.05,
        cumulativeExpectedFalseAccepts: 0.098,
        inFlightAttemptId: null,
        transitionPending: false,
      },
      compiler: { cleanForRebaseline: false, dirtyPaths: ["package.json"] },
      publication: { pending: [] },
      evidence: {
        root: "benchmark/v2/runs",
        totalFiles: 10,
        totalBytes: 1024,
        referencedFiles: 8,
        referencedBytes: 768,
        unreferencedFiles: 2,
        unreferencedBytes: 256,
        missingReferences: [],
        unreferenced: [],
      },
      menu: [{
        id: "improve-t0-d48",
        mode: "improvement",
        margin: null,
        depth: 48,
        spend: 0.0196,
        mde80: 5,
        developmentCompiles: 12_096,
        qualificationCompilesOnAccept: 120,
        budgetAfterDeclaration: 0.0588,
        declarationAllowed: false,
        refusalReason: "era spend would exceed cap",
      }],
      operationalReference: {
        measuredAt: "2026-07-12T00:00:00.000Z",
        jobs: 48,
        stage0: { wallSeconds: 73.57 },
        confirmationDepth48: { wallSeconds: 3445.65, peakAggregateRssGiB: 9.51 },
        scope: "host-specific reference",
      },
    } satisfies BenchmarkStatus;
    const output = renderBenchmarkStatus(status);
    expect(output).toContain("12096 development compiles + 120 qualification");
    expect(output).toContain("BLOCKED: era spend would exceed cap");
    expect(output).toContain("host-specific reference");
    expect(output).toContain("BLOCKED by package.json");
  });
});

function sha(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
