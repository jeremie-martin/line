// Clarity measures for every lab scheme (read from ../../lab.js, never edited) and the candidates in ./schemes.js.
// Run: /usr/bin/node measure.mjs [--json]
import {readFileSync} from 'node:fs';
import * as K from './colour.mjs';
import {CANDIDATES} from './schemes.js';

const src = readFileSync(new URL('../../lab.js', import.meta.url), 'utf8');
const LAB = Function('return ' + src.match(/const SCHEMES = (\{[\s\S]*?\n\});/)[1])();
const RATING = {graphite: 5, hokusai: 5, black: 5, lagoon: 4, riso: 3.5, dune: 5, plum: 3.5}; // round 5; plum later "so freaking good"
const SCARF = ['#fd4f38', '#3995fd', '#06a725']; // the native sprite's scarf stripes (round4-ideas)

export function measure(p) {
  const lc = (a, b) => Math.abs(K.apca(a, b)), [Lp, Cp] = K.lch(p.paper), dark = Lp < 0.5;
  const night = {nightPaper: p.nightPaper, nightInk: p.nightInk, pencil: K.mixHex(p.nightPaper, p.nightInk, 0.38)};
  const pencilBlend = K.mixHex(p.pencil, p.ink, 0); // pencil drawn opaque
  return {
    dark, paperL: Lp, paperC: Cp, paperH: K.lch(p.paper)[2],
    ink: lc(p.ink, p.paper), inkW: K.wcag(p.ink, p.paper), inkLuma: Math.abs(K.luma(p.ink) - K.luma(p.paper)), inkC: K.lch(p.ink)[1],
    pencil: lc(pencilBlend, p.paper), pencilLuma: Math.abs(K.luma(p.pencil) - K.luma(p.paper)),
    step: lc(p.ink, p.paper) - lc(p.pencil, p.paper), // how far ink stands above pencil
    accent: lc(p.accent, p.paper), accentDE: K.dE(p.accent, p.paper), accentC: K.lch(p.accent)[1],
    accMass: K.dE(p.accent, p.mass), accMassCvd: K.cvdMin(p.accent, p.mass), accMassLc: lc(p.accent, p.mass),
    mass: lc(p.mass, p.paper), massC: K.lch(p.mass)[1], inkL: K.lch(p.ink)[0],
    accMassDL: Math.abs(K.lch(p.accent)[0] - K.lch(p.mass)[0]),
    // vibration: two chromatic colours touching at near-equal lightness (riso's pink bar beside blue bars). Higher = buzzier.
    vib: Math.min(K.lch(p.accent)[1], K.lch(p.mass)[1]) / (Math.abs(K.lch(p.accent)[0] - K.lch(p.mass)[0]) + 0.05),
    // colour load: chroma of what covers most of the frame (paper) and of the band, the largest coloured mass
    load: K.lch(p.paper)[1] + 0.5 * K.lch(p.mass)[1],
    riderLo: Math.min(lc('#000000', p.paper), lc('#ffffff', p.paper)), riderHi: Math.max(lc('#000000', p.paper), lc('#ffffff', p.paper)),
    scarfMin: Math.min(...SCARF.map(s => K.dE(s, p.paper))),
    sun: p.sun ? lc(p.sun, p.paper) : null,
    nightInk: lc(night.nightInk, night.nightPaper), nightPencil: lc(night.pencil, night.nightPaper), nightAcc: lc(p.accent, night.nightPaper),
    nightC: K.lch(p.nightPaper)[1],
  };
}
// The provisional guardrail (see REPORT.md). Returns the list of failures.
export const GUARD = {
  light: {paperL: 0.91, paperC: 0.035, inkL: 0.30, inkC: 0.10, pencil: [18, 40]},
  dark: {paperL: 0.24, paperC: 0.045, inkL: 0.92, inkC: 0.10, pencil: [12, 30]},
  ink: 85, step: 50, massC: 0.13, mass: 40, accMassDL: 0.12, accMass: 0.15, accMassCvd: 0.08, accent: 25, rider: 85, nightInk: 80,
};
export function guard(m) {
  const g = GUARD, s = m.dark ? g.dark : g.light, f = [], t = (bad, msg) => bad && f.push(msg);
  t(m.dark ? m.paperL > s.paperL : m.paperL < s.paperL, `paper L ${m.paperL.toFixed(2)}`);
  t(m.paperC > s.paperC, `paper C ${m.paperC.toFixed(3)}`);
  t(m.dark ? m.inkL < s.inkL : m.inkL > s.inkL, `ink L ${m.inkL.toFixed(3)}`);
  t(m.inkC > s.inkC, `ink C ${m.inkC.toFixed(3)}`);
  t(m.ink < g.ink, `ink Lc ${m.ink.toFixed(0)}`);
  t(m.pencil < s.pencil[0] || m.pencil > s.pencil[1], `pencil Lc ${m.pencil.toFixed(0)}`);
  t(m.step < g.step, `ink−pencil ${m.step.toFixed(0)}`);
  t(m.massC > g.massC, `band C ${m.massC.toFixed(3)}`);
  t(m.mass < g.mass, `band Lc ${m.mass.toFixed(0)}`);
  t(m.accMassDL < g.accMassDL, `accent/band ΔL ${m.accMassDL.toFixed(3)}`);
  t(m.accMass < g.accMass, `accent/band ΔE ${m.accMass.toFixed(2)}`);
  t(m.accMassCvd < g.accMassCvd, `accent/band CVD ΔE ${m.accMassCvd.toFixed(2)}`);
  t(m.accent < g.accent, `accent Lc ${m.accent.toFixed(0)}`);
  t(m.riderHi < g.rider, `rider Lc ${m.riderHi.toFixed(0)}`);
  t(m.nightInk < g.nightInk, `night ink Lc ${m.nightInk.toFixed(0)}`);
  return f;
}
const rank = xs => {const o = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]), r = []; let i = 0; while (i < o.length) {let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2; i = j + 1;} return r;};
const pearson = (x, y) => {const n = x.length, mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n; let s = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) {s += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2;} return s / Math.sqrt(sx * sy);};
const spearman = (x, y) => pearson(rank(x), rank(y));

if (import.meta.url === `file://${process.argv[1]}`) {
  const all = {...LAB, ...CANDIDATES}, rows = Object.entries(all).map(([k, p]) => [k, measure(p)]);
  if (process.argv.includes('--json')) {console.log(JSON.stringify(Object.fromEntries(rows), null, 1)); process.exit(0);}
  const cols = ['paperL', 'paperC', 'ink', 'inkW', 'inkLuma', 'inkC', 'pencil', 'step', 'accent', 'accentC', 'accMass', 'accMassCvd', 'mass', 'massC', 'accMassDL', 'vib', 'load', 'inkL', 'riderHi', 'riderLo', 'nightInk', 'nightAcc'];
  const fmt = v => v == null ? '-' : typeof v === 'boolean' ? String(v) : Math.abs(v) < 1 ? v.toFixed(3) : v.toFixed(1);
  console.log(['scheme', 'rate', ...cols, 'guard'].join('\t'));
  for (const [k, m] of rows) console.log([k, RATING[k] ?? '', ...cols.map(c => fmt(m[c])), guard(m).join('; ') || 'pass'].join('\t'));
  const rated = rows.filter(([k]) => k in RATING);
  for (const drop of [null, 'plum']) {
    const r = rated.filter(([k]) => k !== drop), y = r.map(([k]) => RATING[k]);
    console.log(`\nSpearman with the rating (n=${r.length}${drop ? ', without ' + drop : ''}):`);
    console.log(cols.concat(['paperL']).filter((c, i, a) => a.indexOf(c) === i).map(c => `${c} ${spearman(r.map(([, m]) => m[c]), y).toFixed(2)}`).join('  '));
  }
}
