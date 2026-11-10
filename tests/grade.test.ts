import {describe, expect, it} from 'vitest';
// @ts-expect-error: a plain module
import {GRADES, gradeScheme} from '../scripts/video/grade.js';

import {toOklch, fromOklch} from '../scripts/video/colour.js';

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
    expect(Object.keys(GRADES)).toEqual(expect.arrayContaining(['both', 'brightness', 'contrast', 'saturation', 'vibrance']));
  });
  it('the round-34 responses leave the normal part exactly as designed and only add when intense', async () => {
    for (const k of ['vibranceLate', 'vibranceKeepPaper', 'saturationUp', 'contrastUp', 'vibranceContrast']) {
      for (const I of [0, 0.36, 0.45]) {expect(gradeScheme(dune, k, I)).toEqual(dune); expect(gradeScheme(jungle, k, I)).toEqual(jungle);}
      expect(gradeScheme(dune, k, 0.8)).not.toEqual(dune);
      for (const h of Object.values(gradeScheme(dune, k, 1) as Record<string, string>)) expect(C(h)).toBeLessThanOrEqual(0.2 + 1e-3);
    }
    // gentler than round 33's vibrance at the same intensity, and the paper stays when asked
    expect(C(gradeScheme(dune, 'vibranceLate', 0.8).paper)).toBeLessThan(C(gradeScheme(dune, 'vibrance', 0.8).paper));
    const kept = gradeScheme(dune, 'vibranceKeepPaper', 0.8);
    expect(kept.paper).toBe(dune.paper); expect(kept.pencil).toBe(dune.pencil); expect(C(kept.mass)).toBeGreaterThan(C(dune.mass));
    // a colour already above 0.2 is never lowered, at any intensity
    const loud = {...dune, accent: '#ff4d3d'};
    for (const k of ['vibrance', 'vibranceLate', 'vibranceStrongKeepPaper', 'saturationUp']) for (const I of [0, 0.5, 1]) expect(C(gradeScheme(loud, k, I).accent)).toBeGreaterThanOrEqual(C(loud.accent) - 1e-3);
    // round 35: the paper half or kept; the later start leaves 0.6 untouched
    const half = gradeScheme(dune, 'vibranceStrongHalfPaper', 0.8), full = gradeScheme(dune, 'vibrance', 0.8);
    expect(C(half.paper)).toBeGreaterThan(C(dune.paper)); expect(C(half.paper)).toBeLessThan(C(full.paper));
    expect(gradeScheme(dune, 'vibranceStrongKeepPaper', 0.8).paper).toBe(dune.paper);
    expect(gradeScheme(dune, 'vibranceTopHalfPaper', 0.6)).toEqual(dune);
    // round 37: the soft-start curves pass through their points, rise without overshoot, and leave 0.3 untouched
    // @ts-expect-error: a plain module
    const {SOFT, SOFTER} = await import('../scripts/video/grade.js');
    expect(SOFT(0.3)).toBe(0); expect(SOFT(0.6)).toBeCloseTo(0.15, 9); expect(SOFT(0.9)).toBe(1); expect(SOFT(0.95)).toBe(1); expect(SOFTER(0.65)).toBeCloseTo(0.08, 9);
    for (let x = 0; x < 1; x += 0.01) {expect(SOFT(x + 0.01)).toBeGreaterThanOrEqual(SOFT(x) - 1e-12); expect(SOFT(x)).toBeLessThanOrEqual(1); expect(SOFTER(x)).toBeGreaterThanOrEqual(0);}
    expect(gradeScheme(dune, 'vibranceSoftKeepPaper', 0.3)).toEqual(dune);
    // contrast rising moves the line away from the paper
    expect(Math.abs(L(gradeScheme(jungle, 'contrastUp', 0.8).mass) - L(jungle.paper))).toBeGreaterThan(Math.abs(L(jungle.mass) - L(jungle.paper)));
  });
});
