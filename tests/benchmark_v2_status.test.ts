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
    expect(payload.menu).toHaveLength(3);
    expect(payload.menu[0]).toMatchObject({
      id: "improve-t0-d48",
      depth: 48,
      spend: 0.0209,
      developmentCompiles: 12_672,
      qualificationCompilesOnAccept: 120,
    });
    expect(payload.menu[1]).toMatchObject({
      id: "improve-t0-d300",
      depth: 300,
      mde80: 2,
      developmentCompiles: 79_200,
      qualificationCompilesOnAccept: 120,
    });
    expect(payload.menu[1].spend).toBeGreaterThan(0);
    expect(payload.menu[1].spend).toBeLessThanOrEqual(0.05);
    expect(payload.canonicalCache.operatingPoint).toMatchObject({
      registered: false,
      pointId: null,
    });
    expect(payload.operationalReference).toMatchObject({ jobs: 48, stage0: { compiles: 264 } });
    expect(typeof payload.baseline.current).toBe("boolean");
    expect(typeof payload.stage0.comparable).toBe("boolean");
    expect(Array.isArray(payload.stage0.refusalReasons)).toBe(true);
    expect(payload.stage0.comparable || payload.stage0.refusalReasons.length > 0).toBe(true);
    expect(sha(readFileSync("benchmark/v2/attempts.jsonl"))).toBe(before);
  // Status validates checksummed retained reference artifacts in a child
  // process; allow ordinary cold filesystem latency without weakening it.
  }, 30_000);

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
      stage0: { comparable: false, refusalReasons: ["runner reference is stale"] },
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
        developmentCompiles: 12_672,
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
    expect(output).toContain("12672 development compiles + 120 qualification");
    expect(output).toContain("BLOCKED: era spend would exceed cap");
    expect(output).toContain("host-specific reference");
    expect(output).toContain("BLOCKED by package.json");
    expect(output).toContain("stage 0 reference: BLOCKED: runner reference is stale");
  });
});

function sha(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
