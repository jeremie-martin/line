/**
 * Passo Bem Solto (56 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale every
 * song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: a call and response between percussion and voice. The groove (to 9.1), the voice leads over soft drums (9.114),
 * drum strikes come back into it (16.695, 18.541), the return (24.079), a short interruption with two vocal shouts (37.198,
 * 37.756), the last return (38.847), and the start of a decay (54.5).
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'call', name: 'Voice close, drums wide',
    about: 'Follows the call and response. Wide for the groove; close for the voice; the first drum strike in her passage opens the picture a little and the return opens it wide; the shouts bring it in for a moment, and the last return opens it to the widest.',
    keyframes: [{t: 0, wide: 0.7}, {t: 8.9, wide: 0.7}, {t: 10.1, wide: 0.35}, {t: 16.45, wide: 0.35}, {t: 16.95, wide: 0.5}, {t: 23.83, wide: 0.5},
      {t: 24.33, wide: 0.85}, {t: 36.95, wide: 0.85}, {t: 37.45, wide: 0.6}, {t: 38.6, wide: 0.6}, {t: 39.1, wide: 0.95}]},
  {id: 'breath', name: 'One slow breath',
    about: 'Follows the long shape, with no sudden change. The voice brings the picture in; as the drums come back into her passage it opens slowly to the return; it breathes in at the interruption and opens again for the last return.',
    keyframes: [{t: 0, wide: 0.65}, {t: 8.9, wide: 0.65}, {t: 11.0, wide: 0.4}, {t: 24.08, wide: 0.85}, {t: 36.3, wide: 0.85}, {t: 37.8, wide: 0.6},
      {t: 40.5, wide: 0.95}]},
];
export default zooms;
