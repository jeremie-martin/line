import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  AxisName,
  AxisValues,
  CompileStats,
  DriftReport,
  GapAxisReport,
} from "./types.ts";

type StudyRun = {
  task: { sourceId: string; budget: number; actualSeed: number };
  source: { id: string; originFamily?: string };
  status: string;
  score: { score: number; valid: boolean };
  report: DriftReport;
  stats: CompileStats;
  trackHash: string;
};

type StudyArtifact = {
  runs: StudyRun[];
  candidate?: { candidateFingerprint?: string };
};

type SelectedCertificate = NonNullable<
  CompileStats["handoff_repair_aux_selected_certificates"]
>[number];

type CertificateRow = ReturnType<typeof certificateRow>;
type RunRow = ReturnType<typeof runRow>;

const DEFAULT_DIAGNOSTIC =
  "generated/benchmark-v2/studies/four-priority-repair-aux-certificate-heldout.json";
const DEFAULT_ARCHIVED_CANDIDATE =
  "generated/benchmark-v2/impact-delivery-650/curve-joint-first-base-conservative-pareto-interaction-validation-n4-750k/candidate.json";
const DEFAULT_REFERENCE =
  "generated/benchmark-v2/impact-delivery-650/curve-joint-first-base-conservative-pareto-interaction-validation-n4-750k/reference.json";
const DEFAULT_OUT =
  "generated/benchmark-v2/studies/four-priority-repair-aux-certificate-join.json";

const args = process.argv.slice(2);
const argument = (name: string, fallback: string): string => {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
};

const diagnosticPath = resolve(argument("diagnostic", DEFAULT_DIAGNOSTIC));
const archivedCandidatePath = resolve(argument("archived-candidate", DEFAULT_ARCHIVED_CANDIDATE));
const referencePath = resolve(argument("reference", DEFAULT_REFERENCE));
const outPath = resolve(argument("out", DEFAULT_OUT));

const diagnostic = readArtifact(diagnosticPath);
const archivedCandidate = readArtifact(archivedCandidatePath);
const reference = readArtifact(referencePath);
const archivedByKey = new Map(archivedCandidate.runs.map((run) => [runKey(run), run]));
const referenceByKey = new Map(reference.runs.map((run) => [runKey(run), run]));

const rows: CertificateRow[] = [];
const runRows: RunRow[] = [];
for (const candidate of diagnostic.runs) {
  const archived = archivedByKey.get(runKey(candidate));
  const baseline = referenceByKey.get(runKey(candidate));
  if (archived === undefined || baseline === undefined) {
    throw new Error(`missing archived pair for ${runKey(candidate)}`);
  }
  const certificates = candidate.stats.handoff_repair_aux_selected_certificates ?? [];
  const certificateRows = certificates.map((certificate, certificateIndex) =>
    certificateRow(candidate, baseline, certificate, certificateIndex)
  );
  rows.push(...certificateRows);
  runRows.push(runRow(candidate, archived, baseline, certificateRows));
}

const selectedRuns = runRows.filter((row) => row.certificateCount > 0);
const noSelectionRuns = runRows.filter((row) => row.certificateCount === 0);
const ruleStudy = studySingleFeatureRules(selectedRuns);
const output = {
  schema: "line.handoff.repair-aux-selection-join.v1",
  purpose:
    "Join observation-only repair auxiliary selections to exact final current/next gaps and paired whole-track outcomes.",
  caveats: [
    "Rows are post-selection observations, not randomized candidate-level treatment effects.",
    "Adjacent or repeated fits in one returned track are dependent.",
    "Rule screening is descriptive and cannot establish a new selector without held-out causal validation.",
  ],
  inputs: {
    diagnostic: describeInput(diagnosticPath, diagnostic),
    archivedCandidate: describeInput(archivedCandidatePath, archivedCandidate),
    reference: describeInput(referencePath, reference),
  },
  identity: {
    pairedRuns: runRows.length,
    diagnosticTrackHashesMatchingArchivedCandidate:
      runRows.filter((row) => row.diagnosticMatchesArchivedCandidate).length,
    allDiagnosticTracksMatchArchivedCandidate:
      runRows.every((row) => row.diagnosticMatchesArchivedCandidate),
  },
  summary: {
    certificates: rows.length,
    runsWithSelectedAuxiliary: selectedRuns.length,
    runsWithoutSelectedAuxiliary: noSelectionRuns.length,
    selectedRunScoreDelta: summarize(selectedRuns.map((row) => row.wholeScoreDelta)),
    noSelectionRunScoreDelta: summarize(noSelectionRuns.map((row) => row.wholeScoreDelta)),
    selectedPositiveRuns: selectedRuns.filter((row) => row.wholeScoreDelta > 1e-9).length,
    selectedNegativeRuns: selectedRuns.filter((row) => row.wholeScoreDelta < -1e-9).length,
    selectedPlateauRuns: selectedRuns.filter((row) => Math.abs(row.wholeScoreDelta) <= 1e-9).length,
    emissionLocalSseGain: summarize(rows.map((row) => row.emissionLocalSseGain)),
    emissionProjectedOutgoingGain: summarize(
      rows.map((row) => row.emissionProjectedOutgoingGain).filter(isNumber),
    ),
    finalCurrentSseDeltaVsReference: summarize(
      rows.map((row) => row.finalCurrentSseDeltaVsReference).filter(isNumber),
    ),
    finalNextSseDeltaVsReference: summarize(
      rows.map((row) => row.finalNextSseDeltaVsReference).filter(isNumber),
    ),
  },
  sourceBlindSingleFeatureRuleStudy: ruleStudy,
  conclusion: ruleStudy.noLossRuleAtRequiredCoverage === null
    ? "No one-feature, source-blind admission-time completion certificate separates the held-out losses at meaningful coverage."
    : "A descriptive no-loss threshold exists in this sample, but requires independent causal validation before it can be treated as a certificate.",
  runs: runRows,
  certificates: rows,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ out: outPath, ...output.identity, ...output.summary }, null, 2));

function readArtifact(path: string): StudyArtifact {
  return JSON.parse(readFileSync(path, "utf8")) as StudyArtifact;
}

function runKey(run: StudyRun): string {
  return [run.task.sourceId, run.task.budget, run.task.actualSeed].join("\0");
}

function reportGap(report: DriftReport, gapIndex: number): GapAxisReport | null {
  return report.gaps.find((gap) => gap.gap_index === gapIndex) ?? null;
}

function reportSse(gap: GapAxisReport | null): number | null {
  if (gap === null) return null;
  return Object.values(gap.axes).reduce((sum, axis) => sum + axis.error * axis.error, 0);
}

function axisSquaredGain(
  targets: AxisValues,
  base: AxisValues,
  candidate: AxisValues,
  axis: AxisName,
): number | null {
  const target = targets[axis];
  const before = base[axis];
  const after = candidate[axis];
  if (target === undefined || before === undefined || after === undefined) return null;
  return (before - target) ** 2 - (after - target) ** 2;
}

function certificateRow(
  candidateRun: StudyRun,
  referenceRun: StudyRun,
  selected: SelectedCertificate,
  certificateIndex: number,
) {
  const emission = selected.emission;
  const referenceCurrent = reportGap(referenceRun.report, emission.gapIndex);
  const referenceNext = reportGap(referenceRun.report, emission.nextGapIndex);
  const finalCurrentSse = reportSse(selected.final_current_gap);
  const finalNextSse = reportSse(selected.final_next_gap);
  const referenceCurrentSse = reportSse(referenceCurrent);
  const referenceNextSse = reportSse(referenceNext);
  const projectedBefore = emission.base.projectedOutgoingQuality;
  const projectedAfter = emission.candidate.projectedOutgoingQuality;
  return {
    source: candidateRun.task.sourceId,
    originFamily: candidateRun.source.originFamily ?? null,
    seed: candidateRun.task.actualSeed,
    budget: candidateRun.task.budget,
    certificateIndex,
    selectedGapIndex: selected.selected_gap_index,
    gapIndex: emission.gapIndex,
    nextGapIndex: emission.nextGapIndex,
    admission: emission.admission,
    wholeScoreDelta: candidateRun.score.score - referenceRun.score.score,
    emissionLocalSseGain: emission.base.currentSse - emission.candidate.currentSse,
    emissionProjectedOutgoingGain:
      projectedBefore === null || projectedAfter === null
        ? null
        : projectedAfter - projectedBefore,
    emissionAxisSquaredGain: Object.fromEntries(
      (["air", "speed", "impact", "elevation", "amplitude"] as AxisName[]).map((axis) => [
        axis,
        axisSquaredGain(
          emission.currentTargets,
          emission.base.achieved,
          emission.candidate.achieved,
          axis,
        ),
      ]),
    ),
    emission,
    finalCurrentSse,
    referenceCurrentSse,
    finalCurrentSseDeltaVsReference:
      finalCurrentSse === null || referenceCurrentSse === null
        ? null
        : finalCurrentSse - referenceCurrentSse,
    finalNextSse,
    referenceNextSse,
    finalNextSseDeltaVsReference:
      finalNextSse === null || referenceNextSse === null
        ? null
        : finalNextSse - referenceNextSse,
    finalCurrentSseDeltaVsEmission:
      finalCurrentSse === null ? null : finalCurrentSse - emission.candidate.currentSse,
    finalCurrentGap: selected.final_current_gap,
    finalNextGap: selected.final_next_gap,
    referenceCurrentGap: referenceCurrent,
    referenceNextGap: referenceNext,
  };
}

function runRow(
  candidate: StudyRun,
  archived: StudyRun,
  reference: StudyRun,
  certificates: CertificateRow[],
) {
  const numberValues = (read: (row: CertificateRow) => number | null): number[] =>
    certificates.map(read).filter(isNumber);
  const axisMin = (axis: AxisName): number | null => {
    const values = certificates
      .map((row) => row.emissionAxisSquaredGain[axis])
      .filter(isNumber);
    return values.length === 0 ? null : Math.min(...values);
  };
  return {
    source: candidate.task.sourceId,
    originFamily: candidate.source.originFamily ?? null,
    seed: candidate.task.actualSeed,
    budget: candidate.task.budget,
    candidateScore: candidate.score.score,
    referenceScore: reference.score.score,
    wholeScoreDelta: candidate.score.score - reference.score.score,
    valid: `${Number(reference.score.valid)}->${Number(candidate.score.valid)}`,
    certificateCount: certificates.length,
    diagnosticTrackHash: candidate.trackHash,
    archivedCandidateTrackHash: archived.trackHash,
    referenceTrackHash: reference.trackHash,
    diagnosticMatchesArchivedCandidate: candidate.trackHash === archived.trackHash,
    admissionFeatures: {
      localGainSum: sum(numberValues((row) => row.emissionLocalSseGain)),
      localGainMin: minOrNull(numberValues((row) => row.emissionLocalSseGain)),
      localGainMean: meanOrNull(numberValues((row) => row.emissionLocalSseGain)),
      outgoingGainSum: sum(numberValues((row) => row.emissionProjectedOutgoingGain)),
      outgoingGainMin: minOrNull(numberValues((row) => row.emissionProjectedOutgoingGain)),
      outgoingGainMean: meanOrNull(numberValues((row) => row.emissionProjectedOutgoingGain)),
      impactGainMin: axisMin("impact"),
      speedGainMin: axisMin("speed"),
      airGainMin: axisMin("air"),
    },
    finalFeatures: {
      currentSseDeltaSum: sum(numberValues((row) => row.finalCurrentSseDeltaVsReference)),
      nextSseDeltaSum: sum(numberValues((row) => row.finalNextSseDeltaVsReference)),
    },
  };
}

function studySingleFeatureRules(runs: RunRow[]) {
  const requiredCoverage = Math.max(8, Math.ceil(runs.length / 4));
  const features = [
    "certificateCount",
    "localGainSum",
    "localGainMin",
    "localGainMean",
    "outgoingGainSum",
    "outgoingGainMin",
    "outgoingGainMean",
    "impactGainMin",
    "speedGainMin",
    "airGainMin",
  ] as const;
  const readFeature = (run: RunRow, feature: typeof features[number]): number | null =>
    feature === "certificateCount"
      ? run.certificateCount
      : run.admissionFeatures[feature];
  const rules = features.flatMap((feature) => {
    const values = [...new Set(runs.map((run) => readFeature(run, feature)).filter(isNumber))]
      .sort((a, b) => a - b);
    return values.flatMap((threshold) => ([">=", "<="] as const).map((direction) => {
      const selected = runs.filter((run) => {
        const value = readFeature(run, feature);
        return value !== null && (direction === ">=" ? value >= threshold : value <= threshold);
      });
      const deltas = selected.map((run) => run.wholeScoreDelta);
      return {
        feature,
        direction,
        threshold,
        coverage: selected.length,
        distinctSources: new Set(selected.map((run) => run.source)).size,
        positive: deltas.filter((delta) => delta > 1e-9).length,
        negative: deltas.filter((delta) => delta < -1e-9).length,
        scoreDeltaSum: sum(deltas),
        scoreDeltaMean: meanOrNull(deltas),
        bySeed: Object.fromEntries(
          [...new Set(selected.map((run) => run.seed))].sort((a, b) => a - b).map((seed) => [
            seed,
            summarize(selected.filter((run) => run.seed === seed).map((run) => run.wholeScoreDelta)),
          ]),
        ),
      };
    }));
  }).filter((rule) => rule.coverage >= requiredCoverage && rule.distinctSources >= 3);
  const ordered = [...rules].sort((a, b) =>
    (b.scoreDeltaMean ?? -Infinity) - (a.scoreDeltaMean ?? -Infinity) ||
    b.coverage - a.coverage
  );
  const noLoss = ordered.find((rule) => rule.negative === 0 && rule.scoreDeltaSum > 0) ?? null;
  return {
    population: runs.length,
    requiredCoverage,
    features,
    rulesScreenedAtRequiredCoverage: rules.length,
    bestMeanRule: ordered[0] ?? null,
    noLossRuleAtRequiredCoverage: noLoss,
  };
}

function describeInput(path: string, artifact: StudyArtifact) {
  const bytes = readFileSync(path);
  return {
    path,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    candidateFingerprint: artifact.candidate?.candidateFingerprint ?? null,
    runs: artifact.runs.length,
  };
}

function isNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function minOrNull(values: number[]): number | null {
  return values.length === 0 ? null : Math.min(...values);
}

function meanOrNull(values: number[]): number | null {
  return values.length === 0 ? null : sum(values) / values.length;
}

function summarize(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  const quantile = (p: number): number | null => {
    if (ordered.length === 0) return null;
    const index = (ordered.length - 1) * p;
    const low = Math.floor(index);
    const high = Math.ceil(index);
    if (low === high) return ordered[low];
    return ordered[low] + (ordered[high] - ordered[low]) * (index - low);
  };
  return {
    n: values.length,
    sum: sum(values),
    mean: meanOrNull(values),
    min: ordered[0] ?? null,
    p25: quantile(0.25),
    median: quantile(0.5),
    p75: quantile(0.75),
    max: ordered.at(-1) ?? null,
  };
}
