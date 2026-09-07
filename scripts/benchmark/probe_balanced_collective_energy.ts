/** Physical response probe only; angular response here is not scored impact. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LineRiderEngine, disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { getRiderMetered, getPhysicsFrameCount } from "../lib/detector.ts";
import { collectiveContactPulse } from "./collective_contact_pulse.ts";
import { nativeRailLayers } from "./native_rail_layers.ts";
const out = process.argv.find(a => a.startsWith("--out="))?.slice(6);
if (!out) throw new Error("--out required");
const hash = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
const rows: any[] = [], started = getPhysicsFrameCount();
try {
  const base = new LineRiderEngine().setStart({ x: 0, y: 0 }, { x: 10, y: 0 });
  const before = JSON.stringify(getRiderMetered(base, 19).ballisticState());
  const arrival = getRiderMetered(base, 20), packet = arrival.ballisticState(), originalAngle = Math.atan2(arrival.velocity.y, arrival.velocity.x);
  const neutral21 = getRiderMetered(base, 21).velocity, neutral25 = getRiderMetered(base, 25).velocity;
  for (const normalTurn of [-1, -0.6, 0.6, 1]) for (const layers of [4, 16, 32]) for (const energy of [-1, 1] as const) {
    const pulses = nativeRailLayers(collectiveContactPulse(Object.values(packet.points) as Array<{ x: number; y: number }>,
      arrival.velocity, normalTurn, 0.1, 0.5, 100), arrival.velocity, layers, 0.001, energy);
    const first = base.addLine(pulses);
    if (JSON.stringify(getRiderMetered(first, 19).ballisticState()) !== before) continue;
    const first21 = getRiderMetered(first, 21), firstPacket = JSON.stringify(first21.ballisticState());
    const laterRider = getRiderMetered(first, 22), later = laterRider.ballisticState();
    const secondTurn = originalAngle + normalTurn - Math.atan2(laterRider.velocity.y, laterRider.velocity.x);
    for (const ratio of [0.5, 1, 1.5]) {
      const second = nativeRailLayers(collectiveContactPulse(Object.values(later.points) as Array<{ x: number; y: number }>,
        laterRider.velocity, secondTurn, 0.1, 0.5, 100 + pulses.length), arrival.velocity,
        Math.max(1, Math.round(layers * ratio)), 0.001, energy === 1 ? -1 : 1);
      const candidate = first.addLine(second);
      const causal = JSON.stringify(getRiderMetered(candidate, 21).ballisticState()) === firstPacket;
      const last = getRiderMetered(candidate, 25), state = last.ballisticState();
      const firstResponse = Math.hypot(first21.velocity.x - neutral21.x, first21.velocity.y - neutral21.y);
      const finalResidual = Math.hypot(last.velocity.x - neutral25.x, last.velocity.y - neutral25.y);
      rows.push({ normalTurn, layers, energy, ratio, secondTurn, causal,
        intact: state.riderMounted && state.sledIntact, firstResponse, finalResidual });
    }
  }
} finally { disposeAllWasmEnginesForStudy(); }
const report = { schema: "line.balanced-collective-energy-authority.v1", researchOnly: true,
  implementation: hash(readFileSync(fileURLToPath(import.meta.url))), frames: getPhysicsFrameCount() - started, rows };
const body = JSON.stringify(report) + "\n";
writeFileSync(out, body); writeFileSync(out + ".sha256", hash(body) + "\n");
console.log(JSON.stringify({ frames: report.frames, candidates: rows.length,
  strongest: rows.filter(r => r.causal && r.intact).sort((a, b) => (b.firstResponse - b.finalResidual) - (a.firstResponse - a.finalResidual)).slice(0, 8) }));
