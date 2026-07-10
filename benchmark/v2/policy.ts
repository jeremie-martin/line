export const benchmarkPolicy = {
  schema: "line.benchmark-v2.policy.v1",
  status: "frozen-canonical",
  strata: [
    {
      id: "representative",
      weight: 0.70,
      groups: [
        { id: "regular_exceptions", weight: 0.20, parents: ["river_reentry", "countercurrent"] },
        { id: "subdivision_pickup", weight: 0.15, parents: ["split_signal", "pickup_lattice"] },
        { id: "irregular_microtimed", weight: 0.15, parents: ["loose_pocket", "offgrid_conversation"] },
        { id: "cadence_transition", weight: 0.12, parents: ["rising_switch", "meter_exchange"] },
        { id: "spacious_amplitude", weight: 0.13, parents: ["wide_breaths", "open_hook", "amplitude_tides"] },
        { id: "dense_musical", weight: 0.10, parents: ["dense_dialogue"] },
        { id: "high_air_energy", weight: 0.08, parents: ["high_air_drive"] },
        { id: "sparse_transition", weight: 0.07, parents: ["sparse_lowline"] },
      ],
    },
    {
      id: "capability",
      weight: 0.15,
      groups: [
        { id: "rapid_pickup_frontier", weight: 0.40, parents: ["frontier_pickup_progression"] },
        { id: "dense_recovery_frontier", weight: 0.35, parents: ["frontier_dense_recovery"] },
        { id: "low_air_frontier", weight: 0.25, parents: ["frontier_low_air_endurance"] },
      ],
    },
    {
      id: "legacy_regression",
      weight: 0.10,
      groups: [
        { id: "legacy_transition_regression", weight: 0.55, parents: ["regression_transition_mosaic"] },
        { id: "legacy_amplitude_regression", weight: 0.45, parents: ["regression_amplitude_mosaic"] },
      ],
    },
    {
      id: "development_music",
      weight: 0.05,
      groups: [
        { id: "believer_56s", weight: 1.0, parents: ["believer_56_6s", "believer_impact_56s"] },
      ],
    },
  ],
  componentWeights: { air: 0.30, speed: 0.30, impact: 0.30, amplitude: 0.10 },
  axisQualityTolerance: 0.25,
  transform: { kind: "production_felt_jolt", joltMs: -15 },
  seedPolicy: { kind: "budget_disjoint_contiguous", seedBase: 0 },
  profiles: {
    probe: { budgets: [250_000, 500_000], seedsPerBudget: 3 },
    canonical: { budgets: [250_000, 500_000, 750_000], seedsPerBudget: 4 },
  },
  budgetWeights: [
    { budget: 250_000, weight: 0.20 },
    { budget: 500_000, weight: 0.50 },
    { budget: 750_000, weight: 0.30 },
  ],
} as const;
