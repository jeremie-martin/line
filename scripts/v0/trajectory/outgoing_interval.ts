/**
 * Explicit outgoing-interval contract for future support-envelope studies.
 *
 * This module intentionally derives no line geometry. Its job is to prevent
 * an envelope planner from conflating the current catch's axes with the axes
 * measured after that catch, or from silently mixing kinematic and scoring
 * frame conventions.
 */
import type { AxisValues, Gap } from "../types.ts";

export type OutgoingInterval = {
  gapIndex: number;
  startFrame: number;
  endFrame: number;
  /** Whether the physical interval ends at another authored event or the track tail. */
  endKind: "contact" | "tail";
  /** Elapsed frame intervals, used by kinematic calculations. */
  intervalFrames: number;
  /** Inclusive samples in the scorer's [startFrame, endFrame] window. */
  measurementSamples: number;
  /** Only axes explicitly present on the outgoing gap. */
  targets: AxisValues;
};

export type EnvelopeAirIntent = {
  /** Null means air was not authored and must not contribute a residual. */
  targetAir: number | null;
  /**
   * Informational detector requirement for a *single airborne arrival run*.
   * It is not imposed on the authored target: dense supported transitions may
   * intentionally have less air than a landing runway.
   */
  minimumAirborneSamples: number;
  /** The above requirement expressed in scorer-sample units. */
  minimumAirFraction: number;
  /**
   * Whether the authored average could contain that many samples in one
   * uninterrupted airborne run. Null means air is unspecified. This is a
   * diagnostic feasibility fact, never a replacement target.
   */
  authoredAirMeetsMinimumRun: boolean | null;
  /** Authored desired air count in inclusive scorer-sample units, never an observation. */
  nominalAirborneSamples: number | null;
  /** Desired air duration in elapsed inter-frame units, never an observation. */
  nominalAirborneIntervals: number | null;
  /** A kinematic support duration in elapsed inter-frame units, never an observation. */
  nominalSupportIntervals: number | null;
};

/** Materialize the physical interval after a contact from its owning gap. */
export function outgoingIntervalFromGap(gap: Gap): OutgoingInterval {
  const intervalFrames = gap.endFrame - gap.startFrame;
  if (!Number.isSafeInteger(intervalFrames) || intervalFrames < 0) {
    throw new Error(`invalid outgoing interval g${gap.index}: ${gap.startFrame}..${gap.endFrame}`);
  }
  return {
    gapIndex: gap.index,
    startFrame: gap.startFrame,
    endFrame: gap.endFrame,
    endKind: gap.endsWithContact ? "contact" : "tail",
    intervalFrames,
    measurementSamples: intervalFrames + 1,
    targets: explicitTargets(gap.targets),
  };
}

/**
 * Derive an air intent without inventing or modifying an author target. The
 * detector requirement is reported as a separate feasibility fact because a
 * dense supported transition and an airborne next-contact plan are both valid
 * physical regimes. Callers still need exact simulation to learn occupancy.
 */
export function envelopeAirIntent(
  interval: OutgoingInterval,
  minimumAirborneSamples: number,
): EnvelopeAirIntent {
  if (!Number.isSafeInteger(minimumAirborneSamples) || minimumAirborneSamples < 0) {
    throw new Error(`invalid minimumAirborneSamples=${minimumAirborneSamples}`);
  }
  const minimumAirFraction = Math.min(
    1,
    minimumAirborneSamples / Math.max(1, interval.measurementSamples),
  );
  const targetAir = interval.targets.air;
  if (targetAir === undefined) {
    return {
      targetAir: null,
      minimumAirborneSamples,
      minimumAirFraction,
      authoredAirMeetsMinimumRun: null,
      nominalAirborneSamples: null,
      nominalAirborneIntervals: null,
      nominalSupportIntervals: null,
    };
  }
  const nominalAirborneSamples = targetAir * interval.measurementSamples;
  // A contiguous run of N inclusive airborne samples spans N - 1 elapsed
  // intervals. Starting the outgoing interval at the current contact makes
  // this conversion explicit instead of treating scorer samples as time.
  const nominalAirborneIntervals = Math.max(0, nominalAirborneSamples - 1);
  return {
    targetAir,
    minimumAirborneSamples,
    minimumAirFraction,
    authoredAirMeetsMinimumRun: nominalAirborneSamples >= minimumAirborneSamples,
    nominalAirborneSamples,
    nominalAirborneIntervals,
    nominalSupportIntervals: Math.max(0, interval.intervalFrames - nominalAirborneIntervals),
  };
}

function explicitTargets(targets: AxisValues): AxisValues {
  return Object.fromEntries(Object.entries(targets).flatMap(([axis, value]) =>
    typeof value === "number" && Number.isFinite(value) ? [[axis, value]] : [],
  ));
}
