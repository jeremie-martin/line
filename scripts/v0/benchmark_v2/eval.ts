/**
 * Lean Benchmark V2 evaluation.
 *
 *   eval [--seeds=48]
 *     Candidate-only canonical improvement run at the predeclared
 *     N=8/16/32/48 looks. Each strict wave is decided before later seed slots
 *     enter the queue. Explicit simplification and non-campaign baselines keep
 *     their fixed-N behavior.
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
import { acquireRunLock } from "./runner.ts";
import { benchmarkSequentialEvalPolicy } from "../../../benchmark/v2/eval-policy.ts";
import {
  requireSequentialEvalCalibration,
  sequentialEvalCalibrationFingerprint,
  sequentialEvalInferenceFingerprint,
  sequentialEvalPolicyFingerprint,
  sequentialLookDecision,
  type SequentialLookDecision,
} from "./sequential_inference.ts";

const SOURCE_MANIFEST = "benchmark/v2/compat/source-manifest.json";
const HELDOUT_MANIFEST = "benchmark/v2/compat/heldout-manifest.json";
const SUITE_MANIFEST = "benchmark/v2/compat/suite-manifest.json";
const COMPARISON_REQUEST_SCHEMA = "line.benchmark-v2.comparison-request.v4" as const;
const CACHED_COMPARISON_SCHEMA = "line.benchmark-v2.cached-comparison.v3" as const;
const SEQUENTIAL_LOOK_ARTIFACT_SCHEMA = "line.benchmark-v2.sequential-look-artifact.v1" as const;

type ComparisonMode = "improvement" | "simplification";

export type ComparisonRequest = {
  schema: typeof COMPARISON_REQUEST_SCHEMA;
  generatedAt: string;
  artifactPath: string;
  baselinePath: string;
  baselineLabel: string;
  baselineCacheFingerprint: string;
  baselineIdentityFingerprint: string;
  baselineInitialShards: BaselineCacheView["cache"]["shards"];
  candidateFingerprint: string;
  candidateSnapshot: CompilerSnapshot;
  experiment: "sequential-improvement" | "fixed";
  seeds: number;
  looks: number[];
  budgets: number[];
  mode: ComparisonMode;
  margin: number | null;
  canonicalSeedBase: number;
  seedScheduleFingerprint: string;
  canonicalSeedSchedule: ReturnType<typeof seedScheduleAtDepth>;
  sequentialPolicyFingerprint: string | null;
  sequentialInferenceFingerprint: string | null;
  sequentialCalibrationFingerprint: string | null;
};

export type CachedComparisonArtifact = {
  schema: typeof CACHED_COMPARISON_SCHEMA;
  generatedAt: string;
  status: "complete";
  /** The governed outcome. `decision.result` remains the ordinary fixed-look
   * diagnostic and is never relabelled as a sequential verdict. */
  outcome: "accept" | "reject" | "inconclusive" | "unresolved";
  promotable: boolean;
  base: {
    label: string;
    baselinePath: string;
    cacheFingerprint: string;
    seeds: number;
    maximumSeeds: number;
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
  sequential: {
    policyFingerprint: string;
    inferenceFingerprint: string;
    calibrationFingerprint: string;
    maximumSeeds: number;
    stoppingDepth: number;
    stoppingAction: Exclude<SequentialLookDecision["action"], "continue">;
    looks: SequentialLookDecision[];
    candidateCompiles: number;
  } | null;
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
  const seedsRaw = argument("seeds") ?? String(cache.campaignScope?.maximumSeeds ?? 2);
  if (!/^\d+$/.test(seedsRaw)) throw new Error(`eval --seeds requires an integer N`);
  const seeds = Number(seedsRaw);
  assertCampaignDepth(cache, seeds);
  const jobs = parseJobs(argument("jobs"));
  const mode = parseMode(argument("mode"));
  const margin = parseMargin(mode, argument("margin"));
  assertBaselineEngineComparable(cache.baselinePath);
  const sequential = cache.campaignScope !== undefined && mode === "improvement";
  const calibration = sequential
    ? requireSequentialEvalCalibration(cache.cache.suiteFingerprint)
    : null;
  if (sequential && (
    cache.campaignScope!.sequentialPolicyFingerprint !== sequentialEvalPolicyFingerprint() ||
    cache.campaignScope!.sequentialInferenceFingerprint !== sequentialEvalInferenceFingerprint() ||
    cache.campaignScope!.sequentialCalibrationFingerprint !== sequentialEvalCalibrationFingerprint()
  )) throw new Error(`active campaign sequential policy provenance is stale; migrate or rebaseline before paid eval`);
  const plan = baselineCachePlan(cache, seeds);
  const initialRequiredDepth = sequential ? benchmarkSequentialEvalPolicy.looks[0] : seeds;
  if (cacheCoverage(cache.cache) < initialRequiredDepth) {
    throw new Error(
      `baseline cache covers ${cacheCoverage(cache.cache)}/${initialRequiredDepth} required initial seeds; run ` +
      `\`npm run benchmark -- baseline-cache extend --seeds=${initialRequiredDepth} --jobs=${jobs}\` first`,
    );
  }
  verifyBaselineCache(cache, sequential ? cacheCoverage(cache.cache) : seeds);

  const stamp = timestamp();
  const outPath = resolve(argument("out") ?? `generated/benchmark-v2/eval/cached-N${seeds}-${stamp}.json`);
  const explicitArtifactPath = argument("artifact") === undefined ? undefined : resolve(argument("artifact")!);
  const defaultArtifactPath = resolve(`${outPath}.comparison.json`);
  const requestPath = resolve(`${outPath}.request.json`);
  mkdirSync(dirname(outPath), { recursive: true });

  // Every wave uses a distinct archive path but the complete attempt shares
  // one request and checkpoint. Hold this parent lock across request loading,
  // all strict looks, and publication so overlapping resumes cannot race.
  const releaseAttemptLock = acquireRunLock(`${outPath}.attempt`);
  let workspace: ReturnType<typeof createSnapshotWorkspace> | undefined;
  try {
    const request = argv.includes("--resume")
      ? readComparisonRequest(requestPath, cache, seeds, mode, margin, explicitArtifactPath)
      : createComparisonRequest(
        requestPath,
        outPath,
        explicitArtifactPath ?? defaultArtifactPath,
        cache,
        seeds,
        mode,
        margin,
      );
    const artifactPath = resolve(request.artifactPath);
    const requestSha256 = sha256(readFileSync(requestPath));
    workspace = createSnapshotWorkspace(request.candidateSnapshot);
    const looks = sequential ? [...benchmarkSequentialEvalPolicy.looks] : [seeds];
    const completedLooks: SequentialLookDecision[] = [];
    let run: SnapshotBenchmarkRun | undefined;
    let decided: Awaited<ReturnType<typeof evalDecisionAgainstBaselineCache>> | undefined;
    for (const [lookIndex, look] of looks.entries()) {
      const cacheBeforeLook = readBaselineCache(argument("baseline"));
      assertCacheCompatibleWithRequest(cacheBeforeLook, request);
      if (cacheCoverage(cacheBeforeLook.cache) < look) {
        const pause = {
          schema: "line.benchmark-v2.eval-pause.v1",
          status: "awaiting-baseline-tail",
          completedLooks,
          requiredDepth: look,
          baselineCoverage: cacheCoverage(cacheBeforeLook.cache),
          nextCommands: [
            `npm run benchmark -- baseline-cache extend --seeds=${look} --jobs=${jobs}${baselineArgument(argument("baseline"))}`,
            evalResumeCommand({
              seeds,
              jobs,
              outPath,
              artifactPath,
              baselinePath: argument("baseline"),
            }),
          ],
        };
        writeArtifact(suffixedJsonPath(outPath, ".paused"), pause);
        if (argv.includes("--json")) console.log(JSON.stringify(pause, null, 2));
        else {
          console.log(`Sequential eval paused after N=${completedLooks.at(-1)?.depth ?? 0}: baseline tail through N=${look} is required.`);
          for (const command of pause.nextCommands) console.log(`  ${command}`);
        }
        return 0;
      }
      const waveOutputPath = sequential ? suffixedJsonPath(outPath, `.N${look}`) : outPath;
      run = runInWorkspace(workspace, "development", [
        "--profile=canonical",
        ...runnerBaseArgs(jobs),
        `--comparison-request=${requestPath}`,
        `--canonical-seed-base=${request.canonicalSeedBase}`,
        `--seeds-per-budget=${seeds}`,
        `--comparison-budgets=${request.budgets.join(",")}`,
        `--seed-schedule=${requestPath}`,
        ...(sequential ? [`--checkpoint=${outPath}.checkpoint.jsonl`] : []),
        `--through-seed-slot=${look}`,
        ...(sequential ? ["--finalize-prefix"] : []),
        ...(argv.includes("--resume") || lookIndex > 0 ? ["--resume"] : []),
      ], waveOutputPath);
      if (run.workerFailures > 0) break;
      const cacheAtLook = readBaselineCache(argument("baseline"));
      assertCacheCompatibleWithRequest(cacheAtLook, request);
      const prefixSchedule = seedScheduleAtDepth(cacheAtLook.cache, look);
      decided = await evalDecisionAgainstBaselineCache(cacheAtLook, waveOutputPath, {
        mode,
        margin,
        depth: look,
        request: {
          path: requestPath,
          sha256: requestSha256,
          seedScheduleFingerprint: sha256String(JSON.stringify(prefixSchedule)),
          candidateFingerprint: request.candidateFingerprint,
        },
      });
      if (!sequential) break;
      const lookDecision = sequentialLookDecision(
        decided.artifact.result.confidence,
        look,
        calibration!.boundaryConstant,
      );
      completedLooks.push(lookDecision);
      writeArtifact(suffixedJsonPath(outPath, `.look-${look}`), {
        schema: SEQUENTIAL_LOOK_ARTIFACT_SCHEMA,
        generatedAt: new Date().toISOString(),
        request: { path: relativeToCwd(requestPath), sha256: requestSha256 },
        candidateArchive: relativeToCwd(run.outputPath),
        candidateArchiveSha256: run.archiveSha256,
        candidateCompressedArchiveSha256: run.compressedArchiveSha256,
        decision: lookDecision,
        fixedLookDiagnostics: decided.artifact.result,
      });
      if (lookDecision.action !== "continue") break;
    }
    if (run === undefined || decided === undefined || run.workerFailures > 0) {
      const payload = evalWorkerFailurePayload({
        stage: "cached",
        reason: "one or more compiler workers failed; resume the same candidate output",
        workerFailures: run?.workerFailures ?? 1,
        evidencePaths: [relativeToCwd(`${outPath}.checkpoint.jsonl`)],
        nextCommand: evalResumeCommand({
          seeds,
          jobs,
          outPath,
          artifactPath,
          baselinePath: argument("baseline"),
        }),
      });
      if (argv.includes("--json")) console.log(JSON.stringify(payload, null, 2));
      else console.error(payload.reason);
      return 1;
    }
    const cacheAfter = readBaselineCache(argument("baseline"));
    assertCacheCompatibleWithRequest(cacheAfter, request);
    const stoppingDepth = sequential ? completedLooks.at(-1)!.depth : seeds;
    const sequentialOutcome = sequential ? completedLooks.at(-1)!.action : null;
    if (sequentialOutcome === "continue") throw new Error(`sequential experiment ended before a terminal decision`);
    const governedOutcome = sequential
      ? sequentialOutcome!
      : decided.artifact.result.outcome as "accept" | "reject" | "inconclusive" | "unresolved";
    const nextCommand = comparisonNextCommand(
      governedOutcome,
      artifactPath,
      stoppingDepth,
      cacheCoverage(cacheAfter.cache),
      argument("baseline"),
      sequential ? seeds : undefined,
    );
    const artifact: CachedComparisonArtifact = {
      schema: CACHED_COMPARISON_SCHEMA,
      generatedAt: new Date().toISOString(),
      status: "complete",
      outcome: governedOutcome,
      promotable: governedOutcome === "accept",
      base: {
        label: cacheAfter.cache.baselineLabel,
        baselinePath: relativeToCwd(cacheAfter.baselinePath),
        cacheFingerprint: baselineCacheManifestFingerprint(cacheAfter.cache),
        seeds: stoppingDepth,
        maximumSeeds: seeds,
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
      sequential: sequential ? {
        policyFingerprint: request.sequentialPolicyFingerprint!,
        inferenceFingerprint: request.sequentialInferenceFingerprint!,
        calibrationFingerprint: request.sequentialCalibrationFingerprint!,
        maximumSeeds: seeds,
        stoppingDepth,
        stoppingAction: completedLooks.at(-1)!.action as Exclude<SequentialLookDecision["action"], "continue">,
        looks: completedLooks,
        candidateCompiles: stoppingDepth * plan.developmentSources * plan.budgets.length,
      } : null,
      nextCommand,
    };
    writeArtifact(artifactPath, artifact);
    if (argv.includes("--json")) {
      console.log(JSON.stringify(artifact, null, 2));
    } else {
      console.log(renderCachedComparison({
        result: {
          ...decided.artifact.result,
          outcome: governedOutcome,
          promotable: governedOutcome === "accept",
        },
        baseLabel: cacheAfter.cache.baselineLabel,
        seeds: stoppingDepth,
        archivePath: relativeToCwd(run.outputPath),
        artifactPath: relativeToCwd(artifactPath),
        snapshotPath: request.candidateSnapshot.archive,
        hint: decided.artifact.hint,
        nextCommand,
        runnerFingerprintsMatch: decided.artifact.implementationFingerprintsMatch,
        ...(sequential ? { sequentialLooks: completedLooks } : {}),
      }));
    }
    return 0;
  } finally {
    try {
      if (workspace !== undefined) disposeSnapshotWorkspace(workspace);
    } finally {
      releaseAttemptLock();
    }
  }
}

function createComparisonRequest(
  requestPath: string,
  outPath: string,
  artifactPath: string,
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
    artifactPath: relativeToCwd(artifactPath),
    baselinePath: relativeToCwd(cache.baselinePath),
    baselineLabel: cache.cache.baselineLabel,
    baselineCacheFingerprint: baselineCacheManifestFingerprint(cache.cache),
    baselineIdentityFingerprint: baselineIdentityFingerprint(cache),
    baselineInitialShards: structuredClone(cache.cache.shards),
    candidateFingerprint: snapshot.candidateFingerprint,
    candidateSnapshot: snapshot,
    experiment: cache.campaignScope !== undefined && mode === "improvement"
      ? "sequential-improvement"
      : "fixed",
    seeds,
    looks: cache.campaignScope !== undefined && mode === "improvement"
      ? [...benchmarkSequentialEvalPolicy.looks]
      : [seeds],
    budgets: schedule.byBudget.map((entry) => entry.budget),
    mode,
    margin,
    canonicalSeedBase: schedule.seedBase,
    seedScheduleFingerprint: sha256String(JSON.stringify(schedule)),
    canonicalSeedSchedule: schedule,
    sequentialPolicyFingerprint: cache.campaignScope !== undefined && mode === "improvement"
      ? sequentialEvalPolicyFingerprint()
      : null,
    sequentialInferenceFingerprint: cache.campaignScope !== undefined && mode === "improvement"
      ? sequentialEvalInferenceFingerprint()
      : null,
    sequentialCalibrationFingerprint: cache.campaignScope !== undefined && mode === "improvement"
      ? sequentialEvalCalibrationFingerprint()
      : null,
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
  explicitArtifactPath: string | undefined,
): ComparisonRequest {
  if (!existsSync(requestPath)) {
    throw new Error(`--resume requires the original request at ${relativeToCwd(requestPath)}`);
  }
  const request = JSON.parse(readFileSync(requestPath, "utf8")) as ComparisonRequest;
  if (
    request.schema !== COMPARISON_REQUEST_SCHEMA ||
    typeof request.artifactPath !== "string" || request.artifactPath === "" ||
    (explicitArtifactPath !== undefined && resolve(request.artifactPath) !== explicitArtifactPath) ||
    request.seeds !== seeds ||
    request.mode !== mode ||
    request.margin !== margin ||
    JSON.stringify(request.budgets) !== JSON.stringify(cache.cache.ladder.byBudget.map((entry) => entry.budget)) ||
    request.baselineLabel !== cache.cache.baselineLabel ||
    request.baselineIdentityFingerprint !== baselineIdentityFingerprint(cache) ||
    request.candidateSnapshot?.candidateFingerprint !== request.candidateFingerprint ||
    request.seedScheduleFingerprint !== sha256String(JSON.stringify(request.canonicalSeedSchedule)) ||
    request.experiment !== (cache.campaignScope !== undefined && mode === "improvement" ? "sequential-improvement" : "fixed") ||
    JSON.stringify(request.looks) !== JSON.stringify(
      cache.campaignScope !== undefined && mode === "improvement" ? benchmarkSequentialEvalPolicy.looks : [seeds]
    ) ||
    (request.experiment === "sequential-improvement" && (
      request.sequentialPolicyFingerprint !== sequentialEvalPolicyFingerprint() ||
      request.sequentialInferenceFingerprint !== sequentialEvalInferenceFingerprint() ||
      request.sequentialCalibrationFingerprint !== sequentialEvalCalibrationFingerprint()
    ))
  ) {
    throw new Error(`the saved comparison request does not match this resume command or current baseline cache`);
  }
  assertCacheCompatibleWithRequest(cache, request);
  return request;
}

export function evalResumeCommand(input: {
  seeds: number;
  jobs: number;
  outPath: string;
  artifactPath: string;
  baselinePath?: string;
}): string {
  return `npm run benchmark -- eval --seeds=${input.seeds} --jobs=${input.jobs} --resume ` +
    `--out=${relativeToCwd(input.outPath)} --artifact=${relativeToCwd(input.artifactPath)}` +
    baselineArgument(input.baselinePath);
}

function baselineIdentityFingerprint(cache: BaselineCacheView): string {
  return sha256String(JSON.stringify({
    label: cache.cache.baselineLabel,
    candidateFingerprint: cache.cache.candidateFingerprint,
    suiteFingerprint: cache.cache.suiteFingerprint,
    ladder: cache.cache.ladder,
  }));
}

/** A frozen baseline may only gain verified tail shards while a candidate is
 * paused. Existing shards, compiler identity, suite, and literal ladder remain
 * immutable, so resume cannot drift onto another comparison ruler. */
function assertCacheCompatibleWithRequest(cache: BaselineCacheView, request: ComparisonRequest): void {
  if (
    baselineIdentityFingerprint(cache) !== request.baselineIdentityFingerprint ||
    request.baselineInitialShards.length > cache.cache.shards.length ||
    JSON.stringify(cache.cache.shards.slice(0, request.baselineInitialShards.length)) !==
      JSON.stringify(request.baselineInitialShards)
  ) throw new Error(`baseline cache changed incompatibly while the candidate was running`);
}

function comparisonNextCommand(
  outcome: string,
  artifactPath: string,
  seeds: number,
  availableSeeds: number,
  baselinePath: string | undefined,
  sequentialMaximumSeeds?: number,
): string {
  if (outcome === "accept") {
    return `npm run benchmark -- rebaseline --from=${relativeToCwd(artifactPath)} --label=accepted-candidate`;
  }
  if ((outcome === "inconclusive" || outcome === "unresolved") && seeds < availableSeeds) {
    const next = Math.min(availableSeeds, Math.max(seeds + 1, seeds * 2));
    return `npm run benchmark -- eval --seeds=${next}${baselineArgument(baselinePath)}`;
  }
  return `npm run benchmark -- eval --seeds=${sequentialMaximumSeeds ?? seeds}${baselineArgument(baselinePath)}`;
}

function assertCampaignDepth(cache: BaselineCacheView, seeds: number): void {
  if (cache.campaignScope !== undefined && seeds !== benchmarkSequentialEvalPolicy.maximumDepth) {
    throw new Error(
      `the active campaign declares a maximum N=${benchmarkSequentialEvalPolicy.maximumDepth}; ` +
      `the frozen full-ladder baseline remains available with ` +
      `--baseline=benchmark/v2/baseline.json`,
    );
  }
}

function writeArtifact(path: string, artifact: unknown): void {
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

function suffixedJsonPath(path: string, suffix: string): string {
  return path.endsWith(".json") ? `${path.slice(0, -5)}${suffix}.json` : `${path}${suffix}.json`;
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
