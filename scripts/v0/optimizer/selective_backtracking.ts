export type SelectiveCatchupPolicy =
  | "selective_axis_regret_catchup"
  | "selective_axis_regret_catchup_repair_incumbent_once"
  | "selective_axis_regret_catchup_periodic_initial"
  | "selective_axis_regret_catchup_periodic_repair"
  | "selective_axis_regret_catchup_value_map"
  | "selective_axis_regret_catchup_value_deferred_map"
  | "selective_axis_regret_catchup_value_initial"
  | "selective_axis_regret_catchup_value_initial_progress_10"
  | "selective_axis_regret_catchup_value_initial_expire_10";

export type SelectiveBacktrackSignal =
  | "branch_regret"
  | "repair_incumbent_regret"
  | "periodic_exploration"
  | "value_exploration";

export type FrontierTraversalPolicy = "depth_first" | SelectiveCatchupPolicy;

export type FrontierTraversalLane = "initial" | "snapshot" | "repair" | "resumed";

export const SELECTIVE_AXIS_REGRET_MIN_CONTACT_ADVANCE = 2;
export const SELECTIVE_AXIS_REGRET_MIN_LOSS_DELTA = 0.20;
export const SELECTIVE_REPAIR_INCUMBENT_MIN_LOSS_DELTA = 0.02;
export const SELECTIVE_PERIODIC_CONTACT_INTERVAL = 8;
export const SELECTIVE_PERIODIC_CONTACT_REWIND = 3;
export const SELECTIVE_PERIODIC_TERMINAL_RESERVE_FACTOR = 1.25;
export const SELECTIVE_PERIODIC_EXPLORATION_BUDGET_FRACTION = 0.15;
export const SELECTIVE_VALUE_MIN_CONTACT_ADVANCE = 3;
export const SELECTIVE_VALUE_DENSITY_FRAME_SCALE = 10_000;
export const SELECTIVE_VALUE_DENSITY_THRESHOLDS = [0.005, 0.01, 0.02, 0.04] as const;
export const SELECTIVE_VALUE_LIVE_DENSITY_THRESHOLD = 0.02;
export const SELECTIVE_VALUE_LIVE_MIN_GAP_PROGRESS = 0.10;
export const SELECTIVE_DEFERRED_VALUE_ALLOWANCE_FRACTIONS = [0.15, 0.25, 0.40] as const;
export const SELECTIVE_DEFERRED_VALUE_MAP_MAX_ALLOWANCE_FRACTION = 0.40;
export const SELECTIVE_AXIS_REGRET_OPPORTUNITY_THRESHOLDS = [0.05, 0.10, 0.15, 0.20] as const;
export const REPAIR_INCUMBENT_REGRET_OPPORTUNITY_THRESHOLDS = [
  0,
  0.01,
  0.02,
  0.05,
  0.10,
] as const;
export const REPAIR_INCUMBENT_REGRET_OPPORTUNITY_CONTACT_ADVANCES = [
  2,
  3,
  4,
  5,
  6,
] as const;

export function parseFrontierTraversalPolicy(raw: string | undefined): FrontierTraversalPolicy {
  if (raw === undefined || raw === "" || raw === "selective-axis-regret-catchup") {
    return "selective_axis_regret_catchup";
  }
  if (raw === "selective-axis-regret-catchup-repair-incumbent-once") {
    return "selective_axis_regret_catchup_repair_incumbent_once";
  }
  if (raw === "selective-axis-regret-catchup-periodic-initial") {
    return "selective_axis_regret_catchup_periodic_initial";
  }
  if (raw === "selective-axis-regret-catchup-periodic-repair") {
    return "selective_axis_regret_catchup_periodic_repair";
  }
  if (raw === "selective-axis-regret-catchup-value-map") {
    return "selective_axis_regret_catchup_value_map";
  }
  if (raw === "selective-axis-regret-catchup-value-deferred-map") {
    return "selective_axis_regret_catchup_value_deferred_map";
  }
  if (raw === "selective-axis-regret-catchup-value-initial") {
    return "selective_axis_regret_catchup_value_initial";
  }
  if (raw === "selective-axis-regret-catchup-value-initial-progress-10") {
    return "selective_axis_regret_catchup_value_initial_progress_10";
  }
  if (raw === "selective-axis-regret-catchup-value-initial-expire-10") {
    return "selective_axis_regret_catchup_value_initial_expire_10";
  }
  if (raw === "0" || raw === "off" || raw === "dfs") return "depth_first";
  throw new Error(
    `LR_FRONTIER_POLICY must be dfs, selective-axis-regret-catchup, ` +
      `selective-axis-regret-catchup-repair-incumbent-once, ` +
      `selective-axis-regret-catchup-periodic-initial, or ` +
      `selective-axis-regret-catchup-periodic-repair, or ` +
      `selective-axis-regret-catchup-value-map, or ` +
      `selective-axis-regret-catchup-value-deferred-map, or ` +
      `selective-axis-regret-catchup-value-initial, or ` +
      `selective-axis-regret-catchup-value-initial-progress-10, or ` +
      `selective-axis-regret-catchup-value-initial-expire-10; got ${raw}`,
  );
}

export type SelectiveExplorationBudgetAssessment = {
  execution_remaining_frames: number;
  conservative_terminal_work_frames: number;
  estimated_probe_work_frames: number;
  terminal_reserve_frames: number;
  exploration_allowance_frames: number;
  exploration_spent_frames: number;
  exploration_remaining_frames: number;
  local_probe_allowance_frames: number;
  admitted: boolean;
  reason: "admitted" | "terminal_reserve" | "exploration_allowance";
};

export type SelectivePeriodicOpportunity = {
  lane: FrontierTraversalLane;
  contact_ordinal: number;
  from_gap_index: number;
  branch_gap_index: number;
  alternative_gap_index: number;
  outcome:
    | "admitted"
    | "alternative_unavailable"
    | "execution_ceiling"
    | "terminal_reserve"
    | "exploration_allowance";
  conservative_deadline_margin: number | null;
  budget: SelectiveExplorationBudgetAssessment | null;
};

export type SelectiveValueOpportunityPoint = {
  lane: FrontierTraversalLane;
  contact_ordinal: number;
  from_gap_index: number;
  branch_gap_index: number;
  alternative_gap_index: number;
  contact_advance: number;
  gap_rewind: number;
  baseline_axis_loss: number;
  current_axis_loss: number;
  axis_loss_delta: number;
  value_density_per_10k_estimated_frames: number;
  gap_progress: number | null;
  total_spent_frames: number;
  alternative_available: boolean;
  execution_ceiling_reached: boolean;
  budget: SelectiveExplorationBudgetAssessment;
};

export type SelectiveValueLiveOpportunity = {
  watch_id: number;
  outcome:
    | "admitted"
    | "ranked_out"
    | "production_priority"
    | "progress_expired"
    | "alternative_unavailable"
    | "execution_ceiling"
    | "terminal_reserve"
    | "exploration_allowance";
  affordable_rank: number | null;
  point: SelectiveValueOpportunityPoint;
};

export type SelectiveValueOpportunity = {
  watch_id: number;
  threshold: number;
  crossing: SelectiveValueOpportunityPoint;
  first_admission: SelectiveValueOpportunityPoint | null;
};

export type SelectiveDeferredValueTerminalAssessment = {
  first_terminal_total_spent_frames: number;
  first_terminal_track_hash: string;
  on_incumbent_path: boolean;
  production_consumed: boolean;
  alternative_available: boolean;
  remaining_hard_budget_frames: number;
  remaining_repair_budget_frames: number;
  search_policy_budget_frames: number;
  exploration_allowance_frames: number;
  local_allowance_frames: number;
  estimated_suffix_work_frames: number;
  terminal_value_density_per_10k_estimated_frames: number;
  affordable: boolean;
  reason:
    | "admitted"
    | "not_incumbent_path"
    | "production_consumed"
    | "alternative_unavailable"
    | "hard_budget"
    | "repair_budget"
    | "exploration_allowance";
  affordable_rank: number | null;
};

export type SelectiveDeferredValueOpportunity = {
  watch_id: number;
  outcome: "progress_expired" | "alternative_unavailable_at_collection" | "collected";
  crossing: SelectiveValueOpportunityPoint;
  terminal: SelectiveDeferredValueTerminalAssessment | null;
};

export type SelectiveDeferredValueDecision<Node extends object> = {
  watchId: number;
  current: Node;
  alternative: Node;
  crossing: SelectiveValueOpportunityPoint;
  terminal: SelectiveDeferredValueTerminalAssessment;
};

export function catchupAlternativeHasSufficientGain(
  currentAxisLoss: number,
  alternativeAxisLoss: number,
): boolean {
  return currentAxisLoss > alternativeAxisLoss;
}

type AxisRegretWatch<Node extends object> = {
  watchId: number;
  alternative: Node;
  additionalAlternatives: readonly Node[];
  branchContactOrdinal: number;
  branchGapIndex: number;
  baselineAxisLoss: number;
  used: boolean;
  signalCrossed: boolean;
  deadlineSuppressionRecorded: boolean;
  opportunityCrossedMask: number;
  opportunityAdmissibleMask: number;
  repairIncumbentOpportunityCrossedMask: number;
  repairIncumbentOpportunityAdmissibleMask: number;
  repairIncumbentMaturityOpportunityCrossedMask: number;
  repairIncumbentMaturityOpportunityAdmissibleMask: number;
  repairIncumbentAttemptLimitSuppressionRecorded: boolean;
  valueOpportunityCrossedMask: number;
  valueOpportunityAdmissibleMask: number;
  valueOpportunityRecordIndices: Array<number | null>;
  valueLiveCrossed: boolean;
  valueLiveProgressSuppressionRecorded: boolean;
  deferredValueCrossed: boolean;
};

type WatchLink<Node extends object> = {
  watch: AxisRegretWatch<Node>;
  parent: WatchLink<Node> | null;
};

type DeferredValueCandidate<Node extends object> = {
  watch: AxisRegretWatch<Node>;
  current: Node;
  recordIndex: number;
  axisLossDelta: number;
};

export type SelectiveBacktrackDecision<Node extends object> = {
  alternative: Node;
  alternatives: readonly Node[];
  eventIndex: number;
  branchGapIndex: number;
  fromGapIndex: number;
  contactAdvance: number;
  gapRewind: number;
  axisLossDelta: number;
  triggerAxisLoss: number;
  triggerSignal: SelectiveBacktrackSignal;
  incumbentAxisLoss: number | null;
  incumbentAxisLossDelta: number | null;
  repairAttemptIndex: number | null;
  explorationBudget: SelectiveExplorationBudgetAssessment | null;
};

export type SelectiveAdmissibleRewindChoice = {
  branch_gap_index: number;
  alternative_gap_index: number;
  contact_advance: number;
  gap_rewind: number;
  axis_loss_delta: number;
  conservative_deadline_margin: number;
};

export type SelectiveCatchupOutcome =
  | "alternative_selected"
  | "current_selected"
  | "probe_dead_end"
  | "probe_deferred"
  | "probe_budget_yield"
  | "execution_ceiling";

export type SelectiveCatchupProbeOutcome =
  | "reached_target"
  | "probe_dead_end"
  | "probe_deferred"
  | "probe_budget_yield"
  | "execution_ceiling";

export type SelectiveCatchupProbeResult = {
  route_ordinal: number;
  route_kind: "causal_alternative";
  alternative_ordinal: number;
  outcome: SelectiveCatchupProbeOutcome;
  end_gap_index: number;
  probe_nodes_processed: number;
  probe_frames: number;
  ranked_option_calls: number;
  requested_normal_proposals: number;
  candidate_geometry_evaluations: number;
  atomic_node_frames: number[];
  tail_completion_attempts: number;
  budget_allowance_frames: number | null;
  budget_remaining_before_yield: number | null;
  estimated_next_node_frames: number | null;
  axis_loss: number | null;
  local_fallback_choices: SelectiveLocalFallbackChoice[];
};

export type SelectiveLocalFallbackChoice = {
  choice_ordinal: number;
  gap_index: number;
  remaining_gap_advance: number;
  current_relative_axis_loss_gain: number;
  conservative_deadline_margin: number;
};

export type SelectiveBacktrackingStats = {
  policy: SelectiveCatchupPolicy;
  min_contact_advance: number;
  min_axis_loss_delta: number;
  catchup_axis_loss_gain_threshold: number;
  mature_axis_loss_delta_max: number;
  regret_opportunities_by_min_axis_loss_delta: Record<
    string,
    { crossed_watches: number; admissible_watches: number }
  >;
  repair_incumbent_regret_opportunities_by_min_axis_loss_delta: Record<
    string,
    { crossed_watches: number; admissible_watches: number }
  >;
  repair_incumbent_regret_opportunities_by_min_contact_advance: Record<
    string,
    { crossed_watches: number; admissible_watches: number }
  >;
  repair_incumbent_axis_loss_delta_max: number;
  repair_incumbent_max_backtracks_per_attempt: number;
  repair_incumbent_attempt_limit_suppressed_watches: number;
  periodic_contact_interval: number;
  periodic_contact_rewind: number;
  periodic_terminal_reserve_factor: number;
  periodic_exploration_budget_fraction: number;
  periodic_schedule_checks: number;
  periodic_exact_rewind_opportunities: number;
  periodic_admitted: number;
  periodic_alternative_unavailable: number;
  periodic_execution_ceiling_suppressed: number;
  periodic_terminal_reserve_suppressed: number;
  periodic_exploration_allowance_suppressed: number;
  periodic_probe_frames: number;
  periodic_probe_nodes_processed: number;
  periodic_opportunities: SelectivePeriodicOpportunity[];
  value_min_contact_advance: number;
  value_density_frame_scale: number;
  value_density_thresholds: number[];
  value_opportunities_by_density: Record<
    string,
    { crossed_watches: number; admissible_watches: number }
  >;
  value_opportunities: SelectiveValueOpportunity[];
  value_live_density_threshold: number;
  value_live_min_gap_progress: number;
  value_live_progress_suppressed_watches: number;
  value_live_progress_expired_watches: number;
  value_live_crossings: number;
  value_live_admitted: number;
  value_live_ranked_out: number;
  value_live_production_priority: number;
  value_live_alternative_unavailable: number;
  value_live_execution_ceiling_suppressed: number;
  value_live_terminal_reserve_suppressed: number;
  value_live_exploration_allowance_suppressed: number;
  value_live_probe_frames: number;
  value_live_probe_nodes_processed: number;
  value_live_probe_budget_yields: number;
  value_live_opportunities: SelectiveValueLiveOpportunity[];
  deferred_value_density_threshold: number;
  deferred_value_min_gap_progress: number;
  deferred_value_allowance_fractions: number[];
  deferred_value_map_max_allowance_fraction: number;
  deferred_value_crossings: number;
  deferred_value_progress_expired: number;
  deferred_value_alternative_unavailable_at_collection: number;
  deferred_value_collected: number;
  deferred_value_assessed: number;
  deferred_value_incumbent_path: number;
  deferred_value_production_consumed: number;
  deferred_value_alternative_unavailable_at_terminal: number;
  deferred_value_affordable: number;
  deferred_value_first_terminal_total_spent_frames: number | null;
  deferred_value_first_terminal_track_hash: string | null;
  deferred_value_opportunities: SelectiveDeferredValueOpportunity[];
  contact_expansions_observed: number;
  branch_watches_armed: number;
  branch_watches_by_alternative_count: Record<string, number>;
  mature_watch_checks: number;
  loss_threshold_crossings: number;
  deadline_suppressed_crossings: number;
  execution_ceiling_suppressed_crossings: number;
  unavailable_alternatives: number;
  selective_backtracks: number;
  selective_backtracks_by_signal: Record<SelectiveBacktrackSignal, number>;
  selective_backtracks_with_multiple_admissible_rewind_choices: number;
  admissible_rewind_choice_count_sum: number;
  admissible_rewind_choice_count_max: number;
  selective_backtracks_with_additional_sibling_available: number;
  additional_siblings_available_at_selective_backtrack_sum: number;
  additional_siblings_available_at_selective_backtrack_max: number;
  suspended_continuations_resumed: number;
  catchup_completed: number;
  catchup_alternative_selected: number;
  catchup_current_selected: number;
  catchup_probe_dead_ends: number;
  catchup_probe_deferred: number;
  catchup_probe_budget_yields: number;
  catchup_execution_ceiling_stops: number;
  catchup_probe_attempts: number;
  catchup_probe_target_reaches: number;
  catchup_probes_with_local_fallback_choice: number;
  catchup_probes_with_positive_local_fallback_choice: number;
  catchup_local_fallback_choice_count_sum: number;
  catchup_positive_local_fallback_choice_count_sum: number;
  catchup_local_fallback_choice_count_max: number;
  catchup_additional_probe_attempts: number;
  catchup_additional_probe_target_reaches: number;
  catchup_tournaments_with_additional_probe: number;
  catchup_additional_alternative_selected: number;
  catchup_probe_nodes_processed: number;
  catchup_probe_frames: number;
  axis_loss_delta_sum: number;
  axis_loss_delta_max: number;
  contact_advance_sum: number;
  contact_advance_max: number;
  gap_rewind_sum: number;
  gap_rewind_max: number;
  selective_backtracks_by_lane: Record<FrontierTraversalLane, number>;
  events: SelectiveBacktrackingEvent[];
};

export type SelectiveBacktrackingEvent = {
  watch_id: number;
  lane: FrontierTraversalLane;
  trigger_signal: SelectiveBacktrackSignal;
  branch_gap_index: number;
  from_gap_index: number;
  alternative_gap_index: number;
  additional_siblings_available: number;
  catchup_alternatives_requested: number;
  contact_advance: number;
  gap_rewind: number;
  baseline_axis_loss: number;
  trigger_axis_loss: number;
  axis_loss_delta: number;
  incumbent_axis_loss: number | null;
  incumbent_axis_loss_delta: number | null;
  repair_attempt_index: number | null;
  periodic_budget: SelectiveExplorationBudgetAssessment | null;
  value_budget: SelectiveExplorationBudgetAssessment | null;
  admissible_rewind_choices: SelectiveAdmissibleRewindChoice[];
  alternative_conservative_deadline_margin: number;
  trigger_total_spent_frames: number;
  resumed_total_spent_frames: number | null;
  catchup_outcome: SelectiveCatchupOutcome | null;
  catchup_end_gap_index: number | null;
  catchup_probe_nodes_processed: number;
  catchup_probe_frames: number;
  catchup_axis_loss: number | null;
  catchup_axis_loss_gain: number | null;
  catchup_selected_alternative_ordinal: number | null;
  catchup_selected_route_ordinal: number | null;
  catchup_probe_results: SelectiveCatchupProbeResult[];
  catchup_checkpoints: SelectiveCatchupCheckpoint[];
};

export type SelectiveCatchupCheckpoint = {
  route_ordinal: number;
  route_kind: SelectiveCatchupProbeResult["route_kind"];
  alternative_ordinal: number;
  gap_index: number;
  contact_advance: number;
  probe_nodes_processed: number;
  probe_frames: number;
  current_axis_loss: number;
  alternative_axis_loss: number;
  alternative_axis_loss_gain: number;
};

function emptyLaneCounter(): Record<FrontierTraversalLane, number> {
  return { initial: 0, snapshot: 0, repair: 0, resumed: 0 };
}

function emptySignalCounter(): Record<SelectiveBacktrackSignal, number> {
  return {
    branch_regret: 0,
    repair_incumbent_regret: 0,
    periodic_exploration: 0,
    value_exploration: 0,
  };
}

function emptyRegretOpportunityCounter(): SelectiveBacktrackingStats[
  "regret_opportunities_by_min_axis_loss_delta"
] {
  return Object.fromEntries(SELECTIVE_AXIS_REGRET_OPPORTUNITY_THRESHOLDS.map((threshold) => [
    threshold.toFixed(2),
    { crossed_watches: 0, admissible_watches: 0 },
  ]));
}

function emptyRepairIncumbentRegretOpportunityCounter(): SelectiveBacktrackingStats[
  "repair_incumbent_regret_opportunities_by_min_axis_loss_delta"
] {
  return Object.fromEntries(REPAIR_INCUMBENT_REGRET_OPPORTUNITY_THRESHOLDS.map((threshold) => [
    threshold.toFixed(2),
    { crossed_watches: 0, admissible_watches: 0 },
  ]));
}

function emptyRepairIncumbentMaturityOpportunityCounter(): SelectiveBacktrackingStats[
  "repair_incumbent_regret_opportunities_by_min_contact_advance"
] {
  return Object.fromEntries(REPAIR_INCUMBENT_REGRET_OPPORTUNITY_CONTACT_ADVANCES.map(
    (advance) => [String(advance), { crossed_watches: 0, admissible_watches: 0 }],
  ));
}

function emptyValueOpportunityCounter(): SelectiveBacktrackingStats[
  "value_opportunities_by_density"
] {
  return Object.fromEntries(SELECTIVE_VALUE_DENSITY_THRESHOLDS.map((threshold) => [
    threshold.toFixed(3),
    { crossed_watches: 0, admissible_watches: 0 },
  ]));
}

/**
 * Compile-local signal and attribution state for the bounded-catch-up strategy.
 *
 * The controller knows no frontier representation and performs no mutation.
 * It only carries causal branch-watch lineage, evaluates the regret signal,
 * and returns the exact queued sibling that the frontier scheduler should
 * probe. This keeps trigger policy independent from catch-up scheduling and
 * equal-depth selection.
 */
export class SelectiveAxisRegretController<Node extends object> {
  readonly policy: SelectiveCatchupPolicy;

  private readonly gapIndexOf: (node: Node) => number;
  private readonly lineage = new WeakMap<Node, WatchLink<Node> | null>();
  private readonly suspended = new WeakMap<Node, number>();
  private readonly repairAttemptsWithIncumbentBacktrack = new Set<number>();
  private readonly deferredValueCandidates: Array<DeferredValueCandidate<Node>> = [];
  private readonly stats: SelectiveBacktrackingStats;
  private nextWatchId = 1;
  private deferredValueSealed = false;

  constructor(
    gapIndexOf: (node: Node) => number,
    options: {
      policy?: SelectiveCatchupPolicy;
    } = {},
  ) {
    this.gapIndexOf = gapIndexOf;
    this.policy = options.policy ?? "selective_axis_regret_catchup";
    this.stats = {
      policy: this.policy,
      min_contact_advance: SELECTIVE_AXIS_REGRET_MIN_CONTACT_ADVANCE,
      min_axis_loss_delta: SELECTIVE_AXIS_REGRET_MIN_LOSS_DELTA,
      catchup_axis_loss_gain_threshold: 0,
      mature_axis_loss_delta_max: 0,
      regret_opportunities_by_min_axis_loss_delta: emptyRegretOpportunityCounter(),
      repair_incumbent_regret_opportunities_by_min_axis_loss_delta:
        emptyRepairIncumbentRegretOpportunityCounter(),
      repair_incumbent_regret_opportunities_by_min_contact_advance:
        emptyRepairIncumbentMaturityOpportunityCounter(),
      repair_incumbent_axis_loss_delta_max: 0,
      repair_incumbent_max_backtracks_per_attempt:
        this.policy === "selective_axis_regret_catchup_repair_incumbent_once" ? 1 : 0,
      repair_incumbent_attempt_limit_suppressed_watches: 0,
      periodic_contact_interval: SELECTIVE_PERIODIC_CONTACT_INTERVAL,
      periodic_contact_rewind: SELECTIVE_PERIODIC_CONTACT_REWIND,
      periodic_terminal_reserve_factor: SELECTIVE_PERIODIC_TERMINAL_RESERVE_FACTOR,
      periodic_exploration_budget_fraction:
        SELECTIVE_PERIODIC_EXPLORATION_BUDGET_FRACTION,
      periodic_schedule_checks: 0,
      periodic_exact_rewind_opportunities: 0,
      periodic_admitted: 0,
      periodic_alternative_unavailable: 0,
      periodic_execution_ceiling_suppressed: 0,
      periodic_terminal_reserve_suppressed: 0,
      periodic_exploration_allowance_suppressed: 0,
      periodic_probe_frames: 0,
      periodic_probe_nodes_processed: 0,
      periodic_opportunities: [],
      value_min_contact_advance: SELECTIVE_VALUE_MIN_CONTACT_ADVANCE,
      value_density_frame_scale: SELECTIVE_VALUE_DENSITY_FRAME_SCALE,
      value_density_thresholds: [...SELECTIVE_VALUE_DENSITY_THRESHOLDS],
      value_opportunities_by_density: emptyValueOpportunityCounter(),
      value_opportunities: [],
      value_live_density_threshold: SELECTIVE_VALUE_LIVE_DENSITY_THRESHOLD,
      value_live_min_gap_progress:
        this.policy === "selective_axis_regret_catchup_value_initial_progress_10" ||
          this.policy === "selective_axis_regret_catchup_value_initial_expire_10"
          ? SELECTIVE_VALUE_LIVE_MIN_GAP_PROGRESS
          : 0,
      value_live_progress_suppressed_watches: 0,
      value_live_progress_expired_watches: 0,
      value_live_crossings: 0,
      value_live_admitted: 0,
      value_live_ranked_out: 0,
      value_live_production_priority: 0,
      value_live_alternative_unavailable: 0,
      value_live_execution_ceiling_suppressed: 0,
      value_live_terminal_reserve_suppressed: 0,
      value_live_exploration_allowance_suppressed: 0,
      value_live_probe_frames: 0,
      value_live_probe_nodes_processed: 0,
      value_live_probe_budget_yields: 0,
      value_live_opportunities: [],
      deferred_value_density_threshold: SELECTIVE_VALUE_LIVE_DENSITY_THRESHOLD,
      deferred_value_min_gap_progress: SELECTIVE_VALUE_LIVE_MIN_GAP_PROGRESS,
      deferred_value_allowance_fractions: [
        ...SELECTIVE_DEFERRED_VALUE_ALLOWANCE_FRACTIONS,
      ],
      deferred_value_map_max_allowance_fraction:
        SELECTIVE_DEFERRED_VALUE_MAP_MAX_ALLOWANCE_FRACTION,
      deferred_value_crossings: 0,
      deferred_value_progress_expired: 0,
      deferred_value_alternative_unavailable_at_collection: 0,
      deferred_value_collected: 0,
      deferred_value_assessed: 0,
      deferred_value_incumbent_path: 0,
      deferred_value_production_consumed: 0,
      deferred_value_alternative_unavailable_at_terminal: 0,
      deferred_value_affordable: 0,
      deferred_value_first_terminal_total_spent_frames: null,
      deferred_value_first_terminal_track_hash: null,
      deferred_value_opportunities: [],
      contact_expansions_observed: 0,
      branch_watches_armed: 0,
      branch_watches_by_alternative_count: {},
      mature_watch_checks: 0,
      loss_threshold_crossings: 0,
      deadline_suppressed_crossings: 0,
      execution_ceiling_suppressed_crossings: 0,
      unavailable_alternatives: 0,
      selective_backtracks: 0,
      selective_backtracks_by_signal: emptySignalCounter(),
      selective_backtracks_with_multiple_admissible_rewind_choices: 0,
      admissible_rewind_choice_count_sum: 0,
      admissible_rewind_choice_count_max: 0,
      selective_backtracks_with_additional_sibling_available: 0,
      additional_siblings_available_at_selective_backtrack_sum: 0,
      additional_siblings_available_at_selective_backtrack_max: 0,
      suspended_continuations_resumed: 0,
      catchup_completed: 0,
      catchup_alternative_selected: 0,
      catchup_current_selected: 0,
      catchup_probe_dead_ends: 0,
      catchup_probe_deferred: 0,
      catchup_probe_budget_yields: 0,
      catchup_execution_ceiling_stops: 0,
      catchup_probe_attempts: 0,
      catchup_probe_target_reaches: 0,
      catchup_probes_with_local_fallback_choice: 0,
      catchup_probes_with_positive_local_fallback_choice: 0,
      catchup_local_fallback_choice_count_sum: 0,
      catchup_positive_local_fallback_choice_count_sum: 0,
      catchup_local_fallback_choice_count_max: 0,
      catchup_additional_probe_attempts: 0,
      catchup_additional_probe_target_reaches: 0,
      catchup_tournaments_with_additional_probe: 0,
      catchup_additional_alternative_selected: 0,
      catchup_probe_nodes_processed: 0,
      catchup_probe_frames: 0,
      axis_loss_delta_sum: 0,
      axis_loss_delta_max: 0,
      contact_advance_sum: 0,
      contact_advance_max: 0,
      gap_rewind_sum: 0,
      gap_rewind_max: 0,
      selective_backtracks_by_lane: emptyLaneCounter(),
      events: [],
    };
  }

  observeRoot(node: Node): void {
    if (!this.lineage.has(node)) this.lineage.set(node, null);
  }

  replaceNode(previous: Node, replacement: Node): void {
    this.lineage.set(replacement, this.lineage.get(previous) ?? null);
    const eventIndex = this.suspended.get(previous);
    if (eventIndex !== undefined) {
      this.suspended.delete(previous);
      this.suspended.set(replacement, eventIndex);
    }
  }

  /** Freeze the behavior-neutral initial portfolio at the first improving
   * terminal. The callbacks keep generic watch state separate from the
   * compiler's frontier and prefix representations. */
  assessDeferredValueAtFirstTerminal(input: {
    incumbent: Node;
    firstTerminalTotalSpentFrames: number;
    firstTerminalTrackHash: string;
    remainingHardBudgetFrames: number;
    remainingRepairBudgetFrames: number;
    searchPolicyBudgetFrames: number;
    explorationAllowanceFrames: number;
    currentOnIncumbentPath: (current: Node, incumbent: Node) => boolean;
    alternativeAvailable: (alternative: Node) => boolean;
    estimatedSuffixWorkFrames: (alternative: Node) => number;
  }): SelectiveDeferredValueDecision<Node> | null {
    if (this.policy !== "selective_axis_regret_catchup_value_deferred_map") return null;
    if (this.deferredValueSealed) {
      throw new Error("deferred value portfolio was sealed more than once");
    }
    this.deferredValueSealed = true;
    this.stats.deferred_value_first_terminal_total_spent_frames =
      input.firstTerminalTotalSpentFrames;
    this.stats.deferred_value_first_terminal_track_hash = input.firstTerminalTrackHash;
    const ranked: Array<{
      candidate: DeferredValueCandidate<Node>;
      crossing: SelectiveValueOpportunityPoint;
      terminal: SelectiveDeferredValueTerminalAssessment;
    }> = [];
    for (const candidate of this.deferredValueCandidates) {
      const record = this.stats.deferred_value_opportunities[candidate.recordIndex];
      if (record === undefined || record.outcome !== "collected" || record.terminal !== null) {
        throw new Error("deferred value portfolio lost its collection record");
      }
      const onIncumbentPath = input.currentOnIncumbentPath(
        candidate.current,
        input.incumbent,
      );
      const productionConsumed = candidate.watch.used;
      const alternativeAvailable = input.alternativeAvailable(candidate.watch.alternative);
      const estimatedSuffixWork = Math.max(
        1,
        Math.ceil(input.estimatedSuffixWorkFrames(candidate.watch.alternative)),
      );
      const hardRemaining = Math.max(0, Math.floor(input.remainingHardBudgetFrames));
      const repairRemaining = Math.max(0, Math.floor(input.remainingRepairBudgetFrames));
      const explorationAllowance = Math.max(
        0,
        Math.floor(input.explorationAllowanceFrames),
      );
      const localAllowance = Math.min(
        hardRemaining,
        repairRemaining,
        explorationAllowance,
      );
      const reason: SelectiveDeferredValueTerminalAssessment["reason"] =
        !onIncumbentPath
          ? "not_incumbent_path"
          : productionConsumed
            ? "production_consumed"
            : !alternativeAvailable
              ? "alternative_unavailable"
              : estimatedSuffixWork > hardRemaining
                ? "hard_budget"
                : estimatedSuffixWork > repairRemaining
                  ? "repair_budget"
                  : estimatedSuffixWork > explorationAllowance
                    ? "exploration_allowance"
                    : "admitted";
      const terminal: SelectiveDeferredValueTerminalAssessment = {
        first_terminal_total_spent_frames: input.firstTerminalTotalSpentFrames,
        first_terminal_track_hash: input.firstTerminalTrackHash,
        on_incumbent_path: onIncumbentPath,
        production_consumed: productionConsumed,
        alternative_available: alternativeAvailable,
        remaining_hard_budget_frames: hardRemaining,
        remaining_repair_budget_frames: repairRemaining,
        search_policy_budget_frames: Math.max(
          0,
          Math.floor(input.searchPolicyBudgetFrames),
        ),
        exploration_allowance_frames: explorationAllowance,
        local_allowance_frames: localAllowance,
        estimated_suffix_work_frames: estimatedSuffixWork,
        terminal_value_density_per_10k_estimated_frames:
          candidate.axisLossDelta * SELECTIVE_VALUE_DENSITY_FRAME_SCALE /
          estimatedSuffixWork,
        affordable: reason === "admitted",
        reason,
        affordable_rank: null,
      };
      record.terminal = terminal;
      this.stats.deferred_value_assessed++;
      if (onIncumbentPath) this.stats.deferred_value_incumbent_path++;
      if (productionConsumed) this.stats.deferred_value_production_consumed++;
      if (!alternativeAvailable) {
        this.stats.deferred_value_alternative_unavailable_at_terminal++;
      }
      if (terminal.affordable) {
        this.stats.deferred_value_affordable++;
        ranked.push({ candidate, crossing: record.crossing, terminal });
      }
    }
    ranked.sort((left, right) =>
      right.terminal.terminal_value_density_per_10k_estimated_frames -
        left.terminal.terminal_value_density_per_10k_estimated_frames ||
      right.crossing.axis_loss_delta - left.crossing.axis_loss_delta ||
      right.crossing.alternative_gap_index - left.crossing.alternative_gap_index ||
      left.candidate.watch.watchId - right.candidate.watch.watchId
    );
    for (let index = 0; index < ranked.length; index++) {
      ranked[index]!.terminal.affordable_rank = index + 1;
    }
    const winner = ranked[0];
    return winner === undefined
      ? null
      : {
        watchId: winner.candidate.watch.watchId,
        current: winner.candidate.current,
        alternative: winner.candidate.watch.alternative,
        crossing: { ...winner.crossing, budget: { ...winner.crossing.budget } },
        terminal: { ...winner.terminal },
      };
  }

  /** Propagate all ancestor watches to every child and arm one new watch only
   * on the ranker's preferred child. The concrete runner-up object is the
   * rewind target; no candidate is regenerated later. */
  observeExpansion(input: {
    parent: Node;
    children: readonly Node[];
    contactExpansion: boolean;
    contactOrdinal: number;
    axisLoss: number;
  }): void {
    const inherited = this.lineage.get(input.parent) ?? null;
    for (const child of input.children) this.lineage.set(child, inherited);
    if (!input.contactExpansion) return;
    this.stats.contact_expansions_observed++;
    if (input.children.length < 2) return;

    const watch: AxisRegretWatch<Node> = {
      watchId: this.nextWatchId++,
      alternative: input.children[1]!,
      additionalAlternatives: input.children.slice(2),
      branchContactOrdinal: input.contactOrdinal,
      branchGapIndex: this.gapIndexOf(input.parent),
      baselineAxisLoss: input.axisLoss,
      used: false,
      signalCrossed: false,
      deadlineSuppressionRecorded: false,
      opportunityCrossedMask: 0,
      opportunityAdmissibleMask: 0,
      repairIncumbentOpportunityCrossedMask: 0,
      repairIncumbentOpportunityAdmissibleMask: 0,
      repairIncumbentMaturityOpportunityCrossedMask: 0,
      repairIncumbentMaturityOpportunityAdmissibleMask: 0,
      repairIncumbentAttemptLimitSuppressionRecorded: false,
      valueOpportunityCrossedMask: 0,
      valueOpportunityAdmissibleMask: 0,
      valueOpportunityRecordIndices: SELECTIVE_VALUE_DENSITY_THRESHOLDS.map(() => null),
      valueLiveCrossed: false,
      valueLiveProgressSuppressionRecorded: false,
      deferredValueCrossed: false,
    };
    this.lineage.set(input.children[0]!, { watch, parent: inherited });
    this.stats.branch_watches_armed++;
    const alternativeCount = input.children.length - 1;
    const alternativeCountKey = String(alternativeCount);
    this.stats.branch_watches_by_alternative_count[alternativeCountKey] =
      (this.stats.branch_watches_by_alternative_count[alternativeCountKey] ?? 0) + 1;
  }

  consider(input: {
    node: Node;
    contactOrdinal: number;
    contactBoundary?: boolean;
    gapProgress?: number;
    axisLoss: number;
    incumbentAxisLoss?: number | null;
    repairAttemptIndex?: number | null;
    executionCeilingReached: boolean;
    totalSpentFrames: number;
    lane: FrontierTraversalLane;
    alternativeAvailable: (node: Node) => boolean;
    alternativeDeadline: (node: Node) => { margin: number; pressured: boolean };
    explorationBudgetAssessment?: (
      alternative: Node,
      fromGapIndex: number,
      explorationProbeFrames: number,
    ) => SelectiveExplorationBudgetAssessment;
  }): SelectiveBacktrackDecision<Node> | null {
    const periodicLaneEnabled =
      (this.policy === "selective_axis_regret_catchup_periodic_initial" &&
        input.lane === "initial") ||
      (this.policy === "selective_axis_regret_catchup_periodic_repair" &&
        input.lane === "repair");
    const periodicScheduled = periodicLaneEnabled &&
      input.contactBoundary === true &&
      input.contactOrdinal > 0 &&
      input.contactOrdinal % SELECTIVE_PERIODIC_CONTACT_INTERVAL === 0;
    if (periodicScheduled) this.stats.periodic_schedule_checks++;
    let periodicCandidate: {
      watch: AxisRegretWatch<Node>;
      contactAdvance: number;
      axisLossDelta: number;
    } | null = null;
    const valueLiveCandidates: Array<{
      watch: AxisRegretWatch<Node>;
      contactAdvance: number;
      axisLossDelta: number;
      density: number;
      gapRewind: number;
      lineageOrder: number;
      deadline: { margin: number; pressured: boolean };
      budget: SelectiveExplorationBudgetAssessment;
      point: SelectiveValueOpportunityPoint;
    }> = [];
    let lineageOrder = 0;

    const recordDecision = (
      watch: AxisRegretWatch<Node>,
      contactAdvance: number,
      axisLossDelta: number,
      triggerSignal: SelectiveBacktrackSignal,
      incumbentAxisLossDelta: number | null,
      repairAttemptIndex: number | null,
      admittedAlternativeDeadline: { margin: number; pressured: boolean },
      admissibleRewindChoices: SelectiveAdmissibleRewindChoice[],
      explorationBudget: SelectiveExplorationBudgetAssessment | null,
    ): SelectiveBacktrackDecision<Node> => {
      const fromGapIndex = this.gapIndexOf(input.node);
      const targetGapIndex = this.gapIndexOf(watch.alternative);
      const gapRewind = Math.max(0, fromGapIndex - targetGapIndex);
      watch.used = true;
      const availableAdditionalAlternatives = watch.additionalAlternatives.filter(
        (alternative) => input.alternativeAvailable(alternative),
      );
      const additionalSiblingsAvailable = availableAdditionalAlternatives.length;
      const alternatives = [watch.alternative];
      this.stats.selective_backtracks++;
      this.stats.selective_backtracks_by_signal[triggerSignal]++;
      this.stats.admissible_rewind_choice_count_sum += admissibleRewindChoices.length;
      this.stats.admissible_rewind_choice_count_max = Math.max(
        this.stats.admissible_rewind_choice_count_max,
        admissibleRewindChoices.length,
      );
      if (admissibleRewindChoices.length > 1) {
        this.stats.selective_backtracks_with_multiple_admissible_rewind_choices++;
      }
      if (triggerSignal === "repair_incumbent_regret") {
        this.repairAttemptsWithIncumbentBacktrack.add(repairAttemptIndex!);
      }
      if (additionalSiblingsAvailable > 0) {
        this.stats.selective_backtracks_with_additional_sibling_available++;
      }
      this.stats.additional_siblings_available_at_selective_backtrack_sum +=
        additionalSiblingsAvailable;
      this.stats.additional_siblings_available_at_selective_backtrack_max = Math.max(
        this.stats.additional_siblings_available_at_selective_backtrack_max,
        additionalSiblingsAvailable,
      );
      this.stats.selective_backtracks_by_lane[input.lane]++;
      this.stats.axis_loss_delta_sum += axisLossDelta;
      this.stats.axis_loss_delta_max = Math.max(this.stats.axis_loss_delta_max, axisLossDelta);
      this.stats.contact_advance_sum += contactAdvance;
      this.stats.contact_advance_max = Math.max(this.stats.contact_advance_max, contactAdvance);
      this.stats.gap_rewind_sum += gapRewind;
      this.stats.gap_rewind_max = Math.max(this.stats.gap_rewind_max, gapRewind);
      const eventIndex = this.stats.events.length;
      this.stats.events.push({
        watch_id: watch.watchId,
        lane: input.lane,
        trigger_signal: triggerSignal,
        branch_gap_index: watch.branchGapIndex,
        from_gap_index: fromGapIndex,
        alternative_gap_index: targetGapIndex,
        additional_siblings_available: additionalSiblingsAvailable,
        catchup_alternatives_requested: alternatives.length,
        contact_advance: contactAdvance,
        gap_rewind: gapRewind,
        baseline_axis_loss: watch.baselineAxisLoss,
        trigger_axis_loss: input.axisLoss,
        axis_loss_delta: axisLossDelta,
        incumbent_axis_loss: input.incumbentAxisLoss ?? null,
        incumbent_axis_loss_delta: incumbentAxisLossDelta,
        repair_attempt_index: repairAttemptIndex,
        periodic_budget: triggerSignal === "periodic_exploration"
          ? explorationBudget
          : null,
        value_budget: triggerSignal === "value_exploration"
          ? explorationBudget
          : null,
        admissible_rewind_choices: admissibleRewindChoices,
        alternative_conservative_deadline_margin: admittedAlternativeDeadline.margin,
        trigger_total_spent_frames: input.totalSpentFrames,
        resumed_total_spent_frames: null,
        catchup_outcome: null,
        catchup_end_gap_index: null,
        catchup_probe_nodes_processed: 0,
        catchup_probe_frames: 0,
        catchup_axis_loss: null,
        catchup_axis_loss_gain: null,
        catchup_selected_alternative_ordinal: null,
        catchup_selected_route_ordinal: null,
        catchup_probe_results: [],
        catchup_checkpoints: [],
      });
      this.suspended.set(input.node, eventIndex);
      return {
        alternative: watch.alternative,
        alternatives,
        eventIndex,
        branchGapIndex: watch.branchGapIndex,
        fromGapIndex,
        contactAdvance,
        gapRewind,
        axisLossDelta,
        triggerAxisLoss: input.axisLoss,
        triggerSignal,
        incumbentAxisLoss: input.incumbentAxisLoss ?? null,
        incumbentAxisLossDelta,
        repairAttemptIndex,
        explorationBudget,
      };
    };

    const recordValueLiveOpportunity = (
      watch: AxisRegretWatch<Node>,
      point: SelectiveValueOpportunityPoint,
      outcome: SelectiveValueLiveOpportunity["outcome"],
      affordableRank: number | null,
    ): void => {
      this.stats.value_live_opportunities.push({
        watch_id: watch.watchId,
        outcome,
        affordable_rank: affordableRank,
        point,
      });
      if (outcome === "admitted") this.stats.value_live_admitted++;
      else if (outcome === "ranked_out") this.stats.value_live_ranked_out++;
      else if (outcome === "production_priority") {
        this.stats.value_live_production_priority++;
      } else if (outcome === "progress_expired") {
        this.stats.value_live_progress_expired_watches++;
      } else if (outcome === "alternative_unavailable") {
        this.stats.value_live_alternative_unavailable++;
      } else if (outcome === "execution_ceiling") {
        this.stats.value_live_execution_ceiling_suppressed++;
      } else if (outcome === "terminal_reserve") {
        this.stats.value_live_terminal_reserve_suppressed++;
      } else if (outcome === "exploration_allowance") {
        this.stats.value_live_exploration_allowance_suppressed++;
      }
    };

    const flushValueCandidatesForProductionPriority = (): void => {
      for (const candidate of valueLiveCandidates) {
        recordValueLiveOpportunity(
          candidate.watch,
          candidate.point,
          "production_priority",
          null,
        );
      }
      valueLiveCandidates.length = 0;
    };

    let link = this.lineage.get(input.node) ?? null;
    while (link !== null) {
      const watch = link.watch;
      link = link.parent;
      const currentLineageOrder = lineageOrder++;
      if (watch.used) continue;

      const contactAdvance = input.contactOrdinal - watch.branchContactOrdinal;
      if (contactAdvance < SELECTIVE_AXIS_REGRET_MIN_CONTACT_ADVANCE) continue;
      this.stats.mature_watch_checks++;
      const axisLossDelta = input.axisLoss - watch.baselineAxisLoss;
      if (
        periodicScheduled &&
        periodicCandidate === null &&
        contactAdvance === SELECTIVE_PERIODIC_CONTACT_REWIND
      ) {
        periodicCandidate = { watch, contactAdvance, axisLossDelta };
      }
      this.stats.mature_axis_loss_delta_max = Math.max(
        this.stats.mature_axis_loss_delta_max,
        axisLossDelta,
      );

      let alternativeAvailable: boolean | undefined;
      let alternativeDeadline: { margin: number; pressured: boolean } | undefined;
      const readAlternativeAvailable = (): boolean => {
        alternativeAvailable ??= input.alternativeAvailable(watch.alternative);
        return alternativeAvailable;
      };
      const readAlternativeDeadline = (): { margin: number; pressured: boolean } => {
        alternativeDeadline ??= input.alternativeDeadline(watch.alternative);
        return alternativeDeadline;
      };

      if (
        this.policy === "selective_axis_regret_catchup_value_map" &&
        (input.lane === "initial" || input.lane === "repair") &&
        input.contactBoundary === true &&
        contactAdvance >= SELECTIVE_VALUE_MIN_CONTACT_ADVANCE &&
        axisLossDelta > 0
      ) {
        if (input.explorationBudgetAssessment === undefined) {
          throw new Error("value opportunity map requires a budget assessment");
        }
        const fromGapIndex = this.gapIndexOf(input.node);
        const alternativeGapIndex = this.gapIndexOf(watch.alternative);
        const budget = input.explorationBudgetAssessment(
          watch.alternative,
          fromGapIndex,
          0,
        );
        const available = readAlternativeAvailable();
        const density = axisLossDelta * SELECTIVE_VALUE_DENSITY_FRAME_SCALE /
          Math.max(1, budget.estimated_probe_work_frames);
        const point = (): SelectiveValueOpportunityPoint => ({
          lane: input.lane,
          contact_ordinal: input.contactOrdinal,
          from_gap_index: fromGapIndex,
          branch_gap_index: watch.branchGapIndex,
          alternative_gap_index: alternativeGapIndex,
          contact_advance: contactAdvance,
          gap_rewind: Math.max(0, fromGapIndex - alternativeGapIndex),
          baseline_axis_loss: watch.baselineAxisLoss,
          current_axis_loss: input.axisLoss,
          axis_loss_delta: axisLossDelta,
          value_density_per_10k_estimated_frames: density,
          gap_progress: input.gapProgress ?? null,
          total_spent_frames: input.totalSpentFrames,
          alternative_available: available,
          execution_ceiling_reached: input.executionCeilingReached,
          budget: { ...budget },
        });
        for (let i = 0; i < SELECTIVE_VALUE_DENSITY_THRESHOLDS.length; i++) {
          const threshold = SELECTIVE_VALUE_DENSITY_THRESHOLDS[i]!;
          if (density < threshold) continue;
          const bit = 1 << i;
          const counter = this.stats.value_opportunities_by_density[threshold.toFixed(3)]!;
          if ((watch.valueOpportunityCrossedMask & bit) === 0) {
            watch.valueOpportunityCrossedMask |= bit;
            counter.crossed_watches++;
            watch.valueOpportunityRecordIndices[i] = this.stats.value_opportunities.length;
            this.stats.value_opportunities.push({
              watch_id: watch.watchId,
              threshold,
              crossing: point(),
              first_admission: null,
            });
          }
          if (
            (watch.valueOpportunityAdmissibleMask & bit) === 0 &&
            available &&
            !input.executionCeilingReached &&
            budget.admitted
          ) {
            watch.valueOpportunityAdmissibleMask |= bit;
            counter.admissible_watches++;
            const recordIndex = watch.valueOpportunityRecordIndices[i];
            if (recordIndex === null || recordIndex === undefined) {
              throw new Error("value opportunity admission lost its crossing record");
            }
            this.stats.value_opportunities[recordIndex]!.first_admission = point();
          }
        }
      }

      if (
        this.policy === "selective_axis_regret_catchup_value_deferred_map" &&
        input.lane === "initial" &&
        input.contactBoundary === true &&
        contactAdvance >= SELECTIVE_VALUE_MIN_CONTACT_ADVANCE &&
        axisLossDelta > 0 &&
        !watch.deferredValueCrossed &&
        !this.deferredValueSealed
      ) {
        if (input.explorationBudgetAssessment === undefined) {
          throw new Error("deferred value map requires a budget assessment");
        }
        const fromGapIndex = this.gapIndexOf(input.node);
        const alternativeGapIndex = this.gapIndexOf(watch.alternative);
        const budget = input.explorationBudgetAssessment(
          watch.alternative,
          fromGapIndex,
          0,
        );
        const density = axisLossDelta * SELECTIVE_VALUE_DENSITY_FRAME_SCALE /
          Math.max(1, budget.estimated_probe_work_frames);
        if (density >= SELECTIVE_VALUE_LIVE_DENSITY_THRESHOLD) {
          watch.deferredValueCrossed = true;
          this.stats.deferred_value_crossings++;
          const available = readAlternativeAvailable();
          const crossing: SelectiveValueOpportunityPoint = {
            lane: input.lane,
            contact_ordinal: input.contactOrdinal,
            from_gap_index: fromGapIndex,
            branch_gap_index: watch.branchGapIndex,
            alternative_gap_index: alternativeGapIndex,
            contact_advance: contactAdvance,
            gap_rewind: Math.max(0, fromGapIndex - alternativeGapIndex),
            baseline_axis_loss: watch.baselineAxisLoss,
            current_axis_loss: input.axisLoss,
            axis_loss_delta: axisLossDelta,
            value_density_per_10k_estimated_frames: density,
            gap_progress: input.gapProgress ?? null,
            total_spent_frames: input.totalSpentFrames,
            alternative_available: available,
            execution_ceiling_reached: input.executionCeilingReached,
            budget: { ...budget },
          };
          const gapProgress = input.gapProgress ?? 0;
          const outcome: SelectiveDeferredValueOpportunity["outcome"] =
            gapProgress < SELECTIVE_VALUE_LIVE_MIN_GAP_PROGRESS
              ? "progress_expired"
              : !available
                ? "alternative_unavailable_at_collection"
                : "collected";
          const recordIndex = this.stats.deferred_value_opportunities.length;
          this.stats.deferred_value_opportunities.push({
            watch_id: watch.watchId,
            outcome,
            crossing,
            terminal: null,
          });
          if (outcome === "progress_expired") {
            this.stats.deferred_value_progress_expired++;
          } else if (outcome === "alternative_unavailable_at_collection") {
            this.stats.deferred_value_alternative_unavailable_at_collection++;
          } else {
            this.stats.deferred_value_collected++;
            this.deferredValueCandidates.push({
              watch,
              current: input.node,
              recordIndex,
              axisLossDelta,
            });
          }
        }
      }

      if (
        (this.policy === "selective_axis_regret_catchup_value_initial" ||
          this.policy === "selective_axis_regret_catchup_value_initial_progress_10" ||
          this.policy === "selective_axis_regret_catchup_value_initial_expire_10") &&
        input.lane === "initial" &&
        input.contactBoundary === true &&
        contactAdvance >= SELECTIVE_VALUE_MIN_CONTACT_ADVANCE &&
        axisLossDelta > 0 &&
        !watch.valueLiveCrossed
      ) {
        if (input.explorationBudgetAssessment === undefined) {
          throw new Error("value-ranked selective backtracking requires a budget assessment");
        }
        const fromGapIndex = this.gapIndexOf(input.node);
        const alternativeGapIndex = this.gapIndexOf(watch.alternative);
        const budget = input.explorationBudgetAssessment(
          watch.alternative,
          fromGapIndex,
          this.stats.value_live_probe_frames,
        );
        const density = axisLossDelta * SELECTIVE_VALUE_DENSITY_FRAME_SCALE /
          Math.max(1, budget.estimated_probe_work_frames);
        const makePoint = (): SelectiveValueOpportunityPoint => ({
          lane: input.lane,
          contact_ordinal: input.contactOrdinal,
          from_gap_index: fromGapIndex,
          branch_gap_index: watch.branchGapIndex,
          alternative_gap_index: alternativeGapIndex,
          contact_advance: contactAdvance,
          gap_rewind: Math.max(0, fromGapIndex - alternativeGapIndex),
          baseline_axis_loss: watch.baselineAxisLoss,
          current_axis_loss: input.axisLoss,
          axis_loss_delta: axisLossDelta,
          value_density_per_10k_estimated_frames: density,
          gap_progress: input.gapProgress ?? null,
          total_spent_frames: input.totalSpentFrames,
          alternative_available: readAlternativeAvailable(),
          execution_ceiling_reached: input.executionCeilingReached,
          budget: { ...budget },
        });
        if (density >= SELECTIVE_VALUE_LIVE_DENSITY_THRESHOLD) {
          const minimumProgress = this.stats.value_live_min_gap_progress;
          const gapProgress = input.gapProgress ?? 0;
          if (gapProgress < minimumProgress) {
            if (this.policy === "selective_axis_regret_catchup_value_initial_expire_10") {
              watch.valueLiveCrossed = true;
              this.stats.value_live_crossings++;
              recordValueLiveOpportunity(watch, makePoint(), "progress_expired", null);
            } else if (!watch.valueLiveProgressSuppressionRecorded) {
              watch.valueLiveProgressSuppressionRecorded = true;
              this.stats.value_live_progress_suppressed_watches++;
            }
          } else {
            watch.valueLiveCrossed = true;
            this.stats.value_live_crossings++;
            const point = makePoint();
            const available = point.alternative_available;
            if (!available) {
              recordValueLiveOpportunity(
                watch,
                point,
                "alternative_unavailable",
                null,
              );
            } else if (input.executionCeilingReached) {
              recordValueLiveOpportunity(watch, point, "execution_ceiling", null);
            } else if (!budget.admitted) {
              recordValueLiveOpportunity(watch, point, budget.reason, null);
            } else {
              valueLiveCandidates.push({
                watch,
                contactAdvance,
                axisLossDelta,
                density,
                gapRewind: point.gap_rewind,
                lineageOrder: currentLineageOrder,
                deadline: readAlternativeDeadline(),
                budget,
                point,
              });
            }
          }
        }
      }

      const incumbentAxisLossDelta =
        input.lane === "repair" &&
        input.incumbentAxisLoss !== null &&
        input.incumbentAxisLoss !== undefined &&
        Number.isFinite(input.incumbentAxisLoss)
          ? input.axisLoss - input.incumbentAxisLoss
          : null;
      if (incumbentAxisLossDelta !== null) {
        this.stats.repair_incumbent_axis_loss_delta_max = Math.max(
          this.stats.repair_incumbent_axis_loss_delta_max,
          incumbentAxisLossDelta,
        );
        let newlyEligibleRepairMask = 0;
        for (let i = 0; i < REPAIR_INCUMBENT_REGRET_OPPORTUNITY_THRESHOLDS.length; i++) {
          const threshold = REPAIR_INCUMBENT_REGRET_OPPORTUNITY_THRESHOLDS[i]!;
          if (!(incumbentAxisLossDelta > threshold)) continue;
          const bit = 1 << i;
          const counter =
            this.stats.repair_incumbent_regret_opportunities_by_min_axis_loss_delta[
              threshold.toFixed(2)
            ]!;
          if ((watch.repairIncumbentOpportunityCrossedMask & bit) === 0) {
            watch.repairIncumbentOpportunityCrossedMask |= bit;
            counter.crossed_watches++;
          }
          if ((watch.repairIncumbentOpportunityAdmissibleMask & bit) === 0) {
            newlyEligibleRepairMask |= bit;
          }
        }
        if (
          newlyEligibleRepairMask !== 0 &&
          !input.executionCeilingReached &&
          readAlternativeAvailable() &&
          !readAlternativeDeadline().pressured
        ) {
          for (let i = 0; i < REPAIR_INCUMBENT_REGRET_OPPORTUNITY_THRESHOLDS.length; i++) {
            const bit = 1 << i;
            if ((newlyEligibleRepairMask & bit) === 0) continue;
            watch.repairIncumbentOpportunityAdmissibleMask |= bit;
            const threshold = REPAIR_INCUMBENT_REGRET_OPPORTUNITY_THRESHOLDS[i]!;
            this.stats.repair_incumbent_regret_opportunities_by_min_axis_loss_delta[
              threshold.toFixed(2)
            ]!.admissible_watches++;
          }
        }
        let newlyEligibleMaturityMask = 0;
        if (incumbentAxisLossDelta > SELECTIVE_REPAIR_INCUMBENT_MIN_LOSS_DELTA) {
          for (let i = 0; i < REPAIR_INCUMBENT_REGRET_OPPORTUNITY_CONTACT_ADVANCES.length; i++) {
            const advance = REPAIR_INCUMBENT_REGRET_OPPORTUNITY_CONTACT_ADVANCES[i]!;
            if (contactAdvance < advance) continue;
            const bit = 1 << i;
            const counter =
              this.stats.repair_incumbent_regret_opportunities_by_min_contact_advance[
                String(advance)
              ]!;
            if ((watch.repairIncumbentMaturityOpportunityCrossedMask & bit) === 0) {
              watch.repairIncumbentMaturityOpportunityCrossedMask |= bit;
              counter.crossed_watches++;
            }
            if ((watch.repairIncumbentMaturityOpportunityAdmissibleMask & bit) === 0) {
              newlyEligibleMaturityMask |= bit;
            }
          }
        }
        if (
          newlyEligibleMaturityMask !== 0 &&
          !input.executionCeilingReached &&
          readAlternativeAvailable() &&
          !readAlternativeDeadline().pressured
        ) {
          for (let i = 0; i < REPAIR_INCUMBENT_REGRET_OPPORTUNITY_CONTACT_ADVANCES.length; i++) {
            const bit = 1 << i;
            if ((newlyEligibleMaturityMask & bit) === 0) continue;
            watch.repairIncumbentMaturityOpportunityAdmissibleMask |= bit;
            const advance = REPAIR_INCUMBENT_REGRET_OPPORTUNITY_CONTACT_ADVANCES[i]!;
            this.stats.repair_incumbent_regret_opportunities_by_min_contact_advance[
              String(advance)
            ]!.admissible_watches++;
          }
        }
      }

      let newlyEligibleMask = 0;
      for (let i = 0; i < SELECTIVE_AXIS_REGRET_OPPORTUNITY_THRESHOLDS.length; i++) {
        const threshold = SELECTIVE_AXIS_REGRET_OPPORTUNITY_THRESHOLDS[i]!;
        if (axisLossDelta < threshold) continue;
        const bit = 1 << i;
        const counter = this.stats.regret_opportunities_by_min_axis_loss_delta[
          threshold.toFixed(2)
        ]!;
        if ((watch.opportunityCrossedMask & bit) === 0) {
          watch.opportunityCrossedMask |= bit;
          counter.crossed_watches++;
        }
        if ((watch.opportunityAdmissibleMask & bit) === 0) newlyEligibleMask |= bit;
      }
      if (
        newlyEligibleMask !== 0 &&
        !input.executionCeilingReached &&
        readAlternativeAvailable() &&
        !readAlternativeDeadline().pressured
      ) {
        for (let i = 0; i < SELECTIVE_AXIS_REGRET_OPPORTUNITY_THRESHOLDS.length; i++) {
          const bit = 1 << i;
          if ((newlyEligibleMask & bit) === 0) continue;
          watch.opportunityAdmissibleMask |= bit;
          const threshold = SELECTIVE_AXIS_REGRET_OPPORTUNITY_THRESHOLDS[i]!;
          this.stats.regret_opportunities_by_min_axis_loss_delta[
            threshold.toFixed(2)
          ]!.admissible_watches++;
        }
      }
      const branchRegretTriggered = axisLossDelta >= SELECTIVE_AXIS_REGRET_MIN_LOSS_DELTA;
      if (branchRegretTriggered && !watch.signalCrossed) {
        watch.signalCrossed = true;
        this.stats.loss_threshold_crossings++;
      }
      const repairIncumbentRegretTriggered =
        this.policy === "selective_axis_regret_catchup_repair_incumbent_once" &&
        incumbentAxisLossDelta !== null &&
        incumbentAxisLossDelta > SELECTIVE_REPAIR_INCUMBENT_MIN_LOSS_DELTA;
      if (!branchRegretTriggered && !repairIncumbentRegretTriggered) continue;
      const triggerSignal: SelectiveBacktrackSignal = branchRegretTriggered
        ? "branch_regret"
        : "repair_incumbent_regret";
      const repairAttemptIndex = input.lane === "repair"
        ? input.repairAttemptIndex ?? null
        : null;
      if (triggerSignal === "repair_incumbent_regret") {
        if (!Number.isSafeInteger(repairAttemptIndex) || repairAttemptIndex! < 0) {
          throw new Error("repair-incumbent catch-up requires a repair attempt index");
        }
        if (this.repairAttemptsWithIncumbentBacktrack.has(repairAttemptIndex!)) {
          if (!watch.repairIncumbentAttemptLimitSuppressionRecorded) {
            watch.repairIncumbentAttemptLimitSuppressionRecorded = true;
            this.stats.repair_incumbent_attempt_limit_suppressed_watches++;
          }
          continue;
        }
      }

      const fromGapIndex = this.gapIndexOf(input.node);
      const targetGapIndex = this.gapIndexOf(watch.alternative);
      const gapRewind = Math.max(0, fromGapIndex - targetGapIndex);
      if (!readAlternativeAvailable()) {
        watch.used = true;
        this.stats.unavailable_alternatives++;
        continue;
      }
      if (input.executionCeilingReached) {
        this.stats.execution_ceiling_suppressed_crossings++;
        continue;
      }
      const admittedAlternativeDeadline = readAlternativeDeadline();
      if (admittedAlternativeDeadline.pressured) {
        if (!watch.deadlineSuppressionRecorded) {
          watch.deadlineSuppressionRecorded = true;
          this.stats.deadline_suppressed_crossings++;
        }
        continue;
      }
      const admissibleRewindChoices: SelectiveAdmissibleRewindChoice[] = [];
      let choiceLink = this.lineage.get(input.node) ?? null;
      while (choiceLink !== null) {
        const choiceWatch = choiceLink.watch;
        choiceLink = choiceLink.parent;
        if (choiceWatch.used) continue;
        const choiceContactAdvance = input.contactOrdinal - choiceWatch.branchContactOrdinal;
        if (choiceContactAdvance < SELECTIVE_AXIS_REGRET_MIN_CONTACT_ADVANCE) continue;
        const choiceAxisLossDelta = input.axisLoss - choiceWatch.baselineAxisLoss;
        const choiceTriggered = triggerSignal === "branch_regret"
          ? choiceAxisLossDelta >= SELECTIVE_AXIS_REGRET_MIN_LOSS_DELTA
          : repairIncumbentRegretTriggered;
        if (!choiceTriggered || !input.alternativeAvailable(choiceWatch.alternative)) continue;
        const choiceDeadline = input.alternativeDeadline(choiceWatch.alternative);
        if (choiceDeadline.pressured) continue;
        const choiceTargetGapIndex = this.gapIndexOf(choiceWatch.alternative);
        admissibleRewindChoices.push({
          branch_gap_index: choiceWatch.branchGapIndex,
          alternative_gap_index: choiceTargetGapIndex,
          contact_advance: choiceContactAdvance,
          gap_rewind: Math.max(0, fromGapIndex - choiceTargetGapIndex),
          axis_loss_delta: choiceAxisLossDelta,
          conservative_deadline_margin: choiceDeadline.margin,
        });
      }
      const selectedChoice = admissibleRewindChoices[0];
      if (
        selectedChoice === undefined ||
        selectedChoice.branch_gap_index !== watch.branchGapIndex ||
        selectedChoice.alternative_gap_index !== targetGapIndex
      ) {
        throw new Error("selective backtrack choice map lost the selected causal sibling");
      }
      flushValueCandidatesForProductionPriority();
      return recordDecision(
        watch,
        contactAdvance,
        axisLossDelta,
        triggerSignal,
        incumbentAxisLossDelta,
        repairAttemptIndex,
        admittedAlternativeDeadline,
        admissibleRewindChoices,
        null,
      );
    }

    if (
      (this.policy === "selective_axis_regret_catchup_value_initial" ||
        this.policy === "selective_axis_regret_catchup_value_initial_progress_10" ||
        this.policy === "selective_axis_regret_catchup_value_initial_expire_10") &&
      valueLiveCandidates.length > 0
    ) {
      valueLiveCandidates.sort((left, right) =>
        right.density - left.density ||
        right.axisLossDelta - left.axisLossDelta ||
        left.gapRewind - right.gapRewind ||
        left.lineageOrder - right.lineageOrder
      );
      for (let i = 0; i < valueLiveCandidates.length; i++) {
        const candidate = valueLiveCandidates[i]!;
        recordValueLiveOpportunity(
          candidate.watch,
          candidate.point,
          i === 0 ? "admitted" : "ranked_out",
          i + 1,
        );
      }
      const winner = valueLiveCandidates[0]!;
      const fromGapIndex = this.gapIndexOf(input.node);
      const targetGapIndex = this.gapIndexOf(winner.watch.alternative);
      return recordDecision(
        winner.watch,
        winner.contactAdvance,
        winner.axisLossDelta,
        "value_exploration",
        null,
        null,
        winner.deadline,
        [{
          branch_gap_index: winner.watch.branchGapIndex,
          alternative_gap_index: targetGapIndex,
          contact_advance: winner.contactAdvance,
          gap_rewind: Math.max(0, fromGapIndex - targetGapIndex),
          axis_loss_delta: winner.axisLossDelta,
          conservative_deadline_margin: winner.deadline.margin,
        }],
        winner.budget,
      );
    }

    if (periodicCandidate === null) return null;
    this.stats.periodic_exact_rewind_opportunities++;
    const { watch, contactAdvance, axisLossDelta } = periodicCandidate;
    const fromGapIndex = this.gapIndexOf(input.node);
    const targetGapIndex = this.gapIndexOf(watch.alternative);
    const recordPeriodicOpportunity = (
      outcome: SelectivePeriodicOpportunity["outcome"],
      deadlineMargin: number | null,
      budget: SelectiveExplorationBudgetAssessment | null,
    ): void => {
      this.stats.periodic_opportunities.push({
        lane: input.lane,
        contact_ordinal: input.contactOrdinal,
        from_gap_index: fromGapIndex,
        branch_gap_index: watch.branchGapIndex,
        alternative_gap_index: targetGapIndex,
        outcome,
        conservative_deadline_margin: deadlineMargin,
        budget,
      });
    };
    if (!input.alternativeAvailable(watch.alternative)) {
      watch.used = true;
      this.stats.periodic_alternative_unavailable++;
      recordPeriodicOpportunity("alternative_unavailable", null, null);
      return null;
    }
    if (input.executionCeilingReached) {
      this.stats.periodic_execution_ceiling_suppressed++;
      recordPeriodicOpportunity("execution_ceiling", null, null);
      return null;
    }
    const admittedAlternativeDeadline = input.alternativeDeadline(watch.alternative);
    if (input.explorationBudgetAssessment === undefined) {
      throw new Error("periodic selective backtracking requires a budget assessment");
    }
    const periodicBudget = input.explorationBudgetAssessment(
      watch.alternative,
      fromGapIndex,
      this.stats.periodic_probe_frames,
    );
    if (!periodicBudget.admitted) {
      if (periodicBudget.reason === "terminal_reserve") {
        this.stats.periodic_terminal_reserve_suppressed++;
      } else {
        this.stats.periodic_exploration_allowance_suppressed++;
      }
      recordPeriodicOpportunity(
        periodicBudget.reason,
        admittedAlternativeDeadline.margin,
        periodicBudget,
      );
      return null;
    }
    this.stats.periodic_admitted++;
    recordPeriodicOpportunity("admitted", admittedAlternativeDeadline.margin, periodicBudget);
    const repairAttemptIndex = input.lane === "repair"
      ? input.repairAttemptIndex ?? null
      : null;
    return recordDecision(
      watch,
      contactAdvance,
      axisLossDelta,
      "periodic_exploration",
      input.lane === "repair" && input.incumbentAxisLoss !== null &&
          input.incumbentAxisLoss !== undefined && Number.isFinite(input.incumbentAxisLoss)
        ? input.axisLoss - input.incumbentAxisLoss
        : null,
      repairAttemptIndex,
      admittedAlternativeDeadline,
      [{
        branch_gap_index: watch.branchGapIndex,
        alternative_gap_index: targetGapIndex,
        contact_advance: contactAdvance,
        gap_rewind: Math.max(0, fromGapIndex - targetGapIndex),
        axis_loss_delta: axisLossDelta,
        conservative_deadline_margin: admittedAlternativeDeadline.margin,
      }],
      periodicBudget,
    );
  }

  markSuspended(node: Node): void {
    if (!this.suspended.has(node)) {
      throw new Error("selective backtrack suspended a node without a causal event");
    }
  }

  /** Record a pure, like-for-like observation while the alternative catches
   * up. This does not decide or mutate traversal. It lets offline studies ask
   * which bounded stopping rules would have saved work before we put any such
   * rule into the compiler. */
  recordCatchupCheckpoint(
    decision: SelectiveBacktrackDecision<Node>,
    routeOrdinal: number,
    routeKind: SelectiveCatchupProbeResult["route_kind"],
    alternativeOrdinal: number,
    checkpoint: Omit<
      SelectiveCatchupCheckpoint,
      "route_ordinal" | "route_kind" | "alternative_ordinal"
    >,
  ): void {
    const event = this.stats.events[decision.eventIndex];
    if (event === undefined || event.catchup_outcome !== null) {
      throw new Error("selective catch-up checkpoint has no live causal event");
    }
    const previous = event.catchup_checkpoints.filter(
      (candidate) => candidate.route_ordinal === routeOrdinal,
    ).at(-1);
    if (
      checkpoint.gap_index <= (previous?.gap_index ?? decision.branchGapIndex) ||
      checkpoint.gap_index > decision.fromGapIndex ||
      checkpoint.probe_nodes_processed < (previous?.probe_nodes_processed ?? 0) ||
      checkpoint.probe_frames < (previous?.probe_frames ?? 0)
    ) {
      throw new Error("selective catch-up checkpoints must advance monotonically to the target");
    }
    event.catchup_checkpoints.push({
      ...checkpoint,
      route_ordinal: routeOrdinal,
      route_kind: routeKind,
      alternative_ordinal: alternativeOrdinal,
    });
  }

  finishCatchup(
    decision: SelectiveBacktrackDecision<Node>,
    input: {
      outcome: SelectiveCatchupOutcome;
      selectedAlternativeOrdinal: number | null;
      selectedRouteOrdinal: number | null;
      probes: readonly SelectiveCatchupProbeResult[];
      catchupAxisLoss: number | null;
    },
  ): void {
    const event = this.stats.events[decision.eventIndex];
    if (event === undefined || event.catchup_outcome !== null) {
      throw new Error("selective catch-up completion has no live causal event");
    }
    if (input.probes.length === 0) {
      throw new Error("selective catch-up completion has no probe result");
    }
    const probeNodesProcessed = input.probes.reduce(
      (sum, probe) => sum + probe.probe_nodes_processed,
      0,
    );
    const probeFrames = input.probes.reduce((sum, probe) => sum + probe.probe_frames, 0);
    event.catchup_outcome = input.outcome;
    event.catchup_end_gap_index = Math.max(...input.probes.map((probe) => probe.end_gap_index));
    event.catchup_probe_nodes_processed = probeNodesProcessed;
    event.catchup_probe_frames = probeFrames;
    event.catchup_axis_loss = input.catchupAxisLoss;
    event.catchup_axis_loss_gain = input.catchupAxisLoss === null
      ? null
      : decision.triggerAxisLoss - input.catchupAxisLoss;
    event.catchup_selected_alternative_ordinal = input.selectedAlternativeOrdinal;
    event.catchup_selected_route_ordinal = input.selectedRouteOrdinal;
    event.catchup_probe_results = input.probes.map((probe) => ({
      ...probe,
      local_fallback_choices: probe.local_fallback_choices.map((choice) => ({ ...choice })),
    }));
    this.stats.catchup_probe_nodes_processed += probeNodesProcessed;
    this.stats.catchup_probe_frames += probeFrames;
    if (decision.triggerSignal === "periodic_exploration") {
      this.stats.periodic_probe_nodes_processed += probeNodesProcessed;
      this.stats.periodic_probe_frames += probeFrames;
    } else if (decision.triggerSignal === "value_exploration") {
      this.stats.value_live_probe_nodes_processed += probeNodesProcessed;
      this.stats.value_live_probe_frames += probeFrames;
    }
    this.stats.catchup_probe_attempts += input.probes.length;
    this.stats.catchup_probe_target_reaches += input.probes.filter(
      (probe) => probe.outcome === "reached_target",
    ).length;
    for (const probe of input.probes) {
      const choiceCount = probe.local_fallback_choices.length;
      const positiveChoiceCount = probe.local_fallback_choices.filter(
        (choice) => choice.current_relative_axis_loss_gain > 0,
      ).length;
      this.stats.catchup_local_fallback_choice_count_sum += choiceCount;
      this.stats.catchup_positive_local_fallback_choice_count_sum += positiveChoiceCount;
      this.stats.catchup_local_fallback_choice_count_max = Math.max(
        this.stats.catchup_local_fallback_choice_count_max,
        choiceCount,
      );
      if (choiceCount > 0) this.stats.catchup_probes_with_local_fallback_choice++;
      if (positiveChoiceCount > 0) {
        this.stats.catchup_probes_with_positive_local_fallback_choice++;
      }
    }
    this.stats.catchup_additional_probe_attempts += input.probes.filter(
      (probe) => probe.route_kind === "causal_alternative" && probe.alternative_ordinal > 1,
    ).length;
    this.stats.catchup_additional_probe_target_reaches += input.probes.filter(
      (probe) =>
        probe.route_kind === "causal_alternative" &&
        probe.alternative_ordinal > 1 &&
        probe.outcome === "reached_target",
    ).length;
    if (input.probes.length > 1) this.stats.catchup_tournaments_with_additional_probe++;
    if ((input.selectedAlternativeOrdinal ?? 0) > 1) {
      this.stats.catchup_additional_alternative_selected++;
    }
    this.stats.catchup_probe_dead_ends += input.probes.filter(
      (probe) => probe.outcome === "probe_dead_end",
    ).length;
    this.stats.catchup_probe_deferred += input.probes.filter(
      (probe) => probe.outcome === "probe_deferred",
    ).length;
    const budgetYields = input.probes.filter(
      (probe) => probe.outcome === "probe_budget_yield",
    ).length;
    this.stats.catchup_probe_budget_yields += budgetYields;
    if (decision.triggerSignal === "value_exploration") {
      this.stats.value_live_probe_budget_yields += budgetYields;
    }
    this.stats.catchup_execution_ceiling_stops += input.probes.filter(
      (probe) => probe.outcome === "execution_ceiling",
    ).length;
    if (input.outcome === "alternative_selected") {
      this.stats.catchup_completed++;
      this.stats.catchup_alternative_selected++;
    } else if (input.outcome === "current_selected") {
      this.stats.catchup_completed++;
      this.stats.catchup_current_selected++;
    }
  }

  observeSelected(node: Node, totalSpentFrames: number): boolean {
    const eventIndex = this.suspended.get(node);
    if (eventIndex === undefined) return false;
    this.suspended.delete(node);
    this.stats.events[eventIndex]!.resumed_total_spent_frames = totalSpentFrames;
    this.stats.suspended_continuations_resumed++;
    return true;
  }

  snapshot(): SelectiveBacktrackingStats {
    return {
      ...this.stats,
      branch_watches_by_alternative_count: {
        ...this.stats.branch_watches_by_alternative_count,
      },
      selective_backtracks_by_lane: { ...this.stats.selective_backtracks_by_lane },
      regret_opportunities_by_min_axis_loss_delta: Object.fromEntries(
        Object.entries(this.stats.regret_opportunities_by_min_axis_loss_delta).map(
          ([threshold, counts]) => [threshold, { ...counts }],
        ),
      ),
      repair_incumbent_regret_opportunities_by_min_axis_loss_delta: Object.fromEntries(
        Object.entries(
          this.stats.repair_incumbent_regret_opportunities_by_min_axis_loss_delta,
        ).map(([threshold, counts]) => [threshold, { ...counts }]),
      ),
      repair_incumbent_regret_opportunities_by_min_contact_advance: Object.fromEntries(
        Object.entries(
          this.stats.repair_incumbent_regret_opportunities_by_min_contact_advance,
        ).map(([advance, counts]) => [advance, { ...counts }]),
      ),
      periodic_opportunities: this.stats.periodic_opportunities.map((opportunity) => ({
        ...opportunity,
        budget: opportunity.budget === null ? null : { ...opportunity.budget },
      })),
      value_density_thresholds: [...this.stats.value_density_thresholds],
      value_opportunities_by_density: Object.fromEntries(
        Object.entries(this.stats.value_opportunities_by_density).map(
          ([threshold, counts]) => [threshold, { ...counts }],
        ),
      ),
      value_opportunities: this.stats.value_opportunities.map((opportunity) => ({
        ...opportunity,
        crossing: {
          ...opportunity.crossing,
          budget: { ...opportunity.crossing.budget },
        },
        first_admission: opportunity.first_admission === null
          ? null
          : {
            ...opportunity.first_admission,
            budget: { ...opportunity.first_admission.budget },
          },
      })),
      value_live_opportunities: this.stats.value_live_opportunities.map((opportunity) => ({
        ...opportunity,
        point: {
          ...opportunity.point,
          budget: { ...opportunity.point.budget },
        },
      })),
      deferred_value_opportunities: this.stats.deferred_value_opportunities.map(
        (opportunity) => ({
          ...opportunity,
          crossing: {
            ...opportunity.crossing,
            budget: { ...opportunity.crossing.budget },
          },
          terminal: opportunity.terminal === null ? null : { ...opportunity.terminal },
        }),
      ),
      events: this.stats.events.map((event) => ({
        ...event,
        periodic_budget: event.periodic_budget === null
          ? null
          : { ...event.periodic_budget },
        value_budget: event.value_budget === null
          ? null
          : { ...event.value_budget },
        admissible_rewind_choices: event.admissible_rewind_choices.map((choice) => ({
          ...choice,
        })),
        catchup_probe_results: event.catchup_probe_results.map((probe) => ({
          ...probe,
          atomic_node_frames: [...probe.atomic_node_frames],
          local_fallback_choices: probe.local_fallback_choices.map((choice) => ({ ...choice })),
        })),
        catchup_checkpoints: event.catchup_checkpoints.map((checkpoint) => ({ ...checkpoint })),
      })),
    };
  }
}
