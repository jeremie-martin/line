/** Small native-physics authority probe, not benchmark evidence. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LineRiderEngine, disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { getRiderMetered, getPhysicsFrameCount } from "../lib/detector.ts";
import { collectiveContactPulse } from "./collective_contact_pulse.ts";
import { nativeRailLayers } from "./native_rail_layers.ts";
const path = process.argv.find(a => a.startsWith("--out="))?.slice(6);
if (!path) throw new Error("--out required");
const hash = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
const started = getPhysicsFrameCount(), rows: any[] = [];
try {
  const base = new LineRiderEngine().setStart({ x: 0, y: 0 }, { x: 10, y: 0 });
  const before = JSON.stringify(getRiderMetered(base, 19).ballisticState());
  const arrival = getRiderMetered(base, 20), points = Object.values(arrival.ballisticState().points) as Array<{ x: number; y: number }>;
  const unchanged = getRiderMetered(base, 21).velocity;
  for (const normalTurn of [-1.4, -1, -0.6, 0.6, 1, 1.4]) for (const depth of [0.02, 0.1, 0.5, 1.5])
    for (const layers of [1, 4, 16, 32]) for (const direction of [-1, 1] as const) {
      const pulse = collectiveContactPulse(points, arrival.velocity, normalTurn, depth, 0.5, 100);
      const lines = nativeRailLayers(pulse, arrival.velocity, layers, 0.001, direction);
      const engine = base.addLine(lines);
      const causal = JSON.stringify(getRiderMetered(engine, 19).ballisticState()) === before;
      const after = getRiderMetered(engine, 21).velocity, later = getRiderMetered(engine, 25).ballisticState();
      const delta = { x: after.x - unchanged.x, y: after.y - unchanged.y };
      rows.push({ normalTurn, depth, layers, direction, lines: lines.length, causal,
        intact: later.sledIntact && later.riderMounted, delta, magnitude: Math.hypot(delta.x, delta.y),
        speedDelta: Math.hypot(after.x, after.y) - Math.hypot(unchanged.x, unchanged.y) });
    }
} finally { disposeAllWasmEnginesForStudy(); }
const output = { schema: "line.collective-energy-authority.v1", researchOnly: true,
  implementation: [fileURLToPath(import.meta.url), "scripts/benchmark/collective_contact_pulse.ts",
    "scripts/benchmark/native_rail_layers.ts", "scripts/benchmark/whole_track_controls.ts"].map(p => hash(readFileSync(p))),
  engine: hash(readFileSync("engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm")),
  frames: getPhysicsFrameCount() - started, rows };
const body = JSON.stringify(output) + "\n";
writeFileSync(path, body); writeFileSync(path + ".sha256", hash(body) + "\n");
console.log(JSON.stringify({ frames: output.frames, admitted: rows.filter(r => r.causal && r.intact).length,
  strongest: rows.filter(r => r.causal && r.intact).sort((a, b) => b.magnitude - a.magnitude).slice(0, 6) }));
