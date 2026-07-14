/**
 * Detector-only frame readers for post-impact replay leaves.
 *
 * These are intentionally copied from the broad substrate boundary rather
 * than imported from it: a target-blind construction leaf must not inherit
 * engine selection, compiler helpers, or `process` access merely to read a
 * completed detector window.
 */
import {
  MIN_LANDING_AIRBORNE_FRAMES,
  type Detection,
  type DetEvent,
} from "../../lib/detector.ts";

type OffsetDetection = Detection & { frameOffset?: number };

export function postimpactMeasurementLastFrame(detection: Detection): number {
  return postimpactFrameOffset(detection) + detection.measurements.airborne.length - 1;
}

export function postimpactContactLineIdsAt(detection: Detection, frame: number): number[] {
  const index = postimpactMeasurementIndex(detection, frame);
  return index >= 0 ? detection.measurements.contactLineIds[index] ?? [] : [];
}

export function postimpactAirborneAt(detection: Detection, frame: number): boolean | undefined {
  const index = postimpactMeasurementIndex(detection, frame);
  return index >= 0 ? detection.measurements.airborne[index] : undefined;
}

export function postimpactSpeedAt(detection: Detection, frame: number): number | undefined {
  const index = postimpactMeasurementIndex(detection, frame);
  return index >= 0 ? detection.measurements.speed[index] : undefined;
}

export function postimpactVelocityAt(
  detection: Detection,
  frame: number,
): { x: number; y: number } | undefined {
  const index = postimpactMeasurementIndex(detection, frame);
  return index >= 0 ? detection.measurements.velocity[index] : undefined;
}

export function postimpactPositionAt(
  detection: Detection,
  frame: number,
): { x: number; y: number } | undefined {
  const index = postimpactMeasurementIndex(detection, frame);
  return index >= 0 ? detection.measurements.position[index] : undefined;
}

export function postimpactIsAuthoredContactEvent(event: DetEvent, gapFrames: number): boolean {
  return event.type === "landing" ||
    (event.type === "bounce" && gapFrames <= MIN_LANDING_AIRBORNE_FRAMES);
}

export function postimpactOffBeatLandingEvents(
  detection: Detection,
  contactFrames: readonly number[],
): DetEvent[] {
  return detection.events.filter((event) =>
    event.type === "landing" && !contactFrames.some((frame) => Math.abs(frame - event.frame) <= 1)
  );
}

function postimpactFrameOffset(detection: Detection): number {
  return (detection as OffsetDetection).frameOffset ?? 0;
}

function postimpactMeasurementIndex(detection: Detection, frame: number): number {
  return frame - postimpactFrameOffset(detection);
}
