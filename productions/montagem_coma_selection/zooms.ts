/**
 * Andromeda — Montagem Coma (59 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from
 * its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song alternates drums and voice over a continuing bass: drum bursts (to 9.57), a light upper figure and the voice
 * answering (9.57–19), the return of the drums (19.075), the voice in the foreground over lighter drums (33.576–43), and the
 * last return (43.073), the strongest, to the end.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'alternate', name: 'Drums wide, voice close',
    about: 'Follows the alternation. Wide for the drum bursts; close for the light figure and the voice; each return opens the picture at once, the last one to the widest.',
    keyframes: [{t: 0, wide: 0.75}, {t: 9.4, wide: 0.75}, {t: 10.6, wide: 0.35}, {t: 18.83, wide: 0.35}, {t: 19.33, wide: 0.8}, {t: 33.3, wide: 0.8},
      {t: 34.6, wide: 0.4}, {t: 42.83, wide: 0.4}, {t: 43.33, wide: 0.95}]},
  {id: 'returns', name: 'Each return wider',
    about: 'Follows the two returns as one climb. The first quiet passage leaves the picture in the middle; the first return opens it a step; the voice\'s second passage closes it in slowly, and the last return opens it at once to the widest.',
    keyframes: [{t: 0, wide: 0.5}, {t: 18.83, wide: 0.5}, {t: 19.33, wide: 0.7}, {t: 33.58, wide: 0.7}, {t: 42.83, wide: 0.4}, {t: 43.33, wide: 1}]},
];
export default zooms;
