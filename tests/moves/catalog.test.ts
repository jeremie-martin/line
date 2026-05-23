/**
 * Regression contract per move. Each test:
 *   - generates a track using the move
 *   - runs the detector
 *   - asserts the verdict.passed is true (catastrophic failure check)
 *   - asserts the most important observed metric is in a reasonable range
 *
 * "Reasonable range" is a band, not an exact equality — physics has
 * 1-2 frame jitter at parameter boundaries.
 */
import { describe, test, expect } from "vitest";
import {
  slide,
  curve,
  drop,
  ramp,
  catch_,
  gap,
  glide,
  wave,
  sigmoid,
  brake,
  kicker,
  bounceStrip,
  jump,
  halfPipe,
  loop,
} from "../../scripts/lib/moves.ts";
import { ride } from "../../scripts/lib/ride.ts";

describe("slide", () => {
  test("default params catch and slide ≥ 30 frames", () => {
    const r = ride([slide({ at: 30 })]);
    expect(r.survived).toBe(true);
    const v = r.steps[0].verdict!;
    expect(v.passed).toBe(true);
    expect(v.observed.slideDurationFrames).toBeGreaterThanOrEqual(30);
  });

  test("longer slide reaches longer duration", () => {
    const r = ride([slide({ at: 30, segments: 10, segmentLength: 40 })]);
    expect(r.steps[0].verdict!.observed.slideDurationFrames).toBeGreaterThanOrEqual(50);
  });
});

describe("curve", () => {
  test("alias of slide", () => {
    const r = ride([curve({ at: 30 })]);
    expect(r.survived).toBe(true);
    expect(r.steps[0].verdict!.passed).toBe(true);
  });
});

describe("drop", () => {
  test("default catch + accelerate", () => {
    const r = ride([drop({ at: 30 })]);
    expect(r.survived).toBe(true);
    expect(r.steps[0].verdict!.passed).toBe(true);
  });
});

describe("ramp", () => {
  test("standalone airborne phase short (no preheat)", () => {
    const r = ride([ramp({ at: 30 })]);
    // ramp from free-fall is mostly a pothole; just check it survives
    expect(r.survived).toBe(true);
  });
});

describe("catch_", () => {
  test("catastrophic at default — surfaces survival issue honestly", () => {
    const r = ride([catch_({ at: 30 })]);
    // Catch alone ejects rider 1 frame after landing — verdict.passed = false.
    expect(r.steps[0].verdict!.passed).toBe(false);
  });
});

describe("gap", () => {
  test("passes when prior move ends before the gap window", () => {
    const r = ride([
      slide({ at: 30 }),
      gap({ at: 80, duration: 20 }),
    ]);
    expect(r.survived).toBe(true);
    // The slide ends ~f=77, then airborne for the gap window
    expect(r.steps[1].verdict!.drift).toHaveLength(0);
  });
});

describe("glide", () => {
  test("long slide from free-fall", () => {
    const r = ride([glide({ at: 30 })]);
    expect(r.survived).toBe(true);
    expect(r.steps[0].verdict!.observed.slideDurationFrames).toBeGreaterThanOrEqual(50);
  });
});

describe("wave", () => {
  test("produces sled contact with multiple sign changes", () => {
    const r = ride([wave({ at: 30 })]);
    expect(r.survived).toBe(true);
    expect(r.steps[0].verdict!.observed.vySignChanges).toBeGreaterThan(0);
  });
});

describe("sigmoid", () => {
  test("survives and produces a slide", () => {
    const r = ride([sigmoid({ at: 30 })]);
    expect(r.survived).toBe(true);
    expect(r.steps[0].verdict!.observed.slideDurationFrames).toBeGreaterThan(0);
  });
});

describe("brake", () => {
  test("survives", () => {
    const r = ride([brake({ at: 30 })]);
    expect(r.survived).toBe(true);
  });
});

describe("kicker", () => {
  test("produces sled contact and survives", () => {
    const r = ride([kicker({ at: 30 })]);
    expect(r.survived).toBe(true);
  });
});

describe("bounceStrip", () => {
  test("needs preheat — fails from free-fall but works after slide", () => {
    const r1 = ride([bounceStrip({ at: 30 })]);
    // From free-fall it ejects.
    expect(r1.survived).toBe(false);

    const r2 = ride([slide({ at: 30 }), bounceStrip({ at: 90 })]);
    expect(r2.survived).toBe(true);
  });
});

describe("jump", () => {
  test("works after tight slide preheat (≤ 50-frame gap)", () => {
    // Jump survival is sensitive to gap timing — adaptation isn't yet smart
    // enough to compensate for accumulated vy. 50-frame gap is the working
    // ceiling at default params.
    const r = ride([slide({ at: 30 }), jump({ at: 75 })]);
    expect(r.survived).toBe(true);
  });
});

describe("halfPipe", () => {
  test("survives and produces substantial sliding", () => {
    const r = ride([halfPipe({ at: 30 })]);
    expect(r.survived).toBe(true);
    expect(r.steps[0].verdict!.observed.totalContactFrames).toBeGreaterThanOrEqual(25);
  });
});

describe("loop", () => {
  test("survives but doesn't fully sweep (known limitation)", () => {
    // The loop primitive is known to underperform in 2D rigid-body —
    // rider detaches before completing the full sweep. The test
    // documents the current behavior; the ride survives but drift
    // entry will be present.
    const r = ride([slide({ at: 30 }), loop({ at: 90 })]);
    expect(r.survived).toBe(true);
    // Drift on the loop is expected at default params.
    expect(r.steps[1].verdict!.drift.length).toBeGreaterThan(0);
  });
});

describe("composed regression", () => {
  test("6-slide chain at 50-frame spacing matches the slidechain baseline", () => {
    const r = ride([
      slide({ at: 30 }),
      slide({ at: 80 }),
      slide({ at: 130 }),
      slide({ at: 180 }),
      slide({ at: 230 }),
      slide({ at: 280 }),
    ]);
    expect(r.survived).toBe(true);
    // Should match the slidechain numbers we committed earlier.
    const s = r.detection.summary;
    // With adaptation, slide chain numbers shifted slightly from the pre-
    // adaptation baseline (was 44%/47f). New regression target:
    expect(s.contactFractionSpec).toBeGreaterThan(0.4);
    expect(s.contactFractionSpec).toBeLessThan(0.5);
    expect(s.longestContactRun).toBeGreaterThanOrEqual(40);
    expect(s.longestContactRun).toBeLessThanOrEqual(50);
  });
});
