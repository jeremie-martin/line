// Round 47 (owner, 2026-11-13): after round 46. The owner's remarks page by page (Hokusai's black line, steps between versions he
// liked, grounds toned down), variations of Sage, Sky and Stone, and two pages of new light themes after what worked in round 46
// (quiet grounds, dark bars, one warm note).
//   node generated/concept-lab/round47.mjs   → candidates-refine3.json (open /generated/concept-lab/?set=refine3&q=1)
import {COLLECTION} from '../../scripts/video/collection.js';
import {lightScheme, toLch, writeRound} from './lab-colour.mjs';

const LOOK = {accent: 'heat', band: 'bars', bandHeight: 'lowmid', drop: 'off', ends: 'course', hits: 'v1', irisWeight: 'thin', line: 'inking',
  paper: 'vibranceSoftHalfPaper', riderLower: '0', sunLift: '16', sunRider: '32', top: 'sun', zoom: 'steady'};
const fresh = (name, note, c, look = {}) => [name, note, lightScheme(c), {...LOOK, ...look}];
// variations of a theme that is not in the collection: each version changes some of its colours
const around = (c, versions) => versions.map(([name, note, change = {}, look = {}]) => fresh(name, note, {...c, ...change}, look));
/** A colour part of the way from one to another, in OKLCH. */
const mix = (a, b, t) => {
  const [al, ac, ah] = typeof a === 'string' ? toLch(a) : a, [bl, bc, bh] = typeof b === 'string' ? toLch(b) : b, dh = ((bh - ah + 540) % 360) - 180;
  return [al + (bl - al) * t, ac + (bc - ac) * t, (ah + dh * t + 360) % 360];
};
const of = key => COLLECTION[key].spec.colours;

const BLACK = '#1b1c20', INDIGO = [0.36, 0.11, 262], NIGHT = [0.24, 0.04, 232], CREAM_MOON = [0.93, 0.035, 95];
const night = t => { const p = mix(of('ceruleanCoral').paper, NIGHT, t); return {paper: p, nightPaper: p}; };
const IVORY = [0.955, 0.02, 88], CREAM = [0.965, 0.02, 90], WARM_WHITE = [0.975, 0.012, 80];
const SAGE = {paper: [0.945, 0.02, 140], mass: [0.42, 0.07, 150], accent: [0.66, 0.145, 44]};
const SKY = {paper: [0.95, 0.014, 240], mass: [0.40, 0.10, 256], accent: [0.83, 0.15, 85]};
const AMBER = of('amberPurple').accent, WARM_PAPER = of('amberPurple').paper, VERMILION = [0.62, 0.20, 33];

const KEEP = 'Pick any you would be happy to see in videos; “none” is an answer too.';
const NEW = 'New light themes, each a first attempt. Keep any you would be happy to see in videos; say what is close.';
const pages = [
  {id: 'hokusai', name: 'Hokusai: the black line on each blue', base: 'hokusai',
    line: 'You liked the black line and asked to see it on the other blues. Each blue comes with its indigo line, then with the black one.', versions: [
      ['Black line', 'As it is, the line in black ink.', {ink: BLACK}],
      ['A third bluer', 'Indigo line.', {mass: [0.39, 0.109, 258]}],
      ['A third bluer, black line', '', {mass: [0.39, 0.109, 258], ink: BLACK}],
      ['Two thirds bluer', 'Indigo line.', {mass: [0.41, 0.12, 257.5]}],
      ['Two thirds bluer, black line', '', {mass: [0.41, 0.12, 257.5], ink: BLACK}],
    ]},
  {id: 'amber', name: 'Amber and Purple: between the Prussian bars and the indigo', base: 'amberPurple',
    line: 'The indigo bars were “maybe a bit too indigo”; a mix with the theme as it is could work.', versions: [
      ['A third of the way', 'The bars a third of the way to the indigo.', {mass: mix(of('amberPurple').mass, INDIGO, 1 / 3)}],
      ['Halfway', '', {mass: mix(of('amberPurple').mass, INDIGO, 0.5)}],
      ['Two thirds of the way', '', {mass: mix(of('amberPurple').mass, INDIGO, 2 / 3)}],
      ['Indigo', 'Last round’s indigo, to compare.', {mass: INDIGO}],
      ['Quieter indigo', 'The indigo with less colour in it.', {mass: [0.36, 0.075, 262]}],
    ]},
  {id: 'silver', name: 'Silver and Rust: the ivory, toned down', base: 'silverRust',
    line: 'The ground as it is was too dark and strong, the ivory “almost too bright”. Steps between the two, and two other tries.', versions: [
      ['Ivory', 'Last round’s ivory, to compare.', {paper: IVORY}],
      ['One step down', 'A little darker and warmer than the ivory.', {paper: mix(IVORY, of('silverRust').paper, 0.25)}],
      ['Two steps down', '', {paper: mix(IVORY, of('silverRust').paper, 0.45)}],
      ['Three steps down', 'Two thirds of the way back to the ground as it is.', {paper: mix(IVORY, of('silverRust').paper, 0.65)}],
      ['One step down, greyer', 'The same lightness as “one step down”, with less yellow.', {paper: [0.932, 0.011, 88]}],
      ['One step down, softer bars', 'The bars a little lighter, so the page is less harsh.', {paper: mix(IVORY, of('silverRust').paper, 0.25), mass: [0.50, 0.075, 98]}],
    ]},
  {id: 'seashell', name: 'Seashell: a less red ground', base: 'seashell',
    line: 'The ground was “a bit too red”. The same theme on other grounds.', versions: [
      ['Half as pink', 'The shell tint halved.', {paper: [0.975, 0.006, 40]}],
      ['Neutral white', 'No tint.', {paper: [0.978, 0.003, 90]}],
      ['Ivory', 'A warm tint toward yellow, not red.', {paper: [0.972, 0.012, 88]}],
      ['Pearl', 'A cool, faintly blue white.', {paper: [0.972, 0.006, 240]}],
      ['Neutral white, deeper bars', 'No tint, and the blue of the bars deeper.', {paper: [0.978, 0.003, 90], mass: [0.43, 0.10, 256]}],
    ]},
  {id: 'peony', name: 'Peony: around the warm white', base: 'peony',
    line: 'You took the warm white without loving it. All of these are on warm white.', versions: [
      ['Warm white', 'Last round’s version, to compare.', {paper: WARM_WHITE}],
      ['Dusty rose bars', 'The bars lighter and less vivid.', {paper: WARM_WHITE, mass: [0.56, 0.115, 2]}],
      ['Deep rose bars', 'The bars darker and less magenta.', {paper: WARM_WHITE, mass: [0.42, 0.13, 10]}],
      ['Gold note', 'The peony bars, a gold bar and sun instead of marigold.', {paper: WARM_WHITE, accent: [0.80, 0.14, 85], sun: [0.80, 0.14, 85]}],
      ['Sumi and peony', 'Ink-black bars; the peony is the one colour, on the hot bar and the sun.', {paper: WARM_WHITE, mass: [0.28, 0.008, 80], accent: of('peony').mass, sun: of('peony').mass}],
      ['Plum bars', 'Deep plum bars with the marigold.', {paper: WARM_WHITE, mass: [0.36, 0.10, 340]}],
    ]},
  {id: 'cutouts', name: 'Cut-outs: the cream and the indigo, each softer', base: 'cutouts',
    line: 'The cream was a good step but “a little too red, a little too cream”; the indigo bars a little too strong, above all at the drop.', versions: [
      ['Cream', 'Last round’s cream, to compare.', {paper: CREAM}],
      ['Half cream', 'Half the tint.', {paper: [0.975, 0.011, 92]}],
      ['Cream, less red', 'The same strength, turned from red toward yellow-green.', {paper: [0.965, 0.018, 102]}],
      ['Softer indigo', 'Indigo bars with less colour, the coral as it is.', {mass: [0.36, 0.095, 264]}],
      ['Half cream, softer indigo', 'Both.', {paper: [0.975, 0.011, 92], mass: [0.36, 0.095, 264]}],
      ['Half cream, quiet indigo', 'The bars quieter still.', {paper: [0.975, 0.011, 92], mass: [0.37, 0.07, 262]}],
    ]},
  {id: 'cerulean', name: 'Cerulean and Coral: grounds between the two, title or cream moon', base: 'ceruleanCoral',
    line: 'As it is “a bit too faded”, the night stronger; you asked for intermediates. The night versions are in the collection.', versions: [
      ['A third deeper', 'The ground a third of the way to the night. The title.', night(1 / 3)],
      ['Two thirds deeper', 'The title.', night(2 / 3)],
      ['As it is, cream moon', 'The ground as it is, with the cream moon.', {sun: CREAM_MOON}, {top: 'sun'}],
      ['A third deeper, cream moon', '', {...night(1 / 3), sun: CREAM_MOON}, {top: 'sun'}],
      ['Two thirds deeper, cream moon', '', {...night(2 / 3), sun: CREAM_MOON}, {top: 'sun'}],
      ['More blue, same depth', 'The ground as light as it is, with more colour in it. The title.', {paper: [0.375, 0.05, 228], nightPaper: [0.375, 0.05, 228]}],
    ]},
  {id: 'sage', name: 'Sage: variations', line: 'You liked Sage and did not want to lose it. ' + KEEP, versions: around(SAGE, [
    ['Sage', 'Last round’s version, to compare.'],
    ['Paler paper', 'A lighter, quieter sage ground.', {paper: [0.96, 0.013, 140]}],
    ['Grey-green paper', 'The ground greyer and a step darker, toward Stone.', {paper: [0.93, 0.011, 140]}],
    ['Darker bars', 'The green of the bars deeper.', {mass: [0.35, 0.06, 152]}],
    ['Brick sun', 'A deeper, redder bar and sun.', {accent: [0.57, 0.155, 33]}],
    ['Amber sun', 'The amber of Amber and Purple.', {accent: AMBER}],
    ['Inked', 'The whole course inked from the start.', {}, {line: 'ink'}],
  ])},
  {id: 'sky', name: 'Sky: variations', line: 'You liked Sky but felt the idea could be done better. ' + KEEP, versions: around(SKY, [
    ['Sky', 'Last round’s version, to compare.'],
    ['Paler paper', 'Nearly white, with a breath of blue.', {paper: [0.968, 0.008, 240]}],
    ['Grey-blue paper', 'The ground greyer and a step darker.', {paper: [0.93, 0.012, 240]}],
    ['Navy bars', 'The bars darker and quieter.', {mass: [0.33, 0.075, 260]}],
    ['Amber sun', 'A warmer, more orange bar and sun.', {accent: AMBER}],
    ['Vermilion sun', 'A red-orange bar and sun.', {accent: VERMILION}],
    ['Navy bars, amber sun, inked', 'Both, with the whole course inked.', {mass: [0.33, 0.075, 260], accent: AMBER}, {line: 'ink'}],
  ])},
  {id: 'stone', name: 'Stone: variations', base: 'stone', line: 'Stone is in the collection. ' + KEEP, versions: [
    ['Lighter stone', 'The ground a step lighter.', {paper: [0.945, 0.007, 80]}],
    ['Darker stone', 'The ground a step darker.', {paper: [0.90, 0.010, 80]}],
    ['Cool stone', 'A cool grey ground instead of a warm one.', {paper: [0.925, 0.005, 250]}],
    ['Slate bars', 'Blue-grey bars instead of charcoal.', {mass: [0.37, 0.035, 252]}],
    ['Amber sun', 'The amber of Amber and Purple on the bar and sun.', {accent: AMBER, sun: AMBER}],
    ['Pencil → ink', 'The line inked as the rider passes.', {}, {line: 'inking'}],
  ]},
  // ── new light themes ──
  {id: 'quiet', name: 'New light themes: quiet grounds, dark bars, one warm note', line: NEW + ' These follow Stone.', versions: [
    fresh('Linen', 'Linen, sepia bars, a brick bar and sun.', {paper: [0.935, 0.016, 85], mass: [0.36, 0.04, 62], accent: [0.57, 0.155, 33]}),
    fresh('Slate', 'Cool grey, slate-blue bars, an amber bar and sun.', {paper: [0.93, 0.007, 250], mass: [0.38, 0.045, 255], accent: AMBER}),
    fresh('Celadon', 'Pale grey-green, pine bars, an amber bar and sun.', {paper: [0.935, 0.009, 165], mass: [0.36, 0.06, 170], accent: AMBER}),
    fresh('Oat and Plum', 'Oat, plum-black bars, an amber bar and sun.', {paper: [0.94, 0.018, 85], mass: [0.32, 0.05, 335], accent: AMBER}),
    fresh('Moss', 'Warm paper, dark moss bars, a vermilion bar and sun; the whole course inked.', {paper: [0.94, 0.014, 100], mass: [0.38, 0.055, 125], accent: VERMILION}, {line: 'ink'}),
    fresh('Graphite and Gold', 'Stone’s ground and bars with a gold bar and sun; pencil → ink.', {paper: [0.925, 0.008, 80], mass: [0.33, 0.01, 80], accent: [0.80, 0.14, 85]}),
  ]},
  {id: 'warm', name: 'New light themes: the amber page with other bars and notes', line: NEW + ' These follow Sumi and Pine: the same warm paper, other dark bars.', versions: [
    fresh('Bordeaux and Amber', 'Deep wine bars with the amber.', {paper: WARM_PAPER, mass: [0.35, 0.10, 15], accent: AMBER}),
    fresh('Walnut and Amber', 'Dark walnut-brown bars with the amber.', {paper: WARM_PAPER, mass: [0.37, 0.055, 55], accent: AMBER}),
    fresh('Aubergine and Amber', 'Aubergine bars with the amber.', {paper: WARM_PAPER, mass: [0.33, 0.08, 325], accent: AMBER}),
    fresh('Pine and Vermilion', 'The pine bars with a vermilion bar and sun.', {paper: WARM_PAPER, mass: [0.38, 0.075, 160], accent: VERMILION}),
    fresh('Sumi and Vermilion', 'The ink-black bars with a vermilion bar and sun.', {paper: WARM_PAPER, mass: [0.28, 0.008, 80], accent: VERMILION}),
    fresh('Olive and Amber', 'Dark olive bars with the amber.', {paper: WARM_PAPER, mass: [0.40, 0.065, 110], accent: AMBER}),
  ]},
];
writeRound({set: 'refine3', round: 47, about: 'Round 47: follow-ups to round 46, variations of Sage, Sky and Stone, new light themes.',
  source: 'Round 47 · after round 46', prefix: 'r47', pages});
