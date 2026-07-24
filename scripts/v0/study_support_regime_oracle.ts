/**
 * Compare support-time constructions from one identical handoff prefix.
 *
 * This is an observation-only candidate oracle. It deliberately does not alter
 * compiler policy: the baseline prefix is built with the production support
 * regime, then each requested regime is sampled from that same engine state
 * and evaluated by the ordinary exact candidate gates.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { MIN_LANDING_AIRBORNE_FRAMES } from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import { detectWindow } from "./core/candidate.ts";
import { airborneAt, effectiveAxes, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { applyJolt } from "../produce/seed.ts";
import {
  compileHandoff,
  compileHandoffFromSnapshot,
  setForwardEvalContext,
  snapshotHandoffNode,
  type HandoffNode,
  type HandoffNodeEvent,
} from "./optimizer/handoff.ts";
import { extendNodeCached, getCandidatesSorted, type SearchNode } from "./optimizer/node.ts";
import { sampleOneCandidate, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { nextContactGap } from "./optimizer/objective.ts";
import { scoreDriftReport } from "./score.ts";
import { CALIB, secToFrame, type AxisValues, type Gap, type Spec } from "./types.ts";
import type { SupportGeometryMode } from "./core/support_geometry.ts";
import type { LeafKey } from "./optimizer/register.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(
    "Usage: study_support_regime_oracle.ts [--case=ID] [--seed=N] [--budget=N] " +
    "[--target-gap=N] [--candidates=N] [--modes=LIST] [--suffix-budget=N] " +
    "[--suffix-top=N] [--pair-children=N] [--out=FILE]",
  );
  process.exit(0);
}

const caseId = arg("case") ?? "frontier_dense_recovery";
const seed = numberArg("seed", 24);
const budget = numberArg("budget", 250_000);
const targetGap = numberArg("target-gap", 53);
const candidates = numberArg("candidates", 64);
const suffixBudget = numberArg("suffix-budget", 0);
const suffixTop = numberArg("suffix-top", 4);
const pairChildren = numberArg("pair-children", 0);
const modes = (arg("modes") ?? "shape-time-deficit,time-shape-span,time,time-extend")
  .split(",")
  .filter(Boolean)
  .map(parseMode);
const outPath = arg("out");

if (process.env.LR_SUPPORT_GEOMETRY !== undefined) {
  throw new Error("study_support_regime_oracle requires LR_SUPPORT_GEOMETRY to be unset for its production-prefix control");
}
for (const [name, value] of Object.entries({
  seed, budget, targetGap, candidates, suffixBudget, suffixTop, pairChildren,
})) {
  if (
    !Number.isSafeInteger(value) || value < 0 ||
    (name !== "targetGap" && name !== "suffixBudget" && name !== "pairChildren" && value === 0)
  ) {
    throw new Error(`invalid --${name}=${value}`);
  }
}

const source = developmentCases.find((entry) => entry.case.metadata.id === caseId)?.case.spec;
if (source === undefined) throw new Error(`unknown development case ${caseId}`);
const spec = applyJolt(source, benchmarkPolicy.transform.joltMs);
const setup = buildSetup(spec, seed);
setForwardEvalContext(setup.spec, setup.targets);

type Visit = { node: HandoffNode; key: LeafKey; event: HandoffNodeEvent };
const visits: Visit[] = [];
let deepest: HandoffNode | null = null;
const started = performance.now();
const baseline = compileHandoff(spec, seed, {
  budget,
  onNode(node, key, event) {
    visits.push({ node, key, event });
    if (
      node.startExpanded && node.skippedContacts === 0 &&
      (deepest === null || node.search.gapIndex > deepest.search.gapIndex)
    ) deepest = node;
  },
});
if (deepest === null) throw new Error("baseline produced no expanded no-skip prefix");

const target = visits
  .filter((visit) => visit.node.startExpanded && visit.node.search.gapIndex === targetGap)
  .filter((visit) => isPrefix(visit.node.search.prefixFits, deepest!.search.prefixFits))
  .at(-1);
if (target === undefined) {
  throw new Error(
    `baseline has no selected-prefix visit at requested target gap ${targetGap}`,
  );
}
const parent = visits
  .filter((visit) => visit.node.startExpanded && visit.node.search.gapIndex === targetGap - 1)
  .filter((visit) => isPrefix(visit.node.search.prefixFits, target.node.search.prefixFits))
  .at(-1);
if (parent === undefined) throw new Error(`target gap ${targetGap} has no expanded parent`);

const gap = setup.gaps[parent.node.search.gapIndex];
const next = nextContactGap(gap, setup.gaps);
if (!gap.endsWithContact || next === null) throw new Error(`gap ${gap.index} has no following contact`);

const normalPool = getCandidatesSorted(
  parent.node.search, setup.gaps, setup.ctx, parent.node.searchSeed, candidates,
);
const baselineScore = scoreDriftReport(baseline.report, { totalFrames: setup.durationFrames });
const result = {
  schema: "line.study-support-regime-oracle.v1",
  semantics: [
    "production prefix is compiled with the default support regime",
    "each alternate mode is sampled from that identical prefix with the ordinary exact gates",
    "next-contact candidate count uses the unchanged production generator",
    "candidate rows are reachability observations, not a production selector",
    "optional two-contact suffixes rank ordinary child candidates by combined exact local cost",
  ],
  caseId,
  seed,
  budget,
  targetGap,
  candidates,
  elapsedMs: Math.round(performance.now() - started),
  baseline: {
    valid: baselineScore.contract_passed,
    score: round(baselineScore.score),
    deepestGap: baseline.stats.handoff_deepest_seen_gap ?? null,
    parentGap: parent.node.search.gapIndex,
    parentSimFrames: parent.event.simFrames,
    targetFrames: gap.endFrame - gap.startFrame,
    nextFrames: next.endFrame - next.startFrame,
    normalPool: summarizeNormalPool(normalPool, parent.node.search, gap, next, setup, parent.node.searchSeed),
  },
  modes: modes.map((mode) => observeMode(mode, parent, gap, next, setup)),
};
const json = `${JSON.stringify(result, null, 2)}\n`;
if (outPath === undefined) process.stdout.write(json);
else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json);
  process.stdout.write(`study -> ${outPath}\n`);
}

function observeMode(
  mode: SupportGeometryMode,
  parent: Visit,
  current: Gap,
  following: Gap,
  local: ReturnType<typeof buildSetup>,
  
) {
  const parentNode = parent.node.search;
  const searchSeed = parent.node.searchSeed;
  const rng = makeRng((Math.imul(searchSeed | 0, 1_000_003) + current.index + 1) | 0);
  const rows: Array<{ candidate: Candidate; summary: ReturnType<typeof summarizeCandidate> }> = [];
  for (let attempt = 0; attempt < candidates; attempt++) {
    const candidate = sampleOneCandidate(
      parentNode.prefixEngine,
      current,
      rng,
      local.ctx,
      parentNode.prefixNextLineId,
      attempt,
      "normal",
      current.targets,
      mode,
    );
    if (candidate === null) continue;
    rows.push({
      candidate,
      summary: summarizeCandidate(candidate, parentNode, current, following, local, searchSeed),
    });
  }
  const ready = rows.filter(({ summary }) => summary.airborneRunAtNext >= MIN_LANDING_AIRBORNE_FRAMES);
  const bridged = rows.filter(({ summary }) => summary.nextCandidates > 0);
  return {
    mode,
    viable: rows.length,
    detectorReady: ready.length,
    bridges: bridged.length,
    maximumAirborneRunAtNext: Math.max(0, ...rows.map(({ summary }) => summary.airborneRunAtNext)),
    bestByCost: [...rows].map(({ summary }) => summary).sort((a, b) => a.cost - b.cost).slice(0, 12),
    readyRows: ready.map(({ summary }) => summary)
      .sort((a, b) => b.nextCandidates - a.nextCandidates || a.cost - b.cost).slice(0, 12),
    bridgeRows: bridged.map(({ summary }) => summary)
      .sort((a, b) => b.nextCandidates - a.nextCandidates || a.cost - b.cost).slice(0, 12),
    suffixes: suffixBudget === 0 ? [] : bridged
      .sort((a, b) => b.summary.nextCandidates - a.summary.nextCandidates || a.summary.cost - b.summary.cost)
      .slice(0, suffixTop)
      .map(({ candidate, summary }) => resumeSuffix(candidate, summary, parent, current, local)),
    pairs: pairChildren === 0 ? [] : bridged
      .sort((a, b) => b.summary.nextCandidates - a.summary.nextCandidates || a.summary.cost - b.summary.cost)
      .slice(0, suffixTop)
      .flatMap(({ candidate, summary }) => observePairs(candidate, summary, parent, current, following, local)),
  };
}

function observePairs(
  candidate: Candidate,
  summary: ReturnType<typeof summarizeCandidate>,
  parent: Visit,
  current: Gap,
  following: Gap,
  local: ReturnType<typeof buildSetup>,
) {
  const firstChild = advanceToGap(
    extendNodeCached(parent.node.search, candidate), local.gaps, following.index,
  );
  const children = getCandidatesSorted(
    firstChild,
    local.gaps,
    local.ctx,
    parent.node.searchSeed,
    candidates,
  )
    .sort((a, b) =>
      a.cost - b.cost ||
      a.cost - b.cost ||
      (a.sampleAttempt ?? Infinity) - (b.sampleAttempt ?? Infinity),
    )
    .slice(0, pairChildren);
  return children.map((child) => {
    const paired = extendNodeCached(firstChild, child);
    const entry = {
      firstAttempt: summary.attempt,
      firstCost: summary.cost,
      secondAttempt: child.sampleAttempt ?? null,
      secondCost: round(child.cost),
      jointLocalCost: round(candidate.cost + child.cost),
      secondLines: child.lines.length,
    };
    if (suffixBudget === 0) return entry;
    const node: HandoffNode = {
      ...parent.node,
      search: paired,
      deferExpansion: false,
      rankTrace: [...parent.node.rankTrace, { rank: -99, source: "pool" }, { rank: -98, source: "pool" }],
    };
    const resumed = compileHandoffFromSnapshot(
      local.spec,
      seed,
      snapshotHandoffNode(node, parent.key, parent.event),
      { budget: suffixBudget },
    );
    const score = scoreDriftReport(resumed.report, { totalFrames: local.durationFrames });
    return {
      ...entry,
      suffixBudget,
      valid: score.contract_passed,
      score: round(score.score),
      deepestGap: resumed.stats.handoff_deepest_seen_gap ?? null,
      terminus: resumed.report.terminus,
    };
  });
}

function resumeSuffix(
  candidate: Candidate,
  summary: ReturnType<typeof summarizeCandidate>,
  parent: Visit,
  current: Gap,
  local: ReturnType<typeof buildSetup>,
) {
  const child = extendNodeCached(parent.node.search, candidate);
  const node: HandoffNode = {
    ...parent.node,
    search: child,
    deferExpansion: false,
    rankTrace: [...parent.node.rankTrace, { rank: -99, source: "pool" }],
  };
  const resumed = compileHandoffFromSnapshot(
    local.spec,
    seed,
    snapshotHandoffNode(node, parent.key, parent.event),
    { budget: suffixBudget },
  );
  const score = scoreDriftReport(resumed.report, { totalFrames: local.durationFrames });
  return {
    attempt: summary.attempt,
    nextCandidates: summary.nextCandidates,
    suffixBudget,
    valid: score.contract_passed,
    score: round(score.score),
    deepestGap: resumed.stats.handoff_deepest_seen_gap ?? null,
    terminus: resumed.report.terminus,
  };
}

function summarizeNormalPool(
  candidates: Candidate[],
  parent: SearchNode,
  current: Gap,
  following: Gap,
  local: ReturnType<typeof buildSetup>,
  searchSeed: number,
) {
  const rows = candidates
    .filter((candidate) => candidate.sampleAttempt !== undefined)
    .map((candidate) => summarizeCandidate(candidate, parent, current, following, local, searchSeed));
  return {
    viable: rows.length,
    detectorReady: rows.filter((row) => row.airborneRunAtNext >= MIN_LANDING_AIRBORNE_FRAMES).length,
    bridges: rows.filter((row) => row.nextCandidates > 0).length,
    maximumAirborneRunAtNext: Math.max(0, ...rows.map((row) => row.airborneRunAtNext)),
    rows: rows.slice(0, 12),
  };
}

function summarizeCandidate(
  candidate: Candidate,
  parent: SearchNode,
  current: Gap,
  following: Gap,
  local: ReturnType<typeof buildSetup>,
  searchSeed: number,
) {
  const child = advanceToGap(extendNodeCached(parent, candidate), local.gaps, following.index);
  const transition = transitionAtNext(child.prefixEngine, current, following);
  const nextCandidates = getCandidatesSorted(child, local.gaps, local.ctx, searchSeed, candidates).length;
  const lengths = candidate.lines.map((line) => Math.hypot(line.x2 - line.x1, line.y2 - line.y1));
  return {
    attempt: candidate.sampleAttempt ?? null,
    cost: round(candidate.cost),
    lines: candidate.lines.length,
    length: round(lengths.reduce((sum, value) => sum + value, 0)),
    tailLength: round(lengths.slice(1).reduce((sum, value) => sum + value, 0)),
    releaseFrame: candidate.ballisticLaunch?.anchorFrame ?? null,
    releaseGrounded: candidate.ballisticLaunch?.groundedFrames ?? null,
    airborneRunAtNext: transition.airborneRunAtNext,
    lastGroundedBeforeNext: transition.lastGroundedBeforeNext,
    nextCandidates,
  };
}

function transitionAtNext(
  // deno-lint-ignore no-explicit-any
  engine: any,
  current: Gap,
  following: Gap,
) {
  const detection = detectWindow(engine, current.startFrame, following.endFrame + 6);
  let lastGroundedBeforeNext: number | null = null;
  for (let frame = current.endFrame; frame < following.endFrame; frame++) {
    if (airborneAt(detection, frame) === false) lastGroundedBeforeNext = frame;
  }
  let airborneRunAtNext = 0;
  for (let frame = following.endFrame - 1; frame >= current.endFrame; frame--) {
    if (airborneAt(detection, frame) !== true) break;
    airborneRunAtNext++;
  }
  return { lastGroundedBeforeNext, airborneRunAtNext };
}

function advanceToGap(node: SearchNode, gaps: Gap[], target: number): SearchNode {
  let current = node;
  while (current.gapIndex < target) current = extendNodeCached(current, null);
  return current;
}

function buildSetup(userSpec: Spec, publicSeed: number): {
  spec: Spec;
  gaps: Gap[];
  targets: AxisValues[];
  durationFrames: number;
  ctx: SpecContext;
} {
  const spec: Spec = {
    ...userSpec,
    preroll: undefined,
    contacts: userSpec.contacts.filter((contact) => secToFrame(contact.t) >= 5),
  };
  const durationFrames = secToFrame(spec.duration);
  const frames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(frames, durationFrames);
  const targets = gaps.map((entry) => effectiveAxes(entry, spec));
  const rng = makeRng(publicSeed);
  for (const entry of gaps) entry.targets = sampleGapTargets(targets[entry.index], spec.jitter ?? CALIB.SIGMA, rng);
  const impactByFrame = new Map(spec.contacts.flatMap((contact) =>
    contact.impact === undefined ? [] : [[secToFrame(contact.t), contact.impact] as const],
  ));
  for (const entry of gaps) {
    const impact = entry.endsWithContact ? impactByFrame.get(entry.endFrame) : undefined;
    if (impact !== undefined) {
      entry.targets.impact = impact;
      targets[entry.index].impact = impact;
    }
  }
  for (let index = 0; index + 1 < gaps.length; index++) {
    if (gaps[index].endsWithContact && gaps[index + 1].endsWithContact) {
      gaps[index].nextImpact = gaps[index + 1].targets.impact;
    }
  }
  return {
    spec,
    gaps,
    targets,
    durationFrames,
    ctx: { allContactFrames: frames, durationFrames, gapAxisTargets: targets },
  };
}

function isPrefix(left: readonly (Candidate | null)[], right: readonly (Candidate | null)[]): boolean {
  return left.length <= right.length && left.every((candidate, index) => candidate === right[index]);
}

function parseMode(value: string): SupportGeometryMode {
  if (
    value === "off" || value === "time" || value === "time-extend" ||
    value === "time-shape-span" || value === "shape-time-log" || value === "shape-time-deficit"
  ) return value;
  throw new Error(`invalid support mode ${value}`);
}

function numberArg(name: string, fallback: number): number {
  const value = arg(name);
  return value === undefined ? fallback : Number(value);
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
