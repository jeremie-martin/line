/**
 * Valhalla · kicks. phrases, but the groove lands only the kicks: every kick a big
 * hit, with airs between them (1.0 and 1.6 s), instead of kick→snare pairs.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";
import phrases, { impactFor, speed } from "./phrases.ts";

const times = m.landings(m.OPENING_NOTES, m.LONE_HITS, m.PHRASE_STARTS, m.ACCENTS, m.KICKS);

export const overlayMeta = m.overlayMeta;
const spec: Spec = {
  ...phrases,
  contacts: beats(times.map((t) => ({ t, impact: impactFor(t) }))),
  axes: {
    speed,
    air: keyframes([
      { t: 0.0, v: 0.80, ease: "smooth" },
      { t: 8.6, v: 0.78, ease: "smooth" },
      { t: m.PHRASES_T, v: 0.56, ease: "smooth" },
      { t: 26.6, v: 0.60, ease: "smooth" },
      { t: 28.0, v: 0.85, ease: "smooth" },
      { t: m.DROP_T, v: 0.75, ease: "smooth" },
      { t: m.DURATION, v: 0.72 },
    ]),
  },
};
export default spec;
