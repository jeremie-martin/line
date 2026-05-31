/**
 * drums 0–56s — the full Believer drums detection (beats/drums_0_56s_60_125.json).
 *
 * WINDOWED FILTER EXPERIMENT: give the rider a CLEAN RUNWAY for the first 5s —
 * drop onsets that fall <0.4s after the previously kept one, but ONLY while
 * t<5s. After 5s, keep EVERY onset (the dense ~0.12s / ≈5-frame clusters
 * intact). The hypothesis: a well-spaced start lets the forward-greedy handoff
 * compiler build momentum/altitude and then carry through the later clusters,
 * instead of stalling at the first contact. Spawn artifact (t<0.3) always
 * dropped.
 *
 * Axis design — INCREMENTAL STEP 1 (simplest): a single section with NO axis
 * targets. The compiler is only asked to hit the contacts with whatever
 * geometry is easiest; no air/speed/grain pressure. This isolates whether the
 * dense clusters are reachable at all when the axes aren't forcing the catch
 * shape. Once the rider survives the full 56s here, layer the axis arc back on
 * (air peak at 22s, speed ramp 0.6→0.9) one step at a time.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Spec, Contact } from "../types.ts";

type Onset = { t: number; votes: number };

const raw = JSON.parse(
  readFileSync(resolve("beats/drums_0_56s_60_125.json"), "utf8"),
) as { range_s: [number, number]; onsets: Onset[] };

const RUNWAY_END = 5.0; // seconds of clean (≥0.4s-spaced) runway at the start
const MIN_SPACING = 0.4; // seconds; only enforced while t < RUNWAY_END
const contacts: Contact[] = [];
let lastKept = -Infinity;
for (const o of raw.onsets) {
  if (o.t < 0.3) continue; // spawn artifact
  if (o.t < RUNWAY_END && o.t - lastKept < MIN_SPACING) continue; // thin clusters in the runway only
  contacts.push({ t: o.t });
  lastKept = o.t;
}

const spec: Spec = {
  duration: raw.range_s[1],
  contacts,
  // No axis pressure — the compiler hits contacts with whatever geometry is
  // easiest (incremental step 1; see header).
  axes: {},
};

export default spec;
