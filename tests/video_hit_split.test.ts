import {expect, it} from 'vitest';
import {DIRECTIONS, SPLIT_DEFAULT, KNOCK, directionFor, offsetOf, redSide, splitAmount, splitAt, travelBefore} from '../generated/concept-lab/hit-split-model.mjs';
import {hitEffectsAt, split} from '../scripts/video/hits.js';
import {strength} from '../scripts/video/intensity.js';

const hit = (time: number, s: number, normal = {x: 0, y: -1}) => ({time, strength: s, energy: strength(s), normal});
const r = Math.SQRT1_2;

it('the opening settings are production: the same split and direction at every moment', () => {
  const hits = [hit(0, 0.9), hit(0.1, 0.4, {x: r, y: -r}), hit(0.15, 0.7, {x: -0.6, y: -0.8}), hit(0.8, 0.32, {x: 1, y: 0})];
  for (let t = -0.1; t < 1.4; t += 0.0125) {
    const a = hitEffectsAt(hits, t), b = splitAt(hits, t);
    expect(b.split).toBeCloseTo(a.split, 9); expect(b.direction).toEqual(a.direction);
  }
  for (let s = 0; s < 1.6; s += 0.01) expect(splitAmount(s)).toBeCloseTo(split(s), 9);
});
it('size scales the curve and start moves where it begins', () => {
  expect(splitAmount(0.85, {...SPLIT_DEFAULT, size: 2})).toBeCloseTo(2 * split(0.85));
  expect(splitAmount(0.5, {...SPLIT_DEFAULT, start: 0.5})).toBe(0);
  expect(splitAmount(0.85, {...SPLIT_DEFAULT, start: 0.5})).toBeCloseTo(split(0.85));
  expect(splitAmount(0.4, {...SPLIT_DEFAULT, start: 0.2})).toBeGreaterThan(split(0.4));
});
it('each direction puts red where it says, on level ground and on a slope', () => {
  const ground = {x: 0, y: -1}, slope = {x: r, y: -r};
  const close = (a: {x: number, y: number}, b: {x: number, y: number}) => {expect(a.x).toBeCloseTo(b.x, 6); expect(a.y).toBeCloseTo(b.y, 6);};
  close(redSide('half', ground), {x: r, y: r});
  close(redSide('today', ground), {x: 0, y: 1}); close(redSide('out', ground), {x: 0, y: -1});
  close(redSide('outHalf', ground), {x: r, y: -r}); close(redSide('side', ground), {x: 1, y: 0});
  close(redSide('today', slope), {x: -r, y: r}); close(redSide('side', slope), {x: -1, y: 0});
  close(redSide('travel', ground, 0, {x: 3, y: 4}), {x: 0.6, y: 0.8});
  close(redSide('turn', ground, KNOCK / 2), {x: 0, y: 1}); close(redSide('turn', ground, KNOCK * 2), {x: 0, y: -1});
  for (const d of DIRECTIONS) {const u = redSide(d, slope, 0.1, {x: 1, y: 0}); expect(Math.hypot(u.x, u.y)).toBeCloseTo(1);}
});
it('split.js draws the asked offset, straight up or down included, and the swap puts red on the other side', () => {
  for (let a = 0; a < 2 * Math.PI; a += Math.PI / 12) {
    const u = {x: Math.cos(a), y: Math.sin(a)}, o = offsetOf(directionFor(u));
    expect(o.x).toBeCloseTo(u.x, 5); expect(o.y).toBeCloseTo(u.y, 5);
  }
  const hits = [hit(0, 0.9)], a = splitAt(hits, 0.02, {...SPLIT_DEFAULT}), b = splitAt(hits, 0.02, {...SPLIT_DEFAULT, swap: 1});
  expect(offsetOf(a.direction).y).toBeCloseTo(1, 5); expect(offsetOf(b.direction).y).toBeCloseTo(-1, 5);
  expect(a.split).toBeCloseTo(b.split);
});
it('travel is read from the frames before the hit', () => {
  const centres = Array.from({length: 100}, (_, f) => ({x: f * 3, y: f < 40 ? f * 4 : 160}));
  const t = travelBefore(centres, 40 / 40, 40)!;
  expect(t.x).toBeCloseTo(0.6); expect(t.y).toBeCloseTo(0.8);
  expect(travelBefore(Array.from({length: 10}, () => ({x: 1, y: 1})), 0.1, 40)).toBeNull();
});
