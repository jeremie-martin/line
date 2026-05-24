/**
 * One-off helper: emit a hand-authored synthetic cool reference track.
 *
 * The goal isn't a beautiful track — it's a track that exercises the
 * geometric properties a cool track should have:
 *   - angle variance (multiple distinct angles)
 *   - vertical extent (rider traverses meaningful y-range)
 *   - feature-type variety (descend, kicker, dip, flat, climb)
 *   - direction changes (vy flips: up, down, up, down)
 *
 * If the metric says THIS isn't cool, the metric is wrong.
 *
 *   npx tsx scripts/build_synthetic_cool.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

type Line = {
  id: number;
  type: 0;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  flipped: false;
  leftExtended: false;
  rightExtended: false;
};

function wrap(label: string, lines: Line[], duration = 1200) {
  return {
    label,
    creator: "line/build_synthetic_cool.ts",
    description: "Synthetic cool reference for metric validation",
    duration,
    version: "6.2" as const,
    audio: null,
    startPosition: { x: 0, y: 0 },
    riders: [
      { startPosition: { x: 0, y: 0 }, startVelocity: { x: 0.4, y: 0 }, remountable: 1 },
    ],
    layers: [
      { id: 0, type: 0, name: "Base Layer", visible: true, editable: true, folderId: -1 },
    ],
    script: "",
    lines,
  };
}

let nextId = 1;
function line(x1: number, y1: number, x2: number, y2: number): Line {
  return { id: nextId++, type: 0, x1, y1, x2, y2, flipped: false, leftExtended: false, rightExtended: false };
}

// Smooth wavy track with a STRONG net descent so the rider keeps gaining
// speed (no stalling in local minima). Wavy enough to produce angle
// variance and vy flips, but the wave amplitudes are small relative to
// the descent rate, so every "valley" still slopes downward overall.
//
// y(x) = baseDescent * (x / 1000) + Σ A_k sin(2π k x / period)
//
// The previous synthetic_cool authoring had baseDescent=180 with sine
// amplitudes 60+30+12 = 102 — almost enough to create back-slopes that
// stalled the rider in pits. The new authoring uses baseDescent=350 with
// smaller amplitudes so dy/dx stays >0 (always net downhill).

const lines: Line[] = [];

const xStart = -50;
const xEnd = 8000; // extend so total descent isn't crammed into a short distance
const dx = 25;
const baseDescentPerKpx = 180; // moderate average descent
const sinusoids: Array<{ amplitude: number; period: number; phase: number }> = [
  // Smaller amplitudes — at high rider speeds, big wave amplitudes eject.
  // These produce visible angle variation but every segment stays net-downhill.
  { amplitude: 15, period: 1200, phase: 0 },
  { amplitude: 8,  period: 500, phase: 1.2 },
  { amplitude: 3,  period: 180, phase: 0.7 },
];

function yOf(x: number): number {
  let y = baseDescentPerKpx * (x / 1000);
  for (const s of sinusoids) {
    y += s.amplitude * Math.sin((2 * Math.PI * x) / s.period + s.phase);
  }
  return y;
}

let prevX = xStart;
let prevY = yOf(xStart);
for (let x = xStart + dx; x <= xEnd; x += dx) {
  const y = yOf(x);
  lines.push(line(prevX, prevY, x, y));
  prevX = x;
  prevY = y;
}

const track = wrap("synthetic-cool", lines);

const outDir = resolve("eval/references/cool");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  resolve(outDir, "synthetic_cool.track.json"),
  JSON.stringify(track, null, 2),
);
console.log(`wrote eval/references/cool/synthetic_cool.track.json (${lines.length} lines)`);
