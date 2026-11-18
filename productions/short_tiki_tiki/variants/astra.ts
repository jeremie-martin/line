/**
 * Let the solo words rock gently over the seven brushes. The four beats pull
 * the rider down and send it racing close to the ground through the first hook.
 * At the boom the stride opens. The second hook takes its time in the air,
 * swinging highest on the long beats between lines. The voice carries that
 * swing on after the kick has gone, a little less each time.
 */
import base from '../spec.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from '../spec.ts';

const secondHookHeight = curve([[27.83,.43],[28.70,.55],[29.14,.12],[31.31,.12],
  [31.62,.62],[32.18,.62],[32.62,.13],[34.78,.13],[35.08,.64],[35.66,.64],
  [36.10,.14],[38.26,.14],[38.55,.54],[39.13,.54],[39.54,.12],[40.87,.12],
  [41.74,.39],[43.57,.37],[45.31,.22],[47.92,.09]]);
const firstHookHeight = curve([[0,.25],[2.68,.34],[6.16,.18],[8.7,.09],[9.619,.08],
  [9.96,.40],[10.43,.40],[11.31,.15],[13.91,.07],[20.87,.09],[23.48,.12],
  [24.35,.32],[25.22,.16],[26.09,.22],[26.95,.38],[27.83,.72]]);

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t < 6.9 || t > 41.74 ? impact : impact ** 1.36,
  })),
  axes: {
    air: curve([[0,.62],[2.68,.70],[6.16,.55],[9.619,.33],[10.43,.69],[11.31,.48],
      [17.39,.38],[23.48,.42],[24.35,.72],[25.22,.53],[27.83,.90],[31.31,.76],
      [38.26,.82],[41.74,.73],[44.44,.68],[48,.48]]),
    speed: curve([[0,.33],[5.29,.30],[6.97,.44],[10.43,.86],[13.91,.91],[20.87,.86],
      [23.48,.80],[24.35,.54],[25.22,.31],[26.95,.40],[27.83,.77],[29.57,.64],
      [34.78,.68],[38.26,.73],[41.74,.59],[44.44,.41],[48,.28]]),
    amplitude: (t: number) => t <= 27.83 ? firstHookHeight(t) : secondHookHeight(t),
  },
};
