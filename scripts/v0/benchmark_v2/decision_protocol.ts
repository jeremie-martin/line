import { fingerprintFiles } from "./suite_model.ts";

/**
 * Surfaces that fix comparison integrity, snapshot/freezing, and promotion
 * semantics. Statistical inference has its own identity
 * (`DECISION_INFERENCE_PROTOCOL_FINGERPRINT`); this fingerprint records operational
 * provenance without turning ordinary comparisons into a permission gate.
 *
 * Runner *execution* is separately bound by the implementation fingerprint,
 * the execution-policy identity, and runner-compatibility approvals; suite
 * semantics are bound by the suite manifest, source identities, and explicit
 * scoring-protocol fingerprint in `suite_model.ts`.
 */
export const DECISION_PROTOCOL_SOURCE_FILES = [
  "benchmark/v2/eval-policy.ts",
  "benchmark/v2/operating-points.json",
  "benchmark/v2/runner-compatibility.json",
  "scripts/benchmark/cli.ts",
  "scripts/benchmark/freeze_baseline.ts",
  "scripts/benchmark/calibrate_sequential_eval.ts",
  "scripts/benchmark/verify_runner_compatibility.ts",
  "scripts/v0/benchmark_v2/baseline_contract.ts",
  "scripts/v0/benchmark_v2/baseline_cache.ts",
  "scripts/v0/benchmark_v2/baseline_cache_command.ts",
  "scripts/v0/benchmark_v2/baseline.ts",
  "scripts/v0/benchmark_v2/baseline_publication.ts",
  "scripts/v0/benchmark_v2/campaign_bootstrap.ts",
  "scripts/v0/benchmark_v2/campaign_bootstrap_request.ts",
  "scripts/v0/benchmark_v2/compiler_identity.ts",
  "scripts/v0/benchmark_v2/compiler_snapshot.ts",
  "scripts/v0/benchmark_v2/decide.ts",
  "scripts/v0/benchmark_v2/decision_protocol.ts",
  "scripts/v0/benchmark_v2/eval.ts",
  "scripts/v0/benchmark_v2/evidence_inventory.ts",
  "scripts/v0/benchmark_v2/eval_chain_inference.ts",
  "scripts/v0/benchmark_v2/eval_report.ts",
  "scripts/v0/benchmark_v2/listening_review.ts",
  "scripts/v0/benchmark_v2/rebaseline.ts",
  "scripts/v0/benchmark_v2/round_progress.ts",
  "scripts/v0/benchmark_v2/runner_compatibility.ts",
  "scripts/v0/benchmark_v2/sequential_inference.ts",
  "scripts/v0/benchmark_v2/status.ts",
] as const;

export function decisionProtocolFingerprint(): string {
  return fingerprintFiles([...DECISION_PROTOCOL_SOURCE_FILES]);
}
