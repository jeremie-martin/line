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

import type { Spec } from "../types.ts";
import { beats } from "../core/beats.ts";
import { BELIEVER_MUSIC } from "./_music.ts";

// Post-filter onsets inlined from the former beats/drums_0_56s_60_125.json (clean
// ≥0.4s-spaced runway for t<5s, every onset kept after; spawn artifact dropped).
const beatTimes = [
  0.5, 0.97, 1.45, 1.93, 2.41, 2.89, 3.37, 3.85, 4.33, 4.81, 5.29, 5.41,
  5.53, 5.77, 6.25, 6.73, 7.21, 7.69, 8.18, 8.65, 9.13, 9.25, 9.49, 9.61,
  10.1, 10.58, 11.06, 11.178, 11.412, 11.53, 12.01, 12.5, 12.98, 13.098,
  13.332, 13.45, 13.94, 14.42, 14.9, 15.36, 15.86, 16.34, 16.7, 16.938,
  17.055, 17.29, 17.78, 18.14, 18.74, 18.857, 18.975, 19.21, 19.7, 20.18,
  20.66, 20.778, 21.012, 21.13, 21.62, 21.98, 22.58, 23.04, 23.54, 24.02,
  24.49, 24.61, 24.85, 24.97, 25.45, 25.93, 26.41, 26.65, 26.77, 26.89,
  27.36, 27.86, 28.34, 28.458, 28.692, 28.81, 29.17, 29.78, 30.26, 30.74,
  31.22, 31.69, 32.18, 32.298, 32.532, 32.65, 33.13, 33.62, 34.1, 34.218,
  34.452, 34.57, 35.06, 35.53, 36.02, 36.138, 36.372, 36.49, 36.98, 37.34,
  37.94, 38.42, 38.9, 39.37, 39.85, 40.09, 40.21, 40.33, 40.82, 41.28,
  41.77, 41.89, 42.13, 42.25, 42.74, 43.21, 43.57, 43.93, 44.05, 44.17,
  44.65, 45.13, 45.61, 46.1, 46.58, 47.06, 47.53, 47.77, 47.89, 48.01,
  48.5, 48.97, 49.45, 49.573, 49.817, 49.94, 50.3, 50.9, 51.38, 51.498,
  51.732, 51.85, 52.33, 52.82, 54.72, 55.46, 55.7,
];
const contacts = beats(beatTimes.map((t) => ({ t })));

const spec: Spec = {
  duration: 56,
  music: BELIEVER_MUSIC,
  contacts,
  // No axis pressure — the compiler hits contacts with whatever geometry is
  // easiest (incremental step 1; see header).
  axes: {},
};

export default spec;
