// How a theme's colours answer the ride's intensity (look.paper). Pure: a scheme and an intensity (0–1, intensity.js) in, the
// scheme as it is drawn at that moment out. Whisper (only the paper tints, very slightly) and Plain (nothing moves) live in
// picture.js as before; these are the alternatives of round 32, each one clean idea, at full strength at the loudest moment.
// Colour is worked in OKLCH (perceptual: the same step looks the same in every hue); no colour ever leaves sRGB, and no chroma
// goes above 0.2 (pigment, never neon: docs/TASTE.md).
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lin = v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const enc = v => v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;

export function toOklch(hex) {
  const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return {L, C: Math.hypot(A, B), h: Math.atan2(B, A)};
}
const rgbOf = (L, C, h) => {
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
};
/** OKLCH to hex; out of sRGB, the chroma is reduced (the hue and lightness kept), as a printer would. */
export function fromOklch({L, C, h}) {
  L = clamp(L, 0, 1);
  const inside = rgb => rgb.every(v => v >= -1e-6 && v <= 1 + 1e-6);
  let rgb = rgbOf(L, Math.max(0, C), h);
  if (!inside(rgb)) {  // the largest chroma inside sRGB, by bisection
    let lo = 0, hi = Math.max(0, C);
    for (let k = 0; k < 24; k++) {const mid = (lo + hi) / 2; if (inside(rgbOf(L, mid, h))) lo = mid; else hi = mid;}
    rgb = rgbOf(L, lo, h);
  }
  return '#' + rgb.map(v => Math.round(clamp(enc(clamp(v, 0, 1)), 0, 1) * 255).toString(16).padStart(2, '0')).join('');
}

const CAP = 0.2, PAPERS = new Set(['paper', 'pencil', 'tone', 'nightPaper']), TOKENS = ['paper', 'ink', 'pencil', 'mass', 'accent', 'sun', 'tone', 'nightPaper', 'nightInk'];
/** Vibrance: a colour's chroma C becomes C × (1 + k × w × amount × (1 − C / 0.2)), never above 0.2 and never below C. So a
 *  muted colour gains most (the paper, C ≈ 0.03, by k × 0.85), one at 0.2 nothing. k is the strength; w is 1 for what is drawn
 *  (track, bars, sun, hot note) and `paper` (0–1) for the paper and the pencilled course. */
const vibranceOf = (k, paper) => (c, _p, e, isPaper, key) => {
  const w = isPaper || PAPERS.has(key) ? paper : 1;
  return {...c, C: Math.max(c.C, Math.min(CAP, c.C * (1 + k * w * e * Math.max(0, 1 - c.C / CAP))))};
};
/** Each response: (colour, the paper's colour, amount 0–1 (CURVE), is it the paper, which token) → colour, all OKLCH. At the loudest moment (I = 1)
 *  the "swelling" ones go beyond the theme's own colours, the "arriving" ones reach them. */
export const GRADES = {
  // Saturation: in quiet parts every colour is muted (about half its chroma); the theme's own colours arrive with the music
  saturation: (c, _p, I) => ({...c, C: c.C * (0.45 + 0.55 * I)}),
  // Vibrance: with the music, the muted colours (paper, bars, line) gain colour, much more than those already vivid
  vibrance: vibranceOf(1.1, 1),
  // Contrast: in quiet parts everything sits closer to the paper's lightness; the full contrast arrives with the music
  contrast: (c, p, I, isPaper) => (isPaper ? c : {...c, L: p.L + (c.L - p.L) * (0.62 + 0.38 * I)}),
  // Saturation and contrast together: quiet parts are soft and muted, the theme arrives whole with the music
  both: (c, p, I, isPaper) => GRADES.contrast(GRADES.saturation(c, p, I), p, I, isPaper),
  // Brightness: the light comes up with the music: the paper lightens (a light paper toward white, a dark one a little)
  brightness: (c, _p, I, isPaper) => (!isPaper ? c : c.L > 0.5 ? {L: c.L + (1 - c.L) * 0.7 * I, C: c.C * (1 - 0.6 * I), h: c.h} : {...c, L: c.L + 0.09 * I}),

  // Round 34, after the owner's round 33 (vibrance on all five themes, "by a huge margin"; "the normal version should not be changed
  // by all this effect"): every response leaves the normal part exactly as designed and only adds when the ride is intense (LATE)
  // Vibrance, later and gentler: as round 33's, about two thirds as strong
  vibranceLate: vibranceOf(0.75, 1),
  // Vibrance on what is drawn, the paper stays (Cyanotype's paper went "a bit too much blue"): bars, line, sun and hot note only
  vibranceKeepPaper: vibranceOf(0.75, 0),
  // Saturation, rising: every colour gains chroma alike (a third more at the most intense), never above 0.2
  saturationUp: (c, _p, e) => ({...c, C: Math.max(c.C, Math.min(CAP, c.C * (1 + 0.35 * e)))}),
  // Contrast, rising: the track and the bars move away from the paper's lightness (up to 30 % further); the sun and the hot note
  // keep theirs (pushed toward white or black they lost their colour)
  contrastUp: (c, p, e, _isPaper, key) => (key !== 'ink' && key !== 'mass' && key !== 'nightInk' ? c : {...c, L: clamp(p.L + (c.L - p.L) * (1 + 0.3 * e), 0, 1)}),
  // Vibrance and contrast together, both only when intense
  vibranceContrast: (c, p, e, isPaper, key) => GRADES.contrastUp(GRADES.vibranceLate(c, p, e, isPaper, key), p, e, isPaper, key),

  // Round 35, after round 34 ("the vibrance will win"; the paper kept "very strong"; a mix of rounds 33 and 34 likely): vibrance
  // only, its three settings apart: when it starts (LATE from 0.45, TOP from 0.6), its strength k, what the paper does
  vibranceStrongHalfPaper: vibranceOf(1.1, 0.5), vibranceStrongKeepPaper: vibranceOf(1.1, 0),
  vibranceTopHalfPaper: vibranceOf(1.1, 0.5), vibranceTopKeepPaper: vibranceOf(1.1, 0),
};
// How the intensity becomes the effect's amount (0–1): round 32's responses rise across 0.2–0.8 (the normal part already
// changed); the later ones are 0 up to 0.45 (Circus Minimus: its verse 0.36, the start of its build 0.48) and full from 0.8,
// eased at both ends (smoothstep) so the effect fades in and out without a corner.
const smooth = x => x * x * (3 - 2 * x);
export const EARLY = I => clamp((I - 0.2) / 0.6, 0, 1), LATE = I => smooth(clamp((I - 0.45) / 0.35, 0, 1)), TOP = I => smooth(clamp((I - 0.6) / 0.25, 0, 1));
const CURVE = {vibranceLate: LATE, vibranceKeepPaper: LATE, saturationUp: LATE, contrastUp: LATE, vibranceContrast: LATE,
  vibranceStrongHalfPaper: LATE, vibranceStrongKeepPaper: LATE, vibranceTopHalfPaper: TOP, vibranceTopKeepPaper: TOP};
/** How much of the effect (0–1) at intensity I. */
export const amountOf = (kind, I) => (CURVE[kind] ?? EARLY)(I);

/** The scheme as drawn at the ride's intensity I (intensity.js) under response `kind` (a key of GRADES). */
export function gradeScheme(scheme, kind, I) {
  // the intensity is absolute, the same for every song (never a song's own percentiles): above 0.8 is rare (Circus Minimus: 0.36
  // in its verse, 0.79 at its most intense)
  const f = GRADES[kind], i = amountOf(kind, I), out = {...scheme};
  const paper = toOklch(scheme.paper), night = scheme.nightPaper ? toOklch(scheme.nightPaper) : paper;  // night colours answer their own paper
  for (const k of TOKENS) if (scheme[k]) out[k] = fromOklch(f(toOklch(scheme[k]), k.startsWith('night') ? night : paper, i, k === 'paper' || k === 'nightPaper', k));
  return out;
}
