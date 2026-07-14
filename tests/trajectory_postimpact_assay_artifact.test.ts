import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  assertPostimpactAssayArtifactIntegrity,
  postimpactAssayRuntimeIdentity,
  readPostimpactAssayArtifact,
  sealPostimpactAssayArtifact,
  writeImmutablePostimpactAssayArtifact,
} from "../scripts/v0/trajectory/postimpact_assay_artifact.ts";

describe("post-impact assay artifacts", () => {
  test("seals and verifies the complete emitted payload", () => {
    const payload = {
      schema: "line.test-assay.v1",
      status: { protocolStatus: "complete" },
      rows: [{ id: "row-a", metric: 1 }],
      summary: { completeRows: 1 },
    };
    const sealed = sealPostimpactAssayArtifact(payload);
    expect(Object.isFrozen(sealed)).toBe(true);
    expect(sealed.artifactContentFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(() => assertPostimpactAssayArtifactIntegrity(sealed)).not.toThrow();

    const tampered = { ...sealed, summary: { completeRows: 2 } };
    expect(() => assertPostimpactAssayArtifactIntegrity(tampered)).toThrow(/content fingerprint/);
    expect(() => sealPostimpactAssayArtifact({ ...payload, artifactContentFingerprint: "0".repeat(64) }))
      .toThrow(/must not predeclare/);
    expect(() => sealPostimpactAssayArtifact({ ...payload, date: new Date() })).toThrow(/plain JSON objects/);
    expect(() => sealPostimpactAssayArtifact({ ...payload, missing: undefined })).toThrow(/JSON-safe/);
    const getterPayload = { ...payload } as Record<string, unknown>;
    Object.defineProperty(getterPayload, "unstable", {
      enumerable: true,
      get: () => Math.random(),
    });
    expect(() => sealPostimpactAssayArtifact(getterPayload)).toThrow(/accessor property/);
    expect(() => sealPostimpactAssayArtifact({ ...payload, sparse: [1, , 3] })).toThrow(/sparse array/);
  });

  test("publishes append-only artifacts that a reader verifies", () => {
    const root = mkdtempSync(join(tmpdir(), "line-postimpact-artifact-"));
    const path = join(root, "artifact.json");
    try {
      const payload = { schema: "line.test-assay.v1", rows: [{ id: "row-a" }], status: { ok: true } };
      writeImmutablePostimpactAssayArtifact(path, payload);
      expect(readPostimpactAssayArtifact(path)).toMatchObject({
        schema: "line.test-assay.v1",
        artifactContentFingerprint: expect.any(String),
      });
      expect(() => writeImmutablePostimpactAssayArtifact(path, payload)).toThrow(/refusing to overwrite/);

      const edited = readPostimpactAssayArtifact(path);
      writeFileSync(path, `${JSON.stringify({ ...edited, status: { ok: false } })}\n`);
      expect(() => readPostimpactAssayArtifact(path)).toThrow(/content fingerprint/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("binds the execution runtime in its reproducibility identity", () => {
    const identity = postimpactAssayRuntimeIdentity();
    expect(identity).toMatchObject({
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      typescriptVersion: expect.any(String),
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });
});
