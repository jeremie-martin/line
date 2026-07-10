export const benchmarkDecisionPolicy = {
  schema: "line.benchmark-v2.decision-policy.v1",
  method: "paired_budget_seed_block_jackknife_t_with_parent_bootstrap_sensitivity",
  bootstrapIterations: 20_000,
  bootstrapSeed: 0x5eed_1234,
  centralIntervalLevel: 0.95,
  profiles: {
    probe: {
      authority: "screening",
      alpha: 0.10,
      positiveOutcome: "advance",
      negativeOutcome: "stop",
      unresolvedOutcome: "unresolved",
    },
    canonical: {
      authority: "promotion",
      alpha: 0.05,
      positiveOutcome: "accept",
      negativeOutcome: "reject",
      unresolvedOutcome: "inconclusive",
    },
  },
} as const;

export const BENCHMARK_EXECUTION_PROTOCOL = "line.benchmark-v2.execution-protocol.v2" as const;
export const BENCHMARK_RUN_ARCHIVE_SCHEMA = "line.benchmark-v2.run-archive.v3" as const;
export const COMPILER_IDENTITY_PROTOCOL = "line.compiler-source-identity.v2" as const;
