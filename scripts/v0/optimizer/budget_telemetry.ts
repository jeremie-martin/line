/**
 * Observation-only compile-budget telemetry.
 *
 * This module deliberately owns no optimizer decisions. It reads charged work
 * and structural progress after they happen, then emits a versioned account of
 * the compile. Keeping the recorder separate makes it possible to prove that
 * enabling or disabling it does not change search order, RNG, or physics work.
 */

import type { Gap } from "../types.ts";
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

export const BUDGET_TELEMETRY_SCHEMA = "line.compile-budget-telemetry.v1" as const;

export type BudgetTelemetryLevel = "off" | "summary" | "trace";
export type BudgetAttemptKind = "initial" | "snapshot" | "repair" | "resumed";
/**
 * How `ceiling_total_spent_frames` was sized. This makes the repair tautology
 * visible in data: a `measured_cost_to_end` ceiling is the estimator's own
 * upper interval bound over the same costToEnd profile the estimator uses as
 * its path base, so a path-backed repair's `attempt_completion_margin` at its
 * own start is exactly the artifact's `start`/`withPath` upper ratio — the
 * sizing rule read back, not evidence about the estimator.
 */
export type BudgetAttemptCeilingSource =
  /** Compile hard budget: the initial and resumed frontiers may run to capture. */
  | "hard_budget"
  /** Upper interval bound over the incumbent's measured cost-to-end at the anchor. */
  | "measured_cost_to_end"
  /** No positive measured cost at the anchor; the coarse per-gap average was used instead. */
  | "per_gap_fallback"
  /** The sized ceiling reached or exceeded the repair budget and was clipped to it. */
  | "repair_budget_remaining";
export type BudgetSegmentKind =
  | "startup"
  | "initial_search"
  | "repair_attempt"
  | "resumed_search"
  | "finalization"
  | "unattributed";
export type BudgetAttemptStopReason =
  | "handoff_to_repair"
  | "budget_capture"
  | "local_ceiling"
  | "frontier_exhausted"
  | "first_completion_stop"
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
  /** Charged work since this attempt's start. */
  attempt_spent_frames: number;
  /** Work below this attempt's compile-global ceiling, clamped at zero. */
  attempt_remaining_frames: number;
  attempt_overrun_frames: number;
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
  /** attempt remaining / point estimate; null when the estimate is uncalibrated. */
  attempt_completion_margin: number | null;
  attempt_completion_surplus_frames: number;
};

export type BudgetAttemptTelemetry = {
  attempt_id: number;
  kind: BudgetAttemptKind;
  parent_attempt_id: number | null;
  search_seed: number;
  has_fallback: boolean;
  /**
   * Immutable suffix where this attempt began.
   *
   * A `resumed` attempt continues the initial attempt's own frontier, so it
   * reports that tree's root anchor. Its frontier is mixed-depth by
   * construction: anchor-relative quantities (structural progress, episode
   * pace, first-terminal offset) are approximate continuations of the initial
   * search, not fresh-start measurements.
   */
  anchor: RemainingStructure;
  /**
   * Which repair round produced this attempt; null on every other kind.
   *
   * A round is one pick of a weak gap. It can spend several attempts walking
   * the anchor upstream, so the attempt ordinal within a compile is NOT the
   * round index, and `docs/repair-selection-study.md` had to price by ordinal
   * for want of this field — an error worth a full point of spurious yield in
   * that study's own sensitivity check.
   */
  repair_round_index: number | null;
  /**
   * Gaps between the round's picked weak gap and this attempt's anchor, i.e.
   * `up` in `anchor = kWorst - up`. Null on every non-repair kind.
   *
   * With the round index it makes `maxUpstream` and `upstreamOrder` priceable:
   * the anchor alone cannot say whether it was chosen or walked to.
   */
  anchor_upstream_offset: number | null;
  /**
   * Σ axis-error² at the round's picked weak gap, in the incumbent report the
   * pick was actually made against. Null on every non-repair kind, and null if
   * that gap carried no reported axes.
   *
   * This is the ranking's own key at the moment it ranked. An archive records
   * the drift report at the END of the repair phase, so any replay of the
   * selection reads a weakness map that accepted repairs have already moved:
   * exact on zero-accept compiles, ~40% decision-1 agreement everywhere else.
   * This field is the fixed point of that comparison.
   */
  incumbent_weak_gap_sse: number | null;
  /** Compile-global work counters; local budget is ceiling - start. */
  start_total_spent_frames: number;
  ceiling_total_spent_frames: number;
  /** How the ceiling above was sized. */
  ceiling_source: BudgetAttemptCeilingSource;
  available_hard_budget_frames: number;
  local_budget_frames: number;
  start: BudgetEstimateObservation;
  end: BudgetEstimateObservation | null;
  observations?: BudgetEstimateObservation[];
  outcome: {
    stop_reason: BudgetAttemptStopReason | null;
    end_total_spent_frames: number | null;
    spent_frames: number | null;
    /** True iff this attempt considered at least one terminal traversal. */
    completed: boolean;
    /** Charged work from attempt start to its first terminal, not its end. */
    first_terminal_offset_frames: number | null;
    /** Whether a repair changed the best incumbent; null when not applicable. */
    accepted_improvement: boolean | null;
    /**
     * Charged work from attempt start to the first improvement the best-so-far
     * register adopted during this attempt. That leaf need not be terminal and
     * need not be the one that ended the attempt. Null when the attempt
     * produced no register improvement, and on attempt kinds that do not
     * measure it.
     */
    first_accepted_improvement_offset_frames: number | null;
    /** Incumbent full-score after this attempt minus before it; repair-only. */
    accepted_score_delta: number | null;
    /** True when no terminal cost was observed; such attempts are not error samples. */
    censored: boolean;
  };
};

export type BudgetExecutionSegment = {
  kind: BudgetSegmentKind;
  attempt_id: number | null;
  start_total_spent_frames: number;
  end_total_spent_frames: number;
  spent_frames: number;
  stop_reason: string;
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
     * domain. They are a structural, path-free estimate at the first attempt's
     * anchor, so they are `extrapolated_policy_budget` at any policy budget the
     * artifact was not fitted at. Null when no attempt was recorded.
     */
    initial_structural_applicability: BudgetEstimatorApplicability | null;
    /**
     * The compiler's own first-terminal work counter, independent of attempt
     * attribution. Null when no terminal traversal was considered.
     */
    first_terminal_total_spent_frames: number | null;
  };
  segments: BudgetExecutionSegment[];
  attempts: BudgetAttemptTelemetry[];
};

type MutableAttempt = BudgetAttemptTelemetry & {
  includeStartup: boolean;
  highWaterGap: number;
  nextSpendDecile: number;
  pathEstimateByGap: readonly number[] | null;
};

type StartAttemptInput = {
  kind: BudgetAttemptKind;
  parentAttemptId?: number | null;
  searchSeed: number;
  hasFallback: boolean;
  anchorGapIndex: number;
  startTotalSpentFrames: number;
  ceilingTotalSpentFrames: number;
  /** Defaults to `hard_budget`: the caller ran to the compile's outer limit. */
  ceilingSource?: BudgetAttemptCeilingSource;
  includeStartup: boolean;
  pathEstimateByGap?: readonly number[] | null;
  /** Repair-only causal context; see the fields of the same name on the record. */
  repairRoundIndex?: number | null;
  anchorUpstreamOffset?: number | null;
  incumbentWeakGapSse?: number | null;
};

type EndAttemptOutcome = {
  firstAcceptedImprovementOffsetFrames?: number | null;
  acceptedScoreDelta?: number | null;
};

/** Runtime recorder. All methods are deterministic arithmetic over supplied values. */
export class CompileBudgetTelemetryRecorder {
  readonly level: BudgetTelemetryLevel;
  private readonly gaps: readonly Gap[];
  private readonly durationFrames: number;
  private readonly hardBudgetFrames: number;
  private readonly policyBudgetFrames: number;
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
  private readonly attempts: MutableAttempt[] = [];
  private readonly segments: BudgetExecutionSegment[] = [];
  private activeAttemptId: number | null = null;

  constructor(input: {
    level: BudgetTelemetryLevel;
    gaps: readonly Gap[];
    durationFrames: number;
    hardBudgetFrames: number;
    policyBudgetFrames: number;
    model?: TraversalBudgetModel;
  }) {
    this.level = input.level;
    this.gaps = input.gaps;
    this.durationFrames = input.durationFrames;
    this.hardBudgetFrames = input.hardBudgetFrames;
    this.policyBudgetFrames = input.policyBudgetFrames;
    this.model = input.model ?? BUDGET_ESTIMATOR_TRAVERSAL_MODEL;
    this.structuralScale = budgetEstimatorStructuralScale(input.policyBudgetFrames);
  }

  startAttempt(input: StartAttemptInput): number | null {
    if (this.level === "off") return null;
    const attemptId = this.attempts.length;
    const anchorGap = clampGapIndex(input.anchorGapIndex, this.gaps.length);
    const startTotal = nonNegativeInt(input.startTotalSpentFrames);
    const ceilingTotal = Math.max(startTotal, nonNegativeInt(input.ceilingTotalSpentFrames));
    const mutable: MutableAttempt = {
      attempt_id: attemptId,
      kind: input.kind,
      parent_attempt_id: input.parentAttemptId ?? null,
      search_seed: input.searchSeed,
      has_fallback: input.hasFallback,
      anchor: remainingStructure(this.gaps, this.durationFrames, anchorGap),
      repair_round_index: finiteOrNull(input.repairRoundIndex),
      anchor_upstream_offset: finiteOrNull(input.anchorUpstreamOffset),
      incumbent_weak_gap_sse: finiteOrNull(input.incumbentWeakGapSse),
      start_total_spent_frames: startTotal,
      ceiling_total_spent_frames: ceilingTotal,
      ceiling_source: input.ceilingSource ?? "hard_budget",
      available_hard_budget_frames: Math.max(0, this.hardBudgetFrames - startTotal),
      local_budget_frames: ceilingTotal - startTotal,
      start: null as unknown as BudgetEstimateObservation,
      end: null,
      outcome: {
        stop_reason: null,
        end_total_spent_frames: null,
        spent_frames: null,
        completed: false,
        first_terminal_offset_frames: null,
        accepted_improvement: null,
        first_accepted_improvement_offset_frames: null,
        accepted_score_delta: null,
        censored: true,
      },
      includeStartup: input.includeStartup,
      highWaterGap: anchorGap,
      nextSpendDecile: 1,
      pathEstimateByGap: input.pathEstimateByGap ?? null,
      ...(this.level === "trace"
        ? { observations: [] as BudgetEstimateObservation[] }
        : {}),
    };
    this.attempts.push(mutable);
    this.activeAttemptId = attemptId;
    const observation = this.buildObservation(mutable, startTotal, anchorGap, "start");
    mutable.start = observation;
    mutable.observations?.push(observation);
    return attemptId;
  }

  observeActive(gapIndex: number, totalSpentFrames: number): void {
    const attempt = this.activeAttempt();
    if (attempt === null) return;
    const totalSpent = nonNegativeInt(totalSpentFrames);
    const nextGap = clampGapIndex(gapIndex, this.gaps.length);
    const advanced = nextGap > attempt.highWaterGap;
    if (advanced) attempt.highWaterGap = nextGap;
    if (this.level !== "trace") return;
    const attemptSpent = Math.max(0, totalSpent - attempt.start_total_spent_frames);
    const localBudget = attempt.local_budget_frames;
    const crossedSpend = localBudget > 0 &&
      attemptSpent * 10 >= localBudget * attempt.nextSpendDecile;
    if (!advanced && !crossedSpend) return;
    while (
      localBudget > 0 &&
      attempt.nextSpendDecile <= 10 &&
      attemptSpent * 10 >= localBudget * attempt.nextSpendDecile
    ) attempt.nextSpendDecile++;
    this.pushObservation(
      attempt,
      this.buildObservation(attempt, totalSpent, attempt.highWaterGap, advanced ? "high_water" : "spend"),
    );
  }

  markTerminal(totalSpentFrames: number, gapIndex: number): void {
    const attempt = this.activeAttempt();
    if (attempt === null || attempt.outcome.first_terminal_offset_frames !== null) return;
    const totalSpent = nonNegativeInt(totalSpentFrames);
    attempt.highWaterGap = Math.max(
      attempt.highWaterGap,
      clampGapIndex(gapIndex, this.gaps.length),
    );
    attempt.outcome.completed = true;
    attempt.outcome.censored = false;
    attempt.outcome.first_terminal_offset_frames = Math.max(
      0,
      totalSpent - attempt.start_total_spent_frames,
    );
    if (this.level === "trace") {
      this.pushObservation(
        attempt,
        this.buildObservation(attempt, totalSpent, attempt.highWaterGap, "terminal"),
      );
    }
  }

  endActive(
    totalSpentFrames: number,
    stopReason: BudgetAttemptStopReason,
    acceptedImprovement: boolean | null = null,
    outcome: EndAttemptOutcome = {},
  ): void {
    const attempt = this.activeAttempt();
    if (attempt === null) return;
    const totalSpent = nonNegativeInt(totalSpentFrames);
    const end = this.buildObservation(attempt, totalSpent, attempt.highWaterGap, "end");
    attempt.end = end;
    this.pushObservation(attempt, end);
    attempt.outcome.stop_reason = stopReason;
    attempt.outcome.end_total_spent_frames = totalSpent;
    attempt.outcome.spent_frames = Math.max(0, totalSpent - attempt.start_total_spent_frames);
    attempt.outcome.accepted_improvement = acceptedImprovement;
    attempt.outcome.first_accepted_improvement_offset_frames =
      finiteOrNull(outcome.firstAcceptedImprovementOffsetFrames);
    attempt.outcome.accepted_score_delta = finiteOrNull(outcome.acceptedScoreDelta);
    this.activeAttemptId = null;
  }

  recordSegment(
    kind: BudgetSegmentKind,
    startTotalSpentFrames: number,
    endTotalSpentFrames: number,
    stopReason: string,
    attemptId: number | null = null,
  ): void {
    if (this.level === "off") return;
    const start = nonNegativeInt(startTotalSpentFrames);
    const end = Math.max(start, nonNegativeInt(endTotalSpentFrames));
    this.segments.push({
      kind,
      attempt_id: attemptId,
      start_total_spent_frames: start,
      end_total_spent_frames: end,
      spent_frames: end - start,
      stop_reason: stopReason,
    });
  }

  snapshot(
    totalSpentFrames: number,
    budgetExhausted: boolean,
    firstTerminalTotalSpentFrames: number | null = null,
  ): CompileBudgetTelemetry | null {
    if (this.level === "off") return null;
    const totalSpent = nonNegativeInt(totalSpentFrames);
    const attempts = this.attempts.map((attempt) => this.snapshotAttempt(attempt, totalSpent));
    const segments = this.snapshotSegments(totalSpent);
    const initial = attempts[0];
    const initialStructural = initial?.start.structural_work_prior_frames ?? 0;
    return {
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
        total_spent_frames: totalSpent,
        hard_remaining_frames: Math.max(0, this.hardBudgetFrames - totalSpent),
        hard_overrun_frames: Math.max(0, totalSpent - this.hardBudgetFrames),
        budget_exhausted: budgetExhausted,
        initial_structural_work_prior_frames: initialStructural,
        initial_structural_slack: initialStructural > 0
          ? this.policyBudgetFrames / initialStructural
          : 0,
        // The two fields above are a path-free structural estimate, so they
        // inherit the structural domain: mark it rather than let a reader
        // assume the compile-scope numbers are calibrated everywhere.
        initial_structural_applicability: initial === undefined
          ? null
          : budgetEstimatorApplicability({
            pathAvailable: false,
            policyBudgetFrames: this.policyBudgetFrames,
            attemptKind: initial.kind,
          }),
        first_terminal_total_spent_frames: firstTerminalTotalSpentFrames === null
          ? null
          : nonNegativeInt(firstTerminalTotalSpentFrames),
      },
      segments,
      attempts,
    };
  }

  private activeAttempt(): MutableAttempt | null {
    return this.activeAttemptId === null ? null : this.attempts[this.activeAttemptId] ?? null;
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
    attempt: MutableAttempt,
    totalSpentFrames: number,
    highWaterGap: number,
    event: BudgetEstimateObservation["event"],
  ): BudgetEstimateObservation {
    const totalSpent = nonNegativeInt(totalSpentFrames);
    const structure = remainingStructure(this.gaps, this.durationFrames, highWaterGap);
    const structural = this.structuralWorkAt(
      highWaterGap,
      attempt.includeStartup && highWaterGap === attempt.anchor.gap_index,
    );
    const startStructural = this.structuralWorkAt(
      attempt.anchor.gap_index,
      attempt.includeStartup,
    );
    const progressedStructural = Math.max(0, startStructural - structural);
    const progressFraction = startStructural > 0
      ? clamp01(progressedStructural / startStructural)
      : 1;
    const attemptSpent = Math.max(0, totalSpent - attempt.start_total_spent_frames);
    const attemptRemaining = Math.max(0, attempt.ceiling_total_spent_frames - totalSpent);
    const pathRaw = attempt.pathEstimateByGap?.[structure.gap_index];
    // A zero cost-to-end is not a measurement of "no work left": the incumbent
    // profile writes zero whenever first completion did not post-date reaching
    // that node. The estimator's own selector treats non-positive paths as
    // absent, so admitting zero here would label a structural estimate
    // path-backed (and therefore `calibrated`) on no evidence.
    const pathEstimate = pathRaw !== undefined && pathRaw > 0 ? pathRaw : null;
    // Project this attempt's observed work per unit of structural progress over
    // the structural suffix still left. It is null until high water advances.
    const paceEstimate = progressedStructural > 0
      ? Math.max(0, attemptSpent * structural / progressedStructural)
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
      policyBudgetFrames: this.policyBudgetFrames,
      attemptKind: attempt.kind,
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
      attempt_spent_frames: attemptSpent,
      attempt_remaining_frames: attemptRemaining,
      attempt_overrun_frames: Math.max(0, totalSpent - attempt.ceiling_total_spent_frames),
      high_water: structure,
      structural_startup_included: attempt.includeStartup &&
        highWaterGap === attempt.anchor.gap_index,
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
      attempt_completion_margin: applicability === "calibrated" && estimated > 0
        ? attemptRemaining / estimated
        : null,
      attempt_completion_surplus_frames: attemptRemaining - estimated,
    };
  }

  private pushObservation(attempt: MutableAttempt, observation: BudgetEstimateObservation): void {
    if (this.level !== "trace" || attempt.observations === undefined) return;
    const previous = attempt.observations.at(-1);
    if (
      previous?.event === observation.event &&
      previous.total_spent_frames === observation.total_spent_frames &&
      previous.high_water.gap_index === observation.high_water.gap_index
    ) return;
    attempt.observations.push(observation);
  }

  private snapshotAttempt(attempt: MutableAttempt, totalSpent: number): BudgetAttemptTelemetry {
    const end = attempt.end ?? this.buildObservation(
      attempt,
      totalSpent,
      attempt.highWaterGap,
      "end",
    );
    const outcome = attempt.end === null
      ? {
        ...attempt.outcome,
        stop_reason: "budget_capture" as const,
        end_total_spent_frames: totalSpent,
        spent_frames: Math.max(0, totalSpent - attempt.start_total_spent_frames),
      }
      : { ...attempt.outcome };
    return {
      attempt_id: attempt.attempt_id,
      kind: attempt.kind,
      parent_attempt_id: attempt.parent_attempt_id,
      search_seed: attempt.search_seed,
      has_fallback: attempt.has_fallback,
      anchor: { ...attempt.anchor },
      repair_round_index: attempt.repair_round_index,
      anchor_upstream_offset: attempt.anchor_upstream_offset,
      incumbent_weak_gap_sse: attempt.incumbent_weak_gap_sse,
      start_total_spent_frames: attempt.start_total_spent_frames,
      ceiling_total_spent_frames: attempt.ceiling_total_spent_frames,
      ceiling_source: attempt.ceiling_source,
      available_hard_budget_frames: attempt.available_hard_budget_frames,
      local_budget_frames: attempt.local_budget_frames,
      start: structuredClone(attempt.start),
      end: structuredClone(end),
      ...(attempt.observations === undefined
        ? {}
        : { observations: structuredClone(attempt.observations) }),
      outcome,
    };
  }

  private snapshotSegments(totalSpent: number): BudgetExecutionSegment[] {
    const segments = this.segments.map((segment) => ({ ...segment }));
    const coveredEnd = segments.reduce(
      (max, segment) => Math.max(max, segment.end_total_spent_frames),
      0,
    );
    if (coveredEnd < totalSpent) {
      segments.push({
        kind: "unattributed",
        attempt_id: null,
        start_total_spent_frames: coveredEnd,
        end_total_spent_frames: totalSpent,
        spent_frames: totalSpent - coveredEnd,
        stop_reason: "snapshot_gap",
      });
    }
    return segments;
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
