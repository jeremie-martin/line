/**
 * Deterministic calibration of the active four-look improvement experiment.
 *
 * The O'Brien-Fleming boundary is represented by one constant c: at
 * information fraction t, cross when |T| >= c/sqrt(t).  Studentized normal
 * observations give the conventional repeated-look reference. Two standardized
 * stress paths (heavy-tailed and zero-inflated observations) prevent the
 * calibration from depending on Gaussian samples alone. Current-scorer archives bind
 * the ruler and provide an exact retrospective compiler replay; no compiler
 * work is performed here.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { benchmarkSequentialEvalPolicy } from "../../benchmark/v2/eval-policy.ts";
import { pairedV2DecisionForCalibration, type DecisionRun } from "../v0/benchmark_v2/decision_model.ts";
import { suiteAtDepth } from "../v0/benchmark_v2/decide.ts";
import { loadSourceManifest, resolveSources } from "../v0/benchmark_v2/model.ts";
import {
  SEQUENTIAL_EVAL_CALIBRATION_SCHEMA,
  sequentialEvalInferenceFingerprint,
  sequentialEvalCalibrationGeneratorFingerprint,
  sequentialEvalPolicyFingerprint,
  sequentialLookDecision,
} from "../v0/benchmark_v2/sequential_inference.ts";
import { loadSuiteManifest, suiteIdentity } from "../v0/benchmark_v2/suite_model.ts";

const argument = (name: string): string | undefined =>
  process.argv.slice(2).find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
for (const value of process.argv.slice(2)) {
  if (!/^--(base-index|candidate-index|out|markdown)=.+$/.test(value)) {
    throw new Error(`unsupported sequential calibration argument ${value}`);
  }
}
const BASE = argument("base-index") ??
  "benchmark/v2/runs/contact-redir-impulse-v2-750k-development.json.decision-index.json";
const CANDIDATE = argument("candidate-index") ??
  "benchmark/v2/runs/readiness-contact-impulse-v3-750k-development-750k.decision-index.json";
const OUT = argument("out") ?? "benchmark/v2/studies/sequential-eval-calibration.json";
const MARKDOWN = argument("markdown") ?? "docs/benchmark-v2-sequential-eval-calibration.md";
const scenarios = ["gaussian", "heavy_tailed", "zero_inflated"] as const;
type Scenario = typeof scenarios[number];

const sourcePath = "benchmark/v2/compat/source-manifest.json";
const suitePath = "benchmark/v2/compat/suite-manifest.json";
const sources = resolveSources(loadSourceManifest(sourcePath));
const suite = loadSuiteManifest(suitePath, sources);
const identity = suiteIdentity(suitePath, sourcePath, sources);
const references = [loadIndex(BASE), loadIndex(CANDIDATE)];
for (const reference of references) {
  if (
    reference.index.archive?.identity?.suiteFingerprint !== identity.suiteFingerprint ||
    reference.index.archive?.identity?.scoringProtocolFingerprint !== identity.scoringProtocolFingerprint ||
    reference.index.archive?.identity?.seedSchedule?.seedsPerBudget !== benchmarkSequentialEvalPolicy.maximumDepth
  ) throw new Error(`${reference.path}: sequential calibration reference is outside the current scorer and N=48 scope`);
}

const calibrationStatistics = Object.fromEntries(scenarios.map((scenario) => [
  scenario,
  pathStatistics(scenario, benchmarkSequentialEvalPolicy.calibrationTrialsPerScenario, hashSeed(`cal:${scenario}`)),
])) as Record<Scenario, { positive: number[]; negative: number[] }>;
const calibrationTarget = benchmarkSequentialEvalPolicy.totalAlpha *
  benchmarkSequentialEvalPolicy.calibrationTargetFraction;
const boundaryConstant = round(Math.max(...scenarios.flatMap((scenario) => {
  const values = calibrationStatistics[scenario];
  return [boundaryForWilson(values.positive, calibrationTarget), boundaryForWilson(values.negative, calibrationTarget)];
})));
const calibrationRates = rateReport(calibrationStatistics, boundaryConstant, calibrationTarget);

const validationStatistics = Object.fromEntries(scenarios.map((scenario) => [
  scenario,
  pathStatistics(scenario, benchmarkSequentialEvalPolicy.validationTrialsPerScenario, hashSeed(`val:${scenario}`)),
])) as Record<Scenario, { positive: number[]; negative: number[] }>;
const validationRates = rateReport(
  validationStatistics,
  boundaryConstant,
  benchmarkSequentialEvalPolicy.totalAlpha,
);
const retrospective = exactRetrospective(references[0].index.archive.runs, references[1].index.archive.runs, boundaryConstant);

const report = {
  schema: SEQUENTIAL_EVAL_CALIBRATION_SCHEMA,
  suiteFingerprint: identity.suiteFingerprint,
  scoringProtocolFingerprint: identity.scoringProtocolFingerprint,
  generatorFingerprint: sequentialEvalCalibrationGeneratorFingerprint(),
  policyFingerprint: sequentialEvalPolicyFingerprint(),
  inferenceFingerprint: sequentialEvalInferenceFingerprint(),
  policy: benchmarkSequentialEvalPolicy,
  boundaryConstant,
  method: {
    family: "obrien-fleming-t",
    equation: "cross when |T_N| >= c / sqrt(N / 48)",
    calibrationTarget: round(calibrationTarget),
    validationCap: benchmarkSequentialEvalPolicy.totalAlpha,
    stresses: {
      gaussian: "studentized independent unit-variance Gaussian observations",
      heavy_tailed: "studentized standardized Student-t(5) observations",
      zero_inflated: "studentized observations with 20% structural zeros and Gaussian non-zero mass",
    },
    probability:
      "Reference-Student-t directional probability uses the paired seed-block jackknife SE and effective degrees of freedom; the calibrated crossing boundary, not an unadjusted probability, controls repeated looks.",
  },
  references: references.map((reference) => ({
    path: reference.path,
    sha256: reference.sha256,
    rawArchiveSha256: reference.index.archiveSha256,
  })),
  calibration: {
    trialsPerScenario: benchmarkSequentialEvalPolicy.calibrationTrialsPerScenario,
    targetWilsonUpper: round(calibrationTarget),
    scenarios: calibrationRates,
    allBarsMet: calibrationRates.every((entry) => entry.promote.wilson95[1] <= calibrationTarget && entry.harm.wilson95[1] <= calibrationTarget),
  },
  validation: {
    trialsPerScenario: benchmarkSequentialEvalPolicy.validationTrialsPerScenario,
    requiredWilsonUpper: benchmarkSequentialEvalPolicy.totalAlpha,
    scenarios: validationRates,
    allBarsMet: validationRates.every((entry) =>
      entry.promote.wilson95[1] <= benchmarkSequentialEvalPolicy.totalAlpha &&
      entry.harm.wilson95[1] <= benchmarkSequentialEvalPolicy.totalAlpha
    ),
  },
  retrospective: {
    authority: "diagnostic-only",
    comparison: "contact-redir-impulse-v2 -> readiness-contact-impulse-v3",
    note: "This replay did not choose the policy and does not revise the historical owner override. Under the live strict queue, N=32 would have accepted and N=48 would never have been run; the N=48 row is shown only because the completed historical archive already exists.",
    looks: retrospective,
  },
};
if (!report.calibration.allBarsMet || !report.validation.allBarsMet) {
  throw new Error(`sequential calibration did not meet its predeclared repeated-look safety bars`);
}
write(OUT, `${JSON.stringify(report, null, 2)}\n`);
write(MARKDOWN, markdown(report));
console.log(`sequential boundary c=${boundaryConstant}; calibration and validation bars met`);

function pathStatistics(scenario: Scenario, trials: number, seed: number): { positive: number[]; negative: number[] } {
  const random = mulberry32(seed);
  const positive: number[] = [];
  const negative: number[] = [];
  const looks = benchmarkSequentialEvalPolicy.looks;
  for (let trial = 0; trial < trials; trial++) {
    let sum = 0;
    let sumSquares = 0;
    let completed = 0;
    let maxPositive = -Infinity;
    let maxNegative = -Infinity;
    for (const look of looks) {
      while (completed < look) {
        const observation = standardizedInnovation(scenario, random);
        sum += observation;
        sumSquares += observation * observation;
        completed++;
      }
      const fraction = look / benchmarkSequentialEvalPolicy.maximumDepth;
      const variance = Math.max(0, (sumSquares - sum * sum / look) / (look - 1));
      const statistic = variance === 0
        ? sum > 0 ? Infinity : sum < 0 ? -Infinity : 0
        : (sum / look) / Math.sqrt(variance / look);
      const boundaryScale = statistic * Math.sqrt(fraction);
      maxPositive = Math.max(maxPositive, boundaryScale);
      maxNegative = Math.max(maxNegative, -boundaryScale);
    }
    positive.push(maxPositive);
    negative.push(maxNegative);
  }
  return { positive, negative };
}

function standardizedInnovation(scenario: Scenario, random: () => number): number {
  if (scenario === "gaussian") return normal(random);
  if (scenario === "heavy_tailed") {
    let chiSquare = 0;
    for (let index = 0; index < 5; index++) chiSquare += normal(random) ** 2;
    return (normal(random) / Math.sqrt(chiSquare / 5)) / Math.sqrt(5 / 3);
  }
  if (random() < 0.2) return 0;
  return normal(random) / Math.sqrt(0.8);
}

function boundaryForWilson(values: number[], cap: number): number {
  const sorted = [...values].sort((a, b) => b - a);
  let allowed = 0;
  for (let count = 0; count <= sorted.length; count++) {
    if (wilson(count, sorted.length)[1] <= cap) allowed = count;
    else break;
  }
  return allowed === 0 ? sorted[0] + Number.EPSILON : sorted[Math.min(allowed - 1, sorted.length - 1)] + 1e-12;
}

function rateReport(
  stats: Record<Scenario, { positive: number[]; negative: number[] }>,
  boundary: number,
  cap: number,
): Array<{ scenario: Scenario; promote: ReturnType<typeof rate>; harm: ReturnType<typeof rate>; cap: number }> {
  return scenarios.map((scenario) => ({
    scenario,
    promote: rate(stats[scenario].positive.filter((value) => value >= boundary).length, stats[scenario].positive.length),
    harm: rate(stats[scenario].negative.filter((value) => value >= boundary).length, stats[scenario].negative.length),
    cap,
  }));
}

function exactRetrospective(baseRows: any[], candidateRows: any[], boundary: number): any[] {
  return benchmarkSequentialEvalPolicy.looks.map((depth) => {
    const atDepth = suiteAtDepth(suite, depth, [750_000]);
    const decision = pairedV2DecisionForCalibration(
      baseRows.filter((row) => row.task.seedSlot < depth).map(decisionRun),
      candidateRows.filter((row) => row.task.seedSlot < depth).map(decisionRun),
      atDepth,
      { profile: "canonical", mode: "improvement", iterations: 100, bootstrapSeed: 0 },
    );
    return {
      ...sequentialLookDecision(decision.confidence, depth, boundary),
      baseHeadline: decision.baseHeadline,
      candidateHeadline: decision.candidateHeadline,
      delta: decision.delta,
      validity: decision.validity,
    };
  });
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

function loadIndex(path: string): { path: string; sha256: string; index: any } {
  const bytes = readFileSync(resolve(path));
  const index = JSON.parse(bytes.toString("utf8"));
  if (index.schema !== "line.benchmark-v2.decision-index.v1") throw new Error(`${path}: not a decision index`);
  return { path, sha256: sha256(bytes), index };
}

function rate(count: number, total: number): { count: number; total: number; rate: number; wilson95: [number, number] } {
  return { count, total, rate: round(count / total), wilson95: wilson(count, total) };
}

function wilson(count: number, total: number): [number, number] {
  const z = 1.959963984540054;
  const p = count / total;
  const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const spread = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator;
  return [round(Math.max(0, center - spread)), round(Math.min(1, center + spread))];
}

function normal(random: () => number): number {
  const left = Math.max(Number.MIN_VALUE, random());
  return Math.sqrt(-2 * Math.log(left)) * Math.cos(2 * Math.PI * random());
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

function markdown(report: any): string {
  const rows = report.validation.scenarios.map((entry: any) =>
    `| ${entry.scenario} | ${percent(entry.promote)} | ${percent(entry.harm)} |`
  );
  const looks = report.retrospective.looks.map((entry: any) =>
    `| ${entry.depth} | ${entry.baseHeadline.toFixed(4)} | ${entry.candidateHeadline.toFixed(4)} | ${entry.delta >= 0 ? "+" : ""}${entry.delta.toFixed(4)} | ${entry.standardError.toFixed(4)} | ${(100 * entry.directionalProbability).toFixed(3)}% | ${(100 * entry.requiredDirectionalProbability).toFixed(3)}% | ${entry.action} |`
  );
  return `# Benchmark V2 Sequential Evaluation Calibration\n\n` +
    `The active improvement experiment uses strict looks at N=8/16/32/48 and one-sided total alpha ${(100 * report.policy.totalAlpha).toFixed(1)}% in each direction. Its calibrated O'Brien-Fleming constant is **${report.boundaryConstant}**.\n\n` +
    `At look N, accept when \`T_N >= c / sqrt(N / 48)\`, reject clear harm at the symmetric negative boundary, continue otherwise, and report an uncrossed N=48 as inconclusive. There is no predictive-futility stop. \`totalAlpha\` is the only operator-facing tolerance; per-look cutoffs are derived.\n\n` +
    `The paired seed-block jackknife supplies the estimate, SE, and effective degrees of freedom, so the measured seed variation enters every directional probability. That displayed probability is a reference Student-t summary; the calibrated crossing boundary controls repeated-look error.\n\n` +
    `Calibration uses 10,000 studentized paths per stress and an independent 10,000-path validation set per stress. The stresses are Gaussian observations, standardized Student-t(5) observations, and 20% zero-inflated Gaussian observations. The selected boundary must put every calibration Wilson-95 upper bound at or below ${(100 * report.method.calibrationTarget).toFixed(1)}%, leaving validation headroom.\n\n` +
    `## Independent validation\n\n| Stress | False promote | False harm |\n|---|---:|---:|\n${rows.join("\n")}\n\n` +
    `Every Wilson-95 upper bound is at most ${(100 * report.policy.totalAlpha).toFixed(1)}%. The two directional caps are separate; this is not a 5% cap on their union.\n\n` +
    `## Readiness comparison replay\n\n| N | Base | Candidate | Delta | SE | P(delta>0) | Required | Action |\n|---:|---:|---:|---:|---:|---:|---:|---|\n${looks.join("\n")}\n\n` +
    `${report.retrospective.note}\n\n` +
    `## Identity and reproduction\n\n` +
    `Suite: \`${report.suiteFingerprint}\`. Scoring protocol: \`${report.scoringProtocolFingerprint}\`. Policy: \`${report.policyFingerprint}\`. Inference: \`${report.inferenceFingerprint}\`. Generator: \`${report.generatorFingerprint}\`.\n\n` +
    `Regenerate deterministically with \`node --import tsx scripts/benchmark/calibrate_sequential_eval.ts\`. A new scorer bootstrap may supply \`--base-index=... --candidate-index=...\`; the replay is diagnostic, so the same current-scorer index may be used twice when no comparison exists yet. Preparation and paid active eval fail closed if the artifact, implementation, policy, scorer, suite, generator, or retained reference indexes no longer match.\n`;
}

function percent(value: { rate: number; wilson95: [number, number] }): string {
  return `${(100 * value.rate).toFixed(2)}% [${(100 * value.wilson95[0]).toFixed(2)}, ${(100 * value.wilson95[1]).toFixed(2)}]`;
}

function write(path: string, value: string): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(resolve(path), value);
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function round(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 1e8) / 1e8;
}
