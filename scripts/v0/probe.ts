/**
 * probe.ts — fast per-(spec, seed) diagnostic instrument for the LDS optimizer.
 *
 * Motivation: iterating on candidate generation / the floor requires answering
 * "which gaps are dead and WHY" — the rider's arrival state, the candidate pool,
 * skip-vs-off-beat failure modes — without paying for a full `npm run golden`
 * run (minutes) or rewriting setup boilerplate as a throwaway script each time.
 *
 * This is INSTRUMENTATION ONLY: a new file imported by nothing in the optimizer
 * or the golden suite, so it cannot affect `goal_score`, determinism, or any
 * property. It replays the exact compile setup (preroll, gap slicing, per-gap
 * target sampling) the optimizer uses, then walks the rank-0 greedy spine — the
 * base floor's default path — reporting per contact gap.
 *
 * Usage:
 *   npx tsx scripts/v0/probe.ts <spec> [seed=0]
 *       Per-gap table down the rank-0 spine: frames, rider arrival state
 *       (pos/vel/speed/angle), candidate count, committed rank, achieved-vs-target
 *       axes, and DEAD-gap flags (0 candidates → the floor must skip/backtrack).
 *
 *   npx tsx scripts/v0/probe.ts <spec> <seed> --gap=<gapIndex>
 *       Drill into one contact gap: dump every surviving candidate's arc params
 *       (length, segments, angles, anchor, dY-from-rider) + cost + achieved axes,
 *       so you can see what geometry lands here (or that nothing does).
 *
 *   npx tsx scripts/v0/probe.ts <spec> <seed> --ncand=<N>
 *       Override the per-gap candidate count (default N_CAND) — e.g. to see
 *       whether a wider pool lands a dead gap.
 */

import { loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { withOptimizedPrerollStart } from "./core/preroll.ts";
import {
  effectiveAxes,
  makeBaseEngine,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
} from "./core/substrate.ts";
import { readTargetState } from "./core/candidate.ts";
import { CALIB, secToFrame } from "./types.ts";
import { makeRng } from "../lib/rng.ts";
import { getRiderMetered } from "../lib/detector.ts";
import {
  extendNode,
  getCandidatesSorted,
  makeRootNode,
  N_CAND,
} from "./optimizer/node.ts";
import type { SpecContext } from "./optimizer/sample.ts";

const AXES = ["air", "speed", "grain", "contact_style"] as const;

function fmt(n: number | undefined, d = 2): string {
  return n === undefined ? " -  " : n.toFixed(d);
}

async function setup(name: string, seed: number) {
  const raw = await loadGoldenSpec(name as GoldenSpecName, "base");
  validateSpec(raw);
  const spec = withOptimizedPrerollStart(raw, seed);
  const startState = resolveStartState(spec);
  const durationFrames = secToFrame(spec.duration);
  const allContactFrames = [...spec.contacts]
    .map((c) => secToFrame(c.t))
    .sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, durationFrames);
  const masterRng = makeRng(seed);
  for (const gap of gaps) {
    gap.targets = sampleGapTargets(effectiveAxes(gap, spec), CALIB.SIGMA, masterRng);
  }
  const ctx: SpecContext = { allContactFrames, durationFrames };
  const root = makeRootNode(makeBaseEngine(startState), gaps.length);
  return { spec, gaps, ctx, root, seed, durationFrames, allContactFrames };
}

/** Walk the rank-0 greedy spine, yielding each contact-gap node + its candidates. */
function* walkSpine(
  // deno-lint-ignore no-explicit-any
  rootNode: any,
  // deno-lint-ignore no-explicit-any
  gaps: any[],
  ctx: SpecContext,
  seed: number,
  nCand: number,
) {
  let node = rootNode;
  let cgn = 0;
  while (node.gapIndex < gaps.length) {
    const gap = gaps[node.gapIndex];
    if (!gap.endsWithContact) {
      node = extendNode(node, null);
      continue;
    }
    const cands = getCandidatesSorted(node, gaps, ctx, seed, nCand);
    yield { node, gap, cands, cgn };
    node = extendNode(node, cands[0] ?? null);
    cgn++;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const name = args[0];
  if (!name) {
    console.error("usage: probe.ts <spec> [seed] [--gap=N] [--ncand=N]");
    process.exit(1);
  }
  const seed = Number(args.find((a) => /^\d+$/.test(a)) ?? 0);
  const gapArg = args.find((a) => a.startsWith("--gap="));
  const ncandArg = args.find((a) => a.startsWith("--ncand="));
  const drillGap = gapArg ? Number(gapArg.split("=")[1]) : null;
  const nCand = ncandArg ? Number(ncandArg.split("=")[1]) : N_CAND;

  const { gaps, ctx, root } = await setup(name, seed);

  console.log(`# probe ${name} seed=${seed} nCand=${nCand} (rank-0 spine)`);

  if (drillGap !== null) {
    // Drill into one contact gap: dump its full candidate pool.
    for (const { node, gap, cands } of walkSpine(root, gaps, ctx, seed, nCand)) {
      if (node.gapIndex !== drillGap) continue;
      const re = getRiderMetered(node.prefixEngine, gap.endFrame);
      console.log(
        `gap ${node.gapIndex} f[${gap.startFrame}-${gap.endFrame}] (${gap.endFrame - gap.startFrame}f) ` +
        `target=${JSON.stringify(gap.targets)}  rider@end=(${re.position.x.toFixed(0)},${re.position.y.toFixed(0)})`,
      );
      console.log(`  ${cands.length} surviving candidate(s):`);
      cands.forEach((c, i) => {
        const a = c.arc;
        console.log(
          `  [${i}] cost=${c.cost.toFixed(3)} len=${a.length.toFixed(0)} seg=${a.segments} ` +
          `sAng=${a.startAngleDeg.toFixed(1)} eAng=${a.endAngleDeg.toFixed(1)} ` +
          `anchorDY=${(a.anchor.y - re.position.y).toFixed(1)} ` +
          `achieved={${AXES.map((k) => `${k[0]}:${fmt(c.achieved[k])}`).join(" ")}}`,
        );
      });
      return;
    }
    console.log(`gap ${drillGap} not found / not a contact gap`);
    return;
  }

  // Per-gap spine table.
  console.log(
    `cg  gapIdx  frames        speed angle  nCand  rank0cost  air(t/a) spd(t/a) grn(t/a) cs(t/a)  flag`,
  );
  let dead = 0, total = 0;
  for (const { node, gap, cands, cgn } of walkSpine(root, gaps, ctx, seed, nCand)) {
    total++;
    const re = getRiderMetered(node.prefixEngine, gap.endFrame);
    const ts = readTargetState(node.prefixEngine, gap.endFrame, re.position.x, re.position.y);
    const c0 = cands[0];
    const t = gap.targets;
    const ax = (k: typeof AXES[number]) => `${fmt(t[k])}/${fmt(c0?.achieved[k])}`;
    const flag = cands.length === 0 ? "DEAD" : cands.length <= 2 ? "thin" : "";
    if (cands.length === 0) dead++;
    console.log(
      `${String(cgn).padStart(2)}  ${String(node.gapIndex).padStart(6)}  ` +
      `[${String(gap.startFrame).padStart(4)}-${String(gap.endFrame).padStart(4)}]  ` +
      `${ts.speed.toFixed(1).padStart(5)} ${ts.angleDeg.toFixed(0).padStart(4)}  ` +
      `${String(cands.length).padStart(5)}  ${(c0?.cost ?? NaN).toFixed(3).padStart(9)}  ` +
      `${ax("air")} ${ax("speed")} ${ax("grain")} ${ax("contact_style")}  ${flag}`,
    );
  }
  console.log(`# ${total} contact gaps, ${dead} DEAD (0 candidates) on the rank-0 spine`);
}

main();
