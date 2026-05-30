/**
 * Prefix hand-off search.
 *
 * This is a separate optimizer from LDS. The search state is a partial track
 * prefix at a gap boundary, not a whole-track leaf. It expands one gap at a
 * time, keeps alternatives on a deterministic DFS stack, and ranks candidates
 * by a fixed local hand-off feasibility rollout:
 *
 *   "If we commit this catch, how many future contacts can a tiny greedy
 *    rollout land, and how much candidate slack does it have?"
 *
 * That rollout is engine-in-loop and charged in sim-frames, but it is a fixed
 * policy decision independent of the caller's budget. The budget only stops how
 * far into the deterministic node sequence we go; a strict best-so-far register
 * ranks every prefix output considered. This is the same budget contract as LDS
 * without making a search leaf be an entire re-generated track.
 */

import { detect, extractRawTrajectory, getRiderMetered } from "../../lib/detector.ts";
import { makeRng } from "../../lib/rng.ts";
import {
  type GapFit,
  type ResolvedStart,
  buildDriftReport,
  buildTrackJson,
  effectiveAxes,
  makeBaseEngine,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
} from "../core/substrate.ts";
import { CALIB, START_DEFAULTS, secToFrame, type Gap, type SectionAxes } from "../types.ts";
import { pickLowestCost, solveOneGap } from "./solver.ts";
import { getCandidatesSorted, extendNode, isLeafNode, makeRootNode, type SearchNode } from "./node.ts";
import { polishLeafVariant } from "./polish.ts";
import { BestSoFarRegister, leafKeyForReport, type LeafKey } from "./register.ts";
import {
  PhysicsFrameLimitExceeded,
  getSimFrames,
  resetSimFrames,
  setSimFrameLimit,
} from "./sim_frames.ts";
import { resetArcPlacementStats, snapshotArcPlacementStats } from "../arc_placement.ts";
import type { Candidate, SpecContext } from "./sample.ts";
import type { Budget, CompileOutput, DriftReport, Spec } from "./types.ts";

export type CompileHandoffOptions = {
  budget?: Budget;
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
  rank: number;
  score: number;
  previewContacts: number;
  previewSurvivors: number;
};

type StartOption = {
  rank: number;
  start: NonNullable<Spec["start"]>;
  state: ResolvedStart;
};

type HandoffTelemetry = {
  nodesExpanded: number;
  frontierMaxSize: number;
  partialEvaluations: number;
  fullEvaluations: number;
  previews: number;
  previewContacts: number;
  previewSurvivors: number;
  skips: number;
};

const DEFAULT_MAX_NODES = 800;
const HANDOFF_CANDIDATE_POOL = 8;
const HANDOFF_BRANCHING = 3;
const HANDOFF_PREVIEW_K = 3;
const HANDOFF_PREVIEW_HORIZON = 2;
const START_OPTION_LIMIT = 4;
const DEAD_END_PENALTY = 40;
const SURVIVOR_SCARCITY_PENALTY = 4;
const DEEP_MISS_PENALTY = 0.25;
const ROLLOUT_CONTACT_CREDIT = 0.25;
const PREVIEW_COST_WEIGHT = 0.25;
const HANDOFF_STATE_WEIGHT = 0.08;
const BUDGET_HARD_LIMIT_MULTIPLIER = 1.2;
const PARTIAL_FUTURE_CONTACT_WINDOW = 20;

export function compileHandoff(
  userSpec: Spec,
  seed = 0,
  opts: CompileHandoffOptions = {},
): CompileOutput {
  if (!Number.isSafeInteger(seed)) {
    throw new Error(`compileHandoff: seed must be a safe integer, got ${seed}`);
  }
  const maxNodes = opts.maxNodes ?? DEFAULT_MAX_NODES;
  if (!Number.isInteger(maxNodes) || maxNodes < 1) {
    throw new Error(`compileHandoff: maxNodes must be a positive integer, got ${maxNodes}`);
  }
  const budgetUnits = opts.budget?.units ?? Infinity;
  if (opts.budget !== undefined) {
    if (opts.budget.kind !== "work") {
      throw new Error(`compileHandoff: only Budget.kind === "work" is supported`);
    }
    if (!Number.isFinite(budgetUnits) || budgetUnits <= 0) {
      throw new Error(`compileHandoff: budget.units must be positive, got ${budgetUnits}`);
    }
  }

  resetSimFrames();
  resetArcPlacementStats();
  const hardBudgetLimit = opts.budget === undefined
    ? null
    : Math.ceil(budgetUnits * BUDGET_HARD_LIMIT_MULTIPLIER);
  // The root prefix is the fallback output for every positive budget. Do not
  // arm the hard in-op guard until after that first prefix is scored, otherwise
  // a tiny budget can throw before the best-so-far register contains anything.
  setSimFrameLimit(null);

  try {
    validateSpec(userSpec);
    // Do not run the legacy optimized-preroll pre-pass here. In the handoff
    // optimizer, the initial condition is the first state boundary of the search;
    // pre-worlding belongs in this search later, not as a hidden budget-consuming
    // compiler before it. A manual `start` is still honored by resolveStartState.
    const spec: Spec = { ...userSpec, preroll: undefined };
    const startOptions = buildStartOptions(userSpec, spec);
    const defaultStart = startOptions[0];
    const durationFrames = secToFrame(spec.duration);
    const allContactFrames = [...spec.contacts]
      .map((c) => secToFrame(c.t))
      .sort((a, b) => a - b);

    const gaps = sliceTimeline(allContactFrames, durationFrames);
    const masterRng = makeRng(seed);
    for (const gap of gaps) {
      const sec = effectiveAxes(gap, spec);
      gap.targets = sampleGapTargets(sec, CALIB.SIGMA, masterRng);
    }

    const ctx: SpecContext = { allContactFrames, durationFrames };
    const root: HandoffNode = {
      search: makeRootNode(makeBaseEngine(defaultStart.state), gaps.length),
      startState: defaultStart.state,
      startRank: defaultStart.rank,
      startExpanded: startOptions.length <= 1,
      deferExpansion: false,
      ranks: [],
      skippedContacts: 0,
    };
    const stack: HandoffNode[] = [root];
    const register = new BestSoFarRegister();
    const telemetry: HandoffTelemetry = {
      nodesExpanded: 0,
      frontierMaxSize: 1,
      partialEvaluations: 0,
      fullEvaluations: 0,
      previews: 0,
      previewContacts: 0,
      previewSurvivors: 0,
      skips: 0,
    };
    const polishEnabled = opts.polish ?? true;
    let polishTried = 0;
    let polishAdopted = 0;
    let budgetExhausted = false;
    let hardLimitError: PhysicsFrameLimitExceeded | null = null;

    const consider = (node: HandoffNode): LeafKey => {
      const evaluation = evaluateNode(node, spec, gaps, allContactFrames, durationFrames);
      if (evaluation.fullDuration) telemetry.fullEvaluations++;
      else telemetry.partialEvaluations++;
      register.consider(
        buildNodeOutput(
          node,
          evaluation.report,
          gaps,
          evaluation.outputDurationFrames,
          budgetExhausted,
        ),
        evaluation.key,
      );
      return evaluation.key;
    };

    try {
      while (stack.length > 0 && telemetry.nodesExpanded < maxNodes) {
        const node = stack.pop()!;
        const key = consider(node);
        opts.onNode?.(node, key);
        if (register.consideredCount === 1) setSimFrameLimit(hardBudgetLimit);

        if (node.deferExpansion) {
          stack.unshift({ ...node, deferExpansion: false });
          telemetry.frontierMaxSize = Math.max(telemetry.frontierMaxSize, stack.length);
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
            const evaluation = evaluateNode(
              polishNode, spec, gaps, allContactFrames, durationFrames,
            );
            if (evaluation.fullDuration) telemetry.fullEvaluations++;
            else telemetry.partialEvaluations++;
            register.consider(
              buildNodeOutput(
                polishNode,
                evaluation.report,
                gaps,
                evaluation.outputDurationFrames,
                budgetExhausted,
              ),
              evaluation.key,
            );
            if (register.improvementCount > improvedBefore) polishAdopted++;
          }
        }

        if (getSimFrames() >= budgetUnits) {
          budgetExhausted = true;
          break;
        }
        if (isTerminalNode(node.search, gaps)) continue;

        const children = expandNode(node, gaps, ctx, seed, startOptions, telemetry);
        telemetry.nodesExpanded++;
        for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
        telemetry.frontierMaxSize = Math.max(telemetry.frontierMaxSize, stack.length);
      }
    } catch (error) {
      if (!(error instanceof PhysicsFrameLimitExceeded)) throw error;
      hardLimitError = error;
      budgetExhausted = true;
    }

    if (getSimFrames() >= budgetUnits) budgetExhausted = true;
    const best = register.getBest();
    if (best === null) {
      if (hardLimitError !== null) throw hardLimitError;
      throw new Error(
        `compileHandoff: no prefix output could be evaluated ` +
        `(seed=${seed}, budget=${opts.budget ? opts.budget.units : "unset"}, ` +
        `sim_frames_used=${getSimFrames()})`,
      );
    }

    const arcStats = snapshotArcPlacementStats();
    return {
      ...best,
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
        handoff_start_options: startOptions.length,
        handoff_start_rank: best.stats.handoff_start_rank ?? 0,
        handoff_previews: telemetry.previews,
        handoff_preview_contacts: telemetry.previewContacts,
        handoff_preview_survivors: telemetry.previewSurvivors,
        handoff_skips: best.stats.handoff_skips ?? 0,
        handoff_skip_branches: telemetry.skips,
        ...(arcStats ? { arc_placement: arcStats } : {}),
      },
    };
  } finally {
    setSimFrameLimit(null);
  }
}

function expandNode(
  node: HandoffNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  startOptions: StartOption[],
  telemetry: HandoffTelemetry,
): HandoffNode[] {
  if (isTerminalNode(node.search, gaps)) return [];
  if (!node.startExpanded) {
    return startOptions.map((option) => ({
      search: makeRootNode(makeBaseEngine(option.state), gaps.length),
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
      search: extendNode(node.search, null),
      startState: node.startState,
      startRank: node.startRank,
      startExpanded: node.startExpanded,
      deferExpansion: false,
      ranks: [...node.ranks, -1],
      skippedContacts: node.skippedContacts,
    }];
  }

  const options = rankedOptions(node.search, gaps, ctx, seed, telemetry);
  if (options.length === 0) {
    telemetry.skips++;
    return [{
      search: extendNode(node.search, null),
      startState: node.startState,
      startRank: node.startRank,
      startExpanded: node.startExpanded,
      deferExpansion: false,
      ranks: [...node.ranks, -1],
      skippedContacts: node.skippedContacts + 1,
    }];
  }

  return options.map((option) => ({
    search: extendNode(node.search, option.candidate),
    startState: node.startState,
    startRank: node.startRank,
    startExpanded: node.startExpanded,
    deferExpansion: false,
    ranks: [...node.ranks, option.rank],
    skippedContacts: node.skippedContacts + (option.candidate === null ? 1 : 0),
  }));
}

function rankedOptions(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
): RankedOption[] {
  const sorted = getCandidatesSorted(node, gaps, ctx, seed);
  const pool = sorted.slice(0, HANDOFF_CANDIDATE_POOL);
  const scored = pool.map((candidate, rank) =>
    scoreCandidateForHandoff(node, candidate, rank, gaps, ctx, seed, telemetry)
  );
  scored.sort((a, b) =>
    a.score - b.score ||
    (a.candidate?.cost ?? Infinity) - (b.candidate?.cost ?? Infinity) ||
    a.rank - b.rank
  );
  return scored.slice(0, HANDOFF_BRANCHING);
}

function scoreCandidateForHandoff(
  node: SearchNode,
  candidate: Candidate,
  rank: number,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  telemetry: HandoffTelemetry,
): RankedOption {
  const child = extendNode(node, candidate);
  const preview = previewFutureContacts(child, gaps, ctx, seed, telemetry);
  const missedAfterFirst = Math.max(0, preview.horizon - Math.max(1, preview.landed));
  const scarcity = preview.horizon === 0
    ? 0
    : preview.firstSurvivors === 0
      ? DEAD_END_PENALTY
      : SURVIVOR_SCARCITY_PENALTY / preview.firstSurvivors;
  const previewCost = preview.firstCost === Infinity
    ? 0
    : preview.firstCost * PREVIEW_COST_WEIGHT;
  const deeperConfidence =
    DEEP_MISS_PENALTY * missedAfterFirst
    - ROLLOUT_CONTACT_CREDIT * Math.max(0, preview.landed - 1);
  const statePenalty = handoffStatePenalty(child.prefixEngine, gaps[node.gapIndex]);

  return {
    candidate,
    rank,
    previewContacts: preview.landed,
    previewSurvivors: preview.survivors,
    score: candidate.cost + scarcity + previewCost + deeperConfidence + statePenalty,
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
    while (node.gapIndex < nextGapIndex) node = extendNode(node, null);

    horizon++;
    const nextGap = gaps[nextGapIndex];
    const candidates = solveOneGap(
      node.prefixEngine,
      nextGap,
      perGapRng(seed, nextGapIndex),
      HANDOFF_PREVIEW_K,
      ctx,
      node.prefixNextLineId,
    );
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
    node = extendNode(node, best);
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

function perGapRng(seed: number, gapIndex: number): () => number {
  return makeRng((Math.imul(seed | 0, 1000003) + gapIndex + 1) | 0);
}

function buildStartOptions(rawSpec: Spec, searchSpec: Spec): StartOption[] {
  const defaultStart = resolveStartState(searchSpec);
  const defaultSpecStart: NonNullable<Spec["start"]> = {
    x: defaultStart.position.x,
    y: defaultStart.position.y,
    vx: defaultStart.velocity.x,
    vy: defaultStart.velocity.y,
  };

  if (rawSpec.start !== undefined || (rawSpec.preroll ?? 0) <= 0) {
    return [{ rank: 0, start: defaultSpecStart, state: defaultStart }];
  }

  const axes = firstSectionAxes(rawSpec);
  const starts = startCandidates(axes);
  const seen = new Set<string>();
  const unique = [defaultSpecStart, ...starts]
    .filter((start) => {
      const key = startKey(start);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const [first, ...rest] = unique;
  const ordered = [
    first,
    ...rest
      .sort((a, b) =>
        startHeuristicCost(a, axes) - startHeuristicCost(b, axes) ||
        startKey(a).localeCompare(startKey(b))
      )
      .slice(0, Math.max(0, START_OPTION_LIMIT - 1)),
  ];

  return ordered.map((start, rank) => ({
    rank,
    start,
    state: resolveStartState({ ...searchSpec, start }),
  }));
}

function startCandidates(firstAxes: SectionAxes): NonNullable<Spec["start"]>[] {
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

function startHeuristicCost(start: NonNullable<Spec["start"]>, axes: SectionAxes): number {
  const targetSpeed = (axes.speed ?? 0.45) * CALIB.SPEED_CAP;
  const speed = Math.hypot(start.vx, start.vy);
  const angle = (Math.atan2(start.vy, start.vx) * 180) / Math.PI;
  const targetAngle = targetStartAngle(axes);
  const speedCost = Math.pow((speed - targetSpeed) / CALIB.SPEED_CAP, 2);
  const angleCost = Math.pow((angle - targetAngle) / 70, 2);
  const lowSpeedPenalty = targetSpeed >= 6 && speed < targetSpeed * 0.45 ? 1 : 0;
  return speedCost + 0.35 * angleCost + lowSpeedPenalty;
}

function targetStartAngle(axes: SectionAxes): number {
  const air = axes.air ?? 0.5;
  if (air >= 0.7) return -12;
  if (air <= 0.3) return 24;
  return 6;
}

function startAngles(firstAxes: SectionAxes): number[] {
  const air = firstAxes.air ?? 0.5;
  if (air >= 0.7) return [-35, -18, -5, 10, 25];
  if (air <= 0.3) return [-5, 8, 20, 35, 50];
  return [-20, -8, 5, 18, 32];
}

function firstSectionAxes(spec: Spec): SectionAxes {
  const axes: SectionAxes = { ...(spec.defaults ?? {}) };
  const activeAtZero = spec.sections.filter((sec) => sec.t0 <= 0 && sec.t1 >= 0);
  const sections = activeAtZero.length > 0
    ? activeAtZero
    : [...spec.sections].sort((a, b) => a.t0 - b.t0).slice(0, 1);
  for (const sec of sections) {
    if (sec.air !== undefined) axes.air = sec.air;
    if (sec.speed !== undefined) axes.speed = sec.speed;
    if (sec.contact_style !== undefined) axes.contact_style = sec.contact_style;
    if (sec.grain !== undefined) axes.grain = sec.grain;
  }
  return axes;
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
