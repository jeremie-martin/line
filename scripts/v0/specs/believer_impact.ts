/**
 * "Believer" — 0-56s, amplitude + impact rewrite.
 *
 * The older Believer curve spec targeted grain, which is no longer an active
 * compiler target. This version uses the current expressive set:
 *   air + speed + amplitude, plus per-beat impact.
 *
 * Music read (madmom, beats/audio.mp3):
 *   125 BPM, 4/4, phrase boundaries 0.02 / 7.69 / 15.36 / 23.04 / 30.74 /
 *   38.42 / 46.10 / 53.78. Energy rises through the 8-15s build, surges at
 *   28-31s, dips sharply at 31-32s, rebuilds at 34-35s, then peaks through the
 *   chorus, with the global onset peak around 48-49s and a drum-thin wind-down.
 *
 * Contacts still come from the cleaned 125 BPM beat grid, but this rewrite
 * uses a half-time backbone throughout, then keeps a few extra phrase/surge
 * hits. Dense 0.48s gaps cannot show much amplitude; 0.96-2.05s musical gaps
 * give the rider room for visible arcs while staying on the song's beat grid.
 *
 * impact is authored as musical landing intensity. It is currently scored but
 * not steered by the optimizer, so bad impact error is expected and useful.
 */
import type { Contact, Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";
import { beats } from "../core/beats.ts";

// Clean on-grid 125 BPM main beat inlined from beats/drums_0_56s.json.
const rawBeatTimes = [
  0.02, 0.5, 0.97, 1.45, 1.93, 2.41, 2.89, 3.37, 3.85, 4.33, 4.81, 5.29,
  5.77, 6.25, 6.73, 7.21, 7.69, 8.18, 8.65, 9.13, 9.61, 10.1, 10.58, 11.06,
  11.53, 12.01, 12.5, 12.98, 13.45, 13.94, 14.42, 14.9, 15.36, 15.86, 16.34,
  16.938, 17.29, 17.78, 18.14, 18.74, 19.21, 19.7, 20.18, 20.66, 21.13,
  21.62, 21.98, 22.58, 23.04, 23.54, 24.02, 24.49, 24.97, 25.45, 25.93,
  26.41, 26.89, 27.36, 27.86, 28.34, 28.81, 29.17, 29.78, 30.26, 30.74,
  31.22, 31.69, 32.18, 32.65, 33.13, 33.62, 34.1, 34.57, 35.06, 35.53,
  36.02, 36.49, 36.98, 37.34, 37.94, 38.42, 38.9, 39.37, 39.85, 40.33,
  40.82, 41.28, 41.77, 42.25, 42.74, 43.21, 43.57, 44.05, 44.65, 45.13,
  45.61, 46.1, 46.58, 47.06, 47.53, 48.01, 48.5, 48.97, 49.45, 49.94, 50.3,
  50.9, 51.38, 51.85, 52.33, 52.82, 54.72, 55.7,
];

const phraseHits = [0.02, 7.69, 15.36, 23.04, 30.74, 38.42, 46.1, 53.78];
const downbeats = [
  0.02, 1.93, 3.85, 5.77, 7.69, 9.61, 11.53, 13.45, 15.36, 17.29, 19.21,
  21.13, 23.04, 24.97, 26.89, 28.81, 30.74, 32.65, 34.57, 36.49, 38.42,
  40.33, 42.25, 44.17, 46.1, 48.01, 49.94, 51.85, 53.78, 55.7,
];
const mustKeep = [
  ...phraseHits,
  28.81, 30.74, 31.69, 34.57, 36.49, 38.42, 40.33, 42.25, 44.05, 46.1,
  48.01, 48.97, 49.94, 51.85, 52.82, 54.72, 55.7,
];
const halfTimeAnchors = [
  0.5,
  ...downbeats,
  ...downbeats.map((t) => t + 0.96),
].filter((t) => t <= 56.1);
const surgeHits = [28.34, 28.81, 29.78, 30.74];
const breakCoil = [31.69, 32.65, 34.57, 36.49, 38.42];
const dropForAir = [31.22, 33.13, 33.62, 36.98, 39.37, 41.28, 43.21, 45.13, 47.06, 48.5, 50.9];

function near(t: number, xs: number[], eps = 0.04): boolean {
  return xs.some((x) => Math.abs(t - x) <= eps);
}

function onHalfTime(t: number): boolean {
  return near(t, halfTimeAnchors, 0.08);
}

function keepContact(t: number, _i: number): boolean {
  // First detected beat is at frame 1; the handoff compiler correctly drops it
  // as physically uncatchable. Start the authored track on the first catchable
  // stomp instead of emitting that warning on every compile.
  if (t < 0.2) return false;
  if (near(t, mustKeep)) return true;
  if (near(t, dropForAir)) return false;
  // Intro/build/verse: half-time, still locked to the detected beat grid.
  if (t < 28.0) return onHalfTime(t);
  // Pre-chorus surge: briefly denser, then a coiled sparse break before chorus.
  if (t < 31.0) return onHalfTime(t) || near(t, surgeHits);
  if (t < 38.42) return near(t, breakCoil) || onHalfTime(t);
  // Chorus: keep only the authored power hits so amplitude has visual room.
  if (t < 53.78) return near(t, mustKeep);
  // Wind-down already has sparse detected gaps; keep it intact.
  return true;
}

const beatTimes = rawBeatTimes.filter(keepContact);

const impactShape = keyframes([
  { t: 0, v: 0.42, ease: "easeIn" },      // stomp-like intro
  { t: 7.69, v: 0.56, ease: "smooth" },   // build
  { t: 12.5, v: 0.70, ease: "easeOut" },
  { t: 15.36, v: 0.58, ease: "smooth" },
  { t: 23.04, v: 0.62, ease: "smooth" },
  { t: 29.0, v: 0.82, ease: "easeIn" },   // pre-chorus surge
  { t: 31.5, v: 0.24, ease: "easeOut" },  // sharp break/coil
  { t: 34.5, v: 0.78, ease: "easeIn" },   // rebuild hit
  { t: 37.7, v: 0.34, ease: "easeOut" },
  { t: 38.42, v: 0.78, ease: "smooth" },  // chorus launch
  { t: 48.5, v: 0.92, ease: "smooth" },   // global peak
  { t: 52.82, v: 0.70, ease: "easeOut" },
  { t: 53.78, v: 0.34, ease: "easeOut" }, // wind-down breath
  { t: 56.0, v: 0.28 },
]);

function impactAt(t: number): number {
  let v = impactShape(t) ?? 0.5;
  if (near(t, downbeats)) v += 0.08;
  if (near(t, phraseHits)) v += 0.10;
  if (t >= 31.0 && t < 32.2) v -= 0.12;
  if (t >= 53.0) v -= 0.08;
  return v;
}

const contacts: Contact[] = beats(beatTimes.map((t) => ({ t, impact: impactAt(t) })));

export const overlayMeta = {
  title: "BELIEVER",
  artist: "IMAGINE DRAGONS",
  tempo: "125 BPM · 4/4 · amplitude + impact",
  phases: [
    { name: "INTRO", t0: 0.0, t1: 7.69, color: "#5b8def" },
    { name: "BUILD", t0: 7.69, t1: 15.36, color: "#3fb6a8" },
    { name: "VERSE", t0: 15.36, t1: 23.04, color: "#6c8cf2" },
    { name: "PRE-CHORUS", t0: 23.04, t1: 38.42, color: "#f0b429" },
    { name: "CHORUS", t0: 38.42, t1: 53.78, color: "#f24f4f" },
    { name: "WIND-DOWN", t0: 53.78, t1: 56.55, color: "#a06cf2" },
  ],
};

const spec: Spec = {
  duration: 56,
  contacts,
  jitter: 0,
  axes: {
    air: keyframes([
      { t: 0, v: 0.46, ease: "easeIn" },
      { t: 7.69, v: 0.58, ease: "smooth" },
      { t: 12.5, v: 0.70, ease: "easeOut" },
      { t: 15.36, v: 0.68, ease: "smooth" },
      { t: 22.0, v: 0.62, ease: "smooth" },
      { t: 29.0, v: 0.76, ease: "easeIn" },
      { t: 31.5, v: 0.52, ease: "easeOut" },
      { t: 34.5, v: 0.74, ease: "easeIn" },
      { t: 37.7, v: 0.58, ease: "easeOut" },
      { t: 38.42, v: 0.72, ease: "smooth" },
      { t: 42.25, v: 0.76, ease: "smooth" },
      { t: 48.5, v: 0.80, ease: "smooth" },
      { t: 52.82, v: 0.74, ease: "easeOut" },
      { t: 53.78, v: 0.58, ease: "easeOut" },
      { t: 56.0, v: 0.46 },
    ]),
    speed: keyframes([
      { t: 0, v: 0.40, ease: "easeIn" },
      { t: 7.69, v: 0.48, ease: "smooth" },
      { t: 15.36, v: 0.62, ease: "smooth" },
      { t: 23.04, v: 0.70, ease: "smooth" },
      { t: 30.74, v: 0.78, ease: "smooth" },
      { t: 38.42, v: 0.86, ease: "smooth" },
      { t: 48.5, v: 0.94, ease: "easeOut" },
      { t: 53.78, v: 0.72, ease: "easeOut" },
      { t: 56.0, v: 0.52 },
    ]),
    amplitude: keyframes([
      { t: 0, v: 0.06, ease: "easeIn" },
      { t: 7.69, v: 0.16, ease: "smooth" },
      { t: 12.5, v: 0.28, ease: "easeOut" },
      { t: 15.36, v: 0.42, ease: "smooth" },
      { t: 23.04, v: 0.54, ease: "smooth" },
      { t: 29.0, v: 0.56, ease: "easeIn" },
      { t: 31.5, v: 0.16, ease: "easeOut" },
      { t: 34.5, v: 0.64, ease: "easeIn" },
      { t: 37.7, v: 0.24, ease: "easeOut" },
      { t: 38.42, v: 0.66, ease: "smooth" },
      { t: 42.25, v: 0.74, ease: "smooth" },
      { t: 48.5, v: 0.82, ease: "smooth" },
      { t: 52.82, v: 0.68, ease: "easeOut" },
      { t: 54.72, v: 0.80, ease: "smooth" }, // final drum dropout: one big float
      { t: 56.0, v: 0.38 },
    ]),
  },
};

export default spec;
