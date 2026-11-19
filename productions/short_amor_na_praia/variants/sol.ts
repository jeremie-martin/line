/** Carry the high pickup on a soft glide, with two little toe taps before the first dry drum.
 * The dry strokes gather speed, then the full band sends the rider skimming close to the line.
 * The sung replies gradually raise that quick glide. At the broad bass answer it opens into
 * longer, higher sweeps, with room around the low strokes, before the reprise brings it back down.
 * The closing words trail away in a single easy coast.
 */
import {curve} from '../../../scripts/v0/core/measured.ts';
import type {Spec} from '../../../scripts/v0/types.ts';
import base from './approved.ts';

export {overlayMeta} from './approved.ts';

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t,
    impact: t < 2.231 ? impact * .65
      : t < 11.995 ? impact
      : t < 32.127 ? impact ** 1.35
      : t < 41.885 ? impact ** 1.65
      : impact ** 1.3,
  })),
  axes: {
    air: curve([
      [0,.45],[1.186,.64],[1.981,.38],[2.231,.54],[4.675,.59],[7.978,.56],
      [8.646,.8],[9.557,.74],[10.468,.49],[11.502,.66],[11.995,.81],
      [13.214,.36],[19.321,.38],[21.759,.49],[26.635,.57],[30.908,.62],
      [32.127,.83],[38.814,.8],[41.275,.79],[42.5,.44],[48.578,.43],
      [50.43,.54],[51.045,.43],[52.351,.23],
    ]),
    speed: curve([
      [0,.37],[1.337,.49],[1.981,.71],[2.643,.83],[7.525,.8],[8.646,.52],
      [9.557,.78],[11.995,.94],[15.652,.99],[21.759,.91],[28.464,.86],
      [31.517,.8],[32.736,.69],[38.814,.79],[41.275,.84],[43.11,.94],
      [48.578,.96],[50.43,.86],[51.045,.54],[52.351,.35],
    ]),
    amplitude: curve([
      [0,.04],[.733,.1],[1.981,.02],[2.231,.07],[4.675,.09],[7.978,.06],
      [8.646,.14],[10.468,.07],[11.995,.17],[12.605,.04],[19.321,.04],
      [21.759,.08],[29.079,.11],[31.517,.18],[33.955,.21],[38.814,.23],
      [41.275,.2],[42.5,.05],[49.211,.04],[51.045,.1],[52.351,.09],
    ]),
  },
};

export default spec;
