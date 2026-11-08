// Automatic camera, computed offline for the whole ride (the ride is known in advance).
//
// A "truthful rig" with directors on top (round 2; design shared with the round-2 idea notes in
// agents/round2-ideas/ideas.md).
//
// The camera is the rider's SCREEN POSITION p(t) and the zoom z(t), pivoting on the rider:
//   screen(P) = p + z·(P − R),   R = the rider's raw body centre (never smoothed: smoothing leaks fake motion).
// Rule P: per axis, the rider's on-screen velocity stays between "camera stopped" (= the rider's own velocity)
//         and a tiny drift against it (ε). So the camera may lag or stop, never move against the rider or overtake it.
// Rule Z: zoom pivots on the rider (so it never moves the rider), is rate-limited, and never pushes in during a flight
//         faster than the landing approaches (that would look like a lift).
// Rule C: a cut is not motion when it is unambiguous (≥ ×1.15 zoom); cuts happen only on hits.
// Directors only propose: a preferred zoom (ln, added), a ceiling (ln, min), a preferred screen position, cuts.

export const W = 1080, H = 1920, FPS = 40;
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
function filtfilt(arr, tau) {
  const a = 1 - Math.exp(-DT / tau), n = arr.length, f = new Float64Array(n), b = new Float64Array(n);
  f[0] = arr[0]; for (let i = 1; i < n; i++) f[i] = f[i - 1] + a * (arr[i] - f[i - 1]);
  b[n - 1] = f[n - 1]; for (let i = n - 2; i >= 0; i--) b[i] = b[i + 1] + a * (f[i] - b[i + 1]);
  return b;
}
const diff = (p, f) => {const a = p[Math.max(0, f - 1)], b = p[Math.min(p.length - 1, f + 1)], k = Math.min(p.length - 1, f + 1) - Math.max(0, f - 1) || 1;
  return {x: (b.x - a.x) / k * FPS, y: (b.y - a.y) / k * FPS};};
/** The shared, absolute strength curve (intensity.js): one definition, so hit sizes and the intensity metric cannot disagree. */
import {strength} from './intensity.js';
export {strength};

/** Per-ride signals shared by every camera. hits need {t, s, tc?}. */
export function rideSignals(centres, contacts, hits, phases, duration) {
  const n = centres.length, R = centres;
  const vel = R.map((_, f) => diff(R, f));                       // raw, units/s (y down)
  const air = Array.from({length: n}, (_, f) => !(contacts[f]?.length));
  const tNext = new Float64Array(n), tPrev = new Float64Array(n);
  {let next = Infinity; for (let f = n - 1; f >= 0; f--) {if (!air[f]) next = f; tNext[f] = (next - f) * DT;}
    let prev = -Infinity; for (let f = 0; f < n; f++) {if (!air[f]) prev = f; tPrev[f] = (f - prev) * DT;}}
  const hs = hits.map(h => ({...h, tc: h.tc ?? h.t, e: strength(h.s)})).sort((a, b) => a.tc - b.tc);
  const sect = phases.map(p => {
    const hh = hs.filter(h => h.t >= p.t0 && h.t < p.t1), len = Math.max(0.5, p.t1 - p.t0);
    return {...p, density: hh.length / len, strength: hh.length ? hh.reduce((a, h) => a + h.s, 0) / hh.length : 0};
  });
  // flights: runs without contact of at least 0.3 s, merged when less than 0.5 s apart
  const flights = [];
  for (let f = 0; f < n; f++) {
    if (!air[f] || (f && air[f - 1])) continue; let g = f; while (g < n && air[g]) g++;
    if ((g - f) * DT >= 0.3) {const last = flights.at(-1); if (last && (f - last.b) * DT < 0.5) last.b = g; else flights.push({a: f, b: g});}
  }
  return {n, R, vel, air, tNext, tPrev, hits: hs, sect, flights, duration};
}

const sectionIndex = (Rs, t) => {let i = Rs.sect.findIndex(p => t >= p.t0 && t < p.t1); return i < 0 ? Rs.sect.length - 1 : i;};
function fitBox(Rs, f0, f1, wFrac, hFrac, pad = 30) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let g = clamp(f0, 0, Rs.n - 1); g <= clamp(f1, 0, Rs.n - 1); g++) {const p = Rs.R[g]; x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);}
  return Math.min(wFrac * W / (x1 - x0 + 2 * pad), hFrac * H / (y1 - y0 + 2 * pad));
}

// ── directors ──────────────────────────────────────────────────────────────
// Each returns a partial plan: {pref: ln offsets}, {cap: ln ceilings}, {fast: allowed |d ln z/dt|}, {cuts: [{f, dlz}]}.
const D = {
  // D1: tighter when the music is busy, wider when it opens up (strength-weighted density, read 0.35 s ahead)
  breathe(Rs) {
    const rho = new Float64Array(Rs.n), sig = 1.0;
    for (const h of Rs.hits) {const c = (h.tc - 0.35) * FPS, r = 3 * sig * FPS; for (let f = Math.max(0, Math.floor(c - r)); f <= Math.min(Rs.n - 1, c + r); f++) rho[f] += (0.5 + h.s) * Math.exp(-(((f - c) * DT) ** 2) / (2 * sig * sig)) / (sig * Math.sqrt(2 * Math.PI));}
    const sorted = [...rho].sort((a, b) => a - b), p10 = sorted[Math.floor(0.1 * Rs.n)], p90 = sorted[Math.floor(0.9 * Rs.n)];
    const q = Array.from(rho, r => clamp((r - p10) / Math.max(1e-6, p90 - p10), 0, 1));
    const mean = Rs.sect.map(s => {let a = 0, k = 0; for (let f = Math.floor(s.t0 * FPS); f < Math.min(Rs.n, s.t1 * FPS); f++) {a += q[f]; k++;} return k ? a / k : 0.5;});
    const spread = Math.min(1, (p90 - p10) / 0.6);
    return {pref: Float64Array.from(q, (v, f) => 0.4 * spread * (0.5 * v + 0.5 * mean[sectionIndex(Rs, f * DT)] - 0.5))};
  },
  // D2: frame each flight so the landing is in the picture from take-off; hold the zoom while airborne
  flight(Rs, lzHome) {
    const cap = new Float64Array(Rs.n).fill(Infinity), fast = new Float64Array(Rs.n);
    for (const {a, b} of Rs.flights) {
      if (b - a < 0.5 * FPS) continue;
      // frame the approach: from 0.6 s before touchdown, the rider and its landing fit in the picture ahead of it
      const fa = Math.max(a, b - Math.round(0.6 * FPS)), f1 = b + Math.round(0.15 * FPS);
      const z = clamp(fitBox(Rs, fa, f1, 0.6, 0.42), 0.6 * Math.exp(lzHome), Math.exp(lzHome));
      for (let f = Math.max(0, a - Math.round(0.25 * FPS)); f <= Math.min(Rs.n - 1, f1); f++) cap[f] = Math.min(cap[f], Math.log(z));
      for (let f = Math.max(0, a - FPS); f <= Math.min(Rs.n - 1, f1 + FPS); f++) fast[f] = 0.6;
    }
    return {cap, fast};
  },
  // D3: lean in on the approach to every strong hit (absolute strength), release after it
  lean(Rs) {
    const keep = new Float64Array(Rs.n).fill(1);
    for (const h of Rs.hits) {
      if (h.e < 0.05) continue;
      for (let f = Math.max(0, Math.floor((h.tc - 0.8) * FPS)); f < Math.min(Rs.n, (h.tc + 3) * FPS); f++) {
        const x = f * DT - h.tc, A = x <= 0 ? smoothstep((x + 0.8) / 0.8) : Math.exp(-x / 0.7);
        keep[f] *= 1 - h.e * h.e * A;
      }
    }
    return {pref: Float64Array.from(keep, k => 0.16 * (1 - k))};
  },
  // D4: cut in, on the downbeat that opens a section or on the landing that ends a long flight (spaced ≥ 4 s)
  drop(Rs) {
    const cands = [];
    for (const h of Rs.hits) {
      if (h.e < 0.45) continue;
      const opens = Rs.sect.some(s => s.t0 > 0.5 && Math.abs(h.tc - s.t0) <= 0.15) && !Rs.hits.some(o => o !== h && o.tc < h.tc && o.tc > h.tc - 0.8);
      const lands = Rs.flights.some(fl => fl.b - fl.a >= 0.4 * FPS && Math.abs(fl.b * DT - h.tc) <= 0.1);
      if (opens || lands) cands.push(h);
    }
    const cuts = [];
    for (const h of [...cands].sort((a, b) => b.e - a.e)) if (cuts.every(c => Math.abs(c.t - h.tc) >= 4)) cuts.push({t: h.tc, f: Math.ceil(h.tc * FPS), dlz: Math.log(1.18 + 0.22 * h.e)});
    return {cuts: cuts.sort((a, b) => a.f - b.f)};
  },
  // D6: in long gaps between hits, pull far out to show the ink behind and the pencil ahead, back by the next hit
  lookback(Rs, lzHome) {
    const cap = new Float64Array(Rs.n).fill(Infinity), fast = new Float64Array(Rs.n);
    const hs = Rs.hits;
    for (let i = 0; i + 1 < hs.length; i++) {
      // out after the last hit of a phrase, back in before the next one (or after ~3.5 s of a long quiet)
      const g0 = hs[i].tc + 0.1, g1 = Math.min(hs[i + 1].tc - 0.35, g0 + 3.5); if (g1 - g0 < 1.4) continue;
      // only when there is track to see: the rider is on a line for most of the gap
      let ground = 0, all = 0; for (let f = Math.floor(g0 * FPS); f <= Math.min(Rs.n - 1, g1 * FPS); f++) {all++; if (!Rs.air[f]) ground++;}
      if (ground < 0.5 * all) continue;
      for (let f = Math.floor(g0 * FPS); f <= Math.min(Rs.n - 1, g1 * FPS); f++) {
        const t = f * DT, env = smoothstep((t - g0) / 1.0) * smoothstep((g1 - t) / 1.0);
        const z = clamp(fitBox(Rs, f - 2 * FPS, f + 1 * FPS, 0.8, 0.5, 60), 2.6, 9);
        cap[f] = Math.min(cap[f], lzHome + (Math.log(z) - lzHome) * env);
        fast[f] = 1.2;
      }
    }
    return {cap, fast};
  },
  // build & release: each section pushes in slowly; the next downbeat releases wide, fast
  build(Rs) {
    const pref = new Float64Array(Rs.n), fast = new Float64Array(Rs.n);
    for (let f = 0; f < Rs.n; f++) {
      const t = f * DT, i = sectionIndex(Rs, t), s = Rs.sect[i], u = (t - s.t0) / Math.max(0.5, s.t1 - s.t0);
      pref[f] = 0.17 * Math.pow(smoothstep(u), 1.5) - 0.05;
      if (i > 0 && t - s.t0 < 0.7) fast[f] = 0.9;
    }
    return {pref, fast, raw: true};
  },
};
export const DIRECTORS = {
  steady: [], tripod: [], breathe: ['breathe'], build: ['build'], flight: ['flight', 'drop'], lean: ['lean'], lookback: ['lookback'],
  director: ['breathe', 'lean', 'drop', 'lookback'],
};

// D5: place the rider from where the course goes: steep descents high (room below), flat rides lower.
function placement(Rs, opt) {
  const ax = opt.ax ?? 0.29, ay = opt.ay ?? 0.42;
  const px = new Float64Array(Rs.n), py = new Float64Array(Rs.n), k = Math.round(1.5 * FPS);
  for (let f = 0; f < Rs.n; f++) {
    const a = Rs.R[f], b = Rs.R[Math.min(Rs.n - 1, f + k)], th = Math.atan2(b.y - a.y, Math.abs(b.x - a.x) + 1e-6);
    const s = clamp(th / (Math.PI / 4), 0, 1);
    px[f] = (ax - 0.04 * s) * W; py[f] = (ay - 0.12 * s) * H;
  }
  return {px: gauss1(px, 1.5 * FPS), py: gauss1(py, 1.5 * FPS)};
}

// ── placement: where the rider sits in the frame ───────────────────────────
// The official player's follower (module 560) is a soft elliptical dead zone: a fast rider rides the zone's leading
// edge, so it sits right of centre, lower when falling, and drifts back when slow. Its position is therefore a fast
// function of velocity. PLACEMENTS keep that idea with a slower, asymmetric response: moving WITH the rider's real
// motion is free (a fall looks like a fall), moving AGAINST it is limited to `back` px/s (the return is gentle).
//   rest: resting point (fractions of W, H); rx, ry: reach of the offset (fractions); back: px/s against the motion.
export const PLACEMENTS = {
  pinnedLeft: {pinned: true},                                          // round 2's strict camera
  pinnedRight: {rest: [0.58, 0.40], rx: 0, ry: 0, back: 45, settle: 1},           // same rule, on the side that feels natural
  loose: {rest: [0.5, 0.36], rx: 0.19, ry: 0.15, back: 170, settle: 2.2},           // between Tamed and the official follower
  tamed: {rest: [0.5, 0.36], rx: 0.15, ry: 0.11, back: 110, settle: 1.6},           // the official shape, returning gently
  calm: {rest: [0.52, 0.38], rx: 0.09, ry: 0.05, back: 60, settle: 1.2},            // a smaller, quieter version
  // Round 6. Tamed sat the rider at 0.43 H (median, 3 songs) and pinned it near its 0.46 floor through every descending
  // stretch, so a real dive (Los 28.5 s) had nowhere left to go on screen. 'high' only raises the rest point.
  high: {rest: [0.5, 0.31], rx: 0.15, ry: 0.11, back: 110, settle: 1.6},
  // 'dive' also splits the vertical answer. The stretch's own fall (a gaussian of vy, σ 1 s) moves the rider less than Tamed
  // does (0.08 against 0.11), so a descending stretch no longer pins it at its floor. Then riding a line STEEPER than 40°
  // drops the rider by up to 12 % more (full at 65°), and it climbs back gently afterwards. Los 28.6–29.1 s is a 60° ride
  // at ordinary vertical speed: its angle, not its speed, is what sets it apart. Falls in the air after a jump are excluded.
  dive: {rest: [0.5, 0.33], rx: 0.15, ry: 0.08, ryFast: 0.12, slow: 1, back: 110, settle: 1.6},
  // 'follow': one generic rule instead of a niche one. The offset follows the DIRECTION of travel (the unit velocity, faded in
  // below 150 u/s so a slow rider rests), not each axis' speed: a 60° ride sits lower than a 35° one at any speed, and a
  // descending stretch no longer saturates. Same asymmetric response as Tamed; its median height matches 'high'.
  follow: {rest: [0.5, 0.34], rx: 0.15, ry: 0.17, dir: 150, back: 110, settle: 1.6, backDown: 45, sm: 0.25, shape: 2},
  // Round 7: Follows direction is chosen; its height is a separate setting. Same behaviour, the whole placement shifted.
  followMid: {rest: [0.5, 0.365], rx: 0.15, ry: 0.17, dir: 150, back: 110, settle: 1.6, backDown: 45, sm: 0.25, shape: 2},
  followLow: {rest: [0.5, 0.39], rx: 0.15, ry: 0.17, dir: 150, back: 110, settle: 1.6, backDown: 45, sm: 0.25, shape: 2},
};
function placed(Rs, zs, P) {
  // sm: extra smoothing of the velocity the target reads (s), so a direction flip does not swing the target
  const n = Rs.n, sm = a => gauss1(Rs.R.map((_, f) => Rs.vel[f][a]), (P.sm ?? 0.05) * FPS), vx = sm('x'), vy = sm('y'), out = new Array(n);
  const reach = (v, v0) => v / Math.sqrt(1 + (v / v0) ** 2) / v0; // saturates at ±1, roughly linear below v0
  const vs = P.slow ? gauss1(Array.from(vy), P.slow * FPS) : null, ground = P.slow ? gauss1(Rs.air.map(a => a ? 0 : 1), 0.15 * FPS) : null;
  const steep = f => smoothstep((Math.atan2(vy[f], Math.abs(vx[f])) * 180 / Math.PI - 40) / 25);
  const unit = (f, a) => {const v = Math.hypot(vx[f], vy[f]); return (a === 'x' ? vx[f] : vy[f]) / Math.sqrt(v * v + P.dir * P.dir);};
  // shape 2: the vertical offset grows as the slope's sine squared (sign kept), so steep rides stand out from ordinary ones
  const shaped = u => P.shape === 2 ? u * Math.abs(u) : u;
  const ty = f => P.dir ? P.rest[1] + P.ry * shaped(unit(f, 'y')) : vs ? P.rest[1] + P.ry * reach(vs[f], 220) + P.ryFast * ground[f] * steep(f) : P.rest[1] + P.ry * reach(vy[f], 220);
  const tx = f => P.rest[0] + P.rx * (P.dir ? unit(f, 'x') : reach(vx[f], 260));
  const p = {x: tx(0) * W, y: ty(0) * H};
  for (let f = 0; f < n; f++) {
    const z = zs[f], T = {x: tx(f) * W, y: ty(f) * H};
    for (const a of ['x', 'y']) {
      // with the motion: quick. Against it: proportional to the distance left, so the return curves and settles;
      // a fixed-rate return is a straight ramp, which reads as the rider climbing (round 2's sawtooth).
      const u = z * Rs.vel[f][a], gap = T[a] - p[a], withMotion = u * gap > 0 && Math.abs(u) > 150;
      const want = withMotion ? gap / DT * 0.22 : gap * P.settle;
      // backDown: while the rider descends, it may rise on screen only this slowly (px/s), so it never seems to climb
      const up = a === 'y' && u > 150 && P.backDown != null ? P.backDown : P.back;
      const [lo, hi] = u > 150 ? [-up, u] : u < -150 ? [u, P.back] : [-P.back, P.back];
      p[a] += clamp(want, lo, hi) * DT;
    }
    out[f] = {z, ax: p.x, ay: p.y, x: Rs.R[f].x, y: Rs.R[f].y};
  }
  return out;
}

// ── zoom as a slow tide ────────────────────────────────────────────────────
// Characterized on 22 rides: impact rate needs σ ≈ 3 s before it stops pumping (9.5 swings/min at σ = 1 s, 3 at σ = 3 s,
// 1 at σ = 5 s). Tides change the zoom by at most about ±12 %, over many seconds.
function impactRate(Rs, sig) {
  const a = new Float64Array(Rs.n);
  for (const h of Rs.hits) {const f = Math.round(h.tc * FPS); if (f >= 0 && f < Rs.n) a[f] += (0.5 + h.s) * FPS;}
  return gauss1(a, sig * FPS);
}
const pct = (arr, p) => [...arr].sort((a, b) => a - b)[Math.floor(p * (arr.length - 1))];
export const TIDES = {
  steady: Rs => new Float64Array(Rs.n),
  // one-sided: the quietest stretches ease out (the low tail of the same impact rate); elsewhere it stays steady
  calmOut(Rs) {const r = impactRate(Rs, 3), lo = pct(r, 0.05), mid = pct(r, 0.3); return Float64Array.from(r, v => -0.12 * (1 - clamp((v - lo) / Math.max(1e-6, mid - lo), 0, 1)));},
  // the same behaviour on the intensity metric: wide while the ride is quiet, untouched from the middle of the scale upward
  quietI: (Rs, level) => Float64Array.from({length: Rs.n}, (_, f) => -0.12 * (1 - clamp((level(f) - 0.2) / 0.35, 0, 1))),
  // at most one excursion in a song, and only if the song has a real quiet: clarity comes from spending the fewest moves
  breath(Rs, level) {
    const n = Rs.n, m = 6 * FPS, R = 4.8 * FPS, L = Float64Array.from({length: n}, (_, f) => level(f)); let b = m; for (let f = m; f < n - m; f++) if (L[f] < L[b]) b = f;
    // a real quiet is a valley: a slow opening or a fading ending is not one, so the ride must be going on both sides of it
    let pre = 0, post = 0; for (let f = 0; f < n; f++) if (f < b) pre = Math.max(pre, L[f]); else post = Math.max(post, L[f]);
    if (L[b] > 0.2 || pre < 0.45 || post < 0.45) return new Float64Array(n);
    let a0 = b, a1 = b; while (a0 > 0 && L[a0] < 0.35) a0--; while (a1 < n - 1 && L[a1] < 0.35) a1++;
    return Float64Array.from({length: n}, (_, f) => -0.12 * Math.min(smoothstep((f - a0 + R) / R), smoothstep((a1 + R - f) / R)));
  },
  // no motion at all: each song gets the zoom that gives it the same on-screen speed
  fit(Rs) {const v = pct(Rs.vel.map(p => p.x), 0.5); return new Float64Array(Rs.n).fill(v > 0 ? Math.log(360 / v) : 0);}, // a ride not moving right: steady, not a NaN zoom
};
const SMOOTH = new Set(['quietI', 'breath']);
/** Placement + tide: the round-3 camera. */
export function buildPlaced(Rs, {base, place = 'tamed', tide = 'steady', level = () => 0}) {
  // every tide obeys one limit: at most 4 %/s, and no zoom change while airborne (zooming in the air reads as a lift)
  // the ride is airborne about 60 % of the time, so a hold in the air chops a tide into dozens of tiny steps. Tides defined
  // smooth (`SMOOTH`) ignore the hold and stay under 2.5 %/s; 'calmOut' keeps round 3's stepped behaviour for comparison.
  const want = TIDES[tide](Rs, level), lz = new Float64Array(Rs.n); lz[0] = want[0];
  if (SMOOTH.has(tide)) {const g = gauss1(want, FPS); lz[0] = g[0]; for (let f = 1; f < Rs.n; f++) lz[f] = clamp(g[f], lz[f - 1] - 0.025 * DT, lz[f - 1] + 0.025 * DT);}
  else for (let f = 1; f < Rs.n; f++) lz[f] = Rs.air[f] ? lz[f - 1] : clamp(want[f], lz[f - 1] - 0.04 * DT, lz[f - 1] + 0.04 * DT);
  const zs = Float64Array.from(lz, v => base * Math.exp(v));
  if (PLACEMENTS[place].pinned) return buildCamera(Rs, {base, director: 'steady'}).map((c, f) => ({...c, z: zs[f]}));
  return placed(Rs, zs, PLACEMENTS[place]);
}
/** How much the rider wanders in the frame, and how it is distributed (fractions of W, H). */
export function measureFrame(Rs, cam) {
  const n = cam.length, sx = [], sy = [];
  for (let f = 0; f < n; f++) {const c = cam[f]; sx.push(c.ax + (Rs.R[f].x - c.x) * c.z); sy.push(c.ay + (Rs.R[f].y - c.y) * c.z);}
  const travel = a => {let s = 0; for (let f = 1; f < n; f++) s += Math.abs(a[f] - a[f - 1]); return s / (n * DT / 60);};
  const p = (a, q) => pct(a, q);
  return {x: [p(sx, .05) / W, p(sx, .5) / W, p(sx, .95) / W].map(v => +v.toFixed(2)), y: [p(sy, .05) / H, p(sy, .5) / H, p(sy, .95) / H].map(v => +v.toFixed(2)),
    xTravel: Math.round(travel(sx)), yTravel: Math.round(travel(sy)), zRate: +Math.max(...cam.slice(1).map((c, f) => Math.abs(Math.log(c.z / cam[f].z)) * FPS)).toFixed(3)};
}

/** The whole camera for one ride: per frame {z, ax, ay, x, y}: world point (x, y) is drawn at screen (ax, ay). */
export function buildCamera(Rs, {base, director = 'steady', compose = {}} = {}) {
  const n = Rs.n, lzHome = Math.log(base), parts = DIRECTORS[director].map(d => D[d](Rs, lzHome));
  const pref = new Float64Array(n).fill(lzHome), cap = new Float64Array(n).fill(lzHome + Math.log(1.35)), fast = new Float64Array(n);
  let raw = false; const cuts = [];
  for (const p of parts) {
    if (p.pref) for (let f = 0; f < n; f++) pref[f] += p.pref[f];
    if (p.cap) for (let f = 0; f < n; f++) cap[f] = Math.min(cap[f], p.cap[f]);
    if (p.fast) for (let f = 0; f < n; f++) fast[f] = Math.max(fast[f], p.fast[f]);
    if (p.cuts) cuts.push(...p.cuts); if (p.raw) raw = true;
  }
  const rate = f => Math.max(0.3, fast[f]) * DT;
  // ceilings are honoured in advance: a backward pass makes the pull-out start early enough
  for (let f = n - 2; f >= 0; f--) cap[f] = Math.min(cap[f], cap[f + 1] + rate(f));
  const want = Float64Array.from(pref, (v, f) => Math.min(v, cap[f]));
  const target = raw ? want : Float64Array.from(filtfilt(pref, 0.3), (v, f) => Math.min(v, cap[f]));
  const lz = new Float64Array(n), cutAt = new Map(cuts.map(c => [c.f, c]));
  lz[0] = Math.min(target[0], cap[0]);
  for (let f = 1; f < n; f++) {
    const c = cutAt.get(f);
    if (c && lz[f - 1] + c.dlz <= cap[f] + 0.05) {lz[f] = lz[f - 1] + c.dlz; continue;}
    let up = rate(f); const down = rate(f);
    if (Rs.air[f]) up = Math.min(up, (Rs.tNext[f] > 0 ? 0.5 / Rs.tNext[f] : 0.3) * DT); // no push-in that outruns a landing
    lz[f] = clamp(Math.min(target[f], cap[f]), lz[f - 1] - down, lz[f - 1] + up);
  }
  // position: a critically damped tracker toward the placement, inside Rule P.
  // 'strict': the rider is pinned (camera never faster than the rider, drift ≤ 30–45 px/s).
  // 'loose': an operator's smooth camera (the rider dips into landings and bounces on screen), still forbidden to
  //          move the rider against its motion beyond a gentler 90–120 px/s; tests whether strict is stricter than the eye.
  const loose = compose.mode === 'loose';
  const pl = placement(Rs, compose), lead = Math.round(0.4 * FPS), w = 2 * Math.PI * 0.5, AMAX = 2500;
  const EPS = loose ? {x: 120, y: 90} : {x: 45, y: 30}, LEVEL = loose ? 120 : 60, BOX = {x: [0.18 * W, 0.45 * W], y: [0.24 * H, 0.5 * H]};
  const smooth = loose ? (() => {const sx = gauss1(Rs.R.map(p => p.x), 7), sy = gauss1(Rs.R.map(p => p.y), 7); return Array.from(sx, (x, f) => ({x, y: sy[f]}));})() : null;
  const p = {x: pl.px[0], y: pl.py[0]}, v = {x: 0, y: 0}, home = {x: pl.px[0], y: pl.py[0]}, bv = {x: 0, y: 0}, out = new Array(n);
  for (let f = 0; f < n; f++) {
    const z = Math.exp(lz[f]), c = cutAt.get(f);
    if (c && f > 0 && Math.abs(lz[f] - lz[f - 1]) > 0.1) {p.x = home.x = pl.px[f]; p.y = home.y = pl.py[f]; v.x = v.y = bv.x = bv.y = 0;}
    for (const a of ['x', 'y']) {
      const u = z * Rs.vel[f][a], tgt = (a === 'x' ? pl.px : pl.py)[Math.min(n - 1, f + lead)];
      const [lo, hi] = u > 150 ? [-EPS[a], u] : u < -150 ? [u, EPS[a]] : [-LEVEL, LEVEL];
      if (loose) {
        // the slow placement drifts on its own; the rider sits where a smooth camera would put it, then the rule clips
        const bacc = clamp(w * w * (tgt - home[a]) - 2 * w * bv[a], -AMAX, AMAX); bv[a] += bacc * DT; home[a] += bv[a] * DT;
        const want = home[a] + z * (Rs.R[f][a] - smooth[f][a]);
        v[a] = clamp((want - p[a]) / DT * 0.5, lo, hi);
      } else {
        const acc = clamp(w * w * (tgt - p[a]) - 2 * w * v[a], -AMAX, AMAX);
        v[a] = clamp(v[a] + acc * DT, lo, hi);
      }
      const nx = p[a] + v[a] * DT; if (nx < BOX[a][0] - 60 || nx > BOX[a][1] + 60) v[a] = clamp(0, lo, hi);
      p[a] += v[a] * DT;
    }
    out[f] = {z, ax: p.x, ay: p.y, x: Rs.R[f].x, y: Rs.R[f].y};
  }
  out.cuts = cuts;
  if (director === 'tripod') {
    // locked-off shots: on one or two section downbeats, the camera stops dead for ~2 s and the rider crosses
    // a frame composed to hold its whole path; then a hard cut back. Screen motion is exactly rider motion.
    const opens = Rs.sect.filter((s, i) => s.t0 > 1 && i < Rs.sect.length - 1 && s.t1 < Rs.duration - 4).map(s => ({s, h: Rs.hits.find(h => Math.abs(h.tc - s.t0) < 0.2)})).filter(o => o.h && o.h.e >= 0.3);
    const shots = [];
    for (const o of opens.sort((a, b) => b.h.e - a.h.e)) if (shots.length < 2 && shots.every(x => Math.abs(x.t0 - o.h.tc) > 8)) shots.push({t0: o.h.tc, t1: Math.min(o.h.tc + 2.2, o.s.t1)});
    for (const sh of shots) {
      // as long a shot as keeps the rider readable (zoom ≥ 60 % of home), between 0.8 and 2.2 s
      const f0 = Math.ceil(sh.t0 * FPS); let f1 = f0, z = base, cx = 0, cy = 0;
      for (let L = sh.t1 - sh.t0; L >= 0.8; L -= 0.1) {
        f1 = Math.min(n - 1, Math.floor((sh.t0 + L) * FPS));
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (let f = f0; f <= f1; f++) {const q = Rs.R[f]; x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);}
        z = Math.min(base, 0.8 * W / (x1 - x0 + 60), 0.5 * H / (y1 - y0 + 60)); cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
        if (z >= 0.6 * base) break;
      }
      if (z < 0.6 * base) {
        // the phrase is too long to hold at a readable size: frame its start at 60 % of home and cut when the rider leaves
        z = 0.6 * base; const s0 = Rs.R[f0]; cx = s0.x + 0.3 * W / z; cy = s0.y + 0.12 * H / z;
        let g = f0; while (g < f1) {const q = Rs.R[g + 1], x = W / 2 + (q.x - cx) * z, y = 0.38 * H + (q.y - cy) * z; if (x < 0.08 * W || x > 0.9 * W || y < 0.06 * H || y > 0.68 * H) break; g++;}
        f1 = g;
      }
      for (let f = f0; f <= f1; f++) out[f] = {z, ax: W / 2, ay: 0.38 * H, x: cx, y: cy, cut: f === f0};
      if (f1 + 1 < n) out[f1 + 1] = {...out[f1 + 1], cut: true};
      cuts.push({t: sh.t0, f: f0, shot: true});
    }
  }
  return out;
}

/** Fake-motion events (≥ 3 physics frames ≈ 5 output frames, ≥ 12 px against the rider's motion, per axis) and framing measures. */
export function measureCamera(Rs, cam) {
  const n = cam.length, scr = cam.map((c, f) => ({x: c.ax + (Rs.R[f].x - c.x) * c.z, y: c.ay + (Rs.R[f].y - c.y) * c.z}));
  const isCut = f => f > 0 && (cam[f].cut || Math.abs(Math.log(cam[f].z / cam[f - 1].z)) > 0.1);
  const events = []; let worst = 0;
  for (const a of ['x', 'y']) {
    let run = 0, slide = 0, start = 0;
    const close = f => {if (run >= 3 && slide >= 12) {events.push({axis: a, t0: start * DT, t1: f * DT, px: Math.round(slide)}); worst = Math.max(worst, slide);} run = 0; slide = 0;};
    for (let f = 1; f < n - 1; f++) {
      if (isCut(f) || isCut(f + 1)) {close(f); continue;}
      const u = cam[f].z * (Rs.R[f + 1][a] - Rs.R[f - 1][a]) / 2 * FPS, v = (scr[f + 1][a] - scr[f - 1][a]) / 2 * FPS;
      const wrong = (Math.abs(u) > 150 && u * v < 0 && Math.abs(v) > 60) || (Math.abs(u) <= 150 && Math.abs(v) > 120);
      if (wrong) {if (!run) start = f; run++; slide += Math.abs(v) * DT;} else close(f);
    }
    close(n - 1);
  }
  // Q1: how early the landing point enters the safe picture during each flight (median, seconds)
  const leads = [];
  for (const {a, b} of Rs.flights) {
    if (b >= n) continue; const P = Rs.R[b]; let enter = b;
    for (let f = b; f >= a; f--) {const c = cam[f], x = c.ax + (P.x - c.x) * c.z, y = c.ay + (P.y - c.y) * c.z; if (x > 0.06 * W && x < 0.82 * W && y > 0.08 * H && y < 0.66 * H) enter = f; else break;}
    leads.push((b - enter) * DT);
  }
  leads.sort((x, y) => x - y);
  let inFrame = 0;
  for (const h of Rs.hits) {const f = clamp(Math.round(h.tc * FPS), 0, n - 1), c = cam[f], x = c.ax + (Rs.R[f].x - c.x) * c.z, y = c.ay + (Rs.R[f].y - c.y) * c.z; if (x > 0.08 * W && x < 0.8 * W && y > 0.1 * H && y < 0.62 * H) inFrame++;}
  let travel = 0; for (let f = 1; f < n; f++) if (!isCut(f)) travel += Math.abs(Math.log(cam[f].z / cam[f - 1].z));
  const zs = cam.map(c => c.z), min = n * DT / 60;
  return {events: events.length, perMin: +(events.length / min).toFixed(1), worst: Math.round(worst), list: events,
    landingLead: leads.length ? +leads[Math.floor(leads.length / 2)].toFixed(2) : null, flights: leads.length,
    hitsInFrame: +(inFrame / Math.max(1, Rs.hits.length)).toFixed(2), zoomTravel: +(travel / min).toFixed(2),
    zMin: +Math.min(...zs).toFixed(2), zMax: +Math.max(...zs).toFixed(2), cuts: cam.cuts?.length ?? 0};
}

/** Round 1's camera, kept only to show the fake-climb problem: a centred smoothing plus a centred look-ahead. */
export function roundOneCamera(centres) {
  const ZR = 5.4 * 1.35, n = centres.length;
  const vel = centres.map((_, f) => {const a = centres[Math.max(0, f - 6)], b = centres[Math.min(n - 1, f + 6)], k = Math.min(n - 1, f + 6) - Math.max(0, f - 6) || 1; return {x: (b.x - a.x) / k, y: (b.y - a.y) / k};});
  const g = (arr, s) => arr.map((_, f) => {let x = 0, y = 0, w = 0; for (let k = -2 * s; k <= 2 * s; k++) {const e = Math.exp(-k * k / (2 * s * s)), v = arr[Math.max(0, Math.min(arr.length - 1, f + k))]; x += v.x * e; y += v.y * e; w += e;} return {x: x / w, y: y / w};});
  const lead = g(vel, 24), sm = g(centres, 10);
  return centres.map((_, f) => {const k = 20 * smoothstep(f / 24), max = 0.24 * W / ZR; let lx = lead[f].x * k, ly = lead[f].y * k; const m = Math.hypot(lx, ly); if (m > max) {lx *= max / m; ly *= max / m;} return {z: ZR, ax: W / 2, ay: 0.38 * H, x: sm[f].x + lx, y: sm[f].y + ly};});
}
