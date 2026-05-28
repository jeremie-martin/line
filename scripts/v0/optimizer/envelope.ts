/**
 * Step 5 — best-so-far envelope. The load-bearing piece for
 * Property 1 (monotonicity-in-budget).
 *
 * Given a list of `Exploration`s (each a complete-track-or-throw
 * producer), walks them in order, keeps the strictly-best-scoring
 * track seen so far, and returns it. Individual explorations that
 * throw are caught and treated as "this attempt failed; try the
 * next one" — they do not propagate.
 *
 * **The structural guarantee** that makes Property 1 hold by
 * construction:
 *
 *   For any list `L` and any prefix `P ⊆ L`,
 *   `score(envelope(L)) >= score(envelope(P))`.
 *
 * Proof: the envelope only swaps to a new best if it scores
 * STRICTLY higher than the current best (see `isStrictlyBetter`).
 * Adding more explorations to the list can only either:
 *   - leave the best-so-far unchanged (new explorations didn't beat it), or
 *   - replace it with a strictly-better track.
 * The result can never decrease. This is the chess-engine pattern:
 * iterative deepening with best-move memory.
 *
 * What an exploration is responsible for:
 *   - Producing a CompileOutput, deterministically given its captured
 *     inputs (spec, seed, K, etc.).
 *   - Throwing if it cannot produce a complete track (e.g., greedy_v2
 *     on a spec where it dead-ends).
 *
 * What the envelope is NOT responsible for here (Step 5 surface):
 *   - Anytime budget enforcement (Step 7 adds that).
 *   - Aggregating work_units across explorations (Step 7).
 *   - Choosing which explorations to run (the caller provides the list).
 */

import { isStrictlyBetter, scoreTrack } from "./scorer.ts";
import type { CompileOutput, Score } from "./types.ts";

/** One attempt at producing a complete track. The `run` function is
 *  called at most once per envelope invocation; it should be a pure
 *  function of its captured closures (spec, seed, K, ...) so that
 *  rerunning the envelope with the same explorations yields the same
 *  best track. */
export type Exploration = {
  name: string;
  run: () => CompileOutput;
};

/** Optional per-exploration trace info, surfaced via the onProgress
 *  callback. Useful for debugging and instrumentation but not load-
 *  bearing for the envelope's contract. */
export type ExplorationTrace = {
  name: string;
  status: "ok" | "throw";
  /** Score of THIS exploration's result (null if it threw). */
  score: Score | null;
  /** Score of the best-so-far AFTER processing this exploration. */
  bestSoFar: Score;
  /** Was this exploration the new best? */
  becameBest: boolean;
  elapsed_ms: number;
};

export type EnvelopeOptions = {
  /** Called once per exploration, in order. */
  onProgress?: (t: ExplorationTrace) => void;
};

/**
 * Run all explorations in order, return the strictly-best-scoring
 * CompileOutput. Throws if every exploration fails.
 *
 * Determinism: given a deterministic list of explorations (same
 * order, each `run` deterministic), this is deterministic.
 *
 * Score is computed by `scoreTrack` from `./scorer.ts` — the single
 * source of truth for "is A better than B" across the optimizer.
 */
export function compileWithEnvelope(
  explorations: readonly Exploration[],
  opts: EnvelopeOptions = {},
): CompileOutput {
  let best: CompileOutput | null = null;
  let bestScore: Score = -Infinity;

  for (const exp of explorations) {
    const t0 = Date.now();
    let result: CompileOutput | null = null;
    try {
      result = exp.run();
    } catch {
      opts.onProgress?.({
        name: exp.name,
        status: "throw",
        score: null,
        bestSoFar: bestScore,
        becameBest: false,
        elapsed_ms: Date.now() - t0,
      });
      continue;
    }
    const s = scoreTrack(result);
    const becameBest = isStrictlyBetter(s, bestScore);
    if (becameBest) {
      best = result;
      bestScore = s;
    }
    opts.onProgress?.({
      name: exp.name,
      status: "ok",
      score: s,
      bestSoFar: bestScore,
      becameBest,
      elapsed_ms: Date.now() - t0,
    });
  }

  if (best === null) {
    throw new Error(
      `compileWithEnvelope: all ${explorations.length} explorations failed ` +
      `(none produced a complete track)`,
    );
  }
  return best;
}
