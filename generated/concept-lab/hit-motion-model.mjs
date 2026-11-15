// Experimental presentation only. No compiler/scorer input or production look changes.
import {hitEffectsAt, shake} from '../../scripts/video/hits.js';
export const MODES = {
  current: ['Current shake', '28 px at strength 0.85; 6 Hz along the blow. One winning hit.'],
  still: ['No shake', 'Keeps the colour response; the ride stays steady.'],
  old: ['Old vibration', 'Recovered June–September law: 9 / 12.33 Hz, 10 px, 0.4°; accumulating decay. Current measured peaks and camera, no old zoom or overscan.'],
  recoil: ['Single recoil', 'One 18 px kick, then a smooth return without crossing rest.'],
  press: ['Press and release', 'A smooth 45 ms push into a 16 px displacement; settles by 220 ms, no reversal.'],
  spring: ['Soft spring', 'One small rebound, with a continuous attack; at most 18 px.'],
  grain: ['Fine vibration', 'A brief 10 Hz tremor, at most 8 px; direction starts at zero.'],
  roll: ['Rotational knock', 'A small 0.55° roll about the rider, with a 5 px recoil.'],
  lens: ['Lens pulse', 'A 3.5% zoom pulse around the rider; no translation.'],
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = u => (u = clamp(u, 0, 1), u * u * (3 - 2 * u));
const release = (age, hold, end) => age < 0 || age >= end ? 0 : 1 - smooth((age - hold) / (end - hold));
const bump = (age, peak, end) => smooth(age / peak) * release(age, peak, end);

/** Same function drives playback, curves and metrics. Time is seconds on the ride clock.
 * New candidates add short responses, then bound the vector, rotation and log zoom.
 * This avoids switching direction when a different hit wins the colour response.
 * Exaggeration affects only movement here, so colour cannot confound the comparison. */
export function motionAt(mode, hits, time, gain = 1, songTime = time) {
  if (!Object.hasOwn(MODES, mode)) throw new Error(`Unknown hit motion: ${mode}`);
  if (mode === 'current') {const {dx, dy} = hitEffectsAt(hits, time, gain); return {dx, dy, rotation: 0, scale: 1};}
  let dx = 0, dy = 0, rotation = 0, zoom = 0;
  if (mode === 'old') {
    let trauma = 0;
    for (const h of hits) if (h.time <= time && h.strength >= 0.22) trauma += h.strength * 1.6 * Math.exp(-(time - h.time) * 7);
    if (!trauma) return {dx: 0, dy: 0, rotation: 0, scale: 1};
    const m = Math.min(1, trauma) ** 1.5, w = 2 * Math.PI;
    return {dx: 10 * m * Math.sin(w * 9 * songTime) * gain, dy: 10 * m * Math.sin(w * 9 * 1.37 * songTime + 1.7) * gain,
      rotation: 0.4 * m * Math.sin(w * 9 * 0.9 * songTime + 3.1) * gain, scale: 1};
  }
  for (const h of hits) {
    const age = time - h.time;
    if (age < 0 || age >= 0.3) continue;
    const s = Math.min(1.5, shake(h.strength) / 28), x = -h.normal.x, y = -h.normal.y;
    let a = 0;
    if (mode === 'recoil') a = 18 * s * release(age, 1 / 60, 0.18);
    if (mode === 'press') a = 16 * s * bump(age, 0.045, 0.22);
    if (mode === 'spring') a = 18 * s * Math.sin(2 * Math.PI * age / 0.24) * release(age, 0.045, 0.24);
    if (mode === 'grain') a = 8 * s * Math.sin(2 * Math.PI * 10 * age) * release(age, 0.015, 0.14);
    if (mode === 'roll') {const b = bump(age, 0.025, 0.2); a = 5 * s * b; rotation += 0.55 * s * b * (x < 0 ? -1 : 1);}
    if (mode === 'lens') zoom += Math.log(1.035) * s * bump(age, 0.025, 0.2);
    dx += a * x; dy += a * y;
  }
  const cap = {recoil: 24, press: 22, spring: 22, grain: 10, roll: 7}[mode] ?? 0;
  const length = Math.hypot(dx, dy), k = length > cap ? cap / length : 1;
  return {dx: dx * k * gain, dy: dy * k * gain, rotation: clamp(rotation, -0.75, 0.75) * gain,
    scale: Math.exp(clamp(zoom, 0, Math.log(1.05)) * gain)};
}
export function effectsAt(mode, gain = 1, colour = true, offset = 0, splitEnabled = true) {
  return (hits, time) => {
    const base = hitEffectsAt(hits, time);
    return {...base, ...motionAt(mode, hits, time, gain, time - offset), ...(colour ? {} : {split: 0, boost: 0, lit: false}), ...(!splitEnabled ? {split: 0} : {})};
  };
}
