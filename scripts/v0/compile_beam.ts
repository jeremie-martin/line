/**
 * Beam-search v0 compiler — Phase 3 skeleton.
 *
 * Replaces the greedy per-gap commit loop in `compile.ts` with a beam
 * search that keeps the top-N partial tracks ("hypotheses") at each gap
 * boundary. Each hypothesis carries its own incrementally-extended
 * engine state and committed-fits array.
 *
 * Pruning during search: ascending by cumulative per-gap cost, with
 * diversity bucketing on the rider's end-state (via `pruneBeam`).
 *
 * Final re-ranking: each of the N survivor hypotheses has its full
 * track scored via `buildDriftReport` + the same axis_error_rms formula
 * the scorer uses. Best wins. This is the "heuristic prune, exact rank"
 * pattern (Phase 0 finding: per-gap cost is a usable pruning heuristic
 * but the scorer's section-aggregated metric is what we actually
 * optimize).
 *
 * Phase 3 deliberately does NOT include:
 *   - polish passes (added in Phase 5)
 *   - anytime budget API (added in Phase 6)
 *   - backtracking equivalent (beam keeping ≥2 hypotheses alive IS the
 *     answer to greedy's need for backtracking)
 *
 * Determinism: given (spec, seed, beamWidth) → byte-identical Track on
 * any machine. The per-gap RNG is seeded from (seed, gap_index) so all
 * hypotheses at the same gap see the same K candidate samples, and
 * pruneBeam is deterministic.
 */

import { LineRiderEngine } from "../lib/_lr_engine.ts";
import { detect, extractRawTrajectory } from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import { pruneBeam } from "../lib/beam_prune.ts";
import {
  type CompileResult,
  type GapFit,
  type ResolvedStart,
  buildDriftReport,
  buildTrackJson,
  effectiveAxes,
  engineLineFromTrackLine,
  generateRankedCandidates,
  makeBaseEngine,
  residualSearchTargetsForGap,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
  withOptimizedPrerollStart,
} from "./compile.ts";
import {
  AXIS_QUALITY_TOLERANCE,
} from "./score.ts";
import {
  CALIB,
  FPS,
  type CompileStats,
  type Gap,
  type Spec,
  secToFrame,
} from "./types.ts";

export type CompileBeamOptions = {
  /** Beam width. Default 4. Width=1 ≈ greedy (no backtracking). */
  beamWidth?: number;
};

type Hypothesis = {
  fits: (GapFit | null)[];
  cumulativeCost: number;
  // deno-lint-ignore no-explicit-any
  engine: any;
  nextLineId: number;
};

/**
 * Quantized rider end-state for diversity bucketing — mirrors the
 * pattern in `lib/beam_search.ts:130`. Hypotheses whose rider ended up
 * in nearby physical states share a bucket; pruneBeam caps how many
 * may survive per bucket to prevent jitter-twin collapse.
 */
// deno-lint-ignore no-explicit-any
function diversityBucket(engine: any, frame: number): string {
  const r = engine.getRider(frame);
  return `${Math.round(r.position.x / 20)},${Math.round(r.position.y / 20)},` +
         `${Math.round(r.velocity.x * 2)},${Math.round(r.velocity.y * 2)}`;
}

/** Compute axis_quality from a DriftReport (mirrors score.ts logic
 *  without dragging in the timed/score wrapper). */
// deno-lint-ignore no-explicit-any
function axisQualityFromReport(report: any): number {
  const errors: number[] = [];
  for (const section of report.sections) {
    for (const v of Object.values(section.axes ?? {})) {
      // deno-lint-ignore no-explicit-any
      const err = (v as any).error;
      if (typeof err === "number") errors.push(err);
    }
  }
  if (errors.length === 0) return 1;
  const rms = Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / errors.length);
  return Math.exp(-rms / AXIS_QUALITY_TOLERANCE);
}

export function compileBeam(
  userSpec: Spec,
  seed = 0,
  opts: CompileBeamOptions = {},
): CompileResult {
  const beamWidth = opts.beamWidth ?? 4;
  if (!Number.isInteger(beamWidth) || beamWidth < 1) {
    throw new Error(`beamWidth must be a positive integer, got ${beamWidth}`);
  }

  validateSpec(userSpec);
  const spec = withOptimizedPrerollStart(userSpec, seed);
  const startState: ResolvedStart = resolveStartState(spec);
  const durationFrames = secToFrame(spec.duration);
  const contactFrames = [...spec.contacts]
    .map((c) => secToFrame(c.t))
    .sort((a, b) => a - b);

  // Slice + sample gap targets, same as compile.ts.
  const gaps = sliceTimeline(contactFrames, durationFrames);
  const masterRng = makeRng(seed);
  for (const gap of gaps) {
    const sec = effectiveAxes(gap, spec);
    gap.targets = sampleGapTargets(sec, CALIB.SIGMA, masterRng);
  }

  // Initial beam: one hypothesis with the fresh starting engine.
  const initialEngine = makeBaseEngine(startState);
  let beam: Hypothesis[] = [{
    fits: new Array(gaps.length).fill(null),
    cumulativeCost: 0,
    engine: initialEngine,
    nextLineId: 1,
  }];

  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];

    if (!gap.endsWithContact) {
      // Tail gap (no closing Contact). No candidates to commit; each
      // hypothesis just records a null fit and carries forward.
      for (const h of beam) h.fits[i] = null;
      continue;
    }

    const candidatesAcrossBeam: Hypothesis[] = [];

    for (const h of beam) {
      // Per-(gap, hypothesis) fresh RNG — every hypothesis sees the
      // same arc-parameter samples drawn from the same seed. This way
      // beam width=1 mirrors greedy exactly (greedy uses one hypothesis
      // with a fresh per-gap RNG); widths >1 still let each hypothesis
      // evaluate the same candidate-parameter set against its own
      // engine state. Without this, the first hypothesis consumes the
      // shared RNG and later ones see depleted state, producing
      // different (often non-viable) samples.
      const perGapRng = makeRng((seed | 0) * 1000003 + i + 1);
      const searchTargets = residualSearchTargetsForGap(
        h.engine, gap, spec, i, gaps, h.fits,
      );
      const gapCandidates = generateRankedCandidates(
        h.engine, gap, perGapRng, h.nextLineId, contactFrames, durationFrames,
        searchTargets,
      );

      for (const cand of gapCandidates) {
        let newEngine = h.engine;
        for (const line of cand.lines) {
          newEngine = newEngine.addLine(engineLineFromTrackLine(line));
        }
        const newFits = [...h.fits];
        newFits[i] = cand;
        candidatesAcrossBeam.push({
          fits: newFits,
          cumulativeCost: h.cumulativeCost + cand.cost,
          engine: newEngine,
          nextLineId: h.nextLineId + cand.lines.length,
        });
      }
    }

    if (candidatesAcrossBeam.length === 0) {
      // No hypothesis produced any viable candidate at this gap.
      // Skeleton behavior: throw. Phase 5+ may relax this.
      throw new Error(
        `compileBeam: gap ${i} produced no viable candidates ` +
        `across ${beam.length} hypotheses (spec=${spec.duration}s, seed=${seed})`,
      );
    }

    beam = pruneBeam(
      candidatesAcrossBeam,
      (a, b) => a.cumulativeCost - b.cumulativeCost,
      (h) => diversityBucket(h.engine, gap.endFrame),
      { beamWidth },
    );
  }

  // All gaps committed. Re-rank survivors by full-track axis_quality.
  type Scored = { h: Hypothesis; quality: number; report: ReturnType<typeof buildDriftReport> };
  const scored: Scored[] = beam.map((h) => {
    const det = detect(extractRawTrajectory(h.engine, durationFrames + 20));
    const report = buildDriftReport(
      det, spec, gaps, contactFrames, durationFrames, [], h.fits,
    );
    return { h, report, quality: axisQualityFromReport(report) };
  });
  scored.sort((a, b) => b.quality - a.quality);
  const winner = scored[0];

  // Assemble the winning track.
  const allLines = [];
  for (const fit of winner.h.fits) {
    if (fit !== null) allLines.push(...fit.lines);
  }
  const track = buildTrackJson(allLines, durationFrames + 20, startState);

  const stats: CompileStats = {
    candidates_sampled: 0,         // skeleton — not yet wired through
    engine_rebuilds: 0,
    gap_commits: gaps.filter((g) => g.endsWithContact).length,
    gap_backtracks: 0,             // beam doesn't backtrack (by design)
    validation_retries: 0,         // ditto
    polish_iterations: 0,          // Phase 5
    total_committed_cost: winner.h.cumulativeCost,
    committed_costs_per_gap: winner.h.fits.map((f) => (f ? f.cost : null)),
  };

  return { track, report: winner.report, stats };
}

// Re-export Gap as a convenience.
export type { Gap };
