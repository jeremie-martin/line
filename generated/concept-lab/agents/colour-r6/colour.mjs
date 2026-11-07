// Colour maths shared by measure.mjs: sRGB, OKLab/OKLCH, WCAG, APCA (0.0.98G-4g), BT.709 luma, CVD (Machado 2009, severity 1).
export const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
export const hexOf = c => '#' + c.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
export const lin = c => c.map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
export const unlin = c => c.map(v => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055));
export const mixHex = (a, b, u) => hexOf(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * u)); // as lab.js does, in sRGB
export function oklabLin([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export const oklab = h => oklabLin(lin(rgb(h)));
export const lch = h => {const [L, a, b] = oklab(h); return [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];};
export const dE = (x, y) => {const p = oklab(x), q = oklab(y); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);};
export const dC = (x, y) => {const p = oklab(x), q = oklab(y); return Math.hypot(p[1] - q[1], p[2] - q[2]);}; // chromatic part only
export const Ylum = h => {const [r, g, b] = lin(rgb(h)); return 0.2126 * r + 0.7152 * g + 0.0722 * b;};
export const wcag = (a, b) => {const [x, y] = [Ylum(a), Ylum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05);};
export function apca(txt, bg) { // signed Lc; |Lc| is what matters here (polarity: + dark on light)
  const Y = h => {const [r, g, b] = rgb(h); let y = 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.072175 * b ** 2.4; return y < 0.022 ? y + (0.022 - y) ** 1.414 : y;};
  const t = Y(txt), b = Y(bg);
  if (b > t) {const S = (b ** 0.56 - t ** 0.57) * 1.14; return S < 0.1 ? 0 : (S - 0.027) * 100;}
  const S = (b ** 0.65 - t ** 0.62) * 1.14; return S > -0.1 ? 0 : (S + 0.027) * 100;
}
// BT.709 luma Y' (gamma-encoded, what a 4:2:0 video keeps at full resolution), 0–255
export const luma = h => {const [r, g, b] = rgb(h); return 255 * (0.2126 * r + 0.7152 * g + 0.0722 * b);};
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
export const sim = (h, k) => {const c = lin(rgb(h)); return hexOf(unlin(CVD[k].map(r => r[0] * c[0] + r[1] * c[1] + r[2] * c[2])));};
export const cvdMin = (a, b) => Math.min(...Object.keys(CVD).map(k => dE(sim(a, k), sim(b, k))));
// OKLCH → hex (h in degrees); throws if out of sRGB gamut so drafts stay honest.
export function fromLch(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const c = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  if (c.some(v => v < -0.002 || v > 1.002)) throw new Error(`out of gamut ${L} ${C} ${h}`);
  return hexOf(unlin(c));
}
