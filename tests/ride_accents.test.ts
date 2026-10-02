import {expect, it} from 'vitest';
import {ACCENT_BODY_POINTS, riderCorrection, localPeaks} from '../scripts/gallery/ride_accents.ts';
const state = (deltas: number[][], incoming = [5, .175]) => Object.fromEntries(ACCENT_BODY_POINTS.map((id, i) => [id,
  {x: incoming[0] + deltas[i][0], y: incoming[1] + deltas[i][1], prevX: 0, prevY: 0, vx: incoming[0], vy: incoming[1]}]));
it('does not count the incoming gravity step as a collision', () => {
  const r = riderCorrection(state(Array.from({length: 6}, () => [0, 0])));
  expect(r.meanImpulse).toBe(0); expect(r.pointRmsImpulse).toBe(0); expect(r.speedGain).toBe(0);
});
it('retains opposing body corrections that cancel in the mean trajectory', () => {
  const r = riderCorrection(state(Array.from({length: 6}, (_, i) => [0, i % 2 ? 2 : -2])));
  expect(r.meanImpulse).toBeCloseTo(0, 12); expect(r.pointRmsImpulse).toBeCloseTo(2, 12);
  expect(r.relativeRmsImpulse).toBeCloseTo(2, 12);
  expect(r.pointRmsImpulse ** 2).toBeCloseTo(r.meanImpulse ** 2 + r.relativeRmsImpulse ** 2, 12);
});
it('detects a large turn even when the rider slows down', () => {
  const r = riderCorrection(state(Array.from({length: 6}, () => [-2, 4]), [6, 0]));
  expect(r.speedGain).toBeLessThan(0); expect(r.headingDegrees).toBeCloseTo(45, 12);
  expect(r.meanImpulse).toBeCloseTo(Math.sqrt(20), 12); expect(r.relativeRmsImpulse).toBe(0);
});
it('counts a flat peak once and retains a genuinely separate pulse', () => {
  expect(localPeaks([0, 2, 2, 1, 0, 3, 0]).map(p => [p.frame, p.halfHeightFirst, p.halfHeightLast])).toEqual([[2, 1, 3], [5, 5, 5]]);
  expect(() => localPeaks([0, NaN, 0])).toThrow(); expect(() => riderCorrection({})).toThrow();
});
