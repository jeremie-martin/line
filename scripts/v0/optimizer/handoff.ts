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
 * (spec, seed, budget). NOTE: this step's search does not yet READ the budget to
 * change its policy — making it budget-aware is the next project (see
 * `docs/compiler_goals.md`).
 */

import { getRiderMetered, K_BOUNCE_LANDING } from "../../lib/detector.ts";
import { makeRng } from "../../lib/rng.ts";
import {
  type GapFit,
  type ResolvedStart,
  axesAtFrame,
  buildDriftReport,
  buildTrackJson,
  effectiveAxes,
  engineLineFromTrackLine,
  impactFeasibilityBound,
  makeBaseEngine,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
} from "../core/substrate.ts";
import {
  AXES,
  AXIS_VALUE_MAX,
  CALIB,
  FPS,
  HANDOFF_CANDIDATE_SOURCES,
  HANDOFF_EVALUATION_PHASES,
  ELEVATION,
  SPEED_AXIS,
  START_DEFAULTS,
  authoredSpeedToPx,
  speedPxToAuthored,
  PREROLL,
  secToFrame,
  type AxisName,
  type AxisValues,
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
  getCandidatesSorted,
  extendNodeCached,
  isLeafNode,
  makeRootNode,
  setRolloutContext,
  type SearchNode,
} from "./node.ts";
import {
  candidateQualityObjective,
  setAimCompileBudgetFrames,
  setAimCompileBudgetSlack,
  snapshotAimStats,
} from "./aim.ts";
import {
  predictFirstCompletionFrames,
  traversalBudgetSlack,
  TRAVERSAL_BUDGET_MODEL_V1,
} from "./budget_model.ts";
import {
  frontierReadinessFromFit,
  nextContactGapIndex,
  OBJECTIVE_IMPACT_MIN_ASK,
} from "./objective.ts";
import { axisErrorsForTargets, axisQualityFromErrors, MISSING_CONTACT_TOLERANCE } from "../score.ts";
import { readinessCatch } from "./readiness.ts";
import { polishLeafVariant } from "./polish.ts";
import { getEngineRebuildCount } from "../core/polish.ts";
import { registerCompileReset, resetPerCompileState } from "../core/compile_lifecycle.ts";
import { BestSoFarRegister, leafKeyForReport, type LeafKey } from "./register.ts";
import {
  getSimFrames,
  refundSimFramesTo,
} from "./sim_frames.ts";
import {
  setCompileBudgetFrames,
  setImpactCurveElevationRoomPressure,
  setImpactCurveHighSpeedReliefPressure,
  setImpactTemplateHoldProfilePressure,
  setImpactTemplateSpecMeanImpact,
  snapshotArcPlacementStats,
} from "../arc_placement.ts";
import { makeSolidLine } from "../arc.ts";
import {
  getCandidateProbe,
  getCandidateSamples,
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
  /** Study hook: stop as soon as the first full-duration traversal is considered.
   *  This isolates path quality from post-completion search and repair budget. */
  stopAfterFirstCompletion?: boolean;
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
};

type HandoffSearchPolicy = {
  nCand: number;
  preview: boolean;
  axisQualitySearch: boolean;
  releaseSetup: boolean;
  previewScorePressure?: number;
  budgetSlack: number;
  branchLimit: number;
  reuseLimit: number;
  tailBranching: number;
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
  readinessPerGap: (number | null)[];
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
const HANDOFF_CANDIDATE_POOL = 8;
const HANDOFF_BRANCHING = 3;
const HANDOFF_LOW_SLACK_BRANCH_FULL = 1.25;
const HANDOFF_LOW_SLACK_BRANCH_ZERO = 2.0;

/** Budget (in frames) at which the compiler is considered "mature": the single
 *  shared maturity scale used by every budget→maturity smoothstep in this module
 *  (quality-breadth lean, reuse / future-preview / release-vertical pressures,
 *  and the tail-completion / shallow-tail throttles). These sites previously each
 *  carried their own identically-valued 150k constant. */
const HANDOFF_MATURITY_BUDGET_SCALE_FRAMES = 150_000;

/** Candidates sampled per gap by the handoff search. The handoff ranks only a
 *  bounded pool by feasibility and branches 3-wide, so sampling the full default
 *  pool is mostly wasted per-node work that starves bounded-budget exploration.
 *  The pre-impact board's 24-sample sweet spot shifted once `Contact.impact`
 *  became scored: harder catch geometry is often present later in the
 *  deterministic batch, and the true-score forward ranker can use the extra pool.
 *  LR_QUALITY_NCAND overrides this unified breadth for controlled studies. */
const HANDOFF_QUALITY_N_CAND = 32;
const HANDOFF_QUALITY_LEAN_N_CAND = 29;
const HANDOFF_QUALITY_SCARCE_LEAN_START_FRAMES = 50_000;
const HANDOFF_QUALITY_SCARCE_LEAN_SPAN_FRAMES = 50_000;
const HANDOFF_QUALITY_MATURE_LEAN_SPAN_FRAMES = 100_000;
const HANDOFF_QUALITY_VARIATION_RELIEF_AIR_RANGE = 0.50;
const HANDOFF_QUALITY_VARIATION_RELIEF_SPEED_RANGE = 0.40;
const HANDOFF_QUALITY_SHORT_NO_AMP_MAX_CONTACTS = 32;
const HANDOFF_QUALITY_SHORT_NO_AMP_BOOST_N_CAND = 34;
const HANDOFF_QUALITY_SPARSE_AMP_BOOST_N_CAND = 34;
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
/** Short required-contact gaps are deadline-dominated: the normal cheap prefix
 *  can have zero hits even when a catch exists later in the deterministic sample
 *  order. Rescue only clean prefixes at true dead-ends (caller-gated) so
 *  already-working dense paths keep their normal cheap order. */
const HANDOFF_SHORT_RESCUE_N_CAND = 80;
const HANDOFF_SHORT_RESCUE_CANDIDATE_POOL = 16;
const HANDOFF_SHORT_RESCUE_MAX_GAP_FRAMES = 12;
const HANDOFF_PREVIEW_K = 1;
/** Reuse only the latest committed catch. Older translated catches can over-lock
 *  dense forward-dependent chains into a locally steady but globally brittle
 *  rhythm. */
const HANDOFF_REUSE_K = 1;
const HANDOFF_REUSE_MATURE_EXTRA_WEIGHT = 0.35;
const HANDOFF_REUSE_MATURE_FULL_FEEDBACK_SCALE = 48;
const HANDOFF_PREVIEW_HORIZON = 1;
const QUALITY_FUTURE_PREVIEW_MAX_PRESSURE = 1.0;
const QUALITY_FUTURE_PREVIEW_FULL_FEEDBACK_SCALE = 12;
const START_OPTION_LIMIT = 10;
const START_SCORING_POOL = 16;
const START_FIRST_K = 8;
const START_FIRST_OPTIONS = 3;
const START_NEXT_K = 8;
const START_HEURISTIC_WEIGHT = 0.15;
const START_SPEED_ANCHOR_OFFSETS_PX_PER_FRAME = [-2.5, -0.75, 0, 1.25, 2.5] as const;
const START_BALLISTIC_SCORING_POOL = 4;
const START_BALLISTIC_BUDGET_START_FRAMES = 50_000;
const START_BALLISTIC_BUDGET_SPAN_FRAMES = 50_000;
const START_SUPPORT_LOW_AIR_MAX = 0.35;
const START_SUPPORT_RELEASE_MARGIN_FRAMES = K_BOUNCE_LANDING + 2;
const START_SUPPORT_MIN_RUNUP_FRAMES = K_BOUNCE_LANDING + 3;
const START_SUPPORT_LINE_Y = 5;
const START_SUPPORT_LOW_AIR_X_DELAY_FRAMES = [0, 1, 2] as const;
const START_SUPPORT_X_DELAY_AIR_MAX = 0.40;
const START_SUPPORT_X_DELAY_FIRST_GAP_START_FRAMES = 20;
const START_SUPPORT_X_DELAY_FIRST_GAP_SPAN_FRAMES = 10;
const START_SUPPORT_X_DELAY_BUDGET_START_FRAMES = 50_000;
const START_SUPPORT_X_DELAY_BUDGET_SPAN_FRAMES = 50_000;
const START_SUPPORT_DELAY_ROBUST_BRANCH = 3;
const START_SUPPORT_LINE_BACKTRACK_PX = 80;
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
const HANDOFF_AXIS_OVERSHOOT_WEIGHTS: Partial<Record<AxisName, number>> = {
  speed: 5.76,
  air: 16,
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
const HANDOFF_RELEASE_VERTICAL_WEIGHT = 0.045;
const HANDOFF_RELEASE_VERTICAL_FULL_FEEDBACK_SCALE = 48;
const HANDOFF_RELEASE_VERTICAL_LOW_AIR_TARGET_SCALE = 0.45;
const HANDOFF_RELEASE_VERTICAL_TIGHT_CADENCE_FRAMES = Math.round(FPS * 0.72);
const HANDOFF_RELEASE_VERTICAL_TIGHT_CADENCE_WIDTH = Math.round(FPS * 0.40);
const HANDOFF_RELEASE_VERTICAL_SAFE_FAST_PX = 8;
const HANDOFF_RELEASE_VERTICAL_SAFE_TIGHT_PX = 5;
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
const SUBMIN_FORWARD_EVAL_START_FRAMES = 20_000;
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
/** Once a passing output exists but its axis quality is still weak, spend sparse
 *  deterministic pulses on older pass-frontier branches. Very low incumbents
 *  keep the original repair cadence; moderate incumbents get a much rarer
 *  pulse. This is budget-agnostic repair scheduling: it still walks one fixed
 *  node sequence, but does not let poor early choices monopolize the quality
 *  phase. */
const QUALITY_FAR_BACK_MIN_INTERVAL = 16;
const QUALITY_FAR_BACK_MAX_INTERVAL = 128;
const QUALITY_FAR_BACK_FULL_AXIS_QUALITY = 0.18;
const QUALITY_FAR_BACK_ZERO_AXIS_QUALITY = 0.50;
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
 * `gapAxisTargets[*].impact` in place. Owning the feasibility capping, the
 * arrival lookahead, and the three curve-pressure setters in one place keeps the
 * globals from desyncing.
 */
function resolveImpactTargets(
  spec: Spec,
  gaps: Gap[],
  gapAxisTargets: AxisValues[],
  allContactFrames: number[],
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
      // migrateImpact, beats.ts) — authored impact already sits on the new felt scale here, no
      // runtime remap. New specs author natively on the new scale.
      if (c.impact !== undefined) impactByFrame.set(secToFrame(c.t), c.impact);
    }
  }
  if (impactByFrame.size > 0) {
    for (const gap of gaps) {
      if (!gap.endsWithContact) continue;
      const impact = impactByFrame.get(gap.endFrame);
      if (impact === undefined) continue;
      // Scored target = min(authored, derived feasibility bound). The bound
      // (fingerprinted, substrate.ts — ballistics around the beat) caps impact
      // by what physics permits; buildDriftReport applies the same cap, so
      // search and scorer chase one coherent target.
      const nextContact = allContactFrames.find((f) => f > gap.endFrame);
      const nextGapSeconds = nextContact === undefined ? 1.5 : (nextContact - gap.endFrame) / FPS;
      const prevGapSeconds = (gap.endFrame - gap.startFrame) / FPS;
      const t = gapAxisTargets[gap.index];
      const bounded = Math.min(
        impact,
        impactFeasibilityBound(t.speed, prevGapSeconds, nextGapSeconds),
      );
      gap.targets.impact = bounded;
      gapAxisTargets[gap.index].impact = bounded;
    }
    // Second pass: give each gap the BOUNDED impact target of the beat its
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
  setImpactCurveElevationRoomPressure(
    impactOff ? 0 : impactCurveElevationRoomPressure(gaps, gapAxisTargets),
  );
  setImpactCurveHighSpeedReliefPressure(
    impactOff ? 0 : impactCurveHighSpeedReliefProfilePressure(gaps, gapAxisTargets),
  );
  setImpactTemplateHoldProfilePressure(
    impactOff ? 0 : impactTemplateHoldProfilePressure(gaps, gapAxisTargets),
  );
}

function compileHandoffInternal(
  userSpec: Spec,
  seed: number,
  opts: CompileHandoffOptions,
  initialSnapshot: HandoffNodeSnapshot | null,
): CompileCheckpoint {
  if (!Number.isSafeInteger(seed)) {
    throw new Error(`compileHandoff: seed must be a safe integer, got ${seed}`);
  }
  const searchSeed = opts.searchSeed ?? seed;
  if (!Number.isSafeInteger(searchSeed)) {
    throw new Error(`compileHandoff: searchSeed must be a safe integer, got ${searchSeed}`);
  }
  const targetBudget = validateBudget(opts.budget);
  // Budget-aware geometry reads this (per-compile constant) for the curvature fade.
  setCompileBudgetFrames(targetBudget);
  setAimCompileBudgetFrames(targetBudget);
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
    // Extracted into one helper (feasibility capping + arrival lookahead + the three
    // impact-curve-pressure globals) so those setters live at a single call site and
    // cannot desync.
    resolveImpactTargets(spec, gaps, gapAxisTargets, allContactFrames);

    const ctx: SpecContext = { allContactFrames, durationFrames, gapAxisTargets };
    const predictedFirstCompletionFrames = Math.round(predictFirstCompletionFrames(spec));
    const budgetSlack = traversalBudgetSlack(targetBudget, spec);
    const budgetSlackTelemetry = round3(budgetSlack);
    setAimCompileBudgetSlack(budgetSlack);
    setForwardEvalContext(spec, gapAxisTargets);
    const sparseContactCadence = usesSparseContactCadence(gaps);
    const startOptions = initialSnapshot === null
      ? buildStartOptions(userSpec, spec, gaps, ctx, searchSeed, targetBudget)
      : [];
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
    const passStack: HandoffNode[] = root.skippedContacts === 0 ? [root] : [];
    const fallbackStack: HandoffNode[] = root.skippedContacts === 0 ? [] : [root];
    const register = new BestSoFarRegister();
    const telemetry: HandoffTelemetry = {
      frontierSelections: 0,
      farBackPulses: 0,
      nodesExpanded: 0,
      frontierMaxSize: frontierSize(passStack, fallbackStack),
      deepestSeenGap: -1,
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
    const repair = repairConfig(targetBudget);
    const repairEnabled = targetBudget >= repair.minBudget && startOptions.length > 0;
    let bestCompleteNode: HandoffNode | null = null;
    let firstTerminalFrame = -1;
    let firstCompletionFrame = -1;
    // Instrumentation scaffold (observe-only; never read by the search → byte-identical when off):
    // when each node was first processed (its "budget timestamp") and a structured record of every
    // repair restart, so the system can be characterized and budget-aware allocation built on
    // MEASURED cost (vs the current crude perGap estimate). Surfaced in compile_stats.repair.
    const framesAtReach = new WeakMap<SearchNode, number>();
    // Count of complete tracks ever considered (any phase). A repair restart's delta tells us whether
    // it REACHED the end at all (completed), separate from whether it beat the incumbent (accepted).
    let terminalConsiders = 0;
    type RepairRecord = {
      worst: number; anchor: number; up: number; totalGaps: number;
      framesAtAnchor: number; framesBefore: number; framesSpent: number;
      estCost: number; predictedFeasible: boolean; completed: boolean;
      beforeScore: number; afterScore: number; accepted: boolean;
      inhSpeed: number | null; inhVy: number | null; inhGrounded: number | null;
    };
    const repairRecords: RepairRecord[] = [];

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
      telemetry.deepestSeenGap = Math.max(telemetry.deepestSeenGap, node.search.gapIndex);
      telemetry.startRanksSeen.add(node.startRank);
      if (node.search.prefixFits.some((fit) => fit !== null)) {
        telemetry.startRanksWithFits.add(node.startRank);
      }
      if (canSkipPartialEvaluation(node, gaps, register)) return null;
      const evaluation = evaluateCached(node);
      recordEvaluationTelemetry(
        telemetry,
        consideredSearchNodes,
        node.search,
        evaluation.fullDuration,
        phase,
      );
      const improved = register.consider(
        buildNodeOutput(
          node,
          evaluation.report,
          gaps,
          evaluation.outputDurationFrames,
          false,
          evaluation.readinessPerGap,
        ),
        evaluation.key,
      );
      recordImprovementTelemetry(telemetry, phase, improved);
      const terminal = isTerminalNode(node.search, gaps);
      if (terminal) {
        terminalConsiders++;
        if (firstTerminalFrame < 0) firstTerminalFrame = getSimFrames();
      }
      if (improved && terminal) {
        bestCompleteNode = node;
        if (firstCompletionFrame < 0) firstCompletionFrame = getSimFrames();
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
      const aimStats = snapshotAimStats();
      const releaseExitStats = snapshotReleaseExitStats();
      const gapfitShortStats = snapshotGapfitShortStats();
      const fwdEvalStats = snapshotFwdEvalStats();
      return {
        ...best,
        budget,
        stats: {
          ...best.stats,
          candidates_sampled: getCandidateSamples(),
          candidates_viable: getViableCandidates(),
          budget_exhausted: budgetExhausted,
          sim_frames: getSimFrames(),
          traversal_budget_model: TRAVERSAL_BUDGET_MODEL_V1.name,
          predicted_first_completion_frames: predictedFirstCompletionFrames,
          budget_slack: budgetSlackTelemetry,
          ...snapshotNumericPolicyStats("handoff_policy_candidate_count", telemetry.policyNCand),
          ...snapshotNumericPolicyStats("handoff_policy_branch_limit", telemetry.policyBranchLimit),
          first_completion_frame: firstTerminalFrame >= 0 ? firstTerminalFrame : null,
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
          ...snapshotCandidateReleaseCoverage(telemetry),
          ...snapshotCandidatePreviewCoverage(telemetry),
          ...(arcStats ? { arc_placement: arcStats } : {}),
          // Enumerative-proposer funnel + prediction accuracy
          // (optimizer/aim.ts). Absent when the lane never ran
          // (LR_AIM_ENUM=0) — ablation archives stay byte-identical.
          ...(aimStats !== null ? { aim: aimStats } : {}),
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
          // Repair characterization (only present when the repair post-pass ran → baseline
          // golden.json unchanged, no snapshot churn). Aggregates are always cheap; the full
          // per-restart records (up to maxAttempts each) are heavy archive bloat, so they ride
          // behind LR_REPAIR_LOG — on only when you're actually debugging the repair phase.
          ...(repairRecords.length > 0
            ? {
              repair: {
                first_completion_frame: firstCompletionFrame,
                restarts: repairRecords.length,
                accepts: repairRecords.filter((r) => r.accepted).length,
                frames_spent: repairRecords.reduce((s, r) => s + r.framesSpent, 0),
                gaps_touched: new Set(repairRecords.map((r) => r.worst)).size,
                reconverged: repairRecords.filter((r) => !r.accepted && r.framesSpent > 0).length,
                ...(repair?.log ? { records: repairRecords } : {}),
              },
            }
            : {}),
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
    type ProcessResult =
      | { kind: "captured" }
      | { kind: "deferred" }
      | { kind: "expanded"; children: HandoffNode[] };
    const processNode = (node: HandoffNode): ProcessResult => {
      // Only tracked when repair can consume it (>=150k); a no-op on the low-budget hot path.
      if (repairEnabled && !framesAtReach.has(node.search)) framesAtReach.set(node.search, getSimFrames());
      const nodeTerminal = isTerminalNode(node.search, gaps);
      const mainResult = consider(node, "main");
      if (captureFirstCompletion(nodeTerminal, mainResult)) return { kind: "captured" };
      const resolvePolicy = (search: SearchNode): HandoffSearchPolicy =>
        resolveHandoffSearchPolicy({
          node: search,
          gaps,
          ctx,
          telemetry,
          sparseContactCadence,
          targetBudget,
          budgetSlack,
          hasCompletion: firstCompletionFrame >= 0,
        });
      const policy = resolvePolicy(node.search);

      const tailNode = completeNearTail(
        node,
        gaps,
        ctx,
        telemetry,
        policy,
        resolvePolicy,
        targetBudget,
      );
      if (tailNode !== null) {
        const result = consider(tailNode, "tail");
        if (result?.event.improved) {
          telemetry.tailCompletionImprovements++;
          const remaining = remainingContactCount(node.search, gaps);
          incrementContactCountCounter(
            telemetry.tailCompletionImprovementsByRemainingContacts,
            remaining,
          );
        }
        if (captureFirstCompletion(isTerminalNode(tailNode.search, gaps), result)) {
          return { kind: "captured" };
        }
      }

      captureReachedBudget();
      if (captured !== null) return { kind: "captured" };

      if (node.deferExpansion) return { kind: "deferred" };

      if (
        polishEnabled &&
        node.startLines.length === 0 &&
        isTerminalNode(node.search, gaps) &&
        node.search.prefixFits.some((fit) => fit !== null)
      ) {
        const padded = paddedFits(node, gaps.length);
        polishTried++;
        const variant = polishLeafVariant(
          padded, spec, gaps, allContactFrames, durationFrames, node.startState,
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
          recordEvaluationTelemetry(
            telemetry,
            consideredSearchNodes,
            polishNode.search,
            evaluation.fullDuration,
            "polish",
          );
          const improved = register.consider(
            buildNodeOutput(
              polishNode,
              evaluation.report,
              gaps,
              evaluation.outputDurationFrames,
              false,
              evaluation.readinessPerGap,
            ),
            evaluation.key,
          );
          recordImprovementTelemetry(telemetry, "polish", improved);
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

      if (isTerminalNode(node.search, gaps)) return { kind: "expanded", children: [] };

      const children = expandNode(
        node,
        gaps,
        ctx,
        startOptions,
        telemetry,
        policy,
        targetBudget,
      );
      telemetry.nodesExpanded++;
      return { kind: "expanded", children };
    };

    // Shared frontier-DFS driver: pop → process → enqueue children, until the frontier empties,
    // the node cap is hit, or `keepGoing()` returns false. Both the main search and each repair
    // restart run on this — they differ only in their frontier stacks and stop predicate. Returns
    // early when a budget snapshot is captured (kind:"captured") so the caller's post-loop runs.
    const runFrontier = (
      pass: HandoffNode[], fb: HandoffNode[], keepGoing: () => boolean,
    ): void => {
      while (frontierSize(pass, fb) > 0 && telemetry.nodesExpanded < maxNodes) {
        if (!keepGoing()) break;
        const node = popNextFrontierNode(pass, fb, telemetry, farBackFrontierPulseInterval(register.getBestKey()));
        telemetry.frontierSelections++;
        const result = processNode(node);
        if (result.kind === "captured") return;
        if (result.kind === "deferred") {
          enqueueDeferred({ ...node, deferExpansion: false }, pass, fb);
        } else {
          for (let i = result.children.length - 1; i >= 0; i--) enqueueChild(result.children[i], pass, fb);
        }
        telemetry.frontierMaxSize = Math.max(telemetry.frontierMaxSize, frontierSize(pass, fb));
      }
    };

    // Repair restart: re-run the REAL frontier-DFS (rescue, far-back pulse, tail completion,
    // register — all via processNode) seeded from one node, until `ceiling` sim-frames or the
    // frontier empties. Branches into the OTHER arcs at the restart gap, rebuilding the whole
    // tail with full power, not a greedy dive.
    const runFrontierFrom = (initial: HandoffNode, ceiling: number): void => {
      const pass: HandoffNode[] = initial.skippedContacts === 0 ? [initial] : [];
      const fb: HandoffNode[] = initial.skippedContacts === 0 ? [] : [initial];
      runFrontier(pass, fb, () => getSimFrames() < ceiling);
    };

    // Aimed-repair post-pass (R2): the main search has produced a complete incumbent using
    // only `firstCompletionFrame*mainMargin` frames; spend the rest here. Repeatedly: find the
    // weakest AFFORDABLE contact gap of the incumbent, reconstruct the prefix before it (free —
    // replay the incumbent's own fits, extendNodeCached memoizes), and RESTART the real
    // frontier-DFS from there with a feasibility-sized ceiling. The register accepts a rebuilt
    // track iff it beats the incumbent (complete-or-discard). Contained (its own budget, NOT a
    // shared-frontier enqueue — the distinction from the removed interleaved repair). Honest
    // (sims charged), deterministic per (spec,seed,budget). See docs/archive/TRACK_REPAIR_EXPERIMENTS.md.
    const runRepairPhase = (): void => {
      if (repair === null) return;
      // Coarse fallback cost model: avg frames per contact-gap of the full search.
      const perGap = firstCompletionFrame > 0
        ? firstCompletionFrame / Math.max(1, telemetry.deepestSeenGap + 1)
        : 0;
      // MEASURED per-gap cost-to-end (Jérémie's "each arc associated with a budget"): from the first
      // incumbent's own path, costToEnd[k] = firstCompletionFrame − framesAtReach[node@k] = the frames
      // the main search actually spent getting from gap k to completion. Replaces the dead-end-biased
      // perGap estimate for feasibility/ceiling. Computed once from the original incumbent (stable profile).
      const costToEnd: number[] = [];
      {
        const inc0 = bestCompleteNode;
        const root0 = inc0 ? startOptions.find((o) => o.rank === inc0.startRank)?.root : undefined;
        if (inc0 && root0 && firstCompletionFrame > 0) {
          let n = root0;
          for (let k = 0; k <= gaps.length; k++) {
            const reach = framesAtReach.get(n);
            costToEnd[k] = reach !== undefined ? Math.max(0, firstCompletionFrame - reach) : -1;
            if (k < gaps.length) n = extendNodeCached(n, inc0.search.prefixFits[k] ?? null);
          }
        }
      }
      const estCostOf = (k: number): number => {
        const m = costToEnd[k];
        return m !== undefined && m >= 0 ? m : perGap * Math.max(1, gaps.length - k);
      };
      const exhausted = new Set<number>();
      let attempts = 0;
      let restartCounter = 0;
      while (
        attempts < repair.maxAttempts &&
        getSimFrames() < targetBudget &&
        bestCompleteNode !== null &&
        isTerminalNode(bestCompleteNode.search, gaps)
      ) {
        const incumbent = bestCompleteNode;
        const root = startOptions.find((o) => o.rank === incumbent.startRank)?.root;
        if (root === undefined) break;
        const remaining = targetBudget - getSimFrames();
        // Worst AFFORDABLE gap: largest axis-error² whose measured cost-to-re-complete fits the
        // remaining budget (×feasMargin). Falls back to later/cheaper gaps when budget is tight.
        const kWorst = pickFeasibleWeakGap(
          evaluateCached(incumbent).report, gaps, exhausted, estCostOf,
          remaining / repair.feasMargin,
        );
        if (kWorst < 0) break;

        // R4 seed-perturbed restart: re-running the search from a gap with the SAME seed re-samples
        // the SAME seeded candidates → re-converges to the same incumbent (wasted). A FRESH derived
        // seed samples genuinely different arc geometry → real exploration (this is "try different
        // arcs", via the proven search). Deterministic per (spec,seed,budget): the restart seed is a
        // fixed mix of searchSeed and a restart counter. R3 upstream walk (LR_REPAIR_MAX_UPSTREAM)
        // composes on top: if a restart re-converges anyway, escalate the anchor to the parent.
        let improvedAny = false;
        for (let up = 0; up <= repair.maxUpstream; up++) {
          const k = kWorst - up;
          if (k < 0 || attempts >= repair.maxAttempts || getSimFrames() >= targetBudget) break;
          const estCost = estCostOf(k);
          // Walking upstream only gets more expensive; stop if we can't afford to finish.
          if (estCost > 0 && estCost * repair.feasMargin > targetBudget - getSimFrames()) break;
          attempts++;
          restartCounter++;
          const restartSeed = ((incumbent.searchSeed | 0) ^ Math.imul(restartCounter, 0x9e3779b1)) | 0;

          let prefix = root;
          for (let i = 0; i < k; i++) prefix = extendNodeCached(prefix, incumbent.search.prefixFits[i]);
          const prefixNode: HandoffNode = {
            search: prefix,
            startState: incumbent.startState,
            startLines: incumbent.startLines,
            startRank: incumbent.startRank,
            searchSeed: restartSeed,
            startExpanded: true,
            deferExpansion: false,
            rankTrace: [],
            skippedContacts: 0,
          };
          const ceiling = Math.min(targetBudget, getSimFrames() + Math.ceil(estCost * repair.feasMargin));
          const beforeScore = evaluateCached(incumbent).key.full_score;
          const framesBefore = getSimFrames();
          const incumbentBefore = bestCompleteNode;
          const terminalsBefore = terminalConsiders;
          const predictedFeasible = estCost <= 0 || estCost * repair.feasMargin <= targetBudget - framesBefore;
          runFrontierFrom(prefixNode, ceiling);
          const completed = terminalConsiders > terminalsBefore;
          // Decide "improved" by whether the REGISTER actually adopted a new best (its passing-leaf
          // comparator is axis_quality, not full_score — they can disagree). dScore is logged for
          // characterization but does NOT drive the exhaust/re-pick decision.
          const improved = bestCompleteNode !== incumbentBefore;
          const afterScore = bestCompleteNode ? evaluateCached(bestCompleteNode).key.full_score : beforeScore;
          const fit = k > 0 ? incumbent.search.prefixFits[k - 1] : undefined;
          repairRecords.push({
            worst: kWorst, anchor: k, up, totalGaps: gaps.length,
            framesAtAnchor: framesAtReach.get(prefix) ?? -1,
            framesBefore, framesSpent: getSimFrames() - framesBefore,
            estCost: Math.round(estCost), predictedFeasible, completed,
            beforeScore, afterScore, accepted: improved,
            inhSpeed: fit?.releaseSpeed ?? null,
            inhVy: fit?.releaseVelocityY ?? null,
            inhGrounded: fit?.releaseGroundedFrames ?? null,
          });
          if (repair.log) {
            process.stderr.write(
              `repair seed=${seed} budget=${targetBudget} worst=${kWorst} anchor=${k} up=${up} ` +
              `accepted=${improved ? "yes" : "no"} dScore=${(afterScore - beforeScore).toFixed(2)} ` +
              `frames=${getSimFrames() - framesBefore} estCost=${Math.round(estCost)} ` +
              `framesAtAnchor=${framesAtReach.get(prefix) ?? -1} ` +
              `inhSpeed=${fit?.releaseSpeed?.toFixed(2) ?? "na"} ` +
              `inhVy=${fit?.releaseVelocityY?.toFixed(2) ?? "na"} ` +
              `inhGrounded=${fit?.releaseGroundedFrames ?? "na"}\n`,
            );
          }
          if (improved) { improvedAny = true; break; }
        }
        // Exhaust the gap only if no fresh-seed restart helped; a productive gap is re-picked
        // (with the next fresh seed) so budget concentrates where it pays.
        if (!improvedAny) exhausted.add(kWorst);
      }
    };

    // Main search. Completion-triggered handoff to repair: once a complete track exists, stop the
    // main search (after firstCompletion*mainMargin frames) and spend the rest on aimed repair.
    // Repair off, or before any completion → runs to budget exactly → byte-identical baseline.
    runFrontier(passStack, fallbackStack, () =>
      !(repairEnabled && firstCompletionFrame >= 0 &&
        getSimFrames() >= firstCompletionFrame * repair!.mainMargin),
    );

    // Contained worst-gap suffix-rebuild post-pass on the reserved budget tail.
    if (repairEnabled && captured === null) {
      runRepairPhase();
    }

    // If repair exhausts its useful restart set before the frame budget is spent,
    // resume the original frontier instead of snapshotting with live alternatives
    // still queued. Repair keeps first claim on post-completion budget, but leftover
    // frames should still buy normal search quality.
    if (repairEnabled && captured === null && getSimFrames() < targetBudget) {
      runFrontier(passStack, fallbackStack, () => getSimFrames() < targetBudget);
    }

    // Frontier exhausted (or node cap hit) before the budget was reached: snapshot
    // the converged best, flagging whether the budget was actually exhausted.
    if (captured === null) {
      captured = snapshot(targetBudget, getSimFrames() >= targetBudget);
    }

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
    ...(fit.achievedAtEnd === undefined ? {} : { achievedAtEnd: { ...fit.achievedAtEnd } }),
    cost: fit.cost,
    ...(fit.releaseSpeed === undefined ? {} : { releaseSpeed: fit.releaseSpeed }),
    ...(fit.aimed === undefined ? {} : { aimed: fit.aimed }),
    ...(fit.releaseVelocityY === undefined ? {} : { releaseVelocityY: fit.releaseVelocityY }),
    ...(fit.releaseGroundedFrames === undefined
      ? {}
      : { releaseGroundedFrames: fit.releaseGroundedFrames }),
    ...(fit.releaseAirborne === undefined ? {} : { releaseAirborne: fit.releaseAirborne }),
    ...(fit.ref === undefined ? {} : { ref: { ...fit.ref } }),
    ...(fit.releaseArrivalState === undefined
      ? {}
      : { releaseArrivalState: { ...fit.releaseArrivalState } }),
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

function activeFrontier(
  passStack: HandoffNode[],
  fallbackStack: HandoffNode[],
): HandoffNode[] {
  return passStack.length > 0 ? passStack : fallbackStack;
}

function popNextFrontierNode(
  passStack: HandoffNode[],
  fallbackStack: HandoffNode[],
  telemetry: HandoffTelemetry,
  farBackPulseInterval: number | null,
): HandoffNode {
  const frontier = activeFrontier(passStack, fallbackStack);
  if (
    farBackPulseInterval !== null &&
    passStack.length > 0 &&
    telemetry.frontierSelections > 0 &&
    telemetry.frontierSelections % farBackPulseInterval === 0
  ) {
    const farBackIndex = oldestLaggedFrontierIndex(passStack, telemetry.deepestSeenGap);
    if (farBackIndex >= 0) {
      telemetry.farBackPulses++;
      return passStack.splice(farBackIndex, 1)[0];
    }
  }
  return frontier.pop()!;
}

function farBackFrontierPulseInterval(key: LeafKey | null): number | null {
  if (key?.contract_passed !== true) return null;
  const width = QUALITY_FAR_BACK_ZERO_AXIS_QUALITY - QUALITY_FAR_BACK_FULL_AXIS_QUALITY;
  const linearWeakness = width <= 0
    ? 0
    : clamp01((QUALITY_FAR_BACK_ZERO_AXIS_QUALITY - key.axis_quality) / width);
  const weakness = smoothstep(linearWeakness);
  if (weakness <= 0) return null;
  return Math.max(
    1,
    Math.round(
      QUALITY_FAR_BACK_MAX_INTERVAL -
        (QUALITY_FAR_BACK_MAX_INTERVAL - QUALITY_FAR_BACK_MIN_INTERVAL) * weakness,
    ),
  );
}

function oldestLaggedFrontierIndex(frontier: HandoffNode[], deepestSeenGap: number): number {
  if (deepestSeenGap < 0) return -1;
  let bestIndex = -1;
  let bestGap = Infinity;
  for (let i = 0; i < frontier.length; i++) {
    const gap = frontier[i].search.gapIndex;
    if (deepestSeenGap - gap < FAR_BACK_FRONTIER_LAG) continue;
    if (gap < bestGap) {
      bestGap = gap;
      bestIndex = i;
    }
  }
  return bestIndex;
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
  preview: ReturnType<typeof previewFutureContacts>,
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
): void {
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
    return;
  }
  consideredSearchNodes.add(search);
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
  let options = rankedOptions(node.search, gaps, ctx, node.searchSeed, telemetry, {
    nCand: policy.nCand,
    preview: policy.preview,
    axisQualitySearch: policy.axisQualitySearch,
    releaseSetup: policy.releaseSetup,
    reuseLimit: policy.reuseLimit,
    previewCostWeight: PREVIEW_COST_WEIGHT,
    previewScorePressure: policy.previewScorePressure,
    budgetSlack: policy.budgetSlack,
    targetBudget,
  });
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
        // Short-deadline rescue: wide extra sampling only for tight deadlines;
        // clean prefixes only.
        predicate: () => node.skippedContacts === 0 && shouldAttemptShortDeadlineRescue(gap),
        run: () => {
          const nCand = shortDeadlineRescueCandidateCount(gap.endFrame - gap.startFrame);
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
          previewScorePressure: policy.previewScorePressure,
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
    reuseLimit: policy.reuseLimit,
    previewCostWeight: PREVIEW_COST_WEIGHT,
    previewScorePressure: policy.previewScorePressure,
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

function shouldAttemptShortDeadlineRescue(gap: Gap): boolean {
  return gap.endsWithContact &&
    shortDeadlineRescueCandidateCount(gap.endFrame - gap.startFrame) > 0;
}

function shouldAttemptStartupDeadEndRescue(gap: Gap): boolean {
  return gap.endsWithContact && startupDeadEndCandidateCount(gap) > 0;
}

export function shortDeadlineRescueCandidateCount(gapFrames: number): number {
  if (!Number.isFinite(gapFrames) || gapFrames <= 0) return 0;
  return gapFrames < HANDOFF_SHORT_RESCUE_MAX_GAP_FRAMES
    ? HANDOFF_SHORT_RESCUE_N_CAND
    : 0;
}

// Shared scoring context for the three EXTRA-candidate lanes (reuse / brake /
// startup). Every lane maps its generated candidates 1:1 through
// scoreCandidateForHandoff with the same preview/budget context; only the tag and
// the rank offset differ (captured per-lane in ExtraCandidateLaneSpec).
type ExtraCandidateScoring = {
  preview: boolean;
  previewCostWeight: number;
  previewScorePressure: number;
  releaseSetup: boolean;
  targetBudget: number;
  budgetSlack: number;
  openingBestOpportunity: number;
};

// Per-node memo slot descriptor. Reuse keys on its reuse limit, brake keys on the
// search seed; startup does not memoize (no `cache`). read/write bind a lane to
// its own fields in the shared ExtraCandidateCache.
type ExtraCandidateCacheSlot = {
  key: number;
  read: (cache: ExtraCandidateCache) => { value?: Candidate[]; key?: number };
  write: (cache: ExtraCandidateCache, value: Candidate[], key: number) => void;
};

type ExtraCandidateLaneSpec = {
  tag: HandoffCandidateSource;
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

// One shared lane runner for reuse / brake / startup: (optionally memoized)
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
      scoring.preview, scoring.previewCostWeight, scoring.previewScorePressure,
      scoring.releaseSetup, scoring.targetBudget, undefined,
      scoring.budgetSlack, scoring.openingBestOpportunity,
    )
  );
}

// Shared seeded-RNG catch generator for the brake + startup lanes: one makeRng
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
    previewScorePressure?: number;
    releaseSetup?: boolean;
    targetBudget?: number;
  } = {},
): RankedOption[] {
  const preview = config.preview ?? true;
  const previewCostWeight = config.previewCostWeight ?? PREVIEW_COST_WEIGHT;
  const previewScorePressure = config.previewScorePressure ?? (preview ? 1 : 0);
  const scored = extraCandidateLane(node, gaps, ctx, seed, telemetry, {
    preview,
    previewCostWeight,
    previewScorePressure,
    releaseSetup: config.releaseSetup ?? false,
    targetBudget: config.targetBudget ?? 0,
    budgetSlack: 0,
    openingBestOpportunity: 0,
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

function startupDeadEndCandidateCount(gap: Gap): number {
  return startupRescueBreadth(gap.endFrame).startupK;
}

function admittedHandoffPool(
  sorted: Candidate[],
  poolSize: number,
): HandoffAdmittedCandidate[] {
  return sorted.slice(0, poolSize).map((candidate, rank) => ({ candidate, rank }));
}

function rankedOptions(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
  config: {
    nCand?: number;
    poolSize?: number;
    preview?: boolean;
    axisQualitySearch?: boolean;
    reuseLimit?: number;
    previewCostWeight?: number;
    previewScorePressure?: number;
    releaseSetup?: boolean;
    targetBudget?: number;
  } = {},
): RankedOption[] {
  const requestedCandidates = config.nCand ?? HANDOFF_QUALITY_N_CAND;
  const targetBudget = config.targetBudget ?? 0;
  const normalCandidates = requestedCandidates;
  const sorted = getCandidatesSorted(
    node,
    gaps,
    ctx,
    seed,
    normalCandidates,
  );
  const poolSize = config.poolSize ?? handoffCandidatePool();
  const pool = admittedHandoffPool(sorted, poolSize);
  const preview = config.preview ?? true;
  const previewCostWeight = config.previewCostWeight ?? PREVIEW_COST_WEIGHT;
  const previewScorePressure = config.previewScorePressure ?? (preview ? 1 : 0);
  const extraRankBase = poolSize;
  const openingBestOpportunity = openingBestForwardEvalOpportunity(
    node,
    gaps,
    ctx,
    pool,
    targetBudget,
    config.budgetSlack ?? 0,
  );
  const scored = pool.map(({ candidate, rank }) =>
    scoreCandidateForHandoff(
      node, candidate, rank, "pool", gaps, ctx, seed, telemetry, preview, previewCostWeight,
      previewScorePressure,
      config.releaseSetup ?? false,
      targetBudget,
      undefined,
      config.budgetSlack ?? 0,
      openingBestOpportunity,
    )
  );
  // Agreement instrument (measure-only): record ONLY when the pool was scored via the
  // forward-eval path (mirror scoreCandidateForHandoff's condition), over the POOL-SOURCE
  // entries only — this is before reuse/brake extras are pushed onto `scored`.
  if (fwdEvalCfg !== null && usesForwardEvalAtBudget(node, targetBudget)) {
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
    previewScorePressure,
    releaseSetup: config.releaseSetup ?? false,
    targetBudget,
    budgetSlack: config.budgetSlack ?? 0,
    openingBestOpportunity,
  };
  const reuseLimit = config.reuseLimit ?? reuseCandidateLimit(node, targetBudget, telemetry);
  const reuseOptions = extraCandidateLane(node, gaps, ctx, seed, telemetry, extraScoring, {
    tag: "reuse",
    rankBase: extraRankBase,
    generate: () => reuseCatchCandidates(node, gaps, ctx, telemetry, reuseLimit),
    cache: {
      key: reuseLimit,
      read: (cache) => ({ value: cache.reuse, key: cache.reuseK }),
      write: (cache, value, key) => {
        cache.reuse = value;
        cache.reuseK = key;
      },
    },
  });
  for (const option of reuseOptions) scored.push(option);
  const brakeOptions = extraCandidateLane(node, gaps, ctx, seed, telemetry, extraScoring, {
    tag: "brake",
    rankBase: extraRankBase + reuseOptions.length,
    generate: () => brakeCatchCandidates(node, gaps, ctx, seed, telemetry),
    cache: {
      key: seed,
      read: (cache) => ({ value: cache.brake, key: cache.brakeSeed }),
      write: (cache, value, key) => {
        cache.brake = value;
        cache.brakeSeed = key;
      },
    },
  });
  for (const option of brakeOptions) scored.push(option);
  scored.sort((a, b) =>
    a.score - b.score ||
    (a.candidate?.cost ?? Infinity) - (b.candidate?.cost ?? Infinity) ||
    a.rank - b.rank
  );
  return scored.slice(0, HANDOFF_BRANCHING);
}

function openingBestForwardEvalOpportunity(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  pool: readonly HandoffAdmittedCandidate[],
  targetBudget: number,
  budgetSlack: number,
): number {
  if (fwdEvalCfg === null || !fwdEvalDefaultConfig) return 0;
  if (!usesForwardEvalAtBudget(node, targetBudget)) return 0;
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

function qualityFuturePreviewPressure(
  targetBudget: number,
  telemetry: HandoffTelemetry,
): number {
  return QUALITY_FUTURE_PREVIEW_MAX_PRESSURE *
    maturityPressure(targetBudget, HANDOFF_MATURITY_BUDGET_SCALE_FRAMES) *
    fullFeedbackPressure(telemetry, QUALITY_FUTURE_PREVIEW_FULL_FEEDBACK_SCALE);
}

function lowAirTargetPressure(target: number, scale: number): number {
  return smoothstep(clamp01((scale - target) / scale));
}

function maturityPressure(targetBudget: number, scaleFrames: number): number {
  const budget = Math.max(0, targetBudget);
  return smoothstep(clamp01(budget / (budget + scaleFrames)));
}

function fullFeedbackPressure(telemetry: HandoffTelemetry, scale: number): number {
  const uniqueFull = uniqueFullEvaluations(telemetry);
  return smoothstep(clamp01(uniqueFull / (uniqueFull + Math.max(1, scale))));
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
  const budget = Math.max(0, targetBudget);
  const budgetPressure = smoothstep(
    clamp01(budget / (budget + HANDOFF_MATURITY_BUDGET_SCALE_FRAMES)),
  );
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

export function handoffCandidatePool(): number {
  return HANDOFF_CANDIDATE_POOL;
}

function completeNearTail(
  node: HandoffNode,
  gaps: Gap[],
  ctx: SpecContext,
  telemetry: HandoffTelemetry,
  policy: HandoffSearchPolicy,
  resolvePolicy: (search: SearchNode) => HandoffSearchPolicy,
  targetBudget: number,
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
      reuseLimit: policy.reuseLimit,
      previewCostWeight: PREVIEW_COST_WEIGHT,
      targetBudget,
    })
      .filter((option) => option.candidate !== null)
      .slice(0, policy.tailBranching);
    for (let i = options.length - 1; i >= 0; i--) {
      const option = options[i];
      stack.push({
        search: extendNodeCached(search, option.candidate!),
        rankTrace: appendOptionTrace(rankTrace, option),
      });
    }
  }
  return null;
}

/** Weakest AFFORDABLE contact gap to restart repair from. Weakness = Σ axis-error² (its
 *  share of the score's axis_error_rms; for a VALID track drift/missing are 0 by construction,
 *  so axis_quality is the only quality lever → axis-SSE is the faithful "most valuable to
 *  change" proxy — v1, a proxy for true upstream blame; see docs/archive/TRACK_REPAIR_EXPERIMENTS.md).
 *  FEASIBILITY: skip gaps whose estimated cost to re-complete (`perGap*(gaps-k)`) exceeds
 *  `budgetCap` — restarting from a gap we can't finish wastes the slice. Iterating worst-first
 *  and returning the first feasible one naturally falls back to later/cheaper gaps when budget
 *  is tight. Skips `exhausted`; ties → lower index. Returns -1 if none feasible/left. */
function pickFeasibleWeakGap(
  report: DriftReport,
  gaps: Gap[],
  exhausted: Set<number>,
  estCostOf: (k: number) => number,
  budgetCap: number,
): number {
  const ranked: { gap: number; sse: number }[] = [];
  for (const g of report.gaps) {
    if (exhausted.has(g.gap_index)) continue;
    if (!gaps[g.gap_index]?.endsWithContact) continue;
    let sse = 0;
    for (const v of Object.values(g.axes)) sse += v.error * v.error;
    ranked.push({ gap: g.gap_index, sse });
  }
  ranked.sort((a, b) => b.sse - a.sse || a.gap - b.gap);
  for (const r of ranked) {
    const cost = estCostOf(r.gap);
    if (cost <= 0 || cost <= budgetCap) return r.gap;
  }
  return -1;
}

function resolveHandoffSearchPolicy({
  node,
  gaps,
  ctx,
  telemetry,
  sparseContactCadence,
  targetBudget,
  budgetSlack,
  hasCompletion,
}: {
  node: SearchNode;
  gaps: Gap[];
  ctx: SpecContext;
  telemetry: HandoffTelemetry;
  sparseContactCadence: boolean;
  targetBudget: number;
  budgetSlack: number;
  hasCompletion: boolean;
}): HandoffSearchPolicy {
  const nCand = qualityHandoffSampleCount(gaps, ctx, sparseContactCadence, targetBudget);
  return {
    nCand,
    preview: false,
    axisQualitySearch: true,
    releaseSetup: true,
    previewScorePressure: qualityFuturePreviewPressure(targetBudget, telemetry),
    budgetSlack,
    branchLimit: lowSlackTraversalBranchLimit(node, budgetSlack, hasCompletion),
    reuseLimit: reuseCandidateLimit(node, targetBudget, telemetry),
    tailBranching: TAIL_COMPLETION_FALLBACK_BRANCHING,
  };
}

function lowSlackTraversalBranchLimit(
  node: SearchNode,
  budgetSlack: number,
  hasCompletion: boolean,
): number {
  if (hasCompletion) return HANDOFF_BRANCHING;
  if (!Number.isFinite(budgetSlack)) return HANDOFF_BRANCHING;
  const pressure = 1 - smoothstep(
    (budgetSlack - HANDOFF_LOW_SLACK_BRANCH_FULL) /
      (HANDOFF_LOW_SLACK_BRANCH_ZERO - HANDOFF_LOW_SLACK_BRANCH_FULL),
  );
  if (pressure <= 0) return HANDOFF_BRANCHING;
  const reduced = Math.max(1, HANDOFF_BRANCHING - 1);
  return unitHash(lowSlackTraversalBranchSeed(node)) < pressure ? reduced : HANDOFF_BRANCHING;
}

function lowSlackTraversalBranchSeed(node: SearchNode): number {
  return nodeHashSeed(node, 0x44b6c793);
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
  prefix: "handoff_policy_candidate_count" | "handoff_policy_branch_limit",
  acc: NumericAccumulator,
): Partial<CompileStats> {
  if (acc.count === 0) return {};
  return {
    [`${prefix}_min`]: acc.min,
    [`${prefix}_mean`]: round3(acc.sum / acc.count),
    [`${prefix}_max`]: acc.max,
  } as Partial<CompileStats>;
}

export function handoffSampleCount(targetBudget?: number): number {
  // LR_QUALITY_NCAND=<n> overrides the unified candidate breadth for controlled
  // spend-response studies and, later, model-driven budget allocation.
  const override = qualityNCandOverride();
  if (override !== null) return override;
  return budgetAwareQualitySampleCount(targetBudget);
}

function qualityNCandOverride(): number | null {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_QUALITY_NCAND;
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? Math.min(64, n) : null;
}

function qualityHandoffSampleCount(
  gaps: Gap[],
  ctx: SpecContext,
  sparseContactCadence: boolean,
  targetBudget: number | undefined,
): number {
  const base = handoffSampleCount(targetBudget);
  if (qualityNCandOverride() !== null || base >= HANDOFF_QUALITY_N_CAND) return base;
  if (shouldRelaxMatureQualityLean(gaps, ctx)) return HANDOFF_QUALITY_N_CAND;
  const boosted = shouldBoostShortNoAmpQualityBreadth(gaps, ctx)
    ? HANDOFF_QUALITY_SHORT_NO_AMP_BOOST_N_CAND
    : base;
  return sparseContactCadence
    ? smoothSparseAmplitudeQualityBreadth(gaps, ctx, boosted)
    : boosted;
}

function budgetAwareQualitySampleCount(targetBudget: number | undefined): number {
  if (typeof targetBudget !== "number" || !Number.isFinite(targetBudget)) {
    return HANDOFF_QUALITY_N_CAND;
  }
  const scarceLean = 1 - smoothstep(
    (targetBudget - HANDOFF_QUALITY_SCARCE_LEAN_START_FRAMES) /
      HANDOFF_QUALITY_SCARCE_LEAN_SPAN_FRAMES,
  );
  const matureLean = smoothstep(
    (targetBudget - HANDOFF_MATURITY_BUDGET_SCALE_FRAMES) /
      HANDOFF_QUALITY_MATURE_LEAN_SPAN_FRAMES,
  );
  const lean = Math.max(scarceLean, matureLean);
  return clampIntLocal(
    HANDOFF_QUALITY_N_CAND - (HANDOFF_QUALITY_N_CAND - HANDOFF_QUALITY_LEAN_N_CAND) * lean,
    HANDOFF_QUALITY_LEAN_N_CAND,
    HANDOFF_QUALITY_N_CAND,
  );
}

function shouldRelaxMatureQualityLean(gaps: Gap[], ctx: SpecContext): boolean {
  return targetAxisRange(gaps, ctx, "air") >= HANDOFF_QUALITY_VARIATION_RELIEF_AIR_RANGE ||
    targetAxisRange(gaps, ctx, "speed") >= HANDOFF_QUALITY_VARIATION_RELIEF_SPEED_RANGE;
}

function shouldBoostShortNoAmpQualityBreadth(gaps: Gap[], ctx: SpecContext): boolean {
  return contactGapCount(gaps) <= HANDOFF_QUALITY_SHORT_NO_AMP_MAX_CONTACTS &&
    targetAxisRange(gaps, ctx, "amplitude") <= 0;
}

function smoothSparseAmplitudeQualityBreadth(
  gaps: Gap[],
  ctx: SpecContext,
  base: number,
): number {
  if (base >= HANDOFF_QUALITY_SPARSE_AMP_BOOST_N_CAND) return base;
  const medianGapFrames = medianContactGapFrames(gaps);
  const meanImpact = targetAxisMean(gaps, ctx, "impact");
  if (medianGapFrames === null || meanImpact === null) return base;
  const amplitudePressure = smoothstep(
    (targetAxisRange(gaps, ctx, "amplitude") - HANDOFF_QUALITY_SPARSE_AMP_RANGE_START) /
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
    (targetAxisRange(gaps, ctx, "speed") - HANDOFF_QUALITY_SPARSE_AMP_SPEED_RANGE_START) /
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

function contactGapCount(gaps: Gap[]): number {
  let contacts = 0;
  for (const gap of gaps) if (gap.endsWithContact) contacts++;
  return contacts;
}

function targetAxisRange(gaps: Gap[], ctx: SpecContext, axis: AxisName): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const gap of gaps) {
    if (!gap.endsWithContact) continue;
    const target = (ctx.gapAxisTargets?.[gap.index] ?? gap.targets)[axis];
    if (typeof target !== "number" || !Number.isFinite(target)) continue;
    lo = Math.min(lo, target);
    hi = Math.max(hi, target);
  }
  return hi >= lo ? hi - lo : 0;
}

function targetAxisMean(gaps: Gap[], ctx: SpecContext, axis: AxisName): number | null {
  let sum = 0;
  let count = 0;
  for (const gap of gaps) {
    if (!gap.endsWithContact) continue;
    const target = (ctx.gapAxisTargets?.[gap.index] ?? gap.targets)[axis];
    if (typeof target !== "number" || !Number.isFinite(target)) continue;
    sum += target;
    count++;
  }
  return count > 0 ? sum / count : null;
}

export function usesSparseContactCadence(gaps: readonly Gap[]): boolean {
  const median = medianContactGapFrames(gaps);
  return median !== null && median >= HANDOFF_SPARSE_CONTACT_MEDIAN_FRAMES;
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
  const budget = Math.max(0, targetBudget);
  const budgetPressure = smoothstep(
    clamp01(budget / (budget + HANDOFF_MATURITY_BUDGET_SCALE_FRAMES)),
  );
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

function tailCompletionContactWindow(targetBudget: number): number {
  const budget = Math.max(0, targetBudget);
  const pressure = smoothstep(clamp01(budget / (budget + HANDOFF_MATURITY_BUDGET_SCALE_FRAMES)));
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
  previewScorePressure = usePreview ? 1 : 0,
  releaseSetup = false,
  targetBudget = 0,
  sourceAxis?: AxisName,
  budgetSlack = 0,
  openingBestOpportunity = 0,
): RankedOption {
  const child = extendNodeCached(node, candidate);
  // Forward-eval ranking (DEFAULT ≥75k): rank purely by the true metric score of where this arc
  // leads (charged forward rollout), replacing the local axis-L2 proxy below the gate.
  const fwdCfg = fwdEvalCfg; // resolved once per compile in setForwardEvalContext
  if (fwdCfg !== null && usesForwardEvalAtBudget(node, targetBudget)) {
    const value = forwardArcValue(
      child,
      gaps,
      ctx,
      seed,
      adaptiveForwardEvalConfig(
        fwdCfg,
        node,
        gaps,
        targetBudget,
        budgetSlack,
        openingBestOpportunity,
      ),
    );
    recordCandidateReleaseCoverage(telemetry, candidate);
    attachHandoffScoreToProbe(candidate.lines, -value); // study probe; no-op when off
    return {
      candidate, child, rank, source, sourceAxis,
      previewContacts: 0, previewSurvivors: 0,
      score: -value,
    };
  }
  const usePreviewScore = previewScorePressure > 0;
  const preview = (usePreview || usePreviewScore)
    ? previewFutureContacts(child, gaps, ctx, seed, telemetry)
    : {
      horizon: 0,
      landed: 0,
      survivors: 0,
      firstSurvivors: HANDOFF_PREVIEW_K,
      firstCost: 0,
      totalCost: 0,
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
    ? candidateReleaseSetupPenalty(candidate, gaps, node.gapIndex, telemetry, targetBudget)
    : 0;
  recordCandidateReleaseCoverage(telemetry, candidate);
  const previewScore = (scarcity + previewCost) * previewScorePressure;
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

function candidateReleaseSetupPenalty(
  candidate: Candidate,
  gaps: Gap[],
  gapIndex: number,
  telemetry: HandoffTelemetry,
  targetBudget: number,
): number {
  const nextGapIndex = nextContactGapIndex(gaps, gapIndex + 1);
  if (nextGapIndex < 0) return 0;
  const nextGap = gaps[nextGapIndex];
  return releaseSpeedPenalty(candidate.releaseSpeed, nextGap.targets.speed) +
    releaseVerticalSetupPenalty(
      candidate,
      gaps[gapIndex],
      nextGap,
      telemetry,
      targetBudget,
    );
}

function releaseVerticalSetupPenalty(
  candidate: Candidate,
  gap: Gap,
  nextGap: Gap,
  telemetry: HandoffTelemetry,
  targetBudget: number,
): number {
  const releaseVelocityY = candidate.releaseVelocityY;
  if (releaseVelocityY === undefined) return 0;
  const pressure = releaseVerticalSetupPressure(gap, nextGap, telemetry, targetBudget);
  if (pressure <= 0) return 0;
  const safeAbsVelocity =
    HANDOFF_RELEASE_VERTICAL_SAFE_FAST_PX -
    (HANDOFF_RELEASE_VERTICAL_SAFE_FAST_PX - HANDOFF_RELEASE_VERTICAL_SAFE_TIGHT_PX) *
      pressure;
  const excess = Math.max(0, Math.abs(releaseVelocityY) - safeAbsVelocity);
  return HANDOFF_RELEASE_VERTICAL_WEIGHT * pressure * excess * excess;
}

function releaseVerticalSetupPressure(
  gap: Gap,
  nextGap: Gap,
  telemetry: HandoffTelemetry,
  targetBudget: number,
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
  if (setupPressure <= 0) return 0;
  return setupPressure *
    maturityPressure(targetBudget, HANDOFF_MATURITY_BUDGET_SCALE_FRAMES) *
    fullFeedbackPressure(telemetry, HANDOFF_RELEASE_VERTICAL_FULL_FEEDBACK_SCALE);
}

function candidateOvershootPenalty(candidate: Candidate, gap: Gap): number {
  return handoffAxisOvershootPenalty(gap.targets, candidate.achieved);
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
// A physical move to forward_eval.ts is DEFERRED, not rejected: the blocker is the module-level
// context (fwdEvalSpec/fwdEvalGapAxisTargets/fwdEvalCfg/fwdEvalMin), which is a per-compile
// protocol shared with EXTERNAL importers (eval_arc_apples.ts,
// eval_leaf_factors.ts, eval_leaf_window.ts call setForwardEvalContext then read objectiveLeafValue)
// and have no test coverage of their own. Extracting cleanly first requires promoting that state to
// an explicit context object threaded through the scorers — a behavior-preserving but wide change
// that should land in its own commit with a full board/benchmark run, not bundled with fixes.
// ════════════════════════════════════════════════════════════════════════════════════════
// ── True-score forward arc evaluation (DEFAULT ranker ≥75k; also start selection & repair) ──
// Rank each candidate arc by the TRUE metric score (scoreDriftReport via leafKeyForReport) of
// where it LEADS over a short forward lookahead, instead of the local axis-L2 proxy. Rollouts are
// CHARGED honestly by default (LR_FWD_EVAL_CHARGE=0 refunds them to measure the free ceiling).
// Three variants, selected by LR_FWD_EVAL=<variant>[:depth[:branch]] (higher value = better arc;
// rank by -value); greedy:2 is the honest sweet spot:
//   greedy : single locally-cheapest rollout `depth` contacts deep; value = true score
//            of the resulting partial track. Cheap, directional.
//   best   : branch the top-`branch` candidates `depth` deep; value = MAX true score over
//            the leaves. Optimistic — the best the arc COULD lead to.
//   avg    : at the next contact, value = MEAN true score over the top-`branch`
//            alternatives (1 deep). Expected — robust to the DFS not taking the best.
type ForwardEvalVariant = "greedy" | "best" | "avg";
type ForwardEvalLeaf = "objective" | "full";
type ForwardEvalConfig = {
  variant: ForwardEvalVariant;
  depth: number;
  branch: number;
  charge: boolean;
  /** Leaf scorer for the rollout terminus. "full" (default) re-detects the whole
   *  partial track from frame 0 on a fresh engine fork (forwardNodeScore). "objective"
   *  scores the leaf with ZERO engine frames from data the rollout already has
   *  (rolled-gap axis quality × next-gap readiness × missed-step penalty —
   *  objectiveLeafValue). Set by LR_FWD_EVAL_LEAF; "full" is byte-identical. */
  leaf: ForwardEvalLeaf;
};

let fwdEvalSpec: Spec | null = null;
let fwdEvalGapAxisTargets: AxisValues[] = [];
// Forward-eval config/gate resolved ONCE per compile (env is constant per run) so the
// per-candidate ranker reads these cached fields, not process.env, in the hot path.
let fwdEvalCfg: ForwardEvalConfig | null = null;
let fwdEvalMin = 0;
// Refreshed every compile: setForwardEvalContext() calls forwardEvalConfig(), which
// re-derives this from LR_FWD_EVAL. Kept here (not in the reset block) because it is
// a derived config flag set alongside fwdEvalCfg, not an accumulator — but it IS
// per-compile, so forwardEvalConfig() must stay on the setForwardEvalContext path.
let fwdEvalDefaultConfig = true;
// REJECTED experiment (removed 2026-06-14): widening the rollout branch at
// impact-targeted gaps (LR_FWD_EVAL_IMPACT_BRANCH) to discover dive-scoop pairs.
// VERDICT (2026-06-10, canonical): branch=3 → 551.89, branch=5 → 328.08 vs
// 586.53 baseline. Charged branch^depth rollouts on ~40% of gaps starve the
// search (same failure shape as best:2:3 −12.4). Pair discovery must come from
// generation putting the converting scoop at the TOP of the pool from steep
// arrival states (docs/IMPACT_PAIR_PLANNING.md), not from search breadth. Kept
// at default (branch=1) it was a no-op; the global + parse + hot-path lookup are
// gone — re-derive from this note if the experiment is ever revisited.

// ── Forward-eval cost + agreement instrument (MEASURE-ONLY) ──
// Accumulates per compile, reset alongside the other lane stats. Two families:
//   cost: rollout sim-frames charged + call counts (how big a frame sink fwd-eval is).
//   agreement: over POOL-SOURCE candidates only (reuse/brake excluded), does the true
//   charged rollout (forward winner = min score) agree with the quality-objective rank?
//   All agreement reads are pure over the already-scored array — zero extra rollouts.
const fwdEvalTotals = {
  fwd_eval_frames_charged: 0,
  fwd_eval_calls: 0,
  start_eval_frames_charged: 0,
  // Rollout dead-ends (both leaf modes): the recursion hit a node with zero ranked
  // candidates and terminated the rollout early. In objective mode these carry the
  // explicit missing-step penalty; counted here regardless of mode.
  fwd_rollout_no_candidate: 0,
  // Dead-rider proof (full-leaf path only, measure-only): forwardNodeScore detections
  // whose terminus is a non-endOfSpec death PAST the last committed contact. reports =
  // all full-leaf detections; dead_uncovered = those landing in the uncovered span
  // (end+16 → next contact). Read from a DEFAULT-mode run to confirm the objective
  // leaf's missed-penalty is never asked to cover a dead rider (expect dead_uncovered≈0).
  fwd_leaf_reports: 0,
  fwd_leaf_dead_uncovered: 0,
  // Composition of the uncovered-terminus population by terminus reason. Genuine deaths are
  // riderEjected/sledBroken/leftWorld; rideStalled is AMBIGUOUS — the detector also labels a
  // window that simply ENDED with the rider alive (candidate.ts terminus fallthrough:
  // lastFrame < raw.duration → "rideStalled") as rideStalled. dead_uncovered now counts ONLY
  // genuine deaths; alive_uncovered counts the rideStalled/other (alive-at-horizon) remainder.
  fwd_leaf_dead_uncovered_ejected: 0,
  fwd_leaf_dead_uncovered_sledbroken: 0,
  fwd_leaf_dead_uncovered_leftworld: 0,
  fwd_leaf_alive_uncovered: 0,
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
  // Telemetry-only; share the scorer's impact-ask cutoff so the classifier can't
  // drift from OBJECTIVE_IMPACT_MIN_ASK (was a stray inline 0.35).
  const impactTargeted = impactTarget !== undefined &&
    impactTarget >= OBJECTIVE_IMPACT_MIN_ASK;
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
  fwdEvalSpec = spec;
  fwdEvalGapAxisTargets = gapAxisTargets;
  fwdEvalCfg = forwardEvalConfig();
  fwdEvalMin = forwardEvalMinBudget();
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

function readEnv(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.[name];
}

/** Track-repair config (worst-gap suffix rebuild, see docs/archive/TRACK_REPAIR_EXPERIMENTS.md).
 *  Completion-triggered: the main search runs to the
 *  first complete track, then the rest of the budget is spent restarting the real frontier-DFS
 *  (fresh seed) from the weakest AFFORDABLE gap of the incumbent, rebuilding the suffix to a
 *  complete track accepted iff it beats the incumbent. Honest (sims charged), gated to high budget
 *  (completion is DFS's job at low budget → ≤100k byte-identical), deterministic per (spec,seed,budget). */
type RepairConfig = {
  minBudget: number;
  mainMargin: number;
  feasMargin: number;
  maxAttempts: number;
  maxUpstream: number;
  log: boolean;
};
const REPAIR_MAIN_MARGIN_MATURE = 1.1;
const REPAIR_MAIN_MARGIN_RAMP_START_FRAMES = 100_000;
const REPAIR_MAIN_MARGIN_RAMP_SPAN_FRAMES = 100_000;
const REPAIR_FEAS_MARGIN_SCARCE = 1.05;
const REPAIR_FEAS_MARGIN_MATURE = 1.0;
const REPAIR_FEAS_MARGIN_RAMP_START_FRAMES = 100_000;
const REPAIR_FEAS_MARGIN_RAMP_SPAN_FRAMES = 100_000;

function defaultRepairMainMargin(targetBudget: number): number {
  const pressure = smoothstep(
    (targetBudget - REPAIR_MAIN_MARGIN_RAMP_START_FRAMES) /
      REPAIR_MAIN_MARGIN_RAMP_SPAN_FRAMES,
  );
  return 1 + (REPAIR_MAIN_MARGIN_MATURE - 1) * pressure;
}

function defaultRepairFeasMargin(targetBudget: number): number {
  const pressure = smoothstep(
    (targetBudget - REPAIR_FEAS_MARGIN_RAMP_START_FRAMES) /
      REPAIR_FEAS_MARGIN_RAMP_SPAN_FRAMES,
  );
  return REPAIR_FEAS_MARGIN_SCARCE +
    (REPAIR_FEAS_MARGIN_MATURE - REPAIR_FEAS_MARGIN_SCARCE) * pressure;
}

function repairConfig(targetBudget: number): RepairConfig {
  const num = (name: string, def: number, lo: number, hi: number): number => {
    const n = Number.parseInt(readEnv(name) ?? "", 10);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
  };
  const flt = (name: string, def: number, lo: number, hi: number): number => {
    const n = Number.parseFloat(readEnv(name) ?? "");
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
  };
  return {
    // Gate: below this, completion is the hard part (DFS's job) and the carve starves it.
    // Lowered 150k→100k (2026-06-07): on the 30-spec board all specs already complete at
    // 100k (validity 100%), so repair there improves QUALITY rather than stealing from
    // completion — canonical decide +3.0 at 100k, Δ+0.6 headline, ACCEPT. Below 100k
    // completion is still the binding constraint, so the gate stays.
    minBudget: num("LR_REPAIR_MIN_BUDGET", 100_000, 0, 100_000_000),
    // Completion-triggered split: run the main search to firstCompletion*mainMargin, then repair.
    // Default eases from 1.0 at the 100k repair gate to 1.1 by 200k; low budgets
    // stay byte-identical while mature budgets keep a little more main-search context before repair.
    mainMargin: flt("LR_REPAIR_MAIN_MARGIN", defaultRepairMainMargin(targetBudget), 1.0, 10.0),
    // Feasibility margin: require (measured cost-to-end × feasMargin) ≤ remaining budget, and size each
    // restart's ceiling to cost × feasMargin. Keep scarce budgets at the accepted 1.05 headroom, then
    // fade toward the exact measured-cost ceiling as budget matures; explicit env overrides still win.
    feasMargin: flt("LR_REPAIR_FEAS_MARGIN", defaultRepairFeasMargin(targetBudget), 1.0, 10.0),
    // Cap on repair restarts. High-budget binds on this (1M affords ~30-40 restarts); low/mid
    // budgets exhaust the budget first, so a high cap is a no-op there. 16 plateaued 1M at 698;
    // 64 → 706.6 (the cap, not the budget, was the 1M plateau).
    maxAttempts: num("LR_REPAIR_MAX_ATTEMPTS", 64, 1, 1000),
    // Upstream blame: when a restart re-converges, walk the anchor up to N parents (each with a fresh
    // seed, so it's genuinely different — not the same-seed re-run that R3 rejected). LR_REPAIR_MAX_UPSTREAM
    // overrides.
    maxUpstream: num("LR_REPAIR_MAX_UPSTREAM", 4, 0, 64),
    log: readEnv("LR_REPAIR_LOG") === "1",
  };
}

/** Budget-aware gate: forward eval only activates at/above this compile budget.
 *  DEFAULT 75000 — charged forward eval pays for itself only at high budget, and below
 *  this the cheap local ranker wins (so ≤50k stays byte-identical to the pre-fwd-eval
 *  baseline). Override with LR_FWD_EVAL_MIN_BUDGET; 0 = always on. */
function forwardEvalMinBudget(): number {
  const raw = readEnv("LR_FWD_EVAL_MIN_BUDGET");
  if (raw === undefined) return 75_000;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 75_000;
}

/** Candidate ranker. DEFAULT greedy:2 (true forward-rollout score) — the high-budget win.
 *  LR_FWD_EVAL=off|0 reverts to the local axis-L2 proxy; LR_FWD_EVAL=<greedy|best|avg>[:depth[:branch]]
 *  selects a variant. Charged honestly by default (see forwardArcValue / LR_FWD_EVAL_CHARGE). */
/** Parse a `<greedy|best|avg>[:depth[:branch]]` spec into a ForwardEvalConfig (always charged). */
function parseForwardSpec(raw: string): ForwardEvalConfig | null {
  const [v, d, b] = raw.split(":");
  if (v !== "greedy" && v !== "best" && v !== "avg") return null;
  const depth = d ? Math.max(1, Math.min(6, Number.parseInt(d, 10) || 2)) : 2;
  const defBranch = v === "avg" ? 6 : v === "best" ? 3 : 1;
  const branch = b ? Math.max(1, Math.min(8, Number.parseInt(b, 10) || defBranch)) : defBranch;
  // leaf defaults to "full" (byte-identical); forwardEvalConfig/startEvalConfig override it
  // from LR_FWD_EVAL_LEAF.
  return { variant: v, depth, branch, charge: true, leaf: "full" };
}

/** Leaf scorer for the rollout terminus. DEFAULT "full" (byte-identical re-detection).
 *  LR_FWD_EVAL_LEAF=objective scores the leaf with zero engine frames (objectiveLeafValue).
 *  Parsed as a SEPARATE var from LR_FWD_EVAL so fwdEvalDefaultConfig / the mature-avg
 *  upgrade stay untouched (an objective-leaf greedy:2 is still the "default config"). */
function forwardEvalLeaf(): ForwardEvalLeaf {
  const env = readEnv("LR_FWD_EVAL_LEAF");
  // DEFAULT: the short (objective) leaf — faithful scorer reconstruction (gap-window axis ×
  // survival × missing), ~21% cheaper per rollout, and ACCEPT vs the full leaf on the all-specs
  // board (+1.72, 40 specs × 12 seeds, P(Δ≤0)=0%). "full" is the explicit escape hatch.
  if (env === "full") return "full";
  return "objective";
}

function forwardEvalConfig(): ForwardEvalConfig | null {
  const env = readEnv("LR_FWD_EVAL");
  fwdEvalDefaultConfig = env === undefined || env === "";
  if (env === "0" || env === "off") return null;
  const cfg = parseForwardSpec(env === undefined || env === "" ? "greedy:2" : env);
  // A non-empty env that failed to parse is a typo, not an intentional disable — warn so the
  // silent fallback to the local proxy ranker is visible (env is non-empty/non-off here).
  if (cfg === null && env !== undefined && env !== "") warnUnparsedSpec("LR_FWD_EVAL", env);
  // Rollout frames are CHARGED honestly by default; LR_FWD_EVAL_CHARGE=0 refunds them (the
  // budget-refunded ceiling experiment). Resolved once here, not re-read per candidate.
  return cfg === null
    ? null
    : { ...cfg, charge: readEnv("LR_FWD_EVAL_CHARGE") !== "0", leaf: forwardEvalLeaf() };
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
function startEvalConfig(): ForwardEvalConfig | null {
  const env = readEnv("LR_START_EVAL");
  if (env === "0" || env === "off") return null;
  const cfg = parseForwardSpec(env === undefined || env === "" ? "best:1:5" : env);
  if (cfg === null && env !== undefined && env !== "") warnUnparsedSpec("LR_START_EVAL", env);
  return cfg === null ? null : { ...cfg, leaf: forwardEvalLeaf() };
}

/** True forward-rollout score of a start root (charged). Higher = better start. */
function startForwardScore(
  root: SearchNode, gaps: Gap[], ctx: SpecContext, seed: number, cfg: ForwardEvalConfig,
): number {
  // Start-selection rollouts are always charged (no refund here); count their sim-frames
  // separately from per-candidate forward eval (cost instrument, measure-only).
  const saved = getSimFrames();
  try {
    const leafObjective = cfg.leaf === "objective";
    return cfg.variant === "avg"
      ? forwardAvgNextScore(root, gaps, ctx, seed, cfg.branch, leafObjective)
      : forwardRolloutScore(
        root, gaps, ctx, seed, cfg.depth, cfg.variant === "best" ? cfg.branch : 1,
        leafObjective,
      );
  } finally {
    fwdEvalTotals.start_eval_frames_charged += Math.max(0, getSimFrames() - saved);
  }
}

/** True partial-track score (scoreDriftReport.full_score) of a forward SearchNode. */
function forwardNodeScore(search: SearchNode, gaps: Gap[], ctx: SpecContext): number {
  const spec = fwdEvalSpec;
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
    det, spec, gaps, ctx.allContactFrames, ctx.durationFrames, [], fits, fwdEvalGapAxisTargets,
  );
  const report = fullDuration ? rawReport : asPartialReport(rawReport, horizonFrame);
  recordFwdLeafDeadCheck(report, search, gaps);
  return leafKeyForReport(report, ctx.durationFrames).full_score;
}

/** Genuine death reasons emitted by the detector (candidate.ts). rideStalled is EXCLUDED: it
 *  is ambiguous — the detector also labels a window that simply ENDED with the rider alive as
 *  rideStalled (terminus fallthrough lastFrame < raw.duration), and asPartialReport remaps a
 *  partial endOfSpec to rideStalled. Treating rideStalled as death over-counts alive riders. */
const GENUINE_DEATH_REASONS: ReadonlySet<string> = new Set([
  "riderEjected", "sledBroken", "leftWorld",
]);

/** Dead-rider proof (full-leaf path only, measure-only). Every full-leaf detection is a
 *  report; a "dead-uncovered" report is a GENUINE death (riderEjected/sledBroken/leftWorld —
 *  NOT rideStalled/window-end, which can be an alive rider) whose terminus lands in the
 *  uncovered span — past the last committed contact (its end frame) and within the
 *  end+16→next-contact suffix the objective leaf's missed-penalty would otherwise cover.
 *  The alive remainder (rideStalled/other past the last contact) is counted separately in
 *  alive_uncovered so the earlier "1.1% dead_uncovered" can be decomposed. Read from a
 *  DEFAULT-mode run to confirm dead riders never feed the ballistic readiness: expect
 *  dead_uncovered ≈ 0. If not, the objective leaf under-penalizes — stop and revisit. */
function recordFwdLeafDeadCheck(report: DriftReport, search: SearchNode, gaps: Gap[]): void {
  fwdEvalTotals.fwd_leaf_reports++;
  if (report.terminus.reason === "endOfSpec") return;
  let lastContactEnd = -1;
  for (let i = Math.min(gaps.length, search.prefixFits.length) - 1; i >= 0; i--) {
    if (!gaps[i]?.endsWithContact) continue;
    if (search.prefixFits[i] == null) continue;
    lastContactEnd = gaps[i].endFrame;
    break;
  }
  if (report.terminus.frame <= lastContactEnd) return; // terminus inside the covered span
  const reason = report.terminus.reason;
  if (!GENUINE_DEATH_REASONS.has(reason)) {
    // Alive at the horizon (rideStalled/window-end) past the last contact — NOT a dead rider.
    fwdEvalTotals.fwd_leaf_alive_uncovered++;
    return;
  }
  fwdEvalTotals.fwd_leaf_dead_uncovered++;
  if (reason === "riderEjected") fwdEvalTotals.fwd_leaf_dead_uncovered_ejected++;
  else if (reason === "sledBroken") fwdEvalTotals.fwd_leaf_dead_uncovered_sledbroken++;
  else if (reason === "leftWorld") fwdEvalTotals.fwd_leaf_dead_uncovered_leftworld++;
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
 *  Uses the TRUE targets (fwdEvalGapAxisTargets), matching forwardNodeScore's scorer — NOT the
 *  jitter-sampled gap.targets. The axis RMS spans the WHOLE committed prefix [0, leaf.gapIndex):
 *  RMS is non-linear, so the prefix does NOT cancel across a pool, and folding it in is what lets
 *  an over-sped prefix be abandoned (accumulated error → low quality for every continuation).
 *  drift_quality / off_beat_quality are STRUCTURALLY 1 for the gate-passed committed contacts
 *  (every catch within ±1 frame, no off-beat — substrate.ts:659-671) and cannot be recomputed
 *  without re-detection, so they are omitted. No readiness, no hybrid. */
export function objectiveLeafValue(
  leaf: SearchNode,
  gaps: Gap[],
  durationFrames: number,
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
  let missingFitCount = 0;
  for (let i = 0; i < leaf.gapIndex; i++) {
    if (!gaps[i]?.endsWithContact) continue; // non-contact gap: no committed catch
    const fit = leaf.prefixFits[i] ?? null;
    if (fit === null) {
      missingFitCount += 1; // defensive: a contact gap that never committed a catch
      continue;
    }
    // Reproduce the TRUE scorer's axis factor: it measures each gap over [start, endFrame]
    // (buildDriftReport), so read the GAP-WINDOW achieved (`achievedAtEnd`) — not the LOOKAHEAD
    // `achieved` the local ranker uses (which for air gaps spans through the next contact and is
    // the wrong window to reproduce the scorer). achievedAtEnd is undefined when the two windows
    // coincide (non-air gaps), so fall back to `achieved` then.
    const achieved = fit.achievedAtEnd ?? fit.achieved;
    for (const e of axisErrorsForTargets(fwdEvalGapAxisTargets[i], achieved)) errors.push(e);
  }
  // axis_quality = exp(-rms(ALL committed-prefix errors) / AXIS_QUALITY_TOLERANCE) — the scorer's
  // own single-RMS fold, reproduced from the per-gap fits.
  let value = 1000 * axisQualityFromErrors(errors).axis_quality;
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
    return frontierReadinessFromFit(fit, nextGap)?.readiness ?? 1;
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

/** greedy/best: best true partial-track score reachable from `search` within
 *  `depthLeft` contact gaps, branching `branch` (1 = greedy single rollout). */
function forwardRolloutScore(
  search: SearchNode, gaps: Gap[], ctx: SpecContext, seed: number, depthLeft: number, branch: number,
  leafObjective: boolean,
): number {
  // Leaf scorer: full re-detection (default) or zero-frame objective value. The missing-contact
  // penalty is derived by the leaf scorer itself from the node's own committed depth
  // (objectiveLeafValue's futureMissing / forwardNodeScore's re-detection).
  const leafValue = (node: SearchNode): number =>
    leafObjective
      ? objectiveLeafValue(node, gaps, ctx.durationFrames)
      : forwardNodeScore(node, gaps, ctx);
  if (depthLeft <= 0 || isTerminalNode(search, gaps)) {
    return leafValue(search);
  }
  const at = advanceToNextContact(search, gaps);
  if (at === null) {
    return leafValue(search);
  }
  const cands = getCandidatesSorted(at, gaps, ctx, seed, branch);
  if (cands.length === 0) {
    fwdEvalTotals.fwd_rollout_no_candidate++;
    // Dead-end: the rollout could not place any further contact; the leaf scorer applies the full
    // missing-contact penalty from the node's own committed depth.
    return leafValue(search);
  }
  let best = -Infinity;
  for (const c of cands) {
    const s = forwardRolloutScore(
      extendNodeCached(at, c), gaps, ctx, seed, depthLeft - 1, branch, leafObjective,
    );
    if (s > best) best = s;
  }
  return best;
}

/** avg: mean true partial-track score over the top-`m` next-contact alternatives, 1 deep. */
function forwardAvgNextScore(
  search: SearchNode, gaps: Gap[], ctx: SpecContext, seed: number, m: number,
  leafObjective: boolean,
): number {
  const leafValue = (node: SearchNode): number =>
    leafObjective
      ? objectiveLeafValue(node, gaps, ctx.durationFrames)
      : forwardNodeScore(node, gaps, ctx);
  const at = advanceToNextContact(search, gaps);
  if (at === null) {
    return leafValue(search);
  }
  const cands = getCandidatesSorted(at, gaps, ctx, seed, m);
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
  child: SearchNode, gaps: Gap[], ctx: SpecContext, seed: number, cfg: ForwardEvalConfig,
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
  try {
    return cfg.variant === "avg"
      ? forwardAvgNextScore(child, gaps, ctx, seed, cfg.branch, leafObjective)
      : forwardRolloutScore(
        child, gaps, ctx, seed, cfg.depth, cfg.variant === "best" ? cfg.branch : 1,
        leafObjective,
      );
  } finally {
    setRolloutContext(false);
    // Cost instrument (measure-only): count the rollout's sim-frames even when charged
    // (the existing `saved` already reads getSimFrames). One call per ranked candidate.
    fwdEvalTotals.fwd_eval_frames_charged += Math.max(0, getSimFrames() - saved);
    fwdEvalTotals.fwd_eval_calls++;
    if (!charge) refundSimFramesTo(saved);
  }
}

function adaptiveForwardEvalConfig(
  base: ForwardEvalConfig,
  node: SearchNode,
  gaps: Gap[],
  targetBudget: number,
  budgetSlack: number,
  openingBestOpportunity: number,
): ForwardEvalConfig {
  const mature = matureForwardEvalConfig(base, node, gaps, targetBudget);
  if (mature !== base) return mature;
  return openingBestForwardEvalConfig(base, node, budgetSlack, openingBestOpportunity);
}

function openingBestForwardEvalConfig(
  base: ForwardEvalConfig,
  node: SearchNode,
  budgetSlack: number,
  opportunity: number,
): ForwardEvalConfig {
  if (
    !fwdEvalDefaultConfig ||
    base.variant !== "greedy" ||
    base.depth !== 2 ||
    base.branch !== 1 ||
    opportunity <= 0
  ) {
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

function usesForwardEvalAtBudget(node: SearchNode, targetBudget: number): boolean {
  if (targetBudget >= fwdEvalMin) return true;
  const pressure = subminForwardEvalPressure(targetBudget);
  return pressure > 0 && unitHash(subminForwardEvalSeed(node)) < pressure;
}

function subminForwardEvalPressure(targetBudget: number): number {
  if (fwdEvalMin <= SUBMIN_FORWARD_EVAL_START_FRAMES) return 0;
  return smoothstep(
    (Math.max(0, targetBudget) - SUBMIN_FORWARD_EVAL_START_FRAMES) /
      (fwdEvalMin - SUBMIN_FORWARD_EVAL_START_FRAMES),
  );
}

function subminForwardEvalSeed(node: SearchNode): number {
  return nodeHashSeed(node, 0x2f6e2b1d);
}

function matureForwardEvalConfig(
  base: ForwardEvalConfig,
  node: SearchNode,
  gaps: Gap[],
  targetBudget: number,
): ForwardEvalConfig {
  if (
    !fwdEvalDefaultConfig ||
    base.variant !== "greedy" ||
    base.depth !== 2 ||
    base.branch !== 1
  ) {
    return base;
  }
  const verticalPressure = verticalDramaForwardEvalPressure(node, gaps);
  if (verticalPressure <= 0) return base;
  const budgetPressure = smoothstep(
    (targetBudget - MATURE_AVG_FWD_EVAL_START_FRAMES) /
      MATURE_AVG_FWD_EVAL_SPAN_FRAMES,
  );
  const pressure = budgetPressure * verticalPressure;
  if (pressure <= 0 || unitHash(matureForwardEvalSeed(node)) >= pressure) return base;
  return {
    variant: "avg",
    depth: 2,
    branch: MATURE_AVG_FWD_EVAL_BRANCH,
    charge: base.charge,
    leaf: base.leaf,
  };
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

function previewFutureContacts(
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
  totalCost: number;
} {
  let node = child;
  let horizon = 0;
  let landed = 0;
  let survivors = 0;
  let firstSurvivors = HANDOFF_PREVIEW_K;
  let firstCost = 0;
  let totalCost = 0;

  for (;;) {
    if (horizon >= HANDOFF_PREVIEW_HORIZON) break;
    const nextGapIndex = nextContactGapIndex(gaps, node.gapIndex);
    if (nextGapIndex < 0) break;
    while (node.gapIndex < nextGapIndex) node = extendNodeCached(node, null);

    horizon++;
    const candidates = getCandidatesSorted(node, gaps, ctx, seed, HANDOFF_PREVIEW_K);
    telemetry.previews++;
    telemetry.previewSurvivors += candidates.length;
    survivors += candidates.length;
    if (horizon === 1) firstSurvivors = candidates.length;

    const best = pickLowestCost(candidates);
    if (horizon === 1) firstCost = best === null ? Infinity : best.cost;
    if (best === null) break;
    totalCost += best.cost;
    landed++;
    telemetry.previewContacts++;
    node = extendNodeCached(node, best);
  }
  return { horizon, landed, survivors, firstSurvivors, firstCost, totalCost };
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
    ballisticStartBudgetPressure(targetBudget),
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
  const budgetPressure = startupSupportXDelayBudgetPressure(targetBudget);
  const pressure = airPressure * durationPressure * budgetPressure;
  const maxDelay = clampIntLocal(
    (START_SUPPORT_LOW_AIR_X_DELAY_FRAMES.length - 1) * pressure,
    0,
    START_SUPPORT_LOW_AIR_X_DELAY_FRAMES.length - 1,
  );
  return START_SUPPORT_LOW_AIR_X_DELAY_FRAMES.slice(0, maxDelay + 1);
}

function startupSupportXDelayBudgetPressure(targetBudget: number): number {
  return smoothstep(
    (Math.max(0, targetBudget) - START_SUPPORT_X_DELAY_BUDGET_START_FRAMES) /
      START_SUPPORT_X_DELAY_BUDGET_SPAN_FRAMES,
  );
}

function startSeedForwardScore(
  seed: StartSeed,
  root: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  searchSeed: number,
  cfg: ForwardEvalConfig,
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
  const pressure = startupSupportXDelayBudgetPressure(targetBudget);
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

function startSupportDelayRobustScore(
  root: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  branch: number,
): number {
  const at = advanceToNextContact(root, gaps);
  if (at === null) return forwardNodeScore(root, gaps, ctx);
  const candidates = getCandidatesSorted(at, gaps, ctx, seed, branch);
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

function ballisticStartBudgetPressure(targetBudget: number): number {
  return smoothstep(
    (Math.max(0, targetBudget) - START_BALLISTIC_BUDGET_START_FRAMES) /
      START_BALLISTIC_BUDGET_SPAN_FRAMES,
  );
}

/**
 * Divide the START_SCORING_POOL seed budget between base (heuristic) and
 * ballistic first-contact starts.
 *
 * Slot 0 of the scoring pool is always reserved for the default spec start, so
 * only `START_SCORING_POOL - 1` seeds are shareable. Budget pressure hands up to
 * `START_BALLISTIC_SCORING_POOL` of those shareable seeds to ballistic starts —
 * capped both by that ceiling and by how many ballistic candidates actually
 * exist (`availableBallisticStarts`). Every seed not taken by ballistic starts
 * goes to base starts. In practice this yields 0-4 ballistic seeds.
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
  const targetSpeed = startTargetSpeedPx(axes);
  const speed = Math.hypot(start.vx, start.vy);
  const angle = (Math.atan2(start.vy, start.vx) * 180) / Math.PI;
  const targetAngle = targetStartAngle(axes);
  const speedCost = Math.pow((speed - targetSpeed) / SPEED_AXIS.RANGE_PX_PER_FRAME, 2);
  const angleCost = Math.pow((angle - targetAngle) / 70, 2);
  const lowSpeedPenalty = targetSpeed >= 6 && speed < targetSpeed * 0.45 ? 1 : 0;
  return speedCost + 0.35 * angleCost + lowSpeedPenalty;
}

function ballisticFirstContactCost(
  start: NonNullable<Spec["start"]>,
  firstContactAxes: AxisValues,
  firstContactFrame: number,
): number {
  const targetSpeed = startTargetSpeedPx(firstContactAxes);
  const impactVy = start.vy + ELEVATION.GRAVITY_PX_PER_FRAME2 * Math.max(1, firstContactFrame);
  const speed = Math.hypot(start.vx, impactVy);
  const angle = (Math.atan2(
    impactVy,
    start.vx,
  ) * 180) / Math.PI;
  const targetAngle = targetStartAngle(firstContactAxes);
  const speedCost = Math.pow((speed - targetSpeed) / SPEED_AXIS.RANGE_PX_PER_FRAME, 2);
  const angleCost = Math.pow((angle - targetAngle) / 70, 2);
  return speedCost + 0.35 * angleCost + START_HEURISTIC_WEIGHT * startHeuristicCost(start, firstContactAxes);
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

function cadenceRoomPressure(medianGapFrames: number): number {
  return smoothstep((medianGapFrames - CADENCE_ROOM_START_FRAMES) / CADENCE_ROOM_SPAN_FRAMES);
}

function impactCurveElevationRoomPressure(gaps: readonly Gap[], gapAxisTargets: readonly AxisValues[]): number {
  const elevationValues: number[] = [];
  const contactGapFrames: number[] = [];
  let impactTargets = 0;
  for (const gap of gaps) {
    if (!gap.endsWithContact) continue;
    contactGapFrames.push(gap.endFrame - gap.startFrame);
    if (gap.targets.impact !== undefined) impactTargets++;
    const elevation = gapAxisTargets[gap.index]?.elevation;
    if (typeof elevation === "number" && Number.isFinite(elevation)) {
      elevationValues.push(elevation);
    }
  }
  if (impactTargets === 0 || elevationValues.length < 2 || contactGapFrames.length === 0) return 0;
  const elevationRange = Math.max(...elevationValues) - Math.min(...elevationValues);
  const elevationPressure = smoothstep((elevationRange - 0.10) / 0.14);
  if (elevationPressure <= 0) return 0;
  const sortedGaps = [...contactGapFrames].sort((a, b) => a - b);
  const medianGapFrames = sortedGaps[Math.floor(sortedGaps.length / 2)];
  const roomPressure = cadenceRoomPressure(medianGapFrames);
  return clamp01(elevationPressure * roomPressure);
}

function impactCurveHighSpeedReliefProfilePressure(
  gaps: readonly Gap[],
  gapAxisTargets: readonly AxisValues[],
): number {
  const elevationValues: number[] = [];
  let speedSum = 0;
  let speedCount = 0;
  let impactTargets = 0;
  for (const gap of gaps) {
    if (!gap.endsWithContact) continue;
    const targets = gapAxisTargets[gap.index] ?? gap.targets;
    if (gap.targets.impact !== undefined) impactTargets++;
    if (typeof targets.speed === "number" && Number.isFinite(targets.speed)) {
      speedSum += targets.speed;
      speedCount++;
    }
    if (typeof targets.elevation === "number" && Number.isFinite(targets.elevation)) {
      elevationValues.push(targets.elevation);
    }
  }
  if (impactTargets === 0 || speedCount === 0 || elevationValues.length < 2) return 0;
  const meanSpeed = speedSum / speedCount;
  const speedPressure = smoothstep(
    (meanSpeed - IMPACT_CURVE_HIGH_SPEED_RELIEF_SPEED_START) /
      IMPACT_CURVE_HIGH_SPEED_RELIEF_SPEED_SPAN,
  );
  if (speedPressure <= 0) return 0;
  const elevationRange = Math.max(...elevationValues) - Math.min(...elevationValues);
  const elevationPressure = smoothstep(
    (elevationRange - IMPACT_CURVE_HIGH_SPEED_RELIEF_ELEVATION_RANGE_START) /
      IMPACT_CURVE_HIGH_SPEED_RELIEF_ELEVATION_RANGE_SPAN,
  );
  const manageableElevationPressure = 1 - smoothstep(
    (elevationRange - IMPACT_CURVE_HIGH_SPEED_RELIEF_ELEVATION_RANGE_END) /
      IMPACT_CURVE_HIGH_SPEED_RELIEF_ELEVATION_RANGE_END_SPAN,
  );
  const medianGapFrames = medianContactGapFrames(gaps);
  if (medianGapFrames === null) return 0;
  const roomPressure = cadenceRoomPressure(medianGapFrames);
  return clamp01(speedPressure * elevationPressure * manageableElevationPressure * roomPressure);
}

function impactTemplateHoldProfilePressure(
  gaps: readonly Gap[],
  gapAxisTargets: readonly AxisValues[],
): number {
  let contactCount = 0;
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
    const targets = gapAxisTargets[gap.index] ?? gap.targets;
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
  }
  if (contactCount === 0 || airCount === 0 || speedCount === 0 || impactCount === 0) return 0;
  const medianGapFrames = medianContactGapFrames(gaps);
  if (medianGapFrames === null) return 0;

  const meanAir = airSum / airCount;
  const meanSpeed = speedSum / speedCount;
  const meanImpact = impactSum / impactCount;
  const verticalFraction = verticalTargets / contactCount;
  const contactPressure = smoothstep((contactCount - 40) / 12);
  const denseCadencePressure = 1 - smoothstep((medianGapFrames - 28) / 14);
  const lowAirPressure = 1 - smoothstep((meanAir - 0.50) / 0.10);
  const lowSpeedPressure = 1 - smoothstep((meanSpeed - 0.56) / 0.10);
  const lowImpactProfile = 1 - smoothstep((meanImpact - 0.30) / 0.10);
  const verticalQuietPressure = 1 - smoothstep((verticalFraction - 0.02) / 0.18);
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
  readinessPerGap: (number | null)[];
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
  // Readiness v0 telemetry (optimizer/readiness.ts, roadmap R1): the
  // REALIZED arrival into each committed contact gap, scored by the
  // empirical catchability surface. Pure reads on the detection's velocity
  // array (already charged as part of this evaluation) — the shared prefix
  // engine must NOT be touched here, even read-only: frame-cache effects
  // perturb later metered charges in the continuing search.
  // Element type widened to include `undefined`: a committed gap's endFrame can
  // sit past the detected terminus, so the out-of-bounds read below is a real
  // guard (no `noUncheckedIndexedAccess` in tsconfig).
  const velocity: readonly ({ x: number; y: number } | undefined)[] = det.measurements.velocity;
  const readinessPerGap: (number | null)[] = gaps.map((gap, k) => {
    if (fits[k] === null || !gap.endsWithContact) return null;
    const v = velocity[gap.endFrame];
    if (v === undefined) return null;
    const { speed, angleDeg } = speedAngleFromVelocity(v);
    if (!Number.isFinite(speed) || speed <= 0) return null;
    return round3(readinessCatch(speed, angleDeg));
  });
  return {
    report,
    key: leafKeyForReport(report, durationFrames),
    outputDurationFrames,
    fullDuration,
    readinessPerGap,
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
  /** Realized-arrival readiness per gap, computed in evaluateNode from the
   *  evaluation's own detection (readiness v0 telemetry). */
  readinessPerGap: (number | null)[] = [],
): CompileOutput {
  const fits = paddedFits(node, gaps.length);
  const allLines = [...node.startLines];
  for (const fit of fits) if (fit !== null) allLines.push(...fit.lines);
  const readinessVals = readinessPerGap.filter((r): r is number => r !== null);
  const { speed: startSpeed, angleDeg: startAngleDeg } = speedAngleFromVelocity(
    node.startState.velocity,
  );
  const candidateRanks = selectedCandidateRanks(node.rankTrace);
  const candidateRankSum = candidateRanks.reduce((sum, rank) => sum + rank, 0);
  const candidateRankCount = candidateRanks.length;
  const { bySource: sourceCounts, byAxis: axisQualitySourceCounts } =
    selectedSourceCounts(node);
  return {
    track: buildTrackJson(allLines, outputDurationFrames, node.startState),
    report,
    stats: {
      candidates_sampled: getCandidateSamples(),
      candidates_viable: getViableCandidates(),
      engine_rebuilds: getEngineRebuildCount(),
      gap_commits: fits.filter((fit) => fit !== null).length,
      gap_backtracks: 0,
      validation_retries: 0,
      polish_iterations: 0,
      total_committed_cost: node.search.cumulativeCost,
      committed_costs_per_gap: fits.map((fit) => fit === null ? null : fit.cost),
      sim_frames: getSimFrames(),
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
      // How many committed fits in THIS output came from the proposer
      // (selection-level win rate; `aim.enum_emitted` is the pool-level rate).
      handoff_aimed_selected: fits.filter((fit) => fit !== null && fit.aimed === true).length,
      // Readiness v0 (roadmap R1, telemetry only): realized-arrival
      // catchability per committed gap; per-gap array joins with
      // report.gaps outcomes by index in the lab.
      readiness_per_gap: readinessPerGap,
      readiness_mean: readinessVals.length > 0
        ? round3(readinessVals.reduce((a, b) => a + b, 0) / readinessVals.length)
        : null,
      readiness_min: readinessVals.length > 0 ? Math.min(...readinessVals) : null,
      handoff_selected_axis_quality_by_axis: axisQualitySourceCounts,
    },
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
