import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadVerifiedArchive } from "../v0/benchmark_v2/decide.ts";
import {
  summarizeDevelopmentBudget,
  type ScoredDevelopmentRun,
} from "../v0/benchmark_v2/evaluator.ts";
import { loadSourceManifest, resolveSources } from "../v0/benchmark_v2/model.ts";
import { loadSuiteManifest } from "../v0/benchmark_v2/suite_model.ts";
import { argumentReader, round } from "../v0/benchmark_v2/util.ts";

const argument = argumentReader(process.argv.slice(2));
const baselinePath = resolve(argument("baseline") ?? "benchmark/v2/campaign-baseline.json");
const outPath = resolve(argument("out") ?? "benchmark/v2/studies/current-baseline-analysis.json");
const markdownPath = resolve(argument("markdown") ?? "docs/benchmark-v2-current-baseline-analysis.md");
const baselineBytes = readFileSync(baselinePath);
const baseline = JSON.parse(baselineBytes.toString("utf8"));
const compressedPath = resolve(baseline.development?.compressed_archive ?? "");
const rawPath = compressedPath.replace(/\.gz$/, "");
const archivePath = existsSync(rawPath) ? rawPath : compressedPath;
const verified = loadVerifiedArchive(archivePath, {
  archive_sha256: baseline.development.archive_sha256,
  compressed_archive_sha256: baseline.development.compressed_archive_sha256,
});
const archive = verified.archive;
if (
  baseline.status !== "active-campaign-baseline" ||
  baseline.scorer_bound_bootstrap?.cross_ruler_comparison !== false ||
  archive.identity?.suiteFingerprint !== baseline.suite_fingerprint ||
  archive.identity?.scoringProtocolFingerprint !== baseline.scoring_protocol_fingerprint ||
  archive.git?.candidateFingerprint !== baseline.candidate_fingerprint ||
  archive.identity?.engine !== "wasm" ||
  archive.mode !== "development" ||
  archive.profile !== "canonical" ||
  JSON.stringify(archive.identity?.budgets) !== JSON.stringify([750_000]) ||
  !Array.isArray(archive.runs) ||
  archive.runs.length !== 2_112 ||
  archive.runs.some((row: any) => row.status !== "ok")
) throw new Error(`active campaign baseline is not the exact scorer-bound 750k/N=48 archive`);

const rawArchive = archive;
if (archivePath === rawPath) {
  const indexedRawArchive = JSON.parse(readFileSync(rawPath, "utf8"));
  if (
    indexedRawArchive.decisionIndexPayloadSha256 !== JSON.parse(
      readFileSync(`${rawPath}.decision-index.json`, "utf8"),
    ).payloadSha256 ||
    indexedRawArchive.runs.length !== archive.runs.length
  ) throw new Error(`raw archive is detached from its decision index`);
}

const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
const sourceById = new Map(sources.map((source) => [source.id, source]));
const suite = loadSuiteManifest("benchmark/v2/compat/suite-manifest.json", sources);
const budget = 750_000;
const summary = archive.developmentSummaries.find((entry: any) => entry.budget === budget);
if (summary?.score !== baseline.development.canonical_headline) {
  throw new Error(`active headline does not match the retained archive`);
}
const officialCase = new Map<string, any>(
  summary.specifications.map((entry: any) => [entry.id, entry]),
);
const rows = archive.runs;
const decisionRuns: ScoredDevelopmentRun[] = rows.map(toDecisionRun);
const allScores = rows.map((row: any) => row.score.score);
const validRows = rows.filter((row: any) => row.score.valid);
const validScores = validRows.map((row: any) => row.score.score);
const invalidRows = rows.filter((row: any) => !row.score.valid);

const caseRows = groupBy(rows, (row: any) => row.task.sourceId);
const caseStatistics = [...caseRows].map(([sourceId, values]) => {
  const source = sourceById.get(sourceId)!;
  const scores = values.map((row: any) => row.score.score);
  const impact = values.filter(hasComponent("impact"));
  return {
    sourceId,
    parentId: source.parentId ?? null,
    cohort: source.role,
    originFamily: source.originFamily,
    officialScore: officialCase.get(sourceId)!.score,
    validity: {
      valid: values.filter((row: any) => row.score.valid).length,
      total: values.length,
    },
    score: distribution(scores),
    impactQuality: distribution(impact.map((row: any) => row.score.components.impact.quality)),
    impactRmsError: distribution(impact.map((row: any) => row.score.components.impact.rmsError)),
  };
}).sort((a, b) => a.officialScore - b.officialScore);

const seeds = archive.identity.seedSchedule.byBudget[0].actualSeeds;
const seedStatistics: any[] = seeds.map((actualSeed: number, seedSlot: number) => {
  const selected = decisionRuns.filter((row) => row.actualSeed === actualSeed);
  const seedSummary = summarizeDevelopmentBudget(selected, budget, suite);
  const without = summarizeDevelopmentBudget(
    decisionRuns.filter((row) => row.actualSeed !== actualSeed),
    budget,
    suite,
  );
  return {
    seedSlot,
    actualSeed,
    headline: seedSummary.score,
    validRuns: seedSummary.validRuns,
    totalRuns: seedSummary.totalRuns,
    leaveOneSeedOutHeadline: without.score,
    leaveOneSeedOutChange: round(without.score - summary.score),
  };
});

const componentNames = ["air", "amplitude", "impact", "speed"] as const;
const components = Object.fromEntries(componentNames.map((component) => {
  const selected = rows.filter(hasComponent(component));
  return [component, {
    observations: selected.reduce(
      (sum: number, row: any) => sum + row.score.components[component].observations,
      0,
    ),
    runCoverage: selected.length,
    quality: distribution(selected.map((row: any) => row.score.components[component].quality)),
    rmsError: distribution(selected.map((row: any) => row.score.components[component].rmsError)),
  }];
}));

const runMetrics: Array<{ label: string; values: Array<number | null> }> = [
  { label: "headline score", values: rows.map((row: any) => row.score.score) },
  { label: "impact quality", values: rows.map(componentValue("impact", "quality")) },
  { label: "impact RMS error", values: rows.map(componentValue("impact", "rmsError")) },
  { label: "air quality", values: rows.map(componentValue("air", "quality")) },
  { label: "speed quality", values: rows.map(componentValue("speed", "quality")) },
  { label: "amplitude quality", values: rows.map(componentValue("amplitude", "quality")) },
  { label: "authored contacts", values: rows.map((row: any) => row.authoredContacts) },
];
const correlationPairs = [
  ["headline score", "impact quality"],
  ["headline score", "impact RMS error"],
  ["headline score", "air quality"],
  ["headline score", "speed quality"],
  ["headline score", "amplitude quality"],
  ["headline score", "authored contacts"],
  ["impact quality", "air quality"],
  ["impact quality", "speed quality"],
] as const;
const metricByLabel = new Map(runMetrics.map((entry) => [entry.label, entry.values]));
const correlations = correlationPairs.map(([left, right]) => ({
  left,
  right,
  ...correlate(metricByLabel.get(left)!, metricByLabel.get(right)!),
}));

const impactObservations = rawArchive.runs.flatMap((row: any) =>
  (row.report?.gaps ?? []).flatMap((gap: any) => {
    const impact = gap.axes?.impact;
    return impact === undefined ? [] : [{
      sourceId: row.task.sourceId,
      actualSeed: row.task.actualSeed,
      target: impact.target,
      achieved: impact.achieved,
      error: impact.error,
      feasibilityBound: impact.feasibility_bound,
      ceiling: impact.ceiling,
    }];
  })
);
const impactTargets = impactObservations.map((entry: any) => entry.target);
const impactAchieved = impactObservations.map((entry: any) => entry.achieved);
const impactErrorMagnitudes = impactObservations.map((entry: any) => entry.error);
const impactResiduals = impactObservations.map((entry: any) => entry.achieved - entry.target);
const impactDelivery = {
  meanTarget: round(mean(impactTargets)),
  meanAchieved: round(mean(impactAchieved)),
  meanSignedResidual: round(mean(impactResiduals)),
  underTargetFraction: round(impactResiduals.filter((value: number) => value < 0).length / impactResiduals.length),
  within005Fraction: round(
    impactResiduals.filter((value: number) => Math.abs(value) <= 0.05).length / impactResiduals.length,
  ),
  within010Fraction: round(
    impactResiduals.filter((value: number) => Math.abs(value) <= 0.10).length / impactResiduals.length,
  ),
  linearFit: linearFit(impactTargets, impactAchieved),
};
const impactBands = ranges([0, 0.2, 0.4, 0.6, 0.8, 1.000_001]).map(({ low, high }) => {
  const selected = impactObservations.filter((entry: any) => entry.target >= low && entry.target < high);
  return {
    targetRange: `[${low.toFixed(1)},${high > 1 ? "1.0]" : `${high.toFixed(1)})`}`,
    count: selected.length,
    targetMean: safeMean(selected.map((entry: any) => entry.target)),
    achievedMean: safeMean(selected.map((entry: any) => entry.achieved)),
    signedResidualMean: safeMean(selected.map((entry: any) => entry.achieved - entry.target)),
    meanAbsoluteError: safeMean(selected.map((entry: any) => entry.error)),
    rmsError: rms(selected.map((entry: any) => entry.error)),
  };
});

const pairedVariants = sources.filter((source) => source.parentId !== undefined).map((source) => {
  const parent = new Map(
    caseRows.get(source.parentId!)!.map((row: any) => [row.task.actualSeed, row]),
  );
  const deltas = caseRows.get(source.id)!.map((row: any) =>
    row.score.score - parent.get(row.task.actualSeed)!.score.score
  );
  const center = mean(deltas);
  const se = standardDeviation(deltas) / Math.sqrt(deltas.length);
  return {
    parentId: source.parentId,
    variantId: source.id,
    meanPairedRunScoreDifference: round(center),
    medianPairedRunScoreDifference: quantile(deltas, 0.5),
    paired95Interval: [round(center - 2.0117 * se), round(center + 2.0117 * se)],
    officialAggregateDifference: round(
      officialCase.get(source.id).score - officialCase.get(source.parentId!).score,
    ),
  };
}).sort((a, b) => a.meanPairedRunScoreDifference - b.meanPairedRunScoreDifference);

const arithmeticDecomposition = twoWayDecomposition(rows);
const targetGap = baseline.scope.target_headline - summary.score;
const hierarchyStrata = summary.strata.map((entry: any) => ({
  ...entry,
  targetGapContribution: round(entry.weight * (baseline.scope.target_headline - entry.score)),
  targetGapShare: round(entry.weight * (baseline.scope.target_headline - entry.score) / targetGap),
}));
const stratumWeight = new Map(summary.strata.map((entry: any) => [entry.id, entry.weight]));
const hierarchyGroups = summary.groups.map((entry: any) => {
  const campaignWeight = stratumWeight.get(entry.stratum)! * entry.weight;
  const targetGapContribution = campaignWeight * (baseline.scope.target_headline - entry.score);
  return {
    id: entry.id,
    stratum: entry.stratum,
    weight: entry.weight,
    campaignWeight: round(campaignWeight),
    score: entry.score,
    targetGapContribution: round(targetGapContribution),
    targetGapShare: round(targetGapContribution / targetGap),
  };
});
const invalidCounterfactuals = invalidRows.map((invalid: any) => {
  const replacement = quantile(
    caseRows.get(invalid.task.sourceId)!
      .filter((row: any) => row.score.valid)
      .map((row: any) => row.score.score),
    0.5,
  );
  const replaced = decisionRuns.map((row: ScoredDevelopmentRun) =>
    row.sourceId === invalid.task.sourceId && row.actualSeed === invalid.task.actualSeed
      ? { ...row, score: { ...row.score, score: replacement, valid: true } }
      : row
  );
  return {
    sourceId: invalid.task.sourceId,
    seedSlot: invalid.task.seedSlot,
    actualSeed: invalid.task.actualSeed,
    hardFailures: invalid.score.hardFailures,
    replacement: "within-case valid-run median",
    replacementScore: replacement,
    diagnosticHeadline: summarizeDevelopmentBudget(replaced, budget, suite).score,
    diagnosticHeadlineChange: round(
      summarizeDevelopmentBudget(replaced, budget, suite).score - summary.score,
    ),
  };
});

const report = {
  schema: "line.benchmark-v2.active-baseline-analysis.v1",
  generatedAt: new Date().toISOString(),
  boundary:
    "Within-baseline analysis under accumulated contacted-frame redirection impulse. No old-ruler score, delta, or ranking is used.",
  baseline: {
    path: relative(baselinePath),
    sha256: sha256(baselineBytes),
    label: baseline.label,
    suiteFingerprint: baseline.suite_fingerprint,
    scoringProtocolFingerprint: baseline.scoring_protocol_fingerprint,
    goldenEvaluatorFingerprint: baseline.golden_evaluator_fingerprint,
    candidateFingerprint: baseline.candidate_fingerprint,
    engine: baseline.engine,
    budget,
    seedsPerCase: baseline.scope.promotion_seeds,
    cases: sources.length,
    rawArchiveRetained: existsSync(rawPath),
    rawArchive: existsSync(rawPath) ? relative(rawPath) : null,
    rawArchiveSha256: baseline.development.archive_sha256,
    compressedArchive: baseline.development.compressed_archive,
    compressedArchiveSha256: baseline.development.compressed_archive_sha256,
  },
  headline: {
    score: summary.score,
    target: baseline.scope.target_headline,
    gapToTarget: round(baseline.scope.target_headline - summary.score),
    validRuns: summary.validRuns,
    totalRuns: summary.totalRuns,
    validityRate: round(summary.validRuns / summary.totalRuns),
  },
  distributions: {
    allRunScores: distribution(allScores),
    validRunScores: distribution(validScores),
    runScoreHistogram: histogram(allScores, rangeStops(0, 1000, 50)),
    caseOfficialScores: distribution(caseStatistics.map((entry) => entry.officialScore)),
    seedBlockHeadlines: distribution(seedStatistics.map((entry: any) => entry.headline)),
  },
  hierarchy: {
    strata: hierarchyStrata,
    groups: hierarchyGroups,
  },
  caseStatistics,
  seedStatistics,
  components,
  correlations,
  arithmeticVarianceDecomposition: arithmeticDecomposition,
  impactObservationAnalysis: {
    count: impactObservations.length,
    targets: distribution(impactTargets),
    achieved: distribution(impactAchieved),
    signedResidual: distribution(impactResiduals),
    absoluteError: distribution(impactErrorMagnitudes),
    rmsError: rms(impactErrorMagnitudes),
    delivery: impactDelivery,
    targetAchievedCorrelation: correlate(impactTargets, impactAchieved),
    targetAbsoluteErrorCorrelation: correlate(impactTargets, impactErrorMagnitudes),
    targetBands: impactBands,
    achievedHistogram: histogram(impactAchieved, rangeStops(0, 1, 0.05)),
  },
  pairedVariantDiagnostics: {
    caution:
      "Each variant has its own authored target, so score differences describe suite behavior; they are not candidate-quality effects.",
    pairs: pairedVariants,
  },
  invalidRunDiagnostics: invalidCounterfactuals,
};

write(outPath, `${JSON.stringify(report, null, 2)}\n`);
write(markdownPath, renderMarkdown(report));
console.log(renderMarkdown(report));

function toDecisionRun(row: any): ScoredDevelopmentRun {
  return {
    sourceId: row.task.sourceId,
    budget: row.task.budget,
    seedSlot: row.task.seedSlot,
    actualSeed: row.task.actualSeed,
    score: row.score,
  };
}

function hasComponent(component: string): (row: any) => boolean {
  return (row) => row.score?.components?.[component] !== undefined;
}

function componentValue(component: string, property: string): (row: any) => number | null {
  return (row) => row.score?.components?.[component]?.[property] ?? null;
}

function distribution(values: number[]): Record<string, number> {
  if (values.length === 0) return { count: 0 };
  return {
    count: values.length,
    min: round(values.reduce((lowest, value) => Math.min(lowest, value), Infinity)),
    p05: quantile(values, 0.05),
    p25: quantile(values, 0.25),
    median: quantile(values, 0.5),
    mean: round(mean(values)),
    p75: quantile(values, 0.75),
    p95: quantile(values, 0.95),
    max: round(values.reduce((highest, value) => Math.max(highest, value), -Infinity)),
    standardDeviation: round(standardDeviation(values)),
  };
}

function histogram(values: number[], stops: number[]): Array<Record<string, number | string>> {
  return stops.slice(0, -1).map((low, index) => {
    const high = stops[index + 1];
    const count = values.filter((value) =>
      value >= low && (index === stops.length - 2 ? value <= high : value < high)
    ).length;
    return {
      range: `[${round(low)},${round(high)}${index === stops.length - 2 ? "]" : ")"}`,
      count,
      fraction: round(count / values.length),
    };
  });
}

function correlate(
  left: Array<number | null>,
  right: Array<number | null>,
): { observations: number; pearson: number; spearman: number } {
  const pairs = left.flatMap((value, index) =>
    value === null || right[index] === null || !Number.isFinite(value) || !Number.isFinite(right[index]!)
      ? []
      : [[value, right[index]!] as [number, number]]
  );
  return {
    observations: pairs.length,
    pearson: round(pearson(pairs.map(([value]) => value), pairs.map(([, value]) => value))),
    spearman: round(pearson(ranks(pairs.map(([value]) => value)), ranks(pairs.map(([, value]) => value)))),
  };
}

function pearson(left: number[], right: number[]): number {
  if (left.length < 2) return 0;
  const leftMean = mean(left);
  const rightMean = mean(right);
  let covariance = 0;
  let leftSum = 0;
  let rightSum = 0;
  for (let index = 0; index < left.length; index++) {
    const a = left[index] - leftMean;
    const b = right[index] - rightMean;
    covariance += a * b;
    leftSum += a * a;
    rightSum += b * b;
  }
  return leftSum === 0 || rightSum === 0 ? 0 : covariance / Math.sqrt(leftSum * rightSum);
}

function linearFit(left: number[], right: number[]): {
  intercept: number;
  slope: number;
  rSquared: number;
} {
  const leftMean = mean(left);
  const rightMean = mean(right);
  const covariance = left.reduce(
    (sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean),
    0,
  );
  const variance = left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0);
  const slope = variance === 0 ? 0 : covariance / variance;
  const intercept = rightMean - slope * leftMean;
  const correlation = pearson(left, right);
  return {
    intercept: round(intercept),
    slope: round(slope),
    rSquared: round(correlation * correlation),
  };
}

function ranks(values: number[]): number[] {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = Array(values.length);
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value) end++;
    const rank = (start + end - 1) / 2 + 1;
    for (let index = start; index < end; index++) result[sorted[index].index] = rank;
    start = end;
  }
  return result;
}

function twoWayDecomposition(input: any[]): Record<string, number | string> {
  const grand = mean(input.map((row) => row.score.score));
  const byCase = groupBy(input, (row) => row.task.sourceId);
  const bySeed = groupBy(input, (row) => String(row.task.actualSeed));
  const total = input.reduce((sum, row) => sum + (row.score.score - grand) ** 2, 0);
  const caseSs = [...byCase.values()].reduce(
    (sum, values) => sum + values.length * (mean(values.map((row) => row.score.score)) - grand) ** 2,
    0,
  );
  const seedSs = [...bySeed.values()].reduce(
    (sum, values) => sum + values.length * (mean(values.map((row) => row.score.score)) - grand) ** 2,
    0,
  );
  const residual = Math.max(0, total - caseSs - seedSs);
  return {
    method: "balanced two-way arithmetic-score sum-of-squares decomposition; descriptive, not the geometric campaign headline",
    caseFraction: round(caseSs / total),
    seedFraction: round(seedSs / total),
    residualInteractionFraction: round(residual / total),
  };
}

function renderMarkdown(value: any): string {
  const lowest = value.caseStatistics.slice(0, 8);
  const highest = [...value.caseStatistics].sort((a, b) => b.officialScore - a.officialScore).slice(0, 8);
  const volatile = [...value.caseStatistics]
    .sort((a, b) => b.score.standardDeviation - a.score.standardDeviation)
    .slice(0, 8);
  const seedInfluence = [...value.seedStatistics]
    .sort((a, b) => Math.abs(b.leaveOneSeedOutChange) - Math.abs(a.leaveOneSeedOutChange))
    .slice(0, 8);
  const variants = value.pairedVariantDiagnostics.pairs;
  return `${[
    "# Benchmark V2 Current Baseline Analysis",
    "",
    `Baseline: \`${value.baseline.label}\`. Scorer: accumulated contacted-frame redirection impulse. ` +
      `Suite: \`${value.baseline.suiteFingerprint.slice(0, 16)}\`.`,
    "",
    `**Boundary:** ${value.boundary}`,
    "",
    "## Executive read",
    "",
    `- Official 750k/N=48 headline: **${value.headline.score.toFixed(4)}**; target gap: **${value.headline.gapToTarget.toFixed(4)}**.`,
    `- Validity: **${value.headline.validRuns}/${value.headline.totalRuns}** (${(100 * value.headline.validityRate).toFixed(2)}%).`,
    `- Run-score median ${value.distributions.allRunScores.median.toFixed(2)}, IQR ` +
      `${value.distributions.allRunScores.p25.toFixed(2)}–${value.distributions.allRunScores.p75.toFixed(2)}, ` +
      `5th–95th percentile ${value.distributions.allRunScores.p05.toFixed(2)}–${value.distributions.allRunScores.p95.toFixed(2)}.`,
    `- Seed-block headline SD: ${value.distributions.seedBlockHeadlines.standardDeviation.toFixed(2)}; ` +
      `case identity explains ${(100 * value.arithmeticVarianceDecomposition.caseFraction).toFixed(1)}% of arithmetic run-score variation, ` +
      `seed identity ${(100 * value.arithmeticVarianceDecomposition.seedFraction).toFixed(1)}%.`,
    "",
    "The headline is a weighted hierarchical geometric aggregate. Arithmetic means, correlations, and variance fractions below are descriptive diagnostics; none replaces the official headline.",
    "",
    "## Run-score histogram",
    "",
    "| Score range | Runs | Share |",
    "|---|---:|---:|",
    ...value.distributions.runScoreHistogram
      .filter((entry: any) => entry.count > 0)
      .map((entry: any) => `| ${entry.range} | ${entry.count} | ${(100 * entry.fraction).toFixed(1)}% |`),
    "",
    "## Suite hierarchy",
    "",
    `| Stratum | Weight | Score | Contribution to ${value.headline.gapToTarget.toFixed(2)}-point target gap |`,
    "|---|---:|---:|---:|",
    ...value.hierarchy.strata.map((entry: any) =>
      `| ${entry.id} | ${(100 * entry.weight).toFixed(0)}% | ${entry.score.toFixed(2)} | ` +
        `${entry.targetGapContribution.toFixed(2)} (${(100 * entry.targetGapShare).toFixed(1)}%) |`
    ),
    "",
    "| Largest weighted group gaps | Stratum | Campaign weight | Score | Target-gap contribution |",
    "|---|---|---:|---:|---:|",
    ...[...value.hierarchy.groups]
      .sort((a: any, b: any) => b.targetGapContribution - a.targetGapContribution)
      .slice(0, 8)
      .map((entry: any) =>
        `| ${entry.id} | ${entry.stratum} | ${(100 * entry.campaignWeight).toFixed(1)}% | ` +
          `${entry.score.toFixed(2)} | ${entry.targetGapContribution.toFixed(2)} |`
      ),
    "",
    "## Case behavior",
    "",
    "| Lowest cases | Official score | Valid | Run SD | Impact quality |",
    "|---|---:|---:|---:|---:|",
    ...lowest.map(caseRow),
    "",
    "| Highest cases | Official score | Valid | Run SD | Impact quality |",
    "|---|---:|---:|---:|---:|",
    ...highest.map(caseRow),
    "",
    "| Most seed-sensitive cases | Official score | Run SD | 5th–95th percentile |",
    "|---|---:|---:|---:|",
    ...volatile.map((entry: any) =>
      `| ${entry.sourceId} | ${entry.officialScore.toFixed(2)} | ${entry.score.standardDeviation.toFixed(2)} | ` +
      `${entry.score.p05.toFixed(2)}–${entry.score.p95.toFixed(2)} |`
    ),
    "",
    "## Components and associations",
    "",
    "| Component | Runs | Quality median | Quality mean | RMS-error median |",
    "|---|---:|---:|---:|---:|",
    ...Object.entries(value.components).map(([name, entry]: [string, any]) =>
      `| ${name} | ${entry.runCoverage} | ${entry.quality.median.toFixed(3)} | ` +
      `${entry.quality.mean.toFixed(3)} | ${entry.rmsError.median.toFixed(3)} |`
    ),
    "",
    "| Relationship | N | Pearson r | Spearman ρ |",
    "|---|---:|---:|---:|",
    ...value.correlations.map((entry: any) =>
      `| ${entry.left} ↔ ${entry.right} | ${entry.observations} | ${entry.pearson.toFixed(3)} | ${entry.spearman.toFixed(3)} |`
    ),
    "",
    "Correlations are observational and partly mechanical because the official score includes eligible component qualities. They do not identify causal compiler mechanisms.",
    "",
    "## Contacted-frame impact observations",
    "",
    `Across ${value.impactObservationAnalysis.count.toLocaleString("en-US")} authored gap observations, target–achieved ` +
      `Pearson correlation is ${value.impactObservationAnalysis.targetAchievedCorrelation.pearson.toFixed(3)} ` +
      `(Spearman ${value.impactObservationAnalysis.targetAchievedCorrelation.spearman.toFixed(3)}). ` +
      `Median absolute error is ${value.impactObservationAnalysis.absoluteError.median.toFixed(4)}; ` +
      `RMS error is ${value.impactObservationAnalysis.rmsError.toFixed(4)}.`,
    "",
    `Mean achieved impulse is ${value.impactObservationAnalysis.delivery.meanAchieved.toFixed(3)} against a mean target of ` +
      `${value.impactObservationAnalysis.delivery.meanTarget.toFixed(3)}. ` +
      `${(100 * value.impactObservationAnalysis.delivery.underTargetFraction).toFixed(1)}% of observations are below target; ` +
      `${(100 * value.impactObservationAnalysis.delivery.within010Fraction).toFixed(1)}% land within ±0.10. ` +
      `The descriptive linear fit is achieved ≈ ${value.impactObservationAnalysis.delivery.linearFit.intercept.toFixed(3)} + ` +
      `${value.impactObservationAnalysis.delivery.linearFit.slope.toFixed(3)} × target ` +
      `(R² ${value.impactObservationAnalysis.delivery.linearFit.rSquared.toFixed(3)}).`,
    "",
    "| Target band | Observations | Target mean | Achieved mean | Signed error | MAE | RMS |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...value.impactObservationAnalysis.targetBands.map((entry: any) =>
      `| ${entry.targetRange} | ${entry.count} | ${entry.targetMean.toFixed(3)} | ` +
      `${entry.achievedMean.toFixed(3)} | ${entry.signedResidualMean.toFixed(3)} | ` +
      `${entry.meanAbsoluteError.toFixed(3)} | ${entry.rmsError.toFixed(3)} |`
    ),
    "",
    value.invalidRunDiagnostics.length > 0
      ? "## Seed stability and invalid rows"
      : "## Seed stability",
    "",
    "| Most influential seed removals | Seed slot / actual | Seed headline | Valid | LOO headline change |",
    "|---|---|---:|---:|---:|",
    ...seedInfluence.map((entry: any) =>
      `| ${entry.seedSlot} / ${entry.actualSeed} | ${entry.headline.toFixed(2)} | ` +
      `${entry.validRuns}/${entry.totalRuns} | ${signed(entry.leaveOneSeedOutChange)} |`
    ),
    "",
    ...value.invalidRunDiagnostics.flatMap((entry: any) => [
      `The sole invalid row is \`${entry.sourceId}\`, seed ${entry.actualSeed}: ` +
        `${entry.hardFailures.join(", ")}. Its official hard zero is retained.`,
      "",
      `A diagnostic-only replacement with that case's valid-run median would move the headline by ` +
        `${signed(entry.diagnosticHeadlineChange)} to ${entry.diagnosticHeadline.toFixed(4)}. ` +
        `This is an influence estimate, not an alternate baseline.`,
      "",
    ]),
    "## Parent/variant diagnostics",
    "",
    value.pairedVariantDiagnostics.caution,
    "",
    "| Most negative paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |",
    "|---|---|---:|---:|---:|",
    ...variants.slice(0, 6).map(variantRow),
    "",
    "| Most positive paired differences | Parent → variant | Mean run difference | 95% paired interval | Aggregate difference |",
    "|---|---|---:|---:|---:|",
    ...variants.slice(-6).reverse().map(variantRow),
    "",
    "## Practical interpretation",
    "",
    "- Numeric continuity across the scorer boundary would not establish unchanged quality: this baseline lives in a new score coordinate system and deliberately contains no cross-ruler comparison.",
    "- The compiler is not blind to the promoted ruler. Current-gap candidate cost consumes the shared current impact measurement, while impact target plumbing, geometry steering, and readiness remain active. The strong target–achieved rank association is consistent with partial alignment, not proof that those mechanisms are optimal.",
    "- Capability is the dominant weighted bottleneck. Dense recovery and rapid pickup alone account for nearly half of the gap to 650; development music is low but has only 5% campaign weight.",
    "- The clearest impact-specific defect is systematic under-delivery, especially for 0.8–1.0 asks. That is a better optimization target than the raw scorer-boundary headline resemblance.",
    "- The case ranking and component correlations identify where this compiler struggles under the new ruler; they do not show whether the ruler change improved or worsened the compiler.",
    "- Impact target-band residuals show whether errors grow systematically with authored impulse demand. Those bands are a more useful optimization diagnostic than comparing this headline to the old-ruler headline.",
    "- Future candidates should be compared only against this exact active archive on the literal N=48 seed schedule.",
  ].join("\n")}\n`;
}

function caseRow(entry: any): string {
  return `| ${entry.sourceId} | ${entry.officialScore.toFixed(2)} | ` +
    `${entry.validity.valid}/${entry.validity.total} | ${entry.score.standardDeviation.toFixed(2)} | ` +
    `${entry.impactQuality.mean.toFixed(3)} |`;
}

function variantRow(entry: any): string {
  return `| ${entry.parentId} → ${entry.variantId} | ${entry.meanPairedRunScoreDifference.toFixed(2)} | ` +
    `${entry.paired95Interval[0].toFixed(2)}–${entry.paired95Interval[1].toFixed(2)} | ` +
    `${signed(entry.officialAggregateDifference)} |`;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(4)}`;
}

function groupBy<T>(values: T[], key: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) {
    const id = key(value);
    const group = result.get(id) ?? [];
    group.push(value);
    result.set(id, group);
  }
  return result;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function safeMean(values: number[]): number {
  return values.length === 0 ? 0 : round(mean(values));
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const center = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1));
}

function rms(values: number[]): number {
  return values.length === 0 ? 0 : round(Math.sqrt(mean(values.map((value) => value * value))));
}

function quantile(values: number[], probability: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return round(sorted[lower] + fraction * (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]));
}

function rangeStops(start: number, end: number, step: number): number[] {
  const values = [];
  for (let value = start; value < end; value += step) values.push(value);
  values.push(end);
  return values;
}

function ranges(stops: number[]): Array<{ low: number; high: number }> {
  return stops.slice(0, -1).map((low, index) => ({ low, high: stops[index + 1] }));
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function write(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function relative(path: string): string {
  const prefix = `${process.cwd()}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}
