// A look: everything the picture can vary, as named options. One source of truth for the concept lab, the films and the
// finished videos. V1 is the settled default, chosen with the owner over concept-lab rounds 1–20 (generated/concept-lab/LEDGER.md
// has the owner's words per piece); a theme is V1 plus a few choices that belong together. Pure: no DOM.
import {SCHEMES, SCHEME_NAMES} from './palettes.js';

/** Every option of every parameter, with its label (the lab shows these). */
export const OPTIONS = {
  scheme: ['Colour', SCHEME_NAMES],
  paper: ['Paper', {whisper: 'Whisper (tints very slightly with the ride’s intensity)', plain: 'Plain'}],
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
  hits: 'v1',
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
