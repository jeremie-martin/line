// Round 50 (owner, 2026-11-14), after the master round: the shake's curve (he asked for an earlier start and 28 px at 0.85, shaped
// as the boost or the split), the band lighting above a threshold on other themes and songs, a page of variations for each of the
// nine new light themes he wants to see more of, the strands' weight, and the stars' colour.
//   node generated/concept-lab/round50.mjs   → candidates-refine4.json (open /generated/concept-lab/?set=refine4&q=1)
import {COLLECTION} from '../../scripts/video/collection.js';
import {lightScheme, writeRound} from './lab-colour.mjs';

const LOOK = {accent: 'heat', band: 'bars', bandHeight: 'lowmid', drop: 'off', ends: 'course', hits: 'v1', irisWeight: 'thin', line: 'inking',
  paper: 'vibranceSoftHalfPaper', riderLower: '0', sunLift: '16', sunRider: '32', top: 'sun', zoom: 'steady'};
/** A page of one new light theme: the theme as shown in round 49, then versions that each change some of its colours or look. */
const variations = (id, name, said, c, look, versions) => ({id, name: `${name}: variations`, line: `${said} As shown last time, then one change each. Pick every version you would be happy to see in videos.`,
  versions: [['As shown last time', '', {}, {}], ...versions].map(([label, note, change = {}, l = {}]) => [label, note, lightScheme({...c, ...change}), {...LOOK, ...look, ...l}])});
const themed = (key, name, note, look = {}) => [name, note, COLLECTION[key].spec.colours, {...COLLECTION[key].spec.look, ...look}];
const of = key => COLLECTION[key].spec.colours;

const BRICK = [0.57, 0.155, 33], VERMILION = [0.62, 0.20, 33], AMBER = of('amberPurple').accent, GOLD = [0.83, 0.14, 85], SUMI = [0.30, 0.008, 80];
const HIT_MOMENTS = [['Batidão, a run of strong hits, 38 s', 38.3, 'batidao'], ['Lua, a run of strong hits, 41 s', 40.5, 'lua'], ['Tomada, 47 s', 46.5, 'tomada'],
  ['Petrunko, 30 s', 30.2, 'petrunko'], ['Circus Minimus, its strongest hit, 51 s', 50.6, 'circus']];
const hitPage = {song: 'batidao', t: 38.3, len: 6, moments: HIT_MOMENTS};
const WHERE = 'Pick the themes where it works; “none” is an answer too.';

const pages = [
  {id: 'shake', name: 'Hits: the shake, earlier and higher', base: 'rothko', ...hitPage,
    line: 'You asked for a shake that starts a little earlier and reaches about 28 px at 0.85 instead of 24, shaped like the boost or the split. Three ways; the curves are on the Hit curves page. The split is now a fifth stronger everywhere. Watch it play.', versions: [
      ['To 28 px', 'Starts at 0.6 as today; only the height changes.', {}, {hits: 'shakeHigher'}],
      ['From 0.55, as the boost', 'The same S-shape as the colour boost, starting at 0.55, 28 px at 0.85.', {}, {hits: 'shakeBoost'}],
      ['From 0.5, as the split', 'A slow start at 0.5 that keeps steepening, 28 px at 0.85.', {}, {hits: 'shakeQuad'}],
    ]},
  {id: 'litLevel', name: 'The band lights: from which strength', base: 'violetMarigold', ...hitPage,
    line: 'You liked the band lighting on hits above a strength. Last time the threshold was 0.6. Here three thresholds. Watch it play, on several songs.', versions: [
      ['From 0.7', 'Fewer hits light the band.', {}, {hits: 'lit70'}],
      ['From 0.6', 'As last time.', {}, {hits: 'lit60'}],
      ['From 0.5', 'More hits light the band.', {}, {hits: 'lit50'}],
    ]},
  {id: 'litThemes', name: 'The band lights: on other themes', ...hitPage, line: 'The band lighting from strength 0.6 on six themes; change the song with the moments. ' + WHERE, versions: [
    themed('rothko', 'Rothko', '', {hits: 'lit60'}),
    themed('jungleMoon', 'Jungle Moon', '', {hits: 'lit60'}),
    themed('cyanotype', 'Cyanotype', '', {hits: 'lit60'}),
    themed('hokusai', 'Hokusai', '', {hits: 'lit60'}),
    themed('stone', 'Stone', '', {hits: 'lit60'}),
    themed('paper', 'Paper', 'On the fork, every dot turns red.', {hits: 'lit60'}),
  ]},
  // ── the nine light themes, one page each ──
  variations('eucalyptus', 'Eucalyptus', 'Pale blue-green, deep teal-green bars, a brick sun.', {paper: [0.935, 0.012, 185], mass: [0.38, 0.055, 190], accent: BRICK}, {}, [
    ['Greyer paper', 'Less green in the ground, toward Stone.', {paper: [0.93, 0.007, 185]}],
    ['Deeper bars', '', {mass: [0.32, 0.05, 195]}],
    ['Charcoal bars', 'The colour only in the paper and the sun.', {mass: [0.33, 0.012, 190]}],
    ['Vermilion sun', 'A brighter red-orange.', {accent: VERMILION}],
    ['Amber sun', '', {accent: AMBER}],
    ['Inked', 'The whole course inked from the start.', {}, {line: 'ink'}],
  ]),
  variations('heather', 'Heather', 'Pale violet-grey, plum bars, an apricot sun.', {paper: [0.935, 0.011, 315], mass: [0.37, 0.065, 325], accent: [0.76, 0.14, 58]}, {}, [
    ['Greyer paper', 'Less violet in the ground.', {paper: [0.93, 0.006, 315]}],
    ['Darker plum bars', '', {mass: [0.31, 0.06, 325]}],
    ['Slate-violet bars', 'The bars bluer and quieter.', {mass: [0.38, 0.055, 290]}],
    ['Brick sun', '', {accent: BRICK}],
    ['Gold sun', '', {accent: GOLD}],
    ['Inked', '', {}, {line: 'ink'}],
  ]),
  variations('olive', 'Olive Paper', 'Pale olive, deep olive bars, a red-orange sun.', {paper: [0.935, 0.016, 110], mass: [0.38, 0.055, 115], accent: [0.62, 0.165, 38]}, {}, [
    ['Paler paper', 'A lighter, quieter ground.', {paper: [0.943, 0.010, 110]}],
    ['Darker bars', '', {mass: [0.32, 0.05, 115]}],
    ['Sumi bars', 'Ink-black bars.', {mass: SUMI}],
    ['Brick sun', 'A deeper red.', {accent: BRICK}],
    ['Amber sun', '', {accent: AMBER}],
    ['Inked', '', {}, {line: 'ink'}],
  ]),
  variations('ice', 'Ice', 'Pale ice blue, petrol bars, a burnt-orange sun.', {paper: [0.94, 0.012, 220], mass: [0.36, 0.06, 225], accent: [0.64, 0.15, 44]}, {}, [
    ['Greyer paper', '', {paper: [0.935, 0.007, 225]}],
    ['Navy bars', 'The bars bluer and darker.', {mass: [0.33, 0.07, 255]}],
    ['Charcoal bars', '', {mass: [0.33, 0.012, 225]}],
    ['Vermilion sun', '', {accent: VERMILION}],
    ['Gold sun', '', {accent: GOLD}],
    ['Inked', '', {}, {line: 'ink'}],
  ]),
  variations('lichen', 'Lichen', 'Grey-green, charcoal bars, a vermilion sun, inked.', {paper: [0.93, 0.013, 150], mass: [0.33, 0.012, 150], accent: VERMILION}, {line: 'ink'}, [
    ['Pencil → ink', 'The line inked as the rider passes.', {}, {line: 'inking'}],
    ['Paler paper', '', {paper: [0.943, 0.009, 150]}],
    ['Green bars', 'Deep green bars instead of charcoal.', {mass: [0.36, 0.045, 155]}],
    ['Brick sun', '', {accent: BRICK}],
    ['Amber sun', '', {accent: AMBER}],
  ]),
  variations('dove', 'Dove', 'Violet-grey, deep violet-grey bars, a brick sun.', {paper: [0.93, 0.008, 300], mass: [0.34, 0.03, 300], accent: BRICK}, {}, [
    ['Lighter paper', '', {paper: [0.943, 0.006, 300]}],
    ['Darker bars', 'Nearly black.', {mass: [0.29, 0.02, 300]}],
    ['Violet bars', 'More colour in the bars.', {mass: [0.36, 0.06, 300]}],
    ['Vermilion sun', '', {accent: VERMILION}],
    ['Apricot sun', '', {accent: [0.76, 0.14, 58]}],
    ['Inked', '', {}, {line: 'ink'}],
  ]),
  variations('morandi', 'Morandi', 'Dusty cream, grey-blue bars, a terracotta sun.', {paper: [0.93, 0.014, 75], mass: [0.47, 0.03, 240], accent: [0.64, 0.115, 40]}, {}, [
    ['Darker bars', '', {mass: [0.40, 0.035, 240]}],
    ['Dusty green bars', '', {mass: [0.47, 0.03, 150]}],
    ['Stronger terracotta', 'The sun and hot bar less dusty.', {accent: [0.60, 0.15, 38]}],
    ['Ochre sun', '', {accent: [0.76, 0.11, 80]}],
    ['Greyer paper', '', {paper: [0.925, 0.008, 80]}],
    ['Inked', '', {}, {line: 'ink'}],
  ]),
  variations('hammershoi', 'Hammershøi', 'Cool grey, black bars, a dull gold sun, inked.', {paper: [0.925, 0.006, 240], mass: [0.30, 0.008, 250], accent: [0.76, 0.10, 80]}, {line: 'ink'}, [
    ['Pencil → ink', '', {}, {line: 'inking'}],
    ['Brighter gold', '', {accent: [0.80, 0.13, 85]}],
    ['Warm grey paper', 'Stone’s ground.', {paper: of('stone').paper}],
    ['Lighter paper', '', {paper: [0.943, 0.005, 240]}],
    ['Softer bars', 'Dark grey instead of black.', {mass: [0.39, 0.012, 250]}],
    ['The title', 'The title instead of the sun.', {}, {top: 'title'}],
  ]),
  variations('celadon', 'Celadon', 'Grey-green glaze, deep celadon bars, an iron-brown sun.', {paper: [0.93, 0.014, 160], mass: [0.42, 0.05, 165], accent: [0.52, 0.11, 45]}, {}, [
    ['Brick sun', 'Redder and a little lighter.', {accent: BRICK}],
    ['Rust sun', 'Brighter.', {accent: [0.58, 0.14, 42]}],
    ['Gold sun', '', {accent: GOLD}],
    ['Deeper bars', '', {mass: [0.35, 0.05, 165]}],
    ['Greyer paper', '', {paper: [0.93, 0.008, 160]}],
    ['Inked', '', {}, {line: 'ink'}],
  ]),
  // ── strands and stars ──
  {id: 'strandWeight', name: 'Strands: the weight', line: 'You want “either the thinnest or something in between”. On two themes: the thinnest, then a fifth heavier. Watch it play.', versions: [
    themed('rothko', 'Rothko, thinnest', '', {band: 'strands', irisWeight: 'thin'}),
    themed('rothko', 'Rothko, a fifth heavier', '', {band: 'strands', irisWeight: 'fine'}),
    themed('jungleMoon', 'Jungle Moon, thinnest', '', {band: 'strands', irisWeight: 'thin'}),
    themed('jungleMoon', 'Jungle Moon, a fifth heavier', '', {band: 'strands', irisWeight: 'fine'}),
  ]},
  {id: 'strandThemes', name: 'Strands on other themes', line: 'The strands, a fifth heavier than the thinnest, on six themes. Four you liked as an idea when the strands were thick; two are new. ' + WHERE, versions: [
    themed('blackIrisMoon', 'Black Iris, its own colours', 'Silver strands, the front one red, instead of navy and lavender.', {band: 'strands', irisWeight: 'fine'}),
    themed('cyanotype', 'Cyanotype', '', {band: 'strands', irisWeight: 'fine'}),
    themed('oldRose', 'Old Rose', '', {band: 'strands', irisWeight: 'fine'}),
    themed('paper', 'Paper', '', {band: 'strands', irisWeight: 'fine'}),
    themed('seaMoon', 'Sea Moon', '', {band: 'strands', irisWeight: 'fine'}),
    themed('blueRoom', 'Blue Room', '', {band: 'strands', irisWeight: 'fine'}),
  ]},
  {id: 'starColour', name: 'Stars: the moon’s colour or the line’s', line: 'You were not sure the stars should be in a colour. On three themes with a coloured moon: the stars in the moon’s colour, then in the line’s cream.', versions: [
    themed('jungleMoonGolden', 'Jungle Moon, golden: gold stars', '', {top: 'stars'}),
    themed('jungleMoonGolden', 'Jungle Moon, golden: cream stars', '', {top: 'starsInk'}),
    themed('blueRoom', 'Blue Room: gold stars', '', {top: 'stars'}),
    themed('blueRoom', 'Blue Room: cream stars', '', {top: 'starsInk'}),
    themed('lilyLeaf', 'Lily White: green stars', '', {top: 'stars'}),
    themed('lilyLeaf', 'Lily White: cream stars', '', {top: 'starsInk'}),
  ]},
];
writeRound({set: 'refine4', round: 50, about: 'Round 50: the shake’s curve, the band lighting, variations of nine new light themes, strands, stars.',
  source: 'Round 50 · after the master round', prefix: 'r50', pages});
