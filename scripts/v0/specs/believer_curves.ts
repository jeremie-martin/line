/**
 * "Believer" — 0–56s, authored entirely as CONTINUOUS axis curves.
 *
 * This is the curve-paradigm rewrite of `drums_0_56s_creative.ts`. The old spec
 * used `keyframes(..., "hold")` — i.e. it was still six flat step-blocks wearing
 * the new API. Here every axis BREATHES: smooth/easeIn/easeOut keyframes placed
 * on the song's actual energy inflection points, so the rider's motion rises,
 * coils, releases and resolves continuously with the music instead of snapping
 * between section plateaus.
 *
 * Structure (madmom, beats/audio.mp3, 125 BPM dead-steady, 4/4, 30 bars):
 *   4-bar phrase lines: 0.02 / 7.69 / 15.36 / 23.04 / 30.74 / 38.42 / 46.10 / 53.78s
 *   onset-activation energy contour (1s buckets):
 *     0–8s   INTRO        sparse call-and-response, low (~0.045)
 *     8–16s  BUILD        first surge, peak 12–14s (~0.096)
 *     16–24s VERSE        flowing mid (~0.07), a breath dip at 22–23s
 *     24–31s PRE-CHORUS   surge to peak 28–31s (~0.10) ...
 *     31–32s BREAK        sharp drop (~0.051) — the coil
 *     32–38s REBUILD      peak 34–35s (~0.099), coil again at 37–38s
 *     38–53s CHORUS       sustained high, GLOBAL peak 48–49s (~0.106)
 *     52–56s WIND-DOWN    drums thin (the 1.9s grid dropout at 52.8s), fall away
 *
 * Axis story (air = airborne fraction · speed = authored pace · grain = line length):
 *   air    the lead voice — a grounded restrained intro that lifts into the
 *          build, flows through the verse, surges/coils twice through the
 *          pre-chorus (a W), then a high chorus plateau cresting at the 48s
 *          global peak, finally releasing to the ground in the wind-down.
 *   speed  a slow, mostly-monotone climb (gravity already pushes pace up late,
 *          so the authored target stays modest), easing back in the wind-down.
 *   grain  short choppy lines under tension in the intro → long swooping lines
 *          in the chorus.
 *
 * Contacts: clean on-grid 125 BPM main beat (beats/drums_0_56s.json), 113
 * contacts at ≥~0.4s spacing — the handoff compiler's sweet spot.
 *
 * jitter: 0 — the curves carry all neighbor-to-neighbor variation themselves,
 * so we read them exactly (no per-gap Gaussian on top).
 *
 * Result (handoff, seed 0): 112/112 contacts hit, full ride, 0 off-beat.
 *   @200k budget  score 704.2  axis_rms 0.088
 *   @2M   budget  score 737.1  axis_rms 0.076 (air 0.08 / speed 0.05 / grain 0.04)
 * Targets were pulled into the measured achievable band after the v1 read
 * (air floors ~0.45 in the intro, tops out ~0.78 sustained).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Spec, Contact } from "../types.ts";
import { keyframes } from "../core/curves.ts";

const raw = JSON.parse(
  readFileSync(resolve("beats/drums_0_56s.json"), "utf8"),
) as { range_s: [number, number]; onsets: { t: number }[] };

const contacts: Contact[] = raw.onsets.map((o) => ({ t: o.t }));

const spec: Spec = {
  duration: raw.range_s[1],
  contacts,
  jitter: 0,
  axes: {
    // The expressive lead. easeIn out of the grounded intro, a flowing verse,
    // the W-shaped pre-chorus (surge 29 → break 31.5 → peak 34.5 → coil 37.5),
    // the chorus plateau cresting at the 48s global energy peak, then release.
    // Targets pulled into the MEASURED achievable band (v1 read): air floors at
    // ~0.45 in the intro and tops out ~0.78 sustained, so the chorus ceiling is
    // 0.78 (not 0.86) — keeps the low→high arc the rider can actually deliver.
    air: keyframes([
      { t: 0, v: 0.50, ease: "easeIn" }, // grounded, restrained
      { t: 7.69, v: 0.62, ease: "smooth" }, // build begins
      { t: 12.5, v: 0.72, ease: "easeOut" }, // 12–14s build peak
      { t: 15.36, v: 0.70, ease: "smooth" }, // verse: flowing & airy
      { t: 22.0, v: 0.64, ease: "smooth" }, // the 22s breath
      { t: 29.0, v: 0.78, ease: "easeIn" }, // pre-chorus surge peak
      { t: 31.5, v: 0.60, ease: "easeOut" }, // the BREAK — coil down
      { t: 34.5, v: 0.76, ease: "easeIn" }, // rebuild peak (34–35s)
      { t: 37.7, v: 0.60, ease: "easeOut" }, // second coil before the drop
      { t: 38.42, v: 0.72, ease: "smooth" }, // CHORUS launch
      { t: 42.0, v: 0.77, ease: "smooth" }, // chorus body
      { t: 48.5, v: 0.78, ease: "smooth" }, // GLOBAL peak (48–49s)
      { t: 52.5, v: 0.74, ease: "easeIn" }, // last sustain before the dropout
      { t: 53.78, v: 0.58, ease: "easeOut" }, // wind-down
      { t: 56.0, v: 0.48 }, // settle to the ground
    ]),
    // Modest climb; gravity carries the late pace (chorus achieved ~0.85–0.95),
    // so the late targets are nudged up toward the overshoot, with a wind-down brake.
    speed: keyframes([
      { t: 0, v: 0.42, ease: "easeIn" },
      { t: 8.0, v: 0.50, ease: "smooth" },
      { t: 15.36, v: 0.60, ease: "smooth" },
      { t: 23.04, v: 0.64, ease: "smooth" },
      { t: 30.74, v: 0.72, ease: "smooth" },
      { t: 38.42, v: 0.78, ease: "smooth" },
      { t: 48.5, v: 0.82, ease: "easeOut" },
      { t: 53.78, v: 0.66, ease: "easeOut" }, // wind-down brake
      { t: 56.0, v: 0.56 },
    ]),
    // Choppy → swooping. Short tense lines in the intro, long arcs in the chorus.
    grain: keyframes([
      { t: 0, v: 0.30, ease: "smooth" },
      { t: 8.0, v: 0.40, ease: "smooth" },
      { t: 15.36, v: 0.50, ease: "smooth" },
      { t: 30.74, v: 0.54, ease: "smooth" },
      { t: 38.42, v: 0.62, ease: "smooth" },
      { t: 49.0, v: 0.66, ease: "easeOut" },
      { t: 53.78, v: 0.55, ease: "easeOut" },
      { t: 56.0, v: 0.48 },
    ]),
  },
};

export default spec;
