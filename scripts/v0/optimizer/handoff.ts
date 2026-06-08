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
  axisLookaheadEndFrame,
  detectWindow,
  releaseSpeedPenalty,
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
  type SearchNode,
} from "./node.ts";
import { polishLeafVariant } from "./polish.ts";
import { BestSoFarRegister, leafKeyForReport, type LeafKey } from "./register.ts";
import {
  getSimFrames,
  refundSimFramesTo,
  resetSimFrames,
} from "./sim_frames.ts";
import {
  resetArcPlacementStats,
  setCompileBudgetFrames,
  snapshotArcPlacementStats,
} from "../arc_placement.ts";
import { makeSolidLine } from "../arc.ts";
import {
  getCandidateProbe,
  getCandidateSamples,
  getViableCandidates,
  resetCandidateSamples,
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
   *  `compileBudgetCurve`). The search policy is still budget-oblivious this step —
   *  the budget is only the stop condition. */
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
  brakeContract?: Candidate[];
  brakeQuality?: Candidate[];
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
/** Candidates sampled per gap by the handoff search. The handoff ranks only a
 *  bounded pool by feasibility and branches 3-wide, so sampling the full default
 *  pool is mostly wasted per-node work that starves bounded-budget exploration.
 *  Before any passing output exists, use a cheaper deterministic prefix. Sparse
 *  contact cadences get one fewer first-pass sample to expose complete tracks
 *  earlier; dense cadences keep the safer 14-sample prefix. Once the register
 *  has a passing output, expand the deterministic prefix for quality search.
 *  These contract-phase values are the CAP: the pre-validity race scales the count
 *  DOWN toward CONTRACT_N_CAND_FLOOR when the frame budget is scarce (see
 *  `budgetAwareContractSampleCount`) so a small budget still reaches a complete
 *  track; an ample budget keeps the full cap. */
const HANDOFF_SPARSE_CONTRACT_N_CAND = 13;
const HANDOFF_CONTRACT_N_CAND = 14;
// Quality-phase breadth raised 16→24 (2026-06-07): with the forward-eval ranker
// sorting by true score and the new sparse specs plateauing on geometry diversity
// (not search depth), wider per-gap sampling lifts the high-budget ceiling
// (150k +2.9, 200k +2.5; canonical decide Δ+1.9 ACCEPT). 32 over-spends and
// dilutes (−1.4 vs 24), so 24 is the measured sweet spot. LR_QUALITY_NCAND overrides.
const HANDOFF_QUALITY_N_CAND = 24;
/** Floor for the budget-scaled contract sample count: even the leanest low-budget
 *  race samples at least this many candidates per contact gap, so greedy completion
 *  keeps enough breadth to route around dead ends (3 was the value that flipped deep
 *  specs from "never completes at 25k" to "valid at 25k" in the budget probe). */
const CONTRACT_N_CAND_FLOOR = 3;
/** Warm-up depth before the budget projection is trusted. The cost rate
 *  (`simFrames / depthReached`) is noisy and start-overhead-inflated at depth 1-2, which
 *  would lean spuriously even when the budget is ample. Holding the full cap until a few
 *  gaps of cost have accrued makes an ample budget a true no-op (every gap keeps the cap
 *  → search identical to the budget-oblivious baseline) and only a genuinely scarce
 *  budget ever scales breadth down. */
const CONTRACT_BUDGET_WARMUP_GAPS = 4;
/** Budget range over which the protective contract-breadth reduction fades to OFF.
 *  Below START the cut is fully applied (scarce budgets need it to ever complete);
 *  above START+SPAN it is gone (ample budgets keep full breadth → higher ceiling).
 *  Smooth/monotone in budget, deliberately wider than any single grid budget. */
const CONTRACT_BREADTH_FADE_START_FRAMES = 100_000;
const CONTRACT_BREADTH_FADE_SPAN_FRAMES = 50_000;
const HANDOFF_SPARSE_CONTACT_MEDIAN_FRAMES = Math.round(FPS * 0.75);
/** Extra deterministic sampling only when the normal batch finds no viable
 *  catch for a required contact. This preserves the cheap common path while
 *  spending bounded work at true contract dead-ends instead of immediately
 *  turning the prefix into a skipped-contact fallback. */
const HANDOFF_RESCUE_BASE_N_CAND = 32;
const HANDOFF_RESCUE_STARTUP_EXTRA_N_CAND = 48;
const HANDOFF_RESCUE_CANDIDATE_POOL = 12;
const HANDOFF_RESCUE_STARTUP_EXTRA_POOL = 4;
const HANDOFF_RESCUE_MIN_GAP_FRAMES = 16;
/** Distinct startup catch stream used only when the ordinary contract/rescue
 *  batches have zero viable options. This targets missing first/tight contacts
 *  without inserting an extra family into already-working contract search. */
const HANDOFF_STARTUP_DEAD_END_MAX_K = 24;
/** Sub-0.3s required-contact gaps are deadline-dominated: the normal cheap
 *  16-sample prefix can have zero hits even when a catch exists later in the
 *  deterministic sample order. Rescue only clean prefixes at true dead-ends so
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
const HANDOFF_REUSE_MATURE_BUDGET_SCALE_FRAMES = 150_000;
const HANDOFF_REUSE_MATURE_FULL_FEEDBACK_SCALE = 48;
const HANDOFF_PREVIEW_HORIZON = 1;
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
const START_SUPPORT_MID_AIR_MAX = 0.55;
const START_SUPPORT_RELEASE_MARGIN_FRAMES = K_BOUNCE_LANDING + 2;
const START_SUPPORT_LINE_Y = 5;
const START_SUPPORT_LINE_BACKTRACK_PX = 80;
const DEAD_END_PENALTY = 40;
const SURVIVOR_SCARCITY_PENALTY = 4;
/** The one-contact preview already pays for a future candidate. Reuse its local
 *  cost as a small quality signal for frame-span/smooth axes. */
const PREVIEW_COST_WEIGHT = 0.25;
const HANDOFF_STATE_WEIGHT = 0.08;
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
const HANDOFF_BRAKE_CONTRACT_BASE_K = 2;
const HANDOFF_BRAKE_CONTRACT_HIGH_OVERSPEED_K = 3;
const HANDOFF_BRAKE_QUALITY_BASE_K = 3;
const HANDOFF_BRAKE_QUALITY_HIGH_OVERSPEED_K = 4;
const HANDOFF_RELEASE_VERTICAL_WEIGHT = 0.045;
const HANDOFF_RELEASE_VERTICAL_BUDGET_SCALE_FRAMES = 150_000;
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
const PARTIAL_FUTURE_CONTACT_WINDOW = 20;
/** Speculative tail completion turns deep prefixes into full-duration register
 *  candidates before ordinary DFS reaches a leaf. Keep the window small because
 *  the completion suffix branches two-wide and is charged like normal search. */
const TAIL_COMPLETION_CONTACT_WINDOW = 8;
const TAIL_COMPLETION_BUDGET_WINDOW_EXTRA = 4;
const TAIL_COMPLETION_BUDGET_SCALE_FRAMES = 150_000;
const CONTRACT_TAIL_COMPLETION_LOW_BUDGET_WINDOW_EXTRA = 14;
const CONTRACT_TAIL_COMPLETION_LOW_BUDGET_SCALE_FRAMES = 75_000;
const TAIL_COMPLETION_FALLBACK_BRANCHING = 2;
const CONTRACT_TAIL_COMPLETION_LOW_BUDGET_EXTRA_BRANCHES = 1;
const CONTRACT_TAIL_COMPLETION_LOW_BUDGET_BRANCH_SCALE_FRAMES = 75_000;
const QUALITY_SHALLOW_TAIL_THROTTLE_MAX_PRESSURE = 1.0;
const QUALITY_SHALLOW_TAIL_THROTTLE_BUDGET_SCALE_FRAMES = 150_000;
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
  const maxNodes = opts.maxNodes ?? Math.max(MAX_NODES_FLOOR, targetBudget);
  if (!Number.isInteger(maxNodes) || maxNodes < 1) {
    throw new Error(`compileHandoff: maxNodes must be a positive integer, got ${maxNodes}`);
  }

  resetSimFrames();
  resetCandidateSamples();
  resetArcPlacementStats();

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

    const ctx: SpecContext = { allContactFrames, durationFrames };
    setForwardEvalContext(spec, gapAxisTargets);
    const sparseContractSearch = usesSparseContractSearch(gaps);
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
    let polishTried = 0;
    let polishChanged = 0;
    let polishAdopted = 0;
    const evaluationCache = new WeakMap<SearchNode, NodeEvaluation>();
    const consideredSearchNodes = new WeakSet<SearchNode>();
    let captured: CompileCheckpoint | null = null;

    // Track-repair: off by default, budget-gated. Completion-triggered (R2): the main
    // search runs only until the first complete track (frame count `firstCompletionFrame`),
    // then a post-pass spends the REST of the budget restarting the real frontier-DFS from
    // the weakest gap of the complete incumbent (see runRepairPhase). `bestCompleteNode` is
    // the live incumbent HandoffNode (updated on every register improvement) so repair can
    // replay its fits to reconstruct any prefix node for free (extendNodeCached memoizes).
    const repair = repairConfig();
    const repairEnabled = repair !== null && targetBudget >= repair.minBudget && startOptions.length > 0;
    let bestCompleteNode: HandoffNode | null = null;
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
        ),
        evaluation.key,
      );
      recordImprovementTelemetry(telemetry, phase, improved);
      const terminal = isTerminalNode(node.search, gaps);
      if (terminal) terminalConsiders++;
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
      return {
        ...best,
        budget,
        stats: {
          ...best.stats,
          candidates_sampled: getCandidateSamples(),
          candidates_viable: getViableCandidates(),
          budget_exhausted: budgetExhausted,
          sim_frames: getSimFrames(),
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

    // Per-node work shared by every traversal mode (DFS today, best-first next):
    // consider the node + its speculative tail, check the budget, polish terminals, and
    // expand into ranked children. It mutates the register/telemetry/budget exactly as the
    // old inline loop did, and keeps the contract->quality phase wiring
    // (register.getBestKey()) in ONE place so no traversal can silently drift from it. It
    // does NOT touch the frontier container — the caller enqueues the returned children.
    type ProcessResult =
      | { kind: "captured" }
      | { kind: "deferred" }
      | { kind: "expanded"; children: HandoffNode[] };
    const processNode = (node: HandoffNode): ProcessResult => {
      // Only tracked when repair can consume it (>=150k); a no-op on the low-budget hot path.
      if (repairEnabled && !framesAtReach.has(node.search)) framesAtReach.set(node.search, getSimFrames());
      consider(node, "main");

      const tailNode = completeNearTail(
        node,
        gaps,
        ctx,
        telemetry,
        register.getBestKey()?.contract_passed === true,
        sparseContractSearch,
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
        register.getBestKey()?.contract_passed === true,
        sparseContractSearch,
        targetBudget,
        register.getBestKey(),
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
    // (sims charged), deterministic per (spec,seed,budget). See TRACK_REPAIR_EXPERIMENTS.md.
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
    cost: fit.cost,
    ...(fit.releaseSpeed === undefined ? {} : { releaseSpeed: fit.releaseSpeed }),
    ...(fit.releaseVelocityY === undefined ? {} : { releaseVelocityY: fit.releaseVelocityY }),
    ...(fit.releaseGroundedFrames === undefined
      ? {}
      : { releaseGroundedFrames: fit.releaseGroundedFrames }),
    ...(fit.releaseAirborne === undefined ? {} : { releaseAirborne: fit.releaseAirborne }),
    ...(fit.ref === undefined ? {} : { ref: { ...fit.ref } }),
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
  return option.sourceAxis === undefined
    ? { rank: option.rank, source: option.source }
    : { rank: option.rank, source: option.source, sourceAxis: option.sourceAxis };
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
  const weakness = width <= 0
    ? 0
    : clamp01((QUALITY_FAR_BACK_ZERO_AXIS_QUALITY - key.axis_quality) / width);
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
  qualitySearch: boolean,
  sparseContractSearch: boolean,
  targetBudget: number,
  bestKey: LeafKey | null,
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

  let options = rankedOptions(node.search, gaps, ctx, node.searchSeed, telemetry, {
    nCand: qualitySearch
      ? handoffSampleCount(true, sparseContractSearch)
      : budgetAwareContractSampleCount(
        targetBudget,
        gaps.length - node.search.gapIndex,
        telemetry.deepestSeenGap + 1,
        sparseContractSearch,
      ),
    preview: handoffUsesFuturePreview(qualitySearch),
    expandedBrakeSearch: shouldUseExpandedBrakeSearch(qualitySearch),
    axisQualitySearch: qualitySearch,
    releaseSetup: qualitySearch,
    previewCostWeight: PREVIEW_COST_WEIGHT,
    targetBudget,
  });
  if (options.length === 0 && shouldAttemptDeadEndRescue(node.search, gap, ctx)) {
    telemetry.rescueAttempts++;
    const rescueNCand = deadEndRescueCandidateCount(gap);
    options = rankedOptions(node.search, gaps, ctx, node.searchSeed, telemetry, {
      nCand: rescueNCand,
      poolSize: deadEndRescueCandidatePoolSize(gap, rescueNCand),
      preview: handoffUsesFuturePreview(qualitySearch),
      expandedBrakeSearch: shouldUseExpandedBrakeSearch(qualitySearch),
      axisQualitySearch: qualitySearch,
      releaseSetup: qualitySearch,
      previewCostWeight: PREVIEW_COST_WEIGHT,
      targetBudget,
    });
    if (options.length > 0) telemetry.rescueSuccesses++;
  }
  if (
    options.length === 0 &&
    node.skippedContacts === 0 &&
    shouldAttemptShortDeadlineRescue(gap)
  ) {
    telemetry.rescueAttempts++;
    options = rankedOptions(node.search, gaps, ctx, node.searchSeed, telemetry, {
      nCand: HANDOFF_SHORT_RESCUE_N_CAND,
      poolSize: HANDOFF_SHORT_RESCUE_CANDIDATE_POOL,
      preview: handoffUsesFuturePreview(qualitySearch),
      expandedBrakeSearch: shouldUseExpandedBrakeSearch(qualitySearch),
      axisQualitySearch: qualitySearch,
      releaseSetup: qualitySearch,
      previewCostWeight: PREVIEW_COST_WEIGHT,
      targetBudget,
    });
    if (options.length > 0) telemetry.rescueSuccesses++;
  }
  if (options.length === 0 && shouldAttemptStartupDeadEndRescue(gap)) {
    telemetry.rescueAttempts++;
    options = startupDeadEndOptions(node.search, gaps, ctx, node.searchSeed, telemetry, {
      preview: handoffUsesFuturePreview(qualitySearch),
      releaseSetup: qualitySearch,
      previewCostWeight: PREVIEW_COST_WEIGHT,
    });
    if (options.length > 0) telemetry.rescueSuccesses++;
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

  return options.map((option) => ({
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

function deadEndRescueCandidateCount(gap: Gap): number {
  const startupPressure = startupRescuePressure(gap.endFrame);
  return HANDOFF_RESCUE_BASE_N_CAND +
    Math.round(HANDOFF_RESCUE_STARTUP_EXTRA_N_CAND * startupPressure);
}

function deadEndRescueCandidatePoolSize(gap: Gap, nCand: number): number {
  const startupPressure = startupRescuePressure(gap.endFrame);
  const pool = HANDOFF_RESCUE_CANDIDATE_POOL +
    Math.round(HANDOFF_RESCUE_STARTUP_EXTRA_POOL * startupPressure);
  return Math.min(nCand, pool);
}

function startupRescuePressure(endFrame: number): number {
  const t = Math.max(0, endFrame) / (FPS * 1.1);
  return 1 / (1 + t * t);
}

function shouldAttemptShortDeadlineRescue(gap: Gap): boolean {
  return gap.endsWithContact &&
    shortDeadlineRescueCandidateCount(gap.endFrame - gap.startFrame) > 0;
}

function shouldAttemptStartupDeadEndRescue(gap: Gap): boolean {
  return gap.endsWithContact && startupDeadEndCandidateCount(gap) > 0;
}

export function shouldUseExpandedBrakeSearch(qualitySearch: boolean): boolean {
  // Expanded brake breadth is used in the quality phase. (It was also enabled in
  // the contract phase for contact-event gaps, an axis category that no longer
  // exists.)
  return qualitySearch;
}

export function shortDeadlineRescueCandidateCount(gapFrames: number): number {
  if (!Number.isFinite(gapFrames) || gapFrames <= 0) return 0;
  return gapFrames < HANDOFF_SHORT_RESCUE_MAX_GAP_FRAMES
    ? HANDOFF_SHORT_RESCUE_N_CAND
    : 0;
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
  } = {},
): RankedOption[] {
  const candidates = startupDeadEndCandidates(node, gaps, ctx, seed, telemetry);
  if (candidates.length === 0) return [];
  const preview = config.preview ?? true;
  const previewCostWeight = config.previewCostWeight ?? PREVIEW_COST_WEIGHT;
  const scored = candidates.map((candidate, rank) =>
    scoreCandidateForHandoff(
      node,
      candidate,
      rank,
      "startup",
      gaps,
      ctx,
      seed,
      telemetry,
      preview,
      previewCostWeight,
      config.releaseSetup ?? false,
    )
  );
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
  const rng = makeRng((Math.imul(seed | 0, 1000003) + node.gapIndex + 0x85ebca6b) | 0);
  const out: Candidate[] = [];
  for (let attempt = 0; attempt < k; attempt++) {
    telemetry.startupAttempts++;
    const candidate = sampleOneCandidate(
      node.prefixEngine,
      gap,
      rng,
      ctx,
      node.prefixNextLineId,
      7000 + attempt,
      "startup_catch",
    );
    if (candidate !== null) {
      telemetry.startupSuccesses++;
      candidate.ref = undefined;
      out.push(candidate);
    }
  }
  return out;
}

function startupDeadEndCandidateCount(gap: Gap): number {
  const pressure = startupRescuePressure(gap.endFrame);
  return clampIntLocal(
    Math.round(HANDOFF_STARTUP_DEAD_END_MAX_K * pressure),
    0,
    HANDOFF_STARTUP_DEAD_END_MAX_K,
  );
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
    expandedBrakeSearch?: boolean;
    axisQualitySearch?: boolean;
    previewCostWeight?: number;
    releaseSetup?: boolean;
    targetBudget?: number;
  } = {},
): RankedOption[] {
  const requestedCandidates = config.nCand ?? HANDOFF_CONTRACT_N_CAND;
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
  const pool = sorted.slice(0, poolSize);
  const preview = config.preview ?? true;
  const previewCostWeight = config.previewCostWeight ?? PREVIEW_COST_WEIGHT;
  const scored = pool.map((candidate, rank) =>
    scoreCandidateForHandoff(
      node, candidate, rank, "pool", gaps, ctx, seed, telemetry, preview, previewCostWeight,
      config.releaseSetup ?? false,
      targetBudget,
    )
  );
  // Catch-reuse: translate the most recent committed catch to this gap's entry
  // state and offer them as extra candidates. On a steady periodic rhythm, a
  // recent sled-relative catch can remain valid at a later similar entry state.
  // Deterministic (pure function of the prefix); only ADDS candidates, so
  // monotonicity holds.
  const reuse = cachedReuseCatchCandidates(
    node,
    gaps,
    ctx,
    telemetry,
    reuseCandidateLimit(
      node,
      config.axisQualitySearch ?? false,
      targetBudget,
      telemetry,
    ),
  );
  reuse.forEach((candidate, j) =>
    scored.push(scoreCandidateForHandoff(
      node, candidate, poolSize + j, "reuse", gaps, ctx, seed, telemetry, preview, previewCostWeight,
      config.releaseSetup ?? false,
      targetBudget,
    ))
  );
  // Brake catches: uphill-entry arcs that bleed speed before contact, offered as
  // EXTRA candidates when the rider runs over a MODERATE target speed. Decoupled
  // from landing (impact-anchor still lands the contact), so they only win when
  // the overshoot penalty rewards their lower speed and simply lose elsewhere.
  // Excluded from reuse.
  const brake = cachedBrakeCatchCandidates(
    node,
    gaps,
    ctx,
    seed,
    config.expandedBrakeSearch ?? false,
    telemetry,
  );
  brake.forEach((candidate, j) =>
    scored.push(scoreCandidateForHandoff(
      node,
      candidate,
      poolSize + reuse.length + j,
      "brake",
      gaps,
      ctx,
      seed,
      telemetry,
      preview,
      previewCostWeight,
      config.releaseSetup ?? false,
      targetBudget,
    ))
  );
  scored.sort((a, b) =>
    a.score - b.score ||
    (a.candidate?.cost ?? Infinity) - (b.candidate?.cost ?? Infinity) ||
    a.rank - b.rank
  );
  return scored.slice(0, HANDOFF_BRANCHING);
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

function unitHash(seed: number): number {
  let x = seed | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 0x100000000;
}

function cachedReuseCatchCandidates(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  telemetry: HandoffTelemetry,
  reuseLimit = HANDOFF_REUSE_K,
): Candidate[] {
  const cache = extraCandidateCache.get(node) ?? {};
  if (cache.reuse === undefined || cache.reuseK !== reuseLimit) {
    cache.reuse = reuseCatchCandidates(node, gaps, ctx, telemetry, reuseLimit);
    cache.reuseK = reuseLimit;
    extraCandidateCache.set(node, cache);
  }
  return cache.reuse;
}

function reuseCandidateLimit(
  node: SearchNode,
  qualitySearch: boolean,
  targetBudget: number,
  telemetry: HandoffTelemetry,
): number {
  if (!qualitySearch) return HANDOFF_REUSE_K;
  const pressure = matureReuseExtraPressure(targetBudget, uniqueFullEvaluations(telemetry));
  if (pressure <= 0) return HANDOFF_REUSE_K;
  return HANDOFF_REUSE_K +
    (unitHash(matureReuseExtraSeed(node)) < pressure ? 1 : 0);
}

function matureReuseExtraPressure(targetBudget: number, uniqueFull: number): number {
  const budget = Math.max(0, targetBudget);
  const budgetPressure = smoothstep(
    clamp01(budget / (budget + HANDOFF_REUSE_MATURE_BUDGET_SCALE_FRAMES)),
  );
  const feedback = Math.max(0, uniqueFull);
  const feedbackPressure = smoothstep(
    clamp01(feedback / (feedback + HANDOFF_REUSE_MATURE_FULL_FEEDBACK_SCALE)),
  );
  return clamp01(HANDOFF_REUSE_MATURE_EXTRA_WEIGHT * budgetPressure * feedbackPressure);
}

function matureReuseExtraSeed(node: SearchNode): number {
  return (
    Math.imul(node.gapIndex + 1, 0x9e3779b1) ^
    Math.imul(node.prefixNextLineId | 0, 0x85ebca6b)
  ) | 0;
}

function cachedBrakeCatchCandidates(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  expandedBrakeSearch: boolean,
  telemetry: HandoffTelemetry,
): Candidate[] {
  const cache = extraCandidateCache.get(node) ?? {};
  if (cache.brakeSeed !== undefined && cache.brakeSeed !== seed) {
    cache.brakeContract = undefined;
    cache.brakeQuality = undefined;
  }
  const cached = expandedBrakeSearch ? cache.brakeQuality : cache.brakeContract;
  if (cached !== undefined && cache.brakeSeed === seed) return cached;

  const generated = brakeCatchCandidates(node, gaps, ctx, seed, expandedBrakeSearch, telemetry);
  if (expandedBrakeSearch) {
    cache.brakeQuality = generated;
  } else {
    cache.brakeContract = generated;
  }
  if (cache.brakeSeed !== seed) {
    cache.brakeSeed = seed;
  }
  extraCandidateCache.set(node, cache);
  return generated;
}

/** Offer uphill-entry brake catches when the rider runs over a moderate target
 *  speed (early creep pre-emption). Each is one tryCandidate sim; deterministic
 *  (own seeded RNG); ref cleared so a brake is never a steady-state reuse seed. */
function brakeCatchCandidates(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  expandedBrakeSearch: boolean,
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
  if (!shouldOfferBrakeCandidates(targetSpeedPx, speedRatio, expandedBrakeSearch)) {
    return [];
  }
  const brakeK = brakeCandidateCount(speedRatio, expandedBrakeSearch);
  if (brakeK <= 0) return [];
  const rng = makeRng((Math.imul(seed | 0, 1000003) + node.gapIndex + 7919) | 0);
  const out: Candidate[] = [];
  for (let attempt = 0; attempt < brakeK; attempt++) {
    telemetry.brakeAttempts++;
    const cand = sampleOneCandidate(
      node.prefixEngine, gap, rng, ctx, node.prefixNextLineId, attempt, "brake",
    );
    if (cand !== null) {
      telemetry.brakeSuccesses++;
      cand.ref = undefined; // never reuse a brake catch as a steady-state seed
      out.push(cand);
    }
  }
  return out;
}

export function brakeCandidateCount(speedRatio: number, expandedBrakeSearch = false): number {
  if (!Number.isFinite(speedRatio) || speedRatio < HANDOFF_BRAKE_RATIO_MIN) return 0;
  const highOverspeedK = expandedBrakeSearch
    ? HANDOFF_BRAKE_QUALITY_HIGH_OVERSPEED_K
    : HANDOFF_BRAKE_CONTRACT_HIGH_OVERSPEED_K;
  const baseK = expandedBrakeSearch
    ? HANDOFF_BRAKE_QUALITY_BASE_K
    : HANDOFF_BRAKE_CONTRACT_BASE_K;
  return speedRatio >= HANDOFF_BRAKE_HIGH_OVERSPEED_RATIO
    ? highOverspeedK
    : baseK;
}

export function shouldOfferBrakeCandidates(
  targetSpeedPxPerFrame: number,
  speedRatio: number,
  expandedBrakeSearch = false,
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
    brakeCandidateCount(speedRatio, expandedBrakeSearch) > 0;
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
  qualitySearch: boolean,
  sparseContractSearch: boolean,
  targetBudget: number,
): HandoffNode | null {
  if (!shouldAttemptNearTailCompletion(node, gaps, targetBudget, qualitySearch, telemetry)) {
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
    qualitySearch,
    sparseContractSearch,
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
  qualitySearch: boolean,
  sparseContractSearch: boolean,
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
    const gap = gaps[search.gapIndex];
    const options = rankedOptions(search, gaps, ctx, seed, telemetry, {
      nCand: qualitySearch
        ? handoffSampleCount(true, sparseContractSearch)
        : budgetAwareContractSampleCount(
          targetBudget,
          gaps.length - search.gapIndex,
          telemetry.deepestSeenGap + 1,
          sparseContractSearch,
        ),
      preview: false,
      expandedBrakeSearch: shouldUseExpandedBrakeSearch(qualitySearch),
      axisQualitySearch: qualitySearch,
      releaseSetup: qualitySearch,
      previewCostWeight: PREVIEW_COST_WEIGHT,
      targetBudget,
    })
      .filter((option) => option.candidate !== null)
      .slice(0, tailCompletionBranching(search, targetBudget, qualitySearch));
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
 *  change" proxy — v1, a proxy for true upstream blame; see TRACK_REPAIR_EXPERIMENTS.md).
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

export function handoffSampleCount(
  qualitySearch: boolean,
  sparseContractSearch = false,
): number {
  if (qualitySearch) {
    // LR_QUALITY_NCAND=<n> overrides the quality-phase candidate breadth (experiment:
    // does more geometry diversity pay now that the forward-eval ranker can sort it?).
    const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env?.LR_QUALITY_NCAND;
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? Math.min(64, n) : HANDOFF_QUALITY_N_CAND;
  }
  return sparseContractSearch ? HANDOFF_SPARSE_CONTRACT_N_CAND : HANDOFF_CONTRACT_N_CAND;
}

/** Budget-aware candidate count for the pre-validity (contract) race to a first
 *  complete track. The full per-gap breadth (`handoffSampleCount`) is the right effort
 *  when frames are ample, but on a scarce budget it is spent mid-prefix and the run
 *  scores zero (deep specs never reach the tail). So we estimate, from the search's own
 *  measured cost so far, whether finishing the remaining gaps at full breadth fits the
 *  frames still available; if not, breadth is scaled down from the cap in proportion to
 *  the shortfall (frames/node scales with breadth, so the projected cost scales with it
 *  too). Cost rate is `simFrames / depthReached` (frames per gap of depth achieved,
 *  which already folds in sibling/branching overhead); projected over `remainingGaps`
 *  that is the frames a full-breadth completion would need. Self-calibrating per
 *  (spec, seed, budget); parameter-free apart from the floor/cap; grid-independent. */
function budgetAwareContractSampleCount(
  targetBudget: number,
  remainingGaps: number,
  depthReached: number,
  sparseContractSearch: boolean,
): number {
  const cap = handoffSampleCount(false, sparseContractSearch);
  // A/B: LR_BUDGET_AWARE_CONTRACT=0 disables the breadth reduction entirely (full
  // breadth always, like work-new — breaks the high-budget ceiling but tanks 25k).
  if ((globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env?.LR_BUDGET_AWARE_CONTRACT === "0") return cap;
  // Hold full breadth until the cost rate is trustworthy; ample budgets never get past
  // this and stay byte-identical to the budget-oblivious baseline.
  if (depthReached < CONTRACT_BUDGET_WARMUP_GAPS || remainingGaps <= 0) return cap;
  const framesPerGap = getSimFrames() / depthReached;
  if (!(framesPerGap > 0)) return cap;
  const projectedToFinish = framesPerGap * remainingGaps;
  const framesLeft = Math.max(0, targetBudget - getSimFrames());
  if (projectedToFinish <= framesLeft) return cap; // full breadth fits → keep it
  const scaled = Math.round((cap * framesLeft) / projectedToFinish);
  const reduced = Math.max(CONTRACT_N_CAND_FLOOR, Math.min(cap, scaled));
  // The reduction is a protective race-to-first-complete cut: vital at scarce budgets
  // (else the run burns frames mid-prefix and scores 0), but on deep specs its cost
  // PROJECTION over-estimates and spuriously fires even when frames are ample, locking
  // a lower-quality first-complete basin that caps the high-budget ceiling. Fade the
  // cut out smoothly as total budget grows so ample budgets keep full contract breadth
  // and convert it into a higher ceiling. Smooth, monotone, deterministic in budget.
  const fade = smoothstep(
    (targetBudget - CONTRACT_BREADTH_FADE_START_FRAMES) / CONTRACT_BREADTH_FADE_SPAN_FRAMES,
  );
  return clampIntLocal(reduced + (cap - reduced) * fade, CONTRACT_N_CAND_FLOOR, cap);
}


export function handoffUsesFuturePreview(qualitySearch: boolean): boolean {
  return !qualitySearch;
}

export function usesSparseContractSearch(gaps: readonly Gap[]): boolean {
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
  qualitySearch = false,
  telemetry?: HandoffTelemetry,
): boolean {
  if (node.skippedContacts > 0 || isTerminalNode(node.search, gaps)) return false;
  if (!node.search.prefixFits.some((fit) => fit !== null)) return false;
  const remaining = remainingContactCount(node.search, gaps);
  if (
    qualitySearch &&
    telemetry !== undefined &&
    remaining <= 2 &&
    !shouldKeepShallowQualityTailCompletion(node.search, remaining, targetBudget, telemetry)
  ) {
    return false;
  }
  return remaining <= tailCompletionContactWindow(targetBudget, qualitySearch);
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
    clamp01(budget / (budget + QUALITY_SHALLOW_TAIL_THROTTLE_BUDGET_SCALE_FRAMES)),
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
  return (
    Math.imul(node.gapIndex + 1, 0x9e3779b1) ^
    Math.imul(node.prefixNextLineId | 0, 0x85ebca6b) ^
    Math.imul(remainingContacts + 1, 0x27d4eb2d)
  ) | 0;
}

function tailCompletionContactWindow(targetBudget: number, qualitySearch = true): number {
  const budget = Math.max(0, targetBudget);
  if (!qualitySearch) {
    const scarcityPressure = 1 - smoothstep(
      clamp01(
        budget /
          (budget + CONTRACT_TAIL_COMPLETION_LOW_BUDGET_SCALE_FRAMES),
      ),
    );
    return TAIL_COMPLETION_CONTACT_WINDOW +
      CONTRACT_TAIL_COMPLETION_LOW_BUDGET_WINDOW_EXTRA * scarcityPressure;
  }
  const pressure = smoothstep(clamp01(budget / (budget + TAIL_COMPLETION_BUDGET_SCALE_FRAMES)));
  return TAIL_COMPLETION_CONTACT_WINDOW + TAIL_COMPLETION_BUDGET_WINDOW_EXTRA * pressure;
}

function tailCompletionBranching(
  node: SearchNode,
  targetBudget: number,
  qualitySearch: boolean,
): number {
  if (qualitySearch) return TAIL_COMPLETION_FALLBACK_BRANCHING;
  const budget = Math.max(0, targetBudget);
  const pressure = 1 - smoothstep(
    clamp01(
      budget /
        (budget + CONTRACT_TAIL_COMPLETION_LOW_BUDGET_BRANCH_SCALE_FRAMES),
    ),
  );
  if (pressure <= 0) return TAIL_COMPLETION_FALLBACK_BRANCHING;
  const extraBranchPressure = clamp01(
    CONTRACT_TAIL_COMPLETION_LOW_BUDGET_EXTRA_BRANCHES * pressure,
  );
  return TAIL_COMPLETION_FALLBACK_BRANCHING +
    (unitHash(contractTailCompletionBranchSeed(node)) < extraBranchPressure ? 1 : 0);
}

function contractTailCompletionBranchSeed(node: SearchNode): number {
  return (
    Math.imul(node.gapIndex + 1, 0x9e3779b1) ^
    Math.imul(node.prefixNextLineId | 0, 0x85ebca6b)
  ) | 0;
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
): RankedOption {
  const child = extendNodeCached(node, candidate);
  // Forward-eval ranking (DEFAULT ≥75k): rank purely by the true metric score of where this arc
  // leads (charged forward rollout), replacing the local axis-L2 proxy below the gate.
  const fwdCfg = fwdEvalCfg; // resolved once per compile in setForwardEvalContext
  if (fwdCfg !== null && targetBudget >= fwdEvalMin) {
    const value = forwardArcValue(
      child,
      gaps,
      ctx,
      seed,
      matureForwardEvalConfig(fwdCfg, node, gaps, targetBudget),
    );
    recordCandidateReleaseCoverage(telemetry, candidate);
    return {
      candidate, child, rank, source, sourceAxis,
      previewContacts: 0, previewSurvivors: 0,
      score: -value,
    };
  }
  const preview = usePreview
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
  // Asymmetric speed-overshoot penalty (selection-only, handoff-only — does NOT
  // change candidate geometry). The rider creeps faster
  // than target over long runs (catches are net-downhill) and eventually stalls;
  // candidate.cost penalizes speed error symmetrically (1 of 3 axes), too weakly
  // to arrest creep. This extra term prefers, among the pool, catches whose
  // achieved speed does NOT overshoot the target — bleeding the creep using
  // catches that already exist (no new geometry). Only penalizes OVERshoot.
  const gap = gaps[node.gapIndex];
  const overshoot = candidateOvershootPenalty(candidate, gap);
  const releasePenalty = releaseSetup
    ? candidateReleaseSetupPenalty(candidate, gaps, node.gapIndex, telemetry, targetBudget)
    : 0;
  recordCandidateReleaseCoverage(telemetry, candidate);
  return {
    candidate,
    child,
    rank,
    source,
    sourceAxis,
    previewContacts: preview.landed,
    previewSurvivors: preview.survivors,
    score: candidate.cost + scarcity + previewCost + statePenalty + overshoot + releasePenalty,
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
    maturityPressure(targetBudget, HANDOFF_RELEASE_VERTICAL_BUDGET_SCALE_FRAMES) *
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
type ForwardEvalConfig = { variant: ForwardEvalVariant; depth: number; branch: number; charge: boolean };

let fwdEvalSpec: Spec | null = null;
let fwdEvalGapAxisTargets: AxisValues[] = [];
// Forward-eval config/gate resolved ONCE per compile (env is constant per run) so the
// per-candidate ranker reads these cached fields, not process.env, in the hot path.
let fwdEvalCfg: ForwardEvalConfig | null = null;
let fwdEvalMin = 0;
let fwdEvalDefaultConfig = true;
export function setForwardEvalContext(spec: Spec, gapAxisTargets: AxisValues[]): void {
  fwdEvalSpec = spec;
  fwdEvalGapAxisTargets = gapAxisTargets;
  fwdEvalCfg = forwardEvalConfig();
  fwdEvalMin = forwardEvalMinBudget();
}

function readEnv(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.[name];
}

/** Track-repair config (worst-gap suffix rebuild, see TRACK_REPAIR_EXPERIMENTS.md).
 *  ON by default; LR_REPAIR=0|off disables. Completion-triggered: the main search runs to the
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
function repairConfig(): RepairConfig | null {
  const raw = readEnv("LR_REPAIR");
  if (raw === "0" || raw === "off") return null;
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
    mainMargin: flt("LR_REPAIR_MAIN_MARGIN", 1.0, 1.0, 10.0),
    // Feasibility margin: require (measured cost-to-end × feasMargin) ≤ remaining budget, and size each
    // restart's ceiling to cost × feasMargin. TIGHT (1.1 = 10% headroom) is best: the worst/highest-value
    // gaps are usually EARLY (expensive), so a loose margin (1.5) banished repairs to the cheap tail and
    // cost score; 1.1 still skips genuinely-doomed restarts. (m1.1 592.0 > off 591.1 > m1.5 590.5, honest.)
    feasMargin: flt("LR_REPAIR_FEAS_MARGIN", 1.1, 1.0, 10.0),
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
  return { variant: v, depth, branch, charge: true };
}

function forwardEvalConfig(): ForwardEvalConfig | null {
  const env = readEnv("LR_FWD_EVAL");
  fwdEvalDefaultConfig = env === undefined || env === "";
  if (env === "0" || env === "off") return null;
  const cfg = parseForwardSpec(env === undefined || env === "" ? "greedy:2" : env);
  // Rollout frames are CHARGED honestly by default; LR_FWD_EVAL_CHARGE=0 refunds them (the
  // budget-refunded ceiling experiment). Resolved once here, not re-read per candidate.
  return cfg === null ? null : { ...cfg, charge: readEnv("LR_FWD_EVAL_CHARGE") !== "0" };
}

/** Start-selection eval: rank initial conditions by the TRUE forward score of where they lead,
 *  instead of the local axis-L2 proxy. DEFAULT greedy:2 — the start is the most consequential
 *  choice on a forward-dependent chain (inherited by the whole track), so the honest forward tool
 *  pays here at EVERY budget (+32.5 headline, lifts validity). LR_START_EVAL=off reverts to the
 *  proxy; greedy:2 is the sweet spot (best/avg/greedy:3 don't pay charged). Always charged. */
function startEvalConfig(): ForwardEvalConfig | null {
  const env = readEnv("LR_START_EVAL");
  if (env === "0" || env === "off") return null;
  return parseForwardSpec(env === undefined || env === "" ? "greedy:2" : env);
}

/** True forward-rollout score of a start root (charged). Higher = better start. */
function startForwardScore(
  root: SearchNode, gaps: Gap[], ctx: SpecContext, seed: number, cfg: ForwardEvalConfig,
): number {
  return cfg.variant === "avg"
    ? forwardAvgNextScore(root, gaps, ctx, seed, cfg.branch)
    : forwardRolloutScore(root, gaps, ctx, seed, cfg.depth, cfg.variant === "best" ? cfg.branch : 1);
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
    ? ctx.durationFrames + 20
    : partialOutputDurationFrames(horizonFrame, ctx.durationFrames);
  const det = detectWindow(search.prefixEngine, 0, outputDurationFrames);
  const fits = search.prefixFits.slice();
  while (fits.length < gaps.length) fits.push(null);
  const rawReport = buildDriftReport(
    det, spec, gaps, ctx.allContactFrames, ctx.durationFrames, [], fits, fwdEvalGapAxisTargets,
  );
  const report = fullDuration ? rawReport : asPartialReport(rawReport, horizonFrame);
  return leafKeyForReport(report, ctx.durationFrames).full_score;
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
): number {
  if (depthLeft <= 0 || isTerminalNode(search, gaps)) return forwardNodeScore(search, gaps, ctx);
  const at = advanceToNextContact(search, gaps);
  if (at === null) return forwardNodeScore(search, gaps, ctx);
  const cands = getCandidatesSorted(at, gaps, ctx, seed, branch);
  if (cands.length === 0) return forwardNodeScore(search, gaps, ctx);
  let best = -Infinity;
  for (const c of cands) {
    const s = forwardRolloutScore(extendNodeCached(at, c), gaps, ctx, seed, depthLeft - 1, branch);
    if (s > best) best = s;
  }
  return best;
}

/** avg: mean true partial-track score over the top-`m` next-contact alternatives, 1 deep. */
function forwardAvgNextScore(
  search: SearchNode, gaps: Gap[], ctx: SpecContext, seed: number, m: number,
): number {
  const at = advanceToNextContact(search, gaps);
  if (at === null) return forwardNodeScore(search, gaps, ctx);
  const cands = getCandidatesSorted(at, gaps, ctx, seed, m);
  if (cands.length === 0) return forwardNodeScore(search, gaps, ctx);
  let sum = 0;
  for (const c of cands) sum += forwardNodeScore(extendNodeCached(at, c), gaps, ctx);
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
  try {
    return cfg.variant === "avg"
      ? forwardAvgNextScore(child, gaps, ctx, seed, cfg.branch)
      : forwardRolloutScore(child, gaps, ctx, seed, cfg.depth, cfg.variant === "best" ? cfg.branch : 1);
  } finally {
    if (!charge) refundSimFramesTo(saved);
  }
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
    base.branch !== 1 ||
    !targetsVerticalDramaAxis(gaps[node.gapIndex]?.targets)
  ) {
    return base;
  }
  const pressure = smoothstep(
    (targetBudget - MATURE_AVG_FWD_EVAL_START_FRAMES) /
      MATURE_AVG_FWD_EVAL_SPAN_FRAMES,
  );
  if (pressure <= 0 || unitHash(matureForwardEvalSeed(node)) >= pressure) return base;
  return {
    variant: "avg",
    depth: 2,
    branch: MATURE_AVG_FWD_EVAL_BRANCH,
    charge: base.charge,
  };
}

function targetsVerticalDramaAxis(targets: AxisValues | undefined): boolean {
  return targets?.amplitude !== undefined || targets?.elevation !== undefined;
}

function matureForwardEvalSeed(node: SearchNode): number {
  return (
    Math.imul(node.gapIndex + 1, 0x9e3779b1) ^
    Math.imul(node.prefixNextLineId | 0, 0x85ebca6b) ^
    0x632be59b
  ) | 0;
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

function handoffStatePenalty(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
): number {
  const rider = getRiderMetered(engine, gap.endFrame);
  const v = rider.velocity ?? { x: 0, y: 0 };
  const speed = Math.hypot(v.x, v.y);
  if (speed <= 1e-6) return HANDOFF_STATE_WEIGHT * 8;
  const angleDeg = Math.abs((Math.atan2(v.y, v.x) * 180) / Math.PI);
  const verticalExcess = Math.max(0, Math.abs(v.y) - 8);
  const angleExcess = Math.max(0, angleDeg - 70) / 10;
  return HANDOFF_STATE_WEIGHT * (verticalExcess + angleExcess);
}

function nextContactGapIndex(gaps: Gap[], from: number): number {
  for (let i = from; i < gaps.length; i++) {
    if (gaps[i].endsWithContact) return i;
  }
  return -1;
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
  const ballisticStartPool = Math.min(
    START_BALLISTIC_SCORING_POOL,
    orderedBallisticStarts.length,
    Math.floor(START_BALLISTIC_SCORING_POOL * ballisticStartBudgetPressure(targetBudget)),
  );
  const baseStartPool = Math.max(0, START_SCORING_POOL - 1 - ballisticStartPool);
  const supportStarts = startupSupportStartSeeds(firstContactAxes, firstGap);
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
          ? -startForwardScore(root, gaps, ctx, seed, startCfg)
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
): StartSeed {
  return {
    start,
    startLines: cloneTrackLines(startLines),
  };
}

function startupSupportStartSeeds(
  firstContactAxes: AxisValues | null,
  firstGap: Gap | null,
): StartSeed[] {
  if (firstGap === null || firstContactAxes === null) return [];
  const air = firstContactAxes.air;
  if (air === undefined || air > START_SUPPORT_MID_AIR_MAX) return [];
  if (firstGap.endFrame <= START_SUPPORT_RELEASE_MARGIN_FRAMES + K_BOUNCE_LANDING) return [];

  const targetAirborneFrames = Math.max(
    START_SUPPORT_RELEASE_MARGIN_FRAMES,
    Math.round(firstGap.endFrame * air),
  );
  const releaseFrame = Math.max(1, firstGap.endFrame - targetAirborneFrames);
  const targetSpeed = startTargetSpeedPx(firstContactAxes);
  const offsets = air <= START_SUPPORT_LOW_AIR_MAX ? [-0.75, 0, 1.25] : [0];
  const speeds = uniqueRounded(offsets.map((offset) => targetSpeed + offset))
    .filter((speed) => speed > 0 && speed <= START_DEFAULTS.VELOCITY_SANITY_CAP);

  return speeds.map((vx) => {
    const x2 = round3(Math.max(20, vx * releaseFrame));
    const line = makeSolidLine(
      1,
      -START_SUPPORT_LINE_BACKTRACK_PX,
      START_SUPPORT_LINE_Y,
      x2,
      START_SUPPORT_LINE_Y,
    );
    return startSeed({ vx: round3(vx), vy: 0 }, [line]);
  });
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
): { report: DriftReport; key: LeafKey; outputDurationFrames: number; fullDuration: boolean } {
  const fullDuration = isTerminalNode(node.search, gaps);
  const partialHorizonFrame = fullDuration
    ? durationFrames
    : processedHorizonFrame(node.search, gaps);
  const outputDurationFrames = fullDuration
    ? durationFrames + 20
    : partialOutputDurationFrames(partialHorizonFrame, durationFrames);
  const det = detectWindow(node.search.prefixEngine, 0, outputDurationFrames);
  const rawReport = buildDriftReport(
    det, spec, gaps, allContactFrames, durationFrames, [], paddedFits(node, gaps.length), gapAxisTargets,
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
  return Math.max(1, Math.min(durationFrames, horizonFrame + 20));
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
  const startVelocity = node.startState.velocity;
  const startSpeed = Math.hypot(startVelocity.x, startVelocity.y);
  const startAngleDeg = (Math.atan2(startVelocity.y, startVelocity.x) * 180) / Math.PI;
  const candidateRanks = selectedCandidateRanks(node.rankTrace);
  const candidateRankSum = candidateRanks.reduce((sum, rank) => sum + rank, 0);
  const candidateRankCount = candidateRanks.length;
  const sourceCounts = selectedCandidateSourceCounts(node);
  const axisQualitySourceCounts = selectedAxisQualitySourceCounts(node);
  return {
    track: buildTrackJson(allLines, outputDurationFrames, node.startState),
    report,
    stats: {
      candidates_sampled: getCandidateSamples(),
      candidates_viable: getViableCandidates(),
      engine_rebuilds: 0,
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
      handoff_selected_axis_quality_by_axis: axisQualitySourceCounts,
      handoff_selected_candidate_pool_count: sourceCounts.pool,
      handoff_selected_candidate_reuse_count: sourceCounts.reuse,
      handoff_selected_candidate_brake_count: sourceCounts.brake,
      handoff_selected_candidate_startup_count: sourceCounts.startup,
      handoff_selected_candidate_axis_quality_count: sourceCounts.axisq,
    },
  };
}

function selectedCandidateSourceCounts(
  node: HandoffNode,
): Record<HandoffCandidateSourceName, number> {
  const counts = Object.fromEntries(
    HANDOFF_CANDIDATE_SOURCES.map((source) => [source, 0]),
  ) as Record<HandoffCandidateSourceName, number>;
  for (const entry of node.rankTrace) {
    if (entry.rank < 0) continue;
    const source = entry.source;
    if (source === "skip") continue;
    counts[source]++;
  }
  return counts;
}

function selectedAxisQualitySourceCounts(
  node: HandoffNode,
): Partial<Record<AxisName, number>> {
  const counts: Partial<Record<AxisName, number>> = {};
  for (const entry of node.rankTrace) {
    if (entry.rank < 0 || entry.source !== "axisq") continue;
    const axis = entry.sourceAxis;
    if (axis === undefined) continue;
    counts[axis] = (counts[axis] ?? 0) + 1;
  }
  return counts;
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
