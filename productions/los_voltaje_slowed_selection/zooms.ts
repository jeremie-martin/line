/**
 * Los Voltaje (slowed, 58 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from its
 * id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: the tail of the groove (to 4.4), the voice over soft drums (4.66–13.5), a phrase rising into a fast pickup of words
 * (18.19) over a gap in the drums, then the return (22.291) to the end, where a short three-stroke answer comes every 8.76 s
 * (26.13, 34.89, 43.64, 52.40) and a synth joins from about 31.9.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'pickup', name: "Opens through the pickup",
    about: "Wide on the groove tail, in when the voice is left alone; a little wider as the phrase rises, and the pickup carries the picture out to the return.",
    keyframes: [{t: 0, wide: 0.75}, {t: 2, wide: 0.75}, {t: 6.5, wide: 0.3}, {t: 13.5, wide: 0.3}, {t: 18.34, wide: 0.4}, {t: 22.44, wide: 0.9}, {t: 55, wide: 0.9}]},
  {id: 'waves', name: "One long opening",
    about: "Comes in for the voice, then opens slowly all the way to the return, with one more step over the bar before the wider arcs.",
    keyframes: [{t: 0, wide: 0.6}, {t: 4, wide: 0.6}, {t: 7, wide: 0.35}, {t: 22.29, wide: 0.75}, {t: 37.95, wide: 0.75}, {t: 39.42, wide: 0.95}, {t: 55, wide: 0.95}]},
];
export default zooms;
