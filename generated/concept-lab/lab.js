// Concept lab, round 4: the real saved ride, drawn live with the vendored rider artwork and native replay, an automatic
// camera (cam.js), an intensity metric that knows nothing about any layer (intensity.js), and independent concept layers.
import {createMusic, displayTime} from '/shared/playback.js';
import * as N from './dist/native.js';
import * as C from './cam.js';
import * as I from './intensity.js';

const W = 1080, H = 1920, FPS = 40;
const INK = '#15181d', PENCIL = '#b4bcc8', NIGHT = '#14171d';
const SRC = {drums: '#15181d', vocals: '#2b59d6', sung: '#2b59d6', bass: '#7b3fbf', other: '#e0532f'};
const Z0 = 5.4; // today's vertical zoom
const SIZE_Z = {s58: 5.8, s62: 6.2, s68: 6.8};
// One optional, hand-placed cue per song: a drop is a musical judgement, and no detector found it reliably.
const NIGHTS = {petrunko: [22.4, 40.5], los: [23.9, 40.5], lua: [29.7, 49.6], batidao: [15.2, 29.5], burn: [4.5, 24.5], coma: [19.1, 33.6], tomada: [37.0, 50.0]};

// A scheme is a whole print identity: every colour below comes from these tokens. Validated in agents/round4-ideas (contrast, 4:2:0).
const SCHEMES = {
  graphite: {tone: '#eef2f8', paper: '#ffffff', ink: '#15181d', pencil: '#b4bcc8', mass: '#3b414a', accent: '#d3262e', nightPaper: '#14171d', nightInk: '#eef1f5'},
  hokusai: {paper: '#f4ecdc', ink: '#12294d', pencil: '#b8b4a4', mass: '#1d3e73', accent: '#d4412a', nightPaper: '#0d1f3f', nightInk: '#f4ecdc'},
  klein: {paper: '#ffffff', ink: '#0d1433', pencil: '#b4bcd8', mass: '#0f2fb5', accent: '#f2500f', nightPaper: '#0a1a6e', nightInk: '#f5f7ff'},
  bottle: {paper: '#f3f1e4', ink: '#0e2e27', pencil: '#b0b9a8', mass: '#14604c', accent: '#c96805', nightPaper: '#0a2a23', nightInk: '#f6efcf'},
  salmon: {paper: '#fce6d9', ink: '#3a1024', pencil: '#cfb3a8', mass: '#7a1438', accent: '#007a78', nightPaper: '#2b0a1a', nightInk: '#fce6d9'},
  black: {paper: '#101216', ink: '#eef1f5', pencil: '#4c535f', mass: '#c9ced6', accent: '#ff4d3d', nightPaper: '#101216', nightInk: '#eef1f5'},
  lagoon: {paper: '#e6f1ef', ink: '#052b35', pencil: '#a9c3c1', mass: '#0e6f78', accent: '#f4623a', nightPaper: '#06262e', nightInk: '#e6f1ef'},
  riso: {paper: '#f7f3e9', ink: '#1a2f9c', pencil: '#b9b7cf', mass: '#2a47c9', accent: '#ff3d7f', nightPaper: '#14206e', nightInk: '#f7f3e9'},
  dune: {paper: '#efe2cd', ink: '#3a2115', pencil: '#c4b197', mass: '#8c3a1c', accent: '#e39a1b', sun: '#d8622a', nightPaper: '#2a160d', nightInk: '#efe2cd'},
  plum: {paper: '#1c1025', ink: '#f5e9fb', pencil: '#5c4a6a', mass: '#cfb2e6', accent: '#ffb000', nightPaper: '#1c1025', nightInk: '#f5e9fb'},
  // Round 6 candidates (agents/colour-r6): lightness first, since a thin line on a phone is read by lightness and 4:2:0 encoding
  // keeps only 10–60 % of a thin line's chroma. Near-black ink on calm paper; colour lives in the band, the accent and the sun.

  // Fog over a harbour: blue-grey paper, slate band, one mustard bar. Cool, calm, muted.
  slate: {paper: '#ecf1f5', ink: '#131e2b', pencil: '#aeb9c2', mass: '#486176', accent: '#deac2e', nightPaper: '#101c28', nightInk: '#ecf1f5'},
  // A 1970s print: linen, olive band, a tomato bar and an ochre sun. Warm and a little retro.
  olive: {paper: '#f3efdc', ink: '#222312', pencil: '#bebba9', mass: '#5c6325', accent: '#ed6b42', sun: '#e3ad4b', nightPaper: '#1a1c08', nightInk: '#f3efdc'},
  // Dusk: a pale mauve paper, dusty violet band, apricot bar; the day side of Plum, which is its night.
  mauve: {paper: '#f5edf4', ink: '#291c2f', pencil: '#c2b6c5', mass: '#72577f', accent: '#ed9c55', nightPaper: '#1c1025', nightInk: '#f5e9fb'},
  // Bold: bone paper, solid black bars, one cobalt bar. The loudest light scheme, loud by contrast rather than colour.
  bauhaus: {paper: '#f6f3eb', ink: '#0f0f0f', pencil: '#c0beb8', mass: '#161616', accent: '#3672e9', nightPaper: '#0f0f0f', nightInk: '#f6f3eb'},
  // Brush and seal: warm white, sumi ink, a pale grey band, and the accent as a vermilion stamp. The quietest band.
  sumi: {paper: '#f7f3ec', ink: '#1a1512', pencil: '#c2bdb7', mass: '#aaa39d', accent: '#d33e21', nightPaper: '#1a1512', nightInk: '#f7f3ec'},
  // Deep night blue, steel band, an amber bar, a pale moon instead of a sun.
  midnight: {paper: '#0b1726', ink: '#ebf1f7', pencil: '#4a5666', mass: '#7b95b0', accent: '#fda856', sun: '#d8d1bb', nightPaper: '#0b1726', nightInk: '#ebf1f7'},
  // Warm dark: coffee paper, cream line, latte band, one verdigris bar.
  espresso: {paper: '#1e130e', ink: '#f4ead9', pencil: '#584d45', mass: '#ae9278', accent: '#65d2d2', nightPaper: '#1e130e', nightInk: '#f4ead9'},
  // Forest at night: green-black paper, ivory line, sage band, one pale coral bar.
  moss: {paper: '#0c1c12', ink: '#eff0e1', pencil: '#445547', mass: '#809b80', accent: '#f9a782', nightPaper: '#0c1c12', nightInk: '#eff0e1'},
  // Round 7 candidates (agents/palettes-r7): designed by hand from named sources, not from a metric. Not yet shown to the owner.

  // LIGHT
  // Cahier Seyès (French school exercise book): blue-black Quink ink, pale ruled-blue bars, the red margin as accent.
  // Character: schoolroom-crisp and friendly; coloured ink that still reads (98 / 24 / 73 / 49).
  cahier: {paper: '#fbfaf4', ink: '#1d357a', pencil: '#c3cbe0', mass: '#9fb3db', accent: '#d8343a', nightPaper: '#14244f', nightInk: '#fbfaf4'},
  // Toile de Jouy (one-colour copperplate on cotton): cream, oxblood line, faded-madder bars, the loudest bar in full oxblood.
  // Character: a single-ink print, elegant and quiet; accent darker than the bars, not brighter (95 / 23 / 70 / 31).
  toile: {paper: '#f4efe5', ink: '#6a1520', pencil: '#d9c4bb', mass: '#cfa59c', accent: '#8f1b28', sun: '#c9585a', nightPaper: '#2a0a10', nightInk: '#f4efe5'},
  // Eric Ravilious (chalk downs, 1930s watercolour and wood engraving): chalky paper, green-black line, sage bars, one ochre.
  // Character: English pastoral, cool and gentle (94 / 20 / 49 / 77).
  ravilious: {paper: '#f0eee2', ink: '#24342c', pencil: '#bfc3b2', mass: '#5f7a65', accent: '#eeb52f', nightPaper: '#18241e', nightInk: '#f0eee2'},
  // Lavender (a refined Mauve, after the owner's "slightly too pink"): grey lilac paper, aubergine line, dusk-violet bars, apricot.
  // Character: Plum's daytime side without the pink (94 / 15 / 43 / 72).
  lavender: {paper: '#eeecf1', ink: '#28213a', pencil: '#c2bdcb', mass: '#6c6185', accent: '#f0a04f', nightPaper: '#1c1025', nightInk: '#f5e9fb'},
  // Kraft (screenprint on brown kraft paper, gig posters): mid-tone paper, black line, umber bars, the loudest bar in white ink.
  // Character: graphic, tactile, the first mid-tone paper; the accent is pure lightness (75 / 7 / 26 / 98).
  kraft: {paper: '#d2b48e', ink: '#1a140e', pencil: '#a2845f', mass: '#4a3a2a', accent: '#fffaf0', sun: '#f7f1e3', nightPaper: '#1a140e', nightInk: '#e6d2b4'},
  // Blade Runner 2049, the Las Vegas sequence (Deakins' orange haze): orange air, black line, burnt bars, a white-hot bar.
  // Character: the boldest light scheme, Dune turned up to full heat (73 / 8 / 35 / 95).
  vegas: {paper: '#e9a866', ink: '#2a1206', pencil: '#bd7b40', mass: '#8a3a10', accent: '#fff0d4', sun: '#fbe2b8', nightPaper: '#2a1206', nightInk: '#e9a866'},

  // DARK
  // Cyanotype (Anna Atkins' blueprint photograms): Prussian-blue paper, the line in paper white, pale-blue bars, one yellow.
  // Character: a mid-dark, luminous blue rather than night; cool and clear (32 / 95 / 57 / 83).
  cyanotype: {paper: '#1f4a86', ink: '#f4f1e6', pencil: '#5576a6', mass: '#6a8bbd', accent: '#ffc83d', nightPaper: '#122e57', nightInk: '#f4f1e6'},
  // Kintsugi (Japanese gold repair on black urushi lacquer): the ridden line becomes gold; lacquer-red bars; the loudest in gold.
  // Character: precious and dramatic; coloured ink that reads by lightness (6 / 78 / 35 / 84). Suggested sun: lacquer red.
  kintsugi: {paper: '#141210', ink: '#e2bb5f', pencil: '#433d34', mass: '#8e3427', accent: '#f2cc6e', sun: '#c43a2c', nightPaper: '#141210', nightInk: '#e2bb5f'},
  // Rothko, the Seagram murals (maroon on maroon): deep maroon paper, a peach-cream line, brick bars, a candle-gold bar.
  // Character: warm, saturated dark; a red room rather than a black one (7 / 89 / 46 / 83).
  rothko: {paper: '#2b0c10', ink: '#f6dcc4', pencil: '#6a3a38', mass: '#b84a42', accent: '#ffc46b', nightPaper: '#1a0709', nightInk: '#f6dcc4'},
  // Café (Espresso refined, after the owner's verdict that Dune's amber suited it): coffee, cream line, darker latte bars, amber.
  // Character: Black's warm sibling; the latte bars are darkened so the amber stands apart in lightness (7 / 93 / 49 / 77).
  cafe: {paper: '#1e130e', ink: '#f4ead9', pencil: '#584d45', mass: '#8a6f58', accent: '#ffb000', nightPaper: '#1e130e', nightInk: '#f4ead9'},
  // Round 10: from Sanzo Wada's Dictionary of Color Combinations (agents/wada): each a proven combination, assigned to our roles
  // with the rules learned from the owner's verdicts (bars carry more colour than the paper; paper and bars in one family, etc.).

  // Prussian — Wada no. 343 (Burnt Sienna, Ivory Buff, Deep Grayish Olive, Vandar Poel's Blue).
  //   paper Ivory Buff · bars Vandar Poel's Blue · accent Burnt Sienna · ink made · adjusted: paper L 0.875→0.935, C 0.069→0.026; accent L 0.546→0.63
  //   Hokusai's sea-green cousin: ivory, a deep Prussian teal band, one burnt-sienna bar.
  wPrussian: {paper: '#f2e9d6', ink: '#0b2532', pencil: '#adaea5', mass: '#064f6e', accent: '#ca6b3f', nightPaper: '#041620', nightInk: '#f2e9d6'},
  // Brick — Wada no. 325 (Eugenia Red | B, Naples Yellow, Yellow Ocher, Deep Slate Green).
  //   paper Naples Yellow · bars Eugenia Red | B · accent Yellow Ocher · ink Deep Slate Green · adjusted: paper L 0.926→0.945, C 0.091→0.03, h 93.367→85; mass L 0.622→0.54, C 0.17→0.16; ink L 0.281→0.24; night paper L 0.281→0.21, C 0.036→0.025
  //   Naples-yellow cream, a rose-brick band, one ochre bar, the line in Wada's deep slate green; its night is Gilt.
  wBrick: {paper: '#f6ecd7', ink: '#062522', pencil: '#aeb0a1', mass: '#b93c48', accent: '#e2b540', nightPaper: '#091c1a', nightInk: '#fbe6a0'},
  // Orchid — Wada no. 315 (Grenadine Pink, Sulpher Yellow, Golden Yellow, Eupatorium Purple).
  //   paper Sulpher Yellow · bars Eupatorium Purple · accent Golden Yellow · ink made · adjusted: paper L 0.94→0.95, C 0.055→0.018; mass L 0.605→0.55
  //   Cream, an orchid band, a marigold bar: Lavender's warmer, pinker sister.
  wOrchid: {paper: '#f2efe1', ink: '#2d1723', pencil: '#b7aea8', mass: '#ac4781', accent: '#f3a257', nightPaper: '#1f0d17', nightInk: '#f2efe1'},
  // Verdigris — Wada no. 266 (Spectrum Red, Ivory Buff, Rainette Green, Benzol Green).
  //   paper Ivory Buff · bars Benzol Green · accent Spectrum Red · ink made · adjusted: paper L 0.875→0.935, C 0.069→0.026; mass L 0.609→0.52; accent L 0.586→0.66
  //   Ivory, a verdigris band, one vermilion bar: a cooler band on a warm page.
  wVerdigris: {paper: '#f2e9d6', ink: '#072522', pencil: '#acaea0', mass: '#027971', accent: '#fe423f', nightPaper: '#001816', nightInk: '#f2e9d6'},
  // Denim — Wada no. 279 (Raw Sienna, Vinaceous Cinnamon, Ecru, Dark Tyrian Blue).
  //   paper Ecru · bars Dark Tyrian Blue · accent Vinaceous Cinnamon · ink made · adjusted: paper L 0.761→0.74, C 0.044→0.052; accent L 0.79→0.88
  //   Kraft's blue twin: ecru card, a navy band, one pale cinnamon bar like white ink.
  wDenim: {paper: '#bea787', ink: '#061825', pencil: '#877c6a', mass: '#12354e', accent: '#ffcab6', nightPaper: '#0a151e', nightInk: '#bea787'},
  // Russet — Wada no. 249 (Hay's Russet, Ecru, Olive Ocher, Dark Medici Blue).
  //   paper Ecru · bars Hay's Russet · accent Olive Ocher · ink made · adjusted: paper L 0.761→0.74; accent L 0.779→0.82
  //   Ecru card, an oxblood-russet band, one ochre-gold bar: Kraft dressed warmer.
  wRusset: {paper: '#bba78d', ink: '#22110d', pencil: '#8d7a67', mass: '#793327', accent: '#e3c14d', nightPaper: '#210d0a', nightInk: '#bba78d'},
  // Magenta — Wada no. 144 (Rosolanc Purple, Orange, Black).
  //   paper Black · bars Rosolanc Purple · accent Orange · ink made · adjusted: paper L 0.185→0.18, C 0.004→0.014, h 229.03→357; accent L 0.698→0.74
  //   A near-black page, a deep magenta band, one orange bar: Plum turned up.
  wMagenta: {paper: '#170f12', ink: '#f8ebee', pencil: '#5b5154', mass: '#b73f74', accent: '#ff833a', nightPaper: '#170f12', nightInk: '#f8ebee'},
  // Viridian — Wada no. 256 (Vinaceous Cinnamon, Orange, Dull Viridian Green, Black).
  //   paper Black · bars Dull Viridian Green · accent Vinaceous Cinnamon · ink made · adjusted: paper L 0.185→0.18, C 0.004→0.014, h 229.03→162; mass L 0.589→0.56
  //   Green-black, a viridian band, one pale cinnamon bar: a night garden.
  wViridian: {paper: '#0c1410', ink: '#e8f1ec', pencil: '#4e5652', mass: '#078a5e', accent: '#eea78c', nightPaper: '#0c1410', nightInk: '#e8f1ec'},
  // Ultramarine — Wada no. 295 (Cream Yellow, Yellow, Blue, Dull Violet Black).
  //   paper Dull Violet Black · bars Blue · accent Cream Yellow · ink made · adjusted: paper L 0.221→0.2, C 0.088→0.04
  //   Violet-black, a pure blue band, one cream-yellow bar: deep and clear.
  wUltramarine: {paper: '#171226', ink: '#eaeef9', pencil: '#565465', mass: '#006eb8', accent: '#fdbf68', nightPaper: '#171226', nightInk: '#eaeef9'},
  // Old Rose — Wada no. 265 (Old Rose, Apricot Yellow, Olive Yellow, Dull Violet Black).
  //   paper Dull Violet Black · bars Old Rose · accent Apricot Yellow · ink made · adjusted: paper L 0.221→0.2, C 0.088→0.04; mass L 0.657→0.62; accent L 0.899→0.88, C 0.186→0.15, h 97.857→88
  //   Violet-black, an old-rose band, one yellow bar: dusk in a velvet room.
  wOldRose: {paper: '#171226', ink: '#f8ebeb', pencil: '#5b5361', mass: '#c7626f', accent: '#ffd15a', nightPaper: '#171226', nightInk: '#f8ebeb'},
  // Indigo Teal — Wada no. 155 (Jasper Red, Benzol Green, Deep Indigo).
  //   paper Deep Indigo · bars Benzol Green · accent Jasper Red · ink made · adjusted: paper L 0.192→0.19, C 0.063→0.035; mass L 0.609→0.57; accent L 0.643→0.74
  //   Deep indigo, a teal band, one coral bar: Midnight with the sea in it.
  wIndigoTeal: {paper: '#0b1323', ink: '#e7f0f5', pencil: '#4d5562', mass: '#078a81', accent: '#ff815d', nightPaper: '#0b1323', nightInk: '#e7f0f5'},
  // Gilt — Wada no. 325 (Eugenia Red | B, Naples Yellow, Yellow Ocher, Deep Slate Green).
  //   paper Deep Slate Green · bars Yellow Ocher · accent Eugenia Red | B · ink Naples Yellow · adjusted: paper L 0.281→0.21, C 0.036→0.025; mass L 0.793→0.72; accent L 0.622→0.56
  //   Bottle-green black, an ochre-gold band, a rose-red bar, the line in Naples yellow.
  wGilt: {paper: '#091c1a', ink: '#fbe6a0', pencil: '#525942', mass: '#ca9e1f', accent: '#c43d4b', nightPaper: '#091c1a', nightInk: '#fbe6a0'},
  // a lab-only test: Riso with darker ink and a quieter band. If it reads as clearly as Hokusai, lightness was Riso's problem.
  risoDeep: {paper: '#f7f3e9', ink: '#0d2063', pencil: '#b9b7cf', mass: '#304d99', accent: '#ff3d7f', nightPaper: '#14206e', nightInk: '#f7f3e9'},
};
const DIMS = {
  scheme: ['Colour', {graphite: 'Graphite & red', hokusai: 'Hokusai', black: 'Black', lagoon: 'Lagoon', riso: 'Riso', dune: 'Dune', plum: 'Plum', slate: 'Slate', olive: 'Olive', mauve: 'Mauve', bauhaus: 'Bauhaus', sumi: 'Sumi', midnight: 'Midnight', espresso: 'Espresso', moss: 'Moss', klein: 'Klein', bottle: 'Bottle', risoDeep: 'Riso, deeper ink (test)', wPrussian: 'Prussian (Wada 343)', wBrick: 'Brick (Wada 325)', wOrchid: 'Orchid (Wada 315)', wVerdigris: 'Verdigris (Wada 266)', wDenim: 'Denim (Wada 279)', wRusset: 'Russet (Wada 249)', wMagenta: 'Magenta (Wada 144)', wViridian: 'Viridian (Wada 256)', wUltramarine: 'Ultramarine (Wada 295)', wOldRose: 'Old Rose (Wada 265)', wIndigoTeal: 'Indigo Teal (Wada 155)', wGilt: 'Gilt (Wada 325)', cahier: 'Cahier', toile: 'Toile', ravilious: 'Ravilious', lavender: 'Lavender', kraft: 'Kraft', vegas: 'Vegas', cyanotype: 'Cyanotype', kintsugi: 'Kintsugi', rothko: 'Rothko', cafe: 'Café'}],
  size: ['Size', {today: 'Today', s58: '7 % closer', s62: '15 % closer', s68: '25 % closer'}],
  place: ['Rider in the frame', {official: 'Official follower', loose: 'Looser', tamed: 'Tamed', high: 'Tamed, higher', dive: 'Higher, steep rides drop', follow: 'Follows direction, higher', followMid: 'Follows direction, between', followLow: 'Follows direction, at Tamed’s height'}],
  tide: ['Zoom over time', {steady: 'Steady', quietI: 'Out when quiet', breath: 'One breath', fit: 'Fitted to the song'}],
  drive: ['Intensity from', {both: 'Speed + impact', speed: 'Speed only', impact: 'Impact only'}],
  ends: ['Opening & ending', {none: 'None', overture: 'Whole course at both ends', closing: 'Whole course at the end only'}],
  bandIn: ['Band at the opening', {present: 'There from the first frame', quick: 'Faint, then quickly in', fade: 'Arrives with the zoom'}],
  bg: ['Paper', {white: 'Plain', whisper: 'Whisper', xray: 'X-ray (test)'}],
  grain: ['Paper grain', {off: 'None', on: 'Faint, fixed to the world'}],
  shk: ['Hit part: shake', {today: 'Today’s (9 Hz, two axes, rotation)', blow: 'In the hit’s direction', thud: 'Thud (knock, then spring back)', kick: 'Held’s push', none: 'None'}],
  spl: ['Hit part: colour split', {today: 'Today’s (sideways)', dir: 'In the hit’s direction, same amount as today', half: 'Halfway between, same amount as today', blow: 'In the hit’s direction, unmatched', radial: 'Out from the impact', none: 'None'}],
  fls: ['Hit part: flash', {today: 'Today’s (white)', paper: 'Toward the paper', paperRare: 'Toward the paper, hardest hits only', todayRare: 'White, hardest hits only', bloom: 'Bloom at the impact', none: 'None'}],
  spw: ['Colour split covers', {all: 'Everything, the band too', ride: 'All but the band (as production)'}],
  crv: ['Hit size follows strength', {w: 'Steeply (R7–R10)', e: 'More fully (ordinary hits stronger)'}],
  amp: ['Shake and split size', {'1': '×1', '1.5': '×1.5', '2': '×2'}],
  flg: ['Rare flash opens at', {'80': 'Strength 0.80 (chosen)', '82': 'Strength 0.82 (about 1–11 a minute)', '76': 'Strength 0.76 (about 11–18 a minute)', '70': 'Strength 0.70 (about 20–28 a minute)'}],
  drv: ['Hit parts driven by', {trauma: 'Today’s (every hit, piling up)', graded: 'Real strength, piling up', held: 'Each hit alone (Held)'}],
  night: ['Night for the drop', {off: 'Off', on: 'On', switch: 'Switch scheme for the drop'}],
  ink: ['Line', {inking: 'Pencil → ink', rail: 'Whole rail on first touch', ink: 'All ink'}],
  music: ['Lower band', {none: 'None', bars: 'Today’s bars', bars3: 'Bars · three colours', blocks: 'Blocks', stems: 'Tuning fork', iris: 'Iris', red: 'One accent · fork', redbars: 'One accent · bars', redblocks: 'One accent · blocks'}],
  redBy: ['What takes the accent', {heat: 'Heat', loud: 'Loudest three', standing: 'Standing', level: 'Follows intensity'}],
  bandY: ['Band height', {low: 'Low', lowmid: 'Low-middle', mid: 'Middle', high: 'Today’s height'}],
  top: ['Top of the frame', {none: 'Nothing', vignette: 'Faint vignette', sun: 'Sun', title: 'Song title', titleCut: 'Song title, line in front'}],
  hit: ['On each hit', {none: 'Nothing', today: 'Today’s shake & split', refined: 'Refined', strong: 'Held', parts: 'By parts (below)', punch: 'Held + punch', recoil: 'Held + recoil', shake: 'Held + shake on the strongest', impact: 'Held + shake, split & flash on the strongest', todayW: 'Today’s shake, split & flash, by real strength', big: 'Held + punch + recoil', ghost: 'Refined + afterimage', heldGhost: 'Held + afterimage'}],
};
const base = {scheme: 'graphite', size: 's62', place: 'follow', tide: 'steady', drive: 'both', ends: 'overture', bandIn: 'present', bg: 'whisper', night: 'off', ink: 'inking', music: 'none', redBy: 'heat', bandY: 'lowmid', hit: 'refined', top: 'none', grain: 'off', shk: 'thud', spl: 'half', fls: 'paperRare', drv: 'held', flg: '80', spw: 'all', crv: 'w', amp: '1'}; // hit parts as chosen in R7–R10
const PRESETS = [

  {id: 'today', name: 'Today', line: 'Today’s camera, bars, shake, colour split and flash (approximated here; the real film is in the player).',
    mix: {...base, size: 'today', place: 'official', ends: 'none', bg: 'white', ink: 'ink', music: 'bars', hit: 'today', bandY: 'low'}},
  // one plain look so that colour four-ups differ by colour alone
  {id: 'swatch', name: 'Swatch', line: 'The plain look used to compare colours: the bars, the chosen hits, Follows direction.', mix: {...base, music: 'redbars', hit: 'parts'}},
  {id: 'ride', name: 'Ride', line: 'The ride alone: the baseline.', mix: {...base, bg: 'white', hit: 'none'}},
  {id: 'xray', name: 'X-ray', line: 'A test, not a look: the paper shows the intensity metric as loudly as possible.', mix: {...base, bg: 'xray'}},
  {id: 'paper', name: 'Paper', line: 'White, graphite and one red on the fork, Held hits, Night on the drop.',
    mix: {...base, music: 'red', redBy: 'loud', night: 'on', hit: 'parts'}},
  {id: 'hokusai', name: 'Hokusai', line: 'Indigo on washi, the bars, the sun, Held hits, easing out when quiet.',
    mix: {...base, scheme: 'hokusai', hit: 'parts', music: 'redbars', tide: 'quietI', top: 'sun'}},
  {id: 'lagoon', name: 'Lagoon', line: 'Sea-glass and teal, a little wider, a looser camera, Held hits and the song’s name on two lines.',
    mix: {...base, scheme: 'lagoon', size: 's58', place: 'loose', hit: 'parts', music: 'redbars', top: 'title'}},
  {id: 'black', name: 'Black', line: 'In the dark: one accent on the fork, Held hits, a steady zoom, and each rail lights whole the moment the rider meets it.',
    mix: {...base, scheme: 'black', music: 'red', redBy: 'loud', ink: 'rail', hit: 'parts'}},
  {id: 'riso', name: 'Riso', line: 'A two-ink print: blue and fluorescent pink.', mix: {...base, scheme: 'riso', music: 'redbars', hit: 'parts'}},
  {id: 'dune', name: 'Dune', line: 'Sand and rust, with its own low sun.', mix: {...base, scheme: 'dune', music: 'redbars', hit: 'parts', top: 'sun'}},
  {id: 'plum', name: 'Plum', line: 'A second dark: plum and amber.', mix: {...base, scheme: 'plum', music: 'redbars', hit: 'parts'}},
];
const SONGS = {petrunko: 'Petrunko', lua: 'Lua na Praça', los: 'Los Voltaje', batidao: 'No Batidão', burn: 'Let the World Burn', coma: 'Montagem Coma', tomada: 'Montagem Tomada (super slowed)'};
const plain = {...base, ends: 'none'};
// Each option: [label, mix, note shown when tapped].
// A frozen copy of round 8's questions, used only by uicheck.mjs (?qtest=1): the interaction suite tests the machinery
// (multi picks with commas, moment overrides, old rides, exaggerate) without depending on whatever the current round asks.
const TEST_QUESTIONS = [
  {id: 'split', ask: 'The colour split, compared fairly', why: 'Varies: only the split’s direction. Fixed: shake in the hit’s direction, no flash, each hit on its own (your pick). You were right that the hit-direction split looked stronger: today’s goes sideways, mostly along the lines, where it hides; the hit’s direction crosses them. The split now touches the ride only, as in production, not the band. Measured on four songs, all three now show the same amount of split on average. Keep any number.',
    song: 'tomada', t: 36.5, len: 5, multi: true, opts: [
      ['Today’s, sideways', {...plain, music: 'redbars', hit: 'parts', drv: 'held', shk: 'blow', fls: 'none', spl: 'today'}, 'Sideways, as shipped.'],
      ['In the hit’s direction', {...plain, music: 'redbars', hit: 'parts', drv: 'held', shk: 'blow', fls: 'none', spl: 'dir'}, 'Scaled down to show the same amount as today’s on average.'],
      ['Halfway between', {...plain, music: 'redbars', hit: 'parts', drv: 'held', shk: 'blow', fls: 'none', spl: 'half'}, 'Halfway between sideways and the hit’s direction, the same amount.'],
      ['None', {...plain, music: 'redbars', hit: 'parts', drv: 'held', shk: 'blow', fls: 'none', spl: 'none'}, 'No split, for reference.']],
    moments: [['Tomada 37 s', 36.5], ['Petrunko 34 s', 33.8, 'petrunko'], ['Los Voltaje 48 s', 47.8, 'los'], ['Batidão 15 s', 14.5, 'batidao']]},
  {id: 'flash', ask: 'A flash only on the hardest hits?', why: 'Varies: only the flash. Fixed: shake in the hit’s direction, today’s split, each hit on its own. The gate opens on the hit’s own strength (from 0.82, full at 0.94), so most hits never flash: about 1 to 10 flashes a minute depending on the song. The moments include a coloured and a dark palette; they now stay while you switch. Keep any number.',
    song: 'petrunko', t: 33.6, len: 5, multi: true, opts: [
      ['None', {...plain, music: 'redbars', hit: 'parts', drv: 'held', shk: 'blow', spl: 'today', fls: 'none'}, 'No flash.'],
      ['Toward the paper, hardest only', {...plain, music: 'redbars', hit: 'parts', drv: 'held', shk: 'blow', spl: 'today', fls: 'paperRare'}, 'The picture lifts toward its own paper colour, only on the hardest hits.'],
      ['White, hardest only', {...plain, music: 'redbars', hit: 'parts', drv: 'held', shk: 'blow', spl: 'today', fls: 'todayRare'}, 'Today’s white flash, only on the hardest hits.']],
    moments: [['Petrunko 34 s', 33.6], ['Tomada 37 s', 36.5, 'tomada'], ['On Dune', 33.6, 'petrunko', {scheme: 'dune'}], ['On Café (dark)', 33.6, 'petrunko', {scheme: 'cafe'}], ['On Hokusai', 33.6, 'petrunko', {scheme: 'hokusai'}]]},
  {id: 'shake', ask: 'The shake, now that each hit is on its own', why: 'Varies: only the shake. Fixed: today’s split, no flash, each hit on its own. You kept two shakes when hits were piling up; with each hit on its own they feel different, so here they are again, with today’s for reference. Keep any number.',
    song: 'tomada', t: 36.5, len: 5, multi: true, exaggerate: true, opts: [
      ['Today’s', {...plain, music: 'redbars', hit: 'parts', drv: 'held', spl: 'today', fls: 'none', shk: 'today'}, 'Two axes, 9 Hz, slight rotation.'],
      ['In the hit’s direction', {...plain, music: 'redbars', hit: 'parts', drv: 'held', spl: 'today', fls: 'none', shk: 'blow'}, 'The same 9 Hz, starting with the hit and along its direction.'],
      ['Thud', {...plain, music: 'redbars', hit: 'parts', drv: 'held', spl: 'today', fls: 'none', shk: 'thud'}, 'Knocked along the hit’s direction, then springing back.']],
    moments: [['Tomada 37 s', 36.5], ['Petrunko 34 s', 33.8, 'petrunko'], ['Los Voltaje 48 s', 47.8, 'los'], ['Batidão 15 s', 14.5, 'batidao']]},
  {id: 'bgKraft', ask: 'Kraft: which paper?', why: 'You loved Kraft’s bars and line, but the paper could be “a bit different”. Varies: only the paper, in plain directions. Line, bars and accent unchanged. Keep any number.', song: 'lua', t: 36.5, len: 6, multi: true, opts: [
      ['As designed', {...plain, music: 'redbars', hit: 'strong', scheme: 'kraft'}, 'The original paper.'],
      ['Less colour', {...plain, music: 'redbars', hit: 'strong', scheme: 'kraft~0'}, 'Only the paper changes: less colour.'],
      ['Almost neutral', {...plain, music: 'redbars', hit: 'strong', scheme: 'kraft~1'}, 'Only the paper changes: almost neutral.'],
      ['Lighter', {...plain, music: 'redbars', hit: 'strong', scheme: 'kraft~2'}, 'Only the paper changes: lighter.'],
      ['Lighter, less colour', {...plain, music: 'redbars', hit: 'strong', scheme: 'kraft~3'}, 'Only the paper changes: lighter, less colour.'],
      ['Darker', {...plain, music: 'redbars', hit: 'strong', scheme: 'kraft~4'}, 'Only the paper changes: darker.']],
    moments: [['Lua 36 s', 36.5], ['Los Voltaje 45 s', 45, 'los'], ['Petrunko 28 s', 28, 'petrunko']]},
  {id: 'bgCyan', ask: 'Cyanotype: which paper?', why: 'Great bars, bad background, you said. Varies: only the paper. Line, bars and accent unchanged. Keep any number.', song: 'lua', t: 36.5, len: 6, multi: true, opts: [
      ['As designed', {...plain, music: 'redbars', hit: 'strong', scheme: 'cyanotype'}, 'The original paper.'],
      ['Less colour', {...plain, music: 'redbars', hit: 'strong', scheme: 'cyanotype~0'}, 'Only the paper changes: less colour.'],
      ['Almost neutral', {...plain, music: 'redbars', hit: 'strong', scheme: 'cyanotype~1'}, 'Only the paper changes: almost neutral.'],
      ['Darker', {...plain, music: 'redbars', hit: 'strong', scheme: 'cyanotype~2'}, 'Only the paper changes: darker.'],
      ['Darker, less colour', {...plain, music: 'redbars', hit: 'strong', scheme: 'cyanotype~3'}, 'Only the paper changes: darker, less colour.'],
      ['Lighter', {...plain, music: 'redbars', hit: 'strong', scheme: 'cyanotype~4'}, 'Only the paper changes: lighter.']],
    moments: [['Lua 36 s', 36.5], ['Los Voltaje 45 s', 45, 'los'], ['Petrunko 28 s', 28, 'petrunko']]},
  {id: 'bgRothko', ask: 'Rothko: which paper?', why: 'Good bars, a background you don’t love. Varies: only the paper. Line, bars and accent unchanged. Keep any number.', song: 'lua', t: 36.5, len: 6, multi: true, opts: [
      ['As designed', {...plain, music: 'redbars', hit: 'strong', scheme: 'rothko'}, 'The original paper.'],
      ['Less colour', {...plain, music: 'redbars', hit: 'strong', scheme: 'rothko~0'}, 'Only the paper changes: less colour.'],
      ['Almost neutral', {...plain, music: 'redbars', hit: 'strong', scheme: 'rothko~1'}, 'Only the paper changes: almost neutral.'],
      ['Darker', {...plain, music: 'redbars', hit: 'strong', scheme: 'rothko~2'}, 'Only the paper changes: darker.'],
      ['Darker, less colour', {...plain, music: 'redbars', hit: 'strong', scheme: 'rothko~3'}, 'Only the paper changes: darker, less colour.'],
      ['Lighter', {...plain, music: 'redbars', hit: 'strong', scheme: 'rothko~4'}, 'Only the paper changes: lighter.']],
    moments: [['Lua 36 s', 36.5], ['Los Voltaje 45 s', 45, 'los'], ['Petrunko 28 s', 28, 'petrunko']]},
];

const QUESTIONS = [
  {id: 'splitall', ask: 'Should the colour split catch the band?', why: 'You said you preferred the split over everything, as the lab did before round 8; production only splits the ride. The title and the sun sit behind the ride, so they split in both versions here; what changes is the band. Varies: only that. Everything else is your set.',
    song: 'tomada', t: 36.5, len: 5, opts: [
      ['The band too', {...plain, music: 'redbars', hit: 'parts', spw: 'all'}, 'The band splits with the ride, title and sun.'],
      ['Band stays clean', {...plain, music: 'redbars', hit: 'parts', spw: 'ride'}, 'The band stays clean, as in production.']],
    moments: [['Tomada 37 s', 36.5], ['Petrunko 34 s', 33.8, 'petrunko'], ['On Dune', 36.5, 'tomada', {scheme: 'dune'}], ['On Ultramarine (dark)', 36.5, 'tomada', {scheme: 'wUltramarine'}]]},
  {id: 'strength', ask: 'Stronger hits: how?', why: 'Today’s reaches nearly full force from strength 0.45, so a typical hit already shakes fully. Ours grows steeply with strength: a median hit (0.58 on Tomada) gets about half of today’s split and an 8 px thud, and only the hardest hits match today. “Fuller” lifts ordinary hits and keeps the hardest the same; “×1.5” makes everything half as big again. Varies: only the size of the shake and split. The flash is unchanged. Keep any number.',
    song: 'tomada', t: 36.5, len: 6, multi: true, opts: [
      ['Your set', {...plain, music: 'redbars', hit: 'parts'}, 'As now: steep, ordinary hits modest.'],
      ['Fuller', {...plain, music: 'redbars', hit: 'parts', crv: 'e'}, 'Ordinary hits stronger (a 0.6 hit: 12 px instead of 8), the hardest unchanged.'],
      ['×1.5', {...plain, music: 'redbars', hit: 'parts', amp: '1.5'}, 'Everything half as big again (the hardest: 24 px).'],
      ['Fuller, ×1.5', {...plain, music: 'redbars', hit: 'parts', crv: 'e', amp: '1.5'}, 'Both: a 0.6 hit gets 17.5 px, the hardest 24 px.'],
      ['Today’s', {...plain, music: 'redbars', hit: 'parts', shk: 'today', spl: 'today', fls: 'today', drv: 'trauma', spw: 'ride'}, 'For reference: the shipped recipe.']],
    moments: [['Tomada 37 s (many big hits)', 36.5], ['Los Voltaje 20 s (calmer)', 19.5, 'los'], ['Petrunko 34 s', 33.8, 'petrunko'], ['On Old Rose (dark)', 36.5, 'tomada', {scheme: 'wOldRose'}], ['On Prussian (light)', 36.5, 'tomada', {scheme: 'wPrussian'}]]},
];
if (new URLSearchParams(location.search).has('qtest')) QUESTIONS.splice(0, QUESTIONS.length, ...TEST_QUESTIONS);

// ── state ──────────────────────────────────────────────────────────────────
const q = new URLSearchParams(location.search);
const shot = q.has('shot');
const $ = id => document.getElementById(id);
const music = createMusic(), onScreen = displayTime();
let song = SONGS[q.get('song')] ? q.get('song') : 'petrunko';
let preset = PRESETS.find(p => p.id === q.get('c')) ?? PRESETS[0];
let mix = {...preset.mix};
for (const kv of (q.get('m') ?? '').split(',').filter(Boolean)) {const [k, v] = kv.split(':'); if (DIMS[k]?.[1][v]) mix[k] = v;}
let seconds = +(q.get('t') ?? 0) || 0, playing = false, S = null, loadId = 0;
const qmode = q.has('q'), feelmode = q.has('feel');
let qi = Math.max(0, Math.min(QUESTIONS.length, +(q.get('q') || 1) - 1)), qopt = 0;
// A temporary viewing aid: multiplies the hit parts' shake. Always ×1 unless the viewer moves the slider or the URL asks (?shakeX=).
let shakeX = Math.max(1, Math.min(4, +(q.get('shakeX') ?? 1) || 1));
// Every question/moment navigation takes a ticket; an async step that resumes after a newer navigation drops its stale state
// instead of applying it (a slow song load used to finish after the viewer had moved on and overwrite the newer choice).
let navId = 0, qmoment = null, loopHome = null;
const STORE = new URLSearchParams(location.search).has('qtest') ? 'concept-lab-answers-test' : 'concept-lab-answers-r11';
const answers = (() => {try {return JSON.parse(localStorage.getItem(STORE) ?? '{}');} catch {return {};}})();
const saveAnswers = () => {try {localStorage.setItem(STORE, JSON.stringify(answers));} catch {}};
const sheetPromise = N.loadSheet();
const paint = N.riderPainter();
const canvas = $('stage'), ctx = canvas.getContext('2d');
const overlay = document.createElement('canvas'), octx = overlay.getContext('2d');

// ── data preparation ───────────────────────────────────────────────────────
function replay(track, trace) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/generated/motion-gallery-renderer/worker.js', {type: 'module'});
    worker.onmessage = ({data}) => {worker.terminate(); data.error ? reject(new Error(data.error)) : resolve(data);};
    worker.onerror = e => {worker.terminate(); reject(new Error(e.message || 'replay failed'));};
    worker.postMessage({request: 1, track, trace});
  });
}
function riderAt(frames, at) {
  const c = Math.max(0, Math.min(at, frames.length - 1)), i = Math.floor(c), t = c - i;
  const a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)];
  if (!t) return a;
  const m = (x, y) => x + (y - x) * t;
  return {points: a.points.map((p, j) => ({name: p.name, pos: {x: m(p.pos.x, b.points[j].pos.x), y: m(p.pos.y, b.points[j].pos.y)}})),
    framesSinceUnmount: m(a.framesSinceUnmount, b.framesSinceUnmount), framesSinceSledBreak: m(a.framesSinceSledBreak, b.framesSinceSledBreak),
    framesSinceStringDetached: m(a.framesSinceStringDetached, b.framesSinceStringDetached)};
}
const centreOf = f => {let x = 0, y = 0; for (let i = 0; i < f.length; i += 2) {x += f[i]; y += f[i + 1];} return {x: 2 * x / f.length, y: 2 * y / f.length};};
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smoothstep = C.smoothstep;
/** How hard a hit reads, continuous in the measured strength: no tiers, no top-N. */
const power = C.strength;

function prepare(data, native) {
  const lines = data.track.lines.map(l => ({id: l.id, x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, touch: Infinity}));
  const byId = new Map(lines.map(l => [l.id, l]));
  native.contacts.forEach((ids, f) => {for (const id of ids) {const l = byId.get(id); if (l && f < l.touch) l.touch = f;}});
  // connected rails: a rail inks up to the furthest point touched so far, so a used rail is solid behind the rider
  {
    const parent = lines.map((_, i) => i), find = i => {while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i;};
    // segments whose ends touch or nearly touch (dotted rails are runs of short pieces a few units apart) form one rail
    const GAP = 6, cells = new Map(), cell = (x, y) => Math.floor(x / GAP) + ',' + Math.floor(y / GAP);
    lines.forEach((l, i) => {for (const [x, y] of [[l.x1, l.y1], [l.x2, l.y2]]) {const k = cell(x, y); if (!cells.has(k)) cells.set(k, []); cells.get(k).push([x, y, i]);}});
    lines.forEach((l, i) => {for (const [x, y] of [[l.x1, l.y1], [l.x2, l.y2]]) {
      const gx = Math.floor(x / GAP), gy = Math.floor(y / GAP);
      for (let a = gx - 1; a <= gx + 1; a++) for (let b = gy - 1; b <= gy + 1; b++) for (const [px, py, j] of cells.get(a + ',' + b) ?? [])
        if (j !== i && (px - x) ** 2 + (py - y) ** 2 < GAP * GAP) parent[find(i)] = find(j);
    }});
    const chains = new Map(); lines.forEach((l, i) => {const r = find(i); l.chain = r; if (!chains.has(r)) chains.set(r, []); chains.get(r).push(l);});
    // A rail inks as the rider passes it, not only where a contact was recorded: on five songs 8–17 % of the course stayed pencil
    // behind the rider, about 90 % of it within 14 units of the body, and a third of used rails ended in a grey tail.
    const cs = data.trace.frames.map(centreOf), reach = []; {let m = -Infinity; for (const c of cs) reach.push(m = Math.max(m, c.x));}
    const firstAt = x => {let a = 0, b = reach.length - 1; while (a < b) {const c = (a + b) >> 1; if (reach[c] >= x) b = c; else a = c + 1;} return reach[a] >= x ? a : Infinity;};
    const near = l => {const dx = l.x2 - l.x1, dy = l.y2 - l.y1, L = dx * dx + dy * dy || 1, a = firstAt(Math.min(l.x1, l.x2) - 30), b = Math.min(cs.length - 1, firstAt(Math.max(l.x1, l.x2) + 30)); if (a === Infinity) return false; for (let f = a; f <= b; f++) {const c = cs[f], u = clamp(((c.x - l.x1) * dx + (c.y - l.y1) * dy) / L, 0, 1); if (Math.hypot(c.x - l.x1 - u * dx, c.y - l.y1 - u * dy) < 14) return true;} return false;};
    for (const chain of chains.values()) {
      chain.sort((a, b) => (a.x1 + a.x2) - (b.x1 + b.x2));
      const used = chain.some(l => l.touch < Infinity) || chain.some(near);
      let m = Infinity, first = Infinity; for (let i = chain.length - 1; i >= 0; i--) {m = Math.min(m, chain[i].touch); chain[i].ink = used ? Math.min(m, firstAt(Math.max(chain[i].x1, chain[i].x2))) : Infinity; first = Math.min(first, chain[i].ink);}
      for (const l of chain) l.rail = first; // the moment the rider first meets this rail
    }
  }
  const G = 400, grid = new Map();
  for (const l of lines) {
    for (let gx = Math.floor(Math.min(l.x1, l.x2) / G); gx <= Math.floor(Math.max(l.x1, l.x2) / G); gx++)
      for (let gy = Math.floor(Math.min(l.y1, l.y2) / G); gy <= Math.floor(Math.max(l.y1, l.y2) / G); gy++) {
        const k = gx + ',' + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(l);
      }
  }
  const centres = data.trace.frames.map(centreOf);
  // where each hit happened: the touched line nearest the body, its normal on the rider's side
  const hits = data.hits.map(h => {
    const f0 = Math.round(h.t * FPS); let pos = null, ang = 0, line = null, nrm = {x: 0, y: -1}, best = Infinity;
    for (let f = f0 - 2; f <= f0 + 4 && !pos; f++) {
      const ids = native.contacts[f] ?? []; if (!ids.length) continue;
      const c = centres[Math.min(f, centres.length - 1)];
      for (const id of ids) {
        const l = byId.get(id); if (!l) continue;
        const dx = l.x2 - l.x1, dy = l.y2 - l.y1, L2 = dx * dx + dy * dy || 1;
        const u = Math.max(0, Math.min(1, ((c.x - l.x1) * dx + (c.y - l.y1) * dy) / L2));
        const p = {x: l.x1 + u * dx, y: l.y1 + u * dy}, d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d < best) {
          best = d; pos = p; ang = Math.atan2(dy, dx); line = l;
          const L = Math.sqrt(L2) || 1; let nx = -dy / L, ny = dx / L;
          if (nx * (c.x - p.x) + ny * (c.y - p.y) < 0) {nx = -nx; ny = -ny;}
          nrm = {x: nx, y: ny};
        }
      }
    }
    let fc = null;
    for (let f = f0 + 1; f >= f0 - 6; f--) {if (native.contacts[f]?.length) fc = f; else if (fc !== null) break;}
    const ca = centres[Math.max(0, f0 - 2)], cb = centres[Math.min(centres.length - 1, f0)];
    return {...h, tc: fc === null ? h.t : Math.min(h.t, fc / FPS), pos: pos ?? centres[Math.min(f0, centres.length - 1)], ang, nrm, chain: line?.chain, I: power(h.s), vel: {x: cb.x - ca.x, y: cb.y - ca.y}};
  });
  const R = C.rideSignals(centres, native.contacts, hits, data.phases, data.duration);
  // the whole-course view frames the ride itself (rails reaching past it may crop), with a margin
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of centres) {x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);}
  x0 -= 80; x1 += 80; y0 -= 80; y1 += 80;
  // the intensity metric, from the same two signals on every song; nothing below this line knows how it is computed
  const speed = centres.map((_, f) => {const a = centres[Math.max(0, f - 1)], b = centres[Math.min(centres.length - 1, f + 1)], k = Math.min(centres.length - 1, f + 1) - Math.max(0, f - 1) || 1; return Math.hypot(b.x - a.x, b.y - a.y) / k * FPS;}).filter((_, f) => f % 4 === 0);
  const raw = I.rawSignals({speed, hits: hits.map(h => ({t: h.tc, s: h.s})), duration: data.duration});
  const drives = {both: I.intensity(raw), speed: I.intensity(raw, {use: 'speed'}), impact: I.intensity(raw, {use: 'power'}), meter: I.intensity(raw, {shape: 'meter'})};
  // the night cue, snapped to the strongest hit within 0.4 s of it
  let night = null; const cue = NIGHTS[data.key];
  if (cue) {const near = hits.filter(h => Math.abs(h.tc - cue[0]) < 0.4), s = near.reduce((a, b) => (!a || b.s > a.s ? b : a), null); const exit = hits.filter(h => Math.abs(h.tc - cue[1]) < 0.8).reduce((a, b) => (!a || b.s > a.s ? b : a), null); night = [s ? s.tc : cue[0], exit ? exit.tc : cue[1]];}
  const red = redLogic(data.spectrum, hits);
  return {...data, red, frames: native.frames, lines, grid, G, centres, R, hits, bbox: {x0, y0, x1, y1}, drives, night,
    follow: N.follower(data.trace.frames), cams: new Map()};
}

/** The metric at time t, for the chosen ingredients. */
function intensityAt(t) {const y = S.drives[mix.drive], x = clamp(t * I.FS, 0, y.length - 1), i = Math.floor(x), j = Math.min(i + 1, y.length - 1); return y[i] + (y[j] - y[i]) * (x - i);}
// One red: which stems are red. Red is never added; a few existing elements become red, and the logic picks who.
function redLogic(sp, hits) {
  const n = sp.bands, T = sp.frames.length, p95 = Array.from({length: n}, (_, b) => {const s = sp.frames.map(r => r[b]).sort((a, c) => a - c); return Math.max(0.05, s[Math.floor(0.95 * (T - 1))]);});
  const wh = i => sp.frames[clamp(i, 0, T - 1)].map((v, b) => v / p95[b]);
  const top = (arr, k) => arr.map((v, b) => [v, b]).sort((a, c) => c[0] - a[0]).slice(0, k).map(x => x[1]);
  const flux = t => {const i = Math.round(t * sp.fps), a = wh(i + 1), b = wh(i - 2); return a.map((v, j) => v - b[j]);};
  // standing: red holds on the stems of the last champion hit; only a clearly stronger hit (×1.3, against an 8 s decay) moves it
  const champs = []; {let c = 0, t0 = 0; for (const h of hits) {const cur = c * Math.exp(-(h.tc - t0) / 8); if (h.I > 1.3 * cur) {c = h.I; t0 = h.tc; champs.push({t: h.tc, set: top(flux(h.tc), 3)});}}}
  return {champs};
}
function redAt(t, row) {
  const L = S.red, top = k => row.map((v, b) => [v, b]).sort((a, c) => c[0] - a[0]).slice(0, k).map(x => x[1]);
  if (mix.redBy === 'standing') {let c = null; for (const x of L.champs) {if (x.t > t) break; c = x;} return new Set(c ? c.set : []);}
  if (mix.redBy === 'level') return new Set(top(Math.round(1 + 5 * intensityAt(t))));
  if (mix.redBy === 'heat') {let h = 0; for (const x of S.hits) {if (x.tc > t) break; h += x.I * Math.exp(-(t - x.tc) / 0.8);} return new Set(top(Math.floor(clamp(6 * h / 1.47, 0, 6))));}
  return new Set(top(3).filter(b => row[b] > 0.25));
}
// ── camera ─────────────────────────────────────────────────────────────────
function camFrames(m) {
  const key = m.size + '|' + m.place + '|' + m.tide + '|' + m.drive;
  if (!S.cams.has(key)) {
    const z = m.size === 'today' ? Z0 : SIZE_Z[m.size]; let cam;
    if (m.size === 'today' || m.place === 'official') cam = S.centres.map((_, f) => {const c = S.follow({w: W, h: H, z}, f); return {z, ax: W / 2, ay: 0.35 * H, x: c.x, y: c.y};});
    else cam = C.buildPlaced(S.R, {base: z, place: m.place, tide: m.tide, level: f => {const y = S.drives[m.drive]; return y[clamp(Math.round(f / FPS * I.FS), 0, y.length - 1)];}});
    S.cams.set(key, cam);
  }
  return S.cams.get(key);
}
function cameraAt(m, at) {
  const cam = camFrames(m), i = clamp(Math.floor(at), 0, cam.length - 1), j = Math.min(i + 1, cam.length - 1), u = clamp(at - i, 0, 1), a = cam[i], b = cam[j];
  const l = (p, q) => p + (q - p) * u;
  return {z: l(a.z, b.z), ax: l(a.ax, b.ax), ay: l(a.ay, b.ay), x: l(a.x, b.x), y: l(a.y, b.y)};
}
const riderPoint = at => {const c = S.centres, i = clamp(Math.floor(at), 0, c.length - 1), j = Math.min(i + 1, c.length - 1), u = clamp(at - i, 0, 1); return {x: c[i].x + (c[j].x - c[i].x) * u, y: c[i].y + (c[j].y - c[i].y) * u};};
// Whole-course opening and ending, for ANY camera: a view is (the rider's screen point, ln zoom). The overview and the
// camera both keep the rider in frame, so every blend of the two does too, by construction. Nothing here knows the camera.
function bookend(t, c, at) {
  const R = riderPoint(at), p = {x: c.ax + (R.x - c.x) * c.z, y: c.ay + (R.y - c.y) * c.z};
  const view = {...c, rx: p.x, ry: p.y, R, over: 0, ending: false};
  if (mix.ends === 'none') return view;
  const b = S.bbox, zo = Math.min(0.78 * W / (b.x1 - b.x0), 0.5 * H / (b.y1 - b.y0)), o = {x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2};
  const t1 = Math.min(2.2, S.hits.find(h => h.tc >= 1.3)?.tc ?? 1.6), tE = S.duration - 3;
  let u = 1;
  if (t < t1 && mix.ends === 'overture') u = smoothstep((t - 0.25) / (t1 - 0.25));
  else if (t > tE) u = 1 - smoothstep((t - tE) / 2.6);
  if (u >= 1) return view;
  const q = {x: W / 2 + (R.x - o.x) * zo, y: 0.4 * H + (R.y - o.y) * zo}, rx = q.x + (p.x - q.x) * u, ry = q.y + (p.y - q.y) * u;
  return {z: Math.exp(Math.log(zo) + (Math.log(c.z) - Math.log(zo)) * u), ax: rx, ay: ry, x: R.x, y: R.y, rx, ry, R, over: 1 - u, ending: t > tE};
}

// ── hit effects ────────────────────────────────────────────────────────────
// One absolute strength curve (C.strength, 0..1) drives every accent; nothing is ranked or tiered.
// Every accent peaks on the first frame at or after the contact onset and decays as exp(−age/τ),
// τ = τ0·(0.8 + 0.4e). Directions come from the struck line: î points into the line, from the rider's side.
const BUNDLES = {
  none: {}, today: {today: 1},
  refined: {kick: 1, split: 1, flash: 1},                        // today's spirit, every part with a direction
  strong: {kick: 1, split: 1, flash: 1, held: 1},                // the same, with strength read as duration
  ghost: {kick: 1, split: 1, flash: 1, ghost: 1},                // the body the blow caught stays where it happened
  heldGhost: {kick: 1, split: 1, flash: 1, held: 1, ghost: 1},
  // round 6: what Held loses against Today's shake on the biggest hits. Both grow as w², w = e^2.2 (absolute strength):
  // at e = 1 they are full, at e = 0.7 a fifth, at e = 0.5 nothing visible. No threshold, no rank.
  punch: {kick: 1, split: 1, flash: 1, held: 1, punch: 1},      // the frame closes in on the blow, then lets go
  recoil: {kick: 1, split: 1, flash: 1, held: 1, recoil: 1},    // the blow lands, then the camera rebounds once
  big: {kick: 1, split: 1, flash: 1, held: 1, punch: 1, recoil: 1},
  shake: {kick: 1, split: 1, flash: 1, held: 1, shake: 1},     // today's shake, refined: strongest hits only, short, along the blow
  impact: {kick: 1, split: 1, flash: 1, held: 1, shake: 1.4, impact: 1}, // all three together on the hardest hits: shake, split, flash
  todayW: {todayW: 1},                                          // today's execution, but gated by real strength (w²) like the rest
};
const big = w => w * w;
/** Zoom factor from the punch: up to +4.5 % on the hardest hits, held like the kick, eased out over 0.35 s. */
function hitZoom(t) {
  if (!acc().punch) return 1;
  let p = 0; for (const {age, e} of activeHits(t, 0.6)) {const w = excess(e), hold = (1 + 2 * w) / 60, env = age < hold ? 1 : Math.pow(Math.max(0, 1 - (age - hold) / 0.35), 2); p = Math.max(p, 0.045 * big(w) * env);}
  return 1 + p;
}
// Strength as duration: the excess strength w = e^2.2 sets both amplitude and hold. The peak is held at least one full
// 60 fps frame (no hit loses its peak to the frame grid); recovery ends exactly, never later than 0.25 s.
const excess = e => Math.pow(e, 2.2);
const held = (age, w) => {const hold = (1 + 2 * w) / 60, L = 0.1 + 0.1 * w; return age < 0 ? 0 : age < hold ? 1 : Math.pow(Math.max(0, 1 - (age - hold) / L), 2);};
const acc = () => BUNDLES[mix.hit] ?? {};
const decay = (age, tau0, e) => age < 0 ? 0 : Math.exp(-age / (tau0 * (0.8 + 0.4 * e)));
function activeHits(t, span) {
  const out = [];
  for (const h of S.hits) {if (h.tc > t + 0.001) break; const age = t - h.tc; if (age <= span) out.push({h, age, e: forceE ?? h.I});}
  return out;
}
const into = h => ({x: -h.nrm.x, y: -h.nrm.y});

// ── hits as separate parts (round 7) ───────────────────────────────────────
// Today's shipped recipe (scripts/fx_recipe.ts, remotion/src/fx.tsx) is NOT a top-10 % gate: every hit above 0.22–0.3 adds
// strength × gain to a decaying "trauma", clamped at 1, so an ordinary hit (0.6 × 1.6) already reaches full force and dense
// passages pile up. Its shake oscillates (±10 px at 9 Hz on two axes, 0.4° rotation), its split is 14 px horizontal over the
// whole frame, its flash is white at 0.3. Here each part (shake, split, flash) and the driver are chosen separately, so one
// can be compared while the others stay at today's.
const TODAY = {shake: {min: 0.22, gain: 1.6, decay: 7, power: 1.5}, split: {min: 0.25, gain: 2.0, decay: 7, power: 1.4}, flash: {min: 0.3, gain: 1.8, decay: 12, power: 1}};
/** Envelope 0..1 of one part at time t, with the hit that last fed it (for direction and phase). */
function drive(t, part) {
  const c = TODAY[part], d = mix.drv ?? 'trauma'; let x = 0, last = null;
  for (const h of S.hits) {
    if (h.tc > t + 0.001) break; const age = t - h.tc;
    // each hit alone. Its size: 'w' (R7–R10) = 0.35 + 0.65·e^2.2, steep, so an ordinary hit (strength 0.6, e 0.51) gets 0.50 of full;
    // 'e' (R11) = 0.45 + 0.55·e, fuller, the same hit gets 0.73. Its length always follows e^2.2 (held).
    if (d === 'held') {const e = forceE ?? h.I, w = excess(e), v = (mix.crv === 'e' ? 0.45 + 0.55 * e : 0.35 + 0.65 * w) * held(age, w); if (v > x) {x = v; last = h;} continue;}
    const s = forceE !== null ? 0.2 + 0.65 * Math.pow(forceE, 1 / 1.4) : h.s;
    if (d === 'trauma' && s < c.min) continue;
    const add = (d === 'graded' ? (forceE ?? h.I) : s) * c.gain * Math.exp(-age * c.decay); // graded: the absolute strength curve, no threshold
    if (add > 0.002) last = h; x += add;
  }
  return d === 'held' ? {m: x, h: last} : {m: Math.pow(Math.min(1, x), c.power), h: last};
}
// R11: an overall size for the chosen shake and split (the owner: "stronger… also stronger split"); flash untouched
const AMP = () => +(mix.amp ?? 1) || 1;
const SPLIT_MATCH = {dir: 0.53, half: 0.61}; // fitted on Tomada and Los Voltaje (splitmeasure.mjs)
function partsCamera(t) {
  const {m, h} = drive(t, 'shake'); if (!h || m < 0.002 || mix.shk === 'none') return {dx: 0, dy: 0, rot: 0};
  const i = into(h), age = t - h.tc, W9 = 2 * Math.PI * 9;
  if (mix.shk === 'today') return {dx: 10 * m * Math.sin(W9 * t), dy: 10 * m * Math.sin(W9 * 1.37 * t + 1.7), rot: 0.4 * m * Math.sin(W9 * 0.9 * t + 3.1)};
  // along the blow: the same 9 Hz, but locked to the hit (the first swing goes INTO the blow) and along its direction
  if (mix.shk === 'blow') {const a = 12 * m * Math.sin(W9 * age), b = 3 * m * Math.sin(W9 * 1.37 * age + 1.7); return {dx: a * i.x - b * i.y, dy: a * i.y + b * i.x, rot: 0};}
  // thud: the frame is knocked along the blow at once, then springs back through rest (6 Hz) as the energy drains
  if (mix.shk === 'thud') {const a = 16 * AMP() * m * Math.cos(2 * Math.PI * 6 * age); return {dx: a * i.x, dy: a * i.y, rot: 0};}
  // Held's push, without oscillation, for reference
  if (mix.shk === 'kick') return {dx: 18 * m * i.x, dy: 18 * m * i.y, rot: 0};
  return {dx: 0, dy: 0, rot: 0};
}
// As in production (remotion/src/fx.tsx), the split acts on the ride only: the band is a separate layer drawn after it.
function partsSplit(t, k, v) {
  const sp = drive(t, 'split');
  if (sp.h && sp.m > 0.002 && mix.spl !== 'none') {
    const a = 14 * AMP() * sp.m * k, i = into(sp.h);
    if (mix.spl === 'today' && a > 0.5) channelSplit(a, 0);
    else if (mix.spl === 'blow' && a > 0.5) channelSplit(a * i.x, a * i.y);
    // matched: the same visible fringe on the ride as today's on average (splitmeasure.mjs, Tomada and Los Voltaje). Across a line
    // a split shows fully; along it, it hides; today's sideways split mostly runs along the lines, the hit's direction across them.
    else if (mix.spl === 'dir' && a > 0.5) {const f = SPLIT_MATCH.dir; channelSplit(f * a * i.x, f * a * i.y);}
    // halfway: the hit's direction plus a sideways unit on the same side as the hit's own x, so red stays on the hit's side
    // (it used to flip the hit instead, which put red at the bottom where neither neighbour ever did)
    else if (mix.spl === 'half' && a > 0.5) {const hx = i.x + (i.x < 0 ? -1 : 1), hy = i.y, n = Math.hypot(hx, hy) || 1, f = SPLIT_MATCH.half; channelSplit(f * a * hx / n, f * a * hy / n);}
    else if (mix.spl === 'radial' && a > 0.5) radialSplit(v.rx * k, v.ry * k, a);
  }
}
// 'rare': only the hardest hits flash. The gate opens at strength 0.82 and is full at 0.94: about 1–10 flashes a minute
// on the seven songs, none on most hits. A gate on the hit's own absolute strength, not a rank.
// Round 9: the owner chose 'toward the paper' "by a wide margin" and asked whether it could open lower: three gates.
const GATES = {'82': [0.82, 0.94], '80': [0.8, 0.93], '76': [0.76, 0.9], '70': [0.7, 0.86]}; // '80': the owner's choice (R9)
const rareGate = e => {const [a, b] = GATES[mix.flg] ?? GATES['82']; return smoothstep((e - a) / (b - a));};
function partsFlash(t, k, v) {
  const fl = drive(t, 'flash'); if (!fl.h || fl.m < 0.003 || mix.fls === 'none') return;
  if (mix.fls === 'paperRare' || mix.fls === 'todayRare') {
    const g = rareGate(forceE ?? fl.h.I); if (g < 0.01) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.3 * fl.m * g;
    if (mix.fls === 'todayRare') {ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = '#fff';} else ctx.fillStyle = darkNow ? '#fff' : paperNow;
    ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore(); return;
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (mix.fls === 'today') {ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.3 * fl.m; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);}
  // the same lift, toward the paper's own colour (white would tint a coloured paper)
  else if (mix.fls === 'paper') {ctx.globalAlpha = 0.3 * fl.m; ctx.fillStyle = darkNow ? '#fff' : paperNow; ctx.fillRect(0, 0, canvas.width, canvas.height);}
  // bloom: the light comes from the impact, a soft disc around the rider instead of the whole screen
  else if (mix.fls === 'bloom') {
    const cx = v.rx * k, cy = v.ry * k, r = 0.5 * canvas.width, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.6 * fl.m; ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.restore();
}
// red scaled up and blue scaled down about a point: the colours spread out from the impact
function radialSplit(cx, cy, px) {
  const [src, ...rgb] = chan, w = canvas.width, h = canvas.height;
  for (const c of chan) if (c.width !== w || c.height !== h) {c.width = w; c.height = h;}
  src.getContext('2d').drawImage(canvas, 0, 0);
  ['#ff0000', '#00ff00', '#0000ff'].forEach((col, i) => {const g = rgb[i].getContext('2d'); g.globalCompositeOperation = 'source-over'; g.drawImage(src, 0, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = col; g.fillRect(0, 0, w, h);});
  // blue at 1, green at 1 + f, red at 1 + 2f: every channel covers the frame (no coloured border), at the cost of a ≤ 2 % swell
  const f = px / (0.7 * w), o = (c, s) => ctx.drawImage(c, cx - cx * s, cy - cy * s, w * s, h * s);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'lighter';
  o(rgb[0], 1 + 2 * f); o(rgb[1], 1 + f); o(rgb[2], 1); ctx.globalCompositeOperation = 'source-over';
}
/** Camera-level response to hits: a screen offset (px). */
function hitCamera(t) {
  if (mix.hit === 'parts') {
    // the 'exaggerate' viewing aid (question mode slider, or ?shakeX=): ×1 returns the shake untouched, so renders never change
    const c = partsCamera(t); return shakeX === 1 ? c : {dx: c.dx * shakeX, dy: c.dy * shakeX, rot: c.rot * shakeX};
  }
  const A = acc(); let dx = 0, dy = 0;
  if (A.today || A.todayW) {
    const m = A.todayW ? traumaW(t, 1.6, 7, 1.5) : trauma(t, {min: 0.22, gain: 1.6, decay: 7, power: 1.5}), w = 2 * Math.PI * 9;
    return {dx: 10 * m * Math.sin(w * t), dy: 10 * m * Math.sin(w * 1.37 * t + 1.7)};
  }
  for (const {h, age, e} of activeHits(t, 0.6)) {
    const i = into(h);
    const w = excess(e);
    if (A.kick) {const a = A.kick * (A.held ? (10 + 26 * w) * held(age, w) : (6 + 20 * e) * decay(age, 0.075, e)); dx += i.x * a; dy += i.y * a;}
    // one damped cycle: the first lobe deepens the blow, the second throws the frame back past rest, then it settles
    // exactly one cycle (0.2 s): swings of 20 px then −9.5 px at full strength, then nothing
    if (A.recoil && age < 0.2) {const a = 30 * big(w) * Math.exp(-age / 0.13) * Math.sin(2 * Math.PI * 5 * age); dx += i.x * a; dy += i.y * a;}
    // three quick swings (11 Hz, gone in about 0.27 s), mostly along the blow with a little across it: today's spirit,
    // but only on the hardest hits (w², like punch and recoil) and never as a rattle on ordinary ones
    if (A.shake && age < (A.impact ? 4 : 3) / 11) {const a = 16 * A.shake * big(w) * Math.exp(-age / (A.impact ? 0.13 : 0.1)), ph = 2 * Math.PI * 11 * age; dx += a * (i.x * Math.sin(ph) - 0.45 * i.y * Math.sin(1.37 * ph + 1.7)); dy += a * (i.y * Math.sin(ph) + 0.45 * i.x * Math.sin(1.37 * ph + 1.7));}
  }
  const n = Math.hypot(dx, dy), cap = A.recoil || A.shake ? 56 : A.held ? 36 : 28; if (n > cap) {dx *= cap / n; dy *= cap / n;}
  return {dx, dy};
}

// ── drawing ────────────────────────────────────────────────────────────────
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mixHex = (a, b, t) => {const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, '0')).join('');};
// Background study (round 8): a palette's line, bars and accent kept exactly; only the paper moves, along one plain direction
// (OKLCH: less colour, almost neutral, lighter, darker). The pencil keeps its offset from the paper.
const BG_STUDY = {
  kraft: [['less colour', '#c6b7a4'], ['almost neutral', '#bdb9b3'], ['lighter', '#e4ccad'], ['lighter, less colour', '#dacebf'], ['darker', '#bb9e79']],
  cyanotype: [['less colour', '#384c69'], ['almost neutral', '#454c54'], ['darker', '#0f305d'], ['darker, less colour', '#223247'], ['lighter', '#305b99']],
  rothko: [['less colour', '#221314'], ['almost neutral', '#1b1617'], ['darker', '#120103'], ['darker, less colour', '#0c0304'], ['lighter', '#3b1a1e']],
};
for (const [b, vs] of Object.entries(BG_STUDY)) vs.forEach(([, paper], i) => {
  const o = SCHEMES[b], d = hex(o.pencil).map((c, j) => c - hex(o.paper)[j]), pencil = '#' + hex(paper).map((c, j) => clamp(c + d[j], 0, 255).toString(16).padStart(2, '0')).join('');
  SCHEMES[`${b}~${i}`] = {...o, paper, pencil}; DIMS.scheme[1][`${b}~${i}`] = `${DIMS.scheme[1][b]}, paper ${vs[i][0]}`;
});
// Round 9: whole-theme variants (agents/palettes-r9/variants.js): in every loved scheme the bars carry more colour than the paper.
const VARIANTS = {
  'kraft~a': ['As designed, richer bars', 'kraft', {mass: '#5d3414'}],
  'kraft~b': ['Darker paper, richer bars', 'kraft', {paper: '#bb9e79', mass: '#552c0a'}],
  'kraft~c': ['Lighter paper, lighter bars, dark accent', 'kraft', {paper: '#e4ccad', mass: '#8b6a4d', accent: '#1a140e'}],
  'kraft~d': ['Lighter paper, lighter bars, red accent', 'kraft', {paper: '#e4ccad', mass: '#8b6a4d', accent: '#b23a2a'}], // R10: "maybe something red-ish?"
  'cyanotype~a': ['A little more colour than “less”', 'cyanotype', {paper: '#304b71'}],
  'cyanotype~b': ['A little more colour, toward indigo', 'cyanotype', {paper: '#3b456c'}],
  'cyanotype~c': ['Darker, quieter', 'cyanotype', {paper: '#21334f'}],
  'rothko~a': ['As designed, dusty-rose bars', 'rothko', {mass: '#b0696c'}],
  'rothko~b': ['As designed, peach bars', 'rothko', {mass: '#c78669'}],
};
for (const [key, [label, b, o]] of Object.entries(VARIANTS)) {
  const base = SCHEMES[b], paper = o.paper ?? base.paper, d = hex(base.pencil).map((c, j) => c - hex(base.paper)[j]);
  SCHEMES[key] = {...base, ...o, pencil: o.paper ? '#' + hex(paper).map((c, j) => clamp(c + d[j], 0, 255).toString(16).padStart(2, '0')).join('') : base.pencil};
  DIMS.scheme[1][key] = `${DIMS.scheme[1][b]}: ${label}`;
}
// Round 9 decisions: Kraft takes the darker paper; Cyanotype and Rothko take "less colour"; the other liked papers stay as siblings.
SCHEMES.kraft = {...SCHEMES['kraft~4']};
SCHEMES.cyanotypeIndigo = {...SCHEMES['cyanotype~b']}; SCHEMES.cyanotypeDeep = {...SCHEMES['cyanotype~c']}; SCHEMES.cyanotype = {...SCHEMES['cyanotype~0']};
SCHEMES.rothkoNeutral = {...SCHEMES['rothko~1']}; SCHEMES.rothko = {...SCHEMES['rothko~0']};
Object.assign(DIMS.scheme[1], {cyanotypeIndigo: 'Cyanotype, indigo', cyanotypeDeep: 'Cyanotype, deep', rothkoNeutral: 'Rothko, neutral'});
// the address was read before these existed: honour a variant asked for in ?m=
for (const kv of (q.get('m') ?? '').split(',')) {const [k2, v2] = kv.split(':'); if (k2 === 'scheme' && v2?.includes('~') && SCHEMES[v2]) mix.scheme = v2;}
const easeOut = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const colourOf = h => SRC[h.src] ?? SRC.other;

// The drop switch: during the hand-placed Night cue, a scheme can hand over to its 'drop' partner (a cut on the cue), a darker
// scheme of the same family, instead of Night's dark version of itself.
const DROPS = {graphite: 'black', hokusai: 'midnight', dune: 'espresso', lagoon: 'moss', slate: 'midnight', mauve: 'plum', olive: 'moss', sumi: 'black', bauhaus: 'black'};
// The accent (and the sun, unless the partner has its own, like Midnight's moon) carries over, so the switch keeps one thread.
const dropScheme = {}, schemeAt = t => {
  const o = SCHEMES[mix.scheme], d = DROPS[mix.scheme];
  if (!(mix.night === 'switch' && S?.night && t >= S.night[0] && t < S.night[1] && d)) return o;
  return dropScheme[mix.scheme] ??= {...SCHEMES[d], accent: o.accent, sun: SCHEMES[d].sun ?? o.sun ?? o.accent};
};
// Paper: plain, or answering the intensity metric; night is one optional hand-placed cue on top of either.
function themeAt(t) {
  const p = schemeAt(t), lit = bg => ({bg, ink: p.ink, pencil: p.pencil, dark: 0});
  if (mix.night === 'on' && S.night && t >= S.night[0] && t < S.night[1]) return {bg: p.nightPaper, ink: p.nightInk, pencil: mixHex(p.nightPaper, p.nightInk, 0.38), dark: 1};
  if (mix.bg === 'porcelain') return lit(mixHex(p.paper, p.mass, 0.05));
  if (mix.bg === 'whisper') return lit(mixHex(p.paper, p.tone ?? p.mass, (p.tone ? 1 : 0.055) * intensityAt(t)));
  if (mix.bg === 'late') return lit(mixHex(p.paper, p.tone ?? p.mass, (p.tone ? 1 : 0.055) * smoothstep((intensityAt(t) - 0.5) / 0.3)));
  if (mix.bg === 'xray') return lit(mixHex('#ffffff', '#ffb000', intensityAt(t)));
  return lit(p.paper);
}
// The top of the frame, behind the ride. The sun is a mass, not a line: it stays colour on a phone.
function drawTop(t, alpha, th) {
  const p = schemeAt(t); ctx.save(); ctx.globalAlpha = alpha;
  if (mix.top === 'vignette') {
    // still and faint: fainter at the top than the bottom, eased so that no edge shows
    const c = hex(th.dark ? '#ffffff' : p.ink).join(','), fade = (y0, y1, o) => {const l = ctx.createLinearGradient(0, y0, 0, y1); for (let i = 0; i <= 8; i++) l.addColorStop(i / 8, `rgba(${c},${o * (1 - i / 8) ** 2})`); ctx.fillStyle = l; ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));};
    fade(0, 0.18 * H, 0.025); fade(H, 0.74 * H, 0.05); // the most it should ever be
  }
  if (mix.top === 'sun') {ctx.fillStyle = th.dark ? p.nightInk : p.sun ?? p.accent; ctx.beginPath(); ctx.arc(0.74 * W, 0.17 * H, W * (0.1 + 0.09 * intensityAt(t)), 0, 2 * Math.PI); ctx.fill();}
  if (mix.top === 'title' || mix.top === 'titleCut') {
    // at most two lines, broken where the two are most even, never wider than 62 % of the frame (smaller type if needed)
    const words = SONGS[song].replace(/\s*\(.*\)/, '').toUpperCase().split(' '), font = px => `800 ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.font = font(92); const wd = a => ctx.measureText(a.join(' ')).width;
    let lines = [words]; for (let i = 1; i < words.length; i++) {const c = [words.slice(0, i), words.slice(i)]; if (Math.max(...c.map(wd)) < Math.max(...lines.map(wd))) lines = c;}
    const px = Math.min(92, 92 * 0.62 * W / Math.max(...lines.map(wd)));
    ctx.fillStyle = th.ink; ctx.font = font(px); ctx.textBaseline = 'top'; lines.forEach((l, i) => ctx.fillText(l.join(' '), 0.07 * W, 0.04 * H + i * 1.02 * px));
    titleBox = [0.07 * W - 4, 0.04 * H - 4, Math.max(...lines.map(l => ctx.measureText(l.join(' ')).width)) + 8, lines.length * 1.02 * px + 8];
  }
  ctx.restore();
}
// X-ray only: the whole curve along the top of the frame, with a playhead.
function drawGauge(t, th) {
  const y = S.drives[mix.drive], x0 = 0.07 * W, wd = 0.86 * W, top = 0.035 * H, ht = 0.06 * H, X = i => x0 + wd * i / (y.length - 1), Y = v => top + ht * (1 - v);
  ctx.save(); ctx.strokeStyle = th.ink; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, Y(0)); ctx.lineTo(x0 + wd, Y(0)); ctx.stroke();
  ctx.globalAlpha = 0.9; ctx.lineWidth = 5; ctx.beginPath(); y.forEach((v, i) => {if (i % 3 === 0) ctx.lineTo(X(i), Y(v));}); ctx.stroke();
  ctx.globalAlpha = 1; ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(x0 + wd * clamp(t / S.duration, 0, 1), Y(intensityAt(t)), 13, 0, 2 * Math.PI); ctx.fill(); ctx.restore();
}

function visibleLines(c) {
  const z = c.z, x0 = c.x - c.ax / z - 40, x1 = c.x + (W - c.ax) / z + 40, y0 = c.y - c.ay / z - 40, y1 = c.y + (H - c.ay) / z + 40, out = [];
  const seen = new Set();
  for (let gx = Math.floor(x0 / S.G); gx <= Math.floor(x1 / S.G); gx++)
    for (let gy = Math.floor(y0 / S.G); gy <= Math.floor(y1 / S.G); gy++)
      for (const l of S.grid.get(gx + ',' + gy) ?? []) if (!seen.has(l)) {seen.add(l); out.push(l);}
  return out;
}
let forceE = null, slowmo = false, slowRun = false, lastTs = 0; // the hit bench: a chosen strength, played slowly
let paperNow = '#ffffff';
let darkNow = 0, overNow = 0; // night amount; how far into the whole-course view we are (0–1)
function drawLines(lines, at, z, th) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = filter => {ctx.beginPath(); for (const l of lines) if (filter(l)) {ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2);}};
  const ink = Math.max(2, 3.6 / z);
  if (mix.ink === 'ink') {path(() => true); cut(ink, z, th, () => path(() => true)); ctx.strokeStyle = th.ink; ctx.lineWidth = ink; ctx.stroke(); return;}
  const done = mix.ink === 'rail' ? l => l.rail <= at : l => l.ink <= at;
  path(l => !done(l)); ctx.strokeStyle = overNow > 0.02 ? mixHex(th.pencil, th.ink, 0.25 * overNow) : th.pencil; ctx.lineWidth = Math.max(1.3, (3 + 1.4 * overNow) / z); ctx.stroke();
  path(done); cut(ink, z, th, () => path(done)); ctx.strokeStyle = th.ink; ctx.lineWidth = ink; ctx.stroke();
}
// 'line in front': the inked line carries a thin rim of paper, so where it crosses the title it visibly passes
// in front; on bare paper the rim is invisible.
// Clipped to the title's box, so it never cuts the pencil line ahead of the rider or the band.
let titleBox = null;
function cut(ink, z, th, rebuild) {
  if (mix.top !== 'titleCut' || !titleBox || overNow > 0.99) return;
  const m = ctx.getTransform(), k = canvas.width / W; ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0); ctx.beginPath(); ctx.rect(...titleBox); ctx.clip();
  ctx.setTransform(m); rebuild(); ctx.strokeStyle = th.bg; ctx.lineWidth = ink + 2 * 7 / z; ctx.stroke(); ctx.restore(); rebuild();
}
function riderCamera(v, ox, oy, k) {
  // the rider stays on its own screen point at any zoom
  const zr = v.z, px = v.rx + ox, py = v.ry + oy;
  return {x: v.R.x + (W / 2 - px) / zr, y: v.R.y + (H / 2 - py) / zr, z: zr * k, w: canvas.width, h: canvas.height, r: 1};
}
// Afterimage: the rider's exact pose at the hit, flat, left at its world position. It fades slowly: at the rider's speed the
// frame is crossed in about half a second, so usually the camera, not the fade, takes it away.
function drawGhosts(sheet, t, v, hc, k, th) {
  if (overlay.width !== canvas.width || overlay.height !== canvas.height) {overlay.width = canvas.width; overlay.height = canvas.height;}
  const p = schemeAt(t);
  for (const {h, age, e} of activeHits(t, 1.2)) {
    const life = 0.5 + 0.7 * excess(e); if (age > life) continue;
    paint(octx, riderCamera(v, hc.dx, hc.dy, k), sheet, riderAt(S.frames, h.tc * FPS), h.tc * FPS);
    octx.save(); octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalCompositeOperation = 'source-in'; octx.fillStyle = mixHex(mixHex(th.bg, th.ink, 0.3), p.accent, smoothstep((e - 0.2) / 0.5)); octx.fillRect(0, 0, overlay.width, overlay.height); octx.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = Math.pow(1 - age / life, 0.8); ctx.drawImage(overlay, 0, 0); ctx.restore();
  }
}
function drawRider(sheet, rc, at, M = [1, 0, 0, 1, 0, 0]) {
  if (overlay.width !== canvas.width || overlay.height !== canvas.height) {overlay.width = canvas.width; overlay.height = canvas.height;}
  paint(octx, rc, sheet, riderAt(S.frames, at), at);
  ctx.setTransform(...M); ctx.drawImage(overlay, 0, 0);
}
function spectrumRow(t) {
  const sp = S.spectrum, x = clamp(t * sp.fps, 0, sp.frames.length - 1), i = Math.floor(x), j = Math.min(i + 1, sp.frames.length - 1), u = x - i;
  return sp.frames[i].map((v, b) => v + (sp.frames[j][b] - v) * u);
}
function drawBars(t, a = 1) {
  const row = spectrumRow(t), n = row.length, gap = 3, bw = (W - gap * (n - 1)) / n, base = 0.73 * H, max = 0.17 * H;
  const ramp = ['#38d6c8', '#6ad36a', '#f0b429', '#ff5a4f'], stops = [0, .4, .7, 1];
  const col = u => {let s = 0; while (s < 2 && u > stops[s + 1]) s++; return mixHex(ramp[s], ramp[s + 1], (u - stops[s]) / (stops[s + 1] - stops[s]));};
  row.forEach((v, b) => {
    const h = Math.max(2, v * max), x = b * (bw + gap); ctx.fillStyle = col(b / (n - 1));
    ctx.globalAlpha = 0.95 * a; ctx.fillRect(x, base - h, bw, h); ctx.globalAlpha = 0.42 * a; ctx.fillRect(x, base, bw, h);
  });
  ctx.globalAlpha = 1;
}
function smoothPath(pts) {
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);}
  ctx.lineTo(pts.at(-1).x, pts.at(-1).y);
}
// The lower band sits between the ride and the Shorts comments (which start near 0.85 H).
const bandShift = () => ({low: 0, lowmid: -0.015 * H, mid: -0.03 * H, high: -0.07 * H}[mix.bandY] ?? 0);
function drawSpectrum(t, form, alpha, th) {
  ctx.save(); ctx.translate(0, bandShift());
  const gain = mix.bandBy === 'level' ? 0.7 + 0.42 * intensityAt(t) : 1, row = spectrumRow(t).map(v => Math.min(1, v * gain)), n = row.length, step = W / n, lit = c => th.dark ? mixHex(c, '#ffffff', 0.62 * th.dark) : c;
  ctx.globalAlpha = alpha; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const third = i => Math.min(2, Math.floor(i / n * 3));
  const p = schemeAt(t), RED = p.accent, graphite = th.dark ? p.nightInk : p.mass;
  if (form === 'red') {
    // One red: graphite stems; the chosen logic turns a few dots the scarf's red (solid, ≥ 4 px: colour survives only in masses)
    const base = 0.825 * H, hgt = 0.15 * H, r = 7, hot = redAt(t, row);
    row.forEach((v, i) => {
      if (v <= 0) return; const x = (i + .5) * step, y = base - r - (hgt - 2 * r) * v, on = hot.has(i);
      ctx.strokeStyle = mixHex(th.bg, graphite, 0.42); ctx.lineWidth = 3; ctx.globalAlpha = alpha * 0.7; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = on ? RED : graphite; ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(x, y, on ? r + 2 : r, 0, 2 * Math.PI); ctx.fill();
    });
  } else if (form === 'redblocks') {
    // graphite blocks; only the top lit cell of a chosen column turns red
    const base = 0.81 * H, hgt = 0.15 * H, cell = hgt / 16, bw = step * 0.58, hot = redAt(t, row);
    row.forEach((v, i) => {
      const c = Math.floor(v * 16); if (!c) return; const x = (i + .5) * step - bw / 2, h = c * cell;
      ctx.fillStyle = graphite; ctx.globalAlpha = alpha * 0.85; ctx.fillRect(x, base - h, bw, h);
      if (hot.has(i)) {ctx.fillStyle = RED; ctx.globalAlpha = alpha; ctx.fillRect(x, base - h, bw, Math.min(h, Math.max(cell * 2, 8)));}
    });
  } else if (form === 'redbars') {
    // graphite bars with a reflection; a chosen bar turns solid red
    const base = 0.80 * H, hgt = 0.15 * H, bw = step * 0.8, room = 0.853 * H - (base + bandShift()) - 6, hot = redAt(t, row);
    row.forEach((v, i) => {
      const h = Math.max(2, v * hgt), x = (i + .5) * step - bw / 2; ctx.fillStyle = hot.has(i) ? RED : graphite;
      ctx.globalAlpha = alpha * 0.92; ctx.fillRect(x, base - h, bw, h); ctx.globalAlpha = alpha * 0.28; ctx.fillRect(x, base + 4, bw, Math.min(h * 0.62, room));
    });
  } else if (form === 'stems') {
    const base = 0.825 * H, hgt = 0.15 * H, pal = ['#328ca0', '#7787b7', '#c47a85'], r = 7;
    row.forEach((v, i) => {
      if (v <= 0) return; const x = (i + .5) * step, y = base - r - (hgt - 2 * r) * v, c = lit(pal[third(i)]);
      ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.globalAlpha = alpha * 0.6; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = c; ctx.globalAlpha = alpha * 0.92; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
    });
  } else if (form === 'bars3' || form === 'blocks') {
    // Codex's three-colour bars (Porcelain mirror) and quantized blocks (Electric registration)
    const base = 0.80 * H, hgt = 0.15 * H, blocks = form === 'blocks';
    const pal = blocks ? ['#489ca5', '#8376b5', '#b572a1'] : ['#66a7ac', '#8b99be', '#c095a3'];
    const bw = step * (blocks ? 0.58 : 0.8), room = 0.853 * H - (base + bandShift()) - 6; // the reflection stops above the comment bubble
    row.forEach((v, i) => {
      const h = blocks ? Math.floor(v * 16) / 16 * hgt : Math.max(2, v * hgt); if (!h) return;
      const x = (i + .5) * step - bw / 2; ctx.fillStyle = lit(pal[third(i)]);
      ctx.globalAlpha = alpha * (blocks ? 0.8 : 0.92); ctx.beginPath(); ctx.roundRect(x, base - h, bw, h, Math.min(2, bw / 4)); ctx.fill();
      if (!blocks) {ctx.globalAlpha = alpha * 0.32; ctx.fillRect(x, base + 4, bw, Math.min(h * 0.62, room));}
    });
  } else if (form === 'slits') {
    const base = 0.82 * H, hgt = 0.14 * H;
    ctx.strokeStyle = lit('#315ca4'); ctx.lineWidth = 3.6; ctx.beginPath();
    row.forEach((v, i) => {if (v <= 0) return; const c = (i + .5) * step, half = step * .26, top = base - v * hgt;
      ctx.moveTo(c - half, base); ctx.lineTo(c - half, top); ctx.lineTo(c + half, top); ctx.lineTo(c + half, base);});
    ctx.stroke();
  } else if (form === 'iris') {
    const base = 0.82 * H, hgt = 0.14 * H;
    const contour = (vals, dy) => {const pts = vals.map((v, i) => ({x: -10 + (W + 20) * i / (n - 1), y: base - v * hgt * 0.72 + dy})); ctx.beginPath(); smoothPath(pts);};
    [.06, .12, .18, .24, .3, .36, .42].map((age, i) => ({age, i})).reverse().forEach(({age, i}) => {
      if (t < age) return; contour(spectrumRow(t - age), hgt * .04 * (i + 1));
      ctx.strokeStyle = lit('#8f86c9'); ctx.lineWidth = 2.6; ctx.globalAlpha = alpha * (.42 - i * .032); ctx.stroke();
    });
    contour(row, 0); ctx.strokeStyle = lit('#2f3a74'); ctx.lineWidth = 3.8; ctx.globalAlpha = alpha * .92; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
// Today's shipped accents, from scripts/fx_recipe.ts LOCKED_FX, keyed like production (overlay hit time).
// today's trauma, but each hit contributes w² (its real strength, like every round-6 accent) instead of passing a threshold
const traumaW = (t, gain, dec, pw) => {let x = 0; for (const h of S.hits) {if (h.tc > t) break; x += big(excess(forceE ?? h.I)) * gain * Math.exp(-(t - h.tc) * dec);} return Math.pow(Math.min(1, x), pw);};
const trauma = (t, c) => {const fs = forceE === null ? null : 0.2 + 0.65 * Math.pow(forceE, 1 / 1.4); let x = 0; for (const h of S.hits) {if (h.t > t) break; const hs = fs ?? h.s; if (hs < c.min) continue; x += hs * c.gain * Math.exp(-(t - h.t) * c.decay);} return Math.pow(Math.min(1, x), c.power);};
const chan = [document.createElement('canvas'), document.createElement('canvas'), document.createElement('canvas'), document.createElement('canvas')];
function channelSplit(ox, oy, mode = 'centre') {
  // red one way, blue the other, green in place ('trail': red at d, green at d/2, blue in place); overscan hides the edges
  const [src, ...rgb] = chan, w = canvas.width, h = canvas.height;
  for (const c of chan) if (c.width !== w || c.height !== h) {c.width = w; c.height = h;}
  src.getContext('2d').drawImage(canvas, 0, 0);
  ['#ff0000', '#00ff00', '#0000ff'].forEach((col, i) => {const g = rgb[i].getContext('2d'); g.globalCompositeOperation = 'source-over'; g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = col; g.fillRect(0, 0, w, h);});
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'lighter';
  const m = Math.ceil(Math.hypot(ox, oy)) + 2, o = (c, dx, dy) => ctx.drawImage(c, dx - m, dy - m * h / w, w + 2 * m, h + 2 * m * h / w);
  if (mode === 'trail') {o(rgb[0], ox, oy); o(rgb[1], ox / 2, oy / 2); o(rgb[2], 0, 0);}
  else {o(rgb[0], ox, oy); o(rgb[1], 0, 0); o(rgb[2], -ox, -oy);}
  ctx.globalCompositeOperation = 'source-over';
}
function worldSplit(t, k) {
  const A = acc(); if (!A.split) return;
  let ox = 0, oy = 0;
  for (const {h, age, e} of activeHits(t, 0.6)) {const w = excess(e), a = (A.held ? (2 + 16 * w + (A.impact ? 12 * big(w) : 0)) * held(age, w) : (2 + 12 * e) * decay(age, 0.06, e)), i = into(h); ox += i.x * a; oy += i.y * a;}
  const n = Math.hypot(ox, oy), cap = A.impact ? 28 : A.held ? 18 : 14; if (n > cap) {ox *= cap / n; oy *= cap / n;}
  if (Math.hypot(ox, oy) * k > 1) {channelSplit(ox * k, oy * k); return true;}
  return false;
}
function postAccents(t, k, v, ox, oy) {
  if (mix.hit === 'parts') return partsFlash(t, k, v);
  const A = acc();
  if (A.today || A.todayW) {
    const split = 14 * (A.todayW ? traumaW(t, 2.0, 7, 1.4) : trauma(t, {min: 0.25, gain: 2.0, decay: 7, power: 1.4})) * k;
    if (split > 0.5) channelSplit(split, 0);
    const flash = 0.3 * (A.todayW ? traumaW(t, 1.8, 12, 1) : trauma(t, {min: 0.3, gain: 1.8, decay: 12, power: 1}));
    if (flash > 0.003) {ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = flash; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;}
    return;
  }
  // the rider keeps half of its own clean image through the split (round 4: "slightly less split" on the rider)
  if (worldSplit(t, k) && A.held) {ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.5; ctx.drawImage(overlay, 0, 0); ctx.restore();}
  const hits = Object.keys(A).length ? activeHits(t, 0.6) : [];
  if (A.flash) {
    let f = 0; for (const {age, e} of hits) {const w = excess(e); f = Math.max(f, A.held ? (0.1 + 0.2 * w + (A.impact ? 0.15 * big(w) : 0)) * held(age, w) : A.flash * (0.1 + 0.18 * e) * decay(age, 0.05, e));}
    f *= 1 - 0.6 * darkNow; // on night the flash would only grey the black
    // the flash lifts the ink toward the paper, on any paper; a white flash would tint a coloured one
    if (f > 0.004) {ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = f; ctx.fillStyle = darkNow ? '#fff' : paperNow; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;}
  }
}
async function draw() {
  if (!S || !canvas.width || !canvas.height) return;
  const sheet = await sheetPromise;
  if (!S) return; // a song load may have begun while this frame waited for the sprite sheet (it used to throw on S.frames)
  const t = seconds, at = clamp(t * FPS, 0, S.frames.length - 1), k = canvas.width / W;
  const th = themeAt(t), v = bookend(t, cameraAt(mix, at), at), hc = hitCamera(t);
  overNow = v.over; darkNow = th.dark; paperNow = th.bg;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (mix.grain === 'on') drawGrain(v, k, th);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (mix.top !== 'none') {const a = (1 - v.over) ** 2; if (a > 0.003) drawTop(t, a, th);}
  const band = v.ending ? (1 - v.over) ** 2 : mix.bandIn === 'present' ? 1 : mix.bandIn === 'quick' ? 0.3 + 0.7 * smoothstep(t / 0.5) : (1 - v.over) ** 2;
  const BANDS = ['red', 'redblocks', 'redbars', 'stems', 'iris', 'slits', 'bars3', 'blocks'], parts = mix.hit === 'parts';
  // 'all' (R11, the owner's preference): the band is drawn before the ride, so the split catches it with the title and sun
  const splitAll = parts && mix.spw === 'all';
  if ((!parts || splitAll) && band > 0.003 && BANDS.includes(mix.music)) drawSpectrum(t, mix.music, band, th);
  // the punch scales about the rider's own screen point, so the rider stays put and the world closes in around it
  const zp = 1 + (hitZoom(t) - 1) * (1 - v.over) ** 2, vz = zp === 1 ? v : {...v, z: v.z * zp, x: v.R.x, y: v.R.y, ax: v.rx, ay: v.ry};
  const cc = {...vz, ax: vz.ax + hc.dx, ay: vz.ay + hc.dy};
  const R = hc.rot ? new DOMMatrix().translate(canvas.width / 2, canvas.height / 2).rotate(hc.rot).translate(-canvas.width / 2, -canvas.height / 2) : null;
  const world = new DOMMatrix([cc.z * k, 0, 0, cc.z * k, (cc.ax - cc.x * cc.z) * k, (cc.ay - cc.y * cc.z) * k]);
  ctx.setTransform(R ? R.multiply(world) : world);
  drawLines(visibleLines(cc), at, cc.z, th);
  if (acc().ghost) drawGhosts(sheet, t, v, hc, k, th);
  drawRider(sheet, riderCamera(vz, hc.dx, hc.dy, k), at, R ? [R.a, R.b, R.c, R.d, R.e, R.f] : undefined);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  // parts: split the ride, then lay the band over it unsplit, as production composites its overlay above the ride video
  if (parts) {partsSplit(t, k, v); ctx.setTransform(k, 0, 0, k, 0, 0); if (!splitAll && band > 0.003 && BANDS.includes(mix.music)) drawSpectrum(t, mix.music, band, th);}
  if (mix.music === 'bars' && band > 0.003) drawBars(t, band);
  postAccents(t, k, v, hc.dx, hc.dy);
  if (mix.bg === 'xray') {ctx.setTransform(k, 0, 0, k, 0, 0); drawGauge(t, th);}
}

// Paper grain: a faint fibre texture fixed to the WORLD, so the paper itself moves past the rider. On a plain paper with an
// overhead line, nothing else on screen tells a dive from standing still. Fixed seed, about 2 px specks on screen.
const grainTiles = {};
function drawGrain(v, k, th) {
  const lum = hex(th.bg).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0) / 255, dark = lum < 0.45; // dark schemes are lit themes too
  const col = dark ? '#fff' : '#000';
  if (!grainTiles[col]) {
    const tile = grainTiles[col] = document.createElement('canvas'); tile.width = tile.height = 512; const g = tile.getContext('2d');
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 2600; i++) {g.globalAlpha = 0.25 + 0.75 * rnd(); g.fillStyle = col; const r = 0.6 + 1.6 * rnd(); g.beginPath(); g.ellipse(512 * rnd(), 512 * rnd(), r * (1 + 2 * rnd()), r, Math.PI * rnd(), 0, 2 * Math.PI); g.fill();}
  }
  const z = v.z * k, ox = (v.ax - v.x * v.z) * k, oy = (v.ay - v.y * v.z) * k, s = 2.2 * k / z; // one tile texel ≈ 2.2 screen px
  ctx.save(); ctx.globalAlpha = dark ? 0.07 : 0.055;
  const pat = ctx.createPattern(grainTiles[col], 'repeat'); pat.setTransform(new DOMMatrix([s, 0, 0, s, 0, 0]));
  ctx.setTransform(z, 0, 0, z, ox, oy); ctx.fillStyle = pat; ctx.fillRect((-ox) / z, (-oy) / z, canvas.width / z, canvas.height / z); ctx.restore();
}

// ── loading, transport, UI ─────────────────────────────────────────────────
const cache = new Map();
// ?rides=old (or a question moment marked 'old') plays the round 1–5 rides; the cache keeps both
let ridesOld = q.get('rides') === 'old', loadedOld = null;
// a moment can carry an override (for example 'On Dune'); it now stays while the viewer switches options, until another moment
let momentExtra = null, momentLabel = '';
async function loadSong(key) {
  const id = ++loadId; song = key; S = null; loadedOld = ridesOld; status('Loading ' + SONGS[key] + (ridesOld ? ' (round-5 ride)' : '') + '…');
  const ck = key + (ridesOld ? ':old' : '');
  // returns false when a newer load superseded this one, so callers stop instead of applying their now-stale state
  if (cache.has(ck)) {const c = cache.get(ck); if (!shot) await music.load(c.audio).catch(() => null); if (id !== loadId) return false; S = c;}
  else {
    const data = await (await fetch(`./${ridesOld ? 'data-r5' : 'data'}/${key}.json`)).json();
    const [native] = await Promise.all([replay(data.track, data.trace), shot ? null : music.load(data.audio).catch(() => null)]);
    if (id !== loadId) {if (!cache.has(ck)) cache.set(ck, prepare(data, native)); return false;}
    S = prepare(data, native); cache.set(ck, S);
  }
  $('seek').max = S.duration; seconds = Math.min(seconds, S.duration);
  status(''); renderUI(); await draw();
  if (shot) {window.__ready = true; window.__duration = S.duration; window.__audio = S.audio;
    window.__inkAudit = () => {
      // after the rider has gone by, what is still pencil? distance: closest approach of the body centre to the segment (units)
      const seg = (l, p) => {const dx = l.x2 - l.x1, dy = l.y2 - l.y1, L = dx * dx + dy * dy || 1, u = clamp(((p.x - l.x1) * dx + (p.y - l.y1) * dy) / L, 0, 1); return Math.hypot(p.x - l.x1 - u * dx, p.y - l.y1 - u * dy);};
      let total = 0, inked = 0, stale = {near: 0, mid: 0, far: 0}, chainTail = 0, tailLen = 0, tailHist = [0, 0, 0, 0];
      const chains = new Map(); for (const l of S.lines) {if (!chains.has(l.chain)) chains.set(l.chain, []); chains.get(l.chain).push(l);}
      for (const ch of chains.values()) {
        const touched = ch.some(l => l.touch < Infinity); const len = l => Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
        const lon = ch.reduce((a, l) => a + len(l), 0); let tail = 0; for (const l of ch) {total += len(l); if (l.ink < Infinity) inked += len(l); else {if (touched) tail += len(l);}}
        if (touched && tail > 0) {chainTail++; tailLen += tail; tailHist[tail / lon < .1 ? 0 : tail / lon < .25 ? 1 : tail / lon < .5 ? 2 : 3]++;}
      }
      const step = 8; for (const l of S.lines) if (l.ink === Infinity) {let d = 1e9; const lo = Math.min(l.x1, l.x2) - 60, hi = Math.max(l.x1, l.x2) + 60; for (let f = 0; f < S.centres.length; f += 2) {const c = S.centres[f]; if (c.x >= lo && c.x <= hi) d = Math.min(d, seg(l, c));} const L = Math.hypot(l.x2 - l.x1, l.y2 - l.y1); if (d < 14) stale.near += L; else if (d < 40) stale.mid += L; else stale.far += L;}
      return {chains: chains.size, lines: S.lines.length, inkedShare: +(inked / total).toFixed(3), staleUnits: Object.fromEntries(Object.entries(stale).map(([k, v]) => [k, Math.round(v)])), touchedChainsWithGreyTail: chainTail, tailShareHist_lt10_lt25_lt50_rest: tailHist, totalUnits: Math.round(total)};
    };
    window.__renderAt = async t => {seconds = t; await draw(); return canvas.toDataURL('image/png');};}
  return true;
}
function moments() {
  const dens = S.R.sect.filter(s => s.t1 - s.t0 > 2);
  const quiet = dens.reduce((a, b) => b.density < a.density ? b : a), dense = dens.reduce((a, b) => b.density > a.density ? b : a);
  const big = S.hits.reduce((a, b) => b.s > a.s ? b : a), change = S.phases[Math.min(S.phases.length - 1, Math.floor(S.phases.length / 2))];
  return [['Opening', 0], ['Quiet · ' + quiet.name.toLowerCase(), quiet.t0 + 0.3], ['Dense · ' + dense.name.toLowerCase(), dense.t0 + 0.3],
    ['Section change', Math.max(0, change.t0 - 1.5)], ['Strongest hit', Math.max(0, big.tc - 1.2)], ['Ending', Math.max(0, S.duration - 4)]];
}
let loop = null, loopLen = 4;
function status(text) {const s = $('status'); if (s) s.textContent = text;}
function fmt(t) {return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;}
function sync() {
  $('seek').value = seconds; $('time').textContent = fmt(seconds) + ' / ' + fmt(S?.duration ?? 0);
  if (feelmode) return; // the blind test's address must not carry (or leak) the free lab's look
  const url = new URL(location.href);
  if (qmode) {
    // the option and moment ride in the address too, so a reload mid-question comes back to exactly what was on screen
    url.searchParams.set('q', String(qi + 1));
    qi < QUESTIONS.length && qopt ? url.searchParams.set('opt', LETTERS[qopt]) : url.searchParams.delete('opt');
    qi < QUESTIONS.length && qmoment !== null ? url.searchParams.set('mo', String(qmoment + 1)) : url.searchParams.delete('mo');
    history.replaceState(null, '', url); return;
  }
  url.searchParams.set('song', song); url.searchParams.set('c', preset.id); url.searchParams.set('t', seconds.toFixed(2));
  const diff = Object.keys(mix).filter(d => mix[d] !== preset.mix[d]).map(d => d + ':' + mix[d]);
  diff.length ? url.searchParams.set('m', diff.join(',')) : url.searchParams.delete('m');
  history.replaceState(null, '', url);
}
async function play() {
  if (!S) return; if (seconds >= S.duration - 0.05) seconds = 0;
  $('play').textContent = 'Pause'; $('play').classList.add('on');
  try {await music.play(seconds, 1); playing = music.playing;} catch {playing = false;}
  if (!playing) {$('play').textContent = 'Play'; $('play').classList.remove('on');}
}
function pause() {if (playing) seconds = music.pause(); else music.pause(); playing = false; $('play').textContent = 'Play'; $('play').classList.remove('on'); sync();}
function seek(t) {const resume = playing; if (resume) pause(); seconds = clamp(t, 0, S?.duration ?? 0); draw(); sync(); if (resume) play();}
function qStart(question) {
  if (typeof question.t === 'number') return question.t;
  if (question.t === 'strongest') {const big = S.hits.reduce((a, b) => b.s > a.s ? b : a); return Math.max(0, big.tc - 1.6);}
  return 0;
}
// What is drawn in question mode is ALWAYS the chosen option plus the chosen moment's override, built in this one place.
// (Swipes and arrow keys used to rebuild the option alone and silently drop 'On Dune' while the label still said it.)
function applyOption() {const Q = QUESTIONS[qi]; if (Q?.opts) mix = {...Q.opts[qopt][1], ...(momentExtra ?? {})};}
function setOption(i) {qopt = i; applyOption(); renderQuestion(); draw();}
function setShakeX(x) {shakeX = x; $('exagx').value = String(x); $('exagval').textContent = '×' + (+x).toFixed(1); renderQuestion(); draw();}
async function goQuestion(i, restore = null) {
  const nav = ++navId;
  pause(); qi = i; qopt = 0; momentExtra = null; momentLabel = ''; qmoment = null; scrollTo(0, 0);
  $('qcopy').textContent = 'Copy answers';
  // the viewing aid never follows the viewer into another question (it would silently exaggerate options there)
  if (!restore && shakeX !== 1) setShakeX(1);
  setBench(false);
  if (qi >= QUESTIONS.length) {renderQuestion(); return;}
  const Q = QUESTIONS[qi];
  if (restore && restore.opt > 0 && restore.opt < Q.opts.length) qopt = restore.opt;
  applyOption(); ridesOld = Q.rides === 'old';
  renderQuestion();
  if ((song !== Q.song || ridesOld !== loadedOld) && !await loadSong(Q.song)) return;
  if (nav !== navId) return; // the viewer moved on while this question's song loaded
  setBench(!!Q.bench); // after the load: the bench's histogram is the NEW song's hits
  loop = loopHome = qStart(Q); loopLen = Q.len ?? 4; $('loop').classList.add('on'); $('loop').textContent = `Loop ${loopLen} s`; seek(loop); renderQuestion(); draw();
  if (restore && Q.moments?.[restore.mo]) await goMoment(restore.mo);
}
async function goMoment(j) {
  const Q = QUESTIONS[qi], [label, at, sg, extra, rides] = Q.moments[j], nav = ++navId;
  const was = playing; pause(); ridesOld = rides === 'old'; momentExtra = extra ?? null; qmoment = j;
  momentLabel = extra || rides === 'old' ? label : '';
  applyOption(); renderQuestion();
  if (((sg ?? Q.song) !== song || ridesOld !== loadedOld) && !await loadSong(sg ?? Q.song)) return;
  if (nav !== navId) return;
  loop = loopHome = at === 'end' ? Math.max(0, S.duration - (Q.len ?? 4)) : qStart({t: at}); loopLen = Q.len ?? 4;
  $('loop').classList.add('on'); seek(loop); renderQuestion(); draw(); if (was) play();
}
// Answers: picks are a LIST of option labels plus a separate 'none' flag. Older saves kept one joined string ('A, B' or 'A + B');
// read it back by matching whole labels, so a label that contains a comma still comes back.
function answerOf(Q) {
  const a = answers[Q.id] ??= {pick: null, note: ''}, labels = Q.opts.map(o => o[0]);
  if (!Array.isArray(a.picks)) {
    const s = a.pick && a.pick !== 'none' ? a.pick : '', wrap = sep => sep + s.split(' + ').join(sep) + sep;
    a.picks = s ? labels.filter(l => l === s || wrap(', ').includes(', ' + l + ', ') || wrap(' + ').includes(' + ' + l + ' + ')) : [];
  }
  if (a.none === undefined) a.none = a.pick === 'none';
  a.picks = labels.filter(l => a.picks.includes(l)); // current labels only, in option order
  return a;
}
function pickText(Q, a) {
  if (a.none) return 'None of these';
  return a.picks.map(l => `${LETTERS[Q.opts.findIndex(o => o[0] === l)]} · ${l}`).join(' + ');
}
const LETTERS = 'ABCDEFGHIJKLMNOP';
function renderQuestion() {
  document.body.classList.add('qmode');
  const done = qi >= QUESTIONS.length, Q = QUESTIONS[qi];
  $('moments').replaceChildren(...(!done && Q.moments ? Q.moments.map(([label], j) => chip(label, j === qmoment, () => goMoment(j), 'moment')) : []));
  // the viewing aid shows only on questions that ask for it, and says what it is
  $('exag').hidden = done || !Q?.exaggerate;
  $('optflag').hidden = done || !!Q?.open;
  if (!done && !Q.open) $('optflag').textContent = `${LETTERS[qopt]} · ${Q.opts[qopt][0]}${momentLabel ? ' · ' + momentLabel : ''}${shakeX !== 1 && mix.hit === 'parts' ? ` · shake ×${shakeX.toFixed(1)} (exaggerated)` : ''}`;
  $('qprogress').textContent = done ? 'All done' : `Question ${qi + 1} of ${QUESTIONS.length} · ${SONGS[song]}`;
  $('concept').textContent = done ? 'Thank you.' : Q.ask;
  $('line').textContent = done ? 'Copy your answers and paste them to me in the chat. They are also kept in this browser.' : Q.why;
  // The chosen option's note sits in a block of FIXED height (the longest note of this question), so the answer buttons below never
  // move when the viewer switches options; a 1- vs 2-line note used to shift them and taps landed on the neighbour.
  if (!done && !Q.open) {
    const b = document.createElement('b'); b.textContent = Q.opts[qopt][2] ? LETTERS[qopt] + ': ' + Q.opts[qopt][2] : ''; b.style.cssText = 'display:block;font-weight:500;color:var(--ink);margin-top:6px';
    const probe = document.createElement('b'); probe.style.cssText = b.style.cssText + ';visibility:hidden;position:absolute;left:0;right:0'; $('line').append(b, probe);
    let h = 0; for (const [i, o] of Q.opts.entries()) {probe.textContent = LETTERS[i] + ': ' + (o[2] ?? ''); probe.style.width = b.offsetWidth + 'px'; h = Math.max(h, probe.offsetHeight);}
    probe.remove(); b.style.minHeight = h + 'px';
  }
  $('presets').replaceChildren(...(done ? [] : Q.opts.map(([label], i) => chip(`${LETTERS[i]} · ${label}`, i === qopt, () => setOption(i)))));
  const a = done ? null : answerOf(Q);
  $('presets').hidden = !done && !!Q.open; document.querySelector('.qrow').hidden = !done && !!Q.open;
  // Picks are kept as a LIST. They used to be one comma-joined string split on ', ', so any option whose own name contained a
  // comma ('Toward the paper, hardest only') fell apart and could never be selected (rounds 5–8).
  const toggle = label => {
    if (Q.multi) {const s = new Set(a.picks); s.has(label) ? s.delete(label) : s.add(label); a.picks = Q.opts.map(o => o[0]).filter(l => s.has(l));}
    else a.picks = [label];
    a.none = false; a.pick = pickText(Q, a); saveAnswers(); renderQuestion();
  };
  // 'None of these' is its own flag, never a label: an option may itself be called 'None' (the split question's D)
  const none = () => {a.none = !a.none; a.picks = []; a.pick = a.none ? 'none' : ''; saveAnswers(); renderQuestion();};
  $('qpick').replaceChildren(...(done ? [] : [...Q.opts.map(([label], i) => chip(LETTERS[i], !a.none && a.picks.includes(label), () => toggle(label), 'opt')),
    chip('None of these', a.none, none, 'opt')]));
  $('qnote').rows = Q?.open ? 7 : 2; $('qpicklabel').textContent = Q?.multi ? 'Keep (any number)' : 'My pick';
  $('qnote').hidden = done; $('qnote').value = a?.note ?? ''; $('qnote').oninput = () => {a.note = $('qnote').value; saveAnswers();};
  $('qprev').disabled = qi === 0; $('qnext').textContent = done ? 'Start again' : qi === QUESTIONS.length - 1 ? 'Finish' : 'Next question';
  $('qnext').className = done ? 'tool' : 'play'; $('qcopy').className = done ? 'play' : 'tool';
  $('qsummary').hidden = !done;
  // the summary names each pick by letter AND label, and 'None of these' in words, so 'D · None' and 'None of these' never read alike
  if (done) $('qsummary').value = QUESTIONS.map((Q, i) => {const a = answerOf(Q); return Q.open ? `${i + 1}. ${Q.ask}: ${a.note || '(skipped)'}` : `${i + 1}. ${Q.ask} → ${pickText(Q, a) || '(skipped)'}${a.note ? ` — ${a.note}` : ''}`;}).join('\n');
  $('qcopy').hidden = !done;
  sync();
}
function choosePreset(p) {preset = p; mix = {...p.mix}; renderUI(); draw(); sync();}
function chip(label, on, click, cls = 'chip') {const b = document.createElement('button'); b.className = cls + (on ? ' on' : ''); b.textContent = label; b.onclick = click; return b;}
function renderUI() {
  if (shot || feelmode) return;
  if (qmode) return renderQuestion();
  $('moments').replaceChildren(...moments().map(([label, at]) => chip(label, false, () => {if (loop !== null) loop = at; seek(at);}, 'moment')));
  const songs = $('songs'); songs.replaceChildren(...Object.entries(SONGS).map(([k, v]) => chip(v, k === song, () => {if (k !== song) {pause(); loadSong(k);}}, 'song')));
  const pres = $('presets'); pres.replaceChildren(...PRESETS.map((p, i) => chip(`${i + 1} · ${p.name}`, p === preset, () => choosePreset(p))));
  const custom = Object.keys(mix).some(d => mix[d] !== preset.mix[d]);
  $('concept').textContent = preset.name + (custom ? ' · adjusted' : '') + (shakeX !== 1 ? ` · shake ×${shakeX.toFixed(1)} (?shakeX)` : ''); $('line').textContent = preset.line;
  $('mix').replaceChildren(...Object.entries(DIMS).map(([d, [label, opts]]) => {
    const row = document.createElement('div'); row.className = 'row';
    const name = document.createElement('span'); name.textContent = label;
    const seg = document.createElement('div'); seg.className = 'seg';
    seg.append(...Object.entries(opts).map(([v, l]) => chip(l, mix[d] === v, () => {mix[d] = v; renderUI(); draw(); sync();}, 'opt')));
    row.append(name, seg); return row;
  }));
  sync();
}
function fit() {
  const r = shot ? 1 : Math.min(2, devicePixelRatio || 1), box = canvas.getBoundingClientRect();
  const w = shot ? W : Math.round(box.width * r), h = shot ? H : Math.round(box.height * r);
  if (canvas.width !== w || canvas.height !== h) {canvas.width = w; canvas.height = h; draw();}
}
function tick(ts) {
  if (slowmo && slowRun && S) {seconds += (ts - lastTs) / 1000 * 0.25; if (loop !== null && seconds >= loop + loopLen) seconds = loop; draw(); $('seek').value = seconds;}
  lastTs = ts;
  if (playing && S) {seconds = music.position(onScreen(ts)); if (loop !== null && seconds >= loop + loopLen) {seek(loop); requestAnimationFrame(tick); return;} if (seconds >= S.duration) {pause(); seconds = S.duration;} draw(); $('seek').value = seconds; $('time').textContent = fmt(seconds) + ' / ' + fmt(S.duration);}
  requestAnimationFrame(tick);
}
function cycleOption(dir) {const o = QUESTIONS[qi]?.opts; if (o) setOption((qopt + dir + o.length) % o.length);}
if (shot) document.body.classList.add('shot');
else {
  // one toggle for the button, Space and a tap on the picture: in the bench's slow motion Space and taps used to start the music at
  // full speed on top of the slow clock
  const togglePlay = () => {if (slowmo) {slowRun = !slowRun; $('play').textContent = slowRun ? 'Pause' : 'Play'; return;} playing ? pause() : play();};
  $('play').onclick = togglePlay;
  $('seek').oninput = () => seek(+$('seek').value);
  $('back').onclick = () => seek(seconds - 5); $('fwd').onclick = () => seek(seconds + 5);
  addEventListener('keydown', e => {
    if (e.target.closest?.('input,textarea')) return;
    if (feelmode) return; // the blind test is driven by its own buttons; keys used to switch it to a preset's look mid-test
    const i = PRESETS.indexOf(preset);
    if (e.code === 'Space') {e.preventDefault(); togglePlay();}
    else if (e.key === 'ArrowRight' && e.shiftKey) seek(seconds + 2);
    else if (e.key === 'ArrowLeft' && e.shiftKey) seek(seconds - 2);
    else if (qmode && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && qi < QUESTIONS.length) cycleOption(e.key === 'ArrowRight' ? 1 : -1);
    else if (!qmode && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) {e.preventDefault(); choosePreset(PRESETS[(i + 1) % PRESETS.length]);}
    else if (!qmode && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) {e.preventDefault(); choosePreset(PRESETS[(i + PRESETS.length - 1) % PRESETS.length]);}
    else if (!qmode && /^[1-9]$/.test(e.key) && PRESETS[+e.key - 1]) choosePreset(PRESETS[+e.key - 1]);
    else if (qmode && /^[1-9]$/.test(e.key) && QUESTIONS[qi]?.opts?.[+e.key - 1]) setOption(+e.key - 1); // as the hint promises
  });
  $('mixtoggle').onclick = () => document.body.classList.toggle('mixing');
  $('qprev').onclick = () => goQuestion(Math.max(0, qi - 1));
  $('qnext').onclick = () => goQuestion(qi >= QUESTIONS.length ? 0 : qi + 1);
  $('qcopy').onclick = async () => {
    const box = $('qsummary'); let ok = false;
    try {await navigator.clipboard.writeText(box.value); ok = true;} catch {}
    if (!ok) {box.focus(); box.setSelectionRange(0, box.value.length); try {ok = document.execCommand('copy');} catch {}}
    $('qcopy').textContent = ok ? 'Copied ✓' : 'Selected — copy it from the box';
  };
  $('safe').onclick = () => $('safe').classList.toggle('on', document.body.classList.toggle('safe'));
  $('big').onclick = () => {$('big').classList.toggle('on', document.body.classList.toggle('big')); fit();};
  $('loop').onclick = () => {
    // in a question, looping again returns to the moment's own passage and length (it used to loop 4 s from wherever the
    // playhead was, under a label still reading the question's length)
    if (qmode && qi < QUESTIONS.length && loop === null && loopHome !== null) {loop = loopHome; loopLen = QUESTIONS[qi].len ?? 4; seek(loop);}
    else {loop = loop === null ? seconds : null; loopLen = 4;}
    $('loop').classList.toggle('on', loop !== null); $('loop').textContent = `Loop ${loopLen} s`;
  };
  let touch = null;
  $('stagewrap').addEventListener('pointerdown', e => {touch = {x: e.clientX, y: e.clientY};});
  $('stagewrap').addEventListener('pointercancel', () => {touch = null;}); // a scroll that began on the picture is not a tap
  $('stagewrap').addEventListener('pointerup', e => {
    if (!touch) return; const dx = e.clientX - touch.x, dy = e.clientY - touch.y; touch = null;
    if (feelmode) return; // a swipe used to load a preset's look (hits, colour) into the blind test
    const i = PRESETS.indexOf(preset);
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (qmode && qi < QUESTIONS.length) cycleOption(dx < 0 ? 1 : -1);
      else if (!qmode) choosePreset(PRESETS[(i + (dx < 0 ? 1 : PRESETS.length - 1)) % PRESETS.length]);
    }
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) togglePlay();
  });
  addEventListener('resize', fit); new ResizeObserver(fit).observe(canvas);
  requestAnimationFrame(tick);
}
fit();
// ── the hit bench: one strength for every hit, played at any speed ──────────
function setBench(on) {
  $('bench').hidden = !on; if (on) return renderBench();
  // leaving the bench also leaves its slow motion, and the Play button must say so (it could stay on 'Pause')
  forceE = null; slowmo = slowRun = false; $('play').textContent = playing ? 'Pause' : 'Play';
}
function renderBench() {
  const list = S.hits.map(h => h.I), bins = new Array(24).fill(0); list.forEach(e => bins[Math.min(23, Math.floor(e * 24))]++);
  const top = Math.max(...bins); $('benchhist').replaceChildren(...bins.map(b => {const i = document.createElement('i'); i.style.height = (100 * b / top) + '%'; return i;}));
  const e = +$('benchstrength').value, below = list.filter(v => v < e).length / list.length;
  $('benchlabel').textContent = forceE === null ? 'Every hit at its real strength. Drag to set one strength for all of them.' : `Strength ${e.toFixed(2)}: stronger than ${Math.round(100 * below)} % of this song’s hits`;
  $('benchreal').classList.toggle('on', forceE === null); $('benchslow').classList.toggle('on', slowmo);
}
if (!shot) {
  $('exagx').value = String(shakeX); $('exagval').textContent = '×' + shakeX.toFixed(1);
  $('exagx').oninput = () => setShakeX(+$('exagx').value);
  $('benchstrength').oninput = () => {forceE = +$('benchstrength').value; renderBench(); draw();};
  $('benchreal').onclick = () => {forceE = null; renderBench(); draw();};
  $('benchslow').onclick = () => {const on = !slowmo; pause(); slowmo = on; slowRun = on; $('play').textContent = on ? 'Pause' : 'Play'; renderBench();};
}
// ── the blind test: passages in pairs, with nothing on screen to say what is being measured ─────
const FEEL = 'concept-lab-feel-r4';
async function runFeel() {
  document.body.classList.add('feelmode'); $('feel').hidden = false; mix = {...base, ends: 'none', bg: 'white', hit: 'none'}; loop = null;
  const pairs = await (await fetch('./intensity/pairs.json')).json();
  const load = k => {try {return JSON.parse(localStorage.getItem(k) ?? '{}');} catch {return {};}}, keep = (k, v) => {try {localStorage.setItem(k, JSON.stringify(v));} catch {}};
  const got = load(FEEL), notes = load(FEEL + '-notes'); let i = pairs.findIndex(p => !got[p.id]); if (i < 0) i = pairs.length; let run = 0;
  const flag = document.createElement('div'); flag.className = 'sideflag'; flag.hidden = true; $('stagewrap').append(flag);
  const pick = [...$('feelpick').children];
  const show = () => {
    const done = i >= pairs.length, id = pairs[i]?.id;
    $('qprogress').textContent = done ? 'All done' : `Pair ${i + 1} of ${pairs.length}`;
    $('concept').textContent = done ? 'Thank you.' : 'Which passage feels more intense?';
    $('line').textContent = done ? 'Copy this and paste it to me with your other answers.' : 'Sound on. Five seconds each. Answer whenever you know, and change your mind freely.';
    $('feelplay').hidden = $('feelpick').hidden = $('feelnote').hidden = done; $('feelsummary').hidden = $('feelcopy').hidden = !done;
    $('feelprev').disabled = i === 0; $('feelnext').hidden = done; $('feelnext').textContent = i === pairs.length - 1 ? 'Finish' : 'Next pair'; $('feelnow').textContent = '';
    pick.forEach(b => b.classList.toggle('on', !done && got[id] === b.dataset.v)); if (!done) $('feelnote').value = notes[id] ?? '';
    if (done) $('feelsummary').value = 'Blind pairs: ' + pairs.map(p => `${p.id}:${got[p.id] ?? '-'}`).join(' ') + pairs.filter(p => notes[p.id]).map(p => `\n${p.id}: ${notes[p.id]}`).join('');
  };
  const stop = () => {run++; if (playing) pause(); flag.hidden = true; $('feelplay').textContent = 'Play A, then B';};
  const clip = async (c, name, me) => {
    if (song !== c.song || !S) await loadSong(c.song); if (me !== run) return; flag.textContent = name; flag.hidden = false; seconds = c.t; await draw();
    await music.play(c.t, 1); playing = music.playing; if (!playing) throw new Error('Sound did not start. Tap again.');
    await new Promise(res => {const end = c.t + 5, f = () => {if (seconds >= end || !playing || me !== run) {res(); return;} requestAnimationFrame(f);}; f();});
    if (me === run) {pause(); flag.hidden = true;}
  };
  $('feelplay').onclick = async () => {
    stop(); const p = pairs[i], me = run; $('feelplay').textContent = 'Play again';
    try {await clip(p.A, 'A', me); if (me === run) await new Promise(r => setTimeout(r, 450)); if (me === run) await clip(p.B, 'B', me);} catch (e) {$('feelnow').textContent = e.message;}
  };
  pick.forEach(b => {b.onclick = () => {got[pairs[i].id] = b.dataset.v; keep(FEEL, got); show();};});
  $('feelnote').oninput = () => {notes[pairs[i].id] = $('feelnote').value; keep(FEEL + '-notes', notes);};
  $('feelnext').onclick = () => {stop(); i++; show();};
  $('feelprev').onclick = () => {stop(); i = Math.max(0, i - 1); show();};
  $('feelcopy').onclick = async () => {const box = $('feelsummary'); let ok = false; try {await navigator.clipboard.writeText(box.value); ok = true;} catch {} if (!ok) {box.focus(); box.select(); try {ok = document.execCommand('copy');} catch {}} $('feelcopy').textContent = ok ? 'Copied ✓' : 'Selected: copy it from the box';};
  show();
}
if (feelmode) {song = 'los'; mix = {...base, ends: 'none', bg: 'white', hit: 'none'}; seconds = 4; loadSong(song).then(runFeel).catch(e => status('Could not load: ' + e.message));}
else if (qmode) {
  song = QUESTIONS[Math.min(qi, QUESTIONS.length - 1)].song;
  const restore = {opt: LETTERS.indexOf(q.get('opt') ?? 'A'), mo: (+q.get('mo') || 0) - 1};
  loadSong(song).then(() => goQuestion(qi, restore)).catch(e => status('Could not load: ' + e.message));
}
else loadSong(song).catch(e => status('Could not load: ' + e.message));
// Read-only state for uicheck.mjs: lets the interaction suite assert what is drawn, not just that nothing threw.
window.__labState = () => ({qi, qopt, qmoment, momentExtra, momentLabel, mix: {...mix}, song, loaded: S?.key ?? null, ridesOld, loadedOld,
  loop, loopLen, seconds, playing, slowmo, slowRun, forceE, shakeX, scheme: S ? schemeAt(seconds) : null});
