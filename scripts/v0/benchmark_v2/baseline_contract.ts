import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  validateCompilerSnapshot,
  type CompilerSnapshot,
} from "./compiler_snapshot.ts";

export const DEFAULT_BASELINE_PATH = "benchmark/v2/campaign-baseline.json";

export type BaselineContract = {
  label: string;
  suiteFingerprint: string;
  candidateFingerprint: string;
  listeningReviewFingerprint: string;
  compilerSnapshot: CompilerSnapshot;
  inferenceFingerprint: string;
  protocolFingerprint: string;
  calibrationFingerprint: string;
  sequentialPolicyFingerprint: string | null;
  sequentialInferenceFingerprint: string | null;
  sequentialCalibrationFingerprint: string | null;
};

/** Read the compact baseline identity used by snapshots and exploratory tools.
 * It deliberately has no attempt, migration, or budget state. */
export function readBaselineContract(baselinePath = DEFAULT_BASELINE_PATH): BaselineContract {
  if (existsSync("benchmark/v2/baseline-publication-pending.json")) {
    throw new Error(`baseline publication is incomplete; rerun baseline or rebaseline to recover it`);
  }
  const baseline = JSON.parse(readFileSync(resolve(baselinePath), "utf8"));
  const canonical = baseline.schema === "line.benchmark-v2.baseline-reference.v10" &&
    baseline.status === "canonical-baseline";
  const campaign = baseline.schema === "line.benchmark-v2.campaign-baseline.v2" &&
    baseline.status === "active-campaign-baseline";
  if (!canonical && !campaign) {
    throw new Error(`unsupported baseline reference; establish a new baseline`);
  }
  if (baseline.listening_review_status !== "approved") {
    throw new Error(`the baseline of record lacks an approved listening review`);
  }
  if (baseline.compiler_snapshot === undefined) throw new Error(`the baseline of record has no compiler snapshot`);
  validateCompilerSnapshot(baseline.compiler_snapshot);
  return {
    label: baseline.label,
    suiteFingerprint: baseline.suite_fingerprint,
    candidateFingerprint: baseline.candidate_fingerprint,
    listeningReviewFingerprint: baseline.listening_review_fingerprint,
    compilerSnapshot: baseline.compiler_snapshot,
    inferenceFingerprint: baseline.decision_inference_fingerprint,
    protocolFingerprint: baseline.decision_protocol_fingerprint,
    calibrationFingerprint: baseline.decision_calibration_fingerprint,
    sequentialPolicyFingerprint: campaign ? baseline.sequential_eval_policy_fingerprint : null,
    sequentialInferenceFingerprint: campaign ? baseline.sequential_eval_inference_fingerprint : null,
    sequentialCalibrationFingerprint: campaign ? baseline.sequential_eval_calibration_fingerprint : null,
  };
}
