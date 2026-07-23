import { readFileSync } from "node:fs";
import { compilerCandidateIdentity, compilerDirtyPathsAgainstHead } from "./compiler_identity.ts";
import {
  baselineCachePlan,
  readBaselineCache,
  verifyBaselineCache,
} from "./baseline_cache.ts";

export type BenchmarkStatus = {
  schema: "line.benchmark-v2.status.v2";
  baseline: {
    label: string;
    headline: number;
    candidateFingerprint: string;
  };
  cache: {
    requestedSeeds: number;
    coverageSeeds: number;
    maximumSeeds: number;
    ready: boolean;
    missingBaselineCompiles: number;
    candidateCompiles: number;
    shardRanges: Array<{ firstSeedSlot: number; endSeedSlotExclusive: number }>;
  };
  compiler: {
    candidateFingerprint: string;
    matchesBaseline: boolean;
    committed: boolean;
    dirtyPaths: string[];
  };
  comparisonReady: boolean;
  nextCommand: string;
};

export function benchmarkStatus(requestedSeeds = 100): BenchmarkStatus {
  const cache = readBaselineCache();
  const plan = baselineCachePlan(cache, requestedSeeds);
  verifyBaselineCache(cache, plan.coveredSeeds === 0 ? undefined : plan.coveredSeeds);
  const baseline = JSON.parse(readFileSync(cache.baselinePath, "utf8"));
  const compiler = compilerCandidateIdentity("wasm");
  const dirtyPaths = compilerDirtyPathsAgainstHead();
  const engineMatches = compiler.engineArtifactFingerprint === baseline.engine_artifact_fingerprint;
  const ready = plan.missingBaselineSeeds === 0;
  return {
    schema: "line.benchmark-v2.status.v2",
    baseline: {
      label: cache.cache.baselineLabel,
      headline: baseline.development.canonical_headline,
      candidateFingerprint: cache.cache.candidateFingerprint,
    },
    cache: {
      requestedSeeds: plan.requestedSeeds,
      coverageSeeds: plan.coveredSeeds,
      maximumSeeds: cache.cache.ladder.maximumSeedsPerBudget,
      ready,
      missingBaselineCompiles: plan.missingBaselineCompiles,
      candidateCompiles: plan.candidateCompiles,
      shardRanges: plan.shardRanges,
    },
    compiler: {
      candidateFingerprint: compiler.candidateFingerprint,
      matchesBaseline: compiler.candidateFingerprint === cache.cache.candidateFingerprint,
      committed: dirtyPaths.length === 0,
      dirtyPaths,
    },
    comparisonReady: engineMatches,
    nextCommand: ready
      ? `npm run benchmark -- eval --seeds=${requestedSeeds}`
      : `npm run benchmark -- baseline-cache extend --seeds=${requestedSeeds}`,
  };
}

export function renderBenchmarkStatus(status: BenchmarkStatus): string {
  return [
    `Benchmark V2 status`,
    `  baseline: ${status.baseline.label} (${status.baseline.headline.toFixed(2)})`,
    `  current compiler: ${status.compiler.matchesBaseline ? "matches baseline" : "candidate differs from baseline"}`,
    `  source state: ${status.compiler.committed ? "committed" : `uncommitted: ${status.compiler.dirtyPaths.join(", ")}`}`,
    `  comparison: ${status.comparisonReady ? "ready" : "blocked by engine artifact mismatch"}`,
    `  cached comparison N=${status.cache.requestedSeeds}: ` +
      `${status.cache.coverageSeeds}/${status.cache.requestedSeeds} baseline slots available; ` +
      `${status.cache.candidateCompiles} candidate compiles`,
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
  if (argv.some((arg) => arg.startsWith("--") && arg !== "--json" && !arg.startsWith("--seeds="))) {
    throw new Error(`status accepts only --seeds=N and --json`);
  }
  const requestedSeeds = seedArgument === undefined ? 100 : Number(seedArgument.slice("--seeds=".length));
  const status = benchmarkStatus(requestedSeeds);
  console.log(argv.includes("--json") ? JSON.stringify(status, null, 2) : renderBenchmarkStatus(status));
  return 0;
}
