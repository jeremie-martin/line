/** The song as a swell on the beach. Every groove bar is one wave: the rider rises over the long
 * step into each downbeat and skims low across the quick steps between them, the same in every bar.
 * The dry drums at the start are slower stepping stones; the run-up stays low and fast, then hangs
 * high over the breath so the full band lands from above. The quick words run lower and quicker
 * with lighter fills; the broad bass answers lift into big, slower swells; the reprise returns to
 * the first wave, and the last vowel is one long high glide that slows to the end.
 * Differs from the approved reading mostly in height and in how each passage moves; strengths keep
 * their order, only the fills of the quick-words passage are lighter. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from './approved.ts';

export {overlayMeta} from './approved.ts';

const contacts = base.contacts.map(({t, impact = 0}) => {
  // Upper answers and quick words: the fills step back so the downbeats carry the passage.
  if (t > 21.8 && t < 31.5 && impact < 0.7) return {t, impact: +(impact * 0.85).toFixed(3)};
  // Bass answers: the weak tails sustain, a little softer.
  if (t > 32.2 && t < 41.8 && impact < 0.4) return {t, impact: +(impact * 0.85).toFixed(3)};
  return {t, impact};
});

const ends = contacts.map((c) => c.t);
/** A value per gap, chosen by the landing that ends it (and its length); `tail` after the last landing. */
const perGap = (f: (end: number, len: number) => number, tail: number) => (t: number) => {
  const i = ends.findIndex((e) => e >= t);
  if (i < 0) return tail;
  return f(ends[i], ends[i] - (i > 0 ? ends[i - 1] : 0));
};

/** How high the rider rises between landings. */
const amplitude = perGap((end, len) => {
  if (end <= 2.24) return len > 0.4 ? 0.14 : 0.05; // Upper pickup: gentle arcs.
  if (end < 9.56) return len > 0.5 ? 0.3 : len > 0.35 ? 0.14 : 0.04; // Stepping stones over the dry drums.
  if (end < 10.8) return 0.04; // Three drum strokes: low and flat.
  if (end < 11.6) return 0.5; // The breath: hang high...
  if (end < 12.0) return 0.3; // ...and the band lands from above.
  if (end < 21.76) return len > 0.5 ? 0.3 : 0.06; // First wave.
  if (end < 32.1) return len > 0.5 ? 0.14 : 0.03; // Quick words: lower, tighter.
  if (end < 41.9) return len > 0.5 ? 0.42 : 0.08; // Bass answers: big swells.
  if (end < 50.44) return len > 0.5 ? 0.3 : 0.06; // Reprise: the first wave again.
  return 0.1;
}, 0.55);

const spec: Spec = {...base, contacts,
  axes: {
    amplitude,
    air: perGapAir(),
    speed: curve([
      [0, .40], [2.231, .62], [4.675, .70], [8.646, .66], [9.557, .88], [10.468, 1], [11.0, .9], [11.995, .9],
      [21.2, .86], [21.759, .95], [31.0, .95], [32.127, .80], [41.4, .82], [41.891, .88], [50.43, .85], [51.045, .55], [52.351, .36],
    ]),
  }};
export default spec;

/** Air: floats over the long steps, rolling on the quick ones; the overall level is the passage's. */
function perGapAir() {
  const level = curve([
    [0, .55], [2.231, .62], [9.3, .62], [9.557, .40], [10.5, .40], [10.78, .86], [11.995, .78], [12.6, .58],
    [21.4, .58], [21.759, .46], [31.6, .46], [32.127, .74], [41.4, .74], [41.891, .58], [50.43, .58], [51.045, .74], [52.351, .74],
  ]);
  return (t: number) => {
    const l = level(t)!;
    const i = ends.findIndex((e) => e >= t);
    if (i <= 0 || ends[i] < 11.99 || ends[i] > 50.44) return l;
    const len = ends[i] - ends[i - 1];
    return len > 0.5 ? Math.min(0.9, l + 0.12) : Math.max(0.3, l - 0.06);
  };
}
