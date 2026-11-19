/** The opening roll runs the rider out close to the ground. The bass catches
 * that speed and spends it on successively longer bounces. The lone drummer
 * takes big, unhurried steps. When a little high note answers each footfall,
 * the step folds in two and hurries along. The upper tune gradually gets all
 * that room to itself, right up to the last small ticking notes. */
import base from './approved.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from './approved.ts';

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => {
    // Separate the answering tick from the drum that sets it off.
    if (t >= 22.006 && t <= 32.56) return {t, impact: impact ** 1.45};
    return {t, impact: t < 3.721 ? impact * .78 : impact};
  }),
  axes: {
    air: curve([[0,.71],[.957,.59],[1.445,.31],[3.419,.29],[4.348,.45],[8.608,.79],
      [11.662,.53],[12.567,.72],[13.171,.82],[14.692,.84],[21.403,.83],
      [22.192,.44],[29.321,.46],[32.56,.43],[33.907,.58],[36.658,.67],
      [37.564,.46],[39.607,.69],[42.068,.87],[43.078,.88],[43.694,.55],[45.679,.49]]),
    speed: curve([[0,.41],[.957,.47],[1.898,.74],[3.419,.94],[4.348,.78],[8.608,.56],
      [11.662,.52],[12.567,.35],[13.473,.70],[16.526,.60],[21.403,.63],
      [23.225,.80],[30.54,.91],[32.56,.87],[35.427,.67],[37.262,.74],
      [40.304,.59],[43.078,.42],[45.679,.69]]),
    amplitude: curve([[0,.19],[1.283,.04],[3.419,.02],[4.348,.13],[8.608,.36],
      [11.662,.15],[13.171,.23],[14.692,.34],[21.403,.34],[22.192,.07],
      [32.56,.06],[35.427,.20],[37.436,.10],[39.607,.25],[42.068,.47],
      [43.078,.56],[43.694,.09],[45.679,.07]]),
  },
};
