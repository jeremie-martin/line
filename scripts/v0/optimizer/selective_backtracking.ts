export type SelectiveCatchupPolicy =
  | "selective_axis_regret_catchup"
  | "selective_axis_regret_catchup_repair_incumbent_once"
  | "selective_axis_regret_catchup_nested_discrepancy";

export type SelectiveBacktrackSignal = "branch_regret" | "repair_incumbent_regret";

export type FrontierTraversalPolicy = "depth_first" | SelectiveCatchupPolicy;

export type FrontierTraversalLane = "initial" | "snapshot" | "repair" | "resumed";

export const SELECTIVE_AXIS_REGRET_MIN_CONTACT_ADVANCE = 2;
export const SELECTIVE_AXIS_REGRET_MIN_LOSS_DELTA = 0.20;
export const SELECTIVE_REPAIR_INCUMBENT_MIN_LOSS_DELTA = 0.02;
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
  if (raw === "selective-axis-regret-catchup-nested-discrepancy") {
    return "selective_axis_regret_catchup_nested_discrepancy";
  }
  if (raw === "0" || raw === "off" || raw === "dfs") return "depth_first";
  throw new Error(
    `LR_FRONTIER_POLICY must be dfs, selective-axis-regret-catchup, ` +
      `selective-axis-regret-catchup-repair-incumbent-once, or ` +
      `selective-axis-regret-catchup-nested-discrepancy; got ${raw}`,
  );
}

export function catchupAlternativeHasSufficientGain(
  currentAxisLoss: number,
  alternativeAxisLoss: number,
): boolean {
  return currentAxisLoss > alternativeAxisLoss;
}

type AxisRegretWatch<Node extends object> = {
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
};

type WatchLink<Node extends object> = {
  watch: AxisRegretWatch<Node>;
  parent: WatchLink<Node> | null;
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
  | "execution_ceiling";

export type SelectiveCatchupProbeOutcome =
  | "reached_target"
  | "probe_dead_end"
  | "probe_deferred"
  | "execution_ceiling";

export type SelectiveCatchupProbeResult = {
  route_ordinal: number;
  route_kind: "causal_alternative" | "local_discrepancy";
  discrepancy_depth: 0 | 1 | 2;
  parent_route_ordinal: number | null;
  parent_local_fallback_choice_ordinal: number | null;
  alternative_ordinal: number;
  outcome: SelectiveCatchupProbeOutcome;
  end_gap_index: number;
  probe_nodes_processed: number;
  probe_frames: number;
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
  catchup_execution_ceiling_stops: number;
  catchup_probe_attempts: number;
  catchup_probe_target_reaches: number;
  catchup_probes_with_local_fallback_choice: number;
  catchup_probes_with_positive_local_fallback_choice: number;
  catchup_local_fallback_choice_count_sum: number;
  catchup_positive_local_fallback_choice_count_sum: number;
  catchup_local_fallback_choice_count_max: number;
  catchup_local_discrepancy_probe_attempts: number;
  catchup_local_discrepancy_probe_target_reaches: number;
  catchup_local_discrepancy_selected: number;
  catchup_nested_discrepancy_probe_attempts: number;
  catchup_nested_discrepancy_probe_target_reaches: number;
  catchup_nested_discrepancy_selected: number;
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
  return { branch_regret: 0, repair_incumbent_regret: 0 };
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
  private readonly stats: SelectiveBacktrackingStats;

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
      catchup_execution_ceiling_stops: 0,
      catchup_probe_attempts: 0,
      catchup_probe_target_reaches: 0,
      catchup_probes_with_local_fallback_choice: 0,
      catchup_probes_with_positive_local_fallback_choice: 0,
      catchup_local_fallback_choice_count_sum: 0,
      catchup_positive_local_fallback_choice_count_sum: 0,
      catchup_local_fallback_choice_count_max: 0,
      catchup_local_discrepancy_probe_attempts: 0,
      catchup_local_discrepancy_probe_target_reaches: 0,
      catchup_local_discrepancy_selected: 0,
      catchup_nested_discrepancy_probe_attempts: 0,
      catchup_nested_discrepancy_probe_target_reaches: 0,
      catchup_nested_discrepancy_selected: 0,
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
    axisLoss: number;
    incumbentAxisLoss?: number | null;
    repairAttemptIndex?: number | null;
    executionCeilingReached: boolean;
    totalSpentFrames: number;
    lane: FrontierTraversalLane;
    alternativeAvailable: (node: Node) => boolean;
    alternativeDeadline: (node: Node) => { margin: number; pressured: boolean };
  }): SelectiveBacktrackDecision<Node> | null {
    let link = this.lineage.get(input.node) ?? null;
    while (link !== null) {
      const watch = link.watch;
      link = link.parent;
      if (watch.used) continue;

      const contactAdvance = input.contactOrdinal - watch.branchContactOrdinal;
      if (contactAdvance < SELECTIVE_AXIS_REGRET_MIN_CONTACT_ADVANCE) continue;
      this.stats.mature_watch_checks++;
      const axisLossDelta = input.axisLoss - watch.baselineAxisLoss;
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
      };
    }
    return null;
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
    this.stats.catchup_local_discrepancy_probe_attempts += input.probes.filter(
      (probe) => probe.route_kind === "local_discrepancy",
    ).length;
    this.stats.catchup_local_discrepancy_probe_target_reaches += input.probes.filter(
      (probe) =>
        probe.route_kind === "local_discrepancy" && probe.outcome === "reached_target",
    ).length;
    this.stats.catchup_nested_discrepancy_probe_attempts += input.probes.filter(
      (probe) => probe.discrepancy_depth === 2,
    ).length;
    this.stats.catchup_nested_discrepancy_probe_target_reaches += input.probes.filter(
      (probe) => probe.discrepancy_depth === 2 && probe.outcome === "reached_target",
    ).length;
    if (
      input.selectedRouteOrdinal !== null &&
      input.probes.find((probe) => probe.route_ordinal === input.selectedRouteOrdinal)
        ?.route_kind === "local_discrepancy"
    ) {
      this.stats.catchup_local_discrepancy_selected++;
      if (
        input.probes.find((probe) => probe.route_ordinal === input.selectedRouteOrdinal)
          ?.discrepancy_depth === 2
      ) {
        this.stats.catchup_nested_discrepancy_selected++;
      }
    }
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
      events: this.stats.events.map((event) => ({
        ...event,
        admissible_rewind_choices: event.admissible_rewind_choices.map((choice) => ({
          ...choice,
        })),
        catchup_probe_results: event.catchup_probe_results.map((probe) => ({
          ...probe,
          local_fallback_choices: probe.local_fallback_choices.map((choice) => ({ ...choice })),
        })),
        catchup_checkpoints: event.catchup_checkpoints.map((checkpoint) => ({ ...checkpoint })),
      })),
    };
  }
}
