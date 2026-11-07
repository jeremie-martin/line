// Pass 2 of the Wada schemes: more variety, above all light papers in other hues than cream.
//   /usr/bin/node curate2.mjs        → schemes.js (finalists only: WADA2 + WADA_FIX) + a metrics table
//   /usr/bin/node curate2.mjs all    → schemes.js with every candidate (for rendering in ../mock)
// Same conventions as ../curate.mjs: each role names a colour of one Wada combination; adjustments are absolute OKLCH targets.
// 'made' = not in the combination: a near-black / near-white tinted toward the bars (ink), or a dark of the bars' hue (night).
import {writeFileSync} from 'node:fs';
import {combos, hexOf, mixHex, oklch} from '../wada.mjs';

const here = new URL('.', import.meta.url).pathname;
const pale = (C = 0.018, L = 0.95) => ({L, C});   // a pale paper derived from a combination colour: its hue, raised and quietened
export const SPEC = [
  // ── LIGHT, papers in other hues than cream ──
  {key: 'c152', combo: 152, paper: ['Light Glaucous Blue', pale()], mass: ["Hay's Russet"], accent: ['Etruscan Red', {L: 0.72, C: 0.15}], ink: ['made', {L: 0.24, C: 0.04, h: 32}]},
  {key: 'c204', combo: 204, paper: ['Light Glaucous Blue', pale()], mass: ['Rosolanc Purple'], accent: ['Cinnamon Rufous', {L: 0.74}], ink: ['made', {L: 0.24, C: 0.04, h: 357}]},
  {key: 'c339a', combo: 339, paper: ['Light Glaucous Blue', pale()], mass: ['English Red', {L: 0.56}], accent: ['Ochraceous Salmon'], ink: ['Violet Blue', {L: 0.26}]},
  {key: 'c339b', combo: 339, paper: ['Light Glaucous Blue', pale()], mass: ['Violet Blue', {L: 0.45}], accent: ['English Red'], ink: ['made', {L: 0.23, C: 0.04, h: 277}]},
  {key: 'c341', combo: 341, paper: ['Light Glaucous Blue', pale()], mass: ['Cossack Green'], accent: ['Grenadine Pink'], ink: ['Deep Slate Olive', {L: 0.24}]},
  {key: 'c196', combo: 196, paper: ["Pale King's Blue", pale()], mass: ['Blue Violet'], accent: ['Citron Yellow'], ink: ['made', {L: 0.23, C: 0.04, h: 293}]},
  {key: 'c234', combo: 234, paper: ["Pale King's Blue", pale()], mass: ['Pale Raw Umber'], accent: ['Cinnamon Buff', {L: 0.78, C: 0.13}], ink: ['made', {L: 0.23, C: 0.03, h: 65}]},
  {key: 'c142', combo: 142, paper: ['Salvia Blue', pale()], mass: ['Hydrangea Red'], accent: ['Sulphine Yellow', {L: 0.75}], ink: ['made', {L: 0.24, C: 0.04, h: 14}]},
  {key: 'c212', combo: 212, paper: ['Salvia Blue', pale()], mass: ['Pompeian Red'], accent: ['Orange Citrine', {L: 0.73}], ink: ['made', {L: 0.23, C: 0.04, h: 18}]},
  {key: 'c345', combo: 345, paper: ['Nile Blue', pale()], mass: ["Hay's Russet"], accent: ['Blue Violet', {L: 0.6}], ink: ['made', {L: 0.23, C: 0.04, h: 32}]},
  {key: 'c250', combo: 250, paper: ['Nile Blue', pale()], mass: ['Peach Red', {L: 0.58}], accent: ['Pyrite Yellow'], ink: ['made', {L: 0.24, C: 0.04, h: 36}]},
  {key: 'c147', combo: 147, paper: ['Turquoise Green', pale()], mass: ['Vandyke Red', {L: 0.45}], accent: ['Spinel Red'], ink: ['made', {L: 0.23, C: 0.04, h: 27}]},
  {key: 'c285', combo: 285, paper: ['Turquoise Green', pale()], mass: ['Burnt Sienna'], accent: ['Peach Red', {L: 0.7}], ink: ['made', {L: 0.24, C: 0.04, h: 45}]},
  {key: 'c263', combo: 263, paper: ['Turquoise Green', pale()], mass: ['Burnt Sienna'], accent: ['Pinkish Cinnamon', {L: 0.76, C: 0.12}], ink: ['Slate Color', {L: 0.25}]},
  {key: 'c171', combo: 171, paper: ['Glaucous Green', pale(0.016)], mass: ['Pale Burnt Lake', {L: 0.45}], accent: ['Yellow Orange'], ink: ['made', {L: 0.23, C: 0.04, h: 24}]},
  {key: 'c260', combo: 260, paper: ['Glaucous Green', pale(0.016)], mass: ['Old Rose', {L: 0.58}], accent: ['Sea Green', {L: 0.72}], ink: ['made', {L: 0.24, C: 0.04, h: 13}]},
  {key: 'c264', combo: 264, paper: ['Corinthian Pink', pale()], mass: ['Cerulian Blue', {L: 0.52}], accent: ['Red Orange', {L: 0.66}], ink: ['made', {L: 0.23, C: 0.04, h: 220}]},
  {key: 'c128', combo: 128, paper: ['Corinthian Pink', pale()], mass: ['Venice Green', {L: 0.55}], accent: ['Light Mauve', {L: 0.7}], ink: ['made', {L: 0.23, C: 0.035, h: 189}]},
  {key: 'c194', combo: 194, paper: ['Seashell Pink', pale(0.02)], mass: ['Olympic Blue', {L: 0.5}], accent: ['Jasper Red', {L: 0.66}], ink: ['made', {L: 0.23, C: 0.04, h: 254}]},
  {key: 'c338a', combo: 338, paper: ['Grayish Lavender - B', pale(0.016)], mass: ['Dusky Green', {L: 0.42}], accent: ['Orange Yellow', {L: 0.78}], ink: ['made', {L: 0.23, C: 0.035, h: 182}]},
  {key: 'c338b', combo: 338, paper: ['Grayish Lavender - B', pale(0.016)], mass: ['Dusky Green', {L: 0.42}], accent: ['Carmine Red', {L: 0.6}], ink: ['made', {L: 0.23, C: 0.035, h: 182}]},
  {key: 'c307', combo: 307, paper: ['Grayish Lavender - A', pale(0.016)], mass: ['Cotinga Purple', {L: 0.4}], accent: ['Carmine', {L: 0.6}], ink: ['made', {L: 0.22, C: 0.04, h: 336}]},
  {key: 'c197', combo: 197, paper: ['Neutral Gray', {L: 0.955, C: 0.008}], mass: ['Dark Soft Violet'], accent: ['Eosine Pink'], ink: ['made', {L: 0.23, C: 0.04, h: 286}]},
  {key: 'c180', combo: 180, paper: ['Neutral Gray', {L: 0.955, C: 0.008}], mass: ['Light Mauve', {L: 0.52}], accent: ['Cinnamon Buff', {L: 0.78, C: 0.13}], ink: ['made', {L: 0.23, C: 0.04, h: 316}]},
  {key: 'c324', combo: 324, paper: ['Neutral Gray', {L: 0.955, C: 0.008}], mass: ['Pompeian Red'], accent: ['Aconite Violet', {L: 0.68}], ink: ['Olympic Blue', {L: 0.25}]},
  {key: 'c333', combo: 333, paper: ['Cobalt Green', pale(0.016)], mass: ['Blue'], accent: ['Burnt Sienna', {L: 0.65}], ink: ['made', {L: 0.23, C: 0.04, h: 248}]},
  // ── MID ──
  {key: 'm191', combo: 191, paper: ['Light Brown Drab', {L: 0.7, C: 0.045}], mass: ['Blue', {L: 0.4}], accent: ['Yellow Ocher', {L: 0.85}], ink: ['made', {L: 0.2, C: 0.035, h: 248}]},
  {key: 'm125', combo: 125, paper: ['Fawn', {L: 0.74, C: 0.045}], mass: ['Violet Blue', {L: 0.36}], accent: ['Cerulian Blue', {L: 0.84}], ink: ['made', {L: 0.2, C: 0.035, h: 277}]},
  {key: 'm308', combo: 308, paper: ['Fawn', {L: 0.74, C: 0.045}], mass: ['Scarlet', {L: 0.46}], accent: ['Cobalt Green', {L: 0.88}], ink: ['made', {L: 0.2, C: 0.035, h: 20}]},
  // ── DARK ──
  {key: 'd181', combo: 181, paper: ['Cotinga Purple', {L: 0.19, C: 0.04}], mass: ['Violet', {L: 0.52}], accent: ['Carmine Red', {L: 0.64}], ink: ['made', {L: 0.95, C: 0.015, h: 291}]},
  {key: 'd232', combo: 232, paper: ['Deep Indigo', {L: 0.19, C: 0.035}], mass: ['Carmine'], accent: ['Pinkish Cinnamon'], ink: ['made', {L: 0.95, C: 0.012, h: 20}]},
  {key: 'd344', combo: 344, paper: ['Deep Lyons Blue', {L: 0.19, C: 0.04}], mass: ['Aconite Violet'], accent: ['Cinnamon Buff'], ink: ['made', {L: 0.95, C: 0.015, h: 326}]},
  {key: 'd253', combo: 253, paper: ['Slate Color', {L: 0.2, C: 0.02}], mass: ['Apricot Orange', {L: 0.66}], accent: ['Lemon Yellow'], ink: ['made', {L: 0.95, C: 0.012, h: 49}]},
  {key: 'd332', combo: 332, paper: ['Deep Slate Olive', {L: 0.2, C: 0.025}], mass: ['Scarlet'], accent: ['Coral Red'], ink: ['made', {L: 0.95, C: 0.012, h: 20}]},
  {key: 'd166', combo: 166, paper: ['Deep Slate Green', {L: 0.21, C: 0.025}], mass: ['Grenadine Pink', {L: 0.64}], accent: ['Naples Yellow'], ink: ['made', {L: 0.95, C: 0.012, h: 33}]},
  {key: 'd136', combo: 136, paper: ['Red Violet', {L: 0.19, C: 0.04}], mass: ['Dull Viridian Green'], accent: ['Scarlet', {L: 0.7}], ink: ['made', {L: 0.95, C: 0.012, h: 162}]},
  {key: 'd297', combo: 297, paper: ['Violet Blue', {L: 0.19, C: 0.04}], mass: ['Burnt Sienna', {L: 0.58}], accent: ['Yellow Orange'], ink: ['made', {L: 0.95, C: 0.012, h: 45}]},
  {key: 'd164', combo: 164, paper: ['Violet', {L: 0.19, C: 0.04}], mass: ['Red Orange'], accent: ['Orange Yellow'], ink: ['made', {L: 0.95, C: 0.012, h: 32}]},
  {key: 'd179', combo: 179, paper: ['Deep Lyons Blue', {L: 0.19, C: 0.04}], mass: ['Red Orange'], accent: ['Golden Yellow'], ink: ['made', {L: 0.95, C: 0.012, h: 32}]},
  {key: 'd157', combo: 157, paper: ['Pansy Purple', {L: 0.19, C: 0.04}], mass: ['Olympic Blue'], accent: ['Olive Ocher'], ink: ['made', {L: 0.95, C: 0.012, h: 254}]},
  {key: 'd236', combo: 236, paper: ['Deep Lyons Blue', {L: 0.19, C: 0.04}], mass: ['Purple Drab', {L: 0.56}], accent: ['Khaki', {L: 0.76}], ink: ['made', {L: 0.95, C: 0.012, h: 12}]},
  {key: 'd186', combo: 186, paper: ["Hay's Russet", {L: 0.19, C: 0.035}], mass: ['Blue', {L: 0.55}], accent: ['Ochraceous Salmon'], ink: ['made', {L: 0.95, C: 0.012, h: 58}]},
  {key: 'd161', combo: 161, paper: ['Brown', {L: 0.19, C: 0.03}], mass: ['Helvetia Blue', {L: 0.55}], accent: ['Pinkish Cinnamon'], ink: ['made', {L: 0.95, C: 0.012, h: 63}]},
  {key: 'd314', combo: 314, paper: ['Dusky Madder Violet', {L: 0.19, C: 0.04}], mass: ['Deep Lyons Blue', {L: 0.52}], accent: ['Eosine Pink'], ink: ['made', {L: 0.95, C: 0.012, h: 329}]},
  {key: 'd348', combo: 348, paper: ['Cotinga Purple', {L: 0.19, C: 0.04}], mass: ['Cossack Green', {L: 0.56}], accent: ['Olive Buff'], ink: ['made', {L: 0.95, C: 0.012, h: 336}]},
  // drop partners: the dark of a light finalist, from the same combination
  {key: 'd338', combo: 338, paper: ['Dusky Green', {L: 0.2, C: 0.03}], mass: ['Carmine Red', {L: 0.56}], accent: ['Orange Yellow'], ink: ['made', {L: 0.95, C: 0.012, h: 21}]},
  {key: 'd307', combo: 307, paper: ['Cotinga Purple', {L: 0.19, C: 0.04}], mass: ['Carmine', {L: 0.56}], accent: ['Grayish Lavender - A', {L: 0.82, C: 0.07}], ink: ['made', {L: 0.95, C: 0.012, h: 336}]},
  {key: 'd147', combo: 147, paper: ['Vandyke Red', {L: 0.19, C: 0.035}], mass: ['Spinel Red', {L: 0.6}], accent: ['Turquoise Green', {L: 0.85, C: 0.07}], ink: ['made', {L: 0.95, C: 0.012, h: 7}]},
];
// Brick (no. 325) fix candidates: the ochre accent sat at the paper's lightness (Yellow Ocher L .79 on paper .945).
export const BRICK = {paper: ['Naples Yellow', {L: 0.945, C: 0.03, h: 85}], mass: ['Eugenia Red | B', {L: 0.54, C: 0.16}], ink: ['Deep Slate Green', {L: 0.24}],
  night: ['Deep Slate Green', {L: 0.21, C: 0.025}, 'Naples Yellow'], combo: 325};
const BRICK_TRY = {bA: {L: 0.72, C: 0.15}, bB: {L: 0.68, C: 0.15, h: 78}, bC: {L: 0.64, C: 0.14, h: 72}, bD: {L: 0.7, C: 0.16, h: 80}};
for (const [k, adj] of Object.entries(BRICK_TRY)) SPEC.push({key: k, ...BRICK, accent: ['Yellow Ocher', adj]});

const r3 = x => Math.round(x * 1000) / 1000;
export function build(s) {
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
  const NP = s.night && role('night paper', s.night.slice(0, 2)), NI = s.night && role('night ink', [s.night[2]]);
  const nightPaper = NP ? NP.hex : dark ? P.hex : hexOf({L: 0.19, C: Math.min(0.035, M.lch.C * 0.4), h: M.lch.h});
  const scheme = {paper: P.hex, ink: K.hex, pencil: mixHex(P.hex, K.hex, 0.3), mass: M.hex, accent: A.hex, nightPaper, nightInk: NI ? NI.hex : dark ? K.hex : P.hex};
  const m = Object.fromEntries(Object.entries({paper: P.hex, ink: K.hex, mass: M.hex, accent: A.hex}).map(([k, v]) => [k, oklch(v)]));
  return {...s, scheme, notes, names: {paper: P.name, mass: M.name, accent: A.name, ink: K.name === 'made' ? null : K.name}, m};
}
const tok = o => JSON.stringify(o).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ').replace(/"/g, '\'');

// The finalists, light first. key → [lab key, name, one-line character, drop partner (or null)]. The rest of SPEC was killed on sight.
export const FINAL = {
  c152: ['w2Etruscan', 'Etruscan', 'Ice-blue paper, an oxblood-russet band, one salmon-red bar: warm earth under a cold sky.', null],
  c204: ['w2Peony', 'Peony', 'Ice-blue paper, a magenta band, one apricot bar: Magenta in daylight.', null],
  c234: ['w2Umber', 'Umber', 'Pale sky paper, a raw-umber band, one buff-gold bar: coffee and air, the quietest.', null],
  c142: ['w2Hydrangea', 'Hydrangea', 'Periwinkle-grey paper, a rose-red band, one mustard bar: Brick on a cool page.', null],
  c171: ['w2Celadon', 'Celadon', 'Celadon paper, a maroon band, one marigold bar: glaze and lacquer.', null],
  c260: ['w2Camellia', 'Camellia', 'Celadon paper, an old-rose band, one sea-green bar: soft, the accent the only cool note.', null],
  c264: ['w2Blush', 'Blush', 'Blush paper, a cerulean band, one red-orange bar: the warm paper Lagoon never had.', null],
  c338a: ['w2Heather', 'Heather', 'Mauve-blush paper, a dusky green band, one orange-yellow bar; its night is Heather Night.', 'w2HeatherNight'],
  c307: ['w2Aubergine', 'Aubergine', 'Lilac paper, an aubergine band, one carmine bar; its night is Aubergine Night.', 'w2AubergineNight'],
  c197: ['w2Wisteria', 'Wisteria', 'Near-white cool grey, a soft violet band, one eosine-pink bar: the whitest page.', null],
  c333: ['w2Cobalt', 'Cobalt', 'Mint-white paper, a pure blue band, one burnt-sienna bar: Klein in spring.', null],
  c194: ['w2Seashell', 'Seashell', 'Peach-shell paper, a slate-blue band, one jasper-red bar: Hokusai on a pinker page.', null],
  d232: ['w2Carmine', 'Carmine', 'Deep indigo, a carmine band, one pale cinnamon bar: red velvet at night.', null],
  d344: ['w2Aconite', 'Aconite', 'Navy-violet black, an orchid band, one buff bar: Old Rose\'s cooler sister.', null],
  d253: ['w2Apricot', 'Apricot', 'Slate black, an apricot band, one lemon bar: the brightest dark.', null],
  d166: ['w2Grenadine', 'Grenadine', 'Bottle-green black, a coral band, one Naples-yellow bar: Gilt\'s pink twin.', null],
  d157: ['w2Pansy', 'Pansy', 'Wine black, an Olympic-blue band, one gold bar: blue on red-black, unexpected and calm.', null],
  d186: ['w2Saxe', 'Saxe', 'Russet-brown black, a pure blue band, one salmon bar: Café with a blue band.', null],
  d338: ['w2HeatherNight', 'Heather Night', 'Drop partner of Heather (no. 338): dusky-green black, a carmine band, the same orange-yellow bar.', 'w2Heather'],
  d307: ['w2AubergineNight', 'Aubergine Night', 'Drop partner of Aubergine (no. 307): aubergine black, a carmine band, a lavender bar.', 'w2Aubergine'],
};
export const BRICK_PICK = 'bD';

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const built = SPEC.map(build), by = Object.fromEntries(built.map(b => [b.key, b]));
  const all = process.argv[2] === 'all';
  const cmt = (b, name, line, drop) => {
    let t = `  // ${name} — Wada no. ${b.combo} (${combos[b.combo].map(c => c.name).join(', ')}).\n`;
    t += `  //   paper ${b.names.paper} · bars ${b.names.mass} · accent ${b.names.accent} · ink ${b.names.ink ?? 'made'}${b.notes.length ? ' · adjusted: ' + b.notes.join('; ') : ''}\n`;
    return t + `  //   ${line}${drop ? ` Drop partner: ${drop}.` : ''}\n`;
  };
  let js = '// Pass 2 of the Wada schemes (Sanzo Wada, A Dictionary of Color Combinations, 1933–34): more variety, above all light papers\n' +
    '// in other hues than cream. Generated by curate2.mjs (roles and adjustments are listed there). Tokens as in lab.js SCHEMES.\n' +
    '// "made" = a colour not in the combination: a near-black / near-white tinted toward the bars. Light schemes first.\n' +
    '// A pale paper "derived" from a combination colour keeps that colour\'s hue, raised to L ≈ .95 and quietened to C ≈ .016–.02.\nexport const WADA2 = {\n';
  for (const [k, [key, name, line, drop]] of Object.entries(FINAL)) js += cmt(by[k], name, line, drop) + `  ${key}: ${tok(by[k].scheme)},\n`;
  if (all) for (const b of built) if (!FINAL[b.key]) js += `  ${b.key}: ${tok(b.scheme)},\n`;
  js += '};\nexport const WADA2_NAMES = ' + JSON.stringify(Object.fromEntries(Object.values(FINAL).map(([k, n]) => [k, n]))).replace(/"/g, '\'') + ';\n';
  js += '// Drop partners (the night of a light scheme = a darker scheme from the same combination), for DROPS in lab.js.\n';
  js += 'export const WADA2_DROPS = ' + JSON.stringify(Object.fromEntries(Object.values(FINAL).filter(f => f[3] && !f[1].endsWith('Night')).map(f => [f[0], f[3]]))).replace(/"/g, '\'') + ';\n';
  const b = by[BRICK_PICK];
  js += '\n// Round-10 fix: Brick\'s accent (Yellow Ocher, L .79) sat at the cream paper\'s lightness and read as background. Lowered to L .70 and\n' +
    '// deepened (C .16, h 80): a deeper ochre-gold, parted .25 L from the paper and .16 from the bars. Everything else as in ../schemes.js.\n' +
    'export const WADA_FIX = {\n' + cmt(b, 'Brick (fixed)', 'Naples-yellow cream, a rose-brick band, one deep ochre-gold bar, the line in deep slate green.', 'wGilt (no. 325)') + `  wBrick: ${tok(b.scheme)},\n};\n`;
  writeFileSync(here + 'schemes.js', js);
  for (const b of built) console.log((FINAL[b.key]?.[0] ?? b.key).padEnd(18), `paper L ${r3(b.m.paper.L)} C ${r3(b.m.paper.C)}  bars C ${r3(b.m.mass.C)}  ΔL paper/bars ${r3(Math.abs(b.m.paper.L - b.m.mass.L))} bars/accent ${r3(Math.abs(b.m.mass.L - b.m.accent.L))} paper/accent ${r3(Math.abs(b.m.paper.L - b.m.accent.L))}`);
}
