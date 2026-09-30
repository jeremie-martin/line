/** Frozen after the development pilot, before baseline compilation. */
export const policy={schema:'line.benchmark-v5.policy.v1',budget:3000000,seeds:[101,202],confirmationSeeds:[307,409],
  panelWeights:{fixed:.5,automatic:.5},material:'normal_type_0',
  musicalJudge:'frozen_v4',
  realization:'Each explicitly scored support either fulfills its construction or contributes zero. Musical validity is required for all credit.',
  score:'whole_track_musical_score_times_fraction_of_scored_construction_requests_fulfilled',
  aggregation:'shifted_geometric_seeds_then_equal_musical_parents_then_equal_families_then_fixed_panel_weights',
  geometry:'Substantial connected normal rails or physically contacted disconnected normal fragments. Opposing contact counts toward shape traversal.',
  note:'Request realization is not a beauty score. Full fulfillment, raw musical score, local musical errors and all failures remain separately reported.'} as const;
