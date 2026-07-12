import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import {
  BENCHMARK_EXECUTION_PROTOCOL,
  BENCHMARK_RUN_ARCHIVE_SCHEMA,
  COMPILER_IDENTITY_PROTOCOL,
} from "../../benchmark/v2/decision-policy.ts";
import {
  validateCompilerSnapshot,
  type CompilerSnapshot,
} from "../v0/benchmark_v2/compiler_snapshot.ts";
import { requireCurrentDecisionCalibration } from "../v0/benchmark_v2/calibration_guard.ts";

export function freezeBaseline(bundleArgument: string): void {
  const bundlePath = resolve(bundleArgument);
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  if (bundle.schema !== "line.benchmark-v2.baseline-bundle.v3") {
    throw new Error(`unsupported baseline bundle`);
  }
  validateCompilerSnapshot(bundle.compilerSnapshot as CompilerSnapshot);
  const probe = loadRetained(
    bundle.probe.retainedCompressedArchive,
    bundle.probe.compressedSha256,
    bundle.probe.sha256,
  );
  const development = loadRetained(
    bundle.development.retainedCompressedArchive,
    bundle.development.compressedSha256,
    bundle.development.sha256,
  );
  const qualification = loadRetained(
    bundle.qualification.retainedCompressedArchive,
    bundle.qualification.compressedSha256,
    bundle.qualification.sha256,
  );
  if (
    [probe, development, qualification].some((archive) => archive.schema !== BENCHMARK_RUN_ARCHIVE_SCHEMA) ||
    probe.mode !== "development" || probe.profile !== "probe" ||
    development.mode !== "development" || development.profile !== "canonical" ||
    qualification.mode !== "qualification" || qualification.profile !== "canonical"
  ) {
    throw new Error(`baseline requires probe, canonical development, and canonical qualification archives`);
  }
  const archives = [probe, development, qualification];
  if (
    archives.some((archive) => archive.identity.executionProtocol !== BENCHMARK_EXECUTION_PROTOCOL) ||
    archives.some((archive) => archive.identity.listeningReviewStatus !== "approved") ||
    archives.some((archive) =>
      archive.identity.listeningReviewFingerprint !== development.identity.listeningReviewFingerprint
    ) ||
    archives.some((archive) => archive.identity.engine !== "wasm" || archive.identity.compiler !== "compileHandoff") ||
    archives.some((archive) => archive.identity.suiteFingerprint !== development.identity.suiteFingerprint) ||
    archives.some((archive) =>
      archive.identity.implementationFingerprint !== development.identity.implementationFingerprint
    ) ||
    archives.some((archive) => archive.git.candidateFingerprint !== development.git.candidateFingerprint) ||
    archives.some((archive) => archive.git.compilerIdentityProtocol !== COMPILER_IDENTITY_PROTOCOL) ||
    archives.some((archive) => !validCompilerSourceFiles(archive.git.compilerSourceFiles)) ||
    archives.some((archive) => archive.git.compilerSourceFingerprint !== development.git.compilerSourceFingerprint) ||
    archives.some((archive) => JSON.stringify(archive.git.compilerSourceFiles) !== JSON.stringify(development.git.compilerSourceFiles)) ||
    archives.some((archive) => JSON.stringify(archive.git.compilerEnvironment) !== JSON.stringify(development.git.compilerEnvironment)) ||
    archives.some((archive) => archive.git.engineArtifactFingerprint !== development.git.engineArtifactFingerprint) ||
    archives.some((archive) => candidateFingerprint(archive) !== archive.git.candidateFingerprint) ||
    archives.some((archive) => runtimeIdentity(archive) !== runtimeIdentity(development)) ||
    archives.some((archive) => archive.runs.some((row: any) => row.status !== "ok")) ||
    qualification.linkedDevelopment?.sha256 !== bundle.development.sha256
  ) {
    throw new Error(`baseline archives do not share the suite, protocol, candidate, engine, and canonical linkage`);
  }
  if (
    bundle.compilerSnapshot.candidateFingerprint !== development.git.candidateFingerprint ||
    bundle.compilerSnapshot.compilerSourceFingerprint !== development.git.compilerSourceFingerprint ||
    JSON.stringify(bundle.compilerSnapshot.compilerEnvironment) !== JSON.stringify(development.git.compilerEnvironment) ||
    bundle.compilerSnapshot.engineArtifactFingerprint !== development.git.engineArtifactFingerprint
  ) {
    throw new Error(`baseline compiler snapshot does not reproduce the measured compiler identity`);
  }
  assertProfileSeedsDisjoint(probe, development);
  const decisionContract = requireCurrentDecisionCalibration(development.identity.suiteFingerprint);
  if (JSON.stringify(bundle.decisionContract) !== JSON.stringify(decisionContract)) {
    throw new Error(`decision or calibration contract changed while baseline evidence was running; if the change is intentional, migrate the contract (benchmark migrate) and re-freeze`);
  }
  const catalogLock = JSON.parse(readFileSync("benchmark/v2/catalog.lock.json", "utf8"));
  const baseline = {
    schema: "line.benchmark-v2.baseline-reference.v9",
    status: "canonical-baseline",
    label: bundle.label,
    generated_at: bundle.generatedAt,
    bundle: relative(bundlePath),
    catalog_fingerprint: catalogLock.fingerprint,
    suite_fingerprint: development.identity.suiteFingerprint,
    execution_protocol: BENCHMARK_EXECUTION_PROTOCOL,
    listening_review_fingerprint: development.identity.listeningReviewFingerprint,
    listening_review_status: development.identity.listeningReviewStatus,
    engine: development.identity.engine,
    compiler_identity_protocol: development.git.compilerIdentityProtocol,
    compiler_source_fingerprint: development.git.compilerSourceFingerprint,
    compiler_source_files: development.git.compilerSourceFiles,
    compiler_environment: development.git.compilerEnvironment,
    engine_artifact_fingerprint: development.git.engineArtifactFingerprint,
    candidate_fingerprint: development.git.candidateFingerprint,
    decision_inference_fingerprint: decisionContract.inferenceFingerprint,
    decision_protocol_fingerprint: decisionContract.protocolFingerprint,
    decision_calibration_fingerprint: decisionContract.calibrationFingerprint,
    compiler_snapshot: bundle.compilerSnapshot,
    probe: archiveSummary(probe, bundle.probe),
    development: archiveSummary(development, bundle.development),
    qualification: {
      ...archiveSummary(qualification, bundle.qualification),
      linked_development_archive_sha256: qualification.linkedDevelopment.sha256,
    },
  };
  write("benchmark/v2/baseline.json", `${JSON.stringify(baseline, null, 2)}\n`);
  write("benchmark/v2/probe-baseline.json", `${JSON.stringify({
    schema: "line.benchmark-v2.probe-baseline-reference.v1",
    status: "screening-baseline",
    label: baseline.label,
    generated_at: baseline.generated_at,
    suite_fingerprint: baseline.suite_fingerprint,
    execution_protocol: baseline.execution_protocol,
    listening_review_fingerprint: baseline.listening_review_fingerprint,
    listening_review_status: baseline.listening_review_status,
    compiler_identity_protocol: baseline.compiler_identity_protocol,
    candidate_fingerprint: baseline.candidate_fingerprint,
    probe: baseline.probe,
  }, null, 2)}\n`);
  write("docs/benchmark-v2-baseline.md", renderMarkdown(baseline));
  console.log(renderMarkdown(baseline));
}

function loadRetained(path: string, expectedCompressedSha256: string, expectedArchiveSha256: string): any {
  const bytes = readFileSync(path);
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expectedCompressedSha256) throw new Error(`${path}: compressed archive checksum mismatch`);
  const archiveBytes = gunzipSync(bytes);
  const archiveSha256 = createHash("sha256").update(archiveBytes).digest("hex");
  if (archiveSha256 !== expectedArchiveSha256) throw new Error(`${path}: decompressed archive checksum mismatch`);
  return JSON.parse(archiveBytes.toString("utf8"));
}

function runtimeIdentity(archive: any): string {
  return JSON.stringify({
    node: archive.environment?.node,
    platform: archive.environment?.platform,
    architecture: archive.environment?.architecture,
  });
}

function validCompilerSourceFiles(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 &&
    value.every((path) => typeof path === "string") && new Set(value).size === value.length;
}

function candidateFingerprint(archive: any): string {
  return createHash("sha256").update(JSON.stringify({
    compilerIdentityProtocol: archive.git.compilerIdentityProtocol,
    compilerSourceFingerprint: archive.git.compilerSourceFingerprint,
    compilerEnvironment: archive.git.compilerEnvironment,
    engine: archive.identity.engine,
    engineArtifactFingerprint: archive.git.engineArtifactFingerprint,
  })).digest("hex");
}

function assertProfileSeedsDisjoint(probe: any, canonical: any): void {
  const probeByBudget = new Map<number, Set<number>>(probe.identity.seedSchedule.byBudget.map((entry: any) => [
    entry.budget,
    new Set<number>(entry.actualSeeds),
  ]));
  for (const entry of canonical.identity.seedSchedule.byBudget) {
    const probeSeeds = probeByBudget.get(entry.budget);
    if (probeSeeds !== undefined && entry.actualSeeds.some((seed: number) => probeSeeds.has(seed))) {
      throw new Error(`${entry.budget}: baseline probe and canonical seeds overlap`);
    }
  }
}

function archiveSummary(archive: any, bundleEntry: any): Record<string, unknown> {
  const summaries = archive.mode === "development" ? archive.developmentSummaries : archive.qualificationSummaries;
  return {
    execution_policy_fingerprint: archive.identity.executionPolicyFingerprint,
    implementation_fingerprint: archive.identity.implementationFingerprint,
    archive_sha256: bundleEntry.sha256,
    compressed_archive: bundleEntry.retainedCompressedArchive,
    compressed_archive_sha256: bundleEntry.compressedSha256,
    ...(archive.mode === "development"
      ? { canonical_headline: archive.canonicalHeadline }
      : { monitor_score: archive.qualificationMonitorScore }),
    seed_schedule: archive.identity.seedSchedule,
    budgets: summaries.map((summary: any) => ({
      budget: summary.budget,
      score: summary.score ?? summary.monitorScore,
      valid_runs: summary.validRuns,
      total_runs: summary.totalRuns,
    })),
  };
}

function renderMarkdown(baseline: any): string {
  const probe = baseline.probe;
  const development = baseline.development;
  const qualification = baseline.qualification;
  const lines = [
    "# Benchmark V2 Baseline",
    "",
    `Label: \`${baseline.label}\`. Suite: \`${baseline.suite_fingerprint.slice(0, 16)}\`.`,
    "",
    `Probe headline: **${probe.canonical_headline.toFixed(2)}**. ` +
      `Canonical headline: **${development.canonical_headline.toFixed(2)}**. ` +
      `Qualification monitor: **${qualification.monitor_score.toFixed(2)}** (indicative only).`,
    "",
    "Probe and confirmation actual seeds are disjoint at every shared budget. Probe evidence screens candidates; only a declared `eval --to-verdict` confirmation can promote one.",
    "",
    "| Budget | Probe | Valid | Canonical | Valid | Qualification | Valid |",
    "|---:|---:|---:|---:|---:|---:|---:|",
    ...development.budgets.map((entry: any, index: number) => {
      const probeEntry = probe.budgets.find((candidate: any) => candidate.budget === entry.budget);
      const heldout = qualification.budgets[index];
      return `| ${entry.budget / 1000}k | ${probeEntry?.score.toFixed(2) ?? "-"} | ` +
        `${probeEntry === undefined ? "-" : `${probeEntry.valid_runs}/${probeEntry.total_runs}`} | ` +
        `${entry.score.toFixed(2)} | ${entry.valid_runs}/${entry.total_runs} | ` +
        `${heldout.score.toFixed(2)} | ${heldout.valid_runs}/${heldout.total_runs} |`;
    }),
    "",
    `Candidate: \`${baseline.candidate_fingerprint}\`.`,
    `Inference rule: \`${baseline.decision_inference_fingerprint}\`.`,
    `Decision protocol: \`${baseline.decision_protocol_fingerprint}\`.`,
    `Decision calibration: \`${baseline.decision_calibration_fingerprint}\`.`,
  ];
  return `${lines.join("\n")}\n`;
}

function write(path: string, value: string): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, value);
}

function relative(path: string): string {
  return path.startsWith(`${process.cwd()}/`) ? path.slice(process.cwd().length + 1) : path;
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) {
  throw new Error(
    `direct baseline freeze is retired; use \`npm run benchmark -- baseline\` for bootstrap/suite rollover ` +
    `or \`npm run benchmark -- rebaseline\` after an accepted eval or ledgered transition`,
  );
}
