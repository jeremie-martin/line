/**
 * Promote one explicit cached-comparison artifact.
 *
 * There is no implicit "latest attempt" and no governance state. The artifact
 * names the candidate archive and exact compiler snapshot. Rebaseline verifies
 * those bytes, runs the small probe and qualification sidecar, then publishes
 * the ordinary compact baseline references through a recoverable journal.
 */

import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { resolve } from "node:path";
import { createGunzip } from "node:zlib";
import { assertCompilerSourcesCommitted } from "./compiler_identity.ts";
import {
  createSnapshotWorkspace,
  disposeSnapshotWorkspace,
  runInWorkspace,
  validateCompilerSnapshot,
  type CompilerSnapshot,
  type SnapshotBenchmarkRun,
} from "./compiler_snapshot.ts";
import {
  discardUntouchedPendingBaselinePublication,
  publishBaseline,
  recoverPendingBaselinePublication,
} from "./baseline_publication.ts";
import { copyFileDurable, writeFileAtomicDurable } from "./durable_fs.ts";
import { requireCurrentDecisionCalibration } from "./calibration_guard.ts";
import { loadSourceManifest, resolveSources } from "./model.ts";
import { compilerCandidateIdentity } from "./runner.ts";
import { suiteIdentity } from "./suite_model.ts";
import type { CachedComparisonArtifact } from "./eval.ts";

export async function runRebaselineCommand(argv = process.argv.slice(2)): Promise<number> {
  const argument = (name: string): string | undefined =>
    argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (process.env.LR_ENGINE !== "wasm") throw new Error(`rebaseline requires LR_ENGINE=wasm`);
  const allowedValues = new Set(["from", "label", "archive-dir", "out-dir", "jobs"]);
  for (const value of argv) {
    if (value === "--resume" || value === "--discard-pending") continue;
    if (!value.startsWith("--")) throw new Error(`rebaseline does not accept positional argument ${value}`);
    const equals = value.indexOf("=");
    const name = value.slice(2, equals === -1 ? undefined : equals);
    if (equals === -1 || !allowedValues.has(name)) throw new Error(`unsupported rebaseline flag ${value}`);
  }
  if (argv.includes("--discard-pending")) {
    discardUntouchedPendingBaselinePublication();
    console.log(`discarded an untouched pending baseline publication`);
    return 0;
  }
  if (recoverPendingBaselinePublication()) {
    console.log(`recovered the pending baseline publication`);
    return 0;
  }

  const from = argument("from");
  const label = argument("label");
  if (from === undefined || from.trim() === "") {
    throw new Error(`rebaseline requires --from=<cached comparison artifact>`);
  }
  if (label === undefined || label.trim() === "") throw new Error(`rebaseline requires --label=<new baseline label>`);
  const safeLabel = label.replace(/[^a-zA-Z0-9_.-]+/g, "-");
  const jobs = Number(argument("jobs") ?? Math.min(48, availableParallelism()));
  if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 48) throw new Error(`--jobs must be an integer in 1..48`);
  const archiveDir = resolve(argument("archive-dir") ?? "benchmark/v2/runs");
  const outDir = resolve(argument("out-dir") ?? "generated/benchmark-v2/rebaseline");
  mkdirSync(archiveDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const artifactPath = resolve(from);
  const artifact = readComparisonArtifact(artifactPath);
  if (artifact.decision.result.outcome !== "accept") {
    throw new Error(
      `comparison result is ${artifact.decision.result.outcome}, not a supported improvement; ` +
      `collect clearer evidence or keep iterating`,
    );
  }
  const candidatePath = resolve(artifact.candidate.archivePath);
  if (!existsSync(candidatePath) || !existsSync(`${candidatePath}.gz`)) {
    throw new Error(`comparison candidate archive is missing; restore ${artifact.candidate.archivePath}`);
  }
  if (await sha256Stream(createReadStream(candidatePath)) !== artifact.candidate.archiveSha256) {
    throw new Error(`comparison candidate archive checksum mismatch`);
  }
  if (await sha256Stream(createReadStream(`${candidatePath}.gz`)) !== artifact.candidate.compressedArchiveSha256) {
    throw new Error(`comparison compressed candidate archive checksum mismatch`);
  }

  validateCompilerSnapshot(artifact.candidate.snapshot);
  assertCompilerSourcesCommitted();
  const current = compilerCandidateIdentity("wasm");
  if (current.candidateFingerprint !== artifact.candidate.snapshot.candidateFingerprint) {
    throw new Error(`the checked-out compiler is not the candidate measured by the comparison artifact`);
  }

  const retainedSnapshotPath = resolve(archiveDir, `${safeLabel}-compiler-snapshot.tar.gz`);
  copyFileDurable(resolve(artifact.candidate.snapshot.archive), retainedSnapshotPath);
  const retainedSnapshot: CompilerSnapshot = {
    ...artifact.candidate.snapshot,
    archive: relativeToCwd(retainedSnapshotPath),
  };
  validateCompilerSnapshot(retainedSnapshot);

  let workspace: ReturnType<typeof createSnapshotWorkspace> | undefined;
  try {
    workspace = createSnapshotWorkspace(retainedSnapshot);
    const probePath = resolve(outDir, `${safeLabel}-probe.json`);
    const qualificationPath = resolve(outDir, `${safeLabel}-qualification.json`);
    const common = runnerBaseArgs(jobs);
    console.log(`rebaseline ${safeLabel}: refreshing the quick baseline reference`);
    const probe = runInWorkspace(workspace, "development", [
      "--profile=probe",
      ...common,
      ...(argv.includes("--resume") ? ["--resume"] : []),
    ], probePath);
    assertSuccessful(probe, "probe");

    console.log(`rebaseline ${safeLabel}: running the qualification sidecar`);
    const qualification = runInWorkspace(workspace, "qualification", [
      "--profile=canonical",
      ...common,
      `--development-archive=${candidatePath}`,
      ...(argv.includes("--resume") ? ["--resume"] : []),
    ], qualificationPath);
    assertSuccessful(qualification, "qualification");

    const retainedProbe = retainRun(probe, archiveDir, `${safeLabel}-probe`);
    const retainedDevelopment = retainExistingRun(
      candidatePath,
      artifact.candidate.archiveSha256,
      artifact.candidate.compressedArchiveSha256,
      archiveDir,
      `${safeLabel}-development`,
    );
    const retainedQualification = retainRun(qualification, archiveDir, `${safeLabel}-qualification`);

    const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
    const identity = suiteIdentity(
      "benchmark/v2/compat/suite-manifest.json",
      "benchmark/v2/compat/source-manifest.json",
      sources,
    );
    const bundlePath = resolve(archiveDir, `${safeLabel}-baseline.json`);
    const bundle = {
      schema: "line.benchmark-v2.baseline-bundle.v3",
      label: safeLabel,
      generatedAt: new Date().toISOString(),
      promotedComparison: {
        artifact: relativeToCwd(artifactPath),
        artifactSha256: await sha256Stream(createReadStream(artifactPath)),
        seeds: artifact.base.seeds,
      },
      compilerSnapshot: retainedSnapshot,
      decisionContract: requireCurrentDecisionCalibration(identity.suiteFingerprint),
      probe: await retainedEntry(retainedProbe),
      development: await retainedEntry(retainedDevelopment),
      qualification: await retainedEntry(retainedQualification),
    };
    writeFileAtomicDurable(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
    assertBaselineBundleLabel(bundlePath, safeLabel);
    publishBaseline(bundlePath);
    console.log(`rebaselined to ${safeLabel}`);
    console.log(`  nextCommand: npm run benchmark -- eval`);
    return 0;
  } finally {
    if (workspace !== undefined) disposeSnapshotWorkspace(workspace);
  }
}

function readComparisonArtifact(path: string): CachedComparisonArtifact {
  const bytes = readFileSync(path);
  const sidecarPath = `${path}.sha256`;
  if (existsSync(sidecarPath)) {
    const expected = readFileSync(sidecarPath, "utf8").trim().split(/\s+/)[0];
    if (expected !== createHash("sha256").update(bytes).digest("hex")) {
      throw new Error(`comparison artifact checksum mismatch`);
    }
  }
  const artifact = JSON.parse(bytes.toString("utf8")) as CachedComparisonArtifact;
  if (
    artifact.schema !== "line.benchmark-v2.cached-comparison.v1" ||
    artifact.status !== "complete" ||
    typeof artifact.candidate?.archivePath !== "string" ||
    artifact.candidate?.snapshot === undefined ||
    artifact.decision?.result === undefined
  ) {
    throw new Error(`unsupported cached comparison artifact`);
  }
  return artifact;
}

function runnerBaseArgs(jobs: number): string[] {
  return [
    `--manifest=${resolve("benchmark/v2/compat/source-manifest.json")}`,
    `--heldout-manifest=${resolve("benchmark/v2/compat/heldout-manifest.json")}`,
    `--suite=${resolve("benchmark/v2/compat/suite-manifest.json")}`,
    `--characterization=${resolve("benchmark/v2/evidence/characterization.json")}`,
    `--audit=${resolve("benchmark/v2/evidence/audit.json")}`,
    `--review=${resolve("benchmark/v2/evidence/candidate-review.json")}`,
    `--listening-review=${resolve("benchmark/v2/evidence/listening-review.json")}`,
    `--jobs=${jobs}`,
  ];
}

function assertSuccessful(run: SnapshotBenchmarkRun, label: string): void {
  if (run.workerFailures > 0) throw new Error(`${label} has worker failures; rerun rebaseline with --resume`);
}

function retainRun(run: SnapshotBenchmarkRun, archiveDir: string, stem: string): string {
  return retainExistingRun(
    run.outputPath,
    run.archiveSha256,
    run.compressedArchiveSha256,
    archiveDir,
    stem,
  );
}

function retainExistingRun(
  rawPath: string,
  archiveSha256: string,
  compressedSha256: string,
  archiveDir: string,
  stem: string,
): string {
  const retained = resolve(archiveDir, `${stem}.json.gz`);
  copyFileDurable(`${rawPath}.gz`, retained);
  writeFileAtomicDurable(`${retained}.sha256`, `${compressedSha256}  ${relativeToCwd(retained)}\n`);
  const index = `${rawPath}.decision-index.json`;
  if (existsSync(index)) {
    copyFileDurable(index, resolve(archiveDir, `${stem}.decision-index.json`));
    copyFileDurable(`${index}.sha256`, resolve(archiveDir, `${stem}.decision-index.json.sha256`));
  }
  // The raw checksum is recorded in the bundle entry below.
  writeFileAtomicDurable(`${retained}.archive.sha256`, `${archiveSha256}  ${relativeToCwd(rawPath)}\n`);
  return retained;
}

async function retainedEntry(compressedPath: string): Promise<{
  retainedCompressedArchive: string;
  compressedSha256: string;
  sha256: string;
}> {
  return {
    retainedCompressedArchive: relativeToCwd(compressedPath),
    compressedSha256: await sha256Stream(createReadStream(compressedPath)),
    sha256: await sha256Stream(createReadStream(compressedPath).pipe(createGunzip())),
  };
}

export function assertBaselineBundleLabel(bundlePath: string, expectedLabel: string): void {
  const bundle = JSON.parse(readFileSync(resolve(bundlePath), "utf8"));
  if (bundle.schema !== "line.benchmark-v2.baseline-bundle.v3") {
    throw new Error(`unsupported baseline bundle`);
  }
  if (typeof bundle.label !== "string" || bundle.label.trim() === "") {
    throw new Error(`baseline bundle label must be a non-empty string`);
  }
  if (bundle.label !== expectedLabel) {
    throw new Error(
      `rebaseline label ${JSON.stringify(expectedLabel)} does not match bundle label ${JSON.stringify(bundle.label)}`,
    );
  }
}

async function sha256Stream(stream: AsyncIterable<Buffer | string>): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

function relativeToCwd(path: string): string {
  const prefix = `${process.cwd()}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}
