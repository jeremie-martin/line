// The hit movement under study: today's shake (a fast knock into the surface) and carry (a slower move out of it, back in
// about half a second). Both follow the measured strength of the hit; nothing reads the spec. Pure: no DOM.
import {hitEffectsAt} from '../../scripts/video/hits.js';
import {strength as energyOf} from '../../scripts/video/intensity.js';

/** start: strength under which carry is nothing; amount: px at strength 0.85 (1080-wide design pixels); out, back: seconds
 * to move out and to settle back; shake: multiple of today's shake. */
export const MOVE_DEFAULT = Object.freeze({start: 0.4, amount: 60, out: 0.07, back: 0.3, shake: 1});
const REF = 0.85, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
/** px: nothing up to `start`, an S-curve to `amount` at 0.85, then growing as the shake does (×1.43 per unit), at most 1.7 × amount. */
export function carryAmount(s, p = MOVE_DEFAULT) {
  if (s <= p.start) return 0;
  if (s <= REF) {const x = clamp((s - p.start) / Math.max(1e-6, REF - p.start), 0, 1); return p.amount * x * x * (3 - 2 * x);}
  return Math.min(1.7 * p.amount, p.amount * (1 + 40 / 28 * (s - REF)));
}
/** 0 at the hit, 1 at its peak (soon after `out`), back toward 0 over a few `back`. */
export function carryShape(age, p = MOVE_DEFAULT) {
  if (age <= 0 || age > 6 * p.back + 1) return 0;
  const out = Math.min(p.out, p.back * 0.9), f = t => Math.exp(-t / p.back) - Math.exp(-t / out);
  return f(age) / f(Math.log(p.back / out) * p.back * out / (p.back - out));
}
/** The picture's displacement (px, screen axes) at ride time `time`: today's shake × p.shake, plus every recent hit's carry
 * along its surface normal (toward the rider), together at most 1.7 × amount. */
export function movementAt(hits, time, p = MOVE_DEFAULT) {
  const s = hitEffectsAt(hits, time);
  let x = 0, y = 0;
  for (const h of hits) {
    if (h.time > time) break;
    const a = carryAmount(h.strength, p) * carryShape(time - h.time, p);
    if (a) {x += a * h.normal.x; y += a * h.normal.y;}
  }
  const d = Math.hypot(x, y), cap = 1.7 * p.amount, k = d > cap ? cap / d : 1;
  return {dx: s.dx * p.shake + x * k, dy: s.dy * p.shake + y * k};
}
/** One hit of strength `s` on level ground: px out of the surface (negative: into it) at `age` seconds. For the charts. */
export function singleHit(s, age, p = MOVE_DEFAULT) {
  return -movementAt([{time: 0, strength: s, energy: energyOf(s), normal: {x: 0, y: -1}}], age, p).dy;
}
