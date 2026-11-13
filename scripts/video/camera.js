// The camera: "Follows direction" (concept lab rounds 1–7), computed offline for the whole ride, which is known in advance.
//
// The camera is the rider's SCREEN POSITION p(t) and the zoom z(t), pivoting on the rider:
//   screen(P) = p + z·(P − R),   R = the rider's raw body centre (never smoothed: smoothing leaks fake motion).
// The rider's resting point follows the DIRECTION of travel (the unit velocity, faded in below 150 u/s so a slow rider rests),
// the vertical offset growing as the slope's sine squared, so a 60° ride sits lower than a 35° one at any speed. Moving WITH the
// rider's real motion is quick; moving AGAINST it is limited, so the camera may lag or stop but never seems to move the rider
// against its motion, and while the rider descends it rises on screen at most 45 px/s (it never seems to climb).
// Pure: no DOM. Frames are 1080 × 1920 design pixels; the picture scales them to the canvas.

import {FPS} from './timing.js';
import {FS} from './intensity.js';

export const W = 1080, H = 1920;
const DT = 1 / FPS;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
/** Tops that put a disc where the sun is (sky.js): the rider sits lower under them, as under the sun. */
export const DISC_TOPS = new Set(['sun', 'crescent', 'stars', 'ring', 'rays', 'hills', 'fuji']);
export const smoothstep = x => {x = clamp(x, 0, 1); return x * x * (3 - 2 * x);};

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

/** One camera per physics frame. Steady zoom is constant; quiet zoom follows intensity with a
 * one-second smoothing and a 2.5 %/s log-zoom limit. Neither mode depends on airborne state. */
export function followCamera(motion, {base, zoom, level}) {
  const n = motion.centres.length;
  if (zoom === 'steady') return placed(motion, new Float64Array(n).fill(base));
  if (zoom !== 'quiet') throw new Error(`Unknown zoom: ${zoom}`);
  const want = Float64Array.from({length: n}, (_, f) => -0.12 * (1 - clamp((level(f) - 0.2) / 0.35, 0, 1)));
  const g = smoothSamples(want, FPS), lz = new Float64Array(n); lz[0] = g[0];
  for (let f = 1; f < n; f++) lz[f] = clamp(g[f], lz[f - 1] - 0.025 * DT, lz[f - 1] + 0.025 * DT);
  return placed(motion, Float64Array.from(lz, v => base * Math.exp(v)));
}

/** A frame has one camera representation: rider world position x/y, rider screen position ax/ay,
 * and zoom z. Opening/ending interpolate that same representation, not a second camera or rider transform.
 * Song time controls bookends; fractional physics frame controls the ride. No canvas or mutable playback state. */
export function createFraming(motion, level, hitTimes, songEnd) {
  const cams = new Map(), centres = motion.centres;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of centres) {x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);}
  // Frame the ride, with an 80-unit margin; rails extending past it can crop.
  x0 -= 80; y0 -= 80; x1 += 80; y1 += 80;
  const overviewZoom = Math.min(0.78 * W / (x1 - x0), 0.5 * H / (y1 - y0));
  const centre = {x: (x0 + x1) / 2, y: (y0 + y1) / 2};
  const openingEnd = Math.min(2.2, hitTimes.find(h => h.t >= 1.3)?.t ?? 1.6), endingStart = songEnd - 3;

  return function frameAt(time, at, look) {
    if (!cams.has(look.zoom)) cams.set(look.zoom, followCamera(motion, {base: 6.2, zoom: look.zoom,
      // The camera was calibrated with nearest intensity samples, while colour and sun interpolate them.
      level: f => level[clamp(Math.round(f / FPS * FS), 0, level.length - 1)]}));
    const cam = cams.get(look.zoom), i = clamp(Math.floor(at), 0, cam.length - 1), j = Math.min(i + 1, cam.length - 1), u = clamp(at - i, 0, 1), a = cam[i], b = cam[j];
    const lerp = (p, q) => p + (q - p) * u;
    const lower = +look.riderLower + (DISC_TOPS.has(look.top) ? +look.sunRider : 0);
    const c = {z: lerp(a.z, b.z), ax: lerp(a.ax, b.ax), ay: lerp(a.ay, b.ay) + lower,
      x: lerp(a.x, b.x), y: lerp(a.y, b.y), over: 0, ending: false};
    if (look.ends === 'none') return c;
    let follow = 1;
    if (time < openingEnd) follow = smoothstep((time - 0.25) / (openingEnd - 0.25));
    else if (time > endingStart) follow = 1 - smoothstep((time - endingStart) / 2.6);
    if (follow >= 1) return c;
    const q = {x: W / 2 + (c.x - centre.x) * overviewZoom, y: 0.4 * H + (c.y - centre.y) * overviewZoom};
    return {...c, z: Math.exp(Math.log(overviewZoom) + (Math.log(c.z) - Math.log(overviewZoom)) * follow),
      ax: q.x + (c.ax - q.x) * follow, ay: q.y + (c.ay - q.y) * follow, over: 1 - follow, ending: time > endingStart};
  };
}
