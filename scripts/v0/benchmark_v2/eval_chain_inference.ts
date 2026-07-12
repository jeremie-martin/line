import { studentTQuantile } from "./decision_model.ts";

/**
 * Source boundary for the live evidence-selection and stopping behavior that
 * the operating-point studies certify. The certification artifacts stamp this
 * boundary independently from the final-decision inference identity.
 */
export const EVAL_CHAIN_INFERENCE_SOURCE_FILES = [
  "benchmark/v2/eval-policy.ts",
  "scripts/v0/benchmark_v2/eval_chain_inference.ts",
] as const;

/** Prefix evidence available at a predeclared seed-block look. */
export function evalRunsAtLook<T extends { seedSlot: number }>(runs: readonly T[], depth: number): T[] {
  if (!Number.isSafeInteger(depth) || depth < 1) throw new Error(`eval look depth must be a positive integer`);
  return runs.filter((run) => run.seedSlot < depth);
}

/** Pure one-sided upper bound used by both live interim looks and simulation. */
export function evalFutilityUpperBound(
  estimate: number,
  standardError: number,
  degreesOfFreedom: number | null,
  futilityAlpha: number,
): number {
  if (standardError === 0) return estimate;
  return estimate + studentTQuantile(1 - futilityAlpha, degreesOfFreedom ?? Infinity) * standardError;
}

export function evalFutilityStops(input: {
  estimate: number;
  standardError: number;
  degreesOfFreedom: number | null;
  futilityAlpha: number;
  threshold: number;
}): boolean {
  return evalFutilityUpperBound(
    input.estimate,
    input.standardError,
    input.degreesOfFreedom,
    input.futilityAlpha,
  ) < input.threshold;
}
