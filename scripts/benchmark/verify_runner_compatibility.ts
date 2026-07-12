/**
 * Runner-compatibility evidence (RFC D steps 3–5).
 *
 * The runner implementation fingerprint changed (an operational-only edit).
 * This tool proves the change did not alter compiler behavior: it replays the
 * frozen baseline compiler snapshot as a probe run under the CURRENT tree's
 * runner and compares every successful row bit-level — (task, report, score,
 * trackHash, authoredContacts) — against the retained probe reference. On a
 * bit-identical result it writes a checksummed evidence file and, with
 * --approve, appends the reviewed approval to benchmark/v2/runner-compatibility.json.
 *
 * The semantic execution-policy fingerprint must be unchanged (asserted);
 * only the implementation fingerprint may differ.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { benchmarkV2Paths, prepareBenchmarkV2 } from "./prepare.ts";
import { runSnapshotBenchmark } from "../v0/benchmark_v2/compiler_snapshot.ts";
import { compareArchiveRows } from "../v0/benchmark_v2/runner_compatibility.ts";
import { validateDecisionIndexAgainstArchive } from "../v0/benchmark_v2/runner.ts";
import { withAttemptLedgerTransaction } from "../v0/benchmark_v2/attempts.ts";

const REPO = resolve(dirname(new URL(import.meta.url).pathname), "..", "..");

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

const reviewedBy = argument("reviewed-by");
const rationale = argument("rationale");
const approve = process.argv.includes("--approve");
const jobs = argument("jobs") ?? String(Math.min(48, availableParallelism()));
const outDir = resolve(REPO, argument("out-dir") ?? "generated/benchmark-v2/runner-compat");
if (approve && (reviewedBy === undefined || rationale === undefined)) {
  throw new Error(`--approve requires --reviewed-by=... and --rationale=...`);
}

await prepareBenchmarkV2();

const { probeBaseline, baseline } = withAttemptLedgerTransaction(undefined, () => {
  for (const pending of [
    "benchmark/v2/migration-pending.json",
    "benchmark/v2/baseline-publication-pending.json",
  ]) {
    if (existsSync(resolve(REPO, pending))) {
      throw new Error(`baseline publication state is incomplete (${pending}); recover it before compatibility replay`);
    }
  }
  const probe = JSON.parse(readFileSync(resolve(REPO, "benchmark/v2/probe-baseline.json"), "utf8"));
  const canonical = JSON.parse(readFileSync(resolve(REPO, "benchmark/v2/baseline.json"), "utf8"));
  if (probe.label !== canonical.label) throw new Error(`probe and canonical baseline labels differ`);
  return { probeBaseline: probe, baseline: canonical };
});
const retainedPath = resolve(REPO, probeBaseline.probe.compressed_archive);
const retainedBytes = readFileSync(retainedPath);
if (createHash("sha256").update(retainedBytes).digest("hex") !== probeBaseline.probe.compressed_archive_sha256) {
  throw new Error(`retained probe reference checksum mismatch`);
}
const retained = JSON.parse(gunzipSync(retainedBytes).toString("utf8"));

if (baseline.compiler_snapshot === undefined) throw new Error(`baseline has no compiler snapshot to replay`);

mkdirSync(outDir, { recursive: true });
const replayPath = resolve(outDir, `replay-probe-${Date.now()}.json`);
console.log(`replaying the baseline compiler snapshot as a probe run...`);
const replayRun = runSnapshotBenchmark(baseline.compiler_snapshot, "development", [
  "--profile=probe",
  `--manifest=${benchmarkV2Paths.sourceManifest}`,
  `--heldout-manifest=${benchmarkV2Paths.heldoutManifest}`,
  `--suite=${benchmarkV2Paths.suiteManifest}`,
  `--characterization=${benchmarkV2Paths.characterization}`,
  `--audit=${benchmarkV2Paths.audit}`,
  `--review=${benchmarkV2Paths.review}`,
  `--listening-review=${benchmarkV2Paths.listeningReview}`,
  `--jobs=${jobs}`,
], replayPath);
if (replayRun.workerFailures > 0) throw new Error(`replay run has worker failures; not usable as compatibility evidence`);
const replay = JSON.parse(readFileSync(replayPath, "utf8"));
const indexedRows = validateDecisionIndexAgainstArchive(`${replayPath}.decision-index.json`, replay);

// Identities: semantic policy must be unchanged; implementation may differ.
if (replay.identity.executionPolicyFingerprint !== retained.identity.executionPolicyFingerprint) {
  throw new Error(`execution-policy fingerprint changed — this is a semantic change, not runner-compatibility material`);
}
const fromFingerprint = retained.identity.implementationFingerprint;
const toFingerprint = replay.identity.implementationFingerprint;
if (fromFingerprint === toFingerprint) {
  console.log(`implementation fingerprints already equal (${fromFingerprint.slice(0, 12)}); nothing to approve`);
  process.exit(0);
}

const { comparedRows, mismatches } = compareArchiveRows(retained, replay);
if (mismatches.length > 0) {
  console.error(`NOT bit-identical: ${mismatches.length} rows differ; first: ${mismatches[0]}`);
  console.error(`a differing row means the runner change altered compiler behavior — this is NOT approvable as operational-only`);
  process.exit(1);
}
console.log(`bit-identical: ${comparedRows}/${comparedRows} rows match (task, report, score, trackHash, authoredContacts)`);

const evidence = {
  schema: "line.benchmark-v2.runner-compat-evidence.v1",
  fromImplementationFingerprint: fromFingerprint,
  toImplementationFingerprint: toFingerprint,
  executionPolicyFingerprint: replay.identity.executionPolicyFingerprint,
  suiteFingerprint: replay.identity.suiteFingerprint,
  retained: {
    path: probeBaseline.probe.compressed_archive,
    compressedSha256: probeBaseline.probe.compressed_archive_sha256,
  },
  replay: {
    archiveSha256: replayRun.archiveSha256,
    compressedSha256: replayRun.compressedArchiveSha256,
    headline: replayRun.headline,
  },
  comparedRows,
  decisionIndexRows: indexedRows,
  comparedFields: ["task", "report", "score", "trackHash", "authoredContacts", "decisionIndexProjection"],
  result: "bit-identical",
};
const evidenceBytes = `${JSON.stringify(evidence, null, 2)}\n`;
const evidenceSha256 = createHash("sha256").update(evidenceBytes).digest("hex");
const evidenceRelativePath =
  `benchmark/v2/evidence/runner-compat-${fromFingerprint.slice(0, 8)}-${toFingerprint.slice(0, 8)}-${evidenceSha256.slice(0, 8)}.json`;
const evidencePath = resolve(REPO, evidenceRelativePath);

if (approve) {
  const compatPath = resolve(REPO, "benchmark/v2/runner-compatibility.json");
  const compat = JSON.parse(readFileSync(compatPath, "utf8"));
  compat.approvals = compat.approvals ?? [];
  const existing = compat.approvals.find((entry: any) =>
    entry.fromImplementationFingerprint === fromFingerprint &&
    entry.toImplementationFingerprint === toFingerprint &&
    entry.executionProtocol === replay.identity.executionProtocol &&
    entry.suiteFingerprint === replay.identity.suiteFingerprint
  );
  if (existing !== undefined) {
    const existingPath = resolve(REPO, existing.evidence?.path ?? "");
    if (
      !existsSync(existingPath) ||
      createHash("sha256").update(readFileSync(existingPath)).digest("hex") !== existing.evidence?.sha256
    ) throw new Error(`existing runner compatibility approval has missing or stale evidence`);
    console.log(`approval already exists and remains valid: ${fromFingerprint.slice(0, 12)} -> ${toFingerprint.slice(0, 12)}`);
    process.exit(0);
  }
  writeFileSync(evidencePath, evidenceBytes);
  console.log(`evidence: ${evidencePath}`);
  compat.approvals.push({
    fromImplementationFingerprint: fromFingerprint,
    toImplementationFingerprint: toFingerprint,
    executionProtocol: replay.identity.executionProtocol,
    suiteFingerprint: replay.identity.suiteFingerprint,
    reviewedBy,
    reviewedAt: new Date().toISOString(),
    rationale,
    evidence: {
      path: evidenceRelativePath,
      sha256: evidenceSha256,
      result: "bit-identical",
    },
  });
  writeFileSync(compatPath, `${JSON.stringify(compat, null, 2)}\n`);
  console.log(`approval appended: ${fromFingerprint.slice(0, 12)} -> ${toFingerprint.slice(0, 12)}`);
} else {
  writeFileSync(evidencePath, evidenceBytes);
  console.log(`evidence: ${evidencePath}`);
}
