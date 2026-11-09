// A look: everything the picture can vary, as named options. One source of truth for the concept lab, the films and the
// finished videos. V1 is the settled default, chosen with the owner over concept-lab rounds 1–20 (generated/concept-lab/LEDGER.md
// has the owner's words per piece); a theme is V1 plus a few choices that belong together. Pure: no DOM.
import {SCHEMES, SCHEME_NAMES} from './palettes.js';

/** Every option of every parameter, with its label (the lab shows these). */
export const OPTIONS = {
  scheme: ['Colour', SCHEME_NAMES],
  // how the colours answer the ride's intensity: Whisper (the paper only, very slightly), Plain (nothing), or a response of grade.js
  paper: ['Paper', {whisper: 'Whisper (tints very slightly with the ride’s intensity)', plain: 'Plain',
    saturation: 'Saturation: muted when quiet, the colours arrive with the music', vibrance: 'Vibrance: the muted colours gain colour with the music',
    contrast: 'Contrast: soft when quiet, full contrast with the music', both: 'Saturation and contrast: soft and muted when quiet',
    brightness: 'Brightness: the paper lightens with the music',
    // round 34: the normal part as designed, the effect only when intense
    vibranceLate: 'Vibrance, only when intense, gentler', vibranceKeepPaper: 'Vibrance, only when intense, the paper stays',
    saturationUp: 'Saturation rising when intense', contrastUp: 'Contrast rising when intense', vibranceContrast: 'Vibrance and contrast, when intense',
    // round 35: vibrance's settings apart (grade.js)
    vibranceStrongHalfPaper: 'Vibrance from 0.45, strength 1.1, paper half', vibranceStrongKeepPaper: 'Vibrance from 0.45, strength 1.1, paper stays',
    vibranceTopHalfPaper: 'Vibrance from 0.6, strength 1.1, paper half', vibranceTopKeepPaper: 'Vibrance from 0.6, strength 1.1, paper stays',
    // round 37: the soft-start curves (grade.js SOFT, SOFTER)
    vibranceSoftHalfPaper: 'Vibrance, soft start, paper half', vibranceSoftKeepPaper: 'Vibrance, soft start, paper stays',
    vibranceSofterHalfPaper: 'Vibrance, softer, paper half', vibranceSofterKeepPaper: 'Vibrance, softer, paper stays'}],
  line: ['Line', {inking: 'Pencil → ink', rail: 'Whole rail on first touch', ink: 'All ink'}],
  band: ['Lower band', {none: 'None', bars: 'Bars, the loudest in the accent', fork: 'Tuning fork, the loudest in the accent', iris: 'Iris'}],
  accent: ['What takes the accent', {heat: 'Heat (follows recent hits)', loud: 'The loudest three'}],
  bandHeight: ['Band height', {low: 'Low', lowmid: 'Low-middle', mid: 'Middle'}],
  top: ['Top of the frame', {none: 'Nothing', sun: 'Sun', title: 'Song title'}],
  riderLower: ['The rider sits lower by', {'0': 'Nothing (v1)', '8': '8 px', '16': '16 px'}],
  sunRider: ['With a sun, the rider sits lower by', {'0': 'Nothing', '32': '32 px (v1)', '48': '48 px', '96': '96 px'}],
  sunLift: ['The sun sits higher by', {'0': 'Nothing', '16': '16 px (v1)', '19.2': '19 px', '32': '32 px', '38.4': '38 px'}],
  drop: ['At the drop', {off: 'Nothing', night: 'Night', switch: 'Switch to the scheme’s drop partner'}],
  zoom: ['Zoom over time', {steady: 'Steady', quiet: 'Out when quiet'}],
  ends: ['Opening & ending', {course: 'Whole course at both ends', none: 'None'}],
  irisWeight: ['Iris strands', {thin: 'Thin (v1)', bold: 'Bold'}],
  hits: ['On each hit', {v1: 'Split, colour boost, shake on strong hits (v1)', none: 'Nothing'}],
};

export const V1 = {
  // camera: Follows direction (fixed in camera.js), 15 % closer than the first videos, a steady zoom, the whole course at both
  // ends (R1–R7)
  zoom: 'steady', ends: 'course',
  // line: pencil → ink as the rider passes (R1, R5); whole rail and all ink are alternatives (R5–R6)
  line: 'inking',
  // band: low-middle (R3); the heat logic decides how many bars take the accent (R4); each theme chooses its form
  band: 'none', accent: 'heat', bandHeight: 'lowmid',
  // paper: Whisper (R3–R4); nothing at the top unless a theme asks; no drop treatment unless a theme asks
  scheme: 'graphite', paper: 'whisper', top: 'none', drop: 'off',
  // the rider's height (design pixels of 1080 × 1920, added to the camera's); with a sun, 32 px lower still and the sun 16 px
  // higher (R21). Round 22 confirmed the whole layout as it is.
  riderLower: '0', sunRider: '32', sunLift: '16',
  // hits: each on its own, driven by what the ride did, from its strongest frame (R23): the split and the colour boost, and a shake
  // on strong hits only; no camera motion otherwise (R26; picture.js has the curves)
  hits: 'v1', irisWeight: 'thin',
};

/** The golden set's first themes (round 20): each chooses a palette, band, top element, line and drop so that they belong together. */
export const THEMES = {
  paper: {name: 'Paper Night', line: 'Graphite, the fork with the loudest in red, the title, Night at the drop.', look: {band: 'fork', accent: 'loud', top: 'title', drop: 'night'}},
  hokusai: {name: 'Hokusai', line: 'Washi and indigo, the bars, the sun, easing out when quiet.', look: {scheme: 'hokusai', band: 'bars', top: 'sun', zoom: 'quiet'}},
  dune: {name: 'Dune to Espresso', line: 'Sand and rust with its sun; at the drop it cuts to coffee, the sun staying.', look: {scheme: 'dune', band: 'bars', top: 'sun', drop: 'switch'}},
  prussian: {name: 'Prussian', line: 'Wada 343: ivory, a deep Prussian-teal band, the title.', look: {scheme: 'wPrussian', band: 'bars', top: 'title'}},
  celadon: {name: 'Celadon', line: 'Wada 171: celadon paper, a maroon band, a marigold sun.', look: {scheme: 'w2Celadon', band: 'bars', top: 'sun'}},
  aubergine: {name: 'Aubergine', line: 'Wada 307: lilac paper and an aubergine band; at the drop, its own night.', look: {scheme: 'w2Aubergine', band: 'bars', drop: 'switch'}},
  wisteria: {name: 'Wisteria', line: 'Wada 197: near-white grey, a violet fork, plain paper.', look: {scheme: 'w2Wisteria', band: 'fork', accent: 'loud', paper: 'plain'}},
  // dark palettes are inked from the start (R21: all ink over whole rail over pencil → ink)
  black: {name: 'Black Iris', line: 'Black, the Iris band, the whole course inked.', look: {scheme: 'black', band: 'iris', line: 'ink'}},
  plum: {name: 'Plum', line: 'Plum and amber, the bars, the whole course inked, the title.', look: {scheme: 'plum', band: 'bars', line: 'ink', top: 'title'}},
  oldrose: {name: 'Old Rose', line: 'Wada 265: violet-black, an old-rose band, all ink, the title.', look: {scheme: 'wOldRose', band: 'bars', line: 'ink', top: 'title'}},
  ultramarine: {name: 'Ultramarine', line: 'Wada 295: violet-black, a pure blue band, the whole course inked.', look: {scheme: 'wUltramarine', band: 'bars', line: 'ink'}},
  aconite: {name: 'Aconite', line: 'Wada 344: midnight paper, an aconite band, all ink.', look: {scheme: 'w2Aconite', band: 'bars', line: 'ink'}},
  // candidates of the theme study (8 November, concept-lab/theme-proposals.html), judged in round 27
  seashell: {name: 'Seashell Night', line: 'Wada 194: peach-shell paper, an Olympic-blue band, a jasper-red bar; Night at the drop.', look: {scheme: 'w2Seashell', band: 'bars', drop: 'night'}},
  peony: {name: 'Peony to Magenta', line: 'Wada 204 → 144: ice-blue paper and a magenta band; at the drop the page goes black, the band stays.', look: {scheme: 'w2Peony', band: 'bars', drop: 'switch'}},
  kraft: {name: 'Kraft Poster', line: 'Brown kraft, black line, rust bars, the loudest in white ink, the title: a screenprinted gig poster.', look: {scheme: 'kraftPoster', band: 'bars', top: 'title', line: 'ink'}},
  cyanotype: {name: 'Cyanotype', line: 'Blueprint blue, a white line, pale-blue bars and a yellow sun.', look: {scheme: 'cyanotypeBright', band: 'bars', top: 'sun', line: 'ink'}},
  apricot: {name: 'Apricot', line: 'Wada 253: slate-black, an apricot band, one lemon bar: the brightest dark.', look: {scheme: 'w2Apricot', band: 'bars', line: 'ink'}},
  // drafts of the second theme study (8 November), judged in round 27
  bricklacquer: {name: 'Brick to Lacquer', line: 'Wada 325 to Kintsugi: cream and a rose-brick band; at the drop, black lacquer, the line and the title turn gold.', look: {scheme: 'wBrick', band: 'bars', top: 'title', drop: 'switch'}},
  heather: {name: 'Heather', line: 'Wada 338: a pink page, a dusky-green fork, the loudest in orange-yellow, the whole rail inked on touch, the title.', look: {scheme: 'w2Heather', band: 'fork', accent: 'loud', line: 'rail', top: 'title'}},
  lavender: {name: 'Lavender Dusk', line: 'Lavender: lilac-grey paper, the Iris band in its own violets, an apricot sun.', look: {scheme: 'lavender', band: 'iris', top: 'sun'}},
  cobalt: {name: 'Cobalt', line: 'Wada 333: mint paper, a pure blue band, one sienna bar, easing out when quiet.', look: {scheme: 'w2CobaltBright', band: 'bars', zoom: 'quiet'}},
  rothko: {name: 'Rothko', line: 'The Seagram murals: a maroon room, brick bars, a candle-gold bar and a candle-gold sun; the first dark theme with a sun.', look: {scheme: 'rothko', band: 'bars', top: 'sun', line: 'ink'}},
  lyons: {name: 'Lyons Blue and Gold', line: 'Wada 126 at night: Lyons blue, an ochre-gold band, one ivory bar, the title in ivory.', look: {scheme: 'w2Lyons', band: 'bars', line: 'ink', top: 'title'}},
  slate: {name: 'Slate', line: 'Fog over a harbour: blue-grey paper, a slate band, the loudest three always mustard, plain paper.', look: {scheme: 'slate', band: 'bars', accent: 'loud', paper: 'plain'}},
  // round 28's best versions (8 November), graded 8 or more
  lemonblue: {name: 'Lemon and Blue', line: 'Wada 251: a pale yellow page, a slate fork with red heads, a green sun, the whole rail inked on touch, the title.', look: {band: 'fork', accent: 'loud', top: 'title', line: 'rail', paper: 'plain', scheme: 'lemonBlue'}},
  whitevermilion: {name: 'White and Vermilion', line: 'Red bars on white, the loudest lifted to vermilion; at the drop a blue page with peach bars.', look: {band: 'bars', accent: 'loud', drop: 'switch', scheme: 'whiteVermilion'}},
  bluerose: {name: 'Blue and Rose', line: 'A deep blue-green page, a rose fork and a lime sun: one hot note, echoed.', look: {band: 'fork', bandHeight: 'low', top: 'sun', line: 'ink', paper: 'plain', scheme: 'blueRose'}},
  dawn: {name: 'Blushing Dawn', line: 'Wada 339: a cool morning sheet that blushes to salmon as the ride heats up, violet-blue bars, an English-red sun.', look: {scheme: 'dawn', band: 'bars', top: 'sun'}},
  silverrust: {name: 'Silver and Rust', line: 'Wada 343: an ivory-buff page, deep olive bars, a burnt-sienna accent and sun.', look: {top: 'sun', line: 'rail', zoom: 'quiet', scheme: 'silverRust', band: 'bars'}},
};
/** The compiler's review clips: the ride alone, black on white, nothing that could colour a judgement of the motion. */
export const PLAIN = {paper: 'plain', line: 'ink', band: 'none', top: 'none', drop: 'off', ends: 'none', hits: 'none'};

/** A complete, validated look: V1, then the named theme ('plain' for PLAIN), then explicit overrides. */
export function resolveLook(name = null, overrides = {}) {
  // own keys only: a name such as 'constructor' or 'toString' is found on every object's prototype
  if (name !== null && name !== 'plain' && !Object.hasOwn(THEMES, name)) throw new Error(`Unknown look: ${name} (themes: ${Object.keys(THEMES).join(', ')}, or plain)`);
  const look = {...V1, ...(name === 'plain' ? PLAIN : name ? THEMES[name].look : {}), ...overrides};
  for (const [key, value] of Object.entries(look)) {
    if (!Object.hasOwn(OPTIONS, key)) throw new Error(`Unknown look option: ${key}`);
    if (!Object.hasOwn(key === 'scheme' ? SCHEMES : OPTIONS[key][1], value)) throw new Error(`Unknown ${key}: ${value}`);
  }
  return look;
}
