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
  makeBaseEngine,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
} from "../core/substrate.ts";
import { CALIB, FPS, START_DEFAULTS, secToFrame, type Gap, type AxisValues } from "../types.ts";
import {
  axisLookaheadEndFrame,
  readTargetState,
  tryCandidate,
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
import { resetArcPlacementStats, snapshotArcPlacementStats } from "../arc_placement.ts";
import { sampleOneCandidate } from "./sample.ts";
import type { Candidate, SpecContext } from "./sample.ts";
import type { CompileCheckpoint, CompileOutput, CompileResult, DriftReport, Spec } from "./types.ts";

export type CompileHandoffOptions = {
  /** Ascending simulated-frame checkpoints to return from one deterministic run. */
  budgets?: number[];
  /** Fixed search-size cap, independent of budget. Keeps unbudgeted probes finite. */
  maxNodes?: number;
  /** Clone-and-test polish variants for each prefix considered. Default true. */
  polish?: boolean;
  /** Test hook: called for each prefix output offered to the register. */
  onNode?: (node: HandoffNode, key: LeafKey) => void;
};

type HandoffNode = {
  search: SearchNode;
  startState: ResolvedStart;
  startRank: number;
  startExpanded: boolean;
  deferExpansion: boolean;
  /** Sorted candidate rank per gap; -1 means a skipped contact/non-contact gap. */
  ranks: number[];
  skippedContacts: number;
};

type RankedOption = {
  candidate: Candidate | null;
  child: SearchNode;
  rank: number;
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
  nodesExpanded: number;
  frontierMaxSize: number;
  partialEvaluations: number;
  fullEvaluations: number;
  tailCompletionAttempts: number;
  tailCompletionSuccesses: number;
  previews: number;
  previewContacts: number;
  previewSurvivors: number;
  rescueAttempts: number;
  rescueSuccesses: number;
  skips: number;
  deferredSkips: number;
};

type NodeEvaluation = {
  report: DriftReport;
  key: LeafKey;
  outputDurationFrames: number;
  fullDuration: boolean;
};

type ExtraCandidateCache = {
  reuse?: Candidate[];
  brakeSeed?: number;
  brakeContract?: Candidate[];
  brakeQuality?: Candidate[];
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
const DEAD_END_PENALTY = 40;
const SURVIVOR_SCARCITY_PENALTY = 4;
/** The one-contact preview already pays for a future candidate. Reuse its local
 *  cost as a small quality signal for smooth axes, but not when the current gap
 *  targets contact_style: that axis is a discrete contact-duration effect, and
 *  preview cost over-steers the fragile current catch. */
const PREVIEW_COST_WEIGHT = 0.25;
const HANDOFF_STATE_WEIGHT = 0.08;
/** Weight on a candidate's speed OVERSHOOT (achieved - target, when positive) in
 *  the handoff feasibility ranking. Selection-only bias against speed creep. */
const HANDOFF_SPEED_OVERSHOOT_WEIGHT = 16;
/** Weight on a candidate's AIR overshoot (achieved - target, when positive). */
const HANDOFF_AIR_OVERSHOOT_WEIGHT = 16;
/** Brake catches (uphill-entry, bleed speed) are offered as EXTRA candidates on
 *  MODERATE-target gaps where the rider runs even mildly over target (early, to
 *  pre-empt creep). High-target gaps only get brake probes when contact style
 *  also matters and overspeed is severe. Decoupled from landing, so on
 *  non-creeping specs they simply lose the ranking. Excluded from reuse. */
const HANDOFF_BRAKE_TARGET_MAX = 1.0;
const HANDOFF_BRAKE_MILD_TARGET_MAX = 0.78;
const HANDOFF_BRAKE_RATIO_MIN = 1.0;
const HANDOFF_BRAKE_HIGH_OVERSPEED_RATIO = 1.15;
const HANDOFF_BRAKE_CONTRACT_BASE_K = 2;
const HANDOFF_BRAKE_CONTRACT_HIGH_OVERSPEED_K = 3;
const HANDOFF_BRAKE_QUALITY_BASE_K = 3;
const HANDOFF_BRAKE_QUALITY_HIGH_OVERSPEED_K = 4;
const HANDOFF_EXPANDED_BRAKE_MEDIAN_FRAMES = HANDOFF_RESCUE_MIN_GAP_FRAMES;
const PARTIAL_FUTURE_CONTACT_WINDOW = 20;
const TAIL_COMPLETION_CONTACT_WINDOW = 6;
const TAIL_COMPLETION_FALLBACK_BRANCHING = 2;

export function compileHandoff(
  userSpec: Spec,
  seed = 0,
  opts: CompileHandoffOptions = {},
): CompileResult {
  if (!Number.isSafeInteger(seed)) {
    throw new Error(`compileHandoff: seed must be a safe integer, got ${seed}`);
  }
  const budgets = normalizeBudgets(opts.budgets);
  const maxNodes = opts.maxNodes ?? DEFAULT_MAX_NODES;
  if (!Number.isInteger(maxNodes) || maxNodes < 1) {
    throw new Error(`compileHandoff: maxNodes must be a positive integer, got ${maxNodes}`);
  }

  resetSimFrames();
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
    const expandedBrakeSearch = usesExpandedBrakeSearch(gaps);
    const startOptions = buildStartOptions(userSpec, spec, gaps, ctx, seed);
    const defaultStart = startOptions[0];
    const root: HandoffNode = {
      search: defaultStart.root,
      startState: defaultStart.state,
      startRank: defaultStart.rank,
      startExpanded: startOptions.length <= 1,
      deferExpansion: false,
      ranks: [],
      skippedContacts: 0,
    };
    const passStack: HandoffNode[] = [root];
    const fallbackStack: HandoffNode[] = [];
    const register = new BestSoFarRegister();
    const telemetry: HandoffTelemetry = {
      nodesExpanded: 0,
      frontierMaxSize: frontierSize(passStack, fallbackStack),
      partialEvaluations: 0,
      fullEvaluations: 0,
      tailCompletionAttempts: 0,
      tailCompletionSuccesses: 0,
      previews: 0,
      previewContacts: 0,
      previewSurvivors: 0,
      rescueAttempts: 0,
      rescueSuccesses: 0,
      skips: 0,
      deferredSkips: 0,
    };
    const polishEnabled = opts.polish ?? true;
    let polishTried = 0;
    let polishAdopted = 0;
    const evaluationCache = new WeakMap<SearchNode, NodeEvaluation>();
    const checkpoints: CompileCheckpoint[] = [];
    let nextBudgetIndex = 0;

    const evaluateCached = (node: HandoffNode): NodeEvaluation => {
      const cached = evaluationCache.get(node.search);
      if (cached !== undefined) return cached;
      const evaluation = evaluateNode(node, spec, gaps, allContactFrames, durationFrames);
      evaluationCache.set(node.search, evaluation);
      return evaluation;
    };

    const consider = (node: HandoffNode): LeafKey | null => {
      if (canSkipPartialEvaluation(node, gaps, register)) return null;
      const evaluation = evaluateCached(node);
      if (evaluation.fullDuration) telemetry.fullEvaluations++;
      else telemetry.partialEvaluations++;
      register.consider(
        buildNodeOutput(
          node,
          evaluation.report,
          gaps,
          evaluation.outputDurationFrames,
          false,
        ),
        evaluation.key,
      );
      return evaluation.key;
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
          budget_exhausted: budgetExhausted,
          sim_frames: getSimFrames(),
          leaves_considered: register.consideredCount,
          improvements: register.improvementCount,
          polish_variants_tried: polishTried,
          polish_variants_adopted: polishAdopted,
          search_nodes_expanded: telemetry.nodesExpanded,
          frontier_max_size: telemetry.frontierMaxSize,
          handoff_partial_evaluations: telemetry.partialEvaluations,
          handoff_full_evaluations: telemetry.fullEvaluations,
          handoff_tail_completion_attempts: telemetry.tailCompletionAttempts,
          handoff_tail_completion_successes: telemetry.tailCompletionSuccesses,
          handoff_start_options: startOptions.length,
          handoff_start_rank: best.stats.handoff_start_rank ?? 0,
          handoff_previews: telemetry.previews,
          handoff_preview_contacts: telemetry.previewContacts,
          handoff_preview_survivors: telemetry.previewSurvivors,
          handoff_rescue_attempts: telemetry.rescueAttempts,
          handoff_rescue_successes: telemetry.rescueSuccesses,
          handoff_skips: best.stats.handoff_skips ?? 0,
          handoff_skip_branches: telemetry.skips,
          handoff_deferred_skips: telemetry.deferredSkips,
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
      const frontier = activeFrontier(passStack, fallbackStack);
      const node = frontier.pop()!;
      const key = consider(node);
      if (key !== null) opts.onNode?.(node, key);

      const tailNode = completeNearTail(
        node,
        gaps,
        ctx,
        seed,
        telemetry,
        register.getBestKey()?.contract_passed === true,
        sparseContractSearch,
        expandedBrakeSearch,
      );
      if (tailNode !== null) {
        const tailKey = consider(tailNode);
        if (tailKey !== null) opts.onNode?.(tailNode, tailKey);
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
        const variant = polishLeafVariant(
          padded, spec, gaps, allContactFrames, durationFrames, node.startState,
        );
        if (variant !== null) {
          polishTried++;
          const improvedBefore = register.improvementCount;
          const polishNode: HandoffNode = {
            search: {
              ...node.search,
              prefixFits: variant.fits,
              prefixEngine: variant.engine,
            },
            startState: node.startState,
            startRank: node.startRank,
            startExpanded: node.startExpanded,
            deferExpansion: node.deferExpansion,
            ranks: node.ranks,
            skippedContacts: node.skippedContacts,
          };
          const evaluation = evaluateCached(polishNode);
          if (evaluation.fullDuration) telemetry.fullEvaluations++;
          else telemetry.partialEvaluations++;
          register.consider(
            buildNodeOutput(
              polishNode,
              evaluation.report,
              gaps,
              evaluation.outputDurationFrames,
              false,
            ),
            evaluation.key,
          );
          if (register.improvementCount > improvedBefore) polishAdopted++;
        }
      }

      if (isTerminalNode(node.search, gaps)) continue;

      const children = expandNode(
        node,
        gaps,
        ctx,
        seed,
        startOptions,
        telemetry,
        register.getBestKey()?.contract_passed === true,
        sparseContractSearch,
        expandedBrakeSearch,
      );
      telemetry.nodesExpanded++;
      for (let i = children.length - 1; i >= 0; i--) {
        enqueueChild(children[i], passStack, fallbackStack);
      }
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
  seed: number,
  startOptions: StartOption[],
  telemetry: HandoffTelemetry,
  qualitySearch: boolean,
  sparseContractSearch: boolean,
  expandedBrakeSearch: boolean,
): HandoffNode[] {
  if (isTerminalNode(node.search, gaps)) return [];
  if (!node.startExpanded) {
    return startOptions.map((option) => ({
      search: option.root,
      startState: option.state,
      startRank: option.rank,
      startExpanded: true,
      deferExpansion: startOptions.length > 1,
      ranks: [],
      skippedContacts: 0,
    }));
  }
  const gap = gaps[node.search.gapIndex];
  if (!gap.endsWithContact) {
    return [{
      search: extendNodeCached(node.search, null),
      startState: node.startState,
      startRank: node.startRank,
      startExpanded: node.startExpanded,
      deferExpansion: false,
      ranks: [...node.ranks, -1],
      skippedContacts: node.skippedContacts,
    }];
  }

  let options = rankedOptions(node.search, gaps, ctx, seed, telemetry, {
    nCand: handoffSampleCount(qualitySearch, sparseContractSearch),
    expandedBrakeSearch: shouldUseExpandedBrakeSearch(qualitySearch, expandedBrakeSearch, gap),
    previewCostWeight: handoffPreviewCostWeight(gap),
  });
  if (options.length === 0 && shouldAttemptDeadEndRescue(node.search, gap)) {
    telemetry.rescueAttempts++;
    options = rankedOptions(node.search, gaps, ctx, seed, telemetry, {
      nCand: HANDOFF_RESCUE_N_CAND,
      poolSize: HANDOFF_RESCUE_CANDIDATE_POOL,
      expandedBrakeSearch: shouldUseExpandedBrakeSearch(qualitySearch, expandedBrakeSearch, gap),
      previewCostWeight: handoffPreviewCostWeight(gap),
    });
    if (options.length > 0) telemetry.rescueSuccesses++;
  }
  if (
    options.length === 0 &&
    node.skippedContacts === 0 &&
    shouldAttemptShortDeadlineRescue(gap)
  ) {
    telemetry.rescueAttempts++;
    options = rankedOptions(node.search, gaps, ctx, seed, telemetry, {
      nCand: HANDOFF_SHORT_RESCUE_N_CAND,
      poolSize: HANDOFF_SHORT_RESCUE_CANDIDATE_POOL,
      expandedBrakeSearch: shouldUseExpandedBrakeSearch(qualitySearch, expandedBrakeSearch, gap),
      previewCostWeight: handoffPreviewCostWeight(gap),
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
      startExpanded: node.startExpanded,
      deferExpansion: true,
      ranks: [...node.ranks, -1],
      skippedContacts: node.skippedContacts + 1,
    }];
  }

  return options.map((option) => ({
    search: option.child,
    startState: node.startState,
    startRank: node.startRank,
    startExpanded: node.startExpanded,
    deferExpansion: false,
    ranks: [...node.ranks, option.rank],
    skippedContacts: node.skippedContacts + (option.candidate === null ? 1 : 0),
  }));
}

function shouldAttemptDeadEndRescue(node: SearchNode, gap: Gap): boolean {
  if (!gap.endsWithContact) return false;
  if (gap.endFrame - gap.startFrame < HANDOFF_RESCUE_MIN_GAP_FRAMES) return false;
  const targetSpeed = gap.targets?.speed;
  if (targetSpeed === undefined || targetSpeed <= 0 || targetSpeed > HANDOFF_BRAKE_TARGET_MAX) {
    return false;
  }
  const rider = getRiderMetered(node.prefixEngine, gap.endFrame);
  const ts = readTargetState(node.prefixEngine, gap.endFrame, rider.position.x, rider.position.y);
  const speedRatio = ts.speed / (targetSpeed * CALIB.SPEED_CAP);
  return shouldOfferBrakeCandidates(
    targetSpeed,
    speedRatio,
    gap.targets?.contact_style !== undefined,
  );
}

function shouldAttemptShortDeadlineRescue(gap: Gap): boolean {
  return gap.endsWithContact &&
    shortDeadlineRescueCandidateCount(gap.endFrame - gap.startFrame) > 0;
}

export function shouldUseExpandedBrakeSearch(
  qualitySearch: boolean,
  expandedBrakeSearch: boolean,
  gap: Gap,
): boolean {
  return qualitySearch || (expandedBrakeSearch && gap.targets?.contact_style !== undefined);
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
      node, candidate, rank, gaps, ctx, seed, telemetry, preview, previewCostWeight,
    )
  );
  // Catch-reuse: translate the most recent committed catches to this gap's entry
  // state and offer them as extra candidates. On a steady periodic rhythm, a
  // recent sled-relative catch can remain valid at a later similar entry state.
  // Deterministic (pure function of the prefix); only ADDS candidates, so
  // monotonicity holds.
  const reuse = cachedReuseCatchCandidates(node, gaps, ctx);
  reuse.forEach((candidate, j) =>
    scored.push(scoreCandidateForHandoff(
      node, candidate, poolSize + j, gaps, ctx, seed, telemetry, preview, previewCostWeight,
    ))
  );
  // Brake catches: uphill-entry arcs that bleed speed before contact, offered as
  // EXTRA candidates when the rider runs over a MODERATE target speed. Decoupled
  // from landing (impact-anchor still lands the contact), so they only win when
  // the overshoot penalty rewards their lower speed and simply lose elsewhere.
  // Excluded from reuse.
  const brake = cachedBrakeCatchCandidates(node, gaps, ctx, seed, config.expandedBrakeSearch ?? false);
  brake.forEach((candidate, j) =>
    scored.push(scoreCandidateForHandoff(
      node,
      candidate,
      poolSize + reuse.length + j,
      gaps,
      ctx,
      seed,
      telemetry,
      preview,
      previewCostWeight,
    ))
  );
  scored.sort((a, b) =>
    a.score - b.score ||
    (a.candidate?.cost ?? Infinity) - (b.candidate?.cost ?? Infinity) ||
    a.rank - b.rank
  );
  return scored.slice(0, HANDOFF_BRANCHING);
}

function cachedReuseCatchCandidates(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
): Candidate[] {
  const cache = extraCandidateCache.get(node) ?? {};
  if (cache.reuse === undefined) {
    cache.reuse = reuseCatchCandidates(node, gaps, ctx);
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
): Candidate[] {
  const cache = extraCandidateCache.get(node) ?? {};
  if (cache.brakeSeed !== undefined && cache.brakeSeed !== seed) {
    cache.brakeContract = undefined;
    cache.brakeQuality = undefined;
  }
  const cached = expandedBrakeSearch ? cache.brakeQuality : cache.brakeContract;
  if (cached !== undefined && cache.brakeSeed === seed) return cached;

  const generated = brakeCatchCandidates(node, gaps, ctx, seed, expandedBrakeSearch);
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
): Candidate[] {
  const gap = gaps[node.gapIndex];
  if (!gap.endsWithContact) return [];
  const tgt = gap.targets?.speed;
  if (tgt === undefined || tgt <= 0 || tgt > HANDOFF_BRAKE_TARGET_MAX) return [];
  const rider = getRiderMetered(node.prefixEngine, gap.endFrame);
  const ts = readTargetState(node.prefixEngine, gap.endFrame, rider.position.x, rider.position.y);
  const speedRatio = ts.speed / (tgt * CALIB.SPEED_CAP);
  if (!shouldOfferBrakeCandidates(
    tgt,
    speedRatio,
    gap.targets?.contact_style !== undefined,
    expandedBrakeSearch,
  )) {
    return [];
  }
  const brakeK = brakeCandidateCount(speedRatio, expandedBrakeSearch);
  if (brakeK <= 0) return [];
  const rng = makeRng((Math.imul(seed | 0, 1000003) + node.gapIndex + 7919) | 0);
  const out: Candidate[] = [];
  for (let attempt = 0; attempt < brakeK; attempt++) {
    const cand = sampleOneCandidate(
      node.prefixEngine, gap, rng, ctx, node.prefixNextLineId, attempt, /*brake*/ true,
    );
    if (cand !== null) {
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
  targetSpeed: number,
  speedRatio: number,
  hasContactStyleTarget: boolean,
  expandedBrakeSearch = false,
): boolean {
  if (targetSpeed <= HANDOFF_BRAKE_MILD_TARGET_MAX) {
    return brakeCandidateCount(speedRatio, expandedBrakeSearch) > 0;
  }
  const highOverspeedK = brakeCandidateCount(
    HANDOFF_BRAKE_HIGH_OVERSPEED_RATIO,
    expandedBrakeSearch,
  );
  return hasContactStyleTarget &&
    brakeCandidateCount(speedRatio, expandedBrakeSearch) === highOverspeedK;
}

/** Translate the most-recent committed catches (which carry a sled `ref`) to
 *  THIS gap's entry state and return the ones that still land+survive. The arc
 *  geometry is sled-relative, so translating a prior catch's arc by the sled
 *  delta reproduces the same catch shape at the new entry — on a periodic rhythm
 *  (steady-state ride) the same catch lands contact after contact. Each reuse is
 *  validated by one `tryCandidate` (one sim). Deterministic: a pure function of
 *  the node's committed prefix + engine state. */
function reuseCatchCandidates(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
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
    const arc = { ...f.arc, anchor: { x: f.arc.anchor.x + dx, y: f.arc.anchor.y + dy } };
    const cand = tryCandidate(
      node.prefixEngine, gap, arc, node.prefixNextLineId, ctx.allContactFrames,
      axisMeasureEnd, gap.targets, true,
    );
    if (cand !== null) {
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
  seed: number,
  telemetry: HandoffTelemetry,
  qualitySearch: boolean,
  sparseContractSearch: boolean,
  expandedBrakeSearch: boolean,
): HandoffNode | null {
  if (!shouldAttemptNearTailCompletion(node, gaps)) return null;
  telemetry.tailCompletionAttempts++;

  const completed = completeNearTailSuffix(
    node.search,
    [...node.ranks],
    gaps,
    ctx,
    seed,
    telemetry,
    qualitySearch,
    sparseContractSearch,
    expandedBrakeSearch,
  );
  if (completed === null) return null;

  telemetry.tailCompletionSuccesses++;
  return {
    search: completed.search,
    startState: node.startState,
    startRank: node.startRank,
    startExpanded: node.startExpanded,
    deferExpansion: false,
    ranks: completed.ranks,
    skippedContacts: node.skippedContacts,
  };
}

function completeNearTailSuffix(
  start: SearchNode,
  startRanks: number[],
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
  qualitySearch: boolean,
  sparseContractSearch: boolean,
  expandedBrakeSearch: boolean,
): { search: SearchNode; ranks: number[] } | null {
  const stack: { search: SearchNode; ranks: number[] }[] = [{ search: start, ranks: startRanks }];
  while (stack.length > 0) {
    const state = stack.pop()!;
    let search = state.search;
    const ranks = [...state.ranks];

    while (!isTerminalNode(search, gaps) && !gaps[search.gapIndex].endsWithContact) {
      search = extendNodeCached(search, null);
      ranks.push(-1);
    }
    if (isTerminalNode(search, gaps)) return { search, ranks };

    const gap = gaps[search.gapIndex];
    const options = rankedOptions(search, gaps, ctx, seed, telemetry, {
      nCand: handoffSampleCount(qualitySearch, sparseContractSearch),
      preview: false,
      expandedBrakeSearch: shouldUseExpandedBrakeSearch(qualitySearch, expandedBrakeSearch, gap),
      previewCostWeight: handoffPreviewCostWeight(gap),
    })
      .filter((option) => option.candidate !== null)
      .slice(0, TAIL_COMPLETION_FALLBACK_BRANCHING);
    for (let i = options.length - 1; i >= 0; i--) {
      const option = options[i];
      stack.push({
        search: extendNodeCached(search, option.candidate!),
        ranks: [...ranks, option.rank],
      });
    }
  }
  return null;
}

export function handoffSampleCount(
  qualitySearch: boolean,
  sparseContractSearch = false,
): number {
  if (qualitySearch) return HANDOFF_QUALITY_N_CAND;
  return sparseContractSearch ? HANDOFF_SPARSE_CONTRACT_N_CAND : HANDOFF_CONTRACT_N_CAND;
}

export function handoffPreviewCostWeight(gap: Gap): number {
  return gap.targets?.contact_style === undefined
    ? PREVIEW_COST_WEIGHT
    : 0;
}

export function usesSparseContractSearch(gaps: readonly Gap[]): boolean {
  const median = medianContactGapFrames(gaps);
  return median !== null && median >= HANDOFF_SPARSE_CONTACT_MEDIAN_FRAMES;
}

export function usesExpandedBrakeSearch(gaps: readonly Gap[]): boolean {
  const median = medianContactGapFrames(gaps);
  return median !== null && median >= HANDOFF_EXPANDED_BRAKE_MEDIAN_FRAMES;
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

function remainingContactCount(node: SearchNode, gaps: Gap[]): number {
  let contacts = 0;
  for (let i = Math.min(node.gapIndex, gaps.length); i < gaps.length; i++) {
    if (gaps[i].endsWithContact) contacts++;
  }
  return contacts;
}

function scoreCandidateForHandoff(
  node: SearchNode,
  candidate: Candidate,
  rank: number,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
  usePreview = true,
  previewCostWeight = PREVIEW_COST_WEIGHT,
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
  // candidate.cost penalizes speed error symmetrically (1 of 4 axes), too weakly
  // to arrest creep. This extra term prefers, among the pool, catches whose
  // achieved speed does NOT overshoot the target — bleeding the creep using
  // catches that already exist (no new geometry). Only penalizes OVERshoot.
  const gap = gaps[node.gapIndex];
  let overshoot = 0;
  const tgtSpeed = gap.targets?.speed;
  const achSpeed = candidate.achieved?.speed;
  if (tgtSpeed !== undefined && achSpeed !== undefined && achSpeed > tgtSpeed) {
    overshoot = HANDOFF_SPEED_OVERSHOOT_WEIGHT * (achSpeed - tgtSpeed) * (achSpeed - tgtSpeed);
  }
  // Air overshoot is the other systematic suite-wide axis error (rider stays
  // airborne longer than target); same selection-only asymmetric bias.
  const tgtAir = gap.targets?.air;
  const achAir = candidate.achieved?.air;
  if (tgtAir !== undefined && achAir !== undefined && achAir > tgtAir) {
    overshoot += HANDOFF_AIR_OVERSHOOT_WEIGHT * (achAir - tgtAir) * (achAir - tgtAir);
  }
  return {
    candidate,
    child,
    rank,
    previewContacts: preview.landed,
    previewSurvivors: preview.survivors,
    score: candidate.cost + scarcity + previewCost + statePenalty + overshoot,
  };
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

  let best = Infinity;
  for (const candidate of firstCandidates.slice(0, START_FIRST_OPTIONS)) {
    const child = extendNodeCached(prefix, candidate);
    const nextGapIndex = nextContactGapIndex(gaps, child.gapIndex);
    if (nextGapIndex < 0) {
      best = Math.min(best, candidate.cost);
      continue;
    }
    let nextPrefix = child;
    while (nextPrefix.gapIndex < nextGapIndex) nextPrefix = extendNodeCached(nextPrefix, null);
    const nextCandidates = getCandidatesSorted(nextPrefix, gaps, ctx, seed, START_NEXT_K);
    const nextBest = pickLowestCost(nextCandidates);
    const nextCost = nextBest === null ? 0 : nextBest.cost * PREVIEW_COST_WEIGHT;
    const nextPenalty = nextCandidates.length === 0
      ? DEAD_END_PENALTY
      : SURVIVOR_SCARCITY_PENALTY / nextCandidates.length;
    best = Math.min(best, candidate.cost + nextPenalty + nextCost);
  }

  return best + START_HEURISTIC_WEIGHT * startHeuristicCost(start, axes);
}

function startCandidates(firstAxes: AxisValues): NonNullable<Spec["start"]>[] {
  const targetSpeed = (firstAxes.speed ?? 0.45) * CALIB.SPEED_CAP;
  const speedAnchors = targetSpeed >= 9
    ? [6, 8.5, 11, 13.5]
    : targetSpeed >= 6
    ? [3, 5.5, 8, 10.5]
    : [0.4, 2, 4, 6];
  const speeds = uniqueRounded([
    START_DEFAULTS.VELOCITY.x,
    ...speedAnchors,
    targetSpeed * 0.75,
    targetSpeed,
    targetSpeed * 1.2,
  ])
    .filter((speed) => speed > 0 && speed <= START_DEFAULTS.VELOCITY_SANITY_CAP);
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

function startHeuristicCost(start: NonNullable<Spec["start"]>, axes: AxisValues): number {
  const targetSpeed = (axes.speed ?? 0.45) * CALIB.SPEED_CAP;
  const speed = Math.hypot(start.vx, start.vy);
  const angle = (Math.atan2(start.vy, start.vx) * 180) / Math.PI;
  const targetAngle = targetStartAngle(axes);
  const speedCost = Math.pow((speed - targetSpeed) / CALIB.SPEED_CAP, 2);
  const angleCost = Math.pow((angle - targetAngle) / 70, 2);
  const lowSpeedPenalty = targetSpeed >= 6 && speed < targetSpeed * 0.45 ? 1 : 0;
  return speedCost + 0.35 * angleCost + lowSpeedPenalty;
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
  return {
    track: buildTrackJson(allLines, outputDurationFrames, node.startState),
    report,
    stats: {
      candidates_sampled: 0,
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
    },
  };
}

function paddedFits(node: HandoffNode, gapCount: number): (GapFit | null)[] {
  const fits = node.search.prefixFits.slice();
  while (fits.length < gapCount) fits.push(null);
  return fits;
}

export type { HandoffNode };
