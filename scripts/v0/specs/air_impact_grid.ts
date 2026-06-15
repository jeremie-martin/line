/**
 * air_impact_grid — a Q3/Q1 probe (NOT a benchmark). A 2×2: impact {0.1, 0.9} × air {0.3, 0.8}, four
 * beats per cell, clearly sectioned. Tests whether the LANDING steepness (→ redirArc) is controllable
 * INDEPENDENTLY of air time: does low-impact+high-air land gently (like low-impact+low-air), or does it
 * slam (like high-impact+high-air)? Amplitude held low/constant + moderate speed to isolate air. Native
 * new-scale. Section order: (0.1,0.3) (0.1,0.8) (0.9,0.3) (0.9,0.8).
 */
import type { Contact, Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";

const CELLS: { imp: number; air: number }[] = [
  { imp: 0.1, air: 0.3 }, { imp: 0.1, air: 0.8 }, { imp: 0.9, air: 0.3 }, { imp: 0.9, air: 0.8 },
];
const PER = 4;
const gapSec = (air: number) => 0.8 + 1.2 * air; // more air ⇒ more airborne time ⇒ bigger gap

const contacts: Contact[] = [];
const airKf: { t: number; v: number }[] = [];
let t = 1.5;
for (const { imp, air } of CELLS) {
  for (let i = 0; i < PER; i++) {
    contacts.push({ t: Number(t.toFixed(3)), impact: imp });
    airKf.push({ t: Number(t.toFixed(3)), v: air });
    t += gapSec(air);
  }
}

const spec: Spec = {
  duration: Math.ceil(t + 1.5),
  contacts,
  axes: {
    speed: keyframes([{ t: 0, v: 0.72 }], "hold"),
    air: keyframes(airKf, "hold"),
    amplitude: keyframes([{ t: 0, v: 0.3 }], "hold"),
  },
  preroll: 5,
};
export default spec;
