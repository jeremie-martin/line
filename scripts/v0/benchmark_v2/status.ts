import { readFileSync } from "node:fs";
import { benchmarkSequentialEvalPolicy } from "../../../benchmark/v2/eval-policy.ts";
import { compilerCandidateIdentity, compilerDirtyPathsAgainstHead } from "./compiler_identity.ts";
import {
  baselineCachePlan,
  baselineCacheHeadlineAtDepth,
  baselineCacheManifestFingerprint,
  cacheCoverage,
  readBaselineCache,
  verifyBaselineCache,
} from "./baseline_cache.ts";
import {
  requireSequentialEvalCalibration,
  sequentialEvalCalibrationFingerprint,
  sequentialEvalInferenceFingerprint,
  sequentialEvalPolicyFingerprint,
  sequentialRequiredT,
} from "./sequential_inference.ts";

export type BenchmarkStatus = {
  schema: "line.benchmark-v2.status.v3";
  baseline: {
    label: string;
    headline: number;
    candidateFingerprint: string;
    budgets: number[];
    targetHeadline: number | null;
    promotionSeeds: number | null;
    monitoring: { seeds: number; headline: number; validRuns: number; totalRuns: number } | null;
  };
  cache: {
    requestedSeeds: number;
    coverageSeeds: number;
    maximumSeeds: number;
    ready: boolean;
    missingBaselineCompiles: number;
    candidateCompiles: number;
    maximumCandidateCompiles: number;
    shardRanges: Array<{ firstSeedSlot: number; endSeedSlotExclusive: number }>;
  };
  compiler: {
    candidateFingerprint: string;
    matchesBaseline: boolean;
    committed: boolean;
    dirtyPaths: string[];
  };
  sequential: {
    looks: number[];
    maximumSeeds: number;
    totalAlpha: number;
    boundaryConstant: number;
    requiredT: Array<{ seeds: number; t: number }>;
  } | null;
  comparisonReady: boolean;
  nextCommand: string;
};

export function benchmarkStatus(requestedSeeds?: number, baselinePath?: string): BenchmarkStatus {
  const cache = readBaselineCache(baselinePath);
  const depth = requestedSeeds ?? cache.campaignScope?.looks[0] ?? 100;
  if (cache.campaignScope !== undefined && !cache.campaignScope.looks.includes(depth)) {
    throw new Error(`active campaign depth must be one of ${cache.campaignScope.looks.join(",")}`);
  }
  const plan = baselineCachePlan(cache, depth);
  verifyBaselineCache(cache, plan.coveredSeeds === 0 ? undefined : plan.coveredSeeds);
  const baseline = JSON.parse(readFileSync(cache.baselinePath, "utf8"));
  const calibration = cache.campaignScope === undefined
    ? null
    : requireSequentialEvalCalibration(cache.cache.suiteFingerprint);
  if (cache.campaignScope !== undefined && (
    cache.campaignScope.sequentialPolicyFingerprint !== sequentialEvalPolicyFingerprint() ||
    cache.campaignScope.sequentialInferenceFingerprint !== sequentialEvalInferenceFingerprint() ||
    cache.campaignScope.sequentialCalibrationFingerprint !== sequentialEvalCalibrationFingerprint()
  )) throw new Error(`active campaign sequential policy provenance is stale`);
  const coverage = cacheCoverage(cache.cache);
  const monitoring = cache.campaignScope !== undefined && coverage > cache.campaignScope.promotionSeeds
    ? baselineCacheHeadlineAtDepth(cache, coverage)
    : null;
  if (monitoring !== null && (
    baseline.cache_monitoring?.schema !== "line.benchmark-v2.campaign-cache-monitoring.v1" ||
    baseline.cache_monitoring.authority !== "descriptive-only" ||
    baseline.cache_monitoring.coverage_seeds !== monitoring.seeds ||
    baseline.cache_monitoring.canonical_headline !== monitoring.headline ||
    baseline.cache_monitoring.valid_runs !== monitoring.validRuns ||
    baseline.cache_monitoring.total_runs !== monitoring.totalRuns ||
    baseline.cache_monitoring.cache_manifest_fingerprint !== baselineCacheManifestFingerprint(cache.cache)
  )) throw new Error(`active campaign cache-monitoring provenance is stale`);
  const compiler = compilerCandidateIdentity("wasm");
  const dirtyPaths = compilerDirtyPathsAgainstHead();
  const engineMatches = compiler.engineArtifactFingerprint === baseline.engine_artifact_fingerprint;
  const ready = plan.missingBaselineSeeds === 0;
  return {
    schema: "line.benchmark-v2.status.v3",
    baseline: {
      label: cache.cache.baselineLabel,
      headline: baseline.development.canonical_headline,
      candidateFingerprint: cache.cache.candidateFingerprint,
      budgets: cache.cache.ladder.byBudget.map((entry) => entry.budget),
      targetHeadline: cache.campaignScope?.targetHeadline ?? null,
      promotionSeeds: cache.campaignScope?.promotionSeeds ?? null,
      monitoring,
    },
    cache: {
      requestedSeeds: plan.requestedSeeds,
      coverageSeeds: plan.coveredSeeds,
      maximumSeeds: cache.cache.ladder.maximumSeedsPerBudget,
      ready,
      missingBaselineCompiles: plan.missingBaselineCompiles,
      candidateCompiles: plan.candidateCompiles,
      maximumCandidateCompiles: cache.campaignScope === undefined
        ? plan.candidateCompiles
        : cache.campaignScope.maximumSeeds * plan.developmentSources * plan.budgets.length,
      shardRanges: plan.shardRanges,
    },
    compiler: {
      candidateFingerprint: compiler.candidateFingerprint,
      matchesBaseline: compiler.candidateFingerprint === cache.cache.candidateFingerprint,
      committed: dirtyPaths.length === 0,
      dirtyPaths,
    },
    sequential: cache.campaignScope === undefined ? null : {
      looks: [...cache.campaignScope.looks],
      maximumSeeds: cache.campaignScope.maximumSeeds,
      totalAlpha: benchmarkSequentialEvalPolicy.totalAlpha,
      boundaryConstant: calibration!.boundaryConstant,
      requiredT: cache.campaignScope.looks.map((look) => ({
        seeds: look,
        t: sequentialRequiredT(look, calibration!.boundaryConstant),
      })),
    },
    comparisonReady: engineMatches,
    nextCommand: ready
      ? `npm run benchmark -- eval --seeds=${cache.campaignScope?.maximumSeeds ?? depth}${baselineArgument(baselinePath)}`
      : `npm run benchmark -- baseline-cache extend --seeds=${depth}${baselineArgument(baselinePath)}`,
  };
}

export function renderBenchmarkStatus(status: BenchmarkStatus): string {
  return [
    `Benchmark V2 status`,
    `  baseline: ${status.baseline.label} (${status.baseline.headline.toFixed(2)}; ` +
      `${status.baseline.budgets.map((budget) => `${budget / 1000}k`).join("/")})`,
    ...(status.baseline.targetHeadline === null ? [] : [
      `  campaign target: >${status.baseline.targetHeadline.toFixed(2)}`,
    ]),
    ...(status.baseline.promotionSeeds === null ? [] : [
      `  promotion headline: N=${status.baseline.promotionSeeds}`,
    ]),
    ...(status.baseline.monitoring === null ? [] : [
      `  extended cache monitor: ${status.baseline.monitoring.headline.toFixed(2)} at N=${status.baseline.monitoring.seeds} ` +
        `(descriptive; does not replace the promotion headline)`,
    ]),
    ...(status.sequential === null ? [] : [
      `  sequential improvement: strict looks ${status.sequential.looks.map((look) => `N=${look}`).join("/")}; ` +
        `one-sided total alpha ${(100 * status.sequential.totalAlpha).toFixed(1)}% per direction`,
    ]),
    `  current compiler: ${status.compiler.matchesBaseline ? "matches baseline" : "candidate differs from baseline"}`,
    `  source state: ${status.compiler.committed ? "committed" : `uncommitted: ${status.compiler.dirtyPaths.join(", ")}`}`,
    `  comparison: ${status.comparisonReady ? "ready" : "blocked by engine artifact mismatch"}`,
    `  cached comparison N=${status.cache.requestedSeeds}: ` +
      `${status.cache.coverageSeeds}/${status.cache.requestedSeeds} baseline slots available; ` +
      `${status.cache.candidateCompiles} candidate compiles`,
    ...(status.sequential === null ? [] : [
      `  experiment maximum: N=${status.sequential.maximumSeeds}; ${status.cache.maximumCandidateCompiles} candidate compiles`,
    ]),
    `  cache ranges: ${status.cache.shardRanges.map((range) =>
      `[${range.firstSeedSlot},${range.endSeedSlotExclusive})`).join(", ")}`,
    ...(status.cache.ready ? [] : [
      `  missing baseline work: ${status.cache.missingBaselineCompiles} compiles (explicit extension only)`,
    ]),
    `  nextCommand: ${status.nextCommand}`,
  ].join("\n");
}

export function runStatusCommand(argv: string[]): number {
  const seedArgument = argv.find((arg) => arg.startsWith("--seeds="));
  const baselineArgumentValue = argv.find((arg) => arg.startsWith("--baseline="));
  if (argv.some((arg) =>
    arg.startsWith("--") && arg !== "--json" &&
    !arg.startsWith("--seeds=") && !arg.startsWith("--baseline=")
  )) {
    throw new Error(`status accepts only --seeds=N, --baseline=FILE, and --json`);
  }
  const requestedSeeds = seedArgument === undefined ? undefined : Number(seedArgument.slice("--seeds=".length));
  const baselinePath = baselineArgumentValue?.slice("--baseline=".length);
  const status = benchmarkStatus(requestedSeeds, baselinePath);
  console.log(argv.includes("--json") ? JSON.stringify(status, null, 2) : renderBenchmarkStatus(status));
  return 0;
}

function baselineArgument(path: string | undefined): string {
  return path === undefined ? "" : ` --baseline=${path}`;
}
