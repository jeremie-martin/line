/** Exact oracle for replacing one incumbent gap fit while preserving its suffix. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { makeRng } from "../lib/rng.ts";
import { K_BOUNCE_LANDING } from "../lib/detector.ts";
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
  setForwardEvalContext,
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
  type TrackLine,
} from "./types.ts";
import type { Spec } from "./optimizer/types.ts";

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: npx tsx scripts/v0/study_terminal_gap_swap.ts " +
      "[--specs=id,...|all] [--seeds=n,...] [--budget=n] [--candidates=n] " +
      "[--candidate-seed-count=n] [--suffix=fixed|release-translate|guided-rebuild] [--out=path]\n",
  );
  process.exit(0);
}
const argValue = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const defaultSpecs = [
  "drums_pendulum", "drums_dropout", "dense_echo_climb", "skyline_push",
].join(",");
const specArg = argValue("specs") ?? defaultSpecs;
const specs = (specArg === "all" ? [...GOLDEN_SPECS] : specArg.split(",")) as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0").split(",").map(Number);
const budget = Number(argValue("budget") ?? "200000");
const candidateCount = Number(argValue("candidates") ?? "32");
const candidateSeedCount = Number(argValue("candidate-seed-count") ?? "1");
const suffixMode = argValue("suffix") ?? "fixed";
const outPath = argValue("out");

if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error(`invalid budget ${budget}`);
if (!Number.isSafeInteger(candidateCount) || candidateCount <= 0) {
  throw new Error(`invalid candidate count ${candidateCount}`);
}
if (!Number.isSafeInteger(candidateSeedCount) || candidateSeedCount <= 0) {
  throw new Error(`invalid candidate seed count ${candidateSeedCount}`);
}
if (
  suffixMode !== "fixed" &&
  suffixMode !== "release-translate" &&
  suffixMode !== "guided-rebuild"
) {
  throw new Error(`invalid suffix mode "${suffixMode}"`);
}
for (const spec of specs) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(spec)) throw new Error(`unknown spec "${spec}"`);
}
for (const seed of seeds) {
  if (!Number.isSafeInteger(seed)) throw new Error(`invalid seed ${seed}`);
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
    gap.targets = sampleGapTargets(
      gapAxisTargets[gap.index],
      spec.jitter ?? CALIB.SIGMA,
      rng,
    );
  }
  const impactByFrame = new Map(
    contacts.flatMap((contact) => contact.impact === undefined
      ? []
      : [[secToFrame(contact.t), contact.impact] as const]),
  );
  for (const gap of gaps) {
    if (!gap.endsWithContact) continue;
    const impact = impactByFrame.get(gap.endFrame);
    if (impact === undefined) continue;
    const nextContact = contactFrames.find((frame) => frame > gap.endFrame);
    const nextSeconds = nextContact === undefined ? 1.5 : (nextContact - gap.endFrame) / FPS;
    const previousSeconds = (gap.endFrame - gap.startFrame) / FPS;
    const bounded = Math.min(
      impact,
      impactFeasibilityBound(gapAxisTargets[gap.index].speed, previousSeconds, nextSeconds),
    );
    gap.targets.impact = bounded;
    gapAxisTargets[gap.index].impact = bounded;
  }
  for (let index = 0; index + 1 < gaps.length; index++) {
    const next = gaps[index + 1];
    if (gaps[index].endsWithContact && next.endsWithContact && next.targets.impact !== undefined) {
      gaps[index].nextImpact = next.targets.impact;
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

function renumberFits(
  fits: readonly (GapFit | null)[],
  firstLineId: number,
): (GapFit | null)[] {
  let nextId = firstLineId;
  return fits.map((fit) => {
    if (fit === null) return null;
    const lines = fit.lines.map((line) => ({ ...line, id: nextId++ }));
    return { ...fit, lines };
  });
}

function geometryKey(lines: readonly TrackLine[]): string {
  return JSON.stringify(lines.map((line) => [
    line.type, line.x1, line.y1, line.x2, line.y2, line.flipped,
  ]));
}

function rebuildGuidedSuffix(
  entry: SearchNode,
  anchorCandidate: Candidate,
  incumbentFits: readonly (GapFit | null)[],
  gaps: Gap[],
  ctx: SpecContext,
): SearchNode | null {
  let node = extendNodeCached(entry, anchorCandidate);
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
        {
          ...guide.arc,
          anchor: { x: guide.arc.anchor.x + dx, y: guide.arc.anchor.y + dy },
        },
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

type SwapRow = {
  spec: GoldenSpecName;
  seed: number;
  gap: number;
  baselineScore: number;
  bestScore: number;
  bestCandidateRank: number;
  sampled: number;
  distinct: number;
  valid: number;
  improved: number;
};

const rows: SwapRow[] = [];
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
    if (winningNode === null) throw new Error(`${specName}/s${seed}: no complete incumbent node`);
    const winner: HandoffNode = winningNode;
    const setup = buildSearchSetup(userSpec, seed);
    const { spec, gaps, gapAxisTargets, contactFrames, durationFrames, ctx } = setup;
    setForwardEvalContext(spec, gapAxisTargets);
    const gap = checkpoint.report.gaps
      .map((report) => ({
        index: report.gap_index,
        sse: Object.values(report.axes).reduce(
          (sum, value) => sum + value.error * value.error,
          0,
        ),
      }))
      .filter(({ index }) => gaps[index]?.endsWithContact && winner.search.prefixFits[index] !== null)
      .sort((a, b) => b.sse - a.sse || a.index - b.index)[0];
    if (gap === undefined) throw new Error(`${specName}/s${seed}: no swappable gap`);

    const entry = reconstructEntry(winner, gaps, gap.index);
    const candidates = Array.from({ length: candidateSeedCount }, (_, ordinal) => {
      const candidateSeed = ordinal === 0
        ? winner.searchSeed
        : ((winner.searchSeed | 0) ^ Math.imul(ordinal, 0x9e3779b1)) | 0;
      return getCandidatesSorted(entry, gaps, ctx, candidateSeed, candidateCount);
    }).flat();
    const incumbentFit = winner.search.prefixFits[gap.index];
    if (incumbentFit === null || incumbentFit === undefined) {
      throw new Error(`${specName}/s${seed}: weak gap ${gap.index} has no fit`);
    }
    const incumbentGeometry = geometryKey(incumbentFit.lines);
    const baselineScore = scoreDriftReport(checkpoint.report, { totalFrames: durationFrames }).score;
    let bestScore = baselineScore;
    let bestCandidateRank = -1;
    let distinct = 0;
    let valid = 0;
    let improved = 0;
    for (let rank = 0; rank < candidates.length; rank++) {
      const candidate = candidates[rank];
      if (geometryKey(candidate.lines) === incumbentGeometry) continue;
      distinct++;
      if (suffixMode === "guided-rebuild") {
        const terminal = rebuildGuidedSuffix(
          entry,
          candidate,
          winner.search.prefixFits,
          gaps,
          ctx,
        );
        if (terminal === null) continue;
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
        const score = scoreDriftReport(report, { totalFrames: durationFrames });
        if (!score.contract_passed) continue;
        valid++;
        if (score.score > baselineScore) improved++;
        if (score.score > bestScore) {
          bestScore = score.score;
          bestCandidateRank = rank;
        }
        continue;
      }
      const rawFits = [...winner.search.prefixFits];
      rawFits[gap.index] = candidate;
      if (suffixMode === "release-translate") {
        const from = incumbentFit.releaseArrivalState;
        const to = candidate.releaseArrivalState;
        if (from === undefined || to === undefined) continue;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        for (let index = gap.index + 1; index < rawFits.length; index++) {
          const fit = rawFits[index];
          if (fit === null) continue;
          rawFits[index] = {
            ...fit,
            lines: fit.lines.map((line) => ({
              ...line,
              x1: line.x1 + dx,
              y1: line.y1 + dy,
              x2: line.x2 + dx,
              y2: line.y2 + dy,
            })),
          };
        }
      }
      const fits = renumberFits(rawFits, 1 + winner.startLines.length);
      let engine = makeBaseEngine(winner.startState);
      if (winner.startLines.length > 0) {
        engine = engine.addLine(winner.startLines.map((line) => engineLineFromTrackLine(line)));
      }
      for (const fit of fits) {
        if (fit !== null) engine = engine.addLine(fit.lines.map((line) => engineLineFromTrackLine(line)));
      }
      const detection = detectWindow(engine, 0, durationFrames + 20);
      const report = buildDriftReport(
        detection,
        spec,
        gaps,
        contactFrames,
        durationFrames,
        [],
        fits,
        gapAxisTargets,
      );
      const score = scoreDriftReport(report, { totalFrames: durationFrames });
      if (!score.contract_passed) continue;
      valid++;
      if (score.score > baselineScore) improved++;
      if (score.score > bestScore) {
        bestScore = score.score;
        bestCandidateRank = rank;
      }
    }
    rows.push({
      spec: specName,
      seed,
      gap: gap.index,
      baselineScore,
      bestScore,
      bestCandidateRank,
      sampled: candidates.length,
      distinct,
      valid,
      improved,
    });
    console.error(
      `  ${specName}/s${seed}: gap ${gap.index}, ${baselineScore.toFixed(2)} -> ` +
        `${bestScore.toFixed(2)}, ${valid}/${distinct} valid, ` +
        `${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
}

const lifts = rows.map((row) => row.bestScore - row.baselineScore);
const result = {
  budget,
  candidateCount,
  candidateSeedCount,
  suffixMode,
  specs,
  seeds,
  summary: {
    rows: rows.length,
    improved: lifts.filter((lift) => lift > 1e-9).length,
    meanLift: lifts.reduce((sum, lift) => sum + lift, 0) / Math.max(1, lifts.length),
    maxLift: Math.max(0, ...lifts),
    validSwaps: rows.reduce((sum, row) => sum + row.valid, 0),
    distinctSwaps: rows.reduce((sum, row) => sum + row.distinct, 0),
  },
  rows,
};
console.log(JSON.stringify(result.summary, null, 2));
if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`rows -> ${outPath}`);
}
