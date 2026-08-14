/**
 * Additive diagnostics for a governed V2 decision.
 *
 * This file is deliberately outside the calibration-bound decision model.
 * It calls that model as-is, after the real verdict exists, and never changes
 * the authored-impact target, decision statistic, confidence, or outcome.
 */

import {
  pairedV2CalibrationVerdict,
  type ConfidenceBounds,
  type DecisionOptions,
  type DecisionRun,
  type V2Decision,
} from "./decision_model.ts";
import type { SuiteManifest } from "./suite_model.ts";
import {
  summarizePairedOutcomes,
  type PairedOutcomeSummary,
} from "../../benchmark/paired_outcomes.ts";

export type V2OutcomeAttribution = PairedOutcomeSummary & {
  /** Headline delta after every pair not valid in both arms is neutralized to
   * the baseline score. No cell is dropped and canonical weights are intact. */
  both_valid_counterfactual_headline_delta: number;
  both_valid_counterfactual_confidence: ConfidenceBounds;
  /** Overall delta minus the counterfactual above. This is validity-sensitive
   * and also contains its interaction with the nonlinear V2 aggregate. */
  validity_sensitive_headline_remainder: number;
};

export type ReportedV2Decision = V2Decision & {
  outcomeAttribution: V2OutcomeAttribution;
};

export function attachV2OutcomeAttribution(
  decision: V2Decision,
  baseRuns: DecisionRun[],
  candidateRuns: DecisionRun[],
  suite: SuiteManifest,
  options: DecisionOptions,
): ReportedV2Decision {
  const candidateByKey = new Map(candidateRuns.map((run) => [scopeKey(run), run]));
  const pairs = baseRuns.map((baseRun) => {
    const candidateRun = candidateByKey.get(scopeKey(baseRun));
    if (candidateRun === undefined) throw new Error("outcome-attribution scope is not paired");
    return { reference: baseRun.score, candidate: candidateRun.score };
  });
  const baseByKey = new Map(baseRuns.map((run) => [scopeKey(run), run]));
  const neutralizedCandidate = candidateRuns.map((candidateRun) => {
    const baseRun = baseByKey.get(scopeKey(candidateRun));
    if (baseRun === undefined) throw new Error("outcome-attribution scope is not paired");
    return baseRun.score.valid && candidateRun.score.valid
      ? candidateRun
      : { ...candidateRun, score: { ...baseRun.score } };
  });
  const bothValidCounterfactual = pairedV2CalibrationVerdict(
    baseRuns,
    neutralizedCandidate,
    suite,
    options,
  );
  return {
    ...decision,
    outcomeAttribution: {
      ...summarizePairedOutcomes(pairs),
      both_valid_counterfactual_headline_delta: bothValidCounterfactual.delta,
      both_valid_counterfactual_confidence: bothValidCounterfactual.confidence,
      validity_sensitive_headline_remainder: round(
        decision.delta - bothValidCounterfactual.delta,
      ),
    },
  };
}

function scopeKey(run: DecisionRun): string {
  return `${run.sourceId}\0${run.budget}\0${run.seedSlot}\0${run.actualSeed}`;
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
