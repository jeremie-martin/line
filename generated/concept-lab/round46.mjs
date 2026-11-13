// Round 46 (owner, 2026-11-13): after round 45. Three follow-ups (Cobalt's hot bar, Forest Green, Hokusai), new directions for the six
// themes not loved, and three pages of new light themes.
//   node generated/concept-lab/round46.mjs   → candidates-refine2.json (open /generated/concept-lab/?set=refine2&q=1)
import {COLLECTION} from '../../scripts/video/collection.js';
import {lightScheme, writeRound} from './lab-colour.mjs';

const LOOK = {accent: 'heat', band: 'bars', bandHeight: 'lowmid', drop: 'off', ends: 'course', hits: 'v1', irisWeight: 'thin', line: 'inking',
  paper: 'vibranceSoftHalfPaper', riderLower: '0', sunLift: '16', sunRider: '32', top: 'sun', zoom: 'steady'};
// a new light theme: [name, note, {paper, mass, accent, sun?, ink?}, look?]
const fresh = (name, note, c, look = {}) => [name, note, lightScheme(c), {...LOOK, ...look}];
const WHITE = [0.985, 0.004, 95], deeper = {paper: COLLECTION.forestGoldDeeper.spec.colours.paper, pencil: COLLECTION.forestGoldDeeper.spec.colours.pencil};

const VARIATION = 'The theme as it is, then other directions than last time. Pick any you like; “none” is an answer too.';
const NEW = 'New light themes, each a first attempt. Keep any you would be happy to see in videos; say what is close.';
const pages = [
  // ── follow-ups ──
  {id: 'cobalt', name: 'Cobalt and Chartreuse: the hot bar under the white moon', base: 'cobaltChartreuse',
    line: 'You took the white moon and asked for a lime hot bar with it.', versions: [
      ['Lime bar', 'The hot bar lighter and more yellow.', {accent: [0.87, 0.16, 113]}],
      ['Lemon-lime bar', 'Further toward yellow.', {accent: [0.90, 0.15, 104]}],
      ['Green lime bar', 'A greener, fresher lime.', {accent: [0.84, 0.18, 128]}],
      ['Lime bar, lime-white moon', 'The lime bar, and a moon with a breath of lime.', {accent: [0.87, 0.16, 113], sun: [0.95, 0.05, 113]}],
    ]},
  {id: 'forest', name: 'Forest Green and Gold: other directions', base: 'forestGold',
    line: 'You kept the theme and the deeper forest without being convinced. Everything after B is on the deeper ground.', versions: [
      ['Deeper forest', 'In the collection since round 45.', deeper],
      ['Cream moon', 'A cream moon; the gold only on the hot bar.', {...deeper, sun: [0.93, 0.035, 92]}],
      ['Orange-red bars', 'The bars warmer and more luminous, as on Rothko.', {...deeper, mass: [0.62, 0.175, 36]}],
      ['Soft rose bars', 'The bars lighter and dustier.', {...deeper, mass: [0.70, 0.11, 15]}],
      ['Gold bars, rose note', 'Gold bars; the rose red on the hot bar and the sun.', {...deeper, mass: [0.78, 0.13, 87], accent: [0.62, 0.17, 19], sun: [0.62, 0.17, 19]}],
      ['Pine night', 'A near-black pine ground, the bars and gold as they are.', {paper: [0.19, 0.025, 172], nightPaper: [0.19, 0.025, 172]}],
    ]},
  {id: 'hokusai', name: 'Hokusai: the blue, and a few other things', base: 'hokusai',
    line: 'Last time the brighter Prussian was “maybe a tad too blue”: here it comes in steps.', versions: [
      ['A third bluer', 'The bars a third of the way to last round’s brighter Prussian.', {mass: [0.39, 0.109, 258]}],
      ['Two thirds bluer', 'Two thirds of the way.', {mass: [0.41, 0.12, 257.5]}],
      ['Vermilion sun', 'The sun and hot bar a little brighter and more orange.', {accent: [0.62, 0.195, 35]}],
      ['Black line', 'The line in black ink instead of indigo.', {ink: '#1b1c20'}],
      ['All ink', 'The whole course inked from the start.', {}, {line: 'ink'}],
    ]},
  // ── the six themes not loved: other directions ──
  {id: 'amber', name: 'Amber and Purple: other directions', base: 'amberPurple', line: VARIATION, versions: [
    ['Indigo bars', 'The bars from Prussian teal to indigo.', {mass: [0.36, 0.11, 262]}],
    ['Indigo, white paper', 'Indigo bars on a nearly white page.', {mass: [0.36, 0.11, 262], paper: [0.98, 0.006, 95]}],
    ['Violet bars', 'A true deep violet with the amber.', {mass: [0.38, 0.13, 298]}],
    ['Sumi', 'Ink-black bars; the amber is the only colour.', {mass: [0.28, 0.008, 80]}],
    ['Pine', 'Deep pine-green bars with the amber.', {mass: [0.38, 0.075, 160]}],
  ]},
  {id: 'silver', name: 'Silver and Rust: other directions', base: 'silverRust', line: VARIATION, versions: [
    ['Ivory', 'A light, clean ivory ground.', {paper: [0.955, 0.02, 88]}],
    ['Ivory, sepia bars', 'Ivory, with deep sepia bars instead of olive.', {paper: [0.955, 0.02, 88], mass: [0.38, 0.055, 65]}],
    ['Ivory, green-black bars', 'Ivory, with near-black green bars.', {paper: [0.955, 0.02, 88], mass: [0.33, 0.03, 170]}],
    ['Silver', 'The name taken literally: a pale cool grey ground, graphite bars, the rust.', {paper: [0.935, 0.006, 230], mass: [0.37, 0.015, 250], accent: [0.60, 0.16, 40], sun: [0.57, 0.16, 40]}],
    ['Verdigris', 'Ivory, deep teal bars, the rust.', {paper: [0.955, 0.02, 88], mass: [0.42, 0.065, 195]}],
  ]},
  {id: 'seashell', name: 'Seashell: other directions', base: 'seashell', line: VARIATION, versions: [
    ['Indigo and red', 'Deeper indigo bars and a true red sun.', {mass: [0.36, 0.10, 262], accent: [0.60, 0.19, 31], sun: [0.60, 0.19, 31]}],
    ['Navy and gold', 'A pearl-grey ground, navy bars, a gold sun.', {paper: [0.955, 0.005, 250], mass: [0.34, 0.085, 260], accent: [0.80, 0.15, 82], sun: [0.80, 0.15, 82]}],
    ['Deep sea', 'Deep teal bars with the jasper.', {mass: [0.40, 0.07, 212]}],
    ['Sand', 'A pale sand ground, sea-blue bars, an orange sun.', {paper: [0.955, 0.02, 75], mass: [0.42, 0.095, 250], accent: [0.69, 0.17, 50], sun: [0.69, 0.17, 50]}],
    ['Pencil → ink, gold', 'The line inked as the rider passes; a gold sun.', {accent: [0.80, 0.15, 82], sun: [0.80, 0.15, 82]}, {line: 'inking'}],
  ]},
  {id: 'peony', name: 'Peony: other directions', base: 'peony', line: VARIATION, versions: [
    ['White', 'The peony and marigold on white.', {paper: WHITE}],
    ['Warm white', 'On a warm white.', {paper: [0.975, 0.012, 80]}],
    ['Wine', 'Deeper wine-pink bars and gold, on warm white.', {paper: [0.975, 0.012, 80], mass: [0.42, 0.155, 2], accent: [0.80, 0.15, 82], sun: [0.80, 0.15, 82]}],
    ['Sage paper', 'A pale sage ground under the peony.', {paper: [0.955, 0.014, 140]}],
    ['Pink sun', 'On white: a pale peony sun; the marigold only on the hot bar.', {paper: WHITE, sun: [0.83, 0.07, 355]}],
  ]},
  {id: 'cutouts', name: 'Cut-outs: other directions', base: 'cutouts', line: VARIATION, versions: [
    ['Indigo and vermilion', 'Deeper indigo bars and a stronger red-orange.', {mass: [0.33, 0.14, 266], accent: [0.62, 0.205, 33], sun: [0.62, 0.205, 33]}],
    ['Cobalt', 'The bars a lighter, purer cobalt.', {mass: [0.45, 0.15, 259]}],
    ['Cream', 'The same colours on a warm cream.', {paper: [0.965, 0.02, 90]}],
    ['Blue note', 'Black bars; the one colour is blue, on the hot bar and the sun.', {mass: [0.25, 0.005, 260], accent: [0.48, 0.17, 262], sun: [0.48, 0.17, 262]}],
    ['Green', 'Deep green bars with the coral.', {mass: [0.46, 0.115, 152]}],
  ]},
  {id: 'cerulean', name: 'Cerulean and Coral: other directions', base: 'ceruleanCoral', line: VARIATION, versions: [
    ['Night', 'A much deeper blue-teal ground.', {paper: [0.24, 0.04, 232], nightPaper: [0.24, 0.04, 232]}],
    ['Night, cream moon', 'The deeper ground, a cream moon; the lemon only on the hot bar.', {paper: [0.24, 0.04, 232], nightPaper: [0.24, 0.04, 232], sun: [0.93, 0.035, 95]}, {top: 'sun'}],
    ['Peach bars', 'The bars lighter and softer.', {mass: [0.81, 0.105, 52]}],
    ['Cream bars, coral note', 'Cream bars; the coral on the hot bar.', {mass: [0.87, 0.045, 92], accent: [0.72, 0.16, 42]}],
    ['Night, gold note', 'The deeper ground, the coral bars, a gold hot bar instead of lemon.', {paper: [0.24, 0.04, 232], nightPaper: [0.24, 0.04, 232], accent: [0.84, 0.15, 86]}],
  ]},
  // ── new light themes ──
  {id: 'white', name: 'New light themes: white and one deep colour', line: NEW, versions: [
    fresh('White and Emerald', 'White, deep emerald bars, a gold bar and sun.', {paper: WHITE, mass: [0.40, 0.10, 160], accent: [0.80, 0.15, 82]}),
    fresh('White and Indigo', 'White, indigo bars, a marigold bar and sun.', {paper: WHITE, mass: [0.33, 0.12, 268], accent: [0.78, 0.16, 72]}),
    fresh('White and Aubergine', 'White, aubergine bars, an orange bar and sun.', {paper: WHITE, mass: [0.32, 0.10, 330], accent: [0.72, 0.17, 55]}),
    fresh('White and Teal', 'White, deep teal bars, a vermilion bar and sun.', {paper: WHITE, mass: [0.42, 0.075, 200], accent: [0.62, 0.20, 33]}),
    fresh('Ochre', 'White, ochre bars, a deep red bar and sun: cave-painting earths.', {paper: [0.98, 0.008, 85], mass: [0.56, 0.11, 72], accent: [0.50, 0.17, 28]}),
    fresh('Charcoal and Gold', 'White, charcoal bars, a gold bar and sun; the whole course inked.', {paper: WHITE, mass: [0.30, 0.008, 260], accent: [0.80, 0.15, 82], ink: '#15181d'}, {line: 'ink'}),
  ]},
  {id: 'tinted', name: 'New light themes: tinted papers, tone on tone', line: NEW, versions: [
    fresh('Sage', 'Pale sage, deep green bars, a terracotta bar and sun.', {paper: [0.945, 0.02, 140], mass: [0.42, 0.07, 150], accent: [0.66, 0.145, 44]}),
    fresh('Sky', 'Pale blue, deep blue bars, a warm gold bar and sun.', {paper: [0.95, 0.014, 240], mass: [0.40, 0.10, 256], accent: [0.83, 0.15, 85]}),
    fresh('Butter', 'Butter-cream, navy bars, a red-orange bar and sun.', {paper: [0.96, 0.035, 95], mass: [0.33, 0.08, 262], accent: [0.63, 0.19, 34]}),
    fresh('Mint', 'Pale mint, deep sea-green bars, a coral-red bar and sun.', {paper: [0.955, 0.02, 175], mass: [0.38, 0.07, 185], accent: [0.64, 0.185, 30]}),
    fresh('Stone', 'Warm grey, charcoal bars, a vermilion bar and sun; the whole course inked.', {paper: [0.925, 0.008, 80], mass: [0.33, 0.01, 80], accent: [0.62, 0.20, 33]}, {line: 'ink'}),
    fresh('Manuscript', 'Parchment, bordeaux bars, a gold bar and sun.', {paper: [0.94, 0.03, 85], mass: [0.36, 0.11, 15], accent: [0.80, 0.15, 82]}),
  ]},
  {id: 'pictures', name: 'New light themes: from pictures', line: NEW, versions: [
    fresh('Primaries', 'After Mondrian: white, ultramarine bars, a yellow hot bar, a red sun.', {paper: WHITE, mass: [0.38, 0.18, 265], accent: [0.87, 0.16, 97], sun: [0.58, 0.21, 28], ink: '#141414'}, {line: 'ink'}),
    fresh('Red Fuji', 'Hokusai reversed: pale cream, brick-red bars, an indigo hot bar and sun.', {paper: [0.95, 0.02, 90], mass: [0.52, 0.16, 32], accent: [0.32, 0.10, 262], ink: [0.25, 0.03, 262]}),
    fresh('Bauhaus', 'Ivory, black bars, a red hot bar, a yellow sun.', {paper: [0.97, 0.014, 92], mass: [0.25, 0.005, 90], accent: [0.58, 0.21, 28], sun: [0.86, 0.14, 90]}, {line: 'ink'}),
    fresh('Azulejo', 'After Portuguese tiles: white, cobalt bars, an ochre-yellow bar and sun.', {paper: WHITE, mass: [0.42, 0.17, 262], accent: [0.80, 0.14, 85]}),
    fresh('Klimt', 'Pale gold ground, brown-black bars, a terracotta bar and sun.', {paper: [0.93, 0.05, 90], mass: [0.28, 0.03, 60], accent: [0.56, 0.16, 35]}),
    fresh('Citrus', 'White, deep leaf-green bars, an orange bar and sun.', {paper: WHITE, mass: [0.40, 0.09, 150], accent: [0.74, 0.17, 58]}),
  ]},
];
writeRound({set: 'refine2', round: 46, about: 'Round 46: follow-ups to round 45, other directions for six themes, new light themes.',
  source: 'Round 46 · after round 45', prefix: 'r46', pages});
