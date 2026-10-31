/**
 * Circus Minimus · pulse808. One motif from start to end: the 808's 3-2-3
 * (BOOM . . BOOM . BOOM . .), the loudest layer in every section. No snares and no
 * voice: bigger airs (0.8 and 1.2 s) and a steady, readable pulse. The intro keeps
 * its floats (bar starts only), the hook lands the kickless bass swells, the break
 * floats, and the re-entry and last hit are pinned as in groove.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import * as m from "../music.ts";
import groove, { impactFor, speed } from "./groove.ts";

const times = m.landings(m.INTRO_BARS, m.VERSE_KICKS, m.GROOVE_KICKS, m.HOOK_BASS, m.OUTRO_BARS, m.OUTRO_KICKS);

export const overlayMeta = m.overlayMeta;
const spec: Spec = {
  ...groove,
  contacts: beats(times.map((t) => ({ t, impact: impactFor(t) }))),
  axes: {
    speed,
    air: keyframes([
      { t: 0.0, v: 0.82, ease: "smooth" },
      { t: 11.5, v: 0.80, ease: "smooth" },
      { t: m.VERSE_T, v: 0.68, ease: "smooth" },
      { t: m.BREAK_T, v: 0.68, ease: "smooth" },
      { t: 50.4, v: 0.88, ease: "smooth" },
      { t: m.REENTRY_T, v: 0.66, ease: "smooth" },
      { t: m.DURATION, v: 0.64 },
    ]),
  },
};
export default spec;
