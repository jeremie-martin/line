import {expect, it} from 'vitest';
import {RANGE, zoomOfWide, wideAt, laneScale} from '../scripts/video/zoom.js';
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
it('every song\'s lanes are inside the scale and the song, in time order, with an intention; a ride always gets the same one', async () => {
  const {ZOOMS} = await import('../scripts/video/zooms.ts'), {chooseZoom} = await import('../scripts/video/choose.js');
  const ends: Record<string, number> = {petrunko_selection: 60, trouble_50s: 50.3, tiki_tiki_48s: 48};
  expect(Object.keys(ZOOMS).sort()).toEqual(Object.keys(ends).sort());
  for (const [song, lanes] of Object.entries(ZOOMS)) {
    expect(lanes.length).toBeGreaterThanOrEqual(2); expect(new Set(lanes.map(l => l.id)).size).toBe(lanes.length);
    for (const lane of lanes) {
      expect(lane.about.length).toBeGreaterThan(20);
      expect(lane.keyframes.every(k => k.wide >= 0 && k.wide <= 1 && k.t >= 0 && k.t <= ends[song] - 2)).toBe(true);
      expect(lane.keyframes.every((k, i, a) => !i || k.t > a[i - 1].t)).toBe(true);
    }
    const seen = new Set(Array.from({length: 60}, (_, i) => chooseZoom(`ride-${i}`, lanes)!.id));
    expect(seen.size).toBe(lanes.length); // over many rides every lane is used
    expect(chooseZoom('ride-7', lanes)).toBe(chooseZoom('ride-7', lanes));
  }
  expect(chooseZoom('ride-7', [])).toBeNull();
});
it('the camera takes a lane as a multiple of the steady zoom per frame, and is the steady zoom without one', () => {
  const n = 800, centres = Array.from({length: n}, (_, f) => ({x: f * 8, y: f * 3})), motion = rideSignals(centres), look = {riderLower: '0', top: 'none', sunRider: '32', ends: 'none'};
  expect(createFraming(motion, [], 20)(10, 400, look).z).toBe(BASE);
  expect(createFraming(motion, [], 20, new Float64Array(n).fill(0.5))(10, 400, look).z).toBeCloseTo(BASE / 2);
});
