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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Spec, Contact } from "../types.ts";
import { keyframes } from "../core/curves.ts";

const raw = JSON.parse(
  readFileSync(resolve("beats/drums_0_56s.json"), "utf8"),
) as { range_s: [number, number]; onsets: { t: number }[] };

const contacts: Contact[] = raw.onsets.map((o) => ({ t: o.t }));

// Phrase-aligned axis arc (4-bar phrase boundaries). Ported from the original
// 6 hold-sections; `hold` keyframes reproduce the step blocks exactly. v3: air
// carries the expressive arc; speed kept modest where the rider naturally lands
// (raw speed overshoots the authored 1.0 mapping late regardless), so axis error
// stays low.
const spec: Spec = {
  duration: raw.range_s[1],
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
