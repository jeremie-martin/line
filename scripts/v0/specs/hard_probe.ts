/**
 * hard_probe — a Q3 diagnostic spec (NOT a benchmark). Every beat authors impact 1.0 with aligned,
 * roomy setup (big gaps for vy budget, high amplitude/air so the up-arc serves the redirection), so
 * the compiler is asked for — and physically *can* reach — the hardest hits. Used to measure whether
 * cranking the impact levers lifts achieved redirArc toward the physical ceiling (v·1.12), and at what
 * cost to the other axes. Native new-scale.
 */
import type { Contact, Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";

const N = 16;
const contacts: Contact[] = [];
const ampKf: { t: number; v: number }[] = [];
const airKf: { t: number; v: number }[] = [];
let t = 1.5;
for (let i = 0; i < N; i++) {
  contacts.push({ t: Number(t.toFixed(3)), impact: 1.0 });
  ampKf.push({ t: Number(t.toFixed(3)), v: 0.85 });
  airKf.push({ t: Number(t.toFixed(3)), v: 0.75 });
  t += 1.8; // roomy: vy budget for a hard hit + clear spacing
}

const spec: Spec = {
  duration: Math.ceil(t + 1.5),
  contacts,
  axes: {
    speed: keyframes([{ t: 0, v: 0.78 }], "hold"),
    air: keyframes(airKf, "linear"),
    amplitude: keyframes(ampKf, "linear"),
  },
  preroll: 5,
};
export default spec;
