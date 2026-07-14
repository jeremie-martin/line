import { describe, expect, test } from "vitest";
import {
  extractContactStrip,
  extractExactContactStripProfile,
  maximumLineCoordinateError,
  realizeExactContactStripProfile,
  realizeContactStrip,
  type ContactFrame,
  type ContactStripControl,
} from "../scripts/v0/trajectory/contact_strip.ts";

const frame: ContactFrame = {
  reference: { x: 120, y: 280 },
  headingDeg: -12,
};

const control: ContactStripControl = {
  targetTangentOffsetPx: -14.5,
  targetNormalOffsetPx: 3.25,
  entryAngleRelativeDeg: 27.5,
  preReachPx: 31.75,
  surfaceExtentPx: 97.5,
  totalTurnDeg: -42.5,
  turnExponent: 1,
};

describe("contact-strip geometry", () => {
  test("losslessly re-expresses an endpoint-turn strip in a different frame", () => {
    const source = realizeContactStrip(frame, control, 80, { postSegments: 8 });
    const targetFrame: ContactFrame = {
      reference: { x: 136.25, y: 251.5 },
      headingDeg: 8.75,
    };
    const extracted = extractContactStrip(targetFrame, source.lines);
    const replay = realizeContactStrip(targetFrame, extracted.control, 400, {
      postSegments: extracted.postSegments,
    });
    expect(maximumLineCoordinateError(source.lines, replay.lines)).toBeLessThan(1e-8);
    expect(extracted.control.turnExponent).toBeCloseTo(1, 8);
  });

  test("tangent-continuous mode has no artificial contact kink", () => {
    const realized = realizeContactStrip(frame, control, 1, {
      postSegments: 8,
      mode: "tangent_continuous",
    });
    const pre = realized.lines[0];
    const firstPost = realized.lines[1];
    const preAngle = Math.atan2(pre.y2 - pre.y1, pre.x2 - pre.x1);
    const postAngle = Math.atan2(firstPost.y2 - firstPost.y1, firstPost.x2 - firstPost.x1);
    expect(postAngle).toBeCloseTo(preAngle, 10);
  });

  test("holds target-frame contact position fixed while entry angle changes", () => {
    const left = realizeContactStrip(frame, control, 1);
    const right = realizeContactStrip(frame, {
      ...control,
      entryAngleRelativeDeg: control.entryAngleRelativeDeg + 24,
    }, 1);
    expect(right.contactPoint.x).toBeCloseTo(left.contactPoint.x, 12);
    expect(right.contactPoint.y).toBeCloseTo(left.contactPoint.y, 12);
  });

  test("rejects a broken line chain rather than inventing a coordinate", () => {
    const realized = realizeContactStrip(frame, control, 1);
    const broken = realized.lines.map((line) => ({ ...line }));
    broken[2].x1 += 0.1;
    expect(() => extractContactStrip(frame, broken)).toThrow("discontinuous");
  });

  test("keeps an arbitrary post profile lossless while rejecting a false compact form", () => {
    const profile = {
      targetTangentOffsetPx: -8,
      targetNormalOffsetPx: 4,
      entryAngleRelativeDeg: 10,
      preReachPx: 20,
      post: [
        { lengthPx: 9, angleRelativeDeg: 4 },
        { lengthPx: 24, angleRelativeDeg: -18 },
        { lengthPx: 13, angleRelativeDeg: 6 },
      ],
    };
    const source = realizeExactContactStripProfile(frame, profile, 1);
    const extracted = extractExactContactStripProfile(frame, source);
    const replay = realizeExactContactStripProfile(frame, extracted, 40);
    expect(maximumLineCoordinateError(source, replay)).toBeLessThan(1e-8);
    expect(() => extractContactStrip(frame, source)).toThrow("cannot losslessly express");
  });
});
