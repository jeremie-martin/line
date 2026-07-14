/**
 * Compiler identity for the long-carrier study.
 *
 * This is deliberately a study-local contract rather than an import of the
 * Benchmark V2 identity stack. It binds the same compiler surface, engine
 * artifact, and relevant LR environment without making a prospective physical
 * assay depend on benchmark policy or archive code.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sha256, stableJson } from "./postimpact_study_inputs.ts";

export const LONG_CARRIER_COMPILER_IDENTITY_PROTOCOL = "line.long-carrier-compiler-identity.v1" as const;
export const LONG_CARRIER_COMPILER_SOURCE_PATHS = Object.freeze([
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
] as const);

export type LongCarrierReplicationCandidateIdentity = {
  compilerIdentityProtocol: typeof LONG_CARRIER_COMPILER_IDENTITY_PROTOCOL;
  compilerSourceBoundaryFingerprint: string;
  compilerSourceFingerprint: string;
  compilerSourceFiles: string[];
  compilerEnvironment: Record<string, string>;
  engine: string;
  engineArtifactFingerprint: string | null;
  candidateFingerprint: string;
};

export function longCarrierReplicationCandidateIdentity(
  engine: string,
  cwd = process.cwd(),
): LongCarrierReplicationCandidateIdentity {
  const compilerSourceFiles = materializedLongCarrierCompilerSourceFiles(cwd);
  const compilerSourceFingerprint = fingerprintFiles(compilerSourceFiles, cwd);
  const compilerEnvironment = Object.fromEntries(
    Object.entries(process.env)
      .filter(([name, value]) => name.startsWith("LR_") && name !== "LR_ENGINE" && value !== undefined)
      .map(([name, value]) => [name, value!])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const engineArtifactPath = engine === "wasm"
    ? resolve(cwd, "engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm")
    : null;
  const engineArtifactFingerprint = engineArtifactPath !== null && existsSync(engineArtifactPath)
    ? sha256(readFileSync(engineArtifactPath).toString("base64"))
    : null;
  const compilerSourceBoundaryFingerprint = sha256(stableJson(LONG_CARRIER_COMPILER_SOURCE_PATHS));
  const payload = {
    compilerIdentityProtocol: LONG_CARRIER_COMPILER_IDENTITY_PROTOCOL,
    compilerSourceBoundaryFingerprint,
    compilerSourceFingerprint,
    compilerEnvironment,
    engine,
    engineArtifactFingerprint,
  };
  return {
    ...payload,
    compilerSourceFiles,
    candidateFingerprint: sha256(stableJson(payload)),
  };
}

export function isLongCarrierCompilerSourcePath(path: string): boolean {
  return LONG_CARRIER_COMPILER_SOURCE_PATHS.some((root) => path === root || path.startsWith(`${root}/`));
}

function materializedLongCarrierCompilerSourceFiles(cwd: string): string[] {
  return execFileSync(
    "git",
    ["-C", cwd, "ls-files", "--cached", "--others", "--exclude-standard", "--", ...LONG_CARRIER_COMPILER_SOURCE_PATHS],
    { encoding: "utf8" },
  ).split("\n")
    .filter((path) => path !== "" && existsSync(resolve(cwd, path)))
    .sort();
}

function fingerprintFiles(paths: readonly string[], cwd: string): string {
  const hash = createHash("sha256");
  for (const path of paths) {
    hash.update(path);
    hash.update("\0");
    hash.update(readFileSync(resolve(cwd, path)));
    hash.update("\0");
  }
  return hash.digest("hex");
}
