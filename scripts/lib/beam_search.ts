/**
 * Beam search compiler — Phase 3.2 of the optimizer redesign.
 *
 * Keeps K partial sequences ("beam members") alive instead of committing to
 * a single locally-best placement per beat. At each beat, each member is
 * expanded into B candidate placements; we prune the K*B total candidates
 * back to K using a lexicographic key that prevents both diversity collapse
 * and survival-vs-precision conflation.
 *
 * ─── Pre-conditions (verified) ───────────────────────────────────────────
 * 1. lr-core engine is immutable (Object.create + Object.assign in
 *    `lr-core/immo/index.js:64-67`); multiple engineAfter snapshots can live
 *    simultaneously across beam members without copy cost.
 * 2. Every Move type produces deterministic geometry under a fixed
 *    (seed, scale) — see `tests/place_determinism.test.ts`. This is what
 *    lets us assemble the final TrackJson directly from the winning beam's
 *    accumulated lines, without re-running through `ride()`.
 *
 * ─── Why these design choices ────────────────────────────────────────────
 * • **Materialize from accumulated lines, NOT a final ride() replay.**
 *   The beam's accumulated lines ARE the track. Re-running through ride()
 *   would re-call adapter functions with seeds and risk RNG-order drift.
 *
 * • **Diversity bucketing** (hash on rounded end-state) caps how many beam
 *   members can share a bucket. Prevents the classic beam degeneration
 *   where K=4 collapses to four jitter-twins of the same placement.
 *
 * • **Lexicographic pruning** — survival tier first, then cumulative
 *   precision-sum. A surviving beat always ranks above a dead one, regardless
 *   of cumulative score. Avoids the "easy beats accumulating +1500 each
 *   crush a hard-but-correct trajectory at +1200" pathology.
 *
 * • **Beam death (no backtracking)** — if all K members die at beat i, we
 *   lower the survival threshold for that beat ONLY and mark it
 *   `degraded: true`. Backtracking-on-beam-death is MCTS in a trenchcoat;
 *   if measurements show we need it, build MCTS — not a half-step.
 */

import { type Move, type Placement, type TrackLine } from "./moves.ts";
import type { TrackJson } from "./primitive.ts";
import { makeRng } from "./rng.ts";
import { detect, extractRawTrajectory, type Detection } from "./detector.ts";
import { readIncoming, type IncomingState } from "./adapt.ts";
import { LineRiderEngine } from "./_lr_engine.ts";

// ────────── Types ──────────

export type BeamSearchOpts = {
  /** Beam width — number of partial sequences kept after each beat. Default 4. */
  K?: number;
  /** Branching factor per beam member per beat — number of (candidate, seed)
   *  pairs evaluated when expanding. Default 3. */
  B?: number;
  /** Lookahead frames for the partial scoring sim (mirrors greedy's lookahead). */
  lookahead?: number;
  /** Base seed; per-beat / per-beam / per-try seeds derive from this. */
  seed?: number;
  /**
   * Optional candidate expansion. Given the beat's original move and the
   * rider's incoming state at the beam member's engine, return candidate
   * moves to evaluate. Default: `[move]` (single-primitive-per-beat — beam
   * collapses to "K trials of the same primitive with different seeds").
   *
   * Combined with K > 1, expandCandidates is what makes beam search a real
   * primitive-type search: each beam member can take a different primitive.
   */
  expandCandidates?: (move: Move, rider: IncomingState) => Move[];
  /** Optional progress callback per beat. */
  onBeat?: (info: BeamBeatInfo) => void;
};

export type BeamBeatInfo = {
  beatIdx: number;
  survivorsK: number;
  /** True if no beam member survived this beat at the normal threshold;
   *  the threshold was lowered and the beat is marked degraded. */
  degraded: boolean;
  /** Number of (candidate, seed) pairs evaluated this beat. */
  expansions: number;
  /** Number of unique diversity buckets in the surviving K. */
  uniqueBuckets: number;
};

export type BeamSearchResult = {
  /** Final assembled TrackJson — lines come from the winning beam's
   *  accumulatedLines, in placement order. */
  track: TrackJson;
  /** Detection of the assembled track. */
  detection: Detection;
  /** Per-beat trace: what primitive type was picked, the per-beat score, etc. */
  perBeat: Array<{
    beatIdx: number;
    primitiveType: string;
    chosenSeed: number;
    /** True if this beat ran at the lowered survival threshold (no clean survivors). */
    degraded: boolean;
  }>;
  /** Total sims simulated across all expansions. */
  totalSimulations: number;
  /** Did we reach the last beat at all (vs all beam members died earlier)? */
  reachedEnd: boolean;
};

// ────────── Internal beam member ──────────

type BeamMember = {
  /** Live engine after the most recent accepted placement. Immutable, so
   *  multiple members can share an engine if they took the same prefix. */
  // deno-lint-ignore no-explicit-any
  engine: any;
  /** Lines accumulated so far, in placement order. */
  accumulatedLines: TrackLine[];
  /** Next line id to use for the next placement. */
  nextLineId: number;
  /** Cumulative sum of per-beat precision bonuses (used as secondary prune key). */
  cumulativeScore: number;
  /** Count of beats this member has survived. The PRIMARY prune key. */
  survivalTier: number;
  /** Per-beat trace — what primitive was picked at each beat. */
  history: Array<{ primitiveType: string; seed: number; degraded: boolean }>;
  /** Diversity bucket key for this member's CURRENT end-state (post most
   *  recent placement). Recomputed each beat. */
  diversityHash: string;
};

// ────────── Helpers ──────────

/** Diversity bucket hash — quantized rider end-state. With K=4 the cap is
 *  ⌈K/2⌉ = 2 members per bucket; the prune step enforces this. */
function diversityBucket(rider: IncomingState): string {
  return `${Math.round(rider.pos.x / 20)},${Math.round(rider.pos.y / 20)},${Math.round(rider.velocity.x * 2)},${Math.round(rider.velocity.y * 2)}`;
}

// ────────── Score helpers ──────────

const SIGMA = 3;
const MATCH_WINDOW = 30;
const LANDING_WEIGHT = 500;
const BOUNCE_WEIGHT = 250;

function precisionBonus(det: Detection, ownedLineIds: Set<number>, targetFrame: number): number {
  let landingBestOffset = Infinity;
  let bounceBestOffset = Infinity;
  for (const e of det.events) {
    if (e.type !== "landing" && e.type !== "bounce") continue;
    const lids = det.measurements.contactLineIds[e.frame] ?? [];
    if (!lids.some((id) => ownedLineIds.has(id))) continue;
    const o = Math.abs(e.frame - targetFrame);
    if (e.type === "landing" && o < landingBestOffset) landingBestOffset = o;
    if (e.type === "bounce" && o < bounceBestOffset) bounceBestOffset = o;
  }
  const landingBonus = landingBestOffset <= MATCH_WINDOW
    ? LANDING_WEIGHT * Math.exp(-(landingBestOffset * landingBestOffset) / (2 * SIGMA * SIGMA))
    : 0;
  const bounceBonus = bounceBestOffset <= MATCH_WINDOW
    ? BOUNCE_WEIGHT * Math.exp(-(bounceBestOffset * bounceBestOffset) / (2 * SIGMA * SIGMA))
    : 0;
  return Math.max(landingBonus, bounceBonus);
}

// ────────── Main entry ──────────

export function searchRideBeam(
  moves: Move[],
  rideOpts: { duration?: number; postFrames?: number },
  opts: BeamSearchOpts = {},
): BeamSearchResult {
  const K = opts.K ?? 4;
  const B = opts.B ?? 3;
  const lookahead = opts.lookahead ?? 60;
  const baseSeed = opts.seed ?? 1;
  const expandCandidates = opts.expandCandidates ?? ((m) => [m]);

  const sorted = [...moves].sort((a, b) => a.atFrame - b.atFrame);
  const N = sorted.length;
  if (N === 0) throw new Error("searchRideBeam: at least one move required");
  const postFrames = rideOpts.postFrames ?? 80;
  const duration = rideOpts.duration ?? sorted[N - 1].atFrame + postFrames;

  // Initial beam: a single member starting from a fresh engine. We'll fan
  // out to K members after the first beat's expansion.
  // deno-lint-ignore no-explicit-any
  const initialEngine: any = new LineRiderEngine();
  let beam: BeamMember[] = [{
    engine: initialEngine,
    accumulatedLines: [],
    nextLineId: 1,
    cumulativeScore: 0,
    survivalTier: 0,
    history: [],
    diversityHash: diversityBucket(readIncoming(initialEngine, 0)),
  }];

  let totalSimulations = 0;
  let reachedEnd = true;

  for (let i = 0; i < N; i++) {
    const move = sorted[i];

    // Expand each beam member into B candidates. Total: |beam| × candidates × B.
    type Candidate = {
      // deno-lint-ignore no-explicit-any
      engine: any;
      accumulatedLines: TrackLine[];
      nextLineId: number;
      cumulativeScore: number;
      survivalTier: number;
      history: BeamMember["history"];
      diversityHash: string;
      survivedWindow: boolean;
    };
    const candidates: Candidate[] = [];

    let expansions = 0;
    for (const m of beam) {
      const rider = readIncoming(m.engine, move.atFrame);
      const candidateMoves = expandCandidates(move, rider);
      if (candidateMoves.length === 0) {
        // No feasible candidate — propagate the member unchanged with a 0
        // score increment; it'll get pruned out unless other members all die.
        candidates.push({
          engine: m.engine,
          accumulatedLines: m.accumulatedLines,
          nextLineId: m.nextLineId,
          cumulativeScore: m.cumulativeScore,
          survivalTier: m.survivalTier, // didn't advance — will lose pruning
          history: m.history,
          diversityHash: m.diversityHash,
          survivedWindow: false,
        });
        continue;
      }
      // Sample B distinct seeds per candidate-move. Each (candidate, try) is
      // independent. With B=3 and candidateMoves.length=7 (landing intent),
      // that's 21 sims per beam member. With K=4 beams, 84 sims per beat.
      // Keep B small unless the candidate set is small.
      for (let cIdx = 0; cIdx < candidateMoves.length; cIdx++) {
        const cand = candidateMoves[cIdx];
        for (let t = 0; t < B; t++) {
          const seed = baseSeed * 1_000_000 + i * 10_000 + cIdx * 1_000 + beam.indexOf(m) * 100 + t;
          const rng = makeRng(seed);
          let placement: Placement;
          try {
            placement = cand.place({
              engine: m.engine,
              accumulated: m.accumulatedLines as never,
              lineIdStart: m.nextLineId,
              duration,
              rng,
              jitterScale: 1,
            });
          } catch { continue; } // bad placement; skip
          expansions++;
          totalSimulations++;
          const lookEnd = Math.min(duration, placement.endFrame + lookahead);
          const raw = extractRawTrajectory(placement.engineAfter, lookEnd);
          const det = detect(raw);
          const survivedWindow =
            det.terminus.frame >= placement.endFrame || det.terminus.reason === "endOfSpec";
          const pb = precisionBonus(det, new Set(placement.lineIds), cand.atFrame);

          const newRider = readIncoming(placement.engineAfter, placement.endFrame);
          candidates.push({
            engine: placement.engineAfter,
            accumulatedLines: m.accumulatedLines.concat(placement.lines),
            nextLineId: m.nextLineId + placement.lines.length,
            cumulativeScore: m.cumulativeScore + pb,
            survivalTier: m.survivalTier + (survivedWindow ? 1 : 0),
            history: m.history.concat([{
              primitiveType: cand.type,
              seed,
              degraded: false,
            }]),
            diversityHash: diversityBucket(newRider),
            survivedWindow,
          });
        }
      }
    }

    // Filter for survivors only — anyone who didn't advance their survival
    // tier this beat is a casualty. If NO survivors at all, mark beam-death
    // and degrade.
    let survivors = candidates.filter((c) => c.survivedWindow);
    let degraded = false;
    if (survivors.length === 0) {
      // Beam death: no candidate survived the lookahead at this beat.
      // Lower the threshold and accept best-effort placements (the ones with
      // any positive cumulative score). Mark them degraded so the trace
      // tells the user.
      degraded = true;
      survivors = candidates.filter((c) => c.cumulativeScore > 0);
      for (const s of survivors) {
        // Mark this beat in the member's history as degraded.
        s.history[s.history.length - 1] = {
          ...s.history[s.history.length - 1],
          degraded: true,
        };
      }
      if (survivors.length === 0) {
        // Even with relaxed threshold, nothing survived. The whole beam is dead.
        reachedEnd = false;
        break;
      }
    }

    // Prune to top K using lexicographic key:
    //   (survivalTier desc, bucketCount asc capped at ⌈K/2⌉, cumulativeScore desc)
    // Step 1: sort by survivalTier desc, then cumulativeScore desc.
    survivors.sort((a, b) => {
      if (a.survivalTier !== b.survivalTier) return b.survivalTier - a.survivalTier;
      return b.cumulativeScore - a.cumulativeScore;
    });
    // Step 2: pick top-K with bucket cap.
    const maxPerBucket = Math.ceil(K / 2);
    const bucketCounts = new Map<string, number>();
    const newBeam: Candidate[] = [];
    for (const c of survivors) {
      if (newBeam.length >= K) break;
      const cnt = bucketCounts.get(c.diversityHash) ?? 0;
      if (cnt >= maxPerBucket) continue;
      bucketCounts.set(c.diversityHash, cnt + 1);
      newBeam.push(c);
    }
    // If bucket cap left newBeam below K (highly bucketed survivors), fall
    // back to plain top-K from sorted (rare).
    if (newBeam.length < K && survivors.length >= K) {
      const seen = new Set(newBeam);
      for (const c of survivors) {
        if (newBeam.length >= K) break;
        if (seen.has(c)) continue;
        newBeam.push(c);
      }
    }

    beam = newBeam.map((c) => ({
      engine: c.engine,
      accumulatedLines: c.accumulatedLines,
      nextLineId: c.nextLineId,
      cumulativeScore: c.cumulativeScore,
      survivalTier: c.survivalTier,
      history: c.history,
      diversityHash: c.diversityHash,
    }));

    opts.onBeat?.({
      beatIdx: i,
      survivorsK: beam.length,
      degraded,
      expansions,
      uniqueBuckets: new Set(beam.map((m) => m.diversityHash)).size,
    });

    if (beam.length === 0) {
      reachedEnd = false;
      break;
    }
  }

  // Pick the winning beam: highest survivalTier (ties broken by cumulativeScore).
  beam.sort((a, b) => {
    if (a.survivalTier !== b.survivalTier) return b.survivalTier - a.survivalTier;
    return b.cumulativeScore - a.cumulativeScore;
  });
  const winner = beam[0];

  // Assemble the TrackJson DIRECTLY from accumulated lines — no ride() replay,
  // so no risk of search-vs-materialization geometry drift.
  const track: TrackJson = {
    label: "beam-search-result",
    creator: "line",
    description: "Generated by scripts/lib/beam_search.ts",
    duration,
    version: "6.2",
    audio: null,
    startPosition: { x: 0, y: 0 },
    riders: [
      { startPosition: { x: 0, y: 0 }, startVelocity: { x: 0.4, y: 0 }, remountable: 1 },
    ],
    layers: [
      { id: 0, type: 0, name: "Base Layer", visible: true, editable: true, folderId: -1 },
    ],
    script: "",
    lines: winner.accumulatedLines,
  };
  const detection = detect(extractRawTrajectory(winner.engine, duration));

  return {
    track,
    detection,
    perBeat: winner.history.map((h, i) => ({
      beatIdx: i,
      primitiveType: h.primitiveType,
      chosenSeed: h.seed,
      degraded: h.degraded,
    })),
    totalSimulations,
    reachedEnd,
  };
}
