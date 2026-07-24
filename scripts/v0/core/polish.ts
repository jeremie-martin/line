/**
 * v0 polish core — the post-compile geometry-refinement subsystem used by the
 * handoff optimizer.
 *
 * It owns the four air/contact entry helpers, their private sub-polishers, the
 * engine rebuild used by polish + final DriftReport simulation, and the
 * module-scoped start state those rebuilds read. These functions depend only on
 * `../../lib/*`, `../arc.ts`, `../types.ts`, and the core siblings
 * `./substrate.ts` / `./candidate.ts`.
 *
 * `isDenseContactSequence` is a tiny pure predicate kept private here.
 *
 * Engine-rebuild accounting: `rebuildEngine` bumps a module-local counter
 * instead of touching compile stats directly. Compiler entry points fold
 * `getEngineRebuildCount()` into `stats.engine_rebuilds` at the end of a run.
 */

import {
  detect, extractRawTrajectory, getRiderMetered,
  K_BOUNCE_LANDING, PERSISTENCE_FRAMES,
  type Detection,
} from "../../lib/detector.ts";
import { makeSolidLine } from "../arc.ts";
import {
  type Spec, type AxisName,
  type TrackLine, type Gap,
  AXES, CALIB, FPS, FRAME_SPAN_AXES, secToFrame,
} from "../types.ts";
import {
  type ResolvedStart,
  type GapFit,
  axesAtFrame,
  median,
  makeBaseEngine,
  measureAxisOverRange,
  engineLineFromTrackLine,
  findGapOwning,
  isAuthoredContactEvent,
  velocityAt,
} from "./substrate.ts";
import { measureGrainFromLines } from "./measure.ts";
import {
  makeAirPolishCandidates,
} from "./candidate.ts";
import { registerCompileReset } from "./compile_lifecycle.ts";

// deno-lint-ignore no-explicit-any
export type PolishRebuildEngine = (fits: (GapFit | null)[], upTo: number) => any;

// Grain reduction for a fit: median catch-line length / LINE_LENGTH_CAP.
// Delegates to the single-source-of-truth geometry reduction; an empty gap yields 0 here,
// matching the former local `measureFitGrain` copy.
function measureFitGrain(fit: GapFit): number {
  return measureGrainFromLines(fit.lines) ?? 0;
}

// Extra frames simulated past the spec's nominal end so the detector sees the
// full rideout tail / clean terminus + landing when scoring a freshly-rebuilt track.
const POLISH_SIM_TAIL_FRAMES = 20;
const AIR_POLISH_PASSES = 3;
const DENSE_AIR_POLISH_PASSES = 2;
const DENSE_AIR_POLISH_SOURCE_LIMIT = 8;
const AIR_POLISH_SOURCE_ENTRY_LINES = 1;
const AIR_POLISH_SOURCE_TAIL_LINES = 3;
const AIR_CONTACT_EXTENSION_LENGTH_PX = 25;
const AIR_BRIEF_CONTACT_PASSES = 3;
const AIR_BRIEF_CONTACT_LENGTH = 8;
const AIR_BRIEF_CONTACT_FRAME_OFFSET = K_BOUNCE_LANDING + PERSISTENCE_FRAMES - 1;
const AIR_BRIEF_CONTACT_LANDING_MARGIN = PERSISTENCE_FRAMES + 1;
const CONTACT_TRIM_PASSES = 2;
// Exit-contact trim uses a two-point best-of probe: an aggressive cut to break
// sticky exit contact and a conservative cut that keeps most of the line shape.
const CONTACT_EXIT_TRIM_KEEP_FRACTIONS = [0.25, 0.8] as const;
const CONTACT_EDGE_TRIM_PASSES = 2;
// Entry-edge trim always anchors on the first line in a contact range, then
// probes both endpoints of that same line. These are not duplicate entries:
// `start` shortens from the entry endpoint, while `end` shortens the exit side.
const CONTACT_ENTRY_EDGE_TRIM_PROBES = [
  { side: "start", fraction: 0.85 },
  { side: "end", fraction: 0.9 },
] as const;
// A contact range must persist at least this many frames before its edge lines
// are worth trimming; below it the contact is too brief to reshape. Tracks the
// detector's persistence length (PERSISTENCE_FRAMES === 5) — same bound used by
// briefSingleLineContactEntryIds above.
const CONTACT_EDGE_TRIM_MIN_FRAMES = PERSISTENCE_FRAMES;
const GRAIN_LENGTH_PASSES = 1;
const GRAIN_LENGTH_EXTRAS = [1, 2] as const;
const ENTRY_LENGTH_PASSES = 3;
const SPEED_POLISH_Y_SHIFT_PX = -1;
const SPEED_POLISH_FINE_X_SHIFT_PX = 0.5;
const SPEED_POLISH_X_PASS_SHIFTS_PX = [4, 1, SPEED_POLISH_FINE_X_SHIFT_PX] as const;
const SPEED_POLISH_BOUNDARY_PASSES = 2;
const SPEED_POLISH_X_BOUNDARY_OVERSHOOT_FRACTION = 0.1;
const SPEED_POLISH_Y_BOUNDARY_INITIAL_FRACTION = 0.5;
const SPEED_POLISH_Y_BOUNDARY_STEP_DECAY = 0.5;
const SPEED_POLISH_ROTATION_DEG = -4;

export function polishAirRideOut(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  rebuildEngine: PolishRebuildEngine,
): void {
  if (!hasAirOnlyPolishTargets(spec)) return;

  let baseEngine = rebuildEngine(fits, gaps.length);
  const baseDet = detect(extractRawTrajectory(baseEngine, durationFrames + POLISH_SIM_TAIL_FRAMES));
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  let bestErr = meanAirError(baseDet, spec);
  const airResolution = meanAirFrameResolution(spec);
  if (bestErr <= airResolution || meanAirDelta(baseDet, spec) <= 0) return;

  const dense = isDenseContactSequence(contactFrames, durationFrames);
  const sources = dense
    ? denseAirPolishSources(baseDet, fits, DENSE_AIR_POLISH_SOURCE_LIMIT)
    : airPolishSources(fits);
  if (sources.length === 0) return;

  const usedSources = new Set<number>();
  let chainSource: AirPolishSource | null = null;
  const passes = dense ? DENSE_AIR_POLISH_PASSES : AIR_POLISH_PASSES;

  for (let pass = 0; pass < passes; pass++) {
    if (bestErr <= airResolution) break;
    const lineId = nextLineIdAt(fits, gaps.length);
    let best = chainSource === null
      ? null
      : bestAirPolishCandidate(
        baseEngine,
        [chainSource],
        usedSources,
        lineId,
        spec,
        durationFrames,
        contactFrames,
        bestErr,
      );

    if (best === null) {
      chainSource = null;
      best = bestAirPolishCandidate(
        baseEngine,
        sources,
        usedSources,
        lineId,
        spec,
        durationFrames,
        contactFrames,
        bestErr,
      );
    }

    if (best === null) break;
    fits[best.owner]!.lines.push(best.line);
    usedSources.add(best.sourceId);
    chainSource = { owner: best.owner, line: best.line };
    sources.push(chainSource);
    baseEngine = baseEngine.addLine(engineLineFromTrackLine(best.line));
    bestErr = best.err;
  }
}

type AirPolishSource = { owner: number; line: TrackLine };

type AirPolishCandidate = {
  owner: number;
  sourceId: number;
  line: TrackLine;
  err: number;
};

function bestAirPolishCandidate(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  sources: AirPolishSource[],
  usedSources: Set<number>,
  lineId: number,
  spec: Spec,
  durationFrames: number,
  contactFrames: number[],
  bestErr: number,
): AirPolishCandidate | null {
  let best: AirPolishCandidate | null = null;
  for (const source of sources) {
    if (usedSources.has(source.line.id)) continue;
    for (const cand of makeAirPolishCandidates(lineId, source.line)) {
      const eng = baseEngine.addLine(engineLineFromTrackLine(cand));
      const det = detect(extractRawTrajectory(eng, durationFrames + POLISH_SIM_TAIL_FRAMES));
      if (!passesFinalHardGates(det, contactFrames)) continue;
      const err = meanAirError(det, spec);
      if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
        best = { owner: source.owner, sourceId: source.line.id, line: cand, err };
      }
    }
  }
  return best;
}

function airPolishSources(fits: (GapFit | null)[]): AirPolishSource[] {
  const sources: AirPolishSource[] = [];
  for (let owner = 0; owner < fits.length; owner++) {
    const fit = fits[owner];
    if (fit === null) continue;
    // Non-dense ride-out keeps one entry anchor plus the recent tail geometry
    // that most often controls launch/settle. Dense specs use the air-duration
    // ranker below because every extra source is more expensive there.
    const lines = [
      ...fit.lines.slice(0, AIR_POLISH_SOURCE_ENTRY_LINES),
      ...fit.lines.slice(Math.max(0, fit.lines.length - AIR_POLISH_SOURCE_TAIL_LINES)),
    ];
    const seen = new Set<number>();
    for (const line of lines) {
      if (seen.has(line.id)) continue;
      seen.add(line.id);
      sources.push({ owner, line });
    }
  }
  return sources;
}

function denseAirPolishSources(
  det: Detection,
  fits: (GapFit | null)[],
  limit: number,
): AirPolishSource[] {
  const candidates: { lineId: number; airFrames: number }[] = [];
  let contactIds = new Set<number>();
  let pendingExitIds: Set<number> | null = null;
  let airStart: number | null = null;

  for (let frame = 0; frame < det.measurements.airborne.length; frame++) {
    const contact = !det.measurements.airborne[frame];
    if (contact) {
      if (airStart !== null && pendingExitIds !== null) {
        const lineId = [...pendingExitIds].sort((a, b) => a - b).at(-1);
        if (lineId !== undefined) {
          candidates.push({ lineId, airFrames: frame - airStart });
        }
      }
      airStart = null;
      pendingExitIds = null;
      for (const id of det.measurements.contactLineIds[frame] ?? []) {
        contactIds.add(id);
      }
      continue;
    }

    if (airStart === null && contactIds.size > 0) {
      pendingExitIds = contactIds;
      contactIds = new Set<number>();
      airStart = frame;
    }
  }

  if (airStart !== null && pendingExitIds !== null) {
    const lineId = [...pendingExitIds].sort((a, b) => a - b).at(-1);
    if (lineId !== undefined) {
      candidates.push({ lineId, airFrames: det.measurements.airborne.length - airStart });
    }
  }

  const sources: AirPolishSource[] = [];
  const seen = new Set<number>();
  for (const candidate of candidates.sort((a, b) => b.airFrames - a.airFrames)) {
    if (seen.has(candidate.lineId)) continue;
    const owner = findGapOwning(candidate.lineId, fits);
    if (owner < 0) continue;
    const line = fits[owner]!.lines.find((l) => l.id === candidate.lineId);
    if (line === undefined) continue;
    sources.push({ owner, line });
    seen.add(candidate.lineId);
    if (sources.length >= limit) break;
  }
  return sources;
}

/** True iff `axis` is targeted somewhere on the track (curve present + defined). */
function axisTargeted(spec: Spec, axis: AxisName): boolean {
  const curve = spec.axes?.[axis];
  if (curve === undefined) return false;
  const durationFrames = secToFrame(spec.duration);
  for (let f = 0; f <= durationFrames; f++) {
    if (curve(f / FPS) !== undefined) return true;
  }
  return false;
}

/**
 * Maximal frame intervals over which `axis` holds a single constant target
 * value (frames where the axis is undefined break an interval). For the ported
 * hold-keyframe specs these intervals ARE the original sections, so the
 * per-interval measurements below reproduce the old per-section behavior; for
 * genuinely continuous curves each interval is just finer.
 */
function axisTargetIntervals(spec: Spec, axis: AxisName): { f0: number; f1: number; v: number }[] {
  const durationFrames = secToFrame(spec.duration);
  const out: { f0: number; f1: number; v: number }[] = [];
  let cur: { f0: number; f1: number; v: number } | null = null;
  for (let f = 0; f <= durationFrames; f++) {
    const v = axesAtFrame(f, spec)[axis];
    if (v === undefined) {
      if (cur) { out.push(cur); cur = null; }
      continue;
    }
    if (cur && cur.v === v) cur.f1 = f;
    else { if (cur) out.push(cur); cur = { f0: f, f1: f, v }; }
  }
  if (cur) out.push(cur);
  return out;
}

// Air-only polishers optimize meanAirError directly. Mixed-axis specs use the
// section-axis scorer instead; enabling these air-only passes there changes the
// speed/grain/elevation tradeoff and needs a behavior trial.
function hasAirOnlyPolishTargets(spec: Spec): boolean {
  return axisTargeted(spec, "air") &&
    AXES.every((axis) => axis === "air" || !axisTargeted(spec, axis));
}

function passesFinalHardGates(det: Detection, contactFrames: number[]): boolean {
  if (det.terminus.reason !== "endOfSpec") return false;
  for (let contactIndex = 0; contactIndex < contactFrames.length; contactIndex++) {
    const cf = contactFrames[contactIndex];
    const previous = contactIndex === 0 ? 0 : contactFrames[contactIndex - 1];
    const hit = det.events.some(
      (e) => isAuthoredContactEvent(e, cf - previous) && Math.abs(e.frame - cf) <= 1,
    );
    if (!hit) return false;
  }
  return !det.events.some((e) =>
    e.type === "landing" && !contactFrames.some((cf) => Math.abs(cf - e.frame) <= 1)
  );
}

function meanAirError(det: Detection, spec: Spec): number {
  let total = 0;
  let n = 0;
  for (const iv of axisTargetIntervals(spec, "air")) {
    const achieved = measureAxisOverRange(det, iv.f0, iv.f1, "air");
    if (achieved === null) continue;
    total += Math.abs(iv.v - achieved);
    n++;
  }
  return n > 0 ? total / n : Infinity;
}

function meanAirDelta(det: Detection, spec: Spec): number {
  let total = 0;
  let n = 0;
  for (const iv of axisTargetIntervals(spec, "air")) {
    const achieved = measureAxisOverRange(det, iv.f0, iv.f1, "air");
    if (achieved === null) continue;
    total += achieved - iv.v;
    n++;
  }
  return n > 0 ? total / n : 0;
}

function meanSpeedDelta(det: Detection, spec: Spec): number {
  let total = 0;
  let n = 0;
  for (const iv of axisTargetIntervals(spec, "speed")) {
    const achieved = measureAxisOverRange(det, iv.f0, iv.f1, "speed");
    if (achieved === null) continue;
    total += achieved - iv.v;
    n++;
  }
  return n > 0 ? total / n : Infinity;
}

function meanAirFrameResolution(spec: Spec): number {
  let total = 0;
  let n = 0;
  for (const iv of axisTargetIntervals(spec, "air")) {
    const frames = iv.f1 - iv.f0 + 1;
    if (frames <= 0) continue;
    total += 1 / frames;
    n++;
  }
  return n > 0 ? total / n : 0;
}

export function polishAirContactEntry(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  rebuildEngine: PolishRebuildEngine,
): void {
  if (isDenseContactSequence(contactFrames, durationFrames)) return;
  if (!hasAirOnlyPolishTargets(spec)) return;

  const baseDet = simulateAndDetect(fits, gaps, durationFrames, rebuildEngine);
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  const bestErr = meanAirError(baseDet, spec);
  const airResolution = meanAirFrameResolution(spec);
  if (bestErr <= airResolution || meanAirDelta(baseDet, spec) <= airResolution) return;

  for (const lineId of contactEntryLineIds(baseDet).reverse()) {
    const owner = findGapOwning(lineId, fits);
    if (owner < 0) continue;
    const line = fits[owner]!.lines.find((l) => l.id === lineId);
    if (line === undefined) continue;

    const originalX1 = line.x1;
    const originalY1 = line.y1;
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const len = Math.hypot(dx, dy);
    if (len <= 0) continue;
    let best:
      | {
        x1: number;
        y1: number;
        err: number;
      }
      | null = null;

    line.x1 = originalX1 - (dx / len) * AIR_CONTACT_EXTENSION_LENGTH_PX;
    line.y1 = originalY1 - (dy / len) * AIR_CONTACT_EXTENSION_LENGTH_PX;
    const det = simulateAndDetect(fits, gaps, durationFrames, rebuildEngine);
    if (passesFinalHardGates(det, contactFrames)) {
      const err = meanAirError(det, spec);
      if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
        best = { x1: line.x1, y1: line.y1, err };
      }
    }
    line.x1 = originalX1;
    line.y1 = originalY1;

    if (best !== null) {
      line.x1 = best.x1;
      line.y1 = best.y1;
      return;
    }
  }
}

export function polishAirBriefContacts(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  rebuildEngine: PolishRebuildEngine,
): void {
  if (isDenseContactSequence(contactFrames, durationFrames)) return;
  if (!hasAirOnlyPolishTargets(spec)) return;

  let baseEngine = rebuildEngine(fits, gaps.length);
  let baseDet = detect(extractRawTrajectory(baseEngine, durationFrames + POLISH_SIM_TAIL_FRAMES));
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  let bestErr = meanAirError(baseDet, spec);
  const airResolution = meanAirFrameResolution(spec);
  if (bestErr <= airResolution || meanAirDelta(baseDet, spec) <= airResolution) return;

  for (let pass = 0; pass < AIR_BRIEF_CONTACT_PASSES; pass++) {
    if (bestErr <= airResolution) break;

    let accepted = false;
    for (const frame of airBriefContactFrames(baseDet, contactFrames, durationFrames)) {
      const rider = getRiderMetered(baseEngine, frame);
      const point = rider.get("PEG")?.pos;
      const velocity = rider.velocity ?? velocityAt(baseDet, frame);
      if (point === undefined || velocity === undefined) continue;

      const speed = Math.hypot(velocity.x, velocity.y);
      if (speed <= 0) continue;

      const owner = findGapForFrame(frame, gaps, fits);
      if (owner < 0) continue;

      const angle = Math.atan2(velocity.y, velocity.x);
      const dx = Math.cos(angle) * AIR_BRIEF_CONTACT_LENGTH / 2;
      const dy = Math.sin(angle) * AIR_BRIEF_CONTACT_LENGTH / 2;
      const line = makeSolidLine(
        nextLineIdAt(fits, gaps.length),
        point.x - dx,
        point.y - dy,
        point.x + dx,
        point.y + dy,
      );

      const candidateEngine = baseEngine.addLine(engineLineFromTrackLine(line));
      const det = detect(extractRawTrajectory(candidateEngine, durationFrames + POLISH_SIM_TAIL_FRAMES));
      if (!passesFinalHardGates(det, contactFrames)) continue;

      const err = meanAirError(det, spec);
      if (err + 1e-6 >= bestErr) continue;

      fits[owner]!.lines.push(line);
      baseEngine = candidateEngine;
      baseDet = det;
      bestErr = err;
      accepted = true;
      break;
    }

    if (!accepted) break;
  }
}

function airBriefContactFrames(
  det: Detection,
  contactFrames: number[],
  durationFrames: number,
): number[] {
  const frames: number[] = [];
  const firstContact = contactFrames[0] ?? 0;
  let start: number | null = null;

  for (let frame = 0; frame <= durationFrames && frame < det.measurements.airborne.length; frame++) {
    if (det.measurements.airborne[frame]) {
      if (start === null) start = frame;
      continue;
    }

    if (start !== null) {
      addBriefContactFrame(frames, start, frame - 1, firstContact);
      start = null;
    }
  }

  if (start !== null) {
    addBriefContactFrame(frames, start, durationFrames, firstContact);
  }

  return frames;
}

function addBriefContactFrame(
  out: number[],
  start: number,
  end: number,
  firstContact: number,
): void {
  if (start < firstContact) return;
  const frame = start + AIR_BRIEF_CONTACT_FRAME_OFFSET;
  if (frame <= end - AIR_BRIEF_CONTACT_LANDING_MARGIN) out.push(frame);
}

function findGapForFrame(
  frame: number,
  gaps: Gap[],
  fits: (GapFit | null)[],
): number {
  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    if (frame >= gap.startFrame && frame <= gap.endFrame && fits[i] !== null) return i;
  }
  for (let i = fits.length - 1; i >= 0; i--) {
    if (fits[i] !== null) return i;
  }
  return -1;
}

function scoreCurrentPolishGeometry(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  rebuildEngine: PolishRebuildEngine,
): { det: Detection; err: number } | null {
  const det = simulateAndDetect(fits, gaps, durationFrames, rebuildEngine);
  if (!passesFinalHardGates(det, contactFrames)) return null;
  return { det, err: meanSectionAxisError(det, spec, gaps, fits) };
}

export function polishExcessContact(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  rebuildEngine: PolishRebuildEngine,
): void {
  if (isDenseContactSequence(contactFrames, durationFrames)) return;
  if (!hasAirCompanionPolishTargets(spec)) return;

  let baseDet = simulateAndDetect(fits, gaps, durationFrames, rebuildEngine);
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  let bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);

  for (let pass = 0; pass < CONTACT_TRIM_PASSES; pass++) {
    let best:
      | {
        line: TrackLine;
        owner: number;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        err: number;
        det: Detection;
      }
      | null = null;

    for (const lineId of contactExitLineIds(baseDet)) {
      const owner = findGapOwning(lineId, fits);
      if (owner < 0) continue;
      const fit = fits[owner]!;
      const line = fit.lines.find((l) => l.id === lineId);
      if (line === undefined) continue;

      const originalX1 = line.x1;
      const originalY1 = line.y1;
      const originalX2 = line.x2;
      const originalY2 = line.y2;
      const dx = originalX2 - originalX1;
      const dy = originalY2 - originalY1;
      if (Math.hypot(dx, dy) <= 0) continue;

      for (const frac of CONTACT_EXIT_TRIM_KEEP_FRACTIONS) {
        for (const side of ["end", "start"] as const) {
          if (side === "end") {
            line.x2 = originalX1 + dx * frac;
            line.y2 = originalY1 + dy * frac;
          } else {
            line.x1 = originalX2 - dx * frac;
            line.y1 = originalY2 - dy * frac;
          }
          const scored = scoreCurrentPolishGeometry(
            fits, gaps, spec, contactFrames, durationFrames, rebuildEngine,
          );
          if (scored !== null) {
            if (scored.err + 1e-6 < bestErr && (best === null || scored.err < best.err)) {
              best = {
                line,
                owner,
                x1: line.x1,
                y1: line.y1,
                x2: line.x2,
                y2: line.y2,
                err: scored.err,
                det: scored.det,
              };
            }
          }
          line.x1 = originalX1;
          line.y1 = originalY1;
          line.x2 = originalX2;
          line.y2 = originalY2;
        }
      }

      line.x1 = originalX1;
      line.y1 = originalY1;
      line.x2 = originalX2;
      line.y2 = originalY2;
    }

    if (best === null) break;
    best.line.x1 = best.x1;
    best.line.y1 = best.y1;
    best.line.x2 = best.x2;
    best.line.y2 = best.y2;
    updateGeometryAxes(fits[best.owner]!);
    baseDet = best.det;
    bestErr = best.err;
  }

  polishContactEdges(
    fits, gaps, spec, contactFrames, durationFrames, baseDet, bestErr, rebuildEngine,
  );
  // Entry-speed runs twice by design: once after contact trimming, then again
  // after slope/length/median-grain edits that can move the entry line and
  // reintroduce speed error. Keep this as an explicit cascade rather than a
  // fixed-point loop; the sub-polishers mix best-of and accept-first semantics.
  polishGrainLength(fits, gaps, spec, contactFrames, durationFrames, rebuildEngine);
  polishEntrySpeed(fits, gaps, spec, contactFrames, durationFrames, rebuildEngine);
  polishEntrySlope(fits, gaps, spec, contactFrames, durationFrames, rebuildEngine);
  polishEntryLength(fits, gaps, spec, contactFrames, durationFrames, rebuildEngine);
  polishMedianGrainResidual(fits, gaps, spec, contactFrames, durationFrames, rebuildEngine);
  polishEntrySpeed(fits, gaps, spec, contactFrames, durationFrames, rebuildEngine);
  polishEntrySpeedX(fits, gaps, spec, contactFrames, durationFrames, rebuildEngine);
}

// Excess-contact polish handles the mixed air+speed/grain population that the
// air-only polishers intentionally skip. Other air+axis combinations remain
// unsupported rather than implicitly opting into an unverified pass.
function hasAirCompanionPolishTargets(spec: Spec): boolean {
  const hasAir = axisTargeted(spec, "air");
  const hasCompanionAxis = axisTargeted(spec, "speed") || axisTargeted(spec, "grain");
  return hasAir && hasCompanionAxis;
}

function polishContactEdges(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  initialDet: Detection,
  initialErr: number,
  rebuildEngine: PolishRebuildEngine,
): void {
  let baseDet = initialDet;
  let bestErr = initialErr;

  for (let pass = 0; pass < CONTACT_EDGE_TRIM_PASSES; pass++) {
    let best:
      | {
        line: TrackLine;
        owner: number;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        err: number;
        det: Detection;
      }
      | null = null;

    for (const candidate of contactEntryEdgeTrimCandidates(baseDet)) {
      const owner = findGapOwning(candidate.lineId, fits);
      if (owner < 0) continue;
      const fit = fits[owner]!;
      const line = fit.lines.find((l) => l.id === candidate.lineId);
      if (line === undefined) continue;

      const originalX1 = line.x1;
      const originalY1 = line.y1;
      const originalX2 = line.x2;
      const originalY2 = line.y2;
      const dx = originalX2 - originalX1;
      const dy = originalY2 - originalY1;
      if (Math.hypot(dx, dy) <= 0) continue;

      if (candidate.side === "end") {
        line.x2 = originalX1 + dx * candidate.fraction;
        line.y2 = originalY1 + dy * candidate.fraction;
      } else {
        line.x1 = originalX2 - dx * candidate.fraction;
        line.y1 = originalY2 - dy * candidate.fraction;
      }

      const scored = scoreCurrentPolishGeometry(
        fits, gaps, spec, contactFrames, durationFrames, rebuildEngine,
      );
      if (scored !== null) {
        if (scored.err + 1e-6 < bestErr && (best === null || scored.err < best.err)) {
          best = {
            line,
            owner,
            x1: line.x1,
            y1: line.y1,
            x2: line.x2,
            y2: line.y2,
            err: scored.err,
            det: scored.det,
          };
        }
      }

      line.x1 = originalX1;
      line.y1 = originalY1;
      line.x2 = originalX2;
      line.y2 = originalY2;
    }

    if (best === null) break;
    best.line.x1 = best.x1;
    best.line.y1 = best.y1;
    best.line.x2 = best.x2;
    best.line.y2 = best.y2;
    updateGeometryAxes(fits[best.owner]!);
    baseDet = best.det;
    bestErr = best.err;
  }
}

function polishEntrySpeedXBoundary(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  initialDet: Detection,
  initialErr: number,
  rebuildEngine: PolishRebuildEngine,
): void {
  if (isDenseContactSequence(contactFrames, durationFrames)) return;

  const coarseShift = Math.abs(SPEED_POLISH_FINE_X_SHIFT_PX);
  if (coarseShift <= 0) return;
  // X boundary refinement uses a single crossing nudge per pass. The +10%
  // overshoot makes the shift distinct from the preceding fine X pass while the
  // Y boundary below uses smaller halving steps to avoid vertical contact churn.
  const refinementStep = coarseShift * SPEED_POLISH_X_BOUNDARY_OVERSHOOT_FRACTION;

  let baseDet = initialDet;
  let bestErr = initialErr;

  for (let pass = 0; pass < SPEED_POLISH_BOUNDARY_PASSES; pass++) {
    const speedDelta = meanSpeedDelta(baseDet, spec);
    if (!Number.isFinite(speedDelta) || Math.abs(speedDelta) <= 1e-9) break;
    const direction = speedDelta > 0 ? 1 : -1;
    let best:
      | {
        line: TrackLine;
        x1: number;
        x2: number;
        err: number;
        det: Detection;
      }
      | null = null;

    for (const lineId of briefSingleLineContactEntryIds(baseDet).reverse()) {
      const owner = findGapOwning(lineId, fits);
      if (owner < 0) continue;
      const line = fits[owner]!.lines.find((l) => l.id === lineId);
      if (line === undefined) continue;

      const originalX1 = line.x1;
      const originalX2 = line.x2;

      const dx = direction * (coarseShift + refinementStep);
      line.x1 = originalX1 + dx;
      line.x2 = originalX2 + dx;
      const scored = scoreCurrentPolishGeometry(
        fits, gaps, spec, contactFrames, durationFrames, rebuildEngine,
      );
      if (scored !== null) {
        if (scored.err + 1e-6 < bestErr && (best === null || scored.err < best.err)) {
          best = { line, x1: line.x1, x2: line.x2, err: scored.err, det: scored.det };
        }
      }
      line.x1 = originalX1;
      line.x2 = originalX2;
    }

    if (best === null) break;
    best.line.x1 = best.x1;
    best.line.x2 = best.x2;
    baseDet = best.det;
    bestErr = best.err;
  }
}

function polishEntrySpeedYBoundary(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  initialDet: Detection,
  initialErr: number,
  rebuildEngine: PolishRebuildEngine,
): void {
  if (isDenseContactSequence(contactFrames, durationFrames)) return;

  const coarseShift = Math.abs(SPEED_POLISH_FINE_X_SHIFT_PX);
  if (coarseShift <= 0) return;

  let baseDet = initialDet;
  let bestErr = initialErr;
  let step = coarseShift * SPEED_POLISH_Y_BOUNDARY_INITIAL_FRACTION;

  for (
    let pass = 0;
    pass <= SPEED_POLISH_BOUNDARY_PASSES;
    pass++, step *= SPEED_POLISH_Y_BOUNDARY_STEP_DECAY
  ) {
    const speedDelta = meanSpeedDelta(baseDet, spec);
    if (!Number.isFinite(speedDelta) || Math.abs(speedDelta) <= 1e-9) break;
    const direction = speedDelta > 0 ? -1 : 1;
    let best:
      | {
        line: TrackLine;
        y1: number;
        y2: number;
        err: number;
        det: Detection;
      }
      | null = null;

    for (const lineId of briefSingleLineContactEntryIds(baseDet).reverse()) {
      const owner = findGapOwning(lineId, fits);
      if (owner < 0) continue;
      const line = fits[owner]!.lines.find((l) => l.id === lineId);
      if (line === undefined) continue;

      const originalY1 = line.y1;
      const originalY2 = line.y2;

      const dy = direction * step;
      line.y1 = originalY1 + dy;
      line.y2 = originalY2 + dy;
      const scored = scoreCurrentPolishGeometry(
        fits, gaps, spec, contactFrames, durationFrames, rebuildEngine,
      );
      if (scored !== null) {
        if (scored.err + 1e-6 < bestErr && (best === null || scored.err < best.err)) {
          best = { line, y1: line.y1, y2: line.y2, err: scored.err, det: scored.det };
        }
      }
      line.y1 = originalY1;
      line.y2 = originalY2;
    }

    if (best === null) break;
    best.line.y1 = best.y1;
    best.line.y2 = best.y2;
    baseDet = best.det;
    bestErr = best.err;
  }
}

// Shared contact-range scanner. Walks the airborne mask once, emitting one
// entry per maximal run of contact frames (a "contact range") that is closed by
// a subsequent airborne frame. A trailing range still open at the end of the
// mask is intentionally NOT emitted (matches the original per-function scanners).
// `start` is the first contact frame, `end` the first airborne frame after the
// range (exclusive, so `end - start` = contact-frame count), and `ids` the
// contact line ids in first-seen (insertion) order.
interface ContactRange {
  start: number;
  end: number;
  ids: Set<number>;
}

function contactRanges(det: Detection): ContactRange[] {
  const ranges: ContactRange[] = [];
  let inContact = false;
  let rangeStart = 0;
  let rangeIds = new Set<number>();

  for (let frame = 0; frame < det.measurements.airborne.length; frame++) {
    const contact = !det.measurements.airborne[frame];
    if (contact) {
      if (!inContact) rangeStart = frame;
      inContact = true;
      for (const id of det.measurements.contactLineIds[frame] ?? []) {
        rangeIds.add(id);
      }
      continue;
    }

    if (!inContact) continue;
    ranges.push({ start: rangeStart, end: frame, ids: rangeIds });
    inContact = false;
    rangeIds = new Set<number>();
  }

  return ranges;
}

function contactExitLineIds(det: Detection): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const range of contactRanges(det)) {
    const id = [...range.ids].sort((a, b) => a - b).at(-1);
    if (id !== undefined && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function contactEntryLineIds(det: Detection): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const range of contactRanges(det)) {
    const id = [...range.ids].sort((a, b) => a - b)[0];
    if (id !== undefined && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function briefSingleLineContactEntryIds(det: Detection): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const range of contactRanges(det)) {
    const id = [...range.ids][0];
    if (
      range.ids.size === 1
      && range.end - range.start <= PERSISTENCE_FRAMES
      && id !== undefined
      && !seen.has(id)
    ) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function polishGrainLength(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  rebuildEngine: PolishRebuildEngine,
): void {
  if (!shouldPolishGrainLength(spec)) return;

  let baseDet = simulateAndDetect(fits, gaps, durationFrames, rebuildEngine);
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  let bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);
  let chainLineId: number | null = null;

  for (let pass = 0; pass < GRAIN_LENGTH_PASSES; pass++) {
    let best:
      | {
        line: TrackLine;
        owner: number;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        err: number;
        det: Detection;
      }
      | null = null;

    const lineIds = chainLineId === null ? contactEntryLineIds(baseDet) : [chainLineId];
    for (const lineId of lineIds) {
      const owner = findGapOwning(lineId, fits);
      if (owner < 0) continue;
      const fit = fits[owner]!;
      const line = fit.lines.find((l) => l.id === lineId);
      if (line === undefined) continue;

      const originalX1 = line.x1;
      const originalY1 = line.y1;
      const originalX2 = line.x2;
      const originalY2 = line.y2;
      const dx = originalX2 - originalX1;
      const dy = originalY2 - originalY1;
      const len = Math.hypot(dx, dy);
      if (len <= 0) continue;

      for (const extra of GRAIN_LENGTH_EXTRAS) {
        for (const side of ["end", "start"] as const) {
          if (side === "end") {
            line.x2 = originalX2 + (dx / len) * extra;
            line.y2 = originalY2 + (dy / len) * extra;
          } else {
            line.x1 = originalX1 - (dx / len) * extra;
            line.y1 = originalY1 - (dy / len) * extra;
          }

          const scored = scoreCurrentPolishGeometry(
            fits, gaps, spec, contactFrames, durationFrames, rebuildEngine,
          );
          if (scored !== null) {
            if (scored.err + 1e-6 < bestErr && (best === null || scored.err < best.err)) {
              best = {
                line,
                owner,
                x1: line.x1,
                y1: line.y1,
                x2: line.x2,
                y2: line.y2,
                err: scored.err,
                det: scored.det,
              };
            }
          }

          line.x1 = originalX1;
          line.y1 = originalY1;
          line.x2 = originalX2;
          line.y2 = originalY2;
        }
      }
    }

    if (best === null) break;
    best.line.x1 = best.x1;
    best.line.y1 = best.y1;
    best.line.x2 = best.x2;
    best.line.y2 = best.y2;
    updateGeometryAxes(fits[best.owner]!);
    baseDet = best.det;
    bestErr = best.err;
    chainLineId = best.line.id;
  }
}

function shouldPolishGrainLength(spec: Spec): boolean {
  return axisTargeted(spec, "grain");
}

function polishEntrySpeed(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  rebuildEngine: PolishRebuildEngine,
): void {
  if (!shouldPolishEntrySpeed(spec)) return;

  const baseDet = simulateAndDetect(fits, gaps, durationFrames, rebuildEngine);
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  const bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);
  for (const lineId of contactEntryLineIds(baseDet).reverse()) {
    const owner = findGapOwning(lineId, fits);
    if (owner < 0) continue;
    const line = fits[owner]!.lines.find((l) => l.id === lineId);
    if (line === undefined) continue;

    const originalX1 = line.x1;
    const originalY1 = line.y1;
    const originalX2 = line.x2;
    const originalY2 = line.y2;
    let best:
      | {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        err: number;
      }
      | null = null;

    line.y1 = originalY1 + SPEED_POLISH_Y_SHIFT_PX;
    line.y2 = originalY2 + SPEED_POLISH_Y_SHIFT_PX;

    const scored = scoreCurrentPolishGeometry(
      fits, gaps, spec, contactFrames, durationFrames, rebuildEngine,
    );
    if (scored !== null) {
      if (scored.err + 1e-6 < bestErr && (best === null || scored.err < best.err)) {
        best = {
          x1: line.x1,
          y1: line.y1,
          x2: line.x2,
          y2: line.y2,
          err: scored.err,
        };
      }
    }

    line.x1 = originalX1;
    line.y1 = originalY1;
    line.x2 = originalX2;
    line.y2 = originalY2;

    if (best !== null) {
      line.x1 = best.x1;
      line.y1 = best.y1;
      line.x2 = best.x2;
      line.y2 = best.y2;
      return;
    }
  }
}

function shouldPolishEntrySpeed(spec: Spec): boolean {
  return axisTargeted(spec, "speed");
}

function polishEntrySpeedX(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  rebuildEngine: PolishRebuildEngine,
): void {
  if (!shouldPolishEntrySpeed(spec)) return;

  let baseDet = simulateAndDetect(fits, gaps, durationFrames, rebuildEngine);
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  let bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);
  let lastAcceptedLineId: number | null = null;
  for (const dx of SPEED_POLISH_X_PASS_SHIFTS_PX) {
    let best:
      | {
        line: TrackLine;
        lineId: number;
        x1: number;
        x2: number;
        err: number;
        det: Detection;
      }
      | null = null;

    const lineIds = lastAcceptedLineId === null
      ? contactEntryLineIds(baseDet).reverse()
      : [lastAcceptedLineId];
    for (const lineId of lineIds) {
      const owner = findGapOwning(lineId, fits);
      if (owner < 0) continue;
      const line = fits[owner]!.lines.find((l) => l.id === lineId);
      if (line === undefined) continue;

      const originalX1 = line.x1;
      const originalX2 = line.x2;

      line.x1 = originalX1 + dx;
      line.x2 = originalX2 + dx;

      const scored = scoreCurrentPolishGeometry(
        fits, gaps, spec, contactFrames, durationFrames, rebuildEngine,
      );
      if (scored !== null) {
        if (scored.err + 1e-6 < bestErr && (best === null || scored.err < best.err)) {
          best = { line, lineId, x1: line.x1, x2: line.x2, err: scored.err, det: scored.det };
        }
      }

      line.x1 = originalX1;
      line.x2 = originalX2;
    }

    if (best === null) break;
    best.line.x1 = best.x1;
    best.line.x2 = best.x2;
    lastAcceptedLineId = best.lineId;
    baseDet = best.det;
    bestErr = best.err;
  }

  polishEntrySpeedXBoundary(
    fits, gaps, spec, contactFrames, durationFrames, baseDet, bestErr, rebuildEngine,
  );

  const refinedDet = simulateAndDetect(fits, gaps, durationFrames, rebuildEngine);
  if (!passesFinalHardGates(refinedDet, contactFrames)) return;
  polishEntrySpeedYBoundary(
    fits,
    gaps,
    spec,
    contactFrames,
    durationFrames,
    refinedDet,
    meanSectionAxisError(refinedDet, spec, gaps, fits),
    rebuildEngine,
  );
}

function polishEntrySlope(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  rebuildEngine: PolishRebuildEngine,
): void {
  if (!shouldPolishEntrySpeed(spec)) return;

  const baseDet = simulateAndDetect(fits, gaps, durationFrames, rebuildEngine);
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  const bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);
  for (const lineId of contactEntryLineIds(baseDet).reverse()) {
    const owner = findGapOwning(lineId, fits);
    if (owner < 0) continue;
    const line = fits[owner]!.lines.find((l) => l.id === lineId);
    if (line === undefined) continue;

    const originalX1 = line.x1;
    const originalY1 = line.y1;
    const originalX2 = line.x2;
    const originalY2 = line.y2;
    const dx = originalX2 - originalX1;
    const dy = originalY2 - originalY1;
    const len = Math.hypot(dx, dy);
    if (len <= 0) continue;

    const cx = (originalX1 + originalX2) / 2;
    const cy = (originalY1 + originalY2) / 2;
    const angle = Math.atan2(dy, dx);

    const rotated = angle + (SPEED_POLISH_ROTATION_DEG * Math.PI) / 180;
    line.x1 = cx - (Math.cos(rotated) * len) / 2;
    line.y1 = cy - (Math.sin(rotated) * len) / 2;
    line.x2 = cx + (Math.cos(rotated) * len) / 2;
    line.y2 = cy + (Math.sin(rotated) * len) / 2;

    const scored = scoreCurrentPolishGeometry(
      fits, gaps, spec, contactFrames, durationFrames, rebuildEngine,
    );
    if (scored !== null && scored.err + 1e-6 < bestErr) return;

    line.x1 = originalX1;
    line.y1 = originalY1;
    line.x2 = originalX2;
    line.y2 = originalY2;
  }
}

function polishEntryLength(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  rebuildEngine: PolishRebuildEngine,
): void {
  if (!shouldPolishGrainLength(spec)) return;

  let baseDet = simulateAndDetect(fits, gaps, durationFrames, rebuildEngine);
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  let bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);
  let afterLineId = 0;

  for (let pass = 0; pass < ENTRY_LENGTH_PASSES; pass++) {
    let accepted = false;
    for (const lineId of contactEntryLineIds(baseDet)) {
      if (lineId <= afterLineId) continue;
      const owner = findGapOwning(lineId, fits);
      if (owner < 0) continue;
      const fit = fits[owner]!;
      const line = fit.lines.find((l) => l.id === lineId);
      if (line === undefined) continue;

      const originalX1 = line.x1;
      const originalY1 = line.y1;
      const originalX2 = line.x2;
      const originalY2 = line.y2;
      const dx = originalX2 - originalX1;
      const dy = originalY2 - originalY1;
      const len = Math.hypot(dx, dy);
      if (len <= 0) continue;

      let best:
        | {
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          err: number;
          det: Detection;
        }
        | null = null;

      for (const extra of GRAIN_LENGTH_EXTRAS) {
        for (const side of ["end", "start"] as const) {
          if (side === "end") {
            line.x2 = originalX2 + (dx / len) * extra;
            line.y2 = originalY2 + (dy / len) * extra;
          } else {
            line.x1 = originalX1 - (dx / len) * extra;
            line.y1 = originalY1 - (dy / len) * extra;
          }

          const scored = scoreCurrentPolishGeometry(
            fits, gaps, spec, contactFrames, durationFrames, rebuildEngine,
          );
          if (scored !== null) {
            if (scored.err + 1e-6 < bestErr && (best === null || scored.err < best.err)) {
              best = {
                x1: line.x1,
                y1: line.y1,
                x2: line.x2,
                y2: line.y2,
                err: scored.err,
                det: scored.det,
              };
            }
          }

          line.x1 = originalX1;
          line.y1 = originalY1;
          line.x2 = originalX2;
          line.y2 = originalY2;
        }
      }

      if (best !== null) {
        line.x1 = best.x1;
        line.y1 = best.y1;
        line.x2 = best.x2;
        line.y2 = best.y2;
        updateGeometryAxes(fit);
        baseDet = best.det;
        bestErr = best.err;
        afterLineId = lineId;
        accepted = true;
        break;
      }
    }
    if (!accepted) break;
  }
}

function polishMedianGrainResidual(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
  rebuildEngine: PolishRebuildEngine,
): void {
  if (!shouldPolishGrainLength(spec)) return;

  const baseDet = simulateAndDetect(fits, gaps, durationFrames, rebuildEngine);
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  const bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);
  let best:
    | {
      owner: number;
      lines: LineSnapshot[];
      err: number;
    }
    | null = null;

  for (const iv of axisTargetIntervals(spec, "grain")) {
    const entries = grainFitsInRange(iv.f0, iv.f1, gaps, fits);
    if (entries.length === 0) continue;

    const achieved = entries
      .map(({ fit }) => measureFitGrain(fit))
      .reduce((a, b) => a + b, 0) / entries.length;
    const residual = iv.v - achieved;
    if (Math.abs(residual) <= 1e-9) continue;

    const neededMedianDelta = residual * CALIB.LINE_LENGTH_CAP * entries.length;

    for (const { owner, fit } of entries) {
      for (const plan of grainResidualPlans(fit, neededMedianDelta)) {
        const originals = snapshotLines(plan.lines);
        // try/finally guarantees the mutated geometry is rolled back even if a
        // detect / gate / axis-error call throws — otherwise the leak corrupts
        // the live TrackLines the rest of the polish pass evaluates.
        try {
          if (!applyLengthDelta(originals, plan.side, plan.extra)) continue;

          const scored = scoreCurrentPolishGeometry(
            fits, gaps, spec, contactFrames, durationFrames, rebuildEngine,
          );
          if (scored !== null) {
            if (scored.err + 1e-6 < bestErr && (best === null || scored.err < best.err)) {
              best = {
                owner,
                lines: snapshotLines(plan.lines),
                err: scored.err,
              };
            }
          }
        } finally {
          restoreLines(originals);
        }
      }
    }
  }

  if (best === null) return;
  restoreLines(best.lines);
  updateGeometryAxes(fits[best.owner]!);
}

type LineSnapshot = {
  line: TrackLine;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function grainResidualPlans(
  fit: GapFit,
  neededMedianDelta: number,
): { lines: TrackLine[]; side: "start" | "end"; extra: number }[] {
  const direction = Math.sign(neededMedianDelta);
  if (direction === 0 || fit.lines.length === 0) return [];

  const sorted = fit.lines
    .map((line) => ({ line, len: Math.hypot(line.x2 - line.x1, line.y2 - line.y1) }))
    .sort((a, b) => a.len - b.len);
  const rank = direction > 0
    ? Math.floor(fit.lines.length / 2)
    : Math.floor((fit.lines.length - 1) / 2);
  const targetLen = sorted[rank].len;
  const plateau = sorted
    .filter((entry) => Math.abs(entry.len - targetLen) < 1e-6)
    .map((entry) => entry.line);
  if (plateau.length === 0) return [];

  const plans: { lines: TrackLine[]; side: "start" | "end"; extra: number }[] = [];
  const before = medianLineLength(fit);
  for (const side of ["end", "start"] as const) {
    const originals = snapshotLines(plateau);
    const unitExtra = direction;
    // try/finally guarantees rollback even if medianLineLength throws between the
    // probe mutation and the restore — the mutation must not leak into `plateau`.
    let unitEffect = 0;
    try {
      if (!applyLengthDelta(originals, side, unitExtra)) continue;
      unitEffect = medianLineLength(fit) - before;
    } finally {
      restoreLines(originals);
    }
    if (Math.abs(unitEffect) <= 1e-9 || Math.sign(unitEffect) !== direction) continue;

    const extra = neededMedianDelta / unitEffect;
    if (!Number.isFinite(extra) || Math.sign(extra) !== direction) continue;
    plans.push({ lines: plateau, side, extra });
  }

  return plans;
}

function medianLineLength(fit: GapFit): number {
  return median(fit.lines.map((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1)));
}

function snapshotLines(lines: TrackLine[]): LineSnapshot[] {
  return lines.map((line) => ({
    line,
    x1: line.x1,
    y1: line.y1,
    x2: line.x2,
    y2: line.y2,
  }));
}

function restoreLines(lines: LineSnapshot[]): void {
  for (const saved of lines) {
    saved.line.x1 = saved.x1;
    saved.line.y1 = saved.y1;
    saved.line.x2 = saved.x2;
    saved.line.y2 = saved.y2;
  }
}

function applyLengthDelta(
  lines: LineSnapshot[],
  side: "start" | "end",
  extra: number,
): boolean {
  for (const saved of lines) {
    const dx = saved.x2 - saved.x1;
    const dy = saved.y2 - saved.y1;
    const len = Math.hypot(dx, dy);
    if (len <= 0 || len + extra <= 0) return false;
  }

  for (const saved of lines) {
    const dx = saved.x2 - saved.x1;
    const dy = saved.y2 - saved.y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    if (side === "end") {
      saved.line.x2 = saved.x2 + ux * extra;
      saved.line.y2 = saved.y2 + uy * extra;
    } else {
      saved.line.x1 = saved.x1 - ux * extra;
      saved.line.y1 = saved.y1 - uy * extra;
    }
  }

  return true;
}

function contactEntryEdgeTrimCandidates(
  det: Detection,
): { lineId: number; side: "start" | "end"; fraction: number }[] {
  const candidates: { lineId: number; side: "start" | "end"; fraction: number }[] = [];
  const seen = new Set<string>();
  for (const range of contactRanges(det)) {
    if (range.end - range.start < CONTACT_EDGE_TRIM_MIN_FRAMES) continue;
    const sorted = [...range.ids].sort((a, b) => a - b);
    const lineId = sorted[0];
    if (lineId === undefined) continue;
    for (const trim of CONTACT_ENTRY_EDGE_TRIM_PROBES) {
      const key = `${lineId}:${trim.side}:${trim.fraction}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ lineId, side: trim.side, fraction: trim.fraction });
    }
  }

  return candidates;
}

function meanSectionAxisError(
  det: Detection,
  spec: Spec,
  gaps: Gap[],
  fits: (GapFit | null)[],
): number {
  let total = 0;
  let n = 0;
  // Frame-span axes: per constant-target interval over the final-track measurement.
  for (const axis of FRAME_SPAN_AXES) {
    for (const iv of axisTargetIntervals(spec, axis)) {
      const v = measureAxisOverRange(det, iv.f0, iv.f1, axis);
      if (v !== null) {
        total += Math.abs(iv.v - v);
        n++;
      }
    }
  }
  // grain: median catch length over the gaps landing inside each grain interval.
  for (const iv of axisTargetIntervals(spec, "grain")) {
    const entries = grainFitsInRange(iv.f0, iv.f1, gaps, fits);
    if (entries.length === 0) continue;
    const achieved = entries
      .map(({ fit }) => measureFitGrain(fit))
      .reduce((a, b) => a + b, 0) / entries.length;
    total += Math.abs(iv.v - achieved);
    n++;
  }
  return n > 0 ? total / n : Infinity;
}

function grainFitsInRange(
  firstFrame: number,
  lastFrame: number,
  gaps: readonly Gap[],
  fits: readonly (GapFit | null)[],
): Array<{ owner: number; fit: GapFit }> {
  const entries: Array<{ owner: number; fit: GapFit }> = [];
  for (let owner = 0; owner < gaps.length; owner++) {
    const fit = fits[owner];
    if (
      fit !== null &&
      gaps[owner].endFrame >= firstFrame &&
      gaps[owner].endFrame <= lastFrame
    ) {
      entries.push({ owner, fit });
    }
  }
  return entries;
}

function updateGeometryAxes(fit: GapFit): void {
  fit.achieved.grain = measureFitGrain(fit);
}

function nextLineIdAt(fits: (GapFit | null)[], upTo: number): number {
  let id = 1;
  for (let j = 0; j < upTo; j++) {
    const fit = fits[j];
    if (fit !== null) id += fit.lines.length;
  }
  return id;
}

// Pure predicate kept private to this module.
function isDenseContactSequence(contactFrames: number[], durationFrames: number): boolean {
  return contactFrames.length * FPS > durationFrames;
}

// ─────────── Engine rebuild (for backtracking / polish / final report) ───────────

// Engine-rebuild counter. `rebuildEngine` bumps it instead of touching compile
// stats directly; callers read/reset it via the accessors below.
let engineRebuildCount = 0;

export function getEngineRebuildCount(): number {
  return engineRebuildCount;
}

export function resetEngineRebuildCount(): void {
  engineRebuildCount = 0;
}
// Per-compile reset joins the lifecycle registry; compileHandoffInternal folds
// getEngineRebuildCount() into stats.engine_rebuilds at the end of each compile.
registerCompileReset(resetEngineRebuildCount);

/**
 * Reconstruct the engine state up to (but not including) gap index `upTo`,
 * by replaying all committed gap fits in time order. O(N) per call; fine for
 * v0 spec sizes. Cache if it becomes a bottleneck.
 */
// deno-lint-ignore no-explicit-any
function rebuildEngineWithStart(
  startState: ResolvedStart,
  startLines: readonly TrackLine[],
  fits: (GapFit | null)[],
  upTo: number,
): any {
  engineRebuildCount++;
  // deno-lint-ignore no-explicit-any
  let chained: any = makeBaseEngine(startState);
  if (startLines.length > 0) {
    chained = chained.addLine(startLines.map((line) => engineLineFromTrackLine(line)));
  }
  for (let j = 0; j < upTo; j++) {
    const fit = fits[j];
    if (fit === null) continue;
    for (const line of fit.lines) {
      chained = chained.addLine(engineLineFromTrackLine(line));
    }
  }
  return chained;
}

/**
 * Rebuild a candidate leaf from the complete immutable start geometry plus its
 * mutable gap fits. Start lines are not part of `prefixFits`, but they are part
 * of every live handoff engine; omitting them makes a polished replay describe
 * a different track. The default preserves callers that truly start line-free.
 */
export function makePolishRebuildEngine(
  startState: ResolvedStart,
  startLines: readonly TrackLine[] = [],
): PolishRebuildEngine {
  return (fits, upTo) => rebuildEngineWithStart(startState, startLines, fits, upTo);
}

/**
 * The recurring polish "rebuild → simulate with tail → detect" triple: rebuild
 * the engine from `fits`, run it `POLISH_SIM_TAIL_FRAMES` frames past the spec's
 * nominal end, and return the detector's reading of that trajectory. Used
 * wherever a polisher scores a freshly-rebuilt candidate track from scratch.
 */
function simulateAndDetect(
  fits: (GapFit | null)[],
  gaps: Gap[],
  durationFrames: number,
  rebuildEngine: PolishRebuildEngine,
): Detection {
  return detect(
    extractRawTrajectory(rebuildEngine(fits, gaps.length), durationFrames + POLISH_SIM_TAIL_FRAMES),
  );
}
