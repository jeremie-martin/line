/**
 * The stomp has a heavy tread until the triplets slip out from under it in one low, quick run.
 * The rider pulls up on the last snare and crosses the silence in two great bounds on the bass.
 * After “Pain!” the quarter beats stride out at half that height. When the second drummer joins,
 * the rider digs in and gathers speed beneath the chant, rising again for the snare at 44.74.
 */
import base from './approved.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from './approved.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t >= 10.148 && t <= 12.986 ? .82 * impact ** 1.35 : impact ** 1.13,
  })),
  axes: {
    air: curve([[0,.46],[3.44,.41],[4.71,.62],[5.36,.43],[9.20,.46],[10.15,.31],
      [12.99,.32],[14,.45],[18.82,.44],[19.76,.62],[20.24,.90],[21.72,.91],
      [22.48,.70],[23.16,.69],[32.25,.68],[35.13,.74],[36.57,.42],[41.85,.37],
      [43.27,.48],[44.23,.78],[44.74,.78],[46.18,.42],[49.52,.39],[50.97,.58]]),
    speed: curve([[0,.56],[5.36,.67],[9.20,.73],[10.15,.92],[12.99,.93],[14,.59],
      [18.82,.66],[20.77,.83],[22.65,.91],[24.56,.69],[32.25,.68],[35.13,.86],
      [36.57,.74],[41.85,.92],[44.74,.98],[47.61,.85],[50.97,.75]]),
    amplitude: curve([[0,.07],[5.36,.10],[9.20,.07],[10.15,.02],[12.99,.02],[14,.09],
      [19.44,.08],[19.76,.24],[20.24,.72],[21.27,.86],[21.72,.78],[22.48,.33],
      [24.56,.25],[35.13,.29],[36.57,.07],[42.78,.05],[43.78,.18],[44.74,.32],
      [45.68,.08],[49.52,.07],[50.97,.17]]),
  },
};
