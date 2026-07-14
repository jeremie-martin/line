/**
 * Explicitly separated frozen inputs for post-impact studies.
 *
 * `currentContactForPostimpactStudy` is the only authored event input allowed
 * to reach capture construction. `postimpactObservationForStudy` deliberately
 * has a separate call site: callers must not create it until construction has
 * selected a phase. Neither adapter materializes a source spec or imports
 * optimizer policy.
 */
import type { AxisValues } from "../types.ts";
import type { FrozenTrajectoryFixture, FrozenTrajectoryFixtureV3 } from "./frozen_fixture.ts";

export type PostimpactCurrentContactInput = {
  gapIndex: number;
  startFrame: number;
  endFrame: number;
  intervalFrames: number;
  /** The current contact event only; no incoming/outgoing interval axes leak through. */
  impact: number;
};

export type PostimpactObservationInput = {
  outgoing: {
    gapIndex: number;
    startFrame: number;
    endFrame: number;
    intervalFrames: number;
    /**
     * Reporting-only post-selection interval axes. The endpoint impact is a
     * separate next event and is intentionally omitted.
     */
    axes: PostimpactNonEventAxes;
  };
  /** Used only to reject observed off-beat landings after phase selection. */
  authoredContactFrames: readonly number[];
};

export type PostimpactNonEventAxes = Pick<AxisValues, "air" | "speed" | "amplitude" | "elevation">;

/**
 * Read the selected current contact event without exposing the outgoing gap,
 * next impact, or any other authored target values.
 */
export function currentContactForPostimpactStudy(
  fixture: FrozenTrajectoryFixture,
): PostimpactCurrentContactInput {
  const stable = requireStableV3(fixture);
  const current = materializedGap(stable, stable.panel.selectedTargetGap, "current");
  if (!current.endsWithContact || current.endFrame !== stable.panel.currentFrame) {
    throw new Error("post-impact current contact does not match the frozen panel frame");
  }
  const intervalFrames = interval(current.startFrame, current.endFrame, "current contact");
  const impact = current.targets.impact;
  if (!Number.isFinite(impact) || !(impact > 0)) {
    throw new Error("post-impact capture requires a finite positive current impact target");
  }
  return {
    gapIndex: current.index,
    startFrame: current.startFrame,
    endFrame: current.endFrame,
    intervalFrames,
    impact,
  };
}

/**
 * Read post-selection observation availability. This adapter intentionally
 * does not read or return `nextImpact`; the next event is not part of this
 * local construction or measurement experiment.
 */
export function postimpactObservationForStudy(
  fixture: FrozenTrajectoryFixture,
): PostimpactObservationInput {
  const stable = requireStableV3(fixture);
  const current = materializedGap(stable, stable.panel.selectedTargetGap, "current");
  const outgoing = materializedGap(stable, stable.panel.outgoingGap, "outgoing");
  if (!current.endsWithContact || !outgoing.endsWithContact || outgoing.startFrame !== current.endFrame) {
    throw new Error("post-impact outgoing observation gap must be contiguous after the current contact");
  }
  if (outgoing.endFrame !== stable.panel.outgoingFrame) {
    throw new Error("post-impact outgoing observation frame does not match the frozen panel");
  }
  const intervalFrames = interval(outgoing.startFrame, outgoing.endFrame, "outgoing observation");
  if (intervalFrames !== stable.panel.outgoingIntervalFrames) {
    throw new Error("post-impact outgoing observation interval does not match the frozen panel");
  }
  const authoredContactFrames = checkedContactFrames(stable.materialized.contactFrames);
  return {
    outgoing: {
      gapIndex: outgoing.index,
      startFrame: outgoing.startFrame,
      endFrame: outgoing.endFrame,
      intervalFrames,
      axes: nonEventAxes(outgoing.targets),
    },
    authoredContactFrames,
  };
}

function nonEventAxes(targets: AxisValues): PostimpactNonEventAxes {
  const { air, speed, amplitude, elevation } = targets;
  return {
    ...(air === undefined ? {} : { air }),
    ...(speed === undefined ? {} : { speed }),
    ...(amplitude === undefined ? {} : { amplitude }),
    ...(elevation === undefined ? {} : { elevation }),
  };
}

function requireStableV3(fixture: FrozenTrajectoryFixture): FrozenTrajectoryFixtureV3 {
  if (fixture.schema !== "line.frozen-trajectory-prefix.v3" || !fixture.capture.identityCheck.stable) {
    throw new Error("post-impact study inputs require a stable V3 frozen fixture");
  }
  return fixture;
}

function materializedGap(
  fixture: FrozenTrajectoryFixtureV3,
  index: number,
  role: "current" | "outgoing",
): FrozenTrajectoryFixtureV3["materialized"]["gaps"][number] {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new Error(`post-impact ${role} gap index must be a non-negative safe integer`);
  }
  const gap = fixture.materialized.gaps[index];
  if (gap === undefined || gap.index !== index) {
    throw new Error(`post-impact ${role} materialized gap is missing or misindexed`);
  }
  return gap;
}

function interval(startFrame: number, endFrame: number, label: string): number {
  if (!Number.isSafeInteger(startFrame) || !Number.isSafeInteger(endFrame) || startFrame < 0 || endFrame <= startFrame) {
    throw new Error(`post-impact ${label} frames must be ordered non-negative safe integers`);
  }
  return endFrame - startFrame;
}

function checkedContactFrames(values: readonly number[]): readonly number[] {
  let previous = -1;
  const copied: number[] = [];
  for (const frame of values) {
    if (!Number.isSafeInteger(frame) || frame < 0 || frame <= previous) {
      throw new Error("post-impact authored contact frames must be strictly increasing non-negative safe integers");
    }
    copied.push(frame);
    previous = frame;
  }
  return copied;
}
