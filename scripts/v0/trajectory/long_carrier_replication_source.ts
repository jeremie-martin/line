/**
 * Static source identities for the self-contained long-carrier protocol.
 *
 * Kept local instead of reusing broad study helpers so a type-only import can
 * never silently pull the legacy trajectory panel into a prospective cohort.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";

export type LongCarrierReplicationSourceIdentity = {
  sourceFiles: string[];
  fingerprint: string;
};

export function longCarrierReplicationSourceIdentity(
  entryPath: string,
  cwd = process.cwd(),
): LongCarrierReplicationSourceIdentity {
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
  return { sourceFiles, fingerprint: fingerprintLongCarrierReplicationFiles(sourceFiles, cwd) };
}

export function fingerprintLongCarrierReplicationFiles(paths: readonly string[], cwd = process.cwd()): string {
  const hash = createHash("sha256");
  for (const path of [...paths].sort()) {
    hash.update(path);
    hash.update("\0");
    hash.update(readFileSync(resolve(cwd, path)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function resolveLocalTypeScriptModule(fromPath: string, specifier: string, cwd: string): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) return null;
  const base = specifier.startsWith("/")
    ? resolve(cwd, `.${specifier}`)
    : resolve(dirname(resolve(cwd, fromPath)), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts")];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return normalize(candidate, cwd);
  }
  throw new Error(`cannot resolve local long-carrier dependency ${specifier} from ${fromPath}`);
}

function normalize(path: string, cwd: string): string {
  const normalized = relative(cwd, resolve(cwd, path));
  if (normalized.startsWith("..") || normalized === "") {
    throw new Error(`long-carrier source must be inside workspace: ${path}`);
  }
  return normalized.replaceAll("\\", "/");
}
