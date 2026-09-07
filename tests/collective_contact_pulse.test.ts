import { expect, it } from "vitest";
import { LineRiderEngine, disposeAllWasmEnginesForStudy } from "../scripts/lib/_lr_engine_wasm.ts";
import { collectiveContactPulse } from "../scripts/benchmark/collective_contact_pulse.ts";

it("can turn the complete rider causally without breaking its bindings", () => {
  try {
    const base = new LineRiderEngine().setStart({ x: 0, y: 0 }, { x: 10, y: 0 });
    const before = base.getRider(19).ballisticState();
    const arrival = base.getRider(20), packet = arrival.ballisticState();
    const unchanged = base.getRider(21).velocity;
    const lines = collectiveContactPulse(Object.values(packet.points) as Array<{ x: number; y: number }>,
      arrival.velocity, -1, 3, 0.5, 100);
    const candidate = base.addLine(lines);
    expect(candidate.getRider(19).ballisticState()).toEqual(before);
    const after = candidate.getRider(21).velocity;
    expect(Math.hypot(after.x - unchanged.x, after.y - unchanged.y)).toBeGreaterThan(2);
    const later = candidate.getRider(25).ballisticState();
    expect(later.riderMounted && later.sledIntact).toBe(true);
  } finally { disposeAllWasmEnginesForStudy(); }
});
