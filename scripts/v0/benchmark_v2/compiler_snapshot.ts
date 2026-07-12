import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { COMPILER_SOURCE_PATHS, compilerCandidateIdentity } from "./compiler_identity.ts";

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
 * Materialize a snapshot compiler once (worktree + rsync + npm ci, ~1-2 min)
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
    execFileSync("rsync", [
      "-a",
      "--exclude=/.git",
      "--exclude=/node_modules",
      "--exclude=/generated",
      "--exclude=/benchmark/v2/runs",
      "--exclude=/engine-rs/target",
      "./",
      `${workspace}/`,
    ], { cwd: process.cwd(), stdio: diagnosticStdio() });
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
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (name.startsWith("LR_")) delete environment[name];
  }
  Object.assign(environment, workspace.snapshot.compilerEnvironment, { LR_ENGINE: "wasm" });
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

function diagnosticStdio(): "inherit" | ["inherit", NodeJS.WritableStream, NodeJS.WritableStream] {
  return process.env.LINE_BENCHMARK_JSON_STDOUT === "1"
    ? ["inherit", process.stderr, process.stderr]
    : "inherit";
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
