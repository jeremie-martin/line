import { createHash } from "node:crypto";
import {
  closeSync,
  createReadStream,
  existsSync,
  openSync,
  readFileSync,
  readSync,
} from "node:fs";
import { basename, resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { createGunzip } from "node:zlib";
import { loadVerifiedArchive } from "./decide.ts";

type RetainedReference = {
  archive_sha256?: string;
  compressed_archive_sha256?: string;
};

export type VerifiedAnalysisArchive = {
  path: string;
  archive: any;
  archiveSha256: string;
  artifactSha256: string;
  compressed: boolean;
  indexed: boolean;
};

export type AnalysisRunProjector = (
  rawRun: any,
  indexedRun: any,
  runIndex: number,
) => any;

/**
 * Load raw-report fields needed by descriptive analysis without materializing
 * a deep canonical archive as one Buffer/string. Decision fields come from the
 * checksummed compact index. The raw archive is streamed one compact run line
 * at a time; each retained report is bound to the index's rawReportSha256 and
 * the complete decompressed byte stream is bound to archiveSha256.
 */
export async function loadVerifiedAnalysisArchive(
  path: string,
  expected?: RetainedReference,
  projectRun?: AnalysisRunProjector,
): Promise<VerifiedAnalysisArchive> {
  const absolute = resolve(path);
  const compressed = absolute.endsWith(".gz");
  const indexPath = decisionIndexCandidates(absolute).find((candidate) => existsSync(candidate));
  if (indexPath === undefined) return loadVerifiedArchive(absolute, expected as any);

  const artifactSha256 = sha256File(absolute);
  const expectedArtifact = compressed
    ? expected?.compressed_archive_sha256
    : expected?.archive_sha256;
  const artifactSidecar = readSidecarSha(absolute);
  if (expectedArtifact === undefined && artifactSidecar === undefined) {
    throw new Error(`${basename(absolute)}: missing SHA-256 integrity sidecar`);
  }
  for (const trusted of [expectedArtifact, artifactSidecar]) {
    if (trusted !== undefined && trusted !== artifactSha256) {
      throw new Error(`${basename(absolute)}: archive checksum mismatch`);
    }
  }

  const indexBytes = readFileSync(indexPath);
  const indexSidecar = readSidecarSha(indexPath);
  if (indexSidecar === undefined || indexSidecar !== sha256(indexBytes)) {
    throw new Error(`${basename(indexPath)}: decision-index checksum mismatch or missing sidecar`);
  }
  const index = JSON.parse(indexBytes.toString("utf8"));
  if (
    index.schema !== "line.benchmark-v2.decision-index.v1" ||
    typeof index.archiveSha256 !== "string" ||
    typeof index.compressedArchiveSha256 !== "string" ||
    typeof index.payloadSha256 !== "string" ||
    !Array.isArray(index.archive?.runs)
  ) throw new Error(`${basename(indexPath)}: unsupported decision index`);
  if (
    (compressed ? index.compressedArchiveSha256 : index.archiveSha256) !== artifactSha256 ||
    expected?.archive_sha256 !== undefined && expected.archive_sha256 !== index.archiveSha256 ||
    expected?.compressed_archive_sha256 !== undefined &&
      expected.compressed_archive_sha256 !== index.compressedArchiveSha256
  ) throw new Error(`${basename(indexPath)}: decision index does not match retained evidence`);
  if (sha256(JSON.stringify(index.archive)) !== index.payloadSha256) {
    throw new Error(`${basename(indexPath)}: decision-index payload checksum mismatch`);
  }

  const rawHash = createHash("sha256");
  const decoder = new StringDecoder("utf8");
  const reports: any[] = [];
  let buffer = "";
  let inRuns = false;
  let payloadCommitment: string | undefined;
  const source = compressed
    ? createReadStream(absolute).pipe(createGunzip())
    : createReadStream(absolute);

  const consumeLine = (line: string): void => {
    const trimmed = line.trim();
    if (!inRuns) {
      const commitment = trimmed.match(/^"decisionIndexPayloadSha256":\s*"([a-f0-9]{64})",?$/);
      if (commitment !== null) payloadCommitment = commitment[1];
      if (trimmed === '"runs": [') inRuns = true;
      return;
    }
    if (trimmed === "]" || trimmed === "],") {
      inRuns = false;
      return;
    }
    if (trimmed.length === 0) return;
    const encoded = trimmed.endsWith(",") ? trimmed.slice(0, -1) : trimmed;
    if (!encoded.startsWith("{")) {
      throw new Error(`${basename(absolute)}: malformed compact run boundary`);
    }
    const raw = JSON.parse(encoded);
    const projected = index.archive.runs[reports.length];
    if (projected === undefined) {
      throw new Error(`${basename(absolute)}: raw archive has more runs than its decision index`);
    }
    const reportSha256 = sha256(JSON.stringify(raw.report ?? null));
    if (projected.rawReportSha256 !== reportSha256) {
      throw new Error(`${basename(absolute)}: run ${reports.length} report differs from decision index`);
    }
    const rawDecisionFields = {
      status: raw.status,
      task: raw.task,
      source: raw.source,
      authoredContacts: raw.authoredContacts,
      score: raw.score,
    };
    const { rawReportSha256: _reportHash, ...indexedDecisionFields } = projected;
    if (JSON.stringify(rawDecisionFields) !== JSON.stringify(indexedDecisionFields)) {
      throw new Error(`${basename(absolute)}: run ${reports.length} decision fields differ from index`);
    }
    reports.push(projectRun === undefined
      ? {
          ...indexedDecisionFields,
          report: { gaps: raw.report?.gaps ?? [] },
        }
      : projectRun(raw, indexedDecisionFields, reports.length));
  };

  for await (const chunk of source) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    rawHash.update(bytes);
    buffer += decoder.write(bytes);
    while (true) {
      const newline = buffer.indexOf("\n");
      if (newline < 0) break;
      consumeLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
    }
  }
  buffer += decoder.end();
  if (buffer.length > 0) consumeLine(buffer);
  const archiveSha256 = rawHash.digest("hex");
  if (archiveSha256 !== index.archiveSha256) {
    throw new Error(`${basename(absolute)}: decompressed archive checksum mismatch`);
  }
  if (payloadCommitment !== index.payloadSha256) {
    throw new Error(`${basename(absolute)}: raw archive is detached from its decision index`);
  }
  if (reports.length !== index.archive.runs.length) {
    throw new Error(`${basename(absolute)}: raw/index run-count mismatch`);
  }

  return {
    path: absolute,
    archive: { ...index.archive, runs: reports },
    archiveSha256,
    artifactSha256,
    compressed,
    indexed: true,
  };
}

function decisionIndexCandidates(path: string): string[] {
  if (!path.endsWith(".gz")) return [`${path}.decision-index.json`];
  return [
    `${path.slice(0, -3)}.decision-index.json`,
    path.replace(/\.json\.gz$/, ".decision-index.json"),
  ];
}

function readSidecarSha(path: string): string | undefined {
  const sidecar = `${path}.sha256`;
  if (!existsSync(sidecar)) return undefined;
  const value = readFileSync(sidecar, "utf8").trim().split(/\s+/)[0];
  return /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}

function sha256File(path: string): string {
  const hash = createHash("sha256");
  const descriptor = openSync(path, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let position = 0;
    while (true) {
      const length = readSync(descriptor, buffer, 0, buffer.length, position);
      if (length === 0) return hash.digest("hex");
      hash.update(buffer.subarray(0, length));
      position += length;
    }
  } finally {
    closeSync(descriptor);
  }
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
