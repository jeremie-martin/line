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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Spec, Contact } from "../types.ts";
import { keyframes } from "../core/curves.ts";

const raw = JSON.parse(
  readFileSync(resolve("beats/shelter_amp81.json"), "utf8"),
) as { range_s: [number, number]; onsets: { t: number }[] };

// A few phrase-hit rests create true showpiece jumps. They are still on the
// 100 BPM grid; we deliberately skip the contact so amplitude has room to read.
const showpieceRests = new Set([43.53, 50.73, 69.93]);
const contacts: Contact[] = raw.onsets
  .filter((o) => !showpieceRests.has(Number(o.t.toFixed(2))))
  .map((o) => ({ t: o.t }));

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
  duration: raw.range_s[1],
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
