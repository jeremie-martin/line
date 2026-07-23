import { fingerprintFiles } from "./suite_model.ts";

/**
 * The decision-protocol identity (RFC C.5): the surfaces that fix
 * eligibility, gating, snapshot/freezing, and promotion semantics. Changing
 * any of these must never invalidate statistical evidence (that is the
 * inference identity's job, DECISION_INFERENCE_SOURCE_FILES), but it must
 * not pass silently either: the baseline records this fingerprint, and a
 * mismatch requires a ledgered `migrate --scope=protocol` re-stamp.
 *
 * Runner *execution* is separately bound by the implementation fingerprint,
 * the execution-policy identity, and runner-compatibility approvals; suite
 * semantics are bound by the suite fingerprint (BENCHMARK_DEFINITION_SOURCE_FILES).
 */
export const DECISION_PROTOCOL_SOURCE_FILES = [
  "benchmark/v2/eval-policy.ts",
  "benchmark/v2/operating-points.json",
  "benchmark/v2/runner-compatibility.json",
  "scripts/benchmark/cli.ts",
  "scripts/benchmark/freeze_baseline.ts",
  "scripts/benchmark/verify_runner_compatibility.ts",
  "scripts/v0/benchmark_v2/attempts.ts",
  "scripts/v0/benchmark_v2/baseline_cache.ts",
  "scripts/v0/benchmark_v2/baseline_cache_command.ts",
  "scripts/v0/benchmark_v2/baseline.ts",
  "scripts/v0/benchmark_v2/baseline_publication.ts",
  "scripts/v0/benchmark_v2/calibration_guard.ts",
  "scripts/v0/benchmark_v2/certification_declaration.ts",
  "scripts/v0/benchmark_v2/certification_identity.ts",
  "scripts/v0/benchmark_v2/compiler_identity.ts",
  "scripts/v0/benchmark_v2/compiler_snapshot.ts",
  "scripts/v0/benchmark_v2/confirmation.ts",
  "scripts/v0/benchmark_v2/decide.ts",
  "scripts/v0/benchmark_v2/decision_protocol.ts",
  "scripts/v0/benchmark_v2/eval.ts",
  "scripts/v0/benchmark_v2/evidence_inventory.ts",
  "scripts/v0/benchmark_v2/eval_chain_inference.ts",
  "scripts/v0/benchmark_v2/eval_report.ts",
  "scripts/v0/benchmark_v2/listening_review.ts",
  "scripts/v0/benchmark_v2/operating_points.ts",
  "scripts/v0/benchmark_v2/migrate.ts",
  "scripts/v0/benchmark_v2/rebaseline.ts",
  "scripts/v0/benchmark_v2/runner_compatibility.ts",
  "scripts/v0/benchmark_v2/status.ts",
] as const;

export function decisionProtocolFingerprint(): string {
  return fingerprintFiles([...DECISION_PROTOCOL_SOURCE_FILES]);
}
