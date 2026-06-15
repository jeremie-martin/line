/**
 * Handoff comparison — variant A: ≥0.4s spacing filter over the WHOLE 0–56s
 * range (golden-style spacing applied everywhere). No axis pressure so
 * filtering is the only variable across the three comparison specs.
 */
import type { Spec } from "../types.ts";
import { beats } from "../core/beats.ts";
import { BELIEVER_MUSIC } from "./_music.ts";

// Post-filter onsets inlined from the former beats/drums_0_56s_60_125.json
// (≥0.4s spacing enforced over the whole 0–56s range).
const beatTimes = [
  0.02, 0.5, 0.97, 1.45, 1.93, 2.41, 2.89, 3.37, 3.85, 4.33, 4.81, 5.29,
  5.77, 6.25, 6.73, 7.21, 7.69, 8.18, 8.65, 9.13, 9.61, 10.1, 10.58, 11.06,
  11.53, 12.01, 12.5, 12.98, 13.45, 13.94, 14.42, 14.9, 15.36, 15.86, 16.34,
  16.938, 17.78, 18.74, 19.21, 19.7, 20.18, 20.66, 21.13, 21.62, 22.58,
  23.04, 23.54, 24.02, 24.49, 24.97, 25.45, 25.93, 26.41, 26.89, 27.36,
  27.86, 28.34, 28.81, 29.78, 30.26, 30.74, 31.22, 31.69, 32.18, 32.65,
  33.13, 33.62, 34.1, 34.57, 35.06, 35.53, 36.02, 36.49, 36.98, 37.94,
  38.42, 38.9, 39.37, 39.85, 40.33, 40.82, 41.28, 41.77, 42.25, 42.74,
  43.21, 43.93, 44.65, 45.13, 45.61, 46.1, 46.58, 47.06, 47.53, 48.01, 48.5,
  48.97, 49.45, 49.94, 50.9, 51.38, 51.85, 52.33, 52.82, 54.72, 55.46,
];
const contacts = beats(beatTimes.map((t) => ({ t })));

const spec: Spec = { duration: 56, music: BELIEVER_MUSIC, contacts, axes: {} };
export default spec;
