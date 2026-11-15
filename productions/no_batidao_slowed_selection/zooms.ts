/**
 * No Batidão (slowed, 59.5 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from its
 * id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: this cut starts on the percussion-only build (to 6.4), the bass arrives (6.409) for the full body, a vocal passage
 * with sparse drum answers (23.626–32.5), and the return (32.496), where the voice drops out at about 41, to the end.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'stages', name: 'Bass wide, voice close',
    about: 'Follows the bass and the voice. The drums alone sit in the middle; the bass opens the picture at once; the vocal passage comes back in, and the return opens it to the widest.',
    keyframes: [{t: 0, wide: 0.55}, {t: 6.16, wide: 0.55}, {t: 6.66, wide: 0.85}, {t: 23.4, wide: 0.85}, {t: 24.6, wide: 0.45}, {t: 32.25, wide: 0.45},
      {t: 32.75, wide: 0.95}]},
  {id: 'pull', name: 'One pull-back, one held breath',
    about: 'Follows the two builds differently. The picture opens without a pause through the drums\' build and is widest as the bass arrives; through the vocal passage it closes in slowly, and the return opens it at once.',
    keyframes: [{t: 0, wide: 0.35}, {t: 6.41, wide: 0.95}, {t: 23.4, wide: 0.95}, {t: 32.25, wide: 0.4}, {t: 32.75, wide: 0.95}]},
];
export default zooms;
