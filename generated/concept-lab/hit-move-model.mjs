// The hit movement under study: today's shake (a fast knock into the surface) and carry (a slower move out of it, back in
// about half a second). Both follow the measured strength of the hit; nothing reads the spec. Pure: no DOM.
import {hitEffectsAt, TUNES, carryAmount as amountOf, carryShape as shapeOf, carryAt} from '../../scripts/video/hits.js';
import {strength as energyOf} from '../../scripts/video/intensity.js';

/** start: strength under which carry is nothing; amount: px at strength 0.85 (1080-wide design pixels); out, back: seconds
 * to move out and to settle back; shake: multiple of the full shake (hits.js `shake`; production uses half). */
export const MOVE_DEFAULT = Object.freeze({start: 0.5, amount: 100, out: 0.07, back: 0.3, shake: 0.5}); // the owner's settings, 2026-11-15
export const carryAmount = (s, p = MOVE_DEFAULT) => amountOf(s, p), carryShape = (age, p = MOVE_DEFAULT) => shapeOf(age, p);
/** The picture's displacement (px, screen axes) at ride time `time`: the full shake × p.shake, plus carry (hits.js). */
export function movementAt(hits, time, p = MOVE_DEFAULT) {
  const s = hitEffectsAt(hits, time, 1, TUNES.shakeOnly), c = carryAt(hits, time, p);
  return {dx: s.dx * p.shake + c.x, dy: s.dy * p.shake + c.y};
}
/** One hit of strength `s` on level ground: px out of the surface (negative: into it) at `age` seconds. For the charts. */
export function singleHit(s, age, p = MOVE_DEFAULT) {
  return -movementAt([{time: 0, strength: s, energy: energyOf(s), normal: {x: 0, y: -1}}], age, p).dy;
}
