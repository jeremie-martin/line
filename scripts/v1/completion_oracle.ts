import { detect, extractRawTrajectory, type Detection } from "../lib/detector.ts";
import { scoreDriftReport } from "../v0/score.ts";
import { CALIB, FPS, secToFrame } from "./normalize.ts";
import {
  axisLookaheadEndFrame,
  contactLineIdsAt,
  measureAxes,
  measureFitGrain,
} from "./gap_evaluator.ts";
import type {
  CandidateKey,
  CompleteCandidate,
  ContactReport,
  DriftReport,
  NormalizedSpecContext,
  SectionAxes,
  SectionReport,
  TrackJson,
  TrackLine,
} from "./types.ts";
import type { GapFit } from "./search_state.ts";
import { rebuildEngineFromLines } from "./engine_adapter.ts";
import { canonicalTrackHash } from "./track_builder.ts";
import { CompileStatsBuilder } from "./stats.ts";
import { WorkMeter } from "./work_meter.ts";

type WindowDetection = Detection & { frameOffset?: number };

export function evaluateTrackJson(
  track: TrackJson,
  context: NormalizedSpecContext,
  candidateKey: CandidateKey,
  meter: WorkMeter,
  stats: CompileStatsBuilder,
  fits?: readonly (GapFit | null)[],
): CompleteCandidate {
  const start = {
    position: track.riders[0]?.startPosition ?? context.startState.position,
    velocity: track.riders[0]?.startVelocity ?? context.startState.velocity,
  };
  const engine = rebuildEngineFromLines(track.lines, start, meter, stats);
  const raw = extractRawTrajectory(engine.raw(), context.durationFrames + 20);
  stats.recordDetectorWindow(raw.frames.length);
  const detection = detect(raw);
  const report = buildDriftReport(detection, context, fits, track.lines);
  const score = scoreDriftReport(report, { totalFrames: context.durationFrames });

  return {
    track,
    report,
    score,
    foundAtWorkUnit: meter.unitsUsed,
    candidateKey,
    trackHash: canonicalTrackHash(track),
    rmsContactDrift: rmsContactDrift(report),
    ...(fits === undefined ? {} : { fits: cloneFits(fits) }),
  };
}

function cloneFits(fits: readonly (GapFit | null)[]): (GapFit | null)[] {
  return fits.map((fit) => fit === null
    ? null
    : {
      ...fit,
      lines: fit.lines.map((line) => ({ ...line })),
      achieved: { ...fit.achieved },
      candidateKey: { ...fit.candidateKey },
    });
}

export function buildDriftReport(
  det: Detection,
  context: NormalizedSpecContext,
  fits: readonly (GapFit | null)[] = [],
  trackLines?: readonly TrackLine[],
): DriftReport {
  const spec = context.originalSpec;
  const derivedAxes = trackLines === undefined
    ? []
    : deriveGapAxesFromTrack(det, context, trackLines);
  const contacts: ContactReport[] = spec.contacts.map((contact) => {
    const target = secToFrame(contact.t);
    const matched = det.events.find(
      (event) => event.type === "landing" && Math.abs(event.frame - target) <= 1,
    );
    if (matched) {
      return {
        t_target: contact.t,
        t_actual: matched.frame / FPS,
        frame_error: matched.frame - target,
        status: "hit",
      };
    }
    const near = det.events
      .filter((event) => event.type === "landing")
      .map((event) => ({ event, distance: Math.abs(event.frame - target) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (near && near.distance <= 5) {
      return {
        t_target: contact.t,
        t_actual: near.event.frame / FPS,
        frame_error: near.event.frame - target,
        status: "drift",
      };
    }
    return {
      t_target: contact.t,
      t_actual: null,
      frame_error: null,
      status: "missing",
    };
  });

  const sections: SectionReport[] = spec.sections.map((section, sectionIndex) => {
    const startFrame = secToFrame(section.t0);
    const endFrame = secToFrame(section.t1);
    const survived = det.terminus.frame >= endFrame || det.terminus.reason === "endOfSpec";
    const axes: SectionReport["axes"] = {};

    if (section.air !== undefined) {
      const achieved = measureAxisOverRange(det, startFrame, endFrame, "air");
      if (achieved !== null) {
        axes.air = {
          target: section.air,
          achieved,
          error: Math.abs(section.air - achieved),
        };
      }
    }
    if (section.speed !== undefined) {
      const achieved = measureAxisOverRange(det, startFrame, endFrame, "speed");
      if (achieved !== null) {
        axes.speed = {
          target: section.speed,
          achieved,
          error: Math.abs(section.speed - achieved),
        };
      }
    }
    if (section.grain !== undefined) {
      const values: number[] = [];
      for (let gapIndex = 0; gapIndex < context.gaps.length; gapIndex++) {
        const gap = context.gaps[gapIndex];
        const fit = fits[gapIndex];
        if (!gap.endsWithContact) continue;
        if (gap.endFrame >= startFrame && gap.endFrame <= endFrame) {
          const derived = derivedAxes[gapIndex]?.grain;
          if (derived !== undefined) values.push(derived);
          else if (fit !== undefined && fit !== null) values.push(measureFitGrain(fit));
        }
      }
      if (values.length > 0) {
        const achieved = values.reduce((sum, value) => sum + value, 0) / values.length;
        axes.grain = {
          target: section.grain,
          achieved,
          error: Math.abs(section.grain - achieved),
        };
      }
    }
    if (section.contact_style !== undefined) {
      const values: number[] = [];
      for (let gapIndex = 0; gapIndex < context.gaps.length; gapIndex++) {
        const gap = context.gaps[gapIndex];
        const fit = fits[gapIndex];
        if (!gap.endsWithContact) continue;
        if (gap.endFrame >= startFrame && gap.endFrame <= endFrame) {
          const value = derivedAxes[gapIndex]?.contact_style ?? fit?.achieved.contact_style;
          if (value !== undefined) values.push(value);
        }
      }
      if (values.length > 0) {
        const achieved = values.reduce((sum, value) => sum + value, 0) / values.length;
        axes.contact_style = {
          target: section.contact_style,
          achieved,
          error: Math.abs(section.contact_style - achieved),
        };
      }
    }

    return { section_index: sectionIndex, survived, axes };
  });

  const off_beat_landings = det.events
    .filter((event) => event.type === "landing"
      && !context.contactFrames.some((contactFrame) => Math.abs(contactFrame - event.frame) <= 1))
    .map((event) => ({ frame: event.frame }));

  return {
    contacts,
    sections,
    off_beat_landings,
    terminus: {
      frame: det.terminus.frame,
      reason: det.terminus.reason,
    },
  };
}

function deriveGapAxesFromTrack(
  det: Detection,
  context: NormalizedSpecContext,
  trackLines: readonly TrackLine[],
): (SectionAxes | null)[] {
  const byId = new Map<number, TrackLine>();
  for (const line of trackLines) byId.set(line.id, line);

  const out: (SectionAxes | null)[] = new Array(context.gaps.length).fill(null);
  let previousMaxLineId = 0;
  for (let gapIndex = 0; gapIndex < context.gaps.length; gapIndex++) {
    const gap = context.gaps[gapIndex];
    if (!gap.endsWithContact) continue;

    const contactIds = contactLineIdsNear(det, gap.endFrame)
      .filter((lineId) => lineId > previousMaxLineId && byId.has(lineId));
    if (contactIds.length === 0) continue;

    const maxLineId = Math.max(...contactIds);
    const gapLines = trackLines
      .filter((line) => line.id > previousMaxLineId && line.id <= maxLineId)
      .sort((a, b) => a.id - b.id);
    if (gapLines.length === 0) continue;

    out[gapIndex] = measureAxes(
      det,
      gap,
      gapLines,
      axisLookaheadEndFrame(gap, context.contactFrames),
    );
    previousMaxLineId = maxLineId;
  }
  return out;
}

function contactLineIdsNear(det: Detection, targetFrame: number): number[] {
  const out: number[] = [];
  for (let frame = targetFrame - 1; frame <= targetFrame + 1; frame++) {
    for (const lineId of contactLineIdsAt(det, frame)) {
      if (!out.includes(lineId)) out.push(lineId);
    }
  }
  return out.sort((a, b) => a - b);
}

function measureAxisOverRange(
  det: Detection,
  startFrame: number,
  endFrame: number,
  axis: "air" | "speed",
): number | null {
  const boundedEnd = Math.min(endFrame, measurementLastFrame(det));
  if (axis === "air") {
    let air = 0;
    let total = 0;
    for (let frame = startFrame; frame <= boundedEnd; frame++) {
      if (airborneAt(det, frame)) air++;
      total++;
    }
    return total > 0 ? air / total : null;
  }

  let sum = 0;
  let count = 0;
  for (let frame = startFrame; frame <= boundedEnd; frame++) {
    const speed = speedAt(det, frame);
    if (speed !== undefined) {
      sum += speed;
      count++;
    }
  }
  return count > 0 ? sum / count / CALIB.SPEED_CAP : null;
}

function rmsContactDrift(report: DriftReport): number {
  const landed = report.contacts.filter((contact) => contact.status !== "missing");
  if (landed.length === 0) return Infinity;
  const sum = landed.reduce((total, contact) => {
    const error = contact.frame_error ?? 0;
    return total + error * error;
  }, 0);
  return Math.sqrt(sum / landed.length);
}

function frameOffset(det: Detection): number {
  return (det as WindowDetection).frameOffset ?? 0;
}

function measurementIndex(det: Detection, frame: number): number {
  return frame - frameOffset(det);
}

function measurementLastFrame(det: Detection): number {
  return frameOffset(det) + det.measurements.airborne.length - 1;
}

function airborneAt(det: Detection, frame: number): boolean | undefined {
  const index = measurementIndex(det, frame);
  return index >= 0 ? det.measurements.airborne[index] : undefined;
}

function speedAt(det: Detection, frame: number): number | undefined {
  const index = measurementIndex(det, frame);
  return index >= 0 ? det.measurements.speed[index] : undefined;
}
