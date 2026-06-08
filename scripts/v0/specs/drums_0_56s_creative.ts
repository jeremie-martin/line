/**
 * Creative "Believer" spec — 0–56s, shaped from the madmom structural analysis.
 *
 * 125 BPM (0.48s grid), 4/4, 4-bar phrases at 0.02/7.69/15.36/23.06/30.74/38.42/46.10/53.78s.
 * Energy (onset activation): low intro (0–8s) → build (8–16s) → verse (16–31s) →
 * pre-chorus regroup (31–38s) → PEAK chorus (38–54s) → wind-down (54–56s).
 *
 * Axis story (air=airborne fraction, speed=authored pace mapped to raw px/frame, grain=line length):
 *   intro     restrained & grounded, short choppy lines (tension)
 *   build     lift begins
 *   verse     flowing, airy, longer lines
 *   pre-chorus coil back down a touch, speed creeping up
 *   CHORUS    the payoff — high air, fast, big swooping ramps
 *   outro     resolve: settle to ground, slow, one long line
 *
 * Contacts = clean on-grid 125BPM main beat (beats/drums_0_56s.json) — ≥0.4s
 * spacing, which is the handoff compiler's sweet spot (104/106 on the bare spec).
 */
import type { Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";
import { beats } from "../core/beats.ts";

// Clean on-grid 125 BPM main beat inlined from the former beats/drums_0_56s.json.
const beatTimes = [
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
const contacts = beats(beatTimes.map((t) => ({ t })));

// Phrase-aligned axis arc (4-bar phrase boundaries). Ported from the original
// 6 hold-sections; `hold` keyframes reproduce the step blocks exactly. v3: air
// carries the expressive arc; speed kept modest where the rider naturally lands
// (raw speed overshoots the authored 1.0 mapping late regardless), so axis error
// stays low.
const spec: Spec = {
  duration: 56,
  contacts,
  axes: {
    air: keyframes([
      { t: 0, v: 0.62 },      // intro: restrained, choppy
      { t: 7.69, v: 0.70 },   // build: lift begins
      { t: 15.36, v: 0.76 },  // verse: flowing & airy
      { t: 30.74, v: 0.68 },  // pre-chorus: coil
      { t: 38.42, v: 0.80 },  // CHORUS peak: high air, big
      { t: 53.78, v: 0.64 },  // outro: airy release
    ], "hold"),
    speed: keyframes([
      { t: 0, v: 0.55 }, { t: 7.69, v: 0.62 }, { t: 15.36, v: 0.70 },
      { t: 30.74, v: 0.75 }, { t: 38.42, v: 0.90 }, { t: 53.78, v: 0.85 },
    ], "hold"),
    grain: keyframes([
      { t: 0, v: 0.32 }, { t: 7.69, v: 0.40 }, { t: 15.36, v: 0.50 },
      { t: 30.74, v: 0.45 }, { t: 38.42, v: 0.60 }, { t: 53.78, v: 0.62 },
    ], "hold"),
  },
};

export default spec;
