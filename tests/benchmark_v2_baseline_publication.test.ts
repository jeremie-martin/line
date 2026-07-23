import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  discardUntouchedPendingBaselinePublication,
  publishBaseline,
  recoverPendingBaselinePublication,
} from "../scripts/v0/benchmark_v2/baseline_publication.ts";
import { assertBaselineBundleLabel } from "../scripts/v0/benchmark_v2/rebaseline.ts";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "line-baseline-publication-"));
  const bundlePath = join(root, "bundle.json");
  const pendingPath = join(root, "pending.json");
  const baselinePath = join(root, "baseline.json");
  writeFileSync(bundlePath, JSON.stringify({
    schema: "line.benchmark-v2.baseline-bundle.v3",
    label: "new-base",
  }));
  writeFileSync(baselinePath, JSON.stringify({ label: "old-base" }));
  return { root, bundlePath, pendingPath, baselinePath };
}

describe("recoverable stateless baseline publication", () => {
  test("pins a bundle and clears the journal after freeze", () => {
    const f = fixture();
    let frozen = 0;
    publishBaseline(f.bundlePath, {
      pendingPath: f.pendingPath,
      conflictingPendingPath: join(f.root, "migration.json"),
      freeze: () => { frozen++; },
    });
    expect(frozen).toBe(1);
    expect(() => readFileSync(f.pendingPath)).toThrow();
  });

  test("retains and recovers the exact bundle after interruption", () => {
    const f = fixture();
    expect(() => publishBaseline(f.bundlePath, {
      pendingPath: f.pendingPath,
      conflictingPendingPath: join(f.root, "migration.json"),
      freeze: () => { throw new Error("crash"); },
    })).toThrow(/crash/);
    let frozen = 0;
    expect(recoverPendingBaselinePublication({
      pendingPath: f.pendingPath,
      conflictingPendingPath: join(f.root, "migration.json"),
      freeze: () => { frozen++; },
    })).toBe(true);
    expect(frozen).toBe(1);
  });

  test("refuses changed pinned bytes and discards only untouched publication", () => {
    const f = fixture();
    expect(() => publishBaseline(f.bundlePath, {
      pendingPath: f.pendingPath,
      conflictingPendingPath: join(f.root, "migration.json"),
      freeze: () => { throw new Error("crash"); },
    })).toThrow();
    writeFileSync(f.bundlePath, JSON.stringify({
      schema: "line.benchmark-v2.baseline-bundle.v3",
      label: "changed",
    }));
    expect(() => recoverPendingBaselinePublication({
      pendingPath: f.pendingPath,
      conflictingPendingPath: join(f.root, "migration.json"),
      freeze: () => {},
    })).toThrow(/changed/);

    const clean = fixture();
    expect(() => publishBaseline(clean.bundlePath, {
      pendingPath: clean.pendingPath,
      conflictingPendingPath: join(clean.root, "migration.json"),
      freeze: () => { throw new Error("crash"); },
    })).toThrow();
    expect(() => discardUntouchedPendingBaselinePublication({
      pendingPath: clean.pendingPath,
      baselinePath: clean.baselinePath,
    })).not.toThrow();
  });

  test("bundle label check remains explicit", () => {
    const f = fixture();
    expect(() => assertBaselineBundleLabel(f.bundlePath, "new-base")).not.toThrow();
    expect(() => assertBaselineBundleLabel(f.bundlePath, "other")).toThrow(/does not match/);
  });
});
