import { expect, it } from "vitest";
import { LineRiderEngine as Search, disposeAllWasmEnginesForStudy as disposeSearch } from "../scripts/lib/native_motion/engine.ts";
import { LineRiderEngine as Judge, disposeAllWasmEnginesForStudy as disposeJudge } from "../scripts/lib/_lr_engine_wasm.ts";
import { extractRawTrajectory, getRiderMetered, setPhysicsFrameLimit } from "../scripts/lib/detector.ts";
import { pointwiseNormalProjection } from "../scripts/v0/optimizer/normal_pointwise_projection.ts";

it("supports vertically aligned rider points with ordinary planes without collapsing the sled", () => {
  setPhysicsFrameLimit(null);
  const position = { x: 0, y: 0 }, velocity = { x: 7.79, y: -0.047 };
  try {
    const parent = new Search().setStart(position, velocity);
    const predicted = getRiderMetered(parent, 2).ballisticState();
    parent.prepareCollisionTrace(1); getRiderMetered(parent, 1);
    const trace = parent.readCollisionTrace()[0];
    const points = Object.keys(trace).map(id => ({ ...trace[id], nextVx: predicted.points[id].vx, nextVy: predicted.points[id].vy }));
    const lines = pointwiseNormalProjection(points, points.map(() => velocity), 0.0005, 100, 1, true);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every(l => l.type === 0)).toBe(true);
    const child = parent.addLine(lines), state = getRiderMetered(child, 2).ballisticState();
    expect(state.riderMounted && state.sledIntact).toBe(true);
    expect(child.getUpdatesAtFrame(1).some((u: any) => u.type === "CollisionUpdate" &&
      u.updated.some((p: any) => ["PEG", "TAIL", "NOSE", "STRING"].includes(p.id)))).toBe(true);
    expect(extractRawTrajectory(child, 12)).toEqual(extractRawTrajectory(new Judge().setStart(position, velocity).addLine(lines), 12));
  } finally { disposeSearch(); disposeJudge(); setPhysicsFrameLimit(null); }
});
