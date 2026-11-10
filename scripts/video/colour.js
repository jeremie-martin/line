// Colour arithmetic: sRGB mixing and gamut-mapped OKLCH. No theme or rendering state.
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

export const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
export const mixHex = (a, b, t) => {const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, '0')).join('');};
