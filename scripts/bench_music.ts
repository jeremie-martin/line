/**
 * Music-driven benchmark suite.
 *
 * Distinct from `scripts/benchmark.ts` (which targets the legacy synthetic
 * specs). This one evaluates beat-driven track generation:
 *
 *   For each (beats file × generator strategy):
 *     1. Generate a track from the beats.
 *     2. Simulate, detect, and compute geometric + behavioral metrics.
 *     3. Compute music-specific metrics (coverage, on-beat).
 *     4. Compute coolScore and survival.
 *     5. Save the generated track to bench/music/<beats>_<strategy>.track.json.
 *
 * The output table is bench/music_baseline.md. The baseline_old strategy
 * (current drums spec + greedy search) is the negative anchor — every new
 * strategy is compared against it explicitly.
 *
 *   npx tsx scripts/bench_music.ts
 *   npx tsx scripts/bench_music.ts --beats=drums_0_30s_60_125 --strategies=baseline_old
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ride, type RideResult } from "./lib/ride.ts";
import { searchRideGreedy } from "./lib/search.ts";
import { slide, catch_, drop, type Move } from "./lib/moves.ts";
import { placeSlideChain } from "./lib/primitive.ts";
import { materializeRoute, composeWithBeats, type Route, type FitOpts } from "./lib/route.ts";
import { planArcBeats, primitiveForIntent, type Arc } from "./lib/arc.ts";
import { detect, extractRawTrajectory, type Detection } from "./lib/detector.ts";
import {
  geometricMetrics,
  behavioralMetrics,
  simulateTrack,
  coolScore,
  musicMetrics,
  type GeometricMetrics,
  type BehavioralMetrics,
  type MusicMetrics,
} from "./lib/metrics.ts";
import { type TrackJson } from "./lib/primitive.ts";

// ────────── CLI ──────────

const argv = process.argv.slice(2);
const arg = (n: string) => {
  const m = argv.find((a) => a.startsWith(`--${n}=`));
  return m ? m.slice(n.length + 3) : null;
};
const outPath = arg("out") ?? "bench/music_baseline.md";
const beatsFilter = arg("beats")?.split(",").map((s) => s.trim());
const stratsFilter = arg("strategies")?.split(",").map((s) => s.trim());

// ────────── Beats file inventory ──────────

export type BeatsEntry = { id: string; path: string; description: string };
export const BEATS: BeatsEntry[] = [
  { id: "drums_0_30s_60_125", path: "beats/drums_0_30s_60_125.json", description: "63 onsets / 30s (the canonical evaluation file)" },
];

export function loadBeatsFile(path: string): { onsets: Array<{ t: number }>; fps: number } {
  return loadBeats(path);
}

const enabledBeats = beatsFilter ? new Set(beatsFilter) : null;

function loadBeats(path: string): { onsets: Array<{ t: number }>; fps: number } {
  const raw = JSON.parse(readFileSync(resolve(path), "utf8")) as {
    onsets: Array<number | { t: number; votes?: number; sources?: string[] }>;
  };
  const onsets = raw.onsets.map((o) => (typeof o === "number" ? { t: o } : { t: o.t }));
  return { onsets, fps: 40 };
}

// ────────── Strategy registry ──────────

export type StrategyResult = {
  /** The generated track. */
  track: TrackJson;
  /** Detection of the track when simulated. */
  detection: Detection;
  /** Wall-clock generation time (ms). */
  elapsedMs: number;
  /** Free-form provenance string (for the table). */
  provenance: string;
};
export type Strategy = {
  id: string;
  description: string;
  /** Given the beats file path and parsed onsets, generate a track. */
  run: (beats: { onsets: Array<{ t: number }>; fps: number }) => StrategyResult;
};

/** Helper: simulate a TrackJson and wrap it as a StrategyResult. */
function fromTrack(track: TrackJson, elapsedMs: number, provenance: string): StrategyResult {
  const detection = simulateTrack(track);
  return { track, detection, elapsedMs, provenance };
}

/** Wrap a beats-aware Route strategy as a Strategy (route is beat-agnostic for now). */
function routeStrategy(id: string, route: Route, description: string): Strategy {
  return {
    id, description,
    run() {
      const t0 = Date.now();
      const track = materializeRoute(route, { label: id, durationFrames: 1200 });
      return fromTrack(track, Date.now() - t0, `route:${id} (${route.length} stages, ${track.lines.length} lines)`);
    },
  };
}

/** Wrap a route + beat-fitter as a Strategy. Each strategy may pass its own
 *  FitOpts — different routes need different stub geometry to avoid ejecting. */
function routeFitStrategy(id: string, route: Route, description: string, fitOpts: FitOpts = {}): Strategy {
  return {
    id, description,
    run({ onsets, fps }) {
      const beatFrames = onsets.map(({ t }) => Math.round(t * fps)).sort((a, b) => a - b);
      const t0 = Date.now();
      const { track, fit } = composeWithBeats(route, beatFrames, {
        ...fitOpts,
        label: id,
        durationFrames: 1200,
      });
      return fromTrack(
        track,
        Date.now() - t0,
        `route+fit:${id} (${route.length} stages, ${fit.placedBeats.length}/${fit.attemptedBeats.length} beats placed)`,
      );
    },
  };
}

/**
 * baseline_old:  the bland-by-design current approach. Every beat → slide
 * or catch (per spacing); greedy search. This IS the negative anchor —
 * the bench fails if no new strategy beats it on coolScore.
 */
const baselineOld: Strategy = {
  id: "baseline_old",
  description: "Per-beat slide/catch mapping + greedy search (the pre-rebuild baseline)",
  run({ onsets, fps }) {
    const MIN_FIRST_FRAME = 30;
    const MIN_SPACING_FRAMES = 6;
    const TIGHT_SPACING_FRAMES = 15;
    type Plan = { frame: number; kind: "slide" | "catch" };
    const plan: Plan[] = [];
    let last = -Infinity;
    for (const { t } of onsets) {
      const f = Math.round(t * fps);
      if (f < MIN_FIRST_FRAME) continue;
      if (f - last < MIN_SPACING_FRAMES) continue;
      const kind = f - last < TIGHT_SPACING_FRAMES ? "catch" : "slide";
      plan.push({ frame: f, kind });
      last = f;
    }
    const moves: Move[] = plan.map(({ frame, kind }) =>
      kind === "slide" ? slide({ at: frame }) : catch_({ at: frame }),
    );
    const t0 = Date.now();
    const g = searchRideGreedy(moves, {}, { triesPerMove: 10, backtrackDepth: 1, seed: 1 });
    return {
      track: g.result.track,
      detection: g.result.detection,
      elapsedMs: Date.now() - t0,
      provenance: `greedy(seed=1, ${moves.length} moves)`,
    };
  },
};

/**
 * baseline_frozen: the historical pre-rebuild output (frozen mp4-quality
 * track from `eval/references/bland/drums_60_125_current.track.json`).
 * This is the absolute negative anchor — what we had before any of the
 * adapter / fitness / route changes landed. It does NOT get re-run; we
 * just read it from disk.
 */
const baselineFrozen: Strategy = {
  id: "baseline_frozen",
  description: "Pre-rebuild output (frozen, byte-identical to what produced the original bland mp4)",
  run() {
    const track = JSON.parse(
      readFileSync(resolve("eval/references/bland/drums_60_125_current.track.json"), "utf8"),
    ) as TrackJson;
    return fromTrack(track, 0, "frozen pre-rebuild artifact");
  },
};

// Compose-then-place strategies — routes are beat-agnostic for now.
// Beat fitting is the next iteration; for this commit, we're measuring
// whether the *geometry alone* is meaningfully cooler than the baseline.
import swoopingRoute from "../templates/swooping.ts";
import staccatoRoute from "../templates/staccato.ts";
import aerialRoute from "../templates/aerial.ts";
import descendThenClimbArc from "../arcs/descend_then_climb.ts";
import dunesArc from "../arcs/dunes.ts";
import swoopingPeakArc from "../arcs/swooping_peak.ts";
import { landingCandidates } from "./lib/primitive_search.ts";
import { searchRideBeam } from "./lib/beam_search.ts";

// ── Iterative offset-correction wrapper ──
//
// After a greedy run, measure each move's per-move offset (actual event
// frame − nominal target). For moves with |offset| > 1, shift the move's
// atFrame in the OPPOSITE direction by that offset and re-run greedy.
// Converges in 2-4 iterations: each pass shrinks systematic bias and
// reduces the long-tail beats that ended up 11-20f off.
//
// The strategy supplies `targets` (nominal beat frames, one per move) and
// `makeMove(target, atFrameWithShift, idx)`. The wrapper handles the
// iteration loop, measurement of actuals, and shift update.

import type { GreedySearchResult } from "./lib/search.ts";

type IterableSpec = {
  id: string;
  description: string;
  /** Given parsed beats, return per-move targets + a Move factory. */
  prepare: (beats: { onsets: Array<{ t: number }>; fps: number }) => {
    targets: number[];
    makeMove: (target: number, atFrameWithShift: number, idx: number) => Move;
  };
  /** Default 3. */
  iters?: number;
  /** Override greedy triesPerMove. Default: use per-type defaults. */
  triesPerMove?: number;
};

function iterativeStrategy(spec: IterableSpec): Strategy {
  const iters = spec.iters ?? 3;
  return {
    id: spec.id,
    description: spec.description,
    run(beats) {
      const { targets, makeMove } = spec.prepare(beats);
      const shifts = new Array(targets.length).fill(0);
      let last: GreedySearchResult | null = null;
      let totalMs = 0;

      for (let it = 0; it < iters; it++) {
        const moves = targets.map((t, idx) => makeMove(t, t + shifts[idx], idx));
        const t0 = Date.now();
        const greedyOpts: Parameters<typeof searchRideGreedy>[2] = {
          backtrackDepth: 1,
          seed: 1,
          ...(spec.triesPerMove !== undefined ? { triesPerMove: spec.triesPerMove } : {}),
        };
        const g = searchRideGreedy(moves, {}, greedyOpts);
        const iterMs = Date.now() - t0;
        totalMs += iterMs;
        last = g;
        process.stderr.write(`    [${spec.id}] iter ${it + 1}/${iters}: ${iterMs}ms, ${g.totalSimulations} sims, survived=${g.result.survived ? "Y" : "N"}\n`);
        if (it === iters - 1) break;

        // Measure per-move signed offset against the nominal target (NOT the shifted atFrame).
        // signedOffset = actualEvent - target. Late by 5 → next iter, shift atFrame by -5.
        let updates = 0;
        const newShifts = shifts.slice();
        for (let i = 0; i < g.result.steps.length; i++) {
          const step = g.result.steps[i];
          if (step.skipped || !step.placement) continue;
          const owned = new Set(step.placement.lineIds);
          let bestOffset = Infinity;
          let bestE: number | null = null;
          for (const e of g.result.detection.events) {
            if (e.type !== "landing" && e.type !== "bounce") continue;
            const lids = g.result.detection.measurements.contactLineIds[e.frame] ?? [];
            if (!lids.some((id) => owned.has(id))) continue;
            const o = Math.abs(e.frame - targets[i]);
            if (o < bestOffset) { bestOffset = o; bestE = e.frame; }
          }
          if (bestE === null) continue;
          const signedOffset = bestE - targets[i];
          if (Math.abs(signedOffset) > 1) {
            // Cap per-iter shift delta to prevent compounding instability.
            const delta = Math.max(-5, Math.min(5, -signedOffset));
            newShifts[i] = shifts[i] + delta;
            updates++;
          }
        }
        // Clamp shifts so consecutive moves preserve min-spacing (avoids
        // pathological greedy thrashing when shifted atFrames bunch up).
        const MIN_SPACING = 12;
        for (let i = 1; i < newShifts.length; i++) {
          const prevAt = targets[i - 1] + newShifts[i - 1];
          const thisAt = targets[i] + newShifts[i];
          if (thisAt - prevAt < MIN_SPACING) {
            newShifts[i] = prevAt + MIN_SPACING - targets[i];
          }
        }
        for (let i = 0; i < shifts.length; i++) shifts[i] = newShifts[i];
        if (updates === 0) break; // converged
      }

      return {
        track: last!.result.track,
        detection: last!.result.detection,
        elapsedMs: totalMs,
        provenance: `iter${iters}+greedy(seed=1)`,
      };
    },
  };
}

// ── Arc-driven strategy ──
//
// Combine creative-control Arc spec with iterative beat-precision search.
// Each beat picks a primitive based on its arc section intent (descend →
// drop, level → drop/slide alternation, climb → kicker, freestyle →
// round-robin). Then runs greedy + iterative offset correction so beats
// land on time regardless of intent.

function arcStrategy(id: string, description: string, arc: Arc, iters = 1): Strategy {
  return iterativeStrategy({
    id,
    description,
    iters,
    // Arcs mix kicker (8 tries) and slide (3 tries) — cap at 5 to keep
    // bench reasonable. The continuous precision bonus + iter correction
    // compensates for fewer per-move samples.
    triesPerMove: 5,
    prepare({ onsets, fps }) {
      const beatFrames = onsets.map(({ t }) => Math.round(t * fps));
      const planned = planArcBeats(beatFrames, arc, fps, { minFirstFrame: 30, minSpacingFrames: 15 });
      return {
        targets: planned.map((p) => p.target),
        makeMove: (_target, atFrame, idx) =>
          primitiveForIntent(planned[idx].intent, atFrame, planned[idx].idxInSection),
      };
    },
  });
}

// ── Drop-search strategy ──
//
// Each beat → a `drop` Move. Drops produce airborne phases (the air time
// the user wants). Greedy search tunes per-drop geometry to maximize
// fitness (which now includes beat adherence × 200).
//
// The user's ask: precise sync + lots of air. baseline_old (slide/catch)
// has sync but no air. compose_swooping_fit had small stubs (not air).
// This combines both: drop = air + landing event; search = precise tuning.
const dropSearchStrategy: Strategy = {
  id: "compose_drop_search",
  description: "drop() at each beat + greedy search (optimizer-tuned air time + landing)",
  run({ onsets, fps }) {
    const beatFrames = onsets.map(({ t }) => Math.round(t * fps)).sort((a, b) => a - b);
    // Drops need >= 6 frames between for the rider to actually become
    // airborne; tighter spacings get merged into a continuous slide and
    // produce no landing event. Filter and require ≥ 15-frame gaps so each
    // beat is a discrete landing.
    const filtered: number[] = [];
    let last = -Infinity;
    for (const f of beatFrames) {
      if (f < 30) continue;
      if (f - last < 15) continue;
      filtered.push(f); last = f;
    }
    const moves: Move[] = filtered.map((f) => drop({ at: f }));
    const t0 = Date.now();
    const g = searchRideGreedy(moves, {}, { triesPerMove: 10, backtrackDepth: 1, seed: 1 });
    return {
      track: g.result.track,
      detection: g.result.detection,
      elapsedMs: Date.now() - t0,
      provenance: `drop+greedy(${filtered.length}/${beatFrames.length} beats, seed=1)`,
    };
  },
};

// ── Drop+slide-brake strategy ──
//
// drop_search produces unbounded acceleration: each drop adds vy → vx keeps
// growing → eventually the rider tunnels through lines and free-falls.
//
// Inject a `slide` Move every BRAKE_EVERY beats. Slides catch the rider at a
// shallow angle (3-20°), bleeding vy into the slide before re-launching.
// This keeps rider speed bounded AND varies line direction (slides go right-
// and-down at a different angle than drops, so the visual is less monotone).
const dropBrakeSearchStrategy: Strategy = {
  id: "compose_drop_brake_search",
  description: "drop() with periodic slide() brakes — bounded speed, varied direction",
  run({ onsets, fps }) {
    const beatFrames = onsets.map(({ t }) => Math.round(t * fps)).sort((a, b) => a - b);
    const filtered: number[] = [];
    let last = -Infinity;
    for (const f of beatFrames) {
      if (f < 30) continue;
      if (f - last < 15) continue;
      filtered.push(f); last = f;
    }
    const BRAKE_EVERY = 3; // every 3rd beat is a slide brake instead of a drop
    const moves: Move[] = filtered.map((f, i) =>
      (i + 1) % BRAKE_EVERY === 0 ? slide({ at: f }) : drop({ at: f }),
    );
    const t0 = Date.now();
    const g = searchRideGreedy(moves, {}, { triesPerMove: 10, backtrackDepth: 1, seed: 1 });
    return {
      track: g.result.track,
      detection: g.result.detection,
      elapsedMs: Date.now() - t0,
      provenance: `drop+slide-brake+greedy(${filtered.length}/${beatFrames.length} beats, brake every ${BRAKE_EVERY}, seed=1)`,
    };
  },
};

// ── Slide-chain strategy ──
//
// Uses the existing `placeSlideChain` primitive (no Move framework). Each
// beat → a sloped curve placed at the rider's predicted position. No
// per-curve search — the curves' shape is fixed. Lighter than drop_search
// but proves out the "use the existing physics-aware primitives" hypothesis.
const slideChainStrategy: Strategy = {
  id: "compose_slide_chain",
  description: "placeSlideChain — sloped curves catching airborne rider, no per-curve search",
  run({ onsets, fps }) {
    const beatFrames = onsets.map(({ t }) => Math.round(t * fps)).sort((a, b) => a - b);
    const filtered: number[] = [];
    let last = -Infinity;
    for (const f of beatFrames) {
      if (f < 30) continue;
      if (f - last < 8) continue;
      filtered.push(f); last = f;
    }
    const t0 = Date.now();
    const result = placeSlideChain(filtered);
    return fromTrack(result.track, Date.now() - t0, `placeSlideChain(${filtered.length}/${beatFrames.length} beats)`);
  },
};

// ── Phase 2: primitive-type search ──
//
// For each beat, greedy expands across feasible landing primitives
// (slide/drop/glide/catch/landAt/landUp/jump) via expandCandidates, and tries
// jitter seeds for each. The compiler picks the best (primitive, seed) per
// beat rather than the strategy author hardcoding "always slide" or "always drop".
//
// Compared with baseline_old (always slide/catch) and compose_drop_search
// (always drop), this strategy lets the per-beat primitive choice react to
// incoming rider state — a slow rider gets catch/landAt; a fast rider can
// get slide/drop/glide; etc.
// Shared filter for primitive-search-family strategies.
function filteredBeats(onsets: Array<{ t: number }>, fps: number): number[] {
  const f: number[] = [];
  let last = -Infinity;
  for (const o of onsets) {
    const fr = Math.round(o.t * fps);
    if (fr < 30) continue;
    if (fr - last < 15) continue;
    f.push(fr); last = fr;
  }
  return f;
}

const primitiveSearchStrategy: Strategy = {
  id: "compose_primitive_search",
  description: "Per-beat primitive-type search over landing candidates (Phase 2)",
  run({ onsets, fps }) {
    const filtered = filteredBeats(onsets, fps);
    const moves: Move[] = filtered.map((f) => slide({ at: f }));
    const t0 = Date.now();
    const g = searchRideGreedy(moves, {}, {
      triesPerMove: 1,
      backtrackDepth: 1,
      seed: 1,
      expandCandidates: (move, rider) =>
        landingCandidates(rider).map((c) => c.factory(move.atFrame)),
    });
    return {
      track: g.result.track,
      detection: g.result.detection,
      elapsedMs: Date.now() - t0,
      provenance: `primitive_search(${filtered.length}/${onsets.length} beats, ${g.totalSimulations} sims)`,
    };
  },
};

// Phase 3.1: primitive-type search + lookahead-2 control.
// Same as primitive_search but scores each candidate considering the next
// beat's achievable precision under that candidate's engineAfter. Catches
// "locally optimal but downstream broken" placements. Cost: ~2× per beat.
const primitiveSearchLa2Strategy: Strategy = {
  id: "compose_primitive_search_la2",
  description: "Primitive-type search + lookahead-2 (Phase 3.1 control)",
  run({ onsets, fps }) {
    const filtered = filteredBeats(onsets, fps);
    const moves: Move[] = filtered.map((f) => slide({ at: f }));
    const t0 = Date.now();
    const g = searchRideGreedy(moves, {}, {
      triesPerMove: 1,
      backtrackDepth: 1,
      seed: 1,
      lookaheadPairs: true,
      expandCandidates: (move, rider) =>
        landingCandidates(rider).map((c) => c.factory(move.atFrame)),
    });
    return {
      track: g.result.track,
      detection: g.result.detection,
      elapsedMs: Date.now() - t0,
      provenance: `primitive_search+la2(${filtered.length}/${onsets.length} beats, ${g.totalSimulations} sims)`,
    };
  },
};

// Phase 3.2: beam search with primitive-type expansion.
// K=4 beam members, B=2 per member per beat → 8 candidates per beat per
// candidate-primitive type. With landingCandidates returning ~7 primitives,
// that's ~56 sims per beat — much more than greedy. The decision gate in
// P3.3 evaluates whether beam earns this cost vs lookahead-2.
const beamSearchStrategy: Strategy = {
  id: "compose_beam_search",
  description: "Beam search (K=4 B=2) with primitive-type expansion (Phase 3.2)",
  run({ onsets, fps }) {
    const filtered = filteredBeats(onsets, fps);
    const moves: Move[] = filtered.map((f) => slide({ at: f }));
    const t0 = Date.now();
    const r = searchRideBeam(moves, {}, {
      K: 4,
      B: 2,
      seed: 1,
      expandCandidates: (move, rider) =>
        landingCandidates(rider).map((c) => c.factory(move.atFrame)),
    });
    return {
      track: r.track,
      detection: r.detection,
      elapsedMs: Date.now() - t0,
      provenance: `beam(K=4,B=2; ${filtered.length}/${onsets.length} beats, ${r.totalSimulations} sims, reachedEnd=${r.reachedEnd})`,
    };
  },
};

export const STRATEGIES: Strategy[] = [
  baselineFrozen,                                                                     // pre-rebuild absolute floor
  baselineOld,                                                                        // current per-beat approach (after rebuild)
  // Routes alone — beat-agnostic geometry.
  routeStrategy("compose_swooping", swoopingRoute, "Swooping route, no beat fit"),
  routeStrategy("compose_staccato", staccatoRoute, "Staccato route, no beat fit"),
  routeStrategy("compose_aerial",   aerialRoute,   "Aerial route, no beat fit"),
  // Routes + beat fitting. Each template needs its own stub size to stay alive.
  routeFitStrategy("compose_swooping_fit", swoopingRoute, "Swooping + beat-fitted stubs", { bumpHalfLengthPx: 3, bumpOffsetDownPx: 2 }),
  routeFitStrategy("compose_staccato_fit", staccatoRoute, "Staccato + beat-fitted stubs", { bumpHalfLengthPx: 2, bumpOffsetDownPx: 2 }),
  routeFitStrategy("compose_aerial_fit",   aerialRoute,   "Aerial + beat-fitted stubs",   { bumpHalfLengthPx: 2, bumpOffsetDownPx: 2 }),
  // Sync-focused: optimizer + air-time primitives.
  slideChainStrategy,
  dropSearchStrategy,
  dropBrakeSearchStrategy,
  // Iterative offset correction wrapped over drop and drop+brake.
  iterativeStrategy({
    id: "compose_drop_iter_search",
    description: "drop() at each beat + greedy + iterative offset correction (3 passes)",
    iters: 3,
    prepare({ onsets, fps }) {
      const beatFrames = onsets.map(({ t }) => Math.round(t * fps)).sort((a, b) => a - b);
      const filtered: number[] = [];
      let last = -Infinity;
      for (const f of beatFrames) {
        if (f < 30) continue;
        if (f - last < 15) continue;
        filtered.push(f); last = f;
      }
      return {
        targets: filtered,
        makeMove: (_target, atFrame) => drop({ at: atFrame }),
      };
    },
  }),
  iterativeStrategy({
    id: "compose_drop_brake_iter_search",
    description: "drop + brake-slide every 3rd + greedy + iterative correction (3 passes)",
    iters: 3,
    prepare({ onsets, fps }) {
      const beatFrames = onsets.map(({ t }) => Math.round(t * fps)).sort((a, b) => a - b);
      const filtered: number[] = [];
      let last = -Infinity;
      for (const f of beatFrames) {
        if (f < 30) continue;
        if (f - last < 15) continue;
        filtered.push(f); last = f;
      }
      const BRAKE_EVERY = 3;
      return {
        targets: filtered,
        makeMove: (_target, atFrame, idx) =>
          (idx + 1) % BRAKE_EVERY === 0 ? slide({ at: atFrame }) : drop({ at: atFrame }),
      };
    },
  }),
  // Arc-driven strategies — creative control + sync precision.
  arcStrategy("compose_arc_descend_climb", "Descend 0-15s, climb 15-30s", descendThenClimbArc),
  arcStrategy("compose_arc_dunes",         "Alternating descend/climb (5s cycles)", dunesArc),
  arcStrategy("compose_arc_swooping_peak", "Descend → level → climb → descend", swoopingPeakArc),
  // Phase 2: primitive-type search. Per beat, greedy expands across feasible
  // landing primitives (slide/drop/glide/catch/landAt/landUp/jump) and tries
  // jitter seeds for each. The compiler picks the best (primitive, seed) per
  // beat rather than the strategy author hardcoding "always slide" or "always drop".
  primitiveSearchStrategy,
  // Phase 3.1: primitive-type search + lookahead-2 (cheap control vs beam).
  primitiveSearchLa2Strategy,
  // Phase 3.2: beam search — SHELVED by the P3.3 decision gate
  // (bench/v2/decisions.md). Lookahead-2 captured the same precision gain
  // at ~3× lower compute. Beam stays in the registry so it remains opt-in
  // runnable via `--strategies=compose_beam_search`, but it is NOT a default
  // baseline candidate any more.
  beamSearchStrategy,
];

const enabledStrats = stratsFilter ? new Set(stratsFilter) : null;

// ────────── Run ──────────

type Row = {
  beatsId: string;
  strategyId: string;
  elapsedMs: number;
  provenance: string;
  survived: boolean;
  geom: GeometricMetrics;
  behav: BehavioralMetrics;
  music: MusicMetrics;
  cool: number;
  /** Non-null when the strategy threw — all other metric fields are placeholders. */
  threwMessage?: string;
};

// Gate top-level execution so this module can be imported (by bench/v2/run.ts
// and others) without triggering a full bench run as a side effect of import.
// Only runs when this file is the entry point.
const isMain = (() => {
  try {
    const entry = process.argv[1] ? new URL(`file://${process.argv[1]}`).href : "";
    return import.meta.url === entry;
  } catch { return false; }
})();
if (!isMain) {
  // Imported as a library — skip execution; consumers use the exported
  // STRATEGIES / BEATS / loadBeatsFile only.
  // (Using throw-as-control-flow would be cleaner but the rest of the module
  //  is at top level. The explicit guard is fine for this size.)
} else {

const rows: Row[] = [];
const trackOutDir = resolve("bench/music");
mkdirSync(trackOutDir, { recursive: true });

for (const beats of BEATS) {
  if (enabledBeats && !enabledBeats.has(beats.id)) continue;
  const parsed = loadBeats(beats.path);
  const beatFramesSorted = parsed.onsets.map((o) => Math.round(o.t * parsed.fps)).sort((a, b) => a - b);

  for (const strat of STRATEGIES) {
    if (enabledStrats && !enabledStrats.has(strat.id)) continue;
    process.stdout.write(`  ${beats.id} × ${strat.id} ... `);
    try {
      const sr = strat.run(parsed);
      const det = sr.detection;
      const geom = geometricMetrics(sr.track);
      const behav = behavioralMetrics(det);
      const music = musicMetrics(det, beatFramesSorted, 2);
      const cool = coolScore({ ...geom, ...behav });
      rows.push({
        beatsId: beats.id, strategyId: strat.id, elapsedMs: sr.elapsedMs,
        provenance: sr.provenance, survived: behav.survived,
        geom, behav, music, cool,
      });
      // Tail-trim: write the track with `duration` cropped to the last
      // contact frame (+ small grace). Search/sim ran at full duration but
      // the rendered mp4 stops here, so the rider doesn't free-fall into
      // the void past the end of geometry.
      //
      // Using "last contact frame" rather than "last landing event" because
      // the rider may legitimately slide across multiple lines after the
      // last detected event — cutting at the event would crop visible
      // sliding. Using "last contact" preserves the full ridden portion
      // and cuts only the empty free-fall tail.
      const lastContactFrame = (() => {
        const air = det.measurements.airborne;
        for (let f = Math.min(det.terminus.frame, air.length - 1); f >= 0; f--) {
          if (!air[f]) return f;
        }
        return -1;
      })();
      const trimmedTrack = lastContactFrame > 0
        ? { ...sr.track, duration: Math.min(sr.track.duration, lastContactFrame + 8) }
        : sr.track;
      const trackPath = resolve(trackOutDir, `${beats.id}_${strat.id}.track.json`);
      writeFileSync(trackPath, JSON.stringify(trimmedTrack, null, 2));
      process.stdout.write(
        `cool=${cool.toFixed(0).padStart(5)} cov=${music.eventCoveragePct.toFixed(0).padStart(3)}% adh=${music.onBeatAdherencePct.toFixed(0).padStart(3)}% surv=${behav.survived ? "Y" : "N"} (${sr.elapsedMs}ms)\n`,
      );
    } catch (e) {
      const msg = String(e).slice(0, 200);
      process.stdout.write(`THREW: ${msg}\n`);
      // Push a placeholder row so the strategy appears in the report (instead
      // of silently vanishing — the failure mode that produced the 1-row
      // music_baseline.md). Metric fields are placeholders; renderer checks
      // threwMessage and shows "THREW" in the cells.
      rows.push({
        beatsId: beats.id,
        strategyId: strat.id,
        elapsedMs: 0,
        provenance: `THREW: ${msg}`,
        survived: false,
        geom: { angleStdDeg: 0, angleEntropyBits: 0, verticalExtentPx: 0, spreadEfficiency: 0 } as GeometricMetrics,
        behav: {
          survived: false, contactFractionLive: 0, eventRatePerSec: 0,
          eventTypeEntropyBits: 0, trajectoryVerticalPx: 0, vySignFlips: 0,
          slowSlideFraction: 0, longestContactRun: 0, longestAirborneRun: 0,
          meanVxSliding: 0,
        } as BehavioralMetrics,
        music: {
          beatCount: 0,
          eventCoveragePct: 0, onBeatAdherencePct: 0, meanBeatOffsetFrames: 0,
          medianBeatOffsetFrames: 0, p90BeatOffsetFrames: 0, maxBeatOffsetFrames: 0,
          onBeat1: 0, onBeat2: 0, onBeat5: 0, onBeat10: 0,
          perBeatSignedOffsets: [],
          perBeatMatchedType: [],
          landingMatchFraction: 0, landingOnBeat1: 0, landingOnBeat2: 0, landingOnBeat5: 0,
          landingMedianOffsetFrames: 0, landingMeanOffsetFrames: 0,
        } satisfies MusicMetrics,
        cool: 0,
        threwMessage: msg,
      });
    }
  }
}

// ────────── Render markdown report ──────────

function fmt(n: number, d = 0): string { return n.toFixed(d); }

const lines: string[] = [];
lines.push(`# Music benchmark`);
lines.push(``);
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(``);
lines.push(`Baseline strategy: \`baseline_old\` (current per-beat slide/catch + greedy).`);
lines.push(`This is the negative anchor — new strategies must beat it on coolScore.`);
lines.push(``);

for (const beats of BEATS) {
  const beatsRows = rows.filter((r) => r.beatsId === beats.id);
  if (beatsRows.length === 0) continue;
  lines.push(`## ${beats.id}`);
  lines.push(``);
  lines.push(`_${beats.description}_`);
  lines.push(``);
  lines.push(`### Cool-axis metrics`);
  lines.push(``);
  lines.push(`| strategy | survived | coolScore | angleStd° | entropy | vert px | vyFlips | evt/s | airFrac | ms |`);
  lines.push(`|---|---|---|---|---|---|---|---|---|---|`);
  for (const r of beatsRows) {
    if (r.threwMessage) {
      lines.push(`| ${r.strategyId} | ✗ THREW | — | — | — | — | — | — | — | — |`);
      continue;
    }
    const airFrac = 1 - r.behav.contactFractionLive;
    lines.push(
      `| ${r.strategyId} | ${r.survived ? "✓" : "✗"} | ${fmt(r.cool)} ` +
        `| ${fmt(r.geom.angleStdDeg, 1)} | ${fmt(r.geom.angleEntropyBits, 2)} ` +
        `| ${fmt(r.geom.verticalExtentPx)} | ${r.behav.vySignFlips} ` +
        `| ${fmt(r.behav.eventRatePerSec, 2)} | ${(airFrac * 100).toFixed(0)}% | ${r.elapsedMs} |`,
    );
  }
  lines.push(``);
  lines.push(`### Music-sync metrics (landings + bounces, kicks excluded)`);
  lines.push(``);
  lines.push(`On-beat % at four tolerances. Offset distribution shows precision in frames (1 frame = 25 ms).`);
  lines.push(``);
  lines.push(`| strategy | cov% | ±1f | ±2f | ±5f | ±10f | median | mean | p90 | max |`);
  lines.push(`|---|---|---|---|---|---|---|---|---|---|`);
  for (const r of beatsRows) {
    if (r.threwMessage) {
      lines.push(`| ${r.strategyId} | THREW | — | — | — | — | — | — | — | — |`);
      continue;
    }
    lines.push(
      `| ${r.strategyId} | ${fmt(r.music.eventCoveragePct)} ` +
        `| ${fmt(r.music.onBeat1, 1)} | ${fmt(r.music.onBeat2, 1)} | ${fmt(r.music.onBeat5, 1)} | ${fmt(r.music.onBeat10, 1)} ` +
        `| ${fmt(r.music.medianBeatOffsetFrames, 1)} | ${fmt(r.music.meanBeatOffsetFrames, 1)} ` +
        `| ${fmt(r.music.p90BeatOffsetFrames, 1)} | ${fmt(r.music.maxBeatOffsetFrames, 1)} |`,
    );
  }
  lines.push(``);
  lines.push(`### Landing-only sync (strict — the visual punctuation)`);
  lines.push(``);
  lines.push(`Same beats, but only matched against \`landing\` events (excludes bounces).`);
  lines.push(`A landing is the distinct impact moment; bounces are incidental brief airbornes.`);
  lines.push(``);
  lines.push(`| strategy | landings/beats | L ±1f | L ±2f | L ±5f | L median | L mean |`);
  lines.push(`|---|---|---|---|---|---|---|`);
  for (const r of beatsRows) {
    if (r.threwMessage) {
      lines.push(`| ${r.strategyId} | THREW | — | — | — | — | — |`);
      continue;
    }
    lines.push(
      `| ${r.strategyId} | ${fmt(r.music.landingMatchFraction * 100)}% ` +
        `| ${fmt(r.music.landingOnBeat1, 1)} | ${fmt(r.music.landingOnBeat2, 1)} | ${fmt(r.music.landingOnBeat5, 1)} ` +
        `| ${fmt(r.music.landingMedianOffsetFrames, 1)} | ${fmt(r.music.landingMeanOffsetFrames, 1)} |`,
    );
  }
  lines.push(``);
}

const md = lines.join("\n");
console.log("\n" + md);

mkdirSync(resolve("bench"), { recursive: true });
writeFileSync(resolve(outPath), md);
console.log(`\nReport written to: ${resolve(outPath)}`);

} // end of isMain guard
