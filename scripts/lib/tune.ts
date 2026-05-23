/**
 * `tune()` — parameter-search wrapper around a Move factory.
 *
 * For cases where adaptive defaults aren't enough — e.g. you want a landing
 * at exactly frame 240, or you want to maximize a specific metric across a
 * parameter range. `tune` runs a small search and returns a Move whose
 * `place()` uses the best parameters found.
 *
 * Local-only search: each trial evaluates the move's verify() against a
 * short post-move simulation lookahead. Subsequent moves in the ride are
 * NOT considered. This keeps tune fast and predictable but means tune
 * picks parameters that look good *for this move alone* — composition-
 * level optimization (Phase C of the compiler plan) is future work.
 *
 * Strategy: small grid sweep. Each dimension samples up to N points across
 * its [min, max] range. Total trials capped at `budget`.
 *
 *   tune(
 *     (p) => catch_({ at: 200, halfWidth: p.halfWidth }),
 *     {
 *       seed: { halfWidth: 8 },
 *       vary: { halfWidth: [4, 20] },
 *     }
 *   )
 */

import {
  detect,
  extractRawTrajectory,
} from "./detector.ts";
import type { Move, MoveVerdict, PlaceCtx, Placement } from "./moves.ts";

export type TuneOpts = {
  /** Initial parameter values — always evaluated. */
  seed: Record<string, number>;
  /** Which seed keys to vary, mapped to [min, max] ranges. */
  vary: Record<string, [number, number]>;
  /**
   * Score function — lower is better.
   * Default: drift entries × 10 + (passed ? 0 : 1000). This prefers
   * survival over metric perfection.
   */
  score?: (verdict: MoveVerdict) => number;
  /**
   * Frames to simulate past the move's endFrame for verification.
   * Lr-core simulations are fast (~100 frames in ~10ms).
   */
  lookahead?: number;
  /** Max trials including the seed. Default 20. */
  budget?: number;
};

export function tune(
  factory: (params: Record<string, number>) => Move,
  opts: TuneOpts,
): Move {
  const budget = opts.budget ?? 20;
  const lookahead = opts.lookahead ?? 60;
  const score =
    opts.score ?? ((v: MoveVerdict) => v.drift.length * 10 + (v.passed ? 0 : 1000));

  // Best result captured during place(); verify() reuses the chosen move.
  let bestMove: Move | null = null;
  let bestPlacement: Placement | null = null;
  let bestParams: Record<string, number> = { ...opts.seed };

  // For the Move's atFrame, peek at the seed.
  const seedAt = factory(opts.seed).atFrame;

  return {
    type: "tune",
    atFrame: seedAt,
    place(ctx: PlaceCtx) {
      const varyKeys = Object.keys(opts.vary);
      // Compute samples per dimension to stay within budget.
      // For 1 dim: 20 samples; for 2: ~4 each (16 + 1 seed = 17); for 3: 3 each (27 — over budget, capped).
      const samplesPerDim = varyKeys.length === 0
        ? 1
        : Math.max(2, Math.min(budget, Math.floor(Math.pow(budget, 1 / varyKeys.length))));
      let bestScore = Infinity;

      const tryParams = (params: Record<string, number>) => {
        const move = factory(params);
        const placement = move.place(ctx);
        // Simulate forward from the engine AFTER this move's lines are placed.
        const simEnd = placement.endFrame + lookahead;
        const raw = extractRawTrajectory(placement.engineAfter, simEnd);
        const det = detect(raw);
        const range = { start: move.atFrame, end: placement.endFrame };
        const verdict = move.verify(det, range, placement.lineIds);
        const s = score(verdict);
        if (s < bestScore) {
          bestScore = s;
          bestParams = { ...params };
          bestMove = move;
          bestPlacement = placement;
        }
      };

      // Always evaluate the seed.
      tryParams(opts.seed);

      // Then sweep the vary grid.
      const recurse = (idx: number, current: Record<string, number>) => {
        if (idx === varyKeys.length) {
          tryParams(current);
          return;
        }
        const k = varyKeys[idx];
        const [lo, hi] = opts.vary[k];
        for (let j = 0; j < samplesPerDim; j++) {
          const t = samplesPerDim === 1 ? 0.5 : j / (samplesPerDim - 1);
          current[k] = lo + (hi - lo) * t;
          recurse(idx + 1, current);
        }
      };
      if (varyKeys.length > 0) recurse(0, { ...opts.seed });

      return bestPlacement!;
    },
    verify(det, range, lineIds) {
      // Reuse the verify of the move chosen at place() time.
      return bestMove!.verify(det, range, lineIds);
    },
  };
}

/** Inspect the chosen params after a ride. Reads from the Move's stored state. */
export function bestParamsOf(tuned: Move): Record<string, number> | null {
  // bestParams is captured in the closure inside place(); not externally
  // accessible without exposing it via the Move object. For now, callers
  // who want this can inspect verdict.observed in their move's verify().
  void tuned;
  return null;
}
