/**
 * Promote one explicit cached-comparison artifact.
 *
 * There is no implicit "latest attempt" and no governance state. The artifact
 * names the candidate archive and exact compiler snapshot. Rebaseline verifies
 * those bytes, runs the small probe and qualification sidecar, then publishes
 * the ordinary compact baseline references through a recoverable journal.
 */

import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { resolve } from "node:path";
import { createGunzip } from "node:zlib";
import { assertCompilerSourcesCommitted } from "./compiler_identity.ts";
import {
  createSnapshotWorkspace,
  disposeSnapshotWorkspace,
  runInWorkspace,
  validateCompilerSnapshot,
  type CompilerSnapshot,
  type SnapshotBenchmarkRun,
} from "./compiler_snapshot.ts";
import {
  discardUntouchedPendingBaselinePublication,
  publishBaseline,
  recoverPendingBaselinePublication,
} from "./baseline_publication.ts";
import { copyFileDurable, writeFileAtomicDurable } from "./durable_fs.ts";
import { requireCurrentDecisionCalibration } from "./calibration_guard.ts";
import { loadSourceManifest, resolveSources } from "./model.ts";
import { compilerCandidateIdentity } from "./runner.ts";
import { suiteIdentity } from "./suite_model.ts";
import type { CachedComparisonArtifact } from "./eval.ts";
import {
  BASELINE_CACHE_LADDER_SCHEMA,
  BASELINE_CACHE_SCHEMA,
  BASELINE_CACHE_SHARD_SCHEMA,
  CAMPAIGN_BASELINE_REFERENCE_SCHEMA,
  baselineCacheManifestFingerprint,
} from "./baseline_cache.ts";
import { loadVerifiedArchive } from "./decide.ts";

export async function runRebaselineCommand(argv = process.argv.slice(2)): Promise<number> {
  const argument = (name: string): string | undefined =>
    argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (process.env.LR_ENGINE !== "wasm") throw new Error(`rebaseline requires LR_ENGINE=wasm`);
  const allowedValues = new Set(["from", "label", "archive-dir", "out-dir", "jobs", "force-reason"]);
  for (const value of argv) {
    if (
      value === "--resume" || value === "--discard-pending" || value === "--force"
    ) continue;
    if (!value.startsWith("--")) throw new Error(`rebaseline does not accept positional argument ${value}`);
    const equals = value.indexOf("=");
    const name = value.slice(2, equals === -1 ? undefined : equals);
    if (equals === -1 || !allowedValues.has(name)) throw new Error(`unsupported rebaseline flag ${value}`);
  }
  if (argv.includes("--discard-pending")) {
    discardUntouchedPendingBaselinePublication();
    console.log(`discarded an untouched pending baseline publication`);
    return 0;
  }
  if (recoverPendingBaselinePublication()) {
    console.log(`recovered the pending baseline publication`);
    return 0;
  }

  const from = argument("from");
  const label = argument("label");
  if (from === undefined || from.trim() === "") {
    throw new Error(`rebaseline requires --from=<cached comparison artifact>`);
  }
  if (label === undefined || label.trim() === "") throw new Error(`rebaseline requires --label=<new baseline label>`);
  const safeLabel = label.replace(/[^a-zA-Z0-9_.-]+/g, "-");
  const jobs = Number(argument("jobs") ?? Math.min(48, availableParallelism()));
  if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 48) throw new Error(`--jobs must be an integer in 1..48`);
  const archiveDir = resolve(argument("archive-dir") ?? "benchmark/v2/runs");
  const outDir = resolve(argument("out-dir") ?? "generated/benchmark-v2/rebaseline");
  mkdirSync(archiveDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const artifactPath = resolve(from);
  const artifact = readComparisonArtifact(artifactPath);
  /*
   * A promotion is not always an accepted improvement.
   *
   * The default gate is right: a candidate that did not clear the decision
   * procedure should not silently become the reference everything else is
   * measured against. But the project also deliberately REPLACES the baseline -
   * to adopt a change that is at parity while being cheaper, or to move off a
   * baseline whose strata no longer reflect what is being built. Until now the
   * only route for that was `benchmark -- baseline`, a full freeze that
   * recomputes every development compile from scratch. When the evidence is a
   * comparison that ALREADY ran at full seed depth, that is thousands of
   * compiles of pure waste - the archive it would rebuild is sitting right
   * there, checksummed, and this command already reuses it via
   * `retainExistingRun`.
   *
   * So a forced promotion is allowed, must be explicit, and must say why. The
   * reason and the bypassed outcome are recorded in the bundle, so the ledger
   * shows a deliberate replacement rather than an ordinary acceptance.
   */
  const forced = argv.includes("--force");
  const forceReason = argument("force-reason");
  if (artifact.decision.result.outcome !== "accept" && !forced) {
    throw new Error(
      `comparison result is ${artifact.decision.result.outcome}, not a supported improvement; ` +
      `collect clearer evidence, keep iterating, or promote deliberately with ` +
      `--force --force-reason="..."`,
    );
  }
  if (forced && (forceReason === undefined || forceReason.trim() === "")) {
    throw new Error(
      `--force requires --force-reason="why this baseline is being replaced"`,
    );
  }
  const candidatePath = resolve(artifact.candidate.archivePath);
  if (!existsSync(candidatePath) || !existsSync(`${candidatePath}.gz`)) {
    throw new Error(`comparison candidate archive is missing; restore ${artifact.candidate.archivePath}`);
  }
  if (await sha256Stream(createReadStream(candidatePath)) !== artifact.candidate.archiveSha256) {
    throw new Error(`comparison candidate archive checksum mismatch`);
  }
  if (await sha256Stream(createReadStream(`${candidatePath}.gz`)) !== artifact.candidate.compressedArchiveSha256) {
    throw new Error(`comparison compressed candidate archive checksum mismatch`);
  }

  validateCompilerSnapshot(artifact.candidate.snapshot);
  assertCompilerSourcesCommitted();
  const current = compilerCandidateIdentity("wasm");
  if (current.candidateFingerprint !== artifact.candidate.snapshot.candidateFingerprint) {
    throw new Error(`the checked-out compiler is not the candidate measured by the comparison artifact`);
  }

  const retainedSnapshotPath = resolve(archiveDir, `${safeLabel}-compiler-snapshot.tar.gz`);
  copyFileDurable(resolve(artifact.candidate.snapshot.archive), retainedSnapshotPath);
  const retainedSnapshot: CompilerSnapshot = {
    ...artifact.candidate.snapshot,
    archive: relativeToCwd(retainedSnapshotPath),
  };
  validateCompilerSnapshot(retainedSnapshot);

  const comparisonBaseline = JSON.parse(readFileSync(resolve(artifact.base.baselinePath), "utf8"));
  if (
    comparisonBaseline.schema === CAMPAIGN_BASELINE_REFERENCE_SCHEMA &&
    comparisonBaseline.status === "active-campaign-baseline"
  ) {
    if (
      baselineCacheManifestFingerprint(comparisonBaseline.canonical_cache) !==
        artifact.base.cacheFingerprint
    ) {
      throw new Error(`the active campaign baseline changed after this comparison`);
    }
    promoteCampaignBaseline({
      comparisonBaseline,
      artifact,
      artifactPath,
      candidatePath,
      retainedSnapshot,
      archiveDir,
      safeLabel,
      forced,
      forceReason,
    });
    console.log(`rebaselined the 750k campaign to ${safeLabel}`);
    console.log(`  frozen 250k/500k V2 evidence was not run or changed`);
    console.log(`  nextCommand: npm run benchmark -- eval --seeds=${comparisonBaseline.scope.seeds}`);
    return 0;
  }

  let workspace: ReturnType<typeof createSnapshotWorkspace> | undefined;
  try {
    workspace = createSnapshotWorkspace(retainedSnapshot);
    const probePath = resolve(outDir, `${safeLabel}-probe.json`);
    const qualificationPath = resolve(outDir, `${safeLabel}-qualification.json`);
    const common = runnerBaseArgs(jobs);
    console.log(`rebaseline ${safeLabel}: refreshing the quick baseline reference`);
    const probe = runInWorkspace(workspace, "development", [
      "--profile=probe",
      ...common,
      ...(argv.includes("--resume") ? ["--resume"] : []),
    ], probePath);
    assertSuccessful(probe, "probe");

    console.log(`rebaseline ${safeLabel}: running the qualification sidecar`);
    const qualification = runInWorkspace(workspace, "qualification", [
      "--profile=canonical",
      ...common,
      `--development-archive=${candidatePath}`,
      ...(argv.includes("--resume") ? ["--resume"] : []),
    ], qualificationPath);
    assertSuccessful(qualification, "qualification");

    const retainedProbe = retainRun(probe, archiveDir, `${safeLabel}-probe`);
    const retainedDevelopment = retainExistingRun(
      candidatePath,
      artifact.candidate.archiveSha256,
      artifact.candidate.compressedArchiveSha256,
      archiveDir,
      `${safeLabel}-development`,
    );
    const retainedQualification = retainRun(qualification, archiveDir, `${safeLabel}-qualification`);

    const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
    const identity = suiteIdentity(
      "benchmark/v2/compat/suite-manifest.json",
      "benchmark/v2/compat/source-manifest.json",
      sources,
    );
    const bundlePath = resolve(archiveDir, `${safeLabel}-baseline.json`);
    const bundle = {
      schema: "line.benchmark-v2.baseline-bundle.v3",
      label: safeLabel,
      generatedAt: new Date().toISOString(),
      promotedComparison: {
        artifact: relativeToCwd(artifactPath),
        artifactSha256: await sha256Stream(createReadStream(artifactPath)),
        seeds: artifact.base.seeds,
        outcome: artifact.decision.result.outcome,
        delta: artifact.decision.result.delta,
        ...(forced
          ? {
            forced: true,
            forceReason: forceReason?.trim(),
          }
          : {}),
      },
      compilerSnapshot: retainedSnapshot,
      decisionContract: requireCurrentDecisionCalibration(identity.suiteFingerprint),
      probe: await retainedEntry(retainedProbe),
      development: await retainedEntry(retainedDevelopment),
      qualification: await retainedEntry(retainedQualification),
    };
    writeFileAtomicDurable(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
    assertBaselineBundleLabel(bundlePath, safeLabel);
    publishBaseline(bundlePath);
    console.log(`rebaselined to ${safeLabel}`);
    console.log(`  nextCommand: npm run benchmark -- eval`);
    return 0;
  } finally {
    if (workspace !== undefined) disposeSnapshotWorkspace(workspace);
  }
}

function readComparisonArtifact(path: string): CachedComparisonArtifact {
  const bytes = readFileSync(path);
  const sidecarPath = `${path}.sha256`;
  if (existsSync(sidecarPath)) {
    const expected = readFileSync(sidecarPath, "utf8").trim().split(/\s+/)[0];
    if (expected !== createHash("sha256").update(bytes).digest("hex")) {
      throw new Error(`comparison artifact checksum mismatch`);
    }
  }
  const artifact = JSON.parse(bytes.toString("utf8")) as CachedComparisonArtifact;
  const schema = (artifact as any).schema;
  if (
    (schema !== "line.benchmark-v2.cached-comparison.v1" &&
      schema !== "line.benchmark-v2.cached-comparison.v2") ||
    artifact.status !== "complete" ||
    typeof artifact.candidate?.archivePath !== "string" ||
    artifact.candidate?.snapshot === undefined ||
    artifact.decision?.result === undefined
  ) {
    throw new Error(`unsupported cached comparison artifact`);
  }
  return artifact;
}

function promoteCampaignBaseline(input: {
  comparisonBaseline: any;
  artifact: CachedComparisonArtifact;
  artifactPath: string;
  candidatePath: string;
  retainedSnapshot: CompilerSnapshot;
  archiveDir: string;
  safeLabel: string;
  forced: boolean;
  forceReason: string | undefined;
}): void {
  const { comparisonBaseline, artifact } = input;
  const scope = comparisonBaseline.scope;
  if (
    scope?.profile !== "canonical" || !Array.isArray(scope.budgets) ||
    scope.budgets.length === 0 || !Number.isSafeInteger(scope.seeds) ||
    JSON.stringify(artifact.base.budgets) !== JSON.stringify(scope.budgets) ||
    artifact.base.seeds !== scope.seeds
  ) {
    throw new Error(`comparison does not match the active campaign's fixed scope`);
  }
  const verified = loadVerifiedArchive(input.candidatePath);
  const archive = verified.archive;
  if (
    archive.mode !== "development" || archive.profile !== "canonical" ||
    JSON.stringify(archive.identity?.budgets) !== JSON.stringify(scope.budgets) ||
    archive.identity?.seedSchedule?.seedsPerBudget !== scope.seeds ||
    archive.git?.candidateFingerprint !== artifact.candidate.snapshot.candidateFingerprint ||
    Math.abs(archive.canonicalHeadline - artifact.decision.result.candidateHeadline) > 0.0001
  ) {
    throw new Error(`candidate archive does not match the promotable campaign evidence`);
  }
  const retainedDevelopment = retainExistingRun(
    input.candidatePath,
    artifact.candidate.archiveSha256,
    artifact.candidate.compressedArchiveSha256,
    input.archiveDir,
    `${input.safeLabel}-development-${scope.budgets.map((budget: number) => `${budget / 1000}k`).join("-")}`,
  );
  const retainedComparison = resolve(input.archiveDir, `${input.safeLabel}-comparison.json`);
  copyFileDurable(input.artifactPath, retainedComparison);
  writeFileAtomicDurable(
    `${retainedComparison}.sha256`,
    `${createHash("sha256").update(readFileSync(retainedComparison)).digest("hex")}  ${relativeToCwd(retainedComparison)}\n`,
  );

  const schedule = archive.identity.seedSchedule;
  const developmentBudgets = archive.developmentSummaries.map((summary: any) => ({
    budget: summary.budget,
    score: summary.score,
    valid_runs: summary.validRuns,
    total_runs: summary.totalRuns,
  }));
  const campaign = {
    ...comparisonBaseline,
    schema: CAMPAIGN_BASELINE_REFERENCE_SCHEMA,
    status: "active-campaign-baseline",
    label: input.safeLabel,
    generated_at: new Date().toISOString(),
    candidate_fingerprint: archive.git.candidateFingerprint,
    suite_fingerprint: archive.identity.suiteFingerprint,
    engine_artifact_fingerprint: archive.git.engineArtifactFingerprint,
    compiler_snapshot: input.retainedSnapshot,
    decision_inference_fingerprint: artifact.decision.decisionInferenceFingerprint,
    decision_protocol_fingerprint: artifact.decision.decisionProtocolFingerprint,
    development: {
      execution_policy_fingerprint: archive.identity.executionPolicyFingerprint,
      implementation_fingerprint: archive.identity.implementationFingerprint,
      archive_sha256: artifact.candidate.archiveSha256,
      compressed_archive: relativeToCwd(retainedDevelopment),
      compressed_archive_sha256: artifact.candidate.compressedArchiveSha256,
      canonical_headline: archive.canonicalHeadline,
      seed_schedule: schedule,
      budgets: developmentBudgets,
    },
    canonical_cache: {
      schema: BASELINE_CACHE_SCHEMA,
      baselineLabel: input.safeLabel,
      candidateFingerprint: archive.git.candidateFingerprint,
      suiteFingerprint: archive.identity.suiteFingerprint,
      ladder: {
        schema: BASELINE_CACHE_LADDER_SCHEMA,
        profile: "canonical",
        seedBase: schedule.seedBase,
        maximumSeedsPerBudget: scope.seeds,
        byBudget: schedule.byBudget,
      },
      shards: [{
        schema: BASELINE_CACHE_SHARD_SCHEMA,
        firstSeedSlot: 0,
        endSeedSlotExclusive: scope.seeds,
        archiveSha256: artifact.candidate.archiveSha256,
        compressedArchive: relativeToCwd(retainedDevelopment),
        compressedArchiveSha256: artifact.candidate.compressedArchiveSha256,
        executionPolicyFingerprint: archive.identity.executionPolicyFingerprint,
        implementationFingerprint: archive.identity.implementationFingerprint,
      }],
    },
    promoted_comparison: {
      artifact: relativeToCwd(retainedComparison),
      artifact_sha256: createHash("sha256").update(readFileSync(retainedComparison)).digest("hex"),
      seeds: artifact.base.seeds,
      budgets: artifact.base.budgets,
      outcome: artifact.decision.result.outcome,
      delta: artifact.decision.result.delta,
      ...(input.forced
        ? { forced: true, force_reason: input.forceReason?.trim() }
        : {}),
    },
    monitoring: {
      qualification: "deferred with the frozen 250k/500k ladder; this campaign promotion changes only 750k development evidence",
    },
  };
  writeFileAtomicDurable(
    resolve(artifact.base.baselinePath),
    `${JSON.stringify(campaign, null, 2)}\n`,
  );
}

function runnerBaseArgs(jobs: number): string[] {
  return [
    `--manifest=${resolve("benchmark/v2/compat/source-manifest.json")}`,
    `--heldout-manifest=${resolve("benchmark/v2/compat/heldout-manifest.json")}`,
    `--suite=${resolve("benchmark/v2/compat/suite-manifest.json")}`,
    `--characterization=${resolve("benchmark/v2/evidence/characterization.json")}`,
    `--audit=${resolve("benchmark/v2/evidence/audit.json")}`,
    `--review=${resolve("benchmark/v2/evidence/candidate-review.json")}`,
    `--listening-review=${resolve("benchmark/v2/evidence/listening-review.json")}`,
    `--jobs=${jobs}`,
  ];
}

function assertSuccessful(run: SnapshotBenchmarkRun, label: string): void {
  if (run.workerFailures > 0) throw new Error(`${label} has worker failures; rerun rebaseline with --resume`);
}

function retainRun(run: SnapshotBenchmarkRun, archiveDir: string, stem: string): string {
  return retainExistingRun(
    run.outputPath,
    run.archiveSha256,
    run.compressedArchiveSha256,
    archiveDir,
    stem,
  );
}

function retainExistingRun(
  rawPath: string,
  archiveSha256: string,
  compressedSha256: string,
  archiveDir: string,
  stem: string,
): string {
  const retained = resolve(archiveDir, `${stem}.json.gz`);
  copyFileDurable(`${rawPath}.gz`, retained);
  writeFileAtomicDurable(`${retained}.sha256`, `${compressedSha256}  ${relativeToCwd(retained)}\n`);
  const index = `${rawPath}.decision-index.json`;
  if (existsSync(index)) {
    copyFileDurable(index, resolve(archiveDir, `${stem}.decision-index.json`));
    copyFileDurable(`${index}.sha256`, resolve(archiveDir, `${stem}.decision-index.json.sha256`));
  }
  // The raw checksum is recorded in the bundle entry below.
  writeFileAtomicDurable(`${retained}.archive.sha256`, `${archiveSha256}  ${relativeToCwd(rawPath)}\n`);
  return retained;
}

async function retainedEntry(compressedPath: string): Promise<{
  retainedCompressedArchive: string;
  compressedSha256: string;
  sha256: string;
}> {
  return {
    retainedCompressedArchive: relativeToCwd(compressedPath),
    compressedSha256: await sha256Stream(createReadStream(compressedPath)),
    sha256: await sha256Stream(createReadStream(compressedPath).pipe(createGunzip())),
  };
}

export function assertBaselineBundleLabel(bundlePath: string, expectedLabel: string): void {
  const bundle = JSON.parse(readFileSync(resolve(bundlePath), "utf8"));
  if (bundle.schema !== "line.benchmark-v2.baseline-bundle.v3") {
    throw new Error(`unsupported baseline bundle`);
  }
  if (typeof bundle.label !== "string" || bundle.label.trim() === "") {
    throw new Error(`baseline bundle label must be a non-empty string`);
  }
  if (bundle.label !== expectedLabel) {
    throw new Error(
      `rebaseline label ${JSON.stringify(expectedLabel)} does not match bundle label ${JSON.stringify(bundle.label)}`,
    );
  }
}

async function sha256Stream(stream: AsyncIterable<Buffer | string>): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

function relativeToCwd(path: string): string {
  const prefix = `${process.cwd()}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}
