/**
 * Reachability oracle for a short coupled prefix of ordinary candidates.
 *
 * This is deliberately not a compiler policy. It captures an actual handoff
 * prefix, expands a bounded beam using the unchanged candidate generator and
 * exact gates, then resumes normal search from each retained state. The result
 * answers one narrow question: is a distinct multi-contact state reachable
 * before designing a production macro-candidate or selector?
 *
 * Usage:
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_coupled_prefix_beam.ts \
 *     --case=frontier_pickup_progression_shifted --seed=27 --budget=500000 \
 *     --depth=3 --width=12 --children=8 --suffix-budget=450000 --out=FILE
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { makeRng } from "../lib/rng.ts";
import { applyJolt } from "../produce/seed.ts";
import {
  effectiveAxes,
  sampleGapTargets,
  sliceTimeline,
} from "./core/substrate.ts";
import {
  compileHandoff,
  compileHandoffFromSnapshot,
  setForwardEvalContext,
  snapshotHandoffNode,
  type HandoffNode,
  type HandoffNodeEvent,
} from "./optimizer/handoff.ts";
import { extendNodeCached, getCandidatesSorted, type SearchNode } from "./optimizer/node.ts";
import type { SpecContext } from "./optimizer/sample.ts";
import { scoreDriftReport } from "./score.ts";
import { CALIB, FPS, secToFrame, type AxisValues, type Gap, type Spec } from "./types.ts";
import type { LeafKey } from "./optimizer/register.ts";

const argv = process.argv.slice(2);
const value = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  console.log("Usage: study_coupled_prefix_beam.ts --case=ID [--seed=N] [--budget=N] [--parent-gap=N] [--depth=N] [--width=N] [--children=N] [--pool=N] [--suffix-top=N] [--suffix-budget=N] [--out=FILE]");
  process.exit(0);
}

const caseId = value("case") ?? "frontier_pickup_progression_shifted";
const seed = numberArg("seed", 27);
const budget = numberArg("budget", 500_000);
const parentGap = numberArg("parent-gap", 0);
const depth = numberArg("depth", 3);
const width = numberArg("width", 12);
const children = numberArg("children", 8);
const pool = numberArg("pool", 32);
const suffixTop = numberArg("suffix-top", 6);
const suffixBudget = numberArg("suffix-budget", 450_000);
const outPath = value("out");

for (const [name, n] of Object.entries({ seed, budget, parentGap, depth, width, children, pool, suffixTop, suffixBudget })) {
  if (!Number.isSafeInteger(n) || n < 0 || (name !== "parentGap" && n === 0)) {
    throw new Error(`--${name} must be a positive safe integer`);
  }
}
if (children > pool) throw new Error("--children must not exceed --pool");

const source = developmentCases.find((entry) => entry.case.metadata.id === caseId)?.case.spec;
if (source === undefined) throw new Error(`unknown V2 development case "${caseId}"`);
const spec = applyJolt(source, benchmarkPolicy.transform.joltMs);
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

const parent = visits.find((record) =>
  record.event.phase === "main" &&
  record.node.startExpanded &&
  record.node.skippedContacts === 0 &&
  record.node.search.gapIndex === parentGap
);
if (parent === undefined) {
  throw new Error(`${caseId}/s${seed}: no main no-skip prefix at gap ${parentGap}`);
}

type Step = {
  gap: number;
  rank: number;
  source: "aimed" | "pool";
  cost: number;
  lineCount: number;
  length: number;
  releaseFrame: number | null;
  releaseSpeed: number | null;
  releaseAngleDeg: number | null;
};
type BeamEntry = {
  search: SearchNode;
  steps: Step[];
};
type Layer = { step: number; parents: number; emitted: number; retained: number };

let frontier: BeamEntry[] = [{
  search: parent.node.search,
  steps: [],
}];
const layers: Layer[] = [];
for (let step = 0; step < depth; step++) {
  const next: BeamEntry[] = [];
  for (const entry of frontier) {
    const gap = setup.gaps[entry.search.gapIndex];
    if (gap === undefined || !gap.endsWithContact) continue;
    const candidates = getCandidatesSorted(
      entry.search,
      setup.gaps,
      setup.ctx,
      parent.node.searchSeed,
      pool,
    ).slice(0, children);
    for (const [rank, candidate] of candidates.entries()) {
      let child = extendNodeCached(entry.search, candidate);
      while (child.gapIndex < setup.gaps.length && !setup.gaps[child.gapIndex].endsWithContact) {
        child = extendNodeCached(child, null);
      }
      next.push({
        search: child,
        steps: [...entry.steps, summarizeStep(gap.index, rank, candidate)],
      });
    }
  }
  frontier = next
    // This oracle intentionally has no new partial-state scorer. Keep the
    // generator's existing candidate order at each edge, then retain paths in
    // deterministic lexicographic rank order. `objectiveLeafValue` is a
    // forward-evaluation leaf score, not a meaningful differentiator here:
    // sibling prefixes commonly share the same committed horizon.
    .sort(compareByGeneratorRank)
    .slice(0, width);
  layers.push({ step, parents: step === 0 ? 1 : layers.at(-1)!.retained, emitted: next.length, retained: frontier.length });
  if (frontier.length === 0) break;
}

const suffixes = frontier.slice(0, suffixTop).map((entry, index) => {
  const node: HandoffNode = {
    ...parent.node,
    search: entry.search,
    deferExpansion: false,
    rankTrace: [
      ...parent.node.rankTrace,
      ...entry.steps.map((step) => ({ rank: step.rank, source: step.source })),
    ],
  };
  const resumed = compileHandoffFromSnapshot(
    spec,
    seed,
    snapshotHandoffNode(node, parent.key, parent.event),
    { budget: suffixBudget },
  );
  const score = scoreDriftReport(resumed.report, {
    totalFrames: Math.round(spec.duration * FPS),
  });
  return {
    index,
    steps: entry.steps,
    valid: score.contract_passed,
    score: round(score.score),
    deepestGap: resumed.stats.handoff_deepest_seen_gap ?? null,
    simFrames: resumed.stats.sim_frames,
    terminus: resumed.report.terminus,
  };
});

const result = {
  schema: "line.study-coupled-prefix-beam.v1",
  semantics: [
    "observation-only reachability oracle",
    "normal generator and exact gates at every macro edge",
    "prefix retention preserves the generator's existing per-edge order; it does not introduce a new partial-state scorer",
    "suffix budget is independent diagnostic work and is not a production budget claim",
  ],
  caseId,
  seed,
  budget,
  parentGap,
  depth,
  width,
  children,
  pool,
  suffixTop,
  suffixBudget,
  elapsedMs: Math.round(performance.now() - started),
  baseline: {
    valid: baselineScore.contract_passed,
    score: round(baselineScore.score),
    deepestGap: baseline.stats.handoff_deepest_seen_gap ?? null,
    simFrames: baseline.stats.sim_frames,
    terminus: baseline.report.terminus,
  },
  parent: {
    startRank: parent.node.startRank,
    searchSeed: parent.node.searchSeed,
    gap: parent.node.search.gapIndex,
    simFramesAtVisit: parent.event.simFrames,
  },
  layers,
  retainedOrdering: "lexicographic generator rank at each prefix edge",
  retained: frontier.map((entry) => ({ steps: entry.steps })),
  suffixes,
};
const json = `${JSON.stringify(result, null, 2)}\n`;
if (outPath === undefined) process.stdout.write(json);
else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json);
  console.error(`study -> ${outPath}`);
}

function numberArg(name: string, fallback: number): number {
  const raw = value(name);
  return raw === undefined ? fallback : Number(raw);
}

function compareByGeneratorRank(a: BeamEntry, b: BeamEntry): number {
  const n = Math.min(a.steps.length, b.steps.length);
  for (let i = 0; i < n; i++) {
    const rankDelta = a.steps[i].rank - b.steps[i].rank;
    if (rankDelta !== 0) return rankDelta;
  }
  return a.steps.length - b.steps.length;
}

function summarizeStep(gap: number, rank: number, candidate: ReturnType<typeof getCandidatesSorted>[number]): Step {
  const release = candidate.releaseArrivalState;
  const tail = candidate.lines.at(-1);
  return {
    gap,
    rank,
    source: candidate.aimed ? "aimed" : "pool",
    cost: round(candidate.cost),
    lineCount: candidate.lines.length,
    length: round(candidate.lines.reduce((sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1), 0)),
    releaseFrame: release?.frame ?? null,
    releaseSpeed: release === undefined ? null : round(Math.hypot(release.vx, release.vy)),
    releaseAngleDeg: release === undefined ? null : round(Math.atan2(release.vy, release.vx) * 180 / Math.PI),
  };
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

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
