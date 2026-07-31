import { describe, expect, test } from "vitest";
import {
  CAPTURE_ARC_RESPONSE_HORIZON_FRAMES,
  realizeContactCaptureArc,
  resolveContactCaptureArc,
} from "../scripts/v0/trajectory/contact_capture_arc.ts";
import {
  makeContactCaptureArcScreen,
  makeMirroredContactCaptureArcScreen,
} from "../scripts/v0/trajectory/contact_capture_arc_design.ts";
import type { ContactKinematicFrame } from "../scripts/v0/trajectory/contact_kinematic_frame.ts";

const frame: ContactKinematicFrame = {
  anchor: {
    reference: { x: 100, y: 200 },
    headingDeg: 10,
    speedPxPerFrame: 10,
    sledSpanPx: 18,
    anchorPoint: "NOSE",
    headingSource: "reference_point_velocity",
  },
  com: { headingDeg: 0, speedPxPerFrame: 10 },
  impact: {
    target: 0.8,
    requestedRawImpactPx: 5,
    requestedTurnDeg: 30,
    catchableTurnDeg: 30,
  },
};

describe("contact capture arc", () => {
  test("anchors geometry with the sled frame but derives response from CoM impact state", () => {
    const resolved = resolveContactCaptureArc(frame, {
      turnOrientation: -1,
      targetPhaseOffsetFrames: 0.5,
      entryTurnShare: 0.75,
      approachFrames: 2,
      runwayFrames: 1,
    });
    expect(resolved.capturePoint.x).toBeCloseTo(100 + 5 * Math.cos(Math.PI / 18), 12);
    expect(resolved.capturePoint.y).toBeCloseTo(200 + 5 * Math.sin(Math.PI / 18), 12);
    expect(resolved.entryAngleDeg).toBeCloseTo(-22.5, 12);
    expect(resolved.exitAngleDeg).toBeCloseTo(-30, 12);
    expect(resolved.turnOrientation).toBe(-1);
    expect(resolved.responseHorizonFrames).toBe(CAPTURE_ARC_RESPONSE_HORIZON_FRAMES);
    const realized = realizeContactCaptureArc(resolved, 50);
    expect(realized.lines[0]).toMatchObject({ id: 50, x2: resolved.capturePoint.x, y2: resolved.capturePoint.y });
    expect(realized.lines[1]).toMatchObject({ id: 51, x1: resolved.capturePoint.x, y1: resolved.capturePoint.y });
    expect(realized.captureBandLineIds).toEqual(realized.lines.map((line) => line.id));
    expect(realized.lineRoles.arc).not.toHaveLength(0);
  });

  test("uses a compact unique physical allocation and target-phase screen", () => {
    const rows = makeContactCaptureArcScreen(frame);
    expect(rows).toHaveLength(12);
    expect(new Set(rows.map((row) => JSON.stringify(row.control))).size).toBe(12);
    expect(new Set(rows.map((row) => row.hypothesis))).toEqual(
      new Set(["distributed", "balanced", "entry_loaded", "entry_only"]),
    );
    expect(new Set(rows.map((row) => row.placement.label))).toEqual(
      new Set(["at_target", "half_frame_forward", "one_frame_forward"]),
    );
    expect(new Set(rows.map((row) => row.turnOrientation))).toEqual(new Set([-1]));
  });

  test("makes bend direction an explicit mirrored feasibility control", () => {
    const rows = makeMirroredContactCaptureArcScreen(frame);
    expect(rows).toHaveLength(24);
    expect(new Set(rows.map((row) => row.turnOrientation))).toEqual(new Set([-1, 1]));
    const negative = resolveContactCaptureArc(frame, rows.find((row) =>
      row.turnOrientation === -1 && row.hypothesis === "entry_loaded" && row.placement.label === "half_frame_forward",
    )!.control);
    const positive = resolveContactCaptureArc(frame, rows.find((row) =>
      row.turnOrientation === 1 && row.hypothesis === "entry_loaded" && row.placement.label === "half_frame_forward",
    )!.control);
    expect(positive.entryAngleDeg).toBeCloseTo(-negative.entryAngleDeg, 12);
    expect(positive.exitAngleDeg).toBeCloseTo(-negative.exitAngleDeg, 12);
  });

  test("bounds event phase to the predeclared target-through-one-frame domain", () => {
    for (const targetPhaseOffsetFrames of [-0.01, 1.01]) {
      expect(() => resolveContactCaptureArc(frame, {
        turnOrientation: -1,
        targetPhaseOffsetFrames,
        entryTurnShare: 0.5,
        approachFrames: 2,
        runwayFrames: 1,
      })).toThrow(/targetPhaseOffsetFrames/);
    }
  });

  test("refuses to silently invent an impact scale for unspecified contacts", () => {
    expect(() => makeContactCaptureArcScreen({ ...frame, impact: null })).toThrow(/impact target/);
  });

  test("fails closed for authored zero impact until neutral incidence has its own study", () => {
    const zeroImpact = { ...frame, impact: { ...frame.impact!, target: 0, requestedRawImpactPx: 0, requestedTurnDeg: 0, catchableTurnDeg: 0 } };
    expect(() => makeContactCaptureArcScreen(zeroImpact)).toThrow(/zero-impact contact/);
    expect(() => resolveContactCaptureArc(zeroImpact, {
      turnOrientation: -1,
      targetPhaseOffsetFrames: 0,
      entryTurnShare: 0,
      approachFrames: 2,
      runwayFrames: 1,
    })).toThrow(/zero-impact contact/);
  });

  test("rejects an implicit or invalid turn orientation", () => {
    expect(() => resolveContactCaptureArc(frame, {
      turnOrientation: 0 as -1 | 1,
      targetPhaseOffsetFrames: 0,
      entryTurnShare: 0.5,
      approachFrames: 2,
      runwayFrames: 1,
    })).toThrow(/turnOrientation/);
  });
});
