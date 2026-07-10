import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BENCHMARK_EXECUTION_PROTOCOL } from "../benchmark/v2/decision-policy.ts";
import { runDecisionCommand } from "../scripts/v0/benchmark_v2/decide.ts";
import {
  summarizeDevelopmentBudget,
  weightedBudgetHeadline,
  type V2RunScore,
} from "../scripts/v0/benchmark_v2/evaluator.ts";
import { loadSourceManifest, resolveSources } from "../scripts/v0/benchmark_v2/model.ts";
import {
  COMPILER_IDENTITY_PROTOCOL,
  RUN_ARCHIVE_SCHEMA,
} from "../scripts/v0/benchmark_v2/runner.ts";
import {
  executionPolicyIdentity,
  loadSuiteManifest,
  resolvedSeedSchedule,
  suiteIdentity,
} from "../scripts/v0/benchmark_v2/suite_model.ts";

const sourcePath = "benchmark/v2/compat/source-manifest.json";
const suitePath = "benchmark/v2/compat/suite-manifest.json";
const sources = resolveSources(loadSourceManifest(sourcePath));
const suite = loadSuiteManifest(suitePath, sources);

afterEach(() => vi.restoreAllMocks());

describe("Benchmark V2 decision command", () => {
  test("writes a checksummed screening artifact and tolerates operational implementation changes", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const dir = mkdtempSync(join(tmpdir(), "v2-decide-"));
    const base = writeArchive(dir, "base", 500, "implementation-a", {});
    const candidate = writeArchive(dir, "candidate", 520, "implementation-b", { LR_TEST_CANDIDATE: "1" });
    const out = join(dir, "decision.json");

    const exitCode = runDecisionCommand([
      candidate,
      `--base=${base}`,
      `--out=${out}`,
      "--no-gate-exit",
    ]);
    const artifact = JSON.parse(readFileSync(out, "utf8"));

    expect(exitCode).toBe(0);
    expect(artifact.schema).toBe("line.benchmark-v2.decision.v2");
    expect(artifact.result.outcome).toBe("advance");
    expect(artifact.result.promotable).toBe(false);
    expect(artifact.implementationFingerprintsMatch).toBe(false);
    expect(artifact.result.confidence.lowerBound).toBeGreaterThan(0);
    const bytes = readFileSync(out);
    expect(readFileSync(`${out}.sha256`, "utf8")).toContain(sha256(bytes));
  });

  test("refuses worker failures, engine changes, and corrupted archive bytes", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const dir = mkdtempSync(join(tmpdir(), "v2-decide-"));
    const base = writeArchive(dir, "base", 500, "implementation", {});
    const failed = writeArchive(dir, "failed", 500, "implementation", { LR_FAILURE: "1" }, (archive) => {
      archive.runs[0].status = "error";
    });
    expect(() => runDecisionCommand([failed, `--base=${base}`, "--no-gate-exit"]))
      .toThrow(/worker failures/);

    const engineChanged = writeArchive(dir, "engine", 500, "implementation", {}, (archive) => {
      archive.git.engineArtifactFingerprint = "different-engine";
      archive.git.candidateFingerprint = candidateFingerprint(
        archive.git.compilerSourceFingerprint,
        archive.git.compilerEnvironment,
        "different-engine",
      );
    });
    expect(() => runDecisionCommand([engineChanged, `--base=${base}`, "--no-gate-exit"]))
      .toThrow(/different engine artifacts/);

    const staleIdentity = writeArchive(dir, "stale-identity", 500, "implementation", {}, (archive) => {
      archive.git.compilerIdentityProtocol = "line.compiler-source-identity.v1";
    });
    expect(() => runDecisionCommand([staleIdentity, `--base=${base}`, "--no-gate-exit"]))
      .toThrow(/compiler identity protocol is stale/);

    const incompleteBoundary = writeArchive(dir, "incomplete-boundary", 500, "implementation", {}, (archive) => {
      archive.git.compilerSourceFiles = archive.git.compilerSourceFiles.filter(
        (path: string) => path !== "scripts/v0/score.ts",
      );
    });
    expect(() => runDecisionCommand([incompleteBoundary, `--base=${base}`, "--no-gate-exit"]))
      .toThrow(/compiler source boundary is incomplete/);

    writeFileSync(base, `${readFileSync(base, "utf8")} `);
    expect(() => runDecisionCommand([engineChanged, `--base=${base}`, "--no-gate-exit"]))
      .toThrow(/checksum mismatch/);
  });

  test("requires an explicit positive simplification margin", () => {
    expect(() => runDecisionCommand(["/tmp/candidate.json", "--mode=simplification"]))
      .toThrow(/--margin/);
    expect(() => runDecisionCommand(["/tmp/candidate.json", "--margin=0.1"]))
      .toThrow(/only valid in simplification/);
  });
});

function writeArchive(
  dir: string,
  name: string,
  scoreValue: number,
  implementationFingerprint: string,
  compilerEnvironment: Record<string, string>,
  mutate?: (archive: any) => void,
): string {
  const profile = suite.profiles.probe;
  const schedule = resolvedSeedSchedule(suite, "probe", profile.budgets, profile.seeds_per_budget);
  const suiteId = suiteIdentity(suitePath, sourcePath, sources);
  const execution = executionPolicyIdentity({
    suiteFingerprint: suiteId.suiteFingerprint,
    executionProtocol: BENCHMARK_EXECUTION_PROTOCOL,
    implementationFingerprint,
    engine: "wasm",
    compiler: "compileHandoff",
    profile: "probe",
    budgets: [...profile.budgets],
    seedSchedule: schedule,
    sources: sources.map((source) => ({
      id: source.id,
      role: source.role,
      sourceFingerprint: source.sourceFingerprint,
    })),
    transform: suite.transform,
  });
  const runs = schedule.byBudget.flatMap(({ budget, actualSeeds }) =>
    actualSeeds.flatMap((actualSeed, seedSlot) => sources.map((source) => ({
      status: "ok",
      task: {
        mode: "development",
        sourceId: source.id,
        budget,
        seedSlot,
        actualSeed,
        joltMs: suite.transform.jolt_ms,
      },
      score: runScore(scoreValue),
    })))
  );
  const aggregateRuns = runs.map((row) => ({
    sourceId: row.task.sourceId,
    budget: row.task.budget,
    seedSlot: row.task.seedSlot,
    actualSeed: row.task.actualSeed,
    score: row.score,
  }));
  const summaries = profile.budgets.map((budget) => summarizeDevelopmentBudget(aggregateRuns, budget, suite));
  const compilerSourceFingerprint = "compiler-source";
  const engineArtifactFingerprint = "engine-artifact";
  const archive: any = {
    schema: RUN_ARCHIVE_SCHEMA,
    mode: "development",
    profile: "probe",
    identity: { ...suiteId, ...execution },
    environment: { node: process.version, platform: process.platform, architecture: process.arch },
    git: {
      compilerIdentityProtocol: COMPILER_IDENTITY_PROTOCOL,
      compilerSourceFingerprint,
      compilerSourceFiles: [
        "package.json",
        "package-lock.json",
        "tsconfig.json",
        "scripts/v0/optimizer/handoff.ts",
        "scripts/v0/score.ts",
        "scripts/lib/detector.ts",
        "engine-rs/Cargo.toml",
      ],
      compilerEnvironment,
      engineArtifactFingerprint,
      candidateFingerprint: candidateFingerprint(
        compilerSourceFingerprint,
        compilerEnvironment,
        engineArtifactFingerprint,
      ),
    },
    canonicalHeadline: weightedBudgetHeadline(summaries, suite.budget_weights),
    runs,
  };
  mutate?.(archive);
  const path = join(dir, `${name}.json`);
  const bytes = Buffer.from(`${JSON.stringify(archive)}\n`);
  writeFileSync(path, bytes);
  writeFileSync(`${path}.sha256`, `${sha256(bytes)}  ${path}\n`);
  return path;
}

function runScore(score: number): V2RunScore {
  return {
    schema: "line.benchmark-v2.run-score.v2",
    score,
    valid: true,
    scoringMode: "axis_quality",
    hardFailures: [],
    contacts: { authored: 1, reported: 1, hit: 1, drift: 0, missing: 0 },
    offBeatLandings: 0,
    terminus: { frame: 1, reason: "endOfSpec" },
    weightedAxisRms: 0,
    expectedObservations: {},
    components: {},
    diagnostics: {},
  };
}

function candidateFingerprint(
  compilerSourceFingerprint: string,
  compilerEnvironment: Record<string, string>,
  engineArtifactFingerprint: string,
): string {
  return sha256(JSON.stringify({
    compilerIdentityProtocol: COMPILER_IDENTITY_PROTOCOL,
    compilerSourceFingerprint,
    compilerEnvironment,
    engine: "wasm",
    engineArtifactFingerprint,
  }));
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
