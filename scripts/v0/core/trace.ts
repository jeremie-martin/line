/**
 * Stage-0 trace emitter — re-simulate the FINAL winning track once and emit a
 * per-frame record of what the rider actually did (position, velocity, contact,
 * and crucially body pose / rotation), plus a small, neutral feature vocabulary.
 *
 * This is the compiler's OBSERVATION layer. It never defines, scores, or
 * branches on "coolness" — it exposes ground truth so a separate, external
 * consumer can. The score objective is untouched, and this runs off the search
 * hot path over the single final track, so it respects the minimal-simulation
 * rule.
 *
 * The winning search engine is not retained (the registry stores only the
 * serialized track), so we reconstruct a fresh engine from the track JSON —
 * deterministic, same engine binding ⇒ bit-identical to what the search saw —
 * exactly as study_rotation.ts does. Two cheap passes over one engine:
 * `extractRawTrajectory` integrates frames 0..duration; the pose loop re-reads
 * those now-cached frames (charges ~0 physics).
 */
import { LineRiderEngine, createLineFromJson } from "../../lib/_lr_engine.ts";
import { detect, extractRawTrajectory, sledPoseDegFromRider } from "../../lib/detector.ts";
import { computeRotationTrace, type RotationArc } from "../../lib/rotation.ts";
import type { TrackJson } from "../../lib/primitive.ts";
import { FPS } from "../types.ts";

/** Opt-in, default OFF. When unset, run.ts / trace tooling emit nothing and the
 *  compile + benchmark path is byte-identical. Read once at import. */
export const TRACE_EMIT: boolean =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_EMIT_TRACE === "1";

export type TraceFrame = {
  frame: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  speed: number;
  /** TAIL→NOSE body angle (deg, +down). null when unreadable. The spin signal. */
  sledPoseDeg: number | null;
  /** CoM travel heading (deg) from velocity. Its divergence from sledPoseDeg is spin. */
  comHeadingDeg: number;
  airborne: boolean;
  contactLineIds: number[];
};

/** A small, NEUTRAL vocabulary of physical observations — not aesthetic
 *  judgments. External consumers turn these into "coolness". */
export type TraceFeatures = {
  /** Whole-track signed net body rotation (deg). */
  netRotationDeg: number;
  /** Airborne angular travel (deg, counts back-and-forth). */
  totalBodyRotationDeg: number;
  /** totalBodyRotationDeg / 360. */
  revolutions: number;
  /** Airborne arcs with |net rotation| > 180°. */
  flipCount: number;
  peakAngularSpeedDegPerFrame: number;
  airborneArcs: number;
  totalAirtimeFrames: number;
  /** Highest point reached (screen +y is down ⇒ this is the min y). */
  peakHeightPx: number;
  maxSpeed: number;
};

export type Trace = {
  schemaVersion: 1;
  /** terminus.frame — last simulated frame (frames has length durationFrames + 1). */
  durationFrames: number;
  fps: number;
  frames: TraceFrame[];
  features: TraceFeatures;
  /** Per-airborne-arc rotation breakdown (same reduction that produced features). */
  arcs: RotationArc[];
};

/** Reconstruct the engine from `track`, re-simulate it once, and produce the trace. */
export function extractTrace(track: TrackJson): Trace {
  // deno-lint-ignore no-explicit-any
  let engine: any = new LineRiderEngine().setStart(
    track.startPosition,
    track.riders[0].startVelocity,
  );
  for (const line of track.lines) engine = engine.addLine(createLineFromJson(line));

  // Pass 1: full detection (position / velocity / speed / airborne / contacts).
  const det = detect(extractRawTrajectory(engine, track.duration));
  const m = det.measurements;
  const F = det.terminus.frame;

  // Pass 2: per-frame body pose from the (now cached) rider points.
  const rawPoseDeg: (number | null)[] = [];
  for (let f = 0; f <= F; f++) rawPoseDeg.push(sledPoseDegFromRider(engine.getRider(f)));

  const rot = computeRotationTrace(rawPoseDeg, m.airborne.slice(0, F + 1));

  const frames: TraceFrame[] = [];
  let peakHeightPx = Infinity; // min y (screen +y is down)
  let maxSpeed = 0;
  let totalAirtimeFrames = 0;
  for (let f = 0; f <= F; f++) {
    const p = m.position[f];
    const v = m.velocity[f];
    const airborne = m.airborne[f];
    if (p.y < peakHeightPx) peakHeightPx = p.y;
    if (m.speed[f] > maxSpeed) maxSpeed = m.speed[f];
    if (airborne) totalAirtimeFrames++;
    frames.push({
      frame: f,
      position: { x: p.x, y: p.y },
      velocity: { x: v.x, y: v.y },
      speed: m.speed[f],
      sledPoseDeg: rawPoseDeg[f],
      comHeadingDeg: (Math.atan2(v.y, v.x) * 180) / Math.PI,
      airborne,
      contactLineIds: m.contactLineIds[f],
    });
  }

  return {
    schemaVersion: 1,
    durationFrames: F,
    fps: FPS,
    frames,
    features: {
      netRotationDeg: rot.netRotationDeg,
      totalBodyRotationDeg: rot.totalAbsRotationDeg,
      revolutions: rot.revolutions,
      flipCount: rot.flipCount,
      peakAngularSpeedDegPerFrame: rot.peakAngularSpeedDegPerFrame,
      airborneArcs: rot.arcs.length,
      totalAirtimeFrames,
      peakHeightPx: Number.isFinite(peakHeightPx) ? peakHeightPx : 0,
      maxSpeed,
    },
    arcs: rot.arcs,
  };
}
