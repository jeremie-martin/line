/**
 * Valhalla · words. phrases, plus the fast runs of words (about 0.32 s apart):
 * close, light hits where the words come fast, long rides on held notes. The voice
 * becomes a closer visualization before the drop; the groove is the same.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";
import phrases, { impactFor, times, speed } from "./phrases.ts";

const run = (t: number) => m.WORD_RUNS.some((x) => Math.abs(x - t) < 0.03) && !m.ACCENTS.some((x) => Math.abs(x - t) < 0.03);
const impact = (t: number) => (run(t) ? Number(m.clamp(m.voiceStrength(t), 0.06, 0.2).toFixed(3)) : impactFor(t));

export const overlayMeta = m.overlayMeta;
const spec: Spec = {
  ...phrases,
  contacts: beats(m.landings(times, m.WORD_RUNS).map((t) => ({ t, impact: impact(t) }))),
  // Close hits leave less room for air in the phrases.
  axes: {
    speed,
    air: keyframes([
      { t: 0.0, v: 0.80, ease: "smooth" },
      { t: 8.6, v: 0.78, ease: "smooth" },
      { t: m.PHRASES_T, v: 0.45, ease: "smooth" },
      { t: 26.6, v: 0.50, ease: "smooth" },
      { t: 28.0, v: 0.85, ease: "smooth" },
      { t: m.DROP_T, v: 0.60, ease: "smooth" },
      { t: m.DURATION, v: 0.58 },
    ]),
  },
};
export default spec;
