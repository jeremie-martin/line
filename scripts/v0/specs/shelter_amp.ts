/**
 * "Shelter" (Porter Robinson & Madeon) — first 1:21 (81s), AMPLITUDE variant.
 *
 * Alternative to shelter_curves.ts (elevation): here the vertical drama is
 * `amplitude` — the pop height of the airborne arc. Amplitude steering (cf1ceaf)
 * launches a gap-filling ballistic arc, pop ≈ g·N²/8, so it only grows on LONG
 * gaps (~12px @0.6s, ~50px @1.2s, ~113px @1.8s). Amplitude is a "moment" axis;
 * the beat grid plus three deliberate phrase-hit rests gives it long gaps exactly
 * where we want jumps. NOTE: amplitude and elevation BOTH write the launch angle,
 * so they can't be co-targeted — amplitude is the sole vertical lead here.
 *
 * Score note: amplitude is authored MODERATE (~0.6, not maxed). Maxing it made
 * the long phrase-rest arcs blow speed up hard (big axis error); moderate targets
 * let the long gaps produce the visible jump naturally. Groove amplitude sits near
 * the dense-beat cap (~0.08) so we don't ask for pops 0.6s gaps can't make.
 *
 * Structure (madmom, 100 BPM, phrases every 9.6s; energy contour):
 *   INTRO  0–10s    sparse 1.2s → gentle bounces
 *   VERSE  10–38s   tight 0.6s groove (calm, low amplitude)
 *   CHORUS 38–58s   half-time 1.2s + phrase rests → big rhythmic jumps
 *   DROP   58–72s   a dip (regroup, tight), then the 2nd drop jumps/rests again
 *   BREAK  72–81s   the deepest dip (72–76, near voice-only) sparse 1.8s → big
 *                   floaty airs, then an outro build
 *
 * Axes: air, speed, amplitude. jitter 0.
 */
import type { Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";
import { beats } from "../core/beats.ts";
import { SHELTER_81_MUSIC } from "./_music.ts";

// Onsets inlined from the former beats/shelter_amp81.json (100 BPM grid), with the
// three phrase-hit showpiece rests (43.53, 50.73, 69.93) already removed so
// amplitude has room to read a true jump there.
const beatTimes = [
  0.33, 1.53, 2.73, 3.93, 5.13, 6.33, 7.53, 8.73, 9.93, 10.53, 11.13, 11.73,
  12.33, 12.93, 13.53, 14.13, 14.73, 15.33, 15.93, 16.53, 17.13, 17.73,
  18.33, 18.93, 19.53, 20.13, 20.73, 21.33, 21.93, 22.53, 23.13, 23.73,
  24.33, 24.93, 25.53, 26.13, 26.73, 27.33, 27.93, 28.53, 29.13, 29.73,
  30.33, 30.93, 31.53, 32.13, 32.73, 33.33, 33.93, 34.53, 35.13, 35.73,
  36.33, 36.93, 37.53, 38.13, 38.73, 39.93, 41.13, 42.33, 44.73, 45.93,
  47.13, 48.33, 49.53, 51.93, 53.13, 54.33, 55.53, 56.73, 57.93, 58.53,
  59.13, 59.73, 60.33, 60.93, 61.53, 62.13, 62.73, 63.33, 63.93, 64.53,
  65.13, 65.73, 66.33, 66.93, 67.53, 68.73, 71.13, 72.33, 74.13, 75.93,
  77.13, 78.33, 79.53, 80.73,
];
const contacts = beats(beatTimes.map((t) => ({ t })));

export const overlayMeta = {
  title: "SHELTER",
  artist: "PORTER ROBINSON & MADEON",
  tempo: "100 BPM · 4/4 · amplitude",
  phases: [
    { name: "INTRO", t0: 0, t1: 9.93, color: "#5b8def" },
    { name: "VERSE", t0: 9.93, t1: 38.73, color: "#6c8cf2" },
    { name: "CHORUS", t0: 38.73, t1: 57.93, color: "#f24f4f" },
    { name: "DROP", t0: 57.93, t1: 72.33, color: "#f0792f" },
    { name: "BREAK", t0: 72.33, t1: 81.0, color: "#a06cf2" },
  ],
};

const spec: Spec = {
  duration: 81,
  music: SHELTER_81_MUSIC,
  contacts,
  jitter: 0,
  axes: {
    // The lead. Moderate everywhere it can land (tracks well); near the dense cap
    // through the tight groove; biggest over the long 1.8s deep-dip gaps.
    amplitude: keyframes([
      { t: 0, v: 0.05, ease: "easeOut" }, // cold start: first 0.33s gap can't pop
      { t: 1.53, v: 0.45, ease: "smooth" }, // intro: gentle bounces (1.2s gaps)
      { t: 5.13, v: 0.42, ease: "easeIn" },
      { t: 7.53, v: 0.60, ease: "easeOut" }, // end-of-intro flourish
      { t: 8.73, v: 0.14, ease: "smooth" },
      { t: 9.93, v: 0.08, ease: "smooth" }, // groove: near the dense-beat cap
      { t: 29.13, v: 0.10, ease: "hold" },
      { t: 38.73, v: 0.10, ease: "easeOut" }, // still dense; wait for the grid to open
      { t: 39.93, v: 0.60, ease: "smooth" }, // CHORUS: big rhythmic jumps (1.2s)
      { t: 48.33, v: 0.62, ease: "smooth" },
      { t: 57.93, v: 0.14, ease: "easeOut" }, // dip: tight regroup
      { t: 64.0, v: 0.18, ease: "hold" },
      { t: 67.53, v: 0.18, ease: "easeOut" }, // still dense; wait for the 1.2s gaps
      { t: 68.73, v: 0.60, ease: "smooth" }, // 2nd DROP: jumps again
      { t: 72.33, v: 0.62, ease: "easeOut" },
      { t: 74.13, v: 0.95, ease: "hold" }, // BREAK deep dip: the two 1.8s showpiece gaps
      { t: 75.93, v: 0.95, ease: "easeOut" },
      { t: 77.13, v: 0.45, ease: "smooth" }, // outro build
      { t: 81.0, v: 0.40 },
    ]),
    // Air rides high where amplitude is high (a big pop = long aloft); low/tight
    // through the groove and the dip.
    air: keyframes([
      { t: 0, v: 0.50, ease: "easeIn" },
      { t: 9.93, v: 0.55, ease: "smooth" }, // groove
      { t: 19.53, v: 0.58, ease: "smooth" },
      { t: 38.73, v: 0.70, ease: "smooth" }, // chorus: aloft for the jumps
      { t: 48.33, v: 0.74, ease: "smooth" },
      { t: 57.93, v: 0.60, ease: "easeOut" }, // dip: regrounded
      { t: 67.53, v: 0.72, ease: "easeIn" }, // 2nd drop
      { t: 72.33, v: 0.80, ease: "smooth" }, // deep dip: long floaty airs
      { t: 77.13, v: 0.66, ease: "easeOut" }, // outro
      { t: 81.0, v: 0.58 },
    ]),
    // Speed carries the ballistic arcs across the long jump gaps. Builds for each
    // drop, eases in the dips.
    speed: keyframes([
      { t: 0, v: 0.38, ease: "easeIn" },
      { t: 3.93, v: 0.30, ease: "easeIn" },
      { t: 7.53, v: 0.70, ease: "smooth" },
      { t: 9.93, v: 0.58, ease: "smooth" },
      { t: 19.53, v: 0.64, ease: "smooth" },
      { t: 38.73, v: 0.74, ease: "smooth" }, // chorus jumps
      { t: 48.33, v: 0.72, ease: "smooth" },
      { t: 57.93, v: 0.62, ease: "easeOut" }, // dip
      { t: 67.53, v: 0.72, ease: "easeIn" }, // 2nd drop
      { t: 72.33, v: 0.66, ease: "smooth" }, // deep dip: ease, let airs float
      { t: 77.13, v: 0.64, ease: "smooth" },
      { t: 81.0, v: 0.56 },
    ]),
  },
};

export default spec;
