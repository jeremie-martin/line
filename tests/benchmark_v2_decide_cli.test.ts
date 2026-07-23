import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BENCHMARK_EXECUTION_PROTOCOL } from "../benchmark/v2/decision-policy.ts";
import {
  loadValidatedDecisionPairForCalibration,
  runDecisionCommand,
} from "../scripts/v0/benchmark_v2/decide.ts";
import { COMPILER_IDENTITY_PROTOCOL } from "../scripts/v0/benchmark_v2/runner.ts";
import { executionPolicyIdentity } from "../scripts/v0/benchmark_v2/suite_model.ts";

const retainedProbe = JSON.parse(readFileSync("benchmark/v2/probe-baseline.json", "utf8"))
  .probe.compressed_archive as string;

afterEach(() => vi.restoreAllMocks());

describe("Benchmark V2 decision command", () => {
  test("rescoring raw reports writes a checksummed screening artifact", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const dir = mkdtempSync(join(tmpdir(), "v2-decide-"));
    const out = join(dir, "decision.json");

    const exitCode = await runDecisionCommand([
      retainedProbe,
      `--out=${out}`,
      "--no-gate-exit",
    ]);
    const artifact = JSON.parse(readFileSync(out, "utf8"));

    expect(exitCode).toBe(0);
    expect(artifact.schema).toBe("line.benchmark-v2.decision.v4");
    expect(artifact.result.outcome).toBe("unresolved");
    expect(artifact.result.promotable).toBe(false);
    expect(artifact.implementationFingerprintsMatch).toBe(true);
    expect(artifact.runnerCompatibilityApproval).toBeNull();
    expect(artifact.result.confidence.lowerBound).toBe(0);
    const bytes = readFileSync(out);
    expect(readFileSync(`${out}.sha256`, "utf8")).toContain(sha256(bytes));
  });

  test("refuses failures, identity gaps, and evidence tampering while reporting runner drift", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const dir = mkdtempSync(join(tmpdir(), "v2-decide-"));
    const base = materialize(dir, "base");

    const failed = materialize(dir, "failed", (archive) => {
      archive.runs[0].status = "error";
    });
    await expect(runDecisionCommand([failed, `--base=${base}`, "--no-gate-exit"]))
      .rejects.toThrow(/worker failures/);

    const engineChanged = materialize(dir, "engine", (archive) => {
      archive.git.engineArtifactFingerprint = "different-engine";
      archive.git.candidateFingerprint = candidateFingerprint(archive);
    });
    await expect(runDecisionCommand([engineChanged, `--base=${base}`, "--no-gate-exit"]))
      .rejects.toThrow(/different engine artifacts/);

    const staleIdentity = materialize(dir, "stale-identity", (archive) => {
      archive.git.compilerIdentityProtocol = "line.compiler-source-identity.v1";
    });
    await expect(runDecisionCommand([staleIdentity, `--base=${base}`, "--no-gate-exit"]))
      .rejects.toThrow(/compiler identity protocol is stale/);

    const incompleteBoundary = materialize(dir, "incomplete-boundary", (archive) => {
      archive.git.compilerSourceFiles = archive.git.compilerSourceFiles.filter(
        (path: string) => path !== "scripts/v0/score.ts",
      );
    });
    await expect(runDecisionCommand([incompleteBoundary, `--base=${base}`, "--no-gate-exit"]))
      .rejects.toThrow(/compiler source boundary is incomplete/);

    const tamperedScore = materialize(dir, "tampered-score", (archive) => {
      archive.runs[0].score.score -= 1;
      archive.canonicalHeadline -= 1;
    });
    await expect(runDecisionCommand([tamperedScore, `--base=${base}`, "--no-gate-exit"]))
      .rejects.toThrow(/stored score does not match/);

    const tamperedReport = materialize(dir, "tampered-report", (archive) => {
      const firstGap = archive.runs[0].report.gaps.find((gap: any) => Object.keys(gap.axes).length > 0);
      const axis = Object.keys(firstGap.axes)[0];
      firstGap.axes[axis].error += 0.1;
    });
    await expect(runDecisionCommand([tamperedReport, `--base=${base}`, "--no-gate-exit"]))
      .rejects.toThrow(/stored score does not match/);

    const runnerChanged = materialize(dir, "runner-changed", (archive) => {
      archive.identity.implementationFingerprint = "unapproved-runner";
      archive.identity.executionPolicyFingerprint = executionPolicyIdentity({
        suiteFingerprint: archive.identity.suiteFingerprint,
        executionProtocol: BENCHMARK_EXECUTION_PROTOCOL,
        listeningReviewFingerprint: archive.identity.listeningReviewFingerprint,
        implementationFingerprint: archive.identity.implementationFingerprint,
        engine: archive.identity.engine,
        compiler: archive.identity.compiler,
        profile: archive.identity.profile,
        budgets: archive.identity.budgets,
        seedSchedule: archive.identity.seedSchedule,
        sources: archive.identity.sources,
        transform: archive.identity.transform,
      }).executionPolicyFingerprint;
    });
    await expect(runDecisionCommand([
      runnerChanged,
      `--base=${base}`,
      `--out=${join(dir, "runner-changed-decision.json")}`,
      "--no-gate-exit",
    ])).resolves.toBe(0);

    writeFileSync(base, `${readFileSync(base, "utf8")} `);
    await expect(runDecisionCommand([engineChanged, `--base=${base}`, "--no-gate-exit"]))
      .rejects.toThrow(/checksum mismatch/);
  });

  test("requires an explicit positive simplification margin", async () => {
    await expect(runDecisionCommand(["/tmp/candidate.json", "--mode=simplification"]))
      .rejects.toThrow(/--margin/);
    await expect(runDecisionCommand(["/tmp/candidate.json", "--margin=0.1"]))
      .rejects.toThrow(/only valid in simplification/);
  });

  test("refuses exploration-only archives in every decision mode", async () => {
    const dir = mkdtempSync(join(tmpdir(), "v2-decide-exploration-"));
    const ordinary = writeArtifact(join(dir, "ordinary.json"), { schema: "placeholder", profile: "probe" });
    const exploration = writeArtifact(join(dir, "exploration.json"), {
      exploration: {
        schema: "line.benchmark-v2.exploration-run.v1",
        authority: "exploration-only",
        id: "test/round-001",
        seedBase: 3_100_000_000,
        seedsPerBudget: 3,
      },
    });
    await expect(runDecisionCommand([exploration, `--base=${ordinary}`, "--no-gate-exit"]))
      .rejects.toThrow(/descriptive only/);
    await expect(runDecisionCommand([ordinary, `--base=${exploration}`, "--no-gate-exit"]))
      .rejects.toThrow(/descriptive only/);
  });

  test("allows historical runner provenance in ordinary comparisons and calibration replay", async () => {
    const calibrationProbe = "benchmark/v2/runs/calibration-v2.6-probe-baseline.json.gz";

    const dir = mkdtempSync(join(tmpdir(), "v2-decide-history-"));
    await expect(runDecisionCommand([
      calibrationProbe,
      `--out=${join(dir, "historical-decision.json")}`,
      "--no-gate-exit",
    ])).resolves.toBe(0);
    const validated = await loadValidatedDecisionPairForCalibration(calibrationProbe, calibrationProbe);
    expect(validated.baseRuns).toHaveLength(264);
    expect(validated.candidateRuns).toEqual(validated.baseRuns);
  });
});

function materialize(dir: string, name: string, mutate?: (archive: any) => void): string {
  const archive = JSON.parse(gunzipSync(readFileSync(retainedProbe)).toString("utf8"));
  mutate?.(archive);
  const path = join(dir, `${name}.json`);
  const bytes = Buffer.from(`${JSON.stringify(archive)}\n`);
  writeFileSync(path, bytes);
  writeFileSync(`${path}.sha256`, `${sha256(bytes)}  ${path}\n`);
  return path;
}

function candidateFingerprint(archive: any): string {
  expect(archive.git.compilerIdentityProtocol).toBe(COMPILER_IDENTITY_PROTOCOL);
  return sha256(JSON.stringify({
    compilerIdentityProtocol: archive.git.compilerIdentityProtocol,
    compilerSourceFingerprint: archive.git.compilerSourceFingerprint,
    compilerEnvironment: archive.git.compilerEnvironment,
    engine: archive.identity.engine,
    engineArtifactFingerprint: archive.git.engineArtifactFingerprint,
  }));
}

function writeArtifact(path: string, value: unknown): string {
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
  writeFileSync(path, bytes);
  writeFileSync(`${path}.sha256`, `${sha256(bytes)}  ${path}\n`);
  return path;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
