import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const bundleArgument = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (bundleArgument === undefined) throw new Error(`usage: freeze_baseline.ts <canonical-bundle.json>`);
const bundlePath = resolve(bundleArgument);
const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
if (bundle.schema !== "line.benchmark-v2.canonical-bundle.v1") throw new Error(`unsupported canonical bundle`);
const development = loadRetained(bundle.development.retainedCompressedArchive, bundle.development.compressedSha256);
const qualification = loadRetained(bundle.qualification.retainedCompressedArchive, bundle.qualification.compressedSha256);
if (
  development.mode !== "development" || qualification.mode !== "qualification" ||
  development.profile !== "canonical" || qualification.profile !== "canonical"
) {
  throw new Error(`baseline requires canonical development and qualification archives`);
}
if (
  development.identity.suiteFingerprint !== qualification.identity.suiteFingerprint ||
  development.git.candidateFingerprint !== qualification.git.candidateFingerprint ||
  qualification.linkedDevelopment?.sha256 !== bundle.development.sha256
) {
  throw new Error(`canonical qualification is not linked to the same suite, candidate, and development archive`);
}
const catalogLock = JSON.parse(readFileSync("benchmark/v2/catalog.lock.json", "utf8"));
const baseline = {
  schema: "line.benchmark-v2.baseline-reference.v3",
  status: "canonical-baseline",
  label: bundle.label,
  generated_at: bundle.generatedAt,
  bundle: relative(bundlePath),
  catalog_fingerprint: catalogLock.fingerprint,
  suite_fingerprint: development.identity.suiteFingerprint,
  engine: development.identity.engine,
  compiler_source_fingerprint: development.git.compilerSourceFingerprint,
  compiler_environment: development.git.compilerEnvironment,
  engine_artifact_fingerprint: development.git.engineArtifactFingerprint,
  candidate_fingerprint: development.git.candidateFingerprint,
  development: archiveSummary(development, bundle.development),
  qualification: {
    ...archiveSummary(qualification, bundle.qualification),
    linked_development_archive_sha256: qualification.linkedDevelopment.sha256,
  },
};
write("benchmark/v2/baseline.json", `${JSON.stringify(baseline, null, 2)}\n`);
write("docs/benchmark-v2-baseline.md", renderMarkdown(baseline));
console.log(renderMarkdown(baseline));

function loadRetained(path: string, expectedSha256: string): any {
  const bytes = readFileSync(path);
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expectedSha256) throw new Error(`${path}: compressed archive checksum mismatch`);
  return JSON.parse(gunzipSync(bytes).toString("utf8"));
}

function archiveSummary(archive: any, bundleEntry: any): Record<string, unknown> {
  const summaries = archive.mode === "development" ? archive.developmentSummaries : archive.qualificationSummaries;
  return {
    execution_policy_fingerprint: archive.identity.executionPolicyFingerprint,
    harness_fingerprint: archive.identity.harnessFingerprint,
    archive_sha256: bundleEntry.sha256,
    compressed_archive: bundleEntry.retainedCompressedArchive,
    compressed_archive_sha256: bundleEntry.compressedSha256,
    ...(archive.mode === "development"
      ? { canonical_headline: archive.canonicalHeadline }
      : { monitor_score: archive.qualificationMonitorScore }),
    budgets: summaries.map((summary: any) => ({
      budget: summary.budget,
      score: summary.score ?? summary.monitorScore,
      valid_runs: summary.validRuns,
      total_runs: summary.totalRuns,
    })),
  };
}

function renderMarkdown(baseline: any): string {
  const development = baseline.development;
  const qualification = baseline.qualification;
  const lines = [
    "# Benchmark V2 Canonical Baseline",
    "",
    `Label: \`${baseline.label}\`. Suite: \`${baseline.suite_fingerprint.slice(0, 16)}\`.`,
    "",
    `Development headline: **${development.canonical_headline.toFixed(2)}**. ` +
      `Qualification monitor: **${qualification.monitor_score.toFixed(2)}** (indicative only).`,
    "",
    "| Budget | Development score | Valid | Qualification monitor | Valid |",
    "|---:|---:|---:|---:|---:|",
    ...development.budgets.map((entry: any, index: number) => {
      const heldout = qualification.budgets[index];
      return `| ${entry.budget / 1000}k | ${entry.score.toFixed(2)} | ${entry.valid_runs}/${entry.total_runs} | ` +
        `${heldout.score.toFixed(2)} | ${heldout.valid_runs}/${heldout.total_runs} |`;
    }),
    "",
    `Candidate: \`${baseline.candidate_fingerprint}\`.`,
    "",
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
