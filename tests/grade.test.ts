import {describe, expect, it} from 'vitest';
// @ts-expect-error: a plain module
import {GRADES, COLOUR_RESPONSES, SOFT, gradeScheme} from '../scripts/video/grade.js';

import {toOklch, fromOklch} from '../scripts/video/colour.js';

const dune = {paper: '#efe2cd', ink: '#3a2115', pencil: '#c4b197', mass: '#8c3a1c', accent: '#e39a1b', sun: '#d8622a', nightPaper: '#2a160d', nightInk: '#efe2cd'};
const jungle = {paper: '#0a170f', ink: '#f2efe0', pencil: '#484f4a', mass: '#92a86a', accent: '#ffa94f', sun: '#f1ebd5', nightPaper: '#0a170f', nightInk: '#f2efe0'};
const C = (h: string) => toOklch(h).C;
const V1 = 'vibranceSoftHalfPaper';

describe('colour responses to the ride’s intensity (grade.js)', () => {
  it('OKLCH round-trips every theme colour exactly', () => {
    for (const h of [...Object.values(dune), ...Object.values(jungle)]) expect(fromOklch(toOklch(h))).toBe(h);
  });
  it('a colour out of sRGB keeps its hue and lightness and loses chroma', () => {
    const c = toOklch(fromOklch({L: 0.7, C: 0.4, h: 0.5}));
    expect(c.L).toBeCloseTo(0.7, 2); expect(c.h).toBeCloseTo(0.5, 1); expect(c.C).toBeLessThan(0.4);
  });
  it('production has one response, besides plain', () => {
    expect(Object.keys(GRADES)).toEqual([V1]);
    expect(Object.keys(COLOUR_RESPONSES)).toEqual(['plain', V1]);
  });
  it('the soft-start curve passes through its points, rises without overshoot, and leaves 0.3 untouched', () => {
    expect(SOFT(0.3)).toBe(0); expect(SOFT(0.6)).toBeCloseTo(0.15, 9); expect(SOFT(0.9)).toBe(1); expect(SOFT(0.95)).toBe(1);
    for (let x = 0; x < 1; x += 0.01) {expect(SOFT(x + 0.01)).toBeGreaterThanOrEqual(SOFT(x) - 1e-12); expect(SOFT(x)).toBeLessThanOrEqual(1);}
  });
  it('vibrance leaves the normal part exactly as designed and adds colour only when intense, the paper half', () => {
    for (const I of [0, 0.3]) {expect(gradeScheme(dune, V1, I)).toEqual(dune); expect(gradeScheme(jungle, V1, I)).toEqual(jungle);}
    const loud = gradeScheme(dune, V1, 0.9);
    expect(C(loud.mass)).toBeGreaterThan(C(dune.mass)); expect(C(loud.paper)).toBeGreaterThan(C(dune.paper));
    // at full amount (0.9 and above) chroma C becomes C × (1 + 1.1 × w × (1 − C / 0.2)), w ½ for the paper (a muted colour, inside sRGB)
    expect(C(loud.paper)).toBeCloseTo(C(dune.paper) * (1 + 0.55 * (1 - C(dune.paper) / 0.2)), 3);
    for (const h of Object.values(gradeScheme(jungle, V1, 1) as Record<string, string>)) expect(C(h)).toBeLessThanOrEqual(0.2 + 1e-3);
    // a colour already above 0.2 is never lowered, at any intensity
    const vivid = {...dune, accent: '#ff4d3d'};
    for (const I of [0, 0.5, 1]) expect(C(gradeScheme(vivid, V1, I).accent)).toBeGreaterThanOrEqual(C(vivid.accent) - 1e-3);
  });
});
