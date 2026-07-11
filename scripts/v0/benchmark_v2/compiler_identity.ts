import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

export function compilerCandidateIdentity(engine: string): CompilerCandidateIdentity {
  const git = (args: string[]): string => execFileSync("git", args, { encoding: "utf8" }).trimEnd();
  const compilerDiff = git(["diff", "--binary", "HEAD", "--", ...COMPILER_SOURCE_PATHS]);
  const compilerFiles = git([
    "ls-files", "--cached", "--others", "--exclude-standard", "--", ...COMPILER_SOURCE_PATHS,
  ]).split("\n").filter(Boolean).sort();
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

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
