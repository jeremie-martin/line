/** Exact predecessor-pool coverage study for a failing handoff prefix. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import dense240 from "../../benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts";
import pickup from "../../benchmark/v2/cases/normative/capability/frontier_pickup_progression.ts";
import pickupShifted from "../../benchmark/v2/cases/variants/capability/frontier_pickup_progression_shifted.ts";
import frontier from "../../benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts";
import frontier4 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts";
import frontier6 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_6s.ts";
import frontier7 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_7s.ts";
import countercurrent from "../../benchmark/v2/cases/normative/representative/countercurrent.ts";
import believer from "../../benchmark/v2/cases/normative/development_music/believer_56_6s.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { makeRng } from "../lib/rng.ts";
import {
  getRiderMetered,
  MIN_LANDING_AIRBORNE_FRAMES,
} from "../lib/detector.ts";
import { applyJolt } from "../produce/seed.ts";
import { makeSolidLine } from "./arc.ts";
import {
  clearImpactTemplateMarker,
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
  isOnlineTraversalBehindSchedule,
  objectiveLeafValue,
  setForwardEvalContext,
  setHandoffCapacityProbeHook,
  setHandoffDeadEndProbeHook,
  setHandoffFrontierProbeHook,
  setHandoffFrontierNodeProbeHook,
  setHandoffPoolProbeHook,
  setHandoffRankedOptionsProbeHook,
  snapshotHandoffNode,
  type HandoffNode,
  type HandoffNodeEvent,
  type HandoffCapacityProbeRecord,
  type HandoffDeadEndProbeRecord,
  type HandoffFrontierProbeRecord,
  type HandoffPoolProbeRecord,
  type HandoffRankedOptionsProbeRecord,
} from "./optimizer/handoff.ts";
import {
  extendNodeCached,
  getCandidatesSorted,
  type SearchNode,
} from "./optimizer/node.ts";
import {
  nextContactGap,
  projectOutgoingScorerGap,
  scoreNextArcReadiness,
} from "./optimizer/objective.ts";
import { successorScorerGapAfter } from "./optimizer/arc_proposal.ts";
import {
  getCandidateProbe,
  sampleOneCandidate,
  type Candidate,
  type SpecContext,
} from "./optimizer/sample.ts";
import type { LeafKey } from "./optimizer/register.ts";
import { adjustArcTailLength, applyArcKnobs, scaleArcLines } from "./optimizer/arc_model.ts";
import { planKinematicSupport } from "./optimizer/kinematic_support.ts";
import { scoreDriftReport } from "./score.ts";
import {
  authoredSpeedToPx,
  CALIB,
  FPS,
  secToFrame,
  type AxisValues,
  type CandidateSampleMode,
  type Gap,
} from "./types.ts";
import type { Spec } from "./optimizer/types.ts";

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Exact predecessor-pool coverage study.",
    "",
    "Usage:",
    "  LR_ENGINE=wasm npx tsx scripts/v0/study_predecessor_coverage.ts \\",
    "    --case=dense --seed=24 --budget=250000 --out=generated/studies/coverage.json",
    "",
    "Key options: --case, --seed, --search-seed, --budget, --target-gap,",
    "--catch-controls='[{...}]' (normalized state-relative diagnostic controls),",
    "--ranked-options-probe-gap=N, --runway-adjust=1, --runway-rotate=1,",
    "--whole-scale=0.94,1.06 [--whole-scale-bases=N --whole-scale-suffix-budget=N],",
    "--suffix-search-seeds=N,... (fixed-prefix alternate search read),",
    "--two-step-knob-suffix-coordinates=pitch:rotate,... (limits exact suffix replays),",
    "--runway-translate=1, --out.",
  ].join("\n") + "\n");
  process.exit(0);
}
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
const suffixRanks = (argument("suffix-ranks") ?? "")
  .split(",")
  .filter((value) => value.length > 0)
  .map((value) => Number(value));
const suffixSearchSeeds = (argument("suffix-search-seeds") ?? "")
  .split(",")
  .filter((value) => value.length > 0)
  .map((value) => Number(value));
const geometryMode = argument("geometry") ?? "normal";
const geometryPhaseFrames = Number(argument("geometry-phase") ?? "1");
const geometryNormalOffset = Number(argument("geometry-normal") ?? "0");
const sampleMode = argument("sample-mode") ?? "normal";
const catchAttempts = Number(argument("catch-attempts") ?? "0");
const catchRank = Number(argument("catch-rank") ?? "-1");
const catchPhase = Number(argument("catch-phase") ?? "-1");
const catchTemplateGrid = argument("catch-template-grid") === "1";
const catchControls = parseCatchControls(argument("catch-controls"));
const catchSuffixBudget = Number(argument("catch-suffix-budget") ?? "0");
const catchSuffixAll = argument("catch-suffix-all") === "1";
const requestedTargetGap = Number(argument("target-gap") ?? "-1");
const targetVisit = argument("target-visit") ?? "winner";
const runwayAdjust = argument("runway-adjust") === "1";
const runwayRotate = argument("runway-rotate") === "1";
const runwayTranslate = argument("runway-translate") === "1";
const twoStep = argument("two-step") === "1";
const twoStepKnobBases = Number(argument("two-step-knob-bases") ?? "0");
const twoStepKnobWide = argument("two-step-knob-wide") === "1";
const twoStepKnobSuffixBudget = Number(argument("two-step-knob-suffix-budget") ?? "0");
const twoStepKnobOutcomeDepth = Number(argument("two-step-knob-outcome-depth") ?? "0");
const twoStepKnobOutcomeBranch = Number(argument("two-step-knob-outcome-branch") ?? "1");
const twoStepKnobSuffixCoordinates = parseKnobCoordinates(
  argument("two-step-knob-suffix-coordinates"),
  "two-step-knob-suffix-coordinates",
);
const twoStepKnobOutcomeCoordinates = parseKnobCoordinates(
  argument("two-step-knob-outcome-coordinates"),
  "two-step-knob-outcome-coordinates",
);
const contactSupportBases = Number(argument("contact-support-bases") ?? "0");
const contactSupportWide = argument("contact-support-wide") === "1";
const contactSupportSuffixBudget = Number(argument("contact-support-suffix-budget") ?? "0");
const contactSupportSelect = argument("contact-support-select") ?? "coverage";
const contactSupportNormalized = argument("contact-support-normalized") === "1";
const reuseGap = Number(argument("reuse-gap") ?? "-1");
const compileLandingProbe = argument("compile-landing-probe") === "1";
const capacityProbe = argument("capacity-probe") === "1";
const rankedOptionsProbeGap = Number(argument("ranked-options-probe-gap") ?? "-1");
const frontierProbeGap = Number(argument("frontier-probe-gap") ?? "-1");
const frontierSnapshotRankArg = argument("frontier-snapshot-rank");
const frontierSnapshotRank = frontierSnapshotRankArg === undefined
  ? null
  : Number(frontierSnapshotRankArg);
const frontierSnapshotBudget = Number(argument("frontier-snapshot-budget") ?? "0");
const deadEndProbe = argument("dead-end-probe") === "1";
const deadEndAlternateRank = Number(argument("dead-end-alternate-rank") ?? "-1");
const deadEndSearchSeeds = (argument("dead-end-search-seeds") ?? "")
  .split(",")
  .filter((value) => value.length > 0)
  .map((value) => Number(value));
const wholeScaleValues = (argument("whole-scale") ?? "")
  .split(",")
  .filter((value) => value.length > 0)
  .map((value) => Number(value));
const wholeScaleBases = Number(argument("whole-scale-bases") ?? "1");
const wholeScaleSuffixBudget = Number(argument("whole-scale-suffix-budget") ?? "0");
const outPath = argument("out");

const catalog: Record<string, Spec> = {
  dense,
  dense240,
  pickup,
  "pickup-shifted": pickupShifted,
  frontier,
  frontier4,
  frontier6,
  frontier7,
  countercurrent,
  believer,
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
if (suffixRanks.some((rank) => !Number.isSafeInteger(rank) || rank < -1)) {
  throw new Error(`invalid --suffix-ranks (expected comma-separated pool ranks or -1)`);
}
if (suffixSearchSeeds.some((value) => !Number.isSafeInteger(value))) {
  throw new Error(`invalid --suffix-search-seeds (expected comma-separated integer seeds)`);
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
if (!Number.isSafeInteger(catchSuffixBudget) || catchSuffixBudget < 0) {
  throw new Error(`invalid --catch-suffix-budget=${catchSuffixBudget}`);
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
if (!Number.isSafeInteger(twoStepKnobSuffixBudget) || twoStepKnobSuffixBudget < 0) {
  throw new Error(`invalid --two-step-knob-suffix-budget=${twoStepKnobSuffixBudget}`);
}
if (!Number.isSafeInteger(twoStepKnobOutcomeDepth) || twoStepKnobOutcomeDepth < 0 || twoStepKnobOutcomeDepth > 6) {
  throw new Error(`invalid --two-step-knob-outcome-depth=${twoStepKnobOutcomeDepth}`);
}
if (!Number.isSafeInteger(twoStepKnobOutcomeBranch) || twoStepKnobOutcomeBranch < 1 || twoStepKnobOutcomeBranch > 4) {
  throw new Error(`invalid --two-step-knob-outcome-branch=${twoStepKnobOutcomeBranch}`);
}
if (!Number.isSafeInteger(contactSupportBases) || contactSupportBases < 0) {
  throw new Error(`invalid --contact-support-bases=${contactSupportBases}`);
}
if (!Number.isSafeInteger(contactSupportSuffixBudget) || contactSupportSuffixBudget < 0) {
  throw new Error(`invalid --contact-support-suffix-budget=${contactSupportSuffixBudget}`);
}
if (contactSupportSelect !== "coverage" && contactSupportSelect !== "cheapest-improving") {
  throw new Error(`contact-support-select must be coverage|cheapest-improving`);
}
if (!Number.isSafeInteger(reuseGap) || reuseGap < -1) {
  throw new Error(`invalid --reuse-gap=${reuseGap}`);
}
if (!Number.isSafeInteger(frontierProbeGap) || frontierProbeGap < -1) {
  throw new Error(`invalid --frontier-probe-gap=${frontierProbeGap}`);
}
if (!Number.isSafeInteger(rankedOptionsProbeGap) || rankedOptionsProbeGap < -1) {
  throw new Error(`invalid --ranked-options-probe-gap=${rankedOptionsProbeGap}`);
}
if (frontierSnapshotRank !== null && !Number.isSafeInteger(frontierSnapshotRank)) {
  throw new Error(`invalid --frontier-snapshot-rank=${frontierSnapshotRankArg}`);
}
if (!Number.isSafeInteger(frontierSnapshotBudget) || frontierSnapshotBudget < 0) {
  throw new Error(`invalid --frontier-snapshot-budget=${frontierSnapshotBudget}`);
}
if (!Number.isSafeInteger(deadEndAlternateRank) || deadEndAlternateRank < -1) {
  throw new Error(`invalid --dead-end-alternate-rank=${deadEndAlternateRank}`);
}
if (deadEndSearchSeeds.some((value) => !Number.isSafeInteger(value))) {
  throw new Error(`invalid --dead-end-search-seeds (expected comma-separated integer seeds)`);
}
if (wholeScaleValues.some((value) => !Number.isFinite(value) || value < 0.5 || value > 1.5 || value === 1)) {
  throw new Error(`invalid --whole-scale (expected comma-separated scales in [0.5, 1.5], excluding 1)`);
}
if (!Number.isSafeInteger(wholeScaleBases) || wholeScaleBases < 0) {
  throw new Error(`invalid --whole-scale-bases=${wholeScaleBases}`);
}
if (!Number.isSafeInteger(wholeScaleSuffixBudget) || wholeScaleSuffixBudget < 0) {
  throw new Error(`invalid --whole-scale-suffix-budget=${wholeScaleSuffixBudget}`);
}

const spec = applyJolt(sourceSpec, benchmarkPolicy.transform.joltMs);
const visited: Array<{ node: HandoffNode; key: LeafKey; event: HandoffNodeEvent }> = [];
const poolProbeRecords: HandoffPoolProbeRecord[] = [];
const capacityProbeRecords: HandoffCapacityProbeRecord[] = [];
const rankedOptionsProbeRecords: HandoffRankedOptionsProbeRecord[] = [];
const deadEndProbeRecords: HandoffDeadEndProbeRecord[] = [];
const frontierProbe = frontierProbeGap < 0 ? null : createFrontierProbeSummary(frontierProbeGap);
let frontierSnapshot: {
  node: HandoffNode;
  simFrames: number;
  deepestSeenGap: number;
  selectedGapIndex: number;
} | null = null;
let winner: HandoffNode | null = null;
setHandoffPoolProbeHook((record) => poolProbeRecords.push(record));
if (capacityProbe) setHandoffCapacityProbeHook((record) => capacityProbeRecords.push(record));
if (rankedOptionsProbeGap >= 0) {
  setHandoffRankedOptionsProbeHook((record) => {
    if (record.gapIndex === rankedOptionsProbeGap) rankedOptionsProbeRecords.push(record);
  });
}
if (frontierProbe !== null) setHandoffFrontierProbeHook((record) => frontierProbe.observe(record));
if (frontierProbeGap >= 0 && frontierSnapshotRank !== null) {
  setHandoffFrontierNodeProbeHook((record) => {
    if (frontierSnapshot !== null || record.selected.search.gapIndex !== frontierProbeGap) return;
    const selectedParentTrace = record.selected.rankTrace.slice(0, -1);
    const waiting = [...record.passFrontier, ...record.fallbackFrontier].find((node) => {
      const entering = node.rankTrace.at(-1);
      return node.search.gapIndex === record.selected.search.gapIndex &&
        sameRankTrace(node.rankTrace.slice(0, -1), selectedParentTrace) &&
        entering?.source === "pool" && entering.rank === frontierSnapshotRank;
    });
    if (waiting === undefined) return;
    frontierSnapshot = {
      node: waiting,
      simFrames: record.simFrames,
      deepestSeenGap: record.deepestSeenGap,
      selectedGapIndex: record.selected.search.gapIndex,
    };
  });
}
if (deadEndProbe) setHandoffDeadEndProbeHook((record) => deadEndProbeRecords.push(record));
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
setHandoffCapacityProbeHook(null);
setHandoffRankedOptionsProbeHook(null);
setHandoffFrontierProbeHook(null);
setHandoffFrontierNodeProbeHook(null);
setHandoffDeadEndProbeHook(null);
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
const targetRecord = visited.find((record) => record.node === targetNode);
if (targetRecord === undefined) {
  throw new Error(`could not locate target-node snapshot for gap ${targetNode.search.gapIndex}`);
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
const selectedReference = selectedCandidate ?? pool[0] ?? null;
const kinematicPlan = nextGap.targets.air === undefined || selectedReference === null
  ? null
  : planKinematicSupport({
    air: nextGap.targets.air,
    gapFrames: nextGap.endFrame - nextGap.startFrame,
    entrySpeed: parentTargetState.speed,
    exitSpeed: nextGap.targets.speed === undefined
      ? parentTargetState.speed
      : authoredSpeedToPx(nextGap.targets.speed),
    referenceLength: selectedReference.lines.reduce(
      (sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1),
      0,
    ),
  });
// The search may enter a boundary through a reuse or extra lane, so a freshly
// regenerated pool is not a reliable identity witness. Match the selected
// candidate directly against the pool captured while that prefix was scored.
const targetPoolProbe = [...poolProbeRecords].reverse().find((record) =>
  record.gapIndex === parent.search.gapIndex && selectedCandidate !== null &&
  record.candidates.some((candidate) => matchesProbeCandidate(selectedCandidate, candidate))
) ?? [...poolProbeRecords].reverse().find((record) =>
  record.gapIndex === parent.search.gapIndex
) ?? null;
const selectedProbeRank = selectedCandidate === null || targetPoolProbe === null
  ? null
  : targetPoolProbe.candidates.findIndex((candidate) => matchesProbeCandidate(selectedCandidate, candidate));
const rankedPool = targetPoolProbe?.candidates
  .filter((candidate) => candidate.handoffScore !== undefined)
  .map((candidate) => ({
    qualityRank: candidate.qualityRank,
    handoffScore: candidate.handoffScore!,
    admitted: candidate.admitted,
    cost: round(candidate.cost),
    readiness: candidate.readiness === null ? null : round(candidate.readiness),
    arrivalSpeed: candidate.arrivalSpeed === null ? null : round(candidate.arrivalSpeed),
    arrivalAngleDeg: candidate.arrivalAngleDeg === null ? null : round(candidate.arrivalAngleDeg),
    arrivalAir: candidate.arrivalAir === null ? null : round(candidate.arrivalAir),
    arrivalElevation: candidate.arrivalElevation === null ? null : round(candidate.arrivalElevation),
  }))
  .sort((a, b) => a.handoffScore - b.handoffScore || a.qualityRank - b.qualityRank) ?? null;
const scoreAmbiguity = summarizeScoreAmbiguity(rankedPool);
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
  const projectedOutgoing = projectOutgoingScorerGap(
    candidate,
    nextGap,
    setup.ctx.gapAxisTargets,
  );
  const readiness = projectedOutgoing === null
    ? null
    : scoreNextArcReadiness(
      projectedOutgoing.projection,
      nextGap,
      successorScorerGapAfter(nextGap, setup.gaps),
      setup.ctx.gapAxisTargets,
    );
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
    arrivalAir: nullableRound(
      projectedOutgoing?.achieved.air ?? null,
    ),
    arrivalSpeed: nullableRound(
      projectedOutgoing?.projection.boundary.incoming.speed ?? null,
    ),
    arrivalAngleDeg: nullableRound(
      projectedOutgoing?.projection.boundary.incoming.comAngleDeg ?? null,
    ),
    arrivalElevation: nullableRound(
      projectedOutgoing?.projection.elevation ?? null,
    ),
    releaseFrame: candidate.ballisticLaunch?.anchorFrame ?? null,
    releaseVx: nullableRound(candidate.ballisticLaunch?.state.vx ?? null),
    releaseVy: nullableRound(candidate.ballisticLaunch?.state.vy ?? null),
    releaseGrounded: candidate.ballisticLaunch?.groundedFrames ?? null,
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
    twoStepKnobOutcomeDepth,
    twoStepKnobOutcomeBranch,
    twoStepKnobOutcomeCoordinates,
  );
const twoStepKnobUniqueCandidates = twoStepKnobStudy === null
  ? []
  : twoStepKnobStudy.candidates.filter((row, index, rows) =>
    rows.findIndex((other) => sameLines(other.candidate.lines, row.candidate.lines)) === index,
  );
const twoStepKnobSuffixCandidates = twoStepKnobSuffixCoordinates.length === 0
  ? twoStepKnobUniqueCandidates
  : twoStepKnobUniqueCandidates.filter((row) =>
    twoStepKnobSuffixCoordinates.some((coordinate) =>
      coordinate.pitchDeg === row.pitchDeg && coordinate.rotateDeg === row.rotateDeg,
    ),
  );
const twoStepKnobSuffixes = twoStepKnobSuffixBudget === 0
  ? []
  : twoStepKnobSuffixCandidates.map((row) => ({
    baseRank: row.baseRank,
    pitchDeg: row.pitchDeg,
    rotateDeg: row.rotateDeg,
    suffix: resumeContactSupportSuffix(
      row.candidate,
      parentRecord,
      spec,
      seed,
      twoStepKnobSuffixBudget,
    ),
  }));
const twoStepKnobReport = twoStepKnobStudy === null
  ? null
  : (() => {
    const { candidates: _candidates, ...study } = twoStepKnobStudy;
    return study;
  })();
const contactSupportEvaluation = contactSupportBases === 0
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
    contactSupportSelect,
    rows.find((row) => row.selected)?.nextCandidates ?? 0,
    contactSupportNormalized,
  );
const contactSupportStudy = contactSupportEvaluation === null
  ? null
  : (() => {
    const { bestCandidate: _bestCandidate, ...study } = contactSupportEvaluation;
    return study;
  })();
const contactSupportSuffix = contactSupportEvaluation === null || contactSupportSuffixBudget === 0
  ? null
  : resumeContactSupportSuffix(
    contactSupportEvaluation.bestCandidate,
    parentRecord,
    spec,
    seed,
    contactSupportSuffixBudget,
  );
const wholeScaleEvaluation = wholeScaleValues.length === 0 || wholeScaleBases === 0
  ? null
  : evaluateWholeArcScale(
    parent.search,
    analysisPool.slice(0, wholeScaleBases),
    wholeScaleValues,
    predecessorGap,
    nextGap,
    setup,
    winningNode.searchSeed,
    nextCandidateCount,
  );
const wholeScaleStudy = wholeScaleEvaluation === null
  ? null
  : (() => {
    const { candidates: _candidates, ...study } = wholeScaleEvaluation;
    return study;
  })();
const wholeScaleSuffixes = wholeScaleEvaluation === null || wholeScaleSuffixBudget === 0
  ? []
  : wholeScaleEvaluation.candidates.map((row) => ({
    baseRank: row.baseRank,
    scale: row.scale,
    nextCandidates: row.nextCandidates,
    suffix: resumeContactSupportSuffix(
      row.candidate,
      parentRecord,
      spec,
      seed,
      wholeScaleSuffixBudget,
    ),
  }));
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
const catchGrid = (catchAttempts === 0 && catchControls.length === 0) || catchBase === null
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
    catchControls,
  );
const catchSuffix = catchGrid === null || catchGrid.bestCandidate === null || catchSuffixBudget === 0
  ? null
  : resumeCatchSuffix(
    catchGrid.bestCandidate,
    targetNode,
    targetRecord,
    spec,
    seed,
    catchSuffixBudget,
  );
const catchSuffixes = catchGrid === null || catchSuffixBudget === 0 || !catchSuffixAll
  ? []
  : catchGrid.bridgeCandidates.map((candidate, bridgeIndex) => ({
    bridgeIndex,
    suffix: resumeCatchSuffix(
      candidate,
      targetNode,
      targetRecord,
      spec,
      seed,
      catchSuffixBudget,
    ),
  }));
// The selected predecessor can come from an extra/reuse lane and therefore be
// absent from a freshly reconstructed normal pool. Include it explicitly: an
// equal-suffix oracle that only tests regenerated pool entries is not a fair
// comparison with the branch the compiler actually traversed.
const suffixCandidates = selectedCandidate !== null && !pool.includes(selectedCandidate)
  ? [selectedCandidate, ...pool]
  : pool;
const selectedSuffixCandidates = suffixRanks.length === 0
  ? suffixCandidates.slice(0, suffixTop)
  : suffixRanks.flatMap((rank) => {
    if (rank === -1) return selectedCandidate === null ? [] : [selectedCandidate];
    const candidate = pool[rank];
    return candidate === undefined ? [] : [candidate];
  }).filter((candidate, index, candidates) => candidates.indexOf(candidate) === index);
const suffixRows = suffixBudget === 0
  ? []
  : selectedSuffixCandidates.map((candidate, position) => runSuffix(candidate, position, searchSeed));
// Optional portfolio read: every row starts from the same retained parent and
// candidate, changing only the suffix search stream. It is evidence about
// outcome variability, never a production seed-selection policy.
const suffixSearchSeedRows = suffixBudget === 0 || suffixSearchSeeds.length === 0
  ? []
  : selectedSuffixCandidates.flatMap((candidate, position) =>
    suffixSearchSeeds.map((suffixSearchSeed) => runSuffix(candidate, position, suffixSearchSeed)),
  );
// A resumed suffix only supports a candidate-level conclusion if its control
// reproduces the actual selected prefix. Search policy can depend on traversal
// history, so a failed incumbent replay is missing evidence, not evidence that
// every alternative is worse. Fail before writing a plausible-looking oracle.
const sourceCompleted = checkpoint.report.terminus.reason === "endOfSpec" &&
  checkpoint.stats.gap_commits === setup.gaps.filter((gap) => gap.endsWithContact).length;
const selectedSuffix = suffixRows.find((row) => row.selected) ?? null;
if (suffixBudget > 0 && sourceCompleted && selectedSuffix !== null && !selectedSuffix.valid) {
  throw new Error(
    `suffix control did not replay selected prefix at gap ${parent.search.gapIndex} ` +
    `(deepest=${selectedSuffix.deepestGap}); refusing non-causal suffix comparison`,
  );
}
const selectedParentDeadEnds = deadEndProbeRecords
  .filter((record) =>
    selectedCandidate !== null &&
    record.node.search.prefixFits[parent.search.gapIndex] === selectedCandidate
  )
  .sort((a, b) => a.simFrames - b.simFrames || a.node.search.gapIndex - b.node.search.gapIndex);
const firstSelectedParentDeadEnd = selectedParentDeadEnds[0] ?? null;
const deadEndAlternate = deadEndAlternateRank < 0 || firstSelectedParentDeadEnd === null
  ? null
  : replayDeadEndAlternate(
    pool[deadEndAlternateRank] ?? null,
    parentRecord,
    spec,
    seed,
    Math.max(1, budget - firstSelectedParentDeadEnd.simFrames),
  );
const deadEndAlternateSearchSeeds = deadEndAlternateRank < 0 || firstSelectedParentDeadEnd === null
  ? []
  : deadEndSearchSeeds.map((restartSearchSeed) => ({
    restartSearchSeed,
    ...replayDeadEndAlternate(
      pool[deadEndAlternateRank] ?? null,
      parentRecord,
      spec,
      seed,
      Math.max(1, budget - firstSelectedParentDeadEnd.simFrames),
      restartSearchSeed,
    ),
  }));
const frontierSnapshotResume = frontierSnapshot === null || frontierSnapshotBudget === 0
  ? null
  : (() => {
    const resumed = compileHandoffFromSnapshot(
      spec,
      seed,
      snapshotHandoffNode(frontierSnapshot.node, parentRecord.key, parentRecord.event),
      { budget: frontierSnapshotBudget },
    );
    const score = scoreDriftReport(resumed.report, {
      totalFrames: Math.round(spec.duration * FPS),
    });
    return {
      capturedAtSimFrames: frontierSnapshot.simFrames,
      deepestSeenGap: frontierSnapshot.deepestSeenGap,
      selectedGapIndex: frontierSnapshot.selectedGapIndex,
      remainingBudgetAtCapture: Math.max(0, budget - frontierSnapshot.simFrames),
      resumeBudget: frontierSnapshotBudget,
      valid: score.contract_passed,
      score: round(score.score),
      hardFailures: score.hard_failures,
      contactsHit: resumed.report.contacts.filter((contact) => contact.status === "hit").length,
      contactsMissing: resumed.report.contacts.filter((contact) => contact.status === "missing").length,
      terminus: resumed.report.terminus,
      deepestGap: resumed.stats.handoff_deepest_seen_gap ?? null,
      firstCompletionFrame: resumed.stats.first_completion_frame ?? null,
    };
  })();

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
  catchControls,
  catchSuffixBudget,
  catchSuffixAll,
  suffixBudget,
  suffixRanks,
  suffixSearchSeeds,
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
  contactPhase: checkpoint.stats.contact_phase ?? null,
  kinematicSupport: checkpoint.stats.kinematic_support ?? null,
  compileLandingProbe: compileLandingProbeSummary,
  capacityProbe: capacityProbe
    ? summarizeCapacityProbe(capacityProbeRecords, {
      firstVisitedProgressFrame,
      totalContactGaps,
      budget,
      gaps: setup.gaps,
    })
    : null,
  rankedOptionsProbe: rankedOptionsProbeGap < 0
    ? null
    : {
      gap: rankedOptionsProbeGap,
      records: rankedOptionsProbeRecords,
    },
  frontierProbe: frontierProbe?.result() ?? null,
  frontierSnapshotResume,
  deadEndProbe: deadEndProbe
    ? {
      observations: deadEndProbeRecords.length,
      selectedParentObservations: selectedParentDeadEnds.length,
      firstSelectedParentDeadEnd: firstSelectedParentDeadEnd === null
        ? null
        : summarizeDeadEnd(firstSelectedParentDeadEnd, budget),
      firstSelectedParentDeadEnds: selectedParentDeadEnds
        .slice(0, 12)
        .map((record) => summarizeDeadEnd(record, budget)),
      alternateRank: deadEndAlternateRank < 0 ? null : deadEndAlternateRank,
      alternate: deadEndAlternate,
      alternateSearchSeeds: deadEndAlternateSearchSeeds,
    }
    : null,
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
  twoStepKnobOutcomeDepth,
  twoStepKnobOutcomeBranch,
  twoStepKnobOutcomeCoordinates,
  twoStepKnobSuffixBudget,
  twoStepKnobSuffixCoordinates,
  contactSupportBases,
  contactSupportWide,
  contactSupportSuffixBudget,
  contactSupportSelect,
  contactSupportNormalized,
  reuseGap,
  parentGap: parent.search.gapIndex,
  predecessorGapFrames: predecessorGap.endFrame - predecessorGap.startFrame,
  nextGapFrames: nextGap.endFrame - nextGap.startFrame,
  predecessorTargets: predecessorGap.targets,
  nextTargets: nextGap.targets,
  parentTargetState: {
    speed: round(parentTargetState.speed),
    angleDeg: round(parentTargetState.angleDeg),
    vx: round(parentTargetState.velocity.x),
    vy: round(parentTargetState.velocity.y),
  },
  kinematicPlan,
  parentSimFrames: parentRecord.event.simFrames,
  selectedRank,
  selectedSource: selectedTrace?.source ?? null,
  selectedSourceAxis: selectedTrace?.sourceAxis ?? null,
  selectedPoolRank,
  selectedProbeRank,
  probeMatchesSelected: selectedProbeRank !== null && selectedProbeRank >= 0,
  winningRankTrace: winningNode.rankTrace,
  rankedPool,
  scoreAmbiguity,
  exploredChildren,
  bridgingCandidates: rows.filter((row) => row.nextCandidates > 0).length,
  rows,
  twoStepKnobStudy: twoStepKnobReport,
  twoStepKnobSuffixes,
  contactSupportStudy,
  contactSupportSuffix,
  wholeScaleValues,
  wholeScaleBases,
  wholeScaleSuffixBudget,
  wholeScaleStudy,
  wholeScaleSuffixes,
  priorReuse,
  catchGrid,
  catchSuffix,
  catchSuffixes,
  suffixRows,
  suffixSearchSeedRows,
};
const outputJson = `${JSON.stringify(output, null, 2)}\n`;
if (outPath === undefined) {
  process.stdout.write(outputJson);
} else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, outputJson);
  console.error(`rows -> ${outPath}`);
}

function runSuffix(candidate: Candidate, position: number, suffixSearchSeed: number) {
  const rank = pool.indexOf(candidate);
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
    { budget: suffixBudget, searchSeed: suffixSearchSeed },
  );
  const score = scoreDriftReport(resumed.report, {
    totalFrames: Math.round(spec.duration * FPS),
  });
  return {
    position,
    rank,
    selected: candidate === selectedCandidate,
    sampleAttempt: candidate.sampleAttempt ?? null,
    searchSeed: suffixSearchSeed,
    valid: score.contract_passed,
    score: round(score.score),
    hardFailures: score.hard_failures,
    contactsHit: resumed.report.contacts.filter((contact) => contact.status === "hit").length,
    contactsMissing: resumed.report.contacts.filter((contact) => contact.status === "missing").length,
    missingContactIndices: resumed.report.contacts
      .flatMap((contact, index) => contact.status === "missing" ? [index] : []),
    terminus: resumed.report.terminus,
    deepestGap: resumed.stats.handoff_deepest_seen_gap ?? null,
    firstCompletionFrame: resumed.stats.first_completion_frame ?? null,
  };
}

/**
 * Streaming observation summary for one frontier depth. Keeping it streaming is
 * deliberate: a diagnostic must not turn a 500k compile into an archive-sized
 * allocation simply by retaining every frontier snapshot.
 */
function createFrontierProbeSummary(gapIndex: number): {
  observe(record: HandoffFrontierProbeRecord): void;
  result(): unknown;
} {
  let observations = 0;
  let precompletionObservations = 0;
  const waitingByRank = new Map<number | null, {
    observations: number;
    precompletionObservations: number;
    firstSimFrames: number;
    maxDeepestLead: number;
  }>();
  const selectionsByRank = new Map<number | null, {
    observations: number;
    precompletionObservations: number;
    firstSimFrames: number;
  }>();
  const observe = (record: HandoffFrontierProbeRecord): void => {
    observations++;
    if (!record.hasCompletion) precompletionObservations++;
    const waiting = new Set(
      [...record.passFrontier, ...record.fallbackFrontier]
        .filter((node) => node.gapIndex === gapIndex)
        .map((node) => node.enteringRank),
    );
    for (const rank of waiting) {
      const row = waitingByRank.get(rank) ?? {
        observations: 0,
        precompletionObservations: 0,
        firstSimFrames: record.simFrames,
        maxDeepestLead: 0,
      };
      row.observations++;
      if (!record.hasCompletion) row.precompletionObservations++;
      row.maxDeepestLead = Math.max(row.maxDeepestLead, record.deepestSeenGap - gapIndex);
      waitingByRank.set(rank, row);
    }
    if (record.selected.gapIndex === gapIndex) {
      const rank = record.selected.enteringRank;
      const row = selectionsByRank.get(rank) ?? {
        observations: 0,
        precompletionObservations: 0,
        firstSimFrames: record.simFrames,
      };
      row.observations++;
      if (!record.hasCompletion) row.precompletionObservations++;
      selectionsByRank.set(rank, row);
    }
  };
  const result = () => {
    const ordered = <T extends { observations: number }>(rows: Map<number | null, T>) =>
      [...rows.entries()]
        .map(([rank, row]) => ({ rank, ...row }))
        .sort((a, b) => b.observations - a.observations || (a.rank ?? Infinity) - (b.rank ?? Infinity));
    return {
      gapIndex,
      selectionObservations: observations,
      precompletionSelectionObservations: precompletionObservations,
      waitingByEnteringRank: ordered(waitingByRank),
      selectedByEnteringRank: ordered(selectionsByRank),
    };
  };
  return { observe, result };
}

function summarizeDeadEnd(record: HandoffDeadEndProbeRecord, budget: number) {
  return {
    gapIndex: record.node.search.gapIndex,
    simFrames: record.simFrames,
    remainingBudget: Math.max(0, budget - record.simFrames),
    hasCompletion: record.hasCompletion,
    deepestSeenGap: record.deepestSeenGap,
    skippedContacts: record.node.skippedContacts,
  };
}

function sameRankTrace(
  left: readonly { rank: number; source: string; sourceAxis?: string }[],
  right: readonly { rank: number; source: string; sourceAxis?: string }[],
): boolean {
  return left.length === right.length && left.every((entry, index) => {
    const other = right[index];
    return entry.rank === other.rank && entry.source === other.source && entry.sourceAxis === other.sourceAxis;
  });
}

/**
 * Counterfactual only: restart one sibling with exactly the budget that was
 * still available when the selected path had no viable expansion. This does
 * not claim a production policy; it tests whether a dead-end repair could be
 * physically affordable before designing one.
 */
function replayDeadEndAlternate(
  candidate: Candidate | null,
  parentRecord: { node: HandoffNode; key: LeafKey; event: HandoffNodeEvent },
  spec: Spec,
  seed: number,
  suffixBudget: number,
  searchSeed?: number,
) {
  if (candidate === null) return null;
  const childNode: HandoffNode = {
    ...parentRecord.node,
    search: extendNodeCached(parentRecord.node.search, candidate),
    deferExpansion: false,
    rankTrace: [...parentRecord.node.rankTrace, { rank: -3, source: "pool" }],
  };
  const resumed = compileHandoffFromSnapshot(
    spec,
    seed,
    snapshotHandoffNode(childNode, parentRecord.key, parentRecord.event),
    { budget: suffixBudget, ...(searchSeed === undefined ? {} : { searchSeed }) },
  );
  const score = scoreDriftReport(resumed.report, {
    totalFrames: Math.round(spec.duration * FPS),
  });
  return {
    suffixBudget,
    searchSeed: searchSeed ?? seed,
    valid: score.contract_passed,
    score: round(score.score),
    hardFailures: score.hard_failures,
    contactsHit: resumed.report.contacts.filter((contact) => contact.status === "hit").length,
    contactsMissing: resumed.report.contacts.filter((contact) => contact.status === "missing").length,
    missingContactIndices: resumed.report.contacts
      .flatMap((contact, index) => contact.status === "missing" ? [index] : []),
    terminus: resumed.report.terminus,
    deepestGap: resumed.stats.handoff_deepest_seen_gap ?? null,
    firstCompletionFrame: resumed.stats.first_completion_frame ?? null,
  };
}

function resumeCatchSuffix(
  candidate: Candidate,
  targetNode: HandoffNode,
  targetRecord: { node: HandoffNode; key: LeafKey; event: HandoffNodeEvent },
  spec: Spec,
  seed: number,
  suffixBudget: number,
) {
  const childNode: HandoffNode = {
    ...targetNode,
    search: extendNodeCached(targetNode.search, candidate),
    deferExpansion: false,
    rankTrace: [...targetNode.rankTrace, { rank: -4, source: "pool" }],
  };
  const resumed = compileHandoffFromSnapshot(
    spec,
    seed,
    snapshotHandoffNode(childNode, targetRecord.key, targetRecord.event),
    { budget: suffixBudget },
  );
  const score = scoreDriftReport(resumed.report, {
    totalFrames: Math.round(spec.duration * FPS),
  });
  return {
    suffixBudget,
    valid: score.contract_passed,
    score: round(score.score),
    hardFailures: score.hard_failures,
    contactsHit: resumed.report.contacts.filter((contact) => contact.status === "hit").length,
    contactsMissing: resumed.report.contacts.filter((contact) => contact.status === "missing").length,
    missingContactIndices: resumed.report.contacts
      .flatMap((contact, index) => contact.status === "missing" ? [index] : []),
    terminus: resumed.report.terminus,
    deepestGap: resumed.stats.handoff_deepest_seen_gap ?? null,
    firstCompletionFrame: resumed.stats.first_completion_frame ?? null,
  };
}

function summarizeScoreAmbiguity(
  ranked: Array<{ handoffScore: number }> | null,
): {
  measured: boolean;
  candidates: number;
  withinHalfPercentOfBest: number;
  topThreeRelativeSpread: number | null;
} {
  if (ranked === null || ranked.length === 0) {
    return {
      measured: false,
      candidates: 0,
      withinHalfPercentOfBest: 0,
      topThreeRelativeSpread: null,
    };
  }
  const best = ranked[0].handoffScore;
  const scale = Math.max(Math.abs(best), 1e-12);
  const relativeDistance = (score: number) => (score - best) / scale;
  return {
    measured: true,
    candidates: ranked.length,
    withinHalfPercentOfBest: ranked.filter((candidate) =>
      relativeDistance(candidate.handoffScore) <= 0.005
    ).length,
    topThreeRelativeSpread: ranked.length < 3
      ? null
      : round(relativeDistance(ranked[Math.min(2, ranked.length - 1)].handoffScore)),
  };
}

function summarizeCapacityProbe(
  records: HandoffCapacityProbeRecord[],
  context: {
    firstVisitedProgressFrame: number | null;
    totalContactGaps: number;
    budget: number;
    gaps: readonly Gap[];
  },
) {
  const ordered = [...records].sort((a, b) => a.simFrames - b.simFrames || a.gapIndex - b.gapIndex);
  const deficient = ordered.filter((record) => record.capacity < 16);
  const behindSchedule = ordered.filter((record) => isBehindSchedule(record, context));
  const behindScheduleDeficient = behindSchedule.filter((record) => record.capacity < 16);
  return {
    observations: ordered.length,
    deficientObservations: deficient.length,
    behindScheduleObservations: behindSchedule.length,
    behindScheduleDeficientObservations: behindScheduleDeficient.length,
    firstDeficit: deficient[0] ?? null,
    firstBehindScheduleDeficit: behindScheduleDeficient[0] ?? null,
    lowestCapacity: ordered.length === 0 ? null : Math.min(...ordered.map((record) => record.capacity)),
    firstDeficits: deficient.slice(0, 12),
  };
}

/** Delegates to the production online controller's measured-pace predicate. */
function isBehindSchedule(
  record: HandoffCapacityProbeRecord,
  context: {
    firstVisitedProgressFrame: number | null;
    totalContactGaps: number;
    budget: number;
    gaps: readonly Gap[];
  },
): boolean {
  const first = context.firstVisitedProgressFrame;
  const remaining = context.gaps
    .slice(record.gapIndex)
    .filter((gap) => gap.endsWithContact).length;
  const completed = context.totalContactGaps - remaining;
  return first !== null && isOnlineTraversalBehindSchedule({
    firstProgressFrame: first,
    simFrames: record.simFrames,
    targetBudget: context.budget,
    completedContacts: completed,
    totalContacts: context.totalContactGaps,
  });
}

function matchesProbeCandidate(candidate: Candidate, probe: HandoffPoolProbeRecord["candidates"][number]): boolean {
  const lineLength = candidate.lines.reduce(
    (sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1),
    0,
  );
  return probe.lineCount === candidate.lines.length &&
    Math.abs(probe.lineLength - lineLength) < 1e-6 &&
    Math.abs(probe.cost - candidate.cost) < 1e-9;
}

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
    // The root is evaluated once before its start alternatives are expanded and
    // again for each concrete start state. A suffix snapshot must retain the
    // latter: the synthetic root has no resolved start and cannot be resumed.
    if (
      ancestor === null ||
      node.search.gapIndex > ancestor.node.search.gapIndex ||
      (
        node.search.gapIndex === ancestor.node.search.gapIndex &&
        node.startExpanded && !ancestor.node.startExpanded
      )
    ) {
      ancestor = record;
    }
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

type CatchDescriptor = {
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
};

type CatchBridge = CatchDescriptor & {
  nextCandidates: number;
  transition: ReturnType<typeof transitionState>;
  candidate: Candidate;
};

type CatchNearMiss = CatchDescriptor & {
  detectorSlackFrames: number | null;
  transition: ReturnType<typeof transitionState>;
};

function sampleCatchManifold(
  node: SearchNode,
  gap: Gap,
  setup: ReturnType<typeof buildSetup>,
  attempts: number,
  fixedPhase: number,
  searchSeed: number,
  candidateCount: number,
  templateGrid: boolean,
  normalizedControls: readonly CatchControl[],
): {
  viable: number;
  detectorReady: number;
  bridging: number;
  /** Internal only: the best bridge retained for an optional equal-budget suffix read. */
  bestCandidate: Candidate | null;
  /** Internal only: ranked bridges for an all-bridge equal-budget suffix read. */
  bridgeCandidates: readonly Candidate[];
  gates: Record<string, number>;
  landingProbe: ReturnType<typeof summarizeLandingProbe>;
  best: CatchDescriptor[];
  nearMisses: Array<Omit<CatchNearMiss, "candidate">>;
  bridges: Array<Omit<CatchBridge, "candidate">>;
} {
  const targetState = getCandidateProbe(node.prefixEngine, gap, setup.ctx).targetState;
  const phaseStates = Array.from({ length: 8 }, (_, phaseFrames) => {
    const rider = getRiderMetered(node.prefixEngine, gap.endFrame - phaseFrames);
    return readTargetStateFromRider(rider, targetState.sledX, targetState.sledY);
  });
  const axisMeasureEnd = axisLookaheadEndFrame(gap, setup.ctx.allContactFrames);
  const viable = [];
  const bridges: CatchBridge[] = [];
  const nearMisses: CatchNearMiss[] = [];
  let detectorReady = 0;
  enableLandingWindowProbe();
  drainLandingWindowProbe();
  const gateBefore = snapshotArcPlacementStats().by_sample_mode.normal;
  const controls = normalizedControls.length > 0
    ? normalizedControls.map((control, attempt) => {
      const placementState = phaseStates[control.phaseFrames];
      return {
        attempt,
        phaseFrames: control.phaseFrames,
        placementState,
        approachAngleDeg: placementState.angleDeg + control.approachDeltaDeg,
        turnDeg: control.turnDeg,
        normalOffset: control.normalOffsetPx,
        tangentOffset: placementState.speed * control.tangentFrames,
        preLength: placementState.speed * control.preFrames,
        postLength: placementState.speed * control.postFrames,
      };
    })
    : templateGrid
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
    clearImpactTemplateMarker();
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
    nearMisses.push({
      ...descriptor,
      detectorSlackFrames: transition.lastGroundedBeforeTarget === null
        ? null
        : latestGrounded - transition.lastGroundedBeforeTarget,
      transition,
    });
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
      candidate: fit,
    });
  }
  const gates = counterDelta(
    gateBefore,
    snapshotArcPlacementStats().by_sample_mode.normal,
  );
  const landingProbe = summarizeLandingProbe(drainLandingWindowProbe().records);
  disableLandingWindowProbe();
  viable.sort((a, b) => a.cost - b.cost || a.attempt - b.attempt);
  nearMisses.sort((a, b) =>
    (b.detectorSlackFrames ?? Number.NEGATIVE_INFINITY) -
      (a.detectorSlackFrames ?? Number.NEGATIVE_INFINITY) ||
    a.cost - b.cost || a.attempt - b.attempt
  );
  bridges.sort((a, b) => b.nextCandidates - a.nextCandidates || a.cost - b.cost || a.attempt - b.attempt);
  const result = {
    viable: viable.length,
    detectorReady,
    bridging: bridges.length,
    gates,
    landingProbe,
    bestCandidate: bridges[0]?.candidate ?? null,
    best: viable.slice(0, 20),
    nearMisses: nearMisses.slice(0, 40),
    bridges: bridges.slice(0, 40).map(({ candidate: _candidate, ...bridge }) => bridge),
  };
  // Candidate lines are needed by the optional suffix read but must not bloat
  // the self-contained report: their public descriptors above are sufficient.
  Object.defineProperty(result, "bridgeCandidates", {
    value: bridges.slice(0, 40).map(({ candidate }) => candidate),
    enumerable: false,
  });
  return result as typeof result & { bridgeCandidates: readonly Candidate[] };
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
  /** Consecutive airborne frames strictly before the target frame. */
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
  geometryHash: string;
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
    // IDs are intentionally excluded: alternatives are self-contained and
    // receive the same line-ID range only when selected. This hash answers the
    // actual branch-diversity question, namely whether two proposals have the
    // same physical support geometry.
    geometryHash: createHash("sha256")
      .update(JSON.stringify(lines.map(({ x1, y1, x2, y2 }) => [x1, y1, x2, y2])))
      .digest("hex"),
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
    candidate.ballisticLaunch?.state.vx ?? 0,
    candidate.ballisticLaunch?.state.vy ?? 0,
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
  select: "coverage" | "cheapest-improving",
  incumbentNextCandidates: number,
  normalized: boolean,
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
    supportLengthPx: number;
    exitAngleDeg: number;
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
    supportLengthPx: number;
    exitAngleDeg: number;
    currentCost: number;
    transition: ReturnType<typeof transitionState>;
    contactTrace: Array<{ frame: number; lineIds: number[] }>;
  }>;
  bestCandidate: Candidate | null;
} {
  const probe = getCandidateProbe(parent.prefixEngine, gap, setup.ctx);
  const speed = Math.max(1, probe.targetState.speed);
  const supportFrames = wide
    ? [
      0.35, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3,
      4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160, 192, 208, 224,
      232, 240, 248, 256, 260, 262, 264, 266, 268, 272, 280,
    ]
    : [0.5, 0.75, 1, 1.25, 1.5, 2];
  const supportLengths = normalized && nextGap.targets.air !== undefined && bases[0] !== undefined
    ? (() => {
      const plan = planKinematicSupport({
        air: nextGap.targets.air,
        gapFrames: nextGap.endFrame - nextGap.startFrame,
        entrySpeed: speed,
        exitSpeed: nextGap.targets.speed === undefined
          ? speed
          : authoredSpeedToPx(nextGap.targets.speed),
        referenceLength: bases[0].candidate.lines.reduce(
          (sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1),
          0,
        ),
      });
      return [0.65, 0.85, 1.05].map((scale) => plan.targetLength * scale);
    })()
    : supportFrames.map((frames) => speed * frames);
  const exitDeltas = normalized
    ? [-4, 0, 8]
    : wide
    ? [-30, -24, -20, -16, -12, -8, -4, 0, 4, 8, 10, 12, 12.5, 13, 13.5, 14, 16, 18, 20, 24, 30]
    : [0];
  let trials = 0;
  let currentValid = 0;
  let earliestLastGrounded: number | null = null;
  let maximumAirborneRun = 0;
  const successes: Array<{
    baseRank: number;
    supportFrames: number;
    exitDeltaDeg: number;
    jointIndex: number;
    jointDistancePx: number;
    currentCost: number;
    nextCandidates: number;
    transition: ReturnType<typeof transitionState>;
    candidate: Candidate;
  }> = [];
  const validExamples = [];
  for (const { candidate, poolRank } of bases) {
    const joint = closestContactJoint(candidate.lines, probe.targetState.sledX, probe.targetState.sledY);
    if (joint === null) continue;
    for (const supportLengthPx of supportLengths) {
      for (const exitDeltaDeg of exitDeltas) {
        const frames = supportLengthPx / speed;
        trials++;
        const lines = contactSupportLines(
          candidate.lines,
          joint.index,
          supportLengthPx,
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
        const exitAngleDeg = Math.atan2(
          lines.at(-1)!.y2 - lines.at(-1)!.y1,
          lines.at(-1)!.x2 - lines.at(-1)!.x1,
        ) * 180 / Math.PI;
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
          supportLengthPx: round(supportLengthPx),
          exitAngleDeg: round(exitAngleDeg),
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
          supportLengthPx: round(supportLengthPx),
          exitAngleDeg: round(exitAngleDeg),
          currentCost: round(fit.cost),
          nextCandidates: continuations.length,
          transition,
          candidate: fit,
        });
      }
    }
  }
  const selectionPool = select === "cheapest-improving"
    ? successes.filter((row) => row.nextCandidates > incumbentNextCandidates)
    : successes;
  const bestCandidate = [...selectionPool].sort((a, b) =>
    select === "cheapest-improving"
      ? a.currentCost - b.currentCost ||
        b.nextCandidates - a.nextCandidates ||
        b.transition.airborneRunAtTarget - a.transition.airborneRunAtTarget
      : b.nextCandidates - a.nextCandidates ||
        b.transition.airborneRunAtTarget - a.transition.airborneRunAtTarget ||
        a.currentCost - b.currentCost
  )[0]?.candidate ?? null;
  return {
    trials,
    currentValid,
    earliestLastGrounded,
    maximumAirborneRun,
    successes: successes.map(({ candidate: _candidate, ...row }) => row),
    validExamples: validExamples
      .sort((a, b) =>
        (a.transition.lastGroundedBeforeTarget ?? Infinity) -
          (b.transition.lastGroundedBeforeTarget ?? Infinity) ||
        a.currentCost - b.currentCost
      )
      .slice(0, 24),
    bestCandidate,
  };
}

function resumeContactSupportSuffix(
  candidate: Candidate | null,
  parentRecord: { node: HandoffNode; key: LeafKey; event: HandoffNodeEvent },
  spec: Spec,
  seed: number,
  suffixBudget: number,
) {
  if (candidate === null) return null;
  const childNode: HandoffNode = {
    ...parentRecord.node,
    search: extendNodeCached(parentRecord.node.search, candidate),
    deferExpansion: false,
    rankTrace: [...parentRecord.node.rankTrace, { rank: -2, source: "pool" }],
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
    valid: score.contract_passed,
    score: round(score.score),
    hardFailures: score.hard_failures,
    contactsHit: resumed.report.contacts.filter((contact) => contact.status === "hit").length,
    contactsMissing: resumed.report.contacts.filter((contact) => contact.status === "missing").length,
    terminus: resumed.report.terminus,
    deepestGap: resumed.stats.handoff_deepest_seen_gap ?? null,
    firstCompletionFrame: resumed.stats.first_completion_frame ?? null,
  };
}

/**
 * Observation-only whole-arc length coordinate. Each scale preserves the
 * candidate's entry pose and internal turn profile, then passes through the
 * ordinary exact gate and ordinary next-pool generator. Suffixes are replayed
 * separately by the caller; immediate continuation count is reported only as
 * a descriptive coordinate, never as a selector claim.
 */
function evaluateWholeArcScale(
  parent: SearchNode,
  bases: Array<{ candidate: Candidate; poolRank: number }>,
  scales: readonly number[],
  gap: Gap,
  nextGap: Gap,
  setup: ReturnType<typeof buildSetup>,
  searchSeed: number,
  candidateCount: number,
): {
  trials: number;
  currentValid: number;
  rows: Array<{
    baseRank: number;
    scale: number;
    currentCost: number;
    nextCandidates: number;
    achieved: AxisValues;
    projectedOutgoing: ReturnType<typeof projectOutgoingScorerGap>;
    readiness: ReturnType<typeof scoreNextArcReadiness> | null;
    transition: ReturnType<typeof transitionState>;
  }>;
  candidates: Array<{ baseRank: number; scale: number; nextCandidates: number; candidate: Candidate }>;
} {
  const probe = getCandidateProbe(parent.prefixEngine, gap, setup.ctx);
  const rows: Array<{
    baseRank: number;
    scale: number;
    currentCost: number;
    nextCandidates: number;
    transition: ReturnType<typeof transitionState>;
  }> = [];
  const candidates: Array<{ baseRank: number; scale: number; nextCandidates: number; candidate: Candidate }> = [];
  let trials = 0;
  let currentValid = 0;
  for (const { candidate, poolRank } of bases) {
    for (const scale of scales) {
      trials++;
      const lines = scaleArcLines(candidate.lines, scale)
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
      currentValid++;
      const child = advanceToGap(extendNodeCached(parent, fit), setup.gaps, nextGap.index);
      const continuations = getCandidatesSorted(
        child,
        setup.gaps,
        setup.ctx,
        searchSeed,
        candidateCount,
      );
      const transition = transitionState(child.prefixEngine, gap, nextGap);
      const projectedOutgoing = projectOutgoingScorerGap(
        fit,
        nextGap,
        setup.ctx.gapAxisTargets,
      );
      rows.push({
        baseRank: poolRank,
        scale: round(scale),
        currentCost: round(fit.cost),
        nextCandidates: continuations.length,
        achieved: { ...fit.achieved },
        projectedOutgoing,
        readiness: projectedOutgoing === null
          ? null
          : scoreNextArcReadiness(
            projectedOutgoing.projection,
            nextGap,
            successorScorerGapAfter(nextGap, setup.gaps),
            setup.ctx.gapAxisTargets,
          ),
        transition,
      });
      candidates.push({ baseRank: poolRank, scale, nextCandidates: continuations.length, candidate: fit });
    }
  }
  return { trials, currentValid, rows, candidates };
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

function contactSupportLines(
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
  const startAngle = Math.atan2(source.y2 - source.y1, source.x2 - source.x1);
  const turn = exitDeltaDeg * Math.PI / 180;
  const angle = startAngle + turn;
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
  outcomeDepth: number,
  outcomeBranch: number,
  outcomeCoordinates: Array<{ pitchDeg: number; rotateDeg: number }>,
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
    boundedOutcome: BoundedGreedyOutcome | null;
  }>;
  candidates: Array<{
    baseRank: number;
    pitchDeg: number;
    rotateDeg: number;
    candidate: Candidate;
  }>;
} {
  let trials = 0;
  let validCurrent = 0;
  const successes = [];
  const candidates: Array<{
    baseRank: number;
    pitchDeg: number;
    rotateDeg: number;
    candidate: Candidate;
  }> = [];
  const probe = getCandidateProbe(parent.prefixEngine, gap, setup.ctx);
  const pitches = wide ? [-16, -12, -8, -4, 0, 4, 8, 12, 16] : [-8, -4, 0, 4, 8];
  const rotations = wide ? [-6, -3, -2.5, 0, 3, 6] : [-3, 0, 3];
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
        candidates.push({ baseRank: poolRank, pitchDeg, rotateDeg, candidate: fit });
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
            frame: fit.ballisticLaunch?.anchorFrame ?? null,
            vx: fit.ballisticLaunch === undefined
              ? null
              : round(fit.ballisticLaunch.state.vx),
            vy: fit.ballisticLaunch === undefined
              ? null
              : round(fit.ballisticLaunch.state.vy),
            grounded: fit.ballisticLaunch?.groundedFrames ?? null,
          },
          coverage,
          boundedOutcome: outcomeDepth === 0 ||
              (outcomeCoordinates.length > 0 && !hasKnobCoordinate(
                outcomeCoordinates,
                pitchDeg,
                rotateDeg,
              ))
            ? null
            : boundedGreedyOutcome(
              advanceToGap(extendNodeCached(parent, fit), setup.gaps, nextGap.index),
              setup.gaps,
              setup.ctx,
              searchSeed,
              candidateCount,
              outcomeDepth,
              outcomeBranch,
            ),
        });
      }
    }
  }
  return { trials, validCurrent, successes, candidates };
}

type BoundedGreedyOutcome = {
  /** Number of subsequently committed contact gaps before the horizon or a dead end. */
  contacts: number;
  /** Number of exact generator paths that survived through the bounded horizon. */
  survivors: number;
  /** True when every retained generator path had no admissible next fit. */
  deadEnd: boolean;
  /** The shared objective-leaf value after the bounded exact prefix. */
  value: number;
};

/**
 * Observation-only, bounded exact continuation. This is deliberately the
 * existing forward evaluator's bounded generator tree, not a new selector: it
 * lets a phase-coordinate study ask whether a coordinate remains viable
 * beyond the immediate two-contact coverage readout without retaining a full
 * suffix compiler for every grid point.
 */
function boundedGreedyOutcome(
  start: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  sampleWidth: number,
  depth: number,
  branch: number,
): BoundedGreedyOutcome {
  let frontier = [start];
  let contacts = 0;
  while (contacts < depth) {
    const next: SearchNode[] = [];
    for (let search of frontier) {
      while (search.gapIndex < gaps.length && !gaps[search.gapIndex].endsWithContact) {
        search = extendNodeCached(search, null);
      }
      if (search.gapIndex >= gaps.length) {
        next.push(search);
        continue;
      }
      // Preserve the ordinary sampled pool, then apply the certificate's
      // retained-width bound to its already-ranked entries. Passing `branch`
      // to the generator would change the low-discrepancy samples themselves.
      for (const candidate of getCandidatesSorted(search, gaps, ctx, seed, sampleWidth).slice(0, branch)) {
        next.push(extendNodeCached(search, candidate));
      }
    }
    if (next.length === 0) {
      const best = frontier.reduce((value, search) => Math.max(
        value,
        objectiveLeafValue(search, gaps, ctx.durationFrames),
      ), -Infinity);
      return {
        contacts,
        survivors: 0,
        deadEnd: true,
        value: round(best),
      };
    }
    frontier = next;
    contacts++;
  }
  return {
    contacts,
    survivors: frontier.length,
    deadEnd: false,
    value: round(frontier.reduce((value, search) => Math.max(
      value,
      objectiveLeafValue(search, gaps, ctx.durationFrames),
    ), -Infinity)),
  };
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
  templates: number;
  survivalFailed: number;
  acceptedAtW: Record<string, number>;
  offsets: Record<string, number>;
  byGap: Record<string, {
    total: number;
    templates: number;
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
      templates: subset.filter((record) => record.isTemplate).length,
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
    templates: overall.templates,
    survivalFailed: overall.survivalFailed,
    acceptedAtW: overall.acceptedAtW,
    offsets: overall.offsets,
    byGap,
  };
}

/**
 * A diagnostic-only control in rider-relative units. Keeping the timing and
 * lengths in frames makes a witness portable across entry speeds; it does not
 * make it a production proposal.
 */
type CatchControl = {
  phaseFrames: number;
  approachDeltaDeg: number;
  turnDeg: number;
  normalOffsetPx: number;
  tangentFrames: number;
  preFrames: number;
  postFrames: number;
};

function parseCatchControls(raw: string | undefined): CatchControl[] {
  if (raw === undefined) return [];
  let values: unknown;
  try {
    values = JSON.parse(raw);
  } catch {
    throw new Error("invalid --catch-controls (expected a JSON array)");
  }
  if (!Array.isArray(values) || values.length === 0 || values.length > 64) {
    throw new Error("invalid --catch-controls (expected 1..64 controls)");
  }
  return values.map((value, index) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`invalid --catch-controls[${index}] (expected object)`);
    }
    const record = value as Record<string, unknown>;
    const phaseFrames = Number(record.phaseFrames);
    const approachDeltaDeg = Number(record.approachDeltaDeg);
    const turnDeg = Number(record.turnDeg);
    const normalOffsetPx = Number(record.normalOffsetPx);
    const tangentFrames = Number(record.tangentFrames);
    const preFrames = Number(record.preFrames);
    const postFrames = Number(record.postFrames);
    if (
      !Number.isSafeInteger(phaseFrames) || phaseFrames < 0 || phaseFrames > 7 ||
      !Number.isFinite(approachDeltaDeg) || Math.abs(approachDeltaDeg) > 90 ||
      !Number.isFinite(turnDeg) || Math.abs(turnDeg) > 90 ||
      !Number.isFinite(normalOffsetPx) || Math.abs(normalOffsetPx) > 40 ||
      !Number.isFinite(tangentFrames) || Math.abs(tangentFrames) > 4 ||
      !Number.isFinite(preFrames) || preFrames <= 0 || preFrames > 8 ||
      !Number.isFinite(postFrames) || postFrames <= 0 || postFrames > 24
    ) {
      throw new Error(`invalid --catch-controls[${index}] values`);
    }
    return {
      phaseFrames,
      approachDeltaDeg,
      turnDeg,
      normalOffsetPx,
      tangentFrames,
      preFrames,
      postFrames,
    };
  });
}

function parseKnobCoordinates(
  raw: string | undefined,
  name: string,
): Array<{ pitchDeg: number; rotateDeg: number }> {
  return (raw ?? "")
    .split(",")
    .filter((value) => value.length > 0)
    .map((value) => {
      const [pitchRaw, rotateRaw, extra] = value.split(":");
      const pitchDeg = Number(pitchRaw);
      const rotateDeg = Number(rotateRaw);
      if (extra !== undefined || !Number.isFinite(pitchDeg) || !Number.isFinite(rotateDeg)) {
        throw new Error(`invalid --${name} entry "${value}" (expected pitch:rotate)`);
      }
      return { pitchDeg, rotateDeg };
    });
}

function hasKnobCoordinate(
  coordinates: Array<{ pitchDeg: number; rotateDeg: number }>,
  pitchDeg: number,
  rotateDeg: number,
): boolean {
  return coordinates.some((coordinate) =>
    coordinate.pitchDeg === pitchDeg && coordinate.rotateDeg === rotateDeg,
  );
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function sameLines(left: Candidate["lines"], right: Candidate["lines"]): boolean {
  return left.length === right.length && left.every((line, index) => {
    const other = right[index];
    return line.id === other.id && line.x1 === other.x1 && line.y1 === other.y1 &&
      line.x2 === other.x2 && line.y2 === other.y2;
  });
}
