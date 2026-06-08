/**
 * Shared helper: the canonical drums_0_30s_60_125 onsets, filtered to Contacts
 * that are reasonable for v0 to compile against, inlined so the timing lives WITH
 * the spec (no external beats/*.json dependency) and is co-authorable with
 * per-beat `impact`.
 *
 * The inlined `beatTimes` are the POST-filter onset times — the former filter
 * rules (drop onsets t < 0.5s, drop any onset < 0.4s after the previously kept
 * one) are already applied, so they don't need to be replicated here.
 */

import type { AxisCurves, Spec } from "../types.ts";
import { beats, withImpact, type ImpactRule } from "../core/beats.ts";

// Post-filter onsets inlined from the former beats/drums_0_30s_60_125.json.
const beatTimes = [
  0.5, 0.97, 1.45, 1.93, 2.41, 2.89, 3.37, 3.85, 4.33, 4.81, 5.29, 5.77,
  6.25, 6.73, 7.21, 7.69, 8.18, 8.65, 9.13, 9.61, 10.1, 10.58, 11.178,
  12.01, 12.5, 12.98, 13.45, 13.94, 14.42, 14.9, 15.36, 15.86, 16.34,
  16.938, 17.78, 18.857, 19.7, 20.18, 20.66, 21.13, 21.62, 22.58, 23.04,
  23.54, 24.02, 24.49, 25.45, 25.93, 26.41, 26.89, 27.36, 27.86, 28.34,
  28.81, 29.78,
];
const contacts = beats(beatTimes.map((t) => ({ t })));

export function drumsSpec(axes: AxisCurves, impact?: ImpactRule): Spec {
  return {
    duration: 30,
    contacts: impact === undefined ? contacts : withImpact(contacts, impact),
    axes,
  };
}
