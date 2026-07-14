/**
 * Provenance and append-only storage for isolated post-impact calibration
 * assays. Kept separate from the older broad fixture/artifact machinery so a
 * new runner can fingerprint its own source closure without importing panel or
 * compiler policy through a type-only dependency.
 */
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
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
import ts from "typescript";
import { sha256, stableJson } from "./postimpact_study_inputs.ts";

export type PostimpactAssaySourceIdentity = {
  sourceFiles: string[];
  fingerprint: string;
};

export type PostimpactAssayRuntimeIdentity = {
  head: string;
  worktreeDiffSha256: string;
  engine: string;
  engineArtifactFingerprint: string | null;
  node: string;
  platform: string;
  arch: string;
  typescriptVersion: string;
  relevantEnvironment: Record<string, string>;
  fingerprint: string;
};

export type PostimpactAssayArtifact = Record<string, unknown> & {
  artifactContentFingerprint: string;
};

const ARTIFACT_CONTENT_FINGERPRINT_FIELD = "artifactContentFingerprint";

export function postimpactAssaySourceIdentity(
  entryPath: string,
  cwd = process.cwd(),
): PostimpactAssaySourceIdentity {
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
  const hash = createHash("sha256");
  for (const path of sourceFiles) {
    hash.update(path);
    hash.update("\0");
    hash.update(readFileSync(resolve(cwd, path)));
    hash.update("\0");
  }
  return { sourceFiles, fingerprint: hash.digest("hex") };
}

/** Record the exact ambient engine/repository state that a replay observed. */
export function postimpactAssayRuntimeIdentity(cwd = process.cwd()): PostimpactAssayRuntimeIdentity {
  const engine = process.env.LR_ENGINE ?? "wasm";
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();
  const worktreeDiff = execFileSync("git", ["diff", "--binary", "HEAD"], { cwd, encoding: "utf8" });
  const engineArtifactPath = engine === "wasm"
    ? resolve(cwd, "engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm")
    : null;
  const engineArtifactFingerprint = engineArtifactPath !== null && existsSync(engineArtifactPath)
    ? sha256(readFileSync(engineArtifactPath).toString("base64"))
    : null;
  const relevantEnvironment = Object.fromEntries(
    Object.entries(process.env)
      .filter(([name, value]) => name.startsWith("LR_") && value !== undefined)
      .map(([name, value]) => [name, value!])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const payload = {
    head,
    worktreeDiffSha256: createHash("sha256").update(worktreeDiff).digest("hex"),
    engine,
    engineArtifactFingerprint,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    typescriptVersion: ts.version,
    relevantEnvironment,
  };
  return { ...payload, fingerprint: sha256(stableJson(payload)) };
}

export function assertUnusedPostimpactAssayArtifactPath(path: string): void {
  if (existsSync(path)) throw new Error(`explicit post-impact assay artifact already exists and is immutable: ${path}`);
}

export function allocatePostimpactAssayArtifactPath(path: string): string {
  if (!existsSync(path)) return path;
  const extension = extname(path);
  const stem = extension === "" ? path : path.slice(0, -extension.length);
  for (let attempt = 2; attempt < Number.MAX_SAFE_INTEGER; attempt++) {
    const candidate = `${stem}.attempt-${attempt}${extension}`;
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error(`no available immutable post-impact assay artifact path for ${path}`);
}

/**
 * Add a canonical payload checksum before no-clobber publication. The existing
 * identity field answers "what was run"; this detects accidental or stale
 * edits under a trusted artifact filesystem. It is deliberately not described
 * as a signature or a defense against an actor that can replace both payload
 * and checksum.
 */
export function sealPostimpactAssayArtifact(payload: Record<string, unknown>): PostimpactAssayArtifact {
  if (Object.hasOwn(payload, ARTIFACT_CONTENT_FINGERPRINT_FIELD)) {
    throw new Error("post-impact assay payload must not predeclare its content fingerprint");
  }
  const canonicalPayload = canonicalizeJsonArtifactValue(payload, "payload");
  if (canonicalPayload === null || Array.isArray(canonicalPayload) || typeof canonicalPayload !== "object") {
    throw new Error("post-impact assay payload must be a JSON object");
  }
  const fingerprint = sha256(stableJson(canonicalPayload));
  return deepFreezeJson({ ...canonicalPayload, artifactContentFingerprint: fingerprint }) as PostimpactAssayArtifact;
}

/** Parse an artifact and fail closed on a stale/corrupt canonical checksum. */
export function readPostimpactAssayArtifact(path: string): PostimpactAssayArtifact {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  assertPostimpactAssayArtifactIntegrity(parsed);
  return parsed;
}

export function assertPostimpactAssayArtifactIntegrity(value: unknown): asserts value is PostimpactAssayArtifact {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("post-impact assay artifact must be a JSON object");
  }
  const artifact = value as Record<string, unknown>;
  const fingerprint = artifact[ARTIFACT_CONTENT_FINGERPRINT_FIELD];
  if (typeof fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(fingerprint)) {
    throw new Error("post-impact assay artifact lacks a valid content fingerprint");
  }
  const payload = { ...artifact };
  delete payload[ARTIFACT_CONTENT_FINGERPRINT_FIELD];
  const canonicalPayload = canonicalizeJsonArtifactValue(payload, "artifact payload");
  if (sha256(stableJson(canonicalPayload)) !== fingerprint) {
    throw new Error("post-impact assay artifact content fingerprint does not match its payload");
  }
}

export function writeImmutablePostimpactAssayArtifact(path: string, payload: Record<string, unknown>): void {
  if (existsSync(path)) throw new Error(`refusing to overwrite existing post-impact assay artifact ${path}`);
  const sealed = sealPostimpactAssayArtifact(payload);
  const directory = dirname(path);
  ensureArtifactDirectory(directory);
  // Write the same canonical JSON representation used by the checksum.
  const serialized = `${stableJson(sealed)}\n`;
  const temporary = resolve(
    directory,
    `.${basename(path)}.${process.pid}.${randomBytes(12).toString("hex")}.tmp`,
  );
  let published = false;
  try {
    writeFileSync(temporary, serialized, { flag: "wx" });
    fsyncPath(temporary);
    linkSync(temporary, path);
    published = true;
    fsyncPath(directory);
  } catch (error: unknown) {
    if (published) {
      // A caller must never be told publication failed while an unverified
      // final path remains. Best-effort rollback keeps retries unambiguous.
      try {
        unlinkSync(path);
        fsyncPath(directory);
      } catch (cleanupError) {
        throw new Error(
          `post-impact artifact published but durability confirmation and cleanup failed: ${errorMessage(error)}; ` +
            `cleanup: ${errorMessage(cleanupError)}`,
        );
      }
      throw new Error(`post-impact artifact durability confirmation failed; published path was removed: ${errorMessage(error)}`);
    }
    const code = errorCode(error);
    if (code === "EEXIST") {
      throw new Error(`refusing to overwrite existing post-impact assay artifact ${path}`);
    }
    throw error;
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

/** Create parent entries before publication and flush newly created links. */
function ensureArtifactDirectory(directory: string): void {
  const missing: string[] = [];
  let cursor = resolve(directory);
  while (!existsSync(cursor)) {
    const parent = dirname(cursor);
    if (parent === cursor) throw new Error(`cannot create post-impact artifact directory ${directory}`);
    missing.push(cursor);
    cursor = parent;
  }
  mkdirSync(directory, { recursive: true });
  for (const created of missing.reverse()) {
    fsyncPath(dirname(created));
    fsyncPath(created);
  }
}

type CanonicalJsonValue = null | string | boolean | number | CanonicalJsonValue[] | { [key: string]: CanonicalJsonValue };

/**
 * Read only data-property descriptors once, producing an accessor-free plain
 * JSON clone before hashing or writing. This prevents a getter or sparse array
 * from changing between validation, checksum, and serialization.
 */
function canonicalizeJsonArtifactValue(
  value: unknown,
  path: string,
  ancestors = new WeakSet<object>(),
): CanonicalJsonValue {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new Error(`post-impact assay ${path} must contain only finite JSON numbers`);
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new Error(`post-impact assay ${path} must be JSON-safe`);
  }
  if (ancestors.has(value)) throw new Error(`post-impact assay ${path} must not contain a cycle`);
  ancestors.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if ("get" in descriptor || "set" in descriptor) {
        throw new Error(`post-impact assay ${path}.${key} must not use an accessor property`);
      }
    }
    if (Array.isArray(value)) {
      const entries: CanonicalJsonValue[] = [];
      for (let index = 0; index < value.length; index++) {
        const descriptor = descriptors[String(index)];
        if (descriptor === undefined || !("value" in descriptor)) {
          throw new Error(`post-impact assay ${path} must not contain a sparse array`);
        }
        entries.push(canonicalizeJsonArtifactValue(descriptor.value, `${path}[${index}]`, ancestors));
      }
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (key === "length" || !descriptor.enumerable) continue;
        const index = Number(key);
        if (!Number.isSafeInteger(index) || index < 0 || String(index) !== key || index >= value.length) {
          throw new Error(`post-impact assay ${path} must not contain enumerable non-index array properties`);
        }
      }
      return entries;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`post-impact assay ${path} must use plain JSON objects`);
    }
    const result = Object.create(null) as { [key: string]: CanonicalJsonValue };
    for (const key of Object.keys(descriptors).filter((key) => descriptors[key]!.enumerable).sort()) {
      const descriptor = descriptors[key]!;
      if (!("value" in descriptor)) throw new Error(`post-impact assay ${path}.${key} must be a data property`);
      Object.defineProperty(result, key, {
        value: canonicalizeJsonArtifactValue(descriptor.value, `${path}.${key}`, ancestors),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

function deepFreezeJson<T extends CanonicalJsonValue>(value: T): T {
  if (value !== null && typeof value === "object") {
    if (Array.isArray(value)) value.forEach(deepFreezeJson);
    else Object.values(value).forEach(deepFreezeJson);
    Object.freeze(value);
  }
  return value;
}

function errorCode(error: unknown): string | null {
  return typeof (error as { code?: unknown } | null)?.code === "string"
    ? (error as { code: string }).code
    : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolveLocalTypeScriptModule(fromPath: string, specifier: string, cwd: string): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) return null;
  const base = specifier.startsWith("/")
    ? resolve(cwd, `.${specifier}`)
    : resolve(dirname(resolve(cwd, fromPath)), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts")]) {
    if (existsSync(candidate)) return normalize(candidate, cwd);
  }
  throw new Error(`cannot resolve local post-impact assay dependency ${specifier} from ${fromPath}`);
}

function normalize(path: string, cwd: string): string {
  const normalized = relative(cwd, resolve(cwd, path));
  if (normalized.startsWith("..") || normalized === "") {
    throw new Error(`post-impact assay source must be inside workspace: ${path}`);
  }
  return normalized.replaceAll("\\", "/");
}

function fsyncPath(path: string): void {
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}
