/** Follow the syncopated low figure through the verse and hook. The voice answers in
 * the gaps. During the break the exposed upper notes carry the rhythm to the bass return.
 * In the full band the voice crosses the same low figure. Ride the last stroke into the cut. 
 * The hook's inner beats and word endings between the low accents at 18.9–29.5 s are landed too (the strokes the owner
 * marked there on 1 November); variants/accents.ts is the same reading without them. */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "Circus Minimus", "audio": "productions/short_circus_minimus/audio.mp3", "beats": "productions/short_circus_minimus/audio.json", "spectrogram": {"image": "productions/short_circus_minimus/spectrogram.png", "metadata": "productions/short_circus_minimus/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "JVZEL & Neon Haze", phases: [
  {"name": "Verse already moving", "t0": 0, "t1": 5.89, "color": "#426582"},
  {"name": "Hats over the groove", "t0": 5.89, "t1": 18.69, "color": "#a45643"},
  {"name": "Hook catches", "t0": 18.69, "t1": 29.948, "color": "#448078"},
  {"name": "Break and five even notes", "t0": 29.948, "t1": 31.499, "color": "#826488"},
  {"name": "Voice over the full groove", "t0": 31.499, "t1": 50.758, "color": "#426582"},
  {"name": "Ride the held note and last bar", "t0": 50.758, "t1": 57.262, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // Verse. The low phrase already sounds before the hats arrive.
  [.292,.81],[.692,.27],[1.487,.88],[1.888,.31],[2.689,.85],[3.09,.27],
  [3.49,.91],[3.891,.29],[4.692,.84],[5.092,.31],[5.296,.22],[5.893,.91],
  // The three low strokes across eight beats. Hats and words touch lightly in their holes.
  [6.282,.26],[6.689,.32],[7.089,.88],[7.443,.28],[7.89,.94],[8.291,.32],
  [8.593,.25],[9.092,.96],[9.487,.14],[9.881,.30],[10.288,.88],[10.688,.27],
  [11.089,.95],[11.489,.24],[11.693,.34],[12.291,.90],[12.691,.29],[13.092,.25],
  [13.492,.89],[13.887,.27],[14.287,.96],[14.688,.29],[15.089,.25],[15.489,.90],
  [15.89,.34],[16.29,.26],[16.691,.89],[16.888,.25],[17.492,.95],[17.892,.33],[18.188,.24],
  // The hook articulates the inner beats and little word endings between the low accents.
  [18.693,.92],[18.937,.24],[19.088,.34],[19.32,.38],[19.495,.32],[19.669,.23],[19.889,.91],[20.087,.23],
  [20.354,.32],[20.516,.27],[20.679,.95],[20.923,.25],[21.085,.39],[21.886,.92],[22.153,.23],
  [22.281,.32],[22.525,.36],[22.699,.30],[22.85,.23],[23.094,.91],[23.291,.23],[23.523,.32],[23.721,.28],[23.883,.95],
  [24.127,.25],[24.289,.39],[25.091,.92],[25.334,.23],[25.485,.34],[25.718,.36],[25.892,.31],
  [26.066,.22],[26.298,.91],[26.484,.24],[26.751,.32],[26.913,.27],[27.087,.95],[27.308,.25],[27.494,.38],
  [28.283,.92],[28.516,.24],[28.69,.33],[28.887,.36],[29.084,.32],[29.317,.24],[29.491,.91],
  // Bass drops out. The voice trails off into the five evenly spaced notes.
  [29.944,.39],[30.118,.32],[30.35,.35],[30.512,.30],[30.687,.46],[30.884,.41],
  [31.081,.40],[31.29,.42],[31.499,.99],
  // Full groove. The singer takes the intervening beats and the occasional offbeat.
  [31.894,.33],[32.289,.38],[32.695,.89],[33.159,.34],[33.485,.95],[33.891,.36],
  [34.193,.30],[34.495,.31],[34.727,.90],[35.145,.32],[35.493,.37],[35.899,.90],[36.329,.32],
  [36.701,.94],[37.084,.26],[37.304,.34],[37.49,.24],[37.908,.90],[38.303,.27],
  [38.697,.38],[39.104,.89],[39.557,.32],[39.905,.95],[40.288,.36],[40.683,.28],
  [41.101,.90],[41.495,.27],[41.89,.38],[42.308,.90],[42.703,.25],[43.086,.94],
  [43.492,.31],[43.713,.36],[44.305,.90],[44.7,.27],[45.095,.35],[45.501,.89],
  [45.919,.35],[46.29,.95],[46.685,.36],[46.987,.29],[47.498,.90],[47.904,.27],
  [48.299,.38],[48.705,.90],[49.146,.33],[49.495,.94],[49.889,.37],[50.11,.30],[50.702,.90],
  // Carry the held voice; the low syncopation continues to the final bar.
  [51.492,.36],[51.91,.89],[52.304,.28],[52.687,.95],[53.094,.36],[53.489,.29],
  [53.907,.90],[54.301,.27],[54.696,.36],[55.091,.90],[55.59,.33],[55.892,.95],
  [56.298,.35],[56.577,.28],[57.099,.92],
];

const spec: Spec = {
  duration: 57.262, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.58], [5.89, 0.54], [18.69, 0.59], [29.948, 0.79], [31.499, 0.79], [50.758, 0.66]]),
    speed: curve([[0, 0.72], [5.89, 0.84], [18.69, 0.92], [29.948, 0.98], [31.499, 0.97], [50.758, 0.88]]),
  },
};
export default spec;
