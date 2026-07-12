import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { retainedEvidenceInventory } from "../scripts/v0/benchmark_v2/evidence_inventory.ts";

let temporary: string | null = null;
afterEach(() => {
  if (temporary !== null) rmSync(temporary, { recursive: true, force: true });
  temporary = null;
});

describe("retained evidence inventory", () => {
  test("protects referenced payload units and reports missing and unreferenced paths", () => {
    temporary = mkdtempSync(join(tmpdir(), "line-v2-evidence-"));
    const runs = join(temporary, "runs");
    mkdirSync(runs);
    const kept = join(runs, "kept.json.gz");
    const sidecar = `${kept}.sha256`;
    const orphan = join(runs, "orphan.json.gz");
    writeFileSync(kept, "kept");
    writeFileSync(sidecar, "hash");
    writeFileSync(orphan, "orphan");
    writeFileSync(join(temporary, "baseline.json"), JSON.stringify({
      archive: kept,
      missing: "benchmark/v2/runs/does-not-exist.json.gz",
    }));
    writeFileSync(join(temporary, "retained-summary.json"), JSON.stringify({
      schema: "line.benchmark-v2.run-summary.v3",
      archive: "benchmark/v2/runs/intentionally-not-retained.json",
      compressedArchive: "benchmark/v2/runs/intentionally-not-retained.json.gz",
      retainedCompressedArchive: kept,
    }));

    const inventory = retainedEvidenceInventory({ runsRoot: runs, benchmarkRoot: temporary });
    expect(inventory.totalFiles).toBe(3);
    expect(inventory.referencedFiles).toBe(2);
    expect(inventory.unreferenced).toEqual([{ path: relative(process.cwd(), orphan), bytes: 6 }]);
    // Absolute paths are outside the repository retention namespace, so only
    // normative benchmark/v2/runs references participate in missing checks.
    expect(inventory.missingReferences).toEqual(["benchmark/v2/runs/does-not-exist.json.gz"]);
  });
});
