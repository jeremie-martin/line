/**
 * impact_calib_rich — a dense calibration corpus (NOT a benchmark). Many beats spanning the authored
 * impact range, each with DELIBERATELY VARIED setup (gap / amplitude / air / speed, seeded-PRNG jitter),
 * so that compiling it across seeds yields a rich cloud of (authored, achieved-redirArc-px) points to
 * AUTO-FIT the normalization (SOFT/VSTRONG, linear vs curve) on, instead of eyeballing sliders. Native
 * new-scale. The variety is the point: each authored level is sampled under many setups so the average
 * delivery curve is clean despite per-beat noise.
 */
import type { Contact, Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";

// deterministic LCG so the spec loads identically every time
let _s = 12345;
const rnd = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

const LEVELS = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95];
const PER = 14; // beats per level under varied setup
// build a shuffled (level, setup) list so consecutive beats differ (varied rider state)
const plan: { imp: number; gap: number; amp: number; air: number; spd: number }[] = [];
for (const imp of LEVELS) {
  for (let i = 0; i < PER; i++) {
    plan.push({
      imp,
      gap: lerp(0.8, 2.0, rnd()),
      amp: lerp(0.2, 0.9, rnd()),
      air: lerp(0.2, 0.85, rnd()),
      spd: lerp(0.55, 0.9, rnd()),
    });
  }
}
// shuffle (Fisher-Yates with the LCG)
for (let i = plan.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [plan[i], plan[j]] = [plan[j], plan[i]]; }

const contacts: Contact[] = [];
const ampKf: { t: number; v: number }[] = [];
const airKf: { t: number; v: number }[] = [];
const spdKf: { t: number; v: number }[] = [];
let t = 1.5;
for (const p of plan) {
  contacts.push({ t: Number(t.toFixed(3)), impact: p.imp });
  ampKf.push({ t: Number(t.toFixed(3)), v: +p.amp.toFixed(3) });
  airKf.push({ t: Number(t.toFixed(3)), v: +p.air.toFixed(3) });
  spdKf.push({ t: Number(t.toFixed(3)), v: +p.spd.toFixed(3) });
  t += p.gap;
}

const spec: Spec = {
  duration: Math.ceil(t + 1.5),
  contacts,
  axes: {
    speed: keyframes(spdKf, "linear"),
    air: keyframes(airKf, "linear"),
    amplitude: keyframes(ampKf, "linear"),
  },
  preroll: 5,
};
export default spec;
