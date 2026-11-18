/** Run low under the bass, lift on the seven notes, float through the quiet. Wherever the bass pumps, the rider runs
 * fast and close to the line in quick flat skips; on each seven-note contour it lifts into taller hops, as if the
 * melody pulled it up; and when the band drops out it takes one long leap into a high, slower float, every touch nearly
 * weightless, until the drums come back. The drums alone are lighter than before and grow stroke by stroke, so the
 * return of the bass at 34.6 is the clear peak of the song; from there the run is low and fast again to the last
 * answer, which lifts once more as the music lets go.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from '../spec.ts';
import {bareOpening, firstBody, secondBody, returningDrums, bassReturn, lastBars, type Strike} from '../music.ts';

export {overlayMeta} from '../spec.ts';

/** The drums alone, quieter than the bass bodies around them, gathering toward the bass return. */
const drumsAlone: Strike[] = returningDrums.map(([t, impact], i): Strike => {
  if (i === 0) return [t, .70];
  const grow = .74 + .26 * (i / (returningDrums.length - 1));
  return [t, Number((impact * grow).toFixed(3))];
});

const strikes: Strike[] = [
  ...bareOpening,
  [3.391,.299], [4.047,.328], [4.628,.406], [4.854,.312], [4.965,.39], [5.081,.25], [5.191,.49], [5.307,.27], [5.406,.20],
  [5.522,.85], ...firstBody.slice(1),
  [10.979,.624], [11.205,.418], [11.321,.369], [11.658,.648], [12.111,.811], [12.343,.374], [12.569,.309],
  ...secondBody,
  [18.246,.511], [18.479,.401], [18.589,.343], [18.931,.658], [19.384,.762], [19.611,.306], [19.843,.323],
  // The float: lighter still, and the last three rises still gather.
  [21.213,.035], [21.439,.022], [21.892,.04], [22.234,.034], [22.577,.04], [23.03,.05], [23.256,.037],
  [23.709,.064], [24.388,.053], [24.847,.047], [25.073,.068], [25.526,.08], [25.868,.092], [26.205,.11],
  ...drumsAlone,
  [33.81,.40], [34.164,.33], [34.384,.18],
  ...bassReturn,
  [40.979,.383], [41.095,.31], [41.432,.394], [41.664,.428],
  ...lastBars,
  [47.567,.28], [47.684,.306], [48.026,.412], [48.479,.476], [48.705,.384], [48.932,.259], [49.506,.184],
];

const times = strikes.map(([t]) => t);
/** The tallest arc a span of `dt` seconds allows (a free flight from landing to landing), on the 60 px scale. */
const fullArc = (dt: number): number => Math.min(1, .175 * (dt * 40) ** 2 / 8 / 60);
/** How much of that each passage uses: run (bass) flat, lift (seven notes) and float (quiet) tall. */
const share = (t: number): number =>
  t < 3.25 ? .4 :
  t < 5.52 ? .8 :
  t < 10.98 ? .2 :
  t < 12.79 ? .8 :
  t < 18.25 ? .2 :
  t < 19.86 ? .8 :
  t < 27.34 ? .6 :
  t < 34.61 ? .3 :
  t < 47.57 ? .2 : .8;
const amplitude = (t: number): number => {
  const i = times.findIndex((ct) => ct >= t);
  const k = i < 0 ? times.length - 1 : i;
  const dt = times[k] - (k > 0 ? times[k - 1] : 0);
  return share(times[k]) * fullArc(dt);
};

const spec: Spec = {
  ...base,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([
      [0,.50],[3.25,.52],[3.6,.66],[5.30,.66],[5.52,.46],[10.70,.46],[10.98,.70],[12.57,.70],[12.79,.46],
      [17.9,.46],[18.25,.70],[19.85,.74],[21.2,.76],[26.2,.64],[27.34,.56],[33.5,.56],[34.384,.48],[34.61,.44],
      [47.3,.44],[47.57,.70],[49.691,.74],
    ]),
    speed: curve([
      [0,.96],[3.25,.90],[5.30,.94],[5.52,1],[10.70,1],[10.98,.93],[12.57,.93],[12.79,1],[17.9,1],[18.25,.93],
      [19.85,.86],[21.2,.82],[26.2,.84],[27.34,.96],[33.81,.97],[34.61,1],[47.3,1],[47.57,.90],[49.691,.84],
    ]),
    amplitude,
  },
};
export default spec;
