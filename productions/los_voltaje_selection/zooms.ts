/**
 * Los Voltaje (57.4 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale every
 * song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: the tail of the groove (to 6.9), the voice in space over soft drums (7–15.6), the voice building and a rapid
 * pickup of words (20–23.8), then the full return of the drums (23.917) to the end, where a short three-stroke answer comes
 * every 8.27 s (27.55, 35.82, 44.09, 52.37) and a synth joins from about 32.6.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'pickup', name: "Opens through the pickup",
    about: "Wide on the groove tail, in when the voice is left in space; a little wider as the voice builds, and the rapid pickup carries the picture out to the full return.",
    keyframes: [{t: 0, wide: 0.75}, {t: 4, wide: 0.75}, {t: 8.5, wide: 0.3}, {t: 15.6, wide: 0.3}, {t: 20.15, wide: 0.4}, {t: 24.07, wide: 0.95}, {t: 54, wide: 0.95}]},
  {id: 'waves', name: "One long opening, two waves",
    about: "Comes in for the voice, then opens slowly all the way to the return, with one more step over the bar before the second wave.",
    keyframes: [{t: 0, wide: 0.6}, {t: 6, wide: 0.6}, {t: 9, wide: 0.35}, {t: 23.92, wide: 0.8}, {t: 39.15, wide: 0.8}, {t: 40.62, wide: 1}, {t: 54, wide: 1}]},
];
export default zooms;
