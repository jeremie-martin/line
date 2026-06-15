/**
 * "Shelter" — full-range impact variant of shelter_impact.ts. Same proven shelter_amp choreography
 * and the same musical impact CONTOUR (soft intro/groove, hard chorus/drop hits, floaty break, outro
 * build), but the contour is linearly RESCALED so the softest landing maps to 0 and the hardest to 1
 * — every section now uses the whole authored scale. Lets us see, on a real musical ride, what
 * authoring impact across the full 0→1 range looks (and feels) like. Native new-scale (no migration).
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
  if (t < 9.93) return 0.18 + (t / 9.93) * 0.20;          // gentle sparse intro
  if (t < 19.53) return 0.28 + ((t - 9.93) / 9.6) * 0.12; // hook lift
  if (t < 29.13) return 0.32;                             // verse groove
  if (t < 38.73) return 0.28 + ((t - 29.13) / 9.6) * 0.18; // coil into chorus
  if (t < 57.93) return 0.68;                             // chorus: hard bright hits
  if (t < 67.53) return 0.34;                             // regroup/dip
  if (t < 72.33) return 0.72;                             // second drop punches
  if (t < 76.5) return 0.20;                              // voice/break floats
  return 0.46;                                            // outro build
}

function impactAt(t: number): number {
  let v = sectionImpact(t);
  if (near(t, phraseHits)) v += 0.10;
  if (near(t, showpieceLandings)) v += 0.12;
  if (t >= 72.33 && t < 76.5) v -= 0.08; // keep the deepest break intentionally soft
  return v;
}

// Linear rescale of the natural contour to the full [0,1]: softest landing → 0, hardest → 1.
const vals = baseSpec.contacts.map((c) => impactAt(c.t));
const lo = Math.min(...vals);
const hi = Math.max(...vals);
const rescaledImpact = (t: number): number => (impactAt(t) - lo) / (hi - lo);

const contacts: Contact[] = withImpact(baseSpec.contacts, rescaledImpact);

export const overlayMeta = {
  ...baseOverlayMeta,
  tempo: "100 BPM · 4/4 · amplitude + impact (full-range)",
};

const spec: Spec = {
  ...baseSpec,
  contacts,
};

export default spec;
