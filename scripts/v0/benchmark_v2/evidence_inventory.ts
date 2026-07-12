import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const RUNS_ROOT = resolve("benchmark/v2/runs");
const BENCHMARK_ROOT = resolve("benchmark/v2");

export type RetainedEvidenceInventory = {
  root: string;
  totalFiles: number;
  totalBytes: number;
  referencedFiles: number;
  referencedBytes: number;
  unreferencedFiles: number;
  unreferencedBytes: number;
  missingReferences: string[];
  unreferenced: Array<{ path: string; bytes: number }>;
};

/**
 * Inventory only: "unreferenced" means no retained governance JSON points to
 * the file. It is a review queue, never an authorization to delete evidence.
 */
export function retainedEvidenceInventory(options: {
  runsRoot?: string;
  benchmarkRoot?: string;
} = {}): RetainedEvidenceInventory {
  const runsRoot = resolve(options.runsRoot ?? RUNS_ROOT);
  const benchmarkRoot = resolve(options.benchmarkRoot ?? BENCHMARK_ROOT);
  const retained = regularFiles(runsRoot)
    .filter((path) => !path.endsWith("/.gitkeep"));
  const retainedSet = new Set(retained.map((path) => resolve(path)));
  const references = new Set<string>();
  const ledgerIdentifiers = new Set<string>();
  const archivedRoot = resolve(benchmarkRoot, "archive");
  for (const document of regularFiles(benchmarkRoot)) {
    if (document.startsWith(`${archivedRoot}/`)) continue;
    if (!isGovernanceDocument(document) || statSync(document).size > 10 * 1024 * 1024) continue;
    collectDocumentReferences(document, references, ledgerIdentifiers);
  }
  const referenced = new Set<string>();
  const missingReferences: string[] = [];
  for (const reference of references) {
    const absolute = resolve(reference);
    if (retainedSet.has(absolute)) referenced.add(absolute);
    else if (reference.startsWith("benchmark/v2/runs/") && !existsSync(absolute)) missingReferences.push(reference);
  }
  for (const path of retained) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    if ([...ledgerIdentifiers].some((identifier) => name.includes(identifier))) referenced.add(resolve(path));
  }
  // A referenced payload and its checksum sidecar form one retention unit.
  for (const path of [...referenced]) {
    for (const companion of [
      `${path}.sha256`,
      path.replace(/\.json\.gz$/, ".summary.json"),
      path.replace(/\.json\.gz$/, ".json.summary.json"),
    ]) {
      if (retainedSet.has(companion)) referenced.add(companion);
    }
  }
  const entries = retained.map((path) => ({
    path: relative(process.cwd(), path),
    bytes: statSync(path).size,
    referenced: referenced.has(resolve(path)),
  }));
  const unreferenced = entries
    .filter((entry) => !entry.referenced)
    .map(({ path, bytes }) => ({ path, bytes }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return {
    root: relative(process.cwd(), runsRoot),
    totalFiles: entries.length,
    totalBytes: sum(entries.map((entry) => entry.bytes)),
    referencedFiles: entries.length - unreferenced.length,
    referencedBytes: sum(entries.filter((entry) => entry.referenced).map((entry) => entry.bytes)),
    unreferencedFiles: unreferenced.length,
    unreferencedBytes: sum(unreferenced.map((entry) => entry.bytes)),
    missingReferences: [...new Set(missingReferences)].sort(),
    unreferenced,
  };
}

function collectDocumentReferences(path: string, references: Set<string>, identifiers: Set<string>): void {
  const text = readFileSync(path, "utf8");
  try {
    if (path.endsWith(".jsonl")) {
      for (const line of text.split("\n").filter((value) => value.trim() !== "")) {
        collectStrings(JSON.parse(line), references, identifiers);
      }
    } else {
      collectDocumentValue(JSON.parse(text), references, identifiers);
    }
  } catch (error) {
    throw new Error(`cannot inventory retained evidence: ${relative(process.cwd(), path)} is invalid: ${(error as Error).message}`);
  }
}

function collectDocumentValue(value: unknown, references: Set<string>, identifiers: Set<string>): void {
  if (
    value !== null && typeof value === "object" && !Array.isArray(value) &&
    (value as any).schema === "line.benchmark-v2.run-summary.v3" &&
    typeof (value as any).retainedCompressedArchive === "string"
  ) {
    const { archive: _raw, compressedArchive: _workingCompressed, ...retained } = value as Record<string, unknown>;
    collectStrings(retained, references, identifiers);
    return;
  }
  collectStrings(value, references, identifiers);
}

function collectStrings(value: unknown, references: Set<string>, identifiers: Set<string>): void {
  if (typeof value === "string") {
    if (value.startsWith("benchmark/v2/runs/") || value.startsWith("/")) references.add(value);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-[a-f0-9]{8}$/.test(value)) identifiers.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, references, identifiers);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, references, identifiers);
  }
}

function isGovernanceDocument(path: string): boolean {
  return path.endsWith(".json") || path.endsWith(".jsonl");
}

function regularFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...regularFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
