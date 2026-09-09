/** V3 remains a separately versioned pilot; V2 is the historical comparison anchor. */
export const policy = {
  schema: 'line.benchmark-v3.policy.v1',
  status: 'pilot',
  budget: 750000,
  seeds: [16, 17],
  axisWeights: { air: .3, speed: .3, impact: .3, amplitude: .1 },
  tolerance: .25,
  spanWeight: 'elapsed_frames',
  impactWeight: 'one_per_authored_contact',
  includeTail: true,
  material: 'normal_type_0',
  styleContract: 'Substantial coherent physical arcs; no point constellations or decorative connections around isolated controls. No new automatic aesthetic proxy.',
  aggregation: 'seed_geomean_then_parent_geomean_then_group_geomean_then_fixed_stratum_weights',
  comparison: 'Fixed complete-suite paired comparison; no seed-only probability of generalization or automatic sequential promotion.',
  strata: [
    { id: 'representative', weight: .70, groups: [
      { id: 'regular_exceptions', weight: .20 }, { id: 'subdivision_pickup', weight: .15 },
      { id: 'irregular_microtimed', weight: .15 }, { id: 'cadence_transition', weight: .12 },
      { id: 'spacious_amplitude', weight: .13 }, { id: 'dense_musical', weight: .10 },
      { id: 'high_air_energy', weight: .08 }, { id: 'sparse_transition', weight: .07 },
    ] },
    { id: 'capability', weight: .15, groups: [
      { id: 'rapid_pickup_frontier', weight: .40 }, { id: 'dense_recovery_frontier', weight: .35 },
      { id: 'low_air_frontier', weight: .25 },
    ] },
    { id: 'legacy_regression', weight: .10, groups: [
      { id: 'legacy_transition_regression', weight: .55 }, { id: 'legacy_amplitude_regression', weight: .45 },
    ] },
    { id: 'development_music', weight: .05, groups: [
      { id: 'believer', weight: 1 / 6 }, { id: 'amor_na_praia', weight: 1 / 6 },
      { id: 'luna_bala', weight: 1 / 6 }, { id: 'tiki_tiki', weight: 1 / 6 },
      { id: 'shelter', weight: 1 / 6 }, { id: 'amour_de_ma_vie', weight: 1 / 6 },
    ] },
  ],
} as const;
