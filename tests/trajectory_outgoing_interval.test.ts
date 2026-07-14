import { describe, expect, test } from "vitest";
import {
  envelopeAirIntent,
  outgoingIntervalFromGap,
} from "../scripts/v0/trajectory/outgoing_interval.ts";
import type { Gap } from "../scripts/v0/types.ts";
import {
  detect,
  MIN_LANDING_AIRBORNE_FRAMES,
  type RawTrajectory,
} from "../scripts/lib/detector.ts";

function gap(startFrame: number, endFrame: number, targets: Gap["targets"]): Gap {
  return { index: 4, startFrame, endFrame, endsWithContact: true, targets };
}

describe("outgoing interval contract", () => {
  test("keeps kinematic frame duration distinct from scorer samples", () => {
    const interval = outgoingIntervalFromGap(gap(300, 600, { air: 0.2, speed: 0.7 }));
    expect(interval.intervalFrames).toBe(300);
    expect(interval.measurementSamples).toBe(301);
  });

  test("retains a terminal physical interval as a labelled tail", () => {
    const tail = outgoingIntervalFromGap({
      ...gap(0, 20, { air: 0.2 }),
      endsWithContact: false,
    });
    expect(tail.endKind).toBe("tail");
    expect(tail.intervalFrames).toBe(20);
  });

  test("uses the outgoing gap's authored air without manufacturing one", () => {
    const authored = outgoingIntervalFromGap(gap(30, 90, { air: 0.1 }));
    const absent = outgoingIntervalFromGap(gap(30, 90, { speed: 0.8 }));
    const authoredIntent = envelopeAirIntent(authored, 5);
    expect(authoredIntent.targetAir).toBe(0.1);
    expect(authoredIntent.authoredAirMeetsMinimumRun).toBe(true);
    // These are derived real-valued planning priors, so assert numerical
    // equivalence rather than a particular IEEE-754 representation.
    expect(authoredIntent.nominalAirborneSamples).toBeCloseTo(6.1);
    expect(authoredIntent.nominalAirborneIntervals).toBeCloseTo(5.1);
    expect(authoredIntent.nominalSupportIntervals).toBeCloseTo(54.9);
    expect(envelopeAirIntent(absent, 5)).toMatchObject({
      targetAir: null,
      authoredAirMeetsMinimumRun: null,
      nominalSupportIntervals: null,
    });
  });

  test("labels the detector floor as feasibility without overwriting dense authored air", () => {
    const interval = outgoingIntervalFromGap(gap(0, 8, { air: 0 }));
    const intent = envelopeAirIntent(interval, 5);
    expect(intent.targetAir).toBe(0);
    expect(intent.minimumAirborneSamples).toBe(5);
    expect(intent.minimumAirFraction).toBeCloseTo(5 / 9);
    expect(intent.authoredAirMeetsMinimumRun).toBe(false);
    expect(intent.nominalAirborneIntervals).toBeCloseTo(0);
    expect(intent.nominalSupportIntervals).toBeCloseTo(8);
  });

  test("keeps the detector runway discrete and separate from a support-time prior", () => {
    // On an inclusive 0..8 scorer window, a landing at frame 8 needs six
    // airborne samples at frames 2..7 and then persistent contact at 8. This
    // is deliberately not encoded as a generic support-duration ceiling.
    const raw: RawTrajectory = {
      duration: 12,
      frames: Array.from({ length: 13 }, (_, frame) => {
        const airborne = frame >= 2 && frame <= 7;
        return {
          frame,
          position: { x: frame, y: 0 },
          velocity: { x: 1, y: 0 },
          sledContacts: airborne ? [] : ["PEG"],
          contactLineIds: airborne ? [] : [1],
          sledBroken: false,
          riderEjected: false,
        };
      }),
    };
    const detected = detect(raw);
    expect(MIN_LANDING_AIRBORNE_FRAMES).toBe(6);
    expect(detected.events).toContainEqual({ frame: 8, type: "landing", airborneFrom: 2 });
  });
});
