/**
 * L'amour de ma vie — short cut (1:21.5–2:06, 44.5s).  v2 — salience-driven.
 *
 * Beats come from the rich analysis (reused: scripts/analyze_rhythm.py →
 * beats/amour_de_ma_vie_short.rhythm.json). Contacts are the SALIENT onsets the
 * groove actually lands on — not a metronomic grid. This reproduces the hand
 * annotations (a contact-score ≥ 0.55 recovers every marked hit at the start,
 * with none extra), and the per-onset `impact` score matches the felt intensity
 * (strong ≈ 0.9, medium ≈ 0.79, low ≈ 0.48).
 *
 * The song is a fast, syncopated eighth-note groove (~90 BPM, 4/4), so some
 * salient hits sit ~0.30s apart ("reaching it"): we keep them because they ARE
 * the rhythm. Contact times use the analysis's event_t (attack-accurate).
 *
 * Controlled axes: AIR, SPEED, IMPACT (no elevation/amplitude). v2 = beats +
 * impact from the analysis; air/speed/camera still placeholder, tuned next.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";
import { beats } from "../core/beats.ts";

type GridRow = { t: number; timing?: { event_t?: number | null }; scores: { contact: number; impact: number } };
const rhythm = JSON.parse(
  readFileSync(resolve("beats/amour_de_ma_vie_short.rhythm.json"), "utf8"),
) as { grid: GridRow[]; primary_beats: number[] };

// A pulse-grid point is a real landing if its contact-salience clears this bar.
// 0.55 was fit to the hand annotations: it keeps every marked hit (down to the
// "low-medium" at 0.57) and drops the onsets that weren't marked (≤0.50).
const CONTACT_MIN = 0.55;
const FIRST_BEAT = 3.15;  // the intro before the first true beat (3.20) stays quiet
const TAIL_START = 27.0;  // analyze_rhythm's onset salience dies here; the rest is hand-mapped
const FILL_GAP = 0.85;    // a quiet filler landing wherever a first-part void exceeds this
const IMP_STRONG = 0.9, IMP_MED = 0.6;

const tOf = (g: GridRow) => g.timing?.event_t ?? g.t;

// --- First part (0..27s): the analysis nails it. Salient onsets = landings,
//     impact = felt intensity; the intro before the first true beat forced quiet. ---
const firstPart = rhythm.grid
  .filter((g) => g.scores.contact >= CONTACT_MIN && tOf(g) < TAIL_START)
  .map((g) => ({ t: tOf(g), impact: tOf(g) < FIRST_BEAT ? 0.1 : g.scores.impact }));
// quiet fillers in any first-part void (mainly the speed-building intro)
for (const b of rhythm.primary_beats) {
  if (b < TAIL_START && !firstPart.some((c) => Math.abs(c.t - b) < FILL_GAP)) {
    firstPart.push({ t: b, impact: 0.1 });
  }
}

// --- Tail (27s..end): analyze_rhythm UNDER-scored this sustained section, but it
//     has a clear strong/medium backbeat on the primary grid (your annotations
//     land exactly on the grid). Replay your marks, then extend the alternating
//     pulse to the end, finishing on a strong hit (~44.2). ---
const tailFixed: Array<[number, number]> = [
  [27.22, IMP_STRONG], [27.56, IMP_STRONG], // pickup hits (27.56 scored just under threshold)
  [28.56, IMP_STRONG], [29.22, IMP_MED], [29.89, IMP_STRONG], [30.55, IMP_MED],
  [31.22, IMP_STRONG], [31.88, IMP_MED], [32.56, IMP_STRONG],
];
const TAIL_ANCHOR = 32.56;
const tailExt: Array<{ t: number; impact: number }> = [];
let strong = false; // 32.56 was strong → next grid beat is medium
for (const b of rhythm.primary_beats) {
  if (b <= TAIL_ANCHOR + 0.2) continue;
  tailExt.push({ t: b, impact: strong ? IMP_STRONG : IMP_MED });
  strong = !strong;
}
if (tailExt.length) tailExt[tailExt.length - 1].impact = IMP_STRONG; // end on a strong hit

const contacts = beats(
  [...firstPart, ...tailFixed.map(([t, impact]) => ({ t, impact })), ...tailExt].sort((a, b) => a.t - b.t),
);

const spec: Spec = {
  duration: 44.544,
  music: {
    audio: "beats/amour_de_ma_vie_short.mp3",
    title: "L'amour de ma vie",
    artist: "cut 1:21.5–2:06",
    tempo: "~90 BPM · 4/4 (syncopated)",
    beats: "beats/amour_de_ma_vie_short.rhythm.json",
    spectrogram: {
      image: "beats/amour_de_ma_vie_short.spectrogram.png",
      metadata: "beats/amour_de_ma_vie_short.spectrogram.json",
    },
  },
  contacts,
  // Start slightly elevated and let the intro build speed fast into the first beat.
  start: { vx: 5, vy: 0, y: -180 },
  axes: {
    // AIR + SPEED only (elevation/amplitude omitted = no-op).
    // Low air + fast speed in the intro (build momentum), peak air through the
    // 17.5–30s "coolest" zone, settle after.
    air: keyframes([
      { t: 0.0, v: 0.4, ease: "smooth" },
      { t: 3.2, v: 0.48, ease: "smooth" },
      { t: 17.5, v: 0.66, ease: "smooth" },
      { t: 24.0, v: 0.72, ease: "smooth" },
      { t: 30.0, v: 0.62, ease: "easeOut" },
      { t: 44.5, v: 0.46 },
    ]),
    // Higher overall, ramped up fast by the first true beat, sustained-high
    // through the cool zone.
    speed: keyframes([
      { t: 0.0, v: 0.55, ease: "smooth" },
      { t: 3.2, v: 0.82, ease: "smooth" },
      { t: 17.5, v: 0.88, ease: "smooth" },
      { t: 30.0, v: 0.9, ease: "smooth" },
      { t: 44.5, v: 0.72 },
    ]),
  },
  camera: {
    zoom: {
      smoothingFrames: 10,
      keyframes: [
        { t: 0.0, zoom: 2.3 },
        { t: 17.5, zoom: 1.95 },
        { t: 30.0, zoom: 1.95 },
        { t: 44.5, zoom: 2.3 },
      ],
    },
  },
  preroll: 5,
};

export default spec;
