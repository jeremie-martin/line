/**
 * impact_showcase — full-range impact authored NATIVELY on the new redirArc felt scale (0=soft,
 * 1=very strong), with the other axes set COMPATIBLE: amplitude + air rise WITH impact, and the
 * gap grows with the ask (a hard hit gets the vy budget it needs). Tests the mission's core goal —
 * can an author dial impact 0.1→1.0 across a beat list and get a meaningful, discriminating amount
 * WITHOUT sacrificing the other axes — in the physically-compatible regime (impact redirection
 * served by the same up-arc that makes amplitude/air, not fought by a flat scoop).
 *
 * New-convention authoring: impact values are the NEW scale (no migrateImpact wrap).
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";

const LEVELS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const PER = 4;
const gapSec = (lv: number) => 0.6 + 0.8 * lv; // hard hits get room (vy budget)

const contacts: Contact[] = [];
const ampKf: { t: number; v: number }[] = [];
const airKf: { t: number; v: number }[] = [];
let t = 1.0;
for (const lv of LEVELS) {
  for (let i = 0; i < PER; i++) {
    contacts.push({ t: Number(t.toFixed(3)), impact: lv });
    // amplitude + air rise WITH impact so the up-arc that makes them also delivers the redirection
    ampKf.push({ t: Number(t.toFixed(3)), v: +(0.20 + 0.70 * lv).toFixed(3) });
    airKf.push({ t: Number(t.toFixed(3)), v: +(0.35 + 0.45 * lv).toFixed(3) });
    t += gapSec(lv);
  }
}

const spec: Spec = {
  duration: Math.ceil(t + 1),
  contacts,
  axes: {
    speed: constant(0.68),
    air: keyframes(airKf, "linear"),
    amplitude: keyframes(ampKf, "linear"),
  },
  preroll: 5,
};
export default spec;
