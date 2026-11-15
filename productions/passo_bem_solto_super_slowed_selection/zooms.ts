/**
 * Passo Bem Solto (super slowed, 60 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them
 * from its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the
 * scale every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back
 * to the whole course. Times are the song's (composition.json).
 *
 * The song: a call and response between percussion and voice. The tail of the groove (to 5.4), the exposed voice (5.457), drum
 * strikes come back into it (14.478, 16.672), the return (23.255), a short interruption with three vocal shouts (38.847,
 * 39.509, 40.043), the last return (40.821) to the decay (58.4).
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'call', name: 'Voice close, drums wide',
    about: 'Follows the call and response. Wide for the groove; close for the voice; the first drum strike in her passage opens the picture a little and the return opens it wide; the shouts bring it in, and the last return opens it to the widest.',
    keyframes: [{t: 0, wide: 0.7}, {t: 5.2, wide: 0.7}, {t: 6.4, wide: 0.35}, {t: 14.23, wide: 0.35}, {t: 14.73, wide: 0.5}, {t: 23.0, wide: 0.5},
      {t: 23.5, wide: 0.85}, {t: 38.6, wide: 0.85}, {t: 39.1, wide: 0.6}, {t: 40.57, wide: 0.6}, {t: 41.07, wide: 0.95}]},
  {id: 'breath', name: 'One slow breath',
    about: 'Follows the long shape, with no sudden change. The voice brings the picture in; as the drums come back into her passage it opens slowly to the return; it breathes in at the interruption and opens again for the last return.',
    keyframes: [{t: 0, wide: 0.65}, {t: 5.2, wide: 0.65}, {t: 7.3, wide: 0.4}, {t: 23.26, wide: 0.85}, {t: 37.9, wide: 0.85}, {t: 39.4, wide: 0.6},
      {t: 42.4, wide: 0.95}]},
];
export default zooms;
