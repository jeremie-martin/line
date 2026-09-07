import { describe, expect, it } from "vitest";
import { nativeRailLayers } from "../scripts/benchmark/native_rail_layers.ts";
import type { TrackLine } from "../scripts/v0/types.ts";
import { LineRiderEngine, disposeAllWasmEnginesForStudy } from "../scripts/lib/_lr_engine_wasm.ts";

const line: TrackLine = { id: 10, type: 0, x1: -100, y1: 20, x2: 1000, y2: 20,
  flipped: false, leftExtended: false, rightExtended: false };
describe("native rail layers", () => {
  it("places inward layers in canonical collision order with distinct IDs", () => {
    const rails = nativeRailLayers([line], { x: 2, y: 0 }, 4, 0.05, 1);
    expect(rails.map(l => l.id)).toEqual([10, 11, 12, 13]);
    expect(rails.map(l => l.y1)).toEqual([19.85, 19.9, 19.95, 20]);
    expect(rails.every(l => l.type === 1 && !l.flipped && l.x2 > l.x1)).toBe(true);
    expect(line.type).toBe(0);
  });
  it("preserves the collision side when changing propulsion direction", () => {
    const forward = nativeRailLayers([line], { x: 2, y: 0 }, 2, 0.05, 1);
    const brake = nativeRailLayers([line], { x: 2, y: 0 }, 2, 0.05, -1);
    expect(forward.map(l => l.y1)).toEqual(brake.map(l => l.y1));
    expect(brake.every(l => l.flipped && l.x1 > l.x2)).toBe(true);
  });
  it("delivers the named propulsion direction in the exact engine, with stronger layered force", () => {
    const speed = (layers: number, direction: -1 | 0 | 1) => {
      try {
        const rails = direction === 0 ? [line] : nativeRailLayers([line], { x: 4, y: 0 }, layers, 0.05, direction);
        const engine = new LineRiderEngine().setStart({ x: 0, y: 0 }, { x: 4, y: 0 }).addLine(rails);
        const rider = engine.getRider(40), packet = rider.ballisticState();
        expect(packet.riderMounted && packet.sledIntact).toBe(true);
        return rider.velocity.x;
      } finally { disposeAllWasmEnginesForStudy(); }
    };
    const solid = speed(1, 0), forward = speed(1, 1), brake = speed(1, -1);
    expect(forward).toBeGreaterThan(solid);
    expect(brake).toBeLessThan(solid);
    expect(speed(4, 1)).toBeGreaterThan(speed(2, 1));
    expect(speed(2, 1)).toBeGreaterThan(forward);
  });
});
