/**
 * Prefix hand-off search.
 *
 * The search state is a partial track prefix at a gap boundary, not a
 * regenerated whole track. It expands one gap at a time, keeps alternatives on
 * a deterministic DFS stack, and ranks candidates by a fixed local hand-off
 * feasibility probe:
 *
 *   "If we commit this catch, does the next contact remain reachable, and how
 *    much candidate slack does it have?"
 *
 * That probe is engine-in-loop and charged in sim-frames. Each call runs at one
 * scalar budget (an independent full run; the budget is the stop condition) and a
 * strict best-so-far register ranks every prefix output considered, returning the
 * best reached at that budget. The enforced contract is determinism per
 * (spec, seed, budget).
 *
 * WHAT READS THE BUDGET, as of 2026-08. The header used to claim the file was
 * NOT budget-aware, which invited "make it budget-aware" work on a system
 * already saturated with it. Two groups, and the difference between them is the
 * only thing a reader needs:
 *
 *  A. Reads that MOVE inside the range the compiler is promoted at (250k-1M):
 *     `budgetAwareQualitySampleCount` (the scale-free per-gap breadth law), the
 *     live slack/deadline signals (branch width, the paced forward-eval head,
 *     the repair stopping rule) and `maturityPressure` — asymptotic, not
 *     saturated, +35% relative travel from 250k to 750k, see its docstring.
 *     Every member is a law. The one benchmark-point-tuned ramp that used to
 *     sit in this group — `impactBestForwardEvalConfig`'s raw-budget factor
 *     (`IMPACT_BEST_FWD_START_FRAMES` 300k / span 200k, saturated at 500k) —
 *     was REMOVED on 2026-08-04 together with the double-counted budget
 *     coordinate it created; that arm now reads the budget exactly once, and
 *     only through the difficulty-conditioned slack. See its docstring.
 *
 *  B. Reads that are PINNED below 250k and are therefore constants wherever the
 *     benchmark decides, but are NOT dead, because they carry the scarce-budget
 *     completion behaviour the creative and study pipelines run in:
 *     `startBudgetPressure` (pinned at 100k), `continuousObjectiveCurrentPower`'s
 *     mature/scarce ramps (250k/225k), `qualityBreadth`'s two remaining shape
 *     rules (unreachable from 292k) and `matureForwardEvalConfig`'s budget ramp
 *     (`MATURE_AVG_FWD_EVAL_START_FRAMES` 35k, span 65k), which saturates at
 *     100k and so reads exactly 1 at every promoted budget. Shipping their
 *     mature branches unconditionally was MEASURED on golden v1 {75k,150k,225k}
 *     x 40 specs x 12 seeds and costs -7.6 (start + objective) and -3.1
 *     (breadth) mean score per run, with 236 and 24 new missing contacts at 75k
 *     respectively. They stay, documented, until someone writes a law for them.
 *
 * Deleted in 2026-08 for reading the budget outside that range AND measuring at
 * parity there: the repair feasibility margin (pinned at 200k), the four
 * benchmark-case-named quality-breadth rules (min-budget 200k/250k, parity at
 * the one tier they can fire) and `qualityFuturePreviewPressure` (dead at every
 * budget >= 75k). Two hard budget gates remain and are not ramps:
 * `usesForwardEvalAtBudget` at 75,000 frames, and `repairConfig().minBudget`
 * at 100,000 frames — below it no repair phase runs, so no measured
 * cost-to-end profile ever exists and the post-completion deadline margin
 * falls back to the structural suffix.
 */

import { createHash } from "node:crypto";
import { getRiderMetered, K_BOUNCE_LANDING } from "../../lib/detector.ts";
import { beginEnvFlagEpoch, compileScopedEnv } from "../env_flags.ts";
import { makeRng } from "../../lib/rng.ts";
import {
  type GapFit,
  type ResolvedStart,
  axesAtFrame,
  buildDriftReport,
  buildTrackJson,
  copyOptionalGapFitFields,
  effectiveAxes,
  engineLineFromTrackLine,
  makeBaseEngine,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
} from "../core/substrate.ts";
import {
  copyBallisticFitFields,
  type BallisticFitFields,
} from "../core/ballistic_projection.ts";
import {
  AXES,
  AXIS_VALUE_MAX,
  CALIB,
  FPS,
  HANDOFF_CANDIDATE_SOURCES,
  HANDOFF_EVALUATION_PHASES,
  IMPACT_WINDOW,
  ELEVATION,
  SPEED_AXIS,
  START_DEFAULTS,
  authoredSpeedToPx,
  speedPxToAuthored,
  PREROLL,
  REPORT_ONLY_AXIS_SET,
  frameToSec,
  secToFrame,
  type AxisName,
  type AxisValues,
  type BallisticPredictionErrorSummary,
  type CandidateSampleMode,
  type HandoffContactCountCounter,
  type HandoffEvaluationPhase,
  type HandoffEvaluationPhaseCounter,
  type Gap,
  type HandoffCandidateSourceName,
  type TrackLine,
} from "../types.ts";
import {
  attachHandoffScoreToProbe,
  axisLookaheadEndFrame,
  detectWindow,
  releaseSpeedPenalty,
  snapshotGapfitShortStats,
  snapshotReleaseExitStats,
  tryCandidate,
  translateTrackLines,
  tryCandidateLines,
} from "../core/candidate.ts";
import { pickLowestCost } from "./solver.ts";
import {
  AIM_LANE_DEADLINE_BASE_SHARE,
  getCandidatesSorted,
  extendNodeCached,
  isLeafNode,
  isRolloutAimSuppressed,
  makeRootNode,
  setAimLaneDeadlineThrottled,
  setRolloutAimSuppressed,
  setRolloutContext,
  type SearchNode,
} from "./node.ts";
import {
  candidateQualityObjective,
  setAimBaseFitReuseAllowed,
  setAimCompileBudgetFrames,
  setAimRepairLaneActive,
  snapshotAimStats,
  snapshotObjectiveLayerSpread,
} from "./aim.ts";
import { snapshotDetectorRunwayStats } from "./contact_phase.ts";
import {
  makeContactTransitionCandidates,
  recordContactTransitionBranchSelection,
  recordContactTransitionFinalTrack,
  snapshotContactTransitionStats,
} from "./contact_transition.ts";
import {
  isKinematicSupportCandidate,
  makeKinematicSupportCandidates,
  recordKinematicSupportContinuation,
  snapshotKinematicSupportStats,
} from "./kinematic_support.ts";
import {
  predictFirstCompletionFrames,
  traversalBudgetSlack,
  TRAVERSAL_BUDGET_MODEL_V1,
} from "./budget_model.ts";
import {
  BUDGET_ESTIMATOR_MODEL,
  budgetEstimateInterval,
  estimateRemainingBudgetWork,
  type BudgetEstimatorModelArtifact,
} from "./budget_estimator.ts";
import {
  CompileBudgetTelemetryRecorder,
  type BudgetEpisodeTelemetry,
  type BudgetInternalRegisterKey,
  type BudgetRepairDecision,
  type BudgetRepairDivergence,
  type BudgetRepairGapState,
  type BudgetRejectedLocalBridgeAssessment,
  type BudgetRepairTargetObservation,
  type BudgetTelemetryLevel,
} from "./budget_telemetry.ts";
import {
  CompileDeadline,
  deadlinePressure,
  underFullDeadlinePressure,
} from "./deadline.ts";
import {
  nextContactGap,
  nextContactGapIndex,
  projectOutgoingScorerGap,
  scoreNextArcReadiness,
  scoreSettledIncomingQuality,
  scorerGapFrameCount,
  setProposalUtilityPowers,
  settledIncomingAxes,
} from "./objective.ts";
import { IMPACT_TARGETED_ASK } from "./impact_policy.ts";
import {
  IMPACT_RESPONSE_MODEL_THRESHOLD_LOGIT,
  impactResponseModelLogit,
} from "./impact_response_model.ts";
import {
  AIR_DELIVERABILITY_DEADBAND,
  airDeliverabilityAsk,
} from "./air_policy.ts";
import { successorScorerGapAfter } from "./arc_proposal.ts";
import {
  AXIS_QUALITY_TOLERANCE,
  axisErrorsForTargets,
  axisQualityFromErrors,
  MISSING_CONTACT_TOLERANCE,
} from "../score.ts";
import { polishLeafVariant } from "./polish.ts";
import { getEngineRebuildCount } from "../core/polish.ts";
import { registerCompileReset, resetPerCompileState } from "../core/compile_lifecycle.ts";
import { supportExtensionPressure } from "../core/support_geometry.ts";
import { BestSoFarRegister, leafKeyForReport, type LeafKey } from "./register.ts";
import {
  optimisticAxisQualityUpper,
  parseRepairAxisBranchBoundMode,
  RepairAxisBranchBoundController,
} from "./repair_branch_bound.ts";
import { getSimFrames, refundSimFramesTo } from "./sim_frames.ts";
import { getMicroSimFrames } from "../core/ballistic_micro_sim.ts";
import {
  catchupAlternativeHasStablePriority,
  catchupAlternativeHasSufficientGain,
  parseFrontierTraversalPolicy,
  SELECTIVE_DEFERRED_PREFIX_GATE_CONTACT_HORIZON,
  SELECTIVE_DEFERRED_PREFIX_GATE_LOSS_DELTA,
  SELECTIVE_DEFERRED_VALUE_LIVE_ALLOWANCE_FRACTION,
  SELECTIVE_DEFERRED_VALUE_MAP_MAX_ALLOWANCE_FRACTION,
  SELECTIVE_PERIODIC_TERMINAL_RESERVE_FACTOR,
  SELECTIVE_VALUE_FIRST_CHECKPOINT_DEFICIT_STOP,
  SelectiveAxisRegretController,
  type FrontierTraversalLane,
  type SelectiveBacktrackDecision,
  type SelectiveCatchupProbeResult,
  type SelectiveDeferredValueAxisComparison,
  type SelectiveDeferredValueCheckpoint,
  type SelectiveDeferredValueDecision,
  valueExplorationBudgetFraction,
  valueProbeCandidateCountAtRoutePosition,
  valueProbeEmptyFallbackCandidateCount,
} from "./selective_backtracking.ts";
import {
  applyImpactWindowAccelerationAfterReference,
  setImpactCarrierRippleRepairActive,
  setImpactProfilePressures,
  setImpactTemplateSpecMeanImpact,
  snapshotArcPlacementStats,
} from "../arc_placement.ts";
import { makeSolidLine } from "../arc.ts";
import type { PrecontactMulticontactHistoryReady } from "../trajectory/precontact_multicontact_history.ts";
import {
  getCandidateProbe,
  getCandidateSamples,
  getCandidateSamplesByMode,
  getViableCandidates,
  sampleOneCandidate,
} from "./sample.ts";
import type { Candidate, SpecContext } from "./sample.ts";
import type {
  CompileCheckpoint,
  CompileOutput,
  CompileStats,
  DriftReport,
  Spec,
} from "./types.ts";

export type ImpactRepairInsuranceMode = "same-speed";

export type ImpactResponseAdmissionMode =
  | "exact-safe-8"
  | "exact-safe-all"
  | "exact-safe-8-admit"
  | "exact-safe-8-repair"
  | "exact-contact-all-repair"
  | "model-exact-contact-repair"
  | "cached-contact-repair"
  | "same-speed-tail-repair"
  | "same-speed-active-tail-repair"
  | "model-safe-08-admit"
  | "model-safe-08-post";
const readImpactResponseAdmission = compileScopedEnv("LR_IMPACT_RESPONSE_ADMISSION");
const readFrontierTraversalPolicy = compileScopedEnv("LR_FRONTIER_POLICY");

export function impactResponseAdmissionMode(
  environment?: Record<string, string | undefined>,
): ImpactResponseAdmissionMode | null {
  const value = environment === undefined
    ? readImpactResponseAdmission()
    : environment.LR_IMPACT_RESPONSE_ADMISSION;
  if (value === undefined || value === "" || value === "0" || value === "off") return null;
  if (
    value === "exact-safe-8" || value === "exact-safe-all" ||
    value === "exact-safe-8-admit" || value === "exact-safe-8-repair" ||
    value === "exact-contact-all-repair" || value === "model-exact-contact-repair" ||
    value === "cached-contact-repair" || value === "same-speed-tail-repair" ||
    value === "same-speed-active-tail-repair" ||
    value === "model-safe-08-admit" || value === "model-safe-08-post"
  ) return value;
  throw new Error(
    `LR_IMPACT_RESPONSE_ADMISSION must be off, exact-safe-8, exact-safe-all, ` +
      `exact-safe-8-admit, exact-safe-8-repair, exact-contact-all-repair, ` +
      `model-exact-contact-repair, cached-contact-repair, same-speed-tail-repair, ` +
      `same-speed-active-tail-repair, ` +
      `model-safe-08-admit, or model-safe-08-post; got ${value}`,
  );
}

type ImpactResponseAdmissionStats = NonNullable<CompileStats["impact_response_admission"]>;
const impactResponseAdmissionTotals: ImpactResponseAdmissionStats = {
  eligible_pools: 0,
  prefiltered_candidates: 0,
  response_probes: 0,
  response_probe_frames: 0,
  safe_candidates: 0,
  already_admitted: 0,
  inserted: 0,
  branch_reserved: 0,
  final_selected: 0,
  impact_error_gain_sum: 0,
  settled_quality_gain_sum: 0,
  model_candidates_scored: 0,
  model_candidates_admitted: 0,
  contact_retention_rejects: 0,
  active_repair_probes: 0,
  active_repair_probe_frames: 0,
  active_repair_viable: 0,
  active_repair_interaction_passed: 0,
  active_repair_material_lines: 0,
  active_repair_final_lines: 0,
};
let impactResponseAdmittedCandidates = new WeakSet<Candidate>();

function resetImpactResponseAdmissionStats(): void {
  for (const key of Object.keys(impactResponseAdmissionTotals) as Array<keyof ImpactResponseAdmissionStats>) {
    impactResponseAdmissionTotals[key] = 0;
  }
  impactResponseAdmittedCandidates = new WeakSet<Candidate>();
}
registerCompileReset(resetImpactResponseAdmissionStats);

function snapshotImpactResponseAdmissionStats(): ImpactResponseAdmissionStats | null {
  return impactResponseAdmissionMode() === null && impactResponseAdmissionTotals.eligible_pools === 0
    ? null
    : { ...impactResponseAdmissionTotals };
}

export function impactRepairInsuranceMode(
  environment: Record<string, string | undefined> = process.env,
): ImpactRepairInsuranceMode | null {
  const value = environment.LR_IMPACT_REPAIR_INSURANCE;
  if (value === undefined || value === "" || value === "0" || value === "off") return null;
  if (value === "1" || value === "same-speed") return "same-speed";
  throw new Error(`LR_IMPACT_REPAIR_INSURANCE must be off or same-speed; got ${value}`);
}

type ImpactRepairInsuranceStats = NonNullable<CompileStats["impact_repair_insurance"]>;
const impactRepairInsuranceTotals: ImpactRepairInsuranceStats = {
  eligible_pools: 0,
  specialist_available: 0,
  specialist_already_selected: 0,
  specialist_inserted: 0,
  final_selected: 0,
  suppressed_by_reserved_branch: 0,
  impact_error_gain_sum: 0,
  speed_error_delta_sum: 0,
  displaced_score_delta_sum: 0,
};
let impactRepairInsuredCandidates = new WeakSet<Candidate>();

function resetImpactRepairInsuranceStats(): void {
  for (const key of Object.keys(impactRepairInsuranceTotals) as Array<keyof ImpactRepairInsuranceStats>) {
    impactRepairInsuranceTotals[key] = 0;
  }
  impactRepairInsuredCandidates = new WeakSet<Candidate>();
}
registerCompileReset(resetImpactRepairInsuranceStats);

function snapshotImpactRepairInsuranceStats(): ImpactRepairInsuranceStats | null {
  return impactRepairInsuranceMode() === null && impactRepairInsuranceTotals.eligible_pools === 0
    ? null
    : { ...impactRepairInsuranceTotals };
}

export type CompileHandoffOptions = {
  /** Simulated-frame budget for this run. One scalar budget = one independent full
   *  run from scratch; pass multiple budgets by calling N times (see
   *  `compileBudgetCurve`). The budget is the stop condition and also feeds the
   *  explicit smooth spend-control policy. */
  budget: number;
  /** Optional hard node cap for diagnostic probes. Production leaves this unset and
   *  is bounded by the frame budget alone (a default runaway backstop applies). */
  maxNodes?: number;
  /** Clone-and-test polish variants for each prefix considered. Default false. */
  polish?: boolean;
  /** Diagnostic/research hook: keep the public seed's target jitter fixed while
   *  changing only search sampling/start lookahead. Defaults to `seed`, so normal
   *  compiler behavior is unchanged. */
  searchSeed?: number;
  /** Diagnostic/research hook: resolve budget-aware search policy and its
   *  repair-allocation phase at a lower ceiling, then spend any remaining hard
   *  `budget` on the preserved main frontier. Defaults to `budget`, so normal
   *  compiler behavior is unchanged. */
  policyBudget?: number;
  /** Diagnostic/research hook: budget coordinate used only to resolve search
   *  shape (breadth, branching, forward evaluation and tail policy). When
   *  absent, inherits `policyBudget ?? budget`. */
  searchPolicyBudget?: number;
  /** Diagnostic/research hook: compile-global ceiling available to aimed
   *  repair. When absent, inherits `policyBudget ?? budget`. */
  repairBudget?: number;
  /** Diagnostic/research hook for the post-repair main frontier. Production
   *  defaults to the historical unconditional atomic resume. */
  resumePolicy?: "legacy" | "none" | "remainder-aware";
  /** Policy-neutral budget characterization. Summary is compact and default;
   * trace additionally retains high-water and spend-decile observations. */
  budgetTelemetry?: BudgetTelemetryLevel;
  /** Study hook: stop as soon as the first full-duration traversal is considered.
   *  This isolates path quality from post-completion search and repair budget. */
  stopAfterFirstCompletion?: boolean;
  /** Study hook: run only one option from the start evaluator's sorted list.
   *  Production leaves this unset and traverses the normal option list. */
  startOptionRank?: number;
  /** Test hook: called for each prefix output offered to the register. */
  onNode?: (node: HandoffNode, key: LeafKey, event: HandoffNodeEvent) => void;
};

export type HandoffNode = {
  search: SearchNode;
  startState: ResolvedStart;
  startLines: TrackLine[];
  startRank: number;
  /** Candidate-sampling seed for this prefix's downstream search lane. */
  searchSeed: number;
  startExpanded: boolean;
  deferExpansion: boolean;
  /** Per-gap selected candidate trace. `rank=-1` means a skipped
   *  contact/non-contact gap; otherwise `rank` is the sorted candidate rank. */
  rankTrace: HandoffRankTraceEntry[];
  skippedContacts: number;
};

export type HandoffCandidateSource = HandoffCandidateSourceName | "skip";

export type HandoffRankTraceEntry = {
  rank: number;
  source: HandoffCandidateSource;
  /** Registered axis-quality stream axis when `source === "axisq"`. */
  sourceAxis?: AxisName;
};

export type HandoffNodeEventPhase = HandoffEvaluationPhase;

export type HandoffNodeEvent = {
  phase: HandoffNodeEventPhase;
  simFrames: number;
  fullDuration: boolean;
  outputDurationFrames: number;
  improved: boolean;
  improvementCount: number;
  consideredCount: number;
};

export type HandoffNodeSnapshot = {
  node: HandoffNode;
  key: LeafKey;
  event: HandoffNodeEvent;
};

type RankedOption = {
  candidate: Candidate | null;
  child: SearchNode;
  rank: number;
  source: HandoffCandidateSource;
  sourceAxis?: AxisName;
  score: number;
  previewContacts: number;
  previewSurvivors: number;
  forwardContinuation?: boolean;
};

export type RepairSuffixSearchPolicy =
  | "ordinary"
  | "target_top_three_first"
  | "target_improvement_first"
  | "target_eligible_first";

type RepairTargetSearchTotals = {
  policy: RepairSuffixSearchPolicy;
  targetPools: number;
  eligibleOptions: number;
  ordinarySelectedOptions: number;
  alreadyFirst: number;
  reordered: number;
  promotedFromOutsideTopThree: number;
  ordinaryFirstImprovesIncumbent: number;
  ordinaryFirstNotImproving: number;
  improvingAlternativeAvailable: number;
  ordinaryFirstSseSum: number;
  chosenFirstSseSum: number;
  localSseGainSum: number;
  forwardScoreDebtSum: number;
};

export type HandoffPoolProbeCandidate = {
  qualityRank: number;
  lineLength: number;
  lineCount: number;
  meanSegmentLength: number;
  minSegmentLength: number;
  maxSegmentLength: number;
  totalTurnDeg: number;
  cost: number;
  achieved: AxisValues;
  qualityObjective: number | null;
  currentQuality: number;
  readiness: number | null;
  catchability: number | null;
  speedFit: number | null;
  impactFeasibility: number | null;
  airFit: number | null;
  elevationFit: number | null;
  releaseFrame: number | null;
  releaseElapsedFrames: number | null;
  catchWindowGroundedFrames: number | null;
  releaseDisplacement: number | null;
  releaseSpeed: number | null;
  releaseVx: number | null;
  releaseVy: number | null;
  releaseGrounded: number | null;
  releaseAirborne: boolean | null;
  arrivalSpeed: number | null;
  arrivalAngleDeg: number | null;
  arrivalAir: number | null;
  arrivalGapFrames: number | null;
  arrivalElevation: number | null;
  admitted: boolean;
  handoffScore?: number;
};

/**
 * Exact, candidate-owned contact exposure over the three-frame impact
 * neighborhood.  This is observation-only telemetry for the impact frontier
 * probe: it records the engine's native point classes rather than inferring
 * them from the sampled geometry.
 */
export type HandoffPoolProbeCollisionCounts = {
  peg: number;
  sledZeroFriction: number;
  bodyHighFriction: number;
  handsLowFriction: number;
  feetZeroFriction: number;
  total: number;
};

export type HandoffPoolProbeCollisionWindow = {
  before: HandoffPoolProbeCollisionCounts;
  target: HandoffPoolProbeCollisionCounts;
  after: HandoffPoolProbeCollisionCounts;
};

/** Exact candidate geometry and full-sled state at the target collision frame.
 * This is deliberately a lazy, post-completion observer surface: it exists
 * for fixed diagnostic studies, never for candidate generation or selection. */
export type HandoffPoolProbeContactGeometry = {
  lines: Array<{ id: number; x1: number; y1: number; x2: number; y2: number }>;
  points: Partial<Record<"PEG" | "TAIL" | "NOSE" | "STRING", {
    x: number;
    y: number;
    vx: number | null;
    vy: number | null;
  }>>;
  targetContacts: Array<{ lineId: number; pointIds: string[] }>;
};

/** Exact full-sled state and candidate-owned sled collisions over the canonical
 * response window. Like target geometry, this is a lazy post-completion study
 * surface and is never read by live compiler traversal. */
export type HandoffPoolProbeContactResponse = {
  samples: Array<{
    frame: number;
    points: Partial<Record<"PEG" | "TAIL" | "NOSE" | "STRING", {
      x: number;
      y: number;
      vx: number | null;
      vy: number | null;
    }>>;
    sledContacts: Array<{ lineId: number; pointIds: string[] }>;
  }>;
};

export type HandoffPoolProbeRecord = {
  gapIndex: number;
  entrySpeed: number;
  precontactHistory: PrecontactMulticontactHistoryReady | null;
  targets: AxisValues;
  nextTargets: AxisValues | null;
  candidates: HandoffPoolProbeCandidate[];
  /**
   * Lazily reconstructs one exact candidate-owned collision window.  Keeping
   * this as a callback means the normal compiler pays no cost unless a probe
   * asks about a material pair, and the callback cannot affect selection.
   */
  collisionWindowAtQualityRank: (qualityRank: number) => HandoffPoolProbeCollisionWindow | null;
  /**
   * Lazy exact target-frame geometry for contact-manifold diagnostics. Like the
   * collision callback, callers must resolve it only after compile completion.
   */
  contactGeometryAtQualityRank: (qualityRank: number) => HandoffPoolProbeContactGeometry | null;
  /** Lazy exact response-window replay for candidate-evolution diagnostics. */
  contactResponseAtQualityRank: (qualityRank: number) => HandoffPoolProbeContactResponse | null;
};

type HandoffPoolProbeHook = (record: HandoffPoolProbeRecord) => void;
let handoffPoolProbeHook: HandoffPoolProbeHook | null = null;

const ZERO_FRICTION_SLED_PROBE_POINTS = new Set(["TAIL", "NOSE", "STRING"]);
const HIGH_FRICTION_BODY_PROBE_POINTS = new Set(["BUTT", "SHOULDER"]);
const LOW_FRICTION_HAND_PROBE_POINTS = new Set(["RHAND", "LHAND"]);
const ZERO_FRICTION_FOOT_PROBE_POINTS = new Set(["LFOOT", "RFOOT"]);

/** Observation-only pool hook. Production never installs one. */
export function setHandoffPoolProbeHook(hook: HandoffPoolProbeHook | null): void {
  handoffPoolProbeHook = hook;
}

function emptyHandoffPoolProbeCollisionCounts(): HandoffPoolProbeCollisionCounts {
  return {
    peg: 0,
    sledZeroFriction: 0,
    bodyHighFriction: 0,
    handsLowFriction: 0,
    feetZeroFriction: 0,
    total: 0,
  };
}

/**
 * Replays no alternate geometry: this is the exact candidate line set on its
 * already-existing prefix, queried only after handoff scoring is complete.
 * The engine update API is observational, so this cannot influence the
 * candidate, pool, rank, or frame charge.
 */
function candidateOwnedCollisionWindow(
  prefixEngine: any,
  candidate: Candidate,
  gap: Gap,
): HandoffPoolProbeCollisionWindow | null {
  try {
    const engine = prefixEngine.addLine(candidate.lines.map(engineLineFromTrackLine));
    if (typeof engine?.getUpdatesAtFrame !== "function") return null;
    const candidateLineIds = new Set(candidate.lines.map((line) => line.id));
    const countAt = (frame: number): HandoffPoolProbeCollisionCounts => {
      const counts = emptyHandoffPoolProbeCollisionCounts();
      const updates = engine.getUpdatesAtFrame(Math.max(0, frame));
      if (!Array.isArray(updates)) return counts;
      for (const update of updates) {
        const record = update as { id?: unknown; updated?: unknown };
        if (typeof record.id !== "number" || !candidateLineIds.has(record.id) || !Array.isArray(record.updated)) continue;
        for (const entry of record.updated) {
          const point = (entry as { id?: unknown } | null)?.id;
          if (typeof point !== "string") continue;
          counts.total++;
          if (point === "PEG") counts.peg++;
          else if (ZERO_FRICTION_SLED_PROBE_POINTS.has(point)) counts.sledZeroFriction++;
          else if (HIGH_FRICTION_BODY_PROBE_POINTS.has(point)) counts.bodyHighFriction++;
          else if (LOW_FRICTION_HAND_PROBE_POINTS.has(point)) counts.handsLowFriction++;
          else if (ZERO_FRICTION_FOOT_PROBE_POINTS.has(point)) counts.feetZeroFriction++;
        }
      }
      return counts;
    };
    return {
      before: countAt(gap.endFrame - 1),
      target: countAt(gap.endFrame),
      after: countAt(gap.endFrame + 1),
    };
  } catch {
    return null;
  }
}

/**
 * Replays the already-scored candidate once after traversal so a study can
 * relate exact multi-point state to its native line geometry. The normal
 * compiler never calls this function; keeping it lazy avoids cache reads from
 * changing a live search.
 */
function candidateOwnedContactGeometry(
  prefixEngine: any,
  candidate: Candidate,
  gap: Gap,
): HandoffPoolProbeContactGeometry | null {
  try {
    const engine = prefixEngine.addLine(candidate.lines.map(engineLineFromTrackLine));
    if (typeof engine?.getUpdatesAtFrame !== "function" || typeof engine?.getRider !== "function") return null;
    const candidateLineIds = new Set(candidate.lines.map((line) => line.id));
    const updates = engine.getUpdatesAtFrame(Math.max(0, gap.endFrame));
    const targetContacts: Array<{ lineId: number; pointIds: string[] }> = [];
    if (Array.isArray(updates)) {
      for (const update of updates) {
        const record = update as { id?: unknown; updated?: unknown };
        if (typeof record.id !== "number" || !candidateLineIds.has(record.id) || !Array.isArray(record.updated)) continue;
        const pointIds = record.updated
          .map((entry) => (entry as { id?: unknown } | null)?.id)
          .filter((point): point is string => typeof point === "string");
        if (pointIds.length > 0) targetContacts.push({ lineId: record.id, pointIds });
      }
    }
    const rider = engine.getRider(Math.max(0, gap.endFrame));
    const points: HandoffPoolProbeContactGeometry["points"] = {};
    for (const name of ["PEG", "TAIL", "NOSE", "STRING"] as const) {
      const point = rider?.get?.(name);
      const position = point?.pos as { x?: unknown; y?: unknown } | undefined;
      const velocity = (point?.vel ?? point?.velocity) as { x?: unknown; y?: unknown } | undefined;
      if (
        typeof position?.x !== "number" || !Number.isFinite(position.x) ||
        typeof position?.y !== "number" || !Number.isFinite(position.y)
      ) continue;
      points[name] = {
        x: position.x,
        y: position.y,
        vx: typeof velocity?.x === "number" && Number.isFinite(velocity.x) ? velocity.x : null,
        vy: typeof velocity?.y === "number" && Number.isFinite(velocity.y) ? velocity.y : null,
      };
    }
    return {
      lines: candidate.lines.map((line) => ({ id: line.id, x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2 })),
      points,
      targetContacts,
    };
  } catch {
    return null;
  }
}

function candidateOwnedContactResponse(
  prefixEngine: any,
  candidate: Candidate,
  gap: Gap,
  metered = false,
): HandoffPoolProbeContactResponse | null {
  try {
    const engine = prefixEngine.addLine(candidate.lines.map(engineLineFromTrackLine));
    return candidateOwnedContactResponseOnEngine(engine, candidate, gap, metered);
  } catch {
    return null;
  }
}

/** Read a candidate response from the engine that already owns its lines. */
function candidateOwnedContactResponseOnEngine(
  engine: any,
  candidate: Candidate,
  gap: Gap,
  metered = false,
): HandoffPoolProbeContactResponse | null {
  try {
    if (typeof engine?.getUpdatesAtFrame !== "function" || typeof engine?.getRider !== "function") return null;
    const candidateLineIds = new Set(candidate.lines.map((line) => line.id));
    const samples: HandoffPoolProbeContactResponse["samples"] = [];
    for (let frame = gap.endFrame; frame <= gap.endFrame + IMPACT_WINDOW; frame++) {
      const rider = metered
        ? getRiderMetered(engine, Math.max(0, frame))
        : engine.getRider(Math.max(0, frame));
      const points: HandoffPoolProbeContactResponse["samples"][number]["points"] = {};
      for (const name of ["PEG", "TAIL", "NOSE", "STRING"] as const) {
        const point = rider?.get?.(name);
        const position = point?.pos as { x?: unknown; y?: unknown } | undefined;
        const velocity = (point?.vel ?? point?.velocity) as { x?: unknown; y?: unknown } | undefined;
        if (
          typeof position?.x !== "number" || !Number.isFinite(position.x) ||
          typeof position?.y !== "number" || !Number.isFinite(position.y)
        ) continue;
        points[name] = {
          x: position.x,
          y: position.y,
          vx: typeof velocity?.x === "number" && Number.isFinite(velocity.x) ? velocity.x : null,
          vy: typeof velocity?.y === "number" && Number.isFinite(velocity.y) ? velocity.y : null,
        };
      }
      const updates = engine.getUpdatesAtFrame(Math.max(0, frame));
      const sledContacts: Array<{ lineId: number; pointIds: string[] }> = [];
      if (Array.isArray(updates)) {
        for (const update of updates) {
          const record = update as { id?: unknown; updated?: unknown };
          if (typeof record.id !== "number" || !candidateLineIds.has(record.id) || !Array.isArray(record.updated)) continue;
          const pointIds = record.updated
            .map((entry) => (entry as { id?: unknown } | null)?.id)
            .filter((point): point is string => typeof point === "string" &&
              (point === "PEG" || point === "TAIL" || point === "NOSE" || point === "STRING"));
          if (pointIds.length > 0) sledContacts.push({ lineId: record.id, pointIds });
        }
      }
      samples.push({ frame, points, sledContacts });
    }
    return { samples };
  } catch {
    return null;
  }
}

type CandidateContactResponseSummary = {
  collectiveSpeedDelta: number;
  rmsPairDistanceChange: number;
  rmsRelativeVelocityChange: number;
  absPhaseSlipDeg: number;
  candidateOwnedSledContactFrames: number;
  candidateOwnedSledUpdateCount: number;
  candidateOwnedSledPointCoverage: number;
};

function summarizeCandidateContactResponse(
  response: HandoffPoolProbeContactResponse | null,
): CandidateContactResponseSummary | null {
  if (response === null || response.samples.length < 2) return null;
  const snapshots = response.samples.map((sample) => {
    const points = (["PEG", "TAIL", "NOSE", "STRING"] as const).map((name) => sample.points[name]);
    if (points.some((point) => point === undefined || point.vx === null || point.vy === null)) return null;
    const readable = points as Array<NonNullable<typeof points[number]>>;
    const centerVelocity = {
      x: readable.reduce((sum, point) => sum + point.vx! / readable.length, 0),
      y: readable.reduce((sum, point) => sum + point.vy! / readable.length, 0),
    };
    const relativeVelocities = readable.map((point) => ({
      x: point.vx! - centerVelocity.x,
      y: point.vy! - centerVelocity.y,
    }));
    const pairDistances: number[] = [];
    for (let left = 0; left < readable.length; left++) {
      for (let right = left + 1; right < readable.length; right++) {
        pairDistances.push(Math.hypot(
          readable[left]!.x - readable[right]!.x,
          readable[left]!.y - readable[right]!.y,
        ));
      }
    }
    const tail = readable[1]!;
    const nose = readable[2]!;
    return {
      velocity: centerVelocity,
      relativeVelocities,
      pairDistances,
      pose: Math.atan2(nose.y - tail.y, nose.x - tail.x),
    };
  });
  if (snapshots.some((snapshot) => snapshot === null)) return null;
  const first = snapshots[0]!;
  const last = snapshots[snapshots.length - 1]!;
  if (first === null || last === null) return null;
  const angleDelta = (from: number, to: number): number => {
    let delta = to - from;
    while (delta <= -Math.PI) delta += 2 * Math.PI;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    return delta;
  };
  const collectiveTurn = angleDelta(
    Math.atan2(first.velocity.y, first.velocity.x),
    Math.atan2(last.velocity.y, last.velocity.x),
  );
  const poseTurn = angleDelta(first.pose, last.pose);
  const rms = (values: readonly number[]): number => Math.sqrt(
    values.reduce((sum, value) => sum + value * value / values.length, 0),
  );
  const contactedPoints = new Set<string>();
  let candidateOwnedSledContactFrames = 0;
  let candidateOwnedSledUpdateCount = 0;
  for (const sample of response.samples) {
    let contacted = false;
    for (const contact of sample.sledContacts) {
      for (const pointId of contact.pointIds) {
        contactedPoints.add(pointId);
        candidateOwnedSledUpdateCount++;
        contacted = true;
      }
    }
    if (contacted) candidateOwnedSledContactFrames++;
  }
  return {
    collectiveSpeedDelta: Math.hypot(last.velocity.x, last.velocity.y) -
      Math.hypot(first.velocity.x, first.velocity.y),
    rmsPairDistanceChange: rms(last.pairDistances.map((distance, index) =>
      distance - first.pairDistances[index]!
    )),
    rmsRelativeVelocityChange: rms(last.relativeVelocities.map((velocity, index) =>
      Math.hypot(
        velocity.x - first.relativeVelocities[index]!.x,
        velocity.y - first.relativeVelocities[index]!.y,
      )
    )),
    absPhaseSlipDeg: Math.abs((poseTurn - collectiveTurn) * 180 / Math.PI),
    candidateOwnedSledContactFrames,
    candidateOwnedSledUpdateCount,
    candidateOwnedSledPointCoverage: contactedPoints.size,
  };
}

export function responseSafeImpactTransition(
  incumbent: CandidateContactResponseSummary,
  candidate: CandidateContactResponseSummary,
): boolean {
  return candidate.collectiveSpeedDelta >= incumbent.collectiveSpeedDelta - .05 &&
    candidate.rmsPairDistanceChange <= incumbent.rmsPairDistanceChange + .05 &&
    candidate.rmsRelativeVelocityChange <= incumbent.rmsRelativeVelocityChange + .05 &&
    candidate.absPhaseSlipDeg <= incumbent.absPhaseSlipDeg + 3;
}

/**
 * A response-safe impact repair must also retain the native carrier's actual
 * multi-contact work.  Counts are exact candidate-line collision updates over
 * the same H..H+6 window as the state certificate; no geometry proxy or point
 * identity is substituted for an engine-owned update.
 */
export function responseRetainsCandidateContact(
  incumbent: CandidateContactResponseSummary,
  candidate: CandidateContactResponseSummary,
): boolean {
  return candidate.candidateOwnedSledContactFrames >= incumbent.candidateOwnedSledContactFrames &&
    candidate.candidateOwnedSledUpdateCount >= incumbent.candidateOwnedSledUpdateCount &&
    candidate.candidateOwnedSledPointCoverage >= incumbent.candidateOwnedSledPointCoverage;
}

export type HandoffCapacityProbeRecord = {
  gapIndex: number;
  simFrames: number;
  source: HandoffCandidateSource;
  rank: number;
  cost: number;
  capacity: number;
};

type HandoffCapacityProbeHook = (record: HandoffCapacityProbeRecord) => void;
let handoffCapacityProbeHook: HandoffCapacityProbeHook | null = null;

/** Diagnostic-only exact continuation-capacity hook. Production never installs one. */
export function setHandoffCapacityProbeHook(hook: HandoffCapacityProbeHook | null): void {
  handoffCapacityProbeHook = hook;
}

export type HandoffRankedOptionProbeEntry = {
  source: HandoffCandidateSource;
  rank: number;
  score: number;
  cost: number | null;
  lineCount: number | null;
  lineLength: number | null;
  forwardContinuation: boolean | null;
  achieved: AxisValues | null;
};

export type HandoffRankedOptionsProbeRecord = {
  gapIndex: number;
  simFrames: number;
  /** Options after the production eligibility filter, in production rank order. */
  eligible: HandoffRankedOptionProbeEntry[];
  /** Entries returned to traversal after the production branch-selection rule. */
  selected: HandoffRankedOptionProbeEntry[];
};

type HandoffRankedOptionsProbeHook = (record: HandoffRankedOptionsProbeRecord) => void;
let handoffRankedOptionsProbeHook: HandoffRankedOptionsProbeHook | null = null;

/** Observation-only ranked-option hook. Production never installs one. */
export function setHandoffRankedOptionsProbeHook(hook: HandoffRankedOptionsProbeHook | null): void {
  handoffRankedOptionsProbeHook = hook;
}

// ── Rollout-economics probe (MEASURE-ONLY; production installs no hook) ──
// docs/rollout-economics-study.md. Every rollout the compiler charges reports
// where its frames went and how it ended. Guarded by a null check on the hook,
// so an uninstrumented compile pays one comparison per rollout and nothing else
// — the `--verify-identity` arm of `study_rollout_economics.ts` proves it.
export type HandoffRolloutOutcome =
  /** Depth remained but there was no further contact to place (terminal prefix). */
  | "no_hop"
  /** The FIRST rolled contact produced no candidate AND the width+1 re-draw did
   *  not find one either — the SURVIVING hop-1 dead-end verdict. Pre-L1 this
   *  class was the whole empty-at-base-width population, so post-L1 the
   *  comparable quantity against `docs/rollout-economics-study.md` §1.2 is
   *  `dead_hop1 + dead_hop1_refuted`. */
  | "dead_hop1"
  /** Empty at the shape's own width, then REFUTED by `redrawFirstHopOnEmpty`:
   *  the extra draw found candidates and the rollout carried on. Sticky — it
   *  overrides whatever the deeper hops then did, because "the one-sample
   *  verdict was false" is the fact this population exists to report and it
   *  must not disappear into `full`. `hopFrames`/`hopsPlaced` still carry the
   *  full trace for anyone who wants the deeper outcome. */
  | "dead_hop1_refuted"
  /** Hop 1 placed; the SECOND rolled contact produced no candidate (no re-draw
   *  runs below hop 1, so this class is unchanged by L1). */
  | "dead_hop2"
  /** Hop 1 placed; the prefix reached its last contact before hop 2. */
  | "end_hop2"
  /** The configured depth was rolled in full. */
  | "full"
  /** A branched shape (best/avg/first-widened): frames only, no hop trace. */
  | "branched";

export type HandoffRolloutProbeRecord = {
  /** Gap index of the DFS node whose pool this rollout prices. -1 for start selection. */
  gapIndex: number;
  /** Pre-sort (quality-objective) rank of the priced candidate; -1 for start selection. */
  rank: number;
  source: HandoffCandidateSource | "start";
  variant: ForwardEvalVariant;
  /** Configured rollout depth (1 when the pace prune shallowed it). */
  depth: number;
  branch: number;
  /** First-level width of the greedy first-widened shape (`impactBestForwardEvalConfig`),
   *  1 for every other shape. Without it `greedy:2:1` conflates the plain default
   *  with the widened arm that is 62.8% of all rollout frames — the two are the
   *  same (variant, depth, branch). */
  firstBranch: number;
  outcome: HandoffRolloutOutcome;
  /** THE L1 TRIGGER. The rollout's first hop was empty at the shape's own width
   *  and `redrawFirstHopOnEmpty` ran. True for branched shapes too, where the
   *  hop trace (and therefore the outcome class) is unavailable. */
  hop1Redrawn: boolean;
  /** ...and the extra draw found candidates: the verdict was overturned at the
   *  source. `hop1Redrawn && !hop1Refuted` is the residual dead-end verdict —
   *  the population `fwd_rollout_no_candidate` still counts. */
  hop1Refuted: boolean;
  /** Rolled contacts that actually committed a candidate. */
  hopsPlaced: number;
  /** Total sim-frames the rollout charged. */
  frames: number;
  /** Sim-frames per hop (pool build + commit), outermost first. */
  hopFrames: number[];
  value: number;
  hasCompletion: boolean;
  targetBudget: number;
  simFramesAtStart: number;
  /** The node the rollout declared unable to continue (dead_hop1/dead_hop2 only). */
  deadNode: SearchNode | null;
  /** The FIRST rolled contact node, whatever the verdict — the join key for the
   *  realized-search confusion matrix (alive row as well as dead row). */
  hop1Node: SearchNode | null;
  /** Live context for a truth check at `deadNode`; never retained by the compiler. */
  gaps: Gap[] | null;
  ctx: SpecContext | null;
  seed: number;
};

type HandoffRolloutProbeHook = (record: HandoffRolloutProbeRecord) => void;
let handoffRolloutProbeHook: HandoffRolloutProbeHook | null = null;

/** Observation-only rollout hook. Production never installs one. */
export function setHandoffRolloutProbeHook(hook: HandoffRolloutProbeHook | null): void {
  handoffRolloutProbeHook = hook;
}

type RolloutTrace = {
  hopFrames: number[];
  hopsPlaced: number;
  outcome: HandoffRolloutOutcome;
  deadNode: SearchNode | null;
  hop1Node: SearchNode | null;
};
let rolloutTrace: RolloutTrace | null = null;
/** The three post-L1 first-hop states, as seen by `redrawFirstHopOnEmpty`:
 *  "none" = the first hop was never empty at the shape's own width (no trigger);
 *  "refuted" = empty, then the width+1 draw found candidates;
 *  "residual" = empty, and the width+1 draw found nothing either.
 *  Written only while a rollout probe hook is installed, reset at each rollout
 *  entry point, read once in the same synchronous call. */
type RolloutRedrawState = "none" | "refuted" | "residual";
let rolloutRedrawState: RolloutRedrawState = "none";
type RolloutProbeContext = {
  gapIndex: number;
  rank: number;
  source: HandoffCandidateSource | "start";
  hasCompletion: boolean;
  targetBudget: number;
};
const START_ROLLOUT_CONTEXT: RolloutProbeContext = {
  gapIndex: -1,
  rank: -1,
  source: "start",
  hasCompletion: false,
  targetBudget: 0,
};
let rolloutProbeContext: RolloutProbeContext = START_ROLLOUT_CONTEXT;

/** Observation-only: the search genuinely arrived at `node` and built its real pool.
 *  Joined against the rollout verdicts by node identity (`extendNodeCached` memoizes,
 *  so the node the rollout judged IS the node the search later expands). */
export type HandoffExpansionProbeRecord = {
  node: SearchNode;
  gapIndex: number;
  poolCandidates: number;
  hasCompletion: boolean;
  nCand: number;
  repairLane: boolean;
  repairAnchorGapIndex: number | null;
};

type HandoffExpansionProbeHook = (record: HandoffExpansionProbeRecord) => void;
let handoffExpansionProbeHook: HandoffExpansionProbeHook | null = null;

/** Observation-only expansion hook. Production never installs one. */
export function setHandoffExpansionProbeHook(hook: HandoffExpansionProbeHook | null): void {
  handoffExpansionProbeHook = hook;
}

export type HandoffFrontierProbeNode = {
  gapIndex: number;
  /** The choice that entered this node, if it came from an ordinary ranked pool. */
  enteringRank: number | null;
};

export type HandoffFrontierProbeRecord = {
  simFrames: number;
  hasCompletion: boolean;
  deepestSeenGap: number;
  selected: HandoffFrontierProbeNode;
  passFrontier: HandoffFrontierProbeNode[];
  fallbackFrontier: HandoffFrontierProbeNode[];
};

type HandoffFrontierProbeHook = (record: HandoffFrontierProbeRecord) => void;
let handoffFrontierProbeHook: HandoffFrontierProbeHook | null = null;

/** Observation-only frontier-order hook. Production never installs one. */
export function setHandoffFrontierProbeHook(hook: HandoffFrontierProbeHook | null): void {
  handoffFrontierProbeHook = hook;
}

export type HandoffFrontierNodeProbeRecord = {
  simFrames: number;
  hasCompletion: boolean;
  deepestSeenGap: number;
  selected: HandoffNode;
  passFrontier: readonly HandoffNode[];
  fallbackFrontier: readonly HandoffNode[];
};

type HandoffFrontierNodeProbeHook = (record: HandoffFrontierNodeProbeRecord) => void;
let handoffFrontierNodeProbeHook: HandoffFrontierNodeProbeHook | null = null;

/** Diagnostic-only access to actual deferred nodes. Production never installs one. */
export function setHandoffFrontierNodeProbeHook(hook: HandoffFrontierNodeProbeHook | null): void {
  handoffFrontierNodeProbeHook = hook;
}

export type HandoffDeadEndProbeRecord = {
  node: HandoffNode;
  simFrames: number;
  hasCompletion: boolean;
  deepestSeenGap: number;
};

type HandoffDeadEndProbeHook = (record: HandoffDeadEndProbeRecord) => void;
let handoffDeadEndProbeHook: HandoffDeadEndProbeHook | null = null;

/** Observation-only failed-expansion hook. Production never installs one. */
export function setHandoffDeadEndProbeHook(hook: HandoffDeadEndProbeHook | null): void {
  handoffDeadEndProbeHook = hook;
}

/**
 * What the one deadline signal did at one pool build: the margin it read and
 * every decision that read it. Everything here is already computed by the
 * search — the probe only reports it — so the mechanism can be priced (ramp
 * engagement per budget, throttle activations, how much of the narrowing
 * happens after first completion) without a `CompileStats` field.
 */
export type HandoffDeadlineProbeRecord = {
  simFrames: number;
  gapIndex: number;
  hasCompletion: boolean;
  margin: number;
  pressure: number;
  poolSize: number;
  forwardEvalTop: number;
  aimLaneThrottled: boolean;
  /** This build happened inside a repair restart (`runFrontierFrom`). The two
   *  post-completion lanes — repair episodes vs the main/resumed frontier —
   *  answer the head ramp's phase-weight question differently, and this is the
   *  only place the split is visible. */
  repairLane: boolean;
  onlineContinuationApplied: boolean;
  /** How many ranked options the online-continuation filter DROPPED at this
   *  build; 0 unless `onlineContinuationApplied`. This is the population the
   *  filter acts on — the only one whose verdict truth is a live question. */
  onlineContinuationPruned: number;
  /** The verdict node behind each dropped option: the next-contact node whose
   *  memoized pool read empty. Live objects the compiler does not retain, so a
   *  probe can re-draw there on a cache-isolated copy. Empty unless the filter
   *  applied. Built inside the hook guard — an uninstrumented compile does not
   *  walk them. */
  onlineContinuationPrunedNodes: SearchNode[];
  /** Context for that probe; the compiler already holds both. */
  gaps: Gap[];
  ctx: SpecContext;
  seed: number;
};

type HandoffDeadlineProbeHook = (record: HandoffDeadlineProbeRecord) => void;
let handoffDeadlineProbeHook: HandoffDeadlineProbeHook | null = null;

/** Observation-only deadline hook. Production never installs one. */
export function setHandoffDeadlineProbeHook(hook: HandoffDeadlineProbeHook | null): void {
  handoffDeadlineProbeHook = hook;
}

type HandoffSearchPolicy = {
  nCand: number;
  /** Value-probe-only extension of an empty narrowed normal pool. The cached
   * sample prefix makes this incremental; ordinary traversal leaves it unset. */
  normalEmptyFallbackNCand?: number;
  preview: boolean;
  axisQualitySearch: boolean;
  releaseSetup: boolean;
  budgetSlack: number;
  branchLimit: number;
  reuseLimit: number;
  tailBranching: number;
  forwardStageTop: number;
  /** Live deadline margin at this node (optimizer/deadline.ts). Unlike the
   *  paced slack it replaced it stays finite and meaningful after first
   *  completion — the SIGNAL runs the whole compile. Which consumers act on it
   *  there is a separate question, currently answered by the Phase-1a boundary
   *  in `rankedOptions`. */
  deadlineMargin: number;
  /** Slack-conditioned pre-completion rollout depth (2026-07-16). The 250k
   *  capability invalids sit at the completion knee (valid first completions
   *  at 242-260k frames of a 250k budget), and forward-eval charges ~30% of
   *  all frames. When the search holds NO completion AND the traversal budget
   *  model predicts the budget is tight (budgetSlack below the same low-slack
   *  threshold the branch limiter already uses), the greedy rollout is
   *  shallowed to depth 1 — still the exact engine judge at roughly half the
   *  rollout charge. Ordinary compiles (slack ≥ 1.7 at 250k) and mature
   *  budgets (slack ~2 at 500k) never engage it, which removes exactly the
   *  mature-trunk drag that retired the unconditional depth-1 form.
   *  LR_PRECOMPLETION_FWD_EVAL=1 forces full depth everywhere. */
  forwardEval: boolean;
};

type NumericAccumulator = {
  count: number;
  sum: number;
  min: number;
  max: number;
};

type StartOption = {
  rank: number;
  start: NonNullable<Spec["start"]>;
  state: ResolvedStart;
  startLines: TrackLine[];
  root: SearchNode;
};

type StartSeed = {
  start: NonNullable<Spec["start"]>;
  startLines: TrackLine[];
  supportDelayFrames?: number;
};

type HandoffTelemetry = {
  frontierSelections: number;
  farBackPulses: number;
  nodesExpanded: number;
  frontierMaxSize: number;
  deepestSeenGap: number;
  firstProgressFrame: number | null;
  hasCompletion: boolean;
  partialEvaluations: number;
  fullEvaluations: number;
  evaluationsByPhase: Record<HandoffNodeEventPhase, number>;
  fullEvaluationsByPhase: Record<HandoffNodeEventPhase, number>;
  improvementsByPhase: Record<HandoffNodeEventPhase, number>;
  duplicateEvaluations: number;
  duplicateFullEvaluations: number;
  duplicateEvaluationsByPhase: Record<HandoffNodeEventPhase, number>;
  duplicateFullEvaluationsByPhase: Record<HandoffNodeEventPhase, number>;
  tailCompletionAttempts: number;
  tailCompletionSuccesses: number;
  tailCompletionImprovements: number;
  tailCompletionAttemptsByRemainingContacts: Record<number, number>;
  tailCompletionSuccessesByRemainingContacts: Record<number, number>;
  tailCompletionImprovementsByRemainingContacts: Record<number, number>;
  /** Every actual rankedOptions build, including rescue and tail completion. */
  candidatePoolRequests: NumericAccumulator;
  valueProbeEmptyFullWidthRetryAttempts: number;
  valueProbeEmptyFullWidthRetrySuccesses: number;
  valueProbeEmptyFullWidthRetryRequestedProposals: number;
  valueProbeEmptyFullWidthRetryIncrementalRequestedProposals: number;
  valueProbeEmptyFullWidthRetryCandidateGeometryEvaluations: number;
  valueProbeEmptyFullWidthRetryFrames: number;
  /** Primary frontier policy only; retained for the legacy compile_stats summary. */
  policyNCand: NumericAccumulator;
  policyBranchLimit: NumericAccumulator;
  previews: number;
  previewContacts: number;
  previewSurvivors: number;
  reuseAttempts: number;
  reuseSuccesses: number;
  brakeAttempts: number;
  brakeSuccesses: number;
  startupAttempts: number;
  startupSuccesses: number;
  axisQualityAttempts: number;
  axisQualitySuccesses: number;
  axisQualityAttemptsByAxis: Partial<Record<AxisName, number>>;
  axisQualitySuccessesByAxis: Partial<Record<AxisName, number>>;
  candidateReleaseCoverage: CandidateReleaseCoverageAccumulator;
  candidatePreviewCoverage: CandidatePreviewCoverageAccumulator;
  rescueAttempts: number;
  rescueSuccesses: number;
  skips: number;
  deferredSkips: number;
  startRanksSeen: Set<number>;
  startRanksWithFits: Set<number>;
};

type CandidateReleaseCoverageAccumulator = {
  count: number;
  speedCount: number;
  speedSum: number;
  speedSquareSum: number;
  speedMin: number;
  speedMax: number;
  velocityYCount: number;
  velocityYSum: number;
  velocityYSquareSum: number;
  velocityYMin: number;
  velocityYMax: number;
  groundedCount: number;
  groundedSum: number;
  groundedMin: number;
  groundedMax: number;
  zeroGroundedCount: number;
  airborneAtReleaseCount: number;
};

type CandidatePreviewCoverageAccumulator = {
  count: number;
  zeroFirstSurvivors: number;
  firstSurvivorSum: number;
  firstSurvivorMin: number;
  firstSurvivorMax: number;
};

type HandoffAdmittedCandidate = {
  candidate: Candidate;
  rank: number;
};

type HandoffFrontierStats = Pick<
  CompileStats,
  | "handoff_frontier_size"
  | "handoff_pass_frontier_size"
  | "handoff_fallback_frontier_size"
  | "handoff_frontier_min_gap"
  | "handoff_frontier_max_gap"
  | "handoff_deepest_seen_gap"
  | "handoff_frontier_oldest_gap_lag"
  | "handoff_frontier_mean_gap_lag"
  | "handoff_frontier_far_back_count"
>;

type NodeEvaluation = {
  report: DriftReport;
  key: LeafKey;
  outputDurationFrames: number;
  fullDuration: boolean;
};

type ConsiderResult = {
  key: LeafKey;
  event: HandoffNodeEvent;
};

type ExtraCandidateCache = {
  reuseK?: number;
  reuse?: Candidate[];
  brakeSeed?: number;
  brake?: Candidate[];
  supportKey?: string;
  support?: Candidate[];
};


const extraCandidateCache = new WeakMap<SearchNode, ExtraCandidateCache>();

// Production runs are bounded by the FRAME BUDGET, not a node cap — the budget is the
// effort knob, so a fixed node ceiling must not silently override it. When no explicit
// `maxNodes` is given the backstop is DERIVED from the budget: `max(floor, budget)`.
// A healthy search charges many sim-frames per node (a catch simulates dozens-hundreds
// of frames), so node count is a small fraction of the frame budget (worst canonical
// spec ≈672 nodes @200k ≈ 0.003 nodes/frame). Capping at ~budget nodes therefore never
// binds a legitimate run (≈300× headroom) yet bounds a pathological 0-frame-charging
// loop at ~budget nodes (seconds) instead of an unbounded hang. The floor covers tiny
// budgets; diagnostic probes still pass an explicit small `maxNodes`.
const MAX_NODES_FLOOR = 50_000;
/**
 * How many sampled candidates a gap admits to its pool.
 *
 * The pool's own per-candidate PREVIEW is a charged simulation, so this is the
 * accepted forward-eval prune one layer down: with the rolled head at 2 and
 * `HANDOFF_BRANCHING` at 3, a pool of eight paid preview cost for candidates the
 * search could neither rank honestly nor expand.
 *
 * Bracketed at N=8 against `readiness-catch-impact`: 3 gives +1.83, 4 gives
 * -3.54 (capability -34.8), **5 gives +3.32**, 6 gives +2.28, 8 is the shipped
 * value. Five is an interior optimum and the only rung with every stratum and
 * every budget positive.
 */
const HANDOFF_CANDIDATE_POOL = 5;
/**
 * How many of the PRE-SORTED pool are worth a charged forward rollout when the
 * compile is not on course to finish. `0` disables the prune.
 *
 * Forward evaluation refines an ordering the pool already has: eight candidates
 * arrive sorted by the free local cost and `HANDOFF_BRANCHING` = 3 are expanded,
 * yet all eight pay a charged rollout. Pruning to the head unconditionally is
 * worth +9.86 at N=8 on its own — capability +126.56, validity 1012 -> 1027 with
 * none lost, 500k and 750k both reaching 352 of 352 — but it costs
 * `representative` 10.31 and `legacy_regression` 19.12, concentrated on the
 * LOW-AIR family that needs breadth to find a long grounded ride-out.
 *
 * Both halves are one fact: a narrow roll is a deeper search and a wide roll is
 * a broader one, and the two populations want opposite things. So the width
 * follows the compile's deadline margin (optimizer/deadline.ts) — full while it
 * is on course to finish, the head once the budget it has left no longer covers
 * the work it has left.
 *
 * The floor has its own interior optimum here: 0 is -4.59 (capability -31.76),
 * 1 is +0.89, 2 shipped, 3 is -1.25. It is also the retention the aim lane
 * mirrors under the same pressure (node.ts `AIM_LANE_DEADLINE_BASE_SHARE`):
 * 2 of `HANDOFF_CANDIDATE_POOL`.
 *
 * The ramp's own endpoints moved with the signal and now live in margin units
 * next to their derivation (`DEADLINE_MARGIN_FULL_PRESSURE`,
 * `DEADLINE_MARGIN_NO_PRESSURE`). The 2026-07-28 bracket of the old paced-slack
 * endpoints (start 2.0 is -1.56, full 0.7 is -2.53, tightening to 1.2 is +1.30
 * at N=8 but only +0.42 at N=24) is a STALE sweep: it measured a different
 * quantity's scale, not this one's.
 */
const HANDOFF_FORWARD_EVAL_TOP = 2;
// The aim lane is held to the same retention share under full deadline
// pressure (node.ts docstring: "the same rule as the rolled forward-eval
// head"). node.ts cannot import these constants without a module cycle, so
// the invariant is enforced here, once, at load: re-tune either pool constant
// and this throws instead of silently splitting the two consumers.
if (AIM_LANE_DEADLINE_BASE_SHARE !== HANDOFF_FORWARD_EVAL_TOP / HANDOFF_CANDIDATE_POOL) {
  throw new Error(
    "node.ts AIM_LANE_DEADLINE_BASE_SHARE must equal " +
      "HANDOFF_FORWARD_EVAL_TOP / HANDOFF_CANDIDATE_POOL " +
      `(${HANDOFF_FORWARD_EVAL_TOP}/${HANDOFF_CANDIDATE_POOL}); ` +
      "re-derive both together (see node.ts aimLaneBases docstring)",
  );
}
const HANDOFF_BRANCHING = 3;
const HANDOFF_LOW_SLACK_BRANCH_THRESHOLD = 1.5;

/** The half-point of the shared maturity scale (`maturityPressure`): the budget
 *  at which `B / (B + scale)` reads 0.5, before the smoothstep. Three consumers
 *  — the mature reuse extra, the shallow-tail throttle and the tail-completion
 *  window — and nothing else; the quality-breadth lean and the future-preview
 *  pressure this comment used to also name have since been deleted.
 *
 *  This is a SCALE, not a threshold or an offset, and it is not shared with the
 *  other 150,000s that used to sit next to it: the objective exponent's
 *  `mature`/`scarce` ramp anchors were separately-meant constants that happened
 *  to carry the same number, and they were deleted with those ramps rather than
 *  folded onto this one. */
const HANDOFF_MATURITY_BUDGET_SCALE_FRAMES = 150_000;
const OBJECTIVE_CURRENT_MATURE_START_FRAMES = 150_000;
const OBJECTIVE_CURRENT_MATURE_SPAN_FRAMES = 100_000;
const OBJECTIVE_CURRENT_SCARCE_END_FRAMES = 150_000;
const OBJECTIVE_CURRENT_SCARCE_SPAN_FRAMES = 75_000;
const OBJECTIVE_CURRENT_BASE_POWER = 1;
const OBJECTIVE_CURRENT_MAX_POWER = 2.5;
const OBJECTIVE_CURRENT_POWER_ACTIVATION_EPSILON = 0.02;
const M87_LOW_IMPACT_SPARSE_MEDIAN_GAP_FRAMES = Math.round(FPS * 0.90);
const M87_LOW_IMPACT_STEADY_AIR_RANGE_MAX = 0.16;
const M87_LOW_IMPACT_STEADY_SPEED_RANGE_MAX = 0.18;
const M94_LOW_IMPACT_CONTACT_MAX = 24;
const M94_LOW_IMPACT_MEDIAN_GAP_MAX_FRAMES = 40;
const M94_LOW_IMPACT_AMPLITUDE_RANGE_MAX = 0.20;

/** Candidates sampled per gap by the handoff search. The handoff ranks only a
 *  bounded pool by feasibility and branches 3-wide, so sampling the full default
 *  pool is mostly wasted per-node work that starves bounded-budget exploration.
 *  The pre-impact board's 24-sample sweet spot shifted once `Contact.impact`
 *  became scored: harder catch geometry is often present later in the
 *  deterministic batch, and the true-score forward ranker can use the extra pool.
 *  LR_QUALITY_NCAND overrides this unified breadth for controlled studies. */
const HANDOFF_QUALITY_N_CAND = 32;
const HANDOFF_QUALITY_SHORT_NO_AMP_MAX_CONTACTS = 32;
const HANDOFF_QUALITY_SHORT_NO_AMP_BOOST_N_CAND = 34;
const HANDOFF_QUALITY_VARIATION_RELIEF_AIR_RANGE = 0.50;
const HANDOFF_QUALITY_VARIATION_RELIEF_SPEED_RANGE = 0.40;
/** The scale-free per-gap breadth law: `N_CAND_AT_REF` candidates at
 *  `REF_FRAMES`, growing LINEARLY in budget with no ceiling. (It shipped at
 *  sqrt with an anchor of 24 because both were picked rather than measured;
 *  refitting them to linear/27 was +7.44 — see `budgetAwareQualitySampleCount`.
 *  This docstring still said sqrt.) */
const HANDOFF_QUALITY_N_CAND_AT_REF = 27;
const HANDOFF_QUALITY_N_CAND_REF_FRAMES = 250_000;
const HANDOFF_QUALITY_N_CAND_FLOOR = 8;
const HANDOFF_QUALITY_SPARSE_AMP_BOOST_N_CAND = 34;
const HANDOFF_QUALITY_SPARSE_AMP_Q48_N_CAND = 48;
const HANDOFF_QUALITY_SPARSE_AMP_RANGE_START = 0.15;
const HANDOFF_QUALITY_SPARSE_AMP_RANGE_SPAN = 0.20;
const HANDOFF_QUALITY_SPARSE_AMP_MEDIAN_START_FRAMES = Math.round(FPS * 0.75);
const HANDOFF_QUALITY_SPARSE_AMP_MEDIAN_SPAN_FRAMES = Math.round(FPS * 0.40);
const HANDOFF_QUALITY_SPARSE_AMP_IMPACT_START = 0.28;
const HANDOFF_QUALITY_SPARSE_AMP_IMPACT_SPAN = 0.16;
const HANDOFF_QUALITY_SPARSE_AMP_IMPACT_HIGH_START = 0.56;
const HANDOFF_QUALITY_SPARSE_AMP_IMPACT_HIGH_SPAN = 0.16;
const HANDOFF_QUALITY_SPARSE_AMP_SPEED_RANGE_START = 0.10;
const HANDOFF_QUALITY_SPARSE_AMP_SPEED_RANGE_SPAN = 0.10;
const HANDOFF_SPARSE_CONTACT_MEDIAN_FRAMES = Math.round(FPS * 0.75);
/** Extra deterministic sampling only when the normal batch finds no viable
 *  catch for a required contact. This preserves the cheap common path while
 *  spending bounded work at true contract dead-ends instead of immediately
 *  turning the prefix into a skipped-contact fallback. */
const HANDOFF_RESCUE_BASE_N_CAND = 32;
const HANDOFF_RESCUE_STARTUP_EXTRA_N_CAND = 48;
const HANDOFF_RESCUE_CANDIDATE_POOL = 12;
const HANDOFF_RESCUE_STARTUP_PRESSURE_HALFLIFE_FRAMES = FPS * 1.1;
const HANDOFF_RESCUE_MIN_GAP_FRAMES = 16;
/** Short required-contact gaps are dominated by how few AUTHORED frames the
 *  catch has to happen in — not by the compile's budget deadline: the normal
 *  cheap prefix can have zero hits even when a catch exists later in the
 *  deterministic sample order. Rescue only clean prefixes at true dead-ends
 *  (caller-gated) so already-working dense paths keep their normal cheap
 *  order. */
const HANDOFF_SHORT_RESCUE_N_CAND = 80;
const HANDOFF_SHORT_RESCUE_CANDIDATE_POOL = 16;
const HANDOFF_SHORT_RESCUE_MAX_GAP_FRAMES = 12;
/**
 * The rollout's own rescue: extra deterministic sampling when a CHARGED forward
 * rollout's first rolled contact expands to nothing. Exactly the rule the three
 * rescue tiers above already apply to the search — spend bounded work at a true
 * dead end rather than let one empty draw stand as a verdict — one level up, on
 * the mechanism that never had it.
 *
 * WHY. A rollout expands its first rolled contact at the shape's own width, and
 * for the default greedy shape that width is ONE: `solveOneGap(K = 1)`, a single
 * `sampleOneCandidate` attempt at attempt index 0. The gates are the same
 * function the search uses, so the two never disagreed about what "viable"
 * means — only about how hard to look, and the search looks 24-81x harder
 * before its own lanes and rescues are counted. Auditing every hop-1 dead-end
 * verdict on 64 compiles of this base (12,338 verdicts, 8 sources x 4 seeds x
 * {150k, 750k}) by re-running the SAME generator at the SAME node: 51.3% of the
 * verdicts are FALSE (54.4% at 150k, 47.3% at 750k). The error splits by
 * terrain, not by pool rank — 57.5% of capability-frontier verdicts hold
 * against 33.1% of representative ones, while the verified-true rate is flat to
 * two points across pool ranks 0-4 — so this is the rollout's one-sample view of
 * the world, not the pool's tail feeding it junk. The bit matters out of all
 * proportion to its frequency: it fires on 5-7% of the rollout's decisions and
 * carries half to two-thirds of all the leaf value the rollout re-orders, and
 * `cachedForwardContinuation` hands it on to the online-continuation filter,
 * which prunes the frontier on it under full deadline pressure.
 *
 * ONE extra draw, and the dose is arithmetic rather than taste. The refutation
 * curve is front-loaded: draw 2 refutes 15.3% of all verdicts, draw 3 a further
 * 5.4%, draws 4-5 a further 7.5% between them. Each further rung is taken only
 * on the verdicts still standing, so at ~40 frames a draw the marginal cost per
 * marginal correction is 261 / 628 / 845 / 1,539 / 2,161 frames for a ladder to
 * 2 / 3 / 5 / 8 / 12 — draw 2 buys a correction 2.4x cheaper than draw 3 and
 * 3.2x cheaper than draws 4-5. Priced against the free-judge ceiling (refunding
 * EVERY rollout frame is worth +1.78 per cell at 750k, so a frame costs ~0.087
 * points per 1% of the budget), the required value per corrected verdict rises
 * 0.0030 -> 0.0073 -> 0.0098 points as the ladder lengthens. And the price is
 * inverse to budget — the same dose is ~0.75% of frames at 750k and ~5% at 150k
 * — so the cheapest rung is the only one the low-budget arm can afford at all.
 * Wider doses are a monotone family that can be walked later on the same
 * arithmetic; they are not a knob to tune, and least of all per budget.
 */
const HANDOFF_ROLLOUT_REDRAW_ON_EMPTY = 1;

/**
 * THE REDRAW-DOSE LAW — the dose above is the base draw, and this is the ONE
 * constant that grades it with how hard the compile is pressed:
 *
 *     dose = max(1, round(HANDOFF_ROLLOUT_REDRAW_ON_EMPTY
 *                         + REDRAW_DOSE_PRESSURE_SPAN * deadlinePressure(margin)))
 *
 * CONTRACT. The coordinate is the compile's own deadline pressure
 * (optimizer/deadline.ts), read at the LIVE per-node margin the pool build was
 * resolved with (`rankedOptions`'s `config.deadlineMargin`, itself
 * `deadline.marginAt` at this node and this frame count). Pressure 0 gives
 * `round(1) = 1` — the base dose, i.e. today's behaviour exactly — and the ramp
 * is continuous from there to `1 + SPAN` at the full-pressure anchor. There is
 * NO budget read, no slack read, and no mode: the budget enters only through the
 * margin, which is the architecture's single budget/difficulty coordinate, so
 * the law is automatically continuous over 150k-3M and carries no
 * benchmark-keyed constant (`compiler_scale_contract`). The `round` is the same
 * discretization the breadth law's `nCand = round(27*B/250k)` already uses.
 *
 * THE ANCHOR. SPAN = 5 is the measured full-pressure arm, not a fit: iteration 8
 * priced a FLAT dose 6 (= 1 + 5) against HEAD on the four capability-frontier
 * sources at 250k, 240 seeds each, 1,920 compiles.
 *   - completion ledger: 576/960 -> 660/960 valid; rescued 215, lost 131;
 *     discordant 346; rescue share 0.6214, Wilson 95% [0.5692, 0.6709],
 *     McNemar exact p = 7.4e-6 (pre-registered bars: share >= 0.60 AND Wilson
 *     lower > 0.50 -> REAL). The same instrument read 0.470 [0.417, 0.524] on the
 *     pace term, which is what a seed lottery looks like.
 *   - score, concordant-complete cells (n=445): +3.512 +- 0.766, t = +4.59.
 *   - the 12-source completion-stable spot panel (288 pairs) is a measured NULL:
 *     -0.444 +- 1.256, 0/288 completion changes, 80%-power MDE 3.52.
 * The dose is GRADED IN PRESSURE and harmful at pressure 0 — binned by the
 * control arm's full-pre-pressure share the rescue share walks
 * 0.000 / 0.240 / 0.633 / 0.567 / 0.673 / 0.769 and the all-cell delta walks
 * -24.4 / -48.7 / +46.8 / +32.7 / +73.2 / +103.9 (point-biserial r = +0.307,
 * n = 346, t = +5.99). The zero-pressure bin reproduces, inside the 250k panel,
 * the -6.49 +- 2.90 the same flat arm cost at 750k (mandate iteration 1). That
 * sign flip IS the law: a flat dose pays the loss everywhere the compile is on
 * course, and this ramp does not, because pressure is 0.00-1.36% of pre-completion
 * pool builds on those sources at 750k and 0.40% suite-wide.
 *
 * THE MECHANISM, causally isolated: the payoff is the online-continuation
 * filter's false prunes. With `LR_ONLINE_CONTINUATION=0` the same dose-6 arm
 * reads 0.466 [0.356, 0.579], p = 0.64 — a lottery, the rescue vanishes — and
 * both dense_recovery sources go 0/120 valid in BOTH arms, i.e. the filter
 * CREATES the completion surface it then prunes. STANDING HAZARD: the filter is
 * itself a full-pressure-gated, 250k-tier mechanism with a 37.8% false-verdict
 * rate, and it and this law are ONE mechanism that must be re-priced together.
 * If the filter is ever retired or made continuous, re-derive or delete this.
 *
 * HONEST SIZING. On the active promotion surface (750k only) this is
 * approximately headline-NEUTRAL by construction — the coordinate is nearly
 * dormant there, which is exactly why the flat arm's -6.49 does not come with
 * it. What it buys is the low-budget completion surface (+0.74 headline points
 * were the 250k slice at the legacy 0.2 budget weight) and, mostly, the scale
 * contract: the mechanism now says what it means at every budget instead of
 * being tuned off at one.
 */
const REDRAW_DOSE_PRESSURE_SPAN = 5;

/**
 * MEMO SAFETY — the widest pool the re-draw may ever request.
 *
 * `redrawFirstHopOnEmpty` leaves its widened pool IN the node memo on purpose
 * (see its docstring), and `_candidatesCache` is keyed on `(seed, nCand)`: a
 * narrower later request is re-sorted from a prefix and a wider one extends the
 * sample order, but an EXACT nCand match is served frozen. The re-drawn pool is
 * built with the aim lane suppressed, so the one thing that must never happen is
 * a real search expansion — or the start scan — asking for exactly a width the
 * re-draw wrote and being handed a lane-suppressed pool.
 *
 * At the base dose that was free: the re-draw wrote 2 (greedy) and 4 (the impact
 * arm's `firstBranch = 3`), disjoint from every real consumer. The law raises the
 * ceiling to `width + 1 + SPAN`, which for the impact arm would be 9 and would
 * collide with `START_FIRST_K`/`START_NEXT_K` (8) and with the breadth law's own
 * floor (`HANDOFF_QUALITY_N_CAND_FLOOR` = 8, and 9 is what the law returns at
 * ~83k frames). So the REQUEST is bounded here — one below the smallest width any
 * real expansion asks for — rather than the dose being tuned to fit. The bound
 * never reduces a request below `width + 1`, so pressure 0 stays byte-identical
 * at every width, including study widths above the bound.
 *
 * Known and deliberate overlaps, all of them rollout-internal and all in the same
 * suppression regime, so the frozen content is what the reader would have built:
 * the impact arm's own `firstBranch` build (`forwardFirstWidenedScore`
 * suppresses the lane exactly as the re-draw does) and a second re-draw at the
 * same node and dose. The one true exception is
 * `startSupportDelayRobustScore`'s width-3 build, which is aim-LIVE — it is
 * unreachable in production (it needs `LR_START_EVAL=greedy:2`; the default
 * `best:1:5` fails its `variant/depth/branch` guard) and it runs during start
 * selection, where there is no margin and the dose is 1.
 */
const REDRAW_MAX_TOTAL_WIDTH = HANDOFF_QUALITY_N_CAND_FLOOR - 1;
const HANDOFF_PREVIEW_K = 1;
/** Reuse only the latest committed catch. Older translated catches can over-lock
 *  dense forward-dependent chains into a locally steady but globally brittle
 *  rhythm. */
const HANDOFF_REUSE_K = 1;
const HANDOFF_REUSE_MATURE_EXTRA_WEIGHT = 0.35;
const HANDOFF_REUSE_MATURE_FULL_FEEDBACK_SCALE = 48;
const START_OPTION_LIMIT = 10;
const START_SCORING_POOL = 16;
const START_FIRST_K = 8;
const START_FIRST_OPTIONS = 3;
const START_NEXT_K = 8;
const START_HEURISTIC_WEIGHT = 0.15;
const START_ANGLE_NORM_DEG = 70;
const START_ANGLE_COST_WEIGHT = 0.35;
const START_LOW_SPEED_TARGET_MIN_PX = 6;
const START_LOW_SPEED_RATIO = 0.45;
const START_SPEED_ANCHOR_OFFSETS_PX_PER_FRAME = [-2.5, -0.75, 0, 1.25, 2.5] as const;
const START_BALLISTIC_SCORING_POOL = 4;
const START_BUDGET_PRESSURE_START_FRAMES = 50_000;
const START_BUDGET_PRESSURE_SPAN_FRAMES = 50_000;
const START_SUPPORT_LOW_AIR_MAX = 0.35;
const START_SUPPORT_RELEASE_MARGIN_FRAMES = K_BOUNCE_LANDING + 2;
const START_SUPPORT_MIN_RUNUP_FRAMES = K_BOUNCE_LANDING + 3;
const START_SUPPORT_LINE_Y = 5;
const START_SUPPORT_LOW_AIR_X_DELAY_FRAMES = [0, 1, 2] as const;
const START_SUPPORT_X_DELAY_AIR_MAX = 0.40;
const START_SUPPORT_X_DELAY_FIRST_GAP_START_FRAMES = 20;
const START_SUPPORT_X_DELAY_FIRST_GAP_SPAN_FRAMES = 10;
const START_SUPPORT_DELAY_ROBUST_BRANCH = 3;
const START_SUPPORT_LINE_BACKTRACK_PX = 80;
// REDRAW-DOSE LAW, memo-safety invariant (see REDRAW_MAX_TOTAL_WIDTH): every
// width the re-draw can write must stay strictly below every width a REAL
// expansion asks for at the same node, or the (seed, nCand) memo hands one of
// them the other's pool. Asserted at load, here rather than at the constant,
// because the two start-scan widths are declared above this point. Lower any of
// these three and the law's bound has to move with it.
if (Math.min(START_FIRST_K, START_NEXT_K, HANDOFF_QUALITY_N_CAND_FLOOR) <= REDRAW_MAX_TOTAL_WIDTH) {
  throw new Error(
    `REDRAW_MAX_TOTAL_WIDTH (${REDRAW_MAX_TOTAL_WIDTH}) must stay below every real-expansion ` +
      `pool width: START_FIRST_K=${START_FIRST_K}, START_NEXT_K=${START_NEXT_K}, ` +
      `HANDOFF_QUALITY_N_CAND_FLOOR=${HANDOFF_QUALITY_N_CAND_FLOOR} ` +
      "(see the redraw-dose law's memo-safety docstring)",
  );
}
const DEAD_END_PENALTY = 40;
const SURVIVOR_SCARCITY_PENALTY = 4;
/** The one-contact preview already pays for a future candidate. Reuse its local
 *  cost as a small quality signal for frame-span/smooth axes. */
const PREVIEW_COST_WEIGHT = 0.25;
const HANDOFF_STATE_WEIGHT = 0.08;
/** Thresholds for `handoffStatePenalty`, the sub-75k local-ranker state-quality
 *  term (the forward-eval path bypasses it — it scores state via the true leaf).
 *  These grade the rider's velocity at the handoff frame: a fast, near-horizontal
 *  exit is a clean hand-off, so no penalty accrues until the state exceeds these
 *  bands. The numbers are absolute physical magnitudes tuned to current cadence,
 *  not spec-relative. */
// Vertical speed (px/frame) tolerated before excess |v.y| is penalized.
const HANDOFF_STATE_VERTICAL_EXCESS_PX_PER_FRAME = 8;
// Exit angle (degrees off horizontal) tolerated before excess is penalized.
const HANDOFF_STATE_ANGLE_EXCESS_DEG = 70;
// Degrees of angle-excess per unit penalty (rescales angle into the same
// magnitude range as the vertical-excess term before weighting).
const HANDOFF_STATE_ANGLE_SCALE_DEG = 10;
// A stalled rider (essentially zero speed) can't hand off at all: charge a flat
// worst-case penalty of this many WEIGHT units.
const HANDOFF_STATE_STALL_WEIGHT_MULTIPLIER = 8;
/** Selection-only asymmetric overshoot pressure in the handoff feasibility
 *  ranking. Axes omitted from this table use only the symmetric candidate cost;
 *  adding a future axis should be an explicit policy choice, not an accidental
 *  named-axis branch in the ranker. */
const HANDOFF_NORMALIZED_AXIS_OVERSHOOT_WEIGHT =
  1 / (AXIS_QUALITY_TOLERANCE * AXIS_QUALITY_TOLERANCE);
// Speed overshoot is softer than normalized axes because excess speed can be bled.
const HANDOFF_SPEED_OVERSHOOT_WEIGHT = 6;
const HANDOFF_AXIS_OVERSHOOT_WEIGHTS: Partial<Record<AxisName, number>> = {
  speed: HANDOFF_SPEED_OVERSHOOT_WEIGHT,
  air: HANDOFF_NORMALIZED_AXIS_OVERSHOOT_WEIGHT,
};
/** Brake catches (uphill-entry, bleed speed) are offered as EXTRA candidates on
 *  MODERATE-target gaps where the rider runs even mildly over target (early, to
 *  pre-empt creep). Decoupled from landing, so on non-creeping specs they simply
 *  lose the ranking. Excluded from reuse. */
const HANDOFF_BRAKE_TARGET_MAX_PX_PER_FRAME = authoredSpeedToPx(1.0);
const HANDOFF_BRAKE_MILD_TARGET_MAX_PX_PER_FRAME = authoredSpeedToPx(0.78);
const HANDOFF_BRAKE_TARGET_MIN_PX_PER_FRAME = authoredSpeedToPx(0.0);
const HANDOFF_BRAKE_TARGET_EPSILON_PX_PER_FRAME = 1e-6;
const HANDOFF_BRAKE_RATIO_MIN = 1.0;
const HANDOFF_BRAKE_HIGH_OVERSPEED_RATIO = 1.15;
const HANDOFF_BRAKE_QUALITY_BASE_K = 3;
const HANDOFF_BRAKE_QUALITY_HIGH_OVERSPEED_K = 4;
const HANDOFF_SUPPORT_TIME_BASE_K = 8;
const HANDOFF_SUPPORT_TIME_MAX_K = 32;
const HANDOFF_SUPPORT_TIME_FULL_DEFICIT = 0.5;
const HANDOFF_RELEASE_VERTICAL_WEIGHT = 0.045;
const HANDOFF_RELEASE_VERTICAL_LOW_AIR_TARGET_SCALE = 0.45;
const HANDOFF_RELEASE_VERTICAL_TIGHT_CADENCE_FRAMES = Math.round(FPS * 0.72);
const HANDOFF_RELEASE_VERTICAL_TIGHT_CADENCE_WIDTH = Math.round(FPS * 0.40);
const HANDOFF_RELEASE_VERTICAL_SAFE_PX = 8;
// Mature vertical-axis gaps benefit from the robust avg forward ranker, but using
// it globally starves dense drum/search feedback. Fade it in only for those gaps.
const MATURE_AVG_FWD_EVAL_START_FRAMES = 35_000;
const MATURE_AVG_FWD_EVAL_SPAN_FRAMES = 65_000;
const MATURE_AVG_FWD_EVAL_BRANCH = 1;
const MATURE_AVG_FWD_EVAL_AMPLITUDE_START = 0.18;
const MATURE_AVG_FWD_EVAL_AMPLITUDE_SPAN = 0.42;
const MATURE_AVG_FWD_EVAL_ELEVATION_CENTER = 0.50;
const MATURE_AVG_FWD_EVAL_ELEVATION_SPAN = 0.24;
const MATURE_AVG_FWD_EVAL_DENSE_FRAMES = 20;
const MATURE_AVG_FWD_EVAL_SPARSE_FRAMES = 40;
// Impact-pressured downstream width (see impactBestForwardEvalConfig). Two
// coordinates, and only two: how much impact the gap asks for, and how much
// traversal slack the compile has (`B / D(spec)`). The budget enters once,
// inside the slack, conditioned on the spec's difficulty.
const IMPACT_BEST_FWD_ASK_START = 0.25;
const IMPACT_BEST_FWD_ASK_SPAN = 0.2;
const IMPACT_BEST_FWD_SLACK_START = 2.5;
const IMPACT_BEST_FWD_SLACK_SPAN = 2.0;
const IMPACT_BEST_FWD_BRANCH = 3;
const IMPACT_BEST_FWD_DEPTH = 2;
const OPENING_BEST_FWD_SLACK_BRANCH2_START = 2.75;
const OPENING_BEST_FWD_SLACK_BRANCH2_SPAN = 2.25;
const OPENING_BEST_FWD_SLACK_BRANCH3_START = 10;
const OPENING_BEST_FWD_SLACK_BRANCH3_SPAN = 8;
const OPENING_BEST_FWD_OBJECTIVE_START = 0.04;
const OPENING_BEST_FWD_OBJECTIVE_SPAN = 0.08;
const OPENING_BEST_FWD_REL_MARGIN_FULL = 0.02;
const OPENING_BEST_FWD_REL_MARGIN_ZERO = 0.12;
const OPENING_BEST_SHORT_CONTACT_FULL = 7;
const OPENING_BEST_SHORT_CONTACT_SPAN = 5;
const IMPACT_CURVE_HIGH_SPEED_RELIEF_SPEED_START = 0.68;
const IMPACT_CURVE_HIGH_SPEED_RELIEF_SPEED_SPAN = 0.08;
const IMPACT_CURVE_HIGH_SPEED_RELIEF_ELEVATION_RANGE_START = 0.08;
const IMPACT_CURVE_HIGH_SPEED_RELIEF_ELEVATION_RANGE_SPAN = 0.06;
const IMPACT_CURVE_HIGH_SPEED_RELIEF_ELEVATION_RANGE_END = 0.22;
const IMPACT_CURVE_HIGH_SPEED_RELIEF_ELEVATION_RANGE_END_SPAN = 0.12;
// Cadence "room" pressure: rises 0->1 as the median contact-gap widens, i.e. how
// much airborne room the beat cadence leaves for an impact-shaping arc.
const CADENCE_ROOM_START_FRAMES = 20;
const CADENCE_ROOM_SPAN_FRAMES = 14;
const PARTIAL_FUTURE_CONTACT_WINDOW = 20;
// Extra frames simulated past a track's nominal duration so the detector sees the
// full rideout tail when scoring a completed (full-duration) or partial output.
const OUTPUT_TAIL_PAD_FRAMES = 20;
/** Speculative tail completion turns deep prefixes into full-duration register
 *  candidates before ordinary DFS reaches a leaf. Keep the window small because
 *  the completion suffix branches two-wide and is charged like normal search. */
const TAIL_COMPLETION_CONTACT_WINDOW = 8;
const TAIL_COMPLETION_BUDGET_WINDOW_EXTRA = 4;
const TAIL_COMPLETION_FALLBACK_BRANCHING = 2;
const QUALITY_SHALLOW_TAIL_THROTTLE_MAX_PRESSURE = 1.0;
const QUALITY_SHALLOW_TAIL_THROTTLE_FULL_FEEDBACK_SCALE = 6;
const FAR_BACK_FRONTIER_LAG = 3;
export function compileHandoff(
  userSpec: Spec,
  seed = 0,
  opts: CompileHandoffOptions,
): CompileCheckpoint {
  return compileHandoffInternal(userSpec, seed, opts, null);
}

export function compileHandoffFromSnapshot(
  userSpec: Spec,
  seed: number,
  snapshot: HandoffNodeSnapshot,
  opts: CompileHandoffOptions,
): CompileCheckpoint {
  return compileHandoffInternal(userSpec, seed, opts, snapshot);
}

/** Build a budget->checkpoint curve as N INDEPENDENT full runs from scratch (no
 *  anytime sharing) — the single place that defines "a curve is one compile per
 *  budget, merging the shared opts". `runOne` is the per-budget compile call. */
function budgetCurve(
  budgets: number[],
  opts: Omit<CompileHandoffOptions, "budget">,
  runOne: (o: CompileHandoffOptions) => CompileCheckpoint,
): CompileCheckpoint[] {
  return budgets.map((budget) => runOne({ ...opts, budget }));
}

/** Diagnostic helper: a budget->checkpoint curve as N independent `compileHandoff` runs. */
export function compileBudgetCurve(
  userSpec: Spec,
  seed: number,
  budgets: number[],
  opts: Omit<CompileHandoffOptions, "budget"> = {},
): CompileCheckpoint[] {
  return budgetCurve(budgets, opts, (o) => compileHandoff(userSpec, seed, o));
}

/** Snapshot-resumed variant of `compileBudgetCurve` (N independent suffix runs). */
export function compileBudgetCurveFromSnapshot(
  userSpec: Spec,
  seed: number,
  snapshot: HandoffNodeSnapshot,
  budgets: number[],
  opts: Omit<CompileHandoffOptions, "budget"> = {},
): CompileCheckpoint[] {
  return budgetCurve(budgets, opts, (o) => compileHandoffFromSnapshot(userSpec, seed, snapshot, o));
}

/** Find the checkpoint for `budget` in a `compileBudgetCurve*` result; throws if
 *  absent. Shared by the diagnostic oracle/probe scripts. */
export function checkpointAt(curve: CompileCheckpoint[], budget: number): CompileCheckpoint {
  const found = curve.find((c) => c.budget === budget);
  if (found === undefined) throw new Error(`missing checkpoint for budget ${budget}`);
  return found;
}

/**
 * Resolve authored per-beat `impact` into gap targets and set the impact-curve
 * pressure globals. Called once from `compileHandoffInternal`, AFTER all
 * `sampleGapTargets` RNG draws, so it consumes NO rng and the candidate geometry
 * stays byte-identical. Mutates `gaps` (`targets.impact`, `nextImpact`) and
 * `gapAxisTargets[*].impact` in place. Owning the authored target transfer, the
 * arrival lookahead, and the three curve-pressure setters in one place keeps the
 * globals from desyncing.
 */
function resolveImpactTargets(
  spec: Spec,
  gaps: Gap[],
  gapAxisTargets: AxisValues[],
): void {
  // LR_IMPACT_OFF=1: drop all authored impact targets. Because every impact effect
  // (drift-report axis → scorer, candidate axisCost, geometry steers) is gated on
  // gap.targets.impact being set, leaving it unresolved disables impact end-to-end —
  // scoring, optimization, AND generation — from this one site, with ZERO change to the
  // evaluator ruler (so the golden headline becomes the pure non-impact ceiling and the
  // fingerprint is untouched). Diagnostic for A/B'ing the other axes (e.g. under a new
  // landing definition); default OFF ⇒ byte-identical.
  const impactOff = readEnv("LR_IMPACT_OFF") === "1";
  setImpactTemplateSpecMeanImpact(
    impactOff ? 0 : meanAuthoredImpactAfterFirstFeasibleContact(spec.contacts),
  );
  // validateSpec already guaranteed any authored impact is in [0,1], so no re-clamp
  // here. Sub-frame-spaced beats that round to the same frame collide (last write
  // wins) — degenerate authoring; the gap timeline coalesces them too.
  const impactByFrame = new Map<number, number>();
  if (!impactOff) {
    for (const c of spec.contacts) {
      // The convention rescale is now BAKED at authoring (golden specs use withImpactLegacy /
      // migrateImpact, beats.ts) — authored impact already sits on the current felt scale here,
      // with no runtime remap. New specs author natively on the current scale.
      if (c.impact !== undefined) impactByFrame.set(secToFrame(c.t), c.impact);
    }
  }
  let maxAuthoredImpact = 0;
  if (impactByFrame.size > 0) {
    for (const gap of gaps) {
      if (!gap.endsWithContact) continue;
      const impact = impactByFrame.get(gap.endFrame);
      if (impact === undefined) continue;
      gap.targets.impact = impact;
      gapAxisTargets[gap.index].impact = impact;
      maxAuthoredImpact = Math.max(maxAuthoredImpact, impact);
    }
    // Second pass: give each gap the AUTHORED impact target of the beat its
    // launch flies toward (the immediately following contact gap), so
    // generation can plan the ARRIVAL — launch steeper into a hard beat.
    // Pure lookahead copy: no RNG, no target changes.
    for (let i = 0; i + 1 < gaps.length; i++) {
      if (!gaps[i].endsWithContact) continue;
      const next = gaps[i + 1];
      if (next.endsWithContact && next.targets.impact !== undefined) {
        gaps[i].nextImpact = next.targets.impact;
      }
    }
  }
  const impactProfile = impactOff ? null : impactCurveProfileStats(gaps, gapAxisTargets);
  setImpactProfilePressures({
    elevationRoom: impactProfile === null ? 0 : impactCurveElevationRoomPressure(impactProfile),
    highSpeedRelief: impactProfile === null ? 0 : impactCurveHighSpeedReliefProfilePressure(impactProfile),
    templateHold: impactProfile === null ? 0 : impactTemplateHoldProfilePressure(impactProfile),
  });
}

function compileHandoffInternal(
  userSpec: Spec,
  seed: number,
  opts: CompileHandoffOptions,
  initialSnapshot: HandoffNodeSnapshot | null,
): CompileCheckpoint {
  beginEnvFlagEpoch();
  if (!Number.isSafeInteger(seed)) {
    throw new Error(`compileHandoff: seed must be a safe integer, got ${seed}`);
  }
  const searchSeed = opts.searchSeed ?? seed;
  if (!Number.isSafeInteger(searchSeed)) {
    throw new Error(`compileHandoff: searchSeed must be a safe integer, got ${searchSeed}`);
  }
  const targetBudget = validateBudget(opts.budget);
  const policyBudget = opts.policyBudget === undefined
    ? targetBudget
    : validateBudget(opts.policyBudget);
  if (policyBudget > targetBudget) {
    throw new Error(
      `compileHandoff: policyBudget ${policyBudget} exceeds hard budget ${targetBudget}`,
    );
  }
  const searchPolicyBudget = opts.searchPolicyBudget === undefined
    ? policyBudget
    : validateBudget(opts.searchPolicyBudget);
  const repairBudgetLimit = opts.repairBudget === undefined
    ? policyBudget
    : validateBudget(opts.repairBudget);
  if (searchPolicyBudget > targetBudget) {
    throw new Error(
      `compileHandoff: searchPolicyBudget ${searchPolicyBudget} exceeds hard budget ${targetBudget}`,
    );
  }
  if (repairBudgetLimit > targetBudget) {
    throw new Error(
      `compileHandoff: repairBudget ${repairBudgetLimit} exceeds hard budget ${targetBudget}`,
    );
  }
  const budgetTelemetryLevel = opts.budgetTelemetry ?? "summary";
  if (!["off", "summary", "trace"].includes(budgetTelemetryLevel)) {
    throw new Error(
      `compileHandoff: budgetTelemetry must be off|summary|trace, got ${budgetTelemetryLevel}`,
    );
  }
  const resumePolicy = opts.resumePolicy ?? "legacy";
  if (!["legacy", "none", "remainder-aware"].includes(resumePolicy)) {
    throw new Error(`compileHandoff: resumePolicy must be legacy|none|remainder-aware`);
  }
  const frontierTraversalPolicy = parseFrontierTraversalPolicy(
    readFrontierTraversalPolicy(),
  );
  const routeLeaseAuditRaw = process.env.LR_ROUTE_LEASE_AUDIT;
  if (
    routeLeaseAuditRaw !== undefined && routeLeaseAuditRaw !== "" &&
    routeLeaseAuditRaw !== "0" && routeLeaseAuditRaw !== "1"
  ) throw new Error("LR_ROUTE_LEASE_AUDIT must be 0 or 1");
  const routeLeaseRollbackRaw = process.env.LR_ROUTE_LEASE_ROLLBACK;
  if (
    routeLeaseRollbackRaw !== undefined && routeLeaseRollbackRaw !== "" &&
    routeLeaseRollbackRaw !== "0" && routeLeaseRollbackRaw !== "1"
  ) throw new Error("LR_ROUTE_LEASE_ROLLBACK must be 0 or 1");
  const routeLeaseRevalidationRaw = process.env.LR_ROUTE_LEASE_REVALIDATION;
  if (
    routeLeaseRevalidationRaw !== undefined && routeLeaseRevalidationRaw !== "" &&
    routeLeaseRevalidationRaw !== "0" && routeLeaseRevalidationRaw !== "1"
  ) throw new Error("LR_ROUTE_LEASE_REVALIDATION must be 0 or 1");
  const routeLeaseRenewalAuditRaw = process.env.LR_ROUTE_LEASE_RENEWAL_AUDIT;
  if (
    routeLeaseRenewalAuditRaw !== undefined && routeLeaseRenewalAuditRaw !== "" &&
    routeLeaseRenewalAuditRaw !== "0" && routeLeaseRenewalAuditRaw !== "1"
  ) throw new Error("LR_ROUTE_LEASE_RENEWAL_AUDIT must be 0 or 1");
  const routeLeaseResetLineageRaw =
    process.env.LR_ROUTE_LEASE_REVALIDATION_RESET_LINEAGE;
  if (
    routeLeaseResetLineageRaw !== undefined && routeLeaseResetLineageRaw !== "" &&
    routeLeaseResetLineageRaw !== "0" && routeLeaseResetLineageRaw !== "1"
  ) throw new Error("LR_ROUTE_LEASE_REVALIDATION_RESET_LINEAGE must be 0 or 1");
  const routeLeaseRollback = routeLeaseRollbackRaw === "1";
  const routeLeaseRenewalAudit = routeLeaseRenewalAuditRaw === "1";
  const routeLeaseResetLineage = routeLeaseResetLineageRaw === "1";
  const routeLeaseRevalidation = routeLeaseRevalidationRaw === "1" ||
    routeLeaseRenewalAudit || routeLeaseResetLineage;
  if (routeLeaseRollback && routeLeaseRevalidation) {
    throw new Error("route-lease rollback and revalidation are mutually exclusive");
  }
  const routeLeaseAudit = routeLeaseAuditRaw === "1" || routeLeaseRollback ||
    routeLeaseRevalidation;
  setProposalUtilityPowers();
  setAimCompileBudgetFrames(searchPolicyBudget);
  const maxNodes = opts.maxNodes ?? Math.max(MAX_NODES_FLOOR, targetBudget);
  if (!Number.isInteger(maxNodes) || maxNodes < 1) {
    throw new Error(`compileHandoff: maxNodes must be a positive integer, got ${maxNodes}`);
  }

  // Per-compile state lifecycle: clear every accumulator / cache / counter that
  // registered with the registry (core/compile_lifecycle.ts) in one call — the stat
  // lanes (sim/candidate/arc/aim/release-exit/gapfit-short), the fwd-eval
  // holders, the engine-rebuild counter, and any module that joins the compile
  // path later (e.g. reachability). Replaces a hand-maintained reset list that
  // silently drifted whenever a global was added without its reset call. Process-
  // scoped study aggregators (catchability telemetry) deliberately do NOT register.
  resetPerCompileState();

  {
    validateSpec(userSpec);
    // Drop physically-uncatchable early contacts. A contact registers only when the detector
    // emits a "landing" event within ±1 frame of its target, and a landing requires the rider to
    // be airborne for more than K_BOUNCE_LANDING frames first (bounce rejection). From a frame-0
    // start the soonest landing is therefore frame K_BOUNCE_LANDING+1, so any contact targeting a
    // frame below K_BOUNCE_LANDING (~0.125s) can never be hit — it only tanks the score. We drop it
    // up front so the search and the drift report share one feasible contract. (No-op on the golden
    // suite: its earliest contact is frame 16, well above the floor — baselines are preserved.)
    const feasibleContacts = userSpec.contacts.filter((c) => secToFrame(c.t) >= K_BOUNCE_LANDING);
    if (feasibleContacts.length !== userSpec.contacts.length) {
      const dropped = userSpec.contacts.length - feasibleContacts.length;
      process.stderr.write(
        `handoff: dropped ${dropped} contact(s) before the landing floor ` +
        `(<${K_BOUNCE_LANDING} frames / ${(K_BOUNCE_LANDING / FPS).toFixed(3)}s — physically uncatchable)\n`,
      );
    }
    // Do not run a separate optimized-preroll pre-pass here. In the handoff
    // optimizer, the initial condition is the first state boundary of the search;
    // pre-worlding belongs in this search, not as a hidden budget-consuming
    // compiler before it. A manual `start` is still honored by resolveStartState.
    const spec: Spec = { ...userSpec, preroll: undefined, contacts: feasibleContacts };
    const specProfile = buildHandoffSpecProfile(spec);
    setProposalUtilityPowers({
      settledIncomingQualityPower:
      objectiveBlendCurrentPowerForSpec(searchPolicyBudget, specProfile),
    });
    const durationFrames = secToFrame(spec.duration);
    const allContactFrames = [...spec.contacts]
      .map((c) => secToFrame(c.t))
      .sort((a, b) => a - b);

    const gaps = sliceTimeline(allContactFrames, durationFrames);
    const masterRng = makeRng(seed);
    const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
    for (const gap of gaps) {
      gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, masterRng);
    }
    // Resolve the per-beat `impact` qualifier into the terminating gap's targets.
    // impact is authored on the Contact (not a curve), so it bypasses effectiveAxes/
    // sampleGapTargets entirely and is written here, AFTER all sampleGapTargets RNG
    // draws — so it consumes NO rng and the candidate GEOMETRY stays byte-identical.
    // Extracted into one helper (authored target transfer + arrival lookahead + the three
    // impact-curve-pressure globals) so those setters live at a single call site and
    // cannot desync.
    resolveImpactTargets(spec, gaps, gapAxisTargets);

    const ctx: SpecContext = {
      allContactFrames,
      durationFrames,
      gapAxisTargets,
      gaps,
    };
    const targetProfile = buildHandoffTargetProfile(gaps, ctx);
    const predictedFirstCompletionFrames = Math.round(predictFirstCompletionFrames(spec));
    // DIFFICULTY, the static coordinate: `policyBudget / D(spec)` under
    // TRAVERSAL_BUDGET_MODEL_V1, frozen for the whole compile. It chooses the
    // SHAPE of spend (branch limit, forward-eval admission, opening-best and
    // impact-best arms) and is deliberately budget-linear and stale — it is the
    // yardstick controller behaviour is measured against, not a measurement of
    // that behaviour (docs/budget-aware-map.md E1). The OTHER coordinate, "how
    // pressed am I right now", is the live margin in optimizer/deadline.ts.
    // Nothing should ever read one where it means the other.
    const budgetSlack = traversalBudgetSlack(searchPolicyBudget, spec);
    let resumedSearchShapeBudget: number | null = null;
    const budgetSlackTelemetry = round3(budgetSlack);
    setForwardEvalContext(spec, gapAxisTargets);
    const sparseContactCadence = usesSparseContactCadenceProfile(targetProfile);
    const allStartOptions = initialSnapshot === null
      ? buildStartOptions(userSpec, spec, gaps, ctx, searchSeed, searchPolicyBudget)
      : [];
    const startOptions = opts.startOptionRank === undefined
      ? allStartOptions
      : (() => {
        if (!Number.isInteger(opts.startOptionRank) || opts.startOptionRank < 0) {
          throw new Error(`compileHandoff: startOptionRank must be a non-negative integer`);
        }
        const option = allStartOptions[opts.startOptionRank];
        if (option === undefined) {
          throw new Error(
            `compileHandoff: startOptionRank ${opts.startOptionRank} is outside ` +
              `${allStartOptions.length} start options`,
          );
        }
        return [option];
      })();
    const root: HandoffNode = initialSnapshot === null
      ? {
        search: startOptions[0].root,
        startState: startOptions[0].state,
        startLines: startOptions[0].startLines,
        startRank: startOptions[0].rank,
        searchSeed,
        startExpanded: startOptions.length <= 1,
        deferExpansion: false,
        rankTrace: [],
        skippedContacts: 0,
      }
      : cloneSnapshotRoot(initialSnapshot, gaps.length, searchSeed);
    const budgetRecorder = new CompileBudgetTelemetryRecorder({
      level: budgetTelemetryLevel,
      gaps,
      durationFrames,
      hardBudgetFrames: targetBudget,
      policyBudgetFrames: policyBudget,
      searchPolicyBudgetFrames: searchPolicyBudget,
      repairBudgetFrames: repairBudgetLimit,
    });
    // DEADLINE, the live coordinate. Same pure estimator functions as the
    // recorder above and no shared state with it: the recorder observes and
    // never drives, this one drives and never records.
    const deadline = new CompileDeadline({
      gaps,
      durationFrames,
      policyBudgetFrames: searchPolicyBudget,
      anchorGapIndex: root.search.gapIndex,
      includeStartup: initialSnapshot === null,
    });
    const initialBudgetEpisodeId = budgetRecorder.startEpisode({
      lane: initialSnapshot === null ? "initial" : "snapshot",
      searchSeed,
      frontierHasFallbackLane: false,
      anchorGapIndex: root.search.gapIndex,
      startTotalSpentFrames: 0,
      // The initial frontier is legally allowed to run until the hard capture
      // budget. policyBudget tunes search policy; it is not this attempt's
      // execution ceiling when the two budgets differ.
      ceilingTotalSpentFrames: targetBudget,
      ceilingSource: "hard_budget",
      includeStartup: initialSnapshot === null,
    });
    budgetRecorder.recordSegment(
      "startup",
      0,
      getSimFrames(),
      "search_ready",
      initialBudgetEpisodeId,
    );
    const passStack: HandoffNode[] = root.skippedContacts === 0 ? [root] : [];
    const fallbackStack: HandoffNode[] = root.skippedContacts === 0 ? [] : [root];
    const selectiveBacktracking = frontierTraversalPolicy !== "depth_first"
      ? new SelectiveAxisRegretController<HandoffNode>(
        (node) => node.search.gapIndex,
        {
          policy: frontierTraversalPolicy,
          routeLeaseAudit,
          routeLeaseRollback,
          routeLeaseRevalidation,
          routeLeaseRenewalAudit,
          routeLeaseResetLineage,
        },
      )
      : null;
    selectiveBacktracking?.observeRoot(root);
    const contactOrdinalByGapIndex: number[] = [0];
    for (const gap of gaps) {
      contactOrdinalByGapIndex.push(
        contactOrdinalByGapIndex[contactOrdinalByGapIndex.length - 1]! +
          (gap.endsWithContact ? 1 : 0),
      );
    }
    const contactOrdinalAt = (gapIndex: number): number =>
      contactOrdinalByGapIndex[Math.max(0, Math.min(gaps.length, gapIndex))] ?? 0;
    type AuthoredAxisWindow = {
      axisCount: number;
      axisSse: number;
      axisLoss: number;
      comparableContacts: number;
      byAxis: Record<string, { observations: number; sse: number }>;
    };
    const authoredAxisWindow = (
      search: SearchNode,
      fromGapIndex = 0,
      throughGapIndex = search.gapIndex,
    ): AuthoredAxisWindow => {
      const errors: number[] = [];
      const byAxis: Record<string, { observations: number; sse: number }> = {};
      let comparableContacts = 0;
      const start = Math.max(0, Math.min(search.gapIndex, fromGapIndex));
      const end = Math.max(0, Math.min(search.gapIndex, throughGapIndex));
      for (let i = start; i < end; i++) {
        if (!gaps[i]?.endsWithContact) continue;
        const fit = search.prefixFits[i];
        if (fit === null || fit === undefined) continue;
        const targets = gapAxisTargets[i] ?? {};
        const achieved = settledIncomingAxes(fit);
        let contactComparable = false;
        for (const axis of AXES) {
          if (REPORT_ONLY_AXIS_SET.has(axis)) continue;
          const target = targets[axis];
          const value = achieved[axis];
          if (
            target === undefined || value === undefined ||
            !Number.isFinite(target) || !Number.isFinite(value)
          ) continue;
          const error = value - target;
          errors.push(error);
          const summary = byAxis[axis] ?? { observations: 0, sse: 0 };
          summary.observations++;
          summary.sse += error * error;
          byAxis[axis] = summary;
          contactComparable = true;
        }
        if (contactComparable) comparableContacts++;
      }
      const quality = axisQualityFromErrors(errors);
      return {
        axisCount: quality.axis_count,
        axisSse: errors.reduce((total, error) => total + error * error, 0),
        axisLoss: quality.axis_loss,
        comparableContacts,
        byAxis,
      };
    };
    const authoredAxisComparison = (
      selected: SearchNode,
      incumbent: SearchNode,
      fromGapIndex = 0,
      throughGapIndex = selected.gapIndex,
    ): {
      comparison: SelectiveDeferredValueAxisComparison;
      selected: AuthoredAxisWindow;
      incumbent: AuthoredAxisWindow;
    } => {
      const selectedWindow = authoredAxisWindow(
        selected,
        fromGapIndex,
        throughGapIndex,
      );
      const incumbentWindow = authoredAxisWindow(
        incumbent,
        fromGapIndex,
        throughGapIndex,
      );
      return {
        comparison: {
          selected_axis_count: selectedWindow.axisCount,
          incumbent_axis_count: incumbentWindow.axisCount,
          selected_axis_sse: selectedWindow.axisSse,
          incumbent_axis_sse: incumbentWindow.axisSse,
          selected_axis_loss: selectedWindow.axisLoss,
          incumbent_axis_loss: incumbentWindow.axisLoss,
          axis_loss_delta: selectedWindow.axisLoss - incumbentWindow.axisLoss,
        },
        selected: selectedWindow,
        incumbent: incumbentWindow,
      };
    };
    const authoredPrefixAxisLoss = (
      search: SearchNode,
      throughGapIndex = search.gapIndex,
    ): number => {
      const errors: number[] = [];
      const end = Math.max(0, Math.min(search.gapIndex, throughGapIndex));
      for (let i = 0; i < end; i++) {
        if (!gaps[i]?.endsWithContact) continue;
        const fit = search.prefixFits[i];
        if (fit === null || fit === undefined) continue;
        errors.push(...axisErrorsForTargets(ctx.gapAxisTargets![i], settledIncomingAxes(fit)));
      }
      return axisQualityFromErrors(errors).axis_loss;
    };
    const totalAuthoredAxisCount = gapAxisTargets.reduce(
      (count, targets, gapIndex) => count +
        (gaps[gapIndex]?.endsWithContact
          ? axisErrorsForTargets(targets, targets).length
          : 0),
      0,
    );
    const isSearchPrefix = (prefix: HandoffNode, descendant: HandoffNode): boolean => {
      if (prefix.search.gapIndex > descendant.search.gapIndex) return false;
      for (let i = 0; i < prefix.search.gapIndex; i++) {
        if (prefix.search.prefixFits[i] !== descendant.search.prefixFits[i]) return false;
      }
      return true;
    };
    const repairAxisBranchBoundMode = parseRepairAxisBranchBoundMode();
    const repairAxisBranchBound = repairAxisBranchBoundMode === "off"
      ? null
      : new RepairAxisBranchBoundController<HandoffNode>(
        repairAxisBranchBoundMode,
        isSearchPrefix,
      );
    const register = new BestSoFarRegister();
    const telemetry: HandoffTelemetry = {
      frontierSelections: 0,
      farBackPulses: 0,
      nodesExpanded: 0,
      frontierMaxSize: frontierSize(passStack, fallbackStack),
      deepestSeenGap: -1,
      firstProgressFrame: null,
      hasCompletion: false,
      partialEvaluations: 0,
      fullEvaluations: 0,
      evaluationsByPhase: emptyPhaseCounter(),
      fullEvaluationsByPhase: emptyPhaseCounter(),
      improvementsByPhase: emptyPhaseCounter(),
      duplicateEvaluations: 0,
      duplicateFullEvaluations: 0,
      duplicateEvaluationsByPhase: emptyPhaseCounter(),
      duplicateFullEvaluationsByPhase: emptyPhaseCounter(),
      tailCompletionAttempts: 0,
      tailCompletionSuccesses: 0,
      tailCompletionImprovements: 0,
      tailCompletionAttemptsByRemainingContacts: {},
      tailCompletionSuccessesByRemainingContacts: {},
      tailCompletionImprovementsByRemainingContacts: {},
      candidatePoolRequests: emptyNumericAccumulator(),
      valueProbeEmptyFullWidthRetryAttempts: 0,
      valueProbeEmptyFullWidthRetrySuccesses: 0,
      valueProbeEmptyFullWidthRetryRequestedProposals: 0,
      valueProbeEmptyFullWidthRetryIncrementalRequestedProposals: 0,
      valueProbeEmptyFullWidthRetryCandidateGeometryEvaluations: 0,
      valueProbeEmptyFullWidthRetryFrames: 0,
      policyNCand: emptyNumericAccumulator(),
      policyBranchLimit: emptyNumericAccumulator(),
      previews: 0,
      previewContacts: 0,
      previewSurvivors: 0,
      reuseAttempts: 0,
      reuseSuccesses: 0,
      brakeAttempts: 0,
      brakeSuccesses: 0,
      startupAttempts: 0,
      startupSuccesses: 0,
      axisQualityAttempts: 0,
      axisQualitySuccesses: 0,
      axisQualityAttemptsByAxis: {},
      axisQualitySuccessesByAxis: {},
      candidateReleaseCoverage: emptyCandidateReleaseCoverage(),
      candidatePreviewCoverage: emptyCandidatePreviewCoverage(),
      rescueAttempts: 0,
      rescueSuccesses: 0,
      skips: 0,
      deferredSkips: 0,
      startRanksSeen: new Set<number>(),
      startRanksWithFits: new Set<number>(),
    };
    let activeCandidateWorkBaseline: CandidateWorkSnapshot | null =
      budgetTelemetryLevel === "off" ? null : emptyCandidateWorkSnapshot();
    const refreshActiveCandidateWork = (): void => {
      if (activeCandidateWorkBaseline === null) return;
      budgetRecorder.setActiveCandidateWork(
        candidateWorkSince(activeCandidateWorkBaseline, snapshotCandidateWork()),
      );
    };
    const finishActiveCandidateWork = (): void => {
      refreshActiveCandidateWork();
      activeCandidateWorkBaseline = null;
    };
    const beginCandidateWork = (): void => {
      activeCandidateWorkBaseline = budgetTelemetryLevel === "off"
        ? null
        : snapshotCandidateWork();
    };
    const polishEnabled = opts.polish ?? false;
    const stopAfterFirstCompletion = opts.stopAfterFirstCompletion ?? false;
    let polishTried = 0;
    let polishChanged = 0;
    let polishAdopted = 0;
    const evaluationCache = new WeakMap<SearchNode, NodeEvaluation>();
    const consideredSearchNodes = new WeakSet<SearchNode>();
    let captured: CompileCheckpoint | null = null;

    // Track-repair: always available, budget-gated. Completion-triggered (R2): the main
    // search runs only until the first complete track (frame count `firstCompletionFrame`),
    // then a post-pass spends the REST of the budget restarting the real frontier-DFS from
    // the weakest gap of the complete incumbent (see runRepairPhase). `bestCompleteNode` is
    // the live incumbent HandoffNode (updated on every register improvement) so repair can
    // replay its fits to reconstruct any prefix node for free (extendNodeCached memoizes).
    const repair = repairConfig();
    repairTargetSearchTotals = emptyRepairTargetSearchTotals(repair.suffixSearchPolicy);
    const repairEnabled = repairBudgetLimit >= repair.minBudget && startOptions.length > 0;
    let bestCompleteNode: HandoffNode | null = null;
    let incumbentRevision = 0;
    // `BestSoFarRegister` intentionally owns only the public output. Keep the
    // matching node solely so snapshot-time diagnostics can validate the exact
    // selected transitions without re-running physics or instrumenting every
    // candidate considered by the search.
    let bestRegisteredNode: HandoffNode | null = null;
    let firstTerminalFrame = -1;
    let firstCompletionFrame = -1;
    let firstTerminalTrackHash: string | null = null;
    let pendingDeferredValueDecision: SelectiveDeferredValueDecision<HandoffNode> | null = null;
    // Observation-only reach timestamps used by the incumbent cost-to-end
    // estimator and detailed repair diagnostics. Authoritative execution and
    // outcome accounting lives in budgetTelemetry V5 episodes; compile_stats
    // is not a second repair ledger.
    const framesAtReach = new WeakMap<SearchNode, number>();
    // Second reach map for the OTHER producer of incumbent nodes. `framesAtReach`
    // above stamps only nodes the frontier processes, but the near-tail completion
    // pass builds its own suffix nodes and is where first completion routinely
    // lands, so every incumbent node past the deepest processed one had no
    // timestamp at all and the measured cost-to-end profile fell back to -1 there.
    // Both maps answer the same question — the charged work at which that node
    // first existed on the search's path — so repair reads them as one profile.
    const framesAtReachTail = new WeakMap<SearchNode, number>();
    type ActiveRepairProfile = {
      anchorGapIndex: number;
      baseCostToEnd: readonly number[];
      reachFrames: WeakMap<SearchNode, number>;
    };
    let activeRepairProfile: ActiveRepairProfile | null = null;
    // Stamped at construction, inside the charged tail attempt that built the
    // node. Gated exactly like `framesAtReach`, so the low-budget hot path
    // stays free; the gate is the repair phase, never the telemetry level, so
    // off/summary/trace do identical work.
    const stampTailReach = (search: SearchNode): void => {
      if (repairEnabled && !framesAtReachTail.has(search)) {
        framesAtReachTail.set(search, getSimFrames());
      }
      if (activeRepairProfile !== null && !activeRepairProfile.reachFrames.has(search)) {
        activeRepairProfile.reachFrames.set(search, getSimFrames());
      }
    };
    // The charged-frame stamp at which a node FIRST existed, from either
    // producer. A node can be stamped by BOTH maps: the tail pass builds a
    // suffix node (stamping `framesAtReachTail`), and the frontier later pops
    // the same memoized object (`extendNodeCached` returns shared identities)
    // and stamps `framesAtReach` at a strictly later frame count. The merge
    // must therefore take the EARLIEST stamp — a `??` preferring the frontier
    // map returned the LATER one for such nodes, understating costToEnd at
    // exactly the tail-created anchors the second map was added to serve.
    const firstReachOf = (n: SearchNode): number | undefined => {
      const frontier = framesAtReach.get(n);
      const tail = framesAtReachTail.get(n);
      return frontier === undefined
        ? tail
        : tail === undefined
        ? frontier
        : Math.min(frontier, tail);
    };
    // Every adopted terminal owns the cost-to-end profile that was observed
    // while producing that exact path. An accepted repair reuses its prefix,
    // so prefix costs splice the previous prefix marginal work onto the newly
    // measured suffix cost. This avoids the old error of subtracting every
    // later terminal from the compile-global first-reach clock.
    const incumbentCostProfiles = new WeakMap<SearchNode, readonly number[]>();
    const buildObservedCostToEnd = (
      incumbent: HandoffNode,
      terminalFrame: number,
      repairProfile: ActiveRepairProfile | null,
    ): number[] => {
      const root = startOptions.find((option) => option.rank === incumbent.startRank)?.root;
      if (root === undefined) return [];
      const costToEnd: number[] = [];
      let node = root;
      for (let gapIndex = 0; gapIndex <= gaps.length; gapIndex++) {
        const reach = repairProfile?.reachFrames.get(node) ??
          (repairProfile === null ? firstReachOf(node) : undefined);
        costToEnd[gapIndex] = reach !== undefined && reach <= terminalFrame
          ? Math.max(0, terminalFrame - reach)
          : -1;
        if (gapIndex < gaps.length) {
          node = extendNodeCached(node, incumbent.search.prefixFits[gapIndex] ?? null);
        }
      }
      return repairProfile === null
        ? costToEnd
        : spliceRepairCostToEnd(
          costToEnd,
          repairProfile.baseCostToEnd,
          repairProfile.anchorGapIndex,
        );
    };
    const buildTrackCostToEnd = (track: HandoffNode): number[] => {
      const stored = incumbentCostProfiles.get(track.search);
      if (stored !== undefined) return [...stored];
      return buildObservedCostToEnd(track, getSimFrames(), null);
    };
    // The incumbent's MEASURED cost-to-end profile, published here so the
    // deadline margin can use it as its post-completion estimate: after first
    // completion the structural suffix answers a question nobody is asking any
    // more, while this profile is the measured work from gap k to the end on
    // the path the compile actually took.
    //
    // It is updated at every adopted terminal, including inside repair, so the
    // next iteration and the post-completion deadline signal read the current
    // incumbent rather than the first completion forever.
    let incumbentCostToEnd: readonly number[] | null = null;
    // Count of complete tracks ever considered (any phase). A repair restart's delta tells us whether
    // it REACHED the end at all (completed), separate from whether it beat the incumbent (accepted).
    let terminalConsiders = 0;
    let lastTerminalNode: HandoffNode | null = null;
    type PendingRejectedLocalBridge = {
      node: HandoffNode;
      costToEnd: readonly number[];
      parentEpisodeId: number | null;
    };
    let pendingRejectedLocalBridge: PendingRejectedLocalBridge | null = null;
    // SUBSEQUENT-TERMINAL CHURN. (The "two-counters window" reading this block
    // was built to measure is FALSIFIED — 4,406/4,406 compiles across both
    // N=48 archives and every probe: `firstTerminalFrame` equals
    // `firstCompletionFrame` on all of them, because the register ranks
    // `contract_passed` first (register.ts `isStrictlyBetter`) and a structural
    // terminal (`gapIndex === gaps.length`) passes the contract by
    // construction, so the FIRST terminal always improves. There is no window;
    // the estimator's fit target and the controller's phase flip are the same
    // event.) What this counter actually measures is how much of the
    // post-completion budget re-derives a complete track that does not beat
    // the incumbent's axis_quality — overwhelmingly repair restarts and
    // tail-completion re-walks: a repair-ROI number, 95.6% of terminal
    // considers at N=48 scale. See docs/forward-eval-metrics.md.
    let terminalConsidersWithoutImprovement = 0;
    const evaluateCached = (node: HandoffNode): NodeEvaluation => {
      const cached = evaluationCache.get(node.search);
      if (cached !== undefined) return cached;
      const evaluation = evaluateNode(node, spec, gaps, allContactFrames, durationFrames, gapAxisTargets);
      evaluationCache.set(node.search, evaluation);
      return evaluation;
    };

    const consider = (
      node: HandoffNode,
      phase: HandoffNodeEventPhase,
    ): ConsiderResult | null => {
      if (node.search.gapIndex > telemetry.deepestSeenGap) {
        telemetry.deepestSeenGap = node.search.gapIndex;
        if (telemetry.firstProgressFrame === null && node.search.gapIndex > 0) {
          telemetry.firstProgressFrame = getSimFrames();
        }
      }
      telemetry.startRanksSeen.add(node.startRank);
      if (node.search.prefixFits.some((fit) => fit !== null)) {
        telemetry.startRanksWithFits.add(node.startRank);
      }
      if (canSkipPartialEvaluation(node, gaps, register)) return null;
      const evaluation = evaluateCached(node);
      const firstTimeSearchNode = recordEvaluationTelemetry(
        telemetry,
        consideredSearchNodes,
        node.search,
        evaluation.fullDuration,
        phase,
      );
      const output = buildNodeOutput(
        node,
        evaluation.report,
        gaps,
        evaluation.outputDurationFrames,
        false,
      );
      const improved = register.consider(
        output,
        evaluation.key,
      );
      if (improved) bestRegisteredNode = node;
      recordImprovementTelemetry(telemetry, phase, improved);
      const terminal = isTerminalNode(node.search, gaps);
      if (terminal) {
        lastTerminalNode = node;
        terminalConsiders++;
        if (!improved) terminalConsidersWithoutImprovement++;
        if (firstTerminalFrame < 0) {
          firstTerminalFrame = getSimFrames();
          firstTerminalTrackHash = sha256Json(output.track);
        }
        // Terminal search nodes may stop before the unscored tail gap. For
        // completion telemetry the remaining traversal work is nevertheless
        // zero once the terminal has been considered.
      }
      budgetRecorder.recordEvaluation({
        totalSpentFrames: getSimFrames(),
        gapIndex: terminal ? gaps.length : node.search.gapIndex,
        terminal,
        origin: phase,
        firstTimeSearchNode,
        terminalTrackKey: terminal ? JSON.stringify(output.track) : null,
        registerImproved: improved,
      });
      if (improved && terminal) {
        const firstImprovingTerminal = firstCompletionFrame < 0;
        bestCompleteNode = node;
        incumbentRevision++;
        if (firstImprovingTerminal) {
          firstCompletionFrame = getSimFrames();
        }
        const adoptedCostToEnd = buildObservedCostToEnd(
          node,
          getSimFrames(),
          activeRepairProfile,
        );
        incumbentCostProfiles.set(node.search, adoptedCostToEnd);
        incumbentCostToEnd = adoptedCostToEnd;
        telemetry.hasCompletion = true;
        if (firstImprovingTerminal) {
          if (firstTerminalTrackHash === null) {
            throw new Error("first improving terminal has no terminal track identity");
          }
          pendingDeferredValueDecision =
            selectiveBacktracking?.assessDeferredValueAtFirstTerminal({
            incumbent: node,
            firstTerminalTotalSpentFrames: getSimFrames(),
            firstTerminalTrackHash,
            remainingHardBudgetFrames: Math.max(0, targetBudget - getSimFrames()),
            remainingRepairBudgetFrames: Math.max(
              0,
              repairBudgetLimit - getSimFrames(),
            ),
            searchPolicyBudgetFrames: searchPolicyBudget,
            explorationAllowanceFrames: Math.floor(
              (frontierTraversalPolicy ===
                    "selective_axis_regret_catchup_value_deferred_initial" ||
                  frontierTraversalPolicy ===
                    "selective_axis_regret_catchup_value_deferred_pass_only" ||
                  frontierTraversalPolicy ===
                    "selective_axis_regret_catchup_value_deferred_prefix_gate"
                ? SELECTIVE_DEFERRED_VALUE_LIVE_ALLOWANCE_FRACTION
                : SELECTIVE_DEFERRED_VALUE_MAP_MAX_ALLOWANCE_FRACTION) *
                searchPolicyBudget,
            ),
            currentOnIncumbentPath: (current, incumbent) =>
              current.startRank === incumbent.startRank &&
              current.search.gapIndex <= incumbent.search.gapIndex &&
              current.search.prefixFits.every((fit, gapIndex) =>
                fit === incumbent.search.prefixFits[gapIndex]
              ),
            alternativeAvailable: (alternative) =>
              frontierContains(alternative, passStack, fallbackStack),
            estimatedSuffixWorkFrames: (alternative) =>
              conservativeDeadlineWorkAtGap(alternative.search.gapIndex),
          }) ?? null;
        }
      }
      const event: HandoffNodeEvent = {
        phase,
        simFrames: getSimFrames(),
        fullDuration: evaluation.fullDuration,
        outputDurationFrames: evaluation.outputDurationFrames,
        improved,
        improvementCount: register.improvementCount,
        consideredCount: register.consideredCount,
      };
      opts.onNode?.(node, evaluation.key, event);
      return { key: evaluation.key, event };
    };

    const snapshot = (budget: number, budgetExhausted: boolean): CompileCheckpoint => {
      const best = register.getBest();
      if (best === null) {
        throw new Error(
          `compileHandoff: no prefix output could be evaluated ` +
          `(seed=${seed}, budget=${budget}, sim_frames_used=${getSimFrames()})`,
        );
      }
      const arcStats = snapshotArcPlacementStats();
      if (arcStats.impact_active_carrier_law !== undefined) {
        arcStats.impact_active_carrier_final_lines = best.track.lines.reduce(
          (count, line) => count + (line.type === 1 ? 1 : 0),
          0,
        );
      }
      if (arcStats.impact_carrier_ripple_law !== undefined) {
        arcStats.impact_carrier_ripple_final_lines = best.track.lines.reduce(
          (count, line) => count + (line.type === 1 ? 1 : 0),
          0,
        );
      }
      const aimStats = snapshotAimStats();
      const detectorRunwayStats = snapshotDetectorRunwayStats();
      recordContactTransitionFinalTrack(best.track.lines);
      const contactTransitionStats = snapshotContactTransitionStats();
      const impactResponseAdmissionStats = snapshotImpactResponseAdmissionStats();
      if (impactResponseAdmissionStats !== null) {
        impactResponseAdmissionStats.final_selected = bestRegisteredNode?.search.prefixFits.reduce(
          (count, fit) => count +
            (fit !== null && impactResponseAdmittedCandidates.has(fit as Candidate) ? 1 : 0),
          0,
        ) ?? 0;
        if (impactResponseAdmissionMode() === "same-speed-active-tail-repair") {
          impactResponseAdmissionStats.active_repair_final_lines = best.track.lines.reduce(
            (count, line) => count + (line.type === 1 ? 1 : 0),
            0,
          );
        }
      }
      const impactRepairInsuranceStats = snapshotImpactRepairInsuranceStats();
      if (impactRepairInsuranceStats !== null) {
        impactRepairInsuranceStats.final_selected = bestRegisteredNode?.search.prefixFits.reduce(
          (count, fit) => count +
            (fit !== null && impactRepairInsuredCandidates.has(fit as Candidate) ? 1 : 0),
          0,
        ) ?? 0;
      }
      const kinematicSupportStats = snapshotKinematicSupportStats();
      const releaseExitStats = snapshotReleaseExitStats();
      const gapfitShortStats = snapshotGapfitShortStats();
      const fwdEvalStats = snapshotFwdEvalStats();
      const deadlinePoolStats = readDeadlinePoolCounters();
      const selectedTransitionStats = bestRegisteredNode === null
        ? null
        : selectedBallisticTransitionStats(
          paddedFits(bestRegisteredNode, gaps.length),
          gaps,
          gapAxisTargets,
        );
      return {
        ...best,
        budget,
        budgetTelemetry: (() => {
          refreshActiveCandidateWork();
          return budgetRecorder.snapshot(
          getSimFrames(),
          budgetExhausted,
          firstTerminalFrame >= 0 ? firstTerminalFrame : null,
          firstCompletionFrame >= 0 ? firstCompletionFrame : null,
          );
        })(),
        stats: {
          ...best.stats,
          actual_candidate_samples: getCandidateSamples(),
          viable_candidate_samples: getViableCandidates(),
          budget_exhausted: budgetExhausted,
          sim_frames: getSimFrames(),
          ballistic_micro_sim_frames: getMicroSimFrames(),
          ...objectiveLayerSpreadStat(),
          traversal_budget_model: TRAVERSAL_BUDGET_MODEL_V1.name,
          predicted_first_completion_frames: predictedFirstCompletionFrames,
          budget_slack: budgetSlackTelemetry,
          ...snapshotNumericPolicyStats("handoff_requested_normal_proposals_per_ranked_option_call", telemetry.policyNCand),
          ...snapshotNumericPolicyStats("handoff_policy_branch_limit", telemetry.policyBranchLimit),
          first_completion_frame: firstTerminalFrame >= 0 ? firstTerminalFrame : null,
          handoff_first_terminal_track_hash: firstTerminalTrackHash,
          leaves_considered: register.consideredCount,
          improvements: register.improvementCount,
          polish_variants_tried: polishTried,
          polish_variants_changed: polishChanged,
          polish_variants_adopted: polishAdopted,
          search_nodes_expanded: telemetry.nodesExpanded,
          frontier_max_size: telemetry.frontierMaxSize,
          ...snapshotFrontierStats(passStack, fallbackStack, telemetry),
          handoff_partial_evaluations: telemetry.partialEvaluations,
          handoff_full_evaluations: telemetry.fullEvaluations,
          handoff_evaluations_by_phase: snapshotPhaseCounter(telemetry.evaluationsByPhase),
          handoff_full_evaluations_by_phase: snapshotPhaseCounter(telemetry.fullEvaluationsByPhase),
          handoff_improvements_by_phase: snapshotPhaseCounter(telemetry.improvementsByPhase),
          handoff_unique_full_evaluations: uniqueFullEvaluations(telemetry),
          handoff_duplicate_evaluations: telemetry.duplicateEvaluations,
          handoff_duplicate_full_evaluations: telemetry.duplicateFullEvaluations,
          handoff_duplicate_evaluations_by_phase:
            snapshotPhaseCounter(telemetry.duplicateEvaluationsByPhase),
          handoff_duplicate_full_evaluations_by_phase:
            snapshotPhaseCounter(telemetry.duplicateFullEvaluationsByPhase),
          handoff_tail_completion_attempts: telemetry.tailCompletionAttempts,
          handoff_tail_completion_successes: telemetry.tailCompletionSuccesses,
          handoff_tail_completion_improvements: telemetry.tailCompletionImprovements,
          handoff_tail_completion_attempts_by_remaining_contacts:
            snapshotContactCountCounter(telemetry.tailCompletionAttemptsByRemainingContacts),
          handoff_tail_completion_successes_by_remaining_contacts:
            snapshotContactCountCounter(telemetry.tailCompletionSuccessesByRemainingContacts),
          handoff_tail_completion_improvements_by_remaining_contacts:
            snapshotContactCountCounter(telemetry.tailCompletionImprovementsByRemainingContacts),
          handoff_start_options: startOptions.length,
          handoff_start_rank: best.stats.handoff_start_rank ?? 0,
          handoff_start_ranks_seen: telemetry.startRanksSeen.size,
          handoff_start_ranks_with_fits: telemetry.startRanksWithFits.size,
          handoff_previews: telemetry.previews,
          handoff_preview_contacts: telemetry.previewContacts,
          handoff_preview_survivors: telemetry.previewSurvivors,
          handoff_reuse_attempts: telemetry.reuseAttempts,
          handoff_reuse_successes: telemetry.reuseSuccesses,
          handoff_brake_attempts: telemetry.brakeAttempts,
          handoff_brake_successes: telemetry.brakeSuccesses,
          handoff_startup_attempts: telemetry.startupAttempts,
          handoff_startup_successes: telemetry.startupSuccesses,
          handoff_axis_quality_attempts: telemetry.axisQualityAttempts,
          handoff_axis_quality_successes: telemetry.axisQualitySuccesses,
          handoff_axis_quality_by_axis: snapshotAxisQualityByAxis(telemetry),
          handoff_axis_quality_air_attempts: telemetry.axisQualityAttemptsByAxis.air ?? 0,
          handoff_axis_quality_air_successes: telemetry.axisQualitySuccessesByAxis.air ?? 0,
          handoff_rescue_attempts: telemetry.rescueAttempts,
          handoff_rescue_successes: telemetry.rescueSuccesses,
          handoff_skips: best.stats.handoff_skips ?? 0,
          handoff_skip_branches: telemetry.skips,
          handoff_deferred_skips: telemetry.deferredSkips,
          handoff_far_back_pulses: telemetry.farBackPulses,
          handoff_search_seed: best.stats.handoff_search_seed ?? searchSeed,
          ...(selectiveBacktracking === null
            ? {}
            : { handoff_selective_backtracking: selectiveBacktracking.snapshot() }),
          ...(repairAxisBranchBound === null
            ? {}
            : {
              handoff_repair_axis_branch_bound:
                repairAxisBranchBound.snapshot(getSimFrames()),
            }),
          ...snapshotCandidateReleaseCoverage(telemetry),
          ...snapshotCandidatePreviewCoverage(telemetry),
          ...(arcStats ? { arc_placement: arcStats } : {}),
          // Enumerative-proposer funnel + prediction accuracy
          // (optimizer/aim.ts). Absent when the lane never ran
          // (LR_AIM_ENUM=0) — ablation archives stay byte-identical.
          ...(aimStats !== null ? { aim: aimStats } : {}),
          ...(detectorRunwayStats !== null ? { contact_phase: detectorRunwayStats } : {}),
          ...(contactTransitionStats !== null ? { contact_transition: contactTransitionStats } : {}),
          ...(impactResponseAdmissionStats !== null
            ? { impact_response_admission: impactResponseAdmissionStats }
            : {}),
          ...(impactRepairInsuranceStats !== null
            ? { impact_repair_insurance: impactRepairInsuranceStats }
            : {}),
          ...snapshotRepairTargetSearchStats(),
          ...(kinematicSupportStats !== null ? { kinematic_support: kinematicSupportStats } : {}),
          // Geometric-exit release-read funnel (core/candidate.ts): the
          // fallback-rate monitor. Absent under LR_RANK_QUALITY=off (no read
          // taken) → escape-hatch archives stay byte-identical.
          ...(releaseExitStats !== null ? { release_exit: releaseExitStats } : {}),
          // Short-horizon gap-fit funnel (core/candidate.ts): truncated vs full
          // evals + frames saved.
          ...(gapfitShortStats !== null ? { gapfit_short: gapfitShortStats } : {}),
          // Forward-eval cost + agreement instrument (MEASURE-ONLY, optimizer/handoff.ts):
          // rollout frame cost share + true-rollout-vs-quality-objective agreement. Absent
          // when forward-eval never ran (gate off) → ablation archives stay byte-identical.
          ...(fwdEvalStats !== null ? { fwd_eval: fwdEvalStats } : {}),
          // Deadline-signal instrument (MEASURE-ONLY, optimizer/handoff.ts +
          // optimizer/deadline.ts). Unconditional: every compile builds pools
          // and reads the margin, so an archive without these counters is an
          // archive that cannot say what pressure the compile ran under.
          deadline: {
            ...deadlinePoolStats,
            deadline_terminal_considers: terminalConsiders,
            deadline_terminal_without_improvement: terminalConsidersWithoutImprovement,
            deadline_first_terminal_frame: firstTerminalFrame >= 0 ? firstTerminalFrame : null,
            deadline_first_improving_terminal_frame:
              firstCompletionFrame >= 0 ? firstCompletionFrame : null,
          },
          ...(selectedTransitionStats === null
            ? {}
            : { ballistic_selected_transitions: selectedTransitionStats }),
        },
      };
    };

    // Capture the single requested budget the first time sim-frames reach it, at
    // the exact loop checkpoint the anytime path captured it — this verbatim timing
    // is what keeps a scalar run byte-identical to the old anytime checkpoint.
    const captureReachedBudget = (): void => {
      if (captured === null && getSimFrames() >= targetBudget) {
        captured = snapshot(targetBudget, true);
      }
    };
    const captureFirstCompletion = (terminal: boolean, result: ConsiderResult | null): boolean => {
      if (!stopAfterFirstCompletion || !terminal || result === null) return false;
      captured = snapshot(targetBudget, false);
      return true;
    };
    // Per-node work shared by every traversal mode (DFS today, best-first next):
    // consider the node + its speculative tail, check the budget, polish terminals, and
    // expand into ranked children. It mutates the register/telemetry/budget exactly as the
    // old inline loop did. It does NOT touch the frontier container — the caller enqueues
    // the returned children.
    type ProcessOutcome =
      | { kind: "captured" }
      | { kind: "terminal_limit" }
      | { kind: "deferred" }
      | { kind: "selective_backtrack"; decision: SelectiveBacktrackDecision<HandoffNode> }
      | { kind: "expanded"; children: HandoffNode[] };
    type ProcessResult = ProcessOutcome & {
      /** Actual primary normal-pool nCand for this atomic contact expansion.
       * Null when this disposition did not expand a contact pool. */
      primaryNormalRequestedProposals: number | null;
    };
    let activeTerminalConsiderLimit: number | null = null;
    let observedAtomicCostPerCandidateUpper = 0;
    const deadlineMarginAt = (search: SearchNode): number =>
      deadline.marginAt({
        spentFrames: getSimFrames(),
        gapIndex: firstCompletionFrame >= 0
          ? search.gapIndex
          : telemetry.deepestSeenGap,
        costToEnd: incumbentCostToEnd,
      });
    const conservativeDeadlineMarginAtGap = (gapIndex: number): number =>
      deadline.conservativeMarginAt({
        spentFrames: getSimFrames(),
        gapIndex,
        costToEnd: incumbentCostToEnd,
      });
    const conservativeDeadlineWorkAtGap = (gapIndex: number): number =>
      deadline.conservativeWorkAt({ gapIndex, costToEnd: incumbentCostToEnd });
    const resolvePolicy = (search: SearchNode): HandoffSearchPolicy =>
      resolveHandoffSearchPolicy({
        node: search,
        gaps,
        ctx,
        targetProfile,
        telemetry,
        sparseContactCadence,
        targetBudget: resumedSearchShapeBudget ?? searchPolicyBudget,
        budgetSlack: resumedSearchShapeBudget === null
          ? budgetSlack
          : traversalBudgetSlack(resumedSearchShapeBudget, spec),
        // Before first completion the compile is racing to the end and its
        // own high water is what is left to cover; after it, this pass is a
        // restart from an anchor and only THIS node's depth says how far it
        // still has to go. The margin survives that switch, where the paced
        // slack it replaced became Infinity — so the 46.3% of a 750k budget
        // that runs post-completion now has a signal. Phase 1a keeps the two
        // pool-affecting CONSUMERS pre-completion (see the boundary in
        // `rankedOptions`); the signal is live throughout and observable.
        //
        // `incumbentCostToEnd` is non-null exactly when a completion has been
        // adopted (both are written in the same branch of `consider`), so the
        // profile IS the phase flag the margin reads — it never sees the
        // post-completion gap index with a pre-completion (null) profile.
        deadlineMargin: deadlineMarginAt(search),
        hasCompletion: firstCompletionFrame >= 0,
      });
    const processNode = (
      node: HandoffNode,
      lane: FrontierTraversalLane,
      alternativeAvailable: (candidate: HandoffNode) => boolean,
      resumeSuspendedContinuation: boolean,
      traversalCanContinue: () => boolean,
      executionCeilingFrames: number,
      allowSelectiveBacktracking = true,
      allowSpeculativeTailCompletion = true,
      policyTransform?: (policy: HandoffSearchPolicy) => HandoffSearchPolicy,
      pruneRepairDominatedSubtree = false,
    ): ProcessResult => {
      const atomicStart = getSimFrames();
      const registerImprovementsBefore = register.improvementCount;
      const terminalConsidersBefore = terminalConsiders;
      const tailAttemptsBefore = telemetry.tailCompletionAttempts;
      const tailFullBefore = telemetry.fullEvaluationsByPhase.tail_completion;
      const tailDuplicateFullBefore = telemetry.duplicateFullEvaluationsByPhase.tail_completion;
      const tailImprovementsBefore = telemetry.improvementsByPhase.tail_completion;
      const poolBuildsBefore = telemetry.candidatePoolRequests.count;
      const requestedProposalsBefore = telemetry.candidatePoolRequests.sum;
      const nodesExpandedBefore = telemetry.nodesExpanded;
      let afterMain = atomicStart;
      let afterTail = atomicStart;
      let atomicPolicy: HandoffSearchPolicy | null = null;
      const finishAtomic = <T extends ProcessOutcome>(
        result: T,
      ): T & Pick<ProcessResult, "primaryNormalRequestedProposals"> => {
        const end = getSimFrames();
        if (atomicPolicy !== null && atomicPolicy.nCand > 0 && end > atomicStart) {
          observedAtomicCostPerCandidateUpper = Math.max(
            observedAtomicCostPerCandidateUpper,
            (end - atomicStart) / atomicPolicy.nCand,
          );
        }
        budgetRecorder.recordNodeWork({
          rankedOptionCalls: telemetry.candidatePoolRequests.count - poolBuildsBefore,
          requestedNormalProposals: telemetry.candidatePoolRequests.sum - requestedProposalsBefore,
          nodesExpanded: telemetry.nodesExpanded - nodesExpandedBefore,
          childrenEnqueued: result.kind === "expanded" ? result.children.length : 0,
        });
        budgetRecorder.recordAtomicNode({
          gap_index: node.search.gapIndex,
          remaining_contacts: remainingContactCount(node.search, gaps),
          start_total_spent_frames: atomicStart,
          requested_normal_proposals: atomicPolicy?.nCand ?? null,
          child_limit: atomicPolicy?.branchLimit ?? null,
          frontier_evaluation_frames: afterMain - atomicStart,
          tail_completion_frames: afterTail - afterMain,
          post_tail_work_frames: end - afterTail,
          spent_frames: end - atomicStart,
          // Budget Telemetry V11's atomic result is a disposition, not the
          // policy cause. Selective suspension is therefore `deferred`; its
          // exact causal event lives in the opt-in frontier-policy telemetry.
          result: result.kind === "selective_backtrack" ? "deferred" : result.kind,
          register_improvements: register.improvementCount - registerImprovementsBefore,
          terminal_node_evaluations: terminalConsiders - terminalConsidersBefore,
          tail_attempts: telemetry.tailCompletionAttempts - tailAttemptsBefore,
          tail_terminal_evaluations:
            telemetry.fullEvaluationsByPhase.tail_completion - tailFullBefore,
          tail_duplicate_terminal_evaluations:
            telemetry.duplicateFullEvaluationsByPhase.tail_completion - tailDuplicateFullBefore,
          tail_improvements:
            telemetry.improvementsByPhase.tail_completion - tailImprovementsBefore,
        });
        return {
          ...result,
          primaryNormalRequestedProposals:
            result.kind === "expanded" &&
              node.startExpanded &&
              gaps[node.search.gapIndex]?.endsWithContact === true
              ? atomicPolicy?.nCand ?? null
              : null,
        };
      };
      budgetRecorder.observeActiveEpisode(node.search.gapIndex, getSimFrames());
      // Only tracked when repair can consume it (>=150k); a no-op on the low-budget hot path.
      if (repairEnabled && !framesAtReach.has(node.search)) framesAtReach.set(node.search, getSimFrames());
      if (activeRepairProfile !== null && !activeRepairProfile.reachFrames.has(node.search)) {
        activeRepairProfile.reachFrames.set(node.search, getSimFrames());
      }
      const nodeTerminal = isTerminalNode(node.search, gaps);
      // A selectively suspended node was already considered before its branch
      // switch. Resume at the expansion boundary: do not duplicate detector
      // work, register offers, or evaluation telemetry merely because the
      // scheduler revisited the same prefix object.
      const mainResult = resumeSuspendedContinuation ? null : consider(node, "frontier");
      afterMain = getSimFrames();
      afterTail = afterMain;
      if (nodeTerminal) {
        selectiveBacktracking?.observeRouteLeaseTerminal(node, getSimFrames());
      }
      if (!resumeSuspendedContinuation && captureFirstCompletion(nodeTerminal, mainResult)) {
        return finishAtomic({ kind: "captured" });
      }
      if (
        activeTerminalConsiderLimit !== null &&
        terminalConsiders >= activeTerminalConsiderLimit
      ) {
        return finishAtomic({ kind: "terminal_limit" });
      }
      // A repair-only branch-and-bound decision occurs after the already-built
      // prefix is offered to the register, but before any speculative tail,
      // candidate pool, child, or selective excursion is charged beneath it.
      // The caller proved that even zero error on every remaining authored axis
      // cannot match the complete incumbent, so an empty child set discards
      // exactly this incapable subtree and leaves ordinary frontier order intact.
      if (pruneRepairDominatedSubtree && !nodeTerminal) {
        return finishAtomic({ kind: "expanded", children: [] });
      }
      if (
        allowSelectiveBacktracking &&
        selectiveBacktracking !== null &&
        !nodeTerminal &&
        node.skippedContacts === 0
      ) {
        const decision = selectiveBacktracking.consider({
          node,
          contactOrdinal: contactOrdinalAt(node.search.gapIndex),
          contactBoundary:
            gaps[node.search.gapIndex - 1]?.endsWithContact === true,
          gapProgress: Math.max(
            0,
            Math.min(1, node.search.gapIndex / Math.max(1, gaps.length)),
          ),
          axisLoss: authoredPrefixAxisLoss(node.search),
          incumbentAxisLoss: lane === "repair" && bestCompleteNode !== null
            ? authoredPrefixAxisLoss(bestCompleteNode.search, node.search.gapIndex)
            : null,
          repairAttemptIndex: lane === "repair" ? activeRepairIterationIndex : null,
          executionCeilingReached: !traversalCanContinue(),
          totalSpentFrames: getSimFrames(),
          lane,
          alternativeAvailable,
          alternativeDeadline: (alternative) => {
            const margin = conservativeDeadlineMarginAtGap(alternative.search.gapIndex);
            return { margin, pressured: deadlinePressure(margin) > 0 };
          },
          explorationBudgetAssessment: (
            alternative,
            fromGapIndex,
            explorationProbeFrames,
          ) => {
            const executionRemaining = Math.max(
              0,
              executionCeilingFrames - getSimFrames(),
            );
            const alternativeWork = conservativeDeadlineWorkAtGap(
              alternative.search.gapIndex,
            );
            const terminalWork = conservativeDeadlineWorkAtGap(fromGapIndex);
            const estimatedProbeWork = Math.max(0, Math.ceil(alternativeWork - terminalWork));
            const terminalReserve = Math.ceil(
              SELECTIVE_PERIODIC_TERMINAL_RESERVE_FACTOR * terminalWork,
            );
            const explorationAllowance = Math.floor(
              valueExplorationBudgetFraction(frontierTraversalPolicy) * searchPolicyBudget,
            );
            const explorationRemaining = Math.max(
              0,
              explorationAllowance - explorationProbeFrames,
            );
            const localProbeAllowance = Math.min(
              explorationRemaining,
              Math.max(0, executionRemaining - terminalReserve),
            );
            const terminalFits = estimatedProbeWork + terminalReserve <= executionRemaining;
            const explorationFits = estimatedProbeWork <= explorationRemaining;
            return {
              execution_remaining_frames: executionRemaining,
              conservative_terminal_work_frames: terminalWork,
              estimated_probe_work_frames: estimatedProbeWork,
              terminal_reserve_frames: terminalReserve,
              exploration_allowance_frames: explorationAllowance,
              exploration_spent_frames: explorationProbeFrames,
              exploration_remaining_frames: explorationRemaining,
              local_probe_allowance_frames: localProbeAllowance,
              admitted: terminalFits && explorationFits,
              reason: !terminalFits
                ? "terminal_reserve"
                : !explorationFits
                  ? "exploration_allowance"
                  : "admitted",
            };
          },
          axisWindow: (fromGapIndex, throughGapIndex) => {
            const window = authoredAxisWindow(
              node.search,
              fromGapIndex,
              throughGapIndex,
            );
            return {
              axisCount: window.axisCount,
              axisSse: window.axisSse,
              axisLoss: window.axisLoss,
            };
          },
        });
        if (decision !== null) {
          return finishAtomic({
            kind: "selective_backtrack",
            decision,
          });
        }
      }
      const resolvedPolicy = resolvePolicy(node.search);
      const policy = policyTransform?.(resolvedPolicy) ?? resolvedPolicy;
      atomicPolicy = policy;

      const tailNode = allowSpeculativeTailCompletion
        ? completeNearTail(
          node,
          gaps,
          ctx,
          telemetry,
          policy,
          resolvePolicy,
          resumedSearchShapeBudget ?? searchPolicyBudget,
          stampTailReach,
        )
        : null;
      afterTail = getSimFrames();
      if (tailNode !== null) {
        const result = consider(tailNode, "tail_completion");
        if (result?.event.improved) {
          telemetry.tailCompletionImprovements++;
          const remaining = remainingContactCount(node.search, gaps);
          incrementContactCountCounter(
            telemetry.tailCompletionImprovementsByRemainingContacts,
            remaining,
          );
        }
        if (captureFirstCompletion(isTerminalNode(tailNode.search, gaps), result)) {
          return finishAtomic({ kind: "captured" });
        }
        if (
          activeTerminalConsiderLimit !== null &&
          terminalConsiders >= activeTerminalConsiderLimit
        ) {
          return finishAtomic({ kind: "terminal_limit" });
        }
      }

      captureReachedBudget();
      if (captured !== null) return finishAtomic({ kind: "captured" });

      if (node.deferExpansion) return finishAtomic({ kind: "deferred" });

      if (
        polishEnabled &&
        isTerminalNode(node.search, gaps) &&
        node.search.prefixFits.some((fit) => fit !== null)
      ) {
        const padded = paddedFits(node, gaps.length);
        polishTried++;
        const variant = polishLeafVariant(
          padded, spec, gaps, allContactFrames, durationFrames, node.startState, node.startLines,
        );
        if (variant !== null) {
          polishChanged++;
          const polishNode: HandoffNode = {
            search: {
              ...node.search,
              prefixFits: variant.fits,
              prefixEngine: variant.engine,
            },
            startState: node.startState,
            startLines: node.startLines,
            startRank: node.startRank,
            searchSeed: node.searchSeed,
            startExpanded: node.startExpanded,
            deferExpansion: node.deferExpansion,
            rankTrace: node.rankTrace,
            skippedContacts: node.skippedContacts,
          };
          const evaluation = evaluateCached(polishNode);
          const firstTimeSearchNode = recordEvaluationTelemetry(
            telemetry,
            consideredSearchNodes,
            polishNode.search,
            evaluation.fullDuration,
            "polish",
          );
          const polishOutput = buildNodeOutput(
            polishNode,
            evaluation.report,
            gaps,
            evaluation.outputDurationFrames,
            false,
          );
          const improved = register.consider(
            polishOutput,
            evaluation.key,
          );
          terminalConsiders++;
          if (!improved) terminalConsidersWithoutImprovement++;
          if (improved) bestRegisteredNode = polishNode;
          recordImprovementTelemetry(telemetry, "polish", improved);
          budgetRecorder.recordEvaluation({
            totalSpentFrames: getSimFrames(),
            gapIndex: gaps.length,
            terminal: true,
            origin: "polish",
            firstTimeSearchNode,
            terminalTrackKey: JSON.stringify(polishOutput.track),
            registerImproved: improved,
          });
          const event: HandoffNodeEvent = {
            phase: "polish",
            simFrames: getSimFrames(),
            fullDuration: evaluation.fullDuration,
            outputDurationFrames: evaluation.outputDurationFrames,
            improved,
            improvementCount: register.improvementCount,
            consideredCount: register.consideredCount,
          };
          opts.onNode?.(polishNode, evaluation.key, event);
          if (improved) {
            polishAdopted++;
            bestCompleteNode = polishNode;
          }
        }
      }

      if (isTerminalNode(node.search, gaps)) {
        return finishAtomic({ kind: "expanded", children: [] });
      }

      const children = expandNode(
        node,
        gaps,
        ctx,
        startOptions,
        telemetry,
        policy,
        resumedSearchShapeBudget ?? searchPolicyBudget,
      );
      const contactExpansion =
        node.startExpanded &&
        node.skippedContacts === 0 &&
        gaps[node.search.gapIndex]?.endsWithContact === true &&
        children.every((child) => child.skippedContacts === 0);
      selectiveBacktracking?.observeExpansion({
        parent: node,
        children,
        contactExpansion,
        contactOrdinal: contactOrdinalAt(node.search.gapIndex),
        axisLoss: authoredPrefixAxisLoss(node.search),
        childAxisLosses: contactExpansion
          ? children.map((child) => authoredPrefixAxisLoss(child.search))
          : undefined,
      });
      telemetry.nodesExpanded++;
      return finishAtomic({ kind: "expanded", children });
    };

    // Shared frontier-DFS driver: pop → process → enqueue children, until the frontier empties,
    // the node cap is hit, or `keepGoing()` returns false. Both the main search and each repair
    // restart run on this — they differ only in their frontier stacks and stop predicate. Returns
    // early when a budget snapshot is captured (kind:"captured") so the caller's post-loop runs.
    const runFrontier = (
      pass: HandoffNode[], fb: HandoffNode[], keepGoing: () => boolean,
      lane: FrontierTraversalLane,
      executionCeilingFrames: number,
      onProcessed?: () => void,
      options: {
        allowSelectiveBacktracking?: boolean;
        allowSpeculativeTailCompletion?: boolean;
        beforeSelect?: (node: HandoffNode) => boolean;
      } = {},
    ): void => {
      const processSelected = (
        node: HandoffNode,
        resumeSuspendedContinuation: boolean,
        allowSelectiveBacktracking: boolean,
        allowSpeculativeTailCompletion = true,
        policyTransform?: (policy: HandoffSearchPolicy) => HandoffSearchPolicy,
      ): ProcessResult => {
        selectiveBacktracking?.observeRoot(node);
        if (handoffFrontierProbeHook !== null) {
          handoffFrontierProbeHook({
            simFrames: getSimFrames(),
            hasCompletion: telemetry.hasCompletion,
            deepestSeenGap: telemetry.deepestSeenGap,
            selected: frontierProbeNode(node),
            passFrontier: pass.map(frontierProbeNode),
            fallbackFrontier: fb.map(frontierProbeNode),
          });
        }
        if (handoffFrontierNodeProbeHook !== null) {
          handoffFrontierNodeProbeHook({
            simFrames: getSimFrames(),
            hasCompletion: telemetry.hasCompletion,
            deepestSeenGap: telemetry.deepestSeenGap,
            selected: node,
            passFrontier: pass,
            fallbackFrontier: fb,
          });
        }
        telemetry.frontierSelections++;
        const repairBoundAssessment =
          lane === "repair" && repairAxisBranchBound !== null && bestCompleteNode !== null
            ? (() => {
              const prefix = authoredAxisWindow(node.search);
              const gapIndex = node.search.gapIndex;
              return repairAxisBranchBound.observeSelection({
                node,
                totalSpentFrames: getSimFrames(),
                gapIndex,
                contactOrdinal: contactOrdinalAt(gapIndex),
                frontierNodes: frontierSize(pass, fb),
                eligibleCheckpoint:
                  isTerminalNode(node.search, gaps) ||
                  gaps[gapIndex - 1]?.endsWithContact === true,
                prunable: !isTerminalNode(node.search, gaps),
                prefixAxisCount: prefix.axisCount,
                prefixAxisSse: prefix.axisSse,
                prefixAxisLoss: prefix.axisLoss,
              });
            })()
            : null;
        const result = processNode(
          node,
          lane,
          (candidate) => frontierContains(candidate, pass, fb),
          resumeSuspendedContinuation,
          keepGoing,
          executionCeilingFrames,
          allowSelectiveBacktracking,
          allowSpeculativeTailCompletion,
          policyTransform,
          repairBoundAssessment?.prune ?? false,
        );
        onProcessed?.();
        return result;
      };

      /** Give policy-selected causal siblings independent bounded preferred-
       * path excursions to the suspended prefix's exact gap. A policy may stop
       * after the first strict winner; unprobed siblings stay in the ordinary
       * frontier. Rank completed equal-depth prefixes by authored-axis loss. */
      const runCatchup = (
        suspended: HandoffNode,
        decision: SelectiveBacktrackDecision<HandoffNode>,
      ): boolean => {
        selectiveBacktracking!.markSuspended(suspended);
        const probeResults: SelectiveCatchupProbeResult[] = [];
        const completed: Array<{
          node: HandoffNode;
          alternativeOrdinal: number;
          routeOrdinal: number;
          axisLoss: number;
          allCheckpointGainsPositive: boolean;
        }> = [];
        let tournamentBudgetYielded = false;
        let tournamentFirstDeficitStopped = false;
        let tournamentFirstAdvantageHandedOff = false;
        const narrowProbeBreadth = decision.triggerSignal === "value_exploration" &&
          (frontierTraversalPolicy ===
              "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q" ||
            frontierTraversalPolicy ===
              "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_empty_retry" ||
            frontierTraversalPolicy ===
              "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_after_first" ||
            frontierTraversalPolicy ===
              "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_before_last" ||
            frontierTraversalPolicy ===
              "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_positive_prefix" ||
            frontierTraversalPolicy ===
              "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_nonpositive_prefix" ||
            frontierTraversalPolicy ===
              "selective_axis_regret_catchup_value_initial_expire_10_probe_breadth_3q_no_refill");
        const probePolicyTransformAt = (
          processedContactNodes: number,
          remainingContactExpansions: number,
          latestPrefixAxisLossGain: number | null,
        ): ((policy: HandoffSearchPolicy) => HandoffSearchPolicy) | undefined =>
          narrowProbeBreadth
            ? (policy) => {
              const fullWidth = valueProbeEmptyFallbackCandidateCount(
                frontierTraversalPolicy,
                policy.nCand,
              );
              return {
                ...policy,
                nCand: valueProbeCandidateCountAtRoutePosition(
                  frontierTraversalPolicy,
                  policy.nCand,
                  HANDOFF_QUALITY_N_CAND_FLOOR,
                  processedContactNodes,
                  remainingContactExpansions,
                  latestPrefixAxisLossGain,
                ),
                ...(fullWidth === null ? {} : { normalEmptyFallbackNCand: fullWidth }),
              };
            }
            : undefined;
        const finishTournament = (
          outcome: "alternative_selected" | "current_selected" |
            "probe_dead_end" | "probe_deferred" | "probe_budget_yield" |
            "probe_first_deficit_stop" |
            "probe_first_advantage_handoff" |
            "execution_ceiling",
          selectedAlternativeOrdinal: number | null,
          selectedRouteOrdinal: number | null,
        ): void => {
          const bestAlternativeAxisLoss = completed.length === 0
            ? null
            : Math.min(...completed.map((candidate) => candidate.axisLoss));
          const bestAlternative = bestAlternativeAxisLoss === null
            ? null
            : completed.find((candidate) => candidate.axisLoss === bestAlternativeAxisLoss)!;
          const endpointWinnerPrioritySuppressed =
            frontierTraversalPolicy ===
                "selective_axis_regret_catchup_value_initial_expire_10_stable_priority" &&
            decision.triggerSignal === "value_exploration" &&
            outcome === "current_selected" &&
            bestAlternative !== null &&
            catchupAlternativeHasSufficientGain(
              decision.triggerAxisLoss,
              bestAlternative.axisLoss,
            ) &&
            !bestAlternative.allCheckpointGainsPositive;
          selectiveBacktracking!.finishCatchup(decision, {
            outcome,
            selectedAlternativeOrdinal,
            selectedRouteOrdinal,
            probes: probeResults,
            catchupAxisLoss: bestAlternativeAxisLoss,
            bestAlternativeAllCheckpointsPositive:
              bestAlternative?.allCheckpointGainsPositive ?? null,
            endpointWinnerPrioritySuppressed,
          });
        };
        const runProbe = (
          start: HandoffNode,
          routeOrdinal: number,
          routeKind: SelectiveCatchupProbeResult["route_kind"],
          alternativeOrdinal: number,
        ): boolean => {
          if (!takeFrontierNode(start, pass, fb)) {
            throw new Error("selective catch-up alternative left the synchronous frontier");
          }
          const probeStartFrames = getSimFrames();
          const rankedOptionCallsBefore = telemetry.candidatePoolRequests.count;
          const requestedNormalProposalsBefore = telemetry.candidatePoolRequests.sum;
          const candidateGeometryEvaluationsBefore = getCandidateSamples();
          const emptyRetryAttemptsBefore = telemetry.valueProbeEmptyFullWidthRetryAttempts;
          const emptyRetrySuccessesBefore = telemetry.valueProbeEmptyFullWidthRetrySuccesses;
          const emptyRetryRequestsBefore =
            telemetry.valueProbeEmptyFullWidthRetryRequestedProposals;
          const emptyRetryIncrementalRequestsBefore =
            telemetry.valueProbeEmptyFullWidthRetryIncrementalRequestedProposals;
          const emptyRetryGeometryBefore =
            telemetry.valueProbeEmptyFullWidthRetryCandidateGeometryEvaluations;
          const emptyRetryFramesBefore = telemetry.valueProbeEmptyFullWidthRetryFrames;
          const tailCompletionAttemptsBefore = telemetry.tailCompletionAttempts;
          let probe = start;
          let probeNodesProcessed = 0;
          let probeContactNodesProcessed = 0;
          let latestPrefixAxisLossGain: number | null = null;
          const atomicNodeFrames: number[] = [];
          const atomicNodePrimaryNormalRequestedProposals: Array<number | null> = [];
          const atomicNodeStartingPrefixAxisLossGain: Array<number | null> = [];
          let budgetRemainingBeforeYield: number | null = null;
          let estimatedNextNodeFrames: number | null = null;
          const localFallbackCandidates: HandoffNode[] = [];
          let allCheckpointGainsPositive = true;
          let checkpointGainsObserved = 0;
          let resumeProbe = selectiveBacktracking!.observeSelected(probe, probeStartFrames);
          const finishProbe = (
            outcome: SelectiveCatchupProbeResult["outcome"],
            axisLoss: number | null,
          ): void => {
            const seen = new Set<SearchNode>();
            let choiceOrdinal = 0;
            const recordsThisRoute = routeKind === "causal_alternative";
            const localFallbackChoices =
              outcome === "execution_ceiling" || !recordsThisRoute
              ? []
              : localFallbackCandidates.flatMap((candidate) => {
                if (
                  seen.has(candidate.search) ||
                  !frontierContains(candidate, pass, fb)
                ) {
                  return [];
                }
                seen.add(candidate.search);
                const margin = conservativeDeadlineMarginAtGap(candidate.search.gapIndex);
                if (deadlinePressure(margin) > 0) return [];
                const choice = {
                  choice_ordinal: ++choiceOrdinal,
                  gap_index: candidate.search.gapIndex,
                  remaining_gap_advance: Math.max(
                    0,
                    decision.fromGapIndex - candidate.search.gapIndex,
                  ),
                  current_relative_axis_loss_gain:
                    authoredPrefixAxisLoss(suspended.search, candidate.search.gapIndex) -
                    authoredPrefixAxisLoss(candidate.search),
                  conservative_deadline_margin: margin,
                };
                return [choice];
              });
            probeResults.push({
              route_ordinal: routeOrdinal,
              route_kind: routeKind,
              alternative_ordinal: alternativeOrdinal,
              outcome,
              end_gap_index: probe.search.gapIndex,
              probe_nodes_processed: probeNodesProcessed,
              probe_frames: getSimFrames() - probeStartFrames,
              ranked_option_calls:
                telemetry.candidatePoolRequests.count - rankedOptionCallsBefore,
              requested_normal_proposals:
                telemetry.candidatePoolRequests.sum - requestedNormalProposalsBefore,
              candidate_geometry_evaluations:
                getCandidateSamples() - candidateGeometryEvaluationsBefore,
              normal_empty_full_width_retry_attempts:
                telemetry.valueProbeEmptyFullWidthRetryAttempts - emptyRetryAttemptsBefore,
              normal_empty_full_width_retry_successes:
                telemetry.valueProbeEmptyFullWidthRetrySuccesses - emptyRetrySuccessesBefore,
              normal_empty_full_width_retry_requested_proposals:
                telemetry.valueProbeEmptyFullWidthRetryRequestedProposals -
                emptyRetryRequestsBefore,
              normal_empty_full_width_retry_incremental_requested_proposals:
                telemetry.valueProbeEmptyFullWidthRetryIncrementalRequestedProposals -
                emptyRetryIncrementalRequestsBefore,
              normal_empty_full_width_retry_candidate_geometry_evaluations:
                telemetry.valueProbeEmptyFullWidthRetryCandidateGeometryEvaluations -
                emptyRetryGeometryBefore,
              normal_empty_full_width_retry_frames:
                telemetry.valueProbeEmptyFullWidthRetryFrames - emptyRetryFramesBefore,
              atomic_node_primary_normal_requested_proposals:
                atomicNodePrimaryNormalRequestedProposals,
              atomic_node_starting_prefix_axis_loss_gain:
                atomicNodeStartingPrefixAxisLossGain,
              atomic_node_frames: atomicNodeFrames,
              tail_completion_attempts:
                telemetry.tailCompletionAttempts - tailCompletionAttemptsBefore,
              budget_allowance_frames:
                decision.explorationBudget?.local_probe_allowance_frames ?? null,
              budget_remaining_before_yield: budgetRemainingBeforeYield,
              estimated_next_node_frames: estimatedNextNodeFrames,
              axis_loss: axisLoss,
              local_fallback_choices: localFallbackChoices,
            });
          };

          while (probe.search.gapIndex < decision.fromGapIndex) {
            if (!keepGoing() || telemetry.nodesExpanded >= maxNodes) {
              finishProbe("execution_ceiling", null);
              enqueueChild(probe, pass, fb);
              for (let i = completed.length - 1; i >= 0; i--) {
                enqueueChild(completed[i]!.node, pass, fb);
              }
              enqueueChild(suspended, pass, fb);
              finishTournament("execution_ceiling", null, null);
              return true;
            }
            if (decision.triggerSignal === "value_exploration") {
              const allowance = decision.explorationBudget?.local_probe_allowance_frames;
              if (allowance === null || allowance === undefined) {
                throw new Error("value-ranked catch-up lost its local probe allowance");
              }
              const probeSpent = getSimFrames() - probeStartFrames;
              const localRemaining = Math.max(0, allowance - probeSpent);
              const remainingProbeWork = Math.max(
                0,
                Math.ceil(
                  conservativeDeadlineWorkAtGap(probe.search.gapIndex) -
                    conservativeDeadlineWorkAtGap(decision.fromGapIndex),
                ),
              );
              const remainingGapAdvance = Math.max(
                1,
                decision.fromGapIndex - probe.search.gapIndex,
              );
              const policy = resolvePolicy(probe.search);
              const observedCostEstimate = Math.ceil(
                policy.nCand * Math.max(1, observedAtomicCostPerCandidateUpper),
              );
              const suffixAverageEstimate = Math.ceil(
                remainingProbeWork / remainingGapAdvance,
              );
              const nextNodeEstimate = Math.max(
                1,
                observedCostEstimate,
                suffixAverageEstimate,
              );
              if (nextNodeEstimate > localRemaining) {
                budgetRemainingBeforeYield = localRemaining;
                estimatedNextNodeFrames = nextNodeEstimate;
                finishProbe("probe_budget_yield", null);
                enqueueChild(probe, pass, fb);
                for (let i = completed.length - 1; i >= 0; i--) {
                  enqueueChild(completed[i]!.node, pass, fb);
                }
                enqueueChild(suspended, pass, fb);
                finishTournament("probe_budget_yield", null, null);
                tournamentBudgetYielded = true;
                return false;
              }
            }
            const atomicStartFrames = getSimFrames();
            const remainingContactExpansions = Math.max(
              1,
              contactOrdinalAt(decision.fromGapIndex) -
                contactOrdinalAt(probe.search.gapIndex),
            );
            const result = processSelected(
              probe,
              resumeProbe,
              false,
              decision.triggerSignal !== "value_exploration",
              probePolicyTransformAt(
                probeContactNodesProcessed,
                remainingContactExpansions,
                latestPrefixAxisLossGain,
              ),
            );
            atomicNodeFrames.push(getSimFrames() - atomicStartFrames);
            atomicNodePrimaryNormalRequestedProposals.push(
              result.primaryNormalRequestedProposals,
            );
            atomicNodeStartingPrefixAxisLossGain.push(
              result.primaryNormalRequestedProposals === null
                ? null
                : latestPrefixAxisLossGain,
            );
            if (result.primaryNormalRequestedProposals !== null) {
              probeContactNodesProcessed++;
            }
            resumeProbe = false;
            probeNodesProcessed++;
            if (result.kind === "captured" || result.kind === "terminal_limit") {
              finishProbe("execution_ceiling", null);
              finishTournament("execution_ceiling", null, null);
              return true;
            }
            if (result.kind === "selective_backtrack") {
              throw new Error("nested selective backtrack escaped catch-up isolation");
            }
            if (result.kind === "deferred") {
              const replacement = { ...probe, deferExpansion: false };
              selectiveBacktracking!.replaceNode(probe, replacement);
              probe = replacement;
              finishProbe("probe_deferred", null);
              enqueueDeferred(probe, pass, fb);
              break;
            }

            const next = result.children.find((child) => child.skippedContacts === 0);
            for (let i = result.children.length - 1; i >= 0; i--) {
              const child = result.children[i]!;
              if (child !== next) {
                enqueueChild(child, pass, fb);
                if (
                  child.skippedContacts === 0 &&
                  child.search.gapIndex <= decision.fromGapIndex
                ) {
                  localFallbackCandidates.push(child);
                }
              }
            }
            if (next === undefined) {
              finishProbe("probe_dead_end", null);
              break;
            }
            probe = next;
            const checkpointGapIndex = probe.search.gapIndex;
            const currentAxisLoss = authoredPrefixAxisLoss(
              suspended.search,
              checkpointGapIndex,
            );
            const alternativeAxisLoss = authoredPrefixAxisLoss(probe.search);
            const alternativeAxisLossGain = currentAxisLoss - alternativeAxisLoss;
            latestPrefixAxisLossGain = alternativeAxisLossGain;
            checkpointGainsObserved++;
            if (!(alternativeAxisLossGain > 0)) allCheckpointGainsPositive = false;
            selectiveBacktracking!.recordCatchupCheckpoint(
              decision,
              routeOrdinal,
              routeKind,
              alternativeOrdinal,
              {
                gap_index: checkpointGapIndex,
                contact_advance:
                  contactOrdinalAt(checkpointGapIndex) - contactOrdinalAt(decision.branchGapIndex),
                probe_nodes_processed: probeNodesProcessed,
                probe_frames: getSimFrames() - probeStartFrames,
                current_axis_loss: currentAxisLoss,
                alternative_axis_loss: alternativeAxisLoss,
                alternative_axis_loss_gain: alternativeAxisLossGain,
              },
            );
            if (
              frontierTraversalPolicy ===
                "selective_axis_regret_catchup_value_initial_expire_10_first_advantage_handoff" &&
              decision.triggerSignal === "value_exploration" &&
              checkpointGapIndex < decision.fromGapIndex &&
              checkpointGainsObserved === 1 &&
              alternativeAxisLossGain > 0
            ) {
              finishProbe("probe_first_advantage_handoff", alternativeAxisLoss);
              finishTournament("probe_first_advantage_handoff", 1, 1);
              selectiveBacktracking!.markFirstAdvantageHandoff(probe, decision);
              // Frontier is LIFO: retain the suspended current route, then put
              // the already-better partial alternative on top for ordinary DFS.
              enqueueChild(suspended, pass, fb);
              enqueueChild(probe, pass, fb);
              tournamentFirstAdvantageHandedOff = true;
              return false;
            }
            if (
              frontierTraversalPolicy ===
                "selective_axis_regret_catchup_value_initial_expire_10_first_deficit_stop_005" &&
              decision.triggerSignal === "value_exploration" &&
              checkpointGapIndex < decision.fromGapIndex &&
              checkpointGainsObserved === 1 &&
              alternativeAxisLossGain <= -SELECTIVE_VALUE_FIRST_CHECKPOINT_DEFICIT_STOP
            ) {
              finishProbe("probe_first_deficit_stop", null);
              enqueueChild(probe, pass, fb);
              enqueueChild(suspended, pass, fb);
              finishTournament("probe_first_deficit_stop", null, null);
              tournamentFirstDeficitStopped = true;
              return false;
            }
          }

          if (probe.search.gapIndex >= decision.fromGapIndex) {
            const axisLoss = authoredPrefixAxisLoss(probe.search);
            finishProbe("reached_target", axisLoss);
            completed.push({
              node: probe,
              alternativeOrdinal,
              routeOrdinal,
              axisLoss,
              allCheckpointGainsPositive:
                checkpointGainsObserved > 0 && allCheckpointGainsPositive,
            });
          }
          return false;
        };

        let nextRouteOrdinal = 1;
        for (let alternativeIndex = 0; alternativeIndex < decision.alternatives.length;
          alternativeIndex++) {
          const routeOrdinal = nextRouteOrdinal++;
          if (runProbe(
            decision.alternatives[alternativeIndex]!,
            routeOrdinal,
            "causal_alternative",
            alternativeIndex + 1,
          )) return true;
          if (tournamentFirstAdvantageHandedOff) return false;
          if (tournamentFirstDeficitStopped) return false;
          if (tournamentBudgetYielded) return false;
        }

        if (completed.length === 0) {
          const outcome = probeResults.some((probe) => probe.outcome === "probe_dead_end")
            ? "probe_dead_end"
            : "probe_deferred";
          finishTournament(outcome, null, null);
          enqueueChild(suspended, pass, fb);
          return false;
        }

        const endpointRanked = [
          {
            node: suspended,
            alternativeOrdinal: null,
            routeOrdinal: null,
            axisLoss: decision.triggerAxisLoss,
            allCheckpointGainsPositive: true,
          },
          ...completed,
        ].sort((left, right) => {
          if (catchupAlternativeHasSufficientGain(left.axisLoss, right.axisLoss)) return 1;
          if (catchupAlternativeHasSufficientGain(right.axisLoss, left.axisLoss)) return -1;
          return (left.routeOrdinal ?? 0) - (right.routeOrdinal ?? 0);
        });
        const ranked =
            frontierTraversalPolicy ===
              "selective_axis_regret_catchup_value_initial_expire_10_stable_priority" &&
            decision.triggerSignal === "value_exploration"
          ? [...endpointRanked].sort((left, right) => {
            const leftWins = left.alternativeOrdinal !== null &&
              catchupAlternativeHasStablePriority(
                decision.triggerAxisLoss,
                left.axisLoss,
                left.allCheckpointGainsPositive,
              );
            const rightWins = right.alternativeOrdinal !== null &&
              catchupAlternativeHasStablePriority(
                decision.triggerAxisLoss,
                right.axisLoss,
                right.allCheckpointGainsPositive,
              );
            if (leftWins !== rightWins) return leftWins ? -1 : 1;
            if (left.alternativeOrdinal === null) return -1;
            if (right.alternativeOrdinal === null) return 1;
            return left.axisLoss - right.axisLoss ||
              (left.routeOrdinal ?? 0) - (right.routeOrdinal ?? 0);
          })
          : endpointRanked;
        for (let i = ranked.length - 1; i >= 0; i--) {
          enqueueChild(ranked[i]!.node, pass, fb);
        }
        const selectedAlternativeOrdinal = ranked[0]!.alternativeOrdinal;
        const selectedRouteOrdinal = ranked[0]!.routeOrdinal;
        finishTournament(
          selectedAlternativeOrdinal === null ? "current_selected" : "alternative_selected",
          selectedAlternativeOrdinal,
          selectedRouteOrdinal,
        );
        if (
          routeLeaseAudit && decision.triggerSignal === "value_exploration" &&
          selectedAlternativeOrdinal !== null && selectedRouteOrdinal !== null
        ) {
          const selectedWindow = authoredAxisWindow(ranked[0]!.node.search);
          const incumbentWindow = authoredAxisWindow(suspended.search);
          selectiveBacktracking!.markSelectedRouteLease(
            ranked[0]!.node,
            suspended,
            decision,
            {
              selectedRouteOrdinal,
              selectedAlternativeOrdinal,
              selectedTakeover: {
                axis_count: selectedWindow.axisCount,
                axis_sse: selectedWindow.axisSse,
                axis_loss: selectedWindow.axisLoss,
              },
              displacedIncumbentTakeover: {
                axis_count: incumbentWindow.axisCount,
                axis_sse: incumbentWindow.axisSse,
                axis_loss: incumbentWindow.axisLoss,
              },
            },
          );
        }
        return false;
      };

      /** Revalidate a selected route without giving either side an open-ended
       * lease. The displaced incumbent gets one isolated preferred-path probe
       * to the selected route's current gap; every sibling remains ordinary
       * frontier work and both equal-depth endpoints are retained. */
      const runRouteLeaseRevalidation = (
        current: HandoffNode,
        claim: {
          auditIndex: number;
          displacedIncumbent: HandoffNode;
          targetGapIndex: number;
          probeAllowanceFrames: number;
          estimatedProbeWorkFrames: number;
          terminalReserveFrames: number;
          executionRemainingFrames: number;
          estimatedNextNodeFrames: number;
        },
      ): boolean => {
        if (!takeFrontierNode(claim.displacedIncumbent, pass, fb)) {
          throw new Error("route-lease revalidation incumbent left the ordinary frontier");
        }
        const startFrames = getSimFrames();
        const probeAllowance = claim.probeAllowanceFrames;
        let probe = claim.displacedIncumbent;
        let resumeProbe = selectiveBacktracking!.consumeRouteLeaseRevalidationIncumbent(
          probe,
          claim.auditIndex,
          startFrames,
        );
        let probeNodesProcessed = 0;
        const finish = (
          outcome:
            | "current_selected"
            | "incumbent_selected"
            | "probe_dead_end"
            | "probe_deferred"
            | "probe_budget_yield"
            | "execution_ceiling",
          currentAxisLoss: number | null = null,
          incumbentAxisLoss: number | null = null,
          currentAxisCount: number | null = null,
          incumbentAxisCount: number | null = null,
          currentAxisSse: number | null = null,
          incumbentAxisSse: number | null = null,
        ): void => {
          selectiveBacktracking!.finishRouteLeaseRevalidation(claim.auditIndex, {
            target_gap_index: claim.targetGapIndex,
            start_total_spent_frames: startFrames,
            probe_allowance_frames: probeAllowance,
            estimated_probe_work_frames: claim.estimatedProbeWorkFrames,
            terminal_reserve_frames: claim.terminalReserveFrames,
            execution_remaining_frames: claim.executionRemainingFrames,
            preflight_estimated_next_node_frames: claim.estimatedNextNodeFrames,
            end_total_spent_frames: getSimFrames(),
            probe_nodes_processed: probeNodesProcessed,
            probe_frames: getSimFrames() - startFrames,
            outcome,
            current_axis_loss: currentAxisLoss,
            incumbent_axis_loss: incumbentAxisLoss,
            current_axis_count: currentAxisCount,
            incumbent_axis_count: incumbentAxisCount,
            current_axis_sse: currentAxisSse,
            incumbent_axis_sse: incumbentAxisSse,
          });
        };

        while (probe.search.gapIndex < claim.targetGapIndex) {
          if (!keepGoing() || telemetry.nodesExpanded >= maxNodes) {
            enqueueChild(probe, pass, fb);
            enqueueChild(current, pass, fb);
            finish("execution_ceiling");
            return false;
          }
          const probeSpent = getSimFrames() - startFrames;
          const localRemaining = Math.max(0, probeAllowance - probeSpent);
          const remainingProbeWork = Math.max(
            0,
            Math.ceil(
              conservativeDeadlineWorkAtGap(probe.search.gapIndex) -
                conservativeDeadlineWorkAtGap(claim.targetGapIndex),
            ),
          );
          const remainingGapAdvance = Math.max(
            1,
            claim.targetGapIndex - probe.search.gapIndex,
          );
          const policy = resolvePolicy(probe.search);
          const observedCostEstimate = Math.ceil(
            policy.nCand * Math.max(1, observedAtomicCostPerCandidateUpper),
          );
          const suffixAverageEstimate = Math.ceil(
            remainingProbeWork / remainingGapAdvance,
          );
          if (Math.max(1, observedCostEstimate, suffixAverageEstimate) > localRemaining) {
            enqueueChild(probe, pass, fb);
            enqueueChild(current, pass, fb);
            finish("probe_budget_yield");
            return false;
          }
          const result = processSelected(probe, resumeProbe, false, false);
          resumeProbe = false;
          probeNodesProcessed++;
          if (result.kind === "captured" || result.kind === "terminal_limit") {
            finish("execution_ceiling");
            return true;
          }
          if (result.kind === "selective_backtrack") {
            throw new Error("nested selective backtrack escaped route revalidation");
          }
          if (result.kind === "deferred") {
            const replacement = { ...probe, deferExpansion: false };
            selectiveBacktracking!.replaceNode(probe, replacement);
            enqueueDeferred(replacement, pass, fb);
            enqueueChild(current, pass, fb);
            finish("probe_deferred");
            return false;
          }
          const next = result.children.find((child) => child.skippedContacts === 0);
          for (let i = result.children.length - 1; i >= 0; i--) {
            const child = result.children[i]!;
            if (child !== next) enqueueChild(child, pass, fb);
          }
          if (next === undefined) {
            enqueueChild(current, pass, fb);
            finish("probe_dead_end");
            return false;
          }
          probe = next;
        }

        const currentWindow = authoredAxisWindow(
          current.search,
          0,
          claim.targetGapIndex,
        );
        const incumbentWindow = authoredAxisWindow(
          probe.search,
          0,
          claim.targetGapIndex,
        );
        const renewLease = (
          selected: HandoffNode,
          displaced: HandoffNode,
          selectedWindow: AuthoredAxisWindow,
          displacedWindow: AuthoredAxisWindow,
        ): void => {
          selectiveBacktracking!.resetLineageAfterRouteLeaseRevalidation(
            selected,
            displaced,
            claim.auditIndex,
            getSimFrames(),
          );
          selectiveBacktracking!.markRenewedRouteLease(
            selected,
            displaced,
            claim.auditIndex,
            getSimFrames(),
            {
              axis_count: selectedWindow.axisCount,
              axis_sse: selectedWindow.axisSse,
              axis_loss: selectedWindow.axisLoss,
            },
            {
              axis_count: displacedWindow.axisCount,
              axis_sse: displacedWindow.axisSse,
              axis_loss: displacedWindow.axisLoss,
            },
          );
        };
        if (incumbentWindow.axisLoss < currentWindow.axisLoss) {
          enqueueChild(current, pass, fb);
          enqueueChild(probe, pass, fb);
          finish(
            "incumbent_selected",
            currentWindow.axisLoss,
            incumbentWindow.axisLoss,
            currentWindow.axisCount,
            incumbentWindow.axisCount,
            currentWindow.axisSse,
            incumbentWindow.axisSse,
          );
          renewLease(probe, current, incumbentWindow, currentWindow);
        } else {
          enqueueChild(probe, pass, fb);
          enqueueChild(current, pass, fb);
          finish(
            "current_selected",
            currentWindow.axisLoss,
            incumbentWindow.axisLoss,
            currentWindow.axisCount,
            incumbentWindow.axisCount,
            currentWindow.axisSse,
            incumbentWindow.axisSse,
          );
          renewLease(current, probe, currentWindow, incumbentWindow);
        }
        telemetry.frontierMaxSize = Math.max(
          telemetry.frontierMaxSize,
          frontierSize(pass, fb),
        );
        return false;
      };

      while (frontierSize(pass, fb) > 0 && telemetry.nodesExpanded < maxNodes) {
        if (!keepGoing()) break;
        const nextNode = peekNextFrontierNode(pass, fb);
        if (options.beforeSelect !== undefined && !options.beforeSelect(nextNode)) break;
        const node = popNextFrontierNode(pass, fb);
        const routeLeaseContext = selectiveBacktracking?.routeLeaseAuditContext(node) ?? null;
        const routeLeaseEvidence = routeLeaseContext === null
          ? undefined
          : (() => {
            const wholePrefix = authoredAxisWindow(node.search);
            const divergentSuffix = authoredAxisWindow(
              node.search,
              routeLeaseContext.takeoverGapIndex,
            );
            const incumbentAvailable = frontierContains(
              routeLeaseContext.displacedIncumbent,
              pass,
              fb,
            );
            const incumbentMargin = conservativeDeadlineMarginAtGap(
              routeLeaseContext.displacedIncumbent.search.gapIndex,
            );
            return {
              wholePrefix: {
                axis_count: wholePrefix.axisCount,
                axis_sse: wholePrefix.axisSse,
                axis_loss: wholePrefix.axisLoss,
              },
              divergentSuffix: {
                axis_count: divergentSuffix.axisCount,
                axis_sse: divergentSuffix.axisSse,
                axis_loss: divergentSuffix.axisLoss,
              },
              displacedIncumbentAvailable: incumbentAvailable,
              displacedIncumbentConservativeDeadlineMargin: incumbentMargin,
              displacedIncumbentAffordableWithReserve:
                incumbentAvailable &&
                incumbentMargin >= SELECTIVE_PERIODIC_TERMINAL_RESERVE_FACTOR,
            };
          })();
        const resumeSuspendedContinuation =
          selectiveBacktracking?.observeSelected(
            node,
            getSimFrames(),
            routeLeaseEvidence,
          ) ?? false;
        const routeLeaseRollbackDecision =
          selectiveBacktracking?.claimRouteLeaseRollback(node, getSimFrames()) ?? null;
        if (routeLeaseRollbackDecision !== null) {
          if (resumeSuspendedContinuation) {
            throw new Error("route-lease rollback selected an already suspended continuation");
          }
          if (!takeFrontierNode(
            routeLeaseRollbackDecision.displacedIncumbent,
            pass,
            fb,
          )) throw new Error("route-lease rollback incumbent left the ordinary frontier");
          // Frontier is LIFO. Retain the route that crossed first, then place
          // its displaced incumbent on top for the next ordinary turn.
          enqueueChild(node, pass, fb);
          enqueueChild(routeLeaseRollbackDecision.displacedIncumbent, pass, fb);
          telemetry.frontierMaxSize = Math.max(
            telemetry.frontierMaxSize,
            frontierSize(pass, fb),
          );
          continue;
        }
        const routeLeaseRevalidationDecision =
          selectiveBacktracking?.claimRouteLeaseRevalidation(
            node,
            getSimFrames(),
            (incumbent, targetGapIndex) => {
              const executionRemainingFrames = Math.max(
                0,
                executionCeilingFrames - getSimFrames(),
              );
              const incumbentWork = conservativeDeadlineWorkAtGap(
                incumbent.search.gapIndex,
              );
              const targetWork = conservativeDeadlineWorkAtGap(targetGapIndex);
              const estimatedProbeWorkFrames = Math.max(
                0,
                Math.ceil(incumbentWork - targetWork),
              );
              const terminalReserveFrames = Math.ceil(
                SELECTIVE_PERIODIC_TERMINAL_RESERVE_FACTOR * targetWork,
              );
              const probeAllowanceFrames = Math.max(
                0,
                executionRemainingFrames - terminalReserveFrames,
              );
              const remainingGapAdvance = Math.max(
                1,
                targetGapIndex - incumbent.search.gapIndex,
              );
              const policy = resolvePolicy(incumbent.search);
              const observedCostEstimate = Math.ceil(
                policy.nCand * Math.max(1, observedAtomicCostPerCandidateUpper),
              );
              const suffixAverageEstimate = Math.ceil(
                estimatedProbeWorkFrames / remainingGapAdvance,
              );
              return {
                probeAllowanceFrames,
                estimatedProbeWorkFrames,
                terminalReserveFrames,
                executionRemainingFrames,
                estimatedNextNodeFrames: Math.max(
                  1,
                  observedCostEstimate,
                  suffixAverageEstimate,
                ),
              };
            },
          ) ?? null;
        if (routeLeaseRevalidationDecision !== null) {
          if (resumeSuspendedContinuation) {
            throw new Error(
              "route-lease revalidation selected an already suspended continuation",
            );
          }
          if (runRouteLeaseRevalidation(node, routeLeaseRevalidationDecision)) return;
          continue;
        }
        const result = processSelected(
          node,
          resumeSuspendedContinuation,
          options.allowSelectiveBacktracking ?? true,
          options.allowSpeculativeTailCompletion ?? true,
        );
        if (result.kind === "captured" || result.kind === "terminal_limit") return;
        if (result.kind === "deferred") {
          const replacement = { ...node, deferExpansion: false };
          selectiveBacktracking?.replaceNode(node, replacement);
          enqueueDeferred(replacement, pass, fb);
        } else if (result.kind === "selective_backtrack") {
          if (runCatchup(node, result.decision)) return;
        } else {
          for (let i = result.children.length - 1; i >= 0; i--) enqueueChild(result.children[i], pass, fb);
        }
        telemetry.frontierMaxSize = Math.max(telemetry.frontierMaxSize, frontierSize(pass, fb));
      }
    };

    /** Execute the score-blind rank-one opportunity selected at the first
     * terminal as one isolated suffix search. No node is discarded: the exact
     * queued sibling is transferred into a local frontier, and every survivor
     * is returned to the original frontier before ordinary repair begins. */
    const runDeferredValueSuffix = (): void => {
      if (
        (frontierTraversalPolicy !==
            "selective_axis_regret_catchup_value_deferred_initial" &&
          frontierTraversalPolicy !==
            "selective_axis_regret_catchup_value_deferred_pass_only" &&
          frontierTraversalPolicy !==
            "selective_axis_regret_catchup_value_deferred_prefix_gate") ||
        pendingDeferredValueDecision === null ||
        captured !== null
      ) return;
      const decision = pendingDeferredValueDecision;
      pendingDeferredValueDecision = null;
      const comparisonIncumbent = bestCompleteNode;
      if (comparisonIncumbent === null) {
        throw new Error("deferred value action has no first-terminal incumbent");
      }
      if (decision.terminal.affordable_rank !== 1) {
        throw new Error("deferred value decision lost its rank-one assessment");
      }
      if (!takeFrontierNode(decision.alternative, passStack, fallbackStack)) {
        throw new Error("deferred value alternative left the initial frontier");
      }

      const localPass: HandoffNode[] = decision.alternative.skippedContacts === 0
        ? [decision.alternative]
        : [];
      const localFallback: HandoffNode[] = decision.alternative.skippedContacts === 0
        ? []
        : [decision.alternative];
      const startFrames = getSimFrames();
      const allowance = Math.min(
        decision.terminal.local_allowance_frames,
        Math.max(0, repairBudgetLimit - startFrames),
        Math.max(0, targetBudget - startFrames),
      );
      const ceiling = startFrames + allowance;
      const rankedOptionCallsBefore = telemetry.candidatePoolRequests.count;
      const requestedNormalProposalsBefore = telemetry.candidatePoolRequests.sum;
      const candidateGeometryEvaluationsBefore = getCandidateSamples();
      const tailCompletionAttemptsBefore = telemetry.tailCompletionAttempts;
      const terminalConsidersBefore = terminalConsiders;
      const lastTerminalNodeBefore = lastTerminalNode;
      const registerImprovementsBefore = register.improvementCount;
      const incumbentRevisionBefore = incumbentRevision;
      let nodesProcessed = 0;
      const atomicNodeFrames: number[] = [];
      const firstDivergentGapIndex = (() => {
        const end = Math.min(
          decision.alternative.search.gapIndex,
          comparisonIncumbent.search.gapIndex,
        );
        for (let gapIndex = 0; gapIndex < end; gapIndex++) {
          if (
            decision.alternative.search.prefixFits[gapIndex] !==
              comparisonIncumbent.search.prefixFits[gapIndex]
          ) return gapIndex;
        }
        return null;
      })();
      const progressCheckpointNodes: Array<{
        node: HandoffNode;
        checkpoint: SelectiveDeferredValueCheckpoint;
      }> = [];
      const prefixGateEnabled = frontierTraversalPolicy ===
        "selective_axis_regret_catchup_value_deferred_prefix_gate";
      const passFrontierGateEnabled = frontierTraversalPolicy ===
        "selective_axis_regret_catchup_value_deferred_pass_only";
      let passFrontierGateCheckpoint: {
        selection_ordinal: number;
        selection_total_spent_frames: number;
        spent_frames_since_attempt_start: number;
        remaining_local_allowance_frames: number;
        gap_index: number;
        contact_ordinal: number;
        skipped_contacts: number;
        local_pass_frontier_size: number;
        local_fallback_frontier_size: number;
      } | null = null;
      let passFrontierGateStopped = false;
      let prefixGateDecision: "not_reached" | "continue" | "stop" = "not_reached";
      let prefixGateCheckpoint: {
        selection_ordinal: number;
        selection_total_spent_frames: number;
        spent_frames_since_attempt_start: number;
        estimated_work_fraction_spent: number;
        remaining_local_allowance_frames: number;
        gap_index: number;
        contact_ordinal: number;
        comparable_contacts_since_divergence: number;
        divergent_suffix: SelectiveDeferredValueAxisComparison;
      } | null = null;
      let prefixGateStopped = false;
      let selectedGapHighWater = -1;
      let nextAtomicStartFrames = startFrames;
      let budgetRemainingBeforeYield: number | null = null;
      let estimatedNextNodeFrames: number | null = null;

      const episodeId = budgetRecorder.startEpisode({
        lane: "deferred_value",
        parentEpisodeId: initialBudgetEpisodeId,
        searchSeed,
        frontierHasFallbackLane: true,
        anchorGapIndex: decision.alternative.search.gapIndex,
        startTotalSpentFrames: startFrames,
        ceilingTotalSpentFrames: ceiling,
        ceilingSource: "deferred_value_allowance",
        includeStartup: false,
        pathEstimateByGap: incumbentCostToEnd,
        registerKeyAtStart: toBudgetRegisterKey(register.getBestKey()),
      });
      beginCandidateWork();
      const previousTerminalLimit = activeTerminalConsiderLimit;
      activeTerminalConsiderLimit = terminalConsidersBefore + 1;
      try {
        runFrontier(
          localPass,
          localFallback,
          () => getSimFrames() < ceiling && terminalConsiders === terminalConsidersBefore,
          "deferred_value",
          ceiling,
          () => {
            nodesProcessed++;
            atomicNodeFrames.push(getSimFrames() - nextAtomicStartFrames);
          },
          {
            // The action itself is the sole intervention. Its suffix uses the
            // ordinary node expansion/ranking path but cannot recursively open
            // another selective action or a speculative tail completion.
            allowSelectiveBacktracking: false,
            allowSpeculativeTailCompletion: false,
            beforeSelect: (node) => {
              const remaining = Math.max(0, ceiling - getSimFrames());
              if (passFrontierGateEnabled && localPass.length === 0) {
                if (node.skippedContacts <= 0 || localFallback.length === 0) {
                  throw new Error(
                    "deferred pass-frontier gate selected an invalid fallback frontier",
                  );
                }
                const selectionFrames = getSimFrames();
                passFrontierGateCheckpoint = {
                  selection_ordinal: progressCheckpointNodes.length + 1,
                  selection_total_spent_frames: selectionFrames,
                  spent_frames_since_attempt_start: selectionFrames - startFrames,
                  remaining_local_allowance_frames: remaining,
                  gap_index: node.search.gapIndex,
                  contact_ordinal: contactOrdinalAt(node.search.gapIndex),
                  skipped_contacts: node.skippedContacts,
                  local_pass_frontier_size: localPass.length,
                  local_fallback_frontier_size: localFallback.length,
                };
                passFrontierGateStopped = true;
                return false;
              }
              const suffixWork = Math.max(
                1,
                Math.ceil(conservativeDeadlineWorkAtGap(node.search.gapIndex)),
              );
              const remainingGapAdvance = Math.max(1, gaps.length - node.search.gapIndex);
              const suffixAverageEstimate = Math.ceil(suffixWork / remainingGapAdvance);
              const policy = resolvePolicy(node.search);
              const observedCostEstimate = Math.ceil(
                policy.nCand * Math.max(1, observedAtomicCostPerCandidateUpper),
              );
              const nextEstimate = Math.max(
                1,
                suffixAverageEstimate,
                observedCostEstimate,
              );
              if (nextEstimate <= remaining) {
                const selectionFrames = getSimFrames();
                const throughGapIndex = node.search.gapIndex;
                const wholePrefix = authoredAxisComparison(
                  node.search,
                  comparisonIncumbent.search,
                  0,
                  throughGapIndex,
                );
                const divergentSuffix = firstDivergentGapIndex === null
                  ? null
                  : authoredAxisComparison(
                    node.search,
                    comparisonIncumbent.search,
                    firstDivergentGapIndex,
                    throughGapIndex,
                  );
                let latestComparableContactGapIndex: number | null = null;
                let latestComparableContact:
                  SelectiveDeferredValueAxisComparison | null = null;
                const comparisonStart = firstDivergentGapIndex ?? 0;
                let comparableContactsSinceDivergence = 0;
                for (
                  let gapIndex = comparisonStart;
                  gapIndex < throughGapIndex;
                  gapIndex++
                ) {
                  if (!gaps[gapIndex]?.endsWithContact) continue;
                  const comparison = authoredAxisComparison(
                    node.search,
                    comparisonIncumbent.search,
                    gapIndex,
                    gapIndex + 1,
                  ).comparison;
                  if (
                    comparison.selected_axis_count === 0 ||
                    comparison.incumbent_axis_count === 0
                  ) continue;
                  comparableContactsSinceDivergence++;
                  latestComparableContactGapIndex = gapIndex;
                  latestComparableContact = comparison;
                }
                const perAxis = divergentSuffix === null
                  ? {}
                  : Object.fromEntries([...new Set([
                    ...Object.keys(divergentSuffix.selected.byAxis),
                    ...Object.keys(divergentSuffix.incumbent.byAxis),
                  ])].sort().map((axis) => {
                    const selected = divergentSuffix.selected.byAxis[axis] ?? {
                      observations: 0,
                      sse: 0,
                    };
                    const incumbent = divergentSuffix.incumbent.byAxis[axis] ?? {
                      observations: 0,
                      sse: 0,
                    };
                    return [axis, {
                      selected_observations: selected.observations,
                      incumbent_observations: incumbent.observations,
                      selected_sse: selected.sse,
                      incumbent_sse: incumbent.sse,
                      sse_delta: selected.sse - incumbent.sse,
                    }];
                }));
                const newHighWater = throughGapIndex > selectedGapHighWater;
                selectedGapHighWater = Math.max(selectedGapHighWater, throughGapIndex);
                const progressCheckpoint: SelectiveDeferredValueCheckpoint = {
                  selection_ordinal: progressCheckpointNodes.length + 1,
                  selection_total_spent_frames: selectionFrames,
                  spent_frames_since_attempt_start: selectionFrames - startFrames,
                  estimated_work_fraction_spent:
                    (selectionFrames - startFrames) /
                    Math.max(1, decision.terminal.estimated_suffix_work_frames),
                  gap_index: throughGapIndex,
                  contact_ordinal: contactOrdinalAt(throughGapIndex),
                  first_divergent_gap_index: firstDivergentGapIndex,
                  comparable_contacts_since_divergence:
                    comparableContactsSinceDivergence,
                  skipped_contacts: node.skippedContacts,
                  frontier_lane: node.skippedContacts === 0 ? "pass" : "fallback",
                  new_selected_gap_high_water: newHighWater,
                  local_pass_frontier_size: localPass.length,
                  local_fallback_frontier_size: localFallback.length,
                  whole_prefix: wholePrefix.comparison,
                  divergent_suffix: divergentSuffix?.comparison ?? null,
                  latest_comparable_contact_gap_index:
                    latestComparableContactGapIndex,
                  latest_comparable_contact: latestComparableContact,
                  divergent_suffix_axis_sse_by_axis: perAxis,
                  on_offered_terminal_path: null,
                };
                if (
                  prefixGateEnabled &&
                  prefixGateDecision === "not_reached" &&
                  newHighWater &&
                  node.skippedContacts === 0 &&
                  comparableContactsSinceDivergence >=
                    SELECTIVE_DEFERRED_PREFIX_GATE_CONTACT_HORIZON
                ) {
                  if (
                    divergentSuffix === null ||
                    divergentSuffix.comparison.selected_axis_count !==
                      divergentSuffix.comparison.incumbent_axis_count
                  ) {
                    throw new Error(
                      "deferred prefix gate reached a non-comparable pass checkpoint",
                    );
                  }
                  prefixGateDecision =
                    divergentSuffix.comparison.axis_loss_delta >
                        SELECTIVE_DEFERRED_PREFIX_GATE_LOSS_DELTA
                      ? "stop"
                      : "continue";
                  prefixGateCheckpoint = {
                    selection_ordinal: progressCheckpoint.selection_ordinal,
                    selection_total_spent_frames: selectionFrames,
                    spent_frames_since_attempt_start: selectionFrames - startFrames,
                    estimated_work_fraction_spent:
                      progressCheckpoint.estimated_work_fraction_spent,
                    remaining_local_allowance_frames: remaining,
                    gap_index: throughGapIndex,
                    contact_ordinal: contactOrdinalAt(throughGapIndex),
                    comparable_contacts_since_divergence:
                      comparableContactsSinceDivergence,
                    divergent_suffix: { ...divergentSuffix.comparison },
                  };
                  if (prefixGateDecision === "stop") {
                    prefixGateStopped = true;
                    return false;
                  }
                }
                progressCheckpointNodes.push({ node, checkpoint: progressCheckpoint });
                nextAtomicStartFrames = getSimFrames();
                return true;
              }
              budgetRemainingBeforeYield = remaining;
              estimatedNextNodeFrames = nextEstimate;
              return false;
            },
          },
        );
      } finally {
        activeTerminalConsiderLimit = previousTerminalLimit;
      }

      const terminalReached = terminalConsiders > terminalConsidersBefore;
      const offeredTerminal = terminalReached ? lastTerminalNode : null;
      if (terminalReached && (offeredTerminal === null || offeredTerminal === lastTerminalNodeBefore)) {
        throw new Error("deferred value terminal counter advanced without a new terminal node");
      }
      const progressCheckpoints = progressCheckpointNodes.map(({ node, checkpoint }) => ({
        ...checkpoint,
        on_offered_terminal_path: offeredTerminal === null
          ? null
          : node.startRank === offeredTerminal.startRank &&
            node.search.gapIndex <= offeredTerminal.search.gapIndex &&
            node.search.prefixFits.every((fit, gapIndex) =>
              fit === offeredTerminal.search.prefixFits[gapIndex]
            ),
      }));
      const outcome = terminalReached
        ? "terminal_reached" as const
        : passFrontierGateStopped
          ? "fallback_frontier_return" as const
          : prefixGateStopped
            ? "prefix_gate_stop" as const
            : budgetRemainingBeforeYield !== null
              ? "atomic_budget_yield" as const
              : getSimFrames() >= ceiling
                ? "execution_ceiling" as const
                : "frontier_exhausted" as const;
      const returnedPass = localPass.length;
      const returnedFallback = localFallback.length;
      passStack.push(...localPass);
      fallbackStack.push(...localFallback);
      finishActiveCandidateWork();
      budgetRecorder.endEpisode(
        getSimFrames(),
        terminalReached
          ? "first_terminal_return"
          : passFrontierGateStopped
            ? "fallback_frontier_return"
            : prefixGateStopped
              ? "prefix_gate_stop"
              : getSimFrames() >= ceiling || budgetRemainingBeforeYield !== null
                ? "local_ceiling"
                : "frontier_exhausted",
        { registerKeyAtEnd: toBudgetRegisterKey(register.getBestKey()) },
      );
      budgetRecorder.recordSegment(
        "deferred_value_suffix",
        startFrames,
        getSimFrames(),
        outcome,
        episodeId,
      );
      selectiveBacktracking!.recordDeferredValueAttempt({
        watch_id: decision.watchId,
        affordable_rank: decision.terminal.affordable_rank,
        start_gap_index: decision.alternative.search.gapIndex,
        start_total_spent_frames: startFrames,
        end_total_spent_frames: getSimFrames(),
        estimated_suffix_work_frames: decision.terminal.estimated_suffix_work_frames,
        local_allowance_frames: allowance,
        execution_ceiling_frames: ceiling,
        outcome,
        nodes_processed: nodesProcessed,
        atomic_node_frames: atomicNodeFrames,
        ranked_option_calls:
          telemetry.candidatePoolRequests.count - rankedOptionCallsBefore,
        requested_normal_proposals:
          telemetry.candidatePoolRequests.sum - requestedNormalProposalsBefore,
        candidate_geometry_evaluations:
          getCandidateSamples() - candidateGeometryEvaluationsBefore,
        tail_completion_attempts:
          telemetry.tailCompletionAttempts - tailCompletionAttemptsBefore,
        terminal_node_evaluations: terminalConsiders - terminalConsidersBefore,
        register_improvements: register.improvementCount - registerImprovementsBefore,
        terminal_register_improvements: incumbentRevision - incumbentRevisionBefore,
        remaining_pass_nodes_returned: returnedPass,
        remaining_fallback_nodes_returned: returnedFallback,
        budget_remaining_before_yield: budgetRemainingBeforeYield,
        estimated_next_node_frames: estimatedNextNodeFrames,
        progress_checkpoints: progressCheckpoints,
        pass_frontier_gate: passFrontierGateEnabled
          ? {
            decision: passFrontierGateStopped ? "fallback_return" : "not_reached",
            checkpoint: passFrontierGateCheckpoint,
          }
          : null,
        prefix_gate: prefixGateEnabled
          ? {
            contact_horizon: SELECTIVE_DEFERRED_PREFIX_GATE_CONTACT_HORIZON,
            axis_loss_delta_threshold: SELECTIVE_DEFERRED_PREFIX_GATE_LOSS_DELTA,
            decision: prefixGateDecision,
            checkpoint: prefixGateCheckpoint,
          }
          : null,
      });
    };

    // Repair restart: re-run the REAL frontier-DFS (rescue, far-back pulse, tail completion,
    // register — all via processNode) seeded from one node, until `ceiling` sim-frames or the
    // frontier empties. Branches into the OTHER arcs at the restart gap, rebuilding the whole
    // tail with full power, not a greedy dive.
    const runFrontierFrom = (
      initial: HandoffNode,
      ceiling: number,
      stopAfterTerminalConsider?: number,
    ): void => {
      const pass: HandoffNode[] = initial.skippedContacts === 0 ? [initial] : [];
      const fb: HandoffNode[] = initial.skippedContacts === 0 ? [] : [initial];
      const keepGoing = (): boolean => getSimFrames() < ceiling &&
        (stopAfterTerminalConsider === undefined || terminalConsiders < stopAfterTerminalConsider);
      const previousTerminalLimit = activeTerminalConsiderLimit;
      activeTerminalConsiderLimit = stopAfterTerminalConsider ?? null;
      try {
        selectiveBacktracking?.observeRoot(initial);
        runFrontier(pass, fb, keepGoing, "repair", ceiling);
      } finally {
        activeTerminalConsiderLimit = previousTerminalLimit;
      }
    };

    // One self-contained repair iteration normally recomputes policy from the
    // current global incumbent. The protected-bridge study may instead consume
    // exactly one pending rejected local improvement as its temporary working
    // track. That track never enters the global register merely for improving a
    // target, and bridge offspring cannot create another bridge.
    const runRepairPhase = (): void => {
      const repairBudget = repairBudgetLimit;
      const perGap = firstCompletionFrame > 0
        ? firstCompletionFrame / Math.max(1, telemetry.deepestSeenGap + 1)
        : 0;
      // The stable-planning breadth arm isolates two effects that the ordinary
      // adaptive profile intentionally couples. Its first repair sees the same
      // full-breadth incumbent profile as production; later repairs continue to
      // use that measured profile for affordability while their real, narrower
      // descendant work is still charged and observed normally. This is a study
      // control, not a synthetic refund: its local ceiling is transparently
      // derived from the same retained planning profile and the hard budget is
      // unchanged.
      let initialRepairPlanningCostToEnd: readonly number[] | null = null;
      let attempts = 0;
      let restartCounter = 0;
      while (
        attempts < repair.maxAttempts &&
        getSimFrames() < repairBudget &&
        bestCompleteNode !== null &&
        isTerminalNode(bestCompleteNode.search, gaps)
      ) {
        const incumbent = bestCompleteNode;
        const bridgeInput = pendingRejectedLocalBridge;
        pendingRejectedLocalBridge = null;
        const workingTrack = bridgeInput?.node ?? incumbent;
        const root = startOptions.find((o) => o.rank === workingTrack.startRank)?.root;
        if (root === undefined) break;
        const remaining = repairBudget - getSimFrames();
        const observedCostToEnd = bridgeInput === null
          ? buildTrackCostToEnd(workingTrack)
          : [...bridgeInput.costToEnd];
        if (bridgeInput === null) incumbentCostToEnd = observedCostToEnd;
        if (initialRepairPlanningCostToEnd === null) {
          initialRepairPlanningCostToEnd = [...observedCostToEnd];
        }
        const costToEnd = studyRepairPlanningCostPolicy() === "initial_terminal"
          ? [...initialRepairPlanningCostToEnd]
          : observedCostToEnd;
        const measuredCostToEnd = (gapIndex: number): number | null => {
          const measured = costToEnd[gapIndex];
          return measured !== undefined && measured > 0 ? measured : null;
        };
        const fallbackCostOf = (gapIndex: number): number =>
          perGap * Math.max(1, gaps.length - gapIndex);
        const estCostOf = (gapIndex: number): number =>
          measuredCostToEnd(gapIndex) ?? fallbackCostOf(gapIndex);
        const estCostUpperOf = (gapIndex: number): number => repairRestartCeilingFrames(
          measuredCostToEnd(gapIndex),
          fallbackCostOf(gapIndex),
        );
        const estCostSourceOf = (
          gapIndex: number,
        ): "measured_cost_to_end" | "per_gap_fallback" =>
          measuredCostToEnd(gapIndex) === null
            ? "per_gap_fallback"
            : "measured_cost_to_end";
        const pointCostByAnchor = Array.from(
          { length: gaps.length + 1 },
          (_, gapIndex) => estCostOf(gapIndex),
        );
        const upperCostByAnchor = Array.from(
          { length: gaps.length + 1 },
          (_, gapIndex) => estCostUpperOf(gapIndex),
        );
        const incumbentEvaluation = evaluateCached(incumbent);
        const workingEvaluation = evaluateCached(workingTrack);
        const targetCandidates = workingEvaluation.report.gaps
          .filter((gapReport) => gaps[gapReport.gap_index]?.endsWithContact)
          .map((gapReport) => ({
            gapIndex: gapReport.gap_index,
            sse: gapAxisSse(gapReport) ?? 0,
          }));
        const iterationIndex = attempts;
        const selectionPolicy = repairSelectionPolicyForIteration(
          repair.selectionPolicy,
          repair.lateSelectionPolicy,
          iterationIndex,
        );
        let target = selectRepairRestart(
          targetCandidates,
          pointCostByAnchor,
          upperCostByAnchor,
          remaining,
          repair.headroomFraction,
          repair.maxParentDepth,
          selectionPolicy,
        );
        let repairBreadthRatio = 1;
        if (target === null && repair.lastChanceThreeQuarter) {
          target = selectLastChanceRepairRestart(
            targetCandidates,
            pointCostByAnchor,
            upperCostByAnchor,
            remaining,
            repair.headroomFraction,
            repair.maxParentDepth,
          );
          if (target !== null) repairBreadthRatio = REPAIR_LAST_CHANCE_BREADTH_RATIO;
        }
        if (target === null) break;
        attempts++;
        const kWorst = target.targetGapIndex;
        const k = target.anchorGapIndex;
        const pickedWeakGapSse = target.targetGapSse;
        const workingWeakGapBefore = repairGapState(
          kWorst,
          workingEvaluation.report.gaps.find((g) => g.gap_index === kWorst),
        );
        const incumbentWeakGapBefore = repairGapState(
          kWorst,
          incumbentEvaluation.report.gaps.find((g) => g.gap_index === kWorst),
        );
        const repairCostRatio = repairBreadthRatio < 1
          ? REPAIR_LAST_CHANCE_COST_RATIO
          : 1;
        const decisionEstCostOf = (gapIndex: number): number =>
          estCostOf(gapIndex) * repairCostRatio;
        const decisionEstCostUpperOf = (gapIndex: number): number =>
          upperCostByAnchor[gapIndex]! * repairCostRatio;
        const estCost = decisionEstCostOf(k);
        const estCostUpper = decisionEstCostUpperOf(k);
        restartCounter++;
        const restartSeed = ((searchSeed | 0) ^ Math.imul(restartCounter, 0x9e3779b1)) | 0;
        let prefix = root;
        for (let gapIndex = 0; gapIndex < k; gapIndex++) {
          prefix = extendNodeCached(prefix, workingTrack.search.prefixFits[gapIndex]);
        }
        const prefixNode: HandoffNode = {
          search: prefix,
          startState: workingTrack.startState,
          startLines: workingTrack.startLines,
          startRank: workingTrack.startRank,
          searchSeed: restartSeed,
          startExpanded: true,
          deferExpansion: false,
          rankTrace: [],
          skippedContacts: 0,
        };
        const framesBefore = getSimFrames();
        const ceiling = Math.min(repairBudget, framesBefore + Math.ceil(estCostUpper));
        const ceilingSource = ceiling >= repairBudget
          ? "repair_budget_remaining"
          : estCostSourceOf(k);
        const beforeScore = incumbentEvaluation.key.full_score;
        const incumbentRevisionBefore = incumbentRevision;
        const terminalsBefore = terminalConsiders;
        const workingTrackHash = sha256Json(
          buildNodeOutput(
            workingTrack,
            workingEvaluation.report,
            gaps,
            workingEvaluation.outputDurationFrames,
            false,
          ).track,
        );
        const repairDecision: BudgetRepairDecision = {
          iteration_index: iterationIndex,
          incumbent_revision: incumbentRevision,
          incumbent_track_hash: sha256Json(register.getBest()!.track),
          working_track_source: bridgeInput === null
            ? "global_incumbent"
            : "rejected_local_improvement",
          working_track_hash: workingTrackHash,
          remaining_budget_frames: repairBudget - framesBefore,
          headroom_fraction: repair.headroomFraction,
          usable_budget_frames: target.usableBudgetFrames,
          selection_policy: target.selectionPolicy,
          parent_depth: target.parentDepth,
          affordable_target_gap_indices: target.affordableTargetGapIndices,
          affordable_anchor_gap_indices: target.affordableAnchorGapIndices,
          target_gap_index: kWorst,
          target_gap_sse: pickedWeakGapSse,
          anchor_gap_index: k,
          mutable_suffix_sse: target.mutableSuffixSse,
          estimated_anchor_cost_frames: estCost,
          estimated_anchor_cost_upper_frames: estCostUpper,
          anchor_cost_source: estCostSourceOf(k),
          considered_targets: repairTargetObservations(
            targetCandidates,
            repair.maxParentDepth,
            target.usableBudgetFrames,
            decisionEstCostOf,
            decisionEstCostUpperOf,
            estCostSourceOf,
          ),
        };
        const repairEpisodeId = budgetRecorder.startEpisode({
          lane: "repair",
          parentEpisodeId: bridgeInput?.parentEpisodeId ?? initialBudgetEpisodeId,
          searchSeed: restartSeed,
          frontierHasFallbackLane: true,
          anchorGapIndex: k,
          startTotalSpentFrames: framesBefore,
          ceilingTotalSpentFrames: ceiling,
          ceilingSource,
          includeStartup: false,
          pathEstimateByGap: costToEnd,
          repairDecision,
          incumbentTargetGapBefore: incumbentWeakGapBefore,
          workingTargetGapBefore: workingWeakGapBefore,
          registerKeyAtStart: toBudgetRegisterKey(register.getBestKey()),
        });
        beginCandidateWork();
        const repairRunProfile: ActiveRepairProfile = {
          anchorGapIndex: k,
          // Splice newly observed work into the incumbent's real observed
          // profile. The stable planning profile above affects decisions only.
          baseCostToEnd: observedCostToEnd,
          reachFrames: new WeakMap<SearchNode, number>(),
        };
        activeRepairProfile = repairRunProfile;
        repairLaneActive = true;
        activeRepairIterationIndex = iterationIndex;
        activeRepairAnchorGapIndex = k;
        activeRepairTargetGapIndex = kWorst;
        activeRepairTargetGapSse = pickedWeakGapSse;
        activeRepairBreadthRatio = repairBreadthRatio;
        setAimRepairLaneActive(true, iterationIndex);
        setImpactCarrierRippleRepairActive(true);
        repairAxisBranchBound?.beginAttempt({
          iterationIndex,
          anchorGapIndex: k,
          totalSpentFrames: framesBefore,
          incumbentAxisQuality: incumbentEvaluation.key.axis_quality,
          totalAuthoredAxisCount,
        });
        try {
          runFrontierFrom(prefixNode, ceiling, terminalsBefore + 1);
        } finally {
          repairLaneActive = false;
          activeRepairIterationIndex = null;
          activeRepairAnchorGapIndex = null;
          activeRepairTargetGapIndex = null;
          activeRepairTargetGapSse = null;
          activeRepairBreadthRatio = 1;
          setAimRepairLaneActive(false);
          setImpactCarrierRippleRepairActive(false);
          activeRepairProfile = null;
        }
        const completed = terminalConsiders > terminalsBefore;
        const workingToOfferDivergence: BudgetRepairDivergence | null =
          completed && lastTerminalNode !== null
            ? compareRepairTerminalGeometry(
              workingTrack.search.prefixFits,
              lastTerminalNode.search.prefixFits,
              k,
            )
            : null;
        const terminalOfferCostToEnd = completed && lastTerminalNode !== null
          ? buildObservedCostToEnd(lastTerminalNode, getSimFrames(), repairRunProfile)
          : null;
        const afterScore = bestCompleteNode === null
          ? beforeScore
          : evaluateCached(bestCompleteNode).key.full_score;
        const terminalOfferTargetGap = !completed || lastTerminalNode === null
          ? null
          : repairGapState(
            kWorst,
            evaluateCached(lastTerminalNode).report.gaps.find((gapReport) =>
              gapReport.gap_index === kWorst
            ),
          );
        const pickedWeakGapAfter = bestCompleteNode === null
          ? null
          : repairGapState(
            kWorst,
            evaluateCached(bestCompleteNode).report.gaps.find((gapReport) =>
              gapReport.gap_index === kWorst
            ),
          );
        const acceptedAlternative = incumbentRevision > incumbentRevisionBefore;
        if (repairAxisBranchBound !== null && completed && lastTerminalNode !== null) {
          const terminalWindow = authoredAxisWindow(lastTerminalNode.search);
          const terminalEvaluation = evaluateCached(lastTerminalNode);
          if (
            terminalEvaluation.key.contract_passed &&
            terminalWindow.axisCount !== totalAuthoredAxisCount
          ) {
            throw new Error(
              `repair axis-bound terminal population ${terminalWindow.axisCount} ` +
              `does not match authored population ${totalAuthoredAxisCount}`,
            );
          }
          if (
            terminalWindow.axisCount === totalAuthoredAxisCount &&
            Math.abs(
              optimisticAxisQualityUpper(terminalWindow.axisSse, totalAuthoredAxisCount) -
                terminalEvaluation.key.axis_quality,
            ) > 1e-12
          ) {
            throw new Error("repair axis-bound terminal quality does not match the scorer");
          }
        }
        repairAxisBranchBound?.finishAttempt({
          totalSpentFrames: getSimFrames(),
          terminalNode: completed ? lastTerminalNode : null,
          terminalGapIndex: completed && lastTerminalNode !== null
            ? lastTerminalNode.search.gapIndex
            : null,
          terminalReached: completed,
          acceptedAlternative,
        });
        let rejectedLocalImprovementFollowup:
          BudgetEpisodeTelemetry["outcome"]["rejected_local_improvement_followup"] =
            "not_rejected_local_improvement";
        let rejectedLocalImprovementBridgeAssessment:
          BudgetRejectedLocalBridgeAssessment | null = null;
        const workingTargetSse = workingWeakGapBefore.status === "measured"
          ? workingWeakGapBefore.sse
          : null;
        const offerTargetSse = terminalOfferTargetGap?.status === "measured"
          ? terminalOfferTargetGap.sse
          : null;
        if (
          completed &&
          !acceptedAlternative &&
          lastTerminalNode !== null &&
          terminalOfferCostToEnd !== null &&
          workingTargetSse !== null &&
          offerTargetSse !== null &&
          offerTargetSse < workingTargetSse
        ) {
          if (bridgeInput !== null) {
            rejectedLocalImprovementFollowup = "blocked_one_step_limit";
          } else if (attempts >= repair.maxAttempts) {
            rejectedLocalImprovementFollowup = "blocked_attempt_limit";
          } else {
            const followupRemaining = repairBudget - getSimFrames();
            const followupMeasuredCost = (gapIndex: number): number | null => {
              const measured = terminalOfferCostToEnd[gapIndex];
              return measured !== undefined && measured > 0 ? measured : null;
            };
            const followupFallbackCost = (gapIndex: number): number =>
              perGap * Math.max(1, gaps.length - gapIndex);
            const followupPointCosts = Array.from(
              { length: gaps.length + 1 },
              (_, gapIndex) => followupMeasuredCost(gapIndex) ?? followupFallbackCost(gapIndex),
            );
            const followupUpperCosts = Array.from(
              { length: gaps.length + 1 },
              (_, gapIndex) => repairRestartCeilingFrames(
                followupMeasuredCost(gapIndex),
                followupFallbackCost(gapIndex),
              ),
            );
            const followupEvaluation = evaluateCached(lastTerminalNode);
            const followupTargets = followupEvaluation.report.gaps
              .filter((gapReport) => gaps[gapReport.gap_index]?.endsWithContact)
              .map((gapReport) => ({
                gapIndex: gapReport.gap_index,
                sse: gapAxisSse(gapReport) ?? 0,
              }));
            const followupSelection = selectRepairRestart(
              followupTargets,
              followupPointCosts,
              followupUpperCosts,
              followupRemaining,
              repair.headroomFraction,
              repair.maxParentDepth,
              repairSelectionPolicyForIteration(
                repair.selectionPolicy,
                repair.lateSelectionPolicy,
                attempts,
              ),
            );
            if (followupSelection === null) {
              rejectedLocalImprovementFollowup = "no_affordable_repair";
            } else if (repair.rejectedLocalImprovementBridge === "disabled") {
              rejectedLocalImprovementFollowup = "eligible_policy_disabled";
            } else {
              let boundCanBeatIncumbent = true;
              if (repair.rejectedLocalImprovementBridge === "optimistic_axis_quality_bound") {
                const bound = optimisticSuffixAxisQualityBound(
                  followupEvaluation.report,
                  followupSelection.anchorGapIndex,
                );
                boundCanBeatIncumbent = !(
                  incumbentEvaluation.key.contract_passed &&
                  followupEvaluation.key.contract_passed &&
                  bound.optimisticSuffixAxisQualityUpper < incumbentEvaluation.key.axis_quality
                );
                rejectedLocalImprovementBridgeAssessment = {
                  policy: "optimistic_axis_quality_bound",
                  incumbent_contract_passed: incumbentEvaluation.key.contract_passed,
                  terminal_offer_contract_passed: followupEvaluation.key.contract_passed,
                  incumbent_axis_quality: incumbentEvaluation.key.axis_quality,
                  terminal_offer_axis_quality: followupEvaluation.key.axis_quality,
                  scored_axis_observation_count: bound.scoredAxisObservationCount,
                  total_axis_sse: bound.totalAxisSse,
                  mutable_suffix_axis_sse: bound.mutableSuffixAxisSse,
                  optimistic_suffix_axis_quality_upper:
                    bound.optimisticSuffixAxisQualityUpper,
                  bound_can_beat_incumbent: boundCanBeatIncumbent,
                };
              }
              if (!boundCanBeatIncumbent) {
                rejectedLocalImprovementFollowup =
                  "optimistic_bound_cannot_beat_incumbent";
              } else {
                rejectedLocalImprovementFollowup = "scheduled";
                pendingRejectedLocalBridge = {
                  node: lastTerminalNode,
                  costToEnd: terminalOfferCostToEnd,
                  parentEpisodeId: repairEpisodeId,
                };
              }
            }
          }
        }
        finishActiveCandidateWork();
        budgetRecorder.endEpisode(
          getSimFrames(),
          completed
            ? "first_terminal_return"
            : getSimFrames() >= ceiling
              ? "local_ceiling"
              : "frontier_exhausted",
          {
            internalFullScoreDelta: afterScore - beforeScore,
            registerKeyAtEnd: toBudgetRegisterKey(register.getBestKey()),
            terminalOfferTargetGap,
            incumbentTargetGapAfter: pickedWeakGapAfter,
            workingToOfferDivergence,
            rejectedLocalImprovementFollowup,
            rejectedLocalImprovementBridgeAssessment,
          },
        );
        budgetRecorder.recordSegment(
          "repair_frontier",
          framesBefore,
          getSimFrames(),
          completed ? "terminal_considered" : "no_terminal",
          repairEpisodeId,
        );
        // A narrow suffix is deliberately the final repair iteration. Its
        // measured cost profile belongs to a different breadth and must not be
        // reused to price a subsequent full-width decision.
        if (repairBreadthRatio < 1) break;
        // Ordinary iterations reread the global incumbent from scratch. A
        // scheduled bridge is the sole exception and is consumed exactly once.
      }
    };

    // Main search. Completion-triggered handoff to repair: once a complete track exists, stop the
    // main search (after firstCompletion*mainMargin frames) and spend the rest on aimed repair.
    // Repair off, or before any completion → runs to budget exactly → byte-identical baseline.
    const initialSearchStart = getSimFrames();
    runFrontier(passStack, fallbackStack, () =>
      !(repairEnabled && firstCompletionFrame >= 0 &&
        getSimFrames() >= firstCompletionFrame * repair!.mainMargin),
      initialSnapshot === null ? "initial" : "snapshot",
      targetBudget,
    );
    const initialSearchEnd = getSimFrames();
    const initialStopReason = captured !== null
      ? (stopAfterFirstCompletion ? "first_completion_stop" : "budget_capture")
      : repairEnabled && firstCompletionFrame >= 0
        ? "handoff_to_repair"
        : frontierSize(passStack, fallbackStack) === 0
          ? "frontier_exhausted"
          : "compile_finished";
    finishActiveCandidateWork();
    budgetRecorder.endEpisode(initialSearchEnd, initialStopReason, {
      registerKeyAtEnd: toBudgetRegisterKey(register.getBestKey()),
    });
    budgetRecorder.recordSegment(
      "initial_search",
      initialSearchStart,
      initialSearchEnd,
      initialStopReason,
      initialBudgetEpisodeId,
    );

    // The deferred suffix receives first claim on post-terminal work only in
    // its opt-in arm. Production and the behavior-neutral map skip this block.
    runDeferredValueSuffix();

    // Contained worst-gap suffix-rebuild post-pass on the reserved budget tail.
    if (repairEnabled && captured === null) {
      runRepairPhase();
    }

    // If repair exhausts its useful restart set before the frame budget is spent,
    // resume the original frontier instead of snapshotting with live alternatives
    // still queued. Repair keeps first claim on post-completion budget, but leftover
    // frames should still buy normal search quality.
    if (repairEnabled && captured === null && getSimFrames() < targetBudget) {
      const resumeStart = getSimFrames();
      const resumeRemainder = targetBudget - resumeStart;
      const plannedResumeCandidates = resumePolicy === "remainder-aware"
        ? qualityHandoffSampleCount(
          targetProfile,
          sparseContactCadence,
          resumeRemainder,
        )
        : null;
      const estimatedAtomicUpper = plannedResumeCandidates !== null &&
          observedAtomicCostPerCandidateUpper > 0
        ? Math.ceil(plannedResumeCandidates * observedAtomicCostPerCandidateUpper)
        : null;
      const resumeAdmitted = resumePolicy === "legacy" || (
        resumePolicy === "remainder-aware" &&
        estimatedAtomicUpper !== null &&
        estimatedAtomicUpper <= resumeRemainder
      );
      budgetRecorder.recordResumeAdmission({
        mode: resumePolicy,
        available_hard_budget_frames: resumeRemainder,
        planned_candidate_count: plannedResumeCandidates,
        estimated_atomic_upper_frames: estimatedAtomicUpper,
        admitted: resumeAdmitted,
        reason: resumePolicy === "legacy"
          ? "legacy"
          : resumePolicy === "none"
            ? "disabled"
            : estimatedAtomicUpper === null
              ? "no_cost_history"
              : resumeAdmitted
                ? "fits_remainder"
                : "exceeds_remainder",
      });
      if (resumeAdmitted) {
      const resumeScoreBefore = bestCompleteNode === null
        ? null
        : evaluateCached(bestCompleteNode).key.full_score;
      // This phase can be a large share of a compile's charged work and can hold
      // its first terminal, so it is a distinct episode. It continues the
      // initial episode's frontier, hence the initial root anchor and hard
      // budget as its ceiling.
      const resumedEpisodeId = budgetRecorder.startEpisode({
        lane: "resumed",
        parentEpisodeId: initialBudgetEpisodeId,
        searchSeed,
        frontierHasFallbackLane: false,
        anchorGapIndex: root.search.gapIndex,
        startTotalSpentFrames: resumeStart,
        ceilingTotalSpentFrames: targetBudget,
        ceilingSource: "hard_budget",
        includeStartup: false,
        registerKeyAtStart: toBudgetRegisterKey(register.getBestKey()),
      });
      beginCandidateWork();
      if (resumePolicy === "remainder-aware") resumedSearchShapeBudget = resumeRemainder;
      try {
        runFrontier(
          passStack,
          fallbackStack,
          () => getSimFrames() < targetBudget,
          "resumed",
          targetBudget,
        );
      } finally {
        resumedSearchShapeBudget = null;
      }
      const resumeEnd = getSimFrames();
      const resumeScoreAfter = bestCompleteNode === null
        ? resumeScoreBefore
        : evaluateCached(bestCompleteNode).key.full_score;
      finishActiveCandidateWork();
      budgetRecorder.endEpisode(
        resumeEnd,
        captured !== null
          ? (stopAfterFirstCompletion ? "first_completion_stop" : "budget_capture")
          : resumeEnd >= targetBudget
            ? "budget_capture"
            : "frontier_exhausted",
        {
          internalFullScoreDelta: resumeScoreBefore === null || resumeScoreAfter === null
            ? null
            : resumeScoreAfter - resumeScoreBefore,
          registerKeyAtEnd: toBudgetRegisterKey(register.getBestKey()),
        },
      );
      budgetRecorder.recordSegment(
        "resumed_search",
        resumeStart,
        resumeEnd,
        resumeEnd >= targetBudget ? "hard_budget" : "frontier_exhausted",
        resumedEpisodeId,
      );
      }
    }

    // Frontier exhausted (or node cap hit) before the budget was reached: snapshot
    // the converged best, flagging whether the budget was actually exhausted.
    if (captured === null) {
      captured = snapshot(targetBudget, getSimFrames() >= targetBudget);
    }

    // A budget snapshot can be captured inside processNode before the enclosing
    // segment/attempt closes. Refresh only the observational payload here; the
    // selected track, report, stats, and budget capture remain untouched.
    captured.budgetTelemetry = budgetRecorder.snapshot(
      captured.stats.sim_frames,
      captured.stats.budget_exhausted,
      firstTerminalFrame >= 0 ? firstTerminalFrame : null,
      firstCompletionFrame >= 0 ? firstCompletionFrame : null,
    );

    return captured;
  }
}

export function snapshotHandoffNode(
  node: HandoffNode,
  key: LeafKey,
  event: HandoffNodeEvent,
): HandoffNodeSnapshot {
  return {
    node: cloneHandoffNodeForBranch(node),
    key: { ...key },
    event: { ...event },
  };
}

function cloneSnapshotRoot(
  snapshot: HandoffNodeSnapshot,
  gapCount: number,
  searchSeed: number,
): HandoffNode {
  validateHandoffSnapshot(snapshot, gapCount);
  return cloneHandoffNodeForBranch(snapshot.node, { searchSeed });
}

function validateHandoffSnapshot(snapshot: HandoffNodeSnapshot, gapCount: number): void {
  const node = snapshot.node;
  const gapIndex = node.search.gapIndex;
  if (!node.startExpanded) {
    throw new Error("compileHandoffFromSnapshot: snapshot node must have expanded start state");
  }
  if (!Number.isInteger(gapIndex) || gapIndex < 0 || gapIndex > gapCount) {
    throw new Error(
      `compileHandoffFromSnapshot: snapshot gapIndex ${gapIndex} is outside [0, ${gapCount}]`,
    );
  }
  if (node.search.prefixFits.length !== gapIndex) {
    throw new Error(
      `compileHandoffFromSnapshot: snapshot prefixFits length ` +
        `${node.search.prefixFits.length} does not match gapIndex ${gapIndex}`,
    );
  }
}

function cloneHandoffNodeForBranch(
  node: HandoffNode,
  overrides: Partial<Pick<HandoffNode, "searchSeed">> = {},
): HandoffNode {
  const startState = cloneResolvedStart(node.startState);
  const startLines = cloneTrackLines(node.startLines);
  const prefixFits = node.search.prefixFits.map((fit) =>
    fit === null ? null : cloneGapFit(fit)
  );
  let prefixEngine = makeBaseEngine(startState);
  if (startLines.length > 0) {
    prefixEngine = prefixEngine.addLine(startLines.map((line) => engineLineFromTrackLine(line)));
  }
  for (const fit of prefixFits) {
    if (fit === null) continue;
    prefixEngine = prefixEngine.addLine(fit.lines.map((line) => engineLineFromTrackLine(line)));
  }
  return {
    search: {
      gapIndex: node.search.gapIndex,
      prefixFits,
      prefixEngine,
      prefixNextLineId: node.search.prefixNextLineId,
      cumulativeCost: node.search.cumulativeCost,
      _candidatesCache: null,
      _childrenCache: undefined,
    },
    startState,
    startLines,
    startRank: node.startRank,
    searchSeed: overrides.searchSeed ?? node.searchSeed,
    startExpanded: node.startExpanded,
    deferExpansion: node.deferExpansion,
    rankTrace: cloneRankTrace(node.rankTrace),
    skippedContacts: node.skippedContacts,
  };
}

function cloneTrackLines(lines: TrackLine[]): TrackLine[] {
  return lines.map((line) => ({ ...line }));
}

function cloneResolvedStart(start: ResolvedStart): ResolvedStart {
  return {
    position: { ...start.position },
    velocity: { ...start.velocity },
  };
}

function cloneGapFit(fit: GapFit): GapFit {
  return {
    arc: fit.arc === null ? null : { ...fit.arc, anchor: { ...fit.arc.anchor } },
    geometry: fit.geometry,
    lines: fit.lines.map((line) => ({ ...line })),
    achieved: { ...fit.achieved },
    cost: fit.cost,
    ...copyOptionalGapFitFields(fit, { cloneObjects: true }),
    ...copyBallisticFitFields(fit as GapFit & BallisticFitFields, {
      clone: true,
    }),
  };
}

function cloneRankTrace(trace: HandoffRankTraceEntry[]): HandoffRankTraceEntry[] {
  return trace.map((entry) => ({ ...entry }));
}

function appendSkipTrace(trace: HandoffRankTraceEntry[]): HandoffRankTraceEntry[] {
  return [...trace, { rank: -1, source: "skip" }];
}

function appendOptionTrace(
  trace: HandoffRankTraceEntry[],
  option: RankedOption,
): HandoffRankTraceEntry[] {
  return [...trace, rankTraceEntryForOption(option)];
}

function rankTraceEntryForOption(option: RankedOption): HandoffRankTraceEntry {
  return {
    rank: option.rank,
    source: option.source,
    ...(option.sourceAxis === undefined ? {} : { sourceAxis: option.sourceAxis }),
  };
}

function validateBudget(raw: number | undefined): number {
  if (raw === undefined) {
    throw new Error("compileHandoff: a budget is required");
  }
  if (!Number.isSafeInteger(raw) || raw <= 0) {
    throw new Error(`compileHandoff: budget must be a positive safe integer, got ${raw}`);
  }
  return raw;
}

type HandoffAxisProfileStats = {
  count: number;
  mean: number | null;
  range: number;
};

type HandoffSpecProfile = {
  contactCount: number;
  medianContactGapFrames: number | null;
  axes: Record<AxisName, HandoffAxisProfileStats>;
  authoredGrain: HandoffAxisProfileStats;
};

type HandoffTargetProfile = {
  contactCount: number;
  medianContactGapFrames: number | null;
  axes: Record<AxisName, HandoffAxisProfileStats>;
};

function buildHandoffSpecProfile(spec: Spec): HandoffSpecProfile {
  const contactFrames: number[] = [];
  const axisValues = emptyAxisValueBuckets();
  const authoredGrain: number[] = [];

  for (const contact of spec.contacts) {
    const frame = secToFrame(contact.t);
    if (frame < K_BOUNCE_LANDING) continue;
    contactFrames.push(frame);

    const targets = axesAtFrame(frame, spec);
    for (const axis of AXES) {
      const value = axis === "impact" ? contact.impact ?? 0 : targets[axis];
      if (typeof value === "number" && Number.isFinite(value)) axisValues[axis].push(value);
    }

    const grainTarget = spec.axes.grain?.(frameToSec(frame));
    if (typeof grainTarget === "number" && Number.isFinite(grainTarget)) {
      authoredGrain.push(grainTarget);
    }
  }

  const sortedFrames = [...contactFrames].sort((a, b) => a - b);
  return {
    contactCount: sortedFrames.length,
    medianContactGapFrames: medianFrameGap(sortedFrames),
    axes: axisProfileStats(axisValues),
    authoredGrain: axisStats(authoredGrain),
  };
}

function buildHandoffTargetProfile(gaps: readonly Gap[], ctx: SpecContext): HandoffTargetProfile {
  const contactGapFrames: number[] = [];
  const axisValues = emptyAxisValueBuckets();
  let contactCount = 0;

  for (const gap of gaps) {
    if (!gap.endsWithContact) continue;
    contactCount++;
    contactGapFrames.push(gap.endFrame - gap.startFrame);
    const targets = ctx.gapAxisTargets?.[gap.index] ?? gap.targets;
    for (const axis of AXES) {
      const value = targets[axis];
      if (typeof value === "number" && Number.isFinite(value)) axisValues[axis].push(value);
    }
  }

  const sortedGaps = [...contactGapFrames].sort((a, b) => a - b);
  return {
    contactCount,
    medianContactGapFrames: sortedGaps.length === 0
      ? null
      : sortedGaps[Math.floor(sortedGaps.length / 2)],
    axes: axisProfileStats(axisValues),
  };
}

function emptyAxisValueBuckets(): Record<AxisName, number[]> {
  const buckets = {} as Record<AxisName, number[]>;
  for (const axis of AXES) buckets[axis] = [];
  return buckets;
}

function axisProfileStats(values: Record<AxisName, number[]>): Record<AxisName, HandoffAxisProfileStats> {
  const stats = {} as Record<AxisName, HandoffAxisProfileStats>;
  for (const axis of AXES) stats[axis] = axisStats(values[axis]);
  return stats;
}

function axisStats(values: readonly number[]): HandoffAxisProfileStats {
  const count = values.length;
  return {
    count,
    mean: count > 0 ? values.reduce((sum, value) => sum + value, 0) / count : null,
    range: count >= 2 ? valueRange(values) : 0,
  };
}

function medianFrameGap(sortedFrames: readonly number[]): number | null {
  const gaps = sortedFrames.slice(1).map((frame, index) => frame - sortedFrames[index]);
  if (gaps.length === 0) return null;
  return gaps[Math.floor(gaps.length / 2)];
}

function meanOrZero(stats: HandoffAxisProfileStats): number {
  return stats.mean ?? 0;
}

function rangeOrNegativeInfinityWhenMissing(stats: HandoffAxisProfileStats): number {
  return stats.count === 0 ? -Infinity : stats.range;
}

/**
 * The settled-incoming-quality exponent: the one place where the objective's
 * SHAPE (not its spend) is chosen per spec. Resolved once per compile, before
 * gaps are sliced, so it is a compile constant — which is what keeps H1 (pools
 * and rollout scalars compared across objective epochs) out of reach.
 *
 * KEPT, AND PINNED — read this before "simplifying" it away.
 *
 * The budget enters through exactly two opposed smoothsteps in
 * `continuousObjectiveCurrentPower`: `mature = smoothstep((B-150k)/100k)` is
 * exactly 1.0 at every B >= 250,000 and `scarce = 1 - smoothstep((B-150k)/75k)`
 * is exactly 0.0 at every B >= 225,000. So at every canonical budget the whole
 * scarceDense branch is multiplied by zero and the other five terms are
 * multiplied by one, and the exponent is a pure function of the spec profile.
 * Shipping that mature branch unconditionally is byte-identical at 250k and 750k
 * — 40/40 golden track hashes, verified.
 *
 * It is NOT dead. Below 250k the two arms are the compiler's scarce-budget
 * objective, and deleting them was measured on golden v1: -2.2 mean score per
 * run at 225k, and together with the start-phase pressure -13.0 at 75k with 236
 * new missing contacts across 480 runs. The Phase 3 disposition is "documented
 * sub-250k insurance". A law here would have to be scale-free in something —
 * nothing has proposed what — and the ordered work is to re-sweep the two ramps
 * against the current ruler, not to flatten them.
 *
 * THE 150,000s ARE NOT THE MATURITY SCALE. `HANDOFF_MATURITY_BUDGET_SCALE_FRAMES`
 * is a scale in `B/(B+scale)`; these are ramp ANCHORS in `(B-start)/span`. The
 * values coincide, the meanings never did, and folding them would silently
 * couple the objective's knee to the reuse/tail throttles.
 *
 * Migration note of record: making this LIVE is blocked by H1 and H2, not by the
 * scale-free rule — a pool sorted under exponent 1.0 at frame 40k and re-read at
 * frame 180k returns the frame-40k ordering, and forward-eval scalars from
 * different objective epochs would be compared against each other.
 */
function objectiveBlendCurrentPowerForSpec(
  targetBudget: number,
  profile: HandoffSpecProfile,
): number | undefined {
  if (readEnv("LR_OBJECTIVE_SETTLED_POWER") !== undefined) return undefined;
  if (readEnv("LR_IMPACT_OFF") === "1") return undefined;
  const power = continuousObjectiveCurrentPower(targetBudget, objectiveCurrentPowerProfile(profile));
  return power <= OBJECTIVE_CURRENT_BASE_POWER + OBJECTIVE_CURRENT_POWER_ACTIVATION_EPSILON
    ? undefined
    : power;
}

type ObjectiveCurrentPowerProfile = {
  contactCount: number;
  medianContactGapFrames: number | null;
  impactPrevalence: number;
  airRange: number;
  speedRange: number;
  amplitudeRange: number;
  elevationRange: number;
  grainCoverage: number;
};

function objectiveCurrentPowerProfile(profile: HandoffSpecProfile): ObjectiveCurrentPowerProfile {
  return {
    contactCount: profile.contactCount,
    medianContactGapFrames: profile.medianContactGapFrames,
    impactPrevalence: meanOrZero(profile.axes.impact),
    airRange: profile.axes.air.range,
    speedRange: profile.axes.speed.range,
    amplitudeRange: profile.axes.amplitude.range,
    elevationRange: profile.axes.elevation.range,
    grainCoverage: profile.contactCount > 0 ? profile.axes.grain.count / profile.contactCount : 0,
  };
}

function continuousObjectiveCurrentPower(
  targetBudget: number,
  profile: ObjectiveCurrentPowerProfile,
): number {
  const matureBudgetPressure = smoothstep(
    (targetBudget - OBJECTIVE_CURRENT_MATURE_START_FRAMES) /
      OBJECTIVE_CURRENT_MATURE_SPAN_FRAMES,
  );
  const scarceBudgetPressure = 1 - smoothstep(
    (targetBudget - OBJECTIVE_CURRENT_SCARCE_END_FRAMES) /
      OBJECTIVE_CURRENT_SCARCE_SPAN_FRAMES,
  );
  const midImpactPressure = plateauPressure(profile.impactPrevalence, 0.30, 0.41, 0.51, 0.64);
  const lowImpactPressure = plateauPressure(profile.impactPrevalence, 0.04, 0.12, 0.35, 0.50);
  const verticalRange = Math.max(profile.amplitudeRange, profile.elevationRange);
  const verticalPressure = Math.max(
    smoothstep((profile.amplitudeRange - 0.25) / 0.25),
    smoothstep((profile.elevationRange - 0.06) / 0.12) *
      cadenceRoomPressure(profile.medianContactGapFrames ?? 0),
  );
  const steadyPressure = (
    1 - smoothstep((profile.airRange - M87_LOW_IMPACT_STEADY_AIR_RANGE_MAX) / 0.12)
  ) * (
    1 - smoothstep((profile.speedRange - M87_LOW_IMPACT_STEADY_SPEED_RANGE_MAX) / 0.14)
  );
  const sparseCadencePressure = profile.medianContactGapFrames === null
    ? 0
    : smoothstep(
      (profile.medianContactGapFrames - M87_LOW_IMPACT_SPARSE_MEDIAN_GAP_FRAMES) /
        Math.round(FPS * 0.50),
    );
  const compactPressure = (
    1 - smoothstep((profile.contactCount - M94_LOW_IMPACT_CONTACT_MAX) / 16)
  ) * (
    profile.medianContactGapFrames === null
      ? 0
      : 1 - smoothstep((profile.medianContactGapFrames - M94_LOW_IMPACT_MEDIAN_GAP_MAX_FRAMES) / 20)
  ) * (
    1 - smoothstep((profile.amplitudeRange - M94_LOW_IMPACT_AMPLITUDE_RANGE_MAX) / 0.25)
  );
  const tinyPressure = 1 - smoothstep((profile.contactCount - 8) / 8);
  const densePressure = (
    smoothstep((profile.contactCount - 35) / 15)
  ) * (
    profile.medianContactGapFrames === null
      ? 0
      : 1 - smoothstep((profile.medianContactGapFrames - 20) / 30)
  );
  const quietVerticalPressure = 1 - smoothstep((verticalRange - 0.02) / 0.08);
  const nonGrainPressure = 1 - smoothstep((profile.grainCoverage - 0.01) / 0.09);

  const scarceDensePressure = scarceBudgetPressure * densePressure * midImpactPressure *
    quietVerticalPressure;
  const matureMidPressure = matureBudgetPressure * midImpactPressure;
  const matureLowPressure = matureBudgetPressure * lowImpactPressure *
    Math.max(steadyPressure, sparseCadencePressure, compactPressure, verticalPressure);
  const basePressure = Math.max(scarceDensePressure, matureMidPressure, matureLowPressure);

  const verticalMidBoost = matureBudgetPressure * midImpactPressure * verticalPressure;
  const compactLowBoost = matureBudgetPressure * lowImpactPressure * compactPressure;
  const tinyLowBoost = compactLowBoost * tinyPressure;
  const verticalLowBoost = matureBudgetPressure * lowImpactPressure * verticalPressure *
    (1 - compactPressure) * nonGrainPressure;

  const power = OBJECTIVE_CURRENT_BASE_POWER +
    0.5 * basePressure +
    0.5 * verticalMidBoost +
    0.5 * compactLowBoost +
    0.5 * tinyLowBoost +
    0.5 * verticalLowBoost;
  return round3(Math.min(OBJECTIVE_CURRENT_MAX_POWER, power));
}

function plateauPressure(
  value: number,
  start: number,
  fullStart: number,
  fullEnd: number,
  end: number,
): number {
  return smoothstep((value - start) / (fullStart - start)) *
    (1 - smoothstep((value - fullEnd) / (end - fullEnd)));
}

/**
 * Diagnostic ONLY: the proposal-utility exponent production would resolve for
 * one (spec, policy budget), without compiling anything.
 *
 * It calls the same profile builder and the same gate function the compile path
 * calls at handoff.ts's `setProposalUtilityPowers` site, so a study can never
 * drift from what the compiler actually does. `undefined` means "leave the
 * env/source default", exactly as at the call site.
 *
 * It reports ONE exponent now. The future-quality exponent it used to report
 * alongside came from `objectiveBlendReadinessPowerForSpec`, which was deleted
 * on its measured +0.00 / SE 0.19 null. The budget argument stays because the
 * settled exponent genuinely reads it below 250,000 frames.
 */
export function resolveProposalUtilityPowersForSpec(
  spec: Spec,
  policyBudget: number,
): {
  settledIncomingQualityPower: number | undefined;
} {
  return {
    settledIncomingQualityPower: objectiveBlendCurrentPowerForSpec(
      policyBudget,
      buildHandoffSpecProfile(spec),
    ),
  };
}

function activeFrontier(
  passStack: HandoffNode[],
  fallbackStack: HandoffNode[],
): HandoffNode[] {
  return passStack.length > 0 ? passStack : fallbackStack;
}

function popNextFrontierNode(
  passStack: HandoffNode[],
  fallbackStack: HandoffNode[],
): HandoffNode {
  return activeFrontier(passStack, fallbackStack).pop()!;
}

function peekNextFrontierNode(
  passStack: HandoffNode[],
  fallbackStack: HandoffNode[],
): HandoffNode {
  return activeFrontier(passStack, fallbackStack).at(-1)!;
}

function frontierProbeNode(node: HandoffNode): HandoffFrontierProbeNode {
  // rankTrace advances with every expansion (including non-contact skips), so
  // its final entry, rather than the raw gap index, identifies this node's
  // immediate predecessor choice.
  const entering = node.rankTrace.at(-1);
  return {
    gapIndex: node.search.gapIndex,
    enteringRank: entering?.source === "pool" ? entering.rank : null,
  };
}

function enqueueChild(
  node: HandoffNode,
  passStack: HandoffNode[],
  fallbackStack: HandoffNode[],
): void {
  if (node.skippedContacts === 0) passStack.push(node);
  else fallbackStack.push(node);
}

function enqueueDeferred(
  node: HandoffNode,
  passStack: HandoffNode[],
  fallbackStack: HandoffNode[],
): void {
  if (node.skippedContacts === 0) passStack.unshift(node);
  else fallbackStack.unshift(node);
}

function frontierContains(
  node: HandoffNode,
  passStack: readonly HandoffNode[],
  fallbackStack: readonly HandoffNode[],
): boolean {
  return passStack.includes(node) || fallbackStack.includes(node);
}

/** Remove and return ownership of one concrete queued alternative. */
function takeFrontierNode(
  node: HandoffNode,
  passStack: HandoffNode[],
  fallbackStack: HandoffNode[],
): boolean {
  const stack = node.skippedContacts === 0 ? passStack : fallbackStack;
  const index = stack.indexOf(node);
  if (index < 0) return false;
  stack.splice(index, 1);
  return true;
}

function frontierSize(passStack: HandoffNode[], fallbackStack: HandoffNode[]): number {
  return passStack.length + fallbackStack.length;
}

function snapshotFrontierStats(
  passStack: HandoffNode[],
  fallbackStack: HandoffNode[],
  telemetry: HandoffTelemetry,
): HandoffFrontierStats {
  const stats: HandoffFrontierStats = {
    handoff_frontier_size: frontierSize(passStack, fallbackStack),
    handoff_pass_frontier_size: passStack.length,
    handoff_fallback_frontier_size: fallbackStack.length,
  };
  const summary = frontierGapSummary(passStack, fallbackStack, telemetry.deepestSeenGap);
  if (summary.min !== undefined) {
    stats.handoff_frontier_min_gap = summary.min;
    if (telemetry.deepestSeenGap >= 0) {
      stats.handoff_frontier_oldest_gap_lag = Math.max(0, telemetry.deepestSeenGap - summary.min);
      stats.handoff_frontier_mean_gap_lag = summary.meanGapLag;
      stats.handoff_frontier_far_back_count = summary.farBackCount;
    }
  }
  if (summary.max !== undefined) stats.handoff_frontier_max_gap = summary.max;
  if (telemetry.deepestSeenGap >= 0) stats.handoff_deepest_seen_gap = telemetry.deepestSeenGap;
  return stats;
}

function frontierGapSummary(
  passStack: HandoffNode[],
  fallbackStack: HandoffNode[],
  deepestSeenGap: number,
): { min?: number; max?: number; meanGapLag?: number; farBackCount?: number } {
  let min: number | undefined;
  let max: number | undefined;
  let lagSum = 0;
  let farBackCount = 0;
  const visit = (node: HandoffNode): void => {
    const gap = node.search.gapIndex;
    min = min === undefined ? gap : Math.min(min, gap);
    max = max === undefined ? gap : Math.max(max, gap);
    if (deepestSeenGap >= 0) {
      const lag = Math.max(0, deepestSeenGap - gap);
      lagSum += lag;
      if (lag >= FAR_BACK_FRONTIER_LAG) farBackCount++;
    }
  };
  for (const node of passStack) visit(node);
  for (const node of fallbackStack) visit(node);
  const count = frontierSize(passStack, fallbackStack);
  return {
    min,
    max,
    meanGapLag: deepestSeenGap >= 0 && count > 0 ? round3(lagSum / count) : undefined,
    farBackCount: deepestSeenGap >= 0 && count > 0 ? farBackCount : undefined,
  };
}

function snapshotAxisQualityByAxis(
  telemetry: HandoffTelemetry,
): Partial<Record<AxisName, { attempts: number; successes: number }>> {
  const byAxis: Partial<Record<AxisName, { attempts: number; successes: number }>> = {};
  for (const axis of AXES) {
    const attempts = telemetry.axisQualityAttemptsByAxis[axis] ?? 0;
    const successes = telemetry.axisQualitySuccessesByAxis[axis] ?? 0;
    if (attempts === 0 && successes === 0) continue;
    byAxis[axis] = { attempts, successes };
  }
  return byAxis;
}

function emptyCandidateReleaseCoverage(): CandidateReleaseCoverageAccumulator {
  return {
    count: 0,
    speedCount: 0,
    speedSum: 0,
    speedSquareSum: 0,
    speedMin: Infinity,
    speedMax: -Infinity,
    velocityYCount: 0,
    velocityYSum: 0,
    velocityYSquareSum: 0,
    velocityYMin: Infinity,
    velocityYMax: -Infinity,
    groundedCount: 0,
    groundedSum: 0,
    groundedMin: Infinity,
    groundedMax: -Infinity,
    zeroGroundedCount: 0,
    airborneAtReleaseCount: 0,
  };
}

function recordCandidateReleaseCoverage(
  telemetry: HandoffTelemetry,
  candidate: Candidate,
): void {
  const coverage = telemetry.candidateReleaseCoverage;
  coverage.count++;
  if (candidate.releaseSpeed !== undefined) {
    const speed = speedPxToAuthored(candidate.releaseSpeed);
    coverage.speedCount++;
    coverage.speedSum += speed;
    coverage.speedSquareSum += speed * speed;
    coverage.speedMin = Math.min(coverage.speedMin, speed);
    coverage.speedMax = Math.max(coverage.speedMax, speed);
  }
  if (candidate.releaseVelocityY !== undefined) {
    const velocityY = candidate.releaseVelocityY;
    coverage.velocityYCount++;
    coverage.velocityYSum += velocityY;
    coverage.velocityYSquareSum += velocityY * velocityY;
    coverage.velocityYMin = Math.min(coverage.velocityYMin, velocityY);
    coverage.velocityYMax = Math.max(coverage.velocityYMax, velocityY);
  }
  if (candidate.releaseGroundedFrames !== undefined) {
    const grounded = candidate.releaseGroundedFrames;
    coverage.groundedCount++;
    coverage.groundedSum += grounded;
    coverage.groundedMin = Math.min(coverage.groundedMin, grounded);
    coverage.groundedMax = Math.max(coverage.groundedMax, grounded);
    if (grounded === 0) coverage.zeroGroundedCount++;
  }
  if (candidate.releaseAirborne === true) coverage.airborneAtReleaseCount++;
}

function snapshotCandidateReleaseCoverage(
  telemetry: HandoffTelemetry,
): Partial<CompileStats> {
  const coverage = telemetry.candidateReleaseCoverage;
  if (coverage.count === 0) return {};
  const speedMean = coverage.speedCount === 0 ? undefined : coverage.speedSum / coverage.speedCount;
  const speedVariance = speedMean === undefined
    ? undefined
    : Math.max(0, coverage.speedSquareSum / coverage.speedCount - speedMean * speedMean);
  const velocityYMean = coverage.velocityYCount === 0
    ? undefined
    : coverage.velocityYSum / coverage.velocityYCount;
  const velocityYVariance = velocityYMean === undefined
    ? undefined
    : Math.max(
      0,
      coverage.velocityYSquareSum / coverage.velocityYCount - velocityYMean * velocityYMean,
    );
  return {
    handoff_candidate_release_count: coverage.count,
    ...(coverage.speedCount === 0
      ? {}
      : {
        handoff_candidate_release_speed_mean: round3(speedMean!),
        handoff_candidate_release_speed_min: round3(coverage.speedMin),
        handoff_candidate_release_speed_max: round3(coverage.speedMax),
        handoff_candidate_release_speed_std: round3(Math.sqrt(speedVariance!)),
      }),
    ...(coverage.velocityYCount === 0
      ? {}
      : {
        handoff_candidate_release_velocity_y_mean: round3(velocityYMean!),
        handoff_candidate_release_velocity_y_min: round3(coverage.velocityYMin),
        handoff_candidate_release_velocity_y_max: round3(coverage.velocityYMax),
        handoff_candidate_release_velocity_y_std: round3(Math.sqrt(velocityYVariance!)),
      }),
    ...(coverage.groundedCount === 0
      ? {}
      : {
        handoff_candidate_release_grounded_mean: round3(coverage.groundedSum / coverage.groundedCount),
        handoff_candidate_release_grounded_min: coverage.groundedMin,
        handoff_candidate_release_grounded_max: coverage.groundedMax,
        handoff_candidate_release_zero_grounded_count: coverage.zeroGroundedCount,
      }),
    handoff_candidate_release_airborne_count: coverage.airborneAtReleaseCount,
  };
}

function emptyCandidatePreviewCoverage(): CandidatePreviewCoverageAccumulator {
  return {
    count: 0,
    zeroFirstSurvivors: 0,
    firstSurvivorSum: 0,
    firstSurvivorMin: Infinity,
    firstSurvivorMax: -Infinity,
  };
}

function recordCandidatePreviewCoverage(
  telemetry: HandoffTelemetry,
  preview: ReturnType<typeof previewNextContact>,
): void {
  if (preview.horizon <= 0) return;
  const coverage = telemetry.candidatePreviewCoverage;
  coverage.count++;
  coverage.firstSurvivorSum += preview.firstSurvivors;
  coverage.firstSurvivorMin = Math.min(coverage.firstSurvivorMin, preview.firstSurvivors);
  coverage.firstSurvivorMax = Math.max(coverage.firstSurvivorMax, preview.firstSurvivors);
  if (preview.firstSurvivors === 0) coverage.zeroFirstSurvivors++;
}

function snapshotCandidatePreviewCoverage(
  telemetry: HandoffTelemetry,
): Partial<CompileStats> {
  const coverage = telemetry.candidatePreviewCoverage;
  if (coverage.count === 0) return {};
  return {
    handoff_candidate_preview_count: coverage.count,
    handoff_candidate_preview_zero_next_count: coverage.zeroFirstSurvivors,
    handoff_candidate_preview_first_survivors_mean:
      round3(coverage.firstSurvivorSum / coverage.count),
    handoff_candidate_preview_first_survivors_min: coverage.firstSurvivorMin,
    handoff_candidate_preview_first_survivors_max: coverage.firstSurvivorMax,
  };
}

function emptyPhaseCounter(): Record<HandoffNodeEventPhase, number> {
  return Object.fromEntries(
    HANDOFF_EVALUATION_PHASES.map((phase) => [phase, 0]),
  ) as Record<HandoffNodeEventPhase, number>;
}

function snapshotPhaseCounter(
  counter: Record<HandoffNodeEventPhase, number>,
): HandoffEvaluationPhaseCounter {
  const out: HandoffEvaluationPhaseCounter = {};
  for (const phase of HANDOFF_EVALUATION_PHASES) {
    const count = counter[phase] ?? 0;
    if (count > 0) out[phase] = count;
  }
  return out;
}

function snapshotContactCountCounter(counter: Record<number, number>): HandoffContactCountCounter {
  const out: HandoffContactCountCounter = {};
  for (const key of Object.keys(counter).map(Number).sort((a, b) => a - b)) {
    const count = counter[key] ?? 0;
    if (count > 0) out[key] = count;
  }
  return out;
}

function incrementContactCountCounter(counter: Record<number, number>, contacts: number): void {
  counter[contacts] = (counter[contacts] ?? 0) + 1;
}

function recordEvaluationTelemetry(
  telemetry: HandoffTelemetry,
  consideredSearchNodes: WeakSet<SearchNode>,
  search: SearchNode,
  fullDuration: boolean,
  phase: HandoffNodeEventPhase,
): boolean {
  telemetry.evaluationsByPhase[phase]++;
  if (fullDuration) telemetry.fullEvaluations++;
  else telemetry.partialEvaluations++;
  if (fullDuration) telemetry.fullEvaluationsByPhase[phase]++;

  if (consideredSearchNodes.has(search)) {
    telemetry.duplicateEvaluations++;
    telemetry.duplicateEvaluationsByPhase[phase]++;
    if (fullDuration) {
      telemetry.duplicateFullEvaluations++;
      telemetry.duplicateFullEvaluationsByPhase[phase]++;
    }
    return false;
  }
  consideredSearchNodes.add(search);
  return true;
}

type CandidateWorkSnapshot = {
  actualCandidateSamples: number;
  viableCandidates: number;
  candidateSamplesByStream: Record<string, number>;
};

function emptyCandidateWorkSnapshot(): CandidateWorkSnapshot {
  return {
    actualCandidateSamples: 0,
    viableCandidates: 0,
    candidateSamplesByStream: {},
  };
}

function snapshotCandidateWork(): CandidateWorkSnapshot {
  return {
    actualCandidateSamples: getCandidateSamples(),
    viableCandidates: getViableCandidates(),
    candidateSamplesByStream: getCandidateSamplesByMode(),
  };
}

function candidateWorkSince(
  before: CandidateWorkSnapshot,
  after: CandidateWorkSnapshot,
): CandidateWorkSnapshot {
  const modes = new Set([
    ...Object.keys(before.candidateSamplesByStream),
    ...Object.keys(after.candidateSamplesByStream),
  ]);
  return {
    actualCandidateSamples: Math.max(
      0,
      after.actualCandidateSamples - before.actualCandidateSamples,
    ),
    viableCandidates: Math.max(0, after.viableCandidates - before.viableCandidates),
    candidateSamplesByStream: Object.fromEntries(
      [...modes].map((mode) => [
        mode,
        Math.max(
          0,
          (after.candidateSamplesByStream[mode] ?? 0) -
            (before.candidateSamplesByStream[mode] ?? 0),
        ),
      ]),
    ),
  };
}

function toBudgetRegisterKey(key: LeafKey | null): BudgetInternalRegisterKey | null {
  return key === null
    ? null
    : {
      contract_passed: key.contract_passed,
      axis_quality: key.axis_quality,
      internal_full_score: key.full_score,
      drift_quality: key.drift_quality ?? null,
    };
}

function recordImprovementTelemetry(
  telemetry: HandoffTelemetry,
  phase: HandoffNodeEventPhase,
  improved: boolean,
): void {
  if (improved) telemetry.improvementsByPhase[phase]++;
}

function canSkipPartialEvaluation(
  node: HandoffNode,
  gaps: Gap[],
  register: BestSoFarRegister,
): boolean {
  // A nonterminal partial report is always contract-failing (future contacts are
  // missing and the terminus is forced before end-of-spec). Once a full passing
  // output exists, scoring more dominated partials cannot improve the register;
  // keep expanding the node, but spend detector work only on terminal/tail
  // completions that can still improve axis quality.
  const bestKey = register.getBestKey();
  return bestKey?.contract_passed === true && !isTerminalNode(node.search, gaps);
}

function expandNode(
  node: HandoffNode,
  gaps: Gap[],
  ctx: SpecContext,
  startOptions: StartOption[],
  telemetry: HandoffTelemetry,
  policy: HandoffSearchPolicy,
  targetBudget: number,
): HandoffNode[] {
  if (isTerminalNode(node.search, gaps)) return [];
  if (!node.startExpanded) {
    return startOptions.map((option) => ({
      search: option.root,
      startState: option.state,
      startLines: option.startLines,
      startRank: option.rank,
      searchSeed: node.searchSeed,
      startExpanded: true,
      deferExpansion: startOptions.length > 1,
      rankTrace: [],
      skippedContacts: 0,
    }));
  }
  const gap = gaps[node.search.gapIndex];
  if (!gap.endsWithContact) {
    return [{
      search: extendNodeCached(node.search, null),
      startState: node.startState,
      startLines: node.startLines,
      startRank: node.startRank,
      searchSeed: node.searchSeed,
      startExpanded: node.startExpanded,
      deferExpansion: false,
      rankTrace: appendSkipTrace(node.rankTrace),
      skippedContacts: node.skippedContacts,
    }];
  }

  recordHandoffPolicyTelemetry(telemetry, policy);
  const normalOptionsAt = (nCand: number): RankedOption[] =>
    rankedOptions(node.search, gaps, ctx, node.searchSeed, telemetry, {
      nCand,
      preview: policy.preview,
      axisQualitySearch: policy.axisQualitySearch,
      releaseSetup: policy.releaseSetup,
      forwardStageTop: policy.forwardStageTop,
      deadlineMargin: policy.deadlineMargin,
      forwardEval: policy.forwardEval,
      reuseLimit: policy.reuseLimit,
      previewCostWeight: PREVIEW_COST_WEIGHT,
      budgetSlack: policy.budgetSlack,
      targetBudget,
    });
  let options = normalOptionsAt(policy.nCand);
  const fullWidthRetry = policy.normalEmptyFallbackNCand;
  if (
    options.length === 0 &&
    fullWidthRetry !== undefined &&
    fullWidthRetry > policy.nCand
  ) {
    telemetry.valueProbeEmptyFullWidthRetryAttempts++;
    const requestedBefore = telemetry.candidatePoolRequests.sum;
    const geometryBefore = getCandidateSamples();
    const framesBefore = getSimFrames();
    options = normalOptionsAt(fullWidthRetry);
    telemetry.valueProbeEmptyFullWidthRetryRequestedProposals +=
      telemetry.candidatePoolRequests.sum - requestedBefore;
    telemetry.valueProbeEmptyFullWidthRetryIncrementalRequestedProposals +=
      fullWidthRetry - policy.nCand;
    telemetry.valueProbeEmptyFullWidthRetryCandidateGeometryEvaluations +=
      getCandidateSamples() - geometryBefore;
    telemetry.valueProbeEmptyFullWidthRetryFrames += getSimFrames() - framesBefore;
    if (options.length > 0) telemetry.valueProbeEmptyFullWidthRetrySuccesses++;
  }
  // Dead-end cascade: when the normal batch finds no viable catch for a required
  // contact, try the rescue lanes in order until one yields options. Lanes are
  // data — each names its admission predicate and produces its option list. Lanes
  // 1 & 2 share the ranker config literal via rescueOptions (differing only in the
  // per-tier nCand/poolSize); the startup lane samples a distinct catch stream.
  // Telemetry (attempt/success) is uniform across all lanes.
  if (options.length === 0) {
    const rescueTiers: { predicate: () => boolean; run: () => RankedOption[] }[] = [
      {
        // Base rescue: extra deterministic sampling with a startup-pressure ramp.
        predicate: () => shouldAttemptDeadEndRescue(node.search, gap, ctx),
        run: () => {
          const breadth = startupRescueBreadth(gap.endFrame);
          return rescueOptions(node.search, gaps, ctx, node.searchSeed, telemetry, policy, targetBudget, {
            nCand: breadth.rescueNCand,
            poolSize: breadth.rescuePoolSize,
          });
        },
      },
      {
        // Short-gap rescue: wide extra sampling only for very short AUTHORED
        // gaps (nothing to do with the budget deadline); clean prefixes only.
        predicate: () => node.skippedContacts === 0 && shouldAttemptShortGapRescue(gap),
        run: () => {
          const nCand = shortGapRescueCandidateCount(gap.endFrame - gap.startFrame);
          return rescueOptions(node.search, gaps, ctx, node.searchSeed, telemetry, policy, targetBudget, {
            nCand,
            poolSize: Math.min(nCand, HANDOFF_SHORT_RESCUE_CANDIDATE_POOL),
          });
        },
      },
      {
        // Startup rescue: a distinct catch stream for missing first/tight contacts.
        predicate: () => shouldAttemptStartupDeadEndRescue(gap),
        run: () => startupDeadEndOptions(node.search, gaps, ctx, node.searchSeed, telemetry, {
          preview: policy.preview,
          releaseSetup: policy.releaseSetup,
          previewCostWeight: PREVIEW_COST_WEIGHT,
          targetBudget,
        }),
      },
    ];
    for (const tier of rescueTiers) {
      if (options.length > 0) break;
      if (!tier.predicate()) continue;
      telemetry.rescueAttempts++;
      options = tier.run();
      if (options.length > 0) telemetry.rescueSuccesses++;
    }
  }
  if (options.length === 0) {
    if (handoffDeadEndProbeHook !== null) {
      handoffDeadEndProbeHook({
        node,
        simFrames: getSimFrames(),
        hasCompletion: telemetry.hasCompletion,
        deepestSeenGap: telemetry.deepestSeenGap,
      });
    }
    telemetry.skips++;
    telemetry.deferredSkips++;
    return [{
      search: extendNodeCached(node.search, null),
      startState: node.startState,
      startLines: node.startLines,
      startRank: node.startRank,
      searchSeed: node.searchSeed,
      startExpanded: node.startExpanded,
      deferExpansion: true,
      rankTrace: appendSkipTrace(node.rankTrace),
      skippedContacts: node.skippedContacts + 1,
    }];
  }

  return options.slice(0, policy.branchLimit).map((option) => ({
    search: option.child,
    startState: node.startState,
    startLines: node.startLines,
    startRank: node.startRank,
    searchSeed: node.searchSeed,
    startExpanded: node.startExpanded,
    deferExpansion: false,
    rankTrace: appendOptionTrace(node.rankTrace, option),
    skippedContacts: node.skippedContacts + (option.candidate === null ? 1 : 0),
  }));
}

// Shared rankedOptions-based rescue lane: the common ranker config literal
// (preview/axis/release/reuse/slack/budget pulled from the node's policy) with a
// per-tier (nCand, poolSize). The dead-end cascade in expandNode drives lanes 1 &
// 2 through this; the startup lane uses its own catch stream (startupDeadEndOptions).
function rescueOptions(
  search: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
  policy: HandoffSearchPolicy,
  targetBudget: number,
  tier: { nCand: number; poolSize: number },
): RankedOption[] {
  return rankedOptions(search, gaps, ctx, seed, telemetry, {
    nCand: tier.nCand,
    poolSize: tier.poolSize,
    preview: policy.preview,
    axisQualitySearch: policy.axisQualitySearch,
    releaseSetup: policy.releaseSetup,
    forwardStageTop: policy.forwardStageTop,
    deadlineMargin: policy.deadlineMargin,
    forwardEval: policy.forwardEval,
    reuseLimit: policy.reuseLimit,
    previewCostWeight: PREVIEW_COST_WEIGHT,
    budgetSlack: policy.budgetSlack,
    targetBudget,
  });
}

function shouldAttemptDeadEndRescue(node: SearchNode, gap: Gap, ctx: SpecContext): boolean {
  if (!gap.endsWithContact) return false;
  if (gap.endFrame - gap.startFrame < HANDOFF_RESCUE_MIN_GAP_FRAMES) return false;
  const targetSpeed = gap.targets?.speed;
  if (targetSpeed === undefined) {
    return false;
  }
  const targetSpeedPx = authoredSpeedToPx(targetSpeed);
  if (targetSpeedPx <= HANDOFF_BRAKE_TARGET_MIN_PX_PER_FRAME + HANDOFF_BRAKE_TARGET_EPSILON_PX_PER_FRAME) {
    return false;
  }
  if (targetSpeedPx > HANDOFF_BRAKE_TARGET_MAX_PX_PER_FRAME + HANDOFF_BRAKE_TARGET_EPSILON_PX_PER_FRAME) {
    return false;
  }
  const ts = getCandidateProbe(node.prefixEngine, gap, ctx).targetState;
  const speedRatio = ts.speed / targetSpeedPx;
  return shouldOfferBrakeCandidates(targetSpeedPx, speedRatio);
}

function startupRescuePressure(endFrame: number): number {
  const t = Math.max(0, endFrame) / HANDOFF_RESCUE_STARTUP_PRESSURE_HALFLIFE_FRAMES;
  return 1 / (1 + t * t);
}

function startupRescueBreadth(endFrame: number): {
  rescueNCand: number;
  rescuePoolSize: number;
  startupK: number;
} {
  const pressure = startupRescuePressure(endFrame);
  const rescueNCand = HANDOFF_RESCUE_BASE_N_CAND +
    Math.round(HANDOFF_RESCUE_STARTUP_EXTRA_N_CAND * pressure);
  const rescuePoolSize = Math.min(
    rescueNCand,
    HANDOFF_RESCUE_CANDIDATE_POOL +
      Math.round((HANDOFF_RESCUE_STARTUP_EXTRA_N_CAND / 12) * pressure),
  );
  return {
    rescueNCand,
    rescuePoolSize,
    // The distinct startup stream is capped at half the extra rescue breadth.
    startupK: clampIntLocal(
      Math.round((HANDOFF_RESCUE_STARTUP_EXTRA_N_CAND / 2) * pressure),
      0,
      HANDOFF_RESCUE_STARTUP_EXTRA_N_CAND / 2,
    ),
  };
}

function shouldAttemptShortGapRescue(gap: Gap): boolean {
  return gap.endsWithContact &&
    shortGapRescueCandidateCount(gap.endFrame - gap.startFrame) > 0;
}

function shouldAttemptStartupDeadEndRescue(gap: Gap): boolean {
  return gap.endsWithContact && startupDeadEndCandidateCount(gap) > 0;
}

export function shortGapRescueCandidateCount(gapFrames: number): number {
  if (!Number.isFinite(gapFrames) || gapFrames <= 0) return 0;
  return gapFrames < HANDOFF_SHORT_RESCUE_MAX_GAP_FRAMES
    ? HANDOFF_SHORT_RESCUE_N_CAND
    : 0;
}

// Shared scoring context for the EXTRA-candidate lanes. Every lane maps its
// generated candidates 1:1 through
// scoreCandidateForHandoff with the same preview/budget context; only the tag and
// the rank offset differ (captured per-lane in ExtraCandidateLaneSpec).
type ExtraCandidateScoring = {
  preview: boolean;
  previewCostWeight: number;
  releaseSetup: boolean;
  targetBudget: number;
  budgetSlack: number;
  openingBestOpportunity: number;
  allowForwardEval: boolean;
};

// Per-node memo slot descriptor. Reuse keys on its reuse limit, seeded lanes key
// on the search seed; startup does not memoize (no `cache`). read/write bind a lane to
// its own fields in the shared ExtraCandidateCache.
type ExtraCandidateCacheSlot = {
  key: number | string;
  read: (cache: ExtraCandidateCache) => { value?: Candidate[]; key?: number | string };
  write: (cache: ExtraCandidateCache, value: Candidate[], key: number | string) => void;
};

type ExtraCandidateLaneSpec = {
  tag: HandoffCandidateSource;
  sourceAxis?: AxisName;
  rankBase: number;
  // Lane-specific generator; owns that lane's telemetry counters and ref handling.
  generate: () => Candidate[];
  cache?: ExtraCandidateCacheSlot;
};

// Resolve a lane's candidate list, honoring its optional per-node memo slot:
// return the cached value when present and its key matches, else regenerate and
// store. Byte-identical to the previous cachedReuse/cachedBrake wrappers.
function resolveExtraCandidates(node: SearchNode, spec: ExtraCandidateLaneSpec): Candidate[] {
  if (spec.cache === undefined) return spec.generate();
  const cache = extraCandidateCache.get(node) ?? {};
  const cached = spec.cache.read(cache);
  if (cached.value !== undefined && cached.key === spec.cache.key) return cached.value;
  const generated = spec.generate();
  spec.cache.write(cache, generated, spec.cache.key);
  extraCandidateCache.set(node, cache);
  return generated;
}

// One shared lane runner for every extra stream: (optionally memoized)
// generation, then a 1:1 map through scoreCandidateForHandoff stamping the lane
// tag and offsetting the rank past the pool. Returns the scored options for the
// caller to push/sort — reuse and brake feed the shared pool, startup its own.
function extraCandidateLane(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
  scoring: ExtraCandidateScoring,
  spec: ExtraCandidateLaneSpec,
): RankedOption[] {
  const candidates = resolveExtraCandidates(node, spec);
  return candidates.map((candidate, j) =>
    scoreCandidateForHandoff(
      node, candidate, spec.rankBase + j, spec.tag, gaps, ctx, seed, telemetry,
      scoring.preview, scoring.previewCostWeight,
      scoring.releaseSetup, scoring.targetBudget, spec.sourceAxis,
      scoring.budgetSlack, scoring.openingBestOpportunity,
      undefined,
      scoring.allowForwardEval,
    )
  );
}

// Shared seeded-RNG catch generator for the seeded lanes: one makeRng
// stream mixed from (seed, gapIndex, seedSalt), a K-attempt sample loop with
// paired attempt/success telemetry, and ref cleared (an extra catch is never a
// steady-state reuse seed). The two lanes differ only in seedSalt, the per-attempt
// sample seed, the sample mode, and which telemetry counters they bump.
function sampleSeededCatchCandidates(
  node: SearchNode,
  gap: Gap,
  ctx: SpecContext,
  seed: number,
  count: number,
  spec: {
    seedSalt: number;
    sampleSeed: (attempt: number) => number;
    mode: CandidateSampleMode;
    timeSupport?: boolean;
    onAttempt: () => void;
    onSuccess: () => void;
  },
): Candidate[] {
  const rng = makeRng((Math.imul(seed | 0, 1000003) + node.gapIndex + spec.seedSalt) | 0);
  const out: Candidate[] = [];
  for (let attempt = 0; attempt < count; attempt++) {
    spec.onAttempt();
    const cand = sampleOneCandidate(
      node.prefixEngine, gap, rng, ctx, node.prefixNextLineId, spec.sampleSeed(attempt), spec.mode,
      undefined,
      spec.timeSupport ? "time-extend" : undefined,
    );
    if (cand !== null) {
      spec.onSuccess();
      cand.ref = undefined; // never reuse an extra catch as a steady-state seed
      out.push(cand);
    }
  }
  return out;
}

function startupDeadEndOptions(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
  config: {
    preview?: boolean;
    previewCostWeight?: number;
    releaseSetup?: boolean;
    targetBudget?: number;
  } = {},
): RankedOption[] {
  const preview = config.preview ?? true;
  const previewCostWeight = config.previewCostWeight ?? PREVIEW_COST_WEIGHT;
  const scored = extraCandidateLane(node, gaps, ctx, seed, telemetry, {
    preview,
    previewCostWeight,
    releaseSetup: config.releaseSetup ?? false,
    targetBudget: config.targetBudget ?? 0,
    budgetSlack: 0,
    openingBestOpportunity: 0,
    allowForwardEval: false,
  }, {
    tag: "startup",
    rankBase: 0,
    generate: () => startupDeadEndCandidates(node, gaps, ctx, seed, telemetry),
  });
  scored.sort((a, b) =>
    a.score - b.score ||
    (a.candidate?.cost ?? Infinity) - (b.candidate?.cost ?? Infinity) ||
    a.rank - b.rank
  );
  return scored.slice(0, HANDOFF_BRANCHING);
}

function startupDeadEndCandidates(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
): Candidate[] {
  const gap = gaps[node.gapIndex];
  if (!gap.endsWithContact) return [];
  const k = startupDeadEndCandidateCount(gap);
  if (k <= 0) return [];
  return sampleSeededCatchCandidates(node, gap, ctx, seed, k, {
    seedSalt: 0x85ebca6b,
    sampleSeed: (attempt) => 7000 + attempt,
    mode: "startup_catch",
    onAttempt: () => {
      telemetry.startupAttempts++;
    },
    onSuccess: () => {
      telemetry.startupSuccesses++;
    },
  });
}

/**
 * The normal pool owns the common path. Support-time candidates are additive
 * only when that pool has no predicted next-contact air inside the objective's
 * existing deadband. This is an observed coverage trigger: it contains no gap
 * duration or case class, and it stays inert when ordinary geometry already
 * spans the authored support timing.
 */
function supportTimeCoverageDeficit(
  node: SearchNode,
  gap: Gap,
  gaps: Gap[],
  ctx: SpecContext,
  pool: readonly HandoffAdmittedCandidate[],
): number {
  const nextGap = nextContactGap(gap, gaps);
  if (nextGap === null) return 0;
  const nextTargets = ctx.gapAxisTargets?.[nextGap.index] ?? nextGap.targets;
  if (nextTargets.air === undefined) return 0;
  const gapFrames = scorerGapFrameCount(nextGap);
  const ask = airDeliverabilityAsk(nextTargets.air, gapFrames);
  const entrySpeed = getCandidateProbe(node.prefixEngine, gap, ctx).targetState.speed;
  if (supportExtensionPressure({ air: nextTargets.air, gapFrames, speed: entrySpeed }) <= 0) {
    return 0;
  }
  const predictedAir = pool.flatMap(({ candidate }) => {
    const projection = projectOutgoingScorerGap(
      candidate,
      nextGap,
      ctx.gapAxisTargets,
    );
    return projection === null
      ? []
      : projection.achieved.air === undefined
      ? []
      : [projection.achieved.air];
  });
  return predictedAir.length === 0
    ? 0
    : Math.max(0, Math.min(...predictedAir) - ask - AIR_DELIVERABILITY_DEADBAND);
}

function supportTimeCandidates(
  node: SearchNode,
  gap: Gap,
  ctx: SpecContext,
  seed: number,
  count: number,
  telemetry: HandoffTelemetry,
): Candidate[] {
  return sampleSeededCatchCandidates(node, gap, ctx, seed, count, {
    seedSalt: 0x27d4eb2d,
    sampleSeed: (attempt) => attempt,
    mode: "normal",
    timeSupport: true,
    onAttempt: () => {
      telemetry.axisQualityAttempts++;
      telemetry.axisQualityAttemptsByAxis.air =
        (telemetry.axisQualityAttemptsByAxis.air ?? 0) + 1;
    },
    onSuccess: () => {
      telemetry.axisQualitySuccesses++;
      telemetry.axisQualitySuccessesByAxis.air =
        (telemetry.axisQualitySuccessesByAxis.air ?? 0) + 1;
    },
  });
}

function retainAirCoverageImprovements(
  candidates: Candidate[],
  gap: Gap,
  gaps: Gap[],
  ctx: SpecContext,
  pool: readonly HandoffAdmittedCandidate[],
): Candidate[] {
  const nextGap = nextContactGap(gap, gaps);
  if (nextGap === null) return [];
  const nextTargets = ctx.gapAxisTargets?.[nextGap.index] ?? nextGap.targets;
  if (nextTargets.air === undefined) return [];
  const gapFrames = scorerGapFrameCount(nextGap);
  const ask = airDeliverabilityAsk(nextTargets.air, gapFrames);
  const incumbentErrors = pool.flatMap(({ candidate }) => {
    const air = projectOutgoingScorerGap(
      candidate,
      nextGap,
      ctx.gapAxisTargets,
    )?.achieved.air;
    return air === undefined ? [] : [Math.abs(air - ask)];
  });
  if (incumbentErrors.length === 0) return [];
  const bestIncumbentError = Math.min(...incumbentErrors);
  return candidates.filter((candidate) => {
    const air = projectOutgoingScorerGap(
      candidate,
      nextGap,
      ctx.gapAxisTargets,
    )?.achieved.air;
    return air !== undefined && Math.abs(air - ask) + 1e-9 < bestIncumbentError;
  });
}

function supportTimeCandidateCount(deficit: number): number {
  if (deficit <= 0) return 0;
  const pressure = smoothstep(clamp01(deficit / HANDOFF_SUPPORT_TIME_FULL_DEFICIT));
  return HANDOFF_SUPPORT_TIME_BASE_K + Math.round(
    (HANDOFF_SUPPORT_TIME_MAX_K - HANDOFF_SUPPORT_TIME_BASE_K) * pressure,
  );
}

function supportTimeCoverageLaneEnabled(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_SUPPORT_COVERAGE_LANE !== "0";
}

function startupDeadEndCandidateCount(gap: Gap): number {
  return startupRescueBreadth(gap.endFrame).startupK;
}

function admittedHandoffPool(
  sorted: Candidate[],
  poolSize: number,
): HandoffAdmittedCandidate[] {
  return sorted.slice(0, poolSize).map((candidate, rank) => ({ candidate, rank }));
}

/**
 * Give one locally better impact candidate access to the ordinary scorer only
 * when its exact six-frame native response does not add speed, deformation,
 * relative-motion, or phase debt against the quality-objective incumbent.
 * The pool stays fixed-width; the experiment pays and records every response
 * frame it asks the engine to simulate.
 */
function admitResponseSafeImpactCandidate(
  node: SearchNode,
  gap: Gap,
  gaps: Gap[],
  ctx: SpecContext,
  sorted: Candidate[],
  admitted: HandoffAdmittedCandidate[],
  mode: ImpactResponseAdmissionMode | null,
  hasCompletion: boolean,
  inRepairLane: boolean,
): HandoffAdmittedCandidate[] {
  if (
    mode === null || mode === "cached-contact-repair" || admitted.length === 0 ||
    sorted.length <= admitted.length ||
    (mode === "model-safe-08-post" && !hasCompletion) ||
    ((mode === "exact-contact-all-repair" || mode === "model-exact-contact-repair" ||
      mode === "same-speed-tail-repair" || mode === "same-speed-active-tail-repair") &&
      !inRepairLane)
  ) return admitted;
  const targets = ctx.gapAxisTargets?.[gap.index] ?? gap.targets;
  const impactTarget = targets.impact;
  const incumbent = admitted[0]!.candidate;
  const incumbentImpact = incumbent.achieved.impact;
  if (impactTarget === undefined || incumbentImpact === undefined) return admitted;
  impactResponseAdmissionTotals.eligible_pools++;
  const incumbentQuality = scoreSettledIncomingQuality(targets, settledIncomingAxes(incumbent));
  const incumbentError = Math.abs(incumbentImpact - impactTarget);
  if (mode === "same-speed-tail-repair" || mode === "same-speed-active-tail-repair") {
    const speedTarget = targets.speed;
    const incumbentSpeed = incumbent.achieved.speed;
    if (speedTarget === undefined || incumbentSpeed === undefined) return admitted;
    const incumbentSpeedError = Math.abs(incumbentSpeed - speedTarget);
    const admittedCandidates = new Set(admitted.map((entry) => entry.candidate));
    const specialists = sorted.filter((candidate) => {
      if (admittedCandidates.has(candidate)) return false;
      const impact = candidate.achieved.impact;
      const speed = candidate.achieved.speed;
      return impact !== undefined && speed !== undefined &&
        Math.abs(impact - impactTarget) + .025 < incumbentError &&
        Math.abs(speed - speedTarget) <= incumbentSpeedError + 1e-12;
    }).sort((left, right) =>
      Math.abs(left.achieved.impact! - impactTarget) -
        Math.abs(right.achieved.impact! - impactTarget) ||
      left.cost - right.cost
    );
    impactResponseAdmissionTotals.prefiltered_candidates += specialists.length;
    const specialist = specialists[0];
    if (specialist === undefined) return admitted;
    if (mode === "same-speed-active-tail-repair") {
      if (specialist.ref === undefined) return admitted;
      const activeLines = applyImpactWindowAccelerationAfterReference(
        specialist.lines,
        specialist.ref,
        authoredSpeedToPx(specialist.achieved.speed ?? speedTarget),
      );
      const materialLines = activeLines.reduce(
        (count, line) => count + (line.type === 1 ? 1 : 0),
        0,
      );
      if (materialLines === 0) return admitted;
      impactResponseAdmissionTotals.active_repair_material_lines += materialLines;
      const before = getSimFrames();
      const active = tryCandidateLines(
        node.prefixEngine,
        gap,
        activeLines,
        node.prefixNextLineId,
        ctx.allContactFrames,
        axisLookaheadEndFrame(gap, ctx.allContactFrames),
        gap.targets,
        true,
        "normal",
        getCandidateProbe(node.prefixEngine, gap, ctx).preTargetSledTrace,
        { allowRideOutPolish: false },
      ) as Candidate | null;
      impactResponseAdmissionTotals.active_repair_probes++;
      impactResponseAdmissionTotals.active_repair_probe_frames += getSimFrames() - before;
      if (active === null) return admitted;
      impactResponseAdmissionTotals.active_repair_viable++;
      active.ref = { ...specialist.ref };
      active.sampleAttempt = specialist.sampleAttempt;
      const activeImpact = active.achieved.impact;
      const activeSpeed = active.achieved.speed;
      if (activeImpact === undefined || activeSpeed === undefined) return admitted;
      const specialistImpactError = Math.abs(specialist.achieved.impact! - impactTarget);
      const specialistSpeedError = Math.abs(specialist.achieved.speed! - speedTarget);
      const activeImpactError = Math.abs(activeImpact - impactTarget);
      const activeSpeedError = Math.abs(activeSpeed - speedTarget);
      if (
        activeImpactError > specialistImpactError + .01 ||
        activeImpactError + .025 >= incumbentError ||
        activeSpeedError >= specialistSpeedError - 1e-12 ||
        activeSpeedError > incumbentSpeedError + 1e-12
      ) return admitted;
      impactResponseAdmissionTotals.active_repair_interaction_passed++;
      impactResponseAdmissionTotals.safe_candidates++;
      impactResponseAdmissionTotals.impact_error_gain_sum += incumbentError - activeImpactError;
      impactResponseAdmissionTotals.settled_quality_gain_sum +=
        scoreSettledIncomingQuality(targets, settledIncomingAxes(active)) - incumbentQuality;
      impactResponseAdmissionTotals.inserted++;
      impactResponseAdmittedCandidates.add(active);
      return [...admitted.slice(0, -1), { candidate: active, rank: sorted.indexOf(specialist) }];
    }
    impactResponseAdmissionTotals.safe_candidates++;
    impactResponseAdmissionTotals.impact_error_gain_sum += incumbentError -
      Math.abs(specialist.achieved.impact! - impactTarget);
    impactResponseAdmissionTotals.settled_quality_gain_sum +=
      scoreSettledIncomingQuality(targets, settledIncomingAxes(specialist)) - incumbentQuality;
    impactResponseAdmissionTotals.inserted++;
    impactResponseAdmittedCandidates.add(specialist);
    return [...admitted.slice(0, -1), { candidate: specialist, rank: sorted.indexOf(specialist) }];
  }
  const prefiltered = sorted.filter((candidate) => {
    if (candidate === incumbent) return false;
    const impact = candidate.achieved.impact;
    return impact !== undefined &&
      Math.abs(impact - impactTarget) + .025 < incumbentError &&
      scoreSettledIncomingQuality(targets, settledIncomingAxes(candidate)) > incumbentQuality;
  }).sort((left, right) =>
    Math.abs(left.achieved.impact! - impactTarget) - Math.abs(right.achieved.impact! - impactTarget) ||
    left.cost - right.cost
  );
  impactResponseAdmissionTotals.prefiltered_candidates += prefiltered.length;
  if (prefiltered.length === 0) return admitted;

  let exactCandidates = prefiltered;
  if (mode === "model-exact-contact-repair") {
    const admittedCandidates = new Set(admitted.map((entry) => entry.candidate));
    let modelSurvivor: Candidate | null = null;
    let survivorLogit = -Infinity;
    for (const candidate of prefiltered) {
      if (admittedCandidates.has(candidate)) continue;
      impactResponseAdmissionTotals.model_candidates_scored++;
      const logit = impactResponseCandidateLogit(
        candidate,
        incumbent,
        sorted.indexOf(candidate),
        gap,
        gaps,
        ctx,
      );
      if (logit > survivorLogit) {
        modelSurvivor = candidate;
        survivorLogit = logit;
      }
    }
    if (modelSurvivor === null || survivorLogit < IMPACT_RESPONSE_MODEL_THRESHOLD_LOGIT) {
      return admitted;
    }
    impactResponseAdmissionTotals.model_candidates_admitted++;
    exactCandidates = [modelSurvivor];
  }

  if (mode === "model-safe-08-admit" || mode === "model-safe-08-post") {
    const admittedCandidates = new Set(admitted.map((entry) => entry.candidate));
    const modelCandidates = prefiltered.filter((candidate) => !admittedCandidates.has(candidate));
    impactResponseAdmissionTotals.model_candidates_scored += modelCandidates.length;
    let survivor: Candidate | null = null;
    let survivorLogit = -Infinity;
    for (const candidate of modelCandidates) {
      const qualityRank = sorted.indexOf(candidate);
      const logit = impactResponseCandidateLogit(
        candidate,
        incumbent,
        qualityRank,
        gap,
        gaps,
        ctx,
      );
      if (logit > survivorLogit) {
        survivor = candidate;
        survivorLogit = logit;
      }
    }
    if (survivor === null || survivorLogit < IMPACT_RESPONSE_MODEL_THRESHOLD_LOGIT) {
      return admitted;
    }
    impactResponseAdmissionTotals.safe_candidates++;
    impactResponseAdmissionTotals.model_candidates_admitted++;
    impactResponseAdmissionTotals.impact_error_gain_sum += incumbentError -
      Math.abs(survivor.achieved.impact! - impactTarget);
    impactResponseAdmissionTotals.settled_quality_gain_sum +=
      scoreSettledIncomingQuality(targets, settledIncomingAxes(survivor)) - incumbentQuality;
    impactResponseAdmittedCandidates.add(survivor);
    const rank = sorted.indexOf(survivor);
    impactResponseAdmissionTotals.inserted++;
    return [...admitted.slice(0, -1), { candidate: survivor, rank }];
  }

  const probe = (candidate: Candidate): CandidateContactResponseSummary | null => {
    const before = getSimFrames();
    const summary = summarizeCandidateContactResponse(
      candidateOwnedContactResponse(node.prefixEngine, candidate, gap, true),
    );
    impactResponseAdmissionTotals.response_probes++;
    impactResponseAdmissionTotals.response_probe_frames += getSimFrames() - before;
    return summary;
  };
  const incumbentResponse = probe(incumbent);
  if (incumbentResponse === null) return admitted;
  const limit = mode === "exact-safe-all" || mode === "exact-contact-all-repair"
    ? exactCandidates.length
    : Math.min(8, exactCandidates.length);
  let survivor: Candidate | null = null;
  for (let index = 0; index < limit; index++) {
    const candidate = exactCandidates[index]!;
    const response = probe(candidate);
    const stateSafe = response !== null && responseSafeImpactTransition(incumbentResponse, response);
    const contactSafe = response !== null &&
      ((mode !== "exact-contact-all-repair" && mode !== "model-exact-contact-repair") ||
        responseRetainsCandidateContact(incumbentResponse, response));
    if (stateSafe && !contactSafe) impactResponseAdmissionTotals.contact_retention_rejects++;
    if (stateSafe && contactSafe) {
      survivor = candidate;
      break;
    }
  }
  if (survivor === null) return admitted;
  impactResponseAdmissionTotals.safe_candidates++;
  impactResponseAdmissionTotals.impact_error_gain_sum += incumbentError -
    Math.abs(survivor.achieved.impact! - impactTarget);
  impactResponseAdmissionTotals.settled_quality_gain_sum +=
    scoreSettledIncomingQuality(targets, settledIncomingAxes(survivor)) - incumbentQuality;
  impactResponseAdmittedCandidates.add(survivor);
  const existing = admitted.find((entry) => entry.candidate === survivor);
  if (existing !== undefined) {
    impactResponseAdmissionTotals.already_admitted++;
    return admitted;
  }
  const rank = sorted.indexOf(survivor);
  impactResponseAdmissionTotals.inserted++;
  return [...admitted.slice(0, -1), { candidate: survivor, rank }];
}

function impactResponseCandidateLogit(
  candidate: Candidate,
  incumbent: Candidate,
  qualityRank: number,
  gap: Gap,
  gaps: Gap[],
  ctx: SpecContext,
): number {
  const targets = ctx.gapAxisTargets?.[gap.index] ?? gap.targets;
  const impactTarget = targets.impact!;
  const incumbentError = Math.abs(incumbent.achieved.impact! - impactTarget);
  const candidateError = Math.abs(candidate.achieved.impact! - impactTarget);
  const incumbentAxisRms = candidateAxisRms(incumbent, targets);
  const axisRms = candidateAxisRms(candidate, targets);
  const segmentLengths = candidate.lines.map((line) =>
    Math.hypot(line.x2 - line.x1, line.y2 - line.y1)
  );
  const segmentAngles = candidate.lines.map((line) =>
    Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180 / Math.PI
  );
  const lineLength = segmentLengths.reduce((sum, value) => sum + value, 0);
  const totalTurnDeg = segmentAngles.slice(1).reduce((sum, angle, index) =>
    sum + Math.abs(((angle - segmentAngles[index]! + 180) % 360 + 360) % 360 - 180), 0
  );
  const nextGap = nextContactGap(gap, gaps);
  const projection = nextGap === null
    ? null
    : projectOutgoingScorerGap(candidate, nextGap, ctx.gapAxisTargets);
  const readinessGap = nextGap === null ? null : successorScorerGapAfter(nextGap, gaps);
  const readiness = projection === null || nextGap === null
    ? null
    : scoreNextArcReadiness(
      projection.projection,
      nextGap,
      readinessGap,
      ctx.gapAxisTargets,
    );
  const launch = candidate.ballisticLaunch;
  const release = launch?.state;
  const releaseElapsedFrames = launch === undefined ? null : launch.anchorFrame - gap.endFrame;
  const releaseDisplacement = release === undefined || candidate.ref === undefined
    ? null
    : Math.hypot(release.x - candidate.ref.x, release.y - candidate.ref.y);
  const arrivalGapFrames = projection?.projection.frameCount ?? null;
  return impactResponseModelLogit([
    impactTarget,
    incumbentError,
    incumbentAxisRms,
    qualityRank,
    candidateError,
    axisRms,
    scoreSettledIncomingQuality(targets, settledIncomingAxes(candidate)),
    candidateQualityObjective(nodeEngineForModel(candidate), candidate, gap, gaps, ctx),
    readiness?.readiness,
    readiness?.catchability,
    readiness?.speedFit,
    readiness?.impactFeasibility,
    lineLength,
    candidate.lines.length,
    segmentLengths.length === 0 ? null : lineLength / segmentLengths.length,
    segmentLengths.length === 0 ? null : Math.min(...segmentLengths),
    segmentLengths.length === 0 ? null : Math.max(...segmentLengths),
    totalTurnDeg,
    releaseElapsedFrames,
    candidate.releaseGroundedFrames,
    releaseDisplacement,
    release === undefined ? null : Math.hypot(release.vx, release.vy),
    release?.vx,
    release?.vy,
    launch?.groundedFrames,
    projection?.projection.boundary.incoming.speed,
    projection?.projection.boundary.incoming.comAngleDeg,
    projection?.achieved.air,
    arrivalGapFrames,
    incumbentError - candidateError,
    incumbentAxisRms - axisRms,
    lineLength / Math.max(1, arrivalGapFrames ?? 1),
    releaseDisplacement === null ? null : releaseDisplacement / Math.max(1, arrivalGapFrames ?? 1),
  ]);
}

function candidateAxisRms(candidate: Candidate, targets: AxisValues): number {
  const achieved = settledIncomingAxes(candidate);
  const squared = AXES.flatMap((axis) => {
    const target = targets[axis];
    const value = achieved[axis];
    return target === undefined || value === undefined || !Number.isFinite(value)
      ? []
      : [(value - target) ** 2];
  });
  return squared.length === 0
    ? Infinity
    : Math.sqrt(squared.reduce((sum, value) => sum + value, 0) / squared.length);
}

/** candidateQualityObjective ignores its engine argument; keep that dependency
 * explicit here so the learned screen cannot accidentally acquire an exact read. */
function nodeEngineForModel(_candidate: Candidate): null {
  return null;
}

type RankedOptionsConfig = {
  nCand?: number;
  poolSize?: number;
  preview?: boolean;
  axisQualitySearch?: boolean;
  reuseLimit?: number;
  previewCostWeight?: number;
  releaseSetup?: boolean;
  targetBudget?: number;
  budgetSlack?: number;
  /** Live deadline margin; Infinity for callers outside the paced search. */
  deadlineMargin?: number;
  forwardStageTop?: number;
  /** Slack-conditioned pre-completion depth (see HandoffSearchPolicy.forwardEval).
   *  Default true so non-policy callers keep the historical behavior. */
  forwardEval?: boolean;
};

/**
 * Rank this node's options — and, for the whole of that work, publish the
 * build's deadline pressure to the re-draw law (`rolloutRedrawPressure`).
 *
 * The scope is the ENTIRE build, not just the pool sort: rollouts run from the
 * pool scoring, from the three extra candidate lanes, and from the staged
 * pre-pass, and every one of them re-draws against the same node-level margin.
 * Saved and restored rather than cleared, so a nested build (a rescue tier, the
 * tail-completion lane) returns the outer build's pressure and a throw cannot
 * leak a stale one into start selection.
 *
 * The pressure is the RAW ramp, deliberately: the phase-weighted `pressure`
 * below is the head ramp's own consumer term (`postCompletionPhaseWeight`, 0 in
 * production = the Phase-1a boundary), and folding that in would make the dose a
 * MODE — full law before first completion, base draw after — which is the shape
 * the law exists to avoid. The re-draw corrects a verdict; it does not spend the
 * head's width.
 */
function rankedOptions(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
  config: RankedOptionsConfig = {},
): RankedOption[] {
  const savedRedrawPressure = rolloutRedrawPressure;
  rolloutRedrawPressure = deadlinePressure(config.deadlineMargin ?? Infinity);
  try {
    return rankedOptionsAtDeadlinePressure(node, gaps, ctx, seed, telemetry, config);
  } finally {
    rolloutRedrawPressure = savedRedrawPressure;
  }
}

function rankedOptionsAtDeadlinePressure(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
  config: RankedOptionsConfig,
): RankedOption[] {
  const requestedCandidates = config.nCand ?? HANDOFF_QUALITY_N_CAND;
  // This is the authoritative proposal-request boundary. Unlike policyNCand,
  // it includes base, rescue, and tail-completion builds and therefore closes
  // against the pool/request funnel used by V3 telemetry.
  recordNumeric(telemetry.candidatePoolRequests, requestedCandidates);
  const targetBudget = config.targetBudget ?? 0;
  const gap = gaps[node.gapIndex];
  const normalCandidates = requestedCandidates;
  const deadlineMargin = config.deadlineMargin ?? Infinity;
  /* PHASE-1a BOUNDARY — the deliberate scope of the two pool-affecting
   * consumers below.
   *
   * The margin itself is live for the WHOLE compile (see the deadline read in
   * `compileHandoffInternal`): after first completion it switches to the
   * incumbent's measured cost-to-end and keeps its meaning, and the observation
   * hook reports it either way. What is scoped is only who ACTS on it. Phase 1a
   * ships the head-narrowing ramp and the aim-lane throttle at the same
   * temporal scope the paced slack had — pre-completion — because the
   * post-completion arm was measured separately and it is the localized cost:
   * over 44 sources x 8 seeds at 750k the whole bundle reads -0.90 +/- 0.34 per
   * cell against -0.39 +/- 0.27 with these two gated, and every one of the new
   * cross-state pool reads (node.ts `LR_DEADLINE_CACHE_ASSERT`) came from the
   * post-completion arm. Re-introducing it is Phase 1b's job, which owns the
   * pool-memo cache key and the scoping question the repair phase raises
   * (narrowing rollouts inside a repair episode fights the ROI study's
   * bigger-ceilings-buy-acceptance result).
   *
   * SC-16, the online-continuation lane below, needs no gate here: its own
   * `onlineContinuationFrontierReady` already requires `!hasCompletion`.
   *
   * The boundary is a MODE (all three consumers on, then all three off) and the
   * head ramp below is the one consumer that can be a magnitude instead — see
   * `postCompletionPhaseWeight`, the study arm that measures exactly that. */
  const deadlineConsumersActive = !telemetry.hasCompletion;
  /* The aiming lane is a simulated probe design per base — the second largest
   * lookahead spend after forward evaluation. Hold it to the same rule as the
   * rolled head below: at full deadline pressure it keeps only its head bases
   * (node.ts `AIM_LANE_DEADLINE_BASE_SHARE`). The flag is scoped to this one
   * `getCandidatesSorted` call and restored in `finally` — every other caller
   * in the compile builds pools unthrottled, which is the property that keeps
   * the pool memo's missing throttle key harmless.
   *
   * It stays PRE-COMPLETION-ONLY even under the head ramp's phase-weight study
   * arm: this gate is binary (`underFullDeadlinePressure`), so weighting it
   * would not throttle a magnitude, it would introduce a second mode. Out of
   * scope by construction, not by omission. */
  const aimLaneThrottled = deadlineConsumersActive &&
    underFullDeadlinePressure(deadlineMargin);
  setAimLaneDeadlineThrottled(aimLaneThrottled);
  setAimBaseFitReuseAllowed(telemetry.hasCompletion);
  let sorted: Candidate[];
  try {
    sorted = getCandidatesSorted(
      node,
      gaps,
      ctx,
      seed,
      normalCandidates,
    );
  } finally {
    setAimLaneDeadlineThrottled(false);
    setAimBaseFitReuseAllowed(false);
  }
  const poolSize = config.poolSize ?? handoffCandidatePool();
  let pool = admittedHandoffPool(sorted, poolSize);
  pool = admitResponseSafeImpactCandidate(
    node, gap, gaps, ctx, sorted, pool, impactResponseAdmissionMode(), telemetry.hasCompletion,
    repairLaneActive,
  );
  // Rollout-economics probe (measure-only): the search genuinely arrived here and
  // built its real pool — the realized ruler the rollout verdicts are scored
  // against. `?.()` short-circuits before the record literal, so an
  // uninstrumented compile allocates nothing.
  handoffExpansionProbeHook?.({
    node,
    gapIndex: node.gapIndex,
    poolCandidates: sorted.length,
    hasCompletion: telemetry.hasCompletion,
    nCand: normalCandidates,
    repairLane: repairLaneActive,
    repairAnchorGapIndex: activeRepairAnchorGapIndex,
  });
  const preview = config.preview ?? true;
  const previewCostWeight = config.previewCostWeight ?? PREVIEW_COST_WEIGHT;
  const extraRankBase = poolSize;
  const openingBestOpportunity = openingBestForwardEvalOpportunity(
    node,
    gaps,
    ctx,
    pool,
    targetBudget,
    config.budgetSlack ?? 0,
  );
  const allowForwardEval = config.forwardEval ?? true;
  /* Narrow the rolled head as the compile runs out of room: full width while
   * the budget left comfortably covers the work left, `HANDOFF_FORWARD_EVAL_TOP`
   * once it no longer does. Inside the Phase-1a boundary above, so the repair
   * and resumed passes roll at full width as they do today — unless the
   * phase-weight study arm is set, which turns that boundary from a mode into a
   * magnitude for this ONE consumer (`postCompletionPhaseWeight`; weight 0 =
   * production = today's boundary exactly). */
  const phaseWeight = deadlineConsumersActive ? 1 : postCompletionPhaseWeight();
  const pressure = phaseWeight <= 0 ? 0 : phaseWeight * deadlinePressure(deadlineMargin);
  recordDeadlinePoolBuild(deadlineMargin, pressure, deadlineConsumersActive);
  const forwardEvalTop = HANDOFF_FORWARD_EVAL_TOP <= 0 ? 0 : Math.round(
    pool.length + (HANDOFF_FORWARD_EVAL_TOP - pool.length) * pressure,
  );
  const scorePoolCandidate = (
    candidate: Candidate,
    rank: number,
    forwardConfigOverride?: CandidateForwardPolicy,
  ): RankedOption => scoreCandidateForHandoff(
      node, candidate, rank, "pool", gaps, ctx, seed, telemetry, preview, previewCostWeight,
      config.releaseSetup ?? false,
      targetBudget,
      undefined,
      config.budgetSlack ?? 0,
      openingBestOpportunity,
      forwardConfigOverride,
      allowForwardEval,
    );
  const stageTop = Math.min(Math.max(0, config.forwardStageTop ?? 0), pool.length);
  const baseForwardConfig = fwdEvalRuntime.config;
  const effectiveForwardConfig = baseForwardConfig === null
    ? null
    : adaptiveForwardEvalConfig(
      baseForwardConfig,
      node,
      gaps,
      targetBudget,
      config.budgetSlack ?? 0,
      openingBestOpportunity,
    );
  const stagedForwardEval = stageTop >= HANDOFF_BRANCHING &&
    stageTop < pool.length &&
    allowForwardEval &&
    usesForwardEvalAtBudget(targetBudget) &&
    effectiveForwardConfig?.variant === "greedy" &&
    effectiveForwardConfig.depth === 2 &&
    effectiveForwardConfig.branch === 1;
  let scored: RankedOption[];
  if (stagedForwardEval && effectiveForwardConfig !== null) {
    // The cheap pre-stage stays single-attempt (firstBranch stripped): only the
    // stageTop finalists pay the impact-pressured first-level width.
    const shallowConfig: CandidateForwardPolicy = { ...effectiveForwardConfig, depth: 1, firstBranch: 1 };
    const shallow = pool.map(({ candidate, rank }) =>
      scorePoolCandidate(candidate, rank, shallowConfig)
    );
    const finalists = new Set(
      [...shallow]
        .sort((a, b) => a.score - b.score || a.rank - b.rank)
        .slice(0, stageTop)
        .map((option) => option.candidate),
    );
    scored = shallow.map((option) =>
      option.candidate !== null && finalists.has(option.candidate)
        ? scorePoolCandidate(option.candidate, option.rank, effectiveForwardConfig)
        : { ...option, score: Infinity }
    );
  } else if (
    forwardEvalTop > 0 && forwardEvalTop < pool.length && allowForwardEval &&
    effectiveForwardConfig !== null && usesForwardEvalAtBudget(targetBudget)
  ) {
    scored = pool.map(({ candidate, rank }) =>
      rank < forwardEvalTop
        ? scorePoolCandidate(candidate, rank)
        : { ...scoreCandidateForHandoff(
            node, candidate, rank, "pool", gaps, ctx, seed, telemetry, preview, previewCostWeight,
            config.releaseSetup ?? false,
            targetBudget,
            undefined,
            config.budgetSlack ?? 0,
            openingBestOpportunity,
            undefined,
            false,
          ), score: Infinity }
    );
  } else {
    scored = pool.map(({ candidate, rank }) => scorePoolCandidate(candidate, rank));
  }
  if (handoffCapacityProbeHook !== null && targetBudget >= 500_000) {
    const incumbent = [...scored]
      .filter((option): option is RankedOption & { candidate: Candidate } => option.candidate !== null)
      .sort((a, b) => a.score - b.score || a.candidate.cost - b.candidate.cost || a.rank - b.rank)[0];
    if (incumbent !== undefined) {
      handoffCapacityProbeHook({
        gapIndex: node.gapIndex,
        simFrames: getSimFrames(),
        source: incumbent.source,
        rank: incumbent.rank,
        cost: incumbent.candidate.cost,
        capacity: continuationCapacity(node, incumbent.candidate, gaps, ctx, seed, 16),
      });
    }
  }
  if (handoffPoolProbeHook !== null) {
    const handoffScores = new Map(
      scored.flatMap((option) => option.candidate === null
        ? []
        : [[option.candidate, option.score] as const]),
    );
    const admitted = new Set(pool.map((entry) => entry.candidate));
    const nextGapIndex = nextContactGapIndex(gaps, node.gapIndex + 1);
    const nextGap = nextGapIndex < 0 ? null : gaps[nextGapIndex];
    const currentTargets = ctx.gapAxisTargets?.[gap.index] ?? gap.targets;
    const nextTargets = nextGap === null
      ? null
      : ctx.gapAxisTargets?.[nextGap.index] ?? nextGap.targets;
    const readinessOutgoingGap = nextGap === null
      ? null
      : successorScorerGapAfter(nextGap, gaps);
    const candidateProbe = getCandidateProbe(node.prefixEngine, gap, ctx);
    const entrySpeed = candidateProbe.targetState.speed;
    const precontactHistory = candidateProbe.precontactHistory();
    const collisionWindows = new Map<number, HandoffPoolProbeCollisionWindow | null>();
    const contactGeometry = new Map<number, HandoffPoolProbeContactGeometry | null>();
    const contactResponse = new Map<number, HandoffPoolProbeContactResponse | null>();
    const collisionWindowAtQualityRank = (qualityRank: number): HandoffPoolProbeCollisionWindow | null => {
      if (!Number.isSafeInteger(qualityRank) || qualityRank < 0 || qualityRank >= sorted.length) return null;
      const cached = collisionWindows.get(qualityRank);
      if (cached !== undefined) return cached;
      const window = candidateOwnedCollisionWindow(node.prefixEngine, sorted[qualityRank]!, gap);
      collisionWindows.set(qualityRank, window);
      return window;
    };
    const contactGeometryAtQualityRank = (qualityRank: number): HandoffPoolProbeContactGeometry | null => {
      if (!Number.isSafeInteger(qualityRank) || qualityRank < 0 || qualityRank >= sorted.length) return null;
      const cached = contactGeometry.get(qualityRank);
      if (cached !== undefined) return cached;
      const observation = candidateOwnedContactGeometry(node.prefixEngine, sorted[qualityRank]!, gap);
      contactGeometry.set(qualityRank, observation);
      return observation;
    };
    const contactResponseAtQualityRank = (qualityRank: number): HandoffPoolProbeContactResponse | null => {
      if (!Number.isSafeInteger(qualityRank) || qualityRank < 0 || qualityRank >= sorted.length) return null;
      const cached = contactResponse.get(qualityRank);
      if (cached !== undefined) return cached;
      const observation = candidateOwnedContactResponse(node.prefixEngine, sorted[qualityRank]!, gap);
      contactResponse.set(qualityRank, observation);
      return observation;
    };
    handoffPoolProbeHook({
      gapIndex: gap.index,
      entrySpeed,
      precontactHistory,
      targets: currentTargets,
      nextTargets,
      candidates: sorted.map((candidate, qualityRank) => {
        const segmentLengths = candidate.lines.map((line) =>
          Math.hypot(line.x2 - line.x1, line.y2 - line.y1)
        );
        const segmentAngles = candidate.lines.map((line) =>
          Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180 / Math.PI
        );
        const totalTurnDeg = segmentAngles.slice(1).reduce((sum, angle, index) =>
          sum + Math.abs(
            ((angle - segmentAngles[index] + 180) % 360 + 360) % 360 - 180,
          ), 0
        );
        const launch = candidate.ballisticLaunch;
        const release = launch?.state;
        const projection = nextGap === null
          ? null
          : projectOutgoingScorerGap(
            candidate,
            nextGap,
            ctx.gapAxisTargets,
          );
        const readiness = projection === null || nextGap === null
          ? null
          : scoreNextArcReadiness(
            projection.projection,
            nextGap,
            readinessOutgoingGap,
            ctx.gapAxisTargets,
          );
        return {
          qualityRank,
          lineLength: candidate.lines.reduce(
            (sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1),
            0,
          ),
          lineCount: candidate.lines.length,
          meanSegmentLength: segmentLengths.reduce((sum, value) => sum + value, 0) /
            segmentLengths.length,
          minSegmentLength: Math.min(...segmentLengths),
          maxSegmentLength: Math.max(...segmentLengths),
          totalTurnDeg,
          cost: candidate.cost,
          achieved: candidate.achieved,
          qualityObjective: candidateQualityObjective(
            node.prefixEngine,
            candidate,
            gap,
            gaps,
            ctx,
          ),
          currentQuality: scoreSettledIncomingQuality(
            currentTargets,
            settledIncomingAxes(candidate),
          ),
          readiness: readiness?.readiness ?? null,
          catchability: readiness?.catchability ?? null,
          speedFit: readiness?.speedFit ?? null,
          impactFeasibility: readiness?.impactFeasibility ?? null,
          airFit: readiness?.airFit ?? null,
          elevationFit: readiness?.elevationFit ?? null,
          releaseFrame: launch?.anchorFrame ?? null,
          releaseElapsedFrames: launch === undefined
            ? null
            : launch.anchorFrame - gap.endFrame,
          catchWindowGroundedFrames: candidate.releaseGroundedFrames ?? null,
          releaseDisplacement: release === undefined || candidate.ref === undefined
            ? null
            : Math.hypot(release.x - candidate.ref.x, release.y - candidate.ref.y),
          releaseSpeed: release === undefined ? null : Math.hypot(release.vx, release.vy),
          releaseVx: release?.vx ?? null,
          releaseVy: release?.vy ?? null,
          releaseGrounded: launch?.groundedFrames ?? null,
          releaseAirborne: launch?.airborne ?? null,
          arrivalSpeed:
            projection?.projection.boundary.incoming.speed ?? null,
          arrivalAngleDeg:
            projection?.projection.boundary.incoming.comAngleDeg ?? null,
          arrivalAir: projection?.achieved.air ?? null,
          arrivalGapFrames: projection?.projection.frameCount ?? null,
          arrivalElevation: projection?.projection.elevation ?? null,
          admitted: admitted.has(candidate),
          ...(handoffScores.has(candidate)
            ? { handoffScore: handoffScores.get(candidate) }
            : {}),
        };
      }),
      collisionWindowAtQualityRank,
      contactGeometryAtQualityRank,
      contactResponseAtQualityRank,
    });
  }
  // Agreement instrument (measure-only): record ONLY when the pool was scored via the
  // forward-eval path (mirror scoreCandidateForHandoff's condition), over the POOL-SOURCE
  // entries only — this is before reuse/brake extras are pushed onto `scored`.
  if (
    fwdEvalRuntime.agreementTelemetry &&
    fwdEvalRuntime.config !== null &&
    usesForwardEvalAtBudget(targetBudget)
  ) {
    recordFwdEvalAgreement(scored, gaps[node.gapIndex]?.targets?.impact);
  }
  // Extra-candidate lanes (see extraCandidateLane): each generates a few more
  // catches and pushes them onto `scored` with its own tag and a rank offset past
  // the pool. Reuse translates the most recent committed catch to this gap's entry
  // state (a sled-relative catch can stay valid at a later similar entry on a
  // steady periodic rhythm); brake offers uphill-entry arcs that bleed speed
  // before contact when the rider runs over a MODERATE target speed. Deterministic
  // (pure function of the prefix) and additive, so ranking monotonicity holds.
  const extraScoring: ExtraCandidateScoring = {
    preview,
    previewCostWeight,
    releaseSetup: config.releaseSetup ?? false,
    targetBudget,
    budgetSlack: config.budgetSlack ?? 0,
    openingBestOpportunity,
    allowForwardEval,
  };
  const repairTransitionOptions = extraCandidateLane(
    node,
    gaps,
    ctx,
    seed,
    telemetry,
    extraScoring,
    {
      tag: "pool",
      rankBase: extraRankBase,
      generate: () => repairLaneActive
        ? makeContactTransitionCandidates(
          node.prefixEngine,
          gap,
          gaps,
          ctx,
          node.prefixNextLineId,
          pool.map(({ candidate }) => candidate),
          "repair",
        )
        : [],
    },
  );
  for (const option of repairTransitionOptions) scored.push(option);
  const supportCount = supportTimeCoverageLaneEnabled()
    ? supportTimeCandidateCount(supportTimeCoverageDeficit(node, gap, gaps, ctx, pool))
    : 0;
  const kinematicEligible = kinematicRescueReady(node, telemetry) &&
    poolForwardContinuationAbsent(scored);
  const supportOptions = extraCandidateLane(node, gaps, ctx, seed, telemetry, extraScoring, {
    tag: "axisq",
    sourceAxis: "air",
    rankBase: extraRankBase + repairTransitionOptions.length,
    generate: () => supportCount > 0
      ? retainAirCoverageImprovements(
        [
          ...supportTimeCandidates(node, gap, ctx, seed, supportCount, telemetry),
          ...(kinematicEligible
            ? makeKinematicSupportCandidates(
              node,
              gap,
              gaps,
              ctx,
              node.prefixNextLineId,
              pool.map(({ candidate }) => candidate),
            )
            : []),
        ],
        gap,
        gaps,
        ctx,
        pool,
      )
      : [],
    cache: {
      key: `${seed}:${supportCount}:${kinematicEligible ? 1 : 0}`,
      read: (cache) => ({ value: cache.support, key: cache.supportKey }),
      write: (cache, value, key) => {
        cache.support = value;
        cache.supportKey = String(key);
      },
    },
  });
  const admittedSupportOptions = supportOptions.filter((option) => {
    if (!isKinematicSupportCandidate(option.candidate)) return true;
    const reachable = option.forwardContinuation === true;
    recordKinematicSupportContinuation(option.candidate, reachable);
    return reachable;
  });
  for (const option of admittedSupportOptions) scored.push(option);
  const reuseLimit = config.reuseLimit ?? reuseCandidateLimit(node, targetBudget, telemetry);
  const reuseOptions = extraCandidateLane(node, gaps, ctx, seed, telemetry, extraScoring, {
    tag: "reuse",
    rankBase: extraRankBase + repairTransitionOptions.length + admittedSupportOptions.length,
    generate: () => reuseCatchCandidates(node, gaps, ctx, telemetry, reuseLimit),
    cache: {
      key: reuseLimit,
      read: (cache) => ({ value: cache.reuse, key: cache.reuseK }),
      write: (cache, value, key) => {
        cache.reuse = value;
        cache.reuseK = Number(key);
      },
    },
  });
  for (const option of reuseOptions) scored.push(option);
  const brakeOptions = extraCandidateLane(node, gaps, ctx, seed, telemetry, extraScoring, {
    tag: "brake",
    rankBase: extraRankBase + repairTransitionOptions.length + admittedSupportOptions.length +
      reuseOptions.length,
    generate: () => brakeCatchCandidates(node, gaps, ctx, seed, telemetry),
    cache: {
      key: seed,
      read: (cache) => ({ value: cache.brake, key: cache.brakeSeed }),
      write: (cache, value, key) => {
        cache.brake = value;
        cache.brakeSeed = Number(key);
      },
    },
  });
  for (const option of brakeOptions) scored.push(option);
  // Under full deadline pressure, stop spending the active frontier on
  // candidates whose charged rollout already proved they cannot place the next
  // contact. This is dominance, not extra search work; ordinary/unknown pools
  // and all post-completion quality work retain their existing order.
  //
  // It fires at the same anchor as every other consumer. A pruning-dominance
  // rule is a maximum-response behaviour, not a rescue, so it has no business
  // owning a private, stricter threshold: the lane's own spend-vs-progress
  // comparator was deleted in Phase 1a for exactly that reason, and the
  // `margin < 1` anchor that briefly replaced it went the same way. Every one
  // of the old comparator's 331 firings in the instrumented 150k corpus was
  // already inside `margin < 1`, which is in turn inside this ramp's
  // full-pressure end, so the containment argument that justified the swap
  // holds a fortiori here. Its 750k firings were scored as false alarms by a
  // completion predictor, which is the wrong ruler for a pruning filter —
  // measured, they land on the knife-edge specs, and disabling the lane there
  // costs `frontier_dense_recovery` ~50k frames to first completion out of a
  // 750k budget it finishes at 88% of.
  const applyOnlineContinuation = onlineContinuationEnabled() &&
      onlineContinuationFrontierReady(node, telemetry) &&
      underFullDeadlinePressure(deadlineMargin) &&
      scored.some((option) => option.forwardContinuation === true);
  if (handoffDeadlineProbeHook !== null) {
    // Observation-only, and only inside the guard: the options this filter is
    // about to drop, plus the node each verdict was read at. `advanceToNextContact`
    // walks memoized `extendNodeCached` links and charges no frames, and the
    // nodes it lands on are the ones the rollout already judged.
    const pruned = applyOnlineContinuation
      ? scored.filter((option) => option.forwardContinuation === false)
      : [];
    const prunedNodes: SearchNode[] = [];
    for (const option of pruned) {
      const at = advanceToNextContact(option.child, gaps);
      if (at !== null) prunedNodes.push(at);
    }
    handoffDeadlineProbeHook({
      simFrames: getSimFrames(),
      gapIndex: node.gapIndex,
      hasCompletion: telemetry.hasCompletion,
      margin: deadlineMargin,
      pressure,
      poolSize: pool.length,
      forwardEvalTop,
      aimLaneThrottled,
      repairLane: repairLaneActive,
      onlineContinuationApplied: applyOnlineContinuation,
      onlineContinuationPruned: pruned.length,
      onlineContinuationPrunedNodes: prunedNodes,
      gaps,
      ctx,
      seed,
    });
  }
  const eligible = applyOnlineContinuation
    ? scored.filter((option) => option.forwardContinuation !== false)
    : scored;
  eligible.sort((a, b) =>
    a.score - b.score ||
    (a.candidate?.cost ?? Infinity) - (b.candidate?.cost ?? Infinity) ||
    a.rank - b.rank
  );
  const kinematic = eligible.filter((option) => isKinematicSupportCandidate(option.candidate));
  let selected = kinematic.length === 0
    ? eligible.slice(0, HANDOFF_BRANCHING)
    : [
      ...eligible.filter((option) => !isKinematicSupportCandidate(option.candidate))
        .slice(0, HANDOFF_BRANCHING - 1),
      kinematic[0],
    ];
  selected = applyRepairTargetSearchPolicy(selected, eligible, gap, ctx);
  if (impactRepairInsuranceMode() !== null && repairLaneActive) {
    impactRepairInsuranceTotals.eligible_pools++;
    if (kinematic.length > 0) {
      // The kinematic lane already owns one reserved branch. Do not compose
      // two branch-replacement policies in the same repair pool.
      impactRepairInsuranceTotals.suppressed_by_reserved_branch++;
    } else {
      selected = insureSameSpeedImpactRepairBranch(selected, eligible, gap, ctx);
    }
  }
  const responseAdmissionMode = impactResponseAdmissionMode();
  if (
    responseAdmissionMode === "cached-contact-repair" && repairLaneActive &&
    kinematic.length === 0
  ) {
    selected = reserveCachedResponseSafeRepairBranch(selected, eligible, gap, ctx);
  }
  const reserveResponseBranch = responseAdmissionMode === "exact-safe-8" ||
    responseAdmissionMode === "exact-safe-all" ||
    ((responseAdmissionMode === "exact-safe-8-repair" ||
      responseAdmissionMode === "exact-contact-all-repair" ||
      responseAdmissionMode === "model-exact-contact-repair") && repairLaneActive);
  if (reserveResponseBranch && kinematic.length === 0) {
    const responseSafe = eligible.find((option) =>
      option.candidate !== null && impactResponseAdmittedCandidates.has(option.candidate)
    );
    if (responseSafe !== undefined) {
      if (!selected.some((option) => option.candidate === responseSafe.candidate)) {
        if (selected.length >= HANDOFF_BRANCHING) selected.pop();
        selected.push(responseSafe);
      }
      impactResponseAdmissionTotals.branch_reserved++;
    }
  }
  recordContactTransitionBranchSelection(selected.map((option) => option.candidate));
  if (handoffRankedOptionsProbeHook !== null) {
    handoffRankedOptionsProbeHook({
      gapIndex: node.gapIndex,
      simFrames: getSimFrames(),
      eligible: eligible.map(summarizeRankedOptionForProbe),
      selected: selected.map(summarizeRankedOptionForProbe),
    });
  }
  return selected;
}

/**
 * Give one existing repair branch to an impact specialist only when the normal
 * forward ranker has already simulated both child engines beyond H+6 and the
 * exact cached response preserves the incumbent's state and candidate-owned
 * multi-contact work.  This mode cannot add a candidate, branch, or physics
 * frame: it merely chooses which already-ranked option occupies branch three.
 */
function reserveCachedResponseSafeRepairBranch(
  selected: RankedOption[],
  eligible: RankedOption[],
  gap: Gap,
  ctx: SpecContext,
): RankedOption[] {
  const incumbent = selected[0];
  if (incumbent?.candidate === null || incumbent?.candidate === undefined) return selected;
  const targets = ctx.gapAxisTargets?.[gap.index] ?? gap.targets;
  const impactTarget = targets.impact;
  const speedTarget = targets.speed;
  const incumbentImpact = incumbent.candidate.achieved.impact;
  const incumbentSpeed = incumbent.candidate.achieved.speed;
  if (
    impactTarget === undefined || speedTarget === undefined ||
    incumbentImpact === undefined || incumbentSpeed === undefined
  ) return selected;
  impactResponseAdmissionTotals.eligible_pools++;

  const responseEnd = gap.endFrame + IMPACT_WINDOW;
  const isCachedThroughResponse = (option: RankedOption): boolean => {
    const engine = option.child.prefixEngine as { getLastFrameIndex?: () => unknown };
    if (typeof engine?.getLastFrameIndex !== "function") return false;
    const last = engine.getLastFrameIndex();
    return typeof last === "number" && Number.isFinite(last) && last >= responseEnd;
  };
  if (!isCachedThroughResponse(incumbent)) return selected;

  const incumbentError = Math.abs(incumbentImpact - impactTarget);
  const incumbentSpeedError = Math.abs(incumbentSpeed - speedTarget);
  const incumbentQuality = scoreSettledIncomingQuality(
    targets,
    settledIncomingAxes(incumbent.candidate),
  );
  const candidates = eligible.filter((option): option is RankedOption & { candidate: Candidate } => {
    if (
      option === incumbent || option.source !== "pool" || option.candidate === null ||
      !isCachedThroughResponse(option)
    ) return false;
    const impact = option.candidate.achieved.impact;
    const speed = option.candidate.achieved.speed;
    return impact !== undefined && speed !== undefined &&
      Math.abs(impact - impactTarget) + .025 < incumbentError &&
      Math.abs(speed - speedTarget) <= incumbentSpeedError + 1e-12;
  }).sort((left, right) =>
    Math.abs(left.candidate.achieved.impact! - impactTarget) -
      Math.abs(right.candidate.achieved.impact! - impactTarget) ||
    left.score - right.score || left.rank - right.rank
  );
  impactResponseAdmissionTotals.prefiltered_candidates += candidates.length;
  if (candidates.length === 0) return selected;

  const probe = (option: RankedOption & { candidate: Candidate }): CandidateContactResponseSummary | null => {
    const before = getSimFrames();
    const summary = summarizeCandidateContactResponse(candidateOwnedContactResponseOnEngine(
      option.child.prefixEngine,
      option.candidate,
      gap,
      true,
    ));
    const frames = getSimFrames() - before;
    impactResponseAdmissionTotals.response_probes++;
    impactResponseAdmissionTotals.response_probe_frames += frames;
    if (frames !== 0) {
      throw new Error(
        `cached-contact-repair simulated ${frames} unexpected frames at gap ${gap.index}`,
      );
    }
    return summary;
  };
  const incumbentResponse = probe(incumbent as RankedOption & { candidate: Candidate });
  if (incumbentResponse === null) return selected;

  let survivor: (RankedOption & { candidate: Candidate }) | null = null;
  for (const option of candidates) {
    const response = probe(option);
    const stateSafe = response !== null && responseSafeImpactTransition(incumbentResponse, response);
    const contactSafe = response !== null && responseRetainsCandidateContact(incumbentResponse, response);
    if (stateSafe && !contactSafe) impactResponseAdmissionTotals.contact_retention_rejects++;
    if (stateSafe && contactSafe) {
      survivor = option;
      break;
    }
  }
  if (survivor === null) return selected;

  impactResponseAdmissionTotals.safe_candidates++;
  impactResponseAdmissionTotals.impact_error_gain_sum += incumbentError -
    Math.abs(survivor.candidate.achieved.impact! - impactTarget);
  impactResponseAdmissionTotals.settled_quality_gain_sum +=
    scoreSettledIncomingQuality(targets, settledIncomingAxes(survivor.candidate)) - incumbentQuality;
  impactResponseAdmittedCandidates.add(survivor.candidate);
  if (selected.some((option) => option.candidate === survivor!.candidate)) {
    impactResponseAdmissionTotals.already_admitted++;
    return selected;
  }
  const next = [...selected];
  if (next.length >= HANDOFF_BRANCHING) next.pop();
  next.push(survivor);
  impactResponseAdmissionTotals.branch_reserved++;
  return next;
}

/**
 * Repair-only insurance from the exact current candidate pool. The ordinary
 * forward winner remains branch zero. If another already-scored pool candidate
 * is closer to the authored impact while paying no speed-error debt, give it
 * the last existing branch slot. The full-track repair register remains the
 * only acceptance authority, so this can expose a measured local repair
 * without rewriting trunk ranking or expanding HANDOFF_BRANCHING.
 */
function insureSameSpeedImpactRepairBranch(
  selected: RankedOption[],
  eligible: RankedOption[],
  gap: Gap,
  ctx: SpecContext,
): RankedOption[] {
  const winner = eligible[0];
  if (winner?.candidate === null || winner?.candidate === undefined) return selected;
  const targets = ctx.gapAxisTargets?.[gap.index] ?? gap.targets;
  const impactTarget = targets.impact;
  const speedTarget = targets.speed;
  const winnerImpact = winner.candidate.achieved.impact;
  const winnerSpeed = winner.candidate.achieved.speed;
  if (
    impactTarget === undefined || speedTarget === undefined ||
    winnerImpact === undefined || winnerSpeed === undefined
  ) return selected;
  const winnerImpactError = Math.abs(winnerImpact - impactTarget);
  const winnerSpeedError = Math.abs(winnerSpeed - speedTarget);
  const specialists = eligible.filter((option): option is RankedOption & { candidate: Candidate } => {
    if (option.source !== "pool" || option.candidate === null) return false;
    const impact = option.candidate.achieved.impact;
    const speed = option.candidate.achieved.speed;
    return impact !== undefined && speed !== undefined &&
      Math.abs(speed - speedTarget) <= winnerSpeedError + 1e-12 &&
      Math.abs(impact - impactTarget) + 1e-12 < winnerImpactError;
  });
  specialists.sort((left, right) =>
    Math.abs(left.candidate.achieved.impact! - impactTarget) -
      Math.abs(right.candidate.achieved.impact! - impactTarget) ||
    left.score - right.score ||
    left.rank - right.rank
  );
  const specialist = specialists[0];
  if (specialist === undefined) return selected;
  impactRepairInsuranceTotals.specialist_available++;
  const specialistImpactError = Math.abs(specialist.candidate.achieved.impact! - impactTarget);
  const specialistSpeedError = Math.abs(specialist.candidate.achieved.speed! - speedTarget);
  impactRepairInsuranceTotals.impact_error_gain_sum += winnerImpactError - specialistImpactError;
  impactRepairInsuranceTotals.speed_error_delta_sum += specialistSpeedError - winnerSpeedError;
  if (selected.some((option) => option.candidate === specialist.candidate)) {
    impactRepairInsuranceTotals.specialist_already_selected++;
    return selected;
  }
  const next = [...selected];
  const displaced = next.length >= HANDOFF_BRANCHING ? next.pop() : undefined;
  next.push(specialist);
  impactRepairInsuredCandidates.add(specialist.candidate);
  impactRepairInsuranceTotals.specialist_inserted++;
  impactRepairInsuranceTotals.displaced_score_delta_sum +=
    specialist.score - (displaced?.score ?? specialist.score);
  return next;
}

function summarizeRankedOptionForProbe(option: RankedOption): HandoffRankedOptionProbeEntry {
  const candidate = option.candidate;
  return {
    source: option.source,
    rank: option.rank,
    score: option.score,
    cost: candidate?.cost ?? null,
    lineCount: candidate?.lines.length ?? null,
    lineLength: candidate === null
      ? null
      : candidate.lines.reduce((sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1), 0),
    forwardContinuation: option.forwardContinuation ?? null,
    achieved: candidate === null ? null : { ...candidate.achieved },
  };
}

function kinematicRescueReady(node: SearchNode, telemetry: HandoffTelemetry): boolean {
  return !telemetry.hasCompletion &&
    node.gapIndex >= telemetry.deepestSeenGap;
}

function poolForwardContinuationAbsent(options: readonly RankedOption[]): boolean {
  const pool = options.filter((option) => option.source === "pool");
  return pool.length > 0 && pool.every((option) => option.forwardContinuation === false);
}

function continuationCapacity(
  node: SearchNode,
  candidate: Candidate,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  limit: number,
): number {
  const nextGap = nextContactGap(gaps[node.gapIndex], gaps);
  if (nextGap === null) return 0;
  let child = extendNodeCached(node, candidate);
  while (child.gapIndex < nextGap.index) child = extendNodeCached(child, null);
  return getCandidatesSorted(child, gaps, ctx, seed, limit).length;
}

/**
 * The continuation filter's own phase gate — and it STAYS pre-completion-only,
 * on argument rather than by inheritance.
 *
 * When the head ramp's Phase-1a boundary was re-opened as a graded phase weight
 * (`postCompletionPhaseWeight`), this consumer was deliberately left out of
 * the scope. Two reasons, both measured:
 *
 *  - the filter PRUNES a frontier node on a rollout's dead-end verdict, and
 *    37.8% of the verdicts it acts on are FALSE (460 acted-on verdicts, all
 *    audited, docs/forward-eval-metrics.md L3). Pre-completion that is a race
 *    the compile is losing anyway; post-completion there is an adopted
 *    incumbent to protect, and a false prune there can only lose quality the
 *    compile already has;
 *  - unlike the head ramp it is not a magnitude. It is on or off at
 *    `underFullDeadlinePressure`, so a weight would not throttle it, it would
 *    move a threshold — the named anti-pattern.
 *
 * If it is ever re-opened, the evidence it needs is a verdict-truth measurement
 * on POST-completion prunes specifically, not this ramp's.
 */
function onlineContinuationFrontierReady(
  node: SearchNode,
  telemetry: HandoffTelemetry,
): boolean {
  return !telemetry.hasCompletion &&
    node.gapIndex + FAR_BACK_FRONTIER_LAG > telemetry.deepestSeenGap;
}

/** Sampled once per compile: consulted on every pool build, and a raw
 *  `process.env` read is an interceptor call (~268 ns) not a property read. */
const readOnlineContinuation = compileScopedEnv("LR_ONLINE_CONTINUATION");

function onlineContinuationEnabled(): boolean {
  return readOnlineContinuation() !== "0";
}

function openingBestForwardEvalOpportunity(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  pool: readonly HandoffAdmittedCandidate[],
  targetBudget: number,
  budgetSlack: number,
): number {
  if (fwdEvalRuntime.config === null || !fwdEvalRuntime.defaultConfig) return 0;
  if (!usesForwardEvalAtBudget(targetBudget)) return 0;
  if (openingBestBranch2SlackPressure(budgetSlack) <= 0) return 0;
  if (!isOpeningContactNode(node, gaps)) return 0;

  const structuralPressure = openingBestStructuralPressure(gaps);
  if (structuralPressure <= 0) return 0;

  const gap = gaps[node.gapIndex];
  const values = pool
    .map(({ candidate }) => candidateQualityObjective(node.prefixEngine, candidate, gap, gaps, ctx))
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .sort((a, b) => b - a);
  if (values.length < 2) return 0;

  const top = values[0];
  const second = values[1];
  const objectivePressure = smoothstep(
    (top - OPENING_BEST_FWD_OBJECTIVE_START) / OPENING_BEST_FWD_OBJECTIVE_SPAN,
  );
  if (objectivePressure <= 0) return 0;

  const relMargin = (top - second) / Math.max(1e-6, Math.abs(top));
  const marginPressure = 1 - smoothstep(
    (relMargin - OPENING_BEST_FWD_REL_MARGIN_FULL) /
      (OPENING_BEST_FWD_REL_MARGIN_ZERO - OPENING_BEST_FWD_REL_MARGIN_FULL),
  );
  return clamp01(structuralPressure * objectivePressure * marginPressure);
}

function openingBestStructuralPressure(gaps: Gap[]): number {
  const contacts = totalContactCount(gaps);
  return 1 - smoothstep(
    (contacts - OPENING_BEST_SHORT_CONTACT_FULL) /
      OPENING_BEST_SHORT_CONTACT_SPAN,
  );
}

function totalContactCount(gaps: Gap[]): number {
  let contacts = 0;
  for (const gap of gaps) if (gap.endsWithContact) contacts++;
  return contacts;
}

function isOpeningContactNode(node: SearchNode, gaps: Gap[]): boolean {
  return node.gapIndex === nextContactGapIndex(gaps, 0) &&
    gaps[node.gapIndex]?.endsWithContact === true;
}

function lowAirTargetPressure(target: number, scale: number): number {
  return smoothstep(clamp01((scale - target) / scale));
}

/**
 * THE SHARED MATURITY SCALE — `smoothstep(B / (B + scaleFrames))`, and the only
 * budget-shaped signal left in this module that still moves inside the range the
 * compiler is run at. Three consumers: `matureReuseExtraPressure`,
 * `shallowQualityTailThrottlePressure`, `tailCompletionContactWindow`. (They
 * used to inline this expression; they call it now, so there is one definition.)
 *
 * IT IS ASYMPTOTIC, NOT SATURATED, AND THAT DISTINCTION IS THE WHOLE POINT.
 * At the 150k scale it reads 0.500 / 0.684 / 0.865 / 0.926 / 0.953 / 0.989 at
 * 150k / 250k / 500k / 750k / 1M / 2.25M. Across the benchmark's own grid
 * (250k → 750k) that is +35% relative travel, so unlike the geometry ramps, the
 * repair margin, the start-phase pressure and the objective exponent — all of
 * which were pinned below 250k and have been deleted for it — this one is doing
 * live work at every budget that gets promoted, and replacing it with its
 * mature value (1) is a behaviour change everywhere, not a simplification.
 *
 * Nor is the CEILING unexamined: two of the three consumers were re-fitted as
 * unbounded budget laws in the 2026-07-28 audit and both lost — the tail window
 * -0.86 (exactly +0.00 at 750k, i.e. no headroom at the top) and the mature
 * reuse extra -0.32. So the shape is bounded on measured grounds. What has never
 * been measured is the ramp against a FLAT constant; if that ever gets an eval,
 * note that the honest arm is one bundle, because the three consumers share this
 * function and cannot move independently.
 */
function maturityPressure(targetBudget: number, scaleFrames: number): number {
  const budget = Math.max(0, targetBudget);
  return smoothstep(clamp01(budget / (budget + scaleFrames)));
}

/**
 * Per-node deterministic hash seed: mixes the node's committed prefix
 * (gapIndex + prefixNextLineId) with any number of call-site salt constants.
 * XOR is associative/commutative so salt order is irrelevant; each stochastic
 * gate passes its own distinguishing salt(s) to draw an independent stream while
 * staying a pure function of the node — the search-determinism contract. Feed
 * the result through `unitHash` for a [0,1) draw.
 */
function nodeHashSeed(node: SearchNode, ...salts: number[]): number {
  let seed =
    Math.imul(node.gapIndex + 1, 0x9e3779b1) ^
    Math.imul(node.prefixNextLineId | 0, 0x85ebca6b);
  for (const salt of salts) seed ^= salt;
  return seed | 0;
}

function unitHash(seed: number): number {
  let x = seed | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 0x100000000;
}

function reuseCandidateLimit(
  node: SearchNode,
  targetBudget: number,
  telemetry: HandoffTelemetry,
): number {
  const pressure = matureReuseExtraPressure(targetBudget, uniqueFullEvaluations(telemetry));
  if (pressure <= 0) return HANDOFF_REUSE_K;
  return HANDOFF_REUSE_K +
    (unitHash(matureReuseExtraSeed(node)) < pressure ? 1 : 0);
}

function matureReuseExtraPressure(targetBudget: number, uniqueFull: number): number {
  const budgetPressure = maturityPressure(targetBudget, HANDOFF_MATURITY_BUDGET_SCALE_FRAMES);
  const feedback = Math.max(0, uniqueFull);
  const feedbackPressure = smoothstep(
    clamp01(feedback / (feedback + HANDOFF_REUSE_MATURE_FULL_FEEDBACK_SCALE)),
  );
  return clamp01(HANDOFF_REUSE_MATURE_EXTRA_WEIGHT * budgetPressure * feedbackPressure);
}

function matureReuseExtraSeed(node: SearchNode): number {
  return nodeHashSeed(node);
}

/** Offer uphill-entry brake catches when the rider runs over a moderate target
 *  speed (early creep pre-emption). Each is one tryCandidate sim; deterministic
 *  (own seeded RNG); ref cleared so a brake is never a steady-state reuse seed. */
function brakeCatchCandidates(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
): Candidate[] {
  const gap = gaps[node.gapIndex];
  if (!gap.endsWithContact) return [];
  const tgt = gap.targets?.speed;
  if (tgt === undefined) return [];
  const targetSpeedPx = authoredSpeedToPx(tgt);
  if (targetSpeedPx <= HANDOFF_BRAKE_TARGET_MIN_PX_PER_FRAME + HANDOFF_BRAKE_TARGET_EPSILON_PX_PER_FRAME) {
    return [];
  }
  if (targetSpeedPx > HANDOFF_BRAKE_TARGET_MAX_PX_PER_FRAME + HANDOFF_BRAKE_TARGET_EPSILON_PX_PER_FRAME) {
    return [];
  }
  const ts = getCandidateProbe(node.prefixEngine, gap, ctx).targetState;
  const speedRatio = ts.speed / targetSpeedPx;
  if (!shouldOfferBrakeCandidates(targetSpeedPx, speedRatio)) {
    return [];
  }
  const brakeK = brakeCandidateCount(speedRatio);
  if (brakeK <= 0) return [];
  return sampleSeededCatchCandidates(node, gap, ctx, seed, brakeK, {
    seedSalt: 7919,
    sampleSeed: (attempt) => attempt,
    mode: "brake",
    onAttempt: () => {
      telemetry.brakeAttempts++;
    },
    onSuccess: () => {
      telemetry.brakeSuccesses++;
    },
  });
}

export function brakeCandidateCount(speedRatio: number): number {
  if (!Number.isFinite(speedRatio) || speedRatio < HANDOFF_BRAKE_RATIO_MIN) return 0;
  return speedRatio >= HANDOFF_BRAKE_HIGH_OVERSPEED_RATIO
    ? HANDOFF_BRAKE_QUALITY_HIGH_OVERSPEED_K
    : HANDOFF_BRAKE_QUALITY_BASE_K;
}

export function shouldOfferBrakeCandidates(
  targetSpeedPxPerFrame: number,
  speedRatio: number,
): boolean {
  // Mild-speed targets can use brake probes on any overspeed. Higher target
  // speeds only get them once the existing high-overspeed band is reached, where
  // normal catch geometry is least likely to bleed enough speed on its own.
  const aboveMinTarget = targetSpeedPxPerFrame >
    HANDOFF_BRAKE_TARGET_MIN_PX_PER_FRAME + HANDOFF_BRAKE_TARGET_EPSILON_PX_PER_FRAME;
  const withinMildTarget = targetSpeedPxPerFrame <=
    HANDOFF_BRAKE_MILD_TARGET_MAX_PX_PER_FRAME + HANDOFF_BRAKE_TARGET_EPSILON_PX_PER_FRAME;
  const withinTarget = targetSpeedPxPerFrame <=
    HANDOFF_BRAKE_TARGET_MAX_PX_PER_FRAME + HANDOFF_BRAKE_TARGET_EPSILON_PX_PER_FRAME;
  const highOverspeed = speedRatio >= HANDOFF_BRAKE_HIGH_OVERSPEED_RATIO;
  return aboveMinTarget &&
    withinTarget &&
    (withinMildTarget || highOverspeed) &&
    brakeCandidateCount(speedRatio) > 0;
}

/** Translate the most-recent committed catch (which carries a sled `ref`) to
 *  THIS gap's entry state and return the ones that still land+survive. The
 *  geometry is sled-relative, so translating a prior catch by the sled delta
 *  reproduces the same catch shape at the new entry — on a periodic rhythm
 *  (steady-state ride) the same catch lands contact after contact. Each reuse is
 *  validated by one candidate evaluation (one sim). Deterministic: a pure
 *  function of the node's committed prefix + engine state. */
function reuseCatchCandidates(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  telemetry: HandoffTelemetry,
  reuseLimit = HANDOFF_REUSE_K,
): Candidate[] {
  const gap = gaps[node.gapIndex];
  if (!gap.endsWithContact) return [];
  const probe = getCandidateProbe(node.prefixEngine, gap, ctx);
  const ts = probe.targetState;
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const out: Candidate[] = [];
  let tried = 0;
  for (let i = node.prefixFits.length - 1; i >= 0 && tried < reuseLimit; i--) {
    const f = node.prefixFits[i];
    if (f === null || f.ref === undefined) continue;
    tried++;
    const dx = ts.sledX - f.ref.x;
    const dy = ts.sledY - f.ref.y;
    telemetry.reuseAttempts++;
    const cand = f.arc === null
      ? tryCandidateLines(
        node.prefixEngine, gap,
        translateTrackLines(f.lines, dx, dy, node.prefixNextLineId),
        node.prefixNextLineId, ctx.allContactFrames, axisMeasureEnd, gap.targets, true,
        undefined, probe.preTargetSledTrace,
      )
      : tryCandidate(
        node.prefixEngine, gap,
        { ...f.arc, anchor: { x: f.arc.anchor.x + dx, y: f.arc.anchor.y + dy } },
        node.prefixNextLineId, ctx.allContactFrames, axisMeasureEnd, gap.targets, true,
        undefined, probe.preTargetSledTrace,
      );
    if (cand !== null) {
      telemetry.reuseSuccesses++;
      cand.ref = { x: ts.sledX, y: ts.sledY };
      out.push(cand);
    }
  }
  return out;
}

/**
 * STUDY-ONLY override of the admitted pool size. **Never set this in
 * production, in a benchmark eval, or in a promotion candidate.**
 *
 * It exists for one question the shape campaign has to answer and cannot answer
 * any other way: the rollout width dose has a hard cliff at W = 6, one above
 * `HANDOFF_CANDIDATE_POOL`, and the hypothesis is that a rollout wider than the
 * pool the search will actually admit values a child the search can never take.
 * Testing it means moving the pool, which is why the knob is here and why it
 * refuses anything outside the bracketed range [3, 8] (the constant's own
 * bracket: 3 = +1.83, 4 = -3.54, 5 = +3.32 shipped, 6 = +2.28, 8 = the previous
 * value) instead of clamping — a study that silently ran at 5 because its env
 * said `six` would be worse than no study.
 *
 * SHARE-INVARIANT EXEMPTION, stated precisely. The load-time assert above
 * (`AIM_LANE_DEADLINE_BASE_SHARE === HANDOFF_FORWARD_EVAL_TOP /
 * HANDOFF_CANDIDATE_POOL`) is an assert about the two CONSTANTS and this
 * override does not touch either, so its precondition is intact and it keeps
 * doing its job. What the override does break is the invariant's *meaning* at
 * run time: under full deadline pressure the rolled head keeps
 * `HANDOFF_FORWARD_EVAL_TOP` of `poolSize` while the aim lane keeps the frozen
 * literal 2/5 of its bases, so the two "same share" consumers diverge for the
 * duration of the study arm. That is measured to be nearly nothing at the
 * budgets this knob is used at — full deadline pressure is 0.40% of
 * pre-completion pool builds at 750k and exactly 0 at >= 1.5M — but it is a real
 * divergence and any arm run with this knob states it.
 */
const readStudyHandoffPool = compileScopedEnv("LR_STUDY_HANDOFF_POOL");

export function handoffCandidatePool(): number {
  const raw = readStudyHandoffPool();
  if (raw === undefined || raw === "") return HANDOFF_CANDIDATE_POOL;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || String(n) !== raw.trim() || n < 3 || n > 8) {
    throw new Error(
      `LR_STUDY_HANDOFF_POOL must be an integer in [3, 8] (STUDY-ONLY; never set it in ` +
        `production or in an eval), got "${raw}"`,
    );
  }
  return n;
}

function completeNearTail(
  node: HandoffNode,
  gaps: Gap[],
  ctx: SpecContext,
  telemetry: HandoffTelemetry,
  policy: HandoffSearchPolicy,
  resolvePolicy: (search: SearchNode) => HandoffSearchPolicy,
  targetBudget: number,
  /** Observation-only: see `framesAtReachTail` in compileHandoffInternal. */
  stampReach?: (search: SearchNode) => void,
): HandoffNode | null {
  if (!shouldAttemptNearTailCompletion(node, gaps, targetBudget, telemetry)) {
    return null;
  }
  const remaining = remainingContactCount(node.search, gaps);
  telemetry.tailCompletionAttempts++;
  incrementContactCountCounter(telemetry.tailCompletionAttemptsByRemainingContacts, remaining);

  const completed = completeNearTailSuffix(
    node.search,
    cloneRankTrace(node.rankTrace),
    gaps,
    ctx,
    node.searchSeed,
    telemetry,
    resolvePolicy,
    targetBudget,
    Infinity,
    Infinity,
    stampReach,
  );
  if (completed === null) return null;

  telemetry.tailCompletionSuccesses++;
  incrementContactCountCounter(telemetry.tailCompletionSuccessesByRemainingContacts, remaining);
  return {
    search: completed.search,
    startState: node.startState,
    startLines: node.startLines,
    startRank: node.startRank,
    searchSeed: node.searchSeed,
    startExpanded: node.startExpanded,
    deferExpansion: false,
    rankTrace: completed.rankTrace,
    skippedContacts: node.skippedContacts,
  };
}

type CompletedHandoffSuffix = {
  search: SearchNode;
  rankTrace: HandoffRankTraceEntry[];
};

function completeNearTailSuffix(
  start: SearchNode,
  startTrace: HandoffRankTraceEntry[],
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
  resolvePolicy: (search: SearchNode) => HandoffSearchPolicy,
  targetBudget: number,
  /** Repair use: bound the rebuild so one attempt can't eat the whole slice.
   *  Defaults preserve the near-tail caller (unbounded — its window is tiny). */
  maxNodes: number = Infinity,
  frameCeiling: number = Infinity,
  /**
   * Observation-only reach stamp for the suffix nodes this pass constructs.
   * The frontier never processes them, yet first completion routinely lands
   * here, so without it the incumbent cost-to-end profile has no timestamp for
   * any gap past the deepest processed node.
   */
  stampReach?: (search: SearchNode) => void,
): CompletedHandoffSuffix | null {
  const stack: CompletedHandoffSuffix[] = [
    {
      search: start,
      rankTrace: startTrace,
    },
  ];
  let nodes = 0;
  while (stack.length > 0) {
    if (nodes >= maxNodes || getSimFrames() >= frameCeiling) return null;
    const state = stack.pop()!;
    let search = state.search;
    let rankTrace = cloneRankTrace(state.rankTrace);

    while (!isTerminalNode(search, gaps) && !gaps[search.gapIndex].endsWithContact) {
      search = extendNodeCached(search, null);
      stampReach?.(search);
      rankTrace = appendSkipTrace(rankTrace);
    }
    if (isTerminalNode(search, gaps)) return { search, rankTrace };

    nodes++;
    const policy = resolvePolicy(search);
    const options = rankedOptions(search, gaps, ctx, seed, telemetry, {
      nCand: policy.nCand,
      preview: false,
      axisQualitySearch: policy.axisQualitySearch,
      releaseSetup: policy.releaseSetup,
      forwardStageTop: policy.forwardStageTop,
      deadlineMargin: policy.deadlineMargin,
      forwardEval: policy.forwardEval,
      reuseLimit: policy.reuseLimit,
      previewCostWeight: PREVIEW_COST_WEIGHT,
      // The DIFFICULTY coordinate, like every other `rankedOptions` call site.
      // It was missing here from the day the parameter was introduced
      // (`1baee0b` threaded it through `expandNode`'s three call sites and not
      // this one), so `config.budgetSlack ?? 0` priced the lane where first
      // completion routinely lands as a maximally-starved compile and every
      // slack-conditioned read — the impact widening above all — was switched
      // off on it. Nothing ever documented that as policy, and the map's own
      // consumer list (SLK-03) says the coordinate reaches every lane.
      budgetSlack: policy.budgetSlack,
      targetBudget,
    })
      .filter((option) => option.candidate !== null)
      .slice(0, policy.tailBranching);
    for (let i = options.length - 1; i >= 0; i--) {
      const option = options[i];
      const extended = extendNodeCached(search, option.candidate!);
      stampReach?.(extended);
      stack.push({
        search: extended,
        rankTrace: appendOptionTrace(rankTrace, option),
      });
    }
  }
  return null;
}

/** Repair's weakness key for one reported gap: Σ axis-error². One definition,
 *  used by the ranking and by the telemetry that records what the ranking saw.
 *  Null for a gap the incumbent report does not carry. */
function gapAxisSse(gap: DriftReport["gaps"][number] | undefined): number | null {
  if (gap === undefined) return null;
  let sse = 0;
  for (const v of Object.values(gap.axes)) sse += v.error * v.error;
  return sse;
}

/**
 * Optimistic register-quality bound for a suffix restart. It preserves every
 * authored prefix error and sets every scored axis error the restart can change
 * to zero. This is a pruning bound only: it never alters targets or scores.
 */
export function optimisticSuffixAxisQualityBound(
  report: DriftReport,
  anchorGapIndex: number,
): {
  scoredAxisObservationCount: number;
  totalAxisSse: number;
  mutableSuffixAxisSse: number;
  optimisticSuffixAxisQualityUpper: number;
} {
  const anchor = Math.max(0, Math.floor(anchorGapIndex));
  let scoredAxisObservationCount = 0;
  let totalAxisSse = 0;
  let mutableSuffixAxisSse = 0;
  for (const gap of report.gaps) {
    for (const [axis, observation] of Object.entries(gap.axes)) {
      if (REPORT_ONLY_AXIS_SET.has(axis) || !Number.isFinite(observation.error)) continue;
      const squaredError = observation.error * observation.error;
      scoredAxisObservationCount++;
      totalAxisSse += squaredError;
      if (gap.gap_index >= anchor) mutableSuffixAxisSse += squaredError;
    }
  }
  const immutablePrefixSse = Math.max(0, totalAxisSse - mutableSuffixAxisSse);
  const optimisticSuffixAxisQualityUpper = scoredAxisObservationCount === 0
    ? 1
    : Math.exp(
      -Math.sqrt(immutablePrefixSse / scoredAxisObservationCount) / AXIS_QUALITY_TOLERANCE,
    );
  return {
    scoredAxisObservationCount,
    totalAxisSse,
    mutableSuffixAxisSse,
    optimisticSuffixAxisQualityUpper,
  };
}

function repairGapState(
  gapIndex: number,
  gap: DriftReport["gaps"][number] | undefined,
): BudgetRepairGapState {
  if (gap === undefined) return { status: "missing", gap_index: gapIndex };
  const axes: Record<string, {
    target: number;
    achieved: number;
    signed_error: number;
    squared_error: number;
  }> = {};
  let sse = 0;
  for (const [axis, value] of Object.entries(gap.axes)) {
    const signedError = value.achieved - value.target;
    const squaredError = signedError * signedError;
    axes[axis] = {
      target: value.target,
      achieved: value.achieved,
      signed_error: signedError,
      squared_error: squaredError,
    };
    sse += squaredError;
  }
  return { status: "measured", gap_index: gap.gap_index, sse, axes };
}

/** Direct arc-geometry comparison; object identity and RNG seed are irrelevant. */
export function compareRepairTerminalGeometry(
  incumbent: readonly (Candidate | null)[],
  alternative: readonly (Candidate | null)[],
  anchorGapIndex: number,
): BudgetRepairDivergence {
  const count = Math.max(incumbent.length, alternative.length);
  const anchor = Math.max(0, Math.floor(anchorGapIndex));
  let firstDivergent: number | null = null;
  let divergent = 0;
  let divergentSuffix = 0;
  for (let gap = 0; gap < count; gap++) {
    if (candidateArcGeometryKey(incumbent[gap]) === candidateArcGeometryKey(alternative[gap])) {
      continue;
    }
    if (firstDivergent === null) firstDivergent = gap;
    divergent++;
    if (gap >= anchor) divergentSuffix++;
  }
  return {
    compared_gap_count: count,
    first_divergent_gap_index: firstDivergent,
    divergent_gap_count: divergent,
    divergent_suffix_gap_count: divergentSuffix,
    terminal_geometry_identical: divergent === 0,
  };
}

function candidateArcGeometryKey(candidate: Candidate | null | undefined): string {
  if (candidate == null) return "null";
  return JSON.stringify(candidate.lines.map((line) => [
    line.type,
    line.x1,
    line.y1,
    line.x2,
    line.y2,
    line.flipped,
    line.leftExtended,
    line.rightExtended,
  ]));
}

/**
 * What a restart from an anchor may cost at the top of the estimator's own
 * interval — the quantity repair actually decides on.
 *
 * This replaces a hand-set feasibility margin (`feasMargin`, swept
 * 1.5 -> 1.1 -> 1.05 -> a budget ramp -> flat 1.0 across a long chain of
 * golden-grid arms) with the artifact's fitted upper quantile for
 * exactly this observation. A
 * repair sizing its restart is asking "how much work is left from this
 * anchor" at the instant an attempt starts, from the incumbent's own
 * measured suffix: the `start` event, path-backed — and that stratum is
 * populated by repair-attempt starts and nothing else, because a repair
 * is the only attempt kind that carries a path profile. The margin it
 * yields is no longer a fudge factor but a coverage claim the calibrator
 * can be held to (95% nominal, `byEventAndPath.start.withPath`), and it
 * moves with the estimator instead of having to be re-swept beside it.
 *
 * The point estimate goes through `estimateRemainingBudgetWork`, the
 * same pure functions the recorder uses and no shared state. NOTE the
 * ceiling is the artifact's calibrated band applied UNCONDITIONALLY
 * (the `deadline.ts` contract: policy consumes the raw estimator at
 * every budget) — it equals the recorder's `estimate_upper_frames` for
 * this attempt's start observation only where applicability is
 * `calibrated`. Repair runs from `minBudget` (100k) while the artifact's
 * fitted domain is [250k, 1.5M]; below that the recorder widens its
 * recorded upper to `max(upper, hard_remaining)` and this ceiling does
 * not, and the 95% coverage claim does not transfer (measured ~35%
 * two-sided interval coverage at 150k, docs/compile-budget-telemetry.md).
 * The structural slot is zero deliberately: the
 * artifact's base mode selects the path, and passing a structural number
 * here would smuggle a second structural model into a module that has no
 * business owning one (that is `optimizer/deadline.ts`).
 *
 * The per-gap fallback has no calibrated interval of its own — it is not
 * one of the artifact's estimators, so neither its correction factor nor
 * its coverage claim transfers — and it borrows the path-free `start`
 * spread as the nearest fitted band, knowingly and without a calibration
 * claim. It gets no correction factor, because a correction is a bias
 * statement about a specific estimator and this one's bias is known to
 * point the other way (it over-sizes the late, cheap anchors, which is
 * why the measured profile exists at all). On the archived panels the two
 * `start` upper ratios agree to three decimals, so the borrowing costs
 * nothing today; the point is that the code says which one it is asking
 * for.
 *
 * `model` is the artifact by default and a parameter so the zero-ceiling guard
 * below can be exercised: it is unreachable under a path-selecting artifact.
 */
export function repairRestartCeilingFrames(
  /** Measured cost-to-end at the anchor, or null where nothing was measured. */
  measured: number | null,
  /** The coarse per-gap average this anchor falls back to without a measurement. */
  perGapFallbackFrames: number,
  model: BudgetEstimatorModelArtifact = BUDGET_ESTIMATOR_MODEL,
): number {
  const point = measured === null
    ? perGapFallbackFrames
    : estimateRemainingBudgetWork({
      structural: 0,
      path: measured,
      pace: null,
      progressFraction: 1,
    }, model);
  const upper = budgetEstimateInterval(point, {
    event: "start",
    pathAvailable: measured !== null,
  }, model).upper;
  // Never hand repair a zero ceiling. A `structural` base-mode artifact
  // (a legal artifact — it is the calibrator's static fallback whenever
  // the acceptance gate fails) returns the deliberately-zero structural
  // slot above as the base, which zeroes the point and the interval;
  // unguarded, every restart would then be sized at zero frames and the
  // attempt quota would burn doing nothing. Under a path-selecting
  // artifact this branch is unreachable (measured > 0 and every upper
  // ratio >= the positive correction), so it is a guard, not a tune.
  return upper > 0 ? upper : measured ?? perGapFallbackFrames;
}

export type RepairTargetCandidate = { gapIndex: number; sse: number };
export type RepairSelectionPolicy =
  | "worst_gap_deepest_affordable"
  | "worst_gap_three_quarter_last_chance"
  | "worst_gap_window_opportunity_per_cost"
  | "worst_gap_runway_opportunity_per_cost"
  | "worst_gap_reserve_cheapest_repair"
  | "worst_gap_reserve_cheapest_else_deepest"
  | "suffix_opportunity_per_cost"
  | "max_suffix_opportunity"
  | "max_local_window_opportunity";
export type AffordableRepairTarget = {
  targetGapIndex: number;
  anchorGapIndex: number;
  parentDepth: number;
  targetGapSse: number;
  usableBudgetFrames: number;
  affordableTargetGapIndices: number[];
};
export type RepairSelection = AffordableRepairTarget & {
  selectionPolicy: RepairSelectionPolicy;
  affordableAnchorGapIndices: number[];
  mutableSuffixSse: number;
};

/**
 * Study-only last-chance repair pricing.
 *
 * The breadth ratio is inherited from the completed repair-wide bracket.  Its
 * measured whole-episode cost response was -11.65%, so pricing the arm at a
 * 10% saving is deliberately conservative.  The arm is considered only after
 * the ordinary full-width selector returns null and may execute at most once.
 */
export const REPAIR_LAST_CHANCE_BREADTH_RATIO = 3 / 4;
export const REPAIR_LAST_CHANCE_COST_RATIO = 0.9;

export function selectLastChanceRepairRestart(
  candidates: readonly RepairTargetCandidate[],
  pointCostByAnchor: readonly number[],
  upperCostByAnchor: readonly number[],
  remainingBudgetFrames: number,
  headroomFraction: number,
  maxParentDepth: number,
): RepairSelection | null {
  const scale = (value: number): number => value * REPAIR_LAST_CHANCE_COST_RATIO;
  const selected = selectRepairRestart(
    candidates,
    pointCostByAnchor.map(scale),
    upperCostByAnchor.map(scale),
    remainingBudgetFrames,
    headroomFraction,
    maxParentDepth,
    "worst_gap_deepest_affordable",
  );
  return selected === null
    ? null
    : { ...selected, selectionPolicy: "worst_gap_three_quarter_last_chance" };
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function repairTargetObservations(
  candidates: readonly RepairTargetCandidate[],
  maxParentDepth: number,
  usableBudgetFrames: number,
  pointCostOf: (anchorGapIndex: number) => number,
  upperCostOf: (anchorGapIndex: number) => number,
  sourceOf: (
    anchorGapIndex: number,
  ) => "measured_cost_to_end" | "per_gap_fallback",
): BudgetRepairTargetObservation[] {
  const maximum = Math.max(0, Math.floor(maxParentDepth));
  return candidates.map((candidate) => ({
    target_gap_index: candidate.gapIndex,
    target_gap_sse: candidate.sse,
    anchor_options: Array.from(
      { length: Math.min(maximum, candidate.gapIndex) + 1 },
      (_, index) => Math.min(maximum, candidate.gapIndex) - index,
    ).map((parentDepth) => {
      const anchorGapIndex = candidate.gapIndex - parentDepth;
      const point = pointCostOf(anchorGapIndex);
      const upper = upperCostOf(anchorGapIndex);
      const source = sourceOf(anchorGapIndex);
      const hasCost = Number.isFinite(point) && point > 0 && Number.isFinite(upper) && upper > 0;
      return {
        parent_depth: parentDepth,
        anchor_gap_index: anchorGapIndex,
        estimated_anchor_cost_frames: hasCost ? point : null,
        estimated_anchor_cost_upper_frames: hasCost ? upper : null,
        anchor_cost_source: hasCost ? source : null,
        affordability: !hasCost
          ? "no_positive_cost_estimate" as const
          : upper <= usableBudgetFrames
            ? "affordable" as const
            : "exceeds_usable_budget" as const,
      };
    }),
  }));
}

/** Combine a newly observed repair suffix with the incumbent's measured prefix.
 * Prefix marginal work is preserved; suffix costs come only from the accepted
 * alternative's own episode. Unknown observations stay unknown. */
export function spliceRepairCostToEnd(
  observedAlternative: readonly number[],
  incumbent: readonly number[],
  anchorGapIndex: number,
): number[] {
  const result = [...observedAlternative];
  const anchor = Math.max(0, Math.floor(anchorGapIndex));
  const anchorCost = result[anchor] ?? -1;
  const oldAnchorCost = incumbent[anchor] ?? -1;
  for (let gapIndex = 0; gapIndex < anchor; gapIndex++) {
    const oldCost = incumbent[gapIndex] ?? -1;
    result[gapIndex] = anchorCost >= 0 && oldAnchorCost >= 0 && oldCost >= oldAnchorCost
      ? anchorCost + oldCost - oldAnchorCost
      : -1;
  }
  return result;
}

/** One independent repair decision. Rank target weakness among targets with at
 * least one affordable anchor, then choose that target's deepest affordable
 * parent up to the declared maximum. No failed-anchor state or execution
 * fallback participates in the decision. */
export function selectAffordableRepairTarget(
  candidates: readonly RepairTargetCandidate[],
  upperCostByAnchor: readonly number[],
  remainingBudgetFrames: number,
  headroomFraction: number,
  maxParentDepth: number,
): AffordableRepairTarget | null {
  const remaining = Math.max(0, Math.floor(remainingBudgetFrames));
  const headroom = Math.max(0, Math.min(0.95, headroomFraction));
  const maximum = Math.max(0, Math.floor(maxParentDepth));
  const usableBudgetFrames = Math.floor(remaining * (1 - headroom));
  const affordable = candidates
    .flatMap((candidate) => {
      const affordableAnchor = Array.from(
        { length: Math.min(maximum, candidate.gapIndex) + 1 },
        (_, index) => Math.min(maximum, candidate.gapIndex) - index,
      ).map((parentDepth) => ({
        parentDepth,
        anchorGapIndex: candidate.gapIndex - parentDepth,
      })).find(({ anchorGapIndex }) => {
        const upper = upperCostByAnchor[anchorGapIndex];
        return Number.isFinite(upper) && upper! > 0 && upper! <= usableBudgetFrames;
      });
      return affordableAnchor === undefined ? [] : [{ ...candidate, ...affordableAnchor }];
    });
  if (affordable.length === 0) return null;
  affordable.sort((a, b) => b.sse - a.sse || a.gapIndex - b.gapIndex);
  const selected = affordable[0]!;
  return {
    targetGapIndex: selected.gapIndex,
    anchorGapIndex: selected.anchorGapIndex,
    parentDepth: selected.parentDepth,
    targetGapSse: selected.sse,
    usableBudgetFrames,
    affordableTargetGapIndices: affordable
      .map(({ gapIndex }) => gapIndex)
      .sort((a, b) => a - b),
  };
}

/** Select one independently executable repair restart under a named law.
 * Both laws share the same target/anchor option universe and hard affordability
 * check. The opportunity-density law is anchor-first: its explanatory target
 * is the worst reported gap in the selected anchor's entire mutable suffix, so
 * `parentDepth` is descriptive and may exceed the option-generation radius. */
export function selectRepairRestart(
  candidates: readonly RepairTargetCandidate[],
  pointCostByAnchor: readonly number[],
  upperCostByAnchor: readonly number[],
  remainingBudgetFrames: number,
  headroomFraction: number,
  maxParentDepth: number,
  selectionPolicy: RepairSelectionPolicy,
): RepairSelection | null {
  const remaining = Math.max(0, Math.floor(remainingBudgetFrames));
  const headroom = Math.max(0, Math.min(0.95, headroomFraction));
  const usableBudgetFrames = Math.floor(remaining * (1 - headroom));
  const maximum = Math.max(0, Math.floor(maxParentDepth));
  const affordableTargetGapIndices = candidates.filter((candidate) =>
    Array.from(
      { length: Math.min(maximum, candidate.gapIndex) + 1 },
      (_, parentDepth) => candidate.gapIndex - parentDepth,
    ).some((anchorGapIndex) => {
      const upper = upperCostByAnchor[anchorGapIndex];
      return Number.isFinite(upper) && upper! > 0 && upper! <= usableBudgetFrames;
    })
  ).map((candidate) => candidate.gapIndex).sort((a, b) => a - b);
  const affordableAnchorGapIndices = [...new Set(candidates.flatMap((candidate) =>
    Array.from(
      { length: Math.min(maximum, candidate.gapIndex) + 1 },
      (_, parentDepth) => candidate.gapIndex - parentDepth,
    ).filter((anchorGapIndex) => {
      const point = pointCostByAnchor[anchorGapIndex];
      const upper = upperCostByAnchor[anchorGapIndex];
      return Number.isFinite(point) && point! > 0 &&
        Number.isFinite(upper) && upper! > 0 && upper! <= usableBudgetFrames;
    })
  ))].sort((a, b) => a - b);
  if (
    selectionPolicy === "worst_gap_deepest_affordable" ||
    selectionPolicy === "worst_gap_three_quarter_last_chance" ||
    selectionPolicy === "worst_gap_window_opportunity_per_cost" ||
    selectionPolicy === "worst_gap_runway_opportunity_per_cost" ||
    selectionPolicy === "worst_gap_reserve_cheapest_repair" ||
    selectionPolicy === "worst_gap_reserve_cheapest_else_deepest"
  ) {
    const selected = selectAffordableRepairTarget(
      candidates,
      upperCostByAnchor,
      remainingBudgetFrames,
      headroomFraction,
      maxParentDepth,
    );
    if (selected === null) return null;
    let anchorGapIndex = selected.anchorGapIndex;
    let parentDepth = selected.parentDepth;
    if (
      selectionPolicy === "worst_gap_window_opportunity_per_cost" ||
      selectionPolicy === "worst_gap_runway_opportunity_per_cost"
    ) {
      const targetOptions = Array.from(
        { length: Math.min(maximum, selected.targetGapIndex) + 1 },
        (_, depth) => ({
          parentDepth: depth,
          anchorGapIndex: selected.targetGapIndex - depth,
        }),
      ).filter(({ anchorGapIndex: gapIndex }) =>
        affordableAnchorGapIndices.includes(gapIndex)
      ).map((option) => {
        const windowSse = candidates.filter((candidate) =>
          candidate.gapIndex >= option.anchorGapIndex &&
          candidate.gapIndex <= selected.targetGapIndex
        ).reduce((sum, candidate) => sum + candidate.sse, 0);
        return {
          ...option,
          opportunity: selectionPolicy === "worst_gap_runway_opportunity_per_cost"
            ? windowSse + option.parentDepth * selected.targetGapSse
            : windowSse,
          pointCost: pointCostByAnchor[option.anchorGapIndex]!,
        };
      }).sort((a, b) =>
        b.opportunity / b.pointCost - a.opportunity / a.pointCost ||
        b.opportunity - a.opportunity ||
        b.parentDepth - a.parentDepth
      );
      const chosen = targetOptions[0];
      if (chosen === undefined) return null;
      anchorGapIndex = chosen.anchorGapIndex;
      parentDepth = chosen.parentDepth;
    } else if (
      selectionPolicy !== "worst_gap_deepest_affordable" &&
      selectionPolicy !== "worst_gap_three_quarter_last_chance"
    ) {
      const reserveUpper = affordableAnchorGapIndices.reduce(
        (minimum, gapIndex) => Math.min(minimum, upperCostByAnchor[gapIndex]!),
        Number.POSITIVE_INFINITY,
      );
      const targetOptions = Array.from(
        { length: Math.min(maximum, selected.targetGapIndex) + 1 },
        (_, depth) => ({
          parentDepth: depth,
          anchorGapIndex: selected.targetGapIndex - depth,
        }),
      ).filter(({ anchorGapIndex: gapIndex }) => {
        const point = pointCostByAnchor[gapIndex];
        const upper = upperCostByAnchor[gapIndex];
        return Number.isFinite(point) && point! > 0 &&
          Number.isFinite(upper) && upper! > 0 && upper! <= usableBudgetFrames;
      });
      const reserved = targetOptions.filter(({ anchorGapIndex: gapIndex }) =>
        upperCostByAnchor[gapIndex]! + reserveUpper <= usableBudgetFrames
      ).sort((a, b) => b.parentDepth - a.parentDepth)[0];
      // The corrected study spends an unreservable final iteration from the
      // ordinary deepest anchor. The first arm's explicit latest-anchor rule
      // remains separately named so its completed evidence stays replayable.
      const finalRepair = [...targetOptions].sort((a, b) =>
        selectionPolicy === "worst_gap_reserve_cheapest_else_deepest"
          ? b.parentDepth - a.parentDepth
          : a.parentDepth - b.parentDepth
      )[0];
      const chosen = reserved ?? finalRepair;
      if (chosen === undefined) return null;
      anchorGapIndex = chosen.anchorGapIndex;
      parentDepth = chosen.parentDepth;
    }
    return {
      ...selected,
      anchorGapIndex,
      parentDepth,
      selectionPolicy,
      affordableAnchorGapIndices,
      mutableSuffixSse: candidates
        .filter((candidate) => candidate.gapIndex >= anchorGapIndex)
        .reduce((sum, candidate) => sum + candidate.sse, 0),
    };
  }
  if (selectionPolicy === "max_local_window_opportunity") {
    const choices = candidates.flatMap((target) =>
      Array.from(
        { length: Math.min(maximum, target.gapIndex) + 1 },
        (_, parentDepth) => ({
          parentDepth,
          anchorGapIndex: target.gapIndex - parentDepth,
        }),
      ).filter(({ anchorGapIndex }) => affordableAnchorGapIndices.includes(anchorGapIndex))
        .map(({ parentDepth, anchorGapIndex }) => ({
          target,
          anchorGapIndex,
          parentDepth,
          windowSse: candidates.filter((candidate) =>
            candidate.gapIndex >= anchorGapIndex && candidate.gapIndex <= target.gapIndex
          ).reduce((sum, candidate) => sum + candidate.sse, 0),
        }))
    );
    choices.sort((a, b) =>
      b.windowSse - a.windowSse ||
      b.target.sse - a.target.sse ||
      b.parentDepth - a.parentDepth ||
      a.target.gapIndex - b.target.gapIndex
    );
    const selected = choices[0];
    if (selected === undefined) return null;
    return {
      selectionPolicy,
      targetGapIndex: selected.target.gapIndex,
      anchorGapIndex: selected.anchorGapIndex,
      parentDepth: selected.parentDepth,
      targetGapSse: selected.target.sse,
      mutableSuffixSse: candidates.filter((candidate) =>
        candidate.gapIndex >= selected.anchorGapIndex
      ).reduce((sum, candidate) => sum + candidate.sse, 0),
      usableBudgetFrames,
      affordableTargetGapIndices,
      affordableAnchorGapIndices,
    };
  }
  const choices = affordableAnchorGapIndices.map((anchorGapIndex) => {
    const suffix = candidates.filter((candidate) => candidate.gapIndex >= anchorGapIndex);
    const target = [...suffix].sort((a, b) => b.sse - a.sse || a.gapIndex - b.gapIndex)[0]!;
    const mutableSuffixSse = suffix.reduce((sum, candidate) => sum + candidate.sse, 0);
    return {
      target,
      anchorGapIndex,
      mutableSuffixSse,
      pointCost: pointCostByAnchor[anchorGapIndex]!,
    };
  });
  choices.sort(selectionPolicy === "suffix_opportunity_per_cost"
    ? (a, b) =>
      b.mutableSuffixSse / b.pointCost - a.mutableSuffixSse / a.pointCost ||
      b.mutableSuffixSse - a.mutableSuffixSse ||
      b.anchorGapIndex - a.anchorGapIndex
    : (a, b) =>
      b.mutableSuffixSse - a.mutableSuffixSse || a.anchorGapIndex - b.anchorGapIndex);
  const selected = choices[0];
  if (selected === undefined) return null;
  return {
    selectionPolicy,
    targetGapIndex: selected.target.gapIndex,
    anchorGapIndex: selected.anchorGapIndex,
    parentDepth: selected.target.gapIndex - selected.anchorGapIndex,
    targetGapSse: selected.target.sse,
    mutableSuffixSse: selected.mutableSuffixSse,
    usableBudgetFrames,
    affordableTargetGapIndices,
    affordableAnchorGapIndices,
  };
}

function resolveHandoffSearchPolicy({
  node,
  gaps,
  ctx,
  targetProfile,
  telemetry,
  sparseContactCadence,
  targetBudget,
  budgetSlack,
  deadlineMargin,
  hasCompletion,
}: {
  node: SearchNode;
  gaps: Gap[];
  ctx: SpecContext;
  targetProfile: HandoffTargetProfile;
  telemetry: HandoffTelemetry;
  sparseContactCadence: boolean;
  targetBudget: number;
  budgetSlack: number;
  deadlineMargin: number;
  hasCompletion: boolean;
}): HandoffSearchPolicy {
  const nCand = qualityHandoffSampleCount(
    targetProfile,
    sparseContactCadence,
    targetBudget,
    node.gapIndex,
  );
  return {
    nCand,
    preview: false,
    axisQualitySearch: true,
    releaseSetup: true,
    budgetSlack,
    branchLimit: lowSlackTraversalBranchLimit(budgetSlack, hasCompletion),
    reuseLimit: reuseCandidateLimit(node, targetBudget, telemetry),
    tailBranching: TAIL_COMPLETION_FALLBACK_BRANCHING,
    deadlineMargin,
    forwardStageTop: hasCompletion
      ? Math.max(0, Number.parseInt(readPostCompletionFwdStageTop() ?? "0", 10) || 0)
      : 0,
    forwardEval: hasCompletion ||
      !(budgetSlack < HANDOFF_LOW_SLACK_BRANCH_THRESHOLD) ||
      readPrecompletionFwdEval() === "1",
  };
}

/** Both sampled once per compile: `resolveHandoffSearchPolicy` runs on every
 *  expanded node, and a raw `process.env` read is an interceptor call
 *  (~268 ns) not a property read. */
const readPostCompletionFwdStageTop = compileScopedEnv("LR_POST_COMPLETION_FWD_STAGE_TOP");
const readPrecompletionFwdEval = compileScopedEnv("LR_PRECOMPLETION_FWD_EVAL");

function lowSlackTraversalBranchLimit(budgetSlack: number, hasCompletion: boolean): number {
  if (hasCompletion) return HANDOFF_BRANCHING;
  if (!Number.isFinite(budgetSlack)) return HANDOFF_BRANCHING;
  return budgetSlack < HANDOFF_LOW_SLACK_BRANCH_THRESHOLD
    ? Math.max(1, HANDOFF_BRANCHING - 1)
    : HANDOFF_BRANCHING;
}

function emptyNumericAccumulator(): NumericAccumulator {
  return { count: 0, sum: 0, min: Infinity, max: -Infinity };
}

function recordNumeric(acc: NumericAccumulator, value: number): void {
  acc.count++;
  acc.sum += value;
  acc.min = Math.min(acc.min, value);
  acc.max = Math.max(acc.max, value);
}

function recordHandoffPolicyTelemetry(
  telemetry: HandoffTelemetry,
  policy: HandoffSearchPolicy,
): void {
  recordNumeric(telemetry.policyNCand, policy.nCand);
  recordNumeric(telemetry.policyBranchLimit, policy.branchLimit);
}

function snapshotNumericPolicyStats(
  prefix: "handoff_requested_normal_proposals_per_ranked_option_call" | "handoff_policy_branch_limit",
  acc: NumericAccumulator,
): Partial<CompileStats> {
  if (acc.count === 0) return {};
  return {
    [`${prefix}_min`]: acc.min,
    [`${prefix}_mean`]: round3(acc.sum / acc.count),
    [`${prefix}_max`]: acc.max,
  } as Partial<CompileStats>;
}

export function handoffSampleCount(targetBudget?: number, repairLane = false): number {
  // LR_QUALITY_NCAND=<n> overrides the unified candidate breadth for controlled
  // spend-response studies and, later, model-driven budget allocation.
  const override = qualityNCandOverride();
  if (override !== null) return override;
  return budgetAwareQualitySampleCount(targetBudget, repairLane);
}

function qualityNCandOverride(): number | null {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_QUALITY_NCAND;
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? Math.min(64, n) : null;
}

function qualityHandoffSampleCount(
  profile: HandoffTargetProfile,
  sparseContactCadence: boolean,
  targetBudget: number | undefined,
  gapIndex: number | null = null,
): number {
  const base = handoffSampleCount(targetBudget, repairLaneActive);
  if (qualityNCandOverride() !== null) return base;
  const studied = applyStudyRepairBreadth(
    qualityBreadth(profile, sparseContactCadence, base),
    repairLaneActive,
    activeRepairIterationIndex,
    activeRepairAnchorGapIndex !== null && gapIndex === activeRepairAnchorGapIndex,
    activeRepairTargetGapIndex !== null && gapIndex !== null &&
      gapIndex > activeRepairTargetGapIndex,
  );
  return activeRepairBreadthRatio >= 1
    ? studied
    : Math.max(
      HANDOFF_QUALITY_N_CAND_FLOOR,
      Math.round(studied * activeRepairBreadthRatio),
    );
}

type QualityBreadthRule = {
  nCand: number;
  allowSparseSmooth?: boolean;
  matches: (profile: HandoffTargetProfile) => boolean;
};

/**
 * The breadth law's SCARCE-BUDGET FLOOR, which is what these two rules are —
 * not, as their history suggests, per-spec relief.
 *
 * They only run when the law returns fewer than `HANDOFF_QUALITY_N_CAND` (32),
 * i.e. below B = 291,667 frames, where the law returns 8 / 16 / 24 at 75k / 150k
 * / 225k and the floor `HANDOFF_QUALITY_N_CAND_FLOOR = 8` starts binding. Both
 * predicates are budget-blind and broad — any spec with air range >= 0.50 or
 * speed range >= 0.40, and any spec of <= 32 contacts with no amplitude — so
 * across most of the suite the effect at low budget is "sample at least ~32
 * candidates per gap however small the budget is".
 *
 * DELETED from this table in 2026-08: four rules keyed on benchmark-case
 * signatures (M165 drum-grain 40, M152 canyon 36, M144 residual 28, M132
 * dense-low-air 34) behind min-budget gates named after those same cases
 * (200,000 / 250,000). They could only fire at 225k and 250k, and at 225k
 * removing the WHOLE table measured +0.01 mean score per run (suite +2.84) on
 * golden v1 x 40 specs x 12 seeds — so the case-named half was buying nothing at
 * the only tier it could reach. Their four min-budget constants, four nCand
 * constants, four predicates and four env kill-switches went with them.
 *
 * KEPT, because the measurement says so: removing the whole table costs -7.70
 * mean score per run at 75k (suite -19.78, 24 new missing contacts) and -1.53 at
 * 150k, where only these two rules can fire. The honest next step is not to
 * delete them but to ask whether the law's own floor of 8 is simply wrong — this
 * table has been compensating for it — and that is a bracket on
 * `HANDOFF_QUALITY_N_CAND_FLOOR`, not a per-spec question.
 *
 * That bracket is UNTESTABLE at the promoting surface, and the reason is
 * arithmetic rather than an opinion: the law reaches 8 at
 * `250,000 * 7.5 / 27` = 69,444 frames, so the floor binds only below ~69k —
 * a factor of ten under 750k, and still a factor of seven under it at the
 * widest study scale `studyNCandScale` admits. Any bracket on it has to be
 * taken on the standing low-budget reading, never on a 750k panel;
 * `tests/handoff_policy.test.ts` pins the arithmetic so the row cannot be
 * re-parked as "unmeasured" by a future reader.
 *
 * All of it is unreachable at every promoted budget: 20/20 golden track hashes
 * unchanged at 750,000 with the whole table deleted.
 */
const QUALITY_BREADTH_RULES: readonly QualityBreadthRule[] = [
  {
    nCand: HANDOFF_QUALITY_N_CAND,
    matches: shouldRelaxMatureQualityLean,
  },
  {
    nCand: HANDOFF_QUALITY_SHORT_NO_AMP_BOOST_N_CAND,
    allowSparseSmooth: true,
    matches: shouldBoostShortNoAmpQualityBreadth,
  },
];

function qualityBreadth(
  profile: HandoffTargetProfile,
  sparseContactCadence: boolean,
  base: number,
): number {
  if (
    readEnv("LR_M166_SPARSE_AMP_QUALITY48") !== "0" &&
    shouldBoostSparseAmpQualityBreadthAllBudget(profile)
  ) {
    return Math.max(base, HANDOFF_QUALITY_SPARSE_AMP_Q48_N_CAND);
  }
  if (base >= HANDOFF_QUALITY_N_CAND) return base;

  const rule = QUALITY_BREADTH_RULES.find((candidate) => candidate.matches(profile));
  if (rule !== undefined) {
    return rule.allowSparseSmooth === true && sparseContactCadence
      ? smoothSparseAmplitudeQualityBreadth(profile, rule.nCand)
      : rule.nCand;
  }
  return sparseContactCadence
    ? smoothSparseAmplitudeQualityBreadth(profile, base)
    : base;
}

function budgetAwareQualitySampleCount(targetBudget: number | undefined, repairLane = false): number {
  /*
   * ONE SCALE-FREE LAW, replacing five piecewise segments.
   *
   * This used to be `scarceLean` (faded out by 100k), `matureLean` (saturated
   * by 250k), a canonical-scarce segment and a hard `HANDOFF_QUALITY_N_CAND`
   * ceiling. Together they produced a NON-MONOTONIC curve — 29 candidates at
   * 100k, 32 at 125k, 24 at 250k, 29 at 500k and 29 at 750k — which is not a
   * statement about budget at all, only an interpolation through the three
   * budgets the benchmark happens to run. Outside that window the answer was
   * arbitrary, and at the top the ceiling pinned every mature budget to the
   * same 29 however much budget existed.
   *
   * The law: per-gap breadth grows LINEARLY with the budget. A compile with
   * twice the frames affords twice the candidates per gap, which is what the
   * frame arithmetic says in the first place — the search visits a fixed set of
   * gaps, so frames-per-gap is proportional to the budget. Monotone, no
   * ceiling, no special budgets in it.
   *
   * Both parameters are FITTED, not chosen. The anchor is bracketed at the
   * reference budget, where the exponent cannot matter, and it reproduces
   * across independent runs: 21 is -8.0, 24 is 0, **27 is +7.0**, 30 is -8.5 on
   * that budget. The exponent is bracketed against the arc-command efficiency
   * it interacts with: 0.70 +6.25, 0.85 +6.84, **1.00 +7.44**, 1.20 +6.81.
   *
   * The first version of this law shipped at sqrt with an anchor of 24 because
   * both were picked rather than measured; fitting them is +7.44 on top of it.
   */
  if (typeof targetBudget !== "number" || !Number.isFinite(targetBudget)) {
    return HANDOFF_QUALITY_N_CAND;
  }
  return Math.max(
    HANDOFF_QUALITY_N_CAND_FLOOR,
    Math.round(
      studyNCandScale() * studyNCandBreadth(Math.max(0, targetBudget), repairLane),
    ),
  );
}

/**
 * STUDY-ONLY exponent arm, anchored at the promoting 750k surface.
 *
 * The shipped law is exponent 1. Setting this hook changes curvature without
 * moving the 750k candidate count: `81 * (budget / 750k) ** exponent`. This is
 * deliberately separate from `LR_STUDY_NCAND_SCALE`, which moves the anchor.
 * It lets the budget sweep ask whether the linear law is spending increasing
 * budgets on breadth too aggressively while preserving the already rechecked
 * local optimum at the headline surface.
 */
const STUDY_NCAND_EXPONENT_ANCHOR_FRAMES = 750_000;
const STUDY_NCAND_EXPONENT_ANCHOR_COUNT = HANDOFF_QUALITY_N_CAND_AT_REF *
  (STUDY_NCAND_EXPONENT_ANCHOR_FRAMES / HANDOFF_QUALITY_N_CAND_REF_FRAMES);
const readStudyNCandExponent = compileScopedEnv("LR_STUDY_NCAND_EXPONENT");
/** Study-only shapes for the multi-budget benchmark. The high-budget hinged
 * arms are exactly production through 750k; the remaining repair policies are
 * explicit phase/suffix allocation studies rather than new global laws. */
const readStudyNCandPolicy = compileScopedEnv("LR_STUDY_NCAND_POLICY");

/** Apply a declared repair-only breadth intervention after the ordinary
 * target-profile floors. This placement is intentional: a three-quarter arm
 * must reduce the pool the repair lane actually requests, not merely lower a
 * pre-floor base that broad low-budget profiles immediately raise again.
 * `repairAnchorBuild` lets the descendant-only arm protect exactly the pool at
 * the independently selected restart anchor. `repairPostTargetBuild` identifies
 * only pools strictly after the independently selected target transition. The
 * absolute LR_QUALITY_NCAND override bypasses this helper above. */
export function applyStudyRepairBreadth(
  nCand: number,
  repairLane: boolean,
  repairIterationIndex: number | null = null,
  repairAnchorBuild = false,
  repairPostTargetBuild = false,
): number {
  const policy = readStudyNCandPolicy();
  if (!repairLane) return nCand;
  const ratio = policy === "repair-three-quarter"
    ? 3 / 4
    : policy === "repair-seven-eighth"
      ? 7 / 8
      : policy === "late-repair-seven-eighth" &&
          repairIterationIndex !== null && repairIterationIndex >= 2
        ? 7 / 8
      : (
          policy === "repair-descendants-three-quarter" ||
          policy === "repair-descendants-three-quarter-stable-planning"
        ) && !repairAnchorBuild
        ? 3 / 4
      : policy === "repair-post-target-three-quarter" && repairPostTargetBuild
        ? 3 / 4
      : 1;
  return Math.max(HANDOFF_QUALITY_N_CAND_FLOOR, Math.round(nCand * ratio));
}

function studyNCandBreadth(targetBudget: number, repairLane: boolean): number {
  const policy = readStudyNCandPolicy();
  const raw = readStudyNCandExponent();
  if (policy !== undefined && policy !== "" && raw !== undefined && raw !== "") {
    throw new Error(`LR_STUDY_NCAND_POLICY and LR_STUDY_NCAND_EXPONENT are mutually exclusive`);
  }
  const linear = HANDOFF_QUALITY_N_CAND_AT_REF *
    (targetBudget / HANDOFF_QUALITY_N_CAND_REF_FRAMES);
  if (policy === "high-budget-three-quarter") {
    return targetBudget <= STUDY_NCAND_EXPONENT_ANCHOR_FRAMES
      ? linear
      : STUDY_NCAND_EXPONENT_ANCHOR_COUNT *
        ((targetBudget / STUDY_NCAND_EXPONENT_ANCHOR_FRAMES) ** 0.75);
  }
  if (policy === "repair-high-budget-three-quarter") {
    return !repairLane || targetBudget <= STUDY_NCAND_EXPONENT_ANCHOR_FRAMES
      ? linear
      : STUDY_NCAND_EXPONENT_ANCHOR_COUNT *
        ((targetBudget / STUDY_NCAND_EXPONENT_ANCHOR_FRAMES) ** 0.75);
  }
  // Applied after target-profile floors by applyStudyRepairBreadth(). Keeping
  // the base law unchanged here also keeps the initial-search lane exact.
  if (
    policy === "repair-three-quarter" || policy === "repair-seven-eighth" ||
    policy === "late-repair-seven-eighth" ||
    policy === "repair-descendants-three-quarter" ||
    policy === "repair-descendants-three-quarter-stable-planning" ||
    policy === "repair-post-target-three-quarter"
  ) return linear;
  if (policy === "linear-cap-216") return Math.min(linear, 216);
  if (policy !== undefined && policy !== "") {
    throw new Error(
      `LR_STUDY_NCAND_POLICY must be high-budget-three-quarter, ` +
        `repair-high-budget-three-quarter, repair-three-quarter, repair-seven-eighth, ` +
        `late-repair-seven-eighth, repair-descendants-three-quarter, ` +
        `repair-descendants-three-quarter-stable-planning, repair-post-target-three-quarter, ` +
        `or linear-cap-216 ` +
        `(STUDY-ONLY; never set it in production), got "${policy}"`,
    );
  }
  if (raw === undefined || raw === "") {
    return linear;
  }
  const exponent = Number.parseFloat(raw);
  if (!Number.isFinite(exponent) || exponent <= 0 || exponent > 1) {
    throw new Error(
      `LR_STUDY_NCAND_EXPONENT must be a finite number in (0, 1] (STUDY-ONLY; never set it ` +
        `in production or in an eval), got "${raw}"`,
    );
  }
  return STUDY_NCAND_EXPONENT_ANCHOR_COUNT *
    ((targetBudget / STUDY_NCAND_EXPONENT_ANCHOR_FRAMES) ** exponent);
}

export type StudyRepairPlanningCostPolicy = "current_incumbent" | "initial_terminal";

/**
 * Study-only affordability-profile isolation for descendant breadth. The
 * initial terminal is produced outside the repair lane at production breadth,
 * so retaining that measured profile prevents cheaper repair descendants from
 * silently changing the next anchor decision. Real charged work is never
 * rescaled or refunded.
 */
export function studyRepairPlanningCostPolicy(): StudyRepairPlanningCostPolicy {
  return readStudyNCandPolicy() === "repair-descendants-three-quarter-stable-planning"
    ? "initial_terminal"
    : "current_incumbent";
}

/**
 * STUDY-ONLY multiplier on the breadth law's OUTPUT, at a fixed budget.
 *
 * Not a re-fit and not a change of form: the law stays linear, its anchor and
 * its reference budget are untouched, and the floor still applies to the scaled
 * result. This exists to ask ONE question — is the law's value at the promoting
 * budget still the local optimum now that the depth-1 promotion changed what a
 * rollout costs around it (the stale-sweep rule) — and its answer is a probe,
 * never a production candidate. If an off-1.0 arm wins, the follow-up is a
 * proper cross-budget re-fit of the anchor and the exponent, because a scale
 * applied at one budget IS a per-budget constant and this repo does not ship
 * those.
 *
 * `LR_QUALITY_NCAND` cannot serve here: it is an absolute count capped at 64,
 * and the law already returns 81 at 750k, so the whole neighbourhood of the
 * promoting budget is out of its reach.
 *
 * REFUSES rather than clamps; unset/empty is exactly the shipped law.
 *
 * WALKED 2026-08-04 at 44 sources x 8 seeds x 750k (352 paired cells per arm;
 * nCand 57 / 69 / 81 / 93 / 105):
 *
 *     0.70x  -2.276 +/- 0.708 (t=-3.21)      1.15x  -0.142 +/- 0.739
 *     0.85x  -3.130 +/- 1.700                1.30x  -1.169 +/- 1.471
 *
 * **1.0 is re-confirmed as the local optimum under the depth-1 rollout
 * economics**, and the curve is asymmetric: narrowing is significantly worse
 * (0.70x is the only |t| > 2 result on the whole panel, and every stratum is
 * negative), widening is a null that trends down. Both off-1.0 widenings also
 * cost a completion the shipped law keeps (`frontier_pickup_progression_shifted`
 * goes invalid at 0.85x seed 22 and at 1.30x seed 18; the base arm is 352/352
 * valid) — the extra per-gap breadth is paid for in tree depth (nodes expanded
 * 209 -> 163 across the walk) and the frontier sources are the ones that need
 * the tree. The law's linear form and its 250k anchor were not touched and are
 * not what this measured; the stale-sweep licence the depth-1 promotion opened
 * on the constant is DISCHARGED, and no cross-budget re-fit is indicated.
 */
const readStudyNCandScale = compileScopedEnv("LR_STUDY_NCAND_SCALE");

function studyNCandScale(): number {
  const raw = readStudyNCandScale();
  if (raw === undefined || raw === "") return 1;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n < 0.5 || n > 2) {
    throw new Error(
      `LR_STUDY_NCAND_SCALE must be a finite number in [0.5, 2] (STUDY-ONLY; never set it ` +
        `in production or in an eval), got "${raw}"`,
    );
  }
  return n;
}

function shouldRelaxMatureQualityLean(profile: HandoffTargetProfile): boolean {
  return profile.axes.air.range >= HANDOFF_QUALITY_VARIATION_RELIEF_AIR_RANGE ||
    profile.axes.speed.range >= HANDOFF_QUALITY_VARIATION_RELIEF_SPEED_RANGE;
}

function shouldBoostShortNoAmpQualityBreadth(profile: HandoffTargetProfile): boolean {
  return profile.contactCount <= HANDOFF_QUALITY_SHORT_NO_AMP_MAX_CONTACTS &&
    profile.axes.amplitude.range <= 0;
}

function shouldBoostSparseAmpQualityBreadthAllBudget(profile: HandoffTargetProfile): boolean {
  const medianGapFrames = profile.medianContactGapFrames;
  const meanAir = profile.axes.air.mean;
  const meanSpeed = profile.axes.speed.mean;
  const meanAmplitude = profile.axes.amplitude.mean;
  const meanElevation = profile.axes.elevation.mean;
  const meanImpact = profile.axes.impact.mean;
  if (
    medianGapFrames === null ||
    meanAir === null ||
    meanSpeed === null ||
    meanAmplitude === null ||
    meanImpact === null
  ) {
    return false;
  }

  const contacts = profile.contactCount;
  const airRange = profile.axes.air.range;
  const speedRange = profile.axes.speed.range;
  const amplitudeRange = profile.axes.amplitude.range;
  const elevationRange = profile.axes.elevation.range;
  const impactRange = profile.axes.impact.range;

  const floatBoundsPocket = contacts >= 13 &&
    contacts <= 15 &&
    medianGapFrames >= 46 &&
    medianGapFrames <= 50 &&
    meanAir >= 0.73 &&
    meanAir <= 0.76 &&
    airRange >= 0.27 &&
    airRange <= 0.31 &&
    meanSpeed >= 0.59 &&
    meanSpeed <= 0.61 &&
    speedRange <= 0.02 &&
    meanAmplitude >= 0.46 &&
    meanAmplitude <= 0.50 &&
    amplitudeRange >= 0.34 &&
    amplitudeRange <= 0.39 &&
    meanElevation === null &&
    elevationRange <= 0 &&
    meanImpact >= 0.11 &&
    meanImpact <= 0.15 &&
    impactRange >= 0.29 &&
    impactRange <= 0.34;

  const soarSettlePocket = contacts >= 15 &&
    contacts <= 17 &&
    medianGapFrames >= 27 &&
    medianGapFrames <= 29 &&
    meanAir >= 0.60 &&
    meanAir <= 0.63 &&
    airRange >= 0.37 &&
    airRange <= 0.40 &&
    meanSpeed >= 0.59 &&
    meanSpeed <= 0.61 &&
    speedRange <= 0.02 &&
    meanAmplitude >= 0.30 &&
    meanAmplitude <= 0.35 &&
    amplitudeRange >= 0.60 &&
    amplitudeRange <= 0.65 &&
    meanElevation === null &&
    elevationRange <= 0 &&
    meanImpact >= 0.35 &&
    meanImpact <= 0.39 &&
    impactRange >= 0.82 &&
    impactRange <= 0.88;

  const ridgePulsePocket = contacts >= 23 &&
    contacts <= 25 &&
    medianGapFrames >= 23 &&
    medianGapFrames <= 25 &&
    meanAir >= 0.49 &&
    meanAir <= 0.52 &&
    airRange >= 0.12 &&
    airRange <= 0.15 &&
    meanSpeed >= 0.64 &&
    meanSpeed <= 0.66 &&
    speedRange >= 0.16 &&
    speedRange <= 0.19 &&
    meanAmplitude >= 0.15 &&
    meanAmplitude <= 0.19 &&
    amplitudeRange >= 0.10 &&
    amplitudeRange <= 0.13 &&
    meanElevation !== null &&
    meanElevation >= 0.50 &&
    meanElevation <= 0.53 &&
    elevationRange >= 0.14 &&
    elevationRange <= 0.17 &&
    meanImpact >= 0.29 &&
    meanImpact <= 0.32 &&
    impactRange >= 0.67 &&
    impactRange <= 0.71;

  const rollingDropPocket = contacts >= 15 &&
    contacts <= 17 &&
    medianGapFrames >= 44 &&
    medianGapFrames <= 48 &&
    meanAir >= 0.62 &&
    meanAir <= 0.65 &&
    airRange >= 0.30 &&
    airRange <= 0.33 &&
    meanSpeed >= 0.62 &&
    meanSpeed <= 0.64 &&
    speedRange >= 0.08 &&
    speedRange <= 0.11 &&
    meanAmplitude >= 0.33 &&
    meanAmplitude <= 0.37 &&
    amplitudeRange >= 0.43 &&
    amplitudeRange <= 0.47 &&
    meanElevation !== null &&
    meanElevation >= 0.46 &&
    meanElevation <= 0.50 &&
    elevationRange >= 0.32 &&
    elevationRange <= 0.36 &&
    meanImpact >= 0.54 &&
    meanImpact <= 0.58 &&
    impactRange >= 0.62 &&
    impactRange <= 0.66;

  return floatBoundsPocket || soarSettlePocket || ridgePulsePocket || rollingDropPocket;
}

function smoothSparseAmplitudeQualityBreadth(
  profile: HandoffTargetProfile,
  base: number,
): number {
  if (base >= HANDOFF_QUALITY_SPARSE_AMP_BOOST_N_CAND) return base;
  const medianGapFrames = profile.medianContactGapFrames;
  const meanImpact = profile.axes.impact.mean;
  if (medianGapFrames === null || meanImpact === null) return base;
  const amplitudePressure = smoothstep(
    (profile.axes.amplitude.range - HANDOFF_QUALITY_SPARSE_AMP_RANGE_START) /
      HANDOFF_QUALITY_SPARSE_AMP_RANGE_SPAN,
  );
  const sparsePressure = smoothstep(
    (medianGapFrames - HANDOFF_QUALITY_SPARSE_AMP_MEDIAN_START_FRAMES) /
      HANDOFF_QUALITY_SPARSE_AMP_MEDIAN_SPAN_FRAMES,
  );
  const impactPressure = smoothstep(
    (meanImpact - HANDOFF_QUALITY_SPARSE_AMP_IMPACT_START) /
      HANDOFF_QUALITY_SPARSE_AMP_IMPACT_SPAN,
  ) * (1 - smoothstep(
    (meanImpact - HANDOFF_QUALITY_SPARSE_AMP_IMPACT_HIGH_START) /
      HANDOFF_QUALITY_SPARSE_AMP_IMPACT_HIGH_SPAN,
  ));
  const speedSteadiness = 1 - smoothstep(
    (profile.axes.speed.range - HANDOFF_QUALITY_SPARSE_AMP_SPEED_RANGE_START) /
      HANDOFF_QUALITY_SPARSE_AMP_SPEED_RANGE_SPAN,
  );
  const pressure = amplitudePressure * sparsePressure * impactPressure * speedSteadiness;
  if (pressure <= 0) return base;
  return clampIntLocal(
    base + (HANDOFF_QUALITY_SPARSE_AMP_BOOST_N_CAND - base) * pressure,
    base,
    HANDOFF_QUALITY_SPARSE_AMP_BOOST_N_CAND,
  );
}

export function usesSparseContactCadence(gaps: readonly Gap[]): boolean {
  const median = medianContactGapFrames(gaps);
  return median !== null && median >= HANDOFF_SPARSE_CONTACT_MEDIAN_FRAMES;
}

function usesSparseContactCadenceProfile(profile: HandoffTargetProfile): boolean {
  return profile.medianContactGapFrames !== null &&
    profile.medianContactGapFrames >= HANDOFF_SPARSE_CONTACT_MEDIAN_FRAMES;
}

function medianContactGapFrames(gaps: readonly Gap[]): number | null {
  const contactGapFrames = gaps
    .filter((gap) => gap.endsWithContact)
    .map((gap) => gap.endFrame - gap.startFrame);
  if (contactGapFrames.length === 0) return null;
  const sorted = [...contactGapFrames].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function shouldAttemptNearTailCompletion(
  node: { search: SearchNode; skippedContacts: number },
  gaps: Gap[],
  targetBudget = 0,
  telemetry?: HandoffTelemetry,
): boolean {
  if (node.skippedContacts > 0 || isTerminalNode(node.search, gaps)) return false;
  if (!node.search.prefixFits.some((fit) => fit !== null)) return false;
  const remaining = remainingContactCount(node.search, gaps);
  if (
    telemetry !== undefined &&
    remaining <= 2 &&
    !shouldKeepShallowQualityTailCompletion(node.search, remaining, targetBudget, telemetry)
  ) {
    return false;
  }
  return shouldAttemptTailCompletionWindow(node.search, remaining, targetBudget);
}

function shouldAttemptTailCompletionWindow(
  node: SearchNode,
  remainingContacts: number,
  targetBudget: number,
): boolean {
  const window = tailCompletionContactWindow(targetBudget);
  const fullContacts = Math.floor(window);
  if (remainingContacts <= fullContacts) return true;
  if (remainingContacts > fullContacts + 1) return false;
  const boundaryPressure = smoothstep(window - fullContacts);
  return unitHash(tailCompletionWindowSeed(node, remainingContacts)) < boundaryPressure;
}

function shouldKeepShallowQualityTailCompletion(
  node: SearchNode,
  remainingContacts: number,
  targetBudget: number,
  telemetry: HandoffTelemetry,
): boolean {
  const throttle = shallowQualityTailThrottlePressure(
    targetBudget,
    uniqueFullEvaluations(telemetry),
  );
  if (throttle <= 0) return true;
  return unitHash(shallowQualityTailThrottleSeed(node, remainingContacts)) >= throttle;
}

function shallowQualityTailThrottlePressure(
  targetBudget: number,
  uniqueFull: number,
): number {
  const budgetPressure = maturityPressure(targetBudget, HANDOFF_MATURITY_BUDGET_SCALE_FRAMES);
  const fullFeedback = Math.max(0, uniqueFull);
  const feedbackPressure = smoothstep(
    clamp01(
      fullFeedback /
        (fullFeedback + QUALITY_SHALLOW_TAIL_THROTTLE_FULL_FEEDBACK_SCALE),
    ),
  );
  return clamp01(QUALITY_SHALLOW_TAIL_THROTTLE_MAX_PRESSURE * budgetPressure * feedbackPressure);
}

function shallowQualityTailThrottleSeed(node: SearchNode, remainingContacts: number): number {
  return nodeHashSeed(node, Math.imul(remainingContacts + 1, 0x27d4eb2d));
}

function tailCompletionWindowSeed(node: SearchNode, remainingContacts: number): number {
  return nodeHashSeed(node, Math.imul(remainingContacts + 1, 0x165667b1), 0x68bc21eb);
}

/** 8 + 4·maturity: 10.73 contacts at 250k, 11.46 at 500k, 11.70 at 750k, 11.81
 *  at 1M, 12 in the limit. The fractional part is realised as a stochastic gate
 *  per (node, remainingContacts), so the window is continuous even though
 *  contacts are integers — which is why a whole extra contact of breadth arrives
 *  gradually across the grid rather than at a threshold. */
function tailCompletionContactWindow(targetBudget: number): number {
  const pressure = maturityPressure(targetBudget, HANDOFF_MATURITY_BUDGET_SCALE_FRAMES);
  return TAIL_COMPLETION_CONTACT_WINDOW + TAIL_COMPLETION_BUDGET_WINDOW_EXTRA * pressure;
}

function uniqueFullEvaluations(telemetry: HandoffTelemetry): number {
  return Math.max(0, telemetry.fullEvaluations - telemetry.duplicateFullEvaluations);
}

function remainingContactCount(node: SearchNode, gaps: Gap[]): number {
  return remainingContactCountFromGapIndex(node.gapIndex, gaps);
}

function remainingContactCountFromGapIndex(gapIndex: number, gaps: Gap[]): number {
  let contacts = 0;
  for (let i = Math.min(gapIndex, gaps.length); i < gaps.length; i++) {
    if (gaps[i].endsWithContact) contacts++;
  }
  return contacts;
}

function scoreCandidateForHandoff(
  node: SearchNode,
  candidate: Candidate,
  rank: number,
  source: HandoffCandidateSource,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
  usePreview = true,
  previewCostWeight = PREVIEW_COST_WEIGHT,
  releaseSetup = false,
  targetBudget = 0,
  sourceAxis?: AxisName,
  budgetSlack = 0,
  openingBestOpportunity = 0,
  forwardConfigOverride?: CandidateForwardPolicy,
  allowForwardEval = true,
): RankedOption {
  const child = extendNodeCached(node, candidate);
  // Forward-eval ranking (DEFAULT ≥75k): rank purely by the true metric score of where this arc
  // leads (charged forward rollout), replacing the local axis-L2 proxy below the gate. When the
  // policy marks the pre-completion low-slack phase (allowForwardEval=false), a greedy rollout
  // is shallowed to depth 1 — the exact judge at about half the charge (see
  // HandoffSearchPolicy.forwardEval).
  const fwdCfg = fwdEvalRuntime.config; // resolved once per compile in setForwardEvalContext
  if (fwdCfg !== null && usesForwardEvalAtBudget(targetBudget)) {
    const resolved = forwardConfigOverride ?? adaptiveForwardEvalConfig(
      fwdCfg,
      node,
      gaps,
      targetBudget,
      budgetSlack,
      openingBestOpportunity,
    );
    const effective = allowForwardEval || resolved.variant !== "greedy"
      ? resolved
      : { ...resolved, depth: 1 };
    if (handoffRolloutProbeHook !== null) {
      rolloutProbeContext = {
        gapIndex: node.gapIndex,
        rank,
        source,
        hasCompletion: telemetry.hasCompletion,
        targetBudget,
      };
    }
    const value = forwardArcValue(
      child,
      gaps,
      ctx,
      seed,
      effective,
      // THE POOL BOUNDARY. Every option this value will be sorted against extends this same
      // `node`, so gaps [0, node.gapIndex) are byte-identical across the comparison and the
      // leaf must not let them dilute the part that differs (see dedilutedAxisQuality).
      node.gapIndex,
    );
    const forwardContinuation = cachedForwardContinuation(child, gaps, seed);
    recordCandidateReleaseCoverage(telemetry, candidate);
    attachHandoffScoreToProbe(candidate.lines, -value); // study probe; no-op when off
    return {
      candidate, child, rank, source, sourceAxis,
      previewContacts: 0, previewSurvivors: 0,
      score: -value,
      ...(forwardContinuation === null ? {} : { forwardContinuation }),
    };
  }
  // THE LOCAL AXIS-L2 PROXY. Everything below this point is UNREACHABLE in
  // production: `usesForwardEvalAtBudget` is true at every budget the compiler
  // is run at (the gate is 75,000 frames, the lowest tier anyone runs is 75,000)
  // and `fwdEvalRuntime.config` is only null under `LR_FWD_EVAL=off`. It is kept
  // as the study escape hatch and as the historical record of what the ranker
  // was before forward eval — not as a live lane. Do not tune it, and do not add
  // budget shaping to it: the one budget-shaped input it had
  // (`qualityFuturePreviewPressure`, a maturity × full-feedback ramp threaded
  // through five call sites) was deleted in 2026-08 for being computed on every
  // policy resolution and read by nothing. The off-arm consequently scores the
  // preview at pressure 1 when `preview` is on and 0 when it is off, which is
  // what the parameter default already said.
  const preview = usePreview
    ? previewNextContact(child, gaps, ctx, seed, telemetry)
    : {
      horizon: 0,
      landed: 0,
      survivors: 0,
      firstSurvivors: HANDOFF_PREVIEW_K,
      firstCost: 0,
    };
  const scarcity = preview.horizon === 0
    ? 0
    : preview.firstSurvivors === 0
      ? DEAD_END_PENALTY
      : SURVIVOR_SCARCITY_PENALTY / preview.firstSurvivors;
  recordCandidatePreviewCoverage(telemetry, preview);
  const previewCost = preview.firstCost === Infinity
    ? 0
    : preview.firstCost * previewCostWeight;
  const statePenalty = handoffStatePenalty(child.prefixEngine, gaps[node.gapIndex]);
  const gap = gaps[node.gapIndex];
  const overshoot = candidateOvershootPenalty(candidate, gap);
  const releasePenalty = releaseSetup
    ? candidateReleaseSetupPenalty(candidate, gaps, node.gapIndex)
    : 0;
  recordCandidateReleaseCoverage(telemetry, candidate);
  const previewScore = scarcity + previewCost;
  const localScore = candidate.cost + previewScore + statePenalty + overshoot + releasePenalty;
  attachHandoffScoreToProbe(candidate.lines, localScore); // study probe; no-op when off
  return {
    candidate,
    child,
    rank,
    source,
    sourceAxis,
    previewContacts: preview.landed,
    previewSurvivors: preview.survivors,
    score: localScore,
  };
}

/**
 * Reads a pool the deadline throttle may have built under either state, and is
 * invariant to it by construction: the only thing it asks is whether the pool
 * is non-empty, and the aim lane runs ONLY when the sampled pool is already
 * non-empty and can only ADD to it. So no throttle state can turn a non-empty
 * pool empty here (measured: 0 cross-state effects in 552,318 direct reads).
 */
function cachedForwardContinuation(
  child: SearchNode,
  gaps: Gap[],
  seed: number,
): boolean | null {
  const next = advanceToNextContact(child, gaps);
  if (next === null) return true;
  const cache = next._candidatesCache;
  if (cache === null || cache.seed !== seed || cache.nCand < 1) return null;
  return cache.candidates.length > 0;
}

function candidateReleaseSetupPenalty(
  candidate: Candidate,
  gaps: Gap[],
  gapIndex: number,
): number {
  const nextGapIndex = nextContactGapIndex(gaps, gapIndex + 1);
  if (nextGapIndex < 0) return 0;
  const nextGap = gaps[nextGapIndex];
  return releaseSpeedPenalty(candidate.releaseSpeed, nextGap.targets.speed) +
    releaseVerticalSetupPenalty(candidate, gaps[gapIndex], nextGap);
}

function releaseVerticalSetupPenalty(
  candidate: Candidate,
  gap: Gap,
  nextGap: Gap,
): number {
  const releaseVelocityY = candidate.releaseVelocityY;
  if (releaseVelocityY === undefined) return 0;
  const pressure = releaseVerticalSetupPressure(gap, nextGap);
  if (pressure <= 0) return 0;
  const safeAbsVelocity = HANDOFF_RELEASE_VERTICAL_SAFE_PX;
  const excess = Math.max(0, Math.abs(releaseVelocityY) - safeAbsVelocity);
  return HANDOFF_RELEASE_VERTICAL_WEIGHT * pressure * excess * excess;
}

function releaseVerticalSetupPressure(
  gap: Gap,
  nextGap: Gap,
): number {
  const nextAirTarget = nextGap.targets.air;
  const lowAirPressure = nextAirTarget === undefined
    ? 0
    : lowAirTargetPressure(nextAirTarget, HANDOFF_RELEASE_VERTICAL_LOW_AIR_TARGET_SCALE);
  const cadenceFrames = Math.max(0, nextGap.endFrame - gap.endFrame);
  const cadencePressure = smoothstep(
    (HANDOFF_RELEASE_VERTICAL_TIGHT_CADENCE_FRAMES - cadenceFrames) /
      HANDOFF_RELEASE_VERTICAL_TIGHT_CADENCE_WIDTH,
  );
  const setupPressure = Math.max(lowAirPressure, cadencePressure);
  return setupPressure;
}

function candidateOvershootPenalty(candidate: Candidate, gap: Gap): number {
  return handoffAxisOvershootPenalty(
    gap.targets,
    settledIncomingAxes(candidate),
  );
}

export function handoffAxisOvershootPenalty(targets: AxisValues, achieved: AxisValues): number {
  let overshoot = 0;
  for (const axis of AXES) {
    const weight = HANDOFF_AXIS_OVERSHOOT_WEIGHTS[axis];
    const target = targets[axis];
    const value = achieved[axis];
    if (weight !== undefined && target !== undefined && value !== undefined && value > target) {
      const delta = value - target;
      overshoot += weight * delta * delta;
    }
  }
  return overshoot;
}

// ════════════════════════════════════════════════════════════════════════════════════════
// FORWARD-EVAL SUBSYSTEM (~this point through buildStartOptions). Extraction candidate: this
// ~1100-line forest (config/env parsing, rollout scorers, objective leaf scorer, and
// the measure-only agreement instrument below) is a near-self-contained unit that touches the
// DFS core at only two call sites (scoreCandidateForHandoff, the telemetry hook in expandNode).
// A physical move to forward_eval.ts is DEFERRED, not rejected: the remaining blocker is threading
// fwdEvalRuntime explicitly through production scorers and EXTERNAL importers
// (eval_arc_apples.ts and eval_leaf_factors.ts call setForwardEvalContext then
// read objectiveLeafValue),
// which have no test coverage of their own.
//
// STUDY-ONLY KNOBS THAT REACH INTO THIS SUBSYSTEM, in one list so nobody has to find them
// by grep. Every one defaults OFF (production is byte-identical with all of them unset) and
// every one REFUSES an out-of-range value instead of clamping:
//   LR_STUDY_IMPACT_ASK_START  impactBestForwardEvalConfig's gate       [0, 1]
//   LR_STUDY_IMPACT_BRANCH     impactBestForwardEvalConfig's width      [1, 8]
//   LR_STUDY_IMPACT_DEPTH      impactBestForwardEvalConfig's own depth  [1, 2]
//                              (2 = the arm's pinned shape = production)
//   LR_STUDY_ROLLOUT_REDRAW    redrawFirstHopOnEmpty's dose, PINNED     [0, 7]
//                              (bypasses the pressure law; =1 is the law at
//                              pressure 0 = the pre-law compiler)
//   LR_STUDY_HANDOFF_POOL      handoffCandidatePool (search-side, but the shape studies
//                              move it against rollout width)           [3, 8]
//   LR_LEAF_DEDILUTE           objectiveLeafValue's two-component fold  {1}
//                              (measured −17.24 ± 3.04 pooled; see dedilutedAxisQuality)
//   LR_STUDY_POST_DEADLINE_W   the head ramp's post-completion phase   [0, 1]
//                              weight (0 = the Phase-1a boundary = production)
//   LR_STUDY_POST_DEADLINE_SCOPE  which post-completion lanes that      all|nonrepair
//                              weight reaches (see postCompletionPhaseWeight)
//   LR_STUDY_NCAND_SCALE       multiplier on the breadth law's output   [0.5, 2]
//                              at a fixed budget (see studyNCandScale) — a probe of the
//                              law's local optimum, never a production shape
//   LR_STUDY_NCAND_EXPONENT    breadth-law curvature, anchored at 750k  (0, 1]
//                              (1 = production; see studyNCandBreadth)
//   LR_STUDY_NCAND_POLICY      predeclared high-budget breadth shapes:
//                              high-budget-three-quarter|
//                              repair-high-budget-three-quarter|
//                              repair-three-quarter|repair-seven-eighth|
//                              late-repair-seven-eighth|repair-descendants-three-quarter|
//                              repair-descendants-three-quarter-stable-planning|
//                              repair-post-target-three-quarter|
//                              linear-cap-216
// Two more live one module over, in optimizer/deadline.ts, because that is where the
// constants they re-bracket are derived; they reach this subsystem through the head ramp,
// the aim throttle and the continuation filter:
//   LR_STUDY_DEADLINE_NO_PRESSURE / _FULL_PRESSURE   the two margin anchors  (0, 10]
// (LR_STUDY_PACE_WEIGHT was the third; it is gone with the term it priced — see the
//  tombstone in optimizer/deadline.ts.)
// ════════════════════════════════════════════════════════════════════════════════════════
// ── True-score forward arc evaluation (DEFAULT ranker ≥75k; also start selection & repair) ──
// Rank each candidate arc by the TRUE metric score (scoreDriftReport via leafKeyForReport) of
// where it LEADS over a short forward lookahead, instead of the local axis-L2 proxy. Rollouts are
// CHARGED honestly by default (LR_FWD_EVAL_CHARGE=0 refunds them to measure the free ceiling).
// Three variants, selected by LR_FWD_EVAL=<variant>[:depth[:branch]] (full override — also
// switches the adaptive arms OFF) or LR_FWD_EVAL_BASE=<...> (base-shape override that COMPOSES
// with them; see resolveForwardEvalConfig and adaptiveArmsApply). Higher value = better arc;
// rank by -value; the production BASE is DEFAULT_FWD_EVAL_BASE (greedy:1 since 2026-08-04 —
// the old greedy:2 base's defense was measured arms-off and inverted once composed):
//   greedy : single locally-cheapest rollout `depth` contacts deep; value = true score
//            of the resulting partial track. Cheap, directional.
//   best   : branch the top-`branch` candidates `depth` deep; value = MAX true score over
//            the leaves. Optimistic — the best the arc COULD lead to.
//   avg    : at the next contact, value = MEAN true score over the top-`branch`
//            alternatives (1 deep). Expected — robust to the DFS not taking the best.
type ForwardEvalVariant = "greedy" | "best" | "avg";
type ForwardEvalLeaf = "objective" | "full";
type ForwardRolloutShape = {
  variant: ForwardEvalVariant;
  depth: number;
  branch: number;
};
type CandidateForwardPolicy = ForwardRolloutShape & {
  charge: boolean;
  /** Leaf scorer for the rollout terminus. "objective" (DEFAULT, zero engine frames); "full" re-detects the whole
   *  partial track from frame 0 on a fresh engine fork (forwardNodeScore). "objective"
   *  scores the leaf with ZERO engine frames from data the rollout already has
   *  (rolled-gap axis quality × next-gap readiness × missed-step penalty —
   *  objectiveLeafValue). Set by LR_FWD_EVAL_LEAF; "full" is byte-identical. */
  leaf: ForwardEvalLeaf;
  /** First-level-only rollout width: sample this many candidates at the FIRST
   *  rolled contact, continue each with the ordinary shape below (branch
   *  applies unchanged there), take the best. Widens the noisiest layer of the
   *  downstream estimate without surrendering the deeper hops' drift control
   *  (impactBestForwardEvalConfig). Absent/1 = unchanged single-attempt entry. */
  firstBranch?: number;
};
type StartForwardPolicy = ForwardRolloutShape & {
  /** Start selection is always charged; this only selects the rollout terminus scorer. */
  leaf: ForwardEvalLeaf;
};

type ForwardEvalRuntime = {
  spec: Spec | null;
  gapAxisTargets: AxisValues[];
  /** Forward-eval config/gate resolved once per compile. */
  config: CandidateForwardPolicy | null;
  minBudget: number;
  /** Derived from LR_FWD_EVAL; not an accumulator. */
  defaultConfig: boolean;
  /** Study-only agreement telemetry; default off in production ranking. */
  agreementTelemetry: boolean;
  /** De-diluted leaf fold — STUDY ARM, DEFAULT OFF (`LR_LEAF_DEDILUTE=1` enables).
   *  See `dedilutedAxisQuality` for the mechanism and the measured verdict. */
  leafDedilute: boolean;
};

const fwdEvalRuntime: ForwardEvalRuntime = {
  spec: null,
  gapAxisTargets: [],
  config: null,
  minBudget: 0,
  defaultConfig: true,
  agreementTelemetry: false,
  leafDedilute: false,
};
// REJECTED experiment (removed 2026-06-14): widening the rollout branch at
// impact-targeted gaps (LR_FWD_EVAL_IMPACT_BRANCH) to discover dive-scoop pairs.
// VERDICT (2026-06-10, canonical): branch=3 → 551.89, branch=5 → 328.08 vs
// 586.53 baseline. Charged branch^depth rollouts on ~40% of gaps starve the
// search (same failure shape as best:2:3 −12.4). Pair discovery must come from
// generation putting the converting scoop at the TOP of the pool from steep
// arrival states (docs/IMPACT_PAIR_PLANNING.md), not from search breadth. Kept
// at default (branch=1) it was a no-op; the global + parse + hot-path lookup are
// gone — re-derive from this note if the experiment is ever revisited.

// ── The post-completion phase weight (STUDY-ONLY; production value 0) ──
/**
 * How much of the live deadline pressure the HEAD RAMP acts on AFTER first
 * completion. Zero in production, which is the Phase-1a boundary exactly.
 *
 * ## Why the knob exists
 *
 * `deadlineConsumersActive = !telemetry.hasCompletion` is a MODE: all three
 * deadline consumers switch off at first completion, on **57.4% of all pool
 * builds** (48 canonical 750k compiles), in the phase that is by far the MORE
 * pressed one — full pressure fires on **22.70%** of post-completion builds
 * against **1.20%** pre-completion (19x). The architecture's own rule is
 * "throttle a magnitude, never trigger a mode", and this is the one consumer
 * whose response is already continuous, so it is the one that can obey the rule.
 *
 * Scope is deliberate and narrow: the AIM THROTTLE and the CONTINUATION FILTER
 * both stay pre-completion-only, each on its own argument (see the throttle's
 * comment in `rankedOptions` and `onlineContinuationFrontierReady`). The pace
 * term was retired post-completion already, so there is nothing to double-count.
 *
 * ## Why it is a knob and not a change — and what the knob then measured
 *
 * The boundary was DRAWN on a measurement — the ungated bundle read
 * -0.90 +/- 0.34 per cell against -0.39 +/- 0.27 gated, 44 sources x 8 seeds at
 * 750k, so ungating cost -0.51 per cell. That measurement was taken on the
 * since-replaced V1-shaped margin base (~1.9x loose; see `deadline.ts`'s
 * decision section) and BEFORE the 1.2 validity fix that moved the
 * post-completion mean margin 5.76 -> 10.94. By the stale-sweep rule a
 * neighbouring mechanism changed what the constant means, so the verdict was
 * due a re-measure before it could be believed.
 *
 * **RE-MEASURED 2026-08-04 on the corrected margin, same grain (44 canonical
 * sources x 8 seeds x 750k, 352 paired cells per arm, validity 352/352 in every
 * arm) — the boundary SURVIVES, and the old number reproduces almost exactly:**
 *
 *   w = 0.25  +0.004 +/- 0.168   (177/352 cells unchanged)
 *   w = 0.50  -0.201 +/- 0.193   (141/352 unchanged)
 *   w = 1.00  -0.529 +/- 0.188  t = -2.82   (116/352 unchanged)
 *
 * Monotone in w, no positive dose, and the ungated endpoint costs the same
 * -0.51 the boundary was drawn on. THE LOSS IS ENTIRELY THE REPAIR LANE: the
 * same w = 1 restricted to `nonrepair` reads **+0.048 +/- 0.020 (t = +2.37)**.
 * Mechanism, measured on 24 cells with the deadline probe: 93.6% of
 * post-completion pool builds happen inside a repair restart, and 95.8% of
 * post-completion FULL-pressure builds sit in the LAST spend decile — so
 * post-completion "pressure" is overwhelmingly the compile running out of
 * budget, not the compile running behind, and acting on it narrows the rolled
 * head exactly where repair's own ROI wants width.
 *
 * So the production value stays 0 and the knob stays a study arm. What is NOT
 * closed is the `nonrepair` lane: it is only 6.4% of post-completion builds
 * (but 95.7% of them at full pressure), it is a small significant positive at
 * both doses measured (w=0.5 +0.039 +/- 0.014, w=1.0 +0.048 +/- 0.020), and it
 * is far too small to spend an eval slot on alone.
 *
 * `LR_STUDY_POST_DEADLINE_W` is a finite number in [0, 1] and REFUSES anything
 * else rather than clamping; unset/empty is the production constant below.
 * If the arm ever wins, the production candidate is a change to
 * `POST_COMPLETION_DEADLINE_WEIGHT` and nothing else.
 */
const POST_COMPLETION_DEADLINE_WEIGHT = 0;

/**
 * Which post-completion lanes the weight reaches: `all` (default) or
 * `nonrepair`.
 *
 * Repair-phase pool builds go through the SAME `rankedOptions` read — repair
 * restarts drive `runFrontierFrom`, which drives the ordinary `expandNode` —
 * so an unscoped weight narrows the rolled head INSIDE a repair episode, where
 * the repair-ROI study says bigger ceilings buy acceptance. That is a real
 * conflict of mechanisms and not a detail, so the study measures both scopings
 * instead of assuming one. `nonrepair` excludes exactly the builds inside a
 * repair restart (`repairLaneActive`), leaving the post-completion main-search
 * window and the resumed frontier.
 */
type PostCompletionDeadlineScope = "all" | "nonrepair";
const POST_COMPLETION_DEADLINE_SCOPE: PostCompletionDeadlineScope = "all";

const readStudyPostDeadlineW = compileScopedEnv("LR_STUDY_POST_DEADLINE_W");
const readStudyPostDeadlineScope = compileScopedEnv("LR_STUDY_POST_DEADLINE_SCOPE");

function postCompletionDeadlineWeight(): number {
  const raw = readStudyPostDeadlineW();
  if (raw === undefined || raw === "") return POST_COMPLETION_DEADLINE_WEIGHT;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(
      `LR_STUDY_POST_DEADLINE_W must be a finite number in [0, 1] (STUDY-ONLY; never set it ` +
        `in production or in an eval), got "${raw}"`,
    );
  }
  return n;
}

function postCompletionDeadlineScope(): PostCompletionDeadlineScope {
  const raw = readStudyPostDeadlineScope();
  if (raw === undefined || raw === "") return POST_COMPLETION_DEADLINE_SCOPE;
  const value = raw.trim();
  if (value !== "all" && value !== "nonrepair") {
    throw new Error(
      `LR_STUDY_POST_DEADLINE_SCOPE must be "all" or "nonrepair" (STUDY-ONLY; never set it ` +
        `in production or in an eval), got "${raw}"`,
    );
  }
  return value;
}

/**
 * True while a repair restart is driving the frontier (`runFrontierFrom`).
 *
 * Set and cleared around that one call, so it marks exactly the repair-episode
 * pool builds and nothing else. Production reads it only through
 * `postCompletionPhaseWeight`, which returns before the read unless a study
 * weight is set — the flag is otherwise inert, and it is reported on the
 * observation-only deadline probe record so the two scopings can be sized from
 * the same run.
 */
let repairLaneActive = false;
let activeRepairIterationIndex: number | null = null;
let activeRepairAnchorGapIndex: number | null = null;
let activeRepairTargetGapIndex: number | null = null;
let activeRepairTargetGapSse: number | null = null;
let activeRepairBreadthRatio = 1;

const readRepairSuffixSearchPolicy = compileScopedEnv("LR_REPAIR_SUFFIX_SEARCH_POLICY");
let repairTargetSearchTotals: RepairTargetSearchTotals = emptyRepairTargetSearchTotals("ordinary");

registerCompileReset(() => {
  repairLaneActive = false;
  activeRepairIterationIndex = null;
  activeRepairAnchorGapIndex = null;
  activeRepairTargetGapIndex = null;
  activeRepairTargetGapSse = null;
  activeRepairBreadthRatio = 1;
  repairTargetSearchTotals = emptyRepairTargetSearchTotals("ordinary");
});

function emptyRepairTargetSearchTotals(
  policy: RepairSuffixSearchPolicy,
): RepairTargetSearchTotals {
  return {
    policy,
    targetPools: 0,
    eligibleOptions: 0,
    ordinarySelectedOptions: 0,
    alreadyFirst: 0,
    reordered: 0,
    promotedFromOutsideTopThree: 0,
    ordinaryFirstImprovesIncumbent: 0,
    ordinaryFirstNotImproving: 0,
    improvingAlternativeAvailable: 0,
    ordinaryFirstSseSum: 0,
    chosenFirstSseSum: 0,
    localSseGainSum: 0,
    forwardScoreDebtSum: 0,
  };
}

export function repairSuffixSearchPolicy(): RepairSuffixSearchPolicy {
  const raw = readRepairSuffixSearchPolicy();
  if (raw === undefined || raw === "" || raw === "ordinary") return "ordinary";
  if (raw === "target-top-three-first") return "target_top_three_first";
  if (raw === "target-improvement-first") return "target_improvement_first";
  if (raw === "target-eligible-first") return "target_eligible_first";
  throw new Error(
    `LR_REPAIR_SUFFIX_SEARCH_POLICY must be ordinary, target-top-three-first, ` +
      `target-improvement-first, or target-eligible-first; got "${raw}"`,
  );
}

/**
 * Reorder one already-evaluated branch population at the selected repair target.
 * No candidate is generated and branch width is unchanged.  The conservative law
 * chooses among the ordinary top three; the improvement-gated law does so only
 * when ordinary branch zero fails to improve the incumbent target and another
 * selected branch does; the broader law may promote one option from the full
 * eligible set and then retains the other ordinary branches.
 */
export function prioritizeRepairTargetOptions<T>(
  selected: readonly T[],
  eligible: readonly T[],
  policy: RepairSuffixSearchPolicy,
  localSse: (option: T) => number | null,
  incumbentSse: number | null = null,
): {
  options: T[];
  chosenSse: number | null;
  ordinaryFirstSse: number | null;
  promoted: boolean;
  ordinaryFirstImprovesIncumbent: boolean;
  improvingAlternativeAvailable: boolean;
} {
  const ordinary = [...selected];
  const ordinaryFirstSse = ordinary.length === 0 ? null : localSse(ordinary[0]!);
  const ordinaryFirstImprovesIncumbent = incumbentSse !== null &&
    Number.isFinite(incumbentSse) && ordinaryFirstSse !== null &&
    Number.isFinite(ordinaryFirstSse) && ordinaryFirstSse < incumbentSse;
  const improvementCandidates = incumbentSse === null || !Number.isFinite(incumbentSse)
    ? []
    : ordinary.flatMap((option, index) => {
      const sse = localSse(option);
      return sse !== null && Number.isFinite(sse) && sse < incumbentSse
        ? [{ option, index, sse }]
        : [];
    });
  const improvingAlternativeAvailable = improvementCandidates.some(({ index }) => index > 0);
  const unchanged = () => ({
    options: ordinary,
    chosenSse: ordinaryFirstSse,
    ordinaryFirstSse,
    promoted: false,
    ordinaryFirstImprovesIncumbent,
    improvingAlternativeAvailable,
  });
  if (policy === "ordinary" || ordinary.length === 0) {
    return unchanged();
  }
  if (policy === "target_improvement_first" && ordinaryFirstImprovesIncumbent) {
    return unchanged();
  }
  const ranked = (policy === "target_improvement_first"
    ? improvementCandidates
    : (policy === "target_top_three_first" ? ordinary : [...eligible]).flatMap((option, index) => {
      const sse = localSse(option);
      return sse === null || !Number.isFinite(sse) ? [] : [{ option, index, sse }];
    }))
    .sort((a, b) => a.sse - b.sse || a.index - b.index);
  const best = ranked[0];
  if (best === undefined) {
    return unchanged();
  }
  const promoted = !ordinary.includes(best.option);
  return {
    options: [best.option, ...ordinary.filter((option) => option !== best.option)]
      .slice(0, ordinary.length),
    chosenSse: best.sse,
    ordinaryFirstSse,
    promoted,
    ordinaryFirstImprovesIncumbent,
    improvingAlternativeAvailable,
  };
}

function repairOptionGapSse(
  option: RankedOption,
  gap: Gap,
  ctx: SpecContext,
): number | null {
  if (option.candidate === null) return null;
  const errors = axisErrorsForTargets(
    ctx.gapAxisTargets?.[gap.index] ?? gap.targets,
    settledIncomingAxes(option.candidate),
  ).filter(Number.isFinite);
  return errors.length === 0 ? null : errors.reduce((sum, error) => sum + error * error, 0);
}

function applyRepairTargetSearchPolicy(
  selected: RankedOption[],
  eligible: RankedOption[],
  gap: Gap,
  ctx: SpecContext,
): RankedOption[] {
  const policy = repairTargetSearchTotals.policy;
  if (
    policy === "ordinary" || !repairLaneActive ||
    activeRepairTargetGapIndex === null || gap.index !== activeRepairTargetGapIndex
  ) return selected;
  const result = prioritizeRepairTargetOptions(
    selected,
    eligible,
    policy,
    (option) => repairOptionGapSse(option, gap, ctx),
    activeRepairTargetGapSse,
  );
  repairTargetSearchTotals.targetPools++;
  repairTargetSearchTotals.eligibleOptions += eligible.length;
  repairTargetSearchTotals.ordinarySelectedOptions += selected.length;
  if (result.ordinaryFirstImprovesIncumbent) {
    repairTargetSearchTotals.ordinaryFirstImprovesIncumbent++;
  } else {
    repairTargetSearchTotals.ordinaryFirstNotImproving++;
  }
  if (result.improvingAlternativeAvailable) {
    repairTargetSearchTotals.improvingAlternativeAvailable++;
  }
  if (result.ordinaryFirstSse !== null) {
    repairTargetSearchTotals.ordinaryFirstSseSum += result.ordinaryFirstSse;
  }
  if (result.chosenSse !== null) {
    repairTargetSearchTotals.chosenFirstSseSum += result.chosenSse;
  }
  const ordinaryFirst = selected[0];
  const chosen = result.options[0];
  if (ordinaryFirst === chosen) {
    repairTargetSearchTotals.alreadyFirst++;
  } else if (ordinaryFirst !== undefined && chosen !== undefined) {
    repairTargetSearchTotals.reordered++;
    if (result.promoted) repairTargetSearchTotals.promotedFromOutsideTopThree++;
    if (result.ordinaryFirstSse !== null && result.chosenSse !== null) {
      repairTargetSearchTotals.localSseGainSum += result.ordinaryFirstSse - result.chosenSse;
    }
    repairTargetSearchTotals.forwardScoreDebtSum += Math.max(0, chosen.score - ordinaryFirst.score);
  }
  return result.options;
}

function snapshotRepairTargetSearchStats(): Pick<CompileStats, "repair_target_search"> | Record<string, never> {
  const totals = repairTargetSearchTotals;
  if (totals.policy === "ordinary") return {};
  return {
    repair_target_search: {
      policy: totals.policy,
      target_pools: totals.targetPools,
      eligible_options: totals.eligibleOptions,
      ordinary_selected_options: totals.ordinarySelectedOptions,
      already_first: totals.alreadyFirst,
      reordered: totals.reordered,
      promoted_from_outside_top_three: totals.promotedFromOutsideTopThree,
      ordinary_first_improves_incumbent: totals.ordinaryFirstImprovesIncumbent,
      ordinary_first_not_improving: totals.ordinaryFirstNotImproving,
      improving_alternative_available: totals.improvingAlternativeAvailable,
      ordinary_first_sse_sum: totals.ordinaryFirstSseSum,
      chosen_first_sse_sum: totals.chosenFirstSseSum,
      local_sse_gain_sum: totals.localSseGainSum,
      forward_score_debt_sum: totals.forwardScoreDebtSum,
    },
  };
}

/**
 * The head ramp's post-completion phase weight at THIS pool build.
 *
 * Production returns 0 on the first line, so the ramp reads exactly the
 * pre-completion-only pressure it reads today and the scope knob is never even
 * consulted. Exported for the tests that pin the refusal paths.
 */
export function postCompletionPhaseWeight(): number {
  const weight = postCompletionDeadlineWeight();
  if (weight <= 0) return 0;
  if (postCompletionDeadlineScope() === "all") return weight;
  return repairLaneActive ? 0 : weight;
}

// ── Deadline-signal instrument (MEASURE-ONLY) ──
// The mechanism had no production telemetry: no archive could say how often the
// head-narrowing ramp engages, or what margin the compile was actually running
// at. Counted at the ONE place the ramp is read (`rankedOptions`), from the two
// values that read has already computed — a pure read, no extra work, no
// decision. Split at the Phase-1a boundary because the two populations answer
// different questions: PRE-completion is the decision-weighted population the
// ramp's 1.25/2.0 anchors were derived on and must be re-bracketed against,
// POST-completion is the ~46% of a 750k budget the consumers are currently
// held off, and the margin there is what a post-completion consumer would see.
//
// Builds whose caller passed no margin at all (the non-policy lanes read
// Infinity) are in `deadline_pool_builds` and in neither phase, so
// `ranked_option_calls - pre_builds - post_builds` is the unpaced remainder.
const deadlineTotals = {
  deadline_pool_builds: 0,
  deadline_pre_builds: 0,
  deadline_pre_pressured: 0,
  deadline_pre_full_pressure: 0,
  deadline_pre_margin_sum: 0,
  /** Smallest margin seen; `Infinity` until one is, nulled by the snapshot. */
  deadline_pre_margin_min: Infinity,
  deadline_post_builds: 0,
  /** The PRE twins' counterfactual on the post side: how often the ramp WOULD have
   *  engaged / saturated there. The phase gate (`deadlineConsumersActive`) forces the
   *  live pressure to 0 after first completion, so the post arm's pressure was
   *  unmeasurable from production archives — `deadline_post_margin_sum/min` gave the
   *  level but never the frequency, and the frequency is what a post-completion
   *  consumer's case rests on. Recomputed from the margin this build already read
   *  (one clamped-linear ramp evaluation; no decision reads it). */
  deadline_post_pressured: 0,
  deadline_post_full_pressure: 0,
  deadline_post_margin_sum: 0,
  deadline_post_margin_min: Infinity,
};

function resetDeadlineStats(): void {
  deadlineTotals.deadline_pool_builds = 0;
  deadlineTotals.deadline_pre_builds = 0;
  deadlineTotals.deadline_pre_pressured = 0;
  deadlineTotals.deadline_pre_full_pressure = 0;
  deadlineTotals.deadline_pre_margin_sum = 0;
  deadlineTotals.deadline_pre_margin_min = Infinity;
  deadlineTotals.deadline_post_builds = 0;
  deadlineTotals.deadline_post_pressured = 0;
  deadlineTotals.deadline_post_full_pressure = 0;
  deadlineTotals.deadline_post_margin_sum = 0;
  deadlineTotals.deadline_post_margin_min = Infinity;
}
registerCompileReset(resetDeadlineStats);

/** Count one pool build against the ramp. `margin` and `pressure` are the two
 *  values `rankedOptions` just computed for its own decision; the only thing this
 *  adds is the post-phase counterfactual pressure, which the caller cannot have
 *  computed because the phase gate zeroes its `pressure` — and nothing here is
 *  read back by the search. */
function recordDeadlinePoolBuild(
  margin: number,
  pressure: number,
  consumersActive: boolean,
): void {
  deadlineTotals.deadline_pool_builds++;
  if (!Number.isFinite(margin)) return;
  if (consumersActive) {
    deadlineTotals.deadline_pre_builds++;
    if (pressure > 0) deadlineTotals.deadline_pre_pressured++;
    if (pressure >= 1) deadlineTotals.deadline_pre_full_pressure++;
    deadlineTotals.deadline_pre_margin_sum += margin;
    if (margin < deadlineTotals.deadline_pre_margin_min) {
      deadlineTotals.deadline_pre_margin_min = margin;
    }
  } else {
    // `pressure` is 0 here BY THE PHASE GATE, not by the margin, so the twin
    // counters read the ramp directly. Same function, same anchors as the pre
    // side, so the two phases' rates are comparable numbers. Under the
    // phase-weight study arm the caller's `pressure` is no longer 0 here, but
    // these counters deliberately keep reading the UNWEIGHTED ramp: they answer
    // "how pressed was this build", which must stay the same question across
    // arms for the arms to be comparable.
    const wouldPressure = deadlinePressure(margin);
    deadlineTotals.deadline_post_builds++;
    if (wouldPressure > 0) deadlineTotals.deadline_post_pressured++;
    if (wouldPressure >= 1) deadlineTotals.deadline_post_full_pressure++;
    deadlineTotals.deadline_post_margin_sum += margin;
    if (margin < deadlineTotals.deadline_post_margin_min) {
      deadlineTotals.deadline_post_margin_min = margin;
    }
  }
}

/** JSON-safe read of the ramp counters: the two minima are null until a finite
 *  margin has been observed in that phase, so an archive never carries an
 *  `Infinity` that `JSON.stringify` would have silently turned into a null of
 *  unknown meaning. Means are `*_margin_sum / *_builds` at aggregation. */
export function readDeadlinePoolCounters(): {
  deadline_pool_builds: number;
  deadline_pre_builds: number;
  deadline_pre_pressured: number;
  deadline_pre_full_pressure: number;
  deadline_pre_margin_sum: number;
  deadline_pre_margin_min: number | null;
  deadline_post_builds: number;
  deadline_post_pressured: number;
  deadline_post_full_pressure: number;
  deadline_post_margin_sum: number;
  deadline_post_margin_min: number | null;
} {
  return {
    ...deadlineTotals,
    deadline_pre_margin_min: deadlineTotals.deadline_pre_builds > 0
      ? deadlineTotals.deadline_pre_margin_min
      : null,
    deadline_post_margin_min: deadlineTotals.deadline_post_builds > 0
      ? deadlineTotals.deadline_post_margin_min
      : null,
  };
}

// ── Forward-eval cost + agreement instrument (MEASURE-ONLY) ──
// Accumulates per compile, reset alongside the other lane stats. Two families:
//   cost: rollout sim-frames charged + call counts (how big a frame sink fwd-eval is).
//   agreement: study-only, enabled by LR_FWD_EVAL_AGREEMENT=1. Over POOL-SOURCE
//   candidates only (reuse/brake excluded), records whether the true charged rollout
//   (forward winner = min score) agrees with the quality-objective rank.
const fwdEvalTotals = {
  fwd_eval_frames_charged: 0,
  fwd_eval_calls: 0,
  start_eval_frames_charged: 0,
  // Rollout dead-ends (both leaf modes): the recursion hit a node with zero ranked
  // candidates and terminated the rollout early. In objective mode these carry the
  // explicit missing-step penalty; counted here regardless of mode.
  fwd_rollout_no_candidate: 0,
  /** Re-draws on empty (HANDOFF_ROLLOUT_REDRAW_ON_EMPTY): first rolled contacts
   *  that expanded to nothing at the shape's own width, and the subset the extra
   *  draw refuted. `redraws - refuted` is what still lands as a dead-end verdict,
   *  so the pair reads directly against `fwd_rollout_no_candidate`. */
  fwd_rollout_redraws: 0,
  fwd_rollout_redraw_refuted: 0,
  /** Study arm: the same one-extra-draw existence correction at hop 2+.
   * Separate from the production hop-1 law so its footprint is auditable. */
  fwd_rollout_later_redraws: 0,
  fwd_rollout_later_redraw_refuted: 0,
  fwd_pools: 0,
  fwd_top1_agree: 0,
  fwd_rank_of_quality_top1_sum: 0,
  fwd_quality_rank_of_winner_sum: 0,
  fwd_disagree_value_gap_sum: 0,
  fwd_disagree_count: 0,
  fwd_winner_aimed: 0,
  fwd_pools_with_aimed: 0,
  fwd_aimed_best_rank_sum: 0,
  // Disagreement characterization (only incremented when top-1 disagrees).
  fwd_disagree_impact_targeted: 0,
  fwd_disagree_not_impact_targeted: 0,
  fwd_agree_impact_targeted: 0,
  fwd_agree_not_impact_targeted: 0,
  fwd_disagree_winner_aimed_q1_not: 0,
  fwd_disagree_q1_aimed_winner_not: 0,
  fwd_disagree_winner_costlier: 0,
  fwd_disagree_winner_cheaper: 0,
};

function resetFwdEvalStats(): void {
  for (const key of Object.keys(fwdEvalTotals) as (keyof typeof fwdEvalTotals)[]) {
    const cur = fwdEvalTotals[key];
    if (Array.isArray(cur)) {
      cur.fill(0);
    } else {
      (fwdEvalTotals as unknown as Record<string, number>)[key] = 0;
    }
  }
}
registerCompileReset(resetFwdEvalStats);

// Derived from fwdEvalTotals so the two never drift: adding a counter above automatically
// extends the public stats shape. (Previously a hand-maintained ~60-field mirror.)
export type FwdEvalStats = typeof fwdEvalTotals;

/** Snapshot for compile stats; null when forward-eval never ran (gate off / sub-gate
 *  budget never sampled it) so ablation archives carry no fwd_eval key at all. */
function snapshotFwdEvalStats(): FwdEvalStats | null {
  if (fwdEvalTotals.fwd_eval_calls === 0 && fwdEvalTotals.start_eval_frames_charged === 0) {
    return null;
  }
  return { ...fwdEvalTotals };
}

/** Unconditional read of the same counters, for a probe or test observing ONE
 *  mechanism outside a compile — the case the archive snapshot's null gate is
 *  designed to exclude. */
export function readFwdEvalCounters(): FwdEvalStats {
  return { ...fwdEvalTotals };
}

/** Pure read over the POOL-SOURCE scored entries of one freshly-built pool: records the
 *  agreement of the true forward rollout (winner = min score) with the quality-objective
 *  rank (.rank, 0-based for source "pool"). No extra rollouts — scores are already computed
 *  (score = -forwardValue). Only call when the forward-eval path scored the pool. */
function recordFwdEvalAgreement(
  poolScored: RankedOption[],
  impactTarget: number | undefined,
): void {
  if (poolScored.length === 0) return;
  // Forward winner = min score (score = -value, so min score = max value).
  let winner = poolScored[0];
  for (let i = 1; i < poolScored.length; i++) {
    if (poolScored[i].score < winner.score) winner = poolScored[i];
  }
  // Quality #1 = the rank-0 pool entry (pool was built in quality order).
  let qualityTop1 = poolScored[0];
  for (let i = 1; i < poolScored.length; i++) {
    if (poolScored[i].rank < qualityTop1.rank) qualityTop1 = poolScored[i];
  }
  fwdEvalTotals.fwd_pools++;
  // Top1 agreement: forward winner IS the quality-#1 object (identical object ⇒ tie counts).
  const agree = winner === qualityTop1;
  if (agree) fwdEvalTotals.fwd_top1_agree++;
  // Forward-rank of quality-#1 = how many entries have a strictly-better forward score.
  let fwdRankOfQualityTop1 = 0;
  for (const o of poolScored) {
    if (o.score < qualityTop1.score) fwdRankOfQualityTop1++;
  }
  fwdEvalTotals.fwd_rank_of_quality_top1_sum += fwdRankOfQualityTop1;
  // Quality-rank of the forward winner.
  fwdEvalTotals.fwd_quality_rank_of_winner_sum += winner.rank;
  // Impact-targeted classification (per-pool gap target), split by agree/disagree.
  // Telemetry-only; split at the objective ramp midpoint so the classifier can't
  // drift back to the old stray inline 0.35.
  const impactTargeted = impactTarget !== undefined &&
    impactTarget >= IMPACT_TARGETED_ASK;
  if (agree) {
    if (impactTargeted) fwdEvalTotals.fwd_agree_impact_targeted++;
    else fwdEvalTotals.fwd_agree_not_impact_targeted++;
  } else {
    if (impactTargeted) fwdEvalTotals.fwd_disagree_impact_targeted++;
    else fwdEvalTotals.fwd_disagree_not_impact_targeted++;
  }
  if (!agree) {
    // value(winner) - value(qualityTop1) = (-winner.score) - (-qualityTop1.score).
    const valueGap = (qualityTop1.score - winner.score);
    fwdEvalTotals.fwd_disagree_value_gap_sum += valueGap;
    fwdEvalTotals.fwd_disagree_count++;
    // Aimed-asymmetry of the disagreement.
    const winnerAimed = winner.candidate?.aimed === true;
    const q1Aimed = qualityTop1.candidate?.aimed === true;
    if (winnerAimed && !q1Aimed) fwdEvalTotals.fwd_disagree_winner_aimed_q1_not++;
    if (q1Aimed && !winnerAimed) fwdEvalTotals.fwd_disagree_q1_aimed_winner_not++;
    // Local-cost sign of the disagreement (does the rollout pick arcs cost dislikes?).
    const winnerCost = winner.candidate?.cost ?? Infinity;
    const q1Cost = qualityTop1.candidate?.cost ?? Infinity;
    if (winnerCost > q1Cost) fwdEvalTotals.fwd_disagree_winner_costlier++;
    else if (winnerCost < q1Cost) fwdEvalTotals.fwd_disagree_winner_cheaper++;
  }
  if (winner.candidate?.aimed === true) fwdEvalTotals.fwd_winner_aimed++;
  // Aimed-presence + best forward-rank among aimed entries (0-based forward rank).
  let bestAimedFwdRank = Infinity;
  for (const o of poolScored) {
    if (o.candidate?.aimed !== true) continue;
    let r = 0;
    for (const p of poolScored) {
      if (p.score < o.score) r++;
    }
    if (r < bestAimedFwdRank) bestAimedFwdRank = r;
  }
  if (bestAimedFwdRank !== Infinity) {
    fwdEvalTotals.fwd_pools_with_aimed++;
    fwdEvalTotals.fwd_aimed_best_rank_sum += bestAimedFwdRank;
  }
}
export function setForwardEvalContext(spec: Spec, gapAxisTargets: AxisValues[]): void {
  const resolved = resolveForwardEvalConfig();
  fwdEvalRuntime.spec = spec;
  fwdEvalRuntime.gapAxisTargets = gapAxisTargets;
  fwdEvalRuntime.config = resolved.config;
  fwdEvalRuntime.defaultConfig = resolved.defaultConfig;
  fwdEvalRuntime.minBudget = forwardEvalMinBudget();
  fwdEvalRuntime.agreementTelemetry = readEnv("LR_FWD_EVAL_AGREEMENT") === "1";
  // De-diluted leaf fold: DEFAULT OFF (measured negative — see dedilutedAxisQuality).
  // `LR_LEAF_DEDILUTE=1` is the study arm. Resolved once per compile, not per leaf.
  fwdEvalRuntime.leafDedilute = readEnv("LR_LEAF_DEDILUTE") === "1";
}

/** Warn (once-per-call, stderr) when a study/control env spec was set to a
 * non-empty value that could not be parsed. Pure diagnostic; does not change
 * behavior beyond falling back to that knob's default. */
function warnUnparsedSpec(
  varName: string,
  raw: string,
  expected = "<greedy|best|avg>[:depth[:branch]]",
): void {
  const log = (globalThis as { console?: { warn?: (msg: string) => void } }).console?.warn;
  if (log) {
    log(`[handoff] ${varName}="${raw}" is not a recognized ${expected} spec; using the knob default.`);
  }
}

/** The two shape knobs are not additive and the precedence must be visible: an
 *  arm that thinks it composed with the adaptive layer but did not is exactly
 *  the confound this whole knob exists to remove. */
function warnBaseOverrideIgnored(baseRaw: string, fullRaw: string): void {
  const log = (globalThis as { console?: { warn?: (msg: string) => void } }).console?.warn;
  if (log) {
    log(
      `[handoff] LR_FWD_EVAL_BASE="${baseRaw}" is IGNORED because LR_FWD_EVAL="${fullRaw}" is set: ` +
        "the full override pins the shape AND switches the adaptive arms off. " +
        "Unset LR_FWD_EVAL to compose.",
    );
  }
}

function readEnv(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.[name];
}

/** Track-repair config (worst-gap suffix rebuild, see docs/archive/TRACK_REPAIR_EXPERIMENTS.md).
 *  Completion-triggered: the main search runs to the
 *  first complete track, then the rest of the budget is spent restarting the real frontier-DFS
 *  (fresh seed) from the weakest AFFORDABLE gap of the incumbent, rebuilding the suffix to a
 *  complete track accepted iff it beats the incumbent. Honest (sims charged), gated to high budget
 *  (completion is DFS's job at low budget → <100k byte-identical; repair RUNS at exactly 100k), deterministic per (spec,seed,budget). */
type RepairConfig = {
  minBudget: number;
  mainMargin: number;
  maxAttempts: number;
  maxParentDepth: number;
  headroomFraction: number;
  selectionPolicy: RepairSelectionPolicy;
  lateSelectionPolicy: RepairSelectionPolicy | null;
  /** One narrower suffix after ordinary full-width affordability is exhausted. */
  lastChanceThreeQuarter: boolean;
  suffixSearchPolicy: RepairSuffixSearchPolicy;
  rejectedLocalImprovementBridge:
    | "disabled"
    | "protected_one_step"
    | "optimistic_axis_quality_bound";
};
/** Repair takes over at the first completion, not after a margin past it.
 *  Bracketed N=8 against `scarce-lean`: 1.0 +0.28 (SE 0.14), 1.1 shipped,
 *  1.25 -0.52 (SE 0.15). At 1.0 the five profile-band carve-outs that used to
 *  force this value back down (M101 flat-compact, M102 high-air-low-grain,
 *  M108 drums-pulse, M116 stable-dense, M144 residual) are all no-ops, so they
 *  and their profile predicates are gone with them. */
const REPAIR_MAIN_MARGIN = 1.0;

/** Resolve a declared phase-isolation study without obscuring the replayable
 * selection law recorded for each repair decision. Production has no late
 * override; the study preserves iterations zero and one exactly. */
export function repairSelectionPolicyForIteration(
  selectionPolicy: RepairSelectionPolicy,
  lateSelectionPolicy: RepairSelectionPolicy | null,
  iterationIndex: number,
): RepairSelectionPolicy {
  return lateSelectionPolicy !== null && iterationIndex >= 2
    ? lateSelectionPolicy
    : selectionPolicy;
}

/** A single repair policy: worst affordable target, then its deepest affordable
 * parent up to one declared cap. Environment overrides declare diagnostic arms;
 * they are not hidden execution fallback modes. */
function repairConfig(): RepairConfig {
  const num = (name: string, def: number, lo: number, hi: number): number => {
    const n = Number.parseInt(readEnv(name) ?? "", 10);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
  };
  const flt = (name: string, def: number, lo: number, hi: number): number => {
    const n = Number.parseFloat(readEnv(name) ?? "");
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
  };
  const repairSelectionPolicy = readEnv("LR_REPAIR_SELECTION_POLICY");
  return {
    // Gate: below this, completion is the hard part (DFS's job) and the carve starves it.
    // Lowered 150k→100k (2026-06-07): on the 30-spec board all specs already complete at
    // 100k (validity 100%), so repair there improves QUALITY rather than stealing from
    // completion — canonical decide +3.0 at 100k, Δ+0.6 headline, ACCEPT. Below 100k
    // completion is still the binding constraint, so the gate stays.
    minBudget: num("LR_REPAIR_MIN_BUDGET", 100_000, 0, 100_000_000),
    // Completion-triggered split: run the main search to firstCompletion*mainMargin, then repair.
    // Flat 1.0 — repair takes over AT the first completion. (An earlier comment here
    // described a 1.0→1.1 ease by 200k; no such ramp has existed since the value went flat.)
    mainMargin: flt("LR_REPAIR_MAIN_MARGIN", REPAIR_MAIN_MARGIN, 1.0, 10.0),
    // Cap on repair restarts. NEVER BINDING as shipped: the max observed attempt count is 17
    // across 3,696 archived compiles, and raising 64 → 160 is byte-identical. It is a runaway
    // guard, not a tuned knob — do not re-sweep it as if it allocated anything. (The
    // "1M affords ~30-40 restarts" note it used to carry was a projection, not a measurement.)
    maxAttempts: num("LR_REPAIR_MAX_ATTEMPTS", 64, 1, 1000),
    // One independent decision chooses the deepest affordable parent up to
    // this cap. Six is the accepted scale operating point: it extends the
    // high-value early suffixes while affordability still protects budgets
    // that cannot fund them, without restoring a fallback walk or tried state.
    maxParentDepth: num("LR_REPAIR_MAX_PARENT_DEPTH", 6, 0, 64),
    // The estimator's upper interval is already the local execution ceiling;
    // retain no second hidden reserve in target/anchor eligibility.
    headroomFraction: flt("LR_REPAIR_HEADROOM_FRACTION", 0, 0, 0.95),
    selectionPolicy: repairSelectionPolicy === "reserve-cheapest-repair"
      ? "worst_gap_reserve_cheapest_repair"
      : repairSelectionPolicy === "reserve-cheapest-else-deepest"
        ? "worst_gap_reserve_cheapest_else_deepest"
        : repairSelectionPolicy === "worst-target-runway-per-cost"
          ? "worst_gap_runway_opportunity_per_cost"
          : repairSelectionPolicy === "worst-target-window-per-cost"
            ? "worst_gap_window_opportunity_per_cost"
            : repairSelectionPolicy === "suffix-opportunity-per-cost"
              ? "suffix_opportunity_per_cost"
              : repairSelectionPolicy === "max-suffix-opportunity"
                ? "max_suffix_opportunity"
                : repairSelectionPolicy === "max-local-window-opportunity"
                  ? "max_local_window_opportunity"
                  : "worst_gap_deepest_affordable",
    // Study-only phase isolation: retain production selection for the two
    // high-return repairs, then reserve the cheapest further repair. The
    // effective replayable law, not this wrapper name, is recorded per episode.
    lateSelectionPolicy: repairSelectionPolicy === "late-reserve-cheapest-else-deepest"
      ? "worst_gap_reserve_cheapest_else_deepest"
      : null,
    // Accepted scale fallback: after full-width affordability is exhausted,
    // spend otherwise-low-yield residue on one conservatively priced narrow
    // suffix. Other explicit selector studies retain their original isolated
    // behavior; the named value keeps the accepted arm replayable.
    lastChanceThreeQuarter: repairSelectionPolicy === "three-quarter-last-chance" ||
      (repairSelectionPolicy === undefined &&
        (readEnv("LR_STUDY_NCAND_POLICY") ?? "") === ""),
    suffixSearchPolicy: repairSuffixSearchPolicy(),
    // Study-only protected bridge. It may spend one follow-up from a rejected
    // terminal that improved its selected target; it never changes the global
    // acceptance rule or promotes the working track by local quality alone.
    rejectedLocalImprovementBridge:
      readEnv("LR_REPAIR_REJECTED_LOCAL_BRIDGE") === "optimistic-axis-bound"
        ? "optimistic_axis_quality_bound"
        : readEnv("LR_REPAIR_REJECTED_LOCAL_BRIDGE") === "1"
          ? "protected_one_step"
          : "disabled",
  };
}

/** Budget-aware hard gate: forward eval only activates at/above this compile budget.
 *  DEFAULT 75000 — charged forward eval pays for itself only at high budget, and below
 *  this the cheap local ranker wins. Override with LR_FWD_EVAL_MIN_BUDGET; 0 = always on. */
function forwardEvalMinBudget(): number {
  const raw = readEnv("LR_FWD_EVAL_MIN_BUDGET");
  if (raw === undefined) return 75_000;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 75_000;
}

/** Candidate ranker. DEFAULT base greedy:1 (true forward-rollout score, one contact hop;
 *  see DEFAULT_FWD_EVAL_BASE for the measurement and the confound history).
 *  LR_FWD_EVAL=off|0 reverts to the local axis-L2 proxy; LR_FWD_EVAL=<greedy|best|avg>[:depth[:branch]]
 *  selects a rollout shape. Charged honestly by default (see forwardArcValue /
 *  LR_FWD_EVAL_CHARGE). */
/** Parse a policy-neutral `<greedy|best|avg>[:depth[:branch]]` rollout shape. */
function parseRolloutShape(raw: string): ForwardRolloutShape | null {
  const [v, d, b] = raw.split(":");
  if (v !== "greedy" && v !== "best" && v !== "avg") return null;
  const depth = d ? Math.max(1, Math.min(6, Number.parseInt(d, 10) || 2)) : 2;
  const defBranch = v === "avg" ? 6 : v === "best" ? 3 : 1;
  const branch = b ? Math.max(1, Math.min(8, Number.parseInt(b, 10) || defBranch)) : defBranch;
  return { variant: v, depth, branch };
}

/** Leaf scorer for the rollout terminus. DEFAULT "objective" (zero engine frames); "full" is the explicit escape hatch.
 *  LR_FWD_EVAL_LEAF=objective scores the leaf with zero engine frames (objectiveLeafValue).
 *  Parsed as a SEPARATE var from LR_FWD_EVAL so fwdEvalRuntime.defaultConfig / the mature-avg
 *  upgrade stay untouched (an objective-leaf greedy:2 is still the "default config"). */
function forwardEvalLeaf(): ForwardEvalLeaf {
  const env = readEnv("LR_FWD_EVAL_LEAF");
  // DEFAULT: the short (objective) leaf — faithful scorer reconstruction (gap-window axis ×
  // survival × missing), ~21% cheaper per rollout, and ACCEPT vs the full leaf on the all-specs
  // board (+1.72, 40 specs × 12 seeds, P(Δ≤0)=0%). "full" is the explicit escape hatch.
  if (env === "full") return "full";
  return "objective";
}

/** Spread stat as a spreadable object so an absent snapshot adds no key. */
function objectiveLayerSpreadStat(): { objective_layer_spread?: NonNullable<ReturnType<typeof snapshotObjectiveLayerSpread>> } {
  const spread = snapshotObjectiveLayerSpread();
  return spread === null ? {} : { objective_layer_spread: spread };
}

/** TWO shape knobs, and the difference between them is the adaptive layer.
 *
 *  `LR_FWD_EVAL=<shape>` is the FULL override and its semantics are unchanged:
 *  it pins one rollout shape for the whole compile and sets
 *  `defaultConfig = false`, which switches every adaptive arm off
 *  (`adaptiveArmsApply`). That is deliberate — an arm that silently replaces the
 *  shape you asked for makes the study arm unreadable — but it also means no
 *  base-shape arm could ever be measured WITH the adaptive arms live, and the
 *  arms are not small (the impact widening alone is 62.8% of rollout frames at
 *  750k and is worth +4.59 ± 2.20).
 *
 *  `LR_FWD_EVAL_BASE=<shape>` is the COMPOSABLE override: it moves the compile's
 *  BASE rollout shape and leaves the adaptive layer exactly as it is. The arms
 *  keep owning the gaps they own and run the shapes they run there; the base
 *  moves on every other gap. Only consulted when `LR_FWD_EVAL` is unset — the
 *  full override wins and says so.
 *
 *  An unparsed `LR_FWD_EVAL_BASE` falls back to the knob default
 *  (`DEFAULT_FWD_EVAL_BASE`) with a warning rather than disabling forward eval:
 *  a typo in a *base* knob must not silently turn the ranker off, which is what
 *  the `LR_FWD_EVAL` typo path does (kept, for compatibility with every study
 *  that relies on it). */
/**
 * The production BASE rollout shape: one contact hop, single sample, true-score
 * leaf. The adaptive arms are untouched — the impact widening still runs its own
 * `greedy:2:1+fb3` on the gaps it owns (`adaptiveArmsApply`).
 *
 * greedy:2 shipped as the base from the ranker's promotion until 2026-08-04,
 * defended by the §7 arm `LR_FWD_EVAL=greedy:1` = −11.36 @250k / −3.84 @750k
 * (docs/rollout-economics-study.md). That measurement carried a confound the
 * flag itself created: any `LR_FWD_EVAL` value switches the adaptive arms OFF,
 * so "greedy:1" was really "greedy:1 with the +4.59 impact widening removed".
 * Measured COMPOSED via `LR_FWD_EVAL_BASE` (arms live) on the six-source panel,
 * the sign inverts and holds at every budget: +5.50±2.44 @250k, +12.53±4.14
 * (t=3.02, 15/18 cells, all strata positive) @750k, +3.59±4.01 @2.5M — while
 * SPENDING fewer rollout frames (−0.22M @750k). The second hop was priced, not
 * assumed: it bought nothing the impact arm's own depth-2 shape doesn't already
 * buy on the gaps where depth matters. Promoted at N=48 (see the campaign plan,
 * docs/forward-eval-value-plan.md Phase 5).
 */
const DEFAULT_FWD_EVAL_BASE = "greedy:1";

function resolveForwardEvalConfig(): { config: CandidateForwardPolicy | null; defaultConfig: boolean } {
  const env = readEnv("LR_FWD_EVAL");
  const defaultConfig = env === undefined || env === "";
  if (env === "0" || env === "off") return { config: null, defaultConfig };
  let shape: ForwardRolloutShape | null;
  if (defaultConfig) {
    const baseEnv = readEnv("LR_FWD_EVAL_BASE");
    const overridden = baseEnv !== undefined && baseEnv !== "";
    shape = overridden ? parseRolloutShape(baseEnv as string) : parseRolloutShape(DEFAULT_FWD_EVAL_BASE);
    if (shape === null) {
      warnUnparsedSpec("LR_FWD_EVAL_BASE", baseEnv as string);
      shape = parseRolloutShape(DEFAULT_FWD_EVAL_BASE);
    }
  } else {
    const baseEnv = readEnv("LR_FWD_EVAL_BASE");
    if (baseEnv !== undefined && baseEnv !== "") warnBaseOverrideIgnored(baseEnv, env as string);
    shape = parseRolloutShape(env as string);
    // A non-empty env that failed to parse is a typo, not an intentional disable — warn so the
    // silent fallback to the local proxy ranker is visible (env is non-empty/non-off here).
    if (shape === null) warnUnparsedSpec("LR_FWD_EVAL", env as string);
  }
  // Rollout frames are CHARGED honestly by default; LR_FWD_EVAL_CHARGE=0 refunds them (the
  // budget-refunded ceiling experiment). Resolved once here, not re-read per candidate.
  return {
    config: shape === null
      ? null
      : { ...shape, charge: readEnv("LR_FWD_EVAL_CHARGE") !== "0", leaf: forwardEvalLeaf() },
    defaultConfig,
  };
}

/** Start-selection eval: rank initial conditions by the TRUE forward score of where they lead,
 *  instead of the local axis-L2 proxy. DEFAULT best:1:5 — the start is the most consequential
 *  choice on a forward-dependent chain (inherited by the whole track), so using max-width over
 *  the first contact pays here at every budget (+7.5 headline over greedy:2). LR_START_EVAL=off
 *  reverts to the proxy; LR_START_EVAL=greedy:2 restores the previous default. Always charged.
 *
 *  MINIMAL-SIMULATION RULE — SANCTIONED EXCEPTION (deliberate, not an oversight): this is a
 *  ranking step that runs FULL engine re-detection (forwardNodeScore, leaf="full") rather than
 *  ballistic propagation, and it is ON by default at EVERY budget (NO forwardEvalMinBudget gate,
 *  unlike the per-candidate ranker). The measured wins across budgets are why it is the default
 *  despite the cost; the full-leaf and the always-on, ungated breadth are intentional.
 *  Cost is bounded by the heuristic start pool (~START_SCORING_POOL + support seeds), each
 *  rolled before the slice to START_OPTION_LIMIT. The rollout leaf follows LR_FWD_EVAL_LEAF:
 *  the default objective leaf saves re-detection frames, while LR_FWD_EVAL_LEAF=full restores
 *  the previous full-leaf ranking. If start ranking is ever made ballistic, drop this note. */
function startEvalConfig(): StartForwardPolicy | null {
  const env = readEnv("LR_START_EVAL");
  if (env === "0" || env === "off") return null;
  const shape = parseRolloutShape(env === undefined || env === "" ? "best:1:5" : env);
  if (shape === null && env !== undefined && env !== "") warnUnparsedSpec("LR_START_EVAL", env);
  return shape === null ? null : { ...shape, leaf: forwardEvalLeaf() };
}

/** True forward-rollout score of a start root (charged). Higher = better start. */
function startForwardScore(
  root: SearchNode, gaps: Gap[], ctx: SpecContext, seed: number, cfg: StartForwardPolicy,
): number {
  // Start-selection rollouts are always charged (no refund here); count their sim-frames
  // separately from per-candidate forward eval (cost instrument, measure-only).
  const saved = getSimFrames();
  if (handoffRolloutProbeHook !== null) rolloutRedrawState = "none";
  let value = 0;
  try {
    const leafObjective = cfg.leaf === "objective";
    // Start roots share NOTHING (a different start state is the whole point), so the pool
    // boundary is the root's own gapIndex — 0 in production, where the de-diluted fold is the
    // plain fold by construction. Written as `root.gapIndex` rather than a literal so a future
    // root that does carry a prefix stays correct.
    const sharedPrefixGaps = root.gapIndex;
    value = cfg.variant === "avg"
      ? forwardAvgNextScore(root, gaps, ctx, seed, cfg.branch, leafObjective, sharedPrefixGaps)
      : forwardRolloutScore(
        root, gaps, ctx, seed, cfg.depth, cfg.variant === "best" ? cfg.branch : 1,
        leafObjective, sharedPrefixGaps,
        true, // firstHop: start selection's own hop-1 verdict
      );
    return value;
  } finally {
    const spent = Math.max(0, getSimFrames() - saved);
    fwdEvalTotals.start_eval_frames_charged += spent;
    // Rollout-economics probe (measure-only): start selection is its own charged
    // rollout population and is reported as such — coarse, since best:1:5 branches.
    handoffRolloutProbeHook?.({
      gapIndex: -1,
      rank: -1,
      source: "start",
      variant: cfg.variant,
      depth: cfg.depth,
      branch: cfg.branch,
      firstBranch: 1, // start selection never uses the first-widened shape
      outcome: "branched",
      hop1Redrawn: rolloutRedrawState !== "none",
      hop1Refuted: rolloutRedrawState === "refuted",
      hopsPlaced: 0,
      frames: spent,
      hopFrames: [],
      value,
      hasCompletion: false,
      targetBudget: 0,
      simFramesAtStart: saved,
      deadNode: null,
      hop1Node: null,
      gaps: null,
      ctx: null,
      seed,
    });
  }
}

/** True partial-track score (scoreDriftReport.full_score) of a forward SearchNode. */
function forwardNodeScore(search: SearchNode, gaps: Gap[], ctx: SpecContext): number {
  const spec = fwdEvalRuntime.spec;
  if (spec === null) {
    throw new Error("forwardNodeScore: forward-eval context unset — setForwardEvalContext must run first");
  }
  const fullDuration = isTerminalNode(search, gaps);
  const horizonFrame = fullDuration ? ctx.durationFrames : processedHorizonFrame(search, gaps);
  const outputDurationFrames = fullDuration
    ? ctx.durationFrames + OUTPUT_TAIL_PAD_FRAMES
    : partialOutputDurationFrames(horizonFrame, ctx.durationFrames);
  const det = detectWindow(search.prefixEngine, 0, outputDurationFrames);
  const fits = search.prefixFits.slice();
  while (fits.length < gaps.length) fits.push(null);
  const rawReport = buildDriftReport(
    det, spec, gaps, ctx.allContactFrames, ctx.durationFrames, [], fits, fwdEvalRuntime.gapAxisTargets,
  );
  const report = fullDuration ? rawReport : asPartialReport(rawReport, horizonFrame);
  return leafKeyForReport(report, ctx.durationFrames).full_score;
}

/** Objective-leaf scorer (LR_FWD_EVAL_LEAF=objective): score a rollout LEAF with ZERO engine
 *  frames, reconstructing the true scorer (score.ts:287) from data the rollout already committed.
 *  Replaces forwardNodeScore's full re-detection.
 *
 *    value = 1000
 *          × axisQualityFromErrors(ALL committed-prefix per-axis errors)   // one COMBINED RMS
 *          × survival_quality   (= deepest committed contact frame / totalFrames)
 *          × exp(−futureMissing / MISSING_CONTACT_TOLERANCE)               // missing_quality
 *
 *  Uses the TRUE targets (fwdEvalRuntime.gapAxisTargets), matching forwardNodeScore's scorer — NOT the
 *  jitter-sampled gap.targets. The axis RMS spans the WHOLE committed prefix [0, leaf.gapIndex):
 *  RMS is non-linear, so the prefix does NOT cancel across a pool, and folding it in is what lets
 *  an over-sped prefix be abandoned (accumulated error → low quality for every continuation).
 *  drift_quality / off_beat_quality are STRUCTURALLY 1 for the gate-passed committed contacts
 *  (every catch within ±1 frame, no off-beat — substrate.ts:659-671) and cannot be recomputed
 *  without re-detection, so they are omitted. No readiness, no hybrid.
 *
 *  `sharedPrefixGaps` is the caller's POOL BOUNDARY: the number of leading gaps that every
 *  leaf in the comparison this value will enter has in common (for the per-candidate ranker,
 *  the branch node's `gapIndex`). It is inert unless the `LR_LEAF_DEDILUTE=1` study arm is on
 *  — and even then, zero (the parameter default, and what every study caller passes)
 *  reproduces the plain whole-prefix fold bit-for-bit. See `dedilutedAxisQuality` for what
 *  a non-zero boundary changes under that arm, what it provably cannot change, and why it
 *  ships off. */
export function objectiveLeafValue(
  leaf: SearchNode,
  gaps: Gap[],
  durationFrames: number,
  sharedPrefixGaps = 0,
): number {
  // FAITHFUL reconstruction of the true scorer (score.ts:287) from the rollout's OWN committed
  // data, zero re-detection. The full scorer is axis × drift × missing × off_beat × survival; of
  // those, drift and off_beat are STRUCTURALLY 1 for the committed contacts this leaf scores — the
  // candidate gates require every catch within ±1 frame ("hit", never "drift") and reject off-beat
  // landings (substrate.ts:659-671), and neither can be recomputed without re-detection. So the
  // faithful short leaf is axis (combined RMS) × survival × missing — the only factors that vary
  // from 1. No readiness, no hybrid: those are not part of the true scorer.
  //
  // The axis RMS spans the WHOLE committed prefix [0, leaf.gapIndex), NOT just the rolled span: the
  // full leaf folds all committed gaps ≤ horizon into ONE RMS, and because RMS is non-linear the
  // prefix does NOT cancel across a pool (it would for a product) — including it is what lets the
  // score ABANDON an over-sped prefix (accumulated error → low quality for every continuation).
  const errors: number[] = [];
  // Errors are pushed in increasing gap order, so the shared prefix's errors are exactly the
  // first `sharedErrorCount` of them — no second array, no second pass over the fits.
  let sharedErrorCount = 0;
  let missingFitCount = 0;
  for (let i = 0; i < leaf.gapIndex; i++) {
    if (!gaps[i]?.endsWithContact) continue; // non-contact gap: no committed catch
    const fit = leaf.prefixFits[i] ?? null;
    if (fit === null) {
      missingFitCount += 1; // defensive: a contact gap that never committed a catch
      continue;
    }
    // Reproduce the true scorer's [startFrame, endFrame] axis factor from the
    // canonical current-gap vector.
    const achieved = settledIncomingAxes(fit);
    for (const e of axisErrorsForTargets(fwdEvalRuntime.gapAxisTargets[i], achieved)) errors.push(e);
    if (i < sharedPrefixGaps) sharedErrorCount = errors.length;
  }
  // axis_quality = exp(-rms(committed-prefix errors) / AXIS_QUALITY_TOLERANCE) — the scorer's
  // own single-RMS fold, reproduced from the per-gap fits. The de-diluted two-component fold
  // is the LR_LEAF_DEDILUTE=1 study arm and is identical to this one when the pool has no
  // shared prefix; production takes the plain branch.
  let value = 1000 * (fwdEvalRuntime.leafDedilute
    ? dedilutedAxisQuality(errors, sharedErrorCount)
    : axisQualityFromErrors(errors).axis_quality);
  if (missingFitCount > 0) value *= Math.exp(-missingFitCount);
  // survival_quality (= deepest committed contact frame / total, score.ts:276) × missing_quality
  // (future contacts past that horizon, capped at the partial window) — the full leaf's terms read
  // straight off the rollout's committed depth. A shallower (dead-end) rollout → lower horizon →
  // lower survival + more future-missing, subsuming the old rollout missing-step penalty.
  const horizonFrame = processedHorizonFrame(leaf, gaps);
  // The true scorer gives survival_quality = 1 when the track reaches endOfSpec (reachedEnd,
  // score.ts:281). A TERMINAL leaf (all contacts placed) reaches endOfSpec — verified empirically
  // (full-leaf survival = 1.0 on every complete node across specs) — so reproduce that 1 instead of
  // the lastContact/duration proxy, which omits the post-last-contact ride-out tail and so
  // under-scores terminal rollouts by that fraction. PARTIAL leaves keep the proxy: it matches the
  // full leaf's horizon-clamped survival (asPartialReport's terminus = min(actual, horizon)).
  const survival = isTerminalNode(leaf, gaps)
    ? 1
    : (durationFrames > 0 ? clamp01(horizonFrame / durationFrames) : 0);
  const futureMissing = Math.min(
    PARTIAL_FUTURE_CONTACT_WINDOW, remainingContactGaps(gaps, leaf.gapIndex),
  );
  const missingFactor = Math.exp(-futureMissing / MISSING_CONTACT_TOLERANCE);
  value *= survival * missingFactor;
  return value;
}

/**
 * THE DE-DILUTED FOLD — the pool's shared prefix stays a LEVEL and stops being a DILUTER.
 *
 * Every candidate in a pool extends the SAME node, so the leaf values being compared share a
 * byte-identical committed prefix and differ only in the 1-2 gaps the candidate and its rollout
 * placed. The plain fold — one RMS over all committed errors — divides the candidate-specific
 * squared error by the WHOLE prefix length, so the within-pool contrast decays as the track
 * grows (measured: 35x collapse from the opening to the tail, 8/8 sources) and the judge ends
 * up ordering a pool on ~0.1% value differences. THE HYPOTHESIS (mandate iteration 2) was that
 * this decay, not the depth premium, is what the second rollout hop bought back by growing the
 * candidate-specific numerator. The measurement at the bottom of this comment refutes it.
 *
 * The fix is a pure REWEIGHTING of the same errors — no constant, nothing to tune. Weight each
 * newly-rolled error by `n_shared / n_new` and keep the shared errors at weight 1; the weighted
 * mean-square telescopes to the unweighted mean of the two components:
 *
 *     rms = sqrt( ( meanSquare(shared) + meanSquare(new) ) / 2 )
 *
 * so the two halves of the track the pool is comparing enter with equal say whatever their
 * lengths. What this preserves: the prefix is still in the value (an over-sped prefix still
 * drags every continuation down and can still be abandoned — the property the single-RMS fold
 * was chosen for), the ordering is unchanged wherever the shared prefix is empty (start
 * selection, the first gap), and the depth premium (survival x missing_quality) is untouched.
 * What it changes: d(value)/d(candidate error) no longer shrinks with the prefix length, which
 * is the whole point. It is scale-free in track position and in budget by construction — the
 * only lengths it reads are the two it is balancing.
 *
 * Comparisons ACROSS pools would see a different monotone transform of the same data; the
 * production consumers are all within-pool (the sorts in `rankedOptions` /
 * `startupDeadEndOptions`, the max inside a rollout's own branch set, and the measure-only
 * agreement instrument), which is the audited precondition for doing this inside the leaf.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * DEFAULT OFF. MEASURED, AND IT LOSES — read this before re-deriving the idea.
 *
 * WHAT IT CAN AND CANNOT TOUCH (algebra, not measurement). `survival` and `missing_quality`
 * are functions of `leaf.gapIndex` alone (`processedHorizonFrame` reads authored gap frames),
 * so two leaves at the SAME depth differ only in their axis factor. Both folds are strictly
 * increasing in the candidate-specific squared-error mass, so on an equal-depth pool they
 * induce the IDENTICAL order — de-diluting changes the numbers and not one decision. Its
 * entire action is on pools whose leaves reach DIFFERENT depths (a rollout dead-ends where
 * its sibling continued, ~7% of pools): there it raises the axis term's say against the depth
 * premium, which is the same thing as pricing "this arc's own gaps came out well" against
 * "this arc's rollout could keep going". The 35x contrast collapse is real, but it is a
 * collapse in MAGNITUDE, and a sort does not read magnitudes.
 *
 * WHAT HAPPENED WHEN THAT EXCHANGE RATE MOVED (six-source panel, 750k, 8 seeds, paired,
 * arms live, control arm reproduces the depth-1 archive trackHash 48/48): pooled
 * −17.24 ± 3.04 (t=−5.67), 7 of 48 cells up. The sharp falsifier failed in the wrong
 * direction — `frontier_pickup_progression` −8.33 ± 3.06 (t=−2.72, 0/8 seeds up) against a
 * required +3.50 — and the controls collapsed (`frontier_low_air_endurance_4s` −43.07,
 * t=−6.24; `regression_transition_mosaic_tempo_fast_5` −20.60; `dense_dialogue_impact_contrast_10`
 * −16.25). The signature is uniform: first completion arrives LATER on all six sources, by
 * 1% to 20% (low_air 348k → 419k frames), because a leaf that has stopped believing the depth
 * premium keeps choosing arcs whose own gaps score well and whose rollout died. The premium
 * was load-bearing. The second hop's value on the frontier sources is therefore NOT the
 * contrast collapse — that hypothesis is spent; it is the extra composed-track information
 * itself (see the campaign plan's Mandate iteration 2).
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */
function dedilutedAxisQuality(errors: readonly number[], sharedErrorCount: number): number {
  // No shared prefix, or nothing newly rolled: the two-component fold IS the plain fold, and
  // taking that path keeps those cases bit-identical to the pre-change value.
  if (sharedErrorCount <= 0 || sharedErrorCount >= errors.length) {
    return axisQualityFromErrors(errors).axis_quality;
  }
  const shared = meanSquareOfFinite(errors, 0, sharedErrorCount);
  const rolled = meanSquareOfFinite(errors, sharedErrorCount, errors.length);
  // A component with no finite error contributes nothing to weight or mass; the union fold is
  // then exactly the other component's, so defer to it rather than inventing a value.
  if (shared === null || rolled === null) return axisQualityFromErrors(errors).axis_quality;
  const rms = Math.sqrt((shared + rolled) / 2);
  return Math.exp(-(rms / AXIS_QUALITY_TOLERANCE));
}

/** Mean of squared FINITE errors over `[from, to)`, or null when the slice has none —
 *  the same non-finite filtering `axisQualityFromErrors` applies, without its allocation. */
function meanSquareOfFinite(errors: readonly number[], from: number, to: number): number | null {
  let sum = 0;
  let n = 0;
  for (let i = from; i < to; i++) {
    const e = errors[i];
    if (!Number.isFinite(e)) continue;
    sum += e * e;
    n++;
  }
  return n === 0 ? null : sum / n;
}

/** Count of remaining contact gaps at or after `from` (the rollout's missing-step budget). */
function remainingContactGaps(gaps: Gap[], from: number): number {
  let n = 0;
  for (let i = Math.max(0, from); i < gaps.length; i++) {
    if (gaps[i].endsWithContact) n++;
  }
  return n;
}

export function forwardTerminalReadiness(search: SearchNode, gaps: Gap[]): number {
  // Diagnostic helper for frontier-readiness studies. Production forward eval
  // intentionally does not multiply partial-track scores by this value.
  const nextGapIndex = nextContactGapIndex(gaps, search.gapIndex);
  if (nextGapIndex < 0) return 1;
  const nextGap = gaps[nextGapIndex];
  for (let i = Math.min(nextGapIndex, search.prefixFits.length) - 1; i >= 0; i--) {
    if (!gaps[i]?.endsWithContact) continue;
    const fit = search.prefixFits[i];
    if (fit === null || fit === undefined) continue;
    const projection = projectOutgoingScorerGap(fit, nextGap);
    return projection === null
      ? 1
      : scoreNextArcReadiness(
        projection.projection,
        nextGap,
        successorScorerGapAfter(nextGap, gaps),
      ).readiness;
  }
  return 1;
}

/** Advance past non-contact gaps to the next contact node, or null at terminus. */
function advanceToNextContact(search: SearchNode, gaps: Gap[]): SearchNode | null {
  const nextIdx = nextContactGapIndex(gaps, search.gapIndex);
  if (nextIdx < 0) return null;
  let n = search;
  while (n.gapIndex < nextIdx) n = extendNodeCached(n, null);
  return n;
}

/**
 * Re-draw the FIRST rolled contact of a charged rollout whose expansion at
 * `width` came back empty (see HANDOFF_ROLLOUT_REDRAW_ON_EMPTY). Returns the
 * widened pool, which is empty iff the extra draw did not refute the verdict.
 * Only ever called on the empty path, so the 85-91% of rollouts whose first
 * draw succeeds are untouched, and every frame it spends is inside the caller's
 * own charge window.
 *
 * The ORDINARY generation path at a wider count, deliberately — not a second
 * mechanism. `getCandidatesSorted`'s prefix contract makes the extra draw the
 * very sample the SEARCH would take next here (`solveAdditionalCandidates`
 * advances the per-gap RNG, itself keyed on (seed, gapIndex) alone, to attempt
 * index `width`), so nothing invents a sample order, the compile stays
 * deterministic in (spec, seed, budget), and the probe cannot find a catch the
 * search would not have found. The audit's determinism self-check re-ran the
 * rollout's own width first and reproduced the empty pool 12,338 times out of
 * 12,338.
 *
 * The aim lane is suppressed, as `forwardFirstWidenedScore` already does for its
 * own widened build: the lane runs as soon as nCand > 1, and it is not what
 * refutes these verdicts — with the lane off the audit's verified-true rate and
 * refutation curve are unchanged to a tenth of a point while the 2-wide rebuild
 * costs 4.6x less. Restore rather than clear, so a future nested widened build
 * cannot silently re-admit the lane into a rollout pool.
 *
 * The widened pool is LEFT IN THE NODE'S MEMO on purpose; the alternative — a
 * cache-cleared copy, as the study's read-only probe used — would freeze the
 * refuted verdict where it does the damage. `_candidatesCache` is keyed on
 * (seed, nCand), a narrower request is served as a prefix of a wider cache and a
 * wider one extends the same sample order, so: (i) a later real expansion at the
 * search's own width (>= 8 everywhere, 32/80 in the rescue tiers) still builds
 * exactly the pool it always would, with the aim lane live — the dose law's
 * `REDRAW_MAX_TOTAL_WIDTH` is what keeps that true now that the dose varies;
 * (ii) a second rollout that dead-ends at this node pays nothing; and (iii)
 * `cachedForwardContinuation` now reports the corrected bit, so the
 * online-continuation filter stops pruning the frontier on a refuted proof.
 */
/**
 * STUDY-ONLY dose override for the re-draw increment above: it PINS the dose,
 * bypassing the pressure law (`REDRAW_DOSE_PRESSURE_SPAN`), so `=1` is the law's
 * pressure-0 arm and the pre-law compiler exactly. **Never set this in
 * production, in a benchmark eval, or in a promotion candidate.**
 *
 * The constant's own docstring calls wider doses "a monotone family that can be
 * walked later on the same arithmetic"; this is the knob that walks it, and
 * nothing else. Refuses anything outside [0, 7] rather than clamping (0 is the
 * pre-redraw world, 7 keeps the widened draw inside the rollout width clamp).
 * The pinned dose is still bounded by `REDRAW_MAX_TOTAL_WIDTH`, so a pinned arm
 * above 4 is NOT the historical uncapped arm on the impact arm's `firstBranch=3`
 * gaps (it re-draws at 7, not at 3 + dose).
 */
const readStudyRolloutRedraw = compileScopedEnv("LR_STUDY_ROLLOUT_REDRAW");
const readStudyRolloutLaterRedraw = compileScopedEnv("LR_STUDY_ROLLOUT_LATER_REDRAW");

/**
 * Deadline pressure in force for re-draws inside the pool build being scored.
 *
 * Ambient rather than threaded, the way `setRolloutContext`,
 * `setAimLaneDeadlineThrottled` and `setRolloutAimSuppressed` already are: the
 * read happens four call levels below `rankedOptions` (pool scoring -> forward
 * value -> rollout scorer -> re-draw) and on paths that also run from the extra
 * candidate lanes, so threading it would touch every scorer signature to deliver
 * one number that is constant for the whole build.
 *
 * `rankedOptions` sets it from ITS OWN `config.deadlineMargin` — the margin
 * `deadline.marginAt` produced for this node at this frame count, not a
 * compile-level snapshot — and restores the previous value in a `finally`, so
 * nested builds (the rescue tiers, the tail-completion lane) nest correctly.
 * Everything with no live margin reads 0 and therefore doses at the base draw:
 * start selection and its support-delay robust score (they run before the search
 * has a deadline at all) and the startup dead-end stream (its own catch
 * generator, called outside `rankedOptions`). That is the pressure-0 arm, i.e.
 * unchanged behaviour, not a special case of the law.
 */
let rolloutRedrawPressure = 0;

/** Set the ambient pressure above. `rankedOptions` owns the production scope;
 *  exported so the law can be exercised at a pinned pressure in tests. */
export function setRolloutRedrawPressure(pressure: number): void {
  rolloutRedrawPressure = pressure;
}

/** THE REDRAW-DOSE LAW (see `REDRAW_DOSE_PRESSURE_SPAN` for the contract, the
 *  evidence and the hazard). Pure in `pressure`; monotone non-decreasing;
 *  `pressure = 0` returns the base dose. */
function rolloutRedrawOnEmpty(pressure: number): number {
  const raw = readStudyRolloutRedraw();
  if (raw !== undefined && raw !== "") {
    const n = Number.parseInt(raw, 10);
    if (!Number.isInteger(n) || String(n) !== raw.trim() || n < 0 || n > 7) {
      throw new Error(
        `LR_STUDY_ROLLOUT_REDRAW must be an integer in [0, 7] (STUDY-ONLY; never set it in ` +
          `production or in an eval), got "${raw}"`,
      );
    }
    return n;
  }
  const p = Number.isFinite(pressure) ? Math.min(1, Math.max(0, pressure)) : 0;
  return Math.max(
    1,
    Math.round(HANDOFF_ROLLOUT_REDRAW_ON_EMPTY + REDRAW_DOSE_PRESSURE_SPAN * p),
  );
}

export function redrawFirstHopOnEmpty(
  at: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  width: number,
): Candidate[] {
  const dose = rolloutRedrawOnEmpty(rolloutRedrawPressure);
  if (dose <= 0) return [];
  fwdEvalTotals.fwd_rollout_redraws++;
  const savedAimSuppressed = isRolloutAimSuppressed();
  setRolloutAimSuppressed(true);
  let widened: Candidate[];
  try {
    widened = getCandidatesSorted(
      at,
      gaps,
      ctx,
      seed,
      // The dose is a magnitude; the memo is what bounds it. `width + 1` is the
      // floor so the base draw survives the bound at every width.
      Math.max(width + 1, Math.min(width + dose, REDRAW_MAX_TOTAL_WIDTH)),
    );
  } finally {
    setRolloutAimSuppressed(savedAimSuppressed);
  }
  if (widened.length > 0) fwdEvalTotals.fwd_rollout_redraw_refuted++;
  // Rollout-economics probe (measure-only): record WHICH of the three post-L1
  // first-hop states this was, so the hook can report the L1 trigger population
  // and its refuted subset separately from the surviving verdict. Only ever one
  // re-draw per rollout (the flag is passed at the first hop alone), so a single
  // slot is exact.
  if (handoffRolloutProbeHook !== null) {
    rolloutRedrawState = widened.length > 0 ? "refuted" : "residual";
  }
  return widened;
}

/** Study-only correction for an empty hop below the rollout root. Production's
 * ordinary base is depth 1; the live high-impact arm is depth 2, so this prices
 * the recorded `dead_hop2` residue without changing the promoted hop-1 dose. */
function redrawLaterHopOnEmpty(
  at: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  width: number,
): Candidate[] {
  const raw = readStudyRolloutLaterRedraw();
  if (raw === undefined || raw === "" || raw === "0") return [];
  if (raw !== "1" && raw !== "unpressured") {
    throw new Error(
      `LR_STUDY_ROLLOUT_LATER_REDRAW must be 0, 1, or unpressured (STUDY-ONLY), ` +
        `got "${raw}"`,
    );
  }
  // Compose with the promoted deadline law instead of inventing another
  // pressure threshold: when hop 1 has already escalated above its base dose,
  // the compile is spending its scarce margin there and hop 2 stays single-draw.
  if (raw === "unpressured" && rolloutRedrawOnEmpty(rolloutRedrawPressure) !== 1) return [];
  fwdEvalTotals.fwd_rollout_later_redraws++;
  const savedAimSuppressed = isRolloutAimSuppressed();
  setRolloutAimSuppressed(true);
  let widened: Candidate[];
  try {
    widened = getCandidatesSorted(
      at,
      gaps,
      ctx,
      seed,
      Math.min(width + 1, REDRAW_MAX_TOTAL_WIDTH),
    );
  } finally {
    setRolloutAimSuppressed(savedAimSuppressed);
  }
  if (widened.length > 0) fwdEvalTotals.fwd_rollout_later_redraw_refuted++;
  return widened;
}

/** greedy/best: best true partial-track score reachable from `search` within
 *  `depthLeft` contact gaps, branching `branch` (1 = greedy single rollout).
 *  `firstHop` marks the outermost call — the one whose empty expansion is the
 *  hop-1 dead-end verdict the re-draw corrects; the recursion below is hop 2+
 *  and keeps the single draw. */
function forwardRolloutScore(
  search: SearchNode, gaps: Gap[], ctx: SpecContext, seed: number, depthLeft: number, branch: number,
  leafObjective: boolean, sharedPrefixGaps: number, firstHop = false,
): number {
  // Leaf scorer: zero-frame objective value (DEFAULT) or full re-detection (LR_FWD_EVAL_LEAF=full). The missing-contact
  // penalty is derived by the leaf scorer itself from the node's own committed depth
  // (objectiveLeafValue's futureMissing / forwardNodeScore's re-detection).
  // `sharedPrefixGaps` is the OUTER pool's boundary and is passed down unchanged: every leaf
  // this rollout's own max ranges over shares it too, and it is the comparison at the pool
  // that the value is ultimately for.
  const leafValue = (node: SearchNode): number =>
    leafObjective
      ? objectiveLeafValue(node, gaps, ctx.durationFrames, sharedPrefixGaps)
      : forwardNodeScore(node, gaps, ctx);
  const trace = rolloutTrace; // measure-only; null in every uninstrumented compile
  if (depthLeft <= 0 || isTerminalNode(search, gaps)) {
    if (trace !== null) {
      trace.outcome = depthLeft <= 0
        ? "full"
        : trace.hopsPlaced === 0
        ? "no_hop"
        : "end_hop2";
    }
    return leafValue(search);
  }
  const at = advanceToNextContact(search, gaps);
  if (at === null) {
    if (trace !== null) trace.outcome = trace.hopsPlaced === 0 ? "no_hop" : "end_hop2";
    return leafValue(search);
  }
  const hopStart = trace === null ? 0 : getSimFrames();
  if (trace !== null && trace.hopsPlaced === 0) trace.hop1Node = at;
  let cands = getCandidatesSorted(at, gaps, ctx, seed, branch);
  if (cands.length === 0 && firstHop) {
    cands = redrawFirstHopOnEmpty(at, gaps, ctx, seed, branch);
  } else if (cands.length === 0) {
    cands = redrawLaterHopOnEmpty(at, gaps, ctx, seed, branch);
  }
  if (cands.length === 0) {
    fwdEvalTotals.fwd_rollout_no_candidate++;
    if (trace !== null) {
      trace.hopFrames.push(getSimFrames() - hopStart);
      trace.outcome = trace.hopsPlaced === 0 ? "dead_hop1" : "dead_hop2";
      trace.deadNode = at;
    }
    // Dead-end: the rollout could not place any further contact; the leaf scorer applies the full
    // missing-contact penalty from the node's own committed depth.
    return leafValue(search);
  }
  if (trace !== null) {
    // The hop's OWN cost: the pool build at the rolled contact (including the
    // re-draw, when one ran). The recursion's frames are pushed by the level
    // that spends them.
    trace.hopFrames.push(getSimFrames() - hopStart);
    trace.hopsPlaced++;
    trace.outcome = "full"; // overwritten by the deeper level if it ends early
  }
  let best = -Infinity;
  for (const c of cands) {
    const s = forwardRolloutScore(
      extendNodeCached(at, c), gaps, ctx, seed, depthLeft - 1, branch, leafObjective, sharedPrefixGaps,
    );
    if (s > best) best = s;
  }
  return best;
}

/** First-level-only widened greedy: sample `firstBranch` candidates at the FIRST rolled
 *  contact, continue each with an ordinary greedy chain below, return the best leaf. Widens
 *  the noisiest layer of the downstream estimate (the single k+1 sample attempt) without
 *  surrendering the deeper hops' drift control (see impactBestForwardEvalConfig). */
function forwardFirstWidenedScore(
  search: SearchNode, gaps: Gap[], ctx: SpecContext, seed: number, depthLeft: number,
  firstBranch: number, leafObjective: boolean, sharedPrefixGaps: number,
): number {
  const leafValue = (node: SearchNode): number =>
    leafObjective
      ? objectiveLeafValue(node, gaps, ctx.durationFrames, sharedPrefixGaps)
      : forwardNodeScore(node, gaps, ctx);
  if (depthLeft <= 0 || isTerminalNode(search, gaps)) {
    return leafValue(search);
  }
  const at = advanceToNextContact(search, gaps);
  if (at === null) {
    return leafValue(search);
  }
  // Baseline branch=1 rollout pools never contain aim-lane candidates (the
  // nCand > 1 lane gate); keep that invariant for the widened build — without
  // suppression every prefix re-sort re-runs the CHARGED aim lane and the
  // budget stalls before completion (measured: 17/24 rideStalled).
  //
  // Restore rather than clear, for the reason `redrawFirstHopOnEmpty` gives:
  // clearing is only correct while this is the outermost suppressing build, and
  // a future nested widened build would silently re-admit the lane into a
  // rollout pool. Identical today (nothing nests), a latent bug tomorrow.
  const savedAimSuppressed = isRolloutAimSuppressed();
  setRolloutAimSuppressed(true);
  let cands: Candidate[];
  try {
    cands = getCandidatesSorted(at, gaps, ctx, seed, firstBranch);
  } finally {
    setRolloutAimSuppressed(savedAimSuppressed);
  }
  if (cands.length === 0) {
    cands = redrawFirstHopOnEmpty(at, gaps, ctx, seed, firstBranch);
  }
  if (cands.length === 0) {
    fwdEvalTotals.fwd_rollout_no_candidate++;
    return leafValue(search);
  }
  let best = -Infinity;
  for (const c of cands) {
    const s = forwardRolloutScore(
      extendNodeCached(at, c), gaps, ctx, seed, depthLeft - 1, 1, leafObjective, sharedPrefixGaps,
    );
    if (s > best) best = s;
  }
  return best;
}

/** avg: mean true partial-track score over the top-`m` next-contact alternatives, 1 deep. */
function forwardAvgNextScore(
  search: SearchNode, gaps: Gap[], ctx: SpecContext, seed: number, m: number,
  leafObjective: boolean, sharedPrefixGaps: number,
): number {
  const leafValue = (node: SearchNode): number =>
    leafObjective
      ? objectiveLeafValue(node, gaps, ctx.durationFrames, sharedPrefixGaps)
      : forwardNodeScore(node, gaps, ctx);
  const at = advanceToNextContact(search, gaps);
  if (at === null) {
    return leafValue(search);
  }
  let cands = getCandidatesSorted(at, gaps, ctx, seed, m);
  if (cands.length === 0) {
    cands = redrawFirstHopOnEmpty(at, gaps, ctx, seed, m);
  }
  if (cands.length === 0) {
    fwdEvalTotals.fwd_rollout_no_candidate++;
    // Dead-end: the leaf scorer applies the full missing-contact penalty from the node's own
    // committed depth.
    return leafValue(search);
  }
  let sum = 0;
  for (const c of cands) sum += leafValue(extendNodeCached(at, c));
  return sum / cands.length;
}

/** Forward value of committing `child` (the prefix+candidate node). Rollout frames are
 *  CHARGED against the budget by default (honest). LR_FWD_EVAL_CHARGE=0 refunds them — the
 *  budget-refunded ceiling experiment that isolates eval quality from its cost. */
function forwardArcValue(
  child: SearchNode, gaps: Gap[], ctx: SpecContext, seed: number, cfg: CandidateForwardPolicy,
  sharedPrefixGaps: number,
): number {
  const saved = getSimFrames();
  // try/finally so a throw mid-rollout (e.g. a future frame limit) can't leak frames.
  const charge = cfg.charge;
  // Pure objective leaf: NO hybrid-impact fallback. The short leaf is a faithful scorer
  // reconstruction in its own right (axis × survival × missing); it never defers to the full leaf.
  const leafObjective = cfg.leaf === "objective";
  // Mark the rollout so the rolled-level pool can drop its aim probes (LR_ROLLOUT_AIM=0) — isolates
  // wide-branching value from aim-probe cost. The top-level pool (built before this) is unaffected.
  setRolloutContext(true);
  // Rollout-economics probe (measure-only). Only the unbranched greedy shape —
  // the default and the overwhelming majority — carries a hop trace; branched
  // shapes report frames and nothing else, because "the" hop is not defined for
  // them. The re-draw state is tracked for EVERY shape (each one re-draws at its
  // own first hop), so the L1 trigger and refutation populations are complete
  // even where the outcome class is `branched`.
  const traced = handoffRolloutProbeHook !== null;
  const linear = cfg.variant === "greedy" && cfg.branch === 1 && (cfg.firstBranch ?? 1) === 1;
  const trace: RolloutTrace | null = traced && linear
    ? { hopFrames: [], hopsPlaced: 0, outcome: "no_hop", deadNode: null, hop1Node: null }
    : null;
  rolloutTrace = trace;
  if (traced) rolloutRedrawState = "none";
  /* SCOPED AIM SUPPRESSION FOR WIDE BASE SHAPES (plan 4.1(b)).
   *
   * A base shape wider than one sample (`LR_FWD_EVAL_BASE=best:1:W`,
   * `LR_FWD_EVAL=best:1:W`) rebuilds the rolled-level pool at nCand = W, which
   * re-opens the charged aim lane inside the rollout on every prefix re-sort —
   * 4.6x cost, zero refutation value, and the documented -34.6 / -258
   * branch-widening failure was exactly unsuppressed width. Suppress it here,
   * scoped and restored, the way `forwardFirstWidenedScore` and
   * `redrawFirstHopOnEmpty` already do, instead of via the global
   * `LR_ROLLOUT_AIM=0` (which is process-wide and cannot be a production shape).
   *
   * Gated on the COMPILE'S BASE width, not on this gap's effective shape: the
   * adaptive arms' own shapes (opening-best's `best:1:2|3`) must keep behaving
   * exactly as measured, and at base width 1 the flag is never touched at all,
   * so production is byte-identical. On the arms' gaps under a wide base the
   * outer suppression is provably inert anyway — `forwardFirstWidenedScore`
   * already suppresses its own hop-1 build and every deeper hop draws nCand = 1,
   * where node.ts's `nCand > 1` gate keeps the lane out regardless. */
  const suppressWideBaseAim = (fwdEvalRuntime.config?.branch ?? 1) > 1;
  const savedRolloutAimSuppressed = suppressWideBaseAim ? isRolloutAimSuppressed() : false;
  if (suppressWideBaseAim) setRolloutAimSuppressed(true);
  let value = 0;
  try {
    value = cfg.variant === "avg"
      ? forwardAvgNextScore(child, gaps, ctx, seed, cfg.branch, leafObjective, sharedPrefixGaps)
      : cfg.variant === "greedy" && (cfg.firstBranch ?? 1) > 1
      ? forwardFirstWidenedScore(
        child, gaps, ctx, seed, cfg.depth, cfg.firstBranch as number, leafObjective, sharedPrefixGaps,
      )
      : forwardRolloutScore(
        child, gaps, ctx, seed, cfg.depth, cfg.variant === "best" ? cfg.branch : 1,
        leafObjective, sharedPrefixGaps,
        true, // firstHop: this call's expansion IS the hop-1 verdict
      );
    return value;
  } finally {
    if (suppressWideBaseAim) setRolloutAimSuppressed(savedRolloutAimSuppressed);
    rolloutTrace = null;
    setRolloutContext(false);
    // Cost instrument (measure-only): count the rollout's sim-frames even when charged
    // (the existing `saved` already reads getSimFrames). One call per ranked candidate.
    const spent = Math.max(0, getSimFrames() - saved);
    fwdEvalTotals.fwd_eval_frames_charged += spent;
    fwdEvalTotals.fwd_eval_calls++;
    if (!charge) refundSimFramesTo(saved);
    if (handoffRolloutProbeHook !== null) {
      const context = rolloutProbeContext;
      const refuted = rolloutRedrawState === "refuted";
      handoffRolloutProbeHook({
        gapIndex: context.gapIndex,
        rank: context.rank,
        source: context.source,
        variant: cfg.variant,
        depth: cfg.depth,
        branch: cfg.branch,
        firstBranch: cfg.firstBranch ?? 1,
        // Sticky: a refuted hop-1 verdict outranks whatever the deeper hops did.
        // Only the linear shape can name it — a branched rollout has no "the" hop
        // and stays `branched`, with hop1Redrawn/hop1Refuted carrying the split.
        outcome: trace === null
          ? "branched"
          : refuted
          ? "dead_hop1_refuted"
          : trace.outcome,
        hop1Redrawn: rolloutRedrawState !== "none",
        hop1Refuted: refuted,
        hopsPlaced: trace === null ? 0 : trace.hopsPlaced,
        frames: spent,
        hopFrames: trace === null ? [] : trace.hopFrames,
        value,
        hasCompletion: context.hasCompletion,
        targetBudget: context.targetBudget,
        simFramesAtStart: saved,
        deadNode: trace === null ? null : trace.deadNode,
        hop1Node: trace === null ? null : trace.hop1Node,
        gaps,
        ctx,
        seed,
      });
    }
  }
}

/** THE ADAPTIVE LAYER'S COMPOSITION RULE, stated once.
 *
 *  All three upgrades (mature-avg, impact-best, opening-best) are shape
 *  REPLACEMENTS scoped to the gaps they own: each one builds a complete rollout
 *  shape and carries only `charge`/`leaf` over from the base. `impactBest` looks
 *  like a delta (`{...base, firstBranch}`) but is not one — that spelling equals
 *  `greedy:2:1 + firstBranch=3` exactly because the base could only ever BE
 *  `greedy:2:1`, and the dispatcher in `forwardArcValue` honours `firstBranch`
 *  for `variant === "greedy"` alone, so the same spelling on any other base
 *  would silently DROP the widening. It is written as the replacement it is.
 *
 *  Two preconditions, both about who owns the shape:
 *   - `defaultConfig` — the study full override (`LR_FWD_EVAL`) pins one shape
 *     for the whole compile by design, and an arm replacing it would make the
 *     study arm unreadable. `LR_FWD_EVAL_BASE` moves the base and keeps this
 *     true, which is the whole point of having two knobs;
 *   - the shape handed to an arm is still the compile's own base, i.e. no arm
 *     upstream in the chain has already replaced it (mature > impact > opening).
 *
 *  This was spelled as the literal triple `greedy:2:1` while the base was a
 *  constant; against a movable base it is the same predicate stated against the
 *  base. Byte-identical whenever the base is the default. */
function adaptiveArmsApply(base: CandidateForwardPolicy): boolean {
  const compileBase = fwdEvalRuntime.config;
  return fwdEvalRuntime.defaultConfig &&
    compileBase !== null &&
    base.variant === compileBase.variant &&
    base.depth === compileBase.depth &&
    base.branch === compileBase.branch &&
    (base.firstBranch ?? 1) === (compileBase.firstBranch ?? 1);
}

function adaptiveForwardEvalConfig(
  base: CandidateForwardPolicy,
  node: SearchNode,
  gaps: Gap[],
  targetBudget: number,
  budgetSlack: number,
  openingBestOpportunity: number,
): CandidateForwardPolicy {
  const mature = matureForwardEvalConfig(base, node, gaps, targetBudget, budgetSlack);
  if (mature !== base) return mature;
  return openingBestForwardEvalConfig(base, node, budgetSlack, openingBestOpportunity);
}

function openingBestForwardEvalConfig(
  base: CandidateForwardPolicy,
  node: SearchNode,
  budgetSlack: number,
  opportunity: number,
): CandidateForwardPolicy {
  if (!adaptiveArmsApply(base) || opportunity <= 0) {
    return base;
  }

  const branch2Pressure = openingBestBranch2SlackPressure(budgetSlack) * clamp01(opportunity);
  if (branch2Pressure <= 0 || unitHash(openingBestForwardEvalSeed(node, 2)) >= branch2Pressure) {
    return base;
  }

  const branch3Pressure = openingBestBranch3SlackPressure(budgetSlack) * clamp01(opportunity);
  const branch = branch3Pressure > 0 &&
      unitHash(openingBestForwardEvalSeed(node, 3)) < branch3Pressure
    ? 3
    : 2;
  return {
    variant: "best",
    depth: 1,
    branch,
    charge: base.charge,
    leaf: base.leaf,
  };
}

function openingBestBranch2SlackPressure(budgetSlack: number): number {
  if (!Number.isFinite(budgetSlack)) return 0;
  return smoothstep(
    (budgetSlack - OPENING_BEST_FWD_SLACK_BRANCH2_START) /
      OPENING_BEST_FWD_SLACK_BRANCH2_SPAN,
  );
}

function openingBestBranch3SlackPressure(budgetSlack: number): number {
  if (!Number.isFinite(budgetSlack)) return 0;
  return smoothstep(
    (budgetSlack - OPENING_BEST_FWD_SLACK_BRANCH3_START) /
      OPENING_BEST_FWD_SLACK_BRANCH3_SPAN,
  );
}

function openingBestForwardEvalSeed(node: SearchNode, branch: number): number {
  return nodeHashSeed(node, Math.imul(branch, 0x27d4eb2d), 0x51ed270b);
}

function usesForwardEvalAtBudget(targetBudget: number): boolean {
  return targetBudget >= fwdEvalRuntime.minBudget;
}

function matureForwardEvalConfig(
  base: CandidateForwardPolicy,
  node: SearchNode,
  gaps: Gap[],
  targetBudget: number,
  budgetSlack: number,
): CandidateForwardPolicy {
  if (!adaptiveArmsApply(base)) {
    return base;
  }
  const verticalPressure = verticalDramaForwardEvalPressure(node, gaps);
  if (verticalPressure > 0) {
    const budgetPressure = smoothstep(
      (targetBudget - MATURE_AVG_FWD_EVAL_START_FRAMES) /
        MATURE_AVG_FWD_EVAL_SPAN_FRAMES,
    );
    const pressure = budgetPressure * verticalPressure;
    if (pressure > 0 && unitHash(matureForwardEvalSeed(node)) < pressure) {
      return {
        variant: "avg",
        depth: 2,
        branch: MATURE_AVG_FWD_EVAL_BRANCH,
        charge: base.charge,
        leaf: base.leaf,
      };
    }
  }
  return impactBestForwardEvalConfig(base, node, gaps, budgetSlack);
}

/** Impact-pressured downstream width: the greedy rollout prices a candidate's
 *  continuation by ONE sampled attempt at the child's next-contact state
 *  (branch=1 ⇒ solveOneGap(K=1)), whose within-state spread exceeds the
 *  between-candidate differences selection must resolve on impact-authored
 *  gaps (frontier-continuation study, 2026-07-17: 1-sample picks the two-gap
 *  optimum 8/24 vs best-of-8 24/24). Under continuous impact-ask × budget
 *  pressure, widen the greedy rollout's FIRST level to the best of
 *  IMPACT_BEST_FWD_BRANCH sampled attempts (deeper hops unchanged). Scope, all
 *  from measured failures: the SLACK ramp turns the width off when the
 *  traversal budget model reports a tight compile — unguarded width charged
 *  knife-edge completion hunts (certified f41e5494:
 *  pickup_shifted/dense_recovery −5 valid; 8-wide stage-0 −21.9 with
 *  pickup_shifted −276) — while a post-completion-only gate was equally
 *  falsified (panel −7.9, impact flat): the value lives in pre-completion
 *  trunk building at COMFORTABLE slack, and slack is the continuous signal
 *  that separates the two (the accepted slack-depth precedent).
 *
 *  REMOVED 2026-08-04 — the raw-budget factor (offender d3) and with it the
 *  double-counted budget coordinate (contamination c1). The gate used to be
 *  `askPressure × smoothstep((B − 300k)/200k) × slackPressure`, and since
 *  `slack = B / D(spec)` that read the budget twice: once absolute, once
 *  inside the difficulty coordinate — the DIFFICULTY/DEADLINE conflation the
 *  architecture forbids — with the absolute read placed, by its own former
 *  docstring, so that "the charge-bounded completion knee never pays" at the
 *  benchmark's own 250k operating point. That is the named anti-pattern
 *  (`docs/budget-scaling-laws-not-saturations`, plan offender d3). On the
 *  benchmark surface it also bought nothing the slack term did not already
 *  buy: the ramp is exactly 1 at ≥ 500k, so every promoted budget is
 *  byte-identical, and at ≤ 300k the slack gate is independently shut on ALL
 *  44 canonical v2 sources (max slack at 250k = 2.249 < the slack start), so
 *  the completion knee it claimed to protect is protected by the difficulty
 *  coordinate alone. Verified: 750k/500k/250k compiles byte-identical
 *  (track + budget telemetry + stats), the standing 250k reading at PARITY,
 *  and the only measured divergence in the (300k, 500k) sliver where the raw
 *  factor was the sole binding term. Off the benchmark surface the removal is
 *  a real and INTENDED behaviour change: a short spec can carry slack > 2.5 at
 *  200k, and there the arm now opens on its own coordinate instead of being
 *  held shut by a constant placed for the benchmark's operating point — which
 *  is what `compiler_scale_contract` asks for. What is left is a pure
 *  two-coordinate law — ask pressure × slack pressure — with a
 *  DIFFICULTY-conditioned magnitude and no benchmark-keyed constant. */
function impactBestForwardEvalConfig(
  base: CandidateForwardPolicy,
  node: SearchNode,
  gaps: Gap[],
  budgetSlack: number,
): CandidateForwardPolicy {
  if (!impactBestFwdEnabled()) return base;
  const ask = gaps[node.gapIndex]?.targets?.impact;
  if (ask === undefined) return base;
  const askPressure = smoothstep(
    (ask - impactBestFwdAskStart()) / IMPACT_BEST_FWD_ASK_SPAN,
  );
  if (askPressure <= 0) return base;
  const slackPressure = Number.isFinite(budgetSlack)
    ? smoothstep((budgetSlack - IMPACT_BEST_FWD_SLACK_START) / IMPACT_BEST_FWD_SLACK_SPAN)
    : 0;
  const pressure = askPressure * slackPressure;
  if (pressure <= 0 || unitHash(impactBestForwardEvalSeed(node)) >= pressure) return base;
  // The arm's OWN shape, on the gaps it owns: greedy IMPACT_BEST_FWD_DEPTH deep,
  // first rolled contact widened to IMPACT_BEST_FWD_BRANCH samples, deeper hops
  // single-draw.
  // The deeper hop is load-bearing speed/drift control (the depth-1 best:1:3
  // form paid +0.016 speed RMS on flow sources), so the shape is PINNED here
  // rather than inherited: under a moved base (`LR_FWD_EVAL_BASE`) inheriting
  // would either change what this arm does on its own gaps or — for any
  // non-greedy base — drop the widening silently, since `forwardArcValue`
  // dispatches `firstBranch` on `variant === "greedy"` alone. Byte-identical to
  // the previous `{ ...base, firstBranch }` whenever the base is `greedy:2:1`
  // (same keys, same insertion order, same values).
  return {
    ...base,
    variant: "greedy",
    depth: impactBestFwdDepth(),
    branch: 1,
    firstBranch: impactBestFwdBranch(),
  };
}

/** Sampled once per compile: read on every `rankedOptions` call through
 *  `adaptiveForwardEvalConfig`, and a raw `process.env` read is an interceptor
 *  call (~268 ns) not a property read. */
const readImpactBestFwd = compileScopedEnv("LR_IMPACT_BEST_FWD");

function impactBestFwdEnabled(): boolean {
  return readImpactBestFwd() !== "0";
}

/**
 * STUDY-ONLY re-scope knobs for the impact widening. **Never set either in
 * production, in a benchmark eval, or in a promotion candidate.**
 *
 * This arm is 62.8% of all rollout frames at 750k and 72% at 2.5M, and its
 * removal costs +4.59 ± 2.20 per cell — so the standing question is not whether
 * to keep it but whether its frames buy more when the GATE is narrower
 * (`..._ASK_START`, how much impact ask a gap needs before the widening is even
 * in play), the WIDTH is smaller (`..._BRANCH`, samples at the first rolled
 * contact), or the arm rolls one hop instead of two (`..._DEPTH`). All three
 * refuse out-of-range values rather than clamping: `ASK_START` must be a finite
 * number in [0, 1] (the impact ask's own domain), `BRANCH` an integer in [1, 8]
 * (1 disables the widening while keeping the arm's shape, 8 is the rollout
 * width clamp), and `DEPTH` an integer in [1, 2] — 2 is the arm's pinned shape,
 * 1 is the production base's own depth, and the interval is deliberately closed
 * there because depth 3 was measured negative on 5 of 6 sources (mandate
 * iteration 2's dose ladder) and this knob exists to price the arm's SECOND hop,
 * not to reopen deeper ones.
 *
 * MEASURED AND CLOSED 2026-08-04 (mandate iteration 6; 44 canonical v2 sources ×
 * 8 seeds × 750k, same-seed paired, 352 cells/arm, 352/352 valid in every arm):
 *  - `DEPTH=1` — flat −0.25 ± 0.76 (t = −0.33), suite-stratum-weighted
 *    −0.36 ± 0.76 (t = −0.48), 22/44 sources positive. A measured WASH, and the
 *    interesting part is what it costs: the arm's second hop is 41% of all
 *    rollout frames (M1 19.5% → 12.0%, −20.1M frames) yet total simulated frames
 *    move −0.14% — the charge is simply re-spent on search (forward-eval calls
 *    +8.8%), and the two uses price equal at 750k. So the second hop is NOT
 *    free-standing value the way mandate 2's base-depth ladder was; it is bought
 *    at exactly its market price. Any future "narrow the arm and spend the
 *    frames elsewhere" candidate starts from parity, not from a surplus, and
 *    inherits the free-judge ceiling (+1.78 ± 1.31).
 *  - `BRANCH=2` — flat −1.26 ± 0.69 (t = −1.82), suite-weighted −1.36 ± 0.71
 *    (t = −1.91), 14/44 sources positive, 2/8 seeds. The +1.23 ± 5.17 measured
 *    on the pre-promotion tree was noise and does not survive the re-probe;
 *    width 3 is confirmed as the local optimum for this arm.
 * Neither arm met the nomination bar (suite-weighted ≥ +0.3 at t ≥ 2), so the
 * DEPTH×BRANCH combination was not run — the composition rule requires both
 * factors to read ≥ 0 first. Both axes are CLOSED; these knobs stay as study
 * instruments, never production shapes.
 */
const readStudyImpactAskStart = compileScopedEnv("LR_STUDY_IMPACT_ASK_START");
const readStudyImpactBranch = compileScopedEnv("LR_STUDY_IMPACT_BRANCH");
const readStudyImpactDepth = compileScopedEnv("LR_STUDY_IMPACT_DEPTH");

function impactBestFwdAskStart(): number {
  const raw = readStudyImpactAskStart();
  if (raw === undefined || raw === "") return IMPACT_BEST_FWD_ASK_START;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(
      `LR_STUDY_IMPACT_ASK_START must be a finite number in [0, 1] (STUDY-ONLY; never set it ` +
        `in production or in an eval), got "${raw}"`,
    );
  }
  return n;
}

function impactBestFwdBranch(): number {
  const raw = readStudyImpactBranch();
  if (raw === undefined || raw === "") return IMPACT_BEST_FWD_BRANCH;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || String(n) !== raw.trim() || n < 1 || n > 8) {
    throw new Error(
      `LR_STUDY_IMPACT_BRANCH must be an integer in [1, 8] (STUDY-ONLY; never set it in ` +
        `production or in an eval), got "${raw}"`,
    );
  }
  return n;
}

function impactBestFwdDepth(): number {
  const raw = readStudyImpactDepth();
  if (raw === undefined || raw === "") return IMPACT_BEST_FWD_DEPTH;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || String(n) !== raw.trim() || n < 1 || n > 2) {
    throw new Error(
      `LR_STUDY_IMPACT_DEPTH must be an integer in [1, 2] (STUDY-ONLY; never set it in ` +
        `production or in an eval), got "${raw}"`,
    );
  }
  return n;
}

function impactBestForwardEvalSeed(node: SearchNode): number {
  return nodeHashSeed(node, 0x2545f491, 0x8cb92ba7);
}

function targetsVerticalDramaAxis(targets: AxisValues | undefined): boolean {
  return targets?.amplitude !== undefined || targets?.elevation !== undefined;
}

function verticalDramaForwardEvalPressure(node: SearchNode, gaps: Gap[]): number {
  const targets = gaps[node.gapIndex]?.targets;
  if (targets === undefined) return 0;
  if (!targetsVerticalDramaAxis(targets)) return 0;
  const amplitudePressure = targets.amplitude === undefined
    ? 0
    : smoothstep(
      (targets.amplitude - MATURE_AVG_FWD_EVAL_AMPLITUDE_START) /
        MATURE_AVG_FWD_EVAL_AMPLITUDE_SPAN,
    );
  const elevationPressure = targets.elevation === undefined
    ? 0
    : smoothstep(
      Math.abs(targets.elevation - MATURE_AVG_FWD_EVAL_ELEVATION_CENTER) /
        MATURE_AVG_FWD_EVAL_ELEVATION_SPAN,
    );
  const targetPressure = Math.max(amplitudePressure, elevationPressure);
  const nextGapIndex = nextContactGapIndex(gaps, node.gapIndex + 1);
  if (nextGapIndex < 0) return 1;
  const currentGap = gaps[node.gapIndex];
  const nextGap = gaps[nextGapIndex];
  const cadencePressure = 1 - smoothstep(
    (nextGap.endFrame - currentGap.endFrame - MATURE_AVG_FWD_EVAL_DENSE_FRAMES) /
      (MATURE_AVG_FWD_EVAL_SPARSE_FRAMES - MATURE_AVG_FWD_EVAL_DENSE_FRAMES),
  );
  return 1 + (targetPressure - 1) * cadencePressure;
}

function matureForwardEvalSeed(node: SearchNode): number {
  return nodeHashSeed(node, 0x632be59b);
}

function previewNextContact(
  child: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
): {
  horizon: number;
  landed: number;
  survivors: number;
  firstSurvivors: number;
  firstCost: number;
} {
  let node = child;
  const nextGapIndex = nextContactGapIndex(gaps, node.gapIndex);
  if (nextGapIndex < 0) {
    return {
      horizon: 0,
      landed: 0,
      survivors: 0,
      firstSurvivors: HANDOFF_PREVIEW_K,
      firstCost: 0,
    };
  }
  while (node.gapIndex < nextGapIndex) node = extendNodeCached(node, null);

  const candidates = getCandidatesSorted(node, gaps, ctx, seed, HANDOFF_PREVIEW_K);
  telemetry.previews++;
  telemetry.previewSurvivors += candidates.length;
  const firstSurvivors = candidates.length;
  const best = pickLowestCost(candidates);
  const firstCost = best === null ? Infinity : best.cost;
  if (best === null) {
    return {
      horizon: 1,
      landed: 0,
      survivors: candidates.length,
      firstSurvivors,
      firstCost,
    };
  }
  telemetry.previewContacts++;
  return {
    horizon: 1,
    landed: 1,
    survivors: candidates.length,
    firstSurvivors,
    firstCost,
  };
}

/** Speed (|v|) and signed heading (degrees, atan2 convention) of a velocity
 *  vector. Shared by the realized-arrival readiness telemetry and the node's
 *  start-state readout, which compute the exact same quantities. Callers that
 *  need an absolute angle or read `vx/vy`-shaped starts keep their own math. */
function speedAngleFromVelocity(
  v: { x: number; y: number },
): { speed: number; angleDeg: number } {
  return {
    speed: Math.hypot(v.x, v.y),
    angleDeg: (Math.atan2(v.y, v.x) * 180) / Math.PI,
  };
}

function handoffStatePenalty(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
): number {
  const rider = getRiderMetered(engine, gap.endFrame);
  const v = rider.velocity ?? { x: 0, y: 0 };
  const speed = Math.hypot(v.x, v.y);
  if (speed <= 1e-6) {
    return HANDOFF_STATE_WEIGHT * HANDOFF_STATE_STALL_WEIGHT_MULTIPLIER;
  }
  const angleDeg = Math.abs((Math.atan2(v.y, v.x) * 180) / Math.PI);
  const verticalExcess = Math.max(
    0,
    Math.abs(v.y) - HANDOFF_STATE_VERTICAL_EXCESS_PX_PER_FRAME,
  );
  const angleExcess = Math.max(0, angleDeg - HANDOFF_STATE_ANGLE_EXCESS_DEG) /
    HANDOFF_STATE_ANGLE_SCALE_DEG;
  return HANDOFF_STATE_WEIGHT * (verticalExcess + angleExcess);
}

function isTerminalNode(node: SearchNode, gaps: Gap[]): boolean {
  if (isLeafNode(node, gaps.length)) return true;
  return nextContactGapIndex(gaps, node.gapIndex) < 0;
}

function buildStartOptions(
  rawSpec: Spec,
  searchSpec: Spec,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  targetBudget: number,
): StartOption[] {
  const defaultStart = resolveStartState(searchSpec);
  const defaultSpecStart: NonNullable<Spec["start"]> = {
    x: defaultStart.position.x,
    y: defaultStart.position.y,
    vx: defaultStart.velocity.x,
    vy: defaultStart.velocity.y,
  };

  if (rawSpec.start !== undefined || (rawSpec.preroll ?? PREROLL.DEFAULT_S) <= 0) {
    return [{
      rank: 0,
      start: defaultSpecStart,
      state: defaultStart,
      startLines: [],
      root: makeStartRoot(defaultStart, [], gaps.length),
    }];
  }

  const axes = firstAxes(rawSpec);
  const starts = startCandidates(axes);
  const firstGapIndex = nextContactGapIndex(gaps, 0);
  const firstGap = firstGapIndex < 0 ? null : gaps[firstGapIndex];
  const firstContactAxes = firstGap === null ? null : effectiveAxes(firstGap, rawSpec);
  const ballisticStarts = firstGap === null ||
    firstContactAxes === null ||
    targetsVerticalDramaAxis(firstContactAxes)
    ? []
    : ballisticFirstContactStartCandidates(firstContactAxes, firstGap.endFrame);
  const seen = new Set<string>();
  const orderedBaseStarts = starts
    .sort((a, b) =>
      startHeuristicCost(a, axes) - startHeuristicCost(b, axes) ||
      startKey(a).localeCompare(startKey(b))
    );
  const orderedBallisticStarts = firstGap === null || firstContactAxes === null
    ? []
    : ballisticStarts.sort((a, b) =>
      ballisticFirstContactCost(a, firstContactAxes, firstGap.endFrame) -
        ballisticFirstContactCost(b, firstContactAxes, firstGap.endFrame) ||
      startKey(a).localeCompare(startKey(b))
    );
  const { baseStartPool, ballisticStartPool } = splitStartScoringPool(
    startBudgetPressure(targetBudget),
    orderedBallisticStarts.length,
  );
  const supportStarts = startupSupportStartSeeds(firstContactAxes, firstGap, targetBudget);
  const [first, ...rest] = [
    startSeed(defaultSpecStart),
    ...orderedBaseStarts.slice(0, baseStartPool).map((start) => startSeed(start)),
    ...orderedBallisticStarts.slice(0, ballisticStartPool).map((start) => startSeed(start)),
    ...supportStarts,
  ]
    .filter((seed) => {
      const key = startSeedKey(seed);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const heuristicPool = [
    first,
    ...rest
  ];

  if (!hasStartFeasibilityLookahead(gaps)) {
    return heuristicPool.slice(0, START_OPTION_LIMIT).map((candidate, rank) => {
      const state = resolveStartState({ ...searchSpec, start: candidate.start });
      return {
        rank,
        start: candidate.start,
        state,
        startLines: cloneTrackLines(candidate.startLines),
        root: makeStartRoot(state, candidate.startLines, gaps.length),
      };
    });
  }

  // Start-eval experiment: rank initial conditions by the TRUE forward score of where they lead
  // (charged) instead of the local axis-L2 feasibility proxy. The start is the most consequential
  // choice on a forward-dependent chain, yet it was the one decision still on the old proxy.
  const startCfg = startEvalConfig();
  const ordered = heuristicPool
    .map((candidate, originalRank) => {
      const state = resolveStartState({ ...searchSpec, start: candidate.start });
      const root = makeStartRoot(state, candidate.startLines, gaps.length);
      return {
        start: candidate.start,
        startLines: cloneTrackLines(candidate.startLines),
        state,
        root,
        originalRank,
        // Forward score is higher=better; negate so lower=better matches the proxy's ordering.
        score: startCfg !== null
          ? -startSeedForwardScore(candidate, root, gaps, ctx, seed, startCfg, targetBudget)
          : startFeasibilityCost(root, candidate.start, axes, gaps, ctx, seed),
      };
    })
    .sort((a, b) =>
      a.score - b.score ||
      startHeuristicCost(a.start, axes) - startHeuristicCost(b.start, axes) ||
      a.originalRank - b.originalRank ||
      startSeedKey(a).localeCompare(startSeedKey(b))
    )
    .slice(0, START_OPTION_LIMIT);

  return ordered.map(({ start, startLines, state, root }, rank) => ({
    rank,
    start,
    state,
    startLines,
    root,
  }));
}

function startSeed(
  start: NonNullable<Spec["start"]>,
  startLines: TrackLine[] = [],
  meta: Pick<StartSeed, "supportDelayFrames"> = {},
): StartSeed {
  return {
    start,
    startLines: cloneTrackLines(startLines),
    ...meta,
  };
}

function startupSupportStartSeeds(
  firstContactAxes: AxisValues | null,
  firstGap: Gap | null,
  targetBudget: number,
): StartSeed[] {
  if (firstGap === null || firstContactAxes === null) return [];
  const air = firstContactAxes.air;
  if (air === undefined) return [];
  if (firstGap.endFrame <= START_SUPPORT_RELEASE_MARGIN_FRAMES + K_BOUNCE_LANDING) return [];

  const targetAirborneFrames = Math.max(
    START_SUPPORT_RELEASE_MARGIN_FRAMES,
    Math.round(firstGap.endFrame * air),
  );
  const releaseFrame = firstGap.endFrame - targetAirborneFrames;
  if (releaseFrame < START_SUPPORT_MIN_RUNUP_FRAMES) return [];
  const targetSpeed = startTargetSpeedPx(firstContactAxes);
  const offsets = air <= START_SUPPORT_LOW_AIR_MAX ? [-0.75, 0, 1.25] : [0];
  const speeds = uniqueRounded(offsets.map((offset) => targetSpeed + offset))
    .filter((speed) => speed > 0 && speed <= START_DEFAULTS.VELOCITY_SANITY_CAP);

  const xDelayFrames = startupSupportXDelayFrames(air, firstGap.endFrame, targetBudget);
  return speeds.flatMap((vx) => xDelayFrames.map((delayFrames) => {
    const x2 = round3(Math.max(20, vx * releaseFrame));
    const line = makeSolidLine(
      1,
      -START_SUPPORT_LINE_BACKTRACK_PX,
      START_SUPPORT_LINE_Y,
      x2,
      START_SUPPORT_LINE_Y,
    );
    const x = round3(-vx * delayFrames);
    return startSeed(
      { ...(x === 0 ? {} : { x }), vx: round3(vx), vy: 0 },
      [line],
      { supportDelayFrames: delayFrames },
    );
  }));
}

function startupSupportXDelayFrames(
  air: number,
  firstGapEndFrame: number,
  targetBudget: number,
): readonly number[] {
  if (air > START_SUPPORT_X_DELAY_AIR_MAX) return [0];
  const airPressure = air <= START_SUPPORT_LOW_AIR_MAX
    ? 1
    : smoothstep(
      (START_SUPPORT_X_DELAY_AIR_MAX - air) /
        (START_SUPPORT_X_DELAY_AIR_MAX - START_SUPPORT_LOW_AIR_MAX),
    );
  const durationPressure = smoothstep(
    (firstGapEndFrame - START_SUPPORT_X_DELAY_FIRST_GAP_START_FRAMES) /
      START_SUPPORT_X_DELAY_FIRST_GAP_SPAN_FRAMES,
  );
  const budgetPressure = startBudgetPressure(targetBudget);
  const pressure = airPressure * durationPressure * budgetPressure;
  const maxDelay = clampIntLocal(
    (START_SUPPORT_LOW_AIR_X_DELAY_FRAMES.length - 1) * pressure,
    0,
    START_SUPPORT_LOW_AIR_X_DELAY_FRAMES.length - 1,
  );
  return START_SUPPORT_LOW_AIR_X_DELAY_FRAMES.slice(0, maxDelay + 1);
}

function startSeedForwardScore(
  seed: StartSeed,
  root: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  searchSeed: number,
  cfg: StartForwardPolicy,
  targetBudget: number,
): number {
  const baseScore = startForwardScore(root, gaps, ctx, searchSeed, cfg);
  if (
    (seed.supportDelayFrames ?? 0) <= 0 ||
    cfg.variant !== "greedy" ||
    cfg.depth !== 2 ||
    cfg.branch !== 1
  ) {
    return baseScore;
  }
  const pressure = startBudgetPressure(targetBudget);
  if (pressure <= 0) return baseScore;
  const robustScore = startSupportDelayRobustScore(
    root,
    gaps,
    ctx,
    searchSeed,
    START_SUPPORT_DELAY_ROBUST_BRANCH,
  );
  return baseScore * (1 - pressure) + robustScore * pressure;
}

/**
 * KEPT, AND PINNED — read this before "simplifying" it away.
 *
 * `smoothstep((B - 50k)/50k)` is exactly 1.0 at every B >= 100,000 frames, so on
 * the whole benchmark grid this is the constant 1 and its three consumers (the
 * ballistic/base split of the start scoring pool, the start-support x-delay
 * count, and the support-delay robust-score blend) are budget-blind. Deleting it
 * is byte-identical at 250k and 750k — 40/40 golden track hashes, verified.
 *
 * It is NOT dead. Below 100k it is the start phase's scarce-budget behaviour,
 * and shipping the mature branch unconditionally was measured on golden v1:
 * together with the objective's mature/scarce ramps it costs -13.0 mean score
 * per run at 75k and turns 0 missing contacts into 236 across 480 runs. At 75k
 * it hands 2 of the 15 shareable scoring seeds to ballistic starts instead of 4
 * and blends the support-delay score half-and-half instead of taking the robust
 * branch whole; that is a completion reserve, and the measurement says it works.
 *
 * The Phase 3 disposition is therefore "documented sub-250k insurance", not
 * "constant" and not "law". A law here would have to be scale-free in the start
 * pool's size, which nothing has proposed; do not re-sweep a ramp that never
 * varies at a canonical budget.
 */
function startBudgetPressure(targetBudget: number): number {
  return smoothstep(
    (Math.max(0, targetBudget) - START_BUDGET_PRESSURE_START_FRAMES) /
      START_BUDGET_PRESSURE_SPAN_FRAMES,
  );
}

function startSupportDelayRobustScore(
  root: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  branch: number,
): number {
  const at = advanceToNextContact(root, gaps);
  if (at === null) return forwardNodeScore(root, gaps, ctx);
  let candidates = getCandidatesSorted(at, gaps, ctx, seed, branch);
  if (candidates.length === 0) {
    candidates = redrawFirstHopOnEmpty(at, gaps, ctx, seed, branch);
  }
  if (candidates.length === 0) return forwardNodeScore(root, gaps, ctx);
  let sum = 0;
  for (const candidate of candidates) {
    sum += forwardRolloutScore(
      extendNodeCached(at, candidate),
      gaps,
      ctx,
      seed,
      1,
      1,
      false, // start-selection robust score stays full-leaf
      root.gapIndex, // start pool boundary; inert on the full leaf and at gapIndex 0 anyway
    );
  }
  return sum / candidates.length;
}

function makeStartRoot(
  state: ResolvedStart,
  startLines: TrackLine[],
  gapCount: number,
): SearchNode {
  let engine = makeBaseEngine(state);
  if (startLines.length > 0) {
    engine = engine.addLine(startLines.map((line) => engineLineFromTrackLine(line)));
  }
  return {
    ...makeRootNode(engine, gapCount),
    prefixNextLineId: 1 + startLines.length,
  };
}

export function hasStartFeasibilityLookahead(gaps: Gap[]): boolean {
  const firstGapIndex = nextContactGapIndex(gaps, 0);
  if (firstGapIndex < 0) return false;
  const secondGapIndex = nextContactGapIndex(gaps, firstGapIndex + 1);
  return secondGapIndex >= 0;
}

function startFeasibilityCost(
  root: SearchNode,
  start: NonNullable<Spec["start"]>,
  axes: AxisValues,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
): number {
  const firstGapIndex = nextContactGapIndex(gaps, root.gapIndex);
  if (firstGapIndex < 0) return START_HEURISTIC_WEIGHT * startHeuristicCost(start, axes);
  let prefix = root;
  while (prefix.gapIndex < firstGapIndex) prefix = extendNodeCached(prefix, null);

  const firstCandidates = getCandidatesSorted(prefix, gaps, ctx, seed, START_FIRST_K);

  if (firstCandidates.length === 0) {
    return DEAD_END_PENALTY * 2 + START_HEURISTIC_WEIGHT * startHeuristicCost(start, axes);
  }

  const useOvershootStartScoring = usesHighSpeedStartOvershootScoring(axes);
  let best = Infinity;
  for (const candidate of firstCandidates.slice(0, START_FIRST_OPTIONS)) {
    const child = extendNodeCached(prefix, candidate);
    const nextGapIndex = nextContactGapIndex(gaps, child.gapIndex);
    if (nextGapIndex < 0) {
      best = Math.min(best, startCandidateCost(candidate, gaps[firstGapIndex], useOvershootStartScoring));
      continue;
    }
    let nextPrefix = child;
    while (nextPrefix.gapIndex < nextGapIndex) nextPrefix = extendNodeCached(nextPrefix, null);
    const nextCandidates = getCandidatesSorted(nextPrefix, gaps, ctx, seed, START_NEXT_K);
    const nextBest = pickLowestCost(nextCandidates);
    const firstCost = startCandidateCost(candidate, gaps[firstGapIndex], useOvershootStartScoring);
    const nextCost = nextBest === null
      ? 0
      : startCandidateCost(nextBest, gaps[nextGapIndex], useOvershootStartScoring) * PREVIEW_COST_WEIGHT;
    const nextPenalty = nextCandidates.length === 0
      ? DEAD_END_PENALTY
      : SURVIVOR_SCARCITY_PENALTY / nextCandidates.length;
    best = Math.min(best, firstCost + nextPenalty + nextCost);
  }

  return best + START_HEURISTIC_WEIGHT * startHeuristicCost(start, axes);
}

function startCandidateCost(
  candidate: Candidate,
  gap: Gap,
  useOvershootStartScoring: boolean,
): number {
  return candidate.cost +
    (useOvershootStartScoring ? candidateOvershootPenalty(candidate, gap) : 0);
}

export function usesHighSpeedStartOvershootScoring(axes: AxisValues): boolean {
  return startTargetSpeedPx(axes) >= SPEED_AXIS.HIGH_START_PX_PER_FRAME;
}

function startCandidates(firstAxes: AxisValues): NonNullable<Spec["start"]>[] {
  const targetSpeed = startTargetSpeedPx(firstAxes);
  const speeds = startSpeedAnchors(targetSpeed);
  const angles = startAngles(firstAxes);
  const out: NonNullable<Spec["start"]>[] = [];
  for (const speed of speeds) {
    for (const angleDeg of angles) {
      const angle = (angleDeg * Math.PI) / 180;
      out.push({
        vx: round3(Math.cos(angle) * speed),
        vy: round3(Math.sin(angle) * speed),
      });
    }
  }
  return out;
}

function ballisticFirstContactStartCandidates(
  firstContactAxes: AxisValues,
  firstContactFrame: number,
): NonNullable<Spec["start"]>[] {
  const targetSpeed = startTargetSpeedPx(firstContactAxes);
  const speeds = startSpeedAnchors(targetSpeed);
  const impactAngles = startAngles(firstContactAxes);
  const gravityVy = ELEVATION.GRAVITY_PX_PER_FRAME2 * Math.max(1, firstContactFrame);
  const out: NonNullable<Spec["start"]>[] = [];
  for (const speed of speeds) {
    for (const angleDeg of impactAngles) {
      const angle = (angleDeg * Math.PI) / 180;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - gravityVy;
      const startSpeed = Math.hypot(vx, vy);
      if (vx <= 0 || startSpeed <= 0 || startSpeed > START_DEFAULTS.VELOCITY_SANITY_CAP) continue;
      out.push({ vx: round3(vx), vy: round3(vy) });
    }
  }
  return out;
}

/**
 * Divide the START_SCORING_POOL seed budget between base (heuristic) and
 * ballistic first-contact starts.
 *
 * Slot 0 of the scoring pool is always reserved for the default spec start, so
 * only `START_SCORING_POOL - 1` seeds are shareable. Up to
 * `START_BALLISTIC_SCORING_POOL` of those shareable seeds go to ballistic
 * starts, capped by how many ballistic candidates actually exist
 * (`availableBallisticStarts`). Every seed not taken by ballistic starts goes to
 * base starts. In practice this yields 0-4 ballistic seeds.
 */
function splitStartScoringPool(
  budgetPressure: number,
  availableBallisticStarts: number,
): { baseStartPool: number; ballisticStartPool: number } {
  const shareableSeeds = START_SCORING_POOL - 1;
  const ballisticStartPool = Math.min(
    START_BALLISTIC_SCORING_POOL,
    availableBallisticStarts,
    Math.floor(START_BALLISTIC_SCORING_POOL * budgetPressure),
  );
  const baseStartPool = Math.max(0, shareableSeeds - ballisticStartPool);
  return { baseStartPool, ballisticStartPool };
}

export function startSpeedAnchors(targetSpeedPxPerFrame: number): number[] {
  return uniqueRounded([
    START_DEFAULTS.VELOCITY.x,
    ...START_SPEED_ANCHOR_OFFSETS_PX_PER_FRAME.map((offset) => targetSpeedPxPerFrame + offset),
    targetSpeedPxPerFrame * 0.75,
    targetSpeedPxPerFrame * 1.2,
  ])
    .filter((speed) => speed > 0 && speed <= START_DEFAULTS.VELOCITY_SANITY_CAP);
}

function startHeuristicCost(start: NonNullable<Spec["start"]>, axes: AxisValues): number {
  const speed = Math.hypot(start.vx, start.vy);
  const angle = (Math.atan2(start.vy, start.vx) * 180) / Math.PI;
  return startAngleSpeedCost(speed, angle, axes, true);
}

function ballisticFirstContactCost(
  start: NonNullable<Spec["start"]>,
  firstContactAxes: AxisValues,
  firstContactFrame: number,
): number {
  const impactVy = start.vy + ELEVATION.GRAVITY_PX_PER_FRAME2 * Math.max(1, firstContactFrame);
  const speed = Math.hypot(start.vx, impactVy);
  const angle = (Math.atan2(
    impactVy,
    start.vx,
  ) * 180) / Math.PI;
  // Rank ballistic starts by first-contact state, with a small initial-state
  // bias so extreme launch velocities do not win on impact fit alone.
  return startAngleSpeedCost(speed, angle, firstContactAxes) +
    START_HEURISTIC_WEIGHT * startHeuristicCost(start, firstContactAxes);
}

function startAngleSpeedCost(
  speed: number,
  angleDeg: number,
  axes: AxisValues,
  includeLowSpeedPenalty = false,
): number {
  const targetSpeed = startTargetSpeedPx(axes);
  const targetAngle = targetStartAngle(axes);
  const speedCost = Math.pow((speed - targetSpeed) / SPEED_AXIS.RANGE_PX_PER_FRAME, 2);
  const angleCost = Math.pow((angleDeg - targetAngle) / START_ANGLE_NORM_DEG, 2);
  const lowSpeedPenalty = includeLowSpeedPenalty &&
      targetSpeed >= START_LOW_SPEED_TARGET_MIN_PX &&
      speed < targetSpeed * START_LOW_SPEED_RATIO
    ? 1
    : 0;
  return speedCost + START_ANGLE_COST_WEIGHT * angleCost + lowSpeedPenalty;
}

function startTargetSpeedPx(axes: AxisValues): number {
  return axes.speed === undefined
    ? SPEED_AXIS.UNTARGETED_START_PX_PER_FRAME
    : authoredSpeedToPx(axes.speed);
}

export function targetStartAngle(axes: AxisValues): number {
  const air = axes.air ?? 0.5;
  return Math.max(-12, Math.min(24, 6 + (0.5 - air) * 90));
}

export function startAngles(firstAxes: AxisValues): number[] {
  const center = targetStartAngle(firstAxes);
  return [-26, -13, 0, 13, 26].map((offset) => round3(center + offset));
}

function firstAxes(spec: Spec): AxisValues {
  // Axis targets active at the start of the track (t=0). `axesAtFrame` resolves
  // both the curve form (each curve at t=0) and the legacy section form (the
  // section covering t=0), so this stays form-agnostic across the migration.
  return axesAtFrame(0, spec);
}

function meanAuthoredImpactAfterFirstFeasibleContact(contacts: Spec["contacts"]): number {
  const impacts = contacts
    .slice(1)
    .map((contact) => contact.impact)
    .filter((impact): impact is number => impact !== undefined);
  if (impacts.length === 0) return 0;
  return impacts.reduce((sum, impact) => sum + impact, 0) / impacts.length;
}

function meanAuthoredImpactPrevalence(contacts: Spec["contacts"]): number {
  let sum = 0;
  let count = 0;
  for (const contact of contacts) {
    if (secToFrame(contact.t) < K_BOUNCE_LANDING) continue;
    sum += contact.impact ?? 0;
    count++;
  }
  return count > 0 ? sum / count : 0;
}

function cadenceRoomPressure(medianGapFrames: number): number {
  return smoothstep((medianGapFrames - CADENCE_ROOM_START_FRAMES) / CADENCE_ROOM_SPAN_FRAMES);
}

type ImpactCurveProfileStats = {
  contactCount: number;
  impactTargets: number;
  curveElevationValues: readonly number[];
  profileElevationValues: readonly number[];
  medianGapFrames: number | null;
  meanAir: number | null;
  meanSpeed: number | null;
  meanImpact: number | null;
  verticalFraction: number;
};

function finiteMean(sum: number, count: number): number | null {
  return count > 0 ? sum / count : null;
}

function valueRange(values: readonly number[]): number {
  return Math.max(...values) - Math.min(...values);
}

function impactCurveProfileStats(
  gaps: readonly Gap[],
  gapAxisTargets: readonly AxisValues[],
): ImpactCurveProfileStats {
  const contactGapFrames: number[] = [];
  const curveElevationValues: number[] = [];
  const profileElevationValues: number[] = [];
  let contactCount = 0;
  let impactTargets = 0;
  let verticalTargets = 0;
  let airSum = 0;
  let airCount = 0;
  let speedSum = 0;
  let speedCount = 0;
  let impactSum = 0;
  let impactCount = 0;

  for (const gap of gaps) {
    if (!gap.endsWithContact) continue;
    contactCount++;
    contactGapFrames.push(gap.endFrame - gap.startFrame);
    if (gap.targets.impact !== undefined) impactTargets++;

    const axisTargets = gapAxisTargets[gap.index];
    const curveElevation = axisTargets?.elevation;
    if (typeof curveElevation === "number" && Number.isFinite(curveElevation)) {
      curveElevationValues.push(curveElevation);
    }

    const targets = axisTargets ?? gap.targets;
    if (targets.elevation !== undefined || targets.amplitude !== undefined) verticalTargets++;
    if (typeof targets.air === "number" && Number.isFinite(targets.air)) {
      airSum += targets.air;
      airCount++;
    }
    if (typeof targets.speed === "number" && Number.isFinite(targets.speed)) {
      speedSum += targets.speed;
      speedCount++;
    }
    if (typeof targets.impact === "number" && Number.isFinite(targets.impact)) {
      impactSum += targets.impact;
      impactCount++;
    }
    if (typeof targets.elevation === "number" && Number.isFinite(targets.elevation)) {
      profileElevationValues.push(targets.elevation);
    }
  }

  const sortedGaps = [...contactGapFrames].sort((a, b) => a - b);
  const medianGapFrames = sortedGaps.length === 0
    ? null
    : sortedGaps[Math.floor(sortedGaps.length / 2)];

  return {
    contactCount,
    impactTargets,
    curveElevationValues,
    profileElevationValues,
    medianGapFrames,
    meanAir: finiteMean(airSum, airCount),
    meanSpeed: finiteMean(speedSum, speedCount),
    meanImpact: finiteMean(impactSum, impactCount),
    verticalFraction: contactCount > 0 ? verticalTargets / contactCount : 0,
  };
}

function impactCurveElevationRoomPressure(stats: ImpactCurveProfileStats): number {
  const elevationValues = stats.curveElevationValues;
  if (
    stats.impactTargets === 0 ||
    elevationValues.length < 2 ||
    stats.medianGapFrames === null
  ) {
    return 0;
  }
  const elevationRange = valueRange(elevationValues);
  const elevationPressure = smoothstep((elevationRange - 0.10) / 0.14);
  if (elevationPressure <= 0) return 0;
  const roomPressure = cadenceRoomPressure(stats.medianGapFrames);
  return clamp01(elevationPressure * roomPressure);
}

function impactCurveHighSpeedReliefProfilePressure(stats: ImpactCurveProfileStats): number {
  const elevationValues = stats.profileElevationValues;
  if (
    stats.impactTargets === 0 ||
    stats.meanSpeed === null ||
    elevationValues.length < 2
  ) {
    return 0;
  }
  const speedPressure = smoothstep(
    (stats.meanSpeed - IMPACT_CURVE_HIGH_SPEED_RELIEF_SPEED_START) /
      IMPACT_CURVE_HIGH_SPEED_RELIEF_SPEED_SPAN,
  );
  if (speedPressure <= 0) return 0;
  const elevationRange = valueRange(elevationValues);
  const elevationPressure = smoothstep(
    (elevationRange - IMPACT_CURVE_HIGH_SPEED_RELIEF_ELEVATION_RANGE_START) /
      IMPACT_CURVE_HIGH_SPEED_RELIEF_ELEVATION_RANGE_SPAN,
  );
  const manageableElevationPressure = 1 - smoothstep(
    (elevationRange - IMPACT_CURVE_HIGH_SPEED_RELIEF_ELEVATION_RANGE_END) /
      IMPACT_CURVE_HIGH_SPEED_RELIEF_ELEVATION_RANGE_END_SPAN,
  );
  if (stats.medianGapFrames === null) return 0;
  const roomPressure = cadenceRoomPressure(stats.medianGapFrames);
  return clamp01(speedPressure * elevationPressure * manageableElevationPressure * roomPressure);
}

function impactTemplateHoldProfilePressure(stats: ImpactCurveProfileStats): number {
  if (
    stats.contactCount === 0 ||
    stats.meanAir === null ||
    stats.meanSpeed === null ||
    stats.meanImpact === null
  ) {
    return 0;
  }
  if (stats.medianGapFrames === null) return 0;

  const contactPressure = smoothstep((stats.contactCount - 40) / 12);
  const denseCadencePressure = 1 - smoothstep((stats.medianGapFrames - 28) / 14);
  const lowAirPressure = 1 - smoothstep((stats.meanAir - 0.50) / 0.10);
  const lowSpeedPressure = 1 - smoothstep((stats.meanSpeed - 0.56) / 0.10);
  const lowImpactProfile = 1 - smoothstep((stats.meanImpact - 0.30) / 0.10);
  const verticalQuietPressure = 1 - smoothstep((stats.verticalFraction - 0.02) / 0.18);
  return clamp01(
    contactPressure * denseCadencePressure * lowAirPressure * lowSpeedPressure *
      lowImpactProfile * verticalQuietPressure,
  );
}

function uniqueRounded(xs: number[]): number[] {
  const out: number[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const rounded = round3(x);
    const key = rounded.toFixed(3);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rounded);
  }
  return out;
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

function round6(x: number): number {
  return Math.round(x * 1_000_000) / 1_000_000;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function smoothstep(x: number): number {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

function clampIntLocal(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(x)));
}

function startKey(start: NonNullable<Spec["start"]>): string {
  return `${(start.x ?? 0).toFixed(3)},${(start.y ?? 0).toFixed(3)},` +
    `${start.vx.toFixed(3)},${start.vy.toFixed(3)}`;
}

function startSeedKey(seed: { start: NonNullable<Spec["start"]>; startLines: TrackLine[] }): string {
  return `${startKey(seed.start)}|${seed.startLines.map(startLineKey).join(";")}`;
}

function startLineKey(line: TrackLine): string {
  return [
    line.id,
    line.type,
    line.x1.toFixed(3),
    line.y1.toFixed(3),
    line.x2.toFixed(3),
    line.y2.toFixed(3),
    line.flipped ? 1 : 0,
    line.leftExtended ? 1 : 0,
    line.rightExtended ? 1 : 0,
  ].join(",");
}

function evaluateNode(
  node: HandoffNode,
  spec: Spec,
  gaps: Gap[],
  allContactFrames: number[],
  durationFrames: number,
  gapAxisTargets: AxisValues[],
): {
  report: DriftReport;
  key: LeafKey;
  outputDurationFrames: number;
  fullDuration: boolean;
} {
  const fullDuration = isTerminalNode(node.search, gaps);
  const partialHorizonFrame = fullDuration
    ? durationFrames
    : processedHorizonFrame(node.search, gaps);
  const outputDurationFrames = fullDuration
    ? durationFrames + OUTPUT_TAIL_PAD_FRAMES
    : partialOutputDurationFrames(partialHorizonFrame, durationFrames);
  const det = detectWindow(node.search.prefixEngine, 0, outputDurationFrames);
  const fits = paddedFits(node, gaps.length);
  const rawReport = buildDriftReport(
    det, spec, gaps, allContactFrames, durationFrames, [], fits, gapAxisTargets,
  );
  const report = fullDuration ? rawReport : asPartialReport(rawReport, partialHorizonFrame);
  return {
    report,
    key: leafKeyForReport(report, durationFrames),
    outputDurationFrames,
    fullDuration,
  };
}

function processedHorizonFrame(
  node: SearchNode,
  gaps: Gap[],
): number {
  for (let i = Math.min(node.gapIndex, gaps.length) - 1; i >= 0; i--) {
    if (gaps[i].endsWithContact) return gaps[i].endFrame;
  }
  return 0;
}

function partialOutputDurationFrames(horizonFrame: number, durationFrames: number): number {
  return Math.max(1, Math.min(durationFrames, horizonFrame + OUTPUT_TAIL_PAD_FRAMES));
}

function asPartialReport(report: DriftReport, horizonFrame: number): DriftReport {
  const reachedContacts = report.contacts
    .filter((contact) => secToFrame(contact.t_target) <= horizonFrame);
  const futureContacts = report.contacts
    .filter((contact) => secToFrame(contact.t_target) > horizonFrame)
    .slice(0, PARTIAL_FUTURE_CONTACT_WINDOW)
    .map((contact) => ({
      t_target: contact.t_target,
      t_actual: null,
      frame_error: null,
      status: "missing" as const,
    }));
  return {
    ...report,
    contacts: [...reachedContacts, ...futureContacts],
    gaps: report.gaps
      .filter((gap) => secToFrame(gap.t_end) <= horizonFrame),
    off_beat_landings: report.off_beat_landings
      .filter((landing) => landing.frame <= horizonFrame),
    terminus: {
      frame: Math.min(report.terminus.frame, horizonFrame),
      reason: report.terminus.reason === "endOfSpec" ? "rideStalled" : report.terminus.reason,
    },
  };
}

function buildNodeOutput(
  node: HandoffNode,
  report: DriftReport,
  gaps: Gap[],
  outputDurationFrames: number,
  budgetExhausted: boolean,
): CompileOutput {
  const fits = paddedFits(node, gaps.length);
  const allLines = [...node.startLines];
  for (const fit of fits) if (fit !== null) allLines.push(...fit.lines);
  const { speed: startSpeed, angleDeg: startAngleDeg } = speedAngleFromVelocity(
    node.startState.velocity,
  );
  const candidateRanks = selectedCandidateRanks(node.rankTrace);
  const candidateRankSum = candidateRanks.reduce((sum, rank) => sum + rank, 0);
  const candidateRankCount = candidateRanks.length;
  const { bySource: sourceCounts, byAxis: axisQualitySourceCounts } =
    selectedSourceCounts(node);
  const repairAuxCertificates = fits.flatMap((fit, selectedGapIndex) => {
    const emission = fit?.repairAuxStudyCertificate;
    if (emission === undefined) return [];
    return [{
      selected_gap_index: selectedGapIndex,
      emission,
      final_current_gap:
        report.gaps.find((gap) => gap.gap_index === emission.gapIndex) ?? null,
      final_next_gap:
        report.gaps.find((gap) => gap.gap_index === emission.nextGapIndex) ?? null,
    }];
  });
  return {
    track: buildTrackJson(allLines, outputDurationFrames, node.startState),
    report,
    budgetTelemetry: null,
    stats: {
      actual_candidate_samples: getCandidateSamples(),
      viable_candidate_samples: getViableCandidates(),
      engine_rebuilds: getEngineRebuildCount(),
      gap_commits: fits.filter((fit) => fit !== null).length,
      gap_backtracks: 0,
      validation_retries: 0,
      polish_iterations: 0,
      total_committed_cost: node.search.cumulativeCost,
      committed_costs_per_gap: fits.map((fit) => fit === null ? null : fit.cost),
      sim_frames: getSimFrames(),
      ballistic_micro_sim_frames: getMicroSimFrames(),
      ...objectiveLayerSpreadStat(),
      budget_exhausted: budgetExhausted,
      handoff_skips: node.skippedContacts,
      handoff_start_rank: node.startRank,
      handoff_start_lines: node.startLines.length,
      handoff_start_speed: round3(startSpeed),
      handoff_start_angle_deg: round3(startAngleDeg),
      handoff_search_seed: node.searchSeed,
      handoff_selected_candidate_rank_count: candidateRankCount,
      handoff_selected_candidate_rank_mean: candidateRankCount === 0
        ? 0
        : round3(candidateRankSum / candidateRankCount),
      handoff_selected_candidate_rank_max: candidateRanks.reduce(
        (max, rank) => Math.max(max, rank),
        0,
      ),
      handoff_selected_candidate_nonzero_ranks:
        candidateRanks.filter((rank) => rank > 0).length,
      handoff_selected_candidate_by_source: { ...sourceCounts },
      // How many committed fits in THIS returned output came from the proposer.
      // This is final-track composition, not a search-level selection rate;
      // `aim.aimed_*` records exact-pool placement and `aim.enum_emitted` the
      // primary admitted-candidate count.
      handoff_aimed_selected: fits.filter((fit) => fit !== null && fit.aimed === true).length,
      ...(repairAuxCertificates.length === 0
        ? {}
        : { handoff_repair_aux_selected_certificates: repairAuxCertificates }),
      handoff_selected_axis_quality_by_axis: axisQualitySourceCounts,
    },
  };
}

type BallisticErrorAccumulator = {
  pairs: number;
  absErrorSum: number;
  signedErrorSum: number;
  maxAbsError: number;
};

type SelectedBallisticTransitionStats =
  NonNullable<CompileStats["ballistic_selected_transitions"]>;

/**
 * Validate only transitions in the returned best path. The projected values
 * and the exact next-gap values describe the same inclusive scorer interval;
 * no candidate-loop simulation, look-ahead truth, or benchmark-only model is
 * involved.
 */
function selectedBallisticTransitionStats(
  fits: readonly (GapFit | null)[],
  gaps: readonly Gap[],
  gapAxisTargets: readonly AxisValues[],
): SelectedBallisticTransitionStats | null {
  let eligible = 0;
  let projected = 0;
  const speed = emptyBallisticErrorAccumulator();
  const air = emptyBallisticErrorAccumulator();
  const elevation = emptyBallisticErrorAccumulator();

  for (let index = 0; index < gaps.length; index++) {
    const fit = fits[index];
    if (fit === null || !gaps[index].endsWithContact) continue;
    const nextIndex = nextContactGapIndex(gaps, index + 1);
    if (nextIndex < 0) continue;
    const nextFit = fits[nextIndex];
    if (nextFit === null) continue;
    eligible++;

    const projectedOutgoing = projectOutgoingScorerGap(
      fit,
      gaps[nextIndex],
      gapAxisTargets,
    );
    if (projectedOutgoing === null) continue;
    const prediction = projectedOutgoing.projection;
    projected++;

    recordBallisticError(
      speed,
      speedPxToAuthored(prediction.meanSpeedPx),
      nextFit.achieved.speed,
    );
    recordBallisticError(
      air,
      projectedOutgoing.achieved.air,
      nextFit.achieved.air,
    );
    recordBallisticError(
      elevation,
      prediction.elevation,
      nextFit.achieved.elevation,
    );
  }

  if (eligible === 0) return null;
  return {
    eligible,
    projected,
    unprojectable: eligible - projected,
    speed: summarizeBallisticErrors(speed),
    air: summarizeBallisticErrors(air),
    elevation: summarizeBallisticErrors(elevation),
  };
}

function emptyBallisticErrorAccumulator(): BallisticErrorAccumulator {
  return {
    pairs: 0,
    absErrorSum: 0,
    signedErrorSum: 0,
    maxAbsError: 0,
  };
}

function recordBallisticError(
  accumulator: BallisticErrorAccumulator,
  predicted: number | null | undefined,
  actual: number | null | undefined,
): void {
  if (
    predicted === null ||
    predicted === undefined ||
    actual === null ||
    actual === undefined ||
    !Number.isFinite(predicted) ||
    !Number.isFinite(actual)
  ) return;
  const error = predicted - actual;
  const absolute = Math.abs(error);
  accumulator.pairs++;
  accumulator.absErrorSum += absolute;
  accumulator.signedErrorSum += error;
  accumulator.maxAbsError = Math.max(accumulator.maxAbsError, absolute);
}

function summarizeBallisticErrors(
  accumulator: BallisticErrorAccumulator,
): BallisticPredictionErrorSummary {
  if (accumulator.pairs === 0) {
    return {
      pairs: 0,
      mae: null,
      bias: null,
      max_abs_error: null,
    };
  }
  return {
    pairs: accumulator.pairs,
    mae: round6(accumulator.absErrorSum / accumulator.pairs),
    bias: round6(accumulator.signedErrorSum / accumulator.pairs),
    max_abs_error: round6(accumulator.maxAbsError),
  };
}

/** Single pass over `node.rankTrace` producing both the per-source selection
 *  counts and, for the axis-quality source, the per-axis breakdown. */
function selectedSourceCounts(node: HandoffNode): {
  bySource: Record<HandoffCandidateSourceName, number>;
  byAxis: Partial<Record<AxisName, number>>;
} {
  const bySource = Object.fromEntries(
    HANDOFF_CANDIDATE_SOURCES.map((source) => [source, 0]),
  ) as Record<HandoffCandidateSourceName, number>;
  const byAxis: Partial<Record<AxisName, number>> = {};
  for (const entry of node.rankTrace) {
    if (entry.rank < 0) continue;
    const source = entry.source;
    if (source === "skip") continue;
    bySource[source]++;
    if (source === "axisq") {
      const axis = entry.sourceAxis;
      if (axis !== undefined) byAxis[axis] = (byAxis[axis] ?? 0) + 1;
    }
  }
  return { bySource, byAxis };
}

function selectedCandidateRanks(trace: HandoffRankTraceEntry[]): number[] {
  return trace
    .filter((entry) => entry.rank >= 0)
    .map((entry) => entry.rank);
}

function paddedFits(node: HandoffNode, gapCount: number): (GapFit | null)[] {
  const fits = node.search.prefixFits.slice();
  while (fits.length < gapCount) fits.push(null);
  return fits;
}
