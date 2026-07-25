import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMPILER_IDENTITY_PROTOCOL } from "../../../benchmark/v2/decision-policy.ts";
import { fingerprintFiles } from "./suite_model.ts";

export const COMPILER_SOURCE_PATHS = [
  "scripts/v0/optimizer",
  "scripts/v0/core",
  "scripts/v0/types.ts",
  "scripts/v0/arc.ts",
  "scripts/v0/arc_placement.ts",
  "scripts/v0/score.ts",
  "scripts/lib",
  "engine-rs",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
] as const;

export type CompilerCandidateIdentity = {
  head: string;
  compilerDiffSha256: string;
  compilerIdentityProtocol: typeof COMPILER_IDENTITY_PROTOCOL;
  compilerSourceFingerprint: string;
  compilerSourceFiles: string[];
  compilerEnvironment: Record<string, string>;
  engineArtifactFingerprint: string | null;
  candidateFingerprint: string;
  trackedChanges: string[];
};

/**
 * Compiler-bound paths whose bytes or file identity differ from HEAD.
 * This deliberately ignores unrelated worktree changes while including
 * staged changes, deletions, mode changes, and untracked compiler files.
 */
export function compilerDirtyPathsAgainstHead(
  paths: readonly string[] = COMPILER_SOURCE_PATHS,
  cwd = process.cwd(),
): string[] {
  const git = (args: string[]): string[] => execFileSync(
    "git",
    ["-C", cwd, ...args],
    { encoding: "utf8" },
  ).split("\0").filter(Boolean);
  return [...new Set([
    ...git(["diff", "--name-only", "-z", "HEAD", "--", ...paths]),
    ...git(["ls-files", "--others", "--exclude-standard", "-z", "--", ...paths]),
  ])].sort();
}

export function assertCompilerSourcesCommitted(
  paths: readonly string[] = COMPILER_SOURCE_PATHS,
  cwd = process.cwd(),
): void {
  const dirty = compilerDirtyPathsAgainstHead(paths, cwd);
  if (dirty.length > 0) {
    throw new Error(
      `compiler-bound source bytes must be committed before establishing a baseline; ` +
      `dirty paths: ${dirty.join(", ")}`,
    );
  }
}

export function compilerCandidateIdentity(engine: string): CompilerCandidateIdentity {
  /*
   * The compiler sources include a megabyte-scale readiness model artifact, so
   * a binary diff against HEAD can exceed execFileSync's 1 MB default buffer
   * and fail with ENOBUFS - which reads as a git failure rather than a size
   * limit. The identity is a hash of this output, so it must never be
   * truncated; give it room well past any plausible artifact.
   */
  const git = (args: string[]): string =>
    execFileSync("git", args, {
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024,
    }).trimEnd();
  const compilerDiff = git(["diff", "--binary", "HEAD", "--", ...COMPILER_SOURCE_PATHS]);
  const compilerFiles = materializedCompilerSourceFiles();
  const compilerSourceFingerprint = fingerprintFiles(compilerFiles);
  const compilerEnvironment = Object.fromEntries(
    Object.entries(process.env)
      .filter(([name, value]) => name.startsWith("LR_") && name !== "LR_ENGINE" && value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)) as Array<[string, string]>,
  );
  const engineArtifactPath = engine === "wasm"
    ? "engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm"
    : null;
  const engineArtifactFingerprint = engineArtifactPath !== null && existsSync(engineArtifactPath)
    ? sha256(readFileSync(engineArtifactPath))
    : null;
  const candidateFingerprint = sha256(JSON.stringify({
    compilerIdentityProtocol: COMPILER_IDENTITY_PROTOCOL,
    compilerSourceFingerprint,
    compilerEnvironment,
    engine,
    engineArtifactFingerprint,
  }));
  return {
    head: git(["rev-parse", "HEAD"]),
    compilerDiffSha256: sha256(compilerDiff),
    compilerIdentityProtocol: COMPILER_IDENTITY_PROTOCOL,
    compilerSourceFingerprint,
    compilerSourceFiles: compilerFiles,
    compilerEnvironment,
    engineArtifactFingerprint,
    candidateFingerprint,
    trackedChanges: git(["status", "--short"]).split("\n").filter(Boolean),
  };
}

/**
 * Enumerate the compiler bytes present in a materialized workspace. Snapshot
 * replay intentionally uses a baseline Git index plus extracted candidate
 * bytes, so cached paths deleted by the candidate must not be hashed while
 * candidate-only extracted files must be included.
 */
export function materializedCompilerSourceFiles(
  cwd = process.cwd(),
  paths: readonly string[] = COMPILER_SOURCE_PATHS,
): string[] {
  return execFileSync(
    "git",
    ["-C", cwd, "ls-files", "--cached", "--others", "--exclude-standard", "--", ...paths],
    { encoding: "utf8" },
  ).split("\n")
    .filter((path) => path !== "" && existsSync(resolve(cwd, path)))
    .sort();
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
