/** Exact predecessor-pool coverage study for a failing handoff prefix. */
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import dense240 from "../../benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts";
import pickup from "../../benchmark/v2/cases/normative/capability/frontier_pickup_progression.ts";
import pickupShifted from "../../benchmark/v2/cases/variants/capability/frontier_pickup_progression_shifted.ts";
import frontier from "../../benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts";
import frontier4 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts";
import frontier6 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_6s.ts";
import frontier7 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_7s.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { makeRng } from "../lib/rng.ts";
import {
  getRiderMetered,
  MIN_LANDING_AIRBORNE_FRAMES,
} from "../lib/detector.ts";
import { applyJolt } from "../produce/seed.ts";
import { makeSolidLine } from "./arc.ts";
import {
  readTargetStateFromRider,
  sampleArcPlacementGeometry,
  snapshotArcPlacementStats,
} from "./arc_placement.ts";
import {
  axisLookaheadEndFrame,
  detectWindow,
  translateTrackLines,
  tryCandidateGeometry,
  tryCandidateLines,
} from "./core/candidate.ts";
import {
  airborneAt,
  contactLineIdsAt,
  effectiveAxes,
  sampleGapTargets,
  sliceTimeline,
} from "./core/substrate.ts";
import {
  disableLandingWindowProbe,
  drainLandingWindowProbe,
  enableLandingWindowProbe,
  type LandingWindowProbeRecord,
} from "./landing_probe.ts";
import {
  compileHandoff,
  compileHandoffFromSnapshot,
  setForwardEvalContext,
  setHandoffPoolProbeHook,
  snapshotHandoffNode,
  type HandoffNode,
  type HandoffNodeEvent,
  type HandoffPoolProbeRecord,
} from "./optimizer/handoff.ts";
import {
  extendNodeCached,
  getCandidatesSorted,
  type SearchNode,
} from "./optimizer/node.ts";
import {
  nextContactGap,
  predictArrivalAtNextContact,
  scoreNextTargetReadiness,
} from "./optimizer/objective.ts";
import {
  getCandidateProbe,
  sampleOneCandidate,
  type Candidate,
  type SpecContext,
} from "./optimizer/sample.ts";
import type { LeafKey } from "./optimizer/register.ts";
import { adjustArcTailLength, applyArcKnobs } from "./optimizer/arc_model.ts";
import { scoreDriftReport } from "./score.ts";
import {
  CALIB,
  FPS,
  secToFrame,
  type AxisValues,
  type CandidateSampleMode,
  type Gap,
} from "./types.ts";
import type { Spec } from "./optimizer/types.ts";

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const caseId = argument("case") ?? "dense";
const seed = Number(argument("seed") ?? "8");
const searchSeed = Number(argument("search-seed") ?? String(seed));
const budget = Number(argument("budget") ?? "500000");
const candidateCount = Number(argument("candidates") ?? "32");
const nextCandidateCount = Number(argument("next-candidates") ?? String(candidateCount));
const suffixBudget = Number(argument("suffix-budget") ?? "0");
const suffixTop = Number(argument("suffix-top") ?? "8");
const geometryMode = argument("geometry") ?? "normal";
const geometryPhaseFrames = Number(argument("geometry-phase") ?? "1");
const geometryNormalOffset = Number(argument("geometry-normal") ?? "0");
const sampleMode = argument("sample-mode") ?? "normal";
const catchAttempts = Number(argument("catch-attempts") ?? "0");
const catchRank = Number(argument("catch-rank") ?? "-1");
const catchPhase = Number(argument("catch-phase") ?? "-1");
const catchTemplateGrid = argument("catch-template-grid") === "1";
const requestedTargetGap = Number(argument("target-gap") ?? "-1");
const targetVisit = argument("target-visit") ?? "winner";
const runwayAdjust = argument("runway-adjust") === "1";
const runwayRotate = argument("runway-rotate") === "1";
const runwayTranslate = argument("runway-translate") === "1";
const twoStep = argument("two-step") === "1";
const twoStepKnobBases = Number(argument("two-step-knob-bases") ?? "0");
const twoStepKnobWide = argument("two-step-knob-wide") === "1";
const contactSupportBases = Number(argument("contact-support-bases") ?? "0");
const contactSupportWide = argument("contact-support-wide") === "1";
const reuseGap = Number(argument("reuse-gap") ?? "-1");
const compileLandingProbe = argument("compile-landing-probe") === "1";

const catalog: Record<string, Spec> = {
  dense,
  dense240,
  pickup,
  "pickup-shifted": pickupShifted,
  frontier,
  frontier4,
  frontier6,
  frontier7,
};
const sourceSpec = catalog[caseId];
if (sourceSpec === undefined) throw new Error(`unknown --case=${caseId}`);
if (!Number.isSafeInteger(seed)) throw new Error(`invalid --seed=${seed}`);
if (!Number.isSafeInteger(searchSeed)) throw new Error(`invalid --search-seed=${searchSeed}`);
if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error(`invalid --budget=${budget}`);
if (!Number.isSafeInteger(candidateCount) || candidateCount <= 0) {
  throw new Error(`invalid --candidates=${candidateCount}`);
}
if (!Number.isSafeInteger(nextCandidateCount) || nextCandidateCount <= 0) {
  throw new Error(`invalid --next-candidates=${nextCandidateCount}`);
}
if (!Number.isSafeInteger(suffixBudget) || suffixBudget < 0) {
  throw new Error(`invalid --suffix-budget=${suffixBudget}`);
}
if (!Number.isSafeInteger(suffixTop) || suffixTop <= 0) {
  throw new Error(`invalid --suffix-top=${suffixTop}`);
}
if (
  geometryMode !== "normal" && geometryMode !== "time" &&
  geometryMode !== "time-extend" && geometryMode !== "phase-early"
) {
  throw new Error(`geometry must be normal|time|time-extend|phase-early`);
}
if (!Number.isSafeInteger(geometryPhaseFrames) || geometryPhaseFrames < 1 || geometryPhaseFrames > 6) {
  throw new Error(`invalid --geometry-phase=${geometryPhaseFrames}`);
}
if (!Number.isFinite(geometryNormalOffset) || Math.abs(geometryNormalOffset) > 20) {
  throw new Error(`invalid --geometry-normal=${geometryNormalOffset}`);
}
if (sampleMode !== "normal" && sampleMode !== "brake" && sampleMode !== "startup_catch") {
  throw new Error(`sample-mode must be normal|brake|startup_catch`);
}
if (!Number.isSafeInteger(catchAttempts) || catchAttempts < 0) {
  throw new Error(`invalid --catch-attempts=${catchAttempts}`);
}
if (!Number.isSafeInteger(catchRank) || catchRank < -1) {
  throw new Error(`invalid --catch-rank=${catchRank}`);
}
if (!Number.isSafeInteger(catchPhase) || catchPhase < -1 || catchPhase > 7) {
  throw new Error(`invalid --catch-phase=${catchPhase}`);
}
if (!Number.isSafeInteger(requestedTargetGap) || requestedTargetGap < -1) {
  throw new Error(`invalid --target-gap=${requestedTargetGap}`);
}
if (targetVisit !== "winner" && targetVisit !== "first") {
  throw new Error(`target-visit must be winner|first`);
}
if (!Number.isSafeInteger(twoStepKnobBases) || twoStepKnobBases < 0) {
  throw new Error(`invalid --two-step-knob-bases=${twoStepKnobBases}`);
}
if (!Number.isSafeInteger(contactSupportBases) || contactSupportBases < 0) {
  throw new Error(`invalid --contact-support-bases=${contactSupportBases}`);
}
if (!Number.isSafeInteger(reuseGap) || reuseGap < -1) {
  throw new Error(`invalid --reuse-gap=${reuseGap}`);
}

const spec = applyJolt(sourceSpec, benchmarkPolicy.transform.joltMs);
const visited: Array<{ node: HandoffNode; key: LeafKey; event: HandoffNodeEvent }> = [];
const poolProbeRecords: HandoffPoolProbeRecord[] = [];
let winner: HandoffNode | null = null;
setHandoffPoolProbeHook((record) => poolProbeRecords.push(record));
if (compileLandingProbe) enableLandingWindowProbe();
const checkpoint = compileHandoff(spec, seed, {
  budget,
  searchSeed,
  onNode(node, key, event) {
    visited.push({ node, key, event });
    if (event.improved) winner = node;
  },
});
setHandoffPoolProbeHook(null);
const compileLandingProbeSummary = compileLandingProbe
  ? summarizeLandingProbe(drainLandingWindowProbe().records)
  : null;
if (compileLandingProbe) disableLandingWindowProbe();
if (winner === null) throw new Error(`compile produced no best node`);

const setup = buildSetup(spec, seed);
const firstVisitedProgressFrame = visited.find((record) => record.node.search.gapIndex > 0)
  ?.event.simFrames ?? null;
const totalContactGaps = setup.gaps.filter((gap) => gap.endsWithContact).length;
const firstCompletionFrame = checkpoint.stats.first_completion_frame ?? null;
const precompletionLagVisits = firstVisitedProgressFrame === null || totalContactGaps <= 1
  ? []
  : visited.flatMap((record) => {
    if (firstCompletionFrame !== null && record.event.simFrames > firstCompletionFrame) return [];
    const remainingContacts = setup.gaps
      .slice(record.node.search.gapIndex)
      .filter((gap) => gap.endsWithContact).length;
    const completedContacts = totalContactGaps - remainingContacts;
    if (completedContacts <= 1 || budget <= firstVisitedProgressFrame) return [];
    const spentContacts = (record.event.simFrames - firstVisitedProgressFrame) /
      (budget - firstVisitedProgressFrame) * (totalContactGaps - 1);
    return [{
      gap: record.node.search.gapIndex,
      simFrames: record.event.simFrames,
      lagContacts: round(spentContacts - (completedContacts - 1)),
    }];
  });
const deepestProgress: Array<{ gap: number; simFrames: number }> = [];
let observedDeepestGap = -1;
for (const record of visited) {
  const gap = record.node.search.gapIndex;
  if (gap <= observedDeepestGap) continue;
  observedDeepestGap = gap;
  deepestProgress.push({ gap, simFrames: record.event.simFrames });
}
setForwardEvalContext(setup.spec, setup.gapAxisTargets);
const bestNode: HandoffNode = winner;
const winningNode = visited.reduce((deepest, record) =>
  record.node.skippedContacts === 0 && record.node.search.gapIndex > deepest.search.gapIndex
    ? record.node
    : deepest
, bestNode);
const targetNode = requestedTargetGap < 0
  ? winningNode
  : targetVisit === "first"
  ? visited.find((record) => record.node.search.gapIndex === requestedTargetGap)?.node ?? null
  : visited
    .filter((record) =>
      record.node.search.gapIndex === requestedTargetGap &&
      isPrefix(record.node.search.prefixFits, winningNode.search.prefixFits)
    )
    .at(-1)?.node ?? null;
if (targetNode === null) {
  throw new Error(`winning path did not expose requested target gap ${requestedTargetGap}`);
}
const targetGapIndex = targetNode.search.gapIndex;
const parentRecord = deepestWinningAncestor(visited, targetNode);
if (parentRecord === null) {
  throw new Error(`could not locate an evaluated ancestor for gap ${targetGapIndex}`);
}
const parent = parentRecord.node;
const predecessorGap = setup.gaps[parent.search.gapIndex];
const nextGap = nextContactGap(predecessorGap, setup.gaps);
if (nextGap === null) throw new Error(`ancestor has no next contact`);
const parentTargetState = getCandidateProbe(
  parent.search.prefixEngine,
  predecessorGap,
  setup.ctx,
).targetState;

const pool = geometryMode === "normal" && sampleMode === "normal"
  ? getCandidatesSorted(
    parent.search,
    setup.gaps,
    setup.ctx,
    winningNode.searchSeed,
    candidateCount,
  )
  : geometryMode === "phase-early"
  ? samplePhasePool(
    parent.search,
    predecessorGap,
    setup.ctx,
    winningNode.searchSeed,
    candidateCount,
    geometryPhaseFrames,
    geometryNormalOffset,
  )
  : sampleGeometryPool(
    parent.search,
    predecessorGap,
    setup.ctx,
    winningNode.searchSeed,
    candidateCount,
    geometryMode,
    sampleMode,
  );
const selectedTrace = targetNode.rankTrace[parent.search.gapIndex] ?? null;
const selectedRank = selectedTrace?.rank ?? null;
const selectedCandidate = targetNode.search.prefixFits[parent.search.gapIndex];
const selectedPoolRank = selectedCandidate === null ? null : pool.indexOf(selectedCandidate);
const analysisPool: Array<{ candidate: Candidate; poolRank: number }> = [
  ...(selectedCandidate !== null && selectedPoolRank !== null && selectedPoolRank < 0
    ? [{ candidate: selectedCandidate, poolRank: -1 }]
    : []),
  ...pool.map((candidate, poolRank) => ({ candidate, poolRank })),
];
const matchingPoolProbe = [...poolProbeRecords].reverse().find((record) =>
  record.gapIndex === parent.search.gapIndex &&
  pool.slice(0, Math.min(7, pool.length)).every((candidate, rank) => {
    const probe = record.candidates[rank];
    if (probe === undefined) return false;
    const lineLength = candidate.lines.reduce(
      (sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1),
      0,
    );
    return probe.qualityRank === rank &&
      probe.lineCount === candidate.lines.length &&
      Math.abs(probe.lineLength - lineLength) < 1e-6 &&
      Math.abs(probe.cost - candidate.cost) < 1e-9;
  })
) ?? null;
const exploredChildren = visited.flatMap((record) => {
  const node = record.node;
  if (node.search.gapIndex !== parent.search.gapIndex + 1) return [];
  if (!isPrefix(parent.search.prefixFits, node.search.prefixFits)) return [];
  const entry = node.rankTrace[parent.search.gapIndex];
  return entry === undefined ? [] : [{
    rank: entry.rank,
    source: entry.source,
    simFrames: record.event.simFrames,
  }];
}).filter((entry, index, all) =>
  all.findIndex((other) => other.rank === entry.rank && other.source === entry.source) === index
);
enableLandingWindowProbe();
const rows = analysisPool.map(({ candidate, poolRank }) => {
  const child = advanceToGap(
    extendNodeCached(parent.search, candidate),
    setup.gaps,
    nextGap.index,
  );
  const nextTargetState = getCandidateProbe(child.prefixEngine, nextGap, setup.ctx).targetState;
  const transition = transitionState(child.prefixEngine, predecessorGap, nextGap);
  drainLandingWindowProbe();
  const gateBefore = snapshotArcPlacementStats().by_sample_mode.normal;
  const continuations = getCandidatesSorted(
    child,
    setup.gaps,
    setup.ctx,
    winningNode.searchSeed,
    nextCandidateCount,
  );
  const gateAfter = snapshotArcPlacementStats().by_sample_mode.normal;
  const landingProbe = drainLandingWindowProbe().records;
  const twoStepCoverage = twoStep
    ? evaluateTwoStepCoverage(
      child,
      continuations,
      nextGap,
      setup,
      winningNode.searchSeed,
      nextCandidateCount,
    )
    : null;
  const arrival = predictArrivalAtNextContact(candidate, nextGap);
  const nextTargets = setup.ctx.gapAxisTargets?.[nextGap.index] ?? nextGap.targets;
  const readiness = arrival === null ? null : scoreNextTargetReadiness(arrival, nextTargets);
  const runwayAdjustment = runwayAdjust
    ? evaluateRunwayAdjustment(
      parent.search,
      candidate,
      transition,
      predecessorGap,
      nextGap,
      setup,
      winningNode.searchSeed,
      candidateCount,
    )
    : null;
  const runwayRotations = runwayRotate
    ? evaluateRunwayRotations(
      parent.search,
      candidate,
      predecessorGap,
      nextGap,
      setup,
      winningNode.searchSeed,
      candidateCount,
    )
    : [];
  const runwayTranslations = runwayTranslate
    ? evaluateRunwayTranslations(
      parent.search,
      candidate,
      predecessorGap,
      nextGap,
      setup,
      winningNode.searchSeed,
      candidateCount,
    )
    : [];
  return {
    rank: poolRank,
    selected: candidate === selectedCandidate,
    sampleAttempt: candidate.sampleAttempt ?? null,
    cost: round(candidate.cost),
    geometry: summarizeLines(candidate.lines),
    nextCandidates: continuations.length,
    twoStepCoverage,
    firstNextSampleAttempt: continuations.reduce<number | null>((minimum, continuation) => {
      const attempt = continuation.sampleAttempt;
      if (attempt === undefined) return minimum;
      return minimum === null ? attempt : Math.min(minimum, attempt);
    }, null),
    arrivalAir: nullableRound(arrival?.nextAir ?? null),
    arrivalSpeed: nullableRound(arrival?.speed ?? null),
    arrivalAngleDeg: nullableRound(arrival?.comAngleDeg ?? null),
    arrivalElevation: nullableRound(arrival?.nextElevation ?? null),
    releaseFrame: candidate.releaseArrivalState?.frame ?? null,
    releaseVx: nullableRound(candidate.releaseArrivalState?.vx ?? null),
    releaseVy: nullableRound(candidate.releaseArrivalState?.vy ?? null),
    releaseGrounded: candidate.releaseArrivalState?.grounded ?? null,
    nextTargetState: {
      speed: round(nextTargetState.speed),
      angleDeg: round(nextTargetState.angleDeg),
      vx: round(nextTargetState.velocity.x),
      vy: round(nextTargetState.velocity.y),
    },
    continuationGates: counterDelta(gateBefore, gateAfter),
    landingProbe: summarizeLandingProbe(landingProbe),
    transition,
    runwayAdjustment,
    runwayRotations,
    runwayTranslations,
    readiness: nullableRound(readiness?.readiness ?? null),
    catchability: nullableRound(readiness?.catchability ?? null),
    airFit: nullableRound(readiness?.airFit ?? null),
  };
});
disableLandingWindowProbe();
const twoStepKnobStudy = twoStepKnobBases === 0
  ? null
  : evaluateTwoStepKnobs(
    parent.search,
    analysisPool.slice(0, twoStepKnobBases),
    predecessorGap,
    nextGap,
    setup,
    winningNode.searchSeed,
    candidateCount,
    twoStepKnobWide,
  );
const contactSupportStudy = contactSupportBases === 0
  ? null
  : evaluateContactSupport(
    parent.search,
    analysisPool.slice(0, contactSupportBases),
    predecessorGap,
    nextGap,
    setup,
    winningNode.searchSeed,
    nextCandidateCount,
    contactSupportWide,
  );
const priorReuse = reuseGap < 0
  ? null
  : evaluatePriorReuse(
    parent.search,
    targetNode,
    reuseGap,
    predecessorGap,
    nextGap,
    setup,
    winningNode.searchSeed,
    candidateCount,
  );
const catchBase = catchRank < 0 ? selectedCandidate : pool[catchRank] ?? null;
const catchGrid = catchAttempts === 0 || catchBase === null
  ? null
  : sampleCatchManifold(
    advanceToGap(
      extendNodeCached(parent.search, catchBase),
      setup.gaps,
      nextGap.index,
    ),
    nextGap,
    setup,
    catchAttempts,
    catchPhase,
    winningNode.searchSeed,
    nextCandidateCount,
    catchTemplateGrid,
  );
const suffixRows = suffixBudget === 0
  ? []
  : pool.slice(0, suffixTop).map((candidate, rank) => {
    const childNode: HandoffNode = {
      ...parent,
      search: extendNodeCached(parent.search, candidate),
      deferExpansion: false,
      rankTrace: [...parent.rankTrace, { rank, source: "pool" }],
    };
    const resumed = compileHandoffFromSnapshot(
      spec,
      seed,
      snapshotHandoffNode(childNode, parentRecord.key, parentRecord.event),
      { budget: suffixBudget },
    );
    const score = scoreDriftReport(resumed.report, {
      totalFrames: Math.round(spec.duration * FPS),
    });
    return {
      rank,
      sampleAttempt: candidate.sampleAttempt ?? null,
      valid: score.contract_passed,
      score: round(score.score),
      hardFailures: score.hard_failures,
      contactsHit: resumed.report.contacts.filter((contact) => contact.status === "hit").length,
      contactsMissing: resumed.report.contacts.filter((contact) => contact.status === "missing").length,
      terminus: resumed.report.terminus,
      deepestGap: resumed.stats.handoff_deepest_seen_gap ?? null,
      firstCompletionFrame: resumed.stats.first_completion_frame ?? null,
    };
  });

const output = {
  schema: "line.study-predecessor-coverage.v1",
  caseId,
  seed,
  searchSeed,
  budget,
  candidateCount,
  nextCandidateCount,
  geometryMode,
  geometryPhaseFrames,
  geometryNormalOffset,
  sampleMode,
  catchAttempts,
  catchRank,
  catchBaseSource: catchRank < 0 ? "selected" : "pool",
  catchPhase,
  catchTemplateGrid,
  suffixBudget,
  valid: checkpoint.report.terminus.reason === "endOfSpec" &&
    checkpoint.stats.gap_commits === setup.gaps.filter((gap) => gap.endsWithContact).length,
  score: scoreDriftReport(checkpoint.report, {
    totalFrames: Math.round(spec.duration * FPS),
  }).score,
  simFrames: checkpoint.stats.sim_frames,
  firstVisitedProgressFrame,
  totalContactGaps,
  maximumPrecompletionLagContacts: precompletionLagVisits.length === 0
    ? null
    : Math.max(...precompletionLagVisits.map((visit) => visit.lagContacts)),
  maximumPrecompletionLagVisits: precompletionLagVisits
    .sort((a, b) => b.lagContacts - a.lagContacts)
    .slice(0, 12),
  candidatesSampled: checkpoint.stats.candidates_sampled,
  searchNodesExpanded: checkpoint.stats.search_nodes_expanded ?? null,
  forwardEval: checkpoint.stats.fwd_eval ?? null,
  compileLandingProbe: compileLandingProbeSummary,
  deepestGap: checkpoint.stats.handoff_deepest_seen_gap ?? null,
  deepestProgress,
  winningGap: targetGapIndex,
  requestedTargetGap,
  targetVisit,
  runwayAdjust,
  runwayRotate,
  runwayTranslate,
  twoStep,
  twoStepKnobBases,
  twoStepKnobWide,
  contactSupportBases,
  contactSupportWide,
  reuseGap,
  parentGap: parent.search.gapIndex,
  predecessorTargets: predecessorGap.targets,
  nextTargets: nextGap.targets,
  parentTargetState: {
    speed: round(parentTargetState.speed),
    angleDeg: round(parentTargetState.angleDeg),
    vx: round(parentTargetState.velocity.x),
    vy: round(parentTargetState.velocity.y),
  },
  parentSimFrames: parentRecord.event.simFrames,
  selectedRank,
  selectedSource: selectedTrace?.source ?? null,
  selectedSourceAxis: selectedTrace?.sourceAxis ?? null,
  selectedPoolRank,
  winningRankTrace: winningNode.rankTrace,
  rankedPool: matchingPoolProbe?.candidates
    .filter((candidate) => candidate.handoffScore !== undefined)
    .map((candidate) => ({
      qualityRank: candidate.qualityRank,
      handoffScore: candidate.handoffScore!,
      admitted: candidate.admitted,
      cost: round(candidate.cost),
      readiness: candidate.readiness === null ? null : round(candidate.readiness),
    }))
    .sort((a, b) => a.handoffScore - b.handoffScore || a.qualityRank - b.qualityRank) ?? null,
  exploredChildren,
  bridgingCandidates: rows.filter((row) => row.nextCandidates > 0).length,
  rows,
  twoStepKnobStudy,
  contactSupportStudy,
  priorReuse,
  catchGrid,
  suffixRows,
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

function buildSetup(userSpec: Spec, publicSeed: number): {
  spec: Spec;
  gaps: Gap[];
  gapAxisTargets: AxisValues[];
  ctx: SpecContext;
} {
  const feasibleContacts = userSpec.contacts.filter((contact) => secToFrame(contact.t) >= 5);
  const normalized: Spec = { ...userSpec, preroll: undefined, contacts: feasibleContacts };
  const durationFrames = secToFrame(normalized.duration);
  const contactFrames = normalized.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(contactFrames, durationFrames);
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, normalized));
  const rng = makeRng(publicSeed);
  for (const gap of gaps) {
    gap.targets = sampleGapTargets(gapAxisTargets[gap.index], normalized.jitter ?? CALIB.SIGMA, rng);
  }
  const impactByFrame = new Map(
    normalized.contacts.flatMap((contact) => contact.impact === undefined
      ? []
      : [[secToFrame(contact.t), contact.impact] as const]),
  );
  for (const gap of gaps) {
    const impact = impactByFrame.get(gap.endFrame);
    if (!gap.endsWithContact || impact === undefined) continue;
    gap.targets.impact = impact;
    gapAxisTargets[gap.index].impact = impact;
  }
  for (let index = 0; index + 1 < gaps.length; index++) {
    const next = gaps[index + 1];
    if (gaps[index].endsWithContact && next.endsWithContact && next.targets.impact !== undefined) {
      gaps[index].nextImpact = next.targets.impact;
    }
  }
  return {
    spec: normalized,
    gaps,
    gapAxisTargets,
    ctx: { allContactFrames: contactFrames, durationFrames, gapAxisTargets },
  };
}

function deepestWinningAncestor(
  nodes: Array<{ node: HandoffNode; key: LeafKey; event: HandoffNodeEvent }>,
  best: HandoffNode,
): { node: HandoffNode; key: LeafKey; event: HandoffNodeEvent } | null {
  let ancestor: { node: HandoffNode; key: LeafKey; event: HandoffNodeEvent } | null = null;
  for (const record of nodes) {
    const node = record.node;
    if (node.search.gapIndex >= best.search.gapIndex) continue;
    if (!isPrefix(node.search.prefixFits, best.search.prefixFits)) continue;
    if (ancestor === null || node.search.gapIndex > ancestor.node.search.gapIndex) ancestor = record;
  }
  return ancestor;
}

function isPrefix(prefix: SearchNode["prefixFits"], full: SearchNode["prefixFits"]): boolean {
  if (prefix.length > full.length) return false;
  return prefix.every((fit, index) => fit === full[index]);
}

function advanceToGap(node: SearchNode, gaps: Gap[], target: number): SearchNode {
  let current = node;
  while (current.gapIndex < target) current = extendNodeCached(current, null);
  return current;
}

function sampleGeometryPool(
  node: SearchNode,
  gap: Gap,
  ctx: SpecContext,
  searchSeed: number,
  count: number,
  geometry: "normal" | "time" | "time-extend",
  mode: CandidateSampleMode,
): Candidate[] {
  const rng = makeRng((Math.imul(searchSeed | 0, 1000003) + gap.index + 1) | 0);
  const candidates: Candidate[] = [];
  for (let attempt = 0; attempt < count; attempt++) {
    const candidate = sampleOneCandidate(
      node.prefixEngine,
      gap,
      rng,
      ctx,
      node.prefixNextLineId,
      attempt,
      mode,
      gap.targets,
      geometry === "normal" ? undefined : geometry,
    );
    if (candidate !== null) candidates.push(candidate);
  }
  return candidates;
}

function samplePhasePool(
  node: SearchNode,
  gap: Gap,
  ctx: SpecContext,
  searchSeed: number,
  count: number,
  phaseFrames: number,
  normalOffset: number,
): Candidate[] {
  const rng = makeRng((Math.imul(searchSeed | 0, 1000003) + gap.index + 1) | 0);
  const normalProbe = getCandidateProbe(node.prefixEngine, gap, ctx);
  const geometryGap = { ...gap, endFrame: gap.endFrame - phaseFrames };
  const geometryContactFrames = ctx.allContactFrames.map((frame) =>
    frame === gap.endFrame ? geometryGap.endFrame : frame
  );
  const rider = getRiderMetered(node.prefixEngine, geometryGap.endFrame);
  const targetState = readTargetStateFromRider(rider, normalProbe.refX, normalProbe.refY);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const candidates: Candidate[] = [];
  for (let attempt = 0; attempt < count; attempt++) {
    const sampledGeometry = sampleArcPlacementGeometry(
      rng,
      targetState.sledX,
      targetState.sledY,
      gap.targets,
      targetState,
      attempt,
      geometryGap,
      node.prefixNextLineId,
      "normal",
      geometryContactFrames,
    );
    const first = sampledGeometry.lines[0];
    const length = Math.hypot(first.x2 - first.x1, first.y2 - first.y1);
    const nx = length <= 0 ? 0 : -(first.y2 - first.y1) / length;
    const ny = length <= 0 ? 0 : (first.x2 - first.x1) / length;
    const geometry = normalOffset === 0
      ? sampledGeometry
      : {
        ...sampledGeometry,
        lines: sampledGeometry.lines.map((line) => ({
          ...line,
          x1: line.x1 + nx * normalOffset,
          y1: line.y1 + ny * normalOffset,
          x2: line.x2 + nx * normalOffset,
          y2: line.y2 + ny * normalOffset,
        })),
      };
    const fit = tryCandidateGeometry(
      node.prefixEngine,
      gap,
      geometry,
      node.prefixNextLineId,
      ctx.allContactFrames,
      axisMeasureEnd,
      gap.targets,
      true,
      "normal",
      normalProbe.preTargetSledTrace,
    ) as Candidate | null;
    if (fit === null) continue;
    fit.ref = { x: targetState.sledX, y: targetState.sledY };
    fit.sampleAttempt = attempt;
    candidates.push(fit);
  }
  return candidates;
}

function sampleCatchManifold(
  node: SearchNode,
  gap: Gap,
  setup: ReturnType<typeof buildSetup>,
  attempts: number,
  fixedPhase: number,
  searchSeed: number,
  candidateCount: number,
  templateGrid: boolean,
): {
  viable: number;
  detectorReady: number;
  bridging: number;
  gates: Record<string, number>;
  landingProbe: ReturnType<typeof summarizeLandingProbe>;
  best: Array<{
    attempt: number;
    cost: number;
    phaseFrames: number;
    placementSpeed: number;
    placementAngleDeg: number;
    approachDeltaDeg: number;
    approachAngleDeg: number;
    turnDeg: number;
    normalOffset: number;
    tangentOffset: number;
    preLength: number;
    postLength: number;
  }>;
  bridges: Array<{
    attempt: number;
    cost: number;
    phaseFrames: number;
    placementSpeed: number;
    placementAngleDeg: number;
    approachDeltaDeg: number;
    approachAngleDeg: number;
    turnDeg: number;
    normalOffset: number;
    tangentOffset: number;
    preLength: number;
    postLength: number;
    nextCandidates: number;
    transition: ReturnType<typeof transitionState>;
  }>;
} {
  const targetState = getCandidateProbe(node.prefixEngine, gap, setup.ctx).targetState;
  const phaseStates = Array.from({ length: 8 }, (_, phaseFrames) => {
    const rider = getRiderMetered(node.prefixEngine, gap.endFrame - phaseFrames);
    return readTargetStateFromRider(rider, targetState.sledX, targetState.sledY);
  });
  const axisMeasureEnd = axisLookaheadEndFrame(gap, setup.ctx.allContactFrames);
  const viable = [];
  const bridges = [];
  let detectorReady = 0;
  enableLandingWindowProbe();
  drainLandingWindowProbe();
  const gateBefore = snapshotArcPlacementStats().by_sample_mode.normal;
  const controls = templateGrid
    ? normalizedCatchTemplateGrid(phaseStates)
    : Array.from({ length: attempts }, (_, attempt) => {
      const phaseFrames = fixedPhase < 0 ? attempt % phaseStates.length : fixedPhase;
      const placementState = phaseStates[phaseFrames];
      return {
        attempt,
        phaseFrames,
        placementState,
        approachAngleDeg: placementState.angleDeg + lerp(-55, 35, sequence(attempt, 0)),
        turnDeg: lerp(-65, 35, sequence(attempt, 1)),
        normalOffset: lerp(-10, 22, sequence(attempt, 2)),
        tangentOffset: placementState.speed * lerp(-2, 2, sequence(attempt, 3)),
        preLength: lerp(8, 52, sequence(attempt, 4)),
        postLength: lerp(24, 180, sequence(attempt, 5)),
      };
    });
  for (const control of controls) {
    const {
      attempt,
      phaseFrames,
      placementState,
      approachAngleDeg,
      turnDeg,
      normalOffset,
      tangentOffset,
      preLength,
      postLength,
    } = control;
    const lines = buildCatchLines({
      lineIdStart: node.prefixNextLineId,
      sledX: placementState.sledX,
      sledY: placementState.sledY,
      approachAngleDeg,
      turnDeg,
      normalOffset,
      tangentOffset,
      preLength,
      postLength,
    });
    const fit = tryCandidateLines(
      node.prefixEngine,
      gap,
      lines,
      node.prefixNextLineId,
      setup.ctx.allContactFrames,
      axisMeasureEnd,
      gap.targets,
      true,
      "normal",
      getCandidateProbe(node.prefixEngine, gap, setup.ctx).preTargetSledTrace,
    );
    if (fit === null) continue;
    const descriptor = {
      attempt,
      cost: round(fit.cost),
      phaseFrames,
      placementSpeed: round(placementState.speed),
      placementAngleDeg: round(placementState.angleDeg),
      approachDeltaDeg: round(approachAngleDeg - placementState.angleDeg),
      approachAngleDeg: round(approachAngleDeg),
      turnDeg: round(turnDeg),
      normalOffset: round(normalOffset),
      tangentOffset: round(tangentOffset),
      preLength: round(preLength),
      postLength: round(postLength),
    };
    viable.push(descriptor);
    const followingGap = nextContactGap(gap, setup.gaps);
    if (followingGap === null) continue;
    const child = advanceToGap(extendNodeCached(node, fit as Candidate), setup.gaps, followingGap.index);
    const transition = transitionState(child.prefixEngine, gap, followingGap);
    const latestGrounded = followingGap.endFrame - MIN_LANDING_AIRBORNE_FRAMES;
    if (
      transition.lastGroundedBeforeTarget === null ||
      transition.lastGroundedBeforeTarget > latestGrounded
    ) continue;
    detectorReady++;
    const continuations = getCandidatesSorted(
      child,
      setup.gaps,
      setup.ctx,
      searchSeed,
      candidateCount,
    );
    if (continuations.length === 0) continue;
    bridges.push({
      ...descriptor,
      nextCandidates: continuations.length,
      transition,
    });
  }
  const gates = counterDelta(
    gateBefore,
    snapshotArcPlacementStats().by_sample_mode.normal,
  );
  const landingProbe = summarizeLandingProbe(drainLandingWindowProbe().records);
  disableLandingWindowProbe();
  viable.sort((a, b) => a.cost - b.cost || a.attempt - b.attempt);
  bridges.sort((a, b) => b.nextCandidates - a.nextCandidates || a.cost - b.cost || a.attempt - b.attempt);
  return {
    viable: viable.length,
    detectorReady,
    bridging: bridges.length,
    gates,
    landingProbe,
    best: viable.slice(0, 20),
    bridges: bridges.slice(0, 40),
  };
}

function normalizedCatchTemplateGrid(
  phaseStates: Array<ReturnType<typeof readTargetStateFromRider>>,
): Array<{
  attempt: number;
  phaseFrames: number;
  placementState: ReturnType<typeof readTargetStateFromRider>;
  approachAngleDeg: number;
  turnDeg: number;
  normalOffset: number;
  tangentOffset: number;
  preLength: number;
  postLength: number;
}> {
  const phaseFrames = 4;
  const placementState = phaseStates[phaseFrames];
  const controls: ReturnType<typeof normalizedCatchTemplateGrid> = [];
  let attempt = 0;
  for (const approachDeltaDeg of [0, 3, 6]) {
    for (const turnDeg of [24, 32, 40]) {
      for (const normalOffset of [-2, -0.5, 1]) {
        for (const tangentFrames of [1.4, 1.75, 2.1]) {
          for (const preFrames of [3.5, 4.25, 5]) {
            for (const postFrames of [1.75, 2.25, 2.75]) {
              controls.push({
                attempt: attempt++,
                phaseFrames,
                placementState,
                approachAngleDeg: placementState.angleDeg + approachDeltaDeg,
                turnDeg,
                normalOffset,
                tangentOffset: placementState.speed * tangentFrames,
                preLength: placementState.speed * preFrames,
                postLength: placementState.speed * postFrames,
              });
            }
          }
        }
      }
    }
  }
  return controls;
}

function transitionState(
  // deno-lint-ignore no-explicit-any
  engine: any,
  predecessorGap: Gap,
  nextGap: Gap,
): {
  lastGroundedBeforeTarget: number | null;
  airborneRunAtTarget: number;
  currentEvents: Array<{ frame: number; type: string; offset: number }>;
  events: Array<{ frame: number; type: string; offset: number }>;
} {
  const det = detectWindow(
    engine,
    predecessorGap.startFrame,
    nextGap.endFrame + 6,
  );
  let lastGroundedBeforeTarget: number | null = null;
  for (let frame = predecessorGap.endFrame; frame < nextGap.endFrame; frame++) {
    if (airborneAt(det, frame) === false) lastGroundedBeforeTarget = frame;
  }
  let airborneRunAtTarget = 0;
  for (let frame = nextGap.endFrame - 1; frame >= predecessorGap.endFrame; frame--) {
    if (airborneAt(det, frame) !== true) break;
    airborneRunAtTarget++;
  }
  return {
    lastGroundedBeforeTarget,
    airborneRunAtTarget,
    currentEvents: det.events
      .filter((event) => Math.abs(event.frame - predecessorGap.endFrame) <= 2)
      .map((event) => ({
        frame: event.frame,
        type: event.type,
        offset: event.frame - predecessorGap.endFrame,
      })),
    events: det.events
      .filter((event) => Math.abs(event.frame - nextGap.endFrame) <= 6)
      .map((event) => ({
        frame: event.frame,
        type: event.type,
        offset: event.frame - nextGap.endFrame,
      })),
  };
}

function summarizeLines(lines: Candidate["lines"]): {
  count: number;
  length: number;
  segmentLengths: number[];
  anglesDeg: number[];
} {
  const segmentLengths = lines.map((line) => Math.hypot(line.x2 - line.x1, line.y2 - line.y1));
  const anglesDeg = lines.map((line) =>
    (Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180) / Math.PI
  );
  return {
    count: lines.length,
    length: round(segmentLengths.reduce((sum, value) => sum + value, 0)),
    segmentLengths: segmentLengths.map(round),
    anglesDeg: anglesDeg.map(round),
  };
}

function evaluateRunwayAdjustment(
  parent: SearchNode,
  candidate: Candidate,
  transition: ReturnType<typeof transitionState>,
  gap: Gap,
  nextGap: Gap,
  setup: ReturnType<typeof buildSetup>,
  searchSeed: number,
  candidateCount: number,
): null | {
  deltaFrames: number;
  deltaPx: number;
  validCurrent: boolean;
  nextCandidates: number;
  transition: ReturnType<typeof transitionState> | null;
} {
  if (transition.lastGroundedBeforeTarget === null) return null;
  const latestGrounded = nextGap.endFrame - MIN_LANDING_AIRBORNE_FRAMES;
  const deltaFrames = latestGrounded - transition.lastGroundedBeforeTarget;
  if (deltaFrames >= 0) return null;
  const speed = candidate.releaseSpeed ?? Math.hypot(
    candidate.releaseArrivalState?.vx ?? 0,
    candidate.releaseArrivalState?.vy ?? 0,
  );
  if (!(speed > 0)) return null;
  const deltaPx = deltaFrames * speed;
  const lines = adjustArcTailLength(candidate.lines, deltaPx);
  if (lines === null) return null;
  const fit = tryCandidateLines(
    parent.prefixEngine,
    gap,
    lines,
    parent.prefixNextLineId,
    setup.ctx.allContactFrames,
    axisLookaheadEndFrame(gap, setup.ctx.allContactFrames),
    gap.targets,
    true,
    "normal",
    getCandidateProbe(parent.prefixEngine, gap, setup.ctx).preTargetSledTrace,
  ) as Candidate | null;
  if (fit === null) {
    return { deltaFrames, deltaPx: round(deltaPx), validCurrent: false, nextCandidates: 0, transition: null };
  }
  const child = advanceToGap(extendNodeCached(parent, fit), setup.gaps, nextGap.index);
  const nextCandidates = getCandidatesSorted(
    child,
    setup.gaps,
    setup.ctx,
    searchSeed,
    candidateCount,
  ).length;
  return {
    deltaFrames,
    deltaPx: round(deltaPx),
    validCurrent: true,
    nextCandidates,
    transition: transitionState(child.prefixEngine, gap, nextGap),
  };
}

function evaluateContactSupport(
  parent: SearchNode,
  bases: Array<{ candidate: Candidate; poolRank: number }>,
  gap: Gap,
  nextGap: Gap,
  setup: ReturnType<typeof buildSetup>,
  searchSeed: number,
  candidateCount: number,
  wide: boolean,
): {
  trials: number;
  currentValid: number;
  earliestLastGrounded: number | null;
  maximumAirborneRun: number;
  successes: Array<{
    baseRank: number;
    supportFrames: number;
    exitDeltaDeg: number;
    jointIndex: number;
    jointDistancePx: number;
    currentCost: number;
    nextCandidates: number;
    transition: ReturnType<typeof transitionState>;
  }>;
  validExamples: Array<{
    baseRank: number;
    supportFrames: number;
    exitDeltaDeg: number;
    jointIndex: number;
    jointDistancePx: number;
    currentCost: number;
    transition: ReturnType<typeof transitionState>;
    contactTrace: Array<{ frame: number; lineIds: number[] }>;
  }>;
} {
  const supportFrames = wide
    ? [
      0.35, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3,
      4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160, 192, 208, 224,
      232, 240, 248, 256, 260, 262, 264, 266, 268, 272, 280,
    ]
    : [0.5, 0.75, 1, 1.25, 1.5, 2];
  const exitDeltas = wide
    ? [-30, -24, -20, -16, -12, -8, -4, 0, 4, 8, 10, 12, 12.5, 13, 13.5, 14, 16, 18, 20, 24, 30]
    : [0];
  const probe = getCandidateProbe(parent.prefixEngine, gap, setup.ctx);
  const speed = Math.max(1, probe.targetState.speed);
  let trials = 0;
  let currentValid = 0;
  let earliestLastGrounded: number | null = null;
  let maximumAirborneRun = 0;
  const successes = [];
  const validExamples = [];
  for (const { candidate, poolRank } of bases) {
    const joint = closestContactJoint(candidate.lines, probe.targetState.sledX, probe.targetState.sledY);
    if (joint === null) continue;
    for (const frames of supportFrames) {
      for (const exitDeltaDeg of exitDeltas) {
        trials++;
        const lines = oneSegmentContactSupport(
          candidate.lines,
          joint.index,
          speed * frames,
          exitDeltaDeg,
          parent.prefixNextLineId,
        );
        const fit = tryCandidateLines(
          parent.prefixEngine,
          gap,
          lines,
          parent.prefixNextLineId,
          setup.ctx.allContactFrames,
          axisLookaheadEndFrame(gap, setup.ctx.allContactFrames),
          gap.targets,
          true,
          "normal",
          probe.preTargetSledTrace,
        ) as Candidate | null;
        if (fit === null) continue;
        currentValid++;
        const child = advanceToGap(extendNodeCached(parent, fit), setup.gaps, nextGap.index);
        const transition = transitionState(child.prefixEngine, gap, nextGap);
        if (transition.lastGroundedBeforeTarget !== null) {
          earliestLastGrounded = earliestLastGrounded === null
            ? transition.lastGroundedBeforeTarget
            : Math.min(earliestLastGrounded, transition.lastGroundedBeforeTarget);
        }
        maximumAirborneRun = Math.max(maximumAirborneRun, transition.airborneRunAtTarget);
        validExamples.push({
          baseRank: poolRank,
          supportFrames: frames,
          exitDeltaDeg,
          jointIndex: joint.index,
          jointDistancePx: round(joint.distancePx),
          currentCost: round(fit.cost),
          transition,
          contactTrace: physicalContactTrace(child.prefixEngine, gap.endFrame - 2, nextGap.endFrame - 1),
        });
        const continuations = getCandidatesSorted(
          child,
          setup.gaps,
          setup.ctx,
          searchSeed,
          candidateCount,
        );
        if (continuations.length === 0) continue;
        successes.push({
          baseRank: poolRank,
          supportFrames: frames,
          exitDeltaDeg,
          jointIndex: joint.index,
          jointDistancePx: round(joint.distancePx),
          currentCost: round(fit.cost),
          nextCandidates: continuations.length,
          transition,
        });
      }
    }
  }
  return {
    trials,
    currentValid,
    earliestLastGrounded,
    maximumAirborneRun,
    successes,
    validExamples: validExamples
      .sort((a, b) =>
        (a.transition.lastGroundedBeforeTarget ?? Infinity) -
          (b.transition.lastGroundedBeforeTarget ?? Infinity) ||
        a.currentCost - b.currentCost
      )
      .slice(0, 24),
  };
}

function physicalContactTrace(
  // deno-lint-ignore no-explicit-any
  engine: any,
  firstFrame: number,
  lastFrame: number,
): Array<{ frame: number; lineIds: number[] }> {
  const det = detectWindow(engine, firstFrame, lastFrame);
  const trace = [];
  for (let frame = firstFrame; frame <= lastFrame; frame++) {
    const lineIds = contactLineIdsAt(det, frame);
    if (lineIds.length > 0) trace.push({ frame, lineIds });
  }
  return trace;
}

function closestContactJoint(
  lines: Candidate["lines"],
  sledX: number,
  sledY: number,
): { index: number; distancePx: number } | null {
  if (lines.length < 2) return null;
  let best: { index: number; distancePx: number } | null = null;
  for (let index = 1; index < lines.length; index++) {
    const point = lines[index];
    const distancePx = Math.hypot(point.x1 - sledX, point.y1 - sledY);
    if (best === null || distancePx < best.distancePx) best = { index, distancePx };
  }
  return best;
}

function oneSegmentContactSupport(
  lines: Candidate["lines"],
  jointIndex: number,
  supportLength: number,
  exitDeltaDeg: number,
  lineIdStart: number,
): Candidate["lines"] {
  const prefix = lines.slice(0, jointIndex).map((line, index) => ({
    ...line,
    id: lineIdStart + index,
  }));
  const source = lines[jointIndex];
  const angle = Math.atan2(source.y2 - source.y1, source.x2 - source.x1) +
    (exitDeltaDeg * Math.PI) / 180;
  prefix.push({
    ...source,
    id: lineIdStart + prefix.length,
    x2: source.x1 + Math.cos(angle) * supportLength,
    y2: source.y1 + Math.sin(angle) * supportLength,
  });
  return prefix;
}

function evaluateRunwayRotations(
  parent: SearchNode,
  candidate: Candidate,
  gap: Gap,
  nextGap: Gap,
  setup: ReturnType<typeof buildSetup>,
  searchSeed: number,
  candidateCount: number,
): Array<{
  rotateDeg: number;
  validCurrent: boolean;
  nextCandidates: number;
  transition: ReturnType<typeof transitionState> | null;
}> {
  const out = [];
  const probe = getCandidateProbe(parent.prefixEngine, gap, setup.ctx);
  for (const rotateDeg of [1, 2, 3, 4, 5, 6, 8, 10]) {
    const lines = applyArcKnobs(candidate.lines, { pitchDeg: 0, rotateDeg })
      .map((line, index) => ({ ...line, id: parent.prefixNextLineId + index }));
    const fit = tryCandidateLines(
      parent.prefixEngine,
      gap,
      lines,
      parent.prefixNextLineId,
      setup.ctx.allContactFrames,
      axisLookaheadEndFrame(gap, setup.ctx.allContactFrames),
      gap.targets,
      true,
      "normal",
      probe.preTargetSledTrace,
    ) as Candidate | null;
    if (fit === null) {
      out.push({ rotateDeg, validCurrent: false, nextCandidates: 0, transition: null });
      continue;
    }
    const child = advanceToGap(extendNodeCached(parent, fit), setup.gaps, nextGap.index);
    const transition = transitionState(child.prefixEngine, gap, nextGap);
      const latestGrounded = nextGap.endFrame - MIN_LANDING_AIRBORNE_FRAMES;
    const nextCandidates = transition.lastGroundedBeforeTarget !== null &&
        transition.lastGroundedBeforeTarget <= latestGrounded
      ? getCandidatesSorted(
        child,
        setup.gaps,
        setup.ctx,
        searchSeed,
        candidateCount,
      ).length
      : 0;
    out.push({ rotateDeg, validCurrent: true, nextCandidates, transition });
  }
  return out;
}

function evaluateRunwayTranslations(
  parent: SearchNode,
  candidate: Candidate,
  gap: Gap,
  nextGap: Gap,
  setup: ReturnType<typeof buildSetup>,
  searchSeed: number,
  candidateCount: number,
): Array<{
  tangentFrames: number;
  normalPx: number;
  validCurrent: boolean;
  nextCandidates: number;
  transition: ReturnType<typeof transitionState> | null;
}> {
  const out = [];
  const first = candidate.lines[0];
  const angle = Math.atan2(first.y2 - first.y1, first.x2 - first.x1);
  const tx = Math.cos(angle);
  const ty = Math.sin(angle);
  const nx = -ty;
  const ny = tx;
  const speed = candidate.releaseSpeed ?? 10;
  const probe = getCandidateProbe(parent.prefixEngine, gap, setup.ctx);
  for (const tangentFrames of [-2, -1, 0, 1, 2]) {
    for (const normalPx of [-8, -4, 0, 4, 8]) {
      if (tangentFrames === 0 && normalPx === 0) continue;
      const dx = tx * tangentFrames * speed + nx * normalPx;
      const dy = ty * tangentFrames * speed + ny * normalPx;
      const lines = candidate.lines.map((line, index) => ({
        ...line,
        id: parent.prefixNextLineId + index,
        x1: line.x1 + dx,
        y1: line.y1 + dy,
        x2: line.x2 + dx,
        y2: line.y2 + dy,
      }));
      const fit = tryCandidateLines(
        parent.prefixEngine,
        gap,
        lines,
        parent.prefixNextLineId,
        setup.ctx.allContactFrames,
        axisLookaheadEndFrame(gap, setup.ctx.allContactFrames),
        gap.targets,
        true,
        "normal",
        probe.preTargetSledTrace,
      ) as Candidate | null;
      if (fit === null) {
        out.push({ tangentFrames, normalPx, validCurrent: false, nextCandidates: 0, transition: null });
        continue;
      }
      const child = advanceToGap(extendNodeCached(parent, fit), setup.gaps, nextGap.index);
      const transition = transitionState(child.prefixEngine, gap, nextGap);
    const latestGrounded = nextGap.endFrame - MIN_LANDING_AIRBORNE_FRAMES;
      const nextCandidates = transition.lastGroundedBeforeTarget !== null &&
          transition.lastGroundedBeforeTarget <= latestGrounded
        ? getCandidatesSorted(
          child,
          setup.gaps,
          setup.ctx,
          searchSeed,
          candidateCount,
        ).length
        : 0;
      out.push({ tangentFrames, normalPx, validCurrent: true, nextCandidates, transition });
    }
  }
  return out;
}

function evaluateTwoStepCoverage(
  parent: SearchNode,
  candidates: Candidate[],
  gap: Gap,
  setup: ReturnType<typeof buildSetup>,
  searchSeed: number,
  candidateCount: number,
): null | {
  followingGap: number;
  candidatesWithContinuation: number;
  totalFollowingCandidates: number;
  firstCandidateRank: number | null;
  earliestLastGrounded: number | null;
  maximumAirborneRun: number;
  arrivalAngleDeg: { min: number | null; max: number | null };
} {
  const followingGap = nextContactGap(gap, setup.gaps);
  if (followingGap === null) return null;
  let candidatesWithContinuation = 0;
  let totalFollowingCandidates = 0;
  let firstCandidateRank: number | null = null;
  let earliestLastGrounded: number | null = null;
  let maximumAirborneRun = 0;
  const arrivalAngles: number[] = [];
  candidates.forEach((candidate, rank) => {
    const child = advanceToGap(
      extendNodeCached(parent, candidate),
      setup.gaps,
      followingGap.index,
    );
    const transition = transitionState(child.prefixEngine, gap, followingGap);
    if (transition.lastGroundedBeforeTarget !== null) {
      earliestLastGrounded = earliestLastGrounded === null
        ? transition.lastGroundedBeforeTarget
        : Math.min(earliestLastGrounded, transition.lastGroundedBeforeTarget);
    }
    maximumAirborneRun = Math.max(maximumAirborneRun, transition.airborneRunAtTarget);
    arrivalAngles.push(
      getCandidateProbe(child.prefixEngine, followingGap, setup.ctx).targetState.angleDeg,
    );
    const following = getCandidatesSorted(
      child,
      setup.gaps,
      setup.ctx,
      searchSeed,
      candidateCount,
    );
    if (following.length === 0) return;
    candidatesWithContinuation++;
    totalFollowingCandidates += following.length;
    if (firstCandidateRank === null) firstCandidateRank = rank;
  });
  return {
    followingGap: followingGap.index,
    candidatesWithContinuation,
    totalFollowingCandidates,
    firstCandidateRank,
    earliestLastGrounded,
    maximumAirborneRun,
    arrivalAngleDeg: {
      min: arrivalAngles.length === 0 ? null : round(Math.min(...arrivalAngles)),
      max: arrivalAngles.length === 0 ? null : round(Math.max(...arrivalAngles)),
    },
  };
}

function evaluateTwoStepKnobs(
  parent: SearchNode,
  bases: Array<{ candidate: Candidate; poolRank: number }>,
  gap: Gap,
  nextGap: Gap,
  setup: ReturnType<typeof buildSetup>,
  searchSeed: number,
  candidateCount: number,
  wide: boolean,
): {
  trials: number;
  validCurrent: number;
  successes: Array<{
    baseRank: number;
    pitchDeg: number;
    rotateDeg: number;
    currentCost: number;
    nextCandidates: number;
    arrivalState: { speed: number; angleDeg: number; vx: number; vy: number };
    releaseState: {
      frame: number | null;
      vx: number | null;
      vy: number | null;
      grounded: number | null;
    };
    coverage: NonNullable<ReturnType<typeof evaluateTwoStepCoverage>>;
  }>;
} {
  let trials = 0;
  let validCurrent = 0;
  const successes = [];
  const probe = getCandidateProbe(parent.prefixEngine, gap, setup.ctx);
  const pitches = wide ? [-16, -12, -8, -4, 0, 4, 8, 12, 16] : [-8, -4, 0, 4, 8];
  const rotations = wide ? [-6, -3, 0, 3, 6] : [-3, 0, 3];
  for (const { candidate, poolRank } of bases) {
    for (const pitchDeg of pitches) {
      for (const rotateDeg of rotations) {
        if (pitchDeg === 0 && rotateDeg === 0) continue;
        trials++;
        const lines = applyArcKnobs(candidate.lines, { pitchDeg, rotateDeg })
          .map((line, index) => ({ ...line, id: parent.prefixNextLineId + index }));
        const fit = tryCandidateLines(
          parent.prefixEngine,
          gap,
          lines,
          parent.prefixNextLineId,
          setup.ctx.allContactFrames,
          axisLookaheadEndFrame(gap, setup.ctx.allContactFrames),
          gap.targets,
          true,
          "normal",
          probe.preTargetSledTrace,
        ) as Candidate | null;
        if (fit === null) continue;
        validCurrent++;
        const child = advanceToGap(extendNodeCached(parent, fit), setup.gaps, nextGap.index);
        const continuations = getCandidatesSorted(
          child,
          setup.gaps,
          setup.ctx,
          searchSeed,
          candidateCount,
        );
        const coverage = evaluateTwoStepCoverage(
          child,
          continuations,
          nextGap,
          setup,
          searchSeed,
          candidateCount,
        );
        if (coverage === null || coverage.candidatesWithContinuation === 0) continue;
        const arrivalState = getCandidateProbe(child.prefixEngine, nextGap, setup.ctx).targetState;
        successes.push({
          baseRank: poolRank,
          pitchDeg,
          rotateDeg,
          currentCost: round(fit.cost),
          nextCandidates: continuations.length,
          arrivalState: {
            speed: round(arrivalState.speed),
            angleDeg: round(arrivalState.angleDeg),
            vx: round(arrivalState.velocity.x),
            vy: round(arrivalState.velocity.y),
          },
          releaseState: {
            frame: fit.releaseArrivalState?.frame ?? null,
            vx: fit.releaseArrivalState === undefined ? null : round(fit.releaseArrivalState.vx),
            vy: fit.releaseArrivalState === undefined ? null : round(fit.releaseArrivalState.vy),
            grounded: fit.releaseArrivalState?.grounded ?? null,
          },
          coverage,
        });
      }
    }
  }
  return { trials, validCurrent, successes };
}

function evaluatePriorReuse(
  parent: SearchNode,
  targetNode: HandoffNode,
  sourceGap: number,
  gap: Gap,
  nextGap: Gap,
  setup: ReturnType<typeof buildSetup>,
  searchSeed: number,
  candidateCount: number,
): null | {
  sourceGap: number;
  validCurrent: boolean;
  nextCandidates: number;
  cost: number | null;
  transition: ReturnType<typeof transitionState> | null;
} {
  const source = targetNode.search.prefixFits[sourceGap];
  if (source === undefined || source === null || source.ref === undefined) return null;
  const probe = getCandidateProbe(parent.prefixEngine, gap, setup.ctx);
  const lines = translateTrackLines(
    source.lines,
    probe.targetState.sledX - source.ref.x,
    probe.targetState.sledY - source.ref.y,
    parent.prefixNextLineId,
  );
  const fit = tryCandidateLines(
    parent.prefixEngine,
    gap,
    lines,
    parent.prefixNextLineId,
    setup.ctx.allContactFrames,
    axisLookaheadEndFrame(gap, setup.ctx.allContactFrames),
    gap.targets,
    true,
    "normal",
    probe.preTargetSledTrace,
  ) as Candidate | null;
  if (fit === null) {
    return { sourceGap, validCurrent: false, nextCandidates: 0, cost: null, transition: null };
  }
  const child = advanceToGap(extendNodeCached(parent, fit), setup.gaps, nextGap.index);
  const nextCandidates = getCandidatesSorted(
    child,
    setup.gaps,
    setup.ctx,
    searchSeed,
    candidateCount,
  ).length;
  return {
    sourceGap,
    validCurrent: true,
    nextCandidates,
    cost: round(fit.cost),
    transition: transitionState(child.prefixEngine, gap, nextGap),
  };
}

function buildCatchLines(input: {
  lineIdStart: number;
  sledX: number;
  sledY: number;
  approachAngleDeg: number;
  turnDeg: number;
  normalOffset: number;
  tangentOffset: number;
  preLength: number;
  postLength: number;
}): ReturnType<typeof makeSolidLine>[] {
  const approach = (input.approachAngleDeg * Math.PI) / 180;
  const tx = Math.cos(approach);
  const ty = Math.sin(approach);
  const nx = -ty;
  const ny = tx;
  const contact = {
    x: input.sledX + tx * input.tangentOffset + nx * input.normalOffset,
    y: input.sledY + ty * input.tangentOffset + ny * input.normalOffset,
  };
  const lines = [makeSolidLine(
    input.lineIdStart,
    contact.x - tx * input.preLength,
    contact.y - ty * input.preLength,
    contact.x,
    contact.y,
  )];
  const segments = 8;
  const segmentLength = input.postLength / segments;
  let x = contact.x;
  let y = contact.y;
  for (let segment = 0; segment < segments; segment++) {
    const t = (segment + 1) / segments;
    const angle = ((input.approachAngleDeg + input.turnDeg * t) * Math.PI) / 180;
    const nextX = x + Math.cos(angle) * segmentLength;
    const nextY = y + Math.sin(angle) * segmentLength;
    lines.push(makeSolidLine(input.lineIdStart + segment + 1, x, y, nextX, nextY));
    x = nextX;
    y = nextY;
  }
  return lines;
}

function sequence(attempt: number, dimension: number): number {
  const strides = [0.6180339887498949, 0.7548776662466927, 0.5698402909980532,
    0.4384471871911697, 0.328173343614748, 0.2797659434150245];
  return fract((attempt + 1) * strides[dimension] + (dimension + 1) * 0.137503523749935);
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function nullableRound(value: number | null): number | null {
  return value === null ? null : round(value);
}

function counterDelta(
  before: ReturnType<typeof snapshotArcPlacementStats>["by_sample_mode"]["normal"],
  after: ReturnType<typeof snapshotArcPlacementStats>["by_sample_mode"]["normal"],
): Record<string, number> {
  return Object.fromEntries(
    Object.keys(before).map((key) => [
      key,
      after[key as keyof typeof after] - before[key as keyof typeof before],
    ]),
  );
}

function summarizeLandingProbe(records: LandingWindowProbeRecord[]): {
  total: number;
  survivalFailed: number;
  acceptedAtW: Record<string, number>;
  offsets: Record<string, number>;
  byGap: Record<string, {
    total: number;
    survivalFailed: number;
    acceptedAtW: Record<string, number>;
    offsets: Record<string, number>;
    scored: number;
  }>;
} {
  const summarize = (subset: LandingWindowProbeRecord[]) => {
    const acceptedAtW: Record<string, number> = {};
    const offsets: Record<string, number> = {};
    for (const record of subset) {
      const width = record.acceptedAtW === null ? "none" : String(record.acceptedAtW);
      acceptedAtW[width] = (acceptedAtW[width] ?? 0) + 1;
      if (record.offset !== null) {
        const offset = String(record.offset);
        offsets[offset] = (offsets[offset] ?? 0) + 1;
      }
    }
    return {
      total: subset.length,
      survivalFailed: subset.filter((record) => record.failure === "survival").length,
      acceptedAtW,
      offsets,
      scored: subset.filter((record) => record.handoffScore !== undefined).length,
    };
  };
  const byGapRecords = new Map<number, LandingWindowProbeRecord[]>();
  for (const record of records) {
    const atGap = byGapRecords.get(record.gapIndex) ?? [];
    atGap.push(record);
    byGapRecords.set(record.gapIndex, atGap);
  }
  const overall = summarize(records);
  const byGap = Object.fromEntries(
    [...byGapRecords.entries()]
      .sort(([a], [b]) => a - b)
      .map(([gapIndex, subset]) => [String(gapIndex), summarize(subset)]),
  );
  return {
    total: overall.total,
    survivalFailed: overall.survivalFailed,
    acceptedAtW: overall.acceptedAtW,
    offsets: overall.offsets,
    byGap,
  };
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
