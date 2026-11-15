// Camera versions for the hit-weight pairs (study only; production callers never import this).
// A version is {follow, zoom, punch, shake}:
//   follow 'pinned': today's camera (the rider is the pivot and does not move on screen at a hit);
//          'old':    the historical follower on the ten-point centre, its dead zone reading the zoom (punch included);
//          'carry':  today's camera, and at each hit the camera carries on a little: the rider moves on screen by the
//                    change of its own velocity, quickly out and slowly back.
//   zoom: scene size (today 6.2); punch: peak zoom pulse at realized strength 0.85 (0 = none), centred on the rider.
import step from '/generated/hit-effects/follower.js';
import {W, H, createFraming, smoothstep} from '/scripts/video/camera.js';
import {realizedHits, realizedPunchAt, punchSettings} from './hit-motion-realized.mjs';

/** Carry: seconds of the rider's velocity change shown as displacement at the peak; rise and return times (s); cap (px). */
export const CARRY = {gain: 0.033, rise: 0.07, back: 0.3, from: 0.3, full: 0.55, cap: 90};
const shape = (() => {
  const f = t => Math.exp(-t / CARRY.back) - Math.exp(-t / CARRY.rise);
  let peak = 0; for (let t = 0; t < 1; t += 0.002) peak = Math.max(peak, f(t));
  return age => age <= 0 || age > 2 ? 0 : f(age) / peak;
})();
/** Each hit's change of rider velocity (world units/s), over the four frames either side of its peak. */
export function hitKicks(motion, hits) {
  const mean = (a, b) => {let x = 0, y = 0, n = 0; for (let f = Math.max(0, a); f <= Math.min(motion.velocity.length - 1, b); f++) {x += motion.velocity[f].x; y += motion.velocity[f].y; n++;} return {x: x / n, y: y / n};};
  return hits.map(h => {const f = Math.round(h.time * 40), b = mean(f - 4, f - 1), a = mean(f + 1, f + 4);
    return {time: h.time, x: (a.x - b.x) * smoothstep((h.strength - CARRY.from) / (CARRY.full - CARRY.from)), y: (a.y - b.y) * smoothstep((h.strength - CARRY.from) / (CARRY.full - CARRY.from))};});
}
export function carryAt(kicks, time, zoom) {
  let x = 0, y = 0;
  for (const k of kicks) {const s = shape(time - k.time); if (s) {x += k.x * s; y += k.y * s;}}
  x *= CARRY.gain * zoom; y *= CARRY.gain * zoom;
  const d = Math.hypot(x, y), c = d > CARRY.cap ? CARRY.cap / d : 1;
  return {x: x * c, y: y * c};
}
export function versionFraming(v, scene) {
  const hits = realizedHits(scene), P = punchSettings({peak: v.punch || 0.13, cap: 0.16}); // the historical punch never passed 13%
  const punchAt = time => v.punch ? realizedPunchAt(hits, time, P) : 1;
  return (motion, level, hitTimes, songEnd) => {
    if (v.follow === 'old') {
      let c = motion.centres[0];
      const cams = motion.centres.map((r, f) => {
        const z = v.zoom * punchAt(f / 40);
        c = step(c, r, {zoom: z, width: W, height: H});
        return {x: r.x, y: r.y, z, ax: W / 2 + (r.x - c.x) * z, ay: H * 0.36 + (r.y - c.y) * z};
      });
      return (time, at) => {
        const f = Math.max(0, Math.min(at, cams.length - 1)), i = Math.floor(f), j = Math.min(i + 1, cams.length - 1), u = f - i;
        return {...Object.fromEntries(['x', 'y', 'z', 'ax', 'ay'].map(k => [k, cams[i][k] + (cams[j][k] - cams[i][k]) * u])), over: 0, ending: false};
      };
    }
    const frame = createFraming(motion, level, hitTimes, songEnd), kicks = v.follow === 'carry' ? hitKicks(motion, hits) : null;
    return (time, at, look) => {
      const c = frame(time, at, look), o = kicks ? carryAt(kicks, at / 40, v.zoom) : {x: 0, y: 0};
      return {...c, z: c.z * v.zoom / 6.2 * punchAt(at / 40), ax: c.ax + o.x, ay: c.ay + o.y};
    };
  };
}
