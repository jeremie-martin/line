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
import {clamp} from './math.js';

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

/** The ending and the opening are one gesture across the loop of a video: up from the ride to the whole course, over it, and
 * back down to the ride. Three plain curves of `g`, the seconds since the widest view, and nothing read from the ride:
 *
 *   zoom: an even pace up and down (the picture halves or doubles every `halve` seconds), rounded at the top over about
 *     `turn` seconds and where it leaves and lands on the rider over `leave` and `land` seconds. A larger course takes a
 *     little longer; nothing rushes in the middle.
 *   along the course: the camera swings `swing` design px toward the ride's end as it rises, sweeps back across the centred
 *     course at the widest view, turns around on the start's side and comes back. The zoom's one still moment is the
 *     sideways movement's fastest, and the sideways turn happens while the zoom is moving, so the picture never rests.
 *   across the course: `bow` design px to one side at the widest view, so the camera flies an oval instead of retracing a line.
 *
 * The widest view is where the video turns from its end to its start. Rising to it, the ink returns to pencil and the colours
 * go to the opening's (`unink`, `over`); past it the picture is the opening's in everything (picture.js draws the ride's first
 * moment), so the cut, `lead` seconds later, falls inside one movement: the last frame and the first are the same picture, a
 * little way down and already moving the way the rider will go (lead 0 with no swing: the whole course at rest). */
export const ENDS = {halve: 0.16, turn: 0.4, leave: 0.6, land: 0.5, lead: 0.8, swing: 340, bow: 0};
/** min(u, 1) with the corner rounded over u from 1 - k to 1 + k: it arrives at 1 exactly, with no jump in speed or in its change. */
const capped = (u, k) => {if (u <= 1 - k) return u; if (u >= 1 + k) return 1; const t = (u - 1 + k) / (2 * k); return 1 - k + 2 * k * (t - t ** 3 + t ** 4 / 2);};
const settling = (side, depth, ends) => Math.min(0.5, (side < 0 ? ends.leave : ends.land) * Math.LN2 / ends.halve / (2 * depth));
/** How far the camera is from the whole course (0) toward the ride (1), `g` seconds from the widest view, for a ride whose
 * view is e^depth times closer than the whole course. */
export function endsFollow(g, depth, ends = ENDS) {
  return capped(Math.LN2 / ends.halve * (Math.hypot(g, ends.turn) - ends.turn) / depth, settling(g, depth, ends));
}
/** Seconds from the widest view until the camera is on the ride, on the way up (-1) or down (1). */
export function endsReach(side, depth, ends = ENDS) {
  const run = (1 + settling(side, depth, ends)) * depth * ends.halve / Math.LN2;
  return Math.sqrt((run + ends.turn) ** 2 - ends.turn ** 2);
}
/** The camera's place over the course `g` seconds after the widest view, in design px: [toward the ride's start, to one side]. */
const over = (g, ends) => {const span = ends.lead / 1.6; if (!(span > 0.02)) return [0, ends.bow]; const x = g / span, d = 1 + x * x; return [2 * ends.swing * x / d, ends.bow / d];};

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
  // how much closer the ride's view is than the whole course, as an exponent, at each end of the ride
  const depths = [cam.at(-1).z, cam[0].z].map(z => Math.max(0.1, Math.log(z / overviewZoom)));
  /** Seconds the ending and the opening take on this ride. */
  frameAt.lengths = () => [endsReach(-1, depths[0], ends) + ends.lead, Math.max(0, endsReach(1, depths[1], ends) - ends.lead)];
  /** Whether the ending has passed its widest view at song time `time`: from there the picture is the opening's. */
  frameAt.turned = (time, look) => look.ends !== 'none' && time > songEnd / 2 && time - songEnd + ends.lead >= 0;
  return frameAt;
  function frameAt(time, at, look) {
    const i = clamp(Math.floor(at), 0, cam.length - 1), j = Math.min(i + 1, cam.length - 1), u = clamp(at - i, 0, 1), a = cam[i], b = cam[j];
    const lerp = (p, q) => p + (q - p) * u;
    const lower = +look.riderLower + (DISC_TOPS.has(look.top) ? +look.sunRider : 0);
    const c = {z: lerp(a.z, b.z), ax: lerp(a.ax, b.ax), ay: lerp(a.ay, b.ay) + lower,
      x: lerp(a.x, b.x), y: lerp(a.y, b.y), over: 0, unink: 0};
    if (look.ends === 'none') return c;
    // g: seconds since the widest view. In the video's last `lead` seconds `at` is the ride's first frame (frameAt.turned)
    const closing = time > songEnd / 2, g = (closing ? time - songEnd : time) + ends.lead, follow = endsFollow(g, depths[g < 0 ? 0 : 1], ends);
    if (follow >= 1) return c;
    // The zoom moves in ratio (follow of the way in its logarithm). The rider's place on screen follows the zoom itself: without
    // a swing every point of the course travels a straight line on screen, one zoom about one point.
    const z = Math.exp(Math.log(overviewZoom) + (Math.log(c.z) - Math.log(overviewZoom)) * follow), w = c.z !== overviewZoom ? (z - overviewZoom) / (c.z - overviewZoom) : follow;
    const [along, aside] = over(g, ends), dx = back.x * along - back.y * aside, dy = back.y * along + back.x * aside;
    const q = {x: W / 2 + (c.x - centre.x) * overviewZoom - dx, y: 0.4 * H + (c.y - centre.y) * overviewZoom - dy};
    return {...c, z, ax: q.x + (c.ax - q.x) * w, ay: q.y + (c.ay - q.y) * w, over: 1 - follow, unink: closing && g < 0 ? 1 - follow : 0};
  }
}
