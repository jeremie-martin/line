import {expect, it} from 'vitest';
import {zoomScale, wideness, ZOOM_DEFAULT, RANGE} from '../generated/concept-lab/zoom-model.mjs';
import {createFraming, rideSignals, BASE} from '../scripts/video/camera.js';

const n = 40 * 20, level = Float64Array.from({length: 200}, (_, i) => i < 100 ? 0.2 : 0.8);
const ride = {frames: n, level, speed: Float64Array.from({length: n}, (_, f) => f < 400 ? 100 : 500),
  phases: [{t0: 0, t1: 10}, {t0: 10, t1: 20}], keyframes: [{t: 0, zoom: 2.8}, {t: 10, zoom: 1.7}, {t: 20, zoom: 1.7}]};

it('steady, or an amount of zero, is one zoom for the whole ride', () => {
  for (const p of [{...ZOOM_DEFAULT}, {...ZOOM_DEFAULT, source: 'intensity', amount: 0}])
    expect(new Set(zoomScale(ride, p)).size).toBe(1);
  expect(new Set(zoomScale({...ride, keyframes: null}, {...ZOOM_DEFAULT, source: 'song'})).size).toBe(1); // a spec without a zoom
  expect(zoomScale(ride, {...ZOOM_DEFAULT, close: 0.8})[0]).toBeCloseTo(0.8);
});
it('every source is wide where the ride is intense, fast or written wide, within the range the amount allows', () => {
  for (const source of ['intensity', 'speed', 'sections', 'song']) {
    const z = zoomScale(ride, {...ZOOM_DEFAULT, source, amount: 1, ease: 0.5});
    expect(z[100]).toBeGreaterThan(z[700]); // closer in the calm first half
    expect(Math.max(...z) / Math.min(...z)).toBeLessThanOrEqual(RANGE + 1e-9);
    expect(Math.max(...z) / Math.min(...z)).toBeGreaterThan(2);
    const back = zoomScale(ride, {...ZOOM_DEFAULT, source, amount: 1, ease: 0.5, flip: true});
    expect(back[100]).toBeLessThan(back[700]);
  }
});
it('sections hold one zoom and change around the section\'s start', () => {
  const w = wideness(ride, {...ZOOM_DEFAULT, source: 'sections', ease: 2});
  expect(new Set(Array.from(w.slice(0, 350))).size).toBe(1); expect(new Set(Array.from(w.slice(450))).size).toBe(1);
  expect(w[400]).toBeGreaterThan(w[0]); expect(w[400]).toBeLessThan(w[799]);
});
it('the camera takes a study\'s zoom, sizes the hit movement by it, and is untouched without one', () => {
  const centres = Array.from({length: n}, (_, f) => ({x: f * 8, y: f * 3})), motion = rideSignals(centres), look = {zoom: 'steady', riderLower: '0', top: 'none', sunRider: '32', ends: 'none'};
  const plain = createFraming(motion, level, [], 20)(10, 400, look);
  expect(plain.z).toBe(BASE); expect(plain.move).toBeUndefined();
  const half = createFraming(motion, level, [], 20, () => 0.5)(10, 400, look);
  expect(half.z).toBeCloseTo(BASE / 2); expect(half.move).toBeCloseTo(0.5);
});
