// How a theme's colours answer the ride's intensity (look.paper). Pure: a scheme and an intensity (0–1, intensity.js) in, the
// scheme as it is drawn at that moment out. Each response owns its label, curve and transform.
// Whisper and Plain need no OKLCH transform; theme.js resolves them alongside drop treatments.
// Colour is worked in OKLCH and mapped into sRGB. Chroma increases stop at 0.2; colours already
// more vivid are not desaturated to enforce that cap (pigment, never neon: docs/TASTE.md).
import {toOklch, fromOklch} from './colour.js';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const CAP = 0.2, PAPER_TOKENS = new Set(['paper', 'pencil', 'tone', 'nightPaper']), TOKENS = ['paper', 'ink', 'pencil', 'mass', 'accent', 'sun', 'tone', 'nightPaper', 'nightInk'];
/** Vibrance: a colour's chroma C becomes C × (1 + k × w × amount × (1 − C / 0.2)), never above 0.2 and never below C. So a
 *  muted colour gains most (the paper, C ≈ 0.03, by k × 0.85), one at 0.2 nothing. k is the strength; w is 1 for what is drawn
 *  (track, bars, sun, hot note) and `paper` (0–1) for the paper and the pencilled course. */
const vibranceOf = (k, paper) => (c, _p, e, _isPaper, key) => {
  const w = PAPER_TOKENS.has(key) ? paper : 1;
  return {...c, C: Math.max(c.C, Math.min(CAP, c.C * (1 + k * w * e * Math.max(0, 1 - c.C / CAP))))};
};
// How the intensity becomes the effect's amount (0–1): round 32's responses rise across 0.2–0.8 (the normal part already
// changed); the later ones are 0 up to 0.45 (Circus Minimus: its verse 0.36, the start of its build 0.48) and full from 0.8,
// eased at both ends (smoothstep) so the effect fades in and out without a corner.
const smooth = x => x * x * (3 - 2 * x);
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
// Round 37's curves (round36.html): nothing up to 0.3, 15 % at 0.6 (the median moment of 22 production rides), full at 0.9 (above
// 99 % of their time); Softer: nothing up to 0.35, 8 % at 0.65, full at 0.92
export const SOFT = monotone([[0.3, 0], [0.6, 0.15], [0.9, 1]]), SOFTER = monotone([[0.35, 0], [0.65, 0.08], [0.92, 1]]);
export const EARLY = I => clamp((I - 0.2) / 0.6, 0, 1), LATE = I => smooth(clamp((I - 0.45) / 0.35, 0, 1)), TOP = I => smooth(clamp((I - 0.6) / 0.25, 0, 1));
// Each live lab response owns its label, intensity curve and colour transform together.
// R32: the theme arrives across 0.2–0.8. R34: only add when intense. R35–37: vary vibrance's
// start, strength and paper weight. These are still compared by the theme lab, not fallback paths.
const saturation = (c, _p, e) => ({...c, C: c.C * (0.45 + 0.55 * e)});
const contrast = (c, p, e, paper) => paper ? c : {...c, L: p.L + (c.L - p.L) * (0.62 + 0.38 * e)};
const contrastUp = (c, p, e, _paper, key) => !['ink', 'mass', 'nightInk'].includes(key) ? c
  : {...c, L: clamp(p.L + (c.L - p.L) * (1 + 0.3 * e), 0, 1)};
export const GRADES = {
  saturation: {label: "Saturation: muted when quiet, the colours arrive with the music", curve: EARLY, apply: saturation},
  vibrance: {label: "Vibrance: the muted colours gain colour with the music", curve: EARLY, apply: vibranceOf(1.1, 1)},
  contrast: {label: "Contrast: soft when quiet, full contrast with the music", curve: EARLY, apply: contrast},
  both: {label: "Saturation and contrast: soft and muted when quiet", curve: EARLY, apply: (c, p, e, paper) => contrast(saturation(c, p, e), p, e, paper)},
  brightness: {label: "Brightness: the paper lightens with the music", curve: EARLY, apply: (c, _p, e, paper) => (!paper ? c : c.L > 0.5 ? {L: c.L + (1 - c.L) * 0.7 * e, C: c.C * (1 - 0.6 * e), h: c.h} : {...c, L: c.L + 0.09 * e})},
  vibranceLate: {label: "Vibrance, only when intense, gentler", curve: LATE, apply: vibranceOf(0.75, 1)},
  vibranceKeepPaper: {label: "Vibrance, only when intense, the paper stays", curve: LATE, apply: vibranceOf(0.75, 0)},
  saturationUp: {label: "Saturation rising when intense", curve: LATE, apply: (c, _p, e) => ({...c, C: Math.max(c.C, Math.min(CAP, c.C * (1 + 0.35 * e)))})},
  contrastUp: {label: "Contrast rising when intense", curve: LATE, apply: contrastUp},
  vibranceContrast: {label: "Vibrance and contrast, when intense", curve: LATE, apply: (c, p, e, paper, key) => contrastUp(GRADES.vibranceLate.apply(c, p, e, paper, key), p, e, paper, key)},
  vibranceStrongHalfPaper: {label: "Vibrance from 0.45, strength 1.1, paper half", curve: LATE, apply: vibranceOf(1.1, 0.5)},
  vibranceStrongKeepPaper: {label: "Vibrance from 0.45, strength 1.1, paper stays", curve: LATE, apply: vibranceOf(1.1, 0)},
  vibranceTopHalfPaper: {label: "Vibrance from 0.6, strength 1.1, paper half", curve: TOP, apply: vibranceOf(1.1, 0.5)},
  vibranceTopKeepPaper: {label: "Vibrance from 0.6, strength 1.1, paper stays", curve: TOP, apply: vibranceOf(1.1, 0)},
  vibranceSoftHalfPaper: {label: "Vibrance, soft start, paper half (v1)", curve: SOFT, apply: vibranceOf(1.1, 0.5)},
  vibranceSoftKeepPaper: {label: "Vibrance, soft start, paper stays", curve: SOFT, apply: vibranceOf(1.1, 0)},
  vibranceSofterHalfPaper: {label: "Vibrance, softer, paper half", curve: SOFTER, apply: vibranceOf(1.1, 0.5)},
  vibranceSofterKeepPaper: {label: "Vibrance, softer, paper stays", curve: SOFTER, apply: vibranceOf(1.1, 0)},
};
/** The lab's colour choices, derived from the same records that render them. */
export const COLOUR_RESPONSES = {whisper: 'Whisper (tints very slightly with the ride’s intensity)', plain: 'Plain',
  ...Object.fromEntries(Object.entries(GRADES).map(([key, value]) => [key, value.label]))};
/** How much of a known effect (0–1) at intensity I; misspellings must not silently get a different curve. */
export const amountOf = (kind, I) => GRADES[kind].curve(I);

/** The scheme as drawn at the ride's intensity I (intensity.js) under response `kind` (a key of GRADES). */
export function gradeScheme(scheme, kind, I) {
  // the intensity is absolute, the same for every song (never a song's own percentiles): above 0.8 is rare (Circus Minimus: 0.36
  // in its verse, 0.79 at its most intense)
  const f = GRADES[kind].apply, i = amountOf(kind, I), out = {...scheme};
  const paper = toOklch(scheme.paper), night = scheme.nightPaper ? toOklch(scheme.nightPaper) : paper;  // night colours answer their own paper
  for (const k of TOKENS) if (scheme[k]) out[k] = fromOklch(f(toOklch(scheme[k]), k.startsWith('night') ? night : paper, i, k === 'paper' || k === 'nightPaper', k));
  return out;
}
