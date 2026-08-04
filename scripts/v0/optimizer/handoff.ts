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
  snapshotAimStats,
  snapshotObjectiveLayerSpread,
} from "./aim.ts";
import { snapshotDetectorRunwayStats } from "./contact_phase.ts";
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
import { getSimFrames, refundSimFramesTo } from "./sim_frames.ts";
import { getMicroSimFrames } from "../core/ballistic_micro_sim.ts";
import {
  setImpactProfilePressures,
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
  /** Diagnostic/research hook: resolve budget-aware search policy and its
   *  repair-allocation phase at a lower ceiling, then spend any remaining hard
   *  `budget` on the preserved main frontier. Defaults to `budget`, so normal
   *  compiler behavior is unchanged. */
  policyBudget?: number;
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
): HandoffPoolProbeContactResponse | null {
  try {
    const engine = prefixEngine.addLine(candidate.lines.map(engineLineFromTrackLine));
    if (typeof engine?.getUpdatesAtFrame !== "function" || typeof engine?.getRider !== "function") return null;
    const candidateLineIds = new Set(candidate.lines.map((line) => line.id));
    const samples: HandoffPoolProbeContactResponse["samples"] = [];
    for (let frame = gap.endFrame; frame <= gap.endFrame + IMPACT_WINDOW; frame++) {
      const rider = engine.getRider(Math.max(0, frame));
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
  const budgetTelemetryLevel = opts.budgetTelemetry ?? "summary";
  if (!["off", "summary", "trace"].includes(budgetTelemetryLevel)) {
    throw new Error(
      `compileHandoff: budgetTelemetry must be off|summary|trace, got ${budgetTelemetryLevel}`,
    );
  }
  setProposalUtilityPowers();
  setAimCompileBudgetFrames(policyBudget);
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
      objectiveBlendCurrentPowerForSpec(policyBudget, specProfile),
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
    const budgetSlack = traversalBudgetSlack(policyBudget, spec);
    const budgetSlackTelemetry = round3(budgetSlack);
    setForwardEvalContext(spec, gapAxisTargets);
    const sparseContactCadence = usesSparseContactCadenceProfile(targetProfile);
    const allStartOptions = initialSnapshot === null
      ? buildStartOptions(userSpec, spec, gaps, ctx, searchSeed, policyBudget)
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
    });
    // DEADLINE, the live coordinate. Same pure estimator functions as the
    // recorder above and no shared state with it: the recorder observes and
    // never drives, this one drives and never records.
    const deadline = new CompileDeadline({
      gaps,
      durationFrames,
      policyBudgetFrames: policyBudget,
      anchorGapIndex: root.search.gapIndex,
      includeStartup: initialSnapshot === null,
    });
    const initialBudgetAttemptId = budgetRecorder.startAttempt({
      kind: initialSnapshot === null ? "initial" : "snapshot",
      searchSeed,
      hasFallback: false,
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
      initialBudgetAttemptId,
    );
    const passStack: HandoffNode[] = root.skippedContacts === 0 ? [root] : [];
    const fallbackStack: HandoffNode[] = root.skippedContacts === 0 ? [] : [root];
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
    const repair = repairConfig();
    const repairEnabled = policyBudget >= repair.minBudget && startOptions.length > 0;
    let bestCompleteNode: HandoffNode | null = null;
    // `BestSoFarRegister` intentionally owns only the public output. Keep the
    // matching node solely so snapshot-time diagnostics can validate the exact
    // selected transitions without re-running physics or instrumenting every
    // candidate considered by the search.
    let bestRegisteredNode: HandoffNode | null = null;
    let firstTerminalFrame = -1;
    let firstCompletionFrame = -1;
    // Instrumentation scaffold (observe-only; never read by the search → byte-identical when off):
    // when each node was first processed (its "budget timestamp") and a structured record of every
    // repair restart, so the system can be characterized and budget-aware allocation built on
    // MEASURED cost (vs the current crude perGap estimate). Surfaced in compile_stats.repair.
    const framesAtReach = new WeakMap<SearchNode, number>();
    // Second reach map for the OTHER producer of incumbent nodes. `framesAtReach`
    // above stamps only nodes the frontier processes, but the near-tail completion
    // pass builds its own suffix nodes and is where first completion routinely
    // lands, so every incumbent node past the deepest processed one had no
    // timestamp at all and the measured cost-to-end profile fell back to -1 there.
    // Both maps answer the same question — the charged work at which that node
    // first existed on the search's path — so repair reads them as one profile.
    const framesAtReachTail = new WeakMap<SearchNode, number>();
    // Stamped at construction, inside the charged tail attempt that built the
    // node. Gated exactly like `framesAtReach`, so the low-budget hot path
    // stays free; the gate is the repair phase, never the telemetry level, so
    // off/summary/trace do identical work.
    const stampTailReach = (search: SearchNode): void => {
      if (repairEnabled && !framesAtReachTail.has(search)) {
        framesAtReachTail.set(search, getSimFrames());
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
    // MEASURED per-gap cost-to-end (Jérémie's "each arc associated with a budget"):
    // from an incumbent's own path, costToEnd[k] = firstCompletionFrame −
    // reach[node@k] = the frames the main search actually spent from first
    // reaching gap k to completion, including intervening branch exploration.
    // A reach timestamp is accepted from EITHER producer of incumbent nodes.
    // Taking only the frontier's left every tail-suffix anchor — 161 of 307
    // repair attempts on the panel, and every anchor of a tail-completing
    // compile — sized by the coarse per-gap average instead, even though the
    // measured profile predicted actual completion cost at those very anchors
    // to 3.0% median APE.
    //
    // The walk is free of charged work: every node on the incumbent's path was
    // already built by the search and `extendNodeCached` memoizes, so this
    // replays identities rather than physics.
    const buildIncumbentCostToEnd = (): number[] => {
      const costToEnd: number[] = [];
      const inc0 = bestCompleteNode;
      const root0 = inc0 ? startOptions.find((o) => o.rank === inc0.startRank)?.root : undefined;
      if (inc0 && root0 && firstCompletionFrame > 0) {
        let n = root0;
        for (let k = 0; k <= gaps.length; k++) {
          const reach = firstReachOf(n);
          costToEnd[k] = reach !== undefined ? Math.max(0, firstCompletionFrame - reach) : -1;
          if (k < gaps.length) n = extendNodeCached(n, inc0.search.prefixFits[k] ?? null);
        }
      }
      return costToEnd;
    };
    // The incumbent's MEASURED cost-to-end profile, published here so the
    // deadline margin can use it as its post-completion estimate: after first
    // completion the structural suffix answers a question nobody is asking any
    // more, while this profile is the measured work from gap k to the end on
    // the path the compile actually took.
    //
    // It is established AT FIRST ADOPTED COMPLETION, not when the repair phase
    // starts. Waiting for repair left the margin invalid over the whole
    // pre-repair post-completion window — and over the whole of any compile
    // below the repair minimum — because `marginAt` reads a null profile as
    // "still racing to the end" and applies the episode-pace term, which
    // post-completion divides COMPILE-GLOBAL spend by the node's OWN depth and
    // collapses the margin on healthy nodes. The profile is what tells the
    // margin the race is over, so it has to exist as soon as it is.
    //
    // Below the repair minimum both reach maps stay empty by design (the
    // low-budget hot path pays nothing for them), so every entry is -1: a
    // profile that carries no measurement anywhere. That is the correct answer
    // there — no measured suffix, so the structural tail stands — and it still
    // retires the pace term, which is what was wrong.
    //
    // The repair phase rebuilds it (`runRepairPhase`) because by then the main
    // search may have adopted a better incumbent and repair sizes its ceilings
    // from the profile of the incumbent it is about to attack.
    let incumbentCostToEnd: readonly number[] | null = null;
    // Count of complete tracks ever considered (any phase). A repair restart's delta tells us whether
    // it REACHED the end at all (completed), separate from whether it beat the incumbent (accepted).
    let terminalConsiders = 0;
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
    type RepairRecord = {
      round: number;
      worst: number; anchor: number; up: number; totalGaps: number;
      framesAtAnchor: number; framesBefore: number; framesSpent: number;
      estCost: number; estCostUpper: number; predictedFeasible: boolean; completed: boolean;
      beforeScore: number; afterScore: number; accepted: boolean;
      improvementFrameOffsets: number[];
      inhSpeed: number | null; inhVy: number | null; inhGrounded: number | null;
      weakAxis: string | null;
      weakAxisTarget: number | null; weakAxisAchieved: number | null;
      weakAxisError: number | null; weakAxisCeiling: number | null; weakGapSse: number | null;
      weakArrivalSpeed: number | null; weakArrivalAngle: number | null;
      weakArrivalReadiness: number | null; weakArrivalCatchability: number | null;
      weakArrivalSpeedFit: number | null; weakArrivalImpactFeasibility: number | null;
      weakArrivalAirFit: number | null; weakArrivalElevationFit: number | null;
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
        ),
        evaluation.key,
      );
      if (improved) bestRegisteredNode = node;
      recordImprovementTelemetry(telemetry, phase, improved);
      const terminal = isTerminalNode(node.search, gaps);
      if (terminal) {
        terminalConsiders++;
        if (!improved) terminalConsidersWithoutImprovement++;
        if (firstTerminalFrame < 0) firstTerminalFrame = getSimFrames();
        // Terminal search nodes may stop before the unscored tail gap. For
        // completion telemetry the remaining traversal work is nevertheless
        // zero once the terminal has been considered.
        budgetRecorder.markTerminal(getSimFrames(), gaps.length);
      }
      if (improved && terminal) {
        bestCompleteNode = node;
        if (firstCompletionFrame < 0) {
          firstCompletionFrame = getSimFrames();
          // The margin's post-completion base, established at the instant the
          // phase flips rather than when repair happens to start (see
          // `buildIncumbentCostToEnd`). One walk per compile.
          incumbentCostToEnd = buildIncumbentCostToEnd();
        }
        telemetry.hasCompletion = true;
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
      const detectorRunwayStats = snapshotDetectorRunwayStats();
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
        budgetTelemetry: budgetRecorder.snapshot(
          getSimFrames(),
          budgetExhausted,
          firstTerminalFrame >= 0 ? firstTerminalFrame : null,
        ),
        stats: {
          ...best.stats,
          candidates_sampled: getCandidateSamples(),
          candidates_viable: getViableCandidates(),
          budget_exhausted: budgetExhausted,
          sim_frames: getSimFrames(),
          ballistic_micro_sim_frames: getMicroSimFrames(),
          ...objectiveLayerSpreadStat(),
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
          ...(detectorRunwayStats !== null ? { contact_phase: detectorRunwayStats } : {}),
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
      budgetRecorder.observeActive(node.search.gapIndex, getSimFrames());
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
          targetProfile,
          telemetry,
          sparseContactCadence,
          targetBudget: policyBudget,
          budgetSlack,
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
          deadlineMargin: deadline.marginAt({
            spentFrames: getSimFrames(),
            gapIndex: firstCompletionFrame >= 0
              ? search.gapIndex
              : telemetry.deepestSeenGap,
            costToEnd: incumbentCostToEnd,
          }),
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
        policyBudget,
        stampTailReach,
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
            ),
            evaluation.key,
          );
          if (improved) bestRegisteredNode = polishNode;
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
        policyBudget,
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
      onProcessed?: () => void,
    ): void => {
      while (frontierSize(pass, fb) > 0 && telemetry.nodesExpanded < maxNodes) {
        if (!keepGoing()) break;
        const node = popNextFrontierNode(pass, fb);
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
        const result = processNode(node);
        onProcessed?.();
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
    // The offsets are two counter reads per processed node (charged work and the
    // register's improvement count) — no evaluation, no simulation, no effect on
    // the frontier — so budget telemetry can record them without LR_REPAIR_LOG.
    const trackImprovementOffsets = repair?.log === true || budgetTelemetryLevel !== "off";
    const runFrontierFrom = (initial: HandoffNode, ceiling: number): number[] => {
      const pass: HandoffNode[] = initial.skippedContacts === 0 ? [initial] : [];
      const fb: HandoffNode[] = initial.skippedContacts === 0 ? [] : [initial];
      if (!trackImprovementOffsets) {
        runFrontier(pass, fb, () => getSimFrames() < ceiling);
        return [];
      }
      const framesBefore = getSimFrames();
      let improvementsSeen = register.improvementCount;
      const improvementFrameOffsets: number[] = [];
      runFrontier(pass, fb, () => getSimFrames() < ceiling, () => {
        while (improvementsSeen < register.improvementCount) {
          improvementFrameOffsets.push(getSimFrames() - framesBefore);
          improvementsSeen++;
        }
      });
      return improvementFrameOffsets;
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
      const repairBudget = policyBudget;
      // Coarse fallback cost model: avg frames per contact-gap of the full search.
      const perGap = firstCompletionFrame > 0
        ? firstCompletionFrame / Math.max(1, telemetry.deepestSeenGap + 1)
        : 0;
      // MEASURED per-gap cost-to-end (`buildIncumbentCostToEnd`, which owns the
      // derivation). Replaces the dead-end-biased perGap estimate for
      // feasibility/ceiling. Rebuilt HERE from the incumbent this phase is about
      // to attack — the main search may have adopted a better complete track
      // since the profile was first established at completion — and then held
      // fixed for the whole phase (later repairs do not rewrite it). perGap is
      // an average over the whole search including its dead ends, so it
      // over-sizes exactly the late, cheap anchors that tail completion
      // produces, and `pickFeasibleWeakGap` then rejects gaps the budget could
      // in fact afford.
      const costToEnd = buildIncumbentCostToEnd();
      // One profile, three readers: repair sizes its ceilings from it, the
      // deadline margin uses it as the post-completion remaining-work estimate,
      // and the telemetry recorder takes it as the estimator's path base.
      // Unmeasured anchors are -1 here, and all three apply the SAME predicate
      // to decide what counts as a measurement — non-positive means "no
      // measurement", fall back — so they cannot disagree about what is known.
      incumbentCostToEnd = costToEnd;
      /** THE COST FLOOR. A measured cost-to-end at k, or null.
       *
       * Zero is not a measurement of "no work left": the profile writes zero
       * whenever first completion did not post-date reaching that node, and
       * `costToEnd` genuinely tends to zero at the tail of the incumbent path
       * (docs/repair-selection-study.md *Verdict*: any repair arithmetic over
       * these numbers needs a floor, because that is where an unfloored one
       * degenerates). Routing non-positive values to the fallback IS that floor
       * — the estimate a restart is sized and priced from can never be zero —
       * and it is the same predicate the recorder's path selector and the
       * deadline margin apply to this one profile, so its three readers cannot
       * disagree about what counts as measured. */
      const measuredCostToEnd = (k: number): number | null => {
        const m = costToEnd[k];
        return m !== undefined && m > 0 ? m : null;
      };
      /** Point estimate of what re-completing from k costs: the measurement
       *  where there is one, else the coarse per-gap average of the whole
       *  search. Reported, not decided on — the decisions below read the
       *  interval. */
      const estCostOf = (k: number): number =>
        measuredCostToEnd(k) ?? perGap * Math.max(1, gaps.length - k);
      /** What a restart from k may cost at the top of the estimator's own
       *  interval — the quantity repair actually decides on, and the artifact's
       *  claim layer entering live search policy. The pricing itself is
       *  `repairRestartCeilingFrames`, which owns the derivation. */
      const estCostUpperOf = (k: number): number => repairRestartCeilingFrames(
        measuredCostToEnd(k),
        perGap * Math.max(1, gaps.length - k),
      );
      // Observation-only mirror of the branch the two functions above took.
      // `per_gap_fallback` means the anchor has no positive measured cost —
      // in neither reach map, or reached at or after first completion.
      const estCostSourceOf = (k: number): "measured_cost_to_end" | "per_gap_fallback" =>
        measuredCostToEnd(k) === null ? "per_gap_fallback" : "measured_cost_to_end";
      const exhausted = new Set<number>();
      let attempts = 0;
      let restartCounter = 0;
      let repairRound = 0;
      while (
        attempts < repair.maxAttempts &&
        getSimFrames() < repairBudget &&
        bestCompleteNode !== null &&
        isTerminalNode(bestCompleteNode.search, gaps)
      ) {
        const incumbent = bestCompleteNode;
        const root = startOptions.find((o) => o.rank === incumbent.startRank)?.root;
        if (root === undefined) break;
        const remaining = repairBudget - getSimFrames();
        const incumbentEvaluation = evaluateCached(incumbent);
        // Worst AFFORDABLE gap: largest axis-error² whose UPPER-bound cost to
        // re-complete fits the remaining budget. Falls back to later/cheaper
        // gaps when budget is tight.
        const kWorst = pickFeasibleWeakGap(
          incumbentEvaluation.report, gaps, exhausted, estCostUpperOf, remaining,
        );
        if (kWorst < 0) break;
        const round = repairRound++;
        // The ranking key for the gap the pick landed on, read off the
        // incumbent report THIS round saw. Recorded so a later replay does not
        // have to assume the final report was the one in front of the policy.
        const pickedWeakGapSse = gapAxisSse(
          incumbentEvaluation.report.gaps.find((g) => g.gap_index === kWorst),
        );

        // Observation-only causal context. A restart at kWorst cannot change the arrival inherited
        // from fit[kWorst-1], while a parent restart can. Keep these reads behind LR_REPAIR_LOG so
        // ordinary archives and production search pay no diagnostic work or schema cost.
        const weakContext = repair.log
          ? (() => {
            const gapReport = incumbentEvaluation.report.gaps.find((g) => g.gap_index === kWorst);
            const axisEntries = Object.entries(gapReport?.axes ?? {});
            axisEntries.sort((a, b) => b[1].error * b[1].error - a[1].error * a[1].error);
            const [weakAxis, weakValue] = axisEntries[0] ?? [null, null];
            const inheritedFit = kWorst > 0 ? incumbent.search.prefixFits[kWorst - 1] : undefined;
            const weakGap = gaps[kWorst];
            const projection = inheritedFit != null && weakGap !== undefined
              ? projectOutgoingScorerGap(
                inheritedFit,
                weakGap,
                gapAxisTargets,
              )
              : null;
            const readiness =
              projection !== null &&
                weakGap !== undefined &&
                weakGap.endsWithContact
              ? scoreNextArcReadiness(
                projection.projection,
                weakGap,
                successorScorerGapAfter(weakGap, gaps),
                gapAxisTargets,
              )
              : null;
            return {
              weakAxis,
              weakAxisTarget: weakValue?.target ?? null,
              weakAxisAchieved: weakValue?.achieved ?? null,
              weakAxisError: weakValue?.error ?? null,
              weakAxisCeiling: weakValue?.ceiling ?? null,
              weakGapSse: pickedWeakGapSse,
              weakArrivalSpeed:
                projection?.projection.boundary.incoming.speed ?? null,
              weakArrivalAngle:
                projection?.projection.boundary.incoming.comAngleDeg ?? null,
              weakArrivalReadiness: readiness?.readiness ?? null,
              weakArrivalCatchability: readiness?.catchability ?? null,
              weakArrivalSpeedFit: readiness?.speedFit ?? null,
              weakArrivalImpactFeasibility: readiness?.impactFeasibility ?? null,
              weakArrivalAirFit: readiness?.airFit ?? null,
              weakArrivalElevationFit: readiness?.elevationFit ?? null,
            };
          })()
          : {
            weakAxis: null,
            weakAxisTarget: null,
            weakAxisAchieved: null,
            weakAxisError: null,
            weakAxisCeiling: null,
            weakGapSse: null,
            weakArrivalSpeed: null,
            weakArrivalAngle: null,
            weakArrivalReadiness: null,
            weakArrivalCatchability: null,
            weakArrivalSpeedFit: null,
            weakArrivalImpactFeasibility: null,
            weakArrivalAirFit: null,
            weakArrivalElevationFit: null,
          };

        // R4 seed-perturbed restart: re-running the search from a gap with the SAME seed re-samples
        // the SAME seeded candidates → re-converges to the same incumbent (wasted). A FRESH derived
        // seed samples genuinely different arc geometry → real exploration (this is "try different
        // arcs", via the proven search). Deterministic per (spec,seed,budget): the restart seed is a
        // fixed mix of searchSeed and a restart counter. R3 upstream walk (LR_REPAIR_MAX_UPSTREAM)
        // composes on top: if a restart re-converges anyway, escalate the anchor to the parent.
        let improvedAny = false;
        const upstreamOffsets = repair.upstreamOrder === "nearest-first"
          ? Array.from({ length: repair.maxUpstream + 1 }, (_, up) => up)
          : Array.from({ length: repair.maxUpstream + 1 }, (_, index) => repair.maxUpstream - index);
        for (const up of upstreamOffsets) {
          const k = kWorst - up;
          if (attempts >= repair.maxAttempts || getSimFrames() >= repairBudget) break;
          if (k < 0) continue;
          const estCost = estCostOf(k);
          const estCostUpper = estCostUpperOf(k);
          if (estCostUpper > repairBudget - getSimFrames()) {
            // Older anchors cost more, so nearest-first can stop here. Oldest-first
            // must keep checking nearer anchors that may still fit the same budget.
            if (repair.upstreamOrder === "nearest-first") break;
            continue;
          }
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
          const sizedCeiling = getSimFrames() + Math.ceil(estCostUpper);
          const ceiling = Math.min(repairBudget, sizedCeiling);
          // Which of the two arguments of that Math.min won, and — when the
          // sized one did — where its cost estimate came from.
          const ceilingSource = sizedCeiling >= repairBudget
            ? "repair_budget_remaining"
            : estCostSourceOf(k);
          const beforeScore = evaluateCached(incumbent).key.full_score;
          const framesBefore = getSimFrames();
          const incumbentBefore = bestCompleteNode;
          const terminalsBefore = terminalConsiders;
          // TAUTOLOGICALLY TRUE as recorded: the affordability gate at the top
          // of this loop tests the same `estCostUpper` against the same
          // remaining budget, and the prefix replay between the two reads is
          // memoized (charges no frames). Every recorded restart therefore
          // carries `predictedFeasible: true`; the field is kept for record
          // schema stability (types.ts RepairRecord, study_difficulty_model.ts
          // reads it), but conditioning an analysis on it selects everything.
          const predictedFeasible = estCostUpper <= repairBudget - framesBefore;
          const repairAttemptId = budgetRecorder.startAttempt({
            kind: "repair",
            parentAttemptId: initialBudgetAttemptId,
            searchSeed: restartSeed,
            hasFallback: true,
            anchorGapIndex: k,
            startTotalSpentFrames: framesBefore,
            ceilingTotalSpentFrames: ceiling,
            ceilingSource,
            includeStartup: false,
            pathEstimateByGap: costToEnd,
            repairRoundIndex: round,
            anchorUpstreamOffset: up,
            incumbentWeakGapSse: pickedWeakGapSse,
          });
          // Mark the repair lane for the duration of the restart: every pool
          // build inside it is a repair-episode build, which is the population
          // the head ramp's phase-weight study can be scoped away from
          // (`postCompletionPhaseWeight`). Inert in production.
          repairLaneActive = true;
          let improvementFrameOffsets: number[];
          try {
            improvementFrameOffsets = runFrontierFrom(prefixNode, ceiling);
          } finally {
            repairLaneActive = false;
          }
          const completed = terminalConsiders > terminalsBefore;
          // Decide "improved" by whether the REGISTER actually adopted a new best (its passing-leaf
          // comparator is axis_quality, not full_score — they can disagree). dScore is logged for
          // characterization but does NOT drive the exhaust/re-pick decision.
          const improved = bestCompleteNode !== incumbentBefore;
          const afterScore = bestCompleteNode ? evaluateCached(bestCompleteNode).key.full_score : beforeScore;
          const fit = k > 0 ? incumbent.search.prefixFits[k - 1] : undefined;
          budgetRecorder.endActive(
            getSimFrames(),
            getSimFrames() >= ceiling ? "local_ceiling" : "frontier_exhausted",
            improved,
            {
              // Both reads are of values this restart already computed: the
              // scarce event a controller would need is WHEN the register first
              // took something, not that the restart eventually completed.
              firstAcceptedImprovementOffsetFrames: improvementFrameOffsets[0] ?? null,
              acceptedScoreDelta: afterScore - beforeScore,
            },
          );
          budgetRecorder.recordSegment(
            "repair_attempt",
            framesBefore,
            getSimFrames(),
            completed ? "terminal_considered" : "no_terminal",
            repairAttemptId,
          );
          repairRecords.push({
            round,
            worst: kWorst, anchor: k, up, totalGaps: gaps.length,
            framesAtAnchor: firstReachOf(prefix) ?? -1,
            framesBefore, framesSpent: getSimFrames() - framesBefore,
            estCost: Math.round(estCost), estCostUpper: Math.round(estCostUpper),
            predictedFeasible, completed,
            beforeScore, afterScore, accepted: improved,
            improvementFrameOffsets,
            inhSpeed: fit?.releaseSpeed ?? null,
            inhVy: fit?.releaseVelocityY ?? null,
            inhGrounded: fit?.releaseGroundedFrames ?? null,
            ...weakContext,
          });
          if (repair.log) {
            process.stderr.write(
              `repair seed=${seed} budget=${targetBudget} policy=${policyBudget} ` +
              `worst=${kWorst} anchor=${k} up=${up} ` +
              `accepted=${improved ? "yes" : "no"} dScore=${(afterScore - beforeScore).toFixed(2)} ` +
              `frames=${getSimFrames() - framesBefore} estCost=${Math.round(estCost)} ` +
              `estCostUpper=${Math.round(estCostUpper)} ` +
              `framesAtAnchor=${firstReachOf(prefix) ?? -1} ` +
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
    const initialSearchStart = getSimFrames();
    runFrontier(passStack, fallbackStack, () =>
      !(repairEnabled && firstCompletionFrame >= 0 &&
        getSimFrames() >= firstCompletionFrame * repair!.mainMargin),
    );
    const initialSearchEnd = getSimFrames();
    const initialStopReason = captured !== null
      ? (stopAfterFirstCompletion ? "first_completion_stop" : "budget_capture")
      : repairEnabled && firstCompletionFrame >= 0
        ? "handoff_to_repair"
        : frontierSize(passStack, fallbackStack) === 0
          ? "frontier_exhausted"
          : "compile_finished";
    budgetRecorder.endActive(initialSearchEnd, initialStopReason);
    budgetRecorder.recordSegment(
      "initial_search",
      initialSearchStart,
      initialSearchEnd,
      initialStopReason,
      initialBudgetAttemptId,
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
      const resumeStart = getSimFrames();
      // This phase can be a large share of a compile's charged work and can hold
      // its first terminal, so it needs an ACTIVE attempt, not only a segment:
      // observeActive/markTerminal are no-ops without one. It continues the
      // initial attempt's own frontier, hence the initial root anchor and the
      // hard budget as its ceiling.
      const resumedAttemptId = budgetRecorder.startAttempt({
        kind: "resumed",
        parentAttemptId: initialBudgetAttemptId,
        searchSeed,
        hasFallback: false,
        anchorGapIndex: root.search.gapIndex,
        startTotalSpentFrames: resumeStart,
        ceilingTotalSpentFrames: targetBudget,
        ceilingSource: "hard_budget",
        includeStartup: false,
      });
      runFrontier(passStack, fallbackStack, () => getSimFrames() < targetBudget);
      const resumeEnd = getSimFrames();
      budgetRecorder.endActive(
        resumeEnd,
        captured !== null
          ? (stopAfterFirstCompletion ? "first_completion_stop" : "budget_capture")
          : resumeEnd >= targetBudget
            ? "budget_capture"
            : "frontier_exhausted",
      );
      budgetRecorder.recordSegment(
        "resumed_search",
        resumeStart,
        resumeEnd,
        resumeEnd >= targetBudget ? "hard_budget" : "frontier_exhausted",
        resumedAttemptId,
      );
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
    forwardStageTop: policy.forwardStageTop,
    deadlineMargin: policy.deadlineMargin,
    forwardEval: policy.forwardEval,
    reuseLimit: policy.reuseLimit,
    previewCostWeight: PREVIEW_COST_WEIGHT,
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
    releaseSetup?: boolean;
    targetBudget?: number;
    budgetSlack?: number;
    /** Live deadline margin; Infinity for callers outside the paced search. */
    deadlineMargin?: number;
    forwardStageTop?: number;
    /** Slack-conditioned pre-completion depth (see HandoffSearchPolicy.forwardEval).
     *  Default true so non-policy callers keep the historical behavior. */
    forwardEval?: boolean;
  } = {},
): RankedOption[] {
  const requestedCandidates = config.nCand ?? HANDOFF_QUALITY_N_CAND;
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
  const pool = admittedHandoffPool(sorted, poolSize);
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
    const entrySpeed = getCandidateProbe(node.prefixEngine, gap, ctx).targetState.speed;
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
  const supportCount = supportTimeCoverageLaneEnabled()
    ? supportTimeCandidateCount(supportTimeCoverageDeficit(node, gap, gaps, ctx, pool))
    : 0;
  const kinematicEligible = kinematicRescueReady(node, telemetry) &&
    poolForwardContinuationAbsent(scored);
  const supportOptions = extraCandidateLane(node, gaps, ctx, seed, telemetry, extraScoring, {
    tag: "axisq",
    sourceAxis: "air",
    rankBase: extraRankBase,
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
    rankBase: extraRankBase + admittedSupportOptions.length,
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
    rankBase: extraRankBase + admittedSupportOptions.length +
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
  const selected = kinematic.length === 0
    ? eligible.slice(0, HANDOFF_BRANCHING)
    : [
      ...eligible.filter((option) => !isKinematicSupportCandidate(option.candidate))
        .slice(0, HANDOFF_BRANCHING - 1),
      kinematic[0],
    ];
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

/** Weakest AFFORDABLE contact gap to restart repair from. Weakness = Σ axis-error² (its
 *  share of the score's axis_error_rms; for a VALID track drift/missing are 0 by construction,
 *  so axis_quality is the only quality lever → axis-SSE is the faithful "most valuable to
 *  change" proxy — v1, a proxy for true upstream blame; see docs/archive/TRACK_REPAIR_EXPERIMENTS.md).
 *  FEASIBILITY: skip gaps whose cost to re-complete could exceed `remainingFrames` at the top
 *  of the estimator's own interval — restarting from a gap we can't finish wastes the slice.
 *  The caller supplies that upper bound (see `estCostUpperOf`), so this function holds no
 *  opinion about how cost uncertainty is priced. Iterating worst-first and returning the first
 *  feasible one naturally falls back to later/cheaper gaps when budget is tight. Skips
 *  `exhausted`; ties → lower index. Returns -1 if none feasible/left. */
function pickFeasibleWeakGap(
  report: DriftReport,
  gaps: Gap[],
  exhausted: Set<number>,
  upperCostOf: (k: number) => number,
  remainingFrames: number,
): number {
  const ranked: { gap: number; sse: number }[] = [];
  for (const g of report.gaps) {
    if (exhausted.has(g.gap_index)) continue;
    if (!gaps[g.gap_index]?.endsWithContact) continue;
    ranked.push({ gap: g.gap_index, sse: gapAxisSse(g) ?? 0 });
  }
  ranked.sort((a, b) => b.sse - a.sse || a.gap - b.gap);
  for (const r of ranked) {
    if (upperCostOf(r.gap) <= remainingFrames) return r.gap;
  }
  return -1;
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
  const nCand = qualityHandoffSampleCount(targetProfile, sparseContactCadence, targetBudget);
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
  profile: HandoffTargetProfile,
  sparseContactCadence: boolean,
  targetBudget: number | undefined,
): number {
  const base = handoffSampleCount(targetBudget);
  if (qualityNCandOverride() !== null) return base;
  return qualityBreadth(profile, sparseContactCadence, base);
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

function budgetAwareQualitySampleCount(targetBudget: number | undefined): number {
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
      studyNCandScale() * (HANDOFF_QUALITY_N_CAND_AT_REF *
        (Math.max(0, targetBudget) / HANDOFF_QUALITY_N_CAND_REF_FRAMES)),
    ),
  );
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
//   LR_STUDY_ROLLOUT_REDRAW    redrawFirstHopOnEmpty's dose             [0, 7]
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

registerCompileReset(() => {
  repairLaneActive = false;
});

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
// `pool_builds - pre_builds - post_builds` is the unpaced remainder.
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
  maxUpstream: number;
  upstreamOrder: "nearest-first" | "oldest-first";
  log: boolean;
};
/** Repair takes over at the first completion, not after a margin past it.
 *  Bracketed N=8 against `scarce-lean`: 1.0 +0.28 (SE 0.14), 1.1 shipped,
 *  1.25 -0.52 (SE 0.15). At 1.0 the five profile-band carve-outs that used to
 *  force this value back down (M101 flat-compact, M102 high-air-low-grain,
 *  M108 drums-pulse, M116 stable-dense, M144 residual) are all no-ops, so they
 *  and their profile predicates are gone with them. */
const REPAIR_MAIN_MARGIN = 1.0;

/** Repair configuration is now budget-blind and spec-blind: the restart-sizing
 *  headroom that used to be the last budget-shaped default here is gone
 *  entirely — `feasMargin` and its `LR_REPAIR_FEAS_MARGIN` override were a
 *  hand-swept multiplier on a cost estimate that now carries its own fitted
 *  interval, so the runtime asks `estCostUpperOf` instead (see the repair phase
 *  in `compileHandoffInternal`). The `profile` argument had been unused since
 *  the five main-margin carve-outs were deleted. Every field left is a constant
 *  or an env override. */
function repairConfig(): RepairConfig {
  const num = (name: string, def: number, lo: number, hi: number): number => {
    const n = Number.parseInt(readEnv(name) ?? "", 10);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
  };
  const flt = (name: string, def: number, lo: number, hi: number): number => {
    const n = Number.parseFloat(readEnv(name) ?? "");
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
  };
  const upstreamOrder = readEnv("LR_REPAIR_UPSTREAM_ORDER") ?? "oldest-first";
  if (upstreamOrder !== "nearest-first" && upstreamOrder !== "oldest-first") {
    throw new Error(
      `LR_REPAIR_UPSTREAM_ORDER must be nearest-first|oldest-first, got ${upstreamOrder}`,
    );
  }
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
    // Upstream blame: when a restart re-converges, walk the anchor up to N parents (each with a fresh
    // seed, so it's genuinely different — not the same-seed re-run that R3 rejected). LR_REPAIR_MAX_UPSTREAM
    // overrides.
    maxUpstream: num("LR_REPAIR_MAX_UPSTREAM", 4, 0, 64),
    // The older anchor receives first claim on the same charged repair budget:
    // it can alter the weak gap's inherited arrival, while an expensive local
    // restart cannot. The environment override remains diagnostic-only.
    upstreamOrder,
    log: readEnv("LR_REPAIR_LOG") === "1",
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
 * exactly the pool it always would, with the aim lane live; (ii) a second
 * rollout that dead-ends at this node pays nothing; and (iii)
 * `cachedForwardContinuation` now reports the corrected bit, so the
 * online-continuation filter stops pruning the frontier on a refuted proof.
 */
/**
 * STUDY-ONLY dose override for the re-draw increment above. **Never set this in
 * production, in a benchmark eval, or in a promotion candidate.**
 *
 * The constant's own docstring calls wider doses "a monotone family that can be
 * walked later on the same arithmetic"; this is the knob that walks it, and
 * nothing else. Refuses anything outside [0, 7] rather than clamping (0 is the
 * pre-redraw world, 7 keeps the widened draw inside the rollout width clamp).
 */
const readStudyRolloutRedraw = compileScopedEnv("LR_STUDY_ROLLOUT_REDRAW");

function rolloutRedrawOnEmpty(): number {
  const raw = readStudyRolloutRedraw();
  if (raw === undefined || raw === "") return HANDOFF_ROLLOUT_REDRAW_ON_EMPTY;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || String(n) !== raw.trim() || n < 0 || n > 7) {
    throw new Error(
      `LR_STUDY_ROLLOUT_REDRAW must be an integer in [0, 7] (STUDY-ONLY; never set it in ` +
        `production or in an eval), got "${raw}"`,
    );
  }
  return n;
}

export function redrawFirstHopOnEmpty(
  at: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  width: number,
): Candidate[] {
  const dose = rolloutRedrawOnEmpty();
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
      width + dose,
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
  return {
    track: buildTrackJson(allLines, outputDurationFrames, node.startState),
    report,
    budgetTelemetry: null,
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
      // How many committed fits in THIS output came from the proposer
      // (selection-level win rate; `aim.enum_emitted` is the pool-level rate).
      handoff_aimed_selected: fits.filter((fit) => fit !== null && fit.aimed === true).length,
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
