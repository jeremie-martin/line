/**
 * Small sealed-record format shared by the prospective replication controller
 * and its read-only verifier. Records reference immutable artifacts by path
 * and checksum; they deliberately never embed compiler output or assay JSON.
 */
import { randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { sha256, stableJson } from "./postimpact_study_inputs.ts";

export const LONG_CARRIER_REPLICATION_DECLARATION_SCHEMA = "line.long-carrier-replication-declaration.v1";
export const LONG_CARRIER_REPLICATION_EVENT_SCHEMA = "line.long-carrier-replication-event.v1";
export const LONG_CARRIER_REPLICATION_LEDGER_SCHEMA = "line.long-carrier-replication-ledger.v1";

export type SealedReplicationRecord = Record<string, unknown> & { recordFingerprint: string };

export function sealReplicationRecord<T extends Record<string, unknown>>(payload: T): T & SealedReplicationRecord {
  if (Object.hasOwn(payload, "recordFingerprint")) {
    throw new Error("replication record payload must not predeclare recordFingerprint");
  }
  return { ...payload, recordFingerprint: sha256(stableJson(payload)) } as T & SealedReplicationRecord;
}

export function assertSealedReplicationRecord(
  value: unknown,
  schema: string,
  label: string,
): asserts value is SealedReplicationRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  const record = value as Record<string, unknown>;
  if (record.schema !== schema) throw new Error(`${label} has unexpected schema`);
  if (typeof record.recordFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(record.recordFingerprint)) {
    throw new Error(`${label} lacks a valid record fingerprint`);
  }
  const payload = { ...record };
  delete payload.recordFingerprint;
  if (sha256(stableJson(payload)) !== record.recordFingerprint) {
    throw new Error(`${label} fingerprint does not match its payload`);
  }
}

export function writeSealedReplicationRecord(path: string, payload: Record<string, unknown>, label: string): SealedReplicationRecord {
  const record = sealReplicationRecord(payload);
  writeImmutableReplicationJson(path, record, label);
  return record;
}

/** Publish a complete replication artifact without replacing any prior file. */
export function writeImmutableReplicationJson(path: string, output: unknown, label = "replication artifact"): void {
  if (existsSync(path)) throw new Error(`refusing to overwrite existing immutable ${label} ${path}`);
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true });
  const temporary = resolve(directory, `.${basename(path)}.${process.pid}.${randomBytes(12).toString("hex")}.tmp`);
  let published = false;
  try {
    writeFileSync(temporary, `${JSON.stringify(output, null, 2)}\n`, { flag: "wx" });
    fsyncPath(temporary);
    linkSync(temporary, path);
    published = true;
    fsyncPath(directory);
  } catch (error: unknown) {
    if (published) {
      try {
        unlinkSync(path);
        fsyncPath(directory);
      } catch (cleanupError: unknown) {
        throw new Error(
          `${label} published but durability confirmation and cleanup failed: ${errorMessage(error)}; ` +
          `cleanup: ${errorMessage(cleanupError)}`,
        );
      }
      throw new Error(`${label} durability confirmation failed; published path was removed: ${errorMessage(error)}`);
    }
    if (errorCode(error) === "EEXIST") {
      throw new Error(`refusing to overwrite existing immutable ${label} ${path}`);
    }
    throw error;
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export function readSealedReplicationRecord(path: string, schema: string, label: string): SealedReplicationRecord {
  if (!existsSync(path)) throw new Error(`${label} is missing: ${path}`);
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  assertSealedReplicationRecord(parsed, schema, label);
  return parsed;
}

/** Reject path escape before an event can make an unrelated artifact authoritative. */
export function resolveReplicationPath(root: string, relativePath: string, label: string): string {
  if (relativePath === "" || relativePath.startsWith("/") || relativePath.startsWith("\\")) {
    throw new Error(`${label} must be a nonempty relative path`);
  }
  const absoluteRoot = resolve(root);
  const absolute = resolve(absoluteRoot, relativePath);
  const contained = relative(absoluteRoot, absolute);
  if (contained === "" || contained === ".." || contained.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error(`${label} escapes the replication output root`);
  }
  return absolute;
}

export function replicationRelativePath(root: string, path: string, label: string): string {
  const absoluteRoot = resolve(root);
  const relativePath = relative(absoluteRoot, resolve(path)).replaceAll("\\", "/");
  resolveReplicationPath(absoluteRoot, relativePath, label);
  return relativePath;
}

/** Keep a mid-run identity-drift fixture beside, but distinct from, its slot. */
export function replicationIdentityDriftArtifactPath(
  path: string,
  sourceFingerprintAtEnd: string,
  candidateFingerprintAtEnd: string,
  panelFingerprintAtEnd: string,
): string {
  const extension = extname(path);
  const stem = extension === "" ? path : path.slice(0, -extension.length);
  return `${stem}.identity-drift-${sourceFingerprintAtEnd.slice(0, 12)}-` +
    `${candidateFingerprintAtEnd.slice(0, 12)}-${panelFingerprintAtEnd.slice(0, 12)}${extension}`;
}

/**
 * Inventory the only paths a capture is permitted to publish. A normal
 * capture writes the requested path; a mid-run identity drift writes one
 * deterministic sibling. Everything else is intentionally outside this
 * protocol and cannot become authoritative evidence.
 */
export function replicationArtifactPublicationPaths(
  root: string,
  requestedRelativePath: string,
  options: { includeIdentityDriftSiblings?: boolean } = {},
): string[] {
  const requestedPath = resolveReplicationPath(root, requestedRelativePath, "requested artifact path");
  const paths = existsSync(requestedPath) ? [requestedRelativePath] : [];
  if (!options.includeIdentityDriftSiblings) return paths;

  const extension = extname(requestedPath);
  const filename = basename(requestedPath);
  const stem = extension === "" ? filename : filename.slice(0, -extension.length);
  const prefix = `${stem}.identity-drift-`;
  const directory = dirname(requestedPath);
  if (!existsSync(directory)) return paths;
  for (const candidate of readdirSync(directory).sort()) {
    if (!candidate.startsWith(prefix) || !candidate.endsWith(extension)) continue;
    const absolute = resolve(directory, candidate);
    if (!existsSync(absolute)) continue;
    paths.push(replicationRelativePath(root, absolute, "forensic identity-drift artifact path"));
  }
  return [...new Set(paths)].sort();
}

/** All JSON artifacts under the controller's two flat publication directories. */
export function replicationPublishedArtifactPaths(root: string): string[] {
  const paths: string[] = [];
  for (const directoryName of ["fixtures", "assays"]) {
    const directory = resolve(root, directoryName);
    if (!existsSync(directory)) continue;
    for (const filename of readdirSync(directory).sort()) {
      if (!filename.endsWith(".json")) continue;
      const absolute = resolve(directory, filename);
      if (!existsSync(absolute)) continue;
      paths.push(replicationRelativePath(root, absolute, "published artifact path"));
    }
  }
  return paths.sort();
}

/**
 * A completed controller ledger must account for every event file. Unlike
 * fixtures and assays, events are never optional forensic sidecars: an
 * unledgered abort, plan, or result would make a claimed complete cohort
 * ambiguous.
 */
export function replicationPublishedEventPaths(root: string): string[] {
  const directory = resolve(root, "events");
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .sort()
    .map((filename) => replicationRelativePath(root, resolve(directory, filename), "published event path"));
}

/** Stable automation status for a completed replication ledger. */
export function longCarrierReplicationVerdictExitCode(verdict: string): number {
  if (verdict === "supported_local_duration_response") return 0;
  if (verdict === "invalid") return 2;
  if (verdict === "falsified") return 3;
  return 4;
}

function fsyncPath(path: string): void {
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function errorCode(error: unknown): string | null {
  return error !== null && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
