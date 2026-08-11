import { describe, expect, test } from "vitest";
import {
  buildCaptureRedirectReleaseGeometry,
  buildCapturePreservingActiveNativePulseGeometry,
  buildCapturePreservingNativeEntryLipGeometry,
  buildCapturePreservingNativePulseGeometry,
  buildCapturePreservingStagedOutboundGeometry,
  buildCapturePreservingStagedReturnGeometry,
  buildCapturePreservingZeroNetChicaneGeometry,
  buildZeroNetChicaneGeometry,
  contactTransitionPhase,
  contactTransitionMode,
  nativeEntryLipDose,
  nativePulseAnchor,
  nativePulseDose,
  type ContactTransitionGeometryInput,
} from "../scripts/v0/optimizer/contact_transition.ts";

const base: Omit<ContactTransitionGeometryInput, "turnOrientation"> = {
  anchor: { x: 100, y: 50 },
  speedPxPerFrame: 10,
  incomingHeadingDeg: 0,
  targetImpact: 0.4,
  lineIdStart: 200,
  control: {
    targetPhaseOffsetFrames: 0.5,
    entryTurnShare: 0.5,
    approachFrames: 2,
    runwayFrames: 1,
  },
};

describe("passive capture–redirect–release geometry", () => {
  test("is default-off and rejects unregistered experiment modes", () => {
    expect(contactTransitionMode({})).toBeNull();
    expect(contactTransitionMode({ LR_CONTACT_TRANSITION: "off" })).toBeNull();
    expect(contactTransitionMode({ LR_CONTACT_TRANSITION: "capture-balanced" }))
      .toBe("capture-balanced");
    expect(contactTransitionMode({ LR_CONTACT_TRANSITION: "impulse-release" }))
      .toBe("impulse-release");
    expect(contactTransitionMode({ LR_CONTACT_TRANSITION: "zero-net-chicane" }))
      .toBe("zero-net-chicane");
    expect(contactTransitionMode({ LR_CONTACT_TRANSITION: "staged-outbound-native" }))
      .toBe("staged-outbound-native");
    expect(contactTransitionMode({ LR_CONTACT_TRANSITION: "native-pulse-cell" }))
      .toBe("native-pulse-cell");
    expect(contactTransitionMode({ LR_CONTACT_TRANSITION: "active-native-pulse-cell" }))
      .toBe("active-native-pulse-cell");
    expect(contactTransitionMode({ LR_CONTACT_TRANSITION: "native-entry-lip" }))
      .toBe("native-entry-lip");
    expect(contactTransitionMode({ LR_CONTACT_TRANSITION: "staged-return-cell" }))
      .toBe("staged-return-cell");
    expect(() => contactTransitionMode({ LR_CONTACT_TRANSITION: "tuned-for-a-case" })).toThrow();
    expect(contactTransitionPhase({})).toBe("all");
    expect(contactTransitionPhase({ LR_CONTACT_TRANSITION_PHASE: "repair" })).toBe("repair");
    expect(() => contactTransitionPhase({ LR_CONTACT_TRANSITION_PHASE: "per-case" })).toThrow();
    expect(nativePulseDose({})).toBe("half");
    expect(nativePulseDose({ LR_CONTACT_PULSE_DOSE: "full" })).toBe("full");
    expect(() => nativePulseDose({ LR_CONTACT_PULSE_DOSE: "per-case" })).toThrow();
    expect(nativePulseAnchor({})).toBe("carrier-end");
    expect(nativePulseAnchor({ LR_CONTACT_PULSE_ANCHOR: "projected-frame" }))
      .toBe("projected-frame");
    expect(() => nativePulseAnchor({ LR_CONTACT_PULSE_ANCHOR: "per-case" })).toThrow();
    expect(nativeEntryLipDose({})).toBe("half");
    expect(nativeEntryLipDose({ LR_CONTACT_LIP_DOSE: "full" })).toBe("full");
    expect(() => nativeEntryLipDose({ LR_CONTACT_LIP_DOSE: "per-case" })).toThrow();
  });

  test("constructs deterministic mirrored responses from physical inputs only", () => {
    const negative = buildCaptureRedirectReleaseGeometry({ ...base, turnOrientation: -1 });
    const repeated = buildCaptureRedirectReleaseGeometry({ ...base, turnOrientation: -1 });
    const positive = buildCaptureRedirectReleaseGeometry({ ...base, turnOrientation: 1 });

    expect(repeated).toEqual(negative);
    expect(negative.requestedTurnDeg).toBeGreaterThan(0);
    expect(negative.catchableTurnDeg).toBeLessThanOrEqual(negative.requestedTurnDeg);
    expect(negative.entryTurnDeg).toBeCloseTo(negative.catchableTurnDeg / 2, 12);
    expect(negative.responseTurnDeg).toBeCloseTo(negative.catchableTurnDeg / 2, 12);
    expect(negative.entryAngleDeg).toBeCloseTo(-positive.entryAngleDeg, 12);
    expect(negative.exitAngleDeg).toBeCloseTo(-positive.exitAngleDeg, 12);
    expect(negative.lines).toHaveLength(positive.lines.length);
    expect(negative.lines.map((line) => line.id)).toEqual(
      Array.from({ length: negative.lines.length }, (_, index) => 200 + index),
    );
  });

  test("keeps the capture boundary C1 and ends after the exact response horizon", () => {
    const geometry = buildCaptureRedirectReleaseGeometry({ ...base, turnOrientation: -1 });
    const angles = geometry.lines.map((line) =>
      Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180 / Math.PI
    );
    expect(angles[0]).toBeCloseTo(geometry.entryAngleDeg, 12);
    expect(angles[1]).toBeCloseTo(geometry.entryAngleDeg, 12);
    expect(angles.at(-1)).toBeCloseTo(geometry.exitAngleDeg, 12);
    expect(Math.max(...angles.slice(1).map((angle, index) =>
      index === 0 ? 0 : Math.abs(angle - angles[index]!)
    ))).toBeLessThanOrEqual(5.000_000_1);
  });

  test("realizes the impact-loaded proposal as a straight finite release boundary", () => {
    const geometry = buildCaptureRedirectReleaseGeometry({
      ...base,
      targetImpact: 0.7,
      turnOrientation: -1,
      control: { ...base.control, entryTurnShare: 1 },
    });
    expect(geometry.responseTurnDeg).toBeCloseTo(0, 12);
    expect(geometry.entryTurnDeg).toBeCloseTo(geometry.catchableTurnDeg, 12);
    const headings = geometry.lines.map((line) =>
      Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180 / Math.PI
    );
    for (const heading of headings) expect(heading).toBeCloseTo(geometry.entryAngleDeg, 10);
    expect(geometry.lines).toHaveLength(3);
  });

  test("scales continuously with speed and target instead of a budget or case", () => {
    const low = buildCaptureRedirectReleaseGeometry({
      ...base,
      targetImpact: 0.2,
      turnOrientation: 1,
    });
    const high = buildCaptureRedirectReleaseGeometry({
      ...base,
      targetImpact: 0.6,
      turnOrientation: 1,
    });
    const fast = buildCaptureRedirectReleaseGeometry({
      ...base,
      speedPxPerFrame: 14,
      targetImpact: 0.6,
      turnOrientation: 1,
    });
    expect(high.catchableTurnDeg).toBeGreaterThan(low.catchableTurnDeg);
    expect(fast.catchableTurnDeg).toBeLessThan(high.catchableTurnDeg);
    expect(high.lines[0].x2 - base.anchor.x).toBeCloseTo(5, 12);
    expect(fast.lines[0].x2 - base.anchor.x).toBeCloseTo(7, 12);
  });

  test("builds a calibrated six-frame chicane with zero net turn", () => {
    const geometry = buildZeroNetChicaneGeometry({ ...base, targetImpact: 0.7, turnOrientation: -1 });
    expect(geometry.mechanism).toBe("zero_net_chicane");
    expect(geometry.responseSegments).toBe(6);
    expect(geometry.lines).toHaveLength(7);
    expect(geometry.accumulatedTurnDeg).toBeGreaterThan(geometry.catchableTurnDeg);
    expect(geometry.accumulatedTurnDeg * 0.25).toBeCloseTo(geometry.catchableTurnDeg, 10);
    expect(geometry.exitAngleDeg).toBeCloseTo(base.incomingHeadingDeg, 12);
    for (let index = 1; index < geometry.lines.length; index++) {
      expect(geometry.lines[index]!.x1).toBeCloseTo(geometry.lines[index - 1]!.x2, 12);
      expect(geometry.lines[index]!.y1).toBeCloseTo(geometry.lines[index - 1]!.y2, 12);
    }
  });

  test("preserves an incumbent carrier and commands only its measured deficit", () => {
    const incumbent = [
      { id: 1, type: 0, x1: 80, y1: 55, x2: 100, y2: 50, flipped: false, leftExtended: false, rightExtended: false },
      { id: 2, type: 0, x1: 100, y1: 50, x2: 110, y2: 50, flipped: false, leftExtended: false, rightExtended: false },
      { id: 3, type: 0, x1: 110, y1: 50, x2: 120, y2: 52, flipped: false, leftExtended: false, rightExtended: false },
    ];
    const geometry = buildCapturePreservingZeroNetChicaneGeometry(
      incumbent,
      { ...base, targetImpact: 0.7, turnOrientation: -1 },
      0.5,
    );
    expect(geometry.lines[0]).toMatchObject({ x1: 80, y1: 55, x2: 100, y2: 50, id: 200 });
    expect(geometry.lines[1]).toMatchObject({ x1: 100, y1: 50, x2: 110, y2: 50, id: 201 });
    expect(geometry.lines).toHaveLength(7);
    expect(geometry.exitAngleDeg).toBeCloseTo(0, 12);
    expect(geometry.requestedTurnDeg).toBeLessThan(
      buildZeroNetChicaneGeometry({ ...base, targetImpact: 0.7, turnOrientation: -1 }).requestedTurnDeg,
    );
  });

  test("adds a low-frequency zero-net pulse without removing native continuation", () => {
    const incumbent = [
      { id: 1, type: 0, x1: 80, y1: 55, x2: 100, y2: 50, flipped: false, leftExtended: false, rightExtended: false },
      { id: 2, type: 0, x1: 100, y1: 50, x2: 110, y2: 50, flipped: false, leftExtended: false, rightExtended: false },
      { id: 3, type: 0, x1: 110, y1: 50, x2: 120, y2: 52, flipped: false, leftExtended: false, rightExtended: false },
    ];
    const half = buildCapturePreservingNativePulseGeometry(
      incumbent,
      { ...base, targetImpact: 0.7, turnOrientation: 1 },
      0.5,
      "half",
    );
    const full = buildCapturePreservingNativePulseGeometry(
      incumbent,
      { ...base, targetImpact: 0.7, turnOrientation: 1 },
      0.5,
      "full",
    );
    expect(half.lines.slice(0, incumbent.length).map(({ id: _id, ...line }) => line)).toEqual(
      incumbent.map(({ id: _id, ...line }) => line),
    );
    expect(half.lines).toHaveLength(incumbent.length + 5);
    expect(half.outboundLineIds).toHaveLength(5);
    expect(half.exitAngleDeg).toBeCloseTo(0, 12);
    expect(half.accumulatedTurnDeg).toBeCloseTo(half.catchableTurnDeg * 2, 10);
    expect(full.accumulatedTurnDeg).toBeCloseTo(full.catchableTurnDeg * 4, 10);
  });

  test("phase-aligns a native pulse one speed-frame after the projected contact", () => {
    const incumbent = [
      { id: 1, type: 0, x1: 80, y1: 55, x2: 100, y2: 50, flipped: false, leftExtended: false, rightExtended: false },
      { id: 2, type: 0, x1: 100, y1: 50, x2: 140, y2: 50, flipped: false, leftExtended: false, rightExtended: false },
      { id: 3, type: 0, x1: 140, y1: 50, x2: 150, y2: 52, flipped: false, leftExtended: false, rightExtended: false },
    ];
    const projected = buildCapturePreservingNativePulseGeometry(
      incumbent,
      { ...base, anchor: { x: 105, y: 54 }, targetImpact: 0.7, turnOrientation: 1 },
      0.5,
      "half",
      "projected-frame",
    );
    const endpoint = buildCapturePreservingNativePulseGeometry(
      incumbent,
      { ...base, anchor: { x: 105, y: 54 }, targetImpact: 0.7, turnOrientation: 1 },
      0.5,
      "half",
      "carrier-end",
    );
    expect(projected.lines[incumbent.length]).toMatchObject({ x1: 115, y1: 50 });
    expect(endpoint.lines[incumbent.length]).toMatchObject({ x1: 140, y1: 50 });
  });

  test("drives only the fixed pulse while preserving its geometry and active normal", () => {
    const incumbent = [
      { id: 1, type: 0 as const, x1: 80, y1: 55, x2: 100, y2: 50, flipped: false, leftExtended: false, rightExtended: false },
      { id: 2, type: 0 as const, x1: 100, y1: 50, x2: 110, y2: 50, flipped: false, leftExtended: false, rightExtended: false },
      { id: 3, type: 0 as const, x1: 110, y1: 50, x2: 120, y2: 52, flipped: false, leftExtended: false, rightExtended: false },
    ];
    const passive = buildCapturePreservingNativePulseGeometry(
      incumbent,
      { ...base, targetImpact: 0.7, turnOrientation: 1 },
      0.5,
      "half",
      "carrier-end",
    );
    const active = buildCapturePreservingActiveNativePulseGeometry(
      incumbent,
      { ...base, targetImpact: 0.7, turnOrientation: 1 },
      0.5,
    );
    expect(active.mechanism).toBe("active_native_pulse_cell");
    expect(active.lines.slice(0, incumbent.length)).toEqual(passive.lines.slice(0, incumbent.length));
    for (let index = incumbent.length; index < active.lines.length; index++) {
      const solid = passive.lines[index]!;
      const driven = active.lines[index]!;
      expect(driven).toMatchObject({
        id: solid.id,
        type: 1,
        x1: solid.x2,
        y1: solid.y2,
        x2: solid.x1,
        y2: solid.y1,
        flipped: !solid.flipped,
        leftExtended: solid.rightExtended,
        rightExtended: solid.leftExtended,
      });
    }
  });

  test("adds a finite entry lip while preserving the entire native carrier", () => {
    const incumbent = [
      { id: 1, type: 0, x1: 80, y1: 55, x2: 100, y2: 50, flipped: false, leftExtended: false, rightExtended: false },
      { id: 2, type: 0, x1: 100, y1: 50, x2: 110, y2: 50, flipped: false, leftExtended: false, rightExtended: false },
      { id: 3, type: 0, x1: 110, y1: 50, x2: 120, y2: 52, flipped: false, leftExtended: false, rightExtended: false },
    ];
    const half = buildCapturePreservingNativeEntryLipGeometry(
      incumbent,
      { ...base, targetImpact: 0.7, turnOrientation: 1 },
      0.5,
      "half",
    );
    const full = buildCapturePreservingNativeEntryLipGeometry(
      incumbent,
      { ...base, targetImpact: 0.7, turnOrientation: 1 },
      0.5,
      "full",
    );
    expect(half.lines.slice(0, incumbent.length).map(({ id: _id, ...line }) => line)).toEqual(
      incumbent.map(({ id: _id, ...line }) => line),
    );
    expect(half.lines).toHaveLength(incumbent.length + 1);
    expect(half.outboundLineIds).toEqual([203]);
    expect(half.lines.at(-1)).toMatchObject({ x2: 100, y2: 50 });
    expect(full.entryTurnDeg).toBeCloseTo(half.entryTurnDeg * 2, 10);
    expect(full.exitAngleDeg).toBeCloseTo(0, 12);
  });

  test("derives an independent carrier-tangent return surface from the exact staged sled state", () => {
    const incumbent = [
      { id: 1, type: 0, x1: 80, y1: 55, x2: 100, y2: 50, flipped: false, leftExtended: false, rightExtended: false },
      { id: 2, type: 0, x1: 100, y1: 50, x2: 110, y2: 50, flipped: false, leftExtended: false, rightExtended: false },
      { id: 3, type: 0, x1: 110, y1: 50, x2: 120, y2: 52, flipped: false, leftExtended: false, rightExtended: false },
    ];
    const outbound = buildCapturePreservingStagedOutboundGeometry(
      incumbent,
      { ...base, targetImpact: 0.7, turnOrientation: 1 },
      0.5,
    );
    expect(outbound.lines.slice(0, incumbent.length).map(({ id: _id, ...line }) => line)).toEqual(
      incumbent.map(({ id: _id, ...line }) => line),
    );
    expect(outbound.returnLineId).toBeUndefined();
    expect(outbound.returnFrame).toBeUndefined();
    const geometry = buildCapturePreservingStagedReturnGeometry(
      outbound,
      {
        frame: 103,
        velocity: { x: 9, y: 3 },
        points: [
          { id: "PEG", x: 126, y: 51 },
          { id: "TAIL", x: 122, y: 54 },
          { id: "NOSE", x: 130, y: 53 },
          { id: "STRING", x: 126, y: 52 },
        ],
      },
      -10,
    );
    expect(outbound.lines).toHaveLength(5);
    expect(geometry.lines).toHaveLength(6);
    expect(geometry.returnFrame).toBe(103);
    expect(geometry.returnLineId).toBe(205);
    expect(geometry.accumulatedTurnDeg).toBeCloseTo(
      outbound.accumulatedTurnDeg + Math.abs(-10 - outbound.exitAngleDeg),
      12,
    );
    const returned = geometry.lines.at(-1)!;
    const dx = returned.x2 - returned.x1;
    const dy = returned.y2 - returned.y1;
    expect(Math.abs(Math.atan2(dy, dx) * 180 / Math.PI)).toBeCloseTo(10, 10);
    expect(Math.hypot(dx, dy)).toBeGreaterThan(8);
    const normal = { x: -dy, y: dx };
    expect(normal.x * 9 + normal.y * 3).toBeGreaterThan(0);
  });
});
