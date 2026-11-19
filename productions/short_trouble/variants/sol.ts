/**
 * The opening crash lets go into long, unhurried bows under the words. The quiet catches barely interrupt them.
 * The three uneven kicks feel like a push, a softer step and a second push. Once the little drum answers arrive,
 * the rider stays low and carries pace through the whole figure. The exposed G briefly lifts that motion.
 * After the drop the bass pickups hug the line and the longer gaps open into fast, broad flights.
 * The two rising triples pull those flights back down into the drums. The last two words drift out lightly.
 */
import type { Spec } from '../../../scripts/v0/types.ts';
import { curve } from '../../../scripts/v0/core/measured.ts';
import base from './approved.ts';
export { overlayMeta } from './approved.ts';

const contacts = base.contacts.map(({ t, impact = 0 }) => {
  if (t < 0.5) return { t, impact: 0.65 };
  if (t < 12.53) return { t, impact: impact * 0.58 };
  if (t < 14.7) return { t, impact: (impact - 0.12) * 1.22 + 0.07 };
  if (t < 27.725) {
    if (impact === 0.78) return { t, impact: 0.83 };
    if (impact === 0.69) return { t, impact: 0.65 };
    if (impact === 0.51) return { t, impact: 0.39 };
    return { t, impact: impact * 0.60 };
  }
  if (t < 29.03) return { t, impact: impact === 0.34 ? 0.31 : impact * 0.60 };
  if (t < 43.78) {
    if (impact >= 0.78) return { t, impact: 0.76 + (impact - 0.78) * 1.20 };
    return { t, impact: impact * 0.72 };
  }
  return { t, impact: impact * 0.52 };
});

const spec: Spec = {
  ...base,
  contacts,
  axes: {
    air: curve([
      [0, 0.46], [2.18, 0.53], [3.0, 0.78], [4.75, 0.78], [5.79, 0.66],
      [7.56, 0.51], [9.83, 0.61], [11.12, 0.63], [12, 0.84], [12.54, 0.72],
      [13.85, 0.45], [14.7, 0.40], [16.04, 0.57], [18.29, 0.39],
      [21.87, 0.35], [25.45, 0.38], [27.24, 0.47], [28.34, 0.82], [29.03, 0.55],
      [29.52, 0.88], [30.60, 0.68], [31.72, 0.66], [33.11, 0.89],
      [34.41, 0.52], [35.08, 0.42], [35.85, 0.87], [37.09, 0.88],
      [37.99, 0.66], [38.88, 0.62], [40.25, 0.86], [41.57, 0.50],
      [42.24, 0.40], [42.47, 0.49], [43.18, 0.85], [44.65, 0.57],
    ]),
    speed: curve([
      [0, 0.46], [1.74, 0.32], [4.75, 0.20], [5.79, 0.31], [8.02, 0.42],
      [9.83, 0.33], [11.65, 0.24], [12.54, 0.36], [14.70, 0.73],
      [15.65, 0.63], [16.49, 0.76], [17.37, 0.66], [18.29, 0.78],
      [21.87, 0.80], [25.45, 0.84], [27.24, 0.75], [28.29, 0.49],
      [28.75, 0.68], [29.03, 0.92], [31.49, 0.87], [32.61, 0.93],
      [34.18, 0.79], [35.08, 0.98], [37.09, 0.84], [38.88, 0.90],
      [41.34, 0.85], [42.24, 0.98], [42.47, 0.92], [43.78, 0.39], [44.65, 0.26],
    ]),
    amplitude: curve([
      [0, 0.08], [2.18, 0.08], [2.8, 0.49], [3.52, 0.59], [4.7, 0.73],
      [5.79, 0.16], [7.56, 0.045], [9.83, 0.08], [10.45, 0.19], [11.12, 0.16],
      [11.85, 0.52], [12.54, 0.20], [13.43, 0.11], [14.7, 0.035],
      [15.38, 0.12], [16.05, 0.15], [16.49, 0.055], [17.17, 0.13],
      [17.84, 0.17], [18.29, 0.035], [22.32, 0.015], [27.24, 0.024],
      [27.94, 0.045], [28.34, 0.13], [29.03, 0.09], [29.45, 0.54],
      [30.23, 0.34], [30.824, 0.045], [31.16, 0.30], [31.718, 0.05],
      [32.09, 0.27], [32.612, 0.045], [33.06, 0.52], [33.82, 0.32],
      [34.412, 0.025], [35.3, 0.02], [35.77, 0.51], [36.6, 0.56],
      [37.43, 0.31], [37.988, 0.045], [38.32, 0.30], [38.882, 0.05],
      [39.22, 0.28], [39.782, 0.045], [40.22, 0.52], [41.0, 0.33],
      [41.57, 0.025], [42.469, 0.02], [43.12, 0.48], [43.781, 0.15],
      [44.646, 0.035],
    ]),
  },
};

export default spec;
