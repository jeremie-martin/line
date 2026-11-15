/**
 * Passo Bem Solto (slowed, 58 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from
 * its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: a call and response between percussion and voice. The groove (to 6.5), the voice forward over soft drums and bass
 * (6.513), drum strikes come back into it (15.023, 17.101), the return (23.313), a short interruption with two vocal shouts
 * (38.034, 38.65), the last return (39.892) to the end.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'call', name: 'Voice close, drums wide',
    about: 'Follows the call and response. Wide for the groove; close for the voice; the first drum strike in her passage opens the picture a little and the return opens it wide; the shouts bring it in for a moment, and the last return opens it to the widest.',
    keyframes: [{t: 0, wide: 0.7}, {t: 6.3, wide: 0.7}, {t: 7.5, wide: 0.35}, {t: 14.77, wide: 0.35}, {t: 15.27, wide: 0.5}, {t: 23.06, wide: 0.5},
      {t: 23.56, wide: 0.85}, {t: 37.78, wide: 0.85}, {t: 38.28, wide: 0.6}, {t: 39.64, wide: 0.6}, {t: 40.14, wide: 0.95}]},
  {id: 'breath', name: 'One slow breath',
    about: 'Follows the long shape, with no sudden change. The voice brings the picture in; as the drums come back into her passage it opens slowly to the return; it breathes in at the interruption and opens again for the last return.',
    keyframes: [{t: 0, wide: 0.65}, {t: 6.3, wide: 0.65}, {t: 8.4, wide: 0.4}, {t: 23.31, wide: 0.85}, {t: 37.1, wide: 0.85}, {t: 38.6, wide: 0.6},
      {t: 41.5, wide: 0.95}]},
];
export default zooms;
