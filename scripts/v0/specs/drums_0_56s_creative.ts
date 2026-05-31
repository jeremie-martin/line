/**
 * Creative "Believer" spec — 0–56s, shaped from the madmom structural analysis.
 *
 * 125 BPM (0.48s grid), 4/4, 4-bar phrases at 0.02/7.69/15.36/23.06/30.74/38.42/46.10/53.78s.
 * Energy (onset activation): low intro (0–8s) → build (8–16s) → verse (16–31s) →
 * pre-chorus regroup (31–38s) → PEAK chorus (38–54s) → wind-down (54–56s).
 *
 * Axis story (air=airborne fraction, speed=|v|/cap ~0.55 floor, grain=line length):
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

const raw = JSON.parse(
  readFileSync(resolve("beats/drums_0_56s.json"), "utf8"),
) as { range_s: [number, number]; onsets: { t: number }[] };

const contacts: Contact[] = raw.onsets.map((o) => ({ t: o.t }));

const spec: Spec = {
  duration: raw.range_s[1],
  contacts,
  // v3: v2's well-matched air arc + modest speed targets (v2 showed speed
  // overshoots and scores worse the higher you aim — the rider exceeds the cap
  // late regardless). Air carries the expressive arc; speed kept where the
  // rider naturally lands so error stays low.
  sections: [
    { t0: 0, t1: 7.69, air: 0.62, speed: 0.55, grain: 0.32 },      // intro: restrained, choppy
    { t0: 7.69, t1: 15.36, air: 0.70, speed: 0.62, grain: 0.40 },  // build: lift begins
    { t0: 15.36, t1: 30.74, air: 0.76, speed: 0.70, grain: 0.50 }, // verse: flowing & airy
    { t0: 30.74, t1: 38.42, air: 0.68, speed: 0.75, grain: 0.45 }, // pre-chorus: coil
    { t0: 38.42, t1: 53.78, air: 0.80, speed: 0.90, grain: 0.60 }, // CHORUS peak: high air, big
    { t0: 53.78, t1: 56, air: 0.64, speed: 0.85, grain: 0.62 },    // outro: airy release
  ],
};

export default spec;
