/** Test inverse native forces at real captured contacts, before whole-track search. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LineRiderEngine, disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { getRiderMetered, getPhysicsFrameCount } from "../lib/detector.ts";
import { detectWindow } from "../v0/core/candidate.ts";
import { measureGapAxes } from "../v0/core/measure.ts";
import { findAuthoredContactNearFrame } from "../v0/core/substrate.ts";
import { impactToRawPx } from "../v0/types.ts";
import { pointwiseEnergyPulse } from "./pointwise_energy_pulse.ts";
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const input = resolve(arg("input") ?? "generated/benchmark-v2/unrestricted-650/first-completion-discovery-260907002");
const out = resolve(arg("out")!);
const calibrated = arg("calibrated") === "on";
const backendPath = arg("backend") ? resolve(arg("backend")!) : null;
const iteration = Number(arg("iteration") ?? 5);
const hash = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
const read = (p: string) => {
  const b = readFileSync(p);
  if (hash(b) !== readFileSync(p + ".sha256", "utf8").split(/\s/)[0]) throw new Error("checksum mismatch");
  return JSON.parse(b.toString());
};
if (backendPath) {
  const manifest = read(resolve(backendPath, "manifest.json"));
  for (const [p, h] of Object.entries(manifest.generated)) if (hash(readFileSync(resolve(backendPath, p))) !== h) throw new Error("backend changed");
}
const backend = backendPath ? await import(pathToFileURL(resolve(backendPath, "engine.ts")).href) : null;
const Engine = backend?.LineRiderEngine ?? LineRiderEngine;
const rows: any[] = [], inputs: any[] = [], started = getPhysicsFrameCount();
for (const sourceId of ["amplitude_tides", "frontier_dense_recovery", "regression_transition_mosaic", "believer_impact_56s"]) {
  const paths = ["capture", "track", "report"].map(k => resolve(input, `${sourceId}.${k}.json`));
  const [capture, track, report] = paths.map(read);
  inputs.push({ sourceId, hashes: paths.map(p => hash(readFileSync(p))) });
  try {
    const base = new Engine().setStart(track.startPosition, track.riders[0].startVelocity).addLine(track.lines);
    const selected = report.gaps.filter((g: any) => g.axes.impact?.target - g.axes.impact?.achieved > 0.05);
    const gaps = [...new Set(Array.from({ length: Math.min(12, selected.length) }, (_, i) => selected[Math.floor(i * selected.length / Math.min(12, selected.length))]))] as any[];
    for (const observed of gaps) {
      const gap = capture.context.gaps[observed.gap_index], h = gap.endFrame, phase = h + 2;
      const preserveInitial = JSON.stringify(getRiderMetered(base, h).ballisticState());
      const preserve = JSON.stringify(getRiderMetered(base, h - 2).ballisticState());
      let packet = getRiderMetered(base, phase).ballisticState();
      const next = getRiderMetered(base, phase + 1), nextPacket = next.ballisticState();
      if (backend) {
        base.prepareCollisionTrace(phase);
        getRiderMetered(base, phase);
        packet = { ...packet, points: base.readCollisionTrace()[iteration] };
      }
      const pointIds = Object.keys(packet.points);
      const points = pointIds.map(key => ({ ...packet.points[key],
        nextVx: nextPacket.points[key].vx, nextVy: nextPacket.points[key].vy }));
      const speed = Math.hypot(next.velocity.x, next.velocity.y), angle = Math.atan2(next.velocity.y, next.velocity.x);
      const needed = impactToRawPx(observed.axes.impact.target) - impactToRawPx(observed.axes.impact.achieved);
      const baseline = measureGapAxes(detectWindow(base, Math.max(0, gap.startFrame - 8), h + 8), gap, [], h);
      if (Math.abs(baseline.impact! - observed.axes.impact.achieved) > 1e-12) throw new Error("neutral contact mismatch");
      for (const coherent of [false, true]) for (const gain of [0.5, 1, 1.5]) for (const sign of [-1, 1]) {
        const turn = sign * gain * needed / speed;
        const desired = { x: speed * Math.cos(angle + turn), y: speed * Math.sin(angle + turn) };
        let pointGains: number[] | undefined;
        if (calibrated) {
          const pilot = pointwiseEnergyPulse(points, desired, next.velocity, coherent, 0.02, 0.5, 2000000, { layerCap: 1 });
          const pilotEngine = base.addLine(pilot), native = new Map(pilot.map(l => [l.id, l]));
          getRiderMetered(pilotEngine, phase);
          const impulses = new Map(pointIds.map(id => [id, { x: 0, y: 0 }]));
          for (const u of pilotEngine.getUpdatesAtFrame(phase)) if (u.type === "CollisionUpdate" && native.has(u.id)) {
            const line = native.get(u.id)!, length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
            for (const p of u.updated) {
              const impulse = impulses.get(p.id);
              if (impulse) { impulse.x += 0.1 * (line.x2 - line.x1) / length; impulse.y += 0.1 * (line.y2 - line.y1) / length; }
            }
          }
          pointGains = pointIds.map((id, j) => {
            const dx = desired.x - (coherent ? points[j].nextVx : next.velocity.x);
            const dy = desired.y - (coherent ? points[j].nextVy : next.velocity.y), impulse = impulses.get(id)!;
            const magnitude = Math.hypot(dx, dy);
            return magnitude > 1e-9 ? (impulse.x * dx + impulse.y * dy) / magnitude / 0.1 : 1;
          });
        }
        const lines = pointwiseEnergyPulse(points, desired, next.velocity, coherent, 0.02, 0.5, 2000000, { pointGains });
        const engine = base.addLine(lines), prefix = JSON.stringify(getRiderMetered(engine, h - 2).ballisticState()) === preserve;
        const captureUnchanged = JSON.stringify(getRiderMetered(engine, h).ballisticState()) === preserveInitial;
        const actual = getRiderMetered(engine, phase + 1).velocity;
        const det = detectWindow(engine, Math.max(0, gap.startFrame - 8), h + 8);
        const event = findAuthoredContactNearFrame(det, h, 1, h - gap.startFrame);
        const offbeat = det.events.some(e => e.type === "landing" && e.frame >= gap.startFrame &&
          !capture.context.allContactFrames.some((f: number) => Math.abs(f - e.frame) <= 1));
        const achieved = measureGapAxes(det, gap, lines, h);
        rows.push({ sourceId, gap: gap.index, coherent, gain, sign, calibrated, pointGains, lines: lines.length, prefix, captureUnchanged,
          terminus: det.terminus.reason, event: !!event, offbeat,
          valid: prefix && !!event && !offbeat && det.terminus.reason === "endOfSpec",
          impact: achieved.impact, originalImpact: baseline.impact, target: observed.axes.impact.target,
          velocityError: Math.hypot(actual.x - desired.x, actual.y - desired.y),
          desiredChange: Math.hypot(desired.x - next.velocity.x, desired.y - next.velocity.y) });
      }
    }
  } finally { backend?.disposeAllWasmEnginesForStudy(); disposeAllWasmEnginesForStudy(); }
}
const report = { schema: "line.contact-steering-probe.v1", researchOnly: true, inputs,
  backendManifestSha256: backendPath ? hash(readFileSync(resolve(backendPath, "manifest.json"))) : null, iteration,
  implementation: [fileURLToPath(import.meta.url), "scripts/benchmark/pointwise_energy_pulse.ts"].map(p => hash(readFileSync(p))),
  frames: getPhysicsFrameCount() - started, rows };
const body = JSON.stringify(report) + "\n";
writeFileSync(out, body); writeFileSync(out + ".sha256", hash(body) + "\n");
console.log(JSON.stringify({ frames: report.frames, groups: [false, true].map(coherent => {
  const selected = rows.filter(r => r.coherent === coherent), valid = selected.filter(r => r.valid);
  const useful = valid.filter(r => Math.abs(r.target - r.impact) < Math.abs(r.target - r.originalImpact) - 0.03);
  return { coherent, trials: selected.length, valid: valid.length, useful: useful.length,
    usefulContacts: new Set(useful.map(r => `${r.sourceId}/${r.gap}`)).size };
}) }));
