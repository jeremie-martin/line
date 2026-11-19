/**
 * The upper figure starts as a string of light, unhurried hops and gathers into a low, quick roll.
 * Its held high note gets the widest flight, with the weight saved for the drum on the far side.
 * The replies now breathe in groups of four bars. Each soft opener comes out of a bound,
 * and the stronger answering drums carry the rider forward close to the line.
 * The last five strokes spend that momentum, with one soft rise before the closing touch.
 */
import type { Spec } from '../../../scripts/v0/types.ts';
import { curve } from '../../../scripts/v0/core/measured.ts';
import base from './approved.ts';
export { overlayMeta } from './approved.ts';

const contacts = base.contacts.map(({ t, impact = 0 }) => {
  if (t < 1) return { t, impact: 0.46 };
  if (t < 11.48) return { t, impact: impact * 0.70 };
  if (t < 19.78) return { t, impact: (impact - 0.40) * 1.10 + 0.28 };
  if (t < 21) return { t, impact: (impact - 0.74) * 0.61 + 0.61 };
  if (t < 23) return { t, impact };
  if (t < 56) {
    const wave = t < 33.4 ? 0 : t < 44.3 ? 0.05 : 0.10;
    return { t, impact: impact === 0.4 ? 0.23 + wave : 0.70 + wave };
  }
  return { t, impact: impact * 0.74 };
});

const spec: Spec = {
  ...base,
  contacts,
  axes: {
    air: curve([
      [0, 0.40], [1.3, 0.67], [3, 0.79], [8.8, 0.72], [11.48, 0.64],
      [15.57, 0.54], [17.61, 0.37], [19.67, 0.28], [20.875, 0.25],
      [21.15, 0.91], [22.10, 0.91], [22.396, 0.73],
      [24.78, 0.51], [28.5, 0.72], [32.5, 0.49], [34.2, 0.77],
      [36.7, 0.64], [38.4, 0.49], [42.3, 0.79], [44.2, 0.47],
      [45.25, 0.78], [47.2, 0.50], [50.5, 0.74], [54.5, 0.46],
      [56.45, 0.65], [57.85, 0.38], [58.6, 0.61], [60, 0.24],
    ]),
    speed: curve([
      [0, 0.41], [2, 0.23], [7.4, 0.29], [11.48, 0.41], [15.57, 0.63],
      [17.61, 0.80], [20.875, 0.94], [21.55, 0.45], [22.1, 0.60],
      [22.4, 0.81], [24.2, 0.68], [28.5, 0.65], [32.96, 0.87],
      [34.1, 0.63], [38.42, 0.85], [42.3, 0.67], [43.9, 0.87],
      [45, 0.70], [46.8, 0.89], [50.5, 0.72], [54.8, 0.92],
      [56.48, 0.52], [57.85, 0.34], [60, 0.18],
    ]),
    amplitude: curve([
      [0, 0.10], [1.96, 0.24], [7.4, 0.23], [11.48, 0.19],
      [16.94, 0.11], [19.67, 0.025], [20.875, 0.015],
      [21.12, 0.84], [22.15, 0.84], [22.396, 0.38],
      [23.2, 0.55], [24.9, 0.08], [25.7, 0.37], [27.5, 0.09],
      [28.5, 0.46], [30.57, 0.14], [31.3, 0.45], [32.9, 0.07],
      [34, 0.59], [35.69, 0.15], [36.7, 0.40], [38.42, 0.08],
      [39.4, 0.43], [41.48, 0.13], [42.2, 0.57], [43.9, 0.07],
      [44.95, 0.62], [46.6, 0.14], [47.55, 0.47], [49.33, 0.07],
      [50.3, 0.56], [52.4, 0.14], [53.15, 0.50], [54.78, 0.07],
      [55.8, 0.44], [57.85, 0.05], [58.55, 0.35], [60, 0.04],
    ]),
  },
};

export default spec;
