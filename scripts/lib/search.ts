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
import { type Move, type MoveVerdict } from "./moves.ts";
import { makeRng } from "./rng.ts";
import { detect, extractRawTrajectory } from "./detector.ts";

// deno-lint-ignore no-explicit-any
const lrCore: any = await import("lr-core/line-rider-engine/index.js");
const LineRiderEngine = lrCore.default;

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

// ────────── Greedy per-move search with backtracking ──────────

export type GreedySearchOpts = {
  /** Maximum random tries per move before considering it failed. */
  triesPerMove?: number;
  /** How many moves to rewind on a failed move (depth of backtracking). */
  backtrackDepth?: number;
  /**
   * Frames simulated past each move's endFrame to score it locally.
   * Should be long enough to see immediate consequences (rider exiting
   * geometry) but short enough that we don't redo the next move's work.
   */
  lookahead?: number;
  /** Base seed for reproducibility. Per-move seeds derive from this. */
  seed?: number;
  /** Local fitness for picking among per-move tries. Default: survival > drift > passed. */
  localScore?: (verdict: MoveVerdict, survivedWindow: boolean) => number;
  /** Optional progress callback. */
  onMove?: (info: GreedyMoveInfo) => void;
};

export type GreedyMoveInfo = {
  moveIndex: number;
  moveType: string;
  triesUsed: number;
  chosenSeed: number | null;
  outcome: "advanced" | "backtracked" | "stuck";
};

export type GreedySearchResult = {
  /** Final RideResult. May contain skipped moves if the search couldn't reach the end. */
  result: RideResult;
  /** Per-move chosen seeds (null = move was never successfully placed). */
  perMoveSeeds: Array<number | null>;
  /** Total simulations run during search (excludes the final ride() pass). */
  totalSimulations: number;
  /** Backtracking events encountered. */
  backtracks: number;
  /** Did the search reach the last move? */
  reachedEnd: boolean;
};

/**
 * Per-move random search with limited backtracking.
 *
 * For each move in order, try several jitter seeds with a partial
 * simulation lookahead. Pick the best (by local fitness). If all tries
 * for a move fail (rider dies in the lookahead), rewind one move and
 * re-try with a different seed; do this up to `backtrackDepth` times.
 *
 * Much faster than Monte Carlo for hard cases — search effort goes where
 * it's needed. Tradeoff: this is *greedy* (commits to a locally-best
 * choice for each move), so it can miss globally-better configurations
 * that require sacrificing local optimality. Pair with Monte Carlo when
 * diversity matters.
 */
export function searchRideGreedy(
  moves: Move[],
  rideOpts: Omit<RideOpts, "rng" | "perMoveRngs">,
  opts: GreedySearchOpts,
): GreedySearchResult {
  const triesPerMove = opts.triesPerMove ?? 10;
  const backtrackDepth = opts.backtrackDepth ?? 1;
  const lookahead = opts.lookahead ?? 60;
  const baseSeed = opts.seed ?? 1;
  const scoreFn =
    opts.localScore ??
    ((v: MoveVerdict, survivedWindow: boolean): number =>
      (survivedWindow ? 1000 : 0) + (v.passed ? 100 : 0) - v.drift.length * 10);

  const sorted = [...moves].sort((a, b) => a.atFrame - b.atFrame);
  const N = sorted.length;
  if (N === 0) throw new Error("searchRideGreedy: at least one move required");
  const postFrames = rideOpts.postFrames ?? 80;
  const duration = rideOpts.duration ?? sorted[N - 1].atFrame + postFrames;

  // For each move index, the seeds we've already attempted (so backtracking
  // doesn't re-try the same ones).
  const triedSeeds: Array<Set<number>> = sorted.map(() => new Set<number>());
  // Engine snapshots BEFORE each move was placed; used to roll back on backtrack.
  // deno-lint-ignore no-explicit-any
  const snapshotEngine: Array<any> = new Array(N);
  const snapshotAccumulated: Array<number> = new Array(N); // length of accumulated at the snapshot
  const snapshotNextLineId: Array<number> = new Array(N);
  // Final chosen seed per move (null = couldn't place).
  const perMoveSeeds: Array<number | null> = sorted.map(() => null);

  // deno-lint-ignore no-explicit-any
  let engine: any = new LineRiderEngine();
  const accumulated: Array<unknown> = []; // we'll throw this away; ride() rebuilds
  let nextLineId = 1;
  let i = 0;
  let totalSimulations = 0;
  let backtracks = 0;

  while (i < N) {
    const move = sorted[i];
    snapshotEngine[i] = engine;
    snapshotAccumulated[i] = accumulated.length;
    snapshotNextLineId[i] = nextLineId;

    // Generate fresh seeds for this attempt. Use a wide hashing scheme so
    // backtracking + retry doesn't collide.
    let best: { score: number; seed: number; engineAfter: unknown; linesAdded: number; lineIdsConsumed: number } | null = null;
    let triesThisRound = 0;

    while (triesThisRound < triesPerMove) {
      const candidateSeed = baseSeed * 1_000_000 + i * 10_000 + triedSeeds[i].size;
      if (triedSeeds[i].has(candidateSeed)) {
        // Numerical accident — skip and bump
        triesThisRound++;
        continue;
      }
      triedSeeds[i].add(candidateSeed);
      triesThisRound++;
      totalSimulations++;

      const rng = makeRng(candidateSeed);
      const placement = move.place({
        engine,
        accumulated: accumulated as never,
        lineIdStart: nextLineId,
        duration,
        rng,
      });
      const lookEnd = Math.min(duration, placement.endFrame + lookahead);
      const raw = extractRawTrajectory(placement.engineAfter, lookEnd);
      const det = detect(raw);
      const survivedWindow =
        det.terminus.frame >= placement.endFrame || det.terminus.reason === "endOfSpec";
      const range = { start: move.atFrame, end: placement.endFrame };
      const verdict = move.verify(det, range, placement.lineIds);
      const score = scoreFn(verdict, survivedWindow);

      if (best === null || score > best.score) {
        best = {
          score,
          seed: candidateSeed,
          engineAfter: placement.engineAfter,
          linesAdded: placement.lines.length,
          lineIdsConsumed: placement.lines.length,
        };
      }
      // Early exit on clean win.
      if (survivedWindow && verdict.drift.length === 0) break;
    }

    if (best !== null && best.score >= 1000) {
      // Advance.
      perMoveSeeds[i] = best.seed;
      engine = best.engineAfter;
      // Track placeholder lines so accumulated.length stays correct for snapshot semantics.
      for (let k = 0; k < best.linesAdded; k++) accumulated.push(null);
      nextLineId += best.lineIdsConsumed;
      opts.onMove?.({
        moveIndex: i,
        moveType: move.type,
        triesUsed: triesThisRound,
        chosenSeed: best.seed,
        outcome: "advanced",
      });
      i++;
    } else {
      // No surviving try. Backtrack.
      let unwound = 0;
      while (unwound < backtrackDepth && i > 0) {
        i--;
        unwound++;
        // Restore engine + accumulated + nextLineId to the snapshot BEFORE move i.
        engine = snapshotEngine[i];
        // Truncate accumulated back to its length at that point.
        accumulated.length = snapshotAccumulated[i];
        nextLineId = snapshotNextLineId[i];
        perMoveSeeds[i] = null;
        backtracks++;
      }
      opts.onMove?.({
        moveIndex: i + unwound,
        moveType: move.type,
        triesUsed: triesThisRound,
        chosenSeed: null,
        outcome: unwound > 0 ? "backtracked" : "stuck",
      });
      if (unwound === 0) {
        // Can't backtrack further; we're stuck. Break and run with what we have.
        break;
      }
      // Continue from the backtracked position with this index's already-tried seeds
      // remembered (so we explore new ones).
    }
  }

  const reachedEnd = i >= N;

  // Build perMoveRngs from chosen seeds. Null entries fall back to no RNG
  // (deterministic) so the move's adapter chooses static defaults — same as
  // a normal non-search ride for that move.
  const perMoveRngs: Array<(() => number) | undefined> = perMoveSeeds.map((s) =>
    s === null ? undefined : makeRng(s),
  );

  const result = ride(sorted, { ...rideOpts, perMoveRngs, duration });

  return {
    result,
    perMoveSeeds,
    totalSimulations,
    backtracks,
    reachedEnd,
  };
}
