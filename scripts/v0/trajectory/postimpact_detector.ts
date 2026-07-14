/**
 * Narrow detector boundary for post-impact trajectory experiments.
 *
 * This deliberately uses the canonical detector's raw extraction path rather
 * than the optimizer's candidate-window fast path. Post-impact studies need a
 * complete `Detection` (including positions, sled contacts, and summary), and
 * must not inherit compiler-only candidate semantics.
 */
import {
  detect,
  extractRawTrajectoryWindow,
  type Detection,
} from "../../lib/detector.ts";

/** A canonical detection together with the absolute frame of local index zero. */
export type PostimpactWindowDetection = Detection & {
  readonly frameOffset: number;
};

/**
 * Detect one inclusive absolute-frame window using only the shared detector.
 *
 * The offset deliberately matches the historical window contract: negative
 * starts clamp to zero, raw frame numbers remain absolute, and measurement
 * array index zero corresponds to `frameOffset`.
 */
export function detectPostimpactWindow(
  engine: Parameters<typeof extractRawTrajectoryWindow>[0],
  startFrame: number,
  endFrame: number,
): PostimpactWindowDetection {
  const frameOffset = Math.max(0, startFrame);
  const detection = detect(extractRawTrajectoryWindow(engine, frameOffset, endFrame));
  return { ...detection, frameOffset };
}
