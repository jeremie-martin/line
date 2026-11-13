// Round 45: every theme of the collection with five variations, one page per theme (owner, 2026-11-13).
//   node generated/concept-lab/round45.mjs   → candidates-refine1.json (open /generated/concept-lab/?set=refine1&q=1)
// A variation overrides colours (hex, or [L, C, h] in OKLCH) and look options of the theme as it is. When only the ground changes,
// the pencil follows it (same distance from the ground as in the theme).
import {writeFileSync} from 'node:fs';
import {COLLECTION} from '../../scripts/video/collection.js';

// OKLCH ↔ hex; out-of-gamut colours lose chroma until they fit
const lin = c => {c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;};
const gam = c => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
function toLch(hex) {
  const n = parseInt(hex.slice(1), 16), r = lin(n >> 16), g = lin(n >> 8 & 255), b = lin(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180 / Math.PI + 360) % 360];
}
function toHex([L, C, h]) {
  for (let c = C, i = 0; i < 80; i++, c *= 0.97) {
    const A = c * Math.cos(h * Math.PI / 180), B = c * Math.sin(h * Math.PI / 180);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const v = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    if (v.every(x => x >= -0.0005 && x <= 1.0005)) return '#' + v.map(x => gam(Math.min(1, Math.max(0, x))).toString(16).padStart(2, '0')).join('');
  }
  return '#000000';
}
const colour = v => typeof v === 'string' ? v : toHex(v);

// [label, note, colours, look] per variation; the theme as it is always comes first
const V = {
  jungleMoon: ['Jungle Moon', [
    ['Greener night', 'The ground carries more green; the rest as it is.', {paper: [0.21, 0.035, 158], nightPaper: [0.21, 0.035, 158]}],
    ['Leaf bars', 'The bars leave sage for a fresher leaf green.', {mass: [0.74, 0.13, 132]}],
    ['Golden moon', 'The moon in pale gold.', {sun: [0.90, 0.09, 90]}],
    ['Harvest moon', 'The moon takes the apricot of the hot bar.', {sun: '#ffa94f'}],
    ['Lagoon', 'A cousin: teal-black night, jade bars, a coral hot bar.', {paper: [0.20, 0.035, 195], mass: [0.74, 0.09, 168], accent: [0.72, 0.17, 35]}],
  ]],
  jungleMoonVermilion: ['Jungle Moon, vermilion', [
    ['Moss bars', 'Darker moss bars, so the vermilion stands out more.', {mass: [0.58, 0.085, 128]}],
    ['Hibiscus', 'The hot bar in hibiscus pink instead of vermilion.', {accent: [0.68, 0.21, 2]}],
    ['Red moon', 'The moon in a soft vermilion.', {sun: [0.70, 0.16, 36]}],
    ['Moonlit bars', 'Cream bars, like the moon; the vermilion alone carries colour.', {mass: [0.86, 0.04, 95]}],
    ['Olive gold', 'A deeper night with olive-gold bars.', {paper: [0.17, 0.02, 150], mass: [0.72, 0.10, 105]}],
  ]],
  rothko: ['Rothko', [
    ['Deeper maroon', 'The room carries more red.', {paper: [0.23, 0.045, 15], nightPaper: [0.23, 0.045, 15]}],
    ['Orange-red bars', 'The bars more luminous, toward orange.', {mass: [0.62, 0.175, 36]}],
    ['Plum room', 'The ground in plum, the bars and gold as they are.', {paper: [0.22, 0.05, 340], nightPaper: [0.22, 0.05, 340]}],
    ['Pale sun', 'The sun in pale cream-yellow, the hot bar still gold.', {sun: [0.93, 0.07, 88]}],
    ['Orange field', 'Deep orange bars and a pale yellow note: Rothko’s orange and yellow.', {mass: [0.66, 0.15, 48], accent: [0.92, 0.12, 95]}],
  ]],
  cyanotype: ['Cyanotype', [
    ['Deep Prussian', 'A darker, truer blueprint blue.', {paper: [0.33, 0.085, 256]}],
    ['More blue', 'The same lightness, a more saturated blue.', {paper: [0.42, 0.10, 258]}],
    ['White bars', 'The bars in print white, like a blueprint’s lines.', {mass: [0.93, 0.02, 250]}],
    ['White sun', 'A paper-white sun; the yellow only on the hot bar.', {sun: [0.96, 0.015, 94]}],
    ['Orange sun', 'The complement: an orange sun and hot bar.', {accent: [0.76, 0.165, 58]}],
  ]],
  ceruleanCoral: ['Cerulean and Coral', [
    ['With a sun', 'A lemon sun instead of the title.', {}, {top: 'sun'}],
    ['Deeper ground', 'The slate-teal darker.', {paper: [0.30, 0.035, 225]}],
    ['More cerulean', 'The ground a clearer blue.', {paper: [0.42, 0.075, 232]}],
    ['Redder coral', 'The bars a deeper, redder coral.', {mass: [0.68, 0.175, 38]}],
    ['Deep, with a sun', 'The deeper ground and a lemon sun.', {paper: [0.30, 0.035, 225]}, {top: 'sun'}],
  ]],
  cobaltChartreuse: ['Cobalt and Chartreuse', [
    ['True cobalt', 'The bars deeper and more saturated.', {mass: [0.56, 0.175, 264]}],
    ['Navy night', 'The ground carries more blue.', {paper: [0.22, 0.06, 268], nightPaper: [0.22, 0.06, 268]}],
    ['Lime', 'The chartreuse lighter and more yellow.', {accent: [0.87, 0.16, 113], sun: [0.87, 0.16, 113]}],
    ['White moon', 'A pale moon; the chartreuse only on the hot bar.', {sun: [0.93, 0.015, 94]}],
    ['Ultramarine', 'A cousin: an ultramarine ground, pale bars, the chartreuse.', {paper: [0.31, 0.12, 268], nightPaper: [0.31, 0.12, 268], mass: [0.82, 0.06, 262]}],
  ]],
  lilyLeaf: ['Lily White and Leaf Green', [
    ['Lily sun', 'The sun in lily white; the green only on the hot bar.', {sun: [0.92, 0.035, 92]}],
    ['Fresh green', 'The green lighter and fresher.', {accent: [0.78, 0.165, 136], sun: [0.78, 0.165, 136]}],
    ['Emerald', 'The green cooler, toward emerald.', {accent: [0.68, 0.125, 158], sun: [0.68, 0.125, 158]}],
    ['Deeper pond', 'The ground carries more teal.', {paper: [0.24, 0.045, 202], nightPaper: [0.24, 0.045, 202]}],
    ['Water lily', 'A cousin: pale pink bars, the leaf green.', {mass: [0.83, 0.06, 8]}],
  ]],
  oldRose: ['Old Rose', [
    ['With a sun', 'A gold sun instead of the title.', {}, {top: 'sun'}],
    ['Brighter rose', 'The bars a more vivid rose.', {mass: [0.68, 0.155, 10]}],
    ['Dusty pink', 'The bars lighter and softer.', {mass: [0.77, 0.085, 10]}],
    ['Aubergine', 'The ground warmer, toward aubergine.', {paper: [0.21, 0.045, 332], nightPaper: [0.21, 0.045, 332]}],
    ['Rose sun', 'A pale rose sun; the gold only on the hot bar.', {sun: [0.86, 0.06, 14]}, {top: 'sun'}],
  ]],
  blackIris: ['Black Iris', [
    ['Thin strands', 'The band in thin strands.', {}, {irisWeight: 'thin'}],
    ['Warm black', 'The ground a warm black.', {paper: [0.18, 0.015, 50], nightPaper: [0.18, 0.015, 50]}],
    ['With a moon', 'A pale moon at the top.', {sun: [0.93, 0.012, 255]}, {top: 'sun'}],
    ['Midnight', 'A blue-black ground.', {paper: [0.20, 0.04, 265], nightPaper: [0.20, 0.04, 265]}],
    ['Bars', 'A cousin: pale grey bars with the red hot bar, instead of the Iris band.', {}, {band: 'bars'}],
  ]],
  violetMarigold: ['Violet and Marigold', [
    ['Deeper dusk', 'The ground darker.', {paper: [0.21, 0.05, 292]}],
    ['More violet', 'The ground carries more violet.', {paper: [0.29, 0.085, 295]}],
    ['Orange bars', 'The bars from vermilion to orange.', {mass: [0.69, 0.17, 48]}],
    ['Magenta bars', 'The bars from vermilion to magenta.', {mass: [0.59, 0.20, 352]}],
    ['Pale sun', 'The sun and hot bar a paler yellow.', {accent: [0.90, 0.14, 96]}],
  ]],
  giltAmber: ['Gilt and Amber', [
    ['With a sun', 'An amber sun instead of the title.', {}, {top: 'sun'}],
    ['Gilt sun', 'A pale gilt sun; the amber only on the hot bar.', {sun: [0.86, 0.08, 86]}, {top: 'sun'}],
    ['Richer gold', 'The bars a more saturated gold.', {mass: [0.80, 0.125, 86]}],
    ['Ember', 'The hot bar in red-orange.', {accent: [0.66, 0.195, 38]}],
    ['Tortoiseshell', 'A deep brown ground instead of black.', {paper: [0.23, 0.035, 50], nightPaper: [0.23, 0.035, 50]}],
  ]],
  negoro: ['Negoro Lacquer', [
    ['With a sun', 'A persimmon sun instead of the title.', {}, {top: 'sun'}],
    ['Lacquer red', 'The hot bar in true lacquer red.', {accent: [0.56, 0.205, 27]}],
    ['Red-black', 'The lacquer ground carries a little red.', {paper: [0.19, 0.035, 25], nightPaper: [0.19, 0.035, 25]}],
    ['Gold leaf', 'The bars in gold leaf instead of cream.', {mass: [0.81, 0.115, 86]}],
    ['Red lacquer', 'A cousin: red lacquer bars, a gold hot bar and sun.', {mass: [0.53, 0.175, 28], accent: [0.84, 0.14, 84]}, {top: 'sun'}],
  ]],
  forestGold: ['Forest Green and Gold', [
    ['Deeper forest', 'The ground darker.', {paper: [0.22, 0.04, 182]}],
    ['Greener', 'The ground from teal toward a true green.', {paper: [0.27, 0.04, 165]}],
    ['Coral pink', 'The bars lighter and softer.', {mass: [0.71, 0.135, 20]}],
    ['Crimson', 'The bars deeper.', {mass: [0.52, 0.185, 20]}],
    ['Cream bars', 'Cream bars, a rose-red hot bar, the gold sun.', {mass: [0.87, 0.05, 90], accent: '#da525d'}],
  ]],
  amberPurple: ['Amber and Purple', [
    ['Purple bars', 'The bars in aubergine purple, as the name says.', {mass: [0.36, 0.10, 322]}],
    ['Whiter paper', 'The paper nearer white.', {paper: [0.975, 0.008, 97]}],
    ['Deeper amber', 'The sun and hot bar toward orange.', {accent: [0.71, 0.175, 55], sun: [0.71, 0.175, 55]}],
    ['Lighter blue', 'The bars a lighter, clearer blue.', {mass: [0.52, 0.10, 236]}],
    ['All ink', 'The whole course inked from the start.', {}, {line: 'ink'}],
  ]],
  hokusai: ['Hokusai', [
    ['Brighter Prussian', 'The bars a more vivid Prussian blue.', {mass: [0.43, 0.13, 257]}],
    ['Whiter washi', 'The paper nearer white.', {paper: [0.975, 0.01, 85]}],
    ['Print sky', 'The paper a deeper buff, like the print’s sky.', {paper: [0.915, 0.03, 85]}],
    ['Crimson sun', 'The sun and hot bar a deeper red.', {accent: [0.52, 0.19, 27]}],
    ['Steady zoom', 'The camera holds its zoom when the song is quiet.', {}, {zoom: 'steady'}],
  ]],
  dune: ['Dune', [
    ['Paler sand', 'The sand lighter.', {paper: [0.955, 0.022, 80]}],
    ['Terracotta', 'The bars redder and lighter.', {mass: [0.54, 0.145, 36]}],
    ['Dark rust', 'The bars deeper and browner.', {mass: [0.38, 0.09, 42]}],
    ['One amber', 'The sun takes the amber of the hot bar.', {sun: '#e39a1b'}],
    ['Sky', 'A cousin: a turquoise hot bar over the sand, the orange sun.', {accent: [0.60, 0.09, 205]}],
  ]],
  silverRust: ['Silver and Rust', [
    ['Lighter ground', 'The ivory-buff lighter.', {paper: [0.93, 0.025, 86]}],
    ['Deeper olive', 'The bars darker and greener.', {mass: [0.41, 0.075, 115]}],
    ['Silver bars', 'The bars in a cool silver grey.', {mass: [0.56, 0.02, 200]}],
    ['Brighter rust', 'The sun and hot bar more vivid.', {accent: [0.65, 0.165, 42], sun: [0.60, 0.165, 42]}],
    ['Rust bars', 'A cousin: rust bars, an olive-gold hot bar and sun.', {mass: [0.52, 0.135, 42], accent: [0.76, 0.13, 96], sun: [0.76, 0.13, 96]}],
  ]],
  paper: ['Paper', [
    ['Ivory', 'A warm white page.', {paper: [0.98, 0.013, 90], tone: [0.95, 0.015, 90]}],
    ['Red sun', 'A red sun instead of the title.', {sun: '#d3262e'}, {top: 'sun'}],
    ['Blue pencil', 'The loudest in ultramarine instead of red.', {accent: [0.45, 0.21, 266]}],
    ['Heat', 'The red follows recent hits instead of the loudest three.', {}, {accent: 'heat'}],
    ['Iris', 'The Iris band instead of the fork.', {}, {band: 'iris'}],
  ]],
  paperPrint: ['Paper, black and red print', [
    ['Pure black', 'The bars and line in pure black.', {mass: '#111111', ink: '#0a0a0a'}],
    ['Vermilion', 'The red brighter, toward vermilion.', {accent: [0.63, 0.20, 33], sun: [0.63, 0.20, 33]}],
    ['Carmine', 'The red deeper, toward carmine.', {accent: [0.50, 0.20, 22], sun: [0.50, 0.20, 22]}],
    ['Grey bars', 'Mid-grey bars, so the red leads.', {mass: [0.58, 0.005, 260]}],
    ['Black sun', 'A cousin: a black sun; the red only on the hot bar.', {sun: '#15181d'}],
  ]],
  whiteVermilion: ['White and Vermilion', [
    ['Vermilion bars', 'The bars in true vermilion, as the name says.', {mass: [0.60, 0.21, 33]}],
    ['Oxblood', 'The bars darker.', {mass: [0.34, 0.11, 25]}],
    ['Marigold', 'The gold deeper, toward marigold.', {accent: [0.77, 0.165, 70], sun: [0.77, 0.165, 70]}],
    ['Red sun', 'The sun in the bars’ red; the gold only on the hot bar.', {sun: '#89221c'}],
    ['All ink', 'The whole course inked from the start.', {}, {line: 'ink'}],
  ]],
  lavender: ['Lavender Dusk', [
    ['More lilac', 'The paper carries more lilac.', {paper: [0.93, 0.022, 304]}],
    ['Deeper violet', 'The bars darker and more saturated.', {mass: [0.42, 0.115, 300]}],
    ['Blue-violet', 'The bars toward blue.', {mass: [0.48, 0.115, 280]}],
    ['Gold', 'The sun and hot bar in gold.', {accent: [0.83, 0.145, 84]}],
    ['Coral', 'The sun and hot bar in coral pink.', {accent: [0.70, 0.14, 28]}],
  ]],
  peony: ['Peony', [
    ['Whiter paper', 'The ice blue nearer white.', {paper: [0.975, 0.009, 214]}],
    ['Pinker bars', 'The bars lighter and pinker.', {mass: [0.60, 0.185, 355]}],
    ['Yellow sun', 'The sun and hot bar in a clear yellow.', {accent: [0.87, 0.155, 93], sun: [0.87, 0.155, 93]}],
    ['Mint paper', 'The paper from ice blue to pale mint.', {paper: [0.955, 0.022, 170]}],
    ['Leaf', 'A cousin: a leaf-green sun and hot bar.', {accent: [0.64, 0.14, 146], sun: [0.64, 0.14, 146]}],
  ]],
  seashell: ['Seashell', [
    ['Navy bars', 'The bars deeper.', {mass: [0.40, 0.095, 256]}],
    ['Sea green', 'The bars toward teal.', {mass: [0.53, 0.085, 200]}],
    ['Stronger jasper', 'The sun and hot bar more vivid.', {accent: [0.65, 0.185, 35], sun: [0.65, 0.185, 35]}],
    ['Pearl sun', 'A pale pearl-pink sun; the jasper only on the hot bar.', {sun: [0.84, 0.08, 32]}],
    ['Pencil → ink', 'The line is inked as the rider passes.', {}, {line: 'inking'}],
  ]],
  cutouts: ['Cut-outs', [
    ['Ultramarine', 'The bars in a brighter ultramarine.', {mass: [0.42, 0.20, 266]}],
    ['Lemon', 'The sun and hot bar in lemon yellow.', {accent: [0.88, 0.16, 97], sun: [0.88, 0.16, 97]}],
    ['Leaf sun', 'A leaf-green sun; the coral only on the hot bar.', {sun: [0.62, 0.14, 150]}],
    ['Magenta', 'The sun and hot bar in magenta pink.', {accent: [0.58, 0.20, 5], sun: [0.58, 0.20, 5]}],
    ['Blue sun', 'A cousin: the sun in the bars’ blue; the coral only on the hot bar.', {sun: '#014a7a'}],
  ]],
};

const schemes = {}, drafts = [];
for (const [key, [title, variations]] of Object.entries(V)) {
  const {spec} = COLLECTION[key], base = spec.colours;
  const versions = [['As it is', 'The theme in production.', {}, {}], ...variations].map(([label, note, colours = {}, look = {}], i) => {
    const c = {...base, ...Object.fromEntries(Object.entries(colours).map(([k, v]) => [k, colour(v)]))};
    if (colours.paper && !colours.pencil) { // the pencil keeps its distance from the ground
      const [pl, , ph] = toLch(c.paper), [bl] = toLch(base.paper), [nl, nc] = toLch(base.pencil);
      c.pencil = toHex([nl + pl - bl, nc, ph]);
    }
    if (colours.paper && base.nightPaper === base.paper) c.nightPaper = c.paper;
    const scheme = `r45${key}${String.fromCharCode(65 + i)}`;
    schemes[scheme] = c;
    return {label, look: {...spec.look, ...look, scheme}, note};
  });
  drafts.push({id: `r45${key}`, name: title, source: 'Round 45 · the collection, theme by theme',
    line: 'The theme as it is, then five variations: some small, some a different take. Pick any you prefer to the theme, or keep it.', variants: versions});
}
const out = new URL('./candidates-refine1.json', import.meta.url);
writeFileSync(out, JSON.stringify({round: 45, about: 'Round 45: every theme of the collection with five variations.', schemes, drops: {}, drafts}, null, 1) + '\n');
console.log(`${drafts.length} pages, ${Object.keys(schemes).length} versions`);
