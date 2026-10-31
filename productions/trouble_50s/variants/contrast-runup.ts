/**
 * Trouble · contrast-runup. contrast-fast, with kick's run-up into the drop instead of
 * the big float: three small hits growing on the voice alone (27.73, 28.09, 28.58).
 * The air ask in the break drops back to the groove's, since there is no float.
 */
import type { Curve, Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";
import contrast, { impactFor, times } from "./contrast.ts";
import { fastSpeed } from "./contrast-fast.ts";

const RUNUP = [0.12, 0.16, 0.2];
const runup = (t: number) => m.BREAK_VOICE.findIndex((x) => Math.abs(x - t) < 0.03);
export const runupImpact = (t: number) => (runup(t) >= 0 ? RUNUP[runup(t)] : impactFor(t));
export const runupTimes = m.landings(times, m.BREAK_VOICE);

export const runupAir: Curve = keyframes([
  { t: 0.0, v: 0.60, ease: "smooth" },
  { t: m.GROOVE_T, v: 0.58, ease: "smooth" },
  { t: m.DROP_T, v: 0.66, ease: "smooth" },
  { t: m.STOP_T, v: 0.62, ease: "smooth" },
  { t: 45.9, v: 0.90, ease: "smooth" }, // the second big float, into 46.95 (as contrast)
  { t: m.BUILD_END_T, v: 0.66, ease: "smooth" },
  { t: m.DURATION, v: 0.64 },
]);

export const overlayMeta = m.overlayMeta;
const spec: Spec = {
  ...contrast,
  contacts: beats(runupTimes.map((t) => ({ t, impact: runupImpact(t) }))),
  axes: { air: runupAir, speed: fastSpeed },
};
export default spec;
