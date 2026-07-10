import { shiftedGeometricMean } from "../score.ts";
import { effectiveAxes, sliceTimeline } from "../core/substrate.ts";
import { secToFrame, type DriftReport, type Spec } from "../types.ts";
import type { EvaluationComponent } from "./model.ts";
import type { ComponentName, SuiteManifest } from "./suite_model.ts";

export const V2_RUN_SCORE_SCHEMA = "line.benchmark-v2.run-score.v2" as const;

export type AxisContract = {
  scored: Partial<Record<ComponentName, number[]>>;
  diagnostic: Partial<Record<ComponentName, number[]>>;
};

export type V2ComponentScore = {
  observations: number;
  rmsError: number;
  quality: number;
  weight: number;
};

export type V2RunScore = {
  schema: typeof V2_RUN_SCORE_SCHEMA;
  score: number;
  valid: boolean;
  scoringMode: "axis_quality" | "contact_only";
  hardFailures: string[];
  contacts: { authored: number; reported: number; hit: number; drift: number; missing: number };
  offBeatLandings: number;
  terminus: { frame: number; reason: string };
  weightedAxisRms: number | null;
  expectedObservations: Partial<Record<ComponentName, number>>;
  components: Partial<Record<ComponentName, V2ComponentScore>>;
  diagnostics: Partial<Record<ComponentName, Omit<V2ComponentScore, "weight">>>;
};

export type ScoredDevelopmentRun = {
  sourceId: string;
  budget: number;
  seedSlot: number;
  actualSeed: number;
  score: V2RunScore;
};

export type V2BudgetSummary = {
  budget: number;
  score: number;
  validRuns: number;
  totalRuns: number;
  specifications: Array<{ id: string; score: number; validRuns: number; totalRuns: number }>;
  groups: Array<{
    id: string;
    stratum: string;
    weight: number;
    score: number;
    members: string[];
    parents?: Array<{ id: string; score: number; members: string[] }>;
  }>;
  strata: Array<{ id: string; weight: number; score: number; groups: string[] }>;
};

export type V2QualificationSummary = {
  budget: number;
  monitorScore: number;
  validRuns: number;
  totalRuns: number;
  specifications: Array<{ id: string; score: number; validRuns: number; totalRuns: number }>;
};

export function buildAxisContract(
  spec: Spec,
  eligibleComponents: EvaluationComponent[],
  diagnosticComponents: EvaluationComponent[] = [],
): AxisContract {
  const scoredAxes = new Set(eligibleComponents.filter(isComponent));
  const diagnosticAxes = new Set(diagnosticComponents.filter(isComponent));
  for (const axis of scoredAxes) {
    if (diagnosticAxes.has(axis)) throw new Error(`${axis}: cannot be both scored and diagnostic`);
  }
  const contacts = [...spec.contacts].sort((a, b) => secToFrame(a.t) - secToFrame(b.t));
  const contactByFrame = new Map(contacts.map((contact) => [secToFrame(contact.t), contact]));
  const gaps = sliceTimeline(contacts.map((contact) => secToFrame(contact.t)), secToFrame(spec.duration))
    .filter((gap) => gap.endsWithContact);
  const allTargets: Partial<Record<ComponentName, number[]>> = {};
  for (const gap of gaps) {
    const targets = effectiveAxes(gap, spec);
    for (const axis of ["air", "speed", "amplitude"] as const) {
      if (targets[axis] !== undefined) pushGap(allTargets, axis, gap.index);
    }
    if (contactByFrame.get(gap.endFrame)?.impact !== undefined) {
      pushGap(allTargets, "impact", gap.index);
    }
  }

  for (const axis of Object.keys(allTargets) as ComponentName[]) {
    if (!scoredAxes.has(axis) && !diagnosticAxes.has(axis)) {
      throw new Error(`${axis}: authored target is neither scored nor diagnostic`);
    }
  }
  return {
    scored: selectContractAxes(allTargets, scoredAxes),
    diagnostic: selectContractAxes(allTargets, diagnosticAxes),
  };
}

export function scoreV2Report(
  report: DriftReport,
  authoredContacts: number,
  contract: AxisContract,
  suite: Pick<SuiteManifest, "component_weights" | "axis_quality_tolerance">,
): V2RunScore {
  const contacts = {
    authored: authoredContacts,
    reported: report.contacts.length,
    hit: report.contacts.filter((contact) => contact.status === "hit").length,
    drift: report.contacts.filter((contact) => contact.status === "drift").length,
    missing: report.contacts.filter((contact) => contact.status === "missing").length,
  };
  const hardFailures: string[] = [];
  if (report.terminus.reason !== "endOfSpec") hardFailures.push(`terminus:${report.terminus.reason}`);
  if (contacts.reported !== authoredContacts) hardFailures.push(`reported_contacts:${contacts.reported}/${authoredContacts}`);
  if (contacts.drift > 0) hardFailures.push(`drift:${contacts.drift}`);
  if (contacts.missing > 0 || contacts.hit !== authoredContacts) {
    hardFailures.push(`missing:${Math.max(contacts.missing, authoredContacts - contacts.hit)}`);
  }
  if (report.off_beat_landings.length > 0) hardFailures.push(`off_beat:${report.off_beat_landings.length}`);

  const reportByGap = new Map(report.gaps.map((gap) => [gap.gap_index, gap]));
  const expectedByGap = expectedAxesByGap(contract);
  const unexpectedMeasurements: Partial<Record<ComponentName, number[]>> = {};
  for (const gap of report.gaps) {
    for (const axis of Object.keys(gap.axes)) {
      if (!isComponent(axis)) continue;
      if (!expectedByGap.get(gap.gap_index)?.has(axis)) {
        (unexpectedMeasurements[axis] ??= []).push(gap.gap_index);
      }
    }
  }

  for (const [axis, gaps] of Object.entries(unexpectedMeasurements) as Array<[ComponentName, number[]]>) {
    hardFailures.push(measurementFailure("unexpected_measurement", axis, gaps));
  }

  const errors: Partial<Record<ComponentName, number[]>> = {};
  const missingMeasurements: Partial<Record<ComponentName, number[]>> = {};
  for (const [axis, gapIndexes] of Object.entries(contract.scored) as Array<[ComponentName, number[]]>) {
    for (const gapIndex of gapIndexes) {
      const detail = reportByGap.get(gapIndex)?.axes[axis];
      if (detail === undefined || !Number.isFinite(detail.error)) {
        (missingMeasurements[axis] ??= []).push(gapIndex);
        continue;
      }
      (errors[axis] ??= []).push(detail.error);
    }
  }
  for (const [axis, gaps] of Object.entries(missingMeasurements) as Array<[ComponentName, number[]]>) {
    hardFailures.push(measurementFailure("missing_measurement", axis, gaps));
  }

  const diagnosticErrors: Partial<Record<ComponentName, number[]>> = {};
  const missingDiagnostics: Partial<Record<ComponentName, number[]>> = {};
  for (const [axis, gapIndexes] of Object.entries(contract.diagnostic) as Array<[ComponentName, number[]]>) {
    for (const gapIndex of gapIndexes) {
      const detail = reportByGap.get(gapIndex)?.axes[axis];
      if (detail === undefined || !Number.isFinite(detail.error)) {
        (missingDiagnostics[axis] ??= []).push(gapIndex);
        continue;
      }
      (diagnosticErrors[axis] ??= []).push(detail.error);
    }
  }
  for (const [axis, gaps] of Object.entries(missingDiagnostics) as Array<[ComponentName, number[]]>) {
    hardFailures.push(measurementFailure("missing_diagnostic", axis, gaps));
  }

  const active = (Object.entries(contract.scored) as Array<[ComponentName, number[]]>)
    .filter(([, gapIndexes]) => gapIndexes.length > 0);
  const activeWeight = active.reduce((sum, [axis]) => sum + suite.component_weights[axis], 0);
  const components: Partial<Record<ComponentName, V2ComponentScore>> = {};
  let weightedSquaredError = 0;
  for (const [axis, gapIndexes] of active) {
    const values = errors[axis] ?? [];
    if (values.length !== gapIndexes.length) continue;
    const rmsError = rms(values);
    const weight = suite.component_weights[axis] / activeWeight;
    weightedSquaredError += weight * rmsError * rmsError;
    components[axis] = componentScore(values, rmsError, weight, suite.axis_quality_tolerance);
  }
  const diagnostics: V2RunScore["diagnostics"] = {};
  for (const [axis, values] of Object.entries(diagnosticErrors) as Array<[ComponentName, number[]]>) {
    if (values.length === 0) continue;
    const rmsError = rms(values);
    const { weight: _weight, ...diagnostic } = componentScore(
      values,
      rmsError,
      0,
      suite.axis_quality_tolerance,
    );
    diagnostics[axis] = diagnostic;
  }

  const scoringMode = active.length === 0 ? "contact_only" : "axis_quality";
  const weightedAxisRms = scoringMode === "contact_only" ? null : Math.sqrt(weightedSquaredError);
  const valid = hardFailures.length === 0;
  const score = valid
    ? 1000 * Math.exp(-(weightedAxisRms ?? 0) / suite.axis_quality_tolerance)
    : 0;
  return {
    schema: V2_RUN_SCORE_SCHEMA,
    score: round(score),
    valid,
    scoringMode,
    hardFailures,
    contacts,
    offBeatLandings: report.off_beat_landings.length,
    terminus: { frame: report.terminus.frame, reason: report.terminus.reason },
    weightedAxisRms: weightedAxisRms === null ? null : round(weightedAxisRms),
    expectedObservations: Object.fromEntries(active.map(([axis, gaps]) => [axis, gaps.length])),
    components,
    diagnostics,
  };
}

export function summarizeDevelopmentBudget(
  runs: ScoredDevelopmentRun[],
  budget: number,
  suite: Pick<SuiteManifest, "strata">,
): V2BudgetSummary {
  const budgetRuns = runs.filter((run) => run.budget === budget);
  const members = suite.strata.flatMap((stratum) => stratum.groups.flatMap((group) => group.members));
  const specifications = members.map((id) => {
    const rows = budgetRuns.filter((run) => run.sourceId === id);
    return {
      id,
      score: round(shiftedGeometricMean(rows.map((run) => run.score.score))),
      validRuns: rows.filter((run) => run.score.valid).length,
      totalRuns: rows.length,
    };
  });
  const groups = suite.strata.flatMap((stratum) => stratum.groups.map((group) => {
    const parents = group.parents?.map((parent) => ({
      id: parent.id,
      score: round(shiftedGeometricMean(
        parent.members.map((id) => specifications.find((entry) => entry.id === id)?.score ?? 0),
      )),
      members: [...parent.members],
    }));
    return {
      id: group.id,
      stratum: stratum.id,
      weight: group.weight,
      score: round(shiftedGeometricMean(
        parents?.map((parent) => parent.score) ??
          group.members.map((id) => specifications.find((entry) => entry.id === id)?.score ?? 0),
      )),
      members: [...group.members],
      ...(parents === undefined ? {} : { parents }),
    };
  }));
  const strata = suite.strata.map((stratum) => ({
    id: stratum.id,
    weight: stratum.weight,
    score: round(stratum.groups.reduce((sum, group) =>
      sum + group.weight * (groups.find((entry) => entry.id === group.id)?.score ?? 0), 0)),
    groups: stratum.groups.map((group) => group.id),
  }));
  return {
    budget,
    score: round(strata.reduce((sum, stratum) => sum + stratum.weight * stratum.score, 0)),
    validRuns: budgetRuns.filter((run) => run.score.valid).length,
    totalRuns: budgetRuns.length,
    specifications,
    groups,
    strata,
  };
}

export function weightedBudgetHeadline(
  summaries: V2BudgetSummary[],
  weights: Array<{ budget: number; weight: number }>,
): number {
  const weightByBudget = new Map(weights.map((entry) => [entry.budget, entry.weight]));
  const usable = summaries.filter((summary) => weightByBudget.has(summary.budget));
  const denominator = usable.reduce((sum, summary) => sum + weightByBudget.get(summary.budget)!, 0);
  if (denominator === 0) return 0;
  return round(usable.reduce(
    (sum, summary) => sum + summary.score * weightByBudget.get(summary.budget)!,
    0,
  ) / denominator);
}

export function summarizeQualificationBudget(
  runs: ScoredDevelopmentRun[],
  budget: number,
  sourceIds: string[],
): V2QualificationSummary {
  const budgetRuns = runs.filter((run) => run.budget === budget);
  const specifications = sourceIds.map((id) => {
    const rows = budgetRuns.filter((run) => run.sourceId === id);
    return {
      id,
      score: round(shiftedGeometricMean(rows.map((run) => run.score.score))),
      validRuns: rows.filter((run) => run.score.valid).length,
      totalRuns: rows.length,
    };
  });
  return {
    budget,
    monitorScore: round(shiftedGeometricMean(specifications.map((entry) => entry.score))),
    validRuns: budgetRuns.filter((run) => run.score.valid).length,
    totalRuns: budgetRuns.length,
    specifications,
  };
}

function expectedAxesByGap(contract: AxisContract): Map<number, Set<ComponentName>> {
  const result = new Map<number, Set<ComponentName>>();
  for (const source of [contract.scored, contract.diagnostic]) {
    for (const [axis, gaps] of Object.entries(source) as Array<[ComponentName, number[]]>) {
      for (const gap of gaps) {
        const axes = result.get(gap) ?? new Set<ComponentName>();
        axes.add(axis);
        result.set(gap, axes);
      }
    }
  }
  return result;
}

function selectContractAxes(
  source: Partial<Record<ComponentName, number[]>>,
  selected: Set<ComponentName>,
): Partial<Record<ComponentName, number[]>> {
  return Object.fromEntries(
    [...selected].sort().flatMap((axis) => source[axis] === undefined ? [] : [[axis, [...source[axis]!]]]),
  );
}

function pushGap(target: Partial<Record<ComponentName, number[]>>, axis: ComponentName, gap: number): void {
  (target[axis] ??= []).push(gap);
}

function componentScore(
  values: number[],
  rmsError: number,
  weight: number,
  tolerance: number,
): V2ComponentScore {
  return {
    observations: values.length,
    rmsError: round(rmsError),
    quality: round(Math.exp(-rmsError / tolerance)),
    weight: round(weight),
  };
}

function rms(values: number[]): number {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
}

function measurementFailure(kind: string, axis: ComponentName, gaps: number[]): string {
  return `${kind}:${axis}:${gaps.length}[${gaps[0]}..${gaps[gaps.length - 1]}]`;
}

function isComponent(axis: string): axis is ComponentName {
  return axis === "air" || axis === "speed" || axis === "impact" || axis === "amplitude";
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
