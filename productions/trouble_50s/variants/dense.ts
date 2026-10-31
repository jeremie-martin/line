/**
 * Trouble · dense. pulse revisited with the owner's round-1 feedback: kick, plus every
 * extra landing this song supports, i.e. only sounds that stand out, at their measured
 * strength. Measured, few qualify:
 *
 *   break    the run-up: the voice alone, three small growing hits into the drop;
 *   drop     "boom-TAK": the snare/tom 0.22 s after a heavy kick (31.72, 38.87, about half
 *            a kick's loudness), and the two loud bass entries 0.23 s before one (30.59, 37.76).
 * Not landed, as in kick: the groove pickups (a seventh of a kick, nearly silent in the mix),
 * the voice over the drums, and anything next to the two three-kick clusters, which stay clean.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";
import kick, { impactFor, times } from "./kick.ts";

const RUNUP = [0.12, 0.16, 0.2];
const BOOM_TAK = [31.72, 38.87];
const BASS_ENTRIES = [30.59, 37.76];
const at = (layer: number[], t: number) => layer.findIndex((x) => Math.abs(x - t) < 0.03);
function denseImpact(t: number): number {
  if (at(m.BREAK_VOICE, t) >= 0) return RUNUP[at(m.BREAK_VOICE, t)];
  if (at(BOOM_TAK, t) >= 0) return Number(m.drumStrength(t).toFixed(3));
  if (at(BASS_ENTRIES, t) >= 0) return 0.25;
  return impactFor(t);
}

export const overlayMeta = m.overlayMeta;
const spec: Spec = {
  ...kick,
  contacts: beats(m.landings(times, m.BREAK_VOICE, BOOM_TAK, BASS_ENTRIES).map((t) => ({ t, impact: denseImpact(t) }))),
};
export default spec;
