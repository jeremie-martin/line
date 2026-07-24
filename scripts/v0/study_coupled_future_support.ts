/**
 * Exact two-contact construction oracle.
 *
 * Starting at a frozen production prefix, pair a normal current catch with a
 * normal catch generated from its child state, then install both line groups at
 * once. The current target and the following target must each pass the ordinary
 * candidate gate with no additional geometry at the second target. This is an
 * availability study, not a compiler policy: it establishes whether a physical
 * coupled fragment exists before a macro candidate or selector is designed.
 *
 * LR_ENGINE=wasm node --expose-gc ./node_modules/tsx/dist/cli.mjs \
 *   scripts/v0/study_coupled_future_support.ts --case=frontier_dense_recovery \
 *   --seed=24 --budget=250000 --parent-gap=50 --out=generated/studies/FILE.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { detect, extractRawTrajectory } from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import { applyJolt } from "../produce/seed.ts";
import { axisLookaheadEndFrame, countOffBeatLandings, tryCandidateLines } from "./core/candidate.ts";
import {
  contactLineIdsAt,
  effectiveAxes,
  isAuthoredContactEvent,
  sampleGapTargets,
  sliceTimeline,
} from "./core/substrate.ts";
import {
  compileHandoff,
  compileHandoffFromSnapshot,
  objectiveLeafValue,
  setForwardEvalContext,
  snapshotHandoffNode,
  type HandoffNode,
  type HandoffNodeEvent,
} from "./optimizer/handoff.ts";
import { extendNodeCached, getCandidatesSorted, type SearchNode } from "./optimizer/node.ts";
import { frontierReadinessFromFit } from "./optimizer/objective.ts";
import {
  aimTopKBasesEffective,
  makeEnumAimedCandidates,
  sortCandidatesByQuality,
} from "./optimizer/aim.ts";
import type { Candidate, SpecContext } from "./optimizer/sample.ts";
import { scoreDriftReport } from "./score.ts";
import { CALIB, FPS, secToFrame, type AxisValues, type Gap, type Spec } from "./types.ts";
import type { LeafKey } from "./optimizer/register.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: study_coupled_future_support.ts --case=ID [--seed=N] [--budget=N] " +
      "[--parent-gap=N] [--pool=N] [--child-pool=N] [--suffix-top=N] " +
      "[--suffix-budget=N] [--rank=capacity|objective|readiness] " +
      "[--parent-basis=ranked|raw-first] [--inspect-pair=PARENT:CHILD] [--out=FILE]\n",
  );
  process.exit(0);
}

const caseId = arg("case") ?? "frontier_dense_recovery";
const seed = numberArg("seed", 24);
const budget = numberArg("budget", 250_000);
const parentGap = numberArg("parent-gap", 50);
const pool = numberArg("pool", 32);
const childPool = numberArg("child-pool", 8);
const suffixTop = numberArg("suffix-top", 4);
const rankMode = arg("rank") ?? "capacity";
const parentBasis = arg("parent-basis") ?? "ranked";
const inspectPair = parsePair(arg("inspect-pair"));
const out = arg("out");
for (const [name, value] of Object.entries({ seed, budget, parentGap, pool, childPool, suffixTop })) {
  if (!Number.isSafeInteger(value) || value < 0 || (name !== "parentGap" && value === 0)) {
    throw new Error(`invalid --${name}=${value}`);
  }
}
if (rankMode !== "capacity" && rankMode !== "objective" && rankMode !== "readiness") {
  throw new Error("--rank must be capacity|objective|readiness");
}
if (parentBasis !== "ranked" && parentBasis !== "raw-first") {
  throw new Error("--parent-basis must be ranked|raw-first");
}

const definition = developmentCases.find((entry) => entry.case.metadata.id === caseId)?.case;
if (definition === undefined) throw new Error(`unknown V2 development case "${caseId}"`);
const spec = applyJolt(definition.spec, benchmarkPolicy.transform.joltMs);
const setup = buildSetup(spec, seed);
setForwardEvalContext(setup.spec, setup.gapAxisTargets);
type Visit = { node: HandoffNode; key: LeafKey; event: HandoffNodeEvent };
const visits: Visit[] = [];
const started = performance.now();
const baseline = compileHandoff(spec, seed, {
  budget,
  onNode(node, key, event) {
    visits.push({ node, key, event });
  },
});
const baselineScore = scoreDriftReport(baseline.report, {
  totalFrames: Math.round(spec.duration * FPS),
});
const deepest = visits.reduce<HandoffNode | null>((best, record) =>
  record.node.skippedContacts === 0 &&
    (best === null || record.node.search.gapIndex > best.search.gapIndex)
    ? record.node
    : best,
  null,
);
if (deepest === null) throw new Error("baseline produced no unskipped prefix");
const parentRecord = visits
  .filter((record) => record.event.phase === "main")
  .filter((record) => record.node.search.gapIndex === parentGap)
  .filter((record) => isPrefix(record.node.search.prefixFits, deepest.search.prefixFits))
  .at(-1);
if (parentRecord === undefined) {
  throw new Error(`${caseId}/s${seed}: selected prefix does not reach parent gap ${parentGap}`);
}
const parent = parentRecord.node.search;
const gap = setup.gaps[parent.gapIndex];
if (gap === undefined || !gap.endsWithContact) throw new Error(`parent gap ${parentGap} is not a contact`);
const suffixBudget = numberArg("suffix-budget", budget - parentRecord.event.simFrames);
if (!Number.isSafeInteger(suffixBudget) || suffixBudget <= 0) {
  throw new Error(`invalid --suffix-budget=${suffixBudget}; no original budget remains after parent visit`);
}
const first = getCandidatesSorted(parent, setup.gaps, setup.ctx, parentRecord.node.searchSeed, pool);
const rawFirst = parent._candidatesCache?.sampleOrder ?? [];
const parentCandidates = parentBasis === "raw-first"
  ? rawFirst.slice(0, pool)
  : first;
const rows: Array<{
  parentRank: number;
  childRank: number;
  currentValid: boolean;
  nextValid: boolean;
  currentCost: number | null;
  nextCost: number | null;
  currentLines: number;
  childLines: number;
  nextCandidatesAfterPair: number | null;
}> = [];
const viablePairs: Array<{
  parentRank: number;
  childRank: number;
  localCost: number;
  nextCandidatesAfterPair: number;
  objective: number;
  terminalReadiness: number;
  current: Candidate;
  future: Candidate;
  search: SearchNode;
}> = [];

for (const [parentRank, current] of parentCandidates.entries()) {
  const currentChild = extendNodeCached(parent, current);
  const nextGap = setup.gaps[currentChild.gapIndex];
  if (nextGap === undefined || !nextGap.endsWithContact) continue;
  const childCandidates = getCandidatesSorted(
    currentChild, setup.gaps, setup.ctx, parentRecord.node.searchSeed, childPool,
  );
  for (const [childRank, future] of childCandidates.entries()) {
    const combined = tryCandidateLines(
      parent.prefixEngine,
      gap,
      [...current.lines, ...future.lines],
      parent.prefixNextLineId,
      setup.ctx.allContactFrames,
      axisLookaheadEndFrame(gap, setup.ctx.allContactFrames),
      gap.targets,
      true,
    ) as Candidate | null;
    if (combined === null) {
      rows.push({
        parentRank, childRank, currentValid: false, nextValid: false,
        currentCost: null, nextCost: null,
        currentLines: current.lines.length, childLines: future.lines.length,
        nextCandidatesAfterPair: null,
      });
      continue;
    }
    const combinedChild = extendNodeCached(parent, combined);
    const nextValid = prebuiltFutureContact(
      combinedChild.prefixEngine,
      gap,
      nextGap,
      future,
      setup.ctx.allContactFrames,
    );
    let nextCandidatesAfterPair: number | null = null;
    if (nextValid) {
      // The second line group is already present in the engine. Preserve the
      // sequential fit's measurement/cost but do not add the same lines twice.
      const afterPair = extendNodeCached(combinedChild, { ...future, lines: [] });
      const afterGap = setup.gaps[afterPair.gapIndex];
      nextCandidatesAfterPair = afterGap?.endsWithContact
        ? getCandidatesSorted(afterPair, setup.gaps, setup.ctx, parentRecord.node.searchSeed, 8).length
        : null;
      const terminalFit = afterPair.prefixFits[afterPair.gapIndex - 1];
      const terminalReadiness = terminalFit !== null && terminalFit !== undefined && afterGap?.endsWithContact
        ? frontierReadinessFromFit(terminalFit, afterGap)?.readiness ?? 0
        : 0;
      viablePairs.push({
        parentRank,
        childRank,
        localCost: combined.cost + future.cost,
        nextCandidatesAfterPair: nextCandidatesAfterPair ?? 0,
        objective: objectiveLeafValue(afterPair, setup.gaps, setup.ctx.durationFrames),
        terminalReadiness,
        // Keep the sequential candidates distinct in the study record. `combined`
        // owns both line groups solely for exact joint validation and must not be
        // presented as the current catch's geometry.
        current,
        future,
        search: afterPair,
      });
    }
    rows.push({
      parentRank,
      childRank,
      currentValid: true,
      nextValid,
      currentCost: round(combined.cost),
      nextCost: nextValid ? round(future.cost) : null,
      currentLines: current.lines.length,
      childLines: future.lines.length,
      nextCandidatesAfterPair,
    });
  }
}

// This is intentionally a reachability diagnostic, not fair compiler accounting:
// pair construction itself is free, but each suffix receives no more simulation
// frames than remained after the original production visit at the parent gap.
// Ranking is fixed before suffix evaluation. The capacity ordering is the
// previously falsified local proxy. The objective ordering uses the compiler's
// shared partial-score reconstruction on the committed pair. The readiness
// ordering is a distinct, state-continuous certificate: it scores the second
// ordinary catch's physical release against the third contact, without a case
// label, suffix outcome, or further simulation.
const suffixes = viablePairs
  .sort((a, b) =>
    (rankMode === "objective"
      ? b.objective - a.objective
      : rankMode === "readiness"
      ? b.terminalReadiness - a.terminalReadiness
      : b.nextCandidatesAfterPair - a.nextCandidatesAfterPair) ||
    (rankMode === "objective" || rankMode === "readiness"
      ? b.nextCandidatesAfterPair - a.nextCandidatesAfterPair
      : 0) ||
    a.localCost - b.localCost ||
    a.parentRank - b.parentRank ||
    a.childRank - b.childRank)
  .slice(0, suffixTop)
  .map((pair) => {
    const node: HandoffNode = {
      ...parentRecord.node,
      search: pair.search,
      deferExpansion: false,
      rankTrace: [
        ...parentRecord.node.rankTrace,
        { rank: -2, source: "reuse" },
        { rank: -2, source: "reuse" },
      ],
    };
    const resumed = compileHandoffFromSnapshot(
      spec,
      seed,
      snapshotHandoffNode(node, parentRecord.key, parentRecord.event),
      { budget: suffixBudget },
    );
    const score = scoreDriftReport(resumed.report, { totalFrames: Math.round(spec.duration * FPS) });
    return {
      parentRank: pair.parentRank,
      childRank: pair.childRank,
      immediateNextCandidates: pair.nextCandidatesAfterPair,
      localCost: round(pair.localCost),
      objective: round(pair.objective),
      terminalReadiness: round(pair.terminalReadiness),
      current: summarizeCandidate(pair.current),
      future: summarizeCandidate(pair.future),
      valid: score.contract_passed,
      score: round(score.score),
      contactsHit: resumed.report.contacts.filter((contact) => contact.status === "hit").length,
      deepestGap: resumed.stats.handoff_deepest_seen_gap ?? null,
      terminus: resumed.report.terminus,
    };
  });
const controlResumed = compileHandoffFromSnapshot(
  spec,
  seed,
  snapshotHandoffNode(parentRecord.node, parentRecord.key, parentRecord.event),
  { budget: suffixBudget },
);
const controlScore = scoreDriftReport(controlResumed.report, { totalFrames: Math.round(spec.duration * FPS) });
const controlSuffix = {
  valid: controlScore.contract_passed,
  score: round(controlScore.score),
  contactsHit: controlResumed.report.contacts.filter((contact) => contact.status === "hit").length,
  deepestGap: controlResumed.stats.handoff_deepest_seen_gap ?? null,
  terminus: controlResumed.report.terminus,
};
const inspected = inspectPair === undefined
  ? null
  : viablePairs.find((pair) =>
    pair.parentRank === inspectPair.parentRank && pair.childRank === inspectPair.childRank,
  ) ?? null;
if (inspectPair !== undefined && inspected === null) {
  throw new Error(`--inspect-pair=${inspectPair.parentRank}:${inspectPair.childRank} is not a viable pair`);
}
const inspectionProvenance = inspected === null
  ? null
  : (() => {
    const currentChild = extendNodeCached(parent, inspected.current);
    return {
      current: aimedCandidateProvenance(parent, inspected.current, setup.gaps, setup.ctx),
      future: aimedCandidateProvenance(currentChild, inspected.future, setup.gaps, setup.ctx),
    };
  })();

const result = {
  schema: "line.study-coupled-future-support.v1",
  semantics: [
    "observation-only; does not alter compiler traversal or budget accounting",
    "both catches are ordinary normal candidates generated at their true sequential states",
    "the paired line fragment is revalidated on the original parent engine",
    "the detector must observe a B-owned authored contact with no offbeats between targets",
    "suffixes reserve only the original budget remaining after the parent visit; pair construction is free",
    "this independent oracle does not charge construction into either suffix; a production lane must do so",
  ],
  caseId,
  seed,
  budget,
  parentGap,
  pool,
  parentBasis,
  childPool,
  rankMode,
  suffixBudget,
  elapsedMs: Math.round(performance.now() - started),
  baseline: {
    valid: baselineScore.contract_passed,
    score: round(baselineScore.score),
    deepestGap: baseline.stats.handoff_deepest_seen_gap ?? null,
  },
  parent: {
    gap: parent.gapIndex,
    selectedPrefixDepth: deepest.search.gapIndex,
    simFramesAtVisit: parentRecord.event.simFrames,
  },
  // Full ordinary pool readout for diagnosing admission collapse. This is a
  // fixed observation of the existing quality ordering, not a proposed ranker.
  parentCandidatePool: parentCandidates.map((candidate, rank) => ({
    rank,
    ...summarizeCandidate(candidate),
  })),
  candidates: {
    first: parentCandidates.length,
    pairs: rows.length,
    currentValid: rows.filter((row) => row.currentValid).length,
    nextValid: rows.filter((row) => row.nextValid).length,
  },
  objectiveRange: viablePairs.length === 0 ? null : {
    min: Math.min(...viablePairs.map((pair) => pair.objective)),
    max: Math.max(...viablePairs.map((pair) => pair.objective)),
    nonzero: viablePairs.filter((pair) => pair.objective > 0).length,
  },
  controlSuffix,
  suffixes,
  inspection: inspected === null ? null : {
    // Geometry-only readout. This pair is not selected, scored, or granted any
    // extra suffix budget by the inspection option.
    parentRank: inspected.parentRank,
    childRank: inspected.childRank,
    immediateNextCandidates: inspected.nextCandidatesAfterPair,
    localCost: round(inspected.localCost),
    objective: round(inspected.objective),
    terminalReadiness: round(inspected.terminalReadiness),
    current: summarizeCandidate(inspected.current, true),
    future: summarizeCandidate(inspected.future, true),
    provenance: inspectionProvenance,
  },
  rows: rows.filter((row) => row.nextValid).slice(0, 32),
};
const json = `${JSON.stringify(result, null, 2)}\n`;
if (out === undefined) process.stdout.write(json);
else {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, json);
  process.stdout.write(`study -> ${out}\n`);
}

function numberArg(name: string, fallback: number): number {
  const raw = arg(name);
  return raw === undefined ? fallback : Number(raw);
}

/**
 * Compact physical readout for comparing a coupled witness with independently
 * successful trajectories.  These values are outputs of the ordinary exact
 * candidate gate, never inputs to a policy or a post-hoc score.
 */
function summarizeCandidate(candidate: Candidate, includeGeometry = false): Record<string, unknown> {
  const launch = candidate.ballisticLaunch;
  const state = launch?.state;
  const tail = candidate.lines.at(-1);
  return {
    cost: round(candidate.cost),
    sampleAttempt: candidate.sampleAttempt ?? null,
    aimed: candidate.aimed === true,
    lineCount: candidate.lines.length,
    length: round(candidate.lines.reduce((sum, line) =>
      sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1), 0)),
    terminalAngleDeg: tail === undefined ? null : round(Math.atan2(tail.y2 - tail.y1, tail.x2 - tail.x1) * 180 / Math.PI),
    achieved: Object.fromEntries(Object.entries(candidate.achieved).map(([name, value]) => [name, round(value)])),
    release: state === undefined ? null : {
      frame: launch!.anchorFrame,
      speed: round(Math.hypot(state.vx, state.vy)),
      vx: round(state.vx),
      vy: round(state.vy),
      airborne: launch!.airborne,
    },
    releaseGroundedFrames: candidate.releaseGroundedFrames ?? null,
    ...(includeGeometry ? {
      segments: candidate.lines.map((line) => ({
        length: round(Math.hypot(line.x2 - line.x1, line.y2 - line.y1)),
        angleDeg: round(Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180 / Math.PI),
      })),
    } : {}),
  };
}

function parsePair(raw: string | undefined): { parentRank: number; childRank: number } | undefined {
  if (raw === undefined) return undefined;
  const match = /^(\d+):(\d+)$/.exec(raw);
  if (match === null) throw new Error("--inspect-pair must be PARENT:CHILD");
  return { parentRank: Number(match[1]), childRank: Number(match[2]) };
}

/**
 * Recover the sampled base of an aimed candidate without altering the candidate
 * model. This recomputes only the ordinary deterministic proposer for the
 * inspected node; it is an oracle readout, not a compiler selection path.
 */
function aimedCandidateProvenance(
  node: SearchNode,
  candidate: Candidate,
  gaps: Gap[],
  ctx: SpecContext,
): Record<string, unknown> {
  if (candidate.aimed !== true) {
    return { kind: "sample", sampleAttempt: candidate.sampleAttempt ?? null };
  }
  const gap = gaps[node.gapIndex];
  const raw = node._candidatesCache?.sampleOrder;
  if (gap === undefined || raw === undefined) return { kind: "aimed", base: null, reason: "raw_pool_unavailable" };
  const ranked = sortCandidatesByQuality(node.prefixEngine, gap, gaps, raw, false, ctx);
  const bases = ranked.slice(0, Math.min(aimTopKBasesEffective(gap, gaps, ctx), ranked.length));
  for (const [baseRank, base] of bases.entries()) {
    const extras = makeEnumAimedCandidates(
      node.prefixEngine, gap, gaps, ctx, base, node.prefixNextLineId, baseRank === 0,
    );
    if (extras.some((extra) => sameGeometry(extra, candidate))) {
      return {
        kind: "aimed",
        qualityBaseRank: baseRank,
        qualityBaseSampleAttempt: base.sampleAttempt ?? null,
        qualityBaseCost: round(base.cost),
        qualityBase: summarizeCandidate(base, true),
      };
    }
  }
  return { kind: "aimed", base: null, reason: "not_reproduced" };
}

function sameGeometry(a: Candidate, b: Candidate): boolean {
  return a.lines.length === b.lines.length && a.lines.every((line, index) => {
    const other = b.lines[index];
    return other !== undefined &&
      line.x1 === other.x1 && line.y1 === other.y1 && line.x2 === other.x2 && line.y2 === other.y2;
  });
}

function prebuiltFutureContact(
  engine: any,
  currentGap: Gap,
  nextGap: Gap,
  future: Candidate,
  allContactFrames: number[],
): boolean {
  const horizon = Math.max(nextGap.endFrame + 20, axisLookaheadEndFrame(nextGap, allContactFrames) + 20);
  const det = detect(extractRawTrajectory(engine, horizon));
  const owned = new Set(future.lines.map((line) => line.id));
  const landing = det.events.some((event) =>
    isAuthoredContactEvent(event, nextGap.endFrame - nextGap.startFrame) &&
      Math.abs(event.frame - nextGap.endFrame) <= 1 &&
      contactLineIdsAt(det, event.frame).some((id) => owned.has(id)),
  );
  return landing &&
    countOffBeatLandings(det.events, currentGap.endFrame, nextGap.endFrame, allContactFrames) === 0;
}

function isPrefix(
  prefix: HandoffNode["search"]["prefixFits"],
  full: HandoffNode["search"]["prefixFits"],
): boolean {
  return prefix.length <= full.length && prefix.every((fit, index) => fit === full[index]);
}

function buildSetup(userSpec: Spec, publicSeed: number): {
  spec: Spec;
  gaps: Gap[];
  gapAxisTargets: AxisValues[];
  ctx: SpecContext;
} {
  const normalized: Spec = {
    ...userSpec,
    preroll: undefined,
    contacts: userSpec.contacts.filter((contact) => secToFrame(contact.t) >= 5),
  };
  const durationFrames = secToFrame(normalized.duration);
  const allContactFrames = normalized.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, durationFrames);
  const gapAxisTargets = gaps.map((entry) => effectiveAxes(entry, normalized));
  const rng = makeRng(publicSeed);
  for (const entry of gaps) {
    entry.targets = sampleGapTargets(gapAxisTargets[entry.index], normalized.jitter ?? CALIB.SIGMA, rng);
  }
  const impactByFrame = new Map(normalized.contacts.flatMap((contact) => contact.impact === undefined
    ? []
    : [[secToFrame(contact.t), contact.impact] as const]));
  for (const entry of gaps) {
    const impact = impactByFrame.get(entry.endFrame);
    if (entry.endsWithContact && impact !== undefined) {
      entry.targets.impact = impact;
      gapAxisTargets[entry.index].impact = impact;
    }
  }
  return {
    spec: normalized,
    gaps,
    gapAxisTargets,
    ctx: { allContactFrames, durationFrames, gapAxisTargets },
  };
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
