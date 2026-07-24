/** Compare selected compiler paths across budgets or deterministic search streams. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import dense240 from "../../benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts";
import pickup from "../../benchmark/v2/cases/normative/capability/frontier_pickup_progression.ts";
import pickupShifted from "../../benchmark/v2/cases/variants/capability/frontier_pickup_progression_shifted.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { sliceTimeline } from "./core/substrate.ts";
import { compileHandoff, type HandoffNode, type HandoffNodeEvent } from "./optimizer/handoff.ts";
import { scoreDriftReport } from "./score.ts";
import { FPS, secToFrame, type Spec } from "./types.ts";
import type { LeafKey } from "./optimizer/register.ts";

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: study_dense_path_compare.ts [--case=dense|dense240|pickup|pickup-shifted] " +
      "[--seed=N] [--budgets=N,...] [--search-seeds=N,...] [--out=FILE]\n",
  );
  process.exit(0);
}
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const seed = Number(arg("seed") ?? "24");
const budgets = (arg("budgets") ?? "250000,500000").split(",").map(Number);
const searchSeeds = (arg("search-seeds") ?? "").split(",").filter(Boolean).map(Number);
const caseId = arg("case") ?? "dense";
const out = arg("out");
const catalog: Record<string, Spec> = { dense, dense240, pickup, "pickup-shifted": pickupShifted };
const source = catalog[caseId];
if (source === undefined) throw new Error(`unknown --case=${caseId}`);
if (!Number.isSafeInteger(seed) || budgets.some((budget) => !Number.isSafeInteger(budget) || budget <= 0) ||
  searchSeeds.some((searchSeed) => !Number.isSafeInteger(searchSeed))) {
  throw new Error("seed, budgets, and search-seeds must be safe integers");
}

type Visit = { node: HandoffNode; key: LeafKey; event: HandoffNodeEvent };
if (searchSeeds.length > 0 && budgets.length !== 1) {
  throw new Error("--search-seeds requires exactly one --budgets value");
}
const spec = applyJolt(source, benchmarkPolicy.transform.joltMs);
const gapSchedule = summarizeGapSchedule(sliceTimeline(
  spec.contacts.map((contact) => secToFrame(contact.t)).sort((left, right) => left - right),
  secToFrame(spec.duration),
));
const runInputs = searchSeeds.length > 0
  ? searchSeeds.map((searchSeed) => ({ budget: budgets[0], searchSeed }))
  : budgets.map((budget) => ({ budget, searchSeed: seed }));
const runs = runInputs.map(({ budget, searchSeed }) => {
  const visits: Visit[] = [];
  let deepest: HandoffNode | null = null;
  const checkpoint = compileHandoff(spec, seed, {
    searchSeed,
    budget,
    onNode(node, key, event) {
      visits.push({ node, key, event });
      if (node.skippedContacts === 0 && (deepest === null || node.search.gapIndex > deepest.search.gapIndex)) {
        deepest = node;
      }
    },
  });
  if (deepest === null) throw new Error(`budget ${budget}: no no-skip node`);
  const score = scoreDriftReport(checkpoint.report, { totalFrames: Math.round(spec.duration * FPS) });
  return {
    budget,
    searchSeed,
    score: round(score.score),
    valid: score.contract_passed,
    deepestGap: checkpoint.stats.handoff_deepest_seen_gap ?? null,
    simFrames: checkpoint.stats.sim_frames,
    path: summarizePath(deepest),
  };
});
const output = {
  schema: "line.study-dense-path-compare.v2",
  caseId,
  seed,
  budgets,
  gapSchedule,
  runs,
};
const json = `${JSON.stringify(output, null, 2)}\n`;
if (out === undefined) process.stdout.write(json);
else {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, json);
  console.error(`study -> ${out}`);
}

function summarizePath(node: HandoffNode) {
  return node.search.prefixFits.map((fit, gap) => {
    const trace = node.rankTrace[gap];
    if (fit === null) return { gap, source: trace?.source ?? "skip", rank: trace?.rank ?? -1, fit: null };
    const tail = fit.lines.at(-1)!;
    const launch = fit.ballisticLaunch;
    const release = launch?.state;
    return {
      gap,
      source: trace?.source ?? "unknown",
      rank: trace?.rank ?? null,
      sampleAttempt: fit.sampleAttempt ?? null,
      lineCount: fit.lines.length,
      length: round(fit.lines.reduce((sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1), 0)),
      terminalAngle: round(Math.atan2(tail.y2 - tail.y1, tail.x2 - tail.x1) * 180 / Math.PI),
      post: summarizePostGeometry(fit),
      achieved: Object.fromEntries(Object.entries(fit.achieved).map(([name, value]) => [name, round(value)])),
      release: release === undefined ? null : {
        frame: launch!.anchorFrame,
        speed: round(Math.hypot(release.vx, release.vy)),
        angle: round(Math.atan2(release.vy, release.vx) * 180 / Math.PI),
        airborne: launch!.airborne,
      },
    };
  });
}

/**
 * Preserve the authored timing context independently of any selected geometry.
 * A later analysis can therefore distinguish a change made before a short run
 * from one made inside it, without encoding a named cadence case in the compiler.
 */
function summarizeGapSchedule(gaps: ReturnType<typeof sliceTimeline>) {
  return gaps.map((gap, index) => {
    const futureContactFrames = gaps
      .slice(index + 1, index + 5)
      .filter((candidate) => candidate.endsWithContact)
      .map((candidate) => candidate.endFrame - candidate.startFrame);
    return {
      gap: index,
      frames: gap.endFrame - gap.startFrame,
      endsWithContact: gap.endsWithContact,
      nextFourContactFrames: futureContactFrames,
      nextFourMeanFrames: futureContactFrames.length === 0
        ? null
        : round(futureContactFrames.reduce((sum, frames) => sum + frames, 0) / futureContactFrames.length),
      nextFourMinFrames: futureContactFrames.length === 0 ? null : Math.min(...futureContactFrames),
    };
  });
}

function summarizePostGeometry(fit: NonNullable<HandoffNode["search"]["prefixFits"][number]>) {
  const ref = fit.ref;
  if (ref === undefined || fit.lines.length === 0) return null;
  let joint = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < fit.lines.length; index++) {
    const line = fit.lines[index];
    const distance = Math.hypot(line.x1 - ref.x, line.y1 - ref.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      joint = index;
    }
  }
  const post = fit.lines.slice(joint);
  const length = post.reduce((sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1), 0);
  const speed = fit.releaseSpeed ?? Math.hypot(
    fit.ballisticLaunch?.state.vx ?? 0,
    fit.ballisticLaunch?.state.vy ?? 0,
  );
  const start = post[0];
  const end = post.at(-1)!;
  return {
    jointIndex: joint,
    jointDistance: round(bestDistance),
    segments: post.length,
    length: round(length),
    supportFramesAtReleaseSpeed: speed > 0 ? round(length / speed) : null,
    startAngle: round(Math.atan2(start.y2 - start.y1, start.x2 - start.x1) * 180 / Math.PI),
    endAngle: round(Math.atan2(end.y2 - end.y1, end.x2 - end.x1) * 180 / Math.PI),
  };
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
