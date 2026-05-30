/**
 * Small single-gap probe for the impact-anchored arc placement experiment.
 *
 * Usage:
 *   npx tsx scripts/v0/optimizer/_probe_impact_anchor.ts tiny_dance 0 32
 *
 * Compares the default sampler with LR_ARC_PLACEMENT=impact_anchor on the
 * first contact gap of a golden spec. This is intentionally narrow: it gives
 * a fast survivor-rate / cost / physics-frame signal before running golden.
 */

import { performance } from "node:perf_hooks";
import { makeRng } from "../../lib/rng.ts";
import {
  effectiveAxes,
  makeBaseEngine,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
  withOptimizedPrerollStart,
} from "../compile.ts";
import { resetArcPlacementStats, snapshotArcPlacementStats } from "../arc_placement.ts";
import { loadGoldenSpec, type GoldenSpecName } from "../golden_suite.ts";
import { CALIB, secToFrame } from "../types.ts";
import { solveOneGap } from "./solver.ts";
import { getSimFrames, resetSimFrames } from "./sim_frames.ts";
import type { SpecContext } from "./sample.ts";

type Mode = "uniform" | "impact_anchor";

const specName = (process.argv[2] ?? "tiny_dance") as GoldenSpecName;
const seed = Number(process.argv[3] ?? 0);
const K = Number(process.argv[4] ?? 32);

if (!Number.isInteger(seed) || seed < 0 || !Number.isInteger(K) || K < 1) {
  console.error("usage: tsx _probe_impact_anchor.ts <golden_spec> <seed>=0 <K>=32");
  process.exit(1);
}

function setMode(mode: Mode): void {
  if (mode === "impact_anchor") {
    process.env.LR_ARC_PLACEMENT = "impact_anchor";
  } else {
    delete process.env.LR_ARC_PLACEMENT;
  }
}

async function setup(mode: Mode) {
  setMode("uniform");
  const raw = await loadGoldenSpec(specName, "base");
  validateSpec(raw);
  const spec = withOptimizedPrerollStart(raw, seed);
  const startState = resolveStartState(spec);
  const engine = makeBaseEngine(startState);
  const durationFrames = secToFrame(spec.duration);
  const allContactFrames = [...spec.contacts]
    .map((contact) => secToFrame(contact.t))
    .sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, durationFrames);
  const targetRng = makeRng(seed);
  for (const gap of gaps) {
    gap.targets = sampleGapTargets(effectiveAxes(gap, spec), CALIB.SIGMA, targetRng);
  }
  const gap = gaps.find((g) => g.endsWithContact);
  if (gap === undefined) throw new Error(`${specName}: no contact gap`);
  const ctx: SpecContext = { allContactFrames, durationFrames };
  setMode(mode);
  return { engine, gap, ctx };
}

async function run(mode: Mode) {
  const { engine, gap, ctx } = await setup(mode);
  resetSimFrames();
  resetArcPlacementStats();
  const t0 = performance.now();
  const rng = makeRng((seed | 0) * 1_000_003 + gap.index + 1);
  const candidates = solveOneGap(engine, gap, rng, K, ctx, 1);
  const wallMs = performance.now() - t0;
  const best = candidates.reduce(
    (acc, cand) => acc === null || cand.cost < acc.cost ? cand : acc,
    null as typeof candidates[number] | null,
  );
  return {
    mode,
    spec: specName,
    seed,
    K,
    gap_index: gap.index,
    start_frame: gap.startFrame,
    end_frame: gap.endFrame,
    survivors: candidates.length,
    survivor_rate: candidates.length / K,
    best_cost: best?.cost ?? null,
    sim_frames: getSimFrames(),
    wall_ms: Number(wallMs.toFixed(1)),
    arc_placement: snapshotArcPlacementStats() ?? null,
  };
}

const rows = [await run("uniform"), await run("impact_anchor")];
console.log(JSON.stringify(rows, null, 2));
