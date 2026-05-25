/**
 * v0 compiler — per-gap budget compilation.
 *
 * See ../../DESIGN.md § Per-gap budget compilation for the algorithm.
 * See ../../DECISIONS.md for the reasoning.
 *
 * Pipeline per call:
 *   1. Slice timeline into gaps at hard Contacts.
 *   2. Compute per-gap targets (cross-gap target sampling around section means).
 *   3. For each gap (head → tail), generate K candidate Arc placements via
 *      wide random parameter sampling; bisect anchor Y for Contact precision;
 *      filter by hard gate (survival, Contact ±1f, no off-beat landings);
 *      rank survivors by aggregate axis cost; commit the best.
 *   4. Assemble Track + DriftReport.
 *
 * v0 simplifications (flagged in code):
 *   - Exactly one Arc per gap, anchored near the end-Contact's predicted
 *     rider position. Multi-Arc gap sequences deferred.
 *   - Cross-gap backtracking is a stub (records hard failure and continues
 *     with the engine state after the previous successful gap). Bounded
 *     backtrack is the v0.1 enrichment.
 */

import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import {
  detect, extractRawTrajectory,
  type Detection, type DetEvent, type RawTrajectory,
} from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import { arcToLines } from "./arc.ts";
import type { TrackJson } from "../lib/primitive.ts";
import {
  type Spec, type Section, type SectionAxes,
  type Arc, type TrackLine, type DriftReport, type Gap,
  type ContactReport, type SectionReport,
  CALIB, FPS, secToFrame,
} from "./types.ts";

export type CompileResult = {
  track: TrackJson;
  report: DriftReport;
};

export function compile(spec: Spec, seed = 0): CompileResult {
  validateSpec(spec);

  const rng = makeRng(seed);
  const durationFrames = secToFrame(spec.duration);
  const contactFrames = [...spec.contacts]
    .map((c) => secToFrame(c.t))
    .sort((a, b) => a - b);

  // 1 + 2. Slice and target-sample.
  const gaps = sliceTimeline(contactFrames, durationFrames);
  for (const gap of gaps) {
    const sec = effectiveAxes(gap, spec);
    gap.targets = sampleGapTargets(sec, CALIB.SIGMA, rng);
  }

  // 3. Compile each gap.
  // deno-lint-ignore no-explicit-any
  let engine: any = new LineRiderEngine();
  const allLines: TrackLine[] = [];
  let nextLineId = 1;
  const gapFailures: number[] = []; // indices of gaps that failed hard gate

  for (const gap of gaps) {
    if (!gap.endsWithContact) {
      // Head gap or tail gap: no end-Contact to bisect against → no Arc.
      // The rider's trajectory through these gaps falls out of physics.
      continue;
    }
    const fit = compileGap(engine, gap, rng, nextLineId, contactFrames);
    if (fit === null) {
      gapFailures.push(gap.index);
      continue;
    }
    allLines.push(...fit.lines);
    nextLineId += fit.lines.length;
    for (const line of fit.lines) {
      engine = engine.addLine(createLineFromJson(line));
    }
  }

  // 4. Final full-track simulation to populate the DriftReport.
  const finalRaw = extractRawTrajectory(engine, durationFrames + 20);
  const finalDet = detect(finalRaw);

  const track = buildTrackJson(allLines, durationFrames + 20);
  const report = buildDriftReport(
    finalDet, spec, gaps, contactFrames, durationFrames, gapFailures,
  );

  return { track, report };
}

// ─────────── Timeline slicing ───────────

function sliceTimeline(contactFrames: number[], durationFrames: number): Gap[] {
  const gaps: Gap[] = [];
  let idx = 0;
  let cursor = 0;
  for (const cf of contactFrames) {
    gaps.push({
      index: idx++,
      startFrame: cursor,
      endFrame: cf,
      endsWithContact: true,
      targets: {},
    });
    cursor = cf;
  }
  // Tail gap
  if (cursor < durationFrames) {
    gaps.push({
      index: idx,
      startFrame: cursor,
      endFrame: durationFrames,
      endsWithContact: false,
      targets: {},
    });
  }
  return gaps;
}

// ─────────── Per-gap effective axes ───────────

/**
 * Walk the spec's sections in declaration order; last-defined wins per axis
 * for sections overlapping the gap's midpoint. Falls back to defaults.
 *
 * Using the gap's midpoint is a v0 simplification — sections that only
 * partially cover a gap will be evaluated by what's at the midpoint. v0.1
 * may refine to time-weighted averaging if real specs require it.
 */
function effectiveAxes(gap: Gap, spec: Spec): SectionAxes {
  const midSec = (gap.startFrame + gap.endFrame) / 2 / FPS;
  const axes: SectionAxes = { ...(spec.defaults ?? {}) };
  for (const sec of spec.sections) {
    if (sec.t0 > midSec || sec.t1 < midSec) continue;
    if (sec.air !== undefined) axes.air = sec.air;
    if (sec.speed !== undefined) axes.speed = sec.speed;
    if (sec.contact_style !== undefined) axes.contact_style = sec.contact_style;
    if (sec.grain !== undefined) axes.grain = sec.grain;
  }
  return axes;
}

// ─────────── Cross-gap target sampling ───────────

function sampleGapTargets(
  section: SectionAxes,
  sigma: number,
  rng: () => number,
): SectionAxes {
  const out: SectionAxes = {};
  if (section.air !== undefined)           out.air = clamp(gauss(rng, section.air, sigma), 0, 0.99);
  if (section.speed !== undefined)         out.speed = clamp(gauss(rng, section.speed, sigma), 0, 1);
  if (section.contact_style !== undefined) out.contact_style = clamp(gauss(rng, section.contact_style, sigma), 0, 1);
  if (section.grain !== undefined)         out.grain = clamp(gauss(rng, section.grain, sigma), 0, 1);
  return out;
}

/** Box-Muller Gaussian; mean μ, stdev σ. */
function gauss(rng: () => number, mu: number, sigma: number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + z * sigma;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// ─────────── Per-gap compilation ───────────

type GapFit = {
  arc: Arc;
  lines: TrackLine[];
  /** Achieved axis values for this gap (for the DriftReport). */
  achieved: SectionAxes;
  /** Aggregate axis cost (lower = better fit). */
  cost: number;
};

function compileGap(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  rng: () => number,
  lineIdStart: number,
  allContactFrames: number[],
): GapFit | null {
  // Predict rider position at gap.endFrame WITHOUT placing any new Arc.
  const horizon = gap.endFrame + 20;
  const rawNoArc = extractRawTrajectory(baseEngine, horizon);
  if (gap.endFrame >= rawNoArc.frames.length) {
    return null; // engine ended before gap.endFrame — rider's already dead
  }
  const refFrame = rawNoArc.frames[gap.endFrame];
  if (!refFrame) return null;
  const refX = refFrame.position.x;
  const refY = refFrame.position.y;

  let best: GapFit | null = null;

  for (let attempt = 0; attempt < CALIB.K; attempt++) {
    const cand = sampleArcParams(rng, refX, refY, gap.targets);
    const fit = tryCandidate(
      baseEngine, gap, cand, lineIdStart, allContactFrames,
    );
    if (fit === null) continue;
    if (best === null || fit.cost < best.cost) best = fit;
  }

  return best;
}

function sampleArcParams(
  rng: () => number, refX: number, refY: number, targets: SectionAxes,
): Arc {
  const A = CALIB.ARC;
  // Wide uniform sampling within parameter bounds. Anchor X is offset around
  // the predicted rider x at landing frame; anchor Y is a STARTING value that
  // will be bisected for Contact precision.
  const lengthRange = A.LENGTH_MAX - A.LENGTH_MIN;
  let length = A.LENGTH_MIN + rng() * lengthRange;
  // If `grain` is targeted, bias the length distribution toward the target's
  // implied range (a coarse heuristic — grain measures median line length,
  // i.e. length / segments).
  if (targets.grain !== undefined) {
    const targetLen = targets.grain * CALIB.LINE_LENGTH_CAP * (4 + Math.floor(rng() * 4));
    length = (length + targetLen) / 2;
  }
  const segments = A.SEGMENTS_MIN + Math.floor(rng() * (A.SEGMENTS_MAX - A.SEGMENTS_MIN + 1));

  const startAngleDeg = A.START_ANGLE_MIN_DEG
    + rng() * (A.START_ANGLE_MAX_DEG - A.START_ANGLE_MIN_DEG);
  const endAngleDeg = A.END_ANGLE_MIN_DEG
    + rng() * (A.END_ANGLE_MAX_DEG - A.END_ANGLE_MIN_DEG);
  const curveBias = -1 + 2 * rng();

  const anchorXOffset = A.ANCHOR_X_OFFSET_MIN
    + rng() * (A.ANCHOR_X_OFFSET_MAX - A.ANCHOR_X_OFFSET_MIN);
  const anchorYOffset = A.ANCHOR_Y_OFFSET_MIN
    + rng() * (A.ANCHOR_Y_OFFSET_MAX - A.ANCHOR_Y_OFFSET_MIN);

  return {
    anchor: { x: refX - length / 2 + anchorXOffset, y: refY + anchorYOffset },
    length,
    startAngleDeg,
    endAngleDeg,
    segments,
    curveBias,
  };
}

function tryCandidate(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  candArc: Arc,
  lineIdStart: number,
  allContactFrames: number[],
): GapFit | null {
  // Bisect anchor Y for Contact precision.
  const bisected = bisectAnchorY(
    baseEngine, candArc, gap.endFrame, lineIdStart,
  );
  if (bisected === null) return null;

  // Run hard gate + axis measurement.
  // deno-lint-ignore no-explicit-any
  let eng: any = baseEngine;
  for (const line of bisected.lines) eng = eng.addLine(createLineFromJson(line));
  const horizon = gap.endFrame + 20;
  const raw = extractRawTrajectory(eng, horizon);
  const det = detect(raw);

  // Hard gate 1: rider survived to gap.endFrame + SURVIVAL_MARGIN.
  // Surviving exactly the landing frame isn't enough — many randomly-sampled
  // catch geometries eject the rider on the next frame. Require the rider to
  // remain alive long enough to plausibly bridge into the next gap.
  const SURVIVAL_MARGIN = 16;
  const minSurvival = gap.endFrame + SURVIVAL_MARGIN;
  if (det.terminus.frame < minSurvival && det.terminus.reason !== "endOfSpec") return null;
  // Hard gate 2: a landing event near gap.endFrame ±1.
  const landingNearTarget = det.events.some(
    (e) => e.type === "landing"
      && Math.abs(e.frame - gap.endFrame) <= 1
      && intersectsLineIds(e, det, new Set(bisected.lines.map((l) => l.id))),
  );
  if (!landingNearTarget) return null;
  // Hard gate 3: no off-beat landings in [gap.startFrame, gap.endFrame].
  const offBeat = countOffBeatLandings(
    det.events, gap.startFrame, gap.endFrame, allContactFrames,
  );
  if (offBeat > 0) return null;

  const achieved = measureAxes(det, gap, bisected.lines);
  const cost = axisCost(gap.targets, achieved);

  return { arc: bisected.arc, lines: bisected.lines, achieved, cost };
}

// ─────────── Bisection: adjust anchor Y so the landing fires AT gap.endFrame ───────────

/**
 * Bisect Arc.anchor.y so that, when the Arc is added to the engine, a landing
 * event attributable to the Arc's lines fires at gap.endFrame ±1.
 *
 * Direction: larger Y → line lower → rider hits LATER. (World Y increases
 * downward in the engine's coordinate frame.)
 *
 * Falls back to coarse grid search if bisection diverges (non-monotone region).
 * Returns null if neither converges.
 */
function bisectAnchorY(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  baseArc: Arc,
  targetFrame: number,
  lineIdStart: number,
): { arc: Arc; lines: TrackLine[] } | null {
  const SEARCH_RADIUS = 14;
  const MAX_ITERS = 18;

  const evalAt = (y: number): { frame: number | null; arc: Arc; lines: TrackLine[] } => {
    const arc: Arc = { ...baseArc, anchor: { x: baseArc.anchor.x, y } };
    const lines = arcToLines(arc, lineIdStart);
    // deno-lint-ignore no-explicit-any
    let eng: any = baseEngine;
    for (const line of lines) eng = eng.addLine(createLineFromJson(line));
    const raw = extractRawTrajectory(eng, targetFrame + 6);
    const det = detect(raw);
    const owned = new Set(lines.map((l) => l.id));
    const landing = det.events.find(
      (e) => e.type === "landing"
        && Math.abs(e.frame - targetFrame) <= SEARCH_RADIUS
        && intersectsLineIds(e, det, owned),
    );
    return { frame: landing ? landing.frame : null, arc, lines };
  };

  let lo = baseArc.anchor.y - SEARCH_RADIUS;
  let hi = baseArc.anchor.y + SEARCH_RADIUS;
  let bestRes = evalAt(baseArc.anchor.y);
  let bestErr = bestRes.frame !== null ? Math.abs(bestRes.frame - targetFrame) : Infinity;

  for (let i = 0; i < MAX_ITERS; i++) {
    const mid = (lo + hi) / 2;
    const r = evalAt(mid);
    if (r.frame !== null) {
      const err = Math.abs(r.frame - targetFrame);
      if (err < bestErr) { bestErr = err; bestRes = r; }
      if (err <= 1) return { arc: r.arc, lines: r.lines };
      if (r.frame > targetFrame) hi = mid; else lo = mid;
    } else {
      // No landing detected at this Y — line too far away. Move toward "closer".
      lo = mid;
    }
    if (hi - lo < 0.05) break;
  }

  // Coarse grid fallback if bisection didn't converge to ±1.
  if (bestErr > 1) {
    const STEPS = 16;
    for (let i = 0; i <= STEPS; i++) {
      const y = baseArc.anchor.y - SEARCH_RADIUS + (2 * SEARCH_RADIUS * i) / STEPS;
      const r = evalAt(y);
      if (r.frame !== null) {
        const err = Math.abs(r.frame - targetFrame);
        if (err < bestErr) { bestErr = err; bestRes = r; }
        if (err <= 1) return { arc: r.arc, lines: r.lines };
      }
    }
  }

  return bestErr <= 1 ? { arc: bestRes.arc, lines: bestRes.lines } : null;
}

// ─────────── Hard-gate helpers ───────────

function intersectsLineIds(
  event: DetEvent, det: Detection, owned: Set<number>,
): boolean {
  const lids = det.measurements.contactLineIds[event.frame] ?? [];
  return lids.some((id) => owned.has(id));
}

function countOffBeatLandings(
  events: DetEvent[], startFrame: number, endFrame: number,
  contactFrames: number[],
): number {
  let n = 0;
  for (const e of events) {
    if (e.type !== "landing") continue;
    if (e.frame < startFrame || e.frame > endFrame) continue;
    const nearAnyContact = contactFrames.some((cf) => Math.abs(cf - e.frame) <= 1);
    if (!nearAnyContact) n++;
  }
  return n;
}

// ─────────── Axis measurement ───────────

function measureAxes(
  det: Detection, gap: Gap, gapLines: TrackLine[],
): SectionAxes {
  const out: SectionAxes = {};
  const a = gap.startFrame;
  const b = Math.min(gap.endFrame, det.measurements.airborne.length - 1);

  // air
  let airFrames = 0, total = 0;
  for (let f = a; f <= b; f++) {
    if (det.measurements.airborne[f]) airFrames++;
    total++;
  }
  if (total > 0) out.air = airFrames / total;

  // speed
  let speedSum = 0, speedCount = 0;
  for (let f = a; f <= b; f++) {
    const s = det.measurements.speed[f];
    if (s !== undefined) { speedSum += s; speedCount++; }
  }
  if (speedCount > 0) out.speed = speedSum / speedCount / CALIB.SPEED_CAP;

  // contact_style — per-contact traversed / segment length, averaged.
  // For v0's single-Arc-per-gap, this reduces to: how many frames did the
  // rider stay in contact with this Arc, scaled by the per-line traversal
  // implied by velocity × frames vs line length. Approximation: count the
  // contiguous in-contact frames immediately following gap.endFrame and
  // divide by the median line length / mean speed (rough).
  const lineLens = gapLines.map((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
  const medianLen = median(lineLens);
  if (medianLen > 0) {
    let contactFramesAtArc = 0;
    for (let f = gap.endFrame; f < det.measurements.airborne.length; f++) {
      if (!det.measurements.airborne[f]) contactFramesAtArc++;
      else break;
    }
    const meanSpeed = (out.speed ?? 0) * CALIB.SPEED_CAP || 1;
    const traversed = meanSpeed * contactFramesAtArc;
    out.contact_style = Math.min(1, traversed / medianLen);
  }

  // grain
  if (lineLens.length > 0) {
    out.grain = Math.min(1, median(lineLens) / CALIB.LINE_LENGTH_CAP);
  }

  return out;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function axisCost(target: SectionAxes, achieved: SectionAxes): number {
  let cost = 0;
  for (const key of ["air", "speed", "contact_style", "grain"] as const) {
    const t = target[key];
    const a = achieved[key];
    if (t !== undefined && a !== undefined) cost += Math.abs(t - a);
  }
  return cost;
}

// ─────────── Spec validation ───────────

function validateSpec(spec: Spec): void {
  if (spec.duration <= 0) throw new Error("Spec.duration must be > 0");
  for (const c of spec.contacts) {
    if (c.t < 0 || c.t > spec.duration) {
      throw new Error(`Contact.t (${c.t}) out of [0, ${spec.duration}]`);
    }
  }
  for (const s of spec.sections) {
    if (s.t0 < 0 || s.t1 > spec.duration || s.t0 >= s.t1) {
      throw new Error(`Section [${s.t0}, ${s.t1}] invalid for duration ${spec.duration}`);
    }
    if (s.air !== undefined && (s.air < 0 || s.air > 0.99)) {
      throw new Error(`Section.air (${s.air}) out of [0, 0.99]`);
    }
    for (const k of ["speed", "contact_style", "grain"] as const) {
      const v = s[k];
      if (v !== undefined && (v < 0 || v > 1)) {
        throw new Error(`Section.${k} (${v}) out of [0, 1]`);
      }
    }
  }
}

// ─────────── Track JSON assembly ───────────

function buildTrackJson(lines: TrackLine[], durationFrames: number): TrackJson {
  return {
    label: "v0",
    creator: "line/v0",
    description: "v0 compiler output",
    duration: durationFrames,
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
    lines,
  };
}

// ─────────── DriftReport assembly ───────────

function buildDriftReport(
  det: Detection, spec: Spec, gaps: Gap[],
  contactFrames: number[], durationFrames: number,
  gapFailures: number[],
): DriftReport {
  const contacts: ContactReport[] = spec.contacts.map((c) => {
    const target = secToFrame(c.t);
    const matched = det.events.find(
      (e) => e.type === "landing" && Math.abs(e.frame - target) <= 1,
    );
    if (matched) {
      return { t_target: c.t, t_actual: matched.frame / FPS, frame_error: matched.frame - target, status: "hit" };
    }
    // No tight match — find nearest landing within 5 frames (drift) or report missing.
    const near = det.events
      .filter((e) => e.type === "landing")
      .map((e) => ({ e, d: Math.abs(e.frame - target) }))
      .sort((a, b) => a.d - b.d)[0];
    if (near && near.d <= 5) {
      return { t_target: c.t, t_actual: near.e.frame / FPS, frame_error: near.e.frame - target, status: "drift" };
    }
    return { t_target: c.t, t_actual: null, frame_error: null, status: "missing" };
  });

  const sections: SectionReport[] = spec.sections.map((sec, i) => {
    const f0 = secToFrame(sec.t0);
    const f1 = secToFrame(sec.t1);
    const survived = det.terminus.frame >= f1
      || det.terminus.reason === "endOfSpec";
    const achieved: SectionReport["axes"] = {};
    for (const k of ["air", "speed", "contact_style", "grain"] as const) {
      const t = sec[k];
      if (t === undefined) continue;
      const av = measureAxisOverRange(det, f0, f1, k);
      if (av !== null) achieved[k] = { target: t, achieved: av, error: Math.abs(t - av) };
    }
    return { section_index: i, survived, axes: achieved };
  });

  const off_beat_landings = det.events
    .filter((e) => e.type === "landing"
      && !contactFrames.some((cf) => Math.abs(cf - e.frame) <= 1))
    .map((e) => ({ frame: e.frame }));

  return {
    contacts,
    sections,
    off_beat_landings,
    terminus: { frame: det.terminus.frame, reason: det.terminus.reason },
  };
}

function measureAxisOverRange(
  det: Detection, f0: number, f1: number,
  axis: "air" | "speed" | "contact_style" | "grain",
): number | null {
  const b = Math.min(f1, det.measurements.airborne.length - 1);
  if (axis === "air") {
    let air = 0, total = 0;
    for (let f = f0; f <= b; f++) {
      if (det.measurements.airborne[f]) air++;
      total++;
    }
    return total > 0 ? air / total : null;
  }
  if (axis === "speed") {
    let sum = 0, n = 0;
    for (let f = f0; f <= b; f++) {
      const s = det.measurements.speed[f];
      if (s !== undefined) { sum += s; n++; }
    }
    return n > 0 ? sum / n / CALIB.SPEED_CAP : null;
  }
  // contact_style and grain require per-line / per-contact analysis at section
  // granularity — deferred to v0.1 as not load-bearing for the first milestone.
  // TODO: implement section-level measurement of these axes.
  return null;
}
