/**
 * Observation-only compile-budget telemetry.
 *
 * This module deliberately owns no optimizer decisions. It reads charged work
 * and structural progress after they happen, then emits a versioned account of
 * the compile. Keeping the recorder separate makes it possible to prove that
 * enabling or disabling it does not change search order, RNG, or physics work.
 */

import type { Gap } from "../types.ts";
import {
  TRAVERSAL_BUDGET_MODEL_V1,
  type TraversalBudgetModel,
} from "./budget_model.ts";
import {
  BUDGET_ESTIMATOR_MODEL,
  BUDGET_ESTIMATOR_MODEL_FINGERPRINT,
  BUDGET_ESTIMATOR_TRAVERSAL_MODEL,
  budgetEstimateInterval,
  budgetEstimatorApplicability,
  estimateRemainingBudgetWork,
  type BudgetEstimatorApplicability,
} from "./budget_estimator.ts";

export const BUDGET_TELEMETRY_SCHEMA = "line.compile-budget-telemetry.v1" as const;

export type BudgetTelemetryLevel = "off" | "summary" | "trace";
export type BudgetAttemptKind = "initial" | "snapshot" | "repair";
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

export type RemainingStructure = {
  /** Next gap at the monotonic high-water boundary; gaps.length is terminal. */
  gap_index: number;
  /** Authored timeline frame at the boundary, not charged simulation work. */
  anchor_frame: number;
  remaining_gaps: number;
  /** Contact-ending gaps in the suffix. */
  remaining_contacts: number;
  /** Authored timeline frames from the boundary to spec duration. */
  remaining_duration_frames: number;
};

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
  /** Structure-only remaining-work estimate at high_water. */
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
  /** Immutable suffix where this attempt began. */
  anchor: RemainingStructure;
  /** Compile-global work counters; local budget is ceiling - start. */
  start_total_spent_frames: number;
  ceiling_total_spent_frames: number;
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
    /** policy budget / initial structural prior, fixed at compile start. */
    initial_structural_slack: number;
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
  includeStartup: boolean;
  pathEstimateByGap?: readonly number[] | null;
};

/** Runtime recorder. All methods are deterministic arithmetic over supplied values. */
export class CompileBudgetTelemetryRecorder {
  readonly level: BudgetTelemetryLevel;
  private readonly gaps: readonly Gap[];
  private readonly durationFrames: number;
  private readonly hardBudgetFrames: number;
  private readonly policyBudgetFrames: number;
  private readonly model: TraversalBudgetModel;
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
      start_total_spent_frames: startTotal,
      ceiling_total_spent_frames: ceilingTotal,
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

  snapshot(totalSpentFrames: number, budgetExhausted: boolean): CompileBudgetTelemetry | null {
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
      },
      segments,
      attempts,
    };
  }

  private activeAttempt(): MutableAttempt | null {
    return this.activeAttemptId === null ? null : this.attempts[this.activeAttemptId] ?? null;
  }

  private buildObservation(
    attempt: MutableAttempt,
    totalSpentFrames: number,
    highWaterGap: number,
    event: BudgetEstimateObservation["event"],
  ): BudgetEstimateObservation {
    const totalSpent = nonNegativeInt(totalSpentFrames);
    const structure = remainingStructure(this.gaps, this.durationFrames, highWaterGap);
    const structural = structuralRemainingWork(
      this.gaps,
      this.durationFrames,
      highWaterGap,
      attempt.includeStartup && highWaterGap === attempt.anchor.gap_index,
      this.model,
    );
    const startStructural = structuralRemainingWork(
      this.gaps,
      this.durationFrames,
      attempt.anchor.gap_index,
      attempt.includeStartup,
      this.model,
    );
    const progressedStructural = Math.max(0, startStructural - structural);
    const progressFraction = startStructural > 0
      ? clamp01(progressedStructural / startStructural)
      : 1;
    const attemptSpent = Math.max(0, totalSpent - attempt.start_total_spent_frames);
    const attemptRemaining = Math.max(0, attempt.ceiling_total_spent_frames - totalSpent);
    const pathRaw = attempt.pathEstimateByGap?.[structure.gap_index];
    const pathEstimate = pathRaw !== undefined && pathRaw >= 0 ? pathRaw : null;
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
    const calibratedInterval = budgetEstimateInterval(estimated, event);
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
      start_total_spent_frames: attempt.start_total_spent_frames,
      ceiling_total_spent_frames: attempt.ceiling_total_spent_frames,
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

export function remainingStructure(
  gaps: readonly Gap[],
  durationFrames: number,
  gapIndex: number,
): RemainingStructure {
  const anchor = clampGapIndex(gapIndex, gaps.length);
  const anchorFrame = anchor < gaps.length
    ? gaps[anchor].startFrame
    : durationFrames;
  const suffix = gaps.slice(anchor);
  return {
    gap_index: anchor,
    anchor_frame: anchorFrame,
    remaining_gaps: suffix.length,
    remaining_contacts: suffix.filter((gap) => gap.endsWithContact).length,
    remaining_duration_frames: Math.max(0, durationFrames - anchorFrame),
  };
}

/**
 * Structure-only remaining charged work:
 * startup intercept + contact coefficient * suffix contacts + duration
 * coefficient * suffix authored frames. Startup is included at most once.
 */
export function structuralRemainingWork(
  gaps: readonly Gap[],
  durationFrames: number,
  gapIndex: number,
  includeStartup: boolean,
  model: TraversalBudgetModel = TRAVERSAL_BUDGET_MODEL_V1,
): number {
  const structure = remainingStructure(gaps, durationFrames, gapIndex);
  if (
    structure.remaining_gaps === 0 &&
    structure.remaining_contacts === 0 &&
    structure.remaining_duration_frames === 0
  ) return 0;
  return Math.max(
    0,
    (includeStartup ? model.interceptFrames : 0) +
      model.contactFrames * structure.remaining_contacts +
      model.durationFrameScale * structure.remaining_duration_frames,
  );
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
