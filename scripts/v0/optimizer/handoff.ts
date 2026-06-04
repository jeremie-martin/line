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
 * That probe is engine-in-loop and charged in sim-frames, but it is a fixed
 * policy decision independent of the caller's budgets. Budgets only define
 * checkpoints along the deterministic node sequence; a strict best-so-far
 * register ranks every prefix output considered. The budget contract only
 * requires that checkpoints expose prefixes of one deterministic node sequence;
 * the search policy itself does not read the budgets.
 */

import { detect, extractRawTrajectory, getRiderMetered } from "../../lib/detector.ts";
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
  CALIB,
  FPS,
  HANDOFF_CANDIDATE_SOURCES,
  HANDOFF_EVALUATION_PHASES,
  SPEED_AXIS,
  START_DEFAULTS,
  authoredSpeedToPx,
  secToFrame,
  type AxisName,
  type AxisValues,
  type CandidateSampleMode,
  type HandoffContactCountCounter,
  type HandoffEvaluationPhase,
  type HandoffEvaluationPhaseCounter,
  type Gap,
  type HandoffCandidateSourceName,
} from "../types.ts";
import {
  axisLookaheadEndFrame,
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
  resetSimFrames,
} from "./sim_frames.ts";
import {
  readTargetState,
  resetArcPlacementStats,
  snapshotArcPlacementStats,
} from "../arc_placement.ts";
import {
  getCandidateSamples,
  getViableCandidates,
  resetCandidateSamples,
  sampleOneCandidate,
} from "./sample.ts";
import type { Candidate, SpecContext } from "./sample.ts";
import type {
  CompileCheckpoint,
  CompileOutput,
  CompileResult,
  CompileStats,
  DriftReport,
  Spec,
} from "./types.ts";

export type CompileHandoffOptions = {
  /** Ascending simulated-frame checkpoints to return from one deterministic run. */
  budgets?: number[];
  /** Fixed search-size cap, independent of budget. Keeps unbudgeted probes finite. */
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
  startRank: number;
  /** Candidate-sampling seed for this prefix's downstream search lane. */
  searchSeed: number;
  /** Diagnostic lane id; lane 0 is the baseline deterministic handoff run. */
  searchLane: number;
  /** Stable id for one alternate-lane prefix subtree. Undefined on baseline lane. */
  prefixBranchKey?: string;
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
  root: SearchNode;
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
  suffixRepairAttempts: number;
  suffixRepairSuccesses: number;
  suffixRepairImprovements: number;
  suffixRepairNodes: number;
  previews: number;
  previewContacts: number;
  previewSurvivors: number;
  reuseAttempts: number;
  reuseSuccesses: number;
  brakeAttempts: number;
  brakeSuccesses: number;
  axisQualityAttempts: number;
  axisQualitySuccesses: number;
  axisQualityAttemptsByAxis: Partial<Record<AxisName, number>>;
  axisQualitySuccessesByAxis: Partial<Record<AxisName, number>>;
  rescueAttempts: number;
  rescueSuccesses: number;
  skips: number;
  deferredSkips: number;
  prefixBranchForks: number;
  prefixBranchEvaluations: number;
  prefixBranchFullEvaluations: number;
  prefixBranchImprovements: number;
  prefixBranchPrunes: number;
  prefixBranchDuplicateKeySkips: number;
  prefixBranchForksByRemainingContacts: Record<number, number>;
  prefixBranchEvaluationsByRemainingContacts: Record<number, number>;
  prefixBranchFullEvaluationsByRemainingContacts: Record<number, number>;
  prefixBranchImprovementsByRemainingContacts: Record<number, number>;
  prefixBranchPrunesByRemainingContacts: Record<number, number>;
  prefixBranchDuplicateKeySkipsByRemainingContacts: Record<number, number>;
  startRanksSeen: Set<number>;
  startRanksWithFits: Set<number>;
};

type PrefixBranchController = {
  enabled: boolean;
  baseSearchSeed: number;
  forkedKeys: Set<string>;
  work: Map<string, PrefixBranchWork>;
};

type PrefixBranchWork = {
  remainingContacts: number;
  evaluations: number;
  fullEvaluations: number;
  improvements: number;
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
  reuse?: Candidate[];
  brakeSeed?: number;
  brakeContract?: Candidate[];
  brakeQuality?: Candidate[];
  axisQualitySeed?: number;
  axisQuality?: AxisQualityCandidate[];
};

type AxisQualityCandidate = {
  candidate: Candidate;
  axis: AxisName;
};

type AxisQualityStreamPolicy = {
  samples: number;
  seedSalt: number;
  attemptOffset: number;
  mode?: CandidateSampleMode;
  targetMax?: number;
};

const extraCandidateCache = new WeakMap<SearchNode, ExtraCandidateCache>();

const DEFAULT_MAX_NODES = 800;
const HANDOFF_CANDIDATE_POOL = 8;
const HANDOFF_BRANCHING = 3;
/** Candidates sampled per gap by the handoff search. The handoff ranks only a
 *  bounded pool by feasibility and branches 3-wide, so sampling the full default
 *  pool is mostly wasted per-node work that starves bounded-budget exploration.
 *  Before any passing output exists, use a cheaper deterministic prefix. Sparse
 *  contact cadences get one fewer first-pass sample to expose complete tracks
 *  earlier; dense cadences keep the safer 14-sample prefix. Once the register
 *  has a passing output, expand the deterministic prefix for quality search.
 *  This adapts to spec/search state, not requested budgets. Must stay >=
 *  HANDOFF_CANDIDATE_POOL. */
const HANDOFF_SPARSE_CONTRACT_N_CAND = 13;
const HANDOFF_CONTRACT_N_CAND = 14;
const HANDOFF_QUALITY_N_CAND = 16;
const HANDOFF_SPARSE_CONTACT_MEDIAN_FRAMES = Math.round(FPS * 0.75);
/** Extra deterministic sampling only when the normal batch finds no viable
 *  catch for a required contact. This preserves the cheap common path while
 *  spending bounded work at true contract dead-ends instead of immediately
 *  turning the prefix into a skipped-contact fallback. */
const HANDOFF_RESCUE_N_CAND = 32;
const HANDOFF_RESCUE_CANDIDATE_POOL = 12;
const HANDOFF_RESCUE_MIN_GAP_FRAMES = 16;
/** Sub-0.3s required-contact gaps are deadline-dominated: the normal cheap
 *  16-sample prefix can have zero hits even when a catch exists later in the
 *  deterministic sample order. Rescue only clean prefixes at true dead-ends so
 *  already-working dense paths keep their normal cheap order. */
const HANDOFF_SHORT_RESCUE_N_CAND = 80;
const HANDOFF_SHORT_RESCUE_CANDIDATE_POOL = 16;
const HANDOFF_SHORT_RESCUE_MAX_GAP_FRAMES = 12;
const HANDOFF_PREVIEW_K = 1;
/** How many of the most-recent committed catches to translate+reuse per gap. */
const HANDOFF_REUSE_K = 2;
const HANDOFF_PREVIEW_HORIZON = 1;
const START_OPTION_LIMIT = 10;
const START_SCORING_POOL = 16;
const START_FIRST_K = 8;
const START_FIRST_OPTIONS = 3;
const START_NEXT_K = 8;
const START_HEURISTIC_WEIGHT = 0.15;
const START_SPEED_ANCHOR_OFFSETS_PX_PER_FRAME = [-2.5, -0.75, 0, 1.25, 2.5] as const;
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
const HANDOFF_AIR_SUPPORT_QUALITY_K = 1;
const HANDOFF_LOW_AIR_SUPPORT_TARGET_MAX = 0.25;
const HANDOFF_AXIS_QUALITY_STREAMS: Partial<Record<AxisName, AxisQualityStreamPolicy>> = {
  air: {
    samples: HANDOFF_AIR_SUPPORT_QUALITY_K,
    seedSalt: 0x27d4eb2f,
    attemptOffset: 2000,
    mode: "air_support",
    targetMax: HANDOFF_LOW_AIR_SUPPORT_TARGET_MAX,
  },
};
const PARTIAL_FUTURE_CONTACT_WINDOW = 20;
/** Speculative tail completion turns deep prefixes into full-duration register
 *  candidates before ordinary DFS reaches a leaf. Keep the window small because
 *  the completion suffix branches two-wide and is charged like normal search. */
const TAIL_COMPLETION_CONTACT_WINDOW = 8;
const TAIL_COMPLETION_FALLBACK_BRANCHING = 2;
const FAR_BACK_FRONTIER_LAG = 3;
/** Once a passing output exists but its axis quality is still weak, spend sparse
 *  deterministic pulses on older pass-frontier branches. Very low incumbents
 *  keep the original repair cadence; moderate incumbents get a much rarer
 *  pulse. This is budget-agnostic repair scheduling: it still walks one fixed
 *  node sequence, but does not let poor early choices monopolize the quality
 *  phase. */
const QUALITY_FAR_BACK_FRONTIER_INTERVAL = 16;
const QUALITY_FAR_BACK_MAX_AXIS_QUALITY = 0.24;
const MODERATE_QUALITY_FAR_BACK_FRONTIER_INTERVAL = 64;
const MODERATE_QUALITY_FAR_BACK_MAX_AXIS_QUALITY = 0.28;
/** For weak rows with almost no terminal feedback, occasionally run a
 *  bounded two-wide suffix completion from a clean prefix before ordinary DFS
 *  reaches the tail window. This is deliberately scarce and only uses existing
 *  candidate ranking; the register still decides whether the full output helps. */
const QUALITY_SUFFIX_REPAIR_INTERVAL = 32;
const QUALITY_SUFFIX_REPAIR_MAX_AXIS_QUALITY = QUALITY_FAR_BACK_MAX_AXIS_QUALITY;
const QUALITY_SUFFIX_REPAIR_MAX_FULL_EVALUATIONS = 4;
const QUALITY_SUFFIX_REPAIR_MAX_ATTEMPTS = 4;
const QUALITY_SUFFIX_REPAIR_MAX_NODES = 128;
const QUALITY_SUFFIX_REPAIR_BRANCHING = 2;
const PREFIX_BRANCH_MIN_AXIS_QUALITY = 0.24;
/** Prefix branching is an escape hatch for weak-to-good incumbents, not a polish
 *  mechanism for rows that are already very strong. Above this quality, spend
 *  the remaining deterministic sequence on the baseline/frontier instead. */
const PREFIX_BRANCH_MAX_AXIS_QUALITY = 0.5;
/** Conservative production version of the prefix-branch probe: once a passing
 *  incumbent exists, occasionally clone a clean baseline-lane prefix into one
 *  alternate downstream sample lane. The clone is ordinary frontier work and
 *  the existing register remains the only selector, so this preserves the
 *  anytime/checkpoint contract. */
const PREFIX_BRANCH_LANE = 1;
const PREFIX_BRANCH_FRONTIER_INTERVAL = 4;
const PREFIX_BRANCH_MIN_PREFIX_CONTACTS = 4;
const PREFIX_BRANCH_MIN_REMAINING_CONTACTS = 4;
/** A spawned alternate-lane subtree must convert into the register quickly
 *  enough to justify continuing it. This cap is per branch key, not global:
 *  pruning one non-converting suffix does not stop later baseline prefixes from
 *  forking their own deterministic lane. */
const PREFIX_BRANCH_STALLED_FULL_EVAL_CAP = 24;

export function compileHandoff(
  userSpec: Spec,
  seed = 0,
  opts: CompileHandoffOptions = {},
): CompileResult {
  return compileHandoffInternal(userSpec, seed, opts, null);
}

export function compileHandoffFromSnapshot(
  userSpec: Spec,
  seed: number,
  snapshot: HandoffNodeSnapshot,
  opts: CompileHandoffOptions = {},
): CompileResult {
  return compileHandoffInternal(userSpec, seed, opts, snapshot);
}

function compileHandoffInternal(
  userSpec: Spec,
  seed: number,
  opts: CompileHandoffOptions,
  initialSnapshot: HandoffNodeSnapshot | null,
): CompileResult {
  if (!Number.isSafeInteger(seed)) {
    throw new Error(`compileHandoff: seed must be a safe integer, got ${seed}`);
  }
  const searchSeed = opts.searchSeed ?? seed;
  if (!Number.isSafeInteger(searchSeed)) {
    throw new Error(`compileHandoff: searchSeed must be a safe integer, got ${searchSeed}`);
  }
  const budgets = normalizeBudgets(opts.budgets);
  const maxNodes = opts.maxNodes ?? DEFAULT_MAX_NODES;
  if (!Number.isInteger(maxNodes) || maxNodes < 1) {
    throw new Error(`compileHandoff: maxNodes must be a positive integer, got ${maxNodes}`);
  }

  resetSimFrames();
  resetCandidateSamples();
  resetArcPlacementStats();

  {
    validateSpec(userSpec);
    // Do not run a separate optimized-preroll pre-pass here. In the handoff
    // optimizer, the initial condition is the first state boundary of the search;
    // pre-worlding belongs in this search, not as a hidden budget-consuming
    // compiler before it. A manual `start` is still honored by resolveStartState.
    const spec: Spec = { ...userSpec, preroll: undefined };
    const durationFrames = secToFrame(spec.duration);
    const allContactFrames = [...spec.contacts]
      .map((c) => secToFrame(c.t))
      .sort((a, b) => a - b);

    const gaps = sliceTimeline(allContactFrames, durationFrames);
    const masterRng = makeRng(seed);
    for (const gap of gaps) {
      const sec = effectiveAxes(gap, spec);
      gap.targets = sampleGapTargets(sec, spec.jitter ?? CALIB.SIGMA, masterRng);
    }

    const ctx: SpecContext = { allContactFrames, durationFrames };
    const sparseContractSearch = usesSparseContractSearch(gaps);
    const startOptions = initialSnapshot === null
      ? buildStartOptions(userSpec, spec, gaps, ctx, searchSeed)
      : [];
    const root: HandoffNode = initialSnapshot === null
      ? {
        search: startOptions[0].root,
        startState: startOptions[0].state,
        startRank: startOptions[0].rank,
        searchSeed,
        searchLane: 0,
        prefixBranchKey: undefined,
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
      suffixRepairAttempts: 0,
      suffixRepairSuccesses: 0,
      suffixRepairImprovements: 0,
      suffixRepairNodes: 0,
      previews: 0,
      previewContacts: 0,
      previewSurvivors: 0,
      reuseAttempts: 0,
      reuseSuccesses: 0,
      brakeAttempts: 0,
      brakeSuccesses: 0,
      axisQualityAttempts: 0,
      axisQualitySuccesses: 0,
      axisQualityAttemptsByAxis: {},
      axisQualitySuccessesByAxis: {},
      rescueAttempts: 0,
      rescueSuccesses: 0,
      skips: 0,
      deferredSkips: 0,
      prefixBranchForks: 0,
      prefixBranchEvaluations: 0,
      prefixBranchFullEvaluations: 0,
      prefixBranchImprovements: 0,
      prefixBranchPrunes: 0,
      prefixBranchDuplicateKeySkips: 0,
      prefixBranchForksByRemainingContacts: {},
      prefixBranchEvaluationsByRemainingContacts: {},
      prefixBranchFullEvaluationsByRemainingContacts: {},
      prefixBranchImprovementsByRemainingContacts: {},
      prefixBranchPrunesByRemainingContacts: {},
      prefixBranchDuplicateKeySkipsByRemainingContacts: {},
      startRanksSeen: new Set<number>(),
      startRanksWithFits: new Set<number>(),
    };
    const polishEnabled = opts.polish ?? false;
    let polishTried = 0;
    let polishChanged = 0;
    let polishAdopted = 0;
    const evaluationCache = new WeakMap<SearchNode, NodeEvaluation>();
    const consideredSearchNodes = new WeakSet<SearchNode>();
    const checkpoints: CompileCheckpoint[] = [];
    let nextBudgetIndex = 0;
    const prefixBranches = createPrefixBranchController(
      initialSnapshot === null && (opts.searchSeed === undefined || opts.searchSeed === seed),
      searchSeed,
    );

    const evaluateCached = (node: HandoffNode): NodeEvaluation => {
      const cached = evaluationCache.get(node.search);
      if (cached !== undefined) return cached;
      const evaluation = evaluateNode(node, spec, gaps, allContactFrames, durationFrames);
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
      recordPrefixBranchEvaluation(
        node,
        gaps,
        prefixBranches,
        telemetry,
        evaluation.fullDuration,
        improved,
      );
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
          handoff_suffix_repair_attempts: telemetry.suffixRepairAttempts,
          handoff_suffix_repair_successes: telemetry.suffixRepairSuccesses,
          handoff_suffix_repair_improvements: telemetry.suffixRepairImprovements,
          handoff_suffix_repair_nodes: telemetry.suffixRepairNodes,
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
          handoff_search_lane: best.stats.handoff_search_lane ?? 0,
          handoff_prefix_branch_forks: telemetry.prefixBranchForks,
          handoff_prefix_branch_evaluations: telemetry.prefixBranchEvaluations,
          handoff_prefix_branch_full_evaluations: telemetry.prefixBranchFullEvaluations,
          handoff_prefix_branch_improvements: telemetry.prefixBranchImprovements,
          handoff_prefix_branch_prunes: telemetry.prefixBranchPrunes,
          handoff_prefix_branch_duplicate_key_skips: telemetry.prefixBranchDuplicateKeySkips,
          handoff_prefix_branch_forks_by_remaining_contacts:
            snapshotContactCountCounter(telemetry.prefixBranchForksByRemainingContacts),
          handoff_prefix_branch_evaluations_by_remaining_contacts:
            snapshotContactCountCounter(telemetry.prefixBranchEvaluationsByRemainingContacts),
          handoff_prefix_branch_full_evaluations_by_remaining_contacts:
            snapshotContactCountCounter(telemetry.prefixBranchFullEvaluationsByRemainingContacts),
          handoff_prefix_branch_improvements_by_remaining_contacts:
            snapshotContactCountCounter(telemetry.prefixBranchImprovementsByRemainingContacts),
          handoff_prefix_branch_prunes_by_remaining_contacts:
            snapshotContactCountCounter(telemetry.prefixBranchPrunesByRemainingContacts),
          handoff_prefix_branch_duplicate_key_skips_by_remaining_contacts:
            snapshotContactCountCounter(telemetry.prefixBranchDuplicateKeySkipsByRemainingContacts),
          ...(arcStats ? { arc_placement: arcStats } : {}),
        },
      };
    };

    const captureReachedBudgets = (): void => {
      while (nextBudgetIndex < budgets.length && getSimFrames() >= budgets[nextBudgetIndex]) {
        checkpoints.push(snapshot(budgets[nextBudgetIndex], true));
        nextBudgetIndex++;
      }
    };

    while (frontierSize(passStack, fallbackStack) > 0 && telemetry.nodesExpanded < maxNodes) {
      const bestKey = register.getBestKey();
      const node = popNextFrontierNode(
        passStack,
        fallbackStack,
        telemetry,
        farBackFrontierPulseInterval(bestKey),
      );
      telemetry.frontierSelections++;
      if (maybePruneStalledPrefixBranch(node, prefixBranches, telemetry)) {
        captureReachedBudgets();
        if (nextBudgetIndex >= budgets.length) break;
        continue;
      }

      consider(node, "main");

      if (maybePruneStalledPrefixBranch(node, prefixBranches, telemetry)) {
        captureReachedBudgets();
        if (nextBudgetIndex >= budgets.length) break;
        continue;
      }

      const tailNode = completeNearTail(
        node,
        gaps,
        ctx,
        telemetry,
        register.getBestKey()?.contract_passed === true,
        sparseContractSearch,
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

      const repairedNode = completeWeakPrefixWithBoundedSuffix(
        node,
        gaps,
        ctx,
        telemetry,
        register.getBestKey(),
        sparseContractSearch,
      );
      if (repairedNode !== null) {
        const result = consider(repairedNode, "suffix");
        if (result?.event.improved) telemetry.suffixRepairImprovements++;
      }

      if (maybePruneStalledPrefixBranch(node, prefixBranches, telemetry)) {
        captureReachedBudgets();
        if (nextBudgetIndex >= budgets.length) break;
        continue;
      }

      captureReachedBudgets();
      if (nextBudgetIndex >= budgets.length) break;

      if (node.deferExpansion) {
        enqueueDeferred({ ...node, deferExpansion: false }, passStack, fallbackStack);
        telemetry.frontierMaxSize = Math.max(
          telemetry.frontierMaxSize,
          frontierSize(passStack, fallbackStack),
        );
        continue;
      }

      if (
        polishEnabled &&
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
            startRank: node.startRank,
            searchSeed: node.searchSeed,
            searchLane: node.searchLane,
            prefixBranchKey: node.prefixBranchKey,
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
          recordPrefixBranchEvaluation(
            polishNode,
            gaps,
            prefixBranches,
            telemetry,
            evaluation.fullDuration,
            improved,
          );
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
          if (improved) polishAdopted++;
        }
      }

      if (isTerminalNode(node.search, gaps)) continue;

      const branchNode = maybeForkPrefixBranch(
        node,
        gaps,
        prefixBranches,
        telemetry,
        register.getBestKey(),
      );
      const children = expandNode(
        node,
        gaps,
        ctx,
        startOptions,
        telemetry,
        register.getBestKey()?.contract_passed === true,
        sparseContractSearch,
      );
      telemetry.nodesExpanded++;
      for (let i = children.length - 1; i >= 0; i--) {
        enqueueChild(children[i], passStack, fallbackStack);
      }
      if (branchNode !== null) enqueueChild(branchNode, passStack, fallbackStack);
      telemetry.frontierMaxSize = Math.max(
        telemetry.frontierMaxSize,
        frontierSize(passStack, fallbackStack),
      );
    }

    while (nextBudgetIndex < budgets.length) {
      const budget = budgets[nextBudgetIndex];
      checkpoints.push(snapshot(budget, getSimFrames() >= budget));
      nextBudgetIndex++;
    }

    return { checkpoints };
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
  return cloneHandoffNodeForBranch(snapshot.node, {
    searchSeed,
    searchLane: 0,
    prefixBranchKey: null,
  });
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
  overrides: Partial<Pick<HandoffNode, "searchSeed" | "searchLane">> & {
    prefixBranchKey?: string | null;
  } = {},
): HandoffNode {
  const startState = cloneResolvedStart(node.startState);
  const prefixFits = node.search.prefixFits.map((fit) =>
    fit === null ? null : cloneGapFit(fit)
  );
  let prefixEngine = makeBaseEngine(startState);
  for (const fit of prefixFits) {
    if (fit === null) continue;
    for (const line of fit.lines) {
      prefixEngine = prefixEngine.addLine(engineLineFromTrackLine(line));
    }
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
    startRank: node.startRank,
    searchSeed: overrides.searchSeed ?? node.searchSeed,
    searchLane: overrides.searchLane ?? node.searchLane,
    prefixBranchKey: overrides.prefixBranchKey === null
      ? undefined
      : overrides.prefixBranchKey ?? node.prefixBranchKey,
    startExpanded: node.startExpanded,
    deferExpansion: node.deferExpansion,
    rankTrace: cloneRankTrace(node.rankTrace),
    skippedContacts: node.skippedContacts,
  };
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

function normalizeBudgets(raw: number[] | undefined): number[] {
  if (raw === undefined || raw.length === 0) {
    throw new Error("compileHandoff: budgets must contain at least one positive number");
  }
  const budgets = raw.slice();
  const seen = new Set<number>();
  for (let i = 0; i < budgets.length; i++) {
    const budget = budgets[i];
    if (!Number.isSafeInteger(budget) || budget <= 0) {
      throw new Error(`compileHandoff: budgets must be positive safe integers, got ${raw[i]}`);
    }
    if (seen.has(budget)) {
      throw new Error(`compileHandoff: duplicate budget ${budget}`);
    }
    seen.add(budget);
  }
  return budgets.sort((a, b) => a - b);
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
  if (key.axis_quality < QUALITY_FAR_BACK_MAX_AXIS_QUALITY) {
    return QUALITY_FAR_BACK_FRONTIER_INTERVAL;
  }
  if (key.axis_quality < MODERATE_QUALITY_FAR_BACK_MAX_AXIS_QUALITY) {
    return MODERATE_QUALITY_FAR_BACK_FRONTIER_INTERVAL;
  }
  return null;
}

function createPrefixBranchController(
  enabled: boolean,
  baseSearchSeed: number,
): PrefixBranchController {
  return {
    enabled,
    baseSearchSeed,
    forkedKeys: new Set<string>(),
    work: new Map<string, PrefixBranchWork>(),
  };
}

function maybeForkPrefixBranch(
  node: HandoffNode,
  gaps: Gap[],
  prefixBranches: PrefixBranchController,
  telemetry: HandoffTelemetry,
  bestKey: LeafKey | null,
): HandoffNode | null {
  if (!prefixBranches.enabled) return null;
  if (bestKey?.contract_passed !== true) return null;
  if (bestKey.axis_quality < PREFIX_BRANCH_MIN_AXIS_QUALITY) return null;
  if (bestKey.axis_quality >= PREFIX_BRANCH_MAX_AXIS_QUALITY) return null;
  if (node.searchLane !== 0) return null;
  if (node.skippedContacts !== 0) return null;
  if (!node.startExpanded || node.deferExpansion) return null;
  if (isTerminalNode(node.search, gaps)) return null;
  if (telemetry.frontierSelections % PREFIX_BRANCH_FRONTIER_INTERVAL !== 0) return null;
  if (committedContactCount(node.search) < PREFIX_BRANCH_MIN_PREFIX_CONTACTS) return null;
  const remainingContacts = remainingContactCount(node.search, gaps);
  if (remainingContacts < PREFIX_BRANCH_MIN_REMAINING_CONTACTS) return null;

  const key = `${node.startRank}:${node.search.gapIndex}`;
  if (prefixBranches.forkedKeys.has(key)) {
    telemetry.prefixBranchDuplicateKeySkips++;
    incrementContactCountCounter(
      telemetry.prefixBranchDuplicateKeySkipsByRemainingContacts,
      remainingContacts,
    );
    return null;
  }
  prefixBranches.forkedKeys.add(key);
  prefixBranches.work.set(key, {
    remainingContacts,
    evaluations: 0,
    fullEvaluations: 0,
    improvements: 0,
  });
  telemetry.prefixBranchForks++;
  incrementContactCountCounter(telemetry.prefixBranchForksByRemainingContacts, remainingContacts);
  return cloneHandoffNodeForBranch(node, {
    searchSeed: searchSeedForLane(prefixBranches.baseSearchSeed, PREFIX_BRANCH_LANE),
    searchLane: PREFIX_BRANCH_LANE,
    prefixBranchKey: key,
  });
}

function recordPrefixBranchEvaluation(
  node: HandoffNode,
  gaps: Gap[],
  prefixBranches: PrefixBranchController,
  telemetry: HandoffTelemetry,
  fullDuration: boolean,
  improved: boolean,
): void {
  if (node.searchLane === 0) return;
  telemetry.prefixBranchEvaluations++;
  if (fullDuration) telemetry.prefixBranchFullEvaluations++;
  if (improved) telemetry.prefixBranchImprovements++;

  const key = node.prefixBranchKey;
  if (key === undefined) return;
  let work = prefixBranches.work.get(key);
  if (work === undefined) {
    const remainingContacts = remainingContactCountForBranchKey(key, gaps);
    if (remainingContacts === null) return;
    work = { remainingContacts, evaluations: 0, fullEvaluations: 0, improvements: 0 };
    prefixBranches.work.set(key, work);
  }
  work.evaluations++;
  incrementContactCountCounter(
    telemetry.prefixBranchEvaluationsByRemainingContacts,
    work.remainingContacts,
  );
  if (fullDuration) {
    work.fullEvaluations++;
    incrementContactCountCounter(
      telemetry.prefixBranchFullEvaluationsByRemainingContacts,
      work.remainingContacts,
    );
  }
  if (improved) {
    work.improvements++;
    incrementContactCountCounter(
      telemetry.prefixBranchImprovementsByRemainingContacts,
      work.remainingContacts,
    );
  }
}

function maybePruneStalledPrefixBranch(
  node: HandoffNode,
  prefixBranches: PrefixBranchController,
  telemetry: HandoffTelemetry,
): boolean {
  if (node.searchLane === 0) return false;
  const key = node.prefixBranchKey;
  if (key === undefined) return false;
  const work = prefixBranches.work.get(key);
  const shouldPrune = work !== undefined &&
    work.improvements === 0 &&
    work.fullEvaluations >= PREFIX_BRANCH_STALLED_FULL_EVAL_CAP;
  if (shouldPrune) {
    telemetry.prefixBranchPrunes++;
    incrementContactCountCounter(
      telemetry.prefixBranchPrunesByRemainingContacts,
      work.remainingContacts,
    );
  }
  return shouldPrune;
}

function searchSeedForLane(baseSearchSeed: number, lane: number): number {
  if (lane === 0) return baseSearchSeed;
  return (
    Math.imul(baseSearchSeed | 0, 0x45d9f3b) ^
    Math.imul(lane | 0, 0x119de1f3) ^
    0x6a09e667
  ) | 0;
}

function remainingContactCountForBranchKey(key: string, gaps: Gap[]): number | null {
  const rawGapIndex = key.split(":")[1];
  if (rawGapIndex === undefined) return null;
  const gapIndex = Number(rawGapIndex);
  if (!Number.isSafeInteger(gapIndex) || gapIndex < 0 || gapIndex > gaps.length) return null;
  return remainingContactCountFromGapIndex(gapIndex, gaps);
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
): HandoffNode[] {
  if (isTerminalNode(node.search, gaps)) return [];
  if (!node.startExpanded) {
    return startOptions.map((option) => ({
      search: option.root,
      startState: option.state,
      startRank: option.rank,
      searchSeed: node.searchSeed,
      searchLane: node.searchLane,
      prefixBranchKey: node.prefixBranchKey,
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
      startRank: node.startRank,
      searchSeed: node.searchSeed,
      searchLane: node.searchLane,
      prefixBranchKey: node.prefixBranchKey,
      startExpanded: node.startExpanded,
      deferExpansion: false,
      rankTrace: appendSkipTrace(node.rankTrace),
      skippedContacts: node.skippedContacts,
    }];
  }

  let options = rankedOptions(node.search, gaps, ctx, node.searchSeed, telemetry, {
    nCand: handoffSampleCount(qualitySearch, sparseContractSearch),
    preview: handoffUsesFuturePreview(qualitySearch),
    expandedBrakeSearch: shouldUseExpandedBrakeSearch(qualitySearch),
    axisQualitySearch: qualitySearch,
    previewCostWeight: PREVIEW_COST_WEIGHT,
  });
  if (options.length === 0 && shouldAttemptDeadEndRescue(node.search, gap)) {
    telemetry.rescueAttempts++;
    options = rankedOptions(node.search, gaps, ctx, node.searchSeed, telemetry, {
      nCand: HANDOFF_RESCUE_N_CAND,
      poolSize: HANDOFF_RESCUE_CANDIDATE_POOL,
      preview: handoffUsesFuturePreview(qualitySearch),
      expandedBrakeSearch: shouldUseExpandedBrakeSearch(qualitySearch),
      axisQualitySearch: qualitySearch,
      previewCostWeight: PREVIEW_COST_WEIGHT,
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
      startRank: node.startRank,
      searchSeed: node.searchSeed,
      searchLane: node.searchLane,
      prefixBranchKey: node.prefixBranchKey,
      startExpanded: node.startExpanded,
      deferExpansion: true,
      rankTrace: appendSkipTrace(node.rankTrace),
      skippedContacts: node.skippedContacts + 1,
    }];
  }

  return options.map((option) => ({
    search: option.child,
    startState: node.startState,
    startRank: node.startRank,
    searchSeed: node.searchSeed,
    searchLane: node.searchLane,
    prefixBranchKey: node.prefixBranchKey,
    startExpanded: node.startExpanded,
    deferExpansion: false,
    rankTrace: appendOptionTrace(node.rankTrace, option),
    skippedContacts: node.skippedContacts + (option.candidate === null ? 1 : 0),
  }));
}

function shouldAttemptDeadEndRescue(node: SearchNode, gap: Gap): boolean {
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
  const rider = getRiderMetered(node.prefixEngine, gap.endFrame);
  const ts = readTargetState(node.prefixEngine, gap.endFrame, rider.position.x, rider.position.y);
  const speedRatio = ts.speed / targetSpeedPx;
  return shouldOfferBrakeCandidates(targetSpeedPx, speedRatio);
}

function shouldAttemptShortDeadlineRescue(gap: Gap): boolean {
  return gap.endsWithContact &&
    shortDeadlineRescueCandidateCount(gap.endFrame - gap.startFrame) > 0;
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
  } = {},
): RankedOption[] {
  const sorted = getCandidatesSorted(
    node,
    gaps,
    ctx,
    seed,
    config.nCand ?? HANDOFF_CONTRACT_N_CAND,
  );
  const poolSize = config.poolSize ?? handoffCandidatePool();
  const pool = sorted.slice(0, poolSize);
  const preview = config.preview ?? true;
  const previewCostWeight = config.previewCostWeight ?? PREVIEW_COST_WEIGHT;
  const scored = pool.map((candidate, rank) =>
    scoreCandidateForHandoff(
      node, candidate, rank, "pool", gaps, ctx, seed, telemetry, preview, previewCostWeight,
    )
  );
  // Catch-reuse: translate the most recent committed catches to this gap's entry
  // state and offer them as extra candidates. On a steady periodic rhythm, a
  // recent sled-relative catch can remain valid at a later similar entry state.
  // Deterministic (pure function of the prefix); only ADDS candidates, so
  // monotonicity holds.
  const reuse = cachedReuseCatchCandidates(node, gaps, ctx, telemetry);
  reuse.forEach((candidate, j) =>
    scored.push(scoreCandidateForHandoff(
      node, candidate, poolSize + j, "reuse", gaps, ctx, seed, telemetry, preview, previewCostWeight,
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
    ))
  );
  // Axis-specific quality streams add only the small, explicitly registered
  // streams. Contract search keeps the normal cheap candidate sequence unchanged.
  const axisQuality = cachedAxisQualityCandidates(
    node,
    gaps,
    ctx,
    seed,
    config.axisQualitySearch ?? false,
    telemetry,
  );
  axisQuality.forEach((entry, j) =>
    scored.push(scoreCandidateForHandoff(
      node,
      entry.candidate,
      poolSize + reuse.length + brake.length + j,
      "axisq",
      gaps,
      ctx,
      seed,
      telemetry,
      preview,
      previewCostWeight,
      entry.axis,
    ))
  );
  scored.sort((a, b) =>
    a.score - b.score ||
    (a.candidate?.cost ?? Infinity) - (b.candidate?.cost ?? Infinity) ||
    a.rank - b.rank
  );
  return scored.slice(0, HANDOFF_BRANCHING);
}

function cachedAxisQualityCandidates(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  enabled: boolean,
  telemetry: HandoffTelemetry,
): AxisQualityCandidate[] {
  if (!enabled) return [];
  const cache = extraCandidateCache.get(node) ?? {};
  if (cache.axisQualitySeed !== undefined && cache.axisQualitySeed !== seed) {
    cache.axisQuality = undefined;
  }
  if (cache.axisQuality !== undefined && cache.axisQualitySeed === seed) {
    return cache.axisQuality;
  }

  const generated = axisQualityCandidates(node, gaps, ctx, seed, telemetry);
  cache.axisQualitySeed = seed;
  cache.axisQuality = generated;
  extraCandidateCache.set(node, cache);
  return generated;
}

function axisQualityCandidates(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
): AxisQualityCandidate[] {
  const gap = gaps[node.gapIndex];
  if (!gap.endsWithContact) return [];
  const out: AxisQualityCandidate[] = [];
  for (const axis of AXES) {
    const policy = HANDOFF_AXIS_QUALITY_STREAMS[axis];
    const target = gap.targets?.[axis];
    if (policy === undefined || target === undefined) continue;
    if (policy.targetMax !== undefined && target > policy.targetMax) continue;
    const rng = makeRng(axisQualityStreamSeed(seed, node.gapIndex, policy));
    for (let attempt = 0; attempt < policy.samples; attempt++) {
      telemetry.axisQualityAttempts++;
      telemetry.axisQualityAttemptsByAxis[axis] =
        (telemetry.axisQualityAttemptsByAxis[axis] ?? 0) + 1;
      const candidate = sampleOneCandidate(
        node.prefixEngine,
        gap,
        rng,
        ctx,
        node.prefixNextLineId,
        policy.attemptOffset + attempt,
        policy.mode ?? "normal",
      );
      if (candidate !== null) {
        telemetry.axisQualitySuccesses++;
        telemetry.axisQualitySuccessesByAxis[axis] =
          (telemetry.axisQualitySuccessesByAxis[axis] ?? 0) + 1;
        out.push({ candidate, axis });
      }
    }
  }
  return out;
}

function axisQualityStreamSeed(
  seed: number,
  gapIndex: number,
  policy: AxisQualityStreamPolicy,
): number {
  return (Math.imul(seed | 0, 1000003) + gapIndex + policy.seedSalt) | 0;
}

function cachedReuseCatchCandidates(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  telemetry: HandoffTelemetry,
): Candidate[] {
  const cache = extraCandidateCache.get(node) ?? {};
  if (cache.reuse === undefined) {
    cache.reuse = reuseCatchCandidates(node, gaps, ctx, telemetry);
    extraCandidateCache.set(node, cache);
  }
  return cache.reuse;
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
  const rider = getRiderMetered(node.prefixEngine, gap.endFrame);
  const ts = readTargetState(node.prefixEngine, gap.endFrame, rider.position.x, rider.position.y);
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
  // Brake probes only on mild-overspeed targets. (High-overspeed brakes were
  // previously gated on a contact-event target, an axis category that no longer
  // exists, so that branch is gone.)
  const aboveMinTarget = targetSpeedPxPerFrame >
    HANDOFF_BRAKE_TARGET_MIN_PX_PER_FRAME + HANDOFF_BRAKE_TARGET_EPSILON_PX_PER_FRAME;
  const withinMildTarget = targetSpeedPxPerFrame <=
    HANDOFF_BRAKE_MILD_TARGET_MAX_PX_PER_FRAME + HANDOFF_BRAKE_TARGET_EPSILON_PX_PER_FRAME;
  return aboveMinTarget && withinMildTarget && brakeCandidateCount(speedRatio, expandedBrakeSearch) > 0;
}

/** Translate the most-recent committed catches (which carry a sled `ref`) to
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
): Candidate[] {
  const gap = gaps[node.gapIndex];
  if (!gap.endsWithContact) return [];
  const rider = getRiderMetered(node.prefixEngine, gap.endFrame);
  const ts = readTargetState(node.prefixEngine, gap.endFrame, rider.position.x, rider.position.y);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const out: Candidate[] = [];
  let tried = 0;
  for (let i = node.prefixFits.length - 1; i >= 0 && tried < HANDOFF_REUSE_K; i--) {
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
      )
      : tryCandidate(
        node.prefixEngine, gap,
        { ...f.arc, anchor: { x: f.arc.anchor.x + dx, y: f.arc.anchor.y + dy } },
        node.prefixNextLineId, ctx.allContactFrames, axisMeasureEnd, gap.targets, true,
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
): HandoffNode | null {
  if (!shouldAttemptNearTailCompletion(node, gaps)) return null;
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
  );
  if (completed === null) return null;

  telemetry.tailCompletionSuccesses++;
  incrementContactCountCounter(telemetry.tailCompletionSuccessesByRemainingContacts, remaining);
  return {
    search: completed.search,
    startState: node.startState,
    startRank: node.startRank,
    searchSeed: node.searchSeed,
    searchLane: node.searchLane,
    prefixBranchKey: node.prefixBranchKey,
    startExpanded: node.startExpanded,
    deferExpansion: false,
    rankTrace: completed.rankTrace,
    skippedContacts: node.skippedContacts,
  };
}

function completeWeakPrefixWithBoundedSuffix(
  node: HandoffNode,
  gaps: Gap[],
  ctx: SpecContext,
  telemetry: HandoffTelemetry,
  bestKey: LeafKey | null,
  sparseContractSearch: boolean,
): HandoffNode | null {
  if (!shouldAttemptSuffixRepair(node, gaps, telemetry, bestKey)) return null;
  telemetry.suffixRepairAttempts++;

  const completed = completeBoundedSuffix(
    node.search,
    cloneRankTrace(node.rankTrace),
    gaps,
    ctx,
    node.searchSeed,
    telemetry,
    sparseContractSearch,
  );
  telemetry.suffixRepairNodes += completed.nodes;
  if (completed.result === null) return null;

  telemetry.suffixRepairSuccesses++;
  return {
    search: completed.result.search,
    startState: node.startState,
    startRank: node.startRank,
    searchSeed: node.searchSeed,
    searchLane: node.searchLane,
    prefixBranchKey: node.prefixBranchKey,
    startExpanded: node.startExpanded,
    deferExpansion: false,
    rankTrace: completed.result.rankTrace,
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
): CompletedHandoffSuffix | null {
  const stack: CompletedHandoffSuffix[] = [
    {
      search: start,
      rankTrace: startTrace,
    },
  ];
  while (stack.length > 0) {
    const state = stack.pop()!;
    let search = state.search;
    let rankTrace = cloneRankTrace(state.rankTrace);

    while (!isTerminalNode(search, gaps) && !gaps[search.gapIndex].endsWithContact) {
      search = extendNodeCached(search, null);
      rankTrace = appendSkipTrace(rankTrace);
    }
    if (isTerminalNode(search, gaps)) return { search, rankTrace };

    const gap = gaps[search.gapIndex];
    const options = rankedOptions(search, gaps, ctx, seed, telemetry, {
      nCand: handoffSampleCount(qualitySearch, sparseContractSearch),
      preview: false,
      expandedBrakeSearch: shouldUseExpandedBrakeSearch(qualitySearch),
      axisQualitySearch: qualitySearch,
      previewCostWeight: PREVIEW_COST_WEIGHT,
    })
      .filter((option) => option.candidate !== null)
      .slice(0, TAIL_COMPLETION_FALLBACK_BRANCHING);
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

function completeBoundedSuffix(
  start: SearchNode,
  startTrace: HandoffRankTraceEntry[],
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
  sparseContractSearch: boolean,
): { result: CompletedHandoffSuffix | null; nodes: number } {
  const stack: CompletedHandoffSuffix[] = [
    {
      search: start,
      rankTrace: startTrace,
    },
  ];
  let nodes = 0;

  while (stack.length > 0 && nodes < QUALITY_SUFFIX_REPAIR_MAX_NODES) {
    const state = stack.pop()!;
    let search = state.search;
    let rankTrace = cloneRankTrace(state.rankTrace);

    while (!isTerminalNode(search, gaps) && !gaps[search.gapIndex].endsWithContact) {
      search = extendNodeCached(search, null);
      rankTrace = appendSkipTrace(rankTrace);
    }
    if (isTerminalNode(search, gaps)) {
      return { result: { search, rankTrace }, nodes };
    }

    nodes++;
    const gap = gaps[search.gapIndex];
    const options = rankedOptions(search, gaps, ctx, seed, telemetry, {
      nCand: handoffSampleCount(true, sparseContractSearch),
      preview: false,
      expandedBrakeSearch: shouldUseExpandedBrakeSearch(true),
      axisQualitySearch: true,
      previewCostWeight: PREVIEW_COST_WEIGHT,
    })
      .filter((option) => option.candidate !== null)
      .slice(0, QUALITY_SUFFIX_REPAIR_BRANCHING);
    for (let i = options.length - 1; i >= 0; i--) {
      const option = options[i];
      stack.push({
        search: extendNodeCached(search, option.candidate!),
        rankTrace: appendOptionTrace(rankTrace, option),
      });
    }
  }

  return { result: null, nodes };
}

export function handoffSampleCount(
  qualitySearch: boolean,
  sparseContractSearch = false,
): number {
  if (qualitySearch) return HANDOFF_QUALITY_N_CAND;
  return sparseContractSearch ? HANDOFF_SPARSE_CONTRACT_N_CAND : HANDOFF_CONTRACT_N_CAND;
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
): boolean {
  if (node.skippedContacts > 0 || isTerminalNode(node.search, gaps)) return false;
  if (!node.search.prefixFits.some((fit) => fit !== null)) return false;
  return remainingContactCount(node.search, gaps) <= TAIL_COMPLETION_CONTACT_WINDOW;
}

function shouldAttemptSuffixRepair(
  node: HandoffNode,
  gaps: Gap[],
  telemetry: HandoffTelemetry,
  bestKey: LeafKey | null,
): boolean {
  if (bestKey?.contract_passed !== true) return false;
  if (bestKey.axis_quality >= QUALITY_SUFFIX_REPAIR_MAX_AXIS_QUALITY) return false;
  // Suffix repair is for genuinely scarce terminal feedback. Exact duplicate
  // full-output offers do not add a new terminal basin, so do not let them
  // consume the scarcity cap.
  if (uniqueFullEvaluations(telemetry) >= QUALITY_SUFFIX_REPAIR_MAX_FULL_EVALUATIONS) return false;
  if (telemetry.suffixRepairAttempts >= QUALITY_SUFFIX_REPAIR_MAX_ATTEMPTS) return false;
  if (telemetry.frontierSelections % QUALITY_SUFFIX_REPAIR_INTERVAL !== 0) return false;
  if (node.searchLane !== 0) return false;
  if (!node.startExpanded || node.deferExpansion) return false;
  if (node.skippedContacts !== 0 || isTerminalNode(node.search, gaps)) return false;
  if (!node.search.prefixFits.some((fit) => fit !== null)) return false;
  return remainingContactCount(node.search, gaps) > TAIL_COMPLETION_CONTACT_WINDOW;
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

function committedContactCount(node: SearchNode): number {
  return node.prefixFits.filter((fit) => fit !== null).length;
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
  sourceAxis?: AxisName,
): RankedOption {
  const child = extendNodeCached(node, candidate);
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
  return {
    candidate,
    child,
    rank,
    source,
    sourceAxis,
    previewContacts: preview.landed,
    previewSurvivors: preview.survivors,
    score: candidate.cost + scarcity + previewCost + statePenalty + overshoot,
  };
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
): StartOption[] {
  const defaultStart = resolveStartState(searchSpec);
  const defaultSpecStart: NonNullable<Spec["start"]> = {
    x: defaultStart.position.x,
    y: defaultStart.position.y,
    vx: defaultStart.velocity.x,
    vy: defaultStart.velocity.y,
  };

  if (rawSpec.start !== undefined || (rawSpec.preroll ?? 0) <= 0) {
    return [{
      rank: 0,
      start: defaultSpecStart,
      state: defaultStart,
      root: makeRootNode(makeBaseEngine(defaultStart), gaps.length),
    }];
  }

  const axes = firstAxes(rawSpec);
  const starts = startCandidates(axes);
  const seen = new Set<string>();
  const [first, ...rest] = [defaultSpecStart, ...starts]
    .filter((start) => {
      const key = startKey(start);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const heuristicPool = [
    first,
    ...rest
      .sort((a, b) =>
        startHeuristicCost(a, axes) - startHeuristicCost(b, axes) ||
        startKey(a).localeCompare(startKey(b))
      )
      .slice(0, Math.max(0, START_SCORING_POOL - 1)),
  ];

  if (!hasStartFeasibilityLookahead(gaps)) {
    return heuristicPool.slice(0, START_OPTION_LIMIT).map((start, rank) => {
      const state = resolveStartState({ ...searchSpec, start });
      return {
        rank,
        start,
        state,
        root: makeRootNode(makeBaseEngine(state), gaps.length),
      };
    });
  }

  const ordered = heuristicPool
    .map((start, originalRank) => {
      const state = resolveStartState({ ...searchSpec, start });
      const root = makeRootNode(makeBaseEngine(state), gaps.length);
      return {
        start,
        state,
        root,
        originalRank,
        score: startFeasibilityCost(root, start, axes, gaps, ctx, seed),
      };
    })
    .sort((a, b) =>
      a.score - b.score ||
      startHeuristicCost(a.start, axes) - startHeuristicCost(b.start, axes) ||
      a.originalRank - b.originalRank ||
      startKey(a.start).localeCompare(startKey(b.start))
    )
    .slice(0, START_OPTION_LIMIT);

  return ordered.map(({ start, state, root }, rank) => ({
    rank,
    start,
    state,
    root,
  }));
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

function startKey(start: NonNullable<Spec["start"]>): string {
  return `${(start.x ?? 0).toFixed(3)},${(start.y ?? 0).toFixed(3)},` +
    `${start.vx.toFixed(3)},${start.vy.toFixed(3)}`;
}

function evaluateNode(
  node: HandoffNode,
  spec: Spec,
  gaps: Gap[],
  allContactFrames: number[],
  durationFrames: number,
): { report: DriftReport; key: LeafKey; outputDurationFrames: number; fullDuration: boolean } {
  const fullDuration = isTerminalNode(node.search, gaps);
  const partialHorizonFrame = fullDuration
    ? durationFrames
    : processedHorizonFrame(node.search, gaps);
  const outputDurationFrames = fullDuration
    ? durationFrames + 20
    : partialOutputDurationFrames(partialHorizonFrame, durationFrames);
  const det = detect(extractRawTrajectory(node.search.prefixEngine, outputDurationFrames));
  const rawReport = buildDriftReport(
    det, spec, gaps, allContactFrames, durationFrames, [], paddedFits(node, gaps.length),
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
  const allLines = [];
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
      handoff_start_speed: round3(startSpeed),
      handoff_start_angle_deg: round3(startAngleDeg),
      handoff_search_seed: node.searchSeed,
      handoff_search_lane: node.searchLane,
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
