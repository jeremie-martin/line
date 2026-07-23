import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { readBaselineContract } from "../scripts/v0/benchmark_v2/baseline_contract.ts";
import {
  allocateSnapshotWorkspacePath,
  materializedTrackedFiles,
  validateCompilerSnapshot,
} from "../scripts/v0/benchmark_v2/compiler_snapshot.ts";
import { latestSuccessfulResults } from "../scripts/v0/benchmark_v2/checkpoint_model.ts";
import { requireCurrentDecisionCalibration } from "../scripts/v0/benchmark_v2/calibration_guard.ts";
import {
  loadListeningReview,
  requireApprovedListeningReview,
} from "../scripts/v0/benchmark_v2/listening_review.ts";
import { loadSourceManifest, resolveSources } from "../scripts/v0/benchmark_v2/model.ts";
import { suiteIdentity } from "../scripts/v0/benchmark_v2/suite_model.ts";

const sourcePath = "benchmark/v2/compat/source-manifest.json";
const suitePath = "benchmark/v2/compat/suite-manifest.json";

describe("Benchmark V2 retained evidence", () => {
  test("runner compatibility approvals are unique and retain immutable evidence", () => {
    const manifest = JSON.parse(readFileSync("benchmark/v2/runner-compatibility.json", "utf8"));
    const keys = manifest.approvals.map((entry: any) =>
      `${entry.fromImplementationFingerprint}/${entry.toImplementationFingerprint}/${entry.suiteFingerprint}`
    );
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of manifest.approvals) {
      expect(existsSync(entry.evidence.path)).toBe(true);
      expect(createHash("sha256").update(readFileSync(entry.evidence.path)).digest("hex"))
        .toBe(entry.evidence.sha256);
    }
  });

  test("snapshot path allocation reserves an absent worktree target", () => {
    const root = mkdtempSync(join(tmpdir(), "line-snapshot-path-"));
    const path = allocateSnapshotWorkspacePath(root);
    expect(existsSync(path)).toBe(false);
  });

  test("snapshot overlay omits tracked paths deleted from the worktree", () => {
    const root = mkdtempSync(join(tmpdir(), "line-materialized-"));
    writeFileSync(join(root, "present"), "x");
    expect(materializedTrackedFiles(Buffer.from("present\0missing\0"), root).toString())
      .toBe("present\0");
  });

  test("baseline snapshot and suite identities remain valid", () => {
    const baseline = readBaselineContract();
    validateCompilerSnapshot(baseline.compilerSnapshot);
    const sources = resolveSources(loadSourceManifest(sourcePath));
    expect(baseline.suiteFingerprint).toBe(suiteIdentity(suitePath, sourcePath, sources).suiteFingerprint);
  });

  test("retained statistical calibration remains reproducible evidence", () => {
    const baseline = readBaselineContract();
    expect(() => requireCurrentDecisionCalibration(baseline.suiteFingerprint)).not.toThrow();
  });

  test("approved listening review matches the current source inventory", async () => {
    const sources = resolveSources(loadSourceManifest(sourcePath));
    const identity = suiteIdentity(suitePath, sourcePath, sources);
    const review = await loadListeningReview(
      "benchmark/v2/evidence/listening-review.json",
      identity.suiteFingerprint,
      identity.sourceManifestFingerprint,
      sources,
    );
    expect(() => requireApprovedListeningReview(review)).not.toThrow();
  });

  test("checkpoint recovery keeps the latest successful row per key", () => {
    const recovered = latestSuccessfulResults([
      { key: "a", status: "timeout", value: 1 },
      { key: "b", status: "ok", value: 2 },
      { key: "a", status: "ok", value: 3 },
      { key: "c", status: "error", value: 4 },
    ], (entry) => entry.key);
    expect(recovered).toEqual([
      { key: "a", status: "ok", value: 3 },
      { key: "b", status: "ok", value: 2 },
    ]);
  });
});
