// The camera follows the rider's direction, computed offline for the whole ride, which is known in advance.
//
// The camera is the rider's SCREEN POSITION p(t) and the zoom z(t), pivoting on the rider:
//   screen(P) = p + z·(P − R),   R = the rider's raw body centre (never smoothed: smoothing leaks fake motion).
// The rider's resting point follows the DIRECTION of travel (the unit velocity, faded in below 150 u/s so a slow rider rests),
// the vertical offset growing as the slope's sine squared, so a 60° ride sits lower than a 35° one at any speed. Moving WITH the
// rider's real motion is quick; moving AGAINST it is limited, so the camera may lag or stop but never seems to move the rider
// against its motion, and while the rider descends it rises on screen at most 45 px/s (it never seems to climb).
// Pure: no DOM. Frames are 1080 × 1920 design pixels; the picture scales them to the canvas.

import {FPS} from './timing.js';
import {clamp, smoothstep} from './math.js';

export const W = 1080, H = 1920;
/** The base zoom: design pixels per world unit. Lanes are multiples of it (zoom.js), and the hit movement was set at it
 * (picture.js scales it with the frame's). */
export const BASE = 6.2;
const DT = 1 / FPS;
/** Tops that put a disc where the sun is (sky.js): the rider sits lower under them, as under the sun. */
export const DISC_TOPS = new Set(['sun', 'crescent', 'stars', 'crescentStars']);

function smoothSamples(arr, sig) {
  const R = Math.ceil(2.5 * sig), ker = []; for (let k = -R; k <= R; k++) ker.push(Math.exp(-k * k / (2 * sig * sig)));
  const n = arr.length, out = new Float64Array(n);
  for (let f = 0; f < n; f++) {let s = 0, w = 0; for (let i = 0; i < ker.length; i++) {s += arr[clamp(f + i - R, 0, n - 1)] * ker[i]; w += ker[i];} out[f] = s / w;}
  return out;
}
/** Shared finite differences for camera direction and intensity speed, in world units per second.
 * Speed keeps its own arithmetic order (hypot before scaling), so the calibrated intensity is unchanged. */
export function rideSignals(centres) {
  const velocity = centres.map((_, f) => {
    const a = centres[Math.max(0, f - 1)], b = centres[Math.min(centres.length - 1, f + 1)];
    const steps = Math.min(centres.length - 1, f + 1) - Math.max(0, f - 1) || 1;
    const dx = b.x - a.x, dy = b.y - a.y;
    return {x: dx / steps * FPS, y: dy / steps * FPS, speed: Math.hypot(dx, dy) / steps * FPS};
  });
  return {centres, velocity};
}

// rest: resting point (fractions of W, H); rx, ry: reach of the offset; dir: speed (u/s) under which the offset fades;
// back: px/s against the motion; settle: return rate; backDown: px/s the rider may rise on screen while descending;
// sm: smoothing of the velocity the target reads (s), so a direction flip does not swing the target.
const FOLLOW = {rest: [0.5, 0.34], rx: 0.15, ry: 0.17, dir: 150, back: 110, settle: 1.6, backDown: 45, sm: 0.25};
function placed(motion, zs) {
  const P = FOLLOW;
  const n = motion.centres.length, sm = a => smoothSamples(motion.centres.map((_, f) => motion.velocity[f][a]), P.sm * FPS), vx = sm('x'), vy = sm('y'), out = new Array(n);
  const unit = (f, a) => {const v = Math.hypot(vx[f], vy[f]); return (a === 'x' ? vx[f] : vy[f]) / Math.sqrt(v * v + P.dir * P.dir);};
  const shaped = u => u * Math.abs(u);
  const ty = f => P.rest[1] + P.ry * shaped(unit(f, 'y'));
  const tx = f => P.rest[0] + P.rx * unit(f, 'x');
  const p = {x: tx(0) * W, y: ty(0) * H};
  for (let f = 0; f < n; f++) {
    const z = zs[f], T = {x: tx(f) * W, y: ty(f) * H};
    for (const a of ['x', 'y']) {
      // with the motion: quick. Against it: proportional to the distance left, so the return curves and settles;
      // a fixed-rate return is a straight ramp, which reads as the rider climbing.
      const u = z * motion.velocity[f][a], gap = T[a] - p[a], withMotion = u * gap > 0 && Math.abs(u) > 150;
      const want = withMotion ? gap / DT * 0.22 : gap * P.settle;
      const up = a === 'y' && u > 150 ? P.backDown : P.back;
      const [lo, hi] = u > 150 ? [-up, u] : u < -150 ? [u, P.back] : [-P.back, P.back];
      p[a] += clamp(want, lo, hi) * DT;
    }
    out[f] = {z, ax: p.x, ay: p.y, x: motion.centres[f].x, y: motion.centres[f].y};
  }
  return out;
}

/** The ending and the opening are one gesture across the loop of a video: out from the ride to the whole course, a turn, and
 * back in to the ride. The last frame and the first show the same whole course.
 *   close: `length` seconds out; `drag`: how long it stays with the rider before leaving (1 leaves at once, 4 late).
 *   open: `length` seconds in; `land`: how softly it arrives on the rider.
 *   turn: the turnaround, shared by both sides so they meet with the same speed and the same curvature: 1.5 a quick bounce
 *     off the whole course, 2 a thrown ball, more lingers there.
 *   pause: seconds the whole course is held, half before the last frame and half after the first.
 *   float: design px the picture drifts across the course through the turn, from where the ride ends toward where it starts,
 *     so the turn is never a standstill. pencil: the ink returns to pencil over the last 0.7 s, and the loop has no seam. */
export const ENDS = {close: {length: 2, drag: 3}, open: {length: 1.5, land: 2}, turn: 2.4, pause: 0, float: 0, pencil: false};
/** From 0 to 1 over u from 0 to 1, leaving and landing as softly as asked; `weight` favours the landing side. */
const ease = (u, leave, land, weight = 1) => {u = clamp(u, 0, 1); const a = Math.pow(u, leave); return a / (a + weight * Math.pow(1 - u, land));};
/** How much of the way from the whole course (0) to the ride (1) at `tau` seconds from the loop's seam: negative before the
 * last frame, positive after the first. */
export function endsFollow(tau, ends = ENDS) {
  const {close, open, turn} = ends, away = Math.abs(tau) - ends.pause / 2, weight = Math.pow(close.length / open.length, turn / 2);
  if (away <= 0) return 0;
  return tau < 0 ? 1 - ease(1 - away / close.length, close.drag, turn, weight) : ease(away / open.length, turn, open.land, weight);
}

/** A frame has one camera representation: rider world position x/y, rider screen position ax/ay, and zoom z.
 * Opening/ending interpolate that same representation, not a second camera or rider transform.
 * Song time controls bookends; fractional physics frame controls the ride. No canvas or mutable playback state.
 * `lane` is the zoom per physics frame as a multiple of BASE (zoom.js laneScale); without one the zoom is BASE throughout.
 * `ends` is read at every frame (a tuning page moves it). */
export function createFraming(motion, songEnd, lane = null, ends = ENDS) {
  const centres = motion.centres, cam = placed(motion, Float64Array.from(centres, (_, f) => BASE * (lane ? lane[Math.min(f, lane.length - 1)] : 1)));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of centres) {x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);}
  // Frame the ride, with an 80-unit margin; rails extending past it can crop.
  x0 -= 80; y0 -= 80; x1 += 80; y1 += 80;
  const overviewZoom = Math.min(0.78 * W / (x1 - x0), 0.5 * H / (y1 - y0));
  const centre = {x: (x0 + x1) / 2, y: (y0 + y1) / 2};
  // the direction from where the ride ends to where it starts, on screen
  const first = centres[0], last = centres.at(-1), span = Math.hypot(first.x - last.x, first.y - last.y) || 1, back = {x: (first.x - last.x) / span, y: (first.y - last.y) / span};
  return function frameAt(time, at, look) {
    const i = clamp(Math.floor(at), 0, cam.length - 1), j = Math.min(i + 1, cam.length - 1), u = clamp(at - i, 0, 1), a = cam[i], b = cam[j];
    const lerp = (p, q) => p + (q - p) * u;
    const lower = +look.riderLower + (DISC_TOPS.has(look.top) ? +look.sunRider : 0);
    const c = {z: lerp(a.z, b.z), ax: lerp(a.ax, b.ax), ay: lerp(a.ay, b.ay) + lower,
      x: lerp(a.x, b.x), y: lerp(a.y, b.y), over: 0, unink: 0};
    if (look.ends === 'none') return c;
    const closing = time > songEnd / 2, tau = closing ? time - songEnd : time, follow = endsFollow(tau, ends);
    if (follow >= 1) return c;
    // The zoom moves evenly in ratio (follow of the way in its logarithm). The rider's place on screen follows the zoom itself, so
    // every point of the course travels a straight line on screen: one zoom about one point, with no drift across it.
    const z = Math.exp(Math.log(overviewZoom) + (Math.log(c.z) - Math.log(overviewZoom)) * follow), w = c.z !== overviewZoom ? (z - overviewZoom) / (c.z - overviewZoom) : follow;
    const drift = ends.float * tau / Math.hypot(1, tau); // px along `back`, passing zero at the seam at `float` px/s
    const q = {x: W / 2 + (c.x - centre.x) * overviewZoom - back.x * drift, y: 0.4 * H + (c.y - centre.y) * overviewZoom - back.y * drift};
    return {...c, z, ax: q.x + (c.ax - q.x) * w, ay: q.y + (c.ay - q.y) * w, over: 1 - follow, unink: ends.pencil && closing ? smoothstep((tau + 0.7) / 0.6) : 0};
  };
}
