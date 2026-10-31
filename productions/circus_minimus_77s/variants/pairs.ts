/**
 * Circus Minimus · pairs. groove, plus the snare pickups that lead into a downbeat every
 * other bar ("ta . ta-BOOM", 0.4 and 0.2 s before the bar) in the verse, the groove and
 * the full groove, and the hook's synth pickups into its phrases. Each one is audible:
 * about as loud as a snare. More personality; the 0.2 s gaps are the compiler's hardest
 * move, so fewer seeds may finish. The 38.28 pickup is left out: it is 0.13 s after
 * the hook's lift (38.15).
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";
import groove, { impactFor, times } from "./groove.ts";

const PICKUPS = [...m.VERSE_PICKUPS, ...m.GROOVE_PICKUPS.filter((t) => t !== 38.28), ...m.HOOK_SYNTH_PICKUPS, ...m.OUTRO_PICKUPS.slice(0, -2)];
const pickup = (t: number) => PICKUPS.some((x) => Math.abs(x - t) < 0.03);

export const overlayMeta = m.overlayMeta;
const spec: Spec = {
  ...groove,
  contacts: beats(m.landings(times, PICKUPS).map((t) => ({
    t, impact: pickup(t) ? Number(m.clamp(m.drumStrength(t), 0.2, 0.4).toFixed(3)) : impactFor(t),
  }))),
};
export default spec;
