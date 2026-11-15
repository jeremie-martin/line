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
  {id: 'handover', name: 'Drums wide, voice close',
    about: 'Follows the handover. Wide for the drums, a step wider when the bass joins the groove; close for the voice alone; the bass swell starts to open the picture and the return completes it at once.',
    keyframes: [{t: 0, wide: 0.7}, {t: 11.24, wide: 0.7}, {t: 11.74, wide: 0.85}, {t: 20.83, wide: 0.85}, {t: 22.3, wide: 0.35}, {t: 37.29, wide: 0.35},
      {t: 39.24, wide: 0.6}, {t: 39.74, wide: 0.95}]},
  {id: 'held', name: 'Held breath',
    about: 'Follows tension. The drums sit in the middle; from the voice\'s entry the picture closes in slowly through the whole drumless passage, closest as the bass swells; the swell starts to open it and the return opens it to the widest.',
    keyframes: [{t: 0, wide: 0.6}, {t: 20.83, wide: 0.6}, {t: 37.0, wide: 0.25}, {t: 37.29, wide: 0.25}, {t: 39.24, wide: 0.55}, {t: 39.74, wide: 0.95}]},
];
export default zooms;
