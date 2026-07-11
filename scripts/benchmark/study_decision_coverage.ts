import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { COMPILER_IDENTITY_PROTOCOL } from "../../benchmark/v2/decision-policy.ts";
import { applyJolt } from "../produce/seed.ts";
import {
  DECISION_INFERENCE_SOURCE_FILES,
  pairedV2DecisionForCalibration,
  type DecisionMode,
  type DecisionRun,
} from "../v0/benchmark_v2/decision_model.ts";
import { buildAxisContract, scoreV2Report } from "../v0/benchmark_v2/evaluator.ts";
import { loadSourceManifest, loadSourceSpec, resolveSources } from "../v0/benchmark_v2/model.ts";
import {
  canonicalMembers,
  fingerprintFiles,
  loadSuiteManifest,
  suiteIdentity,
  type SuiteManifest,
} from "../v0/benchmark_v2/suite_model.ts";

const referencePath = resolve(
  argument("reference") ?? "benchmark/v2/runs/calibration-v2.4-coverage-reference.json.gz",
);
const outPath = resolve(argument("out") ?? "benchmark/v2/studies/decision-coverage.json");
const markdownPath = resolve(argument("markdown") ?? "docs/benchmark-v2-decision-coverage.md");
const trials = integerArgument("trials", 1_000, 100);
const seedCounts = (argument("seed-counts") ?? "8").split(",").map(Number);
if (seedCounts.some((value) => !Number.isSafeInteger(value) || value < 2 || value > 12)) {
  throw new Error(`--seed-counts must contain integers from 2 through 12`);
}

const sourcePath = "benchmark/v2/compat/source-manifest.json";
const suitePath = "benchmark/v2/compat/suite-manifest.json";
const sources = resolveSources(loadSourceManifest(sourcePath));
const baseSuite = loadSuiteManifest(suitePath, sources);
const identity = suiteIdentity(suitePath, sourcePath, sources);
const referenceArtifact = readVerifiedReference(referencePath);
const reference = JSON.parse(referenceArtifact.bytes.toString("utf8"));
const scorerFingerprint = fingerprintFiles([
  "scripts/v0/benchmark_v2/evaluator.ts",
  "scripts/v0/benchmark_v2/score_model.ts",
  "scripts/v0/score.ts",
]);
const decisionInferenceFingerprint = fingerprintFiles(DECISION_INFERENCE_SOURCE_FILES);
if (
  reference.schema !== "line.benchmark-v2.budget-scale-study.v1" ||
  reference.suiteFingerprint !== identity.suiteFingerprint ||
  reference.sourceManifestFingerprint !== identity.sourceManifestFingerprint ||
  reference.definitionFingerprint !== identity.definitionFingerprint ||
  reference.scorerFingerprint !== scorerFingerprint ||
  JSON.stringify(reference.transform) !== JSON.stringify(baseSuite.transform)
) {
  throw new Error(`coverage reference does not match the current suite, sources, transform, and scorer`);
}
validateReferenceCompilerIdentity(reference.candidate);
if (!Array.isArray(reference.seeds) || reference.seeds.length < 8 || new Set(reference.seeds).size !== reference.seeds.length) {
  throw new Error(`coverage reference requires at least eight unique seed blocks`);
}

const members = canonicalMembers(baseSuite);
const contracts = new Map();
for (const source of sources) {
  const spec = applyJolt(await loadSourceSpec(source), baseSuite.transform.jolt_ms);
  contracts.set(source.id, buildAxisContract(spec, source.eligibleComponents, source.diagnosticComponents));
}
const referenceByCell = new Map<string, { score: number; valid: boolean }>();
for (const row of reference.runs ?? []) {
  const source = sources.find((entry) => entry.id === row.task?.sourceId);
  if (
    source === undefined || row.status !== "ok" || row.report === null ||
    row.source?.sourceFingerprint !== source.sourceFingerprint || !Number.isSafeInteger(row.authoredContacts)
  ) throw new Error(`coverage reference contains an invalid raw run`);
  const rescored = scoreV2Report(row.report, row.authoredContacts, contracts.get(source.id), baseSuite);
  if (JSON.stringify(rescored) !== JSON.stringify(row.score)) {
    throw new Error(`${source.id}: coverage reference score does not match its raw report`);
  }
  referenceByCell.set(cellKey(source.id, row.task.budget, row.task.actualSeed), {
    score: rescored.score,
    valid: rescored.valid,
  });
}
for (const budget of baseSuite.profiles.canonical.budgets) {
  for (const seed of reference.seeds) {
    for (const sourceId of members) {
      if (!referenceByCell.has(cellKey(sourceId, budget, seed))) {
        throw new Error(`coverage reference is missing ${sourceId}/${budget}/${seed}`);
      }
    }
  }
}

const nullScenarios = ["empirical_blocks", "symmetric_validity_flips", "catalog_wide_hard_zero"] as const;
const alternativeScenarios = ["empirical_score_gain", "hard_zero_validity_gain", "noninferiority_inside", "noninferiority_boundary"] as const;
const catalogHeadlineCache = new Map<number, number[]>();
const results = [];
const powerResults = [];
for (const seedsPerBudget of seedCounts) {
  const suite = suiteForSeeds(baseSuite, seedsPerBudget);
  for (const scenario of nullScenarios) {
    const result = simulate(scenario, suite, seedsPerBudget, "improvement", undefined, 0);
    results.push({
      ...result,
      falseAccept: result.positiveOutcome,
      falseReject: result.negativeOutcome,
    });
    console.log(`  null ${scenario}/${seedsPerBudget}: coverage ${(100 * result.centralCoverage.rate).toFixed(1)}%`);
  }
  for (const scenario of alternativeScenarios) {
    const mode: DecisionMode = scenario.startsWith("noninferiority") ? "simplification" : "improvement";
    const margin = mode === "simplification" ? 5 : undefined;
    const candidateValidityProbability = scenario === "hard_zero_validity_gain"
      ? 0.86
      : scenario === "noninferiority_inside"
      ? solveValidityProbability(suite, -2.5)
      : scenario === "noninferiority_boundary"
      ? solveValidityProbability(suite, -5)
      : undefined;
    const trueDelta = scenario === "empirical_score_gain"
      ? empiricalShiftTruth(baseSuite, 15)
      : exactCatalogWideDelta(suite, 0.8, candidateValidityProbability!);
    const result = simulate(
      scenario,
      suite,
      seedsPerBudget,
      mode,
      margin,
      trueDelta,
      candidateValidityProbability,
    );
    powerResults.push({ ...result, candidateValidityProbability: candidateValidityProbability ?? null });
    console.log(`  power ${scenario}/${seedsPerBudget}: positive ${(100 * result.positiveOutcome.rate).toFixed(1)}%`);
  }
}

const report = {
  schema: "line.benchmark-v2.decision-coverage-study.v2",
  generatedAt: new Date().toISOString(),
  suiteFingerprint: identity.suiteFingerprint,
  scorerFingerprint,
  decisionInferenceFingerprint,
  reference: relative(referencePath),
  referenceArtifactSha256: referenceArtifact.artifactSha256,
  referenceRawSha256: referenceArtifact.rawSha256,
  referenceCandidateFingerprint: reference.candidate?.candidateFingerprint ?? null,
  trials,
  design: {
    empirical_blocks: "Base and candidate independently resample whole observed catalog seed blocks within each budget.",
    symmetric_validity_flips: "Both sides share an observed block; one random side receives an 8% hard-zero cell flip.",
    catalog_wide_hard_zero: "Each catalog-wide block independently takes score 500 or hard-zero with 80% validity.",
    alternatives: "Power covers an empirical +15 score shift, a zero-inflated +6 percentage-point validity gain, and simplification effects inside and exactly at a 5-point non-inferiority margin.",
  },
  results,
  powerResults,
};
write(outPath, `${JSON.stringify(report, null, 2)}\n`);
write(markdownPath, renderMarkdown(report));
console.log(renderMarkdown(report));

function simulate(
  scenario: typeof nullScenarios[number] | typeof alternativeScenarios[number],
  suite: SuiteManifest,
  seedsPerBudget: number,
  mode: DecisionMode,
  margin: number | undefined,
  trueDelta: number,
  candidateValidityProbability?: number,
): any {
  const random = mulberry32(hashSeed(`${scenario}:${seedsPerBudget}`));
  let covered = 0;
  let positive = 0;
  let negative = 0;
  let unresolved = 0;
  let meanDelta = 0;
  for (let trial = 0; trial < trials; trial++) {
    const { base, candidate } = trialRuns(
      scenario,
      suite,
      seedsPerBudget,
      random,
      candidateValidityProbability,
    );
    const decision = pairedV2DecisionForCalibration(base, candidate, suite, {
      profile: "canonical",
      mode,
      margin,
      bootstrapSeed: trial,
    });
    if (decision.confidence.centralLo <= trueDelta && decision.confidence.centralHi >= trueDelta) covered++;
    if (decision.outcome === "accept") positive++;
    else if (decision.outcome === "reject") negative++;
    else unresolved++;
    meanDelta += decision.delta;
  }
  return {
    scenario,
    mode,
    margin: margin ?? null,
    seedsPerBudget,
    trials,
    trueDelta: round(trueDelta),
    meanDelta: round(meanDelta / trials),
    centralCoverage: rateWithWilson(covered, trials),
    positiveOutcome: rateWithWilson(positive, trials),
    negativeOutcome: rateWithWilson(negative, trials),
    unresolvedOutcome: rateWithWilson(unresolved, trials),
  };
}

function trialRuns(
  scenario: typeof nullScenarios[number] | typeof alternativeScenarios[number],
  suite: SuiteManifest,
  seedsPerBudget: number,
  random: () => number,
  candidateValidityProbability?: number,
): { base: DecisionRun[]; candidate: DecisionRun[] } {
  const base: DecisionRun[] = [];
  const candidate: DecisionRun[] = [];
  for (const budget of suite.profiles.canonical.budgets) {
    for (let seedSlot = 0; seedSlot < seedsPerBudget; seedSlot++) {
      const baseSeed = reference.seeds[Math.floor(random() * reference.seeds.length)];
      const candidateSeed = reference.seeds[Math.floor(random() * reference.seeds.length)];
      const sharedSeed = reference.seeds[Math.floor(random() * reference.seeds.length)];
      const baseBlockValid = random() < 0.8;
      const candidateProbability = candidateValidityProbability ?? 0.8;
      const candidateBlockValid = random() < candidateProbability;
      for (const sourceId of members) {
        let baseScore: { score: number; valid: boolean };
        let candidateScore: { score: number; valid: boolean };
        if (scenario === "empirical_blocks" || scenario === "empirical_score_gain") {
          baseScore = referenceByCell.get(cellKey(sourceId, budget, baseSeed))!;
          candidateScore = referenceByCell.get(cellKey(sourceId, budget, candidateSeed))!;
          if (scenario === "empirical_score_gain" && candidateScore.valid) {
            candidateScore = { ...candidateScore, score: Math.min(1000, candidateScore.score + 15) };
          }
        } else if (scenario === "symmetric_validity_flips") {
          const original = referenceByCell.get(cellKey(sourceId, budget, sharedSeed))!;
          baseScore = original;
          candidateScore = original;
          if (random() < 0.08) {
            if (random() < 0.5) baseScore = { score: 0, valid: false };
            else candidateScore = { score: 0, valid: false };
          }
        } else {
          baseScore = { score: baseBlockValid ? 500 : 0, valid: baseBlockValid };
          candidateScore = { score: candidateBlockValid ? 500 : 0, valid: candidateBlockValid };
        }
        const task = { sourceId, budget, seedSlot, actualSeed: seedSlot };
        base.push({ ...task, score: { ...baseScore } });
        candidate.push({ ...task, score: { ...candidateScore } });
      }
    }
  }
  return { base, candidate };
}

function solveValidityProbability(suite: SuiteManifest, targetDelta: number): number {
  let low = targetDelta < 0 ? 0.7 : 0.8;
  let high = targetDelta < 0 ? 0.8 : 0.9;
  for (let iteration = 0; iteration < 40; iteration++) {
    const middle = (low + high) / 2;
    const delta = exactCatalogWideDelta(suite, 0.8, middle);
    if (delta < targetDelta) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

function exactCatalogWideDelta(
  suite: SuiteManifest,
  baseProbability: number,
  candidateProbability: number,
): number {
  const n = suite.profiles.canonical.seeds_per_budget;
  const headlines = catalogWideHeadlines(suite);
  const expectation = (probability: number): number => headlines.reduce(
    (sum, headline, valid) => sum + binomialProbability(n, valid, probability) * headline,
    0,
  );
  return expectation(candidateProbability) - expectation(baseProbability);
}

function catalogWideHeadlines(suite: SuiteManifest): number[] {
  const n = suite.profiles.canonical.seeds_per_budget;
  const cached = catalogHeadlineCache.get(n);
  if (cached !== undefined) return cached;
  const base: DecisionRun[] = [];
  for (const budget of suite.profiles.canonical.budgets) {
    for (let seedSlot = 0; seedSlot < n; seedSlot++) {
      for (const sourceId of members) {
        base.push({ sourceId, budget, seedSlot, actualSeed: seedSlot, score: { score: 0, valid: false } });
      }
    }
  }
  const headlines = Array.from({ length: n + 1 }, (_, validCount) => {
    const candidate = base.map((run) => ({
      ...run,
      score: {
        score: run.seedSlot < validCount ? 500 : 0,
        valid: run.seedSlot < validCount,
      },
    }));
    return pairedV2DecisionForCalibration(base, candidate, suite, {
      profile: "canonical",
      mode: "improvement",
      bootstrapSeed: 0,
    }).candidateHeadline;
  });
  catalogHeadlineCache.set(n, headlines);
  return headlines;
}

function binomialProbability(n: number, successes: number, probability: number): number {
  let combinations = 1;
  for (let i = 1; i <= successes; i++) combinations *= (n - successes + i) / i;
  return combinations * probability ** successes * (1 - probability) ** (n - successes);
}

function empiricalShiftTruth(suite: SuiteManifest, shift: number): number {
  const fullSuite = suiteForSeeds(suite, reference.seeds.length);
  const base: DecisionRun[] = [];
  const candidate: DecisionRun[] = [];
  for (const budget of fullSuite.profiles.canonical.budgets) {
    reference.seeds.forEach((seed: number, seedSlot: number) => {
      for (const sourceId of members) {
        const original = referenceByCell.get(cellKey(sourceId, budget, seed))!;
        const task = { sourceId, budget, seedSlot, actualSeed: seedSlot };
        base.push({ ...task, score: { ...original } });
        candidate.push({
          ...task,
          score: original.valid ? { ...original, score: Math.min(1000, original.score + shift) } : { ...original },
        });
      }
    });
  }
  return pairedV2DecisionForCalibration(base, candidate, fullSuite, {
    profile: "canonical",
    mode: "improvement",
    bootstrapSeed: 0,
  }).delta;
}

function readVerifiedReference(path: string): { bytes: Buffer; artifactSha256: string; rawSha256: string } {
  if (!existsSync(path) || !existsSync(`${path}.sha256`)) {
    throw new Error(`retained coverage reference and checksum sidecar are required`);
  }
  const artifact = readFileSync(path);
  const artifactSha256 = sha256(artifact);
  const expected = readFileSync(`${path}.sha256`, "utf8").trim().split(/\s+/)[0];
  if (artifactSha256 !== expected) throw new Error(`coverage reference checksum mismatch`);
  const bytes = path.endsWith(".gz") ? gunzipSync(artifact) : artifact;
  return { bytes, artifactSha256, rawSha256: sha256(bytes) };
}

function validateReferenceCompilerIdentity(candidate: any): void {
  const required = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "scripts/v0/arc.ts",
    "scripts/v0/arc_placement.ts",
    "scripts/v0/score.ts",
    "scripts/v0/optimizer/handoff.ts",
    "scripts/lib/detector.ts",
    "engine-rs/Cargo.toml",
  ];
  if (
    candidate?.compilerIdentityProtocol !== COMPILER_IDENTITY_PROTOCOL ||
    !Array.isArray(candidate.compilerSourceFiles) ||
    required.some((path) => !candidate.compilerSourceFiles.includes(path)) ||
    candidate.compilerEnvironment === null || typeof candidate.compilerEnvironment !== "object" ||
    typeof candidate.compilerSourceFingerprint !== "string" ||
    typeof candidate.engineArtifactFingerprint !== "string"
  ) throw new Error(`coverage reference compiler identity is incomplete`);
  const expected = sha256(Buffer.from(JSON.stringify({
    compilerIdentityProtocol: candidate.compilerIdentityProtocol,
    compilerSourceFingerprint: candidate.compilerSourceFingerprint,
    compilerEnvironment: candidate.compilerEnvironment,
    engine: candidate.engine,
    engineArtifactFingerprint: candidate.engineArtifactFingerprint,
  })));
  if (candidate.candidateFingerprint !== expected) {
    throw new Error(`coverage reference compiler identity is not self-consistent`);
  }
}

function suiteForSeeds(suite: SuiteManifest, seedsPerBudget: number): SuiteManifest {
  const cloned = structuredClone(suite);
  cloned.profiles.canonical.seeds_per_budget = seedsPerBudget;
  return cloned;
}

function rateWithWilson(count: number, total: number): { count: number; rate: number; wilson95: [number, number] } {
  const z = 1.959963984540054;
  const p = count / total;
  const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const half = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator;
  return { count, rate: round(p), wilson95: [round(center - half), round(center + half)] };
}

function renderMarkdown(report: any): string {
  return `${[
    "# Benchmark V2 Decision Coverage Study",
    "",
    `Reference: \`${report.reference}\` (artifact \`${report.referenceArtifactSha256}\`). ${report.trials} trials per cell.`,
    "",
    "## Null calibration",
    "",
    "| Scenario | Seeds | Mean delta | Coverage | False accept | False reject |",
    "|---|---:|---:|---:|---:|---:|",
    ...report.results.map((entry: any) => `| ${entry.scenario} | ${entry.seedsPerBudget} | ${entry.meanDelta.toFixed(2)} | ${percent(entry.centralCoverage)} | ${percent(entry.falseAccept)} | ${percent(entry.falseReject)} |`),
    "",
    "## Alternative power and non-inferiority",
    "",
    "| Scenario | Mode | True delta | Mean delta | Positive | Negative | Unresolved | Coverage |",
    "|---|---|---:|---:|---:|---:|---:|---:|",
    ...report.powerResults.map((entry: any) => `| ${entry.scenario} | ${entry.mode}${entry.margin === null ? "" : ` (margin ${entry.margin})`} | ${entry.trueDelta.toFixed(2)} | ${entry.meanDelta.toFixed(2)} | ${percent(entry.positiveOutcome)} | ${percent(entry.negativeOutcome)} | ${percent(entry.unresolvedOutcome)} | ${percent(entry.centralCoverage)} |`),
    "",
    "All stored empirical scores were recomputed from retained raw reports before simulation. Wilson 95% intervals accompany every Monte Carlo rate in the JSON artifact.",
  ].join("\n")}\n`;
}

function percent(value: { rate: number; wilson95: [number, number] }): string {
  return `${(value.rate * 100).toFixed(1)}% [${(value.wilson95[0] * 100).toFixed(1)}, ${(value.wilson95[1] * 100).toFixed(1)}]`;
}

function cellKey(sourceId: string, budget: number, seed: number): string {
  return `${sourceId}\0${budget}\0${seed}`;
}
function argument(name: string): string | undefined {
  return process.argv.slice(2).find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}
function integerArgument(name: string, fallback: number, minimum: number): number {
  const value = Number(argument(name) ?? fallback);
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`--${name} must be an integer >= ${minimum}`);
  return value;
}
function write(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
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
function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
function relative(path: string): string {
  return path.startsWith(`${process.cwd()}/`) ? path.slice(process.cwd().length + 1) : path;
}
function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
