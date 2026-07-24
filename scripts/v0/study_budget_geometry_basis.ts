/**
 * Compare ordinary candidate geometry sampled at two compile-budget operating
 * points from one frozen prefix. This is observation-only: the candidate gate,
 * child construction, and continuation sampler stay production-identical.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { makeRng } from "../lib/rng.ts";
import { applyJolt } from "../produce/seed.ts";
import { effectiveAxes, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { compileHandoff, setForwardEvalContext, type HandoffNode } from "./optimizer/handoff.ts";
import { extendNodeCached, getCandidatesSorted } from "./optimizer/node.ts";
import { nextContactGap } from "./optimizer/objective.ts";
import { sampleOneCandidate, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { setCompileBudgetFrames } from "./arc_placement.ts";
import { CALIB, secToFrame, type AxisValues, type Gap, type Spec } from "./types.ts";

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: study_budget_geometry_basis.ts [--seed=N] [--budget=N] " +
    "[--geometry-budget=N] [--alternate-sampler=prng|halton] " +
      "[--target-gap=N] [--attempts=N] [--out=FILE]\n",
  );
  process.exit(0);
}
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const seed = Number(arg("seed") ?? "24");
const budget = Number(arg("budget") ?? "250000");
const geometryBudget = Number(arg("geometry-budget") ?? "500000");
const alternateSampler = arg("alternate-sampler") ?? "prng";
const targetGap = Number(arg("target-gap") ?? "18");
const attempts = Number(arg("attempts") ?? "32");
const out = arg("out");
for (const [name, value] of Object.entries({ seed, budget, geometryBudget, targetGap, attempts })) {
  if (!Number.isSafeInteger(value) || value < (name === "targetGap" ? 0 : 1)) {
    throw new Error(`invalid --${name}=${value}`);
  }
}
if (alternateSampler !== "prng" && alternateSampler !== "halton") {
  throw new Error(`invalid --alternate-sampler=${alternateSampler} (expected prng|halton)`);
}

const spec = applyJolt(dense, benchmarkPolicy.transform.joltMs);
const setup = buildSetup(spec, seed);
setForwardEvalContext(setup.spec, setup.gapAxisTargets);
let parent: HandoffNode | null = null;
const visits: HandoffNode[] = [];
const baseline = compileHandoff(spec, seed, {
  budget,
  onNode(node) {
    visits.push(node);
  },
});
const winning = visits.reduce<HandoffNode | null>((deepest, node) =>
  node.skippedContacts === 0 && (deepest === null || node.search.gapIndex >= deepest.search.gapIndex)
    ? node
    : deepest,
null);
if (winning !== null) {
  parent = visits.filter((node) =>
    node.skippedContacts === 0 &&
    node.search.gapIndex === targetGap &&
    isPrefix(node.search.prefixFits, winning.search.prefixFits)
  ).at(-1) ?? null;
}
if (parent === null) throw new Error(`no unskipped parent at gap ${targetGap}`);
const gap = setup.gaps[parent.search.gapIndex];
const nextGap = nextContactGap(gap, setup.gaps);
if (nextGap === null) throw new Error(`gap ${gap.index} has no next contact`);

function sampleBasis(atBudget: number, sampler: "prng" | "halton") {
  const rng = sampler === "prng"
    ? makeRng((Math.imul(seed | 0, 1_000_003) + gap.index + 1) | 0)
    : makeHaltonRng(seed);
  setCompileBudgetFrames(atBudget);
  try {
    return Array.from({ length: attempts }, (_, attempt) => {
      const candidate = sampleOneCandidate(
        parent!.search.prefixEngine,
        gap,
        rng,
        setup.ctx,
        parent!.search.prefixNextLineId,
        attempt,
      );
      return summarizeCandidate(candidate, attempt, parent!.search, setup, seed, nextGap);
    });
  } finally {
    setCompileBudgetFrames(budget);
  }
}

const started = performance.now();
const low = sampleBasis(budget, "prng");
const alternate = sampleBasis(geometryBudget, alternateSampler);
const result = {
  schema: "line.study-budget-geometry-basis.v1",
  semantics: [
    "frozen production prefix",
    "ordinary sampler with only compile-budget geometry pressure substituted",
    "ordinary exact candidate gate and ordinary child continuation sampler",
    "observation-only; no candidate is inserted into compiler search",
  ],
  seed,
  budget,
  geometryBudget,
  alternateSampler,
  targetGap,
  parentGap: parent.search.gapIndex,
  nextGap: nextGap.index,
  attempts,
  baseline: {
    simFrames: baseline.stats.sim_frames,
    deepestGap: baseline.stats.handoff_deepest_seen_gap ?? null,
  },
  low,
  alternate,
  elapsedMs: Math.round(performance.now() - started),
};
const json = `${JSON.stringify(result, null, 2)}\n`;
if (out === undefined) process.stdout.write(json);
else {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, json);
  process.stdout.write(`study -> ${out}\n`);
}

function summarizeCandidate(
  candidate: Candidate | null,
  attempt: number,
  search: HandoffNode["search"],
  ctx: { gaps: Gap[]; ctx: SpecContext },
  searchSeed: number,
  next: Gap,
) {
  if (candidate === null) return { attempt, admitted: false };
  const child = advanceToGap(extendNodeCached(search, candidate), ctx.gaps, next.index);
  const nextCandidates = getCandidatesSorted(child, ctx.gaps, ctx.ctx, searchSeed, 32);
  const launch = candidate.ballisticLaunch;
  const release = launch?.state;
  return {
    attempt,
    admitted: true,
    cost: round(candidate.cost),
    geometryHash: geometryHash(candidate),
    lineCount: candidate.lines.length,
    length: round(candidate.lines.reduce((sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1), 0)),
    terminalAngleDeg: round(Math.atan2(
      candidate.lines.at(-1)!.y2 - candidate.lines.at(-1)!.y1,
      candidate.lines.at(-1)!.x2 - candidate.lines.at(-1)!.x1,
    ) * 180 / Math.PI),
    release: release === undefined ? null : {
      frame: launch!.anchorFrame,
      speed: round(Math.hypot(release.vx, release.vy)),
      angleDeg: round(Math.atan2(release.vy, release.vx) * 180 / Math.PI),
      airborne: launch!.airborne,
    },
    nextCandidates: nextCandidates.length,
  };
}

function advanceToGap(search: HandoffNode["search"], gaps: Gap[], target: number) {
  let out = search;
  while (out.gapIndex < target) out = extendNodeCached(out, null);
  return out;
}

function geometryHash(candidate: Candidate): string {
  return createHash("sha256").update(JSON.stringify(candidate.lines.map((line) => [
    round(line.x1), round(line.y1), round(line.x2), round(line.y2),
  ]))).digest("hex");
}

function buildSetup(userSpec: Spec, publicSeed: number): {
  spec: Spec;
  gaps: Gap[];
  gapAxisTargets: AxisValues[];
  ctx: SpecContext;
} {
  const spec: Spec = {
    ...userSpec,
    preroll: undefined,
    contacts: userSpec.contacts.filter((contact) => secToFrame(contact.t) >= 5),
  };
  const allContactFrames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, secToFrame(spec.duration));
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(publicSeed);
  for (const gap of gaps) gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);
  const impactByFrame = new Map(spec.contacts.flatMap((contact) =>
    contact.impact === undefined ? [] : [[secToFrame(contact.t), contact.impact] as const],
  ));
  for (const gap of gaps) {
    const impact = impactByFrame.get(gap.endFrame);
    if (gap.endsWithContact && impact !== undefined) {
      gap.targets.impact = impact;
      gapAxisTargets[gap.index].impact = impact;
    }
  }
  return {
    spec,
    gaps,
    gapAxisTargets,
    ctx: { allContactFrames, durationFrames: secToFrame(spec.duration), gapAxisTargets },
  };
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Eight-dimensional, seed-rotated Halton points. Each candidate receives one
 * stratum in every normal-generator draw dimension, while the seed preserves
 * independent portfolio rotations. The study's fixed eight-draw contract is
 * deliberate: `sampleArcPlacementGeometry` consumes the eight normal rolls. */
function makeHaltonRng(searchSeed: number): () => number {
  const bases = [2, 3, 5, 7, 11, 13, 17, 19];
  let draws = 0;
  return () => {
    const dimension = draws % bases.length;
    const point = Math.floor(draws / bases.length) + 1 + Math.abs(searchSeed) * 32;
    draws++;
    return radicalInverse(point, bases[dimension]);
  };
}

function radicalInverse(index: number, base: number): number {
  let value = 0;
  let scale = 1 / base;
  let remaining = index;
  while (remaining > 0) {
    value += (remaining % base) * scale;
    remaining = Math.floor(remaining / base);
    scale /= base;
  }
  return value;
}

function isPrefix(prefix: HandoffNode["search"]["prefixFits"], full: HandoffNode["search"]["prefixFits"]): boolean {
  return prefix.length <= full.length && prefix.every((fit, index) => fit === full[index]);
}
