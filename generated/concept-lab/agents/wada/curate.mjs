// The curated Wada schemes: each role names a colour of one Wada combination, with any OKLCH adjustment written out.
//   /usr/bin/node curate.mjs   → schemes.js (lab token format) + a metrics table on stdout
// Adjustments are absolute OKLCH targets ({L, C, h}) for the fields given; everything else is Wada's own value.
// 'made' = not in the combination: a near-black / near-white tinted toward the bars (ink), or a dark of the bars' hue (night).
import {writeFileSync} from 'node:fs';
import {combos, hexOf, mixHex, oklch} from './wada.mjs';

const here = new URL('.', import.meta.url).pathname;
export const SPEC = [
  // LIGHT
  {key: 'wPrussian', name: 'Prussian', combo: 343, line: 'Hokusai\'s sea-green cousin: ivory, a deep Prussian teal band, one burnt-sienna bar.',
    paper: ['Ivory Buff', {L: 0.935, C: 0.026}], mass: ["Vandar Poel's Blue"], accent: ['Burnt Sienna', {L: 0.63}], ink: ['made', {L: 0.25, C: 0.04, h: 234}]},
  {key: 'wBrick', name: 'Brick', combo: 325, line: 'Naples-yellow cream, a rose-brick band, one ochre bar, the line in Wada\'s deep slate green; its night is Gilt.',
    paper: ['Naples Yellow', {L: 0.945, C: 0.03, h: 85}], mass: ['Eugenia Red | B', {L: 0.54, C: 0.16}], accent: ['Yellow Ocher'], ink: ['Deep Slate Green', {L: 0.24}],
    night: ['Deep Slate Green', {L: 0.21, C: 0.025}, 'Naples Yellow']},
  {key: 'wOrchid', name: 'Orchid', combo: 315, line: 'Cream, an orchid band, a marigold bar: Lavender\'s warmer, pinker sister.',
    paper: ['Sulpher Yellow', {L: 0.95, C: 0.018}], mass: ['Eupatorium Purple', {L: 0.55}], accent: ['Golden Yellow'], ink: ['made', {L: 0.24, C: 0.04, h: 348}]},
  {key: 'wVerdigris', name: 'Verdigris', combo: 266, line: 'Ivory, a verdigris band, one vermilion bar: a cooler band on a warm page.',
    paper: ['Ivory Buff', {L: 0.935, C: 0.026}], mass: ['Benzol Green', {L: 0.52}], accent: ['Spectrum Red', {L: 0.66}], ink: ['made', {L: 0.24, C: 0.035, h: 187}]},
  // MID
  {key: 'wDenim', name: 'Denim', combo: 279, line: 'Kraft\'s blue twin: ecru card, a navy band, one pale cinnamon bar like white ink.',
    paper: ['Ecru', {L: 0.74, C: 0.052}], mass: ['Dark Tyrian Blue'], accent: ['Vinaceous Cinnamon', {L: 0.88}], ink: ['made', {L: 0.2, C: 0.035, h: 243}]},
  {key: 'wRusset', name: 'Russet', combo: 249, line: 'Ecru card, an oxblood-russet band, one ochre-gold bar: Kraft dressed warmer.',
    paper: ['Ecru', {L: 0.74}], mass: ["Hay's Russet"], accent: ['Olive Ocher', {L: 0.82}], ink: ['made', {L: 0.2, C: 0.03, h: 32}]},
  // DARK
  {key: 'wMagenta', name: 'Magenta', combo: 144, line: 'A near-black page, a deep magenta band, one orange bar: Plum turned up.',
    paper: ['Black', {L: 0.18, C: 0.014, h: 357}], mass: ['Rosolanc Purple'], accent: ['Orange', {L: 0.74}], ink: ['made', {L: 0.95, C: 0.015, h: 357}]},
  {key: 'wViridian', name: 'Viridian', combo: 256, line: 'Green-black, a viridian band, one pale cinnamon bar: a night garden.',
    paper: ['Black', {L: 0.18, C: 0.014, h: 162}], mass: ['Dull Viridian Green', {L: 0.56}], accent: ['Vinaceous Cinnamon'], ink: ['made', {L: 0.95, C: 0.012, h: 162}]},
  {key: 'wUltramarine', name: 'Ultramarine', combo: 295, line: 'Violet-black, a pure blue band, one cream-yellow bar: deep and clear.',
    paper: ['Dull Violet Black', {L: 0.2, C: 0.04}], mass: ['Blue'], accent: ['Cream Yellow'], ink: ['made', {L: 0.95, C: 0.015, h: 270}]},
  {key: 'wOldRose', name: 'Old Rose', combo: 265, line: 'Violet-black, an old-rose band, one yellow bar: dusk in a velvet room.',
    paper: ['Dull Violet Black', {L: 0.2, C: 0.04}], mass: ['Old Rose', {L: 0.62}], accent: ['Apricot Yellow', {L: 0.88, C: 0.15, h: 88}], ink: ['made', {L: 0.95, C: 0.015, h: 13}]},
  {key: 'wIndigoTeal', name: 'Indigo Teal', combo: 155, line: 'Deep indigo, a teal band, one coral bar: Midnight with the sea in it.',
    paper: ['Deep Indigo', {L: 0.19, C: 0.035}], mass: ['Benzol Green', {L: 0.57}], accent: ['Jasper Red', {L: 0.74}], ink: ['made', {L: 0.95, C: 0.012, h: 230}]},
  {key: 'wGilt', name: 'Gilt', combo: 325, line: 'Bottle-green black, an ochre-gold band, a rose-red bar, the line in Naples yellow.',
    paper: ['Deep Slate Green', {L: 0.21, C: 0.025}], mass: ['Yellow Ocher', {L: 0.72}], accent: ['Eugenia Red | B', {L: 0.56}], ink: ['Naples Yellow']},
];

const r3 = x => Math.round(x * 1000) / 1000;
function build(s) {
  const cols = combos[s.combo], notes = [];
  const role = (r, [name, adj = {}]) => {
    const c = name === 'made' ? {L: 0, C: 0, h: 0} : cols.find(c => c.name === name);
    if (!c) throw new Error(`${s.key}: ${name} not in combination ${s.combo}`);
    const o = {L: c.L, C: c.C, h: c.h, ...adj};
    if (name !== 'made' && Object.keys(adj).length) notes.push(`${r} ${Object.entries(adj).map(([k, v]) => `${k} ${r3(c[k])}→${v}`).join(', ')}`);
    return {name, lch: o, hex: name !== 'made' && !Object.keys(adj).length ? c.hex : hexOf(o)};
  };
  const P = role('paper', s.paper), M = role('mass', s.mass), A = role('accent', s.accent), K = role('ink', s.ink);
  const dark = P.lch.L < 0.5;
  // night: the given Wada pair (paper, ink), else a dark of the bars' hue with the paper as its line (dark schemes keep themselves)
  const NP = s.night && role('night paper', s.night.slice(0, 2)), NI = s.night && role('night ink', [s.night[2]]);
  const nightPaper = NP ? NP.hex : dark ? P.hex : hexOf({L: 0.19, C: Math.min(0.035, M.lch.C * 0.4), h: M.lch.h});
  const scheme = {paper: P.hex, ink: K.hex, pencil: mixHex(P.hex, K.hex, 0.3), mass: M.hex, accent: A.hex, nightPaper, nightInk: NI ? NI.hex : dark ? K.hex : P.hex};
  const m = Object.fromEntries(Object.entries({paper: P.hex, ink: K.hex, mass: M.hex, accent: A.hex}).map(([k, v]) => [k, oklch(v)]));
  return {...s, scheme, notes, names: {paper: P.name, mass: M.name, accent: A.name, ink: K.name === 'made' ? null : K.name}, m};
}

const built = SPEC.map(build);
let js = '// Colour schemes from Sanzo Wada, A Dictionary of Color Combinations (1933–34), assigned to the lab\'s roles.\n' +
  '// Generated by curate.mjs (roles and adjustments are listed there); wada.mjs is the scoring pass that found the candidates.\n' +
  '// Tokens as in lab.js SCHEMES: paper, ink (ridden line), pencil (paper → ink 30 %), mass (bars), accent (loudest bars), night.\n' +
  '// "made" = a colour not in the combination: a near-black / near-white tinted toward the bars.\nexport const WADA = {\n';
for (const b of built) {
  js += `  // ${b.name} — Wada no. ${b.combo} (${combos[b.combo].map(c => c.name).join(', ')}).\n`;
  js += `  //   paper ${b.names.paper} · bars ${b.names.mass} · accent ${b.names.accent} · ink ${b.names.ink ?? 'made'}${b.notes.length ? ' · adjusted: ' + b.notes.join('; ') : ''}\n`;
  js += `  //   ${b.line}\n  ${b.key}: ${JSON.stringify(b.scheme).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ').replace(/"/g, '\'')},\n`;
}
js += '};\nexport const WADA_NAMES = ' + JSON.stringify(Object.fromEntries(built.map(b => [b.key, b.name]))).replace(/"/g, '\'') + ';\n';
writeFileSync(here + 'schemes.js', js);
for (const b of built) console.log(b.key.padEnd(14), `paperC ${r3(b.m.paper.C)} barsC ${r3(b.m.mass.C)}  ΔL paper/ink ${r3(Math.abs(b.m.paper.L - b.m.ink.L))} paper/bars ${r3(Math.abs(b.m.paper.L - b.m.mass.L))} bars/accent ${r3(Math.abs(b.m.mass.L - b.m.accent.L))}`);
