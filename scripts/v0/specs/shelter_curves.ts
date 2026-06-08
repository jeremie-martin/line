/**
 * "Shelter" (Porter Robinson & Madeon) — first 65.5s. Three axes: air, speed,
 * elevation (no grain), jitter 0.
 *
 * DENSITY follows the music (beats/shelter_65s.json is a VARIABLE-density grid):
 * sparse 1.2s gaps in the intro & breakdown, tight 0.6s through the groove and
 * chorus. The long gaps are deliberate — they become long slides / floaty airs
 * where the music breathes, instead of a metronomic catch every 0.6s.
 *
 * elevation ∈ [0,1] = altitude trend vs the speed-supported vy band: 0.5 level,
 * →1 climb, →0 plunge. RELATIVE and speed-coupled (bank speed, then spend it
 * climbing). The honest per-gap `ceiling` (db5afdb) is ~0.65 at chorus speed, so
 * the soar is authored to that — target above it is a true physics shortfall.
 *
 * Axis story, mapped to structure (madmom, 100 BPM, phrases 0.33/9.93/19.53/
 * 29.13/38.73/48.33/57.93):
 *   INTRO  0–10s   sparse → long GROUNDED slides (low air), level
 *   HOOK   10–20s  groove enters, air lifts, gentle elevation roll
 *   VERSE  20–38s  flowing; then BANK (plunge + speed up) into the drop
 *   CHORUS 38–58s  the SOAR — elevation pulse while banked speed is spent and
 *                  air eases down so the climb wins (not floaty/level)
 *   BREAK  58–65s  sparse → long FLOATY airs (high air), gentle descent, release
 *
 * Interestingness finding (analyze_track_shape.py): CONTACT DENSITY is the main
 * spec-side lever. The uniform 0.6s grid is a flat glide (median pop ~3px, 0 big
 * airs). This variable grid — sparse 1.8s breakdown + high air — produces real
 * drama there: 4 big airs (max pop ~71px), vertical relief 235→582px, longest
 * air 1.4s. The catch: the tight-synced chorus stays gentle (dense beats ⇒ small
 * compiler arcs); drama inside dense sections needs the deeper compiler work
 * (working `amplitude`, longer arcs). 93/93 hit; ~669 @300k.
 */
import type { Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";
import { beats } from "../core/beats.ts";

// Beats inlined from the former beats/shelter_65s.json (madmom onsets, 100 BPM) so
// the timing lives WITH the spec — and is now co-authorable with per-beat landing
// `impact` (swap a bare time for `{ t, impact }`, or decorate by rule with
// `withImpact(contacts, …)`). Variable-density grid: sparse ~1.2s in the intro &
// breakdown, tight 0.6s through the groove and chorus.
const beatTimes = [
  0.33, 1.53, 2.73, 3.93, 5.13, 6.33, 7.53, 8.73,
  9.93, 10.53, 11.13, 11.73, 12.33, 12.93, 13.53, 14.13,
  14.73, 15.33, 15.93, 16.53, 17.13, 17.73, 18.33, 18.93,
  19.53, 20.13, 20.73, 21.33, 21.93, 22.53, 23.13, 23.73,
  24.33, 24.93, 25.53, 26.13, 26.73, 27.33, 27.93, 28.53,
  29.13, 29.73, 30.33, 30.93, 31.53, 32.13, 32.73, 33.33,
  33.93, 34.53, 35.13, 35.73, 36.33, 36.93, 37.53, 38.13,
  38.73, 39.33, 39.93, 40.53, 41.13, 41.73, 42.33, 42.93,
  43.53, 44.13, 44.73, 45.33, 45.93, 46.53, 47.13, 47.73,
  48.33, 48.93, 49.53, 50.13, 50.73, 51.33, 51.93, 52.53,
  53.13, 53.73, 54.33, 54.93, 55.53, 56.13, 56.73, 57.33,
  57.93, 59.73, 61.53, 63.33, 65.13,
];
const contacts = beats(beatTimes.map((t) => ({ t })));

/** Overlay metadata (title/artist/tempo + soft energy phases) for make_overlay_data.ts. */
export const overlayMeta = {
  title: "SHELTER",
  artist: "PORTER ROBINSON & MADEON",
  tempo: "100 BPM · 4/4",
  phases: [
    { name: "INTRO", t0: 0, t1: 9.93, color: "#5b8def" },
    { name: "HOOK", t0: 9.93, t1: 19.53, color: "#3fb6a8" },
    { name: "VERSE", t0: 19.53, t1: 38.73, color: "#6c8cf2" },
    { name: "CHORUS", t0: 38.73, t1: 57.93, color: "#f24f4f" },
    { name: "BREAK", t0: 57.93, t1: 65.5, color: "#a06cf2" },
  ],
};

const spec: Spec = {
  duration: 65.5,
  contacts,
  jitter: 0,
  axes: {
    // The vertical lead. Level intro → gentle hook roll → BANK (plunge to gather
    // speed) → chorus SOAR pulse (authored to the ~0.65 honest ceiling) → release.
    elevation: keyframes([
      { t: 0, v: 0.50, ease: "smooth" }, // level intro slides
      { t: 9.93, v: 0.56, ease: "easeOut" }, // hook lift
      { t: 14.0, v: 0.50, ease: "smooth" },
      { t: 19.53, v: 0.55, ease: "smooth" }, // verse roll up
      { t: 24.0, v: 0.46, ease: "smooth" }, // roll down
      { t: 29.13, v: 0.40, ease: "easeIn" }, // BANK: plunge to gather speed
      { t: 38.73, v: 0.40, ease: "easeOut" }, // banked low
      { t: 44.0, v: 0.62, ease: "easeIn" }, // CHORUS: release into the climb
      { t: 46.5, v: 0.66, ease: "smooth" }, // PEAK soar pulse (at the honest ceiling)
      { t: 49.0, v: 0.56, ease: "easeOut" }, // come down as speed is spent
      { t: 52.0, v: 0.50, ease: "smooth" },
      { t: 57.93, v: 0.46, ease: "smooth" }, // breakdown: gentle descent over the long airs
      { t: 62.0, v: 0.50, ease: "smooth" },
      { t: 65.5, v: 0.50 },
    ]),
    // Bank speed BEFORE the chorus, spend it DURING the climb (overlap), recover
    // for the breakdown so the long final gaps still carry the rider into airs.
    speed: keyframes([
      { t: 0, v: 0.50, ease: "easeIn" }, // moderate — carries the long intro slides
      { t: 9.93, v: 0.56, ease: "smooth" },
      { t: 19.53, v: 0.62, ease: "smooth" },
      { t: 29.13, v: 0.70, ease: "easeIn" }, // start banking
      { t: 38.73, v: 0.82, ease: "smooth" }, // banked high
      { t: 44.0, v: 0.74, ease: "easeIn" }, // release — spend immediately
      { t: 47.0, v: 0.58, ease: "easeOut" }, // spent on the climb pulse
      { t: 50.0, v: 0.60, ease: "smooth" }, // floor — keep the ride mobile
      { t: 53.0, v: 0.56, ease: "smooth" },
      { t: 57.93, v: 0.60, ease: "smooth" }, // enough speed for the long break airs
      { t: 65.5, v: 0.54 },
    ]),
    // Air: GROUNDED long slides in the sparse intro → flowing groove → eased down
    // through the soar (so elevation wins) → HIGH over the long breakdown gaps for
    // floaty release airs.
    air: keyframes([
      { t: 0, v: 0.40, ease: "easeIn" }, // grounded long slides
      { t: 9.93, v: 0.55, ease: "smooth" }, // hook
      { t: 19.53, v: 0.66, ease: "smooth" }, // verse flowing
      { t: 29.13, v: 0.62, ease: "smooth" },
      { t: 38.73, v: 0.66, ease: "smooth" }, // rise
      { t: 44.0, v: 0.56, ease: "smooth" }, // ease for the climb
      { t: 49.0, v: 0.50, ease: "smooth" }, // low at the climb peak — elevation wins
      { t: 54.0, v: 0.66, ease: "easeIn" },
      { t: 57.93, v: 0.85, ease: "smooth" }, // BREAK: very high air over the long 1.8s gaps → big floaty airs
      { t: 62.0, v: 0.80, ease: "easeOut" },
      { t: 65.5, v: 0.66 },
    ]),
  },
};

export default spec;
