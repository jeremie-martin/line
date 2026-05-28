/**
 * Step 3 — minimal greedy multi-gap chainer.
 *
 * The simplest possible end-to-end compiler. For each gap with a
 * closing Contact:
 *   1. Sample K candidates (sample.ts + solver.ts).
 *   2. Pick the lowest-cost one.
 *   3. Commit it (advance the engine, increment line IDs).
 *   4. Move on.
 *
 * **Deliberately omitted** (compared to legacy compile.ts):
 *   - No backtracking. If a gap has zero viable candidates from K
 *     samples, we throw with a clear message.
 *   - No final-track validation retries.
 *   - No polish passes.
 *   - No "residual targeting" between gaps (each gap uses its own
 *     gap.targets directly; the chainer is purely local).
 *
 * Those are intentional design decisions. greedy_v2 will fail on
 * MORE specs than greedy_v1 — that's expected and recorded in Step
 * 4's K-sweep documentation. The brittleness is absorbed by the
 * best-of-N envelope in Step 5; the chainer itself stays simple.
 *
 * Determinism: given `(spec, seed, K)`, this produces a
 * byte-identical Track on any machine. The per-gap RNG is seeded
 * deterministically from `(seed, gap_index)` — same pattern as
 * legacy compile.ts.
 */

import { detect, extractRawTrajectory } from "../../lib/detector.ts";
import { makeRng } from "../../lib/rng.ts";
import { getSimFrames, resetSimFrames } from "./sim_frames.ts";
import {
  buildDriftReport,
  buildTrackJson,
  effectiveAxes,
  engineLineFromTrackLine,
  type GapFit,
  makeBaseEngine,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
  withOptimizedPrerollStart,
} from "../compile.ts";
import { CALIB, secToFrame } from "../types.ts";
import { pickLowestCost, solveOneGap } from "./solver.ts";
import type { SpecContext } from "./sample.ts";
import type { CompileOutput, Spec } from "./types.ts";

export type CompileGreedyOptions = {
  /** Per-gap candidate budget. Default 48 (matches legacy CALIB.K). */
  K?: number;
};

/** Compile a spec via the minimal greedy chainer. Throws if any gap
 *  produces zero viable candidates from K samples (no fallback). */
export function compileGreedy_v2(
  userSpec: Spec,
  seed = 0,
  opts: CompileGreedyOptions = {},
): CompileOutput {
  const K = opts.K ?? CALIB.K;
  if (!Number.isInteger(K) || K < 1) {
    throw new Error(`compileGreedy_v2: K must be a positive integer, got ${K}`);
  }

  resetSimFrames();
  validateSpec(userSpec);
  const spec = withOptimizedPrerollStart(userSpec, seed);
  const startState = resolveStartState(spec);
  const durationFrames = secToFrame(spec.duration);
  const allContactFrames = [...spec.contacts]
    .map((c) => secToFrame(c.t))
    .sort((a, b) => a - b);

  // Slice into gaps and sample per-gap targets, same as legacy
  // compile.ts. The masterRng is a single RNG shared across all
  // gap-target samples; this is the determinism anchor.
  const gaps = sliceTimeline(allContactFrames, durationFrames);
  const masterRng = makeRng(seed);
  for (const gap of gaps) {
    const sec = effectiveAxes(gap, spec);
    gap.targets = sampleGapTargets(sec, CALIB.SIGMA, masterRng);
  }

  const ctx: SpecContext = { allContactFrames, durationFrames };
  const fits: (GapFit | null)[] = new Array(gaps.length).fill(null);

  // Walk gaps in time order. Maintain the engine state incrementally
  // (lr-core engines are immutable, addLine returns a new engine).
  // deno-lint-ignore no-explicit-any
  let engine: any = makeBaseEngine(startState);
  let nextLineId = 1;
  let totalCost = 0;

  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    if (!gap.endsWithContact) {
      // Tail gap — no contact to land on, no candidate to commit.
      fits[i] = null;
      continue;
    }

    // Per-gap RNG: deterministic given (seed, gap_index), independent
    // of how the chainer arrived here. Mirrors legacy compile.ts.
    const perGapRng = makeRng((seed | 0) * 1000003 + i + 1);
    const candidates = solveOneGap(engine, gap, perGapRng, K, ctx, nextLineId);
    const best = pickLowestCost(candidates);
    if (best === null) {
      throw new Error(
        `compileGreedy_v2: gap ${i} (endFrame ${gap.endFrame}) produced ` +
        `zero viable candidates from K=${K} samples (spec duration=${spec.duration}s, seed=${seed})`,
      );
    }
    fits[i] = best;
    totalCost += best.cost;
    // Extend the engine with this gap's lines.
    for (const line of best.lines) {
      engine = engine.addLine(engineLineFromTrackLine(line));
    }
    nextLineId += best.lines.length;
  }

  // Assemble the final track from committed fits.
  const allLines = [];
  for (const fit of fits) {
    if (fit !== null) allLines.push(...fit.lines);
  }
  const track = buildTrackJson(allLines, durationFrames + 20, startState);

  // Final detection + report.
  const finalDet = detect(extractRawTrajectory(engine, durationFrames + 20));
  const report = buildDriftReport(
    finalDet, spec, gaps, allContactFrames, durationFrames, [], fits,
  );

  return {
    track,
    report,
    stats: {
      candidates_sampled: 0, // not tracked at this level; sim_frames is the budget unit
      engine_rebuilds: 0,
      gap_commits: fits.filter((f) => f !== null).length,
      gap_backtracks: 0,
      validation_retries: 0,
      polish_iterations: 0,
      total_committed_cost: totalCost,
      committed_costs_per_gap: fits.map((f) => (f === null ? null : f.cost)),
      sim_frames: getSimFrames(),
    },
  };
}
