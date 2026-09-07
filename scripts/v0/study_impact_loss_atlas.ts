/**
 * Reproducible, zero-compile impact-loss atlas for the active campaign baseline.
 *
 * It verifies the retained archive against campaign-baseline.json, replays the
 * exact headline, and prices mutually descriptive slices by changing only the
 * retained per-gap impact residual before passing the runs back through the
 * production decision aggregation. Slice gains are counterfactual ceilings;
 * because the score is nonlinear they are not additive.
 *
 *   npx tsx scripts/v0/study_impact_loss_atlas.ts
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { activeCampaignAnalysisContract } from "../benchmark/campaign_baseline_analysis_contract.ts";
import { loadVerifiedAnalysisArchive } from "./benchmark_v2/analysis_archive.ts";
import { v2HeadlineForDecisionRuns, type DecisionRun } from "./benchmark_v2/decision_model.ts";
import { loadSourceManifest, resolveSources } from "./benchmark_v2/model.ts";
import { loadSuiteManifest } from "./benchmark_v2/suite_model.ts";

type Component = { rmsError: number; weight: number };
type Observation = {
  index: number;
  sourceId: string;
  cohort: string;
  originFamily: string;
  actualSeed: number;
  gapIndex: number;
  durationFrames: number;
  target: number;
  achieved: number;
  signedResidual: number;
  absoluteError: number;
  squaredError: number;
  feasibilityBound: number | null;
  feasibility: "within_bound" | "beyond_bound" | "unknown";
  deliveryRatio: number | null;
  boundDeliveryRatio: number | null;
  speedTarget: number | null;
  speedAchieved: number | null;
  meanGapSpeedPxPerFrame: number | null;
  airTarget: number | null;
  airAchieved: number | null;
  nextGapImpactSquaredError: number | null;
  nextGapAxisSquaredError: number | null;
  runIndex: number;
};

type AtlasRun = DecisionRun & {
  originalScore: number;
  components: Record<string, Component>;
  impactObservations: Observation[];
};

type Slice = {
  label: string;
  observations: number;
  runs: number;
  impactSquaredError: number;
  impactSquaredErrorShare: number;
  meanTarget: number | null;
  meanAchieved: number | null;
  meanSignedResidual: number | null;
  underTargetFraction: number | null;
  withinFeasibilityFraction: number | null;
  headlineAtResidual75Percent: number;
  headlineGainAtResidual75Percent: number;
  headlineAtZeroResidual: number;
  headlineGainAtZeroResidual: number;
};

function argument(name: string): string | undefined {
  return process.argv.slice(2).find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

const baselinePath = resolve(argument("baseline") ?? "benchmark/v2/campaign-baseline.json");
const outPath = resolve(argument("out") ?? "benchmark/v2/studies/impact-delivery-650-baseline-atlas.json");
const markdownPath = resolve(argument("markdown") ?? "docs/impact-delivery-650-baseline-atlas.md");
const baselineBytes = readFileSync(baselinePath);
const baseline = JSON.parse(baselineBytes.toString("utf8"));
if (baseline.status !== "active-campaign-baseline") throw new Error("campaign baseline is not active");
if (JSON.stringify(baseline.scope?.budgets) !== JSON.stringify([750_000])) {
  throw new Error("impact atlas requires the frozen 750k campaign scope");
}
const archivePath = resolve(baseline.development.compressed_archive);
const verified = await loadVerifiedAnalysisArchive(archivePath, {
  archive_sha256: baseline.development.archive_sha256,
  compressed_archive_sha256: baseline.development.compressed_archive_sha256,
});
const archive = verified.archive;
if (
  archive.identity?.suiteFingerprint !== baseline.suite_fingerprint ||
  archive.identity?.scoringProtocolFingerprint !== baseline.scoring_protocol_fingerprint ||
  archive.git?.candidateFingerprint !== baseline.candidate_fingerprint ||
  archive.identity?.engine !== "wasm" ||
  archive.mode !== "development" ||
  archive.profile !== "canonical"
) throw new Error("retained archive identity does not match the active campaign baseline");

const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
const analysisContract = activeCampaignAnalysisContract(baseline, archive, sources.length);
const sourceById = new Map(sources.map((source) => [source.id, source]));
const loadedSuite = loadSuiteManifest("benchmark/v2/compat/suite-manifest.json", sources);
const seedDepth = analysisContract.promotionSeeds;
const suite = {
  ...loadedSuite,
  profiles: {
    ...loadedSuite.profiles,
    canonical: { ...loadedSuite.profiles.canonical, budgets: [750_000], seeds_per_budget: seedDepth },
  },
};

const observations: Observation[] = [];
const runs: AtlasRun[] = archive.runs.map((row: any, runIndex: number) => {
  const source = sourceById.get(row.task.sourceId);
  if (source === undefined) throw new Error(`unknown source ${row.task.sourceId}`);
  const gaps = row.report?.gaps ?? [];
  const impactObservations: Observation[] = gaps.flatMap((gap: any, gapOffset: number) => {
    const impact = gap.axes?.impact;
    if (impact === undefined) return [];
    const priorEnd = gapOffset === 0 ? 0 : Number(gaps[gapOffset - 1]?.t_end ?? 0);
    const next = gaps[gapOffset + 1];
    const nextImpactError = finiteOrNull(next?.axes?.impact?.error);
    const nextAxisErrors = Object.values(next?.axes ?? {}).flatMap((axis: any) => {
      const error = finiteOrNull(axis?.error);
      return error === null ? [] : [error];
    });
    const target = finite(impact.target, "impact target");
    const achieved = finite(impact.achieved, "impact achieved");
    const signedResidual = achieved - target;
    const feasibilityBound = finiteOrNull(impact.feasibility_bound);
    const value: Observation = {
      index: observations.length,
      sourceId: row.task.sourceId,
      cohort: source.role,
      originFamily: source.originFamily,
      actualSeed: row.task.actualSeed,
      gapIndex: gap.gap_index,
      durationFrames: Math.round((finite(gap.t_end, "gap end") - priorEnd) * 40),
      target,
      achieved,
      signedResidual,
      absoluteError: Math.abs(signedResidual),
      squaredError: signedResidual * signedResidual,
      feasibilityBound,
      feasibility: feasibilityBound === null
        ? "unknown"
        : target <= feasibilityBound ? "within_bound" : "beyond_bound",
      deliveryRatio: target > 0 ? achieved / target : null,
      boundDeliveryRatio: feasibilityBound !== null && feasibilityBound > 0 ? achieved / feasibilityBound : null,
      speedTarget: finiteOrNull(gap.axes?.speed?.target),
      speedAchieved: finiteOrNull(gap.axes?.speed?.achieved),
      meanGapSpeedPxPerFrame: finiteOrNull(gap.axes?.speed?.raw?.achieved),
      airTarget: finiteOrNull(gap.axes?.air?.target),
      airAchieved: finiteOrNull(gap.axes?.air?.achieved),
      nextGapImpactSquaredError: nextImpactError === null ? null : nextImpactError * nextImpactError,
      nextGapAxisSquaredError: nextAxisErrors.length === 0
        ? null
        : nextAxisErrors.reduce((sum, error) => sum + error * error, 0),
      runIndex,
    };
    observations.push(value);
    return [value];
  });
  return {
    sourceId: row.task.sourceId,
    budget: row.task.budget,
    seedSlot: row.task.seedSlot,
    actualSeed: row.task.actualSeed,
    score: { score: row.score.score, valid: row.score.valid },
    originalScore: row.score.score,
    components: row.score.components ?? {},
    impactObservations,
  };
});
if (archive.runs.some((row: any) => row.status !== "ok") || runs.some((run) => !run.score.valid)) {
  throw new Error(
    `impact atlas requires the complete ${analysisContract.expectedRows}/${analysisContract.expectedRows} valid N=${seedDepth} promotion prefix`,
  );
}

const headline = (score: (run: AtlasRun) => number): number => v2HeadlineForDecisionRuns(
  runs.map((run) => ({ ...run, score: { score: score(run), valid: true } })),
  suite,
  "canonical",
);
const baseHeadline = headline((run) => run.originalScore);
if (Math.abs(baseHeadline - baseline.development.canonical_headline) > 0.000_05) {
  throw new Error(`headline replay mismatch: ${baseHeadline} != ${baseline.development.canonical_headline}`);
}

const totalImpactSquaredError = observations.reduce((sum, observation) => sum + observation.squaredError, 0);
const observationFingerprint = createHash("sha256");
for (const observation of observations) {
  observationFingerprint.update(JSON.stringify([
    observation.sourceId,
    observation.actualSeed,
    observation.gapIndex,
    observation.target,
    observation.achieved,
    observation.feasibilityBound,
    observation.durationFrames,
    observation.speedTarget,
    observation.speedAchieved,
    observation.nextGapAxisSquaredError,
  ]));
  observationFingerprint.update("\n");
}
const allIndexes = new Set(observations.map((observation) => observation.index));
const allResidual75 = counterfactualHeadline(allIndexes, 0.75);
const allResidual0 = counterfactualHeadline(allIndexes, 0);

function counterfactualHeadline(selected: ReadonlySet<number>, factor: number): number {
  return headline((run) => {
    const impact = run.components.impact;
    if (impact === undefined || run.impactObservations.every((observation) => !selected.has(observation.index))) {
      return run.originalScore;
    }
    const originalImpactMeanSquare = mean(run.impactObservations.map((observation) => observation.squaredError));
    const changedImpactMeanSquare = mean(run.impactObservations.map((observation) =>
      observation.squaredError * (selected.has(observation.index) ? factor * factor : 1)
    ));
    let weightedSum = 0;
    let weight = 0;
    for (const [name, component] of Object.entries(run.components)) {
      weightedSum += component.weight * (name === "impact" ? changedImpactMeanSquare : component.rmsError ** 2);
      weight += component.weight;
    }
    const reconstructedOriginalWeightedSum = weightedSum - impact.weight * changedImpactMeanSquare +
      impact.weight * originalImpactMeanSquare;
    const reconstructedOriginal = scoreFromRms(Math.sqrt(reconstructedOriginalWeightedSum / weight));
    const changed = scoreFromRms(Math.sqrt(weightedSum / weight));
    return Math.max(0, Math.min(1000, run.originalScore + changed - reconstructedOriginal));
  });
}

function slicesFor(
  classifier: (observation: Observation) => string,
): Slice[] {
  const groups = new Map<string, Observation[]>();
  for (const observation of observations) {
    const label = classifier(observation);
    const group = groups.get(label);
    if (group === undefined) groups.set(label, [observation]);
    else group.push(observation);
  }
  return [...groups].map(([label, selected]) => {
    const indexes = new Set(selected.map((observation) => observation.index));
    const squaredError = selected.reduce((sum, observation) => sum + observation.squaredError, 0);
    const residual75 = counterfactualHeadline(indexes, 0.75);
    const residual0 = counterfactualHeadline(indexes, 0);
    const feasible = selected.filter((observation) => observation.feasibility !== "unknown");
    return {
      label,
      observations: selected.length,
      runs: new Set(selected.map((observation) => observation.runIndex)).size,
      impactSquaredError: round(squaredError),
      impactSquaredErrorShare: round(squaredError / totalImpactSquaredError),
      meanTarget: safeMean(selected.map((observation) => observation.target)),
      meanAchieved: safeMean(selected.map((observation) => observation.achieved)),
      meanSignedResidual: safeMean(selected.map((observation) => observation.signedResidual)),
      underTargetFraction: safeMean(selected.map((observation) => observation.signedResidual < 0 ? 1 : 0)),
      withinFeasibilityFraction: safeMean(feasible.map((observation) => observation.feasibility === "within_bound" ? 1 : 0)),
      headlineAtResidual75Percent: round(residual75),
      headlineGainAtResidual75Percent: round(residual75 - baseHeadline),
      headlineAtZeroResidual: round(residual0),
      headlineGainAtZeroResidual: round(residual0 - baseHeadline),
    };
  }).sort((left, right) => right.headlineGainAtResidual75Percent - left.headlineGainAtResidual75Percent);
}

const speedCuts = quantileCuts(observations.flatMap((observation) =>
  observation.meanGapSpeedPxPerFrame === null ? [] : [observation.meanGapSpeedPxPerFrame]
));
const nextPriceCuts = quantileCuts(observations.flatMap((observation) =>
  observation.nextGapAxisSquaredError === null ? [] : [observation.nextGapAxisSquaredError]
));
const atlas = {
  schema: "line.impact-delivery-loss-atlas.v2",
  // Keep the aggregate artifact byte-reproducible. Its identity is the frozen
  // campaign baseline, so use that baseline's publication timestamp rather
  // than the wall clock of whichever machine replays it.
  generatedAt: String(baseline.generated_at),
  identity: {
    baselineLabel: baseline.label,
    baselineFingerprint: createHash("sha256").update(baselineBytes).digest("hex"),
    compilerSourceFingerprint: baseline.compiler_source_fingerprint,
    candidateFingerprint: baseline.candidate_fingerprint,
    engineArtifactFingerprint: baseline.engine_artifact_fingerprint,
    suiteFingerprint: baseline.suite_fingerprint,
    scoringProtocolFingerprint: baseline.scoring_protocol_fingerprint,
    archive: baseline.development.compressed_archive,
    archiveSha256: baseline.development.archive_sha256,
    compressedArchiveSha256: baseline.development.compressed_archive_sha256,
    promotionSeeds: seedDepth,
  },
  cohortContract: {
    discoverySeeds: [700, 701, 702, 703, 704, 705, 706, 707],
    validationSeeds: [708, 709, 710, 711, 712, 713, 714, 715],
    scaleSeeds: range(716, 731),
    finalConfirmationSeeds: range(732, 779),
    returnCellDiscoverySeeds: range(780, 787),
    returnCellValidationSeeds: range(788, 795),
    returnCellScaleSeeds: range(796, 811),
    returnCellFinalConfirmationSeeds: range(812, 859),
    productionSeeds: [14003, 14004, 14005],
  },
  measurementCoverage: {
    retained: [
      "source and cohort", "authored target", "achieved impact", "signed residual",
      "feasibility bound", "gap duration", "speed target and delivery", "air target and delivery",
      "next-gap axis error",
    ],
    requiresFreshTrace: [
      "incoming tangent/normal state", "contacted-frame duration", "contact point ownership",
      "release state", "next-contact continuation outcome",
    ],
  },
  replay: {
    runs: runs.length,
    observations: observations.length,
    validRuns: runs.filter((run) => run.score.valid).length,
    headline: round(baseHeadline),
    allImpactResidual75Percent: {
      headline: round(allResidual75), gain: round(allResidual75 - baseHeadline),
    },
    allImpactResidualZero: {
      headline: round(allResidual0), gain: round(allResidual0 - baseHeadline),
    },
    totalImpactSquaredError: round(totalImpactSquaredError),
    observationFingerprint: observationFingerprint.digest("hex"),
  },
  bins: {
    target: slicesFor((observation) => numericBand(observation.target, [0, 0.12, 0.20, 0.28, 0.40, 0.55, 0.73, 1.000_001])),
    deliveryRatio: slicesFor((observation) => observation.deliveryRatio === null
      ? "undefined"
      : numericBand(observation.deliveryRatio, [0, 0.50, 0.65, 0.80, 0.95, 1.05, 1.25, Number.POSITIVE_INFINITY])),
    feasibility: slicesFor((observation) => observation.feasibility),
    durationFrames: slicesFor((observation) => numericBand(observation.durationFrames, [0, 11, 17, 25, 41, Number.POSITIVE_INFINITY])),
    meanGapSpeedPxPerFrame: slicesFor((observation) => observation.meanGapSpeedPxPerFrame === null
      ? "unavailable"
      : quantileBand(observation.meanGapSpeedPxPerFrame, speedCuts)),
    nextGapAxisPrice: slicesFor((observation) => observation.nextGapAxisSquaredError === null
      ? "terminal"
      : quantileBand(observation.nextGapAxisSquaredError, nextPriceCuts)),
    cohort: slicesFor((observation) => observation.cohort),
    originFamily: slicesFor((observation) => observation.originFamily),
    source: slicesFor((observation) => observation.sourceId),
  },
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(atlas, null, 2)}\n`);
mkdirSync(dirname(markdownPath), { recursive: true });
writeFileSync(markdownPath, markdown(atlas));
console.log(`baseline    ${baseline.label}`);
console.log(`headline    ${baseHeadline.toFixed(4)}`);
console.log(`observed    ${observations.length.toLocaleString("en-US")} impact gaps across ${runs.length} runs`);
console.log(`impact x.75 ${allResidual75.toFixed(2)} (${signed(allResidual75 - baseHeadline)})`);
console.log(`impact x.00 ${allResidual0.toFixed(2)} (${signed(allResidual0 - baseHeadline)})`);
console.log(`json        ${outPath}`);
console.log(`markdown    ${markdownPath}`);

function markdown(value: typeof atlas): string {
  const table = (title: string, rows: Slice[], limit = rows.length): string => [
    `## ${title}`,
    "",
    "| slice | observations | impact SSE share | mean target | mean achieved | gain at residual ×0.75 | zero-residual ceiling |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...rows.slice(0, limit).map((row) =>
      `| ${row.label} | ${row.observations.toLocaleString("en-US")} | ${(100 * row.impactSquaredErrorShare).toFixed(1)}% | ` +
      `${format(row.meanTarget)} | ${format(row.meanAchieved)} | ${signed(row.headlineGainAtResidual75Percent)} | ${signed(row.headlineGainAtZeroResidual)} |`
    ),
    "",
  ].join("\n");
  return [
    "# Impact Delivery 650 Baseline Loss Atlas",
    "",
    `Baseline: \`${value.identity.baselineLabel}\`. Archive: \`${value.identity.archive}\`.`,
    "",
    `The exact 750k/N=${value.identity.promotionSeeds} replay is **${value.replay.headline.toFixed(4)}** across ` +
      `${value.replay.validRuns.toLocaleString("en-US")}/${value.replay.runs.toLocaleString("en-US")} valid runs and ` +
      `${value.replay.observations.toLocaleString("en-US")} impact observations. Reducing every retained impact residual ` +
      `to 75% replays to **${value.replay.allImpactResidual75Percent.headline.toFixed(2)}** ` +
      `(${signed(value.replay.allImpactResidual75Percent.gain)}). These values are nonlinear counterfactual ceilings, not additive forecasts.`,
    "",
    "The accepted archive retains targets, delivered axes, feasibility, timing, and next-gap score price. Exact incoming " +
      "tangent/normal state, contacted-frame duration, collision ownership, release state, and continuation outcome require the frozen fresh trace; the atlas names that absence rather than inferring it.",
    "",
    table("Authored impact target", value.bins.target),
    table("Feasibility", value.bins.feasibility),
    table("Delivery ratio", value.bins.deliveryRatio),
    table("Gap duration", value.bins.durationFrames),
    table("Mean gap speed quartile", value.bins.meanGapSpeedPxPerFrame),
    table("Next-gap axis-price quartile", value.bins.nextGapAxisPrice),
    table("Cohort", value.bins.cohort),
    table("Largest source ceilings", value.bins.source, 16),
    "## Historical first-tranche cohorts",
    "",
    "These are the original campaign's cohorts, not fresh reservations for a later campaign. " +
      "First-tranche discovery 700–707; held-out validation 708–715; scale/source-spread 716–731; final confirmation 732–779. " +
      "Return-cell discovery 780–787; validation 788–795; scale 796–811; final confirmation 812–859. Production 14003–14005.",
    "",
  ].join("\n");
}

function numericBand(value: number, stops: readonly number[]): string {
  for (let index = 0; index < stops.length - 1; index++) {
    if (value >= stops[index]! && value < stops[index + 1]!) {
      const high = stops[index + 1] === Number.POSITIVE_INFINITY ? "∞" : trim(stops[index + 1]!);
      return `[${trim(stops[index]!)},${high})`;
    }
  }
  return `outside(${trim(value)})`;
}

function quantileCuts(values: number[]): [number, number, number] {
  const sorted = [...values].sort((left, right) => left - right);
  return [quantile(sorted, 0.25), quantile(sorted, 0.5), quantile(sorted, 0.75)];
}

function quantileBand(value: number, cuts: [number, number, number]): string {
  if (value <= cuts[0]) return `Q1 ≤${trim(cuts[0])}`;
  if (value <= cuts[1]) return `Q2 ≤${trim(cuts[1])}`;
  if (value <= cuts[2]) return `Q3 ≤${trim(cuts[2])}`;
  return `Q4 >${trim(cuts[2])}`;
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) throw new Error("cannot take quantile of empty values");
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return sorted[lower]! + ((sorted[lower + 1] ?? sorted[lower]!) - sorted[lower]!) * fraction;
}

function scoreFromRms(rms: number): number {
  return 1000 * Math.exp(-rms / 0.25);
}

function range(low: number, high: number): number[] {
  return Array.from({ length: high - low + 1 }, (_, index) => low + index);
}

function finite(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mean(values: number[]): number {
  if (values.length === 0) throw new Error("cannot take mean of empty values");
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function safeMean(values: number[]): number | null {
  return values.length === 0 ? null : round(mean(values));
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function trim(value: number): string {
  return Number(value.toFixed(4)).toString();
}

function format(value: number | null): string {
  return value === null ? "—" : value.toFixed(3);
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}
