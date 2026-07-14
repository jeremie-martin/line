import { describe, expect, test } from "vitest";
import { IMPACT, IMPACT_WINDOW, REDIRARC, SPEED_RULER } from "../scripts/v0/types.ts";
import {
  realizeContactCaptureArc,
  resolveContactCaptureArc,
} from "../scripts/v0/trajectory/contact_capture_arc.ts";
import { makeMirroredContactCaptureArcScreen } from "../scripts/v0/trajectory/contact_capture_arc_design.ts";
import { contactKinematicFrameFromPlanningState } from "../scripts/v0/trajectory/contact_kinematic_frame.ts";
import {
  makeMirroredPostimpactCaptureArcScreen,
  postimpactContactKinematicFrameFromPlanningState,
  realizePostimpactCaptureArc,
  resolvePostimpactCaptureArc,
} from "../scripts/v0/trajectory/postimpact_capture_arc.ts";
import type { PostimpactImpactConvention } from "../scripts/v0/trajectory/postimpact_physics.ts";
import type { PlanningState } from "../scripts/v0/trajectory/state.ts";
import { targetFrameFromPlanningState } from "../scripts/v0/trajectory/target_frame.ts";

const ACTIVE_CONVENTION: Readonly<PostimpactImpactConvention> = Object.freeze({
  impactWindowFrames: IMPACT_WINDOW,
  catchableRedirFraction: IMPACT.CATCHABLE_REDIR_FRACTION,
  redirArcSoftPxPerFrame: REDIRARC.SOFT,
  redirArcVeryStrongPxPerFrame: REDIRARC.VERY_STRONG,
  speedRulerMinPxPerFrame: SPEED_RULER.MIN_PX_PER_FRAME,
  speedRulerMaxPxPerFrame: SPEED_RULER.MAX_PX_PER_FRAME,
});

function stateFor(input: {
  speed: number;
  headingDeg: number;
  referenceHeadingDeg: number;
  referenceSpeed: number;
}): PlanningState {
  const velocityRadians = input.headingDeg * Math.PI / 180;
  const referenceRadians = input.referenceHeadingDeg * Math.PI / 180;
  return {
    frame: 40,
    position: { x: 120, y: 240 },
    velocity: {
      x: input.speed * Math.cos(velocityRadians),
      y: input.speed * Math.sin(velocityRadians),
    },
    speed: input.speed,
    velocityAngleDeg: input.headingDeg,
    reference: { x: 126, y: 252 },
    referencePointName: "NOSE",
    referenceVelocity: {
      x: input.referenceSpeed * Math.cos(referenceRadians),
      y: input.referenceSpeed * Math.sin(referenceRadians),
    },
    sledPoseDeg: null,
    sledPoseRateDegPerFrame: null,
    points: {},
    phase: { contactNow: false, groundedAgeFrames: 0, airborneAgeFrames: 5 },
  };
}

describe("target-blind capture realization parity", () => {
  test("replays legacy kinematic requests, mirrored screens, and geometry under the sealed active convention", () => {
    const cases = [
      { speed: 3.25, headingDeg: -31, referenceHeadingDeg: -18, referenceSpeed: 3.4, impact: 0.12 },
      { speed: 7.5, headingDeg: 0, referenceHeadingDeg: 22, referenceSpeed: 7.2, impact: 0.5 },
      { speed: 12.8, headingDeg: 47, referenceHeadingDeg: 39, referenceSpeed: 13.1, impact: 0.83 },
      { speed: 21, headingDeg: 118, referenceHeadingDeg: 104, referenceSpeed: 20.4, impact: 1 },
    ] as const;

    for (const input of cases) {
      const state = stateFor(input);
      const anchor = targetFrameFromPlanningState(state);
      const legacyFrame = contactKinematicFrameFromPlanningState(state, anchor, { impact: input.impact });
      const blindFrame = postimpactContactKinematicFrameFromPlanningState(
        state,
        anchor,
        input.impact,
        ACTIVE_CONVENTION,
      );
      expect(blindFrame).toEqual(legacyFrame);

      const legacyScreen = makeMirroredContactCaptureArcScreen(legacyFrame);
      const blindScreen = makeMirroredPostimpactCaptureArcScreen(blindFrame);
      expect(blindScreen).toEqual(legacyScreen);

      for (let index = 0; index < legacyScreen.length; index++) {
        const legacyResolved = resolveContactCaptureArc(legacyFrame, legacyScreen[index]!.control);
        const blindResolved = resolvePostimpactCaptureArc(
          blindFrame,
          blindScreen[index]!.control,
          ACTIVE_CONVENTION,
        );
        expect(blindResolved).toEqual(legacyResolved);
        expect(realizePostimpactCaptureArc(blindResolved, 512)).toEqual(
          realizeContactCaptureArc(legacyResolved, 512),
        );
      }
    }
  });

  test("keeps an unspecified impact as a null request without inventing a local scale", () => {
    const state = stateFor({ speed: 8, headingDeg: 15, referenceHeadingDeg: 10, referenceSpeed: 8.2 });
    const anchor = targetFrameFromPlanningState(state);
    expect(postimpactContactKinematicFrameFromPlanningState(state, anchor, undefined, ACTIVE_CONVENTION)).toEqual(
      contactKinematicFrameFromPlanningState(state, anchor, { impact: undefined }),
    );
  });
});
