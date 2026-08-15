/**
 * Observation-only compile-budget telemetry.
 *
 * This module deliberately owns no optimizer decisions. It reads charged work
 * and structural progress after they happen, then emits a versioned account of
 * the compile. Keeping the recorder separate makes it possible to prove that
 * enabling or disabling it does not change search order, RNG, or physics work.
 */

import { createHash } from "node:crypto";
import type { Gap } from "../types.ts";
import { AXIS_QUALITY_TOLERANCE } from "../score.ts";
import type { TraversalBudgetModel } from "./budget_model.ts";
import {
  BUDGET_ESTIMATOR_MODEL,
  BUDGET_ESTIMATOR_MODEL_FINGERPRINT,
  BUDGET_ESTIMATOR_TRAVERSAL_MODEL,
  budgetEstimateInterval,
  budgetEstimatorApplicability,
  budgetEstimatorStructuralScale,
  estimateRemainingBudgetWork,
  remainingStructure,
  structuralRemainingWork,
  type BudgetEstimatorApplicability,
  type RemainingStructure,
} from "./budget_estimator.ts";

/**
 * Clean-break search-accounting schema.
 *
 * V10 keeps the global incumbent, temporary working track, and terminal offer
 * as separate causal states. A rejected local improvement can therefore seed
 * one follow-up without being mislabeled as accepted or as the output
 * incumbent. It also records the exact follow-up disposition and the
 * replayable optimistic axis-quality bound used by selective bridge policy.
 * It also gives post-terminal deferred-value suffix work its own causal lane,
 * rather than mislabeling it as initial, resumed, or repair work. Historical
 * V4–V9 archives remain immutable evidence; current readers fail
 * closed.
 */
export const BUDGET_TELEMETRY_SCHEMA = "line.compile-budget-telemetry.v10" as const;

export type BudgetTelemetryLevel = "off" | "summary" | "trace";
export type BudgetEpisodeLane =
  | "initial"
  | "snapshot"
  | "deferred_value"
  | "repair"
  | "resumed";
export const BUDGET_EVALUATION_ORIGINS = [
  "frontier",
  "tail_completion",
  "polish",
] as const;
export type BudgetEvaluationOrigin = (typeof BUDGET_EVALUATION_ORIGINS)[number];
export type BudgetEvaluationOriginWork = {
  register_offers: number;
  terminal_node_evaluations: number;
  register_improvements: number;
  terminal_register_improvements: number;
};
/**
 * How `ceiling_total_spent_frames` was sized. This makes the repair tautology
 * visible in data: a `measured_cost_to_end` ceiling is the estimator's own
 * upper interval bound over the same costToEnd profile the estimator uses as
 * its path base, so a path-backed repair's `episode_completion_margin` at its
 * own start is exactly the artifact's `start`/`withPath` upper ratio — the
 * sizing rule read back, not evidence about the estimator.
 */
export type BudgetCeilingSource =
  /** Compile hard budget: the initial and resumed frontiers may run to capture. */
  | "hard_budget"
  /** Upper interval bound over a measured terminal-path cost-to-end at the anchor. */
  | "measured_cost_to_end"
  /** No positive measured cost at the anchor; the coarse per-gap average was used instead. */
  | "per_gap_fallback"
  /** Fixed score-blind share of policy budget reserved for one deferred-value suffix. */
  | "deferred_value_allowance"
  /** The sized ceiling reached or exceeded the repair budget and was clipped to it. */
  | "repair_budget_remaining";
export type BudgetSegmentKind =
  | "startup"
  | "initial_search"
  | "deferred_value_suffix"
  | "repair_frontier"
  | "resumed_search"
  | "finalization"
  | "unattributed";
export type BudgetEpisodeStopReason =
  | "handoff_to_repair"
  | "budget_capture"
  | "local_ceiling"
  | "frontier_exhausted"
  | "first_completion_stop"
  | "first_terminal_return"
  | "compile_finished";

// `RemainingStructure` and its two producers moved to `budget_estimator.ts`:
// they are the estimator's structural input, and `deadline.ts` (pure policy)
// must compute them, which this observation-only module has no business owning.
// Re-exported here because they name fields of the payload types below.
export type { RemainingStructure };

export type BudgetEstimateObservation = {
  /** Why this estimate was captured; see docs/compile-budget-telemetry.md. */
  event: "start" | "high_water" | "spend" | "terminal" | "end";
  /** Compile-global charged simulation work at this observation. */
  total_spent_frames: number;
  hard_remaining_frames: number;
  hard_overrun_frames: number;
  /** Charged work since this episode's start. */
  episode_spent_frames: number;
  /** Work below this episode's compile-global ceiling, clamped at zero. */
  episode_remaining_frames: number;
  episode_overrun_frames: number;
  high_water: RemainingStructure;
  /** True only while the initial one-time structural intercept is still due. */
  structural_startup_included: boolean;
  estimator_applicability: BudgetEstimatorApplicability;
  /** clamp((anchor structural work - current structural work) / anchor work, 0, 1). */
  structural_progress_fraction: number;
  /**
   * Structure-only remaining-work estimate at high_water, already multiplied by
   * the artifact's budget-law scalar for this compile's policy budget.
   */
  structural_work_prior_frames: number;
  /** Original incumbent's measured cost-to-end suffix; repair-only when known. */
  incumbent_path_work_estimate_frames: number | null;
  /** Attempt spend per structural work progressed, projected over the remaining suffix. */
  episode_pace_work_estimate_frames: number | null;
  /** Frozen model's selected and corrected remaining-work point estimate. */
  estimated_remaining_work_frames: number;
  estimate_lower_frames: number;
  estimate_upper_frames: number;
  /** Half the empirical interval width; not a standard deviation. */
  estimate_uncertainty_frames: number;
  /** hard remaining / point estimate; null when the estimate is uncalibrated. */
  hard_completion_margin: number | null;
  hard_completion_surplus_frames: number;
  /** Episode remaining / point estimate; null when the estimate is uncalibrated. */
  episode_completion_margin: number | null;
  episode_completion_surplus_frames: number;
};

export type BudgetRepairGapState = {
  status: "measured";
  gap_index: number;
  sse: number;
  axes: Record<string, {
    target: number;
    achieved: number;
    signed_error: number;
    squared_error: number;
  }>;
} | {
  /** The terminal track did not carry the selected target's ending contact. */
  status: "missing";
  gap_index: number;
};

/** Register key domain used by the optimizer. This is never Benchmark V2 score. */
export type BudgetInternalRegisterKey = {
  contract_passed: boolean;
  axis_quality: number;
  internal_full_score: number;
  drift_quality: number | null;
};

/**
 * Exact work funnel for one execution episode.
 *
 * Requested proposals, actual samples, frontier branching, node identity, and
 * track geometry are intentionally separate populations.
 */
export type BudgetEpisodeWork = {
  /** Calls that request and rank a normal proposal pool. */
  ranked_option_calls: number;
  /** Sum of requested normal proposals across those calls; divide, do not call this lane width. */
  requested_normal_proposals: number;
  actual_candidate_samples: number;
  viable_candidates: number;
  /** Exact geometry evaluations by compiler-owned sampling stream. Lane is the containing episode. */
  candidate_samples_by_stream: Record<string, number>;
  by_evaluation_origin: Record<BudgetEvaluationOrigin, BudgetEvaluationOriginWork>;
  nodes_processed: number;
  nodes_expanded: number;
  children_enqueued: number;
  register_offers: number;
  partial_node_evaluations: number;
  terminal_node_evaluations: number;
  first_time_terminal_node_evaluations: number;
  revisited_terminal_node_evaluations: number;
  distinct_terminal_tracks: number;
  repeated_terminal_track_evaluations: number;
  register_improvements: number;
  terminal_register_improvements: number;
};

export type BudgetRepairDecision = {
  iteration_index: number;
  incumbent_revision: number;
  /** SHA-256 of JSON.stringify(incumbent.track) at this iteration's start. */
  incumbent_track_hash: string;
  /** The track from which target selection and suffix reconstruction begin. */
  working_track_source: "global_incumbent" | "rejected_local_improvement";
  /** SHA-256 of JSON.stringify(workingTrack.track) at this iteration's start. */
  working_track_hash: string;
  remaining_budget_frames: number;
  headroom_fraction: number;
  usable_budget_frames: number;
  selection_policy:
    | "worst_gap_deepest_affordable"
    | "worst_gap_three_quarter_last_chance"
    | "worst_gap_repeated_rejection_step_later"
    | "worst_gap_window_opportunity_per_cost"
    | "worst_gap_runway_opportunity_per_cost"
    | "worst_gap_reserve_cheapest_repair"
    | "worst_gap_reserve_cheapest_else_deepest"
    | "suffix_opportunity_per_cost"
    | "max_suffix_opportunity"
    | "max_local_window_opportunity";
  parent_depth: number;
  affordable_target_gap_indices: number[];
  affordable_anchor_gap_indices: number[];
  target_gap_index: number;
  target_gap_sse: number;
  anchor_gap_index: number;
  /** Sum of incumbent target-gap SSE at and after the selected anchor. */
  mutable_suffix_sse: number;
  estimated_anchor_cost_frames: number;
  estimated_anchor_cost_upper_frames: number;
  anchor_cost_source: "measured_cost_to_end" | "per_gap_fallback";
  /** Exact inputs needed to replay affordability and worst-eligible ranking. */
  considered_targets: BudgetRepairTargetObservation[];
};

export type BudgetRepairTargetObservation = {
  target_gap_index: number;
  target_gap_sse: number;
  anchor_options: BudgetRepairAnchorObservation[];
};

export type BudgetRepairAnchorObservation = {
  parent_depth: number;
  anchor_gap_index: number;
  estimated_anchor_cost_frames: number | null;
  estimated_anchor_cost_upper_frames: number | null;
  anchor_cost_source: "measured_cost_to_end" | "per_gap_fallback" | null;
  affordability:
    | "affordable"
    | "anchor_before_start"
    | "no_positive_cost_estimate"
    | "exceeds_usable_budget";
};

export type ReplayedBudgetRepairSelection = {
  affordableTargetGapIndices: number[];
  affordableAnchorGapIndices: number[];
  targetGapIndex: number;
  targetGapSse: number;
  anchorGapIndex: number;
  parentDepth: number;
  mutableSuffixSse: number;
  estimatedAnchorCostFrames: number;
  estimatedAnchorCostUpperFrames: number;
  anchorCostSource: "measured_cost_to_end" | "per_gap_fallback";
};

/** Replay a V5 repair selection solely from its recorded decision inputs.
 * This is shared by validation and downstream audits so a report cannot quietly
 * reinterpret a categorical controller arm. Structural field validation stays
 * in `validateTelemetryPayload`; malformed observations fail here as absent. */
export function replayBudgetRepairSelection(
  decision: BudgetRepairDecision,
): ReplayedBudgetRepairSelection {
  const affordableTargets = decision.considered_targets.filter((candidate) =>
    candidate.anchor_options.some((anchor) => anchor.affordability === "affordable")
  );
  const affordableAnchors = new Map<number, BudgetRepairAnchorObservation>();
  for (const candidate of affordableTargets) {
    for (const anchor of candidate.anchor_options) {
      if (anchor.affordability === "affordable") {
        affordableAnchors.set(anchor.anchor_gap_index, anchor);
      }
    }
  }
  const affordableTargetGapIndices = affordableTargets
    .map((candidate) => candidate.target_gap_index)
    .sort((a, b) => a - b);
  const affordableAnchorGapIndices = [...affordableAnchors.keys()].sort((a, b) => a - b);
  const suffixChoice = (anchorGapIndex: number) => {
    const suffix = decision.considered_targets.filter((candidate) =>
      candidate.target_gap_index >= anchorGapIndex
    );
    const target = [...suffix].sort((a, b) =>
      b.target_gap_sse - a.target_gap_sse || a.target_gap_index - b.target_gap_index
    )[0];
    const anchor = affordableAnchors.get(anchorGapIndex);
    if (target === undefined || anchor === undefined) {
      throw new Error(`repair selection has no replayable suffix choice`);
    }
    return {
      anchor,
      anchorGapIndex,
      mutableSuffixSse: suffix.reduce((sum, candidate) => sum + candidate.target_gap_sse, 0),
      target,
    };
  };
  const localWindowChoice = () => {
    const choices = affordableTargets.flatMap((target) =>
      target.anchor_options.filter((anchor) => anchor.affordability === "affordable")
        .map((anchor) => ({
          target,
          anchor,
          anchorGapIndex: anchor.anchor_gap_index,
          mutableSuffixSse: decision.considered_targets.filter((candidate) =>
            candidate.target_gap_index >= anchor.anchor_gap_index
          ).reduce((sum, candidate) => sum + candidate.target_gap_sse, 0),
          windowSse: decision.considered_targets.filter((candidate) =>
            candidate.target_gap_index >= anchor.anchor_gap_index &&
            candidate.target_gap_index <= target.target_gap_index
          ).reduce((sum, candidate) => sum + candidate.target_gap_sse, 0),
        }))
    ).sort((a, b) =>
      b.windowSse - a.windowSse ||
      b.target.target_gap_sse - a.target.target_gap_sse ||
      b.anchor.parent_depth - a.anchor.parent_depth ||
      a.target.target_gap_index - b.target.target_gap_index
    )[0];
    if (choices === undefined) throw new Error(`repair selection has no replayable local window`);
    return choices;
  };
  const worstGapChoice = (
    reserveMode: "none" | "latest_final" | "deepest_final",
  ) => {
    const target = [...affordableTargets].sort((a, b) =>
      b.target_gap_sse - a.target_gap_sse || a.target_gap_index - b.target_gap_index
    )[0];
    const targetAnchors = target?.anchor_options.filter((option) =>
      option.affordability === "affordable"
    ) ?? [];
    const deepest = [...targetAnchors].sort((a, b) => b.parent_depth - a.parent_depth)[0];
    if (target === undefined || deepest === undefined) {
      throw new Error(`repair selection has no replayable worst-gap choice`);
    }
    if (reserveMode === "none") {
      return { ...suffixChoice(deepest.anchor_gap_index), target, anchor: deepest };
    }
    const reserveUpper = Math.min(...[...affordableAnchors.values()].map((anchor) =>
      anchor.estimated_anchor_cost_upper_frames!
    ));
    const reserved = targetAnchors.filter((anchor) =>
      anchor.estimated_anchor_cost_upper_frames! + reserveUpper <=
        decision.usable_budget_frames
    ).sort((a, b) => b.parent_depth - a.parent_depth)[0];
    const finalRepair = [...targetAnchors].sort((a, b) =>
      reserveMode === "deepest_final"
        ? b.parent_depth - a.parent_depth
        : a.parent_depth - b.parent_depth
    )[0]!;
    const anchor = reserved ?? finalRepair;
    return { ...suffixChoice(anchor.anchor_gap_index), target, anchor };
  };
  const worstGapOpportunityChoice = (includeRunway: boolean) => {
    const target = [...affordableTargets].sort((a, b) =>
      b.target_gap_sse - a.target_gap_sse || a.target_gap_index - b.target_gap_index
    )[0];
    if (target === undefined) {
      throw new Error(`repair selection has no replayable worst-gap choice`);
    }
    const choices = target.anchor_options.filter((anchor) =>
      anchor.affordability === "affordable"
    ).map((anchor) => {
      const windowSse = decision.considered_targets.filter((candidate) =>
        candidate.target_gap_index >= anchor.anchor_gap_index &&
        candidate.target_gap_index <= target.target_gap_index
      ).reduce((sum, candidate) => sum + candidate.target_gap_sse, 0);
      return {
        anchor,
        opportunity: includeRunway
          ? windowSse + anchor.parent_depth * target.target_gap_sse
          : windowSse,
      };
    }).sort((a, b) =>
      b.opportunity / b.anchor.estimated_anchor_cost_frames! -
        a.opportunity / a.anchor.estimated_anchor_cost_frames! ||
      b.opportunity - a.opportunity ||
      b.anchor.parent_depth - a.anchor.parent_depth
    );
    const selected = choices[0];
    if (selected === undefined) {
      throw new Error(`repair selection has no replayable runway choice`);
    }
    return {
      ...suffixChoice(selected.anchor.anchor_gap_index),
      target,
      anchor: selected.anchor,
    };
  };
  const repeatedRejectionStepLaterChoice = () => {
    const ordinary = worstGapChoice("none");
    const anchor = ordinary.target.anchor_options.find((option) =>
      option.affordability === "affordable" &&
      option.anchor_gap_index === ordinary.anchorGapIndex + 1
    );
    if (anchor === undefined) {
      throw new Error(`repair repeated-rejection selection has no replayable later anchor`);
    }
    return {
      ...suffixChoice(anchor.anchor_gap_index),
      target: ordinary.target,
      anchor,
    };
  };
  const choice = decision.selection_policy === "worst_gap_deepest_affordable" ||
      decision.selection_policy === "worst_gap_three_quarter_last_chance"
    ? worstGapChoice("none")
    : decision.selection_policy === "worst_gap_repeated_rejection_step_later"
      ? repeatedRejectionStepLaterChoice()
    : decision.selection_policy === "worst_gap_window_opportunity_per_cost"
      ? worstGapOpportunityChoice(false)
      : decision.selection_policy === "worst_gap_runway_opportunity_per_cost"
        ? worstGapOpportunityChoice(true)
      : decision.selection_policy === "worst_gap_reserve_cheapest_repair"
        ? worstGapChoice("latest_final")
        : decision.selection_policy === "worst_gap_reserve_cheapest_else_deepest"
          ? worstGapChoice("deepest_final")
          : decision.selection_policy === "suffix_opportunity_per_cost"
            ? affordableAnchorGapIndices.map(suffixChoice).sort((a, b) =>
              b.mutableSuffixSse / b.anchor.estimated_anchor_cost_frames! -
                a.mutableSuffixSse / a.anchor.estimated_anchor_cost_frames! ||
              b.mutableSuffixSse - a.mutableSuffixSse ||
              b.anchorGapIndex - a.anchorGapIndex
            )[0]
            : decision.selection_policy === "max_suffix_opportunity"
              ? affordableAnchorGapIndices.map(suffixChoice).sort((a, b) =>
                b.mutableSuffixSse - a.mutableSuffixSse || a.anchorGapIndex - b.anchorGapIndex
              )[0]
              : localWindowChoice();
  if (
    choice === undefined ||
    choice.anchor.estimated_anchor_cost_frames === null ||
    choice.anchor.estimated_anchor_cost_upper_frames === null ||
    choice.anchor.anchor_cost_source === null
  ) {
    throw new Error(`repair selection has no replayable affordable choice`);
  }
  return {
    affordableTargetGapIndices,
    affordableAnchorGapIndices,
    targetGapIndex: choice.target.target_gap_index,
    targetGapSse: choice.target.target_gap_sse,
    anchorGapIndex: choice.anchorGapIndex,
    parentDepth: choice.target.target_gap_index - choice.anchorGapIndex,
    mutableSuffixSse: choice.mutableSuffixSse,
    estimatedAnchorCostFrames: choice.anchor.estimated_anchor_cost_frames,
    estimatedAnchorCostUpperFrames: choice.anchor.estimated_anchor_cost_upper_frames,
    anchorCostSource: choice.anchor.anchor_cost_source,
  };
}

export type BudgetRepairDivergence = {
  compared_gap_count: number;
  first_divergent_gap_index: number | null;
  divergent_gap_count: number;
  divergent_suffix_gap_count: number;
  terminal_geometry_identical: boolean;
};

export type BudgetRejectedLocalBridgeAssessment = {
  policy: "optimistic_axis_quality_bound";
  incumbent_contract_passed: boolean;
  terminal_offer_contract_passed: boolean;
  incumbent_axis_quality: number;
  terminal_offer_axis_quality: number;
  scored_axis_observation_count: number;
  total_axis_sse: number;
  mutable_suffix_axis_sse: number;
  optimistic_suffix_axis_quality_upper: number;
  bound_can_beat_incumbent: boolean;
};

export type BudgetEpisodeTelemetry = {
  episode_id: number;
  lane: BudgetEpisodeLane;
  parent_episode_id: number | null;
  search_seed: number | null;
  frontier_has_fallback_lane: boolean;
  /**
   * Immutable suffix where this episode began.
   *
   * A `resumed` episode continues the initial episode's own frontier, so it
   * reports that tree's root anchor. Its frontier is mixed-depth by
   * construction: anchor-relative quantities (structural progress, episode
   * pace, first-terminal offset) are approximate continuations of the initial
   * search, not fresh-start measurements.
   */
  anchor: RemainingStructure;
  /** Complete, self-contained repair decision; null on non-repair lanes. */
  repair_decision: BudgetRepairDecision | null;
  /** Exact selected target-gap observation on the true global incumbent. */
  incumbent_target_gap_before: BudgetRepairGapState | null;
  /** Exact selected target-gap observation on the track repaired by this episode. */
  working_target_gap_before: BudgetRepairGapState | null;
  /** Compile-global work counters; local budget is ceiling - start. */
  start_total_spent_frames: number;
  ceiling_total_spent_frames: number;
  /** How the ceiling above was sized. */
  ceiling_source: BudgetCeilingSource;
  available_hard_budget_frames: number;
  allocated_frames: number;
  work: BudgetEpisodeWork;
  register_key_at_start: BudgetInternalRegisterKey | null;
  register_key_at_end: BudgetInternalRegisterKey | null;
  start: BudgetEstimateObservation;
  end: BudgetEstimateObservation | null;
  observations?: BudgetEstimateObservation[];
  outcome: {
    stop_reason: BudgetEpisodeStopReason | null;
    end_total_spent_frames: number | null;
    spent_frames: number | null;
    /** Literal event: at least one terminal node was evaluated. */
    terminal_reached: boolean;
    /** Charged work from episode start to its first terminal, not its end. */
    first_terminal_offset_frames: number | null;
    /** Whether this episode changed the best-so-far register. */
    register_improved: boolean;
    /** Repair-only: a terminal alternative was adopted by the internal register. */
    accepted_alternative: boolean;
    /**
     * Charged work from episode start to the first improvement the best-so-far
     * register adopted during this episode. That leaf need not be terminal.
     */
    first_register_improvement_offset_frames: number | null;
    /** Charged work to the final register improvement observed in this episode. */
    final_register_improvement_offset_frames: number | null;
    /** Charged work to the first terminal offer adopted by the register. */
    first_terminal_register_improvement_offset_frames: number | null;
    /** Optimizer-internal full score after this episode minus before it. */
    internal_full_score_delta: number | null;
    /**
     * Selected target-gap observation on the first terminal offer. Null means
     * no terminal; `status: "missing"` means a terminal lost that gap/contact.
     */
    terminal_offer_target_gap: BudgetRepairGapState | null;
    /** Selected target-gap observation on the best incumbent after registration. */
    incumbent_target_gap_after: BudgetRepairGapState | null;
    /** Direct working-track-vs-terminal arc-geometry comparison for repair. */
    working_to_offer_divergence: BudgetRepairDivergence | null;
    /** Why a rejected selected-target improvement did or did not seed a follow-up. */
    rejected_local_improvement_followup:
      | "not_rejected_local_improvement"
      | "no_affordable_repair"
      | "eligible_policy_disabled"
      | "optimistic_bound_cannot_beat_incumbent"
      | "blocked_one_step_limit"
      | "blocked_attempt_limit"
      | "scheduled";
    /** Selective-bridge bound inputs and result; null when that policy was not evaluated. */
    rejected_local_improvement_bridge_assessment: BudgetRejectedLocalBridgeAssessment | null;
    /** SHA-256 of JSON.stringify(the repair terminal offer's track). */
    terminal_offer_track_hash: string | null;
    /** True when no terminal cost was observed; such episodes are not estimator error samples. */
    terminal_observation_censored: boolean;
  };
};

export type BudgetExecutionSegment = {
  kind: BudgetSegmentKind;
  episode_id: number | null;
  start_total_spent_frames: number;
  end_total_spent_frames: number;
  spent_frames: number;
  stop_reason: string;
};

/** Trace-only accounting for one atomic frontier node. A node is the smallest
 * unit the compiler currently lets finish once admitted. */
export type BudgetAtomicNodeTelemetry = {
  episode_id: number;
  lane: BudgetEpisodeLane;
  gap_index: number;
  remaining_contacts: number;
  start_total_spent_frames: number;
  hard_remaining_frames_at_start: number;
  episode_remaining_frames_at_start: number;
  requested_normal_proposals: number | null;
  child_limit: number | null;
  frontier_evaluation_frames: number;
  tail_completion_frames: number;
  post_tail_work_frames: number;
  spent_frames: number;
  /** Atomic disposition. `deferred` includes both a node's built-in deferred
   *  expansion and policy-directed selective suspension; the latter's causal
   *  event is recorded by `handoff_selective_backtracking`. */
  result: "captured" | "deferred" | "expanded" | "terminal_limit";
  register_improvements: number;
  terminal_node_evaluations: number;
  tail_attempts: number;
  tail_terminal_evaluations: number;
  tail_duplicate_terminal_evaluations: number;
  tail_improvements: number;
};

export type BudgetResumeAdmissionTelemetry = {
  mode: "legacy" | "none" | "remainder-aware";
  available_hard_budget_frames: number;
  planned_candidate_count: number | null;
  estimated_atomic_upper_frames: number | null;
  admitted: boolean;
  reason: "legacy" | "disabled" | "fits_remainder" | "exceeds_remainder" | "no_cost_history";
};

export type CompileBudgetTelemetry = {
  schema: typeof BUDGET_TELEMETRY_SCHEMA;
  level: Exclude<BudgetTelemetryLevel, "off">;
  model: {
    traversal_model: string;
    traversal_source: string;
    estimator_model: string;
    estimator_fingerprint: string;
    calibrated: boolean;
  };
  compile: {
    /** Outer accounting budget (`opts.budget`). */
    hard_budget_frames: number;
    /** Budget exposed to compiler policy (`opts.policyBudget`, defaulting to hard). */
    policy_budget_frames: number;
    /** Budget exposed specifically to search-shape policy. */
    search_policy_budget_frames: number;
    /** Compile-global ceiling available to the repair phase. */
    repair_budget_frames: number;
    total_spent_frames: number;
    hard_remaining_frames: number;
    hard_overrun_frames: number;
    budget_exhausted: boolean;
    initial_structural_work_prior_frames: number;
    /**
     * policy budget / initial structural prior, fixed at compile start.
     *
     * Unchanged in definition, but under a budget-law artifact the denominator
     * carries the exponent, so this ratio grows as `B^(1-alpha)` rather than as
     * `B`. It is telemetry, not the policy coordinate: `compile_stats.budget_slack`
     * is a separate, budget-independent V1 quantity and is untouched.
     */
    initial_structural_slack: number;
    /**
     * Whether the two fields above are inside the estimator's calibration
     * domain. They are a structural, path-free estimate at the first episode's
     * anchor, so they are `extrapolated_policy_budget` at any policy budget the
     * artifact was not fitted at. Null when no episode was recorded.
     */
    initial_structural_applicability: BudgetEstimatorApplicability | null;
    /**
     * The compiler's own first-terminal work counter, independent of episode
     * attribution. Null when no terminal traversal was considered.
     */
    first_terminal_total_spent_frames: number | null;
    first_improving_terminal_total_spent_frames: number | null;
    work: BudgetEpisodeWork;
    final_output_episode_id: number | null;
    final_output_lane: BudgetEpisodeLane | null;
    resume_admission?: BudgetResumeAdmissionTelemetry;
  };
  execution_intervals: BudgetExecutionSegment[];
  episodes: BudgetEpisodeTelemetry[];
  /** Present only at trace level. */
  node_events?: BudgetAtomicNodeTelemetry[];
};

type MutableEpisode = BudgetEpisodeTelemetry & {
  includeStartup: boolean;
  highWaterGap: number;
  nextSpendDecile: number;
  pathEstimateByGap: readonly number[] | null;
  terminalTrackKeys: Set<string>;
};

type StartEpisodeInput = {
  lane: BudgetEpisodeLane;
  parentEpisodeId?: number | null;
  searchSeed: number | null;
  frontierHasFallbackLane: boolean;
  anchorGapIndex: number;
  startTotalSpentFrames: number;
  ceilingTotalSpentFrames: number;
  /** Defaults to `hard_budget`: the caller ran to the compile's outer limit. */
  ceilingSource?: BudgetCeilingSource;
  includeStartup: boolean;
  pathEstimateByGap?: readonly number[] | null;
  /** Repair-only causal context; see the fields of the same name on the record. */
  repairDecision?: BudgetRepairDecision | null;
  incumbentTargetGapBefore?: BudgetRepairGapState | null;
  workingTargetGapBefore?: BudgetRepairGapState | null;
  registerKeyAtStart?: BudgetInternalRegisterKey | null;
};

type EndEpisodeOutcome = {
  internalFullScoreDelta?: number | null;
  registerKeyAtEnd?: BudgetInternalRegisterKey | null;
  terminalOfferTargetGap?: BudgetRepairGapState | null;
  incumbentTargetGapAfter?: BudgetRepairGapState | null;
  workingToOfferDivergence?: BudgetRepairDivergence | null;
  rejectedLocalImprovementFollowup?: BudgetEpisodeTelemetry["outcome"]["rejected_local_improvement_followup"];
  rejectedLocalImprovementBridgeAssessment?: BudgetRejectedLocalBridgeAssessment | null;
};

type RecordAtomicNodeInput = Omit<
  BudgetAtomicNodeTelemetry,
  "episode_id" | "lane" |
    "hard_remaining_frames_at_start" |
    "episode_remaining_frames_at_start"
>;

/** Runtime recorder. All methods are deterministic arithmetic over supplied values. */
export class CompileBudgetTelemetryRecorder {
  readonly level: BudgetTelemetryLevel;
  private readonly gaps: readonly Gap[];
  private readonly durationFrames: number;
  private readonly hardBudgetFrames: number;
  private readonly policyBudgetFrames: number;
  private readonly searchPolicyBudgetFrames: number;
  private readonly repairBudgetFrames: number;
  private readonly model: TraversalBudgetModel;
  /**
   * The artifact's budget-law scalar at this compile's policy budget.
   *
   * It is a function of the budget alone, so it is resolved once here and never
   * recomputed per observation. It comes from the frozen artifact rather than
   * from `input.model`, because a caller-supplied traversal model overrides the
   * three coefficients only — corrections, intervals, applicability, and now the
   * budget law all remain the artifact's.
   */
  private readonly structuralScale: number;
  private readonly episodes: MutableEpisode[] = [];
  private readonly executionIntervals: BudgetExecutionSegment[] = [];
  private readonly nodeEvents: BudgetAtomicNodeTelemetry[] = [];
  private readonly compileTerminalTrackKeys = new Set<string>();
  private resumeAdmission: BudgetResumeAdmissionTelemetry | null = null;
  private activeEpisodeId: number | null = null;
  private finalOutputEpisodeId: number | null = null;

  constructor(input: {
    level: BudgetTelemetryLevel;
    gaps: readonly Gap[];
    durationFrames: number;
    hardBudgetFrames: number;
    policyBudgetFrames: number;
    searchPolicyBudgetFrames?: number;
    repairBudgetFrames?: number;
    model?: TraversalBudgetModel;
  }) {
    this.level = input.level;
    this.gaps = input.gaps;
    this.durationFrames = input.durationFrames;
    this.hardBudgetFrames = input.hardBudgetFrames;
    this.policyBudgetFrames = input.policyBudgetFrames;
    this.searchPolicyBudgetFrames = input.searchPolicyBudgetFrames ?? input.policyBudgetFrames;
    this.repairBudgetFrames = input.repairBudgetFrames ?? input.policyBudgetFrames;
    this.model = input.model ?? BUDGET_ESTIMATOR_TRAVERSAL_MODEL;
    this.structuralScale = budgetEstimatorStructuralScale(this.searchPolicyBudgetFrames);
  }

  startEpisode(input: StartEpisodeInput): number | null {
    if (this.level === "off") return null;
    if (this.activeEpisodeId !== null) {
      throw new Error(`budget telemetry cannot start an episode while another is active`);
    }
    const episodeId = this.episodes.length;
    const anchorGap = clampGapIndex(input.anchorGapIndex, this.gaps.length);
    const startTotal = nonNegativeInt(input.startTotalSpentFrames);
    const ceilingTotal = Math.max(startTotal, nonNegativeInt(input.ceilingTotalSpentFrames));
    const mutable: MutableEpisode = {
      episode_id: episodeId,
      lane: input.lane,
      parent_episode_id: input.parentEpisodeId ?? null,
      search_seed: input.searchSeed,
      frontier_has_fallback_lane: input.frontierHasFallbackLane,
      anchor: remainingStructure(this.gaps, this.durationFrames, anchorGap),
      repair_decision: cloneRepairDecision(input.repairDecision ?? null),
      incumbent_target_gap_before: input.incumbentTargetGapBefore === undefined ||
          input.incumbentTargetGapBefore === null
        ? null
        : structuredClone(input.incumbentTargetGapBefore),
      working_target_gap_before: input.workingTargetGapBefore === undefined ||
          input.workingTargetGapBefore === null
        ? null
        : structuredClone(input.workingTargetGapBefore),
      start_total_spent_frames: startTotal,
      ceiling_total_spent_frames: ceilingTotal,
      ceiling_source: input.ceilingSource ?? "hard_budget",
      available_hard_budget_frames: Math.max(0, this.hardBudgetFrames - startTotal),
      allocated_frames: ceilingTotal - startTotal,
      work: emptyEpisodeWork(),
      register_key_at_start: cloneRegisterKey(input.registerKeyAtStart ?? null),
      register_key_at_end: null,
      start: null as unknown as BudgetEstimateObservation,
      end: null,
      outcome: {
        stop_reason: null,
        end_total_spent_frames: null,
        spent_frames: null,
        terminal_reached: false,
        first_terminal_offset_frames: null,
        register_improved: false,
        accepted_alternative: false,
        first_register_improvement_offset_frames: null,
        final_register_improvement_offset_frames: null,
        first_terminal_register_improvement_offset_frames: null,
        internal_full_score_delta: null,
        terminal_offer_target_gap: null,
        incumbent_target_gap_after: null,
        working_to_offer_divergence: null,
        rejected_local_improvement_followup: "not_rejected_local_improvement",
        rejected_local_improvement_bridge_assessment: null,
        terminal_offer_track_hash: null,
        terminal_observation_censored: true,
      },
      includeStartup: input.includeStartup,
      highWaterGap: anchorGap,
      nextSpendDecile: 1,
      pathEstimateByGap: input.pathEstimateByGap ?? null,
      terminalTrackKeys: new Set<string>(),
      ...(this.level === "trace"
        ? { observations: [] as BudgetEstimateObservation[] }
        : {}),
    };
    this.episodes.push(mutable);
    this.activeEpisodeId = episodeId;
    const observation = this.buildObservation(mutable, startTotal, anchorGap, "start");
    mutable.start = observation;
    mutable.observations?.push(observation);
    return episodeId;
  }

  observeActiveEpisode(gapIndex: number, totalSpentFrames: number): void {
    const episode = this.activeEpisode();
    if (episode === null) return;
    const totalSpent = nonNegativeInt(totalSpentFrames);
    const nextGap = clampGapIndex(gapIndex, this.gaps.length);
    const advanced = nextGap > episode.highWaterGap;
    if (advanced) episode.highWaterGap = nextGap;
    if (this.level !== "trace") return;
    const episodeSpent = Math.max(0, totalSpent - episode.start_total_spent_frames);
    const allocated = episode.allocated_frames;
    const crossedSpend = allocated > 0 &&
      episodeSpent * 10 >= allocated * episode.nextSpendDecile;
    if (!advanced && !crossedSpend) return;
    while (
      allocated > 0 &&
      episode.nextSpendDecile <= 10 &&
      episodeSpent * 10 >= allocated * episode.nextSpendDecile
    ) episode.nextSpendDecile++;
    this.pushObservation(
      episode,
      this.buildObservation(episode, totalSpent, episode.highWaterGap, advanced ? "high_water" : "spend"),
    );
  }

  recordEvaluation(input: {
    totalSpentFrames: number;
    gapIndex: number;
    terminal: boolean;
    origin: BudgetEvaluationOrigin;
    firstTimeSearchNode: boolean;
    terminalTrackKey?: string | null;
    registerImproved: boolean;
  }): void {
    const episode = this.activeEpisode();
    if (episode === null) return;
    const totalSpent = nonNegativeInt(input.totalSpentFrames);
    episode.highWaterGap = Math.max(
      episode.highWaterGap,
      clampGapIndex(input.gapIndex, this.gaps.length),
    );
    episode.work.register_offers++;
    const origin = episode.work.by_evaluation_origin[input.origin];
    origin.register_offers++;
    if (input.terminal) {
      episode.work.terminal_node_evaluations++;
      origin.terminal_node_evaluations++;
      if (input.firstTimeSearchNode) episode.work.first_time_terminal_node_evaluations++;
      else episode.work.revisited_terminal_node_evaluations++;
      episode.outcome.terminal_reached = true;
      episode.outcome.terminal_observation_censored = false;
      if (episode.outcome.first_terminal_offset_frames === null) {
        episode.outcome.first_terminal_offset_frames = Math.max(
          0,
          totalSpent - episode.start_total_spent_frames,
        );
      }
      const trackKey = input.terminalTrackKey ?? null;
      if (trackKey !== null) {
        if (episode.terminalTrackKeys.has(trackKey)) {
          episode.work.repeated_terminal_track_evaluations++;
        } else {
          episode.terminalTrackKeys.add(trackKey);
          episode.work.distinct_terminal_tracks++;
        }
        this.compileTerminalTrackKeys.add(trackKey);
        if (episode.lane === "repair") {
          episode.outcome.terminal_offer_track_hash = sha256String(trackKey);
        }
      }
    } else {
      episode.work.partial_node_evaluations++;
    }
    if (input.registerImproved) {
      episode.work.register_improvements++;
      origin.register_improvements++;
      if (input.terminal) episode.work.terminal_register_improvements++;
      if (input.terminal) origin.terminal_register_improvements++;
      if (input.terminal && episode.lane === "repair") {
        episode.outcome.accepted_alternative = true;
      }
      episode.outcome.register_improved = true;
      const offset = Math.max(0, totalSpent - episode.start_total_spent_frames);
      if (episode.outcome.first_register_improvement_offset_frames === null) {
        episode.outcome.first_register_improvement_offset_frames = offset;
      }
      episode.outcome.final_register_improvement_offset_frames = offset;
      if (
        input.terminal &&
        episode.outcome.first_terminal_register_improvement_offset_frames === null
      ) {
        episode.outcome.first_terminal_register_improvement_offset_frames = offset;
      }
      this.finalOutputEpisodeId = episode.episode_id;
    }
    if (
      input.terminal &&
      episode.observations !== undefined &&
      episode.observations.every((observation) => observation.event !== "terminal")
    ) {
      this.pushObservation(
        episode,
        this.buildObservation(episode, totalSpent, episode.highWaterGap, "terminal"),
      );
    }
  }

  recordNodeWork(input: {
    rankedOptionCalls: number;
    requestedNormalProposals: number;
    nodesExpanded: number;
    childrenEnqueued: number;
  }): void {
    const episode = this.activeEpisode();
    if (episode === null) return;
    episode.work.nodes_processed++;
    episode.work.ranked_option_calls += nonNegativeInt(input.rankedOptionCalls);
    episode.work.requested_normal_proposals += nonNegativeInt(input.requestedNormalProposals);
    episode.work.nodes_expanded += nonNegativeInt(input.nodesExpanded);
    episode.work.children_enqueued += nonNegativeInt(input.childrenEnqueued);
  }

  setActiveCandidateWork(input: {
    actualCandidateSamples: number;
    viableCandidates: number;
    candidateSamplesByStream: Record<string, number>;
  }): void {
    const episode = this.activeEpisode();
    if (episode === null) return;
    episode.work.actual_candidate_samples = nonNegativeInt(input.actualCandidateSamples);
    episode.work.viable_candidates = nonNegativeInt(input.viableCandidates);
    episode.work.candidate_samples_by_stream = Object.fromEntries(
      Object.entries(input.candidateSamplesByStream)
        .map(([mode, count]): [string, number] => [mode, nonNegativeInt(count)])
        .filter(([, count]) => count > 0),
    );
  }

  endEpisode(
    totalSpentFrames: number,
    stopReason: BudgetEpisodeStopReason,
    outcome: EndEpisodeOutcome = {},
  ): void {
    const episode = this.activeEpisode();
    if (episode === null) return;
    const totalSpent = nonNegativeInt(totalSpentFrames);
    const end = this.buildObservation(episode, totalSpent, episode.highWaterGap, "end");
    episode.end = end;
    this.pushObservation(episode, end);
    episode.outcome.stop_reason = stopReason;
    episode.outcome.end_total_spent_frames = totalSpent;
    episode.outcome.spent_frames = Math.max(0, totalSpent - episode.start_total_spent_frames);
    episode.outcome.terminal_offer_target_gap = outcome.terminalOfferTargetGap === undefined ||
        outcome.terminalOfferTargetGap === null
      ? null
      : structuredClone(outcome.terminalOfferTargetGap);
    episode.outcome.incumbent_target_gap_after = outcome.incumbentTargetGapAfter === undefined ||
        outcome.incumbentTargetGapAfter === null
      ? null
      : structuredClone(outcome.incumbentTargetGapAfter);
    episode.outcome.working_to_offer_divergence = cloneRepairDivergence(
      outcome.workingToOfferDivergence ?? null,
    );
    episode.outcome.rejected_local_improvement_followup =
      outcome.rejectedLocalImprovementFollowup ?? "not_rejected_local_improvement";
    episode.outcome.rejected_local_improvement_bridge_assessment =
      outcome.rejectedLocalImprovementBridgeAssessment === undefined ||
          outcome.rejectedLocalImprovementBridgeAssessment === null
        ? null
        : structuredClone(outcome.rejectedLocalImprovementBridgeAssessment);
    episode.register_key_at_end = cloneRegisterKey(outcome.registerKeyAtEnd ?? null);
    episode.outcome.internal_full_score_delta = outcome.internalFullScoreDelta !== undefined
      ? finiteOrNull(outcome.internalFullScoreDelta)
      : registerScoreDelta(episode.register_key_at_start, episode.register_key_at_end);
    this.activeEpisodeId = null;
  }

  recordSegment(
    kind: BudgetSegmentKind,
    startTotalSpentFrames: number,
    endTotalSpentFrames: number,
    stopReason: string,
    episodeId: number | null = null,
  ): void {
    if (this.level === "off") return;
    const start = nonNegativeInt(startTotalSpentFrames);
    const end = Math.max(start, nonNegativeInt(endTotalSpentFrames));
    this.executionIntervals.push({
      kind,
      episode_id: episodeId,
      start_total_spent_frames: start,
      end_total_spent_frames: end,
      spent_frames: end - start,
      stop_reason: stopReason,
    });
  }

  recordAtomicNode(input: RecordAtomicNodeInput): void {
    if (this.level !== "trace") return;
    const episode = this.activeEpisode();
    if (episode === null) return;
    const start = nonNegativeInt(input.start_total_spent_frames);
    this.nodeEvents.push({
      ...input,
      episode_id: episode.episode_id,
      lane: episode.lane,
      start_total_spent_frames: start,
      hard_remaining_frames_at_start: Math.max(0, this.hardBudgetFrames - start),
      episode_remaining_frames_at_start: Math.max(
        0,
        episode.ceiling_total_spent_frames - start,
      ),
      frontier_evaluation_frames: nonNegativeInt(input.frontier_evaluation_frames),
      tail_completion_frames: nonNegativeInt(input.tail_completion_frames),
      post_tail_work_frames: nonNegativeInt(input.post_tail_work_frames),
      spent_frames: nonNegativeInt(input.spent_frames),
      register_improvements: nonNegativeInt(input.register_improvements),
      terminal_node_evaluations: nonNegativeInt(input.terminal_node_evaluations),
      tail_attempts: nonNegativeInt(input.tail_attempts),
      tail_terminal_evaluations: nonNegativeInt(input.tail_terminal_evaluations),
      tail_duplicate_terminal_evaluations: nonNegativeInt(
        input.tail_duplicate_terminal_evaluations,
      ),
      tail_improvements: nonNegativeInt(input.tail_improvements),
    });
  }

  recordResumeAdmission(input: BudgetResumeAdmissionTelemetry): void {
    if (this.level === "off") return;
    this.resumeAdmission = { ...input };
  }

  snapshot(
    totalSpentFrames: number,
    budgetExhausted: boolean,
    firstTerminalTotalSpentFrames: number | null = null,
    firstImprovingTerminalTotalSpentFrames: number | null = null,
  ): CompileBudgetTelemetry | null {
    if (this.level === "off") return null;
    const totalSpent = nonNegativeInt(totalSpentFrames);
    const episodes = this.episodes.map((episode) => this.snapshotEpisode(episode, totalSpent));
    const executionIntervals = this.snapshotExecutionIntervals(totalSpent);
    const initial = episodes[0];
    const initialStructural = initial?.start.structural_work_prior_frames ?? 0;
    const aggregateWork = sumEpisodeWork(episodes.map((episode) => episode.work));
    aggregateWork.distinct_terminal_tracks = this.compileTerminalTrackKeys.size;
    aggregateWork.repeated_terminal_track_evaluations = Math.max(
      0,
      aggregateWork.terminal_node_evaluations - aggregateWork.distinct_terminal_tracks,
    );
    const finalEpisode = this.finalOutputEpisodeId === null
      ? null
      : episodes[this.finalOutputEpisodeId] ?? null;
    const payload: CompileBudgetTelemetry = {
      schema: BUDGET_TELEMETRY_SCHEMA,
      level: this.level,
      model: {
        traversal_model: this.model.name,
        traversal_source: this.model.source,
        estimator_model: BUDGET_ESTIMATOR_MODEL.modelId,
        estimator_fingerprint: BUDGET_ESTIMATOR_MODEL_FINGERPRINT,
        calibrated: BUDGET_ESTIMATOR_MODEL.calibrated,
      },
      compile: {
        hard_budget_frames: this.hardBudgetFrames,
        policy_budget_frames: this.policyBudgetFrames,
        search_policy_budget_frames: this.searchPolicyBudgetFrames,
        repair_budget_frames: this.repairBudgetFrames,
        total_spent_frames: totalSpent,
        hard_remaining_frames: Math.max(0, this.hardBudgetFrames - totalSpent),
        hard_overrun_frames: Math.max(0, totalSpent - this.hardBudgetFrames),
        budget_exhausted: budgetExhausted,
        initial_structural_work_prior_frames: initialStructural,
        initial_structural_slack: initialStructural > 0
          ? this.searchPolicyBudgetFrames / initialStructural
          : 0,
        // The two fields above are a path-free structural estimate, so they
        // inherit the structural domain: mark it rather than let a reader
        // assume the compile-scope numbers are calibrated everywhere.
        initial_structural_applicability: initial === undefined
          ? null
          : budgetEstimatorApplicability({
            pathAvailable: false,
            policyBudgetFrames: this.searchPolicyBudgetFrames,
            attemptKind: initial.lane,
          }),
        first_terminal_total_spent_frames: firstTerminalTotalSpentFrames === null
          ? null
          : nonNegativeInt(firstTerminalTotalSpentFrames),
        first_improving_terminal_total_spent_frames:
          firstImprovingTerminalTotalSpentFrames === null
            ? null
            : nonNegativeInt(firstImprovingTerminalTotalSpentFrames),
        work: aggregateWork,
        final_output_episode_id: finalEpisode?.episode_id ?? null,
        final_output_lane: finalEpisode?.lane ?? null,
        ...(this.resumeAdmission === null
          ? {}
          : { resume_admission: { ...this.resumeAdmission } }),
      },
      execution_intervals: executionIntervals,
      episodes,
      ...(this.level === "trace" ? { node_events: this.nodeEvents.map((node) => ({ ...node })) } : {}),
    };
    validateTelemetryPayload(payload, { allowUnattributedInterval: this.activeEpisodeId !== null });
    return payload;
  }

  private activeEpisode(): MutableEpisode | null {
    return this.activeEpisodeId === null ? null : this.episodes[this.activeEpisodeId] ?? null;
  }

  /**
   * Structural remaining work at a gap, on this compile's budget scale.
   *
   * Anchor and high-water work share one scalar, so `structural_progress_fraction`
   * and `episode_pace_work_estimate_frames` are unchanged by the law: the scale
   * cancels in `(S0 - S) / S0` and in `spent * S / (S0 - S)`. Pace stays a pure
   * measurement, which is the one component the law was never needed for.
   */
  private structuralWorkAt(gapIndex: number, includeStartup: boolean): number {
    return this.structuralScale * structuralRemainingWork(
      this.gaps,
      this.durationFrames,
      gapIndex,
      includeStartup,
      this.model,
    );
  }

  private buildObservation(
    episode: MutableEpisode,
    totalSpentFrames: number,
    highWaterGap: number,
    event: BudgetEstimateObservation["event"],
  ): BudgetEstimateObservation {
    const totalSpent = nonNegativeInt(totalSpentFrames);
    const structure = remainingStructure(this.gaps, this.durationFrames, highWaterGap);
    const structural = this.structuralWorkAt(
      highWaterGap,
      episode.includeStartup && highWaterGap === episode.anchor.gap_index,
    );
    const startStructural = this.structuralWorkAt(
      episode.anchor.gap_index,
      episode.includeStartup,
    );
    const progressedStructural = Math.max(0, startStructural - structural);
    const progressFraction = startStructural > 0
      ? clamp01(progressedStructural / startStructural)
      : 1;
    const episodeSpent = Math.max(0, totalSpent - episode.start_total_spent_frames);
    const episodeRemaining = Math.max(0, episode.ceiling_total_spent_frames - totalSpent);
    const pathRaw = episode.pathEstimateByGap?.[structure.gap_index];
    // A zero cost-to-end is not a measurement of "no work left": the incumbent
    // profile writes zero whenever first completion did not post-date reaching
    // that node. The estimator's own selector treats non-positive paths as
    // absent, so admitting zero here would label a structural estimate
    // path-backed (and therefore `calibrated`) on no evidence.
    const pathEstimate = pathRaw !== undefined && pathRaw > 0 ? pathRaw : null;
    // Project this episode's observed work per unit of structural progress over
    // the structural suffix still left. It is null until high water advances.
    const paceEstimate = progressedStructural > 0
      ? Math.max(0, episodeSpent * structural / progressedStructural)
      : null;
    const estimated = estimateRemainingBudgetWork({
      structural,
      path: pathEstimate,
      pace: paceEstimate,
      progressFraction,
    });
    const hardRemaining = Math.max(0, this.hardBudgetFrames - totalSpent);
    const applicability = budgetEstimatorApplicability({
      pathAvailable: pathEstimate !== null,
      policyBudgetFrames: this.searchPolicyBudgetFrames,
      attemptKind: episode.lane,
    });
    // The interval stratum uses the same path predicate as the correction
    // factor: `pathEstimate` is already the positive-only value the selector
    // would route through.
    const calibratedInterval = budgetEstimateInterval(estimated, {
      event,
      pathAvailable: pathEstimate !== null,
    });
    const { lower, upper } = applicability === "calibrated"
      ? calibratedInterval
      : {
        lower: 0,
        upper: Math.max(calibratedInterval.upper, hardRemaining),
      };
    return {
      event,
      total_spent_frames: totalSpent,
      hard_remaining_frames: hardRemaining,
      hard_overrun_frames: Math.max(0, totalSpent - this.hardBudgetFrames),
      episode_spent_frames: episodeSpent,
      episode_remaining_frames: episodeRemaining,
      episode_overrun_frames: Math.max(0, totalSpent - episode.ceiling_total_spent_frames),
      high_water: structure,
      structural_startup_included: episode.includeStartup &&
        highWaterGap === episode.anchor.gap_index,
      estimator_applicability: applicability,
      structural_progress_fraction: progressFraction,
      structural_work_prior_frames: structural,
      incumbent_path_work_estimate_frames: pathEstimate,
      episode_pace_work_estimate_frames: paceEstimate,
      estimated_remaining_work_frames: estimated,
      estimate_lower_frames: lower,
      estimate_upper_frames: upper,
      estimate_uncertainty_frames: (upper - lower) / 2,
      hard_completion_margin: applicability === "calibrated" && estimated > 0
        ? hardRemaining / estimated
        : null,
      hard_completion_surplus_frames: hardRemaining - estimated,
      episode_completion_margin: applicability === "calibrated" && estimated > 0
        ? episodeRemaining / estimated
        : null,
      episode_completion_surplus_frames: episodeRemaining - estimated,
    };
  }

  private pushObservation(episode: MutableEpisode, observation: BudgetEstimateObservation): void {
    if (this.level !== "trace" || episode.observations === undefined) return;
    const previous = episode.observations.at(-1);
    if (
      previous?.event === observation.event &&
      previous.total_spent_frames === observation.total_spent_frames &&
      previous.high_water.gap_index === observation.high_water.gap_index
    ) return;
    episode.observations.push(observation);
  }

  private snapshotEpisode(episode: MutableEpisode, totalSpent: number): BudgetEpisodeTelemetry {
    const end = episode.end ?? this.buildObservation(
      episode,
      totalSpent,
      episode.highWaterGap,
      "end",
    );
    // A hard-budget capture can freeze a repair while its frontier is open.
    // `processNode` returns on a repair terminal before the capture check, so
    // this state is necessarily a censored, no-terminal episode. The true
    // global register and selected target are therefore unchanged; finalize
    // those fields explicitly instead of emitting an ambiguous null state.
    const capturedOpenRepair = episode.end === null &&
      episode.lane === "repair" &&
      !episode.outcome.terminal_reached;
    const outcome = episode.end === null
      ? {
        ...episode.outcome,
        stop_reason: "budget_capture" as const,
        end_total_spent_frames: totalSpent,
        spent_frames: Math.max(0, totalSpent - episode.start_total_spent_frames),
        ...(capturedOpenRepair
          ? {
            incumbent_target_gap_after: episode.incumbent_target_gap_before === null
              ? null
              : structuredClone(episode.incumbent_target_gap_before),
            internal_full_score_delta: 0,
          }
          : {}),
      }
      : { ...episode.outcome };
    return {
      episode_id: episode.episode_id,
      lane: episode.lane,
      parent_episode_id: episode.parent_episode_id,
      search_seed: episode.search_seed,
      frontier_has_fallback_lane: episode.frontier_has_fallback_lane,
      anchor: { ...episode.anchor },
      repair_decision: cloneRepairDecision(episode.repair_decision),
      incumbent_target_gap_before: episode.incumbent_target_gap_before === null
        ? null
        : structuredClone(episode.incumbent_target_gap_before),
      working_target_gap_before: episode.working_target_gap_before === null
        ? null
        : structuredClone(episode.working_target_gap_before),
      start_total_spent_frames: episode.start_total_spent_frames,
      ceiling_total_spent_frames: episode.ceiling_total_spent_frames,
      ceiling_source: episode.ceiling_source,
      available_hard_budget_frames: episode.available_hard_budget_frames,
      allocated_frames: episode.allocated_frames,
      work: structuredClone(episode.work),
      register_key_at_start: cloneRegisterKey(episode.register_key_at_start),
      register_key_at_end: cloneRegisterKey(
        capturedOpenRepair ? episode.register_key_at_start : episode.register_key_at_end,
      ),
      start: structuredClone(episode.start),
      end: structuredClone(end),
      ...(episode.observations === undefined
        ? {}
        : { observations: structuredClone(episode.observations) }),
      outcome,
    };
  }

  private snapshotExecutionIntervals(totalSpent: number): BudgetExecutionSegment[] {
    const intervals = this.executionIntervals.map((interval) => ({ ...interval }));
    const coveredEnd = intervals.reduce(
      (max, segment) => Math.max(max, segment.end_total_spent_frames),
      0,
    );
    if (coveredEnd < totalSpent) {
      intervals.push({
        kind: "unattributed",
        episode_id: null,
        start_total_spent_frames: coveredEnd,
        end_total_spent_frames: totalSpent,
        spent_frames: totalSpent - coveredEnd,
        stop_reason: "snapshot_gap",
      });
    }
    return intervals;
  }
}

/**
 * Candidate geometric pace blend used by characterization/tests.
 *
 * Runtime selection is owned by estimateRemainingBudgetWork(); the current
 * frozen model gives episode pace zero weight.
 */
export function adaptiveEstimate(
  baseEstimate: number,
  paceEstimate: number | null,
  structuralProgressFraction: number,
): number {
  const base = Math.max(0, baseEstimate);
  if (base === 0) return 0;
  if (paceEstimate === null || !(paceEstimate > 0)) return base;
  const weight = clamp01(structuralProgressFraction);
  return Math.exp((1 - weight) * Math.log(base) + weight * Math.log(paceEstimate));
}

function emptyEpisodeWork(): BudgetEpisodeWork {
  return {
    ranked_option_calls: 0,
    requested_normal_proposals: 0,
    actual_candidate_samples: 0,
    viable_candidates: 0,
    candidate_samples_by_stream: {},
    by_evaluation_origin: Object.fromEntries(
      BUDGET_EVALUATION_ORIGINS.map((origin) => [origin, emptyEvaluationOriginWork()]),
    ) as Record<BudgetEvaluationOrigin, BudgetEvaluationOriginWork>,
    nodes_processed: 0,
    nodes_expanded: 0,
    children_enqueued: 0,
    register_offers: 0,
    partial_node_evaluations: 0,
    terminal_node_evaluations: 0,
    first_time_terminal_node_evaluations: 0,
    revisited_terminal_node_evaluations: 0,
    distinct_terminal_tracks: 0,
    repeated_terminal_track_evaluations: 0,
    register_improvements: 0,
    terminal_register_improvements: 0,
  };
}

function sumEpisodeWork(items: readonly BudgetEpisodeWork[]): BudgetEpisodeWork {
  const total = emptyEpisodeWork();
  for (const item of items) {
    for (const key of [
      "ranked_option_calls",
      "requested_normal_proposals",
      "actual_candidate_samples",
      "viable_candidates",
      "nodes_processed",
      "nodes_expanded",
      "children_enqueued",
      "register_offers",
      "partial_node_evaluations",
      "terminal_node_evaluations",
      "first_time_terminal_node_evaluations",
      "revisited_terminal_node_evaluations",
      "distinct_terminal_tracks",
      "repeated_terminal_track_evaluations",
      "register_improvements",
      "terminal_register_improvements",
    ] as const) total[key] += item[key];
    for (const [mode, count] of Object.entries(item.candidate_samples_by_stream)) {
      total.candidate_samples_by_stream[mode] =
        (total.candidate_samples_by_stream[mode] ?? 0) + count;
    }
    for (const origin of BUDGET_EVALUATION_ORIGINS) {
      const destination = total.by_evaluation_origin[origin];
      const source = item.by_evaluation_origin[origin];
      destination.register_offers += source.register_offers;
      destination.terminal_node_evaluations += source.terminal_node_evaluations;
      destination.register_improvements += source.register_improvements;
      destination.terminal_register_improvements += source.terminal_register_improvements;
    }
  }
  return total;
}

function emptyEvaluationOriginWork(): BudgetEvaluationOriginWork {
  return {
    register_offers: 0,
    terminal_node_evaluations: 0,
    register_improvements: 0,
    terminal_register_improvements: 0,
  };
}

function cloneRegisterKey(key: BudgetInternalRegisterKey | null): BudgetInternalRegisterKey | null {
  return key === null ? null : { ...key };
}

function cloneRepairDecision(decision: BudgetRepairDecision | null): BudgetRepairDecision | null {
  return decision === null
    ? null
    : {
      ...decision,
      affordable_target_gap_indices: [...decision.affordable_target_gap_indices],
      affordable_anchor_gap_indices: [...decision.affordable_anchor_gap_indices],
      considered_targets: decision.considered_targets.map((candidate) => ({
        ...candidate,
        anchor_options: candidate.anchor_options.map((anchor) => ({ ...anchor })),
      })),
    };
}

function sha256String(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function cloneRepairDivergence(
  divergence: BudgetRepairDivergence | null,
): BudgetRepairDivergence | null {
  return divergence === null ? null : { ...divergence };
}

function registerScoreDelta(
  before: BudgetInternalRegisterKey | null,
  after: BudgetInternalRegisterKey | null,
): number | null {
  if (before === null || after === null) return null;
  return after.internal_full_score - before.internal_full_score;
}

function measuredGapStateSse(state: BudgetRepairGapState | null): number | null {
  return state?.status === "measured" ? state.sse : null;
}

function validateTelemetryPayload(
  payload: CompileBudgetTelemetry,
  options: { allowUnattributedInterval: boolean },
): void {
  const summedWork = sumEpisodeWork(payload.episodes.map((episode) => episode.work));
  for (let index = 0; index < payload.episodes.length; index++) {
    const episode = payload.episodes[index]!;
    if (episode.episode_id !== index) {
      throw new Error(`budget telemetry episode IDs must be contiguous and ordered`);
    }
    if (
      episode.parent_episode_id !== null &&
      (episode.parent_episode_id < 0 || episode.parent_episode_id >= episode.episode_id)
    ) {
      throw new Error(`budget telemetry episode ${index} has an invalid parent`);
    }
    const work = episode.work;
    for (const key of [
      "ranked_option_calls",
      "requested_normal_proposals",
      "actual_candidate_samples",
      "viable_candidates",
      "nodes_processed",
      "nodes_expanded",
      "children_enqueued",
      "register_offers",
      "partial_node_evaluations",
      "terminal_node_evaluations",
      "first_time_terminal_node_evaluations",
      "revisited_terminal_node_evaluations",
      "distinct_terminal_tracks",
      "repeated_terminal_track_evaluations",
      "register_improvements",
      "terminal_register_improvements",
    ] as const) {
      if (!Number.isInteger(work[key]) || work[key] < 0) {
        throw new Error(`budget telemetry episode ${index} ${key} is not a non-negative integer`);
      }
    }
    if (
      work.register_offers !==
        work.partial_node_evaluations + work.terminal_node_evaluations
    ) {
      throw new Error(`budget telemetry episode ${index} register-offer accounting is open`);
    }
    if (
      work.terminal_node_evaluations !==
        work.first_time_terminal_node_evaluations + work.revisited_terminal_node_evaluations
    ) {
      throw new Error(`budget telemetry episode ${index} terminal-node accounting is open`);
    }
    if (
      work.terminal_node_evaluations !==
        work.distinct_terminal_tracks + work.repeated_terminal_track_evaluations
    ) {
      throw new Error(`budget telemetry episode ${index} terminal-track accounting is open`);
    }
    if (work.register_improvements > work.register_offers) {
      throw new Error(`budget telemetry episode ${index} has more improvements than offers`);
    }
    if (work.terminal_register_improvements > work.terminal_node_evaluations) {
      throw new Error(`budget telemetry episode ${index} has too many terminal improvements`);
    }
    if (work.viable_candidates > work.actual_candidate_samples) {
      throw new Error(`budget telemetry episode ${index} has more viable than sampled candidates`);
    }
    if (work.nodes_expanded > work.nodes_processed) {
      throw new Error(`budget telemetry episode ${index} has more expanded than processed nodes`);
    }
    const attributedSamples = Object.values(work.candidate_samples_by_stream)
      .reduce((sum, value) => sum + value, 0);
    for (const [mode, count] of Object.entries(work.candidate_samples_by_stream)) {
      if (!Number.isInteger(count) || count < 0) {
        throw new Error(`budget telemetry episode ${index} candidate mode ${mode} is invalid`);
      }
    }
    if (attributedSamples !== work.actual_candidate_samples) {
      throw new Error(`budget telemetry episode ${index} candidate-mode accounting is open`);
    }
    const originTotals = BUDGET_EVALUATION_ORIGINS.reduce(
      (total, origin) => {
        const source = work.by_evaluation_origin[origin];
        total.register_offers += source.register_offers;
        total.terminal_node_evaluations += source.terminal_node_evaluations;
        total.register_improvements += source.register_improvements;
        total.terminal_register_improvements += source.terminal_register_improvements;
        return total;
      },
      emptyEvaluationOriginWork(),
    );
    for (const key of [
      "register_offers",
      "terminal_node_evaluations",
      "register_improvements",
      "terminal_register_improvements",
    ] as const) {
      if (originTotals[key] !== work[key]) {
        throw new Error(`budget telemetry episode ${index} evaluation-origin accounting is open`);
      }
    }
    for (const origin of BUDGET_EVALUATION_ORIGINS) {
      const value = work.by_evaluation_origin[origin];
      for (const count of Object.values(value)) {
        if (!Number.isInteger(count) || count < 0) {
          throw new Error(`budget telemetry episode ${index} evaluation origin ${origin} is invalid`);
        }
      }
      if (
        value.register_improvements > value.register_offers ||
        value.terminal_register_improvements > value.terminal_node_evaluations ||
        value.terminal_register_improvements > value.register_improvements
      ) {
        throw new Error(
          `budget telemetry episode ${index} evaluation origin ${origin} exceeds its population`,
        );
      }
    }
    if (episode.outcome.terminal_reached !== (work.terminal_node_evaluations > 0)) {
      throw new Error(`budget telemetry episode ${index} terminal outcome disagrees with work`);
    }
    if (episode.outcome.terminal_observation_censored !== (work.terminal_node_evaluations === 0)) {
      throw new Error(`budget telemetry episode ${index} terminal censoring is inconsistent`);
    }
    if (
      (episode.outcome.first_terminal_offset_frames === null) !==
        (work.terminal_node_evaluations === 0)
    ) {
      throw new Error(`budget telemetry episode ${index} terminal timing is inconsistent`);
    }
    if (episode.outcome.register_improved !== (work.register_improvements > 0)) {
      throw new Error(`budget telemetry episode ${index} register outcome disagrees with work`);
    }
    if (
      episode.outcome.accepted_alternative !==
        (episode.lane === "repair" && work.terminal_register_improvements > 0)
    ) {
      throw new Error(`budget telemetry episode ${index} alternative acceptance is inconsistent`);
    }
    if ((episode.repair_decision === null) !== (episode.lane !== "repair")) {
      throw new Error(`budget telemetry episode ${index} repair-decision attribution is inconsistent`);
    }
    if (episode.repair_decision !== null) {
      const decision = episode.repair_decision;
      if (
        !Number.isInteger(decision.iteration_index) || decision.iteration_index < 0 ||
        !Number.isInteger(decision.incumbent_revision) || decision.incumbent_revision < 0 ||
        !/^[a-f0-9]{64}$/.test(decision.incumbent_track_hash) ||
        !["global_incumbent", "rejected_local_improvement"].includes(
          decision.working_track_source,
        ) ||
        !/^[a-f0-9]{64}$/.test(decision.working_track_hash) ||
        (decision.working_track_source === "global_incumbent" &&
          decision.working_track_hash !== decision.incumbent_track_hash) ||
        !Number.isInteger(decision.remaining_budget_frames) || decision.remaining_budget_frames < 0 ||
        !(decision.headroom_fraction >= 0 && decision.headroom_fraction < 1) ||
        !Number.isInteger(decision.usable_budget_frames) || decision.usable_budget_frames < 0 ||
        !Number.isInteger(decision.parent_depth) || decision.parent_depth < 0 ||
        !Number.isInteger(decision.target_gap_index) || decision.target_gap_index < 0 ||
        !Number.isInteger(decision.anchor_gap_index) || decision.anchor_gap_index < 0 ||
        decision.anchor_gap_index !== decision.target_gap_index - decision.parent_depth ||
        decision.anchor_gap_index !== episode.anchor.gap_index ||
        decision.remaining_budget_frames !==
          Math.max(0, payload.compile.repair_budget_frames - episode.start_total_spent_frames) ||
        decision.usable_budget_frames !==
          Math.floor(decision.remaining_budget_frames * (1 - decision.headroom_fraction)) ||
        ![
          "worst_gap_deepest_affordable",
          "worst_gap_three_quarter_last_chance",
          "worst_gap_repeated_rejection_step_later",
          "worst_gap_window_opportunity_per_cost",
          "worst_gap_runway_opportunity_per_cost",
          "worst_gap_reserve_cheapest_repair",
          "worst_gap_reserve_cheapest_else_deepest",
          "suffix_opportunity_per_cost",
          "max_suffix_opportunity",
          "max_local_window_opportunity",
        ].includes(
          decision.selection_policy,
        ) ||
        !decision.affordable_target_gap_indices.includes(decision.target_gap_index) ||
        decision.affordable_target_gap_indices.some((gap) => !Number.isInteger(gap) || gap < 0) ||
        !decision.affordable_anchor_gap_indices.includes(decision.anchor_gap_index) ||
        decision.affordable_anchor_gap_indices.some((gap) => !Number.isInteger(gap) || gap < 0) ||
        !(decision.target_gap_sse >= 0) ||
        !(decision.mutable_suffix_sse >= decision.target_gap_sse) ||
        !(decision.estimated_anchor_cost_frames >= 0) ||
        !(decision.estimated_anchor_cost_upper_frames >= decision.estimated_anchor_cost_frames) ||
        decision.estimated_anchor_cost_upper_frames > decision.usable_budget_frames
      ) {
        throw new Error(`budget telemetry episode ${index} repair decision is inconsistent`);
      }
      const observedGaps = new Set<number>();
      const observedAnchorCosts = new Map<number, string>();
      for (const candidate of decision.considered_targets) {
        if (
          !Number.isInteger(candidate.target_gap_index) || candidate.target_gap_index < 0 ||
          !(candidate.target_gap_sse >= 0) ||
          observedGaps.has(candidate.target_gap_index) || candidate.anchor_options.length === 0
        ) {
          throw new Error(`budget telemetry episode ${index} repair candidate is inconsistent`);
        }
        observedGaps.add(candidate.target_gap_index);
        const observedDepths = new Set<number>();
        for (const anchor of candidate.anchor_options) {
          const hasCost = anchor.estimated_anchor_cost_frames !== null &&
            anchor.estimated_anchor_cost_upper_frames !== null &&
            anchor.anchor_cost_source !== null;
          if (
            !Number.isInteger(anchor.parent_depth) || anchor.parent_depth < 0 ||
            observedDepths.has(anchor.parent_depth) ||
            !Number.isInteger(anchor.anchor_gap_index) || anchor.anchor_gap_index < 0 ||
            anchor.anchor_gap_index !== candidate.target_gap_index - anchor.parent_depth ||
            anchor.affordability === "anchor_before_start" ||
            (anchor.affordability === "no_positive_cost_estimate" && hasCost) ||
            (anchor.affordability === "affordable" &&
              (!hasCost || anchor.estimated_anchor_cost_upper_frames! > decision.usable_budget_frames)) ||
            (anchor.affordability === "exceeds_usable_budget" &&
              (!hasCost || anchor.estimated_anchor_cost_upper_frames! <= decision.usable_budget_frames)) ||
            (hasCost && (
              !(anchor.estimated_anchor_cost_frames! > 0) ||
              anchor.estimated_anchor_cost_upper_frames! < anchor.estimated_anchor_cost_frames!
            ))
          ) {
            throw new Error(`budget telemetry episode ${index} repair anchor option is inconsistent`);
          }
          if (hasCost) {
            const costIdentity = JSON.stringify([
              anchor.estimated_anchor_cost_frames,
              anchor.estimated_anchor_cost_upper_frames,
              anchor.anchor_cost_source,
            ]);
            const previous = observedAnchorCosts.get(anchor.anchor_gap_index);
            if (previous !== undefined && previous !== costIdentity) {
              throw new Error(`budget telemetry episode ${index} repair anchor costs disagree`);
            }
            observedAnchorCosts.set(anchor.anchor_gap_index, costIdentity);
          }
          observedDepths.add(anchor.parent_depth);
        }
      }
      const replayed = replayBudgetRepairSelection(decision);
      if (
        JSON.stringify(replayed.affordableTargetGapIndices) !==
          JSON.stringify(decision.affordable_target_gap_indices) ||
        JSON.stringify(replayed.affordableAnchorGapIndices) !==
          JSON.stringify(decision.affordable_anchor_gap_indices) ||
        replayed.targetGapIndex !== decision.target_gap_index ||
        replayed.parentDepth !== decision.parent_depth ||
        replayed.anchorGapIndex !== decision.anchor_gap_index ||
        replayed.targetGapSse !== decision.target_gap_sse ||
        replayed.mutableSuffixSse !== decision.mutable_suffix_sse ||
        replayed.estimatedAnchorCostFrames !== decision.estimated_anchor_cost_frames ||
        replayed.estimatedAnchorCostUpperFrames !== decision.estimated_anchor_cost_upper_frames ||
        replayed.anchorCostSource !== decision.anchor_cost_source
      ) {
        throw new Error(`budget telemetry episode ${index} repair selection is not replayable`);
      }
      if (work.terminal_node_evaluations > 1) {
        throw new Error(`budget telemetry episode ${index} repair evaluated more than one terminal`);
      }
      if (
        episode.working_target_gap_before === null ||
        episode.working_target_gap_before.gap_index !== decision.target_gap_index ||
        measuredGapStateSse(episode.working_target_gap_before) !== decision.target_gap_sse ||
        episode.incumbent_target_gap_before === null ||
        episode.incumbent_target_gap_before.gap_index !== decision.target_gap_index ||
        (decision.working_track_source === "global_incumbent" &&
          JSON.stringify(episode.working_target_gap_before) !==
            JSON.stringify(episode.incumbent_target_gap_before))
      ) {
        throw new Error(`budget telemetry episode ${index} repair target states are inconsistent`);
      }
      if (decision.working_track_source === "rejected_local_improvement") {
        const parent = episode.parent_episode_id === null
          ? null
          : payload.episodes[episode.parent_episode_id];
        if (
          parent === undefined ||
          parent.lane !== "repair" ||
          parent.outcome.accepted_alternative ||
          parent.outcome.terminal_offer_track_hash !== decision.working_track_hash ||
          parent.outcome.rejected_local_improvement_followup !== "scheduled"
        ) {
          throw new Error(`budget telemetry episode ${index} rejected-offer lineage is inconsistent`);
        }
      }
      if (decision.selection_policy === "worst_gap_repeated_rejection_step_later") {
        const previous = payload.episodes[index - 1];
        const previousDecision = previous?.repair_decision;
        if (
          previous?.lane !== "repair" ||
          previousDecision === null || previousDecision === undefined ||
          !previous.outcome.terminal_reached ||
          previous.outcome.accepted_alternative ||
          previousDecision.working_track_source !== "global_incumbent" ||
          decision.working_track_source !== "global_incumbent" ||
          previousDecision.incumbent_revision !== decision.incumbent_revision ||
          previousDecision.target_gap_index !== decision.target_gap_index ||
          previousDecision.anchor_gap_index + 1 !== decision.anchor_gap_index ||
          previousDecision.selection_policy === "worst_gap_repeated_rejection_step_later"
        ) {
          throw new Error(
            `budget telemetry episode ${index} repeated-rejection step-later lineage is inconsistent`,
          );
        }
      }
    } else if (
      episode.incumbent_target_gap_before !== null ||
      episode.working_target_gap_before !== null
    ) {
      throw new Error(`budget telemetry episode ${index} non-repair lane has repair target state`);
    }
    if (
      episode.outcome.working_to_offer_divergence !== null &&
      (episode.lane !== "repair" || !episode.outcome.terminal_reached)
    ) {
      throw new Error(`budget telemetry episode ${index} divergence has no repair terminal`);
    }
    if (episode.lane === "repair" && episode.outcome.terminal_reached &&
        episode.outcome.working_to_offer_divergence === null) {
      throw new Error(`budget telemetry episode ${index} repair terminal lacks divergence evidence`);
    }
    if (episode.outcome.working_to_offer_divergence !== null) {
      const divergence = episode.outcome.working_to_offer_divergence;
      if (
        !Number.isInteger(divergence.compared_gap_count) || divergence.compared_gap_count < 0 ||
        !Number.isInteger(divergence.divergent_gap_count) || divergence.divergent_gap_count < 0 ||
        !Number.isInteger(divergence.divergent_suffix_gap_count) ||
        divergence.divergent_suffix_gap_count < 0 ||
        divergence.divergent_suffix_gap_count > divergence.divergent_gap_count ||
        divergence.divergent_gap_count > divergence.compared_gap_count ||
        divergence.terminal_geometry_identical !== (divergence.divergent_gap_count === 0) ||
        (divergence.first_divergent_gap_index === null) !==
          (divergence.divergent_gap_count === 0) ||
        (divergence.first_divergent_gap_index !== null &&
          (!Number.isInteger(divergence.first_divergent_gap_index) ||
            divergence.first_divergent_gap_index < episode.anchor.gap_index ||
            divergence.first_divergent_gap_index >= divergence.compared_gap_count))
      ) {
        throw new Error(`budget telemetry episode ${index} repair divergence is inconsistent`);
      }
    }
    if (episode.lane === "repair") {
      const offerHash = episode.outcome.terminal_offer_track_hash;
      if (
        (offerHash === null) !== !episode.outcome.terminal_reached ||
        (offerHash !== null && !/^[a-f0-9]{64}$/.test(offerHash)) ||
        (episode.outcome.working_to_offer_divergence !== null && offerHash !== null &&
          episode.outcome.working_to_offer_divergence.terminal_geometry_identical !==
            (offerHash === episode.repair_decision!.working_track_hash))
      ) {
        throw new Error(`budget telemetry episode ${index} repair track identity is inconsistent`);
      }
    } else if (episode.outcome.terminal_offer_track_hash !== null) {
      throw new Error(`budget telemetry episode ${index} non-repair lane has a repair offer hash`);
    }
    const followup = episode.outcome.rejected_local_improvement_followup;
    if (
      ![
        "not_rejected_local_improvement",
        "no_affordable_repair",
        "eligible_policy_disabled",
        "optimistic_bound_cannot_beat_incumbent",
        "blocked_one_step_limit",
        "blocked_attempt_limit",
        "scheduled",
      ].includes(followup) ||
      (episode.lane !== "repair" && followup !== "not_rejected_local_improvement") ||
      (followup !== "not_rejected_local_improvement" && (
        !episode.outcome.terminal_reached ||
        episode.outcome.accepted_alternative ||
        measuredGapStateSse(episode.working_target_gap_before) === null ||
        measuredGapStateSse(episode.outcome.terminal_offer_target_gap) === null ||
        measuredGapStateSse(episode.outcome.terminal_offer_target_gap)! >=
          measuredGapStateSse(episode.working_target_gap_before)!
      ))
    ) {
      throw new Error(`budget telemetry episode ${index} rejected-offer follow-up is inconsistent`);
    }
    const bridgeAssessment = episode.outcome.rejected_local_improvement_bridge_assessment;
    if (bridgeAssessment === undefined) {
      throw new Error(`budget telemetry episode ${index} rejected-offer bridge assessment is missing`);
    }
    if (bridgeAssessment !== null) {
      const finiteUnit = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1;
      const expectedUpper = bridgeAssessment.scored_axis_observation_count === 0
        ? 1
        : Math.exp(-Math.sqrt(Math.max(
          0,
          bridgeAssessment.total_axis_sse - bridgeAssessment.mutable_suffix_axis_sse,
        ) / bridgeAssessment.scored_axis_observation_count) / AXIS_QUALITY_TOLERANCE);
      const expectedCanBeat = !(
        bridgeAssessment.incumbent_contract_passed &&
        bridgeAssessment.terminal_offer_contract_passed &&
        expectedUpper < bridgeAssessment.incumbent_axis_quality
      );
      if (
        bridgeAssessment.policy !== "optimistic_axis_quality_bound" ||
        !finiteUnit(bridgeAssessment.incumbent_axis_quality) ||
        !finiteUnit(bridgeAssessment.terminal_offer_axis_quality) ||
        !Number.isSafeInteger(bridgeAssessment.scored_axis_observation_count) ||
        bridgeAssessment.scored_axis_observation_count < 0 ||
        !Number.isFinite(bridgeAssessment.total_axis_sse) ||
        bridgeAssessment.total_axis_sse < 0 ||
        !Number.isFinite(bridgeAssessment.mutable_suffix_axis_sse) ||
        bridgeAssessment.mutable_suffix_axis_sse < 0 ||
        bridgeAssessment.mutable_suffix_axis_sse > bridgeAssessment.total_axis_sse + 1e-9 ||
        !finiteUnit(bridgeAssessment.optimistic_suffix_axis_quality_upper) ||
        Math.abs(bridgeAssessment.optimistic_suffix_axis_quality_upper - expectedUpper) > 1e-9 ||
        bridgeAssessment.bound_can_beat_incumbent !== expectedCanBeat ||
        (expectedCanBeat && followup !== "scheduled") ||
        (!expectedCanBeat && followup !== "optimistic_bound_cannot_beat_incumbent")
      ) {
        throw new Error(`budget telemetry episode ${index} rejected-offer bridge assessment is inconsistent`);
      }
    } else if (followup === "optimistic_bound_cannot_beat_incumbent") {
      throw new Error(`budget telemetry episode ${index} rejected-offer bridge assessment is missing`);
    }
    if (episode.lane === "repair") {
      const before = episode.incumbent_target_gap_before!;
      const offer = episode.outcome.terminal_offer_target_gap;
      const after = episode.outcome.incumbent_target_gap_after;
      if (
        after === null ||
        after.gap_index !== episode.repair_decision!.target_gap_index ||
        (offer !== null && offer.gap_index !== episode.repair_decision!.target_gap_index) ||
        (episode.outcome.accepted_alternative
          ? JSON.stringify(after) !== JSON.stringify(offer)
          : JSON.stringify(after) !== JSON.stringify(before))
      ) {
        throw new Error(`budget telemetry episode ${index} global target lineage is inconsistent`);
      }
      if (
        episode.repair_decision!.working_track_source === "rejected_local_improvement" &&
        followup === "scheduled"
      ) {
        throw new Error(`budget telemetry episode ${index} attempts to chain a protected bridge`);
      }
      if (followup === "scheduled") {
        const next = payload.episodes[index + 1];
        if (
          next?.lane !== "repair" ||
          next.parent_episode_id !== episode.episode_id ||
          next.repair_decision?.working_track_source !== "rejected_local_improvement" ||
          next.repair_decision.working_track_hash !== episode.outcome.terminal_offer_track_hash
        ) {
          throw new Error(`budget telemetry episode ${index} scheduled bridge has no exact child`);
        }
      }
    }
    if (
      (episode.outcome.first_register_improvement_offset_frames === null) !==
        (work.register_improvements === 0) ||
      (episode.outcome.final_register_improvement_offset_frames === null) !==
        (work.register_improvements === 0)
    ) {
      throw new Error(`budget telemetry episode ${index} improvement timing is inconsistent`);
    }
    if (
      (episode.outcome.first_terminal_register_improvement_offset_frames === null) !==
        (work.terminal_register_improvements === 0)
    ) {
      throw new Error(`budget telemetry episode ${index} terminal-improvement timing is inconsistent`);
    }
    if (
      episode.allocated_frames !==
        episode.ceiling_total_spent_frames - episode.start_total_spent_frames ||
      episode.available_hard_budget_frames !==
        Math.max(0, payload.compile.hard_budget_frames - episode.start_total_spent_frames)
    ) {
      throw new Error(`budget telemetry episode ${index} allocation accounting is open`);
    }
    const spent = episode.outcome.spent_frames;
    if (
      spent !== null &&
      spent !== (episode.outcome.end_total_spent_frames ?? 0) - episode.start_total_spent_frames
    ) {
      throw new Error(`budget telemetry episode ${index} spend does not close`);
    }
    if (spent !== null) {
      const offsets = [
        episode.outcome.first_terminal_offset_frames,
        episode.outcome.first_register_improvement_offset_frames,
        episode.outcome.final_register_improvement_offset_frames,
        episode.outcome.first_terminal_register_improvement_offset_frames,
      ].filter((value): value is number => value !== null);
      if (offsets.some((value) => !Number.isInteger(value) || value < 0 || value > spent)) {
        throw new Error(`budget telemetry episode ${index} timing lies outside episode spend`);
      }
    }
  }
  for (const key of [
    "ranked_option_calls",
    "requested_normal_proposals",
    "actual_candidate_samples",
    "viable_candidates",
    "nodes_processed",
    "nodes_expanded",
    "children_enqueued",
    "register_offers",
    "partial_node_evaluations",
    "terminal_node_evaluations",
    "first_time_terminal_node_evaluations",
    "revisited_terminal_node_evaluations",
    "register_improvements",
    "terminal_register_improvements",
  ] as const) {
    if (payload.compile.work[key] !== summedWork[key]) {
      throw new Error(`budget telemetry compile ${key} does not equal the episode sum`);
    }
  }
  for (const mode of new Set([
    ...Object.keys(payload.compile.work.candidate_samples_by_stream),
    ...Object.keys(summedWork.candidate_samples_by_stream),
  ])) {
    if (
      (payload.compile.work.candidate_samples_by_stream[mode] ?? 0) !==
        (summedWork.candidate_samples_by_stream[mode] ?? 0)
    ) {
      throw new Error(`budget telemetry compile candidate-mode accounting is open`);
    }
  }
  for (const origin of BUDGET_EVALUATION_ORIGINS) {
    for (const key of [
      "register_offers",
      "terminal_node_evaluations",
      "register_improvements",
      "terminal_register_improvements",
    ] as const) {
      if (
        payload.compile.work.by_evaluation_origin[origin][key] !==
          summedWork.by_evaluation_origin[origin][key]
      ) {
        throw new Error(`budget telemetry compile evaluation-origin accounting is open`);
      }
    }
  }
  if (
    payload.compile.work.terminal_node_evaluations !==
      payload.compile.work.distinct_terminal_tracks +
        payload.compile.work.repeated_terminal_track_evaluations
  ) {
    throw new Error(`budget telemetry compile terminal-track accounting is open`);
  }
  if (
    payload.compile.final_output_episode_id !== null &&
    payload.episodes[payload.compile.final_output_episode_id] === undefined
  ) {
    throw new Error(`budget telemetry final-output lineage is invalid`);
  }
  if (payload.compile.final_output_episode_id === null !== (payload.compile.final_output_lane === null)) {
    throw new Error(`budget telemetry final-output lineage nullability is inconsistent`);
  }
  if (payload.compile.final_output_episode_id !== null) {
    const episode = payload.episodes[payload.compile.final_output_episode_id]!;
    if (episode.lane !== payload.compile.final_output_lane || !episode.outcome.register_improved) {
      throw new Error(`budget telemetry final-output lineage does not name an improving episode`);
    }
  }
  if (
    payload.compile.hard_budget_frames + payload.compile.hard_overrun_frames !==
      payload.compile.total_spent_frames + payload.compile.hard_remaining_frames
  ) {
    throw new Error(`budget telemetry compile hard-budget accounting is open`);
  }
  let cursor = 0;
  for (const interval of payload.execution_intervals) {
    if (interval.start_total_spent_frames !== cursor) {
      throw new Error(`budget telemetry execution intervals are not contiguous`);
    }
    if (
      interval.spent_frames !==
        interval.end_total_spent_frames - interval.start_total_spent_frames
    ) {
      throw new Error(`budget telemetry execution-interval accounting is open`);
    }
    if (
      interval.episode_id !== null &&
      payload.episodes[interval.episode_id] === undefined
    ) {
      throw new Error(`budget telemetry execution interval references a missing episode`);
    }
    if (interval.kind === "unattributed" && !options.allowUnattributedInterval) {
      throw new Error(`budget telemetry closed payload contains unattributed work`);
    }
    cursor = interval.end_total_spent_frames;
  }
  if (cursor !== payload.compile.total_spent_frames) {
    throw new Error(`budget telemetry execution intervals do not cover compile spend`);
  }
  const terminalFrames = payload.episodes.flatMap((episode) => {
    const offset = episode.outcome.first_terminal_offset_frames;
    return offset === null ? [] : [episode.start_total_spent_frames + offset];
  });
  const attributedFirstTerminal = terminalFrames.length === 0 ? null : Math.min(...terminalFrames);
  if (payload.compile.first_terminal_total_spent_frames !== attributedFirstTerminal) {
    throw new Error(`budget telemetry first-terminal attribution is inconsistent`);
  }
  const improvingTerminalFrames = payload.episodes.flatMap((episode) => {
    const offset = episode.outcome.first_terminal_register_improvement_offset_frames;
    return offset === null ? [] : [episode.start_total_spent_frames + offset];
  });
  const attributedFirstImprovingTerminal = improvingTerminalFrames.length === 0
    ? null
    : Math.min(...improvingTerminalFrames);
  if (
    payload.compile.first_improving_terminal_total_spent_frames !==
      attributedFirstImprovingTerminal
  ) {
    throw new Error(`budget telemetry first-improving-terminal attribution is inconsistent`);
  }
  for (const [index, node] of (payload.node_events ?? []).entries()) {
    const episode = payload.episodes[node.episode_id];
    if (episode?.lane !== node.lane) {
      throw new Error(`budget telemetry node event ${index} attribution is inconsistent`);
    }
    if (
      node.spent_frames !==
        node.frontier_evaluation_frames + node.tail_completion_frames +
          node.post_tail_work_frames
    ) {
      throw new Error(`budget telemetry node event ${index} work accounting is open`);
    }
  }
}

function clampGapIndex(value: number, gapCount: number): number {
  const integer = Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.max(0, Math.min(integer, gapCount));
}

function nonNegativeInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
