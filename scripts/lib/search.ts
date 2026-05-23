/**
 * Monte Carlo search over adapter-level jitter.
 *
 * Given a fixed spec (Move[] with non-negotiable `at:` frames), run N
 * randomized trials by passing a different seeded RNG to each ride().
 * Adapters jitter their chosen defaults within bands; user-passed params
 * are respected exactly; `atFrame` is sacred.
 *
 * Returns the best trial by a scalar fitness function (composite default,
 * overridable). Also returns the seed for reproducibility — the user can
 * re-run any specific trial by passing its seed to `ride({ rng: makeRng(seed) })`.
 */

import { ride, type RideResult, type RideOpts } from "./ride.ts";
import { type Move } from "./moves.ts";
import { makeRng } from "./rng.ts";

export type Fitness = (result: RideResult) => number;

/**
 * Default fitness function.
 *
 * Hierarchy (most important first):
 *   1. Survival (terminus = endOfSpec): +1000
 *   2. All moves pass (no catastrophic mid-move failure): +100
 *   3. Forward motion (mean vx while sliding): scaled, capped at +200
 *   4. Penalize stalled rider (mean vx < 2): -500 (anti-cheat against
 *      "rider stuck on flat line technically sliding")
 *   5. Contact fraction (% sliding): ×100
 *   6. Longest contact run: capped at +80 (so we don't reward one
 *      monster slide that pins everything else)
 *   7. Drift entries: -10 each
 *
 * Rationale: survival is primary, but a track where the rider is barely
 * moving is *boring* even if technically sliding 90% of the time. The
 * fitness function encodes "we want vivid motion" as a hard preference.
 */
export function defaultFitness(r: RideResult): number {
  const s = r.detection.summary;
  let driftCount = 0;
  for (const step of r.steps) {
    if (step.verdict) driftCount += step.verdict.drift.length;
  }
  let score = 0;
  if (r.survived) score += 1000;
  if (r.allPassed) score += 100;
  // Forward motion: the load-bearing aesthetic signal.
  score += Math.min(s.meanVxSliding * 30, 200);
  // Stall penalty: kill the "rider stuck on flat line" cheat.
  if (s.meanVxSliding < 2) score -= 500;
  score += s.contactFractionSpec * 100;
  score += Math.min(s.longestContactRun, 80);
  score -= driftCount * 10;
  return score;
}

export type SearchOpts = {
  /** Number of trials to run. */
  trials: number;
  /** Optional fitness function. Default: `defaultFitness`. */
  fitness?: Fitness;
  /** Base seed. Trial i uses seed = baseSeed + i. Default: 1. */
  seed?: number;
  /** How many top trials to keep in the result. Default: 5. */
  topK?: number;
  /** Optional progress callback called after each trial. */
  onTrial?: (info: TrialInfo) => void;
};

export type TrialInfo = {
  index: number;
  seed: number;
  score: number;
  survived: boolean;
  allPassed: boolean;
  contactFraction: number;
};

export type RankedTrial = {
  seed: number;
  score: number;
  result: RideResult;
};

export type SearchResult = {
  /** The best-scoring trial. */
  best: RankedTrial;
  /** Top-K trials, sorted descending by score. */
  topK: RankedTrial[];
  /** Number of trials that survived (terminus = endOfSpec). */
  survivedCount: number;
  /** Number of trials run. */
  trials: number;
};

/**
 * Run `opts.trials` randomized trials of the spec, return the best.
 *
 * Each trial uses a different seed so the adapter jitter produces a
 * different geometry. The spec's `at:` frames and any user-passed
 * params are identical across trials.
 *
 * Reproducibility: `best.seed` (and every `topK[i].seed`) is the value
 * to pass back into `ride({ rng: makeRng(seed) })` to get that exact
 * trial again.
 */
export function searchRide(
  moves: Move[],
  rideOpts: Omit<RideOpts, "rng">,
  searchOpts: SearchOpts,
): SearchResult {
  const baseSeed = searchOpts.seed ?? 1;
  const fitness = searchOpts.fitness ?? defaultFitness;
  const topK = searchOpts.topK ?? 5;

  // Maintain only the top-K trials in memory. Each lr-core result is heavy
  // (full per-frame trajectory + engine state), so keeping all N would OOM
  // at moderate trial counts.
  const top: RankedTrial[] = [];
  let survivedCount = 0;

  for (let i = 0; i < searchOpts.trials; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const result = ride(moves, { ...rideOpts, rng });
    const score = fitness(result);
    if (result.survived) survivedCount++;

    if (searchOpts.onTrial) {
      searchOpts.onTrial({
        index: i,
        seed,
        score,
        survived: result.survived,
        allPassed: result.allPassed,
        contactFraction: result.detection.summary.contactFractionSpec,
      });
    }

    // Online top-K: insert if better than the current worst, else drop.
    if (top.length < topK) {
      top.push({ seed, score, result });
      top.sort((a, b) => b.score - a.score);
    } else if (score > top[top.length - 1].score) {
      top[top.length - 1] = { seed, score, result };
      top.sort((a, b) => b.score - a.score);
    }
  }
  return {
    best: top[0],
    topK: top,
    survivedCount,
    trials: searchOpts.trials,
  };
}
