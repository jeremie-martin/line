/** The chops after the opening boom nearly whisper, in one low, even glide.
 * The eight dry drums push the rider forward, then a single long flight gathers up the voice.
 * The first kick groove rises and eases across whole phrases. When the kick comes back,
 * the rider gets low and runs, leaving just a flick for the word before the last pair.
 * The last low hit sends the two echoes drifting farther apart, and the pace falls away.
 */
import {curve} from '../../../scripts/v0/core/measured.ts';
import type {Spec} from '../../../scripts/v0/types.ts';
import base from './approved.ts';

export {overlayMeta} from './approved.ts';

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t,
    impact: t === .337 ? impact
      : t < 4.458 ? impact * .64
      : t < 9.131 ? impact
      : t < 43.659 ? impact ** 1.6
      : impact * .8,
  })),
  axes: {
    air: curve([
      [0,.55],[.614,.32],[3.611,.28],[4.458,.5],[5.277,.55],[7.343,.46],
      [8.45,.86],[9.131,.83],[11.331,.5],[13.531,.56],[17.932,.71],
      [20.132,.61],[24.532,.7],[26.732,.61],[28.932,.39],[35.532,.4],
      [39.933,.47],[42.394,.43],[44.339,.57],[45.72,.75],[46,.56],
    ]),
    speed: curve([
      [0,.45],[.865,.34],[3.355,.38],[4.174,.61],[5.277,.82],[7.755,.93],
      [9.131,.94],[11.331,.83],[15.732,.73],[20.132,.69],[24.532,.74],
      [26.732,.94],[29.484,.99],[37.732,.95],[42.121,.84],
      [43.241,.67],[44.339,.51],[45.72,.26],[46,.22],
    ]),
    amplitude: curve([
      [0,.04],[.865,.016],[3.611,.016],[4.458,.06],[7.343,.045],
      [8.38,.31],[9.131,.18],[11.331,.07],[15.732,.12],[17.932,.14],
      [20.132,.08],[24.532,.13],[26.732,.09],[28.932,.035],[40.484,.035],
      [42.394,.025],[44.339,.075],[45.72,.15],[46,.1],
    ]),
  },
};

export default spec;
