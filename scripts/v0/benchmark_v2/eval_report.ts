/**
 * Pure rendering for a candidate run against the cached baseline prefix.
 *
 * Neither renderer reads or mutates governance state. There is no attempt
 * ledger, certification menu, or comparison budget in the active workflow.
 */

import type { ReportedV2Decision } from "./outcome_attribution.ts";
import type { SequentialLookDecision } from "./sequential_inference.ts";

export type CachedComparisonReport = {
  result: ReportedV2Decision;
  baseLabel: string;
  seeds: number;
  archivePath: string;
  artifactPath: string;
  snapshotPath: string;
  hint: string | null;
  nextCommand: string;
  runnerFingerprintsMatch: boolean;
  sequentialLooks?: SequentialLookDecision[];
};

export function renderCachedComparison(report: CachedComparisonReport): string {
  const result = report.result;
  const orderedCases = [...result.perCase].sort((a, b) => a.delta - b.delta);
  const recommendation = result.outcome === "accept"
    ? "STRONGER THAN BASELINE"
    : result.outcome === "reject"
    ? "NOT BETTER THAN BASELINE"
    : "INCONCLUSIVE";
  return [
    `Benchmark V2 cached comparison — ${report.seeds} seeds/budget`,
    `  base: ${report.baseLabel}`,
    `  headline: ${result.baseHeadline.toFixed(2)} -> ${result.candidateHeadline.toFixed(2)} ` +
      `(delta ${formatSigned(result.delta)})`,
    `  seed-block SE: ${result.uncertainty.seed.standardError.toFixed(2)}; ` +
      `${(result.confidence.centralLevel * 100).toFixed(0)}% interval ` +
      `[${formatSigned(result.confidence.centralLo)}, ${formatSigned(result.confidence.centralHi)}]`,
    `  one-sided bounds: lower ${formatSigned(result.confidence.lowerBound)}, ` +
      `upper ${formatSigned(result.confidence.upperBound)}`,
    ...(report.sequentialLooks === undefined ? [] : [
      `  sequential rule: ${report.sequentialLooks.map((look) =>
        `N=${look.depth} P(+)=` + `${(100 * look.directionalProbability).toFixed(2)}% ` +
        `(required ${(100 * look.requiredDirectionalProbability).toFixed(2)}%): ${look.action}`
      ).join("; ")}`,
    ]),
    `  validity: ${result.validity.baseValid}/${result.validity.total} -> ` +
      `${result.validity.candidateValid}/${result.validity.total} ` +
      `(gained ${result.validity.gained}, lost ${result.validity.lost})`,
    `  outcome attribution: both valid ${result.outcomeAttribution.both_valid_pairs}/` +
      `${result.outcomeAttribution.total_pairs}; ` +
      `both-valid counterfactual ` +
      `${formatSigned(result.outcomeAttribution.both_valid_counterfactual_headline_delta)} ` +
      `(SE ${result.outcomeAttribution.both_valid_counterfactual_confidence.standardError.toFixed(2)}); ` +
      `validity-sensitive remainder ` +
      `${formatSigned(result.outcomeAttribution.validity_sensitive_headline_remainder)}`,
    `    paired both-valid cells: mean ` +
      `${formatNullableSigned(result.outcomeAttribution.both_valid_score.mean_delta)}; ` +
      `better ${result.outcomeAttribution.both_valid_score.improved_pairs}, ` +
      `worse ${result.outcomeAttribution.both_valid_score.regressed_pairs}, ` +
      `tied ${result.outcomeAttribution.both_valid_score.tied_pairs}; ` +
      `ref-only valid ${result.outcomeAttribution.reference_only_valid_pairs}, ` +
      `candidate-only valid ${result.outcomeAttribution.candidate_only_valid_pairs}`,
    `  budgets:`,
    ...result.perBudget.map((entry) =>
      `    ${(entry.budget / 1000).toFixed(0).padStart(4)}k  ${formatSigned(entry.delta)}  ` +
      `[${formatSigned(entry.confidence.centralLo)}, ${formatSigned(entry.confidence.centralHi)}]  ` +
      `valid ${entry.baseValid}->${entry.candidateValid}/${entry.total}`
    ),
    `  strata:`,
    ...result.perStratum.map((entry) =>
      `    ${entry.stratum.padEnd(20)} ${formatSigned(entry.delta)}  ` +
      `[${formatSigned(entry.confidence.centralLo)}, ${formatSigned(entry.confidence.centralHi)}]`
    ),
    `  largest regressions:`,
    ...orderedCases.slice(0, 5).map((entry) =>
      `    ${entry.sourceId.padEnd(45)} ${formatSigned(entry.delta)} ` +
      `(valid ${entry.baseValid}->${entry.candidateValid}/${entry.total})`
    ),
    `  largest improvements:`,
    ...orderedCases.slice(-5).reverse().map((entry) =>
      `    ${entry.sourceId.padEnd(45)} ${formatSigned(entry.delta)} ` +
      `(valid ${entry.baseValid}->${entry.candidateValid}/${entry.total})`
    ),
    `  RESULT: ${recommendation}`,
    ...(report.runnerFingerprintsMatch ? [] : [
      `  note: runner provenance changed; suite, engine, schedule, cache, scope, and result checksums still matched`,
    ]),
    ...(report.hint === null ? [] : [`  hint: ${report.hint}`]),
    `  candidate archive: ${report.archivePath}`,
    `  candidate snapshot: ${report.snapshotPath}`,
    `  comparison artifact: ${report.artifactPath}`,
    `  nextCommand: ${report.nextCommand}`,
  ].join("\n");
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatNullableSigned(value: number | null): string {
  return value === null ? "n/a" : formatSigned(value);
}
