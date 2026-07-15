/**
 * V2-native causal oracle for a weak impact contact.
 *
 * It holds the accepted prefix fixed up to the predecessor contact, enumerates
 * current-generator predecessor/arrival pairs, and rebuilds the incumbent tail.
 * This is deliberately an observation tool: no feasibility cap, rank change, or
 * production policy is implied by a winning pair.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { K_BOUNCE_LANDING } from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import {
  buildDriftReport,
  effectiveAxes,
  engineLineFromTrackLine,
  makeBaseEngine,
  sampleGapTargets,
  sliceTimeline,
  type GapFit,
} from "./core/substrate.ts";
import {
  axisLookaheadEndFrame,
  detectWindow,
  translateTrackLines,
  tryCandidate,
  tryCandidateLines,
} from "./core/candidate.ts";
import { applyJolt } from "../produce/seed.ts";
import {
  compileHandoff,
  compileHandoffFromSnapshot,
  objectiveLeafValue,
  setForwardEvalContext,
  snapshotHandoffNode,
  type HandoffNode,
} from "./optimizer/handoff.ts";
import { extendNodeCached, getCandidatesSorted, makeRootNode, type SearchNode } from "./optimizer/node.ts";
import { getCandidateProbe, sampleOneCandidate, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { applyArcKnobs, arcProbeDesign, type ArcKnobs } from "./optimizer/arc_model.ts";
import { isStrictlyBetter, type LeafKey } from "./optimizer/register.ts";
import { scoreDriftReport } from "./score.ts";
import { CALIB, FPS, secToFrame, type AxisValues, type Gap } from "./types.ts";
import type { Spec } from "./optimizer/types.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const ids = (arg("specs") ?? "believer_56_6s,believer_56_6s_impact_relief,believer_impact_56s,dense_dialogue").split(",");
const seeds = (arg("seeds") ?? "0").split(",").map(Number);
const budget = Number(arg("budget") ?? "500000");
const parentCount = Number(arg("parents") ?? "16");
const childCount = Number(arg("children") ?? "16");
const finalistsPerOrder = Number(arg("finalists") ?? "4");
const suffixMode = arg("suffix") ?? "guided";
const suffixBudget = Number(arg("suffix-budget") ?? "100000");
const parentImpactProjections = (arg("parent-impact-projections") ?? "")
  .split(",")
  .filter((value) => value.length > 0)
  .map(Number);
const projectedParentsPerProjection = Number(arg("projected-parents") ?? "8");
const jointKnobParents = Number(arg("joint-knob-parents") ?? "0");
const jointKnobChildren = Number(arg("joint-knob-children") ?? "8");
const outPath = arg("out");

for (const value of [budget, parentCount, childCount, finalistsPerOrder, suffixBudget, projectedParentsPerProjection]) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`expected positive integer, got ${value}`);
}
for (const value of [jointKnobParents, jointKnobChildren]) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`expected non-negative integer, got ${value}`);
}
if (jointKnobParents > 0 && jointKnobChildren === 0) {
  throw new Error("--joint-knob-children must be positive when --joint-knob-parents is positive");
}
if (seeds.some((seed) => !Number.isSafeInteger(seed))) throw new Error("seeds must be safe integers");
if (suffixMode !== "guided" && suffixMode !== "search") throw new Error(`unknown suffix mode "${suffixMode}"`);
if (parentImpactProjections.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
  throw new Error("--parent-impact-projections values must be finite in [0,1]");
}

const cases = new Map(developmentCases.map((entry) => [entry.case.metadata.id, entry.case.spec] as const));
for (const id of ids) if (!cases.has(id)) throw new Error(`unknown V2 development case "${id}"`);

type Setup = {
  spec: Spec;
  gaps: Gap[];
  targets: AxisValues[];
  frames: number[];
  durationFrames: number;
  ctx: SpecContext;
};

function prepare(userSpec: Spec, seed: number): Setup {
  const contacts = userSpec.contacts.filter((contact) => secToFrame(contact.t) >= K_BOUNCE_LANDING);
  const spec = { ...userSpec, preroll: undefined, contacts };
  const durationFrames = secToFrame(spec.duration);
  const frames = contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(frames, durationFrames);
  const targets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(seed);
  for (const gap of gaps) gap.targets = sampleGapTargets(targets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);

  // Match current compiler semantics exactly: authored impact is authoritative.
  // In particular, do not recreate the retired feasibility cap from the V1 oracle.
  const impactByFrame = new Map(contacts.flatMap((contact) =>
    contact.impact === undefined ? [] : [[secToFrame(contact.t), contact.impact] as const],
  ));
  for (const gap of gaps) {
    const impact = gap.endsWithContact ? impactByFrame.get(gap.endFrame) : undefined;
    if (impact !== undefined) {
      gap.targets.impact = impact;
      targets[gap.index].impact = impact;
    }
  }
  for (let index = 0; index + 1 < gaps.length; index++) {
    if (gaps[index].endsWithContact && gaps[index + 1].endsWithContact) {
      gaps[index].nextImpact = gaps[index + 1].targets.impact;
    }
  }
  return { spec, gaps, targets, frames, durationFrames, ctx: { allContactFrames: frames, durationFrames, gapAxisTargets: targets } };
}

function reconstructEntry(node: HandoffNode, gaps: Gap[], gapIndex: number): SearchNode {
  let engine = makeBaseEngine(node.startState);
  if (node.startLines.length > 0) engine = engine.addLine(node.startLines.map(engineLineFromTrackLine));
  let entry: SearchNode = { ...makeRootNode(engine, gaps.length), prefixNextLineId: 1 + node.startLines.length };
  for (let index = 0; index < gapIndex; index++) {
    entry = extendNodeCached(entry, node.search.prefixFits[index] as Candidate | null);
  }
  return entry;
}

function rebuildGuidedTail(
  initial: SearchNode,
  incumbentFits: readonly (GapFit | null)[],
  gaps: Gap[],
  ctx: SpecContext,
): SearchNode | null {
  let node = initial;
  for (let index = node.gapIndex; index < gaps.length; index++) {
    const gap = gaps[index];
    if (!gap.endsWithContact) {
      node = extendNodeCached(node, null);
      continue;
    }
    const guide = incumbentFits[index];
    if (guide === null || guide === undefined || guide.ref === undefined) return null;
    const probe = getCandidateProbe(node.prefixEngine, gap, ctx);
    const dx = probe.targetState.sledX - guide.ref.x;
    const dy = probe.targetState.sledY - guide.ref.y;
    const lookahead = axisLookaheadEndFrame(gap, ctx.allContactFrames);
    const candidate = guide.arc === null
      ? tryCandidateLines(node.prefixEngine, gap, translateTrackLines(guide.lines, dx, dy, node.prefixNextLineId), node.prefixNextLineId, ctx.allContactFrames, lookahead, gap.targets, true, undefined, probe.preTargetSledTrace)
      : tryCandidate(node.prefixEngine, gap, { ...guide.arc, anchor: { x: guide.arc.anchor.x + dx, y: guide.arc.anchor.y + dy } }, node.prefixNextLineId, ctx.allContactFrames, lookahead, gap.targets, true, undefined, probe.preTargetSledTrace);
    if (candidate === null) return null;
    candidate.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
    node = extendNodeCached(node, candidate);
  }
  return node;
}

/**
 * Re-evaluate an intentional shape perturbation through the normal exact
 * candidate gate.  The source candidate is only a geometry seed: neither its
 * cost nor its achieved axes survive this call.  That makes this a genuine
 * two-contact geometry experiment rather than a synthetic score adjustment.
 */
function fitKnobbedCandidate(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  source: Candidate,
  knobs: ArcKnobs,
  lineIdStart: number,
  ctx: SpecContext,
): Candidate | null {
  const lines = applyArcKnobs(source.lines, knobs).map((line, index) => ({ ...line, id: lineIdStart + index }));
  const probe = getCandidateProbe(engine, gap, ctx);
  const fit = tryCandidateLines(
    engine,
    gap,
    lines,
    lineIdStart,
    ctx.allContactFrames,
    axisLookaheadEndFrame(gap, ctx.allContactFrames),
    gap.targets,
    true,
    "normal",
    probe.preTargetSledTrace,
  ) as Candidate | null;
  if (fit !== null) fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
  return fit;
}

type Pair = {
  parentRank: number;
  parentSource: "pool" | "projected" | "joint";
  parentProjection: number | null;
  childRank: number;
  node: SearchNode;
  objective: number;
  impactError: number;
};
type Row = {
  spec: string;
  seed: number;
  impactGap: number | null;
  baselineScore: number;
  baselineTailRebuilt: boolean | null;
  baselineTailScore: number | null;
  bestScore: number;
  lift: number;
  parentCandidates: number;
  projectedParents: number;
  jointParents: number;
  parentsWithChildren: number;
  pairs: number;
  projectedPairs: number;
  jointPairs: number;
  finalists: number;
  projectedFinalists: number;
  jointFinalists: number;
  tailsRebuilt: number;
  validCompletions: number;
  projectedValidCompletions: number;
  jointValidCompletions: number;
  contractFailures: number;
  improvingCompletions: number;
  projectedImprovingCompletions: number;
  jointImprovingCompletions: number;
  bestParentRank: number | null;
  bestParentSource: "pool" | "projected" | "joint" | null;
  bestParentProjection: number | null;
  bestChildRank: number | null;
  bestPairObjective: number | null;
  bestPairImpactError: number | null;
};

const rows: Row[] = [];
for (const id of ids) {
  const baseSpec = cases.get(id)!;
  for (const seed of seeds) {
    const started = Date.now();
    const userSpec = applyJolt(baseSpec, benchmarkPolicy.transform.joltMs);
    let winner: HandoffNode | null = null;
    let winnerKey: LeafKey | null = null;
    const checkpoint = compileHandoff(userSpec, seed, {
      budget,
      onNode: (node, key, event) => {
        if (event.fullDuration && (winnerKey === null || isStrictlyBetter(key, winnerKey))) {
          winner = node;
          winnerKey = key;
        }
      },
    });
    const setup = prepare(userSpec, seed);
    const baselineScore = scoreDriftReport(checkpoint.report, { totalFrames: setup.durationFrames }).score;
    if (winner === null || winnerKey === null) {
      rows.push({ spec: id, seed, impactGap: null, baselineScore, baselineTailRebuilt: null, baselineTailScore: null, bestScore: baselineScore, lift: 0, parentCandidates: 0, projectedParents: 0, jointParents: 0, parentsWithChildren: 0, pairs: 0, projectedPairs: 0, jointPairs: 0, finalists: 0, projectedFinalists: 0, jointFinalists: 0, tailsRebuilt: 0, validCompletions: 0, projectedValidCompletions: 0, jointValidCompletions: 0, contractFailures: 0, improvingCompletions: 0, projectedImprovingCompletions: 0, jointImprovingCompletions: 0, bestParentRank: null, bestParentSource: null, bestParentProjection: null, bestChildRank: null, bestPairObjective: null, bestPairImpactError: null });
      console.error(`  ${id}/s${seed}: no complete incumbent`);
      continue;
    }
    setForwardEvalContext(setup.spec, setup.targets);
    const weak = checkpoint.report.gaps.flatMap((gap) => {
      const impact = gap.axes.impact;
      return impact !== undefined && impact.achieved < impact.target && gap.gap_index > 0
        ? [{ index: gap.gap_index, error: impact.error }]
        : [];
    }).filter(({ index }) => setup.gaps[index - 1]?.endsWithContact && setup.gaps[index]?.endsWithContact && winner!.search.prefixFits[index - 1] !== null && winner!.search.prefixFits[index] !== null)
      .sort((a, b) => b.error * b.error - a.error * a.error || a.index - b.index)[0];
    if (weak === undefined) {
      rows.push({ spec: id, seed, impactGap: null, baselineScore, baselineTailRebuilt: null, baselineTailScore: null, bestScore: baselineScore, lift: 0, parentCandidates: 0, projectedParents: 0, jointParents: 0, parentsWithChildren: 0, pairs: 0, projectedPairs: 0, jointPairs: 0, finalists: 0, projectedFinalists: 0, jointFinalists: 0, tailsRebuilt: 0, validCompletions: 0, projectedValidCompletions: 0, jointValidCompletions: 0, contractFailures: 0, improvingCompletions: 0, projectedImprovingCompletions: 0, jointImprovingCompletions: 0, bestParentRank: null, bestParentSource: null, bestParentProjection: null, bestChildRank: null, bestPairObjective: null, bestPairImpactError: null });
      console.error(`  ${id}/s${seed}: no under-impact adjacent pair`);
      continue;
    }
    const entry = reconstructEntry(winner, setup.gaps, weak.index - 1);
    // The exact incumbent must rebuild through the same suffix before any pair
    // result is interpretable. This catches oracle/context drift immediately.
    const baselineTerminal = rebuildGuidedTail(
      reconstructEntry(winner, setup.gaps, weak.index + 1),
      winner.search.prefixFits,
      setup.gaps,
      setup.ctx,
    );
    const baselineTailScore = baselineTerminal === null
      ? null
      : (() => {
        const detection = detectWindow(baselineTerminal.prefixEngine, 0, setup.durationFrames + 20);
        const report = buildDriftReport(detection, setup.spec, setup.gaps, setup.frames, setup.durationFrames, [], baselineTerminal.prefixFits, setup.targets);
        return scoreDriftReport(report, { totalFrames: setup.durationFrames });
      })();
    const baselineTailRebuilt = baselineTailScore !== null &&
      baselineTailScore.contract_passed &&
      Math.abs(baselineTailScore.score - baselineScore) <= 1e-9;
    if (!baselineTailRebuilt) {
      throw new Error(
        `${id}/s${seed}: incumbent suffix replay diverged ` +
        `(baseline=${baselineScore}, replay=${baselineTailScore?.score ?? "none"})`,
      );
    }
    const poolParents = getCandidatesSorted(entry, setup.gaps, setup.ctx, winner.searchSeed, parentCount);
    const parentGap = setup.gaps[weak.index - 1];
    const nextImpact = setup.targets[weak.index].impact;
    const parentImpact = parentGap.targets.impact;
    // Two-contact generation study: alter only the predecessor's geometry
    // target toward the next contact's impact ask. The predecessor is still
    // judged against its authored target by tryCandidate; this projection is a
    // proposal coordinate, not a scoring or feasibility semantic change.
    const projectedParents = nextImpact === undefined
      ? []
      : parentImpactProjections.flatMap((projection, projectionIndex) => {
        const geometryTargets = {
          ...parentGap.targets,
          impact: parentImpact === undefined
            ? nextImpact * projection
            : parentImpact + (nextImpact - parentImpact) * projection,
        };
        const salt = Math.round(projection * 1_000_000);
        const rng = makeRng((Math.imul(seed | 0, 1_000_003) + weak.index * 65_537 + salt) | 0);
        const out: Array<{ candidate: Candidate; projection: number; rank: number }> = [];
        for (let attempt = 0; attempt < projectedParentsPerProjection; attempt++) {
          const candidate = sampleOneCandidate(
            entry.prefixEngine,
            parentGap,
            rng,
            setup.ctx,
            entry.prefixNextLineId,
            attempt,
            "normal",
            geometryTargets,
          );
          if (candidate !== null) out.push({
            candidate,
            projection,
            rank: parentCount + projectionIndex * projectedParentsPerProjection + attempt,
          });
        }
        return out;
      });
    const parents = [
      ...poolParents.map((candidate, rank) => ({ candidate, rank, source: "pool" as const, projection: null })),
      ...projectedParents.map(({ candidate, rank, projection }) => ({
        candidate,
        rank,
        source: "projected" as const,
        projection,
      })),
    ];
    const pairs: Pair[] = [];
    let parentsWithChildren = 0;
    for (const parent of parents) {
      let parentNode = extendNodeCached(entry, parent.candidate);
      while (parentNode.gapIndex < weak.index) parentNode = extendNodeCached(parentNode, null);
      const children = getCandidatesSorted(parentNode, setup.gaps, setup.ctx, winner.searchSeed, childCount);
      if (children.length > 0) parentsWithChildren++;
      for (const [childRank, child] of children.entries()) {
        const achieved = child.achievedAtEnd ?? child.achieved;
        const target = setup.targets[weak.index].impact;
        if (target === undefined || achieved.impact === undefined) continue;
        const node = extendNodeCached(parentNode, child);
        pairs.push({
          parentRank: parent.rank,
          parentSource: parent.source,
          parentProjection: parent.projection,
          childRank,
          node,
          objective: objectiveLeafValue(node, setup.gaps, setup.durationFrames),
          impactError: Math.abs(achieved.impact - target),
        });
      }
    }
    // A different causal question from the target-projection experiment above:
    // can a small, continuous perturbation of the *shape of both adjacent
    // arcs* reach a better state that ordinary one-contact generation misses?
    // Both arcs are independently re-fit against their literal authored asks,
    // and only exact suffix completions below are allowed to establish lift.
    const jointParentKnobs = arcProbeDesign("cross5", { pitchSpan: 6, rotateSpan: 2 })
      .filter((knobs) => knobs.pitchDeg !== 0 || knobs.rotateDeg !== 0);
    const jointChildKnobs = arcProbeDesign("pitch3", { pitchSpan: 6 })
      .filter((knobs) => knobs.pitchDeg !== 0 || knobs.rotateDeg !== 0);
    let jointParents = 0;
    let jointParentOrdinal = 0;
    for (const baseParent of poolParents.slice(0, jointKnobParents)) {
      for (const parentKnobs of jointParentKnobs) {
        const parent = fitKnobbedCandidate(
          entry.prefixEngine,
          parentGap,
          baseParent,
          parentKnobs,
          entry.prefixNextLineId,
          setup.ctx,
        );
        if (parent === null) continue;
        jointParents++;
        let parentNode = extendNodeCached(entry, parent);
        while (parentNode.gapIndex < weak.index) parentNode = extendNodeCached(parentNode, null);
        const children = getCandidatesSorted(
          parentNode,
          setup.gaps,
          setup.ctx,
          winner.searchSeed,
          jointKnobChildren,
        );
        for (const [childRank, baseChild] of children.entries()) {
          for (const childKnobs of jointChildKnobs) {
            const child = fitKnobbedCandidate(
              parentNode.prefixEngine,
              setup.gaps[weak.index],
              baseChild,
              childKnobs,
              parentNode.prefixNextLineId,
              setup.ctx,
            );
            if (child === null) continue;
            const achieved = child.achievedAtEnd ?? child.achieved;
            const target = setup.targets[weak.index].impact;
            if (target === undefined || achieved.impact === undefined) continue;
            const node = extendNodeCached(parentNode, child);
            pairs.push({
              parentRank: parents.length + jointParentOrdinal,
              parentSource: "joint",
              parentProjection: null,
              childRank,
              node,
              objective: objectiveLeafValue(node, setup.gaps, setup.durationFrames),
              impactError: Math.abs(achieved.impact - target),
            });
          }
        }
        jointParentOrdinal++;
      }
    }
    const byObjective = [...pairs].sort((a, b) => b.objective - a.objective || a.impactError - b.impactError).slice(0, finalistsPerOrder);
    const byImpact = [...pairs].sort((a, b) => a.impactError - b.impactError || b.objective - a.objective).slice(0, finalistsPerOrder);
    const finalists = [...new Map([...byObjective, ...byImpact].map((pair) => [
      `${pair.parentSource}:${pair.parentRank}:${pair.childRank}`,
      pair,
    ])).values()];
    let bestScore = baselineScore;
    let best: Pair | null = null;
    let tailsRebuilt = 0;
    let validCompletions = 0;
    let projectedValidCompletions = 0;
    let jointValidCompletions = 0;
    let contractFailures = 0;
    let improvingCompletions = 0;
    let projectedImprovingCompletions = 0;
    let jointImprovingCompletions = 0;
    for (const pair of finalists) {
      const score = suffixMode === "guided"
        ? (() => {
          const terminal = rebuildGuidedTail(pair.node, winner!.search.prefixFits, setup.gaps, setup.ctx);
          if (terminal === null) return null;
          tailsRebuilt++;
          const detection = detectWindow(terminal.prefixEngine, 0, setup.durationFrames + 20);
          const report = buildDriftReport(detection, setup.spec, setup.gaps, setup.frames, setup.durationFrames, [], terminal.prefixFits, setup.targets);
          return scoreDriftReport(report, { totalFrames: setup.durationFrames });
        })()
        : (() => {
          const pairHandoff: HandoffNode = {
            ...winner!,
            search: pair.node,
            deferExpansion: false,
            rankTrace: winner!.rankTrace.slice(0, pair.node.gapIndex),
            skippedContacts: 0,
          };
          const snapshot = snapshotHandoffNode(pairHandoff, winnerKey!, {
            phase: "main",
            simFrames: 0,
            fullDuration: false,
            outputDurationFrames: setup.gaps[Math.max(0, pair.node.gapIndex - 1)]?.endFrame ?? 0,
            improved: false,
            improvementCount: 0,
            consideredCount: 0,
          });
          const completion = compileHandoffFromSnapshot(userSpec, seed, snapshot, { budget: suffixBudget });
          tailsRebuilt++;
          return scoreDriftReport(completion.report, { totalFrames: setup.durationFrames });
        })();
      if (score === null) continue;
      if (!score.contract_passed) {
        contractFailures++;
        continue;
      }
      validCompletions++;
      if (pair.parentSource === "projected") projectedValidCompletions++;
      if (pair.parentSource === "joint") jointValidCompletions++;
      if (score.score > baselineScore) {
        improvingCompletions++;
        if (pair.parentSource === "projected") projectedImprovingCompletions++;
        if (pair.parentSource === "joint") jointImprovingCompletions++;
      }
      if (score.score > bestScore) {
        bestScore = score.score;
        best = pair;
      }
    }
    rows.push({ spec: id, seed, impactGap: weak.index, baselineScore, baselineTailRebuilt, baselineTailScore: baselineTailScore.score, bestScore, lift: bestScore - baselineScore, parentCandidates: poolParents.length, projectedParents: projectedParents.length, jointParents, parentsWithChildren, pairs: pairs.length, projectedPairs: pairs.filter((pair) => pair.parentSource === "projected").length, jointPairs: pairs.filter((pair) => pair.parentSource === "joint").length, finalists: finalists.length, projectedFinalists: finalists.filter((pair) => pair.parentSource === "projected").length, jointFinalists: finalists.filter((pair) => pair.parentSource === "joint").length, tailsRebuilt, validCompletions, projectedValidCompletions, jointValidCompletions, contractFailures, improvingCompletions, projectedImprovingCompletions, jointImprovingCompletions, bestParentRank: best?.parentRank ?? null, bestParentSource: best?.parentSource ?? null, bestParentProjection: best?.parentProjection ?? null, bestChildRank: best?.childRank ??null, bestPairObjective: best?.objective ?? null, bestPairImpactError: best?.impactError ?? null });
    console.error(`  ${id}/s${seed}: gap ${weak.index}, ${baselineScore.toFixed(2)} -> ${bestScore.toFixed(2)}, baselineTail=${baselineTailRebuilt}, pairs=${pairs.length}, tails=${tailsRebuilt}/${finalists.length}, valid=${validCompletions}, ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }
}

const lifts = rows.map((row) => row.lift);
const result = {
  budget, parentCount, childCount, finalistsPerOrder, suffixMode, suffixBudget,
  parentImpactProjections, projectedParentsPerProjection, jointKnobParents, jointKnobChildren, ids, seeds,
  summary: {
    rows: rows.length,
    improved: rows.filter((row) => row.lift > 1e-9).length,
    meanLift: lifts.reduce((sum, lift) => sum + lift, 0) / Math.max(1, lifts.length),
    maxLift: Math.max(0, ...lifts),
    pairs: rows.reduce((sum, row) => sum + row.pairs, 0),
    projectedPairs: rows.reduce((sum, row) => sum + row.projectedPairs, 0),
    jointPairs: rows.reduce((sum, row) => sum + row.jointPairs, 0),
    finalists: rows.reduce((sum, row) => sum + row.finalists, 0),
    projectedFinalists: rows.reduce((sum, row) => sum + row.projectedFinalists, 0),
    jointFinalists: rows.reduce((sum, row) => sum + row.jointFinalists, 0),
    tailsRebuilt: rows.reduce((sum, row) => sum + row.tailsRebuilt, 0),
    validCompletions: rows.reduce((sum, row) => sum + row.validCompletions, 0),
    projectedValidCompletions: rows.reduce((sum, row) => sum + row.projectedValidCompletions, 0),
    jointValidCompletions: rows.reduce((sum, row) => sum + row.jointValidCompletions, 0),
    contractFailures: rows.reduce((sum, row) => sum + row.contractFailures, 0),
    projectedImprovingCompletions: rows.reduce((sum, row) => sum + row.projectedImprovingCompletions, 0),
    jointImprovingCompletions: rows.reduce((sum, row) => sum + row.jointImprovingCompletions, 0),
  }, rows,
};
console.log(JSON.stringify(result.summary, null, 2));
if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`rows -> ${outPath}`);
}
