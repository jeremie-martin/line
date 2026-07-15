/** Exact oracle for coordinated parent-entry + impact-catch replacements. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { K_BOUNCE_LANDING } from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import {
  buildDriftReport,
  effectiveAxes,
  engineLineFromTrackLine,
  impactFeasibilityBound,
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
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import {
  compileHandoff,
  compileHandoffFromSnapshot,
  objectiveLeafValue,
  setForwardEvalContext,
  snapshotHandoffNode,
  type HandoffNode,
} from "./optimizer/handoff.ts";
import {
  extendNodeCached,
  getCandidatesSorted,
  makeRootNode,
  type SearchNode,
} from "./optimizer/node.ts";
import { getCandidateProbe } from "./optimizer/sample.ts";
import { isStrictlyBetter, type LeafKey } from "./optimizer/register.ts";
import type { Candidate, SpecContext } from "./optimizer/sample.ts";
import { scoreDriftReport } from "./score.ts";
import {
  CALIB,
  FPS,
  secToFrame,
  type AxisValues,
  type Gap,
} from "./types.ts";
import type { Spec } from "./optimizer/types.ts";

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: npx tsx scripts/v0/study_terminal_impact_pair.ts " +
      "[--specs=id,...] [--seeds=n,...] [--budget=n] [--parents=n] " +
      "[--children=n] [--finalists=n] [--suffix=guided|search] [--out=path]\n",
  );
  process.exit(0);
}
const argValue = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const defaultSpecs = "drums_pendulum,drums_dropout,dense_echo_climb,drums_crescendo";
const specs = (argValue("specs") ?? defaultSpecs).split(",") as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0").split(",").map(Number);
const budget = Number(argValue("budget") ?? "200000");
const parentCount = Number(argValue("parents") ?? "32");
const childCount = Number(argValue("children") ?? "32");
const finalistsPerOrder = Number(argValue("finalists") ?? "8");
const candidateSeedCount = Number(argValue("candidate-seeds") ?? "5");
const suffixMode = argValue("suffix") ?? "guided";
const suffixBudget = Number(argValue("suffix-budget") ?? "75000");
const fixedParentSeedArg = argValue("fixed-parent-seed-ordinal");
const fixedParentSeedOrdinal = fixedParentSeedArg === undefined
  ? undefined
  : Number(fixedParentSeedArg);
const fixedParentRankArg = argValue("fixed-parent-rank");
const fixedParentRank = fixedParentRankArg === undefined ? undefined : Number(fixedParentRankArg);
const finalistSelection = argValue("selection") ?? "both";
const outPath = argValue("out");

for (const spec of specs) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(spec)) throw new Error(`unknown spec "${spec}"`);
}
for (const value of [
  budget,
  parentCount,
  childCount,
  finalistsPerOrder,
  candidateSeedCount,
  suffixBudget,
]) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`invalid positive integer ${value}`);
}
if (suffixMode !== "guided" && suffixMode !== "search") {
  throw new Error(`invalid suffix mode "${suffixMode}"`);
}
for (const value of [fixedParentSeedOrdinal, fixedParentRank]) {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`invalid non-negative integer ${value}`);
  }
}
if (finalistSelection !== "objective" && finalistSelection !== "impact" && finalistSelection !== "both") {
  throw new Error(`invalid finalist selection "${finalistSelection}"`);
}

type SearchSetup = {
  spec: Spec;
  gaps: Gap[];
  gapAxisTargets: AxisValues[];
  contactFrames: number[];
  durationFrames: number;
  ctx: SpecContext;
};

function buildSearchSetup(userSpec: Spec, seed: number): SearchSetup {
  const contacts = userSpec.contacts.filter((contact) => secToFrame(contact.t) >= K_BOUNCE_LANDING);
  const spec: Spec = { ...userSpec, preroll: undefined, contacts };
  const durationFrames = secToFrame(spec.duration);
  const contactFrames = contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(contactFrames, durationFrames);
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(seed);
  for (const gap of gaps) {
    gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);
  }
  const impactByFrame = new Map(contacts.flatMap((contact) =>
    contact.impact === undefined
      ? []
      : [[secToFrame(contact.t), contact.impact] as const]
  ));
  for (const gap of gaps) {
    if (!gap.endsWithContact) continue;
    const impact = impactByFrame.get(gap.endFrame);
    if (impact === undefined) continue;
    const next = contactFrames.find((frame) => frame > gap.endFrame);
    const nextSeconds = next === undefined ? 1.5 : (next - gap.endFrame) / FPS;
    const bounded = Math.min(
      impact,
      impactFeasibilityBound(
        gapAxisTargets[gap.index].speed,
        (gap.endFrame - gap.startFrame) / FPS,
        nextSeconds,
      ),
    );
    gap.targets.impact = bounded;
    gapAxisTargets[gap.index].impact = bounded;
  }
  for (let index = 0; index + 1 < gaps.length; index++) {
    if (gaps[index].endsWithContact && gaps[index + 1].endsWithContact) {
      gaps[index].nextImpact = gaps[index + 1].targets.impact;
    }
  }
  return {
    spec,
    gaps,
    gapAxisTargets,
    contactFrames,
    durationFrames,
    ctx: { allContactFrames: contactFrames, durationFrames, gapAxisTargets },
  };
}

function reconstructEntry(node: HandoffNode, gaps: Gap[], gapIndex: number): SearchNode {
  let engine = makeBaseEngine(node.startState);
  if (node.startLines.length > 0) {
    engine = engine.addLine(node.startLines.map((line) => engineLineFromTrackLine(line)));
  }
  let entry: SearchNode = {
    ...makeRootNode(engine, gaps.length),
    prefixNextLineId: 1 + node.startLines.length,
  };
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
    const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
    const candidate = guide.arc === null
      ? tryCandidateLines(
        node.prefixEngine,
        gap,
        translateTrackLines(guide.lines, dx, dy, node.prefixNextLineId),
        node.prefixNextLineId,
        ctx.allContactFrames,
        axisMeasureEnd,
        gap.targets,
        true,
        undefined,
        probe.preTargetSledTrace,
      )
      : tryCandidate(
        node.prefixEngine,
        gap,
        { ...guide.arc, anchor: { x: guide.arc.anchor.x + dx, y: guide.arc.anchor.y + dy } },
        node.prefixNextLineId,
        ctx.allContactFrames,
        axisMeasureEnd,
        gap.targets,
        true,
        undefined,
        probe.preTargetSledTrace,
      );
    if (candidate === null) return null;
    candidate.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
    node = extendNodeCached(node, candidate);
  }
  return node;
}

type Pair = {
  parentRank: number;
  parentSeedOrdinal: number;
  parentLocalRank: number;
  parentSampleAttempt: number | null;
  childRank: number;
  childSampleAttempt: number | null;
  node: SearchNode;
  objective: number;
  impactError: number;
};

type Row = {
  spec: GoldenSpecName;
  seed: number;
  impactGap: number;
  baselineScore: number;
  bestScore: number;
  lift: number;
  parentCandidates: number;
  parentsWithChildren: number;
  pairs: number;
  finalists: number;
  validCompletions: number;
  improvingCompletions: number;
  bestParentRank: number;
  bestParentSeedOrdinal: number;
  bestParentLocalRank: number;
  bestParentSampleAttempt: number | null;
  bestChildRank: number;
  bestChildSampleAttempt: number | null;
  bestPairObjective: number | null;
  bestPairImpactError: number | null;
  bestSelection: "objective" | "impact" | "both" | null;
};

const rows: Row[] = [];
for (const specName of specs) {
  const userSpec = await loadGoldenSpec(specName, "base");
  for (const seed of seeds) {
    const started = Date.now();
    let winningNode: HandoffNode | null = null;
    let winningKey: LeafKey | null = null;
    const checkpoint = compileHandoff(userSpec, seed, {
      budget,
      onNode: (node, key, event) => {
        if (!event.fullDuration) return;
        if (winningKey === null || isStrictlyBetter(key, winningKey)) {
          winningNode = node;
          winningKey = key;
        }
      },
    });
    if (winningNode === null) throw new Error(`${specName}/s${seed}: no complete incumbent`);
    const winner: HandoffNode = winningNode;
    const setup = buildSearchSetup(userSpec, seed);
    const { spec, gaps, gapAxisTargets, contactFrames, durationFrames, ctx } = setup;
    setForwardEvalContext(spec, gapAxisTargets);
    const weak = checkpoint.report.gaps
      .flatMap((gap) => {
        const impact = gap.axes.impact;
        return impact !== undefined && impact.achieved < impact.target && gap.gap_index > 0
          ? [{ index: gap.gap_index, error: impact.error }]
          : [];
      })
      .filter(({ index }) =>
        gaps[index - 1]?.endsWithContact &&
        gaps[index]?.endsWithContact &&
        winner.search.prefixFits[index - 1] !== null &&
        winner.search.prefixFits[index] !== null
      )
      .sort((a, b) => b.error * b.error - a.error * a.error || a.index - b.index)[0];
    if (weak === undefined) continue;

    const parentIndex = weak.index - 1;
    const entry = reconstructEntry(winner, gaps, parentIndex);
    const candidateSeeds = Array.from({ length: candidateSeedCount }, (_, ordinal) =>
      ordinal === 0
        ? winner.searchSeed
        : ((winner.searchSeed | 0) ^ Math.imul(ordinal, 0x9e3779b1)) | 0
    );
    const parents = candidateSeeds.flatMap((candidateSeed, seedOrdinal) =>
      fixedParentSeedOrdinal !== undefined && seedOrdinal !== fixedParentSeedOrdinal
        ? []
        :
      getCandidatesSorted(entry, gaps, ctx, candidateSeed, parentCount).map((candidate, localRank) => ({
        candidate,
        candidateSeed,
        seedOrdinal,
        localRank,
      }))
    ).filter((parent) => fixedParentRank === undefined || parent.localRank === fixedParentRank);
    const pairs: Pair[] = [];
    let parentsWithChildren = 0;
    for (let parentRank = 0; parentRank < parents.length; parentRank++) {
      const parent = parents[parentRank];
      let parentNode = extendNodeCached(entry, parent.candidate);
      while (parentNode.gapIndex < weak.index) parentNode = extendNodeCached(parentNode, null);
      const children = getCandidatesSorted(
        parentNode,
        gaps,
        ctx,
        parent.candidateSeed,
        childCount,
      );
      if (children.length > 0) parentsWithChildren++;
      for (let childRank = 0; childRank < children.length; childRank++) {
        const node = extendNodeCached(parentNode, children[childRank]);
        const achieved = children[childRank].achievedAtEnd ?? children[childRank].achieved;
        const target = gapAxisTargets[weak.index].impact;
        if (target === undefined || achieved.impact === undefined) continue;
        pairs.push({
          parentRank,
          parentSeedOrdinal: parent.seedOrdinal,
          parentLocalRank: parent.localRank,
          parentSampleAttempt: parent.candidate.sampleAttempt ?? null,
          childRank,
          childSampleAttempt: children[childRank].sampleAttempt ?? null,
          node,
          objective: objectiveLeafValue(node, gaps, durationFrames),
          impactError: Math.abs(achieved.impact - target),
        });
      }
    }
    const byObjective = [...pairs]
      .sort((a, b) => b.objective - a.objective || a.impactError - b.impactError)
      .slice(0, finalistsPerOrder);
    const byImpact = [...pairs]
      .sort((a, b) => a.impactError - b.impactError || b.objective - a.objective)
      .slice(0, finalistsPerOrder);
    const selectedPairs = finalistSelection === "objective"
      ? byObjective
      : finalistSelection === "impact" ? byImpact : [...byObjective, ...byImpact];
    const finalists = [...new Map(selectedPairs.map((pair) => [
      `${pair.parentRank}:${pair.childRank}`,
      pair,
    ])).values()];
    const baselineScore = scoreDriftReport(checkpoint.report, { totalFrames: durationFrames }).score;
    let bestScore = baselineScore;
    let bestParentRank = -1;
    let bestParentSeedOrdinal = -1;
    let bestParentLocalRank = -1;
    let bestParentSampleAttempt: number | null = null;
    let bestChildRank = -1;
    let bestChildSampleAttempt: number | null = null;
    let bestPairObjective: number | null = null;
    let bestPairImpactError: number | null = null;
    let bestSelection: Row["bestSelection"] = null;
    const objectiveKeys = new Set(byObjective.map((pair) => `${pair.parentRank}:${pair.childRank}`));
    const impactKeys = new Set(byImpact.map((pair) => `${pair.parentRank}:${pair.childRank}`));
    let validCompletions = 0;
    let improvingCompletions = 0;
    for (const pair of finalists) {
      const score = suffixMode === "search"
        ? (() => {
          const pairHandoff: HandoffNode = {
            ...winner,
            search: pair.node,
            deferExpansion: false,
            rankTrace: winner.rankTrace.slice(0, pair.node.gapIndex),
            skippedContacts: 0,
          };
          const snapshot = snapshotHandoffNode(pairHandoff, winningKey!, {
            phase: "main",
            simFrames: 0,
            fullDuration: false,
            outputDurationFrames: gaps[Math.max(0, pair.node.gapIndex - 1)]?.endFrame ?? 0,
            improved: false,
            improvementCount: 0,
            consideredCount: 0,
          });
          const completion = compileHandoffFromSnapshot(
            userSpec,
            seed,
            snapshot,
            { budget: suffixBudget },
          );
          return scoreDriftReport(completion.report, { totalFrames: durationFrames });
        })()
        : (() => {
          const terminal = rebuildGuidedTail(pair.node, winner.search.prefixFits, gaps, ctx);
          if (terminal === null) return null;
          const detection = detectWindow(terminal.prefixEngine, 0, durationFrames + 20);
          const report = buildDriftReport(
            detection,
            spec,
            gaps,
            contactFrames,
            durationFrames,
            [],
            terminal.prefixFits,
            gapAxisTargets,
          );
          return scoreDriftReport(report, { totalFrames: durationFrames });
        })();
      if (score === null) continue;
      if (!score.contract_passed) continue;
      validCompletions++;
      if (score.score > baselineScore) improvingCompletions++;
      if (score.score > bestScore) {
        bestScore = score.score;
        bestParentRank = pair.parentRank;
        bestParentSeedOrdinal = pair.parentSeedOrdinal;
        bestParentLocalRank = pair.parentLocalRank;
        bestParentSampleAttempt = pair.parentSampleAttempt;
        bestChildRank = pair.childRank;
        bestChildSampleAttempt = pair.childSampleAttempt;
        bestPairObjective = pair.objective;
        bestPairImpactError = pair.impactError;
        const key = `${pair.parentRank}:${pair.childRank}`;
        bestSelection = objectiveKeys.has(key) && impactKeys.has(key)
          ? "both"
          : objectiveKeys.has(key) ? "objective" : "impact";
      }
    }
    rows.push({
      spec: specName,
      seed,
      impactGap: weak.index,
      baselineScore,
      bestScore,
      lift: bestScore - baselineScore,
      parentCandidates: parents.length,
      parentsWithChildren,
      pairs: pairs.length,
      finalists: finalists.length,
      validCompletions,
      improvingCompletions,
      bestParentRank,
      bestParentSeedOrdinal,
      bestParentLocalRank,
      bestParentSampleAttempt,
      bestChildRank,
      bestChildSampleAttempt,
      bestPairObjective,
      bestPairImpactError,
      bestSelection,
    });
    console.error(
      `  ${specName}/s${seed}: gap ${weak.index}, ${baselineScore.toFixed(2)} -> ` +
        `${bestScore.toFixed(2)}, parents=${parents.length}, childParents=${parentsWithChildren}, ` +
        `${validCompletions}/${finalists.length} valid, ` +
        `${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
}

const lifts = rows.map((row) => row.lift);
const result = {
  budget,
  parentCount,
  childCount,
  finalistsPerOrder,
  candidateSeedCount,
  suffixMode,
  suffixBudget,
  ...(fixedParentSeedOrdinal === undefined ? {} : { fixedParentSeedOrdinal }),
  ...(fixedParentRank === undefined ? {} : { fixedParentRank }),
  finalistSelection,
  specs,
  seeds,
  summary: {
    rows: rows.length,
    improved: rows.filter((row) => row.lift > 1e-9).length,
    meanLift: lifts.reduce((sum, lift) => sum + lift, 0) / Math.max(1, lifts.length),
    maxLift: Math.max(0, ...lifts),
    pairs: rows.reduce((sum, row) => sum + row.pairs, 0),
    finalists: rows.reduce((sum, row) => sum + row.finalists, 0),
    validCompletions: rows.reduce((sum, row) => sum + row.validCompletions, 0),
  },
  rows,
};
console.log(JSON.stringify(result.summary, null, 2));
if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`rows -> ${outPath}`);
}
