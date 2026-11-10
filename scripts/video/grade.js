// How a theme's colours answer the ride's intensity (look.paper). Pure: a scheme and an intensity (0–1, intensity.js) in, the
// scheme as it is drawn at that moment out. One response is in production, vibrance on the soft-start curve with the paper half
// (R37, "a pure banger"); 'plain' draws the scheme as it is. The responses compared in rounds 3–37 (Whisper, saturation,
// contrast, brightness, the other vibrance curves) are in git history before 11 November.
// Colour is worked in OKLCH and mapped into sRGB. Chroma increases stop at 0.2; colours already
// more vivid are not desaturated to enforce that cap (pigment, never neon: docs/TASTE.md).
import {toOklch, fromOklch} from './colour.js';

const CAP = 0.2, PAPER_TOKENS = new Set(['paper', 'pencil']), TOKENS = ['paper', 'ink', 'pencil', 'mass', 'accent', 'sun'];
/** Vibrance: a colour's chroma C becomes C × (1 + k × w × amount × (1 − C / 0.2)), never above 0.2 and never below C. So a
 *  muted colour gains most (the paper, C ≈ 0.03, by k × 0.85), one at 0.2 nothing. k is the strength; w is 1 for what is drawn
 *  (track, bars, sun, hot note) and `paper` (0–1) for the paper and the pencilled course. */
const vibranceOf = (k, paper) => (c, e, key) => {
  const w = PAPER_TOKENS.has(key) ? paper : 1;
  return {...c, C: Math.max(c.C, Math.min(CAP, c.C * (1 + k * w * e * Math.max(0, 1 - c.C / CAP))))};
};
/** A smooth curve through points [x, y], rising, without overshoot or corner (monotone cubic, Fritsch–Carlson), flat outside. */
export function monotone(pts) {
  const n = pts.length, dx = [], m = [], t = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) {dx.push(pts[i + 1][0] - pts[i][0]); m.push((pts[i + 1][1] - pts[i][1]) / dx[i]);}
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  return x => {
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0; while (x > pts[i + 1][0]) i++;
    const h = dx[i], u = (x - pts[i][0]) / h;
    return (2 * u ** 3 - 3 * u ** 2 + 1) * pts[i][1] + (u ** 3 - 2 * u ** 2 + u) * h * t[i] + (-2 * u ** 3 + 3 * u ** 2) * pts[i + 1][1] + (u ** 3 - u ** 2) * h * t[i + 1];
  };
}
// Round 37's soft start (round36.html): nothing up to 0.3, 15 % at 0.6 (the median moment of 22 production rides), full at 0.9
// (above 99 % of their time)
export const SOFT = monotone([[0.3, 0], [0.6, 0.15], [0.9, 1]]);
/** Each response owns its label, intensity curve and colour transform together. */
export const GRADES = {
  vibranceSoftHalfPaper: {label: 'Vibrance, soft start, paper half (v1)', curve: SOFT, apply: vibranceOf(1.1, 0.5)},
};
/** The lab's colour choices, derived from the same records that render them. */
export const COLOUR_RESPONSES = {plain: 'Plain', ...Object.fromEntries(Object.entries(GRADES).map(([key, value]) => [key, value.label]))};
/** How much of a known effect (0–1) at intensity I; misspellings must not silently get a different curve. */
export const amountOf = (kind, I) => GRADES[kind].curve(I);

/** The scheme as drawn at the ride's intensity I (intensity.js) under response `kind` (a key of GRADES). */
export function gradeScheme(scheme, kind, I) {
  // the intensity is absolute, the same for every song (never a song's own percentiles): above 0.8 is rare (Circus Minimus: 0.36
  // in its verse, 0.79 at its most intense)
  const f = GRADES[kind].apply, i = amountOf(kind, I), out = {...scheme};
  for (const k of TOKENS) if (scheme[k]) out[k] = fromOklch(f(toOklch(scheme[k]), i, k));
  return out;
}
