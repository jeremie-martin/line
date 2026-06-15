/**
 * "Shelter" (Porter Robinson & Madeon) — first 1:21, music-aligned impact spec.
 *
 * This is a more literal music-synced alternative to `shelter_impact.ts`.
 * The earlier amplitude spec deliberately removed some phrase/downbeat contacts
 * to create long showpiece jumps; that looked good but skipped audible hard drum
 * hits around e.g. 42.9s / 43.5s / 44.1s. This spec keeps the grid dense where
 * the song has a real drum bed, then opens longer amplitude gaps only where the
 * music actually breathes.
 *
 * Madmom read (beats/shelter_81s.mp3):
 *   100 BPM, 4/4, downbeats every 2.4s, phrase lines at
 *   0.33 / 9.93 / 19.53 / 29.13 / 38.73 / 48.33 / 57.93 / 67.53 / 77.13.
 *   Onset energy is strong through 19.5-39.3s, then busy/hard again through
 *   40.5-57.9s, including the 42.93 / 43.53 / 44.13 drum fill.
 *
 * Contact design:
 *   INTRO  sparse 1.2s bounces.
 *   HOOK   dense 0.6s pulse into the drums.
 *   DRUMS  every 0.6s beat, 19.53-39.33s, matching the audible kick/snare bed.
 *   CHORUS selected hard onsets/fills, including 42.93 / 43.53 / 44.13, with
 *          longer gaps only around lower-energy breaths.
 *   DROP/BREAK restore showpiece gaps where the music thins out.
 */
import type { Contact, Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";
import { withImpactLegacy } from "../core/beats.ts";
import { SHELTER_81_MUSIC } from "./_music.ts";

const ANCHOR = 0.33;
const PERIOD = 0.6;

// RNNOnsetProcessor peak in a +/-120ms window around each 100 BPM grid beat,
// normalized by the beat-grid p95. This is a listening aid baked into the spec:
// it shapes impact without asking the compiler to infer musical intensity.
const onsetEnergy = [
  0.81, 0.94, 0.85, 0.94, 0.97, 0.85, 0.71, 0.59, 0.61, 0.80,
  0.71, 0.83, 0.87, 0.87, 0.88, 0.72, 0.61, 0.89, 0.84, 0.97,
  0.65, 0.95, 0.72, 0.85, 0.63, 0.93, 0.80, 0.85, 0.55, 0.61,
  0.81, 0.83, 0.76, 0.76, 0.75, 0.85, 0.97, 0.90, 0.57, 0.70,
  1.00, 0.82, 0.68, 0.96, 0.58, 0.93, 0.87, 0.92, 0.76, 0.85,
  0.54, 0.90, 0.87, 0.80, 0.58, 0.58, 1.00, 0.82, 0.62, 0.87,
  0.79, 0.92, 0.85, 1.00, 1.00, 0.98, 0.76, 1.00, 0.59, 0.87,
  0.65, 0.90, 0.81, 0.92, 0.71, 0.89, 0.77, 0.80, 0.68, 0.90,
  0.77, 0.85, 0.59, 0.79, 0.52, 0.91, 0.90, 0.95, 0.98, 0.92,
  0.62, 0.88, 0.85, 0.88, 0.86, 0.97, 0.70, 0.70, 0.78, 0.90,
  0.94, 0.78, 0.81, 0.77, 1.00, 0.49, 0.57, 0.63, 0.86, 0.79,
  0.53, 0.92, 0.76, 1.00, 0.58, 0.74, 0.74, 0.94, 0.85, 0.91,
  0.87, 1.00, 0.83, 0.45, 0.51, 0.27, 0.83, 0.66, 0.99, 0.91,
  0.79, 0.88, 0.94, 0.93, 0.68,
];

const phraseHits = [0.33, 9.93, 19.53, 29.13, 38.73, 48.33, 57.93, 67.53, 77.13];
const hardDrumHits = [
  19.53, 21.93, 22.53, 24.33, 26.13, 27.33, 28.53, 30.93, 31.53,
  33.93, 36.93, 38.13, 38.73, 39.33, 40.53, 42.93, 43.53, 44.13,
  45.33, 45.93, 47.73, 48.33, 51.33, 51.93, 52.53, 53.13, 53.73,
  54.93, 55.53, 56.13, 57.33, 68.13, 70.53, 71.13, 71.73, 72.33,
  72.93, 77.13, 79.53, 80.13,
];

function beatTime(i: number): number {
  return Math.round((ANCHOR + i * PERIOD) * 100) / 100;
}

function beatIndex(t: number): number {
  const i = Math.round((t - ANCHOR) / PERIOD);
  const snapped = beatTime(i);
  if (Math.abs(snapped - t) > 0.02) {
    throw new Error(`contact ${t} is not on the 100 BPM Shelter grid`);
  }
  return i;
}

function near(t: number, xs: number[], eps = 0.04): boolean {
  return xs.some((x) => Math.abs(t - x) <= eps);
}

function addRange(indices: Set<number>, t0: number, t1: number, stride: number): void {
  for (let i = beatIndex(t0); i <= beatIndex(t1); i += stride) indices.add(i);
}

function addHits(indices: Set<number>, ts: number[]): void {
  for (const t of ts) indices.add(beatIndex(t));
}

function sectionBase(t: number): number {
  if (t < 9.93) return 0.16;
  if (t < 19.53) return 0.28;
  if (t < 38.73) return 0.44;
  if (t < 57.93) return 0.50;
  if (t < 67.53) return 0.32;
  if (t < 72.93) return 0.55;
  if (t < 76.53) return 0.18;
  return 0.40;
}

function sectionScale(t: number): number {
  if (t < 9.93) return 0.22;
  if (t < 19.53) return 0.22;
  if (t < 38.73) return 0.34;
  if (t < 57.93) return 0.34;
  if (t < 67.53) return 0.26;
  if (t < 72.93) return 0.35;
  if (t < 76.53) return 0.20;
  return 0.28;
}

// Authored under the pre-redirArc impact convention; withImpactLegacy migrates
// these values once to the current redirArc felt scale at spec load.
function impactAt(t: number, energy: number): number {
  let v = sectionBase(t) + sectionScale(t) * energy;
  if (near(t, phraseHits)) v += 0.06;
  if (near(t, hardDrumHits)) v += 0.10;
  // Make the voice/break dip visibly lighter without removing the beat grid.
  if (t >= 72.93 && t < 76.53) v -= 0.08;
  return Math.max(0.12, Math.min(1, v));
}

const contactIndices = new Set<number>();

// Sparse intro bounces, then a dense pulse through the full 19.5-39.3s drum bed.
addRange(contactIndices, 0.33, 9.93, 2);
addRange(contactIndices, 9.93, 39.33, 1);

// Chorus/fill: keep the audible hard onsets, especially the 42.93/43.53/44.13
// drum fill, but leave lower-energy gaps for amplitude to read.
addHits(contactIndices, [
  39.93, 40.53, 41.73, 42.33, 42.93, 43.53, 44.13, 44.73, 45.33, 45.93,
  47.73, 48.33, 48.93, 50.13, 51.33, 51.93, 52.53, 53.13, 53.73, 54.93,
  55.53, 56.13, 56.73, 57.33, 57.93,
]);

// Regroup tightly, then reopen at the second drop and voice/break.
addRange(contactIndices, 57.93, 67.53, 1);
addHits(contactIndices, [
  68.13, 68.73, 70.53, 71.13, 71.73, 72.33, 72.93,
  74.13, 75.93, 77.13, 78.33, 79.53, 80.13, 80.73,
]);

const contacts: Contact[] = withImpactLegacy([...contactIndices].sort((a, b) => a - b).map((i) => {
  const t = beatTime(i);
  return { t };
}), (t) => impactAt(t, onsetEnergy[beatIndex(t)] ?? 0.5));

export const overlayMeta = {
  title: "SHELTER",
  artist: "PORTER ROBINSON & MADEON",
  tempo: "100 BPM · 4/4 · aligned impact",
  phases: [
    { name: "INTRO", t0: 0, t1: 9.93, color: "#5b8def" },
    { name: "HOOK", t0: 9.93, t1: 19.53, color: "#3fb6a8" },
    { name: "DRUMS", t0: 19.53, t1: 38.73, color: "#f0b429" },
    { name: "CHORUS", t0: 38.73, t1: 57.93, color: "#f24f4f" },
    { name: "DIP", t0: 57.93, t1: 67.53, color: "#6c8cf2" },
    { name: "DROP", t0: 67.53, t1: 72.93, color: "#f0792f" },
    { name: "BREAK", t0: 72.93, t1: 76.53, color: "#a06cf2" },
    { name: "OUTRO", t0: 76.53, t1: 81.0, color: "#7aa35a" },
  ],
};

const spec: Spec = {
  duration: 81,
  music: SHELTER_81_MUSIC,
  contacts,
  jitter: 0,
  axes: {
    // Keep dense drum sections honest, then spend amplitude on real musical
    // openings: chorus breaths, second drop, and the voice/break.
    amplitude: keyframes([
      { t: 0, v: 0.06, ease: "smooth" },
      { t: 1.53, v: 0.42, ease: "smooth" },
      { t: 7.53, v: 0.58, ease: "easeOut" },
      { t: 9.93, v: 0.08, ease: "smooth" },
      { t: 19.53, v: 0.10, ease: "smooth" },
      { t: 38.73, v: 0.12, ease: "smooth" },
      { t: 45.93, v: 0.18, ease: "smooth" },
      { t: 47.73, v: 0.58, ease: "easeOut" },
      { t: 50.13, v: 0.46, ease: "smooth" },
      { t: 51.33, v: 0.22, ease: "smooth" },
      { t: 57.93, v: 0.12, ease: "easeOut" },
      { t: 67.53, v: 0.18, ease: "smooth" },
      { t: 68.73, v: 0.24, ease: "smooth" },
      { t: 70.53, v: 0.86, ease: "easeOut" },
      { t: 72.93, v: 0.34, ease: "easeOut" },
      { t: 74.13, v: 0.56, ease: "smooth" },
      { t: 75.93, v: 0.95, ease: "easeOut" },
      { t: 77.13, v: 0.42, ease: "smooth" },
      { t: 81.0, v: 0.34 },
    ]),
    air: keyframes([
      { t: 0, v: 0.48, ease: "easeIn" },
      { t: 9.93, v: 0.55, ease: "smooth" },
      { t: 19.53, v: 0.60, ease: "smooth" },
      { t: 29.13, v: 0.64, ease: "smooth" },
      { t: 38.73, v: 0.70, ease: "smooth" },
      { t: 43.53, v: 0.66, ease: "smooth" },
      { t: 48.33, v: 0.74, ease: "smooth" },
      { t: 57.93, v: 0.60, ease: "easeOut" },
      { t: 67.53, v: 0.70, ease: "smooth" },
      { t: 72.93, v: 0.78, ease: "easeOut" },
      { t: 76.53, v: 0.62, ease: "smooth" },
      { t: 81.0, v: 0.56 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.36, ease: "easeIn" },
      { t: 9.93, v: 0.52, ease: "smooth" },
      { t: 19.53, v: 0.62, ease: "smooth" },
      { t: 29.13, v: 0.68, ease: "smooth" },
      { t: 38.73, v: 0.76, ease: "smooth" },
      { t: 43.53, v: 0.70, ease: "smooth" },
      { t: 48.33, v: 0.74, ease: "smooth" },
      { t: 57.93, v: 0.60, ease: "easeOut" },
      { t: 67.53, v: 0.72, ease: "smooth" },
      { t: 72.93, v: 0.64, ease: "easeOut" },
      { t: 76.53, v: 0.56, ease: "smooth" },
      { t: 81.0, v: 0.52 },
    ]),
  },
};

export default spec;
