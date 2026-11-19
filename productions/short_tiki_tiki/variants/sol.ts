/**
 * The solo words skim in slowly, then four increasingly quick steps open the first drop.
 * In the hook, each long gap swings up on the voice before the rider slips back into low,
 * soft answers between the kicks. The reset at the boom stretches the step and slows it down.
 * The second drop sends the rider on a faster, flatter run, with shorter breaths at each return.
 * Once the kicks go, the solo voice gets a higher, almost weightless glide out.
 */
import type { Spec } from '../../../scripts/v0/types.ts';
import { curve } from '../../../scripts/v0/core/measured.ts';
import base from './approved.ts';
export { overlayMeta } from './approved.ts';

const contacts = base.contacts.map(({ t, impact = 0 }) => {
  if (t < 6.9 || t > 41.74 || impact === 1) return { t, impact };
  if (t < 10.43) return { t, impact: impact - 0.14 };
  if (t > 24.35 && t < 27.83) return { t, impact: impact - 0.16 };
  // Keep the order of the accents while letting the lighter answers recede.
  return { t, impact: 0.38 + (impact - 0.49) * 1.65 };
});

const spec: Spec = {
  ...base,
  contacts,
  axes: {
    air: curve([
      [0, 0.26], [3.55, 0.32], [6.16, 0.34], [7.83, 0.47], [10.05, 0.90],
      [10.43, 0.76], [12.18, 0.56], [13.91, 0.66], [14.38, 0.93], [15.66, 0.55],
      [17.39, 0.64], [17.84, 0.91], [19.13, 0.52], [20.87, 0.64], [21.30, 0.88],
      [22.61, 0.53], [23.48, 0.60], [24.35, 0.80], [25.80, 0.76],
      [26.95, 0.67], [27.45, 0.91], [28.7, 0.58], [30.44, 0.44],
      [31.75, 0.73], [33.05, 0.45], [35.24, 0.69], [36.53, 0.42],
      [38.69, 0.63], [39.54, 0.42], [40.87, 0.43], [41.74, 0.62],
      [43.57, 0.82], [45.31, 0.80], [47.05, 0.67], [48, 0.60],
    ]),
    speed: curve([
      [0, 0.27], [4.42, 0.25], [6.16, 0.29], [7.83, 0.44], [9.619, 0.71],
      [10.43, 0.83], [12.18, 0.69], [13.91, 0.64], [14.38, 0.55], [16.53, 0.72],
      [17.84, 0.56], [20.0, 0.73], [21.30, 0.55], [23.48, 0.68],
      [24.35, 0.52], [25.22, 0.37], [26.09, 0.40], [26.95, 0.66],
      [27.83, 0.91], [30.44, 0.82], [31.75, 0.74], [33.05, 0.87],
      [35.24, 0.77], [37.40, 0.92], [38.69, 0.82], [40.44, 0.91],
      [41.74, 0.74], [43.57, 0.46], [46.18, 0.37], [48, 0.29],
    ]),
    amplitude: curve([
      [0, 0.018], [6.16, 0.025], [7.83, 0.16], [9.619, 0.40], [10.05, 0.60],
      [10.43, 0.39], [11.75, 0.045], [13.91, 0.10], [14.38, 0.56],
      [15.23, 0.055], [17.39, 0.10], [17.84, 0.55], [18.7, 0.05],
      [20.87, 0.10], [21.30, 0.51], [22.19, 0.05], [23.48, 0.08],
      [24.02, 0.38], [24.79, 0.35], [25.80, 0.29], [26.95, 0.23],
      [27.43, 0.60], [28.30, 0.25], [29.14, 0.035], [31.31, 0.06],
      [31.75, 0.30], [32.62, 0.035], [34.78, 0.06], [35.24, 0.27],
      [36.10, 0.035], [38.26, 0.06], [38.69, 0.23], [39.54, 0.035],
      [40.87, 0.07], [41.74, 0.22], [43.57, 0.36], [45.31, 0.32],
      [47.05, 0.23], [48, 0.15],
    ]),
  },
};

export default spec;
