import {describe, expect, it} from 'vitest';
import {prepareHits, hitEffectsAt, hitHeatAt} from '../scripts/video/hits.js';

const hit = (strength: number, time = 1, normal = {x: 0, y: -1}) => prepareHits({
  targets: [{}], events: [{onset: 0, peak: time * 40, strength}], matches: [{target: 0, event: 0}],
}, [], [], new Map()).map(h => ({...h, normal}))[0];
const amount = (strength: number, age = 0) => hitEffectsAt([hit(strength)], 1 + age);

describe('measured hits', () => {
  it('uses matched measured events in target order, at the peak, never requested strength or onset', () => {
    const account = {targets: [{impact: 1}, {impact: 1}, {impact: 0.1}],
      events: [{onset: 30, peak: 32, strength: 0.85}, {onset: 18, peak: 20, strength: 0.4}, {onset: 24, peak: 25, strength: 1}],
      matches: [{target: 2, event: 0}, {target: 0, event: 1}]};
    expect(prepareHits(account, [], [], new Map()).map(h => [h.time, h.strength])).toEqual([[0.5, 0.4], [0.8, 0.85]]);
    expect(prepareHits(null, [], [], new Map())).toEqual([]);
  });
  it('uses the closest line at the first contact frame near onset, oriented toward the rider', () => {
    const account = {targets: [{}], events: [{onset: 4, peak: 12, strength: 0.9}], matches: [{target: 0, event: 0}]};
    const lines = new Map([
      [1, {x1: -10, y1: 5, x2: 10, y2: 5}],
      [2, {x1: 10, y1: 2, x2: -10, y2: 2}], // reversed endpoints; closest on the first frame
      [3, {x1: -10, y1: -1, x2: 10, y2: -1}], // closer later, opposite normal
    ]);
    const contacts = [[], [], [999], [1, 2], [3]];
    const centres = Array.from({length: 15}, () => ({x: 0, y: 0}));
    const [h] = prepareHits(account, contacts, centres, lines);
    expect(h.normal.x).toBeCloseTo(0); expect(h.normal.y).toBe(-1);
    expect(h.time).toBe(0.3);
    expect(prepareHits(account, [], centres, lines)[0].normal).toEqual({x: 0, y: -1});
  });
});

describe('approved hit response', () => {
  it('keeps weak hits still, starts each effect at its own threshold, and grows past the reference strength', () => {
    expect(amount(0.3).split).toBe(0);
    expect(amount(0.35).boost).toBe(0);
    expect(amount(0.55).dy).toBe(0);
    expect(amount(0.31).split).toBeGreaterThan(0);
    expect(amount(0.36).boost).toBeGreaterThan(0);
    expect(amount(0.56).dy).toBeGreaterThan(0);
    expect(amount(0.85)).toMatchObject({dy: 28, boost: 1.5}); // from 0.55 to 28 px since round 50
    expect(amount(0.85).split).toBeCloseTo(25.2); // a fifth stronger than 21 (owner, round 49)
    expect(amount(1).dy).toBe(34);
    expect(amount(1).split).toBeCloseTo(38.9454545454);
    expect(amount(1).boost).toBeCloseTo(1.8375);
    expect(amount(10)).toMatchObject({dy: 48, boost: 3});
    expect(amount(10).split).toBeCloseTo(50.4);
  });
  it('starts exactly at the peak, holds for a display frame, and recovers within a quarter second', () => {
    for (const s of [0.4, 0.6, 0.85, 1]) {
      const h = hit(s), before = hitEffectsAt([h], 1 - 1e-8), peak = amount(s);
      expect(before).toMatchObject({dx: 0, dy: 0, split: 0, boost: 0});
      expect(amount(s, 1 / 60).split).toBe(peak.split);
      expect(amount(s, 0.1).split).toBeLessThan(peak.split);
      expect(amount(s, 0.25)).toMatchObject({dx: 0, dy: 0, split: 0, boost: 0});
    }
    expect(amount(0.85, 1 / 12).dy).toBeLessThan(0); // the 6 Hz shake springs through rest
  });
  it('one winning hit drives every effect; heat alone accumulates', () => {
    const a = hit(0.85, 1, {x: -1, y: 0}), b = hit(0.6, 1.15);
    expect(hitEffectsAt([a, b], 1.05)).toEqual(hitEffectsAt([a], 1.05));
    expect(hitEffectsAt([a, b], 1.15)).toEqual(hitEffectsAt([b], 1.15));
    const tie = hit(0.85, 1);
    expect(hitEffectsAt([a, tie], 1)).toEqual(hitEffectsAt([a], 1)); // stable tie: first wins
    expect(hitHeatAt([a, b], 1.2)).toBeCloseTo(hitHeatAt([a], 1.2) + hitHeatAt([b], 1.2));
    expect(hitHeatAt([a, b], 0.99)).toBe(0);
  });
  it('exaggerates amplitudes only, and sampling is independent of order', () => {
    const hits = [hit(0.85, 1, {x: -0.6, y: -0.8}), hit(0.6, 1.05)];
    const times = [0.99, 1, 1.03, 1.07, 1.2, 2], expected = times.map(t => hitEffectsAt(hits, t));
    for (let i = times.length - 1; i >= 0; i--) {
      expect(hitEffectsAt(hits, times[i])).toEqual(expected[i]);
      const big = hitEffectsAt(hits, times[i], 3);
      for (const key of ['dx', 'dy', 'split', 'boost']) expect(big[key]).toBeCloseTo(3 * expected[i][key], 12);
      expect(big.direction).toEqual(expected[i].direction);
    }
    expect(hitEffectsAt([], 1)).toMatchObject({dx: 0, dy: 0, split: 0, boost: 0});
  });
});
