import { expect, it } from "vitest";
import { LineRiderEngine, disposeAllWasmEnginesForStudy } from "../scripts/lib/_lr_engine_wasm.ts";
import { nativeEnergySteering } from "../scripts/benchmark/native_energy_steering.ts";
import { collectiveContactPulse } from "../scripts/benchmark/collective_contact_pulse.ts";
import { nativeRailLayers } from "../scripts/benchmark/native_rail_layers.ts";
import { nativeMotionSchedule } from "../scripts/benchmark/native_motion_schedule.ts";

it("realizes a substantial requested velocity turn with native geometry and intact bindings", () => {
  try {
    const engine = new LineRiderEngine().setStart({ x: 0, y: 0 }, { x: 10, y: 0 });
    const before = engine.getRider(19).ballisticState(), arrival = engine.getRider(20);
    const neutral = engine.getRider(21).velocity;
    const steering = nativeEnergySteering(arrival.velocity, Math.hypot(arrival.velocity.x, arrival.velocity.y), -0.6)!;
    const points = Object.values(arrival.ballisticState().points) as Array<{ x: number; y: number }>;
    const lines = nativeRailLayers(collectiveContactPulse(points, arrival.velocity, steering.normalTurn, 0.02, 0.5, 100),
      arrival.velocity, steering.layers, 0.001, steering.energy);
    const candidate = engine.addLine(lines);
    expect(candidate.getRider(19).ballisticState()).toEqual(before);
    const actual = candidate.getRider(21).velocity;
    const error = Math.hypot(actual.x - neutral.x - steering.desiredDelta.x, actual.y - neutral.y - steering.desiredDelta.y);
    expect(error / Math.hypot(steering.desiredDelta.x, steering.desiredDelta.y)).toBeLessThan(0.03);
    const later = candidate.getRider(25).ballisticState();
    expect(later.riderMounted && later.sledIntact).toBe(true);
  } finally { disposeAllWasmEnginesForStudy(); }
});

it("constructs an authored height proposal while retaining a landing interval", () => {
  const schedule = nativeMotionSchedule([{ index: 0, startFrame: 0, endFrame: 40,
    endsWithContact: true, targets: { air: 0.5, speed: 0.6, amplitude: 0.4 } }], 40);
  expect(schedule.rows[0].proposedHeight).toBeCloseTo(24, 9);
  expect(schedule.grounded[40]).toBe(true);
  expect(schedule.grounded.slice(19, 40).every(x => !x)).toBe(true);
  expect(schedule.desired.every(v => Number.isFinite(v.x) && Number.isFinite(v.y) && v.x >= 2)).toBe(true);
});
