/**
 * Runtime boundary for the sealed long-carrier replication.
 *
 * The study records source and candidate bytes; Node/tsx loader overrides
 * would otherwise be a second, unrecorded way to change their meaning. Keep
 * the launcher strict and give children only the host settings they need to
 * find Node's cache, temporary files, and `git`.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";
import { sha256, stableJson } from "./postimpact_study_inputs.ts";

const FORBIDDEN_NAMES = new Set([
  "NODE_OPTIONS",
  "NODE_PATH",
  "NODE_PRESERVE_SYMLINKS",
  "NODE_PRESERVE_SYMLINKS_MAIN",
  "LD_AUDIT",
  "LD_LIBRARY_PATH",
  "LD_PRELOAD",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
]);

const FORBIDDEN_PREFIXES = ["TSX_", "TS_NODE_"] as const;

const OPERATIONAL_CHILD_ENVIRONMENT_NAMES = [
  "HOME",
  "PATH",
  "TMPDIR",
  "TMP",
  "TEMP",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
] as const;

const require = createRequire(import.meta.url);

const RUNTIME_PACKAGE_NAMES = [
  "tsx",
  "typescript",
  "esbuild",
  `@esbuild/${process.platform}-${process.arch}`,
] as const;

export type LongCarrierReplicationCaptureRuntimeIdentity = {
  runtimeIdentityProtocol: "line.long-carrier-replication-capture-runtime.v2";
  engine: "wasm";
  engineArtifactFingerprint: string | null;
  node: string;
  platform: string;
  arch: string;
  typescriptVersion: string;
  tsxVersion: string;
  runtimePackages: string[];
  runtimePackageClosureFingerprint: string;
  relevantEnvironment: { LR_ENGINE: "wasm" };
  fingerprint: string;
};

export function assertLongCarrierReplicationRuntimeEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): void {
  const forbidden = Object.keys(environment)
    .filter((name) => FORBIDDEN_NAMES.has(name) || FORBIDDEN_PREFIXES.some((prefix) => name.startsWith(prefix)))
    .sort();
  if (forbidden.length > 0) {
    throw new Error(
      `long-carrier replication forbids semantic loader/runtime environment variable(s): ${forbidden.join(", ")}`,
    );
  }
}

/** Construct the exact non-semantic environment passed to sealed child processes. */
export function longCarrierReplicationChildEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  assertLongCarrierReplicationRuntimeEnvironment(environment);
  const child: NodeJS.ProcessEnv = {};
  for (const name of OPERATIONAL_CHILD_ENVIRONMENT_NAMES) {
    const value = environment[name];
    if (value !== undefined) child[name] = value;
  }
  child.LR_ENGINE = "wasm";
  return child;
}

/**
 * Bind the host/runtime layer that can change a replay while source and
 * compiler bytes remain identical. The closure fingerprints the installed
 * tsx loader, TypeScript API, esbuild wrapper, and platform esbuild binary,
 * rather than trusting package manifests or version strings alone.
 */
export function longCarrierReplicationCaptureRuntimeIdentity(
  cwd = process.cwd(),
): LongCarrierReplicationCaptureRuntimeIdentity {
  const tsxPackagePath = require.resolve("tsx/package.json");
  const tsxPackage = JSON.parse(readFileSync(tsxPackagePath, "utf8")) as { version?: unknown };
  if (typeof tsxPackage.version !== "string" || tsxPackage.version === "") {
    throw new Error("long-carrier replication cannot determine the installed tsx runtime version");
  }
  const runtimePackageClosure = longCarrierReplicationRuntimePackageClosure();
  const engineArtifactPath = resolve(cwd, "engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm");
  const payload = {
    runtimeIdentityProtocol: "line.long-carrier-replication-capture-runtime.v2" as const,
    engine: "wasm" as const,
    engineArtifactFingerprint: existsSync(engineArtifactPath)
      ? sha256(readFileSync(engineArtifactPath).toString("base64"))
      : null,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    typescriptVersion: ts.version,
    tsxVersion: tsxPackage.version,
    runtimePackages: runtimePackageClosure.packages,
    runtimePackageClosureFingerprint: runtimePackageClosure.fingerprint,
    relevantEnvironment: { LR_ENGINE: "wasm" } as const,
  };
  return { ...payload, fingerprint: sha256(stableJson(payload)) };
}

export type LongCarrierReplicationRuntimePackageClosure = {
  packages: string[];
  fingerprint: string;
};

/**
 * Content-address the exact installed packages that execute/transpile this
 * TypeScript process. Package-relative names, not host paths, are hashed so a
 * clean worktree may safely share an immutable node_modules store.
 */
export function longCarrierReplicationRuntimePackageClosure(
  packageRoots = resolvedRuntimePackageRoots(),
): LongCarrierReplicationRuntimePackageClosure {
  const packages = Object.keys(packageRoots).sort();
  if (packages.length === 0 || new Set(packages).size !== packages.length) {
    throw new Error("long-carrier replication runtime package closure is empty or ambiguous");
  }
  const hash = createHash("sha256");
  for (const packageName of packages) {
    const root = packageRoots[packageName];
    if (typeof root !== "string" || root === "") {
      throw new Error(`long-carrier replication runtime package ${packageName} has no resolved root`);
    }
    const files = packageFiles(root, packageName);
    if (files.length === 0) {
      throw new Error(`long-carrier replication runtime package ${packageName} has no regular files`);
    }
    for (const file of files) {
      hash.update(packageName);
      hash.update("\0");
      hash.update(file.relativePath);
      hash.update("\0");
      hash.update(readFileSync(file.absolutePath));
      hash.update("\0");
    }
  }
  return { packages, fingerprint: hash.digest("hex") };
}

function resolvedRuntimePackageRoots(): Record<string, string> {
  return Object.fromEntries(RUNTIME_PACKAGE_NAMES.map((packageName) => {
    try {
      return [packageName, dirname(require.resolve(`${packageName}/package.json`))];
    } catch (error) {
      throw new Error(`long-carrier replication cannot resolve runtime package ${packageName}: ${String(error)}`);
    }
  }));
}

function packageFiles(root: string, packageName: string): Array<{ absolutePath: string; relativePath: string }> {
  const files: Array<{ absolutePath: string; relativePath: string }> = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile()) {
        files.push({
          absolutePath,
          relativePath: relative(root, absolutePath).replaceAll("\\", "/"),
        });
      } else {
        throw new Error(`long-carrier replication runtime package ${packageName} contains unsupported entry ${absolutePath}`);
      }
    }
  };
  visit(root);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}
