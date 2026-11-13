// Round 49, the master round (owner, 2026-11-13: step back over the day's answers, then one large, carefully made round, with
// analysis and curves around it). Every page follows something the owner said in rounds 45–48, and is of one of the forms that
// gave clear answers: one thing changed on a theme he knows, an idea shown on several themes, or new themes each with its own
// character. The hit pages go with the curves at /generated/concept-lab/hits.html.
//   node generated/concept-lab/round49.mjs   → candidates-master.json (open /generated/concept-lab/?set=master&q=1)
import {COLLECTION} from '../../scripts/video/collection.js';
import {darkScheme, lightScheme, toLch, writeRound} from './lab-colour.mjs';

const LOOK = {accent: 'heat', band: 'bars', bandHeight: 'lowmid', drop: 'off', ends: 'course', hits: 'v1', irisWeight: 'thin', line: 'inking',
  paper: 'vibranceSoftHalfPaper', riderLower: '0', sunLift: '16', sunRider: '32', top: 'sun', zoom: 'steady'};
const light = (name, note, c, look = {}) => [name, note, lightScheme(c), {...LOOK, ...look}];
const dark = (name, note, c, look = {}) => [name, note, darkScheme(c), {...LOOK, line: 'ink', ...look}];
/** A theme of the collection with some of its look or colours changed. */
const themed = (key, name, note, look = {}, colours = {}) => [name, note, {...COLLECTION[key].spec.colours, ...colours}, {...COLLECTION[key].spec.look, ...look}];
const of = key => COLLECTION[key].spec.colours;
const mix = (a, b, t) => {
  const [al, ac, ah] = typeof a === 'string' ? toLch(a) : a, [bl, bc, bh] = typeof b === 'string' ? toLch(b) : b, dh = ((bh - ah + 540) % 360) - 180;
  return [al + (bl - al) * t, ac + (bc - ac) * t, (ah + dh * t + 360) % 360];
};

const CREAM = [0.93, 0.035, 95], GOLD = [0.84, 0.13, 86], VERMILION = [0.64, 0.19, 34], APRICOT = [0.80, 0.13, 62], BRICK = [0.57, 0.155, 33];
const KEEP = 'Pick every version you would be happy to see in videos; “none” is an answer too.';
const WHERE = 'Pick the themes where it works; “none” is an answer too.';
// where the hits are (analysis/lab-hits.json): strong hits in quick succession, the case the owner described, are in Batidão from
// 38.3 s (five hits of 0.78–0.82 less than half a second apart), in Lua from 40.5 s and in Tomada from 46.5 s; Circus Minimus has
// one hit above 0.8, at 51.3 s
const HIT_MOMENTS = [['Batidão, a run of strong hits, 38 s', 38.3, 'batidao'], ['Lua, a run of strong hits, 41 s', 40.5, 'lua'], ['Tomada, 47 s', 46.5, 'tomada'],
  ['Circus Minimus, its strongest hit, 51 s', 50.6, 'circus']];
const hitPage = {song: 'batidao', t: 38.3, len: 6, moments: HIT_MOMENTS};
const BROWN = {paper: [0.20, 0.028, 55], mass: [0.62, 0.10, 65]}, WINTER = {paper: [0.17, 0.012, 255], sun: [0.95, 0.008, 250], ink: [0.94, 0.008, 250]};
const STARRY = {paper: [0.18, 0.045, 265], mass: [0.78, 0.03, 255], accent: [0.87, 0.10, 90]};

const pages = [
  // ── the hits: one thing changed per page (curves: hits.html) ──
  {id: 'hitSplit', name: 'Hits: the split a quarter stronger', base: 'rothko', ...hitPage,
    line: 'You said the split could be “maybe a quarter stronger”. Only the split changes; shake and colour boost are as they are. Watch it play.', versions: [
      ['Split a quarter stronger', '', {}, {hits: 'split125'}],
    ]},
  {id: 'hitShake', name: 'Hits: the shake starting a little later', base: 'rothko', ...hitPage,
    line: 'Today the shake starts at strength 0.6 (not 0.5) and reaches 24 px at 0.85; most hits are between 0.5 and 0.8. You suggested starting it a little later. Only the shake changes. Watch it play.', versions: [
      ['A little later', 'Starts at 0.63, reaches 24 px at 0.88. A hit of 0.75 shakes 11 px instead of 16.', {}, {hits: 'shakeLater'}],
      ['Later still', 'Starts at 0.66, reaches 24 px at 0.91. A hit of 0.75 shakes 7 px.', {}, {hits: 'shakeLatest'}],
    ]},
  {id: 'hitSpaced', name: 'Hits: strong shakes in quick succession', base: 'rothko', ...hitPage,
    line: 'You said many strong hits close together make the picture harder to read. Here a shake is reduced when it follows a similar or larger one within a second: by half at half a second, never below a quarter. A hit on its own, or stronger than the ones before it, shakes as today.', versions: [
      ['Shakes spaced', 'Only this changes.', {}, {hits: 'shakeSpaced'}],
      ['Shakes spaced, split a quarter stronger', 'Both changes together.', {}, {hits: 'tuned'}],
    ]},
  {id: 'hitLit', name: 'Hits: the band lights', base: 'violetMarigold', ...hitPage,
    line: 'Last time the rule was unclear and you could not tell when it lit. Two simple rules: every bar takes the hot colour for as long as the hit lasts, on the strongest hits only, or on every hit that shakes. Watch it play.', versions: [
      ['On the strongest hits', 'Strength 0.8 or more: four times in these six seconds of Batidão, once in all of Circus Minimus.', {}, {hits: 'lit'}],
      ['On every hit that shakes', 'Strength 0.6 or more: about twice a second in a drop.', {}, {hits: 'litOften'}],
    ]},
  // ── new themes and follow-ups, light and dark in turn ──
  {id: 'tinted', name: 'New light themes: tinted papers', line: 'Stone, Linen, Sage and Sky came from a page like this. Six more, each a quiet tinted ground with dark bars of its own family and one warm note. ' + KEEP, versions: [
    light('Eucalyptus', 'Pale blue-green, deep teal-green bars, a brick bar and sun.', {paper: [0.935, 0.012, 185], mass: [0.38, 0.055, 190], accent: BRICK}),
    light('Heather', 'Pale violet-grey, plum bars, an apricot bar and sun.', {paper: [0.935, 0.011, 315], mass: [0.37, 0.065, 325], accent: [0.76, 0.14, 58]}),
    light('Olive Paper', 'Pale olive, deep olive bars, a red-orange bar and sun.', {paper: [0.935, 0.016, 110], mass: [0.38, 0.055, 115], accent: [0.62, 0.165, 38]}),
    light('Ice', 'Pale ice blue, petrol bars, a burnt-orange bar and sun.', {paper: [0.94, 0.012, 220], mass: [0.36, 0.06, 225], accent: [0.64, 0.15, 44]}),
    light('Lichen', 'Grey-green, charcoal bars, a vermilion bar and sun; the whole course inked.', {paper: [0.93, 0.013, 150], mass: [0.33, 0.012, 150], accent: [0.62, 0.20, 33]}, {line: 'ink'}),
    light('Dove', 'Violet-grey, deep violet-grey bars, a brick bar and sun.', {paper: [0.93, 0.008, 300], mass: [0.34, 0.03, 300], accent: BRICK}),
  ]},
  {id: 'paintings', name: 'New light themes: from painters, on quiet grounds', line: 'The page “from pictures” gave nothing: white grounds, loud bars. These take a painter’s colours onto the kind of ground you choose. One breaks the habit of a warm sun. ' + KEEP, versions: [
    light('Vermeer', 'Linen, ultramarine bars, a lead-tin yellow bar and sun.', {paper: [0.94, 0.018, 90], mass: [0.37, 0.10, 264], accent: [0.84, 0.125, 92]}),
    light('Morandi', 'Dusty cream, grey-blue bars, a terracotta bar and sun.', {paper: [0.93, 0.014, 75], mass: [0.47, 0.03, 240], accent: [0.64, 0.115, 40]}),
    light('Hammershøi', 'Cool grey, black bars, a dull gold bar and sun; the whole course inked.', {paper: [0.925, 0.006, 240], mass: [0.30, 0.008, 250], accent: [0.76, 0.10, 80]}, {line: 'ink'}),
    light('O’Keeffe', 'Bone, red-earth bars, and a sky-blue sun and hot bar.', {paper: [0.94, 0.012, 80], mass: [0.42, 0.09, 35], accent: [0.68, 0.09, 240]}),
    light('Celadon', 'Grey-green glaze, deep celadon bars, an iron-brown bar and sun.', {paper: [0.93, 0.014, 160], mass: [0.42, 0.05, 165], accent: [0.52, 0.11, 45]}),
  ]},
  {id: 'brown', name: 'Brown Room: another hot bar', line: 'You said Brown Room “looks great otherwise” but not its vermilion hot bar. The same room with other hot bars.', versions: [
    dark('Gold', 'A gold hot bar, the cream moon.', {...BROWN, accent: GOLD, sun: CREAM}),
    dark('Cream', 'The hot bar in the moon’s cream.', {...BROWN, accent: CREAM, sun: CREAM}),
    dark('Gold, gold sun', 'A gold hot bar and a gold sun, as in the other rooms.', {...BROWN, accent: GOLD}),
  ]},
  {id: 'paperFamily', name: 'Paper on tinted grounds', base: 'paper', line: 'Paper’s look (the fork, the title, pencil → ink, one red note) on the grounds you chose today. ' + KEEP, versions: [
    ['On Stone', 'Stone’s warm grey.', {paper: of('stone').paper}],
    ['On Linen', '', {paper: of('linen').paper}],
    ['On Sage', '', {paper: of('sage').paper}],
    ['On Sky', 'Sky’s grey-blue.', {paper: of('sky').paper}],
    ['On Stone, a red sun', 'The red sun instead of the title.', {paper: of('stone').paper, sun: of('paper').accent}, {top: 'sun'}],
  ]},
  {id: 'lantern', name: 'Lantern: the hot bar', base: 'lantern', line: 'You suggested the hot bar in the moon’s colour.', versions: [
    ['Moon colour', 'The hot bar exactly the moon’s cream. The difference is one bar: watch it play.', {accent: of('lantern').sun}],
  ]},
  {id: 'amberMix', name: 'Amber: between the Prussian bars and the quiet indigo', base: 'amberPurple', line: 'You asked for a mix of the theme as it is and the quiet indigo (“the best”), which is now in the collection as Amber and Indigo.', versions: [
    ['A third of the way', '', {mass: mix(of('amberPurple').mass, of('amberIndigo').mass, 1 / 3)}],
    ['Two thirds of the way', '', {mass: mix(of('amberPurple').mass, of('amberIndigo').mass, 2 / 3)}],
    ['Quiet indigo', 'Amber and Indigo, to compare.', {mass: of('amberIndigo').mass}],
  ]},
  {id: 'creamBar', name: 'A cream hot bar on gold bars', line: 'On Oxblood and Gold you liked the hot bar in cream but not the ground. The same gold bars and cream hot bar on other grounds. ' + KEEP, versions: [
    dark('On brown-black', 'Copper’s ground.', {paper: of('copper').paper, mass: [0.76, 0.115, 82], accent: [0.95, 0.03, 95], sun: [0.76, 0.115, 82]}),
    dark('On navy', 'Blue Room’s ground.', {paper: of('blueRoom').paper, mass: [0.76, 0.115, 82], accent: [0.95, 0.03, 95], sun: [0.76, 0.115, 82]}),
    dark('On green-black', 'Jungle Moon’s ground.', {paper: of('jungleMoon').paper, mass: [0.76, 0.115, 82], accent: [0.95, 0.03, 95], sun: [0.76, 0.115, 82]}),
    dark('On brown-black, cream moon', 'The moon in cream too; only the bars are gold.', {paper: of('copper').paper, mass: [0.76, 0.115, 82], accent: [0.95, 0.03, 95], sun: CREAM}),
  ]},
  {id: 'rooms', name: 'New dark themes: more rooms', line: 'Four of the six rooms went in. Four more, with bars as light as the ones you chose and no red or pink ground. ' + KEEP, versions: [
    dark('Dusk Room', 'Deep blue-violet, periwinkle bars, a gold bar and sun.', {paper: [0.20, 0.05, 282], mass: [0.60, 0.105, 280], accent: GOLD}),
    dark('Moss Room', 'Deep moss, moss-green bars, an apricot bar and sun.', {paper: [0.20, 0.03, 125], mass: [0.60, 0.085, 122], accent: APRICOT}),
    dark('Steel Room', 'Blue-grey steel, steel bars, a vermilion bar and sun.', {paper: [0.21, 0.02, 245], mass: [0.61, 0.04, 245], accent: VERMILION}),
    dark('Petrol Room', 'Deep petrol blue, petrol bars, a gold bar and sun.', {paper: [0.20, 0.04, 228], mass: [0.58, 0.075, 228], accent: GOLD}),
  ]},
  {id: 'pencil', name: 'Pencil → ink on the inked light themes', line: 'On Stone you chose pencil → ink beside the whole course inked. The same change on the other light themes that are inked from the start. ' + WHERE, versions: [
    themed('dune', 'Dune', '', {line: 'inking'}),
    themed('cutouts', 'Cut-outs', '', {line: 'inking'}),
    themed('paperPrint', 'Paper, black and red print', '', {line: 'inking'}),
    themed('stoneCool', 'Stone, cool', '', {line: 'inking'}),
  ]},
  // ── the band ──
  {id: 'dots', name: 'Dots on other themes', line: 'You liked the dots on Rothko and on Paper (“very neat, very clean”), not on White and Vermilion. Here on six more themes. ' + WHERE, versions: [
    themed('jungleMoon', 'Jungle Moon', '', {band: 'dots'}),
    themed('cyanotype', 'Cyanotype', '', {band: 'dots'}),
    themed('blueRoom', 'Blue Room', '', {band: 'dots'}),
    themed('negoro', 'Negoro Lacquer', '', {band: 'dots'}),
    themed('stone', 'Stone', '', {band: 'dots'}),
    themed('hokusai', 'Hokusai', '', {band: 'dots'}),
  ]},
  {id: 'dotsPlace', name: 'Dots: lower, smaller', base: 'rothko', line: 'The dots have no reflection, so the band can sit a little lower; you suggested that for balance. Bars, then the dots three ways.', versions: [
    ['Dots as last time', '', {}, {band: 'dots'}],
    ['Dots, a little lower', 'Lower by 1.5 % of the height.', {}, {band: 'dotsLow'}],
    ['Smaller dots, a little lower', 'Finer dots, more of them in a column.', {}, {band: 'dotsFine'}],
  ]},
  {id: 'strands', name: 'Strands, thinner', line: 'The strands were “too thick, too bold”, “not slick enough”. On Rothko: as last round, then one step and two steps thinner; all swing wider than before and sit a little lower. Then the middle weight on three other themes. Watch it play.', versions: [
    themed('rothko', 'Rothko, as last round', 'To compare.', {band: 'strands', irisWeight: 'bold'}),
    themed('rothko', 'Rothko, thinner', '', {band: 'strands', irisWeight: 'medium'}),
    themed('rothko', 'Rothko, thinnest', 'As thin as the Iris band in production.', {band: 'strands', irisWeight: 'thin'}),
    themed('jungleMoon', 'Jungle Moon, thinner', '', {band: 'strands', irisWeight: 'medium'}),
    themed('blackIrisMoon', 'Black Iris, thinner, its own colours', 'Silver strands, the front one red, instead of navy and lavender.', {band: 'strands', irisWeight: 'medium'}),
    themed('paper', 'Paper, thinner', '', {band: 'strands', irisWeight: 'medium'}),
  ]},
  {id: 'ribbon', name: 'A wave instead of strands', line: 'Another answer to “not slick enough”: no hairlines at all. The music’s contour is one filled wave in the bars’ colour, fading out downward, with its edge in the hot colour. Watch it play. ' + WHERE, versions: [
    themed('rothko', 'Rothko', '', {band: 'ribbon'}),
    themed('jungleMoon', 'Jungle Moon', '', {band: 'ribbon'}),
    themed('cyanotype', 'Cyanotype', '', {band: 'ribbon'}),
    themed('oldRose', 'Old Rose', '', {band: 'ribbon'}),
    themed('stone', 'Stone', '', {band: 'ribbon'}),
    themed('paper', 'Paper', '', {band: 'ribbon'}),
  ]},
  // ── the sky ──
  {id: 'stars', name: 'Stars: smaller toward the rider', base: 'cobaltChartreuse', line: 'You asked for the stars “a little bit thinner near the level where there’s a rider”. The moon alone, then three ways.', versions: [
    ['Stars as last time', 'All the same size, down to the rider’s level.', {}, {top: 'stars'}],
    ['Smaller toward the rider', 'Full size at the top, less than half at the rider’s level.', {}, {top: 'starsThin'}],
    ['Only high up', 'No star below the moon.', {}, {top: 'starsHigh'}],
  ]},
  {id: 'crescent', name: 'The crescent on other nights', line: 'You were surprised to like the crescent on Old Rose, and suggested it for Winter Moon. ' + WHERE + '', versions: [
    dark('Winter Moon, crescent', 'Winter Moon as last time, with a crescent.', {...WINTER, mass: [0.80, 0.02, 250], accent: [0.63, 0.20, 28]}, {top: 'crescent'}),
    dark('Winter Moon, crescent, darker bars', 'The bars less pale, as on the themes you chose.', {...WINTER, mass: [0.66, 0.035, 250], accent: [0.63, 0.20, 28]}, {top: 'crescent'}),
    themed('seaMoon', 'Sea Moon', '', {top: 'crescent'}),
    themed('oliveMoon', 'Olive Moon', '', {top: 'crescent'}),
    themed('lantern', 'Lantern', '', {top: 'crescent'}),
    themed('jungleMoonGolden', 'Jungle Moon, golden moon', '', {top: 'crescent'}),
    themed('seaMoon', 'Sea Moon, crescent and stars', 'Both, the stars smaller toward the rider.', {top: 'crescentStars'}),
  ]},
  {id: 'starsNew', name: 'Stars on the new dark themes', line: 'The stars, smaller toward the rider, on themes that went in today. ' + WHERE, versions: [
    themed('seaMoon', 'Sea Moon', '', {top: 'starsThin'}),
    themed('oliveMoon', 'Olive Moon', '', {top: 'starsThin'}),
    themed('blueRoom', 'Blue Room', 'Its gold sun as a moon among stars.', {top: 'starsThin'}),
    themed('copper', 'Copper', '', {top: 'starsThin'}),
    themed('lantern', 'Lantern', '', {top: 'starsThin'}),
    themed('jungleMoon', 'Jungle Moon', 'Last time, beside the moon alone, you kept the moon alone.', {top: 'starsThin'}),
  ]},
  {id: 'starry', name: 'Starry Night again', line: 'You saw potential in Starry Night (ink blue, silver band, a pale gold crescent) but its strands were too thick. The same theme with other bands.', versions: [
    dark('Thinner strands', '', STARRY, {top: 'crescent', band: 'strands', irisWeight: 'medium'}),
    dark('Wave', '', STARRY, {top: 'crescent', band: 'ribbon'}),
    dark('Dots', '', STARRY, {top: 'crescent', band: 'dotsLow'}),
    dark('Bars', '', STARRY, {top: 'crescent'}),
    dark('Thinner strands, crescent and stars', '', STARRY, {top: 'crescentStars', band: 'strands', irisWeight: 'medium'}),
  ]},
  {id: 'sunset', name: 'The sunset, with less at the bottom', line: 'You called the sunset “a good idea” but refused it each time: “too much stuff at the bottom right”, the bars over the disc. Here the half disc is smaller and on the left, and the band is the strands, so the sun sets behind a few lines and not behind a wall of bars. ' + WHERE, versions: [
    themed('rothko', 'Rothko', '', {top: 'sunset', band: 'strands', irisWeight: 'medium'}),
    themed('dune', 'Dune', '', {top: 'sunset', band: 'strands', irisWeight: 'medium'}),
    themed('campfire', 'Campfire', '', {top: 'sunset', band: 'strands', irisWeight: 'medium'}),
    themed('lantern', 'Lantern, moonrise', '', {top: 'sunset', band: 'strands', irisWeight: 'medium'}),
    themed('stone', 'Stone', '', {top: 'sunset', band: 'strands', irisWeight: 'medium'}),
  ]},
];
writeRound({set: 'master', round: 49, about: 'Round 49, the master round: the hits’ curves, new light and dark themes, follow-ups, the band (dots, strands, a ribbon), the sky (stars, crescent, sunset).',
  source: 'Round 49 · the master round', prefix: 'r49', pages});
