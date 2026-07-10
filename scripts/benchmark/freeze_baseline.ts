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

export function freezeBaseline(bundleArgument: string): void {
  const bundlePath = resolve(bundleArgument);
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  if (bundle.schema !== "line.benchmark-v2.baseline-bundle.v1") {
    throw new Error(`unsupported baseline bundle`);
  }
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
    archives.some((archive) => archive.identity.engine !== "wasm" || archive.identity.compiler !== "compileHandoff") ||
    archives.some((archive) => archive.identity.suiteFingerprint !== development.identity.suiteFingerprint) ||
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
  assertProfileSeedsDisjoint(probe, development);
  const catalogLock = JSON.parse(readFileSync("benchmark/v2/catalog.lock.json", "utf8"));
  const baseline = {
    schema: "line.benchmark-v2.baseline-reference.v5",
    status: "canonical-baseline",
    label: bundle.label,
    generated_at: bundle.generatedAt,
    bundle: relative(bundlePath),
    catalog_fingerprint: catalogLock.fingerprint,
    suite_fingerprint: development.identity.suiteFingerprint,
    execution_protocol: BENCHMARK_EXECUTION_PROTOCOL,
    engine: development.identity.engine,
    compiler_identity_protocol: development.git.compilerIdentityProtocol,
    compiler_source_fingerprint: development.git.compilerSourceFingerprint,
    compiler_source_files: development.git.compilerSourceFiles,
    compiler_environment: development.git.compilerEnvironment,
    engine_artifact_fingerprint: development.git.engineArtifactFingerprint,
    candidate_fingerprint: development.git.candidateFingerprint,
    probe: archiveSummary(probe, bundle.probe),
    development: archiveSummary(development, bundle.development),
    qualification: {
      ...archiveSummary(qualification, bundle.qualification),
      linked_development_archive_sha256: qualification.linkedDevelopment.sha256,
    },
  };
  write("benchmark/v2/baseline.json", `${JSON.stringify(baseline, null, 2)}\n`);
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
  const probeByBudget = new Map(probe.identity.seedSchedule.byBudget.map((entry: any) => [
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
    "Probe and canonical actual seeds are disjoint at every shared budget. Probe evidence screens candidates; only canonical evidence can promote one.",
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
  const bundleArgument = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (bundleArgument === undefined) throw new Error(`usage: freeze_baseline.ts <baseline-bundle.json>`);
  freezeBaseline(bundleArgument);
}
