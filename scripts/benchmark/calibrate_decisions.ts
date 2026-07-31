import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { benchmarkDecisionPolicy } from "../../benchmark/v2/decision-policy.ts";
import {
  DECISION_INFERENCE_PROTOCOL_FINGERPRINT,
  pairedV2Decision,
  pairedV2DecisionForCalibration,
  v2HeadlineForDecisionRuns,
  type DecisionProfile,
  type DecisionRun,
} from "../v0/benchmark_v2/decision_model.ts";
import { loadSourceManifest, resolveSources } from "../v0/benchmark_v2/model.ts";
import {
  canonicalMembers,
  loadSuiteManifest,
  resolvedSeedSchedule,
  suiteIdentity,
  type SuiteManifest,
} from "../v0/benchmark_v2/suite_model.ts";
import { assertDecisionCoverageAdequate } from "../v0/benchmark_v2/calibration_guard.ts";
import { argumentReader, mean, round, sha256 } from "../v0/benchmark_v2/util.ts";

const argument = argumentReader(process.argv.slice(2));

const outPath = resolve(argument("out") ?? "benchmark/v2/studies/decision-calibration.json");
const markdownPath = resolve(argument("markdown") ?? "docs/benchmark-v2-decision-calibration.md");
const trials = integerArgument("trials", 200, 20);
const iterations = integerArgument("iterations", 100, 100);
const sourcePath = "benchmark/v2/compat/source-manifest.json";
const suitePath = "benchmark/v2/compat/suite-manifest.json";
const sources = resolveSources(loadSourceManifest(sourcePath));
const suite = loadSuiteManifest(suitePath, sources);
const identity = suiteIdentity(suitePath, sourcePath, sources);
const coverageStudyPath = "benchmark/v2/studies/decision-coverage.json";
if (!existsSync(coverageStudyPath)) throw new Error(`required decision coverage study is missing`);
const coverageStudyBytes = readFileSync(coverageStudyPath);
const coverageStudy = JSON.parse(coverageStudyBytes.toString("utf8"));
if (
  coverageStudy.schema !== "line.benchmark-v2.decision-coverage-study.v3" ||
  coverageStudy.suiteFingerprint !== identity.suiteFingerprint ||
  coverageStudy.decisionInferenceFingerprint !== DECISION_INFERENCE_PROTOCOL_FINGERPRINT ||
  !Array.isArray(coverageStudy.powerResults) || coverageStudy.powerResults.length === 0 ||
  !Array.isArray(coverageStudy.safetyResults) || coverageStudy.safetyResults.length === 0 ||
  !Array.isArray(coverageStudy.diagnosticResults) || coverageStudy.diagnosticResults.length === 0
) {
  throw new Error(`decision coverage study is stale for the current suite`);
}
assertDecisionCoverageAdequate(coverageStudy);
const coverageReferenceBytes = readFileSync(coverageStudy.reference);
if (createHash("sha256").update(coverageReferenceBytes).digest("hex") !== coverageStudy.referenceArtifactSha256) {
  throw new Error(`decision coverage reference is missing or stale`);
}
const scorerBoundReference = loadScorerBoundReference(coverageStudy, coverageReferenceBytes);

const controls = {
  identical: empiricalControl(
    scorerBoundReference,
    "identity: the same scorer-bound rows are paired byte-for-byte",
    (row) => row.score,
  ),
  knownBroadDegradation: empiricalControl(
    scorerBoundReference,
    "deterministic broad degradation: subtract 100 points from every valid scorer-bound row",
    (row) => row.score.valid
      ? { score: Math.max(0, row.score.score - 100), valid: true }
      : { score: row.score.score, valid: false },
  ),
  impactContractFailure: empiricalControl(
    scorerBoundReference,
    "deterministic impact contract failure: hard-zero every row whose current score carries an impact component",
    (row) => row.score.components?.impact === undefined
      ? { score: row.score.score, valid: row.score.valid }
      : { score: 0, valid: false },
  ),
  correlatedSeedAdversary: correlatedSeedControl(),
};

const simulations = (["probe", "canonical"] as const).flatMap((profile) => [
  simulate(profile, "null", 0),
  simulate(profile, "small_gain", 5),
  simulate(profile, "clear_gain", 15),
  simulate(profile, "small_regression", -5),
]);

const report = {
  schema: "line.benchmark-v2.decision-calibration.v3",
  generatedAt: new Date().toISOString(),
  suiteFingerprint: identity.suiteFingerprint,
  decisionInferenceFingerprint: DECISION_INFERENCE_PROTOCOL_FINGERPRINT,
  policy: benchmarkDecisionPolicy,
  simulation: {
    trials,
    sensitivityBootstrapIterationsPerTrial: 0,
    configuredSensitivityIterations: iterations,
    design: "Repeated seed schedules for one fixed catalog: shared budget seed-block SD 12 and parent x seed interaction SD 4. Gain/regression scenarios use one fixed heterogeneous parent-effect pattern (SD 12); the null has exactly zero catalog effect.",
    note: "Repeated-sampling trials skip sensitivity bootstraps because they cannot affect the formal gate. Production decisions still use the policy's full sensitivity iteration count.",
  },
  empiricalControlPolicy:
    "Scorer-bound controls are deterministic transformations of the fresh checksummed canonical decision index. The index is cryptographically bound to its retained raw archive and carries the current scoring-protocol and suite identities; no old-ruler scores are reused or relabeled.",
  scorerBoundReference: {
    path: coverageStudy.reference,
    sha256: coverageStudy.referenceArtifactSha256,
    rawArchiveSha256: coverageStudy.referenceRawSha256,
    candidateFingerprint: coverageStudy.referenceCandidateFingerprint,
    profile: "canonical",
    budgets: coverageStudy.scope.budgets,
    seedsPerBudget: coverageStudy.scope.availableSeedsPerBudget,
  },
  controls,
  coverageStudy: {
    path: coverageStudyPath,
    sha256: createHash("sha256").update(coverageStudyBytes).digest("hex"),
    trials: coverageStudy.trials,
    results: coverageStudy.results,
    powerResults: coverageStudy.powerResults,
    safetyResults: coverageStudy.safetyResults,
    diagnosticResults: coverageStudy.diagnosticResults,
  },
  simulations,
};

write(outPath, `${JSON.stringify(report, null, 2)}\n`);
write(markdownPath, renderMarkdown(report));
console.log(renderMarkdown(report));

function empiricalControl(
  reference: ScorerBoundReference,
  derivation: string,
  transform: (row: any) => { score: number; valid: boolean },
): Record<string, unknown> {
  const base = reference.rows.map(decisionRun);
  const candidate = reference.rows.map((row) => ({
    ...decisionRun(row),
    score: transform(row),
  }));
  const decision = pairedV2Decision(base, candidate, reference.suite, {
    profile: "canonical",
    mode: "improvement",
    iterations: 5_000,
    bootstrapSeed: 0x51a7,
  });
  return {
    available: true,
    referenceDecisionIndex: reference.path,
    referenceDecisionIndexSha256: reference.sha256,
    referenceRawArchiveSha256: reference.rawArchiveSha256,
    derivation,
    delta: decision.delta,
    centralInterval: [decision.confidence.centralLo, decision.confidence.centralHi],
    lowerBound: decision.confidence.lowerBound,
    upperBound: decision.confidence.upperBound,
    outcome: decision.outcome,
  };
}

type ScorerBoundReference = {
  path: string;
  sha256: string;
  rawArchiveSha256: string;
  rows: any[];
  suite: SuiteManifest;
};

function loadScorerBoundReference(coverage: any, bytes: Buffer): ScorerBoundReference {
  const index = JSON.parse(bytes.toString("utf8"));
  const archive = index.archive;
  if (
    coverage.referenceKind !== "scorer-bound-decision-index" ||
    index.schema !== "line.benchmark-v2.decision-index.v1" ||
    index.payloadSha256 !== sha256(JSON.stringify(archive)) ||
    index.archiveSha256 !== coverage.referenceRawSha256 ||
    archive?.schema !== "line.benchmark-v2.run-archive.v5" ||
    archive?.mode !== "development" ||
    archive?.profile !== "canonical" ||
    archive?.identity?.engine !== "wasm" ||
    archive?.identity?.suiteFingerprint !== identity.suiteFingerprint ||
    archive?.identity?.scoringProtocolFingerprint !== identity.scoringProtocolFingerprint ||
    archive?.git?.candidateFingerprint !== coverage.referenceCandidateFingerprint ||
    JSON.stringify(archive?.identity?.budgets) !== JSON.stringify(coverage.scope?.budgets) ||
    archive?.identity?.seedSchedule?.seedsPerBudget !== coverage.scope?.availableSeedsPerBudget ||
    !Array.isArray(archive?.runs) ||
    archive.runs.some((row: any) =>
      row.status !== "ok" ||
      row.score?.schema !== "line.benchmark-v2.run-score.v2" ||
      typeof row.score?.score !== "number" ||
      typeof row.score?.valid !== "boolean"
    )
  ) throw new Error(`decision calibration requires the fresh scorer-bound canonical decision index`);
  return {
    path: coverage.reference,
    sha256: coverage.referenceArtifactSha256,
    rawArchiveSha256: coverage.referenceRawSha256,
    rows: archive.runs,
    suite: suiteForCampaignScope(suite, coverage.scope.budgets, coverage.scope.availableSeedsPerBudget),
  };
}

function decisionRun(row: any): DecisionRun {
  return {
    sourceId: row.task.sourceId,
    budget: row.task.budget,
    seedSlot: row.task.seedSlot,
    actualSeed: row.task.actualSeed,
    score: { score: row.score.score, valid: row.score.valid },
  };
}

function suiteForCampaignScope(
  sourceSuite: SuiteManifest,
  budgets: number[],
  seedsPerBudget: number,
): SuiteManifest {
  if (
    !Array.isArray(budgets) || budgets.length === 0 ||
    budgets.some((budget) => !sourceSuite.profiles.canonical.budgets.includes(budget)) ||
    !Number.isSafeInteger(seedsPerBudget) || seedsPerBudget < 8
  ) throw new Error(`scorer-bound calibration scope is malformed`);
  const cloned = structuredClone(sourceSuite);
  cloned.profiles.canonical.budgets = [...budgets];
  cloned.profiles.canonical.seeds_per_budget = seedsPerBudget;
  const weights = sourceSuite.budget_weights.filter((entry) => budgets.includes(entry.budget));
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  cloned.budget_weights = weights.map((entry) => ({
    budget: entry.budget,
    weight: entry.weight / total,
  }));
  return cloned;
}

function correlatedSeedControl(): Record<string, unknown> {
  const effects = [-10, -10, 30];
  const seedsPerBudget = suite.profiles.probe.seeds_per_budget;
  if (effects.length !== seedsPerBudget) {
    throw new Error(`correlatedSeedControl effects (${effects.length}) must match probe seeds_per_budget (${seedsPerBudget})`);
  }
  const base = syntheticRuns("probe", () => 0);
  const candidate = syntheticRuns("probe", (_parent, _budget, seedSlot) => effects[seedSlot]);
  const decision = pairedV2Decision(base, candidate, suite, {
    profile: "probe",
    mode: "improvement",
    iterations: 5_000,
    bootstrapSeed: 42,
  });
  return {
    design: "Every case shares the same three seed effects [-10,-10,+30]. Independent-cell resampling previously accepted this control.",
    delta: decision.delta,
    centralInterval: [decision.confidence.centralLo, decision.confidence.centralHi],
    lowerBound: decision.confidence.lowerBound,
    upperBound: decision.confidence.upperBound,
    seedOnlyStandardError: decision.uncertainty.seed.standardError,
    outcome: decision.outcome,
  };
}

function simulate(profile: DecisionProfile, scenario: string, shift: number): Record<string, unknown> {
  const random = mulberry32(hashSeed(`${profile}:${scenario}`));
  const parentRandom = mulberry32(hashSeed("fixed-catalog"));
  const rawParentEffects = new Map(parentIds().map((parent) => [
    parent,
    scenario === "null" ? 0 : normal(parentRandom) * 12,
  ]));
  const parentEffects = centerParentEffects(profile, rawParentEffects);
  const outcomes = new Map<string, number>();
  const deltas: number[] = [];
  const trueDeltas: number[] = [];
  const coveredThreshold: boolean[] = [];
  for (let trial = 0; trial < trials; trial++) {
    const schedule = resolvedSeedSchedule(
      suite,
      profile,
      suite.profiles[profile].budgets,
      suite.profiles[profile].seeds_per_budget,
    );
    const seedEffects = new Map<string, number>();
    const interactions = new Map<string, number>();
    for (const { budget, actualSeeds } of schedule.byBudget) {
      for (const [seedSlot] of actualSeeds.entries()) {
        seedEffects.set(`${budget}\0${seedSlot}`, normal(random) * 12);
        for (const parent of parentIds()) {
          interactions.set(`${parent}\0${budget}\0${seedSlot}`, normal(random) * 4);
        }
      }
    }
    const base: DecisionRun[] = [];
    const candidate: DecisionRun[] = [];
    for (const run of syntheticRuns(profile, (parent, budget, seedSlot) => {
      return shift + parentEffects.get(parent)! + seedEffects.get(`${budget}\0${seedSlot}`)! +
        interactions.get(`${parent}\0${budget}\0${seedSlot}`)!;
    }, true)) {
      const delta = run.score.score;
      const pair = symmetricScores(delta);
      base.push({ ...run, score: { score: pair.base, valid: true } });
      candidate.push({ ...run, score: { score: pair.candidate, valid: true } });
    }
    const truth = pairedSyntheticScores(profile, (parent) => shift + parentEffects.get(parent)!);
    const trueDelta = v2HeadlineForDecisionRuns(truth.candidate, suite, profile) -
      v2HeadlineForDecisionRuns(truth.base, suite, profile);
    const decision = pairedV2DecisionForCalibration(base, candidate, suite, {
      profile,
      mode: "improvement",
      iterations,
      bootstrapSeed: 0x9000 + trial,
    });
    outcomes.set(decision.outcome, (outcomes.get(decision.outcome) ?? 0) + 1);
    deltas.push(decision.delta);
    trueDeltas.push(trueDelta);
    coveredThreshold.push(decision.confidence.centralLo <= trueDelta && decision.confidence.centralHi >= trueDelta);
  }
  return {
    profile,
    scenario,
    injectedLogScaleShift: shift,
    meanObservedDelta: round(mean(deltas)),
    meanTrueCatalogDelta: round(mean(trueDeltas)),
    outcomes: Object.fromEntries([...outcomes].map(([outcome, count]) => [outcome, {
      count,
      rate: round(count / trials),
    }])),
    centralIntervalCoverageOfTrueCatalogDelta: round(mean(coveredThreshold.map(Number))),
  };
}

function syntheticRuns(
  profile: DecisionProfile,
  effect: (parentId: string, budget: number, seedSlot: number) => number,
  rawEffect = false,
): DecisionRun[] {
  const parentBySource = new Map(suite.strata.flatMap((stratum) => stratum.groups.flatMap((group) =>
    (group.parents ?? group.members.map((id) => ({ id, members: [id] }))).flatMap((parent) =>
      parent.members.map((sourceId) => [sourceId, parent.id] as const)
    )
  )));
  const schedule = resolvedSeedSchedule(
    suite,
    profile,
    suite.profiles[profile].budgets,
    suite.profiles[profile].seeds_per_budget,
  );
  return schedule.byBudget.flatMap(({ budget, actualSeeds }) => actualSeeds.flatMap((actualSeed, seedSlot) =>
    canonicalMembers(suite).map((sourceId) => {
      const value = effect(parentBySource.get(sourceId)!, budget, seedSlot);
      return {
        sourceId,
        budget,
        seedSlot,
        actualSeed,
        score: { score: rawEffect ? value : 500 + value, valid: true },
      };
    })
  ));
}

function symmetricScores(logScaleDelta: number): { base: number; candidate: number } {
  const center = 501;
  return {
    base: center * Math.exp(-logScaleDelta / (2 * center)) - 1,
    candidate: center * Math.exp(logScaleDelta / (2 * center)) - 1,
  };
}

function pairedSyntheticScores(
  profile: DecisionProfile,
  effect: (parentId: string, budget: number, seedSlot: number) => number,
): { base: DecisionRun[]; candidate: DecisionRun[] } {
  const base: DecisionRun[] = [];
  const candidate: DecisionRun[] = [];
  for (const run of syntheticRuns(profile, effect, true)) {
    const pair = symmetricScores(run.score.score);
    base.push({ ...run, score: { score: pair.base, valid: true } });
    candidate.push({ ...run, score: { score: pair.candidate, valid: true } });
  }
  return { base, candidate };
}

function centerParentEffects(
  profile: DecisionProfile,
  effects: Map<string, number>,
): Map<string, number> {
  if ([...effects.values()].every((value) => value === 0)) return effects;
  const deltaAt = (offset: number): number => {
    const truth = pairedSyntheticScores(profile, (parent) => effects.get(parent)! + offset);
    return v2HeadlineForDecisionRuns(truth.candidate, suite, profile) -
      v2HeadlineForDecisionRuns(truth.base, suite, profile);
  };
  let low = -100;
  let high = 100;
  for (let iteration = 0; iteration < 60; iteration++) {
    const middle = (low + high) / 2;
    if (deltaAt(middle) < 0) low = middle;
    else high = middle;
  }
  const offset = (low + high) / 2;
  return new Map([...effects].map(([parent, value]) => [parent, value + offset]));
}

function parentIds(): string[] {
  return suite.strata.flatMap((stratum) => stratum.groups.flatMap((group) =>
    (group.parents ?? group.members.map((id) => ({ id, members: [id] }))).map((parent) => parent.id)
  ));
}

function renderMarkdown(report: any): string {
  const lines = [
    "# Benchmark V2 Decision Calibration",
    "",
    `Suite: \`${report.suiteFingerprint.slice(0, 16)}\`. Inference rule: \`${report.decisionInferenceFingerprint.slice(0, 16)}\`.`,
    "",
    `Simulation uses ${report.simulation.trials} formal-gate trials per scenario. ` + report.simulation.design,
    "",
    report.simulation.note,
    "",
    "## Scorer-bound controls",
    "",
    report.empiricalControlPolicy,
    "",
    "| Control | Delta | Stress-calibrated interval | One-sided bounds | Outcome |",
    "|---|---:|---:|---:|---|",
    controlRow("identical archive", report.controls.identical),
    controlRow("known broad degradation", report.controls.knownBroadDegradation),
    controlRow("impact contract failure", report.controls.impactContractFailure),
    controlRow("catalog-wide correlated seed adversary", report.controls.correlatedSeedAdversary),
    "",
    "## Repeated-sampling simulation",
    "",
    "| Profile | Scenario | Injected shift | True catalog delta | Mean observed | Positive | Negative | Unresolved | 95% coverage |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ...report.simulations.map((entry: any) => {
      const positive = entry.outcomes.advance ?? entry.outcomes.accept;
      const negative = entry.outcomes.stop ?? entry.outcomes.reject;
      const unresolved = entry.outcomes.unresolved ?? entry.outcomes.inconclusive;
      return `| ${entry.profile} | ${entry.scenario} | ${entry.injectedLogScaleShift.toFixed(1)} | ` +
        `${entry.meanTrueCatalogDelta.toFixed(2)} | ${entry.meanObservedDelta.toFixed(2)} | ` +
        `${formatRate(positive)} | ${formatRate(negative)} | ${formatRate(unresolved)} | ` +
        `${(entry.centralIntervalCoverageOfTrueCatalogDelta * 100).toFixed(1)}% |`;
    }),
    "",
    "## Zero-inflated fixed-catalog stress",
    "",
    `Retained study: \`${report.coverageStudy.path}\` (${report.coverageStudy.trials} trials per cell).`,
    "",
    "| Scenario | Seeds / budget | Coverage target | False accept | False reject |",
    "|---|---:|---:|---:|---:|",
    ...report.coverageStudy.results
      .filter((entry: any) => entry.seedsPerBudget === suite.profiles.canonical.seeds_per_budget)
      .map((entry: any) =>
        `| ${entry.scenario} | ${entry.seedsPerBudget} | ${formatRate(entry.centralCoverage)} | ` +
        `${formatRate(entry.falseAccept)} | ${formatRate(entry.falseReject)} |`
      ),
    "",
    "| Supported alternative | Mode | True delta | Positive | Negative | Unresolved | Coverage |",
    "|---|---|---:|---:|---:|---:|---:|",
    ...report.coverageStudy.powerResults
      .filter((entry: any) => entry.seedsPerBudget === suite.profiles.canonical.seeds_per_budget)
      .map((entry: any) =>
        `| ${entry.scenario} | ${entry.mode}${entry.margin === null ? "" : ` (margin ${entry.margin})`} | ` +
        `${entry.trueDelta.toFixed(2)} | ${formatRate(entry.positiveOutcome)} | ${formatRate(entry.negativeOutcome)} | ` +
        `${formatRate(entry.unresolvedOutcome)} | ${formatRate(entry.centralCoverage)} |`
      ),
    "",
    "| Safety boundary | Mode | True delta | False accept | Negative | Unresolved | Coverage |",
    "|---|---|---:|---:|---:|---:|---:|",
    ...report.coverageStudy.safetyResults
      .filter((entry: any) => entry.seedsPerBudget === suite.profiles.canonical.seeds_per_budget)
      .map((entry: any) =>
        `| ${entry.scenario} | ${entry.mode} (margin ${entry.margin}) | ${entry.trueDelta.toFixed(2)} | ` +
        `${formatRate(entry.positiveOutcome)} | ${formatRate(entry.negativeOutcome)} | ` +
        `${formatRate(entry.unresolvedOutcome)} | ${formatRate(entry.centralCoverage)} |`
      ),
    "",
    "Known low-power hard-zero diagnostics (not supported power claims):",
    "",
    "| Diagnostic | Mode | True delta | Positive | Negative | Unresolved | Coverage |",
    "|---|---|---:|---:|---:|---:|---:|",
    ...report.coverageStudy.diagnosticResults
      .filter((entry: any) => entry.seedsPerBudget === suite.profiles.canonical.seeds_per_budget)
      .map((entry: any) =>
        `| ${entry.scenario} | ${entry.mode}${entry.margin === null ? "" : ` (margin ${entry.margin})`} | ` +
        `${entry.trueDelta.toFixed(2)} | ${formatRate(entry.positiveOutcome)} | ${formatRate(entry.negativeOutcome)} | ` +
        `${formatRate(entry.unresolvedOutcome)} | ${formatRate(entry.centralCoverage)} |`
      ),
    "",
    "The repeated-sampling target is the frozen catalog, not a hypothetical random population of authored works. The formal gate uses the seed-block t interval. Parent-preserving catalog and crossed bootstrap intervals are sensitivity diagnostics only.",
  ];
  return `${lines.join("\n")}\n`;
}

function controlRow(label: string, value: any): string {
  if (value?.available === false) return `| ${label} | unavailable | - | - | - |`;
  return `| ${label} | ${Number(value.delta).toFixed(2)} | ` +
    `[${Number(value.centralInterval[0]).toFixed(2)}, ${Number(value.centralInterval[1]).toFixed(2)}] | ` +
    `[${Number(value.lowerBound).toFixed(2)}, ${Number(value.upperBound).toFixed(2)}] | ${value.outcome} |`;
}

function formatRate(value: { rate: number } | undefined): string {
  return `${((value?.rate ?? 0) * 100).toFixed(1)}%`;
}

function integerArgument(name: string, fallback: number, minimum: number): number {
  const raw = argument(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`--${name} must be an integer >= ${minimum}`);
  return value;
}

function write(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function normal(random: () => number): number {
  const u = Math.max(Number.EPSILON, random());
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = value;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
