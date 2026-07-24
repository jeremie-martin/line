/**
 * Audited scientific-methodology identity. Implementation refactors are
 * tracked separately and do not rewrite retained statistical evidence.
 */
export const CERTIFICATION_GENERATOR_PROTOCOL_FINGERPRINT =
  "ed896a760cb142cebd01858cd0bae8740b2dd74951789cfb09460c99f669634a" as const;

export const CERTIFICATION_GENERATOR_IMPLEMENTATION_SOURCE_FILES = [
  "scripts/benchmark/study_lib.ts",
  "scripts/benchmark/validate_independent_reference.ts",
  "scripts/v0/benchmark_v2/certification_identity.ts",
] as const;
