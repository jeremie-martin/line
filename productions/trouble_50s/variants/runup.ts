/**
 * Trouble · runup. kick, except the break: instead of one float into the drop, the
 * rider takes the three syllables of the voice alone (27.73, 28.09, 28.58), small and
 * growing, then the drop. Taken from pulse, where this run-up worked as well as kick's float.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";
import kick, { impactFor, times } from "./kick.ts";

const RUNUP = [0.12, 0.16, 0.2];
const runup = (t: number) => m.BREAK_VOICE.findIndex((x) => Math.abs(x - t) < 0.03);

export const overlayMeta = m.overlayMeta;
const spec: Spec = {
  ...kick,
  contacts: beats(m.landings(times, m.BREAK_VOICE).map((t) => ({ t, impact: runup(t) >= 0 ? RUNUP[runup(t)] : impactFor(t) }))),
};
export default spec;
