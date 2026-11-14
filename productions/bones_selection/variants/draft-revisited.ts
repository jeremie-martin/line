/**
 * Bones: the listening draft (spec.ts), revisited.
 *
 * Kept: its landings, all 110, each moved onto its measured event where one lies within 30 ms (bridge words, bass entries, the drum line with its lighter strokes, the voice's
 * accents in the chorus), and its speed.
 * Changed, and why:
 * - The bridge asked 0.40 for every word of an almost whispered voice, as much as a drum stroke. Now 0.14, the four
 *   sharpest words 0.22, the bass entries 0.36: the bridge is calm and the chorus has somewhere to come from.
 * - The pickup was flat; it now climbs: words 0.24 to 0.42, strokes 0.50, 0.60, 0.70.
 * - The chorus entry is the sharpest attack of the clip: 0.90 becomes 1.
 * - All 35 heavy hits asked 0.80. Now the first hit of a bar 0.80, the second (louder in the mix) 0.86, and the four
 *   fill bars climb through their three hits (0.84, 0.90, 0.95); the last hit of the song 0.97.
 * - Air rose to 0.88 over the silent tail, a jump into nothing: it now comes down to the line for a ride-out. The
 *   curve is redrawn, so the pickup and the chorus differ slightly too (within 0.1).
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import { curve } from "../../../scripts/v0/core/measured.ts";
import * as m from "../music.ts";
import old from "../spec.ts";

export const overlayMeta = m.overlayMeta;
const near = (list: number[], t: number) => list.findIndex(x => Math.abs(x - t) < 0.03);
function impact(t: number, was: number): number {
  if (near([m.CHORUS], t) >= 0) return 1;
  if (near(m.BASS_ENTRIES, t) >= 0) return 0.36;
  if (near(m.PICKUP_WORDS, t) >= 0) return 0.24 + 0.06 * near(m.PICKUP_WORDS, t);
  if (near(m.PICKUP_DRUMS, t) >= 0) return 0.50 + 0.10 * near(m.PICKUP_DRUMS, t);
  if (t < 15.2) return near([0.38, 3.54, 4.60, 6.69], t) >= 0 ? 0.22 : 0.14;
  const first = near(m.FIRST, t), second = near(m.SECOND, t);
  if (first >= 0) return first % 4 === 3 ? 0.84 : 0.80;
  if (near(m.FILL, t) >= 0) return 0.90;
  if (second >= 0) return second === 15 ? 0.97 : second % 4 === 3 ? 0.95 : 0.86;
  return was;
}
/** Old landings that sit on a sung note with no measured event within 30 ms keep their time. */
const unmeasured = old.contacts.map(k => k.t).filter(t => { try { m.event(t); return false; } catch { return true; } });
const spec: Spec = {
  ...old,
  contacts: beats(m.table(old.contacts.map((k): [number, number] => [k.t, impact(k.t, k.impact!)]), unmeasured)),
  axes: {
    ...old.axes,
    air: curve([[0, 0.50], [8.6, 0.52], [15.2, 0.46], [16.4, 0.42], [17.1, 0.62], [m.CHORUS, 0.58], [33.1, 0.60], [49.7, 0.60], [50.6, 0.40], [51.4, 0.18],
      [m.DURATION, 0.10]]),
  },
};

export default spec;
