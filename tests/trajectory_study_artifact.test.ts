import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import {
  allocateStudyArtifactPath,
  assertStudyArtifactPathUnused,
  forensicDriftArtifactPath,
  studyArtifactIdentity,
  studySourceIdentity,
  writeImmutableJsonArtifact,
  writeStudyArtifact,
} from "../scripts/v0/trajectory/study_artifact.ts";

describe("trajectory study artifact identity", () => {
  test("hashes the transitive local import closure", () => {
    const root = temporaryWorkspace();
    try {
      writeFileSync(join(root, "entry.ts"), 'import { middle } from "./middle.ts"; export const entry = middle;\n');
      writeFileSync(join(root, "middle.ts"), 'import { leaf } from "./leaf.ts"; export const middle = leaf;\n');
      writeFileSync(join(root, "leaf.ts"), "export const leaf = 1;\n");
      const before = studySourceIdentity("entry.ts", root);
      expect(before.sourceFiles).toEqual(["entry.ts", "leaf.ts", "middle.ts"]);
      writeFileSync(join(root, "leaf.ts"), "export const leaf = 2;\n");
      const after = studySourceIdentity("entry.ts", root);
      expect(after.studySourceFingerprint).not.toBe(before.studySourceFingerprint);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("binds protocol/compiler identity and preserves existing artifacts", () => {
    const root = temporaryWorkspace();
    try {
      const identity = studyArtifactIdentity({
        schema: "test.study.v1",
        fixtureFingerprint: "fixture-a",
        studySourceFingerprint: "source-a",
        observationCandidateFingerprint: "compiler-a",
        protocolFingerprint: "protocol-a",
      });
      const { fingerprint: _fingerprint, ...identityInput } = identity;
      const protocolChanged = studyArtifactIdentity({ ...identityInput, protocolFingerprint: "protocol-b" });
      expect(protocolChanged.fingerprint).not.toBe(identity.fingerprint);
      const path = join(root, "artifact.json");
      const artifact = { schema: "test.study.v1", artifactIdentity: identity, status: { protocolStatus: "complete" } };
      writeStudyArtifact(path, artifact);
      expect(() => writeStudyArtifact(path, artifact)).toThrow(/immutable/);
      expect(() => writeStudyArtifact(path, { ...artifact, artifactIdentity: protocolChanged })).toThrow(/immutable/);
      expect(() => assertStudyArtifactPathUnused(path)).toThrow(/immutable/);
      expect(allocateStudyArtifactPath(path)).toBe(join(root, "artifact.attempt-2.json"));
      expect(forensicDriftArtifactPath(path, "source-end", "compiler-end"))
        .toBe(join(root, "artifact.identity-drift-source-end-compiler-end.json"));
      expect(forensicDriftArtifactPath(path, "source-end", "compiler-end", "input-end"))
        .toBe(join(root, "artifact.identity-drift-source-end-compiler-end-input-end.json"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("publishes a complete generic record without replacing an existing path", () => {
    const root = temporaryWorkspace();
    try {
      const path = join(root, "fixture.json");
      writeImmutableJsonArtifact(path, { complete: true }, "fixture");
      expect(() => writeImmutableJsonArtifact(path, { complete: false }, "fixture"))
        .toThrow(/immutable fixture/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function temporaryWorkspace(): string {
  return mkdtempSync(join(tmpdir(), "line-study-artifact-"));
}
