import { describe, expect, test } from "vitest";
import {
  activeNormalForDirectedTangent,
  EXACT_SUPPORT_SLICE_RAIL_ACTIONS,
  EXACT_SUPPORT_SLICE_PROTOCOL,
  realizeExactSupportSlice,
} from "../scripts/v0/trajectory/exact_support_slice.ts";
import {
  LineRiderEngine as WasmLineRiderEngine,
  createLineFromJson as wasmLineFromJson,
} from "../scripts/lib/_lr_engine_wasm.ts";

const anchor = {
  reference: { x: 100, y: 200 },
  headingDeg: 0,
  speedPxPerFrame: 10,
  sledSpanPx: 18,
  anchorPoint: "TAIL" as const,
  headingSource: "reference_point_velocity" as const,
};

function action(id: (typeof EXACT_SUPPORT_SLICE_RAIL_ACTIONS)[number]["id"]) {
  return EXACT_SUPPORT_SLICE_RAIL_ACTIONS.find((candidate) => candidate.id === id)!;
}

describe("exact post-impact support slice", () => {
  test("declares one fixed, non-factorial rail stencil", () => {
    expect(EXACT_SUPPORT_SLICE_RAIL_ACTIONS).toEqual([
      { id: "rail-neutral", extentScale: 1, totalTurnDeg: 0 },
      { id: "rail-turn-positive", extentScale: 1, totalTurnDeg: 8 },
      { id: "rail-turn-negative", extentScale: 1, totalTurnDeg: -8 },
      { id: "rail-extent-long", extentScale: 1.15, totalTurnDeg: 0 },
      { id: "rail-extent-short", extentScale: 0.85, totalTurnDeg: 0 },
    ]);
    expect(Object.isFrozen(EXACT_SUPPORT_SLICE_RAIL_ACTIONS)).toBe(true);
    expect(Object.isFrozen(EXACT_SUPPORT_SLICE_RAIL_ACTIONS[0]!)).toBe(true);
    expect(Object.isFrozen(EXACT_SUPPORT_SLICE_PROTOCOL)).toBe(true);
    expect(() => { (EXACT_SUPPORT_SLICE_RAIL_ACTIONS[0] as any).extentScale = 7; }).toThrow();
    expect(() => { (EXACT_SUPPORT_SLICE_PROTOCOL as any).preloadSpeedFrames = 9; }).toThrow();
    expect(EXACT_SUPPORT_SLICE_RAIL_ACTIONS[0]!.extentScale).toBe(1);
    expect(EXACT_SUPPORT_SLICE_PROTOCOL.preloadSpeedFrames).toBe(0.1);
  });

  test("chooses the active side from capture-only named-reference motion", () => {
    const slice = realizeExactSupportSlice({
      anchor,
      captureOnlyReferenceDisplacement: { x: 10, y: 0.5 },
      horizonFrames: 12,
    }, action("rail-neutral"), 70);
    expect(slice.lines).toHaveLength(1);
    expect(slice.lines[0]!.flipped).toBe(false);
    expect(slice.entryActiveNormal).toEqual({ x: 0, y: 1 });
    expect(slice.entryNormalProjectionPx).toBeCloseTo(0.5, 12);
    expect(slice.entryTangentProjectionPx).toBeCloseTo(10, 12);
    expect(slice.entryFlipped).toBe(false);
    expect(slice.segments[0]!.activeNormal).toEqual(slice.entryActiveNormal);
    expect(slice.preloadPx).toBeCloseTo(1, 12);
    expect(slice.railStart).toEqual({ x: 100, y: 201 });
    expect(slice.extentPx).toBe(120);
    expect(slice.lines[0]).toMatchObject({ type: 0, leftExtended: false, rightExtended: false, id: 70 });
  });

  test("uses flipped rather than endpoint reversal when the observed side reverses", () => {
    const slice = realizeExactSupportSlice({
      anchor,
      captureOnlyReferenceDisplacement: { x: 10, y: -0.5 },
      horizonFrames: 12,
    }, action("rail-neutral"), 70);
    expect(slice.lines[0]!.flipped).toBe(true);
    expect(slice.entryActiveNormal).toEqual({ x: 0, y: -1 });
    expect(slice.lines[0]!.x2).toBeGreaterThan(slice.lines[0]!.x1);
    expect(activeNormalForDirectedTangent({ x: 1, y: 0 }, true)).toEqual({ x: 0, y: -1 });
  });

  test("preserves canonical forward endpoints and transports the active normal across signed turns", () => {
    const positive = realizeExactSupportSlice({
      anchor,
      captureOnlyReferenceDisplacement: { x: 10, y: 0.5 },
      horizonFrames: 12,
    }, action("rail-turn-positive"), 10);
    const negative = realizeExactSupportSlice({
      anchor,
      captureOnlyReferenceDisplacement: { x: 10, y: 0.5 },
      horizonFrames: 12,
    }, action("rail-turn-negative"), 10);
    for (const slice of [positive, negative]) {
      expect(slice.lines[0]!.x2).toBeGreaterThan(slice.lines[0]!.x1);
      expect(slice.segments[0]!.tangentDeg).toBeCloseTo(anchor.headingDeg, 12);
      expect(slice.minimumAdjacentActiveNormalDot).toBeGreaterThanOrEqual(
        EXACT_SUPPORT_SLICE_PROTOCOL.minAdjacentActiveNormalDot,
      );
      for (const segment of slice.segments) expect(segment.flipped).toBe(false);
    }
    expect(positive.segments.at(-1)!.tangentDeg).toBeCloseTo(8, 12);
    expect(negative.segments.at(-1)!.tangentDeg).toBeCloseTo(-8, 12);
  });

  test("scales length continuously with speed, horizon, and the one-factor extent arm", () => {
    const neutral = realizeExactSupportSlice({
      anchor,
      captureOnlyReferenceDisplacement: { x: 10, y: 0.5 },
      horizonFrames: 4,
    }, action("rail-neutral"), 1);
    const longer = realizeExactSupportSlice({
      anchor,
      captureOnlyReferenceDisplacement: { x: 10, y: 0.5 },
      horizonFrames: 12,
    }, action("rail-extent-long"), 1);
    expect(neutral.extentPx).toBe(40);
    expect(longer.extentPx).toBeCloseTo(138, 12);
    expect(longer.footprint.conservativeCellCount).toBeGreaterThan(0);
  });

  test("fails closed for an ambiguous normal, invalid horizon, or invalid geometry", () => {
    expect(() => realizeExactSupportSlice({
      anchor,
      captureOnlyReferenceDisplacement: { x: 10, y: 0 },
      horizonFrames: 12,
    }, action("rail-neutral"), 1)).toThrow(/stable active normal/);
    expect(() => realizeExactSupportSlice({
      anchor,
      captureOnlyReferenceDisplacement: { x: 10, y: 1 },
      horizonFrames: 3,
    }, action("rail-neutral"), 1)).toThrow(/horizon/);
    expect(() => realizeExactSupportSlice({
      anchor: { ...anchor, speedPxPerFrame: 0 },
      captureOnlyReferenceDisplacement: { x: 10, y: 1 },
      horizonFrames: 12,
    }, action("rail-neutral"), 1)).toThrow(/speed/);
    expect(() => realizeExactSupportSlice({
      anchor,
      captureOnlyReferenceDisplacement: { x: -10, y: 1 },
      horizonFrames: 12,
    }, action("rail-neutral"), 1)).toThrow(/canonical rail direction/);
    expect(() => realizeExactSupportSlice({
      anchor: { ...anchor, headingSource: "rider_com_velocity" },
      captureOnlyReferenceDisplacement: { x: 10, y: 1 },
      horizonFrames: 12,
    }, action("rail-neutral"), 1)).toThrow(/named non-rider/);
    expect(() => realizeExactSupportSlice({
      anchor,
      captureOnlyReferenceDisplacement: { x: 10, y: 1 },
      horizonFrames: 12,
    }, { id: "rail-neutral", extentScale: 7, totalTurnDeg: 123 } as any, 1)).toThrow(/declared assay stencil/);
  });

  test("WASM honors the explicit active-normal orientation", () => {
    const variants = [
      { flipped: false, x1: -100, x2: 100, expectedCollisionFrame: 13 },
      { flipped: true, x1: -100, x2: 100, expectedCollisionFrame: null },
      { flipped: false, x1: 100, x2: -100, expectedCollisionFrame: null },
      { flipped: true, x1: 100, x2: -100, expectedCollisionFrame: 13 },
    ];
    for (const variant of variants) {
      const engine = new WasmLineRiderEngine()
        .setStart({ x: 0, y: 0 }, { x: 0.4, y: 0 })
        .addLine(wasmLineFromJson({
          id: 91,
          type: 0,
          x1: variant.x1,
          y1: 20,
          x2: variant.x2,
          y2: 20,
          flipped: variant.flipped,
          leftExtended: false,
          rightExtended: false,
        }));
      expect(firstCollisionFrame(engine, 91, 50)).toBe(variant.expectedCollisionFrame);
    }
  });
});

function firstCollisionFrame(engine: any, lineId: number, finalFrame: number): number | null {
  for (let frame = 0; frame <= finalFrame; frame++) {
    const collided = engine.getUpdatesAtFrame(frame).some((update: any) =>
      update.type === "CollisionUpdate" && update.id === lineId
    );
    if (collided) return frame;
  }
  return null;
}
