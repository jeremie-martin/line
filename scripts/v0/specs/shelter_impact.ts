/**
 * "Shelter" (Porter Robinson & Madeon) — first 1:21, amplitude + impact.
 *
 * This keeps the proven `shelter_amp.ts` choreography: variable-density 100 BPM
 * contacts, phrase-hit rests, and air/speed/amplitude curves. The new authoring
 * layer is per-beat `impact`: soft intro/groove landings, hard chorus/drop hits,
 * a floaty low-impact break, then a moderate outro build.
 *
 * impact is intentionally expressive, not optimizer-tuned. The compiler currently
 * scores it but does not steer catch angle toward it, so the impact errors are a
 * baseline read of the new target rather than a spec failure.
 */
import baseSpec, { overlayMeta as baseOverlayMeta } from "./shelter_amp.ts";
import type { Contact, Spec } from "../types.ts";
import { withImpact } from "../core/beats.ts";

const phraseHits = [0.33, 9.93, 19.53, 29.13, 38.73, 48.33, 57.93, 67.53, 77.13];
const showpieceLandings = [39.93, 44.73, 48.33, 51.93, 56.73, 68.73, 71.13, 77.13];

function near(t: number, xs: number[], eps = 0.04): boolean {
  return xs.some((x) => Math.abs(t - x) <= eps);
}

function sectionImpact(t: number): number {
  // Madmom: 100 BPM, phrase boundaries 0.33 / 9.93 / 19.53 / 29.13 / 38.73 /
  // 48.33 / 57.93 / 67.53 / 77.13. These values are the musical intent.
  if (t < 9.93) return 0.18 + (t / 9.93) * 0.20;       // gentle sparse intro
  if (t < 19.53) return 0.28 + ((t - 9.93) / 9.6) * 0.12; // hook lift
  if (t < 29.13) return 0.32;                          // verse groove
  if (t < 38.73) return 0.28 + ((t - 29.13) / 9.6) * 0.18; // coil into chorus
  if (t < 57.93) return 0.68;                          // chorus: hard bright hits
  if (t < 67.53) return 0.34;                          // regroup/dip
  if (t < 72.33) return 0.72;                          // second drop punches
  if (t < 76.5) return 0.20;                           // voice/break floats
  return 0.46;                                         // outro build
}

function impactAt(t: number): number {
  let v = sectionImpact(t);
  if (near(t, phraseHits)) v += 0.10;
  if (near(t, showpieceLandings)) v += 0.12;
  // Keep the deepest break intentionally soft even though amplitude is high.
  if (t >= 72.33 && t < 76.5) v -= 0.08;
  return v;
}

const contacts: Contact[] = withImpact(baseSpec.contacts, impactAt);

export const overlayMeta = {
  ...baseOverlayMeta,
  tempo: "100 BPM · 4/4 · amplitude + impact",
};

const spec: Spec = {
  ...baseSpec,
  contacts,
};

export default spec;
