/**
 * The little ticks start close to the ground. Each has more spring until the
 * doubles draw the rider down into the roll. The held note gets the tallest arc.
 * After the return the rider swings up from each last drum into the soft bar
 * opener, then rushes through its answers. The last swing dies out in five steps.
 */
import base from './approved.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from './approved.ts';

const air = curve([[0,.36],[3.31,.33],[11.48,.71],[15.57,.80],[17.28,.43],
  [19.67,.25],[20.875,.25],[21.05,.95],[22.396,.95]]);
const height = curve([[0,.11],[3.31,.06],[11.48,.31],[15.57,.48],[16.94,.33],
  [17.61,.09],[20.875,.03],[21.05,.94],[22.396,.94]]);
const speed = curve([[0,.55],[1.27,.27],[8.78,.35],[15.57,.52],[19.67,.92],
  [20.875,.92],[21.45,.46],[22.396,.64]]);

// Each 2.73-second reply starts with the long flight to the light opener.
const replyAir = curve([[0,.62],[.28,.85],[1.22,.85],[1.70,.48],[2.45,.39],[2.73,.62]]);
const replyHeight = curve([[0,.18],[.28,.57],[1.22,.57],[1.70,.15],[2.45,.06],[2.73,.18]]);
const replySpeed = curve([[0,.76],[.28,.54],[1.22,.54],[1.70,.84],[2.45,.91],[2.73,.76]]);
const replyTime = (t: number) => (t - 22.396) % (60 / 88 * 4);
const fadeAir = curve([[55.124,.62],[56.48,.65],[57.85,.40],[59.56,.25]]);
const fadeHeight = curve([[55.124,.18],[55.7,.38],[57.50,.19],[59.56,.04]]);
const fadeSpeed = curve([[55.124,.76],[56.48,.54],[59.56,.24]]);

export default {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({
    t, impact: t > 22.396 && t < 56 ? (impact === .4 ? .30 : .79) : impact ** 1.22,
  })),
  axes: {
    air: (t: number) => t < 22.396 ? air(t) : t < 55.124 ? replyAir(replyTime(t)) : fadeAir(t),
    amplitude: (t: number) => t < 22.396 ? height(t) : t < 55.124 ? replyHeight(replyTime(t)) : fadeHeight(t),
    speed: (t: number) => t < 22.396 ? speed(t) : t < 55.124 ? replySpeed(replyTime(t)) : fadeSpeed(t),
  },
};
