/**
 * Immutable, prefix-addressable canonical baseline evidence.
 *
 * The old confirmation path allocated a new epoch and compiled both arms for
 * every candidate.  This module is intentionally narrower: it owns only the
 * baseline arm.  A cache is a contiguous set of content-addressed shards over
 * one stable seed ladder.  Candidate evidence is never cached here.
 */

import { createHash } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync, readSync, unlinkSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { benchmarkSequentialEvalPolicy } from "../../../benchmark/v2/eval-policy.ts";
import {
  createSnapshotWorkspace,
  disposeSnapshotWorkspace,
  runInWorkspace,
  validateCompilerSnapshot,
} from "./compiler_snapshot.ts";
import { copyFileDurable, writeFileAtomicDurable } from "./durable_fs.ts";
import { v2HeadlineForDecisionRuns, type DecisionRun } from "./decision_model.ts";
import { loadSourceManifest, resolveSources } from "./model.ts";
import { DECISION_INDEX_SCHEMA, RUN_ARCHIVE_SCHEMA } from "./runner.ts";
import { canonicalMembers, loadSuiteManifest, suiteIdentity, type ResolvedSeedSchedule } from "./suite_model.ts";

export const BASELINE_CACHE_SCHEMA = "line.benchmark-v2.canonical-baseline-cache.v1" as const;
export const BASELINE_CACHE_SHARD_SCHEMA = "line.benchmark-v2.canonical-baseline-cache-shard.v1" as const;
export const BASELINE_CACHE_LADDER_SCHEMA = "line.benchmark-v2.canonical-seed-ladder.v1" as const;
export const BASELINE_REFERENCE_CACHE_SCHEMA = "line.benchmark-v2.baseline-reference.v10" as const;
export const CAMPAIGN_BASELINE_REFERENCE_SCHEMA = "line.benchmark-v2.campaign-baseline.v2" as const;
export const CACHE_BUDGET_PROJECTION_SCHEMA = "line.benchmark-v2.cache-budget-projection.v1" as const;
export const DEFAULT_CAMPAIGN_BASELINE_PATH = "benchmark/v2/campaign-baseline.json";
export const MAX_FIXED_N = 300;
/** One block is useful for deterministic diagnostics; promotion-strength
 * uncertainty evidence is a scientific choice, not a command restriction. */
export const MIN_FIXED_N = 1;

const SOURCE_MANIFEST = "benchmark/v2/compat/source-manifest.json";
const HELDOUT_MANIFEST = "benchmark/v2/compat/heldout-manifest.json";
const SUITE_MANIFEST = "benchmark/v2/compat/suite-manifest.json";
const CACHE_LOCK = "benchmark/v2/baseline-cache-extension.lock";
const INDEXED_COMPRESSED_ARCHIVE_THRESHOLD_BYTES = 512 * 1024 * 1024;

export type CanonicalSeedLadder = {
  schema: typeof BASELINE_CACHE_LADDER_SCHEMA;
  profile: "canonical";
  seedBase: number;
  maximumSeedsPerBudget: number;
  byBudget: Array<{ budget: number; actualSeeds: number[] }>;
};

export type BaselineCacheShard = {
  schema: typeof BASELINE_CACHE_SHARD_SCHEMA;
  firstSeedSlot: number;
  endSeedSlotExclusive: number;
  /**
   * Large extension shards retain their raw archive and a compact,
   * raw-archive-bound decision index.  The historical 48-slot anchor has no
   * such field and is deliberately kept on its original compressed archive.
   */
  archive?: string;
  archiveSha256: string;
  compressedArchive: string;
  compressedArchiveSha256: string;
  executionPolicyFingerprint: string;
  implementationFingerprint: string;
  /**
   * A campaign may reuse a checksummed superset archive from the frozen V2
   * baseline. The source cache is verified in full before only the campaign's
   * declared budget rows are projected into a comparison.
   */
  budgetProjection?: {
    schema: typeof CACHE_BUDGET_PROJECTION_SCHEMA;
    sourceBaseline: string;
    sourceCacheFingerprint: string;
  };
};

export type CanonicalBaselineCache = {
  schema: typeof BASELINE_CACHE_SCHEMA;
  baselineLabel: string;
  candidateFingerprint: string;
  suiteFingerprint: string;
  ladder: CanonicalSeedLadder;
  shards: BaselineCacheShard[];
};

export type BaselineCacheView = {
  baselinePath: string;
  cache: CanonicalBaselineCache;
  campaignScope?: {
    budgets: number[];
    maximumSeeds: number;
    promotionSeeds: number;
    looks: number[];
    targetHeadline: number;
    sequentialPolicyFingerprint: string;
    sequentialInferenceFingerprint: string;
    sequentialCalibrationFingerprint: string;
  };
};

type LoadedCacheShard = {
  archive: any;
  /** True when `archive` came from an integrity-bound decision projection. */
  indexed: boolean;
};

export type BaselineCachePlan = {
  requestedSeeds: number;
  coveredSeeds: number;
  missingBaselineSeeds: number;
  candidateSeeds: number;
  developmentSources: number;
  budgets: number[];
  missingBaselineCompiles: number;
  candidateCompiles: number;
  shardRanges: Array<{ firstSeedSlot: number; endSeedSlotExclusive: number }>;
};

export function assertFixedSeedCount(value: number, label = "seeds"): number {
  if (!Number.isSafeInteger(value) || value < MIN_FIXED_N || value > MAX_FIXED_N) {
    throw new Error(`--${label} must be an integer in ${MIN_FIXED_N}..${MAX_FIXED_N}`);
  }
  return value;
}

export function readBaselineCache(baselinePath = DEFAULT_CAMPAIGN_BASELINE_PATH): BaselineCacheView {
  const absolute = resolve(baselinePath);
  const baseline = JSON.parse(readFileSync(absolute, "utf8"));
  const canonical = baseline.schema === BASELINE_REFERENCE_CACHE_SCHEMA &&
    baseline.status === "canonical-baseline";
  const campaign = baseline.schema === CAMPAIGN_BASELINE_REFERENCE_SCHEMA &&
    baseline.status === "active-campaign-baseline";
  if ((!canonical && !campaign) || baseline.canonical_cache === undefined) {
    throw new Error(`unsupported baseline reference; establish a canonical or campaign baseline`);
  }
  const cache = parseCache(baseline.canonical_cache, baseline);
  validateCacheStructure(cache, baseline);
  const campaignScope = campaign ? parseCampaignScope(baseline, cache) : undefined;
  return {
    baselinePath: absolute,
    cache,
    ...(campaignScope === undefined ? {} : { campaignScope }),
  };
}

/** Build the first cache manifest from the accepted canonical development
 * archive.  Freeze/rebaseline calls this once; no duplicate baseline compile
 * is paid merely to initialize cache metadata. */
export function initialCanonicalBaselineCache(input: {
  baselineLabel: string;
  candidateFingerprint: string;
  suiteFingerprint: string;
  development: {
    seed_schedule: any;
    archive_sha256: string;
    compressed_archive: string;
    compressed_archive_sha256: string;
    execution_policy_fingerprint: string;
    implementation_fingerprint: string;
  };
}): CanonicalBaselineCache {
  return canonicalCacheFromDevelopment({
    label: input.baselineLabel,
    candidate_fingerprint: input.candidateFingerprint,
    suite_fingerprint: input.suiteFingerprint,
    development: input.development,
  });
}

export function baselineCachePlan(view: BaselineCacheView, requestedSeeds: number): BaselineCachePlan {
  const depth = assertFixedSeedCount(requestedSeeds);
  if (depth > view.cache.ladder.maximumSeedsPerBudget) {
    throw new Error(`baseline cache ladder ends at ${view.cache.ladder.maximumSeedsPerBudget}; extend its declared ladder before requesting ${depth}`);
  }
  const coverage = cacheCoverage(view.cache);
  const coveredSeeds = Math.min(depth, coverage);
  const sources = canonicalMembers(loadSuiteManifest(
    SUITE_MANIFEST,
    resolveSources(loadSourceManifest(SOURCE_MANIFEST)),
  )).length;
  const budgets = view.cache.ladder.byBudget.map((entry) => entry.budget);
  return {
    requestedSeeds: depth,
    coveredSeeds,
    missingBaselineSeeds: depth - coveredSeeds,
    candidateSeeds: depth,
    developmentSources: sources,
    budgets,
    missingBaselineCompiles: (depth - coveredSeeds) * sources * budgets.length,
    candidateCompiles: depth * sources * budgets.length,
    shardRanges: view.cache.shards.map(({ firstSeedSlot, endSeedSlotExclusive }) => ({ firstSeedSlot, endSeedSlotExclusive })),
  };
}

export function cacheCoverage(cache: CanonicalBaselineCache): number {
  return cache.shards.at(-1)?.endSeedSlotExclusive ?? 0;
}

export function baselineCacheManifestFingerprint(cache: CanonicalBaselineCache): string {
  return createHash("sha256").update(JSON.stringify(cache)).digest("hex");
}

export function seedScheduleAtDepth(cache: CanonicalBaselineCache, depth: number): ResolvedSeedSchedule {
  assertFixedSeedCount(depth);
  if (depth > cache.ladder.maximumSeedsPerBudget) {
    throw new Error(`requested ${depth} seed slots but the cache ladder ends at ${cache.ladder.maximumSeedsPerBudget}`);
  }
  return {
    kind: "profile_budget_disjoint_contiguous",
    profile: "canonical",
    seedBase: cache.ladder.seedBase,
    seedsPerBudget: depth,
    byBudget: cache.ladder.byBudget.map((entry) => ({
      budget: entry.budget,
      actualSeeds: entry.actualSeeds.slice(0, depth),
    })),
  };
}

/** Verify every shard's bytes, metadata, exact seed slots, and full source
 * cross-product before it can serve a candidate comparison. */
export function verifyBaselineCache(view: BaselineCacheView, requestedSeeds?: number): void {
  verifiedBaselineCacheShards(view, requestedSeeds);
}

function verifiedBaselineCacheShards(
  view: BaselineCacheView,
  requestedSeeds?: number,
): Array<{ shard: BaselineCacheShard; archive: any; indexed: boolean }> {
  const depth = requestedSeeds === undefined ? cacheCoverage(view.cache) : assertFixedSeedCount(requestedSeeds);
  if (depth > view.cache.ladder.maximumSeedsPerBudget) {
    throw new Error(`baseline cache has no ladder coverage through seed slot ${depth}`);
  }
  const expected = seedScheduleAtDepth(view.cache, Math.max(depth, cacheCoverage(view.cache)));
  const sources = canonicalMembers(loadSuiteManifest(
    SUITE_MANIFEST,
    resolveSources(loadSourceManifest(SOURCE_MANIFEST)),
  )).sort();
  return view.cache.shards.map((shard) => ({
    shard,
    ...verifyShard(view.cache, shard, expected, sources),
  }));
}

/** Raw shard evidence is exposed only after the same full verification used by
 * cache status/extension.  The decision layer receives no unverified path. */
export function loadBaselineCacheEvidence(
  view: BaselineCacheView,
  requestedSeeds: number,
): Array<{ shard: BaselineCacheShard; archive: any; indexed: boolean }> {
  const depth = assertFixedSeedCount(requestedSeeds);
  if (cacheCoverage(view.cache) < depth) {
    throw new Error(`baseline cache covers ${cacheCoverage(view.cache)} seed slots, not requested ${depth}`);
  }
  return verifiedBaselineCacheShards(view, depth)
    .filter(({ shard }) => shard.firstSeedSlot < depth);
}

/** Recompute a descriptive baseline headline from verified cache shards. This
 * never changes the promotion headline tied to the accepted stopping depth. */
export function baselineCacheHeadlineAtDepth(
  view: BaselineCacheView,
  depth: number,
): { seeds: number; headline: number; validRuns: number; totalRuns: number } {
  const evidence = loadBaselineCacheEvidence(view, depth);
  const budgets = new Set(view.cache.ladder.byBudget.map((entry) => entry.budget));
  const runs: DecisionRun[] = evidence.flatMap(({ archive }) => archive.runs)
    .filter((row: any) => row.task.seedSlot < depth && budgets.has(row.task.budget))
    .map((row: any) => ({
      sourceId: row.task.sourceId,
      budget: row.task.budget,
      seedSlot: row.task.seedSlot,
      actualSeed: row.task.actualSeed,
      score: { score: row.score.score, valid: row.score.valid },
    }));
  const sources = resolveSources(loadSourceManifest(SOURCE_MANIFEST));
  const suite = structuredClone(loadSuiteManifest(SUITE_MANIFEST, sources));
  suite.profiles.canonical.seeds_per_budget = depth;
  suite.profiles.canonical.budgets = [...budgets];
  return {
    seeds: depth,
    headline: v2HeadlineForDecisionRuns(runs, suite, "canonical"),
    validRuns: runs.filter((run) => run.score.valid).length,
    totalRuns: runs.length,
  };
}

/**
 * Explicitly extend only the missing baseline tail.  The caller must perform
 * preparation first; this function does no hidden cache build during eval.
 */
export function extendBaselineCache(input: {
  seeds: number;
  jobs: number;
  resume: boolean;
  baselinePath?: string;
}): BaselineCachePlan {
  const view = readBaselineCache(input.baselinePath);
  const plan = baselineCachePlan(view, input.seeds);
  verifyBaselineCache(view, plan.coveredSeeds === 0 ? undefined : plan.coveredSeeds);
  if (plan.missingBaselineSeeds === 0) return plan;
  acquireCacheLock();
  let workspace: ReturnType<typeof createSnapshotWorkspace> | undefined;
  try {
    // Re-read after the lock; an interrupted extension must never cause a
    // second process to overwrite a manifest or duplicate its range.
    const current = readBaselineCache(input.baselinePath);
    const currentPlan = baselineCachePlan(current, input.seeds);
    if (currentPlan.missingBaselineSeeds === 0) return currentPlan;
    verifyBaselineCache(current, currentPlan.coveredSeeds === 0 ? undefined : currentPlan.coveredSeeds);
    const rawBaseline = JSON.parse(readFileSync(current.baselinePath, "utf8"));
    validateCompilerSnapshot(rawBaseline.compiler_snapshot);
    const schedule = seedScheduleAtDepth(current.cache, currentPlan.requestedSeeds);
    const stem = `${safeLabel(current.cache.baselineLabel)}-slots-${currentPlan.coveredSeeds}-${currentPlan.requestedSeeds}`;
    const workDir = resolve("generated/benchmark-v2/baseline-cache", safeLabel(current.cache.baselineLabel));
    const schedulePath = resolve(workDir, `${stem}.seed-schedule.json`);
    const outputPath = resolve(workDir, `${stem}.json`);
    mkdirSync(workDir, { recursive: true });
    writeFileAtomicDurable(schedulePath, `${JSON.stringify(schedule, null, 2)}\n`);
    workspace = createSnapshotWorkspace(rawBaseline.compiler_snapshot);
    const run = runInWorkspace(workspace, "development", runnerArgs({
      jobs: input.jobs,
      outputPath,
      seedBase: current.cache.ladder.seedBase,
      depth: currentPlan.requestedSeeds,
      from: currentPlan.coveredSeeds,
      schedulePath,
      resume: input.resume,
      // The cache's own budget scope. Without it the shard resolves the
      // catalog's full canonical ladder and the campaign-scoped seed
      // schedule can never validate (byBudget length mismatch).
      budgets: current.cache.ladder.byBudget.map((entry) => entry.budget),
    }), outputPath);
    if (run.workerFailures > 0) throw new Error(`baseline cache tail had ${run.workerFailures} worker failure(s); resume the same extension`);
    // Keep the raw archive beside its compact decision index.  At N=300 the
    // raw evidence is larger than V8's maximum single string, so forcing a
    // gzip -> Buffer -> JSON.parse path here would make a successful compiler
    // run unverifiable.  The index is cryptographically bound to the raw
    // archive header and raw/archive checksums, and contains every field the
    // decision layer needs.
    const retained = resolve("benchmark/v2/runs", `${stem}.json`);
    copyFileDurable(outputPath, retained);
    copyFileDurable(`${outputPath}.gz`, `${retained}.gz`);
    const decisionIndex = `${outputPath}.decision-index.json`;
    if (!existsSync(decisionIndex) || !existsSync(`${decisionIndex}.sha256`)) {
      throw new Error(`baseline cache tail did not publish its decision index`);
    }
    copyFileDurable(decisionIndex, `${retained}.decision-index.json`);
    copyFileDurable(`${decisionIndex}.sha256`, `${retained}.decision-index.json.sha256`);
    writeFileAtomicDurable(`${retained}.sha256`, `${run.archiveSha256}  ${relativeToCwd(retained)}\n`);
    writeFileAtomicDurable(`${retained}.gz.sha256`, `${run.compressedArchiveSha256}  ${relativeToCwd(`${retained}.gz`)}\n`);
    const loaded = loadIndexedArchive(retained, run.archiveSha256, `${retained}.gz`, run.compressedArchiveSha256);
    const archive = loaded.archive;
    const shard: BaselineCacheShard = {
      schema: BASELINE_CACHE_SHARD_SCHEMA,
      firstSeedSlot: currentPlan.coveredSeeds,
      endSeedSlotExclusive: currentPlan.requestedSeeds,
      archiveSha256: run.archiveSha256,
      archive: relativeToCwd(retained),
      compressedArchive: relativeToCwd(`${retained}.gz`),
      compressedArchiveSha256: run.compressedArchiveSha256,
      executionPolicyFingerprint: archive.identity.executionPolicyFingerprint,
      implementationFingerprint: archive.identity.implementationFingerprint,
    };
    const updated: CanonicalBaselineCache = {
      ...current.cache,
      shards: [...current.cache.shards, shard],
    };
    validateCacheStructure(updated, rawBaseline);
    verifyShard(updated, shard, seedScheduleAtDepth(updated, currentPlan.requestedSeeds), canonicalSourceIds());
    publishCache(current.baselinePath, rawBaseline, updated);
    return baselineCachePlan(readBaselineCache(current.baselinePath), input.seeds);
  } finally {
    if (workspace !== undefined) disposeSnapshotWorkspace(workspace);
    releaseCacheLock();
  }
}

export function renderBaselineCachePlan(plan: BaselineCachePlan): string {
  return [
    `  requested prefix N=${plan.requestedSeeds}; baseline cache coverage: ${plan.coveredSeeds}`,
    `  baseline work: ${plan.missingBaselineSeeds} missing seed slots = ${plan.missingBaselineCompiles} compiles`,
    `  candidate work: ${plan.candidateSeeds} seed slots = ${plan.candidateCompiles} compiles`,
    `  shard ranges: ${plan.shardRanges.map((range) => `[${range.firstSeedSlot},${range.endSeedSlotExclusive})`).join(", ") || "none"}`,
  ].join("\n");
}

function parseCache(value: any, baseline: any): CanonicalBaselineCache {
  if (value?.schema !== BASELINE_CACHE_SCHEMA) throw new Error(`unsupported canonical baseline cache schema`);
  return value as CanonicalBaselineCache;
}

function canonicalCacheFromDevelopment(baseline: any): CanonicalBaselineCache {
  const schedule = baseline.development?.seed_schedule;
  if (
    schedule?.profile !== "canonical" || !Number.isSafeInteger(schedule?.seedsPerBudget) ||
    !Array.isArray(schedule?.byBudget)
  ) throw new Error(`baseline has an invalid canonical development seed schedule`);
  if (typeof baseline.development?.compressed_archive !== "string") {
    throw new Error(`baseline has no retained canonical development archive`);
  }
  const ladder = extendSeedLadder(schedule, MAX_FIXED_N);
  return {
    schema: BASELINE_CACHE_SCHEMA,
    baselineLabel: baseline.label,
    candidateFingerprint: baseline.candidate_fingerprint,
    suiteFingerprint: baseline.suite_fingerprint,
    ladder,
    shards: [{
      schema: BASELINE_CACHE_SHARD_SCHEMA,
      firstSeedSlot: 0,
      endSeedSlotExclusive: schedule.seedsPerBudget,
      archiveSha256: baseline.development.archive_sha256,
      compressedArchive: baseline.development.compressed_archive,
      compressedArchiveSha256: baseline.development.compressed_archive_sha256,
      executionPolicyFingerprint: baseline.development.execution_policy_fingerprint,
      implementationFingerprint: baseline.development.implementation_fingerprint,
    }],
  };
}

/**
 * Preserve every measured seed in the accepted archive, then allocate a
 * disjoint deterministic tail. Every requested depth is therefore a genuine
 * prefix of one stable ladder and never recomputes accepted evidence.
 */
function extendSeedLadder(schedule: any, maximumSeedsPerBudget: number): CanonicalSeedLadder {
  const used = new Set<number>(schedule.byBudget.flatMap((entry: any) => entry.actualSeeds));
  let next = Math.max(...used) + 1;
  const allocate = (): number => {
    while (used.has(next)) next++;
    const value = next++;
    used.add(value);
    return value;
  };
  return {
    schema: BASELINE_CACHE_LADDER_SCHEMA,
    profile: "canonical",
    seedBase: schedule.seedBase,
    maximumSeedsPerBudget,
    byBudget: schedule.byBudget.map((entry: any) => ({
      budget: entry.budget,
      actualSeeds: [
        ...entry.actualSeeds,
        ...Array.from({ length: maximumSeedsPerBudget - entry.actualSeeds.length }, allocate),
      ],
    })),
  };
}

function validateCacheStructure(cache: CanonicalBaselineCache, baseline: any): void {
  if (
    cache.schema !== BASELINE_CACHE_SCHEMA || cache.baselineLabel !== baseline.label ||
    cache.candidateFingerprint !== baseline.candidate_fingerprint || cache.suiteFingerprint !== baseline.suite_fingerprint ||
    cache.ladder?.schema !== BASELINE_CACHE_LADDER_SCHEMA || cache.ladder.profile !== "canonical" ||
    !Number.isSafeInteger(cache.ladder.seedBase) || cache.ladder.seedBase < 0 ||
    !Number.isSafeInteger(cache.ladder.maximumSeedsPerBudget) || cache.ladder.maximumSeedsPerBudget < MIN_FIXED_N ||
    cache.ladder.maximumSeedsPerBudget > MAX_FIXED_N || !Array.isArray(cache.ladder.byBudget) ||
    !Array.isArray(cache.shards) || cache.shards.length === 0
  ) throw new Error(`canonical baseline cache manifest is malformed`);
  const seen = new Set<number>();
  for (const entry of cache.ladder.byBudget) {
    if (
      !Number.isSafeInteger(entry.budget) || !Array.isArray(entry.actualSeeds) ||
      entry.actualSeeds.length !== cache.ladder.maximumSeedsPerBudget ||
      entry.actualSeeds.some((seed) => !Number.isSafeInteger(seed) || seed < 0 || seen.has(seed))
    ) throw new Error(`canonical baseline cache ladder is incomplete or overlaps across budgets`);
    for (const seed of entry.actualSeeds) seen.add(seed);
  }
  let cursor = 0;
  for (const shard of cache.shards) {
    if (
      shard?.schema !== BASELINE_CACHE_SHARD_SCHEMA || shard.firstSeedSlot !== cursor ||
      !Number.isSafeInteger(shard.endSeedSlotExclusive) || shard.endSeedSlotExclusive <= cursor ||
      shard.endSeedSlotExclusive > cache.ladder.maximumSeedsPerBudget ||
      !fingerprint(shard.archiveSha256) || !fingerprint(shard.compressedArchiveSha256) ||
      !fingerprint(shard.executionPolicyFingerprint) || !fingerprint(shard.implementationFingerprint) ||
      typeof shard.compressedArchive !== "string" ||
      (shard.archive !== undefined && typeof shard.archive !== "string") ||
      (shard.budgetProjection !== undefined && (
        shard.budgetProjection.schema !== CACHE_BUDGET_PROJECTION_SCHEMA ||
        typeof shard.budgetProjection.sourceBaseline !== "string" ||
        !fingerprint(shard.budgetProjection.sourceCacheFingerprint)
      ))
    ) throw new Error(`canonical baseline cache shards must be contiguous, non-overlapping, and content-addressed`);
    cursor = shard.endSeedSlotExclusive;
  }
}

function verifyShard(
  cache: CanonicalBaselineCache,
  shard: BaselineCacheShard,
  expectedSchedule: ResolvedSeedSchedule,
  sources: string[],
): LoadedCacheShard {
  const loaded = shard.budgetProjection === undefined
    ? loadShardArchive(shard)
    : verifyBudgetProjection(cache, shard, expectedSchedule);
  const archive = loaded.archive;
  if (
    archive.schema !== RUN_ARCHIVE_SCHEMA || archive.mode !== "development" || archive.profile !== "canonical" ||
    archive.identity?.suiteFingerprint !== cache.suiteFingerprint ||
    archive.git?.candidateFingerprint !== cache.candidateFingerprint ||
    archive.identity?.executionPolicyFingerprint !== shard.executionPolicyFingerprint ||
    archive.identity?.implementationFingerprint !== shard.implementationFingerprint
  ) throw new Error(`${shard.compressedArchive}: cache shard identity does not match its baseline contract`);
  const marker = archive.baselineCacheShard;
  if (shard.firstSeedSlot === 0 && marker === undefined) {
    // The v9 anchor predates the marker but is only accepted as the first
    // shard.  All extension shards must self-identify as cache-only runs.
  } else if (
    marker?.schema !== "line.benchmark-v2.baseline-cache-shard-run.v1" ||
    marker.firstSeedSlot !== shard.firstSeedSlot || marker.endSeedSlotExclusive !== shard.endSeedSlotExclusive
  ) throw new Error(`${shard.compressedArchive}: cache shard range marker is missing or mismatched`);
  const expectedKeys = new Set<string>();
  for (const budget of expectedSchedule.byBudget) {
    for (let slot = shard.firstSeedSlot; slot < shard.endSeedSlotExclusive; slot++) {
      for (const source of sources) expectedKeys.add(`${budget.budget}/${slot}/${source}`);
    }
  }
  const selectedBudgets = new Set(expectedSchedule.byBudget.map((entry) => entry.budget));
  const rows = shard.budgetProjection === undefined
    ? archive.runs
    : archive.runs?.filter((row: any) => selectedBudgets.has(row.task?.budget));
  if (!Array.isArray(rows)) throw new Error(`${shard.compressedArchive}: cache shard has no run rows`);
  for (const row of rows) {
    const key = `${row.task?.budget}/${row.task?.seedSlot}/${row.task?.sourceId}`;
    const budget = expectedSchedule.byBudget.find((entry) => entry.budget === row.task?.budget);
    if (
      !expectedKeys.delete(key) || row.status !== "ok" || budget === undefined ||
      row.task.actualSeed !== budget.actualSeeds[row.task.seedSlot]
    ) throw new Error(`${shard.compressedArchive}: cache shard has an unexpected, duplicate, failed, or remapped run`);
  }
  if (expectedKeys.size > 0) throw new Error(`${shard.compressedArchive}: cache shard is missing ${expectedKeys.size} declared runs`);
  return loaded;
}

function verifyBudgetProjection(
  cache: CanonicalBaselineCache,
  shard: BaselineCacheShard,
  expectedSchedule: ResolvedSeedSchedule,
): LoadedCacheShard {
  const projection = shard.budgetProjection!;
  const source = readBaselineCache(projection.sourceBaseline);
  if (source.campaignScope !== undefined) {
    throw new Error(`${shard.compressedArchive}: a budget projection must originate in a frozen canonical baseline`);
  }
  if (baselineCacheManifestFingerprint(source.cache) !== projection.sourceCacheFingerprint) {
    throw new Error(`${shard.compressedArchive}: projected source baseline cache changed`);
  }
  if (
    source.cache.candidateFingerprint !== cache.candidateFingerprint ||
    source.cache.suiteFingerprint !== cache.suiteFingerprint
  ) {
    throw new Error(`${shard.compressedArchive}: projected source baseline identity changed`);
  }
  const sourceShard = source.cache.shards.find((entry) =>
    entry.firstSeedSlot === shard.firstSeedSlot &&
    entry.endSeedSlotExclusive === shard.endSeedSlotExclusive &&
    entry.archiveSha256 === shard.archiveSha256 &&
    entry.compressedArchiveSha256 === shard.compressedArchiveSha256 &&
    entry.executionPolicyFingerprint === shard.executionPolicyFingerprint &&
    entry.implementationFingerprint === shard.implementationFingerprint
  );
  if (sourceShard === undefined) {
    throw new Error(`${shard.compressedArchive}: projected evidence is not a shard of its source baseline`);
  }
  for (const projected of expectedSchedule.byBudget) {
    const sourceBudget = source.cache.ladder.byBudget.find((entry) => entry.budget === projected.budget);
    if (
      sourceBudget === undefined ||
      JSON.stringify(sourceBudget.actualSeeds.slice(0, expectedSchedule.seedsPerBudget)) !==
        JSON.stringify(projected.actualSeeds)
    ) {
      throw new Error(`${shard.compressedArchive}: projected budget seed schedule changed`);
    }
  }
  const sourceSchedule = seedScheduleAtDepth(
    source.cache,
    Math.max(shard.endSeedSlotExclusive, cacheCoverage(source.cache)),
  );
  return verifyShard(source.cache, sourceShard, sourceSchedule, canonicalSourceIds());
}

function parseCampaignScope(
  baseline: any,
  cache: CanonicalBaselineCache,
): BaselineCacheView["campaignScope"] {
  const scope = baseline.scope;
  const budgets = cache.ladder.byBudget.map((entry) => entry.budget);
  if (
    scope?.profile !== "canonical" || !Array.isArray(scope.budgets) ||
    JSON.stringify(scope.budgets) !== JSON.stringify(budgets) ||
    !Number.isSafeInteger(scope.max_seeds) || scope.max_seeds < MIN_FIXED_N ||
    scope.max_seeds !== cache.ladder.maximumSeedsPerBudget ||
    !Number.isSafeInteger(scope.promotion_seeds) || scope.promotion_seeds < MIN_FIXED_N ||
    scope.promotion_seeds > scope.max_seeds ||
    !(benchmarkSequentialEvalPolicy.looks as readonly number[]).includes(scope.promotion_seeds) ||
    !Array.isArray(scope.sequential_looks) || scope.sequential_looks.length === 0 ||
    scope.sequential_looks.at(-1) !== scope.max_seeds ||
    scope.max_seeds !== benchmarkSequentialEvalPolicy.maximumDepth ||
    JSON.stringify(scope.sequential_looks) !== JSON.stringify(benchmarkSequentialEvalPolicy.looks) ||
    scope.sequential_looks.some((look: unknown, index: number) =>
      !Number.isSafeInteger(look) || (look as number) < MIN_FIXED_N ||
      (index > 0 && (scope.sequential_looks[index - 1] as number) >= (look as number))
    ) ||
    !Number.isFinite(scope.target_headline) ||
    !fingerprint(baseline.sequential_eval_policy_fingerprint) ||
    !fingerprint(baseline.sequential_eval_inference_fingerprint) ||
    !fingerprint(baseline.sequential_eval_calibration_fingerprint)
  ) {
    throw new Error(`campaign baseline scope is malformed or disagrees with its cache`);
  }
  const development = baseline.development;
  const schedule = seedScheduleAtDepth(cache, scope.promotion_seeds);
  if (
    !Number.isFinite(development?.canonical_headline) ||
    JSON.stringify(development?.seed_schedule) !== JSON.stringify(schedule) ||
    !Array.isArray(development?.budgets) ||
    JSON.stringify(development.budgets.map((entry: any) => entry.budget)) !== JSON.stringify(scope.budgets) ||
    (scope.budgets.length === 1 &&
      Math.abs(development.canonical_headline - development.budgets[0]?.score) > 0.0001) ||
    development.budgets.some((entry: any) =>
      !Number.isFinite(entry.score) || !Number.isSafeInteger(entry.valid_runs) ||
      !Number.isSafeInteger(entry.total_runs)
    )
  ) {
    throw new Error(`campaign baseline development summary does not match its promotion scope`);
  }
  return {
    budgets: [...scope.budgets],
    maximumSeeds: scope.max_seeds,
    promotionSeeds: scope.promotion_seeds,
    looks: [...scope.sequential_looks],
    targetHeadline: scope.target_headline,
    sequentialPolicyFingerprint: baseline.sequential_eval_policy_fingerprint,
    sequentialInferenceFingerprint: baseline.sequential_eval_inference_fingerprint,
    sequentialCalibrationFingerprint: baseline.sequential_eval_calibration_fingerprint,
  };
}

function runnerArgs(input: {
  jobs: number;
  outputPath: string;
  seedBase: number;
  depth: number;
  from: number;
  schedulePath: string;
  resume: boolean;
  budgets: readonly number[];
}): string[] {
  return [
    "--profile=canonical",
    `--comparison-budgets=${input.budgets.join(",")}`,
    `--manifest=${resolve(SOURCE_MANIFEST)}`,
    `--heldout-manifest=${resolve(HELDOUT_MANIFEST)}`,
    `--suite=${resolve(SUITE_MANIFEST)}`,
    `--characterization=${resolve("benchmark/v2/evidence/characterization.json")}`,
    `--audit=${resolve("benchmark/v2/evidence/audit.json")}`,
    `--review=${resolve("benchmark/v2/evidence/candidate-review.json")}`,
    `--listening-review=${resolve("benchmark/v2/evidence/listening-review.json")}`,
    `--jobs=${input.jobs}`,
    "--baseline-cache-shard",
    `--canonical-seed-base=${input.seedBase}`,
    `--seeds-per-budget=${input.depth}`,
    `--from-seed-slot=${input.from}`,
    `--through-seed-slot=${input.depth}`,
    `--seed-schedule=${input.schedulePath}`,
    `--out=${input.outputPath}`,
    ...(input.resume ? ["--resume"] : []),
  ];
}

function publishCache(path: string, baseline: any, cache: CanonicalBaselineCache): void {
  const { cache_monitoring: _oldMonitoring, ...baselineWithoutOldMonitoring } = baseline;
  const campaignScope = baseline.status === "active-campaign-baseline"
    ? parseCampaignScope(baseline, cache)
    : undefined;
  const coverage = cacheCoverage(cache);
  const monitoring = campaignScope !== undefined && coverage > campaignScope.promotionSeeds
    ? baselineCacheHeadlineAtDepth({ baselinePath: resolve(path), cache, campaignScope }, coverage)
    : null;
  const baselineWithCache = {
    ...baselineWithoutOldMonitoring,
    schema: baseline.status === "active-campaign-baseline"
      ? CAMPAIGN_BASELINE_REFERENCE_SCHEMA
      : BASELINE_REFERENCE_CACHE_SCHEMA,
    canonical_cache: cache,
    ...(monitoring === null ? {} : {
      cache_monitoring: {
        schema: "line.benchmark-v2.campaign-cache-monitoring.v1",
        authority: "descriptive-only",
        generated_at: new Date().toISOString(),
        coverage_seeds: monitoring.seeds,
        canonical_headline: monitoring.headline,
        valid_runs: monitoring.validRuns,
        total_runs: monitoring.totalRuns,
        cache_manifest_fingerprint: baselineCacheManifestFingerprint(cache),
        note: "This completed-cache headline does not replace the promotion headline or stopping depth.",
      },
    }),
  };
  writeFileAtomicDurable(path, `${JSON.stringify(baselineWithCache, null, 2)}\n`);
}

function loadShardArchive(shard: BaselineCacheShard): LoadedCacheShard {
  if (shard.archive !== undefined) {
    return loadIndexedArchive(shard.archive, shard.archiveSha256, shard.compressedArchive, shard.compressedArchiveSha256);
  }
  return loadCompressedArchive(shard.compressedArchive, shard.compressedArchiveSha256, shard.archiveSha256);
}

/**
 * Shards retained only as gzip archives rescore directly when small. Deep
 * shards use their checksum-bound decision index so status and decisions
 * never create a V8-sized JSON string.
 */
function loadCompressedArchive(path: string, compressedSha: string, archiveSha: string): LoadedCacheShard {
  const bytes = readFileSync(resolve(path));
  if (sha256Buffer(bytes) !== compressedSha) throw new Error(`${path}: compressed archive checksum mismatch`);
  const raw = gunzipSync(bytes);
  if (sha256Buffer(raw) !== archiveSha) throw new Error(`${path}: decompressed archive checksum mismatch`);
  const indexPath = resolve(path).replace(/\.json\.gz$/, ".decision-index.json");
  if (
    raw.byteLength >= INDEXED_COMPRESSED_ARCHIVE_THRESHOLD_BYTES ||
    (indexPath !== resolve(path) && existsSync(indexPath))
  ) {
    return loadIndexedCompressedArchive(path, raw, compressedSha, archiveSha);
  }
  return { archive: JSON.parse(raw.toString("utf8")), indexed: false };
}

function loadIndexedCompressedArchive(
  compressedPath: string,
  rawArchive: Buffer,
  compressedSha: string,
  archiveSha: string,
): LoadedCacheShard {
  const indexPath = resolve(compressedPath).replace(/\.json\.gz$/, ".decision-index.json");
  if (indexPath === resolve(compressedPath)) {
    throw new Error(`${compressedPath}: large compressed cache shard has no decision-index path`);
  }
  const indexBytes = readFileSync(indexPath);
  const indexSidecar = readFileSync(`${indexPath}.sha256`, "utf8").trim().split(/\s+/)[0];
  if (indexSidecar !== sha256Buffer(indexBytes)) throw new Error(`${indexPath}: decision-index checksum mismatch`);
  const index = JSON.parse(indexBytes.toString("utf8"));
  if (
    index.schema !== DECISION_INDEX_SCHEMA || index.archiveSha256 !== archiveSha ||
    index.compressedArchiveSha256 !== compressedSha || typeof index.payloadSha256 !== "string" ||
    index.archive === null || typeof index.archive !== "object"
  ) throw new Error(`${indexPath}: decision index does not describe this compressed cache shard`);
  if (sha256String(JSON.stringify(index.archive)) !== index.payloadSha256) {
    throw new Error(`${indexPath}: decision-index payload checksum mismatch`);
  }
  if (readRawDecisionIndexCommitmentFromBuffer(rawArchive) !== index.payloadSha256) {
    throw new Error(`${compressedPath}: raw archive is not bound to its decision index`);
  }
  return { archive: index.archive, indexed: true };
}

/**
 * Load the bounded decision projection for a large raw archive.  The raw
 * archive's hash, compressed companion's hash, index sidecar, and embedded
 * raw-header commitment form one chain: an index cannot be substituted for
 * different raw evidence, while the decision path never needs to materialize
 * every raw report in one JavaScript string.
 */
function loadIndexedArchive(
  archivePath: string,
  archiveSha: string,
  compressedPath: string,
  compressedSha: string,
): LoadedCacheShard {
  const absolute = resolve(archivePath);
  if (sha256FileStreaming(absolute) !== archiveSha) throw new Error(`${archivePath}: raw archive checksum mismatch`);
  if (sha256FileStreaming(resolve(compressedPath)) !== compressedSha) {
    throw new Error(`${compressedPath}: compressed archive checksum mismatch`);
  }
  const indexPath = `${absolute}.decision-index.json`;
  const indexBytes = readFileSync(indexPath);
  const indexSidecar = readFileSync(`${indexPath}.sha256`, "utf8").trim().split(/\s+/)[0];
  if (indexSidecar !== sha256(indexBytes)) throw new Error(`${indexPath}: decision-index checksum mismatch`);
  const index = JSON.parse(indexBytes.toString("utf8"));
  if (
    index.schema !== DECISION_INDEX_SCHEMA || index.archiveSha256 !== archiveSha ||
    index.compressedArchiveSha256 !== compressedSha || typeof index.payloadSha256 !== "string" ||
    index.archive === null || typeof index.archive !== "object"
  ) throw new Error(`${indexPath}: decision index does not describe this cache shard`);
  if (sha256String(JSON.stringify(index.archive)) !== index.payloadSha256) {
    throw new Error(`${indexPath}: decision-index payload checksum mismatch`);
  }
  if (readRawDecisionIndexCommitment(absolute) !== index.payloadSha256) {
    throw new Error(`${archivePath}: raw archive is not bound to its decision index`);
  }
  return { archive: index.archive, indexed: true };
}

function readRawDecisionIndexCommitment(path: string): string {
  const descriptor = openSync(path, "r");
  try {
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let prefix = "";
    let position = 0;
    while (position < 16 * 1024 * 1024) {
      const length = readSync(descriptor, buffer, 0, buffer.length, position);
      if (length === 0) break;
      position += length;
      prefix += buffer.subarray(0, length).toString("utf8");
      const match = prefix.match(/"decisionIndexPayloadSha256"\s*:\s*"([a-f0-9]{64})"/);
      if (match !== null) return match[1];
      if (/"runs"\s*:\s*\[/.test(prefix)) break;
    }
    throw new Error(`${path}: raw archive has no decision-index commitment before runs`);
  } finally {
    closeSync(descriptor);
  }
}

function readRawDecisionIndexCommitmentFromBuffer(rawArchive: Buffer): string {
  const prefix = rawArchive.subarray(0, Math.min(rawArchive.byteLength, 16 * 1024 * 1024)).toString("utf8");
  const match = prefix.match(/"decisionIndexPayloadSha256"\s*:\s*"([a-f0-9]{64})"/);
  if (match === null) throw new Error(`large raw archive has no decision-index commitment before runs`);
  return match[1];
}

function sha256FileStreaming(path: string): string {
  const descriptor = openSync(resolve(path), "r");
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let position = 0;
    for (;;) {
      const length = readSync(descriptor, buffer, 0, buffer.length, position);
      if (length === 0) break;
      hash.update(buffer.subarray(0, length));
      position += length;
    }
    return hash.digest("hex");
  } finally {
    closeSync(descriptor);
  }
}

function canonicalSourceIds(): string[] {
  return canonicalMembers(loadSuiteManifest(
    SUITE_MANIFEST,
    resolveSources(loadSourceManifest(SOURCE_MANIFEST)),
  )).sort();
}

function acquireCacheLock(): void {
  if (existsSync(CACHE_LOCK)) throw new Error(`a baseline-cache extension is already in flight; inspect ${CACHE_LOCK}`);
  mkdirSync(resolve(CACHE_LOCK, ".."), { recursive: true });
  const fd = openSync(CACHE_LOCK, "wx");
  try {
    writeFileAtomicDurable(CACHE_LOCK, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
  } finally {
    closeSync(fd);
  }
}

function releaseCacheLock(): void {
  try {
    unlinkSync(CACHE_LOCK);
  } catch {
    // A failed or externally removed lock must not mask the original error.
  }
}

function fingerprint(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Buffer(value: Buffer): string {
  const hash = createHash("sha256");
  const chunkSize = 1024 * 1024;
  for (let offset = 0; offset < value.byteLength; offset += chunkSize) {
    hash.update(value.subarray(offset, Math.min(offset + chunkSize, value.byteLength)));
  }
  return hash.digest("hex");
}

function sha256String(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeLabel(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, "-");
}

function relativeToCwd(path: string): string {
  const cwd = `${process.cwd()}/`;
  return path.startsWith(cwd) ? path.slice(cwd.length) : path;
}
