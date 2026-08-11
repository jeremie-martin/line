import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, test } from "vitest";
import { loadVerifiedAnalysisArchive } from "../scripts/v0/benchmark_v2/analysis_archive.ts";
import {
  archiveChunks,
  bindDecisionIndexArchive,
  writeDecisionIndexArtifacts,
} from "../scripts/v0/benchmark_v2/runner.ts";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe("streamed analysis archive loading", () => {
  test("verifies the raw archive and retains only report gaps", async () => {
    const directory = mkdtempSync(join(tmpdir(), "line-analysis-archive-"));
    directories.push(directory);
    const rawPath = join(directory, "run.json");
    const compressedPath = `${rawPath}.gz`;
    const archive = bindDecisionIndexArchive({
      schema: "line.benchmark-v2.run-archive.v5",
      mode: "development",
      profile: "canonical",
      identity: { budgets: [750_000] },
      runs: [0, 1].map((seedSlot) => ({
        status: "ok",
        task: { sourceId: "fixture", budget: 750_000, seedSlot, actualSeed: 10 + seedSlot },
        source: { id: "fixture" },
        authoredContacts: 1,
        score: { score: 600 + seedSlot, valid: true, components: {} },
        report: {
          contacts: [{ status: "hit" }],
          gaps: [{ axes: { impact: { target: 0.5, achieved: 0.4, error: 0.1 } } }],
          largeUnusedField: "x".repeat(10_000),
        },
      })),
    });
    const rawBytes = Buffer.from([...archiveChunks(archive)].join(""));
    const compressedBytes = gzipSync(rawBytes);
    writeFileSync(rawPath, rawBytes);
    writeFileSync(compressedPath, compressedBytes);
    const rawSha256 = digest(rawBytes);
    const compressedSha256 = digest(compressedBytes);
    writeFileSync(`${compressedPath}.sha256`, `${compressedSha256}  ${compressedPath}\n`);
    writeDecisionIndexArtifacts(rawPath, archive, rawSha256, compressedSha256);

    const loaded = await loadVerifiedAnalysisArchive(compressedPath, {
      archive_sha256: rawSha256,
      compressed_archive_sha256: compressedSha256,
    });
    expect(loaded.archive.runs).toHaveLength(2);
    expect(loaded.archive.runs[0].report).toEqual({ gaps: archive.runs[0].report.gaps });
    expect(loaded.archive.runs[0].report.contacts).toBeUndefined();
    expect(loaded.archive.runs[0].report.largeUnusedField).toBeUndefined();
    await expect(loadVerifiedAnalysisArchive(compressedPath, {
      archive_sha256: "0".repeat(64),
      compressed_archive_sha256: compressedSha256,
    })).rejects.toThrow(/decision index does not match retained evidence/);
  });
});

function digest(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
