/**
 * Start close to the ground and let the distant words gather pace up to the drum.
 * The bare voice stays soft. Its breath at eleven seconds gets a longer, slower arc.
 * When the full band arrives, the five-note figure rolls low and fast, then opens
 * into wider jumps as the low replies come back. Let the treble glide out as the bass falls away.
 */
import { curve } from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';

export { overlayMeta } from '../spec.ts';

export default {
  ...base,
  contacts: base.contacts.map(({ t, impact = 0 }) => ({
    t,
    impact: t < 6.713 ? impact * (0.64 + 0.29 * t / 6.713)
      : t < 15.444 ? impact
      : impact ** 1.22,
  })),
  axes: {
    air: curve([
      [0, .37], [4.3, .47], [6.4, .60], [7.25, .52], [9.8, .39],
      [10.65, .78], [11.05, .78], [11.55, .40], [14.65, .37], [15.38, .52],
      [17.7, .49], [22.4, .53], [23.3, .37], [25.3, .53], [29.5, .59],
      [32.4, .73], [39.5, .70], [43.5, .65], [46.5, .60], [48.2, .67], [50.291, .47],
    ]),
    speed: curve([
      [0, .49], [2.75, .55], [6.4, .81], [7.55, .61], [9.9, .57],
      [10.65, .44], [11.15, .47], [13.0, .57], [14.75, .65],
      [15.85, .92], [22.9, .91], [24.6, .82], [27.7, .89], [30.7, .83],
      [33.0, .73], [39.1, .77], [43.8, .82], [48.149, .70], [50.291, .56],
    ]),
    amplitude: curve([
      [0, .018], [4.3, .03], [6.4, .08], [7.85, .14], [9.2, .035],
      [10.45, .28], [10.95, .36], [11.45, .05], [14.7, .026], [15.44, .05],
      [22.4, .06], [23.35, .027], [26.35, .09], [29.89, .105],
      [32.89, .18], [35.07, .155], [39.43, .18], [43.79, .17],
      [46.37, .12], [48.15, .155], [49.4, .08], [50.291, .025],
    ]),
  },
};
