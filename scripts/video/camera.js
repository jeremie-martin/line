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

/** The ending and the opening are one gesture across the loop of a video: up from the ride to the whole course, over it, and
 * back down to the ride. The camera's state is continuous from the last frame to the first.
 *
 * What is set is how fast the picture moves on screen (its flow), not a zoom curve; the zoom follows from it. During a ride
 * the course scrolls past at the ride's own flow. As the camera rises that scrolling fades (it shrinks with the zoom), so the
 * zoom is given exactly the pace that keeps the total flow on a smooth valley. Nothing rushes in the middle, and a larger
 * course simply takes a little longer.
 *
 * Nothing stops either, because the zoom and the sideways movement never rest together. The camera swings toward the ride's
 * end as it rises, sweeps back across the course at its widest (the zoom's one still moment, the sideways movement at its
 * fastest), turns around on the start's side while it is already coming down, and from there moves with the ride. The video
 * is cut after that turn: its last frame and its first are a little past the widest view, already moving the way the rider
 * will go.
 *   pace: the flow on the way up and down, as a multiple of the ride's typical flow (1: never faster than the ride).
 *   turn: seconds the flow takes to rise from the widest moment's to that pace; the valley's width.
 *   lead: seconds between the widest view and the last frame (0: the video is cut at the widest view).
 *   swing: design px the camera swings to each side of the centred course (0 with lead 0: a standstill at the widest view).
 *   leave, land: seconds the last doubling-and-a-half of the zoom takes next to the rider, at the ending and at the opening.
 *   pencil: the ink returns to pencil over the last 0.7 s, and the loop has no seam. */
export const ENDS = {pace: 1, turn: 1.2, lead: 0.45, swing: 120, leave: 0.5, land: 0.35, pencil: false};
/** The camera's place across the course, in design px toward the ride's start, `g` seconds after the widest view, and how fast
 * that changes. It is centred at the widest view, furthest toward the start 0.6 of the lead later, and coming back from there. */
const swing = (g, ends) => {const span = ends.lead / 1.6; if (!(span > 0.02) || !ends.swing) return [0, 0]; const x = g / span, d = 1 + x * x; return [2 * ends.swing * x / d, 2 * ends.swing * (1 - x * x) / (d * d) / span];};
/** Design px: how far a point of the course in the frame sits, on average, from the point a zoom holds still. It turns a zoom
 * rate into a flow: at one e-fold a second the picture moves about this many px a second. */
const FLOW_REACH = 420;
const STEP = 1 / 240;

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
  // the gesture: for the way up (-1) and the way down (+1), how far the camera is from the whole course (0) toward the ride (1),
  // every STEP seconds away from the widest view. Integrated outward from it, on what the ride does at that moment. The way
  // down starts `lead` seconds before the video's last frame, on the rider waiting at the start.
  const speeds = smoothSamples(motion.velocity.map(v => v.speed), 0.25 * FPS), flows = Array.from(speeds, (v, f) => v * cam[f].z).sort((p, q) => p - q), typical = flows[flows.length >> 1];
  function side(sign, settle) {
    const edge = cam[sign > 0 ? Math.min(cam.length - 1, 2 * FPS) : Math.max(0, cam.length - 1 - 2 * FPS)].z, depth = Math.log(edge / overviewZoom), out = [0];
    if (!(depth > 0)) return out;
    const widest = Math.abs(swing(0, ends)[1]);
    for (let t = STEP, y = 0; t < 8; t += STEP) {
      const video = sign > 0 ? t - ends.lead : -t - ends.lead, speed = sign > 0 && video < 0 ? 0 : speeds[clamp(Math.round(sign > 0 ? video * FPS : cam.length - 1 + video * FPS), 0, cam.length - 1)];
      const z = overviewZoom * Math.exp(y), w = (z - overviewZoom) / (edge - overviewZoom), across = z / overviewZoom * (1 - w) * swing(sign * t, ends)[1], scroll = z * w * speed;
      // the flow asked for: the sideways sweep's at the widest view, then the pace; never under what the ride itself scrolls at
      // this moment, so the camera always arrives
      const far = Math.max(ends.pace * typical, edge * speed), flow2 = widest ** 2 + Math.max(0, far * far - widest ** 2) * smoothstep(t / ends.turn);
      const free = Math.sqrt(Math.max(0, flow2 - scroll * scroll - across * across)) / FLOW_REACH, soft = 2 / settle * Math.sqrt(depth - y);
      y += free * soft / (Math.hypot(free, soft) || 1) * STEP; // the slower of the two, without a corner where they cross
      if (y >= depth - 1e-4) break;
      out.push(y / depth);
    }
    return out;
  }
  let made = '', up, down;
  const sides = () => {const key = JSON.stringify(ends); if (key !== made) {made = key; up = side(-1, ends.leave); down = side(1, ends.land);} return [up, down];};
  const followAt = g => {const table = sides()[g < 0 ? 0 : 1], i = Math.abs(g) / STEP, k = Math.floor(i); return k + 1 >= table.length ? 1 : table[k] + (table[k + 1] - table[k]) * (i - k);};

  /** Seconds the ending and the opening take on this ride. */
  frameAt.lengths = () => {const [rise, fall] = sides(); return [rise.length * STEP + ends.lead, Math.max(0, fall.length * STEP - ends.lead)];};
  return frameAt;
  function frameAt(time, at, look) {
    const i = clamp(Math.floor(at), 0, cam.length - 1), j = Math.min(i + 1, cam.length - 1), u = clamp(at - i, 0, 1), a = cam[i], b = cam[j];
    const lerp = (p, q) => p + (q - p) * u;
    const lower = +look.riderLower + (DISC_TOPS.has(look.top) ? +look.sunRider : 0);
    const c = {z: lerp(a.z, b.z), ax: lerp(a.ax, b.ax), ay: lerp(a.ay, b.ay) + lower,
      x: lerp(a.x, b.x), y: lerp(a.y, b.y), over: 0, unink: 0};
    if (look.ends === 'none') return c;
    // g: seconds since the widest view. The video's last `lead` seconds are already on the way down, toward the rider waiting
    // at the start, so nothing jumps at the cut.
    const closing = time > songEnd / 2, g = (closing ? time - songEnd : time) + ends.lead, follow = followAt(g);
    if (follow >= 1) return c;
    const to = closing && g > 0 ? {...c, z: cam[0].z, ax: cam[0].ax, ay: cam[0].ay + lower, x: cam[0].x, y: cam[0].y} : c;
    // The zoom moves evenly in ratio (follow of the way in its logarithm). The rider's place on screen follows the zoom itself, so
    // without a swing every point of the course travels a straight line on screen: one zoom about one point.
    const z = Math.exp(Math.log(overviewZoom) + (Math.log(to.z) - Math.log(overviewZoom)) * follow), w = to.z !== overviewZoom ? (z - overviewZoom) / (to.z - overviewZoom) : follow;
    const [across] = swing(g, ends);
    const q = {x: W / 2 + (to.x - centre.x) * overviewZoom - back.x * across, y: 0.4 * H + (to.y - centre.y) * overviewZoom - back.y * across};
    return {...to, z, ax: q.x + (to.ax - q.x) * w, ay: q.y + (to.ay - q.y) * w, over: 1 - follow, unink: ends.pencil && closing ? smoothstep((time - songEnd + 0.7) / 0.6) : 0};
  }
}
