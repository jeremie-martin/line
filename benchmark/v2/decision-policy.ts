export const benchmarkDecisionPolicy = {
  schema: "line.benchmark-v2.decision-policy.v2",
  method: "stress_calibrated_paired_budget_seed_block_jackknife_t_with_parent_bootstrap_sensitivity",
  bootstrapIterations: 20_000,
  bootstrapSeed: 0x5eed_1234,
  centralIntervalLevel: 0.95,
  centralCriticalIntervalLevel: 0.99,
  profiles: {
    probe: {
      authority: "screening",
      alpha: 0.10,
      criticalAlpha: 0.05,
      positiveOutcome: "advance",
      negativeOutcome: "stop",
      unresolvedOutcome: "unresolved",
    },
    canonical: {
      authority: "promotion",
      alpha: 0.05,
      criticalAlpha: 0.01,
      positiveOutcome: "accept",
      negativeOutcome: "reject",
      unresolvedOutcome: "inconclusive",
    },
  },
} as const;

export const benchmarkDecisionCalibrationPolicy = {
  schema: "line.benchmark-v2.decision-calibration-policy.v1",
  seedsPerBudget: 8,
  minimumTrialsPerCell: 1_000,
  minimumCoverageWilsonLower: 0.93,
  maximumFalseDecisionWilsonUpper: 0.05,
  minimumEmpiricalGainPowerWilsonLower: 0.85,
  simplificationStudyMargin: 5,
  requiredNullScenarios: [
    "empirical_blocks",
    "symmetric_validity_flips",
    "catalog_wide_hard_zero",
  ],
  requiredAlternativeScenarios: [
    "empirical_score_gain",
    "hard_zero_validity_gain",
    "noninferiority_inside",
    "noninferiority_boundary",
  ],
} as const;

export const BENCHMARK_EXECUTION_PROTOCOL = "line.benchmark-v2.execution-protocol.v4" as const;
export const BENCHMARK_RUN_ARCHIVE_SCHEMA = "line.benchmark-v2.run-archive.v5" as const;
export const COMPILER_IDENTITY_PROTOCOL = "line.compiler-source-identity.v2" as const;
