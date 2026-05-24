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
import { readIncoming, type IncomingState } from "./adapt.ts";

import { LineRiderEngine } from "./_lr_engine.ts";

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
 * Two parts:
 *
 *   1. coolScore (from metrics.ts) — survival gate + geometric/behavioral
 *      diversity. Already calibrated against labeled reference set.
 *   2. Continuous beat-precision penalty — smooth per-beat score that
 *      rewards small offsets more than large offsets. Gives the optimizer
 *      a gradient between miss-by-3 and miss-by-19, which the previous
 *      binary hit-at-±ε fitness did not.
 *
 *   fitness  =  coolScore
 *               + (allPassed ? 100 : 0)
 *               + 250 × mean_{moves}(exp(-offset² / 2σ²))
 *
 * σ = 3 frames means a 3-frame offset scores ~0.61, a 6-frame ~0.14, a
 * 9-frame ~0.01. Beats with no event within a wide match window
 * (BEAT_MATCH_WINDOW = 30 frames) contribute 0.
 *
 * Compared to the old `hitFraction × 200` at ε=2: precision better than ±2
 * is now rewarded, AND degrees of miss are distinguished. The optimizer
 * should collapse the current bimodal offset distribution (40 beats ≤ 2f,
 * 20 beats 11-20f) toward an interior peak.
 *
 * Tunable: pass a custom `fitness` in SearchOpts / GreedySearchOpts.
 */
import {
  geometricMetrics,
  behavioralMetrics,
  coolScore as coolScoreFn,
} from "./metrics.ts";

const BEAT_PRECISION_SIGMA = 3; // frames
const BEAT_MATCH_WINDOW = 30;   // frames — beats with no event within this contribute 0

export function beatPrecisionScore(r: RideResult, sigma = BEAT_PRECISION_SIGMA): number {
  const adherence = beatAdherence(r, BEAT_MATCH_WINDOW);
  if (adherence.totalBeats === 0) return 0;
  let sum = 0;
  const twoSigmaSq = 2 * sigma * sigma;
  for (const b of adherence.perBeat) {
    if (b.offset === null) continue;
    sum += Math.exp(-(b.offset * b.offset) / twoSigmaSq);
  }
  return sum / adherence.totalBeats;
}

export function defaultFitness(r: RideResult): number {
  const geom = geometricMetrics(r.track);
  const behav = behavioralMetrics(r.detection);
  const base = coolScoreFn({ ...geom, ...behav });
  return base + (r.allPassed ? 100 : 0) + beatPrecisionScore(r) * 250;
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
  /**
   * Phase-2: primitive-type search.
   *
   * Given the original move and the rider's incoming state at that beat,
   * return a set of candidate Moves to try. The search iterates
   * `triesPerMove` seeds across EACH candidate (so total inner tries is
   * `candidateCount × triesPerMove`); the best-scoring (candidate, seed)
   * wins.
   *
   * Default (when this option is omitted): returns `[move]` — back-compat
   * with the original single-primitive-per-beat greedy.
   *
   * Use `landingCandidates` from `./primitive_search.ts` for the common
   * "any landing primitive that fits the rider state" case.
   */
  expandCandidates?: (move: Move, rider: IncomingState) => Move[];

  /**
   * Phase-3: lookahead-2 control.
   *
   * When true, scoring a candidate at beat i ALSO places the next beat
   * (i+1) under that candidate's engineAfter, evaluates its precision
   * bonus, and adds half of it to the candidate's local score.
   *
   * Effect: catches the "locally optimal but downstream broken" pathology
   * where a candidate looks good in isolation but leaves the rider in a
   * state where i+1 cannot land cleanly. Used as the cheap-alternative
   * control vs beam search (P3.2). Cost: roughly 2× per-beat compute.
   *
   * Default false (preserves existing behavior).
   */
  lookaheadPairs?: boolean;
};

export type GreedyMoveInfo = {
  moveIndex: number;
  moveType: string;
  triesUsed: number;
  chosenSeed: number | null;
  outcome: "advanced" | "backtracked" | "stuck";
  /** Did the accepted placement fire an event within ε of move.atFrame? */
  onBeat?: boolean;
};

export type GreedySearchResult = {
  /** Final RideResult. May contain skipped moves if the search couldn't reach the end. */
  result: RideResult;
  /** Per-move chosen seeds (null = move was never successfully placed). */
  perMoveSeeds: Array<number | null>;
  /** Per-move on-beat status (true = placement fired a landing/bounce within ε of atFrame). */
  perMoveOnBeat: Array<boolean>;
  /** Per-move chosen primitive type. Equals the original move.type when
   *  `expandCandidates` is not used; differs when primitive-type search
   *  picks a different primitive than the user-provided move. */
  perMovePrimitiveType: Array<string>;
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
  // Whether the accepted placement fired on-beat.
  const perMoveOnBeat: Array<boolean> = sorted.map(() => false);
  // When primitive-type search is in use, the actual Move chosen for each
  // beat. Starts as a copy of the input moves (back-compat); the search
  // overwrites entries when expandCandidates picks a different primitive.
  const chosenMoves: Move[] = sorted.slice();

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

    // Phase 2: expand into a candidate set. Default = just the original move
    // (preserves back-compat with the single-primitive-per-beat greedy).
    // The inner tries iterate (candidate × seed) — total inner sims this
    // round = candidates.length × triesPerMove.
    const candidates: Move[] = opts.expandCandidates
      ? opts.expandCandidates(move, readIncoming(engine, move.atFrame))
      : [move];
    if (candidates.length === 0) {
      // No feasible candidate — treat like an exhausted scale round (skip to
      // escalation / backtrack logic below).
      // best stays null; the decision block handles it.
    }

    let best: {
      score: number;
      seed: number;
      scale: number;
      engineAfter: unknown;
      linesAdded: number;
      lineIdsConsumed: number;
      onBeat: boolean;
      candidateIdx: number;
      candidateLineIds: number[];
    } | null = null;

    candidateLoop: for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
      const candidate = candidates[cIdx];
      let triesThisCandidate = 0;
      while (triesThisCandidate < triesPerMove) {
        // Seed must be unique per (beat, candidate, try, scale-round) so we
        // never re-try the same configuration. The recipe:
        //   seed = base * 1e6 + beat * 1e4 + candidate * 1e3 + tryIdx
        // For scale-round escalation we increment via triedSeeds[i].size,
        // which counts all tries across all candidates/rounds for this beat.
        const candidateSeed =
          baseSeed * 1_000_000 + i * 10_000 + cIdx * 1_000 + triedSeeds[i].size;
        if (triedSeeds[i].has(candidateSeed)) {
          triesThisCandidate++;
          continue;
        }
        triedSeeds[i].add(candidateSeed);
        triesThisCandidate++;
        totalSimulations++;

        const rng = makeRng(candidateSeed);
        const placement = candidate.place({
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
        const range = { start: candidate.atFrame, end: placement.endFrame };
        const verdict = candidate.verify(det, range, placement.lineIds);
        // Per-move beat precision: continuous Gaussian decay weighted by
        // event type. Landings are the visual punctuation; bounces partial
        // credit; kicks excluded (don't visually correspond to beats).
        const SIGMA = 3;
        const matchWindow = 30;
        const LANDING_WEIGHT = 500;
        const BOUNCE_WEIGHT = 250;
        const ownedLineIds = new Set(placement.lineIds);
        let landingBestOffset = Infinity;
        let bounceBestOffset = Infinity;
        for (const e of det.events) {
          if (e.type !== "landing" && e.type !== "bounce") continue;
          const lids = det.measurements.contactLineIds[e.frame] ?? [];
          if (!lids.some((id) => ownedLineIds.has(id))) continue;
          const o = Math.abs(e.frame - candidate.atFrame);
          if (e.type === "landing" && o < landingBestOffset) landingBestOffset = o;
          if (e.type === "bounce" && o < bounceBestOffset) bounceBestOffset = o;
        }
        const landingBonus = landingBestOffset <= matchWindow
          ? LANDING_WEIGHT * Math.exp(-(landingBestOffset * landingBestOffset) / (2 * SIGMA * SIGMA))
          : 0;
        const bounceBonus = bounceBestOffset <= matchWindow
          ? BOUNCE_WEIGHT * Math.exp(-(bounceBestOffset * bounceBestOffset) / (2 * SIGMA * SIGMA))
          : 0;
        const precisionBonus = Math.max(landingBonus, bounceBonus);
        const bestOffset = Math.min(landingBestOffset, bounceBestOffset);
        const onBeat = bestOffset <= 5;

        // Phase-3 lookahead-2: also place beat i+1 under THIS candidate's
        // engineAfter and add half its precision bonus to the score. Catches
        // the "locally optimal but leaves the rider in a bad state for the
        // next beat" pathology that pure greedy hits often on dense rhythms.
        // Cheap: one extra place() + lookahead-sized detect per candidate.
        let nextBeatBonus = 0;
        if (opts.lookaheadPairs && i + 1 < N) {
          const nextMove = sorted[i + 1];
          // Use the rider state at nextMove.atFrame under THIS candidate's
          // engineAfter, then expand candidates (if expansion enabled).
          const nextRider = readIncoming(placement.engineAfter, nextMove.atFrame);
          const nextCandidates = opts.expandCandidates
            ? opts.expandCandidates(nextMove, nextRider)
            : [nextMove];
          // Try just the FIRST next-beat candidate (cheap). The seed is fixed
          // (deterministic per i+1) so we don't blow up the seed space.
          if (nextCandidates.length > 0) {
            const peekCand = nextCandidates[0];
            const peekRng = makeRng(baseSeed * 1_000_000 + (i + 1) * 10_000);
            try {
              const peekPlace = peekCand.place({
                engine: placement.engineAfter,
                accumulated: accumulated as never,
                lineIdStart: nextLineId + placement.lines.length,
                duration,
                rng: peekRng,
                jitterScale: 1,
              });
              const peekEnd = Math.min(duration, peekPlace.endFrame + lookahead);
              const peekRaw = extractRawTrajectory(peekPlace.engineAfter, peekEnd);
              const peekDet = detect(peekRaw);
              const peekOwned = new Set(peekPlace.lineIds);
              let peekLanding = Infinity;
              let peekBounce = Infinity;
              for (const e of peekDet.events) {
                if (e.type !== "landing" && e.type !== "bounce") continue;
                const lids = peekDet.measurements.contactLineIds[e.frame] ?? [];
                if (!lids.some((id) => peekOwned.has(id))) continue;
                const o = Math.abs(e.frame - peekCand.atFrame);
                if (e.type === "landing" && o < peekLanding) peekLanding = o;
                if (e.type === "bounce" && o < peekBounce) peekBounce = o;
              }
              const peekLandBonus = peekLanding <= matchWindow
                ? LANDING_WEIGHT * Math.exp(-(peekLanding * peekLanding) / (2 * SIGMA * SIGMA))
                : 0;
              const peekBounBonus = peekBounce <= matchWindow
                ? BOUNCE_WEIGHT * Math.exp(-(peekBounce * peekBounce) / (2 * SIGMA * SIGMA))
                : 0;
              nextBeatBonus = 0.5 * Math.max(peekLandBonus, peekBounBonus);
              // Sims used for the lookahead — count toward totalSimulations.
              totalSimulations++;
            } catch { /* peek failed: candidate is bad enough we don't credit nextBeatBonus */ }
          }
        }

        const score = scoreFn(verdict, survivedWindow) + precisionBonus + nextBeatBonus;

        if (best === null || score > best.score) {
          best = {
            score,
            seed: candidateSeed,
            scale: jitterScale,
            engineAfter: placement.engineAfter,
            linesAdded: placement.lines.length,
            lineIdsConsumed: placement.lines.length,
            onBeat,
            candidateIdx: cIdx,
            candidateLineIds: placement.lineIds,
          };
        }
        if (survivedWindow && verdict.drift.length === 0 && onBeat) {
          // Found a survivor+on-beat: stop trying more candidates and tries.
          break candidateLoop;
        }
      }
    }

    // Decide: advance, escalate, or backtrack.
    //   - If we found a config that fires on-beat (survived AND beat hit):
    //     accept immediately.
    //   - Else if we haven't exhausted scale escalation: widen bands and
    //     try again. This is the key fix for the "placed but didn't fire"
    //     problem — we keep trying until either onBeat or we've explored
    //     the full scale schedule.
    //   - Else if we at least have a survival config: accept the
    //     survival-only placement (move places but won't fire on beat —
    //     reported honestly).
    //   - Else: backtrack.
    const maxScale = scaleRound[i] >= SCALE_SCHEDULE.length - 1;
    const triesUsed = triedSeeds[i].size;

    if (best !== null && best.onBeat) {
      // Best case: on-beat survivor.
      perMoveSeeds[i] = best.seed;
      perMoveScales[i] = best.scale;
      perMoveOnBeat[i] = true;
      chosenMoves[i] = candidates[best.candidateIdx];
      engine = best.engineAfter;
      for (let k = 0; k < best.linesAdded; k++) accumulated.push(null);
      nextLineId += best.lineIdsConsumed;
      opts.onMove?.({
        moveIndex: i,
        moveType: chosenMoves[i].type,
        triesUsed,
        chosenSeed: best.seed,
        outcome: "advanced",
        onBeat: true,
      });
      scaleRound[i] = 0;
      i++;
    } else if (!maxScale) {
      // Escalate scale and retry — either no survivor or survival-only.
      scaleRound[i]++;
      opts.onMove?.({
        moveIndex: i,
        moveType: move.type,
        triesUsed,
        chosenSeed: null,
        outcome: "advanced",
        onBeat: false,
      });
    } else if (best !== null && best.score >= 1000) {
      // Exhausted scale; settle for survival-only. The beat is honestly missed
      // but the rider lives to see the next beat.
      perMoveSeeds[i] = best.seed;
      perMoveScales[i] = best.scale;
      perMoveOnBeat[i] = false;
      chosenMoves[i] = candidates[best.candidateIdx];
      engine = best.engineAfter;
      for (let k = 0; k < best.linesAdded; k++) accumulated.push(null);
      nextLineId += best.lineIdsConsumed;
      opts.onMove?.({
        moveIndex: i,
        moveType: chosenMoves[i].type,
        triesUsed,
        chosenSeed: best.seed,
        outcome: "advanced",
        onBeat: false,
      });
      scaleRound[i] = 0;
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
        triesUsed: triedSeeds[Math.min(i + unwound, N - 1)].size,
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

  // Use chosenMoves[] (not the original sorted[]) so the final ride
  // materializes whatever primitive the search picked per beat. When
  // expandCandidates wasn't used, chosenMoves === sorted; back-compat.
  const result = ride(chosenMoves, {
    ...rideOpts,
    perMoveRngs,
    perMoveJitterScales: perMoveScales,
    duration,
  });

  return {
    result,
    perMoveSeeds,
    perMoveOnBeat,
    perMovePrimitiveType: chosenMoves.map((m) => m.type),
    totalSimulations,
    backtracks,
    reachedEnd,
  };
}
