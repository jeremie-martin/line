/**
 * v0 polish core — the post-compile geometry-refinement subsystem shared by the
 * legacy compiler (`../compile.ts`) and the LDS optimizer (`../optimizer/*`).
 *
 * This module is a pure MOVE of the polish cluster (the four air/contact entry
 * helpers + their ~20 private sub-polishers and CALIB consts), the engine
 * rebuild used by polish + the final DriftReport simulation, and the
 * module-scoped start state those rebuilds read, all of which previously lived
 * in `../compile.ts`. The dependency direction is one-way: both `compile.ts`
 * and the optimizer import from here, never the reverse. These functions depend
 * only on `../../lib/*`, `../arc.ts`, `../types.ts`, and the core siblings
 * `./substrate.ts` / `./candidate.ts`, so they carry no compiler-only state.
 *
 * `isDenseContactSequence` is a tiny pure predicate also needed by the staying
 * legacy pipeline; rather than create a core↔compile import cycle it is
 * duplicated here as a private helper (matching the A2/A3 precedent for
 * `isDenseContactSequence` / `makeContinuationLines`).
 *
 * Engine-rebuild accounting: `rebuildEngine` bumps a module-local counter
 * instead of touching compile's `stats` object (no mutable cross-module state).
 * `compile()` folds `getEngineRebuildCount()` into `stats.engine_rebuilds` at
 * the end of a run, preserving the legacy counter exactly.
 */

import {
  detect, extractRawTrajectory, getRiderMetered,
  K_BOUNCE_LANDING, PERSISTENCE_FRAMES,
  type Detection,
} from "../../lib/detector.ts";
import { makeSolidLine } from "../arc.ts";
import {
  type Spec, type Section,
  type TrackLine, type Gap,
  CALIB, FPS, START_DEFAULTS, secToFrame,
} from "../types.ts";
import {
  type ResolvedStart,
  type GapFit,
  median,
  makeBaseEngine,
  measureAxisOverRange,
  measureFitGrain,
  engineLineFromTrackLine,
  findGapOwning,
  velocityAt,
} from "./substrate.ts";
import {
  makeAirPolishCandidates,
} from "./candidate.ts";

const AIR_POLISH_PASSES = 3;
const DENSE_AIR_POLISH_PASSES = 2;
const DENSE_AIR_POLISH_SOURCE_LIMIT = 8;
const AIR_CONTACT_EXTENSION_LENGTHS = [25] as const;
const AIR_BRIEF_CONTACT_PASSES = 3;
const AIR_BRIEF_CONTACT_LENGTH = 8;
const AIR_BRIEF_CONTACT_FRAME_OFFSET = K_BOUNCE_LANDING + PERSISTENCE_FRAMES - 1;
const AIR_BRIEF_CONTACT_LANDING_MARGIN = PERSISTENCE_FRAMES + 1;
const CONTACT_TRIM_PASSES = 2;
const CONTACT_TRIM_FRACTIONS = [0.25, 0.8] as const;
const CONTACT_EDGE_TRIM_PASSES = 2;
const CONTACT_EDGE_TRIMS = [
  { edge: "start", side: "start", fraction: 0.85 },
  { edge: "start", side: "end", fraction: 0.9 },
] as const;
const GRAIN_LENGTH_PASSES = 1;
const GRAIN_LENGTH_EXTRAS = [1, 2] as const;
const ENTRY_LENGTH_PASSES = 3;
const SPEED_POLISH_Y_SHIFTS = [-1] as const;
const SPEED_POLISH_X_SHIFT_PASSES = [[4], [1], [0.5]] as const;
const SPEED_POLISH_BOUNDARY_PASSES = 2;
const SPEED_POLISH_ROTATIONS = [-4] as const;

export function polishAirRideOut(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (!hasOnlyAirSectionTargets(spec)) return;

  let baseEngine = rebuildEngine(fits, gaps.length);
  const baseDet = detect(extractRawTrajectory(baseEngine, durationFrames + 20));
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
        true,
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
        false,
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
  continuationOnly: boolean,
): AirPolishCandidate | null {
  let best: AirPolishCandidate | null = null;
  for (const source of sources) {
    if (usedSources.has(source.line.id)) continue;
    for (const cand of makeAirPolishCandidates(lineId, source.line)) {
      if (continuationOnly && !cand.continuation) continue;
      const eng = baseEngine.addLine(engineLineFromTrackLine(cand.line));
      const det = detect(extractRawTrajectory(eng, durationFrames + 20));
      if (!passesFinalHardGates(det, contactFrames)) continue;
      const err = meanAirError(det, spec);
      if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
        best = { owner: source.owner, sourceId: source.line.id, line: cand.line, err };
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
    const lines = [
      ...fit.lines.slice(0, 1),
      ...fit.lines.slice(Math.max(0, fit.lines.length - 3)),
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

function hasOnlyAirSectionTargets(spec: Spec): boolean {
  let hasAir = false;
  for (const sec of spec.sections) {
    if (
      sec.speed !== undefined
      || sec.grain !== undefined
      || sec.contact_style !== undefined
    ) {
      return false;
    }
    if (sec.air !== undefined) hasAir = true;
  }
  return hasAir;
}

function passesFinalHardGates(det: Detection, contactFrames: number[]): boolean {
  if (det.terminus.reason !== "endOfSpec") return false;
  for (const cf of contactFrames) {
    const hit = det.events.some(
      (e) => e.type === "landing" && Math.abs(e.frame - cf) <= 1,
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
  for (const sec of spec.sections) {
    if (sec.air === undefined) continue;
    const achieved = measureAxisOverRange(
      det,
      secToFrame(sec.t0),
      secToFrame(sec.t1),
      "air",
    );
    if (achieved === null) continue;
    total += Math.abs(sec.air - achieved);
    n++;
  }
  return n > 0 ? total / n : Infinity;
}

function meanAirDelta(det: Detection, spec: Spec): number {
  let total = 0;
  let n = 0;
  for (const sec of spec.sections) {
    if (sec.air === undefined) continue;
    const achieved = measureAxisOverRange(
      det,
      secToFrame(sec.t0),
      secToFrame(sec.t1),
      "air",
    );
    if (achieved === null) continue;
    total += achieved - sec.air;
    n++;
  }
  return n > 0 ? total / n : 0;
}

function meanSpeedDelta(det: Detection, spec: Spec): number {
  let total = 0;
  let n = 0;
  for (const sec of spec.sections) {
    if (sec.speed === undefined) continue;
    const achieved = measureAxisOverRange(
      det,
      secToFrame(sec.t0),
      secToFrame(sec.t1),
      "speed",
    );
    if (achieved === null) continue;
    total += achieved - sec.speed;
    n++;
  }
  return n > 0 ? total / n : Infinity;
}

function meanAirFrameResolution(spec: Spec): number {
  let total = 0;
  let n = 0;
  for (const sec of spec.sections) {
    if (sec.air === undefined) continue;
    const frames = secToFrame(sec.t1) - secToFrame(sec.t0) + 1;
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
): void {
  if (isDenseContactSequence(contactFrames, durationFrames)) return;
  if (!hasOnlyAirSectionTargets(spec)) return;

  const baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
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

    for (const extra of AIR_CONTACT_EXTENSION_LENGTHS) {
      line.x1 = originalX1 - (dx / len) * extra;
      line.y1 = originalY1 - (dy / len) * extra;
      const det = detect(extractRawTrajectory(
        rebuildEngine(fits, gaps.length),
        durationFrames + 20,
      ));
      if (passesFinalHardGates(det, contactFrames)) {
        const err = meanAirError(det, spec);
        if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
          best = { x1: line.x1, y1: line.y1, err };
        }
      }
      line.x1 = originalX1;
      line.y1 = originalY1;
    }

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
): void {
  if (isDenseContactSequence(contactFrames, durationFrames)) return;
  if (!hasOnlyAirSectionTargets(spec)) return;

  let baseEngine = rebuildEngine(fits, gaps.length);
  let baseDet = detect(extractRawTrajectory(baseEngine, durationFrames + 20));
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
      const det = detect(extractRawTrajectory(candidateEngine, durationFrames + 20));
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

export function polishExcessContact(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (isDenseContactSequence(contactFrames, durationFrames)) return;
  if (!shouldPolishExcessContact(spec)) return;

  let baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
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

      for (const frac of CONTACT_TRIM_FRACTIONS) {
        for (const side of ["end", "start"] as const) {
          if (side === "end") {
            line.x2 = originalX1 + dx * frac;
            line.y2 = originalY1 + dy * frac;
          } else {
            line.x1 = originalX2 - dx * frac;
            line.y1 = originalY2 - dy * frac;
          }
          const eng = rebuildEngine(fits, gaps.length);
          const det = detect(extractRawTrajectory(eng, durationFrames + 20));
          if (passesFinalHardGates(det, contactFrames)) {
            const err = meanSectionAxisError(det, spec, gaps, fits);
            if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
              best = {
                line,
                owner,
                x1: line.x1,
                y1: line.y1,
                x2: line.x2,
                y2: line.y2,
                err,
                det,
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

  polishContactEdges(fits, gaps, spec, contactFrames, durationFrames, baseDet, bestErr);
  polishGrainLength(fits, gaps, spec, contactFrames, durationFrames);
  polishEntrySpeed(fits, gaps, spec, contactFrames, durationFrames);
  polishEntrySlope(fits, gaps, spec, contactFrames, durationFrames);
  polishEntryLength(fits, gaps, spec, contactFrames, durationFrames);
  polishMedianGrainPlateau(fits, gaps, spec, contactFrames, durationFrames);
  polishMedianGrainResidual(fits, gaps, spec, contactFrames, durationFrames);
  polishEntrySpeed(fits, gaps, spec, contactFrames, durationFrames);
  polishEntrySpeedX(fits, gaps, spec, contactFrames, durationFrames);
}

function shouldPolishExcessContact(spec: Spec): boolean {
  let hasAir = false;
  let hasCompanionAxis = false;
  for (const sec of spec.sections) {
    if (sec.contact_style !== undefined) return false;
    if (sec.air !== undefined) hasAir = true;
    if (sec.speed !== undefined || sec.grain !== undefined) hasCompanionAxis = true;
  }
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

    for (const candidate of contactEdgeTrimCandidates(baseDet)) {
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

      const eng = rebuildEngine(fits, gaps.length);
      const det = detect(extractRawTrajectory(eng, durationFrames + 20));
      if (passesFinalHardGates(det, contactFrames)) {
        const err = meanSectionAxisError(det, spec, gaps, fits);
        if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
          best = {
            line,
            owner,
            x1: line.x1,
            y1: line.y1,
            x2: line.x2,
            y2: line.y2,
            err,
            det,
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
): void {
  if (isDenseContactSequence(contactFrames, durationFrames)) return;

  const coarseShift = Math.abs(SPEED_POLISH_X_SHIFT_PASSES.at(-1)?.[0] ?? 0.5);
  if (coarseShift <= 0) return;
  const refinementStep = coarseShift / 10;

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
      const det = detect(extractRawTrajectory(
        rebuildEngine(fits, gaps.length),
        durationFrames + 20,
      ));
      if (passesFinalHardGates(det, contactFrames)) {
        const err = meanSectionAxisError(det, spec, gaps, fits);
        if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
          best = { line, x1: line.x1, x2: line.x2, err, det };
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
): void {
  if (isDenseContactSequence(contactFrames, durationFrames)) return;

  const coarseShift = Math.abs(SPEED_POLISH_X_SHIFT_PASSES.at(-1)?.[0] ?? 0.5);
  if (coarseShift <= 0) return;

  let baseDet = initialDet;
  let bestErr = initialErr;
  let step = coarseShift / 2;

  for (let pass = 0; pass <= SPEED_POLISH_BOUNDARY_PASSES; pass++, step /= 2) {
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
      const det = detect(extractRawTrajectory(
        rebuildEngine(fits, gaps.length),
        durationFrames + 20,
      ));
      if (passesFinalHardGates(det, contactFrames)) {
        const err = meanSectionAxisError(det, spec, gaps, fits);
        if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
          best = { line, y1: line.y1, y2: line.y2, err, det };
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

function contactExitLineIds(det: Detection): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  let inContact = false;
  let rangeIds = new Set<number>();

  for (let frame = 0; frame < det.measurements.airborne.length; frame++) {
    const contact = !det.measurements.airborne[frame];
    if (contact) {
      inContact = true;
      for (const id of det.measurements.contactLineIds[frame] ?? []) {
        rangeIds.add(id);
      }
      continue;
    }

    if (!inContact) continue;
    const sorted = [...rangeIds].sort((a, b) => a - b);
    const id = sorted.at(-1);
    if (id !== undefined && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
    inContact = false;
    rangeIds = new Set<number>();
  }

  return ids;
}

function contactEntryLineIds(det: Detection): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  let inContact = false;
  let rangeIds = new Set<number>();

  for (let frame = 0; frame < det.measurements.airborne.length; frame++) {
    const contact = !det.measurements.airborne[frame];
    if (contact) {
      inContact = true;
      for (const id of det.measurements.contactLineIds[frame] ?? []) {
        rangeIds.add(id);
      }
      continue;
    }

    if (!inContact) continue;
    const sorted = [...rangeIds].sort((a, b) => a - b);
    const id = sorted[0];
    if (id !== undefined && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
    inContact = false;
    rangeIds = new Set<number>();
  }

  return ids;
}

function briefSingleLineContactEntryIds(det: Detection): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
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
    const id = [...rangeIds][0];
    if (
      rangeIds.size === 1
      && frame - rangeStart <= PERSISTENCE_FRAMES
      && id !== undefined
      && !seen.has(id)
    ) {
      seen.add(id);
      ids.push(id);
    }
    inContact = false;
    rangeIds = new Set<number>();
  }

  return ids;
}

function polishGrainLength(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (!shouldPolishGrainLength(spec)) return;

  let baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
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

          const det = detect(extractRawTrajectory(
            rebuildEngine(fits, gaps.length),
            durationFrames + 20,
          ));
          if (passesFinalHardGates(det, contactFrames)) {
            const err = meanSectionAxisError(det, spec, gaps, fits);
            if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
              best = {
                line,
                owner,
                x1: line.x1,
                y1: line.y1,
                x2: line.x2,
                y2: line.y2,
                err,
                det,
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
  for (const sec of spec.sections) {
    if (sec.contact_style !== undefined) return false;
    if (sec.grain !== undefined) return true;
  }
  return false;
}

function polishEntrySpeed(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (!shouldPolishEntrySpeed(spec)) return;

  const baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
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

    for (const dy of SPEED_POLISH_Y_SHIFTS) {
      line.y1 = originalY1 + dy;
      line.y2 = originalY2 + dy;

      const det = detect(extractRawTrajectory(
        rebuildEngine(fits, gaps.length),
        durationFrames + 20,
      ));
      if (passesFinalHardGates(det, contactFrames)) {
        const err = meanSectionAxisError(det, spec, gaps, fits);
        if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
          best = {
            x1: line.x1,
            y1: line.y1,
            x2: line.x2,
            y2: line.y2,
            err,
          };
        }
      }

      line.x1 = originalX1;
      line.y1 = originalY1;
      line.x2 = originalX2;
      line.y2 = originalY2;
    }

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
  for (const sec of spec.sections) {
    if (sec.contact_style !== undefined) return false;
    if (sec.speed !== undefined) return true;
  }
  return false;
}

function polishEntrySpeedX(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (!shouldPolishEntrySpeed(spec)) return;

  let baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  let bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);
  let lastAcceptedLineId: number | null = null;
  for (const shifts of SPEED_POLISH_X_SHIFT_PASSES) {
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

      for (const dx of shifts) {
        line.x1 = originalX1 + dx;
        line.x2 = originalX2 + dx;

        const det = detect(extractRawTrajectory(
          rebuildEngine(fits, gaps.length),
          durationFrames + 20,
        ));
        if (passesFinalHardGates(det, contactFrames)) {
          const err = meanSectionAxisError(det, spec, gaps, fits);
          if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
            best = { line, lineId, x1: line.x1, x2: line.x2, err, det };
          }
        }

        line.x1 = originalX1;
        line.x2 = originalX2;
      }
    }

    if (best === null) break;
    best.line.x1 = best.x1;
    best.line.x2 = best.x2;
    lastAcceptedLineId = best.lineId;
    baseDet = best.det;
    bestErr = best.err;
  }

  polishEntrySpeedXBoundary(
    fits, gaps, spec, contactFrames, durationFrames, baseDet, bestErr,
  );

  const refinedDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
  if (!passesFinalHardGates(refinedDet, contactFrames)) return;
  polishEntrySpeedYBoundary(
    fits,
    gaps,
    spec,
    contactFrames,
    durationFrames,
    refinedDet,
    meanSectionAxisError(refinedDet, spec, gaps, fits),
  );
}

function polishEntrySlope(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (!shouldPolishEntrySpeed(spec)) return;

  const baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
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

    for (const rotateDeg of SPEED_POLISH_ROTATIONS) {
      const rotated = angle + (rotateDeg * Math.PI) / 180;
      line.x1 = cx - (Math.cos(rotated) * len) / 2;
      line.y1 = cy - (Math.sin(rotated) * len) / 2;
      line.x2 = cx + (Math.cos(rotated) * len) / 2;
      line.y2 = cy + (Math.sin(rotated) * len) / 2;

      const det = detect(extractRawTrajectory(
        rebuildEngine(fits, gaps.length),
        durationFrames + 20,
      ));
      if (passesFinalHardGates(det, contactFrames)) {
        const err = meanSectionAxisError(det, spec, gaps, fits);
        if (err + 1e-6 < bestErr) return;
      }

      line.x1 = originalX1;
      line.y1 = originalY1;
      line.x2 = originalX2;
      line.y2 = originalY2;
    }
  }
}

function polishEntryLength(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (!shouldPolishGrainLength(spec)) return;

  let baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
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

          const det = detect(extractRawTrajectory(
            rebuildEngine(fits, gaps.length),
            durationFrames + 20,
          ));
          if (passesFinalHardGates(det, contactFrames)) {
            const err = meanSectionAxisError(det, spec, gaps, fits);
            if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
              best = {
                x1: line.x1,
                y1: line.y1,
                x2: line.x2,
                y2: line.y2,
                err,
                det,
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

function polishMedianGrainPlateau(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (!shouldPolishGrainLength(spec)) return;

  const baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  const bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);
  let best:
    | {
      owner: number;
      lines: {
        line: TrackLine;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      }[];
      err: number;
    }
    | null = null;

  for (let owner = 0; owner < fits.length; owner++) {
    const fit = fits[owner];
    if (fit === null || fit.lines.length < 2 || fit.lines.length % 2 !== 0) continue;

    const sorted = fit.lines
      .map((line) => ({ line, len: Math.hypot(line.x2 - line.x1, line.y2 - line.y1) }))
      .sort((a, b) => a.len - b.len);
    const upperMedian = sorted[fit.lines.length / 2].len;
    const plateau = sorted
      .filter((entry) => Math.abs(entry.len - upperMedian) < 1e-6)
      .map((entry) => entry.line);
    if (plateau.length < 2) continue;

    for (const extra of GRAIN_LENGTH_EXTRAS) {
      for (const side of ["end", "start"] as const) {
        const originals = plateau.map((line) => ({
          line,
          x1: line.x1,
          y1: line.y1,
          x2: line.x2,
          y2: line.y2,
        }));

        for (const original of originals) {
          const dx = original.x2 - original.x1;
          const dy = original.y2 - original.y1;
          const len = Math.hypot(dx, dy);
          if (len <= 0) continue;
          if (side === "end") {
            original.line.x2 = original.x2 + (dx / len) * extra;
            original.line.y2 = original.y2 + (dy / len) * extra;
          } else {
            original.line.x1 = original.x1 - (dx / len) * extra;
            original.line.y1 = original.y1 - (dy / len) * extra;
          }
        }

        const det = detect(extractRawTrajectory(
          rebuildEngine(fits, gaps.length),
          durationFrames + 20,
        ));
        if (passesFinalHardGates(det, contactFrames)) {
          const err = meanSectionAxisError(det, spec, gaps, fits);
          if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
            best = {
              owner,
              lines: originals.map((original) => ({
                line: original.line,
                x1: original.line.x1,
                y1: original.line.y1,
                x2: original.line.x2,
                y2: original.line.y2,
              })),
              err,
            };
          }
        }

        for (const original of originals) {
          original.line.x1 = original.x1;
          original.line.y1 = original.y1;
          original.line.x2 = original.x2;
          original.line.y2 = original.y2;
        }
      }
    }
  }

  if (best === null) return;
  for (const line of best.lines) {
    line.line.x1 = line.x1;
    line.line.y1 = line.y1;
    line.line.x2 = line.x2;
    line.line.y2 = line.y2;
  }
  updateGeometryAxes(fits[best.owner]!);
}

function polishMedianGrainResidual(
  fits: (GapFit | null)[],
  gaps: Gap[],
  spec: Spec,
  contactFrames: number[],
  durationFrames: number,
): void {
  if (!shouldPolishGrainLength(spec)) return;

  const baseDet = detect(extractRawTrajectory(
    rebuildEngine(fits, gaps.length),
    durationFrames + 20,
  ));
  if (!passesFinalHardGates(baseDet, contactFrames)) return;

  const bestErr = meanSectionAxisError(baseDet, spec, gaps, fits);
  let best:
    | {
      owner: number;
      lines: LineSnapshot[];
      err: number;
    }
    | null = null;

  for (const sec of spec.sections) {
    if (sec.grain === undefined) continue;
    const entries = sectionGrainFits(sec, gaps, fits);
    if (entries.length === 0) continue;

    const achieved = entries
      .map(({ fit }) => measureFitGrain(fit))
      .reduce((a, b) => a + b, 0) / entries.length;
    const residual = sec.grain - achieved;
    if (Math.abs(residual) <= 1e-9) continue;

    const neededMedianDelta = residual * CALIB.LINE_LENGTH_CAP * entries.length;

    for (const { owner, fit } of entries) {
      for (const plan of grainResidualPlans(fit, neededMedianDelta)) {
        const originals = snapshotLines(plan.lines);
        if (!applyLengthDelta(originals, plan.side, plan.extra)) {
          restoreLines(originals);
          continue;
        }

        const det = detect(extractRawTrajectory(
          rebuildEngine(fits, gaps.length),
          durationFrames + 20,
        ));
        if (passesFinalHardGates(det, contactFrames)) {
          const err = meanSectionAxisError(det, spec, gaps, fits);
          if (err + 1e-6 < bestErr && (best === null || err < best.err)) {
            best = {
              owner,
              lines: snapshotLines(plan.lines),
              err,
            };
          }
        }

        restoreLines(originals);
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

function sectionGrainFits(
  sec: Section,
  gaps: Gap[],
  fits: (GapFit | null)[],
): { owner: number; fit: GapFit }[] {
  const f0 = secToFrame(sec.t0);
  const f1 = secToFrame(sec.t1);
  const entries: { owner: number; fit: GapFit }[] = [];
  for (let owner = 0; owner < gaps.length; owner++) {
    const gap = gaps[owner];
    const fit = fits[owner];
    if (!gap.endsWithContact || fit === null) continue;
    if (gap.endFrame >= f0 && gap.endFrame <= f1) entries.push({ owner, fit });
  }
  return entries;
}

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
    if (!applyLengthDelta(originals, side, unitExtra)) {
      restoreLines(originals);
      continue;
    }
    const unitEffect = medianLineLength(fit) - before;
    restoreLines(originals);
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

function contactEdgeTrimCandidates(
  det: Detection,
): { lineId: number; side: "start" | "end"; fraction: number }[] {
  const candidates: { lineId: number; side: "start" | "end"; fraction: number }[] = [];
  const seen = new Set<string>();
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
    if (frame - rangeStart < 5) {
      inContact = false;
      rangeIds = new Set<number>();
      continue;
    }
    const sorted = [...rangeIds].sort((a, b) => a - b);
    for (const trim of CONTACT_EDGE_TRIMS) {
      const lineId = trim.edge === "start" ? sorted[0] : sorted.at(-1);
      if (lineId === undefined) continue;
      const key = `${lineId}:${trim.side}:${trim.fraction}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ lineId, side: trim.side, fraction: trim.fraction });
    }
    inContact = false;
    rangeIds = new Set<number>();
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
  for (const sec of spec.sections) {
    const f0 = secToFrame(sec.t0);
    const f1 = secToFrame(sec.t1);
    if (sec.air !== undefined) {
      const v = measureAxisOverRange(det, f0, f1, "air");
      if (v !== null) {
        total += Math.abs(sec.air - v);
        n++;
      }
    }
    if (sec.speed !== undefined) {
      const v = measureAxisOverRange(det, f0, f1, "speed");
      if (v !== null) {
        total += Math.abs(sec.speed - v);
        n++;
      }
    }
    if (sec.grain !== undefined) {
      const vals: number[] = [];
      for (let j = 0; j < gaps.length; j++) {
        const gap = gaps[j];
        const fit = fits[j];
        if (!gap.endsWithContact || fit === null) continue;
        if (gap.endFrame >= f0 && gap.endFrame <= f1) vals.push(measureFitGrain(fit));
      }
      if (vals.length > 0) {
        const achieved = vals.reduce((a, b) => a + b, 0) / vals.length;
        total += Math.abs(sec.grain - achieved);
        n++;
      }
    }
  }
  return n > 0 ? total / n : Infinity;
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

// Pure predicate also needed by the staying legacy pipeline in compile.ts.
// Duplicated here (private) to keep the core→compile dependency direction
// one-way, matching the A2/A3 precedent for shared pure helpers.
function isDenseContactSequence(contactFrames: number[], durationFrames: number): boolean {
  return contactFrames.length * FPS > durationFrames;
}

// ─────────── Engine rebuild (for backtracking / polish / final report) ───────────

// Engine-rebuild counter. `rebuildEngine` bumps it instead of touching
// compile's `stats` object; `compile()` reads/resets it via the accessors below
// to keep `stats.engine_rebuilds` reporting exactly as the legacy in-place
// counter did.
let engineRebuildCount = 0;

export function getEngineRebuildCount(): number {
  return engineRebuildCount;
}

export function resetEngineRebuildCount(): void {
  engineRebuildCount = 0;
}

/**
 * Reconstruct the engine state up to (but not including) gap index `upTo`,
 * by replaying all committed gap fits in time order. O(N) per call; fine for
 * v0 spec sizes. Cache if it becomes a bottleneck.
 *
 * Initial rider state comes from `currentStartState`, which `compile()` sets
 * for the duration of a single compile (see `resolveStartState`). Module-
 * scoped because the polish helpers that call `rebuildEngine` are top-level
 * and threading the state through every signature would be a large diff for
 * no behavioral benefit.
 */
// deno-lint-ignore no-explicit-any
export function rebuildEngine(fits: (GapFit | null)[], upTo: number): any {
  engineRebuildCount++;
  // deno-lint-ignore no-explicit-any
  const eng: any = makeBaseEngine(currentStartState);
  let chained = eng;
  for (let j = 0; j < upTo; j++) {
    const fit = fits[j];
    if (fit === null) continue;
    for (const line of fit.lines) {
      chained = chained.addLine(engineLineFromTrackLine(line));
    }
  }
  return chained;
}

// Set by `compile()` at the start of every call. Read by `rebuildEngine`.
// `compile()` is not reentrant (the engine instance pools already aren't),
// so a single module-scoped slot is safe.
let currentStartState: ResolvedStart = {
  position: { ...START_DEFAULTS.POSITION },
  velocity: { ...START_DEFAULTS.VELOCITY },
};

/** Prime the module-scoped start state that `rebuildEngine` (and the polish
 *  helpers that call it) read. `compile()` sets this internally; the standalone
 *  LDS optimizer (`compileLDS`), which no longer routes through `compile()`,
 *  must call this before its polish pass so polished variants rebuild engines
 *  from the spec's real start (start/preroll) rather than a stale default. */
export function setRebuildStartState(start: ResolvedStart): void {
  currentStartState = start;
}

/** Read the module-scoped start state `rebuildEngine` will use. Exposed so
 *  callers that temporarily override it (e.g. the LDS optimizer's polish pass)
 *  can save and restore it around their own rebuilds, keeping the override
 *  reentrancy-safe instead of leaving a stale value for the next compile. */
export function getRebuildStartState(): ResolvedStart {
  return currentStartState;
}
