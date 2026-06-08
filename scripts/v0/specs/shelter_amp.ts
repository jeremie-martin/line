/**
 * "Shelter" (Porter Robinson & Madeon) — first 1:21 (81s), AMPLITUDE variant.
 *
 * Alternative to shelter_curves.ts (elevation): here the vertical drama is
 * `amplitude` — the pop height of the airborne arc. Amplitude steering (cf1ceaf)
 * launches a gap-filling ballistic arc, pop ≈ g·N²/8, so it only grows on LONG
 * gaps (~12px @0.6s, ~50px @1.2s, ~113px @1.8s). Amplitude is a "moment" axis;
 * the grid (beats/shelter_amp81.json) gives it long gaps exactly where we want
 * jumps. NOTE: amplitude and elevation BOTH write the launch angle, so they
 * can't be co-targeted — amplitude is the sole vertical lead here.
 *
 * Score note: amplitude is authored MODERATE (~0.6, not maxed). Maxing it (0.85)
 * made the chorus arcs plunge and blew speed up to ~1.7–1.9 (big axis error);
 * ~0.6 gives controllable, well-tracked ~30px jumps, and the long 1.8s deep-dip
 * gaps still reach big airs. Groove amplitude sits near the dense-beat cap (~0.08)
 * so we don't ask for pops the 0.6s gaps physically can't make.
 *
 * Structure (madmom, 100 BPM, phrases every 9.6s; energy contour):
 *   INTRO  0–10s    sparse 1.2s → gentle bounces
 *   VERSE  10–38s   tight 0.6s groove (calm, low amplitude)
 *   CHORUS 38–58s   half-time 1.2s → big rhythmic jumps
 *   DROP   58–72s   a dip (regroup, tight) then the 2nd drop (64–72) jumps again
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

const contacts: Contact[] = raw.onsets.map((o) => ({ t: o.t }));

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
      { t: 0, v: 0.45, ease: "smooth" }, // intro: gentle bounces (1.2s gaps)
      { t: 9.93, v: 0.08, ease: "smooth" }, // groove: near the dense-beat cap
      { t: 29.13, v: 0.10, ease: "easeIn" },
      { t: 38.73, v: 0.60, ease: "smooth" }, // CHORUS: big rhythmic jumps (1.2s)
      { t: 48.33, v: 0.62, ease: "smooth" },
      { t: 57.93, v: 0.14, ease: "easeOut" }, // dip: tight regroup
      { t: 64.0, v: 0.22, ease: "easeIn" },
      { t: 67.53, v: 0.60, ease: "smooth" }, // 2nd DROP: jumps again
      { t: 72.33, v: 0.72, ease: "smooth" }, // BREAK deep dip: big floaty airs (1.8s)
      { t: 75.93, v: 0.70, ease: "easeOut" },
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
      { t: 0, v: 0.52, ease: "easeIn" },
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
