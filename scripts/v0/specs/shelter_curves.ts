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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Spec, Contact } from "../types.ts";
import { keyframes } from "../core/curves.ts";

const raw = JSON.parse(
  readFileSync(resolve("beats/shelter_65s.json"), "utf8"),
) as { range_s: [number, number]; onsets: { t: number }[] };

const contacts: Contact[] = raw.onsets.map((o) => ({ t: o.t }));

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
  duration: raw.range_s[1],
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
