import {expect, it} from 'vitest';
import {carryAmount, carryShape, movementAt, singleHit, MOVE_DEFAULT} from '../generated/concept-lab/hit-move-model.mjs';
import {strength} from '../scripts/video/intensity.js';

const hit = (time: number, s: number, normal = {x: 0, y: -1}) => ({time, strength: s, energy: strength(s), normal});

it('carry follows measured strength: nothing up to its start, the set amount at 0.85, bounded above', () => {
  const p = {...MOVE_DEFAULT, start: 0.5, amount: 40};
  expect(carryAmount(0.5, p)).toBe(0);
  expect(carryAmount(0.85, p)).toBeCloseTo(40);
  for (let s = 0.2; s < 1.6; s += 0.01) expect(carryAmount(s + 0.01, p)).toBeGreaterThanOrEqual(carryAmount(s, p));
  expect(carryAmount(3, p)).toBeCloseTo(68);
});
it('carry rises to one soon after the hit and settles back', () => {
  expect(carryShape(0)).toBe(0);
  let peak = 0, at = 0; for (let t = 0; t < 2; t += 0.001) {const v = carryShape(t); if (v > peak) {peak = v; at = t;}}
  expect(peak).toBeCloseTo(1, 3); expect(at).toBeGreaterThan(0.05); expect(at).toBeLessThan(0.2);
  expect(carryShape(1.5)).toBeLessThan(0.02);
});
it('carry moves the picture out of the surface, the shake into it first, and nothing moves before the hit', () => {
  const p = {...MOVE_DEFAULT, shake: 1};
  expect(movementAt([hit(1, 0.9)], 0.99, p)).toEqual({dx: 0, dy: 0});
  expect(singleHit(0.9, 0.005, p)).toBeLessThan(0);   // the knock: into the surface
  expect(singleHit(0.9, 0.15, p)).toBeGreaterThan(20); // the rebound: out of it
  const side = movementAt([hit(0, 0.9, {x: 1, y: 0})], 0.15, {...p, shake: 0});
  expect(side.dx).toBeGreaterThan(20); expect(side.dy).toBeCloseTo(0);
});
it('many hits together stay within 1.7 times the amount, and a zero amount with shake 1 is the full shake alone', async () => {
  const {hitEffectsAt} = await import('../scripts/video/hits.js');
  const hits = Array.from({length: 12}, (_, i) => hit(i * 0.05, 1));
  const m = movementAt(hits, 0.7, {...MOVE_DEFAULT, shake: 0});
  expect(Math.hypot(m.dx, m.dy)).toBeLessThanOrEqual(1.7 * MOVE_DEFAULT.amount + 1e-9);
  const {TUNES} = await import('../scripts/video/hits.js');
  const today = hitEffectsAt(hits, 0.31, 1, TUNES.shakeOnly), same = movementAt(hits, 0.31, {...MOVE_DEFAULT, amount: 0, shake: 1});
  expect(same.dx).toBeCloseTo(today.dx); expect(same.dy).toBeCloseTo(today.dy);
});
it('production is the page\'s movement at its opening settings, lasts past the hit\'s other effects, and still is still', async () => {
  const {hitEffectsAt, TUNES} = await import('../scripts/video/hits.js');
  const hits = [hit(0, 0.9), hit(0.4, 0.6, {x: 0.6, y: -0.8})];
  for (const t of [0.01, 0.1, 0.3, 0.45, 0.8, 1.5]) {
    const a = hitEffectsAt(hits, t), lit = hitEffectsAt(hits, t, 1, TUNES.lit65), b = movementAt(hits, t);
    expect(a.dx).toBeCloseTo(b.dx); expect(a.dy).toBeCloseTo(b.dy); expect(lit.dx).toBe(a.dx); expect(lit.dy).toBe(a.dy);
  }
  expect(Math.abs(hitEffectsAt(hits, 0.9).dy)).toBeGreaterThan(1); // every other effect of these hits is over
  expect(hitEffectsAt(hits, 0.9, 1, TUNES.shakeOnly)).toEqual({dx: 0, dy: 0, split: 0, direction: {x: 0, y: 0}, boost: 0, lit: false});
  for (const t of [0.01, 0.1, 0.9]) {const s = hitEffectsAt(hits, t, 1, TUNES.still); expect(s.dx).toBe(0); expect(s.dy).toBe(0);}
});
it('in the opening and ending the camera says how much smaller the picture is, and nothing during the ride', async () => {
  const {createFraming, rideSignals} = await import('../scripts/video/camera.js');
  const centres = Array.from({length: 40 * 20}, (_, f) => ({x: f * 8, y: f * 3}));
  const frame = createFraming(rideSignals(centres), new Float64Array(200).fill(0.5), [{t: 1.5, s: 0.6}], 20), look = {zoom: 'steady', riderLower: '0', top: 'none', sunRider: '32', ends: 'course'};
  expect(frame(10, 400, look).move).toBeUndefined();
  const early = frame(0.3, 12, look), late = frame(19.5, 780, look);
  expect(early.move).toBeGreaterThan(0); expect(early.move).toBeLessThan(0.5); expect(late.move).toBeLessThan(1);
  expect(frame(10, 400, {...look, ends: 'none'}).move).toBeUndefined();
});
