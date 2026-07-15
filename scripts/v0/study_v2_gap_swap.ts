/**
 * V2-native post-completion local-replacement oracle.
 *
 * Starting from a completed compiler result, this replaces one already chosen
 * contact arc with a current-generator alternative, translates and re-fits the
 * accepted suffix, then scores the whole track exactly.  It deliberately makes
 * no production-policy claim: its job is to measure whether a small, generic
 * post-completion polish pass could recover quality that the normal search and
 * axis-SSE repair selector did not inspect.
 *
 * The incumbent suffix must replay bit-for-bit before an alternative is
 * considered.  Targets use V2's literal authored impact semantics; this tool
 * must never recreate V1's retired feasibility cap.
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
import { compileHandoff, setForwardEvalContext, type HandoffNode } from "./optimizer/handoff.ts";
import { extendNodeCached, getCandidatesSorted, makeRootNode, type SearchNode } from "./optimizer/node.ts";
import { getCandidateProbe, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { isStrictlyBetter, type LeafKey } from "./optimizer/register.ts";
import { scoreDriftReport } from "./score.ts";
import { CALIB, FPS, secToFrame, type AxisValues, type Gap } from "./types.ts";
import type { Spec } from "./optimizer/types.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const ids = (arg("specs") ?? "countercurrent").split(",");
const seeds = (arg("seeds") ?? "0").split(",").map(Number);
const budget = Number(arg("budget") ?? "500000");
const gapsToSwap = (arg("gaps") ?? "").split(",").filter(Boolean).map(Number);
const candidateCount = Number(arg("candidates") ?? "8");
const outPath = arg("out");

if (!Number.isInteger(budget) || budget <= 0) throw new Error("--budget must be a positive integer");
if (!Number.isInteger(candidateCount) || candidateCount <= 0) throw new Error("--candidates must be a positive integer");
if (gapsToSwap.length === 0 || gapsToSwap.some((gap) => !Number.isInteger(gap) || gap < 0)) {
  throw new Error("--gaps must contain one or more non-negative gap indices");
}
if (seeds.some((seed) => !Number.isSafeInteger(seed))) throw new Error("--seeds must be safe integers");

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

function scoreTerminal(node: SearchNode, setup: Setup) {
  const detection = detectWindow(node.prefixEngine, 0, setup.durationFrames + 20);
  const report = buildDriftReport(
    detection,
    setup.spec,
    setup.gaps,
    setup.frames,
    setup.durationFrames,
    [],
    node.prefixFits,
    setup.targets,
  );
  return scoreDriftReport(report, { totalFrames: setup.durationFrames });
}

type CandidateOutcome = {
  rank: number;
  objective: number;
  score: number | null;
  contractPassed: boolean | null;
  lift: number | null;
};
type Row = {
  spec: string;
  seed: number;
  gap: number;
  baselineScore: number;
  baselineTailRebuilt: boolean;
  candidatesGenerated: number;
  tailsRebuilt: number;
  validCompletions: number;
  bestScore: number;
  lift: number;
  outcomes: CandidateOutcome[];
};

const rows: Row[] = [];
for (const id of ids) {
  for (const seed of seeds) {
    const started = Date.now();
    const userSpec = applyJolt(cases.get(id)!, benchmarkPolicy.transform.joltMs);
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
    if (winner === null) {
      console.error(`  ${id}/s${seed}: no complete incumbent`);
      continue;
    }
    setForwardEvalContext(setup.spec, setup.targets);
    for (const gapIndex of gapsToSwap) {
      const gap = setup.gaps[gapIndex];
      if (gap === undefined || !gap.endsWithContact || winner.search.prefixFits[gapIndex] === null) {
        console.error(`  ${id}/s${seed}/g${gapIndex}: unavailable contact gap`);
        continue;
      }
      const baselineTail = rebuildGuidedTail(reconstructEntry(winner, setup.gaps, gapIndex), winner.search.prefixFits, setup.gaps, setup.ctx);
      const replay = baselineTail === null ? null : scoreTerminal(baselineTail, setup);
      const baselineTailRebuilt = replay !== null && replay.contract_passed && Math.abs(replay.score - baselineScore) <= 1e-9;
      if (!baselineTailRebuilt) {
        throw new Error(`${id}/s${seed}/g${gapIndex}: incumbent suffix replay diverged (baseline=${baselineScore}, replay=${replay?.score ?? "none"})`);
      }
      const entry = reconstructEntry(winner, setup.gaps, gapIndex);
      const alternatives = getCandidatesSorted(entry, setup.gaps, setup.ctx, winner.searchSeed, candidateCount);
      const outcomes: CandidateOutcome[] = [];
      let tailsRebuilt = 0;
      let validCompletions = 0;
      let bestScore = baselineScore;
      for (const [rank, candidate] of alternatives.entries()) {
        const terminal = rebuildGuidedTail(extendNodeCached(entry, candidate), winner.search.prefixFits, setup.gaps, setup.ctx);
        if (terminal === null) {
          outcomes.push({ rank, objective: candidate.cost, score: null, contractPassed: null, lift: null });
          continue;
        }
        tailsRebuilt++;
        const score = scoreTerminal(terminal, setup);
        if (score.contract_passed) validCompletions++;
        const lift = score.contract_passed ? score.score - baselineScore : null;
        outcomes.push({ rank, objective: candidate.cost, score: score.score, contractPassed: score.contract_passed, lift });
        if (lift !== null && lift > 0) bestScore = Math.max(bestScore, score.score);
      }
      rows.push({
        spec: id,
        seed,
        gap: gapIndex,
        baselineScore,
        baselineTailRebuilt,
        candidatesGenerated: alternatives.length,
        tailsRebuilt,
        validCompletions,
        bestScore,
        lift: bestScore - baselineScore,
        outcomes,
      });
      console.error(`  ${id}/s${seed}/g${gapIndex}: ${baselineScore.toFixed(2)} -> ${bestScore.toFixed(2)}, pool=${alternatives.length}, tails=${tailsRebuilt}, valid=${validCompletions}, ${(Date.now() - started) / 1000}s`);
    }
  }
}

const lifts = rows.map((row) => row.lift);
const result = {
  ids,
  seeds,
  budget,
  gaps: gapsToSwap,
  candidateCount,
  semantics: "V2 literal authored impacts; exact full-track score; guided incumbent suffix replay required",
  summary: {
    rows: rows.length,
    improved: rows.filter((row) => row.lift > 1e-9).length,
    meanLift: lifts.reduce((sum, value) => sum + value, 0) / Math.max(1, lifts.length),
    maxLift: Math.max(0, ...lifts),
    validCompletions: rows.reduce((sum, row) => sum + row.validCompletions, 0),
    tailsRebuilt: rows.reduce((sum, row) => sum + row.tailsRebuilt, 0),
  },
  rows,
};
console.log(JSON.stringify(result.summary, null, 2));
if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`rows -> ${outPath}`);
}
