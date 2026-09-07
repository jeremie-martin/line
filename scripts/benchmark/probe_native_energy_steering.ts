/** Physical inversion probe; scored impact still requires complete-track tests. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LineRiderEngine, disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { getRiderMetered, getPhysicsFrameCount } from "../lib/detector.ts";
import { collectiveContactPulse } from "./collective_contact_pulse.ts";
import { nativeRailLayers } from "./native_rail_layers.ts";
import { nativeEnergySteering } from "./native_energy_steering.ts";
const out = process.argv.find(a => a.startsWith("--out="))?.slice(6);
if (!out) throw new Error("--out required");
const hash = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
const rows: any[] = [], started = getPhysicsFrameCount();
try {
  const base = new LineRiderEngine().setStart({ x: 0, y: 0 }, { x: 10, y: 0 });
  const before = JSON.stringify(getRiderMetered(base, 19).ballisticState());
  const arrival = getRiderMetered(base, 20), points = Object.values(arrival.ballisticState().points) as Array<{ x: number; y: number }>;
  const neutral = getRiderMetered(base, 21).velocity;
  for (const speedRatio of [0.8, 1, 1.2]) for (const turn of [-0.6, -0.3, -0.15, 0.15, 0.3, 0.6]) for (const depth of [0.02, 0.1, 0.5]) {
    const steering = nativeEnergySteering(arrival.velocity, Math.hypot(arrival.velocity.x, arrival.velocity.y) * speedRatio, turn)!;
    const pulses = nativeRailLayers(collectiveContactPulse(points, arrival.velocity, steering.normalTurn, depth, 0.5, 100),
      arrival.velocity, steering.layers, 0.001, steering.energy);
    const engine = base.addLine(pulses);
    const causal = JSON.stringify(getRiderMetered(engine, 19).ballisticState()) === before;
    const actual = getRiderMetered(engine, 21).velocity, later = getRiderMetered(engine, 25).ballisticState();
    const response = { x: actual.x - neutral.x, y: actual.y - neutral.y };
    const desired = steering.desiredDelta;
    const relativeError = Math.hypot(response.x - desired.x, response.y - desired.y) / Math.hypot(desired.x, desired.y);
    rows.push({ speedRatio, turn, depth, steering, causal, intact: later.sledIntact && later.riderMounted, response, relativeError });
  }
} finally { disposeAllWasmEnginesForStudy(); }
const report = { schema: "line.native-energy-steering-authority.v1", researchOnly: true,
  implementation: [fileURLToPath(import.meta.url), "scripts/benchmark/native_energy_steering.ts"].map(p => hash(readFileSync(p))),
  frames: getPhysicsFrameCount() - started, rows };
const body = JSON.stringify(report) + "\n";
writeFileSync(out, body); writeFileSync(out + ".sha256", hash(body) + "\n");
console.log(JSON.stringify({ frames: report.frames, candidates: rows.length,
  faithful: rows.filter(r => r.causal && r.intact && r.relativeError < 0.5).length,
  strongest: rows.filter(r => r.causal && r.intact).sort((a, b) => a.relativeError - b.relativeError).slice(0, 6) }));
