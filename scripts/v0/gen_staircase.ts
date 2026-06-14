/**
 * Hand-built synthetic track: a fast HORIZONTAL rider on PERFECTLY FLAT shelves, each shelf
 * ending so the rider free-falls straight down onto the next (lower) flat shelf — "fall from
 * one to the other". No curvature anywhere, so each landing isolates ONE thing: vertical
 * velocity (gained in the drop) killed by a flat surface. Drop heights escalate then ease,
 * giving a clean range of this flat-slam impact the user finds very impactful.
 *
 * Generates generated/staircase.track.json, simulates it, and reports each landing's metrics
 * vs its drop height — so we can see whether redirArc/turn scale with the felt slam.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/gen_staircase.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as SS from "./study_support.ts";

const VX = 9.5;                     // px/frame initial horizontal speed
const SLOPE = 0.07;                 // gentle shelf downslope (~4°) — lets the sled TRACK the
                                    // surface so it stays stable between drops (frictionless
                                    // dead-flat shelves never settle → eject after ~4 hits).
const drops = [35, 60, 95, 115, 90, 65, 45, 30, 80, 110, 55, 100, 40, 75]; // shelf-to-shelf altitude drops (px), capped under the eject ceiling
const FIRST_END = 380;              // x where shelf 0 ends (rider starts at x=0,y=0)

type Ln = { id: number; type: 0; x1: number; y1: number; x2: number; y2: number; flipped: false; leftExtended: false; rightExtended: false };
const lines: Ln[] = [];
let id = 1;
const addLine = (x1: number, y1: number, x2: number, y2: number) =>
  lines.push({ id: id++, type: 0, x1, y1, x2, y2, flipped: false, leftExtended: false, rightExtended: false });

// Shelf 0 passes through the rider start (0,0) at the downslope.
let leaveX = FIRST_END, leaveY = FIRST_END * SLOPE;
addLine(-400, -400 * SLOPE, FIRST_END, leaveY);
for (const D of drops) {
  // next shelf: sloped line through a point ~150px right of the leave point, D below it.
  const px = leaveX + 150, py = leaveY + D;
  const x1 = leaveX - 220, x2 = leaveX + 680;
  addLine(x1, py - SLOPE * (px - x1), x2, py + SLOPE * (x2 - px));
  leaveX = x2; leaveY = py + SLOPE * (x2 - px);
}

const track = {
  label: "staircase", creator: "impact-study", description: "flat shelves, fall from one to the next",
  duration: Math.ceil((leaveX / VX) + 80),
  version: "6.2", audio: null,
  startPosition: { x: 0, y: 0 },
  riders: [{ startPosition: { x: 0, y: 0 }, startVelocity: { x: VX, y: 0 }, remountable: 1 }],
  layers: [{ id: 0, name: "main", visible: true, editable: true }],
  script: "",
  lines,
};
const out = resolve("generated/staircase.track.json");
writeFileSync(out, JSON.stringify(track));
console.log(`wrote ${out} — ${lines.length} shelves, duration ${track.duration}f`);

// simulate + diagnose
const sim = SS.simulateTrack(track);
const counts: Record<string, number> = {};
for (const e of sim.det.events) counts[e.type] = (counts[e.type] ?? 0) + 1;
console.log(`\nterminus: frame ${sim.det.terminus.frame} (${(sim.det.terminus.frame / 40).toFixed(1)}s) reason=${sim.det.terminus.reason}`);
console.log(`events: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", ")}`);
const contacts = sim.det.events.filter((e) => (e.type === "landing" || e.type === "bounce") && e.frame > 2 && e.frame < sim.last - 1);
console.log(`\n${contacts.length} contact events (landing+bounce):\n`);
console.log("  #   t(s)  type     vy_in  speed | redirArc  turn  redir  comDecel");
contacts.forEach((e, i) => {
  const v0 = sim.vel[e.frame - 1] ?? sim.vel[e.frame];
  const speed = v0 ? Math.hypot(v0.x, v0.y) : 0, vy = v0 ? v0.y : 0;
  console.log(`  ${String(i).padEnd(3)} ${(e.frame / 40).toFixed(1).padStart(5)}  ${e.type.padEnd(8)} ${vy.toFixed(1).padStart(5)}  ${speed.toFixed(1).padStart(5)} | ` +
    `${SS.redirArcPx(sim, e.frame).toFixed(2).padStart(7)}  ${SS.turnNetDeg(sim, e.frame).toFixed(1).padStart(5)}  ${SS.redirPx(sim, e.frame).toFixed(2).padStart(5)}  ${SS.comDecelNormalPx(sim, e.frame).toFixed(2).padStart(6)}`);
});
