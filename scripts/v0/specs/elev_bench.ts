/**
 * Elevation benchmark — a deliberately varied set of specs for studying the
 * `elevation` axis: do the authored values produce a physical path that matches
 * what the value *means*? (See scripts/v0/study_elevation.ts.)
 *
 * Cases span: sanity constants, pure shapes (isolated elevation), coupling with
 * speed/air, and speed-varied energy. All `jitter: 0` so the curve is read
 * exactly. Isolated cases target ONLY elevation so nothing competes — that is
 * the clean read of the axis; coupling cases add speed/air on purpose to study
 * the competition.
 */
import type { Spec, Contact, Curve } from "../types.ts";
import { constant, ramp, keyframes } from "../core/curves.ts";

const DUR = 16;

/** Contacts on a fixed grid (default 0.5 s ≈ the compiler's sweet spot). */
function grid(duration = DUR, step = 0.5, start = 0.5): Contact[] {
  const cs: Contact[] = [];
  for (let t = start; t < duration - 1e-6; t += step) cs.push({ t: Number(t.toFixed(3)) });
  return cs;
}
const G = grid();

function spec(axes: Spec["axes"], duration = DUR, contacts = G): Spec {
  return { duration, contacts, jitter: 0, axes };
}

/** Square-wave elevation: alternate hi/lo every `periodS` seconds. */
function oscillate(hi: number, lo: number, periodS: number): Curve {
  return (t: number) => (Math.floor(t / periodS) % 2 === 0 ? hi : lo);
}

export type ElevCase = { name: string; note: string; spec: Spec };

export const ELEV_BENCH: ElevCase[] = [
  // ── sanity constants (isolated) ──
  { name: "flat", note: "elev 0.5 const — path should be ~flat", spec: spec({ elevation: constant(0.5) }) },
  { name: "gentle_climb", note: "elev 0.65 const — mild steady rise", spec: spec({ elevation: constant(0.65) }) },
  { name: "gentle_plunge", note: "elev 0.35 const — mild steady fall", spec: spec({ elevation: constant(0.35) }) },
  { name: "steep_climb", note: "elev 0.90 const — hard sustained climb (expect cap/stall)", spec: spec({ elevation: constant(0.90) }) },
  { name: "steep_plunge", note: "elev 0.10 const — deep sustained dive", spec: spec({ elevation: constant(0.10) }) },

  // ── pure shapes (isolated) ──
  { name: "ramp_up", note: "elev 0.5→0.95 — climb harder over time", spec: spec({ elevation: ramp(0, 0.5, DUR, 0.95) }) },
  { name: "ramp_down", note: "elev 0.5→0.05 — dive deeper over time", spec: spec({ elevation: ramp(0, 0.5, DUR, 0.05) }) },
  { name: "valley_V", note: "elev 0.5→0.1→0.5 — dive then recover", spec: spec({ elevation: keyframes([{ t: 0, v: 0.5 }, { t: 8, v: 0.1 }, { t: 16, v: 0.5 }], "smooth") }) },
  { name: "hill", note: "elev 0.5→0.9→0.5 — the soar: climb then descend", spec: spec({ elevation: keyframes([{ t: 0, v: 0.5 }, { t: 8, v: 0.9 }, { t: 16, v: 0.5 }], "smooth") }) },
  { name: "staircase", note: "elev 0.3/0.5/0.7/0.9 holds — discrete levels", spec: spec({ elevation: keyframes([{ t: 0, v: 0.3 }, { t: 4, v: 0.5 }, { t: 8, v: 0.7 }, { t: 12, v: 0.9 }], "hold") }) },
  { name: "oscillate", note: "elev 0.65/0.35 alternating each 1s — rapid up/down (hard)", spec: spec({ elevation: oscillate(0.65, 0.35, 1.0) }) },

  // ── coupling with speed/air ──
  { name: "climb_bank_speed", note: "soar + speed banks before, falls during (intended pattern)", spec: spec({
    elevation: keyframes([{ t: 0, v: 0.5 }, { t: 7, v: 0.5 }, { t: 9, v: 0.85 }, { t: 13, v: 0.85 }, { t: 16, v: 0.5 }], "smooth"),
    speed: keyframes([{ t: 0, v: 0.5 }, { t: 7, v: 0.9 }, { t: 9, v: 0.9 }, { t: 13, v: 0.4 }, { t: 16, v: 0.4 }], "linear"),
  }) },
  { name: "climb_const_speed", note: "elev 0.8 + speed 0.6 const — antagonistic (expect cap)", spec: spec({ elevation: constant(0.80), speed: constant(0.60) }) },
  { name: "climb_with_air", note: "elev 0.8 + air 0.70 — does floaty air fight climb?", spec: spec({ elevation: constant(0.80), air: constant(0.70) }) },
  { name: "all_three_soar", note: "Shelter-like: soar + speed + air together", spec: spec({
    elevation: keyframes([{ t: 0, v: 0.5 }, { t: 8, v: 0.85 }, { t: 16, v: 0.5 }], "smooth"),
    speed: keyframes([{ t: 0, v: 0.55 }, { t: 8, v: 0.7 }, { t: 16, v: 0.5 }], "smooth"),
    air: constant(0.65),
  }) },

  // ── speed-varied energy (same climb target, different speed) ──
  { name: "climb_slow", note: "elev 0.8 + speed 0.25 — low energy (expect weak climb)", spec: spec({ elevation: constant(0.80), speed: constant(0.25) }) },
  { name: "climb_fast", note: "elev 0.8 + speed 0.85 — high energy (more climb headroom)", spec: spec({ elevation: constant(0.80), speed: constant(0.85) }) },
];
