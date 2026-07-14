/**
 * Immutable identity and storage rules for calibration-study artifacts.
 *
 * A study artifact is evidence only for the exact source closure, observed
 * compiler/engine identity, fixture, and schema that produced it. Defaults are
 * source-addressed and append-only; an explicit output path must be unused.
 */
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import ts from "typescript";
import { sha256, stableJson } from "./frozen_fixture.ts";

export type StudySourceIdentity = {
  sourceFiles: string[];
  studySourceFingerprint: string;
};

export type StudyArtifactIdentity = {
  schema: string;
  fixtureFingerprint: string;
  studySourceFingerprint: string;
  observationCandidateFingerprint: string;
  protocolFingerprint: string;
  fingerprint: string;
};

/** Resolve the local static TypeScript import closure of a study entrypoint. */
export function studySourceIdentity(entryPath: string, cwd = process.cwd()): StudySourceIdentity {
  const pending = [normalize(entryPath, cwd)];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const path = pending.pop()!;
    if (visited.has(path)) continue;
    visited.add(path);
    const source = readFileSync(resolve(cwd, path), "utf8");
    const imports = ts.preProcessFile(source, true, true).importedFiles.map((entry) => entry.fileName);
    for (const specifier of imports) {
      const dependency = resolveLocalTypeScriptModule(path, specifier, cwd);
      if (dependency !== null && !visited.has(dependency)) pending.push(dependency);
    }
  }
  const sourceFiles = [...visited].sort();
  return { sourceFiles, studySourceFingerprint: fingerprintStudySources(sourceFiles, cwd) };
}

export function studyArtifactIdentity(input: Omit<StudyArtifactIdentity, "fingerprint">): StudyArtifactIdentity {
  return {
    ...input,
    fingerprint: sha256(stableJson(input)),
  };
}

/**
 * Artifacts are append-only. A repeated identity is not silently replaced:
 * that would conceal nondeterminism, changed unbound environment, or an
 * invalid drift run that began under a formerly valid identity.
 */
export function writeStudyArtifact(
  path: string,
  output: { schema: string; artifactIdentity: StudyArtifactIdentity },
): void {
  if (existsSync(path)) {
    let existing: unknown;
    try {
      existing = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      throw new Error(`refusing to overwrite unreadable study artifact ${path}: ${errorMessage(error)}`);
    }
    const compatible = sameArtifactIdentity(existing, output.artifactIdentity);
    throw new Error(
      `refusing to overwrite ${compatible ? "existing" : "incompatible"} immutable study artifact ${path}`,
    );
  }
  writeImmutableJsonArtifact(path, output, "study artifact");
}

/**
 * Publish a complete JSON record atomically without replacing a prior record.
 * A same-directory temporary inode is fully written and fsynced, then linked
 * into its final name. `link` is no-clobber, so readers can observe either no
 * record or a complete record, never a partially written final artifact.
 */
export function writeImmutableJsonArtifact(path: string, output: unknown, label = "artifact"): void {
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true });
  const temporaryPath = resolve(
    directory,
    `.${basename(path)}.${process.pid}.${randomBytes(12).toString("hex")}.tmp`,
  );
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(output, null, 2)}\n`, { flag: "wx" });
    fsyncFile(temporaryPath);
    linkSync(temporaryPath, path);
    fsyncDirectory(directory);
  } catch (error: any) {
    if (error?.code === "EEXIST") {
      throw new Error(`refusing to overwrite existing immutable ${label} ${path}`);
    }
    throw error;
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
}

/** Keep an invalid mid-run identity drift separate from its start identity. */
export function forensicDriftArtifactPath(
  path: string,
  sourceFingerprintAtEnd: string,
  observationCandidateFingerprintAtEnd: string,
  dynamicInputFingerprintAtEnd?: string,
): string {
  const extension = extname(path);
  const stem = extension === "" ? path : path.slice(0, -extension.length);
  const inputSuffix = dynamicInputFingerprintAtEnd === undefined
    ? ""
    : `-${dynamicInputFingerprintAtEnd.slice(0, 12)}`;
  return `${stem}.identity-drift-${sourceFingerprintAtEnd.slice(0, 12)}-${observationCandidateFingerprintAtEnd.slice(0, 12)}${inputSuffix}${extension}`;
}

/** Allocate a sibling attempt path without weakening append-only evidence. */
export function allocateStudyArtifactPath(path: string): string {
  if (!existsSync(path)) return path;
  const extension = extname(path);
  const stem = extension === "" ? path : path.slice(0, -extension.length);
  for (let attempt = 2; attempt < Number.MAX_SAFE_INTEGER; attempt++) {
    const candidate = `${stem}.attempt-${attempt}${extension}`;
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error(`no available append-only artifact path for ${path}`);
}

/** Reject an occupied explicit destination before an expensive replay begins. */
export function assertStudyArtifactPathUnused(path: string): void {
  if (existsSync(path)) throw new Error(`explicit study artifact path already exists and is immutable: ${path}`);
}

function resolveLocalTypeScriptModule(fromPath: string, specifier: string, cwd: string): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) return null;
  const base = specifier.startsWith("/") ? resolve(cwd, `.${specifier}`) : resolve(dirname(resolve(cwd, fromPath)), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts")];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return normalize(candidate, cwd);
  }
  throw new Error(`cannot resolve local study dependency ${specifier} from ${fromPath}`);
}

function normalize(path: string, cwd: string): string {
  const normalized = relative(cwd, resolve(cwd, path));
  if (normalized.startsWith("..") || normalized === "") throw new Error(`study source must be inside workspace: ${path}`);
  return normalized.replaceAll("\\", "/");
}

function fingerprintStudySources(paths: readonly string[], cwd: string): string {
  const hash = createHash("sha256");
  for (const path of paths) {
    hash.update(path);
    hash.update("\0");
    hash.update(readFileSync(resolve(cwd, path)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function sameArtifactIdentity(value: unknown, expected: StudyArtifactIdentity): boolean {
  if (value === null || typeof value !== "object") return false;
  const existing = (value as { schema?: unknown; artifactIdentity?: unknown }).artifactIdentity;
  return (value as { schema?: unknown }).schema === expected.schema && stableJson(existing) === stableJson(expected);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function fsyncFile(path: string): void {
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function fsyncDirectory(path: string): void {
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}
