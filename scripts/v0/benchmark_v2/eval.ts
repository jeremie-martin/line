/**
 * Lean Benchmark V2 evaluation.
 *
 *   eval [--seeds=N]
 *     Candidate-only canonical run against the first N slots of the active
 *     baseline cache. The temporary campaign baseline fixes both N and its
 *     official budget scope; the frozen full-ladder V2 baseline remains
 *     available explicitly. The command writes reproducible evidence and no
 *     project state.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { basename, dirname, resolve } from "node:path";
import {
  baselineCacheManifestFingerprint,
  baselineCachePlan,
  cacheCoverage,
  readBaselineCache,
  seedScheduleAtDepth,
  verifyBaselineCache,
  type BaselineCacheView,
} from "./baseline_cache.ts";
import {
  createCompilerSnapshot,
  createSnapshotWorkspace,
  disposeSnapshotWorkspace,
  runInWorkspace,
  type CompilerSnapshot,
  type SnapshotBenchmarkRun,
} from "./compiler_snapshot.ts";
import {
  evalDecisionAgainstBaselineCache,
} from "./decide.ts";
import { writeFileAtomicDurable } from "./durable_fs.ts";
import { renderCachedComparison } from "./eval_report.ts";
import { compilerCandidateIdentity } from "./compiler_identity.ts";

const SOURCE_MANIFEST = "benchmark/v2/compat/source-manifest.json";
const HELDOUT_MANIFEST = "benchmark/v2/compat/heldout-manifest.json";
const SUITE_MANIFEST = "benchmark/v2/compat/suite-manifest.json";
const COMPARISON_REQUEST_SCHEMA = "line.benchmark-v2.comparison-request.v2" as const;
const CACHED_COMPARISON_SCHEMA = "line.benchmark-v2.cached-comparison.v2" as const;

type ComparisonMode = "improvement" | "simplification";

export type ComparisonRequest = {
  schema: typeof COMPARISON_REQUEST_SCHEMA;
  generatedAt: string;
  baselinePath: string;
  baselineLabel: string;
  baselineCacheFingerprint: string;
  candidateFingerprint: string;
  candidateSnapshot: CompilerSnapshot;
  seeds: number;
  budgets: number[];
  mode: ComparisonMode;
  margin: number | null;
  canonicalSeedBase: number;
  seedScheduleFingerprint: string;
  canonicalSeedSchedule: ReturnType<typeof seedScheduleAtDepth>;
};

export type CachedComparisonArtifact = {
  schema: typeof CACHED_COMPARISON_SCHEMA;
  generatedAt: string;
  status: "complete";
  base: {
    label: string;
    baselinePath: string;
    cacheFingerprint: string;
    seeds: number;
    budgets: number[];
  };
  candidate: {
    archivePath: string;
    archiveSha256: string;
    compressedArchiveSha256: string;
    snapshot: CompilerSnapshot;
  };
  request: {
    path: string;
    sha256: string;
  };
  decision: Awaited<ReturnType<typeof evalDecisionAgainstBaselineCache>>["artifact"];
  nextCommand: string;
};

export async function runEvalCommand(argv = process.argv.slice(2)): Promise<number> {
  assertEvalArguments(argv);
  return runCachedComparison(argv);
}

/**
 * Keep parsing deliberately small. Expensive evidence commands should reject
 * misspelled flags before preparation or compiler work starts.
 */
export function assertEvalArguments(argv: string[]): void {
  const booleans = new Set(["resume", "json"]);
  const values = new Set(["seeds", "out", "artifact", "baseline", "jobs", "mode", "margin"]);
  const accepted = [...booleans, ...[...values].map((name) => `${name}=VALUE`)].join(", ");

  for (const arg of argv) {
    if (!arg.startsWith("--")) throw new Error(`eval does not accept positional argument ${arg}`);
    const equals = arg.indexOf("=");
    const name = arg.slice(2, equals === -1 ? undefined : equals);
    if (equals === -1 && booleans.has(name)) continue;
    if (equals !== -1 && values.has(name) && arg.slice(equals + 1) !== "") continue;
    if (equals === -1 && values.has(name)) throw new Error(`eval requires --${name}=VALUE`);
    if (equals !== -1 && booleans.has(name)) throw new Error(`eval flag --${name} does not take a value`);
    throw new Error(`eval does not accept ${arg}; accepted flags: ${accepted}`);
  }
}

function argumentIn(argv: string[]) {
  return (name: string): string | undefined =>
    argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function runnerBaseArgs(jobs: number): string[] {
  return [
    `--manifest=${resolve(SOURCE_MANIFEST)}`,
    `--heldout-manifest=${resolve(HELDOUT_MANIFEST)}`,
    `--suite=${resolve(SUITE_MANIFEST)}`,
    `--characterization=${resolve("benchmark/v2/evidence/characterization.json")}`,
    `--audit=${resolve("benchmark/v2/evidence/audit.json")}`,
    `--review=${resolve("benchmark/v2/evidence/candidate-review.json")}`,
    `--listening-review=${resolve("benchmark/v2/evidence/listening-review.json")}`,
    `--jobs=${jobs}`,
  ];
}

async function runCachedComparison(argv: string[]): Promise<number> {
  const argument = argumentIn(argv);
  requireWasm("eval");
  const cache = readBaselineCache(argument("baseline"));
  const seedsRaw = argument("seeds") ?? String(cache.campaignScope?.seeds ?? 2);
  if (!/^\d+$/.test(seedsRaw)) throw new Error(`eval --seeds requires an integer N`);
  const seeds = Number(seedsRaw);
  assertCampaignDepth(cache, seeds);
  const jobs = parseJobs(argument("jobs"));
  const mode = parseMode(argument("mode"));
  const margin = parseMargin(mode, argument("margin"));
  assertBaselineEngineComparable(cache.baselinePath);
  const plan = baselineCachePlan(cache, seeds);
  if (plan.missingBaselineSeeds > 0) {
    throw new Error(
      `baseline cache covers ${plan.coveredSeeds}/${seeds} seeds; run ` +
      `\`npm run benchmark -- baseline-cache extend --seeds=${seeds} --jobs=${jobs}\` first`,
    );
  }
  verifyBaselineCache(cache, seeds);

  const stamp = timestamp();
  const outPath = resolve(argument("out") ?? `generated/benchmark-v2/eval/cached-N${seeds}-${stamp}.json`);
  const artifactPath = resolve(argument("artifact") ?? `${outPath}.comparison.json`);
  const requestPath = resolve(`${outPath}.request.json`);
  mkdirSync(dirname(outPath), { recursive: true });

  const request = argv.includes("--resume")
    ? readComparisonRequest(requestPath, cache, seeds, mode, margin)
    : createComparisonRequest(requestPath, outPath, cache, seeds, mode, margin);
  const requestSha256 = sha256(readFileSync(requestPath));

  let workspace: ReturnType<typeof createSnapshotWorkspace> | undefined;
  try {
    workspace = createSnapshotWorkspace(request.candidateSnapshot);
    const run = runInWorkspace(workspace, "development", [
      "--profile=canonical",
      ...runnerBaseArgs(jobs),
      `--comparison-request=${requestPath}`,
      `--canonical-seed-base=${request.canonicalSeedBase}`,
      `--seeds-per-budget=${seeds}`,
      `--comparison-budgets=${request.budgets.join(",")}`,
      `--seed-schedule=${requestPath}`,
      ...(argv.includes("--resume") ? ["--resume"] : []),
    ], outPath);
    if (run.workerFailures > 0) {
      const payload = evalWorkerFailurePayload({
        stage: "cached",
        reason: "one or more compiler workers failed; resume the same candidate output",
        workerFailures: run.workerFailures,
        evidencePaths: [relativeToCwd(`${outPath}.checkpoint.jsonl`)],
        nextCommand:
          `npm run benchmark -- eval --seeds=${seeds} --resume --out=${relativeToCwd(outPath)}` +
          baselineArgument(argument("baseline")),
      });
      if (argv.includes("--json")) console.log(JSON.stringify(payload, null, 2));
      else console.error(payload.reason);
      return 1;
    }
    const cacheAfter = readBaselineCache(argument("baseline"));
    if (baselineCacheManifestFingerprint(cacheAfter.cache) !== request.baselineCacheFingerprint) {
      throw new Error(`baseline cache changed while the candidate was running; start a new comparison`);
    }
    const decided = await evalDecisionAgainstBaselineCache(cacheAfter, outPath, {
      mode,
      margin,
      depth: seeds,
      request: {
        path: requestPath,
        sha256: requestSha256,
        seedScheduleFingerprint: request.seedScheduleFingerprint,
        candidateFingerprint: request.candidateFingerprint,
      },
    });
    const nextCommand = comparisonNextCommand(
      decided.artifact.result.outcome,
      artifactPath,
      seeds,
      cacheCoverage(cacheAfter.cache),
      argument("baseline"),
    );
    decided.artifact.nextCommand = nextCommand;
    const artifact: CachedComparisonArtifact = {
      schema: CACHED_COMPARISON_SCHEMA,
      generatedAt: new Date().toISOString(),
      status: "complete",
      base: {
        label: cacheAfter.cache.baselineLabel,
        baselinePath: relativeToCwd(cacheAfter.baselinePath),
        cacheFingerprint: request.baselineCacheFingerprint,
        seeds,
        budgets: [...request.budgets],
      },
      candidate: {
        archivePath: relativeToCwd(run.outputPath),
        archiveSha256: run.archiveSha256,
        compressedArchiveSha256: run.compressedArchiveSha256,
        snapshot: request.candidateSnapshot,
      },
      request: {
        path: relativeToCwd(requestPath),
        sha256: requestSha256,
      },
      decision: decided.artifact,
      nextCommand,
    };
    writeArtifact(artifactPath, artifact);
    if (argv.includes("--json")) {
      console.log(JSON.stringify(artifact, null, 2));
    } else {
      console.log(renderCachedComparison({
        result: decided.artifact.result,
        baseLabel: cacheAfter.cache.baselineLabel,
        seeds,
        archivePath: relativeToCwd(run.outputPath),
        artifactPath: relativeToCwd(artifactPath),
        snapshotPath: request.candidateSnapshot.archive,
        hint: decided.artifact.hint,
        nextCommand,
        runnerFingerprintsMatch: decided.artifact.implementationFingerprintsMatch,
      }));
    }
    return 0;
  } finally {
    if (workspace !== undefined) disposeSnapshotWorkspace(workspace);
  }
}

function createComparisonRequest(
  requestPath: string,
  outPath: string,
  cache: BaselineCacheView,
  seeds: number,
  mode: ComparisonMode,
  margin: number | null,
): ComparisonRequest {
  if (existsSync(requestPath)) {
    throw new Error(`${relativeToCwd(requestPath)} already exists; pass --resume or choose a new --out path`);
  }
  const schedule = seedScheduleAtDepth(cache.cache, seeds);
  const label = basename(outPath).replace(/\.json$/, "");
  const snapshot = createCompilerSnapshot(label, dirname(outPath));
  const request: ComparisonRequest = {
    schema: COMPARISON_REQUEST_SCHEMA,
    generatedAt: new Date().toISOString(),
    baselinePath: relativeToCwd(cache.baselinePath),
    baselineLabel: cache.cache.baselineLabel,
    baselineCacheFingerprint: baselineCacheManifestFingerprint(cache.cache),
    candidateFingerprint: snapshot.candidateFingerprint,
    candidateSnapshot: snapshot,
    seeds,
    budgets: schedule.byBudget.map((entry) => entry.budget),
    mode,
    margin,
    canonicalSeedBase: schedule.seedBase,
    seedScheduleFingerprint: sha256String(JSON.stringify(schedule)),
    canonicalSeedSchedule: schedule,
  };
  writeFileAtomicDurable(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  return request;
}

function readComparisonRequest(
  requestPath: string,
  cache: BaselineCacheView,
  seeds: number,
  mode: ComparisonMode,
  margin: number | null,
): ComparisonRequest {
  if (!existsSync(requestPath)) {
    throw new Error(`--resume requires the original request at ${relativeToCwd(requestPath)}`);
  }
  const request = JSON.parse(readFileSync(requestPath, "utf8")) as ComparisonRequest;
  if (
    request.schema !== COMPARISON_REQUEST_SCHEMA ||
    request.seeds !== seeds ||
    request.mode !== mode ||
    request.margin !== margin ||
    JSON.stringify(request.budgets) !== JSON.stringify(cache.cache.ladder.byBudget.map((entry) => entry.budget)) ||
    request.baselineLabel !== cache.cache.baselineLabel ||
    request.baselineCacheFingerprint !== baselineCacheManifestFingerprint(cache.cache) ||
    request.candidateSnapshot?.candidateFingerprint !== request.candidateFingerprint ||
    request.seedScheduleFingerprint !== sha256String(JSON.stringify(request.canonicalSeedSchedule))
  ) {
    throw new Error(`the saved comparison request does not match this resume command or current baseline cache`);
  }
  return request;
}

function comparisonNextCommand(
  outcome: string,
  artifactPath: string,
  seeds: number,
  availableSeeds: number,
  baselinePath: string | undefined,
): string {
  if (outcome === "accept") {
    return `npm run benchmark -- rebaseline --from=${relativeToCwd(artifactPath)} --label=accepted-candidate`;
  }
  if ((outcome === "inconclusive" || outcome === "unresolved") && seeds < availableSeeds) {
    const next = Math.min(availableSeeds, Math.max(seeds + 1, seeds * 2));
    return `npm run benchmark -- eval --seeds=${next}${baselineArgument(baselinePath)}`;
  }
  return `npm run benchmark -- eval --seeds=${seeds}${baselineArgument(baselinePath)}`;
}

function assertCampaignDepth(cache: BaselineCacheView, seeds: number): void {
  if (cache.campaignScope !== undefined && seeds !== cache.campaignScope.seeds) {
    throw new Error(
      `the active campaign uses N=${cache.campaignScope.seeds} only; ` +
      `the frozen full-ladder baseline remains available with ` +
      `--baseline=benchmark/v2/baseline.json`,
    );
  }
}

function writeArtifact(path: string, artifact: CachedComparisonArtifact): void {
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`);
  writeFileAtomicDurable(path, bytes.toString("utf8"));
  writeFileAtomicDurable(`${path}.sha256`, `${sha256(bytes)}  ${relativeToCwd(path)}\n`);
}

export function evalWorkerFailurePayload(input: {
  stage: "cached";
  reason: string;
  workerFailures: number;
  evidencePaths: string[];
  nextCommand: string;
}): Record<string, unknown> {
  return {
    schema: "line.benchmark-v2.eval-failure.v2",
    status: "invalid",
    stage: input.stage,
    reason: input.reason,
    workerFailures: input.workerFailures,
    evidencePaths: input.evidencePaths,
    nextCommand: input.nextCommand,
  };
}

/** Refuse an engine mismatch before paying for candidate compilation. Runner
 * provenance is reported after comparison, not used as a workflow lock. */
export function assertBaselineEngineComparable(baselinePath: string): void {
  const baseline = JSON.parse(readFileSync(resolve(baselinePath), "utf8"));
  const current = compilerCandidateIdentity("wasm");
  if (current.engineArtifactFingerprint !== baseline.engine_artifact_fingerprint) {
    throw new Error(`engine artifact differs from the retained baseline; establish a new baseline intentionally`);
  }
}

export function assertQualificationSucceeded(
  run: Pick<SnapshotBenchmarkRun, "workerFailures">,
): void {
  if (run.workerFailures > 0) {
    throw new Error(`qualification has ${run.workerFailures} worker failure(s); resume it before rebaselining`);
  }
}

function parseJobs(raw: string | undefined): number {
  const jobs = raw === undefined ? Math.min(48, availableParallelism()) : Number(raw);
  if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 48) {
    throw new Error(`--jobs must be an integer in 1..48`);
  }
  return jobs;
}

function parseMode(raw: string | undefined): ComparisonMode {
  const value = raw ?? "improve";
  if (value === "improve" || value === "improvement") return "improvement";
  if (value === "simplify" || value === "simplification") return "simplification";
  throw new Error(`--mode must be improve or simplify`);
}

function parseMargin(mode: ComparisonMode, raw: string | undefined): number | null {
  if (mode === "improvement") {
    if (raw !== undefined) throw new Error(`--margin is only valid with --mode=simplify`);
    return null;
  }
  const margin = Number(raw);
  if (!Number.isFinite(margin) || margin <= 0) {
    throw new Error(`--mode=simplify requires --margin=<positive headline points>`);
  }
  return margin;
}

function requireWasm(command: string): void {
  if (process.env.LR_ENGINE !== "wasm") throw new Error(`${command} requires LR_ENGINE=wasm`);
}

function timestamp(): string {
  return new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256String(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function relativeToCwd(path: string): string {
  const prefix = `${process.cwd()}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function baselineArgument(path: string | undefined): string {
  return path === undefined ? "" : ` --baseline=${path}`;
}
