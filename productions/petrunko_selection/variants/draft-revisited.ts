/**
 * Petrunko: the listening draft (spec.ts), revisited.
 *
 * Kept: its landings, all 79 (the opening hit, the upper figure, the build and the doubled drums, three strokes of
 * the roll, the return, the replies, three decay strokes), and its speed.
 * Changed, and why:
 * - The figure's notes asked 0.46 (one 0.65); they now follow how sharply each is played (0.20–0.48).
 * - The build and the doubled drums were flat at 0.59 for eight seconds while the music grows: now 0.46 rising to
 *   0.70, then 0.62 to 0.76, and the roll's three strokes 0.66, 0.72, 0.78.
 * - The return is the sharpest attack of the clip: 0.92 becomes 1.
 * - All 42 reply landings asked 0.80, the lighter stroke that opens each bar included. Those strokes are a third
 *   quieter than the full hits: now 0.46, the first full hit of a bar 0.84, the others 0.80.
 * - The decay's strokes fade in the song: 0.50 flat becomes 0.40, 0.34, 0.28.
 * - Air rose to 0.82 over the decay, a jump into nothing: it now comes down to the line for a ride-out. The
 *   curve is redrawn, so the build, the suspension and the replies differ slightly too (within 0.1).
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import { curve } from "../../../scripts/v0/core/measured.ts";
import * as m from "../music.ts";
import old from "./draft.ts";

export const overlayMeta = m.overlayMeta;
const near = (list: number[], t: number) => list.findIndex(x => Math.abs(x - t) < 0.03);
const FIRST_OF_BAR = [24.78, 26.83, 29.56, 32.29, 35.69, 37.74, 40.47, 43.19, 46.60, 48.65, 51.37, 54.10];
const OLD_ROLL = [20.19, 20.54, 20.88];
function impact(t: number, was: number): number {
  const figure = m.FIGURE.find(f => Math.abs(f[0] - t) < 0.03);
  if (figure) return Number((0.14 + 0.62 * figure[1]).toFixed(2));
  if (near(m.BUILD_DRUMS, t) >= 0) return 0.46 + 0.03 * near(m.BUILD_DRUMS, t);
  if (near(m.DOUBLED, t) >= 0) return 0.62 + 0.02 * near(m.DOUBLED, t);
  if (near(OLD_ROLL, t) >= 0) return 0.66 + 0.06 * near(OLD_ROLL, t);
  if (near([m.RETURN], t) >= 0) return 1;
  if (near(m.BAR_STROKES, t) >= 0) return 0.46;
  if (near(FIRST_OF_BAR, t) >= 0) return 0.84;
  if (near(m.DECAY_STROKES, t) >= 0) return [0.40, 0.34, 0.28][near(m.DECAY_STROKES, t)] ?? 0.2;
  return was;
}
const spec: Spec = {
  ...old,
  contacts: beats(m.table(old.contacts.map((k): [number, number] => [k.t, impact(k.t, k.impact!)]))),
  axes: {
    ...old.axes,
    air: curve([[0, 0.58], [11.4, 0.58], [12.5, 0.42], [17.0, 0.32], [20.9, 0.30], [21.6, 0.84], [m.RETURN, 0.62], [55.3, 0.64], [56.4, 0.42], [58.0, 0.22],
      [m.DURATION, 0.12]]),
  },
};

export default spec;
