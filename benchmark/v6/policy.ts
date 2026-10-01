/** Proposed contract during pilot. frozen.json is the actual freeze boundary. */
export const policy={schema:'line.benchmark-v6.policy.v1',budget:3000000,
 seeds:[101,202,303,404],confirmationSeeds:[503,607,709,811],
 panelWeights:{fixed:.5,automatic:.5},material:'normal_type_0',musicalJudge:'frozen_v4',
 score:'whole_track_musical_score_times_fraction_of_scored_construction_requests_fulfilled',
 aggregation:'shifted_geometric_seeds_then_equal_musical_parents_then_equal_families_then_fixed_panel_weights',
 arrangements:'line.repertoire-policy.v2',layouts:['paired','transfer'],
 motion:'Separate qualification and diagnostics; motion failures stay in the complete musical/construction headline.',
 target:850,
 qualification:{burstExcessReduction:.5,quietReferenceMultiplier:1.35,quietImpactErrorReduction:.4,
  namedBurstExamples:'Each reported production window must fall within the frozen 100ms absolute/relative band.',
  reference:'Motion qualification compares all twelve preserved automatic production tracks with their replacements; all replacements must complete and fulfill requests. V6 motion distributions and matched-valid baseline comparisons remain mandatory diagnostics with disclosed denominators.',
  limitation:'Numeric criteria describe specified concerns, not general artistic approval.'},
 sampling:'Four seeds in both complete panels; no extension or stopping rule based on crossing the target.'} as const;
