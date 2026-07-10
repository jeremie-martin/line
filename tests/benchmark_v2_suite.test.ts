import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import {
  assertNoHeldoutIdentity,
  loadHeldoutManifest,
  loadSourceManifest,
  resolveHeldoutSources,
  resolveSources,
} from "../scripts/v0/benchmark_v2/model.ts";
import {
  canonicalMembers,
  executionPolicyIdentity,
  loadSuiteManifest,
  resolvedSeedSchedule,
  suiteIdentity,
  validateSuiteManifest,
} from "../scripts/v0/benchmark_v2/suite_model.ts";

describe("Benchmark V2 suite identity", () => {
  test("pins all canonical strata and membership", () => {
    const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
    const suite = loadSuiteManifest("benchmark/v2/compat/suite-manifest.json", sources);
    expect(suite.strata.map((stratum) => stratum.weight)).toEqual([0.7, 0.15, 0.1, 0.05]);
    expect(canonicalMembers(suite)).toHaveLength(42);
    expect(canonicalMembers(suite)).toContain("frontier_low_air_endurance");
  });

  test("allows coverage growth but rejects duplicate membership and heldout identity relabeling", () => {
    const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
    const heldout = resolveHeldoutSources(loadHeldoutManifest("benchmark/v2/compat/heldout-manifest.json"));
    const suite = loadSuiteManifest("benchmark/v2/compat/suite-manifest.json", sources);
    const invalid = structuredClone(suite);
    invalid.strata[0].groups[0].members.push(invalid.strata[0].groups[1].members[0]);
    expect(() => validateSuiteManifest(invalid)).toThrow(/parent membership mismatch|canonical members must be unique/);
    expect(() => assertNoHeldoutIdentity([{ ...sources[0], id: heldout[0].id }], heldout)).toThrow(/reserved heldout id/);
    expect(() => assertNoHeldoutIdentity([{ ...sources[0], sourceFingerprint: heldout[0].sourceFingerprint }], heldout))
      .toThrow(/reserved heldout source fingerprint/);
  });

  test("freezes resolved seeds and pins the checksummed canonical baseline", () => {
    const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
    const identity = suiteIdentity("benchmark/v2/compat/suite-manifest.json", "benchmark/v2/compat/source-manifest.json", sources);
    const baseline = JSON.parse(readFileSync("benchmark/v2/baseline.json", "utf8")) as {
      status: string;
      suite_fingerprint: string;
      engine: string;
      compiler_source_fingerprint: string;
      compiler_environment: Record<string, string>;
      engine_artifact_fingerprint: string;
      candidate_fingerprint: string;
      development: { compressed_archive: string; compressed_archive_sha256: string; canonical_headline: number };
      qualification: { compressed_archive: string; compressed_archive_sha256: string; monitor_score: number };
    };
    expect(identity.suiteFingerprint).toHaveLength(64);
    expect(baseline.status).toBe("canonical-baseline");
    expect(baseline.suite_fingerprint).toBe(identity.suiteFingerprint);
    expect(baseline.development.canonical_headline).toBe(451.3303);
    expect(baseline.qualification.monitor_score).toBe(385.6812);
    expect(createHash("sha256").update(JSON.stringify({
      compilerSourceFingerprint: baseline.compiler_source_fingerprint,
      compilerEnvironment: baseline.compiler_environment,
      engine: baseline.engine,
      engineArtifactFingerprint: baseline.engine_artifact_fingerprint,
    })).digest("hex")).toBe(baseline.candidate_fingerprint);
    for (const artifact of [baseline.development, baseline.qualification]) {
      const compressed = readFileSync(artifact.compressed_archive);
      expect(createHash("sha256").update(compressed).digest("hex"))
        .toBe(artifact.compressed_archive_sha256);
      const archive = JSON.parse(gunzipSync(compressed).toString("utf8"));
      expect(archive.identity.engine).toBe(baseline.engine);
      expect(archive.git).toMatchObject({
        compilerSourceFingerprint: baseline.compiler_source_fingerprint,
        compilerEnvironment: baseline.compiler_environment,
        engineArtifactFingerprint: baseline.engine_artifact_fingerprint,
        candidateFingerprint: baseline.candidate_fingerprint,
      });
    }
    const suite = loadSuiteManifest("benchmark/v2/compat/suite-manifest.json", sources);
    const schedule = resolvedSeedSchedule(suite, suite.profiles.canonical.budgets, 4);
    const policy = executionPolicyIdentity({
      suiteFingerprint: identity.suiteFingerprint,
      harnessFingerprint: "harness",
      engine: "wasm",
      compiler: "compileHandoff",
      profile: "canonical",
      budgets: suite.profiles.canonical.budgets,
      seedSchedule: schedule,
      sources: sources.map((source) => ({ id: source.id, role: source.role, sourceFingerprint: source.sourceFingerprint })),
      transform: suite.transform,
    });
    expect(schedule.byBudget.map((entry) => entry.actualSeeds)).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9, 10, 11],
    ]);
    expect(policy.executionPolicyFingerprint).toHaveLength(64);
  });
});
