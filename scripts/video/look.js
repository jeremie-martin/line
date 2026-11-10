// A look: everything the picture can vary, as named options. One source of truth for the concept lab, the films and the
// finished videos. V1 is the settled default, chosen with the owner in the visual lab (generated/concept-lab/LEDGER.md
// has the owner's words per piece); a theme is a judged look of the collection. Pure: no DOM.
import {SCHEMES, SCHEME_NAMES} from './palettes.js';
import {COLOUR_RESPONSES} from './grade.js';
import {COLLECTION} from './collection.js';

/** Every option of every parameter, with its label (the lab shows these). */
export const OPTIONS = {
  scheme: ['Colour', SCHEME_NAMES],
  // `paper` is the saved look key, including frozen theme identities; the response now covers the whole palette.
  paper: ['Colour response', COLOUR_RESPONSES],
  line: ['Line', {inking: 'Pencil → ink', rail: 'Whole rail on first touch', ink: 'All ink'}],
  band: ['Lower band', {none: 'None', bars: 'Bars, the loudest in the accent', fork: 'Tuning fork, the loudest in the accent', iris: 'Iris'}],
  accent: ['What takes the accent', {heat: 'Heat (follows recent hits)', loud: 'The loudest three'}],
  bandHeight: ['Band height', {low: 'Low', lowmid: 'Low-middle', mid: 'Middle'}],
  top: ['Top of the frame', {none: 'Nothing', sun: 'Sun', title: 'Song title'}],
  riderLower: ['The rider sits lower by', {'0': 'Nothing (v1)', '8': '8 px', '16': '16 px'}],
  sunRider: ['With a sun, the rider sits lower by', {'0': 'Nothing', '32': '32 px (v1)', '48': '48 px', '96': '96 px'}],
  sunLift: ['The sun sits higher by', {'0': 'Nothing', '16': '16 px (v1)', '19.2': '19 px', '32': '32 px', '38.4': '38 px'}],
  drop: ['At the drop', {off: 'Nothing', night: 'Night', switch: 'Switch to the scheme’s drop partner, keeping its hot note and sun'}],
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
  // paper: how the colours answer the ride's intensity: vibrance on the soft-start curve, the paper half (R37, "a pure banger";
  // R33–R36 before, Whisper R3–R36; grade.js); nothing at the top unless a theme asks; no drop treatment unless a theme asks
  scheme: 'graphite', paper: 'vibranceSoftHalfPaper', top: 'none', drop: 'off',
  // the rider's height (design pixels of 1080 × 1920, added to the camera's); with a sun, 32 px lower still and the sun 16 px
  // higher (R21). Round 22 confirmed the whole layout as it is.
  riderLower: '0', sunRider: '32', sunLift: '16',
  // hits: each on its own, driven by what the ride did, from its strongest frame (R23): the split and the colour boost, and a shake
  // on strong hits only; no camera motion otherwise (R26; hits.js has the response)
  hits: 'v1', irisWeight: 'thin',
};

/** The themes in production: the collection (collection.js), each exactly as judged. A theme's look is its whole judged look,
 * its scheme named by its id; its name is its label in the judging registry, bound to that theme for good. */
export const THEMES = Object.fromEntries(Object.entries(COLLECTION).map(([key, {name, id, line, spec}]) =>
  [key, {name, id, line, look: {...spec.look, scheme: id}}]));

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
