/** Out of the ground and into the air, then back down for the last line: a wider arc than the approved
 * ride, which holds one level from the pickup to the end.
 * From the approved reading: the creeping spoken bridge, the full pace from the pickup on, all the strengths.
 * From Opus: the one lift on the held vowel, the slow tall arcs over the bass entries, the pickup pulled
 * taut and flat into the crash, and the float above the drums where the singer holds the long low notes.
 * Its own: the chorus starts grounded, so the backbeats stand out, and takes off with its second drum
 * sentence, riding high from there through the held voice; the last line brings the rider back to the line.
 * From Sol: the fill lifts it once more into its last heavy stroke, and the three backbeats you asked
 * to be stronger in the second sentence are raised as Sol raised them. The resonance is a long, slowing glide. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export {overlayMeta} from '../spec.ts';

const raised: Record<string, number> = {'22.23': 0.95, '23.263': 0.85, '25.411': 0.63};
const contacts = base.contacts.map(({t, impact = 0}) => ({t, impact: raised[String(t)] ?? impact}));

const ends = contacts.map((c) => c.t);
/** A value per gap, chosen by the landing that ends it and the gap's length (s); `tail` after the last landing. */
const perGap = (f: (end: number, len: number) => number, tail: number) => (t: number) => {
  const i = ends.findIndex((e) => e >= t);
  if (i < 0) return tail;
  return f(ends[i], ends[i] - (i > 0 ? ends[i - 1] : 0));
};

const air = perGap((end, len) => {
  if (end < 4.0) return 0.38; // Creeping.
  if (end < 4.2) return 0.9; // The held vowel.
  if (end < 11.0) return len > 0.68 ? 0.88 : 0.5; // Bass swells.
  if (end < 13.35) return 0.42; // Taut pickup.
  if (end < 21.7) return 0.52; // First drum sentence: grounded.
  if (end < 30.1) return len > 0.4 ? 0.82 : 0.72; // Second sentence takes off.
  if (end < 38.5) return len > 0.4 ? 0.84 : 0.7; // Floating over the held notes.
  if (end < 44.8) return 0.5; // The last line, back on the ground.
  if (end < 45.7) return 0.8; // The fill lifts into its last heavy stroke.
  return 0.5;
}, 0.8);

const spec: Spec = {...base, contacts,
  axes: {
    air,
    speed: curve([
      [0, .30], [4.107, .30], [4.885, .44], [10.922, .46], [11.224, .66], [12.501, 1], [30.136, 1], [31.2, .9],
      [38.02, .9], [38.565, 1], [45.671, 1], [45.926, .80], [46.425, .54], [48.423, .24],
    ]),
  }};
export default spec;
