/**
 * impact_grade — a clean gradation staircase for placing VSTRONG and confirming mid-range discrimination
 * (NOT a benchmark). impact 0.1 → 0.9 in 0.1 steps, 3 beats per level, consistent ALIGNED setup (gap +
 * amplitude + air rise with impact so each level is achievable and the progression is steady, not noisy).
 * Watch it to judge: is each step distinguishable, and at what point does it already feel "very strong"
 * (→ VSTRONG)? Native new-scale.
 */
import type { Contact, Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";

const LEVELS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const PER = 3;
const gapSec = (lv: number) => 0.9 + 1.0 * lv;

const contacts: Contact[] = [];
const ampKf: { t: number; v: number }[] = [];
const airKf: { t: number; v: number }[] = [];
let t = 1.5;
for (const lv of LEVELS) {
  for (let i = 0; i < PER; i++) {
    contacts.push({ t: Number(t.toFixed(3)), impact: lv });
    ampKf.push({ t: Number(t.toFixed(3)), v: +(0.20 + 0.55 * lv).toFixed(3) });
    airKf.push({ t: Number(t.toFixed(3)), v: +(0.30 + 0.50 * lv).toFixed(3) });
    t += gapSec(lv);
  }
}

const spec: Spec = {
  duration: Math.ceil(t + 1.5),
  contacts,
  axes: {
    speed: keyframes([{ t: 0, v: 0.74 }], "hold"),
    air: keyframes(airKf, "linear"),
    amplitude: keyframes(ampKf, "linear"),
  },
  preroll: 5,
};
export default spec;
