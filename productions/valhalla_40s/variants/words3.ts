/**
 * Valhalla · words3. words2 (the owner's favourite) with its words from the sung-note detector (music.ts
 * SUNG_WORDS): the "oh-oh-oh" at about 10 s and 15.49 added. Each word a clear hit (0.2–0.35) rather than a
 * touch, accents firmer. The calm opening and the groove are as in phrases2.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";
import phrases, { times, speed } from "./phrases.ts";
import { bigger } from "./phrases2.ts";

const near = (layer: number[], t: number) => layer.some((x) => Math.abs(x - t) < 0.03);
const word = (t: number) => near(m.SUNG_WORDS, t) && !near(m.ACCENTS, t) && !near(m.PHRASE_STARTS, t) && !near(m.LONE_HITS, t);
const impact = (t: number) => (word(t) ? Number(m.clamp(0.2 + 0.5 * m.rise(t, "vocals"), 0.2, 0.35).toFixed(3)) : bigger(t));

export const overlayMeta = m.overlayMeta;
const spec: Spec = {
  ...phrases,
  contacts: beats(m.landings(times, m.SUNG_WORDS).map((t) => ({ t, impact: impact(t) }))),
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
