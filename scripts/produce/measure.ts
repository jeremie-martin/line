/**
 * Pure, I/O-free metric extraction + the production qualification gate.
 *
 * This is the ONE place every production metric is computed, so `characterize`
 * (the distribution study) and `produce` (the live gate) read identical numbers.
 * Nothing here touches the filesystem, the engine, or the score objective — it
 * only reads an already-compiled {track, report} plus its trace.
 */
import { scoreDriftReport } from "../v0/score.ts";
import { computeStands } from "../lib/rotation.ts";
import { FPS } from "../v0/types.ts";
import type { TrackJson } from "../lib/primitive.ts";
import type { Trace } from "../v0/core/trace.ts";

/** The report type accepted by the scorer (DriftReport), pulled structurally so
 *  this module need not name-import it. */
type Report = Parameters<typeof scoreDriftReport>[0];

// "Substantial" stand = real, sustained standing, not a one-gap blip. This is the
// agreed production definition (mirrors rank_stands.ts): dur ≥ 0.7s AND ≥ 2 landings.
export const SUBSTANTIAL_MIN_DUR_S = 0.7;
export const SUBSTANTIAL_MIN_LANDINGS = 2;

export type SeedMetrics = {
  seed: number;
  /** scoreDriftReport(...).score — the ~650 sync/axis-quality number. */
  score: number;
  /** Σ substantial-stand seconds as a % of track duration (the portable stand metric). */
  standTimePct: number;
  /** Whole-track airborne revolutions (trace.features.revolutions). */
  rotations: number;
  /** Airborne arcs with |net rotation| > 180° (trace.features.flipCount). */
  flipCount: number;
  /** terminus.reason === "endOfSpec" — the rider survived the whole spec. */
  reachedEnd: boolean;
  /** Off-beat landing count. */
  offBeat: number;
  /** The scorer's hard-failure-free contract (reachedEnd ∧ no drift/missing ∧ no off-beat). */
  contractPassed: boolean;
  /** terminus.frame — last simulated frame. */
  durationFrames: number;
};

/** Compute every production metric for one compiled seed. Pure. */
export function measure(seed: number, track: TrackJson, report: Report, trace: Trace): SeedMetrics {
  const s = scoreDriftReport(report, { totalFrames: track.duration });

  const sled = trace.frames.map((f) => (f.sledPoseDeg == null ? NaN : f.sledPoseDeg));
  const air = trace.frames.map((f) => f.airborne);
  const substantialS = computeStands(sled, air)
    .filter((st) => st.lengthFrames / FPS >= SUBSTANTIAL_MIN_DUR_S && st.landings >= SUBSTANTIAL_MIN_LANDINGS)
    .reduce((a, st) => a + st.lengthFrames / FPS, 0);
  const durationS = track.duration / FPS;

  return {
    seed,
    score: s.score,
    standTimePct: durationS > 0 ? (100 * substantialS) / durationS : 0,
    rotations: trace.features.revolutions,
    flipCount: trace.features.flipCount,
    reachedEnd: report.terminus.reason === "endOfSpec",
    offBeat: report.off_beat_landings.length,
    contractPassed: s.contract_passed,
    durationFrames: trace.durationFrames,
  };
}

/** The per-song qualification floors a seed must clear to become a render. */
export type Floors = {
  /** Require endOfSpec survival. Set false to allow dead tracks (rarely useful). */
  reachedEnd: boolean;
  /** Max tolerated off-beat landings. */
  maxOffBeat: number;
  /** Absolute score floor (suggested = the distribution's median). */
  score: number;
  /** Minimum substantial stand-time as a % of duration (suggested = p25). */
  standTimePctMin: number;
  /** Minimum airborne revolutions (suggested 0 unless you want spinny tracks). */
  rotationsMin: number;
};

/** The production gate — pure. A seed qualifies (and only then is it worth
 *  rendering) iff it clears every floor. */
export function passesGate(m: SeedMetrics, f: Floors): boolean {
  if (f.reachedEnd && !m.reachedEnd) return false;
  if (m.offBeat > f.maxOffBeat) return false;
  if (m.score < f.score) return false;
  if (m.standTimePct < f.standTimePctMin) return false;
  if (m.rotations < f.rotationsMin) return false;
  return true;
}
