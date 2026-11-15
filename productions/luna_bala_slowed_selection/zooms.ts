/**
 * Luna Bala (slowed, 56 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale every
 * song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: a groove fragment dissolves (to 3.2) into four seconds of empty space, then the voice alone (7.3) with one lone
 * drum answer (12.19) and a pickup (16.8), then the drums and upper replies return (20.921), larger than the opening, to the
 * end.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'return', name: 'The return opens wider',
    about: 'Follows the form. As the groove dissolves the picture comes in and stays close for the voice; the return opens it at once, wider than the opening.',
    keyframes: [{t: 0, wide: 0.6}, {t: 3.0, wide: 0.6}, {t: 5.5, wide: 0.35}, {t: 20.67, wide: 0.35}, {t: 21.17, wide: 0.95}]},
  {id: 'held', name: 'Held breath',
    about: 'Follows tension. The empty space opens the picture; the voice brings it in, and through the pickup it keeps closing, closest just before the return, which opens it at once to the widest.',
    keyframes: [{t: 0, wide: 0.6}, {t: 3.0, wide: 0.6}, {t: 5.0, wide: 0.85}, {t: 7.1, wide: 0.85}, {t: 11.0, wide: 0.45}, {t: 20.67, wide: 0.25},
      {t: 21.17, wide: 0.95}]},
];
export default zooms;
