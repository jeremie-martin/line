// Assign Sanzo Wada's colour combinations to the lab's scheme roles, score them against the owner's verdicts, and keep the best.
//   /usr/bin/node wada.mjs            → candidates.json (all scored, best assignment per combination) + prints the top 40
// Roles: paper (flat background), ink (thin ridden line), pencil (paper → ink 30 %), mass (~55 bars), accent (loudest bars),
// nightPaper / nightInk (the drop). All judgements in OKLCH (L 0–1, C ~0–0.37, h degrees).
import {readFileSync, writeFileSync} from 'node:fs';

const here = new URL('.', import.meta.url).pathname;
const COLORS = JSON.parse(readFileSync(here + 'src/colors.json', 'utf8'));

// ── OKLCH ────────────────────────────────────────────────────────────────
const lin = c => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const gam = c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export function oklch(hex) {
  const [r, g, b] = hexRgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return {L, C: Math.hypot(A, B), h: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360};
}
function toRgb({L, C, h}) {
  const A = C * Math.cos(h * Math.PI / 180), B = C * Math.sin(h * Math.PI / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(gam);
}
// back to hex, reducing chroma until in gamut (keeps L and h, Wada's character)
export function hexOf({L, C, h}) {
  for (let c = C; c >= 0; c -= 0.002) {const v = toRgb({L, C: c, h}); if (v.every(x => x >= -0.5 && x <= 255.5)) return '#' + v.map(x => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0')).join('');}
  return '#' + toRgb({L, C: 0, h}).map(x => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0')).join('');
}
export const mixHex = (a, b, t) => {const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');};
const hueDist = (a, b) => {const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d;};
const warm = h => h >= 20 && h <= 100;            // red-orange … amber … gold
const cyanish = h => h >= 165 && h <= 235;        // verdigris, teal, cyan
const r3 = x => Math.round(x * 1000) / 1000;

// ── combinations ─────────────────────────────────────────────────────────
export const combos = {};
for (const c of COLORS) for (const n of c.combinations) (combos[n] ??= []).push({name: c.name, hex: c.hex.toLowerCase(), ...oklch(c.hex)});

// ── one assignment ───────────────────────────────────────────────────────
// Returns {score, scheme, notes[]} or null if a hard rule fails.
export function assign(cols, pi, mi, ai) {
  const notes = [], why = [];
  let P = {...cols[pi]}; const M0 = cols[mi], A0 = cols[ai];
  const rest = cols.filter((_, i) => i !== pi && i !== mi && i !== ai);
  const dark = P.L < 0.5;
  // Paper must be an extreme. Light ≥ .80 (lifted to ≥ .88 if needed), dark ≤ .32; mid-tone papers (.55–.80) only Kraft-like:
  // warm-ish, with some colour (near-neutral mid-tones looked dead), and still less colour than the bars.
  let mid = false;
  if (!dark && P.L < 0.80) {if (P.L < 0.6) return null; mid = true;}
  if (dark && P.L > 0.32) return null;
  let score = 0;
  if (P.C < 0.012 && P.L < 0.22) score -= 0.8;      // Wada's plain Black: a generic dark, Black already exists
  // the paper's chroma: the bars must carry more colour. Quiet it if needed (record).
  // Round 2 (after looking): light papers at C .035 read as tinted (yellow, mint, ice); only warm lights keep ~.03 (Dune .031).
  const lightCap = P.h > 40 && P.h < 95 ? 0.03 : 0.02;
  const capC = mid ? Math.min(0.07, M0.C * 0.5) : dark ? Math.min(0.035, M0.C * 0.5) : Math.min(lightCap, M0.C * 0.4);
  if (mid && P.C < 0.035) return null;               // mid-tone near-neutral: "dead"
  if (mid && P.h > 110 && P.h < 210) return null;    // mid-tone green/teal papers looked like coloured card, not paper (w247, w312, w219)
  if (P.C > capC) {
    if (mid && P.C > capC * 1.6) return null;         // a mid-tone paper is its colour; quietening it a lot kills it
    score -= Math.log2(P.C / capC) * 0.8;             // a strongly coloured paper loses its character when quietened
    notes.push(`paper chroma ${r3(P.C)}→${r3(capC)}`); P.C = capC;
  }
  if (!dark && !mid && P.L < 0.9) {if (P.L < 0.85) return null; notes.push(`paper L ${r3(P.L)}→0.92`); score -= (0.92 - P.L) * 6; P.L = 0.92;}
  if (dark && P.L > 0.24) {if (P.L > 0.29) return null; notes.push(`paper L ${r3(P.L)}→0.22`); score -= (P.L - 0.22) * 6; P.L = 0.22;}
  if (dark && P.L < 0.14) {notes.push(`paper L ${r3(P.L)}→0.16`); P.L = 0.16;}
  // Integration: paper near-neutral, or in the bars' hue family.
  const ph = hueDist(P.h, M0.h);
  if (P.C > 0.015 && ph > 50) {score -= (ph - 50) / 25; why.push('paper hue off the bars');}
  // Mass: more chroma than the paper, a clear but not harsh lightness step.
  let M = {...M0};
  if (M.C < 0.04) score -= 1.2;                       // grey bars: Graphite already does that
  const dLm = Math.abs(M.L - P.L);
  const [lo, hi] = mid ? [0.3, 0.5] : dark ? [0.32, 0.62] : [0.38, 0.6];
  if (dLm < lo) {
    const want = dark ? P.L + lo : P.L - lo;
    if (Math.abs(want - M.L) > 0.12) return null;
    notes.push(`bars L ${r3(M.L)}→${r3(want)}`); score -= Math.abs(want - M.L) * 5; M.L = want;
  } else if (dLm > hi) score -= (dLm - hi) * 8;      // harsh
  score += Math.min(M.C, 0.16) * 12;                   // colour in the band is the scheme's voice
  if (!dark && M.h > 95 && M.h < 135) score -= 1.5;    // olive / khaki bars on a light paper: the disliked Olive again
  if (mid && M.L > P.L) return null;                   // on a mid-tone paper the bars sit darker (Kraft); light bars glared (w240)
  // Accent: stands apart from the bars in lightness, not only hue; warm preferred; no cyan on brown, no fluorescent pink.
  let A = {...A0};
  const dLa = Math.abs(A.L - M.L);
  if (dLa < 0.12) {
    const want = M.L + (A.L >= M.L ? 0.15 : -0.15) * (dark ? 1 : 1);
    if (want > 0.92 || want < 0.25) return null;
    notes.push(`accent L ${r3(A.L)}→${r3(want)}`); score -= 0.6; A.L = want;
  }
  if (A.C < 0.08 && Math.abs(A.L - P.L) < 0.6) return null; // a grey accent that is not pure lightness: invisible
  if (Math.abs(A.L - P.L) < 0.2) score -= 1.5;         // accent melting into the paper (w302)
  score += Math.min(hueDist(A.h, M.h), 90) / 60;        // hue apart from the bars
  if (warm(A.h) && A.C > 0.09) score += 1.2;
  if (cyanish(A.h) && (warm(M.h) || M.h > 40 && M.h < 80)) score -= 3;      // "very bad"
  if ((A.h > 330 || A.h < 10) && A.C > 0.2 && M.h > 230 && M.h < 300) score -= 2;  // "aggressive"
  if (!dark && A.L > 0.9) score -= 0.8;
  // Disliked papers: saturated orange or green.
  if ((P.h > 40 && P.h < 75 || P.h > 120 && P.h < 170) && P.C > 0.06) return null;
  // Ink: the remaining colour if it contrasts strongly with the paper, else a near-black / near-white tinted to the bars.
  let ink = null;
  for (const r of rest) if (Math.abs(r.L - P.L) >= 0.62 && r.C < 0.16) {ink = {...r}; notes.push(`ink = ${r.name}`);}
  if (!ink) {
    ink = dark ? {L: 0.95, C: Math.min(0.02, M.C * 0.3), h: M.h} : {L: 0.24, C: Math.min(0.04, M.C * 0.4), h: M.h};
    notes.push('ink made: ' + (dark ? 'near-white' : 'near-black') + ' toward the bars');
  }
  if (rest.length && !notes.some(n => n.startsWith('ink ='))) score -= 0.4; // a Wada colour left unused
  const paper = hexOf(P), inkHex = hexOf(ink), mass = hexOf(M), accent = hexOf(A);
  const nightPaper = dark ? paper : hexOf({L: 0.19, C: Math.min(0.03, M.C * 0.4), h: M.h});
  const nightInk = dark ? inkHex : paper;
  return {score, why, notes, dark, mid, roles: {paper: P, mass: M, accent: A},
    scheme: {paper, ink: inkHex, pencil: mixHex(paper, inkHex, 0.3), mass, accent, nightPaper, nightInk},
    names: {paper: cols[pi].name, mass: M0.name, accent: A0.name, ink: notes.find(n => n.startsWith('ink ='))?.slice(6) ?? null},
    metrics: {paperC: r3(P.C), massC: r3(M.C), dL_paper_bars: r3(Math.abs(M.L - P.L)), dL_bars_accent: r3(Math.abs(A.L - M.L))}};
}

// ── main: score every 3- and 4-colour combination, keep the best assignment of each ─────────────────
if (process.argv[1] === new URL(import.meta.url).pathname) {
const out = [];
for (const [n, cols] of Object.entries(combos)) {
  if (cols.length < 3) continue;
  let best = null;
  for (let p = 0; p < cols.length; p++) for (let m = 0; m < cols.length; m++) for (let a = 0; a < cols.length; a++) {
    if (new Set([p, m, a]).size < 3) continue;
    const r = assign(cols, p, m, a);
    if (r && (!best || r.score > best.score)) best = r;
  }
  if (best) out.push({combo: +n, colours: cols.map(c => `${c.name} ${c.hex}`), ...best, score: r3(best.score)});
}
out.sort((a, b) => b.score - a.score);
writeFileSync(here + 'candidates.json', JSON.stringify(out, null, 1));
// keep ~40 with variety: at most 4 per bar-hue bucket of 30°, light and dark both represented
const pick = [], buckets = {};
for (const o of out) {
  const k = `${o.dark ? 'd' : 'l'}${Math.floor(o.roles.mass.h / 30)}`, black = o.names.paper === 'Black';
  if ((buckets[k] = (buckets[k] ?? 0) + 1) > 4 || black && (buckets.black = (buckets.black ?? 0) + 1) > 5) continue;
  pick.push(o); if (pick.length >= 40) break;
}
writeFileSync(here + 'shortlist.json', JSON.stringify(pick, null, 1));
console.log(`${out.length} combinations assignable of ${Object.values(combos).filter(c => c.length >= 3).length}`);
for (const o of pick) console.log(o.combo, o.score, o.dark ? 'D' : o.mid ? 'M' : 'L', JSON.stringify(o.names), o.notes.join('; '));
}
