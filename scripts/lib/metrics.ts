/**
 * Track quality metrics.
 *
 * Two families:
 *
 *   1. Geometric metrics — computed from the TrackJson alone (no simulation).
 *      These describe what the track *looks like* statically: angle variance,
 *      vertical extent, screen spread, feature-type entropy.
 *
 *   2. Behavioral metrics — computed from a Detection (post-simulation).
 *      These describe what *happens* when the rider runs the track: event
 *      rate, trajectory vertical extent, survival.
 *
 * The two are deliberately separated so a metric's truth value can be
 * traced to a clearly-defined input (track JSON vs. rider behavior).
 *
 * `coolScore` is a weighted sum over a chosen subset. Survival is a hard
 * gate: a track where the rider dies early gets coolScore = 0, regardless
 * of how pretty the geometry looks — a track no one rides is not cool.
 *
 * Weights are tunable (eval/METRICS.md documents them). The metric
 * definitions themselves must be *validated* against a labeled reference
 * set (tests/metrics_validation.test.ts) — if a weight assignment can't
 * separate cool from bland on the reference set, the metric definitions
 * are wrong and need redesign, not the weights.
 */
import { detect, extractRawTrajectory, type Detection } from "./detector.ts";
import { type TrackJson, type TrackLine } from "./primitive.ts";

import { LineRiderEngine, createLineFromJson } from "./_lr_engine.ts";

// ────────── Geometric metrics ──────────

export type GeometricMetrics = {
  lineCount: number;
  totalLengthPx: number;
  /** Length-weighted stddev of segment angles (degrees). */
  angleStdDeg: number;
  /** Shannon entropy of a 12-bin angle histogram, length-weighted. Bits. */
  angleEntropyBits: number;
  /** max(y) - min(y) over all line endpoints. */
  verticalExtentPx: number;
  /** max(x) - min(x) over all line endpoints. */
  horizontalExtentPx: number;
  /** verticalExtentPx / max(horizontalExtentPx, 1). */
  verticalRatio: number;
  /** verticalExtentPx * horizontalExtentPx (rough screen area). */
  boundingAreaPx2: number;
  /** boundingAreaPx2 / max(totalLengthPx, 1). "How much of the screen does the geometry actually cover, vs. piling lines on top of each other." */
  spreadEfficiency: number;
};

export function geometricMetrics(track: TrackJson): GeometricMetrics {
  const lines = track.lines;
  const lineCount = lines.length;
  if (lineCount === 0) {
    return {
      lineCount: 0,
      totalLengthPx: 0,
      angleStdDeg: 0,
      angleEntropyBits: 0,
      verticalExtentPx: 0,
      horizontalExtentPx: 0,
      verticalRatio: 0,
      boundingAreaPx2: 0,
      spreadEfficiency: 0,
    };
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let totalLength = 0;
  // For length-weighted stats:
  const angles: number[] = [];
  const lengths: number[] = [];

  for (const l of lines) {
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const len = Math.hypot(dx, dy);
    totalLength += len;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180
    angles.push(angle);
    lengths.push(len);
    if (l.x1 < minX) minX = l.x1; if (l.x2 < minX) minX = l.x2;
    if (l.x1 > maxX) maxX = l.x1; if (l.x2 > maxX) maxX = l.x2;
    if (l.y1 < minY) minY = l.y1; if (l.y2 < minY) minY = l.y2;
    if (l.y1 > maxY) maxY = l.y1; if (l.y2 > maxY) maxY = l.y2;
  }

  // Length-weighted mean and stddev of angle.
  const totLen = totalLength > 0 ? totalLength : 1;
  let meanAngle = 0;
  for (let i = 0; i < angles.length; i++) meanAngle += angles[i] * lengths[i];
  meanAngle /= totLen;
  let varAngle = 0;
  for (let i = 0; i < angles.length; i++) {
    const d = angles[i] - meanAngle;
    varAngle += d * d * lengths[i];
  }
  varAngle /= totLen;
  const angleStdDeg = Math.sqrt(varAngle);

  // Length-weighted 12-bin histogram entropy over [-180, 180).
  // Bin width 30°. Bland (one direction) → low entropy; varied → high.
  const BINS = 12;
  const binWidth = 360 / BINS;
  const binWeights = new Array<number>(BINS).fill(0);
  for (let i = 0; i < angles.length; i++) {
    let a = angles[i];
    if (a < -180) a += 360; else if (a >= 180) a -= 360;
    const bin = Math.min(BINS - 1, Math.max(0, Math.floor((a + 180) / binWidth)));
    binWeights[bin] += lengths[i];
  }
  let angleEntropyBits = 0;
  for (const w of binWeights) {
    if (w <= 0) continue;
    const p = w / totLen;
    angleEntropyBits -= p * Math.log2(p);
  }

  const verticalExtentPx = maxY - minY;
  const horizontalExtentPx = maxX - minX;
  const boundingAreaPx2 = verticalExtentPx * horizontalExtentPx;
  const verticalRatio = verticalExtentPx / Math.max(horizontalExtentPx, 1);
  const spreadEfficiency = boundingAreaPx2 / Math.max(totalLength, 1);

  return {
    lineCount,
    totalLengthPx: totalLength,
    angleStdDeg,
    angleEntropyBits,
    verticalExtentPx,
    horizontalExtentPx,
    verticalRatio,
    boundingAreaPx2,
    spreadEfficiency,
  };
}

// ────────── Behavioral metrics ──────────

export type BehavioralMetrics = {
  survived: boolean;
  liveFrames: number;
  specFrames: number;
  liveFraction: number;
  /** All discrete detector events (landing + bounce + kick) per second. */
  eventRatePerSec: number;
  /** Shannon entropy of {landing, bounce, kick} event-type mix. Bits. */
  eventTypeEntropyBits: number;
  /** max(y) - min(y) of rider center position over CONTACT frames only.
   *  Computed over contact frames so a rider in free-fall (rider fell off
   *  the end of the track) doesn't pad it with gravity. If no contact
   *  frames, returns 0. */
  trajectoryVerticalPx: number;
  /** Count of vy sign flips during CONTACT phase only. Free-fall has no flips
   *  (monotone vy increase) so we'd miss nothing meaningful by skipping it. */
  vySignFlips: number;
  /** Fraction of live frames in sled contact (summary.contactFractionLive). */
  contactFractionLive: number;
  meanSpeedSliding: number;
  /** Mean vx during contact frames (from summary.meanVxSliding). Negative
   *  if rider is on average moving leftward. Low absolute values = stuck. */
  meanVxSliding: number;
  /** Fraction of contact frames where |vx| < SLOW_SLIDE_THRESHOLD (1.5 px/f).
   *  A rider stuck oscillating in a pit will have this near 1.0 — the
   *  individual frame velocities are tiny, even if bounces and vy flips
   *  superficially look "varied". */
  slowSlideFraction: number;
  longestContactRun: number;
  longestAirborneRun: number;
};

/** Threshold for "this rider is barely moving" in px/frame. */
const SLOW_SLIDE_THRESHOLD = 1.5;

/** Build an lr-core engine from a track JSON and simulate to its duration. */
export function simulateTrack(track: TrackJson): Detection {
  // deno-lint-ignore no-explicit-any
  let engine: any = new LineRiderEngine();
  for (const line of track.lines) {
    engine = engine.addLine(createLineFromJson(line));
  }
  const duration = track.duration ?? 1200;
  const raw = extractRawTrajectory(engine, duration);
  return detect(raw);
}

export function behavioralMetrics(det: Detection): BehavioralMetrics {
  const survived = det.terminus.reason === "endOfSpec";
  const liveFrames = det.summary.liveFrames;
  const specFrames = det.summary.specFrames;
  const liveSec = Math.max(liveFrames / 40, 1e-6);

  // Event counts by type.
  let nLanding = 0, nBounce = 0, nKick = 0;
  for (const e of det.events) {
    if (e.type === "landing") nLanding++;
    else if (e.type === "bounce") nBounce++;
    else if (e.type === "kick") nKick++;
  }
  const totalEvents = nLanding + nBounce + nKick;
  const eventRatePerSec = totalEvents / liveSec;

  // Type entropy (3 bins).
  let eventTypeEntropyBits = 0;
  if (totalEvents > 0) {
    for (const c of [nLanding, nBounce, nKick]) {
      if (c === 0) continue;
      const p = c / totalEvents;
      eventTypeEntropyBits -= p * Math.log2(p);
    }
  }

  // Trajectory vertical extent over CONTACT frames only — so a free-falling
  // rider doesn't get credit for traversing kilometers of void.
  const positions = det.measurements.position;
  const airborne = det.measurements.airborne;
  const velocity = det.measurements.velocity;
  let trajMinY = Infinity, trajMaxY = -Infinity;
  // vy sign flips during contact.
  const VY_EPS = 0.2;
  let lastSign = 0;
  let vySignFlips = 0;
  // Slow-slide fraction: count contact frames with low |vx|.
  let slowSlideFrames = 0;
  let contactFrames = 0;
  for (let f = 0; f <= det.terminus.frame && f < positions.length; f++) {
    if (airborne[f]) continue;
    contactFrames++;
    const y = positions[f].y;
    if (y < trajMinY) trajMinY = y;
    if (y > trajMaxY) trajMaxY = y;
    if (Math.abs(velocity[f].x) < SLOW_SLIDE_THRESHOLD) slowSlideFrames++;
    const vy = velocity[f].y;
    if (Math.abs(vy) < VY_EPS) continue;
    const s = vy > 0 ? 1 : -1;
    if (lastSign !== 0 && s !== lastSign) vySignFlips++;
    lastSign = s;
  }
  const trajectoryVerticalPx = (trajMaxY === -Infinity) ? 0 : (trajMaxY - trajMinY);
  const slowSlideFraction = contactFrames > 0 ? slowSlideFrames / contactFrames : 0;

  return {
    survived,
    liveFrames,
    specFrames,
    liveFraction: specFrames > 0 ? liveFrames / specFrames : 0,
    eventRatePerSec,
    eventTypeEntropyBits,
    trajectoryVerticalPx,
    vySignFlips,
    contactFractionLive: det.summary.contactFractionLive,
    meanSpeedSliding: det.summary.meanSpeedSliding,
    meanVxSliding: det.summary.meanVxSliding,
    slowSlideFraction,
    longestContactRun: det.summary.longestContactRun,
    longestAirborneRun: det.summary.longestAirborneRun,
  };
}

// ────────── Cool score ──────────

export type CoolScoreInputs = GeometricMetrics & BehavioralMetrics;

export type CoolWeights = {
  angleStdDeg: number;
  angleEntropyBits: number;
  verticalExtentPx: number;
  spreadEfficiency: number;
  eventRatePerSec: number;
  eventTypeEntropyBits: number;
  trajectoryVerticalPx: number;
  vySignFlips: number;
};

/**
 * Default weights. Calibrated against the reference set in
 * tests/metrics_validation.test.ts to separate cool from bland with
 * margin > 20%.
 *
 * Design principle behind the weight choices:
 *
 *   - Heavy weight on metrics that directly measure variety/diversity:
 *     angleStdDeg, angleEntropyBits, vySignFlips, eventTypeEntropyBits.
 *     These are the actual discriminators. A bland track loses badly here.
 *
 *   - Light weight on size-based metrics: spreadEfficiency,
 *     trajectoryVerticalPx, verticalExtentPx. These scale with how big
 *     the track is, not how cool — a large bland track would falsely
 *     score high if these dominated.
 *
 *   - Moderate weight on eventRatePerSec — events-per-second is partly
 *     bland-vs-cool but partly just "how busy is the geometry."
 *
 * Changing any weight invalidates the validation calibration. Re-run
 * `npm run test -- metrics_validation` to confirm separation still holds.
 */
export const DEFAULT_COOL_WEIGHTS: CoolWeights = {
  angleStdDeg: 30,           // primary discriminator: human ~25° → 750 pts; bland ~5° → 150 pts
  angleEntropyBits: 200,     // primary discriminator: human ~1.9 bits → 380 pts; bland ~0.1 → 20 pts
  verticalExtentPx: 0.2,     // size-based — light weight
  spreadEfficiency: 0.1,     // size-based — light weight
  eventRatePerSec: 30,       // moderate
  eventTypeEntropyBits: 100, // primary discriminator: human ~1.4 bits → 140 pts; bland near 0
  trajectoryVerticalPx: 0.1, // size-based — light weight
  vySignFlips: 50,           // primary discriminator: human 20 → 1000 pts; bland 0
};

/** Minimum contact fraction to qualify as a "ride" (not a free-fall). */
const CONTACT_FLOOR = 0.15;
/** Max fraction of contact frames the rider may spend at sub-threshold vx
 *  before we declare "stuck in a pit / not actually moving forward". */
const SLOW_SLIDE_CEILING = 0.5;

/**
 * Cool score. Three hard gates:
 *
 *   1. survived — terminus must be endOfSpec (rider didn't eject / die).
 *   2. contactFractionLive ≥ 0.15 — rider must actually be ON the track
 *      for at least 15% of its live frames. Otherwise the rider fell off
 *      the end of the geometry and was in free-fall, which trivially
 *      maximizes trajectoryVerticalPx — not cool, just falling.
 *   3. slowSlideFraction ≤ 0.5 — rider must spend at most half of its
 *      contact frames at |vx| < 1.5 px/f. A rider stuck oscillating in a
 *      local minimum has slowSlideFraction near 1.0; the oscillations
 *      can produce many bounce events and vy flips that would otherwise
 *      inflate cool. The aerial-template case (drums_60_125.aerial,
 *      meanVxSliding=0.35) is the canonical example.
 *
 * If any gate fails, returns 0.
 *
 * The score itself has no upper bound and can be negative if weights are
 * negative. It's only meaningful in *relative* comparisons (cool > bland
 * on a fixed weight set).
 */
export function coolScore(inputs: CoolScoreInputs, weights: CoolWeights = DEFAULT_COOL_WEIGHTS): number {
  if (!inputs.survived) return 0;
  if (inputs.contactFractionLive < CONTACT_FLOOR) return 0;
  if (inputs.slowSlideFraction > SLOW_SLIDE_CEILING) return 0;
  return (
    inputs.angleStdDeg * weights.angleStdDeg +
    inputs.angleEntropyBits * weights.angleEntropyBits +
    inputs.verticalExtentPx * weights.verticalExtentPx +
    inputs.spreadEfficiency * weights.spreadEfficiency +
    inputs.eventRatePerSec * weights.eventRatePerSec +
    inputs.eventTypeEntropyBits * weights.eventTypeEntropyBits +
    inputs.trajectoryVerticalPx * weights.trajectoryVerticalPx +
    inputs.vySignFlips * weights.vySignFlips
  );
}

/** Convenience: full pipeline from a TrackJson. */
export type FullMetrics = {
  geom: GeometricMetrics;
  behav: BehavioralMetrics;
  cool: number;
};

export function evaluateTrack(track: TrackJson, weights: CoolWeights = DEFAULT_COOL_WEIGHTS): FullMetrics {
  const geom = geometricMetrics(track);
  const det = simulateTrack(track);
  const behav = behavioralMetrics(det);
  const cool = coolScore({ ...geom, ...behav }, weights);
  return { geom, behav, cool };
}

// ────────── Music-spec metrics (only meaningful for beat-driven tracks) ──────────
//
// These are NOT part of coolScore — a track can be cool without any music.
// They're reported alongside coolScore in bench_music.ts so we can see
// whether a generation strategy achieves both cool *and* beat-aligned.

export type MusicMetrics = {
  beatCount: number;
  /** Detected events / beatCount. Uses landings + bounces (kicks excluded). */
  eventCoveragePct: number;
  /** Fraction of beats with at least one landing OR bounce within ±tolFrames. */
  onBeatAdherencePct: number;
  /** Mean absolute offset (frames). Landings + bounces. */
  meanBeatOffsetFrames: number;
  medianBeatOffsetFrames: number;
  p90BeatOffsetFrames: number;
  maxBeatOffsetFrames: number;
  /** On-beat percentage at ±1, ±2, ±5, ±10 frames (landings + bounces). */
  onBeat1: number;
  onBeat2: number;
  onBeat5: number;
  onBeat10: number;
  /** Per-beat offset array (frames). Negative = event before beat, positive = after.
   *  Null if no matching event within ±MATCH_WINDOW_FRAMES. */
  perBeatSignedOffsets: Array<number | null>;
  /** Per-beat matched event type (or null if unmatched). */
  perBeatMatchedType: Array<"landing" | "bounce" | null>;

  // ── LANDINGS-ONLY breakdown ──
  // Landings are the visual punctuation of a Line Rider track — the
  // distinct impact moments. Kicks (angle changes mid-slide) and bounces
  // (incidental brief airbornes) don't visually correspond to beats the
  // same way. We report landings-only stats next to the combined stats so
  // sync quality can be measured strictly.
  landingOnBeat1: number;
  landingOnBeat2: number;
  landingOnBeat5: number;
  landingMedianOffsetFrames: number;
  landingMeanOffsetFrames: number;
  /** Fraction of beats matched by a landing (vs only a bounce or unmatched). */
  landingMatchFraction: number;
};

/** A beat is "matched" only if an event exists within `matchWindow` frames.
 *  Beats with no nearby event count as "missed" rather than padding offset stats. */
const MATCH_WINDOW_FRAMES = 20;

export function musicMetrics(
  det: Detection,
  beatFramesSorted: number[],
  tolFrames = 2,
): MusicMetrics {
  const beatCount = beatFramesSorted.length;
  if (beatCount === 0) {
    return {
      beatCount: 0, eventCoveragePct: 0, onBeatAdherencePct: 0,
      meanBeatOffsetFrames: 0, medianBeatOffsetFrames: 0,
      p90BeatOffsetFrames: 0, maxBeatOffsetFrames: 0,
      onBeat1: 0, onBeat2: 0, onBeat5: 0, onBeat10: 0,
      perBeatSignedOffsets: [], perBeatMatchedType: [],
      landingOnBeat1: 0, landingOnBeat2: 0, landingOnBeat5: 0,
      landingMedianOffsetFrames: 0, landingMeanOffsetFrames: 0,
      landingMatchFraction: 0,
    };
  }
  // Collect landings and bounces separately. Kicks are deliberately
  // ignored — they fire on angle changes mid-slide and don't visually
  // correspond to musical beats.
  const landingFrames: number[] = [];
  const bounceFrames: number[] = [];
  for (const e of det.events) {
    if (e.type === "landing") landingFrames.push(e.frame);
    else if (e.type === "bounce") bounceFrames.push(e.frame);
  }
  landingFrames.sort((a, b) => a - b);
  bounceFrames.sort((a, b) => a - b);

  // Per-beat: prefer landing within window, fall back to bounce.
  const signedOffsets: Array<number | null> = [];
  const matchedType: Array<"landing" | "bounce" | null> = [];
  const landingSignedOffsets: Array<number | null> = [];

  function nearest(frames: number[], beat: number): { signed: number | null } {
    let best = Infinity, bestSigned: number | null = null;
    for (const f of frames) {
      const d = Math.abs(f - beat);
      if (d < best) { best = d; bestSigned = f - beat; }
      if (f - beat > best) break;
    }
    if (best > MATCH_WINDOW_FRAMES) return { signed: null };
    return { signed: bestSigned };
  }

  for (const bf of beatFramesSorted) {
    const land = nearest(landingFrames, bf);
    if (land.signed !== null) {
      signedOffsets.push(land.signed);
      matchedType.push("landing");
      landingSignedOffsets.push(land.signed);
    } else {
      const bnc = nearest(bounceFrames, bf);
      signedOffsets.push(bnc.signed);
      matchedType.push(bnc.signed !== null ? "bounce" : null);
      landingSignedOffsets.push(null);
    }
  }

  const absMatched = signedOffsets.filter((x): x is number => x !== null).map(Math.abs);
  const sorted = [...absMatched].sort((a, b) => a - b);
  const percentile = (xs: number[], p: number) => xs.length === 0 ? 0 : xs[Math.min(xs.length - 1, Math.floor(p * xs.length))];
  const countWithin = (tol: number) => signedOffsets.filter((x) => x !== null && Math.abs(x) <= tol).length;

  const landingAbs = landingSignedOffsets.filter((x): x is number => x !== null).map(Math.abs);
  const landingSorted = [...landingAbs].sort((a, b) => a - b);
  const landingCountWithin = (tol: number) => landingSignedOffsets.filter((x) => x !== null && Math.abs(x) <= tol).length;

  return {
    beatCount,
    eventCoveragePct: ((landingFrames.length + bounceFrames.length) / beatCount) * 100,
    onBeatAdherencePct: (countWithin(tolFrames) / beatCount) * 100,
    meanBeatOffsetFrames: absMatched.length > 0 ? absMatched.reduce((s, x) => s + x, 0) / absMatched.length : 0,
    medianBeatOffsetFrames: percentile(sorted, 0.5),
    p90BeatOffsetFrames: percentile(sorted, 0.9),
    maxBeatOffsetFrames: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
    onBeat1: (countWithin(1) / beatCount) * 100,
    onBeat2: (countWithin(2) / beatCount) * 100,
    onBeat5: (countWithin(5) / beatCount) * 100,
    onBeat10: (countWithin(10) / beatCount) * 100,
    perBeatSignedOffsets: signedOffsets,
    perBeatMatchedType: matchedType,
    landingOnBeat1: (landingCountWithin(1) / beatCount) * 100,
    landingOnBeat2: (landingCountWithin(2) / beatCount) * 100,
    landingOnBeat5: (landingCountWithin(5) / beatCount) * 100,
    landingMedianOffsetFrames: percentile(landingSorted, 0.5),
    landingMeanOffsetFrames: landingAbs.length > 0 ? landingAbs.reduce((s, x) => s + x, 0) / landingAbs.length : 0,
    landingMatchFraction: landingAbs.length / beatCount,
  };
}
