/**
 * One-off helper: emit synthetic bland reference tracks.
 *
 * These are deliberately uninteresting tracks that serve as the negative
 * anchor for metric validation. A "cool" metric must rank these below
 * any cool reference track.
 *
 *   npx tsx scripts/build_reference_blands.ts
 *
 * Writes:
 *   eval/references/bland/monotone_slide.track.json
 *   eval/references/bland/chopped_uniform.track.json
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
    creator: "line/build_reference_blands.ts",
    description: "Synthetic bland anchor for metric validation",
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

function line(id: number, x1: number, y1: number, x2: number, y2: number): Line {
  return { id, type: 0, x1, y1, x2, y2, flipped: false, leftExtended: false, rightExtended: false };
}

// ── 1. Monotone slide ──
// One ultra-long, ultra-shallow line. Rider slides on it for the full
// duration. Zero angle variance, minimal vertical extent for the path
// the rider actually travels. This is the floor of bland.
const monotoneLines: Line[] = [
  // Place line slightly below rider so it falls onto it within first few frames.
  line(1, -50, 10, 8000, 200), // (200 - 10) / (8000 - (-50)) ≈ 1.4° downward slope
];
const monotoneTrack = wrap("synthetic-monotone-slide", monotoneLines);

// ── 2. Chopped uniform ──
// Many identical horizontal stubs, back-to-back at the same Y. Zero angle
// variance, zero vertical extent, high feature count. Tests whether
// "lots of lines" alone fools a diversity metric.
const choppedLines: Line[] = [];
const stubLen = 30;
const stubCount = 200;
for (let i = 0; i < stubCount; i++) {
  const x0 = -50 + i * stubLen;
  choppedLines.push(line(i + 1, x0, 30, x0 + stubLen, 30));
}
const choppedTrack = wrap("synthetic-chopped-uniform", choppedLines);

// ── Write ──
const outDir = resolve("eval/references/bland");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  resolve(outDir, "monotone_slide.track.json"),
  JSON.stringify(monotoneTrack, null, 2),
);
writeFileSync(
  resolve(outDir, "chopped_uniform.track.json"),
  JSON.stringify(choppedTrack, null, 2),
);
console.log("wrote eval/references/bland/{monotone_slide,chopped_uniform}.track.json");
