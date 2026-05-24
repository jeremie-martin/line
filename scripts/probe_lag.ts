import { materializeRoute } from "./lib/route.ts";
import { simulateTrack } from "./lib/metrics.ts";
import swooping from "../templates/swooping.ts";
import { type TrackLine, type TrackJson } from "./lib/primitive.ts";

const ROUTE = materializeRoute(swooping, { label: "test", durationFrames: 1200 });
const baseDet = simulateTrack(ROUTE);

for (const targetF of [80, 100, 150, 200, 300, 500, 700, 900]) {
  if (targetF >= baseDet.terminus.frame) { console.log(`f=${targetF}: past terminus`); continue; }
  const pos = baseDet.measurements.position[targetF];
  const prev = baseDet.measurements.position[targetF - 1];
  let dx = pos.x - prev.x, dy = pos.y - prev.y;
  const mag = Math.hypot(dx, dy);
  if (mag < 0.1) { console.log(`f=${targetF}: rider not moving`); continue; }
  dx /= mag; dy /= mag;
  const HALF = 4;
  const stub: TrackLine = {
    id: 999_999, type: 0,
    x1: pos.x - dx * HALF, y1: pos.y + 2 - dy * HALF,
    x2: pos.x + dx * HALF, y2: pos.y + 2 + dy * HALF,
    flipped: false, leftExtended: false, rightExtended: false,
  };
  const track: TrackJson = { ...ROUTE, lines: [...ROUTE.lines, stub] };
  const det = simulateTrack(track);
  const baseNear = baseDet.events.filter(e => Math.abs(e.frame - targetF) <= 20);
  const fitNear = det.events.filter(e => Math.abs(e.frame - targetF) <= 20);
  const newEvents = fitNear.filter(fe => !baseNear.some(be => be.frame === fe.frame && be.type === fe.type));
  const surv = det.terminus.reason === "endOfSpec";
  console.log(`f=${targetF.toString().padStart(4)} pos=(${pos.x.toFixed(0)},${pos.y.toFixed(0)}) surv=${surv?"Y":"N"}/${det.terminus.frame}  new evts: ${newEvents.map(e => `${e.type}@${e.frame}(Δ${e.frame-targetF})`).join(", ") || "(none)"}`);
}
