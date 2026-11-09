import {describe, expect, it} from 'vitest';
// @ts-expect-error: a plain module
import {GRADES, gradeScheme, toOklch, fromOklch} from '../scripts/video/grade.js';

const dune = {paper: '#efe2cd', ink: '#3a2115', pencil: '#c4b197', mass: '#8c3a1c', accent: '#e39a1b', sun: '#d8622a', nightPaper: '#2a160d', nightInk: '#efe2cd'};
const jungle = {paper: '#0a170f', ink: '#f2efe0', pencil: '#484f4a', mass: '#92a86a', accent: '#ffa94f', sun: '#f1ebd5', nightPaper: '#0a170f', nightInk: '#f2efe0'};
const C = (h: string) => toOklch(h).C, L = (h: string) => toOklch(h).L;

describe('colour responses to the ride’s intensity (grade.js)', () => {
  it('OKLCH round-trips every theme colour exactly', () => {
    for (const h of [...Object.values(dune), ...Object.values(jungle)]) expect(fromOklch(toOklch(h))).toBe(h);
  });
  it('a colour out of sRGB keeps its hue and lightness and loses chroma', () => {
    const c = toOklch(fromOklch({L: 0.7, C: 0.4, h: 0.5}));
    expect(c.L).toBeCloseTo(0.7, 2); expect(c.h).toBeCloseTo(0.5, 1); expect(c.C).toBeLessThan(0.4);
  });
  it('the arriving responses reach the theme’s own colours at the loudest, the swelling ones leave them untouched when quiet', () => {
    for (const k of ['saturation', 'contrast', 'both']) expect(gradeScheme(dune, k, 0.8)).toEqual(dune);
    for (const k of ['vibrance', 'brightness']) expect(gradeScheme(dune, k, 0.2)).toEqual(dune);
  });
  it('saturation mutes when quiet; vibrance adds colour to the muted colours most, never above 0.2', () => {
    const quiet = gradeScheme(dune, 'saturation', 0.2);
    for (const k of ['paper', 'mass', 'accent']) expect(C(quiet[k])).toBeLessThan(C(dune[k as keyof typeof dune]) * 0.5);
    const loud = gradeScheme(dune, 'vibrance', 0.8);
    expect(C(loud.paper) / C(dune.paper)).toBeGreaterThan(C(loud.accent) / C(dune.accent));
    for (const h of Object.values(gradeScheme(jungle, 'vibrance', 1) as Record<string, string>)) expect(C(h)).toBeLessThanOrEqual(0.2 + 1e-3);
  });
  it('contrast brings everything toward the paper when quiet; brightness lightens only the paper', () => {
    const quiet = gradeScheme(jungle, 'contrast', 0.2);
    expect(quiet.paper).toBe(jungle.paper);
    expect(Math.abs(L(quiet.ink) - L(jungle.paper))).toBeLessThan(Math.abs(L(jungle.ink) - L(jungle.paper)));
    const lit = gradeScheme(dune, 'brightness', 0.8);
    expect(L(lit.paper)).toBeGreaterThan(L(dune.paper)); expect(lit.mass).toBe(dune.mass);
    expect(Object.keys(GRADES).sort()).toEqual(['both', 'brightness', 'contrast', 'saturation', 'vibrance']);
  });
});
