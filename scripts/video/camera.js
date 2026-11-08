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

export const W = 1080, H = 1920;
const DT = 1 / FPS;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smoothstep = x => {x = clamp(x, 0, 1); return x * x * (3 - 2 * x);};

function gauss1(arr, sig) {
  if (sig <= 0) return Float64Array.from(arr);
  const R = Math.ceil(2.5 * sig), ker = []; for (let k = -R; k <= R; k++) ker.push(Math.exp(-k * k / (2 * sig * sig)));
  const n = arr.length, out = new Float64Array(n);
  for (let f = 0; f < n; f++) {let s = 0, w = 0; for (let i = 0; i < ker.length; i++) {s += arr[clamp(f + i - R, 0, n - 1)] * ker[i]; w += ker[i];} out[f] = s / w;}
  return out;
}
const diff = (p, f) => {const a = p[Math.max(0, f - 1)], b = p[Math.min(p.length - 1, f + 1)], k = Math.min(p.length - 1, f + 1) - Math.max(0, f - 1) || 1;
  return {x: (b.x - a.x) / k * FPS, y: (b.y - a.y) / k * FPS};};

/** What the camera reads from a ride: body centres per physics frame and whether the rider touches a line. */
export function rideSignals(centres, contacts) {
  return {n: centres.length, R: centres, vel: centres.map((_, f) => diff(centres, f)), air: centres.map((_, f) => !(contacts[f]?.length))};
}

// rest: resting point (fractions of W, H); rx, ry: reach of the offset; dir: speed (u/s) under which the offset fades;
// back: px/s against the motion; settle: return rate; backDown: px/s the rider may rise on screen while descending;
// sm: smoothing of the velocity the target reads (s), so a direction flip does not swing the target.
const FOLLOW = {rest: [0.5, 0.34], rx: 0.15, ry: 0.17, dir: 150, back: 110, settle: 1.6, backDown: 45, sm: 0.25};
function placed(Rs, zs, P) {
  const n = Rs.n, sm = a => gauss1(Rs.R.map((_, f) => Rs.vel[f][a]), P.sm * FPS), vx = sm('x'), vy = sm('y'), out = new Array(n);
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
      const u = z * Rs.vel[f][a], gap = T[a] - p[a], withMotion = u * gap > 0 && Math.abs(u) > 150;
      const want = withMotion ? gap / DT * 0.22 : gap * P.settle;
      const up = a === 'y' && u > 150 ? P.backDown : P.back;
      const [lo, hi] = u > 150 ? [-up, u] : u < -150 ? [u, P.back] : [-P.back, P.back];
      p[a] += clamp(want, lo, hi) * DT;
    }
    out[f] = {z, ax: p.x, ay: p.y, x: Rs.R[f].x, y: Rs.R[f].y};
  }
  return out;
}

/** The zoom over time (ln, added to the base). 'quiet': wide while the ride is quiet (the intensity metric), untouched from the
 * middle of the scale upward, at most 2.5 %/s. 'steady': none. */
const TIDES = {
  steady: Rs => new Float64Array(Rs.n),
  quiet: (Rs, level) => Float64Array.from({length: Rs.n}, (_, f) => -0.12 * (1 - clamp((level(f) - 0.2) / 0.35, 0, 1))),
};
/** One camera per physics frame: {z, ax, ay, x, y} (zoom, the rider's screen point, the rider's world point).
 * `level(f)`: the intensity metric at physics frame f (only the 'quiet' tide reads it). */
export function followCamera(Rs, {base, tide, level}) {
  const want = TIDES[tide](Rs, level), lz = new Float64Array(Rs.n); lz[0] = want[0];
  // a smooth tide ignores the airborne hold (the ride is airborne about 60 % of the time) and stays under 2.5 %/s
  if (tide === 'quiet') {const g = gauss1(want, FPS); lz[0] = g[0]; for (let f = 1; f < Rs.n; f++) lz[f] = clamp(g[f], lz[f - 1] - 0.025 * DT, lz[f - 1] + 0.025 * DT);}
  else for (let f = 1; f < Rs.n; f++) lz[f] = Rs.air[f] ? lz[f - 1] : clamp(want[f], lz[f - 1] - 0.04 * DT, lz[f - 1] + 0.04 * DT);
  return placed(Rs, Float64Array.from(lz, v => base * Math.exp(v)), FOLLOW);
}
