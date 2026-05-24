/**
 * Probe: place a single stub at a target frame on the swooping route,
 * vary stub geometry, report what kind of event (if any) fires near it.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { materializeRoute } from "./lib/route.ts";
import { simulateTrack } from "./lib/metrics.ts";
import swooping from "../templates/swooping.ts";
import { type TrackJson, type TrackLine } from "./lib/primitive.ts";

const TARGET_F = 100;
const ROUTE = materializeRoute(swooping, { label: "test", durationFrames: 1200 });
const baseDet = simulateTrack(ROUTE);
const baseSurvived = baseDet.terminus.reason === "endOfSpec";
const basePos = baseDet.measurements.position[TARGET_F];
const basePrev = baseDet.measurements.position[TARGET_F - 1];
let dx = basePos.x - basePrev.x, dy = basePos.y - basePrev.y;
const mag = Math.hypot(dx, dy);
dx /= mag; dy /= mag;

console.log(`route base: survived=${baseSurvived}, terminus=${baseDet.terminus.frame}/${baseDet.terminus.reason}, events=${baseDet.events.length}`);
console.log(`at frame ${TARGET_F}: pos=(${basePos.x.toFixed(0)},${basePos.y.toFixed(0)}), v=(${dx.toFixed(2)},${dy.toFixed(2)})`);
console.log("");

type Trial = { name: string; offsetX: number; offsetY: number; halfLen: number; angleDeg: number };
const trials: Trial[] = [
  // Below rider (stub in path)
  { name: "below-2 horiz", offsetX: 0, offsetY: 2,  halfLen: 4, angleDeg: 0 },
  { name: "below-2 perp",  offsetX: 0, offsetY: 2,  halfLen: 4, angleDeg: 90 },
  { name: "below-4 perp",  offsetX: 0, offsetY: 4,  halfLen: 4, angleDeg: 90 },
  { name: "below-6 perp",  offsetX: 0, offsetY: 6,  halfLen: 4, angleDeg: 90 },
  // Above rider (ceiling stub)
  { name: "above-5 horiz",  offsetX: 0, offsetY: -5,  halfLen: 4, angleDeg: 0 },
  { name: "above-7 horiz",  offsetX: 0, offsetY: -7,  halfLen: 4, angleDeg: 0 },
  { name: "above-9 horiz",  offsetX: 0, offsetY: -9,  halfLen: 4, angleDeg: 0 },
  { name: "above-12 horiz", offsetX: 0, offsetY: -12, halfLen: 4, angleDeg: 0 },
  { name: "above-15 horiz", offsetX: 0, offsetY: -15, halfLen: 4, angleDeg: 0 },
  // Ahead with vertical short line ("speed bump")
  { name: "ahead-vert-4", offsetX: 10, offsetY: 0, halfLen: 4, angleDeg: 90 },
  { name: "ahead-vert-2", offsetX: 10, offsetY: 0, halfLen: 2, angleDeg: 90 },
  // Below rider with small angle
  { name: "below-2 ang-10",  offsetX: 0, offsetY: 2,  halfLen: 4, angleDeg: 10 },
  { name: "below-2 ang-15",  offsetX: 0, offsetY: 2,  halfLen: 4, angleDeg: 15 },
];

for (const trial of trials) {
  const rad = ((trial.angleDeg) * Math.PI) / 180;
  // Stub direction = rotate (dx, dy) by trial.angleDeg
  const cr = Math.cos(rad), sr = Math.sin(rad);
  const sdx = dx * cr - dy * sr;
  const sdy = dx * sr + dy * cr;
  const cx = basePos.x + trial.offsetX;
  const cy = basePos.y + trial.offsetY;
  const stub: TrackLine = {
    id: 999_999, type: 0,
    x1: cx - sdx * trial.halfLen, y1: cy - sdy * trial.halfLen,
    x2: cx + sdx * trial.halfLen, y2: cy + sdy * trial.halfLen,
    flipped: false, leftExtended: false, rightExtended: false,
  };
  const track: TrackJson = { ...ROUTE, lines: [...ROUTE.lines, stub] };
  const det = simulateTrack(track);
  const surv = det.terminus.reason === "endOfSpec";
  // Count events near target frame
  const nearEvents = det.events.filter((e) => Math.abs(e.frame - TARGET_F) <= 10);
  const baseNear = baseDet.events.filter((e) => Math.abs(e.frame - TARGET_F) <= 10);
  const newEvents = nearEvents.length - baseNear.length;
  console.log(`${trial.name.padEnd(20)} surv=${surv ? "Y" : "N"} terminus=${det.terminus.frame.toString().padStart(4)}/${det.terminus.reason.padEnd(13)}  nearEvents=${nearEvents.length} (Δ${newEvents >= 0 ? "+" : ""}${newEvents}): ${nearEvents.map(e => `${e.type}@${e.frame}`).join(", ")}`);
}
