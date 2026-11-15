import {expect, it} from 'vitest';
import {carryAmount, carryShape as shapeOf, hitEffectsAt, TUNES} from '../scripts/video/hits.js';
import {strength} from '../scripts/video/intensity.js';

// the settings as a tuning page holds them: carry's four numbers and the shake's multiple
const MOVE_DEFAULT = {...TUNES.v1.carry, shake: TUNES.v1.shake};
type Move = typeof MOVE_DEFAULT;
const carryShape = (age: number) => shapeOf(age, MOVE_DEFAULT);
const movementAt = (hits: any[], time: number, p: Move = MOVE_DEFAULT) => {const e = hitEffectsAt(hits, time, 1, {shake: p.shake, carry: p}); return {dx: e.dx, dy: e.dy};};
const singleHit = (s: number, age: number, p: Move) => -movementAt([hit(0, s)], age, p).dy;

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
it('many hits together stay within 1.7 times the amount, and a zero amount with shake 1 is the full shake alone', () => {
  const hits = Array.from({length: 12}, (_, i) => hit(i * 0.05, 1));
  const m = movementAt(hits, 0.7, {...MOVE_DEFAULT, shake: 0});
  expect(Math.hypot(m.dx, m.dy)).toBeLessThanOrEqual(1.7 * MOVE_DEFAULT.amount + 1e-9);
  const today = hitEffectsAt(hits, 0.31, 1, {shake: 1}), same = movementAt(hits, 0.31, {...MOVE_DEFAULT, amount: 0, shake: 1});
  expect(same.dx).toBeCloseTo(today.dx); expect(same.dy).toBeCloseTo(today.dy);
});
it('production is the movement at these settings, lasts past the hit\'s other effects, and still is still', () => {
  const hits = [hit(0, 0.9), hit(0.4, 0.6, {x: 0.6, y: -0.8})];
  for (const t of [0.01, 0.1, 0.3, 0.45, 0.8, 1.5]) {
    const a = hitEffectsAt(hits, t), lit = hitEffectsAt(hits, t, 1, TUNES.lit65), b = movementAt(hits, t);
    expect(a.dx).toBeCloseTo(b.dx); expect(a.dy).toBeCloseTo(b.dy); expect(lit.dx).toBe(a.dx); expect(lit.dy).toBe(a.dy);
  }
  expect(Math.abs(hitEffectsAt(hits, 0.9).dy)).toBeGreaterThan(1); // every other effect of these hits is over
  expect(hitEffectsAt(hits, 0.9, 1, {shake: 1})).toEqual({dx: 0, dy: 0, split: 0, direction: {x: 0, y: 0}, boost: 0, lit: false});
  for (const t of [0.01, 0.1, 0.9]) {const s = hitEffectsAt(hits, t, 1, TUNES.still); expect(s.dx).toBe(0); expect(s.dy).toBe(0);}
});
it('in the opening and ending the picture is smaller than the ride\'s own, which is what scales the hit movement', async () => {
  const {createFraming, rideSignals, BASE} = await import('../scripts/video/camera.js');
  const centres = Array.from({length: 40 * 20}, (_, f) => ({x: f * 8, y: f * 3}));
  const frame = createFraming(rideSignals(centres), [{t: 1.5, s: 0.6}], 20), look = {riderLower: '0', top: 'none', sunRider: '32', ends: 'course'};
  expect(frame(10, 400, look).z).toBe(BASE);
  const early = frame(0.3, 12, look), late = frame(19.5, 780, look);
  expect(early.z / BASE).toBeGreaterThan(0); expect(early.z / BASE).toBeLessThan(0.5); expect(late.z).toBeLessThan(BASE);
  expect(frame(0.3, 12, {...look, ends: 'none'}).z).toBe(BASE);
});
