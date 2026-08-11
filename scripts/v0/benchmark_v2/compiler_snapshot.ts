import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { COMPILER_SOURCE_PATHS, compilerCandidateIdentity } from "./compiler_identity.ts";
import { FROZEN_SCALE_STUDY_SCHEMA } from "./scale_profile.ts";
import {
  readVerifiedArtifact,
  verifyArtifactChecksumSync,
} from "../../benchmark/study_lib.ts";

const ENGINE_ARTIFACT = "engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm";
export const SNAPSHOT_WORKSPACE_PREFIX = "line-v2-baseline-";
export const SNAPSHOT_WORKSPACE_OWNER = ".line-v2-workspace-owner.json";
const MARKERLESS_WORKSPACE_GRACE_MS = 10 * 60_000;

export type CompilerSnapshot = {
  schema: "line.benchmark-v2.compiler-snapshot.v1";
  archive: string;
  archiveSha256: string;
  candidateFingerprint: string;
  compilerSourceFingerprint: string;
  compilerEnvironment: Record<string, string>;
  engineArtifactFingerprint: string;
};

export type SnapshotBenchmarkRun = {
  mode: "development" | "qualification";
  outputPath: string;
  summaryPath: string;
  decisionIndexPath?: string;
  archiveSha256: string;
  compressedArchiveSha256: string;
  headline: number | null;
  qualificationMonitorScore: number | null;
  workerFailures: number;
};

export type SnapshotScaleRun = {
  outputPath: string;
  archiveSha256: string;
  compressedArchiveSha256: string;
  scaleHeadline: number;
  workerFailures: number;
};

export function createCompilerSnapshot(label: string, archiveDir: string): CompilerSnapshot {
  const identity = compilerCandidateIdentity("wasm");
  if (identity.engineArtifactFingerprint === null || !existsSync(ENGINE_ARTIFACT)) {
    throw new Error(`the optimized WASM engine artifact is required for a baseline snapshot`);
  }
  const safeLabel = label.replace(/[^a-zA-Z0-9_.-]+/g, "-");
  const archive = resolve(archiveDir, `${safeLabel}-compiler-snapshot.tar.gz`);
  const temporary = `${archive}.tmp`;
  mkdirSync(dirname(archive), { recursive: true });
  execFileSync("tar", ["-czf", temporary, ...identity.compilerSourceFiles, ENGINE_ARTIFACT], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  rmSync(archive, { force: true });
  execFileSync("mv", [temporary, archive]);
  return {
    schema: "line.benchmark-v2.compiler-snapshot.v1",
    archive: relativeToCwd(archive),
    archiveSha256: sha256(readFileSync(archive)),
    candidateFingerprint: identity.candidateFingerprint,
    compilerSourceFingerprint: identity.compilerSourceFingerprint,
    compilerEnvironment: identity.compilerEnvironment,
    engineArtifactFingerprint: identity.engineArtifactFingerprint,
  };
}

export function validateCompilerSnapshot(snapshot: CompilerSnapshot): void {
  if (snapshot.schema !== "line.benchmark-v2.compiler-snapshot.v1") {
    throw new Error(`unsupported baseline compiler snapshot`);
  }
  const archive = resolve(snapshot.archive);
  if (!existsSync(archive) || sha256(readFileSync(archive)) !== snapshot.archiveSha256) {
    throw new Error(`baseline compiler snapshot is missing or has a checksum mismatch`);
  }
  for (const value of [
    snapshot.archiveSha256,
    snapshot.candidateFingerprint,
    snapshot.compilerSourceFingerprint,
    snapshot.engineArtifactFingerprint,
  ]) {
    if (!/^[a-f0-9]{64}$/.test(value)) throw new Error(`baseline compiler snapshot identity is malformed`);
  }
  if (
    snapshot.compilerEnvironment === null || typeof snapshot.compilerEnvironment !== "object" ||
    Array.isArray(snapshot.compilerEnvironment) ||
    Object.entries(snapshot.compilerEnvironment).some(([name, value]) =>
      !name.startsWith("LR_") || name === "LR_ENGINE" || typeof value !== "string"
    )
  ) throw new Error(`baseline compiler snapshot environment is malformed`);
}

export function runSnapshotDevelopment(
  snapshot: CompilerSnapshot,
  args: string[],
  outputPath: string,
): void {
  runSnapshotBenchmark(snapshot, "development", args, outputPath);
}

export type SnapshotWorkspace = {
  snapshot: CompilerSnapshot;
  directory: string;
  disposed: boolean;
};

/**
 * Materialize a snapshot compiler once (worktree + tracked overlay + npm ci,
 * ~1-2 min)
 * so wave-based execution can run many benchmark invocations against it.
 * Callers own the lifecycle: always disposeSnapshotWorkspace in a finally.
 */
export function createSnapshotWorkspace(snapshot: CompilerSnapshot): SnapshotWorkspace {
  validateCompilerSnapshot(snapshot);
  cleanupStaleSnapshotWorkspaces();
  const workspace = allocateSnapshotWorkspacePath();
  let worktreeCreated = false;
  try {
    execFileSync("git", ["worktree", "add", "--detach", workspace, "HEAD"], { stdio: diagnosticStdio() });
    worktreeCreated = true;
    writeFileSync(resolve(workspace, SNAPSHOT_WORKSPACE_OWNER), `${JSON.stringify({
      schema: "line.benchmark-v2.snapshot-workspace-owner.v1",
      pid: process.pid,
      processStart: processStart(process.pid),
      createdAt: new Date().toISOString(),
    })}\n`);
    // The detached worktree already has every committed file. Overlay only
    // tracked working-tree paths so dirty source edits are visible without ever
    // copying untracked/generated media into the temporary workspace.
    const trackedFiles = materializedTrackedFiles(
      execFileSync("git", ["ls-files", "-z"], { cwd: process.cwd() }),
      process.cwd(),
    );
    execFileSync("rsync", [
      "-a",
      "--from0",
      "--files-from=-",
      "./",
      `${workspace}/`,
    ], {
      cwd: process.cwd(),
      input: trackedFiles,
      stdio: diagnosticStdioWithInput(),
    });
    // Benchmark-runner modules belong to the governed execution framework,
    // not the frozen compiler candidate.  Keep this boundary explicit: a
    // historical compiler snapshot may predate a newly added runner module,
    // while the current runner still has to execute that snapshot.  Rsync the
    // complete framework directory so untracked-in-progress modules are also
    // available in the isolated worktree; `removeAmbientCompilerSources`
    // below still removes every compiler-bound source before extraction.
    mkdirSync(resolve(workspace, "scripts/v0/benchmark_v2"), { recursive: true });
    execFileSync("rsync", ["-a", "scripts/v0/benchmark_v2/", resolve(workspace, "scripts/v0/benchmark_v2/")], {
      cwd: process.cwd(),
      stdio: diagnosticStdio(),
    });
    // The compact scale profile is benchmark policy rather than compiler input.
    // Carry the current frozen profile beside the current runner even while it
    // is being developed as an untracked file in the owning worktree.
    const scaleProfile = resolve("benchmark/v2/scale-profile.json");
    if (existsSync(scaleProfile)) {
      mkdirSync(resolve(workspace, "benchmark/v2"), { recursive: true });
      copyFileSync(scaleProfile, resolve(workspace, "benchmark/v2/scale-profile.json"));
    }
    // The approved listening-review audio is validation evidence the runner
    // requires; it lives under the otherwise-excluded generated/ tree.
    if (existsSync("generated/benchmark-v2/listening-review")) {
      mkdirSync(resolve(workspace, "generated/benchmark-v2"), { recursive: true });
      execFileSync("cp", [
        "-r",
        "generated/benchmark-v2/listening-review",
        resolve(workspace, "generated/benchmark-v2/"),
      ], { stdio: diagnosticStdio() });
    }
    materializeDecisionCalibrationArtifacts(workspace);
    removeAmbientCompilerSources(workspace);
    execFileSync("tar", ["-xzf", resolve(snapshot.archive), "-C", workspace], { stdio: diagnosticStdio() });
    execFileSync("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: workspace,
      stdio: diagnosticStdio(),
    });
  } catch (error) {
    if (worktreeCreated) {
      execFileSync("git", ["worktree", "remove", "--force", workspace], { stdio: "ignore" });
    } else {
      rmSync(workspace, { recursive: true, force: true });
    }
    throw error;
  }
  return { snapshot, directory: workspace, disposed: false };
}

/**
 * `git ls-files` is an index listing, not a promise that every path still
 * exists in a dirty worktree. Snapshot overlays must tolerate a user-deleted
 * tracked file: the detached worktree already supplies its committed version.
 */
export function materializedTrackedFiles(paths: Buffer, root: string): Buffer {
  const materialized: Buffer[] = [];
  let start = 0;
  for (let end = paths.indexOf(0, start); end !== -1; end = paths.indexOf(0, start)) {
    const path = paths.subarray(start, end);
    start = end + 1;
    if (path.length === 0) continue;
    try {
      lstatSync(resolve(root, path.toString()));
      materialized.push(path);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    }
  }
  return Buffer.concat(materialized.flatMap((path) => [path, Buffer.from([0])]));
}

/** Reserve a collision-free name without leaving a directory that blocks git worktree add. */
export function allocateSnapshotWorkspacePath(root = tmpdir()): string {
  const path = mkdtempSync(resolve(root, SNAPSHOT_WORKSPACE_PREFIX));
  rmSync(path, { recursive: true, force: true });
  return path;
}

export function runInWorkspace(
  workspace: SnapshotWorkspace,
  mode: "development" | "qualification",
  args: string[],
  outputPath: string,
): SnapshotBenchmarkRun {
  if (workspace.disposed) throw new Error(`snapshot workspace was already disposed`);
  const environment = snapshotEnvironment(workspace.snapshot);
  execFileSync(process.execPath, [
    "--import",
    "tsx",
    "scripts/v0/benchmark_v2/run_benchmark.ts",
    `--runner-mode=${mode}`,
    ...args.filter((arg) => !arg.startsWith("--out=")),
    `--out=${resolve(outputPath)}`,
  ], {
    cwd: workspace.directory,
    env: environment,
    stdio: diagnosticStdio(),
  });
  const absoluteOutput = resolve(outputPath);
  if (!existsSync(absoluteOutput) && existsSync(`${absoluteOutput}.failed`)) {
    throw new Error(`snapshot run had worker failures; failed archive retained at ${absoluteOutput}.failed (re-run with --resume to retry)`);
  }
  const partialPath = `${absoluteOutput}.partial.json`;
  if (!existsSync(absoluteOutput) && existsSync(partialPath)) {
    // A subset wave (--through-seed-slot below the declared depth) assembles
    // no archive; surface the partial summary instead.
    const partialBytes = readFileSync(partialPath);
    const partial = JSON.parse(partialBytes.toString("utf8"));
    return {
      mode,
      outputPath: partialPath,
      summaryPath: partialPath,
      archiveSha256: sha256(partialBytes),
      compressedArchiveSha256: sha256(partialBytes),
      headline: null,
      qualificationMonitorScore: null,
      workerFailures: partial.workerFailures ?? 0,
    };
  }
  const summaryPath = `${absoluteOutput}.summary.json`;
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  if (
    typeof summary.archiveSha256 !== "string" || typeof summary.compressedArchiveSha256 !== "string" ||
    !Number.isSafeInteger(summary.workerFailures)
  ) {
    throw new Error(`snapshot run summary is incomplete at ${summaryPath}`);
  }
  return {
    mode,
    outputPath: absoluteOutput,
    summaryPath,
    decisionIndexPath: `${absoluteOutput}.decision-index.json`,
    archiveSha256: summary.archiveSha256,
    compressedArchiveSha256: summary.compressedArchiveSha256,
    headline: summary.canonicalHeadline,
    qualificationMonitorScore: summary.qualificationMonitorScore,
    workerFailures: summary.workerFailures,
  };
}

/** Execute the compact scale runner against the same isolated compiler
 * snapshot boundary used by canonical eval. The scale archive is already
 * checksummed and retains its own raw reports, stats, and telemetry. */
export function runScaleStudyInWorkspace(
  workspace: SnapshotWorkspace,
  args: string[],
  outputPath: string,
): SnapshotScaleRun {
  if (workspace.disposed) throw new Error(`snapshot workspace was already disposed`);
  const absoluteOutput = resolve(outputPath);
  execFileSync(process.execPath, [
    "--import",
    "tsx",
    "scripts/v0/benchmark_v2/scale_study.ts",
    ...args.filter((arg) => !arg.startsWith("--out=")),
    `--out=${absoluteOutput}`,
  ], {
    cwd: workspace.directory,
    env: snapshotEnvironment(workspace.snapshot),
    stdio: diagnosticStdio(),
  });
  if (!existsSync(absoluteOutput)) throw new Error(`scale runner did not publish ${absoluteOutput}`);
  const analysisPath = absoluteOutput.endsWith(".json")
    ? `${absoluteOutput.slice(0, -".json".length)}.analysis.json`
    : `${absoluteOutput}.analysis.json`;
  if (!existsSync(analysisPath)) throw new Error(`scale runner did not publish ${analysisPath}`);
  const analysis = readVerifiedArtifact(analysisPath);
  const archive = JSON.parse(analysis.bytes.toString("utf8"));
  const archiveSha256 = verifyArtifactChecksumSync(absoluteOutput);
  if (
    archive?.schema !== FROZEN_SCALE_STUDY_SCHEMA ||
    archive?.candidate?.candidateFingerprint !== workspace.snapshot.candidateFingerprint ||
    !Number.isFinite(archive.scaleHeadline) || !Array.isArray(archive.runs) ||
    archive.analysisProjection?.schema !== "line.benchmark-v2.scale-analysis-projection.v1" ||
    archive.analysisProjection.fullArchiveSha256 !== archiveSha256
  ) throw new Error(`snapshot scale archive is incomplete or detached from its compiler snapshot`);
  const compressedPath = `${absoluteOutput}.gz`;
  if (!existsSync(compressedPath)) throw new Error(`scale runner did not publish ${compressedPath}`);
  return {
    outputPath: absoluteOutput,
    archiveSha256,
    compressedArchiveSha256: verifyArtifactChecksumSync(compressedPath),
    scaleHeadline: archive.scaleHeadline,
    workerFailures: archive.runs.filter((run: { status?: string }) => run.status !== "ok").length,
  };
}

function snapshotEnvironment(snapshot: CompilerSnapshot): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (name.startsWith("LR_")) delete environment[name];
  }
  Object.assign(environment, snapshot.compilerEnvironment, { LR_ENGINE: "wasm" });
  return environment;
}

function diagnosticStdio(): "inherit" | ["inherit", NodeJS.WritableStream, NodeJS.WritableStream] {
  return process.env.LINE_BENCHMARK_JSON_STDOUT === "1"
    ? ["inherit", process.stderr, process.stderr]
    : "inherit";
}

function diagnosticStdioWithInput(): ["pipe", "inherit" | NodeJS.WritableStream, "inherit" | NodeJS.WritableStream] {
  return process.env.LINE_BENCHMARK_JSON_STDOUT === "1"
    ? ["pipe", process.stderr, process.stderr]
    : ["pipe", "inherit", "inherit"];
}

export function disposeSnapshotWorkspace(workspace: SnapshotWorkspace): void {
  if (workspace.disposed) return;
  workspace.disposed = true;
  execFileSync("git", ["worktree", "remove", "--force", workspace.directory], { stdio: "ignore" });
}

/** Remove only owner-dead (or old markerless legacy) snapshot workspaces. */
export function cleanupStaleSnapshotWorkspaces(options: {
  root?: string;
  markerlessGraceMs?: number;
  ownerAlive?: (owner: { pid: number; processStart: string | null }) => boolean;
} = {}): string[] {
  const root = resolve(options.root ?? tmpdir());
  if (!existsSync(root)) return [];
  const ownerAlive = options.ownerAlive ?? snapshotOwnerAlive;
  const grace = options.markerlessGraceMs ?? MARKERLESS_WORKSPACE_GRACE_MS;
  const removed: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(SNAPSHOT_WORKSPACE_PREFIX)) continue;
    const directory = resolve(root, entry.name);
    const marker = resolve(directory, SNAPSHOT_WORKSPACE_OWNER);
    let reclaim = false;
    if (existsSync(marker)) {
      try {
        const owner = JSON.parse(readFileSync(marker, "utf8"));
        reclaim =
          !Number.isSafeInteger(owner.pid) || owner.pid <= 0 ||
          !(typeof owner.processStart === "string" || owner.processStart === null) ||
          !ownerAlive({ pid: owner.pid, processStart: owner.processStart });
      } catch {
        reclaim = Date.now() - statSync(marker).mtimeMs >= grace;
      }
    } else {
      reclaim = Date.now() - statSync(directory).mtimeMs >= grace;
    }
    if (!reclaim) continue;
    try {
      execFileSync("git", ["worktree", "remove", "--force", directory], { stdio: "ignore" });
    } catch {
      rmSync(directory, { recursive: true, force: true });
    }
    if (existsSync(directory)) rmSync(directory, { recursive: true, force: true });
    removed.push(directory);
  }
  if (removed.length > 0) execFileSync("git", ["worktree", "prune"], { stdio: "ignore" });
  return removed;
}

export function runSnapshotBenchmark(
  snapshot: CompilerSnapshot,
  mode: "development" | "qualification",
  args: string[],
  outputPath: string,
): SnapshotBenchmarkRun {
  const workspace = createSnapshotWorkspace(snapshot);
  try {
    return runInWorkspace(workspace, mode, args, outputPath);
  } finally {
    disposeSnapshotWorkspace(workspace);
  }
}

export function removeAmbientCompilerSources(workspace: string): void {
  for (const path of COMPILER_SOURCE_PATHS) {
    rmSync(resolve(workspace, path), { recursive: true, force: true });
  }
}

/**
 * The canonical runner verifies the active calibration controls from its own
 * cwd. Those immutable archives are intentionally ignored because they are
 * large, so a snapshot workspace must carry the exact declared set explicitly.
 * Do not copy a generated directory: the calibration and coverage records are
 * the allow-list and each source byte is checked before and after copying.
 */
export function materializeDecisionCalibrationArtifacts(
  workspace: string,
  root = process.cwd(),
): string[] {
  const calibration = readJsonObject(
    resolve(root, "benchmark/v2/studies/decision-calibration.json"),
    "decision calibration",
  );
  const coverageStudy = calibration.coverageStudy;
  if (coverageStudy === null || typeof coverageStudy !== "object" || Array.isArray(coverageStudy)) {
    throw new Error(`decision calibration coverage study is malformed`);
  }
  const coveragePath = requiredArtifactPath(root, coverageStudy.path, "decision coverage study");
  const coverage = readJsonObject(coveragePath.absolute, "decision coverage study");
  const artifacts = new Map<string, { absolute: string; sha256: string; label: string }>();
  addCalibrationArtifact(
    artifacts,
    root,
    coverage.reference,
    coverage.referenceArtifactSha256,
    "zero-inflated coverage reference",
  );

  const controls = calibration.controls;
  if (controls === null || typeof controls !== "object" || Array.isArray(controls)) {
    throw new Error(`decision calibration controls are malformed`);
  }
  if (calibration.schema === "line.benchmark-v2.decision-calibration.v3") {
    const reference = calibration.scorerBoundReference;
    if (
      reference === null || typeof reference !== "object" || Array.isArray(reference) ||
      reference.path !== coverage.reference ||
      reference.sha256 !== coverage.referenceArtifactSha256
    ) throw new Error(`scorer-bound calibration reference is malformed`);
  } else {
    for (const name of ["identical", "knownBroadDegradation", "impactContractFailure"]) {
      const control = controls[name];
      if (control === null || typeof control !== "object" || Array.isArray(control)) {
        throw new Error(`${name} calibration control is malformed`);
      }
      addCalibrationArtifact(artifacts, root, control.baseArchive, control.baseArchiveSha256, `${name} base control`);
      addCalibrationArtifact(artifacts, root, control.candidateArchive, control.candidateArchiveSha256, `${name} candidate control`);
    }
  }

  for (const [path, artifact] of artifacts) {
    const destination = resolve(workspace, path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(artifact.absolute, destination);
    if (sha256(readFileSync(destination)) !== artifact.sha256) {
      throw new Error(`${artifact.label} changed while materializing snapshot workspace`);
    }
  }
  return [...artifacts.keys()].sort();
}

function addCalibrationArtifact(
  artifacts: Map<string, { absolute: string; sha256: string; label: string }>,
  root: string,
  path: unknown,
  expectedSha256: unknown,
  label: string,
): void {
  if (typeof expectedSha256 !== "string" || !/^[a-f0-9]{64}$/.test(expectedSha256)) {
    throw new Error(`${label} checksum is malformed`);
  }
  const source = requiredArtifactPath(root, path, label);
  if (!existsSync(source.absolute) || sha256(readFileSync(source.absolute)) !== expectedSha256) {
    throw new Error(`${label} is missing or does not match decision calibration`);
  }
  const prior = artifacts.get(source.relative);
  if (prior !== undefined && prior.sha256 !== expectedSha256) {
    throw new Error(`${label} conflicts with another declared calibration artifact`);
  }
  artifacts.set(source.relative, { absolute: source.absolute, sha256: expectedSha256, label });
}

function requiredArtifactPath(root: string, path: unknown, label: string): { absolute: string; relative: string } {
  if (typeof path !== "string" || path === "" || isAbsolute(path)) {
    throw new Error(`${label} path is malformed`);
  }
  const absolute = resolve(root, path);
  const projectRelative = relative(root, absolute);
  if (projectRelative === "" || projectRelative === ".." || projectRelative.startsWith(`..${sep}`) || isAbsolute(projectRelative)) {
    throw new Error(`${label} path escapes the project root`);
  }
  return { absolute, relative: projectRelative };
}

function readJsonObject(path: string, label: string): Record<string, any> {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`not an object`);
    return value;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(`${label} is unreadable${detail}`);
  }
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function relativeToCwd(path: string): string {
  const prefix = `${process.cwd()}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function snapshotOwnerAlive(owner: { pid: number; processStart: string | null }): boolean {
  try {
    process.kill(owner.pid, 0);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
  const current = processStart(owner.pid);
  return owner.processStart === null || current === null || owner.processStart === current;
}

function processStart(pid: number): string | null {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    return stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/)[19] ?? null;
  } catch {
    return null;
  }
}
