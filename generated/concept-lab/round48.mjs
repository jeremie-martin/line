// Round 48 (owner, 2026-11-13: "be much more ambitious": new visual ideas besides the sun, the moon and the title; the hit
// effects revisited; many more original themes; 24 to 30 questions, quality over quantity). New things at the top of the frame
// (sky.js), new shapes for the band, new answers to a hit and a line option, all as lab values of the look's options (look.js);
// then whole looks that combine them, and new themes.
//   node generated/concept-lab/round48.mjs   → candidates-ideas1.json (open /generated/concept-lab/?set=ideas1&q=1)
import {COLLECTION} from '../../scripts/video/collection.js';
import {darkScheme, lightScheme, writeRound} from './lab-colour.mjs';

const LOOK = {accent: 'heat', band: 'bars', bandHeight: 'lowmid', drop: 'off', ends: 'course', hits: 'v1', irisWeight: 'thin', line: 'inking',
  paper: 'vibranceSoftHalfPaper', riderLower: '0', sunLift: '16', sunRider: '32', top: 'sun', zoom: 'steady'};
const light = (name, note, c, look = {}) => [name, note, lightScheme(c), {...LOOK, ...look}];
const dark = (name, note, c, look = {}) => [name, note, darkScheme(c), {...LOOK, line: 'ink', ...look}];
/** A theme of the collection with some of its look changed. */
const themed = (key, name, note, look = {}, colours = {}) => [name, note, {...COLLECTION[key].spec.colours, ...colours}, {...COLLECTION[key].spec.look, ...look}];
const of = key => COLLECTION[key].spec.colours;

const CREAM = [0.93, 0.035, 95], GOLD = [0.84, 0.13, 86], VERMILION = [0.64, 0.19, 34], APRICOT = [0.80, 0.13, 62], AMBER = of('amberPurple').accent;
const IDEA = 'A new idea, shown on a theme you like. Pick every version you would be happy to see in videos; “none” is an answer too.';
const THEMES = 'New themes, each a first attempt. Keep any you would be happy to see in videos; say what is close.';
const band = [
  ['Both ways', 'Bars up and down from a centre line, no reflection.', {}, {band: 'mirror'}],
  ['Dots', 'Each bar a column of dots.', {}, {band: 'dots'}],
  ['Skyline', 'Bars without gaps: one stepped mass.', {}, {band: 'skyline'}],
  ['Wide bars', 'A third as many bars, each wider.', {}, {band: 'wide'}],
  ['Strands', 'The Iris band’s strands in the theme’s colours, the front one in the hot colour.', {}, {band: 'strands'}],
];

const pages = [
  // ── at the top of the frame ──
  {id: 'skyDark', name: 'Besides the moon: on Jungle Moon', base: 'jungleMoon', line: IDEA, versions: [
    ['Crescent', 'A crescent instead of the full moon.', {}, {top: 'crescent'}],
    ['Moon and stars', 'The moon, and a few fixed stars.', {}, {top: 'stars'}],
    ['Ring', 'A ring: an eclipse.', {}, {top: 'ring'}],
    ['Great pale moon', 'A very large, pale moon, partly out of the frame.', {}, {top: 'great'}],
    ['Moonrise', 'The moon half risen behind the bars.', {}, {top: 'horizon'}],
  ]},
  {id: 'skyLight', name: 'Besides the sun: on Dune', base: 'dune', line: IDEA, versions: [
    ['Sunset', 'The sun half set behind the bars.', {}, {top: 'horizon'}],
    ['Great pale sun', 'A very large, pale sun, partly out of the frame.', {}, {top: 'great'}],
    ['Sun over hills', 'Three pale ridges behind the bars, under the sun.', {}, {top: 'hills'}],
    ['Ring', 'A ring instead of a disc.', {}, {top: 'ring'}],
    ['Rays', 'The music as rays around the sun; the bars stay.', {}, {top: 'rays'}],
    ['Rays, no bars', 'The rays are the only music in the picture.', {}, {top: 'rays', band: 'none'}],
  ]},
  {id: 'skyHokusai', name: 'A landscape behind the bars: on Hokusai', base: 'hokusai', line: IDEA + ' The landscape does not move with the ride.', versions: [
    ['The mountain', 'One pale mountain behind the bars, under the sun.', {}, {top: 'fuji'}],
    ['Hills', 'Three pale ridges.', {}, {top: 'hills'}],
    ['Sunset', 'The sun half set behind the bars.', {}, {top: 'horizon'}],
    ['Great pale sun', '', {}, {top: 'great'}],
  ]},
  {id: 'stars', name: 'Moon and stars on other nights', line: 'The same idea on five dark themes of the collection. Pick the ones where it works.', versions: [
    themed('cobaltChartreuse', 'Cobalt and Chartreuse', '', {top: 'stars'}),
    themed('lilyLeaf', 'Lily White and Leaf Green', 'Its green moon, and stars.', {top: 'stars'}),
    themed('blackIrisMoon', 'Black Iris', '', {top: 'stars'}),
    themed('ceruleanCoralNightMoon', 'Cerulean and Coral, night', '', {top: 'stars'}),
    themed('cyanotypeWhiteSun', 'Cyanotype, white sun', '', {top: 'stars'}),
    themed('oldRose', 'Old Rose, crescent', 'Old Rose has the title; here a gold crescent instead.', {top: 'crescent'}),
  ]},
  {id: 'horizon', name: 'Sunset and moonrise on other themes', line: 'The half disc behind the bars on six themes of the collection. Pick the ones where it works.', versions: [
    themed('rothko', 'Rothko', '', {top: 'horizon'}),
    themed('violetMarigold', 'Violet and Marigold', '', {top: 'horizon'}),
    themed('whiteVermilion', 'White and Vermilion', '', {top: 'horizon'}),
    themed('amberSumi', 'Sumi and Amber', '', {top: 'horizon'}),
    themed('stone', 'Stone', '', {top: 'horizon'}),
    themed('cyanotype', 'Cyanotype', '', {top: 'horizon'}),
  ]},
  // ── the band ──
  {id: 'bandDark', name: 'Other shapes for the band: on Rothko', base: 'rothko', line: IDEA, versions: band},
  {id: 'bandLight', name: 'Other shapes for the band: on White and Vermilion', base: 'whiteVermilion', line: IDEA, versions: band},
  {id: 'strands', name: 'Strands in a theme’s own colours', line: 'The Iris band is always navy and lavender. Here its strands take each theme’s colours. Pick the ones where it works.', versions: [
    themed('blackIrisMoon', 'Black Iris', 'Silver strands, the front one red.', {band: 'strands'}),
    themed('jungleMoon', 'Jungle Moon', '', {band: 'strands'}),
    themed('cyanotype', 'Cyanotype', '', {band: 'strands'}),
    themed('oldRose', 'Old Rose', '', {band: 'strands'}),
    themed('hokusai', 'Hokusai', '', {band: 'strands'}),
    themed('stone', 'Stone', '', {band: 'strands'}),
  ]},
  {id: 'bandPaper', name: 'Other shapes for the band: on Paper', base: 'paper', line: 'Paper has the tuning fork. ' + IDEA, versions: [
    ['Dots', 'Columns of dots, the loudest in red.', {}, {band: 'dots'}],
    ['Both ways', '', {}, {band: 'mirror'}],
    ['Wide bars', '', {}, {band: 'wide'}],
    ['Strands', '', {}, {band: 'strands'}],
  ]},
  // ── hits and the line ──
  {id: 'hitStrength', name: 'Hits: how strong', base: 'rothko', line: 'The hit effects as they are (split, colour boost, shake on strong hits), weaker and stronger. Watch it play; the third and fourth moments have the strongest hits.', versions: [
    ['A third weaker', '', {}, {hits: 'soft'}],
    ['A third stronger', '', {}, {hits: 'strong'}],
  ]},
  {id: 'hitPicture', name: 'Hits: the picture answers too', base: 'violetMarigold', line: 'Each adds one thing to the hit effects as they are, in proportion to the hit. Watch it play.', versions: [
    ['The sun swells', 'The sun grows for an instant.', {}, {hits: 'sunKick'}],
    ['The band jumps', 'Every bar jumps for an instant.', {}, {hits: 'bandKick'}],
    ['The band lights', 'On a hit every bar takes the hot colour for an instant.', {}, {hits: 'wash'}],
  ]},
  {id: 'hitImpact', name: 'Hits: something at the point of impact', base: 'dune', line: 'Each adds one thing where the rider strikes the line. Watch it play.', versions: [
    ['Strokes', 'Short strokes in the hot colour fly out from the impact.', {}, {hits: 'burst'}],
    ['Dust', 'Grains are thrown up from the line and fall.', {}, {hits: 'dust'}],
  ]},
  {id: 'hitImpactDark', name: 'Hits: the same on a dark theme', base: 'jungleMoon', line: 'The two impact ideas on Jungle Moon. Watch it play.', versions: [
    ['Strokes', '', {}, {hits: 'burst'}],
    ['Dust', '', {}, {hits: 'dust'}],
  ]},
  {id: 'trail', name: 'The line: a hot trail', line: 'The stretch the rider has just ridden stays in the hot colour for a quarter of a second. Watch it play. Pick the ones where it works.', versions: [
    themed('whiteVermilion', 'White and Vermilion, as it is', 'To compare.'),
    themed('whiteVermilion', 'White and Vermilion, hot trail', '', {line: 'trail'}),
    themed('hokusai', 'Hokusai, hot trail', '', {line: 'trail'}),
    themed('amberSumi', 'Sumi and Amber, hot trail', '', {line: 'trail'}),
    themed('paper', 'Paper, hot trail', '', {line: 'trail'}),
    themed('lavender', 'Lavender Dusk, hot trail', '', {line: 'trail'}),
  ]},
  // ── whole looks ──
  {id: 'looksDark', name: 'Whole new looks, dark', line: 'Each combines the new ideas into one picture. ' + THEMES, versions: [
    dark('Eclipse', 'Black, a white ring, grey bars both ways, the hot bar in red.', {paper: [0.16, 0.004, 260], mass: [0.72, 0.006, 260], accent: [0.63, 0.21, 28], sun: [0.95, 0.005, 90], ink: [0.95, 0.004, 260]}, {top: 'ring', band: 'mirror'}),
    dark('Starry Night', 'Ink blue, silver strands, a crescent in pale gold.', {paper: [0.18, 0.045, 265], mass: [0.78, 0.03, 255], accent: [0.87, 0.10, 90]}, {top: 'crescent', band: 'strands'}),
    dark('Harvest Moon', 'Blue-black, wheat bars, a great golden moon.', {paper: [0.16, 0.02, 265], mass: [0.78, 0.08, 85], accent: VERMILION, sun: [0.86, 0.11, 85]}, {top: 'great'}),
    themed('rothko', 'Rothko at sunset', 'Rothko’s room, the sun half set behind a skyline.', {top: 'horizon', band: 'skyline'}),
    dark('Night Hills', 'Deep teal night, pale ridges, a cream moon, cream bars.', {paper: [0.19, 0.035, 215], mass: [0.84, 0.035, 95], accent: [0.72, 0.15, 38], sun: CREAM}, {top: 'hills'}),
    dark('Dotted Night', 'Warm black, gold dots, a cream moon and stars.', {paper: [0.16, 0.012, 60], mass: [0.80, 0.10, 85], accent: VERMILION, sun: CREAM}, {top: 'stars', band: 'dots'}),
  ]},
  {id: 'looksLight', name: 'Whole new looks, light', line: 'Each combines the new ideas into one picture. ' + THEMES, versions: [
    themed('hokusai', 'Hokusai, the mountain and a skyline', '', {top: 'fuji', band: 'skyline'}),
    themed('dune', 'Dune at sunset', 'The sun half set behind wide bars.', {top: 'horizon', band: 'wide'}),
    themed('stone', 'Stone, ring and dots', '', {top: 'ring', band: 'dots'}),
    themed('whiteVermilion', 'White and Vermilion, rays', 'The music only as rays round the gold sun.', {top: 'rays', band: 'none'}),
    light('Sage Hills', 'Sage, green ridges and bars, a terracotta sun.', {paper: [0.945, 0.02, 140], mass: [0.42, 0.07, 150], accent: [0.66, 0.145, 44]}, {top: 'hills'}),
    themed('paper', 'Paper, dots and a red ring', '', {top: 'ring', band: 'dots'}, {sun: of('paper').accent}),
  ]},
  // ── new themes ──
  {id: 'rooms', name: 'New dark themes: rooms, after Rothko', line: 'Rothko is a maroon room with brick bars: a deep ground and bars in the same family. Other rooms. ' + THEMES, versions: [
    dark('Blue Room', 'Deep navy, blue bars, a gold bar and sun.', {paper: [0.20, 0.045, 262], mass: [0.58, 0.10, 256], accent: GOLD}),
    dark('Green Room', 'Deep green, leaf-green bars, a gold bar and sun.', {paper: [0.20, 0.035, 160], mass: [0.58, 0.095, 155], accent: GOLD}),
    dark('Violet Room', 'Deep violet, violet bars, an apricot bar and sun.', {paper: [0.20, 0.05, 300], mass: [0.56, 0.11, 300], accent: APRICOT}),
    dark('Brown Room', 'Deep brown, ochre bars, a cream sun; the hot bar in vermilion.', {paper: [0.20, 0.028, 55], mass: [0.62, 0.10, 65], accent: VERMILION, sun: CREAM}),
    dark('Teal Room', 'Deep teal, sea-green bars, a coral bar and sun.', {paper: [0.21, 0.035, 200], mass: [0.62, 0.06, 195], accent: [0.72, 0.15, 38]}),
    dark('Grey Room', 'Charcoal, grey bars, a vermilion bar and sun.', {paper: [0.21, 0.006, 260], mass: [0.62, 0.008, 260], accent: VERMILION}),
  ]},
  {id: 'moons', name: 'New dark themes: moons, after Jungle Moon', line: 'Jungle Moon is a near-black night, muted bars, a cream moon and one hot bar. Other nights. ' + THEMES, versions: [
    dark('Desert Moon', 'Brown-black, sand bars, a cream moon; the hot bar in vermilion.', {paper: [0.17, 0.02, 50], mass: [0.72, 0.06, 75], accent: VERMILION, sun: CREAM}),
    dark('Sea Moon', 'Blue-black, steel-blue bars, a cream moon; the hot bar in apricot.', {paper: [0.17, 0.03, 235], mass: [0.66, 0.05, 235], accent: APRICOT, sun: CREAM}),
    dark('Plum Moon', 'Plum-black, mauve bars, a cream moon; the hot bar in gold.', {paper: [0.17, 0.035, 330], mass: [0.66, 0.06, 340], accent: GOLD, sun: CREAM}),
    dark('Winter Moon', 'Blue-grey black, frost bars, a white moon; the hot bar in red.', {paper: [0.17, 0.012, 255], mass: [0.80, 0.02, 250], accent: [0.63, 0.20, 28], sun: [0.95, 0.008, 250], ink: [0.94, 0.008, 250]}),
    dark('Olive Moon', 'Olive-black, olive bars, a cream moon; the hot bar in orange.', {paper: [0.18, 0.025, 115], mass: [0.66, 0.07, 110], accent: [0.74, 0.16, 55], sun: CREAM}),
    dark('Rose Moon', 'Wine-black, dusty rose bars, a cream moon; the hot bar in gold.', {paper: [0.17, 0.035, 10], mass: [0.66, 0.085, 12], accent: GOLD, sun: CREAM}),
  ]},
  {id: 'materials', name: 'New dark themes: metals and stone', line: THEMES, versions: [
    dark('Copper', 'Brown-black, copper bars, a cream moon; the hot bar in pale gold.', {paper: [0.17, 0.02, 45], mass: [0.63, 0.105, 50], accent: [0.88, 0.10, 90], sun: CREAM}),
    dark('Verdigris', 'Dark teal, verdigris bars, a copper bar and sun.', {paper: [0.19, 0.03, 190], mass: [0.70, 0.065, 180], accent: [0.67, 0.125, 50]}),
    dark('Indigo and Silver', 'Deep indigo, silver bars and moon; the hot bar in vermilion.', {paper: [0.19, 0.055, 268], mass: [0.80, 0.012, 260], accent: VERMILION, sun: [0.90, 0.01, 260]}),
    dark('Oxblood and Gold', 'Oxblood, gold bars and sun; the hot bar in cream.', {paper: [0.20, 0.05, 20], mass: [0.76, 0.115, 82], accent: [0.95, 0.03, 95], sun: [0.76, 0.115, 82]}),
    dark('Slate and Chalk', 'Green-grey slate, chalk bars, a yellow-chalk bar; the title.', {paper: [0.26, 0.018, 165], mass: [0.88, 0.012, 100], accent: [0.87, 0.105, 95]}, {top: 'title'}),
    dark('Bronze', 'Bronze-black, bronze bars, a cream moon; the hot bar in orange.', {paper: [0.18, 0.02, 90], mass: [0.66, 0.08, 85], accent: [0.72, 0.15, 50], sun: CREAM}),
  ]},
  {id: 'places', name: 'New dark themes: places', line: THEMES, versions: [
    dark('Lantern', 'Night blue, lantern-orange bars, a pale moon; the hot bar in pale gold.', {paper: [0.19, 0.045, 265], mass: [0.71, 0.125, 55], accent: [0.89, 0.09, 92], sun: CREAM}),
    dark('Deep Sea', 'Deep sea blue, sea-green bars, a cream moon; the hot bar in coral.', {paper: [0.18, 0.04, 228], mass: [0.64, 0.06, 200], accent: [0.72, 0.15, 38], sun: CREAM}),
    dark('Plum Blossom', 'Dark plum, blossom-pink bars, a cream moon; the hot bar in gold.', {paper: [0.20, 0.05, 335], mass: [0.84, 0.055, 355], accent: GOLD, sun: CREAM}),
    dark('Midnight Garden', 'Green-black, rose-mauve bars, a cream moon; the hot bar in gold.', {paper: [0.17, 0.03, 150], mass: [0.67, 0.095, 348], accent: GOLD, sun: CREAM}),
    dark('North', 'Blue-black, pale green bars, a cream moon; the hot bar in pale yellow.', {paper: [0.17, 0.03, 250], mass: [0.76, 0.085, 162], accent: [0.91, 0.09, 102], sun: CREAM}),
    dark('Campfire', 'Warm black, ember-red bars, a gold bar and sun.', {paper: [0.16, 0.015, 45], mass: [0.56, 0.16, 35], accent: [0.84, 0.13, 80]}),
  ]},
  {id: 'titles', name: 'New dark themes with the title', line: 'Old Rose, Gilt and Amber and Negoro carry the title. Others that might. ' + THEMES, versions: [
    dark('Jade and Gold', 'Green-black, jade bars, a gold bar.', {paper: [0.18, 0.03, 170], mass: [0.70, 0.08, 165], accent: GOLD}, {top: 'title'}),
    dark('Ash and Ember', 'Warm black, ash-grey bars, an ember bar.', {paper: [0.18, 0.006, 60], mass: [0.70, 0.01, 80], accent: [0.66, 0.19, 40]}, {top: 'title'}),
    dark('Ink and Rose', 'Ink blue, rose bars, a gold bar.', {paper: [0.17, 0.035, 270], mass: [0.72, 0.09, 5], accent: GOLD}, {top: 'title'}),
    dark('Wine and Sand', 'Wine-black, sand bars, an orange bar.', {paper: [0.19, 0.05, 10], mass: [0.80, 0.05, 80], accent: [0.72, 0.16, 50]}, {top: 'title'}),
    dark('Petrol and Peach', 'Petrol blue, peach bars, a pale lemon bar.', {paper: [0.21, 0.04, 215], mass: [0.80, 0.09, 55], accent: [0.92, 0.10, 102]}, {top: 'title'}),
    dark('Moss and Bone', 'Moss-black, bone bars, a vermilion bar.', {paper: [0.20, 0.03, 125], mass: [0.86, 0.03, 90], accent: VERMILION}, {top: 'title'}),
  ]},
  {id: 'mid', name: 'New themes: middle grounds', line: 'Neither light nor dark, as Cyanotype is: a mid-tone ground, pale bars, a cream line. ' + THEMES, versions: [
    dark('Denim', 'Denim blue, cream bars, a cream sun; the hot bar in orange.', {paper: [0.42, 0.06, 255], mass: [0.90, 0.03, 90], accent: [0.76, 0.15, 58], sun: CREAM}),
    dark('Olive', 'Olive green, cream bars, a cream sun; the hot bar in vermilion.', {paper: [0.43, 0.05, 125], mass: [0.90, 0.03, 90], accent: [0.66, 0.19, 34], sun: CREAM}),
    dark('Dusty Teal', 'Dusty teal, cream bars, a coral bar and sun.', {paper: [0.44, 0.05, 200], mass: [0.90, 0.03, 90], accent: [0.76, 0.13, 38]}),
    dark('Plum', 'Plum, pale pink bars, a gold bar and sun.', {paper: [0.38, 0.06, 335], mass: [0.87, 0.04, 10], accent: GOLD}),
    dark('Slate', 'Slate grey, pale grey bars, a yellow bar and sun.', {paper: [0.42, 0.015, 255], mass: [0.88, 0.008, 255], accent: [0.87, 0.13, 92]}),
    dark('Umber', 'Umber brown, cream bars, a cream sun; the hot bar in orange.', {paper: [0.40, 0.04, 60], mass: [0.90, 0.03, 90], accent: [0.76, 0.15, 58], sun: CREAM}),
  ]},
  {id: 'dunes', name: 'New light themes: Dune’s cousins', base: 'dune', line: 'Dune is sand, rust bars, an amber bar and an orange sun, all inked. The same page with other bars. ' + THEMES, versions: [
    ['Indigo bars', '', {mass: [0.34, 0.08, 262], ink: [0.24, 0.02, 262]}],
    ['Pine bars', '', {mass: [0.38, 0.075, 160], ink: [0.24, 0.02, 160]}],
    ['Sumi bars', 'Ink-black bars.', {mass: [0.28, 0.008, 80], ink: [0.22, 0.008, 80]}],
    ['Oxblood bars', '', {mass: [0.36, 0.11, 20]}],
    ['Paler sand', 'The theme as it is on a paler sand.', {paper: [0.955, 0.02, 85]}],
    ['Red sun', 'The theme as it is with a red sun.', {sun: [0.58, 0.19, 30]}],
  ]},
  {id: 'pastel', name: 'New light themes: pale bars', line: 'Every light theme so far has dark bars. Here the bars are pale and the sun carries the colour; the whole course is inked. ' + THEMES, versions: [
    light('Peach', 'Warm white, peach bars, a vermilion bar and sun.', {paper: [0.975, 0.01, 80], mass: [0.84, 0.075, 55], accent: VERMILION, ink: '#25201e'}, {line: 'ink'}),
    light('Sky Bars', 'White, sky-blue bars, an amber bar and sun.', {paper: [0.98, 0.004, 240], mass: [0.82, 0.06, 245], accent: AMBER, ink: '#1b1f29'}, {line: 'ink'}),
    light('Sage Bars', 'Warm white, sage bars, a terracotta bar and sun.', {paper: [0.975, 0.01, 100], mass: [0.80, 0.055, 145], accent: [0.64, 0.15, 42], ink: '#1e231f'}, {line: 'ink'}),
    light('Lilac Bars', 'White, lilac bars, an apricot bar and sun.', {paper: [0.98, 0.004, 300], mass: [0.80, 0.06, 300], accent: [0.78, 0.14, 62], ink: '#231f29'}, {line: 'ink'}),
    light('Sand Bars', 'Ivory, sand bars, a brick bar and sun.', {paper: [0.97, 0.014, 88], mass: [0.82, 0.055, 80], accent: [0.57, 0.155, 33], ink: '#26211b'}, {line: 'ink'}),
    light('Grey Bars', 'White, pale grey bars, a red bar and sun.', {paper: [0.985, 0.002, 90], mass: [0.82, 0.004, 260], accent: [0.60, 0.21, 28], ink: '#15181d'}, {line: 'ink'}),
  ]},
];
writeRound({set: 'ideas1', round: 48, about: 'Round 48: new things at the top of the frame, band shapes, hit answers, a hot trail; whole looks; new themes.',
  source: 'Round 48 · new ideas', prefix: 'r48', pages});
