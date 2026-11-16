/**
 * Montagem Tomada (slowed, 58 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from
 * its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: drum phrases with light answers (to 11.49), the groove with the bass (11.49–20.8), the drums hand over to the
 * voice alone (21), a build as the bass comes back under it (31.25), a bass swell (37.291) and the firm return of the drums
 * (39.486) to the end.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'swell', name: "The swell opens it",
    about: "A step out into the groove, in for the voice; the build opens the picture a little and the bass swell carries it out to the return.",
    keyframes: [{t: 0, wide: 0.5}, {t: 10.15, wide: 0.5}, {t: 11.64, wide: 0.75}, {t: 21, wide: 0.75}, {t: 24, wide: 0.4}, {t: 31.25, wide: 0.4}, {t: 37.44, wide: 0.5}, {t: 39.64, wide: 0.9}, {t: 55, wide: 0.9}]},
  {id: 'long', name: "In with the voice, out with the build",
    about: "Wide on the drums, a slow closing in for the voice, then one long opening through the build and the swell to the return.",
    keyframes: [{t: 0, wide: 0.6}, {t: 21, wide: 0.6}, {t: 25, wide: 0.35}, {t: 31.25, wide: 0.35}, {t: 39.49, wide: 0.85}, {t: 55, wide: 0.85}]},
];
export default zooms;
