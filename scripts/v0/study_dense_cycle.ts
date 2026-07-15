/**
 * Exact repeated-geometry reachability study for dense contact streams.
 *
 * Starting from the actual failing prefix, test whether a current admissible
 * catch can be translated to successive contact states and remain admissible.
 * This is deliberately not a compiler policy: it establishes whether a
 * state-relative periodic proposal exists before adding a sustained-run lane.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { makeRng } from "../lib/rng.ts";
import { applyJolt } from "../produce/seed.ts";
import { makeSolidLine } from "./arc.ts";
import { axisLookaheadEndFrame, translateTrackLines, tryCandidateLines } from "./core/candidate.ts";
import { effectiveAxes, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
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
import { nextContactGap } from "./optimizer/objective.ts";
import { planKinematicSupport } from "./optimizer/kinematic_support.ts";
import { getCandidateProbe, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { scoreDriftReport } from "./score.ts";
import { authoredSpeedToPx, CALIB, FPS, secToFrame, type AxisValues, type Gap, type Spec } from "./types.ts";
import type { LeafKey } from "./optimizer/register.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(
    "Usage: study_dense_cycle.ts [--seed=N] [--budget=N] [--parent-gap=N] " +
    "[--pool=N] [--depth=N] [--suffix-top=N] [--suffix-budget=N] " +
    "[--beam-width=N] [--beam-children=N] " +
    "[--mode=translate|state-normalized|energy-normalized|curved-energy|adaptive-beam] " +
    "[--ordering=prefix-value|joint-local-cost] " +
    "[--energy-blend=N] [--out=FILE]",
  );
  process.exit(0);
}

const seed = Number(arg("seed") ?? "24");
const budget = Number(arg("budget") ?? "250000");
const parentGap = Number(arg("parent-gap") ?? "51");
const poolSize = Number(arg("pool") ?? "128");
const depth = Number(arg("depth") ?? "3");
const suffixTop = Number(arg("suffix-top") ?? "8");
const suffixBudget = Number(arg("suffix-budget") ?? "132000");
const beamWidth = Number(arg("beam-width") ?? "12");
const beamChildren = Number(arg("beam-children") ?? "12");
const mode = arg("mode") ?? "translate";
const ordering = arg("ordering") ?? "prefix-value";
const energyBlend = Number(arg("energy-blend") ?? "0.35");
const outPath = arg("out");
for (const [name, value] of Object.entries({
  seed, budget, parentGap, poolSize, depth, suffixTop, suffixBudget, beamWidth, beamChildren,
})) {
  if (!Number.isSafeInteger(value) || value < 0 || (name !== "parentGap" && value === 0)) {
    throw new Error(`invalid --${name}`);
  }
}
if (
  mode !== "translate" && mode !== "state-normalized" && mode !== "energy-normalized" &&
  mode !== "curved-energy" && mode !== "adaptive-beam"
) {
  throw new Error(`invalid --mode=${mode} (translate|state-normalized|energy-normalized|curved-energy|adaptive-beam)`);
}
if (ordering !== "prefix-value" && ordering !== "joint-local-cost") {
  throw new Error("--ordering must be prefix-value|joint-local-cost");
}
if (!Number.isFinite(energyBlend) || energyBlend < 0 || energyBlend > 1) {
  throw new Error("--energy-blend must be in [0, 1]");
}

type Visited = { node: HandoffNode; key: LeafKey; event: HandoffNodeEvent };
type Cycle = {
  initialRank: number;
  sampleAttempt: number | null;
  jointLocalCost: number | null;
  steps: Array<{
    gap: number;
    geometryHash: string;
    lineCount: number;
    length: number;
    achievedSpeed: number | null;
    releaseSpeed: number | null;
    releaseVelocityY: number | null;
    releaseGroundedFrames: number | null;
    terminalAngleDeg: number;
  }>;
  search: SearchNode;
};
let adaptiveBeamLayers: Array<{ step: number; parents: number; emitted: number; retained: number }> | null = null;

const spec = applyJolt(dense, benchmarkPolicy.transform.joltMs);
const visited: Visited[] = [];
let winner: HandoffNode | null = null;
const checkpoint = compileHandoff(spec, seed, {
  budget,
  onNode(node, key, event) {
    visited.push({ node, key, event });
    if (event.improved) winner = node;
  },
});
if (winner === null) throw new Error("baseline compile produced no winner");
const deepest = visited.reduce((best, record) =>
  record.node.skippedContacts === 0 && record.node.search.gapIndex > best.search.gapIndex
    ? record.node
    : best,
  winner,
);

const setup = buildSetup(spec, seed);
setForwardEvalContext(setup.spec, setup.gapAxisTargets);
const target = visited
  .filter((record) => record.node.search.gapIndex === parentGap + 1)
  .filter((record) => isPrefix(record.node.search.prefixFits, deepest.search.prefixFits))
  .at(-1);
if (target === undefined) throw new Error(`winner did not reach target gap ${parentGap + 1}`);
const parent = visited
  .filter((record) => record.node.search.gapIndex === parentGap)
  .filter((record) => isPrefix(record.node.search.prefixFits, target.node.search.prefixFits))
  .at(-1);
if (parent === undefined) throw new Error(`winner lacks parent gap ${parentGap}`);

const initial = getCandidatesSorted(
  parent.node.search,
  setup.gaps,
  setup.ctx,
  parent.node.searchSeed,
  poolSize,
);
const failures: Record<string, number> = {};
const cycles: Cycle[] = mode === "adaptive-beam"
  ? extendAdaptiveBeam(
    parent.node.search, depth, setup, parent.node.searchSeed, beamWidth, beamChildren,
    ordering as "prefix-value" | "joint-local-cost",
  )
  : initial.flatMap((candidate, initialRank) => {
    const cycle = extendRepeatedCandidate(
      parent.node.search, candidate, initialRank, depth, setup, failures,
      mode as "translate" | "state-normalized" | "energy-normalized" | "curved-energy",
      energyBlend,
    );
    return cycle === null ? [] : [cycle];
  });

const suffixes = cycles.slice(0, suffixTop).map((cycle) => {
  const last = cycle.steps.at(-1)!;
  const node: HandoffNode = {
    ...parent.node,
    search: cycle.search,
    deferExpansion: false,
    rankTrace: [...parent.node.rankTrace, ...cycle.steps.map(() => ({ rank: -2, source: "reuse" as const }))],
  };
  const resumed = compileHandoffFromSnapshot(
    spec,
    seed,
    snapshotHandoffNode(node, parent.key, parent.event),
    { budget: suffixBudget },
  );
  const score = scoreDriftReport(resumed.report, { totalFrames: Math.round(spec.duration * FPS) });
  return {
    initialRank: cycle.initialRank,
    finalGap: last.gap,
    valid: score.contract_passed,
    score: round(score.score),
    contactsHit: resumed.report.contacts.filter((contact) => contact.status === "hit").length,
    deepestGap: resumed.stats.handoff_deepest_seen_gap ?? null,
    terminus: resumed.report.terminus,
  };
});
const baselineScore = scoreDriftReport(checkpoint.report, { totalFrames: Math.round(spec.duration * FPS) });
const output = {
  schema: "line.study-dense-cycle.v1",
  seed,
  budget,
  parentGap,
  mode,
  ordering: mode === "adaptive-beam" ? ordering : undefined,
  energyBlend,
  poolSize,
  depth,
  beamWidth: mode === "adaptive-beam" ? beamWidth : undefined,
  beamChildren: mode === "adaptive-beam" ? beamChildren : undefined,
  adaptiveBeamLayers,
  suffixBudget,
  baseline: {
    valid: baselineScore.contract_passed,
    score: round(baselineScore.score),
    deepestGap: checkpoint.stats.handoff_deepest_seen_gap ?? null,
  },
  initialCandidates: initial.length,
  cycleCandidates: cycles.length,
  failures,
  cycles: cycles.slice(0, 24).map((cycle) => ({
    initialRank: cycle.initialRank,
    sampleAttempt: cycle.sampleAttempt,
    jointLocalCost: cycle.jointLocalCost === null ? null : round(cycle.jointLocalCost),
    steps: cycle.steps,
  })),
  suffixes,
};
const json = `${JSON.stringify(output, null, 2)}\n`;
if (outPath === undefined) process.stdout.write(json);
else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json);
  console.error(`study -> ${outPath}`);
}

function extendRepeatedCandidate(
  initialNode: SearchNode,
  initialCandidate: Candidate,
  initialRank: number,
  requestedDepth: number,
  setup: ReturnType<typeof buildSetup>,
  failures: Record<string, number>,
  mode: "translate" | "state-normalized" | "energy-normalized" | "curved-energy",
  energyBlend: number,
): Cycle | null {
  let search = initialNode;
  let template = initialCandidate;
  const reference = getCandidateProbe(initialNode.prefixEngine, setup.gaps[initialNode.gapIndex], setup.ctx)
    .targetState;
  const steps: Cycle["steps"] = [];
  for (let step = 0; step < requestedDepth; step++) {
    const gap = setup.gaps[search.gapIndex];
    if (gap === undefined || !gap.endsWithContact) return null;
    const base = step === 0
      ? template
      : mode === "translate"
      ? translateTemplate(search, gap, template, setup.ctx)
      : transformNormalizedTemplate(search, gap, initialCandidate, reference, setup.ctx);
    const candidate = base === null || (mode !== "energy-normalized" && mode !== "curved-energy")
      ? base
      : energyNormalizeTemplate(search, gap, base, setup.gaps, setup.ctx, mode === "curved-energy", energyBlend);
    if (candidate === null) {
      failures[`step_${step}_not_admissible`] = (failures[`step_${step}_not_admissible`] ?? 0) + 1;
      return null;
    }
    candidate.ref = { x: getCandidateProbe(search.prefixEngine, gap, setup.ctx).targetState.sledX,
      y: getCandidateProbe(search.prefixEngine, gap, setup.ctx).targetState.sledY };
    steps.push({
      gap: gap.index,
      geometryHash: geometryHash(candidate),
      lineCount: candidate.lines.length,
      length: round(lineLength(candidate)),
      achievedSpeed: candidate.achieved.speed === undefined ? null : round(candidate.achieved.speed),
      releaseSpeed: candidate.releaseSpeed === undefined ? null : round(candidate.releaseSpeed),
      releaseVelocityY: candidate.releaseVelocityY === undefined ? null : round(candidate.releaseVelocityY),
      releaseGroundedFrames: candidate.releaseGroundedFrames ?? null,
      terminalAngleDeg: round(terminalAngleDeg(candidate)),
    });
    search = extendNodeCached(search, candidate);
    while (search.gapIndex < setup.gaps.length && !setup.gaps[search.gapIndex].endsWithContact) {
      search = extendNodeCached(search, null);
    }
    template = candidate;
  }
  return {
    initialRank,
    sampleAttempt: initialCandidate.sampleAttempt ?? null,
    jointLocalCost: null,
    steps,
    search,
  };
}

/**
 * Exact availability oracle for a coupled contact run. Every beam edge is a
 * normally generated, independently re-solved candidate at the child state;
 * only candidates that pass the ordinary physics gates can enter. The beam is
 * ranked by the shared scorer reconstruction for its *whole committed prefix*,
 * never by a case label or a cadence threshold. This is intentionally too
 * expensive for production and exists only to establish whether a bounded
 * coupled proposal has reachable material to work with.
 */
function extendAdaptiveBeam(
  root: SearchNode,
  requestedDepth: number,
  setup: ReturnType<typeof buildSetup>,
  searchSeed: number,
  width: number,
  children: number,
  ordering: "prefix-value" | "joint-local-cost",
): Cycle[] {
  type BeamEntry = {
    search: SearchNode;
    initialRank: number;
    sampleAttempt: number | null;
    steps: Cycle["steps"];
    value: number;
    jointLocalCost: number;
  };
  let frontier: BeamEntry[] = [{
    search: root,
    initialRank: -1,
    sampleAttempt: null,
    steps: [],
    value: objectiveLeafValue(root, setup.gaps, setup.ctx.durationFrames),
    jointLocalCost: 0,
  }];
  const layers: NonNullable<typeof adaptiveBeamLayers> = [];
  for (let step = 0; step < requestedDepth; step++) {
    const next: BeamEntry[] = [];
    for (const entry of frontier) {
      const candidates = getCandidatesSorted(entry.search, setup.gaps, setup.ctx, searchSeed, poolSize)
        .slice(0, children);
      for (const [rank, candidate] of candidates.entries()) {
        let child = extendNodeCached(entry.search, candidate);
        while (child.gapIndex < setup.gaps.length && !setup.gaps[child.gapIndex].endsWithContact) {
          child = extendNodeCached(child, null);
        }
        next.push({
          search: child,
          initialRank: entry.initialRank < 0 ? rank : entry.initialRank,
          sampleAttempt: entry.sampleAttempt ?? candidate.sampleAttempt ?? null,
          steps: [...entry.steps, {
            gap: entry.search.gapIndex,
            geometryHash: geometryHash(candidate),
            lineCount: candidate.lines.length,
            length: round(lineLength(candidate)),
            achievedSpeed: candidate.achieved.speed === undefined ? null : round(candidate.achieved.speed),
            releaseSpeed: candidate.releaseSpeed === undefined ? null : round(candidate.releaseSpeed),
            releaseVelocityY: candidate.releaseVelocityY === undefined ? null : round(candidate.releaseVelocityY),
            releaseGroundedFrames: candidate.releaseGroundedFrames ?? null,
            terminalAngleDeg: round(terminalAngleDeg(candidate)),
          }],
          value: objectiveLeafValue(child, setup.gaps, setup.ctx.durationFrames),
          jointLocalCost: entry.jointLocalCost + candidate.cost,
        });
      }
    }
    frontier = next
      .sort((a, b) => ordering === "joint-local-cost"
        ? a.jointLocalCost - b.jointLocalCost || b.value - a.value || a.initialRank - b.initialRank
        : b.value - a.value || a.jointLocalCost - b.jointLocalCost || a.initialRank - b.initialRank)
      .slice(0, width);
    layers.push({ step, parents: step === 0 ? 1 : layers.at(-1)!.retained, emitted: next.length, retained: frontier.length });
    if (frontier.length === 0) break;
  }
  adaptiveBeamLayers = layers;
  return frontier.map(({ search, initialRank, sampleAttempt, jointLocalCost, steps }) => ({
    search, initialRank, sampleAttempt, jointLocalCost, steps,
  }));
}

/**
 * Rebuild only the post-contact support from a physical speed/time plan. The
 * pre-contact catch stays supplied by the same normalized primitive; each
 * contact re-solves the support slope from the current entry state and next
 * authored speed. This is the smallest active-energy control worth testing.
 */
function energyNormalizeTemplate(
  node: SearchNode,
  gap: Gap,
  base: Candidate,
  gaps: Gap[],
  ctx: SpecContext,
  curved: boolean,
  blend: number,
): Candidate | null {
  const next = nextContactGap(gap, gaps);
  if (next === null || next.targets.air === undefined) return base;
  const probe = getCandidateProbe(node.prefixEngine, gap, ctx);
  const joint = closestJoint(base, probe.targetState.sledX, probe.targetState.sledY);
  if (joint === null) return null;
  const source = base.lines[joint];
  const plan = planKinematicSupport({
    air: next.targets.air,
    gapFrames: next.endFrame - gap.endFrame,
    entrySpeed: probe.targetState.speed,
    exitSpeed: next.targets.speed === undefined
      ? probe.targetState.speed
      : authoredSpeedToPx(next.targets.speed),
  });
  const prefix = base.lines.slice(0, joint).map((line, index) => ({ ...line, id: node.prefixNextLineId + index }));
  if (!curved) {
    const angle = plan.supportAngleDeg * Math.PI / 180;
    return tryCandidateLines(
      node.prefixEngine,
      gap,
      [...prefix, makeSolidLine(
        node.prefixNextLineId + prefix.length,
        source.x1,
        source.y1,
        source.x1 + Math.cos(angle) * plan.targetLength,
        source.y1 + Math.sin(angle) * plan.targetLength,
      )],
      node.prefixNextLineId,
      ctx.allContactFrames,
      axisLookaheadEndFrame(gap, ctx.allContactFrames),
      gap.targets,
      true,
      undefined,
      probe.preTargetSledTrace,
    ) as Candidate | null;
  }
  const inheritedTail = base.lines.slice(joint).reduce(
    (sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1),
    0,
  );
  const startAngle = Math.atan2(source.y2 - source.y1, source.x2 - source.x1);
  const inheritedEnd = base.lines.at(-1)!;
  const inheritedEndAngle = Math.atan2(
    inheritedEnd.y2 - inheritedEnd.y1,
    inheritedEnd.x2 - inheritedEnd.x1,
  );
  const terminalAngle = lerp(inheritedEndAngle, plan.supportAngleDeg * Math.PI / 180, blend);
  const totalLength = lerp(inheritedTail, plan.targetLength, blend);
  const segments = 4;
  const lines = [...prefix];
  let x = source.x1;
  let y = source.y1;
  for (let index = 0; index < segments; index++) {
    const t = smoothstep((index + 1) / segments);
    const angle = lerp(startAngle, terminalAngle, t);
    const nextX = x + Math.cos(angle) * totalLength / segments;
    const nextY = y + Math.sin(angle) * totalLength / segments;
    lines.push(makeSolidLine(node.prefixNextLineId + lines.length, x, y, nextX, nextY));
    x = nextX;
    y = nextY;
  }
  return tryCandidateLines(
    node.prefixEngine,
    gap,
    lines,
    node.prefixNextLineId,
    ctx.allContactFrames,
    axisLookaheadEndFrame(gap, ctx.allContactFrames),
    gap.targets,
    true,
    undefined,
    probe.preTargetSledTrace,
  ) as Candidate | null;
}

function closestJoint(candidate: Candidate, x: number, y: number): number | null {
  if (candidate.lines.length < 2) return null;
  let result = 1;
  let distance = Infinity;
  for (let index = 1; index < candidate.lines.length; index++) {
    const line = candidate.lines[index];
    const nextDistance = Math.hypot(line.x1 - x, line.y1 - y);
    if (nextDistance < distance) {
      result = index;
      distance = nextDistance;
    }
  }
  return result;
}

function transformNormalizedTemplate(
  node: SearchNode,
  gap: Gap,
  template: Candidate,
  reference: ReturnType<typeof getCandidateProbe>["targetState"],
  ctx: SpecContext,
): Candidate | null {
  const probe = getCandidateProbe(node.prefixEngine, gap, ctx);
  const scale = clamp(probe.targetState.speed / Math.max(1, reference.speed), 0.55, 1.8);
  const rotation = (probe.targetState.angleDeg - reference.angleDeg) * Math.PI / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const transformPoint = (x: number, y: number) => {
    const dx = (x - reference.sledX) * scale;
    const dy = (y - reference.sledY) * scale;
    return {
      x: probe.targetState.sledX + dx * cos - dy * sin,
      y: probe.targetState.sledY + dx * sin + dy * cos,
    };
  };
  const lines = template.lines.map((line, index) => {
    const start = transformPoint(line.x1, line.y1);
    const end = transformPoint(line.x2, line.y2);
    return { ...line, id: node.prefixNextLineId + index, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
  });
  return tryCandidateLines(
    node.prefixEngine,
    gap,
    lines,
    node.prefixNextLineId,
    ctx.allContactFrames,
    axisLookaheadEndFrame(gap, ctx.allContactFrames),
    gap.targets,
    true,
    undefined,
    probe.preTargetSledTrace,
  ) as Candidate | null;
}

function translateTemplate(
  node: SearchNode,
  gap: Gap,
  template: Candidate,
  ctx: SpecContext,
): Candidate | null {
  if (template.ref === undefined) return null;
  const probe = getCandidateProbe(node.prefixEngine, gap, ctx);
  return tryCandidateLines(
    node.prefixEngine,
    gap,
    translateTrackLines(template.lines, probe.targetState.sledX - template.ref.x,
      probe.targetState.sledY - template.ref.y, node.prefixNextLineId),
    node.prefixNextLineId,
    ctx.allContactFrames,
    axisLookaheadEndFrame(gap, ctx.allContactFrames),
    gap.targets,
    true,
    undefined,
    probe.preTargetSledTrace,
  ) as Candidate | null;
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
  const contactFrames = normalized.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(contactFrames, durationFrames);
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, normalized));
  const rng = makeRng(publicSeed);
  for (const gap of gaps) gap.targets = sampleGapTargets(gapAxisTargets[gap.index], normalized.jitter ?? CALIB.SIGMA, rng);
  const impactByFrame = new Map(normalized.contacts.flatMap((contact) => contact.impact === undefined
    ? [] : [[secToFrame(contact.t), contact.impact] as const]));
  for (const gap of gaps) {
    const impact = impactByFrame.get(gap.endFrame);
    if (gap.endsWithContact && impact !== undefined) {
      gap.targets.impact = impact;
      gapAxisTargets[gap.index].impact = impact;
    }
  }
  for (let index = 0; index + 1 < gaps.length; index++) {
    const next = gaps[index + 1];
    if (gaps[index].endsWithContact && next.endsWithContact && next.targets.impact !== undefined) {
      gaps[index].nextImpact = next.targets.impact;
    }
  }
  return { spec: normalized, gaps, gapAxisTargets, ctx: { allContactFrames: contactFrames, durationFrames, gapAxisTargets } };
}

function isPrefix(prefix: SearchNode["prefixFits"], full: SearchNode["prefixFits"]): boolean {
  return prefix.length <= full.length && prefix.every((fit, index) => fit === full[index]);
}

function lineLength(candidate: Candidate): number {
  return candidate.lines.reduce((sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1), 0);
}

function terminalAngleDeg(candidate: Candidate): number {
  const tail = candidate.lines.at(-1)!;
  return Math.atan2(tail.y2 - tail.y1, tail.x2 - tail.x1) * 180 / Math.PI;
}

function geometryHash(candidate: Candidate): string {
  return candidate.lines.map((line) => [line.x1, line.y1, line.x2, line.y2].map((value) => value.toFixed(3)).join(",")).join(";");
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(value: number): number {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}
