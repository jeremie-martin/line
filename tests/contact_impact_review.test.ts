import {describe, expect, it} from 'vitest';
// @ts-ignore browser module
import {impactWindow, impactTimeAt} from '../motion-gallery/contact-impact-review.js';
describe('impact inspection windows', () => {
  it('keeps a stable window while playing, then advances at its boundary', () => {
    expect(impactWindow(0, 48)).toEqual({start: 0, end: 8});
    expect(impactWindow(7.999, 48)).toEqual({start: 0, end: 8});
    expect(impactWindow(8, 48)).toEqual({start: 8, end: 16});
    expect(impactWindow(26, 48)).toEqual({start: 24, end: 32});
  });
  it('retains a nonempty final window at the end and supports short rides', () => {
    expect(impactWindow(48, 48)).toEqual({start: 40, end: 48});
    expect(impactWindow(45, 45)).toEqual({start: 40, end: 45});
    expect(impactWindow(3, 3)).toEqual({start: 0, end: 3});
    expect(impactWindow(-2, 48)).toEqual({start: 0, end: 8});
  });
  it('maps clicks to the displayed interval, clamping outside its edges', () => {
    expect(impactTimeAt(.5, 0, 48)).toBe(24);
    expect(impactTimeAt(.25, 24, 32)).toBe(26);
    expect(impactTimeAt(.5, 40, 45)).toBe(42.5);
    expect(impactTimeAt(-.2, 24, 32)).toBe(24);
    expect(impactTimeAt(1.1, 24, 32)).toBe(32);
  });
});
