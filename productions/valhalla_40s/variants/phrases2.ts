/**
 * Valhalla · phrases2. phrases (owner: "very good, very smooth"), with every hit after
 * the slow opening a little bigger, so the opening's soft landings stand apart: phrase
 * starts 0.2–0.3, accents 0.3–0.45, the lone hits 0.6.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";
import phrases, { impactFor, times } from "./phrases.ts";

const near = (layer: number[], t: number) => layer.some((x) => Math.abs(x - t) < 0.03);
/** After the opening: the voice firmer, and its accents firmest. */
export function bigger(t: number): number {
  if (t < m.PHRASES_T || t >= m.DROP_T) return impactFor(t);
  if (near(m.LONE_HITS, t)) return 0.6;
  const base = near(m.ACCENTS, t) ? 0.3 : 0.2;
  return Number(m.clamp(base + 0.5 * m.rise(t, "vocals"), base, 0.45).toFixed(3));
}

export const overlayMeta = m.overlayMeta;
const spec: Spec = { ...phrases, contacts: beats(times.map((t) => ({ t, impact: bigger(t) }))) };
export default spec;
