/**
 * Amor na Praia: the default spec (spec.ts), revisited.
 *
 * Kept: its reading (a near-silent intro, the 808 burst, the drop, every kick of the groove at a strength from its
 * loudness, the re-drop, a quiet fade), its kick strengths, its speed.
 * Changed, and why:
 * - Its landings sat on an even 0.55 s grid, up to 40 ms from the sounds (95 ms for the last burst kick). Every landing is now on its measured kick.
 * - The intro's seven evenly spaced touches matched nothing heard; they are replaced by the 808 at 0.34 (0.40) and
 *   the nine voice chops (0.06).
 * - The burst was flat at 0.80 and skipped the answering kick at 4.72. Now 4.46, the loudest hit of the clip, is 1,
 *   4.72 is landed (0.70), and the rest climb 0.80 to 0.88 as the kicks tighten.
 * - Two landings asked for 1 (the drop and the re-drop); with 4.46 at 1 they become 0.95.
 * - The fade's two landings move onto the sung note (43.90, 0.08) and the soft kick (44.34, 0.30).
 * - The kick at 26.18, the last before the hole, was skipped: landed at 0.60, like its neighbours.
 * - Air ended at 0.85, a jump into nothing: it now comes down to the line for a ride-out. Air in the groove is
 *   lowered from 0.70–0.80 to 0.55: a kick every 0.55 s leaves no room for long flights. The curve is redrawn, so the
 *   intro, the burst and the breath differ slightly too (within 0.1).
 */
import { join } from "node:path";
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import { curve, measuredSong } from "../../../scripts/v0/core/measured.ts";
import * as m from "../music.ts";
import old from "../spec.ts";

export const overlayMeta = m.overlayMeta;
const { table } = measuredSong(join(import.meta.dirname, ".."));
/** The old strength of a groove kick: the old landing within 60 ms of it (the old spec skipped the kick at 26.18, which takes 0.60, like its neighbours). */
const oldGroove = (t: number) => old.contacts.find(k => Math.abs(k.t - t) < 0.06)?.impact ?? 0.60;
const spec: Spec = {
  ...old,
  contacts: beats(table([
    [m.BOOM, 0.40], ...m.INTRO_PHRASES.flat().map((t): [number, number] => [t, 0.06]),
    ...m.BURST.map((t, i): [number, number] => [t, [1.00, 0.70, 0.80, 0.80, 0.82, 0.84, 0.86, 0.88][i]]),
    ...m.GROOVE_KICKS.map((t): [number, number] => [t, t === m.DROP || t === m.REDROP ? 0.95 : oldGroove(t)]),
    [m.FADE_VOICE[1], 0.08], [m.SOFT_RETURN, 0.30],
  ])),
  axes: {
    ...old.axes,
    air: curve([[0, 0.54], [4.2, 0.60], [m.BURST_START, 0.52], [7.75, 0.55], [8.4, 0.78], [m.DROP, 0.55], [43.2, 0.55], [43.8, 0.42], [44.4, 0.30], [45.2, 0.15],
      [m.DURATION, 0.10]]),
  },
};

export default spec;
