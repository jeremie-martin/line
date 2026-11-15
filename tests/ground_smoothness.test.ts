import {describe, it, expect} from 'vitest';
import {roughestReversal, sharpestTurn, groundIsSmooth} from '../scripts/v0/optimizer/ground_smoothness.ts';

/** A chain of 10 px lines with the given headings in degrees. */
function chain(headings: number[], id0 = 1) {
  let x = 0, y = 0;
  return headings.map((deg, i) => {const x1 = x, y1 = y; x += 10 * Math.cos(deg * Math.PI / 180); y += 10 * Math.sin(deg * Math.PI / 180); return {id: id0 + i, x1, y1, x2: x, y2: y};});
}
const all = (lines: {id: number}[]) => new Set(lines.map(l => l.id));

describe('roughestReversal', () => {
  it('is 0 on an arc, however much it bends', () => {
    const arc = chain(Array.from({length: 20}, (_, i) => i * 5));
    expect(roughestReversal(arc, all(arc))).toBe(0);
  });
  it('reads a bump as the degrees undone', () => {
    const bump = chain([0, 0, 10, 20, 10, 0, 0]);
    expect(roughestReversal(bump, all(bump))).toBeCloseTo(20);
  });
  it('reads a long S as small: only the bend within reach counts', () => {
    const s = chain([...Array.from({length: 30}, (_, i) => i), ...Array.from({length: 30}, (_, i) => 29 - i)]);
    expect(roughestReversal(s, all(s))).toBeCloseTo(5);
  });
  it('reads a zigzag of straight pieces by its corners', () => {
    const fold = chain([0, 0, 0, 15, 15, 15, 0, 0, 0]);
    expect(roughestReversal(fold, all(fold))).toBeCloseTo(15);
  });
  it('ignores a bump the rider never touches', () => {
    const bump = chain([0, 0, 0, 0, 0, 0, 0, 0, 10, 20, 10, 0]);
    expect(roughestReversal(bump, new Set([1, 2]))).toBe(0);
  });
  it('treats chains separately', () => {
    const a = chain([0, 0, 0]), b = chain([40, 40, 40], 100).map(l => ({...l, x1: l.x1 + 500, x2: l.x2 + 500}));
    expect(roughestReversal([...a, ...b], all([...a, ...b]))).toBe(0);
  });
});

describe('sharpestTurn', () => {
  it('reads a gentle arc by its radius and a lip by its angle', () => {
    const arc = chain(Array.from({length: 20}, (_, i) => i * 2)), lip = chain([0, 0, 0, 0, 0, 15, 30, 45]);
    expect(sharpestTurn(arc, all(arc))).toBeCloseTo(4);
    expect(sharpestTurn(lip, all(lip))).toBeGreaterThan(29);
  });
  it('judges only the touched lines', () => {
    const lip = chain([0, 0, 0, 0, 0, 0, 0, 0, 15, 30, 45]);
    expect(sharpestTurn(lip, new Set([1, 2, 3]))).toBe(0);
  });
});
describe('groundIsSmooth', () => {
  const lip = chain([0, 0, 0, 0, 0, 0, 15, 30, 45]);
  it('allows sharp turning within the hit\'s own frames and refuses it after', () => {
    const during = (f: number) => f < 6 ? [7, 8, 9] : [], after = (f: number) => f >= 6 ? [7, 8, 9] : [1];
    expect(groundIsSmooth(lip, during, 0, 10)).toBe(true);
    expect(groundIsSmooth(lip, after, 0, 10)).toBe(false);
  });
  it('refuses a bump touched after the hit\'s frames and allows one within them', () => {
    const bump = chain([0, 0, 6, 12, 6, 0, 0, 0, 0, 0, 0, 0]);
    expect(groundIsSmooth(bump, f => f >= 6 ? [3, 4, 5] : [], 0, 10)).toBe(false);
    expect(groundIsSmooth(bump, f => f < 6 ? [3, 4, 5] : [11, 12], 0, 10)).toBe(true);
  });
});
