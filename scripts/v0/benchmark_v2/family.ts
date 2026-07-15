import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
  createCompilerSnapshot,
  runSnapshotBenchmark,
  validateCompilerSnapshot,
  type CompilerSnapshot,
} from "./compiler_snapshot.ts";
import { compilerCandidateIdentity } from "./compiler_identity.ts";
import { readBaselineContract, type BaselineContract } from "./confirmation.ts";
import { requireCurrentDecisionCalibration } from "./calibration_guard.ts";
import { loadVerifiedArchive, suiteAtDepth } from "./decide.ts";
import { pairedV2DecisionForCalibration, type DecisionRun, type V2Decision } from "./decision_model.ts";
import { writeFileAtomicDurable } from "./durable_fs.ts";
import { loadSourceManifest, resolveSources } from "./model.ts";
import { loadSuiteManifest, suiteIdentity, type SuiteManifest } from "./suite_model.ts";

export const FAMILY_SCHEMA = "line.benchmark-v2.family.v1" as const;
export const FAMILY_PROTOCOL = "line.benchmark-v2.family-protocol.v1" as const;
export const FAMILY_REPORT_SCHEMA = "line.benchmark-v2.family-report.v1" as const;
const SEED_LEDGER_SCHEMA = "line.benchmark-v2.exploration-seed-ledger.v1" as const;
const SOURCE_MANIFEST = "benchmark/v2/compat/source-manifest.json";
const SUITE_MANIFEST = "benchmark/v2/compat/suite-manifest.json";
const DEFAULT_ROOT = "generated/benchmark-v2/families";
const DEFAULT_SEEDS = 6;
const MAX_VARIANTS = 8;
const EXPLORATION_SEED_MIN = 3_000_000_000;
const EXPLORATION_SEED_MAX = 4_000_000_000;
const LOCK_WAIT_MS = 50;
const LOCK_TIMEOUT_MS = 30_000;
const MALFORMED_LOCK_GRACE_MS = 5_000;

type FamilyVariant = {
  id: string;
  capturedAt: string;
  note: string | null;
  candidateFingerprint: string;
  snapshot: CompilerSnapshot;
  carriedFromRound: number | null;
};

type FamilyRunReference = {
  archive: string;
  archiveSha256: string;
  compressedArchiveSha256: string;
  candidateFingerprint: string;
  headline: number;
};

export type FamilyRound = {
  number: number;
  status: "draft" | "running" | "completed" | "selected";
  createdAt: string;
  frozenAt: string | null;
  variants: FamilyVariant[];
  seedBase: number | null;
  seedsPerBudget: number | null;
  baselineRun: FamilyRunReference | null;
  variantRuns: Record<string, FamilyRunReference>;
  reportPath: string | null;
  observedChampionId: string | null;
  selectedVariantId: string | null;
  selectedAt: string | null;
  selectionReason: string | null;
};

export type BenchmarkFamily = {
  schema: typeof FAMILY_SCHEMA;
  protocol: typeof FAMILY_PROTOCOL;
  name: string;
  createdAt: string;
  baseline: {
    label: string;
    suiteFingerprint: string;
    candidateFingerprint: string;
    inferenceFingerprint: string;
    protocolFingerprint: string;
    calibrationFingerprint: string;
    snapshot: CompilerSnapshot;
  };
  rounds: FamilyRound[];
};

type SeedLedger = {
  schema: typeof SEED_LEDGER_SCHEMA;
  allocations: Array<{
    family: string;
    round: number;
    seedBase: number;
    seedCount: number;
    allocatedAt: string;
  }>;
};

export type FamilyReport = {
  schema: typeof FAMILY_REPORT_SCHEMA;
  protocol: typeof FAMILY_PROTOCOL;
  authority: "exploration-only";
  statement: string;
  family: string;
  round: number;
  generatedAt: string;
  baselineLabel: string;
  suiteFingerprint: string;
  baselineContract: {
    inferenceFingerprint: string;
    protocolFingerprint: string;
    calibrationFingerprint: string;
  };
  seedSchedule: { seedBase: number; seedsPerBudget: number; budgets: number[] };
  observedChampionId: string;
  championStableAcrossPrefixes: boolean;
  ranking: Array<VariantReport>;
  pairwise: PairwiseReport[];
  prefixRankings: Array<{ seedsPerBudget: number; ranking: Array<{ variantId: string; headline: number }> }>;
  rankingReversals: Array<{
    seedsPerBudget: number;
    observedLeaderId: string;
    finalChampionId: string;
    finalChampionDelta: number;
    largestCaseAdvantages: Array<{ sourceId: string; delta: number }>;
  }>;
  archives: {
    baseline: FamilyRunReference;
    variants: Record<string, FamilyRunReference>;
  };
  reportPath: string | null;
};

type VariantReport = {
  variantId: string;
  headline: number;
  delta: number;
  standardError: number;
  degreesOfFreedom: number | null;
  oneSidedLevel: number;
  oneSidedCriticalLevel: number;
  lowerBound: number;
  upperBound: number;
  baseValid: number;
  candidateValid: number;
  validityGained: number;
  validityLost: number;
  scoreIdenticalFraction: number;
  pairedCorrelation: number | null;
  perStratum: Array<{ stratum: string; delta: number; baseValid: number; candidateValid: number }>;
  largestCaseGains: Array<{ sourceId: string; delta: number }>;
  largestCaseLosses: Array<{ sourceId: string; delta: number }>;
};

type PairwiseReport = {
  leftVariantId: string;
  rightVariantId: string;
  deltaRightMinusLeft: number;
  standardError: number;
  degreesOfFreedom: number | null;
  oneSidedLevel: number;
  oneSidedCriticalLevel: number;
  lowerBound: number;
  upperBound: number;
  scoreIdenticalFraction: number;
  pairedCorrelation: number | null;
};

export async function runFamilyCommand(argv: string[]): Promise<number> {
  const positional = argv.filter((value) => !value.startsWith("--"));
  const action = positional[0];
  const familyName = positional[1];
  if (action !== "capture" && action !== "run" && action !== "select") {
    throw new Error(`family action must be capture|run|select`);
  }
  if (familyName === undefined || !validId(familyName)) {
    throw new Error(`family name must match [a-z0-9][a-z0-9_-]{0,63}`);
  }
  validateFamilyArguments(action, argv);
  const argument = argumentReader(argv);
  const root = resolve(argument("family-root") ?? DEFAULT_ROOT);
  const json = argv.includes("--json");
  const familyPath = resolve(root, familyName, "family.json");
  const result = await withFileLock(`${familyPath}.lock`, async () => {
    if (action === "capture") return captureVariant(root, familyPath, familyName, argument);
    if (action === "run") return runFamily(root, familyPath, familyName, argument);
    return selectVariant(familyPath, familyName, argument);
  });
  console.log(json ? JSON.stringify(result, null, 2) : renderFamilyResult(result));
  return 0;
}

async function captureVariant(
  root: string,
  familyPath: string,
  familyName: string,
  argument: (name: string) => string | undefined,
): Promise<Record<string, unknown>> {
  const variantId = argument("variant");
  if (variantId === undefined || !validId(variantId)) {
    throw new Error(`capture requires --variant=<id> matching [a-z0-9][a-z0-9_-]{0,63}`);
  }
  const baseline = readBaselineContract();
  assertExplorationDecisionSemantics(
    baseline,
    requireCurrentDecisionCalibration(baseline.suiteFingerprint),
  );
  const family = existsSync(familyPath)
    ? readBenchmarkFamily(familyPath)
    : newFamily(familyName, baseline);
  assertFamilyCurrent(family, baseline);
  let round = family.rounds.at(-1)!;
  if (round.status === "completed") {
    throw new Error(`round ${round.number} must be selected before a new adaptive round can begin`);
  }
  if (round.status === "selected") {
    const selected = round.variants.find((variant) => variant.id === round.selectedVariantId)!;
    round = {
      number: round.number + 1,
      status: "draft",
      createdAt: new Date().toISOString(),
      frozenAt: null,
      variants: [{ ...selected, carriedFromRound: round.number }],
      seedBase: null,
      seedsPerBudget: null,
      baselineRun: null,
      variantRuns: {},
      reportPath: null,
      observedChampionId: null,
      selectedVariantId: null,
      selectedAt: null,
      selectionReason: null,
    };
    family.rounds.push(round);
  }
  if (round.status !== "draft") throw new Error(`round ${round.number} is already frozen`);
  if (round.variants.length >= MAX_VARIANTS) throw new Error(`a family round is capped at ${MAX_VARIANTS} variants`);
  if (round.variants.some((variant) => variant.id === variantId)) {
    throw new Error(`variant ${variantId} already exists in round ${round.number}`);
  }
  const before = compilerCandidateIdentity("wasm");
  const snapshotDir = resolve(root, familyName, "snapshots");
  const snapshot = createCompilerSnapshot(
    `${familyName}-r${String(round.number).padStart(2, "0")}-${variantId}`,
    snapshotDir,
  );
  const after = compilerCandidateIdentity("wasm");
  if (before.candidateFingerprint !== after.candidateFingerprint || snapshot.candidateFingerprint !== before.candidateFingerprint) {
    rmSync(snapshot.archive, { force: true });
    throw new Error(`compiler changed while variant ${variantId} was being captured`);
  }
  if (round.variants.some((variant) => variant.candidateFingerprint === snapshot.candidateFingerprint)) {
    rmSync(snapshot.archive, { force: true });
    throw new Error(`variant ${variantId} duplicates an existing compiler snapshot in round ${round.number}`);
  }
  round.variants.push({
    id: variantId,
    capturedAt: new Date().toISOString(),
    note: argument("note") ?? null,
    candidateFingerprint: snapshot.candidateFingerprint,
    snapshot,
    carriedFromRound: null,
  });
  writeFamily(familyPath, family);
  return {
    schema: "line.benchmark-v2.family-command.v1",
    status: "captured",
    family: familyName,
    round: round.number,
    variant: variantId,
    candidateFingerprint: snapshot.candidateFingerprint,
    variantsInDraft: round.variants.map((variant) => variant.id),
    nextCommand: round.variants.length >= 2
      ? `npm run benchmark -- family run ${familyName}`
      : `npm run benchmark -- family capture ${familyName} --variant=<id>`,
  };
}

async function runFamily(
  root: string,
  familyPath: string,
  familyName: string,
  argument: (name: string) => string | undefined,
): Promise<Record<string, unknown>> {
  if (!existsSync(familyPath)) throw new Error(`family ${familyName} does not exist; capture variants first`);
  const family = readBenchmarkFamily(familyPath);
  const baseline = readBaselineContract();
  assertExplorationDecisionSemantics(
    baseline,
    requireCurrentDecisionCalibration(baseline.suiteFingerprint),
  );
  assertFamilyCurrent(family, baseline);
  const round = family.rounds.at(-1)!;
  if (round.status === "completed" || round.status === "selected") {
    if (round.reportPath === null || !existsSync(resolve(round.reportPath))) {
      throw new Error(`completed round ${round.number} is missing its report`);
    }
    return JSON.parse(readFileSync(resolve(round.reportPath), "utf8"));
  }
  if (round.status === "draft") {
    if (round.variants.length < 2) throw new Error(`family run requires at least two frozen variants`);
    const seeds = argument("seeds") === undefined ? DEFAULT_SEEDS : Number(argument("seeds"));
    if (!Number.isSafeInteger(seeds) || seeds < 2 || seeds > 16) {
      throw new Error(`--seeds must be an integer from 2 through 16`);
    }
    const sources = resolveSources(loadSourceManifest(SOURCE_MANIFEST));
    const suite = loadSuiteManifest(SUITE_MANIFEST, sources);
    const allocation = await allocateExplorationSeedEpoch(
      root,
      familyName,
      round.number,
      seeds * suite.profiles.probe.budgets.length,
    );
    round.status = "running";
    round.frozenAt = new Date().toISOString();
    round.seedBase = allocation.seedBase;
    round.seedsPerBudget = seeds;
    writeFamily(familyPath, family);
  } else if (argument("seeds") !== undefined && Number(argument("seeds")) !== round.seedsPerBudget) {
    throw new Error(`running round ${round.number} is already frozen at ${round.seedsPerBudget} seeds per budget`);
  }

  const jobs = argument("jobs") === undefined
    ? Math.min(48, availableParallelism())
    : Number(argument("jobs"));
  if (!Number.isSafeInteger(jobs) || jobs < 1) throw new Error(`--jobs must be a positive integer`);
  const roundDir = resolve(root, familyName, `round-${String(round.number).padStart(3, "0")}`);
  mkdirSync(roundDir, { recursive: true });
  const explorationId = `${familyName}/round-${String(round.number).padStart(3, "0")}`;
  round.baselineRun = await runOrReuseArm({
    outputPath: resolve(roundDir, "baseline.json"),
    snapshot: family.baseline.snapshot,
    expectedCandidateFingerprint: family.baseline.candidateFingerprint,
    explorationId,
    seedBase: round.seedBase!,
    seedsPerBudget: round.seedsPerBudget!,
    jobs,
  });
  writeFamily(familyPath, family);
  for (const variant of round.variants) {
    round.variantRuns[variant.id] = await runOrReuseArm({
      outputPath: resolve(roundDir, `variant-${variant.id}.json`),
      snapshot: variant.snapshot,
      expectedCandidateFingerprint: variant.candidateFingerprint,
      explorationId,
      seedBase: round.seedBase!,
      seedsPerBudget: round.seedsPerBudget!,
      jobs,
    });
    writeFamily(familyPath, family);
  }
  const report = buildFamilyReport(family, round);
  const reportPath = resolve(roundDir, "report.json");
  report.reportPath = relativeToCwd(reportPath);
  writeFileAtomicDurable(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  round.reportPath = relativeToCwd(reportPath);
  round.observedChampionId = report.observedChampionId;
  round.status = "completed";
  writeFamily(familyPath, family);
  return report;
}

async function selectVariant(
  familyPath: string,
  familyName: string,
  argument: (name: string) => string | undefined,
): Promise<Record<string, unknown>> {
  if (!existsSync(familyPath)) throw new Error(`family ${familyName} does not exist`);
  const family = readBenchmarkFamily(familyPath);
  const baseline = readBaselineContract();
  assertExplorationDecisionSemantics(
    baseline,
    requireCurrentDecisionCalibration(baseline.suiteFingerprint),
  );
  assertFamilyCurrent(family, baseline);
  const round = family.rounds.at(-1)!;
  if (round.status !== "completed" && round.status !== "selected") {
    throw new Error(`family round ${round.number} must complete before selection`);
  }
  const variantId = argument("variant");
  if (variantId === undefined) throw new Error(`select requires --variant=<id>`);
  const variant = round.variants.find((candidate) => candidate.id === variantId);
  if (variant === undefined) throw new Error(`variant ${variantId} is not in round ${round.number}`);
  if (Object.keys(variant.snapshot.compilerEnvironment).length > 0) {
    throw new Error(
      `variant ${variantId} uses exploration-only LR_ overrides; bake the mechanism into source defaults before selection`,
    );
  }
  const explicitReason = argument("reason")?.trim();
  if (variantId !== round.observedChampionId && !explicitReason) {
    throw new Error(`selecting a non-champion requires --reason=...`);
  }
  const current = compilerCandidateIdentity("wasm");
  if (current.candidateFingerprint !== variant.candidateFingerprint) {
    throw new Error(
      `current compiler does not match ${variantId}; expected ${variant.candidateFingerprint}, ` +
      `got ${current.candidateFingerprint}. Restore the captured source implementation before selection`,
    );
  }
  if (round.status === "selected" && round.selectedVariantId !== variantId) {
    throw new Error(`round ${round.number} already selected ${round.selectedVariantId}`);
  }
  round.status = "selected";
  round.selectedVariantId = variantId;
  round.selectedAt = round.selectedAt ?? new Date().toISOString();
  round.selectionReason = explicitReason ??
    `selected the observed champion from exploration round ${round.number}`;
  writeFamily(familyPath, family);
  return {
    schema: "line.benchmark-v2.family-command.v1",
    status: "selected",
    family: familyName,
    round: round.number,
    variant: variantId,
    candidateFingerprint: variant.candidateFingerprint,
    statement: "Selection is descriptive only. Promotion requires a fresh certified eval epoch.",
    nextCommand: "npm run benchmark -- eval --to-verdict",
  };
}

async function runOrReuseArm(input: {
  outputPath: string;
  snapshot: CompilerSnapshot;
  expectedCandidateFingerprint: string;
  explorationId: string;
  seedBase: number;
  seedsPerBudget: number;
  jobs: number;
}): Promise<FamilyRunReference> {
  validateCompilerSnapshot(input.snapshot);
  const checkpoint = `${input.outputPath}.checkpoint.jsonl`;
  if (!existsSync(input.outputPath)) {
    const run = runSnapshotBenchmark(input.snapshot, "development", [
      "--profile=probe",
      "--exploration",
      `--exploration-id=${input.explorationId}`,
      `--exploration-seed-base=${input.seedBase}`,
      `--exploration-seeds-per-budget=${input.seedsPerBudget}`,
      `--jobs=${input.jobs}`,
      ...(existsSync(checkpoint) ? ["--resume"] : []),
    ], input.outputPath);
    if (run.workerFailures > 0) throw new Error(`exploration arm has ${run.workerFailures} worker failures`);
  }
  const verified = loadVerifiedArchive(input.outputPath);
  const archive = verified.archive;
  const compressedPath = `${input.outputPath}.gz`;
  const summaryPath = `${input.outputPath}.summary.json`;
  if (!existsSync(compressedPath) || !existsSync(summaryPath)) {
    throw new Error(`exploration archive ${input.outputPath} is missing its compressed artifact or summary`);
  }
  const compressedArchiveSha256 = sha256(readFileSync(compressedPath));
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  if (
    summary.archiveSha256 !== verified.archiveSha256 ||
    summary.compressedArchiveSha256 !== compressedArchiveSha256 ||
    readSidecarChecksum(compressedPath) !== compressedArchiveSha256
  ) throw new Error(`exploration archive ${input.outputPath} has inconsistent summary or compressed integrity`);
  if (
    archive.mode !== "development" || archive.profile !== "probe" ||
    archive.exploration?.authority !== "exploration-only" ||
    archive.exploration?.id !== input.explorationId ||
    archive.exploration?.seedBase !== input.seedBase ||
    archive.exploration?.seedsPerBudget !== input.seedsPerBudget ||
    archive.git?.candidateFingerprint !== input.expectedCandidateFingerprint ||
    archive.identity?.seedSchedule?.seedBase !== input.seedBase ||
    archive.identity?.seedSchedule?.seedsPerBudget !== input.seedsPerBudget ||
    !Number.isFinite(archive.canonicalHeadline)
  ) {
    throw new Error(`exploration archive ${input.outputPath} does not match its frozen arm`);
  }
  return {
    archive: relativeToCwd(input.outputPath),
    archiveSha256: verified.archiveSha256,
    compressedArchiveSha256,
    candidateFingerprint: input.expectedCandidateFingerprint,
    headline: archive.canonicalHeadline,
  };
}

export function buildFamilyReport(
  family: BenchmarkFamily,
  round: FamilyRound,
  archiveLoader: (path: string) => any = (path) => loadVerifiedArchive(path).archive,
): FamilyReport {
  if (round.baselineRun === null || round.seedBase === null || round.seedsPerBudget === null) {
    throw new Error(`family round is missing its frozen baseline or seed schedule`);
  }
  const sources = resolveSources(loadSourceManifest(SOURCE_MANIFEST));
  const suite = loadSuiteManifest(SUITE_MANIFEST, sources);
  const identity = suiteIdentity(SUITE_MANIFEST, SOURCE_MANIFEST, sources);
  if (identity.suiteFingerprint !== family.baseline.suiteFingerprint) throw new Error(`family suite is stale`);
  const exploratorySuite = suiteAtProbeDepth(suite, round.seedsPerBudget);
  const baselineArchive = archiveLoader(round.baselineRun.archive);
  const baselineRuns = decisionRuns(baselineArchive);
  const variantArchives = new Map(round.variants.map((variant) => {
    const reference = round.variantRuns[variant.id];
    if (reference === undefined) throw new Error(`variant ${variant.id} has no completed archive`);
    return [variant.id, archiveLoader(reference.archive)] as const;
  }));
  const comparisons = new Map<string, V2Decision>();
  const reports = round.variants.map((variant): VariantReport => {
    const runs = decisionRuns(variantArchives.get(variant.id));
    const decision = pairedV2DecisionForCalibration(baselineRuns, runs, exploratorySuite, {
      profile: "probe",
      mode: "improvement",
      bootstrapSeed: 0,
    });
    comparisons.set(variant.id, decision);
    return variantReport(variant.id, baselineRuns, runs, decision);
  }).sort((a, b) => b.headline - a.headline || a.variantId.localeCompare(b.variantId));
  const observedChampionId = reports[0].variantId;
  const allRuns = new Map(round.variants.map((variant) =>
    [variant.id, decisionRuns(variantArchives.get(variant.id))] as const
  ));
  const pairwise: PairwiseReport[] = [];
  for (let leftIndex = 0; leftIndex < reports.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < reports.length; rightIndex++) {
      const left = reports[leftIndex].variantId;
      const right = reports[rightIndex].variantId;
      pairwise.push(pairwiseReport(
        left,
        right,
        allRuns.get(left)!,
        allRuns.get(right)!,
        exploratorySuite,
      ));
    }
  }
  const seedsPerBudget = round.seedsPerBudget;
  const prefixes = [...new Set([2, Math.min(4, seedsPerBudget), seedsPerBudget])]
    .filter((depth) => depth <= seedsPerBudget)
    .sort((a, b) => a - b);
  const prefixRankings = prefixes.map((depth) => {
    const prefixSuite = suiteAtProbeDepth(suite, depth);
    const base = baselineRuns.filter((run) => run.seedSlot < depth);
    return {
      seedsPerBudget: depth,
      ranking: round.variants.map((variant) => {
        const decision = pairedV2DecisionForCalibration(
          base,
          allRuns.get(variant.id)!.filter((run) => run.seedSlot < depth),
          prefixSuite,
          { profile: "probe", mode: "improvement", bootstrapSeed: 0 },
        );
        return { variantId: variant.id, headline: decision.candidateHeadline };
      }).sort((a, b) => b.headline - a.headline || a.variantId.localeCompare(b.variantId)),
    };
  });
  const rankingReversals = prefixRankings
    .filter((prefix) => prefix.ranking[0].variantId !== observedChampionId)
    .map((prefix) => {
      const leader = prefix.ranking[0].variantId;
      const prefixSuite = suiteAtProbeDepth(suite, prefix.seedsPerBudget);
      const decision = pairedV2DecisionForCalibration(
        allRuns.get(leader)!.filter((run) => run.seedSlot < prefix.seedsPerBudget),
        allRuns.get(observedChampionId)!.filter((run) => run.seedSlot < prefix.seedsPerBudget),
        prefixSuite,
        { profile: "probe", mode: "improvement", bootstrapSeed: 0 },
      );
      return {
        seedsPerBudget: prefix.seedsPerBudget,
        observedLeaderId: leader,
        finalChampionId: observedChampionId,
        finalChampionDelta: decision.delta,
        largestCaseAdvantages: [...decision.perCase]
          .sort((a, b) => b.delta - a.delta)
          .slice(0, 5)
          .map(({ sourceId, delta }) => ({ sourceId, delta })),
      };
    });
  return {
    schema: FAMILY_REPORT_SCHEMA,
    protocol: FAMILY_PROTOCOL,
    authority: "exploration-only",
    statement:
      "Observed rankings are selection-biased development evidence, not promotion decisions. " +
      "Qualification was not run; any chosen member must be source-baked and requires a fresh certified eval epoch.",
    family: family.name,
    round: round.number,
    generatedAt: new Date().toISOString(),
    baselineLabel: family.baseline.label,
    suiteFingerprint: family.baseline.suiteFingerprint,
    baselineContract: {
      inferenceFingerprint: family.baseline.inferenceFingerprint,
      protocolFingerprint: family.baseline.protocolFingerprint,
      calibrationFingerprint: family.baseline.calibrationFingerprint,
    },
    seedSchedule: {
      seedBase: round.seedBase,
      seedsPerBudget,
      budgets: [...suite.profiles.probe.budgets],
    },
    observedChampionId,
    championStableAcrossPrefixes: prefixRankings.every((prefix) => prefix.ranking[0].variantId === observedChampionId),
    ranking: reports,
    pairwise,
    prefixRankings,
    rankingReversals,
    archives: { baseline: round.baselineRun, variants: round.variantRuns },
    reportPath: round.reportPath,
  };
}

function variantReport(
  variantId: string,
  baselineRuns: DecisionRun[],
  candidateRuns: DecisionRun[],
  decision: V2Decision,
): VariantReport {
  return {
    variantId,
    headline: decision.candidateHeadline,
    delta: decision.delta,
    standardError: decision.confidence.standardError,
    degreesOfFreedom: decision.confidence.degreesOfFreedom,
    oneSidedLevel: decision.confidence.oneSidedLevel,
    oneSidedCriticalLevel: decision.confidence.oneSidedCriticalLevel,
    lowerBound: decision.confidence.lowerBound,
    upperBound: decision.confidence.upperBound,
    baseValid: decision.validity.baseValid,
    candidateValid: decision.validity.candidateValid,
    validityGained: decision.validity.gained,
    validityLost: decision.validity.lost,
    scoreIdenticalFraction: identicalFraction(baselineRuns, candidateRuns),
    pairedCorrelation: pairedCorrelation(baselineRuns, candidateRuns),
    perStratum: decision.perStratum.map((entry) => ({
      stratum: entry.stratum,
      delta: entry.delta,
      baseValid: entry.baseValid,
      candidateValid: entry.candidateValid,
    })),
    largestCaseGains: [...decision.perCase].sort((a, b) => b.delta - a.delta).slice(0, 5)
      .map(({ sourceId, delta }) => ({ sourceId, delta })),
    largestCaseLosses: [...decision.perCase].sort((a, b) => a.delta - b.delta).slice(0, 5)
      .map(({ sourceId, delta }) => ({ sourceId, delta })),
  };
}

function pairwiseReport(
  left: string,
  right: string,
  leftRuns: DecisionRun[],
  rightRuns: DecisionRun[],
  suite: SuiteManifest,
): PairwiseReport {
  const decision = pairedV2DecisionForCalibration(leftRuns, rightRuns, suite, {
    profile: "probe",
    mode: "improvement",
    bootstrapSeed: 0,
  });
  return {
    leftVariantId: left,
    rightVariantId: right,
    deltaRightMinusLeft: decision.delta,
    standardError: decision.confidence.standardError,
    degreesOfFreedom: decision.confidence.degreesOfFreedom,
    oneSidedLevel: decision.confidence.oneSidedLevel,
    oneSidedCriticalLevel: decision.confidence.oneSidedCriticalLevel,
    lowerBound: decision.confidence.lowerBound,
    upperBound: decision.confidence.upperBound,
    scoreIdenticalFraction: identicalFraction(leftRuns, rightRuns),
    pairedCorrelation: pairedCorrelation(leftRuns, rightRuns),
  };
}

function decisionRuns(archive: any): DecisionRun[] {
  if (archive.exploration?.authority !== "exploration-only" || !Array.isArray(archive.runs)) {
    throw new Error(`family reports require exploration-only archives`);
  }
  return archive.runs.map((row: any) => ({
    sourceId: row.task.sourceId,
    budget: row.task.budget,
    seedSlot: row.task.seedSlot,
    actualSeed: row.task.actualSeed,
    score: { score: row.score.score, valid: row.score.valid },
  }));
}

function suiteAtProbeDepth(suite: SuiteManifest, depth: number): SuiteManifest {
  const clone = structuredClone(suite);
  clone.profiles.probe.seeds_per_budget = depth;
  return clone;
}

function identicalFraction(left: DecisionRun[], right: DecisionRun[]): number {
  const rightByCell = new Map(right.map((run) => [runKey(run), run]));
  const identical = left.filter((run) => {
    const candidate = rightByCell.get(runKey(run));
    return candidate !== undefined && candidate.score.score === run.score.score && candidate.score.valid === run.score.valid;
  }).length;
  return round6(identical / left.length);
}

function pairedCorrelation(left: DecisionRun[], right: DecisionRun[]): number | null {
  const rightByCell = new Map(right.map((run) => [runKey(run), run.score.score]));
  const pairs = left.map((run) => [run.score.score, rightByCell.get(runKey(run))] as const)
    .filter((pair): pair is readonly [number, number] => pair[1] !== undefined);
  const leftMean = mean(pairs.map((pair) => pair[0]));
  const rightMean = mean(pairs.map((pair) => pair[1]));
  const numerator = pairs.reduce((sum, pair) => sum + (pair[0] - leftMean) * (pair[1] - rightMean), 0);
  const leftScale = Math.sqrt(pairs.reduce((sum, pair) => sum + (pair[0] - leftMean) ** 2, 0));
  const rightScale = Math.sqrt(pairs.reduce((sum, pair) => sum + (pair[1] - rightMean) ** 2, 0));
  if (leftScale === 0 || rightScale === 0) return null;
  return round6(numerator / (leftScale * rightScale));
}

export async function allocateExplorationSeedEpoch(
  root: string,
  family: string,
  round: number,
  seedCount: number,
): Promise<{ seedBase: number }> {
  if (!Number.isSafeInteger(seedCount) || seedCount < 1 || seedCount >= EXPLORATION_SEED_MAX - EXPLORATION_SEED_MIN) {
    throw new Error(`exploration seed count must be a positive integer smaller than the reserved range`);
  }
  const ledgerPath = resolve(root, "seed-ledger.json");
  return withFileLock(`${ledgerPath}.lock`, async () => {
    const ledger: SeedLedger = existsSync(ledgerPath)
      ? JSON.parse(readFileSync(ledgerPath, "utf8"))
      : { schema: SEED_LEDGER_SCHEMA, allocations: [] };
    if (ledger.schema !== SEED_LEDGER_SCHEMA || !Array.isArray(ledger.allocations)) {
      throw new Error(`unsupported exploration seed ledger`);
    }
    const existing = ledger.allocations.find((entry) => entry.family === family && entry.round === round);
    if (existing !== undefined) {
      if (existing.seedCount !== seedCount) {
        throw new Error(`exploration epoch ${family}/round-${round} was already allocated at a different depth`);
      }
      return { seedBase: existing.seedBase };
    }
    for (let attempt = 0; attempt < 1_000; attempt++) {
      const range = EXPLORATION_SEED_MAX - EXPLORATION_SEED_MIN - seedCount;
      const seedBase = EXPLORATION_SEED_MIN + randomBytes(4).readUInt32LE(0) % range;
      const overlaps = ledger.allocations.some((entry) =>
        seedBase < entry.seedBase + entry.seedCount && entry.seedBase < seedBase + seedCount
      );
      if (overlaps) continue;
      ledger.allocations.push({ family, round, seedBase, seedCount, allocatedAt: new Date().toISOString() });
      writeFileAtomicDurable(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
      return { seedBase };
    }
    throw new Error(`unable to allocate a fresh exploration seed epoch`);
  }, { waitForLiveOwner: true });
}

function newFamily(name: string, baseline: ReturnType<typeof readBaselineContract>): BenchmarkFamily {
  return {
    schema: FAMILY_SCHEMA,
    protocol: FAMILY_PROTOCOL,
    name,
    createdAt: new Date().toISOString(),
    baseline: {
      label: baseline.label,
      suiteFingerprint: baseline.suiteFingerprint,
      candidateFingerprint: baseline.candidateFingerprint,
      inferenceFingerprint: baseline.inferenceFingerprint,
      protocolFingerprint: baseline.protocolFingerprint,
      calibrationFingerprint: baseline.calibrationFingerprint,
      snapshot: baseline.compilerSnapshot,
    },
    rounds: [{
      number: 1,
      status: "draft",
      createdAt: new Date().toISOString(),
      frozenAt: null,
      variants: [],
      seedBase: null,
      seedsPerBudget: null,
      baselineRun: null,
      variantRuns: {},
      reportPath: null,
      observedChampionId: null,
      selectedVariantId: null,
      selectedAt: null,
      selectionReason: null,
    }],
  };
}

function assertFamilyCurrent(family: BenchmarkFamily, baseline: ReturnType<typeof readBaselineContract>): void {
  if (
    family.baseline.label !== baseline.label ||
    family.baseline.candidateFingerprint !== baseline.candidateFingerprint ||
    family.baseline.suiteFingerprint !== baseline.suiteFingerprint ||
    family.baseline.inferenceFingerprint !== baseline.inferenceFingerprint ||
    family.baseline.protocolFingerprint !== baseline.protocolFingerprint ||
    family.baseline.calibrationFingerprint !== baseline.calibrationFingerprint
  ) {
    throw new Error(`family ${family.name} belongs to an older production baseline or suite; start a new family`);
  }
  validateCompilerSnapshot(family.baseline.snapshot);
}

/**
 * A family is explicitly exploratory: it compares immutable compiler
 * snapshots on one fresh shared epoch and cannot promote a candidate. A
 * protocol-only workflow repair must not strand such a round. Inference and
 * calibration changes do alter the reported estimates, so they remain a hard
 * boundary; promotion still goes through the stricter eval contract.
 */
export function assertExplorationDecisionSemantics(
  baseline: BaselineContract,
  current: ReturnType<typeof requireCurrentDecisionCalibration>,
): void {
  if (
    baseline.inferenceFingerprint !== current.inferenceFingerprint ||
    baseline.calibrationFingerprint !== current.calibrationFingerprint
  ) {
    throw new Error(`family exploration inference or calibration changed; start a new family`);
  }
}

export function readBenchmarkFamily(path: string): BenchmarkFamily {
  const family = JSON.parse(readFileSync(path, "utf8")) as BenchmarkFamily;
  if (
    family.schema !== FAMILY_SCHEMA || family.protocol !== FAMILY_PROTOCOL || !validId(family.name) ||
    !Array.isArray(family.rounds) || family.rounds.length === 0
  ) throw new Error(`unsupported or malformed family state at ${path}`);
  if (
    typeof family.baseline.label !== "string" || family.baseline.label.trim() === "" ||
    !isFingerprint(family.baseline.suiteFingerprint) ||
    !isFingerprint(family.baseline.candidateFingerprint) ||
    !isFingerprint(family.baseline.inferenceFingerprint) ||
    !isFingerprint(family.baseline.protocolFingerprint) ||
    !isFingerprint(family.baseline.calibrationFingerprint) ||
    family.baseline.snapshot.candidateFingerprint !== family.baseline.candidateFingerprint
  ) throw new Error(`malformed family baseline contract at ${path}`);
  validateCompilerSnapshot(family.baseline.snapshot);
  for (const [index, round] of family.rounds.entries()) {
    if (
      round.number !== index + 1 || !["draft", "running", "completed", "selected"].includes(round.status) ||
      !Array.isArray(round.variants) || round.variants.length > MAX_VARIANTS
    ) {
      throw new Error(`malformed family round ${index + 1}`);
    }
    if (index < family.rounds.length - 1 && round.status !== "selected") {
      throw new Error(`only a selected family round may have a successor`);
    }
    const variantIds = new Set<string>();
    const variantFingerprints = new Set<string>();
    for (const variant of round.variants) {
      if (
        !validId(variant.id) || variantIds.has(variant.id) || variantFingerprints.has(variant.candidateFingerprint) ||
        !isFingerprint(variant.candidateFingerprint) ||
        variant.candidateFingerprint !== variant.snapshot.candidateFingerprint
      ) {
        throw new Error(`malformed family variant in round ${round.number}`);
      }
      variantIds.add(variant.id);
      variantFingerprints.add(variant.candidateFingerprint);
      validateCompilerSnapshot(variant.snapshot);
      const reference = round.variantRuns[variant.id];
      if (reference !== undefined && reference.candidateFingerprint !== variant.candidateFingerprint) {
        throw new Error(`variant ${variant.id} run does not match its captured snapshot`);
      }
    }
    if (
      round.baselineRun !== null &&
      round.baselineRun.candidateFingerprint !== family.baseline.candidateFingerprint
    ) throw new Error(`round ${round.number} baseline run does not match the baseline snapshot`);
    validateRoundState(round, variantIds);
    if (index > 0) {
      const previous = family.rounds[index - 1];
      const carried = round.variants.filter((variant) => variant.carriedFromRound !== null);
      if (
        carried.length !== 1 || carried[0].carriedFromRound !== previous.number ||
        carried[0].id !== previous.selectedVariantId ||
        carried[0].candidateFingerprint !== previous.variants.find(
          (variant) => variant.id === previous.selectedVariantId,
        )?.candidateFingerprint
      ) throw new Error(`round ${round.number} does not carry exactly the prior selected variant`);
    }
  }
  return family;
}

function validateRoundState(round: FamilyRound, variantIds: Set<string>): void {
  const hasSchedule = Number.isSafeInteger(round.seedBase) && (round.seedBase ?? 0) >= EXPLORATION_SEED_MIN &&
    Number.isSafeInteger(round.seedsPerBudget) && (round.seedsPerBudget ?? 0) >= 2 &&
    (round.seedsPerBudget ?? Infinity) <= 16;
  const runIds = Object.keys(round.variantRuns);
  if (runIds.some((id) => !variantIds.has(id))) throw new Error(`round ${round.number} has an unknown variant run`);
  for (const [id, reference] of Object.entries(round.variantRuns)) validateRunReference(reference, id);
  if (round.baselineRun !== null) validateRunReference(round.baselineRun, "baseline");
  if (round.status === "draft") {
    if (
      round.seedBase !== null || round.seedsPerBudget !== null || round.baselineRun !== null || runIds.length > 0 ||
      round.reportPath !== null || round.observedChampionId !== null || round.selectedVariantId !== null
    ) throw new Error(`draft round ${round.number} contains frozen or observed evidence`);
    return;
  }
  if (!hasSchedule || round.frozenAt === null || round.variants.length < 2) {
    throw new Error(`frozen round ${round.number} has no complete schedule or variant set`);
  }
  if (round.status === "running") {
    if (
      round.reportPath !== null || round.observedChampionId !== null || round.selectedVariantId !== null ||
      round.selectedAt !== null || round.selectionReason !== null
    ) throw new Error(`running round ${round.number} contains a report or selection`);
    return;
  }
  if (
    round.baselineRun === null || runIds.length !== round.variants.length ||
    round.variants.some((variant) => round.variantRuns[variant.id] === undefined) ||
    round.reportPath === null || !existsSync(resolve(round.reportPath)) ||
    !variantIds.has(round.observedChampionId ?? "")
  ) throw new Error(`completed round ${round.number} is missing evidence`);
  if (round.status === "completed") {
    if (round.selectedVariantId !== null || round.selectedAt !== null || round.selectionReason !== null) {
      throw new Error(`completed round ${round.number} contains a selection`);
    }
    return;
  }
  if (
    !variantIds.has(round.selectedVariantId ?? "") || round.selectedAt === null ||
    round.selectionReason === null || round.selectionReason.trim() === ""
  ) throw new Error(`selected round ${round.number} has an incomplete selection`);
}

function validateRunReference(reference: FamilyRunReference, label: string): void {
  if (
    typeof reference.archive !== "string" || reference.archive === "" ||
    !isFingerprint(reference.archiveSha256) || !isFingerprint(reference.compressedArchiveSha256) ||
    !isFingerprint(reference.candidateFingerprint) || !Number.isFinite(reference.headline)
  ) throw new Error(`malformed ${label} run reference`);
}

function writeFamily(path: string, family: BenchmarkFamily): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileAtomicDurable(path, `${JSON.stringify(family, null, 2)}\n`);
}

async function withFileLock<T>(
  path: string,
  callback: () => Promise<T>,
  options: { waitForLiveOwner?: boolean } = {},
): Promise<T> {
  mkdirSync(dirname(path), { recursive: true });
  const owner = {
    pid: process.pid,
    processStart: processStart(process.pid),
    token: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for family lock ${path}`);
    if (recoveryClaimActive(path)) {
      await sleep(LOCK_WAIT_MS);
      continue;
    }
    try {
      writeFileSync(path, `${JSON.stringify(owner)}\n`, { flag: "wx" });
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const observed = readLockOwner(path);
    if (observed !== null && lockOwnerAlive(observed)) {
      if (options.waitForLiveOwner) {
        await sleep(LOCK_WAIT_MS);
        continue;
      }
      throw new Error(`family state is locked by another live process`);
    }
    if (observed === null && lockRecentlyCreated(path)) {
      throw new Error(`family state has a recent malformed lock; retry after ${MALFORMED_LOCK_GRACE_MS}ms`);
    }
    const claim = { ...owner, token: randomUUID(), createdAt: new Date().toISOString() };
    const claimPath = `${path}.claim-${process.pid}-${claim.token}`;
    writeFileSync(claimPath, `${JSON.stringify(claim)}\n`, { flag: "wx" });
    try {
      const current = readLockOwner(path);
      if (current !== null && lockOwnerAlive(current)) {
        throw new Error(`family state is locked by another live process`);
      }
      if (current === null && lockRecentlyCreated(path)) {
        throw new Error(`family state has a recent malformed lock; retry after ${MALFORMED_LOCK_GRACE_MS}ms`);
      }
      rmSync(path, { force: true });
    } finally {
      rmSync(claimPath, { force: true });
    }
  }
  try {
    return await callback();
  } finally {
    if (readLockOwner(path)?.token === owner.token) rmSync(path, { force: true });
  }
}

type FamilyLockOwner = {
  pid: number;
  processStart: string | null;
  token: string;
  createdAt: string;
};

function recoveryClaimActive(lockPath: string): boolean {
  const prefix = `${lockPath.split("/").at(-1)!}.claim-`;
  let active = false;
  for (const entry of readdirSync(dirname(lockPath))) {
    if (!entry.startsWith(prefix)) continue;
    const claimPath = resolve(dirname(lockPath), entry);
    const owner = readLockOwner(claimPath);
    if (owner !== null && lockOwnerAlive(owner)) active = true;
    else if (owner === null && lockRecentlyCreated(claimPath)) active = true;
    else rmSync(claimPath, { force: true });
  }
  return active;
}

function readLockOwner(path: string): FamilyLockOwner | null {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as Partial<FamilyLockOwner>;
    if (
      !Number.isSafeInteger(value.pid) || (value.pid ?? 0) <= 0 ||
      typeof value.token !== "string" || typeof value.createdAt !== "string" ||
      !(typeof value.processStart === "string" || value.processStart === null)
    ) return null;
    return value as FamilyLockOwner;
  } catch {
    return null;
  }
}

function lockOwnerAlive(owner: FamilyLockOwner): boolean {
  try {
    process.kill(owner.pid, 0);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
  const currentStart = processStart(owner.pid);
  return owner.processStart === null || currentStart === null || owner.processStart === currentStart;
}

function lockRecentlyCreated(path: string): boolean {
  try {
    return Date.now() - statSync(path).mtimeMs < MALFORMED_LOCK_GRACE_MS;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function processStart(pid: number): string | null {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    return stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/)[19] ?? null;
  } catch {
    return null;
  }
}

function renderFamilyResult(result: Record<string, any>): string {
  if (result.schema === FAMILY_REPORT_SCHEMA) {
    const lines = [
      `Family ${result.family}, round ${result.round} (exploration only)`,
      `  shared fresh seeds: base ${result.seedSchedule.seedBase}, ${result.seedSchedule.seedsPerBudget}/budget`,
      `  observed champion: ${result.observedChampionId}`,
      `  stable across prefixes: ${result.championStableAcrossPrefixes ? "yes" : "no"}`,
    ];
    for (const variant of result.ranking) {
      lines.push(
        `  ${variant.variantId}: ${variant.headline.toFixed(2)} (${signed(variant.delta)} vs baseline, ` +
        `SE ${variant.standardError.toFixed(2)}, valid ${variant.candidateValid}, identical ${(variant.scoreIdenticalFraction * 100).toFixed(1)}%)`,
      );
    }
    lines.push(
      `  report: ${result.reportPath}`,
      `  warning: ${result.statement}`,
      `  nextCommand: restore one captured source implementation, then ` +
        `npm run benchmark -- family select ${result.family} --variant=<id>`,
    );
    return lines.join("\n");
  }
  return [
    `family ${result.family} round ${result.round}: ${result.status} ${result.variant ?? ""}`.trim(),
    ...(result.candidateFingerprint === undefined ? [] : [`  fingerprint: ${result.candidateFingerprint}`]),
    ...(result.statement === undefined ? [] : [`  ${result.statement}`]),
    `  nextCommand: ${result.nextCommand}`,
  ].join("\n");
}

function argumentReader(argv: string[]): (name: string) => string | undefined {
  return (name) => argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function validateFamilyArguments(action: "capture" | "run" | "select", argv: string[]): void {
  const positional = argv.filter((value) => !value.startsWith("--"));
  if (positional.length !== 2) throw new Error(`family ${action} expects exactly NAME as its positional argument`);
  const common = new Set(["family-root", "json"]);
  const byAction = {
    capture: new Set(["variant", "note"]),
    run: new Set(["seeds", "jobs"]),
    select: new Set(["variant", "reason"]),
  }[action];
  for (const value of argv.filter((entry) => entry.startsWith("--"))) {
    const name = value.slice(2).split("=", 1)[0];
    if (!common.has(name) && !byAction.has(name)) throw new Error(`unknown family ${action} option --${name}`);
    if (name !== "json" && !value.includes("=")) throw new Error(`family options use --name=value syntax: ${value}`);
    if (name === "json" && value !== "--json") throw new Error(`--json does not take a value`);
  }
}

function validId(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value);
}

function isFingerprint(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function runKey(run: DecisionRun): string {
  return `${run.sourceId}\0${run.budget}\0${run.seedSlot}\0${run.actualSeed}`;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function readSidecarChecksum(path: string): string | null {
  try {
    const checksum = readFileSync(`${path}.sha256`, "utf8").trim().split(/\s+/, 1)[0];
    return isFingerprint(checksum) ? checksum : null;
  } catch {
    return null;
  }
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function relativeToCwd(path: string): string {
  const prefix = `${process.cwd()}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}
