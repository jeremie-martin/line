import {expect, it} from 'vitest';
import {RANGE, zoomOfWide, wideAt, laneScale, legacyWide, bySection, pushIn} from '../generated/concept-lab/zoom-model.mjs';
import {lanesFor} from '../generated/concept-lab/zoom-lanes.mjs';
import {createFraming, rideSignals, BASE} from '../scripts/video/camera.js';

it('the scale is fixed: 0.5 is today, and the widest shows 1.4 times more than the closest, whatever the lane', () => {
  expect(zoomOfWide(0.5)).toBe(1);
  expect(zoomOfWide(0) / zoomOfWide(1)).toBeCloseTo(RANGE); expect(RANGE).toBe(1.4);
  expect(zoomOfWide(-3)).toBe(zoomOfWide(0)); expect(zoomOfWide(7)).toBe(zoomOfWide(1));
  // a lane that only uses 0.4 to 0.6 is not stretched to the whole range
  const z = laneScale([{t: 0, wide: 0.4}, {t: 10, wide: 0.6}], 400);
  expect(Math.max(...z) / Math.min(...z)).toBeCloseTo(Math.pow(RANGE, 0.2));
});
it('the zoom holds before the first keyframe and after the last, and eases between', () => {
  const k = [{t: 2, wide: 0.2}, {t: 4, wide: 0.8}];
  expect(wideAt(k, 0)).toBe(0.2); expect(wideAt(k, 9)).toBe(0.8); expect(wideAt(k, 3)).toBeCloseTo(0.5);
  expect(wideAt(k, 2.2) - 0.2).toBeLessThan(0.01); // a slow start
  expect(wideAt([], 3)).toBe(0.5);
  expect(laneScale(k, 400, 0.5)[100]).toBeCloseTo(zoomOfWide(wideAt(k, 2))); // frame 100 is ride second 2.5, song second 2
});
it('old spec zooms come onto the scale by one fixed conversion', () => {
  expect(legacyWide(2.9)).toBe(0); expect(legacyWide(1.55)).toBe(1); expect(legacyWide(9)).toBe(0);
  expect(legacyWide(2.05)).toBeGreaterThan(0.5);
});
it('drafted lanes hold through sections or close in through them, inside the scale', () => {
  const sections = [{t0: 0, t1: 10}, {t0: 10, t1: 20}, {t0: 20, t1: 30}];
  const held = bySection(sections, [0.2, 1, 0.4]);
  expect(wideAt(held, 5)).toBe(0.2); expect(wideAt(held, 15)).toBe(1); expect(wideAt(held, 10)).toBeCloseTo(0.6); expect(wideAt(held, 29.9)).toBeCloseTo(0.4);
  const push = pushIn(sections, [0.5, 1, 0.6]);
  expect(wideAt(push, 12)).toBeGreaterThan(wideAt(push, 19)); expect(wideAt(push, 10.5)).toBeGreaterThan(wideAt(push, 9.5));
  const ends = {petrunko: 60, trouble: 50.3, tiki: 48};
  for (const [song, end] of Object.entries(ends)) {
    const lanes = lanesFor(song, [{t: 0, zoom: 2.8}, {t: 10, zoom: 1.7}]);
    expect(lanes.length).toBeGreaterThanOrEqual(4); expect(lanes.slice(0, 2).map(l => l.id)).toEqual(['steady', 'written']);
    for (const lane of lanes) {
      expect(lane.about.length).toBeGreaterThan(20);
      expect(lane.keyframes.every(k => k.wide >= 0 && k.wide <= 1 && k.t >= 0 && k.t <= end)).toBe(true);
      expect(lane.keyframes.every((k, i, a) => !i || k.t > a[i - 1].t)).toBe(true);
    }
  }
  expect(lanesFor('other', null).map(l => l.id)).toEqual(['steady']);
});
it('the camera takes a study\'s zoom, sizes the hit movement by it, and is untouched without one', () => {
  const n = 800, level = new Float64Array(200).fill(0.5);
  const centres = Array.from({length: n}, (_, f) => ({x: f * 8, y: f * 3})), motion = rideSignals(centres), look = {zoom: 'steady', riderLower: '0', top: 'none', sunRider: '32', ends: 'none'};
  const plain = createFraming(motion, level, [], 20)(10, 400, look);
  expect(plain.z).toBe(BASE); expect(plain.move).toBeUndefined();
  const half = createFraming(motion, level, [], 20, () => 0.5)(10, 400, look);
  expect(half.z).toBeCloseTo(BASE / 2); expect(half.move).toBeCloseTo(0.5);
});
