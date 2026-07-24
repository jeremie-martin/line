/**
 * Landing-window probe apparatus (study-only, off by default).
 *
 * Extracted out of the hot-path module core/candidate.ts (simplification catalog
 * item #79). Read-only diagnostic for the landing-redefinition / impact-funnel
 * studies: for every candidate that passes the survival gate, compute the minimal
 * acceptance half-width W ∈ [1, LANDING_PROBE_MAX_W] at which the candidate would
 * be admitted if BOTH timing rules widened in lockstep (a landing on an owned line
 * within ±W of the beat AND zero off-beat landings at tolerance W). W=1 reproduces
 * today's hard gates exactly.
 *
 * The apparatus installs itself into core/candidate.ts through the single
 * `setLandingProbeHook` seam (candidate.ts never imports this module). When no
 * study has enabled it — always, in production — candidate.ts's hook is null and
 * compiles are byte-identical. Consumers: study_landing_window.ts,
 * study_impact_funnel.ts.
 */
import {
  countOffBeatLandings,
  intersectsLineIds,
  setLandingProbeHook,
  type LandingProbeHook,
} from "./core/candidate.ts";
import { redirArcPxAtLanding, speedAt } from "./core/substrate.ts";
import { normImpact, type AxisValues, type Gap, type TrackLine } from "./types.ts";
import { wasLastGeometryImpactTemplate } from "./arc_placement.ts";
import type { Detection, DetEvent } from "../lib/detector.ts";

export const LANDING_PROBE_MAX_W = 5;
const LANDING_PROBE_RECORD_CAP = 1_000_000;

export type LandingWindowProbeRecord = {
  gapIndex: number;
  endFrame: number;
  /** Authored per-beat impact target of this gap, if any. */
  targetImpact?: number;
  /** Candidate-arc geometry (from its lines, independent of simulation):
   *  entry tangent angle (deg, positive = descending) and total signed turn
   *  (deg, negative = scooping/flattening). Funnel-study fields. */
  entryAngleDeg: number | null;
  turnDeg: number | null;
  /** Set when the candidate died at the survival gate (rider didn't live to
   *  endFrame + margin) — such records carry geometry but no landing data. */
  failure?: "survival";
  /** Minimal lockstep half-width that admits the candidate; null if none ≤ MAX_W. */
  acceptedAtW: number | null;
  /** Signed landing offset (landingFrame − endFrame) at that W; null if rejected. */
  offset: number | null;
  /** Achieved impact (redirArc = v·Δθ → normImpact, felt [0,1]) at that landing. */
  impactAchieved: number | null;
  /** Incoming speed (px/frame) one frame before that landing. */
  incomingSpeed: number | null;
  /** True if the geometry came from an impact template lane. */
  isTemplate: boolean;
  /** Final axisCost of the candidate; null if it failed a hard gate. */
  cost: number | null;
  /** Candidate-local axes on the canonical scorer-owned interval. */
  achieved?: AxisValues;
  /** Handoff ranking score (lower = better; −forwardArcValue at ≥75k, else the
   *  composite local score). Attached by scoreCandidateForHandoff when probing. */
  handoffScore?: number;
};

/** lines-array → probe record, so the handoff ranker can attach its score to the
 *  record for the same candidate (object identity survives evaluateGapFit→Candidate). */
const landingProbeByLines = new WeakMap<object, LandingWindowProbeRecord>();

let landingProbeRecords: LandingWindowProbeRecord[] | null = null;
let landingProbeDropped = 0;

/** The seam object installed into core/candidate.ts. Its methods run only while a
 *  study has enabled the probe (`landingProbeRecords !== null`). */
const LANDING_PROBE_HOOK: LandingProbeHook = {
  onSurvivalFailure(gap, lines) {
    probeSurvivalFailure(gap, lines);
  },
  onLandingWindow(det, gap, lines, allContactFrames, axisMeasureEnd) {
    return probeLandingWindow(det, gap, lines, allContactFrames, axisMeasureEnd);
  },
  onHandoffScore(lines, score) {
    if (landingProbeRecords === null) return;
    const rec = landingProbeByLines.get(lines);
    if (rec !== undefined && rec.handoffScore === undefined) rec.handoffScore = score;
  },
};

export function enableLandingWindowProbe(): void {
  landingProbeRecords = [];
  landingProbeDropped = 0;
  setLandingProbeHook(LANDING_PROBE_HOOK);
}

export function disableLandingWindowProbe(): void {
  landingProbeRecords = null;
  landingProbeDropped = 0;
  setLandingProbeHook(null);
}

/** Drain accumulated records (caller owns the array); probe stays enabled. */
export function drainLandingWindowProbe(): { records: LandingWindowProbeRecord[]; dropped: number } {
  const records = landingProbeRecords ?? [];
  const dropped = landingProbeDropped;
  if (landingProbeRecords !== null) landingProbeRecords = [];
  landingProbeDropped = 0;
  return { records, dropped };
}

/** Entry tangent + total signed turn of a candidate's line chain (degrees;
 *  positive entry = descending, negative turn = scoop). Probe-only — never on
 *  the production hot path. */
function probeArcAngles(lines: TrackLine[]): { entryAngleDeg: number | null; turnDeg: number | null } {
  let entry: number | null = null;
  let prev: number | null = null;
  let turn = 0;
  for (const l of lines) {
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    if (dx === 0 && dy === 0) continue;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (entry === null) entry = angle;
    if (prev !== null) {
      let d = (angle - prev) % 360;
      if (d > 180) d -= 360;
      if (d <= -180) d += 360;
      turn += d;
    }
    prev = angle;
  }
  return { entryAngleDeg: entry, turnDeg: entry === null ? null : turn };
}

/** Record a survival-gate death (probe only): geometry is known, landing data is not. */
function probeSurvivalFailure(gap: Gap, lines: TrackLine[]): void {
  if (landingProbeRecords === null) return;
  if (landingProbeRecords.length >= LANDING_PROBE_RECORD_CAP) {
    landingProbeDropped++;
    return;
  }
  landingProbeRecords.push({
    gapIndex: gap.index,
    endFrame: gap.endFrame,
    ...(gap.targets.impact === undefined ? {} : { targetImpact: gap.targets.impact }),
    ...probeArcAngles(lines),
    failure: "survival",
    acceptedAtW: null,
    offset: null,
    impactAchieved: null,
    incomingSpeed: null,
    isTemplate: wasLastGeometryImpactTemplate(),
    cost: null,
  });
}

function probeLandingWindow(
  det: Detection,
  gap: Gap,
  lines: TrackLine[],
  allContactFrames: number[],
  axisMeasureEnd: number,
): LandingWindowProbeRecord | null {
  if (landingProbeRecords === null) return null;
  if (landingProbeRecords.length >= LANDING_PROBE_RECORD_CAP) {
    landingProbeDropped++;
    return null;
  }
  const owned = new Set(lines.map((l) => l.id));
  let acceptedAtW: number | null = null;
  let chosen: DetEvent | null = null;
  for (let w = 1; w <= LANDING_PROBE_MAX_W; w++) {
    let best: DetEvent | null = null;
    for (const e of det.events) {
      if (e.type !== "landing") continue;
      const d = Math.abs(e.frame - gap.endFrame);
      if (d > w) continue;
      if (!intersectsLineIds(e, det, owned)) continue;
      if (best === null || d < Math.abs(best.frame - gap.endFrame)) best = e;
    }
    if (best === null) continue;
    if (countOffBeatLandings(det.events, gap.startFrame, axisMeasureEnd, allContactFrames, w) > 0) {
      continue;
    }
    acceptedAtW = w;
    chosen = best;
    break;
  }
  const impactPx = chosen === null ? undefined : redirArcPxAtLanding(det, chosen.frame);
  const incomingSpeed = chosen === null
    ? undefined
    : (speedAt(det, chosen.frame - 1) ?? speedAt(det, chosen.frame));
  const record: LandingWindowProbeRecord = {
    gapIndex: gap.index,
    endFrame: gap.endFrame,
    ...(gap.targets.impact === undefined ? {} : { targetImpact: gap.targets.impact }),
    ...probeArcAngles(lines),
    acceptedAtW,
    offset: chosen === null ? null : chosen.frame - gap.endFrame,
    impactAchieved: impactPx === undefined ? null : normImpact(impactPx),
    incomingSpeed: incomingSpeed ?? null,
    isTemplate: wasLastGeometryImpactTemplate(),
    cost: null,
  };
  landingProbeRecords.push(record);
  landingProbeByLines.set(lines, record);
  return record;
}
