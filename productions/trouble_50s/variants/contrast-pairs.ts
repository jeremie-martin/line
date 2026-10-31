/**
 * Trouble · contrast-pairs. contrast-runup, plus more two-hit pairs on audible sounds
 * ("ta-BOOM"): the two loud bass entries 0.23 s before a heavy kick (30.59, 37.76). With
 * boom-TAK (31.72, 38.87) each of those two drop cycles becomes ta-BOOM … boom-TAK.
 * The three-kick clusters stay clean.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";
import runup, { runupImpact, runupTimes } from "./contrast-runup.ts";

const BASS_ENTRIES = [30.59, 37.76];
const bass = (t: number) => BASS_ENTRIES.some((x) => Math.abs(x - t) < 0.03);

export const overlayMeta = m.overlayMeta;
const spec: Spec = {
  ...runup,
  contacts: beats(m.landings(runupTimes, BASS_ENTRIES).map((t) => ({ t, impact: bass(t) ? 0.25 : runupImpact(t) }))),
};
export default spec;
