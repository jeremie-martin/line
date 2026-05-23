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
 * For each move's atFrame, find the nearest landing/bounce event that's
 * within ε frames. Matches are greedy: closest pairs first; each event
 * can satisfy only one beat.
 *
 * This is the "did the rider land where the user asked" signal. For
 * music-driven specs, atFrames are beat times and this directly measures
 * sync quality. For non-music specs it still tells you "did each move
 * fire its expected event on time."
 */
export type BeatAdherence = {
  /** Total moves considered (excludes skipped). */
  totalBeats: number;
  /** Hits = moves with a landing/bounce within ε of atFrame. */
  hits: number;
  /** hits / totalBeats. */
  hitFraction: number;
  /** Mean absolute frame offset for hits (lower = tighter sync). */
  meanHitOffset: number;
  perBeat: Array<{
    atFrame: number;
    moveType: string;
    eventFrame: number | null;
    offset: number | null;
    hit: boolean;
  }>;
};

export function beatAdherence(result: RideResult, epsilon = 2): BeatAdherence {
  const landingsAndBounces = result.detection.events.filter(
    (e) => e.type === "landing" || e.type === "bounce",
  );
  const liveSteps = result.steps.filter((s) => !s.skipped);

  // Build all candidate (beat, event) pairs within ε and sort by distance.
  const pairs: Array<{ stepIdx: number; eventIdx: number; offset: number }> = [];
  for (let s = 0; s < liveSteps.length; s++) {
    const target = liveSteps[s].move.atFrame;
    for (let e = 0; e < landingsAndBounces.length; e++) {
      const offset = Math.abs(landingsAndBounces[e].frame - target);
      if (offset <= epsilon) pairs.push({ stepIdx: s, eventIdx: e, offset });
    }
  }
  pairs.sort((a, b) => a.offset - b.offset);

  // Greedy bipartite matching.
  const usedSteps = new Set<number>();
  const usedEvents = new Set<number>();
  const matched: Record<number, { eventFrame: number; offset: number }> = {};
  for (const p of pairs) {
    if (usedSteps.has(p.stepIdx) || usedEvents.has(p.eventIdx)) continue;
    usedSteps.add(p.stepIdx);
    usedEvents.add(p.eventIdx);
    matched[p.stepIdx] = {
      eventFrame: landingsAndBounces[p.eventIdx].frame,
      offset: p.offset,
    };
  }

  const perBeat = liveSteps.map((s, i) => {
    const m = matched[i];
    return {
      atFrame: s.move.atFrame,
      moveType: s.move.type,
      eventFrame: m?.eventFrame ?? null,
      offset: m?.offset ?? null,
      hit: !!m,
    };
  });

  const hits = perBeat.filter((b) => b.hit).length;
  const offsets = perBeat.filter((b) => b.hit).map((b) => b.offset!);
  const meanHitOffset = offsets.length > 0
    ? offsets.reduce((a, b) => a + b, 0) / offsets.length
    : 0;

  return {
    totalBeats: liveSteps.length,
    hits,
    hitFraction: liveSteps.length > 0 ? hits / liveSteps.length : 0,
    meanHitOffset,
    perBeat,
  };
}

/**
 * Default fitness function.
 *
 * Reformulated 2026-05-23 after the drums-spec experiment surfaced that
 * the previous fitness rewarded "long flat slide" trivially — the
 * optimizer's straight-line output literally maximized the previous score.
 *
 * New hierarchy:
 *   1. Survival (+500). Lower than before — survival is necessary but
 *      not nearly sufficient.
 *   2. Beat adherence: fraction of moves whose landing fired within ε
 *      of their atFrame. ×1000 — this is now the primary signal.
 *   3. All moves passed (no catastrophic mid-move failure): +100
 *   4. Stall penalty: rider sliding with vx < 1.5 = -500 (anti-cheat)
 *   5. Tie-breakers: contact %, mean vx, longest slide — each capped to
 *      a small contribution so they can't dominate adherence.
 *   6. Drift entries: -30 each (heavier than before — each missed
 *      contract is a meaningful penalty).
 */
export function defaultFitness(r: RideResult): number {
  const s = r.detection.summary;
  let driftCount = 0;
  for (const step of r.steps) {
    if (step.verdict) driftCount += step.verdict.drift.length;
  }
  const adherence = beatAdherence(r, 2);

  let score = 0;
  if (r.survived) score += 500;
  if (r.allPassed) score += 100;
  // Primary: did the rider land where asked?
  score += adherence.hitFraction * 1000;
  // Tie-breakers (capped, small).
  score += Math.min(s.meanVxSliding * 10, 60);
  score += s.contactFractionSpec * 50;
  score += Math.min(s.longestContactRun, 40);
  // Stall penalty: rider stuck going nowhere while in contact.
  if (s.meanVxSliding < 1.5 && s.contactFractionSpec > 0.3) score -= 500;
  // Drift: each missed contract is meaningful.
  score -= driftCount * 30;
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

/**
 * Per-move-type default tries budget. Easier moves get fewer tries;
 * harder ones (wave, halfPipe, loop) get more. Override at the call
 * site with opts.triesPerMove to force a uniform value.
 */
export const DEFAULT_TRIES_BY_TYPE: Record<string, number> = {
  slide: 3,
  curve: 3,
  glide: 3,
  drop: 5,
  ramp: 5,
  catch: 3,
  gap: 1,
  brake: 4,
  sigmoid: 8,
  kicker: 8,
  bounceStrip: 5,
  wave: 12,
  halfPipe: 8,
  loop: 12,
  jump: 6,
  tune: 1, // tune already does internal search
};

/**
 * Jitter-scale escalation schedule for retry rounds. Round 0 = normal
 * bands (1×); if all tries at 1× fail, retry with 1.75×; then 2.5×.
 * Beyond the schedule we resort to backtracking.
 */
const SCALE_SCHEDULE = [1, 1.75, 2.5];

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
  // When triesPerMove is undefined, we use DEFAULT_TRIES_BY_TYPE per move.
  // The user can force a uniform count by passing triesPerMove explicitly.
  const triesPerMoveOverride = opts.triesPerMove;
  const backtrackDepth = opts.backtrackDepth ?? 1;
  const lookahead = opts.lookahead ?? 60;
  const baseSeed = opts.seed ?? 1;
  const scoreFn =
    opts.localScore ??
    ((v: MoveVerdict, survivedWindow: boolean): number =>
      (survivedWindow ? 1000 : 0) + (v.passed ? 100 : 0) - v.drift.length * 30);

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
  // Final chosen jitter scale per move (parallel to perMoveSeeds).
  const perMoveScales: Array<number> = sorted.map(() => 1);

  // deno-lint-ignore no-explicit-any
  let engine: any = new LineRiderEngine();
  const accumulated: Array<unknown> = []; // we'll throw this away; ride() rebuilds
  let nextLineId = 1;
  let i = 0;
  let totalSimulations = 0;
  let backtracks = 0;

  // Per-move jitter-scale tracking — bumps each time we re-enter a move
  // without success (so the second batch widens bands).
  const scaleRound: number[] = sorted.map(() => 0);

  while (i < N) {
    const move = sorted[i];
    snapshotEngine[i] = engine;
    snapshotAccumulated[i] = accumulated.length;
    snapshotNextLineId[i] = nextLineId;

    const triesPerMove =
      triesPerMoveOverride ?? DEFAULT_TRIES_BY_TYPE[move.type] ?? 5;
    // jitterScale escalates over scaleRound[i] up to the schedule's last value.
    const scaleIdx = Math.min(scaleRound[i], SCALE_SCHEDULE.length - 1);
    const jitterScale = SCALE_SCHEDULE[scaleIdx];

    let best: { score: number; seed: number; scale: number; engineAfter: unknown; linesAdded: number; lineIdsConsumed: number } | null = null;
    let triesThisRound = 0;

    while (triesThisRound < triesPerMove) {
      const candidateSeed = baseSeed * 1_000_000 + i * 10_000 + triedSeeds[i].size;
      if (triedSeeds[i].has(candidateSeed)) {
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
        jitterScale,
      });
      const lookEnd = Math.min(duration, placement.endFrame + lookahead);
      const raw = extractRawTrajectory(placement.engineAfter, lookEnd);
      const det = detect(raw);
      const survivedWindow =
        det.terminus.frame >= placement.endFrame || det.terminus.reason === "endOfSpec";
      const range = { start: move.atFrame, end: placement.endFrame };
      const verdict = move.verify(det, range, placement.lineIds);
      // Beat-adherence bonus: did a landing/bounce fire within ε frames
      // of this move's atFrame? Heavily rewards on-beat configurations.
      const epsilon = 2;
      const ownedLineIds = new Set(placement.lineIds);
      const onBeat = det.events.some((e) => {
        if (e.type !== "landing" && e.type !== "bounce") return false;
        if (Math.abs(e.frame - move.atFrame) > epsilon) return false;
        const lids = det.measurements.contactLineIds[e.frame] ?? [];
        return lids.some((id) => ownedLineIds.has(id));
      });
      const score = scoreFn(verdict, survivedWindow) + (onBeat ? 500 : 0);

      if (best === null || score > best.score) {
        best = {
          score,
          seed: candidateSeed,
          scale: jitterScale,
          engineAfter: placement.engineAfter,
          linesAdded: placement.lines.length,
          lineIdsConsumed: placement.lines.length,
        };
      }
      if (survivedWindow && verdict.drift.length === 0 && onBeat) break;
    }

    if (best !== null && best.score >= 1000) {
      perMoveSeeds[i] = best.seed;
      perMoveScales[i] = best.scale;
      engine = best.engineAfter;
      for (let k = 0; k < best.linesAdded; k++) accumulated.push(null);
      nextLineId += best.lineIdsConsumed;
      opts.onMove?.({
        moveIndex: i,
        moveType: move.type,
        triesUsed: triesThisRound,
        chosenSeed: best.seed,
        outcome: "advanced",
      });
      // Reset scaleRound for this move so a future re-visit starts fresh.
      scaleRound[i] = 0;
      i++;
    } else if (scaleRound[i] < SCALE_SCHEDULE.length - 1) {
      // Escalate jitter scale before resorting to backtracking.
      scaleRound[i]++;
      opts.onMove?.({
        moveIndex: i,
        moveType: move.type,
        triesUsed: triesThisRound,
        chosenSeed: null,
        outcome: "advanced", // not quite — but it's not a backtrack
      });
      // Stay at this move; next iteration runs with wider bands.
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

  const result = ride(sorted, {
    ...rideOpts,
    perMoveRngs,
    perMoveJitterScales: perMoveScales,
    duration,
  });

  return {
    result,
    perMoveSeeds,
    totalSimulations,
    backtracks,
    reachedEnd,
  };
}
