import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import { BENCHMARK_EXECUTION_PROTOCOL } from "../benchmark/v2/decision-policy.ts";
import {
  assertNoHeldoutIdentity,
  loadHeldoutManifest,
  loadSourceManifest,
  resolveHeldoutSources,
  resolveSources,
} from "../scripts/v0/benchmark_v2/model.ts";
import { COMPILER_IDENTITY_PROTOCOL } from "../scripts/v0/benchmark_v2/runner.ts";
import {
  BENCHMARK_IMPLEMENTATION_SOURCE_FILES,
  BENCHMARK_SCORING_PROTOCOL_FINGERPRINT,
  RUNNER_IMPLEMENTATION_SOURCE_FILES,
  canonicalMembers,
  executionPolicyIdentity,
  loadSuiteManifest,
  resolvedSeedSchedule,
  suiteIdentity,
  validateSuiteManifest,
} from "../scripts/v0/benchmark_v2/suite_model.ts";

describe("Benchmark V2 suite identity", () => {
  test("binds the shared headline scorer to suite and execution identity", () => {
    expect(BENCHMARK_IMPLEMENTATION_SOURCE_FILES).toContain("scripts/v0/score.ts");
    expect(BENCHMARK_SCORING_PROTOCOL_FINGERPRINT).toMatch(/^[a-f0-9]{64}$/);
    expect(RUNNER_IMPLEMENTATION_SOURCE_FILES).toContain("scripts/v0/score.ts");
  });

  test("pins all canonical strata and membership", () => {
    const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
    const suite = loadSuiteManifest("benchmark/v2/compat/suite-manifest.json", sources);
    expect(suite.strata.map((stratum) => stratum.weight)).toEqual([0.7, 0.15, 0.1, 0.05]);
    expect(canonicalMembers(suite)).toHaveLength(44);
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

  test("freezes resolved seeds and the approved V10 baseline", () => {
    const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
    const identity = suiteIdentity("benchmark/v2/compat/suite-manifest.json", "benchmark/v2/compat/source-manifest.json", sources);
    const baseline = JSON.parse(readFileSync("benchmark/v2/baseline.json", "utf8")) as {
      schema: string;
      status: string;
      suite_fingerprint: string;
      execution_protocol: string;
      engine: string;
      compiler_identity_protocol: string;
      listening_review_status: string;
      compiler_source_fingerprint: string;
      compiler_source_files: string[];
      compiler_environment: Record<string, string>;
      engine_artifact_fingerprint: string;
      candidate_fingerprint: string;
      decision_inference_fingerprint: string;
      decision_protocol_fingerprint: string;
      decision_calibration_fingerprint: string;
      compiler_snapshot: { archive: string; archiveSha256: string };
      probe: { compressed_archive: string; compressed_archive_sha256: string; canonical_headline: number };
      development: { compressed_archive: string; compressed_archive_sha256: string; canonical_headline: number };
      qualification: { compressed_archive: string; compressed_archive_sha256: string; monitor_score: number };
    };
    const probeBaseline = JSON.parse(readFileSync("benchmark/v2/probe-baseline.json", "utf8"));
    expect(identity.suiteFingerprint).toHaveLength(64);
    expect(probeBaseline).toMatchObject({
      schema: "line.benchmark-v2.probe-baseline-reference.v1",
      status: "screening-baseline",
      suite_fingerprint: identity.suiteFingerprint,
      execution_protocol: BENCHMARK_EXECUTION_PROTOCOL,
    });
    expect(createHash("sha256").update(readFileSync(probeBaseline.probe.compressed_archive)).digest("hex"))
      .toBe(probeBaseline.probe.compressed_archive_sha256);
    expect(baseline.schema).toBe("line.benchmark-v2.baseline-reference.v10");
    expect(baseline.status).toBe("canonical-baseline");
    expect(baseline.listening_review_status).toBe("approved");
    expect(baseline.suite_fingerprint).toBe(identity.suiteFingerprint);
    expect(baseline.execution_protocol).toBe(BENCHMARK_EXECUTION_PROTOCOL);
    expect(baseline.decision_inference_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(baseline.decision_protocol_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(baseline.decision_calibration_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(baseline.compiler_identity_protocol).toBe(COMPILER_IDENTITY_PROTOCOL);
    expect(baseline.compiler_source_files).toContain("scripts/v0/score.ts");
    expect(baseline.compiler_source_files).toContain("scripts/lib/detector.ts");
    expect(baseline.probe.canonical_headline).toBe(558.3113);
    expect(baseline.development.canonical_headline).toBe(559.7518);
    expect(baseline.qualification.monitor_score).toBe(405.4096);
    expect(createHash("sha256").update(JSON.stringify({
      compilerIdentityProtocol: baseline.compiler_identity_protocol,
      compilerSourceFingerprint: baseline.compiler_source_fingerprint,
      compilerEnvironment: baseline.compiler_environment,
      engine: baseline.engine,
      engineArtifactFingerprint: baseline.engine_artifact_fingerprint,
    })).digest("hex")).toBe(baseline.candidate_fingerprint);
    const compressedProbe = readFileSync(baseline.probe.compressed_archive);
    expect(createHash("sha256").update(compressedProbe).digest("hex"))
      .toBe(baseline.probe.compressed_archive_sha256);
    const probeArchive = JSON.parse(gunzipSync(compressedProbe).toString("utf8"));
    expect(probeArchive.identity.engine).toBe(baseline.engine);
    expect(probeArchive.git).toMatchObject({
      compilerIdentityProtocol: baseline.compiler_identity_protocol,
      compilerSourceFingerprint: baseline.compiler_source_fingerprint,
      compilerSourceFiles: baseline.compiler_source_files,
      compilerEnvironment: baseline.compiler_environment,
      engineArtifactFingerprint: baseline.engine_artifact_fingerprint,
      candidateFingerprint: baseline.candidate_fingerprint,
    });
    const snapshot = readFileSync(baseline.compiler_snapshot.archive);
    expect(createHash("sha256").update(snapshot).digest("hex"))
      .toBe(baseline.compiler_snapshot.archiveSha256);
    for (const external of [baseline.development, baseline.qualification]) {
      expect(external.compressed_archive).toMatch(/^benchmark\/v2\/runs\/.*\.json\.gz$/);
      expect(external.compressed_archive_sha256).toMatch(/^[a-f0-9]{64}$/);
    }
    const suite = loadSuiteManifest("benchmark/v2/compat/suite-manifest.json", sources);
    const schedule = resolvedSeedSchedule(suite, "canonical", suite.profiles.canonical.budgets, 8);
    const probeSchedule = resolvedSeedSchedule(suite, "probe", suite.profiles.probe.budgets, 3);
    const policyInput: Parameters<typeof executionPolicyIdentity>[0] = {
      suiteFingerprint: identity.suiteFingerprint,
      executionProtocol: BENCHMARK_EXECUTION_PROTOCOL,
      listeningReviewFingerprint: "review-fingerprint",
      implementationFingerprint: "implementation",
      engine: "wasm",
      compiler: "compileHandoff",
      profile: "canonical",
      budgets: suite.profiles.canonical.budgets,
      seedSchedule: schedule,
      sources: sources.map((source) => ({ id: source.id, role: source.role, sourceFingerprint: source.sourceFingerprint })),
      transform: suite.transform,
    };
    const policy = executionPolicyIdentity(policyInput);
    expect(schedule.byBudget.map((entry) => entry.actualSeeds)).toEqual([
      [0, 1, 2, 3, 4, 5, 6, 7],
      [8, 9, 10, 11, 12, 13, 14, 15],
      [16, 17, 18, 19, 20, 21, 22, 23],
    ]);
    expect(probeSchedule.byBudget.map((entry) => entry.actualSeeds)).toEqual([
      [24, 25, 26],
      [27, 28, 29],
    ]);
    for (const probeBudget of probeSchedule.byBudget) {
      const canonicalBudget = schedule.byBudget.find((entry) => entry.budget === probeBudget.budget)!;
      expect(probeBudget.actualSeeds.some((seed) => canonicalBudget.actualSeeds.includes(seed))).toBe(false);
    }
    expect(policy.executionPolicyFingerprint).toHaveLength(64);
    expect(executionPolicyIdentity({ ...policyInput, implementationFingerprint: "operational-change" })
      .executionPolicyFingerprint).toBe(policy.executionPolicyFingerprint);
  });
});
